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
--   Assemble le 2026-09-21
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
  in_booster boolean not null default true
);
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
  categ    text not null check (categ in ('boosters','echange','cosmetique')),
  titre    text not null,
  detail   text not null default '',
  prix     integer not null check (prix >= 0),
  effet    text not null,                -- tickets | trade_token | avatar_frame | refill
  montant  integer not null default 1,
  unique_buy boolean not null default false,
  ordre    integer not null default 0,
  actif    boolean not null default true
);

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
  constraint no_self_trade check (from_user <> to_user)
);
create index if not exists trades_to_idx   on public.trades (to_user,   status);
create index if not exists trades_from_idx on public.trades (from_user, status);

-- =====================================================================
--  Reglages d'economie : une seule source de verite, cote serveur.
-- =====================================================================
create or replace function public.cfg(k text) returns integer
language sql immutable as $$
  select case k
    when 'ticket_cap'        then 5          -- boosters en reserve au maximum
    when 'ticket_minutes'    then 30         -- un booster toutes les 30 min
    when 'pack_size'         then 8
    when 'god_odds'          then 2000       -- 1 chance sur 2000
    when 'trade_cooldown_h'  then 6          -- un echange gratuit toutes les 6 h
    when 'shards_per_dup'    then 0
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

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; try text; n int := 0;
begin
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
  select case when count(*) = 0 then 0
         else floor(count(*) filter (where c.qty > 0) * 100.0 / count(*)) end
    into pct
    from cards k left join collection c on c.card_id = k.id and c.user_id = p;

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
grant select on public.profiles, public.collection, public.quest_progress,
                public.inventory, public.trades to authenticated;

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

