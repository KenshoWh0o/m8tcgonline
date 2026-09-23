-- =====================================================================
--  Mate TCG Online — la boite de reception
--  A executer apres 07_vitrine.sql. Rejouable sans danger.
--
--  Ce qui arrive des autres ne se voyait qu'en ouvrant l'onglet Social, et
--  encore : le navigateur comparait deux listes successives pour deviner ce
--  qui etait nouveau. Une demande d'ami n'etait jamais annoncee, une demande
--  acceptee pendant qu'on etait ailleurs ne l'etait pas non plus.
--
--  Desormais, c'est le serveur qui ecrit l'evenement au moment ou il a lieu,
--  dans la boite du destinataire. Le navigateur n'a plus rien a deviner : il
--  lit la boite, et tout ce qu'il n'a pas encore vu est nouveau.
--
--  Deux sources dans la meme boite :
--    · `notifications` : ce qui concerne un joueur — demande d'ami, demande
--      d'echange, reponse a une demande. Ecrit par notifier(), appele depuis
--      friend_request, friend_respond, trade_create et trade_respond.
--    · `annonces` : ce qui concerne tout le monde. Publiees depuis le Labo par
--      un administrateur (annonce_publier), ou a la main dans le SQL Editor.
--
--  Lu ou non lu : une seule date par joueur, `profiles.boite_vue_le`. Tout ce
--  qui est plus recent est nouveau. Pas de case a cocher par message : on
--  ouvre la boite, on a tout vu.
-- =====================================================================

alter table public.profiles
  add column if not exists boite_vue_le timestamptz not null default now();

-- --------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  -- ami_demande | ami_accepte | echange_recu | echange_accepte | echange_refuse
  type       text not null,
  -- L'autre joueur : celui qui demande, qui accepte, qui refuse.
  acteur     uuid references public.profiles on delete cascade,
  -- Ce dont on parle : l'identifiant d'un echange, par exemple.
  ref        text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);

alter table public.notifications enable row level security;
drop policy if exists p_notif_read on public.notifications;
create policy p_notif_read on public.notifications for select using (user_id = auth.uid());

-- Le droit de lecture sert au temps reel : Supabase ne pousse une ligne qu'a
-- qui a le droit de la lire, et la policy ci-dessus limite chacun a la sienne.
-- Le navigateur, lui, passe par boite(). Aucune ecriture : seul notifier()
-- ajoute une ligne.
grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

-- --------------------------------------------------------------- annonces
create table if not exists public.annonces (
  id         bigint generated always as identity primary key,
  titre      text not null check (length(titre) between 1 and 80),
  texte      text not null default '' check (length(texte) <= 600),
  auteur     uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  actif      boolean not null default true
);

alter table public.annonces enable row level security;
drop policy if exists p_annonces_read on public.annonces;
create policy p_annonces_read on public.annonces for select using (actif);
grant select on public.annonces to authenticated;
revoke insert, update, delete on public.annonces from anon, authenticated;

-- ------------------------------------------------------------ l'ecriture
-- Rouage interne, appele par les actions du jeu. Jamais par le navigateur :
-- sinon n'importe qui pourrait remplir la boite de n'importe qui.
create or replace function public.notifier(dest uuid, t text, qui uuid,
                                           r text default null, d jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, acteur, ref, data)
  values (dest, t, qui, r, coalesce(d, '{}'::jsonb));
$$;

revoke all on function public.notifier from public, anon, authenticated;

