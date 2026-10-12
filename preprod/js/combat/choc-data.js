/* L'événement de la version 3.0 : « Le Choc des Sections ».

   Trois semaines autour des Combats, en plus de ce qu'un événement apporte
   déjà depuis la 2.0 (une monnaie, des quêtes, un Pass, une boutique, un
   classement — supabase/21_reflets.sql) :

     · le Raid : The French Sorcerer, un boss commun à tous les joueurs.
       Chaque PV qu'on lui prend en combat entame sa barre de vie, partagée
       par tout le serveur. Cinq phases, de plus en plus dures, qui s'ouvrent
       une à une au fil des trois semaines ; chaque phase tombée ouvre une
       récompense à tous ceux qui l'ont frappé ;
     · l'Épreuve du jour : le même combat pour tout le monde — les mêmes deux
       decks imposés, la même donne, une règle du jour. Trois essais, le
       meilleur compte, et un classement du jour ;
     · la Guerre des Sections, doublée : chaque point compte double, et la
       Section qui en marque le plus sur les trois semaines gagne un titre.

   Ce fichier est lu par la page et par le serveur de démo
   (_demo/serveur.js). Le serveur réel en a la copie dans
   supabase/25_choc.sql : les deux doivent rester d'accord. */
"use strict";

const CHOC = {
  code: 'choc',
  nom: 'Le Choc des Sections',
  /* La monnaie de l'événement (evt_comptes, comme les Prismes de Reflets). */
  monnaie: { nom: 'Insignes', un: 'Insigne' },

  raid: {
    /* The French Sorcerer (#116), Légendaire Mauve : ses éclairs renvoient
       les Joueurs sur le Banc et frappent à 200. */
    boss: 'c116',
    nom: 'The French Sorcerer',
    /* Tentatives comptées par jour (heure de Paris). Au-delà, on peut
       rejouer, sans dégâts ni récompense. */
    tentatives: 3,
    /* Une tentative rapporte des Insignes par PV pris au boss, plus un
       bonus s'il tombe ; une victoire marque aussi des points de Section. */
    parDegat: 3,
    bonusVictoire: 15,
    bonusDegats: 3,
    points: 2,
    /* Pour pouvoir réclamer la récompense d'une phase, il faut avoir infligé
       au moins ce nombre de dégâts pendant l'événement. */
    minimum: 1,
    /* `pv` : la barre commune de la phase, en dégâts. Le serveur réel la
       multiplie par un réglage (parametres.raid_echelle) pour s'adapter au
       nombre de joueurs. `ouvre` : le jour de l'événement (0 = le premier)
       où la phase peut commencer, au plus tôt — le Raid dure ainsi les
       trois semaines, même si le serveur frappe fort. `ia`, `pvBoss`, `ess` :
       le combat lui-même. */
    phases: [
      { n: 1, nom: 'Premières étincelles', pv: 400, ouvre: 0, ia: 3, pvBoss: 6, ess: 0,
        texte: 'Il charge l\'air autour de lui. Frappe avant le premier éclair.',
        recompense: { type: 'boosters', montant: 2, titre: '2 boosters' } },
      { n: 2, nom: 'L\'orage gronde', pv: 600, ouvre: 3, ia: 3, pvBoss: 7, ess: 1,
        texte: 'Il a compris. Une Essence d\'avance, et un PV de plus.',
        recompense: { type: 'fragments', montant: 500, titre: '500 Fragments' } },
      { n: 3, nom: 'Foudre de Rage', pv: 900, ouvre: 7, ia: 4, pvBoss: 7, ess: 1,
        texte: 'Il renvoie tes Joueurs sur le Banc : garde des renforts en main.',
        recompense: { type: 'boosters', montant: 3, titre: '3 boosters' } },
      { n: 4, nom: 'Éclairs Vengeurs', pv: 1300, ouvre: 11, ia: 4, pvBoss: 8, ess: 2,
        texte: 'Deux Essences d\'avance. Ses éclairs frappent à 200.',
        recompense: { type: 'brillante', montant: 1, titre: 'Une Essence Brillante' } },
      { n: 5, nom: 'L\'œil du cyclone', pv: 1800, ouvre: 15, ia: 5, pvBoss: 8, ess: 2,
        texte: 'Le calme avant la dernière décharge. Il prévoit ta réponse.',
        recompense: { type: 'cadre', objet: 'f_foudre', titre: 'Cadre « Foudre »' } }
    ],
    /* Une fois les cinq phases tombées, la tempête revient : elle ne
       s'arrête plus, et chaque dégât rapporte toujours des Insignes. */
    rappel: { n: 6, nom: 'La tempête revient', ia: 5, pvBoss: 9, ess: 2,
      texte: 'Il est tombé. La tempête revient, encore et encore : chaque dégât compte toujours pour le classement.' }
  },

  epreuve: {
    essais: 3,
    /* Chaque essai rapporte `participation` ; la première victoire du jour,
       `victoire` et des points de Section. */
    participation: 5,
    victoire: 25,
    points: 2,
    ia: 3,
    /* Une règle par jour, à tour de rôle. `pv` et `ess` : [toi, l'adversaire]. */
    regles: [
      { id: 'eclair', nom: 'Combat éclair', texte: 'Trois PV chacun : la moindre ouverture est fatale.', pv: [3, 3], ess: [0, 0] },
      { id: 'siege', nom: 'Le siège', texte: 'L\'adversaire a 7 PV. Toi, tu commences avec 2 Essences en jeu.', pv: [5, 7], ess: [2, 0] },
      { id: 'renforts', nom: 'Renforts', texte: 'Les deux camps commencent avec une Essence en jeu.', pv: [5, 5], ess: [1, 1] },
      { id: 'miroir', nom: 'Le miroir', texte: 'Les deux camps jouent le même deck.', pv: [5, 5], ess: [0, 0], miroir: true },
      { id: 'outsider', nom: 'L\'outsider', texte: 'Tu as 4 PV, l\'adversaire 6 et une Essence d\'avance.', pv: [4, 6], ess: [0, 1] },
      { id: 'marathon', nom: 'Marathon', texte: 'Sept PV chacun : une partie longue, où chaque carte compte.', pv: [7, 7], ess: [0, 0] },
      { id: 'classique', nom: 'Classique', texte: 'Les règles normales, rien de plus.', pv: [5, 5], ess: [0, 0] }
    ]
  },

  guerre: {
    /* Pendant l'événement, les points de Section comptent double. */
    multiplicateur: 2,
    /* La Section qui marque le plus sur tout l'événement : un titre pour
       chacun de ses membres qui a marqué au moins un point. */
    titre: 't_choc'
  }
};