-- Une carte retiree de js/cards-data.js disparait aussi du tirage serveur.
delete from public.cards where id not in ('c001', 'c002', 'c003', 'c004', 'c005', 'c006', 'c007', 'c008', 'c009', 'c010', 'c011', 'c012', 'c013', 'c014', 'c015', 'c016', 'c017', 'c018', 'c019', 'c020', 'c021', 'c022', 'c023', 'c024', 'c025', 'c026', 'c027', 'c028', 'c029', 'c030', 'c031', 'c032', 'c033', 'c034', 'c035', 'c036', 'c037', 'c038', 'c039', 'c040', 'c041', 'c042', 'c043', 'c044', 'c045', 'c046', 'c047', 'c048', 'c049', 'c050', 'c051', 'c052', 'c053', 'c054', 'c055', 'c056', 'c057', 'c058', 'c059', 'c060', 'c061', 'c062', 'c063', 'c064', 'c065', 'c066', 'c067', 'c068', 'c069', 'c070', 'c071', 'c072', 'c073', 'c074', 'c075', 'c076', 'c077', 'c078', 'c079', 'c080', 'c081', 'c082', 'c083', 'c084', 'c085', 'c086', 'c087', 'c088', 'c089', 'c090', 'c091', 'c092', 'c093', 'c094', 'c095', 'c096', 'c097', 'c098', 'c099', 'c100', 'c101', 'c102', 'c103', 'c104', 'c105', 'c106', 'c107', 'c108', 'c109', 'c110', 'c111', 'c112', 'c113', 'c114', 'c115', 'c116', 'c117', 'c118', 'c119', 'c120', 'c121', 'c122');


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

  if p_pseudo is not null then
    if p_pseudo !~ '^[A-Za-z0-9_.\-]{3,16}$' then
      raise exception 'Pseudo invalide : 3 a 16 caracteres, lettres, chiffres, . _ -';
    end if;
    if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> p) then
      raise exception 'Ce pseudo est deja pris.';
    end if;
  end if;

  -- Un avatar « card:cXXX » doit correspondre a une carte reellement possedee.
  if p_avatar is not null and p_avatar like 'card:%' then
    if not exists (select 1 from collection
                   where user_id = p and card_id = substr(p_avatar, 6) and qty > 0) then
      raise exception 'Tu ne possedes pas cette carte.';
    end if;
  end if;

  -- Un cadre achete doit etre dans l'inventaire.
  if p_frame is not null and p_frame <> 'default'
     and not exists (select 1 from inventory where user_id = p and item_id = p_frame and qty > 0) then
    raise exception 'Cadre non debloque.';
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
      where in_booster and rar = essai and cat <> 'essence'
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

  pr := regen_tickets(p);
  if pr.tickets < 1 then
    raise exception 'RESERVE_VIDE';
  end if;

  god := random() < 1.0 / cfg('god_odds');

  if god then
    for i in 1..4 loop ids := ids || pick_card('R'); end loop;
    for i in 1..3 loop ids := ids || pick_card('E'); end loop;
    ids := ids || pick_card('L');
  else
    for i in 1..3 loop ids := ids || pick_card('C'); end loop;
    ids := ids || pick_card(case when random() < 0.5 then 'C' else 'PC' end);
    ids := ids || pick_card('PC');
    ids := ids || pick_card('PC');

    select id into cid from cards where in_booster and cat = 'essence' order by random() limit 1;
    ids := ids || coalesce(cid, pick_card('C'));

    x := random() * 100.0;
    ids := ids || pick_card(case when x < 79.2 then 'R'
                                 when x < 95.83 then 'E'
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
  select * into q from quests where id = p_quest;
  if not found then raise exception 'Quete inconnue.'; end if;

  pk := period_key(q.scope);
  select progress, claimed into prog, deja
    from quest_progress where user_id = p and quest_id = q.id and period_key = pk for update;

  if deja then raise exception 'Recompense deja recuperee.'; end if;
  if coalesce(prog, 0) < q.goal then raise exception 'Quete non terminee.'; end if;

  update quest_progress set claimed = true
    where user_id = p and quest_id = q.id and period_key = pk;
  update profiles set shards = shards + q.reward where id = p;

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
  select * into it from shop_items where id = p_item and actif;
  if not found then raise exception 'Article indisponible.'; end if;

  select * into pr from profiles where id = p for update;
  if pr.shards < it.prix then raise exception 'Pas assez d''Eclats.'; end if;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possedes deja cet article.';
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
create or replace function public.trade_create(
  p_pseudo text, p_offer text, p_want text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles; dest profiles;
  ro text; rw text; jeton int; gratuit boolean;
begin
  if p is null then raise exception 'non connecte'; end if;

  select * into dest from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if dest.id = p then raise exception 'Tu ne peux pas echanger avec toi-meme.'; end if;

  select rar into ro from cards where id = p_offer;
  select rar into rw from cards where id = p_want;
  if ro is null or rw is null then raise exception 'Carte inconnue.'; end if;
  if ro <> rw then raise exception 'Les deux cartes doivent etre de la meme rarete.'; end if;
  if ro = 'ES' then raise exception 'Les Essences ne s''echangent pas.'; end if;

  if not exists (select 1 from collection where user_id = p and card_id = p_offer and qty > 0) then
    raise exception 'Tu ne possedes pas la carte que tu proposes.';
  end if;

  if exists (select 1 from trades where from_user = p and to_user = dest.id
             and offer_card = p_offer and want_card = p_want and status = 'pending') then
    raise exception 'Cette demande est deja en attente.';
  end if;
  if (select count(*) from trades where from_user = p and status = 'pending') >= 10 then
    raise exception 'Tu as deja 10 demandes en attente.';
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

  insert into trades (from_user, to_user, offer_card, want_card, note)
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140));

  return me();
end $$;

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades; a uuid; b uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  select * into t from trades where id = p_trade for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if t.to_user <> p then raise exception 'Cette demande ne t''est pas adressee.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est deja traitee.'; end if;

  if not p_accept then
    update trades set status = 'declined', resolved_at = now() where id = t.id;
    return me();
  end if;

  -- Verrouillage dans un ordre stable, pour que deux echanges croises
  -- ne puissent pas se bloquer mutuellement.
  a := least(t.from_user, t.to_user); b := greatest(t.from_user, t.to_user);
  perform 1 from profiles where id = a for update;
  perform 1 from profiles where id = b for update;

  if not exists (select 1 from collection where user_id = t.from_user and card_id = t.offer_card and qty > 0) then
    update trades set status = 'cancelled', resolved_at = now() where id = t.id;
    raise exception 'Le demandeur ne possede plus cette carte.';
  end if;
  if not exists (select 1 from collection where user_id = p and card_id = t.want_card and qty > 0) then
    raise exception 'Tu ne possedes pas la carte demandee.';
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
  select * into t from trades where id = p_trade for update;
  if not found or t.from_user <> p then raise exception 'Demande introuvable.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est deja traitee.'; end if;
  update trades set status = 'cancelled', resolved_at = now() where id = t.id;
  return me();
