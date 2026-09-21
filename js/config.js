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
  logo: 'assets/logo-m8.webp',         /* logo du jeu, en en-tête */
  back: 'assets/card-back.webp',       /* dos de carte */
  set: 'assets/extension-logo.svg',    /* logo de l'extension */
  edition: 'assets/1st-edition.svg',   /* pastille 1re édition */
  seal: 'assets/pack-star.svg',        /* sceau, icône de la réserve */
  star: 'assets/star-pink.svg'         /* étincelle des emplacements vides */
};

/* Petites icônes en ligne : elles héritent de la couleur du texte qui les entoure.
   L'étoile est celle du logo : elle sert de marque à l'onglet Boosters et au bouton d'ouverture. */
const ICON = {
  star: '<svg class="ico-star" viewBox="0 0 20 14" aria-hidden="true"><path d="M8.13814 0L8.07808 0.158491L6.03604 5.54717L0.21021 6.63019L0 6.68302L0.21021 6.73585L4.8949 8.10943L1.95195 13.7623L1.83183 14L2.04204 13.8151L7.92793 8.98113L12.6426 10.3547H12.7628L12.7027 10.2755L10.9009 6.97358L19.6096 1.90189L20 1.66415L19.5496 1.79623L9.75976 4.80755L8.1982 0.158491L8.13814 0Z" fill="currentColor"/></svg>',
  glass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10M7 21h10M8 3v4.4a4 4 0 0 0 1.6 3.2L12 12l-2.4 1.4A4 4 0 0 0 8 16.6V21M16 3v4.4a4 4 0 0 1-1.6 3.2L12 12l2.4 1.4a4 4 0 0 1 1.6 3.2V21"/></svg>'
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
  neutre: { nom: 'Neutre', c: '#90b2a5', ic: 'assets/essences/neutre.png' }
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
/* Valeurs de repli, utilisées hors ligne. Connecté, le serveur impose les siennes
   (fonction cfg() dans supabase/01_schema.sql) : la montre du téléphone n'y peut rien. */
let INTERVAL = 30 * 60 * 1000;
let TICKET_CAP = 5;

/* Nombre de cartes par booster. La composition slot par slot est dans makeBooster() (js/booster.js). */
const PACK_SIZE = 8;

/* Emplacements Secrets tenus en réserve dans la collection : numérotés à la suite des cartes
   existantes, mais hors du total puisqu'ils ne sont pas encore sortis. 0 pour les masquer. */
const SECRETS = 5;

/* Mise en scène de la dernière carte selon la rareté (durée de charge en ms, particules, couleurs) */
const REVEAL = {
  R: { charge: 450, colors: ['#39b8ff', '#ffffff', '#b8ecff'], n: 50, speed: 9, label: 'Rare', rc: '#39b8ff' },
  E: { charge: 800, colors: ['#8936ff', '#ec8fff', '#ffffff', '#d9b8ff'], n: 100, speed: 11, label: 'Épique', rc: '#8936ff' },
  L: { charge: 1150, colors: ['#ffc73b', '#fff3b0', '#ec8fff', '#ffffff'], n: 160, speed: 14, label: 'Légendaire', rc: '#ffc73b' }
};

/* ---------- Identité en ligne ---------- */
/* Laisser vide tant que l'adresse finale n'est pas décidée : les balises de partage
   se replient alors sur l'adresse courante. Sinon, mettre l'adresse complète, sans / final. */
const SITE_URL = '';

/* ---------- Économie ---------- */
const MONNAIE = { nom: 'Éclats', un: 'Éclat' };

/* Cadres d'avatar vendus en boutique. La clé est l'identifiant de public.shop_items. */
const FRAMES = {
  default: { nom: 'Aucun', c1: '#3f3450', c2: '#2e2539' },
  f_azur:  { nom: 'Azur',  c1: '#39b8ff', c2: '#2f7fc9' },
  f_rose:  { nom: 'Rose',  c1: '#ee0073', c2: '#ffd7f0' },
  f_or:    { nom: 'Or',    c1: '#ffc73b', c2: '#fff3b0' },
  f_prisme:{ nom: 'Prisme', prisme: true, c1: '#ee0073', c2: '#39b8ff' }
};

/* Avatars disponibles sans posséder de carte. Au-delà, on choisit une carte de sa collection. */
const AVATARS = {
  star: { nom: 'Étoile', art: 'assets/pack-star.svg' },
  back: { nom: 'Dos de carte', art: 'assets/card-back.webp' },
  logo: { nom: 'Logo', art: 'assets/logo-bw.svg' }
};

/* ---------- Échanges ---------- */
/* Une demande gratuite passé le délai, sinon un jeton acheté en boutique.
   Le serveur applique la même règle : ces valeurs ne servent qu'à l'affichage. */
const TRADE_COOLDOWN_H = 6;

/* ---------- Onglets ---------- */
/* `bas` : la barre du bas sur mobile, le rail sur ordinateur. Cinq places, pas une
   de plus : ce sont les cinq endroits où l'on revient tout le temps.
   `tiroir` : le menu qui se déplie sous l'avatar — le compte et ses réglages,
   pas le jeu. `admin` : réservé aux profils administrateurs. */
const TABS = [
  { id: 'boosters',   nom: 'Boosters',   bas: true, ico: 'star' },
  { id: 'collection', nom: 'Collection', bas: true, ico: 'cards' },
  { id: 'combats',    nom: 'Combats',    bas: true, ico: 'sword' },
  { id: 'echanges',   nom: 'Échanges',   bas: true, ico: 'swap',  online: true },
  { id: 'quetes',     nom: 'Quêtes',     bas: true, ico: 'quest', online: true },

  { id: 'profil',   nom: 'Mon profil', tiroir: true, ico: 'user', online: true,
    desc: 'Pseudo, avatar, cadre et statistiques' },
  { id: 'boutique', nom: 'Boutique',   tiroir: true, ico: 'shop', online: true,
    desc: 'Dépenser tes Éclats' },
  { id: 'reglages', nom: 'Réglages',   tiroir: true, ico: 'gear',
    desc: 'Son, animations, compte, installation' },
  { id: 'labo',     nom: 'Labo',       tiroir: true, ico: 'flask', admin: true,
    desc: 'Ouvertures de test — administrateurs' }
];

/* Icônes de navigation : tracées au trait, sauf l'étoile du logo qui est pleine. */
const NAVICO = {
  star:  ICON.star,
  cards: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="9" rx="1.5"/><rect x="14" y="4" width="7" height="9" rx="1.5"/><path d="M3 17h18M3 20.5h12"/></svg>',
  swap:  '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2"/></svg>',
  shop:  '<svg viewBox="0 0 24 24"><path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg>',
  more:  '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M9 11.5 11 13.5l4.5-4.5"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  sword: '<svg viewBox="0 0 24 24"><path d="M14.5 3H21v6.5L10.2 20.3a2 2 0 0 1-2.8 0l-3.7-3.7a2 2 0 0 1 0-2.8Z"/><path d="m14 10-4 4"/></svg>',
  user:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  gear:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3 16.6 7.4M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/></svg>',
  coin:  '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.5 6 .9-4.3 4.3 1 6.1L12 17l-5.3 2.8 1-6.1L3.4 9.4l6-.9Z"/></svg>'
};

const tabDef = id => TABS.find(t => t.id === id) || TABS[0];
