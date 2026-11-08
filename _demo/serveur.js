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
  /* La démo présentée à Gentle Mates (tools/demo.py --demo, 3.0.14) : le jeu
     à son premier jour. Pas d'invitations (la bêta), la chasse à la carte
     unique encore ouverte, douze joueurs simulés pour que les classements,
     le Raid et l'événement vivent (BOTS_M8), et ils se manifestent plus tôt. */
  const M8 = window.DEMO_M8 === true;

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
  const plusJours = (j, n) => { const d = new Date(j + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  /* Les jours de `a` à `b` ('2026-11-02'), et minuit (heure de Paris) d'une date. */
  const ecartJours = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  const minuitDe = j => ['+02:00', '+01:00'].map(o => Date.parse(`${j}T00:00:00${o}`))
    .find(t => jourParis(t) === j && paris(t).hour === 0);

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
    ['d_combat',   'daily',     'combats',          1,   20, null, 'Sur le terrain',         'Joue un combat, en solo ou contre un ami.', 8],
    ['d_victoire', 'daily',     'victoires',        1,   40, null, 'Première victoire',      'Gagne un combat.', 9],
    ['d_vaincus',  'daily',     'vaincus',          5,   30, null, 'Faucheur',               'Vaincs 5 Joueurs adverses en combat.', 10],
    ['w_victoires','weekly',    'victoires',       10,  250, null, 'Série de victoires',     'Gagne 10 combats cette semaine.', 8],
    ['w_dur',      'weekly',    'victoires_dures',  3,  300, null, 'Sans trembler',          'Gagne 3 combats en Difficile ou plus.', 9],
    ['w_defi',     'weekly',    'defis',            1,  150, null, 'Entre amis',             'Joue un défi contre un ami.', 10],
    ['m_campagne', 'milestone', 'campagne',        20,  500, 't_sections', 'Champion des Sections', 'Termine la campagne des Combats.', 20],
    ['m_legende',  'milestone', 'legende',          1,  300, 't_legende',  'Tombeur de Légende',    'Gagne en Arcade, difficulté Légende.', 21],
    ['m_cent',     'milestone', 'victoires',      100, 1000, 't_stratege', 'Stratège',              'Gagne 100 combats.', 22],
    ['m_secrete',  'milestone', 'rarity_S',         1,  500, 'f_secrete',  'Secret bien gardé',     'Sors ta première Secrète d\'un booster.', 23],
    ['m_tutoriel', 'milestone', 'tutoriel',         1,  200, null,         'Premiers pas',          'Gagne la partie du tutoriel (Combats, Guide).', 24],
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
       en Étincelles — la colonne `monnaie` dit « prismes » pour toute monnaie
       d'événement, c'est l'événement qui lui donne son nom. */
    ['c_visite',  'ev_jour', 'ev_visite',         1, 10, null, 'Au rapport',           'Passe voir l\'événement aujourd\'hui.', 1, 'choc', 'prismes'],
    ['c_combats', 'ev_jour', 'combats',           2, 15, null, 'Deux combats',         'Joue 2 combats, en solo ou contre un ami.', 2, 'choc', 'prismes'],
    ['c_raid',    'ev_jour', 'raid',              1, 15, null, 'Paratonnerre',         'Affronte le boss du Raid.', 3, 'choc', 'prismes'],
    ['c_epreuve', 'ev_jour', 'epreuve',           1, 10, null, 'L\'Épreuve du jour',   'Tente l\'Épreuve du jour.', 4, 'choc', 'prismes'],
    ['c_vaincus', 'ev_jour', 'vaincus',           6, 15, null, 'Six de chute',         'Vaincs 6 Joueurs adverses en combat.', 5, 'choc', 'prismes'],
    ['c_packs',   'ev_jour', 'packs',             3, 10, null, 'Trois boosters',       'Ouvre 3 boosters aujourd\'hui.', 6, 'choc', 'prismes'],
    ['c_deg100',  'ev',      'raid_degats',      70, 80, null, 'Soixante-dix dégâts',  'Inflige 70 dégâts au boss du Raid.', 1, 'choc', 'prismes'],
    ['c_raidv5',  'ev',      'raid_victoires',    4, 60, null, 'Quatre fois à terre',  'Fais tomber le boss du Raid 4 fois.', 2, 'choc', 'prismes'],
    ['c_ep7',     'ev',      'epreuve_victoires', 5, 80, null, 'Cinq Épreuves',        'Gagne 5 Épreuves du jour.', 3, 'choc', 'prismes'],
    ['c_ep15',    'ev',      'epreuve',          10, 60, null, 'Dix essais',           'Tente 10 fois l\'Épreuve du jour.', 4, 'choc', 'prismes'],
    ['c_vic30',   'ev',      'victoires',        20, 60, null, 'Vingt victoires',      'Gagne 20 combats pendant l\'événement.', 5, 'choc', 'prismes'],
    ['c_dur5',    'ev',      'victoires_dures',   5, 60, null, 'Sans trembler',        'Gagne 5 combats en Difficile ou plus.', 6, 'choc', 'prismes'],
    ['c_legende', 'ev',      'legende',           1, 50, null, 'Tombeur de Légende',   'Gagne en Arcade, difficulté Légende.', 7, 'choc', 'prismes'],
    ['c_defis',   'ev',      'defis',             5, 50, null, 'Entre amis',           'Joue 5 défis contre des amis.', 8, 'choc', 'prismes'],
    ['c_deck',    'ev',      'deck',              1, 20, null, 'Mon deck à moi',       'Enregistre un deck que tu as construit.', 9, 'choc', 'prismes'],
    ['c_cosm',    'ev',      'cosm',              1, 20, null, 'À mes couleurs',       'Change de tapis de jeu ou de sleeve.', 10, 'choc', 'prismes'],
    ['c_packs60', 'ev',      'packs',            40, 50, null, 'Quarante boosters',    'Ouvre 40 boosters pendant l\'événement.', 11, 'choc', 'prismes'],
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
    ['f_toxique','cosmetique', 'Cadre Toxique','Le vert de la Section Toxique, qui goutte.',                 3000, 'cosmetique', 1, null, true, 5],
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
    /* Le Choc des Sections (25_choc.sql), en Étincelles. */
    // Deux colonnes : le tapis (5) et le cadre (6) du Sorcier sur la dernière rangée (le propriétaire, 2 novembre 2026).
    ['ch_boosters',  'evenement', 'x2 Boosters',      'Deux boosters à ouvrir tout de suite.',      80, 'tickets',   2,   null, false, 1, 'prismes', 'choc', 7],
    ['ch_boosters5', 'evenement', 'x5 Boosters',      'Cinq boosters, un peu moins cher à l\'unité.', 180, 'tickets', 5,   null, false, 2, 'prismes', 'choc', 2],
    ['ch_fragments', 'evenement', '500 Fragments',    'De quoi fabriquer les cartes qui manquent.', 70, 'fragments', 500, null, false, 3, 'prismes', 'choc', 5],
    ['t_orage',      'evenement', 'Tapis « The French Sorcerer »', 'L\'illustration de la carte « The French Sorcerer », sous tes cartes. Ne se vendra plus après l\'événement.', 600, 'cosmetique', 1, null, true, 5, 'prismes', 'choc', null],
    ['t_supporter',  'evenement', 'Titre « Supporter du Choc »', 'Un titre qui ne se vendra plus après l\'événement.', 200, 'cosmetique', 1, null, true, 4, 'prismes', 'choc', null],
    ['f_foudre',     'evenement', 'Cadre « The French Sorcerer »', 'La foudre du Sorcier autour de ton avatar. Ne se vendra plus après l\'événement.', 400, 'cosmetique', 1, null, true, 6, 'prismes', 'choc', null]
  ].map(([id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite]) =>
    ({ id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, actif: true,
       devise: devise || 'eclats', evenement: evenement || null, limite: limite == null ? null : limite }));

  if (M8) BOUTIQUE.splice(0, BOUTIQUE.length, ...BOUTIQUE.filter(a => a.effet !== 'invitation'));

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
  /* Le Pass du Choc des Sections (25_choc.sql) : vingt paliers (3.0.13 ;
     trente pour les trois semaines d'avant). */
  const PISTE_CHOC = [
    [1, 20, 'boosters', 2, null, '2 boosters'], [2, 50, 'titre', 0, 't_recrue', 'Titre « Recrue du Choc »'],
    [3, 90, 'eclats', 200, null, '200 Éclats'], [4, 140, 'fragments', 400, null, '400 Fragments'],
    [5, 200, 'sleeve', 0, 's_choc', 'Sleeve « Le Choc »'], [6, 270, 'boosters', 3, null, '3 boosters'],
    [7, 350, 'reverse_R', 1, null, 'Une Reverse Rare'], [8, 440, 'eclats', 400, null, '400 Éclats'],
    [9, 540, 'cadre', 0, 'f_choc', 'Cadre « Choc »'], [10, 650, 'boosters', 3, null, '3 boosters'],
    [11, 770, 'fragments', 700, null, '700 Fragments'], [12, 900, 'brillante', 1, null, 'Une Essence Brillante'],
    [13, 1040, 'eclats', 500, null, '500 Éclats'], [14, 1200, 'boosters', 4, null, '4 boosters'],
    [15, 1380, 'titre', 0, 't_veteran', 'Titre « Vétéran du Choc »'], [16, 1580, 'reverse_R', 2, null, 'Deux Reverses Rares'],
    [17, 1800, 'fragments', 1000, null, '1 000 Fragments'], [18, 2040, 'boosters', 4, null, '4 boosters'],
    [19, 2280, 'titre', 0, 't_maitre_choc', 'Titre « Maître du Choc »'], [20, 2500, 'tapis', 0, 't_arene', 'Tapis « Le Choc des Sections »']
  ].map(([palier, seuil, type, montant, objet, titre]) => ({ palier, seuil, type, montant, objet, titre }));
  /* Le Choc dure deux semaines depuis la 3.0.13 (trois avant) ; son texte ne
     nomme pas le boss du raid suivant (le propriétaire, 1er novembre 2026). */
  const CHOC_DUREE = 14;
  const CHOC_TEXTE = M8 ? 'Deux Sections s\'affrontent pendant deux semaines : l\'Épreuve du jour, le Raid et un Pass de vingt paliers.'
    : 'La version 3.0 : le Raid, un nouveau boss toutes les deux semaines, et l\'Épreuve du jour.';
  const PISTES = { reflets: PISTE, choc: PISTE_CHOC };
  const pisteDe = code => PISTES[code] || PISTE;

  /* est_cosmetique_combat, 21_reflets.sql : un tapis ou un sleeve, d'après la
     boutique et les Pass (les titres partagent le préfixe `t_` des tapis). */
  const estCosmetiqueCombat = (x, genre) => x === (genre === 'tapis' ? 't_base' : 's_base')
    || BOUTIQUE.some(a => a.id === x && (a.categ === genre
      || (a.categ === 'evenement' && a.titre.startsWith(genre[0].toUpperCase() + genre.slice(1) + ' '))))
    || Object.values(PISTES).some(l => l.some(r => r.type === genre && r.objet === x));

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
      parametres: { reverses: { ouvertes: revOuvertes(), des: revDes() == null ? null : iso(revDes()),
        couts: { C: prixReverse('C'), PC: prixReverse('PC'), R: prixReverse('R') } } },
      prismes: compte(p).solde,
      invitations: S.invitations.filter(i => i.auteur === p).map(i => ({ code: i.code, cree_le: iso(i.cree_le),
        utilise_par: i.utilise_par ? profil(i.utilise_par).pseudo : null, utilise_le: i.utilise_le ? iso(i.utilise_le) : null })),
      col: garde(colDe(p)),
      gardes: Object.assign({}, (S.gardes || {})[p] || {}),
      favoris: ((S.favoris || {})[p] || []).slice(),
      combat: combatEtat(p),
      maitrise: maitriseEtat(p),
      inv: garde(invDe(p)),
      quetes: QUETES.filter(q => (!q.evenement || q.evenement === evenementEnCours()) && !(q.metric === 'invite' && (M8 || estFilleul(p))))
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
  /* La fin du récap : evenements.recap_jusqua, ou trois jours après la fin
     (evenement_recent, 21_reflets.sql). */
  const recapFin = e => (e.recap_jusqua != null ? e.recap_jusqua : e.fin + 3 * 86400000);
  function evenementRecent() {
    const e = S.evenement;
    if (!e || !e.code || now() < e.fin || now() >= recapFin(e)) return null;
    return { code: e.code, titre: e.titre, debut: iso(e.debut), fin: iso(e.fin), jusqua: iso(recapFin(e)) };
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
    Object.keys(invDe(p)).filter(k => k.startsWith('t_') && invDe(p)[k] > 0 && !estCosmetiqueCombat(k, 'tapis'))
      .sort().forEach(k => t.push(k));
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
     Les grilles de pixels sont celles du serveur
     (supabase/installation/21b_illu.sql), recopiées par tools/demo.py dans
     window.DEMO_ILLU. */
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
  /* porte() (01_schema.sql) ; version 3.0.12 : la version de la base et la
     maintenance en cours (le visiteur de la démo est administrateur : elle
     ne l'arrête pas, la pastille le lui rappelle ; Labo › Aperçus montre
     l'écran des joueurs). */
  const maintDemo = () => (S.maintenance = S.maintenance || { actif: false, message: null, fin: null, depuis: null, par: null });
  RPC.porte = () => {
    const m = maintDemo();
    return { ouvert: true, lancement: null, serveur: iso(now()), version: '3.0',
      maintenance: m.actif ? { message: m.message, fin: m.fin, depuis: m.depuis } : null };
  };

  RPC.set_profile = (p, { p_pseudo, p_avatar, p_frame }) => {
    if (p_pseudo != null) {
      if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(p_pseudo))
        refuser('Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ -');
      const x = parPseudo(p_pseudo);
      if (x && x.id !== p) refuser('Ce pseudo est déjà pris.');
    }
    if (p_avatar != null && !/^[a-z0-9_:\-]{1,40}$/.test(p_avatar)) refuser('Avatar invalide.');
    if (p_avatar != null && p_avatar.startsWith('card:') && !possede(p, p_avatar.slice(5)))
      refuser('Tu ne possèdes pas cette carte.');
    if (p_frame != null && p_frame !== 'default' && (!p_frame.startsWith('f_') || !((invDe(p)[p_frame] || 0) > 0)))
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
      /* Le godpack (3.0.13, comme open_pack) : trois Épiques, deux
         Légendaires, une Secrète en dernier. */
      ids = [pickCard('E'), pickCard('E'), pickCard('E'), pickCard('L'), pickCard('L'), pickCard('S')];
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
      if (c.solde < it.prix) refuser(evenementEnCours() === 'choc' ? 'Pas assez d\'Étincelles.' : 'Pas assez de Prismes.');
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
    /* Les Essences Brillantes s'échangent entre elles (version 3.0.11) : même
       rareté (BR), donc une Brillante contre une Brillante. */
    if ((co.promo && !co.foil) || (cw.promo && !cw.foil)) refuser('Cette carte ne s\'échange pas.');
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
        if (!k || n <= gardeDe(o.id, id) || (mien[id] || 0) > 0 || (k.cat === 'essence' && !k.foil) || (k.promo && !k.rev && !k.foil)) return;
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
      secretes: secretes.filter(k => (c[k.id] || 0) > 0).length,
      titre: o.titre || null, banniere: o.banniere || null, devise: o.devise || null,
      vitrine: o.vitrine.slice(),
      xp: xpDe(o.id),
      fetiche: feticheDe(o.id),
      combat: combatPublic(o.id),
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

  /* ============================== version 3.0.7, 28_maitrise.sql */
  /* La maîtrise des cartes : cinq niveaux, payés en Fragments et en
     exemplaires EN TROP (au-delà de la limite de deck, de ce qu'on garde et
     des échanges en attente), consommés. Version 3.0.13 : un exemplaire qui
     manque ne se remplace plus par des Fragments. Les montants sont ceux du
     serveur (maitrise_fragments, maitrise_copies). */
  const MZ_BASE = { C: 80, PC: 120, R: 250, E: 500, L: 800, S: 800 };
  const MZ_MULT = [1, 2, 4, 7, 11];
  const MZ_COPIES = { C: [2, 3, 4, 5, 6], PC: [2, 2, 3, 4, 5], R: [1, 2, 2, 3, 4], E: [1, 1, 2, 2, 3], L: [1, 1, 1, 1, 1], S: [1, 0, 0, 0, 1] };
  /* maitrise_carte : la carte qui porte la maîtrise (une Reverse : sa carte
     classique), si elle se maîtrise ; null sinon. */
  function maitriseCarte(id) {
    const k = carte(/^r\d/.test(id || '') ? 'c' + id.slice(1) : id);
    return k && !k.rev && k.cat !== 'essence' && (!k.promo || k.secrete) && MZ_COPIES[k.rar] ? k : null;
  }
  const mzDe = p => (S.maitrises[p] = S.maitrises[p] || {});
  const maitriseEtat = p => ({ niveaux: Object.assign({}, mzDe(p)), fetiche: profil(p).fetiche || null });
  function feticheDe(u) {
    const f = profil(u).fetiche;
    if (!f || !possede(u, f)) return null;
    const k = maitriseCarte(f);
    return { carte: f, niveau: (k && mzDe(u)[k.id]) || 0 };
  }
  RPC.maitriser = (p, { p_carte }) => {
    const k = maitriseCarte(p_carte);
    if (!k) refuser(carte(p_carte) ? 'Cette carte ne se maîtrise pas.' : 'Carte inconnue.');
    const possedees = colDe(p)[k.id] || 0;
    if (possedees < 1) refuser('Il faut posséder la carte pour la maîtriser.');
    const n = (mzDe(p)[k.id] || 0) + 1;
    if (n > 5) refuser('Cette carte est déjà au niveau maximum.');
    const reserve = S.trades.filter(t => t.from_user === p && t.offer_card === k.id && t.status === 'pending').length;
    /* Ce qui reste (3.0.14, maitriser() de 28_maitrise.sql) : un
       exemplaire, ce qu'on garde, le plus qu'en contient un de ses decks. */
    const endeck = Math.max(0, ...cb(p).decks.map(d => +(d.cartes || {})[k.id] || 0));
    const dispo = Math.max(0, possedees - Math.max(1, gardeDe(p, k.id), endeck) - reserve);
    const copies = MZ_COPIES[k.rar][n - 1];
    if (dispo < copies) refuser(`Il faut ${copies} exemplaire${copies > 1 ? 's' : ''} en trop de « ${k.nom} » : tu en as ${dispo}.`);
    const total = MZ_BASE[k.rar] * MZ_MULT[n - 1];
    const pr = profil(p);
    if ((pr.fragments || 0) < total) refuser(`Pas assez de Fragments : il en faut ${total}.`);
    pr.fragments -= total;
    ajouter(p, k.id, -copies);
    mzDe(p)[k.id] = n;
    return me(p);
  };
  RPC.set_fetiche = (p, { p_carte }) => {
    if (p_carte != null && !possede(p, p_carte)) refuser('Tu ne possèdes pas cette carte.');
    profil(p).fetiche = p_carte || null;
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
  /* ------------------------------------ tutoriel_fini, 23_combats.sql */
  RPC.tutoriel_fini = p => { bump(p, 'tutoriel', 1); return { ok: true }; };

  RPC.classement = (moi, { p_critere }) => {
    if (!['collection', 'reverses', 'boosters', 'echanges', 'serie', 'niveau', 'secretes', 'versus'].includes(p_critere)) refuser('Classement inconnu.');
    const auj = jourParis(now());
    const valeur = pr => p_critere === 'collection'
      ? extension().filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'reverses' ? reverses.filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'niveau' ? xpDe(pr.id)
      : p_critere === 'secretes' ? secretes.filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'versus' ? (((S.cb || {})[pr.id] || {}).stats || {}).pvp_v || 0
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
      if (k.rev && !revOuvertes()) refuser('Les Reverses ne se recyclent pas encore.');
      /* Une Reverse rapporte le double de sa classique (3.0.17). */
      const base = cfg('recyclage_' + k.rar);
      const prix = base == null ? null : base * (k.rev ? 2 : 1);
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

  /* 22c_reverses.sql (reporté de la 2.5) : reverses_ouvertes et prix_reverse.
     Ouvertes à la main, ou passé la date. Dans la vraie base, la date est
     parametres.reverses_des, posée par la 2.5 (le 26 octobre 2026) ; dans le
     monde de la démo, qui vient après la 2.5, elles sont ouvertes dès le
     début (S.debut), sauf date posée par le Labo. */
  function revDes() {
    if ('reverses_des' in S.parametres) return S.parametres.reverses_des;
    return S.debut;
  }
  function revOuvertes() { const d = revDes(); return !!S.parametres.fabrication_reverse || (d != null && now() >= d); }
  function prixReverse(r) { return { C: 400, PC: 500, R: 2400 }[r]; }

  /* fabriquer, 12_recyclage.sql */
  RPC.fabriquer = (p, { p_carte }) => {
    const k = carte(p_carte);
    if (!k) refuser('Carte inconnue.');
    if (k.promo) refuser('Cette carte ne se fabrique pas.');
    let cout = cfg('fabrication_' + k.rar);
    if (cout == null) refuser('Cette carte ne se fabrique pas.');
    if (k.rev) {
      if (!revOuvertes()) refuser('La fabrication des Reverses n\'est pas encore ouverte.');
      cout = prixReverse(k.rar);
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

  /* ------------------------------------------ le Labo, 29_labo.sql */
  /* Les mêmes gestes que la vraie base, sur le monde de la démo : le Choc
     dans un état ou un autre, le Raid à une phase, son compte réglé, mis de
     côté, remis. */
  const J_MS = 86400000;
  function laboEtat(p) {
    const e = S.evenement && S.evenement.code === 'choc' ? S.evenement : null;
    const sa = saisonDemo(), r = raidDe(), sv = (S.labo || {})[p];
    const ch = chocDe();
    const comptes = Object.entries(S.evt.comptes).filter(([k, v]) => k.endsWith('|choc') && v.total > 0);
    const cbs = Object.values(S.cb || {});
    const vs = vueSaison(p, sa);
    return {
      serveur: iso(now()),
      choc: e ? { debut: iso(e.debut), fin: iso(e.fin), recap_jusqua: iso(recapFin(e)) } : null,
      en_cours: evenementEnCours(), recent: evenementRecent(),
      participation: { joueurs: comptes.length, etincelles: comptes.reduce((n, [, v]) => n + v.total, 0),
        epreuves: Object.keys(ch.epreuves).length, gagnees: Object.keys(ch.gagnees).length,
        raid: Object.values(ch.joueurs).reduce((n, x) => n + (x.degats || 0), 0) },
      raid: { saison: sa, boss: vs.boss, debut: vs.debut, fin: vs.fin, degats: degatsSaison(sa), phase: phaseDemo(sa),
        seuils: RAID.phases.map((x, i) => seuilDemo(i + 1, sa)), echelle: echelleRaid(),
        joueurs: Object.entries(r.part).filter(([k, x]) => k.startsWith(sa + '|') && x.combats > 0).length },
      reverses: { des: revDes() == null ? null : iso(revDes()), manuel: !!S.parametres.fabrication_reverse, ouvertes: revOuvertes() },
      sections: { toxique: cbs.filter(c => c.section === 'toxique').length, deter: cbs.filter(c => c.section === 'deter').length },
      chasse: chasseEtat(),
      recharge: { minutes: cfg('ticket_minutes'), cap: cfg('ticket_cap') },
      recharges: [],
      joueurs: Object.keys(S.profils).length,
      maintenance: Object.assign({}, maintDemo()),
      sauvegarde: sv ? { le: iso(sv.le), version: '3.0', cartes: Object.keys(sv.contenu.col || {}).length } : null,
      /* Les combats que le serveur n'a pas pu vérifier (3.0.14). */
      refuses: { n30: (S.combats_refuses || []).filter(x => now() - Date.parse(x.le) < 30 * 864e5).length, liste: (S.combats_refuses || []).slice(0, 20) }
    };
  }
  RPC.labo_etat = p => { estAdmin(p); return laboEtat(p); };
  /* labo_maintenance (29_labo.sql, 3.0.12). */
  RPC.labo_maintenance = (p, { p_actif, p_message, p_fin }) => {
    estAdmin(p);
    const a = !!p_actif, m = maintDemo();
    if (a && p_fin && Date.parse(p_fin) <= now()) refuser('L\'heure de retour est déjà passée.');
    const deja = m.actif;
    m.actif = a;
    m.message = a ? (String(p_message || '').trim().slice(0, 300) || null) : null;
    m.fin = a && p_fin ? iso(Date.parse(p_fin)) : null;
    m.depuis = !a ? null : deja ? m.depuis : iso(now());
    m.par = !a ? null : deja ? m.par : profil(p).pseudo;
    return laboEtat(p);
  };
  RPC.labo_evenement = (p, { p_etat, p_n }) => {
    estAdmin(p);
    const t = now(), DUREE = CHOC_DUREE * J_MS;
    let d, f = null;
    if (p_etat === 'avant') {
      const n = p_n == null ? 2 : p_n;
      if (!(n >= 1 && n <= 10080)) refuser('Entre 1 minute et 7 jours.');
      d = t + n * 60000;
    } else if (p_etat === 'jour') {
      const n = p_n == null ? 1 : p_n;
      if (!(n >= 1 && n <= CHOC_DUREE)) refuser(`Un jour de 1 à ${CHOC_DUREE}.`);
      /* À minuit, heure de Paris (labo_evenement, 3.0.11) : l'Épreuve n. */
      let j = jourParis(t);
      for (let k = 1; k < n; k++) j = hier(j);
      d = minuitDe(j);
      /* La fin à minuit, quatorze dates plus tard (labo_evenement, 3.0.13) :
         pas 14 × 24 h, qui finissait à 23 h après le passage à l'heure d'hiver. */
      f = minuitDe(plusJours(j, CHOC_DUREE));
    } else if (p_etat === 'recap') d = t - DUREE - 3600000;
    else if (p_etat === 'fini') d = t - DUREE - 4 * J_MS;
    else refuser('État inconnu.');
    /* Un seul événement dans la démo : celui d'avant (Reflets) laisse la place. */
    S.evenement = { titre: CHOC.nom, code: 'choc', debut: d, fin: f || d + DUREE, recap_jusqua: null,
      texte: CHOC_TEXTE };
    return laboEtat(p);
  };
  RPC.labo_decaler = (p, { p_heures }) => {
    estAdmin(p);
    if (!p_heures || Math.abs(p_heures) > 336) refuser('De 1 à 336 heures.');
    const e = S.evenement && S.evenement.code === 'choc' ? S.evenement : null;
    if (!e) refuser('Pas de Choc à décaler : pose d\'abord un état.');
    e.debut -= p_heures * 3600000; e.fin -= p_heures * 3600000;
    if (e.recap_jusqua != null) e.recap_jusqua -= p_heures * 3600000;
    return laboEtat(p);
  };
  RPC.labo_evenement_raz = (p, { p_confirmation }) => {
    estAdmin(p);
    if (p_confirmation !== 'EFFACER') refuser('Confirmation manquante.');
    const ch = chocDe();
    const r = { epreuves: Object.keys(ch.epreuves).length, raid: Object.keys(ch.joueurs).length };
    ch.epreuves = {}; ch.gagnees = {}; ch.joueurs = {};
    Object.keys(S.evt.comptes).forEach(k => { if (k.endsWith('|choc')) delete S.evt.comptes[k]; });
    Object.keys(S.evt.prises).forEach(k => { if (k.endsWith('|choc')) delete S.evt.prises[k]; });
    QUETES.filter(q => q.evenement === 'choc').forEach(q => Object.keys(S.qp).forEach(k => { if (k.split('|')[1] === q.id) delete S.qp[k]; }));
    return Object.assign(r, { etat: laboEtat(p) });
  };
  RPC.labo_reverses = (p, { p_ouvertes }) => {
    estAdmin(p);
    if (p_ouvertes) S.parametres.fabrication_reverse = true;
    else { S.parametres.fabrication_reverse = false; S.parametres.reverses_des = null; }
    return laboEtat(p);
  };
  RPC.labo_raid = (p, { p_phase }) => {
    estAdmin(p);
    /* 7 et plus (3.0.15) : l'Infini, palier p_phase − 6, commun. */
    if (!(p_phase >= 1 && p_phase <= 20)) refuser('Une phase de 1 à 20 (7 et plus : l\'Infini).');
    const r = raidDe(), sa = saisonDemo();
    r.saisons[sa] = p_phase === 1 ? 0 : seuilDemo(p_phase - 1, sa);
    for (let k = 1; k <= 20; k++) {
      if (k < p_phase) r.tombees[sa + '|' + k] = r.tombees[sa + '|' + k] || now();
      else delete r.tombees[sa + '|' + k];
    }
    return laboEtat(p);
  };
  RPC.labo_raid_echelle = (p, { p_echelle }) => {
    estAdmin(p);
    if (!(p_echelle >= 0.05 && p_echelle <= 20)) refuser('Une échelle de 0,05 à 20.');
    S.parametres.raid_echelle = p_echelle;
    return laboEtat(p);
  };
  RPC.labo_raid_raz = (p, { p_confirmation }) => {
    estAdmin(p);
    if (p_confirmation !== 'EFFACER') refuser('Confirmation manquante.');
    const r = raidDe(), sa = saisonDemo(), auj = jourParis(now());
    const de = o => Object.keys(o).filter(k => k.startsWith(sa + '|'));
    const res = { joueurs: de(r.part).length, coffres: de(r.pris).length };
    de(r.part).forEach(k => delete r.part[k]); de(r.pris).forEach(k => delete r.pris[k]); de(r.tombees).forEach(k => delete r.tombees[k]);
    Object.keys(r.tentatives).forEach(k => { if (k.endsWith('|' + auj)) delete r.tentatives[k]; });
    r.saisons[sa] = 0;
    return Object.assign(res, { etat: laboEtat(p) });
  };
  /* limite_copies, 23_combats.sql : trois exemplaires de chaque carte
     (règles officielles, 3.0.12). */
  const limiteCopies = () => Combat.REGLE.COPIES;
  RPC.labo_cartes = (p, { p_quoi }) => {
    estAdmin(p);
    const col = colDe(p);
    if (p_quoi === 'vider') {
      S.trades.filter(x => x.status === 'pending' && (x.from_user === p || x.to_user === p))
        .forEach(x => { x.status = 'cancelled'; x.resolved_at = now(); });
      Object.keys(col).forEach(k => delete col[k]);
    } else if (['master', 'classiques', 'combat'].includes(p_quoi)) {
      const liste = p_quoi === 'master' ? cards.concat(reverses, promos, brillantes, secretes)
        : p_quoi === 'classiques' ? cards : cards.filter(k => ['joueur', 'coach', 'moment', 'objet'].includes(k.cat));
      liste.filter(k => k.rar !== 'UN').forEach(k => { col[k.id] = Math.max(col[k.id] || 0, p_quoi === 'classiques' ? 1 : limiteCopies(k)); });
    } else if (p_quoi === 'maitrise') {
      /* 3.0.13 : de quoi mener chaque carte en Légende (les trois d'un deck,
         plus ce que ses cinq niveaux consomment). */
      cards.concat(secretes).filter(k => (maitriseCarte(k.id) || {}).id === k.id)
        .forEach(k => { col[k.id] = Math.max(col[k.id] || 0, limiteCopies(k) + MZ_COPIES[k.rar].reduce((a, b) => a + b, 0)); });
    } else refuser('Choix inconnu.');
    syncCollection(p); checkPromos(p);
    return me(p);
  };
  RPC.labo_monnaies = (p, { p_valeurs }) => {
    estAdmin(p);
    if (!p_valeurs || typeof p_valeurs !== 'object') refuser('Valeurs invalides.');
    const lim = { eclats: 1e7, fragments: 1e7, boosters: 999, reserve: 99, prismes: 1e7, niveau: 100 };
    Object.entries(p_valeurs).forEach(([k, v]) => {
      if (!(k in lim)) refuser(`Valeur inconnue : ${k}.`);
      if (typeof v !== 'number') refuser('Un nombre est attendu.');
      if (v < (k === 'niveau' ? 1 : 0) || v > lim[k]) refuser(`Valeur hors limites : ${k}.`);
    });
    const pr = profil(p), V = k => Math.round(p_valeurs[k]);
    if ('eclats' in p_valeurs) pr.shards = V('eclats');
    if ('fragments' in p_valeurs) pr.fragments = V('fragments');
    if ('boosters' in p_valeurs) { pr.boosters_bonus = V('boosters'); pr.tickets_offerts = Math.min(pr.tickets_offerts || 0, V('boosters')); }
    if ('reserve' in p_valeurs) { pr.tickets = V('reserve'); pr.last_tick = now(); }
    if ('prismes' in p_valeurs) {
      const ev = evenementEnCours() || (S.evenement && S.evenement.code);
      if (!ev) refuser('Aucun événement : pas de monnaie d\'événement à poser.');
      const c = (S.evt.comptes[p + '|' + ev] = S.evt.comptes[p + '|' + ev] || { solde: 0, total: 0 });
      c.solde = V('prismes'); c.total = Math.max(c.total, c.solde);
    }
    if ('niveau' in p_valeurs) {
      let xp = 0;
      for (let n = 1; n < V('niveau'); n++) xp += xpRequis(n);
      cb(p).xp = xp;
      QUETES.filter(q => q.metric === 'niveau').forEach(q => {
        const k = cleQp(p, q), qp = (S.qp[k] = S.qp[k] || { progress: 0, claimed: false });
        if (!qp.claimed) qp.progress = Math.max(qp.progress, V('niveau'));
      });
    }
    return me(p);
  };
  RPC.labo_cosmetiques = (p, { p_ids }) => {
    estAdmin(p);
    if (!Array.isArray(p_ids) || !p_ids.length || p_ids.length > 300) refuser('Liste vide ou trop longue.');
    const inv = invDe(p);
    p_ids.forEach(x => {
      if (!/^[fts]_[a-z0-9_]{1,40}$/.test(x)) refuser(`Identifiant invalide : ${x}.`);
      inv[x] = Math.max(inv[x] || 0, 1);
    });
    return me(p);
  };
  RPC.labo_combats_moi = (p, { p_action, p_valeur }) => {
    estAdmin(p);
    const c = cb(p), auj = jourParis(now());
    if (p_action === 'section') {
      if (p_valeur != null && !SEC_PROMO[p_valeur]) refuser('Section inconnue.');
      c.section = p_valeur || null;
      if (p_valeur && !possede(p, SEC_PROMO[p_valeur])) ajouter(p, SEC_PROMO[p_valeur], 1);
    } else if (p_action === 'campagne') {
      if (p_valeur === 'finie') { c.faits = Array.from({ length: 20 }, (x, i) => 'cp' + String(i + 1).padStart(2, '0')); c.finie = true; }
      else if (p_valeur === 'raz') { c.faits = []; c.finie = false; }
      else refuser('Choix inconnu.');
    } else if (p_action === 'jour') {
      c.recompensees = 0; c.jour = null; c.defis_rec = 0; c.defis_jour = null;
      delete raidDe().tentatives[p + '|' + auj];
      const ch = chocDe();
      delete ch.epreuves[p + '|' + auj]; delete ch.gagnees[p + '|' + auj];
    } else if (p_action === 'maitrises') {
      if (p_valeur === 'max') {
        Object.keys(colDe(p)).filter(id => colDe(p)[id] > 0).forEach(id => {
          const k = carte(id.replace(/^r(?=\d)/, 'c'));
          if (k && k.cat !== 'essence' && !k.rev && (!k.promo || k.secrete) && ['C', 'PC', 'R', 'E', 'L', 'S'].includes(k.rar)) mzDe(p)[k.id] = 5;
        });
      } else if (p_valeur === 'raz') S.maitrises[p] = {};
      else refuser('Choix inconnu.');
    } else refuser('Action inconnue.');
    return me(p);
  };
  /* labo_tables : ce qui est à soi, sauf les amis, la boîte, les échanges et
     les défis entre amis. */
  function laboCompte(p) {
    const a = x => k => k.startsWith(x), r = raidDe(), ch = chocDe();
    const de = (o, f) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => f(k)));
    const c = Object.assign({}, cb(p), { ouverts: {} });
    return JSON.parse(JSON.stringify({
      profil: profil(p), col: colDe(p), inv: invDe(p), qp: de(S.qp, a(p + '|')),
      comptes: de(S.evt.comptes, a(p + '|')), prises: de(S.evt.prises, k => k === p || k.startsWith(p + '|')),
      gardes: (S.gardes || {})[p] || {}, favoris: (S.favoris || {})[p] || [], illu: de(S.illu, a(p + '|')),
      tirages: S.tirages.filter(t => t.user_id === p), recyclages: S.recyclages.filter(t => t.user_id === p),
      cb: c, maitrises: mzDe(p), histo: (S.histo || {})[p] || [],
      epreuves: de(ch.epreuves, a(p + '|')), gagnees: de(ch.gagnees, a(p + '|')), choc: ch.joueurs[p] || null,
      raidPart: de(r.part, k => k.split('|')[1] === p), raidPris: de(r.pris, k => k.split('|')[1] === p),
      tentatives: de(r.tentatives, a(p + '|'))
    }));
  }
  function laboEffacer(p) {
    const pas = x => k => !k.startsWith(x), r = raidDe(), ch = chocDe();
    const garder = (o, f) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => f(k)));
    S.col[p] = {}; S.inv[p] = {};
    S.qp = garder(S.qp, pas(p + '|')); S.evt.comptes = garder(S.evt.comptes, pas(p + '|'));
    S.evt.prises = garder(S.evt.prises, k => k !== p && !k.startsWith(p + '|'));
    if (S.gardes) delete S.gardes[p];
    if (S.favoris) delete S.favoris[p];
    S.illu = garder(S.illu, pas(p + '|'));
    S.tirages = S.tirages.filter(t => t.user_id !== p); S.recyclages = S.recyclages.filter(t => t.user_id !== p);
    if (S.cb) delete S.cb[p];
    if (S.histo) delete S.histo[p];
    S.maitrises[p] = {};
    ch.epreuves = garder(ch.epreuves, pas(p + '|')); ch.gagnees = garder(ch.gagnees, pas(p + '|')); delete ch.joueurs[p];
    r.part = garder(r.part, k => k.split('|')[1] !== p); r.pris = garder(r.pris, k => k.split('|')[1] !== p);
    r.tentatives = garder(r.tentatives, pas(p + '|'));
  }
  RPC.labo_sauver = p => {
    estAdmin(p);
    S.labo = S.labo || {};
    S.labo[p] = { le: now(), contenu: laboCompte(p) };
    return laboEtat(p);
  };
  RPC.labo_restaurer = p => {
    estAdmin(p);
    const sv = (S.labo || {})[p];
    if (!sv) refuser('Aucune sauvegarde.');
    const c = JSON.parse(JSON.stringify(sv.contenu)), r = raidDe(), ch = chocDe();
    laboEffacer(p);
    const pr = profil(p);
    ['shards', 'fragments', 'tickets', 'last_tick', 'trade_free_at', 'boosters_bonus', 'tickets_offerts', 'packs_opened',
     'trades_done', 'streak', 'last_checkin', 'serie_max', 'fabrications', 'avatar', 'frame', 'titre', 'banniere',
     'devise', 'vitrine', 'garder', 'fetiche'].forEach(k => { if (k in c.profil) pr[k] = c.profil[k]; });
    S.col[p] = c.col; S.inv[p] = c.inv;
    Object.assign(S.qp, c.qp); Object.assign(S.evt.comptes, c.comptes); Object.assign(S.evt.prises, c.prises);
    S.gardes = S.gardes || {}; S.gardes[p] = c.gardes;
    S.favoris = S.favoris || {}; S.favoris[p] = c.favoris;
    Object.assign(S.illu, c.illu);
    S.tirages.push(...c.tirages); S.recyclages.push(...c.recyclages);
    S.cb = S.cb || {}; S.cb[p] = c.cb;
    if (c.histo) { S.histo = S.histo || {}; S.histo[p] = c.histo; }
    S.maitrises[p] = c.maitrises;
    Object.assign(ch.epreuves, c.epreuves); Object.assign(ch.gagnees, c.gagnees);
    if (c.choc) ch.joueurs[p] = c.choc;
    Object.assign(r.part, c.raidPart); Object.assign(r.pris, c.raidPris); Object.assign(r.tentatives, c.tentatives);
    return me(p);
  };
  RPC.labo_raz_moi = p => {
    estAdmin(p);
    S.trades.filter(x => x.status === 'pending' && (x.from_user === p || x.to_user === p))
      .forEach(x => { x.status = 'cancelled'; x.resolved_at = now(); });
    laboEffacer(p);
    Object.assign(profil(p), { shards: 0, fragments: 0, tickets: cfg('ticket_cap'), last_tick: now(), trade_free_at: now(),
      boosters_bonus: 0, tickets_offerts: 0, packs_opened: 0, trades_done: 0, streak: 0, last_checkin: null,
      serie_max: 0, fabrications: 0, avatar: 'star', frame: 'default', titre: null, banniere: null, devise: null,
      vitrine: [], garder: {}, fetiche: null });
    return me(p);
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
  const BOTS_DEMO = [
    { id: 'b_lumen', pseudo: 'Lumen',   frame: 'f_or',     paquets: 70,  jours: 34, serie: 12, ami: true },
    { id: 'b_mira',  pseudo: 'Mira',    frame: 'f_rose',   paquets: 32,  jours: 18, serie: 5,  ami: true },
    { id: 'b_kairo', pseudo: 'Kairo',   frame: 'f_azur',   paquets: 24,  jours: 9,  serie: 3,  ami: false },
    { id: 'b_nova',  pseudo: 'Nova.92', frame: 'f_prisme', paquets: 150, jours: 40, serie: 40, ami: false }
  ];
  /* La démo de Gentle Mates (M8) : les mêmes quatre, et huit autres joueurs
     que l'on croise dans les classements, l'événement et le Raid — de quoi
     montrer un serveur d'une dizaine de joueurs actifs, celui pour lequel le
     Raid est réglé. Chacun a un profil complet (avatar, cadre, titre,
     devise, fond, vitrine), une Section, des Étincelles, des combats, et
     certains montrent un deck, construit par l'assistant de l'atelier
     (Decks.assistant). Les pseudos sont inventés. `niv` : le niveau de
     combattant ; `stats` : victoires, défaites en solo, victoires et
     défaites entre amis, série, record ; `faits` : combats de campagne
     gagnés ; `raid` : dégâts au boss (le raid en est à sa phase 3 à la
     première visite) ; `deck` : [nom, couleur, style]. Les cadres et titres
     sont ceux qu'ils auraient pu gagner : boutique, Pass du Choc, niveaux. */
  const BOTS_M8 = [
    { id: 'b_lumen', pseudo: 'Lumen', frame: 'f_choc', paquets: 120, jours: 34, serie: 12, ami: true,
      section: 'toxique', etincelles: 580, niv: 15, titre: 't_recrue', devise: 'Toujours un échange d\'avance.',
      stats: [64, 31, 9, 4, 3, 11], faits: 14, raid: 14, deck: ['Rose qui pique', 'rose', 'rapide'] },
    { id: 'b_mira', pseudo: 'Mira', frame: 'f_rose', paquets: 64, jours: 18, serie: 5, ami: true,
      section: 'toxique', etincelles: 310, niv: 8, titre: 't_artisan', devise: 'Plus que trois Légendaires.',
      stats: [21, 18, 2, 3, 0, 4], faits: 6, raid: 9 },
    { id: 'b_kairo', pseudo: 'Kairo', frame: 'f_azur', paquets: 26, jours: 6, serie: 3, ami: false,
      section: 'deter', etincelles: 95, niv: 3, titre: null, devise: 'Nouveau, mais déjà Déter.',
      stats: [8, 9, 0, 1, 1, 3], faits: 3, raid: 4 },
    { id: 'b_nova', pseudo: 'Nova.92', frame: 'f_niv20', paquets: 260, jours: 40, serie: 40, ami: false,
      section: 'deter', etincelles: 640, niv: 24, titre: 't_stratege', devise: 'La campagne en entier, et cent victoires.',
      stats: [118, 40, 22, 9, 6, 17], faits: 20, raid: 18, deck: ['Mauve, sans pitié', 'mauve', 'equilibre'] },
    { id: 'b_sora', pseudo: 'Sora', frame: 'f_prisme', paquets: 190, jours: 38, serie: 21, ami: false,
      section: 'toxique', etincelles: 470, niv: 12, titre: 't_centurion', devise: 'Collectionneuse avant tout.',
      stats: [40, 22, 3, 2, 2, 8], faits: 9, raid: 12, deck: ['Orange en force', 'orange', 'solide'] },
    { id: 'b_pixelle', pseudo: 'Pixelle', frame: 'f_toxique', paquets: 88, jours: 21, serie: 9, ami: false,
      section: 'toxique', etincelles: 360, niv: 10, titre: 't_supporter', devise: 'Toxique jusqu\'au bout.',
      stats: [33, 25, 4, 4, 2, 6], faits: 8, raid: 10 },
    { id: 'b_tiago', pseudo: 'Tiago', frame: 'f_niv10', paquets: 110, jours: 27, serie: 4, ami: false,
      section: 'deter', etincelles: 280, niv: 13, titre: 't_bagarreur', devise: 'Un deck Bleu, et beaucoup de patience.',
      stats: [37, 30, 1, 5, 0, 5], faits: 11, raid: 8, deck: ['Bleu patient', 'bleue', 'solide'] },
    { id: 'b_brume', pseudo: 'Brume', frame: 'f_deter', paquets: 70, jours: 15, serie: 15, ami: false,
      section: 'deter', etincelles: 405, niv: 9, titre: 't_recrue', devise: 'Une Épreuve par jour, sans exception.',
      stats: [26, 14, 0, 0, 4, 7], faits: 7, raid: 9 },
    { id: 'b_orka', pseudo: 'Orka', frame: 'f_or', paquets: 150, jours: 33, serie: 2, ami: false,
      section: 'deter', etincelles: 190, niv: 11, titre: 't_negociant', devise: 'J\'échange mes doublons, demandez.',
      stats: [19, 20, 6, 6, 1, 4], faits: 5, raid: 5 },
    { id: 'b_elio', pseudo: 'Elio', frame: 'default', paquets: 18, jours: 3, serie: 3, ami: false,
      section: 'toxique', etincelles: 60, niv: 2, titre: null, devise: null,
      stats: [3, 4, 0, 0, 0, 2], faits: 2, raid: 2 },
    { id: 'b_saphyr', pseudo: 'Saphyr', frame: 'f_azur', paquets: 130, jours: 30, serie: 30, ami: false,
      section: 'deter', etincelles: 330, niv: 14, titre: 't_fidele', devise: 'Trente jours d\'affilée.',
      stats: [45, 28, 2, 3, 3, 9], faits: 12, raid: 7, deck: ['Azur et Violette', 'violette', 'equilibre'] },
    { id: 'b_vesper', pseudo: 'Vesper', frame: 'f_niv10', paquets: 95, jours: 24, serie: 6, ami: false,
      section: 'toxique', etincelles: 240, niv: 10, titre: 't_bagarreur', devise: 'Classement Arcade : en route.',
      stats: [30, 27, 1, 2, 1, 5], faits: 10, raid: 4 }
  ];
  const BOTS = M8 ? BOTS_M8 : BOTS_DEMO;

  /* La chasse est finie, comme sur le vrai site : la carte unique a été
     tirée — ici par Nova.92, qui porte son cadre. */
  function chasseTerminee() {
    if (M8 || S.chasse.gagnant) return;
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
     première visite en 3.0, à minuit (heure de Paris, comme le conseille
     25_choc.sql : 14 Épreuves) — on arrive à l'Épreuve 5. Les joueurs
     simulés ont rejoint une Section. */
  function monde30() {
    if (S.choc) return;
    chocDe();
    const t = now();
    let j0 = jourParis(t);
    for (let k = 0; k < 4; k++) j0 = hier(j0);
    const debut = minuitDe(j0);
    S.evenement = { titre: CHOC.nom, code: 'choc', debut, fin: minuitDe(plusJours(j0, CHOC_DUREE)), texte: CHOC_TEXTE };
    [['b_lumen', 'toxique', 24], ['b_mira', 'toxique', 15], ['b_kairo', 'deter', 9], ['b_nova', 'deter', 30]]
      .forEach(([id, sec, d]) => {
        if (!S.profils[id]) return;
        const c = cb(id);
        if (!c.section) { c.section = sec; ajouter(id, SEC_PROMO[sec], 1); }
        S.evt.comptes[id + '|choc'] = { solde: d * 2, total: d * 4 + 30 };
      });
  }
  /* Version 3.0.13 : les joueurs simulés ont combattu (leurs chiffres sur
     leur fiche) ; Lumen et Nova.92 montrent un deck, la copie du Starter de
     leur Section. */
  function mondeCombats13() {
    [['b_lumen', 64, 31, 9, 4, 3, 11, 14, true], ['b_mira', 21, 18, 2, 3, 0, 4, 6, false],
     ['b_kairo', 12, 15, 1, 2, 1, 3, 3, false], ['b_nova', 118, 40, 22, 9, 6, 17, 20, true]]
      .forEach(([id, v, d, pv, pd, serie, max, faits, montre]) => {
        if (!S.profils[id]) return;
        const c = cb(id);
        if (c.stats.serie_max) return;
        Object.assign(c.stats, { victoires: v, defaites: d, pvp_v: pv, pvp_d: pd, serie, serie_max: max });
        c.faits = combatsCampagne(c.section || 'toxique').slice(0, faits).map(x => x.id);
        if (montre && c.section && !c.decks.some(x => x.public)) {
          const st = Decks.STARTERS[c.section];
          c.decks.push({ id: 'd' + (++S.seq), nom: id === 'b_nova' ? 'Mauve, sans pitié' : 'Rose qui pique',
            cartes: Object.assign({}, st.cartes), reserve: Object.assign({}, st.reserve), couverture: st.couverture, public: true });
        }
      });
  }
  /* Le Raid permanent (27_raid.sql) : à la première visite, les joueurs
     simulés l'ont déjà frappé — le premier niveau est tombé. */
  /* La saison en cours, déjà entamée par les joueurs simulés : deux phases
     abattues, la troisième en route. */
  function mondeRaid() {
    if (S.raid && S.raid.niveau == null && S.raid.v === 2) return;
    S.raid = null;
    const sa = saisonDemo();
    (M8 ? BOTS.map(b => [b.id, b.raid || 0]) : [['b_lumen', 30], ['b_mira', 22], ['b_kairo', 14], ['b_nova', 36]]).forEach(([id, d]) => {
      if (!S.profils[id]) return;
      const x = partDe(sa, id);
      x.combats += Math.ceil(d / 6);
      x.degats += d;
      x.victoires += Math.floor(d / 12);
      frapperRaid(sa, d);
    });
  }

  /* La démo de Gentle Mates : chaque joueur simulé reçoit son profil
     (BOTS_M8), une fois. */
  function mondeM8() {
    if (S.m8) return;
    S.m8 = 1;
    BOTS.forEach(b => {
      const pr = S.profils[b.id];
      if (!pr) return;
      const inv = invDe(b.id);
      if (b.frame && b.frame !== 'default') { inv[b.frame] = 1; pr.frame = b.frame; }
      if (b.titre) { inv[b.titre] = 1; pr.titre = b.titre; }
      /* Ce qu'il faut pour le titre porté : ses chiffres le disent aussi. */
      if (b.titre === 't_negociant') pr.trades_done = Math.max(pr.trades_done || 0, 25);
      if (b.titre === 't_artisan') pr.fabrications = Math.max(pr.fabrications || 0, 1);
      pr.devise = b.devise || null;
      /* Le fond : sa plus belle carte. */
      const siennes = Object.keys(colDe(b.id)).map(carte).filter(k => k && !k.promo && k.cat !== 'essence' && !k.rev)
        .sort((x, y) => RAR[y.rar].rank - RAR[x.rar].rank);
      pr.banniere = siennes.length && b.niv >= 8 ? siennes[0].id : null;
      const c = cb(b.id);
      if (!c.section) { c.section = b.section; ajouter(b.id, SEC_PROMO[b.section], 1); }
      let xp = 0;
      for (let n = 1; n < (b.niv || 1); n++) xp += xpRequis(n);
      c.xp = xp;
      const [v, d, pv, pd, serie, max] = b.stats;
      Object.assign(c.stats, { victoires: v, defaites: d, pvp_v: pv, pvp_d: pd, serie, serie_max: max });
      c.faits = combatsCampagne(b.section).slice(0, b.faits).map(x => x.id);
      c.finie = b.faits >= combatsCampagne(b.section).length;
      S.evt.comptes[b.id + '|choc'] = { solde: Math.round(b.etincelles / 3), total: b.etincelles };
      c.decks = c.decks.filter(x => !x.public);
      if (b.deck) {
        /* Un deck tiré dans sa couleur (Decks.aleatoire, niveau 4 : des
           cartes plutôt rares), la même graine à chaque fois. L'assistant de
           deck qui le construisait a été retiré en 3.0.15. */
        const [nom, coul] = b.deck;
        let g = 0;
        for (const ch of b.id + coul) g = (g * 31 + ch.charCodeAt(0)) >>> 0;
        const rand = () => ((g = (g * 1664525 + 1013904223) >>> 0) / 4294967296);
        const x = Decks.aleatoire(rand, { couleurs: [coul], niveau: 4, nom });
        c.decks.push({ id: 'd' + (++S.seq), nom, cartes: x.cartes, reserve: x.reserve, couverture: x.couverture, public: true });
      }
    });
  }

  function creerMonde() {
    const t0 = now();
    S = { v: 1, seq: 0, debut: t0, profils: {}, col: {}, inv: {}, qp: {}, amities: [], trades: [],
      notifs: [], annonces: [], recyclages: [], prochaineOffre: t0 + (M8 ? 50000 : 75000), kairo: t0 + (M8 ? 20000 : 25000),
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
      titre: M8 ? 'Bienvenue sur Mate TCG Online' : 'Bienvenue dans la démo',
      texte: M8
        ? 'Le Choc des Sections est en cours : choisis ta Section dans Combats, et l\'arène t\'attend. '
          + 'Lumen et Mira sont déjà tes amis : leur collection est dans Social, avec leurs doublons à échanger.'
        : 'Tout se passe sur cet appareil : ta collection, tes Éclats et tes quêtes y sont '
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
  const SEC_PROMO = { toxique: 'p04', deter: 'p03' };
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
      jour: null, recompensees: 0, stats: { victoires: 0, defaites: 0, pvp_v: 0, pvp_d: 0, serie: 0, serie_max: 0 }, ouverts: {}, defis_jour: null, defis_rec: 0 });
  };
  /* combat_serie (23_combats.sql, 3.0.13) : une victoire allonge la série,
     une défaite (ou un combat abandonné) la remet à zéro ; la meilleure reste. */
  const serieDe = (c, gagne) => {
    c.stats.serie = gagne ? (c.stats.serie || 0) + 1 : 0;
    c.stats.serie_max = Math.max(c.stats.serie_max || 0, c.stats.serie);
  };
  /* combat_public (23_combats.sql) : ce que la fiche d'un joueur montre de
     ses combats ; null s'il n'a jamais combattu. */
  function combatPublic(u) {
    const c = S.cb && S.cb[u];
    if (!c) return null;
    return {
      section: c.section, stats: Object.assign({ serie: 0, serie_max: 0 }, c.stats), campagne: (c.faits || []).length,
      decks: c.decks.filter(d => d.public).slice().reverse()
        .map(d => ({ id: d.id, nom: d.nom, cartes: Object.assign({}, d.cartes), reserve: Object.assign({}, d.reserve), couverture: d.couverture || null }))
    };
  }
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
      if (!estCosmetiqueCombat(r[k], k)) refuser('Cet objet ne se pose pas là.');
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
    const avant = c.decks.find(x => x.id === id);
    /* Le drapeau public (3.0.13) : sans la clé, le deck garde son état ; un
       deck qui n'est plus complet n'est plus public. */
    const propre = { id, nom, cartes: Object.assign({}, d.cartes), reserve: Object.assign({}, d.reserve || {}), couverture: d.couverture || null,
      public: 'public' in d ? !!d.public : !!(avant && avant.public) };
    if (propre.public && Decks.verifier({ cartes: propre.cartes, reserve: propre.reserve }, colDe(p)).length) propre.public = false;
    c.decks = c.decks.filter(x => x.id !== id).concat([propre]);
    if (!c.deck_actif) c.deck_actif = id;
    if (Decks.total(propre.cartes) === Combat.REGLE.CLUB) bump(p, 'deck', 1);
    return me(p);
  };
  /* deck_publier (3.0.13) : montrer un deck sur son profil et sa fiche, ou
     le reprendre ; seul un deck complet se montre. */
  RPC.deck_publier = (p, { p_id, p_public }) => {
    const d = cb(p).decks.find(x => x.id === p_id);
    if (!d) refuser('Deck introuvable.');
    if (p_public && Decks.verifier({ cartes: d.cartes, reserve: d.reserve }, colDe(p)).length) refuser('Seul un deck complet se montre : 40 cartes et 10 Essences.');
    d.public = !!p_public;
    return me(p);
  };
  RPC.deck_supprimer = (p, { p_id }) => {
    const c = cb(p);
    c.decks = c.decks.filter(x => x.id !== p_id);
    if (c.deck_actif === p_id) c.deck_actif = null;
    return me(p);
  };

  /* combat_debut : le serveur ouvre un combat, tire la graine et note le
     deck (3.0.14 : il rend aussi ce qui fait la partie — la page la bâtit
     avec, Verif.partie —, et la rejouera, RPC.combat_verifier). */
  RPC.combat_debut = (p, { p_mode, p_cle, p_niveau, p_deck }) => {
    const c = cb(p);
    if (!c.section) refuser('Rejoins d\'abord une Section.');
    if (!['campagne', 'infini', 'raid', 'epreuve'].includes(p_mode)) refuser('Mode inconnu.');
    const deck = p_mode === 'epreuve' ? null : p_deck;
    if (p_mode !== 'epreuve') {
      if (!deck) refuser('Choisis un deck.');
      if (!Array.isArray(deck.club) || deck.club.length !== Combat.REGLE.CLUB || !Array.isArray(deck.reserve)) refuser('Deck invalide.');
    }
    /* Version 3.0 : le Raid et l'Épreuve du jour (25_choc.sql). */
    let niveau = p_niveau, phase = null, graine = Math.floor(Math.random() * 4294967295) + 1, boss = null, nJour = null;
    const auj = jourParis(now());
    if (p_mode === 'raid') {
      /* Le Raid (27_raid.sql) : la phase en cours, ou son palier Infini ;
         trois tentatives par jour. */
      const r = raidDe();
      const sa = saisonDemo();
      const ph = phaseDemo(sa);
      const attendu = cleRaid(ph);
      if (String(p_cle) !== attendu) refuser('Le Raid a changé : recharge la page.');
      const k = p + '|' + auj;
      if ((r.tentatives[k] || 0) >= RAID.tentatives) refuser('Plus de tentative aujourd\'hui : reviens demain.');
      r.tentatives[k] = (r.tentatives[k] || 0) + 1;
      partDe(sa, p).combats++;
      phase = ph <= RAID.phases.length ? ph : null;
      niveau = raidCombat(attendu).ia;
      boss = raidSaison(auj, raidAncre()).boss;
    } else if (p_mode === 'epreuve') {
      if (evenementEnCours() !== 'choc') refuser('L\'événement est terminé.');
      const ch = chocDe();
      if (p_cle !== auj) refuser('L\'Épreuve a changé : recharge la page.');
      const l = (ch.epreuves[p + '|' + auj] = ch.epreuves[p + '|' + auj] || []);
      if (l.length >= CHOC.epreuve.essais) refuser('Épreuve terminée : une nouvelle demain.');
      l.push({ gagne: false, tours: 0, pv: 0, touches: 0, abandon: true });
      niveau = CHOC.epreuve.ia;
      graine = graineEpreuve(auj);
      nJour = ecartJours(jourParis(S.evenement.debut), auj) + 1;
    } else if (p_mode === 'campagne') {
      const l = combatsCampagne(c.section);
      const f = l.find(x => x.id === p_cle);
      if (!f) refuser('Combat inconnu.');
      if (f.n > 0 && !c.faits.includes(l[f.n - 1].id) && !c.faits.includes(f.id)) refuser('Gagne d\'abord le combat précédent.');
    } else if (!(p_niveau >= 1 && p_niveau <= 5)) refuser('Difficulté inconnue.');
    const id = 'cb' + (++S.seq);
    c.ouverts = c.ouverts || {};
    /* Un seul combat ouvert à la fois : le précédent est abandonné. Version
       3.0.14 (combat_debut, 23_combats.sql) : seul un combat de Raid laissé
       compte comme perdu — au Raid seulement (sa tentative est prise) ;
       depuis la 3.0.16, ni dans le bilan ni dans la série. */
    Object.keys(c.ouverts).forEach(k => { delete c.ouverts[k]; });
    if (p_mode === 'campagne') niveau = combatsCampagne(c.section).find(x => x.id === p_cle).niveau;
    c.ouverts[id] = { mode: p_mode, cle: p_cle, niveau, phase, jour: auj, debut: now(), graine, deck, section: c.section, boss, n: nJour };
    return { id, graine, mode: p_mode, cle: p_cle, niveau, jour: auj, section: c.section, boss, n: nJour };
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

  /* combat_payer (23_combats.sql) : ce que rapporte un combat, une fois
     vérifié. `v` : le verdict du serveur (Verif.rejouer) ; `histo` : le
     déroulé qu'il a écrit. */
  function payerCombat(p, o, v, histo) {
    const c = cb(p);
    const p_gagne = !!v.gagne, p_resume = Object.assign({}, v, { histo });
    const auj = jourParis(now());
    if (c.jour !== auj) { c.jour = auj; c.recompensees = 0; }
    const r = { eclats: 0, boosters: 0, fragments: 0, carte: null, titre: null, message: '' };
    const res = p_resume || {};
    const trop = now() - o.debut < CB_MIN_MS;
    /* Un abandon (3.0.14, combat_fin) : aucune quête ; en solo, il ne compte
       pas du tout ; au Raid, comme une défaite. */
    const abandon = !!res.abandon && !p_gagne;
    historiqueAjouter(p, o.mode, o.cle, o.niveau, !!p_gagne, res.histo);
    if (abandon && o.mode !== 'raid') return { etat: me(p), recompense: Object.assign(r, { message: 'Combat abandonné : il ne compte pas.' }) };
    if (!abandon) bump(p, 'combats', 1);
    if (!trop) r.xp = gagnerXp(p, xpCombat(o.mode, o.niveau, !!p_gagne, +res.vaincus || 0, +res.tours || 0));
    /* Le Raid hors du bilan et de la série (3.0.16, le propriétaire : « pas
       niquer le ratio W-L des joueurs ») : il a ses propres comptes. */
    if (o.mode !== 'raid') serieDe(c, !!p_gagne);
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
  }

  /* La fonction du serveur qui vérifie les combats
     (supabase/functions/combat-verifier, 3.0.14), et ce qu'elle appelle :
     combat_a_verifier, combat_fin_verifie, combat_refuse, defi_a_verifier,
     defi_fin_verifie. La démo a le moteur : elle rejoue la partie d'un coup
     (le vrai serveur, limité à 2 s de calcul par appel, le fait en passes). */
  RPC.combat_verifier = (p, corps) => {
    if (corps && corps.defi) return verifierDefi(p, String(corps.defi));
    const c = cb(p);
    const id = corps && corps.id;
    const o = (c.ouverts || {})[id];
    if (!o) refuser('Ce combat n\'est plus ouvert.');
    const r = Verif.rejouer(o, corps.journal, { meta: corps.meta || {} });
    delete c.ouverts[id];
    if (r.etat !== 'fini') {
      const l = (S.combats_refuses = S.combats_refuses || []);
      l.unshift({ le: iso(now()), joueur: profil(p).pseudo, mode: o.mode, cle: o.cle, raison: r.raison, coup: r.k });
      l.splice(50);
      return { recompense: { message: 'Ce combat n\'a pas pu être vérifié par le serveur : il ne rapporte rien.' }, refuse: true };
    }
    const x = payerCombat(p, o, r.verdict, r.histo);
    return { recompense: x.recompense, verdict: r.verdict };
  };

  /* ---------- l'historique des combats (version 3.0.12) ---------- */
  /* historique_ajouter, combats_historique, combat_historique (23_combats.sql) :
     les trente derniers combats, avec leur déroulé. */
  const histoDe = p => ((S.histo = S.histo || {})[p] = S.histo[p] || []);
  function historiqueAjouter(p, mode, cle, niveau, gagne, x, adv) {
    if (!x || typeof x !== 'object') return;
    let j = x.journal;
    if (!j || typeof j !== 'object' || !Array.isArray(j.tours) || JSON.stringify(j).length > 30000) j = null;
    const a = adv || x.adversaire || {};
    const borne = (v, m) => Math.min(m, Math.max(0, +v || 0));
    const l = histoDe(p);
    l.unshift({
      id: ++S.seq, le: iso(now()), mode, cle: String(cle || '').slice(0, 40), niveau, gagne: !!gagne,
      titre: String(x.titre || '').slice(0, 60) || null,
      adversaire: { nom: String(a.nom || '').slice(0, 40), avatar: String(a.avatar || 'star').slice(0, 40), frame: String(a.frame || 'default').slice(0, 40), photo: a.photo || null },
      raison: ['pv', 'club', 'abandon'].includes(x.raison) ? x.raison : null,
      tours: borne(x.tours, 999), pv: borne(x.pv, 99), pv_adv: borne(x.pv_adv, 99),
      deck: x.deck ? String(x.deck).slice(0, 32) : null, journal: j
    });
    l.splice(30);
  }
  RPC.combats_historique = p => histoDe(p).map(x => Object.assign({}, x, { journal: !!x.journal }));
  RPC.combat_historique = (p, { p_id }) => {
    const x = histoDe(p).find(y => y.id === +p_id);
    if (!x) refuser('Combat introuvable.');
    return JSON.parse(JSON.stringify(x));
  };

  /* ---------- les défis entre amis ---------- */
  const defisDe = () => (S.defis = S.defis || []);
  /* La partie d'un défi, pour le moteur (qui commence : pile ou face, avec la graine). */
  const initDefi = d => ({ decks: [d.deck_de, d.deck_pour], noms: [profil(d.de).pseudo, profil(d.pour).pseudo], graine: d.graine });
  const vueDefi = (d, p, depuis) => {
    const moi = d.de === p ? 0 : 1;
    const o = profil(moi === 0 ? d.pour : d.de);
    return {
      id: d.id, statut: d.statut, moi,
      init: d.statut === 'attente' ? null : initDefi(d),
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
    const E = Combat.rejouer(initDefi(d), d.actions);
    let n = 0;
    d.auteurs = d.auteurs || [];
    while (Combat.demande(E) && Combat.demande(E).qui === bot && n++ < 80) {
      const a = IA.choisir(E, { niveau: 3 });
      Combat.agir(E, a);
      d.actions.push(a);
      d.auteurs.push(bot);
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
    /* Qui a envoyé le coup (3.0.14, defi_jouer) : le serveur rejoue le défi
       et sait qui a joué hors de son tour. */
    (d.auteurs = d.auteurs || []).push(d.de === p ? 0 : 1);
    d.maj = now();
    return { n: d.actions.length };
  };
  /* La fin d'un défi (3.0.14, defi_a_verifier et defi_fin_verifie) : le
     serveur rejoue les coups et leurs auteurs (Verif.defi) ; un coup envoyé
     hors de son tour, ou refusé par les règles, fait perdre son auteur. */
  function verifierDefi(p, p_id) {
    const d = defisDe().find(x => x.id === p_id && (x.pour === p || x.de === p));
    if (!d) refuser('Défi introuvable.');
    const moi = d.de === p ? 0 : 1;
    const v = Verif.defi({ decks: [d.deck_de, d.deck_pour], graine: d.graine, actions: d.actions, auteurs: d.auteurs || [] },
      { moi, meta: { titre: 'Défi entre amis' } });
    if (!v.fini) refuser('Le défi n\'est pas fini.');
    if (d.statut === 'en_cours') d.statut = 'fini';
    const p_histo = v.histo;
    const E = { tour: v.tours, fin: { gagnant: v.gagnant } };
    const c = cb(p);
    const r = { eclats: 0, message: '' };
    d.payes = d.payes || {};
    if (!d.payes[p]) {
      d.payes[p] = true;
      const auj = jourParis(now());
      if (c.defis_jour !== auj) { c.defis_jour = auj; c.defis_rec = 0; }
      const gagne = E.fin.gagnant === moi;
      c.stats[gagne ? 'pvp_v' : 'pvp_d']++;
      serieDe(c, gagne);
      const o = profil(moi === 0 ? d.pour : d.de);
      historiqueAjouter(p, 'defi', d.id, 0, gagne, p_histo, { nom: o.pseudo, avatar: o.avatar, frame: o.frame, photo: null });
      /* Un défi abandonné (3.0.14, defi_fin) : aucune quête. Un coup refusé
         vaut un abandon de son auteur. */
      const abandon = d.actions.some(a => a && a.t === 'abandon') || v.fautif != null;
      if (!abandon) { bump(p, 'defis', 1); bump(p, 'combats', 1); if (gagne) bump(p, 'victoires', 1); }
      r.xp = gagnerXp(p, xpCombat('defi', 0, gagne, 0, E.tour));
      if (c.defis_rec < DEFI_GAIN.plafond) { c.defis_rec++; r.eclats = gagne ? DEFI_GAIN.victoire : DEFI_GAIN.defaite; profil(p).shards += r.eclats; }
      else r.message = 'Défis récompensés du jour atteints.';
    }
    /* Comme defi_fin_verifie : la récompense, et le verdict du serveur. */
    return { recompense: r, verdict: { gagnant: v.gagnant, tours: v.tours, fautif: v.fautif, raison: v.raison } };
  }

  /* ================================== version 3.0, 25_choc.sql */
  /* Le Choc des Sections : l'Épreuve du jour (la même graine pour tous), et
     ce que le Raid y ajoute (des Étincelles, le récap). Les chiffres viennent
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
  /* Le Raid (27_raid.sql) : par saisons de deux semaines, six phases
     abattues par les dégâts de tout le serveur, un coffre commun par phase
     pour ceux qui ont combattu dans la saison, des paliers personnels, puis
     le mode Infini. */
  const raidDe = () => {
    /* L'ancien Raid par niveaux (pré-build 3.0.5), et les raids comptés
       depuis le 12 octobre (avant la 3.0.11, `v` absent) : on repart de zéro. */
    if (S.raid && (S.raid.niveau != null || S.raid.v !== 2)) S.raid = null;
    return (S.raid = S.raid || { v: 2, saisons: {}, tombees: {}, part: {}, pris: {}, tentatives: {} });
  };
  /* Le premier jour du raid 1 (raid_ancre, 27_raid.sql) : celui où commence
     le Choc des Sections ; sans lui, RAID.saison.depart. */
  const raidAncre = () => (S.evenement && S.evenement.code === 'choc' ? jourParis(S.evenement.debut) : RAID.saison.depart);
  const saisonDemo = () => raidSaison(jourParis(now()), raidAncre()).n;
  /* Les paliers, à l'échelle du serveur (peu de joueurs dans la démo :
     _demo/reglages.js). */
  /* L'échelle : celle du Labo (parametres.raid_echelle), sinon celle des réglages. */
  const echelleRaid = () => (S.parametres && S.parametres.raid_echelle) || D.raid_echelle || 1;
  /* raid_seuil(k, s) : le seuil de la phase k du raid sa, à l'échelle et à la
     vie de son boss (RAID.bosses › vie, version 3.0.14). */
  /* Au-delà de 6 (3.0.15) : le palier Infini k − 6, commun à tout le
     serveur, RAID.infiniPas dégâts plus loin que le précédent. */
  /* Lu à l'appel : RAID (js/combat/choc-data.js) arrive après ce fichier. */
  const nph = () => RAID.phases.length;
  const seuilBrut = k => (k <= nph() ? RAID.phases[k - 1].seuil : RAID.phases[nph() - 1].seuil + (k - nph()) * RAID.infiniPas);
  const seuilDemo = (k, sa) => Math.max(10, Math.round(seuilBrut(k) * (raidBoss(sa).vie || 1) * echelleRaid()));
  const degatsSaison = sa => (raidDe().saisons[sa] || 0);
  function phaseDemo(sa) {
    let k = 1;
    while (k <= 1000 && degatsSaison(sa) >= seuilDemo(k, sa)) k++;
    return k;
  }
  /* La clé du combat en cours : la phase, ou le palier Infini (commun). */
  const cleRaid = ph => (ph <= nph() ? 'p' + ph : 'i' + (ph - nph()));
  const partDe = (sa, p) => (raidDe().part[sa + '|' + p] = raidDe().part[sa + '|' + p]
    || { combats: 0, degats: 0, victoires: 0 });

  /* Des dégâts sur la saison : renvoie la phase avant et après. */
  function frapperRaid(sa, d) {
    const r = raidDe();
    const avant = phaseDemo(sa);
    r.saisons[sa] = degatsSaison(sa) + d;
    const apres = phaseDemo(sa);
    for (let k = avant; k < apres; k++) r.tombees[sa + '|' + k] = now();
    return { avant, apres };
  }

  /* raid_fin : pendant le Choc, des Étincelles ; le reste du temps, des Éclats. */
  function finRaid(p, c, o, gagne, res, trop, r) {
    /* Hors du bilan victoires-défaites (3.0.16) ; les quêtes, si. */
    if (gagne) { bump(p, 'victoires', 1); bump(p, 'vaincus', Math.min(20, Math.max(0, +res.vaincus || 0))); }
    if (o.niveau >= 4 && gagne) bump(p, 'victoires_dures', 1);
    if (!res.abandon) bump(p, 'raid', 1);
    if (trop) { r.message = 'Combat trop court pour compter.'; return { etat: me(p), recompense: r }; }
    const x = raidCombat(o.cle);
    let d = Math.max(0, Math.min(x.pvBoss + 1, Math.floor(+res.touches || 0)));
    if (gagne) d = x.pvBoss + 1 + RAID.bonusDegats;
    r.degats = d;
    const sa = saisonDemo();
    const moi = partDe(sa, p);
    moi.degats += d;
    if (gagne) moi.victoires++;
    r.message = '';
    /* Phases et paliers Infini : les dégâts de tous (3.0.15). */
    const { avant, apres } = frapperRaid(sa, d);
    if (apres > avant) {
      r.message = apres - 1 === nph() ? 'Les six phases sont abattues : l\'Infini commence, tous ensemble.'
        : apres - 1 > nph() ? `Palier Infini ${apres - 1 - nph()} abattu : un coffre pour tous ceux qui ont combattu.`
        : `Phase ${apres - 1} abattue : un coffre commun pour tous ceux qui ont combattu.`;
    }
    if (!d && !r.message) r.message = 'Pas un PV de pris : il rira moins la prochaine fois.';
    if (!res.abandon) { bump(p, 'raid_degats', d); if (gagne) bump(p, 'raid_victoires', 1); }
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

  /* Un raid vu par un joueur (raid_vue_saison) : son boss, ses dates. */
  function vueSaison(p, sa) {
    const r = raidDe();
    const x = r.part[sa + '|' + p];
    const a = Date.parse(raidAncre() + 'T12:00:00Z');
    const jourDe = k => new Date(a + k * RAID.saison.jours * 86400000).toISOString().slice(0, 10);
    const moi = x || { combats: 0, degats: 0, victoires: 0 };
    const ph = phaseDemo(sa);
    const infini = [];
    for (let k = nph() + 1; k < ph; k++) infini.push({ n: k - nph(), seuil: seuilDemo(k, sa), pris: !!r.pris[sa + '|' + p + '|commun|' + k] });
    return {
      n: sa, boss: raidBoss(sa).id, debut: jourDe(sa - 1), fin: jourDe(sa), degats: degatsSaison(sa), phase: ph,
      depuis: ph > 1 ? seuilDemo(ph - 1, sa) : 0, cible: seuilDemo(ph, sa),
      infini: { coffre: RAID.infiniCoffre, paliers: infini },
      phases: RAID.phases.map((ph, i) => Object.assign({}, ph, {
        n: i + 1, seuil: seuilDemo(i + 1, sa), tombee: degatsSaison(sa) >= seuilDemo(i + 1, sa), pris: !!r.pris[sa + '|' + p + '|commun|' + (i + 1)] })),
      moi: { participe: !!x, combats: moi.combats, degats: moi.degats, victoires: moi.victoires,
        perso: RAID.perso.map((pa, i) => Object.assign({}, pa, { n: i + 1, pris: !!r.pris[sa + '|' + p + '|perso|' + (i + 1)] })) }
    };
  }

  RPC.raid_etat = p => {
    const r = raidDe();
    const auj = jourParis(now());
    const sa = saisonDemo();
    const prec = vueSaison(p, sa - 1);
    const parts = Object.entries(r.part).filter(([k]) => k.startsWith(sa + '|')).map(([k, x]) => [k.split('|')[1], x]);
    return Object.assign(vueSaison(p, sa), {
      jour: auj,
      joueurs: parts.filter(([, x]) => x.combats > 0).length,
      evenement: evenementEnCours() === 'choc',
      tentatives: r.tentatives[p + '|' + auj] || 0, max: RAID.tentatives,
      precedente: prec.moi.participe ? prec : null,
      top: parts.filter(([, x]) => x.degats > 0).sort((a, b) => b[1].degats - a[1].degats).slice(0, 10)
        .map(([id, x]) => joueurVue(id, { degats: x.degats, moi: id === p })),
      /* Son rang aux dégâts (3.0.15). */
      rang: 1 + parts.filter(([, x]) => x.degats > ((r.part[sa + '|' + p] || {}).degats || 0)).length
    });
  };

  RPC.raid_reclamer = (p, { p_saison, p_quoi, p_n }) => {
    const r = raidDe();
    const sa = saisonDemo();
    const s = +p_saison, n = +p_n;
    if (s !== sa && s !== sa - 1) refuser('Ce raid est terminé.');
    const x = r.part[s + '|' + p];
    if (!x || x.combats < 1) refuser('Tu n\'as pas combattu dans ce raid.');
    let c;
    if (p_quoi === 'commun') {
      /* 1 à 6 : une phase ; au-delà, un palier Infini (n − 6), commun aussi. */
      if (!(n >= 1 && n <= 1000)) refuser('Phase inconnue.');
      if (phaseDemo(s) <= n) refuser('Cette phase n\'est pas encore abattue.');
      c = n <= nph() ? RAID.phases[n - 1].commun : RAID.infiniCoffre;
    } else if (p_quoi === 'perso') {
      if (!(n >= 1 && n <= RAID.perso.length)) refuser('Palier inconnu.');
      c = RAID.perso[n - 1];
      if (x.degats < c.seuil) refuser('Palier pas encore atteint.');
    } else refuser('Coffre inconnu.');
    const k = s + '|' + p + '|' + p_quoi + '|' + n;
    if (r.pris[k]) refuser('Coffre déjà ouvert.');
    r.pris[k] = now();
    /* Version 3.0.14 : un objet, et un second présent (le titre du dernier coffre). */
    const cartes = accorder(p, c.type, c.montant || 0, c.objet || null);
    if (c.bonus) cartes.push(...accorder(p, c.bonus.type, c.bonus.montant || 0, c.bonus.objet || null));
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
    /* Le n-ième jour de l'événement, sur `jours` (choc_etat, 3.0.11). */
    const e = S.evenement;
    const d0 = jourParis(e.debut);
    return {
      jour: auj, n: ecartJours(d0, auj) + 1, jours: ecartJours(d0, jourParis(e.fin - 1)) + 1,
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
      raid_phases: Object.values(raidDe().tombees).filter(t => t >= (e.debut || 0) && t < (e.fin || Infinity)).length,
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
       le Choc, ils tentent aussi l'Épreuve et gagnent des Étincelles. */
    S.raidTic = S.raidTic || t;
    if (t - S.raidTic > 30000) {
      S.raidTic = t;
      const bot = choix(BOTS);
      if (S.profils[bot.id]) {
        const sa = saisonDemo();
        const ph = phaseDemo(sa);
        const part = partDe(sa, bot.id);
        const x = raidCombat(cleRaid(ph));
        const gagne = Math.random() < (x.infini ? 0.25 : 0.35);
        const d = gagne ? x.pvBoss + 1 + RAID.bonusDegats : entre(2, x.pvBoss);
        part.combats++;
        part.degats += d;
        if (gagne) part.victoires++;
        frapperRaid(sa, d);
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
    if (c.section && !S.defiOffert && t - (S.debut || t) > (M8 ? 2 : 4) * 60000) {
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
    /* Version 3.0.7 : la maîtrise des cartes. */
    S.maitrises = S.maitrises || {};
    S.chasse = S.chasse || { carte: 'u01', active: true, gagnant: null, trouvee_le: null };
    chasseTerminee();
    monde20();
    monde30();
    /* Version 3.0.13 : un Choc de trois semaines (une partie de démo
       d'avant) passe à deux, sans changer son début ; son texte aussi. */
    const ev = S.evenement;
    if (ev && ev.code === 'choc' && ev.fin - ev.debut > (CHOC_DUREE + 1) * 86400000) { ev.fin = ev.debut + CHOC_DUREE * 86400000; ev.texte = CHOC_TEXTE; }
    mondeRaid();
    mondeCombats13();
    if (M8) mondeM8();
    /* Version 3.0.13 : les vraies Promos des Sections sont P04 (Squeezie le
       Toxique) pour Toxique et P03 (Brawks Déter) pour Déter, l'inverse des
       provisoires. Une partie de démo d'avant a reçu la Promo de l'autre
       Section en la rejoignant : tant que la campagne n'est pas finie (qui
       donne les deux), elle est échangée contre la bonne. */
    for (const id of Object.keys(S.cb || {})) {
      const c = S.cb[id], col = colDe(id), bonne = SEC_PROMO[c.section], autre = SEC_PROMO[c.section === 'toxique' ? 'deter' : 'toxique'];
      if (!bonne || c.finie || c.promos13 || col[bonne]) continue;
      c.promos13 = true;
      if (col[autre]) { col[autre]--; if (!col[autre]) delete col[autre]; }
      col[bonne] = 1;
    }
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
    /* Les fonctions du serveur (supabase/functions) : celle qui vérifie les
       combats (3.0.14). Même forme de réponse que supabase-js : une erreur
       porte son corps ({ erreur }) dans `context`. */
    functions: {
      async invoke(nom, o) {
        if (nom !== 'combat-verifier') return { data: null, error: { message: 'Fonction inconnue : ' + nom } };
        const r = await appeler('combat_verifier', (o && o.body) || {});
        if (r.error) {
          const m = r.error.message;
          return { data: null, error: { message: m, context: { json: async () => ({ erreur: m }) } } };
        }
        return r;
      }
    },
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
