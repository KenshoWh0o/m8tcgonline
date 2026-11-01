-- =====================================================================
--  Mate TCG Online — version 3.0 : le Raid
--  A executer apres 26_niveaux.sql. Rejouable sans danger.
--
--  Un boss commun a tout le serveur, pour deux semaines : un « raid » (une
--  « saison » dans les tables). Depuis la version 3.0.11, les raids se
--  comptent depuis le premier jour du Choc des Sections (raid_ancre) : le
--  raid 1 commence avec lui (The French Sorcerer), le raid 2 quatorze jours
--  plus tard — depuis la 3.0.13, le lendemain de la fin du Choc, qui dure
--  deux semaines (Le Marionnettiste) —, puis les deux boss alternent
--  (raid_boss). La page ne nomme un boss qu'a son arrivee (le proprietaire,
--  1er novembre 2026 : « juste le fait que les raids sont periodiques »). Avant, ils se comptaient depuis
--  le 12 octobre 2026, et le premier raid du Choc s'appelait « saison 2 ».
--  Chaque raid, six phases : chaque PV qu'un joueur prend au boss en combat
--  s'ajoute aux degats de tout le serveur, et chaque palier de degats
--  atteint abat une phase — tous ceux qui ont combattu dans le raid ouvrent
--  alors son coffre commun. En plus, trois paliers personnels (les degats
--  de chacun). Les six phases abattues (si le serveur y arrive), le mode
--  Infini : un palier par joueur, qui monte a chaque victoire, pour le
--  classement. Trois tentatives par jour. Au raid suivant, tout recommence.
--  Le serveur ne fait pas tourner le combat : le deck du boss se tire dans
--  la page (deckBoss, js/combat/choc-data.js), le serveur dit lequel.
--
--  Pendant le Choc des Sections (25_choc.sql), un combat de Raid paie en
--  Etincelles ; le reste du temps, en Eclats.
--
--  Il remplace le Raid par niveaux de la pre-build 3.0.5 (et le Raid a
--  phases de calendrier d'avant) : leurs tables et fonctions sont
--  supprimees plus bas.
--
--  Les chiffres sont aussi dans js/combat/choc-data.js (RAID) : les deux
--  doivent rester d'accord.
-- =====================================================================

-- ============================================================ 1. reglage
-- Les paliers sont calcules pour une dizaine de joueurs. `raid_echelle` les
-- multiplie, sans rien redeployer :
--   update public.parametres set raid_echelle = 0.5 where id = 1;
alter table public.parametres add column if not exists raid_echelle numeric not null default 1
  check (raid_echelle > 0);

-- ============================================================ 2. tables
-- Les anciens Raids : retires.
drop function if exists public.raid_reclamer(int);
drop function if exists public.raid_frapper(uuid, int);
drop function if exists public.raid_pv(int);
drop function if exists public.raid_combat(int);
drop function if exists public.raid_coffre(int);
drop table if exists public.raid_etat;
drop table if exists public.raid_tombes;
drop table if exists public.raid_joueurs;
drop table if exists public.raid_frappes;
drop table if exists public.raid_coffres;
drop function if exists public.choc_avancer();
drop function if exists public.choc_frapper(uuid, int);
drop function if exists public.choc_pv_phase(int);
drop table if exists public.choc_phases;
drop table if exists public.choc_raid;
drop table if exists public.choc_tombees;
drop table if exists public.choc_tentatives;
drop table if exists public.choc_prises;

-- Les degats de tout le serveur, par saison.
create table if not exists public.raid_saisons (
  n      integer primary key,
  degats integer not null default 0
);
-- Les phases abattues, et quand (pour le recap de l'evenement). Ce qui
-- ouvre un coffre, c'est le seuil depasse (raid_phase).
create table if not exists public.raid_tombees (
  saison    integer not null,
  phase     integer not null,
  tombee_le timestamptz not null default now(),
  primary key (saison, phase)
);
-- Ce que chaque joueur a fait dans une saison. `infini` : le dernier palier
-- Infini battu.
create table if not exists public.raid_participants (
  saison        integer not null,
  user_id       uuid not null references public.profiles on delete cascade,
  combats       integer not null default 0,
  degats        integer not null default 0,
  victoires     integer not null default 0,
  infini        integer not null default 0,
  infini_le     timestamptz,
  primary key (saison, user_id)
);
-- Les coffres ouverts : communs (une phase) ou personnels (un palier).
create table if not exists public.raid_pris (
  saison  integer not null,
  user_id uuid not null references public.profiles on delete cascade,
  quoi    text not null check (quoi in ('commun', 'perso')),
  n       integer not null,
  pris_le timestamptz not null default now(),
  primary key (saison, user_id, quoi, n)
);
create table if not exists public.raid_tentatives (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  n       integer not null default 0,
  primary key (user_id, jour)
);

alter table public.raid_saisons      enable row level security;
alter table public.raid_tombees      enable row level security;
alter table public.raid_participants enable row level security;
alter table public.raid_pris         enable row level security;
alter table public.raid_tentatives   enable row level security;
revoke all on public.raid_saisons, public.raid_tombees, public.raid_participants, public.raid_pris,
  public.raid_tentatives from anon, authenticated;

-- ============================================================ 3. les regles
-- Le premier jour du raid 1 : la date (heure de Paris) ou commence le Choc
-- des Sections — la ligne `choc` que le Labo prend aussi (labo_evenement) ;
-- sans elle, le lundi 12 octobre 2026 (RAID.saison.depart), comme avant la
-- 3.0.11. Deplacer le Choc (Labo, ou a la main) deplace donc les raids : les
-- degats deja inscrits restent sous leur numero.
create or replace function public.raid_ancre() returns date
language sql stable security definer set search_path = public as $$
  select coalesce((select (e.debut at time zone 'Europe/Paris')::date from evenements e
                    where e.code = 'choc' order by e.fin desc limit 1),
                  date '2026-10-12');
$$;
-- Le raid d'un jour : quatorze jours chacun depuis l'ancre (RAID.saison) ;
-- avant elle, le premier.
create or replace function public.raid_saison(j date) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1, floor((j - raid_ancre()) / 14.0)::int + 1);
$$;
create or replace function public.raid_saison_debut(n int) returns date
language sql stable security definer set search_path = public as $$
  select raid_ancre() + (n - 1) * 14;
$$;
-- Le boss d'un raid (RAID.bosses) : The French Sorcerer (#116) les raids
-- impairs, Le Marionnettiste (#121) les raids pairs.
create or replace function public.raid_boss(n int) returns text
language sql immutable as $$
  select (array['c116', 'c121'])[1 + (greatest(1, n) - 1) % 2];
$$;

-- Les six phases (RAID.phases) : le seuil de degats, le combat, le coffre.
create or replace function public.raid_phases() returns jsonb
language sql immutable as $$
  select '[
    {"seuil": 120,  "ia": 2, "pv": 5, "ess": 0, "commun": {"type": "boosters",  "montant": 2,   "titre": "2 boosters"}},
    {"seuil": 300,  "ia": 3, "pv": 6, "ess": 0, "commun": {"type": "fragments", "montant": 300, "titre": "300 Fragments"}},
    {"seuil": 550,  "ia": 3, "pv": 7, "ess": 1, "commun": {"type": "boosters",  "montant": 3,   "titre": "3 boosters"}},
    {"seuil": 850,  "ia": 4, "pv": 7, "ess": 1, "commun": {"type": "eclats",    "montant": 500, "titre": "500 Éclats"}},
    {"seuil": 1200, "ia": 4, "pv": 8, "ess": 2, "commun": {"type": "boosters",  "montant": 4,   "titre": "4 boosters"}},
    {"seuil": 1600, "ia": 5, "pv": 9, "ess": 2, "commun": {"type": "boosters",  "montant": 5,   "titre": "5 boosters"}}
  ]'::jsonb;
$$;
-- Les paliers personnels (RAID.perso).
create or replace function public.raid_perso() returns jsonb
language sql immutable as $$
  select '[
    {"seuil": 30,  "type": "boosters",  "montant": 1,   "titre": "1 booster"},
    {"seuil": 80,  "type": "fragments", "montant": 300, "titre": "300 Fragments"},
    {"seuil": 150, "type": "boosters",  "montant": 2,   "titre": "2 boosters"}
  ]'::jsonb;
