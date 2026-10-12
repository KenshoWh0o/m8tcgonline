/* =====================================================================
   Démo autonome — le serveur, simulé dans le navigateur.

   Le jeu ne parle au serveur que par un seul objet : le client Supabase
   (Backend.sb, js/backend.js). Ce fichier en fournit un faux, qui répond
   aux mêmes appels avec les mêmes réponses. Le code du jeu, lui, ne change
   pas d'une ligne : il croit parler à Supabase.

   Chaque fonction ci-dessous est la traduction de sa jumelle SQL, dans
   supabase/ — même nom, mêmes règles, mêmes messages d'erreur. Quand une
   règle change là-bas, elle doit changer ici aussi, sinon la démo ment sur
   le jeu. Le fichier d'origine est cité au-dessus de chaque fonction.

   Tout vit sur l'appareil (IndexedDB, clé « demo-serveur »). Les autres
   joueurs sont simulés : ils acceptent les demandes d'ami, répondent aux
   échanges et en proposent de leur côté (voir « Les joueurs simulés »).

   Ce dossier commence par un souligné : GitHub Pages ne le publie pas. Il
   n'entre que dans le dossier fabriqué par tools/demo.py.
   ===================================================================== */
"use strict";

(() => {
  const D = Object.assign({
    pseudo: 'Visiteur',
    eclats: 6000,
    ticket_minutes: 240,
    raid_echelle: 0.25
  }, typeof DEMO_REGLAGES === 'object' ? DEMO_REGLAGES : {});

  const CLE = 'demo-serveur';
  const CLE_SESSION = 'mtcg.demo.connecte';
  const MOI = 'moi';

  /* ------------------------------------------------------------ outils */
  const now = () => Date.now();
  const iso = t => new Date(t).toISOString();
  const alea = (a, b) => a + Math.random() * (b - a);
  /* Un entier de a à b, bornes comprises. */
  const entre = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const choix = l => l[Math.floor(Math.random() * l.length)];
  const uuid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
        const r = Math.random() * 16 | 0;
        return (ch === 'x' ? r : (r & 3 | 8)).toString(16);
      });

  class Refus extends Error {}
  const refuser = m => { throw new Refus(m); };

  /* L'heure de Paris, comme period_key() et checkin() côté serveur. */
  function paris(t) {
    const p = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).forEach(x => { if (x.type !== 'literal') p[x.type] = +x.value; });
    if (p.hour === 24) p.hour = 0;
    return p;
  }
  const deux = n => String(n).padStart(2, '0');
  const jourParis = t => { const p = paris(t); return `${p.year}-${deux(p.month)}-${deux(p.day)}`; };
  const hier = j => { const d = new Date(j + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

  /* Semaine ISO (IYYY-WIW), sur la date de Paris. */
  function semaineParis(t) {
    const p = paris(t);
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const j = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - j + 3);
    const an = d.getUTCFullYear();
    const premier = new Date(Date.UTC(an, 0, 4));
    const n = 1 + Math.round(((d - premier) / 86400000 - 3 + ((premier.getUTCDay() + 6) % 7)) / 7);
    return `${an}-W${deux(n)}`;
  }

  /* Lundi minuit, heure de Paris : debut_semaine(), 12_recyclage.sql. */
  function debutSemaine(t) {
    const p = paris(t);
    const jour = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
    const ecoule = ((jour * 24 + p.hour) * 60 + p.minute) * 60000 + p.second * 1000;
    return t - ecoule - (t % 1000);
  }

  /* ----------------------------------------------- cfg(), 01_schema.sql */
  const CFG = {
    ticket_cap: 5, ticket_minutes: D.ticket_minutes, pack_size: 6, god_odds: 2000,
    trade_cooldown_h: 6, promo_palier_pct: 75,
    recyclage_ES: 1, recyclage_C: 2, recyclage_PC: 5, recyclage_R: 20,
    recyclage_E: 80, recyclage_L: 250,
    fabrication_ES: 20, fabrication_C: 40, fabrication_PC: 100, fabrication_R: 400,
    fabrication_E: 2000, fabrication_L: 8000,
    foil_odds: 50, chasse_odds: 250
  };
  const cfg = k => CFG[k];

  /* ------------------------------------------ quêtes, 04_seed.sql */
  const QUETES = [
    ['d_check',   'daily',     'checkin',        1,   30, null, 'Premier passage',      'Ouvre le jeu aujourd\'hui.', 1],
    ['d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2],
    ['d_epic',    'daily',     'rarity_E',       1,   80, null, 'Au moins une Épique',  'Décroche une Épique ou une Légendaire.', 3],
    ['d_new',     'daily',     'new_cards',      3,   30, null, 'Du sang neuf',         'Trouve 3 cartes que tu n\'avais pas.', 4],
    ['d_recycle', 'daily',     'recycle',        5,   30, null, 'Petit ménage',         'Recycle 5 doublons.', 5],
    ['d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un échange avec un autre joueur.', 6],
    ['w_check',   'weekly',    'checkin',        5,  200, null, 'Habitué de la maison', 'Connecte-toi 5 jours dans la semaine.', 1],
    ['w_packs',   'weekly',    'packs',         30,  250, null, 'Ouvreur en série',     'Ouvre 30 boosters cette semaine.', 2],
    ['w_new',     'weekly',    'new_cards',     15,  150, null, 'Chasseur de vides',    'Trouve 15 cartes inédites.', 3],
    ['w_epic',    'weekly',    'rarity_E',       8,  350, null, 'Huit Épiques',         'Décroche 8 Épiques ou mieux.', 4],
    ['w_legend',  'weekly',    'rarity_L',       1,  450, null, 'Une Légendaire',       'Sors une Légendaire cette semaine.', 5],
    ['w_trade',   'weekly',    'trades',         5,  350, null, 'Le marché',            'Conclus 5 échanges.', 6],
    ['m_legend',  'milestone', 'rarity_L',       1,  200, null, 'Première Légendaire',  'Sors ta toute première Légendaire d\'un booster.', 1],
    ['m_col25',   'milestone', 'collection_pct', 25,  100, null,  'Un quart du chemin', 'Possède 25 % de la collection.', 2],
    ['m_col50',   'milestone', 'collection_pct', 50,  250, null,  'La moitié',          'Possède 50 % de la collection.', 3],
    ['m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possède 75 % de la collection.', 4],
    ['m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Tout Commence Ici',  'Possède les 122 cartes de l\'extension.', 5],
    /* L'objectif `null` des raretés complètes est le total de la rareté,
       calculé sur le catalogue plus bas — comme le `count(*)` du SQL. */
    ['m_setES',   'milestone', 'set_ES',      null,  100, null,      'Toutes les Essences',     'Possède toutes les Essences de l\'extension.', 6],
    ['m_setC',    'milestone', 'set_C',       null,  250, null,      'Toutes les Communes',     'Possède toutes les Communes de l\'extension.', 7],
    ['m_setPC',   'milestone', 'set_PC',      null,  350, null,      'Toutes les Peu communes', 'Possède toutes les Peu communes de l\'extension.', 8],
    ['m_setR',    'milestone', 'set_R',       null, 1200, null,      'Toutes les Rares',        'Possède toutes les Rares de l\'extension.', 9],
    ['m_setE',    'milestone', 'set_E',       null, 3000, null,      'Toutes les Épiques',      'Possède toutes les Épiques de l\'extension.', 10],
    ['m_setL',    'milestone', 'set_L',       null, 6000, null,      'Toutes les Légendaires',  'Possède toutes les Légendaires de l\'extension.', 11],
    ['m_packs25', 'milestone', 'packs',          25,  150, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 12],
    ['m_packs50', 'milestone', 'packs',          50,  300, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 13],
    ['m_packs100','milestone', 'packs',         100,  800, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 14],
    ['m_packs200','milestone', 'packs',         200, 2000, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 15],
    ['m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 16],
    /* Version 2.0 (04_seed.sql) */
    ['d_revR',    'daily',     'rev_R',           1,   40, null, 'Reflet rare',          'Décroche une Reverse Rare.', 7],
    ['w_revR',    'weekly',    'rev_R',           5,  250, null, 'Cinq reflets',         'Décroche 5 Reverses Rares cette semaine.', 7],
    ['m_revC',    'milestone', 'rset_C',       null,  400, null, 'Reverses Communes',    'Possède toutes les Reverses Communes.', 17],
    /* Version 3.0 (23_combats.sql) : les combats. */
    ['d_combat',   'daily',     'combats',          1,   20, null, 'Sur le terrain',         'Joue un combat, contre l\'IA ou un ami.', 8],
    ['d_victoire', 'daily',     'victoires',        1,   40, null, 'Première victoire',      'Gagne un combat.', 9],
    ['d_vaincus',  'daily',     'vaincus',          5,   30, null, 'Faucheur',               'Vaincs 5 Joueurs adverses en combat.', 10],
    ['w_victoires','weekly',    'victoires',       10,  250, null, 'Série de victoires',     'Gagne 10 combats cette semaine.', 8],
    ['w_dur',      'weekly',    'victoires_dures',  3,  300, null, 'Sans trembler',          'Gagne 3 combats en Difficile ou plus.', 9],
    ['w_defi',     'weekly',    'defis',            1,  150, null, 'Entre amis',             'Joue un défi contre un ami.', 10],
    ['m_campagne', 'milestone', 'campagne',        20,  500, 't_sections', 'Champion des Sections', 'Termine la campagne des Combats.', 20],
    ['m_legende',  'milestone', 'legende',          1,  300, 't_legende',  'Tombeur de Légende',    'Bats l\'IA en Légende.', 21],
    ['m_cent',     'milestone', 'victoires',      100, 1000, 't_stratege', 'Stratège',              'Gagne 100 combats.', 22],
    ['m_secrete',  'milestone', 'rarity_S',         1,  500, 'f_secrete',  'Secret bien gardé',     'Sors ta première Secrète d\'un booster.', 23],
    /* L'XP et le niveau de combattant (26_niveaux.sql). */
    ['d_xp',       'daily',     'xp',             150,   30, null,         'Montée en puissance',   'Gagne 150 XP en combat.', 11],
    ['w_xp',       'weekly',    'xp',            1500,  200, null,         'Entraînement intensif', 'Gagne 1 500 XP en combat cette semaine.', 11],
    ['m_combats50','milestone', 'combats',         50,  300, null,         'Habitué de l\'arène',    'Joue 50 combats.', 27],
    ['m_vaincus100','milestone','vaincus',        100,  400, null,         'Cent à terre',          'Vaincs 100 Joueurs adverses.', 28],
    ['m_defis10',  'milestone', 'defis',           10,  400, null,         'Rival attitré',         'Joue 10 défis contre des amis.', 29],
    ['m_dures25',  'milestone', 'victoires_dures', 25,  600, null,         'Sans pitié',            'Gagne 25 combats en Difficile ou plus.', 30],
    ['m_niv5',     'milestone', 'niveau',           5,  100, null,         'Niveau 5',              'Atteins le niveau 5 de combattant.', 31],
    ['m_niv10',    'milestone', 'niveau',          10,  200, null,         'Niveau 10',             'Atteins le niveau 10 de combattant.', 32],
    ['m_niv20',    'milestone', 'niveau',          20,  400, null,         'Niveau 20',             'Atteins le niveau 20 de combattant.', 33],
    ['m_niv30',    'milestone', 'niveau',          30,  600, null,         'Niveau 30',             'Atteins le niveau 30 de combattant.', 34],
    ['m_niv40',    'milestone', 'niveau',          40,  800, null,         'Niveau 40',             'Atteins le niveau 40 de combattant.', 35],
    ['m_niv50',    'milestone', 'niveau',          50, 1500, null,         'Niveau 50',             'Atteins le niveau 50 de combattant.', 36],
    ['m_revPC',   'milestone', 'rset_PC',      null,  700, null, 'Reverses Peu communes','Possède toutes les Reverses Peu communes.', 18],
    ['m_revR',    'milestone', 'rset_R',       null, 2500, null, 'Reverses Rares',       'Possède toutes les Reverses Rares.', 19],
    ['m_revALL',  'milestone', 'rset_ALL',     null,    0, 'f_reflet', 'Le Reflet complet', 'Possède les 85 Reverses.', 20],
    ['m_master',  'milestone', 'collection_pct',100,    0, 'f_master', 'Maître de l\'extension', 'Possède les 122 cartes de l\'extension.', 21],
    ['m_brill',   'milestone', 'brill_ALL',       9,    0, 'f_aurore', 'Aurore',             'Possède les 9 Essences Brillantes.', 22],
    ['m_packs300','milestone', 'packs',         300,    0, 'f_sceau',  'Trois cents paquets', 'Ouvre 300 boosters en tout.', 23],
    ['m_illu10',  'milestone', 'illu',           10,    0, 't_devin',  'Le Devin',           'Trouve 10 illustrations à Devine l\'illu.', 24],
    ['m_invite',  'milestone', 'invite',          1,    0, 't_hote',   'L\'Hôte',            'Un ami entre dans le jeu avec ton invitation.', 25],
    /* Version 2.1 (04_seed.sql) */
    ['m_exR',     'milestone', 'ex_R',           10, 1000, null, 'Dix fois la même',     'Possède 10 exemplaires d\'une même Rare.', 26],
    ['m_exE',     'milestone', 'ex_E',            5, 1500, null, 'Cinq fois la même',    'Possède 5 exemplaires d\'une même Épique.', 27],
    ['m_exL',     'milestone', 'ex_L',            3, 2500, null, 'Trois fois la même',   'Possède 3 exemplaires d\'une même Légendaire.', 28],
    /* L'événement « Reflets » : ses quêtes paient en Prismes. */
    ['e_check',   'ev_jour', 'ev_visite',   1, 10, null, 'Un reflet par jour',  'Passe voir l\'événement aujourd\'hui.', 1, 'reflets', 'prismes'],
    ['e_packs',   'ev_jour', 'packs',     4, 15, null, 'Quatre boosters',     'Ouvre 4 boosters aujourd\'hui.', 2, 'reflets', 'prismes'],
    ['e_illu',    'ev_jour', 'illu',      1, 10, null, 'L\'illu du jour',     'Trouve l\'illustration du jour.', 3, 'reflets', 'prismes'],
    ['e_revR',    'ev_jour', 'rev_R',     1, 15, null, 'Reflet rare',         'Décroche une Reverse Rare.', 4, 'reflets', 'prismes'],
    ['e_titre',   'ev',      'titre',     1, 20, null, 'Un titre à ton nom',  'Équipe un titre sur ton profil.', 1, 'reflets', 'prismes'],
    ['e_perso',   'ev',      'perso',     1, 20, null, 'À ton image',         'Choisis une bannière ou une devise.', 2, 'reflets', 'prismes'],
    ['e_rev45',   'ev',      'rset_ALL', 45, 50, null, 'Quarante-cinq reflets', 'Possède 45 Reverses différentes.', 3, 'reflets', 'prismes'],
    ['e_revC',    'ev',      'rset_C',   20, 60, null, 'Vingt Communes reverses', 'Possède 20 Reverses Communes différentes.', 4, 'reflets', 'prismes'],
    ['e_illu7',   'ev',      'illu',      7, 60, null, 'L\'œil affûté',       'Trouve 7 illustrations pendant l\'événement.', 5, 'reflets', 'prismes'],
    ['e_packs70', 'ev',      'packs',    70, 50, null, 'Soixante-dix boosters', 'Ouvre 70 boosters pendant l\'événement.', 6, 'reflets', 'prismes'],
    ['e_trade',   'ev',      'trades',    3, 40, null, 'Échanges de reflets', 'Conclus 3 échanges.', 7, 'reflets', 'prismes'],
    ['e_recycle', 'ev',      'recycle', 150, 30, null, 'Grand ménage',        'Recycle 150 doublons pendant l\'événement.', 8, 'reflets', 'prismes'],
    ['e_invite',  'ev',      'invite',    1, 50, null, 'Un ami de plus',      'Un ami entre dans le jeu avec ton invitation.', 9, 'reflets', 'prismes'],
    /* L'événement « Le Choc des Sections » (25_choc.sql) : ses quêtes paient
       en Insignes — la colonne `monnaie` dit « prismes » pour toute monnaie
       d'événement, c'est l'événement qui lui donne son nom. */
    ['c_visite',  'ev_jour', 'ev_visite',         1, 10, null, 'Au rapport',           'Passe voir l\'événement aujourd\'hui.', 1, 'choc', 'prismes'],
    ['c_combats', 'ev_jour', 'combats',           2, 15, null, 'Deux combats',         'Joue 2 combats, contre l\'IA ou un ami.', 2, 'choc', 'prismes'],
    ['c_raid',    'ev_jour', 'raid',              1, 15, null, 'Paratonnerre',         'Affronte The French Sorcerer.', 3, 'choc', 'prismes'],
    ['c_epreuve', 'ev_jour', 'epreuve',           1, 10, null, 'L\'Épreuve du jour',   'Tente l\'Épreuve du jour.', 4, 'choc', 'prismes'],
    ['c_vaincus', 'ev_jour', 'vaincus',           6, 15, null, 'Six de chute',         'Vaincs 6 Joueurs adverses en combat.', 5, 'choc', 'prismes'],
    ['c_packs',   'ev_jour', 'packs',             3, 10, null, 'Trois boosters',       'Ouvre 3 boosters aujourd\'hui.', 6, 'choc', 'prismes'],
    ['c_deg100',  'ev',      'raid_degats',     100, 80, null, 'Cent dégâts',          'Inflige 100 dégâts au Sorcier.', 1, 'choc', 'prismes'],
    ['c_raidv5',  'ev',      'raid_victoires',    5, 60, null, 'Cinq fois à terre',    'Fais tomber le Sorcier 5 fois.', 2, 'choc', 'prismes'],
    ['c_ep7',     'ev',      'epreuve_victoires', 7, 80, null, 'Sept Épreuves',        'Gagne 7 Épreuves du jour.', 3, 'choc', 'prismes'],
    ['c_ep15',    'ev',      'epreuve',          15, 60, null, 'Quinze essais',        'Tente 15 fois l\'Épreuve du jour.', 4, 'choc', 'prismes'],
    ['c_vic30',   'ev',      'victoires',        30, 60, null, 'Trente victoires',     'Gagne 30 combats pendant l\'événement.', 5, 'choc', 'prismes'],
    ['c_dur5',    'ev',      'victoires_dures',   5, 60, null, 'Sans trembler',        'Gagne 5 combats en Difficile ou plus.', 6, 'choc', 'prismes'],
    ['c_legende', 'ev',      'legende',           1, 50, null, 'Tombeur de Légende',   'Bats l\'IA en Légende, en PvE infini.', 7, 'choc', 'prismes'],
    ['c_defis',   'ev',      'defis',             5, 50, null, 'Entre amis',           'Joue 5 défis contre des amis.', 8, 'choc', 'prismes'],
    ['c_deck',    'ev',      'deck',              1, 20, null, 'Mon deck à moi',       'Enregistre un deck que tu as construit.', 9, 'choc', 'prismes'],
    ['c_cosm',    'ev',      'cosm',              1, 20, null, 'À mes couleurs',       'Change de tapis de jeu ou de sleeve.', 10, 'choc', 'prismes'],
    ['c_packs60', 'ev',      'packs',            60, 50, null, 'Soixante boosters',    'Ouvre 60 boosters pendant l\'événement.', 11, 'choc', 'prismes'],
    ['c_trade',   'ev',      'trades',            3, 30, null, 'Bonnes affaires',      'Conclus 3 échanges.', 12, 'choc', 'prismes'],
    ['c_invite',  'ev',      'invite',            1, 50, null, 'Un ami de plus',       'Un ami entre dans le jeu avec ton invitation.', 13, 'choc', 'prismes']
  ].map(([id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie]) =>
    ({ id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement: evenement || null, monnaie: monnaie || 'eclats' }));

  /* ---------------------------------------- boutique, 04_seed.sql */
  const BOUTIQUE = [
    ['s_pack1',  'boosters',   'x1 Booster',   'Un booster à ouvrir tout de suite, sans toucher à ta réserve.', 350, 'tickets',  1, null, false, 1],
    ['s_pack5',  'boosters',   'x5 Boosters',  'Cinq boosters d\'un coup, un peu moins cher à l\'unité.',   1600, 'tickets',  5, null, false, 2],
    ['s_pack10', 'boosters',   'x10 Boosters', 'Le meilleur prix à l\'unité du rayon.',                     3000, 'tickets', 10, null, false, 3],
    ['s_token1', 'echange',    'x1 Jeton d\'échange',   'Lance une demande d\'échange sans attendre la fin du délai.',  600, 'trade_token', 1, null, false, 1],
    ['s_token5', 'echange',    'x5 Jetons d\'échanges', 'Cinq demandes d\'échange immédiates.',                        2500, 'trade_token', 5, null, false, 2],
    ['s_p01',    'promo',      'Carte Promo P01', 'Major de Paris, illustré par Justice Wong & HL. Introuvable en booster.', 5000, 'carte', 1, 'p01', true, 1],
    ['s_p02',    'promo',      'Carte Promo P02', 'Major de Paris, illustration alternative de Rexpo. Introuvable en booster.', 5000, 'carte', 1, 'p02', true, 2],
    ['f_azur',   'cosmetique', 'Cadre Azur',   'Un liseré bleu autour de ton avatar.',                      1200, 'cosmetique', 1, null, true, 1],
    ['f_rose',   'cosmetique', 'Cadre Rose',   'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique', 1, null, true, 2],
    ['f_or',     'cosmetique', 'Cadre Or',     'Doré, comme les Légendaires.',                              2500, 'cosmetique', 1, null, true, 3],
    ['f_prisme', 'cosmetique', 'Cadre Prisme', 'Un anneau de cristal taillé, et son éclat qui scintille.',  5000, 'cosmetique', 1, null, true, 4],
    ['f_toxique','cosmetique', 'Cadre Toxique','Le rose de la Section Toxique, qui goutte.',                 3000, 'cosmetique', 1, null, true, 5],
    ['f_deter',  'cosmetique', 'Cadre Déter',  'Le mauve de la Section Déter, ailes déployées.',             3000, 'cosmetique', 1, null, true, 6],
    /* Version 3.0 (23_combats.sql) : les tapis de jeu et les sleeves. */
    ['t_chateau',   'tapis',  'Tapis « Champions du Monde »', 'L\'illustration de la carte « Champions du Monde », sous tes cartes.',   4000, 'cosmetique', 1, null, true, 1],
    ['t_reverie',   'tapis',  'Tapis « La Relève »', 'L\'illustration de la carte « La Relève », sous tes cartes.', 4000, 'cosmetique', 1, null, true, 2],
    ['t_chevalier', 'tapis',  'Tapis « La Luxueuse III »', 'L\'illustration de la carte « La Luxueuse III », sous tes cartes.',          5000, 'cosmetique', 1, null, true, 3],
    ['t_veste',     'tapis',  'Tapis « Marteen Supreme »', 'L\'illustration de la carte « Marteen Supreme », sous tes cartes.',                           4000, 'cosmetique', 1, null, true, 4],
    ['t_pilote',    'tapis',  'Tapis « Baby Driver »', 'L\'illustration de la carte « Baby Driver », sous tes cartes.',        4000, 'cosmetique', 1, null, true, 5],
    ['t_peche',     'tapis',  'Tapis « Vanyabubu »', 'L\'illustration de la carte « Vanyabubu », sous tes cartes.',     4000, 'cosmetique', 1, null, true, 6],
    ['s_sorcier',   'sleeve', 'Sleeve « 6W26L »', 'Le dos de tes cartes : la Secrète 6W26L, en noir et blanc.',   3000, 'cosmetique', 1, null, true, 1],
    ['s_argent',    'sleeve', 'Sleeve « Argent »',      'Le logo Gentle Mates, gravé sur fond argent.',           2500, 'cosmetique', 1, null, true, 2],
    /* Version 2.0 : l'invitation (Fragments) et la boutique de l'événement (Prismes). */
    ['s_invite',     'invitation', 'Invitation', 'Un code pour faire entrer un ami. Il reçoit 10 boosters et 1 000 Éclats de bienvenue.', 2000, 'invitation', 1, null, false, 1, 'eclats', null, 3],
    ['ev_boosters',  'evenement', 'x2 Boosters',      'Deux boosters à ouvrir tout de suite.',      70, 'tickets',   2,   null, false, 1, 'prismes', 'reflets', 5],
    ['ev_fragments', 'evenement', '500 Fragments',    'De quoi fabriquer les cartes qui manquent.', 60, 'fragments', 500, null, false, 2, 'prismes', 'reflets', 5],
    ['ev_reverse',   'evenement', 'Une Reverse Rare', 'Une Reverse Rare que tu n\'as pas encore.', 150, 'reverse_R', 1,   null, false, 3, 'prismes', 'reflets', 3],
    ['t_collect',    'evenement', 'Titre « Collectionneur de Reflets »', 'Un titre qui ne se vendra plus après l\'événement.', 200, 'cosmetique', 1, null, true, 4, 'prismes', 'reflets', null],
    /* Le Choc des Sections (25_choc.sql), en Insignes. */
    ['ch_boosters',  'evenement', 'x2 Boosters',      'Deux boosters à ouvrir tout de suite.',      90, 'tickets',   2,   null, false, 1, 'prismes', 'choc', 8],
    ['ch_fragments', 'evenement', '500 Fragments',    'De quoi fabriquer les cartes qui manquent.', 80, 'fragments', 500, null, false, 2, 'prismes', 'choc', 6],
    ['ch_reverse',   'evenement', 'Une Reverse Rare', 'Une Reverse Rare que tu n\'as pas encore.', 180, 'reverse_R', 1,   null, false, 3, 'prismes', 'choc', 3],
    ['ch_brillante', 'evenement', 'Une Essence Brillante', 'Une Essence Brillante que tu n\'as pas encore.', 450, 'brillante', 1, null, false, 4, 'prismes', 'choc', 1],
    ['t_orage',      'evenement', 'Tapis « L\'Orage »', 'Le ciel de The French Sorcerer, sous tes cartes. Ne se vendra plus après l\'événement.', 700, 'cosmetique', 1, null, true, 5, 'prismes', 'choc', null],
    ['t_supporter',  'evenement', 'Titre « Supporter du Choc »', 'Un titre qui ne se vendra plus après l\'événement.', 250, 'cosmetique', 1, null, true, 6, 'prismes', 'choc', null]
  ].map(([id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite]) =>
    ({ id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, actif: true,
       devise: devise || 'eclats', evenement: evenement || null, limite: limite == null ? null : limite }));

  /* Le Pass de l'événement (21_reflets.sql). */
  const PISTE = [
    [1, 15, 'boosters', 2, null, '2 boosters'], [2, 40, 'eclats', 150, null, '150 Éclats'],
    [3, 70, 'titre', 0, 't_eclaireur', 'Titre « Éclaireur des Reflets »'], [4, 105, 'fragments', 250, null, '250 Fragments'],
    [5, 145, 'boosters', 2, null, '2 boosters'], [6, 190, 'reverse_R', 1, null, 'Une Reverse Rare'],
    [7, 240, 'eclats', 300, null, '300 Éclats'], [8, 295, 'boosters', 3, null, '3 boosters'],
    [9, 355, 'fragments', 400, null, '400 Fragments'], [10, 420, 'cadre', 0, 'f_miroir', 'Cadre « Miroir »'],
    [11, 490, 'eclats', 400, null, '400 Éclats'], [12, 560, 'reverse_R', 1, null, 'Une Reverse Rare'],
    [13, 630, 'boosters', 3, null, '3 boosters'], [14, 700, 'fragments', 600, null, '600 Fragments'],
    [15, 770, 'brillante', 1, null, 'Une Essence Brillante'], [16, 840, 'eclats', 500, null, '500 Éclats'],
    [17, 910, 'boosters', 4, null, '4 boosters'], [18, 980, 'reverse_R', 2, null, 'Deux Reverses Rares'],
    [19, 1040, 'titre', 0, 't_ame', 'Titre « Âme des Reflets »'], [20, 1100, 'cadre', 0, 'f_nebuleuse', 'Cadre « Nébuleuse »']
  ].map(([palier, seuil, type, montant, objet, titre]) => ({ palier, seuil, type, montant, objet, titre }));
  /* Le Pass du Choc des Sections (25_choc.sql) : trente paliers. */
  const PISTE_CHOC = [
    [1, 20, 'boosters', 2, null, '2 boosters'], [2, 50, 'eclats', 150, null, '150 Éclats'],
    [3, 90, 'titre', 0, 't_recrue', 'Titre « Recrue du Choc »'], [4, 140, 'fragments', 250, null, '250 Fragments'],
    [5, 200, 'boosters', 2, null, '2 boosters'], [6, 270, 'reverse_R', 1, null, 'Une Reverse Rare'],
    [7, 350, 'eclats', 250, null, '250 Éclats'], [8, 440, 'sleeve', 0, 's_choc', 'Sleeve « Le Choc »'],
    [9, 540, 'boosters', 3, null, '3 boosters'], [10, 650, 'fragments', 400, null, '400 Fragments'],
    [11, 770, 'eclats', 300, null, '300 Éclats'], [12, 900, 'cadre', 0, 'f_choc', 'Cadre « Choc »'],
    [13, 1040, 'boosters', 3, null, '3 boosters'], [14, 1180, 'reverse_R', 1, null, 'Une Reverse Rare'],
    [15, 1320, 'brillante', 1, null, 'Une Essence Brillante'], [16, 1460, 'eclats', 400, null, '400 Éclats'],
    [17, 1600, 'fragments', 600, null, '600 Fragments'], [18, 1740, 'boosters', 4, null, '4 boosters'],
    [19, 1880, 'titre', 0, 't_veteran', 'Titre « Vétéran du Choc »'], [20, 2020, 'tapis', 0, 't_arene', 'Tapis « L\'Arène »'],
    [21, 2160, 'eclats', 500, null, '500 Éclats'], [22, 2300, 'reverse_R', 2, null, 'Deux Reverses Rares'],
    [23, 2440, 'boosters', 4, null, '4 boosters'], [24, 2580, 'fragments', 800, null, '800 Fragments'],
    [25, 2720, 'brillante', 1, null, 'Une Essence Brillante'], [26, 2860, 'eclats', 600, null, '600 Éclats'],
    [27, 3000, 'boosters', 5, null, '5 boosters'], [28, 3150, 'fragments', 1000, null, '1 000 Fragments'],
    [29, 3300, 'titre', 0, 't_maitre_choc', 'Titre « Maître du Choc »'], [30, 3500, 'legendaire', 1, null, 'Une Légendaire que tu n\'as pas']
  ].map(([palier, seuil, type, montant, objet, titre]) => ({ palier, seuil, type, montant, objet, titre }));
  const PISTES = { reflets: PISTE, choc: PISTE_CHOC };
  const pisteDe = code => PISTES[code] || PISTE;

  /* Le catalogue : celui du jeu (js/cards-data.js, js/promos-data.js). */
  /* L'objectif d'une rareté complète : le total de la rareté dans le catalogue,
     lu au premier besoin (le catalogue n'existe pas encore quand ce fichier
     se charge). */
  const objectif = q => q.goal != null ? q.goal
    : q.metric === 'rset_ALL' ? reverses.length
    : q.metric.startsWith('rset_') ? reverses.filter(k => k.rar === q.metric.slice(5)).length
    : cards.filter(k => k.rar === q.metric.slice(4)).length;

  const carte = id => byId[id];
  const extension = () => cards;                                  /* 122 cartes, sans les Promos */
  const dansBooster = () => cards.filter(c => c.inBoost !== false);

  /* ================================================================ état */
  let S = null;

  const profil = id => S.profils[id];
  const colDe = id => (S.col[id] = S.col[id] || {});
  const invDe = id => (S.inv[id] = S.inv[id] || {});
  const parPseudo = p => Object.values(S.profils)
    .find(x => x.pseudo.toLowerCase() === String(p || '').trim().toLowerCase());
  const sauver = () => kvSet(CLE, S);

  function nouveauProfil(id, pseudo, champs) {
    return Object.assign({
      id, pseudo, avatar: 'star', frame: 'default', is_admin: false,
      shards: 0, tickets: 5, last_tick: now(), trade_free_at: now(),
      packs_opened: 0, trades_done: 0, streak: 0, last_checkin: null,
      created_at: now(), vitrine: [], boite_vue_le: now(),
      fragments: 0, fabrications: 0, serie_max: 0
    }, champs || {});
  }

  /* ------------------------------------------------------------ outils SQL */
  const ajouter = (uid, cid, n) => {
    const c = colDe(uid);
    c[cid] = (c[cid] || 0) + n;
  };
  const possede = (uid, cid) => (colDe(uid)[cid] || 0) > 0;
  /* est_filleul, 21_reflets.sql : entré grâce au code d'un autre. */
  const estFilleul = uid => (S.invitations || []).some(i => i.utilise_par === uid);
  /* garde_cle et garde_de, 22_garder.sql : la carte, sinon sa rareté (les
     Reverses à part : « r » + rareté), sinon un. */
  const gardeCle = k => (k.rev ? 'r' : '') + k.rar;
  const gardeDe = (uid, cid) => {
    const k = carte(cid);
    return Math.max(1, ((S.gardes || {})[uid] || {})[cid] || (k && (profil(uid).garder || {})[gardeCle(k)]) || 1);
  };

  /* regen_tickets, 01_schema.sql */
  function regenTickets(p) {
    const pr = profil(p);
    const step = cfg('ticket_minutes') * 60000;
    if (pr.tickets >= cfg('ticket_cap')) {
      if (pr.last_tick < now()) pr.last_tick = now();
      return pr;
    }
    const gagne = Math.floor((now() - pr.last_tick) / step);
    if (gagne > 0) {
      const t = Math.min(cfg('ticket_cap'), pr.tickets + gagne);
      pr.last_tick = t >= cfg('ticket_cap') ? now() : pr.last_tick + gagne * step;
      pr.tickets = t;
    }
    return pr;
  }

  /* period_key, 01_schema.sql */
  const periode = sc => (sc === 'daily' || sc === 'ev_jour') ? jourParis(now()) : sc === 'weekly' ? semaineParis(now()) : 'all';
  const cleQp = (p, q) => `${p}|${q.id}|${periode(q.scope)}`;

  /* bump_quests, 01_schema.sql */
  function bump(p, m, n) {
    if (n <= 0) return;
    /* Une quête d'événement n'avance que pendant son événement. */
    QUETES.filter(q => q.metric === m && (!q.evenement || q.evenement === evenementEnCours())).forEach(q => {
      const k = cleQp(p, q);
      const qp = S.qp[k];
      if (!qp) S.qp[k] = { progress: n, claimed: false };
      else if (!qp.claimed) qp.progress += n;
    });
  }

  /* Le pourcentage de l'extension possédée : sync_collection_quests et
     check_promos font le même calcul. */
  function pctCollection(p) {
    const tout = extension();
    if (!tout.length) return 0;
    const c = colDe(p);
    return Math.floor(tout.filter(k => (c[k.id] || 0) > 0).length * 100 / tout.length);
  }

  /* sync_collection_quests, 01_schema.sql : le pourcentage de collection, et
     pour chaque rareté le nombre de cartes différentes possédées. */
  function syncCollection(p) {
    const pct = pctCollection(p);
    const c = colDe(p);
    const valeur = q => q.metric === 'collection_pct' ? pct
      : extension().filter(k => k.rar === q.metric.slice(4) && (c[k.id] || 0) > 0).length;
    const etat = q => q.metric === 'collection_pct' || q.metric.startsWith('set_')
      || q.metric.startsWith('rset_') || q.metric === 'brill_ALL' || q.metric.startsWith('ex_');
    const valeur2 = q => q.metric.startsWith('ex_')
        ? Math.max(0, ...extension().filter(k => k.rar === q.metric.slice(3)).map(k => c[k.id] || 0))
      : q.metric === 'rset_ALL' ? reverses.filter(k => (c[k.id] || 0) > 0).length
      : q.metric.startsWith('rset_') ? reverses.filter(k => k.rar === q.metric.slice(5) && (c[k.id] || 0) > 0).length
      : q.metric === 'brill_ALL' ? brillantes.filter(k => (c[k.id] || 0) > 0).length
      : valeur(q);
    QUETES.filter(etat).forEach(q => {
      const k = `${p}|${q.id}|all`;
      const qp = S.qp[k];
      const v = valeur2(q);
      if (!qp) S.qp[k] = { progress: v, claimed: false };
      else qp.progress = Math.max(qp.progress, v);
    });
  }

  /* check_promos, 03b_promos.sql */
  function checkPromos(p) {
    const pct = pctCollection(p);
    if (pct >= cfg('promo_palier_pct') && !possede(p, 'p06')) colDe(p).p06 = 1;
    if (pct >= 100 && !possede(p, 'p05')) colDe(p).p05 = 1;
  }

  /* notifier, 11_boite.sql */
  function notifier(dest, type, acteur, ref, data) {
    S.notifs.push({ id: ++S.seq, user_id: dest, type, acteur, ref: ref || null,
      data: data || {}, created_at: now() });
    if (dest === MOI) S.aSignaler = true;
  }

  /* succes_de, 15_evenements.sql */
  function succesDe(p) {
    const pr = profil(p);
    const c = colDe(p);
    const a = id => (c[id] || 0) > 0;
    const ext = extension().filter(k => a(k.id)).length;
    const leg = extension().filter(k => k.rar === 'L');
    const br = brillantes.filter(k => a(k.id)).length;
    const serie = Math.max(pr.serie_max || 0, pr.streak || 0);
    const s = [];
    if (pr.packs_opened >= 1) s.push('premier_booster');
    if (pr.packs_opened >= 100) s.push('boosters_100');
    if (pr.packs_opened >= 500) s.push('boosters_500');
    if (ext * 2 >= extension().length) s.push('collection_50');
    if (ext >= extension().length) s.push('master_set');
    if (leg.every(k => a(k.id))) s.push('toutes_legendaires');
    if (pr.trades_done >= 1) s.push('premier_echange');
    if (pr.trades_done >= 25) s.push('negociant');
    if (serie >= 7) s.push('serie_7');
    if (serie >= 30) s.push('serie_30');
    if (S.tirages.some(t => t.user_id === p && t.god)) s.push('godpack');
    if (br >= 1) s.push('brillante');
    if (brillantes.length && br >= brillantes.length) s.push('toutes_brillantes');
    if ((pr.fabrications || 0) >= 1) s.push('artisan');
    if (uniques.some(u => a(u.id))) s.push('unique');
    const rev = reverses.filter(k => a(k.id)).length;
    if (rev >= 1) s.push('premiere_reverse');
    if (reverses.length && rev >= reverses.length) s.push('reverses_toutes');
    return s;
  }

  /* chasse_etat, 15_evenements.sql */
  const chasseEtat = () => ({ carte: S.chasse.carte, active: S.chasse.active,
    trouvee: !!S.chasse.gagnant, gagnant: S.chasse.gagnant ? profil(S.chasse.gagnant).pseudo : null,
    trouvee_le: S.chasse.trouvee_le ? iso(S.chasse.trouvee_le) : null, ouvre_le: null });

  /* boite_non_lues, 11_boite.sql */
  function boiteNonLues(p) {
    const vue = profil(p).boite_vue_le;
    return S.notifs.filter(n => n.user_id === p && n.created_at > vue).length
      + S.annonces.filter(a => a.actif && a.created_at > vue).length;
  }

  /* ============================================== me(), 07_vitrine.sql */
  function me(p) {
    const pr = regenTickets(p);
    syncCollection(p);
    checkPromos(p);
    const garde = o => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0));
    const ordre = { daily: 0, ev: 1, ev_jour: 2, milestone: 3, weekly: 4 };     /* `order by q.scope` : ordre alphabétique */
    return {
      profil: {
        id: pr.id, pseudo: pr.pseudo, avatar: pr.avatar, frame: pr.frame, xp: xpDe(pr.id),
        is_admin: pr.is_admin, shards: pr.shards, tickets: pr.tickets,
        last_tick: iso(pr.last_tick), trade_free_at: iso(pr.trade_free_at),
        packs_opened: pr.packs_opened, trades_done: pr.trades_done,
        streak: pr.streak, last_checkin: pr.last_checkin,
        vitrine: pr.vitrine.slice(),
        fragments: pr.fragments || 0,
        boosters_bonus: pr.boosters_bonus || 0, bonus_offerts: pr.tickets_offerts || 0,
        titre: pr.titre || null, banniere: pr.banniere || null, devise: pr.devise || null,
        titres: titresDe(p),
        garder: Object.assign({}, pr.garder || {}),
        filleul: estFilleul(p),
        invite: true,
        ticket_cap: cfg('ticket_cap'), ticket_minutes: cfg('ticket_minutes'),
        serveur: iso(now())
      },
      boite: boiteNonLues(p),
      recyclage: {
        valeurs: { ES: cfg('recyclage_ES'), C: cfg('recyclage_C'), PC: cfg('recyclage_PC'),
          R: cfg('recyclage_R'), E: cfg('recyclage_E'), L: cfg('recyclage_L') },
        couts: { ES: cfg('fabrication_ES'), C: cfg('fabrication_C'), PC: cfg('fabrication_PC'),
          R: cfg('fabrication_R'), E: cfg('fabrication_E'), L: cfg('fabrication_L') }
      },
      succes: succesDe(p),
      evenement: evenementActif(),
      recap: evenementRecent(),
      chasse: chasseEtat(),
      parametres: { fabrication_reverse: !!S.parametres.fabrication_reverse },
      prismes: compte(p).solde,
      invitations: S.invitations.filter(i => i.auteur === p).map(i => ({ code: i.code, cree_le: iso(i.cree_le),
        utilise_par: i.utilise_par ? profil(i.utilise_par).pseudo : null, utilise_le: i.utilise_le ? iso(i.utilise_le) : null })),
      col: garde(colDe(p)),
      gardes: Object.assign({}, (S.gardes || {})[p] || {}),
      favoris: ((S.favoris || {})[p] || []).slice(),
      combat: combatEtat(p),
      inv: garde(invDe(p)),
      quetes: QUETES.filter(q => (!q.evenement || q.evenement === evenementEnCours()) && !(q.metric === 'invite' && estFilleul(p)))
        .sort((a, b) => ordre[a.scope] - ordre[b.scope] || a.ordre - b.ordre)
        .map(q => {
          const qp = S.qp[cleQp(p, q)];
          return { id: q.id, scope: q.scope, titre: q.titre, detail: q.detail,
            goal: objectif(q), reward: q.reward, item: q.item_id, metric: q.metric,
            progress: Math.min(qp ? qp.progress : 0, objectif(q)),
            claimed: qp ? qp.claimed : false, monnaie: q.monnaie, evenement: q.evenement };
        })
    };
  }

  /* ======================================== version 2.0, 21_reflets.sql */
  /* L'événement « Reflets » : deux semaines à partir de la création du monde. */
  function evenementEnCours() {
    const e = S.evenement;
    return e && now() >= e.debut && now() < e.fin ? e.code : null;
  }
  /* evenement_recent, 21_reflets.sql : fini depuis moins de trois jours. */
  function evenementRecent() {
    const e = S.evenement;
    if (!e || !e.code || now() < e.fin || now() >= e.fin + 3 * 86400000) return null;
    return { code: e.code, titre: e.titre, debut: iso(e.debut), fin: iso(e.fin), jusqua: iso(e.fin + 3 * 86400000) };
  }
  function evenementActif() {
    const e = S.evenement;
    if (!e || now() >= e.fin) return null;
    return { titre: e.titre, texte: e.texte, code: e.code, debut: iso(e.debut), fin: iso(e.fin),
      ticket_minutes: null, a_venir: now() < e.debut };
  }
  function compte(p) {
    const ev = evenementEnCours() || 'reflets';
    const k = p + '|' + ev;
    return (S.evt.comptes[k] = S.evt.comptes[k] || { solde: 0, total: 0 });
  }
  function crediterPrismes(p, n) {
    if (!evenementEnCours() || !(n > 0)) return;
    const c = compte(p); c.solde += n; c.total += n;
  }

  /* accorder, 21_reflets.sql */
  function accorder(p, t, n, objet) {
    const pr = profil(p);
    const cartes = [];
    if (t === 'boosters') pr.boosters_bonus = (pr.boosters_bonus || 0) + n;
    else if (t === 'eclats') pr.shards += n;
    else if (t === 'fragments') pr.fragments = (pr.fragments || 0) + n;
    else if (t === 'titre' || t === 'cadre' || t === 'tapis' || t === 'sleeve') { const inv = invDe(p); if (!(objet in inv)) inv[objet] = 1; }
    else if (t === 'legendaire') {
      /* Version 3.0 : une Légendaire qu'on n'a pas ; sinon de quoi en fabriquer la moitié. */
      const l = cards.filter(k => k.rar === 'L' && !k.promo && !possede(p, k.id));
      if (!l.length) pr.fragments = (pr.fragments || 0) + 4000;
      else { const k = choix(l); ajouter(p, k.id, 1); cartes.push(k.id); }
    }
    else if (t === 'reverse_R') {
      for (let i = 0; i < Math.max(n, 1); i++) {
        const l = reverses.filter(k => k.rar === 'R' && !possede(p, k.id) && !cartes.includes(k.id));
        const k = l.length ? choix(l) : choix(reverses.filter(x => x.rar === 'R'));
        ajouter(p, k.id, 1); cartes.push(k.id);
      }
    } else if (t === 'brillante') {
      const l = brillantes.filter(k => !possede(p, k.id));
      if (!l.length) pr.fragments = (pr.fragments || 0) + 2000;
      else { const k = choix(l); ajouter(p, k.id, 1); cartes.push(k.id); }
    } else refuser('Récompense inconnue.');
    if (cartes.length) { syncCollection(p); checkPromos(p); }
    return cartes;
  }

  /* titres_de, 21_reflets.sql */
  function titresDe(p) {
    const s = succesDe(p);
    const map = { pionnier: 't_pionnier', unique: 't_elu', master_set: 't_maitre', negociant: 't_negociant',
      godpack: 't_chanceux', boosters_100: 't_centurion', serie_30: 't_fidele', artisan: 't_artisan',
      toutes_brillantes: 't_prisme', reverses_toutes: 't_reflet' };
    const t = Object.keys(map).filter(k => s.includes(k)).map(k => map[k]);
    if (profil(p).is_admin) t.push('t_admin');
    Object.keys(invDe(p)).filter(k => k.startsWith('t_') && invDe(p)[k] > 0).sort().forEach(k => t.push(k));
    return t;
  }

  function creerInvitation(p) {
    let code;
    do code = 'M8-' + Math.random().toString(16).slice(2, 6).toUpperCase() + '-' + Math.random().toString(16).slice(2, 6).toUpperCase();
    while (S.invitations.some(i => i.code === code));
    S.invitations.push({ code, auteur: p, cree_le: now(), utilise_par: null, utilise_le: null });
    return code;
  }

  /* Devine l'illu : l'illustration du jour, tirée par un hachage de la date.
     Les grilles de pixels sont celles du serveur (supabase/21b_illu.sql),
     recopiées par tools/demo.py dans window.DEMO_ILLU. */
  function hacher(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const illuCartes = () => cards.filter(k => k.cat !== 'essence' && (window.DEMO_ILLU || {})[k.id]);
  /* Un ordre fixe, et chaque jour prend la suivante : jamais deux fois la
     même avant d'avoir vu toutes les autres (illu_cible, 21_reflets.sql). */
  function illuCible(j) {
    const l = illuCartes().map(k => [hacher('demo:' + k.id), k.id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    if (!l.length) return null;
    const n = Math.round((Date.parse(j + 'T12:00:00Z') - Date.parse('2026-01-01T12:00:00Z')) / 86400000);
    return l[((n % l.length) + l.length) % l.length];
  }
  const ILLU_GAINS = [{ prismes: 25, eclats: 120 }, { prismes: 18, eclats: 90 }, { prismes: 12, eclats: 60 }, { prismes: 6, eclats: 30 }];
  /* illu_grille : la grille fine moyennée par blocs de 4, 3, 2 ou 1 pixels. */
  function illuGrille(cid, niveau) {
    const src = Uint8Array.from(atob(window.DEMO_ILLU[cid]), c => c.charCodeAt(0));
    const nib = n => (n % 2 === 0 ? src[n >> 1] >> 4 : src[n >> 1] & 15) * 17;
    const f = [4, 3, 2, 1][niveau - 1], w = 36 / f, h = 24 / f, o = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = [0, 0, 0];
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const i = (y * f + dy) * 36 + x * f + dx;
        for (let k = 0; k < 3; k++) s[k] += nib(i * 3 + k);
      }
      for (let k = 0; k < 3; k++) o[(y * w + x) * 3 + k] = Math.round(s[k] / (f * f));
    }
    return { w, h, data: btoa(String.fromCharCode(...o)) };
  }
  function illuEtat(p) {
    const j = jourParis(now());
    const cible = illuCible(j);
    if (!cible) return null;
    const d = S.illu[p + '|' + j] || { essais: [], trouve: false };
    const n = d.essais.length;
    const fini = d.trouve || n >= 4;
    return { jour: j, max: 4, essais: d.essais.slice(), trouve: d.trouve, fini,
      niveau: fini ? 4 : n + 1, grille: fini ? null : illuGrille(cible, n + 1),
      cible: fini ? cible : null, gain: d.trouve ? ILLU_GAINS[n - 1] : null, gains: ILLU_GAINS,
      prismes: evenementEnCours() === 'reflets' };
  }

  /* =================================================== les actions (03_rpc) */
  const RPC = {};

  RPC.me = p => me(p);

  /* porte, 01_schema.sql : la démo est toujours ouverte. */
  RPC.porte = () => ({ ouvert: true, lancement: null, serveur: iso(now()) });

  RPC.set_profile = (p, { p_pseudo, p_avatar, p_frame }) => {
    if (p_pseudo != null) {
      if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(p_pseudo))
        refuser('Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ -');
      const x = parPseudo(p_pseudo);
      if (x && x.id !== p) refuser('Ce pseudo est déjà pris.');
    }
    if (p_avatar != null && p_avatar.startsWith('card:') && !possede(p, p_avatar.slice(5)))
      refuser('Tu ne possèdes pas cette carte.');
    if (p_frame != null && p_frame !== 'default' && !((invDe(p)[p_frame] || 0) > 0))
      refuser('Cadre non débloqué.');
    const pr = profil(p);
    if (p_pseudo != null) pr.pseudo = p_pseudo;
    if (p_avatar != null) pr.avatar = p_avatar;
    if (p_frame != null) pr.frame = p_frame;
    return me(p);
  };

  RPC.checkin = p => {
    const pr = profil(p);
    const auj = jourParis(now());
    if (pr.last_checkin !== auj) {
      pr.streak = pr.last_checkin === hier(auj) ? pr.streak + 1 : 1;
      pr.last_checkin = auj;
      pr.serie_max = Math.max(pr.serie_max || 0, pr.streak);
      bump(p, 'checkin', 1);
    }
    return me(p);
  };

  /* pick_card, 03_rpc.sql */
  const REPLI = {
    C: ['C', 'PC', 'R', 'E', 'L'], PC: ['PC', 'C', 'R', 'E', 'L'], R: ['R', 'PC', 'E', 'C', 'L'],
    E: ['E', 'R', 'L', 'PC', 'C'], L: ['L', 'E', 'R', 'PC', 'C']
  };
  function pickCard(r) {
    /* Version 3.0 : les Secrètes (23_combats.sql). */
    if (r === 'S') { const l = secretes; if (l.length) return choix(l).id; r = 'L'; }
    for (const essai of REPLI[r] || REPLI.C) {
      const l = dansBooster().filter(c => c.rar === essai && c.cat !== 'essence');
      if (l.length) return choix(l).id;
    }
    return null;
  }
  const tirage = seuils => { const x = Math.random() * 100; return seuils.find(([s]) => x < s)[1]; };
  /* La case Essence : une fois sur cfg('foil_odds'), la version Brillante. */
  const essence = ess => {
    if (!ess.length) return pickCard('C');
    const e = choix(ess).id;
    return Math.random() < 1 / cfg('foil_odds') && carte('b' + e.slice(1)) ? 'b' + e.slice(1) : e;
  };

  /* La case Reverse (version 2.0). */
  const reverseCard = r => { const l = reverses.filter(c => c.rar === r); return l.length ? choix(l).id : pickCard(r); };

  /* Les six cartes d'open_pack, sans rien écrire : sert aussi à garnir la
     collection des joueurs simulés. */
  function tirerPaquet() {
    const god = Math.random() < 1 / cfg('god_odds');
    let ids;
    if (god) {
      ids = [
        pickCard(tirage([[90, 'R'], [100, 'E']])),
        pickCard(tirage([[70, 'R'], [100, 'E']])),
        pickCard(tirage([[50, 'R'], [100, 'E']])),
        pickCard(tirage([[90, 'E'], [100, 'L']])),
        pickCard(tirage([[60, 'E'], [100, 'L']])),
        pickCard('L')
      ];
    } else {
      const ess = dansBooster().filter(c => c.cat === 'essence');
      ids = [
        pickCard('C'), pickCard('C'),
        pickCard('PC'),
        essence(ess),
        reverseCard(tirage([[50, 'C'], [85, 'PC'], [100, 'R']])),
        /* Version 3.0 : Rare 79 %, Épique 16 %, Légendaire 4,25 %, Secrète 0,75 %. */
        pickCard(tirage([[79, 'R'], [95, 'E'], [99.25, 'L'], [100, 'S']]))
      ];
    }
    return { ids: ids.filter(Boolean), god };
  }

  RPC.open_pack = (p, a) => {
    const pr = regenTickets(p);
    /* Un booster en plus (boutique, cadeau) : hors réserve, sans toucher à sa
       recharge. */
    const bonus = !!(a && a.p_bonus);
    if (bonus ? !((pr.boosters_bonus || 0) > 0) : pr.tickets < 1) refuser(bonus ? 'BONUS_VIDE' : 'RESERVE_VIDE');
    const { ids, god } = tirerPaquet();
    if (!ids.length) refuser('BOOSTER_VIDE');

    /* La chasse : la carte unique prend la place de la dernière carte, une
       seule fois — jamais dans un booster offert, ouvert en premier. */
    const offert = bonus && (pr.tickets_offerts || 0) > 0;
    if (offert) pr.tickets_offerts--;
    if (S.chasse.active && !S.chasse.gagnant && !offert && Math.random() < 1 / cfg('chasse_odds')) {
      S.chasse.gagnant = p;
      S.chasse.trouvee_le = now();
      ids[ids.length - 1] = S.chasse.carte;
      S.inv[p] = S.inv[p] || {};
      S.inv[p].f_unique = 1;
      pr.frame = 'f_unique';
      S.annonces.push({ id: ++S.seq, actif: true, created_at: now(),
        titre: (carte(S.chasse.carte) || {}).nom + ' a été trouvée !',
        texte: pr.pseudo + ' l\'a tirée d\'un booster. Il n\'en existe qu\'une seule dans tout le jeu.' });
    }

    /* Comme le SQL : chaque exemplaire non possédé compte, doublons du même
       paquet compris. */
    const nouvelles = ids.filter(id => !possede(p, id)).length;
    ids.forEach(id => ajouter(p, id, 1));

    if (bonus) pr.boosters_bonus -= 1;
    else {
      pr.last_tick = pr.tickets >= cfg('ticket_cap') ? now() : pr.last_tick;
      pr.tickets -= 1;
    }
    pr.packs_opened += 1;
    S.tirages.push({ user_id: p, cartes: ids.slice(), god, created_at: now() });

    /* `where id = any(ids)` : chaque carte distincte compte une fois. */
    const distinctes = [...new Set(ids)].map(carte).filter(Boolean);
    bump(p, 'packs', 1);
    bump(p, 'new_cards', nouvelles);
    bump(p, 'rarity_R', distinctes.filter(c => ['R', 'E', 'L'].includes(c.rar)).length);
    bump(p, 'rarity_E', distinctes.filter(c => ['E', 'L'].includes(c.rar)).length);
    bump(p, 'rarity_L', distinctes.filter(c => c.rar === 'L').length);
    bump(p, 'rarity_S', distinctes.filter(c => c.rar === 'S').length);
    bump(p, 'rev_R', distinctes.filter(c => c.rev && c.rar === 'R').length);
    syncCollection(p);
    checkPromos(p);
    return { cards: ids, god, etat: me(p) };
  };

  RPC.claim_quest = (p, { p_quest }) => {
    const q = QUETES.find(x => x.id === p_quest);
    if (!q) refuser('Quête inconnue.');
    if (q.evenement && q.evenement !== evenementEnCours()) refuser('Cet événement est terminé.');
    const qp = S.qp[cleQp(p, q)];
    if (qp && qp.claimed) refuser('Récompense déjà récupérée.');
    if ((qp ? qp.progress : 0) < objectif(q)) refuser('Quête non terminée.');
    qp.claimed = true;
    if (q.reward > 0 && q.monnaie === 'prismes') crediterPrismes(p, q.reward);
    else if (q.reward > 0) profil(p).shards += q.reward;
    if (q.item_id) {
      if (carte(q.item_id)) { if (!(q.item_id in colDe(p))) colDe(p)[q.item_id] = 1; }
      else if (!(q.item_id in invDe(p))) invDe(p)[q.item_id] = 1;
    }
    return me(p);
  };

  RPC.shop_buy = (p, { p_item }) => {
    const it = BOUTIQUE.find(x => x.id === p_item && x.actif);
    if (!it) refuser('Article indisponible.');
    if (it.evenement && it.evenement !== evenementEnCours()) refuser('Cet événement est terminé.');
    if (it.effet === 'invitation' && estFilleul(p)) refuser('Les joueurs invités ne peuvent pas inviter à leur tour.');
    const pr = profil(p);
    const inv = invDe(p);
    if (it.unique_buy && it.id in inv) refuser('Tu possèdes déjà cet article.');
    if (it.limite != null && (inv[it.id] || 0) >= it.limite) refuser('Tu as atteint la limite pour cet article.');
    if (it.devise === 'fragments') {
      if ((pr.fragments || 0) < it.prix) refuser('Pas assez de Fragments.');
      pr.fragments -= it.prix;
    } else if (it.devise === 'prismes') {
      const c = compte(p);
      if (c.solde < it.prix) refuser(evenementEnCours() === 'choc' ? 'Pas assez d\'Insignes.' : 'Pas assez de Prismes.');
      c.solde -= it.prix;
    } else {
      if (pr.shards < it.prix) refuser('Pas assez d\'Éclats.');
      pr.shards -= it.prix;
    }
    if (it.limite != null && !it.unique_buy) inv[it.id] = (inv[it.id] || 0) + 1;
    if (it.effet === 'tickets') pr.boosters_bonus = (pr.boosters_bonus || 0) + it.montant;
    else if (it.effet === 'refill') { pr.tickets = Math.max(pr.tickets, cfg('ticket_cap')); pr.last_tick = now(); }
    else if (it.effet === 'trade_token') inv.trade_token = (inv.trade_token || 0) + it.montant;
    else if (it.effet === 'invitation') creerInvitation(p);
    else if (it.effet === 'fragments' || it.effet === 'reverse_R' || it.effet === 'brillante') accorder(p, it.effet, it.montant, null);
    else if (it.effet === 'carte') {
      if (!it.carte_id) refuser('Article mal configuré.');
      ajouter(p, it.carte_id, 1);
      inv[it.id] = (inv[it.id] || 0) + 1;
    } else inv[it.id] = (inv[it.id] || 0) + 1;
    return me(p);
  };

  /* ---------------------------------------------------------- échanges */
  /* rembourser_demande, 03_rpc.sql */
  function rembourser(t) {
    if (t.jeton) { const inv = invDe(t.from_user); inv.trade_token = (inv.trade_token || 0) + 1; }
    else {
      const pr = profil(t.from_user);
      if (pr.trade_free_at > now()) pr.trade_free_at = now();
    }
  }

  /* trade_create, 03_rpc.sql — `p` peut être un joueur simulé. */
  function creerEchange(p, pseudo, offer, want, note) {
    const dest = parPseudo(pseudo);
    if (!dest) refuser('Aucun joueur ne porte ce pseudo.');
    if (dest.id === p) refuser('Tu ne peux pas échanger avec toi-même.');
    const co = carte(offer), cw = carte(want);
    if (!co || !cw) refuser('Carte inconnue.');
    if (co.rar !== cw.rar) refuser('Les deux cartes doivent être de la même rareté.');
    if (co.rar === 'ES') refuser('Les Essences ne s\'échangent pas.');
    if (co.rar === 'PR') refuser('Les cartes Promo ne s\'échangent pas.');
    if (co.promo || cw.promo) refuser('Cette carte ne s\'échange pas.');
    if (!!co.rev !== !!cw.rev) refuser('Une Reverse s\'échange contre une Reverse.');
    if (!possede(p, offer)) refuser('Tu ne possèdes pas la carte que tu proposes.');
    if (S.trades.some(t => t.from_user === p && t.to_user === dest.id && t.offer_card === offer
      && t.want_card === want && t.status === 'pending')) refuser('Cette demande est déjà en attente.');
    if (S.trades.filter(t => t.from_user === p && t.status === 'pending').length >= 10)
      refuser('Tu as déjà 10 demandes en attente.');

    const pr = profil(p);
    const gratuit = pr.trade_free_at <= now();
    if (gratuit) pr.trade_free_at = now() + cfg('trade_cooldown_h') * 3600000;
    else {
      const inv = invDe(p);
      if (!((inv.trade_token || 0) >= 1)) refuser('ECHANGE_EN_RECHARGE');
      inv.trade_token -= 1;
    }
    const t = { id: uuid(), from_user: p, to_user: dest.id, offer_card: offer, want_card: want,
      note: String(note || '').slice(0, 140), status: 'pending', created_at: now(),
      resolved_at: null, jeton: !gratuit };
    /* Le moment où le joueur simulé répondra : voir « Les joueurs simulés ». */
    if (dest.bot) t.repondre_a = now() + alea(12, 40) * 1000;
    S.trades.push(t);
    notifier(dest.id, 'echange_recu', p, t.id, { offer, want });
    return t;
  }

  RPC.trade_create = (p, { p_pseudo, p_offer, p_want, p_note }) => {
    creerEchange(p, p_pseudo, p_offer, p_want, p_note);
    return me(p);
  };

  /* trade_respond, 03_rpc.sql — `p` peut être un joueur simulé. */
  function repondreEchange(p, id, accepter) {
    const t = S.trades.find(x => x.id === id);
    if (!t) refuser('Demande introuvable.');
    if (t.to_user !== p) refuser('Cette demande ne t\'est pas adressée.');
    if (t.status !== 'pending') refuser('Cette demande est déjà traitée.');
    const d = { offer: t.offer_card, want: t.want_card };

    if (!accepter) {
      t.status = 'declined'; t.resolved_at = now();
      rembourser(t);
      notifier(t.from_user, 'echange_refuse', p, t.id, d);
      return;
    }
    if (!possede(t.from_user, t.offer_card)) refuser('Le demandeur ne possède plus cette carte.');
    if (!possede(p, t.want_card)) refuser('Tu ne possèdes pas la carte demandée.');

    ajouter(t.from_user, t.offer_card, -1);
    ajouter(p, t.want_card, -1);
    ajouter(p, t.offer_card, 1);
    ajouter(t.from_user, t.want_card, 1);

    t.status = 'accepted'; t.resolved_at = now();
    profil(p).trades_done += 1;
    profil(t.from_user).trades_done += 1;
    notifier(t.from_user, 'echange_accepte', p, t.id, d);
    bump(p, 'trades', 1);
    bump(t.from_user, 'trades', 1);
    syncCollection(p);
    syncCollection(t.from_user);
  }

  RPC.trade_respond = (p, { p_trade, p_accept }) => {
    repondreEchange(p, p_trade, !!p_accept);
    return me(p);
  };

  RPC.trade_cancel = (p, { p_trade }) => {
    const t = S.trades.find(x => x.id === p_trade);
    if (!t || t.from_user !== p) refuser('Demande introuvable.');
    if (t.status !== 'pending') refuser('Cette demande est déjà traitée.');
    t.status = 'cancelled'; t.resolved_at = now();
    rembourser(t);
    return me(p);
  };

  RPC.trade_list = p => S.trades
    .filter(t => (t.from_user === p || t.to_user === p)
      && (t.status === 'pending' || t.resolved_at > now() - 7 * 86400000))
    .sort((a, b) => b.created_at - a.created_at)
    .map(t => {
      const moi = t.from_user === p;
      const o = profil(moi ? t.to_user : t.from_user);
      return { id: t.id, sens: moi ? 'envoyee' : 'recue', pseudo: o.pseudo, avatar: o.avatar,
        photo: null, offer: t.offer_card, want: t.want_card, note: t.note, status: t.status,
        created_at: iso(t.created_at), possible: possede(p, moi ? t.offer_card : t.want_card) };
    });

  RPC.find_player = (p, { p_pseudo }) => {
    const r = parPseudo(p_pseudo);
    return r ? { pseudo: r.pseudo, avatar: r.avatar, frame: r.frame, xp: xpDe(r.id), photo: null } : null;
  };

  /* ------------------------------------------------ amis, 06_social.sql */
  const paire = (x, y) => S.amities.find(f => (f.a === x && f.b === y) || (f.a === y && f.b === x));

  function listeAmis(moi) {
    return S.amities.filter(f => f.a === moi || f.b === moi)
      .map(f => {
        const o = profil(f.a === moi ? f.b : f.a);
        return {
          pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), photo: null,
          is_admin: o.is_admin, streak: o.streak,
          lien: f.accepte ? 'ami' : f.demandeur === moi ? 'envoyee' : 'recue',
          depuis: iso(f.resolved_at || f.created_at),
          echanges: S.trades.filter(t => t.status === 'pending'
            && ((t.from_user === moi && t.to_user === o.id) || (t.from_user === o.id && t.to_user === moi))).length
        };
      })
      .sort((a, b) => (a.lien === 'ami') - (b.lien === 'ami') || a.pseudo.localeCompare(b.pseudo));
  }

  /* friend_request — `moi` peut être un joueur simulé. */
  function demanderAmi(moi, pseudo) {
    const autre = parPseudo(pseudo);
    if (!autre) refuser('Aucun joueur ne porte ce pseudo.');
    if (autre.id === moi) refuser('Tu ne peux pas t\'ajouter toi-même.');
    const f = paire(moi, autre.id);
    if (f) {
      if (f.accepte) refuser('Vous êtes déjà amis.');
      if (f.demandeur !== moi) {
        f.accepte = true; f.resolved_at = now();
        notifier(autre.id, 'ami_accepte', moi);
        return;
      }
      refuser('Ta demande est déjà en attente.');
    }
    if (S.amities.filter(x => x.demandeur === moi && !x.accepte).length >= 25)
      refuser('Tu as déjà 25 demandes en attente.');
    const n = { a: moi, b: autre.id, demandeur: moi, accepte: false, created_at: now(), resolved_at: null };
    if (autre.bot) n.repondre_a = now() + alea(6, 20) * 1000;
    S.amities.push(n);
    S.notifs = S.notifs.filter(x => !(x.user_id === autre.id && x.acteur === moi && x.type === 'ami_demande'));
    notifier(autre.id, 'ami_demande', moi);
  }

  RPC.friend_request = (p, { p_pseudo }) => { demanderAmi(p, p_pseudo); return listeAmis(p); };

  RPC.friend_respond = (p, { p_pseudo, p_accept }) => {
    const autre = parPseudo(p_pseudo);
    if (!autre) refuser('Joueur introuvable.');
    const f = paire(p, autre.id);
    if (!f || f.accepte) refuser('Aucune demande en attente.');
    if (f.demandeur === p) refuser('C\'est toi qui as fait cette demande.');
    if (p_accept) {
      f.accepte = true; f.resolved_at = now();
      notifier(autre.id, 'ami_accepte', p);
    } else S.amities = S.amities.filter(x => x !== f);
    return listeAmis(p);
  };

  RPC.friend_remove = (p, { p_pseudo }) => {
    const autre = parPseudo(p_pseudo);
    if (!autre) refuser('Joueur introuvable.');
    const f = paire(p, autre.id);
    S.amities = S.amities.filter(x => x !== f);
    return listeAmis(p);
  };

  RPC.friend_list = p => listeAmis(p);

  /* amis_doublons, 21_reflets.sql */
  RPC.amis_doublons = moi => {
    const mien = colDe(moi);
    const parCarte = {};
    S.amities.filter(f => f.accepte && (f.a === moi || f.b === moi)).forEach(f => {
      const o = profil(f.a === moi ? f.b : f.a);
      Object.entries(colDe(o.id)).forEach(([id, n]) => {
        const k = carte(id);
        if (!k || n <= gardeDe(o.id, id) || (mien[id] || 0) > 0 || k.cat === 'essence' || (k.promo && !k.rev)) return;
        (parCarte[id] = parCarte[id] || []).push({ pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), photo: null, n });
      });
    });
    return Object.entries(parCarte)
      .map(([carte, amis]) => ({ carte, amis: amis.sort((a, b) => b.n - a.n) }))
      .sort((a, b) => b.amis.length - a.amis.length || a.carte.localeCompare(b.carte));
  };

  /* player_profile, 07_vitrine.sql */
  RPC.player_profile = (moi, { p_pseudo }) => {
    const o = parPseudo(p_pseudo);
    if (!o) return null;
    const ami = o.id === moi || !!(paire(moi, o.id) || {}).accepte;
    const c = colDe(o.id);
    return {
      pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), photo: null,
      is_admin: o.is_admin, streak: o.streak,
      packs_opened: o.packs_opened, trades_done: o.trades_done,
      membre_depuis: iso(o.created_at),
      possede: extension().filter(k => (c[k.id] || 0) > 0).length,
      total: extension().length,
      reverses: reverses.filter(k => (c[k.id] || 0) > 0).length, reverses_total: reverses.length,
      titre: o.titre || null, banniere: o.banniere || null, devise: o.devise || null,
      vitrine: o.vitrine.slice(),
      xp: xpDe(o.id),
      succes: succesDe(o.id),
      ami, moi: o.id === moi,
      col: ami ? Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)) : null,
      garde: ami ? Object.fromEntries(Object.keys(c).filter(id => c[id] > 0)
        .map(id => [id, gardeDe(o.id, id)]).filter(([, g]) => g > 1)) : null
    };
  };

  /* regler_garder et regler_garder_defaut, 22_garder.sql */
  RPC.regler_garder = (p, { p_carte, p_n }) => {
    const k = carte(p_carte);
    if (!k) refuser('Carte inconnue.');
    if (k.promo) refuser('Cette carte se garde toujours.');
    if (p_n != null && (p_n < 1 || p_n > 99)) refuser('Entre 1 et 99 exemplaires.');
    const g = (S.gardes[p] = S.gardes[p] || {});
    if (p_n == null || p_n === Math.max(1, (profil(p).garder || {})[gardeCle(k)] || 1)) delete g[p_carte];
    else g[p_carte] = Math.trunc(p_n);
    return me(p);
  };

  RPC.regler_garder_defaut = (p, { p_garder }) => {
    if (!p_garder || typeof p_garder !== 'object') refuser('Réglage invalide.');
    const propre = {};
    Object.entries(p_garder).forEach(([r, n]) => {
      if (!['ES', 'C', 'PC', 'R', 'E', 'L', 'rC', 'rPC', 'rR'].includes(r)) refuser('Rareté inconnue.');
      if (![1, 2, 3, 4].includes(n)) refuser('Entre 1 et 4 exemplaires.');
      if (n > 1) propre[r] = n;
    });
    profil(p).garder = propre;
    return me(p);
  };

  /* favori, 22_garder.sql */
  RPC.favori = (p, { p_carte, p_on }) => {
    if (!carte(p_carte)) refuser('Carte inconnue.');
    const l = (S.favoris[p] = (S.favoris[p] || []).filter(id => id !== p_carte));
    if (p_on) l.push(p_carte);
    return l.slice();
  };

  RPC.set_vitrine = (p, { p_cards }) => {
    const l = p_cards || [];
    if (l.length > 4) refuser('Quatre cartes au maximum.');
    const propre = [];
    l.forEach(c => {
      if (propre.includes(c)) return;
      if (!possede(p, c)) refuser('Tu ne possèdes pas une des cartes choisies.');
      propre.push(c);
    });
    profil(p).vitrine = propre;
    return me(p);
  };

  /* ------------------------------------------ boite, 11_boite.sql */
  RPC.boite = p => {
    S.notifs = S.notifs.filter(n => !(n.user_id === p && n.created_at < now() - 30 * 86400000));
    return {
      vue_le: iso(profil(p).boite_vue_le),
      serveur: iso(now()),
      items: S.notifs.filter(n => n.user_id === p).sort((a, b) => b.id - a.id).slice(0, 50).map(n => {
        const o = n.acteur ? profil(n.acteur) : null;
        const t = n.type.startsWith('echange') ? S.trades.find(x => x.id === n.ref) : null;
        const f = n.type === 'ami_demande' ? paire(p, n.acteur) : null;
        return {
          id: 'n' + n.id, type: n.type, quand: iso(n.created_at), ref: n.ref, data: n.data,
          pseudo: o && o.pseudo, avatar: o && o.avatar, frame: o && o.frame, xp: o ? xpDe(o.id) : 0, photo: null,
          en_attente: n.type === 'ami_demande' ? !!(f && !f.accepte && f.demandeur === n.acteur)
            : n.type === 'echange_recu' ? !!(t && t.status === 'pending') : false,
          statut: n.type === 'echange_recu' && t ? t.status : null
        };
      }),
      annonces: S.annonces.filter(a => a.actif).sort((a, b) => b.id - a.id).slice(0, 10)
        .map(a => ({ id: 'a' + a.id, num: a.id, titre: a.titre, texte: a.texte, quand: iso(a.created_at) }))
    };
  };

  RPC.boite_lue = p => { profil(p).boite_vue_le = now(); return { vue_le: iso(now()) }; };

  RPC.annonce_publier = () => refuser('Réservé aux administrateurs.');
  RPC.annonce_retirer = () => refuser('Réservé aux administrateurs.');

  /* ------------------------------------ classement, 14_classement.sql */
  RPC.classement = (moi, { p_critere }) => {
    if (!['collection', 'reverses', 'boosters', 'echanges', 'serie'].includes(p_critere)) refuser('Classement inconnu.');
    const auj = jourParis(now());
    const valeur = pr => p_critere === 'collection'
      ? extension().filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'reverses' ? reverses.filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'boosters' ? pr.packs_opened
      : p_critere === 'echanges' ? pr.trades_done
      : (pr.last_checkin === auj || pr.last_checkin === hier(auj)) ? pr.streak : 0;
    const l = Object.values(S.profils).map(pr => ({ pr, valeur: valeur(pr) }))
      .filter(x => x.valeur > 0)
      .sort((a, b) => b.valeur - a.valeur || a.pr.pseudo.toLowerCase().localeCompare(b.pr.pseudo.toLowerCase()));
    const ligne = x => ({ rang: 1 + l.filter(y => y.valeur > x.valeur).length, pseudo: x.pr.pseudo,
      avatar: x.pr.avatar, frame: x.pr.frame, xp: xpDe(x.pr.id), titre: x.pr.titre || null, photo: null, valeur: x.valeur, moi: x.pr.id === moi });
    const m = l.find(x => x.pr.id === moi);
    return { critere: p_critere, classes: l.length, top: l.slice(0, 50).map(ligne), moi: m ? ligne(m) : null };
  };

  /* ------------------------------------ recycler, 12_recyclage.sql */
  RPC.recycler = (p, { p_lots }) => {
    if (!Array.isArray(p_lots) || !p_lots.length) refuser('Rien à recycler.');
    if (p_lots.length > 150) refuser('Trop de cartes d\'un coup.');
    /* Tout passe, ou rien : on travaille sur une copie. */
    const col = Object.assign({}, colDe(p));
    const journal = [];
    const vus = [];
    let total = 0;
    p_lots.forEach(lot => {
      const cid = lot && lot.carte;
      if (typeof (lot && lot.n) !== 'number') refuser('Quantité invalide.');
      const n = Math.trunc(lot.n);
      if (!cid || n < 1) refuser('Quantité invalide.');
      if (vus.includes(cid)) refuser('Une carte apparaît deux fois.');
      vus.push(cid);
      const k = carte(cid);
      if (!k) refuser('Carte inconnue.');
      if (k.promo) refuser('Cette carte ne se recycle pas.');
      if (k.rev && !(S.parametres || {}).fabrication_reverse) refuser('Les Reverses ne se recyclent pas encore.');
      const prix = cfg('recyclage_' + k.rar);
      if (prix == null) refuser('Cette carte ne se recycle pas.');
      const reserve = S.trades.filter(t => t.from_user === p && t.offer_card === cid && t.status === 'pending').length;
      const g = gardeDe(p, cid);
      if ((col[cid] || 0) - g - reserve < n) {
        if (g > 1) refuser(`Tu as choisi de garder ${g} exemplaires de « ${k.nom} ».`);
        refuser(`Pas assez de doublons de « ${k.nom} » : tu gardes toujours un exemplaire.`);
      }
      col[cid] -= n;
      journal.push({ user_id: p, card_id: cid, qty: n, eclats: 0, fragments: n * prix, created_at: now() });
      total += n * prix;
    });
    S.col[p] = col;
    S.recyclages.push(...journal);
    profil(p).fragments = (profil(p).fragments || 0) + total;
    bump(p, 'recycle', journal.reduce((n, l) => n + l.qty, 0));
    return me(p);
  };

  /* fabriquer, 12_recyclage.sql */
  RPC.fabriquer = (p, { p_carte }) => {
    const k = carte(p_carte);
    if (!k) refuser('Carte inconnue.');
    if (k.promo) refuser('Cette carte ne se fabrique pas.');
    let cout = cfg('fabrication_' + k.rar);
    if (cout == null) refuser('Cette carte ne se fabrique pas.');
    if (k.rev) {
      if (!S.parametres.fabrication_reverse) refuser('La fabrication des Reverses n\'est pas encore ouverte.');
      cout *= 2;
    }
    if (possede(p, p_carte)) refuser('Tu possèdes déjà cette carte.');
    const pr = profil(p);
    if ((pr.fragments || 0) < cout) refuser('Pas assez de Fragments.');
    pr.fragments -= cout;
    pr.fabrications = (pr.fabrications || 0) + 1;
    colDe(p)[p_carte] = 1;
    syncCollection(p);
    checkPromos(p);
    return me(p);
  };

  /* ------------------------------------------ cadeaux, 18_cadeaux.sql */
  const estAdmin = p => { if (!profil(p).is_admin) refuser('Réservé aux administrateurs.'); };
  RPC.mes_cadeaux = p => (S.cadeaux || []).filter(c => c.user_id === p && !c.ouvert_le).map(c => ({
    id: c.id, eclats: c.eclats, boosters: c.boosters, fragments: c.fragments, carte: c.carte,
    message: c.message, de: c.auteur ? profil(c.auteur).pseudo : null, quand: iso(c.created_at) }));
  RPC.ouvrir_cadeau = (p, { p_id }) => {
    const c = (S.cadeaux || []).find(x => x.id === p_id && x.user_id === p && !x.ouvert_le);
    if (!c) refuser('Ce cadeau a déjà été ouvert.');
    c.ouvert_le = now();
    const pr = profil(p);
    pr.shards += c.eclats; pr.boosters_bonus = (pr.boosters_bonus || 0) + c.boosters;
    pr.fragments = (pr.fragments || 0) + c.fragments;
    pr.tickets_offerts = (pr.tickets_offerts || 0) + c.boosters;
    if (c.carte) { ajouter(p, c.carte, 1); syncCollection(p); checkPromos(p); }
    return me(p);
  };
  RPC.offrir_cadeau = (p, a) => {
    estAdmin(p);
    if (!(a.p_joueurs || []).length) refuser('Choisis au moins un joueur.');
    if (!a.p_eclats && !a.p_boosters && !a.p_fragments && !a.p_carte) refuser('Le cadeau est vide.');
    if (a.p_carte && (carte(a.p_carte) || {}).rar === 'UN') refuser('La carte unique ne s\'offre pas.');
    S.cadeaux = S.cadeaux || [];
    a.p_joueurs.filter(id => S.profils[id]).forEach(id => S.cadeaux.push({
      id: ++S.seq, user_id: id, eclats: a.p_eclats || 0, boosters: a.p_boosters || 0,
      fragments: a.p_fragments || 0, carte: a.p_carte || null, message: (a.p_message || '').slice(0, 300),
      auteur: p, created_at: now(), ouvert_le: null }));
    return a.p_joueurs.filter(id => S.profils[id]).length;
  };
  RPC.admin_joueurs = p => {
    estAdmin(p);
    return Object.values(S.profils).map(o => ({
      id: o.id, pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), inscrit: iso(o.created_at || now()),
      boosters: o.packs_opened || 0, eclats: o.shards,
      cartes: Object.entries(colDe(o.id)).filter(([id, n]) => n > 0 && carte(id) && !carte(id).promo).length,
      cadeaux: (S.cadeaux || []).filter(c => c.user_id === o.id).length,
      en_attente: (S.cadeaux || []).filter(c => c.user_id === o.id && !c.ouvert_le).length }));
  };

  /* ------------------------------------------- version 2.0, 21_reflets.sql */
  RPC.evenement_etat = p => {
    const ev = evenementEnCours();
    if (!ev) return null;
    /* La quête « Passe voir l'événement » (ev_visite, 21_reflets.sql). */
    QUETES.filter(q => q.metric === 'ev_visite').forEach(q => {
      const k = cleQp(p, q);
      if (!S.qp[k]) S.qp[k] = { progress: 1, claimed: false };
    });
    const c = compte(p);
    const prises = S.evt.prises[ev === 'reflets' ? p : p + '|' + ev] || [];
    const top = Object.entries(S.evt.comptes)
      .filter(([k, v]) => k.endsWith('|' + ev) && v.total > 0)
      .map(([k, v]) => ({ id: k.split('|')[0], total: v.total }))
      .sort((a, b) => b.total - a.total).slice(0, 10)
      .map(x => { const o = profil(x.id); return { pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id),
        titre: o.titre || null, photo: null, total: x.total, moi: x.id === p }; });
    return { code: ev, solde: c.solde, total: c.total,
      piste: pisteDe(ev).map(pa => Object.assign({}, pa, { pris: prises.includes(pa.palier) })), top };
  };
  RPC.piste_reclamer = (p, { p_palier }) => {
    if (!evenementEnCours()) refuser('Aucun événement en cours.');
    const pa = pisteDe(evenementEnCours()).find(x => x.palier === p_palier);
    if (!pa) refuser('Palier inconnu.');
    if (compte(p).total < pa.seuil) refuser('Palier pas encore atteint.');
    /* Les paliers pris, par événement (`prises` de Reflets : sans préfixe). */
    const cle = evenementEnCours() === 'reflets' ? p : p + '|' + evenementEnCours();
    const prises = (S.evt.prises[cle] = S.evt.prises[cle] || []);
    if (prises.includes(pa.palier)) refuser('Récompense déjà récupérée.');
    prises.push(pa.palier);
    const cartes = accorder(p, pa.type, pa.montant, pa.objet);
    return { cartes, etat: me(p) };
  };
  /* evenement_recap, 21_reflets.sql */
  RPC.evenement_recap = p => {
    const e = evenementRecent();
    if (!e) return null;
    const c = (S.evt.comptes[p + '|' + e.code] || { total: 0 });
    const tous = Object.entries(S.evt.comptes).filter(([k, v]) => k.endsWith('|' + e.code) && v.total > 0)
      .map(([k, v]) => ({ id: k.split('|')[0], total: v.total })).sort((a, b) => b.total - a.total);
    const col = colDe(p);
    if (e.code === 'choc') Object.assign(e, recapChoc(p));
    const piste = pisteDe(e.code);
    return Object.assign(e, {
      total: c.total, paliers: piste.filter(x => x.seuil <= c.total).length, paliers_max: piste.length,
      pris: (S.evt.prises[e.code === 'reflets' ? p : p + '|' + e.code] || []).length,
      illus: Object.entries(S.illu || {}).filter(([k, v]) => k.startsWith(p + '|') && v.trouve).length,
      reverses: reverses.filter(k => (col[k.id] || 0) > 0).length, reverses_max: reverses.length,
      quetes: QUETES.filter(q => q.evenement === e.code && (S.qp[cleQp(p, q)] || {}).claimed).length,
      rang: c.total > 0 ? tous.filter(x => x.total > c.total).length + 1 : null, joueurs: tous.length,
      top: tous.slice(0, 3).map(x => { const o = profil(x.id); return { pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id),
        titre: o.titre || null, photo: null, total: x.total, moi: x.id === p }; })
    });
  };
  RPC.illu_etat = p => illuEtat(p);
  RPC.illu_essai = (p, { p_carte }) => {
    const k = carte(p_carte);
    if (!k || k.promo || k.rev || k.cat === 'essence') refuser('Cette carte ne fait pas partie du jeu.');
    const j = jourParis(now());
    const d = (S.illu[p + '|' + j] = S.illu[p + '|' + j] || { essais: [], trouve: false });
    if (d.trouve || d.essais.length >= 4) refuser('La partie du jour est finie : rendez-vous demain.');
    if (d.essais.includes(p_carte)) refuser('Tu as déjà proposé cette carte.');
    d.essais.push(p_carte);
    if (p_carte === illuCible(j)) {
      d.trouve = true;
      const g = ILLU_GAINS[d.essais.length - 1];
      profil(p).shards += g.eclats;
      if (evenementEnCours() === 'reflets') crediterPrismes(p, g.prismes);
      bump(p, 'illu', 1);
    }
    return { illu: illuEtat(p), etat: me(p) };
  };
  RPC.personnaliser = (p, { p_titre, p_banniere, p_devise }) => {
    const pr = profil(p);
    if (p_titre != null) {
      if (p_titre !== '' && !titresDe(p).includes(p_titre)) refuser('Ce titre n\'est pas encore débloqué.');
      pr.titre = p_titre || null;
      if (p_titre) bump(p, 'titre', 1);
    }
    if (p_banniere != null) {
      if (p_banniere !== '' && !possede(p, p_banniere)) refuser('Tu ne possèdes pas cette carte.');
      pr.banniere = p_banniere || null;
      if (p_banniere) bump(p, 'perso', 1);
    }
    if (p_devise != null) {
      const d = String(p_devise).trim().replace(/\s+/g, ' ').slice(0, 80);
      pr.devise = d || null;
      if (d) bump(p, 'perso', 1);
    }
    return me(p);
  };
  RPC.utiliser_invitation = () => refuser('Tu as déjà accès au jeu.');

  /* mes_tirages, 15_evenements.sql */
  RPC.mes_tirages = p => {
    const miens = S.tirages.filter(t => t.user_id === p);
    const raretes = {};
    miens.forEach(t => t.cartes.forEach(id => {
      const k = carte(id);
      if (k) raretes[k.rar] = (raretes[k.rar] || 0) + 1;
    }));
    return {
      total: miens.length,
      god: miens.filter(t => t.god).length,
      depuis: miens.length ? iso(miens[0].created_at) : null,
      raretes,
      liste: miens.slice(-30).reverse().map(t => ({ quand: iso(t.created_at), cartes: t.cartes, god: t.god }))
    };
  };

  /* =================================================== Les joueurs simulés
     Quatre joueurs, pour que l'onglet Social vive :
       · Lumen et Mira sont déjà tes amis ;
       · Kairo t'envoie une demande d'ami peu après ton arrivée ;
       · Nova.92 n'attend que toi : cherche son pseudo pour l'ajouter.
     Ils acceptent les demandes d'ami, répondent aux échanges (ils refusent
     quand la carte demandée leur manque, et parfois simplement parce qu'ils
     y tiennent), et leurs amis te proposent des échanges de temps en temps.
     Tout se décide dans vivre(), appelé à chaque action et toutes les
     quelques secondes. */
  const BOTS = [
    { id: 'b_lumen', pseudo: 'Lumen',   frame: 'f_or',     paquets: 70,  jours: 34, serie: 12, ami: true },
    { id: 'b_mira',  pseudo: 'Mira',    frame: 'f_rose',   paquets: 32,  jours: 18, serie: 5,  ami: true },
    { id: 'b_kairo', pseudo: 'Kairo',   frame: 'f_azur',   paquets: 24,  jours: 9,  serie: 3,  ami: false },
    { id: 'b_nova',  pseudo: 'Nova.92', frame: 'f_prisme', paquets: 150, jours: 40, serie: 40, ami: false }
  ];

  /* La chasse est finie, comme sur le vrai site : la carte unique a été
     tirée — ici par Nova.92, qui porte son cadre. */
  function chasseTerminee() {
    if (S.chasse.gagnant) return;
    const g = 'b_nova';
    if (!S.profils[g]) return;
    S.chasse.active = false;
    S.chasse.gagnant = g;
    S.chasse.trouvee_le = now() - 86400000;
    colDe(g)[S.chasse.carte] = 1;
    invDe(g).f_unique = 1;
    S.profils[g].frame = 'f_unique';
  }

  /* La version 2.0 dans un monde de démo, neuf ou ancien : l'événement
     « Reflets » ouvert pour deux semaines, et des joueurs simulés qui ont
     déjà gagné des Prismes et porté un titre. */
  function monde20() {
    S.parametres = S.parametres || { fabrication_reverse: false };
    S.illu = S.illu || {};
    S.invitations = S.invitations || [];
    if (!S.evt) {
      S.evt = { comptes: {}, prises: {} };
      const t = now();
      S.evenement = { titre: 'Reflets', code: 'reflets', debut: t - 3600000, fin: t + 14 * 86400000,
        texte: 'La version 2.0 : les Reverses, des cadres, des titres, Devine l\'illu. Gagne des Prismes et remonte le Pass.' };
      [['b_nova', 430, 't_elu'], ['b_lumen', 260, 't_centurion'], ['b_mira', 120, null], ['b_kairo', 65, null]]
        .forEach(([id, tot, titre]) => {
          if (!S.profils[id]) return;
          S.evt.comptes[id + '|reflets'] = { solde: Math.round(tot / 3), total: tot };
          if (titre) S.profils[id].titre = titre;
        });
      if (S.profils.b_nova) S.profils.b_nova.devise = 'La Chevalière ne se prête pas.';
    }
  }

  /* La version 3.0 : « Le Choc des Sections » prend la suite de Reflets,
     pour trois semaines. Dans la démo, il a commencé quatre jours avant la
     première visite en 3.0. Les joueurs simulés ont rejoint une Section. */
  function monde30() {
    if (S.choc) return;
    chocDe();
    const t = now();
    const debut = t - 4 * 86400000;
    S.evenement = { titre: CHOC.nom, code: 'choc', debut, fin: debut + 21 * 86400000,
      texte: 'La version 3.0 : le Raid contre The French Sorcerer et l\'Épreuve du jour.' };
    [['b_lumen', 'toxique', 24], ['b_mira', 'toxique', 15], ['b_kairo', 'deter', 9], ['b_nova', 'deter', 30]]
      .forEach(([id, sec, d]) => {
        if (!S.profils[id]) return;
        const c = cb(id);
        if (!c.section) { c.section = sec; ajouter(id, SEC_PROMO[sec], 1); }
        S.evt.comptes[id + '|choc'] = { solde: d * 2, total: d * 4 + 30 };
      });
  }
  /* Le Raid permanent (27_raid.sql) : à la première visite, les joueurs
     simulés l'ont déjà frappé — le premier niveau est tombé. */
  function mondeRaid() {
    if (S.raid) return;
    const r = raidDe();
    [['b_lumen', 24], ['b_mira', 15], ['b_kairo', 9], ['b_nova', 30]].forEach(([id, d]) => {
      if (!S.profils[id]) return;
      frapperRaid(id, d * 2);
      r.joueurs[id].victoires = Math.floor(d / 8);
    });
  }

  function creerMonde() {
    const t0 = now();
    S = { v: 1, seq: 0, debut: t0, profils: {}, col: {}, inv: {}, qp: {}, amities: [], trades: [],
      notifs: [], annonces: [], recyclages: [], prochaineOffre: t0 + 75000, kairo: t0 + 25000,
      tirages: [], chasse: { carte: 'u01', active: true, gagnant: null, trouvee_le: null },
      cadeaux: [] };

    S.profils[MOI] = nouveauProfil(MOI, D.pseudo, { shards: D.eclats });

    const couleurs = Object.keys(typeof COLORS === 'object' ? COLORS : {}).filter(k => k !== 'neutre');
    BOTS.forEach((b, i) => {
      S.profils[b.id] = nouveauProfil(b.id, b.pseudo, {
        bot: true, frame: b.frame, streak: b.serie, created_at: t0 - b.jours * 86400000,
        last_checkin: jourParis(t0), trades_done: Math.floor(b.paquets / 9)
      });
      for (let n = 0; n < b.paquets; n++) {
        tirerPaquet().ids.forEach(id => ajouter(b.id, id, 1));
        profil(b.id).packs_opened += 1;
      }
      checkPromos(b.id);
      /* Un avatar tiré de sa propre collection, ou un symbole d'essence. */
      const siennes = Object.keys(colDe(b.id)).map(carte).filter(c => c && !c.promo && c.cat !== 'essence');
      const belles = siennes.filter(c => ['R', 'E', 'L'].includes(c.rar));
      profil(b.id).avatar = i % 2 === 0 && belles.length
        ? 'card:' + choix(belles).id
        : 'ess:' + (couleurs[i % Math.max(1, couleurs.length)] || 'rose');
      profil(b.id).vitrine = siennes.slice()
        .sort((x, y) => RAR[y.rar].rank - RAR[x.rar].rank).slice(0, 4).map(c => c.id);
      if (b.ami) S.amities.push({ a: b.id, b: MOI, demandeur: b.id, accepte: true,
        created_at: t0 - 86400000, resolved_at: t0 - 86400000 });
    });

    S.annonces.push({ id: ++S.seq, actif: true, created_at: t0,
      titre: 'Bienvenue dans la démo',
      texte: 'Tout se passe sur cet appareil : ta collection, tes Éclats et tes quêtes y sont '
        + 'enregistrés. Les autres joueurs sont simulés — Lumen et Mira sont déjà tes amis, '
        + 'Kairo ne va pas tarder à se manifester, et Nova.92 attend que tu l\'ajoutes. Ils '
        + 'répondent tout seuls à tes demandes d\'ami et d\'échange.' });
  }

  /* Une offre d'un ami simulé : il veut une carte que tu as en double, et
     propose en échange une carte de même rareté qu'il a en double et que tu
     n'as pas — de quoi faire avancer ta collection sans la faire reculer.
     Il préfère une carte qui lui manque ; à défaut, une qu'il n'a qu'en un
     exemplaire. Sans candidat, il repasse plus tard. */
  function proposerEchange(bot) {
    const moi = colDe(MOI), lui = colDe(bot.id);
    const ok = (id, r) => carte(id) && carte(id).rar === r && !carte(id).promo && carte(id).cat !== 'essence';
    for (const r of ['R', 'PC', 'C', 'E']) {
      const doublons = Object.keys(moi).filter(id => moi[id] > gardeDe(MOI, id) && ok(id, r));
      const manque = doublons.filter(id => !(lui[id] > 0));
      const veut = manque.length ? manque : doublons.filter(id => !(lui[id] > 1));
      const donne = Object.keys(lui).filter(id => lui[id] >= 2 && ok(id, r) && !(moi[id] > 0));
      if (veut.length && donne.length) {
        profil(bot.id).trade_free_at = 0;                /* un joueur simulé n'attend pas */
        creerEchange(bot.id, profil(MOI).pseudo, choix(donne), choix(veut),
          choix(['Elle me manque pour finir la série !', 'Ça te dit ?', '', 'Je cherche celle-là depuis des jours.']));
        return true;
      }
    }
    return false;
  }

  function vivre() {
    const t = now();
    let change = false;

    /* Les joueurs simulés passent tous les jours : leur série continue. */
    const auj = jourParis(t);
    BOTS.forEach(b => {
      const pr = profil(b.id);
      if (pr.last_checkin === auj) return;
      pr.streak = pr.last_checkin === hier(auj) ? pr.streak + 1 : 1;
      pr.last_checkin = auj;
    });

    /* Les demandes d'ami adressées à un joueur simulé. */
    S.amities.forEach(f => {
      if (f.accepte || !f.repondre_a || f.repondre_a > t) return;
      const bot = profil(f.a === f.demandeur ? f.b : f.a);
      if (!bot.bot) return;
      f.accepte = true; f.resolved_at = t; delete f.repondre_a;
      notifier(f.demandeur, 'ami_accepte', bot.id);
      change = true;
    });

    /* Les échanges proposés à un joueur simulé. Il accepte trois fois sur
       quatre s'il a la carte ; sinon il refuse, comme le ferait n'importe qui.
       Le tout premier échange proposé, lui, passe toujours quand c'est
       possible : c'est celui qui montre ce que fait l'onglet. */
    S.trades.forEach(tr => {
      if (tr.status !== 'pending' || !tr.repondre_a || tr.repondre_a > t) return;
      delete tr.repondre_a;
      const faisable = possede(tr.to_user, tr.want_card) && possede(tr.from_user, tr.offer_card);
      const ok = faisable && (!S.premierConclu || Math.random() < 0.75);
      try { repondreEchange(tr.to_user, tr.id, ok); } catch (e) { repondreEchange(tr.to_user, tr.id, false); }
      if (ok) S.premierConclu = true;
      change = true;
    });

    /* Version 3.0 : les défis. */
    if (vivreCombats(t)) change = true;

    /* Kairo demande à devenir ton ami, une fois. */
    if (S.kairo && t >= S.kairo) {
      S.kairo = 0;
      try { demanderAmi('b_kairo', profil(MOI).pseudo); change = true; } catch (e) { /* déjà amis */ }
    }

    /* De temps en temps, un ami simulé te propose un échange — jamais plus de
       deux en attente à la fois. */
    if (t >= S.prochaineOffre) {
      const attente = S.trades.filter(x => x.to_user === MOI && x.status === 'pending').length;
      const amis = BOTS.filter(b => (paire(MOI, b.id) || {}).accepte);
      let fait = false;
      /* Dans le désordre : celui qui a de quoi proposer se manifeste. */
      if (attente < 2) fait = amis.sort(() => Math.random() - .5).some(proposerEchange);
      S.prochaineOffre = t + (fait ? alea(6, 12) * 60000 : 60000);
      change = change || fait;
    }
    return change;
  }

  /* ================================== version 3.0, 23_combats.sql */
  /* Les combats : la Section, les decks, les cosmétiques, les récompenses
     d'un combat contre l'IA, les défis entre amis.
     Les tables de récompenses viennent de la page (js/combat/campagne.js),
     comme la table SQL en est la copie. */
  const SEC_PROMO = { toxique: 'p03', deter: 'p04' };
  const CB_MIN_MS = 20000;
  /* L'XP de combattant d'un joueur (xp_de, 01_schema.sql), pour le niveau
     posé sur son avatar. Les joueurs simulés en ont selon leur ancienneté. */
  const xpDe = id => {
    const c = S.cb && S.cb[id];
    if (c && c.xp) return c.xp;
    const o = S.profils && S.profils[id];
    return o && o.bot ? Math.round((now() - (o.created_at || now())) / 86400000) * 140 : 0;
  };
  const cb = p => {
    S.cb = S.cb || {};
    return (S.cb[p] = S.cb[p] || { section: null, decks: [], deck_actif: null, cosm: {}, faits: [], finie: false,
      jour: null, recompensees: 0, stats: { victoires: 0, defaites: 0, pvp_v: 0, pvp_d: 0 }, ouverts: {}, defis_jour: null, defis_rec: 0 });
  };
  function combatEtat(p) {
    const c = cb(p);
    const auj = jourParis(now());
    return {
      section: c.section, decks: c.decks.map(d => Object.assign({}, d)), deck_actif: c.deck_actif,
      cosm: Object.assign({}, c.cosm),
      campagne: { faits: c.faits.slice(), finie: !!c.finie },
      jour: { recompensees: c.jour === auj ? c.recompensees : 0, plafond: PVE_PLAFOND,
        defis: c.defis_jour === auj ? c.defis_rec : 0, defis_plafond: DEFI_GAIN.plafond },
      stats: Object.assign({}, c.stats),
      xp: c.xp || 0,
      defis: (S.defis || []).filter(d => (d.de === p || d.pour === p) && ['attente', 'en_cours'].includes(d.statut)).map(d => {
        const o = profil(d.de === p ? d.pour : d.de);
        return { id: d.id, pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), photo: null,
          pour_moi: d.pour === p, statut: d.statut, vu: d.de === p ? !!d.vu_de : !!d.vu_pour };
      })
    };
  }

  RPC.combat_section = (p, { p_section }) => {
    if (!SEC_PROMO[p_section]) refuser('Section inconnue.');
    const c = cb(p);
    if (c.section) refuser('Tu as déjà rejoint une Section.');
    c.section = p_section;
    ajouter(p, SEC_PROMO[p_section], 1);
    return me(p);
  };

  /* Les réglages : on ne choisit que ce qu'on possède. */
  RPC.combat_reglages = (p, { p_reglages }) => {
    const c = cb(p);
    const r = p_reglages || {};
    if (r.deck_actif !== undefined) c.deck_actif = r.deck_actif;
    for (const k of ['tapis', 'sleeve']) {
      if (!r[k]) continue;
      const base = { tapis: 't_base', sleeve: 's_base' }[k];
      if (r[k] !== base && !((invDe(p)[r[k]] || 0) > 0)) refuser('Tu ne possèdes pas cet objet.');
      if (c.cosm[k] !== r[k]) bump(p, 'cosm', 1);
      c.cosm[k] = r[k];
    }
    return me(p);
  };

  /* deck_sauver : au plus 20 decks ; les cartes, possédées ; les limites
     d'exemplaires, respectées. Un deck incomplet s'enregistre (on le finira
     plus tard), il ne se joue simplement pas. */
  RPC.deck_sauver = (p, { p_deck }) => {
    const c = cb(p);
    const d = p_deck || {};
    if (!d.cartes || typeof d.cartes !== 'object') refuser('Deck invalide.');
    const nom = String(d.nom || '').trim().slice(0, 32) || 'Mon deck';
    const err = Decks.verifier({ cartes: d.cartes, reserve: d.reserve || {} }, colDe(p))
      .filter(e => !/manque|de trop|Réserve doit|au moins un Joueur/.test(e));
    if (err.length) refuser(err[0]);
    if (!d.id && c.decks.length >= 20) refuser('20 decks au plus.');
    const id = d.id && c.decks.some(x => x.id === d.id) ? d.id : 'd' + (++S.seq);
    const propre = { id, nom, cartes: Object.assign({}, d.cartes), reserve: Object.assign({}, d.reserve || {}), couverture: d.couverture || null };
    c.decks = c.decks.filter(x => x.id !== id).concat([propre]);
    if (!c.deck_actif) c.deck_actif = id;
    if (Decks.total(propre.cartes) === Combat.REGLE.CLUB) bump(p, 'deck', 1);
    return me(p);
  };
  RPC.deck_supprimer = (p, { p_id }) => {
    const c = cb(p);
    c.decks = c.decks.filter(x => x.id !== p_id);
    if (c.deck_actif === p_id) c.deck_actif = null;
    return me(p);
  };

  /* combat_debut : le serveur ouvre un combat et tire la graine. */
  RPC.combat_debut = (p, { p_mode, p_cle, p_niveau }) => {
    const c = cb(p);
    if (!c.section) refuser('Rejoins d\'abord une Section.');
    if (!['campagne', 'infini', 'raid', 'epreuve'].includes(p_mode)) refuser('Mode inconnu.');
    /* Version 3.0 : le Raid et l'Épreuve du jour (25_choc.sql). */
    let niveau = p_niveau, phase = null, graine = Math.floor(Math.random() * 4294967295) + 1;
    const auj = jourParis(now());
    if (p_mode === 'raid') {
      /* Le Raid (27_raid.sql) : toute l'année, trois tentatives par jour. */
      const r = raidDe();
      const k = p + '|' + auj;
      if (String(r.niveau) !== String(p_cle)) refuser('Le boss a changé de niveau : recharge le Raid.');
      if ((r.tentatives[k] || 0) >= RAID.tentatives) refuser('Plus de tentative aujourd\'hui : reviens demain.');
      r.tentatives[k] = (r.tentatives[k] || 0) + 1;
      phase = r.niveau;
      niveau = raidCombat(phase).ia;
    } else if (p_mode === 'epreuve') {
      if (evenementEnCours() !== 'choc') refuser('L\'événement est terminé.');
      const ch = chocDe();
      if (p_cle !== auj) refuser('L\'Épreuve a changé : recharge la page.');
      const l = (ch.epreuves[p + '|' + auj] = ch.epreuves[p + '|' + auj] || []);
      if (l.length >= CHOC.epreuve.essais) refuser('Épreuve terminée : une nouvelle demain.');
      l.push({ gagne: false, tours: 0, pv: 0, touches: 0, abandon: true });
      niveau = CHOC.epreuve.ia;
      graine = graineEpreuve(auj);
    } else if (p_mode === 'campagne') {
      const l = combatsCampagne(c.section);
      const f = l.find(x => x.id === p_cle);
      if (!f) refuser('Combat inconnu.');
      if (f.n > 0 && !c.faits.includes(l[f.n - 1].id) && !c.faits.includes(f.id)) refuser('Gagne d\'abord le combat précédent.');
    } else if (!(p_niveau >= 1 && p_niveau <= 5)) refuser('Difficulté inconnue.');
    const id = 'cb' + (++S.seq);
    c.ouverts = c.ouverts || {};
    /* Un seul combat ouvert à la fois : le précédent compte comme perdu. */
    Object.keys(c.ouverts).forEach(k => { delete c.ouverts[k]; c.stats.defaites++; });
    if (p_mode === 'campagne') niveau = combatsCampagne(c.section).find(x => x.id === p_cle).niveau;
    c.ouverts[id] = { mode: p_mode, cle: p_cle, niveau, phase, jour: auj, debut: now(), graine };
    return { id, graine };
  };

  /* combat_fin : le résultat, et ce qu'il rapporte. */
  /* gagner_xp, 26_niveaux.sql : chaque niveau franchi paie ; les quêtes
     « xp » avancent, les quêtes « niveau » suivent le niveau atteint. */
  function gagnerXp(p, d) {
    if (!(d > 0)) return null;
    const c = cb(p);
    const avant = niveauDe(c.xp || 0).niveau;
    c.xp = (c.xp || 0) + d;
    const apres = niveauDe(c.xp).niveau;
    const paliers = [];
    for (let k = avant + 1; k <= apres; k++) {
      const r = recompenseNiveau(k);
      accorder(p, 'eclats', r.eclats);
      if (r.boosters) accorder(p, 'boosters', r.boosters);
      if (r.fragments) accorder(p, 'fragments', r.fragments);
      if (r.cadre) accorder(p, 'cadre', 1, r.cadre);
      if (r.titre) accorder(p, 'titre', 1, r.titre);
      paliers.push({ niveau: k, eclats: r.eclats, boosters: r.boosters || 0, fragments: r.fragments || 0, cadre: r.cadre || null, titre: r.titre || null });
    }
    bump(p, 'xp', d);
    QUETES.filter(q => q.metric === 'niveau').forEach(q => {
      const k = cleQp(p, q);
      const qp = (S.qp[k] = S.qp[k] || { progress: 0, claimed: false });
      if (!qp.claimed) qp.progress = Math.max(qp.progress, apres);
    });
    return { gagne: d, total: c.xp, avant, niveau: apres, paliers };
  }

  RPC.combat_fin = (p, { p_id, p_gagne, p_resume }) => {
    const c = cb(p);
    const o = (c.ouverts || {})[p_id];
    if (!o) refuser('Ce combat n\'est plus ouvert.');
    delete c.ouverts[p_id];
    const auj = jourParis(now());
    if (c.jour !== auj) { c.jour = auj; c.recompensees = 0; }
    const r = { eclats: 0, boosters: 0, fragments: 0, carte: null, titre: null, message: '' };
    const res = p_resume || {};
    const trop = now() - o.debut < CB_MIN_MS;
    bump(p, 'combats', 1);
    if (!trop) r.xp = gagnerXp(p, xpCombat(o.mode, o.niveau, !!p_gagne, +res.vaincus || 0, +res.tours || 0));
    if (o.mode === 'raid') return finRaid(p, c, o, !!p_gagne, res, trop, r);
    if (o.mode === 'epreuve') return finChoc(p, c, o, !!p_gagne, res, trop, r);
    if (!p_gagne) {
      c.stats.defaites++;
      r.message = 'Pas d\'Éclats pour une défaite, mais l\'XP compte.';
      return { etat: me(p), recompense: r };
    }
    c.stats.victoires++;
    bump(p, 'victoires', 1);
    bump(p, 'vaincus', Math.min(20, Math.max(0, +res.vaincus || 0)));
    if (o.niveau >= 4) bump(p, 'victoires_dures', 1);
    if (o.niveau >= 5 && o.mode === 'infini') bump(p, 'legende', 1);
    if (trop) { r.message = 'Combat trop court pour être récompensé.'; return { etat: me(p), recompense: r }; }
    const pr = profil(p);
    const plafond = () => c.recompensees < PVE_PLAFOND;
    if (o.mode === 'campagne') {
      const l = combatsCampagne(c.section);
      const f = l.find(x => x.id === o.cle);
      if (!c.faits.includes(f.id)) {
        c.faits.push(f.id);
        bump(p, 'campagne', 1);
        r.eclats = f.recompense.eclats || 0;
        r.boosters = f.recompense.boosters || 0;
        r.fragments = f.recompense.fragments || 0;
        if (c.faits.length >= l.length && !c.finie) {
          c.finie = true;
          const autre = c.section === 'toxique' ? 'deter' : 'toxique';
          ajouter(p, SEC_PROMO[autre], 1);
          r.carte = SEC_PROMO[autre];
          r.message = 'Campagne terminée : la Promo de l\'autre Section est à toi.';
        }
      } else {
        if (plafond()) { c.recompensees++; r.eclats = RECOMPENSE_REJOUER.eclats; }
        else r.message = 'Victoires récompensées du jour atteintes : celle-ci est pour le plaisir.';
      }
    } else {
      const d = DIFFICULTES[o.niveau - 1];
      if (plafond()) { c.recompensees++; r.eclats = d.eclats; }
      else r.message = 'Victoires récompensées du jour atteintes : celle-ci est pour le plaisir.';
    }
    pr.shards += r.eclats;
    pr.boosters_bonus = (pr.boosters_bonus || 0) + r.boosters;
    pr.fragments = (pr.fragments || 0) + r.fragments;
    syncCollection(p);
    checkPromos(p);
    return { etat: me(p), recompense: r };
  };

  /* ---------- les défis entre amis ---------- */
  const defisDe = () => (S.defis = S.defis || []);
  const vueDefi = (d, p, depuis) => {
    const moi = d.de === p ? 0 : 1;
    const o = profil(moi === 0 ? d.pour : d.de);
    return {
      id: d.id, statut: d.statut, moi,
      init: d.statut === 'attente' ? null : { decks: [d.deck_de, d.deck_pour], noms: [profil(d.de).pseudo, profil(d.pour).pseudo], graine: d.graine },
      actions: (d.actions || []).slice(depuis || 0),
      adversaire: { nom: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id), photo: null, cosm: (cb(o.id).cosm || {}) }
    };
  };
  function deckBot() {
    const r = () => Math.random();
    return Decks.versMoteur(Decks.aleatoire(r, { niveau: 3 }));
  }
  RPC.defi_lancer = (p, { p_pseudo, p_deck }) => {
    const o = parPseudo(p_pseudo);
    if (!o) refuser('Joueur introuvable.');
    if (!(paire(p, o.id) || {}).accepte) refuser('Tu ne peux défier que tes amis.');
    if (!p_deck || !Array.isArray(p_deck.club) || p_deck.club.length !== Combat.REGLE.CLUB) refuser('Deck invalide.');
    if (defisDe().some(d => ['attente', 'en_cours'].includes(d.statut) && ((d.de === p && d.pour === o.id) || (d.de === o.id && d.pour === p))))
      refuser('Un défi est déjà en cours avec ce joueur.');
    const d = { id: 'df' + (++S.seq), de: p, pour: o.id, statut: 'attente', deck_de: p_deck, deck_pour: null,
      graine: Math.floor(Math.random() * 4294967295) + 1, actions: [], cree: now(), maj: now() };
    defisDe().push(d);
    notifier(o.id, 'defi', p, d.id);
    /* Un ami simulé accepte au bout de quelques secondes. */
    if (o.bot) d.accepter_a = now() + alea(3, 6) * 1000;
    return me(p);
  };
  RPC.defi_repondre = (p, { p_id, p_ok, p_deck }) => {
    const d = defisDe().find(x => x.id === p_id && (x.pour === p || x.de === p));
    if (!d || d.statut !== 'attente') refuser('Ce défi n\'est plus en attente.');
    if (!p_ok) { d.statut = 'refuse'; d.maj = now(); return { etat: me(p) }; }
    if (d.pour !== p) refuser('C\'est à ton ami de répondre.');
    if (!p_deck || !Array.isArray(p_deck.club) || p_deck.club.length !== Combat.REGLE.CLUB) refuser('Deck invalide.');
    d.deck_pour = p_deck;
    d.statut = 'en_cours';
    d.vu_pour = true;
    d.maj = now();
    notifier(d.de, 'defi_accepte', p, d.id);
    return { etat: me(p), defi: vueDefi(d, p, 0) };
  };
  /* L'adversaire simulé joue ses coups dès qu'on lui demande l'état. */
  function faireJouerBot(d) {
    const bot = profil(d.de).bot ? 0 : profil(d.pour).bot ? 1 : -1;
    if (bot < 0 || d.statut !== 'en_cours') return;
    const E = Combat.rejouer({ decks: [d.deck_de, d.deck_pour], noms: [profil(d.de).pseudo, profil(d.pour).pseudo], graine: d.graine }, d.actions);
    let n = 0;
    while (Combat.demande(E) && Combat.demande(E).qui === bot && n++ < 80) {
      const a = IA.choisir(E, { niveau: 3 });
      Combat.agir(E, a);
      d.actions.push(a);
    }
    if (E.fin) d.fini = true;
  }
  RPC.defi_etat = (p, { p_id, p_depuis }) => {
    const d = defisDe().find(x => x.id === p_id && (x.pour === p || x.de === p));
    if (!d) refuser('Défi introuvable.');
    if (d.de === p) d.vu_de = true; else d.vu_pour = true;
    faireJouerBot(d);
    return vueDefi(d, p, p_depuis || 0);
  };
  RPC.defi_jouer = (p, { p_id, p_n, p_action }) => {
    const d = defisDe().find(x => x.id === p_id && (x.pour === p || x.de === p));
    if (!d || d.statut !== 'en_cours') refuser('Ce défi n\'est plus en cours.');
    if (p_n !== d.actions.length) refuser('Actions désynchronisées.');
    d.actions.push(p_action);
    d.maj = now();
    return { n: d.actions.length };
  };
  /* Le vrai serveur croit chaque joueur sur parole (p_gagnant) ; la démo,
     qui a le moteur, rejoue la partie. */
  RPC.defi_fin = (p, { p_id }) => {
    const d = defisDe().find(x => x.id === p_id && (x.pour === p || x.de === p));
    if (!d) refuser('Défi introuvable.');
    const E = Combat.rejouer({ decks: [d.deck_de, d.deck_pour], noms: ['', ''], graine: d.graine }, d.actions);
    if (!E.fin) refuser('Le défi n\'est pas fini.');
    if (d.statut === 'en_cours') d.statut = 'fini';
    const moi = d.de === p ? 0 : 1;
    const c = cb(p);
    const r = { eclats: 0, message: '' };
    d.payes = d.payes || {};
    if (!d.payes[p]) {
      d.payes[p] = true;
      const auj = jourParis(now());
      if (c.defis_jour !== auj) { c.defis_jour = auj; c.defis_rec = 0; }
      const gagne = E.fin.gagnant === moi;
      c.stats[gagne ? 'pvp_v' : 'pvp_d']++;
      bump(p, 'defis', 1);
      bump(p, 'combats', 1);
      if (gagne) bump(p, 'victoires', 1);
      r.xp = gagnerXp(p, xpCombat('defi', 0, gagne, 0, E.tour));
      if (c.defis_rec < DEFI_GAIN.plafond) { c.defis_rec++; r.eclats = gagne ? DEFI_GAIN.victoire : DEFI_GAIN.defaite; profil(p).shards += r.eclats; }
      else r.message = 'Défis récompensés du jour atteints.';
    }
    return { etat: me(p), recompense: r };
  };

  /* ================================== version 3.0, 25_choc.sql */
  /* Le Choc des Sections : l'Épreuve du jour (la même graine pour tous), et
     ce que le Raid y ajoute (des Insignes, le récap). Les chiffres viennent
     de la page (js/combat/choc-data.js). */
  const chocDe = () => {
    const c = (S.choc = S.choc || {});
    c.epreuves = c.epreuves || {};
    c.gagnees = c.gagnees || {};
    /* Ce que chacun a fait au boss du Raid pendant l'événement (le récap). */
    c.joueurs = c.joueurs || {};
    return c;
  };
  /* La graine de l'Épreuve : la même pour tout le monde, un jour donné. */
  const graineEpreuve = j => (hacher('choc-epreuve:' + j) % 4294967295) + 1;

  /* ================================== version 3.0, 27_raid.sql */
  /* Le Raid : un boss commun à tout le serveur, toute l'année. Une barre de
     vie par niveau ; quand elle est vide, le niveau tombe — chacun de ceux
     qui l'ont frappé a un coffre — et le boss revient, plus fort. */
  const raidDe = () => (S.raid = S.raid || { niveau: 1, degats: 0, total: 0, tombes: {}, joueurs: {}, frappes: {}, coffres: {}, tentatives: {} });
  /* La barre d'un niveau, à l'échelle du serveur (peu de joueurs dans la
     démo : _demo/reglages.js). */
  const pvRaid = n => Math.max(20, Math.round(RAID.pv(n) * (D.raid_echelle || 1)));

  /* Des dégâts sur la barre commune ; le surplus entame le niveau suivant.
     Renvoie le dernier niveau tombé. */
  function frapperRaid(p, d) {
    const r = raidDe();
    if (!(d > 0)) return null;
    const j = (r.joueurs[p] = r.joueurs[p] || { degats: 0, victoires: 0 });
    j.degats += d;
    r.total += d;
    let reste = d, tombe = null;
    while (reste > 0) {
      const pv = pvRaid(r.niveau);
      const part = Math.min(reste, pv - r.degats);
      const k = p + '|' + r.niveau;
      r.frappes[k] = (r.frappes[k] || 0) + part;
      r.degats += part;
      reste -= part;
      if (r.degats < pv) break;
      r.tombes[r.niveau] = now();
      tombe = r.niveau;
      r.niveau++;
      r.degats = 0;
    }
    return tombe;
  }

  /* raid_fin : pendant le Choc, des Insignes ; le reste du temps, des Éclats. */
  function finRaid(p, c, o, gagne, res, trop, r) {
    if (gagne) { c.stats.victoires++; bump(p, 'victoires', 1); bump(p, 'vaincus', Math.min(20, Math.max(0, +res.vaincus || 0))); }
    else c.stats.defaites++;
    if (o.niveau >= 4 && gagne) bump(p, 'victoires_dures', 1);
    bump(p, 'raid', 1);
    if (trop) { r.message = 'Combat trop court pour compter.'; return { etat: me(p), recompense: r }; }
    const pvBoss = raidCombat(o.phase).pvBoss;
    let d = Math.max(0, Math.min(pvBoss + 1, Math.floor(+res.touches || 0)));
    if (gagne) d = pvBoss + 1 + RAID.bonusDegats;
    r.degats = d;
    const tombe = frapperRaid(p, d);
    bump(p, 'raid_degats', d);
    if (gagne) { raidDe().joueurs[p].victoires++; bump(p, 'raid_victoires', 1); }
    if (tombe) r.message = 'Le boss est tombé ! Ton coffre t\'attend dans le Raid.';
    else if (!d) r.message = 'Pas un PV de pris : il rira moins la prochaine fois.';
    if (evenementEnCours() === 'choc') {
      r.insignes = d * RAID.parDegat + (gagne ? RAID.victoire : 0);
      const cj = (chocDe().joueurs[p] = chocDe().joueurs[p] || { degats: 0, victoires: 0 });
      cj.degats += d;
      if (gagne) cj.victoires++;
      crediterPrismes(p, r.insignes);
    } else {
      r.eclats = d * RAID.parDegatEclats + (gagne ? RAID.victoireEclats : 0);
      profil(p).shards += r.eclats;
    }
    return { etat: me(p), recompense: r };
  }

  RPC.raid_etat = p => {
    const r = raidDe();
    const auj = jourParis(now());
    const moi = r.joueurs[p] || { degats: 0, victoires: 0 };
    return {
      jour: auj, niveau: r.niveau, degats: r.degats, pv: pvRaid(r.niveau), total: r.total,
      joueurs: Object.keys(r.frappes).filter(k => k.endsWith('|' + r.niveau) && r.frappes[k] > 0).length,
      evenement: evenementEnCours() === 'choc',
      moi: { degats: moi.degats, victoires: moi.victoires, niveau: r.frappes[p + '|' + r.niveau] || 0,
        tentatives: r.tentatives[p + '|' + auj] || 0, max: RAID.tentatives },
      coffres: Object.keys(r.tombes).map(Number).sort((a, b) => a - b)
        .filter(n => (r.frappes[p + '|' + n] || 0) > 0 && !r.coffres[p + '|' + n])
        .map(n => Object.assign({ niveau: n }, raidCoffre(n))),
      top: Object.entries(r.joueurs).filter(([, x]) => x.degats > 0).sort((a, b) => b[1].degats - a[1].degats).slice(0, 10)
        .map(([id, x]) => joueurVue(id, { degats: x.degats, moi: id === p }))
    };
  };

  RPC.raid_reclamer = (p, { p_niveau }) => {
    const r = raidDe();
    const n = +p_niveau;
    if (!r.tombes[n]) refuser('Ce niveau n\'est pas encore tombé.');
    if (!((r.frappes[p + '|' + n] || 0) > 0)) refuser('Tu n\'as pas frappé le boss à ce niveau.');
    if (r.coffres[p + '|' + n]) refuser('Coffre déjà ouvert.');
    r.coffres[p + '|' + n] = now();
    const x = raidCoffre(n);
    const cartes = accorder(p, x.type, x.montant || 0, null);
    return { cartes, etat: me(p) };
  };

  function finChoc(p, c, o, gagne, res, trop, r) {
    const ch = chocDe();
    if (gagne) { c.stats.victoires++; bump(p, 'victoires', 1); bump(p, 'vaincus', Math.min(20, Math.max(0, +res.vaincus || 0))); }
    else c.stats.defaites++;
    if (o.niveau >= 4 && gagne) bump(p, 'victoires_dures', 1);
    r.insignes = 0;
    bump(p, 'epreuve', 1);
    const l = ch.epreuves[p + '|' + o.jour] || [];
    const i = l.findIndex(x => x.abandon);
    const score = { gagne, tours: +res.tours || 0, pv: +res.pv || 0, touches: +res.touches || 0 };
    if (i >= 0) l[i] = score;
    if (trop) { r.message = 'Combat trop court pour compter.'; return { etat: me(p), recompense: r }; }
    r.insignes = CHOC.epreuve.participation;
    const k = p + '|' + o.jour;
    if (gagne && !ch.gagnees[k]) {
      ch.gagnees[k] = true;
      r.insignes += CHOC.epreuve.victoire;
      bump(p, 'epreuve_victoires', 1);
      r.message = 'Épreuve du jour gagnée !';
    } else if (gagne) r.message = 'Déjà gagnée aujourd\'hui : ton meilleur score est gardé.';
    crediterPrismes(p, r.insignes);
    return { etat: me(p), recompense: r };
  }

  const joueurVue = (id, x) => { const o = profil(id); return Object.assign({ pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, xp: xpDe(o.id),
    titre: o.titre || null, photo: null, moi: false, section: cb(id).section }, x); };

  RPC.choc_etat = p => {
    if (evenementEnCours() !== 'choc') return null;
    const ch = chocDe();
    const auj = jourParis(now());
    QUETES.filter(q => q.metric === 'ev_visite' && q.evenement === 'choc').forEach(q => {
      const k = cleQp(p, q);
      if (!S.qp[k]) S.qp[k] = { progress: 1, claimed: false };
    });
    const essais = (ch.epreuves[p + '|' + auj] || []).map(x => Object.assign({}, x));
    const meilleur = essais.slice().sort((a, b) => scoreEpreuve(b) - scoreEpreuve(a))[0] || null;
    const topEp = Object.entries(ch.epreuves).filter(([k]) => k.endsWith('|' + auj))
      .map(([k, l]) => ({ id: k.split('|')[0], s: l.slice().sort((a, b) => scoreEpreuve(b) - scoreEpreuve(a))[0] }))
      .filter(x => x.s && !x.s.abandon).sort((a, b) => scoreEpreuve(b.s) - scoreEpreuve(a.s)).slice(0, 10)
      .map(x => joueurVue(x.id, Object.assign({}, x.s, { moi: x.id === p })));
    return {
      jour: auj,
      epreuve: { graine: graineEpreuve(auj), essais, max: CHOC.epreuve.essais, meilleur, gagnee: !!ch.gagnees[p + '|' + auj], top: topEp }
    };
  };

  /* Ce que le récap du Choc ajoute à celui d'un événement : le Raid et
     l'Épreuve. */
  function recapChoc(p) {
    const ch = chocDe();
    const e = S.evenement || {};
    return {
      degats: ((ch.joueurs[p] || {}).degats) || 0,
      raid_niveaux: Object.values(raidDe().tombes).filter(t => t >= (e.debut || 0) && t < (e.fin || Infinity)).length,
      epreuves: Object.keys(ch.gagnees).filter(k => k.startsWith(p + '|')).length,
      section: cb(p).section
    };
  }

  /* La vie des combats : les amis simulés acceptent tes défis, t'en lancent
     parfois. */
  function vivreCombats(t) {
    let change = false;
    defisDe().forEach(d => {
      if (d.statut === 'attente' && d.accepter_a && d.accepter_a <= t) {
        delete d.accepter_a;
        d.deck_pour = deckBot();
        d.statut = 'en_cours';
        notifier(d.de, 'defi_accepte', d.pour, d.id);
        change = true;
      }
    });
    /* Les joueurs simulés frappent le boss du Raid, toute l'année ; pendant
       le Choc, ils tentent aussi l'Épreuve et gagnent des Insignes. */
    S.raidTic = S.raidTic || t;
    if (t - S.raidTic > 30000) {
      S.raidTic = t;
      const bot = choix(BOTS);
      if (S.profils[bot.id]) {
        const gagne = Math.random() < 0.35;
        const pvBoss = raidCombat(raidDe().niveau).pvBoss;
        const d = gagne ? pvBoss + 1 + RAID.bonusDegats : entre(2, pvBoss);
        frapperRaid(bot.id, d);
        if (gagne) raidDe().joueurs[bot.id].victoires++;
        if (evenementEnCours() === 'choc') {
          const ch = chocDe();
          const k = bot.id + '|choc';
          const cpt = (S.evt.comptes[k] = S.evt.comptes[k] || { solde: 0, total: 0 });
          const n = d * RAID.parDegat + (gagne ? RAID.victoire : 0) + entre(5, 25);
          cpt.solde += n; cpt.total += n;
          const auj = jourParis(t);
          const ek = bot.id + '|' + auj;
          if (!(ch.epreuves[ek] || []).length && Math.random() < 0.5) {
            const g2 = Math.random() < 0.6;
            ch.epreuves[ek] = [{ gagne: g2, tours: entre(6, 16), pv: g2 ? entre(1, 5) : 0, touches: g2 ? 6 : entre(1, 4) }];
          }
        }
        change = true;
      }
    }
    /* Un ami simulé te défie, une fois, après quelques minutes. */
    const c = cb(MOI);
    if (c.section && !S.defiOffert && t - (S.debut || t) > 4 * 60000) {
      const ami = BOTS.find(b => (paire(MOI, b.id) || {}).accepte);
      if (ami && !defisDe().some(d => d.statut === 'attente' || d.statut === 'en_cours')) {
        S.defiOffert = true;
        const d = { id: 'df' + (++S.seq), de: ami.id, pour: MOI, statut: 'attente', deck_de: deckBot(), deck_pour: null,
          graine: Math.floor(Math.random() * 4294967295) + 1, actions: [], cree: t, maj: t };
        defisDe().push(d);
        notifier(MOI, 'defi', ami.id, d.id);
        change = true;
      }
    }
    return change;
  }

  /* ======================================================= le faux client */
  let pret = null;
  let repartiUneFois = false;
  const ecouteurs = [];

  function charger() {
    if (!pret) {
      pret = (async () => {
        if (/[?&]reinitialiser\b/.test(location.search)) {
          await kvSet(CLE, null);
          try { history.replaceState(null, '', location.pathname); } catch (e) { /* sans gravité */ }
        }
        S = await kvGet(CLE);
        if (!S || S.v !== 1) { creerMonde(); await sauver(); }
        completer();
      })();
    }
    return pret;
  }

  /* Ce qui manque à une démo commencée dans une version précédente. */
  function completer() {
    /* Avant la version 1.5. */
    S.tirages = S.tirages || [];
    /* Version 2.1 : les exemplaires à garder. */
    S.gardes = S.gardes || {};
    S.favoris = S.favoris || {};
    S.chasse = S.chasse || { carte: 'u01', active: true, gagnant: null, trouvee_le: null };
    chasseTerminee();
    monde20();
    monde30();
    mondeRaid();
  }

  /* Une partie de démo qui ne se relit plus (une sauvegarde d'une version
     précédente que cette version ne sait pas lire) : on la met de côté, on
     repart d'un monde neuf, et on le dit. Sans ça, l'état du joueur échoue
     au démarrage, et la page retombe sur l'écran d'accueil sans pouvoir en
     sortir. */
  async function repartir(detail) {
    try { await kvSet(CLE + '-ancienne', S); } catch (e) { /* sans gravité */ }
    creerMonde();
    completer();
    await sauver();
    setTimeout(() => {
      if (typeof toast === 'function') toast('Ta partie de démo n\'a pas pu être relue (' + detail + ') : elle repart de zéro.');
    }, 2500);
  }

  /* Ce qui arrive des joueurs simulés est poussé comme le ferait le temps
     réel de Supabase (Backend.ecouterBoite). Un échange conclu change aussi la
     collection : on la relit, sinon la carte reçue n'apparaîtrait qu'à la
     prochaine action. */
  function signaler() {
    if (!S.aSignaler) return;
    S.aSignaler = false;
    ecouteurs.forEach(f => { try { f(); } catch (e) { /* un écouteur de moins */ } });
    relire();
  }

  /* Pas pendant une ouverture ni une scène de Promo : l'écran appartient aux
     cartes (ecranOccupe, js/app.js). On repasse un peu plus tard. */
  function relire() {
    if (typeof Backend !== 'object' || Backend.mode !== 'cloud' || !save) return;
    if (typeof ecranOccupe === 'function' && ecranOccupe()) return void setTimeout(relire, 3000);
    Backend.pull().then(() => { if (typeof majDiscrete === 'function') majDiscrete(true); }).catch(() => {});
  }

  async function appeler(nom, args) {
    await charger();
    const f = RPC[nom];
    if (!f) return { data: null, error: { message: 'Fonction inconnue : ' + nom } };
    if (!session() && nom !== 'porte') return { data: null, error: { message: 'non connecte' } };
    /* Tout passe, ou rien : une copie de l'état, remise en place si refus. */
    const avant = JSON.stringify(S);
    try {
      vivre();
      const data = f(MOI, args || {});
      await sauver();
      /* Une réponse du « réseau » n'est jamais instantanée : le jeu a des
         transitions qui comptent dessus. */
      await new Promise(r => setTimeout(r, 60 + Math.random() * 90));
      setTimeout(signaler, 400);
      return { data: data === undefined ? null : JSON.parse(JSON.stringify(data)), error: null };
    } catch (e) {
      S = JSON.parse(avant);
      if (!(e instanceof Refus)) {
        console.error('[démo]', nom, e);
        /* L'état du joueur (me) ne se lit plus : on repart d'un monde neuf,
           une fois, et on réessaie. */
        if (nom === 'me' && !repartiUneFois) {
          repartiUneFois = true;
          await repartir((e && e.message) || String(e));
          return appeler(nom, args);
        }
      }
      return { data: null, error: { message: e.message || 'Le serveur a refusé.' } };
    }
  }

  setInterval(async () => {
    if (!S || !session()) return;
    if (vivre()) { await sauver(); signaler(); }
  }, 4000);

  /* La session : « connecté » tant qu'on ne s'est pas déconnecté. */
  const session = () => {
    try { if (localStorage.getItem(CLE_SESSION) === '0') return null; } catch (e) { /* mode privé */ }
    return { access_token: 'demo', user: { id: MOI, email: '', user_metadata: {} } };
  };

  function requete(table) {
    let lignes = table === 'shop_items' ? BOUTIQUE.slice() : [];
    const q = {
      select() { return q; },
      eq(k, v) { lignes = lignes.filter(l => l[k] === v); return q; },
      order(k) {
        /* Tri stable : le second `order` départage le premier. */
        const cles = q._cles = (q._cles || []).concat(k);
        lignes.sort((a, b) => { for (const c of cles) { if (a[c] < b[c]) return -1; if (a[c] > b[c]) return 1; } return 0; });
        return q;
      },
      then(ok, ko) { return Promise.resolve({ data: JSON.parse(JSON.stringify(lignes)), error: null }).then(ok, ko); }
    };
    return q;
  }

  const client = {
    rpc: appeler,
    from: requete,
    channel() {
      const c = {
        on(evt, filtre, f) { if (typeof f === 'function' && !ecouteurs.includes(f)) ecouteurs.push(f); return c; },
        subscribe() { return c; }
      };
      return c;
    },
    auth: {
      async getSession() { await charger(); return { data: { session: session() } }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithOAuth() {
        try { localStorage.setItem(CLE_SESSION, '1'); } catch (e) { /* mode privé */ }
        location.reload();
        return { error: null };
      },
      async signOut() {
        try { localStorage.setItem(CLE_SESSION, '0'); } catch (e) { /* mode privé */ }
        return { error: null };
      },
      async signUp() { return { data: {}, error: { message: 'signups not allowed' } }; },
      async signInWithPassword() { return { error: { message: 'signups not allowed' } }; },
      async resetPasswordForEmail() { return { error: null }; },
      async resend() { return { error: null }; }
    }
  };

  window.supabase = { createClient: () => client };

  /* L'écran d'entrée de la démo (tools/demo.py le substitue à celui du vrai
     site, qui affiche l'annonce d'arrêt). On n'y arrive que déconnecté, ou
     si la démo n'a pas démarré : alors on dit pourquoi, et on propose de
     réessayer ou de repartir de zéro. */
  window.demoPorte = () => {
    const err = typeof Backend === 'object' && Backend.erreur;
    const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (err) {
      return `<span class="locktag refus">Démo</span>
        <h1 class="locktitle">La démo n'a pas démarré</h1>
        <div class="muted lockdit"><p>Ta partie de démo n'a pas pu être chargée. Réessaie ; si ça ne passe pas,
          repars de zéro : rien n'est réel ici, et le vrai site n'est pas touché.</p>
          <p class="small">Détail : ${esc(err)}</p></div>
        <div class="lockentree">
          <a class="btn" href="${esc(location.pathname)}?reinitialiser">Repartir de zéro</a>
          <a class="btn ghost" href="${esc(location.pathname)}">Réessayer</a>
        </div>`;
    }
    return `<span class="locktag">Démo</span>
      <h1 class="locktitle">Tu es déconnecté</h1>
      <div class="muted lockdit"><p>Rien n'est réel ici : touche « Entrer » pour reprendre ta partie de démo.</p></div>
      <div class="lockentree">
        <button class="btn" data-act="porte-discord">Entrer</button>
        <a class="btn ghost" href="${esc(location.pathname)}?reinitialiser">Repartir de zéro</a>
      </div>`;
  };
})();
