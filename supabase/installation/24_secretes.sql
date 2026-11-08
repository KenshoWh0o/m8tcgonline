-- =====================================================================
--  Mate TCG Online — version 3.0 : les Secretes
--  A executer apres 23_combats.sql. Rejouable sans danger.
--
--  Ce fichier ne contient que le catalogue des Secretes. Le reste vit dans
--  les fichiers qu'il touche, pour que TOUT.sql reste dans l'ordre :
--    · la colonne `cards.secrete` : 01_schema.sql ;
--    · le tirage (Rare 79 %, Epique 16 %, Legendaire 4,25 %, Secrete
--      0,75 %), pick_card('S'), l'echange d'une Secrete : 03_rpc.sql ;
--    · la quete « Secret bien garde » : 04_seed.sql ;
--    · les doublons des amis : 21_reflets.sql ; les exemplaires a garder :
--      22_garder.sql.
--
--  Les Secretes : cinq cartes numerotees apres l'extension (#123 a #127),
--  toutes revelees depuis la version 3.0.13 (124, 126 et 127 d'apres les
--  photos du proprietaire, 1er novembre 2026). Elles sont hors des 122
--  (`promo`), ni recyclables ni fabricables, et echangeables contre une
--  autre Secrete (`secrete`).
-- =====================================================================

insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo, reverse, secrete) values
  ('c123', 123, 'Le Quatrième du Nom', 'joueur', 'orange', 'S', false, true, false, true),
  ('c124', 124, 'Brawks Trop Déter',   'joueur', 'violette', 'S', false, true, false, true),
  ('c125', 125, '6W26L',               'joueur', 'mauve',  'S', false, true, false, true),
  ('c126', 126, 'GP Explorer II',      'moment', 'neutre', 'S', false, true, false, true),
  ('c127', 127, 'Paris Gentle Mates',  'moment', 'mauve',  'S', false, true, false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo,
  reverse = excluded.reverse, secrete = excluded.secrete;
