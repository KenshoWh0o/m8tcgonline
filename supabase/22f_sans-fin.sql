-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement continue, sans fin
--  A executer apres 22e_echauffement-evenement.sql. Rejouable sans danger.
--
--  Apres la saison (ech_saison.fin : le mercredi 4 novembre 2026, 0 h),
--  l'onglet Combats garde L'Echauffement, en mode sans fin, tant que la 3.0
--  n'est pas la : un defi par jour, le meme pour tout le monde, tire d'une
--  liste de 21 adversaires de niveaux varies. La difficulte ne monte pas,
--  elle change d'un jour a l'autre : l'ordre (`ordre`) melange Facile,
--  Moyen, Difficile et Redoutable, et ne met jamais deux fois la meme regle
--  deux jours de suite. Apres le 21e jour, on recommence au premier.
--
--  LE COMBAT est celui de la saison (ech_combat, 22b_echauffement.sql), avec
--  les memes regles (aucune, carapace, eclair, affinite, riposte, fureur,
--  final) et d'autres reglages. Trois essais par jour, comptes au depart ;
--  le combat se joue dans le navigateur, puis ech_sf_terminer le rejoue ici.
--  Seul le defi du jour se joue : pas de rattrapage, c'est un rendez-vous
--  quotidien, pas une collection a completer.
--
--  LES RECOMPENSES, comme Devine l'illu devenu permanent : de quoi revenir
--  chaque jour sans peser sur l'economie. 30, 30 puis 60 Eclats pour les
--  etoiles 1, 2 et 3 du jour (120 au plus, autant qu'une illu trouvee au
--  premier essai). Dix jours gagnes : le titre « Infatigable » (quete
--  saisonniere m_sf10, 04_seed.sql).
--
--  L'EQUILIBRAGE (simulation sur les 51 Joueurs, toutes les equipes
--  ordonnees, la meilleure attaque et le meilleur coup d'eclat ; la Defense
--  de chaque adversaire est le multiple de 50 qui approche le mieux la cible
--  de son niveau) :
--                       une equipe au hasard     une collection d'un tiers
--                       gagne     fait 3 ★       trouve ses 3 ★
--      Facile .......   70-93 %   17-25 %        toujours
--      Moyen ........   53-88 %    6-9 %         98-100 %
--      Difficile ....   31-51 %    2-3 %         75-99 %
--      Redoutable ...   16-35 %    ~1 %          58-83 %
--  Pour comparer, les sept defis de la saison sont entre Difficile et
--  Redoutable (une equipe au hasard fait 3 ★ une fois sur trente a cent).
--  Le detail, adversaire par adversaire, est dans le tableau ci-dessous.
-- =====================================================================

