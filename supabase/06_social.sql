-- =====================================================================
--  Mate TCG Online — amis et profils publics
--  A executer apres 03_rpc.sql. Rejouable sans danger.
-- =====================================================================

-- Une seule ligne par paire, rangee dans un ordre stable (a < b) : impossible
-- d'avoir deux amities croisees entre les memes personnes.
create table if not exists public.friendships (
  a           uuid not null references public.profiles on delete cascade,
  b           uuid not null references public.profiles on delete cascade,
  demandeur   uuid not null references public.profiles on delete cascade,
  accepte     boolean not null default false,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (a, b),
  constraint paire_ordonnee check (a < b)
);
create index if not exists friendships_b_idx on public.friendships (b);

alter table public.friendships enable row level security;
drop policy if exists p_amis_read on public.friendships;
create policy p_amis_read on public.friendships for select
  using (a = auth.uid() or b = auth.uid());

grant select on public.friendships to authenticated;
revoke insert, update, delete on public.friendships from anon, authenticated;

-- ---------------------------------------------------------------- demander
create or replace function public.friend_request(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); autre profiles; x uuid; y uuid; ligne friendships;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into autre from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if autre.id = moi then raise exception 'Tu ne peux pas t''ajouter toi-même.'; end if;

  x := least(moi, autre.id); y := greatest(moi, autre.id);
  select * into ligne from friendships where a = x and b = y for update;

  if found then
    if ligne.accepte then raise exception 'Vous êtes déjà amis.'; end if;
    -- Une demande croisee vaut acceptation : les deux se sont choisis.
    if ligne.demandeur <> moi then
      update friendships set accepte = true, resolved_at = now() where a = x and b = y;
      perform notifier(autre.id, 'ami_accepte', moi);
      return friend_list();
    end if;
    raise exception 'Ta demande est déjà en attente.';
  end if;

  if (select count(*) from friendships where demandeur = moi and not accepte) >= 25 then
    raise exception 'Tu as déjà 25 demandes en attente.';
  end if;

  insert into friendships (a, b, demandeur) values (x, y, moi);

  -- Dans la boite de l'autre (supabase/11_boite.sql). Une demande annulee puis
  -- renvoyee ne doit pas s'empiler : on retire d'abord l'ancienne annonce.
  delete from notifications where user_id = autre.id and acteur = moi and type = 'ami_demande';
  perform notifier(autre.id, 'ami_demande', moi);
  return friend_list();
end $$;

-- ----------------------------------------------------------------- repondre
create or replace function public.friend_respond(p_pseudo text, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); autre profiles; x uuid; y uuid; ligne friendships;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into autre from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Joueur introuvable.'; end if;

  x := least(moi, autre.id); y := greatest(moi, autre.id);
  select * into ligne from friendships where a = x and b = y for update;
  if not found or ligne.accepte then raise exception 'Aucune demande en attente.'; end if;
  if ligne.demandeur = moi then raise exception 'C''est toi qui as fait cette demande.'; end if;

  if p_accept then
    update friendships set accepte = true, resolved_at = now() where a = x and b = y;
    perform notifier(autre.id, 'ami_accepte', moi);
  else
    delete from friendships where a = x and b = y;
  end if;
  return friend_list();
end $$;

-- ------------------------------------------------------------------ retirer
-- Sert aussi a annuler sa propre demande : dans les deux cas, la ligne saute.
create or replace function public.friend_remove(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); autre profiles;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into autre from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Joueur introuvable.'; end if;
  delete from friendships
   where a = least(moi, autre.id) and b = greatest(moi, autre.id);
  return friend_list();
end $$;

-- -------------------------------------------------------------------- lister
-- Amis confirmes, demandes recues et demandes envoyees, en un seul appel.
create or replace function public.friend_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
        'photo', photo_discord(o.id),
        'is_admin', o.is_admin, 'streak', o.streak,
        'lien', case when f.accepte then 'ami'
                     when f.demandeur = moi then 'envoyee' else 'recue' end,
        'depuis', coalesce(f.resolved_at, f.created_at),
        /* Combien de demandes d'echange sont en attente entre nous deux. */
        'echanges', (select count(*) from trades t
                      where t.status = 'pending'
                        and ((t.from_user = moi and t.to_user = o.id)
                          or (t.from_user = o.id and t.to_user = moi))))
      order by f.accepte, o.pseudo)
    from friendships f
    join profiles o on o.id = case when f.a = moi then f.b else f.a end
    where f.a = moi or f.b = moi
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------- fiche d'un joueur
-- Les compteurs sont publics. La collection n'est detaillee qu'entre amis :
-- c'est ce qui permet de viser un echange sur une carte qu'il possede vraiment.
create or replace function public.player_profile(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;

  ami := o.id = moi or exists (
    select 1 from friendships
     where a = least(moi, o.id) and b = greatest(moi, o.id) and accepte);

  -- `not promo`, des deux cotes. Les cartes Promo vivent dans `cards` pour
  -- pouvoir entrer dans une collection, mais elles n'appartiennent pas a
  -- l'extension : ni dans son total, ni dans son pourcentage (voir la table
  -- `cards` et sync_collection_quests dans 01_schema.sql).
  --
  -- Sans ce garde-fou, la fiche d'un joueur annoncait « / 126 » pendant que
  -- son propre ecran Collection et le palier des 100 % comptaient 122. Deux
  -- ecrans, deux verites, et un joueur a 122/122 qui se voyait incomplet.
  select count(*) into total from cards where not promo;
  select count(*) into possede
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and not k.promo;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end);
end $$;

-- ---------------------------------------------------------------- droits
revoke all on function public.friend_request, public.friend_respond,
  public.friend_remove, public.friend_list, public.player_profile from public, anon;
grant execute on function public.friend_request, public.friend_respond,
  public.friend_remove, public.friend_list, public.player_profile to authenticated;