$$;

-- Le seuil d'une phase, a l'echelle du serveur.
create or replace function public.raid_seuil(k int) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(10, round(((raid_phases()->(k - 1))->>'seuil')::int
                            * (select raid_echelle from parametres where id = 1))::int);
$$;

-- La phase en cours d'une saison : la premiere dont le seuil n'est pas
-- atteint ; 7 si les six sont abattues (le mode Infini).
create or replace function public.raid_phase(s int) returns integer
language plpgsql stable security definer set search_path = public as $$
declare d int := coalesce((select degats from raid_saisons where n = s), 0); k int := 1;
begin
  while k <= 6 and d >= raid_seuil(k) loop k := k + 1; end loop;
  return k;
end $$;

-- Le combat d'une cle : 'p3' (la phase 3) ou 'i5' (l'Infini, palier 5).
-- RAID.infini : le boss a plus de PV et d'Essences, puis c'est le joueur
-- qui a moins de PV.
create or replace function public.raid_combat(p_cle text) returns jsonb
language plpgsql immutable as $$
declare n int := greatest(1, coalesce(nullif(substr(p_cle, 2), '')::int, 1)); ph jsonb;
begin
  if left(p_cle, 1) = 'i' then
    return jsonb_build_object('infini', true, 'n', n, 'ia', 5, 'pv_boss', least(12, 9 + n),
                              'ess', least(3, 2 + n / 3), 'pv_moi', greatest(2, 5 - greatest(0, n - 3) / 2));
  end if;
  ph := raid_phases()->(least(n, 6) - 1);
  return jsonb_build_object('infini', false, 'n', n, 'ia', (ph->>'ia')::int, 'pv_boss', (ph->>'pv')::int,
                            'ess', (ph->>'ess')::int, 'pv_moi', 5);