end $$;

-- Les demandes, avec le pseudo et l'avatar d'en face.
create or replace function public.trade_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'sens', case when t.from_user = p then 'envoyee' else 'recue' end,
      'pseudo', o.pseudo, 'avatar', o.avatar,
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
  select * into r from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;
  return jsonb_build_object('pseudo', r.pseudo, 'avatar', r.avatar, 'frame', r.frame);
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
-- ###  04_seed.sql
-- ###  Les quetes et le catalogue de la boutique
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — quetes et boutique
--  Rejouable a volonte : chaque ligne est mise a jour si elle existe deja.
--  C'est ici qu'on equilibre le jeu, pas dans le navigateur.
-- =====================================================================

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | collection_pct   (tous mesures cote serveur)
insert into public.quests (id, scope, metric, goal, reward, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   20, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          3,   40, 'Trois paquets',        'Ouvre 3 boosters.', 2),
  ('d_new',     'daily',     'new_cards',      5,   50, 'Du sang neuf',         'Trouve 5 cartes que tu n''avais pas.', 3),
  ('d_rare',    'daily',     'rarity_R',       1,   30, 'Au moins une Rare',    'Decroche une Rare, une Epique ou une Legendaire.', 4),
  ('d_trade',   'daily',     'trades',         1,   60, 'Donnant-donnant',      'Conclus un echange avec un autre joueur.', 5),

  ('w_check',   'weekly',    'checkin',        5,  200, 'Habitue de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         20,  250, 'Ouvreur en serie',     'Ouvre 20 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     25,  350, 'Chasseur de vides',    'Trouve 25 cartes inedites.', 3),
  ('w_epic',    'weekly',    'rarity_E',       3,  300, 'Triple Epique',        'Decroche 3 Epiques ou mieux.', 4),
  ('w_trade',   'weekly',    'trades',         5,  400, 'Le marche',            'Conclus 5 echanges.', 5),

  ('m_legend',  'milestone', 'rarity_L',       1,  500, 'Premiere Legendaire',  'Sors ta toute premiere Legendaire d''un booster.', 1),
  ('m_col25',   'milestone', 'collection_pct',25,  300, 'Un quart du chemin',   'Possede 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct',50,  700, 'La moitie',            'Possede 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct',75, 1400, 'Presque complet',      'Possede 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,3000, 'Tout commence ici',    'Possede les 122 cartes de l''extension.', 5)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_new','d_rare','d_trade',
  'w_check','w_packs','w_new','w_epic','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100');

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'Un booster',          'Ajoute 1 booster a ta reserve, par-dessus le plafond.', 120, 'tickets',     1, false, 1),
  ('s_pack5',  'boosters',   'Cinq boosters',       'Ajoute 5 boosters. Un peu moins cher a l''unite.',      550, 'tickets',     5, false, 2),
  ('s_refill', 'boosters',   'Reserve pleine',      'Remplit la reserve et relance le compte a rebours.',     300, 'refill',      1, false, 3),

  ('s_token1', 'echange',    'Jeton d''echange',     'Lance une demande sans attendre la fin du delai.',      200, 'trade_token', 1, false, 1),
  ('s_token5', 'echange',    'Cinq jetons',         'Cinq demandes d''echange immediates.',                   900, 'trade_token', 5, false, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',          'Un lisere bleu autour de ton avatar.',                   800, 'cosmetique',  1, true,  1),
  ('f_rose',   'cosmetique', 'Cadre Rose',          'Le rose du logo, autour de ton avatar.',                 800, 'cosmetique',  1, true,  2),
  ('f_or',     'cosmetique', 'Cadre Or',            'Dore, comme les Legendaires.',                          1500, 'cosmetique',  1, true,  3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme',        'Un cadre anime qui balaie toutes les essences.',        4000, 'cosmetique',  1, true,  4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  unique_buy = excluded.unique_buy, ordre = excluded.ordre, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_refill','s_token1','s_token5',
  'f_azur','f_rose','f_or','f_prisme');


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
