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
--  Un booster donne 6 cartes (open_pack(), 03_rpc.sql, fait foi) : deux
--  communes, une peu commune, une essence (Brillante une fois sur 50), une
--  Reverse (C 50 % / PC 35 % / R 15 %), et le hit : 79 % rare / 16 %
--  epique / 4,25 % legendaire / 0,75 % Secrete.
--  La reserve tient 5 boosters et se recharge de 1 toutes les 4 h — six
--  boosters par jour pour qui passe regulierement.
--
--  Ce que ca donnait, en mediane de simulation, avec le booster de la 1.x
--  (une commune ou peu commune a la place de la Reverse, hit a 80 / 16 / 4,
--  sans Secrete) ; le calcul n'a pas ete refait depuis :
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
  ('m_invite',  'milestone', 'invite',      1,         0, 't_hote',   'L''Hôte',              'Un ami entre dans le jeu avec ton invitation.', 25),
  -- ---------------------------------------------------------- version 2.1
  -- Plusieurs exemplaires d'une meme carte classique (pas une Reverse) :
  -- l'appel des exemplaires a garder (22_garder.sql). Simulation, sans rien
  -- recycler de la carte : 10 d'une meme Rare vers 170 boosters, 5 d'une
  -- meme Epique vers 200, 3 d'une meme Legendaire vers 230 (medianes) —
  -- un mois environ chacune a six boosters par jour. Les echanges y aident.
  ('m_exR',     'milestone', 'ex_R',       10,      1000, null,      'Dix fois la même',      'Possède 10 exemplaires d''une même Rare.', 26),
  ('m_exE',     'milestone', 'ex_E',        5,      1500, null,      'Cinq fois la même',     'Possède 5 exemplaires d''une même Épique.', 27),
  ('m_exL',     'milestone', 'ex_L',        3,      2500, null,      'Trois fois la même',    'Possède 3 exemplaires d''une même Légendaire.', 28)
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
  'm_exR','m_exE','m_exL',
  'e_check','e_packs','e_illu','e_revR','e_titre','e_perso','e_revC','e_rev45','e_trade','e_illu7','e_packs70',
  'e_recycle','e_invite',
  -- Version 3.0 : les combats, les Secretes ; et l'evenement du
  -- Choc des Sections. Les oublier ici effacerait leur progression a chaque
  -- fois qu'on rejoue ce fichier (quest_progress suit la quete en cascade).
  'd_combat','d_victoire','d_vaincus','w_victoires','w_dur','w_defi',
  'm_campagne','m_legende','m_cent','m_secrete','m_tutoriel',
  'd_xp','w_xp','m_combats50','m_vaincus100','m_defis10','m_dures25',
  'm_niv5','m_niv10','m_niv20','m_niv30','m_niv40','m_niv50',
  'c_visite','c_combats','c_raid','c_epreuve','c_vaincus','c_packs',
  'c_deg100','c_raidv5','c_ep7','c_ep15','c_vic30','c_dur5','c_legende','c_defis','c_deck','c_cosm',
  'c_packs60','c_trade','c_invite');

