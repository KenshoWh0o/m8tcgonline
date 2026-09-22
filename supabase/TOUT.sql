-- =====================================================================
--
--   MATE TCG ONLINE — INSTALLATION COMPLETE
--
--   Tout colle, tout d'un bloc, dans Supabase > SQL Editor > New query,
--   puis « Run ». Il n'y a rien a modifier la-dedans.
--
--   Ce fichier est assemble automatiquement a partir des quatre fichiers
--   du dossier supabase/. Ne pas l'editer a la main : editer les fichiers
--   d'origine, puis relancer `python3 tools/build-sql.py`.
--
--   Rejouable sans danger : chaque ligne est mise a jour si elle existe.
--
--   Assemble le 2026-09-22
--
-- =====================================================================



-- #####################################################################
-- ###  01_schema.sql
-- ###  Les tables, les regles de securite, la recharge des boosters
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — schema, securite et logique serveur
--  A executer une seule fois dans Supabase › SQL Editor (voir SETUP.md).
--  Tout ce qui peut etre triche depuis le navigateur (boosters, cooldown,
--  echanges, quetes, achats) est calcule ici, jamais cote client.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profils
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  pseudo        text not null,
  avatar        text not null default 'star',      -- 'star' | 'card:c042' | 'preset:xxx'
  frame         text not null default 'default',
  is_admin      boolean not null default false,
  shards        integer not null default 0  check (shards >= 0),
  tickets       integer not null default 5  check (tickets >= 0),
  last_tick     timestamptz not null default now(),
  trade_free_at timestamptz not null default now(),
  packs_opened  integer not null default 0,
  trades_done   integer not null default 0,
  streak        integer not null default 0,
  last_checkin  date,
  created_at    timestamptz not null default now(),
  constraint pseudo_shape check (pseudo ~ '^[A-Za-z0-9_.\-]{3,16}$')
);

create unique index if not exists profiles_pseudo_key on public.profiles (lower(pseudo));

-- ------------------------------------------------------------- catalogue
-- Rempli par 02_cards.sql. Le serveur en a besoin pour tirer les boosters.
create table if not exists public.cards (
  id         text primary key,
  num        integer not null,
  nom        text not null,
  cat        text not null,
  col        text not null,
  rar        text not null,
  in_booster boolean not null default true,
  -- Une carte Promo est dans le catalogue pour pouvoir entrer dans une
  -- collection, mais elle n'appartient pas a l'extension : ni dans un booster,
  -- ni dans le pourcentage de completion, ni dans un echange.
  promo      boolean not null default false
);
alter table public.cards add column if not exists promo boolean not null default false;
create index if not exists cards_rar_idx on public.cards (rar) where in_booster;

