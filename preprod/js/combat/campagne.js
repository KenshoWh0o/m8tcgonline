/* La campagne et les Sections (version 3.0).

   M8 vend deux Starter Decks : Section Toxique et Section Déter. En entrant
   dans les Combats, chacun choisit sa Section, en reçoit la Promo et le
   Starter Deck, puis affronte la Section adverse : vingt combats en quatre
   actes, de plus en plus durs. La finir donne la Promo de l'autre Section.

   Les récompenses sont ici pour l'affichage ; c'est le serveur qui les
   accorde (combat_fin, supabase/23_combats.sql), d'après la même table. Les
   decks adverses sont tirés au sort avec une graine fixe par combat : le
   même combat garde le même adversaire, d'une partie à l'autre. */
"use strict";

const SECTIONS = {
  toxique: {
    id: 'toxique', nom: 'Section Toxique', court: 'Toxique', c: '#62d84e', c2: '#b7f29a',
    promo: 'p03', starter: 'toxique', boite: 'assets/combat/sections/toxique.webp',
    /* Les couleurs de ses adversaires de campagne, quand on affronte cette
       Section. */
    couleurs: ['rose', 'orange', 'verte', 'jaune'],
    devise: 'Engager l\'adversaire, et frapper ce qui est à terre.'
  },
  deter: {
    id: 'deter', nom: 'Section Déter', court: 'Déter', c: '#7c3aed', c2: '#c4b5fd',
    promo: 'p04', starter: 'deter', boite: 'assets/combat/sections/deter.webp',
    couleurs: ['mauve', 'violette', 'bleue', 'azur'],
    devise: 'Des Joueurs qui reviennent toujours, et des coups qui pèsent.'
  }
};
const autreSection = s => (s === 'toxique' ? 'deter' : 'toxique');

/* Les quatre actes. `niveau` : celui de l'IA (1 à 5) ; `regle` : un
   avantage donné à l'adversaire (PV, Essences en jeu au départ). Les
   rivaux sont des Joueurs de la Section adverse : leur carte sert de
   portrait, et elle est toujours dans leur deck. */
const ACTES = [
  { id: 'a1', nom: 'Les qualifs', texte: 'Tout commence ici. Personne ne t\'attend, et c\'est très bien comme ça.' },
  { id: 'a2', nom: 'La phase de groupes', texte: 'Les adversaires se connaissent, et ils ont regardé tes matchs.' },
  { id: 'a3', nom: 'Les playoffs', texte: 'Une défaite et c\'est la porte. Chaque PV compte.' },
  { id: 'a4', nom: 'La grande finale', texte: 'La salle est pleine. La Section adverse a gardé le meilleur pour la fin.' }
];

/* Pour qui joue Déter : les rivaux de la Section Toxique. Et l'inverse. */
const RIVAUX = {
  toxique: [
    ['c011', 'rose'], ['c010', 'rose'], ['c029', 'orange'], ['c013', 'rose'], ['c012', 'rose', 'boss'],
    ['c062', 'verte'], ['c034', 'orange'], ['c049', 'jaune'], ['c022', 'rose'], ['c025', 'rose', 'boss'],
    ['c035', 'orange'], ['c063', 'verte'], ['c023', 'rose'], ['c024', 'rose'], ['c113', 'rose', 'boss'],
    ['c017', 'rose'], ['c120', 'rose'], ['c121', 'orange'], ['c119', 'rose'], ['c123', 'orange', 'final']
  ],
  deter: [
    ['c052', 'mauve'], ['c039', 'violette'], ['c064', 'bleue'], ['c051', 'mauve'], ['c050', 'mauve', 'boss'],
    ['c040', 'violette'], ['c069', 'azur'], ['c059', 'mauve'], ['c044', 'violette'], ['c058', 'mauve', 'boss'],
    ['c071', 'azur'], ['c067', 'bleue'], ['c045', 'violette'], ['c057', 'mauve'], ['c060', 'mauve', 'boss'],
    ['c118', 'mauve'], ['c117', 'mauve'], ['c116', 'mauve'], ['c068', 'bleue'], ['c125', 'mauve', 'final']
  ]
};

/* Les niveaux de l'IA, combat par combat, et ce que chaque combat rapporte
   la première fois. Les boss d'acte donnent des boosters et des Fragments. */