-- --------------------------------------------------------------- la boite
-- Les cinquante derniers evenements et les dix dernieres annonces, avec de
-- quoi les afficher sans autre appel : le pseudo et l'avatar d'en face, et si
-- la demande attend encore une reponse — une demande d'ami deja acceptee ne
-- doit plus proposer « Accepter ».
create or replace function public.boite() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); vue timestamptz;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  -- Le menage se fait en passant : un mois d'historique suffit.
  delete from notifications where user_id = p and created_at < now() - interval '30 days';

  select boite_vue_le into vue from profiles where id = p;

  return jsonb_build_object(
    'vue_le', vue,
    'serveur', now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', 'n' || n.id, 'type', n.type, 'quand', n.created_at,
          'ref', n.ref, 'data', n.data,
          'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
          'photo', photo_discord(o.id),
          'en_attente', case n.type
            when 'ami_demande' then exists (
              select 1 from friendships f
               where f.a = least(p, n.acteur) and f.b = greatest(p, n.acteur)
                 and not f.accepte and f.demandeur = n.acteur)
            when 'echange_recu' then exists (
              select 1 from trades t where t.id = n.ref::uuid and t.status = 'pending')
            else false end,
          'statut', case when n.type = 'echange_recu'
            then (select t.status::text from trades t where t.id = n.ref::uuid) end)
        order by n.id desc)
      from (select * from notifications where user_id = p order by id desc limit 50) n
      left join profiles o on o.id = n.acteur
    ), '[]'::jsonb),
    'annonces', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', 'a' || a.id, 'num', a.id, 'titre', a.titre, 'texte', a.texte,
          'quand', a.created_at)
        order by a.id desc)
      from (select * from annonces where actif order by id desc limit 10) a
    ), '[]'::jsonb));
end $$;

-- Ouvrir la boite, c'est tout lire.
create or replace function public.boite_lue() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  update profiles set boite_vue_le = now() where id = p;
  return jsonb_build_object('vue_le', now());
end $$;

-- Le nombre de nouveautes, pour la pastille. Appele par me().
create or replace function public.boite_non_lues(p uuid) returns int
language sql stable security definer set search_path = public as $$
  select ((select count(*) from notifications n, profiles pr
            where pr.id = p and n.user_id = p and n.created_at > pr.boite_vue_le)
        + (select count(*) from annonces a, profiles pr
            where pr.id = p and a.actif and a.created_at > pr.boite_vue_le))::int;
$$;

revoke all on function public.boite_non_lues from public, anon, authenticated;

-- ------------------------------------------------------------- les annonces
-- Reservees aux administrateurs, et verifiees ici : cacher le formulaire du
-- Labo ne protegerait rien.
create or replace function public.annonce_publier(p_titre text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if length(trim(coalesce(p_titre, ''))) = 0 then raise exception 'Il manque un titre.'; end if;

  insert into annonces (titre, texte, auteur)
  values (left(trim(p_titre), 80), left(trim(coalesce(p_texte, '')), 600), auth.uid());
  return boite();
end $$;

create or replace function public.annonce_retirer(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  update annonces set actif = false where id = p_id;
  return boite();
end $$;

revoke all on function public.boite, public.boite_lue, public.annonce_publier,
  public.annonce_retirer from public, anon;
grant execute on function public.boite, public.boite_lue, public.annonce_publier,
  public.annonce_retirer to authenticated;

-- ------------------------------------------------------------- temps reel
-- Une demande qui arrive est poussee tout de suite au navigateur concerne,
-- au lieu d'attendre la prochaine releve. Si le temps reel n'est pas
-- disponible, rien ne casse : le navigateur releve la boite de lui-meme
-- toutes les trente secondes.
--
-- Un refus ici (droits, publication absente) ne doit pas faire echouer toute
-- l'installation : on le signale et on continue.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception
      when duplicate_object then null;
      when others then raise notice 'Temps reel non active pour notifications : %', sqlerrm;
    end;
    begin
      alter publication supabase_realtime add table public.annonces;
    exception
      when duplicate_object then null;
      when others then raise notice 'Temps reel non active pour annonces : %', sqlerrm;
    end;
  end if;
end $$;

-- =====================================================================
--  Publier une annonce a la main, sans passer par le Labo :
-- =====================================================================
-- insert into public.annonces (titre, texte) values
--   ('Le jeu est ouvert !', 'Merci d''etre la. Les echanges se passent dans l''onglet Social.');
--
--  La retirer (elle disparait de toutes les boites) :
-- update public.annonces set actif = false where id = 1;