-- ------------------------------------------------------------ collection
create table if not exists public.collection (
  user_id  uuid not null references public.profiles on delete cascade,
  card_id  text not null references public.cards on delete cascade,
  qty      integer not null default 0 check (qty >= 0),
  first_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- --------------------------------------------------------------- quetes
create table if not exists public.quests (
  id       text primary key,
  scope    text not null check (scope in ('daily','weekly','milestone')),
  metric   text not null,   -- packs | new_cards | rarity_R | rarity_E | rarity_L | trades | checkin | collection_pct
  goal     integer not null,
  reward   integer not null,
  titre    text not null,
  detail   text not null default '',
  ordre    integer not null default 0
);

create table if not exists public.quest_progress (
  user_id    uuid not null references public.profiles on delete cascade,
  quest_id   text not null references public.quests on delete cascade,
  period_key text not null,              -- '2026-09-21', '2026-W38' ou 'all'
  progress   integer not null default 0,
  claimed    boolean not null default false,
  primary key (user_id, quest_id, period_key)
);

-- ------------------------------------------------------------- boutique
create table if not exists public.shop_items (
  id       text primary key,
  categ    text not null check (categ in ('boosters','echange','cosmetique','promo')),
  titre    text not null,
  detail   text not null default '',
  prix     integer not null check (prix >= 0),
  effet    text not null,                -- tickets | trade_token | cosmetique | refill | carte
  montant  integer not null default 1,
  -- Pour effet = 'carte' : l'identifiant de la carte accordee (ex. 'p01').
  carte_id text references public.cards,
  unique_buy boolean not null default false,
  ordre    integer not null default 0,
  actif    boolean not null default true
);

alter table public.shop_items add column if not exists carte_id text references public.cards;
do $$ begin
  alter table public.shop_items drop constraint if exists shop_items_categ_check;
  alter table public.shop_items add constraint shop_items_categ_check
    check (categ in ('boosters','echange','cosmetique','promo'));
end $$;

create table if not exists public.inventory (
  user_id uuid not null references public.profiles on delete cascade,
  item_id text not null,
  qty     integer not null default 1 check (qty >= 0),
  primary key (user_id, item_id)
);

-- -------------------------------------------------------------- echanges
do $$ begin
  create type public.trade_status as enum ('pending','accepted','declined','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles on delete cascade,
  to_user     uuid not null references public.profiles on delete cascade,
  offer_card  text not null references public.cards,
  want_card   text not null references public.cards,
  note        text default '',
  status      public.trade_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  -- Comment la demande a ete payee. Sans cette memoire, impossible de
  -- rembourser : au moment ou l'autre refuse, on ne sait plus si le demandeur
  -- avait depense un jeton ou consomme sa demande gratuite.
  jeton       boolean not null default false,
  constraint no_self_trade check (from_user <> to_user)
);
alter table public.trades add column if not exists jeton boolean not null default false;
create index if not exists trades_to_idx   on public.trades (to_user,   status);
create index if not exists trades_from_idx on public.trades (from_user, status);

-- =====================================================================
--  Reglages d'economie : une seule source de verite, cote serveur.
-- =====================================================================
create or replace function public.cfg(k text) returns integer
language sql immutable as $$
  select case k
    when 'ticket_cap'        then 5          -- boosters en reserve au maximum
    when 'ticket_minutes'    then 240        -- un booster toutes les 4 h, soit 6 par jour
    when 'pack_size'         then 6
    when 'god_odds'          then 2000       -- 1 chance sur 2000
    when 'trade_cooldown_h'  then 6          -- un echange gratuit toutes les 6 h
    when 'shards_per_dup'    then 0
    -- Le palier de collection qui accorde la carte Promo « palier ».
    -- Doit rester egal a PROMO_PALIER dans js/config.js, qui ne sert qu'a
    -- l'affichage : c'est check_promos() qui accorde vraiment la carte.
    when 'promo_palier_pct'  then 75
    -- Beta fermee : seules les personnes inscrites dans `beta_invites`
    -- peuvent creer un compte. Passer a 0 le jour de l'ouverture au public,
    -- puis rejouer ce fichier.
    when 'beta_fermee'       then 1
  end;
$$;

-- =====================================================================
--  Securite : chaque joueur ne voit et ne modifie que ce qui le regarde.
--  Les ecritures sensibles passent uniquement par les fonctions plus bas.
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.collection     enable row level security;
alter table public.quest_progress enable row level security;
alter table public.inventory      enable row level security;
alter table public.trades         enable row level security;
alter table public.cards          enable row level security;
alter table public.quests         enable row level security;
alter table public.shop_items     enable row level security;

drop policy if exists p_cards_read on public.cards;
create policy p_cards_read on public.cards for select using (true);
drop policy if exists p_quests_read on public.quests;
create policy p_quests_read on public.quests for select using (true);
drop policy if exists p_shop_read on public.shop_items;
create policy p_shop_read on public.shop_items for select using (actif);

-- Le profil des autres est lisible (pseudo + avatar, pour les echanges),
-- mais modifiable par personne d'autre que son proprietaire — et encore,
-- seulement via set_profile(), qui filtre les champs.
drop policy if exists p_profiles_read on public.profiles;
create policy p_profiles_read on public.profiles for select using (true);

drop policy if exists p_col_read on public.collection;
create policy p_col_read on public.collection for select using (user_id = auth.uid());

drop policy if exists p_qp_read on public.quest_progress;
create policy p_qp_read on public.quest_progress for select using (user_id = auth.uid());

drop policy if exists p_inv_read on public.inventory;
create policy p_inv_read on public.inventory for select using (user_id = auth.uid());

drop policy if exists p_trades_read on public.trades;
create policy p_trades_read on public.trades for select
  using (from_user = auth.uid() or to_user = auth.uid());

-- Aucune policy d'INSERT/UPDATE/DELETE : tout passe par les fonctions
-- security definer ci-dessous, qui verifient les regles du jeu.

-- =====================================================================
--  La liste des invites de la beta
--
--  L'ecran d'attente de js/gate.js n'est PAS une serrure : c'est un rideau.
--  Il vit dans le navigateur, son empreinte est ecrite dans la page, et
--  n'importe qui sachant ouvrir la console passe derriere. C'est dit dans
--  l'en-tete de ce fichier-la depuis le premier jour.
--
--  La serrure, c'est ici. Tant que cfg('beta_fermee') vaut 1, la creation
--  d'un compte est refusee a qui ne figure pas dans cette table. Le rideau
--  continue de filtrer les curieux ; la table, elle, ne se contourne pas
--  depuis le navigateur.
--
--  La cle est au choix une adresse e-mail ou un identifiant Discord : selon
--  le fournisseur, on ne recoit pas toujours les deux.
-- =====================================================================
create table if not exists public.beta_invites (
  cle       text primary key,
  note      text,
  ajoute_le timestamptz not null default now()
);

alter table public.beta_invites enable row level security;
-- Aucune policy, aucun droit : cette table ne se lit pas depuis le navigateur.
-- Seules les fonctions `security definer` la consultent.
revoke all on public.beta_invites from anon, authenticated;

-- Est-ce que ce compte figure sur la liste ? On regarde les deux cles
-- possibles : l'adresse e-mail et l'identifiant Discord.
create or replace function public.est_invite(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
      from auth.users u
      join beta_invites b
        on (nullif(u.email, '') is not null and lower(b.cle) = lower(u.email))
        or (nullif(u.raw_user_meta_data->>'provider_id', '') is not null
            and b.cle = u.raw_user_meta_data->>'provider_id')
     where u.id = p);
$$;

-- Le garde-fou pose a l'entree de chaque action du jeu.
--
-- Verrouiller la seule inscription ne suffisait pas : les comptes crees avant
-- la fermeture continuaient de jouer, et le mode hors ligne du navigateur
-- donnait acces a tout le jeu sans aucun compte. Tant que la beta est fermee,
-- une action n'aboutit que pour une personne invitee — et c'est le serveur qui
-- le dit, pas la page.
create or replace function public.garde_beta() returns void
language plpgsql security definer set search_path = public as $$
begin
  if cfg('beta_fermee') = 1 and not est_invite(auth.uid()) then
    raise exception 'BETA_FERMEE';
  end if;
end $$;

revoke all on function public.est_invite, public.garde_beta from anon, authenticated;

-- =====================================================================
--  Creation du profil a l'inscription
-- =====================================================================
create or replace function public.slugify_pseudo(src text) returns text
language plpgsql immutable as $$
declare s text;
begin
  s := regexp_replace(coalesce(src, ''), '[^A-Za-z0-9_.\-]', '', 'g');
  if length(s) < 3 then s := 'Mate' || lpad((floor(random()*9999))::text, 4, '0'); end if;
  return left(s, 16);
end $$;

-- Le declencheur tourne DANS la transaction qui cree le compte : lever une
-- exception ici annule l'inscription entiere, et aucune ligne ne subsiste dans
-- auth.users. C'est ce qu'on veut — un refus, pas un compte a moitie cree.
--
-- Les comptes existants ne sont pas concernes : ce declencheur ne se lance
-- qu'a l'insertion.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; try text; n int := 0; cle_discord text;
begin
  if cfg('beta_fermee') = 1 then
    cle_discord := coalesce(new.raw_user_meta_data->>'provider_id',
                            new.raw_user_meta_data->>'sub', '');
    if not exists (
      select 1 from beta_invites b
       where (nullif(new.email, '') is not null and lower(b.cle) = lower(new.email))
          or (nullif(cle_discord, '') is not null and b.cle = cle_discord)
    ) then
      raise exception 'BETA_FERMEE'
        using hint = 'Le jeu est en beta fermee : ce compte n''est pas sur la liste.';
    end if;
  end if;

  base := slugify_pseudo(coalesce(
    new.raw_user_meta_data->>'pseudo',
    new.raw_user_meta_data->>'global_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)));
  try := base;
  while exists (select 1 from profiles where lower(pseudo) = lower(try)) loop
    n := n + 1;
    try := left(base, 12) || n::text;
  end loop;
  insert into profiles (id, pseudo, avatar)
  values (new.id, try, coalesce(new.raw_user_meta_data->>'avatar_url', 'star'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  Reserve de boosters : la recharge est calculee a partir de l'horloge
--  du serveur. Avancer la montre du telephone ne change rien.
-- =====================================================================
create or replace function public.regen_tickets(p uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare pr profiles; gained int; step interval;
begin
  select * into pr from profiles where id = p for update;
  if not found then raise exception 'profil introuvable'; end if;

  step := make_interval(mins => cfg('ticket_minutes'));
  if pr.tickets >= cfg('ticket_cap') then
    if pr.last_tick < now() then
      update profiles set last_tick = now() where id = p returning * into pr;
    end if;
    return pr;
  end if;

  gained := floor(extract(epoch from (now() - pr.last_tick)) / extract(epoch from step));
  if gained > 0 then
    update profiles set
      tickets   = least(cfg('ticket_cap'), tickets + gained),
      last_tick = case when least(cfg('ticket_cap'), tickets + gained) >= cfg('ticket_cap')
                       then now() else last_tick + (gained * step) end
    where id = p returning * into pr;
  end if;
  return pr;
end $$;

-- =====================================================================
--  Quetes : la progression n'est jamais envoyee par le client, elle est
--  incrementee ici, au moment ou l'evenement se produit vraiment.
-- =====================================================================
-- =====================================================================
--  La photo Discord d'un joueur
--
--  Quand quelqu'un choisit « Discord » comme avatar, on ne copie pas sa photo
--  chez nous : on enregistre le mot « discord », et le navigateur va chercher
--  l'adresse dans la session ouverte. C'est ce qui fait qu'une photo changee
--  sur Discord se met a jour toute seule.
--
--  Mais un navigateur n'a qu'une session : la sienne. En affichant la liste
--  d'amis, il resolvait donc « discord » avec la photo de CELUI QUI REGARDE —
--  et tout le monde portait le visage du spectateur.
--
--  Cette fonction va chercher la vraie adresse, cote serveur, pour le joueur
--  qu'on affiche. Elle ne rend que ca : pas l'adresse e-mail, pas les jetons,
--  rien d'autre de auth.users. Et elle n'est appelee que depuis les fonctions
--  qui renvoient deja le pseudo et l'avatar de ce joueur — on n'expose donc
--  rien de plus que ce que le jeu montrait deja.
-- =====================================================================
create or replace function public.photo_discord(p uuid) returns text
language sql security definer stable set search_path = public as $$
  select coalesce(
    nullif(u.raw_user_meta_data->>'avatar_url', ''),
    nullif(u.raw_user_meta_data->>'picture', ''))
  from auth.users u
  where u.id = p
    and coalesce(u.raw_user_meta_data->>'avatar_url',
                 u.raw_user_meta_data->>'picture') like 'http%';
$$;

-- Rouage interne : appele par friend_list, player_profile, trade_list et
-- find_player, jamais par le navigateur. Le laisser ouvert permettrait de
-- parcourir les photos par identifiant.
revoke all on function public.photo_discord from anon, authenticated;

create or replace function public.period_key(sc text) returns text
language sql stable as $$
  select case sc
    when 'daily'  then to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD')
    when 'weekly' then to_char(now() at time zone 'Europe/Paris', 'IYYY"-W"IW')
    else 'all' end;
$$;

create or replace function public.bump_quests(p uuid, m text, amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount <= 0 then return; end if;
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), amount from quests q where q.metric = m
  on conflict (user_id, quest_id, period_key)
    do update set progress = quest_progress.progress + amount
    where not quest_progress.claimed;
end $$;

-- La progression « collection » est un etat, pas un compteur : on la recalcule.
create or replace function public.sync_collection_quests(p uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pct int;
begin
  -- `where not k.promo` : les cartes Promo sont hors extension. Les compter
  -- ferait bouger le total de 122, et le palier des 100 % deviendrait
  -- inatteignable tant qu'on n'a pas achete les promos de la boutique.
  select case when count(*) = 0 then 0
         else floor(count(*) filter (where c.qty > 0) * 100.0 / count(*)) end
    into pct
    from cards k left join collection c on c.card_id = k.id and c.user_id = p
   where not k.promo;

  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all', pct from quests q where q.metric = 'collection_pct'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress);
end $$;

-- =====================================================================
--  Droits de lecture
--  Supabase accorde normalement ces droits toute seule aux nouvelles tables,
--  mais on ne s'en remet pas a un reglage par defaut : sans ces lignes, la
--  boutique reviendrait vide sans le moindre message d'erreur.
--  Aucune ecriture n'est accordee nulle part : elle passe par les fonctions
--  de 03_rpc.sql, qui verifient les regles du jeu avant d'agir.
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select on public.cards, public.quests, public.shop_items to anon, authenticated;

-- Le navigateur ne lit PAS ces cinq tables : il passe par me(), friend_list(),
-- player_profile() et trade_list(), qui sont `security definer` et n'ont donc
-- besoin d'aucun droit cote joueur. Le droit de lecture qui trainait ici
-- laissait enumerer les Eclats, la serie de jours et le drapeau administrateur
-- de tout le monde — une fuite sans utilite. Les policies RLS restent en place :
-- elles sont la seconde serrure, pas la premiere.
revoke select on public.profiles, public.collection, public.quest_progress,
                 public.inventory, public.trades from anon, authenticated;

revoke insert, update, delete on public.profiles, public.collection, public.cards,
  public.quests, public.quest_progress, public.shop_items, public.inventory,
  public.trades from anon, authenticated;


-- #####################################################################
-- ###  02_cards.sql
-- ###  Le catalogue des cartes (le serveur en a besoin pour tirer)
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — catalogue des cartes (genere, ne pas editer a la main)
--  Source : js/cards-data.js  ·  Regenerer : python3 supabase/gen-cards-sql.py
--  A rejouer dans Supabase apres chaque ajout ou retrait de carte.
-- =====================================================================

-- La colonne qui distingue les Promos du reste. Elle est aussi creee par
-- 01_schema.sql ; on la redemande ici pour que ce fichier reste jouable seul,
-- ce qui est son usage courant : on le rejoue a chaque ajout de carte.
alter table public.cards add column if not exists promo boolean not null default false;

insert into public.cards (id, num, nom, cat, col, rar, in_booster) values
  ('c001', 1, 'Essence Rose', 'essence', 'rose', 'ES', true),
  ('c002', 2, 'Essence Orange', 'essence', 'orange', 'ES', true),
  ('c003', 3, 'Essence Jade', 'essence', 'jade', 'ES', true),
  ('c004', 4, 'Essence Violette', 'essence', 'violette', 'ES', true),
  ('c005', 5, 'Essence Jaune', 'essence', 'jaune', 'ES', true),
  ('c006', 6, 'Essence Mauve', 'essence', 'mauve', 'ES', true),
  ('c007', 7, 'Essence Verte', 'essence', 'verte', 'ES', true),
  ('c008', 8, 'Essence Bleue', 'essence', 'bleue', 'ES', true),
  ('c009', 9, 'Essence Azur', 'essence', 'azur', 'ES', true),
  ('c010', 10, 'Broken Brawks', 'joueur', 'rose', 'C', true),
  ('c011', 11, 'Vandale', 'joueur', 'rose', 'C', true),
  ('c012', 12, 'Squeezie le Toxique', 'joueur', 'rose', 'PC', true),
  ('c013', 13, 'Pas Compris', 'joueur', 'rose', 'PC', true),
  ('c014', 14, 'Zacking Buff', 'coach', 'rose', 'PC', true),
  ('c015', 15, 'Ravitaillement', 'objet', 'rose', 'C', true),
  ('c016', 16, 'Mur Salvateur', 'moment', 'rose', 'PC', true),
  ('c017', 17, 'Tout Commence Ici', 'joueur', 'rose', 'R', true),
  ('c018', 18, 'Buy Bundle M8 !!', 'coach', 'rose', 'R', true),
  ('c019', 19, 'OCE/PCE', 'moment', 'rose', 'R', true),
  ('c020', 20, 'Dégustation d''adversaires', 'moment', 'rose', 'R', true),
  ('c021', 21, 'Trauma Dump III', 'moment', 'rose', 'R', true),
  ('c022', 22, 'Namifique', 'joueur', 'rose', 'E', true),
  ('c023', 23, 'Marteen Supreme', 'joueur', 'rose', 'E', true),
  ('c024', 24, 'Agent M.E.L', 'joueur', 'rose', 'E', true),
  ('c025', 25, 'Gentle Mates Minny', 'joueur', 'rose', 'E', true),
  ('c026', 26, 'Pause Technique', 'coach', 'rose', 'E', true),
  ('c027', 27, 'Remontada', 'moment', 'rose', 'E', true),
  ('c028', 28, 'Championnes d''Europe', 'moment', 'rose', 'E', true),
  ('c029', 29, 'Pollo', 'joueur', 'orange', 'C', true),
  ('c030', 30, 'Worlds Lyon', 'coach', 'orange', 'PC', true),
  ('c031', 31, 'Moi je suis coach', 'coach', 'orange', 'C', true),
  ('c032', 32, 'Invitation', 'objet', 'orange', 'PC', true),
  ('c033', 33, 'Visa Refusé', 'moment', 'orange', 'C', true),
  ('c034', 34, 'Vanyabubu', 'joueur', 'orange', 'R', true),
  ('c035', 35, 'Pitchounes', 'joueur', 'orange', 'R', true),
  ('c036', 36, 'Maillot Champions ''25', 'objet', 'orange', 'R', true),
  ('c037', 37, 'L''Œil de Nikof', 'moment', 'orange', 'R', true),
  ('c038', 38, 'Caprice de Gotaga', 'moment', 'jade', 'C', true),
  ('c039', 39, 'Zéro Soucis', 'joueur', 'violette', 'C', true),
  ('c040', 40, 'Les Rois du Saloon', 'joueur', 'violette', 'PC', true),
  ('c041', 41, 'Trauma Dump I', 'moment', 'violette', 'C', true),
  ('c042', 42, 'Reverse Squeeze', 'moment', 'violette', 'C', true),
  ('c043', 43, 'BLBLBLBL', 'moment', 'violette', 'C', true),
  ('c044', 44, 'Moroccan Monsters', 'joueur', 'violette', 'R', true),
  ('c045', 45, 'Zzzzz', 'joueur', 'violette', 'R', true),
  ('c046', 46, 'Maillot Champions ''24', 'objet', 'violette', 'R', true),
  ('c047', 47, 'Champions du Major', 'moment', 'violette', 'E', true),
  ('c048', 48, 'Champions du Major', 'moment', 'violette', 'E', true),
  ('c049', 49, 'Le Roi des rois', 'joueur', 'jaune', 'E', true),
  ('c050', 50, 'La Fée Rosalie', 'joueur', 'mauve', 'PC', true),
  ('c051', 51, 'La Planète', 'joueur', 'mauve', 'PC', true),
  ('c052', 52, 'Most Valuable Planet', 'joueur', 'mauve', 'C', true),
  ('c053', 53, 'Ravitaillement', 'objet', 'mauve', 'C', true),
  ('c054', 54, 'Trauma Dump II', 'moment', 'mauve', 'PC', true),
  ('c055', 55, 'Target Missed', 'moment', 'mauve', 'C', true),
  ('c056', 56, 'Le Maillot Maudit', 'objet', 'mauve', 'R', true),
  ('c057', 57, 'Siborg', 'joueur', 'mauve', 'E', true),
  ('c058', 58, 'Ghosty in Finals', 'joueur', 'mauve', 'E', true),
  ('c059', 59, 'Baby Driver', 'joueur', 'mauve', 'E', true),
  ('c060', 60, 'Gotaga Pose', 'joueur', 'mauve', 'E', true),
  ('c061', 61, 'Champions du Major', 'moment', 'mauve', 'E', true),
  ('c062', 62, 'Just Passion', 'joueur', 'verte', 'C', true),
  ('c063', 63, 'Calma', 'joueur', 'verte', 'R', true),
  ('c064', 64, 'Bwarks', 'joueur', 'bleue', 'PC', true),
  ('c065', 65, 'Jus de bagarre', 'objet', 'bleue', 'C', true),
  ('c066', 66, 'L''Immense Draculan', 'moment', 'bleue', 'R', true),
  ('c067', 67, '1% Chance', 'joueur', 'bleue', 'E', true),
  ('c068', 68, '99% Faith', 'joueur', 'bleue', 'E', true),
  ('c069', 69, 'L''Arme Nucléaire', 'joueur', 'azur', 'PC', true),
  ('c070', 70, 'Worlds Japon', 'coach', 'azur', 'PC', true),
  ('c071', 71, 'Versus Fighting', 'joueur', 'azur', 'R', true),
  ('c072', 72, 'Leakof', 'moment', 'neutre', 'C', true),
  ('c073', 73, 'L''Héritier', 'joueur', 'neutre', 'C', true),
  ('c074', 74, 'Grand Respect', 'joueur', 'neutre', 'C', true),
  ('c075', 75, 'Pétrodollars', 'joueur', 'neutre', 'C', true),
  ('c076', 76, 'Ralliement', 'joueur', 'neutre', 'C', true),
  ('c077', 77, 'Brawks Déter', 'joueur', 'neutre', 'PC', true),
  ('c078', 78, 'Le Chevalier Rose', 'joueur', 'neutre', 'PC', true),
  ('c079', 79, 'Instalock', 'joueur', 'neutre', 'PC', true),
  ('c080', 80, 'Meet & Greeter', 'joueur', 'neutre', 'PC', true),
  ('c081', 81, 'Mon Cogneur', 'joueur', 'neutre', 'PC', true),
  ('c082', 82, 'Barakataga', 'coach', 'neutre', 'C', true),
  ('c083', 83, 'Mercato', 'coach', 'neutre', 'C', true),
  ('c084', 84, 'La Chevalière', 'objet', 'neutre', 'PC', true),
  ('c085', 85, 'Cooked', 'objet', 'neutre', 'C', true),
  ('c086', 86, 'En slip sur la Faille', 'objet', 'neutre', 'C', true),
  ('c087', 87, 'Gros Bonnet', 'objet', 'neutre', 'C', true),
  ('c088', 88, 'M4', 'objet', 'neutre', 'C', true),
  ('c089', 89, 'La Luxueuse I', 'objet', 'neutre', 'PC', true),
  ('c090', 90, 'La Luxueuse II', 'objet', 'neutre', 'PC', true),
  ('c091', 91, 'C''est officiel !', 'moment', 'neutre', 'C', true),
  ('c092', 92, 'Clim', 'moment', 'neutre', 'C', true),
  ('c093', 93, 'Alerte Leak', 'moment', 'neutre', 'C', true),
  ('c094', 94, 'One More', 'moment', 'neutre', 'C', true),
  ('c095', 95, 'Tunnel', 'moment', 'neutre', 'C', true),
  ('c096', 96, 'Tweet la Défaite', 'moment', 'neutre', 'C', true),
  ('c097', 97, 'Doig''Dance', 'moment', 'neutre', 'PC', true),
  ('c098', 98, 'Méta Cœurs', 'moment', 'neutre', 'PC', true),
  ('c099', 99, 'Méta F*ck', 'moment', 'neutre', 'PC', true),
  ('c100', 100, 'Loup du Game', 'joueur', 'neutre', 'R', true),
  ('c101', 101, 'Slay', 'joueur', 'neutre', 'R', true),
  ('c102', 102, 'Monster', 'joueur', 'neutre', 'R', true),
  ('c103', 103, 'Joueur de l''Ombre', 'coach', 'neutre', 'R', true),
  ('c104', 104, 'Lofi Girl', 'coach', 'neutre', 'R', true),
  ('c105', 105, 'M16', 'objet', 'neutre', 'R', true),
  ('c106', 106, 'Trahison++', 'objet', 'neutre', 'R', true),
  ('c107', 107, 'GP Explorer III', 'moment', 'neutre', 'R', true),
  ('c108', 108, 'Keynote', 'moment', 'neutre', 'R', true),
  ('c109', 109, 'Hatewatch', 'moment', 'neutre', 'R', true),
  ('c110', 110, 'Leakof', 'moment', 'neutre', 'R', true),
  ('c111', 111, 'La Gaming House', 'moment', 'neutre', 'R', true),
  ('c112', 112, 'M8 Résilience', 'joueur', 'neutre', 'E', true),
  ('c113', 113, 'Kampaï', 'joueur', 'rose', 'L', true),
  ('c114', 114, 'SBG', 'moment', 'rose', 'L', true),
  ('c115', 115, 'Champions du Monde', 'moment', 'orange', 'L', true),
  ('c116', 116, 'The French Sorcerer', 'joueur', 'mauve', 'L', true),
  ('c117', 117, 'La Relève', 'joueur', 'mauve', 'L', true),
  ('c118', 118, 'Gotaga Dance', 'joueur', 'mauve', 'L', true),
  ('c119', 119, 'Gotaga Circus', 'joueur', 'neutre', 'L', true),
  ('c120', 120, 'Brawks Saga', 'joueur', 'neutre', 'L', true),
  ('c121', 121, 'Le Marionnettiste', 'joueur', 'neutre', 'L', true),
  ('c122', 122, 'La Luxueuse III', 'objet', 'neutre', 'L', true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat,
  col = excluded.col, rar = excluded.rar, in_booster = excluded.in_booster;

-- ---------------------------------------------------------------- menage
-- Une carte retiree de js/cards-data.js disparait aussi du tirage serveur.
--
-- Ce bloc est plus long qu'un simple `delete` pour deux raisons, apprises
-- chacune a ses depens :
--
-- 1. `and not promo`. Ce fichier ne connait que l'extension. Les cartes Promo
--    sont creees plus loin, par 03b_promos.sql, et n'apparaissent donc jamais
--    dans la liste ci-dessus. Sans ce garde-fou, rejouer l'installation les
--    effacait — et la boutique, qui en vend deux, refusait l'operation :
--        violates foreign key constraint "shop_items_carte_id_fkey"
--    La premiere execution passait (les Promos n'existaient pas encore), la
--    seconde echouait. C'est le genre de piege qui ne se voit qu'au deuxieme
--    passage.
--
-- 2. Les echanges en attente. `trades` pointe vers `cards` sans cascade : une
--    carte retiree alors qu'un echange la propose bloquerait toute
--    l'installation sur un message illisible. On annule donc ces demandes
--    d'abord — elles ne peuvent de toute facon plus etre honorees — et on le
--    dit dans les logs.
--
-- Ce qui reste volontairement bloquant : une carte encore vendue en boutique.
-- La, c'est une erreur de configuration, et l'effacer en silence ferait bien
-- plus de degats que de s'arreter.
do $$
declare
  a_retirer text[];
  vendues   text[];
  n_ech     int;
begin
  select array_agg(id) into a_retirer
    from public.cards
   where not promo and id <> all (array['c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007', 'c008', 'c009', 'c010', 'c011', 'c012', 'c013', 'c014', 'c015', 'c016', 'c017', 'c018', 'c019', 'c020', 'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030', 'c031', 'c032', 'c033', 'c034', 'c035', 'c036', 'c037', 'c038', 'c039', 'c040', 'c041', 'c042', 'c043', 'c044', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050', 'c051', 'c052', 'c053', 'c054', 'c055', 'c056', 'c057', 'c058', 'c059', 'c060', 'c061', 'c062', 'c063', 'c064', 'c065', 'c066', 'c067', 'c068', 'c069', 'c070', 'c071', 'c072', 'c073', 'c074', 'c075', 'c076', 'c077', 'c078', 'c079', 'c080', 'c081', 'c082', 'c083', 'c084', 'c085', 'c086', 'c087', 'c088', 'c089', 'c090', 'c091', 'c092', 'c093', 'c094', 'c095', 'c096', 'c097', 'c098', 'c099', 'c100', 'c101', 'c102', 'c103', 'c104', 'c105', 'c106', 'c107', 'c108', 'c109', 'c110', 'c111', 'c112', 'c113', 'c114', 'c115', 'c116', 'c117', 'c118', 'c119', 'c120', 'c121', 'c122']);

  if a_retirer is null then
    raise notice 'Catalogue a jour : aucune carte a retirer.';
    return;
  end if;

  select array_agg(carte_id) into vendues
    from public.shop_items where carte_id = any (a_retirer);
  if vendues is not null then
    raise exception
      'Menage impossible : la boutique vend encore %. Retire l''article '
      'correspondant de 04_seed.sql, ou remets la carte dans js/cards-data.js.',
      vendues;
  end if;

  -- Ces annulations-la ne sont PAS remboursees, et c'est deliberate :
  -- rembourser_demande() vit dans 03_rpc.sql, qui est joue apres ce
  -- fichier-ci. L'appeler d'ici ferait dependre l'installation de son propre
  -- ordre. Le cas est de toute facon une operation d'administration — on
  -- retire une carte du jeu —, pas quelque chose qu'un joueur declenche.
  update public.trades set status = 'cancelled', resolved_at = now()
   where status = 'pending'
     and (offer_card = any (a_retirer) or want_card = any (a_retirer));
  get diagnostics n_ech = row_count;
  if n_ech > 0 then
    raise notice '% demande(s) d''echange annulee(s) : la carte proposee n''existe plus.', n_ech;
  end if;

  delete from public.trades where offer_card = any (a_retirer) or want_card = any (a_retirer);
  delete from public.cards  where id = any (a_retirer);
  raise notice '% carte(s) retiree(s) du catalogue serveur.', array_length(a_retirer, 1);
end $$;


-- #####################################################################
-- ###  03_rpc.sql
-- ###  Les actions du jeu : ouvrir, echanger, encaisser, acheter
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — les actions du jeu.
--  Le navigateur ne fait qu'appeler ces fonctions : il ne peut ni
--  s'offrir un booster, ni se donner une carte, ni forcer un echange.
--  A executer apres 01_schema.sql et 02_cards.sql.
-- =====================================================================

-- ------------------------------------------------- etat complet du joueur
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  pr := regen_tickets(p);
  perform sync_collection_quests(p);

  return jsonb_build_object(
    'profil', jsonb_build_object(
      'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
      'is_admin', pr.is_admin, 'shards', pr.shards, 'tickets', pr.tickets,
      'last_tick', pr.last_tick, 'trade_free_at', pr.trade_free_at,
      'packs_opened', pr.packs_opened, 'trades_done', pr.trades_done,
      'streak', pr.streak, 'last_checkin', pr.last_checkin,
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', cfg('ticket_minutes'),
      'serveur', now()),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false)) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------- profil (pseudo…)
create or replace function public.set_profile(p_pseudo text, p_avatar text, p_frame text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_pseudo is not null then
    if p_pseudo !~ '^[A-Za-z0-9_.\-]{3,16}$' then
      raise exception 'Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ -';
    end if;
    if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> p) then
      raise exception 'Ce pseudo est déjà pris.';
    end if;
  end if;

  -- Un avatar « card:cXXX » doit correspondre a une carte reellement possedee.
  if p_avatar is not null and p_avatar like 'card:%' then
    if not exists (select 1 from collection
                   where user_id = p and card_id = substr(p_avatar, 6) and qty > 0) then
      raise exception 'Tu ne possèdes pas cette carte.';
    end if;
  end if;

  -- Un cadre achete doit etre dans l'inventaire.
  if p_frame is not null and p_frame <> 'default'
     and not exists (select 1 from inventory where user_id = p and item_id = p_frame and qty > 0) then
    raise exception 'Cadre non débloqué.';
  end if;

  update profiles set
    pseudo = coalesce(p_pseudo, pseudo),
    avatar = coalesce(p_avatar, avatar),
    frame  = coalesce(p_frame,  frame)
  where id = p;

  return me();
end $$;

-- ------------------------------------------------------- visite du jour
create or replace function public.checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles; today date;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  today := (now() at time zone 'Europe/Paris')::date;
  select * into pr from profiles where id = p for update;

  if pr.last_checkin is distinct from today then
    update profiles set
      streak = case when pr.last_checkin = today - 1 then pr.streak + 1 else 1 end,
      last_checkin = today
    where id = p;
    perform bump_quests(p, 'checkin', 1);
  end if;
  return me();
end $$;

-- =====================================================================
--  Ouverture d'un booster
-- =====================================================================
create or replace function public.pick_card(r text) returns text
language plpgsql volatile as $$
declare out_id text; ord text[]; essai text;
begin
  -- On vise la rarete demandee, puis on se rabat sur la plus proche si elle est vide.
  ord := case r
    when 'C'  then array['C','PC','R','E','L']
    when 'PC' then array['PC','C','R','E','L']
    when 'R'  then array['R','PC','E','C','L']
    when 'E'  then array['E','R','L','PC','C']
    when 'L'  then array['L','E','R','PC','C']
    else array['C','PC','R','E','L'] end;

  foreach essai in array ord loop
    select id into out_id from cards
      where in_booster and not promo and rar = essai and cat <> 'essence'
      order by random() limit 1;
    if out_id is not null then return out_id; end if;
  end loop;
  return null;
end $$;

create or replace function public.open_pack() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles;
  god boolean; ids text[] := '{}'; cid text; x double precision;
  nouvelles int := 0; i int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  pr := regen_tickets(p);
  if pr.tickets < 1 then
    raise exception 'RESERVE_VIDE';
  end if;

  god := random() < 1.0 / cfg('god_odds');

  -- Six cartes, chacune a sa place :
  --   1 · Commune
  --   2 · Commune
  --   3 · Commune (60 %) ou Peu commune (40 %)
  --   4 · Peu commune
  --   5 · Essence
  --   6 · le hit : Rare 80 %, Epique 16 %, Legendaire 4 %
  -- L'ordre compte : c'est celui dans lequel la pile se feuillette, et la
  -- derniere carte porte la mise en scene de la revelation.
  --
  -- Godpack : six cartes qui montent, de la rare a la legendaire garantie.
  --
  -- Ces taux doivent rester identiques a RATES dans js/booster.js, qui sert
  -- aux ouvertures de test du Labo.
  if god then
    x := random() * 100.0; ids := ids || pick_card(case when x < 90.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 70.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 50.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 90.0 then 'E' else 'L' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 60.0 then 'E' else 'L' end);
    ids := ids || pick_card('L');
  else
    ids := ids || pick_card('C');
    ids := ids || pick_card('C');
    x := random() * 100.0; ids := ids || pick_card(case when x < 60.0 then 'C' else 'PC' end);
    ids := ids || pick_card('PC');

    select id into cid from cards
      where in_booster and not promo and cat = 'essence' order by random() limit 1;
    ids := ids || coalesce(cid, pick_card('C'));

    x := random() * 100.0;
    ids := ids || pick_card(case when x < 80.0 then 'R'
                                 when x < 96.0 then 'E'
                                 else 'L' end);
  end if;

  ids := array_remove(ids, null);
  if array_length(ids, 1) is null then raise exception 'BOOSTER_VIDE'; end if;

  -- Les cartes encore jamais obtenues, avant de mettre a jour la collection.
  select count(*) into nouvelles from unnest(ids) u(cid2)
    where not exists (select 1 from collection c
                      where c.user_id = p and c.card_id = u.cid2 and c.qty > 0);

  insert into collection (user_id, card_id, qty)
  select p, u.cid2, count(*) from unnest(ids) u(cid2) group by u.cid2
  on conflict (user_id, card_id) do update set qty = collection.qty + excluded.qty;

  -- Un booster consomme depuis la reserve pleine relance le compte a rebours.
  update profiles set
    tickets      = tickets - 1,
    last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
    packs_opened = packs_opened + 1
  where id = p;

  perform bump_quests(p, 'packs', 1);
  perform bump_quests(p, 'new_cards', nouvelles);
  perform bump_quests(p, 'rarity_R', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('R','E','L')));
  perform bump_quests(p, 'rarity_E', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('E','L')));
  perform bump_quests(p, 'rarity_L', (select count(*)::int from cards
                                      where id = any(ids) and rar = 'L'));
  perform sync_collection_quests(p);
  perform check_promos(p);

  return jsonb_build_object('cards', to_jsonb(ids), 'god', god, 'etat', me());
end $$;

-- =====================================================================
--  Quetes : encaisser une recompense
-- =====================================================================
create or replace function public.claim_quest(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); q quests; pk text; prog int; deja boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into q from quests where id = p_quest;
  if not found then raise exception 'Quête inconnue.'; end if;

  pk := period_key(q.scope);
  select progress, claimed into prog, deja
    from quest_progress where user_id = p and quest_id = q.id and period_key = pk for update;

  if deja then raise exception 'Récompense déjà récupérée.'; end if;
  if coalesce(prog, 0) < q.goal then raise exception 'Quête non terminée.'; end if;

  update quest_progress set claimed = true
    where user_id = p and quest_id = q.id and period_key = pk;

  if q.reward > 0 then
    update profiles set shards = shards + q.reward where id = p;
  end if;

  -- Une quete peut payer en objet plutot qu'en Eclats : un cadre, une carte.
  -- `item_id` sert d'abord a l'affichage — la fiche de quete montre ce qu'on
  -- va toucher — et l'accorde ensuite si ce n'est pas deja fait.
  --
  -- `do nothing` et non `qty + 1` : les deux paliers de Promo sont deja
  -- accordes par check_promos() des que le pourcentage est atteint, avant
  -- meme qu'on encaisse la quete. Sans ce garde-fou, encaisser donnerait un
  -- second exemplaire d'une carte qui n'existe qu'en un seul.
  if q.item_id is not null then
    if exists (select 1 from cards where id = q.item_id) then
      insert into collection (user_id, card_id, qty) values (p, q.item_id, 1)
        on conflict (user_id, card_id) do nothing;
    else
      insert into inventory (user_id, item_id, qty) values (p, q.item_id, 1)
        on conflict (user_id, item_id) do nothing;
    end if;
  end if;

  return me();
end $$;

-- =====================================================================
--  Boutique
-- =====================================================================
create or replace function public.shop_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); it shop_items; pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into it from shop_items where id = p_item and actif;
  if not found then raise exception 'Article indisponible.'; end if;

  select * into pr from profiles where id = p for update;
  if pr.shards < it.prix then raise exception 'Pas assez d''Éclats.'; end if;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possèdes déjà cet article.';
  end if;

  update profiles set shards = shards - it.prix where id = p;

  if it.effet = 'tickets' then
    -- Les boosters achetes s'ajoutent par-dessus le plafond de la reserve.
    update profiles set tickets = tickets + it.montant where id = p;
  elsif it.effet = 'refill' then
    update profiles set tickets = greatest(tickets, cfg('ticket_cap')), last_tick = now() where id = p;
  elsif it.effet = 'trade_token' then
    insert into inventory (user_id, item_id, qty) values (p, 'trade_token', it.montant)
      on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty;
  elsif it.effet = 'carte' then
    -- Une carte achetee entre dans la collection comme n'importe quelle autre.
    -- Elle est marquee `unique_buy` en boutique : on ne l'achete qu'une fois.
    if it.carte_id is null then raise exception 'Article mal configuré.'; end if;
    insert into collection (user_id, card_id, qty) values (p, it.carte_id, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else -- cosmetique
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  return me();
end $$;

-- =====================================================================
--  Echanges : demande, reponse, validation mutuelle.
--  Rarete identique obligatoire ; cout paye par le demandeur.
-- =====================================================================
-- Une demande qui n'aboutit pas ne coute rien.
--
--  Seul un echange CONCLU consomme la demande. Un refus, une annulation, une
--  demande devenue impossible : dans les trois cas rien n'a eu lieu, et le
--  demandeur recupere ce qu'il avait avance — son jeton, ou sa demande
--  gratuite. Le contraire punissait quelqu'un pour une decision qui n'est pas
--  la sienne : on appuyait sur « Proposer », l'autre refusait, et on repartait
--  pour six heures d'attente sans avoir rien obtenu.
--
--  Ca n'ouvre pas la porte a un contournement du delai : un echange qui aboutit
--  n'est jamais rembourse, donc le rythme reel — un echange conclu toutes les
--  six heures — ne bouge pas d'un pouce.
create or replace function public.rembourser_demande(t public.trades)
returns void language plpgsql security definer set search_path = public as $$
begin
  if t.jeton then
    insert into inventory (user_id, item_id, qty) values (t.from_user, 'trade_token', 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else
    -- La demande gratuite redevient disponible tout de suite. `> now()` evite
    -- de repousser une echeance deja passee dans le passe.
    update profiles set trade_free_at = now()
     where id = t.from_user and trade_free_at > now();
  end if;
end $$;

revoke all on function public.rembourser_demande from public, anon, authenticated;

create or replace function public.trade_create(
  p_pseudo text, p_offer text, p_want text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles; dest profiles;
  ro text; rw text; jeton int; gratuit boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into dest from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if dest.id = p then raise exception 'Tu ne peux pas échanger avec toi-même.'; end if;

  select rar into ro from cards where id = p_offer;
  select rar into rw from cards where id = p_want;
  if ro is null or rw is null then raise exception 'Carte inconnue.'; end if;
  if ro <> rw then raise exception 'Les deux cartes doivent être de la même rareté.'; end if;
  if ro = 'ES' then raise exception 'Les Essences ne s''échangent pas.'; end if;
  if ro = 'PR' then raise exception 'Les cartes Promo ne s''échangent pas.'; end if;

  if not exists (select 1 from collection where user_id = p and card_id = p_offer and qty > 0) then
    raise exception 'Tu ne possèdes pas la carte que tu proposes.';
  end if;

  if exists (select 1 from trades where from_user = p and to_user = dest.id
             and offer_card = p_offer and want_card = p_want and status = 'pending') then
    raise exception 'Cette demande est déjà en attente.';
  end if;
  if (select count(*) from trades where from_user = p and status = 'pending') >= 10 then
    raise exception 'Tu as déjà 10 demandes en attente.';
  end if;

  -- Cout : l'echange gratuit si le delai est passe, sinon un jeton d'echange.
  select * into pr from profiles where id = p for update;
  gratuit := pr.trade_free_at <= now();
  if gratuit then
    update profiles set trade_free_at = now() + make_interval(hours => cfg('trade_cooldown_h'))
      where id = p;
  else
    select qty into jeton from inventory where user_id = p and item_id = 'trade_token' for update;
    if coalesce(jeton, 0) < 1 then raise exception 'ECHANGE_EN_RECHARGE'; end if;
    update inventory set qty = qty - 1 where user_id = p and item_id = 'trade_token';
  end if;

  insert into trades (from_user, to_user, offer_card, want_card, note, jeton)
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140), not gratuit);

  return me();
end $$;

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades; a uuid; b uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into t from trades where id = p_trade for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if t.to_user <> p then raise exception 'Cette demande ne t''est pas adressée.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est déjà traitée.'; end if;

  if not p_accept then
    update trades set status = 'declined', resolved_at = now() where id = t.id;
    perform rembourser_demande(t);
    return me();
  end if;

  -- Verrouillage dans un ordre stable, pour que deux echanges croises
  -- ne puissent pas se bloquer mutuellement.
  a := least(t.from_user, t.to_user); b := greatest(t.from_user, t.to_user);
  perform 1 from profiles where id = a for update;
  perform 1 from profiles where id = b for update;

  if not exists (select 1 from collection where user_id = t.from_user and card_id = t.offer_card and qty > 0) then
    -- La demande reste EN ATTENTE, volontairement. Il y avait ici un
    -- `update ... status = 'cancelled'` juste avant le `raise` : il ne servait
    -- a rien. Un `raise exception` annule toute la transaction, donc l'ecriture
    -- qui le precede aussi — la ligne restait « pending » de toute facon, et le
    -- code racontait le contraire de ce qui se passait.
    --
    -- Et c'est tres bien ainsi : le demandeur peut retomber sur cette carte au
    -- prochain booster, et l'echange redevient honorable. Si celui qui recoit
    -- ne veut pas attendre, il a le bouton « Refuser » — qui, lui, rend sa
    -- demande au demandeur.
    raise exception 'Le demandeur ne possède plus cette carte.';
  end if;
  if not exists (select 1 from collection where user_id = p and card_id = t.want_card and qty > 0) then
    raise exception 'Tu ne possèdes pas la carte demandée.';
  end if;

  update collection set qty = qty - 1 where user_id = t.from_user and card_id = t.offer_card;
  update collection set qty = qty - 1 where user_id = p            and card_id = t.want_card;

  insert into collection (user_id, card_id, qty) values (p, t.offer_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;
  insert into collection (user_id, card_id, qty) values (t.from_user, t.want_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  update trades set status = 'accepted', resolved_at = now() where id = t.id;
  update profiles set trades_done = trades_done + 1 where id in (p, t.from_user);

  perform bump_quests(p, 'trades', 1);
  perform bump_quests(t.from_user, 'trades', 1);
  perform sync_collection_quests(p);
  perform sync_collection_quests(t.from_user);

  return me();
end $$;

create or replace function public.trade_cancel(p_trade uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into t from trades where id = p_trade for update;
  if not found or t.from_user <> p then raise exception 'Demande introuvable.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est déjà traitée.'; end if;
  update trades set status = 'cancelled', resolved_at = now() where id = t.id;
  perform rembourser_demande(t);
  return me();
end $$;

-- Les demandes, avec le pseudo et l'avatar d'en face.
create or replace function public.trade_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'sens', case when t.from_user = p then 'envoyee' else 'recue' end,
      'pseudo', o.pseudo, 'avatar', o.avatar, 'photo', photo_discord(o.id),
      'offer', t.offer_card, 'want', t.want_card, 'note', t.note,
      'status', t.status, 'created_at', t.created_at,
      'possible', exists (select 1 from collection c
                          where c.user_id = p and c.qty > 0
                            and c.card_id = case when t.from_user = p then t.offer_card else t.want_card end))
      order by t.created_at desc)
    from trades t
    join profiles o on o.id = case when t.from_user = p then t.to_user else t.from_user end
    where (t.from_user = p or t.to_user = p)
      and (t.status = 'pending' or t.resolved_at > now() - interval '7 days')
  ), '[]'::jsonb);
end $$;

-- Recherche d'un joueur par pseudo (pour viser sa demande d'echange).
create or replace function public.find_player(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r profiles;
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into r from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;
  return jsonb_build_object('pseudo', r.pseudo, 'avatar', r.avatar,
    'frame', r.frame, 'photo', photo_discord(r.id));
end $$;

-- =====================================================================
--  Droits d'appel : les fonctions ne sont ouvertes qu'aux comptes connectes.
-- =====================================================================
-- pick_card, bump_quests, regen_tickets et sync_collection_quests sont des rouages
-- internes : personne n'a a les appeler depuis le navigateur.
revoke all on function public.pick_card, public.bump_quests, public.regen_tickets,
  public.sync_collection_quests from public, anon, authenticated;

revoke all on function public.me, public.set_profile, public.checkin, public.open_pack,
  public.claim_quest, public.shop_buy, public.trade_create, public.trade_respond,
  public.trade_cancel, public.trade_list, public.find_player from public, anon;

grant execute on function public.me, public.set_profile, public.checkin, public.open_pack,
  public.claim_quest, public.shop_buy, public.trade_create, public.trade_respond,
  public.trade_cancel, public.trade_list, public.find_player to authenticated;


-- #####################################################################
-- ###  03b_promos.sql
-- ###  Les cartes Promo et leurs paliers de collection
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — les cartes Promo
--
--  Elles n'appartiennent pas a l'extension : jamais tirees dans un booster,
--  jamais comptees dans les 122 cartes, jamais echangeables. On les obtient
--  autrement — en boutique, ou en recompense d'un palier de collection.
--
--  A jouer apres 03_rpc.sql et AVANT 04_seed.sql : la boutique vend deux de
--  ces cartes, et ne peut pas les referencer avant qu'elles existent.
--  Rejouable sans danger.
-- =====================================================================

-- ------------------------------------------------------------ catalogue
-- `promo = true` les exclut du tirage (pick_card) et du pourcentage de
-- collection (sync_collection_quests) : c'est le seul drapeau a poser.
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo) values
  ('p01',  1, 'Major de Paris',    'coach',  'mauve',  'PR', false, true),
  ('p02',  2, 'Major de Paris',    'coach',  'mauve',  'PR', false, true),
  ('p05',  5, 'Tout Commence Ici', 'joueur', 'rose',   'PR', false, true),
  ('p06',  6, 'Le Marionnettiste', 'joueur', 'neutre', 'PR', false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- =====================================================================
--  Les paliers de collection
--
--  Deux cartes s'obtiennent en completant la collection. Le serveur les
--  accorde lui-meme : le navigateur ne peut ni les reclamer, ni mentir sur
--  son avancement.
--
--  Idempotent : une carte deja possedee n'est pas redonnee. C'est important,
--  parce que check_promos() est appele a chaque ouverture de booster et a
--  chaque visite — sans ce garde-fou, le compteur d'exemplaires grimperait
--  tout seul.
-- =====================================================================
-- open_pack() (03_rpc.sql) appelle cette fonction alors qu'elle n'existe pas
-- encore au moment ou il est cree : PL/pgSQL resout les appels a l'execution,
-- pas a la creation, et ce fichier est joue juste apres. Au premier booster
-- ouvert, elle est la.
create or replace function public.check_promos(p uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pct int;
begin
  -- Le meme calcul que sync_collection_quests : les Promos ne comptent pas
  -- dans leur propre condition d'obtention.
  select case when count(*) = 0 then 0
         else floor(count(*) filter (where c.qty > 0) * 100.0 / count(*)) end
    into pct
    from cards k left join collection c on c.card_id = k.id and c.user_id = p
   where not k.promo;

  -- Palier intermediaire : la carte du milieu de parcours.
  if pct >= cfg('promo_palier_pct') then
    insert into collection (user_id, card_id, qty) values (p, 'p06', 1)
      on conflict (user_id, card_id) do nothing;
  end if;

  -- Master Set : l'extension entiere.
  if pct >= 100 then
    insert into collection (user_id, card_id, qty) values (p, 'p05', 1)
      on conflict (user_id, card_id) do nothing;
  end if;
end $$;

-- me() appelle check_promos a chaque rafraichissement : une collection
-- completee par un echange — et non par un booster — accorde la carte au
-- rafraichissement suivant. Cet appel est pose dans 07_vitrine.sql, qui est le
-- dernier fichier a redefinir me() : l'ajouter ici serait inutile, la version
-- de 07 l'ecraserait.

-- check_promos est un rouage interne : appele par me() et open_pack, jamais
-- par le navigateur.
revoke all on function public.check_promos from anon, authenticated;

-- =====================================================================
--  Outil : accorder une carte Promo a la main
--
--  Sert a tester l'animation d'obtention sans avoir a completer la
--  collection. Remplace le pseudo et l'identifiant, puis execute.
--  Pour rejouer l'animation, retire d'abord la carte (requete du bas).
-- =====================================================================
-- insert into public.collection (user_id, card_id, qty)
-- select id, 'p05', 1 from public.profiles where lower(pseudo) = lower('TonPseudo')
-- on conflict (user_id, card_id) do update set qty = collection.qty + 1;

-- delete from public.collection
--  where card_id in ('p01','p02','p05','p06')
--    and user_id = (select id from public.profiles where lower(pseudo) = lower('TonPseudo'));


-- #####################################################################
-- ###  04_seed.sql
-- ###  Les quetes et le catalogue de la boutique
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — quetes et boutique
--  A jouer apres 03b_promos.sql : deux articles referencent des cartes Promo.
--  Rejouable a volonte : chaque ligne est mise a jour si elle existe deja.
--  C'est ici qu'on equilibre le jeu, pas dans le navigateur.
--
--  ------------------------------------------------------------------
--  L'equilibrage, en une page.
--
--  L'extension compte 122 cartes : 9 essences, 33 communes, 24 peu
--  communes, 28 rares, 18 epiques, 10 legendaires.
--
--  Un booster donne 6 cartes : deux communes, une commune ou peu commune
--  (60/40), une peu commune, une essence, et un dernier tirage a
--  80 % rare / 16 % epique / 4 % legendaire.
--  La reserve tient 5 boosters et se recharge de 1 toutes les 4 h — six
--  boosters par jour pour qui passe regulierement.
--
--  Ce que ca donne, en mediane de simulation :
--      25 % de la collection ......    7 boosters  (le premier jour)
--      50 % .......................   17 boosters  (trois jours)
--      75 % .......................   45 boosters  (une semaine)   -> promo P06
--      90 % .......................  125 boosters  (trois semaines)
--     100 % .......................  693 boosters  (~115 jours)    -> promo P05
--  Le goulot, ce sont les legendaires : dix cartes a 4 % l'une. C'est aussi
--  pourquoi le passage de dix a six cartes n'a presque pas bouge le Master
--  Set (655 -> 693) : le taux de legendaire par paquet, lui, n'a pas change.
--  Ce sont les premiers paliers qui s'allongent, la ou il y avait du gras.
--
--  ------------------------------------------------------------------
--  Ce qui paie, et ce qui ne paie pas.
--
--  Les deux paliers qui donnent une carte Promo ne donnent QUE la carte :
--  zero Eclat. C'est volontaire. Une recompense qui paie deux fois dilue
--  les deux : on se souvient d'avoir debloque la carte, pas d'avoir touche
--  six mille Eclats en meme temps. Idem pour les 500 boosters, qui donnent
--  un cadre qu'aucune boutique ne vend.
--
--  Les Eclats viennent donc du quotidien, de l'hebdomadaire et des paliers
--  chiffres — environ 300 par jour pour un joueur regulier :
--      x1 booster (350) ...............  un peu plus d'une journee
--      x10 boosters (3 000) ...........  dix jours
--      un cadre (1 200 a 5 000) .......  de quatre a dix-sept jours
--      une carte Promo (5 000) ........  dix-sept jours
--
--  Tout depenser en boosters n'accelere la collection que d'environ 17 %
--  (94 jours au lieu de 110) : les Eclats aident, ils ne remplacent pas
--  le temps.
-- =====================================================================

-- Une quete peut accorder un objet en plus — ou a la place — des Eclats :
-- un cadre, une carte. C'est ce qui permet a un palier de payer autrement
-- qu'en monnaie.
alter table public.quests add column if not exists item_id text;

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | collection_pct   (tous mesures cote serveur)
--
-- Les objectifs quotidiens sont calibres sur six boosters par jour. A ce
-- rythme, « une Epique » tombe environ trois jours sur quatre (20 % de
-- chances par paquet, six paquets) — assez souvent pour ne pas decourager,
-- assez rarement pour valoir quelque chose.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   25, null, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
  ('d_epic',    'daily',     'rarity_E',       1,   75, null, 'Au moins une Épique',  'Décroche une Épique ou une Légendaire.', 3),
  ('d_new',     'daily',     'new_cards',      3,   40, null, 'Du sang neuf',         'Trouve 3 cartes que tu n''avais pas.', 4),
  ('d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un échange avec un autre joueur.', 5),

  -- Trente boosters sur les quarante-deux qu'une semaine complete rapporte :
  -- on peut sauter deux jours et finir quand meme.
  ('w_check',   'weekly',    'checkin',        5,  200, null, 'Habitué de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         30,  260, null, 'Ouvreur en série',     'Ouvre 30 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     15,  320, null, 'Chasseur de vides',    'Trouve 15 cartes inédites.', 3),
  -- Huit et non dix : la derniere carte du paquet donne desormais une Epique
  -- ou mieux une fois sur cinq, contre pres d'une sur trois avant. A dix, la
  -- quete passait de huit semaines sur dix a une sur trois — un objectif qu'on
  -- rate sans avoir rien fait de mal n'apprend rien a personne.
  ('w_epic',    'weekly',    'rarity_E',       8,  340, null, 'Huit Épiques',         'Décroche 8 Épiques ou mieux.', 4),
  ('w_legend',  'weekly',    'rarity_L',       1,  420, null, 'Une Légendaire',       'Sors une Légendaire cette semaine.', 5),
  ('w_trade',   'weekly',    'trades',         5,  380, null, 'Le marché',            'Conclus 5 échanges.', 6),

  -- Saisonnieres : une seule fois, pour toujours.
  ('m_legend',  'milestone', 'rarity_L',       1,  500, null, 'Première Légendaire',  'Sors ta toute première Légendaire d''un booster.', 1),

  -- Les paliers de collection. Ceux qui donnent une Promo ne donnent rien d'autre.
  ('m_col25',   'milestone', 'collection_pct', 25,  400, null,  'Un quart du chemin', 'Possède 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct', 50,  800, null,  'La moitié',          'Possède 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possède 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Tout Commence Ici',  'Possède les 122 cartes de l''extension.', 5),

  -- Les paliers de boosters ouverts : la seule progression qui ne depende que
  -- du temps passe, et pas de la chance.
  ('m_packs25', 'milestone', 'packs',          25,  400, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 6),
  ('m_packs50', 'milestone', 'packs',          50,  800, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 7),
  ('m_packs100','milestone', 'packs',         100, 1500, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 8),
  ('m_packs200','milestone', 'packs',         200, 2500, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 9),
  ('m_packs500','milestone', 'packs',         500,    0, 'f_sceau', 'Cinq cents paquets', 'Ouvre 500 boosters en tout.', 10),

  ('m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 11)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_epic','d_new','d_trade',
  'w_check','w_packs','w_new','w_epic','w_legend','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100',
  'm_packs25','m_packs50','m_packs100','m_packs200','m_packs500',
  'm_trade25');

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique | carte
--
-- Les intitules commencent par la quantite : « x5 Boosters » se lit d'un
-- coup d'oeil la ou « Cinq boosters » demande une lecture. C'est une liste
-- qu'on parcourt, pas un catalogue qu'on epluche.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'x1 Booster',   'Ajoute 1 booster à ta réserve, par-dessus le plafond.',      350, 'tickets',  1, null, false, 1),
  ('s_pack5',  'boosters',   'x5 Boosters',  'Cinq boosters d''un coup, un peu moins cher à l''unité.',   1600, 'tickets',  5, null, false, 2),
  ('s_pack10', 'boosters',   'x10 Boosters', 'Le meilleur prix à l''unité du rayon.',                     3000, 'tickets', 10, null, false, 3),

  ('s_token1', 'echange',    'x1 Jeton d''échange',   'Lance une demande d''échange sans attendre la fin du délai.',  600, 'trade_token', 1, null, false, 1),
  ('s_token5', 'echange',    'x5 Jetons d''échanges', 'Cinq demandes d''échange immédiates.',                        2500, 'trade_token', 5, null, false, 2),

  -- Les deux Promos achetables. A 5 000, c'est un peu plus de deux semaines
  -- d'epargne : assez pour que le choix « j'ouvre ou j'economise » existe,
  -- pas assez pour decourager.
  ('s_p01',    'promo',      'Carte Promo P01', 'Major de Paris, illustré par Justice Wong & HL. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p01', true, 1),
  ('s_p02',    'promo',      'Carte Promo P02', 'Major de Paris, illustration alternative de Rexpo. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p02', true, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',   'Un liseré bleu autour de ton avatar.',                      1200, 'cosmetique', 1, null, true, 1),
  ('f_rose',   'cosmetique', 'Cadre Rose',   'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique', 1, null, true, 2),
  ('f_or',     'cosmetique', 'Cadre Or',     'Doré, comme les Légendaires.',                              2500, 'cosmetique', 1, null, true, 3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un cadre animé qui balaie toutes les essences.',            5000, 'cosmetique', 1, null, true, 4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

-- Le Cadre Sceau ne se vend pas : il s'obtient aux 500 boosters ouverts, et
-- nulle part ailleurs. On le retire donc de la boutique s'il y trainait.
delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme');


-- #####################################################################
-- ###  06_social.sql
-- ###  Les amis et les fiches de joueur
-- #####################################################################

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
      return friend_list();
    end if;
    raise exception 'Ta demande est déjà en attente.';
  end if;

  if (select count(*) from friendships where demandeur = moi and not accepte) >= 25 then
    raise exception 'Tu as déjà 25 demandes en attente.';
  end if;

  insert into friendships (a, b, demandeur) values (x, y, moi);
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


-- #####################################################################
-- ###  07_vitrine.sql
-- ###  La vitrine : quatre cartes mises en avant sur le profil
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — la vitrine : quatre cartes mises en avant sur le profil
--  A executer apres 06_social.sql. Rejouable sans danger.
-- =====================================================================

alter table public.profiles
  add column if not exists vitrine text[] not null default '{}';

-- Quatre cartes au maximum, toutes possedees, sans doublon : le serveur
-- verifie, sinon n'importe qui exposerait une Legendaire qu'il n'a pas.
create or replace function public.set_vitrine(p_cards text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); propre text[]; c text;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  p_cards := coalesce(p_cards, '{}');
  if array_length(p_cards, 1) > 4 then raise exception 'Quatre cartes au maximum.'; end if;

  propre := '{}';
  foreach c in array p_cards loop
    if c = any(propre) then continue; end if;                 -- pas deux fois la meme
    if not exists (select 1 from collection
                   where user_id = moi and card_id = c and qty > 0) then
      raise exception 'Tu ne possèdes pas une des cartes choisies.';
    end if;
    propre := propre || c;
  end loop;

  update profiles set vitrine = propre where id = moi;
  return me();
end $$;

revoke all on function public.set_vitrine from public, anon;
grant execute on function public.set_vitrine to authenticated;

-- ------------------------------------------------- la vitrine dans me()
-- me() est redefinie ici pour ajouter le champ : la version de 03_rpc.sql ne le
-- connait pas. Rejouer 03_rpc.sql apres ce fichier l'effacerait — il faut alors
-- rejouer celui-ci, ou plus simplement recoller TOUT.sql qui les met dans l'ordre.
-- C'est la derniere version de me() : elle ajoute la vitrine au profil, et
-- c'est donc ici que se pose l'appel a check_promos (supabase/03b_promos.sql).
-- Une carte Promo de palier peut etre debloquee par un echange aussi bien que
-- par un booster : sans cet appel, elle n'arriverait qu'a la prochaine
-- ouverture de paquet.
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  pr := regen_tickets(p);
  perform sync_collection_quests(p);
  perform check_promos(p);

  return jsonb_build_object(
    'profil', jsonb_build_object(
      'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
      'is_admin', pr.is_admin, 'shards', pr.shards, 'tickets', pr.tickets,
      'last_tick', pr.last_tick, 'trade_free_at', pr.trade_free_at,
      'packs_opened', pr.packs_opened, 'trades_done', pr.trades_done,
      'streak', pr.streak, 'last_checkin', pr.last_checkin,
      'vitrine', to_jsonb(pr.vitrine),
      -- La seule fonction qui reponde a un compte non invite : c'est elle qui
      -- permet au navigateur d'afficher « tu n'es pas sur la liste » au lieu
      -- d'une erreur muette. Toutes les autres refusent (garde_beta).
      'invite', (cfg('beta_fermee') = 0 or est_invite(p)),
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', cfg('ticket_minutes'),
      'serveur', now()),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'item', q.item_id, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false)) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------- la vitrine sur la fiche publique
-- La vitrine est visible de tous : c'est fait pour etre montre.
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
    'vitrine', to_jsonb(o.vitrine),
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end);
end $$;

grant execute on function public.me, public.player_profile to authenticated;


-- =====================================================================
--   C'est installe.
--
--   Pour verifier, ouvre la page verif.html du site : elle controle tout
--   et dit en clair ce qui manque encore.
--
--   Il reste deux choses a faire, qui ne se font pas en SQL :
--     - les adresses de retour  (Authentication > URL Configuration)
--     - la connexion Discord    (Authentication > Providers > Discord)
--   Tout est explique dans SETUP.md.
--
--   Et quand ton compte sera cree, pense a supabase/05_admin.sql pour
--   te donner les droits d'administrateur.
-- =====================================================================