-- ------------------------------------------------- l'evenement « Reflets »
-- Ses quetes paient en Prismes (21_reflets.sql). Du jour : 50 Prismes pour
-- qui les fait toutes, plus ce que rapporte Devine l'illu (6 a 25). De
-- l'evenement, une fois : 380. Elles portent sur les nouveautes de la 2.0 —
-- c'est le role de l'evenement de les faire essayer. Le calcul du Pass est
-- en tete de son tableau, dans 21_reflets.sql.
-- Etalees sur les deux semaines, pour un joueur qui ouvre ses 6 boosters par
-- jour : 45 Reverses differentes vers le 11e jour (on en tire ~84, dont ~51
-- differentes en 14 jours), 20 Communes differentes vers le 10e, 70 boosters
-- vers le 12e, 7 illustrations sur 14 jours. Titre et personnalisation sont
-- immediats : elles font decouvrir la 2.0, et ne paient que 20.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie) values
  ('e_check',   'ev_jour', 'ev_visite',   1, 10, null, 'Un reflet par jour',     'Passe voir l''événement aujourd''hui.', 1, 'reflets', 'prismes'),
  ('e_packs',   'ev_jour', 'packs',     4, 15, null, 'Quatre boosters',        'Ouvre 4 boosters aujourd''hui.', 2, 'reflets', 'prismes'),
  ('e_illu',    'ev_jour', 'illu',      1, 10, null, 'L''illu du jour',        'Trouve l''illustration du jour.', 3, 'reflets', 'prismes'),
  ('e_revR',    'ev_jour', 'rev_R',     1, 15, null, 'Reflet rare',            'Décroche une Reverse Rare.', 4, 'reflets', 'prismes'),
  ('e_titre',   'ev',      'titre',     1, 20, null, 'Un titre à ton nom',     'Équipe un titre sur ton profil.', 1, 'reflets', 'prismes'),
  ('e_perso',   'ev',      'perso',     1, 20, null, 'À ton image',            'Choisis une bannière ou une devise.', 2, 'reflets', 'prismes'),
  ('e_rev45',   'ev',      'rset_ALL', 45, 50, null, 'Quarante-cinq reflets',  'Possède 45 Reverses différentes.', 3, 'reflets', 'prismes'),
  ('e_revC',    'ev',      'rset_C',   20, 60, null, 'Vingt Communes reverses', 'Possède 20 Reverses Communes différentes.', 4, 'reflets', 'prismes'),
  ('e_illu7',   'ev',      'illu',      7, 60, null, 'L''œil affûté',          'Trouve 7 illustrations pendant l''événement.', 5, 'reflets', 'prismes'),
  ('e_packs70', 'ev',      'packs',    70, 50, null, 'Soixante-dix boosters',  'Ouvre 70 boosters pendant l''événement.', 6, 'reflets', 'prismes'),
  ('e_trade',   'ev',      'trades',    3, 40, null, 'Échanges de reflets',    'Conclus 3 échanges.', 7, 'reflets', 'prismes'),
  ('e_recycle', 'ev',      'recycle', 150, 30, null, 'Grand ménage',           'Recycle 150 doublons pendant l''événement.', 8, 'reflets', 'prismes'),
  ('e_invite',  'ev',      'invite',    1, 50, null, 'Un ami de plus',         'Un ami entre dans le jeu avec ton invitation.', 9, 'reflets', 'prismes')
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id, titre = excluded.titre,
  detail = excluded.detail, ordre = excluded.ordre, evenement = excluded.evenement,
  monnaie = excluded.monnaie;

