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
--  Un booster donne 10 cartes : 4 C, 3 PC, 1 essence, 1 rare garantie, et
--  un dernier tirage a 70 % rare / 26 % epique / 4 % legendaire.
--  La reserve tient 5 boosters et se recharge de 1 toutes les 4 h — six
--  boosters par jour pour qui passe regulierement.
--
--  Ce que ca donne, en mediane de simulation :
--      25 % de la collection ......    4 boosters  (le premier jour)
--      50 % .......................   10 boosters  (deux jours)
--      75 % .......................   26 boosters  (une semaine)
--      90 % .......................   85 boosters  (deux semaines)  -> promo P06
--     100 % .......................  655 boosters  (~110 jours)     -> promo P05
--  Le goulot, ce sont les legendaires : dix cartes a 4 % l'une.
--
--  Cote monnaie, un joueur regulier gagne ~300 Eclats par jour. A ce
--  rythme :
--      un booster (350) ...............  un peu plus d'une journee
--      un lot de dix (3 000) ..........  dix jours
--      un cadre (1 200 a 6 000) .......  de quatre a vingt jours
--      une carte Promo (10 000) .......  un mois d'epargne
--
--  Tout depenser en boosters n'accelere la collection que d'environ 17 %
--  (110 jours au lieu de 94) : les Eclats aident, ils ne remplacent pas
--  le temps. Et une carte Promo coute assez cher pour que l'arbitrage
--  « j'ouvre, ou j'economise » en soit vraiment un.
-- =====================================================================

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | collection_pct   (tous mesures cote serveur)
--
-- Les objectifs quotidiens sont calibres sur six boosters par jour : a ce
-- rythme, « une Epique » tombe environ quatre jours sur cinq — assez souvent
-- pour ne pas decourager, assez rarement pour valoir quelque chose.
insert into public.quests (id, scope, metric, goal, reward, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   25, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   50, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
  ('d_epic',    'daily',     'rarity_E',       1,   75, 'Au moins une Epique',  'Decroche une Epique ou une Legendaire.', 3),
  ('d_new',     'daily',     'new_cards',      3,   40, 'Du sang neuf',         'Trouve 3 cartes que tu n''avais pas.', 4),
  ('d_trade',   'daily',     'trades',         1,   60, 'Donnant-donnant',      'Conclus un echange avec un autre joueur.', 5),

  -- Trente boosters sur les quarante-deux qu'une semaine complete rapporte :
  -- on peut sauter deux jours et finir quand meme.
  ('w_check',   'weekly',    'checkin',        5,  200, 'Habitue de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         30,  260, 'Ouvreur en serie',     'Ouvre 30 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     15,  320, 'Chasseur de vides',    'Trouve 15 cartes inedites.', 3),
  ('w_epic',    'weekly',    'rarity_E',      10,  340, 'Dix Epiques',          'Decroche 10 Epiques ou mieux.', 4),
  ('w_legend',  'weekly',    'rarity_L',       1,  420, 'Une Legendaire',       'Sors une Legendaire cette semaine.', 5),
  ('w_trade',   'weekly',    'trades',         5,  380, 'Le marche',            'Conclus 5 echanges.', 6),

  -- Saisonnieres : une seule fois, pour toujours. Elles portent les deux
  -- cartes Promo de collection (voir 03b_promos.sql) : le palier des 90 %
  -- donne P06, celui des 100 % donne P05.
  ('m_legend',  'milestone', 'rarity_L',       1,  500, 'Premiere Legendaire',  'Sors ta toute premiere Legendaire d''un booster.', 1),
  ('m_col25',   'milestone', 'collection_pct',25,  400, 'Un quart du chemin',   'Possede 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct',50,  800, 'La moitie',            'Possede 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct',75, 1500, 'Presque complet',      'Possede 75 % de la collection.', 4),
  ('m_col90',   'milestone', 'collection_pct',90, 3000, 'Le Marionnettiste',    'Possede 90 % de la collection. Debloque la carte Promo P06.', 5),
  ('m_col100',  'milestone', 'collection_pct',100,6000, 'Master Set',           'Possede les 122 cartes. Debloque la carte Promo P05.', 6),
  ('m_packs100','milestone', 'packs',        100,  700, 'Cent paquets',         'Ouvre 100 boosters en tout.', 7),
  ('m_packs500','milestone', 'packs',        500, 2200, 'Cinq cents paquets',   'Ouvre 500 boosters en tout.', 8),
  ('m_trade25', 'milestone', 'trades',        25,  900, 'Negociant',            'Conclus 25 echanges en tout.', 9)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_epic','d_new','d_trade',
  'w_check','w_packs','w_new','w_epic','w_legend','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col90','m_col100',
  'm_packs100','m_packs500','m_trade25');

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique | carte
--
-- Les boosters coutent volontairement plus qu'avant : a 120 Eclats piece,
-- un joueur regulier doublait son rythme d'ouverture en depensant tout, et
-- la collection se terminait en quelques semaines. A 350, l'achat reste un
-- vrai coup de pouce sans remplacer le temps de jeu.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'Un booster',      'Ajoute 1 booster a ta reserve, par-dessus le plafond.',      350, 'tickets',     1, null, false, 1),
  ('s_pack5',  'boosters',   'Cinq boosters',   'Cinq boosters d''un coup. Moins cher a l''unite.',          1600, 'tickets',     5, null, false, 2),
  ('s_pack10', 'boosters',   'Dix boosters',    'Le meilleur prix a l''unite du rayon.',                     3000, 'tickets',    10, null, false, 3),

  ('s_token1', 'echange',    'Jeton d''echange', 'Lance une demande sans attendre la fin du delai.',           250, 'trade_token', 1, null, false, 1),
  ('s_token5', 'echange',    'Cinq jetons',     'Cinq demandes d''echange immediates.',                       1100, 'trade_token', 5, null, false, 2),

  -- Les deux Promos achetables. Un mois d'epargne chacune : c'est le prix a
  -- payer pour qu'economiser soit une decision, et non un reflexe.
  ('s_p01',    'promo',      'Major de Paris',  'Carte Promo P01, illustree par Justice Wong & HL. Introuvable en booster.',
                                                                                                            10000, 'carte',       1, 'p01', true, 1),
  ('s_p02',    'promo',      'Major de Paris',  'Carte Promo P02, illustration alternative de Rexpo. Introuvable en booster.',
                                                                                                            10000, 'carte',       1, 'p02', true, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',      'Un lisere bleu autour de ton avatar.',                      1200, 'cosmetique',  1, null, true,  1),
  ('f_rose',   'cosmetique', 'Cadre Rose',      'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique',  1, null, true,  2),
  ('f_or',     'cosmetique', 'Cadre Or',        'Dore, comme les Legendaires.',                              2500, 'cosmetique',  1, null, true,  3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme',    'Un cadre anime qui balaie toutes les essences.',            6000, 'cosmetique',  1, null, true,  4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme');
