/* Le Raid, et l'événement de la version 3.0, « Le Choc des Sections ».

   Le Raid (RAID) : The French Sorcerer, un boss commun à tout le serveur,
   par saisons de deux semaines. Chaque saison, il a six phases : chaque PV
   que les joueurs lui prennent en combat s'ajoute aux dégâts de tout le
   serveur, et chaque palier de dégâts atteint abat une phase — tous ceux qui
   ont combattu dans la saison ouvrent alors son coffre commun. En plus, des
   paliers personnels (les dégâts de chacun). Une fois les six phases
   abattues (si le serveur y arrive), le mode Infini : un palier par joueur,
   qui monte à chaque victoire, pour le classement. Trois tentatives par
   jour. La saison suivante, tout recommence. Pendant le Choc, il paie en
   Étincelles ; sinon, en Éclats.

   L'événement (CHOC) ajoute l'Épreuve du jour : le même combat pour tout le
   monde — les mêmes deux decks imposés, la même donne, une règle du jour.
   Trois essais, le meilleur compte, et un classement du jour.

   Ce fichier est lu par la page et par le serveur de démo
   (_demo/serveur.js). Le serveur réel en a la copie dans
   supabase/25_choc.sql et 27_raid.sql : ils doivent rester d'accord. */
"use strict";

const RAID = {
  /* The French Sorcerer (#116), Légendaire Mauve : ses éclairs renvoient
     les Joueurs sur le Banc et frappent à 200. */
  boss: 'c116',
  nom: 'The French Sorcerer',
  tentatives: 3,
  /* Une saison dure `jours` jours ; la première a commencé le lundi
     `depart` (raid_saison, 27_raid.sql). */
  saison: { jours: 14, depart: '2026-10-12' },
  /* Les six phases. `seuil` : les dégâts cumulés de tout le serveur dans la
     saison pour l'abattre — calculés pour une dizaine de joueurs, et
     multipliés sur le vrai serveur par parametres.raid_echelle. Puis le
     combat (le niveau de l'IA, les PV du boss, ses Essences d'avance) et le
     coffre commun. */
  phases: [
    { seuil: 120, ia: 2, pv: 5, ess: 0, commun: { type: 'boosters', montant: 2, titre: '2 boosters' } },
    { seuil: 300, ia: 3, pv: 6, ess: 0, commun: { type: 'fragments', montant: 300, titre: '300 Fragments' } },
    { seuil: 550, ia: 3, pv: 7, ess: 1, commun: { type: 'boosters', montant: 3, titre: '3 boosters' } },
    { seuil: 850, ia: 4, pv: 7, ess: 1, commun: { type: 'eclats', montant: 500, titre: '500 Éclats' } },
    { seuil: 1200, ia: 4, pv: 8, ess: 2, commun: { type: 'boosters', montant: 4, titre: '4 boosters' } },
    { seuil: 1600, ia: 5, pv: 9, ess: 2, commun: { type: 'boosters', montant: 5, titre: '5 boosters' } }
  ],
  /* Les paliers personnels de la saison : les dégâts de chacun. */
  perso: [
    { seuil: 30, type: 'boosters', montant: 1, titre: '1 booster' },
    { seuil: 80, type: 'fragments', montant: 300, titre: '300 Fragments' },
    { seuil: 150, type: 'boosters', montant: 2, titre: '2 boosters' }
  ],
  /* Le mode Infini, palier n : le boss a plus de PV et d'Essences, puis c'est
     toi qui as moins de PV. Chaque victoire fait monter d'un palier. */
  infini: n => {
    const k = Math.max(1, n);
    return { ia: 5, pvBoss: Math.min(12, 9 + k), ess: Math.min(3, 2 + Math.floor(k / 3)), pvMoi: Math.max(2, 5 - Math.floor(Math.max(0, k - 3) / 2)) };
  },
  /* Ce que rapporte un combat : par PV pris, et s'il tombe (+ bonusDegats
     dégâts). Pendant le Choc, en Étincelles ; sinon, en Éclats. */
  parDegat: 3, victoire: 15, bonusDegats: 3,
  parDegatEclats: 2, victoireEclats: 15
};

/* Le combat d'une clé : 'p3' (la phase 3) ou 'i5' (l'Infini, palier 5). */
function raidCombat(cle) {
  const s = String(cle || 'p1');
  const n = Math.max(1, parseInt(s.slice(1), 10) || 1);
  if (s[0] === 'i') return Object.assign({ infini: true, n }, RAID.infini(n));
  const ph = RAID.phases[Math.min(n, RAID.phases.length) - 1];
  return { infini: false, n, ia: ph.ia, pvBoss: ph.pv, ess: ph.ess, pvMoi: 5 };
}

/* La saison du jour `j` ('2026-10-20') : son numéro, son premier jour, et le
   premier jour de la suivante. */
function raidSaison(j) {
  const d0 = Date.parse(RAID.saison.depart + 'T12:00:00Z');
  const jn = Math.floor((Date.parse(j + 'T12:00:00Z') - d0) / 86400000);
  const n = Math.floor(jn / RAID.saison.jours) + 1;
  const jour = k => new Date(d0 + k * RAID.saison.jours * 86400000).toISOString().slice(0, 10);
  return { n, debut: jour(n - 1), fin: jour(n) };
}

const CHOC = {
  code: 'choc',
  nom: 'Le Choc des Sections',
  /* La monnaie de l'événement (evt_comptes, comme les Prismes de Reflets). */
  monnaie: { nom: 'Étincelles', un: 'Étincelle' },

  epreuve: {
    essais: 3,
    /* Chaque essai rapporte `participation` ; la première victoire du jour,
       `victoire` en plus. */
    participation: 5,
    victoire: 25,
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

/* Le deck du Sorcier, le jour `j`, pour la clé `cle` (la phase ou le palier
   Infini) : un deck tiré au sort dans ses deux couleurs du jour, avec The
   French Sorcerer dedans — il commence la partie déjà sur le plateau
   (`posesBoss`). */
function deckSorcier(j, cle) {
  const couleurs = chocCouleurs(j);
  const c = raidCombat(cle);
  const r = aleaGraine(0x3c6ef372 ^ (chocJourN(j) * 31 + c.n * (c.infini ? 7 : 1) + (c.infini ? 1000 : 0)));
  const d = Decks.aleatoire(r, { niveau: Math.min(5, c.ia + 1), couleurs, nom: RAID.nom });
  imposerCarte(d, RAID.boss, 'mauve', r);
  d.couverture = RAID.boss;
  return d;
}
/* Le Sorcier au milieu de ses trois lignes, dès le début. */
const posesBoss = () => [[], [{ id: RAID.boss, ligne: 1 }]];

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