-- --------------------------------------------- version 3.0 : les combats
-- (23_combats.sql) Des quetes de combat a cote de celles de la collection, pas
-- a leur place : un collectionneur qui ne combat pas garde tout ce qu'il
-- avait. Le calcul de ce qu'elles ajoutent est dans docs/economie-3.0.md :
-- un combattant regulier y gagne ~190 Eclats par jour (quetes), plus ses
-- victoires (5 par jour au plus, js/combat/campagne.js).
--   combats          : un combat termine, contre l'IA ou un ami
--   victoires        : une victoire ; victoires_dures : en Difficile ou plus
--   vaincus          : des Joueurs adverses vaincus
--   defis            : un defi entre amis termine
--   campagne         : un combat de campagne gagne pour la premiere fois
--   legende          : l'IA battue en Legende (Arcade)
--   rarity_S         : une Secrete sortie d'un booster (24_secretes.sql)
--   xp               : de l'XP de combattant gagnee (26_niveaux.sql)
--   niveau           : le niveau de combattant atteint — un etat, pas un
--                      compteur : gagner_xp le recopie (26_niveaux.sql)
--   tutoriel         : la partie du tutoriel gagnee (tutoriel_fini)
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_combat',    'daily',     'combats',          1,   20, null,         'Sur le terrain',        'Joue un combat, contre l''IA ou un ami.', 8),
  ('d_victoire',  'daily',     'victoires',        1,   40, null,         'Première victoire',     'Gagne un combat.', 9),
  ('d_vaincus',   'daily',     'vaincus',          5,   30, null,         'Faucheur',              'Vaincs 5 Joueurs adverses en combat.', 10),
  ('w_victoires', 'weekly',    'victoires',       10,  250, null,         'Série de victoires',    'Gagne 10 combats cette semaine.', 8),
  ('w_dur',       'weekly',    'victoires_dures',  3,  300, null,         'Sans trembler',         'Gagne 3 combats en Difficile ou plus.', 9),
  ('w_defi',      'weekly',    'defis',            1,  150, null,         'Entre amis',            'Joue un défi contre un ami.', 10),
  ('m_campagne',  'milestone', 'campagne',        20,  500, 't_sections', 'Champion des Sections', 'Termine la campagne des Combats.', 30),
  ('m_legende',   'milestone', 'legende',          1,  300, 't_legende',  'Tombeur de Légende',    'Bats l''IA en Légende.', 31),
  ('m_cent',      'milestone', 'victoires',      100, 1000, 't_stratege', 'Stratège',              'Gagne 100 combats.', 32),
  ('m_secrete',   'milestone', 'rarity_S',         1,  500, 'f_secrete',  'Secret bien gardé',     'Sors ta première Secrète d''un booster.', 33),
  -- Version 3.0.6 : le tutoriel (js/combat/tutoriel.js, tutoriel_fini dans
  -- 23_combats.sql). Il se rejoue a volonte ; la quete ne paie qu'une fois.
  ('m_tutoriel',  'milestone', 'tutoriel',         1,  200, null,         'Premiers pas',          'Gagne la partie du tutoriel (Combats, Guide).', 29),
  ('d_xp',        'daily',     'xp',             150,   30, null,         'Montée en puissance',   'Gagne 150 XP en combat.', 11),
  ('w_xp',        'weekly',    'xp',            1500,  200, null,         'Entraînement intensif', 'Gagne 1 500 XP en combat cette semaine.', 11),
  ('m_combats50', 'milestone', 'combats',         50,  300, null,         'Habitué de l''arène',   'Joue 50 combats.', 37),
  ('m_vaincus100','milestone', 'vaincus',        100,  400, null,         'Cent à terre',          'Vaincs 100 Joueurs adverses.', 38),
  ('m_defis10',   'milestone', 'defis',           10,  400, null,         'Rival attitré',         'Joue 10 défis contre des amis.', 39),
  ('m_dures25',   'milestone', 'victoires_dures', 25,  600, null,         'Sans pitié',            'Gagne 25 combats en Difficile ou plus.', 40),
  ('m_niv5',      'milestone', 'niveau',           5,  100, null,         'Niveau 5',              'Atteins le niveau 5 de combattant.', 41),
  ('m_niv10',     'milestone', 'niveau',          10,  200, null,         'Niveau 10',             'Atteins le niveau 10 de combattant.', 42),
  ('m_niv20',     'milestone', 'niveau',          20,  400, null,         'Niveau 20',             'Atteins le niveau 20 de combattant.', 43),
  ('m_niv30',     'milestone', 'niveau',          30,  600, null,         'Niveau 30',             'Atteins le niveau 30 de combattant.', 44),
  ('m_niv40',     'milestone', 'niveau',          40,  800, null,         'Niveau 40',             'Atteins le niveau 40 de combattant.', 45),
  ('m_niv50',     'milestone', 'niveau',          50, 1500, null,         'Niveau 50',             'Atteins le niveau 50 de combattant.', 46)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre,
  evenement = null, monnaie = 'eclats';

