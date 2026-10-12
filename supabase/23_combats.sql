-- =====================================================================
--  Mate TCG Online — version 3.0 : les Combats
--  A executer apres 22_garder.sql. Rejouable sans danger.
--
--  Le combat lui-meme se joue dans le navigateur (js/combat/moteur.js) :
--  Postgres ne fait pas tourner le moteur. Le serveur tient tout ce qui
--  rapporte ou qui se partage :
--    1. la Section du joueur, ses decks, ses tapis et sleeves ;
--    2. l'ouverture et la cloture d'un combat contre l'IA, ce qu'il paie,
--       le plafond du jour, la campagne ;
--    3. les defis entre amis : le serveur range les actions dans l'ordre,
--       chaque navigateur rejoue celles de l'autre.
--
--  La Guerre des Sections du pre-build a ete retiree : ses tables et ses
--  fonctions sont supprimees plus bas si une base de test les a encore.
--
--  Ce que le serveur ne peut pas verifier, et ce qu'il fait a la place :
--  il ne rejoue pas une partie, donc il croit le navigateur sur son
--  resultat. Les garde-fous : il fixe la graine (la donne) de chaque combat,
--  un combat trop court ne paie pas (20 s), cinq victoires par jour au plus
--  sont recompensees, et les defis sont declares par les deux joueurs — un
--  desaccord est note (defis.desaccord).
--
--  Les valeurs (recompenses, niveaux) sont aussi dans js/combat/campagne.js,
--  pour l'affichage : les deux doivent rester d'accord.
-- =====================================================================

-- ============================================================ 1. tables
create table if not exists public.combat_joueurs (
  user_id      uuid primary key references public.profiles on delete cascade,
  section      text check (section in ('toxique', 'deter')),
  deck_actif   text,
  -- tapis, sleeve, jeton : identifiants d'inventaire (ou t_base, s_base, j_base)
  cosm         jsonb not null default '{}'::jsonb,
  -- La campagne : les combats deja gagnes (cp01 … cp20), et si elle est finie.
  faits        text[] not null default '{}',
  finie        boolean not null default false,
  -- Le plafond du jour : victoires recompensees contre l'IA, defis recompenses.
  jour         date,
  recompensees integer not null default 0,
  defis_jour   date,
  defis_rec    integer not null default 0,
  victoires    integer not null default 0,
  defaites     integer not null default 0,
  pvp_v        integer not null default 0,
  pvp_d        integer not null default 0
);

-- Un deck : { carte: exemplaires } et { couleur: Essences }. Il peut etre
-- incomplet (on le finira plus tard) : il ne se joue simplement pas.
create table if not exists public.decks (
  id         text primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  nom        text not null,
  cartes     jsonb not null default '{}'::jsonb,
  reserve    jsonb not null default '{}'::jsonb,
  couverture text,
  maj        timestamptz not null default now()
);
create index if not exists decks_user_idx on public.decks (user_id);

-- Un combat contre l'IA, entre son ouverture et sa cloture. Un seul a la
-- fois par joueur : en ouvrir un autre compte le precedent comme perdu.
create table if not exists public.combats_ouverts (
  id      text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  mode    text not null check (mode in ('campagne', 'infini', 'raid', 'epreuve')),
  cle     text not null,
  niveau  integer not null,
  phase   integer,
  jour    date not null,
  graine  bigint not null,
  debut   timestamptz not null default now()
);
create index if not exists combats_ouverts_user_idx on public.combats_ouverts (user_id);

-- La campagne : vingt combats, le niveau de l'IA et ce que paie la premiere
-- victoire. Copie de NIVEAUX_CAMPAGNE et RECOMPENSES_CAMPAGNE.
create table if not exists public.pve_campagne (
  n         integer primary key check (n between 0 and 19),
  niveau    integer not null,
  eclats    integer not null default 0,
  boosters  integer not null default 0,
  fragments integer not null default 0
);
insert into public.pve_campagne (n, niveau, eclats, boosters, fragments) values
  ( 0, 1,  80, 0,    0), ( 1, 1,  80, 0,    0), ( 2, 2, 100, 0,    0), ( 3, 2, 100, 0,    0),
  ( 4, 2, 150, 2,  300), ( 5, 2, 120, 0,    0), ( 6, 2, 120, 0,    0), ( 7, 3, 140, 0,    0),
  ( 8, 3, 140, 0,    0), ( 9, 3, 200, 3,  500), (10, 3, 160, 0,    0), (11, 3, 160, 0,    0),
  (12, 4, 180, 0,    0), (13, 4, 180, 0,    0), (14, 4, 250, 4,  800), (15, 4, 200, 0,    0),
  (16, 4, 200, 0,    0), (17, 5, 220, 0,    0), (18, 5, 220, 0,    0), (19, 5, 400, 5, 1200)