end $$;

-- ===================================================== 4. ouvrir, clore
-- Appeles par combat_debut et combat_fin (23_combats.sql). `p_cle` : ce que
-- la page a affiche (la phase, ou le palier Infini) — s'il a change
-- entre-temps, on recharge.
create or replace function public.raid_debut(p uuid, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j date := jour_paris(); s int := raid_saison(jour_paris()); ph int; attendu text; v_t int; c jsonb;
begin
  insert into raid_saisons (n) values (s) on conflict do nothing;
  ph := raid_phase(s);
  attendu := case when ph <= 6 then 'p' || ph
                  else 'i' || (coalesce((select infini from raid_participants where saison = s and user_id = p), 0) + 1) end;
  if p_cle is distinct from attendu then
    raise exception 'Le Raid a changé : recharge la page.';
  end if;
  insert into raid_tentatives (user_id, jour, n) values (p, j, 0) on conflict do nothing;
  update raid_tentatives set n = n + 1 where user_id = p and jour = j and n < 3
  returning raid_tentatives.n into v_t;
  if v_t is null then raise exception 'Plus de tentative aujourd''hui : reviens demain.'; end if;
  insert into raid_participants (saison, user_id) values (s, p) on conflict do nothing;
  update raid_participants set combats = combats + 1 where saison = s and user_id = p;
  c := raid_combat(attendu);
  return jsonb_build_object('niveau', (c->>'ia')::int, 'phase', case when ph <= 6 then ph end,
                            'graine', floor(random() * 4294967295)::bigint + 1);
end $$;

-- Les degats : les PV pris au boss (plafonnes a ses PV + 1), ou tous et 3
-- de plus s'il tombe. En phase, ils s'ajoutent a ceux du serveur (et
-- peuvent abattre une ou plusieurs phases) ; dans l'Infini, une victoire
-- fait monter son palier. Pendant le Choc : 3 Etincelles par degat, +15 s'il
-- tombe. Sinon : 2 Eclats par degat, +15.
create or replace function public.raid_fin(p uuid, o public.combats_ouverts, gagne boolean, res jsonb, trop boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s int := raid_saison(jour_paris()); c jsonb; pb int; d int; gain int; msg text := '';
        avant int; apres int; k int; est_infini boolean;
begin
  -- Un combat abandonne (3.0.14) compte comme une defaite (ses degats
  -- comptent), mais ne fait avancer aucune quete.
  if not coalesce((res->>'abandon')::boolean, false) then perform bump_quests(p, 'raid', 1); end if;
  if trop then
    return jsonb_build_object('degats', 0, 'message', 'Combat trop court pour compter.');
  end if;
  c := raid_combat(o.cle);
  est_infini := (c->>'infini')::boolean;
  pb := (c->>'pv_boss')::int;
  d := least(pb + 1, greatest(0, coalesce((res->>'touches')::int, 0)));
  if gagne then d := pb + 1 + 3; end if;
  insert into raid_saisons (n) values (s) on conflict do nothing;
  insert into raid_participants (saison, user_id) values (s, p) on conflict do nothing;
  update raid_participants set degats = degats + d, victoires = victoires + case when gagne then 1 else 0 end
   where saison = s and user_id = p;
  if est_infini then
    if gagne then
      update raid_participants set infini = greatest(raid_participants.infini, (c->>'n')::int), infini_le = now()
       where saison = s and user_id = p;
      msg := 'Palier Infini ' || (c->>'n') || ' battu : le suivant t''attend.';
    end if;
  else
    avant := raid_phase(s);
    update raid_saisons set degats = degats + d where n = s;
    apres := raid_phase(s);
    k := avant;
    while k < apres and k <= 6 loop
      insert into raid_tombees (saison, phase) values (s, k) on conflict do nothing;
      k := k + 1;
    end loop;
    if apres > avant then
      msg := case when apres > 6 then 'Les six phases sont abattues : le mode Infini est ouvert !'
                  else 'Phase ' || (apres - 1) || ' abattue : un coffre commun pour tous ceux qui ont combattu.' end;
    end if;
  end if;
  if d = 0 and msg = '' then msg := 'Pas un PV de pris : il rira moins la prochaine fois.'; end if;
  if not coalesce((res->>'abandon')::boolean, false) then
    perform bump_quests(p, 'raid_degats', d);
    if gagne then perform bump_quests(p, 'raid_victoires', 1); end if;
  end if;
  if evenement_en_cours() = 'choc' then
    gain := d * 3 + case when gagne then 15 else 0 end;
    perform crediter_prismes(p, 'choc', gain);
    insert into choc_joueurs (user_id, degats, victoires) values (p, d, case when gagne then 1 else 0 end)
      on conflict (user_id) do update set degats = choc_joueurs.degats + d,
                                          victoires = choc_joueurs.victoires + excluded.victoires;
    return jsonb_build_object('insignes', gain, 'degats', d, 'message', msg);
  end if;
  gain := d * 2 + case when gagne then 15 else 0 end;
  update profiles set shards = shards + gain where id = p;
  return jsonb_build_object('eclats', gain, 'degats', d, 'message', msg);
end $$;

-- ===================================================== 5. ce que voit la page
-- Un raid vu par un joueur : son boss, les phases (abattues, coffre pris ou
-- pas), ses paliers personnels.
create or replace function public.raid_vue_saison(p uuid, s int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare moi raid_participants; d int := coalesce((select degats from raid_saisons where n = s), 0);
begin
  select * into moi from raid_participants where saison = s and user_id = p;
  return jsonb_build_object(
    'n', s, 'boss', raid_boss(s), 'debut', raid_saison_debut(s), 'fin', raid_saison_debut(s + 1), 'degats', d,
    'phase', raid_phase(s),
    'phases', (select jsonb_agg(x.ph || jsonb_build_object(
                 'n', x.k, 'seuil', raid_seuil(x.k::int),
                 -- Abattue : les degats du serveur ont passe son seuil (meme si
                 -- raid_echelle a baisse entre-temps).
                 'tombee', d >= raid_seuil(x.k::int),
                 'pris', exists (select 1 from raid_pris r where r.saison = s and r.user_id = p and r.quoi = 'commun' and r.n = x.k))
               order by x.k)
               from jsonb_array_elements(raid_phases()) with ordinality as x(ph, k)),
    'moi', jsonb_build_object(
      'participe', moi.user_id is not null, 'combats', coalesce(moi.combats, 0),
      'degats', coalesce(moi.degats, 0), 'victoires', coalesce(moi.victoires, 0), 'infini', coalesce(moi.infini, 0),
      'perso', (select jsonb_agg(x.pa || jsonb_build_object(
                   'n', x.k, 'pris', exists (select 1 from raid_pris r where r.saison = s and r.user_id = p and r.quoi = 'perso' and r.n = x.k))
                 order by x.k)
                 from jsonb_array_elements(raid_perso()) with ordinality as x(pa, k))));
end $$;

create or replace function public.raid_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := jour_paris(); s int := raid_saison(jour_paris()); v jsonb; prec jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  v := raid_vue_saison(p, s);
  -- Le raid d'avant, si on y a laisse des coffres : ils s'ouvrent encore.
  prec := raid_vue_saison(p, s - 1);
  return v || jsonb_build_object(
    'jour', j,
    'joueurs', (select count(*) from raid_participants where saison = s and combats > 0),
    'evenement', evenement_en_cours() is not distinct from 'choc',
    'tentatives', coalesce((select n from raid_tentatives where user_id = p and jour = j), 0),
    'max', 3,
    'precedente', case when (prec->'moi'->>'participe')::boolean then prec end,
    'top', coalesce((
      select jsonb_agg(choc_joueur_vue(x.user_id) || jsonb_build_object('degats', x.degats, 'infini', x.infini, 'moi', x.user_id = p)
                       order by x.degats desc)
        from (select * from raid_participants where saison = s and degats > 0 order by degats desc limit 10) x), '[]'::jsonb),
    'top_infini', coalesce((
      select jsonb_agg(choc_joueur_vue(x.user_id) || jsonb_build_object('infini', x.infini, 'moi', x.user_id = p)
                       order by x.infini desc, x.infini_le)
        from (select * from raid_participants where saison = s and infini > 0 order by infini desc, infini_le limit 10) x), '[]'::jsonb));
end $$;

-- Un coffre : commun (une phase abattue, pour qui a combattu dans le raid)
-- ou personnel (un palier de ses degats). Le raid en cours ou le precedent.
create or replace function public.raid_reclamer(p_saison int, p_quoi text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); s int := raid_saison(jour_paris()); moi raid_participants; c jsonb; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_saison is null or p_saison not in (s, s - 1) then raise exception 'Ce raid est terminé.'; end if;
  select * into moi from raid_participants where saison = p_saison and user_id = p;
  if moi.user_id is null or moi.combats < 1 then raise exception 'Tu n''as pas combattu dans ce raid.'; end if;
  if p_quoi = 'commun' then
    if p_n is null or p_n not between 1 and 6 then raise exception 'Phase inconnue.'; end if;
    if raid_phase(p_saison) <= p_n then
      raise exception 'Cette phase n''est pas encore abattue.';
    end if;
    c := (raid_phases()->(p_n - 1))->'commun';
  elsif p_quoi = 'perso' then
    if p_n is null or p_n not between 1 and 3 then raise exception 'Palier inconnu.'; end if;
    c := raid_perso()->(p_n - 1);
    if moi.degats < (c->>'seuil')::int then raise exception 'Palier pas encore atteint.'; end if;
  else
    raise exception 'Coffre inconnu.';
  end if;
  insert into raid_pris (saison, user_id, quoi, n) values (p_saison, p, p_quoi, p_n) on conflict do nothing;
  if not found then raise exception 'Coffre déjà ouvert.'; end if;
  cartes := accorder(p, c->>'type', (c->>'montant')::int, null);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- ============================================================ 6. droits
revoke all on function public.raid_ancre, public.raid_saison, public.raid_saison_debut, public.raid_boss,
  public.raid_phases, public.raid_perso,
  public.raid_seuil, public.raid_phase, public.raid_combat, public.raid_debut, public.raid_fin,
  public.raid_vue_saison from public, anon, authenticated;
revoke all on function public.raid_etat, public.raid_reclamer from public, anon;
grant execute on function public.raid_etat, public.raid_reclamer to authenticated;