-- ------------------------------- l'evenement « Le Choc des Sections » (3.0)
-- Ses quetes paient en Etincelles (25_choc.sql ; la colonne `monnaie` dit
-- « prismes » pour toute monnaie d'evenement). Du jour : 75 Etincelles ; de
-- l'evenement, une fois : 670. Version 3.0.13 : l'evenement dure deux
-- semaines au lieu de trois, les objectifs qui dependent du temps sont
-- ramenes aux deux tiers (100 degats → 70, 7 Epreuves gagnees → 5, 15 essais
-- → 10, 30 victoires → 20, 60 boosters → 40), les recompenses ne bougent
-- pas. Le calcul du Pass est dans docs/economie-3.0.md.
--   raid, raid_degats, raid_victoires : le Raid, contre son boss du moment
--   epreuve, epreuve_victoires        : l'Epreuve du jour
--   deck, cosm                        : un deck enregistre, un tapis ou un sleeve change
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie) values
  ('c_visite',  'ev_jour', 'ev_visite',          1, 10, null, 'Au rapport',          'Passe voir l''événement aujourd''hui.', 1, 'choc', 'prismes'),
  ('c_combats', 'ev_jour', 'combats',            2, 15, null, 'Deux combats',        'Joue 2 combats, contre l''IA ou un ami.', 2, 'choc', 'prismes'),
  ('c_raid',    'ev_jour', 'raid',               1, 15, null, 'Paratonnerre',        'Affronte le boss du Raid.', 3, 'choc', 'prismes'),
  ('c_epreuve', 'ev_jour', 'epreuve',            1, 10, null, 'L''Épreuve du jour',  'Tente l''Épreuve du jour.', 4, 'choc', 'prismes'),
  ('c_vaincus', 'ev_jour', 'vaincus',            6, 15, null, 'Six de chute',        'Vaincs 6 Joueurs adverses en combat.', 5, 'choc', 'prismes'),
  ('c_packs',   'ev_jour', 'packs',              3, 10, null, 'Trois boosters',      'Ouvre 3 boosters aujourd''hui.', 6, 'choc', 'prismes'),
  ('c_deg100',  'ev',      'raid_degats',       70, 80, null, 'Soixante-dix dégâts', 'Inflige 70 dégâts au boss du Raid.', 1, 'choc', 'prismes'),
  ('c_raidv5',  'ev',      'raid_victoires',     4, 60, null, 'Quatre fois à terre', 'Fais tomber le boss du Raid 4 fois.', 2, 'choc', 'prismes'),
  ('c_ep7',     'ev',      'epreuve_victoires',  5, 80, null, 'Cinq Épreuves',       'Gagne 5 Épreuves du jour.', 3, 'choc', 'prismes'),
  ('c_ep15',    'ev',      'epreuve',           10, 60, null, 'Dix essais',          'Tente 10 fois l''Épreuve du jour.', 4, 'choc', 'prismes'),
  ('c_vic30',   'ev',      'victoires',         20, 60, null, 'Vingt victoires',     'Gagne 20 combats pendant l''événement.', 5, 'choc', 'prismes'),
  ('c_dur5',    'ev',      'victoires_dures',    5, 60, null, 'Sans trembler',       'Gagne 5 combats en Difficile ou plus.', 6, 'choc', 'prismes'),
  ('c_legende', 'ev',      'legende',            1, 50, null, 'Tombeur de Légende',  'Bats l''IA en Légende, en Arcade.', 7, 'choc', 'prismes'),
  ('c_defis',   'ev',      'defis',              5, 50, null, 'Entre amis',          'Joue 5 défis contre des amis.', 8, 'choc', 'prismes'),
  ('c_deck',    'ev',      'deck',               1, 20, null, 'Mon deck à moi',      'Enregistre un deck que tu as construit.', 9, 'choc', 'prismes'),
  ('c_cosm',    'ev',      'cosm',               1, 20, null, 'À mes couleurs',      'Change de tapis de jeu ou de sleeve.', 10, 'choc', 'prismes'),
  ('c_packs60', 'ev',      'packs',             40, 50, null, 'Quarante boosters',   'Ouvre 40 boosters pendant l''événement.', 11, 'choc', 'prismes'),
  ('c_trade',   'ev',      'trades',             3, 30, null, 'Bonnes affaires',     'Conclus 3 échanges.', 12, 'choc', 'prismes'),
  ('c_invite',  'ev',      'invite',             1, 50, null, 'Un ami de plus',      'Un ami entre dans le jeu avec ton invitation.', 13, 'choc', 'prismes')
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
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un anneau de cristal taillé, et son éclat qui scintille.',  5000, 'cosmetique', 1, null, true, 4),
  -- Version 3.0 : les couleurs des deux Sections.
  ('f_toxique','cosmetique', 'Cadre Toxique','Le vert de la Section Toxique, qui goutte.',                 3000, 'cosmetique', 1, null, true, 5),
  ('f_deter',  'cosmetique', 'Cadre Déter',  'Le mauve de la Section Déter, ailes déployées.',             3000, 'cosmetique', 1, null, true, 6)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

-- Le Cadre Sceau ne se vend pas, et aucune quete ne le donne pour l'instant
-- (voir FRAMES dans js/config.js). On le retire de la boutique s'il y
-- trainait.
-- Version 2.0 : l'invitation, payee en Eclats (21_reflets.sql), et la
-- boutique de l'evenement « Reflets », payee en Prismes.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite) values
  ('s_invite',     'invitation', 'Invitation', 'Un code pour faire entrer un ami. Il reçoit 10 boosters et 1 000 Éclats de bienvenue.',
                                                                                               2000, 'invitation', 1, null, false, 1, 'eclats', null, 3),
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

