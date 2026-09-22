/* Configuration : tout ce qui décrit le jeu sans le faire tourner.

   Identité et mentions légales, palette des essences, échelle de raretés,
   réglages de tirage et de révélation, cadres et avatars, liste des onglets et
   jeu d'icônes. Aucune logique ici : ce fichier est lu, jamais exécuté.

   Les valeurs qui touchent à l'économie — taille d'un booster, plafond de la
   réserve, délai d'échange, palier des Promos — ont toutes un jumeau côté
   serveur (cfg() dans supabase/01_schema.sql). Celles d'ici ne servent qu'à
   l'affichage et au mode hors ligne : c'est le serveur qui tranche. */
"use strict";

/* ---------- Identité du jeu ---------- */
/* Le dernier mot du nom devient la ligne basse du logo (comme « TRADING CARD GAME » sous « GentleMates »). */
const GAME_NAME = 'Mate TCG Online';
const SET_NAME = 'Tout commence ici';

/* Mention légale, affichée à l'identique sur l'écran d'attente et dans Réglages.
   Un seul endroit pour la modifier : elle doit dire la même chose aux deux. */
const MENTIONS = 'Projet non affilié à Gentle Mates. Toutes les images présentes '
  + 'sur le site sont utilisées à titre informatif. Les marques et logos affichés '
  + 'demeurent la propriété de leurs détenteurs respectifs.';

/* La même chose en une ligne, pour les pieds de menu : la version longue y
   tiendrait sur huit lignes et se lirait comme un bas de page oublié. */
const MENTIONS_COURT = 'Projet non affilié à Gentle Mates. '
  + 'Marques et images appartenant à leurs détenteurs respectifs.';

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
  star: 'assets/star-pink.svg',        /* étincelle, repli d'avatar */
  jeton: 'assets/jeton-echange.webp'   /* le jeton d'échange, frappé du M8 */
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

/* `PR` n'est pas une rareté de plus dans l'échelle : c'est une case à part.
   Les Promos ne sortent d'aucun booster, ne comptent pas dans l'extension et
   ne s'échangent pas — le serveur refuse les deux. Le rang 6 sert seulement à
   les ranger en dernier quand on trie une liste mélangée. */
const RAR = {
  ES: { nom: 'Essence', sym: '○', rank: 0 },
  C: { nom: 'Commune', sym: '◆', rank: 1 },
  PC: { nom: 'Peu commune', sym: '◆◆', rank: 2 },
  R: { nom: 'Rare', sym: '◆◆◆', rank: 3 },
  E: { nom: 'Épique', sym: '★', rank: 4 },
  L: { nom: 'Légendaire', sym: '★★', rank: 5 },
  PR: { nom: 'Promo', sym: '✦', rank: 6, promo: true }
};

/* Les raretés proposées comme filtre dans la Collection, dans l'ordre de l'échelle. */
const RAR_FILTRES = ['ES', 'C', 'PC', 'R', 'E', 'L'];

const DEFV = { ES: 0, C: 90, PC: 110, R: 120, E: 130, L: 150 };
const DEFD = { ES: 0, C: 60, PC: 80, R: 100, E: 120, L: 150 };

/* ---------- Réglages des boosters ---------- */
/* Valeurs de repli, utilisées hors ligne. Connecté, le serveur impose les siennes
   (fonction cfg() dans supabase/01_schema.sql) : la montre du téléphone n'y peut rien. */
let INTERVAL = 4 * 60 * 60 * 1000;
let TICKET_CAP = 5;

/* Nombre de cartes par booster. La composition case par case est dans
   makeBooster() (js/booster.js) et, pour de vrai, dans open_pack()
   (supabase/03_rpc.sql). */
const PACK_SIZE = 6;

/* Emplacements Secrets tenus en réserve dans la collection : numérotés à la suite des cartes
   existantes, mais hors du total puisqu'ils ne sont pas encore sortis. 0 pour les masquer. */
const SECRETS = 5;

