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
