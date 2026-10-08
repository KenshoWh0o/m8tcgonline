-- =====================================================================
--  Mate TCG Online — version 2.0 « Reflets »
--  A executer apres 18_cadeaux.sql. Rejouable sans danger.
--
--  Ce que la 2.0 ajoute cote serveur, hors des fichiers qu'elle retouche
--  (les Reverses sont dans 03b_promos.sql, leur case de booster dans
--  03_rpc.sql) :
--    1. les parametres du jeu qu'un administrateur ouvre a la main ;
--    2. l'evenement « Reflets » : sa monnaie (les Prismes), sa piste de
--       recompenses, sa boutique et ses quetes (04_seed.sql) ;
--    3. le Cartle, la carte a deviner chaque jour ;
--    4. les invitations, achetees en boutique ;
--    5. les titres et la personnalisation du profil.
-- =====================================================================

-- ============================================================ 1. reglages
-- Une seule ligne. `fabrication_reverse` : fermee au lancement de la 2.0 —
-- les Fragments deja accumules rempliraient la collection Reverse d'un coup.
-- L'ouvrir, plus tard, dans le SQL Editor :
--   update public.parametres set fabrication_reverse = true where id = 1;
create table if not exists public.parametres (
  id                  int primary key check (id = 1),
  fabrication_reverse boolean not null default false
);
insert into public.parametres (id) values (1) on conflict (id) do nothing;
alter table public.parametres enable row level security;
revoke all on public.parametres from anon, authenticated;

-- ===================================================== 2. l'evenement en cours
-- Le code de l'evenement en cours (15_evenements.sql), s'il en a un.
create or replace function public.evenement_en_cours() returns text
language sql stable security definer set search_path = public as $$
  select e.code from evenements e
   where e.code is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
$$;

