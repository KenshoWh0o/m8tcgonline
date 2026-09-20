/* Configuration : identité du jeu, couleurs, catégories, raretés, réglages des révélations. Aucune logique ici. */
"use strict";

/* ---------- Identité du jeu ---------- */
/* Le dernier mot du nom devient la ligne basse du logo (comme « TRADING CARD GAME » sous « GentleMates »). */
const GAME_NAME = 'Mate TCG Online';
const SET_NAME = 'Tout commence ici';

/* Dossier des images, ajouté devant le champ "fichier" de chaque carte de js/cards-data.js. */
const CARD_DIR = 'cards/';

/* ---------- Habillage ---------- */
/* Les quatre visuels de booster : un est tiré au sort à chaque paquet, sans effet sur le contenu. */
const PACK_ARTS = [
  'assets/boosters/booster-01.webp',
  'assets/boosters/booster-02.webp',
  'assets/boosters/booster-03.webp',
  'assets/boosters/booster-04.webp'
];

/* Le sceau assets/pack-star.svg sert d'icône au compteur de boosters, directement dans index.html. */
const ART = {
  back: 'assets/card-back.webp',       /* dos de carte */
  set: 'assets/extension-logo.svg',    /* logo de l'extension */
  edition: 'assets/1st-edition.svg',   /* pastille 1re édition */
  star: 'assets/star-pink.svg'         /* étincelle des emplacements vides */
};

/* ---------- Référentiels ---------- */
/* Couleurs officielles des neuf essences ; `ic` est le symbole affiché dans l'interface. */
const COLORS = {
  rose: { nom: 'Rose', c: '#ee0073', ic: 'assets/essences/rose.svg' },
  orange: { nom: 'Orange', c: '#f77514', ic: 'assets/essences/orange.svg' },
  jade: { nom: 'Jade', c: '#55e6a6', ic: 'assets/essences/jade.svg' },
  violette: { nom: 'Violette', c: '#8936ff', ic: 'assets/essences/violette.svg' },
  jaune: { nom: 'Jaune', c: '#ffc73b', ic: 'assets/essences/jaune.svg' },
  mauve: { nom: 'Mauve', c: '#ec8fff', ic: 'assets/essences/mauve.svg' },
  verte: { nom: 'Verte', c: '#9df244', ic: 'assets/essences/verte.svg' },
  bleue: { nom: 'Bleue', c: '#2f7fc9', ic: 'assets/essences/bleue.svg' },
  azur: { nom: 'Azur', c: '#39b8ff', ic: 'assets/essences/azur.svg' },
  neutre: { nom: 'Neutre', c: '#9ba0b0', ic: null }
};

const CATS = {
  joueur: 'Joueur',
  coach: 'Coach',
  moment: 'Moment',
  objet: 'Objet',
  essence: 'Essence'
};

const RAR = {
  ES: { nom: 'Essence', sym: '○', rank: 0 },
  C: { nom: 'Commune', sym: '◆', rank: 1 },
  PC: { nom: 'Peu commune', sym: '◆◆', rank: 2 },
  R: { nom: 'Rare', sym: '◆◆◆', rank: 3 },
  E: { nom: 'Épique', sym: '★', rank: 4 },
  L: { nom: 'Légendaire', sym: '★★', rank: 5 }
};

const DEFV = { ES: 0, C: 90, PC: 110, R: 120, E: 130, L: 150 };
const DEFD = { ES: 0, C: 60, PC: 80, R: 100, E: 120, L: 150 };

/* ---------- Réglages des boosters ---------- */
const INTERVAL = 30 * 60 * 1000;
const TICKET_CAP = 5;

/* Mise en scène de la dernière carte selon la rareté (durée de charge en ms, particules, couleurs) */
const REVEAL = {
  R: { charge: 450, colors: ['#39b8ff', '#ffffff', '#b8ecff'], n: 50, speed: 9, label: 'Rare', rc: '#39b8ff' },
  E: { charge: 800, colors: ['#8936ff', '#ec8fff', '#ffffff', '#d9b8ff'], n: 100, speed: 11, label: 'Épique', rc: '#8936ff' },
  L: { charge: 1150, colors: ['#ffc73b', '#fff3b0', '#ec8fff', '#ffffff'], n: 160, speed: 14, label: 'Légendaire', rc: '#ffc73b' }
};
