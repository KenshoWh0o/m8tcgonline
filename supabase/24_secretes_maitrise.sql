-- =====================================================================
--  Mate TCG Online — version 3.0 : les Secretes et la maitrise des cartes
--  A executer apres 23_combats.sql. Rejouable sans danger.
--
--  Ce fichier ne contient que le catalogue des Secretes. Le reste vit dans
--  les fichiers qu'il touche, pour que TOUT.sql reste dans l'ordre :
--    · la colonne `cards.secrete`, le compteur `collection.total` et son
--      declencheur, les quetes de maitrise : 01_schema.sql ;
--    · le tirage (Rare 79 %, Epique 16 %, Legendaire 4,25 %, Secrete
--      0,75 %), pick_card('S'), l'echange d'une Secrete : 03_rpc.sql ;
--    · les quetes « Secret bien garde » et de maitrise : 04_seed.sql ;
--    · les exemplaires obtenus dans me() : 07_vitrine.sql ;
--    · les doublons des amis : 21_reflets.sql ; les exemplaires a garder :
--      22_garder.sql.
--
--  Les Secretes : cinq cartes numerotees apres l'extension (#123 a #127).
--  Deux sont revelees, trois encore floutees : elles existent, se tirent et
--  s'echangent, mais leur visuel et leur texte arriveront plus tard (le
--  navigateur montre leur image floutee, js/promos-data.js). Elles sont
--  hors des 122 (`promo`), ni recyclables ni fabricables, et echangeables
--  contre une autre Secrete (`secrete`).
-- =====================================================================

insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo, reverse, secrete) values
  ('c123', 123, 'Le Quatrième du Nom', 'joueur', 'orange', 'S', false, true, false, true),
  ('c124', 124, 'Secrète n°124',       'joueur', 'neutre', 'S', false, true, false, true),
  ('c125', 125, '6W26L',               'joueur', 'mauve',  'S', false, true, false, true),
  ('c126', 126, 'Secrète n°126',       'joueur', 'neutre', 'S', false, true, false, true),
  ('c127', 127, 'Secrète n°127',       'joueur', 'neutre', 'S', false, true, false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo,
  reverse = excluded.reverse, secrete = excluded.secrete;