on conflict (n) do update set niveau = excluded.niveau, eclats = excluded.eclats,
  boosters = excluded.boosters, fragments = excluded.fragments;

-- Le PvE infini : ce que paie une victoire, selon la difficulte (DIFFICULTES).
-- Reequilibre pour la 3.0 : docs/economie-3.0.md.
create table if not exists public.pve_difficultes (
  niveau integer primary key check (niveau between 1 and 5),
  eclats integer not null
);
alter table public.pve_difficultes drop column if exists points;
insert into public.pve_difficultes (niveau, eclats) values
  (1, 10), (2, 15), (3, 25), (4, 35), (5, 50)
on conflict (niveau) do update set eclats = excluded.eclats;

-- Les deux Starter Decks (Decks.STARTERS, js/combat/decks.js). Ils sont
-- pretes : un defi joue avec l'un d'eux n'exige pas d'en posseder les cartes.
create table if not exists public.starters (
  section text not null check (section in ('toxique', 'deter')),
  card_id text not null references public.cards on delete cascade,
  n       integer not null,
  primary key (section, card_id)
);
delete from public.starters;
insert into public.starters (section, card_id, n) values
  ('toxique', 'p03', 1), ('toxique', 'c010', 2), ('toxique', 'c011', 2), ('toxique', 'c012', 2),
  ('toxique', 'c013', 2), ('toxique', 'c017', 1), ('toxique', 'c073', 2), ('toxique', 'c074', 1),
  ('toxique', 'c078', 2), ('toxique', 'c079', 1), ('toxique', 'c015', 2), ('toxique', 'c085', 2),
  ('toxique', 'c087', 1), ('toxique', 'c014', 1), ('toxique', 'c016', 2), ('toxique', 'c083', 2),
  ('toxique', 'c104', 1), ('toxique', 'c096', 1), ('toxique', 'c097', 1), ('toxique', 'c020', 1),
  ('deter', 'p04', 1), ('deter', 'c051', 2), ('deter', 'c052', 2), ('deter', 'c050', 1),
  ('deter', 'c077', 2), ('deter', 'c074', 1), ('deter', 'c076', 1), ('deter', 'c080', 2),
  ('deter', 'c081', 1), ('deter', 'c078', 2), ('deter', 'c059', 1), ('deter', 'c053', 2),
  ('deter', 'c087', 1), ('deter', 'c088', 2), ('deter', 'c054', 2), ('deter', 'c055', 2),
  ('deter', 'c083', 2), ('deter', 'c082', 1), ('deter', 'c092', 2);

-- La Guerre des Sections du pre-build : retiree.
drop function if exists public.marquer_points(uuid, int);
drop function if exists public.guerre_passee(uuid);
drop table if exists public.guerre_contrib;
drop table if exists public.guerre;

-- Les defis entre amis. Les decks sont au format du moteur ({ club: [ids],
-- reserve: [couleurs] }) ; `actions` : la partie, coup par coup.
create table if not exists public.defis (
  id           text primary key,
  de           uuid not null references public.profiles on delete cascade,
  pour         uuid not null references public.profiles on delete cascade,
  statut       text not null default 'attente'
               check (statut in ('attente', 'en_cours', 'fini', 'refuse', 'abandon')),
  deck_de      jsonb not null,
  deck_pour    jsonb,
  graine       bigint not null,
  actions      jsonb not null default '[]'::jsonb,
  cree         timestamptz not null default now(),
  maj          timestamptz not null default now(),
  vu_de        boolean not null default true,
  vu_pour      boolean not null default false,
  -- Ce que chacun declare a la fin : le gagnant (0 = celui qui defie).
  gagnant_de   integer,
  gagnant_pour integer,
  paye_de      boolean not null default false,
  paye_pour    boolean not null default false,
  desaccord    boolean not null default false,
  constraint defi_pas_soi check (de <> pour)
);
create index if not exists defis_de_idx on public.defis (de, statut);
create index if not exists defis_pour_idx on public.defis (pour, statut);

