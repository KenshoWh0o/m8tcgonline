-- =====================================================================
--  Mate TCG Online — version 3.0 : l'evenement « Le Choc des Sections »
--  A executer apres 24_secretes.sql. Rejouable sans danger.
--
--  Trois semaines autour des Combats (23_combats.sql), avec ce qu'un
--  evenement apporte deja depuis la 2.0 (21_reflets.sql) : une monnaie — les
--  Insignes, rangees dans evt_comptes comme les Prismes —, des quetes
--  (04_seed.sql), un Pass de trente paliers, une boutique (04_seed.sql) et un
--  classement. En plus :
--    1. le Raid : The French Sorcerer, un boss commun a tout le serveur.
--       Chaque PV qu'on lui prend en combat entame sa barre de vie. Cinq
--       phases, qui s'ouvrent une a une au fil des trois semaines ; chacune
--       qui tombe ouvre une recompense a tous ceux qui l'ont frappe. Trois
--       tentatives par jour ;
--    2. l'Epreuve du jour : le meme combat pour tout le monde (les decks et
--       la regle se deduisent de la graine du jour, js/combat/choc-data.js).
--       Trois essais, le meilleur compte, un classement du jour.
--
--  La Guerre de l'evenement (points de Section doubles) a ete retiree du
--  pre-build : ses tables et ses fonctions sont supprimees plus bas si une
--  base de test les a encore.
--
--  Les chiffres du Raid et de l'Epreuve sont aussi dans js/combat/choc-data.js
--  (CHOC) : les deux doivent rester d'accord. L'equilibrage est explique
--  dans docs/economie-3.0.md.
--
--  L'evenement ne s'ouvre pas tout seul : voir tout en bas de ce fichier.
-- =====================================================================

-- ============================================================ 1. reglages
-- La barre de vie du Raid depend du nombre de joueurs, que personne ne
-- connait d'avance : `raid_echelle` multiplie celle de chaque phase. Une
-- regle simple : le nombre de joueurs actifs attendus, divise par 15. Se
-- regle pendant l'evenement, sans rien redeployer :
--   update public.parametres set raid_echelle = 0.5 where id = 1;
alter table public.parametres add column if not exists raid_echelle numeric not null default 1
  check (raid_echelle > 0);

-- ============================================================ 2. tables
-- Les cinq phases (CHOC.raid.phases) : la barre commune, le jour ou elle
-- s'ouvre au plus tot (`ouvre`, 0 = le premier jour de l'evenement), le
-- combat, et la recompense ouverte quand elle tombe. La phase 6, la tempete
-- qui revient, n'a pas de barre : elle revient sans fin, et chaque degat
-- compte toujours.
create table if not exists public.choc_phases (
  n        integer primary key check (n between 1 and 6),
  nom      text not null,
  pv       integer,
  ia       integer not null,
  pv_boss  integer not null,
  ess      integer not null default 0,
  type     text,
  montant  integer not null default 0,
  objet    text,
  titre    text
);
alter table public.choc_phases add column if not exists ouvre integer not null default 0;
insert into public.choc_phases (n, nom, pv, ouvre, ia, pv_boss, ess, type, montant, objet, titre) values
  (1, 'Premières étincelles', 400,  0,  3, 6, 0, 'boosters',  2,   null,       '2 boosters'),
  (2, 'L''orage gronde',      600,  3,  3, 7, 1, 'fragments', 500, null,       '500 Fragments'),
  (3, 'Foudre de Rage',       900,  7,  4, 7, 1, 'boosters',  3,   null,       '3 boosters'),
  (4, 'Éclairs Vengeurs',     1300, 11, 4, 8, 2, 'brillante', 1,   null,       'Une Essence Brillante'),
  (5, 'L''œil du cyclone',    1800, 15, 5, 8, 2, 'cadre',     0,   'f_foudre', 'Cadre « Foudre »'),
  (6, 'La tempête revient',   null, 15, 5, 9, 2, null,        0,   null,       null)
on conflict (n) do update set nom = excluded.nom, pv = excluded.pv, ouvre = excluded.ouvre, ia = excluded.ia,
  pv_boss = excluded.pv_boss, ess = excluded.ess, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- La barre commune : une seule ligne.