-- Version 3.0 : les tapis de jeu et les sleeves (23_combats.sql), en Eclats.
-- Les visuels sont adaptes des illustrations fournies (tools/cosmetiques.py) ;
-- le tapis et le sleeve de base sont a tout le monde, sans achat.
-- Et la boutique du Choc des Sections (25_choc.sql), en Etincelles.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite) values
  ('t_chateau',    'tapis',  'Tapis « Champions du Monde »', 'L''illustration de la carte « Champions du Monde », sous tes cartes.',   4000, 'cosmetique', 1, null, true, 1, 'eclats', null, null),
  ('t_reverie',    'tapis',  'Tapis « La Relève »', 'L''illustration de la carte « La Relève », sous tes cartes.', 4000, 'cosmetique', 1, null, true, 2, 'eclats', null, null),
  ('t_chevalier',  'tapis',  'Tapis « La Luxueuse III »', 'L''illustration de la carte « La Luxueuse III », sous tes cartes.',          5000, 'cosmetique', 1, null, true, 3, 'eclats', null, null),
  ('t_veste',      'tapis',  'Tapis « Marteen Supreme »', 'L''illustration de la carte « Marteen Supreme », sous tes cartes.',                           4000, 'cosmetique', 1, null, true, 4, 'eclats', null, null),
  ('t_pilote',     'tapis',  'Tapis « Baby Driver »', 'L''illustration de la carte « Baby Driver », sous tes cartes.',        4000, 'cosmetique', 1, null, true, 5, 'eclats', null, null),
  ('t_peche',      'tapis',  'Tapis « Vanyabubu »', 'L''illustration de la carte « Vanyabubu », sous tes cartes.',     4000, 'cosmetique', 1, null, true, 6, 'eclats', null, null),
  ('s_sorcier',    'sleeve', 'Sleeve « 6W26L »', 'Le dos de tes cartes : la Secrète 6W26L, en noir et blanc.',   3000, 'cosmetique', 1, null, true, 1, 'eclats', null, null),
  ('s_argent',     'sleeve', 'Sleeve « Argent »',      'Le logo Gentle Mates, gravé sur fond argent.',           2500, 'cosmetique', 1, null, true, 2, 'eclats', null, null),
  -- Boutique du Choc, sur deux colonnes : le tapis (4) et le cadre (6) du
  -- Sorcier tombent l'un sous l'autre, dans la meme colonne.
  ('ch_boosters',  'evenement', 'x2 Boosters',      'Deux boosters à ouvrir tout de suite.',      80, 'tickets',   2,   null, false, 1, 'prismes', 'choc', 7),
  ('ch_boosters5', 'evenement', 'x5 Boosters',      'Cinq boosters, un peu moins cher à l''unité.', 180, 'tickets', 5,   null, false, 2, 'prismes', 'choc', 2),
  ('ch_fragments', 'evenement', '500 Fragments',    'De quoi fabriquer les cartes qui manquent.', 70, 'fragments', 500, null, false, 3, 'prismes', 'choc', 5),
  ('t_orage',      'evenement', 'Tapis « The French Sorcerer »', 'L''illustration de la carte « The French Sorcerer », sous tes cartes. Ne se vendra plus après l''événement.', 600, 'cosmetique', 1, null, true, 4, 'prismes', 'choc', null),
  ('t_supporter',  'evenement', 'Titre « Supporter du Choc »', 'Un titre qui ne se vendra plus après l''événement.', 200, 'cosmetique', 1, null, true, 5, 'prismes', 'choc', null),
  ('f_foudre',     'evenement', 'Cadre « The French Sorcerer »', 'La foudre du Sorcier autour de ton avatar. Ne se vendra plus après l''événement.', 400, 'cosmetique', 1, null, true, 6, 'prismes', 'choc', null)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy, ordre = excluded.ordre,
  devise = excluded.devise, evenement = excluded.evenement, limite = excluded.limite, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme','f_toxique','f_deter',
  's_invite','ev_boosters','ev_fragments','ev_reverse','t_collect',
  't_chateau','t_reverie','t_chevalier','t_veste','t_pilote','t_peche','s_sorcier','s_argent',
  'ch_boosters','ch_boosters5','ch_fragments','t_orage','f_foudre','t_supporter');
