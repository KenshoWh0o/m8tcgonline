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
-- Version 3.0 : les Secretes (24_secretes.sql). Hors des 122 comme
-- les Promos (`promo`), tirees a la place du hit une fois sur 133, et
-- echangeables (`secrete`) — mais ni recyclables ni fabricables.
alter table public.cards add column if not exists secrete boolean not null default false;
create index if not exists cards_rar_idx on public.cards (rar) where in_booster;

-- ------------------------------------------------------------ collection
create table if not exists public.collection (
  user_id  uuid not null references public.profiles on delete cascade,
  card_id  text not null references public.cards on delete cascade,
  qty      integer not null default 0 check (qty >= 0),
  first_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- La maitrise des cartes du pre-build 3.0 a ete retiree : son compteur
-- d'exemplaires obtenus disparait si une base de test l'a encore.
drop trigger if exists collection_total on public.collection;
drop function if exists public.collection_total();
alter table public.collection drop column if exists total;

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
    check (categ in ('boosters','echange','cosmetique','promo','evenement','invitation','tapis','sleeve'));
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
    -- Recyclage (supabase/installation/12_recyclage.sql) : ce que rapporte un doublon jete,
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
    -- La chasse a la carte unique (supabase/installation/15_evenements.sql) : une chance
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

-- =====================================================================
--  La maintenance (version 3.0.12)
-- =====================================================================
-- Une ligne : en maintenance ou non, le message a montrer, l'heure de retour
-- prevue (affichee seulement : la maintenance ne finit que quand un
-- administrateur la leve, Labo › Serveur, labo_maintenance dans
-- 29_labo.sql), depuis quand, et par qui. Pendant une maintenance,
-- garde_beta() refuse toute action du jeu a qui n'est pas administrateur, et
-- la page montre l'ecran de maintenance (js/gate.js) a tous les autres.
--
-- Une base 2.x qui recoit la 3.0 avec des joueurs entre d'office en
-- maintenance : la page de la 2.x encore ouverte chez eux ne doit pas jouer
-- sur une base 3.0, et le site 3.0 attend que l'administrateur l'ait
-- verifie. La detection se fait a la creation de la table, donc une seule
-- fois : sans table `combat_joueurs` (une base qui n'a jamais eu la 3.0) et
-- avec au moins un profil. Une installation neuve, elle, n'a personne.
--
-- Version 3.0.17 (le proprietaire, 8 novembre 2026 : « programmer la
-- maintenance […] pour la date prevue, et tout automatiser ») : `fin_auto`.
-- Vraie, la maintenance se leve d'elle-meme a son heure de retour (`fin`) :
-- maintenance_active() ne la compte plus, porte() ne la montre plus, et les
-- ecrans de maintenance rechargent la page (js/gate.js). La maintenance de la
-- mise a jour se leve d'elle-meme a la sortie, lundi 9 novembre 2026, 0 h
-- (heure de Paris ; le proprietaire, 8 novembre : « maintenance a 23h50,
-- sortie a minuit ») ; collee plus tard, cinq minutes apres. Un
-- administrateur peut la lever plus tot, ou la prolonger (Labo › Serveur).
do $$
begin
  if to_regclass('public.maintenance') is null then
    create table public.maintenance (
      id      int primary key check (id = 1),
      actif   boolean not null default false,
      message text,
      fin     timestamptz,
      fin_auto boolean not null default false,
      depuis  timestamptz,
      par     text
    );
    insert into public.maintenance (id, actif, message, fin, fin_auto, depuis, par)
    select 1, true, 'La version 3.0 arrive : le jeu est en maintenance le temps de la mise à jour.',
           greatest(timestamptz '2026-11-09 00:00:00+01', now() + interval '5 minutes'),
           true, now(), 'la mise à jour 3.0'
     where to_regclass('public.combat_joueurs') is null and exists (select 1 from public.profiles);
  end if;
end $$;
alter table public.maintenance add column if not exists fin_auto boolean not null default false;
insert into public.maintenance (id) values (1) on conflict (id) do nothing;
alter table public.maintenance enable row level security;
revoke all on public.maintenance from anon, authenticated;

-- La maintenance compte-t-elle en ce moment ? Allumee, et pas passee son
-- heure de retour si elle se leve d'elle-meme (fin_auto, 3.0.17).
create or replace function public.maintenance_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.actif and not (m.fin_auto and m.fin is not null and now() >= m.fin)
                     from maintenance m where m.id = 1), false);