create table if not exists public.choc_raid (
  id     integer primary key check (id = 1),
  phase  integer not null default 1,
  degats integer not null default 0,   -- dans la phase en cours
  total  integer not null default 0
);
insert into public.choc_raid (id) values (1) on conflict (id) do nothing;

create table if not exists public.choc_tombees (
  phase     integer primary key,
  tombee_le timestamptz not null default now()
);

-- Ce que chaque joueur a fait au Sorcier.
create table if not exists public.choc_joueurs (
  user_id   uuid primary key references public.profiles on delete cascade,
  degats    integer not null default 0,
  victoires integer not null default 0
);
create table if not exists public.choc_tentatives (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  n       integer not null default 0,
  primary key (user_id, jour)
);
create table if not exists public.choc_prises (
  user_id uuid not null references public.profiles on delete cascade,
  phase   integer not null,
  pris_le timestamptz not null default now(),
  primary key (user_id, phase)
);

-- L'Epreuve du jour : les essais d'un joueur, un jour donne
-- ([{ gagne, tours, pv, touches }]), et si sa premiere victoire est payee.
create table if not exists public.choc_epreuves (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  jsonb not null default '[]'::jsonb,
  gagnee  boolean not null default false,
  primary key (user_id, jour)
);

-- La Guerre de l'evenement : retiree.
drop function if exists public.choc_points(uuid, text, int);
drop function if exists public.choc_multiplicateur();
drop table if exists public.choc_guerre;
drop table if exists public.choc_contrib;

alter table public.choc_phases     enable row level security;
alter table public.choc_raid       enable row level security;
alter table public.choc_tombees    enable row level security;
alter table public.choc_joueurs    enable row level security;
alter table public.choc_tentatives enable row level security;
alter table public.choc_prises     enable row level security;
alter table public.choc_epreuves   enable row level security;
revoke all on public.choc_phases, public.choc_raid, public.choc_tombees, public.choc_joueurs,
  public.choc_tentatives, public.choc_prises, public.choc_epreuves from anon, authenticated;