/* Mise en scène de la dernière carte selon la rareté (durée de charge en ms, particules, couleurs) */
const REVEAL = {
  R: { charge: 450, colors: ['#39b8ff', '#ffffff', '#b8ecff'], n: 50, speed: 9, label: 'Rare', rc: '#39b8ff' },
  E: { charge: 800, colors: ['#8936ff', '#ec8fff', '#ffffff', '#d9b8ff'], n: 100, speed: 11, label: 'Épique', rc: '#8936ff' },
  L: { charge: 1150, colors: ['#ffc73b', '#fff3b0', '#ec8fff', '#ffffff'], n: 160, speed: 14, label: 'Légendaire', rc: '#ffc73b' }
};

/* ---------- Comment on se connecte ---------- */
/* Discord seul, par défaut : le public du jeu y est déjà, l'inscription tient en
   un clic, le pseudo et l'avatar arrivent tout faits, et il n'y a aucun courriel
   à envoyer — donc aucun joueur bloqué faute d'avoir reçu son lien.
   Repasser `email` à true rouvre l'inscription par adresse : l'écran de connexion
   s'adapte tout seul, il n'y a rien d'autre à toucher.
   Le serveur reste maître : ce réglage n'est qu'un affichage, ce sont les
   fournisseurs activés dans Supabase qui décident vraiment. */
const CONNEXION = { discord: true, email: false };

/* ---------- Identité en ligne ---------- */
/* L'adresse officielle du jeu, sans barre oblique finale. Elle sert d'adresse de
   retour après un détour par Discord — sauf en développement, où le retour se fait
   sur la machine locale (voir retourURL() dans js/backend.js). */
const SITE_URL = 'https://matetcg.com';

/* L'adresse où l'on nous écrit : suppression de compte, remise à zéro, bug.
   Elle est affichée dans les Réglages, et nulle part ailleurs. */
const CONTACT = 'matetcgonline@gmail.com';

/* ---------- Économie ---------- */
const MONNAIE = { nom: 'Éclats', un: 'Éclat' };

/* Cadres d'avatar vendus en boutique. La clé est l'identifiant de public.shop_items. */
/* `vente: false` : le cadre existe, mais aucune boutique ne le vend. Le Sceau
   récompense les 500 boosters ouverts — c'est le seul objet du jeu qu'on ne
   peut pas acheter, et c'est ce qui en fait la valeur. */
const FRAMES = {
  default: { nom: 'Aucun', c1: '#3f3450', c2: '#2e2539' },
  f_azur:  { nom: 'Azur',  c1: '#39b8ff', c2: '#2f7fc9' },
  f_rose:  { nom: 'Rose',  c1: '#ee0073', c2: '#ffd7f0' },
  f_or:    { nom: 'Or',    c1: '#ffc73b', c2: '#fff3b0' },
  f_prisme:{ nom: 'Prisme', prisme: true, c1: '#ee0073', c2: '#39b8ff' },
  f_sceau: { nom: 'Sceau', sceau: true, vente: false, c1: '#ffc73b', c2: '#8936ff' }
};

/* Avatars livrés avec le jeu. Un avatar vaut aussi « discord » (la photo du
   compte, qui reste à jour toute seule), « ess:<couleur> » (un des dix symboles
   d'essence) ou « card:<id> » (une carte possédée, vérifiée par le serveur). */
/* `objet` : une image plus haute que large — une carte, un dos, un paquet.
   Elle est posée entière dans le cercle au lieu d'y être recadrée (voir
   avatarHTML dans js/ui.js). */