-- ------------------------------------------------------------- les Prismes
-- La monnaie d'un evenement : `solde` se depense dans sa boutique, `total`
-- (tout ce qu'on a gagne) fait avancer sa piste de recompenses — acheter ne
-- fait jamais reculer la piste.
create table if not exists public.evt_comptes (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  solde     integer not null default 0 check (solde >= 0),
  total     integer not null default 0,
  primary key (user_id, evenement)
);
alter table public.evt_comptes enable row level security;
revoke all on public.evt_comptes from anon, authenticated;

create or replace function public.crediter_prismes(p uuid, ev text, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ev is null or coalesce(n, 0) <= 0 then return; end if;
  insert into evt_comptes (user_id, evenement, solde, total) values (p, ev, n, n)
  on conflict (user_id, evenement)
    do update set solde = evt_comptes.solde + n, total = evt_comptes.total + n;
end $$;

-- ------------------------------------------------- la piste de recompenses
create table if not exists public.evt_piste (
  evenement text not null,
  palier    integer not null,
  seuil     integer not null,
  -- boosters | eclats | fragments | titre | cadre | reverse_R | brillante
  type      text not null,
  montant   integer not null default 0,
  objet     text,
  titre     text not null,
  primary key (evenement, palier)
);
create table if not exists public.evt_piste_prises (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  palier    integer not null,
  pris_le   timestamptz not null default now(),
  primary key (user_id, evenement, palier)
);
alter table public.evt_piste enable row level security;
alter table public.evt_piste_prises enable row level security;
revoke all on public.evt_piste, public.evt_piste_prises from anon, authenticated;

-- Quinze paliers. Un joueur assidu gagne ~70 Prismes par jour en quetes du
-- jour, et ~460 en quetes de l'evenement : le dernier palier (1 350) demande
-- de jouer presque chaque jour des deux semaines.
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('reflets',  1,   20, 'boosters',   2, null,         '2 boosters'),
  ('reflets',  2,   50, 'fragments', 300, null,        '300 Fragments'),
  ('reflets',  3,   90, 'titre',      0, 't_eclaireur', 'Titre « Éclaireur des Reflets »'),
  ('reflets',  4,  140, 'boosters',   3, null,         '3 boosters'),
  ('reflets',  5,  200, 'eclats',   500, null,         '500 Éclats'),
  ('reflets',  6,  270, 'fragments', 600, null,        '600 Fragments'),
  ('reflets',  7,  350, 'reverse_R',  1, null,         'Une Reverse Rare'),
  ('reflets',  8,  440, 'boosters',   5, null,         '5 boosters'),
  ('reflets',  9,  540, 'cadre',      0, 'f_miroir',   'Cadre « Miroir »'),
  ('reflets', 10,  650, 'eclats',  1000, null,         '1 000 Éclats'),
  ('reflets', 11,  770, 'fragments', 1000, null,       '1 000 Fragments'),
  ('reflets', 12,  900, 'reverse_R',  2, null,         'Deux Reverses Rares'),
  ('reflets', 13, 1040, 'boosters',   8, null,         '8 boosters'),
  ('reflets', 14, 1190, 'brillante',  1, null,         'Une Essence Brillante'),
  ('reflets', 15, 1350, 'titre',      0, 't_ame',      'Titre « Âme des Reflets »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ----------------------------------------------------------- accorder
-- Ce qu'une recompense donne, quelle qu'en soit la source (piste, boutique
-- d'evenement). Renvoie les cartes accordees, pour que le navigateur les
-- montre.
--   reverse_R : une Reverse Rare qu'on n'a pas (une au hasard si on les a
--               toutes) ; brillante : une Essence Brillante qu'on n'a pas
--               (2 000 Fragments si on les a toutes).
create or replace function public.accorder(p uuid, t text, n int, objet text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cartes text[] := '{}'; cid text; i int;
begin
  if t = 'boosters' then
    update profiles set boosters_bonus = boosters_bonus + n where id = p;
  elsif t = 'eclats' then
    update profiles set shards = shards + n where id = p;
  elsif t = 'fragments' then
    update profiles set fragments = fragments + n where id = p;
  elsif t in ('titre', 'cadre') then
    insert into inventory (user_id, item_id, qty) values (p, objet, 1)
      on conflict (user_id, item_id) do nothing;
  elsif t = 'reverse_R' then
    for i in 1..greatest(n, 1) loop
      select k.id into cid from cards k
       where k.reverse and k.rar = 'R' and k.id <> all (cartes)
         and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
       order by random() limit 1;
      if cid is null then
        select k.id into cid from cards k where k.reverse and k.rar = 'R' order by random() limit 1;
      end if;
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end loop;
  elsif t = 'brillante' then
    select k.id into cid from cards k
     where k.rar = 'BR'
       and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
     order by random() limit 1;
    if cid is null then
      update profiles set fragments = fragments + 2000 where id = p;
    else
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end if;
  else
    raise exception 'Récompense inconnue.';
  end if;
  if array_length(cartes, 1) is not null then
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;
  return to_jsonb(cartes);
end $$;

-- ----------------------------------------------- reclamer un palier
create or replace function public.piste_reclamer(p_palier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); pa evt_piste; tot int; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then raise exception 'Aucun événement en cours.'; end if;
  select * into pa from evt_piste where evenement = ev and palier = p_palier;
  if not found then raise exception 'Palier inconnu.'; end if;
  select total into tot from evt_comptes where user_id = p and evenement = ev for update;
  if coalesce(tot, 0) < pa.seuil then raise exception 'Palier pas encore atteint.'; end if;

  insert into evt_piste_prises (user_id, evenement, palier) values (p, ev, p_palier)
    on conflict do nothing;
  if not found then raise exception 'Récompense déjà récupérée.'; end if;

  cartes := accorder(p, pa.type, pa.montant, pa.objet);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- ----------------------------------------------- l'etat de l'evenement
-- Pour l'onglet de l'evenement : son solde, sa piste, et les dix joueurs qui
-- ont gagne le plus de Prismes.
create or replace function public.evenement_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); cpt evt_comptes;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then return 'null'::jsonb; end if;
  select * into cpt from evt_comptes where user_id = p and evenement = ev;

  return jsonb_build_object(
    'code', ev,
    'solde', coalesce(cpt.solde, 0),
    'total', coalesce(cpt.total, 0),
    'piste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palier', pa.palier, 'seuil', pa.seuil, 'type', pa.type, 'montant', pa.montant,
               'objet', pa.objet, 'titre', pa.titre,
               'pris', exists (select 1 from evt_piste_prises x
                                where x.user_id = p and x.evenement = ev and x.palier = pa.palier))
             order by pa.palier)
        from evt_piste pa where pa.evenement = ev), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = ev and total > 0
               order by total desc limit 10) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb));
end $$;

-- ================================================================ 3. Cartle
-- Une carte a deviner par jour, la meme pour tout le monde : une carte de
-- l'extension, Essences exceptees. Chaque essai dit, pour chaque indice, si
-- c'est juste — et pour la rarete et le numero, si la bonne reponse est plus
-- haut ou plus bas. Sept essais. C'est le serveur qui connait la reponse et
-- qui juge : le navigateur ne la voit qu'une fois la partie finie.
create table if not exists public.cartle (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  text[] not null default '{}',
  trouve  boolean not null default false,
  primary key (user_id, jour)
);
alter table public.cartle enable row level security;
revoke all on public.cartle from anon, authenticated;