-- ============================================================ 3. le Pass
-- Trente paliers. Le calcul (docs/economie-3.0.md) : un joueur engage
-- (toutes les quetes du jour, trois Raids, trois essais d'Epreuve) gagne
-- ~4 000 Insignes en trois semaines et finit le Pass vers le 18e jour ; un
-- joueur occasionnel ~2 000, palier 19 ou 20.
delete from public.evt_piste where evenement = 'choc' and palier > 30;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('choc',  1,   20, 'boosters',    2, null,            '2 boosters'),
  ('choc',  2,   50, 'eclats',    150, null,            '150 Éclats'),
  ('choc',  3,   90, 'titre',       0, 't_recrue',      'Titre « Recrue du Choc »'),
  ('choc',  4,  140, 'fragments',  250, null,           '250 Fragments'),
  ('choc',  5,  200, 'boosters',    2, null,            '2 boosters'),
  ('choc',  6,  270, 'reverse_R',   1, null,            'Une Reverse Rare'),
  ('choc',  7,  350, 'eclats',    250, null,            '250 Éclats'),
  ('choc',  8,  440, 'sleeve',      0, 's_choc',        'Sleeve « Le Choc »'),
  ('choc',  9,  540, 'boosters',    3, null,            '3 boosters'),
  ('choc', 10,  650, 'fragments',  400, null,           '400 Fragments'),
  ('choc', 11,  770, 'eclats',    300, null,            '300 Éclats'),
  ('choc', 12,  900, 'cadre',       0, 'f_choc',        'Cadre « Choc »'),
  ('choc', 13, 1040, 'boosters',    3, null,            '3 boosters'),
  ('choc', 14, 1180, 'reverse_R',   1, null,            'Une Reverse Rare'),
  ('choc', 15, 1320, 'brillante',   1, null,            'Une Essence Brillante'),
  ('choc', 16, 1460, 'eclats',    400, null,            '400 Éclats'),
  ('choc', 17, 1600, 'fragments',  600, null,           '600 Fragments'),
  ('choc', 18, 1740, 'boosters',    4, null,            '4 boosters'),
  ('choc', 19, 1880, 'titre',       0, 't_veteran',     'Titre « Vétéran du Choc »'),
  ('choc', 20, 2020, 'tapis',       0, 't_arene',       'Tapis « L''Arène »'),
  ('choc', 21, 2160, 'eclats',    500, null,            '500 Éclats'),
  ('choc', 22, 2300, 'reverse_R',   2, null,            'Deux Reverses Rares'),
  ('choc', 23, 2440, 'boosters',    4, null,            '4 boosters'),
  ('choc', 24, 2580, 'fragments',  800, null,           '800 Fragments'),
  ('choc', 25, 2720, 'brillante',   1, null,            'Une Essence Brillante'),
  ('choc', 26, 2860, 'eclats',    600, null,            '600 Éclats'),
  ('choc', 27, 3000, 'boosters',    5, null,            '5 boosters'),
  ('choc', 28, 3150, 'fragments', 1000, null,           '1 000 Fragments'),
  ('choc', 29, 3300, 'titre',       0, 't_maitre_choc', 'Titre « Maître du Choc »'),
  ('choc', 30, 3500, 'legendaire',  1, null,            'Une Légendaire que tu n''as pas')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ============================================================ 4. outils
-- La barre d'une phase, a l'echelle du serveur ; null pour le rappel.
create or replace function public.choc_pv_phase(n int) returns integer
language sql stable security definer set search_path = public as $$
  select case when ph.pv is null then null
              else greatest(20, round(ph.pv * (select raid_echelle from parametres where id = 1))::int) end
    from choc_phases ph where ph.n = least(choc_pv_phase.n, 6);
$$;

-- La graine de l'Epreuve : la meme pour tout le monde un jour donne, et
-- impossible a deviner d'avance (le sel de parametres, 21_reflets.sql).
create or replace function public.choc_graine(j date) returns bigint
language sql stable security definer set search_path = public as $$
  select ('x' || substr(md5('choc-epreuve:' || j::text || (select illu_sel from parametres where id = 1)), 1, 8))::bit(32)::bigint + 1;
$$;

-- Le score d'un essai (scoreEpreuve, js/combat/choc-data.js) : la victoire
-- d'abord ; entre deux victoires, le moins de tours puis le plus de PV ;
-- entre deux defaites, le plus de PV pris a l'adversaire.
create or replace function public.choc_score(s jsonb) returns integer
language sql immutable as $$
  select case when s is null then 0
    when coalesce((s->>'gagne')::boolean, false)
      then 100000 + (100 - least(99, greatest(0, coalesce((s->>'tours')::int, 0)))) * 100
           + least(99, greatest(0, coalesce((s->>'pv')::int, 0)))
    else least(99, greatest(0, coalesce((s->>'touches')::int, 0))) * 100
           + least(99, greatest(0, coalesce((s->>'pv')::int, 0))) end;
$$;

-- Le jour de l'evenement en cours (0 = le premier), a l'heure de Paris.
create or replace function public.choc_jour_ev() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select jour_paris() - (e.debut at time zone 'Europe/Paris')::date
                     from evenements e where e.code = 'choc' and now() >= e.debut and now() < e.fin
                    order by e.debut desc limit 1), 0);
$$;

-- Le Raid dure les trois semaines : une phase tombee ne laisse la place a la
-- suivante que le jour ou celle-ci s'ouvre (choc_phases.ouvre). Entre les
-- deux, le Sorcier reste a terre : on peut toujours l'affronter, au niveau
-- de la phase tombee ; les degats comptent pour chacun (Insignes, quetes,
-- classement), pas pour la barre suivante. Appelee a chaque lecture et a
-- chaque coup : le jour venu, la phase suivante commence d'elle-meme.
create or replace function public.choc_avancer() returns choc_raid
language plpgsql security definer set search_path = public as $$
declare r choc_raid; k int := choc_jour_ev();
begin
  select * into r from choc_raid where id = 1;
  if r.phase > 5 or not exists (select 1 from choc_tombees where phase = r.phase)
     or (select ouvre from choc_phases where n = r.phase + 1) > k then
    return r;
  end if;
  select * into r from choc_raid where id = 1 for update;
  while r.phase <= 5 and exists (select 1 from choc_tombees where phase = r.phase)
        and (select ouvre from choc_phases where n = r.phase + 1) <= k loop
    r.phase := r.phase + 1;
    r.degats := 0;
  end loop;
  update choc_raid set phase = r.phase, degats = r.degats where id = 1;
  return r;