/* Le Sorcier joue Mauve (ses attaques en demandent deux), avec une
   seconde couleur qui change chaque jour. */
const CHOC_ALLIES = ['violette', 'azur', 'rose', 'jaune', 'bleue', 'orange', 'verte', 'jade'];
const chocCouleurs = j => ['mauve', CHOC_ALLIES[chocMod(chocJourN(j), CHOC_ALLIES.length)]];

/* Le numéro d'un jour ('2026-10-11' → nombre de jours depuis le 1er janvier
   2026). Le serveur réel fait le même calcul (choc_jour, 25_choc.sql). */
function chocJourN(j) {
  return Math.round((Date.parse(j + 'T12:00:00Z') - Date.parse('2026-01-01T12:00:00Z')) / 86400000);
}
const chocMod = (n, m) => ((n % m) + m) % m;

/* La phase du raid : celle en cours (1 à 5), ou le rappel (6). */
const chocPhase = n => CHOC.raid.phases[n - 1] || CHOC.raid.rappel;

/* Le deck du Sorcier, le jour `j`, à la phase `n` : un deck tiré au sort
   dans ses deux couleurs du jour, avec The French Sorcerer dedans — il
   commence la partie déjà sur le plateau (`posesBoss`). */
function deckSorcier(j, n) {
  const couleurs = chocCouleurs(j);
  const r = aleaGraine(0x3c6ef372 ^ (chocJourN(j) * 31 + n));
  const p = chocPhase(n);
  const d = Decks.aleatoire(r, { niveau: Math.min(5, p.ia + 1), couleurs, nom: CHOC.raid.nom });
  imposerCarte(d, CHOC.raid.boss, 'mauve', r);
  d.couverture = CHOC.raid.boss;
  return d;
}
/* Le Sorcier au milieu de ses trois lignes, dès le début. */
const posesBoss = () => [[], [{ id: CHOC.raid.boss, ligne: 1 }]];

/* La phase la plus avancée que le Raid peut atteindre le jour `k` de
   l'événement (0 = le premier jour) : les phases s'ouvrent une à une. */
const chocPhaseMax = k => CHOC.raid.phases.filter(p => p.ouvre <= k).length;

/* L'Épreuve du jour `j` : sa règle, et les deux decks imposés. La graine
   du jour vient du serveur (choc_etat) ; tout le reste s'en déduit. */
function epreuveDuJour(j, graine) {
  const regle = CHOC.epreuve.regles[chocMod(chocJourN(j), CHOC.epreuve.regles.length)];
  const moi = Decks.aleatoire(aleaGraine(graine ^ 0x1b873593), { niveau: 3, nom: 'Deck imposé' });
  const adv = regle.miroir ? JSON.parse(JSON.stringify(moi))
    : Decks.aleatoire(aleaGraine(graine ^ 0x85ebca6b), { niveau: 3, nom: 'L\'adversaire du jour' });
  adv.nom = 'L\'adversaire du jour';
  return { regle, moi, adv };
}

/* Le score d'un essai, pour comparer : la victoire d'abord ; entre deux
   victoires, le moins de tours puis le plus de PV gardés ; entre deux
   défaites, le plus de PV pris à l'adversaire. Plus grand = meilleur. */
function scoreEpreuve(s) {
  if (!s) return 0;
  const b = x => Math.max(0, Math.min(99, x || 0));
  return s.gagne ? 100000 + (100 - b(s.tours)) * 100 + b(s.pv) : b(s.touches) * 100 + b(s.pv);
}