$$;
revoke all on function public.maintenance_active from public, anon, authenticated;

-- Ce que l'ecran d'attente a besoin de savoir, sans compte : est-ce ouvert,
-- quand ca ouvre, et quelle heure il est ICI. Le navigateur compte ensuite le
-- temps ecoule avec une horloge que l'utilisateur ne peut pas regler
-- (performance.now()), jamais avec la date de l'appareil.
-- Version 3.0.12 : la version de la base (une page 3.0 devant une base qui
-- n'a pas encore recu la 3.0 montre l'ecran de maintenance, js/gate.js) et
-- la maintenance en cours. `security definer` : la table maintenance n'est
-- lisible que par lui.
create or replace function public.porte() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ouvert', beta_ouverte(),
                            'lancement', beta_lancement(),
                            'serveur', now(),
                            'version', '3.0',
                            'maintenance', (select case when maintenance_active() then jsonb_build_object(
                                                     'message', m.message, 'fin', m.fin, 'depuis', m.depuis,
                                                     'auto', m.fin_auto) end
                                              from maintenance m where m.id = 1));
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
-- Version 3.0.14 : la meme garde pour un joueur donne. La fonction qui
-- verifie les combats (supabase/functions/combat-verifier) appelle le
-- serveur avec la cle de service : auth.uid() y est vide, elle dit pour qui.
create or replace function public.garde_beta_de(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- L'ordre des deux tests compte : passe la date d'ouverture, on ne consulte
  -- plus la liste du tout. C'est le cas de la quasi-totalite des appels apres
  -- le lancement, et il ne coute alors rien.
  if not beta_ouverte() and not est_invite(p) then
    raise exception 'BETA_FERMEE';
  end if;
  -- Version 3.0.12 : pendant une maintenance, seuls les administrateurs
  -- jouent (une ligne lue par sa cle : rien a payer le reste du temps).
  if maintenance_active()
     and not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'MAINTENANCE';
  end if;
end $$;

create or replace function public.garde_beta() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform garde_beta_de(auth.uid());
end $$;

-- `public` d'abord : Postgres accorde l'execution a tout le monde par defaut,
-- et `anon` en herite. Ne retirer le droit qu'a `anon` et `authenticated`
-- laissait donc ces deux fonctions appelables sans compte — on pouvait sonder
-- la liste des invites identifiant par identifiant.
revoke all on function public.est_invite, public.garde_beta, public.garde_beta_de from public, anon, authenticated;

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

-- Version 3.0 : l'XP de combattant d'un joueur (26_niveaux.sql), pour le
-- niveau pose sur son avatar partout ou son cadre s'affiche (amis, boite,
-- classements, defis, evenement, fiche). La page calcule le niveau, comme
-- pour me(). La table des combats vient plus loin (23_combats.sql) : tant
-- qu'elle n'existe pas, c'est 0. Rouage interne, comme photo_discord.
create or replace function public.xp_de(p uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  select x.xp into v from combat_joueurs x where x.user_id = p;
  return coalesce(v, 0);
exception when undefined_table or undefined_column then
  return 0;
end $$;
revoke all on function public.xp_de(uuid) from public, anon, authenticated;

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
  -- Une quete d'evenement n'avance que pendant son evenement (version 3.0) :
  -- sans ce filtre, les quetes « ev » (sur toute la duree) d'un evenement
  -- futur commenceraient avec de l'avance.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), amount from quests q
   where q.metric = m and (q.evenement is null or q.evenement = evenement_en_cours())
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

  -- Version 2.1 : le plus d'exemplaires d'une meme carte classique d'une
  -- rarete (« ex_R », « ex_E », « ex_L ») — ni Reverse, ni Promo.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all',
         coalesce((select max(c.qty) from collection c join cards k on k.id = c.card_id
                    where c.user_id = p and not k.promo and not k.reverse
                      and k.rar = substr(q.metric, 4)), 0)
    from quests q where q.metric like 'ex\_%'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress);
end $$;

drop function if exists public.seuil_maitrise(text, int);

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