end $$;

-- Des degats sur la barre commune : une phase tombe quand sa barre est
-- vide ; le surplus entame la suivante si elle est deja ouverte. Renvoie la
-- phase qui vient de tomber.
create or replace function public.choc_frapper(p uuid, d int) returns integer
language plpgsql security definer set search_path = public as $$
declare r choc_raid; tombee int; pv int; k int := choc_jour_ev();
begin
  if coalesce(d, 0) <= 0 then return null; end if;
  perform choc_avancer();
  select * into r from choc_raid where id = 1 for update;
  insert into choc_joueurs (user_id, degats) values (p, d)
    on conflict (user_id) do update set degats = choc_joueurs.degats + d;
  r.total := r.total + d;
  -- A terre en attendant la phase suivante : la barre ne bouge plus.
  if not exists (select 1 from choc_tombees where phase = r.phase) then
    r.degats := r.degats + d;
    loop
      pv := choc_pv_phase(r.phase);
      exit when pv is null or r.degats < pv;
      insert into choc_tombees (phase) values (r.phase) on conflict do nothing;
      tombee := r.phase;
      if (select ouvre from choc_phases where n = r.phase + 1) > k then
        r.degats := pv;
        exit;
      end if;
      r.degats := r.degats - pv;
      r.phase := r.phase + 1;
    end loop;
  end if;
  update choc_raid set phase = r.phase, degats = r.degats, total = r.total where id = 1;
  return tombee;
end $$;