alter table public.combat_joueurs  enable row level security;
alter table public.decks           enable row level security;
alter table public.combats_ouverts enable row level security;
alter table public.pve_campagne    enable row level security;
alter table public.pve_difficultes enable row level security;
alter table public.starters        enable row level security;
alter table public.defis           enable row level security;
revoke all on public.combat_joueurs, public.decks, public.combats_ouverts, public.pve_campagne,
  public.pve_difficultes, public.starters, public.defis
  from anon, authenticated;

-- ============================================================ 2. outils
create or replace function public.jour_paris() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date; $$;

-- La ligne de combat d'un joueur, creee a la premiere visite.
create or replace function public.combat_joueur(p uuid) returns public.combat_joueurs
language plpgsql security definer set search_path = public as $$
declare c combat_joueurs;
begin
  insert into combat_joueurs (user_id) values (p) on conflict (user_id) do nothing;
  select * into c from combat_joueurs where user_id = p;
  return c;
end $$;

-- Deux cartes qui n'en font qu'une pour la limite d'exemplaires : une Reverse
-- et sa carte, l'illustration alternative d'une Promo, la Promo d'une
-- Legendaire (cleCopie, js/combat/decks.js).
create or replace function public.cle_copie(id text) returns text
language sql immutable as $$
  select case
    when id ~ '^r[0-9]' then 'c' || substr(id, 2)
    when id = 'p02' then 'p01'
    when id = 'p06' then 'c121'
    else id end;
$$;

-- Deux exemplaires au plus ; un seul pour une Legendaire, une Secrete, une
-- Promo ou l'Unique.
create or replace function public.limite_copies(cle text) returns integer
language sql stable security definer set search_path = public as $$
  select case when k.rar in ('L', 'S', 'UN', 'PR') or (k.promo and not k.reverse and not k.secrete) then 1 else 2 end
    from cards k where k.id = cle;
$$;

-- Ce qui ne va pas dans un deck (le premier probleme), ou null.
--   complet   : un deck qu'on va jouer — 30 cartes, 10 Essences, un Joueur ;
--   pretees   : les cartes pretees en plus de la collection (Starter Decks).
create or replace function public.deck_erreur(p uuid, cartes jsonb, reserve jsonb,
                                              complet boolean, pretees jsonb default '{}'::jsonb)
returns text language plpgsql stable security definer set search_path = public as $$
declare e record; k cards; nb int := 0; joueurs int := 0; ne int := 0; q int;
begin
  if jsonb_typeof(cartes) is distinct from 'object' or jsonb_typeof(coalesce(reserve, '{}'::jsonb)) <> 'object' then
    return 'Deck invalide.';
  end if;
  for e in select key, value from jsonb_each(cartes) loop
    if jsonb_typeof(e.value) <> 'number' then return 'Deck invalide.'; end if;
    q := (e.value)::text::int;
    if q < 0 or q > 4 then return 'Deck invalide.'; end if;
    continue when q = 0;
    select * into k from cards where id = e.key;
    if not found or k.cat not in ('joueur', 'coach', 'moment', 'objet') then
      return 'Une carte de ce deck ne se joue pas en combat.';
    end if;
    if coalesce((select c.qty from collection c where c.user_id = p and c.card_id = e.key), 0)
       + coalesce((pretees->>e.key)::int, 0) < q then
      return 'Tu n''as pas assez d''exemplaires de « ' || k.nom || ' ».';
    end if;
    nb := nb + q;
    if k.cat = 'joueur' then joueurs := joueurs + q; end if;
  end loop;
  -- La limite d'exemplaires, carte et Reverse ensemble.
  if exists (select 1 from jsonb_each(cartes) x
              group by cle_copie(x.key)
             having sum((x.value)::text::int) > limite_copies(cle_copie(x.key))) then
    return 'Trop d''exemplaires d''une même carte.';
  end if;
  for e in select key, value from jsonb_each(coalesce(reserve, '{}'::jsonb)) loop
    if e.key not in ('rose', 'orange', 'jade', 'violette', 'jaune', 'mauve', 'verte', 'bleue', 'azur')
       or jsonb_typeof(e.value) <> 'number' then
      return 'Couleur d''Essence inconnue.';
    end if;
    ne := ne + (e.value)::text::int;
  end loop;
  if complet then
    if nb <> 30 then return 'Le Club doit compter 30 cartes.'; end if;
    if joueurs = 0 then return 'Il faut au moins un Joueur.'; end if;
    if ne <> 10 then return 'La Réserve doit compter 10 Essences.'; end if;
  elsif nb > 30 or ne > 10 then
    return 'Deck trop grand.';
  end if;
  return null;