create table if not exists public.ech_sf_adversaires (
  ordre      integer primary key check (ordre between 1 and 99),
  adversaire text not null references public.cards,
  pv         integer not null check (pv > 0),
  regle      text not null check (regle in ('aucune', 'carapace', 'eclair', 'affinite', 'riposte', 'fureur', 'final')),
  param      jsonb not null default '{}',
  niveau     smallint not null check (niveau between 1 and 4),
  titre      text not null,
  texte      text not null
);
-- La simulation, par ligne : une equipe au hasard gagne (G) / fait trois
-- etoiles (3), et une collection d'un tiers trouve ses trois etoiles (T).
insert into public.ech_sf_adversaires (ordre, adversaire, pv, regle, param, niveau, titre, texte) values
  ( 1, 'c057',  850, 'aucune',   '{}',                        1, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 91 %, 3 17,5 %, T 100 %
  ( 2, 'c063', 1000, 'carapace', '{"seuil": 80}',             2, 'Carapace',           'Il ignore les coups de moins de 80.'),                             -- G 70 %, 3 8,8 %, T 98 %
  ( 3, 'c079',  600, 'eclair',   '{}',                        3, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 51 %, 3 2,8 %, T 99 %
  ( 4, 'c074',  750, 'riposte',  '{"degats": 20}',            1, 'Riposte',            'Chaque coup que tu lui portes te coûte 20 de Défense.'),           -- G 86 %, 3 21,9 %, T 100 %
  ( 5, 'c100', 1200, 'final',    '{"seuil": 70, "plus": 15}', 4, 'Carapace et fureur', 'Il ignore les coups de moins de 70, et les siens gagnent 15 à chaque fois.'), -- G 33 %, 3 0,9 %, T 58 %
  ( 6, 'c112', 1150, 'affinite', '{"couleur": "rose"}',       2, 'Affinité Rose',      'Tes Joueurs Roses frappent deux fois plus fort.'),                 -- G 53 %, 3 7,4 %, T 100 %
  ( 7, 'c071',  500, 'eclair',   '{}',                        1, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 82 %, 3 17 %, T 100 %
  ( 8, 'c035',  950, 'fureur',   '{"plus": 30}',              3, 'Fureur',             'Ses coups gagnent 30 de dégâts à chaque fois.'),                   -- G 36 %, 3 2,1 %, T 99 %
  ( 9, 'c023',  850, 'aucune',   '{}',                        2, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 88 %, 3 6,1 %, T 100 %
  (10, 'c117',  900, 'carapace', '{"seuil": 100}',            4, 'Carapace',           'Il ignore les coups de moins de 100.'),                            -- G 16 %, 3 0,7 %, T 83 %
  (11, 'c058', 1050, 'affinite', '{"couleur": "neutre"}',     1, 'Affinité Neutre',    'Tes Joueurs Neutres frappent deux fois plus fort.'),               -- G 70 %, 3 18,6 %, T 100 %
  (12, 'c029', 1100, 'final',    '{"seuil": 90, "plus": 25}', 3, 'Carapace et fureur', 'Il ignore les coups de moins de 90, et les siens gagnent 25 à chaque fois.'), -- G 42 %, 3 1,6 %, T 93 %
  (13, 'c012',  700, 'riposte',  '{"degats": 30}',            2, 'Riposte',            'Chaque coup que tu lui portes te coûte 30 de Défense.'),           -- G 65 %, 3 5,8 %, T 99 %
  (14, 'c118',  550, 'fureur',   '{"plus": 40}',              1, 'Fureur',             'Ses coups gagnent 40 de dégâts à chaque fois.'),                   -- G 93 %, 3 24,7 %, T 100 %
  (15, 'c022',  500, 'eclair',   '{}',                        4, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 35 %, 3 0,8 %, T 80 %
  (16, 'c113', 1650, 'affinite', '{"couleur": "mauve"}',      3, 'Affinité Mauve',     'Tes Joueurs Mauves frappent deux fois plus fort.'),                -- G 31 %, 3 2,7 %, T 83 %
  (17, 'c121',  900, 'fureur',   '{"plus": 20}',              2, 'Fureur',             'Ses coups gagnent 20 de dégâts à chaque fois.'),                   -- G 85 %, 3 6 %, T 98 %
  (18, 'c069', 1200, 'aucune',   '{}',                        1, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 80 %, 3 22,1 %, T 100 %
  (19, 'c050', 1100, 'carapace', '{"seuil": 90}',             3, 'Carapace',           'Il ignore les coups de moins de 90.'),                             -- G 46 %, 3 2,6 %, T 75 %
  (20, 'c025',  850, 'aucune',   '{}',                        2, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 65 %, 3 6,1 %, T 100 %
  (21, 'c068',  800, 'riposte',  '{"degats": 40}',            4, 'Riposte',            'Chaque coup que tu lui portes te coûte 40 de Défense.')            -- G 26 %, 3 1,1 %, T 75 %
on conflict (ordre) do update set adversaire = excluded.adversaire, pv = excluded.pv, regle = excluded.regle,
  param = excluded.param, niveau = excluded.niveau, titre = excluded.titre, texte = excluded.texte;
delete from public.ech_sf_adversaires where ordre > 21;

-- Chaque essai, des son depart (le plafond du jour se compte ici), et la
-- meilleure note de chaque jour.
create table if not exists public.ech_sf_essais (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  equipe  jsonb not null,
  le      timestamptz not null default now(),
  fini    boolean not null default false,
  eclat   jsonb,
  etoiles smallint
);
create index if not exists ech_sf_essais_user_idx on public.ech_sf_essais (user_id, jour);
create table if not exists public.ech_sf_scores (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  etoiles smallint not null check (etoiles between 0 and 3),
  equipe  jsonb not null,
  tours   integer not null,
  le      timestamptz not null default now(),
  primary key (user_id, jour)
);
alter table public.ech_sf_adversaires enable row level security;
alter table public.ech_sf_essais enable row level security;
alter table public.ech_sf_scores enable row level security;
revoke all on public.ech_sf_adversaires, public.ech_sf_essais, public.ech_sf_scores from anon, authenticated;

-- Le jour de Paris, et le premier jour du mode sans fin : celui ou la
-- saison se termine.
create or replace function public.ech_sf_premier() returns date
language sql stable security definer set search_path = public as $$
  select (s.fin at time zone 'Europe/Paris')::date from ech_saison s where s.id = 1
$$;

-- La place d'un jour dans la liste : elle se deroule dans l'ordre, un
-- adversaire par jour, puis recommence.
create or replace function public.ech_sf_ordre(j date) returns integer
language sql stable security definer set search_path = public as $$
  select (((j - ech_sf_premier()) % n) + n) % n + 1
    from (select count(*)::int as n from ech_sf_adversaires) x
$$;
-- L'adversaire d'un jour, sous la forme d'un defi (ech_defis) pour ech_combat.
create or replace function public.ech_sf_defi(j date) returns ech_defis
language sql stable security definer set search_path = public as $$
  select jsonb_populate_record(null::ech_defis, to_jsonb(a) || jsonb_build_object('jour', 0))
    from ech_sf_adversaires a where a.ordre = ech_sf_ordre(j)
$$;
create or replace function public.ech_sf_niveau(j date) returns smallint
language sql stable security definer set search_path = public as $$
  select a.niveau from ech_sf_adversaires a where a.ordre = ech_sf_ordre(j)
$$;

create or replace function public.ech_sf_essais_du_jour(p uuid, j date) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from ech_sf_essais where user_id = p and jour = j
$$;

-- ------------------------------------------------------------------ l'etat
-- { ouvert, debut, serveur, jour, n (le combien de jours depuis le debut),
--   essais_max, prix, defi (l'adversaire du jour, sa note, son equipe, ses
--   essais), demain (le niveau du lendemain), victoires, etoiles, serie,
--   top (les dix qui ont le plus d'etoiles), rang }.
create or replace function public.ech_sf_etat_de(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s ech_saison; j date := (now() at time zone 'Europe/Paris')::date; d ech_defis; sc ech_sf_scores;
  serie int := 0; k date; tot int; rang int;
begin
  select * into s from ech_saison where id = 1;
  if not found then return 'null'::jsonb; end if;
  if now() < s.fin then
    return jsonb_build_object('ouvert', false, 'debut', s.fin, 'serveur', now());
  end if;
  d := ech_sf_defi(j);
  select * into sc from ech_sf_scores where user_id = p and jour = j;
  -- La serie : les jours gagnes d'affilee, jusqu'a aujourd'hui (ou hier, si
  -- le defi du jour n'est pas encore gagne).
  k := case when coalesce(sc.etoiles, 0) > 0 then j else j - 1 end;
  while exists (select 1 from ech_sf_scores where user_id = p and jour = k and etoiles > 0) loop
    serie := serie + 1; k := k - 1;
  end loop;
  select coalesce(sum(etoiles), 0) into tot from ech_sf_scores where user_id = p;
  select count(*) + 1 into rang from (select user_id from ech_sf_scores group by user_id having sum(etoiles) > tot) x;
  return jsonb_build_object(
    'ouvert', true, 'debut', s.fin, 'serveur', now(), 'jour', j, 'n', j - ech_sf_premier() + 1,
    'essais_max', 3, 'prix', jsonb_build_array(30, 30, 60),
    'defi', jsonb_build_object('adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
      'titre', d.titre, 'texte', d.texte, 'niveau', ech_sf_niveau(j),
      'etoiles', coalesce(sc.etoiles, 0), 'equipe', sc.equipe, 'essais_jour', ech_sf_essais_du_jour(p, j)),
    'demain', ech_sf_niveau(j + 1),
    'victoires', (select count(*) from ech_sf_scores where user_id = p and etoiles > 0),
    'etoiles', tot,
    'serie', serie,
    'rang', case when tot > 0 then rang end,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', x.total, 'moi', pr.id = p) order by x.total desc, lower(pr.pseudo))
        from (select user_id, sum(etoiles)::int as total from ech_sf_scores group by user_id
               having sum(etoiles) > 0 order by sum(etoiles) desc limit 10) x
        join profiles pr on pr.id = x.user_id), '[]'::jsonb));
end $$;

create or replace function public.ech_sf_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return ech_sf_etat_de(p);
end $$;

-- ------------------------------------------------------------- commencer
-- Verifie l'equipe (ech_equipe_propre) et compte l'essai du jour. Rend
-- { essai, equipe, restants }.
create or replace function public.ech_sf_commencer(p_equipe jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); s ech_saison; j date := (now() at time zone 'Europe/Paris')::date; nb int;
  propre jsonb; deja int; eid bigint;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  if not found or now() < s.fin then raise exception 'Le défi du jour commence après L''Échauffement.'; end if;
  if p_equipe is null or jsonb_typeof(p_equipe) <> 'array' then raise exception 'Équipe invalide.'; end if;
  nb := jsonb_array_length(p_equipe);
  if nb < 1 or nb > 3 then raise exception 'Une équipe compte un à trois Joueurs.'; end if;
  -- Un depart a la fois : deux appuis partis ensemble ne comptent qu'un essai.
  perform 1 from profiles where id = p for update;
  deja := ech_sf_essais_du_jour(p, j);
  if deja >= 3 then raise exception 'Plus d''essai aujourd''hui : un autre adversaire t''attend demain.'; end if;
  propre := ech_equipe_propre(p, p_equipe);
  insert into ech_sf_essais (user_id, jour, equipe) values (p, j, propre) returning id into eid;
  return jsonb_build_object('essai', eid, 'equipe', propre, 'restants', 2 - deja);
end $$;

-- -------------------------------------------------------------- terminer
-- Rejoue le combat de l'essai (contre l'adversaire de son jour) avec le
-- coup d'eclat choisi, garde la meilleure note du jour, paie les etoiles
-- nouvelles. Un essai se termine dans l'heure : commence a 23 h 59, il
-- compte pour son jour. Rend { resultat, avant, gain: { eclats }, etat, me }.
create or replace function public.ech_sf_terminer(p_essai bigint, p_eclat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); es ech_sf_essais; r jsonb; avant int; nouv int; k int; ec jsonb := null;
  eclats int := 0; prix int[] := array[30, 30, 60];
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  perform 1 from profiles where id = p for update;
  select * into es from ech_sf_essais where id = p_essai and user_id = p for update;
  if not found then raise exception 'Essai inconnu.'; end if;
  if es.fini then raise exception 'Cet essai est déjà joué.'; end if;
  if now() > es.le + interval '1 hour' then raise exception 'Cet essai a expiré.'; end if;

  if p_eclat is not null and jsonb_typeof(p_eclat) <> 'null' then
    if jsonb_typeof(p_eclat) <> 'object' or jsonb_typeof(p_eclat -> 'tour') <> 'number' or jsonb_typeof(p_eclat -> 'i') <> 'number'
       or (p_eclat ->> 'tour')::numeric not between 1 and 10
       or (p_eclat ->> 'i')::numeric not between 0 and jsonb_array_length(es.equipe) - 1 then
      raise exception 'Coup d''éclat invalide.';
    end if;
    ec := jsonb_build_object('tour', (p_eclat ->> 'tour')::int, 'i', (p_eclat ->> 'i')::int);
  end if;

  r := ech_combat(ech_sf_defi(es.jour), es.equipe, ec);
  nouv := (r ->> 'etoiles')::int;
  update ech_sf_essais set fini = true, eclat = ec, etoiles = nouv where id = es.id;
  select etoiles into avant from ech_sf_scores where user_id = p and jour = es.jour;
  avant := coalesce(avant, 0);

  if nouv > avant then
    for k in (avant + 1)..nouv loop eclats := eclats + prix[k]; end loop;
    insert into ech_sf_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, nouv, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set etoiles = excluded.etoiles, equipe = excluded.equipe,
      tours = excluded.tours, le = now();
    perform accorder(p, 'eclats', eclats, null);
    -- La premiere victoire du jour fait avancer « Infatigable » (04_seed.sql).
    if avant = 0 then perform bump_quests(p, 'sf_victoire', 1); end if;
  else
    insert into ech_sf_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, 0, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do nothing;
  end if;

  return jsonb_build_object('resultat', r, 'avant', avant, 'gain', jsonb_build_object('eclats', eclats),
    'etat', ech_sf_etat_de(p), 'me', me());
end $$;

revoke all on function public.ech_sf_premier, public.ech_sf_ordre, public.ech_sf_defi, public.ech_sf_niveau,
  public.ech_sf_essais_du_jour, public.ech_sf_etat_de from public, anon, authenticated;
revoke all on function public.ech_sf_etat, public.ech_sf_commencer, public.ech_sf_terminer from public, anon;
grant execute on function public.ech_sf_etat, public.ech_sf_commencer, public.ech_sf_terminer to authenticated;