-- ===================================================== 5. ouvrir, clore
-- Appeles par combat_debut et combat_fin (23_combats.sql).
create or replace function public.choc_debut(p uuid, p_mode text, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r choc_raid; ph choc_phases; v_t int; j date := jour_paris(); e choc_epreuves;
begin
  if evenement_en_cours() is distinct from 'choc' then raise exception 'L''événement est terminé.'; end if;
  if p_mode = 'raid' then
    r := choc_avancer();
    if p_cle is distinct from r.phase::text then
      raise exception 'Le Sorcier a changé de phase : recharge la page du Raid.';
    end if;
    insert into choc_tentatives (user_id, jour, n) values (p, j, 0) on conflict do nothing;
    update choc_tentatives set n = n + 1 where user_id = p and jour = j and n < 3 returning choc_tentatives.n into v_t;
    if v_t is null then raise exception 'Plus de tentative aujourd''hui : reviens demain.'; end if;
    select * into ph from choc_phases where choc_phases.n = least(r.phase, 6);
    return jsonb_build_object('niveau', ph.ia, 'phase', r.phase,
                              'graine', floor(random() * 4294967295)::bigint + 1);
  end if;
  -- L'Epreuve : l'essai compte des l'ouverture — en abandonner un ne le
  -- rend pas. Il est note perdu jusqu'a ce que le resultat arrive.
  if p_cle is distinct from j::text then raise exception 'L''Épreuve a changé : recharge la page.'; end if;
  insert into choc_epreuves (user_id, jour) values (p, j) on conflict do nothing;
  select * into e from choc_epreuves where user_id = p and jour = j for update;
  if jsonb_array_length(e.essais) >= 3 then raise exception 'Épreuve terminée : une nouvelle demain.'; end if;
  update choc_epreuves set essais = essais || '[{"gagne":false,"tours":0,"pv":0,"touches":0,"abandon":true}]'::jsonb
   where user_id = p and jour = j;
  return jsonb_build_object('niveau', 3, 'phase', null, 'graine', choc_graine(j));
end $$;

create or replace function public.choc_fin(p uuid, o public.combats_ouverts, gagne boolean, res jsonb, trop boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ph choc_phases; d int; insignes int := 0; msg text := ''; tombee int;
        e choc_epreuves; i int; score jsonb;
begin
  if o.mode = 'raid' then
    perform bump_quests(p, 'raid', 1);
    if trop then
      return jsonb_build_object('insignes', 0, 'degats', 0, 'message', 'Combat trop court pour compter.');
    end if;
    select * into ph from choc_phases where n = least(coalesce(o.phase, 1), 6);
    d := least(ph.pv_boss + 1, greatest(0, coalesce((res->>'touches')::int, 0)));
    if gagne then d := ph.pv_boss + 1 + 3; end if;
    insignes := d * 3 + case when gagne then 15 else 0 end;
    tombee := choc_frapper(p, d);
    perform bump_quests(p, 'raid_degats', d);
    if gagne then
      update choc_joueurs set victoires = victoires + 1 where user_id = p;
      perform bump_quests(p, 'raid_victoires', 1);
    end if;
    if tombee is not null then
      msg := 'La phase ' || tombee || ' est tombée ! Sa récompense t''attend dans le Raid.';
    elsif d = 0 then
      msg := 'Pas un PV de pris : il rira moins la prochaine fois.';
    end if;
    perform crediter_prismes(p, 'choc', insignes);
    return jsonb_build_object('insignes', insignes, 'degats', d, 'message', msg);
  end if;

  -- L'Epreuve du jour : le resultat remplace le premier essai encore ouvert.
  perform bump_quests(p, 'epreuve', 1);
  select * into e from choc_epreuves where user_id = p and jour = o.jour for update;
  score := jsonb_build_object('gagne', gagne, 'tours', greatest(0, coalesce((res->>'tours')::int, 0)),
                              'pv', greatest(0, coalesce((res->>'pv')::int, 0)),
                              'touches', greatest(0, coalesce((res->>'touches')::int, 0)));
  select min(k - 1) into i from jsonb_array_elements(e.essais) with ordinality t(x, k)
   where coalesce((x->>'abandon')::boolean, false);
  if i is not null then
    update choc_epreuves set essais = jsonb_set(essais, array[i::text], score) where user_id = p and jour = o.jour;
  end if;
  if trop then
    return jsonb_build_object('insignes', 0, 'message', 'Combat trop court pour compter.');
  end if;
  insignes := 5;
  if gagne and not e.gagnee then
    update choc_epreuves set gagnee = true where user_id = p and jour = o.jour;
    insignes := insignes + 25;
    perform bump_quests(p, 'epreuve_victoires', 1);
    msg := 'Épreuve du jour gagnée !';
  elsif gagne then
    msg := 'Déjà gagnée aujourd''hui : ton meilleur score est gardé.';
  end if;
  perform crediter_prismes(p, 'choc', insignes);
  return jsonb_build_object('insignes', insignes, 'message', msg);
end $$;

-- ===================================================== 6. l'etat de l'evenement
create or replace function public.choc_joueur_vue(id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
                            'photo', photo_discord(pr.id),
                            'section', (select section from combat_joueurs where user_id = pr.id))
    from profiles pr where pr.id = choc_joueur_vue.id;
$$;

create or replace function public.choc_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := jour_paris(); r choc_raid; moi choc_joueurs; e choc_epreuves;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'choc' then return 'null'::jsonb; end if;
  -- « Passe voir l'evenement », comme evenement_etat (21_reflets.sql).
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite' and q.evenement = 'choc'
  on conflict (user_id, quest_id, period_key) do nothing;
  r := choc_avancer();
  select * into moi from choc_joueurs where user_id = p;
  select * into e from choc_epreuves where user_id = p and jour = j;
  return jsonb_build_object(
    'jour', j,
    'raid', jsonb_build_object(
      'phase', r.phase, 'degats', r.degats, 'pv', choc_pv_phase(r.phase), 'total', r.total,
      'jour_ev', choc_jour_ev(),
      'joueurs', (select count(*) from choc_joueurs where degats > 0),
      'phases', (select jsonb_agg(jsonb_build_object('n', ph.n, 'pv', choc_pv_phase(ph.n), 'ouvre', ph.ouvre,
                                                     'tombee', t.phase is not null, 'tombee_le', t.tombee_le) order by ph.n)
                   from choc_phases ph left join choc_tombees t on t.phase = ph.n where ph.n <= 5),
      'moi', jsonb_build_object('degats', coalesce(moi.degats, 0), 'victoires', coalesce(moi.victoires, 0),
                                'tentatives', coalesce((select n from choc_tentatives where user_id = p and jour = j), 0),
                                'max', 3),
      'prises', coalesce((select jsonb_agg(phase order by phase) from choc_prises where user_id = p), '[]'::jsonb),
      'top', coalesce((select jsonb_agg(choc_joueur_vue(x.user_id) || jsonb_build_object('degats', x.degats, 'moi', x.user_id = p)
                                        order by x.degats desc)
                         from (select * from choc_joueurs where degats > 0 order by degats desc limit 10) x), '[]'::jsonb)),
    'epreuve', jsonb_build_object(
      'graine', choc_graine(j),
      'essais', coalesce(e.essais, '[]'::jsonb),
      'max', 3,
      'meilleur', (select x from jsonb_array_elements(coalesce(e.essais, '[]'::jsonb)) x order by choc_score(x) desc limit 1),
      'gagnee', coalesce(e.gagnee, false),
      'top', coalesce((
        select jsonb_agg(choc_joueur_vue(b.user_id) || b.s || jsonb_build_object('moi', b.user_id = p) order by choc_score(b.s) desc)
          from (select ce.user_id,
                       (select x from jsonb_array_elements(ce.essais) x
                         where not coalesce((x->>'abandon')::boolean, false)
                         order by choc_score(x) desc limit 1) s
                  from choc_epreuves ce where ce.jour = j) b
         where b.s is not null), '[]'::jsonb)));
end $$;

-- La recompense d'une phase tombee : une fois par joueur, pour qui a frappe
-- le Sorcier au moins une fois pendant l'evenement.
create or replace function public.raid_reclamer(p_phase int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ph choc_phases; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'choc' then raise exception 'L''événement est terminé.'; end if;
  select * into ph from choc_phases where n = p_phase and n <= 5;
  if not found then raise exception 'Phase inconnue.'; end if;
  if not exists (select 1 from choc_tombees where phase = p_phase) then
    raise exception 'Cette phase n''est pas encore tombée.';
  end if;
  if coalesce((select degats from choc_joueurs where user_id = p), 0) < 1 then
    raise exception 'Frappe d''abord le Sorcier.';
  end if;
  insert into choc_prises (user_id, phase) values (p, p_phase) on conflict do nothing;
  if not found then raise exception 'Récompense déjà récupérée.'; end if;
  cartes := accorder(p, ph.type, ph.montant, ph.objet);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- Ce que le recap de l'evenement ajoute (evenement_recap, 21_reflets.sql) :
-- le Raid et l'Epreuve.
create or replace function public.choc_recap(p uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'degats', coalesce((select degats from choc_joueurs where user_id = p), 0),
    'raid_phases', (select count(*) from choc_tombees),
    'epreuves', (select count(*) from choc_epreuves where user_id = p and gagnee),
    'section', (select section from combat_joueurs where user_id = p));
end $$;

-- ============================================================ 7. droits
revoke all on function public.choc_jour_ev, public.choc_avancer from public, anon, authenticated;
revoke all on function public.choc_pv_phase,
  public.choc_graine, public.choc_score, public.choc_frapper, public.choc_debut, public.choc_fin,
  public.choc_joueur_vue, public.choc_recap from public, anon, authenticated;
revoke all on function public.choc_etat, public.raid_reclamer from public, anon;
grant execute on function public.choc_etat, public.raid_reclamer to authenticated;

-- =====================================================================
--  Ouvrir l'evenement — a la main, le jour venu, dans le SQL Editor :
--
--    insert into public.evenements (titre, texte, debut, fin, code) values (
--      'Le Choc des Sections',
--      'La version 3.0 : le Raid contre The French Sorcerer et l''Épreuve du jour.',
--      '2026-11-02 18:00+01', '2026-11-23 18:00+01', 'choc');
--
--  (Les dates sont un exemple.) Un evenement sans `ticket_minutes` ne change
--  pas le rythme des boosters. Pour le fermer plus tot :
--    update public.evenements set fin = now() where code = 'choc' and fin > now();
-- =====================================================================