create or replace function public.cartle_jour() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date; $$;

-- La carte du jour : un tirage fixe par la date (md5), le meme pour tous.
create or replace function public.cartle_cible(j date) returns text
language sql stable security definer set search_path = public as $$
  select id from cards where not promo and cat <> 'essence'
   order by md5(j::text || ':reflets:' || id) limit 1;
$$;

create or replace function public.cartle_rang(r text) returns int
language sql immutable as $$
  select case r when 'C' then 1 when 'PC' then 2 when 'R' then 3 when 'E' then 4 when 'L' then 5 else 0 end;
$$;

-- `+` : la bonne reponse est plus haut ; `-` : plus bas.
create or replace function public.cartle_retour(cid text, cible text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'carte', a.id,
    'cat', case when a.cat = b.cat then '=' else 'x' end,
    'col', case when a.col = b.col then '=' else 'x' end,
    'rar', case when a.rar = b.rar then '='
                when cartle_rang(b.rar) > cartle_rang(a.rar) then '+' else '-' end,
    'num', case when a.num = b.num then '=' when b.num > a.num then '+' else '-' end)
    from cards a, cards b where a.id = cid and b.id = cible;
$$;

create or replace function public.cartle_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := cartle_jour(); c cartle; cible text := cartle_cible(cartle_jour()); fini boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into c from cartle where user_id = p and jour = j;
  fini := coalesce(c.trouve, false) or coalesce(array_length(c.essais, 1), 0) >= 7;
  return jsonb_build_object(
    'jour', j, 'max', 7,
    'essais', coalesce((select jsonb_agg(cartle_retour(e, cible) order by o)
                          from unnest(c.essais) with ordinality u(e, o)), '[]'::jsonb),
    'trouve', coalesce(c.trouve, false),
    'fini', fini,
    'cible', case when fini then cible end);
end $$;