end $$;

-- Un deck au format du moteur ({ club: [ids], reserve: [couleurs] }), remis
-- au format d'un deck enregistre ({ cartes: {…}, reserve: {…} }).
create or replace function public.deck_depuis_moteur(d jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'cartes', coalesce((select jsonb_object_agg(v, n) from (
                 select x #>> '{}' v, count(*) n from jsonb_array_elements(d->'club') x group by 1) t), '{}'::jsonb),
    'reserve', coalesce((select jsonb_object_agg(v, n) from (
                 select x #>> '{}' v, count(*) n from jsonb_array_elements(d->'reserve') x group by 1) t), '{}'::jsonb));
$$;

-- Les cartes que les Starter Decks pretent a un joueur : celui de sa Section,
-- et l'autre une fois la campagne finie.
create or replace function public.cartes_pretees(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(card_id, n), '{}'::jsonb) from (
    select s.card_id, max(s.n) n from starters s join combat_joueurs c on c.user_id = p
     where s.section = c.section or c.finie
     group by s.card_id) t;
$$;

-- Un deck de defi (format du moteur) : complet, et possede ou prete.
create or replace function public.deck_defi_erreur(p uuid, d jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare x jsonb;
begin
  if jsonb_typeof(d->'club') <> 'array' or jsonb_typeof(d->'reserve') <> 'array' then return 'Deck invalide.'; end if;
  x := deck_depuis_moteur(d);
  return deck_erreur(p, x->'cartes', x->'reserve', true, cartes_pretees(p));
end $$;

-- ===================================================== 4. l'etat, dans me()
create or replace function public.combat_etat(p uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c combat_joueurs := combat_joueur(p);
begin
  return jsonb_build_object(
    'section', c.section,
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nom', d.nom, 'cartes', d.cartes,
                                                          'reserve', d.reserve, 'couverture', d.couverture) order by d.maj)
                         from decks d where d.user_id = p), '[]'::jsonb),
    'deck_actif', c.deck_actif,
    'cosm', c.cosm,
    'campagne', jsonb_build_object('faits', to_jsonb(c.faits), 'finie', c.finie),
    'jour', jsonb_build_object('recompensees', case when c.jour = jour_paris() then c.recompensees else 0 end,
                               'plafond', 5),
    'stats', jsonb_build_object('victoires', c.victoires, 'defaites', c.defaites,
                                'pvp_v', c.pvp_v, 'pvp_d', c.pvp_d),
    -- L'XP de combattant (26_niveaux.sql) : le niveau se calcule dans la page.
    'xp', c.xp,
    'defis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame, 'xp', xp_de(o.id), 'photo', photo_discord(o.id),
               'pour_moi', d.pour = p, 'statut', d.statut,
               'vu', case when d.de = p then d.vu_de else d.vu_pour end) order by d.cree)
        from defis d join profiles o on o.id = case when d.de = p then d.pour else d.de end
       where (d.de = p or d.pour = p) and d.statut in ('attente', 'en_cours')), '[]'::jsonb));
end $$;

-- ===================================================== 5. Section, reglages, decks
create or replace function public.combat_section(p_section text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c combat_joueurs;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_section not in ('toxique', 'deter') then raise exception 'Section inconnue.'; end if;
  c := combat_joueur(p);
  if c.section is not null then raise exception 'Tu as déjà rejoint une Section.'; end if;
  update combat_joueurs set section = p_section where user_id = p;
  -- La Promo de sa Section (03b_promos.sql), et son Starter Deck, prete.
  insert into collection (user_id, card_id, qty)
  values (p, case p_section when 'toxique' then 'p03' else 'p04' end, 1)
    on conflict (user_id, card_id) do nothing;
  return me();
end $$;

-- Le deck actif, le tapis, le sleeve, le jeton : on ne choisit que ce qu'on a.
create or replace function public.combat_reglages(p_reglages jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c combat_joueurs; k text; v text; base text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  c := combat_joueur(p);
  if p_reglages ? 'deck_actif' then
    update combat_joueurs set deck_actif = left(p_reglages->>'deck_actif', 40) where user_id = p;
  end if;
  foreach k in array array['tapis', 'sleeve', 'jeton'] loop
    v := p_reglages->>k;
    continue when v is null;
    base := case k when 'tapis' then 't_base' when 'sleeve' then 's_base' else 'j_base' end;
    if v <> base and not exists (select 1 from inventory where user_id = p and item_id = v and qty > 0) then
      raise exception 'Tu ne possèdes pas cet objet.';
    end if;
    if k <> 'jeton' and (c.cosm->>k) is distinct from v then perform bump_quests(p, 'cosm', 1); end if;
    update combat_joueurs set cosm = cosm || jsonb_build_object(k, v) where user_id = p;
  end loop;
  return me();
end $$;

-- Enregistrer un deck : 20 au plus ; les cartes possedees ; la limite
-- d'exemplaires respectee. Un deck incomplet s'enregistre.
create or replace function public.deck_sauver(p_deck jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c combat_joueurs; did text; err text; nom text; n int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  c := combat_joueur(p);
  err := deck_erreur(p, p_deck->'cartes', coalesce(p_deck->'reserve', '{}'::jsonb), false);
  if err is not null then raise exception '%', err; end if;
  nom := coalesce(nullif(left(trim(p_deck->>'nom'), 32), ''), 'Mon deck');
  did := p_deck->>'id';
  if did is null or not exists (select 1 from decks where id = did and user_id = p) then
    if (select count(*) from decks where user_id = p) >= 20 then raise exception '20 decks au plus.'; end if;
    did := 'd' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  end if;
  insert into decks (id, user_id, nom, cartes, reserve, couverture, maj)
  values (did, p, nom, p_deck->'cartes', coalesce(p_deck->'reserve', '{}'::jsonb), left(p_deck->>'couverture', 8), now())
  on conflict (id) do update set nom = excluded.nom, cartes = excluded.cartes, reserve = excluded.reserve,
    couverture = excluded.couverture, maj = now();
  if c.deck_actif is null then update combat_joueurs set deck_actif = did where user_id = p; end if;
  select coalesce(sum(value::text::int), 0) into n from jsonb_each(p_deck->'cartes');
  if n = 30 then perform bump_quests(p, 'deck', 1); end if;
  return me();
end $$;

create or replace function public.deck_supprimer(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  delete from decks where id = p_id and user_id = p;
  update combat_joueurs set deck_actif = null where user_id = p and deck_actif = p_id;
  return me();
end $$;

-- ===================================================== 6. un combat contre l'IA
-- combat_debut : le serveur ouvre le combat et tire la graine. Le Raid
-- (27_raid.sql) et l'Epreuve du jour (25_choc.sql) fixent eux-memes le
-- niveau de l'IA, le niveau du boss (`phase`) et la graine.
create or replace function public.combat_debut(p_mode text, p_cle text, p_niveau int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c combat_joueurs; v_n int; niv int := p_niveau; ph int; gr bigint; x jsonb;
        cid text; ouverts int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  c := combat_joueur(p);
  if c.section is null then raise exception 'Rejoins d''abord une Section.'; end if;
  if p_mode not in ('campagne', 'infini', 'raid', 'epreuve') then raise exception 'Mode inconnu.'; end if;
  gr := floor(random() * 4294967295)::bigint + 1;
  if p_mode = 'campagne' then
    if p_cle !~ '^cp(0[1-9]|1[0-9]|20)$' then raise exception 'Combat inconnu.'; end if;
    v_n := substr(p_cle, 3)::int - 1;
    if v_n > 0 and not (('cp' || lpad(v_n::text, 2, '0')) = any(c.faits) or p_cle = any(c.faits)) then
      raise exception 'Gagne d''abord le combat précédent.';
    end if;
    select niveau into niv from pve_campagne where n = v_n;
  elsif p_mode = 'infini' then
    if p_niveau is null or p_niveau not between 1 and 5 then raise exception 'Difficulté inconnue.'; end if;
  else
    x := case when p_mode = 'raid' then raid_debut(p, p_cle) else choc_debut(p, p_mode, p_cle) end;
    niv := (x->>'niveau')::int; ph := (x->>'phase')::int; gr := (x->>'graine')::bigint;
  end if;
  -- Un seul combat ouvert a la fois : le precedent compte comme perdu.
  delete from combats_ouverts where user_id = p;
  get diagnostics ouverts = row_count;
  if ouverts > 0 then update combat_joueurs set defaites = defaites + ouverts where user_id = p; end if;
  cid := 'cb' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
  insert into combats_ouverts (id, user_id, mode, cle, niveau, phase, jour, graine)
  values (cid, p, p_mode, p_cle, niv, ph, jour_paris(), gr);
  return jsonb_build_object('id', cid, 'graine', gr);
end $$;

-- combat_fin : le resultat, et ce qu'il rapporte. `p_resume` : ce que le
-- navigateur dit du combat (vaincus, touches, tours, PV) — pour les quetes,
-- et pour les degats du Raid.
create or replace function public.combat_fin(p_id text, p_gagne boolean, p_resume jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c combat_joueurs; o combats_ouverts; r jsonb; trop boolean;
        v_n int; pc pve_campagne; pd pve_difficultes; g_eclats int := 0; g_boosters int := 0; g_fragments int := 0;
        carte text; msg text := ''; plafond boolean; autre text; v_xp jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from combats_ouverts where id = p_id and user_id = p for update;
  if not found then raise exception 'Ce combat n''est plus ouvert.'; end if;
  delete from combats_ouverts where id = p_id;
  c := combat_joueur(p);
  if c.jour is distinct from jour_paris() then
    update combat_joueurs set jour = jour_paris(), recompensees = 0 where user_id = p;
    c.recompensees := 0;
  end if;
  trop := now() - o.debut < interval '20 seconds';
  perform bump_quests(p, 'combats', 1);

  if not coalesce(p_gagne, false) then
    update combat_joueurs set defaites = defaites + 1 where user_id = p;
  else
    update combat_joueurs set victoires = victoires + 1 where user_id = p;
    perform bump_quests(p, 'victoires', 1);
    perform bump_quests(p, 'vaincus', least(20, greatest(0, coalesce((p_resume->>'vaincus')::int, 0))));
    if o.niveau >= 4 then perform bump_quests(p, 'victoires_dures', 1); end if;
    if o.niveau >= 5 and o.mode = 'infini' then perform bump_quests(p, 'legende', 1); end if;
  end if;
  -- L'XP, sans limite par jour (26_niveaux.sql) : tout combat fini en
  -- rapporte, sauf un combat trop court.
  if not trop then
    v_xp := gagner_xp(p, xp_combat(o.mode, o.niveau, coalesce(p_gagne, false),
                                 coalesce((p_resume->>'vaincus')::int, 0), coalesce((p_resume->>'tours')::int, 0)));
  end if;

  -- Le Raid (27_raid.sql : Insignes pendant le Choc, Eclats sinon) et
  -- l'Epreuve du jour (25_choc.sql, en Insignes).
  if o.mode in ('raid', 'epreuve') then
    r := case when o.mode = 'raid'
              then raid_fin(p, o, coalesce(p_gagne, false), coalesce(p_resume, '{}'::jsonb), trop)
              else choc_fin(p, o, coalesce(p_gagne, false), coalesce(p_resume, '{}'::jsonb), trop) end;
    return jsonb_build_object('etat', me(), 'recompense', r || jsonb_build_object('xp', v_xp));
  end if;

  if not coalesce(p_gagne, false) then
    msg := 'Pas d''Éclats pour une défaite, mais l''XP compte.';
  elsif trop then
    msg := 'Combat trop court pour être récompensé.';
  else
    plafond := c.recompensees < 5;
    if o.mode = 'campagne' then
      v_n := substr(o.cle, 3)::int - 1;
      if not (o.cle = any(c.faits)) then
        select * into pc from pve_campagne where n = v_n;
        update combat_joueurs set faits = array_append(faits, o.cle) where user_id = p;
        perform bump_quests(p, 'campagne', 1);
        g_eclats := pc.eclats; g_boosters := pc.boosters; g_fragments := pc.fragments;
        if cardinality(c.faits) + 1 >= 20 and not c.finie then
          update combat_joueurs set finie = true where user_id = p;
          autre := case c.section when 'toxique' then 'p04' else 'p03' end;
          insert into collection (user_id, card_id, qty) values (p, autre, 1)
            on conflict (user_id, card_id) do nothing;
          carte := autre;
          msg := 'Campagne terminée : la Promo de l''autre Section est à toi.';
        end if;
      else
        if plafond then
          update combat_joueurs set recompensees = recompensees + 1 where user_id = p;
          g_eclats := 10;
        else
          msg := 'Victoires récompensées du jour atteintes : celle-ci est pour le plaisir.';
        end if;
      end if;
    else
      select * into pd from pve_difficultes where niveau = o.niveau;
      if plafond then
        update combat_joueurs set recompensees = recompensees + 1 where user_id = p;
        g_eclats := pd.eclats;
      else
        msg := 'Victoires récompensées du jour atteintes : celle-ci est pour le plaisir.';
      end if;
    end if;
    update profiles set shards = shards + g_eclats, boosters_bonus = boosters_bonus + g_boosters,
                        fragments = fragments + g_fragments
     where id = p;
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;

  return jsonb_build_object('etat', me(), 'recompense', jsonb_build_object(
    'eclats', g_eclats, 'boosters', g_boosters, 'fragments', g_fragments,
    'carte', carte, 'titre', null, 'message', msg, 'xp', v_xp));
end $$;

-- ===================================================== 7. les defis entre amis
create or replace function public.vue_defi(d public.defis, p uuid, depuis int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare moi int := case when d.de = p then 0 else 1 end; o profiles;
begin
  select * into o from profiles where id = case when moi = 0 then d.pour else d.de end;
  return jsonb_build_object(
    'id', d.id, 'statut', d.statut, 'moi', moi,
    'init', case when d.statut = 'attente' then null else jsonb_build_object(
              'decks', jsonb_build_array(d.deck_de, d.deck_pour),
              'noms', jsonb_build_array((select pseudo from profiles where id = d.de),
                                        (select pseudo from profiles where id = d.pour)),
              'graine', d.graine) end,
    'actions', coalesce((select jsonb_agg(x order by i) from jsonb_array_elements(d.actions) with ordinality t(x, i)
                          where i > coalesce(depuis, 0)), '[]'::jsonb),
    'adversaire', jsonb_build_object('nom', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
                                     'xp', xp_de(o.id), 'photo', photo_discord(o.id),
                                     'cosm', coalesce((select cosm from combat_joueurs where user_id = o.id), '{}'::jsonb)));
end $$;

create or replace function public.defi_lancer(p_pseudo text, p_deck jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); o profiles; err text; did text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Joueur introuvable.'; end if;
  if not exists (select 1 from friendships where a = least(p, o.id) and b = greatest(p, o.id) and accepte) then
    raise exception 'Tu ne peux défier que tes amis.';
  end if;
  perform combat_joueur(p);
  err := deck_defi_erreur(p, p_deck);
  if err is not null then raise exception '%', err; end if;
  if exists (select 1 from defis where statut in ('attente', 'en_cours')
              and ((de = p and pour = o.id) or (de = o.id and pour = p))) then
    raise exception 'Un défi est déjà en cours avec ce joueur.';
  end if;
  did := 'df' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
  insert into defis (id, de, pour, deck_de, graine)
  values (did, p, o.id, p_deck, floor(random() * 4294967295)::bigint + 1);
  perform notifier(o.id, 'defi', p, did);
  return me();
end $$;

create or replace function public.defi_repondre(p_id text, p_ok boolean, p_deck jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d defis; err text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into d from defis where id = p_id and (pour = p or de = p) for update;
  if not found or d.statut <> 'attente' then raise exception 'Ce défi n''est plus en attente.'; end if;
  if not coalesce(p_ok, false) then
    update defis set statut = 'refuse', maj = now() where id = d.id;
    return jsonb_build_object('etat', me());
  end if;
  if d.pour <> p then raise exception 'C''est à ton ami de répondre.'; end if;
  perform combat_joueur(p);
  err := deck_defi_erreur(p, p_deck);
  if err is not null then raise exception '%', err; end if;
  update defis set deck_pour = p_deck, statut = 'en_cours', vu_pour = true, vu_de = false, maj = now()
   where id = d.id returning * into d;
  perform notifier(d.de, 'defi_accepte', p, d.id);
  return jsonb_build_object('etat', me(), 'defi', vue_defi(d, p, 0));
end $$;

create or replace function public.defi_etat(p_id text, p_depuis int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d defis;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into d from defis where id = p_id and (pour = p or de = p);
  if not found then raise exception 'Défi introuvable.'; end if;
  if d.de = p and not d.vu_de then update defis set vu_de = true where id = d.id; end if;
  if d.pour = p and not d.vu_pour then update defis set vu_pour = true where id = d.id; end if;
  return vue_defi(d, p, p_depuis);
end $$;

-- Une action de plus. `p_n` : le nombre d'actions que le navigateur connait
-- deja ; s'il ne correspond pas, l'autre a joue entre-temps.
create or replace function public.defi_jouer(p_id text, p_n int, p_action jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d defis;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into d from defis where id = p_id and (pour = p or de = p) for update;
  if not found or d.statut <> 'en_cours' then raise exception 'Ce défi n''est plus en cours.'; end if;
  if p_n <> jsonb_array_length(d.actions) then raise exception 'Actions désynchronisées.'; end if;
  if jsonb_array_length(d.actions) >= 5000 then raise exception 'Ce défi est trop long.'; end if;
  if jsonb_typeof(p_action) <> 'object' or length(p_action::text) > 2000 then raise exception 'Action invalide.'; end if;
  update defis set actions = actions || jsonb_build_array(p_action), maj = now() where id = d.id;
  return jsonb_build_object('n', jsonb_array_length(d.actions) + 1);
end $$;

-- La fin d'un defi, declaree par chacun des deux : qui a gagne (0 : celui
-- qui a defie). Chacun est paye sur sa propre declaration, une fois ; si
-- les deux declarations divergent, le defi est marque `desaccord`.
create or replace function public.defi_fin(p_id text, p_gagnant int default null, p_tours int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d defis; c combat_joueurs; moi int; gagne boolean;
        g_eclats int := 0; msg text := ''; deja boolean; v_xp jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into d from defis where id = p_id and (pour = p or de = p) for update;
  if not found then raise exception 'Défi introuvable.'; end if;
  if d.statut not in ('en_cours', 'fini', 'abandon') then raise exception 'Ce défi n''a pas été joué.'; end if;
  if p_gagnant is null or p_gagnant not in (0, 1) then raise exception 'Le défi n''est pas fini.'; end if;
  moi := case when d.de = p then 0 else 1 end;
  deja := case when moi = 0 then d.paye_de else d.paye_pour end;
  if moi = 0 then
    update defis set gagnant_de = p_gagnant, paye_de = true where id = d.id;
  else
    update defis set gagnant_pour = p_gagnant, paye_pour = true where id = d.id;
  end if;
  update defis set statut = case when statut = 'en_cours' then 'fini' else statut end, maj = now(),
                   desaccord = gagnant_de is not null and gagnant_pour is not null and gagnant_de <> gagnant_pour
   where id = d.id;

  if not deja then
    c := combat_joueur(p);
    if c.defis_jour is distinct from jour_paris() then
      update combat_joueurs set defis_jour = jour_paris(), defis_rec = 0 where user_id = p;
      c.defis_rec := 0;
    end if;
    gagne := p_gagnant = moi;
    update combat_joueurs set pvp_v = pvp_v + case when gagne then 1 else 0 end,
                              pvp_d = pvp_d + case when gagne then 0 else 1 end
     where user_id = p;
    perform bump_quests(p, 'defis', 1);
    perform bump_quests(p, 'combats', 1);
    -- Un defi ou personne n'a presque rien joue ne paie pas : on ne gagne
    -- rien a s'accorder des victoires entre amis en trois clics.
    if jsonb_array_length(d.actions) < 12 then
      msg := 'Défi trop court pour être récompensé.';
    else
      if gagne then perform bump_quests(p, 'victoires', 1); end if;
      v_xp := gagner_xp(p, xp_combat('defi', 0, gagne, 0, coalesce(p_tours, 0)));
      if c.defis_rec < 3 then
        update combat_joueurs set defis_rec = defis_rec + 1 where user_id = p;
        g_eclats := case when gagne then 40 else 15 end;
        update profiles set shards = shards + g_eclats where id = p;
      else
        msg := 'Défis récompensés du jour atteints.';
      end if;
    end if;
  end if;
  return jsonb_build_object('etat', me(), 'recompense',
    jsonb_build_object('eclats', g_eclats, 'message', msg, 'xp', v_xp));
end $$;

-- ===================================================== 8. droits
revoke all on function public.jour_paris, public.combat_joueur, public.cle_copie, public.limite_copies,
  public.deck_erreur, public.deck_depuis_moteur, public.cartes_pretees, public.deck_defi_erreur,
  public.combat_etat, public.vue_defi
  from public, anon, authenticated;

revoke all on function public.combat_section, public.combat_reglages, public.deck_sauver,
  public.deck_supprimer, public.combat_debut, public.combat_fin, public.defi_lancer,
  public.defi_repondre, public.defi_etat, public.defi_jouer, public.defi_fin from public, anon;
grant execute on function public.combat_section, public.combat_reglages, public.deck_sauver,
  public.deck_supprimer, public.combat_debut, public.combat_fin, public.defi_lancer,
  public.defi_repondre, public.defi_etat, public.defi_jouer, public.defi_fin to authenticated;
