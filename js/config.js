/* Configuration : couleurs, catégories, raretés, réglages des révélations. Aucune logique ici. */
"use strict";

/* ---------- Référentiels ---------- */
const COLORS = {
  rose: { nom: 'Rose', c: '#ff4fa3' },
  orange: { nom: 'Orange', c: '#ff8a2b' },
  jade: { nom: 'Jade', c: '#16a888' },
  violette: { nom: 'Violette', c: '#7c4dff' },
  jaune: { nom: 'Jaune', c: '#e8b800' },
  mauve: { nom: 'Mauve', c: '#b27ae6' },
  verte: { nom: 'Verte', c: '#3aae47' },
  bleue: { nom: 'Bleue', c: '#2f6fe0' },
  azur: { nom: 'Azur', c: '#27b3ef' },
  neutre: { nom: 'Neutre', c: '#8a8fa8' }
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
  R: { charge: 450, colors: ['#62d0ff', '#ffffff', '#b8ecff'], n: 50, speed: 9, label: 'Rare', rc: '#62d0ff' },
  E: { charge: 800, colors: ['#b04dff', '#ff2e88', '#ffffff', '#d9b8ff'], n: 100, speed: 11, label: 'Épique', rc: '#b04dff' },
  L: { charge: 1150, colors: ['#ffc53d', '#fff3b0', '#ff2e88', '#ffffff'], n: 160, speed: 14, label: 'Légendaire', rc: '#ffc53d' }
};
