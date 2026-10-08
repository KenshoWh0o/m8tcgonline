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
--   Assemble le 2026-10-08
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

-- Version 1.5 : les Fragments du recyclage, le nombre de cartes fabriquees et
-- la plus longue serie de jours (les succes en ont besoin : la serie en cours,
-- elle, retombe a zero).
alter table public.profiles add column if not exists fragments    integer not null default 0;
alter table public.profiles add column if not exists fabrications integer not null default 0;
alter table public.profiles add column if not exists serie_max    integer not null default 0;
-- Les boosters « en plus » — achetes en boutique ou recus en cadeau — ne
-- passent pas par la reserve : ils s'ouvrent a part (open_pack(true),
-- 03_rpc.sql). Melanges a la reserve, ils la faisaient deborder du plafond,
-- et une reserve pleine remet le compte a rebours a zero : on perdait des
-- boosters gratuits en en achetant. `tickets_offerts` : combien d'entre eux
-- viennent d'un cadeau (18_cadeaux.sql) — ceux-la ne peuvent pas contenir la
-- carte unique.
alter table public.profiles add column if not exists boosters_bonus  integer not null default 0;
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;
do $$ begin
  alter table public.profiles add constraint fragments_positifs check (fragments >= 0);
exception when duplicate_object then null; end $$;

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
-- Version 2.0 : les Reverses. La meme carte que la Commune, Peu commune ou Rare
-- de l'extension, frappee du logo Tout Commence Ici. Elles sont marquees
-- `promo` — hors des 122, donc hors du pourcentage, des raretes completes et
-- du tirage classique — et `reverse` : c'est ce drapeau qui les rend
-- echangeables, recyclables et fabricables, contrairement aux Promos.
alter table public.cards add column if not exists reverse boolean not null default false;
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
  metric   text not null,   -- packs | new_cards | rarity_R | rarity_E | rarity_L | trades | checkin | recycle | collection_pct
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
-- Version 2.0 : un article peut se payer autrement qu'en Eclats (`devise` :
-- eclats | fragments | prismes — la monnaie d'un evenement), n'etre vendu que
-- pendant un evenement (`evenement`, son code) et s'acheter un nombre limite
-- de fois (`limite`, par joueur).
alter table public.shop_items add column if not exists devise    text not null default 'eclats';
alter table public.shop_items add column if not exists evenement text;
alter table public.shop_items add column if not exists limite    integer;
do $$ begin
  alter table public.shop_items drop constraint if exists shop_items_categ_check;
  alter table public.shop_items add constraint shop_items_categ_check
    check (categ in ('boosters','echange','cosmetique','promo','evenement','invitation'));
  alter table public.shop_items drop constraint if exists shop_items_devise_check;
  alter table public.shop_items add constraint shop_items_devise_check
    check (devise in ('eclats','fragments','prismes'));
end $$;

-- Version 2.0 : les quetes d'un evenement. `evenement` : son code — la quete
-- n'existe que pendant qu'il dure. `monnaie` : ce qu'elle paie (eclats, ou
-- prismes, la monnaie de l'evenement). Deux portees de plus : `ev_jour` (une
-- quete du jour pendant l'evenement) et `ev` (une fois pour tout l'evenement).
alter table public.quests add column if not exists evenement text;
alter table public.quests add column if not exists monnaie   text not null default 'eclats';
do $$ begin
  alter table public.quests drop constraint if exists quests_scope_check;
  alter table public.quests add constraint quests_scope_check
    check (scope in ('daily','weekly','milestone','ev_jour','ev'));
end $$;

-- Version 2.0 : la personnalisation du profil. Un titre (parmi ceux qu'on a
-- gagnes, 21_reflets.sql), une banniere (l'illustration d'une carte qu'on
-- possede, en tete de sa fiche) et une devise (une phrase, 80 signes).
alter table public.profiles add column if not exists titre    text;
alter table public.profiles add column if not exists banniere text;
alter table public.profiles add column if not exists devise   text;

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
    -- Recyclage (supabase/12_recyclage.sql) : ce que rapporte un doublon jete,
    -- en Fragments. Les Fragments n'achetent qu'une chose — une carte qui
    -- manque (fabriquer) — : ils ne font pas tourner de boucle avec les
    -- boosters, il n'y a donc plus de plafond. Le calcul est en tete de
    -- 12_recyclage.sql.
    when 'recyclage_ES'      then 1
    when 'recyclage_C'       then 2
    when 'recyclage_PC'      then 5
    when 'recyclage_R'       then 20
    when 'recyclage_E'       then 80
    when 'recyclage_L'       then 250
    -- Fabriquer une carte qui manque, en Fragments. Simulation (six boosters
    -- par jour, tous les doublons recycles) : un joueur a 120 boosters finit
    -- l'extension en ~62 jours au lieu de ~92, et le quart le plus malchanceux
    -- en ~73 au lieu de ~124. Moins cher, la fin de collection ne valait plus
    -- rien ; plus cher, la fabrication ne changeait presque rien.
    when 'fabrication_ES'    then 20
    when 'fabrication_C'     then 40
    when 'fabrication_PC'    then 100
    when 'fabrication_R'     then 400
    when 'fabrication_E'     then 2000
    when 'fabrication_L'     then 8000
    -- Une Essence Brillante remplace l'Essence du paquet une fois sur 50 :
    -- environ une tous les huit jours pour un joueur regulier.
    when 'foil_odds'         then 50
    -- La chasse a la carte unique (supabase/15_evenements.sql) : une chance
    -- sur 250 par booster, tant que personne ne l'a trouvee. Avec ~70 boosters
    -- ouverts par jour dans la communaute, elle sort en ~3 a 4 jours.
    when 'chasse_odds'       then 250
  end;
$$;

-- =====================================================================
--  L'heure d'ouverture au public
--
--  Une seule date, et elle s'applique toute seule : passe cet instant, le
--  serveur repond a tout le monde, sans qu'on ait quoi que ce soit a rejouer.
--  Avant, il ne repond qu'aux comptes inscrits dans `beta_invites`.
--
--  C'est le SEUL endroit ou vit cette date. L'ecran d'attente (js/gate.js)
--  la demande au serveur par porte(), avec l'heure du serveur : il n'a plus
--  sa propre copie, et il ne consulte plus la montre du telephone. Avancer
--  la date de l'appareil ouvrait l'ecran — et avec lui tout le jeu hors
--  ligne. C'est par la que des visiteurs passaient.
--
--  Le fuseau est ecrit en clair : +02 est l'heure d'ete francaise, en vigueur
--  jusqu'au 25 octobre 2026.
-- =====================================================================
--
--  PROJET ANNULE : l'ouverture au public n'a pas lieu. La date vaut
--  'infinity' — beta_ouverte() reste faux, et seuls les comptes de
--  `beta_invites` entrent. Pour rouvrir a tous : une date passee ici, et
--  PORTE.active a false dans js/gate.js.
create or replace function public.beta_lancement() returns timestamptz
language sql immutable as $$
  select timestamptz 'infinity';
$$;

-- `stable` et non `immutable` : la reponse depend de now().
create or replace function public.beta_ouverte() returns boolean
language sql stable as $$
  select now() >= beta_lancement();
$$;

-- Ce que l'ecran d'attente a besoin de savoir, sans compte : est-ce ouvert,
-- quand ca ouvre, et quelle heure il est ICI. Le navigateur compte ensuite le
-- temps ecoule avec une horloge que l'utilisateur ne peut pas regler
-- (performance.now()), jamais avec la date de l'appareil.
create or replace function public.porte() returns jsonb
language sql stable as $$
  select jsonb_build_object('ouvert', beta_ouverte(),
                            'lancement', beta_lancement(),
                            'serveur', now());
$$;

grant execute on function public.porte to anon, authenticated;

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
--  La serrure, c'est ici. Jusqu'a l'heure fixee par beta_ouverte(), aucune
--  action du jeu n'aboutit pour qui ne figure pas dans cette table — pas
--  seulement l'inscription, mais chaque appel (voir garde_beta). Elle ne se
--  contourne pas depuis le navigateur.
--
--  La cle est au choix une adresse e-mail ou un identifiant Discord : selon
--  le fournisseur, on ne recoit pas toujours les deux.
-- =====================================================================
create table if not exists public.beta_invites (
  cle       text primary key,
  note      text,
  ajoute_le timestamptz not null default now()
);
-- La cle se compare sans tenir compte de la casse (une adresse e-mail s'ecrit
-- comme on veut). La cle primaire ne sert donc a rien pour cette recherche :
-- il faut son propre index, sinon chaque action du jeu parcourt la table.
create index if not exists beta_invites_cle_idx on public.beta_invites (lower(cle));

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
  -- L'ordre des deux tests compte : passe la date d'ouverture, on ne consulte
  -- plus la liste du tout. C'est le cas de la quasi-totalite des appels apres
  -- le lancement, et il ne coute alors rien.
  if not beta_ouverte() and not est_invite(auth.uid()) then
    raise exception 'BETA_FERMEE';
  end if;
end $$;

-- `public` d'abord : Postgres accorde l'execution a tout le monde par defaut,
-- et `anon` en herite. Ne retirer le droit qu'a `anon` et `authenticated`
-- laissait donc ces deux fonctions appelables sans compte — on pouvait sonder
-- la liste des invites identifiant par identifiant.
revoke all on function public.est_invite, public.garde_beta from public, anon, authenticated;

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

-- Version 2.0 : l'inscription n'est plus refusee a qui n'est pas sur la liste.
-- Il fallait un compte pour saisir un code d'invitation (21_reflets.sql) : un
-- compte non invite se cree donc, mais il ne voit que l'ecran d'attente — toutes
-- les actions du jeu passent par garde_beta(), qui le refuse tant qu'il n'est
-- pas sur la liste. find_player et le classement l'ignorent.
--
-- Les comptes existants ne sont pas concernes : ce declencheur ne se lance
-- qu'a l'insertion.
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

  -- minutes_recharge() (15_evenements.sql) : 240 d'ordinaire, moins pendant
  -- un evenement « boosters doubles ». Le pas s'applique a tout le temps ecoule
  -- depuis last_tick : au debut et a la fin d'un evenement, le premier booster
  -- arrive un peu plus tot ou un peu plus tard. Ecart d'un booster au plus.
  step := make_interval(mins => minutes_recharge());
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
revoke all on function public.photo_discord from public, anon, authenticated;

create or replace function public.period_key(sc text) returns text
language sql stable as $$
  select case sc
    when 'daily'  then to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD')
    when 'ev_jour' then to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD')
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

  -- Les raretes completes (metric « set_ES », « set_C », … « set_L ») : le
  -- nombre de cartes differentes possedees dans cette rarete. L'objectif de
  -- la quete est le total de la rarete (voir 04_seed.sql). `greatest` comme
  -- au-dessus : une carte cedee plus tard ne fait pas reculer une quete.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all',
         (select count(*) from collection c join cards k on k.id = c.card_id
           where c.user_id = p and c.qty > 0 and not k.promo
             and k.rar = substr(q.metric, 5))
    from quests q where q.metric like 'set\_%'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress);

  -- Version 2.0 : les Reverses d'une rarete (« rset_C », « rset_PC »,
  -- « rset_R »), toutes les Reverses (« rset_ALL »), toutes les Brillantes
  -- (« brill_ALL »).
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all',
         (select count(*) from collection c join cards k on k.id = c.card_id
           where c.user_id = p and c.qty > 0
             and case q.metric when 'rset_ALL' then k.reverse
                               when 'brill_ALL' then k.rar = 'BR'
                               else k.reverse and k.rar = substr(q.metric, 6) end)
    from quests q where q.metric like 'rset\_%' or q.metric = 'brill_ALL'
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
    -- La plus longue serie : elle sert aux succes, qui ne doivent pas
    -- disparaitre le jour ou la serie en cours retombe.
    update profiles set serie_max = greatest(serie_max, streak) where id = p;
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

-- `p_bonus` : ouvrir un booster « en plus » (boutique, cadeau) plutot qu'un
-- booster de la reserve. Il ne touche ni a la reserve ni a son compte a
-- rebours. L'ancienne signature, sans parametre, est retiree : avec les deux,
-- un appel sans argument serait ambigu.
drop function if exists public.open_pack();
create or replace function public.open_pack(p_bonus boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles;
  god boolean; ids text[] := '{}'; cid text; x double precision;
  nouvelles int := 0; i int; ch_active boolean; ch_gagnant uuid; ch_ouvre timestamptz; unique_id text;
  offert boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  pr := regen_tickets(p);
  if coalesce(p_bonus, false) then
    if pr.boosters_bonus < 1 then raise exception 'BONUS_VIDE'; end if;
    -- Parmi les boosters en plus, ceux d'un cadeau (18_cadeaux.sql) partent en
    -- premier, et ne peuvent pas contenir la carte unique : elle se trouve,
    -- elle ne s'offre pas.
    offert := pr.tickets_offerts > 0;
  else
    if pr.tickets < 1 then raise exception 'RESERVE_VIDE'; end if;
    offert := false;
  end if;

  god := random() < 1.0 / cfg('god_odds');

  -- Six cartes, chacune a sa place (version 2.0) :
  --   1 · Commune
  --   2 · Commune
  --   3 · Peu commune
  --   4 · une Reverse (01_schema.sql) : Commune 50 %, Peu commune 35 %,
  --       Rare 15 %
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
    ids := ids || pick_card('PC');
    x := random() * 100.0;
    select id into cid from cards
     where reverse and rar = case when x < 50.0 then 'C' when x < 85.0 then 'PC' else 'R' end
     order by random() limit 1;
    ids := ids || cid;

    select id into cid from cards
      where in_booster and not promo and cat = 'essence' order by random() limit 1;
    -- Une fois sur cfg('foil_odds'), l'Essence sort dans sa version
    -- Brillante (03b_promos.sql) : meme Essence, `b` au lieu de `c`.
    if cid is not null and random() < 1.0 / cfg('foil_odds') then
      cid := coalesce((select k.id from cards k where k.id = 'b' || substr(cid, 2)), cid);
    end if;
    ids := ids || coalesce(cid, pick_card('C'));

    x := random() * 100.0;
    ids := ids || pick_card(case when x < 80.0 then 'R'
                                 when x < 96.0 then 'E'
                                 else 'L' end);
  end if;

  ids := array_remove(ids, null);
  if array_length(ids, 1) is null then raise exception 'BOOSTER_VIDE'; end if;

  -- La chasse (15_evenements.sql) : tant qu'elle est ouverte et que personne
  -- n'a la carte unique, chaque booster a une chance sur cfg('chasse_odds')
  -- de la contenir. Elle prend la place de la derniere carte, le hit — celle
  -- qui porte la revelation ; le booster garde ses six cartes. La mise a jour
  -- `where gagnant is null` tranche entre deux tirages simultanes : le second
  -- relit la ligne apres le premier, n'y trouve plus de place, et repart
  -- avec un booster ordinaire.
  select active, gagnant, ouvre_le into ch_active, ch_gagnant, ch_ouvre from chasse where id = 1;
  if coalesce(ch_active, false) and ch_gagnant is null and (ch_ouvre is null or now() >= ch_ouvre)
     and not offert and random() < 1.0 / cfg('chasse_odds') then
    update chasse set gagnant = p, trouvee_le = now()
     where id = 1 and gagnant is null
     returning carte into unique_id;
    if unique_id is not null then
      ids[array_length(ids, 1)] := unique_id;
      -- Son cadre, que personne d'autre n'aura : pose d'office sur son avatar.
      insert into inventory (user_id, item_id, qty) values (p, 'f_unique', 1)
        on conflict (user_id, item_id) do nothing;
      update profiles set frame = 'f_unique' where id = p;
      insert into annonces (titre, texte) values (
        (select nom from cards where id = unique_id) || ' a été trouvée !',
        pr.pseudo || ' l''a tirée d''un booster. Il n''en existe qu''une seule dans tout le jeu.');
    end if;
  end if;

  -- Les cartes encore jamais obtenues, avant de mettre a jour la collection.
  select count(*) into nouvelles from unnest(ids) u(cid2)
    where not exists (select 1 from collection c
                      where c.user_id = p and c.card_id = u.cid2 and c.qty > 0);

  insert into collection (user_id, card_id, qty)
  select p, u.cid2, count(*) from unnest(ids) u(cid2) group by u.cid2
  on conflict (user_id, card_id) do update set qty = collection.qty + excluded.qty;

  -- Un booster pris dans la reserve pleine relance le compte a rebours. Un
  -- booster en plus ne touche ni a l'un ni a l'autre.
  if coalesce(p_bonus, false) then
    update profiles set
      boosters_bonus  = boosters_bonus - 1,
      tickets_offerts = greatest(tickets_offerts - case when offert then 1 else 0 end, 0),
      packs_opened    = packs_opened + 1
    where id = p;
  else
    update profiles set
      tickets      = tickets - 1,
      last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
      packs_opened = packs_opened + 1
    where id = p;
  end if;

  -- Le journal des tirages : l'historique et les statistiques du joueur
  -- (mes_tirages, 15_evenements.sql), et le succes « godpack ».
  insert into tirages (user_id, cartes, god) values (p, ids, god);

  perform bump_quests(p, 'packs', 1);
  perform bump_quests(p, 'new_cards', nouvelles);
  perform bump_quests(p, 'rarity_R', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('R','E','L')));
  perform bump_quests(p, 'rarity_E', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('E','L')));
  perform bump_quests(p, 'rarity_L', (select count(*)::int from cards
                                      where id = any(ids) and rar = 'L'));
  -- Version 2.0 : les Reverses Rares sorties.
  perform bump_quests(p, 'rev_R', (select count(*)::int from cards
                                   where id = any(ids) and reverse and rar = 'R'));
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
  -- Une quete d'evenement (21_reflets.sql) ne s'encaisse que pendant qu'il dure.
  if q.evenement is not null and q.evenement is distinct from evenement_en_cours() then
    raise exception 'Cet événement est terminé.';
  end if;

  pk := period_key(q.scope);
  select progress, claimed into prog, deja
    from quest_progress where user_id = p and quest_id = q.id and period_key = pk for update;

  if deja then raise exception 'Récompense déjà récupérée.'; end if;
  if coalesce(prog, 0) < q.goal then raise exception 'Quête non terminée.'; end if;

  update quest_progress set claimed = true
    where user_id = p and quest_id = q.id and period_key = pk;

  if q.reward > 0 and q.monnaie = 'prismes' then
    perform crediter_prismes(p, q.evenement, q.reward);
  elsif q.reward > 0 then
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
  -- Un article d'evenement (21_reflets.sql) ne se vend que pendant qu'il dure.
  if it.evenement is not null and it.evenement is distinct from evenement_en_cours() then
    raise exception 'Cet événement est terminé.';
  end if;

  select * into pr from profiles where id = p for update;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possèdes déjà cet article.';
  end if;
  -- `limite` : combien de fois un joueur peut l'acheter. Le compte est tenu
  -- dans l'inventaire, sous l'identifiant de l'article.
  if it.limite is not null and coalesce((select qty from inventory
                                          where user_id = p and item_id = it.id), 0) >= it.limite then
    raise exception 'Tu as atteint la limite pour cet article.';
  end if;

  -- La devise (version 2.0) : Eclats, Fragments, ou Prismes de l'evenement.
  if it.devise = 'fragments' then
    if pr.fragments < it.prix then raise exception 'Pas assez de Fragments.'; end if;
    update profiles set fragments = fragments - it.prix where id = p;
  elsif it.devise = 'prismes' then
    update evt_comptes set solde = solde - it.prix
     where user_id = p and evenement = it.evenement and solde >= it.prix;
    if not found then raise exception 'Pas assez de Prismes.'; end if;
  else
    if pr.shards < it.prix then raise exception 'Pas assez d''Éclats.'; end if;
    update profiles set shards = shards - it.prix where id = p;
  end if;
  if it.limite is not null and not it.unique_buy then
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  if it.effet = 'tickets' then
    -- Les boosters achetes ne vont pas dans la reserve : ils s'ouvrent a part
    -- (open_pack(true)), sans toucher a son compte a rebours.
    update profiles set boosters_bonus = boosters_bonus + it.montant where id = p;
  elsif it.effet = 'refill' then
    update profiles set tickets = greatest(tickets, cfg('ticket_cap')), last_tick = now() where id = p;
  elsif it.effet = 'trade_token' then
    insert into inventory (user_id, item_id, qty) values (p, 'trade_token', it.montant)
      on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty;
  elsif it.effet = 'invitation' then
    perform creer_invitation(p);
  elsif it.effet in ('fragments', 'reverse_R') then
    perform accorder(p, it.effet, it.montant, null);
  elsif it.effet = 'carte' then
    -- Une carte achetee entre dans la collection comme n'importe quelle autre.
    -- Elle est marquee `unique_buy` en boutique : on ne l'achete qu'une fois.
    if it.carte_id is null then raise exception 'Article mal configuré.'; end if;
    insert into collection (user_id, card_id, qty) values (p, it.carte_id, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else -- cosmetique : un cadre (f_…) ou un titre (t_…), sous son identifiant
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
  ro text; rw text; jeton int; gratuit boolean; tid uuid;
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
  -- Tout ce qui est hors extension — Promos, Essences Brillantes, carte
  -- unique — reste a qui l'a obtenu. Les Reverses, elles, s'echangent : contre
  -- une Reverse de meme rarete.
  if exists (select 1 from cards where id in (p_offer, p_want) and promo and not reverse) then
    raise exception 'Cette carte ne s''échange pas.';
  end if;
  if (select count(distinct reverse) from cards where id in (p_offer, p_want)) > 1 then
    raise exception 'Une Reverse s''échange contre une Reverse.';
  end if;

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
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140), not gratuit)
  returning id into tid;

  -- Dans la boite du destinataire (supabase/11_boite.sql). Les deux cartes
  -- voyagent avec l'evenement : la boite les montre sans autre appel.
  perform notifier(dest.id, 'echange_recu', p, tid::text,
                   jsonb_build_object('offer', p_offer, 'want', p_want));

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
    perform notifier(t.from_user, 'echange_refuse', p, t.id::text,
                     jsonb_build_object('offer', t.offer_card, 'want', t.want_card));
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
  perform notifier(t.from_user, 'echange_accepte', p, t.id::text,
                   jsonb_build_object('offer', t.offer_card, 'want', t.want_card));

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
  -- Un compte qui n'a pas acces au jeu (01_schema.sql) n'est pas trouvable.
  if not found or not (beta_ouverte() or est_invite(r.id)) then return 'null'::jsonb; end if;
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

-- ------------------------------------------- les Essences Brillantes
-- La version brillante de chacune des Essences : meme carte, autre finition.
-- `b` + le numero de l'Essence (c001 -> b001). Hors extension (promo = true) :
-- jamais dans le total de 122, jamais echangeables, jamais recyclees ni
-- fabriquees. Elles ne sortent que de la case Essence d'un booster, une fois
-- sur cfg('foil_odds') (voir open_pack, 03_rpc.sql).
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo)
select 'b' || substr(k.id, 2), k.num, k.nom || ' Brillante', k.cat, k.col, 'BR', false, true
  from public.cards k
 where k.cat = 'essence' and not k.promo and k.id like 'c%'
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- ------------------------------------------------------- les Reverses
-- Version 2.0. Chaque Commune, Peu commune et Rare de l'extension a sa Reverse :
-- `r` + son numero (c010 -> r010), meme rarete, frappee du logo Tout Commence
-- Ici. 33 + 24 + 28 = 85. Hors des 122 (promo), mais echangeables,
-- recyclables et fabricables (reverse) — voir 01_schema.sql. Elles sortent
-- de la 4e case d'un booster (open_pack, 03_rpc.sql).
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo, reverse)
select 'r' || substr(k.id, 2), k.num, k.nom, k.cat, k.col, k.rar, false, true, true
  from public.cards k
 where k.rar in ('C', 'PC', 'R') and not k.promo and k.id like 'c%'
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo,
  reverse = excluded.reverse;

-- ------------------------------------------------- la carte unique
-- Un seul exemplaire dans tout le jeu : celui ou celle qui la tire la garde.
-- C'est la chasse (15_evenements.sql) qui la distribue, une seule fois.
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo) values
  ('u01', 1, 'L''Unique Chevalière', 'objet', 'neutre', 'UN', false, true)
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
revoke all on function public.check_promos from public, anon, authenticated;

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
--  six mille Eclats en meme temps.
--
--  ------------------------------------------------------------------
--  Les raretes completes.
--
--  Une quete par rarete : posseder toutes ses cartes. En mediane de
--  simulation (six boosters par jour, sans echange) :
--      Essences (9) ............   23 boosters  (~4 jours) ......   100
--      Communes (33) ...........   50 boosters  (~8 jours) ......   250
--      Peu communes (24) .......   61 boosters  (~10 jours) .....   350
--      Rares (28) ..............  128 boosters  (~3 semaines) ...  1 200
--      Epiques (18) ............  366 boosters  (~2 mois) .......  3 000
--      Legendaires (10) ........  670 boosters  (~110 jours) ....  6 000
--  Les montants montent avec la duree : peu pour ce qui tombe la premiere
--  semaine (voir « Les Eclats » plus bas), beaucoup pour les deux
--  dernieres raretes, qui demandent des mois. Les Legendaires
--  se completent a peu pres en meme temps que le Master Set, qui donne la
--  carte Promo P05 : les deux recompenses tombent donc presque ensemble.
--
--  L'objectif de chaque quete est calcule sur le catalogue (`count(*)` plus
--  bas) : ajouter une carte a l'extension deplace l'objectif tout seul.
--
--  ------------------------------------------------------------------
--  Les Eclats.
--
--  Depuis la version 1.5, les quetes sont la SEULE source d'Eclats : le
--  recyclage donne des Fragments (12_recyclage.sql). Avant, il rapportait
--  jusqu'a 2 500 Eclats par semaine a un joueur avance ; sans lui, un
--  joueur regulier tombait a ~275 par jour. Les quetes recurrentes
--  (quotidiennes, hebdomadaires) ont donc ete relevees, et les premiers
--  paliers baisses : c'etaient eux qui offraient a un nouveau venu un x10
--  en cinq jours et une Promo en sept.
--
--  Simulation (mediane, sans echange, tous les doublons recycles), Eclats
--  par jour une fois les paliers passes, et jour ou l'on atteint un total :
--                                    par jour    3 000 (x10)   5 000 (Promo)
--      regulier, 6 boosters/jour
--        nouveau venu ..............    ~340      7e jour       10e jour
--        joueur avance .............    ~340     10e jour       14e jour
--      occasionnel, 4/jour 5 j sur 7
--        nouveau venu ..............    ~160     11e jour       21e jour
--        joueur avance .............    ~155     21e jour       31e jour
--  (avant : ~275 par jour pour un regulier avance, et un nouveau venu a
--  3 000 le 5e jour, 5 000 le 7e.)
--
--  Ce que ca achete, pour un regulier avance :
--      x1 booster (350) ...............  un jour
--      x10 boosters (3 000) ...........  neuf a dix jours
--      un cadre (1 200 a 5 000) .......  de quatre a quinze jours
--      une carte Promo (5 000) ........  quinze jours
--  Tout depenser en boosters ajoute ~1,1 booster par jour aux six de la
--  reserve (+18 %) : les Eclats aident, ils ne remplacent pas le temps.
--
--  « Petit menage » (recycler 5 doublons) est la quete quotidienne de fin de
--  collection : « Du sang neuf » devient impossible quand il ne manque plus
--  rien, celle-ci reste faisable tant qu'on tire des doublons.
-- =====================================================================

-- Une quete peut accorder un objet en plus — ou a la place — des Eclats :
-- un cadre, une carte. C'est ce qui permet a un palier de payer autrement
-- qu'en monnaie.
alter table public.quests add column if not exists item_id text;

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | recycle | collection_pct | set_ES … set_L
--          (tous mesures cote serveur)
--
-- Les objectifs quotidiens sont calibres sur six boosters par jour. A ce
-- rythme, « une Epique » tombe environ trois jours sur quatre (20 % de
-- chances par paquet, six paquets) — assez souvent pour ne pas decourager,
-- assez rarement pour valoir quelque chose.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   30, null, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
  ('d_epic',    'daily',     'rarity_E',       1,   80, null, 'Au moins une Épique',  'Décroche une Épique ou une Légendaire.', 3),
  ('d_new',     'daily',     'new_cards',      3,   30, null, 'Du sang neuf',         'Trouve 3 cartes que tu n''avais pas.', 4),
  ('d_recycle', 'daily',     'recycle',        5,   30, null, 'Petit ménage',         'Recycle 5 doublons.', 5),
  ('d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un échange avec un autre joueur.', 6),

  -- Trente boosters sur les quarante-deux qu'une semaine complete rapporte :
  -- on peut sauter deux jours et finir quand meme.
  ('w_check',   'weekly',    'checkin',        5,  200, null, 'Habitué de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         30,  250, null, 'Ouvreur en série',     'Ouvre 30 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     15,  150, null, 'Chasseur de vides',    'Trouve 15 cartes inédites.', 3),
  -- Huit et non dix : la derniere carte du paquet donne desormais une Epique
  -- ou mieux une fois sur cinq, contre pres d'une sur trois avant. A dix, la
  -- quete passait de huit semaines sur dix a une sur trois — un objectif qu'on
  -- rate sans avoir rien fait de mal n'apprend rien a personne.
  ('w_epic',    'weekly',    'rarity_E',       8,  350, null, 'Huit Épiques',         'Décroche 8 Épiques ou mieux.', 4),
  ('w_legend',  'weekly',    'rarity_L',       1,  450, null, 'Une Légendaire',       'Sors une Légendaire cette semaine.', 5),
  ('w_trade',   'weekly',    'trades',         5,  350, null, 'Le marché',            'Conclus 5 échanges.', 6),

  -- Saisonnieres : une seule fois, pour toujours.
  ('m_legend',  'milestone', 'rarity_L',       1,  200, null, 'Première Légendaire',  'Sors ta toute première Légendaire d''un booster.', 1),

  -- Les paliers de collection. Ceux qui donnent une Promo ne donnent rien d'autre.
  ('m_col25',   'milestone', 'collection_pct', 25,  100, null,  'Un quart du chemin', 'Possède 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct', 50,  250, null,  'La moitié',          'Possède 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possède 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Tout Commence Ici',  'Possède les 122 cartes de l''extension.', 5),

  -- Les raretes completes : toutes les cartes d'une rarete. L'objectif est le
  -- nombre de cartes de cette rarete dans le catalogue.
  ('m_setES',   'milestone', 'set_ES', (select count(*)::int from public.cards where rar = 'ES' and not promo),
                                               100, null,      'Toutes les Essences',     'Possède toutes les Essences de l''extension.', 6),
  ('m_setC',    'milestone', 'set_C',  (select count(*)::int from public.cards where rar = 'C'  and not promo),
                                               250, null,      'Toutes les Communes',     'Possède toutes les Communes de l''extension.', 7),
  ('m_setPC',   'milestone', 'set_PC', (select count(*)::int from public.cards where rar = 'PC' and not promo),
                                               350, null,      'Toutes les Peu communes', 'Possède toutes les Peu communes de l''extension.', 8),
  ('m_setR',    'milestone', 'set_R',  (select count(*)::int from public.cards where rar = 'R'  and not promo),
                                              1200, null,      'Toutes les Rares',        'Possède toutes les Rares de l''extension.', 9),
  ('m_setE',    'milestone', 'set_E',  (select count(*)::int from public.cards where rar = 'E'  and not promo),
                                              3000, null,      'Toutes les Épiques',      'Possède toutes les Épiques de l''extension.', 10),
  ('m_setL',    'milestone', 'set_L',  (select count(*)::int from public.cards where rar = 'L'  and not promo),
                                              6000, null,      'Toutes les Légendaires',  'Possède toutes les Légendaires de l''extension.', 11),

  -- Les paliers de boosters ouverts : la seule progression qui ne depende que
  -- du temps passe, et pas de la chance.
  ('m_packs25', 'milestone', 'packs',          25,  150, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 12),
  ('m_packs50', 'milestone', 'packs',          50,  300, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 13),
  ('m_packs100','milestone', 'packs',         100,  800, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 14),
  ('m_packs200','milestone', 'packs',         200, 2000, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 15),

  ('m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 16),

  -- ---------------------------------------------------------- version 2.0
  -- Les Reverses (03b_promos.sql) : une Rare reverse par jour et cinq par
  -- semaine (15 % par booster : ~62 % des jours, ~65 % des semaines), et les
  -- Reverses completes par rarete. Pour ne pas gonfler les Eclats, le passage
  -- du jour et les cinq paquets baissent de 10 chacun : +~28 Eclats par jour
  -- pour un regulier, ~370 au lieu de ~340.
  ('d_revR',    'daily',     'rev_R',          1,   40, null, 'Reflet rare',          'Décroche une Reverse Rare.', 7),
  ('w_revR',    'weekly',    'rev_R',          5,  250, null, 'Cinq reflets',         'Décroche 5 Reverses Rares cette semaine.', 7),
  ('m_revC',    'milestone', 'rset_C',  (select count(*)::int from public.cards where reverse and rar = 'C'),
                                               400, null,      'Reverses Communes',       'Possède toutes les Reverses Communes.', 17),
  ('m_revPC',   'milestone', 'rset_PC', (select count(*)::int from public.cards where reverse and rar = 'PC'),
                                               700, null,      'Reverses Peu communes',   'Possède toutes les Reverses Peu communes.', 18),
  ('m_revR',    'milestone', 'rset_R',  (select count(*)::int from public.cards where reverse and rar = 'R'),
                                              2500, null,      'Reverses Rares',          'Possède toutes les Reverses Rares.', 19),
  -- Les cadres et titres gagnes en jouant (js/config.js : FRAMES, TITRES).
  ('m_revALL',  'milestone', 'rset_ALL',(select count(*)::int from public.cards where reverse),
                                                 0, 'f_reflet', 'Le Reflet complet',     'Possède les 85 Reverses.', 20),
  ('m_master',  'milestone', 'collection_pct',100,  0, 'f_master', 'Maître de l''extension', 'Possède les 122 cartes de l''extension.', 21),
  ('m_brill',   'milestone', 'brill_ALL', 9,           0, 'f_aurore', 'Aurore',               'Possède les 9 Essences Brillantes.', 22),
  ('m_packs300','milestone', 'packs',     300,         0, 'f_sceau',  'Trois cents paquets',  'Ouvre 300 boosters en tout.', 23),
  ('m_illu10',  'milestone', 'illu',       10,         0, 't_devin',  'Le Devin',             'Trouve 10 illustrations à Devine l''illu.', 24),
  ('m_invite',  'milestone', 'invite',      1,         0, 't_hote',   'L''Hôte',              'Un ami entre dans le jeu avec ton invitation.', 25)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_epic','d_new','d_recycle','d_trade',
  'w_check','w_packs','w_new','w_epic','w_legend','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100',
  'm_setES','m_setC','m_setPC','m_setR','m_setE','m_setL',
  'm_packs25','m_packs50','m_packs100','m_packs200',
  'm_trade25',
  'd_revR','w_revR','m_revC','m_revPC','m_revR','m_revALL','m_master','m_brill','m_packs300','m_illu10','m_invite',
  'e_check','e_packs','e_illu','e_revR','e_titre','e_perso','e_revC','e_rev30','e_trade','e_illu7','e_packs50',
  'e_recycle','e_invite');

-- ------------------------------------------------- l'evenement « Reflets »
-- Ses quetes paient en Prismes (21_reflets.sql). Du jour : 50 Prismes pour
-- qui les fait toutes, plus ce que rapporte Devine l'illu (6 a 25). De
-- l'evenement, une fois : 380. Elles portent sur les nouveautes de la 2.0 —
-- c'est le role de l'evenement de les faire essayer. Le calcul du Pass est
-- en tete de son tableau, dans 21_reflets.sql.
-- Objectifs tenables en deux semaines : 6 boosters par jour donnent ~42
-- Reverses Communes en 14 jours, ~25 differentes — d'ou 20, pas « toutes ».
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie) values
  ('e_check',   'ev_jour', 'ev_visite',   1, 10, null, 'Un reflet par jour',     'Passe voir l''événement aujourd''hui.', 1, 'reflets', 'prismes'),
  ('e_packs',   'ev_jour', 'packs',     4, 15, null, 'Quatre boosters',        'Ouvre 4 boosters aujourd''hui.', 2, 'reflets', 'prismes'),
  ('e_illu',    'ev_jour', 'illu',      1, 10, null, 'L''illu du jour',        'Trouve l''illustration du jour.', 3, 'reflets', 'prismes'),
  ('e_revR',    'ev_jour', 'rev_R',     1, 15, null, 'Reflet rare',            'Décroche une Reverse Rare.', 4, 'reflets', 'prismes'),
  ('e_titre',   'ev',      'titre',     1, 20, null, 'Un titre à ton nom',     'Équipe un titre sur ton profil.', 1, 'reflets', 'prismes'),
  ('e_perso',   'ev',      'perso',     1, 20, null, 'À ton image',            'Choisis une bannière ou une devise.', 2, 'reflets', 'prismes'),
  ('e_rev30',   'ev',      'rset_ALL', 30, 50, null, 'Trente reflets',         'Possède 30 Reverses différentes.', 3, 'reflets', 'prismes'),
  ('e_revC',    'ev',      'rset_C',   20, 60, null, 'Vingt Communes reverses', 'Possède 20 Reverses Communes différentes.', 4, 'reflets', 'prismes'),
  ('e_illu7',   'ev',      'illu',      7, 60, null, 'L''œil affûté',          'Trouve 7 illustrations pendant l''événement.', 5, 'reflets', 'prismes'),
  ('e_packs50', 'ev',      'packs',    50, 50, null, 'Cinquante boosters',     'Ouvre 50 boosters pendant l''événement.', 6, 'reflets', 'prismes'),
  ('e_trade',   'ev',      'trades',    3, 40, null, 'Échanges de reflets',    'Conclus 3 échanges.', 7, 'reflets', 'prismes'),
  ('e_recycle', 'ev',      'recycle',  30, 30, null, 'Grand ménage',           'Recycle 30 doublons.', 8, 'reflets', 'prismes'),
  ('e_invite',  'ev',      'invite',    1, 50, null, 'Un ami de plus',         'Un ami entre dans le jeu avec ton invitation.', 9, 'reflets', 'prismes')
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id, titre = excluded.titre,
  detail = excluded.detail, ordre = excluded.ordre, evenement = excluded.evenement,
  monnaie = excluded.monnaie;

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique | carte
--
-- Les intitules commencent par la quantite : « x5 Boosters » se lit d'un
-- coup d'oeil la ou « Cinq boosters » demande une lecture. C'est une liste
-- qu'on parcourt, pas un catalogue qu'on epluche.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'x1 Booster',   'Un booster à ouvrir tout de suite, sans toucher à ta réserve.', 350, 'tickets',  1, null, false, 1),
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
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un anneau de cristal taillé, et son éclat qui scintille.',  5000, 'cosmetique', 1, null, true, 4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

-- Le Cadre Sceau ne se vend pas, et aucune quete ne le donne pour l'instant
-- (voir FRAMES dans js/config.js). On le retire de la boutique s'il y
-- trainait.
-- Version 2.0 : l'invitation, payee en Fragments (21_reflets.sql), et la
-- boutique de l'evenement « Reflets », payee en Prismes.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite) values
  ('s_invite',     'invitation', 'Invitation', 'Un code pour faire entrer un ami. Il reçoit 10 boosters et 1 000 Éclats de bienvenue.',
                                                                                               2000, 'invitation', 1, null, false, 1, 'fragments', null, 3),
  -- Un joueur assidu gagne ~1 100 Prismes sur l'evenement : la boutique en
  -- coute ~1 300, il faut choisir.
  ('ev_boosters',  'evenement', 'x2 Boosters',       'Deux boosters à ouvrir tout de suite.',     70, 'tickets',    2, null, false, 1, 'prismes', 'reflets', 5),
  ('ev_fragments', 'evenement', '500 Fragments',     'De quoi fabriquer les cartes qui manquent.', 60, 'fragments', 500, null, false, 2, 'prismes', 'reflets', 5),
  ('ev_reverse',   'evenement', 'Une Reverse Rare',  'Une Reverse Rare que tu n''as pas encore.', 150, 'reverse_R',  1, null, false, 3, 'prismes', 'reflets', 3),
  ('t_collect',    'evenement', 'Titre « Collectionneur de Reflets »', 'Un titre qui ne se vendra plus après l''événement.',
                                                                                                200, 'cosmetique', 1, null, true, 4, 'prismes', 'reflets', null)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy, ordre = excluded.ordre,
  devise = excluded.devise, evenement = excluded.evenement, limite = excluded.limite, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme',
  's_invite','ev_boosters','ev_fragments','ev_reverse','t_collect');


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
--
-- Elle lit aussi la boite de reception et le recyclage, dont les fonctions
-- sont creees plus loin (11_boite.sql, 12_recyclage.sql). PL/pgSQL resout les
-- appels a l'execution : a la fin de TOUT.sql, tout est la.
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
      'fragments', pr.fragments,
      -- Les boosters en plus (boutique, cadeaux), hors reserve.
      'boosters_bonus', pr.boosters_bonus, 'bonus_offerts', pr.tickets_offerts,
      -- Version 2.0 (21_reflets.sql) : le titre, la banniere, la devise, et
      -- les titres debloques.
      'titre', pr.titre, 'banniere', pr.banniere, 'devise', pr.devise,
      'titres', to_jsonb(titres_de(p)),
      -- La seule fonction qui reponde a un compte non invite : c'est elle qui
      -- permet au navigateur d'afficher « tu n'es pas sur la liste » au lieu
      -- d'une erreur muette. Toutes les autres refusent (garde_beta).
      'invite', (beta_ouverte() or est_invite(p)),
      -- Le rythme en cours : plus court pendant un evenement (minutes_recharge,
      -- 15_evenements.sql). Le compte a rebours du navigateur suit celui-ci.
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', minutes_recharge(),
      'serveur', now()),
    -- La pastille de la boite de reception (supabase/11_boite.sql).
    'boite', boite_non_lues(p),
    -- Le recyclage et la fabrication (supabase/12_recyclage.sql) : ce que
    -- rapporte chaque rarete en Fragments, et ce que coute une carte. Les
    -- montants partent d'ici pour que le navigateur n'en garde pas une copie
    -- qui finirait par mentir.
    'recyclage', jsonb_build_object(
      'valeurs', jsonb_build_object(
        'ES', cfg('recyclage_ES'), 'C', cfg('recyclage_C'), 'PC', cfg('recyclage_PC'),
        'R', cfg('recyclage_R'), 'E', cfg('recyclage_E'), 'L', cfg('recyclage_L')),
      'couts', jsonb_build_object(
        'ES', cfg('fabrication_ES'), 'C', cfg('fabrication_C'), 'PC', cfg('fabrication_PC'),
        'R', cfg('fabrication_R'), 'E', cfg('fabrication_E'), 'L', cfg('fabrication_L'))),
    -- Les succes, l'evenement en cours et la chasse (15_evenements.sql).
    'succes', succes_de(p),
    'evenement', evenement_actif(),
    'chasse', chasse_etat(),
    -- Version 2.0 : les reglages ouverts a la main, le solde de Prismes de
    -- l'evenement en cours, et les invitations achetees.
    'parametres', (select jsonb_build_object('fabrication_reverse', fabrication_reverse)
                     from parametres where id = 1),
    'prismes', coalesce((select solde from evt_comptes
                          where user_id = p and evenement = evenement_en_cours()), 0),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'cree_le', i.cree_le,
                                          'utilise_par', (select pseudo from profiles where id = i.utilise_par),
                                          'utilise_le', i.utilise_le) order by i.cree_le)
        from invitations i where i.auteur = p), '[]'::jsonb),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'item', q.item_id, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false),
        'monnaie', q.monnaie, 'evenement', q.evenement) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
      -- Les quetes d'un evenement n'existent que pendant qu'il dure.
      where q.evenement is null or q.evenement = evenement_en_cours()
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------- la vitrine sur la fiche publique
-- La vitrine est visible de tous : c'est fait pour etre montre.
create or replace function public.player_profile(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int; rev int; rev_total int;
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
  -- Version 2.0 : les Reverses, comptees a part.
  select count(*) into rev_total from cards where reverse;
  select count(*) into rev
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and k.reverse;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'reverses', rev, 'reverses_total', rev_total,
    'titre', o.titre, 'banniere', o.banniere, 'devise', o.devise,
    'vitrine', to_jsonb(o.vitrine),
    'succes', succes_de(o.id),
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end);
end $$;

grant execute on function public.me, public.player_profile to authenticated;


-- #####################################################################
-- ###  11_boite.sql
-- ###  La boite de reception : notifications et annonces
-- #####################################################################

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


-- #####################################################################
-- ###  12_recyclage.sql
-- ###  Le recyclage des doublons contre des Fragments, et la fabrication
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — le recyclage des doublons, et la fabrication
--  A executer apres 11_boite.sql. Rejouable sans danger.
--
--  On jette un doublon, on touche des Fragments. Avec des Fragments, on
--  fabrique une carte qui manque. Toutes les raretes de l'extension se
--  recyclent et se fabriquent ; jamais ce qui est hors extension (Promos,
--  Essences Brillantes, carte unique). On garde toujours au moins un
--  exemplaire de chaque carte : recycler ne fait jamais reculer la
--  collection.
--
--  Les montants sont dans cfg() (supabase/01_schema.sql) :
--      recyclage    Essence 1 · Commune 2 · Peu commune 5 · Rare 20
--                   Epique 80 · Legendaire 250
--      fabrication  Essence 20 · Commune 40 · Peu commune 100 · Rare 400
--                   Epique 2 000 · Legendaire 8 000
--
--  ------------------------------------------------------------------
--  POURQUOI DES FRAGMENTS, ET PLUS D'ECLATS
--
--  Recycler contre des Eclats posait un probleme sans solution : un joueur
--  regulier produit ~6 300 Eclats de doublons par semaine une fois sa
--  collection avancee. Plafonne, le recyclage ne permettait pas de se
--  debarrasser de ses cartes ; deplafonne, il triplait les Eclats, et les
--  Eclats achetent des boosters — la boucle s'emballait.
--
--  Les Fragments n'achetent qu'une chose : une carte qu'on n'a pas. Ils ne
--  rachetent pas de boosters, il n'y a donc plus de boucle, et plus de
--  plafond. Ils transforment aussi la fin de collection : la derniere
--  Legendaire mettait ~42 jours a sortir en moyenne, sans le moindre progres
--  visible ; chaque booster rempli de doublons la rapproche desormais.
--
--  Simulation (six boosters par jour, tous les doublons recycles), mediane
--  du temps pour finir l'extension :
--                               sans fabrication   avec   (quart le plus lent)
--      joueur a  60 boosters ....   112 jours      72 j      147 -> 86 j
--      joueur a 120 boosters ....    92 jours      62 j      124 -> 73 j
--  ~2 200 Fragments par semaine pour un joueur regulier : une Epique tous
--  les six jours, ou une Legendaire en un peu moins de quatre semaines.
-- =====================================================================

-- Le journal : qui a recycle quoi, et quand. Il sert a retrouver ce qui
-- s'est passe si quelqu'un ecrit « j'ai perdu une carte ». `eclats` date de
-- l'ancien recyclage ; les recyclages d'aujourd'hui y mettent 0 et remplissent
-- `fragments`.
create table if not exists public.recyclages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  card_id    text not null references public.cards on delete cascade,
  qty        integer not null check (qty > 0),
  eclats     integer not null check (eclats >= 0),
  created_at timestamptz not null default now()
);
alter table public.recyclages add column if not exists fragments integer not null default 0;
create index if not exists recyclages_user_idx on public.recyclages (user_id, created_at desc);

alter table public.recyclages enable row level security;
-- Aucune policy : le navigateur ne lit pas le journal.
revoke all on public.recyclages from anon, authenticated;

-- Le lundi minuit, heure de Paris : la meme frontiere que les quetes
-- hebdomadaires (period_key dans 01_schema.sql).
create or replace function public.debut_semaine() returns timestamptz
language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

-- Les Eclats touches cette semaine avec l'ancien recyclage. Plus rien ne
-- l'appelle ; elle reste pour qui voudrait relire le journal.
create or replace function public.recyclage_semaine(p uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(eclats), 0)::int from recyclages
   where user_id = p and created_at >= debut_semaine();
$$;

revoke all on function public.recyclage_semaine from public, anon, authenticated;

-- ------------------------------------------------------------- recycler
-- `p_lots` : [{ "carte": "c012", "n": 2 }, …]. Tout passe, ou rien : un seul
-- lot refuse annule l'ensemble.
--
-- Ce qui est recyclable, carte par carte : ce qu'on possede, moins l'exemplaire
-- qu'on garde toujours, moins ceux qu'on a proposes dans une demande
-- d'echange encore en attente — sinon l'echange, une fois accepte, prendrait
-- le dernier exemplaire et ferait reculer la collection.
create or replace function public.recycler(p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); lot jsonb; cid text; n int; k cards;
  possede int; reserve int; prix int; total int := 0; nb int := 0; vus text[] := '{}';
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_lots is null or jsonb_typeof(p_lots) <> 'array' or jsonb_array_length(p_lots) = 0 then
    raise exception 'Rien à recycler.';
  end if;
  if jsonb_array_length(p_lots) > 150 then raise exception 'Trop de cartes d''un coup.'; end if;

  -- Un recyclage a la fois par joueur : deux envois partis ensemble ne
  -- doivent pas compter deux fois le meme exemplaire.
  perform 1 from profiles where id = p for update;

  for lot in select value from jsonb_array_elements(p_lots) loop
    cid := lot->>'carte';
    if jsonb_typeof(lot->'n') <> 'number' then raise exception 'Quantité invalide.'; end if;
    n := (lot->>'n')::int;
    if cid is null or n < 1 then raise exception 'Quantité invalide.'; end if;
    if cid = any(vus) then raise exception 'Une carte apparaît deux fois.'; end if;
    vus := vus || cid;

    select * into k from cards where id = cid;
    if not found then raise exception 'Carte inconnue.'; end if;
    if k.promo and not k.reverse then raise exception 'Cette carte ne se recycle pas.'; end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    if coalesce(possede, 0) - 1 - reserve < n then
      raise exception 'Pas assez de doublons de « % » : tu gardes toujours un exemplaire.', k.nom;
    end if;

    update collection set qty = qty - n where user_id = p and card_id = cid;
    insert into recyclages (user_id, card_id, qty, eclats, fragments) values (p, cid, n, 0, n * prix);
    total := total + n * prix;
    nb := nb + n;
  end loop;

  update profiles set fragments = fragments + total where id = p;
  -- La quete quotidienne « Petit menage » (04_seed.sql) compte les cartes.
  perform bump_quests(p, 'recycle', nb);
  return me();
end $$;

-- ------------------------------------------------------------- fabriquer
-- Une carte de l'extension qu'on ne possede pas, contre des Fragments.
-- Seulement une carte qui manque : fabriquer un doublon pour le recycler ne
-- rapporterait rien, mais fabriquer une Legendaire qu'on a deja ne sert a
-- rien non plus, et c'est ce qui garde les doublons de haute rarete rares.
create or replace function public.fabriquer(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; cout int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo and not k.reverse then raise exception 'Cette carte ne se fabrique pas.'; end if;
  cout := cfg('fabrication_' || k.rar);
  -- Les Reverses (version 2.0) : le double, et seulement une fois la
  -- fabrication ouverte (parametres, 21_reflets.sql) — fermee au lancement,
  -- sinon les Fragments accumules rempliraient la collection Reverse d'un coup.
  if k.reverse then
    if not coalesce((select fabrication_reverse from parametres where id = 1), false) then
      raise exception 'La fabrication des Reverses n''est pas encore ouverte.';
    end if;
    cout := cout * 2;
  end if;
  if cout is null then raise exception 'Cette carte ne se fabrique pas.'; end if;

  select fragments into reste from profiles where id = p for update;
  if exists (select 1 from collection where user_id = p and card_id = p_carte and qty > 0) then
    raise exception 'Tu possèdes déjà cette carte.';
  end if;
  if reste < cout then raise exception 'Pas assez de Fragments.'; end if;

  update profiles set fragments = fragments - cout, fabrications = fabrications + 1 where id = p;
  insert into collection (user_id, card_id, qty) values (p, p_carte, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

revoke all on function public.recycler, public.fabriquer from public, anon;
grant execute on function public.recycler, public.fabriquer to authenticated;


-- #####################################################################
-- ###  14_classement.sql
-- ###  Le classement global des joueurs
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — le classement
--  A executer apres 12_recyclage.sql. Rejouable sans danger.
--
--  Un classement global : tous les joueurs, pas seulement les amis. Quatre
--  criteres, un seul appel par critere :
--    · collection : cartes differentes de l'extension (Promos exclues, comme
--                   partout ailleurs : le total reste 122) ;
--    · boosters   : boosters ouverts depuis le debut ;
--    · echanges   : echanges conclus ;
--    · serie      : jours de connexion d'affilee, en cours. Une serie dont le
--                   dernier jour est avant-hier ou plus ancien est rompue : elle
--                   compte zero, meme si le chiffre dort encore dans le profil.
--
--  Ce qui est montre d'un joueur ne va pas au-dela de ce que le jeu montrait
--  deja a n'importe qui (find_player, player_profile) : pseudo, avatar, cadre,
--  et le chiffre du critere. Jamais les Eclats, jamais le drapeau admin.
--
--  Tant que le jeu est ferme au public, seuls les comptes invites sont
--  classes : un compte cree pendant une ouverture, puis ferme, ne peut plus
--  jouer, il n'a rien a faire dans la liste.
--
--  Les ex aequo partagent leur rang (rank()) : deux joueurs a 87 cartes sont
--  tous les deux 3e, et le suivant est 5e. Un joueur a zero n'est pas classe.
-- =====================================================================

create or replace function public.classement(p_critere text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  auj date := (now() at time zone 'Europe/Paris')::date;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_critere is null or p_critere not in ('collection', 'reverses', 'boosters', 'echanges', 'serie') then
    raise exception 'Classement inconnu.';
  end if;

  return (
    with valeurs as (
      select pr.id, pr.pseudo, pr.avatar, pr.frame, pr.titre,
             (case p_critere
                when 'collection' then (select count(*) from collection c join cards k on k.id = c.card_id
                                         where c.user_id = pr.id and c.qty > 0 and not k.promo)
                -- Version 2.0 : les Reverses differentes.
                when 'reverses'   then (select count(*) from collection c join cards k on k.id = c.card_id
                                         where c.user_id = pr.id and c.qty > 0 and k.reverse)
                when 'boosters'   then pr.packs_opened
                when 'echanges'   then pr.trades_done
                else case when pr.last_checkin >= auj - 1 then pr.streak else 0 end
              end)::int as valeur
        from profiles pr
       where beta_ouverte() or est_invite(pr.id)
    ),
    classes as (
      select v.*,
             rank()       over (order by v.valeur desc)                   as rang,
             row_number() over (order by v.valeur desc, lower(v.pseudo))  as n
        from valeurs v
       where v.valeur > 0
    )
    select jsonb_build_object(
      'critere', p_critere,
      'classes', (select count(*) from classes),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rang', c.rang, 'pseudo', c.pseudo, 'avatar', c.avatar, 'frame', c.frame, 'titre', c.titre,
                 'photo', photo_discord(c.id), 'valeur', c.valeur, 'moi', c.id = moi)
               order by c.n)
          from classes c where c.n <= 50), '[]'::jsonb),
      -- Sa propre ligne, meme hors des cinquante premiers : on veut savoir ou
      -- l'on en est, pas seulement qui est devant.
      'moi', (select jsonb_build_object(
                'rang', c.rang, 'pseudo', c.pseudo, 'avatar', c.avatar, 'frame', c.frame, 'titre', c.titre,
                'photo', photo_discord(c.id), 'valeur', c.valeur, 'moi', true)
                from classes c where c.id = moi))
  );
end $$;

revoke all on function public.classement from public, anon;
grant execute on function public.classement to authenticated;


-- #####################################################################
-- ###  15_evenements.sql
-- ###  Tirages, succes, evenements et chasse a la carte unique
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — tirages, succes, evenements et chasse
--  A executer apres 14_classement.sql. Rejouable sans danger.
--
--  Quatre choses, qui se tiennent :
--    · tirages   : le journal de chaque booster ouvert. Il nourrit
--                  l'historique et les statistiques du joueur (mes_tirages),
--                  et le succes « godpack ».
--    · succes    : des badges calcules a la volee a partir de ce que le
--                  serveur sait deja (succes_de). Rien a stocker, rien a
--                  synchroniser : un succes ne peut pas mentir.
--    · evenements: une periode, avec ce qu'elle change. Aujourd'hui, une
--                  seule chose : le rythme de recharge des boosters.
--    · chasse    : la carte unique. Une ligne, un gagnant, une seule fois.
-- =====================================================================

-- --------------------------------------------------------------- tirages
create table if not exists public.tirages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  cartes     text[] not null,
  god        boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tirages_user_idx on public.tirages (user_id, id desc);

alter table public.tirages enable row level security;
-- Aucune policy : le navigateur passe par mes_tirages().
revoke all on public.tirages from anon, authenticated;

-- ------------------------------------------------------------ evenements
-- `ticket_minutes` : la recharge pendant l'evenement (120 = boosters
-- doubles). Vide : l'evenement ne change pas le rythme.
create table if not exists public.evenements (
  id             bigint generated always as identity primary key,
  titre          text not null,
  texte          text not null default '',
  debut          timestamptz not null,
  fin            timestamptz not null,
  ticket_minutes integer check (ticket_minutes is null or ticket_minutes between 10 and 1440),
  constraint evenement_dans_l_ordre check (fin > debut)
);

-- Version 2.0 : le code d'un evenement relie ses quetes, sa boutique et sa
-- piste de recompenses (21_reflets.sql). Un evenement sans code ne change que
-- le rythme des boosters.
alter table public.evenements add column if not exists code text;

alter table public.evenements enable row level security;
revoke all on public.evenements from anon, authenticated;

-- -------------------------------------------------------------- chasse
-- Une seule ligne. `gagnant` vide : la carte est encore a trouver. La mise a
-- jour qui le remplit (open_pack, 03_rpc.sql) porte `where gagnant is null` :
-- c'est elle, et pas le navigateur, qui garantit qu'il n'y a qu'un gagnant.
create table if not exists public.chasse (
  id         int primary key check (id = 1),
  carte      text not null references public.cards,
  active     boolean not null default false,
  gagnant    uuid references public.profiles on delete set null,
  trouvee_le timestamptz
);
insert into public.chasse (id, carte, active) values (1, 'u01', false)
on conflict (id) do nothing;
-- L'heure d'ouverture : une chasse active ne commence qu'a cette heure-la.
-- Vide : des qu'elle est active. Elle permet de tout installer la veille.
alter table public.chasse add column if not exists ouvre_le timestamptz;

-- Celui qui a tire la carte unique a son cadre d'avatar, « Unique » : pose
-- par open_pack au moment du tirage, et rattrape ici pour une carte tiree
-- avant que le cadre existe (version 1.5.6).
insert into public.inventory (user_id, item_id, qty)
select gagnant, 'f_unique', 1 from public.chasse where gagnant is not null
on conflict (user_id, item_id) do nothing;
update public.profiles p set frame = 'f_unique'
  from public.chasse c where c.gagnant = p.id and p.frame = 'default';

alter table public.chasse enable row level security;
revoke all on public.chasse from anon, authenticated;

-- ----------------------------------------------------- le rythme en cours
-- 240 minutes d'ordinaire ; celui de l'evenement en cours s'il en change.
create or replace function public.minutes_recharge() returns integer
language plpgsql stable security definer set search_path = public as $$
declare m int;
begin
  select e.ticket_minutes into m from evenements e
   where e.ticket_minutes is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
  return coalesce(m, cfg('ticket_minutes'));
end $$;

-- L'evenement en cours, pour le bandeau et la fenetre des nouveautes. Sans
-- evenement en cours, le prochain s'il commence dans les quinze jours, marque
-- `a_venir` : le bandeau affiche le compte a rebours avant le depart.
create or replace function public.evenement_actif() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce(
    (select jsonb_build_object('titre', e.titre, 'texte', e.texte, 'code', e.code,
                               'debut', e.debut, 'fin', e.fin,
                               'ticket_minutes', e.ticket_minutes, 'a_venir', false)
       from evenements e
      where now() >= e.debut and now() < e.fin
      order by e.debut desc limit 1),
    (select jsonb_build_object('titre', e.titre, 'texte', e.texte, 'code', e.code,
                               'debut', e.debut, 'fin', e.fin,
                               'ticket_minutes', e.ticket_minutes, 'a_venir', true)
       from evenements e
      where e.debut > now() and e.debut < now() + interval '15 days'
      order by e.debut limit 1));
end $$;

-- Ou en est la chasse : ouverte ou non, trouvee ou non, et par qui. Le
-- gagnant est public : c'est tout l'interet.
create or replace function public.chasse_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  -- `active` : ouverte ET l'heure d'ouverture passee. `ouvre_le` permet au
  -- navigateur d'annoncer l'ouverture a venir.
  return (select jsonb_build_object('carte', c.carte,
                                    'active', c.active and (c.ouvre_le is null or now() >= c.ouvre_le),
                                    'ouvre_le', case when c.active then c.ouvre_le end,
                                    'trouvee', c.gagnant is not null,
                                    'gagnant', (select pseudo from profiles where id = c.gagnant),
                                    'trouvee_le', c.trouvee_le)
            from chasse c where c.id = 1);
end $$;

-- ---------------------------------------------------------------- succes
-- Les identifiants doivent rester ceux de SUCCES dans js/config.js, qui
-- porte les noms et les descriptions. Un succes lie a la collection peut
-- disparaitre si l'on cede la carte qui le tenait : c'est le prix d'un calcul
-- sans stockage, et c'est rare (les Promos et les Brillantes ne s'echangent
-- pas).
create or replace function public.succes_de(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pr profiles; s text[] := '{}';
  ext int; ext_total int; leg int; leg_total int; br int; br_total int; uni boolean;
  rev int; rev_total int;
begin
  select * into pr from profiles where id = p;
  if not found then return '[]'::jsonb; end if;

  select count(*) filter (where not k.promo),
         count(*) filter (where not k.promo and k.rar = 'L'),
         count(*) filter (where k.rar = 'BR'),
         coalesce(bool_or(k.rar = 'UN'), false)
    into ext, leg, br, uni
    from collection c join cards k on k.id = c.card_id
   where c.user_id = p and c.qty > 0;
  select count(*) filter (where not promo),
         count(*) filter (where not promo and rar = 'L'),
         count(*) filter (where rar = 'BR')
    into ext_total, leg_total, br_total
    from cards;

  if pr.packs_opened >= 1   then s := array_append(s, 'premier_booster'); end if;
  if pr.packs_opened >= 100 then s := array_append(s, 'boosters_100'); end if;
  if pr.packs_opened >= 500 then s := array_append(s, 'boosters_500'); end if;
  if ext * 2 >= ext_total   then s := array_append(s, 'collection_50'); end if;
  if ext >= ext_total       then s := array_append(s, 'master_set'); end if;
  if leg >= leg_total       then s := array_append(s, 'toutes_legendaires'); end if;
  if pr.trades_done >= 1    then s := array_append(s, 'premier_echange'); end if;
  if pr.trades_done >= 25   then s := array_append(s, 'negociant'); end if;
  if greatest(pr.serie_max, pr.streak) >= 7  then s := array_append(s, 'serie_7'); end if;
  if greatest(pr.serie_max, pr.streak) >= 30 then s := array_append(s, 'serie_30'); end if;
  if exists (select 1 from tirages t where t.user_id = p and t.god) then s := array_append(s, 'godpack'); end if;
  if br >= 1                then s := array_append(s, 'brillante'); end if;
  if br_total > 0 and br >= br_total then s := array_append(s, 'toutes_brillantes'); end if;
  if pr.fabrications >= 1   then s := array_append(s, 'artisan'); end if;
  if uni                    then s := array_append(s, 'unique'); end if;
  -- Ceux qui etaient la avant la version 1.5.
  if pr.created_at < timestamptz '2026-10-04 00:00:00+02' then s := array_append(s, 'pionnier'); end if;
  -- Version 2.0 : les Reverses.
  select count(*) filter (where k.reverse) into rev
    from collection c join cards k on k.id = c.card_id where c.user_id = p and c.qty > 0;
  select count(*) into rev_total from cards where reverse;
  if rev >= 1 then s := array_append(s, 'premiere_reverse'); end if;
  if rev_total > 0 and rev >= rev_total then s := array_append(s, 'reverses_toutes'); end if;

  return to_jsonb(s);
end $$;

-- --------------------------------------------------------- mes tirages
-- Les trente derniers boosters, et des statistiques sur tout le journal :
-- combien de cartes de chaque rarete, combien de godpacks et de Brillantes.
-- Le journal commence a la version 1.5 : les boosters ouverts avant n'y
-- sont pas (`depuis` le dit).
create or replace function public.mes_tirages() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  return jsonb_build_object(
    'total',  (select count(*) from tirages where user_id = p),
    'god',    (select count(*) from tirages where user_id = p and god),
    'depuis', (select min(created_at) from tirages where user_id = p),
    'raretes', coalesce((
      select jsonb_object_agg(r.rar, r.n)
        from (select k.rar, count(*) as n
                from tirages t, unnest(t.cartes) as u(cid)
                join cards k on k.id = u.cid
               where t.user_id = p
               group by k.rar) r), '{}'::jsonb),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object('quand', t.created_at, 'cartes', to_jsonb(t.cartes), 'god', t.god)
                       order by t.id desc)
        from (select * from tirages where user_id = p order by id desc limit 30) t), '[]'::jsonb));
end $$;

-- Rouages internes (appeles par me(), player_profile, open_pack) : pas
-- depuis le navigateur. mes_tirages, elle, est une action du joueur.
revoke all on function public.minutes_recharge, public.evenement_actif, public.chasse_etat,
  public.succes_de from public, anon, authenticated;
revoke all on function public.mes_tirages from public, anon;
grant execute on function public.mes_tirages to authenticated;

-- =====================================================================
--  Lancer un evenement, a la main dans le SQL Editor :
-- =====================================================================
-- insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
--   ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.', now(), now() + interval '3 days', 120);
--
--  L'arreter avant l'heure :
-- update public.evenements set fin = now() where fin > now();
--
--  Ouvrir la chasse a la carte unique (une seule fois : une carte trouvee
--  le reste), tout de suite ou a une heure donnee :
-- update public.chasse set active = true, ouvre_le = null where id = 1;
-- update public.chasse set active = true, ouvre_le = timestamptz '2026-10-04 12:00:00+02' where id = 1;


-- #####################################################################
-- ###  18_cadeaux.sql
-- ###  Les cadeaux offerts par un administrateur
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — les cadeaux
--  A executer apres 15_evenements.sql (ou apres 17_maj-quetes.sql sur une
--  base deja installee). Rejouable sans danger.
--
--  Un administrateur offre a un ou plusieurs joueurs des Eclats, des
--  boosters, des Fragments et/ou une carte, avec un mot. Le joueur le
--  decouvre a sa prochaine visite : un paquet cadeau a ouvrir, puis ce qu'il
--  contenait. Rien n'est verse avant qu'il l'ouvre — c'est l'ouverture qui
--  credite le compte, une seule fois.
--
--  Depuis le jeu : Labo > Offrir un cadeau. A la main : en bas du fichier.
-- =====================================================================

-- Les boosters offerts ne vont pas dans la reserve : ils rejoignent les
-- boosters en plus (open_pack(true), 03_rpc.sql), partent en premier, et ne
-- peuvent pas contenir la carte unique.
alter table public.profiles add column if not exists boosters_bonus  integer not null default 0;
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;

-- Version 1.5.6 : ce qui depassait le plafond de la reserve (boosters achetes
-- ou offerts avant) passe dans les boosters en plus, et la reserve repart de
-- son plafond — son compte a rebours reprend. Rejouable : une reserve qui ne
-- depasse pas n'est pas touchee.
update public.profiles
   set boosters_bonus = boosters_bonus + (tickets - public.cfg('ticket_cap')),
       tickets        = public.cfg('ticket_cap')
 where tickets > public.cfg('ticket_cap');
update public.profiles set tickets_offerts = boosters_bonus where tickets_offerts > boosters_bonus;

create table if not exists public.cadeaux (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  eclats     integer not null default 0 check (eclats    between 0 and 100000),
  boosters   integer not null default 0 check (boosters  between 0 and 100),
  fragments  integer not null default 0 check (fragments between 0 and 100000),
  carte      text references public.cards,
  message    text not null default '',
  auteur     uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  ouvert_le  timestamptz,
  constraint cadeau_pas_vide check (eclats > 0 or boosters > 0 or fragments > 0 or carte is not null)
);
create index if not exists cadeaux_user_idx on public.cadeaux (user_id) where ouvert_le is null;

alter table public.cadeaux enable row level security;
-- Aucune policy : le navigateur passe par les fonctions ci-dessous.
revoke all on public.cadeaux from anon, authenticated;

-- ------------------------------------------------------- mes cadeaux
-- Ceux qui attendent d'etre ouverts, du plus ancien au plus recent.
create or replace function public.mes_cadeaux() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'eclats', c.eclats, 'boosters', c.boosters,
             'fragments', c.fragments, 'carte', c.carte, 'message', c.message,
             'de', (select pseudo from profiles where id = c.auteur),
             'quand', c.created_at) order by c.id)
      from cadeaux c
     where c.user_id = p and c.ouvert_le is null), '[]'::jsonb);
end $$;

-- ----------------------------------------------------- ouvrir un cadeau
-- La mise a jour `where ouvert_le is null` tranche : un cadeau ouvert deux
-- fois en meme temps (deux onglets) ne paie qu'une fois.
create or replace function public.ouvrir_cadeau(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c cadeaux;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  update cadeaux set ouvert_le = now()
   where id = p_id and user_id = p and ouvert_le is null
   returning * into c;
  if not found then raise exception 'Ce cadeau a déjà été ouvert.'; end if;

  -- Les boosters offerts s'ouvrent a part, hors reserve, comme ceux de la
  -- boutique, et sans carte unique (tickets_offerts).
  update profiles set shards    = shards + c.eclats,
                      boosters_bonus  = boosters_bonus + c.boosters,
                      tickets_offerts = tickets_offerts + c.boosters,
                      fragments = fragments + c.fragments
   where id = p;

  if c.carte is not null then
    insert into collection (user_id, card_id, qty) values (p, c.carte, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    -- Une carte qui se vend en boutique (une Promo) est notee comme acquise :
    -- la boutique ne la revendra pas a qui l'a recue.
    insert into inventory (user_id, item_id, qty)
    select p, s.id, 1 from shop_items s where s.carte_id = c.carte and s.unique_buy
    on conflict (user_id, item_id) do nothing;
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;

  return me();
end $$;

-- --------------------------------------------------- offrir (administrateur)
-- `p_joueurs` : les identifiants des destinataires. Un cadeau par joueur.
create or replace function public.offrir_cadeau(p_joueurs uuid[], p_eclats int, p_boosters int,
                                                p_fragments int, p_carte text, p_message text)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if coalesce(array_length(p_joueurs, 1), 0) = 0 then raise exception 'Choisis au moins un joueur.'; end if;
  if coalesce(p_eclats, 0) = 0 and coalesce(p_boosters, 0) = 0 and coalesce(p_fragments, 0) = 0
     and nullif(p_carte, '') is null then
    raise exception 'Le cadeau est vide.';
  end if;
  if nullif(p_carte, '') is not null and not exists (select 1 from cards where id = p_carte) then
    raise exception 'Carte inconnue.';
  end if;
  -- La carte unique ne s'offre pas : elle se trouve.
  if exists (select 1 from cards where id = p_carte and rar = 'UN') then
    raise exception 'La carte unique ne s''offre pas.';
  end if;

  insert into cadeaux (user_id, eclats, boosters, fragments, carte, message, auteur)
  select pr.id, greatest(coalesce(p_eclats, 0), 0), greatest(coalesce(p_boosters, 0), 0),
         greatest(coalesce(p_fragments, 0), 0), nullif(p_carte, ''),
         left(trim(coalesce(p_message, '')), 300), auth.uid()
    from profiles pr where pr.id = any(p_joueurs);
  get diagnostics n = row_count;
  return n;
end $$;

-- -------------------------------------------- les joueurs (administrateur)
-- De quoi choisir a qui offrir : depuis quand on joue, ou on en est.
create or replace function public.admin_joueurs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
             'inscrit', pr.created_at, 'vu', pr.last_checkin,
             'boosters', pr.packs_opened, 'eclats', pr.shards,
             'cartes', (select count(*) from collection c join cards k on k.id = c.card_id
                         where c.user_id = pr.id and c.qty > 0 and not k.promo),
             'cadeaux', (select count(*) from cadeaux g where g.user_id = pr.id),
             'en_attente', (select count(*) from cadeaux g where g.user_id = pr.id and g.ouvert_le is null))
           order by pr.created_at)
      from profiles pr), '[]'::jsonb);
end $$;

revoke all on function public.mes_cadeaux, public.ouvrir_cadeau, public.offrir_cadeau,
  public.admin_joueurs from public, anon;
grant execute on function public.mes_cadeaux, public.ouvrir_cadeau, public.offrir_cadeau,
  public.admin_joueurs to authenticated;

-- =====================================================================
--  Offrir a la main, dans le SQL Editor (meme effet que le Labo) :
-- =====================================================================
-- insert into public.cadeaux (user_id, eclats, boosters, fragments, carte, message)
-- select id, 3000, 10, 0, null, 'Bienvenue, et merci d''etre venu !'
--   from public.profiles where lower(pseudo) in (lower('Pseudo1'), lower('Pseudo2'));
--
--  Les cadeaux pas encore ouverts :
-- select p.pseudo, c.* from public.cadeaux c join public.profiles p on p.id = c.user_id
--  where c.ouvert_le is null;
--
--  En reprendre un avant qu'il soit ouvert :
-- delete from public.cadeaux where id = 42 and ouvert_le is null;


-- #####################################################################
-- ###  21_reflets.sql
-- ###  Version 2.0 : evenement Reflets, Devine l'illu, invitations, titres
-- #####################################################################

-- =====================================================================
--  Mate TCG Online — version 2.0 « Reflets »
--  A executer apres 18_cadeaux.sql. Rejouable sans danger.
--
--  Ce que la 2.0 ajoute cote serveur, hors des fichiers qu'elle retouche
--  (les Reverses sont dans 03b_promos.sql, leur case de booster dans
--  03_rpc.sql) :
--    1. les parametres du jeu qu'un administrateur ouvre a la main ;
--    2. l'evenement « Reflets » : sa monnaie (les Prismes), son Pass de
--       recompenses, sa boutique et ses quetes (04_seed.sql) ;
--    3. Devine l'illu, l'illustration a deviner chaque jour (ses pixels sont
--       dans 21b_illu.sql) ;
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

-- ------------------------------------------------------- le Pass de l'evenement
-- (`evt_piste` dans les tables : le Pass s'appelait la piste.)
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

-- Vingt paliers. Le calcul (quetes de 04_seed.sql, recompenses de Devine
-- l'illu plus bas) :
--   - un joueur qui vient chaque jour gagne ~55 Prismes par jour (du jour :
--     10 + 15 + ~15 pour l'illu trouvee + ~20 de l'illu elle-meme + 15 x 62 %
--     pour la Reverse Rare, 6 boosters par jour), soit ~770 en 14 jours, et
--     ~330 avec les quetes de l'evenement : ~1 100. Il finit le Pass dans les
--     derniers jours ;
--   - un joueur regulier (10 jours sur 14) en gagne ~700 : palier 14 ;
--   - un joueur de passage (5 jours) ~320 : palier 7.
-- Les ecarts grandissent, pour que les premiers paliers tombent vite.
delete from public.evt_piste where evenement = 'reflets' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('reflets',  1,   15, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  2,   40, 'eclats',   150, null,          '150 Éclats'),
  ('reflets',  3,   70, 'titre',      0, 't_eclaireur', 'Titre « Éclaireur des Reflets »'),
  ('reflets',  4,  105, 'fragments', 250, null,         '250 Fragments'),
  ('reflets',  5,  145, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  6,  190, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets',  7,  240, 'eclats',   300, null,          '300 Éclats'),
  ('reflets',  8,  295, 'boosters',   3, null,          '3 boosters'),
  ('reflets',  9,  355, 'fragments', 400, null,         '400 Fragments'),
  ('reflets', 10,  420, 'cadre',      0, 'f_miroir',    'Cadre « Miroir »'),
  ('reflets', 11,  490, 'eclats',   400, null,          '400 Éclats'),
  ('reflets', 12,  560, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets', 13,  630, 'boosters',   3, null,          '3 boosters'),
  ('reflets', 14,  700, 'fragments', 600, null,         '600 Fragments'),
  ('reflets', 15,  770, 'brillante',  1, null,          'Une Essence Brillante'),
  ('reflets', 16,  840, 'eclats',   500, null,          '500 Éclats'),
  ('reflets', 17,  910, 'boosters',   4, null,          '4 boosters'),
  ('reflets', 18,  980, 'reverse_R',  2, null,          'Deux Reverses Rares'),
  ('reflets', 19, 1040, 'titre',      0, 't_ame',       'Titre « Âme des Reflets »'),
  ('reflets', 20, 1100, 'cadre',      0, 'f_nebuleuse', 'Cadre « Nébuleuse »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ----------------------------------------------------------- accorder
-- Ce qu'une recompense donne, quelle qu'en soit la source (Pass, boutique
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

-- ----------------------------------------------- reclamer un palier du Pass
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
-- Pour l'onglet de l'evenement : son solde, son Pass, et les dix joueurs qui
-- ont gagne le plus de Prismes.
create or replace function public.evenement_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); cpt evt_comptes;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then return 'null'::jsonb; end if;
  -- Ouvrir l'onglet de l'evenement accomplit sa quete du jour « Passe voir
  -- l'evenement ». Pas la connexion du jour (`checkin`) : elle a souvent eu
  -- lieu avant l'ouverture de l'evenement, et la quete serait restee vide.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite'
  on conflict (user_id, quest_id, period_key) do nothing;
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

-- ========================================================= 3. Devine l'illu
-- Une illustration a deviner par jour, la meme pour tout le monde : celle
-- d'une carte de l'extension, Essences exceptees. Elle arrive pixelisee, et
-- chaque essai rate la rend plus nette : 9 x 6 pixels, puis 12 x 8, 18 x 12
-- et 36 x 24. Quatre essais. Plus on trouve tot, plus ca rapporte.
--
-- Le serveur garde les grilles (illu_pixels, remplie par 21b_illu.sql) et
-- n'envoie que celle du moment : le navigateur ne connait la carte qu'une
-- fois la partie finie. Le jeu n'existe que pendant l'evenement Reflets.
create table if not exists public.illu_pixels (
  card_id text primary key references public.cards on delete cascade,
  data    bytea not null          -- 36 x 24 pixels, 12 bits chacun
);
create table if not exists public.devine_illu (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  text[] not null default '{}',
  trouve  boolean not null default false,
  primary key (user_id, jour)
);
alter table public.illu_pixels enable row level security;
alter table public.devine_illu enable row level security;
revoke all on public.illu_pixels, public.devine_illu from anon, authenticated;

create or replace function public.illu_jour() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date; $$;

-- L'illustration du jour : un tirage fixe par la date (md5), le meme pour tous.
create or replace function public.illu_cible(j date) returns text
language sql stable security definer set search_path = public as $$
  select k.id from cards k join illu_pixels x on x.card_id = k.id
   where not k.promo and k.cat <> 'essence'
   order by md5(j::text || ':illu:' || k.id) limit 1;
$$;

-- Ce que rapporte l'illu trouvee au n-ieme essai.
create or replace function public.illu_gain(n int) returns jsonb
language sql immutable as $$
  select case n when 1 then '{"prismes":25,"eclats":40}'::jsonb
                when 2 then '{"prismes":18,"eclats":30}'::jsonb
                when 3 then '{"prismes":12,"eclats":20}'::jsonb
                else        '{"prismes":6,"eclats":10}'::jsonb end;
$$;

-- La grille du niveau 1 a 4 : la grille fine, moyennee par blocs de 4, 3, 2
-- ou 1 pixels de cote. En RGB, 3 octets par pixel, en base64.
create or replace function public.illu_grille(cid text, niveau int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  src bytea; f int := case niveau when 1 then 4 when 2 then 3 when 3 then 2 else 1 end;
  w int := 36 / f; h int := 24 / f; o bytea; x int; y int; dx int; dy int; k int; i int; n int;
  s int[];
begin
  select data into src from illu_pixels where card_id = cid;
  if src is null then return null; end if;
  o := decode(repeat('00', w * h * 3), 'hex');
  for y in 0 .. h - 1 loop
    for x in 0 .. w - 1 loop
      s := array[0, 0, 0];
      for dy in 0 .. f - 1 loop
        for dx in 0 .. f - 1 loop
          i := (y * f + dy) * 36 + x * f + dx;
          for k in 0 .. 2 loop
            n := i * 3 + k;
            s[k + 1] := s[k + 1] + 17 * (case when n % 2 = 0 then get_byte(src, n / 2) >> 4
                                               else get_byte(src, n / 2) & 15 end);
          end loop;
        end loop;
      end loop;
      for k in 0 .. 2 loop
        o := set_byte(o, (y * w + x) * 3 + k, round(s[k + 1]::numeric / (f * f))::int);
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('w', w, 'h', h, 'data', encode(o, 'base64'));
end $$;

create or replace function public.illu_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; fini boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'reflets' then return 'null'::jsonb; end if;
  cible := illu_cible(j);
  if cible is null then return 'null'::jsonb; end if;
  select * into d from devine_illu where user_id = p and jour = j;
  n := coalesce(array_length(d.essais, 1), 0);
  fini := coalesce(d.trouve, false) or n >= 4;
  return jsonb_build_object(
    'jour', j, 'max', 4,
    'essais', to_jsonb(coalesce(d.essais, '{}')),
    'trouve', coalesce(d.trouve, false),
    'fini', fini,
    'niveau', case when fini then 4 else n + 1 end,
    'grille', case when fini then null else illu_grille(cible, n + 1) end,
    'cible', case when fini then cible end,
    'gain', case when d.trouve then illu_gain(n) end,
    'gains', jsonb_build_array(illu_gain(1), illu_gain(2), illu_gain(3), illu_gain(4)));
end $$;

-- Trouver rapporte des Prismes et des Eclats selon l'essai (illu_gain), et
-- fait avancer les quetes « illu ».
create or replace function public.illu_essai(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; g jsonb; ok boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'reflets' then raise exception 'Devine l''illu revient au prochain événement.'; end if;
  cible := illu_cible(j);
  if not exists (select 1 from cards where id = p_carte and not promo and cat <> 'essence') then
    raise exception 'Cette carte ne fait pas partie du jeu.';
  end if;

  insert into devine_illu (user_id, jour) values (p, j) on conflict do nothing;
  select * into d from devine_illu where user_id = p and jour = j for update;
  n := coalesce(array_length(d.essais, 1), 0);
  if d.trouve or n >= 4 then raise exception 'La partie du jour est finie : rendez-vous demain.'; end if;
  if p_carte = any (d.essais) then raise exception 'Tu as déjà proposé cette carte.'; end if;

  ok := p_carte = cible;
  update devine_illu set essais = essais || p_carte, trouve = ok where user_id = p and jour = j;
  if ok then
    g := illu_gain(n + 1);
    update profiles set shards = shards + (g->>'eclats')::int where id = p;
    perform crediter_prismes(p, 'reflets', (g->>'prismes')::int);
    perform bump_quests(p, 'illu', 1);
  end if;
  return jsonb_build_object('illu', illu_etat(), 'etat', me());
end $$;

-- =========================================================== 4. invitations
-- Achetees en boutique (2 000 Fragments, trois par joueur, shop_buy dans
-- 03_rpc.sql). Un code sert une fois : la personne invitee se connecte avec
-- Discord, le saisit sur l'ecran d'attente, et entre sur la liste des
-- invites. Elle trouve un cadeau de bienvenue de la part de son parrain :
-- 10 boosters hors reserve (en plus des 5 de depart) et 1 000 Eclats.
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
  values (p, 10, 1000, 'Bienvenue ! ' || coalesce(parrain, 'Un joueur') || ' t''a invité : voici de quoi bien commencer.', inv.auteur);
  return me();
end $$;

-- ===================================================== 5. titres et profil
-- Les titres qu'un joueur a debloques. La plupart viennent de ses succes
-- (15_evenements.sql), calcules a la volee comme eux ; les autres sont des
-- objets gagnes (inventaire, `t_…`) : Pass d'evenement, boutique, quetes.
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
select 'Reflets', 'La version 2.0 : les Reverses, des cadres, des titres, Devine l''illu. Gagne des Prismes et remonte le Pass.',
       now(), now() + interval '14 days', null, 'reflets'
 where not exists (select 1 from public.evenements where code = 'reflets');

-- ================================================================= droits
revoke all on function public.evenement_en_cours, public.crediter_prismes, public.accorder,
  public.illu_cible, public.illu_grille, public.creer_invitation, public.titres_de
  from public, anon, authenticated;
revoke all on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser from public, anon;
grant execute on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser to authenticated;


-- #####################################################################
-- ###  21b_illu.sql
-- ###  Devine l'illu : les illustrations en pixels
-- #####################################################################

-- =====================================================================
--  Devine l'illu : l'illustration de chaque carte, en 36 × 24 pixels.
--  Genere par `node tools/illu-pixels.js` : ne pas editer a la main.
--  12 bits par pixel (4 par canal), deux pixels pour trois octets.
--  A executer apres 21_reflets.sql. Rejouable sans danger.
-- =====================================================================
insert into public.illu_pixels (card_id, data) values
  ('c010', decode('RpVpZpV6JpJ6J6V6RqN6VqJ5J6KLJYRqNZRYFIJZNINHIkZ5mcRYM1IiIiIjIjIkRYRZQ2Q3SLJ6V7N7F6N7GMKcN7KMSLF6CcKcR5WMaLZ6NqJqJZJHI1iKu9VpIkIjMkM1RHVZRIQ3Q3Q3WMF6WLN7B6N7KMOcOMOcScF7KMKcacWLNqR7R7N7JqJYRIVqRHMkh5VYQ1VpVqVZQ3Q3Q3NGV7J6WMR7FqR7ScOcOcScWcOLJ7OLacR7RqWMN7R7NqM2RHM1RIVqRZZpVZVaVZQ3RHRZRIVIRZR7SMV7JqZqWcOtOMWtatSMN7WLacR7R7R7R7N7NoMmVYVqVqRZRIZZVaVZQ3RIVpVHVIVINYWLWLaMF6dqmci9acm9etacSLacacSLWLR7WLRpNGVpV7ZqVZZZZpVZVZQ3RIVYQ1MkU3ZINIRYacecJ7l7usrOecq9itecacWcatSLR7V7WLI1eLaLZ7Z7d7dZZqVZQ4RJVIQ2RGVGVIh6V6eLVoisaLqLyszOmsq9mticacatSMSLNqaMRXeLeceMiceLVqdqVZVZVZVIQ2RFRFdYdpdqicqtq8ibmcubys3NqcutmsitacWcJ7N6VqNGZ6ececm9ecZ7d7ZqVaVIQ2Q1MkQ1RFhpdpZZiLqt3eqsutuc293NysusmsecatWcSMWLVoicicicq9icVpVGVHVHU2Q1Q1MkM0Q1M1mKZYZYiLut3e3ey9ys293O29y9isetatacaceLiMicmcq9icRXMjQ0U0MkMkMlMlIjIiM0VHh6VHVHicy9y8zN3O293O3O3N3OmtetetWLZ5iLiLmcu9icVIMjMkQ1QkMlQ1M0MjMjIiMkh5ZIZYM2icq9maqr7e7e3e7e7e7ezOi9i9q9iciLqsy9iMVIQkQkMjMkMkQ0Q1Q1VGVGZXQ1h5ZYZYM1icicVomJuJqIQz3N//7v7uzezOmseMqsutiLVZQlQlMkMkMjQ2VHZXdodXZXZXZYdoVXM2M1mtqsd4dFtnlVMiua3d7u//7u7ey9u9usmcVqQ1QlMlMlQ2MlQ3VHVHZXQ2M1M1Q1M2VHM2M2q97eqrpYtXg2Y0lo7u7v/v////7u3Nurl5M0MjQlMlQ2Q1Q3VIQ3dpQ1M1Q2Q2M2Q2M2Q3IkiLusqLY1k3lHhX3N7u7e7u/////v3Ny9uKMiMjQlU2U2Q3RJVZRIZZRJRZQ3Q3M3Q2M1Q2Ikp7p6l6dGg1dW28ubybuKub3N7e7u3ezNurMjU0U0Y2U2VIZZVIVZVIQ3Q3Q3Q3M2M1M1M1Iiubp6lYtWlo3N3NubhJhIdHloy9zNzNusu9ZFU1Y1VGQ2ZJZZVJZZQ4Q4Q3Q2Q2M2M1M1M1MkuLuKxotXtWhX2sp6hZdIY3Y2hpqcusqLqLZGU0Q0QlRIVJVIQ3VHQ3Q3QmQmMmMmMlM2M1M1ubxptWtGtGc1lpdHU2Y2U1QkQ1VHdZlZdIY2MjMjMlQ3Q2MmQ1Q2MlMkMkMkMkMkMlMlM1ZYuLlHpHpHk3Y1ZGlZp6p6uKp5dGZHhYhYlphYZGY1U2Q2Q2U3U3Q3Q3MmMlMkMkMkMkIjZYVHp6p6pploubysycucucucubysucqLqbubybuLyLyLqLd6VqRaRIM2M2MmMlMlMkMlM1Q1ZYQ2lqp7lpycycysycuLqLmcqcqbucqcqcubucqcqLuLuLiLd6ZqVqRqRZNJNJM4M3M2Q2MlQ2Mk', 'base64')),
  ('c011', decode('hFhGZol5uaqaurh5qKqJlomambqb2s69687e7eyquI6c6b6L2LxqpZlJlIc4Y4Y3hoZlqnd2RXVYmbqbusmbysmKmbl5yJqJiKzMury7y7yq287Nyp2s6b2K161qtZlIhIc4c4c4loZlunh2VXZXZIdJY4ZZhZdZZZd52q2qt5qKmJmIqZupmKqbyZury9yLx6xq1ZxZlIc4c4c4loZlu3h2Z4VHQ4dIZZiKqcqLdXqb2qmZl5tpyah2h2mYmJlouJmJmMiLh7hZlZtZxIk4c4c4l4Zlu4h2hpZYd6qsmbVYVIY3lX28yql5dphpl5uYdVVEp4p4hmp5h7h7iLh6dZZIg4k4g4Y3h4Zly4h2tquLubZoN5VWyrhnxpyaqZuZdodohouJyJt4pXt5lWpplqhZhphZdpdJU4Y3g4c4h4ZlzIiGlYyrppdXVWRXh4dnhXuKl4ypZWyKdFhWpXtnyJtXtohXpolXhXdXhYdZZYU4U3U3h4Zl3IiGdXmI28yrl5ZoVoRFRFdXdW26uIyap4VEt4tXuJtXt4hGdFhGlWlohGdYhodIU4U3h4ZV3ImGZnVW28yb2b3N3OmLmLlppn2quYyatopXhmtntot4t4hGdFc1o0lFdXVYdGY2Y2U1h4ZV3ZmHZnZnu9uL2s68/N7MtolFtWyJqJyKtpdouKt4tXt4topnhFhmlFZDhVdnU1U0ZEMiREZV3ZqXqsebubybyK2sx42a2828ysyKuKl6h6Q1dmuJtXuJtot5UzqHp3ZVRGh3ZHp5uYRDVVZU3ZmXzNisibitmKt42a/e/u/e7OuZyrqLVGU0hmyatXuJtXyJdFqIyZdlZUNEM0ZVhVY0MyRDunmG2cybp6qbl4hXys/e/e/e3N26uZhoZVhWhnyatXyatXuJU0dVhmyp26ZVIiRDIiIiIiIiMiQzhoqad5l5mKqLqLus7O/eyrhmuZhYhmhFuqmKh4mJl4iJREQ0UzYzZEQzQzMiIiIiZlVVVEIiyLyb29qLqsqbmJpouJuZZEMzhYhnuZuZmriZeJeZeIiaREQ0Q0ZVhmdlZVdFUzIiIiIiIiIiybtpybu4mYt5hmtoZFY0c0UzhWhVuIu8iZiaeJiIiIiIZWVEZVl3l3dlZVVWU0IiIiIiIiRDt5tXhWlnx4t4qYlmMzMyQzUzhllVuriaeJeIMzdnqIuYdlQzVEuIhWdFVEM0UzIiIiIiIiMyU0k0c0xnpmh2qpZlIiIiVEhWhFp4zNiad4VDVEVEqIuYVVQzQzU0VFM0M0M0ZEMiIiIiIiMyVEl2tmhUhlqHqYdmMyMzl2l3pXZVqriaZ3Y0QzMiVEiZeJVEQ0U1VFdWhXZVVEQzQzU0QzQzdkyquHhkp2dVh3hmIiIiQzdmhWhFqZh4ZEMiIiIiZmmqiaRFMzhWlXdFZEQzQzMyIiIiIiIit4qZZUZEhVZEiHUzIiIiIiIiMiUzhWdmMiIiIiREZVqqqqd4QzY1MiU0IiIiIiIiIiMiMyIiqIqYVDdDUzUzh2MiMiMzMzIiIiMiQzMzIiMzRDY1Qzd3mJeJVFU0MzVEIiIiMiMzMiIiIiIiqqmYmIZEUzUzhmhmdmd2h3iHQzIiIiVFd4VmVEQ0ZliIqqiJmIuq28VVIiIiREIiMiMiIiIiqZmHqZhWtop4dVZEMzIiIiIiIiIiVEureJeIl4qZqZmZqZh3d3mZqZQzIiIiQ0IiMiMjIiIi', 'base64')),
  ('c012', decode('RUVkeGeWaFaFZ1VkRURURERUVkRkIyEhIhIhIiNDV1eGinimimineWaFaFeVaFV0RURTNDNDV1imeWZ1VkeGVlVkRkNTNDRkV1IyIiEhIhMyRDIiRTZ1imm3m3m3eWeVeVeVaFRkRUNDRTRUm3aGZ1eGeWZ1RURkRUNDRURkVkIiIiMyRDiFiFIiIiNEaFm3m3ineWeVeWaFRUaFVkNDNDRUm4RUNDNDNDNDRURURURkV1VlNDIiNDRDZkumh1MyIiIiIzeWm3ininiWeWZ1VkRUVkRURTRUZ1NDNDNDNDRURUNDRUaFZ1RUIhIiNDRDmFumd0MyMyIyIyinininininaFaFZ1aFVkNDNDNTNDNDNDNDNTRTMyNDVlVleGIyEhIyMyVTVTRDd0VTZkMyRUiWeWm3m4ineWVkZ1RkVkRUNDNDNDNDNDNDNTNDIyRUVkRkRDNDERMyZkmFununzIZkZkIyZ1eWinm3q4imeGVkRkRkRkNDNDNDNDNDNDMyNDMyNDRkRkNDNDIiERMyd0qWuny3mVRCRTVkeGVlVlinm3m3V1RkRURTNDNDNDMyNDMyIyIyMyIyRURkRUIyIyIiERIyRTd1d0umd0MyNDmnNDIiNDeHm3q4Z1RkRUNDNDNDNDNDNDNDMzMyMzNDNDRVNDIyIyIyIiEhRDRDVTd0VTMyVkZ1IyMzeGm3q4mnZ1RkRUNDNDNDNDMyVERDNDMyNCNDNDRUREIyNDMzRUERIyRDVTZkMyVUZ1IyRDaGm3rIq4eWRUZlZUNDNDNDMzNDNDNDNDNDNDNDNDNDMzRERUNDRUMzERMyQyMyMyd1VkMyRUeWm4mneGVkVkVkNDRDRDVURURUNDNDNDNDNDNDNDNDNDRUNEMyMzIyEhIhIhMyZkd1RDMzNDVlinVkNDRUVkVkRDVURTRURURUNDNDNDNDNDMyNDNDNDMzMzVVRUIiIiIiRDRDd1Z1MzERIyRUiXMyRURURURUVUNDRDRUZ1mnNDNDNDNDNDNDNDIyMyIyRVd1VkIyNDdmdlVDd1VUEhERRUiXaFVkVkNDIyRURkNDRUVkeWRTRDNDNDNDNDRTMzIyMyRURUREiGRDNDhWQzVDVTEREhZ1eWVkVkRkNDIiIhNDVkVkVUVkRURUNDNDNDNDVkNDIyIyNDRUd1MyRDdkZkQzU0MyIiERMzeWNDRkNDIiIiIiIiIiVkVkVkVkVkimNDNDRTV1eFMyIyRUIiMzd1ZjVTRDd0d0ZjRDIiERRUVlNTIiERIiIyIiIiEhRUVkV1RUaFeVNDeFq4iXV1IyNDREIiIiZkVTVTd0ZjZkdkVTMyMyRURDIiEhEhIiZEMyIhEhRkeGRTV0m3m3VkrIVkIyIyIyRUZElWMzZUVTZjZTZjVTVTVTMyIiIyMyMyIiEhIhQyIiEhIhVkRTeGrIeWVkeWm3MyIyIyIyRURDVDMyRDVDVDVTVDVTVTVTMyIhIhIhIhIyIyIiIiIiEhIyRTZ1rIeVaFeFrIiWMzIyIyMzNDIiIhIiMyQzMzRCRDRDRTRTVTMyMyIiIhIhMzIhIiIiIhNDRTm3m3V0imm3eWRTMyIyIyNDMyIiIiIhIiIiIiIiMyQyRDVTRTMzIiIiIiIhIiMyEhIiIiRTiWimimaFrIrINDIyIyIyIyNDIyIiIiIhIhIiIiIiIiIiMyNDMzIyIyIiIiIhIiRDIiMyRTeVeVVkiWiWvIeV', 'base64')),
  ('c013', decode('Q0QzQzQzU0ZWhnl4l4l4h4dXVFdnl4l4l4h4dWQzM0VGU1ZXh5VGRGRGRHdpdpM1MkQ0VFZXZVZFdWl4l4l4l4l4l4l4hnVFl4l5h4mJmJmIqJhnMjQ0Q0VHmKVHVXRHRGdpZYMkMjQ0VGhoqJhnhnl4l4l4l4l4l4l5dnl4l5h4d4d4eJmZmJqJQ0dFdnRGZYh5dod4ZoZXRFQ0Q0Q0ZHhohnhnhnhnhnl4l5l5p5qJl4mJmJiJZ4Z4d5d4mamJdmlXp4mIqaZnZoRFRGZWVWVFZFU1dXhohnZWU0VFZFdnqJqJqJqJqJmJmJeJVoZ4d4Z4mJmJqJhWuJy7Q0MjM1MjMjQyMjMkQ1ZWdXhXVFVFdnhnhnhnmJqaqaqJqJmJmZeJVod4ZoZomJmJqJqJupZWQjZFhndVUyUyUzMkM1Q1dWhXdWdndndndnh4qJyryryrqJqJmJmZZ4d4Z4d4mZp4qJuZqYhl272q2r2r2aya2ruJU0MjZVhnd4dndnZniImah4l4ubyruaqJqJmZmZiJiImJl4p5qJqJmHuY682a2q2a2a2a2a2ruJQzZXhnh4h4VnVnd5Z3h4dnl5yruaqJqJl4mJmJl4p4p5p5p4uZhlypyquI2a2a2a2a2a2qyadFdnl3l4h4VnZomKZnd3h3l4yruaqJqJqJqJqJuJyayauap4uZhUuouJuJlmyZyayauIp4uJdFdnhnmJd4ZoZoZoZnh4h4p4ybuauauJuJuJuKyauJp5qJqJqIhT26yaybyryryryruJyap4ZFhndnh4h4Zod4Znd4mJl4qJyauKuJuJuauKuauauJp5uKqKqIuX66uJqauaybyrybyauauKZFl4l3h4mJd4Zod4l4l4l3t4uKyayauauauaqJuauauauKuay5uo2pyrqrurybyaybu7urqJhnmImIl4hol4mJl4l4lop4p4uKyayauayryauayryrybuay7yX25yYyayryayayayaururuKqZzJzJp4lololnlopopop4p4uJyauKp4uJuquZqIqIqIyry72o2oyYyJyayKyKyauKyayauJp43J3Jp4lnlopopopopop4p4uJuJuKyayql3h3h3h3hnuquaypyoyXyJyKyayayauKyayKp5p5uqmJqJlnlnlnp4p4qIp4p5uKybyryruZl3h3h3l4hnuZqaubuqyoyZuauKuKuKuKuauJqJqamKhplop4p4uo3I7puZp5qJuJububyrqZl3l3l4l3l3uZuru7yqyYuIuJuauKuKuauJqJurmKdoZXqXzI7o7o7p3Zupl4p5qJqKubyrmIqIl4l4p3l3qYzKzKyXt1uIuJuayauauaqJqah5ZXdoZX7o7o7o7Yupu5y5qJl4qJqJuquZl3l4qIl5uIyp3a3ay5yXtlpmp4uJuJuaqJuqqah4ZodpiK7p7p3Yh2h3uZ3YuZl4l5qKuqmIl3l3l4l4yp3ay5y5yp2ptmpmqIuJuJuJuqy7h5VXmKqsqs7p3Yl3qJuay73Zupl4l4uqy6qYmIl4l3up7b26dVqIy6uquIlmZXuay7qrqrZXMlMkmay8zM3Yp4uKuKmImIy5u6h4qZvLzLzKupmIy57r7Lyqp5VFqJqqurmJQ1dYhpqbqrVGMlMlqqy8u8p4p5ubhndWdnqou6u6vLu7u7zLzK3K7b3L27ububhoVFZWZWZWU2dYdYdYqrVXMlQ1u7y8u8', 'base64')),
  ('c014', decode('c1UkMTk2clQTMTMTMTMTQkUkU1Y1IRIRISISISISMSQjg11p56566K6969qLU3U2Y2MTMkITUkMUMTQTITITISITMTUkQjQkY1UkQjMSMjMTMjQjQjY1Y1tYtYpXlXp6l6ZHMlMlY1QkITITQkITITMUITITITMTU1QkQkYlQjISY1QkQjQkQkQkdXdGU0c2UlQkU1dHU3MlIkMkUlMkMkMTMTITMjITITITITUkMjISYlMkQkMTISMjQkVGU1QkQkMkMTQjU1IkMkY2dHMkMkQlY1MkMTMTITITMUITITITlXY1ITUkISMjQlQkISMkZGdWp4dXU0dXU1U1Y2MkQlUlY2U1QkQkYlQkQkQkISITITITITIShHMjITQkITQkZGZHQ1dpuJhXln27p4p4dXU1U1g2Y2YlY1lYQkQkY1YlUkUkITITITQkITITlHQkIjMjMjZGZFdYhoyb2ryZ687M677MZWMjQkU0Ykg2c2lXhGUkc1Y1UkQkMTISMkU1hGlXdGMjMjMkMTQkZGZHuK68/d7N7M7M7M7NZFUkQkY1U1dGhGc1x6Y1QlQkQkMkISITMTdGlXY1QkMkIjIjMjMjQjU1qJ687M2ryauJyayaU1U0MkZFdndGc1c2t5dHQkY2QkMkISMjdGU1dFdFU0QkMkMkQ1M0Q0U1dWyJ2r7MyJyJ2qZGQ0Q1VGhoZWZWZWU1lXyKQlY2U1MkMTQkU0QjU0UjhXloU0MjMjMkQ1ZGuadXdX272a2adWU1VFM0ZWdXh4qKl5dXdX6shXY2QkMkY2QjU0dWhXZFlnpop4QkU1IjIjZXuadXyKubya2rZWQkQ0M0ZFh5h4mJl5hodoybyKhXdGMTU1QjZFqKqJuJqIlnt5dWZFZGdndnyrZWhn2828urVFU1MkU0U0mJh4mKl5dXdWt67edXt5QkU1Q0dWmJl5p4lnl4qJt5qJhohnl4uadnREmJdnhnMjQkQkU0QjdnhpmJZWZWl42b7eyKt6hXQklpual4dWhnhohnl5loyruaqJdWl5h3MjVEZXVGUkk1o1hEQjU1dXZWU0p56868697N2K2sQkhoyryrubhnQ0VFZWhnuby8yruKlnhmVFMjMjhGpEkjgjpUlDlVZEY0ZF2r7M68687N6b7dU0VGhododXqKU0Q0VFdXubyryruKp4dVVEMkU0tVkikigjtltUx2t2lDlG2ryb287e7N2L/edXqK2r68yrhoQ0Q0dWl4uay82827uIl2dlQ0Y0tEkzkjkzpDgzlDlDo0k0hXqb7N/d68687MdXp66r7M7MubQjZFl5qKuby828ual2hlZUQ0UjpEgicScicicikjozszpEk0mK3N7N7N7M7dZGl66b687MyaZFpol5uryryruruahnQ0Q0MjQjpVkykygicicigigikygzlEdGqby8/d28/ddGh66L687Myapotphour2suauauaVFMjMjIjMjt3pVkyozozkygikypDkikzUidY287N2r7N16l6yL6r682b69x6p5yb2bybqKqJMjISITITITdFtnt3xmtlxmlEgzcjpmhFYzdG287d287N7NuLp66s6s2c7e68287NdYVXVXVXRXRXVXRXVXVXhnpWtmpmpmt3uqqad4dol6qKqb7N7N2r/vy8lq686s2r28/u/ulpRGRGVXVXVXVYVYVYVoVoVoZoiJh5h5Z5VoVoVoVodpmJd57N7Np5', 'base64')),
  ('c015', decode('NFNFNFNFNWRWRnZ4Z5Z4VoVoZ4Z4Z4Z4Z5eJZ5Z4Z4Z4Z4Z4Z4Z4RXRWR4VoVoVoVnRXNFNFNWNFNFNFNWRnVoV4VoV4Z4Z4Z5Z4Z4Z4Z4Z5Z4Z4Z4Z4Z4Z4Z4VoRnRXRnRnVoVnRoRXNFNFNoNFNFRWRWRWRXRnZ4qsq9vNzdq8iZZ3d3iIiId5d5d5d5Z4VoVnVnVnRXRWRWNFNFNFNFNFN4NWRWRnRWVoZ4mrvN3eu8qpmYiIiIiHmliViVmlq2mYiIiJiKu9msibeKeJZ5Z4eKaJZ5Z4V5eKmbmrmrZoVYVXRGq9eZZ1mmd3VXeKisiqeqe8i5m4vHiYeKm8q8u8u8u8u8mriaiaiKd5msmriKiJVXVXVXRFRGq9msV2aFeJq9vOvOvOrOrOrOm9isebiciceLd6dphplpp6mKmbiaiKiKZnVXZ5Z5VXVXVXVoRHrOrOq9vOvOvOvOrOrOqsuLt6lZhYhZlplZlZhZhZhpdIdHVXabWcisZ5ZoVGVGVXVoVYZoVomczNzevNvNvOvevOvOqLxqxqx6yLyLpZhIU2U2U2dHlYpphIZIZYZ5VXVXVGVGtZlYZXVXVYV5eJu4y5uambisesiseKhIxqxqxZxJtIc3Y2dHZHY3dItqpZdIdIaKaKZ5VYVYhIpIdHRFRFRGVXVoV3VVur3ezezemsZppZpIk4g3c3ZHZHZYdpZYZHU3lppqhZaKeLebebibh6ZIVHRHRFQ1RGRGRFVGqs3e3e3e3eu8dpd6ebecisireKdpZYVGRFQ1MmhZdZZ5eKmsmsl6ushpiLZ5VYVXVGRFVGZou9ze3e3e3e3ezNzNzNvNq9q8msmsisisaKVWQ2QlU3hYuLmKY3Y2l5hoZHlpmbeKVYVXZ5vNu9q8q8ys29692LxqppmKmsq8msibebZ5Z5V5RFQlMkc3g3pYpYY2hIl5ZXU2dHqLq8msvOzOzezezOxq1q16x6hIQ2U2U2ZYl5qbmbeKebVWZ4ZXVGg3g4pZlpg3Y3hYdYU2U2g3yLvOvNvNvOzO29xZxqxZxZtphYY2Q1Q1Q2VGhYlpdoVWeKVXVXU2U2Y2c3U2U2Y3hIhIY3Y3c3t6u9q9vOvOu9tZw4xJxZhIdHhHdYhIZHMkIkM1Q1Q1dXhYZXY3Y3Y3lIZHQ2U2hIpphIU2U2U2hpu9q9q9q9hYpIxZw4o3MlMlU2U2ZHdHdXQ1IkIjMklYdIQ1U2U2c3lYlZdHU2Y2k4lIU2U2U2t6vNq9q9d5dXhIpYpIY3IUQlITMkY2dYU2ZHdYQ1c3VHRGRGRGQ1U2Y2U2Y2lIo4g3hYY2YmtIx6y9mbmribZXZHY3Y2IUIUM1ITU2U2U2Y2Y3U2QlU2V5VXVXRGM0Q1Q2g3tI2Lo4pZtZo4xJxpxq2bysmsibVXVGU2VGVHQ1MklYhIQlU2dHdHdHhIeKV5VXVXVXVXRGY2s4xq2Lk3xptIo4tItIpItZl6ibeKVXQ1MlU2ZHdHx62Lk3Y2Q2Q1MlU2RFZ6WKVXVXVnVnQ1hHs42Lxqg3xplIcnYmUmc3eKeKZ5Z5VXM1RHU2U3dHlYpIU2MlMkMlU2RGRFZ5aLVoVnVoRGQ2o4tI2Lg3U2U1YmQ1Q1g4d5Z5Z5Z5Z5J5M1MkQ2hIlIdIU2U2Q1U2Y2VoRWRFZ5acVpZoVoM1dHs4ooUmQ1QlUmU2Y3c3dHZpZ5VoWKZ5IiIjMkpphIZIU3MlMlMlIi', 'base64')),
  ('c016', decode('icicicisicmsq9msq9i9m9m9m9vO3ezeve7vzfzevevOvezeq9q9vOvezezv3vzevevevezem9msmtmtm9q9vNq9q9m9q9vNvO3v7v3vzv3vzvzevevezvzvzezezfrOm9ve3v3vzevOm9isq9q9q9q9vOvOvNvOvOq9q9q9vOze3v3vzvzvzvvfrevezurevereWcacWLecm9rOzeq9ebRpvOvOvOvOzevezezevOzevOvOzvze3vzvzvrOrOvevevevenOverOWcacSLWLacV7ebm9aLRYvevOvOzezezevei9m9rOm9m9itzeverOzvi+etnOvevevfrevei+etasSLSLR6RpecaLV6RozevOvOvOvezerOe9etaceti9aMWLm9rOrOetWtetrenOvevezei+i9etSMSMR6RZisisVqRozem9m9rOvezerOetecaci9i9acaMm9i9i9atataci9i9vevevenOatasWcSMR6RpisisRpWKvei9q9nOnOvenOetetesnOi9acaci9ati+e9ataMecacrOveree9i9Wca9SMR7aLesaLRYecrOi9venOm+rOnOetetiti+e9etacatatjOetWMaMecaLrOnOrOi9e9SsW9ScSLi9aLR6NYisrOi+venOm+rem+etaceti+eti9etatate+atWMWMecWLrOnOnOnOetScStScSci9aLR6NoaKnOjOvejOnOrejOetateti+e9m+e9a9e+e9atWMWMecV7rOm+nOjOe9ScWcScacSLWLOKRpVpnOjOrOnOrOrejOe9etete+jOnOjOabaKi9adacaMacaLvenOjOnOe9ati+ScacN6SKSLRpVqrenOrenenOnejOe+e9ete+rei+WLitmLeLatacecaci9verOjOreatnOm+WcacN6R6N6R6VqrerfnenOjOnOjOjOnOetfOvfe9a+h7hqi+i9ititacnOzerOrOveWtrOe9acWLN6R6N6NqVqrenenOjOjOnOjOjOnOi9jOzvnOjOmbhZnOnOrOrOi9rezfvereveatrOi9acN6R6NqR6NpV6renenOjOrerenOvfrererf3vvfrOqLhpisreverevevezezeveveatrOi9WbNqV6NqSLN6V6renOrenevfvfrezvvfrfrfzvzeqcl6h6eJrfzvvfzvzvzv3vveverOnNacV6RqV6WLN6R6aKreneverevfzfzvzvvfvfvf3vzvreeJveeKre3vzvzvzvvfzvzuzerOi9WcVqWLR7ecNpWLebrerevfvfzvzvvfvfvfzvzv3v3vq8q9zeirm9mtebzfzvzezvzuzevei9WLWLecaLaLWLecebvevevfzvvfzvzvzvzvzvrerOrNq9m9isaLRpM2Z5zfzvzuzuzuvezeesZ7acism9V7aLebaLzurOrOverOrOrOjOi+atWLSLSLRpNHI0I0M1NGvezuzuvezezezuveecaLm9ism9aLebZ6aKi9e9e9e9e9e9e9e9atacWMWLV7V6RpNGIkI1Zozeve3uzerNnNvei9ebicm9m9ecaLaLZ6VpetetetetetetetetacWcV6RYRYNGI0I0I1M1Z4zezezdvNrNrNi9isq8isisebZ6Z6Z6VpVpitetesesesesesaLRpM1IkIkM1M1M2NHNHNGNHVoq8vNq9m8esecebqsibeLaKZ6V6VpVYaL', 'base64')),
  ('c017', decode('c1132Ix5yJ6Z66/a/a6q6q6q6q6q6qhGhGhFlFpEx12npDtl2Y/K/Z/a2olEx2tmt4yahEhEdFlF2I6Z2Z2J6Z65/a/K/a666q6q6qlWhGhFk1k0tUx2x1tUpUyX/J/ZuHtU6o2XyHpnlVY0hFp2tU2H6p6p6Z6Z65/K/a/a666q6qtnlFlFyH7K/K6px1kzxkkzpl65pl2F2G2Y2Y2qhVczt2pmyX2Fx12X65652It2x2yH7J666qx4lFx466/K/K+56opDpEtUgzgzgzyG642oyYlmczYzlVplp22n2Wt1tlpUlEpUkzpDlDyG7J2ZlF6p6p6p6565+52HpEpEpUgzpDyWyG2Xt3lWYzc0lEg0p2ynynyX2nyG2Wt2plkztU2H65/KyH/K656p6Z6Z6Y6opEtlpUpDpDpUtl2GpmhFYzhVc0c0hElUt2t1t1yG2nyWyWx1656p6p652X65+5/K+56p6Z6pyHhDx1xllExl6Y6o6otmhDpVtnt3tnpVuGyFx12W2nx1x0tk/Z/Z/a/K2o656565+56565+5yZgzplx1pV2H6Y6p6XtlpEx22I2YyItWpExk2F6W10xTpDpDx0/J/Z/Z7J642o7J/a/a/a/ZyXhDtmtlx26H6Y6Y12tlplxlyIyYtmxm2G116F2F102F2GtlpD6o/J/Z/ZhUYzt164+5+56565hVYztU6Y6o6Y6XxmplpltlyZx3tm2H64/Z7Itl647J/J/Z12tU6Y6465Uztl2W6o/J/J652qlmUylk656p6o2GtmlVplpVyIx36X6H2H/J25pVyG2n+5/Y646Y6Y6Y6Xpmxm2G6X6o6p667d3MpUtk/b652G12pllVpllV6o6o2Y6o2I6Y64tl2W6464/I7I2o2Y2Y6Y2HZFlUyG6Y2q7L7c7K66x17b/bx2tltllVt2pl/J/Z/Z/Z656Y6nt3lUyG65+4+42p2p2p2p2qpVdEyY2qyq267c7c2Z2p/c/t2oxltlpUx2pl6o/Z/J/J646o6n2ZpV2Y/t/K/J7J2p2q287d2Y6W2X7c27277c7Mt2tm/s/s2ptlxlpUpmpl2G6o/J+46o6o2qp3x2267M7L/t/a677N7M7L2p7K667c7d3M7M7L7ct37c7c2otltlt1lmlmtlx32X646o2ryb2826273L7M7c7c27263L7t7d2q7L7c7u7M3M3L7b7c/t7c2ppmpmt2lmlmpltmtm122Yyqyr3M267c7c267c2qyq3LyZ7c7t7c7t7L7t7M277M7c/t/t7L7Lpmpmt2lmlmlVt2tmtmx3yayr277L7M7c267LyZ263LuJ2q7c7t7c267t7LyZ7L7M7t7t7L7Lt2pVt2pllmpVx22Hxmx3uZyr26277M7cyqyquZyqyaloyq3L7c7cyq7d26yZ277M7d7d277MyHpUyGpllmt2t12G2H2ZuJyr27267M7M67yauJ2727p5yq277c7tyq7c7Lyq277M7c7c267L2opUyGpllm6Wtl2G6X2quJya26663L7L2ql4lnuJ3M272q7L7c7d267c7dyq277c7L7c2q7Lt3pUt1lmlm6Wtl6X6XyquJyayqt3uZypyap3t1uIqK7MuJ267L7L2q2p3L262q267c262q26lVlUlVlVtl6Wx12G2X2suJuaua267L7d27yH6mtVuJyq26262p262q2q2pyZyp267L2626yIpmlUhFp2pl', 'base64')),
  ('c018', decode('mtu9y8283M3My8y87curZ4dXt51q161Z2J2a152J2J15040404k3g3g3g4lIpZhpyqy8u9u9mtmtqty83M7M28eJZnhYxp2K162K151Z1Y1p1p2J2a2a1I041Io4g3g3g3g4hJdpuZ27y9y9mtmtqtqtqrd4dXpY1p1Z2K1p1Z15151Y1I151p1515261I5I0404w4o3g3g4hJhpmJ27y9y9mtmseKZXhYtph6mKx52J2J1I1I1I1p2a151I2J2K2J2J1I04040404041IxIpZhZiI262828VodXpY1Z1pdYVXVGRGVGdXpYxp2J2a3L1p1I26151p2J1Y1I041I1I1I1I1I1Z1qh4663M3MpY1p1J1I1ZU1VHVGVGVGU2VGZGdXloqJxIxYyJ2a152a2J1Y1I0404041I1J1p16h5667M7MxpxJxIw404Y2RFU2VGU1U2ZGZGU1U1U1U1hXp4t5yJyJxIw404045I1I1I1Z1q16l52q7M/d1Z1I0404xpdXQlMjMjMkQ1U1dXZGZGU1Y2dXdXh4qIqIg3o3oos4s41I1Z1p162Lp6uZ7L/t1J1I041I2J2qyqtYhoZGQlQkQlQkUlY2lohnl4upuZc2cmonsnonoos41Z1q16x6t6mZ7L/t1I5I041I26152J1o2a2qxplHc3Q1U1ZGl4p4qJhHcmgmgns4w4s4o4pI1p16162LyLd466/t1I04041I2q2Z1p1p1p1I04041YdXhXt4lXqJuZt5pYknons3xItIpJpJxqp5hoZoRWVX66/d1I045I1p2a2J1o1p1515152J15t5uJ1pyKt5pHknono3o41ZxZtZlYdoVXRFRFQ1M1VWuZ/cxJw41I2J2q2q2Z2J152J151p2qyatpyKpIs4s4o4o4pIlZhpZnVWRFQ1M1NFRGRXRXZnh4/cpJc4g3pY2J2a2a152J1p2a272rxItIxp16xZtphYdoZnVWRFRFRFRFRXRXVWRXRXRWdndn67xZpIg4c4hYqJyayK1p161Z1Y1Z1ZxZpohoZnVWVFVFRFVWVXZnZnZnVnVWVFRFRFQ1ZWuauZ1p1Z1Z1JtZuKpZtJtZtZxZtplXdWVVVFVFRFVWZnZod4d5d4dnZWVFVFRFQ1Q1Q1Q1VF28uq161q1p1Z1Z1Z1ppYhXdWVFVFQ0Q1RFVWZnZ5d5d5dodndWdFZFVFVFVFRFQ0Q1Q1RFVFyq3M161q1qxplpdoZFVFQ0Q0Q1RGVWVnZoZoZndndWdGdGZGZFZFhGZFU1VFVFU1U1VFdmua3M3MlphoZXVFVFQ0Q1RFVFVWVnVoVWVWVFZFZFZFdFdGdGZGIkEkZFhWdVdWh3qIuay87N7N3N3MVFQ0Q1RFRGVWVXVWVVVVVFQ0Q0Q0U1VFZGdWdGhGhWdFMiMiZEuIuI7L7L7L3M3M7N7d3M3MRGRWRWVWVWVVU1U1Q0Q0Q0Q0Q0U0VFZGdWhWlnuJuJmJM1Q1uIyp2q7L7L7L7M7M7M7c7M3MVWVWVFVFU0Q0QkQ0Q1VFQ1Q0Q0U1dWqIuZuZlnqIqIRINHI2Q3277L7L7L7L7L7M7M7c7M7MVFQ1Q0Q0Q0Q0Q0RFVFVFQ1Q1Q0ZGdWuZuZuZyqh5RZNZNINIRIl57L/s/c7L7L7L7M7M7M7MQ1Q1Q0Q1VGdnl4qZuZVFQ1Q1Q1ZFdWyZ7L26qJNININIVXVXVXVHp5/s/t/t/c7L/L/L/L7M', 'base64')),
  ('c019', decode('a+StSta+fOOdKMKMKMKMKMKMKMKMKMKMKLKKJ4J1JkJkJUJDJTJUJkJUNkJkWGNkR1WWSFWGKMKMKcOcOdKMKMKMKMKMKMKMKMKMKMKMGMKLKKJ3J0JkJkJUJUJUJTJUR1N1aWN1WFWGR1WGKMKMKMKMKMKMKMKMKMKMKLObKMKMKcKcGMKLKKKIJ1JkJkJTJUJ0J0JkN1R1WWN1IzIzR1N1KcKcKcKcKcOcOdKcKLKJWoa4SqKcKcKcKbKKKKKIJ2JUJkJkJUJkJ0OFOFSFWmWGNDMzNkSFKcKcStOdStatSsJ5KISoW3W3a4WpKdKcKcKaKJJ2JkJkJ0J0J0J0J0N0OFSVSVNkJDJDJEWWKdSti9e9WtOtKKJ3SoSna3e3a3a4OsOtKsKaKJJ2JkN0OEOFOFOEOFOFWWSVWVN0EzFDJDSFOtStjNStOtKLJ4KIOHWoWna3a3W4a4O9OsObOZN2N0OESFSVWlSVSVWmWWSVWmSFFDEzJUOFO9reW+OtOaiXOYSoe4e4SXa3e3a3a4W6O9OsSZSGOFOFN0WVSFWVa2e2e2amaWR1FDFTJUSFW+W+S9ermHuWeGKXOHSXa2a2a2a3a4a4S9S8SZSGSFSFN0WFemRki2i3i3V1NDEiEiEzEzJDiaerqXqGuWqHllSHWoa3Wna3WoWoe3W7W9W8WqSXSFSFWVaVamWVe2i2i2R0FDFDFDFDFDFDh2qFuWqGyWt1t1l2KISYWpWoSoOoa4fNndjNaqWYSGSFNkWFe2aFi2WVaFNUEzEzFDFTFjFkl2llqFuFyXuXyYqHq3aoWoW4aoWqjNvezuvdi7WYSWSFR1NkSFRkRkSFJDFTFTFkFjFkJ0J0qGp1p12m662p3c3bq3nHnInGrHe3vb3u3uzdnLaoWWSFNkJDEiEiEiJDJTKEKEKUKUKEJkOFmFiVunmXyouGm4imineneXiXeXWHm63u3uvdnLaoWmNUIiIjEiIiIjIzIzSFSFNkJDEiEiJTnHnHrHe2ali3ini3m4i4m4enSGJVNVi63uzurLe4anR1IjIjRUNDJDJDIzESESESESEiEiIzm2i2SFSFama2i2e2emOFen3avIOFNWOG3uzurLe3R1NUMzNDNUIzESESESESESESESESESESa2SlJ0J0OEKEN1JkJkJkaFm3WWJlJlNlzuzdvbinIzIjNUR0NTIjESESESESESESESESESESJ0OFOESFJkJkJlNlRlRlV1SFJlJlJVV3zuzdvbrIRUIjIjIzNERkRUIjESESESESESESESESJ0WHJUJkJUVlVlV2RlRlJlJkJlJVRVeJzuzdvcm4RUESESITESESIiMzREMzIjESESIjMzIjJkNUVlaGqnqnaGaXN1JlJlJUJEREREmqzuzdvcm4RUESESESESESESESIjMzRUNERUVlREREqozJ3Zm3e2WmSWJ1FkFUJENERERFVVmrzuzdvcrJaFESESESESESESISESESIjNEVVZ2VVNErI3ZnIWma3WmJ1FkFUJEVVRFRFVVVVq73uzuvcrKZ2ESESESESESESESISISESESMzNERVRVm3zISlWlW2SVJkIzI0VVVVRERFVVZWq83u3uzdm5Z1IzESESESESESESESISISESIjM0M0M0amq2SFOWOlSmJ1JkNUSVRlNERVRFRVq73uzuzdvaeWNEESESESESESESESESITIjM0M0IjIz', 'base64')),
  ('c020', decode('243J3J3K3K3K3J243J3K7bqouoZnh3y5qYmId4VWVFQ0ZVpltlpVplplplt1lDYihUynynyn243J3J7a7a3J24yV3J7a7b3Kh2ZmmYu5y6uYuHt2lUUiZEplplt1uFuVymyWlDYiqG24243Jyn243J7I7Z7J3I3I7a7a7b3KmHVWiIyo2X6n6opkpDlEdDuGyWymyn24y4ynhDYy253J3J3K2423243J3I7Z233J7J237b7ay5VVtl2X6o65lTgzxltkt1tU2n2n24242424lDYz253K3L3LyW2424243J24237I3I7b7b3K7Kl2lEgytl65tUhDyHxlx1kzx22n24243JyolUYiuY3L3b3bx0yF2424243J7a233J3K7K7a7ayptkpUlU6X112X6Y2G11lD2H24243J3JyXlUYiqF3J3L7bx0yEyE2n3J243J3K3K3K7a7a7a7b2H2G6X6n6H2G2Y6pxldDlldkZUuoqVuWYzczhThT223IdDpjpTtj2W3J3I3J3K3K7K7K7a7a2G6H662XplhDhD2YpUUyMzMiQ0h2dUhkQzZUhkhTdCZCQyUypUlDyEyF243J3I3J3K3J7a7a2X2YyYplx3tmtmt1UiMhIiMiQ0h2l1lDcydThkdTdCZCQiQidDpkx02EyEx1243I3J3J3J7a3KlluHx32Z6q1lUiIQMiMzQzQ0h1l2xk2WtTlllkhUdTQiQiQyplpTx0yE2XyF25243I3J7amHVFUzll2HtD11QhMRQ0Q0M0ZVhmt12Xyo64tUlllkhkMiQiQiZDx2tTx02ntkyEynumul3JdmQ0QzQhlUhDYyQiZERFQ0VFZmREplx1lltlx1lDdDdTQiQiQiQilUx1tUxkt1lkhjdTdTl0h2Q1MzQzUzUyQydEZWVFVGdnVFhmyH6o652oyGpUdDdTYydDQiQiUylkxlxl65pkhkhkhkhUqYZVQ0RFZXdWhVdnZWZWZWd3VEhmx22G2X2Xx2lUdDdDYyymdTQiQiQidDx164tllkhkhlhlZmmIVFVFZXmJmJh3dWZXqZdnRFdVyX/a7K7J2XhDdDdDQihkynZDQiQiUilT6otkhkl1l1l2VGmIh3ZWZWh4qJmIdml4u7ZWVGZnpm6o656oyGgyZDhTMiQip123qFllhDtUx2lUhkl3uXu4h3homIqpl4l3qIqZl33LmJmVd3ZXp2/a/q/a6XgyUyZDMiQiUyuVyW656o12pDhElkuXynq1ilmWmIy67b3Kyoyp3b3LqmmHhndnhn2Y25/a2FgyQiMiQiMiQiUyhTp16665lVdUqFynyomHinemi3rI7s7s7s3VrDnDq3y6mIh4h3dmuo/a11lDQzQzQiQiMiQiUidUmJdnZWl1yo25ypyq3Lqne2Sl7I3Im1uUiTWUq43Ly6qZqZmJy5/a2FdEQ0VEUyQiQiQiQiYyl1h3l3uXuXzK25131V2j7Vqk7V/X6G1X1F2juTtE1n3by7y7up25qYZmVVVFymuVuFZDQiQiUydDmGyoy42n1iw0016j6zqT/V7E5z02016T7TpT00yF3b3by5uYuqmZdnZW2222uFdWZEQiMiUyqXWEWUaDuD1Uxl2k20ykykyUuEyV2VyVyluF11x0u2q3q3uYuqqqmZd37H23hmdnqZmHZDUyh0ZzlzqCqCuSuSuCuCySpypylyqCyShSdDhilipyuDqTylymy5u7qrqn', 'base64')),
  ('c021', decode('y6yq3L7t/9/97c3L26yaybyaybuauKdWMiISQjYkUjUjQjQjh3uauKuKuKuKuKuKuKya27ua3L7t/9/t7L267L/b/b7L/L/L7L66ZEMSYjhFl4hWhWhWdFY0MiZEyauKuKuKuKybuKya272r/9/t3L3K/b/b/b/b/b7L/b/b7LdUuYYjYjl4qZqZmIqZuahWczl3ZV27ybuK2ryauKqKya677c3K/b/r/r/b/L/b/b/b/b/buXmHp2YjYzhmdVhWhWhnhWhWYjp3dWyo7byb27yauKyaua2r7b/r/r/r/r/r/L/b/b/b/c/cdV7KhEczUjUjYjYzY0c0YjYzUjlVyZhV/r/r2ruauKuKqKya/b/b/r/r/r/b/b/b/b/b/L662p66hDczdFhFg1dFc1c1dFdFUzhE/buI2q7b2ryruKuKyauK/b/b/b/b/b/b7L666q6q66uYyp66Yjhml4ZGQkITITITQ1dGl4dE7buZyZ672r7b2rt6uK7L27677L7L6q6p6q677L/b7LqHyop2QjdGQlMjUjY0Y0QkU1MkU2ZFqHqHyp672a7LyauauKuayq7L7b677L/L7L67/b/b/byIdEQjIRUkUkUjZElmlmhVU0U0Q0ZFUzUz256727yaya7L7L7Lyqyb7b7b7L7L/b7L7L/b/bp2U0MjISYkUzY0hVlmhWdVUjllU0pmhVU1uX2r7LqKua662q7L27uK27/b/b/L7b/b7L7L/bhVQ0ISMiY0hVhWdEYzhWhVU0dFZFlmlmY1lnya7LqKua6627/s7LuKuK7L/b/b/L/b/b7L/bhmY1MjQjhVlnhoqJhVlWlnhXdFlVpmpmY1pnyayaqKua6727277buKuKuK7L/c/b7b/b/b/bl3U1U1QjlmqIqJp3p2lmhGpnlWpmpmpmdGyJ6r2auKua7L/c/b7buKt6uKua7b/b/b7b/b/b2qhHhHQkhVqIqIqIpmpmY0polWpnlWlmt56r6r6r2r2q677L7L7buat6t6t6yb7L7L7L677L67hWt5lnhFpmuIuIpmuHdFpopXpXlWpn6r6r6a2ayq676a6a6a7Lyat6t6t6uK2a6a676q6a6ap42a2ahWlVpmp3YzdFhGpppXlXhFt42b2a6a2r6r6b2b2b6a7L2rt6t6t6t6uK2a6a6a2b2buJuJqIZFdWhVdVdEZElHtplXhWhFlmyJ2a2b6a6a2b2bybybyq2rt6t6t6t6t6uK2a2bybyauHdVQzQ1U0ZFlmlmlnpHtplYdWdFUjYyhDx22Z2b2b2b2b2bqKuKt6t6uKt6t6t6uKyZp2hTUzUzIjMkISISZVdWhWdGxZlolVhVUzMiQiYyhD2J2b2b2b2bp5t6uKt6uKuKt5uHlkYzQiQiQiMiEBMkY2dHQ0U0ZFU1lHpplnlVhVERMRMRQihEyaybyaqaYzhWp5t6uKuJpkdDUzQiQiQiQiMiERESMlZHpYtYtYhHQ1tplnlllVQyERERMRUip2qKZ3JlYzYzhWt6uKhEcyYzQiQiQiQiMiMiERABIjhIlZ1YtYVHIkpXpolmlVllEBERIRQhhDZ3N2N2qYuqdEt6pnYyUyUiQiMiMiMiMiMiERERABIjZHdHZHU2ESY1tplnlmllQzIRMhQhYyRlzdaYhVqYYzp5lmQiQiUiQiQiISERISISERERABABESITITESABISxZlolmlVplERIRQiYyJlaYip', 'base64')),
  ('c022', decode('W+bOfOfOjOnereaJNFRWqIuGtklUNFNGNWNGNGaJV4I0IjIjIjIjIjIjIkMlMkVW3e7/3vzvS+W+XOfOjOjOaKNWNFZmuGuHlUpjlDdENFNXeaNFI0IiIiM0I0IjIjIjIjIjIkIkVF3e3v3vO+WcjOfOasRnNWNFNFZllUQ0I0I0RFZnNoaaNFI0M0MzIiIzM0M0M0M0M0NFNEIzIjRFq87vbObOe9SJNnNWNFNFRnRURDM0I0NFNWNoRoesIjMzNFNFIiIjIjIjIjMzM0NFNFNEMzMjZn3ea+a9R5NnNWNFNFM0NFIzIjNFNGNGNXNoR5VoIzMzdml2MiIiIzIzIzIjIjMzM0M0M0MzMjVFR5R5NnNXNWNFM0NFMjIjIzNFNWNWNXNXNXI0Qzll6565hUIiIjIjIjITITIjMjIjIjIjIjIjNHNnNnNWNWNFNFRWIjIiI0NGNXNGNGNXWKM0p2lluGlkUzIjIjIjIjIjISITIjMjM0MkIjIjM3NWNWNWNWNWVnM0M0IiIiVWRoR5WKe8jONFll6565yGdUM0IzIzIiIiIjIjMjMjMjMkMjIjNGNHNWNWNWNWRWM0M0IjIihnusmbqrZnM0MzZEyHt2plMiNFNEM0M0MzIzRWesVXMjIiIjIiNFM2NGNWNFNFNFM0MzM0MzdW2s2sdW2sdnM0M0dElUQyIiIiM0M0M0NENEREm9vOVXM0IiIiNENFM2M2NGNFNFNFM0MjMzZW2s29ZFys2sZFM0MzIiIiIiUzlWRFNENENEVWneneWtRGMzIjM0NFNFVpM2NGNFNFNWNGU0dG2s2sVEy82s2bU0MjIiIiQzyK2bh5NENENFeJrejObOWbM0IiVWRWRWRXNGNGNGNGNWNGQ1Y0tot5Q02b2s2sybVEIiMip52bx5urNVNFRFmrrejOnOfOVoMjd4vOV4NWNXNoRXNWNGNGNFU0pGg2ZFx62b2c2b2sp4poybyblWZWV3NVRVmrvfrO68nOrORFiJisZ5VoRoRoRoRXNWNGNFNFRVNVVFpY2L6s6c28uKl4uauahWpoeaNVNVVmzeve3N3vveeKeJVXZ5RXRoRoRoRXRXNnNnNnNnNmNmhFxp6c6s2928uJ2s28t5pXmKNVNUNVmqzvzv3vvfm9rezeZ5RnRnRoRoRoR5N4NWNWNmNmNWZFpX6b6s29286s2s2spXlWZVNVNENURVzezvvfzeqrrOrfaJRXRXRoR5RoRoN4NnNXNGNGNGRWpW2K6sy8yL2L2bt5hFhGRVNUNENENUeJzvzvmbVX3NreZoRWRWRXRoR5RoNXNGNXNnNnNnNWlWxYyKt5t5x5t5lWUjM0NFNFNENVNWRmvN7v3vRWzeq8RFNFNFRnRoNXNGNoNoNnNWNFNFRXlWtXtXpntXtXlGlFQiNEM0M0M1NFNGNWaJ7vZ4MzvfRWMzM0NFNXNGNGNFNFNFM1M1M1NGVnpXtXlGlXpGlFhGg0QjMjNFM0M0M0M0M0NFiaM0IiebMzIjM0NFRXM1M0M1NGNGNGRXaKV6d4lWpGhGhWlFhFdFY0QjMiNFNFM0M0IjIjMzM0MzIiM1IjM0NVRWNFM0M1NXN5abiKRXaKabhWk1g1hFdFhFc1Y0U0QjMiNVNXNWNWNFM0IjIjIjIjIjMkNENERFM0M1V5WbObmbqbaKaKaZc0g0c0dFdFdFU0U0UkQjMiRmV4NWNnJoNFM0IjIiIi', 'base64')),
  ('c023', decode('7N7N7N7N6L7N6s5p6s5p6s69qrFFESITNGI0AiEkM1FWBWBXBXBYBZeL7N7e7N6c7N7N7N7N2b6L6L6L5Z6L6b69297N6L1Z1IongmcmcmQDI0JnRGE1A0A1BFBYBpeK/u/u7N6L7N7N7N7N69686s5q576c566c2s2L6s6928ZnibZ5ASASAjBWAjABASAkA1BYBYec7e7O686b7N7N7N7N7N7N7N5Z697N7N562L7N7NusZYQ2qcqsE0ASASE0Z4I1FGA1JFBGFYy97N7N56697N7N7N7N7N7N6c5q7N7N691q6929ZoQmk4tJyLqseJI1u8usiKusmbu8qsE1aJ7N7N7N5q7N7N7N7N697N7N5q6L7N7N6b16qbMmg3tJtJxJxJu93Oqs3Oy9zNd5mby9mbqby97N7N6c6L7N7N7N7N6L7N6L6s6L7N7NxphIIlknxJxJxJtJg3JXqsy93N3Nmbus3Ny9y87N7N7N6c6L5p7N7N7N7N165q567N5p576Lw4QlIlsnw41IxJtJlYu83N3N3N3O3O3O3N3Nub6L56576s296s5q1q16571p6s7N3N2c6b1qs4gnknknwnw4tJxJus3O3N3N3O3O3O3Oy9y9VXys696c5q6s2L687N7N56685q6s1q6s7N1qdpBGFGFGk304xJ17y93O3Ny93O3Oy9qriKpZhIdo7N7N6b6b7N7N7N7N5q7N6L2L2L7N7N1py8BGBWBWE2pIxI2czNzNzN3Nqcy93OusqLxJpJIlZXub577N7N7N7N6b167O6L167N7N6s2burJWBGBWBWFWpI2L3OzNzN3Oy9Zoqby929xIpJEjElMUlXl57N29y9x6ys68162c7N7N2bqaiaeJA0BFBWBWFWpp3OzNzN3N3Ousy9ea/v1ZdHE1Qlg3lHpHxY56qb3Nqs1q1Z7N/e/eqKJGd5E1AkASATA0BGWJu83Oy93N3N3Ou9eJ/vxJIkBGETYlABIlIlQmo3qbzNys6c7N/u/vmaEjASACAjM1ETABASA1R5u8y9u9uty9Zozd7NhYA0BFASMTEUMmIlIlhI3Nu93N7N7eur7eZnIjACABAjIkRXASABA2BZE1eJiririazM3u2sNWBFIjQkABIUIlIlIlubusy9u97NqbEjVnABABABACASQ1BFBFAjBHFIA3Ekqr3d7u/v3uqbNXyb6s2cVFETImIlMlqcy9qcy928ETABABABABABABABVHRGBGBGA2BIA2mrh5iKvMq87eZmyb6s2s2s2sVFIUIlY2ucqsy9y9M0ABRFqrmriJVWIiARABM1NGI1FHBIRn/v/u7uusd53Nhn2s2s2s2s2s2sIjIUY2h6y9zNusABh47e/u/v/v/v28ABASACAjAkBHA2qa/u/u/u/v/vmKho2s2s297O7e69uaETUmVYmLmMmLqa7e/v/v/v/v/v7NRFABASAjAkA1JG2b2s7e/u/u/uybMk7O7N/u/u7N2s2shYMlZZmLmLmL7e/u6s7e/u/u/N69qqABASAjAkAkhp2b2L2c7e/u/e6sQ0ys7e7N682syr2s2bMkZYqLqLuL/u2sxZ166s7N6b297eEiASATAkE1yb2b2b2c2s7O/u7eM0l42s2s2sybQ0qKybl4U2yLyLx7/u7e2sxpxq2b1q2s69dnASASAjd5282s2s2r2s2s7N7ed5ZWuKybuKMjAAMj2s2sho2bybyc', 'base64')),
  ('c024', decode('ZWZWdWVGVGVGVGVGZWhmdWdWdWh2hmhmdVU0UzpVlWpWlVZEpFtmlVdmdmZWZWZWZWZWeHd3VGZWdWVGVGVGZGVGVWd2dWdWdmh2hmhmdVQzU0hVxmtmtmlVqHuHiHdmdmZWdmdmZWZWh2dmVGZWZnZWVGVGZWVWVWZWdWdWdmh2hWhmZEQzU0pVx2xmtmpVt3qXh2hmh2dmdmdmdWdWZFZFVGVGdXZWVGZGZWdmZWZWdWdWdmhmhWhmZEQ0U0hVpWtWtV0k00qHl3lmhmh2h2dmZGZWZFZFdWdnZWZWZWdWdWdmZnVWZWdWdWhmhWVEQzQzVEdVmpmHxFxFxVmHl3lmiXeHZnZWZWd3ZGZFdWd3ZndWZGdWdWdmZ3ZmZmdWdWhmdVVEUzU0mXmHqYrKq5q5tmqHl3l3dnZ3ZndmdWd3ZGZFdWd3ZWZWdWZWdmd3Z3ZnZnZmhmhmhmZFZldVqHqYq5nKmpmYqYqYl3h3hnZ3ZndmdWhmdGZFdWdWVWVWdWdmd2d3Z3Z3Z3Zndlhmq5rKrKt3xFq5mpmYmHqHqYqYl3h3hmZ3ZndmdWhmdWZFZXZWVWVWh3mId3d3aHd3Z3Z3Z2dmrKq6qpw0mHmImYmYp3moqYqYqYl3mIZ3ZndmdWhmZWZFVGVGVWh3qYqYiYeYeHd3d3eYZ3d2mYmYqYtFmImImYmIl3qHqYqYqYmHmod3ZndmhmhWZVZGZGVGd3qpqYqYmoiYeYiHiHioZ3d3iHqYp3tFmIqImYmYmHp3qHqHqHmHmHmYiHd2hmhVdVZmZWdnmpmpqZqZqpmoioiYiHiYZ3eImHmYp3tFmIqImpmYqIp3p3qHmHl3l3l3l2h2iHdmdlZVd3mpm5m5mpqpm5m5m5ioiYeYZ3iYl3mIp3tFmIqYmpm5qpp3qHl3l3l3l2l2lmiXd2dWZVZFmpm5m5nJrKm5m5m5m5m5iYeYeIi6mImIp3xFmImYmpqpq5mpp3l2l2l3l3l2hmdmdWdVdVZFd3m5m5rKrKm5m5m5m5nKm5ioipm5mYmYpmxEmImHmImImImol3l3hmh2h3h2hmdWdWdVdVZFVGiYm5m5rKm5m5m5m5m5nKiompmYmHmYpWw0l3mHmHl3l3l3qIhVdVdVhmhmdVdWdmZmZ3Z3VGZmm5m5qpqYm5m5qYl3mYm6m6mpmHp3tVxEl3l3l3l3l3l3p3lWdVZVdVdWdmd3d2Z2hVw0VWVWiIm5qpt3uHmIl3l3hnmIq5m6mIp3tVxEmHqYqYqYqHlmlmhVdFZVZVZWdVpEs0tFw00jVWZmZmmpmpt3t3p3l3h3hnh3mIq5h2ll00tVqHqYqoqHmHmHhmdVdFdFZVZVkzxEqHmYtF0TVWZmZmeImpp3p3p3pnhnh3h3hniImXtFt2mYmompm5m5mpmHhmdVZVdVdVdVwTs0w00T0jxWVmZmZmZmh3l4l3pnpmhmhnh3hndnhndmdmiHmpm6nKm5mph3hmdVdVdVdVhF0jxFt2qHt3xVZmZmZmZmZmdWhnl4mIhnh3h4hnhnhniIiImYmImImImpmpmYh3hmdldmiHmYmptm00tFs0k0ZnZnZ3iYiYZmdmhnhWhWh3h4h4h3dWhnhnhnh3h3h3h3mIiHmYmYmYiHhmiHmIpWo1lFlEhFdnd3ioioipm5mYhndWhmh3h3h4hndWdXdnd4h4h4iImYmpmYmIl3l3h2iGeoiYlWk1lFhFhF', 'base64')),
  ('c025', decode('MlM1M2RWQ2RGRGQ2RGRGVHVHVXVoVoZoe5eIZXZXdndHdXdneJd4VGRGRGVWVGQ1Q1Q1Q1Q1MlM1RGRGQ2RGRGQ2Q2Q2VXVXVXVXZoVoepZndXdXdod4d4dododnVXVWVWVGQ2Q1Q1Q1Q1Q1MlM2RGQ1VGRGRGRGQ2RGZnZ4ZXZnZ4Z4eZZXdod4eqeqiqeZd4dXVGRGVGRGQ1Q1Q1QlQ1Q1M1Q1Q2dXpoZXhYpolXpoZoeJeJZ5aJaJaJd4d4eqi6i6i6iqeIdnVGVGVGQ2Q1Q1Q1Q1Q1Q1Q1dHpoZXZXt5yKpo16poZoeJeqeqeaeqZ5eIeZeqi6i6i6i6eJdnVGVGVGQ1Q1U1U2Q2Q1Q2Q2Q2RGdXhoholotpt5uJZ4eZeqi6i6i6eJeIe6i6i6i6i6i6eZdnVWVXVGU2dGpopoloZWVWQ2Q2Q2RGRGRGRWVXVXZ4Zoeai6i6i6i6eqeJeqeqi6i6i6i6eZdnZnVXVGVGhox5xox5lXpXQ2VGVWdGVGVWRWVXVXZ4Zoeqi6i6i6i6i6e6eqi6i6i6i6i6eZdndnVXVWVGVGVGhXdXhXpXlHxpx516poVGVXhnVXZnZoeJeZeZe6i6i6i6i6i6i6epeZeId4dodWVndndXdXVGVGVGVGVG16151615toZXlXZXV4VnZnZ3ZndXdneIi6i6i6e6d4ZWZWZWZnhXZXZn2K15poVWVWVWVGVGpopopo16holXhXV4aZVnZXSHOnSXV3VnZnd4Z4dnZnV3OYSoWYdHx5166K2KhoVWVWVWZXpoto16lohXhXxoVXaZaJVnVXWHOoOoOoOoV3ZXZXV3OYOYSoWnZ3VXeJto15hoVnVWVXVWlo16tphoVWVGpoVXVoaaZ4aJVnZ3WmW2W2Snaod4d3SHWnW2WnWWdXVXaZia6Lx5ZnZnZnVWVXx6VXVXVXVXVXVXVnaZaJaaZoZod4aYaoe5e5e6eqd4aHZ3ZndnZXVXZ4aqma2Kl4Z3VnVnVXVXVXVXVXdnZXVXVnaJZ5aJZoVXeZe5e6e5e5epeqeJd4dododXVGZ4ZnaqaqaJ2Kh4Z4Z4qKx5VXVopotohXVnVnV4Z4Z4ZoZnepe5e6e5e5eJead4dododoU2VGZ4aZaZaqaZeJeIaJeJ6L6KVnV4qKhox5lol5doZ4ZoZ4eZe6e5e5e5eIdndodododoZHU2VGVoeqeqaqeZqJiJqJeJd42KVnV4aJaIeJ2K6b6bt6aJaqeqaae6e5eYeIdodnd4dndXY2VGVXZ4eqe6eph42K2KiJaJeJt5Z4aJaZeJeJaJaJiJeJVoZ4VoaqeqaJeJipeIdndXdXdHVGVXVnaZaqaZiJ2KqJmJeJaJmK16aZaJh516t5aJaZaZaJZ4VXVoaZV4aJeqepipdndXdXZGVXVXZ4aJZ4Z4h4iJeJx5uKeIeJx5aJaJaJmJuJaZaZapaZZ4VXVXVYVXaqaJeZi5dndHY2VGVXVXVoZoZ4Z4Z4Z4aJmJyK15x5x5aJaJaJqKuKiZapaZaJVoVHVXVXVYZ4VoeqeIZGU2U2VHVGVXVoZ4ZoaZaZZ4eqaqaIaJeJmJaZh4h4t5yKepapapa6Z4VHVHVHVYVXaJVoZGVGU2VGU2VHZXZ5ZXZ4e6aZZnaIaJWJWZaZaJaZaZaJloh4a6aqa6a6aZVYVoVXRHVXVXVHU2U2U2U2U2VHZ4Z4ZneZe6apZ4apZ4V4aZaZaJ', 'base64')),
  ('c026', decode('6KxYo2o1w3s2MjERAAMSxo6b2KhXQjQjQjQ0QkAAEBMSAAEBAAg1klckERQjYkw3o2tXtoIi6b6b6KxYo2YkMjAAISo2klpnZFMjQjQkU0U0MjQiERUjISERIRAAIRUjMSMzk1o2xp15ckESpG2K6b6b6LU0AAERo2o1g1hWQjQjQkU0Y1U0ERMiY0c1dFc1U0MiERERQ0glo22K1ptHxpyJ1pxYxo6b6bdFAAhW2KtYhXQ0U0ZFZGZFdFZFMidFY0hGlWpXhFQjISERUTpG6L1Yxo6b6bdW1615162K6bZFMj6b6blXU0dWhXp5uJuKp5dWMjZFU0dFpnhGY0MiESERAAERUj2KloZFZFVF2b6b6b2KxpVFln6b2KlnU0dWp5t5uKyaybloQzQ0ZF2K2KhFMjMiMiISAAABISVFhXZFZFlnxp2K6b6b6bZGhW6b2KpoY1dWp5uJyaybyauKdWQ0pot5pnQ0ISUjQjERABIiMjMjZFMzIiMjtYpGo2tXtXhXZF6b2bp4Y1hnp5uKybybybyauKloZFhWlXQzUjU0QjAAAAIidWIip4hXg1MSk1glklo2s2hGQ0yK6bt5U1lot5yayayryrybVEl4ZFQzQjMzIiISMjIjM0MjMjQ0Y1k1s2w31H1H1Hw3s2k1hXc1s3loZFlouJyayaybyrybhoZFQ0IRMjMiIiMzISIiIjM0ZFY0Qjs21Hw31H1H1H1H1HY1VFMic1ZFdGhnuJybyryayauKp4U0ESIiIiQzMzMjIiAAIiQjo2UjIiQjMzkls3s3w3w31HUkIjp4IjY1dGZFZGQjVFdWZFdGhXQzh4y8mJIjM0MSQjERIiQjMSAAERIjMzMjxH1H1H1Hs3hnZFloERMjhXdWdWQ0IiQ0VFlol4Q0urZWurMjMjMjIiESAAERMjAAAAIiERk21H1H1Hw3o2ZGVFVFERISt5yalnlXdGhnlolouKMjZnurd4MiERM0RFIjAAERIiERAAMjIig1s2o2kls2g1ZGM0U0ERMip5yrybuKqJl4hXt5ybdGMjIiIiIiERMSMjM0ERESIiABIiVFM0YktHk1s3xYlXZGMjQzERMipouKyKyKyalnlnuKyrp5lnZFU0Q0IjERERMjIjIiERAAERdWM0U0xHxp6L6bt5VEIiMjERIipopot5yKuKZFdWuKyrloQjlodWMjMzIiIjERIiIiAAAAMjZWESdF6b6b6b6byJZFISISAAEBlXpopouKlop5hXZFU1dWdWdGpoMjMiMiISERIiIiERAARFMjERt56b6b6b6b6bt4QjERERAAU0lXpop5lohXhXlXloZFU0dGlXIiISISIiIjERERERMjIiERQjtX6b6b6b6b152KlnERERAAISdGlXp4dGdWhWZFhnuaQzdGlnMjISIiIiIiERERERERERZFtHo16b2KxotG2K6bQjERAAERAAZFdGpoZFdWISVFZVIiEBdGlnU0ERIiMjIjIiERABERERU0t5xptHw3o22K6b2bU0IiERAAAAMjdGhXY1U0EBIShGhHQjdGhXY1ERIiERERIjERAAMiU0IiERISw3s2xo6b6bpodWAAAAERISEBU0dGZFQjQjlYpYpYlXhWdGU0AAIiIiAAERAAERU0hWyJhWYkw3pG6b6b6bhXQzAAERIjABERISY1dGZFtppYpYpplnZFU0ISERERIiERAAAAISdWQzx56b6L', 'base64')),
  ('c027', decode('VDUzdUh2h2mGqGqWuFuW247b3Kt0pkqXqXqXqGp0p0uF2n7K7s7c7b/b7b7b3Kunp1l1llhUUzZDZDmGmGmGlDuFyW257b/s3Kpjunu4unqWqFuFyn7K7c7a2423237J7s7b7szJqFqFqGdDVDZDZDhUl1lTlTyW3J7c/b/synpky4u4unuWuF247c7s3Jymymymym2m7c/s7t3bunqWlldDZDZDdDhDlllCpk3J7s/c/s7syWp0p1u4unumyn7c/s7byVymymy2y3237b/s7c3KuWlThDhDZDdDdDlkp1pkyn7c7J7b/s7buFp0p1ununum3J7t/s7a24ymymy3zI247b/s7byopkp2lkhUZDhUhDlUpkuG7b242m7b/c3Jt0uFuWunqXqGqXzK7b7KyWyWynzJynyW7s7b7ayouXqXl1lUdUl1l1p1p1y3yoyFym7b7b24uFuWqWYzURQRQRUhdTuFt0uVuWuVt0257b7b3IpTpUp2p1lDhUlll1p0uGuWpkt02n7s7bynuFl0UhMRMRMRQRQRQRYyp0qFqFuFym7b7b7auWpkpkp1lUlTl1l1l1lkp1pkpTt024/s7bymt0UhQRQhQhQhQhQhQRQRYyqFuFuF257b7by4pklTpTlTlDp1l1mGqWp0pkpUpjtj3J/c7ayVhTQRUiQiQiQiQiQhQhUiUhqGuW247b7b3JuWpklDlDpTuFuFcyhDqnqnp0pkp0uE7J/b7ayVcyUhUyQiQyQiQyQiQhYyYzqW3J7c/s7ay3uGpkpklDt0ymt0gyhDqnp1lUlDpTuF7K/b7JyFYyUiQiQiMiQiMiQiUyUyczuX7c/t7c2nt0pjp1pkpTuFympkqoqGqollgylDpTyV7K/s7JyEcyUyZDQyVDVDQyQyZDUyYyhl3b/t7JyVpkpjuFt0yWuFuFpkmGhUgygygyp0t0yW7c/s24yEdTZDdUdUZDUzUyQiUyZDdDhUu47a23uFuEpkt0uFymt0lCpkhDhDlUhDunuFt024/t/s7IuFYydDdUdEdUUyVDZUUyUyYyhkqGy4ymyFuFuFyn2nyWtkpCpThDhDl1lTpkpjyV3J/s/t7IyldDdUh1h1dldldldlZDUiUydDllumymyFym3I7b7Jymt0pTgylTlUqXp1pjpT2m7J/c/t7J63lkdDmGiGh1ZUZUdkdlUyYyczhUuFyVyVyVyV7J7b7IuFpjgyqnp2p1uXyWtT237b/s/c7b7IyWczhlhldkdUdUZUdlUzYyYzhUy323ym22237J7c7byWpklTqGlTlDuFyWtj7J/b/b/b/b7bzJhUYzdUd1ZUZUZUd1UzYyhluo7b7b7b7a7a/b/s7aympjlTgzlUuGuWym232o/b/s/s/c3cuodDUiQiUyVDUzMih2ZDYyup3K7b7b/b/b/b/s7c7aymlTp1cyqGu43J7b7byF242n7J7K3bqGcyYyQhMRQyQiIRd2ZEUihly3232323243J3J243Jy4hCqXl1qXunumyWyVt0pjt03J3JyohDcyYiYyQiMiMhQiVDdlUydUvJumuVuGuWuWuVuFp1p0hDqGqWqXqFqWuGunuFlCp0ununuGgyYiUiYzUzZDZDUyQidUUyYyqXzJuounununuWp1l1hTdDhkq5qpl2qXuou4uogyhUqnqXqXgyYiUiZDdUZUZUUzQyZUdUUyczu5zazZzJ3a3ay5mGhkhlmH', 'base64')),
  ('c028', decode('7N7N7N6syKlVlWhDYyUyYz2s2sy83N3N282s2s2LyJyIyJyJyJ2Ix2x22Z6r687N7M287e7e287N696spohFyIpmYzYzdEt42s287N292s2b692b2ayZyZ6q6qyHt3x2x3yH2J2J2JyJ2r682s7N2rt5lW2I2Jt3hUYzYzZDqIur7u7N3N297e7N2suYqJyZyax5x4x3x3x32I2I2Ix32pyI3N292s2b6L2J6q6qlVYydDdEhVy87u7u3e3e7u7e3NyauKt5uJyJ152I2Ix3x2x2x3yI2q7N2928282b2b2slmp3t3UydEqJuq3N7u7v7e3N7e7e7e2r2Kt4tot4t3t2tmtmx3t3yZ68687N2928zN2s2suaYzlU2GlWhWuK3N3MypuFuWuEuFuEuFuXpnx514y8zMuIt2yI3M7u7u7d69292s2s2b2b293Nurpnt4pnt57N7d26yXuFyWuVuEuVuFuGyI2r687u3e3dqIqZqZ3M7u3e292b6b2L2L2r3N3N3ex5x5tX2K6r7dyp3MyXynyWuEuFyX68yp7N7u7e3eqIhVdEhEdEyq3N3N6syq2byKyb3N3N3e2r15151o2K7N263LyYuFuEuEuEyX2727687e7e3dhVdUlV6Ix2hV7e7N6cupyq2sy8mIh3mIuryr2r687N7d7N26yXyWuEyDyWuW267N3N7d7e3MhVlmlWyJyJhVqIuZ2LuYuYhVZEhUUzUzZDhm3N2a6b2r7N7MuFyVuDyUyWuG7N7e7euquql4lVt3p4yJt4hVlm282b2JupqHlV2Zt3ZEZDUzl3ya2b682828yqyouEyFyp287e7eqIdVhVlnhVhWyZ2a2ZdEhVya2b2KqHZUhVyIpnhVUzZDZDl47N3N7M3M7d7uyoyX7e7u7e28dVlmlnuJ2ap32a6quIdEdEhV2b6bhmZDyI2ZuIpmlmYzZDdVl4yY2p7d7d7uyWyW7u7u7uqZlm2a2bln2at4t4hVdEdEdEdEhW2bl3Uzt42Z6qyYt3ZDZDZDyYyY7M7d7u7u2oyo7u7e7uqJhm2a2ayJ2ap4t5yJlVlVdEdEhV2sy8YzdEyZyYhVqoYzZDZDqI277e//7u3L2nyX3M3NzNyrlm6a2a152Kt4t52a2ZpmdEdEhV2by8yslmpnpnyIdUUzZDdEuZdn3N7u3e3L26253L29ysu92q2a2K152a2KyJlVhVhVdEhVlm15yrzNy92apnpnt5t4qJ2728yrh43N3N7eurhoqKysu8y86a6a2J2Jx4pXpndEdEdEdEhVhV1oyazN3Nt5po2ayJlnp4y82828h42828ybdHYlc2dXqspop4pn2a2a2Jo0k0dEdEdEhVdEhW6K2r3N682KyKt4lX2a2b2ry828h3y9ysY1MjMjQ0Y2l4o0pFc02J2KyaxXxnyJuIuZyayryK566r7e2r2K2a152K2a2ayZy83MdnqbuKU0lmt2hWY1pos01WojlX2KyszN3N3M2r2a2r28685q6bysubx52K2J2J2auYupy67udnmKt5dEt3x3pmhWt6s0xE1VtFg0pW28282a272r28686L5p6L2KuLuLx52K152Kp4uoypy6dndnt5hFhVt2lmlWuKs1w0w0131VxV1W142q6q136I2J5656696bybysyb2K2K15hVl2ypypdmdWholVyHyHx3hVlos0szw01V1msjsjxW7N7e272J2J56', 'base64')),
  ('c029', decode('iGdkdjpjhzhzhziDhzhzhzhzdzdzeDeDiEiEiUiUiUiUiUiUiUmViUiUmUmUmlmVmUmlq3qneFiFZ0ljh0eEeEeEeEeDeDeDeDeDeDeDeDiEiUiUiWiUiDiTmEiUmkmmmUmUmUmUmlqmmVmVZzeDeEdjdzZzZzeDeDeDeDZjdjiDiDiEeDZzeEiEiDmEuFt0tTxkqUmkmkmUiUmViUmEmUmkZzdzZzZziUZzeDeDeDeDiUiUdzdjiUiUiEiEeDiEh0lVpVxklTpzqkmkmUmUiUqEp0pTiEmVZzZzZjZzeEeDeDdziEiUiUmUiUiEiUiUiUiUiUiUiUd0l2uGy7qlqkqkiUiEmUt0pjiEiUiUZzZzZjeDiDiUeDhjmEiDhjhjhzmEiUiUiUmUmUmlmUuoy5uVup24qkmUh1Z0iFyFpkp0mVqmeDdzZjZjeDiUiThTlzmUdjUyVCUxdChjmUmkmUmkmUmVlkdClT6n23qFdlVjh2yGpkmEiUmVeDeDeDeDZzeDiUhjdTqkqkmkdjQhhThUqEmkmUmkiUmkqUlTpT2V63uWRUNEp2t1lkiEiEmUeDeDiEiUiEmUmUiEdjqkqkqkmUhzmUhzZCuVmUmUmUmkhCpTpT2V2nyFZEZEt2pkZkiEmFmViEiUiUmEmUiUqUmUmkqkqkqkqkqkmkh0ZDdChTh0mEmUh0dUpT2V2WdDdDt1t1VEZkiEiFh1mUiEiUmUqkmkqUl0mkqkqkqkqkqkqkh0UyUxUydCdDdElUpUx02WhUczplyGtlREd0iFlUh0eEeEiEmUmUqkqkmkmUqkqkqkqkqkqkZCZTUydjUxUyYzpkt0yFhUYzYzdEt2ZUVUiEiFl1mVeDiEdzeEmUiUqkmkVkZ0Z0mkqkqkiUqkmEmEqliEU0dDlUhUhUYzYzYzczhEVEREiFmFmViViEeEeEeEeEmUiUiEVkRURURUeEmUqlqlqlmUZDZFZEpUYzUzYzYzYzYzYzhElmVUiFiFiFiUiEeDmUiEiEiUmUmURTRURURURURUVkmUmVmVdkY0Y0dDUzUiUiYzYzYzdEyGlVVUVUd0iFmVeEeEiUqkiUiUmkmkd0RUNURURURURUVkZkVURVUzU0UzUzUzUyUiUiYydDhElVZlZkmFqlmViViUiUmUqkiUmkmUmkZ0NEVDVURURURERVNEVEUzU0UiUiUiUiUyUyUyYzpl2XuWmVmVmVu1Z0Z0iEmUmUmUqkmUmUd0NEREhURENENEZWVEMzQyQiUzQiUhUiUiUiUihDtlt1h0iEeEmUmVd0Z0VkZjZjd0dzVjd0RUNENERENENDQ0REQ0M0M0M0Q0QzQhQhUhUhUhYyZDZTmUqViEZ0mURERENENDM0NDMzNDNENENEM0M0M0M0NEM0M0M0M0M0M0M0MzMiMRQiQzVTZ0mUqlmEqlmViERVRENEQ0NEM0M0M0M0M0NEM0M0M0M0M0M0M0M0M0M0M0M0M0MzQyZDl1mEqlqlmUuFqkqlq2RVNENENEZFdVNEM0M0M0dVZEM0M0M0M0NENEM0M0M0M0M0M0M0RUVUqFqEulqlmEuVmkmkmlRENENENEM0M0NENDMzdEpmVENENENERENENENENENERENENERTZkd1mFqUqVqkmkqlqkmUmUVURERVNENENENENENERERENENEM0NERERERENERENENENENEREZkd0mUqkmkqlmUqlqliUiU', 'base64')),
  ('c030', decode('W+W+R5JYN6OKRoSLStStR6SKWbNXNWR4d3RXR5RXR5StN6i8rMvdzdvdzczbzuvKarasfOfOa+a+RoOLSsR5SKSbSbR5NpSbSKNoRpR5RoRXRoV4R6StStR5eqiqiqq4u3vMvdqoe8fOe+i9eqasV5SKSLRoRoRoRoRoNoNoScSLNXR5OLSKN6NpNpJpNpR6e9aJqmu1mom5u3nMjOjOveq7fOabRpNoR5R5NXRoRpR5N6N6abm9rNirmHWKWJWbaseZi8i8iZqmy3qmu23VmqrenNnOi8rNesaKRpStNXR6NoStOcOLaJe9nNrNm7V4iIareairq7iYq7vLzGzGy13E3FmpmqrNrNvem9rNved5JYOKN6R6aKaKeaebe9fOe9eaaJV4iImqiqm7upeImqqn/ny2ul207FmWiYq73uvNirrNzdd4mbm8rNvevdrMeIZmiam9eseraIaJaIzdq7eJZ3Z3V3iH7n7ny13FqmiXeHzdmqiZiZiqzNiJu8qqvevezeq8mHmIVFrNaJisaJWJV3V3Z3aHeHZ2eZeZqpzGy2iHiYmYq7iZeHaHaImqm9ibrNq7vevevNq8y6ypVVvNV4Z4iZeIZmdkd1d3eHRnWJaaVmVmmYy5mXmpV3V3Z3aIeZiYuqiZrNvNvMq7vem8qpu6qpm8Z3eH3GmYh1l0qEh0RVSJRneIeHeIiYzJiYmXZ3RWNGNGZ3q3iIqqnOnNqoynmqm6uZupiYvJu4moqou4h2upqXh0mGmXZ3qomnzIqX3KzIzJu4qYZnJGRmu4iI3Lu5zbzLeIVWNGd3u5RWqXZmq7zcvLqpqY3Kh2u5zbupVmq5zLqm7aqqzMu6y6y5ZmiIvKiIzLy5qqI1EkE0FGFGFXE1FYEkNFiazMy6mIupVmZ3qqu7y5u73H7nzHZ3Znqqu5zKqqzMzdmZvM3K/bFXE1FGFGFGFXE1BpEkE1RWy6Znd3d4FGE0RWu77K3u3HzG3GFGRVVWu5d37u3uzdzdu6zdvMR5V5FXFGeHFXFGBoNXSKiIy6FYE1FYFXEkI0Zn/bvM3Ju2y2Z2NWJFJGE1eHu7u8zezN3e3u7/7/N4FGJWFHFGBoZ5u77LqYBoE1BYFXNGJGup3Kq7y2iFqlRWaJFHJWFHmWeJq8u67u3e7/3e7uaaE1FXFGFGFXeJu87bVnBYRVR3FGer3uze3uvMiGq67FmFq7d2I1Jnd1NFWK3e3czdq7y5u6eJE1FXFGFXFXeJzuzdeKBYE1BpFGm8vNzezuaKZ3mZy3/U3FuoqpZmNFmGy3qpzLqqm63ampB5RVFXE1FXFXNXvezeebFXE1BpFGaKvfvfebV4R5iFq73H/FumqXqXFXNFeJmr3uaqq6/ripB5FXFXE1FXBoFGrOveR5FXE1BpE2JGreeaZ3V3NWV4mGiZqou4RW7K26y6q8iZzcSJWa/rq6B5BoFXE1FXFXRVm8mrJXFXE1BpFGFGnNiHR6RGWbNpRVh1u3q8eIVm7L7Lm83LzNSaCKiqvNGKCKNnZUZlh0hlianeNFJXI1JXNFRVebiZZmR5RoI2NGWsZmd2ZVFHi9mrN6/szMabCbCKarKKCKGKdlhkhkh0eIjORWRVRVRVRVRWabe9iGVnNFVmWJNoNpJYE1FHesSLR6/93crNKaCbCbGKCbGKJXVmdkh1d2e9RVRVNFRWRWRWWbWKariGRmWJJGNpRXd3VnNoOLOMOM', 'base64')),
  ('c031', decode('mZuZuIuIuIuIuImIiIiImId3ZmVVREQ0M0MzMzREZmmIdWhVZVQzMiMiMiMiVEhEhmhVhDhEmZuIt3t4t4uIuZqZqZqYiIZWVVVVREMzMzMzMzREh3h3hFhEqIyp2p2ol2MiMzhmhVlElEgzmJt4p4t4t4yqqXh2dldlh2ZVVFVFREMzMzMzMzVEiIdmdEdE2766662pyXhUQzhVhElElVlVd3h3h3h3qZqXqXuYyol2l2hlVVVVVVVFVEVEVEZmdmdmdVdVypyYyYpllldDUzhVdUdVdVdViJmZiIiIuph2hll2mGl2267MVUZVZVVVVVZVZmh3dmh3h2mIqZqHp2uIlllUlDpVhmhmdmh3mamamamZuqhldUdlZUhl2726dVd4iJiJiJiJmJmZmamamamaqZypyHyYt2tlplmJmJmZmZmad4ZWd4dnqYdldUZUZUhUpkpkdUVEdnZmZmd4dmd3d4dnd4dnmZ2puH2oyGtldViJdmd3d4dnqaVVd4d4uXdUdUVDZUhTuH25yYQzmZZmZnd4ZWqqiIZWd3Zmuryp2YyHpllll3maZVmZmZZVurVFd4iIqHdUhlZDVDlk2n65yXQyqaZWZnd4VEurd3VFZmVFqrdmuHpllkuGl2iJREmJmJQ0ZnVFd3qpl1dUhkZTQyp12n2otkMiZVVWZWdnVEdnZWVFZWVFd4VFqGllyXyXZUNFVEZmZmQ0d4h4mIuXhkhkdTVCQydTp1uXhUMiZEd3d4d4d4d4d4d4d4d4d4mZyoyX2ohlI0I0M0d3d3d3hnl3uYh1hkZTVCQyVCZDhUMiMiQyVDdVhmhmhmhmhmhmhmh3d3VWyq2ol3RFI0IzIzMzdmhmuZqHhkhkdTUyQyQydDp0uGNEIjIjQzhmqIqIqIqIqIqIuZh4I1FGmHdmJFI0IjIjI0IzMjdml2dUhkdUUzQyQzREhl2ndmI0I0IjIjMzQzZVZVVFZVZmVFIkI1JXM0FXFGIjIjIjIjIjIiIjhlhlREIjIjIjI0I0FHZmJGFHIjE0IjIjMjQ0QzMjQzQ0IiIkFXFGIjFpVWIjFHIjIjIjIjESl2VVIjIjIjIjIjI0FYE0E1FoVFFGFGIiIjQzMjMjMjMjEjIjFoE1E1N5qHI0FqIjIjIjIjEidVIjIjIjIjEiIjI0FYFFI0JpqIJFFYEiIiMjMjMjMjMzEkIjFpIjFXJoQ0FGFpIjEiIjIjEiM0IjIjIjEiEjJGJFFYFXIjFpNnIzFYEiEiIiMjMjMjMzI0h3NoZmmZRFIjFXFZIkEiIjIjEiIjIjEiEiESI1FYJGFYF5I0FYFXIjFHI0EiEiIiMjMzQ0M0p2yXx2l3dVIiFHFYFHEjIiIiEiIjIjEiESEiJGFoI0FGFpI1FGFoIjI1I1I1EjEiIiQzVEdmuGyGt2l2Q0EiFGFHFGFGEiEiEiIjEiIjI0EiJGFXIjE0FYE0E1FXEjI0IkI1JGE0Iidldmhmt2yGlURGI0EiFGJHIjFYEjEiEiI0JGJGI1EiJGJHEjEjJHIkEkJGEjIjIjI0I1IiIiQzMjIiZVM0IjNGIkEiJGJHESI0IjIiIiIiI0I1VFQzI1JGEjEiJGIkIjI1EjIjIkIjRDIiIiIiIiIjIjIjIjJHEjEiJGJGESIilUuGplMjIiIih2dlI1JGIiEiI1IjEiI0EjIiM0Zkd0VTIiIiMzZUIjIjIjJGEiIiJGI1ESISllyGuG', 'base64')),
  ('c032', decode('E0I0JEJENEVUhTpTxz2D6j6z7F7G7H7Y7Z7a7b7a7a7Z7H212T1z1zxSpTdTVEJEI0I0E0EjIjVDlTVUVUhTtj2D6T6j21y2232424647I7r/t7K7J64632myUyD2DxjxjpTdTVUVUlTVDIjI0I0lTxzhTdDQzMjIjEjE0FENEVEhD1i6U/s/+6X6FxSlCRENEM0MzQzMjMzQzZDxzpTI0M0MjIjRD2kESESESETEjEjI0FEJFVEhD2F7t7t7+6E65tSdDNEJEI0IjIjIjIjIjIj2TVEMjMjQ0M0VU2kETESIjEjEjE0FEJFVEdDxj7s7t7u7r6V7txkhDVEJFJEI0I0E0I0hlIjylVUQzVEhUREdU21ETETNEE0E0E0FFRElT1z637s7u7u7b7t7s6T1zhTREJFFEE0E0E0IzIjykdUZEtkyEVEtj21IjEjEjE0E0FEJFhT10637t7t7t/u7t7+7u7Y6UxjdTNVJFFEFEE0E0IjykdUhUt0yEhUpj21IjEjE0E0FEJFVEpj507J7+7tuX7c7t7u7u7+7Z1zlThkNFJFFEFEE0I02jhUVEUz22hUlT22I0E0E0FEFENVl0x12D7t7+upE0JEiI3c7s7t7s6UtjhUREJFFFFEFEE020hTREQ07IlUlT22JEE0E0FFJFREhT7K6U7suoI0E0FEFEFEV2qn7b7G2DlkdldkNEJFJFJE7FpTVEllyEyEpj63RVJEJFREdTdTp1646U24E0E0FEFEJFFFFFFFl17Ipjx02nlTZDVERUZV7GpjNEVEZEt0yE7HZmNEREdDpTlTpj2Vhkh1E0FEJEE0FFVUhkRUVUZUlUyFpTpTlTdDdThk7HpjJEM0Q0VElT62l1hThDtStjtjtk2DyTRVFEI0NEI0RUyF2VRURUp164tSxztjtSpTtjx07IpkNENEREREdD2muGpStSxShUuE107J7G3LZUFEJEFFJVRUZUdUt07Z2DxjuFdUxStSxS2E7IljRUVVQ0REZD2VyWtSxS1zVEmFxj7K7Y7b3KhTNVNVVUZUlTx07c7t6mx0qERE1jxi1S2V7IhUVUNEZEREZE2E2mxSxi1jdUd0xk7I7t7H7Y7JxjpTtSxj2V7s7s/t65yFl0dU1j1z1j6364t0ZENEpkVEVExz22tSxS1jZUZlyF2E7K7Y7Y7+7I506D637t7u7t/+7buGdlZU101z5k7I6ndUZEREyEVEREpj7HtSxSxjhkZUpk647b7a7b7u7b6V7I7u7r7I7Z7a7LpTZUl01z50507a2FVUVEZUhUdUdUtT7GxjxS1jtkhk2n6n7t627a7J61627Z7J636E7J7u2ohT2Wt0506E6F7Zx0VUVEt0dU2nx0pT62yExS1S1klkyG7K7s6m6V6D6l7b6E5z6V6W657cuGdUp05050506W7HlTVUdUxkuFyWZUZD2l2UxSxSpkVUqF7J7J2F6V1j7I7a7K657b7t65yFdURUVU1z1j1z6m2lZURERElkZUREI0NE2D2kxS1iZUZUVllkyW636V6U6E6V7Z7r7synyVZUJEhkVExj1j1j61yDNEJENEREREM0M0JEpj60xTpj2TdkdkNEhU2FuF627a637s2VlkdUVEVURUlkZU6T1z1j60pjdUNEJEJEVEM0NEJEVE2jyE2DxzZkdkdkZVyWREVEp1p02WtzNEE0I0JEh0d1VUuD2T2E2TRUhll1E0JE', 'base64')),
  ('c033', decode('M3RHmHupy6qYmHu63Lqp3LyhyghRcxcxcxcxhDqGy67c3L3K3K3KyoyXyYyoypyGyHyYyXyGVHM3VHupy6y6qpqZ3LzLu622yguBhBhBp1uYy67czL3c7c3K2625tlyXyoyoyXyGt1tlx2yHupdFpClUuXy6qpzL3M3c3c3b2h2iuX3b7czL3LzKzbzbzb3b3K25yXyoy5y6yYt2uGuGyHx2mHpClCpCpCpCt1yo3M3c3c7d7a7s7c7c7c7c3c3cvKzb7s3c3L3Kypy53K3KypuHyHuGt2yGllgxkykypCpClClCpCt2253c3c3c3b3Ly6upypu5zKu5zK7c7c3Ky5y53Ky6uoyoyouXt1yol1UxYxcxgxgylClClCpClClDp1uqy7upupy53Ky5u4uYzK3b7c3L3K263Kupupy5uXuXqWyomGYhYxYxYydCgykylCpClClChCuYuq3K3L3L3c3b3LtE3K3b7c7c3K26zKuoy5youXunqWyomHcyUhUhUhUhZCdDdCcxgxgxlTyX3c7c7c7c7c7cxVxUy53L7c7c3c3Ky5y5uouXunuXuXyoh2dUYhQhUhhCdCUyUhYyUyZDt0t1zL7t7t7c2Y2Y1lx2x23K3L7c7c3Ly5y4yoyouXuXuXynh2dmhmZDcxkyt1dDMhUhYhhUt1t03K7L2I13132Z121lxDx3yYx2267c25yo24unuXuXyouXh2h2h2hlkylCcyYyMiQhYhUhpkxlyHxE1V1V1l1Vwz1m1212xEx2tD253Ky5yoyoynynuoqHdlh2dmlTpCpTcxMiMiQyUxQhpTxVxlxU2Hwz131V1lxV1l2HxlxlyGsz2p2525y4ynuXqYunh2RFU0pCpUpTQiISIiQyVDVDuY7c12xDxl121m12xUxDxE122opEtlxUtD2625y4ynuXuYuXMlU1lCpTt2hDIiIjIkQzdkyp7c7c7bxUxUyGszxUxDxExUxlt2yYuIuYyo2525y4ynuXuYqYU0lCpSt2x1UyMjQ1ZFQ0qHyp13xlxV13xExlxmx2122p7K7ay6y6zKu63K7K3Ky5youXyoyokypCpUyptkMjMlVGRHM2dVy62Yxm2pwzwz2HxV2Y3L7L25662525qpyp25yoyY25yoyoyouokypCuHyXhCM0M3M3M3Q4ZFuoy6x2xlxlxUtE263KyY2H2Y2Y13yHxl12tUpUt2y52524y425kylCyYpkYyM2M4M4RIZYdXh2yoyYwzt1uGu4zJu5qGt22o2Y2H2p2Z2pyHuXuXyo3K25y425kxhCpUlCQjM3M4M4VYh4doVGuoynoyszy4y5zJy526y6y625657K7L7cy5qYqYy57a3K25uogxcyhCYyM2RIM4dpZpdph4M4h2y5tlypzK25y4u4y5253KzK3K257Ky6u5y53K7b7b3KuYQycxcxYhMkNINIRIqaqadpVZZXdEyouHy5u5zKzKzKy5y4y42526y4y43K3K7a7b3JqHVEMiQhQhMhMjM3M4NIRJqZmJVZmHl1hUl2yoy53J3KzKy5y53K3K7K253K7K7K7K25mGVDQhUhYhYxIhMjMmM3M4NIRJqZh5RIhmp0llZVyoy425u6y73K3K3K7K3Ky53J3Kyoh2QzQhYhYxcxcxcxQhMiMmM3M4M4VZqZmJmIZXdnVYM3l2ypqau8urqZ25243J3JyouXdlQzQhYxcxcxcxcxcxcx', 'base64')),
  ('c034', decode('acnOm9ibhmhVuXR7hmecR6aKWLSLWLesWMSMWKnNnda8asasm8ibebebebm7e8rMibV6mribetisZVZEdEdUh4R6Vnh4R6SLSLSLWLWMSLSMernNasWsWMeLVXebebaKaKaKaKeKVpRYq8itacVVVEZEdnqrWLSLWLhnqbWLSLSLWcWMSMWcabWsWMWMecaKZ5d4iKRpVpRpRpRpRYVpjNi9RoRXVnmsrOq9acR7V7qIyIqrWMWMWMWMWcasWKa8WMWLiaqrqaZWmbRYRYRYRYNYNYesase9R6R7WMm9m+q9ibVWdmtluH2oacWMWMWcacasWMWKWMWMiamJh3Y0maVoVpRYRXRoRpN7SMetV4R7SLWMaciaVEQiMihEt2yHy6mrmrmsm9esSMSLRpR6V6mbdmhniaiKVoVpRoV5V6NqNqScRmR7SLWMR6QzMiYzp2uXuHlVx22o6o7J7K/bzMWMWMScWLabmamambmriaiqSbV6SLN7NqNqVmWLSMWcVoMiUzuHuHuH65hmhmmIt2x2yH2Y65acWcWcWcWcacm8q8m8i8StOsV6SLOMNqN7VmabWMWcVXMjVEhmmIp3l2l4hlWMWciatmyH6oWcWcWcWdWcWdWdWdWtatStKMSbSLKMOLOMV2isWdWcZ5QzU0t2uHuHyGqZdmeaWcZ5plyYypWcWdWdWtWtWtWtWtWtatatW9W9OtKMKMKMaIabatatastmhVuHyHyH2YyYaKmHesRXRGlmupWtWtWtatatatatatate9ate9W9OtOtKdOce8eaa+a9atuIpmt3yXpllmypatl2Z5NXNZI1Roatatatatatata9i9nLnLnMe8a8S9S9S9OsfOese+e+a9etiaqauH2o2ouZZ5ZViINYM2M2Wcatata9a9a9a+e9nMjMnLnMvLvMW9OtOtOsjOjOjOfOe+e+nOqrl4pmplhVNHRGqYNYI1Rpata9a9a+a+e+e+e+e+nMvMvMrMvMa8OtOtOtuqnNjOjOi9acV7NHM2VGZWdWNXRpl2eKRoeba9a9a+e+e+e+e+e+e9nMqprMnMirarW8SsOturrenenOV6R7R7NINYNHNZNYRYV6uI7LzMrNe+e+e+e+e+fOfOjOjOjOiImYirm7vNrNi9WsrNrevNreRZNaRZRININqRZRqSceKyI6p26vMjOe+e+e+fOfOjOjOjOe8esh4vN3uve3e7urerNvNzevfRpl426ypdXaKabeKibuZyI2Z26ibrNe+fOjOjOjOjOjNe8ararmrrNjNi9nN7+3um8rezered6uayZ66667K7K7KyYuIyHx32ZV6qrnOe9e9jOjOjNjNfNe8erq9i9e8era9jNrenOvevereibuJuZuZyZyYyYyYuHqHp3dVdWSLeKrMarare9jOjOjOe8e9esq9e9esarWtW9a9m9verNm9reqJp3uIuIuHp3mId4ZoRpZEdmR6WLmre8are8e9asa8a8a8esrOi9etasWtSta9isvNverOrerNqaqJuaqrZoNYM2M2NIZFqGVqScaLm8are8a8a8e8i8e9e9rOnNe9atStS9a9RqicvererenerejNjNnNRYJHI2I2NZVWp2eKWcWLisare9i8asa8a8i9e9m9zerda9Sta9i9RqaLebV6m9nenOjNjNndNYI3JHIlM2VWhmhnRXRqaLesasi8asesa9a9asvOrenefNa9eta9', 'base64')),
  ('c035', decode('zdzdzdzczczdzczczczczczczczdzczcmI2qypuIuIypp4zczMzMzMzMzMzMzMzMzMzMzMzMzdzdzdzczdqrzMzczczczczczczdzdvMp4uYuYl4l4uIp4vMzNzNzNzMzMzMzMzMzMzMzMzMzdzdzdvMvMupqZvMzczczczczdzdzdzdqZmI26qIyqmImZzd3d3dzNzczMzMvMzcvMzMzMzMu6qYl4qIupy5upu6zdzczczczdzdzdzdu7mIupupupqIq7zd3d3dzdzdzMzMzcmaq7zdzczMy5upy5upupzKupuZzdzczczdzdzdzdvcqrh4qIqIuZl4vMzd3d3d3dzMzdzdqrZYZYd5mavMuYupy5uYy5zJuYqYvMzczczdzdzdvduqyrl4l4l4h4l4uqq7zd3d3dzdqrmJdodYZXdYdYhoy5ypzKy5y5y5l4qJzdzczczczdzdu7uqvMvLuquZuZy7y7yqu7zdzdzdmaZYdYdYZXdYdYdoqIy5zJy5y5ypqIqZqrzdzczdu7uqyru7zLvLvMy7y7y8y7yruaurzdzdh5dododYZYdodYdYy5qYuoupupuZqIuZqZzdzcqruayrurvLzLvLzcury7uququqyryau7zdu8dYdYdoZYdodYZYzKq6qqqYqIl4dol4zdzcvMuauJuaqauqu7u7zcu7zLzLuquqqaqJqJqazddYuqzLzLmZZXZYu5vLzcu7qJl4l4qavMu7uqyququaurqqu6zczLzLu6uquqqZuayryryqu7h5qqqqvLu6mZdomIvLvLuqzLvLupq7uquqy6y6zLzLuqu6uqy6qauqzLqaqZqJyr2ryquZuaqZu6uquql5h5qZl4uqu6u6u7zLqavMqquZuayruay7y7u7qZqZuq3LvLvLqqqaqIyqyauayququ7qZuZqZuqqJu7qZuqu7zLzLqrvMuZyay7y73NuqqZy8uquq26y6u6zcvLqZuayryryryquqzLzLuJuquqqZzdqrzLy6vLzcvMqayayq27y7mHmHZVuqy8qZqIl4l4u7zcu7h5mKyryqyauau6qZqJzLuqzdzczdu7vLvLzcu8qruaysual3qHuYupuYurl4l4qIl4qazcvch5dodoqqurqZuqy7y7uqzMvczczczMvLzcvLy8urusqamHqHmHqIh2ZVy8h5h5hododovLzcqqdodomJu7uquZmJqZqrzczczczszczMu7u6usl1qImYhml3dmhmZVh3urmLmKmbmrmaqqzcvch5qau7u7u7qql4qJh5vMzczszszcvMqau7ushlqG2oyohllmyZmHqaqch6h6qsq8mrvLzLzbq7u7zMqrmJu7qamJurh5qrzszcvMmaq7qru8mHqG2nuXuZdVuIqHmIqbh6h6qrqrmavLzLzLzMurqIqJl6mJu7u7qqqadozczdh6mbururqZyXyXl2uX2ph2qHmHmHqbqbh6qrqrmauqqamay8ypyYuIqbZYmJmJdoqamJzdmaiKqbqap2qFlkl1dUyq26dmdVhmVEmJl3usqrqrdoZYdYmJqbqIypqJl6ZYZYZYZYh5qaqbh6iKh6ususl4l1hkdkh3qZuqh3hnZWqbqHqIusqbdph5h5h5qbqaypqbdYZYZYZYZYdYqadpiKdpdpmbh6qLqah3y7zMupdmZVZWqZyqmIl4u8mKh5qbh4mJVVh3qZl6ZYZYZYZYZYZYh5', 'base64')),
  ('c036', decode('dFtjYyYicichchchcyhDhjZ0tTtD1CxCmG6l6maHmG6m6m6m6m6V6V6VuEVklTxCwyozg1lFk0xClkYhYhYhchghkxoxdjljl0pl1StkmX6m6neHuX6nyW6n6n6n2Wl1VkVUpUpVk2o1s0dkdFwyVVpkkxoxkxkxtBxShjt0mEqFt1mHmGuG2niHmGVUMzVVh2dlZURFJEI0h1pUtTpjlzgxljtCNVlFpjtCxCpBxS1ihzyEuVmFd2dmVVZVVVVUZlVVMzNEVEVENFJFE0I0ZkmTeUeVpCkhgyl0VVc1lVtjxSxS1zx0VTM0I0M0M0NEREVUZVVVREZVMzI0IjI0REE0E1I0REininxiwxohghtBlTlFs0lk1z1z6DZlEzIzQzM0E0E1E0ZVMzQzZlFFFEE0I0UzJWE0E1E0M0eG2E1hxBpCkxoxYhljtEtDiF6EuFI0EjMzI0MzREFFA1E0ZUZEEzBFFFNEUyVEE1E1FFE0NEVE2E5i1StSkxoxchtCpkpUl06VdUIzEjJFREEjNERVREMzIjIiE0BFRUREdCJEE0BGFFE0REQzl15z1ixSkxoxgxxC1SyFmEiFZDEjEjBWREVDRUFWFFIzMzIjE0VUZlpkdDI0JFFGFnE0QzI0VU2E5i1jgxkxgxxC1S5z2VREZDIiE0BWI0pjhkVmBWE0EjIjREVVZlyEpCQzFFFWRnI0RDEzUzl15z1zkxkxkxxS1j6El1QzVEIiFFFWI0hkp0d1BWEzEjIjZUNlVUt1YyQzBWFWZmNEVDEjI0ZU2E5zYxkxpC1j1zyFVEUyREMzFFFWEzMzNVRmBWEjEjMzRVNmV2dTIjQzBWFWdlRVVDEjE0Uzll5zYxoxtC1j10lUI0UyREVEJWFWIzIjJVJmFWEjEjMzNVVmVmQzIzQzBWFWhlVmVDEjEjI0dDqFcxoxxS1jpkdDIzUyREdlNWFFMzIjJWR2RlNEREQzZlRmVlMzM0MzBWFWhlZ3VEEjIjE0QzZUoxoxxStkhCREQyQzVVl1RmBFMzIjNmRmNlMzRERERmV2d1VDREIzBWFWhld3RWE0IjEjM0MzoyoxxSVEQzI0QyNERmp1RmJVVEIzV2VmRlNEZDREZ2h2dlUzVEE0BWJWp1h2JnBXFGIzIiRUghkxpTIzIzJFFGJXVWt1Z2FFMzMzRmV2VlZUVDVUd1h1dkQzZEE0BWNWuGtlRmRVIzIiRE1jghkxtChTMzFFBXJXhlx0Z2FFMzREV2Z2ZlZDVDREd1h1hlVDhTJEFWRVyW1jlUIzIiRE1j5ikhkxsx1ChkNEJFZmxj10d2JVVENEZ2h1dkdTZDdkd1h1dTRDdDE0FVVV2n50VEIjRE1z5S1SsxkxxBxC5SlkVUhU5064Z3FWQzRERmJVNEUzVEVUd1l1ZUMzdDJEJWZV2o6nVUdU1j5i1SxCsxkxxCxC1S5ix0t16n64Z3FWUzI0NmBFREVDIjJEVml1MzIjZDE0FWZV646n6F5z1S1BwxsxsxoxxB1C1jt0qFqXyn2oZ3FWZDE0JmFFREQzIjNFh2dkIiMzZDBFJWhm646W6E5i5R1B0x0xpUtjh0iEhkpUxU1k2W2nV3VVUzFEFmJFMzMzIjRVl1MzIiQzUzBFJWh2646W6E5i1B1B0xwxdlhUtEw0xCwzw01T2WynZmhkIjFEFmREMzMjIjZlhUEzIiZDQzBFNVmGyn2W2G505S1BxCsx', 'base64')),
  ('c037', decode('QzVUVUREQzMzZD2U/GpjlSpStjxzYzZDUyYylD2VtkllyGhUhVhmdmZ4mH2VuFp02V/HtztyVUVUREQzMzMjUyZCti2F2F2VpDpCpChDcycypkt0QyUzt1lUhUdVdmh3p1h3iIiIuF626ltydURUMzMzMjMiYyYyYylC2G6YuIkytCpTlCpS2Fx0czdDyFpThEdElVpllmt2p2iI2WyF6lhkVUNDMzMjQyQyUycyYyYyhCtjyYlDpDx0pSxz2VpTczlT6FpkhDpUxkxm11tml3uG2V62yWiIljQzMzQiQiZCUycygygyYzhC11tVtT2Wxj2E6nhTUylU6npDtU12132H2Gtl2F6l6WuXiZiatkpjUyQyUyUyhCYykyxSgyhCxT1ltj6m2V6m64dDQy2W2F10t413xmtW11+2+32Hl3eZiZiZx1xzpTYyYycycydCcytSkygytT1mxj6myFpklUYyUyyG6m1311xkpldmyF6l2Fl3eIeJeJeZ6m2UtjgycycygyhCUykypClCpC1m1lxkcyUyUjQyQzczxl516Ex0dmp22Vp2h3h3h3aIaJeJyE2DhChCpCcyczkzkygyoypUoyxj1mpCUzQzQzMyQzcztUtU6VpltlyGmHiIp2p2Z3Z4aIaI2U6VtCtCxSczdDdDtDsysyxTtT1z1kpDQyMzMzMjMzhDczhD6ExVx3uqy6upmHZ3V4Z4Z4Z4hT6m501S5TxUhUZUpTxTtCtC2E101jpCUyMzMjMjQzYzYzlD101m2I3b7s3su6eIZ3Z3Z3Z4dDxT6m6F512XxlhVdUxTxTtCxj2EpCcyQyMjMjMjMzMzYzgz6W51x43L7t7u3biYh3hmlnhndDhDtT1ktlxl521lplxk1jxTtCxjlCczMzMjMzMzMzMzhDgz10501myZ7L7b3KqYtltUlUlVhDlDhDlEtmyI135m1lxk1j10xStCpDYyMzMjMzMzMzQzpTgz1k6E1lxmyY2p2W10tlhlpTlDdDhTpjlUd3qIyI53511111x0xjtCtTQyMzMzMzMzUzhTpTtU2G526F6E50106D1kpmlVxT2E11xTlDdUd3iZiIuI1311506F1k1jpTYyMzMzMzM0M0hUxlxm2I6E506E6U6l2ExlxWxU6F1k50511kxlpmt3t3uIt3xkxD1T1j6lhDQyMzMzM0M0U0t0xU1k125k5T501k1j101l1V1k50xTtT1k1m1m1l11t16G2Hxlxk1k506VdCMyMjMzMzMzY06l1k6W11xUxDxDxDwz0z1F1V1U1k1kdEdElEpVpmt3x3136G6V6V6E2E10hCQyMyMzMzMzc06l1110xDxD1j1z1z1z10101k1UxUxTdElEpUlUhWhnpnxm1m106E5z50xjYyMyQyQyQzQzlD6l1l1kxEwz1D1T1j5z5z1jxDozgzgzZUdUdUhUhUhVpmtWxV1T5l5k6FpTQyQycygyQyQzpk6V2E111k1k1j1j1j5z6D6D1zxjlDgzdUdUhUlDpCxT1k1l1V1n1T1z6WhCQycyx0gyQyQzyV6n6E1U1k106D6D5z1z1j1j1jxjlTYzhUlUlUpUtDxS1T13x4xDxT6V6ndCQyxj6mhCMidD6m6W6E505j1UxD1T1j1k1jhChCtCxSlChUhUhUlUtUxk6G2IpUtC1k106mcyUy2F6mYyMjtj622FtD1z5j5k12526G6Y6H1ltCpCxS1k', 'base64')),
  ('c038', decode('IkIlImIkIlIlM2FVGJCaCIGaKbOsR5ZFdEhVQzRXS9OsKsGaCIGbGIJFJGMmIlIlIlIlIlIlIkMmImIlIlMmI2JGF3KsCJB3CIGJU1hW6666yYM0OKGaCIB3CKKsF3JFJGMmIlIlIlIlIlIlIkMmIlIlIlM3FWJGFnOsGbB3CIF3QjlV2HpVlmVFJ5CICICIGbOsB3JGFWI3IlIlIlImImIlIlMmIlImImM3FVFWBnOsKcCJCIGKhVt32I2HyIhWKKGbCJCJKbOsB3FWFVJGImIlIlMmImIlIlMnIlIlMnFWFVFVF4GKF4CaKbKauI66x2x32ItoR3KrKsOaaaSaF4FVFVFVMnIlIlMmImIlImMmImIlM3FVFlFlB3KJFmGbOtF4yZ2Y132H2HuIJ2F3Osi8aZiaN3FVFVFVI2ImIlMmMmImMmMmIlMmI2FWFmFmKJF3FmGJGJFmV32H656px3VnFmFmKJaaaJq7WaJnFVFmJFM3IlImMnImMmMmIlM3JFFmFVFnKKNoF3CJCJFmNmpWpWpVpFVnFVFmOIiJeJmrSbF4FVFmFFNHIlImM3IlMnMmMmJXFVBmFVF4GKJXF5GKJ4B3Rnx2lEtVtVZWNnB3J5VXZ5NnKaGKFVFmFVNnM3IlM3IlMnImNHF3FWFmFVGaGaJWGaKbN6NoVWx3xmxlpVM1RGJGN5SKKbJWGaGbFVFmFmFnJXMmMmMmMnMmF5F4FnF4FnOrSsJWarmrmb3Nh5ZWuHuHZWiJususmaiKasFmSrOsF3F3FnF3CaNIImImMmJYCJB5GKKKGIOrKYrM7u7u7e3e3e7ed4d37ey8us3Oqr3OzNaaKIOaCIGJGKF5CIF5ImImI2F5CJB4F3F3F4GJSa3e7e3N7e3e3e7uy8u77ehFc0qZmJ3e3Nq9J4GJF5B3B3B4CICJFXImFoCJB4FnFnCJF3GJi97e3M2Y2Y3N3e7u3e7u28lW2Z2Yt4u8y9u8SKGJF4CIFnFWFnCKCKJZKLGbFnJWJWF4F4KKrN7u2q2I2Y2Y287e3e7e7M66662IpWqL3NusabGKGJF4FWJWFWGKGbJqJ6GLJXJWJWF4KKOczO68yJ2H6Zx3yI3N68666q6q6pyHlWlp29zNm9GbGbB5JWJWJWF5GJJYJ5J4JWJXJXJ4KKWrpotGtGtn6p6p66666p2Itmx3t3lVc0pGs2xXu9GKGKF4JXJWJWJnGKJZJ6JoNXNXJXJ4KKN5dF6p666666666p2ItmpVg0c0QzhFhF2Z2ZlFVXKaGbF4JXJXJXJGKKJZN6NXNHNXNXJ4KbRXtn6Z6p2Y2Y2IxmtVlFg0lVt3lW6p6q6p6Zt3U0KKGbKJJoNXNXNHJ6NZNqNHNXNXNoOKOcN6uIx32H2HxmtlpVhVlElEtl2H2Y2Y2H2Hx2tmd4OKOcKLN5NXNXNHNpNaRZRHRYRYRpOKaaWKiJ6px2tVpVpVY1hFhEU1lEplplx2yHyHx2t2aKOKSbObN6RoRYRHRYRZU1VGRYRYR6Z5lmZ4V6yHllhEhWhVU2YzlVVGVFlUY0pUt1xmlVt3VoWKl2WKSKRpRYVYVYRJUjdEZWVZWLdFhVV5RppkdEZFhlhFVGhVhVdoZXpmdFU1t1hFhEllZWSLlmdWWLV6ZodEYzU3UkU0VYZoZ5YzY0VoZ5tldEY0l3lVVGUjlVdXlnp1U0U1t1dWgzhDdmR6dEhEWKZ7ZYY0czQ2', 'base64')),
  ('c039', decode('zI3K3K3KzHzHzGzJu2u2u1u2u1vFdjQxMhQhMhVCql3X3W3XzWvY3qvMq77r7r7r7r7r7p7qzV3X3X3WzVzVzWzGzFzFzEzVzVmUUyQhQhQxQhQhUy3Y7rzWzVq4q7vMiaza3r3r7r7r7p7q7p7q7o3WzVzVy1uVuUy1zVzVzVZCUydUdkZDQyQhQhzI3XzV3W3XvLiaqrvKzbzbzb3r7p7p7q7q7q3WzVzVuUpzljvFzVzVzVmUdluouomGhlQyVSzFzV3V7o7p3ZvMzdq8rNrNvL3q7q3W3X7q7ozVzVzVuElzmUzV3W3WzVu1qY26y5uo7bRCiEzV3V3X7p/83Z7u3ezdzdzb3r7p7q3WzE7p3WzVzVzVzFu0zV3V3X3X3Wu1267L3K263KuXu1zV3W3X7X7o3HzK3u3a3p7r7r7p7q7pzUzVzFqEululzV3W3W3W3X3X3WzGuomGuo3L7LuozF3Fy23W3X3X3X3WzI3X3W3X3o7o7q7qzVzFt0t0yEuFzV3Z3X3V3X3X3WzF3Kuo7K/sy5zG3WyUyFy23X3X3X3X3X3W3X7X3WvE3W/rzVuEyEp0qlzFzV3WvEvEzU3W3WzViFmGh1y5uou1zGyVt0yl3X3X3X3X3W3V3X3X3VvEzV7pzVzFtkulvFzFzV3XvEvDvD3WzWumZUhkqG7Kh2dmy5qFt0uV3X3X3X3XzV3W3X3XzEvDzV7ozVzFt0zVzVzF3W7q3p3Y7p3K27uJZl7b/bmHZVua68/NypzG3X3X3X3W3V3X3X3WvDvD3VzV3WzVzVzVzVzV7p3azK7qqY272ryqh3upy5Zm27/N/N7N2rZl3X3X3X3W3W3X3X3VzV3YzVzV3YzFzVzVzV3VvKmq3Y3JuaqJyK2r2rl4ln282a2K2r28Zmuay63X3X3X3Xy03F3n7q7pzVzV7qmqvH3XumzImrq4zG7M68ZVyK2a6syJt5/NyJpXyruJhn2r7N3I3X3W20qChxy27q3ozVzV7qu6qrvK3uqqiavG277N28pnua6K68yJ2a/NhWhGuapnto687N273WzF3CuTqDuR3I3XzVzV7o7pu6q77/qrmYy4/N7N2b1oyr2K2r152b/Nx5xo27toxo2r7N7Ny3vFu1mCqDqC3Y3WzVzV3W7q7p3X3tvLvG27287M1pxo2r2K681p2b2r152a7Nto1o2a69/N27zVzVvF3Y3Z7qzVzVzV7o7q7n3Wy2qqqX7J7KyZ1pyX28152r152r681px568x55o2K7N/N7Ny2zV3V7q7q7qzVzFyl7q7p3W3X3XiaiI25/s7bx4u1yZxo68552a2r552K6rxn1oxo2625yXumzV3X7s7r3Zy1t1uU3X3G3X3X3WzIzGy4/c/syoy22K2a686K7N68552K68uH14yp/s7by4zVzV7p7r7ry3lTtUu1zVyG2Z3GzGzG7oy37a/s3Iy41568686K7N68552K2ryXyn/s/b7KzFzVzV7q3Jx1tUtUtluE3XyX2Jx3yY2o3H3X25/b7a2616686s157N28552K2aum7b7czLqqzKzGzF3Z3Jynt1xlp0ul7q252Jxn2J2I3G3Xy27KqX7b2Z2r6s55682b1p2K2a3K/su6q8mrq7zbzJ3d3a7q3WuUzFzV7q3KyYyIyWulzF3WzVh2y5y6ypya2b55282a15267b/s/synzHq5mrvM7v3u3b7qzVzFzFzV', 'base64')),
  ('c040', decode('MyiGNDZ1mozLzNq6mpVURUZliG3d3t7umXUxUyiH3t3t3t7ud2RT3t3u7u3t3bd1iGuoZkRTMymXmXd1mp7u7uzceGZUdUZkvK3s7u7teHIhERmp3t3tvKVUVURDd2q67u7t7tmGiGd1VURTRURTMyZ1mp7u7u7u3cuGuFu57s3cq6aIVnMhMxVnq67s7tqpqGqGiX3s7u7t7td1VTMyVURDVUVTMyZ1mo7u7t7tupZTZThTzJeIV5V4NWVDVTRWVoeY7szLdkdk3b7s7t7t7td1VTMyVTRTmXiGZleGqo7s7sqFcycycycxcyV4RXWJVndlmGRnV5RnmYyYp2qGl2u57s7t7tiFd1ZlmHmXu5iGVUZ1mp7su4lCgycycykydDV5NFV4V3qXyoRoV5NWZny5uol2h1h2y67s7td1ZkZUmXu5ZkVkMyZ1mo7rqGlCcydky4hjZVV5RnRnVmqXuoRWRnRWVnu47aqXqXdlyJ7r7sd1VTMyZkVUd1ZkVTd1mn7rlThCy4u33Y7pV3VoRnV5VnmHqXRoVoRnVo3J3KuoqXuWhWqo7sh1ZkRDZkd0uoh1RTV2mXu4hCZUzIzI/pu3RnRnNWRnVnmHqXRnRnNWRnzJzJiGZkiFqGuX/rZlVkVTmGzLRCMyRme7mXqGmGqFzIy33IqnVnNENVV4Z3h2qXRoRXQyMzqY3JmXZkd1qn3K/raGWYNDQyVTd0MzSJaqmXqX/qmFzImFqmunVUQyQyRVZlmGh2RVRDVDZly5y5uomGRDd17r/saHaZNmRCd0d0JVWZWImX3bu4ZDNDZkRDZk2mh2RDVCQyZUQyUyRCl1u5VUVDZUVDMzNDu5/saHR3WIRDVTZ0N4SIWImY3bynZ1J2JlJlVld1mpRoNEMzRUQyMyRWmGd1RDNEJVJVNVRUzK/saHRmaZNmZTR2WZNmWImY3byoaXJ2JVJUJ2R2q6RnNmR3N2N2NmRWmHhkRTJVFEJVN2Vl7s/saHRmV3WZVlSJNmNmWImY/tmXioJ2FEJmJ2WH/teYR3N2JVNlR3R37sd1RVJmJEJEN2zL7s/taHRmRmWIWINVNVNmWIiY/9/tvKOHJlJ2N3eY/9mpSHN2JEN2SHWH/9u5RVNmJVJlN27s/9/taHRmRmRlV3NVRlRlWIiY/9/93cSHJmJ2N3ip/+q6SISHRlN2SIaY/9/9mZNmJmJmN27s/t/taHRmZ2RmRmNEVlNlWIeGy3y3zJN2JlN3N2iWy3mXSIR3V2N3SIaHununmWJVJmJmR3y3y33Ku5eHZ2VlRmNENVNmWIeFyl3ay1V2NmJmJUqVukqVSHR2Z2SHNmiWylylmFNmJWJVV2ylylylq57cVlRmRlNENVRmaqd1yky2ykiFRUNlNVmVylmEN2NmZ1SHR3iWulyld0N3JVVlqly1ykykeHepVmRmRmNERmeqaHh0uUqDmDmEJENVZ1h0qEh0R2JVZ1NVNmd0qEmEiFWIV3ZkuUqUuUuUd2epepRmRmRmaZVlZTqDqDuEqEpzNUJEJEl0lzlzZ2eHaHNlR2h1lzlzl0aHd2VmqDqEuUuEl0VTaIeqVmWIRDVCVCdTVCVCVCVTJEFENUVCVCVCd1iHd2iXiYZTZCZSVCVlRmRURCVCZSdjdTZTZTZ2eqRCVCdSmEhjdjdThjZTNDJENUdjhjhjd1Z3VliYmphkhjhkdjVlRmRUQydShjhjmElzlzdjZl', 'base64')),
  ('c041', decode('qcucucucqcmLiLd7Z7ecmtm9jNi9i9isicicmau53J/o/o/o626VuqzNy56W6I/u6n/cuIl6qcucucuciLeLZ6ibmsi9e9acZ7Z7eLeceseseceKiKqa257Y/Y7Iqs3ep46G6766/J/uyIl6iLmLiLZ7ecitisaLeci8msesiLiLeLZ7Z6ZqZ6aLacebqaup7Zy6u77vp36G/c6H6p//6Wt6uLuLZ6eLicmsisitq9m9msmLmLiLiLd7d7d7d7ZqVaVaVqmbupupu63eiL7a6Y6H6n//2Yt6uLiLVpeLicicmtvOvOu9q9usqLh7d7mLqbqaurqbd6ZqZqZ7mbuqu5y5246m6G6X+5/t/b65iLVqVpZ6aKebrNveu9utusurqLqLmbqqqJt2uHyr28qrZ7d7aMqsy77Y6m6W6W6H2IuImJyqZ6RpVpZpV6ebmtvOmtmcusqrd7ibmamJpmt2uGyqy73MZ7Z7aMi9qsmaeJu5qZqaqah6mLhpZ7VqVpZ6Z6eLicmcqcy77KzLm9isiJl4l3l3l3qJyr3MjObOatacibiKeJeKiKiKysucucl6d7V6VZZpZ6Z6eKh6mK26/a/q7rm7h4h4h4l5qJuaur3LrdbOa+eteciJmJubmKqLp6l6l6hpiLeMVpVZV6VpZpdqd6l62q7b/rq8d5dXZXZWZWdnmIupq8m8m8m8msqqmahodoZYZYZYZoZniLiMaLVpVYRqVpZpdqd6isvNzLq7VYNHM1MjMjIjQ0l2uoqq3K7K3K/a7KuYhoh4h3hnqIqIececatV7VpRYRpV6Z6aLe+e+esVnVoM0MiQiQiQiQiljhU267b/q/q/r/r/a257L7J252p2qacatatatatacecabasa+a+fOesQ0WJQjZFQiUiZEh3hUlkyp26263J7a/a/J646n+3647J7LZpeca9eca9bObOfOi9m9m8m8e8RFV4ZVh4VEYzdVmIhUuF7L6quYuYyI6p662px3yH2Y65/KZYh6uLuLuLicibiai7e8e9e9i8eJVnUzY0UiYzc0dElUyo/9/s/a2p2Z656666yauamKua2qub2sycdpp6domrm7m7m7mqqpiZV4RWVFUiQiYzhEczhTh07K/s/s/s/r/J/J+56qyrubub2rhpl6p6lqp7ZYiJqpqZqYqYh3RFIjM0M0QjIRMRQiYyUyZDZUuH/K/b/s/r/q/a/Z/Z/a7b7bl6l7p7lqp6dYdnuIuIuYh3QzMzIjIjIjIiIRMiQiMiUyQzVEZUqH6q/L/b/r/r/r/r/r/a/rp7qLqLqLlqdoZXqIuJp4VEQ0MzMzMjIjIRIRUzdEUzQiMjVDZUdVqH66yqyq7b/r/r/b7a/ahqp6p7l6hpdXdnp4qJZWVEVEREVEQzIiIiIRMiQiQiQiMjVDVEZVhluXuaqK2q/K7K66667JZYZYp7h6dYqJuIh4V4VWVFVEVFVEVEMiMiIiIiMiUzQiMjVEVEZVhly63cya2Z6p7L667c7LVXVHdZdZlq657raaRFM0VWVFVFVFVEMzMiMSMiUzYzUiMiRDVUqqmIqZy7y6qa7L7L667L66VHVHZIlqdY64u6VnQ0Q0M0VVVFVFVEREMiMiQiUiYyUiMiQzVEdmdnzMu7upqKu83Nyq6767VHZXdXhpuK64iZRFQ0Q0MzVWVFVFVEVVZFUiUzYzYzYzMjRDVEVFVVZWdmmHh6h5h5houIx3', 'base64')),
  ('c042', decode('AAAAAAEhJDEhERJCNDRkWFaWe3e3i1iznCnBnBnBnCnCmxRERWNWRpRZRZNII1JFaWaWJCR0AAAAERIyIyERJCJCaWWFeni1i0mznBnCnCnBnBnCnCnCViVWM0RZRpNYJGIjI0M1I1V1aWR0AAAAIiJCERNTNTenR0e3m0mynBnBnBnCm0m0i1i1i2aVERI0EjERNGEjMjMzRVVnRVERamenAQERIyEhV1RkenaWi2mznBnCnBmyi0i3i2i3e3e3RVJHNYEkNHESIzVFdFhFc1RFVnVWWFamIyIyNDWFaWene3i3i1nCnCmzi0i3e3e3e3e3e3NWNHJHI2ESESEjM0Y1dFg1hGlGU0RVNUaWIyRUNDename3e3i1mymyi2i3e3i3e3i1i1i0aEJHJHI2JHElARIjlWdFhFlGdEhVlHY1aGe3NUNTWFWFe3i3i2nCmyi1ildld2emi1mznCnBViEjNIEkJHI1EkNFhWhWISY0dUhFlHc1iFi2RkRkWFeni2i3mymyi0eVdllVlmZViimxnCihViARJHNII3JHNHRGlWx415hVhFlGlGc1iDi0NTJCe3e2i2mymxije2aFhnqZlWdVeRmxihmzaDABEkJGNYNYIkIzx4t4pnpXlWhFhFdFmymzWFRke2i1mznCdzaEaVhFtGhGhVlmZyiiRje3aWESNHNYNHEiI0hV2Jlnm8hmdFhFU0h0nCnCaWali1m0nBmiiSeEVEk1g1pGhFlmdVRjaWaFMiIzIjNFNGRFZF2Ip3pndWNEQjhFlWelnCnBaWi1m0mynCpVlFMzERYkYkk1c0lmhmERYzpVpVYzIRZWVEVEVEd3dVdVY0hEpWMzUzi1mznCenmzmynBmxtWlFUziIERQSc1dElml3Qzc0tWpVpFhVlmhnhmMSd3h3hmhVpVtWhmaWi2mynCe2nBnBnBl1pWhFU0dVqqMjYkhVl3lndVpFxWtVtWdFlnhnhVckMSmZdmUzhExWd1e3i2mynCelnBnCaBZFpWlWhVlmdmmZIRhmhmhmZEpFtWxWpFMihmhmdFk1YjEBZmZVlFxWene3mzmynCi0nBmxZEU0dFUzY0lmhVZVhVVERFRFIjMihEhEUyAAZVlndFpGg1g1MiERdUhVi3e3mzmynCm0nBmihWhGY0RWVolWt36IQ0IjI1NGESIzIxeRmxeRZkdWhFpGo2pGVTiSi0e3i3i3mymynBi0nBdzY1dFlWhmmahW2JZEI0IkNXNYNYEjeRZxihizaFZVhFhnpGdEiheSZ1e3i3i2mzmxihi1iihGdGhWlXhWyJyJt3NFI1RpNXNHI1AAVieRmyi1emVEhFlnhniCmxiSi1e3i3i1mzmxiii1eEY1hHlXdVZFlXlWlWNGNHJHNHJHNIESRRmyi0i2e3Z2dWdFdyihmxm0i3i3i3i1iymxaCi2iEhHlHdFdUhGQjhGlWM1EjI1JHEkNIEkVji1i2i3e3e3eUdymxmxi0i2i3i3i3i2mxihRTemZzQ0hGhWdFhGdFZFhWEjESEkJIJIJHJHaVi2e3e3i2m0nCnBnCmzi3i3i3i3aWeUihVyenaWVkVnRFY1hHdGZEY1NEIjEkARI2NHNHRli3e3e3i2mzmzmymyi1i3e3i3i3e3aEiSeRV0RkV1emNEVnVWU0c1hGVFI0ERNYI1JHNFV2i3i2i2i1i2i0mymyi3e3i3i3i3i2ekVyeRaBRUR0', 'base64')),
  ('c043', decode('yLyKya2s2sybyb2cyLyLyLt6t6pZhGlXhXtp287d7Nyr3N7Nx5yb2b7d7d69692s2sx616162s2s2s2byLyLyLyLyLyLt6tJZGMzMzMzMzZFQzRDVEQzREVFdn2syb287e287d692bx616162s2sybyLybyLyLyLtpybZGQzMzMzMzMzMzMzMzMzMzMzMzMjIipo2r7Myax6692syK1616162sybyLt63N3Nt6t63NqaIiMjMzMzMzMzMzMzMzMzMzMzMzQ0RE3M7Mx67N2s2s2syK16x6tp28ycyLyL293NyL3Nybd3IiIiMiMiMzMzMzREdWVEREMzMzMjln672r2s/u2b2s2stpx6x62L293Nt6yL293NysybppRFIiIiIiIiIiMzMiMiqHuYdmQ0Mzh42Z662r682r2cyKyK2K161616ys3Nysyb3N3Nl5VFMjIiIiIiIiIiIiIiIiIihml3l3Mjua68676r2q2ayKyK2L1616161616t6293O3N3N3NuKQ0IiIiIiIiIiESIjESMjdW3L7eyrVEhm2q2r67yq2K1616161616161616yLt6ys29t629h4MjESESESIiIiMzuIyY2p65276p652ol32p2b7N6r6r1616161616161616uKt62s29t6uLubZFESISIiQ0ZVyq66+5+5666565+565yZ2qyK2K6b6r16x62L2s2s28282s3N2929t6pYpZ2ayZmIhnU0VFyZ6p+56p65yZyYqIyY6566p4l42b6b2L2c7N7u///u7u7u7NuKt6tppZpZtp6q67yKx5uIVE+5+5+5yYuI2p7MmJdl656phmVViI7u69//7e/u7N7N7e7e69t6pppZpZpZpZpZ672a2Zp3hm+5+52pl37LurVFIihm+5+5VFZVQzh37N3Nyb7e7N297e7e7Nt6t6pZpZpZpZtZ676qt5uIln6p+5uYy7dnMjZGpo2q6p2ZVEVEQzVVh47uyL7N/u297N3N29t6t6t6pYpJpIpYyK2apqdWhnp3+5l2MjQ0lp2b6r666pVEQ0VEVVVVVV7uyb2s2syLtqyLyLyLyLyLpppYpptqt6x6yKZGM0Q0yY65yYyqua6r6r2pVVIjREVEdWh3ZVmIyK2b2cyLtqyLyL2bybuKtqtqtqpq2b6r6rhWMjM0Iidm2p2pyJ2ruJMzMjM0REVEqJyaVVd2yK2c2byLyK2b2b2b2s2btqtqpqpp2L6bp4REhX2JlnZGMjMzMzMjIiQ0ZGQ0RERE2b6rhmdm2L2b2b2L2L2L2L2s2s2syLpqpqpppZpZM0REREQ0M0doZGZFZFZFhWZFdYM0REdW6r6rhmh32b2L2L2L2L2LyK2s2s2s2syLpppZpZpqQ1REREREQ0VFhpVGZWhXVFqJZXREREyJ6b6rZVp42K16161616x62b2s2s2s2s2cpppZlZppVGMjQ0Q0REREVWp6l4hnp42rQ0REhnlop52adm1616161616yKyb2s2s2s2s2s2bpplIlZp6Q0Mzhnt5REREQ0ZW67hnhnuJMzlouJl4uJyKyK1616x6yb2r2828282s2s2b2a2bxqp6uLk4Q0Mzhn6rp5REREREl4yaqIh4VG6byKuJ2b2L2KyK2r2828282828282ayK2K697N7NpZp7lqhZM0VF2a6ruKdWREVE2r2adXp56b6b6b2b2L2s2828282828282828', 'base64')),
  ('c044', decode('ETETESM2VYVWd4d4dodpMnM3U4MmMnMnQ3ZZZaM3MmMnQ4RHNHRUVlRUNDNERmVmRpJGJFV4MmQ2VmNFZ4Z5Z5VoRWmamad5Q4Q4RIM3MmVIZaRIMnMnVJRXIzNDNDIyIzVlVlVlVnNWARNXIkVWZ4V5VEVnVmRUNUVnNEVnZoQ3Q3MnMmVJRIMnMnVIQ3I0QiNDRUEhNERURlVlVlRUEhNFNFZ3NEVmVEMzZDRUNDVlRUIjRWd4Q3M3M3ZaQ3MmMmM3Q3I0QSRDRUIzIzRURUVlVlNEERRVVmVUERERMzIiQzupEhRUEiIyIjZ5ZYQ2RIZqVIMmMmQ3Q3hnQzQiMyNDNDNDVlZlVlNENDVlNFQyQhVDQz26h327mHIiEhEREREiIiMmM3ZqM3MnQ4Q4ZHuIqIEREREhNDEhVVZlVlVlVlVlERER277L7c/c/t/t7MMzIiARNDEREiMlM3VZMmMmMmQ4houHuIVEARIyNDNDRUZlZkVlVlVlEiZ37d/c/c/c7M7c/dy6qHIyNDERIyIlM3VZMmMmMmVHuZhVyZZVMiQzERNDQzdDYiMyRUVlI0mY277L/c26l2ypyp7L/buYERARERMmQ3VZMmMmZY3M2qypyYuYuYl2IiEhERMzIyAQIyIiM2h3uHuJ662puIyY7L7L/L7LdWIiM1MnQ3VIdol43M27yYyX2p252pyouHVDEhARIyERERIhMndouYyY267K6666/t7L7L/bqIl3dWMnRIREZU2p25youHyY252p2626uHlll2dlIiNDRDczM3d57t7L/c/c/L/L/L7K667LyqyYp3MmVJESZE2p25yYt2yo25yY267MypuXhUqHVEEiRDYzM3iK/c7L6666/L/b/b7L667LyquYhnMmVZRHVD252pyYt2yY2p2p252p25p2p2uHZEAREhMzM3h6/c26yH2p2p66/L/b/b/bmK26VHMmRIIjIhypmHmHp3yo2p25252p2p2pyYyYllUzIlMnM4ZY7cyohmmHqZmHyp/b/b/bmKdpMmMmRIVGERZnZmVlZmyY2p2p2p2p2p2p2pyYdVMlMmQ3Q4M3yql3qY272q2p7L/c/c7LuZVJMmMmRIZqVFd3VVNEVVlm2p2pyYqGyYyo2pyYVGQ4M3ESQ4MnZZ66uHuIyZ277L/c/b6625ZZQ4MnVZh7y8urqbdnuahXt32pyYp2hUt2p2VGMmM3IlIUQ3RIMnqa66/c/b/c/c/b662p66h5VZVZZaqbybybmKqK293NlXyY2puHhWZGdod5mKd5Q2IUM3Q4Q4Q226/c/c/c7b662Zyp66qrZaVZZqybuK2cuKyb2b28usl5dWVFqauahnp53N3N3dqbMmMmQ3M3VGuHyop3p32Z2p26mKmbVIZZZqubyLyLyLyLtY2s3NVIITqaupl3hXp6y8urp5ZWMmMmMnMnMmdGhHhXx42pyqh4dXdoQ3VIqcusybyLx6x6tp2cybQ0ERuKmIhndXmK3NzMqKhoMmIUITIlVHdWh6dph6qKh5ZXhHZXVZM0usqbuKyLx6xqxquKlpY1ZGuLZVdWQ0h6zMy8qLdZMmIlMziJ28yp26qad6ZZd5Q0ZWqrQ2ABqKRFuKyLyLxqxqqKp5t6yrl5qKZGVEVImLh6Q3MmVHqa7uybpZuJqY7Lyqqaush5urd5IkIidnABU0loyLx6t6qKqKt67ednqKVVZVVEdWZXQ3ZH', 'base64')),
  ('c045', decode('/q6Z14hCdSdShihSlihTdU2I6Z6Z6Z6Z2X232Vl0VCVBVCMiMiMzQzdCczg0g0g0g0Yzc0g022yVpklDZCdCVBRBZRdhZRdT6Z6Z6Z6Z2XqGh1ZVRCNCQyUyMiMiQyljhTg0g0g0g0YzVCg0qBuSdhhCZCVCZCdCVCVCRBRBZD2Zh3dmdndUhChjdCcyUxYyUxQxQyZCczg0g0g0g0UzRCYzZCZSVRZRZCdChShSRBRBMxQxQxp16ZyH6Zx0dThTlCxBtB1B1BxCdTZThEczYiYiYjUzRCVChSZRZRVCZBVBQxhhlyVSRCMxIhpmp2hT2Y6Y6Xp2pV1Csxoxoxxlt313oykyciUiYiUiQyVSlSdCVBUyVBVBRBRBhxdhMxMxMxMxhUdCdDyH6ZyH131CxBtBtB2H6Z6Z2I6JxnYjUiYiUiRClSlShCVCVBVBMxQxMxdhQxMxMxMxMxUyUy2H6Z2YyHtCtSpClCx3yI13xEtEpEtWczYiUiMyUyMxUyUyVCMxMhRCMxQxZTZEhVlmp2t3uHyI2ZuGyXyXuWp1lTlTlTlDoykyoykyozciYiQyQyQxQxQxMhMxMxUy2Z6q666767676q6q6767676qlmcxUxIhIRkisysysyxm6Y535m5V1EgzQxMxMhQxMhMxMhyZ6767676767676q6H676q6ZyYhCcxcxcxMhYisytD2H6r6q6q531U1EkiQxQxMhQxMhMxdU6767676767676q6q6H676qxUgygyYhUhcxcyQhxE546I6r6r6r6I1E0zoiQxUxQxQxQxQxtl6Z6q6p6p6pt2UzczxW6q67hEcxgycxYxYxYxUi1V6Z6q6q6r6q6I1EwzoixC515D1C1C1C2H6p667K652G2Fx0UzUzlV2IQiQhQhYxgycxYxtE1V536Z66666q5m1Ewzki1C5T1C1T6G657K7K652W11101111tkUzMiQyMiMhYxUhcyUhkyxV6Z676767666q1U1EsykioyxCxT657K7K7K662F2F1111111111tkQiZDQhIhIRIRMhdD2I66676767666q6I1E1DsygitC1T2W2W64656o2F111111112Fx0x0x1t1lTYyUhIiMihV6q6667676667666q1V1Eszsycitk7K7K7K7K7K7K65656565652W2F2X6o2FpklDYyYygytE126Z6q676q6q6q521ExDoyoyci2F2X6o6o65656565656o2X2F2W6o6o2FdDQigylClCgycxgy1T1k5m536H1V1ExDoyoyoyYh64657K7K7K7K7K656565657K652Xx1pTdCpititilScxcxgx2C6T1y1y1SxDxDsyoyoykyYi2W2F2V2X6o657K6565646n2F2F11x02D6T6T6T6T6TyClBti6T1y2C2E1xxytSpStSoygyYi7K6n2E2Ex0x02F2F2F2F2F2F2F112E6j6T6S6T2T1y2C6T6j6T1y2C1y1x1h1xyDt0kycig07K2X2E2E2F2Fx0x0xkx0102E2F1z6T6C6C6T2T2Sxhxh1y6j2TyE7J6k2T1y1x1xoykyczg06o2F2E2E2E2E2F2Fx0xkxkxk101y6B1x6S6T2C1yxyxyxy2S2C2n7b7byExzxy1yoykyYiYy112F2F2E2E2F2E2F2Fx0xkxkxj2D6S6S6S6D2V2nynynyV2T2D2my53K3K3KyVyWozkycxcx', 'base64')),
  ('c046', decode('qcqcqbqcqcqsqsqsqsqsqsqsqsqsqsqsqsqsqsqsqsqsqsususususususususususususyqqcucususususususususususususususututusususususususususususususususus2p6Xususususususususususysusy9qLuKl6hYqKusususu8y9y9qKp5uJysysysys2r2q2q6X6Husysysysysy8y8y8y8y8y8ushYY1YlYldHp6u8uayrzM3M7N29hphp2Zy8y82q2q2q6Y6X53ysy8y8y8y8y8y82828y828l6dYY2hIlpy9y87M7M7N/d7M3M7Myshpx3282r6q6q6p6n6X6X6p2828282828282828282829ubl6c3us3N3M7M7N/d7Myq27y828ysyI286q6q6o6n6X6H536X6p2828282828282828282828yshpy8y8y7yr2726uFmGypy828ysur276q6p6n6X6Hxmxj6X6n672828283M3M3M3M3M3M3My8usyryrqZuqyryqqJqquruauburiK286q6q6X6H52lThD6X6n6p3M7M7M7M7M7M7M7M7M68qsqbubqKqamJmJyp2p2828qKh5d7t47N676q6H6IxlhDQ06H6X6o7M7L6766666667677L7Murd6h5mKuryZ2p7M7M28yrl5VGdItX7N7M6Z6I2IxjxjZE536X6n6Y6Z6q7L7M7c7c7c7c7cy8Y1ZXhoub27283M2828yrl5QjY3pY7N666H6I2Ixj1jY0136H6n6p6666667b7c7c7c7c7c28YkUidXuby8282828ysubh5QjY2pY7M6Y6I6I2IxjtTdExk536X6p+6+6+6+6/b/c/c/c/c27YkUidXqKys2829y8yrqKdoU0Ylpn666I6I6J12tTpTdExj1k6H6n65+6+6+67K66667K/b27YkUiVGVXucysysusqbdpVXVFY2lG6o6I6I2HxjtjdEVExjxj136H6X6Y6o6p6I6o6o6o642qdHUkdpdqmLl6l6l6l6hphYhYhYlF6H6I6IxkpTpTZEVEpTxjhDxk6G6X6Y2J6J6Y6o+4+4t3hIhYhYhYdGc1c2c2Y1YkYkYkUkcz126I6ItklTpUVEU0Y0pThDpTxjxm2I2J6J6I6o+4+42YlmU0QSlmt3uYyp262n6n64yXQi2H6Y6Y6ItktjdEVEY0Y0hDlTlTpThD2I2J6I6Y6o+4+4+4/Jp3ll/J/K/K/r/a+4+46n2HhD+4+46n6GxjpUZEY0c0Y0hDlUdEtThD2I2I6I6I6I6o+4+4/KuXyG/K/K/J/a/J6o6Ztlt2lU6Y6Y2Hx1lUpUZEZEU0dEVEZEdElThEx1x22J6I6Y6o+4+5+4t2yG+4+46o6Y6Y6Z12tlx2lE6I2IpUhUxjxjZEZEhEpTpUlUdEdEdExjx12J6J6I6Y6o6o6Yt2126Y6o6Y2H1312pVlVpVlUxktkxjtk1jxjpTtTdElUtUtktUpUhUtkxkx22Ix3136Y6Y6Yt3132Ix2tltlpVpVlVlVpUlUxklUlUlUtktjlUdEZEhUlUlUxkxkxk1ktkxktmx22G2Hx22Ht22GxmpVpVpVpVpVpVtktUlTpUtktkZEdEdEhElUhElUlUlUpUtkpUtktkxkxlx26WyWp1uY6W6Gx1tltlxktklUtUtktkpTpUpUlUZDtkxkxj1kxj', 'base64')),
  ('c047', decode('dWdVZVdVhVhVhUhlhkhlVUMzM0ZURFRFVWp0ZmlodmdmhmyVVHRHNHNHRIVGVFlmx2hUZEZUVWVVZWdUZEVEREVVhWZUl1ZUZUQzMzRFRVqHdndXZmdlZmdmqGZWZWZWVXZUVEhl2Gp2hmZUhmdmdndmZmVnVXVoVnVnd3yG6o6oyYh3l2uXuWuWuWl2iGiGmHmGqGqGZnZVVEl2yIqHhlZVmHd4VnZoZ3ZnRWVoVnd2hmlUt1hl2puHqXeHiHiHmGhnaIV4V4R4V4Z4V4VnZnhn2XuHdnVnVnZnVnd4iHaIaIeIaHiXt2x1x2pl2XyGmGSWSWSHV3V3l2ZTQyQzRVVoRoR4eHZmlkmIVpRpqWaGWHeWiWWHWWWWWWWWpllltl2Y2XuGeXWXWXWXaHdlVCVDyXhUMyRmVmiFuUV1hThliJRpSGSGWGWGSWSWSWSWSWen2IpluHyGx125enSXSXSXSXd1l12oyXuGWGZ0iTqkd0SIeHp0iJZ4SGSWaWSWWXSXSXSXWXyJyJhUt1pktlto2qinSnSXSnmoyY6ot1lliEiTVEZ0WWSXao24eYmYWXaWWXSXSWSXSXWWqIx2tldlc0pEtnuK2s2bmoWnWnWn2o2Wt1l1aIeIeYaYepepip25iJiGSXSXSXSWSWSWWXx5x3x1p1VEc1lGpHdXyb292smoanlkyFuGuGeZeaeaeZeaeaiKmaypiKd3aYOXaFiEujamiGuItUdEdldGs4xJ16lHlo2syb6quqyFlSh2ZmeqeaiIl3d3iaiqmaqZuqyXeZiVyid2d2ykl2MjhElGdWpIw4xIxpxpxp2LuKuZ7K66l3unVVh2mZuXpUh3mqirmaiJuqupd2qFyS2zqWmIIiIjM0o3iYhno3tIxJ1qtYtph4ZU276qpIZFRFmY65uGplyGmZqqmal3ypmaZVdlZWdmykqEIiIjiHmYWneYo3k2k2o3pHpIupyX2s6ZyKs3pHu6uXmIyGlDhm2ouYuq2oiJRmhmdldmZmuVMzZ2aoaoaoantIknkmkmgmpXhldUlnx6mItHonyXllplZ3aJV4V3qZyY65dniHZ3VldVuGp1iXiWiXaoaoaoloons4o3o3t3ZDQyZDt4ZTpnknpltlV4OJeqeaVnRVVmzMqIuXeGmG666566y63KmneXeYiXuIonons4pGtoyXllp2uYVDMz2YpjRne9WsGbSbSJNnRVVm7L267Ky7qZp3tm2Y/cynyo2o6n6qonknons3t5yGt2qHyXhlIillhVGKWam7jNOsObWrJ5JWiHMzmIVFozszxEtVt3/t7c3Mu7t5tIonk32b2rxnt2yIhmlmIjdVk3eZdkhja8W9SsiYi8KKJXZCQyVWpDkzlEpUtUx2qad4d4lXo3tHx52s2b2s2YtmhUx1dVMzl2NDRjd2mpzei7aZnNe8OKZEhShVpEpEpDyFt3p3dWdXd3MkgmtWyJ2Lya6pt3tItHtkx2REhlZSVjeYWrSsarObWrWbObZEkzlVp3qIt4tmxUtVpmqHREIjQkk2toyY6otmo3o3lHlVdUZUlDdTdTpUhWOJGLGbKKVoRoQzUztVtltmyIyIyI13xl2WMzIiMzUllW2YyHx6xJs4hmU1VFpUpDhDR3lEwzZWB5FoNHI3ImREQ0ZEt2121l0j0j0ztjdkIjIiQzIzQ0qIyKxZxIw4U1Q2VFhUpEczRnlldVNWNnNZI3I3M3', 'base64')),
  ('c048', decode('ZpeLibmbmLusysubusqbl6hpJIJIJIJYFqCLObCLB7BpFYFYRph6Z6Z6dphpd6qJlWhoVZVYeKirmsu8usy8ysysusqLh6RYJIJIFYFZarqqVFRFR5GLFYJYNqd6Z6Z6Z6dqlnhVhVh4Z6RYu8qsq8urqIuZy8y8ubh6NYNYNXFYBYB6h4QzZFlmU0NoBoFoJ6Z6Z6d6d6lnlWdod6ebq8R6zdq8zNzNp4lWpnuJubRYJIJYqYJpBYBpRFQzhmlnZFM1BpBoJ6Z6eKeLl4lWdoaLisibebWczNu8zdzNurl4qJpny8qamZd5N5J5BpBpRWlnp4uIp3RnB5BoJ6Z6iLurhWhnZ6abebaLaLi8qsu9zdzNzNzNy9zNyrqJual4V5BpBpBpOKp4lnlnp3FoB5WKOLdodmhnh3d6Z6ababaLWKacmbzNzNzNzNu8d6qKp4qJubqJaKF5J5J6SsaJlnlml4m8irqLmJVFZVVEVEmIaLaceKZ6hoibusvNu9zezdqsZ6eKqJqJuaqKlnlmpql5y8hohWdFdGh4dYpqhWhoqJh4dWdVibZ6Z6ibl5ubzezNq9zezNiLZ6Z6p5yaububhWhWlqdYlqVHdGhWdIZIdIlqhYqKuaqJl4dWaLabesesd6yr3evNq9q9icaLeLeLd6uaubmKFpVplqdYlqZIVHZHhZVGdYhZaLmKl4qJp4iKeti9i9asm8yszemsism8eseLeLebibqJqJR6B6SLVqdZhZhZZIZHU2dWhpOcOsibqJp5d5ece9e9e9e9vdu93eq9ism8usy8qby9ZXqJp4d5BqF6B6NqhZdZdZZIhnqGmYatWtmsl4loecetjOi9rNrOm9iczezem9uKp5dYlqp7ZXdnl4VGR6BqSLvNmsm9m9vN3N28useci9qrVGdXebeLibq9qrZ6m8ms3u3vq8l6l5dWdXdoVIZGiJl5qLRqR7rNZ7i9zO7e7e28qsitmKhphoQ2Zpmah6h6iah5p1l2ze3vubh6lnlipzdnQ3mal6p6p6y9l6qsqszNu93N7eyrh6itl6p6lpl6mbnOnerenOmslllknNzeqKqKhnljljdXZYp6qLp6p6qLl6dZqaqJuZuZyadpZIeLp6p6lqp6u9nOnerevemszeaLveu8p5l6l5hnhXhYlplql5hYhZdYl6U3l3t1t1yGp2U4U3dZlqlqlqlpuLrNveveq9q9zemsveuap5l5iKh5dYdYhZlZlqhZlqlqdYVHU3uZuIqZZYQ3U3ZHhphohZlqhZmcrerNvNvNvNq9nNubp5qKmshZdYdIhJhZlZlplphZZHVIh6qbh7mcicU3U3U3lol4hYlqhZqrrNrerNzeecebvNq8u83umbhqhZhZhJhZhZlpl5ZYVHZYh6mcZ7Z7iLVIQ3U3hol4hplqhZl7revezezeicism9zezezehphZl6hahZlql6usl5ZpZYdpqb7eqteMqrQ3Q3Q3hol5l5l6hZhpvevNzezezdmsacjOreubpplZlqhqhZhqhZqKh5dpmLqbu87e3Ny9urQ3Q3Q3Q3dohohohoZHmsrNyayayIuKvNnOqrlYhHhHpplZhZhZhZl5h6d6iKy93ezN3O3NmLVHQ3Q3Q3dZZHMlQ2Q2dYzd2qyImKqK7u7u3uzNuauKp5lYlphZhpy8d6iKmLzN7uzNzNy9mKZYVHVIVIZIMlMlM2M2ZHu83ezMqqqa', 'base64')),
  ('c049', decode('3c/////+7t7t7t3teoaYWHeZR4NmVmmFqW3a3aunmGh1dmV2SGi5aom5vbzL/+7a6l7K/+/+uG/////+7t7t7t7trKi5i5epe5eoenmGy3uoqXupupd2VEeHvLvbi5eorKup7+636V7K/+/+qG/////+7t7t7t7tzczcrLi5i5ioiomGuWqXqHhVyYuHdleHm57tvbm6i5up7c2l2F7c/+/+qW///+/+7t7t7t7t7t3tzbnKe4m5iHdldluYuY26yGp2ZUZleY3t7tvbnKy67ayVyX/+/+/+yT24/+/+7t7t7t7t7t7t7trKi5ipenZmVE66/c/c7L7LqIZmm53szbnKzc7t7I2V7c/+/+/+2TyU/+/+7t7t7t7+7t3t3t3srKq5eol2VEyY7L/c7bupypd2rKvbzc7t3s3K7H24/+/+/+7cxzuF/+/+7t7t7t79vbvbzs3srKvKeXmHp2yoyq7L7ch2qYeHiozcrK3t7+7a6n7s/+7t7Z61tiuF/+/+7t7t7t7trKzs3tzcvbm5iompvLuq3L3MypZmaGaXenvbi5vL3s7K257+3L7J612EtzuW/+/+7t7t7t7tnJvc7t/+3cmpiHuX7L3d7c7vmZmIh3Z2m5rbq6qprKzLy7237H7J2E2UyDp0257J7b3b3c7tnJzs3s7tqpd3Zlu63L7u7uqqd3ZldmZmd2zMzLzL3dzL3d2n6m6n2U6l6UuG262m642UyV7tm5vL3czcy7uquq3ey63d7d3dZmh3REVVVVmZqqupyo3c/+3b2V2V+2+26kyo/+7t3LyXyEyovLvLuqu63Ly63c3u7v7v3d7uy7REVVREVVdmd3iHiHmYu63cyV62+2+2+k24/+/+3cu6yEyEzK3s3tzLuXuo3L3u7v7u3dupuZh3MzMzM0ZmVVVVVVdmh3d3mG7n/H+5+k2l/+/+3cqYqXuWuX3K3LzMyo22yo3uq7qad3ZmREqZqYZUdmqZqpiHREREREZmZmmW7G+46k6U7c/+7tupqXy5uo667K3c3dy63uzeh3iIh3d3Zmd3y7uoiHZmZmZmVVMzREREREVVl1lk+k6kuX7d7ty7u63d3d7L7L3czL3M3umad3VVREZmmYh3ZWiIqZiId3dnRFIjMzMzIzREREdT6k+k2mmGupy73d3d3c7KuFyEyp3c3LZmREZmZmZWZWiIh3ZmZWiImId3dnVVVUMzMzMzRERE6k6k6l7t3cuol2upuF2o2V/WylmHqZVVREZWdmZmVVZWh3ZmRFREh3iIZmZmdl62lkVDVDVD6l6l6l2n2o24252Xt0yU61/m3IzMqpREREVVZmdmVVVVZmZmREMzZmh3iIZmZmZUdDqHqHZD6E6E6Ex0t06m/J636U7F/W/mzKqpmIMzMzREVFZmZmVVZWZmREMzREd3h4iId3Zml0l23cup6o6X6E2E6l61/X6161/G/W7G3Mh3d3REMzREREVVZmVVVVh3RFM0M0ZmiImIqqqqdmu6mHh2/I616l61612l6k6U+1+1/W24u7dmZmVFMzRFREREZmVVRFREREM0M0RFiImImZ3d3diI/+/+/K/G/G/W2U2m2W6k+16l/Z7vqqVVZlVVM0RERERERFZmVFVVIiMzMzREVVmImIuq7uzMqq/++3+4/G/G6U/I/J7W6161233ciHZVZVREMzREREREM0ZmZWVVREMzIjMzREVVmIiIu7u7d3/+', 'base64')),
  ('c050', decode('l6p6xZxYxYxZtppptptptpiLl6t6x7acKsOsqLuLu9q9qsmLpqtZpZpqitmtyL161616x6x6tqqLqc1Z1p1pxqt7xqx6uLitqLqLSsicKsetuLmcm+mtqLqLpqtZp6i9m9qti+i9mtubuLucmLmcm9uL1q16x6qcx6x7msqLmcitl7tqmLetx6m9itqcqLqLp6qLm9i+mtqsusuc16yLi9qsmLmcm9i9qcx7yLqcxaxJm9tJtJtJw4tIpqtZp7m9qcq9qcqLitm9m9ybucqtusycyce+i+ucmLmcmtm9qsuLqbuL16uLysxq0404tZm9jOqsm9mct61JuLmsq9jOm9i+m9m9i+q9a+bOqcyLqtmcmti+etatmLx61qysxq1Jxp04w4tJmMqcjOnOmcm+i+qMtZtqqcuce+i+m9bObOi9m9e+qcmtmti9e9p61Jububyb1Z2L1604040o0otqt7t6tqpqitxZxI1ZuLa+m9i9bObOi+m+e+isqcm9m9fOfOqbur2b1q16161q1ZxqxJ0o04xIxJtZtJtZtZxax6qcmLp6mcetbOi+mtitmsqsubm9fOfOfOjNrNys565q56ub1Z1Zxq040ow4xJtZp7qLyLqcm9uLpql6tqqLe9m9u9qsm9fNycqse+fOfOfOjOm92L566b6K6L2Lxpmbp6tqtqpqpppqmLismtm9i9jOjOjOm9qsqsicibh7usm9jOfOjOjOjOfNi92bq9q928rN1Z1Zi8esite9itmtq9q9q9mciLiLl6lqlqpqlZlZhZdZqsm9nOjOjOnOjNjNfNfNfNi9vNx65Z1Zt6fNfNjOnOq9qtqcqclqlqlqpqpqpqpqtqlqdadZetmcjOjOfOjOnNjNfNfNjNu8nN1Z5Z1Z1Zm8qcucyLyL2Lx61616165656565656162LyLubatete9fOjOi9nNjNfNa9jNusq81Z1Z1Z5ZuLnOqsyL162L2L2L2L2LyLyL2LyL2L2LyLyLuLitnNi9jOjOqcfNjNa9W+icxZuc1Z1I5Z5J1Zq9q9m9qsyL16565656565656562K2LyLyLyLaci8msusqsyKfNjNjNa9p71Zys1Z1Z5J5J5Zusu9q9m9qtqsuLyLybybybyLyL2L2L2L2L2LacacW9qb5q5qe9nNfNa9qKysyc2L1q5J5J5ZqsrOq9uLqcusnNjOm9yL5656162L2L2LyLyLaLWsfNfNms5qmsi8aticyL2b16zO5Z5J5J5Zqsm9q9yL1quLm9nNnOfOmt2L162L2L2L2L16mLjNjNrdjNqb16mbp7t6y95py92s5Z5J5J5Zmti9u92b161616m9nOq9m9fNqtus2L565q5qybrejNndjNa91616ubx62syc1q5J5J5J5J5Zecicyc2b2L2L565p2Lusq9q9nOutq9yLtqtpybycnNm9WcetuL5Z165Z2Lys3N2s5Z5J5JxpGtmcuL2cyL16161p1puLysysy9u9ysy9yblqx6ucmsiceMWtt65Z5Z5Z5Z5Z5Z5Z5Z5J5J1ZuLmMt72b2L16161p5Zp6qLu9u9ysytyt2c2LlqaMaLd7OdG9tq5Z5Z5Z5Z5Z5p5Z5Z5J5Jx6qcx6x62b56165q5px6xppqp6yL2c2c2L2b2cZ7WLSMKdGtmLecxZ5Z5Z5Z5Z5p5p5Z5Z5ZyL165Z162b2L165qx6p71ppppqpZtq2L2L2L16', 'base64')),
  ('c051', decode('Zpd6Z6Z5d5eJeJeaiqiaiIqYmYhnyYqI26V6WMR6NYdomYh2ZUd3qpmZmYd3VEQzMyMyMiMiZ6d7eLeLeLibibeLibeKmrmriaZoyZdnypeKWdWLSLZoqpiId2q67u7u7u7u3tu7d3QzMyMiZqd6d7eLeLibmLmbq8iJ3tzciIdnyZVFyqZoSMSLR6RYl4mq3tmYzczczc3u7u3u3uzciHQyZqZqd6d6d6d6msms3tmZ3tzczMl4p3l3uZVXNpSLWcVoh4iI3tq6qqqqdliHvL7u7u3u3tq6ZqZqdqdqd6u87uu8q8iJvMqauqh3lmVFdFl3NGJGNGZ5vMvM3tu6h2vMh3VUVUmY3u7u3u3tiLdqdqiL3d3uqrh6mbmrm8qaqaqIhnVndWp3ZXI1VoZoaKm8vM3dzcvLzMZVVERDh33u7u3u3tiLqs7uzNh6hph5mKmbmbrMmrdnVWd5Z5VGlnM1VXNXNGibirzLzc3t3tu7VVRERDh37u7u3t3t7uu8dqh6iKiLiLmbeLiLq8vMiaZ5d4V5NGdnZ4NYRHmZm7m7q7q8zd3tq6RERDQziI7u3u3tu8dqibibibeLismsismsmcmbvMq8iaerRpVpirNYZZVHq7ibmririrvcztiZZlQzQzqq3tztdqh6mbiLibmsrMrdrdmsqcqseKebaKm8erV5V6RXRHVIiJiriribiriberabebiIVUVE3tq8iLiLmsmbh7ibi7nMrNmsucqcZoebisaKV6VpRpqqmZRHRYaKmribibibebebebabebiIm8msd6icismLd6mLmamaVoibmbh6Z5ebaaSLV6Rod4qbqbd5RYRYZ6ibibibeLeLeLebebebibmbdqibiLh6d6iKZoVpdpmLmLVYeKaLecWLRpeaqrqsqbmbRXRoZ7ZqZ5ibiLd7eLeLeLibiKdqiLmrh6dqdqd6VqRZZZh7dqRYRpWLeLq8VoZpu8u8h7h7h7d5WKVqVpibd7d7d7d7eLeLdqeLmsh6dadqdqVpZqVpRHdqVqRIN6NpNYVpibu8qsh7hqh6dqd6iKV4RIVqeKd7d7d7d7d7d6iciKdqZZdqd6VZZ7aLaKVpRJRYJGVXh6VYiaibmrdqdqdqdqdqdqqsibeKZ6iLeLiLiLd7iLd7ZZZZZZdqZpZqd7Z6d7VpRINXV5ZpdpM1NFNGRYRpV5V5aKababaLV6V5eKeLeLeLeLd7d7ZZZZZZZZiaZ6RJVqZqRHRYRXNGRXdpZpI1N6NYR5acetacacacacacacWLRpV5R5Vod7d6d6VJZZZZZ5VoVpRJRIRHNGZoh6VnVnRHRGNFN6NYVpRXNYNYNXNYRYVpZ7V6VpRpRYRYRXZ6ZpVIVIZpV5VYZZh6h6ZZVpd5eKiLVoNGNoNXNYRXVYZYVYVYRXNGRHRHRHRHNHRpM2RGRXZ5VIVIVIZ6ZpVYZZZZZZVIRHiKiKiLI1NGRoRpRYZ6dpZZVYM2NXNGNGRXVYVYVYZpd6dqdqZqRHVHVYV6ZqVYRHM2M2RHZpZZdpeKM1NYNGR6RHRHZZVINGM1I1NHNXNXNXRYdqdqZqZaZaZqRHVHZ6VpZqRXZoVYZoZZZZZZVYZpRHNpWLWLRYRHZZZZVHRHRHVHVIVIZZZZZqZaZZZZZZZZZYVXd6VYVZNHRYVYVYZpd6iLiKd5VpNYRpVpRpiraKNYVoRHRHVIVJVJVJZJZZZZZJVJVJVJ', 'base64')),
  ('c052', decode('MiQiQiQiQiQiQjQjQiQiQiQiQiMhMhQhQhQhQhUxdCuX7c/t3tqXdTZCVCQyQiQiQyMhMhQyMhMhMhMRMhMhMhMhIRMhMhMhMhMhMhUyQhQhQhUxdCuX3K7K/tqGdDZCVCQiQiQhQyMhQiQyMhMhMRIRMhMhMhMRMhMhMhQhQyMhQxMhQhUxQhYydCqH26yq3LqGdCZCVDQiQhQhQyMhMiQyQhMhMRMhMhMhMhMhMhQhQhVCMhQhMhQhUyQhQhZChTupy63L3LqGZCZCVDQiQhQhQiMhMiQyZUMhMhQhMhMhMhMhQhQxVCVCQhMhQxZCUyQhUyZCqHy73M7d7dqHdDUyVCQyQhQiQyQhQhQyQiQhQhMhMhMhMhQhUyUyZkQxQhUyZCUyUxUxYydD3M3d7u3dy7mGdDUyUyQyQiQhQyMhQhQyQyQhMhMhMhQhUyUyUyZUUyUyZCZCYyUyUxUxZDqY/u//7tu7mIl1ZDUyUyVCQyMhQyQyQhQyQhQhQhQhUyZCUyUyZDUyUyZCZCZCYyYyUxdUh17u//7u3MqZmImHdDUyUyUyVCQyQyQyQiQyQhQhQxYyZCZCZCZCUyUydTmGqYdDZCZChlqY7d/+7d3cy6qYqYqYdTZCUyVDUyUyUyQyQyQyUyYyZCZCZCZChkqYdDl27t7ul2dCdUqH3c7d7u7d7c26ypqIqIupmHZCUyZUdlUyUyUyUyUyVCZDUxUxYymH7dl2qY7u7umGdThl3d/u/u7t7d7M3LypuXqHmHqYq6dkUyUyh2VDUyUyUyUymHUyUxYyqH3cqX3L7u7tqHqGl27d7u7u7d7c3LypyYyXqGmHqHmYrLvMdkZUZDd2UyUyUyUyUyYyZCh23c3c3s7u7+3d3cupzM3u3d7c3L3M27y6y6yXl2l2mHm6rLzezMmHmIdmdUVCZDVCdTdCl2q73t7t7u7+///+7uqY3tvcvb26yp3L3d3dy7uYlmh2qHuYq7zN3u3dvMvMu7mHdlZUdTl13cvM7t7+7+7+7+7u3tvKvbnKnJqo2o2YypyoyoqIiJZpqIp2uGp2qH3M3ezd3ezdmYdmupzK7tvM7u7+7u7u7t3tzcvarKi4e4q6yX2o2o2ouHhkhTl3uHyYuHyYp2uH3dzd3e3dvMiZzK7s7tvM7u7+3t3tzszbranJi4enrKu7uGyXyXuGhThkhTmZuZuHuHyYypuazM3d3e3dzMmq3c7s3smr3t7u3tvbrKnJm4i4nJzcu8u7uFynyWt1pklkhTuqiKuHuGp2y6y7urzN3e3evMmq3c7s3smr7u7uzdvbnJvbzc7u3eu8zNu7uG2oyXyXyXlkp2zNqbqayp263L27yqy73u3evMma3c3s3cq77u7uzdzc3u3e3ezNmKy93NqruG2o2o2oyXp1qZu8u8qru7zM3M27273M3c3cvMia3b3c3cmr3u7u7u3u3ezNqcZZmLzNy9u8uY2o2o2oyXyXu7qry8u8y83d3d3M3M/u7dyqupmqzL3b3bq77u//7v7uush6h6dpu8zNmKZYqr3L2p2o253Mh6dpur3Nusy83dzM3d7u7cy6uXmZzLzLzLq77u7v7vzNusqcmbh7u83dqrdpdqmL3M2pzMh6ZYhpmKy9y8y9u8qazN3N26ypyYmZzKzKzLu87u7u3e3OzNzNy93e7u3e7uqsh6dqdqhqhqdpqb3e7e7e3N3Ny8qbqby8urypyoqq', 'base64')),
  ('c053', decode('RERDVVVmZ2Z2ZmVlRUVVZ3Z2Zmd3Z3Z2ZmZmZ3ZmVmVlVlVVVVRVVlZmVlRENDMzMzMzMzMzqJdnZmZmVmZmVmVlVVVlVmZ2Z2ZnZnd4mImJmJiIiIiJd3ZmZmZmVVVVVVVVRENDMzNDMyRDp5p5uJyquqmJqZqaqZh4ZmZ2Zmd3iIiIZnZmdnh4mJuayry7qamZqaiIZ3ZmRURDRDRDMzRUunyoy424youZuaybyryr28y7yruamJzMqpeHZ2ZmZmVWZmdndnp5ya2rqJuayrurqaurqaZ2uFp1l0p1uFuGqH26yquKp5qJuJyr2ry6zL3bzbzLu6moiHd3ZmdWt52syryryb2ryr2r2ruqVUVUVkh1ynynuWl0hUdWZVdldlp2uIuZyryr3L3L3b3b3czLu6qol3uGuGp4lolouKh4uKp5iWiWh1p1p1hUZUdliGiHmYqomXunuWp1qFuHqIuKuauZuZy53c3bmYmHmHuZiHd2dmdndndXd1d1ZlZkZkh3h2mXmYqoqXuWqFl1iGmYmYiGmHh3dmdmmFun253JqoiHZmp5qJqZl4l4iImYZlZld1d2p5p6h3iHiHmIh2dld2qZ2r27u6u5u5u5u6vLu6mYh1l1uWl1mXiHh3hnhohYhniHZmZmdnqKppppyKybyb28282syryruah4h4y7y8zMy7y7zL3czbqoiGmGzLu6qomXiGd2d2iGRFVFuKuKybybmJl5t62b2b2b2b683MmJqJybp6qJl5qJdn3c3c3czKmomXu5zLvKq5qoqomXiGZVdHdHlYdXZWdXya2rybyb2r682rublplpuKuauKuadn3c3czLzLvKq5iHd2qozKu6moiHZlVkU1ZmZWQ1Q0dXyrqKdYlphYhYdYZIZIyKyauKybl5iIu6vKzLzKu6u5q5moZ1ZkiHu6qZZlZlVkRDZ1VUVEp528dXdXp3hY2rp4ZmZmybt5uKuKhomZ3czLqpu5q5qoqomXmGqXqYp5l4ZlZlmYZkeGiXd2pouaZml2qHp324y4vKqpuaybyrZWZWu6zLzLu6mYmXmYmXqYyquap5hohoZlZld2mYVUmYd2lolphYlpdXhV23y4u6uq2syrl4ZmZVzLzKvKu5qomXqYyquKuKlolop5hoZlZld1mXd2VUiHVWZHVFVUZ1hl2nyou6qJt5p5VFREiHvKu6u5qou5yqqKp5p5lol5dnZWVGZld1d1d1qoZkVUaFVUeGmYqphlqGmHmIholodXZ1d1u5u5qoqYmIuKualolouKqJhoVGZFhld2d1d1d1iHmXRDd2iXiGiXmXVEVEREQ0Q0REZlu5u5u5u4uoyrqJhnhodHp5l5ZHU1dDhjh1qZd1Zld1d1mYZlRDmoeGiGiGVERDREREQ0REiHmYu4uop4qJhnZFdGZFZFZGQ1QkZTiFh1mFqZmIZlZlZld1mXVUVEqpd2eGZld1iGd1VUd2u4yXqIqKl4hXqJhXZFU0MjQkQkQzRDVDZ0Z0dXl5d2VUVUZkiHd2RDZlmoeGiHiHiHmXqWynqIualohXp5lohXU0QjMjMSQ0RDRDRDRkVkMzU1qJl5ZlVUVUZkmYVUMyiXiXiGiGmFqGyqyblohXl4lohnZFU0U0QjMSQzRDRDVUeXd2RDVUh4l4dXdXdWVUVUd1iGhnZVqpeGh2p4ybuauJp5lol4ZFU0U0QjQ0QjRDREVUVlioiHVUVUd1', 'base64')),
  ('c054', decode('7t7t7t3JyXyX257t7t7buXmGh2h2h2h2h2qY3bzKiHd2dmZmZldlh2l2hldlVUREQzIRMzMz7t7t7t7K2n7K7s/t7t25yXqHmHmHmHqHzK3sy6mHh2d2d2d2h2mGuXyouXl2ZUMzQzVDMzIi/97t7t7a7a/t/t/t7s2oyXuXuXuXyp3c7sy5qXmHmHiHh3h2mHuX3b7+7suWl1ZUQyVEQyIR7t7t/t7s/t/9/97t7c252o2o257b7t7s25uouYqYqYqYmYqYuo3K7t/+/uynmGdldlQzMyIi/9/9/9/9/9/9/97clmp3uYyZ3L7t7t3K2oqXdmZmqYy53L7c7s7t7b7s7byoqHh2l2VEMyQz/9/9/9/9/9/9/9uYlml3p3p3p4qIupyoZVM1RFM1M1d43czKy5yoyo25y4uYqHqYhlZlVERE/9/9/9/9/+/+/9uHlVl3p3pmpmp3pmVFM0M1M1M1M1M1mIypypy5uquZqIp3lmqHmHl3hmZV/9/+/+/+/+/+/+uHlVlmp3lmhElVhEM0M0M1NFNFM1M0dny5y7uap3p3p3p3lmp3qIh2ZVZV/+/+/+/+/+/+/+yYhVlmpmp3hVhEdDQ0M0M0Q0U0M0M0Zmyqp4p3p3lmp3p3lml2uYl3dmdV/+/+/+/+/+/+/+2phVhmlmp3yq7cy6ZVQzUzY0dEY0QzQ0lmlmlVlElVp3p3hVqHuYl3dmZV/+/+7t3L/u/+/+7bhVhVlml3qI7t7tZVZEdnhWhVdnZFZEhEhEczdEpmp3lmhVqIqHl3dmZV/+7typhl3b7t/+7tlVhVlmlmmImZ3LlUlVp4p3pmp4lmdEc0llyolmlmlmhVdmuZqHh2dWVF7t3Kp1dDuXuo3K7tp3hVhVhnZWQ03LhEpmpmpVlVpmpmdVyY3KZVdnlmlmhVh3upqIl3dmZV7thlZEdVqGyo3K3KhVdEdmVEMzMzu6qHpmlldEhVdElVhn26dmMzVVl3hWhVqZypuYqHh3dl7sdUQydUllp1uYypQzZVMzIiMzMzQ0mHdFlmUzUiZEdVh3REIiMzMzZmdWdFqYupuYmHh2Zm7buoZEdUpk7b/97tZVMjIjIiMjQ0IjIiMiUzhVlVdFMiIiIjMzMzMjIiVVVEdmupqYmHh2Zm7s3Kl23L7byG7b/9iHIiIjIiIiMzMzMiMjQjMjQjQjQjIiMjMzMzIiIiMjVVh3uYqImHh3dm3Ly57c7t7t7s7b7ay5IiIjIiIiMzMzMzMzU0dEY0Y0MjMzMjMzMzMiIiIiMiqIqImHh3dmZmzK7s3b3a3J3J3J3K3KVEIiMjMiIjMzMjMzIidmdmVFMzREREMzIiMiIjIiZmmHl3h3h3dmdmzKy5y4y5y5y5y525y5mHIiMjIiMzMzMjMzMzIiVFMjMzQzdnVVIiIiIiREmHl3h3h2dmZmZVunuXuYuXuYuoyoyoyoyoMiIiIiMzMiMzMzMzMzMzMjMzMzZVMzIjIiIjh3h3h3h3dmdmZmVVmHupqYqHy6upy6y5uYuYQzIiMjMjIiMzQ0ZHZHVFVGVGQ0MzMzIjIiMzh3mZu7mIuqmImIqqqYzM7dy7//3M3M3cqHqXVDIiMjMjIiVVh4mJh5hohohoh4QzIiIiIiMzdmu7zMzLy7h33dzMh2zLzL3c3d7dy7upl2l2VEIiIiMjIiQzZmh5mJh5mJhoZXMzIiMjIiMzVEd23dzM3MmZqq3d', 'base64')),
  ('c055', decode('IlIlIlIlIkIlIlImIlInInNII4I4I4I3ZpMkIjIjIjIiIiIiIiIiIjIjIjIlIkIkIkIjIjIiImM3ImM3IlM3M4MnMnImImImImImImRHM1MjIjIiIiIiIiIiIiIiIiIiIjIkMlIlMlIkIjIiImM3M3M4M2NHRJM4M4M4M4M3NIM2RHZoIjIjIiIiIiIiIiIiIiIiIiIiIiIiQ2MkdYIkIjIjInM3ImIlMnRZRZRZVaVZVZRZNIM3VYVXIjIiIiIiIjIiIiIiIiIiIjIiIiIiQ2QmUmMlIkIkMnImIkMkMmRIVqZ7VqVqRZRZM4M4RIVYIjIiIiIiIjIjIiIiIiIiIiIiIiIiM1MmMmIlIkIkM4ImIkMmMnM3VqVqVqVqVqRZNJZqd6RGIjIiIiIiIiIiIiIjIjIjIiIiIiIjQ1h6mbM3MlMlM3IlIkMnMnRIV7aLaLaLZ7RqRad6VZIkIjIiIiIiIiIiIiIiIjMjMjIiIiM0MjZpmbVZMmQ3M3IkIkImM3ecm9q9q9mtmtZ7RaRZd6M0IjIjIjIjIjMjMkMkM0Q1MkIjIiMjMjZ5vNVIMnMmM3M2M2M2RZisvOvNvOvOvOecVqRZZ6ZpIjIjIjIjMkQ1Q2Q1Q2MjIiIjMkIiIjQ3Q4VIQ3MnM4RZRJVqVqZ7eLicq9m9isaMVqRZZqmbM0IjIiMjQ1Q1Q2Q1MjIiIjIjM0MkIjdozNRIMnM3M4M4RJVaVqaLicaLececV7V7RaRZRJmbRGMkIjQ1VGQ1Q1Q1IjIkVWVGRFQ1MkVYiLVZMnMnM3M3VZVqZ7VqeLVqaLV7RqVqRaRZNJRYd5M1IjMzIiIiMjQ1M0RGVWM0U2M1M0ZpicM3MnM3ImInM4Z6V6V6Z7VqVqVqRqRaVqRJMoRIZpVZVXM2IjIjM0VGVGQ2Q1VHdHU2Q1ZYVYMnMmMnImMmM3RJRZRaZ7Z7VqZ6Z7VqRJM4M4M3MnMnM2Q2ZYZoVXVGZHVHRGVHQ2VGM1h5zNRIMnM4ImImMnM4NJRZRZZ7VqZqVqRJM4M4M4M3MnMnImMmZYZYVHZXZXQ2Q1Q2IjQ1Q1VYmsVZMnMnI2ImM3MnM4RZRZRZVqRZVqRqRaRqM4M4MnMnMmMlVHmKZIZYRFM0Q1M2IlM1M1Znd6MnMnMnIkIlIlImMmMnM3M4M4M4Q4M4M3M4M4M3MnQnMnQ3Mlh6dZVHVHVHVZRHM1M1MkRFVnZpVYQnIlImMnMnMnMnMnM4Q4Q4Q4Q4Q4Q4Q4Q4QoQoMnMmMnQ3iKVGZombRGMkM1M1IjIjM1IkRGVYIlImImMmIlMnMnMnMoMoM4Q4Q4Q4Q4Q4Q4MnMnRIQ4QnQnZZd5ZYQ2Q2Q2MkIjIjIkIkIjM2IlIlIlIkIjIlIlIlIlMmMmMmMmMnMnM3M3MnMnRIM3MnQnRIMnd5doVHM0IjIjIjIjIjIiIkIlIkIlIiIjIkIlIlM2M2M3M3M3M3M3M3NIM4VIZZVIMmMmU4RIRGZYQ2IkIjIjIjIiIjIjIjIjIkIjIkIlRGM1M2M2M2M2M3M3M3MnQnQnVIU3dZdqZZZZZIRII0RFI1IjIjIjIjIkMkMkIjIjIkIlIlM2M2M2U1U3M1IkMlQmQmQmQmQnU3U4U4QnMnQnQ3M2M1IjIjIiIjMlMlMkIjIjIjIkIlIlMlM2IlIkIkMkQ1QlQmMmMnMnMnQoQ4QoVIQnQmMmMmIkI1IjIkMmIlIkIjIjIjIjIi', 'base64')),
  ('c056', decode('QjQiUiUiUiQjU0Y0ZEY0YzdEhFhWlnmKuK6pyKqKqKl5pnhWdGdFdFY0YjYjU0RGRGVpaKRoQ0QjQjYiYiUjYiYjczczcyhEhVpnt4yZyb/K6ayaqKqKx3pnlWdFdGc0czYjUiQ1ZpVpVpRGU0U1RGY0YiYiYicicyczgyhElVxm2H2YyJ/a65uauLuJ6W2XlWhGhFczczciYiQjZoRGQ1QjY0Y1ZWZXdWc0czczczczgzhEt2t2tmlnVFl2lnZYdolW6m63xmlFlWhEgzgyciUhQjQkQjQjc0czc0dWdFczczgzgzgzhDlmh3M0QkM0MkZXVGQ0MjQjc2lXUihDpXlVlEcyciYiUiQiQiUic0gjgzczczczczczhDlElTQiVXISYzZEMjMjIiISVFISQjQ1EAczpmlVlEgzciYiYiYiYiUiY1gjcjczczgycicygzpDlCMRQjYzgyMjMkQlQkMTUiIRY0IRERhFpVpVlDkzczgzciciYiUiY1c0ciYiYicygygygylEpTQiMRczcylmuKqKl5hYlTgilDMRQjtVpmpDlDgzhFlEgzcjcjYjY1Y1czcicicigyhDgylFpElDQixigyczQkQkMkQkcj6VxkczpUtVtVpUkylFpEk0g0g0g0c0c1c1hFgygxgxgihFlXlolYpUpU11kyYzMiMjMjQ1U0pk2WtmtUxltWhFlDpEozg0g1Y1ZFVGlEhGhFhFgykxgylDlWlopntWxlxUcylDcyUiVFUzU0cz11xmxmtmlWhGpEpDkzY1Q1RGRHRHpnlWhGlGlFlCkylDpVpWxl112G61gyhEgzczg0cyMRUipTtTxl11pWpVpDpDczQ1M1M1I1IlpVlXhXlWhGhGlDpDtUpE11x3xn6UgzpCoyczpCxSczczlDtjpS2VxkpDlCkyYjQ0M1I1I1IlpVlWhGhGhGdGdGhEtTlD1ktmtWxkcztDtDtStC6TxTpDpTx0lC2FtllDkyc0U0Q0Q0MkIkIllWdFc1ZFVGVGRGdFtTpT1jpmxmxkcztTxzUhtS/G2E1zxi1z2D2VxkpUY0U0U0U0QjQjMjIkhVdFZGVGVGRGVGdFpUtj1zyG2nyFc1hDxjYixz/X1z6l2D7G636ExktUc0YzU0UjQiQSMSMjhGdGdGVGVXVGU1ZFhElDtT6V/H6mx1xj2UlD2U/X6l/H632W2Fxkx01ktTYiUjQiQiQSMSM1ZGZGZFVFU0U0YzhEhExTlDxj61/H/I63+3pC6V/q/H6363x21l10tlxj1jcyUiQiQiQSMjI2ZFVFY0YzczYyYycztTpkxjxz6U/H/Y/G/GtS2U/q/Z636m2F6m2WxltkxScyUiUiQiMjM1I1Y0Y0lUhEhDYzhEUidEtTlU1z6262/H616ltS2E/Y/Z7I6V2V6262xklUlDczUjQjMkM1IkISUjp0hElUYzhUUiQiUzpUtT1j2E2V2VlTdEtTtk616k6U106VyF62lEtTYzhDYzUjZFQ1IjMSlThDhUYzhUUiQiUjUjhFpThFhEdEZEY0U1pCxj1j1j1zlD2lpk5yhDpCYzQzUzYzU1QkQiIRdDdDczYzUzUjUjU0UjY0dDdFZFZFdFU0VFcyczpDsygyhEpClCxSpCYzYzUjQiMlU0QjQiQiczhDUzQjQ0Q0QjU0U0czY0hEdEU0U0Q0ZEQiUjc0g0cyUzczhDYzczYzQjUzMiMSMSUjUzUz', 'base64')),
  ('c057', decode('QzVDUzZEdUlmt2yH2Z2q7M7M2r2r2q67yItmlmlWlVlWlVhVdEU0MjMjMjMjMjMjMjMkqZdqdUUzZDZEhVllt2yH2I2Z27682b2b2apnhXZFdVlWlWlWlVlVhVZEM0MjMjMjMjMjMkMky5dql2ZEVDdEdUllp2yHyI2Z2r2suJdXdHY2hYhHdXhXlWlWhVlVlVhUMzMjMjMjMjMjMjVFurdqmHl3qHdEhVlVllt2yIyIt4VFQ1U2ZGpZx6xqyL2btopmlWlVlVhVMzMjMjMjMzZUVEdmiKdql2l3uYp2hUlVllpmp2tnZFM0U1ZGZHp6yst6tqt6t4pnpmlmlVhVQzMjMjQzhUllp1qIdqdqh1l3llyYdUhUlVpmpnpnlWU1dGZHuL283NqLlpp6yKt4x4t4pmlmU1Q1VEhVpmlVpmuHh6dqh4mJhUllhUZEdEhVlVlVhFdGZGhYubmLy9usys2s2827ya2Zx3pmZEZFdElVlVlU12llhndqqrusdUllp2dEZEZEdEdEhFhGdFlYuLysys29287N7M7M7N7M2JtmhVhVhUllhUlUtltlmIdqmazNdVhUyphUUzZEZEhVpmx428ybybys7N7N7N297d7N7e7d2ZllllllllllZDdEtUpUqIZpiK3ddndUp2t2VDZEdVt3pmx52b69697N7N7N7N2s2s687d7NyIhVhUlVhUlldEYzpUpUqJZZiJmJiJZDllpllVUzhVt3t3x42a2b2b2s69282s28ya2r7M67pmhUdEhVhUlVhUpEhEtll6ZZl3uXh4ZVqGhlhUUzhU2Zx3x42a2s282r2s2s2suI7M2r672ZlVdEZEhVhUllZDlElVx2ZpVZZVh2dVVFdluGlldUdEyIx4x32J2b682s2bt4uIt37M2r2Z2IlVZDZEhUhUlldEllplt3VZVZVEhlmJh5VEl22pllZEt2yIt3x3yJ2a2b2KlWyZt3672Z2ItmdEVDdEhUhUllpllluHdpVZVZh4dnzNurVDhlt2p2dEplyHx3t3t3yIyJx4hV2Zx32q2IxmhVZEZDdUhUhVpmp2uHqJVJVJh6ZWZXu83dZEhUplt2hUdUx2yIyHllt3x3pnlVyZyH26x3lVdEZDZDhUhUdEhVlVlmVZVJh6h6VWdnma7uZWdUllt1lUdEtmpllVhVpmpmlVllt2yGyop2dEZDZEdElUhUUzUzuYVIVJd6dpVZVGZWh53ddnVDqGmGhUVDZDUzUzhVlmlmhUhUlluWqYhlZEZEZEhVllhUYzUzp2VIh6ZZRIRIRFRFZoqbd5ZEl126hndnVFZEdElllllVhUuIyXuGy4hUdEdEdElVllhUZDZDllmKVIRIRIVIRFRFVEZVRFZEuXyoqZzMZXVEdElllldElluHyGplp2dUdEdEhUllllllUzZDl2d5Q4RIVIRIRFRFQzdlQzVFl2uouq7eh5ZXVDdUhVdUllpmyGyYl2dUdUhUlUlllll2UzZDdEh5RIRIQ3Q3MzQ0QzZUQ0ZXVEh1h37uu8ZXVFUzU1lllltlyG2phVdUdUhUllllllhlUzZEZDh4RHQ3ZYuqQzMzVEZEQ0VWZnVEh47u3ed4VGQ1VHhVllt1lluYdUdUhUlVllhUqHQyUzZEZEhnQ3mJy67KQzQ0Q0VDQ0VGdododo3N7uqrVHU3VHhVplp1h1dldUdUhUlllldUVEQzZDZEdUlmqZdomJh5', 'base64')),
  ('c058', decode('VaVqWMatqLdqdqVaRqR7VZZZIkEkNXIkU0ESESEjIkI1IkERd4VmESV5RGNFR6V7RqRqRqR7ZqVqWLatp6dqdqVaR7VqZZVZIlABABM0qsiJy9qrRFRFIkERJVEzRXRGu8ZnI1VqVqRqR7R7eLVqV7ict6dqdqVqR7VaZaVZVZNHESzM3O3O3O3Oqru8IjIidHZHdoiJy8h4M1VqRqR7R7R7aLVqV7mct6dqdqVqV7VqZZZaVaVZRG3e3O3O3e3eu8u8VWlYhXdIh6dohHhGYlZXR7R7R7V7Z7VqV7qLx6dqdqVqWLaMVqdqVqRYM2h4u8zOu8d4mby9yrpolpY4VZhplYQ0Qjd6aLR7V7d6Z7VqV7ubx7dqdqWLaLaMl7pqVYRIM2h5mbu9qamKur3NysVXWJY4VJNHV6M1IkMzV7V7dqVaZ7V7V7yLyLdqdqacaMaMmLNGI1M1M2qszO3O3OzN7N3ey8NHR4I0ITRXZpM2IjIjRYdqVZRHZ6aMZ72LyLdqd6etaMaMZoIkVnVWM2d53e3N3O3O3O3OzNIiJEIkIkqbeKzNvMM1VYZqM1I0Z6aMec2L2LdqicetaMaMZ6RWu7maRHVXzNy9zN3e3e3e3NiJRWVnmKzNqrdol5t6dqRHzdqrZ7aLis562LdqicacaMaMecZ7mriLq97/zMmKuszN3e3Oy93eu93Oq9zN3e3e3dqKqriKzMu7Z7Z7ec562LdqicacaMaMqsibu93e7v7v3embu83Oy9ybzN3eu93eiLze7v7u7e7u7/3uqauraLZ7ic562LiMiLacaMaLmb3e3e3e7/7u7uzdu8mauK293O3O3e7/mczO7v7e7v7/7/7/7/3eaLZ7ms562Lich7acaMZ7qs7u7v7v3ezNu87u7vu8ys3e3O3eu9zNzNzO7N3u3e7v3e7///7uaLZ7qs5656eLiLaMaceL3e7v7v7v7evMu9u97vy9zN3e3ezNZqd6qsqbzO3e7v3e3e7/qszNacZ7qL5656ZZecaMe9mb3e7v7e7e7emLiLZqvNu9u9zOzNiLVZVZqbdqh73e7v3e7uze7v7/acZ6uL5656ZZacetacys7e7u7N6sl6hqVZVZZqq8zNu9msVaRZZZdqZZVZiL7v3N7e7v//7vetVqyL5656VZetjOd62by97N6bubdpVZmsu9VZd6vNu9d7VZusysdqVZVZZa2L6s3e7/7/7udoRXx61q56VZqci916l6696K68hqdpiL3e3eeLVqmbd7VZiL7e7e3NVqVqZ7p6uL3N7v7/3etohp16xp56hqybybx62b566bqLhpZq3e7u3eu9VZVZVZVZ297e7u7uvNZqiMWcRa3u7v7/3exp5656xZ56562L5616566KyshqVZmL7e7v3e3eVpVZVZl77N7e7e7e28ysZ6VqRZ7u7v7v3eU25616xZ565656561656h6l6Zahphp3e//3e3eq8Zqdqus3O7N7u297N7eibVZZ67v7u7u3exZ161qxZ1q56561q16lqx62L15VWIkM1zM7u3e7u7u7e7e297e29297e7v3eVZiL7v7u3e3expxZ1qtZxp16xp1q16x6562KqKzNRFIkiJ7/3e3e7e3N7/3N292s683e3u7/Z6mc7/3e3e3epZp6uctqxqtZ1q5656lXQ1d6dpyrRFETqr3eu9qcqceL7e7e2c6L7eu97///ibmc7v3e3e3e', 'base64')),
  ('c059', decode('6Z515j5k6F63/s/s/K/a/r/s/b+163/r/suXghQiMiIhIiIiIiIiIiIhRDqHyX2X+56565+56867525k6F7J/s/s/s/r/r/r/r/Z/Z/Z/rplkhIiIhIiIiIhIhIiIiIhMjeHiX2o+5+5+5+56q6q6G6F6V/r/s/s/s/r/b/b/r/b/r/r/rpTghIhIhIiIiIhIhIiIiIhIhREd265+5+5+5+56G52516F6n/r/s/s/b/r/b/a/a/a/r/r/r3KYyUyMiQyMiMiIhIhIhIhIiZDp1/J/J+5+5+56W6X6G6F64/a/s/s/a/a/a/K/K7K3H7Z7at0dCdTZDVCUyQyZCMiIiIiIhMzqH/J/K+5+6/K5k6F6F6F7J/K/b/r/K/K/K+564y2vF3Gp1hTZCp1dTUyQyQyZCUyMiIhIid2/J/K/K/K2pZl5C5T506F6X64/K/a/K656564qlq0ukqEoydThTuFh2ZCdCdCUyMiUyIiZ425/K/K/K/KmHMz6X5k6F5l1E1U51657J6o6o6omFmEqEwyUhIidTuFUydCdCdTdUZCVCMy2o7J/J/J/J/JVVRE646X6V1WtGx5x45l6G6o6nyFoy1T1lZDIRIiUyljdCdCdCVCVEZUp2yY65/J/J/J/J25QzQz7J506F1XtXurp4151nxD2XdCUyYyMiQzIRIiMiZCYydCZCdCdTp265/J/J/J/J/J/JqHREQz6X50521Wp4uYqJuJx4p4yW2WhSZCUyMyIiIiIiVDdDYzdCZCZV65/J/J/J/J/J/J/JdlNENE1l1T5W1Wl4iJl3mIyXuH636mdCZCQyMiIRIiIiZUdkUyMhIhQz65/K/J/J/J/J642nVEQ0M0xD1T1V1nmJd32EuFl42W632EZDNUIiIiIiIiIiIiIhIRIhMyVUyp/K/J/J/J/JyF10102E6EpDsy1T6Ft0l0yEyEqF2m6mpSZkVlU0IiIiIRIRERIRMhMyMiMyyo+5/J/J/J/J2XljVCVCVC65yGxT1TpUdl2U2Fx06m1jdCZClEZFMjIiIiIiIRVChjZCUyZDp2l2h2qGuXyXt1ljZCVCVC64/J/s7KyGZlhl6WyFyElTdDVEtVdFM0IjIiIiIjZkhjdThTZDIjJGNYNXNWREpjlidSVCZC7J/a/Z/r/b7aynt1x0x0p0dChUpWVFM0MzMjM0M0REhjZTp0ZCMzM0NEI0JFVVtzhihiVCVC636m6n/J/b7byXxk6mx0p0ZCdSdVM0M0QzMzM0M0M0ZTRDl0ljRDNENEIzIzhkpjtitjlTdT7I7I/I63636npktj2EpkhTdCdCdTM0M0tjdDM0M0M0QzMzdUp0VDNENEQzhCpjlidSZCZCdS/b7b7b/s/s2opklTlSdCdCp3dDdCQzVE6lhEVFM0M0M0M0RDt0ZDNENEdDtClClihiZCZCZC/a/Z7cy6y6yalVQzdCZCdCRFUjYyZDh37IdDY0MzM0M0M0ZDp0dDNEhVxCsxhSlilihSZCZT/t+z/a/b7c27tEMjZCZCZCM0M1MjQ0l1/r7Kh2MjM0M0M0yFpkdChDtD1CsxdTlililjhkl2/V/D/F636X66qJU0VEQzQyIjVYqLVYM2iJ7b/cqXQzM0Yz50pkdCZDgykykyVENERDZURUIi/Q/B/C+zy5dEdEJIIlIkIkIjISQ1RHIkIjMzmF3J3amFdBhBdCYyYyZClTpjdDUzUzUzM0ZD', 'base64')),
  ('c060', decode('lmuIpmVFQ1QlQlQlQlQlQkMkQ0Q0QkQkQkQ0d3ZWQ0U0hnQkQkQkQkQ0QkQ0U1QlVF3My7ZVVFhnp3Q1U1QlQlQlQlVGZWQkQkQkQkVFdWuq3MQ0Q0Q0l4U0QkQkQkQkMkQ0ZFQlQ2uZQ0MjQ1qIhmQlU1QlQlQlQ1hnuqdnZWdnuqy7qZy7mIQ0Q0Q0VFy7dnQkQkQkMkQkZWU1QlQ1MjQkhnVGQ1U1Q1U1QkVFhXy73c7t7d3c7c3M3M3MU1Q0Q0Q0Q0y727uqVFQkQkMkdWZGQlQ1Q0MkQ1QkMkQkh4ZXQ0dXqJ7t7t/t/t7t7d7c7tuqQ0Q0qJqZQ0mIy73c7cdnZWdnmIZGQlQlQkMjh4MkQkQkQkQ0U1hnmImI7c7t7t7d7t/t/97tmIu6/tu6Q0qJ3M7d7t7czLdnqZZGQkQkQkMkMjQ1MkMkMkQ0ZGdXU1Q0mI7t7c7t7t7t/t7t/t7d7t3MU1y73c/t/t/97t3MmIdWQkMkMkMkMkMkMkU0Q0Q0dWdXlol4h4yq3L3M3c3c7t7t7t7t7t7th4y77d/t/9/97tyqlodWU0U0MkMkQkMkMkU0QkhWdWdWZWZFdWhny7y77c7t7t7d3c7t3M7tu6uq/t/t7t7d7cqZdWdWdEMkdmMkQkMkMjMjlVhVU1ZFU1U0ZFZGyquZ3M7c3L/t7t/9/t/97t7t7c3My73czLVFZFdWhFU0VFQ0QkMjU0xm52lVZFZGZWU1dWZGl4uq7cyq3M7M7c/9y77c3Muq3cy73cl4ZGU1dXdWxmU0MkMjMjMjY0525252lmdWhnZGuql4qIyq2727lXZFU0pn3My7qZdW7tyrl4ZGhnZGU0hW52ZEMkMjQkQ1Q052tlpVt3hXhXpXxY7c2rya7MtoUkxIxHYk7M/97c/t3M7chnqZqJdWhV12xmMkMkMkU2Q1U1xmY0Qzpnhnhnglglg1hGglg1c1g2pXpXhFlXx5x42KyJyZmIzLuat3525252Y0MkMkQ1Q1ZG12tmY06Hpnp4hFg1glckU2lnc1pGtHtHk2hFlXlGg1pXpGl47cyq2H535252Y0QkQ0Q0Q0dXdH13pV6H6HyZp4c1clckQlVGuqc1g2k2hnqZdnglclglc1y7/t2Z6H6Y6H52hFQkQkQklVtnZHhXtm6H6Y2Ip4p3c1UkMlQ1mJU1UkUkl4h4Q1UkckhWua7c7tyZ6Y666H52tmQkQkQ0xm13tn2HyZ6q6Y2IpouJhmMkMkZXQ1QlZGZGQldXQ1MkdF7M7c7c3LyI6Y666Y6H53lVQ0ZFdFZFtm6I262p6Ix4t5yqt4MkMkQ1VGVGQ0Q0dnQ1Q1MkY17c3M27ya2I2I2I6Y6H6HtmQ0l4U1hW6H6p6Yx32Ipot4yJyIUkMkMkZWZGU1U1ZWVFMkc1y77t2quZuI6Ipnx36I6Y6HdFy7hnZGhWlWlXt3yIx42It4yIyIdWMkMjMjMjMjMkMjiIh4dFyZ27yauJyI6Yt4po6p6I6HlndXY1ZFZGdWhXhXt32I6Z6Z2I2Zp3MjMjQ0MjMjMjZWVFM0hW2ZyJyJyJyZ6Z6Yua662IhXdHZGZGZGln2Y2Ilnt36p/c6Z6p6pp3MjM0dnMjM0Q0MjMjMkt36Z6Z2Z7c2Z6Z6p/t2ZpnhXdWdGZGdGln6Z6Zt4ln6p/c6p6p6quIZWmIdnh3MjMjMjMjMjyIyJ2Z7L7c67/c/t/9uZlXt4dWdG', 'base64')),
  ('c061', decode('vOrNrNnNi9rNm9rNqYdUlUdDqrvOvOvOyZ2X2r28rNrOvOzd3duqu7zdrNrNrNvdrMrMrNrNvOvdzNzdzMm9nNzMllpltltlq8rOvOvNyY2ozd3uverOzduqdEZDZDqZrNrNvNvMrNvNvMzMrNq8y6u7u7nNrNmHplplt1plvNveveveup2Y3Mzdzevey7dEYzpllUdUvMi6vMvNvOvdvNvNvNmJqq3ezdrNnNmqt1x1x1x1y7vNveveu8yY2Xy73uzey7hUdEtldEYzm7rNvNvcq8u5u6vdmZMiMiZmy77uzeu8t2x2pUlUuqvNvevOveyYt3uH7dzeu7yGx2x1lVZErMzdzdh2UyUzZEu8VEUzUzUzMzVEdmmrqZyGx2x1q8vNvNvezeqrqHuH3L7uu82Xt1tlx1ur3e3uuqZDUzUzUymYMzpUpklUdDMjQzd3zNuGlllmvNvNvNzezeuqypuYyp3Ly7uGx2t2qrvdzeqZUzhUlUUzUyiJQzhDlUhUpkZDQzmZ3dypyXt2y73MzMzeze3cy6uYypuYuIt2lUuq3e3u3eqIZDtlx1lUdVmrQzlUtUtUtklUU0zM7u3MuqyYqHqHuHyp3M3d3Lypypl3hmyHyHy77c3dzd2pplhUlUx1u6vNQzhEpUtktkhEU0y7qHh3uquqqIh3p3yp277u3My7yplnlnyZyqqZyquYu7qIx1x1x1l2vdrNQ0QzpktkpkZEVEuqhmVFl3mIl4uZuquYy7d3Znd4iJy83Luqyqh4qHl2qIyYx1x1tlqrvNzNd4QzZEhUhUZElm3MdmVFuHqHhnuZ26uZuriJiJd4VWZW3Ny7yphmdWuHy7uHpVx1l3rNu7y6vNqZhlZElmp3l2upmJdmuHuYqIuZyZ27urh4d4iImZqrqquZqHhmVGqJy7uHlmmarNrNuqx17dyYyYdWdWqIyqypzMy7yqyqy626yp273dmaZnd4maqruqyYuHl3VGiKuHuHp2mavNvNrMx1yXyHqJZFllpkpkpkp13My6yqy6yqy63M7uuriJmaiJury727y6qZh4y7uHuHuGmIzezevMx2yYuqqHhVpkdElUlUhUy7uru7y7y7273d7u3dZXZnqa3L3Ly7y7y7mJ3Lt2qHt2p2vNzdVWVEu8qquHplhlQzZEdEVEmIqrqqy6y7273d3uzNdomJ3Ly6y6y7y7y7ury6p2qHp2hmq8iJQzQzvdmIuHuHp3Q0Q0Q0REmIu7qauYuYyq3d7uy8mKu73M27upupy7y7y8uZp2lmVFMjiJVFQzMzvNZWuIqHqHZWQ0VEVFmZuZuIuHyZy63N3eqru8y73L3Lypupyq3My7uZVFMjMjMzQzQzMzREvNVFqIh3l3hmQ1VFVGqZqIuIyZy727zMurusu8y7y73My6uZuYuZuayqZVMjMjMzQzQzQzQ0vMQ0l4mIqIl3VFRFqrqIp4uIy8y7qaVGM0VGdomJyq27y8y727uYmIuZhmM0MzMzMzMzQ0qqq7Qzl4qJqJp3VFVGy8xnxnuaururQ1M0MkVFM0Q0dny73M3d7dzMu6uZp2RFVEQ0VFQ0iazNmqQ0l4qJqJl3VFVGyrp4qaurururZHZXVGVFQ1Q1M0qq3M3d3du8zL3MqIVFdWmJZViKu8zdmqVEl4l4qIl3VGVGu7doiJmamKmJmJmah5ZodoZXmazM3dzNqaqr3d3dy7ZWZWhml3qru8zN', 'base64')),
  ('c062', decode('ZYpYl5e8e8eKhYd4MzMzMzREZWVEZmVVREREQ0ZVVEVEVVVFZWZZZYZYdXhWpZiMesetlqlJhJpJete+hqhJZJR5IjIjIjZWVWy87e7eury7y7qqqqy7y87dmaZYZXZXQ1VFhJpJl7icicpJpJpZe+ichJhJNJRpMkIjMjdnyc7e/u/u/u/u/u/u/u/u/u/v/vdnZVVEMjM1RJlJpJicitpJpJpJe9ethJZJNJRpVFMjQ0ybyc7e/u/u/u/u/u/u/e/u/u////urMjQ0IjM1NJZJpJiciLpJhJtJh7e+dahJNJRpZFZFZG2c2c7e/u/u/u/u/u/u7e/u/u////3dMkMkMiQ1RJVJpZislqpJpJtJiLetetlJdJVpdWhnyL2c2c7N7e/u/u/u/u/u7N/u/u/////vqadWdWdXRJdJpqiticpZpJl7esl6tJtJZJZ5hnyb2s2s2c6869/u/e/u/u/u7N/e/u/////v7Nyrl4dXRJtJtJpqiticpJiciLtJlJVJRJZohn2c2s2s2c7e/u/u/u/u/u/u/u/u/e/////v7N7Nl5hnNJdJtJtJmLetlZetl7pJRJZqVYZol42cuKloyb7O/u/u/u/u/e/u/u/u/u//7diIua7NqJdXRZVZVJtJp6iclZecmLlJRIurqbVFp5uKdWVFQzmJy77e/u/u/u/u/u/u3MmJQ0dml4ubp5ZWururRIpJmLiLpJhqiclJVIqKybVVVnqJuK2b2bqJhndm3N7e/u/u3NdmdWqa7e3durmJRFd3t6uKVYhZitlqhJlJicpqY4uK28l5IzJFNFI0MkQ1VFdXubyb7N6suKdWQ0RFM0RENEZoEimJ29t6RYd7itpJdJlJetpZZIp62cp5VVSJfOV7M0dlZVZ4mZl4uLhoREqaeaWKQ0dldmmadnqJ2suLVJl7i9pZlJlqicpJVJdpx7t6hoR4acurMidldlNIVYESI0Eid53Nm9mJQzdldlRGu7p5x6h5lJpZe9l7pJh7ictIZJRIyruKuKRWVpqaMyIiM2RZV5dn3Nh4Z5rNiLiIIRMiNGRn7dybubVZhJpJe9iLpJh7ittatJZImK2sybRFiJ28y7aKRJacZn2c/e7eVWeLqay7uqaLWLiZ7uybmKVJlJlZa+h7pJlqiti9tqxIpI7dy9h4iImZeaRZWLaKqK2c/e7emJd5uqqaibeLeaqq7u7ehppJlqita+paZJpJhqitfOitw4ZZiKybZWVVRVZ3Z3d42c2c/e7e7ed4Z3Z3VVVViI7uu8h6pJice+e9icpJNJZJpJlZe+i+xJZJVZus2b2s7e3N7e2s2s2c/e/e/u7e7e3N/u7d////aLRJtJite+l7pJdJNJNJdJlqe+mcxIdJNIus2b2b7N/u7e2s2s2s/u7e/u/u/u/u/u/u//7uVqRJlJl6fOmLtJRJNJRJlJiLe+ebtItJZJiK2b2b2c692s2c2c2s/O7N7e/e/u/u/u/u//zeRZlJpJl7fOmMpJRJRJRJZJlZetiticlqpJZpyb2b2b2b2s2bt5p52sybyb/e/u/u/e7e/vibdJlqice+e+pZhJNJRJRJZJlqeticmcl7tJRIqb2b2b2c2byKyLyb2c2s7N7d7e/u/u/u3dRZdJl7ice9e+l7hJNJZZpJpJeLitxJw4tIlJM2VWyc2b2cybuKuKyb7dy8y8ur3N/u/u//d4RqZJpJpJlqe+itlqlZ', 'base64')),
  ('c063', decode('U3U3U3U3U3U2ZHur3My8y8y83M7d//////////7t7t///////////u28y8y8y8y8283N28/uU3ZHU2U2hoqYqIua7d7t7d7d/u////7dy6qGhldTmGyp7u//////7dy8y8y8y87e////3c//U2ZXh4qa7u3LuI7u////////////qYUyMiMiMhIhIhUyl2//////28y8y8y8y87u////3c//lZ3N//////27yZ////////////uqIhERIRIRIRIhIhIhQiuo//7dy8y8y8y8y87u////3N//lp7d//////yqyp//////////3cQzERERERMiERIhIhIhMimG//7e7u7d28y83N//////3N//lp////////uZyq///u//////uqIRIRMidUyGp1hkMiVDQyu6///////////u////////zN7ep5////////yZ26/+7d//////qpIhUyZDp1uGhkp1t1uFqG7u//////////////////zNu9u9lp////////uZ277u3c//////3cUzZDhUp1qG27upp1l2y57u////////////////zNu9u9u9ZH////////uI3L/+7u////////l2hUhU2WyX7u7tyF3L7u7t/////////+//////zNy9zN7umJ//7t//7uuI3M//7uyqy6/u7t7Kt1p12n2nyWyW2GyW26/+////7u////7u7u//y93e3N//////////7tuI7c/+y7qIqJ3M7u7bp1lkuG6n2nuGdTyW7c7uy6//7d////7uu8zNu97d3d//7e7u////7dl3y6y7l3l4qIqZ/u//3KlkIRhkuGdTt1yX3c3MqZ///u///u7uy7zN3N7u7d//ys7e////y7uq3My8ual4l4mJ7d//upyFMiERIRQyZDuX3cuqmI/+/u////////////7u7d//ys7e//7dqa3N3N3N7dual4qImZhohl2Wt1QyERVCuG257tqImJzL/u////////////7u7d//us3d7uy73Ny83dzNu9qrl4qIh4hn2n2WyFyFhkt1yG2n7aZVh4VV3M/u/u///+////7u7u//us3Ny73M3N3My9qsmKl5qIqIiJdXqI2WyWt1yFt1yFyG64h2dnh37d3N7c/+7d////7d7u//y9y8mIqJqZqamKmJqJqIqIl4iJmJdXqIuYyFyFt1yGyF6n24VEh5y83M3M7u7u////7d7u//7dl4ua28ush4dnqIp3uHyXuHmIqrdnl4qIl4qHl1uG2W2n7JqHqJmKus3M3M/u////7d7u//ur28y7l4mKl5dmll2n647I642n2n2ndXqJqIqJl5mKqHyFyWqZyqqImJusy7/u///+7d/u//l4uaqadndndmp264642n6n2n2n64yXmZZXqIqJh4h6doVFl4may7uquImJqa7M///+3M/u7uzMu8y8ururZU6n2nyG2n2n2np2uXuGmZqqZXl4h4l5ZXiJh4mJqruauqqIh4ur3c/+7d//7t7d7dy8ua3MVEyWyGdUUyp1hluYy7y6qaqru7dodomJmaiZeJh4mKusy8y7y6hnuq7c7d//7uy7ururmJu8h5Q0MzIiIRMiMk27y7zLuqmay7qql5y7mJiZiaVFl4mKur283duqqaZGhn3M/uususqbmKh5dnVEQzIRIRIRMky7y73L3cqauqdohpuKdomamaZXZVmJqbu83duqyrhXZHqJ7d', 'base64')),
  ('c064', decode('IjIjIjITITITMkRWZ5eaeri8i8jNi8jNjNjNi8i8i8i8i8esere8esV4M0VmNENVNWNVRVNVITITITITIjRGaJeKeaeri8i8i8nNjNjNjNjNjNjNi9i8i8iserebe7eaRXRFVmNERmV3WINVISISITIjVnZ5aIaZeaisi8i8i8nNjNjNjNjNjNjNi8i8i8isebd5eJZ4Z5M0eINEV3aZV3RmISITITM1Z5V4aIeJeKeri8i8i9isjNi9i9i9i9i9i8i8i8ebeKeJaZVnZ4RFd4RFNVR3RVNVITIjMkRFZoV4V3eJeKeaisi8i9i9m8i9i9i9i8i8i8i8iseaeKd5aJZoZ4RFM0Z3NFNVNVNVIjMkMkQ1VXZ5aJeJeKeKesisi8i9i8i8i8i8isi8i8i8iread5Z5ZoZ4eZRWM0d4VWNFRVRFM0Q1Q1Q1RGZoZ5Z5eKeKi8eLebisi8i8isisi8i8isirebeJd5Z5ZnZoaIVGQ1VWeINERFNFVXVXVXVGRGVXZYeKZoZ5eKZ5d6eKeaeberirisisibeKZpZ5ZoaJaJVXZ4VXQ1MkRVRVM0RnZXZ5VGZXVGVXZoeaZpZoZoZpZpZoZoZ5eKeKeKeKZ5ZpZYVXZXZnZ5VYVWVGRFVGMjVWNFRVZ5eKVWZXVYVFZXVWZ5ZXZXZXZXVGVGVGZoZ5ZoZXVXVGZXVXVGVGZoVXRGRWRWRGRFVWRFI0ZoZoZoZXVXVGRFVXVnVGMkMkM0Q1VXZXVXVGVGVXZXVGMkIjIjIjQ1Q1Q1VHRXVXMkM0NEIzVHZoZoVGRGVXVGQ1VFMkQ1QkMkMjIjMkVXZoZoM0IjMjMjQkQkQ1Q1Q1ZGZYVXVnQ0MjM0M0ZXZXZXVGRWVXZGZGU1U1U2U1hWY1MTISIjU1Q0ISISdFhWU0QkU0dWZGdXdpdYVGVGQ1M0M0ZHZXZXVGVGdXdWhWY1hWZFU0dFdVQkISMjhWQjISMjZFlndGdFlnhXZFdXd5doZGU1ZXMjIjZHVGdYVGZXdXZGdWdGhWhXdGhWdFQjMjQkpnY1QkU1dGhWlWpnlXdFZFd5d5eJVFQ0ZXVFISZGVGZGRFd5ZGhXhWpnt3t3pnpnpnlWpmlWt3pnpnlWhWtntnt3tnpnhWdGhoZXZGU1Q1ZGMjU2ZGQ1Q0d5ZGhYhWpnt3t3pnlWU0pmtntnx4t3pnlWU0dFtnt3pnlWhWdHdodXZXVGZGU1MkM0Q1IjMjVWU1hXdGhGlWlWhFU0UkU0dFpmpnpmZFY0UkU0dFlWhWhGhYhpdHZGZGZGZGQkMjIjIjITITMkQkdGZFhGY1U0QkMjISESESMjQzMjITITISISMjQkdFhWhodXZGQ1ZGU1U0IjISESIjISISIjMkU1U1ZFMjIjMjMjMjU1U1ZFdWdGdGZGU0MjISISMjhWlXQ1Y2MkU1QkIjITESESIjISISIjIjIjQkU1IjIjMjVFh3upmIy6h3qZu6qZmImIQ0ISISZFhWIjMkIjIjIjITITESESITIjESISITIjIjMjIjITMjZWyp7czK/tzL7t7tzKqZqYQ0ISIjMjQkIjIjIjITITITISISESISIjESESISIjIjIjIjIjdkqny3unmGunmGmHmIh3h3dWQ0ISITISITITITITESESITISISESISESESESISIjISITITMjmFy3qWuny3qWqGu5zKuph4hoU1ESISQ1M1MkISISESESISESIS', 'base64')),
  ('c065', decode('tjlShCVDIiZDQiQyqqiJVDUyUyQiUzZmd4iIZmVEhDYyhCEQERVVREZVMhMhMhQhhClD0X04x0lSUyQiQiMhMhiIVWREIRMhIRIRpkhDQhZDQyQidDpTcyAAERIiIiVFQhQhUihlhTpTwG4olTlSlScyUiMhZVVVREIiQiUzQiMhx1lDVD3MZmQ0ll11hTAAERIiMzVVQzUyUyZDdTlSsV4olkpSpSZCQyQiVVRFMiERIhmIMjQz2GtklUZDdDhDx16WlTAAERERIiVEUzYzUzcydUpTsW0odChChCUyMhQhZEVVMiERQidDYyUy2Gtktltmpltl1111hDAAERERIiZVQzhkZDVDZDo15Z0XlTlShCZDVUIRdlMzQzERlUplpkhTx1tkpkx2t2x111x0YyAAERERIiZVQzl1VCZCYzoVsmlWlTlShCVDRUIhZVVFIiMilTtkpkx12GtkhD1111x1x1lTEQAAERERQzMiMiMiQyMiMiQyhCdUhTdCQyMhIhYz1HxHckMiQihDhTpUYyQilT1111tUhTMhAAQSYkMiUjYjg1QiQhMhYycycydSlShDczczk1tHx6yKuKuKuaZDhTERAAEAQiUyMhYyQxERcU0X0owW0o0Xo2dEYyMhYycyYyUyxG1H5H0ntY69/N7Nyb28uaMiIhUydDYzYzUyUyUyQxYzwWwnUj4oollVuK6s2suauIlVdDcy5I0X0XxI7N/N2b2bybyr2sIiUiYzYzczYzYzYyEQdSlktVlTsW04olp3yb7N7N7N2b7N69l4wXklhG692868wn2rybyb69QzYzpVhVhVVEVEREQjxmqjqSt0wXw3lF2syr7O7ex6047N7e7NkkYz2s7N2ruK2s68ybyb69VFIiREMzQjcUoWoWwXxlmTuTkUgzhEp32s6928yK0nxZ/e/e/ewns3xIwn04w36928uKp3qHhUMzmJpX0XoVUyUzZi3EdiklgUZUpEx5yrybuaxZw369/N/O/e0X4Y4544w3yb/Nybt1x1x0dDdGqKlHQjMjYUwGsldiMiglgUVFdVloyrqJyr28yb2b2r/N7esnsGsGsnt52ryrx2x1tkUyYUtIqJ28d3clkVolqEklomsm0XYkh4mIuauKybyb68162b/e7e2suKyb2s2syrt26Wx1UyMzomo329hXpI0nsWUisWsWsG0o0XckZWdmybp52868xIwn28/e7eya2suaybybp32FxkdUZVREwWoVZVysy8w40Y0o440n0n5J0XQjZViIqJqJ2L045Jw3/N/N/N11t2ybuJt1x1tklTdUZDREsm0Hp5pYhn0H0H0X0X4o0o0nglERdWiIom04440HwX2b/N/N7N2F11lUyFyFx12G6G6Gx1ZDVEomt5o3U0sW0X0X0X0HsWY0IiERhniIpo0n0XxY2spouayr7N2F11pT10101110101010pTMiREdWlGhWlXdGY0QzMjIiIiERERl4h4uKybqJuKyb697N/N/N2F11pTtTtTpTpTpTpTpTdCQyIhIiIiIiIiIiIiMzMzMzIiERERl4l4qJua28697N/N/N/N7N2Fx1lTtktkpTlTlThDhDtkZEMiMzMzMzMzZjMzMzMzMzIiERERl4hnyrybybybybybua2s6911x0lTx12F2F2G2Gx1lTx0dEU0MzMzMzMydyMyMzMzMzIiERERhoZWyb68697N2syr287N7N', 'base64')),
  ('c066', decode('UzYzYzYzc0dEY0czgzlExE1E5E1E1E5E5F5F5F5ExElElEQiIihEhVhFdFhVhVhVhVhVdEdEYzYzczczYzYzlElEpE1F5V5E5Eoz5E5E5F5F5F5E1EpEhEQiYzhVhVhVhVhVhVhVhVhVhVhEc0hEhEc0hElEpElEtE5F5E5Egzs05E5E5F5F5F5E5EtEczIidEhVhVhVhVhVhVhVhFhEhEhEhEhEhEgzYzYzUzczxE5E5FczYztE5F5E5FxE1F5E5Fo0YzIidEhEhFhVhVhVlFhEdEUzYzhElVlFlElElEhEUzMjpE5FtEYz5F5F5F5F5Fgz5F5F5FUiISERlEg0lElElElElEhEhEczczczlElElElElElElEYzMipEUzxE5F5E5F5F1Ecz5F5E1FUiMiIihEYzlElEhEhEhEgzc0YzQjUzlElElElElElElEc0UzIjUz5F5F5F5F5FpEkz1Es0gzIiEiMiczYzhEhEhEhEhEdEYzUzQzQilElElElElElElElElEtEpE5F5F5F5F5FYzczgzYjIiIiEiQiUzUzhEhEhEhEczYzYzYzYzQiUzczhEYzhElElElElEtE5E5E5E5E5E1EUik0QiEiIzIzEiIiIiMidEhEhEczYzYzYzYzYzUzYzdEUzYzhElEhEhEhElExExEtEpElEUiESYzIiIzIiEREREiIiQihEhEczczc0c0YzUzYzUzQzMiIjMjhEhEhEhEhElElElEhEhEdEIiESQiIiIiMiEiEiEiEiQidEdEdEdEdEYzYzYzUzYzYzERRWM0UzhEhEhEhEhEZEhEhEhEVEMzIiIiIjIzIiIzIjEiEiQiZEdEdEdEdEdEdEZEZEdEI0EiRXI0MihEhEhEhEdEYzhEhFZVREMzEiMzI0JEIzI0IiIjEiERU0UzdEdEdEdEdEZEdEdERnESEiESIRdEhEdEdEUzdEdVZVRFMzIiIzNFIzJEIzIzIiIiIiIiIiQzZEUzdEdEdEU0dEdENFNFIjERQzdEdEdEdEQzZEZVREIjJENEJEIzIjIzNEIiIiIiMzMzIiIiVVU0dEZEZEVEZVZFIjI0EiAAISZEZEZVZVMzZVVVRVIiIzIjIzIzMjMzIjIiIjIjIiMzMzIiIiMzZVZVZEVEZFZFNGEiIjERMiZEZEZVRFIiZmRVMzIzIzIzIjMzMzIjMzIiMzMzIjIiVVIiIiREZmVEQ0VFZVZVNFESERQzZVZVZVZVIzNEZ3NEJEIzIzNENEMzNENEMzIiIiMjMzIjMzIiREMzVVVVRENEZVZVNFESERIiZVZmVmIzJEIzVmNEI0I0M0RmRVMzRVRVNEIzMzIiIiIiIiIiMzMzMzRENEM0ZWVmIjIjERERVVVnRVNFI0RVRVRmNFIzNmRnRnRmRFRmNVNENEIzMzMzIzIzIiIjMzMzMzNEVmVmESERERERRmVmNENFI0RVRWR3NENVRnJER3R3M0R3NVIzIzM0I0M0IzIzIzIzIzIjIzIzVmVWERESERM0VnRWNEI0IzNERmRWRmV3R3NER3SINESIR3I0IzIzIzNEIzIzIzIiIjIzIzIzVmVmIjERERRVVnRVNENENEM0RWNERVR3NmIzNENENENENVI0NmNWIzI0IjIjIzIzIzIzIzRFVmVWERERERRmRmNFRVRWRVNERVNENFNENVNEI0IzIzIzIzIzIzIzIzIzIjIzIzIzNERWRVVmVnVn', 'base64')),
  ('c067', decode('q7qqmamaqaqamad3VVd3RVIiNDNCIymJVVZ2VmNEVDVUiIqqmqmamamamamamZmamZmZmZmZmaqqqqqqqqqaZWMyMyIyMzdmd2IzRDdlZDV2VVMyZTVDZVu7u7d4d4d4h4mamaqqmZqqu6mZqqqrq7qah4d3MzMyIhIhVEy5u4VVUzUzZDZUZlQzVDQyQyRDd2ZDUzRDZmqaqZqZmZmZqZqZuqu7qrd3MyMyMyIhIhIyZV3Jy5dmMiQyUzZDYzQzMhQyQyMyQyUyQzZmqZuquauqqZqZqZqZuqzLzMqZQyMyMyIhIhMzVVmYqoZlIiMiMyQyQyMiMhQyMyIhMyMyMyd3zMuququqqZqZqZqZzMzM/uzLMzMyMiIhIhIzM0mYmIREIiIiMiQyMyIhMiMiIhMhMhMiMhRUvLzMuququpuqqpqp7t3M7durZWMyMiIhIhIzIzd3qXiGIiIiIiMiMyMzMyMyIiIhIhMhMyIyRUq6zMu6uquququq3dzM3M3Lh4MyIiMzIyIzNEVVmXy4MzIiMiMyIiIiMyMydlIiIhMyIhMzd2VUmpzMy6u6u6uq3c3dy8urmZM0IiIiIiNENEdmd2u4NDIiIyIiIiIiIiMzMiIhIhIhIiZmuqy6iHmpy6u6y6y6y8zM3d3ch3IzIiIiRDIiI0RVVVmHd2RUd2VlMzEiIiIiIhIiIhIhIhREmIy6y6qpu6y6u5uquru7y83LREIiIiIiIiEiIzIiREd2mHNEZldlVVNDIiIiIiIiIiIhMzIyh3upy6y6y6y6y5y63cy7u7iIM0IiEiEiEiEiIzIzNEZmmIREZVZlqXyoqHdlMzIiMzZVVVVVuZ26y6uqur3cy6263L3My7qpNEIiEiEhEiEiIzZlRUiGzKZmZEh2uYyoyouXmHZVqIu7mZeIqZuqqqmaurzM7t3LzLzLu6ZmIyIhIyEhEhEiIzZmREmGy4y4d2y53Juoh2h2ZVl4qIVVd3MzRViJqquqmau73c3LzLy7ZmIhIhIhNDIhEhEiIiVVMzVUd1h1upiGqWh2ZVVVVVhmZVVUZmZmIyVVmJuqqqqqu7y7zLzLqZIhIhIhIhIhEhEhIzM0MzIzNEqouomHZVZUMzREZVdmRERDVVVlMzRUVmu6y6u7qqu73b3LzLd2IhIhIhNDRDIhEhNEREVVZldlZlZlZldlREIzZVZmZVNDRFRVRERUNDmYy6y6u7u77c7c7bqoIyIhIhIhEhEhEhIiREZlVVREMzRUVUVUVUIyZVZmZlNDMzREZmZlIyVV7t3LzKy73b7c7cupIyIyIhIhEhEhEhIiMzVURDIiIyEzMyRDNDIidmZmVVZmVVd2iHZlNDNDu67c3Ly77c7t7cy5RDIyIiIhIhEhEhIhMzRDIyRUNEIzNDNDMzIyVVRVRUIyNDd2VVZ2VUNDiH7b7c3L7s7t7c7bdlREh2MzIhIiIhMyIiREd2d3VlVVRUd2VlNDVVNUNEIzIyVVREZ2VlIyVl7c7c3L7s7t7c7c3Ky57bZVIhIhIyNEZlZmZ2RERTZlNDNDRVNDRENUNDMyRVRVNDIyNDIyND7c7c7c7c7c7c7c7c7b7LZVIiMyRURVRVNDNEMzqoy4d2IyIzIyIyRUJDNDRVVlNDJDJDIyIy3L7c7M7s7s7c7c7c7c7by5mHqX3KRDNDVUIyVUu43JqXRDNDNEEiNEJDNERUJDIyIyIzIiJCy67c7c', 'base64')),
  ('c068', decode('CMGdWsStS+aIMzMhRBdidjdydidiZSMzREZnVVnOe+jOiZZUZSZTZTQyIharS+W+ebMzZVdpGMCMStOtW9MiIiMhQxdidjdzdihzdjVWeJmamrrezuvN3NzMiHdkZhVCMhesbOnOqrMiVEdpRpOtS+W+abERIiRCMxdjdjdjdidid2qq3Nqqvf3u7e/u/e7e3NmHZTQyMhjNfOjOmrQyVDZFVVasfOe+RnERIhZSRCdjdjhjhkdkqq/ey7u87e/dy8qcqczN7d7du7VTMifOfOjOmrVEZVdWZVVVjOjONEERIhVCVChjhkZEVEdVy7yrqJyq7NubuLqLd6mbmYhlh2h2MzbObOfOmaZDdSljZXZXZ4e8ESERIRQyZUZEZWZFZFZEuZqJt4yqt4yKyr283Ny8uqh2ZTVDVnW+bObOmrhSljlkZYVGVFZnESESIRVDUzQzVGZXZYZWZVuIlnyrt3287d7c7M7d7d3My7mJm9W+W+W+iadjlkp1ZXZXVFZXMjESMiVEVFVWVFQzZVZWZElmhlyZuJuZmI7M7L3L7M7d7d3NzNvefOS+iIhkhjp1doVWVGVGVGESQ0REVEVEZVZXdnhXdVdVuIhlhnREdmmIlll3287M7M7Mh5bOjObOd2l1ZSl1qIqHmIl5VGISQ0QyREZmZoZZdphphodXqadWVEdmdmZmdmZChl287N7N3NrenObOh3hkZUdTuYuFyW2oyqh2l2ZlqXyoyquqhWl6mLhph5IiIjdnVVZVVVZCdSmH287N3N3Nzeneiahkl2ZCp2lkuF2X2ouEliVBpzuUuEqDdDp4ubqKdWhnZWM0RFVVREdUhSdShkl3uqyr3N3erNd2dkdSdCt0hiuD2mp0ZCQxZBhhhih1domK297ddnMjVEdmdnM0d3mZiJdodohWqrreremah1qWqFhjhTpzp0uEqEp0UxMiVEZWh5ZoiKdoU0ubZWQ0UzQyMzNEVVmIy6d5dpYjZGzvmZh1uWuXl0hjhTpkt0yFuGljZTVDdodpZYqbh5IiIihXdWqJdlhUMiREZVdVZmh5h5c0ZXvMhkuoyouWqEdTdTt0yF2W2mqGQyVCZWdoVXmJIiQyqElmdmZEIiZEYzREh4MiIimJmJh5dpmHqGuWuFuVhkUypzpkyF2W2ouYMiQyUzMzMzQzUzpyuEg0cjQiMiMiUyREh3tGYzREh5iKiHqFqEqFqEhjVCQydSdSt0yW2X2pMiMhQyISMipWdSpig0cjgzMiYzMSIRMzdWlF1XQyZGhluV2m2nuVyWmEZSQxdRVBZCp02W2oMzMiIiIRc0pWdSgzYSci2Yx16HtUczQ0dXhEtXk1Q0ZFyWynynymuEhiZRMhQxIhIhhSt0uVdmM0IRUitXdDUxURcytTyGx1tklDkiU0dWpmlFxXZFQ0uFymynymqUhiVCQzMiQzQ0QxdSlzyVynhmZD1YdDYiQiUhtjyE2F2GtkozcyU0lmhWpWpWQ0hjuEymuVlzZRVChUloqKqKQyVBIhdCyUuGhF1YdFUSQzdCx0t0pTkzgzgihDZCt1hndExXdGdThjl0djZSVBRClllpp6qKhnIhIRMhhVt3to1opXQRQiUipThCcixExDszgzZDl0dndUpXxYpldSdShTlkVCIhplhol5l5loh4hnUzlFlWxn1phFQRYjQhdCMSozcypDISxzQihUZWZUhVtXtXhUdSpllVUzIhtm', 'base64')),
  ('c069', decode('pUpVpUlVlVlElVplllgzszpDpVkzszxD1UlElElE1E5k5l5k515l5151511llElU1U5E5EpEtUtUpUlVlVlVpVplllkzwztUxV1UxEoztElFlE1E5U5U5k5U5k5k5k5151pUhE1l5l5U1EpEtUpUpUpUpVpVlEpVt1pVtUtUxUxUpEtElEpExE5E5U1U5U5U5U5U5U51xkhEtl5l5U5ExUlUxUtUtUpUpVpVozpVtltltVtUpVlFhFlFlElF1E5E5E1D1U5k5k5l5k5U1DhExU5k5D5ExUplxEpUlElDszxDwytUtVtlpVtVtVhFhFhEk0lFxExE1E1D0z5E5U5U1U5D1DhEtE5D5D1EpUpVtUhEczYzoy0y0ysztUtlplpllVlFkzkzg0lEtEtExUxDwy1D5UxDxDxDozhEhE5D1DtEpUpVlEdEZDYzYzwi0isztDtUtlpllElEozkzgzg0gztE1UxEwixD5U0zszszszlDhE1DxEtEpUpUc0dEZEYzkzwiwitEtEtUtVpVlEk0czYzYzcjczsz1D0z0y0y1T0z0zszozpEtE1ExExEtEtEYzc0Y0czkzkiwz1E1ExUtUpEhEYzYzYzYzYjYjcj4z4z4z4y0y4z1D1E1U1U1U1E1E5UxU5EYzYzczczczkz5U5U5U1ExUlEYzYzYzYjYjYjUjYjwz0z0y0z0z0y1D1U1U1E1E1E5U5k1l5Uczczczgzoz5U5l5k5U1UxDczYzY0Y0c0YjYjYjYjcjwywzxDwz0z0ywywzxDxD5U5k5lxk1UtUpElEpE1E5U5U5U1UtEczczY0ZDczc0YjYiUjUjYjsykzgzkztD5E5U1UxU1U1E5U5U1UxUpUlEtEtE1U5U5U5UpEYzYzczczczZEYzYjYiYiUjUjoikzgzhExU1U1UxEtUxUxUxUxDxUxDpUpEpUpExE5k5UxEYzYzYzczczZEY0YzYjYjYiUjUjcjoyczhE5U1UxUszlEtltUtVxEwywiwylUpUtUxU5U1UczUzYzYzU0VEY0YzYjUjYjYjYjUjUjgjczlE5U1UxUszlEtltltlxU0y0y0ytEtUxU1UtUhEUzUzUzQ0REY0cjYjYjUzUjYjYjYjUjYjhDtE5U1UxUszlExUtVtUxE0y0ywypDxU5U1ExEczUzUzU0YlY1YjYjYjYjUzUzcjYjgjYjczhE1U5U1UtVkzlE1U1UtUxDwzkzczkztD1EtUpUYzUzU0U1Y1UzUiYjYjUzUzUjUjYzcjcjczlE5U5ExUtVpEtE5U5U5UszlEdEtD1E1ExEtUpUUzUzY1Y1U0QjUjYjYjUzUjUzUzYzcjcjczxU5k5ExUtVxUxU5U5U5kozlEdE5E5U5ExEpUlUUzQ0Y1U0UjUjYjYjYjUjU0UzUjYjcjYzcz5k5k5UtUpVxUxU1U5U5UlDlEhE5U5UxEtUtUpUQzYlU0YjUiUiUjYjUjQzQzQzUjYjYzYztU5U5k1UxUtU1UxU5U5D5DkzhEhE5U5UxUxExEtUUzU1UzUiUiUiUzUjUzQ0U0QzYjYjYzhE5l1T5k5U1UtU1E5E5E5D5Eozc0c05U5U1U1E1DtEc0U0UzUiUjUzUzUzQ0REU0Ujcjczcz1U5l1D1E1UxDtU1E5E5E5D5D1Dg0cz1U1k5U5U5DtEg0UzUjUjUzUzUjQ0NEREQzYjczczxU5U5k1D0y0zwz5D5E5E5D5D5D5E1UpU', 'base64')),
  ('c070', decode('dFlXhFtodVt5uJqIuJuJyKuK286968696s6s6s6s6sp4ZVmHdlZUyUyjqGyX2Z6r6r6r7M6blWhWlXlXhmyZyqyp2quZyqyqyZ2r2r6s6c6b2blnp4yndkh2VUx5pHuJ6s6b6b6r687M676rtopnpnlmuK2ayZyqyZyquZ272ryaya2a6byKdmMhZTl0ZmREZVlnhmRDln2K1668686767+7qIqItodV2ayZuZuZyquZuJya2ax62syJpnuGZUUyt5MzVUVEVEQzRERDZU286b6K677M7M/MuYhnpXl3yayquZyZuZuZuZyax5ybyruJ5656UyQyVEIiVEMiMiMiIiVCVTzMuKlnyJ/M/M2qdFU0U0lG25263K26262626yZyZuIuJt55656MjIiIiIiQzVERDQjRDZTZjh2qJlnt42b2a6qglY1U0ZFx43K262q262q2q2p2ZuHuap4161qMzMzIhY1MyQzVDZUdlZTdkdUy8qJqI277b7LdFhGdGl4uIyZyq2q2ayKyKyK1616p42rtodFMzMyhWpoVDZEdkdldVya6syK2aqI3K/s3LyqdF2b2bhnhnuJp4p4yax6x5162K16touKlnMzMzREZlh3h1hkdkh0dlqIuJy5uomH3Ly6y63MZDckg2UzMjhml4qJp4yr3dt56Lx5p4pop4ZldmdmdmdldlZVdkdkZUd2qI/r/riGy63L3L7cVDY1xI1ZxIpXhWhWp4yq/tu6qIzJ3Jyp2riHh2hmdmdlZVdld0dkh0ZUuZ7a/rmHdll3l3lmMig11ZpHlGtXdUg1lGh3y73L7a3a2p2Z2rqIh2h2h3d2dldldlh0h0VDdVh2mHdlun3Jup6qMjMig1xIhVlmpmlmpX2J7u3K7a3J25ypyZyqh2h2h2h2h2d1h1dkdkVEln2b6s7MyphmdVZVQzQzMzUzpGpmuX256q2626263J2p2Zyq2ryquXqGh2h2d1d1h1dkdmhnZll3VEdWyZ67uIqYQzVDVDQyglpn7b/r7L6a272q3L3Lyp2qqIuIl3qGl1dmd2d1d1dlZFdmiHdmVUVUVUZVhmdVQzMyMiUjclln7b/r/b677M7L27y625y5qHuZl2qGmFhld2d2dldlRDdmd2hmZVhWQzVUMiZUUzUjcVUUYkYkuY7b66677M272auZypyp25uXqWqGqGhmh1dldlZlVUVUVEh2ZkRDVEVUMyMSUkYUYkUkQjQjQjc1hFyapnlnp4qHqYuZyoyoqHqHl2qFmFdldlVEZlZlZUZUh1ZUQzQzRDMRclg2UkUkY0MiMyU0U0UjMSMSMjMiVEl2qHqHl3hmh2qFl1ZVZVVEZlZUdkh2iGdkREREREMSYkc1hGtp2bdWdWZEUkQTQTQSQSMSIiMiMjMzMzQzl0mFdlZVZVVEVUZVZVhkh0VUQzRDVDUStolXhGY1U0yZp4p3t3png1hXp4hnQzMiMiIREBMhdSZCMiQzVEVEQzdlVEVEVEVEQzVUQjYT6cyKclMjMSMiMyZUl2dldklGuJuJuJdWVEZEhmh2ZUVUVEQzMjMiIRIiVUZUU0QzZVVEYTUj6s2ryryadmMyMiRDqGZUMyZUZEUjUkY0dFdVhmhmh2h2h2h2h2h2dlMiAAMyMzRDMiUTUTMj68697M27uYMyQydkVDVDVDMiUjdUYTYTUTUTUTQjU0ZEdmh2h2h2h2h2VEIREAIBMSMSMSMS', 'base64')),
  ('c071', decode('qbubysusususysusysus2s6r2rys6r6r2r6r672s2suLp5UzdEdEMiYjQjc3lYppqLqsqsqsqbybybysusys2s2r2rysys2r6r2r2s6r6r2r68682sp5QjdEplhVUzUzYzhoqLususututqsqbububyrysy8y82sysysysys2sys2s2r2r6r2r28uKhEYzYzlElVhVYzZEqbu8utysy8y8usqbucucyb2r2s282828ysys2s2s2sys2r2r2r2r6rybhEdEZEdEQiUzdEp4y9y8ysusys2828ububucucyb2r2s2828ubqK2b6r6r6s2s2r2b2b2r68p4UzUzdEZEmIVEdF286728ysusys28ybububububyb2r6r2sQ0IjVWyb2r6r686s6r6b6b6rp4UzQzdEZEuIu7hn686727ysysusysybybybybybybyb2bybIjESIjM1ZXhouK2b6b6b6b2rdEY0MiQzQzZDYzqa28282828y8ysysubybybyb2b2b2b2b2bIjESESISM0VXVWVGhot5tplXYzYzMjMiQzQzQzya28y8y8y8y828ysubybybybyb2r2r2b2bQ0ESESESESM0ZoVYRWRWRFhHc0YjYzMiMiMzQzl428y8y8y82828y8ubybybybyLp4p4lnhWZEMiESESISMkM0ZpVpVoVYRXhHYjYzUjMSMiIiQ0uby9y8y828y8y8ybybybybZEQiZDZDZDZDZDUzIjVHVHVGM0VXRWRXRYVXpYYzhEUjQjISISt5ycysycybybx6ubuJlmdVUiMhQihkdTZDZDUzUzVHdYdYVGM0RFRFRFRGVGpXlUlVhEhUYzgmpYhHdHdHZGQ1ybdVQiZEZDl2lVZDUyUyUyQiQjUzh4urqadoM0NFM0NFM0VGpnllhEhElVg1lYM0dXloVXVXqJMiMRdDyY7a25YzUiQiMiQiMidoqbu8zMzNqaQ1M0M0M0MjRFhXpXhVpntoZGRFpZxqhYRFhWMRQip22p7Khll3UiQiZEU0Qkdnmaqrqru8y8urVGM0M0MzMjM0M0hHlHQ0M0Y2k3k3k3Q0ZFMiQip225qGl3qqUzUihFlndod4mKmaqbury83N3NurmJVWMjMjQ0U0dElVhlZGgmonkmQ0l4ZEQil3lV2oy6yppmY0t3uadod5iKmKmaqru8y8zN3d7e3eurlWhVhVlVlVlVdVhXU1Q0ZVyauJUzybuZyX65252Yp3t52bl6doh5mKmamaqburu8zN3N3d16hHdFhUhUhVhUhEdWl5hmhV2828yayayo2p2525yYuJ6b2bqKdoh5h5h5iJmKqrqru8y8ybpZM1RGQzUjUiUiczM0RGhoho2s2r2r2r2ayZ26yYlFuZ2b2bp6h5dodYQ1ZniKmamKmaurxqUlNGNGM0M0MjMSQiMjNFRGVWuK2r682s2q253KlWpmyqyr2byKpZhIIjESM0h5h5h5iKppk3IjM1NGM1M0M1IjISIjM0M1RGRGU1dGhG2Y2525yZyZ3MpZdHY2U2M0ESESIjdododoh5ooUlIjMzM1M1M0M0MjISISIjMjM0RHRGRGQ1lWyH253L7dyKpppZZYVGVGQ1ESM0doZnZohYo4ITISIjMzM0M0MjM1IjISITIjIjM0ZmZWM1Y1tm2o26ybk3pYlIZGRFmJmJMjVGd5doZng4gnESISISIjMzM0M0M0IjESIjISIj', 'base64')),
  ('c072', decode('NYNYR4N4SIanWaStSujfzv7/3/rNaLZ6Z6Z6Z6V6Z7Z7d5qGl2ZFZGRrNJMmM4NIMmMlMlMlN6N6SIWJSKaZzu3vS+jfvvzv3vZ7Z7Z6Z6Z6V6V6V7Z7h4hll2dFU1RaN8NZM3M3MmMmMmImSLScScScStjOzv3vrvnfrfrvzeZ6Z6Z6Z7V6V6aMZ7mKqZuYuIp3c1VrR8R8R8NZM2M3MmI3WZWaWtScWtrvrvrvnvnfnfnfecZ6Z6Z7Z7Z7Z7ececuIl4qZuHlWZHMkZGSMSMV7RJM3I3I3WYSZSsjOrva+jOrvnfnfjfnfe9ecaMecaMaLaLZ7Z7qZpmlll2VFdGg1UlVaR7RaNJI3M4NISJWZStfOzvWtW+jfjfjfnfjfnfnfetitnOZ7aMZ7d4hllWlGUkdGhFU1REVHZaRbNaNJNKNJOKObStW+fOWuWuWufOfOWuaujPjPjPecedaMibhlZDU0k1k2ZFY0U1ZGVVdlZWVaRaRbNKNIWbOcS8WuStStWuWtWdWtWtWta+jPnfi9aMV7u5ZWQjYkUjlFlHkmdVhEQUhnZWZGU1U2VHNbWbOcSsStSdStWtaMWtWuWtWtWuWtWMWMR6V6iHVWM1QTQjhFlHkmdFdFp4dXU2VFRIRZRZRraLOcOcOMScScScVZd6h5iaatatWMRqRqNqNqVZVYQ0hEuF6n2Wt2dWdWp4ZGVGVWVWR8ebiKeKOLOcN6OLOcWMMmQ2Z0q1iGeIR6RqNqR6R6R6WIp0yF2WdUp2t2UkUkQkQkQjQ1VWqr67l4d4RqR6SKSbWKZmZlVUZ0d0ulR6SKR6R6SKWLWLiIp0yFt1Qzt1llQlUjQUQkMjMjZXyZl4hnozpmlnd4WKWaV5VEVlZ0VTiFV6aaWKR7WLabach4lUpkpkpkpkQ3UjUTQDMUMklntnp3Z4ZocRoy1TxkypiqVXU1ZFRUaEmFiKZ6aLaLabereriIhTlUpUlUQkMkM0MiMSISMjdVt3hWhHRHUjcSgilFuHibVWV3VVZEVEZ2mIZ7d7Z7aLaKaKZVdDdDYzMTMkUjczc0YUQTIiZVmIdXc1M2Y0czZWuHuHyHhmdWVndmZWd2ZmqYiLeceMZsV8RbQ2UjQjMlZDZpRaNIU1cVMiqYmYZGQ1M2c0c0d5pnt2lmZWZWRWZmZndmRGdkqnu6VaRKM5I4EmM1M2RHRqVsVLNII2UkQju5d4RXh0g2Z4Y1ZYiImZ3KmZZVaEZmhndnZURWZ2eLRZI4M5EmEmEVIlM2RKE4MoI3EmM1QjiIVGVEVEZEVpI0NGh3mY3LmYVGVlQ0VFQ0Qzdkd3eLeKI3InImM2IkITImM5I4InEnIkM0M0VWY1ZmR3U0ZHSaJWRHdomJmHRGd1d4RFMjMzVTZpV5eHI4I3EmNFMzMzM3M6InM3EkETVFZFZGhYZYZGU2Jkd0Z3hUQ3dZdmMjRURYNGNEJEJFVpZ3zWiHEnEnM1MzMzI3M4I3ImETU0lWhGhnhWcnUnM4FUZ0ljhUM0UkljZlI1NHRnikmleUeGilvFmVQ2ImMkMjMzImI4ImEVMjx4lqh4qYmHU1I1NHMzdDpzVlQ1Q0dFp3uXRlaGmkq1vFu1iVd0VEdGZGU2IjMjIlInIWETU0hGU4dWmHmXZWQ1MkUSciljuDdld3yIp3lmZ1Z0eEeEeEZkNEJERVmIU1U1IkQzZGMmIjITMjRXNIQ2VWZoZpIlMS', 'base64')),
  ('c073', decode('d3d3d3dmdmdmZlZlZldmd2dmZmZlZmZVZUVDVUd3d3d2dkdkdkdkdldldmd2d3iId3d3Zldmd2dmd2ZVVVVUVUVUVUZlZlZlZmZlQzQzMiQzQzVVdmdmdkdkdkdkdlhldmd2d3d3d3d3Zld2d2Zmd2VUVUVVVVRVVUZlZlZmd2QzMyMyQzVEVDQzdmh2h1hkdkdUdlhldld2d2d2d2d2Zldmd3dmZVVVVVVUVVVVVVVVZmd2mXQzMiUzll2pqHhlh2h2l1hkhzhzdll1dkdldldldmd2dldmd3d3VVVVVVVVVVVWRVVVdmd3l2MyUzhUdUuH7MuYl2d2qGhlh0lzhll1hkdUhldlhll2hldliHh3ZVZWVVZmZmVWRVZlh3h3mIhlhUhkhluH26uphlh1p1p0l1hkl0p1hkhkdUdlhlp1hldliIiHVVVVVVd2ZmVWVVZliHmImIqZhlllp2p2upmHdUhlVDMzhUt0lkp0hlhkdkdUhkt0p0lkiIiHRVVVd3h3ZmVWVVZVmIh2mImImHhUZEZEdVZUZURDMzMzQzVDVDZUhkhkhkdkdUhkpklkeIZmVVZmiImIVVVWVVVEh3h2dld2h3l2ZDZEVDQzRDMzMzMzMzQzQzMzMzZUdUdUdUdUdUdUd3d3VVd2iIiIVVVmVVVVZVh3ZUdVl3mHhlQzQzVDMzMyRDRERERERDMzMzMzdUdUdUZUZUVUd3d3d3h3iHh3VVVWVWVVVVZVZUZUZUZUh2l2dlZUVDMzaEaEV0RDRDMzMzMzdUdUdUZUZUVUd3iHiHiHmHmHVVVWVVZVZVZVZUZUZUhlh0dkZTdkRDMzRUV0RUMzQzMzMzMzRDdUZUZUdlZUdld2iHmHmHh3ZVVWVVZVZVZlZlh2hlZjZjl2hTZURDMzRUVkMzMzMzMzMzMzQzdlZlZldlZVdUhUh2h3d2h2ZlVVZVZVZVdlZlqXh0VTZjZjZzZjVTMzZkRDMzMzMzMzMzMzQzdlZldldlh1hldUZVdmdmdmh2ZVZmZVZVdlZlh1RDRDRDVTVTVTZkVDVTMzMzMzMzMzMzMzQzdlZlZldlh1dldUZldldlh2p2ZVZVZVZVZldldkQzMzQzUzVDZjZkZzVTZUQzMyMzMzMzMzMzVUZldldldlhUdVdldlhlp2uGdlZVZVZVdVdldVVEQzYzYzVTVTVTVjVTVEQzMzMzMzMzMzMzREZldldldlhUdlllhll1l1uFl1ZVZVZVdVdVdldlZUUzQzRDRDRDRDVDVEMzMzMzMzMzMzQzRDVUdldldmdUdUhlhll2dVp1yFl1ZVZVdVdlZUh1dkQzMzQzRDQzVDVDQzMzMzMzMzMzMzQzQzREZldldmdUdUZVdVllZUdVp1p1l1ZVdVmHVEupRDRDQzVEZUVDRDMzMzMzMzMzMzMzMzQzRDREZUdldldUZUZUZVdVZUZUhlllhldldlupRDVDQzVDVDQzVDQzMzMzMzMzMzMzMyMzQzQzRDVEVEdldlZUZUZUZUZVZUZUZUdmdmdmdlqXZEQzQzZEZEQzQzMzMzMzMzMzMzMzQzMzQzQzRDVEVEdUdlZUZUdUdUdUZUdUdVdmd2h2dlhlllQzQzVEdVQzMzMzMzMzMzMzMzMzQzMyQyQzQzVDZUVEVEZUZUZVdUdUdUdUdUhlp1uFh1dlhlhmVDdUZUMzMzMyMyMzMzQzQzQyQyQyQyQzQzVDVDVEVE', 'base64')),
  ('c074', decode('y6mZeJeJeIiJupy6y6y6y6upy5ypupupqY263Ky6u5upeJaIZ4Z4Z4Z3Z4Z4Z4eIy63Ky6qpy6qpiJeJeJeJiJuqupupupupqZupupdlIhERVUqZupupmYZ4Z4eIaIVnVmZ4iZy6y6y6y6uqqpqpmpiZeJeJiZmZqpqpqpqpqpuph2MiIhERERZlupupupqpqpiIVVRFRVeJqpu6upy6y6upy5y6y6y6mZiZiZmZmpy6qpupupy5dluFp1hjZCRDqpqpupy63K3KiId3Znqp3Ky6upqpupmYup26u5qpmZmZqpmZqpqpqpqpupupdlpkyFuFhTZUy6upupupu626u6iIZmqqy6y6upd2dlh2MhmHqYqYqYupupZmMyMid2uqupy6hlZCdChTYydDy6qYZlZluoy6u6qqmIupu6y6RDIhMhIRIRZlZUIRIRVDy5MhMhQyMhy63K3Kl2pkt0ljp0hk26QyUyUyQyy6u6upup3Ky6u6MiVCZDUyIRmHZUp1uFUxqYQyZDZDQyqY2626y6dDYyUydCmHy5QyUyQyMhy6qYMiMhQyy6uYMhQiMhQhMiy6VDQhQhYxqHUyQyQhQyZUl1y6qYMiUydCMhh2uYVDUyQxQymIh2ZDZDUymHqYQhVCUyUyVUu6ZTUyQhQhmHhTlkdCZDl2hlupd2QyQhQhQhREqHp1ZDQiUyuql1ZCQhMhmHy6VDUyMhMRVDqph2QhQhVCzLhlUyZDl1qGhkh2VUVUhCUyUyVUZlh2l1dTdlu7mHp1ZCUyqYy6VDQhlTQyZUVUZlUyQhQyu6qpVDhUuFp1dkqXd2ZlpkhTdDZlVVd2qXmGVUqZqYlkhUhlu6mHdlZCQyMhZldlVUVDQyQzmIZUZDhTUydClluYmHZll0t1p1h2h2mHqYmHdmZUdlVDhlqXqYqYd2hTZDZDd2h3qHhlZUREVEVEZUlkMhMhUymHqXh2lkuFp1h2qHqXqXd2mHVUZUZVqHqYqYmHd2l2l1dkqXqXqYmHqHh1ZUVUdlZCMhQhVDh2qXiHhUt1p1h2qXqXmHd2qHVUZUZUmHmHmHqYmHh3mHmYqXqHqHmHmHqXZUZUh2QzIhIihkl2qXh2dTp1lliHqXmHh2d2mHZUZUZUhlmGh2qXqYiHqYqYqXmHmHh2iHqXhlh2h2MzMyIiVDdUqGh2dUlkhlmHmHmHdmd2mGZUVUZUVEZUZUZUl2mHqYmIqXiHd2d2iHmHl2mHhlMzMyMyRDVEVDhkZDlkhlmHmHmHZVZlmHZUVEVUVURDRDRDVEZUmHiHmHh3d2dmh2mHmHh2QzMzMzVEQzVDRDRDQyUyZUZUdlh1VUZUh2dkVDVUZURDRDRDRERDdld2h3h3h2VVd2mHh2ZUMzMzMzZVQzRDRDRDQzMiVDRDVDRDVDdlh2dlVDVUVUVDRDRDRDRDRDZUVUhmdmVEZUh2dlVDMzMzRDZlMzMzRDRDRDIhRDRDRDQzMydlVDQzVDZUVEVEQzRDQzRDQzRDVEVEZUQzVUZUdVZUQzRDZlVUQzRDRDRDRDMiRDRDQzQzMyVUZUVDMyVUVURDMzRDRDRDMzRDVEVEREQzVUVUZVZVdlZUZVVURDRDRDRDRDQzRDQzRDQzQzQzQzQzQzZUZURDMzRDVDQzQzQzRERERDMzVEVUZVVUdlZVVUVEIiMiMyMyMyMyMyMyMzMyMyRDQzMyREVEVERDMzRDRDMyMzMz', 'base64')),
  ('c075', decode('lUlkp1lkhUhUhTlklklklkhkhThClTtzyDvMq9q9zLm9iteteriZWMV7R7R7RqRqRqRqVpVpyVuGy6uFljlSlStjljhThThTlTlipjtz7GzezOvN3Jq9m9itetacWMWLV7Z3RoRqRqRqRqRq7t7ayXlDpjpjp0ljljhThTljlzljtzpS63zOzNzK3Ju9q9q8itetacaLiYqnh2h3h3VpRqRq/u/+2mpjlSlSp0pzhjhTdCdChTljtztj24zN3b7azMzN3Z7H3H24y4qWmHiId5ZnVmRpRqRq/+/+7a2UtzpjpjtzljhTdDdChTpzpjtz3I3d7c3N3c7q/W7X7G22qYecWceYaJV6VnR6VoRq/+/+/92kyDtzpSlSlShSlSpztzpjpTt07J/s/s/s/r/X/W7G22qqitetaciXaYV7V7R7VnRq/9/+/t602TyUyUyUuEljhTljljpjuF257c/s/b/s/s/q7G623Lq9itetacioeZWLV7V7V4Vo/+/+/s602T1ztitztzljljlTpztzyX7b/t7a24637H7H7Gy6zNq9mtm8vLirWcWMWLV7V7R5/+/+/+7F6k2T1ztjuDyUpzpjlTp0yo7c7b2n2U627G/Z7G7JzNvNu9rMvMiseqabeZaKaKaK/+/+/9/W6k6D1z2DyUyUpjlShTlkyo7L7byXyU6160yD217H3MzNzNq9etirm2mompiYeZWL/+/+/+/r6l6T6T2TyDtzlTpjlSYyqI3L3KyoyE617W7HyDymp0y6m9itetirmnineaWKWLWM7X/r/9/+/p/F6DxzxztzuDpjcyhmmJyp26yot0yDyUyUtzhUhTllmZitetatirmoirm9m9ac3X7X/s/9/9/X6D2DyDtzpzhDdDqJqaqZ26uXpjt0tztjlTlTyVl1isititetismpepvNzevN3G7G/9/9/9/t612Utzt0lkllqZuqqaqZyqqIljlTlkl2uYlmiJmZetetetetitm7vMm9edetyl217a/t/s/s7I2luEqFqImJqaqaqZqZqZl3hThThlmJy7m8esiretetetatetetetetacacyly1/t/s7a7K7b25youYy7uqqaqauaqZl5dUyol2iJqqq9etetq5isatatatatm83c7cq7aby1227t7b24253L3L3Ly73L3My7y6qamJdVhUuqqZmau8i9etetq4q4esatatatesm8zMmqaI/t7t7by6uo3L3M3Muququry7uqmJdnhkyohldDl2upu7i9i9etiWinesatatadacWcacZ4Vn2m223JuZy6y7qqmKdnhndWdndVQjZDuE3HhkhT22uYq8i9i9i9eZaZatatatacWcWcWMWKRWp0lTp2upupmJdnVEZEqYZEZDUzUydEp123uEhTuWqGqXqqi9i9etm6esasadWcWcWcWMWMRopzpjhlmJmJZWZCZCUydUZEZFZEZEiJl2qF25uop1qGqYh4ebe9etesatatWcWcWcWMWMSLR6uVhCdCdmdVZDUzUzU0ZDiKiJiIh3m9mZdTqYunh2dliJq9i9etetatatadWJWcWcWMSMSLR7mVumljdDYzYzdlUzZEiJi9i9i9i9i9isZmebh2hmhlmZatm9vOqrebadabaIWMWMSMSLR6R7h0qVmFibdUVUZ2ibq9m9itetetetitm9m9etq8qZdnh3qrmZmZiseseseZaIWLSMSLRoNnR6', 'base64')),
  ('c076', decode('hldUdUZUQzVEhldUZUZEVEVDQzMiMiMiQiQyUzUzUyUyUyUyUyUyYzUzUyUzQyQyQyQiMiMidTdUZDZTVDMiQyZDZDUzUzUzQyMiMiMiMiQyZDZDdDZDZDdThTdDdDdTdTZDZDUzUzQyMiMiZTdUdUZTdTVDMiMiVDVDUzQzUzUzQyQyQyUzUzdThjhjdThkhUU0QzUzZDdThTdTUzQyQiMiVDZTdUZTZTZDUzQiMiUzUzQzQzUzUzZDdDhUhUQzVDZDZEZVdnZWVEMiMiQzhkhUVDUzQiMiQzZDZDZDZDZDZDQzMiMiQzQzQzUzYzdDhUpklkZDMiMiZWZVZVZmdnMiQyl0l0hkdUUzQyQiQzVDZDZDZDZDZDVDUzQyUzZDUzUzZDdDlUpklkZDMiZmZWd3qZZmh3MjUzqElkhUZDUzQiMiQzVDdUdUdUdUZTZDZDZDdDdDdEdEdDdDlUtkpkVDMiZVZVZVVEdmMzMjMjVDhkhUZDUzQyQiUzVDZUhUdUdUdUdUZDdDdDdDdDhEdEdDlTx0t1QzQzdmZVZVZVdmMjMiMjQzdDhUdDUzUzQyMiQzZUdUhkhUhUhUdUdDdDdDdDhDhUlUpUx0hkMzMiMjZmQzMiZUqFp1dUUzZDlkhTZDYzUzMiUzdUdUhkhkhUhUhUdEdDdDdDdDlUpkpkx1hUVDQzMyMzMiZDynyWuFyFp1ZDpklUhDdDYzMiMzdUdUhUhkhkhkhUhUhUhUlUlUlUpkx1x1t12WyWqFuGl1yGyGuFt1t1t1pkhElUhEhDUzMiMiVDdUdUdUhUlklUlUlUlUplhVdUdU2Fx1t12W2W2GyGyGt1t1t1t1plhUlUhUhUdEUzUzMzMzMzVEdUdUhUhklklklUlUdUZEdEZE2Gt1uGyGyGx2t2p2plt1t1plhVZVZUZEZEVEVEVEQzQzQzQzQzVEZFVEhVhVhVZUZEZEdUZEplplt2uGuGp2hldldllluGuGuXp2ZUZEVEVEVEVEQ0Q0QzQ0QzQzQzQ0dVdVdVdVZVdVhmdlhldUp2qGqHuHuGyX2o2n2myFpTYzZVZVdVZVZUZUREVEVEVFREREQ0REVEdVhmhmdlhmh2dml2hl2n2n2m2W2m2nyW2nyGhDYyZUdldldldldldlVVZVVVVFVFVVVVVEVEVEZVh2h2h3qHuW2Wlk2F2V2myWpklTuFyWlUYyYzdmhmZVVEVFVVZVZmZVZVVVZVZVZVZVZVVVZVhluGyW2WyVyWll24242ot1uGuGp1hDUiYyZEh2h2dlVEVVZVVFZlZVZVZVZVZVZVZVdVhlp1t1t1yGyGyGuGlkdUUzQiQyQiQiQiQiQiQih2qHmHh2dldmZVVFZVVERERERFRFVFZVdmhml2p2p2p2p2p2p1plplhUhUZDdEQiMiMiMiQyuGuGyGyXyXuXuHuGRERERERERERFVFVFZVdmdmdmhVhlllllhVhVdUdUdVYzMiIiMiMiMiZElmllhldUZDUyUyQiRFRFREREQ0REVFVVZWZWZWZmdmdVZEUzQzMiMiMiMiIhIhMiQzU0VEZFVEMiMiMiMiMiMiQiRERFREQ0REVFVFVWVVVWZWVVVFVEQzMiIiMiMiIiIhIRIhIiMiQjQzQjMiMiMiMiMiIiMiQzMzQ0RFVFVFVFVFVFVFQ0MzMjMjQjQjQzIiMjQzQzQzMiIiIhIiMiMiMiIiIiIiMiIiMiMiZV', 'base64')),
  ('c077', decode('EiEiEiEiIiEiIiIiRFu83e7u3eZGh5hpQ2IjQlVI7u7u7e7e3ey9y9zN3N3e3e7e7e3ey9y9EREiESERERERM0VW3e3e7e7ey8dGdFhXQ1IjUlqbzN3e7ezNususu9u9utzN7u3N7u3N3Oy9ESVWERERIiM0VX3e7u3e3eqczNU1MkVFIkU2U1iLmc3eqtmcmsitmtitecqczN7e3ezNmciLESESERIjIkESdo7u7e3OmLqc3ehnMjITQ2ZYITVXu9mcicecm9m9mticmc3O7u7u3e7e7ezNESERIjM0ESIky9u8h6y9us7uqrIkMkZYqbQ1IkMkRHVpecm9q9u9ismcy9zNy93e3e7u3NutERESQ1ESESQ1Q1MkiJ3N3ezNmciLmbdoIkIkIkIkI1Ild5u9u9icqsy9y9usy9y97uzNusqcESVHETEjM1Q2M0mbus3ey9d7d7d7d6QkITMkIkIlI2M1qsZpeLqs3e3eu9qtqs3NutiLVqVqVGM0EjVXRGM2u8usqsh7d7Z7d7q9VYdFMkIkMTM1I2Q2M2IlVG3O3NmbeMaMiLeLecZ7ZqVqh5EjIjqbVXy9qcmLRZZ7NqVqq9zONIZFQkMkU1RGd6M2IlI1h5mby9U2ZIeLeLqsmciLZ7NaVXIjM1iKy9qcusiLRqRqeLic7eqsM3dGU1Q1poh6qsRHM3d5zNu9uKp6hXl6mceMZ7VqV6NIM1IkVYusu9Zq7ed7Namcu93e7eibM2hWZGZGdXusqsd6ususqLpotptYpYdod6V7Z7Z7RaiLIkIkdpy9d6Zq7eqsV7u9zN3O7eaLQ1lXhWQlmJqcy9iLd7iLZIc2tptptYU1ZZiLd7Vqqs7uIkZpzNqcd6u9y9eLu9uau8zO3eZ6Y1lnhoQ1usmcy9iLVqiLdpMkUlUlY1doqbiLu9qc3e3eVYiLy9mLmLy9iLeM3Oqbu93evNRZdFhGQlVYy9qs3NZqRqd7qcMlQkQlQ1VGZXzN3N3e3ey9qsmLusy93NqcZ7aLqaZYd6ZYiLRZU1Q2d6us7eqsy9VaZqiLZpUlhXl5U1ZHy83eu9qch6M1ut3N3N7u3eqsV7V7hoZoRHRHM2RZNIRaZ6iL3emch6RHM3ZZM1Ukt52rlYl53el5VIM1IjET7e3e7u3e7eu9iMaLiKRHI2IkM1RHNINZNIZpmKVqRHM3RIM1MlUkpYxpyb7emKQlVHI1IjET3e3eqsd7y9qcV7icmJM2I2I1IkIkIlM1IkIkIkIlIlM2M2MkMlQ1Y1qKzNusdXQlVHI1IjIkRZRqRqmcmLV7aMq9qKQ1NHIlIkM1I2NZNaNIRGIkIjIkIkQ2Q1dYU2dYqbdpMlMkU2Q2IkRGNaR7mcqcZ7ecitutlXU1VYIkIjIkIkIlI3RIM2IkIkIkMmVIh6iLusmLZHZGdXY1UlZHd5M1RqeMzNiLicqsm9l5hGZGRIIkIjIjIjIkIkIkRFmaqKlphpdZiLmciLiLuK2buKhXc2U2h5IkV7qs3eqsqsqtmthXUlMkRHIlIjIkETEjIjIkp5yrhpU2U2ZHmLqbVIQ3hpyKuKlXc1Q1dpIkWMmczNy9y9qth5Q2MkMkVYM3IjIjIjIjZGhHdHU3M2MlIlMlY3Q2M2Q3U3dHdFc1hpdoZXM1acmcmtqsutmbdoMlMlIlNIIkIkIkM1uKyKtYlYZHM3M3M3M2QmM2MmU3U3VHUkMkIkdodoNG', 'base64')),
  ('c078', decode('tYxZ3M3d2awXqKiseaaKaJaamsrNveverOm9m9mtmtq9rNpqpItqxJu9u9u9vOvevevevevemKxZ5J/u//6L0Xqci8ererebnOrerOnNrOisisrOrOrOvOq9u9qrp5tpx62bx6vOvevevOvOaaiKtp04/N//6L0oqciseri8t7i9eseresiJd3mIirrOq8qKvOm8dmhmlnt52Lu9verOq90YWJaJeKp5wn5a/e6L0ouLuKmsmstJh6ebd5hVlmpWpmh3m7ZnZnh2p3hmZVZldWtpvOvevey9V4ZnZoZ4l5w44H6s6L0X0XxpisebsnxpqJp3yIyI1ppmp4l5RFt3p3hmRVRWiriKqsveveveVWVnV4SIV4lo0X6L//4o0n04iad5k1lWx52qqHl2pmtGlWRWRFp3hVt4dmaIveverNveveveR4V4aKSJdoxIw41I1J68/N04mKl5VEhmZVp32JtnsWhFpXZmhmM0dmlmdFdmrOvevevererOVoVWd5aJlYwnxIh5WIpY6s5q1I03xoyJt3ZVs213xpppp5hmt2ZEpmZFVUREeIveveveverOwmlHZ4V4hpw4Z5Z4V4d4tY6L6L03034403w2wmwnpYlpp4hGpmVEhEZUiZvOmsrNvOveveve0G0Xwnwn0GlHZ5h4pH0W0n0m5J/d5q/e/e5ZoloWpHdGZFpGlmVEM0VVR4msq9vevOrOvOze0GwFwW0X0XpYpYw3wV0n5Z565p5p6L5604tXU0MiMjREdVhVdVVEQ1NFRnisism9vOrOm9m9sUkiojokwlwmskojo014yZ276spn2K2ahVlWhmMzMzVEhVlVZFREY2ZGZXeJismtm9rOm9m9ojojojojkjojojojtWx32IypuZuIhmhVlVZEZEdFs3ZEhVllVFI0M0g1VVWJirmsm9nOrOrOokokokokojokskskg0ZEpmx3lVlmdVhVZUVDhm1Y1oZVVFdmVVJFE0RWc2V3eaisrOrOrOi9skpFlVhno1okskskokhFVEZEVDZEVERDQzQzxo2KlWg0VVZmVVVmV3NnQ0dGaJabisism9absksllWaaaJdnk2sllGhnZEUzUzQzQzQzQzQzY0YjUzc0REREREZmV3R4RElYV5WJaKZ4ibabo1lGiKe8e9e9eseserplpmQ0MzMiIiMiMjMjIiMjQiQyh3Y0VEZVRVVnd4SIR4R4k4hHd4iseJeJdoebebereseblHs1o1Y0YkckUjUzQzMjIiMjMjMzVmk2clREVVVmaJSISIR4VnZGZnZoZ4Z3ZWd4Z3eJeaomwG0HwGwmxGhWo2klckQzMjMzVnaberaZdXg1REVWhpV4WJRnRWVnZmVWeJZ4ZWd4eJeJdo0H0HoWpW2p2qt3pWlFlWdFVEREerebaJebebt5tpibiKh6Z5Z4WJZ4dWZXeadod4eJeJh5wXsGcUpmpnhmt42ZqIVFMkM0REMzead4Z4eamaqKiaeaebeJiKqbu8yL0odndohYaJeJd5wXoWYkc1RWVmJENWaHN3NWJWA0AjQjeaereJeJeaeaeaeJeJeaeresmKqK2r28pYdXhoZ4o3sWglUkZVJWVVJml42IxmtWlmVVE1QjVmebeaealplYeJeJeKeaeaeadododohXx6ZoVnVWsWsWkVQ0FFJFREJVhUhVdUhVl2dlVVU0UjZ5aJZ4eaererebeaeaeaZXlHklgkon', 'base64')),
  ('c079', decode('IjIzIiIiIjIiIiIiJEJDIjIzJEIiIiIiIiIiISISITITIjIjQkISIiIiIjE0E0IiIiIiIjU2IjE0EjIiISIiIiIiEzFlIiFTIiFDIiIiIiIiIjIjIjMkQ2M3QlMkIiIiIjI0I0IjIiIiIjY2IjMkMkMkIjITIiIiIiJTIiIzFDFDIjIjIjMkQmMlMkMkMjIjQmUlMjIiIjE0I0I0IiIiMjY2EiEjE0FVFlIjMkIjIiIiIiIiIiIiIiIjMlMlM2M2I1QlUlMkQlYmMkIjI0E1M1I0IjIiUkQ2EjEzEzEzFUEzIiIjIiIiIiIiJDIzIjI0M2U3lYlmh2U3knUlcnYnMjIjI1I1M1I0IjIic2I1IjE0FEFTIiIiIjIjNlIzIiIiV1IzFDM2U3p3ZDdFZEdXk3YlknYmIjI0I1I1M1I0IjIihHI1MTMkIjEzIiIiIjIiJDRlIyIiIiJTJlZYdIt3hWp3t3p3hYYlsnMkIjI1JGI0I2I0IjMjVGI1IlMlMlIkIjIiIjNTIzIzJCIiJDJDZWyYt3qkpnuIyXx4Q0UlIiIiEiI1IjMkI2IjIiY1NGJFIkIkMlMlMkIjJEOEJTNDR0V1NDM0umu5maZWZFhVqGZVIjIkIkIkIjEiEiI1I1IjIjZHJGJGE0E1I1MkIkIjIjJUN0JDJDNTMjl2imyqdodXt4dXqbIjMlIkIkIjIkEiM1JWI1IkdHRnJWJGE1I0I1I2MlIjIiIjIzJDJDNEp3iIZYqah5qLl5qKhoZnVFIiMkIjMkZHNnN4NFlHZ4NnNXNWE1I1I1I2NHMlIjIjI0IjRFmGeZZpZpl5usy8mKmKmKqaU0lHZGIjZoVoOIRnhoaJN4SINnNnJFJFJGJGNHRXIkIjMlMll3ioZqZYhnqKy8y8l6ysyshoybqbVVMjdHWYWoWZSZOYOISZOISIJFJFJWJWNXNXNWMlUmpYmpaLdpt4t3ur3Mqbuby8yrmKysybt4iJWZWoa5W5SpOoOpOoOYSZc2lHdGRGNWNmNmM1Qlp3aLaKdXlnp4yr3Mqbyry7uamKy8y8ypapWoS4a4a5W4SpSpSoSpSYQkIjJVJWJmJmNmNWQmt3VpVGVWZoqK2828qby7y7l5housusupipW4S4W5a5W5W5W5W5SpSoIkNmJmJmJmNmN2N2RXg3qHZ3ibh5ub2828mKy7y7iHmJucqrzYipSoSoW5a5a5a5epZXU1MkNVNmJmJmJmN2V3SHN2VYt4aZd4qayry8y8qburyrqXmLurmby5WoOoW5a5a5a5mZpIU1MkIjN2N2N2N2N2SGh4VnOGNWl3M0ZXdomKqKqbububqaqIqLusiry4S4W4a5a5e5mZloWYW5WoN2N2SGSGOGOGSGd3VFSXSXiHZ3h6qLusyrubqKZXdnunqbqriqqIeoa4eoiIdnaIe5epepaoWXNlOHSGSWSGh3U1Q1WnW3eYZ6mLqbubururqadnREqGhmiJZ5M0U1dGhniIe5e5epaIZWZGRFY2RGVXdWg2QlIjNVW3aoWJiLh6doh5uaubqKh43Hp3pmZmWHNVIjIjI2M2Q1aHe4e5Z3M1IjIjITITIjIjIjJEaXenm3WbmLhqVGZXl6qamKl5vIh2dVaXW4a4WGM0IkJGJGI1dWe4aWM0IzIiIiIiIjIjNld3U1aGrHebhqZYQ1ZHhql6mKmJrIeGaoW4W3a4WXWWNENEIjIjIkdme2RURU', 'base64')),
  ('c080', decode('qINFM0RFNWNWNEmIypQ0RERERERFqay7VVIzIzIzIjIjqZ7d262q277c7d7t7M26d3Zmqqy7yqVnNFNEIjJFJWNERVuq7tuqRFVFdmVFd3u6M0MzIjIjqI/t7M26/u/+/+/+/+272q2q/d/+VnNWJEJEJEJFV47d7t7d7d/u27uZhnZVQ0ZVMzMzIiIilV6766y6/u/+/+/+7d26662q7c/+IzI0I0NWNWNFeI67267M7t26yZREVCdShhpxlhdCMiERczqIRFd3/c/t7c662667262q7M7dRWIzIjRWmqmqq77cyZZEqHqIZThhlhphlhpxdBVBhSUyUjQzNFh3/c/d6666666767262q7dNWNWJF3L7L7L/d7L66IjZBhRQxMhQxhRlhdRQxdBdBdRMiU0mq/u/t6666672q2p66267c/uJFNWiZ7M7L7L267LmIIiZCtyxyZBlhpxphphQxdCpilSMiVEqI/b7L2qyZdEUzUzZEyq/t7cI0RW3L677L7LupqZY0IiZT2U6ldTyE2DtztytyphpihSQiVERW6m6l2XYzUyUzUyUyYz3L/dJEVn7c6626262667UiESQy6U6U6l6l6V6Vty2CphliZCMjd32p2W+3hlYzUyUyUyUzQydl7dNWZ4/u262q2q2q2qdVIiQy2D6U6U6U6U2UxytyhRdRRDVVd3NWVmZlQzQiQyQiUzUzQiQy7dIjMzqZ7L2q2piId4NWNFVDli2Dxz2E2D6UxylhhRZBMzVnV4NWdlhTQiUzZDUzQyUzQiQyuqJEI0I0Zmd3NEJFNWNWV4mZdSlRtyxyxythphVCMyZViIiJVWM0pjZCQidElldUZDMiQiQil3IiI0NWNWNWNWNWNWV4u7qqdldSdRhRhRhRZBZBZBQyMzM0Q0IjIiQyZDhUpllldUhUQiQydlIzIzI0JFVmRnNWNWeIu7qqqGljYxdBZBdRdRdBhRVBMiIjIzIjIiMidUuH2Gt1l2llQyQydmVWNWNWzL/u7diZZ4V3qYp1tz2DtylClChChBhSdRdRQyIiIzIiIiMit26o6o6o2Xt1QyQydl/t26Vn7t7L66667d7dhlhTdStz2U2Uxz6C2DtylihRZBMiIiIiIiQip26o2G6o64yGUzQyh37L3L7c7c6766yqyq3LyqqIdmQylS2E2m2U6V6TxydRdRUxIiIiIiQihU6o2o6n6ot1UyQyqY267c7LuZuZqZZ4ZmMzMzMzM0REVCpi2Uty2U6DxyhRdRQyIiIiMiUyMip16n6nplUzZE3M/u2q26qZV4iZd4IiQyljtzpyUyIiMjQyhRhRtyxyphdRMiMyRERFiIUyMiMydUUzlkdUl3/+/+2q26ypqGmIMzhS2U6V6l6V2ThRIiIjMzMyhSdRlRUyd37d/dyqmZVFQzVUqG6o2XUzVE7c7c26262ql1pityty2D6U6l6V2TtyMiIiIjIzMzIjMiVV/u/+/+67dmZXVVZlup2pl2VU3cy666yXuGuEyEtyxytyxy6U6U6UyClhQxIiIiIjIzM0Izuq/+/+/tuYZlZXVVd1d1mHl2iHmHVFdnpzpxuC2T2U2U6m6l2T6U2D6UtydBIiIiIiIiIjM0uq/+/+7Lh2ZlVGVUh1qGhlp2d1ZkVGREuEph2C2C6U6l6U2T6U6DxzthtylhdBMiIiIiIiMjREyp26ypd1ZlMjVUd1uGdllld1VUREZl', 'base64')),
  ('c081', decode('qXqoZVdVVEZEZTulqW7a3Jy5y22F7G7V623Gl2/t7W7F7FulmGun3K/////ty43K///////tmFdlhWMiU0hWp1237ay5qXp32665yY25uYhmp3667V7F7V7Vl0mFun3b////y5zJ7t///+//ylhWZEMihVdVp2qGyouIl3lmp3yZp3uIuZlmuI/b/V7F7V617F21h1uo3c7d23qXzI/u//7culdUMidFhWlWlWuZlnlmhWdVhWlnhmlmhmpnt37L7W/V7F61/V7VylqGym2m6mymuoy53K3K2mhWUzhWUzhVhUp3uIhWhWhmdVhVhWhWhmuI7M7M/u/c7I7G7X7b7c7M7c7J6362uVyluXy5p6ppdGMiZEqGlklnuZhmdVdVdVhVhWlmhWlmuI677M67/t/u/u27yZuI277d/d7J6l2lmGunlptpppppuJhmhWdVhmhWhmdVdVhVhml2hmuHqI272qqIp32q7dyq7u/u7d27/t//7t//u5uohYlYx6t5uJhmhmhVhWdVhWhmhWhWhWdVlmqHl2yZ7MuYyZp3p3yqyquZyq3M3L7dlm277ty5ZGdXlox5yJhmhWU0hVhWhnhWhVdVdFhmmHu4uohV27yqyqyquZlnlnlnhmhmuIyqlmhmyZ/uZGhXpptpyahWdVQzY0hVhWhnl3hVZEhmmYh3hmZEyq2q277c3MuJlnhmhnlnuIhmhWhVhmyqdXlot5xpqIlVlWUzUzhWlWhmlnyZlmIRUzUzZVuIt3pnp3l3yq27yql3hmhnhmhmhnZFhWl3pplot5loERUyhkMhQihWlWlWhmqIl3ZEQz277u/u/u7d28uZl3hnlnhndVdWhmdVhWhmdVdVuZ2qp3Qylz616lQyMihVhWqIuIhmhWdVlnp3p3p3lnp3p4p4p4lndWdVhmdWhWhWdWhWhWdF7dyq7b62yVVCAAAAERZEhWZVl3qIdVhmhmhWZVuZuZhmhmhnhmhmhmdVhWhmZFhWdWhWdVdVyqp3yq62VCAAAAAAQzhmhWhmh3l3hmhWdWdVdVlnuZuZhmlmlmhmhWZEMihWhWdWdVdFMiqHl3dVl2h3VHM1ISEBhWdWdWhmdVdFdWhWdVdVl3hWhnyZlnhmhWhmhWERAAMihWdVhmERh2yYhWZVVEiHdnZYQ2MkdWhWhWdVdVdWdVhmdVl3hWhnhmqIl3hWhWhWIiAAAAAAAAVEqIyq2qyYhmdVdWZlh3VHU2Q1dVdWhWhmhmdmZFhWdWhWhWdmhnl4l3hmdVVEVEAAAAAAAAQzl3dll3uqdWhWZFdld2U2U2VGZFhWhWdVhWZVdWdVhmhmhWhWhnhnh3dWdmVEVEAAAAAAERZFQzVFqI7uhWhmZFZlVFQ2VHVGVFhmdWhWhWdVhmdVdWhnhWhWhnhnl5hnZVZFIiEREAERZHhWdVU0ZFl4dWZVRERGVXZHZHZHQ2dWhWdWIiZVhWhWdWhmhWhmhXppl5p5ZVISISdTQyQ0dWdWhmZFIiqId2d2VHVHZHdIZHVHVGVGM1AAAAIiVEVEZVZVdWhXp5lpp6t6l5IjAAp0dWdWhmdWdWhWdV3MmGVGVHdYhYdYdYVHVGRGAAAAAAMihmhmU0VEZFlolYp6p6p6p6ubh5ZFhmZFhmhmdVZVQzuZqXQ2VHdIhYdIZHU2VHIiAARCQxAAERERAAERMzMjpppphodYdYp6p6dWhmQ0Q0Q0hmdWU0uZ', 'base64')),
  ('c082', decode('VqeGijijijySyC2RioStWraXd0iHa8asUkQjQzpk2G2W2Wi7jLnLnLnLrKm4OTOTeDtixixyVqZ5qkyxyy6w6gukWcaraEWDZztjuWZ3YiQiQzUzyG2Wm7jMrLrMnMrbvarKSUODSTmDxyyCZ6Z6Z6mm2y7Du3WcWcqFiDiEuGuGhWQjZDdDUzQzdUq7nNrcrcrcvbvbrbnLaleTajyiyCyCZ6Z7aLaLecq7iracac11yVyHx4hHMjQiUzVDZDUiQyi8rdvdrdvcvcnMfMa9ip2RuS2iySySaLaLaLaLebq7m7esecyH2W2YuJUmMiQiUiQzVDUyZ3nMvdvdvdvdrdi8esasWtqn2Q2R2RyResebh1pyqCuTu5isacmK2V62qIUlMiUiYiUzVDiZnMvdzdzdvdnNuXxxxyl1d6WciYyC2B2Besh2lyqTqTuT2xmrecacmaymhnUkUjYjczZDmYrLvMzczczdnNqo6Q2Rxytzl0iJWcWcWbWbispyuCyTq0ukyhvGisecesesdHxlyWhDgzhDuGzK3L3K3czdrN2i7A2S2jykmDhzeKWcWcWciruCuSmkekekuizErMm8m8q7tn2W23p0lTpzyi3E3F7G3KzMvM6h7B6i6juzeUaDiHacacabmsyiuyekakekqy3WvbrMq8x42G2363lkuD7SizSja0zF7Fu6q76z7D6y2jqjeUWDeVeseserm9u27AmzezmzzCrMzbvbt2xk2n2Vp1p0/l3XKjGDSkW0q17Xqry26z6z2zikakWjmnisq6m8q8q9zH3SzBzEq7m9vMzatlxk2mhDhT3G7We0SkGTGEGTWk/ru7q73F6z6zyyuyqjq8m8m8m8vMu8u9q9u9q9m9m9q9zbx0yEyFYzhU7o3VOjGDGDGEKUSl7t3cq8q8zI3F7D21q7q8q8q8q8zMzMvNu9u9u9q9q9q9u6x0xkdDYzhU7r/YSjSjKDFzWk3a/t3Zu8vNq9q9q9u9u8u8u8u8u73L3MzMzMzNvNu9u9vNy8YzUiQiUydU7a7H3B7SGDGDWU3a/q7IzMvMu73E7A6y3HzMzMy7y73K3L3L3M3c3czNzN3dyapVUiUzQidE23/X7B7Aqxyz2z3C/i253KzL7C7A6y6z7D7GzLzLzL2B1x2D243c3c3c3d3Nx3xl2Xx3tl2X6W/V/D7B7A6w/A7R6z26273H/R7C7E7F7D/D3K3L3KuRxxxixi2V3b3c3d2qx1x17bx2x1246o6V/E/F6z+z/E7G657K3L7G/S7D7D/E6z/C3I3K3KqyuiyCxy2A2m7c7c2Z2W2p3cx2xk3L7b2G2V6l7G7H7J7K7b7L3L226i2S6i6i6y/C3K3K3Kqzu0yDxy2B2R7L3M2Y2F263dx32F3L7t7K2G2W6n7K7b7b7a2l2ByByBxxxxxhxhxy2n3K3Kuz2j2Dxixh2R633M2I2W3L3e2Z2F2o7s7r7c2n2W6n7r642R2QygyRuBtxththpypytiyE3Jujyi2Cxity2B6k7M2Y2m3K3e3N2G2m7a7r7t7t3L65632Q2gyQyBuBuCuBtylyeDeDlytixzmTqjyCtity2Q607L2p6m3L3d3d2p2W637s7d7t7s7J2B2g2gyBqSiSeTiStyeDWTWTaDeDpyqjqjuityyB6w607K26253M3c3c3c2o2m7c7c7c7c2C2Q2Q2QxxiSaTWTWTiTeTWUWUWTSDeC', 'base64')),
  ('c083', decode('RpRXNoR5esZ6ZpZ5aKeKeKVnV5V5eKibibibisesibiaZVZDVDQyVleIaIaJeJZoZnZWVGVFRXKKR5Voebm9msmsibiLeLaKVoaKibicisisisismsmrhmuHpmVDVEiKmbird5h5dWZWZFVFRoRoVpV5aLeKd6eKabacacaKV5WKeti9i9i9e9i9nNm92p2Z2ZdUZWiKmriKmJhWhmhWdVZVm9esZ6VpZ6aKaKabWtati9aKaJWJi9rOnOjNe9jNi9m9yq2I2Yp4mbmsqbqK2rt4t4hVhWhWV6VpVpZ5aKaLacese9jNnNaKeraaerm8esjNfMjNvem9u86Zt4msqsqbqKpnyJt3lWlVp3hWVpV6Z6aLWcate9nNjNe9i9WKrMvNeaWKe8jNa8jNqatolWx3l4qbucuKuIuIyIlVhFp3lnhWV6aLabece9jNjNnNjNfMi8mavdzevdnNfMa8W8h5tox5lGpXxopXlpuKt3yYyIhVuJt3lWlmaLabesi9e9jNnNvem9e9nNirvdvdrdnMjMjMuKtY152Kxo2K15pXpXt42p68lnt4t3lVhVqIaca9aseresjNrereverOrerNrNvdrdjMfMiqt42K6s6s6KpXtotXtHtn27lnyZtnlWlWuIp4d4aKebisisacesmsqsu9rOzerNvdmZqrqZ2Z29296969692Kx5toxYx32r2r2apnhVyapnlml5qbmKqKqbubqbqah5eKvNrOveu7t3yrzdvOu92c7N697N68x5t32I6q672at4lWuZyJpnhWl4mJqKqaqKl4dnZnh4qaqKmbrNm8u8rOq9qsyc2b7N7N7N68xox52b/L2at3lmuIuIpnhWqIhnl4l4l5l4l4qKqKqJl4d4mKibm9q9qcqcucyLyK7N7N7N2r2L166b2ruIlmuJuIpmhWp4p3qKqKqJqJqJqJl4hnZWVneJmcq9qcuLybubuc2LpouJ2r2KpX2s682ryJpmuJyZpnlWp3qIhVl4hndVdVZVVVRWN5Ose9i9qcuLuLt7x7yLyb2LpXg1c0Yjg1692ZyZtnt4yZt4pnp4yZlWlXRFFEA0BEBWOKS8a9itmsmst6x61qx6yLybyL2bt5hFYkckpn7NyKx42b2btopouKp3pXpYp6A0BEBWOKa8e9iti9isqcuL1qxqx6x6yLyLyb2bpog1ckg12r7N7N696s2c2syLybuKpYp6p6BFN4iJqJp5pomKmsqLyL2Lxqt6x6x7x62b162Ltoc0c0t47d7N7N7N68282sybybpYpqpqpqdol4lolWlGpXt5mLuL6b16x7x6x6yK2L1p2L6spXcklG2b687N28682s28yryrpYtppqpqpqhnhWhFg1hFhGl5qL2L6byLyL1p2L1q1Z166b6shFg1pW2K6b16xIxIx6yryrpYpZpZpqlqlqdFdFZGZomKqLqLuL6c2LuLt62L1Z1Z166L6s6slFlGx52b6s161Z1IxI2rpYtJpZpppqt6lZU0VXh6mLqLqLqLuL6s2Lt62rxI1I1Z166b6s2rlFtX162b6b161Z1I2btZtIpJpplqpqlYlYZoh6mLqLqLp6qLuL6b2bybyKyrtI1p166b6st5lG2b6s6s6b161Z2btpxItZpqpqpqhYlp2Khql6l6lplpp5p6uL2L6bybppt5pY682L162KhFx56s6c6b6b162rtptIxZtppqlqlZpo6r/u', 'base64')),
  ('c084', decode('ESISIiVEl2IiMyh1uXVUIiIiIiIiIiMiMiMiMiMiMiMiIiMiMiMjMiMzQzZUdlZUQzIiMidlISIiMz3IZUZU24qGMyIiIiIiIiMiMiMiMiMiMyMyMiMiMiMiMiMiMiIiIiIiIiZUun24h1QzIiIil27JuW7JdlIiIiIiIiIiMiMiMiMiMyMyMyQzMzMyMiMzMzMzIiMiIiISESIiIiZU253KIiMi3K/a7JZUIiIiIiIiIiMiMyMyQzZUdldlZVdmZmQzQzMyMzMzMiMzIiIiISESESIiMih2IiZU/t7aZUIiIiIiIiIiMiMzRDmGqGl1hkqXuouoy6mYVDQyMyMzMyMzIiIiESESESIiIiIiIiqX/sZUIiIiIiIiIiIiMyRDmGmFmGqFqGl1uXuYuYqGuodlMyMzMzIjIjIjEjEjETIjREdlMi7amGIiIiIiIiIiIiIiMzVUuoqGqXqWqGl1qXuoqGmGqGqGdmRDQzIjIjIjIjEjEjEjIjQ0ZUynMiIiIiIiIiIiIiMiQzZly5uWqGqGp13K25y4unl0qXqXuoiIQzMzIkIkIkIkIkIkIkIkqGVDIiIiIiIiIiIiMiMzQzdUy5yoqFqGuWynuWuWqFqXuouXqXqpVDMzMzIkIkIkIkIkIkIkdlIiISIiIiIiIiIiMzQzVEl1qGyoynqGyououWqGy5qFuXuXqGy5ZUQzMzMzIlIlIlIlIlIlMiESESISIiIiIiMiMzRDh2upqGqWy57cuouXqGqFqGqXqXun3K3biIVVMzMiIjI1I1IlIlIlISISISIiIiIiIiMiQzZVmG3cqWlkqF3Luoy5y5yoypyo257b263KqqVWM0MiIiIiI1I2I2I1ESESISIiIiIiIiMzQzh1l1mFdThjljl0qFqGypuouoy5ypy5unuomHRFI0IjIiIiIiI0I2I2ESESIiIiIiIiIiIiRDdkdkdTdjl0ljhThSljlkp1qFuXy5y5l1mHd1MzIzIjIiIiMzMjI0I2VDIiIiISISIiIiI0Zlh1ZTVCZTZCZBZCdThlhllkhkZUdndlVCVUZUIiIjEjIjIiZUQzIiIjIiISESISISIjI0I0d1ZURCVCVCVCZVZmVEQzQzMzIiIiIiQyVCQzREIjI0JFI1I0h2VEIiIiESEiEiEiEiEkIkMzdUQyQyVDVWVXZVREIjIiMzIzIiIiIiVDdTVDI0I1NGI1I0M0y6VVIjIiEjEkI1JHI1EiEjRDVDMyVDRWVVVEIzIzIzI0I0NFIjIiMiQzRDRDI0NGI1NXNXZm7bREEjEiESESEjI1EjEjEjZUQyQyRVRVVEI0IjI0IzIzI0I0M1IiMyMzQzMzNFI0I1I0NFqXl2I0EjEjESESEiIkI0EjIjZUMhQzRWREI1I0IzIzIjIjIjIjI0IiIiIiMyIzI0I0IjI0dmh2VFIkEjEiIiEiIiIjI0EjIiREMiREREI0I0IjIjIjI0JGNXNXNXNGJFIzIjNFNFIjEiMzh2IjIjEjEiEiVEIjIjIjIkIkIjM0MzRDMzI0JGIjI0NHNXNGNXNGI1I0IjIjI0I0I0IjIjVEIjEjEiEiESES7KmHRFNFI1IjIjIiIiM0IiI1I0I0NHI0IjNFNGJGNGNHI1I0IjIjIjIjI0IjEjEiEiESESESuo7J7KypmIZnRFMzIiIzIiI0I0NGIjIjNGNXRnZnVWJFIjIjIiEiEiEiEiEjEiEiESESEiIi', 'base64')),
  ('c085', decode('dVVEUzVEdmZWdmdmZVVEdmhmp3qHdUYzhD1lyHlmhmhWdVdmMiMiMiMidFiIiZmIdmZVVFVEdDUzQzQzdmdndmh3h3h3h3l3qIl3hVYytm1lxmlnhmZEZFdWMjMiVVdnVWd3p3dVZVZVVFVFdDZDUzUzQzZFdmh3l3l3l3l3l3hmhmhEpVpVpVl3hmZEZEdWQzVVmaiJZ3hmhVVEMiQzZVVFUzlDVDYzZEdEdEhVl3l3l3dnd3VWMzQzU0ZFZVdnZWM0M0ZmQ0VWRVmZd3dVZVMiMiMiVEZFZElVdElEdEdUdEdEl4d3RERFVVMzMzMzZVVVZWd4VVMzRVRFMzd3RVVVZmdmVEMiMiQzdVdmdE1mhElEdUdUhVmJiaZnRFZmMzREZlZVZmVEh3ZmM0M0ZmMzM0REZmmZd3d3QzMiU0h3dVhmlU13hUhUhElneImamrVmVVZVy5/s7I64657d7Kt0hTt2pTgydDh3ZmVWZmQ0RFZWZVVEdVhVpV12hUlUlmVWRFZ3d4RDqY7H7I/L6o6X6G/LyXtjpTtlxkxkx2tkpDplREMiVFdmdVdVdEpmtm12tVlVVFVVRFVVhl65/b6l6W+26m6m6X65t0tTx0pTxkt1t2pktkpUlCZEREZmuZp3x3lmgz132HZFZVVVVVhUpk7K7c656G6F526G6o65pTpTpCx0t1t1pT10x1x1tktkZVd3dm6It3hVYytUplZVZVZVVUy6/s/b/a/b7L/K6W637b/cpTx0pDt2tjtltkx2pkpTlCpClDVEUzpV12YzYyczdEZVZVZE25/s/s7b6364/K/c7b7KzZzHlkmUqEtTpT2XtkpCtCxTtkxltTdDUzpmxmYydDhDdEZVVEll2p+37J646n6V+27LqmaTrHm1qmhzljxj2GtkpCxj2Gx1pTpTpCtkUzp2pEczlDhDdEQzUy2o656W6X6W6F6V617K3K7bq2q23KuneTp0pUlCtT2HtTxjtT102G2GZDhEczcy5mpEhEUzdl/b/b646m2F6l6V/K/b/c/u3bvIikvHvH3Kt1lDx2pCxj11x2tlpUpUUzhUczcytV12pVVEhl2o/b/c66/b/d/t/t/c/s/c3azZvH7szJu4/tlUlDpSx2tltTpSkypDUzlVxl1VlD6ZxVhEVEx1/L/c7L6p/c/c7czJ7b7tqn7s/c7K3K7L/t7ctUpltUtTxTxk2Hx2lE12521lhE6p6I1mdEhUx1126Y6H/L/c/c7a/t/d/c/t65yY66/tzJ7s7LyHpDpDxl6H12pV5l6Z6qtmdE136I6ItUdEpV1l526p7L7L2o2Y7K3LzJ/c2o7L3J3b/t7c656p2HpTx2x1tltm6Y6p6IhEUzcz1m1m52tEpV1m5366677L66yp7L7cu37c/c/c26uo/d2YyH6612x2x2xmpmxm6H521mdEQiUiYztE5m1mtU531myI67/L7b3K/t/t/d/d247K66/M/c2p657L2Y53x2tmtm5l1l1lpmlVVEdEhVhVxl1m536H12xmp3uIyq3M/t/t/d/c/L6q6p/M7L26yIp3pm5m131mxVtVpVlVhVdVdEpUtVlVlV1m6I536ZxVxVtVpmhmuIuZyYuIyI1mt3p3p4qIl4l3pm5253xllVlVhVhVdVZVVEdFdVhVhVlVpV1m6Z6Ixm5252hWdW2It3p3xm53t3t3p3p4p4p312536HpVhVhVdVdVZFU0', 'base64')),
  ('c086', decode('M2IjMkRYRIM0M0M1RIRIRHRHRHRHRIRYRYRYRZRZRqV7Wdree+aMV7VYVYVYVYZYVYVYMkMkM1M1M2RYRHMkMkM1RYRHQ3RIRIRIRHRIRIRIRZRZRaR6ScnOe+WMV6VZVZVZVZVZRGM1M1MkM1M1M1Q2RHIkMkM0RHM1M2RJRIRZRIRJRZRZRZRZRaRqScjOatV7VpVZVZVZVZVIRGRIM1MkM1M1M1M1IkMkIkIkMkM1M2RIRGRZRZRZRZRZRZVaVqVqSMjOWtR7RqVZVZVZVZRHRGM1MkMkM1M1M1IkIkMkM0IkIjMkM1RGRGRZVaRaRaVaVaVqVqV7WMjOWtR7VqVZVZVZVIM2M1MkIjMkIkM1M1MkIkMkM0M0MkM0M1M1RGRYRZRaRIVqVqVqZ6Z7acnOatV7VqVqZZRHRHQ2M1IkIjMkISM1MkIkMkMkM0M0MkIkM1MkM1RHVHdpRGVZZqV6Z7ecetrOetaMZ6l6hYQ2Q2M1M1M0IjMkISIjIkIkMkM0MkM0IkIkMkMkMkQ1VHZYNGZYZYmLiLicitvei9icZpZqRHQ1M1M1M1MkMkMkISISIjIkMkMkMkMkIkIkMkMkMkMkRGNGNGQ2Q2Z7d6icmtabebecVYRHRGRGM1M1IkIjIjMkISISISIiMkM0M0MkMkIkIkMkMlM1RGNGNGNGQ2VYRHVpZ6V6V6VoRHRGQ2M1MkIkIjIjIjIjISISISISISMkM0M0MkIkIkIkMkM1Q1RGNGNGQ2RGRHVYeLm9mtZ6VXM1M1M1M1M1MkIjIjIjISISISISISIjIkMkMkIjIkIkIkIkM1M1M1M1M1RGRHZ6iLicicZ5VYM1M1M1M1MkIjIjIjIjISISISIjIjIjIjIkIkIkIjIjIkIkIkM1RGRGVXVXZoeLicisecaKV5RXM0M0MkIjIjIjIjIjISISIiIiIjMkMkMkIkIkIjIjIkM1RFRGVYZpZpdpd7h7mLmceLaKV5VoRGM0IjIjIjIkIkIkISISIiIjIjIkIkIkIkIkIkIjM1VYZpZpZ6Z6d6d6iLiLiLmcmciLd7ZpZYRFM1M1I0IkIkIkISISISIjIkI1I1I1I2I2NHNHNINYNYRYRoVpZpZpZpZqd6d6d6ZZVIRIRHM2M2M2M1M2IkIjISISISIjIkI1I2NHNHRINYRZRZRpVpZpZpZqdqZpZqZ6Z6Z6d6ZqZpZZVIRHM2M1IkIkIkIkISISISIjI1I2NHNHNHRZRYRYZpd6d6d6d6VZeKicZ6eLd6d6ZpZpZZVZVYVYRIVXRGQ1MkMlISISISISM1NHRYRYRYVpZpd6d6d6Z6ZpVYd6vOvOq9iLq9q8eKZpVZZZZpZZZpVHRGM2Q2M1ISISISISISM2RXRYRYZpd5VYRIZpd6mcmsiLiLq9vNu9ibd6qKeLRIZpd6dpZpVYVYVIRGM1ISISESISISM1RGRZVpZpQ3d5msiLiKd6eKiLd6VZu9u8qseLmsd6ZYd6ZpZpZpVYVYVYVIQ2ISISISESIjIjVXZpZpZpd5ZpRHVHZYibq9q9vNqsZ6qsvNusqsd6VYVpZpZpZpZYVIVIQ4Q3ISISISESMkQ1RGVXZYVYVHM2d6iKmbmcmsqKq9q9usdpZ6mcq9uKiKVZVpZZZpZZVIVIQ3Q2ISISISIiM0RGVGVGVGRHVYQ3M2VYVYZpZpd6iLibiLh6Z6VZiLiLRHRIVZVZZZZYVYVIVIQ3', 'base64')),
  ('c087', decode('U3Q3VZVZRIVZQ4VJVIVIVIVHZYVHZXVHdWdFdVZFZGZFZEdEczczczhEhVdVdWZFdHdaVIZKU3Q3ZqVZVIVZRIZZVIZYVZZIZpZYdnZpdXdWhlZWdFdVhUhUhDlDhDlUlUllhVhVhXhZZHZJVHVHZqVZVZZpVIZpZYdpZpZYdpdnZWRGVXhml2dWhVlUlUpTlDpTpkt1t1uFuGlUhmlphZdaVHVHZ6VZZZZqZYdpZpdpZqZoZpM2IkIkIlMlZWVGdVpkpktjpStjtjtztztzt0pkp1lnhphqVIVId6ZZZpdqZod5Zpdpd6doZoIlIlMmM2M2IkIlIldUtztztjxzxzxzxzxztzt0uFuHlolpZYVYZqZpZZd6dpd5dph5iKdoZXQ2Q2ZYRHZYQ2Q2Q2Q1lkxztzyDyDyDyDyDyDuEuEyXlmlpZYZYZqdpZZd6d5h5h5l4h6dnZoVHZYmLdph6ZYdpZYVHhlyDyDyT2U2UyUyUyDyDuEuFp2lnZoZYZqZYVZh6d5mKl4mImJmIZXZYh6hpiKh6ZYZYM2M1hlyDyDyk3Eyk2UyUyDyDyDp0llhlZXdoiaiJh5iKdpqJqJqZuZu7doVHZIdpmcmLh6mLZYQ1djyDyD3F7l3Fyk2UyEyDxzpzlkhly5u7mau7qqu7mJqZupuYy6zLh4Q2Q2dpmLh6ZoZYVHVHZUyDuD7V7l7VyU2UyEyEt0t0lkhV3Ju6mbu7u6zLqZqZupy5y7u7h3IlQ2h6ZoVHU2dHhpVGZVyDuD3E7V3FyU2TyDylyVyWqHhmmId4mKqpmamYqZy6y6y7iIMjESIUQ3Q2Y2pJ176t6t17ZXlkxzyDyluEyDyDyl2luFqFqGl4ZoVYiId5qqmIupyp3M3dMjERIjM1Mlg36t6t7O7O7O17doh1tixzyExzxztzyVyVp0hDdUl4d5VIVYZYqZmZup3M7uu7IiERRFM1g35r6t7O69696t1bdHdltitzyUyDtzyEyEyVpThDY0U1d4VIZZmbqaqru7y7y7qqESRFVXZYc36M7O6d5818p7h6dYZWuUykyUyDym2lyVpTlDc0ZEVFd5VIZYZomJqZururuqmIESM0VHVHc36MyMpqtrZWZmMzQ0Zol1yUuEyVyFp0uFhDczY0U1QkVYVXZXd3ZXh4qJqZh2dmERRFRHRHZIl6mbZWl4dEhWUjMSIkhlqFqFuFpklklUczY0U0VGQlQ2VHVHRGVZZpdXdWdmZWERVXVHZohop5l4l4urqZqJyrhFhUpkp0pkllp0gzYzY0QkQ1MlMVMlMVMlM2VIQ2Q2ZGdmZWERRGISQiuJqJl3l3uaqql4qJdmQzhFhVhUhVdDYzUkQkQlVGMkVIMVMlIUM3Q3QmQ2hnlmZVABM0ETQjqIury8uryauJu8uaVEIjVFdmhWhWU0QTQkMlQ2RHIUU4IUIDQlU1U3dXZHhWdWREIjM1EUIkQ0hnqJp4qIp4qJVFVFIkRFdndWdXU2QmMVMVMlIlMmQ4QmU2VIZHZIVHZGZHZWIjRFZoNFI0I0RXVXZFiIZVRGVYI0M1VFVVZWl2l3ZXZZVIU4Q3ZZVIQ4VIVIVIZIVIU3VGIiRGRGVXREZpRXRHibiKqJZVeLZpRGZpIlM1VGQ2dZdZhodXZJZIh6U4Q4Q3ZZVIVYVIVWRFQ2VXQ2M2d4Z4eKd6eKibmaZom8ZpeKVXM1VHVGZmU4dadadqhol6dpQn', 'base64')),
  ('c088', decode('EQEQERERERIRIhIRIRERMhMhIRMhMhIRIRERERIRIRMhMhMhMhQiIRIRIRIhIREREQEREQEAERERERERIRIhMhMhMhIhMhMhIREREAAAAAAAEAEAEAAAEQIhMhMhMhMhMhMhIhIREREQEREQEQEQERERERIRIREQERIRMhMhEAAAAAEAEAEQEAEQEAEAAAAAIRMhIhERERIRIREREREREREQAAEQEQERERIRERAAAAEAIREREREiESEREREAEQEQEQEQEQEAEAIREREAEAEAIhEREREREQAAAAAAEAEQERIhEQEAEAEAMhIRNWrem9isaJRnJEEjEREREQEQEAMhEREAEQEAIhERERERAAAAAAAAAAEQERIhEREQEQERQzREV4i8nNrevezuzurNaJEREREREQQyEREREREQIhERERAAAAAAAAAAERERERIhERERERIiZ3aJV4WJaJaaebesi9nNaKM0IRIRERQyERERERERIhEREREAEAEAAAEQERERERMhERIRMiM0eZaaaJeaeaibmsibibicmcd5REMiERQyIRERERERIhEREREREREAEQEREQERERMiIhMiNERViaaaaKicibibicibibiciceLeKRVIiQyIRIRIiIiMhIRERERAAAAERERERERERQzMiMzRFRVeaaaaJebebibebebibiciceLeKVmNEVUIRIiMyIiMhIREREAEAAAERERERIRIhVEMzNERFRViaaJaJeaebeLebebibeLeLeLeJVnRWd3MiMzREMzMhIREREREQEAEQERIRIiMiZUMzM0RERFiZaJaJaJebebibeaeaeKaJeKZ5VnVmiIRDMzMzIiMiIREREREREQEAERERIiMiVUREVmaIRViZaJaIaJeKmrmrmrmrmqmqeJZ3VmVmiIVVVVVDMiMyIhEREREAAAERERIRIiMiVUQzeIeJVWeIeJeZiZeIaIeJeJeJeIeIZ3eIeId3iIREIiIiIRQyMiEREREREAIRIiMiIiMiVUMzd3d3VVd3VnRVRWRWRnRnRmRWRWRWRWNFNFNEd3REMzIiIiRDQyIRERERERERIRIiMiMiZUMid3d3VVd3VmNFRWRWRWRWVnZ3RWRWRWRFRFREd2REMiMiMiRDQzIRIRERERERIRIRIiMiZVRDVUVVVVZmVWRVVVVVRWVWeHeHVmRWVmVVVVRFZmVEVUVUVDVEVDIhIhIRERIRIRIiIiMiVUIRIiMiMzZlVVRUVVVVVVRWZ3aIRVVWVVVUVUREZmQzMiIiIRQzRDIhMiIhIRIhMiMiIiMyVUIiIiIiMiZVRVREVEVUVVVVZ3Z3VWZVVVREREREZVQzIiIiIiQzVDIRMiMiMhERIRIRIhMiVUMiMiMiMiVURFREVEREZkZliXu6d2VURERDRDREVVQzMiMiMiRDVDIRIhIRIRIRIRIhIiMyVUQzQzQzMzVUREVUZVVUMzMzREVUVERDRDQzQzMzVUQzQzQzQzVDVDIRIiIRIRIRIiMiIiQyVEIiMiMyMyVEMzMiMiMzQzQzRDQzQzQzQzQzQzMzVEQzMiMiIhMyVEIRMiMiIRIiMyMiIhQyVEIhIRIhIiVDMzMyMyQzQzQzQzQzQzQzQzQyQyMyVDQyIRIhIRMyVUIRIiMyMiMyQzMyIRQyVEIiIiIiMiVDMzMiMyMyQyQzQzQzQzQyMyQyVDVDZDQyIiMiMiQzZUIRMiQzQy', 'base64')),
  ('c089', decode('gRcRcRYRURURQRQhMRMRMRMRQRURcigigiththUiURURURURQRQRQRQhQhQhQhQhQRURYRcRYRYRURURQRQRQRQRURYRchkioioikRgRUhdShjQRQRQRQhQhQRQhUhYicigikioioRoRoRkRURURURYRYRgRkRkRoRoRkRgRcRciURllUidBhjQhdSURcigikikioikRkRgRgRcRcRcRYRYRgRkRoRoRoRkRkRgRcRYRURQRQRliZBlihkhSlkhCpikyuWcRYRYRURURQRQRQRQRQRQRQRQRoRkRkRgRcRYRURQRQRQRMRMRQRlBpzlSuEuDyDtylRtylSQhQhQhQhQRQhQRQRQRQRQRURURcRcRYRURQRQhQRQhQhUhcipEpTtzpiyClBthyCpRxythpihSdDUiQhQhQhQhQRQRQRQRQhQhURURURURQRQhQhYhgRgRpltyxylSlBxxyDxxyD2VyEtRti3IumlTcRYRYRYRURURURURURQRURURQRQRUhchkRcRUhYyp0ljylyDyDuEtixyxytytzyD2mymuEljdDYRcRghkRoRoRoRoRkRQRQhQRchkRcRQhQhYyl02m2kyDthtyxytxthtitzyTtzty2k2jtypyZCQhQRQRURURYRcRgRQRYRkRcRURQRUhdDlj2kuC2R25xzyDyF2m7I232Vt0pSty2ophth2TtyhkQhQhQhQRQRURURkRgRYRURURURQhlSyTyBpypRpRpR6R6i2B6R2S2A6S6jtythxythyCyCuCUyQhQhQhQhQhQRcRURURURURQRUilh2S2RyByDtRxh6R6j6i602S/F2T61601xyDyDty2jyTcyQhQhQRQRQRQRURYRURQRMRQhUipy6z2lyC60tR6l2m7J247b2T7s7b/t2S2B632n223JyVYyQhUhURURURURYRURQhMRMhQhcypy2kuDyVtiti7a2n7c24yp7cyouFypyDxxyDtztitzpiYxQiQRURURURURURQRMRQRQhQhdC2n2ntz2nlStiuFt0pjpipSpRtiththxxxxtitiththphlkQhQRQhQRURURQhQhQRQRQhUilSuExytythlRpSpStRtitixytzxytixhxithxhtRthpRpipjdDURQRQhQhQRQhQRQRQRQhUhlRlRpRyBxyxxxzxith2U2V2m2n2VyEthxhxh1xtRtRpRlSlRYhkRgRcRQRQRQRURQRQRURcRcxlRththtyphyBxyyBty6j2k2kpipRxxxxyDthti2CtzlRYxQRgRkRkRgRYRQRQRQRUhoikRQRcxlRphxxyBtxtyty2T2UtzyD2l2kxyphtxyBpRthljcxMRQhYRgRkRoRkRQRQRQhoioRcRQRQhpzyD61pSyUtytiuF2k/X/XyTpzlSty2juCyByDhSUxURQRQRYRgRkRkRMRQRkioRkRURMRQhlSpjtjtixh2E24typ0pzuDpipRynyFphphphlRlRUhgRcRQRQRYRgRkRMRgioRkRYRQhQhQhQRUhhB2RyD/XyUpyUhtSljUhYhyC/W2mylhBQhQhQRgRkRcRQRQRYRgRcRsRoRcRQRMRQRURURQhpRyU247KyVphUhYhUhUhhCuD7H3I2mpiQhQhQRYRkRkRYRQRURYRoRoRkRURQhQRURYRQRQhlRtytzthpBUhcRkRkRcRchhCp0pjpilRQhQRQhURcRkRkRYRURUR', 'base64')),
  ('c090', decode('MiMiMiMiMiMiMiREqJl4uaVVMiMiMiMiMiMiMiMiMzY1VVRWRFRVNEMzMzQzREVWREMzMzMzMzMiMiMiMiMiMiMiVFlol5uaREMiMiMiMiMiMiMzVWVGRWNFNFRWRWM0MzREZnmKd4QzQzMzMzREMiMiMiMiMiMiMiVFhohouqmIMzMiMiMiQzdnd4RWNFNFNFRWRWRWMzREiK7umZRDMzMzMiQzQzMyMiMzMyMiMiMzVFhnhn2rdmMiMzZmd4RFNFZnVmNURVRnRFRXREMzVWiJZlQzMyMiMiMiQzVEMzMiMiMiMiMiVEdWdGqJp4MzdmQzRFNFNUNUZ3NVNFRXRFRFVWMyMzRERDMyMiIiMiMiZFZGRFVFREQzMzMjVFdVU0hn2bdmMiMzRFNENVRFdoNFNFRWRWVVdWM0MiMyMyMzMzMiMiVEdGZWh4dmZWZWZWREMzMzMzZF2suaVEQ0RWM0RFVWRWNFNFRWRXlnZFVFMiMyMzMzMzMzQ0RFZWdnZmZWZWZWZWdnMzMzMzQzt51Z1p16x6pphohoZnVXRWNFRXhnVFRFREMzRDVWZXVFZWZnZndnY1ZWZWVFZWd3MzZVl4h3161Z1p1q1p1JxJxZxZxZtZtppppplod4d4MzQzZnqrZXh4mJh4l4dnd3dnVFZWdnVVxp1Z2L1Z2b1q2L1J1Z2c7e292sxqw4s4s4s4o4pZZWMzREZnZXZnZWZWdnZWVFZWZWdndnlo1Z1J2L6s1q1Z7N1Z1I1I2b7exZ2Ls4tJs4o4pIk4dnMzMzVWh4dnZWZWdnZWVFVVREVWdnxp16166c691I046s1I1J2LyLxqxqx6ysuLpIk4k4hIVWMzMzQzVWZmZnZWdndXVFVVMzVVt51q1I1Z1J6s2s6b2L171pxI3N29ycyLuLqblpp6lpdnVWVWMzMzVVdWhXZWZndWVFVFMzhnxJ1Z291J2L161J6b2Lybyrtpt6tpt6ubp6lphodnhneJiJh4ZmVEREdGdXVVZmZWU1VFQ0xZ1Z1I6b2c2s1qxqxp28xZuLtqpJo4o4pZhYdWdVZFVWZ4VnRFREVFdmZGZWVVZmZWRERElXxp2sxZxp2b1ZwowowotJs4s4o4k4k4hYdWZFVFRFVmVmZ3Z4RFREQ0IiVWZWVFZWZWVVh4tpuK2LxZ2Lxqxqw4w4yLy8o4o4o4hYZGVFRFVmRWNVRWNEM0Z4RFRFQ0Iidndndnh4h4dntps4xaybx6x7x7xJx6ycuLy8pqdHVEMjVEQ0RFRmRVNERFNFRFVmRFRFM0IidnZWVFZmZWlos4s4xq2ss4s4s4s4yby9ubushpRFIiIiMiVEVEM0REVVVWZnVVMzNERFM0IiVWVVVFZmdntJo4tqtJtJo4o4o4o4t6qsh5VFRFRFMzMzIiMzZFZWVFMzMzMzQ0Zmd3RVNEIiVVVVRFVWppo4pZtqo4yLo4o4lYdXZWVFRFM0RFRFMzM0ZmMzVFZFREMzM0M0M0M0M0dnh4ZmRFVFRFdXo4o4pZt7pZlZhoZWREM0MzQ0RFMzRERFM0Q0VFh3VFMzQ0REM0M0M0MzM0M0Q0MzZFZGQ0dXk4k4lZlYdXVFQ0MzMzM0MzMzRFMzRERFMzqay8mHVFMiMzQ0Q0M0MzM0M0M0M0MzVFVVREREhHhHZWVFMzIiMzMzMzM0MzMzRFM0RERFmZ7e7e3NZVMzMjMjZFM0MzMzMzMzMzMz', 'base64')),
  ('c091', decode('Q0MkQzVVZnhm2YZVU1iGZFZFZGhWuYuIp3lnhnlnp4p4p3p4qIuJyZyZ2p2J66+66p26yIt3MkMkMkU0p3t2h2Q0Mjdlh1VEVFl4l3dWhmp4p4t3x32H526It3uIuI2I2Hxo6r6K2I2H6ptWQ0Q0Q0ZFdVdVQ0MzdnZniGmGVFdGt3t3x22H2G2X2X2G6X6X6oqIt3yIt4xo151ZlW1V13dWQ0Q0VFZWmGZFMkQzdVZVl2hmtm12122G2X6X6X2G2X2X6X6H6ppndGuJuI2YpXlGpnp4tVlnQ0MkQ0Qzd1mGVUc1xnt3lWtWx2x213122H2G6X6X6X6H6I6I64hmdXlnZGQ1Y1c1dWyZpnx3MkM0U0Q0VWiGh2U0pW2olnxVx26H6H6H6H6H6H53126H2I12xmdWZFZGU1MkQ0U1U12Y6o28Q0VEQ0VERViHmHM0hW6ptn1V5m6H5312xm1VtFlElFlWhFlWp3dWMkVFZGU1MkU1l36Y29ysQ0VEREVEVWZmZUMkU16XpW1lxVtVpFlFg0hFtnx32H6Y6pyIlnhnVFMkQ0U1dWyI6Y29y9usMjQzVEMkQ0Q0MkMkQ0tldFhFc1lGpmyH6o64+5+4+5/K+66plnhndWU1MkMkMklV6829uc29QjMjQ0VEVEVEQ0MkMkhFtW1m6X+5+5+5/J/J/K/J/K/K+66pyIp4p4lndWZGhF6Z29qs29y9MkMkMjQzhFpXlGU1Q1pW5l6o/K/K+5/K7K65656o6o6Y6p6p6ZyHuIuIp4p42Y2rqsys29qtQ0MkMjY0tItYtohGlFhF5V65/K+56p6Y6Y6H2H12136H6Y6p6p6Yp4p4p4x328urqc29u9h6Q0MkQjpHxoxoxYc1c1Y11V6H2G6Hx2x213x21212136H6H6p6p6px3p4p36putqc29y9iLl4Q0MkMjk1xYtHo2VFU0ZEU0dV6o1m121213121212x2136H6H6Z6p6Ztm2G28mc29qcd6pmp3Q1Q0MkUklGlGQ0IkIkMkMkY0tU7L1m13x2x212x213136H6H6H6p6p2H2Zqsyty9iLMkVFhVU2Q1Q0Y1dFQ1M0M0MkIkMkMjhmt2x213x212126Hx26H6H6H6H656HyHusus29ibMzIiIiIjU2U2QkU1RGRFRFRGRGRGIjIkVFtV656Hx26Hx2136H2H2H2Htm6X12qaususZoIiMjIiIjIkU2U2Q1M1R3RmiZRGZ4VXM0MkMj136o2H6H6Hx212136o6o6Y6Y6otllmdnM0IiIiIjI0IkIkU2U2M1M1RGM1RnRnmpRXVXMkhE1V6Y2H126H6H6H6H2X+565/J6oRFIkMjIiIiIjM0IkIkIkU2Q1M0Q1M1M1Q1VWRWWId4VFU0dW13yG2Gxm132H6H6Y/J/K/KqadGIkM0M0NFNFIkIkIkIkQ2M0M0MkM0M1Q1RGM2VWVWRFM0U1t4pWtHtHtG1W6H6o+5/K6513xWU0IkIkIkNFMkM0Q1Q1M1Q1M0IjIjM1Q1M1M2RGRFZnRGU0pntHtHtYxotH1n6Y6Y6H525VxVg2U0Q0IkNFMkQlM1MkVHd5VXIkIjIjQ1M1M1RFMjM1MkdGlWs31o1Y1otHxW1n1m1m1mxmpnlWhGU0MkM0MkMkMkQkZpM1IkIkIkIjM0RGRGM0MkM0Q1ZFpntHtXxYxopXt4t4p4pnpnpnlnlWZFZFU1U1U1Q1Q0Q0', 'base64')),
  ('c092', decode('mamamamamamZmZmZmZmZmZmZmZmJiJiIiIiId4d3d3d3dnd3d3d3d3d3dnZnZmZmZmZmZWZWmamamamZmZmZmZmZmZmZmZmJiJiJiIiId4d4d3d3dndnd3d3d3d3d3d3ZnZmZmZmZWVWVVVVmamamZmZmZmZmZmZmZmZiJiJiIiIh4d4d4d3d3dndnd3d3d3d3iImZd3ZWZmZWVVVVVVVVVVmZmZmZmZmZmZmZmZmJiJiJiIiId4d3d3d3ZnZnZndnd3d3iImZmZmZd3ZWVVVVVVVVVVVVVVmZmZmZmZmZmZmZmJiJiIiIh4d3d3d3ZnZnZnZndnd3iImZmZmZmamad4ZWVVVVVEREREREVEmZmZmZmZmZmJiJiIiIh4d4d3d3ZnZmZmZnZnd3iImZmZmamaqqqqqqiIVWVVVVVEQzREREREmJmZmZmJiJiJiIiId4d3d3dnZmZmZmZnd3iImZmamaqaqqqqqqqqqqiIVVVVVVVEMzQ0REREiIiIiJiIiIiId4d4d3dnZmZmZmZndniImaqqqqqqqqqqqqqqqqqqqqiJVVVVVVVEMzQzREREZmd3d4d4d4d3d3dnZmZmZmZmdniIqqqqqrqrqrqrqrqqqqqqqqqqqqmZVVVVVVVFMzQzREREVFVVZmZndndnZmZmZmZmdniIqqq7u7u7u7u7u7u7qrqrqqqqqqqqqqmZVWVVVVVFMzQzQ0REVVREVEVVVVZmZmZmZniJqru7u7u7u7u7u7u7u7u7q7qrqrqqqqqqqqqqd3VVVVVFMzQzQ0REZWVVVFREVEZWZmiIu7u8u8u8u8u7u7u7u7u7u7u7u7qqmZmaqqqqqqqqmZZmVVVFQzQzQ0REZmVVVVREVVd3urzMzMzMzMzMu8u7qqqqu7u8u7qqmaqqqqZmiJqqqqqqqqmZVVVFQzQzREREZmVVVVREVVmZzMzMzMzMzMzMzMu7u7u7qrqqqqu7iJVVMyMzZmmqqqqqqqqqiIVVREREREVFZmVVVVREVVqq3dzMzNzMzMzMzMu7u7qqu7qrd3QzMiREdmd3MzVVqqqqmamamZiIVVVFVVZmZmVVVVREVVzM7u7u7u7u7uzMu7u7zMmZZVMiMzZWd3ZmREVVd3mZmamZmZmZiId3ZmZmZnd3ZnVVVVVEVV3d7u7u7u3NzN3dzMiIREIiVVd3ZmVFVFd3mZmZmZmZmZiJd4d3d3d4d4d4d4iIZnVVVVVEVV3d3dzM3d3dqqZmMzREZmZmVVREd3mJmZmZmZmZiIiId4d4iIiJiJiJiJiJiJiJdnVVVVVFZWurzMzMiIREMzZmd3ZmREZmmZqqmamZmJiIiIiJmZmZmZmZmZmZmZmZmZmZmamad3VVVVVFZWiIu7MzREd3dnVVZmmZqqqqmamZiIiIiJmZmamamamamamamamamamamamamamad3VVVVVVZmd3qqqqVVZmiJqqqqqqmZiJiJiJmZmamamamamamamamamamamamamamaqqqqqqd3VVVVVVZniImZqru7qqqqmZmZiJmZmamamamamamamamamamamamaqqqqqqqqqqqqqqqqqqd3VVVVVWd4iJmau77uzMzNu7qqmamaqqu7zM3dqrmamamamamamaqqqqqqqqqqqqqqqqqqqqd3VVVVZmiImaqqzM//3d//////7u7u7u7u7u7u7u3dzMu8u7qrqqqqqqqqqqqqqqqqqqqrqq', 'base64')),
  ('c093', decode('MkMkIkMkIjESERIiIiIiNENXNXNYNYNYNoNpNYNHM3NYNZNHNXNodZV3V3R3aHeWaHRXNINIMlMkIkM1ESERERIRQyQzRENGNYNYNYNpNpNpRpRpNHNXRWaJeJVpZIVnZ3R3R3aXeneXRYRIQlMkM1IjERERMilV2W65ZmNENWNoNoNYNoNpRpR5NoNYRXhlVIMlISUzhEiXeneXWHeneHdpQ1MlIlIiISMiVEpmt2uXmYNENGNYNoNYNoNpNpNpNoJIM3ZFM3ESIBUjpllVeIWIRoR4eXd4Q2Q2IlIjUzMzpmyHyHpmmGRVNFNXRpRpRoNpNpN5NoNYNYVFM1IkMSY0hVhmR5WLObRoV4eIQ2RGMlI0dEdEpm2Y662ouXVlVVVlV2V4RpRWRXRnNXNXNnRXU2RHY0QjlVhVI2VZN8OLWIiYRHRHRGNXU1dEpWx3652Xp2eFZlVlWIWLRHM0ln25eINXNXNIZmNGU1MjMSdVVpNIJpOKenaXV5VoRoM1Y2Q0hF2H2XdEhnZndmZ1aKWcQ1Q0pnyHupNoRYRYZnRIRGZEIURGQ4JYNpRpaHWIZGNYRYI1UlY0QillyHhFl3eHd2Z1aHe8hXhFuIyYqHNXRXRpR4Y3U4RoQlVZM2RpaYaYeXaYRHRYNZV6NFU0MiMiZEp2yHZ4Z3Z2aGabdpdFt3yXl4R6RZM4VXVnhrZ5Z4ZJNoVoeni3eYWIRIVqibaKZ6M0U1ITIjQzt3l4RnV2eHeJdodFhVlVabWLR6RJRJQ1h4loaKZpeaaYeYi3aIaIV7adibq8aKZ5RWMkM2iJh4RYRXiZd5VodFlFQ0ZVq7ebY2k2UnM1lmpoeJRpiaeYeYaYV4aYd6XNzumsaLibabiaeJrMiJV5Z5doZpVGdnVYNHdpiJu7iKVYU4ZElUpmaKmKmJaYeoeneYaYlpesvunNaLvNibm6rMrMdohpZHRHRYhnmHepmairZ5R6aZVodXhDhEuIuap4p4eIaIeYeYaZNZZ6isisaLmrebibq6WKNHUlMmM2VamczeftZpM2IVVHeIh5l5ZXM2tm12xmp4aIWIaYeZeKR6WKibVpRZebWbe8rLeKM2M2MlRJZYi8d5iJuGVGM2U2Y3pZpqZYuqZXtVtml3eHWJeYaJaKZYiKmreKIlRZZpW8rMq7RpZqVqV4Y0hUh3hlqIVGIlEkM2Q3Y3RpSLRYVGVGVYZEeYeZaJeJZYZpibZ6NINZVpdpmrZoRqebisiJeKaaY0hVhmdEZFRGJGI2ImM3VHVXY0ImZIlHd3aKeZiZVImKqsirVGJZV5Z5ebVGNZacacibabMkUjUiYzZWd4ZYRYM2I1IkRGQoY0InUVZIlbV7WKeYI2I2I2JZNrJZNpN6Z7Y1M3VpZ7ZoRYMTU0ZWUjZomIl5M2RaMnQVQWUnY0RHUlcVQ3lpWHaXETEUI2RpacRZNINqVqY1ImVZeLQlRoZ5eKVHVGhnmoaJMlQ6N7QXUpYmQ3VFMmklQVMmhmaEMUEUM3ZqisV5ebiseLZ5eLRHesmsq9VYQkZnM1d3eJRYMnIWM6RsR7ZpNIQ1InglkVMWc4ZzIlNHRpd6VYeKrNrerOveiKRoicmLmceKaKZXYjVoabNIMnEVQWQoU5Y2MnMmVVdkpTUlU2h2NIQ4eaebNGZ6abeLeLd7VpImRqNZRZRIRYQ3Q1QkdlQ4MWIVUXYUgTY1MoMnVFeTnCeDeDmF', 'base64')),
  ('c094', decode('IiIiIiIiIiIiIiIiIiIjIiIiIiIiIiIiIiIih37bx1IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIimI7K2FVDIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIyEyEyEyEyiH651ldDIyIiIiIiIiIiIiIiIiIiIiIiIhIhIiIiIiIiIiIiIiIiIyEyEyEyEyEyEyFCFCFCVk2HxDlDEyEyIyIyIyIyIiIiIiIiIiIiIiIhIiIiIiIiIiEyEyEyFCFCFCFCBCBSBSBSBSBSNk2GxDtTFCFCFCFCFCIyIyIyIyIyIiIiIiIiIiIyIyEyEyFCFCBTBTFTFTFTFTFTJTJTJTJTR1651k1lFTFTFSFSFSFCFCFCFCEyIyIyIyIiIyIyFCFDFTFTJTNTNTNTRTRTRTVTVTVTVTVSd0651k1kVTRTNTNTJTFTFSFSFSFSFCFCEyEyJCJTNTNTRDVTVTZTZTdjdkhkhkhkhjhjhjhjl06XxDxDhidiZSZSVSVTRTNTJSJSFSFSFCFCRTVTZTZTdThTlUlUpVplpltltltltltltltlx26oxD1UtjpjljljhihSdSZSZSVSRSNSJSFSdThThTlTpUtVtltmxmxmxmxWxWxWxWxWxWxW2I661k1kxkxUtUtUtUpTpilSlShSdSZSVSNSlTpTtktkxlxmxm1n1n1X1X1X1X1X1X1o2I1n6X6XxDxD121n1313x2xlxktktjpilSlShSdStjtkxlxm1m1n1n1X1X1n1o1o1o1o5o66/t7K6X6WxD1U121n1n1n142I2I2H2Gx1x0tztzpix0x1121m1m1n1n1n5o5o5o54556a6p6o/b/c7K11xU2W1l545o5o1n1n1n13132H2GyFyEyD11121m1m1m1n5n545455556J7L7K636o7K7c2GxDxDxkxU6I555o5o5o5n1n1W1m1m122G2E111l1l1m535354546J6J6Z676363636C2F1lxDxUpDtD11136a6K5555545o5n1n1W1V1l111k111152536H6I6I6J6Z7L7J6n6U2F2F112G1kxUxU122H2Y67676r6a6a6K545o1n1m1m1l1111526G6H6I6I6Y6Z6p/d7c6V107c7K2F2WxU6p656p647L7L6p7M68676r6a545o5n1n1m11116G6G6H6X6Y6o65647L7b642G6oxU1UxkxU656Y6Y6X6n6nxU657M7M7M686r6a6J541n116F6F6G6X6X6o7K7b6565/b7bxlxTxDxDtD11xk1l1111xDxDxD1k7L7c7M7M7M686r6a146E6F6F6W6n647K7b/b7J2G7K6oxUoywzwzxDxUsytDtDtDxDxTxDxD657c/c7c7M7M7M686q6E6F6V6n64647J/a/a7J1lxkxDxDxDszxDxDtD1V12gyYikixU1kxD657c/c/c7c7c7M7M7M6E6F6W6n647J/Z/Z/I/H6nxkszxDxTozsztDgikzpEgioisz1U1U127b7b/c/b7c7c7c7M7M6F6V6m6n6m63/H/H7H7J656XoyszxDgycicigikioisyxD1k1k117K7J7J7J/a/a7K7K7L7L6F6W6W6l6l62637I7J7a7J656XtDkioioikioyszxDxU1U1k1U6o7a7Z7I7H7G6160616465', 'base64')),
  ('c095', decode('fPfPjPjPnPnPnPnfrPrPrPrPnPnPnPnPnPnPjPi/i/i+nJnInIi3i3inWYjJjIjIeXN3N3JmfPjPjPnPnfnfrfrfrfrfrPrPnPnPnPnPnPnPjPjPjOi7nInIi4i3i4inaXi4jIjIeXR3NmJWjPjPnPrf7/3vvfrfrfrfnfnPnPnPnPnPnPjPjPjPnKnInInIjIi4i3eXaXi3i3aXV3R3RnJmjPnPnfnfrfzv7/3vrfnfnfnfnfnfnPnPnPnPnPnNnInInInIjIi4i4WGR2R3R3R3R3WHR3Nmvfnfnfnfnfrfrfzv7/3vrfnfnfnfnfnfnOnNnNnKnInInInIjIi4inR3R3V3aHR3aXeXV2Nmzv7vzvrfrfrfrfrfrfzv3/zvrfrdrerMnJnJioinnInInIineXWHR3R3R3aHeXeXeXaHNmNWnfnfrfzvzvvvrvrvvvvvrezuztrKrJnJrJeoeXi3nInIeXWHR3N3N3N3NnNmaHaHV3NmNWJWrfrfrfrfvvvvzvzvvvvdrLrarJrJrJrJrJi4i3aXeXWHWHR3N3N3N3NmJWR2eXaHNmNWJWJGrNrerevuvvvvvvvdvbrJrJrJrJrJrJrJeXeXenWHWHSHR3N3N3NmNmSGR3R2NmNmJWJWJGJGm7m7m7nMnMrMrarZrJrJrJvZvZeXioiXeWiVeWaXaHR2R2R2V1V1enWHR3RmNWJWJGJGJGFFm7m7m7q6rJrKrJrJrJm4q4zYvHvFvFvEzFzFvFqzmkmTiUiTiTeVR3RmNmRmJGJGJGJGFFE1m7m6m5rJvavZvYzXzY3X3W3V3V3F3W3XzWvFq0q0u1q0qzq0qkmjiTeEV0NVJWJWFGFFE1E1nKrJvZzYzXrHq37n3WzVzV3F3F3F3FzFvEvEvFzGzHvGu1q0qzmzmjmkiUZ1JWFFE1E1E1E13n7n7n7n3o3Y7Y3WzVzFu1zGvFvFzGzGzIyouXqYupupy6zJq3q3y5you4u4d2h2h2Zmdndn7m7m7m7n3m3WzVvFu1u2yn3Ju33J7b25mHVVREREREREVEh2ypu4u3y5y5y5qXmVuol2mYqY7n7n3mzVzGvFu3u425ypy53K3J3Ky6ZmVFREQzMzQzZUQzQzVEqpy6y5y5u4qmiUqoh2mIup3Y3Y3Iu1y6ypy6y4y5upy53K3Jy7ZXRFQ0MzVEMjMiMzMzMzVEQzqpu5u4u4qliUmWdlmHupy726y5mku6ypy6qly5uoun3KzKh4RFM0MzMjIiIiQzIiIiIjMjMzZUu5uoy5mliUeFdmmYupy726y3mkqoypy5mky5uou4zJy6VXQ0M0IjIiIiIiIiIiMzIiIiIiIih3qouomkiUZ1dnqYupy6y6u2ijmnupu4mkqoupuoy5mZRGM0MzIjIiIiIiIiISISIiIiIiIiVEqYqXmkeEZ0dmqYupy6y5qliTmWupqniTmnqYl3uoh4RGM1M0IjIjIiIiIiIiIiIiIiIiIiMiqYmXeEZzV0dmqYupu6y5qmeTiWqpqneTmXmHdlmIdnRGRFQ0M0IjIjIjIjIiIiIiIiIiIiIih3ZDVzVzVjdmqYmIu5upqmiUmWqXmXeEmHiHd2qHd4VWVFZVREMzIjMjVDIjIjQzMjIjQzIjmGdlVzVjVkdmmIh3u0u0u0u0u1q1u1u1u1u2u3unmYd3ZVZVVFREREVEVEREREREQ0Q0REdzmFh2ZzVjVjZVdmdn', 'base64')),
  ('c096', decode('ESEjEjI0I0IzIiEiIiIiIjREREREQzESESESESEjEjEzEzEzMzQzI0IjEjIkEjIjEjIiI0EjESEjIjEzEzEiIjQzMzMzIiESESIjIjEjEjEkEkEkEjETEjEjVFMzI0IjEjIkEjEjEiIiI0EiESIjIkEzEzEjIiIiREIiEiESEjEjEkEkEkIkIkIkIkIkIkEjM0QzMjMjIjIiIjMjIjIiIjIiESIjIkEzEzEiEiEiIjMyESEjEjEkEkEkIkIkIkIkIkIlIlIlI1VFIzIzIzIzMzEiESESIiEiESIjIkEzEzEiIiIjNERFRFI0I0I0ETIjQ0IjMiQjMjIkIlM2I1RGNFJFNFNEEjEjEjEiIiEjIjIjEjEzEzEiIiIjiKvMu7maqr3tdmzMqq3LiJ3MvMypRX7uqJib3eu7RFNFE0E0EjEjEjEjM0NFEjEzEzEzIiIiIkq8h3Z4u73th4zLU0zdqa3dzMypmru73MM2vNZWJFE0E0E0EjEjI0EjESI0I0FEJEIzMzIzM1irVEeJu7u7h3y7zMypmJqHdoqZq7l4urZXmrVGE1E0E0E0EkEjI0EzETI0IkFEEzEzIiEjVXiJiJdmeJmZqYdmuquqhVmJuqqIZWhmZ4h4d6iJNFE0E0E0EkE0I0IzESIjEjEzEzEjIiIkq9qIiKypmZu77bmJzM3dypu8y77uqayqq83NqszNVWE0E0EkEjEjEzEjESIjEjEzEzEjIjIkmsuqqquZmZu77cu83MzMqa7uy7y7mJ2pq8uqy8q8VmE0E0E0EjEjEzEjESIjIkEzJEIzIiEjNGZodnZUZmd2h3eJq8zevNrNqrmJZWdUVWU0VXZ4NFJFE0I0I0EjI0EjESIjI0FEEzEzIiETEkM0IiMiMiaIeanMrdvdverNrMibZWMiIjIjIkM1E0E0E0E0IkIkI0IzESIjI0EzEzEzIiEjI1RFEiEjRDerrNerSKvdrNN6nNvdd5IiI0IjIlIkE0E0E0EzEkEjEjIiESIjI0FEFEEzIiEjM1IkEiE0RWi8vevei8asabnNzeveebd4RGIjIlIkFEE0E0E0EjE0EjIiESIjIkFEEzEzIiIkM1IkESE0RWi8vevei9revem9zeveabVoVXRFIlIkFEE0EzEjEjIjEiESIjI0IkFEFEEzIjIjM1IkIkNGZ4esveveverdrdzeveveaLRXM1VXNGI0FEE0EiIiIiIiEiESNFNFI0JEFEIzM0I1I2RHM2NGZnarrdrNnNrNrdi9nNrdWKRGI0IlI2VWJEEjIjIiIiESERERJEEzI0FEJENFM3RJRZRJRZNYVYabrdi8nNrdrenNi8rdZ5RHM3I2IkI1NFEjIkIiIiERERERE0EzIkFEJVI0M3RJRZZ6ebRZVpRpnNerRoaKaJRnm8m8NHRpRZM3I2EkJEIjIjIiIiERERERE0EzEkFEJFJFI0M3NIeaeqi8m8VZeKrNVoJGRoirm8RpI3NJVZRZNII2JFIjIjIiERERERERE0EzIkJEJGI1I1I1NHeqWJaJaaV5VpRZaLebebmcRZRZNIVqVqRZNII2I1EjIkIjIiEiEiESE0EzI0NGI1I1I1I1NGR4V4VoNYaKRaVqRZRZVqVqVaRZRaRZRaNJI3IlIlIlI1IkIkIkEjEjE0E0I0JFI1IkI1I1IkJHI2M2M3NIRaVqVqVqRZRqebnNi8NYNII2IlIlEjIkIkIkIkIkEjEj', 'base64')),
  ('c097', decode('E3JIR5t5kWgVklxXonknlIMmRGSsR6Ymo4xo1o1YtHonYWMVQ3d6e9i9VIVHMmYnkox0wn03IlI3NoiqoXpGom1Fo3oncnRHR6fNVZk3koxH1Y1oxIsncnMVMVVHatnNesRHRIQ3cnk3tGs4IlJZFZqJs2xH1T1DkWoXcnQ3erWsU2gWsnxW1Y6H1IsXknU2UmQ2abe9nNisVpVZQnVIgnkoEmFZFIJHh4s31S1Us2knUmVojNOLYntYs4wn1H6I1nxHomclQlU2d4eKi9rNi8R7M3NIc4coV6J6ImRYqIom1Do2kWknU3nNa8N7cnyJxotWtGt2lEp1tlxlg0hExiximXm8u4WsN6VIZYY3touoNYaKo3s101gWcWYmVYrcOsRZkoxHk0QBMSQSQSQSUSk0plUmZFljyC2kvLm6i8abRqQnpZdomZiZtH1Vs2oWknlFire8N6UmkWk1QRYjpmyHyHpmcjQSYjdFQ2hWp0tyylvde8atGMNZqYd4I3qp0m5TtGolg17Fq6a8hkclonQRUi2p7L7L7K7L2ZUSMRc0Y1hWlmlVxym7jNWtWtF7eIqINXRpx21EtGc12jyEuol0Ykk3omZDlE7L7L7L7L7L7LpVYzckUkYjdFYkg0mpnNjNa9a9pZlIl4x31WwWUWhF2T102UhDg2tYpGYzpml3lV7L7LlldEt3dEpGpmtnpWhFYTpUasrdnNWslpo4xH0l00kWc3eJqrqaxjYzg1clpmlFyZuIp3676qyZp2t3pn2J2a2q672ZcTgzd5e9zcnLtIxIw25j01cmVGacq5yWc0Y0lWpXt3tmyZuIyZ676q27uYyYyIyJ2r6qyZ67lFcjU2SsjNvcwn5E415T0llol5mcmqtkY0lX2q2a2J2Z6q2Zya2q6q672q2ZyIlV6767lFuJyZYjYlWKS9vc1n1D0y5z1Gk4pJqbu8lVdFyalm2a2ZhV662qlmdEYzdV2q66pnyI2q2ayIyI2pYjgmRXWsa8wm005T6T1WxIlZp6y7hmhWp3pn6767p3p32pUilVlmdElm6qpWyI2a2ayZpW2JpWo3RHJpWss21F5y6E1GtIpZl6hphWuIpmpnyZ6rhWhVuIlVt42q2pyIxmtnya2q2a2q14xWxntHQ2JpR6wm5V5j5j1ntIpqdpdYpWt4qJt5uJ2at4hVhmlmY0MShVczg0pnyJhFhFhW2ayJx4tGg3VJerwG5U5k1EwXlJlZpIk2pGpoyJyayayJpnlmY0YzUiMRMRQRhWp3hFc0c0dEp4yapWtWtIc4Wbw16E5j1U1otItYkmcVpXt4yauJdFdFdFpmdEYzUiQRMRQiY0pmp3kUkkp3yalnlVx4w3ooU41U6E5S006ns3gWUWYUUjlouJUjY0hWc0lWlmUiQRMRMRQShEdDdFc0ckZEdElkpVtHso1Xgn5k5z5j2GpUYlQUMUMkg1dFhnhnlnp4lnhXt4lFg0cjcllEdCQSQiQSQSQSYipTt0onoow2xX5j5z6D11ckU0IlVDV4hElVUjhWdGU1dFU0UjhFx4YlUmETUkQjUiQSQSQSczpShDxzxFs2xG6E5i6EtTYkUkIlNGV4Z2lShEUjQTU0QjQjQSZEhFQlI2I2NYY0USQSQSYThDhT2BtT6zslwn6U5j6VpDUkMkMVE2NpFqh0lSczUSZEQ0U0MjMkQ1IDMlI3N7NZMkMUYThEYzM3c02B1xxV1l', 'base64')),
  ('c098', decode('uo7M7LQ1p56s68p6dJU4p6yK6b6r7M677N/e/e687N7N2sys/uyshZl62b6st6qI7LZGQ3U4dYZGuXQ1Q2ua68uJlolq2L2L6b2byn6s7N7N7N697N696s7ducqcRINIuLqLmH/d26p3dYqI2Lp6M2ZVM2un7c7clphZ2b6s6syLt36s68696969696s68ycuc2s2sysRIVJhZy4hZhoyp7N166sdYM2Q2Q3ZH24lZlZhql6l7VJpp2s686s6s6s6s6c6c7u/v/e292clZlZlZl3dZdZuY262L2bp6Q3qK2r68x4uYuKlqVJM4RIyL6s686c6b6b6b2L2by9ucqcqcmMpqlqlZhZhZqK3K7M6868lqp6+8+86Z11yauKt6lpmL7N696s696s2L2L162L29usqcqcqLpqpplo2b2c2bub7L/e7e28dZua+82sZIhXuLyLuL7N/e/e/e6s6s6s16166sppt6pqt6lZdXhpqaqKtpuK6suK7N/edYZZqLy8qK2shqM4ZZ3N/e/e/e/e7NZYVIp62s/e/v7eybdXVGqKl4ZIuaybyb2s69yb7N/eQmYmtp7NlplZ2Ll67e/e/e/e/e69ZZM4M3M4M3Y22s7N/v286s2sx6ZI692c686s6cuK7N/egVgWgWyLhZlZt7/e/e/e/e/e29VIQ3dYl5VIQ4Q3ZW68y82s6s6sdYpp6LyLyK2KyKyb/euLk3hYhoubVJla7O/e/e/e/e69qKqJyL6s2syLVIQ4Q3l669+928l5lpx66Lpolpub/e7N68yLhYZXhoZXM4VI/O/e/e/e7N29/e7Nyb7N696sqLVIQ4Q4ZZqKybp5pp2K6L2KZI7N7e6s6s6sqado68l5RIM4yc/e/e/e/e7e/e/eyb68/N6suL2LlphZZIlpdX6L166L6L6LyL/e7N6s6c6s68682syrhpM4RJ29/e/e/e/e/e/e2s2s686buK2L6L6b6b6L6L6b6L6L6b6byL6s686s6c6c6868qazMlYRJNIRIiKur287N/e/e2syK6Lx6lqt56a6b6b6b6L6b6c6b6L6b2b68686s6s6s6s68682rt5lZlqhZVIQ4RIRIRIdYlplpZYRZlqyo656p6L6c6c6L6b6s6s6L166b6s6s7N7N2rhnZGlYpphZhZdpQ4RIRIRIQ4VIVZVZh616t6t4qH2Z6s6b6s6s6b6L6s686s6L6b6c6s6syb6suKpYtZZJZYmLZZRIRJRJM3NJNJ2s6b2L6bt53JuXhZ6c2L2b6s6s6L6c69686b6s696btppot5162KY4M4dqh7RIRJM4NIhZhZ2s696969hZl3pqM4hZ2b6byKuaybt5t62s696b2L2bx6166L6L6LtqI4RIiLZpM3dZpq2bpZdqus69uLZZhqpqM4VJlZt6yK2Lybyryax6p5uKx6p5x52K166L6b6cZJM4VYZIlZ6s7NyKZYM4M4dZlqyb6b2L2bl6hZhZdp6s2LyK2r2s6LuKZXQ46Ktp162K6s6b2LdZdZp6x6/N2sp6I4I4p62L2L6b6c6c6c6shqhZVIdoqKt5lpdpRIQ4RIRI16yb16x52a6W68pqdJpq697NuKM4M4VZ2L2L2L6b6s6s6s2cZJVIRIRIRIRIVIQ4RIRIZXZXys/e28yKx02U6s6shJ177NybZYhq6c2b2L2L2L2b696969l6Q4RJRJRJRJRIRIRIRIRIRIy5', 'base64')),
  ('c099', decode('IjIjMzMzRFRViJlpaIiZZmVVZ3VVVVqKVHIjM0VXl6RFVVZnQ0U1ZWQ0RYV6NWNFIjIiIjIjMjMzMzMzMzQ0VVZmeqq6iaZmeZZVdmqKIjIiIiM1dpVWRFZoQ0dWZFVFVFNGM0IjIjIjIjIjM0Q0MzMzMzREREZmqHunqGmJqrmIh3h6IjQzMihVVGd4Z4RGVFdWdWdmZFZFMkMkIjMjIjM0MzM0Q0M0REREVFqGuFynyWdlmKmKmbh5IipmpmlVdWd5ZoQ1U1dWdWdGdWZGU1MjM0M0I0MkM0MzM0Q0VFVFdmh0p1uFqFdUhXdXdoh5VGhVhVhVhVdoZnU1U1Y1dXZGZWdWVFM0M0M0M0M1RnRFRFM0VFVVh2dTl0lkl1ZFdFhGhHdXZXhVpmllpmhoVWZnZWVWVFRFZGZWU1M1Q2NGRoiZabmbd5VXVWVVZVhkhkdUZEZFZFZFhGlomJdVpmMidEdGdpd6dpZpdpZXVFU1Q1RHZpabaseJRFVXd6mLiqeJZnU0U0U0Y0U0Y1ZFdFl5y8qahVg0hEU0MkIiIiM0M0ZpZoZ5iKqciLVoNFM0M1M1RFRGVYaJiaQ0IiMyVVU0U0U0Y1housusqKdEUzIjIjMjIiIjIiM1dpeLZpRHRGNFM1M2RFRFRGRFRFVGVWRFIiVWiJZnQ0QkUkZGd4dndoQ0QjIiISESESISISU1ZHVYVXRGRGNGRGRGZoRGRFVWRGVWVXZoMzMiZWVVZmMjQkUlh5h6M0IiISIiERERERESISQkMkM1RGVXVHVYZpVoRXRXRGRGRFVXVXZoVWIiVGQzVEM0QkQkZGZYIiERESESMiERESERIjIjM2IkM1VYVXVGVYRHRGVGVYVYRFRGZoZod5M0Q0Y0QzMzMjQjUlZpESERERERISESERERIjIjERESESQ1VGVVRGM1RGM1Q2RHM1M1RXZoVWZXQjUzZEREMzIiU1RGIiERESERESMiIiM1IiERIiESIjQ2Q2Q1M1M1M1Q1VFQ1RGM1VXVYZYVFYzY0UzZEMjIiVHMjERERERESERIiVEMzIiIiISIkVGVGM1M1M0Q1Q1MkM1M1VHRHM1M0IjIiMiUzZEYzM0MzdpIiERIjISERERMiupZVIiM0RGIjVXRFRFM1M1M1M1M1M0M1RGM1ESESIiIiIiISMiUzVEVHRGM1ISIjIjISERh3qZQzERIiRGM0RHVGRFM1M1M1d4ZnM1M1IjERIiRGIjM0IjM0RFMjREESESIjM0M0IiIjIiuqmIMjIiERIjQ1M0Q1M1Q1VWd5VXZoiKRFISIiM1M0M0VGRFM1IiIiESERIiERERIjM0M0MiZEYzIiISERIiIjRFM0M0RFd5Z4VWVnZ4iJRFRFM1IjRGRGM1M0ESIiESERESERERERERERERUzQzIiERIiERESRGRFM0ZnZoVnVWVWVnZod4RWM0M0M1IiM0IiIiERESERERERERERERERERISQiIiESIiERESIkRGRGZ4VXVWVnVXVWZ4Z4ZoM0RFIiIiM0IiIiIjESISERIiIiERERERERERERERIjIiERIiRFd5VnVnRFRWRWZnRFVXVnd5RFMzESM0RFREIiISESERIjiKeJMzERESERERERERIjIiIiZnZ4ZnVnVXRFRWRFVnZnVXVXd4Z4VWIiM0d4ZoVXIiESIiM1VXZod5ERESERERERERIjIiVWZnVnVnVnZnZnRW', 'base64')),
  ('c100', decode('RmR2SHSHN2N2aYzc3uVmMzMyMyMyZmmpd3iYepVlVmZmm6zcvba6SpSYSIR3R2RmRlRVNERURmR2SHOHOHWHvc//vMMzMyIiMiMyMyMzZUQzMzRUVmZ3Z2zcvba6SZSYSHR2R2RmRlRVRVRVRmR2N2N3OHi67u//zcMzMyMzQzMyQzMyMyMyMyMyMiMyMzvLzbjKWpWHWYRUR2RmRlRVRVRVRmR2N2N3OHvc7+//7uRERDMzIiIiMyMyMyMiMiMiMzRUMzZ2ipeYVlaHVlRUR2RmRlRVRVRVRlNmN2N2SY3t7+////iYVVMzMiQzQzMyMiMiMiMiIiIiIiMyREMyREMyIiRlRmRlRVRVRVRURlRmN2N2ao7u7u/+////Z3iIQzQzQyVEVDQzIiMiMiIiIiIiIiIiVmMiIiMyMzVlVmRVRURUR2R2R2N2ap3t7u7+////3dzMiIVDUzQzVDUzIiIiMiMiIiIiIiMzeIMzIiIiMzIiIiMiMzMzR2R2R2R2Wpzd3t7u/+//////7udlZEUzUzQzMiIiIiMiIiIiRERERURUNDVVVmIiIiMyMzMzR2R2R2N2SHep3t7u//////////h2VDZUdUQzMiIhMiQzMyRENDRERlV3RUNDMzIiIiIiRENER2R2R2N2SHi67u7+//7u/+//zueHVEVEdUVEMiQzQzIiMiMzMzMzMzMzMzMzMzIiIiIiIiMyR2R2N2R3SYa53tzdrM3u7/zdi6m6QzVDQzVURDMyMiIiIiMiMzRDRERURURERDMzMiIiMyNDRmN2N2SISYSZWYWYzd7/7/zdvdm7VlREVVRDMyMyMiMiMiQzRDNDRERVRENDRDMzIiIiIiMyNmNmR2SISIOHN3i63u3uvMi7WYaYaGZ2VVQzQyMyQyRDVDdmZURDRERDREMzRDMiIiIiMyMyNlR2R3R3N3N3SIaqjLm7eqWHWHeZiqV2RDRDQzZVd2ZUZEZEZEVDQzRUMzRDRDIiMiMyMzMzRmR2R3N2N3SISZSZWqrLeYiqrMrMiqRERERDZVZEZEZDVDZDZEZEVDQzREMzMzMiMyMzMzNDRmRmNmR2SHSISISZSIV3mpZ2REVURERDRDZVZUZDVDVDZDZEdEZEVDUzQzMzMyMzRERUVVVVRmNmRmR3R3SHSISIRmeId2VVVUREVVZmZ2ZVZUdldldUZEdUdUZEVDUzMyMyMzMzMzMzMzMzRlRmRmRmR3R3R3R3V3ZlZlVUREVVVUVEVEZUdliHmYmHhlhlhUZEVDQzMiIiIiIhIhERERIiRlRlRlRmRmRlRmV3ZlZUQzMyMzMyVEVEVDdUdUhUhkllllllhUZEUzQyMyMyIhEhIhERERIiRlRVRlRlRlRVRlZ3ZlRDMyMyMiQzVEVEZEhUhUhklllllllldUZDMiMiMyMzIhEhIhEhEhIiRlRlRmRlRlRVVlZ2ZUQzMiMiMiMyVEVDdUhUhUhUlklllkhUdUQyIhIhMzMzIiEhEhEhIiIiRmRVRVdURURURDVDVDVDRDMiIiMiQzVEZEhUhUlklkhUhUlkZDMiIhMiMzMzIiIhIhIhIhIiRUNERURVRlRUQzVDVDQzVEQzMiMiMiVDQyQyUzZDZDZDVDZDQyMiIiMyMzMyIiIhIiIiIiIiRURERERURUREQzUzZDVDVERDMyMiMiIhIhIhMiMiQyQyMiMiMiMiMiMzMzMzIiMiMiMyMyMy', 'base64')),
  ('c101', decode('ZqqL7O2c166b6s68696968UzMiUiQiUiYytC1j5jxScyya6s2L161qxpxpxpxpxpxqxqxpxpZZpq2b2L2L6c6s686969uJMiMiYigyky1i6X6o6n50xSlm696s2L2L1616x6x6x6yLyLuLt6dJpZx6166b6s6s68697NZEMiUiYiYitS6E/K+66W50pCdD2s696s6s2b2LyLuLucy9qsmcmclItJ1p6L6b6s6s69697NZEQiQiYiox5h6E6W6W6ExitTgyhn7N697N6s2cucmsititeteteto4xJ1q6L6s6s686969l3QiMiQiYikxtBpCpC5y5z1jkyQiQj2869692susm9etatatatatats4xJ1q6b696s686969U0UiMiMiUixBxT1j1S5i5zxjYyhVQil37N69y9m9e9atatacacacacs4xI1q6L6s6s68697NdVQiMiMiUikxYiUihDtS6Ex0tT1jYydF7N69u9i9a9atacacaMaMaMtIxJ1p6K6b6s6869uJQzMiQiQisysxkyYyhDyH5z505i5SUiQiua29u9e9atadaMaLaLeMaLlIxI1Z166b6s6869UzUiQiMiMikyxB1B1S6F6E5z1SxCtBQiQiqJ7Nu9e9atacaLZ7eLeMeLc4s4xI1q6L6s697NZFUiUiQiQiMiUiYyxC5S5y1SxDxCYyQiQiuJ7Nu9i9ataMZ7eLiMiMiLZJo4xI1Z6K6s692rY0QiMiQiQiMiMiIiMigyxCxSxSlCMiQiQiUz69y9i9adaMaLiLqcuLuLVZhItI1Z166c69lnUzMiUiQiMiQiMiMiMiQisxgyMiMiMiMiQiUz7N3Nq9etacaMmcuLyLx6Z7dZtIxJ166b69l4QiMiQiMiMiMiMiMiMjQk1StTIjMiMiMiQiUiyr7Ny9itacacicyL161qmchqpIxI1q6b69hmUiQiMiMiQiMiMiQlMlM3ZHtURHIlMjMiUiQiqJ7N3Nqtecacicuc2b163OmLpJxI1p6buJUzUiQiMiQiMiMiMiQ3M2IkZ6RYRYdoI1MiMiQi287e7ey9itacecus7N6Lu9h6pIxI1q6b2rUzQiQiUiMiMiQiUkM2ZqIkRYicV6usRYMiMiQiqI/e/e3emtacecqc2s6Ld6hZpIxZ166c68lnMiQiQiMiMiMiU1RHVpI2I1Z7NHVpNIM1MiQiUz3N/e7eq9ecaMqc2b2LZJlIxI1p2L6st5UzMiMiMiMiMiMiQ1RINGQ2MjNHIlNIM3RHQzQidm3O7ezOitacecqc2b6LlItJxZ166b6slnQiYiMiQiMiMiUi1lczMicz2GdpllpUQkpTtkQih4vOzOq9ecacicyc2b6LxZ1Z162L6b6s2bUzQiUiMiMiQipD1jpCtjxS1kp41i1S1j1j5zhDmJvOvNm9ismcus2s6s6b1p16166L6s6st5UjMiMiMiQiUi1S501kgyQ0lDpThChCYytT6E1jzOzOvOu9u9yt2s6s6s6c1q16166b6s69poUiQiMiMiQiUixSlCQiIjI2YzhEYzM1QjZFyZ2X7e7e3N3N696969686s6s1p16166b7N7N6sdFQiMiMiMiMiMiMiMidHM2Y0dWUzQ1Qjyr7N7e7e7N7N7N7N6969686s6s1p1q166b/e/e6shVUzMiUiMiMiMiMihWxZyLl5VHQ1U2ZW7N/e/N7N7N7N7N7N6969686s6s', 'base64')),
  ('c102', decode('UjMjZVVFVFqZ3d3c3c2Y0z0z5E1V667d7M0z4z0zsj0z4z4z4zwzwz4z4z4j12xmw1414141YzMjZVd3ZmZVqqzczc7c121D0z5E0z137L124z4z0z0z0z4z4z0z0z4z0z0z130141414141UzZVVFVEZVdmVVmZzczc7L1V1D0z4z4z1E124z4z0z4z0z4z4z0z4z0z0jwk5G4141414141ZEZVQzVEZlVVdmZVmI3L2X6F1U1D0i4z4z0zwz4z0z4z4z0z4z0z4z0z001G41414141010kZVZVMjZWVVREQ0VFZVlm6F6F6F5l1E0z5D5E0z4z5D0z4zxDwz0j0z00015G4141414k4k0kZWVEQ0dmdmZmdmdmZWZWll6G6G6G511E0z5E5U1D5D1D5D5E1U0j0z001G4141414k0k0k0kdmMjMjVFZVZmdmh3h3h3h2ll6G6F6F6G1E0z5E5U5U1D5D5Dwz0j0z015G41410100010141ZmMTMjZmZmQ0MzVFZWh3h3dmhl6G1l6m11xU1U5U5U1U121ExE0j0js15W5Gw1w15G010101VFMjMjVVu5qHqHZEQ0MjQ0ZVdmdVx16n6mtlx3121V1VxV1VxmxExVxm5F5W5X1GxG1G1G1GQ0MjQ0Q0qIuY25yXp2ymhlQjQ0ZVZV2W6mx2lmlnp3tm5m5m6q6Z6I2HxVxVo1xHtHtHtHtHMjVFM0M0h22oypyH2n627H6muFZEVFZEyWt2dVMjQzhWxm5m5V6q7L6Z6q53x4xYtItItItIMjVFMjVVmGyoyYtl7H7H/H636m6WmHdmdmd2ZVQ0MjMzl3tV5V1U6I7M6Y666I13xXw3s2w3Q0VFMjmqh2uo24uG2n/Y6363636m2WllREVVZVdmREMjhmhmxV5V5V537L6Z6q6I13tGw2tWQ0ZVZWmZu4qXy4242n/I/I6n7I6G6nqHZEMzQ0Q0REMjMjZVhm1V5V5V527L6p6q6Y13tFwlZVZVZmmIzKuoqHuo2464/J7J2X64t2hmZVQ0MjITMjMzM0MzVEhV5V5V5V1m676p6p6Z13tFdmdmZmmIq6qZuYzJ252X64yqtVyYpmdVZFQ0MjMjM0M0NFRWM0Q0lE5V5U5Vxm676Z6p6p13dmdmZmln2aqJmIqp252Yx22YyHpUlEhWU0VFQzMzQ0MzM0eJM0M0MjtE5U5U1Vxm676Z6Z6YZWVFVEZElmhmhml3mH66tVplhEc0dElVY0ZVZVVEMzVVeIZ4maZ3M0Uj1E5U5U1Vxm666Y6Zh3d3mIhmhVdFiHiHuZyYpEYzpExVxVk0dFdVVFQ0MzREeJiZmaeZRFIjgz1U1U5U1Vx3662IZmZmdnZVQjdVupupyZuYtl1l1lhEc0c0VEMjMjVEVEZWZWdmd3iadnVEMjtE1E1U1UxV2H6qREVFZWZWVFUzhmuYqYqqtm2HY0Y0ZEMjMjVEVEQ0VVh3h3ZFU0RWRWVFVFU0o01E5U1VxEx3MjMjQ0VVZWh3upqYd3mZhUdVVEVVVVVVdmdmdmmImIqHuHdVQ0Q0MjIjQ0VVVFQjczpExVtEVFZVQ0M0Z3ZmVVdnmqmZmYqYqZqZqZqZqYmIh3hmhldVmZmIdmVEU0MjIjMjVFZVVEZVU0tEVFZmZWZWeImqmaiaq7qpqpqpqZmIh3ZWVFQ0QzZFdnqqqqqqq6u6qZh3ZFVEQ0Q0ZVdmREU0', 'base64')),
  ('c103', decode('ZHRGZXVGVGVGdodYZXdoVXZXZohqqLl6dpdoVXh5doh5l6Znd5ZododoqLh5VWVWRWVWRWRWZHZHdXhYVGZXdodphph5dododpl6uLl6l6ZodXl6h5h5l6doiJd5doh5hpqLdoZoZoZnZnRVU2VGZXdXdoVXhpZXh5hohpdol6qLqLqLdoZoh5l6doh5qLd5iKd5d5Zod5p7l6h5ZoZXVXVWRFVGdYdoh5dodYZoiKh5h5h5mKysy9usiaiKqLmJl6qKmLh6mLh5Zoh5d5l6uLlqh6doVXZXQ1VGdodYl5l6mKiau8u8q8qrusysy9usiKmaqru8qrqbiKl6mLdoh5mKmKh6p7qLh5dWdoZoiJiJqrqrqrmbiJZ4Z4d5Z5Z5l7ysysqLh5d4VXZ4iJq7u8qsmamKh6mKmKh6l6p6hoMiIidXZ4VWZnNFVnVoZod6d5h6Zqd6qbusucubd5ZoiJd4Z4Z5VniJu8u8qsmKmLhphpp7dWMiIidoIjIkVXRYeKZ6ZoVXd5mKd5h7ucysysqbZod5d5Zod5d5eKZ6Z4VniJu8zNmah6p6p6UzMihoMkIkVWV5eJV6mLd5VXd4d5mKucysysuch7iLZoZniKZoZoh6Z5aKV5VXd5iJq7u8ysdmQ0hpRHM1RGRFeJRoaKeKiKh5VXdpys29ysuch7iLd7d6d5VXZod5VXVXd6Z6doRGM1VWubdWQ0qLZXVHVYM1VnRoZ5V5Z6mbh5l6ubys29ysmKiLd7d7d7d6d5h5ZoZoZoRWZoZXRGM1hoZEQzqbVGhoRHVYVXV4VoRoV6ebaKqLysysycucqLiJd5h7d7d7iLiLZpVXVXd5ZoZod6Roh5UzQjdIhYdXdYVXVZVXVoVoRoeKWKmLy929ysqLdpiKmbh5d5Zpd7d7d7d6VYh5iJh6iKRph5UzQzhZhHVHZHdoVXVXVZVnV4Z5V5mLus2929ucl6ZoVXd6mLZodoVHVGZXZoh6qbiLVpV5h4QzQzhZVGVGZHdXdYZXVXZqVYeJaJiLucy9ytusqLd5VXVWZomKESERERISh6Z6Z6eaVoM1hmQiQzhZZXdYdYZXZXZXVXVYVpZpRGdpqLucucqcd7qciKh6d6ZWERERERERRGV5d5VXM0M0lnQiQzlqhHZYdHZXhYlphpl6h5Zpdphplqp7qLqbZ6aKZ6V6eLVFERERERERQ0NFVHRGM0VWhmMiQ0dIdHhZhYZHhZZXhZl6hphpdpuLuLp7p6hqd5aKVoRoZ5M0ERERERERQ0RFRGRGRHqKVDISZGhoVGZHZYdodYZHhplpqLhplqubysysp7hpVHVXRWVnd4ERERERERERQ0VGVYVph6lnQiMjZYdYQ2dYVXZHdYZXl6dphql6p6uLuLysysl6VHVXM0M1VGQ0ERERERERVXVZVZdop5hnISU1VHdpRGVGdoZHZHhYdZqKhqhplqp7uLybucucdZZZRGRGVHVWERERERQ0VYVXZXVFZWVFMjdXhpdYVGU2ZYZHhphZdpl6hqlppquLuLybuLp7dpVZVYVXRHZYMiISISQ0ZXp5dXISMjQ0QjlIhIdHVGVGdXZIhodYdZZHlpp6p6p6uLubycqLZIVXRGVoRGZXIiIiIjQ0dXZGQ0Q0IiQ0MjhZdIhIRFM1dYhYU0hpdYdpdYh6hqp6uLuLuLp6hZZXVXhohoZWM0Q0REZWVFQ0Q0VFESMjU1dIlYhY', 'base64')),
  ('c104', decode('YxQhUhIiMzMzMzYx2EpjgxgxUxhDMhIRQipE1V1m6Z6r6r6a6q6Z6Z6I1n1W1VpEIhIhIhMRZCQhUhIiMzMzMzYx2EtjkxpTy1Yyxl1n135n1m13131n13546Z6q6q6q6q6Z1n1mYzIhIhMRdCQhUhIiMzMzMzYyxz63uEpiy1QhdCxl5n6I6J6q6q6I1n2I131313132I6Z546I14UzIhMhYyUhUhYhUhYxYxcxtz7H2klCdCMRMRlT1V1m136q68/M6q6q6Z6I131m1W1n1m1m1n14QzMhdCgyQhQRMhUxp0p1YyYhchlC23UxMhMRpk1W1W1n6I6Z6767676a6J54131m1m1V1V1WYzMhtShCMRIRMhdCt1UhUhYhYhYhhCQhMhMRQhx11n1W1m1m136J6J6J2IhEdDhEtm131W1Vk0czlUUhIRIRMRlTdCQRUhYhYhYhYhcxUhMRIRcy2H541W1W1W1W1m53pVYhUhUhUhUhUzYzgzhDhTMRIRIRUhlTUhMRUhYhYhYhYhgxtSMhMRQRhT2I6J541m1W1V1WpEQhQhUhYyQhERIiQhUhQiIRIRIRYhcyQhMRUhYhYhYhchYhgxczUjMRQitk146J6J541WxFUhMRMRQhQhEQIRIhMRQhIRIRIRIRYydCMRMRQRYhYhchchYhchhDdEY0c0YitlxWxmtWYzYjQRIRIRMRIRMSMiIRIRMRIRIRIQIRQhcyURMRQhcygypDlDlDYhYzUzdEc0MSUyhUhFY0MiQiUiYzY0YzQiY0dEUzERMRIRIRIQMQcylTkigixkyF6V6W6Wx1QiUiY0dEY0QiQSlUhUUiMSQSY0hFdFdEc0YzY0UjQjMhIRIRIQMRUhcylTYi10llZU6myWZDQRQhUjdEY0UjUiYztkdDdDMSQjQzdEUzdFQiUzQjUzUiIRIRIQIRYycyhCMh106W2V6m6mp1QyQiQic0Y0UzUiYzhD10yFYzhFUzQidEc0MhMhQjQiQhQRMRMRIRUhhCQhUi106V6W6W6Wt1UzVDUzYzYzUzMSUjpkxk2FyFdFY0QiY0UiQhQhUjQRMRQRQRQhQhMRIRMRtTxk6V2FlT2FhkUyUzUzUzUjUzMRQit0xkxkx0dEUjQSUiUhMRMRUzEAIRQiQiMRMRQRgRghxTxT106W6myFQiQiQyUzUzQSQjMRQRhD111ktkUiQRQhUhQRIRMhUjAAEAQiQiQiQRcRgRkRoyxTxktDxTUyQiQiQiQyUzQSQiMRQRZD2FxkYyZCMRQhQRQiQSQiUjEREQQiQiMhcRgRgRgRshsixDohoRozczQiQiQiUzQiMRMRMRt16FlDQSQiQhpkUihDYyUjUjERIRMiMhMRchghgRgRkRshwhshwhwz13tmQiQiQiMhERMRUi6m11QiMRUipkpCchlTtkUjUiIRIRMiMRMRgykzgigRohshshoRxC6V2W53xnUyMhMREBIRt16m1kIRIRMRgyoxljyVyFUzQiMiIRMhMRQhgykykzgikRohkRoh102F6W1313MiUzQiIRdT6m6WpTEREBIRghkhlTpkt0YyQiIREQMhIRYigigykzkzgigRkRkR2F2F6W13hEQi1314x26W6m6FYyAAEAEQUhYhYxtjtjcyIREREQMhIRYigigypDpEpEkzkyoyx06V6V12UipV53546G6m6W10IRAAEAERYhchchgygyIREAEREQ', 'base64')),
  ('c105', decode('MiMiMiQyZDZDUyZCZDlkuFhTZCZChjhjl07X7Xp0lkp0dTdDdTp0p0hTZDZCUyZDVCMiMiMiMiMiMiQyZDQiMhMhUydTlkVCZCdT2Uhjlk2222lkp0uVdTdTVCdThUZCMhIhMhUyUyMiMiMiMiQiQiMidTMhMhMhMhZDhkUyljdTdTljt0626lp0p0hThjyVVCZChUQyMhIhIRUyUzMiMiMiIRMiMiQidTQhMhQhQhZDl0UyljdTp0pkt0/X2Up0hjhjdTdUZEVDp1QyMhMhIRQyZDMiMiIRMiMiMiQidTMhMiQyQiZDhkUyZDZDdTljpk2U7HyWljhThUuJuKZDl0QyMhMiMhQyZDMiMiUyMzVEQyQydTUyQzdTUyZDhkZDpnlmhUlkyFyE6l2VqFhklk6o2ahklkQyVDVDQiQyZDMiQydkVEdmMiQydThTZDdTZDZDhUlVxnx3hkhkp02U22uFhkp2qH2l21dTlkQyZUZDUyUyZDMiVDQyVEdmMiQydDUyljdTZCZDhUZDlkhkhUhkhUt0uFlkp127ysyEyFZDlkQyUzZDZCUydDMiMiMihll2MiQydTZCdTUyZCZDdUVDt0dTp0hUhkp0l0hkp2uHp4t0t1ZDhkQyQyZDZChTdTMiIidTdTZDMiQydTZDUyUyQyZDdTVDyVhjyVlkhUp0t1hkp1lkdTljlkUzhkdTdTVDVDZUdTMiQyZUQyMiMiQyZDQydTljZDZDdTVD6llll3hlhlqGqHhlp1lkhjhThUUzhkZEdmZVdVVEdTMiMiUzMiMiQzUyZDUyl2p0dTZDdUZEqGdmhmdmh4uqqah4dmdmZWdUdUVDhUVEdmdmdUVDdTMiZDMiISQydTUzZDUyhkuGZCZDdUdmmId5dll0p1p1p1p1p1lkmIhnZWZFhUUyQyQhMhMidTMihkMiZDQyUyUzZDUzhmqHUzZDdTZDdDZVZDZCZDZCUyQyQyUyZDZDhDdDdTUydTUyQiMzdTMiMiVEQyQiMiUzZDVEh3l4QzZDZDQilzqFZDhTuFdThSZChTZCQyQidDdDdTUzdmZFdUVEdDMiMiVVMiQiMiUzdlhomJmKVGZDZDUyZTl0ZTlk2nlkZDdUqFZDUyUycyYydTVEdnZXmJh4dDMiMiZVZDdmMiUzZDZEhllmZVZDZDZDmFdTVCdUuHhldUdUl2hUpzhShTVDdTZEhmdVZUUzZDMiMidkdUUyMiUzUyMhQhMhMiZDZDljyohjqFhlh3dmuXdluIqJt1p0hTVCdTQyMzIRMiMhZDMiMiQyQyQiMiVDUzQiZDUyMhZDZDhjuGdUl3hll2l3uZh4l4dWdVdUZDYydDQyMzMiREMiZDQiMiQyMiMiMiVDZUmHhmZDdTZDZDhml3yrhVZDpnllZDZDZDVDdmdmqIdVZDQyQzeKebQzZDQiMiMil5QyMiZDdlurmJhmhmZDZDdUdUhlhVYyplhUQyVDV1VDdldVdUZDZDQydUiaaKVEZDQiMiUyZDQyMiZDUyQiUyhTUyZDQyMhQiVFhTYydTZDVDdjrIdTQiMhMhMhZDUyZCl0RDQiZDQiMiQyQiQiMiZDQyUyUyZDMhZDQyQidWd7hlZDljdTVDlzVlhjdCljdCQhZDVDQiZCVCIRZDQyMiMiQyMiMiZDUyqFZDZCp0UydUZEhmubhldUhTZCdTdTl0dTdCyUljUyZDhkZTMiVCMhZDQyMiQi', 'base64')),
  ('c106', decode('IRIhIhIhIhIhIhIhMiMhMiQjU0QjYzUiIRIhMzY0UzMhIhU0U0QiQiQiQiQiQiQiQiQiMiMiIhIhIhIhIhIhIhIhIhMiQjU1QiMidFdEYiQhIhMiZEYyQhVFZFUzQiQiQiQiQiQiQiQiQiMiIhIhIhIhIhIhIhIhIhMiU1YzQhYzhFhWdFczMRIRIhQzYzQhVHZGUyQiQiQiQiQiQiQiQiQiIhIhIhIhIhIhIhIhIhMiVHVFQhdWhWhWhWlWUiM0MiIhMiZXZFZYUzQiQiQiQiQiQiQiQiQiIhIhIhIhIhIhIhMiMiQkVYVIUhZnhFhWhWhWhFUjYiUzU0dGdGY0UzQyUiUiQiQiQiQiQiQiMhMhMhIhIhMiMiQ0U1VFVGRJU0U0mKhElWhWYjUiczMhQhYyVHZHZFY0dFhWUzUyQiUiUyUyMhMhMhIhMiU0VFQ0UzU1ZFRHRHUxd5hog0hEdEYzMRMhUhUxYyVEZFdGlWt4hWYzUyUyUyUyMhMhMiMiU0ZXVFYyYzRHVFZCZEYyRFd7dFc0c0MiMhQhUxYyVFVGVFZFhFpnpnhWYzUyUyUyMiMhMiQzZXUyYyZFYxU0VHUyQiQhQyZpVWQiIhIRMhYxYxYxYxYzVFVGdElVpmpndEYyYyUyQhMiQiZGUzU1YyUzUzUxVGYyYyZDYzVERGMzMiIRIhQhYyYxYxYxYyVFVGczlVpmhFYyYyYyQhMiQjZXVHVFUyUhUzQhVEdBZDRHRHUyRFMyMiIhIhMhMhQyU0Q0UzUyVHZEYihFdEYyYyYyQiQiU0VGVGUyUyUxQyQiUzYxUxVGRIVFIhIhIhIhIhMhQzQ0RHQ1UxYxYxVYZGhGdDYyYyYyQiQiZFZoUzUyYyUxQhQiYyYxYzQyVHVGMjIhIhIhIhMzM2RIM2NGUxUxUzVXVYdXdDYyYyYyQiUydXVGU1YyUyUxUhQiUxUxZDUyVFZEQ0IhIhIhIhIjIlIkM2NHUyQhU0VFRYZXhEcyYycyQiUzZYRIVFYyUyUxUxQhUyUxYxZDUyZEZDIhIhIiIiMiM1MkI2NHQhUyUzZDRYZXhEcycycyQiU0ZXUzVGVGYzUxUxQhUiUxUxYxUyUzZCMiIhIiIiIiM1M0NHRHMhUzUyZERHZEhVcycycyUyZGZFUyUiUyYyUxUyMhQiQyQzQzUzQiUzUxIhIhIiIiIjM1M2VGMhUzUyZDZFZDhWdCcycyUzZXYzUiUyZEVFUxQyMhQiQiQiQhQhUyQiUyIRIhIhMiM1M1M1NHQiYyQhYzZCU1dXdDcycyUzZXUyUzVHVGYzUxQiMhQhQhUzUxUxYzMhUyIhIhIhIiMjM2NpNpQiYxUhUzVEVGdXdDcycxY0ZWY0VGVHVGUzQhMiQhQhUxQ0UyUxVEQiQiIhIhIhMiRFRIJ6NqQiUxUxUyVFVFdFhDcycxZFZEY0VGUzUiQhQhMiMhUxUxQiVEYxVFQzQhMhIhIhIiRFRHJqNqMhUyUxUyUzZEdEhEcycxZXY0U1UiYyUzUzQiMhQhQhUxQiVFYxVEQ0QhMhIhIhIiRFRHRqRqMiQiUzUyUyZDdDhEcycxZGUzQiUzUiUiUyQiMhUxQhQhQhRGYyZDVFUhMiIhIiIiRFJIZYRIMiQhUzQyUxYyZChFcycxZGUiVFU0U1VFVFQ0MjQhUyQhQhQ1ZCYzVFUzQiIhIiIiNGJYRHRIMzMhUzQyYxYxZBdGcyYx', 'base64')),
  ('c107', decode('nOnOaIN5NWISAQERERRFNDERARESI0RGNZNZJIEjAAARM0tXm8RFERZWy87u7vrenOjOjOjOnOnOirNpNFEREhERREMzRENEAREzJEJEE1ETAAEBAAEBMSckMjERma7v3v3u3eze3u3urerOnOnOnNV4NWEhEiqJqHl2uZl3RVEzARERIzESAAMSmIRWUkMSVWi9i+m+jOi+i+i+i+m+i+m+nenOrOm8R4IiMilmyqp3dmuZqIREABEiRWNaI1hGuaZF7Nu7vNisnOjOjOjOjOm+qsubuLubnOnOnOm9msRWREup7e27y7mZiImaaIERREVqRqq9usM0mq3evMisnOnOjOmtuL1p1Y1Yx6ucnOnOrOVnRmM0IzIzIiIjIjEjI1ZGdHysxZ3eicZ57veINmrNq7m9nOm+qcm9nOnOyLusrOrOjOnOeaIiIiERABIiERdYdYMkMkyK1p7d7uy83uNEqrMzN4rMmrnOnOq9q9nOnNm9q9nOnOrOnOnOiaMziIMzESiIRVZGmKy9mKus7vqJiIEjI1AAERJFV4zeianOnOnOm9eLjNi8RXisrOx6nOnOmrVVqqqqIjmZzNRVVX3e3uRniZNGEkEjESABABERq8vMi8nOnOu9u9ZqV5RnIkIjNFlYnOnOmrq7mZ3dd4VV3emqERMzV3I0JINqNZRXJHEjAARFu9ibnOnOnOubmJdm28qIhmIRAAIRnOnOibd3MziZMzAANEEiARJEOINnIlI2I2VWEiAAAAiJqsisnOnOrOuLyqyq/dqYlmVEARZFnOnOm9IiEhAAAAAAAAAAAAEiNWIkETElE1ARAAAAMzqseKnOqsx61ZtXyqyq26yp26hoqKq9zunOnOZ4IiERERAREREREiIiIiI1FZJYFHESARI0iJaKqsyL5Y1ZyKpo27uZ2qt3p3usq9nO//7vrOm9MzERARAREjEjI1I1I1E1E0E0EkI0NFVFisus1Zx6x6q9nOma7MqIqIp3hWrOnOzuzezNu827qIh3h3d3RFI0IkM1NGIkERAAEBYktp69hYybq9nenOrOaJVVhml4dVuIurze7v//m8yr26267L267LmZRGVGVINHJGE0ESQkk4daiL//2LpYrOisZ4d4ZXETVEMiISZVrN7v7///y8qZ7M7M7c7L/tmrRGU2I1EkMkRHZadZVaVYZpururdGV4REzM3eu9VYIkETABMzqr//////mI/d7M/M/d7L7dmsRGESM1ZZhZZqVaVaZoqqu8zNzMd3IiqaiKmbqsRFMkMUIlESISmZzM//uq7L7L/M7M7L7umZESABESQ1tYVqVZd5houLuL3d3uZW3dzOmsqLRFYTp6g2RFM1IiU0qru7uq/M/M7L/M7M7eVWERERAAYkdGZqibM0hXp6dW7u3Nh47eu9qcxJd5lpiLpqIjM1RGVFg27dua7M/L7L/M7cu7Q1MkESIREBhHZqQ1AAdWIRyJurh4ur7ey9uL0ntpZHd5l6MkM1IkIkQlx5qZl3lnZVVEh3IiIjERERERERY2Q0d3IiMzMjqZ7eVV3N7Nx60n4m1IUkd5t6dniJiaqrRGpHIipp162L7uh3AAEBEBISERERQ0zMy73Ny87d/u/vMzxY1Z0n4nwngVk2qcxZU0ZnZnVXdohXIjhXdGZGd3mJEBERAAISERQ03M/d/u7e/u/u7dd3ERMS1Z4n0n04klMjurxIMSAAABESVVZG', 'base64')),
  ('c108', decode('Q0Q0Q0Q0Q0Q0Q0Q0QkQzhTYzUzZDhTdDlTdDhTdDhThDUzUzhTZEIiIiIjISIjIiIjIjIiISQ0Q0U0hnQ0U0ZEdDhDlThDhDhDhDhDhThTlTlTlTlThDhDhDhDhDhDdDYzQiIiIiIiIiIiISQ0Q0mI7dqHp1lThDhDhDhDhDhDhDlUlUlUlUlUlUlUhThDhChDhDhCcyhChDhTYzMiIiIiIiVEhluY7dp1lTlTlUllqHyq277d7u/u/u7d3M3M3M3M2727yqyZuIllhUhCdCcyhDlTdDQzIjpkp1lkqHlklluZ273M7dy8us3N3NushqdZdZdZdZhZhphpl6qKyr2727y6p2hDhCdChTlTdDt1lkYzpkp227uadoh5qchqusy9y9hqdZhZdZdZdZdJdJdJZJZJY4ZIqb3d3MyqhDdDUilTlkhmp1pllTuYmJQ2ZWqbh6l4y8y9urlqqIqKl6dnhphqhohZdZdZdZdZusmLmK7MlUlThUhmQ0dWl4uFplyqU2U3yql6hqqZy83NuauL27ysub2rybqLuZl6dXdWhaqLy8l5U4yrllhDp2l5l5ZFhlp0p2y7U3dYqZdYubuq3Mqah4h4mIiIys2s2sysqJl5hnhlp7y9ysl4ZIqap3hDp1QzQ0U0dEp2lmy7ZHh3ZmZmy83M3Mh4dnZmZmZmua696928h4Zmh3dlury9ual4qJqKuplklTQzQ0Q0ZDhTp2yrhod3VViIuq28uqdmh4h3Zmd3yr2sys2sl5h4qJqJy8y8uJuJqJua27hUllQzqaQ0dDhCuHyrqaZVdmmIqZy7dmZVl5qZl3qY28qIh2yrl5h3qJyry7uaqJuKqJua3MhTlldWVFYzcylTuHy8p5mHqYmZqZqZh2ZVh4urqHuZ3NqIhmyrqJqHuay8y7uZuZqJp2p227llcyp2VEdDdClTuYyrp6qImImImIZVqYZVh428uZ283N28yr7NqaqIyry8uaqJmIp1uGqHyZllhDYzhlQidDlTuYy7uauauqurl4ZmdmdmqJ7N7N7N7N7N7O7Nysuay8yrd2h3ZlpkpklTlTlTlTYzYzMjhDpTyZy7uayryryrqJd2dmh3mI287N7NuY7N7NqIyr2828uZh2h2hlpkhDhUyqp1lTdDQjMjhTpkp2uHuZyryruYuamIh3qIqIuZ3M28qHqHl3l2yp2728yquYh3p1t0pkp13M27p0hUQjQzpkuFuGyWuGuZupmHhnqYupyqmIh3uYh3h3l3l3l3uZupypypy6mIuHyFllp1273Mt1lkQ0lluFt1yXyXhlqHh2dmdmdmhmh3l3l3qImHmHqIqImIqYqIl3l3upy7qYp1l1hn3N3LuFp1U0VElkuGuGqGdmhnhnhmh3h3l4l3mImIuKqIqJqJqJqZqYuKqJqIqZ3LmHl3l3mJ7d26yGyWZEdUt1t1uGuGuGl5l5h3l4l3qKqIqJqIuaqIuaqIqYuaqYubuaqIuZyrqIqIua287dyoyX2nhlp1p1yXuYypyGyruauZyrupysyqy7y728y628y6y628y72828y7y728y7y73N7u3L25yX24yXuGuGuG277d267u7u7u7u7u/u/u/u7u7u7u7u7u7u7u/u/u/u/u/u/u/u/u/u7c2526262524uXp1ynyoyoypyo2o2o2p25252525252525252525252525252o2o2o2o2o25252526267K3J', 'base64')),
  ('c109', decode('iJvNze3eeJRVMzMzMzMzMzMzMzRERERFeIiZiamqRFERERERERERIRIREREREREQEAERISZmZ4q8vO3eq8REMzNEM0REREREREREREREVViaiaVmEAEAEAEREREREREREREAAAERIREAEAIieIiavNzeu8VVVVVVVVVVVVVVVVVVVVVVVVeI3uIiEAAAAAEAEQEAEAERERIREQERERAAEAERmreJq8vOmrRFRVRVVVVVVVVVVlVVVVVVVVVmiZAAEAEAAAEAEREREQEAEAEREAERAAAAEREQeJeJiJq8maRERERERERFRVVVVVVVVVVVVVVVMzAAAAAAEAEQIRMiERIRIREREAEREAEREREQeJeJiaiaZ4RERERERERERERERFVVVVVVVVVVMzEAAAAAEAERUydUUzEREREREAIREQEREREQeJiZiamqZnREREREREVEREREVVVEVVVVVVZnREEAERERERUyhUlkhkQyQydUIhEQEREREAEAiZiaiaiadmVVREREZVhmhmVVZVVVZVZVdmeIVVERIRIhMihThUlkllhkhkllZEZDUzIREREQmrmririZdVdlVVVUdlhml2h2l2l3mHl3h2q7dUQiIhMiYzhThUlkllllllllhlhldUZDUyERmriqmriJdVdVZVZVdlhml2l2l3mHmHmHmHqZUidDMidDhDhUlkllllllllllllhkhUdUYyREiaiqeJZmdmhldVhmhmhml2l2l2mHmHmHmIqIhDczUzhDhUdUVDMiQiUyZDllllhkhUdEUyaIiJVWREdmhmhmhmhmhmdlZVhml3l3mHh2h3hVUhZDdDhUlkhTdDdDdDYyhUlkhkZDhUdDVEZ3d3REVVhmhmdmhmhml2dVZVZVhll2hmdmqIhUYydDhDlUlllUZDQhUiYyhUhUdDQhQiYyd3iJd3REVVh2h2dlhmhml2l2hmhml2l2l2mHupuYYyllt1t1t2lUlUhDhDhUhUdDUhYyUyMhiqiZh3REREh2h2ZVhmhmhmlml2l2p2qHqHypy6y7uGl1yGyG2X2Yt2pUlUhUlUdDYzMhQiVDmqmaiIREREdlh2ZVdVhml2l2p2t2yYyYl3yZy7zMl2uGyGyG2X2p2o2XuGplplhUdDYyUyZDm7mqiIZmREREdmdlZVuHyY2ol2hml2p3l3uqy73Mh2p2yXyGyX2o2p2o2G2o2XllhEdDdDd3q8mrmIiIVVREREdVZVl2l32p2YyYuYl3mIy7zM3MZUl1uHyHyXyX2o2ouG25yHhlp1tlhUm8q8q7qJqZiIREREREVVZVdmyp2pyYqHmHmZy7y7h3ZDhll1uH2oyYuYuYVDhUhkhUuG2Xl2q8q8q7yruah4h4REREVFVVZVh2uYypqIiIuqqpIiIRdlVDhlhlyodUQyZDVDQiQillyHllZVq8q8q8yruaqJiIh4VVVVVVVVVVZVZmd2mZuqREUzlll1MhVDZUyXuXuGlklUdDMhZDllZCd3q8q8q7mJqJmJmJmImIdmVVVVZmdmmJy7u7u7RERDllplIhVDZUqGyoyop1t2lUUzUyZDUzZmmaq7qrl4l4l4mJmJmJmJmIh3ua7N7e7e/umZd3MzZEhUUhIhQyhlyo2ouHdUhUhUZDUzRDUzdVhVhml4l4l4l4l4mJh3yr7N7e7e7N28yrd2mYMzMidDYyMhIRMil2yoyoyol1dDQiREIhdVdVhVdF', 'base64')),
  ('c110', decode('YjISIiIiIjIkI1I1M0gzxEw0ol0k0kkkIirNrNabi9i9re7/3uWbN5JpJpJoJXU2slzN//ysIiIjIjI0I2JGRoesJHlExUxEwko10U0UMjnMrNi8zuisve7/veN5JpJoJXRGklsUx67/3d03IkI1I2JHNYababveR5JGVG1UpVwkwU0Ugki7nNRoi8R6ve7vesJoJXNGglsUwUw27u7utI1pJGJHJXR5abvei8WKJYNGpV5l1lgmhWcjcjmqrMRFJYN57vzuN5JGY2wVwUwVwV2s7/d5RGzeJXNoaLabnNisN5JoJXpVhVxFwlYkUzQiZEq7vMVEJWWa//i8Q2olwUwVwV0V1Z7virVHvN7uabNpnNSKWKJYJYJYJXJFMjsUgTUiUiUidVve3ud2REm87/hocksUwVwV0Wwm3NrNVXvNzelprNjNi9NpJXJXJXJXJGY1wV0UciUidDhVmZzdzeiIREze3ewlwVsU0V0WkmmK3uZovNvddYcmnNR6aai8R5JXJGJGkl0V0VwVoUYihEuI7u3d3eh3ma7/yKwUwV0VsmcmdH3ueKvNu9ZHc2Y2i8NoJHJXWai8Z4wl0U0VwVwUsUsUk0yp7u3L3dhmvN7vpHg2YmcmYlcmu8q8vNmsY2YmYmYmzuvem8WJJGg2162s1YwVwVwVwUwUs02Y7u7t3eqIze3u7u3eZIU2dHlpzezdmKY2c2cmcmYmvezu3u3u3u2rxY0mt5qrxYwVwUwUs1tl3L3c3u3M7uu9qch6QmVHdY3dzeh5Y2YmpFpWg1cmJXRoqK297u7/7/3eqahYqK2rxHwVokhUd3up3uze3u7v//7ul6U3mK3edYYmY2c2xEs0lFg2I1gl0l1H0mpXmJu83u7vzN2KybybtncjhFzN3u7u3u3ezNqcdZUnZYh5Y2Y2tnxm1U1Ds0xIk11G03wVkUclclcmc3hpmKy83u3NzdybqK3dzuzu7/////3edZQmU3d4hodWdFtWpWw01I5YxY03sVckclcmcmg3hIlHcmc2w2yb3uze3u3uzuzuze//////3eZZQmZXd5hnhohWyJx41p2b0mgVYkclcmc2hIlIg3cmc3dYt63M7uzuzezMqqiZdnh5qrzN3eh7U3ZXqrhnqJqJua7d7u//YkYlYmc2g3c3hZhph6qru9ze3d2827zd3e7u3eu9qrh4Z5d5d5mbiKqb3NuZ3N7u7/7/3eiJY2dYh6mbq9ve3u7v3uzN2L1Hslpolou8iambzN3e3eqrd5ia7u3Ml5zN7u7v7/7u7NuJU0Mjve3u3u3v3uzeqsh5o30m0Vwl2J2alnd5iazM7e7u3uqrd5zN3eua2r3eu73d7N68hWMjMjMk7vzuvNmbhpc2glwm030m0Vw2yJyalouq7u7v7v7uzemsiJzMq73e3d2KpXpop5Q0IjIkMkQ127urc3c2gms3031I1o151os2lnlouZu7qrq8u9zNq8mbmJqIuquK2b3eiZVFIjIjI0M0M1Q17d7ty8lH1H1H2J2r7u7uvNqayWzM7v7u7u7eu7eJiJiKqq3Nqr3uyrxYQ0IjIkI0I1M1RGZo7t7t7t7cxn3Mu73e3euru7zd25maze7u3u3uzeqseKmHu8zNmr3umJIiIiIkI0I1M1RXaKeb7L7t7t26yJqsZ5qsmrq8msiK25mJeKibibibmbmsqsmruZzNmszNIiIiIjI0I1JGR5abeKib', 'base64')),
  ('c111', decode('h6h6l6l7d6RJRJRJRZRZRZRJVZhquKyby9zOysysy9zNy9zOyshpdZZIM3M3M3M2M3M2VIZIRJRJRJRJRJRJRJRJRJh6dqZqZZVZRZdqqKybys292s283Nysy8t7l6dZdYM3dYhYdYZYRHZIdqdqdqdqdqZqZZZZRJVZZZdqhqh6VZVZVZZqqK2s3N3Nyb3N3eucysy9h6dYZHZYdYhZlpQ3ibebibibeLd7d7d6ubqLdqZqVZVZVZVZZqZZVZl6yK2b2sysysqLqcy9qbmLdYVHM2MlIlIlvdvdzeveverNvemcysqLiLibiLd6dqZqVZZZZpZqdqp6lqlqhpdZl7qcmLqbqcdZZYIlIlIlmsibibibibicmciL2sqLmsvNvNvNq8mciLh7h6ZqZa2syb2c2bZZdpuLp6p6l6l7l6ZHQ2dYh7mLh7mLmLmLmLmL2smLmLmL25yrq8zMq9mLmLmLl7qLp6p62bdZdp2buL2b6bVIVIQ2Q2IlmLqLmLl7l7mLmLmL68mLuq2424247I26qcqbmLiLmLl6p6p6p6h6mLl6p6p62LhqhphplolYqLqLqLl7l7mLqcqL2byZ/H+3/H/HuW23yrqbmLmLmLp6h6hpp6h7qblqp6p6p6mbqrmLqbqbh6l6hql6l6p7ua24uYuI/H/H/H/I632nypubh7mLqL2bp6uLybh6qbl6lqhpp6iLqcqsqbqrp6p6qKyqyquZ63/H63tp63/I/c/d/b63uZubiLiLqL6cyL6cybh6qLyLp6t6yLh7ucqbmLh6ysua64/Y24/H/H/G/G2Y2K7K/c7c/d/cy8ubh7h7ub6cuL6cuLdquL6byL6byLmLqbh6qLZYZZyY+22n/H+2/G+2+2+22ZyLy77c7c3MmLqKd6d6yb6bt66cl6dq2s6bt66buLqbqbh6dpVHZY7I6263+3+262/G+2/H/b27l5ybmbmLl7l6ZqZqybyL2L2bdql62b6bt66buLqbh6mLRIQ3VGyq63+3+3+222+263/c7c7cupqamLh7dqZqVZdq6r2b2s2bdZl7ybyLx66buLqbdqdqQ4ZYZZmKyp+3+2+22n+2257c7c7K25h6ZqVZVZVZmLyb6r2b2b6bdZl72byb2cyLqLh6mLVIZIlqdqdqyn+2+27I24+23Ly6237IZpVZVZVZdqub2byL6LyL2LyLlZhZ6b2byb6bqLhqh6hZ16ppZpZZ2n+2yXqauY627I7I/HmJVJRJdquKyLybyLyK6Kx66Lx6dIlZ6LyL2L6bhZhZp6x616ppVZZZuY62ppt6yI237J63ypVIRIh6287c161qx6x6t6t6x6pqVIpZ6Lt66L6LhZt6x6p6tpdIdqh6uI2myK6cyaypub/HdpRIdq7M/d/968xq5q565616yLt6hppquKx66Kx6t616x6dZQ3M2dpp6p5yYp66b6b6bt6yKmJRIl67t2b7c282s2L1656566K6L6K16qamZuKt61616p62bmKQ2M3lptpxZl62b6b6buL1q/LmJtq287MyL2byL2L165656566L6K5656yKeZiZtqt6tq2bybdYQ3pptZxquLyb6b2b2spp56/bya562L2sx6162K2b2L1656562KyKuZqoqoiZiJtZ2buK2bU3lppp5ZtpmKubuLqKh6ZZxZ6r266K162L2Lx6yL686s2s2b2LuKuZq4rIq4iZeZmpybyLp6U3', 'base64')),
  ('c112', decode('lZlpVVqquq7O7e7e/u3Npqp6h2uYmHdmuYyY667L7Mlk/+ybpqybqZy7/u7e7Ndnh3lYpZpqlZlomZqZy87O7O7O7emIiIQydlmHdluap3uHt2t2yYhkl228l3UyUydU7e682quIhkhkyat5lpqKuru5y87e7O7OqaMiMyMhMiMih228uZ6qt26q67p2c0hnVEl3hmUy7N/MyYZDdTdUhkuHlZlZp6mI277N7e7OuauI2qUzMhIhQyua3N2Zt22Y2pp2dGZEl3yp7Ll2282qyqmIqZVEUylmlZlZuKyZ2qyp7e7e28l226qHhmMiQzy77eyqyH6puGl3p6l3lmhUZDuZyJuJ7e/tyrlZp3uHy8uahmyp26yH3M7e28qHuYdluIQzVD7N7euqhUlluXQzl4yYuYllll68po3M7e/r25hZp5yIl5l3VVRElmyYyp7OyqyYuH66yZdUdV3NVFVEVEdVqIMzdVyI2pp2yZ2bpnua7O7c7ahYybp4qIVEQzERQzuH667NuKhlhUuIuHhVdm2rZEQzVDVDVDdVuKqH2p2p7MyJpnt57N7N3Np668t5p5h2QzVV28yZ/M28lZp3uHp2llZUlmyaQzVD6667ZEdWqaZVdVp36st4p4p5ys2929297Nt4ybqHl32929yZ/L2rhIhoZDhlqHZEuJqJQyp2yY2pp3hld3d3qadnyKt4pnp4ZWiIyr7O68t468t2ya2929ya7L67dnZml2uYdVREREhnQil2p32Yp3unqnuJdWMzVEhWdFuJyrVF2rh4yat427p2uZ2928qJ667Lh3MzVUQzREVVZmU0Qi676qyY/LhmmHyJZFIiMzVDIiyK2Khn2bVEMzQz27plp3mJVVdmyY7LyqREVnVVVVREZVMiZD6pyYuH2pVEZWpnhWMiIiIiU02a2KyKt4dWMzMz2qlllmQ0MzVEuH66/MqaREREMzIiVEMhMhyY6p2Z2pMiVElXpnlWdVuJyJp42byKt4podGl3uYllllZVIiMzuIyY/LypREMzREMzZVMhQzp2p3uIZEIRZVlnt5yJyKyK2KlnyKyKuJuK287auIhUllZEIiNEiI262puHZUIiIiMzdnUzVEqImHdlh2Uzh32b6r2ayKya2b2ap42K2r29297MuahUZEMzNFRFVnuYp2hlVDIiMzh4yryZl2dlZlVDd2l3687N7L7L2b2r686sp42r2r29697N6929uaIzZoZWRXVVREREIiVWiJ7d/e/eyqdmZldlVUh2/e/e7N/e687L696sp46s6s287N7O7NyruZ2869h4RXRFREZ4NEd3yr7d/e/e7Mh2ZUVUZVmH/e/e7Nyr7M/p7M68yK3M682s7N7N7bqHdEyr7NiJZ4RFQ0ZoeKdnRE28/d7N7NqImHqYhlyZ7M68dnZW7d/c/b7N683M6s2r28uH26y4ua7N7OmJqrZVZEVneK7NdWdW7N6syZuJlnhUuI27277Mln7M/b/N/e6968uJ2b2b27p2p2ua7e7e7edmlmllZEZou77d68ln2b27277LuIl2p2yY2727x668/a7N686sl2p328ya7e28hm7O7e7d7eVVuIZEREqr/u7N27tp2b3MyquYlllllkl2yZ27yK2s7M7N7N6sp4p3uY2r7N7euq7e7e7c7eZmyYVFZV3KypuZuXt52826yat5topYpYyKuJ277Nyb277N27ya2sqJuHuI3N7N', 'base64')),
  ('c113', decode('505j6W1kpT6H6b6Y6n65dDQiQiQiUyUyUydDhDdDQyQiZD647Z6n/J7KhkIRIhIiIRIRIRIR6F6F5164tk116Z6a6o7JhlQiQiQiQiQiMiMihTUyQiUiQi647J+4/ah2IiIhIiIhIRIRIhIR5k6W6W6W7J6W6X6a6p64UyQiQiUyQiUyUyhDhTQyQzUzUy7Z7Z/J7rdlIiIiMzIhIiIhIhIh5k516X6X637Z6n6o6pyXUiQiUyYyZVMidVcyYyUzQzdDhk7q7Z7q/rZUIiIiIiIiIiIRIRIi6F6W6G6n6n7J7Z+4656phUdDYyYzYyYyYyYyYyYyYydDy47q7q7r/qdkMiMyMiMiMiIiIiIi6G6X6X6W6o647Z7p/J/J7JqFl1hTdDczYzdDlUhDhDhk7Z7q7q7r/Zl1VEQzRFVFREREMzMit0pzpzt0yG6o+47q7q/Z/Z7ZqXdDhThTdDhmhVhThTRCmF7q7r7r/Z/Jd2RFVFVFVFVFVFRFlylylylzqEp0yG2n7q/q/qqWRCRCdDhThDpDczhTVCVTVD3a7a/q/J7byWM0REVFVFVFVFVFlylylylyhililylz7J7qy5VDRCRDRCYzhDhDhTZTVTVTRDyW7r/q/a7Jt1RFMidVuHhmVFVFhilililililyqEymyW7JZURCVTRDVTUyYzdDUyVTVTVTRD2o7r/p7a63p2VFVFhluHuHREQzdmdldTdSdSuF2pyoyWZTRCRTVTVDVTVTUyhUZUVjVTVTZT6o7r/ruX/Ip2VEVEhmuHuHdlVEiJiJiIl3l2uX7K7L2nRCRDVTVTVTVTVklTZDZlVjVjZTdU657r7r7Z/Jp2uHp2VFqGqGMjVFiJiIuZ7K7K7K7K2pynRCRDVTVTVTVkVUZTdTh3VUVklkuH657a7a7q/ZuGuHdlVFuGuHZUh3iIiI7K7K7K7K25uXuoRCRCVCZTVCVTVjVjVjVTdlVTt26p6X2W7r7r/quGqGuGqGuHuHqGqGdlh325257K25djuYuoQyUyZDhDhUlkZTZTVERneJRouo/a2Z7K7r3K/qunqGp2l2uHuHuGuHd3ZDZChl7K25RDmHuoQyZDhThTlUx2p1hlSMR6eJWLiszLhlZEh1mYy424uHuXqGqGqGp2qGZmZnRVuZ7K2pZ3iH3bUzdDdDdDhDyH65yXmrm9q8iaeJl3ZUUy3Su3un/ZhluHuHuHuHuHuHd3mZZ37K7K2pqpyp7sUzdDhTlUlTtl7a7t3cy7mYl2tTpUtkdluyqWqXy4MzQzhll2l1VEMymIy6667K7K257K253KQiUidDhTlTtl6pqjukqjmXy52GxSxSplmZupy5y4RVIiIiQjIzIzMzup7K7K7Kypup7K253JdkQiQihCdDlTqFiBmRiBiBqlyqxj1St1yo7K7r/qZlIiUzU0RVNEMzdnqI7K7K7K7K7K257r7q3ZuWxjdkUymDmThxhxiBmBuV2Fx1qH7r657ry4l2dVpWdFNEMzdFd4d3mIupuY257K3J7q7t7t7s3ayoqFmBmDiBhxmBuzy5yFp3qH7b7r7rqGuHp2pWpmUzhVtnd4d3h4mI257K247q7q7r7s7tu6yphithxShimTqky52pxjhnp2h37s7rmGp2hVtntmlVlVlFZVZWd3d4uZ247Z7Z7p7q7r7rmZmJh2yFtkhkuVqGqHpll2llhmZV3b7s7q24hEtmlFg0czlV', 'base64')),
  ('c114', decode('QUQUQUhoyrdXU1UlIkMkMkMkppYVcVYVcVYVYVUVUUMUyb7u69oWoWoWoXtpZXVGZGtpcVkWUUQUubloUUp5UlMkcmg2VGQkpYgVgWgWgVcVcVYVUVMUpp/u7es4oWoWpIZHZGU1MlY2pYkWYUQUMkQUUlhYU1dHg2o3loVGo3kWkWkWkWcVcVYVYVQUlH/u/u1qoWonhoU2MkMkIkUltYkWYVQUQUUlY2c2lYlXs3xY1plooWkWkWoWkWcVcVUVYVUVcm7e/u6soWo3Q1ETIUYlloppp5pIgVlodXQ1dXdnpp16o3cls3x6oWoWoWoWkWkWcVgVgVkmkn287e7NsnoWo4U2o3clg22KY1tZtpZGQ1U1UlY2tZxptYk2xZ2KoWoWoWoWoWkWkWkWkWhYM1Q1Y2VGlHoWs4t5g2tYs31Ic2o3yKIkyb1ps3xI16xZpYo3ppontZyLtZoWoWoWoWkWkWY2Q1MlIkQlVGxIw4xptIYlYlk2IUtZlohXppk2tHo3x66sMkUlybyKdXQ1hXhYtZsnoWoWoWdHU268xYg2dH2L16tIZGYlk3IUIkxpIkx6p5UlxZQkqKlHc2t5mJU2MldXtpdHhoxIoWoWoWdXyKuKtI1Ix67e1qxIVGMkMkETUlxpdXhH6s16xYk3xpxIclmJIkU2dHQ1IUMkIkybsnoWonho6stptpYlub2L1Zw4tpQ2IUIUc2hHuKIjuKhHUlg2g3kWonVXIkIkU1hHMkMkIkh4tIonontp6s6spoc2296s1ZxZxpc2IUYlcVUUybMkMkt5Y1cmYlkWkWlYQ1dHQlt6Ulg2dXp5tIsnsnyK2btpYllH7e7N1qtpkWYVIUgVkWoWlYpoIkITETIkkWcVkWtIhopptp6stIt5lo2LxZtItIyLU1dHUlyK7N/ux6kWonkWkWoWoWoWU2yKYlIUZGdXcVcVYVppx56s6chYxp6s16t516xpyKt6UlIUdo6b69/ukmkWoWoWoWoWoWoWQlY2tIYlhXU1UlYVMUZXpY6st5g2Y2yK1Zho6s6b1ptIcmIUdHyb6s7ecVkWoWoWoWoWoWonxItItIlHc2YlY2Q1UUVGpY2KlYlHlHpptHuK1p1pxZtYgmQUg2pIuKurYVgVoWoWoWoWoWonpH1Z1ZxYlHxItIdGQkMkl5tI6c2L2K56lYlYgmxYtIxZsncVgVgWo3ZGMUkWoWoWoWoWkWs4s31ZxI1Z1Z1ZomtHQ1ITVGYlc2hHc2QklXdHlHxYs4s4oWkWkWoWomU2IUoWoWoWoWoWkWoWcVw4om1Z1Z1ZxIkWdXIjmag2ETETETMkxZp5lopIs3oWoWoWoWoWonIkQUoWoWoWoWkWUVkWcVkmons3kWkWkWgmZGt6lYtZQkETIUo3x5lHpHxpx6o4kWoWoWoWg3ETUVoWoWoWoWkWMUkWkmUUonkWkWkWkWtptYxItItIxIs3s3xIlIk3kWon1Z1qxZonkWoWdHETUUoWoWoWoWkWcVcVgVUUomkWkWo3tpkmxIxYo3kWkmg2YlYlkmgWgVkWoWw4lH16yLkWkWg3YloWoWoWgWgVYVUUUUYVkWkWx6lYcVxIxZclcVs3kWcVQUUUomkWgWgWkWkWcVpI6bo3gVo3UVoWkWkWkWkWkWgmITgVclubpYo3xIk3clgVkWomoWgWUUkWkWkWo3tppIhHg3QkhHtpcVc2UUkWkWkWkWkWQUdG', 'base64')),
  ('c115', decode('M1RGnNnNnOm9zL3K3u3uzu7u7L7u7czN3Nq9rOrOq97t3Ny93Nmr20abWcecesabWcababSLVFVnzdzezezeze7u7u7v7u/+/t/9/+3Ny9//7uqs7d/b7t3NqcisesetetetetebesacacacVENGl13drM3t3t2I7u7u7u/+/+/9/+zNu97du8iK3L/s/t/tqsicism9zdzNisebm9i9itmqQ0NGRGiHzb3c3c3L7t7t/u7t7u7e27qtu8/buqiLqsmby83dqsicu8zM3MqsmbeLrNq9mcmsRFM2M2NHd53b7t7t7t7u/t/+/+7u3NzN7d/+usmLiLiLiba9msic3Ly7mKiLibqazMzNu87ul0Q1M3NIVo7t7u7c7u7uzezN3e3e7u7u/t/+qsmbmLiLiLicisqr7s3LmbiLiLuZ3c7u7e7uZVdlM2NHNH3e7v7d7u3ezOyrvNvO7t/9/t/umcp5mKiLicmcmLmb7u7XmcibiczM7s/v7v/vVYVoRHQ2RHzM7u7u7u7u3e7vzOrNvN3e273eiLiKiLicmcmcmcvNzezLqsiLiL3d7a7s7u7eVYVodoZWRIu87u/u/u/c3evO3du9u9usu9zNmKh5h7mcvNzOzezezOzOyambiL7e7u7u7e7eVYqHyXuHRIqr3e/u/u7u7uzOq9u9q9q9qtmsmcuburvOzOyrzNzezezezNvO3e7v7d7u7u/uVXdUp2qHqIh4zM7e7u7e7uzOmtmsiKqtq9q9u9vOzOvOzOzOze3NzNzezeze3e7e7ve9ze7LQ2M1ZEqJqIdoZo3d3e3N7e3eu9msd5ismsmsqbvOvOu93NzNzOy9yJvOzOzOzN283e7u7v/uM1Q1dVuHZXVYVYurzNy93O3O2sqad4icmbmKp5qrupyE6l7Hy6u8u9vNy6vNvOzO3O3e7u/uQ0Q0dVdWVHRYdp2r7e3NqHl5x4iJZXmsibicicqbyGxy6D6jyFuqq9u9vNvNvNzNzN7e/u7ul4VGU1VGVYVYy93Oy9y9qJVFqsVWVFmtiticiciLkztikjyCtlq9q9u8q9u9u9u87c/v/u7uqZqYdmVEVIiKzOu9zOzNy7h5Q0MjMjZomcmsmcVGQilTtztyUjmtqqq9q9q9u9u97K/v/u/uqIuZZXZXVHqr3Ou9q9zeyquqZWIkM0ZniKmtq9ZndWhVUjlVIjmsq7u8u5q9q9zN7v/v7uzOyXqZd4VYVHRHiK3ezO3Oq9h3VFMlMkdnmcu6ibZVd5Q0ISZXdnd4vOzevOq9q93e7v/vzezNuFuYqYh4RGNGM2iK7eyrmaZmZWITMld4d5mtd3ZVZoZoMjdndnZVu8zeq9mtm97u7u3eze3elkdEVGZXRHM1M3Q3zNu9mcQ2MlMlMkVGd5mru3ZnZFVGMlZXdWmJzex4dnl4vN7v7v7u7u/vVHRFM1VGVHRHZXQ3u7zOmJMmM1MkMlQ2ZYy9qsZWh3dVM2ZVhnl43uyIQSMSmI//7u7J7e3eRHVYRGM0ZFdnRHRIzNzOlUQ3Q3MnQ3VHVHy9u9qrZWQ1MmQ2dX7e7uzMQzMUZVzL3e3LzOzNRIRIRIRHQ0VEQ2RIvNu9VGVGQ2Q2M2Q2ITy9zNzNZoMmM2Vou8//mJdnQ1MlZXqauszOy8zOVXVYRIVYRHM0Q2ZYu9u9ZXZGQ0MjQkVXQ1zNzN3NdoMkQ1Zo7e7uh4ZWMlIUVGdmqbzOxWu9', 'base64')),
  ('c116', decode('I0qLh7ZpMiQiQiQiY0mJp6hXQyMhMhIRERIRIhIiMiMiMhIRM0dqVYibmch6MiQiMzIyEiIzd5h6ZZIjMiQjQiZEZWy9qbQzQyIiIRIRIRIiM0RGMiMhMhIRIidpZXd5mLvOZnQzIhEhIhM0qsZZMlMjM1UkMiVFmbvOd5hnMiIRIRMhUzZEZoZqMzMhQRMhMidpVWd5icvOZWQiMiIhIhIjusmLQ2QlIkIjISQkeLecZnVFMzMhQidododWiKdpQ1QyMhVDVVdoM0ZYu9mLdmQyQyQyIhQjusu9VYh7Z6JHI1M1QkZnZnd6d6ZWl3dWdVdombh6MjMzMhdWqrhoZFdpqbZEdUUzQyVDUjQ0y9zeqcZqVqaLNYI1ESIzM1I1M1VWZnmJZUdmRFVHMjMjQyiKqbZVhnqsVGQyhEc0UzUzUjRHmcu9vOqteMaMV6E0EjI0IjIzM0RXMziJiJREMiIiIiMiQ1d7ZWQzVFqcZmQxUiczY0YjVDRHiMmcvOrOm+ecNGI2EjM0NFNGRpRXRGIiMzNGM1MlVHMjRFdqdYQ0QkqLd5QyQyYjUzckZFVGeLicmszOi9JYNHNGEjRoititZ6RqRpI1NHEiIiIiIhMiQ0dqVGREdpmLQ0MyQzYjQiZEhoZXiLaJeaVoNGM1M0MzMiRGRprOu9iLNHNHI2M2NGI0IzIiIjVIiKeKqcdYRFMzMiUjUzZVqKlpZZRFMiIiIhMiMzMiMzIjIjM0Z6mcmciLicZ6VYdpiLRGM1VpeLVIiLdZRHMjMiclZFh5hoh5IiIiIhIhMhMiQyIiIjEjI0M2d7d6RHeLqsq+iseKiLM1M2M1eLU4mbdZZYQ1MiVFh5vNubmLM1NGRFMzMhMiMiIjIjE1JIZqmsV6ZpM1Vom9etV6VoMzM1ZYdqZqh6mch6ZIZGZnqsisececNGRGMzMzQzMiMiIiIkNIZ7m9m9eLM1IkIkIiVWRWMiRFRGh6VIiciLu9d7VJVHZ5qsrOWKNoI0IjMiMzMiMiMiI2IjNIicnOebecRYM0I1IiMiIiMhMiRFiLqsm9q9u9Z7eMitnOi9aKM0NFZ5NGM0IiMiMiIjI0I0NHecRYQ3VXicQ2RIIjMiMiIhMiMhMzVEVFd63evenei+etR7M0MjMiaKRXRGQzMiMjM0RGebVqM2M3Q3RGZoeLVIQ2MjMjM0Q0MiMiQzQzVXzNu8RoNHNGMzMzQ0IhARJFM0MiMjREVoVoVXicVoM3M2M1MzZoZ7RZM0RGZZd7M0IhIhIhM0dqdqMlQlIiIjRoZoI1ERIhMiQyUzQ0IiERIjZqZqZqM1MkMkMjZoaLZ6RIh7iLZpQ0MiRFVHh7usd6VYZZNXRWJGJGhndWUyUyIhERERERIjRYd6iLZqVIMjMjMjRXecd6VYd7dqVHMjIiM0VZu9ZoM2Q2Z6RGRoNYdXhphXIRERERERERIiQ2Zpd6h7ZZVYMjMlMiRGicRGRFVXRFQ1MkIhM1mcRHZpVoh6VoRXebVFQzMSZGU3U1QlIRIiIkM3VYZqRHVGMlQ0MjMkNGVoRXRFQzQ0RFMiIju9dpIiVWZoZoNGRWVEIRIhQ1QjIRMiU2MjIjI2RId6h7M2U3U1U1MjMkIjIjRWVoVXZpZYZZu9dqERERIhIhIhERVWIhIhIhIRERERU2MjEjM3VqmLiLQ3dpdZdYQjMjERERERERERREZnh6vOq9RWERERERIRMk', 'base64')),
  ('c117', decode('nNrdveq9rNrOrOq9q9q9q9rOzezererereverNrerOvevezeveqtqsqtq9q9q9q9q+q+rNvNmsm9rerOnNq+q+q9q9q9m9nNzevenNnNrdvenNq9q9rNrNzeqcq9q9m9m9q9q9q9q9q9rNvdmsmsqcm9nNnNm9m9m9m9m9nNzevNnNnNrdrNnNm9q9nNnNvenNq9qsmtm9m9m9m9m9m+nNrNmcmcqsmcmcm9m9rNvdrNrNrNverNnNjNrdnNjNm9m9nNnNm9vdmsq9qtm9m9m9m9m9m9nNnNicism9isqLqLqcm9m9rNveveveveverNrdnNjNjNjNnNnNm9vNnNvdrNm9m9m9m9m9m9nNjNecmce9ismcmcqcqLmsmtmtrNvevevevevdrNq9i9jNrNrdjNvejNvem9mtm9m9m9m9m9jNjNece9e9etitmtmsmcmcmcmsmtmtrNm8i8jNi9m9mti9rdvdnNrdi9remti9i9i9m9m9jNjNjNe8fMfMe9iti9itititm9itmsmtisi9jNjNfNi9i9nNverdrdrNi9i9i9e9i9i9m9m9m9m9m9fMfMfMe8e9e9e9e9i9rdi9nNnNjNi9jNjNfNi9jNndrdnNrdrdisi9itisi9i9m9i9m9msmtfMfMfMfMe9e9i9nNjNe9fNrdvdvdi9jNjNjNnNjNjNrdrdnNq9iti9isicmti9jNi9mtmcqte8fMfMfMfMfMrNvdnNe9e8jNvdvevdvdvdrdrdrdrdjNnNjNi9i9e8e9e9i9i9m9m9mtmcmcjNe8fMa9a9fMfMjNm9ise9e9nNndrdvdndjNfNe8e8e9nNnNm9mcisiti9i9m9m9m9mtmciMi8ese8e9i9e9fMjNe9e8i9e9fNesibe8jNfNfMesecese9jNi9itjNisi9i9i9i9m9mtmcl7esicesnNrdrdnNfNe8fNe8e9fNich7ebe8e8e8ececaMesjNi9nNvdjNi9i9mtmtm9m9m9mLibibe8e8rNrdrdnNnNfNe8e8jNeseLnNesesesasaLacaLisnNvdrdi9i9mtisititmtmtmLl6iLe9e8i9rdrdnNjNfMe8fMjNh7esrdjNisecacasabZqaLi8nNnNismsmsiciciMmcmsmLl6l6e8fMi9rdrNrdnNfMe8e8e8hqiLrdrdvdi9acacZqZqZqa8a8a8a8e8m8nNnNjNe8mtmciLl6e8e8e8nNnNrdnNe9asm8rdhqd6rdrdvdvdesV7ZqabZqaLbMfMjNnNrdrdnNe8ismcmLiLl6iLe8e8jNrdrdasasasrNvdhqh7vevdvdrNaLWLabaLZaZqa8fMrNvdvNvdrNiciMmcmLh6h7icecesfNndnNacacase8jNhqmLrdnNecaLV7VqVqVqZaZqacnNnNvdrdfMfMice8islqh7ibe8ecesfMndnNasacacnNi9hqiLisecZ7ZqZaZaVqVrVaVqV7asnNnNfMe8e8icfMisl6iLesfMesesnNrdnNacacaMm9rdl6mbnNesZ7ZqZaVqVaVqZZZ6isnNjNfMfMfMfMiLfMfMh7iMi9jNesi8rdvdm9eMacaMe8fNh6eLiLZJZJZZZZVqZZZZZqnNrdrdi9esfMfMfMiLfMfMiLiMfNjNicisnNesi8eLeMaMecZZY4Y4U4U4VIZJVJaLVqVZd6vdvdrdetecesi9fNiLe8fMec', 'base64')),
  ('c118', decode('3Ky6y6mHZldlh2h2iHdld2d2iHd2mYzLqpqGuGyXyXuGl2uXynyoynunuXunuYyouHh2yn3azKy5y5uod2qozLzLzLu6qod2ZlZlZlqpl2yXyG2XuGp2l1qGuWuXuWqWy53KmGlll1hlqXy6y6y5uomHqoupzLzLzLzLzLu6d2ZlVUZlt22G2G2XuGllp1l1uWqFqFqWuXqXyGuGllhlZVzLu6qYhlqHh2qY3KqoiHzKzLzLmXZlZlhlyGyGyG2Gt1hklkh1qFmFqFl1l1hlt1plhkdUVDmYyp26uouoqY3K3Ky6h2iHzLzKh2VUZUlkx1plt1x1plhUhUqX25qGh1h1mFdUpllkhUdUUzZlyYyol23cqYuYupuYupup3LuodlZldUhUpkx1x1t1lkdUZDuXyXyoqnu5zKdUlUlUhUdEUzQzt1t1hUuHyGuY3tmYmG3Ky5uXh1h2pllUpk2Fx1pklUhUUzy57K3K7s3bqpdDhUpkhUdDUzQyl1hDtUtkpkdlqpmXqX3Ky6uX2525uGhUx12Ft1pktkhUUzqpupzKu5qomZdDpklklUdDZDQyZUZUhkhkUzdUyX25263Ky5uX2H25qGpl1111t1pktlhTUzZmdmiHllvKmYdDpklUdDZDZDQyl2h2qYl2qHZDx22X2o2pyo256X/b25tl11x1tllUlUdDYzZUhlpllDhldldDlUlUUzZDYzQydDYzdU2626hlpkx1x1yX3K25uXuXl1x111x1tkhUhUZDQyyHuHp2dDhlt2ZEhTlUhUZDYzQyczcyqX262625yHyGyH2526qHdUdDlkt111x1pkhUdDZDMi2H6Gp2hVYiuI2YdDlUhThDYzZDYydU262626262626262625uXdVZDhUtkx1t1tkhUdDZDMiuH+6662pYzYz6pZEdDhUhTYzUzczuH263K3K2626262525youXZUhUhUpkx1tkpklUhTdDQyQz2p/L/K2Yozx2hVQyhThTYzUztU252626262626252525uYmGVDhUlUpktkpklUpkhUZDUyUzQzp36565t2uIhVMihTZDYzQiyH2525262625252525yYmGdlZUuXuXllpklklUpklUhDYzZDhTUzZEp2lmp2UzQyhTZDUzQi2o2525yXuG252p2pyoqHdkdluXynyoyXlkhUlUpklUpkdDYzhUZDZEZEhVZEMjUzhUZDUyMi2p2pyH6o51uGyoyYuHqGqHl1yXlllluWp1hUplpklUpkhThUpkhTQyUzQzQzMiZDZDYzMiMi2p2px16X50t1qGhll22525qGhUp2llhTuG253KuXpklkhTtktkpkZDdDhDhUdDdDQyZDMiUzx1uG51515kp1l2l1uX3J2op1yYyoyXuGpk2n257KuGlklUpktkpklUdDZDZDlUhUZDhll2l151xk515l1kl1dkVUuX3JuGx1656o2X6XlkuF2425qGlkpkpktklUhUdDhUdDpklUhUynuXuG11111l1klkZUVDh1qG25uX1kxSpC1j6FpkyX2524p1pkpkpkpkhUhUdDdDlUlUlUdUuXyo12xk11xkpUZURDdUp1uGqGy5uHuGxT2X2nlluWyoqGpkpkpkpklUhUhUhTZDhUlUdDVDhluXt2p1xltkdURDVDl0p1uFy67bp1uXtU2op1p225qGplhTlUlUlUhUhUhDdDZDdDlUdDUzZD3Jy5', 'base64')),
  ('c119', decode('2op2yp7cyYuHuH2o7buZyXl3662oiaeaeaeaeaeaeairrM7blluX/Zy4yYdnRGQ1ZFQ1dEtCyHuHqIZXuYp3uIlnqFqFpThE2pqqeaeaeaead5Z4eJiai73t7buHp2lmVGQ2Q1Q1p0ZUhFtC7uyphndoZFhmuHp3l4ll6zyEx1ZoZnZoZ4VXVGVGVXZoeJvM/KyYuHhWlmQ2Q1Q1ylpkpUtSzM7umJmJhmp2uHuHl3uVyo6o6WdVVGVGhmhVlmhmQ1VXVXma/LyYhmZFlmQ2Q1ZXmHpUpT6Sqa3dzNmIuHuHuHuHhmyGuHyV6WhmRGZF6muGt2p2lmQ1Q1ur/+3bqGqHhVdVdFU2Q0MkyD+zurzN7uu8qZuHuHp3p3uHp3uG6n+3uXdV2Ftk1j6Wp2Q1iJ7u/+/tyYlmyGx1tklUdVqF+02TVGqa7umJuZ26uZlmp2uHuHqW+4/J/ZuXyGdWZF2Fl3zM7urJ/u25llyG2FdVpl6k6jymllpDdWVGVHVGZFuH2ol2t2x22YyH6X6X2oqHllyYyXl3///+7typ/K6oyH6XyGhm/G+16Ulmp4ypp3p2hWU1ZFZFp22XdEpUhmuY6G6G11t2dVZFZFqI/L7M/c/c/c/b/K/a7J2362x0tl7dzMzMyVp2p2hmU1ZFdFlmZFU0Q0U0lE1j505jtluEyEyG6G2Gx2526Y66/b7b/b652o2ouXdnmamJlmlmlmp2hmU1pThVQ1MkMkMkQkY01j5i5ih0uUx01j1jtUtTpElU1klVyH2XyGyWhVZFZGZFlmhlllp2p3lmU1ZFMkMkMkMkMkMkdExSxjeE7DuUdElEpEdEY0Y1ZFZFdVhVdVl1p0p02Uupp2h1hlhlp2p2l3Q1MkMkMkMkMkMkQkY0lk7Eu4606zhkZFZFU1U1ZFZFZFQ0qEMkMkQ0pz3Klmlllmp2p2l3p3yYlmdnQ1MkMkVGMkU0p020h2uFpUpkZFZFZFZFhmplhFMkQkQ0MkMkMkqaqFlUxkt2p3mIuFuGyo26dmQkVEmHMkhkVUZ0uFt1hFhVqYdVl37c/ryodVQkMkMkMkMkZXmJp2hVpT1jyGuUhVdFuYyohnQ1ZEQ0Q1lkdUZVuFuFlllVyZhVuZ7ay5qHhmQkMkMkMkMkdmdVyYl2hVtT1ihlZVdVh2qGp3U1U1U1U1ZFp1uFp1hWp1t1uGlmuYuYt2lmdWQkMkMkMkMkhVpmqqeFdVdktT1jVkVkSDZlp3U1U1U1U1U1ZmuFp1hVp1uFllp1mIqZt2p2dVQ0MkMkMkMkdWyqioV0RUdVlVxSVERURkZ1l2ZFU1U1U1ZFdFp1t1uFuGyFllp1qZm6mHl2dVQ1MkMkMkVFqa7uZlREZVdVhVtkhlVVhDdVl2ZFVFZVZFZFZFhFlVuFuodop1uGuXm4immmhmQ1MkMkMkZFl13NRlZV3Luqp2up7uyoU1Q1p2ZFVUZFU1VFZFdVlluGqaQ1l3uFqFVVMkh1yktjxSpjhUhVhVurh4l23LuHxSqH7cypyGl2yUZFU1U1ZFZFdVhVypqaQ1Q1hmyWdVMkMkMkdWpUxRtkhVVFVXm8qHyGqIiJdFiZupyG2Wp1mHdWU1U1VFZFhmq77uVGQ1VFqGuXqXZVZFplmIdWZFl3d4MkireJlmtkdmu7mJqqhW1iZEVGVXVGU1VFZFdVeJeJZXVGQ1iZZ4VWd3V4dW2WuYuHqIqZmZeJeKiI', 'base64')),
  ('c120', decode('xyxyxyxyxyxy+yyTlRlhlRlRdBIhIiUydDdDdDdEhS2TtyphphtyyDpitytxtytytyyTtytyxyxyxyxyxyxy2U7apipilRhRIhIiUydEdEdEdEdDdDtzlRphphtylSpiphtxphphuCtytxpitixy2D2E2l2l2m7I242UtyUyIhQiYzdDdDdDdDZDUyUxlRphphhRhRlRlRlhlSlhlRphphhBxixixzyE2V2m2m2muF2V2lMiIhQiUzUyMiMiUyUzQyUyhBlRphcxhBdBhBdBhRlRphlRhRlixytixy617IyFyEyEt0yU2VIhIiQyUzUyUzUzUzZDUyZDhBlRhRdBYxlSty2S/D+y2iyCuClS6l2kyEuVymyVyD2U6lyE2lMiMiQyUzYzZDZDdDUzZDZDdChBcxdBti2C6i6y6y/C/C/C/Cpyt1p0p0uE2V6l2lyDpypiyDhTQiQiUzYzdDdDdDQyQiQyUyhBdBti2S6i+y/C/C6z2S6y/CljdUdDdEdDdDdTdCdChjl0dTQyQiQiMiQyYzZDUyMiQiQiQytitixyxyxy2C6S/C/C7E2D2SlSy4uomGdUdEdDdDdDhlmWiGZTQyUyIhIhIiIiIiMiMiIiMityxyxyxyxyxyxy1y6S+y6yxylD23yomGh2dDdDhSZCUzZkd0dkQyUzMiIhIhIhIiMiMiMiMitxtytyxyxzxyxytixi2C6iyCpT6364ymiFmGdUZChCYyZTZUdkMyQyMiIhIhIhIhIhIiIhIiph2BtytixititSxixyxyxyxypi63yVy43Ku4qndlhShRhSdSdRdBZCZCIhIRIiMiIhMiIihj2U2C2Bxxtytitytixytitixyti2VyTh0mWqWmWqWmGmGqFlilRlhhRlSpidSUzUzUzUzUzyV2l6l2T6j2B2ByBtytitixyxyxy6i/C/DyTt0x1p0lzqDqE2kySySpxlihChSlidCZDZDYzlj2U6l6l626l6l2kyCtytitixyxyyS60/F+yyD2H2I13x02S2i2i6y/C/D+y2iyClShSdDdDdTp0qEl0dThjhjh0p0uDuCyC2VxzyCty616R1yx02I2I2I13x02S2i20/X/C/E/E6zyCl1mGdkZDZDdlZUQyVCZTdjdjhjuCtytz/Vxy2C+z6Q2C112I131213x2xz6i+y/C/C/X/s61uVu4qXhldDdUh1ZkRCVTVCVCZTZTpy2R2k/Gxy2C6R6Qxz1312101z10x11z2C+y/C/C/p/qyT3K3K3Kl2ZDd0ZTZTdjdjVDQyVTdkuopixx2Qpi2C6A6Btk131z1z1z1z1z1z2C+y/C/D/q6zy53K3K3KdUdkVDdjdjdjdjVTMydl3K6ytiphxxtixy6B1yx0xzxj1z1z1z1z1z6j+y/C6z/Fyl3K3K3Ky5dkVDVCdjdjdjdjRCd13K/C+yySphtRpRpixy2C2C2C6S6S1z1z1z/J/F+x6h6i2j3K3K3Ku4d0QyQyRCZTdjdjdjdku4+y/C/CyChClCxy6R6R+y/C/C/C6S1z1z2E/a626Q6S60uouodlVDMyQyQyQyQyVDdjdjdkh1+y/C+y+ytilSxy2C6R+h+y/C/C+y1ztjlTpjtjxz1ztzVDQyQyQiMiMiQyQyQyQyQyVCZTdk/C+y+y+y+ypixy2C2C2C2B6g+x/C6S1z1zxzxzxz2DljIiMiQjQjMiIiMyQyQyQyQyQyQyVC', 'base64')),
  ('c121', decode('RGRHV5RnUzQyMiIiIhIiVUVWmaqadpdph5qKiamrmbiaiJRWVWdWhWhWVGRGRGNGNFNGNGRWNXN5VVQyIiMiIhIhIhZVdnZod4h4dod4VXVWVWVWiJd5qriJdnVWVGRGRGRGRGNFNFNFNFRGV3VDMyIhIhIiIhMyVUmJVXRWh4d4VGZWZGZGZGVWh4RWZnZnVnZoZXRGRGRGNFNFNFNFNFNFQyIiIiIhIhIhMyZlh5mJVGVGmJh4VFRFRFNFNFNFd4RFNFd4RFVGZGZGVFRFRFNFNFNFNFNFIiIiIiIhIiMyVEaJVWd4M1NFiId3M0M1M1M1M1M1d3RFNFd4VFVFlWpmhWVFRFM1M1M1RGM1IiIiIhIhMzVDRoVGZnVWM0M0iIZmM0M0M1M1M1M1VWVWRGZnZndW2X7K2HZGRFM1M1M1NFM1IiIhIhRDRDRFRGM0d3M0IjIjmIVWM0M0M0M0M0M0RFdnM0RFmIhW65/92odWRFM1M1M1M1M1IhIhIiMzVDRYM1M0ZnMzIiIiqZRXVXZWZGQ0REM0M0dnM0Q1mIlW2F63x1hWQ1M1M0M0M0M0IhIhIiRERWRpM0M0ZmIjIiMzqqVVMiMiQzdlVXNEM0ZmM0M0VVdmZFhVZFQ1M0M0M0M0M1NFIhIhMyQzNFRHM0RERFIjMzRWuqQydCdDQzQzdUVnM0VWM0M0M0d3M0M0M0M0M0M0I1M2ZVNGIhERIiQyREVHQ0VWIjMzVEZ4l3dDpTxjpjhTlkuWNEREREMzMzZmM0M0MzMzM0I1JHZDiIRFIRIhIhIiRDZGZGVWIjMzdnZohmhEpTxjxzxz2D2lRVMjVVIjIjM0VVIjIjIjI1I3dDRFZoM2MhERIhIiQzVDhXZWIjIjd4RGl3dDhCtjxzxz2DymREIjVVIjIjIjZmIjIjIkM2hTZFRXdmZEQyIhERIhMiVDZVh5M0Mjh4Q0qIczZUYztkpjyDyoMjIjVVIjIjIjVWMjIjI1ZUhDcydDZnRGQyIhERIRIhQyh2Z5ZGM0VoQjqJpUtkhEpkllpjl3MjIjVFIjIjIjMzVVIjVFhTlmYycyhVdDRDMiIRIRIiQyZlRWdYQ1WLRFmJhUlUlTx0xzyEVFIiIiMzREIjIjIjZmIkZEdCdUUycydWRGVVQyIhIhIiQzZVQzVFdZicQ1mIZEUzUztjxzp1MjIiIiIiVVIjIjIjVVM1VEhDhVYzY0VmZmZEREMiIhIiMiVEMyQzZmisMjh4VEdEhEpkt1dWIiIiIjIjVFIjIjIjIjZoQzU0ZWVGhnVFMzdEVEQzIiIhREIiIhIiQyQzMidmVEdElTlUmIQ0IjIjIjIjVVIjIjIjIjZ4QyIiMidVVEREIjY1lVREMiIhVUIhIiIhMyMiIhZlREQyYyZUiIMzMjIjI0I0VVM0I0I0I1VnRDIiMiZVIjREMzQ1tohnMzIiVUIhIiIhIiIiMiVVVUIiIiZ3VXM0M0M0M1M1NFVWM1M1I2REZmIiMiVVMzM0REM1dYt5RFMzVVERERIhIiIiMzREVUIiMiSJVIM2M1NGNGNGNFVnM1M2JHRDZmIiMyZmM0M0RWRHhZpJVYVVMzERERERIhIiREZVZVMiIiRWaLZpNHNHNGNGNGVoNGNYR5QzVUVEMyVXRGNFVWVZt6tZZpd3ZTVUVUMzIhIhVEdVZVMyMiIiZmm9h6NZNINHNHZpNHmbZ3MyMyZmQyRXVoNHVn', 'base64')),
  ('c122', decode('eGVliYm5m5u4umzIqWdkZkqmZ2Z2Z2RVRVVmRFNEM0I0IzI0M0I0I0I0I0IzIzRDIzMzMzIjZ2d2VmrKvbvLiGumZkd2mXmFh1d1ZmVVVVVVRVNENEM0M0M0M0I0IzIzIzIzIzREIzIiMzIjZ2iXRERVZ2mpvJu3um3YumhlVUmVZ2eGVlRVZ2RERERFRERVVmVlRVI0I0NERERDRDMzMzIjeYiYRUiWd2REREZlZUunhkd2qoqVd0iFZ2ZlVVRERFRVVVRERVRVRVNEI0I0VUMzMzMzMzEiiqiZVmiWq4moiGVlREd1uniFumh1REd0h1ZlVlVlZ2Z2eGeHRVNEM0IzIzNEREREQzIjQ0IjrMiqaIiXm5m5q5m5mod2ZUqWqVVUeGmFl1mGqnmniXm4eXVVRFNEMzIzIzREMzREREREIjIjvMvMiqiYm5m5q5q5m5mYVEZmu3unzHmFunqoeGeHeXeHVlREVVREMzIzIzIzM0IzIzREIjM0m7vMzcipq6q6q6vKvKvKq5mqeHdUy3u5q6eHZmd3Z2ZmVVVEVFM0IzIjIzREM0IzMzQ0IjM0iYvMzceYm5rKrKvLvLzLvcrLvKVEzK3cvLVWd3Z2ZmREVVREREVVVVVVVVRFVVZnREIjI0RFrLvMrLaHmovLvLvMzczcrLzLmYqo7r3bZmVFVViHiYiHiHiHiHeGd3Z3VWNFM0VGM0IjM0VFq6vLeId3u6zczczczciZd3d2qpzK7rmHVFZFmYzcm7mpmpmoq4mYVVVVRFM0MzQ0IjIjQ1VFm5mpVViHzb3c3s3cq7q7zbmpq6u63KZVZVh33bzczcqqmYmXmYiHQ0REVVM0MzMjMzM0RFVFq5ZmVEu53c3c3szcm6zbzLvLvLzKuozKu6zK7r3sqqVFZEZUZUdUMzQ0Q0Q0M0IjIjM0RFVFiHM0dlzLzLzczcrMq6zbzLvLzLmYzKzK3b3b3cu6VVQ0ZEdUZEZUMzQ0Q0M0IjIjIjIjM0RFREREqozbzbzczcmqiHiIvMzLu5u5zKzKzbzKzLZmVFQ0VEZVd2h2VVM0MzIzIjIzVVM0I0Q1M0d2vKzLvLvMiZmpqovKvLzKmXzKzKvKu5vKd3VVZEVEZVu6mpiZd3ZmVVZmVWRFM0ZnM1M0VVq5zLvLvLmqiZmomYzbvKqou4zKvKu5u5d2h2dmZVZEqozbvMm7mqmZqqZnd4ZWRFRFI0M0mXq6q7rLrLrLeYiHq5zavJmXzJvKvKq5h2ZFZVdmiHmYzLzbzczcd4VVREM0REM0IzIzIjI0mpiZeZiqm7rLiYiXvKzKqoq4zKvKvKmYZEZVd3h3qYmpzb3bvLdoZFZEVEQ0VEQ0M0IjIzM0iZeZeZeZiqrLZ2q5vKzKmXzKzKvJu5ZFdmd3d3iHmIqqzLu6dWVEVEdEZEVEZFVEM0M0IzM1eIaHaHaYi7eJiHq5vJqpu5zKvKvKdmdmiId3dnh3qYu7qqdnZFU0U0hVdVQ0VEREMzIzIjM0Z3VmVmWIiqVniHmovJmHzKzKvKmYdViYiHdndnmIuqu6dnU1ZEZEQ0ZWZXZXRFM0M0M0VVM0V2VmRmVnZ4VViHiXmYqozKvKu5dViId3dndniJzMqadWdFZFZFU0dnuqmad6ZoVXVWRGM1RVRWRmRVRVVmeGiXiXiGu5u6u5dld3d3dndnh4u7mJdGZFU0ZFhnZWuqqru8mbmamJVFRFI0RF', 'base64'))
on conflict (card_id) do update set data = excluded.data;


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
