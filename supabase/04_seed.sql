-- =====================================================================
--  Mate TCG Online — quetes et boutique
--  Rejouable a volonte : chaque ligne est mise a jour si elle existe deja.
--  C'est ici qu'on equilibre le jeu, pas dans le navigateur.
-- =====================================================================

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | collection_pct   (tous mesures cote serveur)
insert into public.quests (id, scope, metric, goal, reward, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   20, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          3,   40, 'Trois paquets',        'Ouvre 3 boosters.', 2),
  ('d_new',     'daily',     'new_cards',      5,   50, 'Du sang neuf',         'Trouve 5 cartes que tu n''avais pas.', 3),
  ('d_rare',    'daily',     'rarity_R',       1,   30, 'Au moins une Rare',    'Decroche une Rare, une Epique ou une Legendaire.', 4),
  ('d_trade',   'daily',     'trades',         1,   60, 'Donnant-donnant',      'Conclus un echange avec un autre joueur.', 5),

  ('w_check',   'weekly',    'checkin',        5,  200, 'Habitue de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         20,  250, 'Ouvreur en serie',     'Ouvre 20 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     25,  350, 'Chasseur de vides',    'Trouve 25 cartes inedites.', 3),
  ('w_epic',    'weekly',    'rarity_E',       3,  300, 'Triple Epique',        'Decroche 3 Epiques ou mieux.', 4),
  ('w_trade',   'weekly',    'trades',         5,  400, 'Le marche',            'Conclus 5 echanges.', 5),

  ('m_legend',  'milestone', 'rarity_L',       1,  500, 'Premiere Legendaire',  'Sors ta toute premiere Legendaire d''un booster.', 1),
  ('m_col25',   'milestone', 'collection_pct',25,  300, 'Un quart du chemin',   'Possede 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct',50,  700, 'La moitie',            'Possede 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct',75, 1400, 'Presque complet',      'Possede 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,3000, 'Tout commence ici',    'Possede les 122 cartes de l''extension.', 5)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_new','d_rare','d_trade',
  'w_check','w_packs','w_new','w_epic','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100');

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'Un booster',          'Ajoute 1 booster a ta reserve, par-dessus le plafond.', 120, 'tickets',     1, false, 1),
  ('s_pack5',  'boosters',   'Cinq boosters',       'Ajoute 5 boosters. Un peu moins cher a l''unite.',      550, 'tickets',     5, false, 2),
  ('s_refill', 'boosters',   'Reserve pleine',      'Remplit la reserve et relance le compte a rebours.',     300, 'refill',      1, false, 3),

  ('s_token1', 'echange',    'Jeton d''echange',     'Lance une demande sans attendre la fin du delai.',      200, 'trade_token', 1, false, 1),
  ('s_token5', 'echange',    'Cinq jetons',         'Cinq demandes d''echange immediates.',                   900, 'trade_token', 5, false, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',          'Un lisere bleu autour de ton avatar.',                   800, 'cosmetique',  1, true,  1),
  ('f_rose',   'cosmetique', 'Cadre Rose',          'Le rose du logo, autour de ton avatar.',                 800, 'cosmetique',  1, true,  2),
  ('f_or',     'cosmetique', 'Cadre Or',            'Dore, comme les Legendaires.',                          1500, 'cosmetique',  1, true,  3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme',        'Un cadre anime qui balaie toutes les essences.',        4000, 'cosmetique',  1, true,  4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  unique_buy = excluded.unique_buy, ordre = excluded.ordre, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_refill','s_token1','s_token5',
  'f_azur','f_rose','f_or','f_prisme');