const AVATARS = {
  star: { nom: 'Étoile', art: 'assets/pack-star.svg', ico: true, bg: '#8936ff' },
  back: { nom: 'Dos de carte', art: 'assets/card-back.webp', objet: true, pos: '50%' },
  pack: { nom: 'Booster', art: 'assets/boosters/booster-01.webp', objet: true, pos: '40%' },
  set:  { nom: 'Extension', art: 'assets/extension-logo.svg', ico: true, bg: '#8936ff' },
  ed1:  { nom: '1re édition', art: 'assets/1st-edition.svg', ico: true, bg: '#ee0073' }
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
  { id: 'social',     nom: 'Social',     bas: true, ico: 'amis',  online: true },
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
  /* Collection : un classeur à cartes — la reliure à gauche, les pochettes à droite.
     Deux rectangles et une barre ne disaient rien ; un classeur, tout le monde
     l'a déjà eu entre les mains. */
  cards: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7.5 3v18"/><rect x="11" y="7" width="3.6" height="4.4" rx=".8"/><rect x="16.4" y="7" width="3.6" height="4.4" rx=".8"/><rect x="11" y="13.6" width="3.6" height="4.4" rx=".8"/><rect x="16.4" y="13.6" width="3.6" height="4.4" rx=".8"/></svg>',
  swap:  '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2"/></svg>',
  amis:  '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4"/><path d="M2.6 20a6.4 6.4 0 0 1 12.8 0"/><path d="M16.5 5.4a3.4 3.4 0 0 1 0 6.6M17.6 14.4A6.4 6.4 0 0 1 21.4 20"/></svg>',
  shop:  '<svg viewBox="0 0 24 24"><path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg>',
  more:  '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M9 11.5 11 13.5l4.5-4.5"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  /* Combats : deux épées croisées. L'ancienne icône était une forme sans nom —
     personne ne devinait qu'on se battait derrière. */
  sword: '<svg viewBox="0 0 24 24"><path d="M14.8 3H21v6.2L12.6 17.6"/><path d="M9.2 3H3v6.2l8.4 8.4"/><path d="m4.6 19.4 2.8-2.8M6 21l3.4-3.4"/><path d="m19.4 19.4-2.8-2.8M18 21l-3.4-3.4"/></svg>',
  user:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  /* Réglages : un vrai rouage, à dents. Le cercle entouré de huit rayons se
     lisait comme un soleil — on cherchait la météo, pas les paramètres. */
  gear:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M19.6 14.4a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97h-.17a1.9 1.9 0 0 1 0-3.8h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.46v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.05-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.46.97h.17a1.9 1.9 0 0 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/></svg>',
  coin:  '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.5 6 .9-4.3 4.3 1 6.1L12 17l-5.3 2.8 1-6.1L3.4 9.4l6-.9Z"/></svg>',

  /* Le menu du compte, sur mobile : trois lignes, le signe universel du panneau
     qui se déplie. Posé sur l'avatar, il dit que l'avatar est un bouton. */
  menu:  '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
  promo: '<svg viewBox="0 0 24 24"><path d="M12 2.6 14.1 9h6.7l-5.4 3.9 2 6.4-5.4-4-5.4 4 2-6.4L3.2 9h6.7Z"/></svg>',
  sun:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4 17 7M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4"/></svg>',
  moon:  '<svg viewBox="0 0 24 24"><path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z"/></svg>',
  auto:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></svg>',
  lock:  '<svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  caret: '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>',
  rotate:'<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 0 1 14.5-6"/><path d="M20.5 12a8.5 8.5 0 0 1-14.5 6"/><path d="M18 2.5V6h-3.5M6 21.5V18h3.5"/></svg>',
  filtre:'<svg viewBox="0 0 24 24"><path d="M3.5 5.5h17l-6.6 7.6v5.6l-3.8 2v-7.6Z"/></svg>'
};

/* ---------- Cartes Promo ---------- */
/* Le palier de collection qui accorde la promo « palier ». Doit rester égal à
   `cfg('promo_palier_pct')` dans supabase/01_schema.sql : c'est le serveur qui
   accorde la carte, ceci n'est que l'affichage. */
const PROMO_PALIER = 75;

/* Ce qu'on lit sous une promo qu'on n'a pas encore : l'endroit du jeu où aller
   la chercher, pas la condition exacte. Le détail est dans la quête — le
   répéter ici obligeait à tenir deux textes d'accord, et le palier avait déjà
   bougé une fois sans que celui-ci suive. */
const PROMO_COMMENT = {
  boutique: 'En boutique',
  palier: 'Quêtes saisonnières',
  master: 'Quêtes saisonnières',
  bientot: 'Coming soon…'
};

/* Les emplacements Promo tenus en réserve : les cartes existent dans la série
   mais ne nous sont pas encore parvenues. Comme les Secrets de la collection,
   ils occupent leur case pour que la suite de la numérotation se voie. */
const PROMOS_A_VENIR = ['P03', 'P04'];