-- Trouver rapporte 30 Eclats, et fait avancer les quetes « cartle » (celles
-- de l'evenement en tete).
create or replace function public.cartle_essai(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := cartle_jour(); c cartle; cible text := cartle_cible(cartle_jour());
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if not exists (select 1 from cards where id = p_carte and not promo and cat <> 'essence') then
    raise exception 'Cette carte ne fait pas partie du Cartle.';
  end if;

  insert into cartle (user_id, jour) values (p, j) on conflict do nothing;
  select * into c from cartle where user_id = p and jour = j for update;
  if c.trouve or coalesce(array_length(c.essais, 1), 0) >= 7 then
    raise exception 'La partie du jour est finie : rendez-vous demain.';
  end if;
  if p_carte = any (c.essais) then raise exception 'Tu as déjà proposé cette carte.'; end if;

  update cartle set essais = essais || p_carte, trouve = (p_carte = cible)
   where user_id = p and jour = j;
  if p_carte = cible then
    update profiles set shards = shards + 30 where id = p;
    perform bump_quests(p, 'cartle', 1);
  end if;
  return jsonb_build_object('cartle', cartle_etat(), 'etat', me());
end $$;

-- =========================================================== 4. invitations
-- Achetees en boutique (2 000 Fragments, trois par joueur, shop_buy dans
-- 03_rpc.sql). Un code sert une fois : la personne invitee se connecte avec
-- Discord, le saisit sur l'ecran d'attente, et entre sur la liste des
-- invites. Elle trouve un cadeau de bienvenue de la part de son parrain.
create table if not exists public.invitations (
  code        text primary key,
  auteur      uuid not null references public.profiles on delete cascade,
  cree_le     timestamptz not null default now(),
  utilise_par uuid references public.profiles on delete set null,
  utilise_le  timestamptz
);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;

create or replace function public.creer_invitation(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := 'M8-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from invitations where code = c);
  end loop;
  insert into invitations (code, auteur) values (c, p);
  return c;
end $$;

-- La seule fonction du jeu qu'un compte pas encore invite peut appeler, avec
-- me() : c'est elle qui le fait entrer.
create or replace function public.utiliser_invitation(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); inv invitations; u auth.users; parrain text;
begin
  if p is null then raise exception 'non connecte'; end if;
  if beta_ouverte() or est_invite(p) then raise exception 'Tu as déjà accès au jeu.'; end if;

  select * into inv from invitations
   where upper(code) = upper(trim(coalesce(p_code, ''))) and utilise_par is null for update;
  if not found then raise exception 'Code inconnu ou déjà utilisé.'; end if;
  if inv.auteur = p then raise exception 'Ce code est le tien : donne-le à un ami.'; end if;

  select * into u from auth.users where id = p;
  select pseudo into parrain from profiles where id = inv.auteur;
  insert into beta_invites (cle, note)
  values (coalesce(nullif(u.raw_user_meta_data->>'provider_id', ''), lower(u.email)),
          'Invité par ' || coalesce(parrain, '?') || ' (' || inv.code || ')')
  on conflict (cle) do nothing;

  update invitations set utilise_par = p, utilise_le = now() where code = inv.code;
  perform bump_quests(inv.auteur, 'invite', 1);
  insert into cadeaux (user_id, boosters, eclats, message, auteur)
  values (p, 5, 500, 'Bienvenue ! ' || coalesce(parrain, 'Un joueur') || ' t''a invité : voici de quoi bien commencer.', inv.auteur);
  return me();
end $$;

-- ===================================================== 5. titres et profil
-- Les titres qu'un joueur a debloques. La plupart viennent de ses succes
-- (15_evenements.sql), calcules a la volee comme eux ; les autres sont des
-- objets gagnes (inventaire, `t_…`) : piste d'evenement, boutique, quetes.
-- Les noms vivent dans TITRES (js/config.js).
create or replace function public.titres_de(p uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := succes_de(p); t text[] := '{}';
begin
  if s ? 'pionnier'          then t := array_append(t, 't_pionnier'); end if;
  if s ? 'unique'            then t := array_append(t, 't_elu'); end if;
  if s ? 'master_set'        then t := array_append(t, 't_maitre'); end if;
  if s ? 'negociant'         then t := array_append(t, 't_negociant'); end if;
  if s ? 'godpack'           then t := array_append(t, 't_chanceux'); end if;
  if s ? 'boosters_100'      then t := array_append(t, 't_centurion'); end if;
  if s ? 'serie_30'          then t := array_append(t, 't_fidele'); end if;
  if s ? 'artisan'           then t := array_append(t, 't_artisan'); end if;
  if s ? 'toutes_brillantes' then t := array_append(t, 't_prisme'); end if;
  if s ? 'reverses_toutes'   then t := array_append(t, 't_reflet'); end if;
  if exists (select 1 from profiles where id = p and is_admin) then t := array_append(t, 't_admin'); end if;
  select t || coalesce(array_agg(item_id order by item_id), '{}') into t
    from inventory where user_id = p and qty > 0 and item_id like 't\_%';
  return t;
end $$;

-- Changer son titre, sa banniere ou sa devise. Un parametre vide ('') retire,
-- un parametre absent (null) ne touche a rien.
create or replace function public.personnaliser(p_titre text, p_banniere text, p_devise text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_titre is not null then
    if p_titre <> '' and not (p_titre = any (titres_de(p))) then
      raise exception 'Ce titre n''est pas encore débloqué.';
    end if;
    update profiles set titre = nullif(p_titre, '') where id = p;
    if p_titre <> '' then perform bump_quests(p, 'titre', 1); end if;
  end if;

  if p_banniere is not null then
    if p_banniere <> '' and not exists (select 1 from collection
                                         where user_id = p and card_id = p_banniere and qty > 0) then
      raise exception 'Tu ne possèdes pas cette carte.';
    end if;
    update profiles set banniere = nullif(p_banniere, '') where id = p;
    if p_banniere <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  if p_devise is not null then
    d := left(regexp_replace(trim(p_devise), '\s+', ' ', 'g'), 80);
    update profiles set devise = nullif(d, '') where id = p;
    if d <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  return me();
end $$;

-- ================================================ l'evenement « Reflets »
-- Deux semaines a partir de la mise a jour, sans rien changer au rythme des
-- boosters. Le redater, dans le SQL Editor :
--   update public.evenements set debut = …, fin = … where code = 'reflets';
insert into public.evenements (titre, texte, debut, fin, ticket_minutes, code)
select 'Reflets', 'La version 2.0 : les Reverses, des cadres, des titres, le Cartle. Gagne des Prismes et remonte la piste.',
       now(), now() + interval '14 days', null, 'reflets'
 where not exists (select 1 from public.evenements where code = 'reflets');

-- ================================================================= droits
revoke all on function public.evenement_en_cours, public.crediter_prismes, public.accorder,
  public.cartle_cible, public.cartle_retour, public.creer_invitation, public.titres_de
  from public, anon, authenticated;
revoke all on function public.piste_reclamer, public.evenement_etat, public.cartle_etat,
  public.cartle_essai, public.utiliser_invitation, public.personnaliser from public, anon;
grant execute on function public.piste_reclamer, public.evenement_etat, public.cartle_etat,
  public.cartle_essai, public.utiliser_invitation, public.personnaliser to authenticated;
