/* L'événement de la version 3.0, « Le Choc des Sections », et le Raid.

   Le Raid (RAID) reste toute l'année, dans l'onglet Combats : The French
   Sorcerer, un boss commun à tout le serveur. Une seule barre de vie :
   chaque PV qu'on lui prend en combat l'entame. Quand elle est vide, le
   niveau tombe — chacun de ceux qui l'ont frappé à ce niveau a un coffre —
   et le boss revient au niveau suivant, plus fort. Trois tentatives par
   jour. Pendant le Choc, il paie en Insignes ; le reste du temps, en Éclats.

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
  /* La barre d'un niveau, en dégâts. Le serveur réel la multiplie par un
     réglage (parametres.raid_echelle) pour s'adapter au nombre de joueurs. */
  pv: n => 300 + 150 * (Math.max(1, n) - 1),
  /* Le combat d'un niveau : l'IA, les PV du boss, ses Essences d'avance. */
  combat: n => {
    const k = Math.ceil(Math.max(1, n) / 2);
    return { ia: Math.min(5, 2 + k), pvBoss: Math.min(9, 5 + k), ess: Math.min(2, Math.floor((Math.max(1, n) - 1) / 2)) };
  },
  /* Ce que rapporte un combat : par PV pris, et s'il tombe (+ bonusDegats
     sur la barre). Pendant le Choc, en Insignes ; sinon, en Éclats. */
  parDegat: 3, victoire: 15, bonusDegats: 3,
  parDegatEclats: 4, victoireEclats: 20,
  /* Le coffre d'un niveau tombé, à tour de rôle. */
  coffres: [
    { type: 'boosters', montant: 2, titre: '2 boosters' },
    { type: 'fragments', montant: 300, titre: '300 Fragments' },
    { type: 'boosters', montant: 3, titre: '3 boosters' },
    { type: 'eclats', montant: 400, titre: '400 Éclats' }
  ]
};
const raidCombat = n => RAID.combat(n || 1);
const raidCoffre = n => RAID.coffres[(Math.max(1, n) - 1) % RAID.coffres.length];

const CHOC = {
  code: 'choc',
  nom: 'Le Choc des Sections',
  /* La monnaie de l'événement (evt_comptes, comme les Prismes de Reflets). */
  monnaie: { nom: 'Insignes', un: 'Insigne' },

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

/* Le deck du Sorcier, le jour `j`, au niveau `n` : un deck tiré au sort
   dans ses deux couleurs du jour, avec The French Sorcerer dedans — il
   commence la partie déjà sur le plateau (`posesBoss`). */
function deckSorcier(j, n) {
  const couleurs = chocCouleurs(j);
  const r = aleaGraine(0x3c6ef372 ^ (chocJourN(j) * 31 + n));
  const d = Decks.aleatoire(r, { niveau: Math.min(5, raidCombat(n).ia + 1), couleurs, nom: RAID.nom });
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
