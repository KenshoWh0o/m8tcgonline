-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement, un vrai evenement
--  A executer apres 22d_admin.sql. Rejouable sans danger.
--
--  Jusqu'au 24 octobre 2026, L'Echauffement n'etait que ses sept defis
--  (22b_echauffement.sql). Il devient un evenement a la maniere de Reflets
--  (21_reflets.sql), sur la meme charpente : une ligne de `evenements` (code
--  'echauffement'), calee sur sa saison, et tout ce qui porte ce code — sa
--  monnaie, ses quetes, son Pass, sa boutique, son classement, son recap.
--
--  LA MONNAIE : les Braises (on s'echauffe). En base, comme les Prismes de
--  Reflets, elles vivent dans evt_comptes (evenement = 'echauffement') et
--  s'appellent `prismes` partout ou une monnaie d'evenement est attendue
--  (quests.monnaie, shop_items.devise) : seul le nom affiche change
--  (MONNAIES_EV, js/config.js). `solde` se depense dans sa boutique, `total`
--  fait avancer le Pass : acheter ne le fait jamais reculer.
--
--  CE QUI EN RAPPORTE (calcul du Pass) :
--    · les etoiles des defis : 15, 15 puis 25 par defi (ech_terminer,
--      22b_echauffement.sql), 385 en tout ;
--    · quatre quetes du jour (04_seed.sql) : 50 par jour, 450 sur les neuf
--      jours de la saison ;
--    · neuf quetes de l'evenement, une fois : 390.
--  Soit 1 225 au plus. Un joueur qui vient chaque jour et fait tout finit le
--  Pass (1 050) vers le huitieme jour ; un joueur regulier (sept jours sur
--  neuf, les quatre cinquiemes des quetes du jour, deux tiers de celles de
--  l'evenement, quinze etoiles) en gagne ~815 : palier 15 ; un joueur de
--  passage (quatre jours, huit etoiles) ~395 : palier 8.
--
--  LE PASS : vingt paliers, les ecarts grandissent pour que les premiers
--  tombent vite. En tout : 10 boosters, 600 Eclats, 1 100 Fragments, 4
--  Reverses Rares, une Essence Brillante, deux titres et deux cadres
--  decores (« Braise », « Ardeur » : tools/cadres.py). A peu pres les trois
--  quarts du Pass de Reflets, pour un evenement de neuf jours au lieu de
--  quatorze, qui paie deja ses defis en Eclats (2 100) et en boosters (3).
--
--  LA BOUTIQUE (04_seed.sql) : tout acheter coute 1 120 Braises ; un joueur
--  regulier doit choisir.
--
--  LE CLASSEMENT : les dix joueurs qui ont gagne le plus de Braises
--  (evenement_etat, 21_reflets.sql).
--
--  APRES : trois jours de recap (evenement_recap, 22b_echauffement.sql), et
--  le mode sans fin dans l'onglet Combats (22f_sans-fin.sql).
-- =====================================================================

-- ------------------------------------------------- la ligne de l'evenement
-- Les memes dates que la saison (ech_saison), et trois jours de recap
-- apres. Le declencheur les garde ensemble : la saison bouge (Labo,
-- calendrier-2.5.sql, ou a la main), l'evenement suit.
create or replace function public.ech_saison_evenement() returns trigger
language plpgsql set search_path = public as $$
begin
  update evenements
     set debut = new.debut, fin = new.fin, recap_jusqua = new.fin + interval '3 days'
   where code = 'echauffement';
  return new;
end $$;
drop trigger if exists ech_saison_evenement on public.ech_saison;
create trigger ech_saison_evenement after insert or update on public.ech_saison
  for each row execute function public.ech_saison_evenement();

insert into public.evenements (titre, texte, debut, fin, ticket_minutes, code, recap_jusqua)
select 'L''Échauffement', 'Sept défis, un par jour, avec tes Joueurs. Gagne des Braises et remonte le Pass.',
       s.debut, s.fin, null, 'echauffement', s.fin + interval '3 days'
  from public.ech_saison s
 where s.id = 1 and not exists (select 1 from public.evenements where code = 'echauffement');
update public.evenements e
   set debut = s.debut, fin = s.fin, recap_jusqua = s.fin + interval '3 days'
  from public.ech_saison s
 where s.id = 1 and e.code = 'echauffement';

-- ----------------------------------------------- les quetes, pendant l'evenement
-- bump_quests (01_schema.sql), a l'identique sauf une chose : une quete
-- d'evenement ne compte que pendant son evenement. Avant, « Ouvre 30
-- boosters pendant l'evenement » aurait compte ceux ouverts avant son
-- debut — la ligne de la quete existe des la mise a jour.
create or replace function public.bump_quests(p uuid, m text, amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount <= 0 then return; end if;
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), amount from quests q
   where q.metric = m and (q.evenement is null or q.evenement = evenement_en_cours())
  on conflict (user_id, quest_id, period_key)
    do update set progress = quest_progress.progress + amount
    where not quest_progress.claimed;
end $$;

-- ------------------------------------------------------------------ le Pass
delete from public.evt_piste where evenement = 'echauffement' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('echauffement',  1,   20, 'boosters',   1, null,              '1 booster'),
  ('echauffement',  2,   50, 'fragments', 150, null,             '150 Fragments'),
  ('echauffement',  3,   85, 'titre',      0, 't_ech_round',     'Titre « Premier round »'),
  ('echauffement',  4,  125, 'boosters',   2, null,              '2 boosters'),
  ('echauffement',  5,  170, 'eclats',   150, null,              '150 Éclats'),
  ('echauffement',  6,  220, 'reverse_R',  1, null,              'Une Reverse Rare'),
  ('echauffement',  7,  275, 'fragments', 250, null,             '250 Fragments'),
  ('echauffement',  8,  335, 'boosters',   2, null,              '2 boosters'),
  ('echauffement',  9,  400, 'cadre',      0, 'f_braise',        'Cadre « Braise »'),
  ('echauffement', 10,  465, 'fragments', 300, null,             '300 Fragments'),
  ('echauffement', 11,  530, 'boosters',   2, null,              '2 boosters'),
  ('echauffement', 12,  595, 'reverse_R',  1, null,              'Une Reverse Rare'),
  ('echauffement', 13,  660, 'eclats',   200, null,              '200 Éclats'),
  ('echauffement', 14,  725, 'fragments', 400, null,             '400 Fragments'),
  ('echauffement', 15,  790, 'brillante',  1, null,              'Une Essence Brillante'),
  ('echauffement', 16,  850, 'boosters',   3, null,              '3 boosters'),
  ('echauffement', 17,  910, 'eclats',   250, null,              '250 Éclats'),
  ('echauffement', 18,  965, 'reverse_R',  2, null,              'Deux Reverses Rares'),
  ('echauffement', 19, 1010, 'titre',      0, 't_ech_feu',       'Titre « Feu sacré »'),
  ('echauffement', 20, 1050, 'cadre',      0, 'f_ardeur',        'Cadre « Ardeur »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ================================================================= droits
revoke all on function public.ech_saison_evenement from public, anon, authenticated;
revoke all on function public.bump_quests from public, anon, authenticated;