const NIVEAUX_CAMPAGNE = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5];
const REGLES_CAMPAGNE = { 4: { pv: 6 }, 9: { pv: 6 }, 14: { ess: 1 }, 19: { pv: 6, ess: 1 } };
const RECOMPENSES_CAMPAGNE = [
  { eclats: 80 }, { eclats: 80 }, { eclats: 100 }, { eclats: 100 }, { eclats: 150, boosters: 2, fragments: 300 },
  { eclats: 120 }, { eclats: 120 }, { eclats: 140 }, { eclats: 140 }, { eclats: 200, boosters: 3, fragments: 500 },
  { eclats: 160 }, { eclats: 160 }, { eclats: 180 }, { eclats: 180 }, { eclats: 250, boosters: 4, fragments: 800 },
  { eclats: 200 }, { eclats: 200 }, { eclats: 220 }, { eclats: 220 }, { eclats: 400, boosters: 5, fragments: 1200 }
];
/* Rejouer un combat déjà gagné : pour le plaisir, et un peu d'Éclats —
   dans la limite des victoires récompensées du jour (PVE_PLAFOND). */
const RECOMPENSE_REJOUER = { eclats: 10 };

/* Le PvE infini : la difficulté choisie, ce que rapporte une victoire.
   Au plus PVE_PLAFOND victoires récompensées par jour, tous modes PvE
   confondus (campagne rejouée comprise). Valeurs rééquilibrées pour la 3.0
   (docs/economie-3.0.md) : cinq victoires en Normal rapportent 125 Éclats,
   en Légende 250 — de quoi compter, sans doubler les revenus d'un joueur. */
const PVE_PLAFOND = 5;
const DIFFICULTES = [
  { niveau: 1, nom: 'Débutant', eclats: 10, texte: 'Elle apprend encore. Elle joue un coup sur deux au hasard.' },
  { niveau: 2, nom: 'Facile', eclats: 15, texte: 'Des règles simples, sans calcul.' },
  { niveau: 3, nom: 'Normal', eclats: 25, texte: 'Elle essaie ses coups avant de jouer.' },
  { niveau: 4, nom: 'Difficile', eclats: 35, texte: 'Elle calcule, et se méfie de ta riposte.' },
  { niveau: 5, nom: 'Légende', eclats: 50, texte: 'Elle prévoit ta réponse, avec un deck de Légendaires.' }
];

/* Les combats de la campagne, pour qui joue `section`. */
function combatsCampagne(section) {
  const rivaux = RIVAUX[autreSection(section)];
  return rivaux.map(([id, couleur, rang], i) => ({
    id: 'cp' + String(i + 1).padStart(2, '0'),
    n: i,
    acte: ACTES[Math.floor(i / 5)],
    rival: id,
    couleur,
    rang: rang || '',
    niveau: NIVEAUX_CAMPAGNE[i],
    regle: REGLES_CAMPAGNE[i] || null,
    recompense: RECOMPENSES_CAMPAGNE[i]
  }));
}

/* Le deck d'un rival : tiré au sort avec une graine fixe, dans sa couleur
   (et parfois une seconde, de sa Section), sa propre carte comprise. */
function deckRival(f, section) {
  const sec = SECTIONS[autreSection(section)];
  const r = aleaGraine(7919 * (f.n + 1) + (section === 'toxique' ? 1 : 2));
  const autres = sec.couleurs.filter(c => c !== f.couleur);
  const couleurs = f.n >= 5 && r() < 0.5 ? [f.couleur, autres[Math.floor(r() * autres.length)]] : [f.couleur];
  const d = Decks.aleatoire(r, { niveau: Math.min(5, f.niveau + (f.rang ? 1 : 0)), couleurs, nom: 'Deck de ' + (Combat.carte(f.rival) || {}).nom });
  /* Sa carte, toujours là. */
  imposerCarte(d, f.rival, f.couleur, r);
  d.couverture = f.rival;
  return d;
}

/* Une carte toujours présente dans un deck tiré au sort : elle prend la
   place d'un Joueur. Si le deck a déjà une carte qui compte pour la même
   (la Promo P06 et Le Marionnettiste #121, par exemple : Decks.cleCopie),
   c'est celle-là qui cède sa place — sinon on dépasserait la limite
   d'exemplaires. */
function imposerCarte(d, id, couleur, r) {
  if (d.cartes[id] || !Combat.carte(id)) return d;
  const meme = Object.keys(d.cartes).filter(k => Decks.cleCopie(k) === Decks.cleCopie(id));
  const js = Object.keys(d.cartes).filter(k => Combat.carte(k).cat === 'joueur');
  const l = meme.length ? meme : js;
  const out = l[Math.floor(r() * l.length)];
  if (out && --d.cartes[out] <= 0) delete d.cartes[out];
  d.cartes[id] = 1;
  d.reserve = Decks.reserveAuto(d.cartes, couleur);
  return d;
}

function aleaGraine(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
