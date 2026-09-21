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
--      75 % .......................   26 boosters  (une semaine)   -> promo P06
--      90 % .......................   85 boosters  (deux semaines)
--     100 % .......................  655 boosters  (~110 jours)    -> promo P05
--  Le goulot, ce sont les legendaires : dix cartes a 4 % l'une.
--
--  ------------------------------------------------------------------
--  Ce qui paie, et ce qui ne paie pas.
--
--  Les deux paliers qui donnent une carte Promo ne donnent QUE la carte :
--  zero Eclat. C'est volontaire. Une recompense qui paie deux fois dilue
--  les deux : on se souvient d'avoir debloque la carte, pas d'avoir touche
--  six mille Eclats en meme temps. Idem pour les 500 boosters, qui donnent
--  un cadre qu'aucune boutique ne vend.
--
--  Les Eclats viennent donc du quotidien, de l'hebdomadaire et des paliers
--  chiffres — environ 300 par jour pour un joueur regulier :
--      x1 booster (350) ...............  un peu plus d'une journee
--      x10 boosters (3 000) ...........  dix jours
--      un cadre (1 200 a 5 000) .......  de quatre a dix-sept jours
--      une carte Promo (5 000) ........  dix-sept jours
--
--  Tout depenser en boosters n'accelere la collection que d'environ 17 %
--  (94 jours au lieu de 110) : les Eclats aident, ils ne remplacent pas
--  le temps.
-- =====================================================================

-- Une quete peut accorder un objet en plus — ou a la place — des Eclats :
-- un cadre, une carte. C'est ce qui permet a un palier de payer autrement
-- qu'en monnaie.
alter table public.quests add column if not exists item_id text;

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | collection_pct   (tous mesures cote serveur)
--
-- Les objectifs quotidiens sont calibres sur six boosters par jour : a ce
-- rythme, « une Epique » tombe environ quatre jours sur cinq — assez souvent
-- pour ne pas decourager, assez rarement pour valoir quelque chose.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   25, null, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
  ('d_epic',    'daily',     'rarity_E',       1,   75, null, 'Au moins une Epique',  'Decroche une Epique ou une Legendaire.', 3),
  ('d_new',     'daily',     'new_cards',      3,   40, null, 'Du sang neuf',         'Trouve 3 cartes que tu n''avais pas.', 4),
  ('d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un echange avec un autre joueur.', 5),

  -- Trente boosters sur les quarante-deux qu'une semaine complete rapporte :
  -- on peut sauter deux jours et finir quand meme.
  ('w_check',   'weekly',    'checkin',        5,  200, null, 'Habitue de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         30,  260, null, 'Ouvreur en serie',     'Ouvre 30 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     15,  320, null, 'Chasseur de vides',    'Trouve 15 cartes inedites.', 3),
  ('w_epic',    'weekly',    'rarity_E',      10,  340, null, 'Dix Epiques',          'Decroche 10 Epiques ou mieux.', 4),
  ('w_legend',  'weekly',    'rarity_L',       1,  420, null, 'Une Legendaire',       'Sors une Legendaire cette semaine.', 5),
  ('w_trade',   'weekly',    'trades',         5,  380, null, 'Le marche',            'Conclus 5 echanges.', 6),

  -- Saisonnieres : une seule fois, pour toujours.
  ('m_legend',  'milestone', 'rarity_L',       1,  500, null, 'Premiere Legendaire',  'Sors ta toute premiere Legendaire d''un booster.', 1),

  -- Les paliers de collection. Ceux qui donnent une Promo ne donnent rien d'autre.
  ('m_col25',   'milestone', 'collection_pct', 25,  400, null,  'Un quart du chemin', 'Possede 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct', 50,  800, null,  'La moitie',          'Possede 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possede 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Master Set',         'Possede les 122 cartes de l''extension.', 5),

  -- Les paliers de boosters ouverts : la seule progression qui ne depende que
  -- du temps passe, et pas de la chance.
  ('m_packs25', 'milestone', 'packs',          25,  400, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 6),
  ('m_packs50', 'milestone', 'packs',          50,  800, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 7),
  ('m_packs100','milestone', 'packs',         100, 1500, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 8),
  ('m_packs200','milestone', 'packs',         200, 2500, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 9),
  ('m_packs500','milestone', 'packs',         500,    0, 'f_sceau', 'Cinq cents paquets', 'Ouvre 500 boosters en tout.', 10),

  ('m_trade25', 'milestone', 'trades',         25,  900, null, 'Negociant',           'Conclus 25 echanges en tout.', 11)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_epic','d_new','d_trade',
  'w_check','w_packs','w_new','w_epic','w_legend','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100',
  'm_packs25','m_packs50','m_packs100','m_packs200','m_packs500',
  'm_trade25');

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique | carte
--
-- Les intitules commencent par la quantite : « x5 Boosters » se lit d'un
-- coup d'oeil la ou « Cinq boosters » demande une lecture. C'est une liste
-- qu'on parcourt, pas un catalogue qu'on epluche.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'x1 Booster',   'Ajoute 1 booster a ta reserve, par-dessus le plafond.',      350, 'tickets',  1, null, false, 1),
  ('s_pack5',  'boosters',   'x5 Boosters',  'Cinq boosters d''un coup, un peu moins cher a l''unite.',   1600, 'tickets',  5, null, false, 2),
  ('s_pack10', 'boosters',   'x10 Boosters', 'Le meilleur prix a l''unite du rayon.',                     3000, 'tickets', 10, null, false, 3),

  ('s_token1', 'echange',    'x1 Jeton d''echange',   'Lance une demande d''echange sans attendre la fin du delai.',  600, 'trade_token', 1, null, false, 1),
  ('s_token5', 'echange',    'x5 Jetons d''echanges', 'Cinq demandes d''echange immediates.',                        2500, 'trade_token', 5, null, false, 2),

  -- Les deux Promos achetables. A 5 000, c'est un peu plus de deux semaines
  -- d'epargne : assez pour que le choix « j'ouvre ou j'economise » existe,
  -- pas assez pour decourager.
  ('s_p01',    'promo',      'Carte Promo P01', 'Major de Paris, illustre par Justice Wong & HL. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p01', true, 1),
  ('s_p02',    'promo',      'Carte Promo P02', 'Major de Paris, illustration alternative de Rexpo. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p02', true, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',   'Un lisere bleu autour de ton avatar.',                      1200, 'cosmetique', 1, null, true, 1),
  ('f_rose',   'cosmetique', 'Cadre Rose',   'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique', 1, null, true, 2),
  ('f_or',     'cosmetique', 'Cadre Or',     'Dore, comme les Legendaires.',                              2500, 'cosmetique', 1, null, true, 3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un cadre anime qui balaie toutes les essences.',            5000, 'cosmetique', 1, null, true, 4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

-- Le Cadre Sceau ne se vend pas : il s'obtient aux 500 boosters ouverts, et
-- nulle part ailleurs. On le retire donc de la boutique s'il y trainait.
delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme');
