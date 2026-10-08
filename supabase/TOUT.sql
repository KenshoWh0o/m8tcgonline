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
  ('m_cartle10','milestone', 'cartle',     10,         0, 't_devin',  'Le Devin',             'Résous 10 Cartle.', 24),
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
  'd_revR','w_revR','m_revC','m_revPC','m_revR','m_revALL','m_master','m_brill','m_packs300','m_cartle10','m_invite',
  'e_check','e_packs','e_cartle','e_revR','e_titre','e_perso','e_revC','e_rev30','e_trade','e_cartle7','e_packs50',
  'e_recycle','e_invite');

-- ------------------------------------------------- l'evenement « Reflets »
-- Ses quetes paient en Prismes (21_reflets.sql). Du jour : ~70 Prismes pour
-- qui les fait toutes. De l'evenement, une fois : 440. Elles portent sur les
-- nouveautes de la 2.0 — c'est le role de l'evenement de les faire essayer.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie) values
  ('e_check',   'ev_jour', 'checkin',   1, 10, null, 'Un reflet par jour',     'Passe voir l''événement aujourd''hui.', 1, 'reflets', 'prismes'),
  ('e_packs',   'ev_jour', 'packs',     4, 15, null, 'Quatre boosters',        'Ouvre 4 boosters aujourd''hui.', 2, 'reflets', 'prismes'),
  ('e_cartle',  'ev_jour', 'cartle',    1, 25, null, 'Le Cartle du jour',      'Devine la carte du jour.', 3, 'reflets', 'prismes'),
  ('e_revR',    'ev_jour', 'rev_R',     1, 20, null, 'Reflet rare',            'Décroche une Reverse Rare.', 4, 'reflets', 'prismes'),
  ('e_titre',   'ev',      'titre',     1, 20, null, 'Un titre à ton nom',     'Équipe un titre sur ton profil.', 1, 'reflets', 'prismes'),
  ('e_perso',   'ev',      'perso',     1, 20, null, 'À ton image',            'Choisis une bannière ou une devise.', 2, 'reflets', 'prismes'),
  ('e_rev30',   'ev',      'rset_ALL', 30, 60, null, 'Trente reflets',         'Possède 30 Reverses différentes.', 3, 'reflets', 'prismes'),
  ('e_revC',    'ev',      'rset_C',   (select count(*)::int from public.cards where reverse and rar = 'C'),
                                              80, null, 'Toutes les Communes reverses', 'Possède toutes les Reverses Communes.', 4, 'reflets', 'prismes'),
  ('e_cartle7', 'ev',      'cartle',    7, 80, null, 'Devin de la semaine',    'Résous 7 Cartle pendant l''événement.', 5, 'reflets', 'prismes'),
  ('e_packs50', 'ev',      'packs',    50, 60, null, 'Cinquante boosters',     'Ouvre 50 boosters pendant l''événement.', 6, 'reflets', 'prismes'),
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
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un cadre animé qui balaie toutes les essences.',            5000, 'cosmetique', 1, null, true, 4)
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
  ('s_invite',     'invitation', 'Invitation', 'Un code pour faire entrer un ami. Il reçoit 5 boosters et 500 Éclats de bienvenue.',
                                                                                               2000, 'invitation', 1, null, false, 1, 'fragments', null, 3),
  ('ev_boosters',  'evenement', 'x2 Boosters',       'Deux boosters à ouvrir tout de suite.',     60, 'tickets',    2, null, false, 1, 'prismes', 'reflets', 5),
  ('ev_fragments', 'evenement', '500 Fragments',     'De quoi fabriquer les cartes qui manquent.', 50, 'fragments', 500, null, false, 2, 'prismes', 'reflets', 5),
  ('ev_reverse',   'evenement', 'Une Reverse Rare',  'Une Reverse Rare que tu n''as pas encore.', 120, 'reverse_R',  1, null, false, 3, 'prismes', 'reflets', 3),
  ('t_collect',    'evenement', 'Titre « Collectionneur de Reflets »', 'Un titre qui ne se vendra plus après l''événement.',
                                                                                                150, 'cosmetique', 1, null, true, 4, 'prismes', 'reflets', null),
  ('f_kaleido',    'evenement', 'Cadre « Kaléidoscope »', 'Un cadre animé, en vente pendant l''événement seulement.',
                                                                                                250, 'cosmetique', 1, null, true, 5, 'prismes', 'reflets', null)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy, ordre = excluded.ordre,
  devise = excluded.devise, evenement = excluded.evenement, limite = excluded.limite, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme',
  's_invite','ev_boosters','ev_fragments','ev_reverse','t_collect','f_kaleido');


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
-- ###  Version 2.0 : evenement Reflets, Cartle, invitations, titres
-- #####################################################################

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
