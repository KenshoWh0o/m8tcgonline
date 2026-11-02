// Généré par tools/build-verif.py (empreinte 22ec4bf8d21b) : ne pas modifier à la main.
// Le code du jeu, tel que le navigateur le charge, pour rejouer un combat sur le serveur.
/* eslint-disable */
// @ts-nocheck
var window = globalThis;
var byId = {};
var fmtN = n => String(n == null ? 0 : n);
// ---- js/config.js
/* Configuration : tout ce qui décrit le jeu sans le faire tourner.

   Identité et mentions légales, palette des essences, échelle de raretés,
   réglages de tirage et de révélation, cadres et avatars, liste des onglets et
   jeu d'icônes. Presque aucune logique ici : des valeurs, que les autres
   fichiers lisent. Deux exceptions : `PRISMES`, dont le nom suit l'événement
   en cours (evMonnaieCode), et INTERVAL / TICKET_CAP, que Backend.apply
   (js/backend.js) réécrit avec les valeurs du serveur.

   Les valeurs qui touchent à l'économie — taille d'un booster, plafond de la
   réserve, délai d'échange, palier des Promos — ont toutes un jumeau côté
   serveur (cfg() dans supabase/installation/01_schema.sql). Celles d'ici ne servent qu'à
   l'affichage et au mode hors ligne : c'est le serveur qui tranche. */
"use strict";

/* ---------- Identité du jeu ---------- */
/* Le dernier mot du nom devient la ligne basse du logo (comme « TRADING CARD GAME » sous « GentleMates »). */
const GAME_NAME = 'Mate TCG Online';
const SET_NAME = 'Tout commence ici';

/* La démo présentée à Gentle Mates (matetcg.com/demo, tools/demo.py --demo,
   3.0.14) : le jeu tel qu'il serait au premier jour. Ni numéro de version, ni
   nouveautés, ni traces des événements passés ; une présentation à la
   première visite, un Labo pour tout tester, pas de lien vers le Discord.
   Posé par la page de la démo avant tout script ; faux partout ailleurs. */
const DEMO = globalThis.DEMO_M8 === true;

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
  glass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10M7 21h10M8 3v4.4a4 4 0 0 0 1.6 3.2L12 12l-2.4 1.4A4 4 0 0 0 8 16.6V21M16 3v4.4a4 4 0 0 1-1.6 3.2L12 12l2.4 1.4a4 4 0 0 1 1.6 3.2V21"/></svg>',
  /* Le logo Discord, plein. Il était recopié dans deux fichiers ; une marque
     ne se duplique pas, elle se cite. */
  discord: '<svg viewBox="0 0 24 18" aria-hidden="true" fill="currentColor"><path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a14 14 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A13.6 13.6 0 0 0 8.6.1 19.7 19.7 0 0 0 3.7 1.6C.6 6.2-.3 10.7.2 15.1a19.9 19.9 0 0 0 6 3 14.7 14.7 0 0 0 1.3-2.1 13 13 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4a13 13 0 0 1-2 1 14.5 14.5 0 0 0 1.3 2.1 19.8 19.8 0 0 0 6-3c.6-5.1-.9-9.6-3.6-13.5ZM8.0 12.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 7.6 8 7.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>'
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
  /* Version 3.0 : les Secrètes, au-delà des 122 (« 123/122 »). */
  S: { nom: 'Secrète', sym: '✦✦', rank: 5.5 },
  PR: { nom: 'Promo', sym: '✦', rank: 6, promo: true },
  /* Hors extension, comme les Promos : jamais dans les 122, jamais recyclées.
     La Brillante sort de la case Essence d'un booster, une fois sur cinquante,
     et s'échange contre une autre Brillante (version 3.0.11) ; l'Unique
     n'existe qu'en un exemplaire dans tout le jeu, et ne s'échange pas. */
  BR: { nom: 'Brillante', sym: '✧', rank: 7, promo: true },
  UN: { nom: 'Unique', sym: '◈', rank: 8, promo: true }
};

/* Les raretés proposées comme filtre dans la Collection, dans l'ordre de l'échelle. */
const RAR_FILTRES = ['ES', 'C', 'PC', 'R', 'E', 'L'];

const DEFV = { ES: 0, C: 90, PC: 110, R: 120, E: 130, L: 150 };
const DEFD = { ES: 0, C: 60, PC: 80, R: 100, E: 120, L: 150 };

/* ---------- Réglages des boosters ---------- */
/* Valeurs de repli, utilisées hors ligne. Connecté, le serveur impose les siennes
   (fonction cfg() dans supabase/installation/01_schema.sql) : la montre du téléphone n'y peut rien. */
let INTERVAL = 4 * 60 * 60 * 1000;
let TICKET_CAP = 5;

/* Nombre de cartes par booster. La composition case par case est dans
   makeBooster() (js/booster.js) et, pour de vrai, dans open_pack()
   (supabase/installation/03_rpc.sql). */
const PACK_SIZE = 6;


/* Mise en scène de la dernière carte selon la rareté (durée de charge en ms, particules, couleurs) */
const REVEAL = {
  R: { charge: 450, colors: ['#39b8ff', '#ffffff', '#b8ecff'], n: 50, speed: 9, label: 'Rare', rc: '#39b8ff' },
  E: { charge: 800, colors: ['#8936ff', '#ec8fff', '#ffffff', '#d9b8ff'], n: 100, speed: 11, label: 'Épique', rc: '#8936ff' },
  L: { charge: 1150, colors: ['#ffc73b', '#fff3b0', '#ec8fff', '#ffffff'], n: 160, speed: 14, label: 'Légendaire', rc: '#ffc73b' },
  /* Version 3.0 : la Secrète, presque aussi rare que l'Unique. */
  S: { charge: 1500, colors: ['#ffffff', '#c9d6ff', '#ff7cc8', '#7fd8ff', '#ffe28a'], n: 200, speed: 15, label: 'Secrète', rc: '#e8ecff' },
  /* La carte unique : la plus longue charge du jeu, et toutes les couleurs. */
  UN: { charge: 1900, colors: ['#ffc73b', '#ec8fff', '#39b8ff', '#55e6a6', '#ffffff'], n: 240, speed: 16, label: 'Unique', rc: '#ec8fff' }
};

/* ---------- La communauté ---------- */
/* Le serveur Discord du jeu : annonces, entraide, échanges. Une seule adresse,
   citée partout où elle a sa place — écran d'attente, menus, fenêtre de
   bienvenue. La changer ici la change partout. */
const DISCORD_URL = 'https://discord.gg/SUkwRKfEDe';

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
/* La seconde monnaie : ce que rapporte le recyclage, et ce que coûte une
   carte fabriquée (supabase/installation/12_recyclage.sql). Elle n'achète rien d'autre. */
const FRAGMENTS = { nom: 'Fragments', un: 'Fragment' };
/* Une Essence Brillante une fois sur… Copie de cfg('foil_odds') : ne sert qu'aux
   ouvertures de test du Labo, c'est le serveur qui tire pour de vrai. */
const FOIL_ODDS = 50;

/* ---------- Les succès ---------- */
/* Les identifiants viennent du serveur (succes_de, supabase/installation/15_evenements.sql),
   qui décide ; ici, ce qu'on en montre. L'ordre est celui de l'affichage. */
const SUCCES = [
  { id: 'premier_booster',    nom: 'Premier paquet',     dit: 'Ouvrir un premier booster.',            ico: 'star',    ton: 'C' },
  { id: 'boosters_100',       nom: 'Centurion',          dit: 'Ouvrir 100 boosters.',                  ico: 'star',    ton: 'R' },
  { id: 'boosters_500',       nom: 'Insatiable',         dit: 'Ouvrir 500 boosters.',                  ico: 'star',    ton: 'E' },
  { id: 'collection_50',      nom: 'À mi-chemin',        dit: 'Posséder la moitié de l\'extension.',   ico: 'cards',   ton: 'C' },
  { id: 'master_set',         nom: 'Master Set',         dit: 'Posséder les 122 cartes.',              ico: 'cards',   ton: 'L' },
  { id: 'toutes_legendaires', nom: 'Panthéon',           dit: 'Posséder toutes les Légendaires.',      ico: 'coin',    ton: 'L' },
  { id: 'premier_echange',    nom: 'Poignée de main',    dit: 'Conclure un premier échange.',          ico: 'swap',    ton: 'C' },
  { id: 'negociant',          nom: 'Négociant',          dit: 'Conclure 25 échanges.',                 ico: 'swap',    ton: 'E' },
  { id: 'serie_7',            nom: 'Fidèle',             dit: 'Revenir 7 jours d\'affilée.',           ico: 'clock',   ton: 'R' },
  { id: 'serie_30',           nom: 'Inébranlable',       dit: 'Revenir 30 jours d\'affilée.',          ico: 'clock',   ton: 'E' },
  { id: 'godpack',            nom: 'Béni des dieux',     dit: 'Ouvrir un godpack.',                    ico: 'promo',   ton: 'L' },
  { id: 'brillante',          nom: 'Ça brille',          dit: 'Obtenir une Essence Brillante.',        ico: 'promo',   ton: 'R' },
  { id: 'toutes_brillantes',  nom: 'Éclat absolu',       dit: 'Réunir les 9 Essences Brillantes.',     ico: 'promo',   ton: 'L' },
  { id: 'artisan',            nom: 'Artisan',            dit: 'Fabriquer une carte.',                  ico: 'recycle', ton: 'C' },
  { id: 'unique',             nom: 'L\'Élu',             dit: 'Posséder la carte unique.',             ico: 'trophy',  ton: 'UN' },
  { id: 'pionnier',           nom: 'Pionnier',           dit: 'Avoir rejoint le jeu avant la version 1.5.', ico: 'flask', ton: 'R' },
  /* Version 2.0 : les Reverses. */
  { id: 'premiere_reverse',   nom: 'Premier reflet',     dit: 'Obtenir une première Reverse.',         ico: 'reflets', ton: 'R' },
  { id: 'reverses_toutes',    nom: 'Miroir parfait',     dit: 'Réunir les 85 Reverses.',               ico: 'reflets', ton: 'L' }
];

/* ---------- Les titres (version 2.0) ---------- */
/* Un titre s'affiche sous le pseudo : profil, fiche, classement. La plupart
   viennent d'un succès (titres_de, supabase/installation/21_reflets.sql) ; les autres sont
   gagnés — Pass et boutique de l'événement, quêtes. `ton` : sa couleur, comme
   une rareté. `comment` : ce qu'il faut faire pour l'avoir. */
const TITRES = {
  t_pionnier:  { nom: 'Pionnier',                  ton: 'R',  comment: 'Avoir rejoint le jeu avant la version 1.5' },
  t_centurion: { nom: 'Centurion',                 ton: 'R',  comment: 'Ouvrir 100 boosters' },
  t_artisan:   { nom: 'Artisan',                   ton: 'C',  comment: 'Fabriquer une carte' },
  t_hote:      { nom: 'L\'Hôte',                   ton: 'R',  comment: 'Faire entrer un ami avec une invitation' },
  t_negociant: { nom: 'Négociant',                 ton: 'E',  comment: 'Conclure 25 échanges' },
  t_fidele:    { nom: 'Inébranlable',              ton: 'E',  comment: 'Revenir 30 jours d\'affilée' },
  t_devin:     { nom: 'Le Devin',                  ton: 'E',  comment: 'Trouver 10 illustrations à Devine l\'illu' },
  t_chanceux:  { nom: 'Béni des dieux',            ton: 'L',  comment: 'Ouvrir un godpack' },
  t_prisme:    { nom: 'Éclat absolu',              ton: 'L',  comment: 'Réunir les 9 Essences Brillantes' },
  t_maitre:    { nom: 'Maître de l\'extension',    ton: 'L',  comment: 'Posséder les 122 cartes' },
  t_reflet:    { nom: 'Miroir parfait',            ton: 'L',  comment: 'Réunir les 85 Reverses' },
  /* Version 2.5 : L'Échauffement et son événement (supabase/22b_echauffement.sql,
     22e et 22f de la 2.5). La 3.0 ne les donne plus ; ceux qui les ont les gardent. */
  t_echauffe:  { nom: 'Échauffé',                  ton: 'E',  comment: 'Les 21 étoiles de L\'Échauffement' },
  t_ech_round: { nom: 'Premier round',             ton: 'EV', comment: 'Palier 5 du Pass de L\'Échauffement' },
  t_ech_feu:   { nom: 'Feu sacré',                 ton: 'EV', comment: 'Palier 15 du Pass de L\'Échauffement' },
  t_ech_entraineur: { nom: 'Entraîneur',           ton: 'EV', comment: 'Boutique de l\'événement « L\'Échauffement »' },
  t_ech_infatigable: { nom: 'Infatigable',         ton: 'E',  comment: 'Gagner 10 défis du jour, après L\'Échauffement' },
  t_eclaireur: { nom: 'Éclaireur des Reflets',     ton: 'EV', comment: 'Palier 3 du Pass Reflets' },
  t_collect:   { nom: 'Collectionneur de Reflets', ton: 'EV', comment: 'Boutique de l\'événement « Reflets »' },
  t_ame:       { nom: 'Âme des Reflets',           ton: 'EV', comment: 'Palier 19 du Pass Reflets' },
  t_elu:       { nom: 'L\'Élu',                    ton: 'UN', comment: 'Posséder la carte unique' },
  /* Version 3.0 : les combats. */
  t_sections:  { nom: 'Champion des Sections',     ton: 'L',  comment: 'Finir la campagne des Combats' },
  t_legende:   { nom: 'Tombeur de Légende',        ton: 'E',  comment: 'Gagner en Arcade, difficulté Légende' },
  t_stratege:  { nom: 'Stratège',                  ton: 'R',  comment: 'Gagner 100 combats' },
  /* Version 3.0.14 : le coffre de la dernière phase d'un Raid (RAID.phases,
     js/combat/choc-data.js ; raid_reclamer, 27_raid.sql). */
  t_heros_raid:{ nom: 'Héros du Raid',             ton: 'L',  comment: 'Abattre la dernière phase d\'un Raid' },
  /* L'événement de la 3.0, « Le Choc des Sections » (js/combat/choc-data.js). */
  t_recrue:    { nom: 'Recrue du Choc',            ton: 'EV', comment: 'Palier 3 du Pass du Choc' },
  t_veteran:   { nom: 'Vétéran du Choc',           ton: 'EV', comment: 'Palier 19 du Pass du Choc' },
  t_maitre_choc:{ nom: 'Maître du Choc',           ton: 'EV', comment: 'Palier 29 du Pass du Choc' },
  t_supporter: { nom: 'Supporter du Choc',         ton: 'EV', comment: 'Boutique de l\'événement « Le Choc des Sections »' },
  /* Les niveaux de combattant (js/combat/niveaux.js). */
  t_bagarreur: { nom: 'Bagarreur',                 ton: 'C',  comment: 'Atteindre le niveau 5 de combattant' },
  t_veteran_arene:{ nom: 'Vétéran de l\'arène',    ton: 'R',  comment: 'Atteindre le niveau 20 de combattant' },
  t_maitre_arene:{ nom: 'Maître de l\'arène',      ton: 'E',  comment: 'Atteindre le niveau 40 de combattant' },
  t_legende_arene:{ nom: 'Légende de l\'arène',    ton: 'L',  comment: 'Atteindre le niveau 50 de combattant' },
  t_admin:     { nom: 'Administrateur',            ton: 'ADM', comment: 'Réservé à l\'équipe du jeu' }
};

/* La démo de Gentle Mates (DEMO) montre le jeu à son premier jour : les
   titres, les cadres et le succès qui disent un passé — les premières
   versions, les invitations de la bêta, les événements Reflets et
   L'Échauffement — n'y existent pas. Les cadres des succès (Maître, Reflet,
   Aurore) restent : ils se gagnent toujours. Le titre d'administrateur non
   plus : le visiteur de la démo l'est, pour le Labo. */
const PASSES = new Set(['t_admin', 'pionnier', 't_pionnier', 't_hote', 't_eclaireur', 't_collect', 't_ame', 'f_miroir', 'f_nebuleuse',
  't_echauffe', 't_ech_round', 't_ech_feu', 't_ech_entraineur', 't_ech_infatigable', 'f_braise', 'f_ardeur']);
const horsDemo = k => DEMO && PASSES.has(k);

/* La monnaie d'un événement (supabase/installation/21_reflets.sql) : elle se gagne en
   quêtes d'événement et se dépense dans sa boutique ; tout ce qu'on gagne fait
   avancer son Pass de récompenses. Chaque événement a la sienne : les Prismes
   de Reflets (2.0), les Braises de L'Échauffement (2.5), les Étincelles du Choc
   des Sections (3.0). Le serveur les range toutes au même endroit
   (evt_comptes) ; seuls le nom et l'icône changent. `PRISMES` suit l'événement
   en cours, ou celui dont on lit le récap. Les Braises sont là pour une 3.0
   qui sortirait pendant L'Échauffement ou son récap (jusqu'au 7 novembre
   2026) : sans elles, la page les appellerait « Prismes ». */
const MONNAIES_EV = {
  reflets: { nom: 'Prismes', un: 'Prisme' },
  echauffement: { nom: 'Braises', un: 'Braise' },
  choc: { nom: 'Étincelles', un: 'Étincelle' }
};
const evMonnaieCode = () => {
  const ev = typeof evenementEnCours === 'function' ? evenementEnCours() : null;
  const r = typeof save !== 'undefined' && save && save.recap ? save.recap.code : null;
  return MONNAIES_EV[ev] ? ev : MONNAIES_EV[r] ? r : 'reflets';
};
const PRISMES = {
  get nom() { return MONNAIES_EV[evMonnaieCode()].nom; },
  get un() { return MONNAIES_EV[evMonnaieCode()].un; }
};

/* Cadres d'avatar vendus en boutique. La clé est l'identifiant de public.shop_items. */
/* `vente: false` : le cadre existe, mais aucune boutique ne le vend. Le Sceau
   n'est pour l'instant donné par aucune quête : ceux qui l'ont déjà le
   gardent. Pour le rendre de nouveau accessible, le poser en `item_id` d'une
   quête dans supabase/installation/04_seed.sql. */
const FRAMES = {
  default: { nom: 'Aucun', c1: '#3f3450', c2: '#2e2539' },
  f_azur:  { nom: 'Azur',  c1: '#39b8ff', c2: '#2f7fc9' },
  f_rose:  { nom: 'Rose',  c1: '#ee0073', c2: '#ffd7f0' },
  f_or:    { nom: 'Or',    c1: '#ffc73b', c2: '#fff3b0' },
  /* `fx` : un cadre décoré — une illustration animée autour de l'avatar,
     assets/cadres/<fx>.svg (css/reflets.css). */
  f_prisme:{ nom: 'Prisme', fx: 'prisme', c1: '#b7d4ff', c2: '#c9a8ff' },
  f_sceau: { nom: 'Sceau', fx: 'sceau', vente: false, c1: '#ffc73b', c2: '#5b1fc2' },
  /* Celui de la personne qui a tiré la carte unique, et de personne d'autre :
     posé par le serveur au moment du tirage (open_pack, supabase/installation/03_rpc.sql). */
  f_unique:{ nom: 'Unique', unique: true, vente: false, c1: '#ffc73b', c2: '#ec8fff' },
  /* Version 2.0 : gagnés en jouant (quêtes, Pass de l'événement). */
  f_master: { nom: 'Maître', fx: 'maitre', vente: false, c1: '#ee0073', c2: '#ff9ad5' },
  f_reflet: { nom: 'Reflet', fx: 'reflet', vente: false, c1: '#ffd3ec', c2: '#cfeeff' },
  f_aurore: { nom: 'Aurore', fx: 'aurore', vente: false, c1: '#1fd1a0', c2: '#ff6fb5' },
  f_miroir: { nom: 'Miroir', fx: 'miroir', vente: false, c1: '#e8ecff', c2: '#8e98b3' },
  f_nebuleuse:{ nom: 'Nébuleuse', fx: 'nebuleuse', vente: false, c1: '#b38cff', c2: '#ff7cc8' },
  /* Version 2.5 : le Pass de L'Échauffement (paliers 10 et 20), dessinés par
     tools/cadres.py. La 3.0 ne les donne plus ; ceux qui les ont les gardent. */
  f_braise: { nom: 'Braise', fx: 'braise', vente: false, c1: '#ffcf8a', c2: '#8a78f5' },
  f_ardeur: { nom: 'Ardeur', fx: 'ardeur', vente: false, c1: '#c8bfff', c2: '#5d4bd9' },
  /* Version 3.0 : le Pass et le Raid du Choc des Sections. */
  f_choc:   { nom: 'Choc', fx: 'choc', vente: false, c1: '#62d84e', c2: '#7c3aed' },
  f_foudre: { nom: 'The French Sorcerer', fx: 'foudre', vente: false, c1: '#ec8fff', c2: '#6a2bd6' },
  /* Version 3.0 : les niveaux de combattant (js/combat/niveaux.js), les deux
     Sections (Boutique), et la première Secrète (quêtes).
     Dessinés par tools/cadres-30.py. */
  f_niv10:  { nom: 'Arène · Bronze', fx: 'niv10', vente: false, c1: '#d08a4c', c2: '#7a3f12' },
  f_niv20:  { nom: 'Arène · Argent', fx: 'niv20', vente: false, c1: '#c9d1de', c2: '#6f7889' },
  f_niv30:  { nom: 'Arène · Or', fx: 'niv30', vente: false, c1: '#f2c24a', c2: '#9a620a' },
  f_niv50:  { nom: 'Arène · Prisme', fx: 'niv50', vente: false, c1: '#b38cff', c2: '#39b8ff' },
  f_toxique:{ nom: 'Toxique', fx: 'toxique', c1: '#62d84e', c2: '#e3fbd6' },
  f_deter:  { nom: 'Déter', fx: 'deter', c1: '#7c3aed', c2: '#ede4ff' },
  f_secrete:{ nom: 'Secrète', fx: 'secrete', vente: false, c1: '#c9d6ff', c2: '#ffd0ec' }
};

/* Avatars livrés avec le jeu. Un avatar vaut aussi « discord » (la photo du
   compte, qui reste à jour toute seule), « ess:<couleur> » (un des dix symboles
   d'essence) ou « card:<id> » (une carte possédée, vérifiée par le serveur). */
/* `objet` : une image plus haute que large — une carte, un dos, un paquet.
   Elle est posée entière dans le cercle au lieu d'y être recadrée (voir
   avatarHTML dans js/ui.js). */
const AVATARS = {
  star: { nom: 'Étoile', art: 'assets/pack-star.svg', ico: true, bg: '#5d4bd9' },
  back: { nom: 'Dos de carte', art: 'assets/card-back.webp', objet: true, pos: '50%' },
  pack: { nom: 'Booster', art: 'assets/boosters/booster-01.webp', objet: true, pos: '40%' },
  set:  { nom: 'Extension', art: 'assets/extension-logo.svg', ico: true, bg: '#5d4bd9' },
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
   pas le jeu. `admin` : réservé aux profils administrateurs. `evenement` :
   l'onglet d'un événement (son code), en tête du tiroir pendant qu'il dure
   et les trois jours de son récap. `horsEvenement` : un onglet qui disparaît
   pendant l'événement de ce code. Une entrée sans `bas` ni `tiroir`
   n'apparaît dans aucun menu : on l'ouvre d'ailleurs. */
const TABS = [
  { id: 'boosters',   nom: 'Boosters',   bas: true, ico: 'star' },
  { id: 'collection', nom: 'Collection', bas: true, ico: 'cards' },
  { id: 'combats',    nom: 'Combats',    bas: true, ico: 'sword', desc: 'Campagne, Arcade, Raid, Versus' },
  /* Version 2.0 : l'onglet de l'événement. Pendant qu'il dure, et les trois
     jours de son récap, il passe en tête du tiroir (ongletsTiroir,
     js/app.js) ; Combats garde sa place dans la barre du bas. */
  { id: 'reflets',    nom: 'Reflets',    evenement: 'reflets', ico: 'reflets' },
  /* Version 3.0 : « Le Choc des Sections » (js/choc.js). */
  { id: 'choc',       nom: 'Le Choc',    evenement: 'choc', ico: 'choc',
    desc: 'L\'événement : Raid, Épreuve du jour, Pass' },
  { id: 'social',     nom: 'Social',     bas: true, ico: 'amis' },
  { id: 'quetes',     nom: 'Quêtes',     bas: true, ico: 'quest' },

  { id: 'profil',   nom: 'Mon profil', tiroir: true, ico: 'user',
    desc: 'Pseudo, avatar, cadre et statistiques' },
  { id: 'tirages', nom: 'Mes tirages', tiroir: true, ico: 'clock',
    desc: 'Historique, statistiques et partage' },
  /* Devine l'illu vit dans l'onglet de l'événement tant qu'il dure, puis
     dans le sien (ongletDispo, js/app.js). */
  { id: 'illu',     nom: 'Devine l\'illu', tiroir: true, ico: 'illu', horsEvenement: 'reflets',
    desc: 'Une illustration à deviner chaque jour' },
  { id: 'classement', nom: 'Classement', tiroir: true, ico: 'trophy',
    desc: 'Les meilleurs joueurs, tous confondus' },
  { id: 'boutique', nom: 'Boutique',   tiroir: true, ico: 'shop',
    desc: 'Dépenser tes Éclats' },
  { id: 'recyclage', nom: 'Recyclage', tiroir: true, ico: 'recycle',
    desc: 'Tes doublons contre des Fragments' },
  { id: 'reglages', nom: 'Réglages',   tiroir: true, ico: 'gear',
    desc: 'Son, animations, compte, installation' },
  { id: 'labo',     nom: 'Labo',       tiroir: true, ico: 'flask', admin: true,
    desc: 'Ouvertures de test — administrateurs' },

  /* La boite de réception n'est dans aucune barre : on y entre par la cloche
     de l'en-tête, visible partout (voir js/boite.js). */
  { id: 'boite', nom: 'Boîte de réception', ico: 'bell' }
];

/* Icônes de navigation : tracées au trait, sauf l'étoile du logo qui est pleine. */
const NAVICO = {
  star:  ICON.star,
  /* Collection : trois cartes en éventail, l'étoile du logo sur celle du
     dessus. Le classeur à pochettes se lisait comme un tableur ; une main de
     cartes, c'est ce qu'on tient en jouant. */
  cards: '<svg viewBox="0 0 24 24"><path d="M7.6 6.3 4.3 7.2a1.5 1.5 0 0 0-1 1.8l2.9 10.8a1.5 1.5 0 0 0 1.8 1l2.3-.6"/><path d="M16.4 6.3l3.3.9a1.5 1.5 0 0 1 1 1.8l-2.9 10.8a1.5 1.5 0 0 1-1.8 1l-2.3-.6"/><rect x="7.3" y="2.5" width="9.4" height="15.5" rx="1.8"/><path d="m12 7.2.8 1.7 1.9.3-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9-1.4-1.3 1.9-.3Z"/></svg>',
  swap:  '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2"/></svg>',
  amis:  '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4"/><path d="M2.6 20a6.4 6.4 0 0 1 12.8 0"/><path d="M16.5 5.4a3.4 3.4 0 0 1 0 6.6M17.6 14.4A6.4 6.4 0 0 1 21.4 20"/></svg>',
  shop:  '<svg viewBox="0 0 24 24"><path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/></svg>',
  more:  '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M9 11.5 11 13.5l4.5-4.5"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  /* Combats : deux épées croisées, lame, garde et pommeau. La version
     précédente n'en gardait que les pointes : on voyait un blason vide. La
     seconde lame passe sous la première, comme sur n'importe quelle enseigne
     de duel. */
  sword: '<svg viewBox="0 0 24 24"><path d="M3.5 3.5h3.2l10 10M3.5 3.5v3.2l10 10"/><path d="M12.1 18.1l6-6M15.1 15.1l3.4 3.4M18.3 20.3l2-2"/><path d="M12 8.8l5.3-5.3h3.2v3.2L15.2 12"/><path d="M8.8 12l-1.5 1.5M12 15.2l-1.5 1.5"/><path d="M11.9 18.1l-6-6M8.9 15.1l-3.4 3.4M5.7 20.3l-2-2"/></svg>',
  /* La boite de réception, dans l'en-tête. */
  bell:  '<svg viewBox="0 0 24 24"><path d="M18 16.2V11a6 6 0 0 0-12 0v5.2L4.4 18h15.2Z"/><path d="M10 20.6a2.3 2.3 0 0 0 4 0"/></svg>',
  /* Recyclage : deux flèches qui tournent autour d'un Éclat — la carte revient
     sous une autre forme. */
  recycle: '<svg viewBox="0 0 24 24"><path d="M19.6 13.4A7.8 7.8 0 0 1 6.4 17.6"/><path d="M4.4 10.6A7.8 7.8 0 0 1 17.6 6.4"/><path d="M17.9 2.9v3.8h-3.8M6.1 21.1v-3.8h3.8"/><path d="M12 8.4 14.6 12 12 15.6 9.4 12Z"/></svg>',
  /* Une annonce, dans la boite de réception. */
  annonce: '<svg viewBox="0 0 24 24"><path d="M4 10.2v3.6a1.4 1.4 0 0 0 1.4 1.4H7l8.5 4.6V4.2L7 8.8H5.4A1.4 1.4 0 0 0 4 10.2Z"/><path d="M7 15.2l1.1 4.1a1.2 1.2 0 0 0 2.3-.6l-.9-3.5"/><path d="M19 9.4a3.5 3.5 0 0 1 0 5.2"/></svg>',
  user:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  /* Réglages : un vrai rouage, à dents. Le cercle entouré de huit rayons se
     lisait comme un soleil — on cherchait la météo, pas les paramètres. */
  gear:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M19.6 14.4a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97h-.17a1.9 1.9 0 0 1 0-3.8h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.46v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.05-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.46.97h.17a1.9 1.9 0 0 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/></svg>',
  coin:  '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.5 6 .9-4.3 4.3 1 6.1L12 17l-5.3 2.8 1-6.1L3.4 9.4l6-.9Z"/></svg>',
  trophy:'<svg viewBox="0 0 24 24"><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 5.5H4.5v1.2a3.3 3.3 0 0 0 3.3 3.3M16.5 5.5h3v1.2a3.3 3.3 0 0 1-3.3 3.3"/><path d="M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5Z"/></svg>',

  /* Le menu du compte, sur mobile : trois lignes, le signe universel du panneau
     qui se déplie. Posé sur l'avatar, il dit que l'avatar est un bouton. */
  menu:  '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
  promo: '<svg viewBox="0 0 24 24"><path d="M12 2.6 14.1 9h6.7l-5.4 3.9 2 6.4-5.4-4-5.4 4 2-6.4L3.2 9h6.7Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></svg>',
  coeur: '<svg viewBox="0 0 24 24"><path d="M12 20.3s-7.6-4.5-9.4-9.1C1.3 7.9 3.3 4.4 6.9 4.4c2.1 0 3.7 1.1 5.1 3 1.4-1.9 3-3 5.1-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.4 9.1-9.4 9.1Z"/></svg>',
  lock:  '<svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  caret: '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>',
  partage:'<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-6"/></svg>',
  /* Version 2.0 : le Prisme (monnaie de l'événement), Reflets (l'événement,
     les Reverses), Devine l'illu (un tableau pixelisé). */
  prisme: '<svg viewBox="0 0 24 24"><path d="M12 2.5 21 18.5H3Z"/><path d="M12 2.5 9.2 18.5M12 2.5l2.8 16M5.6 13.9h12.8"/></svg>',
  reflets: '<svg viewBox="0 0 24 24"><path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9Z"/><path d="M19 3.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></svg>',
  /* Devine l'illu : un tableau dont un coin est encore en gros pixels. */
  illu: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 15.5 8.5 11l4 3.5 2.5-2 5.5 4.5"/><path d="M14 4.5v4h-3.5v-4M10.5 8.5h3.5" opacity=".9"/><circle cx="16.7" cy="9" r="1.3"/></svg>',
  fragment:'<svg viewBox="0 0 24 24"><path d="M12 2.8 18.6 9 12 21.2 5.4 9Z"/><path d="M5.4 9h13.2M12 2.8 9.4 9 12 21.2 14.6 9Z"/></svg>',
  rotate:'<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 0 1 14.5-6"/><path d="M20.5 12a8.5 8.5 0 0 1-14.5 6"/><path d="M18 2.5V6h-3.5M6 21.5V18h3.5"/></svg>',
  filtre:'<svg viewBox="0 0 24 24"><path d="M3.5 5.5h17l-6.6 7.6v5.6l-3.8 2v-7.6Z"/></svg>',
  /* Version 3.0 : le Choc des Sections (un écusson frappé d'un éclair), le
     Raid (l'éclair de The French Sorcerer), l'Épreuve du jour (un
     calendrier coché). */
  choc: '<svg viewBox="0 0 24 24"><path d="M12 2.8 19.5 5.6v6.2c0 4.4-3.1 7.6-7.5 9.4-4.4-1.8-7.5-5-7.5-9.4V5.6Z"/><path d="M13 6.5 9.5 12.5h3l-1.5 5 4-6.5h-3Z"/></svg>',
  /* Les règles, le Guide : un livre ouvert. */
  livre: '<svg viewBox="0 0 24 24"><path d="M3.5 5.6c2.9-1.1 5.8-.9 8.5.8v13.2c-2.7-1.7-5.6-1.9-8.5-.8Z"/><path d="M20.5 5.6c-2.9-1.1-5.8-.9-8.5.8v13.2c2.7-1.7 5.6-1.9 8.5-.8Z"/></svg>',
  foudre: '<svg viewBox="0 0 24 24"><path d="M13.5 2.5 5.5 13.5h5.6l-1.6 8 8.5-11.4h-5.7Z"/></svg>',
  /* Le niveau de combattant : trois chevrons de grade. */
  niveau: '<svg viewBox="0 0 24 24"><path d="m5 11.5 7-5 7 5"/><path d="m5 16.5 7-5 7 5"/><path d="m5 21.5 7-5 7 5" opacity=".55"/></svg>',
  epreuve: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15.5" rx="2.5"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/><path d="m9.3 14.3 1.9 1.9 3.6-3.8"/></svg>',
  /* Version 3.0.13 : « Personnaliser » (le profil). */
  crayon: '<svg viewBox="0 0 24 24"><path d="M4.5 19.5h3.8L19.4 8.4a2.2 2.2 0 0 0-3.1-3.1L5.2 16.4v3.1Z"/><path d="m14.6 7 2.9 2.9"/></svg>',
  /* Voir (3.0.14) : un œil, pour « Ma fiche » au Profil. */
  oeil: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
};

/* ---------- Cartes Promo ---------- */
/* Le palier de collection qui accorde la promo « palier ». Doit rester égal à
   `cfg('promo_palier_pct')` dans supabase/installation/01_schema.sql : c'est le serveur qui
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
  /* Version 3.0 : les Promos des Starter Decks, en Combats. */
  section: 'Combats · Sections',
  bientot: 'Coming soon…'
};

/* Les emplacements Promo tenus en réserve : les cartes existent dans la série
   mais ne nous sont pas encore parvenues. Comme les Secrets de la collection,
   ils occupent leur case pour que la suite de la numérotation se voie.
   Version 3.0 : P03 et P04, les Promos des Starter Decks, sont arrivées
   (js/promos-data.js), avec leur vrai texte depuis la 3.0.13. */
const PROMOS_A_VENIR = [];


// ---- js/utils.js
/* Petits outils partagés : sélecteur, échappement HTML, hasard, message court,
   lecture d'une carte, et le branchement du gyroscope. */
"use strict";

/* ---------- Sélecteur et texte ---------- */
const $ = s => document.querySelector(s);

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/* Au passage, les guillemets français gardent leur contenu : jamais un « » »
   seul en début de ligne. */
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPE_MAP[c])
  .replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»');

/* Le nom d'une carte, pour une liste sans image : une Reverse porte une
   petite icône holographique (css/cards.css) plutôt que le mot, répétitif. */
const nomH = c => h(c.nom) + (c.rev ? '<i class="revico" role="img" aria-label="Reverse" title="Reverse"></i>' : '');

const noacc = s => String(s == null ? '' : s)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/* ---------- Hasard ---------- */
const rnd = a => a[Math.floor(Math.random() * a.length)];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Notifications ---------- */
let toastT;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
/* Ce qui ne se dit qu'aux lecteurs d'écran (version 3.0.13) : un geste dont
   l'effet se voit, mais ne s'entend pas — une carte ajoutée au deck, un coup
   en combat. La zone (#annonce, index.html) est invisible ; vidée puis
   remplie, elle redit un message identique. */
let annonceT;
function annonceLecteur(m) {
  const z = $('#annonce');
  if (!z) return;
  z.textContent = '';
  clearTimeout(annonceT);
  annonceT = setTimeout(() => { z.textContent = m; }, 60);
}

/* ---------- Cartes ---------- */
const colOf = c => COLORS[c.col] || COLORS.neutre;
const tcol = c => colOf(c).c;
const rk = c => (RAR[c.rar] || RAR.C).rank;

/* L'extension et les Promos, dans une seule liste. À n'utiliser que là où les
   deux ont leur place — un choix d'avatar, une vitrine. Partout où l'on compte
   la collection, c'est `cards` seul : les Promos sont hors extension, et le
   total de 122 ne doit jamais bouger. */
const toutesCartes = () => cards.concat(reverses, promos, brillantes, uniques);

/* Les plus rares d'abord, puis par numéro. */
const parRarete = (a, b) => rk(b) - rk(a) || (a.num || 0) - (b.num || 0);

/* Symbole d'une essence : le logo officiel quand il existe, sinon une pastille de couleur. */
const essIcon = (k, cls) => {
  const col = COLORS[k] || COLORS.neutre;
  return col.ic
    ? `<img class="ess ${cls || ''}" src="${col.ic}" alt="${col.nom}">`
    : `<i class="ess dot ${cls || ''}" style="background:${col.c}"></i>`;
};

/* ---------- Accessibilité ---------- */
/* Les mouvements réduits : le réglage du jeu (Réglages › Animations réduites,
   la classe `rm` de <html>) ou celui du système, l'un ou l'autre suffit.
   La requête du système est créée une fois (3.0.13) : RM() est appelée à
   chaque image par les animations, et matchMedia() en refaisait une à
   chaque appel (mesuré : près d'une demi-seconde par minute de combat,
   processeur ralenti quatre fois). Sa valeur, elle, suit le système. */
const MQ_RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const RM = () => document.documentElement.classList.contains('rm') || MQ_RM.matches;

/* ---------- Gyroscope ---------- */
/* Incliner l'appareil fait tourner la carte. Deux écrans s'en servent —
   l'ouverture d'un booster et la visionneuse — et chacun avait sa copie ; la
   visionneuse, elle, n'en avait aucune, d'où « l'inclinaison ne marche pas
   dans la collection ».

   Deux choses à savoir :
   · Sur iPhone, il faut **demander l'autorisation**, et la demande n'est
     acceptée que si elle part d'un geste. Les deux écrans s'ouvrent sur une
     pression : on appelle donc depuis leur ouverture, jamais plus tard.
   · L'angle brut ne sert à rien. Ce qui compte, c'est l'écart avec la position
     de départ : on retient la première mesure comme origine, sinon la carte
     part de travers selon la façon dont on tient le téléphone. */
let gyroAutorise = null;   /* null = pas encore demandé, true/false = réponse */

function brancherGyro(surInclinaison, ampleur) {
  if (!JEU.gyro || RM() || !window.DeviceOrientationEvent) return () => {};

  let base = null;
  const amp = ampleur || .6;
  const lim = 18;
  const on = e => {
    if (e.beta == null && e.gamma == null) return;
    if (base == null) base = { b: e.beta || 0, g: e.gamma || 0 };
    surInclinaison(
      Math.max(-lim, Math.min(lim, -((e.beta || 0) - base.b) * amp)),
      Math.max(-lim, Math.min(lim, ((e.gamma || 0) - base.g) * amp)));
  };

  const ecouter = () => addEventListener('deviceorientation', on);
  const detacher = () => removeEventListener('deviceorientation', on);

  const demande = typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!demande || gyroAutorise === true) {
    ecouter();
  } else if (gyroAutorise === null) {
    try {
      DeviceOrientationEvent.requestPermission()
        .then(r => { gyroAutorise = r === 'granted'; if (gyroAutorise) ecouter(); })
        .catch(() => { gyroAutorise = false; });
    } catch (e) { gyroAutorise = false; }
  }
  return detacher;
}

// ---- js/cards-data.js
/* Les cartes de l'extension : une entrée par carte, reliée à son image du dossier cards/ par le champ fichier.
   C'est le seul fichier à modifier pour ajouter, retirer ou corriger une carte. */
"use strict";

const CARD_DATA = [
  {
    fichier: "001_ES_Essence_Rose_Essence-Rose.avif", num: 1, nom: "Essence Rose",
    categorie: "Essence", couleur: "Rose", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Roses." }
    ]
  },
  {
    fichier: "002_ES_Essence_Orange_Essence-Orange.avif", num: 2, nom: "Essence Orange",
    categorie: "Essence", couleur: "Orange", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Orange." }
    ]
  },
  {
    fichier: "003_ES_Essence_Jade_Essence-Jade.avif", num: 3, nom: "Essence Jade",
    categorie: "Essence", couleur: "Jade", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Jade." }
    ]
  },
  {
    fichier: "004_ES_Essence_Violette_Essence-Violette.avif", num: 4, nom: "Essence Violette",
    categorie: "Essence", couleur: "Violette", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Violettes." }
    ]
  },
  {
    fichier: "005_ES_Essence_Jaune_Essence-Jaune.avif", num: 5, nom: "Essence Jaune",
    categorie: "Essence", couleur: "Jaune", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Jaunes." }
    ]
  },
  {
    fichier: "006_ES_Essence_Mauve_Essence-Mauve.avif", num: 6, nom: "Essence Mauve",
    categorie: "Essence", couleur: "Mauve", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Mauves." }
    ]
  },
  {
    fichier: "007_ES_Essence_Verte_Essence-Verte.avif", num: 7, nom: "Essence Verte",
    categorie: "Essence", couleur: "Verte", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Vertes." }
    ]
  },
  {
    fichier: "008_ES_Essence_Bleue_Essence-Bleue.avif", num: 8, nom: "Essence Bleue",
    categorie: "Essence", couleur: "Bleue", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Bleues." }
    ]
  },
  {
    fichier: "009_ES_Essence_Azur_Essence-Azur.avif", num: 9, nom: "Essence Azur",
    categorie: "Essence", couleur: "Azur", rarete: "ES",
    effets: [
      { texte: "Vous pouvez engager cette Essence pour déclencher vos attaques Azur." }
    ]
  },
  {
    fichier: "010_C_Joueur_Rose_Broken-Brawks.avif", num: 10, nom: "Broken Brawks",
    categorie: "Joueur", couleur: "Rose", rarete: "C", def: 130,
    attaques: [
      { nom: "Roi du Silence", cout: { rose: 1 }, degats: 50 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque vous récuperez un PV, engagez ce Joueur." },
    ambiance: "Gamberge"
  },
  {
    fichier: "011_C_Joueur_Rose_Vandale.avif", num: 11, nom: "Vandale",
    categorie: "Joueur", couleur: "Rose", rarete: "C", def: 90,
    attaques: [
      { nom: "S-Privilège", cout: { rose: 1 }, degats: 90 },
      { nom: "Glissade", cout: { rose: 2, neutre: 1 }, degats: null, effet: "Engagez un Joueur adverse." }
    ],
    ambiance: "Un titre de Vice-Champion de plus !"
  },
  {
    fichier: "012_PC_Joueur_Rose_Squeezie-Le-Toxique.avif", num: 12, nom: "Squeezie le Toxique",
    categorie: "Joueur", couleur: "Rose", rarete: "PC", def: 110,
    attaques: [
      { nom: "Trash-talk", cout: { rose: 1, neutre: 1 }, degats: 110 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Engagez un Joueur adverse." },
    ambiance: "Prout."
  },
  {
    fichier: "013_PC_Joueur_Rose_Pas-Compris.avif", num: 13, nom: "Pas Compris",
    categorie: "Joueur", couleur: "Rose", rarete: "PC", def: 70,
    attaques: [
      { nom: "Confusion", cout: { rose: 1 }, degats: 60, effet: "+10 par Joueur engagé.", plus: true }
    ],
    mot_cle: { nom: "Provocation", texte: "L'attaquant face à ce Joueur doit le cibler." },
    ambiance: "Toujours pas compris"
  },
  {
    fichier: "014_PC_Coach-Instant_Rose_Zacking-Buff.avif", num: 14, nom: "Zacking Buff",
    categorie: "Coach", sous_type: "Instant", couleur: "Rose", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Vos Joueurs ont +30 Attaque jusqu'à la fin du tour." }
    ],
    resilience: "Défaussez votre main pour engager un Joueur adverse.",
    ambiance: "On n'a pas le droit de le décevoir !"
  },
  {
    fichier: "015_C_Objet-Lien_Rose_Ravitaillement.avif", num: 15, nom: "Ravitaillement",
    categorie: "Objet", sous_type: "Lien", couleur: "Rose", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +10 Attaque et +10 Défense." },
      { icone: "declencheur", texte: "Lorsque ce Joueur est engagé, vous pouvez bench cet Objet pour piocher 1 carte." }
    ],
    resilience: "Engagez 2 de vos Joueurs pour engager un Joueur adverse.",
    ambiance: "Classique sur classique."
  },
  {
    fichier: "016_PC_Moment-Instant_Rose_Mur-Salvateur.avif", num: 16, nom: "Mur Salvateur",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Un de vos Joueurs a +10 Défense et gagne Garde jusqu'à la fin du tour adverse." }
    ],
    resilience: "Un de vos Joueurs gagne Garde jusqu'à la fin du tour.",
    ambiance: "Ils ne passeront pas."
  },
  {
    fichier: "017_R_Joueur_Rose_Tout-Commence-Ici.avif", num: 17, nom: "Tout Commence Ici",
    categorie: "Joueur", couleur: "Rose", rarete: "R", def: 90,
    attaques: [
      { nom: "Premier Souffle", cout: { neutre: 1 }, degats: 90 }
    ],
    mot_cle: { nom: "Buff", texte: "Vos autres Joueurs ont +10 Attaque." },
    ambiance: "Gentle Mates : c'est comme ça que nous nous appellerons."
  },
  {
    fichier: "018_R_Coach-Instant_Rose_Buy-Bundle-M8.avif", num: 18, nom: "Buy Bundle M8 !!",
    categorie: "Coach", sous_type: "Instant", couleur: "Rose", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Renvoyez 1 Joueur adverse sans Provocation dans la main de son propriétaire." }
    ],
    resilience: "Engagez un Joueur adverse avec Provocation.",
    ambiance: "Tout achat d'un bundle augmente votre KDA de 25% en jeu."
  },
  {
    fichier: "019_R_Moment-Instant_Rose_OCE-PCE.avif", num: 19, nom: "OCE/PCE",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Votre adversaire choisit entre les deux effets suivants : - Piochez 2 cartes. - Votre adversaire défausse 2 cartes." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "C'est ma direction !"
  },
  {
    fichier: "020_R_Moment-Instant_Rose_Degustation-D_Adversaires.avif", num: 20, nom: "Dégustation d'adversaires",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Un Joueur adverse a -30 Defense et votre Joueur sur la même ligne a +30 Attaque jusqu'à la fin du tour." }
    ],
    resilience: "Un de vos Joueurs gagne Buff +20 Defense jusqu'à la fin du tour.",
    ambiance: "On va se régaler potooo"
  },
  {
    fichier: "021_R_Moment-Instant_Rose_Trauma-Dump-III.avif", num: 21, nom: "Trauma Dump III",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Renvoyez tous les Objet Liés à un Joueur dans la main de son propriétaire." }
    ],
    resilience: "Renvoyez 1 Objet dans la main de son propriétaire.",
    ambiance: "…"
  },
  {
    fichier: "022_E_Joueur_Rose_Namifique.avif", num: 22, nom: "Namifique",
    categorie: "Joueur", couleur: "Rose", rarete: "E", def: 90,
    attaques: [
      { nom: "Omniscience", cout: { rose: 1 }, degats: null, effet: "Engagez un Joueur adverse." },
      { nom: "Rotation", cout: { rose: 1, neutre: 1 }, degats: 160 }
    ],
    ambiance: "«Ça va les questions là ma chérie ? C'est duuur»"
  },
  {
    fichier: "023_E_Joueur_Rose_Marteen-Supreme.avif", num: 23, nom: "Marteen Supreme",
    categorie: "Joueur", couleur: "Rose", rarete: "E", def: 120,
    attaques: [
      { nom: "Clutch", cout: { rose: 1, neutre: 1 }, degats: 126 },
      { nom: "World Record", cout: { rose: 3 }, degats: 180 }
    ],
    ambiance: "Flex, flex, man I'm flexin'"
  },
  {
    fichier: "024_E_Joueur_Rose_Agent-M.E.L.avif", num: 24, nom: "Agent M.E.L",
    categorie: "Joueur", couleur: "Rose", rarete: "E", def: 120,
    attaques: [
      { nom: "Coup de fil", cout: { rose: 2 }, degats: 100 }
    ],
    mot_cle: { nom: "Buff", texte: "Vos autres Joueurs ont +20 Attaque." },
    ambiance: "Allo ? Besoin d'une Houssein en urgence"
  },
  {
    fichier: "025_E_Joueur_Rose_Gentle-Mates-Minny.avif", num: 25, nom: "Gentle Mates Minny",
    categorie: "Joueur", couleur: "Rose", rarete: "E", def: 120,
    attaques: [
      { nom: "Locked In", cout: { rose: 2 }, degats: 130 }
    ],
    ambiance: "Patrik a pris du ferme"
  },
  {
    fichier: "026_E_Coach-Instant_Rose_Pause-Technique.avif", num: 26, nom: "Pause Technique",
    categorie: "Coach", sous_type: "Instant", couleur: "Rose", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Engagez un Joueur adverse sans mot-clés." }
    ],
    ambiance: "ON VEUT JOUER AU JEUUUUUU"
  },
  {
    fichier: "027_E_Moment-Instant_Rose_Remontada.avif", num: 27, nom: "Remontada",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Si vous avez moins de PV que votre adversaire, vos Joueurs ont +20 Attaque jusqu'à la fin du tour." }
    ],
    ambiance: "J'ai un très mauvais pressentiment"
  },
  {
    fichier: "028_E_Moment-Instant_Rose_Championnes-d_Europe.avif", num: 28, nom: "Championnes d'Europe",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Les attaques de vos Joueurs avec Buff ont +20 jusqu'à la fin du tour." }
    ],
    ambiance: "Elles nous craindront"
  },
  {
    fichier: "029_C_Joueur_Orange_Pollo.avif", num: 29, nom: "Pollo",
    categorie: "Joueur", couleur: "Orange", rarete: "C", def: 120,
    attaques: [
      { nom: "Demon's Domain", cout: { orange: 2 }, degats: 80, effet: "+20 pour chaque Objet Lié à ce Joueur", plus: true }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque vous liez un ou plusieurs Objet à ce Joueur, vous pouvez placer un Objet de votre défausse sur votre Club." },
    ambiance: "C'est quoi ce poulet ?"
  },
  {
    fichier: "030_PC_Coach-Instant_Orange_Worlds-Lyon.avif", num: 30, nom: "Worlds Lyon",
    categorie: "Coach", sous_type: "Instant", couleur: "Orange", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Vos Joueurs liés ne s'engagent pas lors de leur première attaque ce tour." }
    ],
    resilience: "Un de vos Joueurs gagne Shield jusqu'à la fin du tour.",
    ambiance: "La seule équipe française qui gagne devant son public"
  },
  {
    fichier: "031_C_Coach-Instant_Orange_Moi-Je-Suis-Coach.avif", num: 31, nom: "Moi je suis coach",
    categorie: "Coach", sous_type: "Instant", couleur: "Orange", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Révélez les 6 cartes du dessus de votre Club et ajoutez toutes les cartes Objet révélées à votre main. Défaussez les cartes restantes." }
    ],
    resilience: "La prochaine Riposte déclenchée a un coût diminué de 1 ce tour.",
    ambiance: "Sis thinks she's on the team"
  },
  {
    fichier: "032_PC_Objet-Lien_Orange_Invitation.avif", num: 32, nom: "Invitation",
    categorie: "Objet", sous_type: "Lien", couleur: "Orange", rarete: "PC",
    effets: [
      { icone: "declencheur", texte: "Lorsque ce Joueur est vaincu, bench cet Objet à la place de ce Joueur." }
    ],
    resilience: "Jouer une carte Objet.",
    ambiance: "(Sources) Gentle Mates have reached an agreement with you."
  },
  {
    fichier: "033_C_Moment-Instant_Orange_Visa-Refuse.avif", num: 33, nom: "Visa Refusé",
    categorie: "Moment", sous_type: "Instant", couleur: "Orange", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Ciblez un Joueur adverse sans Objet. Il ne peut pas déclencher d'Attaque jusqu'à la fin du tour de l'adversaire." }
    ],
    resilience: "Ajoutez une carte Objet de votre défausse à votre main.",
    ambiance: "C'était leur seule façon d'arrêter nos M16"
  },
  {
    fichier: "034_R_Joueur_Orange_Vanyabubu.avif", num: 34, nom: "Vanyabubu",
    categorie: "Joueur", couleur: "Orange", rarete: "R", def: 90,
    attaques: [
      { nom: "Baby Shark", cout: { orange: 1 }, degats: 60, effet: "+10 pour chaque Objet Lié à ce Joueur.", plus: true }
    ],
    mot_cle: { nom: "Riposte", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant." },
    ambiance: "Il gère la comptabilité du club entre 2 cups"
  },
  {
    fichier: "035_R_Joueur_Orange_Pitchounes.avif", num: 35, nom: "Pitchounes",
    categorie: "Joueur", couleur: "Orange", rarete: "R", def: 120,
    attaques: [
      { nom: "Eclosion", cout: { orange: 2 }, degats: 130 }
    ],
    mot_cle: { nom: "Riposte", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant." },
    ambiance: "Il commence à pleuvoir"
  },
  {
    fichier: "036_R_Objet-Lien_Orange_Maillot-Champions-_25.avif", num: 36, nom: "Maillot Champions '25",
    categorie: "Objet", sous_type: "Lien", couleur: "Orange", rarete: "R",
    effets: [
      { texte: "Ce Joueur gagne Riposte." }
    ],
    resilience: "Un de vos Joueurs gagne Riposte jusqu'à la fin du tour.",
    ambiance: "On ne perd pas devant notre public."
  },
  {
    fichier: "037_R_Moment-Instant_Orange_L_OEil-de-Nikof.avif", num: 37, nom: "L'Œil de Nikof",
    categorie: "Moment", sous_type: "Instant", couleur: "Orange", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Regardez les 4 cartes du dessus de votre Club et ajoutez une carte Objet à votre main. Placez les cartes restantes au-dessus de votre Club dans l'ordre de votre choix." }
    ],
    resilience: "Mélangez jusqu'à 2 cartes Objet de votre défausse à votre Club.",
    ambiance: "Il a les yeux Double Pompe Chasseur, il a le regard qui tue."
  },
  {
    fichier: "038_C_Moment-Instant_Jade_Caprice-De-Gotaga.avif", num: 38, nom: "Caprice de Gotaga",
    categorie: "Moment", sous_type: "Instant", couleur: "Jade", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Défaussez une carte pour jouer la première carte de votre Réserve engagée." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Il a trop pris au sérieux le «muscler son jeu»"
  },
  {
    fichier: "039_C_Joueur_Violette_Zero-Soucis.avif", num: 39, nom: "Zéro Soucis",
    categorie: "Joueur", couleur: "Violette", rarete: "C", def: 90,
    attaques: [
      { nom: "What a Save !", cout: { violette: 1 }, degats: 90 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque votre adversaire joue un Joueur, vous pouvez échanger la position de ce Joueur et d'un autre de vos Joueurs." },
    ambiance: "Quelle belle journée"
  },
  {
    fichier: "040_PC_Joueur_Violette_Les-Rois-du-Saloon.avif", num: 40, nom: "Les Rois du Saloon",
    categorie: "Joueur", couleur: "Violette", rarete: "PC", def: 70,
    attaques: [
      { nom: "Hold-Up", cout: { violette: 1 }, degats: 60, effet: "+10 pour chaque PV que vous avez.", plus: true }
    ],
    mot_cle: { nom: "Provocation", texte: "L'attaquant face à ce Joueur doit le cibler." },
    ambiance: "Qui a peint mon cheval en rose ?"
  },
  {
    fichier: "041_C_Moment-Instant_Violette_Trauma-Dump-I.avif", num: 41, nom: "Trauma Dump I",
    categorie: "Moment", sous_type: "Instant", couleur: "Violette", rarete: "C",
    effets: [
      { icone: "etoile", texte: "La première fois que votre adversaire récupère un PV ce tour, désengagez un de vos Joueurs." }
    ],
    resilience: "Désengagez l'un de vos Joueurs.",
    ambiance: "…"
  },
  {
    fichier: "042_C_Moment-Instant_Violette_Reverse-Squeeze.avif", num: 42, nom: "Reverse Squeeze",
    categorie: "Moment", sous_type: "Instant", couleur: "Violette", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Regardez vos PV et choisissez une carte. Echangez-la avec une carte de votre main." }
    ],
    resilience: "Défaussez votre premier PV pour placer 1 carte de votre main sur vos PV.",
    ambiance: "Call an ambulance… but not for me."
  },
  {
    fichier: "043_C_Moment-Instant_Violette_BLBLBLBL.avif", num: 43, nom: "BLBLBLBL",
    categorie: "Moment", sous_type: "Instant", couleur: "Violette", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Echangez la position de 2 de vos Joueurs." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "BLBLBLBLBLBLBLBLBLBL"
  },
  {
    fichier: "044_R_Joueur_Violette_Moroccan-Monsters.avif", num: 44, nom: "Moroccan Monsters",
    categorie: "Joueur", couleur: "Violette", rarete: "R", def: 140,
    attaques: [
      { nom: "Pinch", cout: { violette: 2, neutre: 1 }, degats: 80, effet: "Désengagez un autre de vos Joueurs." }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Piochez une carte si vous avez plus de 2 PV." },
    ambiance: "Deux frères, un fauve."
  },
  {
    fichier: "045_R_Joueur_Violette_Zzzzz.avif", num: 45, nom: "Zzzzz",
    categorie: "Joueur", couleur: "Violette", rarete: "R", def: 70,
    attaques: [
      { nom: "Rêverie", cout: { violette: 1 }, degats: null, effet: "Regardez les 4 cartes du dessus de votre Club et placez-les au-dessus ou en dessous de votre Club dans l'ordre de votre choix." }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Regardez vos PV et choisissez une carte. Echangez-la avec une carte de votre main." },
    ambiance: "Réveillez-vous my CEO ! Il est déjà 15H du matin !"
  },
  {
    fichier: "046_R_Objet-Lien_Violette_Maillot-Champions-_24.avif", num: 46, nom: "Maillot Champions '24",
    categorie: "Objet", sous_type: "Lien", couleur: "Violette", rarete: "R",
    effets: [
      { icone: "declencheur", texte: "Lorsque vous vainquez un Joueur, désengagez une de vos Essences." }
    ],
    resilience: "Désengagez 1 de vos Joueurs.",
    ambiance: "Il y a un nouveau shérif en ville"
  },
  {
    fichier: "047_E_Moment-Instant_Violette_Champions-du-Major.avif", num: 47, nom: "Champions du Major",
    categorie: "Moment", sous_type: "Instant", couleur: "Violette", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Jusqu'à la fin du tour, chaque fois que vous désengagez un Joueur, désengagez une Essence Violette." }
    ],
    ambiance: "Veni, Vidi, Vici."
  },
  {
    fichier: "048_E_Moment-Instant_Violette_Champions-du-Major.avif", num: 48, nom: "Champions du Major",
    categorie: "Moment", sous_type: "Instant", couleur: "Violette", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Jusqu'à la fin du tour, la première fois que vous désengagez une Essence, désengagez un Joueur Violet." }
    ],
    ambiance: "ReVeni, ReVidi, ReVici."
  },
  {
    fichier: "049_E_Joueur_Jaune_Le-Roi-des-Rois.avif", num: 49, nom: "Le Roi des rois",
    categorie: "Joueur", couleur: "Jaune", rarete: "E", def: 100,
    attaques: [
      { nom: "Dictature", cout: { neutre: 1 }, degats: 50, effet: "+20 par essence Jaune controlée.", plus: true }
    ],
    mot_cle: { nom: "Légion", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez défausser une carte pour récuperer ce Joueur dans votre main." },
    ambiance: "Pas besoin d'armure, un marcel suffira"
  },
  {
    fichier: "050_PC_Joueur_Mauve_La-Fee-Rosalie.avif", num: 50, nom: "La Fée Rosalie",
    categorie: "Joueur", couleur: "Mauve", rarete: "PC", def: 140,
    attaques: [
      { nom: "Soutien Constant", cout: { mauve: 3 }, degats: 150 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Bench un Joueur adverse engagé sans Provocation." },
    ambiance: "Je veux que M8 gagne, j'y crois, j'y crois."
  },
  {
    fichier: "051_PC_Joueur_Mauve_La-Planete.avif", num: 51, nom: "La Planète",
    categorie: "Joueur", couleur: "Mauve", rarete: "PC", def: 110,
    attaques: [
      { nom: "Télépathie", cout: { mauve: 1, neutre: 1 }, degats: 120 }
    ],
    mot_cle: { nom: "Légion", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main." },
    ambiance: "Lorsqu'un CEO s'endort, La Planète se réveille."
  },
  {
    fichier: "052_C_Joueur_Mauve_Most-Valuable-Planet.avif", num: 52, nom: "Most Valuable Planet",
    categorie: "Joueur", couleur: "Mauve", rarete: "C", def: 90,
    attaques: [
      { nom: "Regard Sombre", cout: { mauve: 1 }, degats: 90 },
      { nom: "Sourire Radieux", cout: { mauve: 1, neutre: 1 }, degats: 150, effet: "Mélangez 1 Essence Mauve dans votre Réserve." }
    ],
    ambiance: "La face cachée de Neptune"
  },
  {
    fichier: "053_C_Objet-Lien_Mauve_Ravitaillement.avif", num: 53, nom: "Ravitaillement",
    categorie: "Objet", sous_type: "Lien", couleur: "Mauve", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +10 Attaque et +10 Défense." },
      { icone: "declencheur", texte: "Lorsque ce Joueur vainc un Joueur, vous pouvez détruire cet Objet pour piocher 2 cartes." }
    ],
    resilience: "Bench un Objet adverse.",
    ambiance: "Je ne vous parle même pas du prochain..."
  },
  {
    fichier: "054_PC_Moment-Instant_Mauve_Trauma-Dump-II.avif", num: 54, nom: "Trauma Dump II",
    categorie: "Moment", sous_type: "Instant", couleur: "Mauve", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Mélangez 1 Essence Mauve dans votre Réserve, vos Joueurs déployés ont +20 sur leurs attaques jusqu'à la fin du tour." }
    ],
    resilience: "Jouez la première carte de votre Réserve.",
    ambiance: "…"
  },
  {
    fichier: "055_C_Moment-Instant_Mauve_Target-Missed.avif", num: 55, nom: "Target Missed",
    categorie: "Moment", sous_type: "Instant", couleur: "Mauve", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Si le premier Joueur qui attaque l'adversaire à ce tour ne vainc aucun Joueur, il gagne Provocation jusqu'à la fin du tour de l'adversaire." }
    ],
    resilience: "Bench un Joueur adverse engagé sans Provocation.",
    ambiance: "On a vu de belles choses"
  },
  {
    fichier: "056_R_Objet-Lien_Mauve_Le-Maillot-Maudit.avif", num: 56, nom: "Le Maillot Maudit",
    categorie: "Objet", sous_type: "Lien", couleur: "Mauve", rarete: "R",
    effets: [
      { texte: "Ce Joueur a -10 Attaque." },
      { icone: "declencheur", texte: "Lorsque ce Joueur vainc un Joueur, vous pouvez bench cet Objet pour bench un Joueur adverse engagé." }
    ],
    resilience: "Bench tous vos Joueurs pour mettre fin à la phase de Combat.",
    ambiance: "J'en ai jamais entendu parler"
  },
  {
    fichier: "057_E_Joueur_Mauve_Siborg.avif", num: 57, nom: "Siborg",
    categorie: "Joueur", couleur: "Mauve", rarete: "E", def: 160,
    attaques: [
      { nom: "AimBot.exe", cout: { neutre: 2 }, degats: 90 },
      { nom: "Titanic", cout: { mauve: 1, neutre: 2 }, degats: 140 }
    ],
    ambiance: "Programmé pour gagner"
  },
  {
    fichier: "058_E_Joueur_Mauve_Ghosty-In-Finals.avif", num: 58, nom: "Ghosty in Finals",
    categorie: "Joueur", couleur: "Mauve", rarete: "E", def: 130,
    attaques: [
      { nom: "Menace Fantôme", cout: { mauve: 1, neutre: 1 }, degats: 120 }
    ],
    mot_cle: { nom: "Provocation", texte: "L'attaquant face à ce Joueur doit le cibler." },
    ambiance: "You're so nervous"
  },
  {
    fichier: "059_E_Joueur_Mauve_Baby-Driver.avif", num: 59, nom: "Baby Driver",
    categorie: "Joueur", couleur: "Mauve", rarete: "E", def: 40,
    attaques: [
      { nom: "Vroom Vroom", cout: { mauve: 1 }, degats: 40 }
    ],
    mot_cle: { nom: "Shield", texte: "Tant qu'il est en jeu, ce Joueur ignore la première attaque qu'il subit." },
    ambiance: "Papa, tonton Itachi a dit des gros mots"
  },
  {
    fichier: "060_E_Joueur_Mauve_Gotaga-Pose.avif", num: 60, nom: "Gotaga Pose",
    categorie: "Joueur", couleur: "Mauve", rarete: "E", def: 150,
    attaques: [
      { nom: "Aspiration d'âme", cout: { mauve: 3, neutre: 1 }, degats: 150, effet: "+100 si l'adversaire a récuperé un PV ce tour.", plus: true }
    ],
    mot_cle: { nom: "Légion", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez défausser une carte pour récuperer ce Joueur dans votre main." },
    ambiance: "Souriez My CEO, vous êtes filmé"
  },
  {
    fichier: "061_E_Moment-Instant_Mauve_Champions-du-Major.avif", num: 61, nom: "Champions du Major",
    categorie: "Moment", sous_type: "Instant", couleur: "Mauve", rarete: "E",
    effets: [
      { icone: "etoile", texte: "Mélangez 3 de vos Essences Mauves dans votre Réserve pour bench un Joueur adverse." }
    ],
    ambiance: "Un trophée pareil nous était destiné"
  },
  {
    fichier: "062_C_Joueur_Verte_Just-Passion.avif", num: 62, nom: "Just Passion",
    categorie: "Joueur", couleur: "Verte", rarete: "C", def: 80,
    attaques: [
      { nom: "Confusion", cout: { verte: 1 }, degats: 90 }
    ],
    mot_cle: { nom: "Signature", texte: "Si vous avez moins de 2 PV, doublez la valeur d'attaque de ce Joueur." },
    ambiance: "Yes is a Enzo."
  },
  {
    fichier: "063_R_Joueur_Verte_Calma.avif", num: 63, nom: "Calma",
    categorie: "Joueur", couleur: "Verte", rarete: "R", def: 160,
    attaques: [
      { nom: "Sh*t On", cout: { verte: 2, neutre: 2 }, degats: 180 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Le Joueur adverse sur la même ligne ne peut pas défendre une attaque de ce Joueur ce tour." },
    ambiance: "!@/$#%!!"
  },
  {
    fichier: "064_PC_Joueur_Bleue_Bwarks.avif", num: 64, nom: "Bwarks",
    categorie: "Joueur", couleur: "Bleue", rarete: "PC", def: 90,
    attaques: [
      { nom: "Frappe de faute", cout: { bleue: 1 }, degats: 90 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque vous récupérez un PV, bench un Objet adverse." },
    ambiance: "Il a pris la grosse tête ou quoi ?"
  },
  {
    fichier: "065_C_Objet-Lien_Bleue_Jus-de-Bagarre.avif", num: 65, nom: "Jus de bagarre",
    categorie: "Objet", sous_type: "Lien", couleur: "Bleue", rarete: "C",
    effets: [
      { texte: "Ce Joueur peut attaquer le Joueur adverse sur sa ligne." }
    ],
    resilience: "Votre adversaire défausse 1 carte Joueur.",
    ambiance: "«J'ai le droit ! C'est moi j'ai fait»"
  },
  {
    fichier: "066_R_Moment-Instant_Bleue_L_Immense-Draculan.avif", num: 66, nom: "L'Immense Draculan",
    categorie: "Moment", sous_type: "Instant", couleur: "Bleue", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Défaussez 1 carte et engagez 2 Essences pour choisir une Essence adverse engagée et la mélanger dans la Réserve de son propriétaire." }
    ],
    resilience: "Engagez 1 Essence adverse.",
    ambiance: "On push A, B ou O+ ?"
  },
  {
    fichier: "067_E_Joueur_Bleue_1_-Chance.avif", num: 67, nom: "1% Chance",
    categorie: "Joueur", couleur: "Bleue", rarete: "E", def: 60,
    attaques: [
      { nom: "Rien à perdre", cout: { bleue: 1 }, degats: 60 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Ajoutez jusqu'à un 99% faith depuis votre club à votre main." },
    ambiance: "Ils ne savaient pas que c'était impossible..."
  },
  {
    fichier: "068_E_Joueur_Bleue_99_-Faith.avif", num: 68, nom: "99% Faith",
    categorie: "Joueur", couleur: "Bleue", rarete: "E", def: 120,
    attaques: [
      { nom: "Tout à gagner", cout: { bleue: 1, neutre: 1 }, degats: 120 }
    ],
    mot_cle: { nom: "Signature", texte: "Si 1% chance est déployé, ce Joueur gagne Provocation et Shield." },
    ambiance: "... alors ils l'ont fait"
  },
  {
    fichier: "069_PC_Joueur_Azur_L_Arme-Nucleaire.avif", num: 69, nom: "L'Arme Nucléaire",
    categorie: "Joueur", couleur: "Azur", rarete: "PC", def: 130,
    attaques: [
      { nom: "WaWar", cout: { azur: 1, neutre: 2 }, degats: 90, effet: "+20 pour chaque carte que vous avez en main.", plus: true }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque votre adversaire est touché, si ce Joueur est votre seul Joueur déployé, il défausse le PV sans le regarder." },
    ambiance: "Paint the Town Pink"
  },
  {
    fichier: "070_PC_Coach-Instant_Azur_Worlds-Japon.avif", num: 70, nom: "Worlds Japon",
    categorie: "Coach", sous_type: "Instant", couleur: "Azur", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "A la fin de votre première attaque, ajoutez en main le Joueur attaquant et jouez un autre Joueur depuis votre main à la même place." }
    ],
    resilience: "Jouez 2 Joueurs. A la fin de la phase de Combat, bench-les.",
    ambiance: "1. Haneda. 2. Perdre 350€ aux gacha 3. Podium à l'EVO."
  },
  {
    fichier: "071_R_Joueur_Azur_Versus-Fighting.avif", num: 71, nom: "Versus Fighting",
    categorie: "Joueur", couleur: "Azur", rarete: "R", def: 90,
    attaques: [
      { nom: "→↓↘ + 👊", cout: { azur: 2 }, degats: 90, effet: "A la fin de l'attaque, ajoutez ce Joueur à votre main et vous pouvez jouer un autre Joueur depuis votre main à la place." }
    ],
    mot_cle: { nom: "Garde", texte: "Ce Joueur peut défendre n'importe quelle attaque." },
    ambiance: "C'est pas de l'esport, c'est la FGC."
  },
  {
    fichier: "072_C_Moment-Instant_Neutre_Leakof.avif", num: 72, nom: "Leakof",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Regardez la Main de votre adversaire." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "«Nikof t'as pas les co**lles»"
  },
  {
    fichier: "073_C_Joueur_Neutre_L_Heritier.avif", num: 73, nom: "L'Héritier",
    categorie: "Joueur", couleur: "Neutre", rarete: "C", def: 110,
    attaques: [
      { nom: "Ascension", cout: { neutre: 2 }, degats: 120 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque le CEO adverse Lie un Objet à un Joueur, ce Joueur a +20 Défense jusqu'à la fin du tour." },
    ambiance: "Sérieux, il est pas trop mignon ?"
  },
  {
    fichier: "074_C_Joueur_Neutre_Grand-Respect.avif", num: 74, nom: "Grand Respect",
    categorie: "Joueur", couleur: "Neutre", rarete: "C", def: 130,
    attaques: [
      { nom: "Déboutonnage", cout: { neutre: 3 }, degats: 150 }
    ],
    mot_cle: { nom: "Garde", texte: "Ce Joueur peut défendre n'importe quelle attaque." },
    ambiance: "Ah c'est un peu chiant les gars..."
  },
  {
    fichier: "075_C_Joueur_Neutre_Petrodollars.avif", num: 75, nom: "Pétrodollars",
    categorie: "Joueur", couleur: "Neutre", rarete: "C", def: 140,
    attaques: [
      { nom: "Vol", cout: { neutre: 3 }, degats: 90, effet: "Regardez les 5 cartes du dessus de votre Club et liez jusqu'à 1 Objet parmi ces cartes à un autre de vos Joueurs." }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Liez 2 Objets de votre défausse à un autre de vos Joueurs." },
    ambiance: "Il y a des offres qu'on ne peut pas refuser !"
  },
  {
    fichier: "076_C_Joueur_Neutre_Ralliement.avif", num: 76, nom: "Ralliement",
    categorie: "Joueur", couleur: "Neutre", rarete: "C", def: 100,
    attaques: [
      { nom: "Déploiement", cout: { neutre: 2 }, degats: 10, effet: "Révélez les 5 cartes du dessus de votre Club et ajoutez une carte Joueur parmi les cartes révélées à votre main. Défaussez les cartes restantes." }
    ],
    mot_cle: { nom: "Buff", texte: "Vos Joueurs alliés gagnent +10 Défense." },
    ambiance: "GENTLE ?!"
  },
  {
    fichier: "077_PC_Joueur_Neutre_Brawks-Deter.avif", num: 77, nom: "Brawks Déter",
    categorie: "Joueur", couleur: "Neutre", rarete: "PC", def: 90,
    attaques: [
      { nom: "Déboîtement d'épaule", cout: { neutre: 1 }, degats: 90 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque votre adversaire récupère un PV suite à l'attaque de ce Joueur, piochez une carte." },
    ambiance: "185 CM, 89KG, 34 ANS"
  },
  {
    fichier: "078_PC_Joueur_Neutre_Le-Chevalier-Rose.avif", num: 78, nom: "Le Chevalier Rose",
    categorie: "Joueur", couleur: "Neutre", rarete: "PC", def: 80,
    attaques: [
      { nom: "Estafilade", cout: { neutre: 1 }, degats: 90 },
      { nom: "Serment", cout: { neutre: 2 }, degats: 120 }
    ],
    ambiance: "La Garde Rose meurt mais ne se rend pas !"
  },
  {
    fichier: "079_PC_Joueur_Neutre_Instalock.avif", num: 79, nom: "Instalock",
    categorie: "Joueur", couleur: "Neutre", rarete: "PC", def: 70,
    attaques: [
      { nom: "Pré-Clic", cout: { neutre: 2 }, degats: 110 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Vous pouvez engager ce Joueur pour bench un Joueur adverse." },
    ambiance: "5 duellistes... vraiment ?"
  },
  {
    fichier: "080_PC_Joueur_Neutre_Meet-Greeter.avif", num: 80, nom: "Meet & Greeter",
    categorie: "Joueur", couleur: "Neutre", rarete: "PC", def: 100,
    attaques: [
      { nom: "Permutation", cout: { neutre: 2 }, degats: 100 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque vous défendez avec ce Joueur, vous pouvez le renvoyer dans votre Club pour jouer un autre Joueur engagé à sa place en tant que défenseur." },
    ambiance: "J'y fus pas"
  },
  {
    fichier: "081_PC_Joueur_Neutre_Mon-Cogneur.avif", num: 81, nom: "Mon Cogneur",
    categorie: "Joueur", couleur: "Neutre", rarete: "PC", def: 170,
    attaques: [
      { nom: "Hexa-Punch", cout: { neutre: 4 }, degats: 190 }
    ],
    mot_cle: { nom: "Riposte", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant." },
    ambiance: "Ses manchettes lui permettent d'atteindre 88 clics par seconde"
  },
  {
    fichier: "082_C_Coach-Instant_Neutre_Barakataga.avif", num: 82, nom: "Barakataga",
    categorie: "Coach", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Les CEO piochent jusqu'à avoir 4 cartes en main." }
    ],
    resilience: "Piochez 2 cartes.",
    ambiance: "Encore un jackpot comme par hasard..."
  },
  {
    fichier: "083_C_Coach-Instant_Neutre_Mercato.avif", num: 83, nom: "Mercato",
    categorie: "Coach", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Piochez 3 cartes." }
    ],
    resilience: "Regardez les 5 cartes du dessus de votre Club et ajoutez une carte Joueur à votre main. Remettez les autres cartes en dessous de votre Club dans l'ordre de votre choix.",
    ambiance: "L'échange est équivalent, mais à notre avantage quand même."
  },
  {
    fichier: "084_PC_Objet-Lien_Neutre_La-Chevaliere.avif", num: 84, nom: "La Chevalière",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "PC",
    effets: [
      { icone: "declencheur", texte: "Lorsque vous déclenchez une attaque, vous pouvez bench cet Objet pour qu'elle coûte 2 Essence Neutre." }
    ],
    resilience: "Les prochaines attaques de votre adversaire coûtent une Essence Neutre de plus.",
    ambiance: "La vraie bague de mariage de Gotaga"
  },
  {
    fichier: "085_C_Objet-Lien_Neutre_Cooked.avif", num: 85, nom: "Cooked",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +30 Attaque." }
    ],
    resilience: "Ajoutez une carte Moment de votre défausse à votre main.",
    ambiance: "Ah là on est bien cuits."
  },
  {
    fichier: "086_C_Objet-Lien_Neutre_En-Slip-Sur-La-Faille.avif", num: 86, nom: "En slip sur la Faille",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "declencheur", texte: "Lorsque ce Joueur est engagé, vous pouvez bench cet Objet pour le désengager. Ce Joueur ne peut plus attaquer ce tour." }
    ],
    resilience: "Vos Objet bench sont ajoutés à votre main jusqu'à la fin du tour.",
    ambiance: "All roads lead to the slip"
  },
  {
    fichier: "087_C_Objet-Lien_Neutre_Gros-Bonnet.avif", num: 87, nom: "Gros Bonnet",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +30 Défense." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Je vais lui offrir un code qu'il ne pourra pas refuser"
  },
  {
    fichier: "088_C_Objet-Lien_Neutre_M4.avif", num: 88, nom: "M4",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +15 Attaque." },
      { icone: "declencheur", texte: "Lorsque vous déclenchez une attaque avec ce Joueur, vous pouvez défausser jusqu'à 3 cartes pour avoir +10 Attaque pour chaque carte défaussée." }
    ],
    resilience: "Défaussez une carte et piochez une carte. Si la carte défaussée est une carte Joueur, un Joueur adverse a -30 Attaque.",
    ambiance: "Les temps difficiles créent des supporters forts."
  },
  {
    fichier: "089_PC_Objet-Lien_Neutre_La-Luxueuse-I.avif", num: 89, nom: "La Luxueuse I",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "PC",
    effets: [
      { texte: "Ce Joueur a +10 Défense pour chaque Objet Lié à lui." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Combien !?!"
  },
  {
    fichier: "090_PC_Objet-Lien_Neutre_La-Luxueuse-II.avif", num: 90, nom: "La Luxueuse II",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "PC",
    effets: [
      { icone: "declencheur", texte: "Lorsque l'adversaire attaque cette ligne, mélangez une carte de votre défausse dans votre Club et piochez 1 carte." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Ceintre disponible seulement dans le TCG Gentle Mates"
  },
  {
    fichier: "091_C_Moment-Instant_Neutre_C_est-Officiel.avif", num: 91, nom: "C'est officiel !",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Votre adversaire choisit entre les deux effets suivants : - Piochez 3 cartes et votre adversaire pioche 2 cartes. - Votre adversaire défausse 2 cartes et vous défaussez 1 carte." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Evidemment, personne ne le savait..."
  },
  {
    fichier: "092_C_Moment-Instant_Neutre_Clim.avif", num: 92, nom: "Clim",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Bench un Objet adverse." }
    ],
    resilience: "Un Joueur adverse sans Objet ne peut plus attaquer jusqu'à la fin du tour.",
    ambiance: "Si seulement j'avais une belle polaire à mettre..."
  },
  {
    fichier: "093_C_Moment-Instant_Neutre_Alerte-Leak.avif", num: 93, nom: "Alerte Leak",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Révélez vos PV." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Père Leakof, raconte nous une histoire."
  },
  {
    fichier: "094_C_Moment-Instant_Neutre_One-More.avif", num: 94, nom: "One More",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Chaque fois que vous piochez à ce tour, vous piochez une carte de plus." }
    ],
    resilience: "Votre adversaire doit déclencher une attaque de plus si possible.",
    ambiance: "Présent !"
  },
  {
    fichier: "095_C_Moment-Instant_Neutre_Tunnel.avif", num: 95, nom: "Tunnel",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "Si vous avez un Joueur seul sur sa ligne, piochez 2 cartes." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Je demandais juste comment ça va"
  },
  {
    fichier: "096_C_Moment-Instant_Neutre_Tweet-La-Defaite.avif", num: 96, nom: "Tweet la Défaite",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "C",
    effets: [
      { icone: "etoile", texte: "La première fois que votre adversaire récupère un PV ce tour, les Joueurs adverses ont -20 Défense." }
    ],
    resilience: "Un Joueur adverse a -20 Attaque.",
    ambiance: "Plus rapide que la notif."
  },
  {
    fichier: "097_PC_Moment-Instant_Neutre_Doig_Dance.avif", num: 97, nom: "Doig'Dance",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "La première Attaque que vous déclenchez à ce tour, coûte 1 Essence Neutre de moins." }
    ],
    resilience: "2 de vos Joueurs ont +20 Défense.",
    ambiance: "«Et pourtant, elle tourne»"
  },
  {
    fichier: "098_PC_Moment-Instant_Neutre_Meta-Coeurs.avif", num: 98, nom: "Méta Cœurs",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Mélangez 6 cartes Joueur de votre défausse à votre Club." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Toujours kaiwaiiné, toujours cute"
  },
  {
    fichier: "099_PC_Moment-Instant_Neutre_Meta-F-ck.avif", num: 99, nom: "Méta F*ck",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "PC",
    effets: [
      { icone: "etoile", texte: "Révélez les 6 cartes du dessus de votre Club et ajoutez une carte Moment parmi les cartes révélées à votre main. Défaussez les cartes restantes." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Y'a plus de kawaiiné"
  },
  {
    fichier: "100_R_Joueur_Neutre_Loup-Du-Game.avif", num: 100, nom: "Loup du Game",
    categorie: "Joueur", couleur: "Neutre", rarete: "R", def: 130,
    attaques: [
      { nom: "Doig BYE BYE BYE", cout: { neutre: 3 }, degats: 160 }
    ],
    mot_cle: { nom: "Légion", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main." },
    ambiance: "Tu es capable de réaliser tes rêves"
  },
  {
    fichier: "101_R_Joueur_Neutre_Slay.avif", num: 101, nom: "Slay",
    categorie: "Joueur", couleur: "Neutre", rarete: "R", def: 120,
    attaques: [
      { nom: "Choc D'Août", cout: { neutre: 2 }, degats: 120 }
    ],
    mot_cle: { nom: "Signature", texte: "Si ce Joueur est désengagé, l'attaquant face à lui doit le cibler." },
    ambiance: "Pour avoir du style en toutes Situations."
  },
  {
    fichier: "102_R_Joueur_Neutre_Monster.avif", num: 102, nom: "Monster",
    categorie: "Joueur", couleur: "Neutre", rarete: "R", def: 70,
    attaques: [
      { nom: "Hyper-Vitesse", cout: { neutre: 1 }, degats: 100 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Vous pouvez engager 2 Essence pour piocher 2 cartes." },
    ambiance: "How should I feel ?"
  },
  {
    fichier: "103_R_Coach-Instant_Neutre_Joueur-de-l_Ombre.avif", num: 103, nom: "Joueur de l'Ombre",
    categorie: "Coach", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Déclenchez l'effet d'entrée d'un Joueur de votre défausse." }
    ],
    resilience: "Défaussez votre main et piochez autant de cartes que le nombre de cartes défaussées.",
    ambiance: "Merci à vous"
  },
  {
    fichier: "104_R_Coach-Instant_Neutre_LofiGirl.avif", num: 104, nom: "Lofi Girl",
    categorie: "Coach", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Désengagez un de vos Joueurs." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Enfin diplômée !"
  },
  {
    fichier: "105_R_Objet-Lien_Neutre_M16.avif", num: 105, nom: "M16",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "R",
    effets: [
      { texte: "Ce Joueur a +20 Attaque." },
      { icone: "declencheur", texte: "Lorsque votre adversaire déclare un défenseur sur l'attaque de ce Joueur, révélez la carte du dessus de votre Club. Si c'est une carte Joueur ce Joueur a +20 Attaque." }
    ],
    resilience: "Révélez la carte du dessus de votre Club. Si c'est une carte Joueur, jouez-la.",
    ambiance: "L'endroit parfait pour farmer du métal."
  },
  {
    fichier: "106_R_Objet-Lien_Neutre_Trahison.avif", num: 106, nom: "Trahison++",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "declencheur", texte: "Lorsque votre adversaire déclare un défenseur sur l'attaque de ce Joueur, vous pouvez bench cet Objet pour désengager ce Joueur et annuler l'attaque. Ce Joueur ne peut plus attaquer jusqu'à la fin du tour." }
    ],
    resilience: "Un Joueur adverse ne peut plus attaquer jusqu'à la fin du tour.",
    ambiance: "À jamais l'écharpe de la victoire.🏆"
  },
  {
    fichier: "107_R_Moment-Instant_Neutre_GP-Explorer-III.avif", num: 107, nom: "GP Explorer III",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Engagez 2 Essences pour piocher 3 cartes." }
    ],
    resilience: "Désengagez 2 Essences.",
    ambiance: "À jamais les 5es."
  },
  {
    fichier: "108_R_Moment-Instant_Neutre_Keynote.avif", num: 108, nom: "Keynote",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Renvoyez tous vos Joueurs dans la main de leur propriétaire." }
    ],
    resilience: "Ajoutez une carte Joueur de votre défausse à votre main.",
    ambiance: "Le live va bientôt commencer..."
  },
  {
    fichier: "109_R_Moment-Instant_Neutre_Hatewatch.avif", num: 109, nom: "Hatewatch",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Bench un de vos Joueurs et votre adversaire défausse une carte." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Oh non, trop deg pour vous..."
  },
  {
    fichier: "110_R_Moment-Instant_Neutre_Leakof.avif", num: 110, nom: "Leakof",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "Regardez les 5 cartes du dessus du Club adverse." }
    ],
    resilience: "Jouez cette carte.",
    ambiance: "Ok donc pour le merch on laisse plutôt Brawks leaker."
  },
  {
    fichier: "111_R_Moment-Instant_Neutre_La-Gaming-House.avif", num: 111, nom: "La Gaming House",
    categorie: "Moment", sous_type: "Instant", couleur: "Neutre", rarete: "R",
    effets: [
      { icone: "etoile", texte: "La deuxième attaque que vous déclenchez à ce tour, coûte 2 Essences non neutre de moins." }
    ],
    resilience: "Vos Joueurs ont +10 Défense jusqu'à la fin du tour.",
    ambiance: "Merci de bien retirer vos chaussures"
  },
  {
    fichier: "112_E_Joueur_Neutre_M8-Resilience.avif", num: 112, nom: "M8 Résilience",
    categorie: "Joueur", couleur: "Neutre", rarete: "E", def: 130,
    attaques: [
      { nom: "Avenir Radieux", cout: { neutre: 2 }, degats: 120 }
    ],
    mot_cle: { nom: "Signature", icone: "declencheur", texte: "Lorsque le CEO adverse attaque cette ligne, piochez 1 carte." },
    ambiance: "L'espoir est le dernier à mourir."
  },
  {
    fichier: "113_L_Joueur_Rose_Kampai.avif", num: 113, nom: "Kampaï",
    categorie: "Joueur", couleur: "Rose", rarete: "L", def: 150,
    attaques: [
      { nom: "Coup d'jus", cout: { rose: 2, neutre: 1 }, degats: 150 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Si vous avez 3 Joueurs Roses renvoyez un Joueur adverse dans sa main." },
    ambiance: "俺たちが世界一のFPS構造を創り上げてやる！"
  },
  {
    fichier: "114_L_Moment-Instant_Rose_SBG.avif", num: 114, nom: "SBG",
    categorie: "Moment", sous_type: "Instant", couleur: "Rose", rarete: "L",
    effets: [
      { icone: "etoile", texte: "Piochez 1 carte pour chaque Joueur adverse engagé." }
    ],
    ambiance: "Ça veut dire «Squeezie, Brawks et Gotaga» en gros"
  },
  {
    fichier: "115_L_Moment-Instant_Orange_Champions-Du-Monde.avif", num: 115, nom: "Champions du Monde",
    categorie: "Moment", sous_type: "Instant", couleur: "Orange", rarete: "L",
    effets: [
      { icone: "etoile", texte: "Un de vos Joueurs gagne Riposte et Shield jusqu'à la fin du tour adverse." }
    ],
    ambiance: "J'ai voulu faire Top 1"
  },
  {
    fichier: "116_L_Joueur_Mauve_The-French-Sorcerer.avif", num: 116, nom: "The French Sorcerer",
    categorie: "Joueur", couleur: "Mauve", rarete: "L", def: 180,
    attaques: [
      { nom: "Foudre de Rage", cout: { mauve: 2, neutre: 1 }, degats: null, effet: "Bench un Joueur adverse. Mélangez 1 de vos Essences Mauves dans votre Réserve." },
      { nom: "Éclairs Vengeurs", cout: { mauve: 2, neutre: 2 }, degats: 200, effet: "Mélangez 2 de vos Essences Mauves dans votre Réserve." }
    ],
    ambiance: "... qu'on nous appelle les PARIS GENTLE MATES"
  },
  {
    fichier: "117_L_Joueur_Mauve_La-Releve.avif", num: 117, nom: "La Relève",
    categorie: "Joueur", couleur: "Mauve", rarete: "L", def: 120,
    attaques: [
      { nom: "Sang Froid", cout: { mauve: 1, neutre: 1 }, degats: 140 }
    ],
    mot_cle: { nom: "Signature", icone: "etoile", texte: "Bench jusqu'à un Baby Driver que vous controlez et piochez 3 cartes." },
    ambiance: "Le prochain CachéDansLeBuisson, c'est toi !"
  },
  {
    fichier: "118_L_Joueur_Mauve_Gotaga-Dance.avif", num: 118, nom: "Gotaga Dance",
    categorie: "Joueur", couleur: "Mauve", rarete: "L", def: 90,
    attaques: [
      { nom: "Cancel Slide", cout: { mauve: 2 }, degats: 150 }
    ],
    mot_cle: { nom: "Légion", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main." },
    ambiance: "OH OH OH BACHATA"
  },
  {
    fichier: "119_L_Joueur_Neutre_Gotaga-Circus.avif", num: 119, nom: "Gotaga Circus",
    categorie: "Joueur", couleur: "Neutre", rarete: "L", def: 110,
    attaques: [
      { nom: "Contre-Pitre", cout: { neutre: 1 }, degats: 10 }
    ],
    mot_cle: { nom: "Provocation", texte: "L'attaquant face à ce Joueur doit le cibler." },
    ambiance: "Tu crois qu'on joue alors qu'on travaille"
  },
  {
    fichier: "120_L_Joueur_Neutre_BrawksSaga.avif", num: 120, nom: "Brawks Saga",
    categorie: "Joueur", couleur: "Neutre", rarete: "L", def: 150,
    attaques: [
      { nom: "Mâchouille", cout: { neutre: 2 }, degats: 120 }
    ],
    mot_cle: { nom: "Garde", texte: "Ce Joueur peut défendre n'importe quelle attaque." },
    ambiance: "Je n'ai aucun adversaire."
  },
  {
    fichier: "121_L_Joueur_Neutre_Le-Marionnettiste.avif", num: 121, nom: "Le Marionnettiste",
    categorie: "Joueur", couleur: "Neutre", rarete: "L", def: 140,
    attaques: [
      { nom: "Coup de fil", cout: { neutre: 3 }, degats: 160 }
    ],
    mot_cle: { nom: "Riposte", icone: "declencheur", texte: "Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant." },
    ambiance: "Merci, Ô grand Squeezie, pour ta générosité"
  },
  {
    fichier: "122_L_Objet-Lien_Neutre_La-Luxueuse-III.avif", num: 122, nom: "La Luxueuse III",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "L",
    effets: [
      { texte: "Ce Joueur a +10 Défense pour chaque Objet Lié à lui." },
      { icone: "declencheur", texte: "Lorsque le CEO adverse attaque cette ligne, mélangez une carte de votre défausse dans votre club et piochez 1 carte." }
    ],
    ambiance: "Si Gentle Mates n'a plus aucun fan c'est que je suis mort"
  }
];

// ---- js/promos-data.js
/* Les cartes Promo : elles ne sortent jamais d'un booster et ne comptent pas
   dans le total de l'extension. On les obtient autrement — en boutique, ou en
   récompense d'un palier de collection.

   Elles vivent dans leur propre liste (`promos`, et non `cards`) : c'est ce qui
   garantit que « 122 cartes » reste 122 partout, et que le pourcentage de
   collection ne bouge pas quand on en ajoute une.

   Le champ `obtention` n'est là que pour l'affichage : c'est le serveur qui
   accorde vraiment ces cartes (supabase/installation/03b_promos.sql). */
"use strict";

const PROMO_DATA = [
  {
    code: 'P01', fichier: 'promos/P01-Major_De_Paris.webp', nom: 'Major de Paris',
    categorie: 'Coach', sous_type: 'Support', couleur: 'Mauve',
    effets: [
      { texte: 'Cherchez 1 Joueur [Mauve] ou 1 Essence [Mauve] dans votre Club, montrez-la au CEO adverse puis mélangez votre Club.' }
    ],
    illustrateur: 'Justice Wong & HL',
    obtention: 'boutique'
  },
  {
    code: 'P02', fichier: 'promos/P02-Major_De_Paris.webp', nom: 'Major de Paris',
    categorie: 'Coach', sous_type: 'Support', couleur: 'Mauve',
    variante: 'Illustration alternative',
    effets: [
      { texte: 'Cherchez 1 Joueur [Mauve] ou 1 Essence [Mauve] dans votre Club, montrez-la au CEO adverse puis mélangez votre Club.' }
    ],
    illustrateur: 'Rexpo',
    obtention: 'boutique'
  },
  /* Les Promos des deux Starter Decks : on reçoit celle de sa Section en la
     rejoignant, l'autre en finissant la campagne. Jusqu'à la 3.0.12, deux
     cartes provisoires, sans illustration ni talent. Version 3.0.13 : les
     vraies, d'après les photos du propriétaire (1er novembre 2026) — P03
     est celle de la Section Déter (Brawks Déter, la #077 en Promo), P04
     celle de Toxique (Squeezie le Toxique, la #012), l'inverse des
     provisoires. Visuels : les photos redressées (tools/redresser-photo.js),
     en attendant des scans propres. */
  {
    code: 'P03', fichier: 'promos/P03-Brawks_Deter.webp', nom: 'Brawks Déter', section: 'deter',
    categorie: 'Joueur', couleur: 'Neutre', def: 90,
    attaques: [
      { nom: "Déboîtement d'épaule", cout: { neutre: 1 }, degats: 90 }
    ],
    mot_cle: { nom: 'Signature', icone: 'declencheur', texte: "Lorsque votre adversaire récupère un PV suite à l'attaque de ce Joueur, piochez une carte." },
    illustrateur: 'Hugo Lucas',
    ambiance: '185 CM, 89KG, 34 ANS',
    obtention: 'section'
  },
  {
    code: 'P04', fichier: 'promos/P04-Squeezie_Le_Toxique.webp', nom: 'Squeezie le Toxique', section: 'toxique',
    categorie: 'Joueur', couleur: 'Rose', def: 110,
    attaques: [
      { nom: 'Trash-talk', cout: { rose: 1, neutre: 1 }, degats: 110 }
    ],
    mot_cle: { nom: 'Signature', icone: 'etoile', texte: 'Engagez un Joueur adverse.' },
    illustrateur: 'Manon Tsukui & HL',
    ambiance: 'Prout.',
    obtention: 'section'
  },
  {
    code: 'P05', fichier: 'promos/P05-Tout_Commence_Ici.webp', nom: 'Tout Commence Ici',
    categorie: 'Joueur', couleur: 'Rose', def: 60,
    attaques: [
      { nom: 'Premier Souffle', cout: { neutre: 1 }, degats: 90 }
    ],
    mot_cle: { nom: 'Légion', texte: "Lorsqu'il est vaincu, le Joueur retourne dans votre Main. Défaussez les Coachs associés." },
    illustrateur: 'Levinky',
    ambiance: "Gentle Mates : c'est comme ça que nous nous appellerons.",
    obtention: 'master'
  },
  {
    code: 'P06', fichier: 'promos/P06-Le_Marionnettiste_v2.webp', nom: 'Le Marionnettiste',
    categorie: 'Joueur', couleur: 'Neutre', def: 140,
    attaques: [
      { nom: 'Coup de fil', cout: { neutre: 3 }, degats: 160 }
    ],
    mot_cle: { nom: 'Riposte', texte: "Lorsqu'il est vaincu, ce Joueur active sa Capacité d'Attaque la plus puissante." },
    illustrateur: 'Gobli Prin',
    ambiance: 'Merci, Ô grand Squeezie, pour ta générosité',
    obtention: 'palier'
  }
];

/* La carte unique : un seul exemplaire dans tout le jeu, distribué par la
   chasse (supabase/installation/15_evenements.sql). Comme les Promos, elle vit hors de
   l'extension. Une image refaite change de nom (`_v2`) : le service worker
   garde les images sous leur nom, l'ancienne resterait affichée. */
const UNIQUE_DATA = [
  {
    code: 'U01', fichier: 'uniques/U01-L_Unique_Chevaliere_v2.webp', nom: 'L\'Unique Chevalière',
    categorie: 'Objet', sous_type: 'Lien', couleur: 'Neutre',
    effets: [
      { texte: 'Lorsque vous déclenchez une attaque, vous pouvez défausser cet Objet pour qu\'elle coûte 2 Énergie Neutre.' }
    ],
    resilience: 'Les prochaines attaques de votre adversaire coûtent une Énergie Neutre de plus.',
    illustrateur: 'Lévinky',
    ambiance: 'Une Chevalière pour les honorer tous'
  }
];

/* Version 3.0 : les Secrètes. Numérotées à la suite de l'extension
   (« 123/122 »), elles sortent des boosters — 0,75 % de la dernière carte —
   mais ne comptent pas dans les 122 : comme les Promos, elles sont hors du
   total et du pourcentage. Elles s'échangent ; elles ne se recyclent ni ne
   se fabriquent. Le serveur les tire dans public.cards
   (supabase/installation/24_secretes.sql). Une Secrète pas encore révélée
   (`cachee`) a son visuel flouté et ni nom ni texte : on peut l'obtenir, pas
   la jouer. Depuis la 3.0.13, les cinq sont révélées : 124, 126 et 127
   d'après les photos du propriétaire (1er novembre 2026), redressées
   (tools/redresser-photo.js) en attendant des scans propres. */
const SECRET_DATA = [
  {
    fichier: '123_S_Joueur_Orange_Le-Quatrieme-du-Nom.avif', num: 123, nom: 'Le Quatrième du Nom',
    categorie: 'Joueur', couleur: 'Orange', def: 160,
    attaques: [
      { nom: 'Kalinade', cout: { orange: 1, neutre: 1 }, degats: 100 },
      { nom: 'Victoire Royale', cout: { orange: 4 }, degats: 180 }
    ],
    illustrateur: 'Levinky',
    ambiance: 'Vous savez que j\'ai participé à la première World Cup moi ?'
  },
  {
    fichier: '124_S_Joueur_Violette_Brawks-Trop-Deter.webp', num: 124, nom: 'Brawks Trop Déter',
    categorie: 'Joueur', couleur: 'Violette', def: 130,
    attaques: [
      /* « Sermont » : tel qu'imprimé sur la carte photographiée. */
      { nom: 'Sermont', cout: { violette: 1, neutre: 1 }, degats: 110 }
    ],
    mot_cle: { nom: 'Signature', icone: 'declencheur', texte: 'Lorsque votre adversaire récupère un PV suite à l\'attaque de ce Joueur, désengagez tous vos Joueurs.' },
    illustrateur: 'Tan Zhi Hui',
    ambiance: 'Je vais aller le chercher après.'
  },
  {
    fichier: '125_S_Joueur_Mauve_6W26L.avif', num: 125, nom: '6W26L',
    categorie: 'Joueur', couleur: 'Mauve', def: 60,
    attaques: [
      { nom: 'UltiM8um', cout: { mauve: 2 }, degats: 60, plus: true, effet: '+60 pour chaque PV récupéré par votre adversaire ce tour.' }
    ],
    mot_cle: { nom: 'Légion', icone: 'declencheur', texte: 'Lorsqu\'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main.' },
    illustrateur: 'Gobli Prin',
    ambiance: 'Je reviens mais à une condition...'
  },
  {
    fichier: '126_S_Moment-Instant_Neutre_GP-Explorer-II.webp', num: 126, nom: 'GP Explorer II',
    categorie: 'Moment', sous_type: 'Instant', couleur: 'Neutre',
    effets: [
      { icone: 'etoile', texte: 'Les CEO choisissent chacun 2 de leurs Joueurs et récupèrent les autres en main. Vous ne pouvez plus jouer de Joueur pour le reste de ce tour.' }
    ],
    illustrateur: 'Hugo Lucas',
    ambiance: 'On s\'émerveille, yeux dans les yeux'
  },
  {
    fichier: '127_S_Moment-Instant_Mauve_Paris-Gentle-Mates.webp', num: 127, nom: 'Paris Gentle Mates',
    categorie: 'Moment', sous_type: 'Instant', couleur: 'Mauve',
    effets: [
      { icone: 'etoile', texte: 'Mélangez 2 de vos Essences Mauves dans votre Réserve pour doubler la valeur de la première attaque que vous déclenchez ce tour.' }
    ],
    illustrateur: 'Dexter Maurer',
    ambiance: 'Ça aurait dû être La Rochelle...'
  }
];

// ---- js/cards.js
/* Construit les cartes du jeu à partir de CARD_DATA : normalisation des champs et valeurs par défaut. */
"use strict";

/* ---------- Normalisation des champs ---------- */
function normCol(v) {
  let s = noacc(v);
  if (s === 'violet') s = 'violette';
  if (s === 'vert') s = 'verte';
  if (s === 'bleu') s = 'bleue';
  return COLORS[s] ? s : null;
}

function normCat(v) {
  const s = noacc(v);
  if (s.startsWith('joueur')) return 'joueur';
  if (s.startsWith('coach')) return 'coach';
  if (s.startsWith('moment')) return 'moment';
  if (s.startsWith('objet')) return 'objet';
  if (s.startsWith('essence')) return 'essence';
  return null;
}

function normRar(v) {
  const s = String(v == null ? '' : v).toUpperCase().trim();
  return RAR[s] ? s : null;
}

function normCost(o) {
  if (typeof o === 'number') return { neutre: o };
  const r = {};
  if (o && typeof o === 'object') {
    for (const k in o) {
      const c = normCol(k) || 'neutre';
      const n = +o[k] || 0;
      if (n > 0) r[c] = (r[c] || 0) + n;
    }
  }
  if (!Object.keys(r).length) r.neutre = 1;
  return r;
}

/* Première valeur définie parmi plusieurs champs ; garde un 0 explicite (contrairement à ||). */
function firstDefined(...vals) {
  return vals.find(v => v != null && v !== '');
}

/* ---------- Une carte ---------- */
/* L'identifiant vient du numéro : la collection sauvegardée est rangée par id, il doit rester stable. */
const cardId = num => 'c' + String(num).padStart(3, '0');

function makeCard(meta, idx) {
  meta = meta || {};
  const cat = normCat(meta.categorie) || 'joueur';
  const rar = normRar(meta.rarete) || (cat === 'essence' ? 'ES' : 'C');
  const num = +meta.num || idx + 1;

  const c = {
    id: cardId(num),
    num,
    nom: String(meta.nom || 'Carte'),
    cat,
    col: normCol(meta.couleur) || 'neutre',
    rar,
    sous: String(meta.sous_type || ''),
    img: meta.fichier ? CARD_DIR + meta.fichier : null,
    inBoost: meta.booster !== false,
    atks: [],
    kw: null,
    fx: []
  };

  if (cat === 'joueur') {
    const defRaw = firstDefined(meta.def, meta.pv);
    c.def = defRaw != null ? (+defRaw || 0) : (DEFV[rar] || 90);
    const at = (Array.isArray(meta.attaques) ? meta.attaques : []).filter(a => a && typeof a === 'object');
    /* Une ligne sans Essence devant n'est pas une attaque : c'est un talent
       (version 3.0). Il ne se paie pas et ne se déclenche pas comme une
       attaque ; le combat le lit dans `talents`. */
    const talent = a => a.cout == null || (typeof a.cout === 'object' && !Object.values(a.cout).some(n => +n > 0));
    c.atks = at.filter(a => !talent(a)).map(a => ({
      nom: String(a.nom || 'Attaque'),
      cout: normCost(a.cout),
      degats: (a.degats == null || a.degats === '') ? null : (+a.degats || 0),
      effet: String(a.effet || ''),
      plus: !!a.plus
    }));
    c.talents = at.filter(talent).map(a => ({ nom: String(a.nom || 'Talent'), texte: String(a.effet || '') }));
    if (!at.length) c.atks = [{ nom: 'Attaque', cout: { neutre: 2 }, degats: DEFD[rar] || 60, effet: '', plus: false }];
    if (meta.mot_cle && meta.mot_cle.nom) {
      c.kw = { nom: String(meta.mot_cle.nom), texte: String(meta.mot_cle.texte || '') };
    }
  } else {
    c.fx = Array.isArray(meta.effets) ? meta.effets.map(e => e && e.texte ? String(e.texte) : '').filter(Boolean) : [];
  }
  /* Version 3.0 : la Résilience, jouée quand la carte sort des PV en combat
     (js/combat/moteur.js). */
  if (meta.resilience) c.res = String(meta.resilience);

  return c;
}

/* ---------- Les cartes Promo ---------- */
/* Elles passent par le même moule que les autres — mêmes champs, même rendu —
   mais gardent leur identifiant à elles (`p01` et non `c001`) et une rareté à
   part. C'est ce qui les tient hors de l'extension partout : elles ne sont pas
   dans `cards`, donc pas dans le total, pas dans le pourcentage, et pas dans
   le tirage d'un booster. */
function makePromo(meta) {
  const num = +String(meta.code || '').replace(/\D/g, '') || 0;
  const c = makeCard({
    nom: meta.nom,
    categorie: meta.categorie,
    sous_type: meta.sous_type,
    couleur: meta.couleur,
    rarete: 'PR',
    def: meta.def,
    attaques: meta.attaques,
    mot_cle: meta.mot_cle,
    effets: meta.effets,
    resilience: meta.resilience,
    fichier: meta.fichier,
    booster: false,
    num
  }, num - 1);

  c.id = 'p' + String(num).padStart(2, '0');
  c.code = meta.code;
  c.promo = true;
  c.obtention = meta.obtention || 'boutique';
  c.illustrateur = meta.illustrateur || '';
  /* Version 3.0 : la Promo d'un Starter Deck dit sa Section ; une Promo
     dont on ne connaît pas encore le contenu est `provisoire` (aucune depuis
     la 3.0.13). */
  if (meta.section) c.section = meta.section;
  if (meta.provisoire) c.provisoire = true;
  return c;
}

function buildPromos() {
  if (typeof PROMO_DATA === 'undefined') return [];
  return PROMO_DATA.map(makePromo).sort((a, b) => a.num - b.num);
}

/* ---------- Les Essences Brillantes ---------- */
/* La version brillante de chaque Essence : même illustration, autre finition
   (le reflet est posé par renderCard). `b` + le numéro de l'Essence, comme
   côté serveur (supabase/installation/03b_promos.sql). Hors extension, comme les Promos. */
function buildBrillantes(liste) {
  return liste.filter(c => c.cat === 'essence').map(e => Object.assign({}, e, {
    id: 'b' + e.id.slice(1),
    nom: e.nom + ' Brillante',
    rar: 'BR',
    inBoost: false,
    promo: true,
    foil: true,
    base: e.id,
    code: '#' + String(e.num || 0).padStart(3, '0') + ' ✧'
  }));
}

/* ---------- Les Reverses (version 2.0) ---------- */
/* Chaque Commune, Peu commune et Rare de l'extension a sa Reverse : la même
   carte, frappée du logo Tout Commence Ici (posé par renderCard). `r` + le
   numéro, comme côté serveur (supabase/installation/03b_promos.sql). Hors des 122, mais
   échangeables, recyclables et fabricables — d'où `promo: false` ici : côté
   navigateur, c'est `rev` qui les met à part. */
function buildReverses(liste) {
  return liste.filter(c => ['C', 'PC', 'R'].includes(c.rar) && c.cat !== 'essence').map(c => Object.assign({}, c, {
    id: 'r' + c.id.slice(1),
    /* Le nom reste celui de la carte : elle se reconnaît à son reflet, et une
       petite icône la signale dans les listes où l'on ne voit que le nom
       (nomH). */
    inBoost: false,
    promo: false,
    rev: true,
    base: c.id,
    code: '#' + String(c.num || 0).padStart(3, '0') + ' R'
  }));
}

/* ---------- La carte unique ---------- */
function buildUniques() {
  if (typeof UNIQUE_DATA === 'undefined') return [];
  return UNIQUE_DATA.map(meta => {
    const num = +String(meta.code).replace(/\D/g, '') || 1;
    const c = makeCard({
      nom: meta.nom, categorie: meta.categorie, sous_type: meta.sous_type,
      couleur: meta.couleur, rarete: 'UN', effets: meta.effets, resilience: meta.resilience,
      fichier: meta.fichier, booster: false, num
    }, num - 1);
    c.id = 'u' + String(num).padStart(2, '0');
    c.code = meta.code;
    c.promo = true;
    c.unique = true;
    c.illustrateur = meta.illustrateur || '';
    return c;
  });
}

/* ---------- Les Secrètes (version 3.0) ---------- */
/* `c123`… comme les cartes de l'extension, et le même moule ; mais elles
   vivent dans leur liste (`secretes`), hors des 122. `secrete` les met à part
   partout où l'on compte, et les laisse s'échanger. Une Secrète pas encore
   révélée (`cachee`) n'a que son visuel flouté. */
function buildSecretes() {
  if (typeof SECRET_DATA === 'undefined') return [];
  return SECRET_DATA.map(meta => {
    const c = makeCard(Object.assign({ rarete: 'S' }, meta, meta.cachee
      ? { nom: 'Secrète n°' + meta.num, categorie: 'Joueur', couleur: 'Neutre', attaques: [] } : {}), meta.num - 1);
    c.rar = 'S';
    c.secrete = true;
    c.promo = false;
    c.code = '#' + meta.num + '/' + CARD_DATA.length;
    c.illustrateur = meta.illustrateur || '';
    if (meta.cachee) { c.cachee = true; c.atks = []; c.kw = null; c.def = null; }
    return c;
  });
}

/* ---------- La liste complète ---------- */
function buildCards() {
  const list = CARD_DATA.map(makeCard).sort((a, b) => a.num - b.num);
  const seen = new Set();
  list.forEach(c => {
    if (seen.has(c.id)) console.warn(`Deux cartes portent le numéro ${c.num} (${c.nom}) : la collection les confondra.`);
    seen.add(c.id);
  });
  return list;
}

// ---- js/combat/moteur.js
/* Le moteur des combats (version 3.0) : les règles, sans écran.

   Tout ce qui se passe dans une partie part d'ici. L'interface
   (js/combat/table.js) montre l'état et transmet les choix du joueur ; l'IA
   (js/combat/ia.js) choisit parmi les mêmes actions que lui. Les effets des
   cartes sont écrits à part, carte par carte (js/combat/effets.js).

   Depuis la 3.0.12, ce sont les RÈGLES OFFICIELLES du Gentle Mates TCG
   (docs/regles-officielles.md, copie du document de l'éditeur), appliquées
   au pied de la lettre ; docs/regles-3.0.md dit, règle par règle, où elles
   sont dans le code, et ce que le texte officiel ne tranche pas. Les valeurs
   de la partie (taille du Club, nombre de PV…) sont dans REGLE, juste en
   dessous. Elles sont recopiées ailleurs : le serveur
   (supabase/installation/23_combats.sql) écrit le Club de 40 et la Réserve
   de 10 dans deck_erreur, les exemplaires dans limite_copies, et la table
   starters recopie les deux Starter Decks ; le Guide (js/combat/guides.js)
   et le tutoriel (js/combat/tutoriel.js) les disent en toutes lettres.

   Trois principes :
   - Déterministe. Le hasard vient d'une graine rangée dans l'état : la même
     graine et les mêmes actions donnent la même partie. C'est ce qui permet
     le combat entre amis (chacun rejoue les actions de l'autre) et la reprise
     d'une partie après un rechargement.
   - Une partie est une coroutine. Son déroulement entier est un générateur :
     chaque fois qu'un CEO doit décider, il s'arrête sur une demande ; l'action
     choisie le relance. Un effet de carte s'écrit donc comme il se lit.
   - L'état n'est fait que de données (JSON). Au début de chaque tour, il est
     photographié : une copie de la partie — pour l'IA, qui essaie ses coups
     avant de les jouer — repart de la photo et rejoue les actions du tour.

   Le fichier marche aussi sous Node (tools/combat-sim.js), sans navigateur. */
"use strict";

(function (racine) {

/* ---------- Les valeurs de la partie ---------- */
/* Celles des règles officielles, citées. */
const REGLE = {
  LIGNES: 3,          /* « Le Terrain […] comprenant 3 cases où sont déployés les Joueur » */
  PV: 4,              /* « Piochez et empilez 4 nouvelles cartes […] face cachée » */
  MAIN: 5,            /* « Piochez les 5 premières cartes du Club pour former votre Main » */
  MAIN_MAX: 5,        /* fin de tour : « Défaussez […] pour en garder 5 maximum » */
  CLUB: 40,           /* « Votre Club doit contenir un total de 40 cartes » */
  RESERVE: 10,        /* « Votre Réserve doit contenir 10 cartes Essence » */
  COPIES: 3,          /* « pas plus de trois exemplaires d'une même carte » (même nom et même couleur) */
  COACHS: 1,          /* « Vous ne pouvez jouer qu'une seule carte Coach par tour » */
  REMPLACEMENTS: 1,   /* « il peut une fois par tour, bench un Joueur non engagé pour pouvoir jouer cette carte » */
  ESSENCES: 1         /* entretien : « Jouez la première carte de votre Réserve » */
};

/* Les neuf couleurs d'Essence. Le Neutre n'en est pas une : c'est un coût
   que n'importe quelle Essence paie. */
const COULEURS = ['rose', 'orange', 'jade', 'violette', 'jaune', 'mauve', 'verte', 'bleue', 'azur'];

/* ---------- Le catalogue et les effets ---------- */
let CAT = {};
let SCRIPTS = {};

/* Les cartes du jeu, telles que js/cards.js les construit. */
function catalogue(liste) {
  CAT = {};
  liste.forEach(c => { CAT[c.id] = c; });
}
const carte = id => CAT[id];
const toutes = () => Object.values(CAT);
/* Une Reverse joue comme sa carte d'origine : même effet, autre reflet. */
const baseId = id => { const c = CAT[id]; return (c && c.base && c.cat !== 'essence') ? c.base : id; };
const scr = id => SCRIPTS[baseId(id)] || SCRIPTS[id] || {};
function scripts(table) { Object.assign(SCRIPTS, table); }

const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Le hasard ---------- */
/* mulberry32 : rapide, assez bon, et tout son état tient dans un entier. */
function alea(E) {
  let t = (E.rng = (E.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function melanger(E, l) {
  for (let i = l.length - 1; i > 0; i--) {
    const k = Math.floor(alea(E) * (i + 1));
    [l[i], l[k]] = [l[k], l[i]];
  }
  return l;
}

/* ---------- L'état ---------- */
const nouvelleInst = (E, id, j) => ({ u: ++E.seq, id, j });

function joueurVide(o, i) {
  return {
    nom: (o.noms && o.noms[i]) || (i ? 'Adversaire' : 'Toi'),
    club: [], main: [], pv: [], reserve: [], ess: [], defausse: [],
    /* Les cartes « bench » : la défausse les reçoit comme les autres (« Le
       terme Bench signifie qu'une carte déployée est envoyée à la
       défausse »), mais un effet peut les viser (« Vos Objet bench »,
       En slip sur la Faille). */
    bench: [],
    lignes: Array(REGLE.LIGNES).fill(null),
    tours: 0, pvVus: false,
    /* Bonus de départ d'un adversaire de campagne (« maison ») */
    pvDepart: (o.pv && o.pv[i]) || REGLE.PV,
    essDepart: (o.essDepart && o.essDepart[i]) || 0
  };
}

const compteursVides = () => ({
  attaques: 0, pvRecup: [0, 0], deploie: 0, coachs: 0, remplace: 0,
  /* Les Coachs joués ce tour-ci par le CEO qui n'est pas actif (« Jouez
     cette carte », par Résilience) : la limite d'un Coach par tour vaut
     pour lui aussi (docs/regles-3.0.md, § 11, point 5). */
  coachsHors: 0,
  combatFini: false, doitAttaquer: 0
});

/* Une partie. `o` : {
     decks: [{ club: [ids], reserve: [couleurs] }, …],
     noms: ['Toi', 'Lumen'], graine: entier, premier: 0 | 1 (le tutoriel ;
     sinon pile ou face, à chaque partie),
     pv: [4, 5] et essDepart: [0, 1] (facultatifs : les variantes des modes,
     campagne, Épreuve, Raid) } */
/* `x` : ce qui ne fait pas partie de la partie et ne se rejoue pas —
   `capture` (l'arène : les photos des événements dès la mise en place, pour
   animer la donne, le mulligan, les PV et le tirage du premier). */
function creer(o, x) {
  const E = {
    rng: (o.graine >>> 0) || 1, seq: 0, tour: 0, actif: 0, premier: 0,
    phase: 'mise', fin: null, temp: [], cpt: compteursVides(),
    j: [0, 1].map(i => joueurVide(o, i))
  };
  cacher(E, 'init', JSON.parse(JSON.stringify(o)));
  cacher(E, 'ev', []);
  cacher(E, 'journal', []);
  cacher(E, 'snap', null);
  cacher(E, 'dem', null);
  cacher(E, 'gen', null);
  /* `capture` (version 3.0.7) : chaque événement emporte une photo de la
     partie à l'instant où il se produit (`e.etat`, du JSON). L'arène s'en
     sert pour dessiner chaque étape d'une action dans l'ordre — sans elle,
     elle ne voyait que l'état final, et un Joueur vaincu disparaissait du
     plateau avant même que l'attaque ne le touche. Seule la partie affichée
     l'allume : les copies de l'IA (cloner) ne photographient rien. */
  cacher(E, 'capture', !!(x && x.capture));
  [0, 1].forEach(i => {
    const d = o.decks[i];
    E.j[i].club = d.club.map(id => nouvelleInst(E, id, i));
    E.j[i].reserve = d.reserve.map(coul => ({ u: ++E.seq, coul, eng: false, j: i }));
  });
  /* Qui commence : « Déterminez aléatoirement qui commence la partie ». Tiré
     ici pour que la partie reste la même d'un rejeu à l'autre, mais annoncé
     à la fin de la mise en place, comme l'ordre des règles le veut (le
     jeton de l'écran de combat le montre alors, js/combat/table.js). */
  E.premier = o.premier === 0 || o.premier === 1 ? o.premier : (alea(E) < 0.5 ? 0 : 1);
  E.actif = E.premier;
  E.gen = partie(E, false);
  avancer(E);
  return E;
}

/* Ce qui ne fait pas partie de l'état de jeu : ni photographié, ni copié. */
function cacher(E, k, v) {
  Object.defineProperty(E, k, { value: v, enumerable: false, writable: true, configurable: true });
}

/* ---------- Événements ---------- */
/* Ce que l'interface anime et que le journal raconte. */
function ev(E, e) {
  if (E.capture) Object.defineProperty(e, 'etat', { value: JSON.stringify(E), enumerable: false, writable: true, configurable: true });
  E.ev.push(e);
  return e;
}

/* ---------- Petits accès ---------- */
const adv = j => 1 - j;
const joueursDe = (E, j) => E.j[j].lignes.filter(Boolean);
const tousJoueurs = E => joueursDe(E, 0).concat(joueursDe(E, 1));
/* GP Explorer II (#126, 3.0.13) : « Vous ne pouvez plus jouer de Joueur pour
   le reste de ce tour. » Jouer un Joueur, c'est le mettre en jeu sur une case
   (« Jouer une carte ») : l'action de la phase d'action, mais aussi un effet
   qui dit « jouez » (Worlds Japon, Versus Fighting, Meet & Greeter, M16). */
const joueurPermis = (E, j) => !E.temp.some(t => t.type === 'pasJoueur' && t.camp === j);
const ligneDe = (E, c) => E.j[c.j].lignes.indexOf(c);
const enJeu = (E, c) => !!c && E.j[c.j].lignes.includes(c);
const nomDe = c => (carte(c.id) || {}).nom || '?';
const estCat = (c, cat) => (carte(c.id) || {}).cat === cat;
const essencesLibres = (E, j) => E.j[j].ess.filter(e => !e.eng);

function trouverSurPlateau(E, u) {
  for (const P of E.j) for (const c of P.lignes) {
    if (!c) continue;
    if (c.u === u) return c;
    for (const o of c.obj) if (o.u === u) return o;
  }
  return null;
}
function porteurDe(E, o) {
  for (const P of E.j) for (const c of P.lignes) if (c && c.obj.includes(o)) return c;
  return null;
}

/* ---------- Mots-clés ---------- */
/* Un Joueur a un mot-clé imprimé (le talent de sa carte), un mot-clé donné
   par un Objet (Maillot Champions '25 donne Riposte), un mot-clé gagné pour
   un temps (Mur Salvateur donne Garde), ou un mot-clé sous condition (99%
   Faith). */
const MOTS_CLES = ['Provocation', 'Garde', 'Shield', 'Riposte', 'Légion', 'Buff', 'Signature'];
function motCleImprime(c) {
  const k = carte(c.id) && carte(c.id).kw;
  return k ? MOTS_CLES.find(m => sansAccent(m) === sansAccent(k.nom)) || k.nom : null;
}
function aMotCle(E, c, m) {
  if (sansAccent(motCleImprime(c)) === sansAccent(m)) return true;
  for (const o of c.obj || []) if ((scr(o.id).donne || []).includes(m)) return true;
  if (E.temp.some(t => t.type === 'kw' && t.kw === m && t.cible === c.u && !t.utilise)) return true;
  const s = scr(c.id);
  return !!(s.motsCles && s.motsCles(E, c).includes(m));
}
/* Le Shield s'use : « ignore la première attaque qu'il subit ». */
function shieldActif(E, c) {
  if (E.temp.some(t => t.type === 'kw' && t.kw === 'Shield' && t.cible === c.u && !t.utilise)) return true;
  if (c.shieldUse) return false;
  if (sansAccent(motCleImprime(c)) === 'shield') return true;
  const s = scr(c.id);
  return !!(s.motsCles && s.motsCles(E, c).includes('Shield'));
}
function userShield(E, c) {
  const t = E.temp.find(x => x.type === 'kw' && x.kw === 'Shield' && x.cible === c.u && !x.utilise);
  if (t) t.utilise = true; else c.shieldUse = true;
}

/* ---------- Les valeurs ---------- */
function bonusAttaque(E, c) {
  let b = 0;
  for (const o of c.obj) {
    const a = scr(o.id).atk;
    b += typeof a === 'function' ? a(E, c) : (a || 0);
  }
  for (const x of joueursDe(E, c.j)) if (x !== c) b += scr(x.id).buffAtk || 0;
  for (const t of E.temp) {
    if (t.type !== 'atk') continue;
    if (t.cible != null ? t.cible === c.u : t.camp === c.j && (!t.filtre || filtreOk(E, c, t.filtre))) b += t.val;
  }
  return b;
}
function filtreOk(E, c, f) {
  if (f === 'buff') return aMotCle(E, c, 'Buff');
  return true;
}

function defense(E, c) {
  let d = (carte(c.id) && carte(c.id).def) || 0;
  for (const o of c.obj) {
    const v = scr(o.id).def;
    d += typeof v === 'function' ? v(E, c) : (v || 0);
  }
  for (const x of joueursDe(E, c.j)) if (x !== c) d += scr(x.id).buffDef || 0;
  for (const t of E.temp) {
    if (t.type !== 'def') continue;
    if (t.cible != null ? t.cible === c.u : t.camp === c.j) d += t.val;
  }
  return Math.max(0, d);
}

/* La valeur d'une attaque, au moment où on la lit. `null` : une attaque sans
   valeur, qui n'a qu'un effet. */
function valeurAttaque(E, c, k, bonus) {
  const a = carte(c.id).atks[k];
  if (!a || a.degats == null) return null;
  const s = scr(c.id);
  let v = a.degats + bonusAttaque(E, c) + (bonus || 0);
  if (s.plus && s.plus[k]) v += s.plus[k](E, c);
  if (s.double && s.double(E, c)) v *= 2;
  /* Paris Gentle Mates (#127, 3.0.13) : la première attaque du tour de ce
     camp vaut double — avant qu'elle parte, toutes ses attaques possibles
     l'affichent ; ensuite, seulement celle qui est partie. */
  if (E.temp.some(t => t.type === 'doublePremiere' && t.camp === c.j)
      && (E.cpt.attaques === 0 || (E.cpt.attaques === 1 && E.cpt.premierAttaquant === c.u))) v *= 2;
  return Math.max(0, v);
}

/* ---------- Le coût d'une attaque ---------- */
const copieCout = c => Object.assign({}, c);
const totalCout = c => Object.values(c).reduce((a, b) => a + b, 0);

function coutAttaque(E, c, k, o) {
  o = o || {};
  let cout = o.chevaliere ? { neutre: 2 } : copieCout(carte(c.id).atks[k].cout);
  const rang = o.rang || (E.cpt.attaques + 1);
  for (const t of E.temp) {
    if (t.type !== 'cout' || t.payeur !== c.j) continue;
    if (t.quand === 'premiere' && rang === 1 && cout.neutre) cout.neutre = Math.max(0, cout.neutre - t.neutreMoins);
    if (t.quand === 'deuxieme' && rang === 2) cout = reduireCouleur(cout, t.couleurMoins);
    if (t.quand === 'toutes') cout.neutre = (cout.neutre || 0) + t.neutrePlus;
  }
  return nettoyerCout(cout);
}
function nettoyerCout(c) {
  const r = {};
  for (const k in c) if (c[k] > 0) r[k] = c[k];
  return r;
}
function reduireCouleur(c, n) {
  c = copieCout(c);
  for (const k of Object.keys(c)) {
    if (k === 'neutre') continue;
    while (n > 0 && c[k] > 0) { c[k]--; n--; }
  }
  return nettoyerCout(c);
}
/* « Un coût diminué de 1 » (Riposte) : un Neutre d'abord, sinon une couleur. */
function reduireUn(c, n) {
  c = copieCout(c);
  while (n > 0 && totalCout(c) > 0) {
    if (c.neutre) c.neutre--; else { const k = Object.keys(c).find(x => c[x] > 0); c[k]--; }
    n--;
  }
  return nettoyerCout(c);
}

/* Peut-on payer ce coût avec les Essences désengagées ? Les symboles de
   couleur veulent leur couleur ; le Neutre prend n'importe laquelle. */
function payable(E, j, cout) {
  const libres = essencesLibres(E, j);
  const par = {};
  libres.forEach(e => { par[e.coul] = (par[e.coul] || 0) + 1; });
  let reste = libres.length;
  for (const k in cout) {
    if (k === 'neutre') continue;
    if ((par[k] || 0) < cout[k]) return false;
    reste -= cout[k];
  }
  return reste >= (cout.neutre || 0);
}

/* Le paiement. Le CEO ne choisit pas une à une les Essences qu'il engage :
   le moteur prend pour le Neutre les couleurs dont ses autres attaques ont le
   moins besoin. */
function payer(E, j, cout) {
  const libres = essencesLibres(E, j);
  const prises = [];
  for (const k in cout) {
    if (k === 'neutre') continue;
    for (let i = 0; i < cout[k]; i++) {
      const e = libres.find(x => x.coul === k && !prises.includes(x));
      prises.push(e);
    }
  }
  if (cout.neutre) {
    const besoin = {};
    for (const c of joueursDe(E, j)) for (const a of carte(c.id).atks) {
      for (const k in a.cout) if (k !== 'neutre') besoin[k] = (besoin[k] || 0) + a.cout[k];
    }
    const dispo = libres.filter(e => !prises.includes(e))
      .sort((a, b) => (besoin[a.coul] || 0) - (besoin[b.coul] || 0));
    prises.push(...dispo.slice(0, cout.neutre));
  }
  prises.forEach(e => { e.eng = true; });
  if (prises.length) ev(E, { t: 'paie', j, ess: prises.map(e => e.u) });
  return prises;
}

/* ---------- Le déroulement ---------- */
function* partie(E, reprise) {
  if (!reprise) yield* miseEnPlace(E);
  while (!E.fin) {
    photographier(E);
    yield* tour(E);
    if (E.fin) break;
    E.actif = adv(E.actif);
  }
  E.phase = 'fin';
}

function* miseEnPlace(E) {
  /* Le boss du Raid : déjà sur le plateau au début, sans effet d'entrée.
     `poses` : [[{ id, ligne }], …]. L'exemplaire est sorti du Club avant la
     donne (sinon il pourrait finir en main ou en PV) ; s'il n'y est pas, il
     est ajouté. */
  const poses = [0, 1].map(i => ((E.init.poses || [])[i] || []).map(p => {
    const P = E.j[i];
    const k = P.club.findIndex(c => c.id === p.id);
    return { ligne: p.ligne, c: k >= 0 ? P.club.splice(k, 1)[0] : nouvelleInst(E, p.id, i) };
  }));
  /* `ordre` (le tutoriel, js/combat/tutoriel.js) : les Clubs et les
     Réserves restent dans l'ordre donné — la partie est la même à chaque
     fois. */
  if (!E.init.ordre) for (const i of [0, 1]) {
    melanger(E, E.j[i].club);
    melanger(E, E.j[i].reserve);
  }
  /* 2. « Piochez les 5 premières cartes du Club pour former votre Main. Si
        votre Main de départ ne vous convient pas, mélangez-la dans votre Club
        et piochez 5 cartes. Vous ne pouvez effectuer cette action qu'une
        fois. » */
  for (const i of [0, 1]) {
    const P = E.j[i];
    P.main = P.club.splice(0, REGLE.MAIN);
    ev(E, { t: 'main', j: i, n: P.main.length });
    const garder = yield* ouiNon(E, i, 'Garder cette main de départ ?',
      { oui: 'Garder', non: 'Changer de main', but: 'mulligan' });
    if (!garder) {
      P.club.push(...P.main);
      P.main = [];
      melanger(E, P.club);
      P.main = P.club.splice(0, REGLE.MAIN);
      ev(E, { t: 'mulligan', j: i });
    }
  }
  /* 3. « Piochez et empilez 4 nouvelles cartes et placez-les face cachée sur
        le côté de votre Terrain. Ce sont vos Points de Victoire. » */
  for (const i of [0, 1]) {
    const P = E.j[i];
    P.pv = P.club.splice(0, P.pvDepart);
    ev(E, { t: 'pv', j: i, n: P.pv.length });
    /* Campagne : un adversaire qui commence avec des Essences en jeu. */
    for (let k = 0; k < P.essDepart; k++) jouerReserve(E, i, false);
    for (const { ligne, c } of poses[i]) {
      if (P.lignes[ligne]) { P.club.push(c); continue; }
      Object.assign(c, { j: i, eng: false, obj: [], shieldUse: false, nAtt: 0 });
      P.lignes[ligne] = c;
      ev(E, { t: 'deploie', j: i, u: c.u, id: c.id, ligne, eng: false, pose: true });
    }
  }
  /* 4. « Déterminez aléatoirement qui commence la partie. » */
  ev(E, { t: 'pileFace', premier: E.premier });
}

function* tour(E) {
  const j = E.actif, P = E.j[j];
  E.tour++;
  P.tours++;
  E.cpt = compteursVides();
  E.phase = 'debut';
  ev(E, { t: 'tour', j, n: E.tour });

  /* 01. Phase d'entretien, dans l'ordre des règles. « Piochez une carte de
         votre Club » : un Club vide fait perdre (« Votre adversaire doit
         piocher dans son Club mais est dans l'incapacité de le faire »). */
  piocher(E, j, 1);
  if (E.fin) return;
  /* « Désengagez toutes vos cartes engagées. » Aucune carte ne guette ce
     désengagement-là : les deux qui réagissent à un désengagement (#047,
     #048) ne valent que jusqu'à la fin du tour où elles entrent. */
  for (const c of joueursDe(E, j)) {
    c.eng = false;
    c.nAtt = 0;
  }
  for (const e of P.ess) e.eng = false;
  ev(E, { t: 'desengagement', j });
  /* « Jouez la première carte de votre Réserve. » */
  for (let i = 0; i < REGLE.ESSENCES; i++) if (P.reserve.length) jouerReserve(E, j, false);

  /* 02. Phase d'action (`jeu`), puis 03. Phase de Combat (`combat`) : on y
     entre en déclarant la première attaque, et on n'en ressort pas. */
  E.phase = 'jeu';
  ev(E, { t: 'phaseAction', j });
  while (!E.fin) {
    const a = yield { qui: j, type: 'tour' };
    if (a.t === 'finTour') break;
    yield* actionTour(E, j, a);
  }
  if (E.fin) return;

  /* La fin de la phase de Combat, puis 04. Fin de tour (`cloture`) :
     « Défaussez autant de cartes de votre Main pour en garder 5 maximum. » */
  yield* declencher(E, 'finCombat', { j });
  if (E.fin) return;
  E.phase = 'cloture';
  ev(E, { t: 'cloture', j });
  const trop = P.main.length - REGLE.MAIN_MAX;
  if (trop > 0) {
    const us = yield* choisirCartes(E, j, `Défausse ${trop} carte${trop > 1 ? 's' : ''}`, P.main.map(x => x.u), trop, trop,
      { but: 'defausseFin', zone: 'main', texte: `Fin du tour : tu gardes ${REGLE.MAIN_MAX} cartes au plus en main.` });
    defausserMain(E, j, us);
  }
  expirer(E);
  ev(E, { t: 'finTour', j });
}

function finir(E, gagnant, raison) {
  if (E.fin) return;
  E.fin = { gagnant, raison };
  ev(E, { t: 'fin', gagnant, raison });
}

/* Les effets « jusqu'à la fin du tour » s'éteignent. Des cartes prêtées à la
   main « jusqu'à la fin du tour » (En slip sur la Faille) retournent à la
   défausse si elles y sont encore. */
function expirer(E) {
  for (const t of E.temp) {
    if (t.type !== 'retourDefausse' || t.jusqua > E.tour) continue;
    const P = E.j[t.camp];
    const l = P.main.filter(c => t.us.includes(c.u));
    for (const c of l) { P.main.splice(P.main.indexOf(c), 1); P.defausse.push(c); }
    if (l.length) ev(E, { t: 'retourDefausse', j: t.camp, u: l.map(c => c.u) });
  }
  E.temp = E.temp.filter(t => t.jusqua > E.tour);
}

/* ---------- Les actions du tour ---------- */
function* actionTour(E, j, a) {
  const P = E.j[j];
  if (a.t === 'deployer') {
    const c = retirerMain(P, a.u);
    E.cpt.deploie++;
    /* Plus de case libre : « une fois par tour, bench un Joueur non engagé
       pour pouvoir jouer cette carte » — à sa place. */
    if (a.remplace) {
      const x = trouverSurPlateau(E, a.remplace);
      E.cpt.remplace++;
      if (x && enJeu(E, x)) bancer(E, x);
    }
    yield* deployer(E, j, c, a.ligne);
  } else if (a.t === 'lier') {
    const o = retirerMain(P, a.u);
    yield* lier(E, j, o, trouverSurPlateau(E, a.cible));
  } else if (a.t === 'jouer') {
    yield* jouerInstant(E, j, a.u);
  } else if (a.t === 'attaquer') {
    if (E.phase !== 'combat') { E.phase = 'combat'; ev(E, { t: 'phaseCombat', j }); }
    yield* attaquer(E, j, trouverSurPlateau(E, a.u), a.k, a.cible, !!a.chevaliere);
  }
}

function retirerMain(P, u) {
  const i = P.main.findIndex(c => c.u === u);
  return i < 0 ? null : P.main.splice(i, 1)[0];
}

/* « Restriction par couleur : les cartes Objet, Coach et Moment d'une
   couleur spécifique ne peuvent être jouées que si vous avez une Essence de
   la couleur correspondante déployée sur le Terrain » — engagée ou non ; ce
   n'est pas un coût. Une carte Neutre n'a pas de couleur spécifique. */
function couleurOk(E, j, c) {
  const col = (carte(c.id) || {}).col;
  if (!col || col === 'neutre') return true;
  return E.j[j].ess.some(e => e.coul === col);
}

/* Les actions possibles, à ce moment du tour. C'est la liste que l'interface
   rend cliquable et parmi laquelle l'IA choisit. Phase d'action (`jeu`) :
   « Jouez autant de cartes Joueur, Objet, Moment que vous le voulez. Jouez
   une carte Coach. » Phase de Combat : les attaques seulement. */
function optionsTour(E) {
  const j = E.actif, P = E.j[j], out = [];
  if (E.phase === 'jeu') {
    const libres = P.lignes.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
    const permis = joueurPermis(E, j);
    for (const c of P.main) if (estCat(c, 'joueur') && permis) {
      for (const l of libres) out.push({ t: 'deployer', u: c.u, ligne: l });
      /* « Si aucune case n'est disponible, il peut une fois par tour, bench
         un Joueur non engagé pour pouvoir jouer cette carte. » */
      if (!libres.length && E.cpt.remplace < REGLE.REMPLACEMENTS) {
        P.lignes.forEach((x, l) => { if (x && !x.eng) out.push({ t: 'deployer', u: c.u, ligne: l, remplace: x.u }); });
      }
    }
    for (const o of P.main) if (estCat(o, 'objet') && couleurOk(E, j, o)) {
      for (const c of joueursDe(E, j)) out.push({ t: 'lier', u: o.u, cible: c.u });
    }
    for (const c of P.main) {
      const k = carte(c.id).cat;
      if (k !== 'coach' && k !== 'moment') continue;
      if (k === 'coach' && E.cpt.coachs >= REGLE.COACHS) continue;
      if (!couleurOk(E, j, c)) continue;
      const s = scr(c.id);
      if (!s.effet) continue;
      if (s.jouable && !s.jouable(ctxDe(E, j, c))) continue;
      out.push({ t: 'jouer', u: c.u });
    }
  }
  const attaques = optionsAttaque(E, j);
  out.push(...attaques);
  if (!(E.cpt.doitAttaquer > 0 && attaques.length)) out.push({ t: 'finTour' });
  return out;
}

const premierTourDuPremier = (E, j) => j === E.premier && E.j[j].tours === 1;

function peutAttaquer(E, c) {
  if (c.eng) return false;
  if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) return false;
  return true;
}

function optionsAttaque(E, j) {
  const out = [];
  if (premierTourDuPremier(E, j) || E.cpt.combatFini) return out;
  for (const c of joueursDe(E, j)) {
    if (!peutAttaquer(E, c)) continue;
    const atks = carte(c.id).atks;
    const chev = c.obj.some(o => scr(o.id).chevaliere);
    atks.forEach((a, k) => {
      const normal = payable(E, j, coutAttaque(E, c, k));
      const avecChev = chev && payable(E, j, coutAttaque(E, c, k, { chevaliere: true }));
      if (!normal && !avecChev) return;
      const variantes = [];
      if (normal) variantes.push(false);
      if (avecChev && !normal) variantes.push(true);
      else if (avecChev && totalCout(coutAttaque(E, c, k, { chevaliere: true })) < totalCout(coutAttaque(E, c, k))) variantes.push(true);
      /* Une attaque sans valeur imprimée (seulement un effet) est une attaque
         comme les autres : elle se déclare sur le CEO adverse, se défend, et
         touche si personne ne défend (règles officielles, « Déroulement de
         la Phase de Combat » ; sa valeur compte pour 0). */
      for (const chevaliere of variantes) {
        for (const cible of ciblesAttaque(E, c)) {
          out.push(Object.assign({ t: 'attaquer', u: c.u, k, cible }, chevaliere ? { chevaliere } : {}));
        }
      }
    });
  }
  return out;
}

/* Ce qu'une attaque vise : « Le CEO actif engage ce Joueur pour le déclarer
   comme attaquant sur le CEO adverse. » Deux exceptions, imprimées : le
   Joueur d'en face, s'il a Provocation (« L'attaquant face à ce Joueur doit
   le cibler ») ou s'il est Slay et désengagé, l'impose ; « Jus de bagarre »
   permet d'attaquer le Joueur adverse de sa ligne. */
function ciblesAttaque(E, c) {
  const A = E.j[adv(c.j)], l = ligneDe(E, c), face = A.lignes[l];
  if (face && (aMotCle(E, face, 'Provocation') || (scr(face.id).provocSiLibre && !face.eng))) return [face.u];
  const cs = ['ceo'];
  if (face && c.obj.some(o => scr(o.id).jusDeBagarre)) cs.push(face.u);
  return cs;
}

/* Le soutien : « si le CEO adverse déclare un défenseur, le CEO actif peut
   engager les Essence nécessaires à l'attaque d'un de ses Joueur adjacents,
   et engager le Joueur pour le déclarer comme soutien. S'il le fait on
   ajoute la valeur d'attaque du soutien à la valeur du Joueur attaquant. »
   Adjacent : la case voisine, de son côté du Terrain. Une attaque sans valeur
   n'ajoute rien : elle ne se propose pas. */
function soutiens(E, c) {
  const P = E.j[c.j], l = ligneDe(E, c), out = [];
  for (const i of [l - 1, l + 1]) {
    const s = P.lignes[i];
    if (!s || s.eng) continue;
    carte(s.id).atks.forEach((a, k) => {
      const val = valeurAttaque(E, s, k);
      if (val == null) return;
      const cout = coutAttaque(E, s, k, { rang: 0 });
      if (payable(E, c.j, cout)) out.push({ c: s, k, val, cout });
    });
  }
  return out;
}

/* Qui peut défendre : le Joueur désengagé de la ligne de l'attaquant, et
   tout Joueur désengagé qui a Garde. */
function defenseurs(E, c, cible) {
  const A = E.j[adv(c.j)], l = ligneDe(E, c);
  const pasFace = E.temp.some(t => t.type === 'pasDefenseFace' && t.cible === c.u);
  const out = [];
  A.lignes.forEach((x, i) => {
    if (!x || x.eng || x.u === cible) return;
    if (i === l) { if (!pasFace) out.push(x); }
    else if (aMotCle(E, x, 'Garde')) out.push(x);
  });
  return out;
}

/* ---------- Jouer des cartes ---------- */
function* deployer(E, j, c, ligne, o) {
  o = o || {};
  const P = E.j[j];
  if (ligne == null || P.lignes[ligne]) {
    ligne = P.lignes.findIndex(x => !x);
    if (ligne < 0) { P.main.push(c); return null; }
  }
  Object.assign(c, { j, eng: !!o.engage, obj: [], shieldUse: false, nAtt: 0 });
  P.lignes[ligne] = c;
  ev(E, { t: 'deploie', j, u: c.u, id: c.id, ligne, eng: c.eng });
  yield* declencher(E, 'deploie', { j, c });
  const s = scr(c.id);
  if (s.entree && !o.sansEntree && enJeu(E, c)) {
    ev(E, { t: 'entree', j, u: c.u, id: c.id });
    yield* s.entree(ctxDe(E, j, c));
  }
  return c;
}

/* « Il n'y a pas de limite au nombre de cartes Objet que l'on peut lier à un
   Joueur. » */
function* lier(E, j, o, cible, opts) {
  if (!cible || !enJeu(E, cible)) {
    E.j[o.j].defausse.push(o);
    return;
  }
  cible.obj.push(o);
  ev(E, { t: 'lie', j, u: o.u, id: o.id, cible: cible.u });
  if (!(opts && opts.sansDeclencheur)) yield* declencher(E, 'lier', { j, o, cible });
}

function* jouerInstant(E, j, u) {
  const P = E.j[j];
  const c = retirerMain(P, u);
  if (!c) return;
  if (estCat(c, 'coach')) E.cpt.coachs++;
  ev(E, { t: 'joue', j, u: c.u, id: c.id });
  yield* scr(c.id).effet(ctxDe(E, j, c));
  /* Un Instant joué va à la défausse — sauf s'il a déjà été déplacé. */
  if (!ou(E, c)) P.defausse.push(c);
}

/* Où est une carte ? null : nulle part (en train d'être jouée). */
function ou(E, c) {
  for (const P of E.j) {
    for (const z of ['club', 'main', 'pv', 'defausse']) if (P[z].includes(c)) return z;
    for (const x of P.lignes) if (x && (x === c || x.obj.includes(c))) return 'plateau';
  }
  return null;
}

/* ---------- L'attaque ---------- */
function* attaquer(E, j, c, k, cible, chevaliere) {
  const opp = adv(j);
  const atk = carte(c.id).atks[k];
  const rang = E.cpt.attaques + 1;

  /* Le coût. La Chevalière, liée à l'attaquant, peut le remplacer. */
  let cout = coutAttaque(E, c, k, { rang });
  if (chevaliere) {
    const o = c.obj.find(x => scr(x.id).chevaliere);
    if (o) {
      cout = coutAttaque(E, c, k, { rang, chevaliere: true });
      if (scr(o.id).chevaliere === 'defausse') defausserPlateau(E, o);
      else bancer(E, o);
    }
  }
  payer(E, j, cout);
  E.cpt.attaques = rang;
  if (rang === 1) E.cpt.premierAttaquant = c.u;
  if (E.cpt.doitAttaquer > 0) E.cpt.doitAttaquer--;
  c.nAtt = (c.nAtt || 0) + 1;

  /* L'attaquant s'engage (Worlds Lyon l'en dispense, une fois). */
  const lyon = E.temp.some(t => t.type === 'lyon' && t.camp === j) && c.obj.length > 0 && c.nAtt === 1;
  const X = { c, k, cible, rang, bonus: 0, annulee: false, vaincu: false, defenseur: null, j };
  ev(E, { t: 'attaque', j, u: c.u, k, nom: atk.nom, cible });
  if (!lyon) yield* engager(E, c);
  if (E.fin) return;

  yield* declencher(E, 'attaque', X);
  if (E.fin) return;

  {
    /* La cible a pu disparaître entre-temps. */
    if (X.cible !== 'ceo' && !enJeu(E, trouverSurPlateau(E, X.cible))) X.cible = 'ceo';

    /* « Le CEO adverse peut déclarer un Joueur sur la même ligne comme
       défenseur pour cette attaque en l'engageant. » */
    const defs = defenseurs(E, c, X.cible);
    if (defs.length && enJeu(E, c)) {
      const val = valeurAttaque(E, c, k, X.bonus) || 0;
      const opts = defs.map(d => ({
        v: d.u, u: d.u, label: `Défendre avec ${nomDe(d)}`,
        info: { def: defense(E, d), val, vaincu: val >= defense(E, d) && !shieldActif(E, d) }
      }));
      opts.push({ v: 'non', label: X.cible === 'ceo' ? 'Ne pas défendre' : 'Laisser passer' });
      const choix = yield {
        qui: opp, type: 'choix', but: 'defense', titre: `${nomDe(c)} attaque`,
        texte: X.cible === 'ceo' ? `${atk.nom} · ${val} — vise ton CEO` : `${atk.nom} · ${val} — vise ${nomDe(trouverSurPlateau(E, X.cible))}`,
        attaquant: c.u, cible: X.cible, options: opts
      };
      if (choix.v !== 'non') {
        const d = trouverSurPlateau(E, choix.v);
        X.defenseur = d;
        X.cible = d.u;
        ev(E, { t: 'defend', j: opp, u: d.u, attaquant: c.u });
        yield* engager(E, d);
        yield* declencher(E, 'defense', X);
        if (E.fin) return;
        /* Le soutien (soutiens, plus haut) : choisi par l'attaquant, une
           fois le défenseur connu. Version 3.0.14 (le propriétaire, 1er
           novembre 2026) : il ne se propose que s'il change l'issue — pas
           quand l'attaque seule suffit à vaincre le défenseur, ni quand
           même avec lui elle ne suffirait pas, ni contre un bouclier (qui
           absorbe l'attaque quelle que soit sa valeur). Un soutien sans
           effet ne ferait que payer des Essences et engager un Joueur :
           aucune carte ne réagit au soutien ni à l'engagement. */
        const def = enJeu(E, d) ? defense(E, d) : 0, base = valeurAttaque(E, c, k, X.bonus) || 0;
        const sout = enJeu(E, c) && !X.annulee && enJeu(E, d) && base < def && !shieldActif(E, d)
          ? soutiens(E, c).filter(z => base + z.val >= def) : [];
        if (sout.length) {
          const opts2 = sout.map(z => ({
            v: z.c.u + ':' + z.k, u: z.c.u, k: z.k, label: `Soutien de ${nomDe(z.c)} · +${z.val}`, cout: z.cout,
            info: { val: z.val, total: base + z.val, def, vaincu: base + z.val >= def && !shieldActif(E, d) }
          }));
          opts2.push({ v: 'non', label: 'Pas de soutien' });
          const r = yield {
            qui: j, type: 'choix', but: 'soutien', titre: `${nomDe(d)} défend`,
            texte: `Défense ${def}, ton attaque ${base}. Un Joueur voisin peut engager son attaque en soutien : sa valeur s'ajoute.`,
            attaquant: c.u, defenseur: d.u, options: opts2
          };
          if (r.v !== 'non') {
            const z = sout.find(x => x.c.u + ':' + x.k === r.v);
            payer(E, j, z.cout);
            X.soutien = z.c;
            X.soutienK = z.k;
            ev(E, { t: 'soutien', j, u: z.c.u, k: z.k, val: z.val, attaquant: c.u });
            yield* engager(E, z.c);
            if (E.fin) return;
          }
        }
      }
    }
    if (!X.annulee && enJeu(E, c)) yield* resoudre(E, X);
    else if (!X.annulee) ev(E, { t: 'attaquePerdue', u: c.u });
  }
  if (E.fin) return;

  /* L'effet imprimé sous l'attaque. */
  if (!X.annulee) {
    const s = scr(c.id);
    if (s.attaques && s.attaques[k]) yield* s.attaques[k](ctxDe(E, j, c, { X }));
  }
  if (E.fin) return;
  yield* declencher(E, 'finAttaque', X);
}

/* « On compare la valeur d'attaque du Joueur attaquant et la valeur de
   défense du Joueur défenseur, et si la valeur d'attaque est supérieure ou
   égale à la valeur de défense, le Joueur défenseur est vaincu et bench
   (envoyé à la défausse). […] S'il ne déclare pas de défenseur, l'attaque
   touche directement le CEO adverse. » Le soutien s'ajoute à l'attaque. */
function* resoudre(E, X) {
  const c = X.c, opp = adv(c.j);
  const sv = X.soutien && enJeu(E, X.soutien) ? (valeurAttaque(E, X.soutien, X.soutienK) || 0) : 0;
  const val = (valeurAttaque(E, c, X.k, X.bonus) || 0) + sv;
  if (X.cible === 'ceo') {
    ev(E, { t: 'impact', u: c.u, cible: 'ceo', val });
    yield* toucher(E, opp, c);
    return;
  }
  const t = trouverSurPlateau(E, X.cible);
  if (!t || !enJeu(E, t)) return;
  if (shieldActif(E, t)) {
    userShield(E, t);
    ev(E, { t: 'shield', u: t.u, par: c.u, val });
    return;
  }
  const def = defense(E, t);
  ev(E, { t: 'impact', u: c.u, cible: t.u, val, def, soutien: X.soutien ? X.soutien.u : null });
  if (val >= def) {
    /* Vaincu seulement si « Invitation » ne l'a pas sauvé (vaincre() rend
       false) : Target Missed (c055) lit X.vaincu à la fin de l'attaque. */
    X.vaincu = (yield* vaincre(E, t, c)) !== false;
  } else {
    ev(E, { t: 'repousse', u: t.u, par: c.u, val, def });
  }
}

/* Le CEO est touché : il récupère son premier PV. Sans PV, il a perdu. */
function* toucher(E, j, par) {
  const P = E.j[j];
  ev(E, { t: 'touche', j, par: par ? par.u : null });
  if (!P.pv.length) {
    finir(E, adv(j), 'pv');
    return;
  }
  const c = P.pv.shift();
  /* L'Arme Nucléaire, seule sur le plateau : le PV part à la défausse. */
  if (par && joueursDe(E, par.j).length === 1 && scr(par.id).nucleaire && enJeu(E, par)) {
    P.defausse.push(c);
    ev(E, { t: 'pvDefausse', j, u: c.u, id: c.id });
    return;
  }
  E.cpt.pvRecup[j]++;
  ev(E, { t: 'pvRecup', j, u: c.u, id: c.id });
  let utilisee = false;
  const s = scr(c.id), k = carte(c.id);
  if (k && k.res && s.resilience) {
    const x = ctxDe(E, j, c);
    if (!s.resPossible || s.resPossible(x)) {
      const ok = yield* ouiNon(E, j, `Résilience — ${k.nom}`,
        { oui: 'Jouer la Résilience', non: 'Garder en main', texte: k.res, carte: c.id, but: 'resilience' });
      if (ok) {
        utilisee = true;
        ev(E, { t: 'resilience', j, u: c.u, id: c.id });
        yield* s.resilience(x);
        if (!ou(E, c)) P.defausse.push(c);
      }
    }
  }
  if (!utilisee) P.main.push(c);
  yield* declencher(E, 'recupPV', { j, par });
}

/* Un Joueur vaincu quitte le plateau ; ses Objets vont à la défausse. */
function* vaincre(E, t, par) {
  const j = t.j, P = E.j[j];
  /* « Invitation » : l'Objet est bench (à la défausse) à la place du Joueur. */
  const inv = t.obj.find(o => scr(o.id).invitation);
  if (inv) {
    bancer(E, inv);
    ev(E, { t: 'sauve', u: t.u, par: inv.u, id: inv.id });
    return false;
  }
  /* Ce qu'il faut savoir de lui avant qu'il parte. */
  const riposte = aMotCle(E, t, 'Riposte');
  const legion = aMotCle(E, t, 'Légion');
  const valeurs = carte(t.id).atks.map((a, k) => valeurAttaque(E, t, k));
  const ligne = ligneDe(E, t);
  P.lignes[ligne] = null;
  /* « Les Objet sont bench lorsque la carte Joueur associée quitte le
     Terrain. » */
  for (const o of t.obj) { E.j[o.j].defausse.push(o); E.j[o.j].bench.push(o.u); }
  const objets = t.obj.map(o => o.u);
  t.obj = [];
  t.eng = false;
  ev(E, { t: 'vaincu', j, u: t.u, id: t.id, ligne, par: par ? par.u : null, objets });

  /* Riposte : une de ses attaques, pour un coût diminué de 1, sur l'attaquant. */
  if (riposte && par && enJeu(E, par)) yield* riposter(E, t, valeurs, par);
  if (E.fin) return true;

  /* Légion : défausser une carte pour le reprendre en main. */
  let enMain = false;
  if (legion) {
    if (scr(t.id).legionGratuite) enMain = true;
    else if (P.main.length) {
      const ok = yield* ouiNon(E, j, `Légion — ${nomDe(t)}`,
        { oui: 'Défausser une carte', non: 'Non', texte: 'Défausse une carte pour reprendre ce Joueur en main.', carte: t.id, but: 'legion' });
      if (ok) {
        const [u] = yield* choisirCartes(E, j, 'Quelle carte défausser ?', P.main.map(x => x.u), 1, 1, { but: 'defausse', zone: 'main' });
        defausserMain(E, j, [u]);
        enMain = true;
      }
    }
  }
  if (enMain) { P.main.push(t); ev(E, { t: 'legion', j, u: t.u, id: t.id }); }
  else P.defausse.push(t);

  if (par && enJeu(E, par)) yield* declencher(E, 'vainc', { par, t });
  return true;
}

function* riposter(E, t, valeurs, par) {
  const j = t.j;
  let moins = 1;
  for (const x of E.temp) if (x.type === 'ripostePlus' && x.camp === j && !x.utilise) moins += x.n;
  const opts = [];
  carte(t.id).atks.forEach((a, k) => {
    if (valeurs[k] == null) return;
    const cout = reduireUn(a.cout, moins);
    if (payable(E, j, cout)) opts.push({ v: k, label: `${a.nom} · ${valeurs[k]}`, cout, info: { val: valeurs[k], def: defense(E, par) } });
  });
  if (!opts.length) return;
  opts.push({ v: 'non', label: 'Pas de Riposte' });
  const r = yield { qui: j, type: 'choix', but: 'riposte', titre: `Riposte — ${nomDe(t)}`,
    texte: `Une attaque contre ${nomDe(par)} (Défense ${defense(E, par)}).`, carte: t.id, options: opts };
  if (r.v === 'non') return;
  const o = opts.find(x => x.v === r.v);
  E.temp.forEach(x => { if (x.type === 'ripostePlus' && x.camp === j) x.utilise = true; });
  payer(E, j, o.cout);
  const val = valeurs[r.v];
  ev(E, { t: 'riposte', j, id: t.id, k: r.v, cible: par.u, val });
  if (shieldActif(E, par)) { userShield(E, par); ev(E, { t: 'shield', u: par.u, val }); return; }
  const def = defense(E, par);
  ev(E, { t: 'impact', u: t.u, cible: par.u, val, def, riposte: true });
  if (val >= def) yield* vaincre(E, par, null);
  else ev(E, { t: 'repousse', u: par.u, val, def });
}

/* ---------- Les gestes de base ---------- */
function piocher(E, j, n) {
  const P = E.j[j];
  /* One More : chaque pioche de ce tour en apporte une de plus. */
  if (E.actif === j && E.temp.some(t => t.type === 'piochePlus' && t.camp === j)) n += 1;
  const pris = P.club.splice(0, n);
  P.main.push(...pris);
  if (pris.length) ev(E, { t: 'pioche', j, u: pris.map(c => c.u), n: pris.length });
  /* « Votre adversaire doit piocher dans son Club mais est dans l'incapacité
     de le faire » : c'est une condition de victoire pour l'autre CEO. */
  if (pris.length < n) {
    ev(E, { t: 'clubVide', j });
    finir(E, adv(j), 'club');
  }
  return pris;
}

function jouerReserve(E, j, engagee) {
  const P = E.j[j];
  if (!P.reserve.length) return null;
  const e = P.reserve.shift();
  e.eng = !!engagee;
  P.ess.push(e);
  ev(E, { t: 'essence', j, u: e.u, coul: e.coul, eng: e.eng });
  return e;
}

function* engager(E, c) {
  if (!c || c.eng || !enJeu(E, c)) return;
  c.eng = true;
  ev(E, { t: 'engage', u: c.u });
  yield* declencher(E, 'engage', { c });
}

function* desengager(E, c) {
  if (!c || !c.eng || !enJeu(E, c)) return;
  c.eng = false;
  ev(E, { t: 'desengage', u: c.u });
  yield* declencher(E, 'desengage', { c });
}

function* desengagerEssence(E, e) {
  if (!e || !e.eng) return;
  e.eng = false;
  ev(E, { t: 'essDesengage', j: e.j, u: e.u });
  yield* declencher(E, 'desengageEss', { e, j: e.j });
}

function engagerEssence(E, e) {
  if (!e || e.eng) return;
  e.eng = true;
  ev(E, { t: 'essEngage', j: e.j, u: e.u });
}

function retirerObjet(E, porteur, o) {
  const i = porteur.obj.indexOf(o);
  if (i >= 0) porteur.obj.splice(i, 1);
}

/* Retirer un Joueur du plateau, pour une autre raison que la défaite. Ses
   Objets, rendus à l'appelant, sont bench (« Les Objet sont bench lorsque
   la carte Joueur associée quitte le Terrain ») : benchObjets(). */
function quitterPlateau(E, c) {
  const P = E.j[c.j];
  const l = ligneDe(E, c);
  if (l >= 0) P.lignes[l] = null;
  const objets = c.obj || [];
  c.obj = [];
  c.eng = false;
  return objets;
}

/* Les Objets d'un Joueur qui quitte le Terrain : bench, donc à la défausse. */
function benchObjets(E, objets) {
  for (const o of objets) { E.j[o.j].defausse.push(o); E.j[o.j].bench.push(o.u); }
}

/* « Bench » : « Le terme Bench signifie qu'une carte déployée est envoyée à
   la défausse. » Un Joueur bench emporte ses Objets avec lui. Ce n'est pas
   être vaincu : ni Riposte, ni Légion (« Lorsqu'il est vaincu »). */
function bancer(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].defausse.push(x);
    E.j[x.j].bench.push(x.u);
    ev(E, { t: 'banc', j: x.j, u: x.u, id: x.id, de: porteur.u });
    return;
  }
  if (enJeu(E, x)) {
    const ligne = ligneDe(E, x);
    const objets = quitterPlateau(E, x);
    E.j[x.j].defausse.push(x);
    E.j[x.j].bench.push(x.u);
    benchObjets(E, objets);
    ev(E, { t: 'banc', j: x.j, u: x.u, id: x.id, ligne, objets: objets.map(o => o.u) });
  }
}

/* Renvoyer en main : un Joueur (ses Objets sont bench), ou un Objet seul. */
function renvoyerMain(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].main.push(x);
    ev(E, { t: 'enMain', j: x.j, u: x.u, id: x.id, de: porteur.u });
    return;
  }
  if (enJeu(E, x)) {
    const ligne = ligneDe(E, x);
    const objets = quitterPlateau(E, x);
    E.j[x.j].main.push(x);
    benchObjets(E, objets);
    ev(E, { t: 'enMain', j: x.j, u: x.u, id: x.id, ligne, objets: objets.map(o => o.u), benchObjets: true });
  }
}

function defausserPlateau(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].defausse.push(x);
    ev(E, { t: 'defausseObjet', j: x.j, u: x.u, id: x.id, de: porteur.u });
  }
}

function defausserMain(E, j, us) {
  const P = E.j[j];
  for (const u of us) {
    const c = retirerMain(P, u);
    if (c) { P.defausse.push(c); ev(E, { t: 'defausse', j, u: c.u, id: c.id }); }
  }
}

/* « Mélangez une Essence Mauve dans votre Réserve » : on rend d'abord les
   Essences engagées, celles qui ne servent plus ce tour. */
function rendreEssences(E, j, coul, n) {
  const P = E.j[j];
  const cands = P.ess.filter(e => !coul || e.coul === coul).sort((a, b) => (b.eng ? 1 : 0) - (a.eng ? 1 : 0));
  const pris = cands.slice(0, n);
  for (const e of pris) {
    P.ess.splice(P.ess.indexOf(e), 1);
    e.eng = false;
    P.reserve.push(e);
  }
  if (pris.length) {
    melanger(E, P.reserve);
    ev(E, { t: 'essRendue', j, u: pris.map(e => e.u), coul });
  }
  return pris.length;
}

/* ---------- Les déclencheurs ---------- */
/* Les Joueurs du CEO actif d'abord, puis ceux de l'autre ; pour chacun, le
   Joueur puis ses Objets ; enfin les effets « jusqu'à la fin du tour » qui
   guettent quelque chose (Trauma Dump I…). */
function* declencher(E, quand, data) {
  const ordre = [E.actif, adv(E.actif)];
  const sources = [];
  for (const j of ordre) for (const c of E.j[j].lignes) {
    if (!c) continue;
    if (scr(c.id).sur && scr(c.id).sur[quand]) sources.push({ c, porteur: null });
    for (const o of c.obj) if (scr(o.id).sur && scr(o.id).sur[quand]) sources.push({ c: o, porteur: c });
  }
  for (const s of sources) {
    if (E.fin) return;
    /* Toujours là ? Un effet précédent a pu l'emporter. */
    if (s.porteur ? !(enJeu(E, s.porteur) && s.porteur.obj.includes(s.c)) : !enJeu(E, s.c)) continue;
    yield* scr(s.c.id).sur[quand](ctxDe(E, s.c.j, s.c, { porteur: s.porteur }), data);
  }
  const guetteurs = E.temp.filter(t => t.type === 'guet' && t.quand === quand && !t.fini);
  for (const t of guetteurs) {
    if (E.fin) return;
    const h = SCRIPTS[t.src] && SCRIPTS[t.src].guets && SCRIPTS[t.src].guets[t.nom];
    if (h) yield* h(ctxDe(E, t.camp, null, { guet: t }), data);
  }
}

/* ---------- Les décisions ---------- */
function* ouiNon(E, j, titre, o) {
  o = o || {};
  const r = yield {
    qui: j, type: 'choix', titre, texte: o.texte || '', carte: o.carte || null, but: o.but || 'ouiNon',
    options: [{ v: 'oui', label: o.oui || 'Oui' }, { v: 'non', label: o.non || 'Non' }]
  };
  return r.v === 'oui';
}

/* Choisir une carte parmi des instances (sur le plateau, en main, révélées). */
function* choisirUn(E, j, titre, cands, o) {
  o = o || {};
  if (!cands.length) return null;
  const options = cands.map(c => ({ v: c.u, u: c.u, id: c.id, coul: c.coul, label: c.id ? nomDe(c) : 'Essence ' + c.coul }));
  if (o.optionnel) options.push({ v: 'non', label: o.passer || 'Passer' });
  const r = yield { qui: j, type: 'choix', titre, texte: o.texte || '', but: o.but || 'cible', zone: o.zone || 'plateau', options,
    cartes: o.montrer ? o.montrer.map(c => ({ u: c.u, id: c.id })) : null };
  if (r.v === 'non') return null;
  return cands.find(c => c.u === r.v) || null;
}

function* choisirCartes(E, j, titre, us, min, max, o) {
  o = o || {};
  max = Math.min(max, us.length);
  min = Math.min(min, max);
  if (max <= 0) return [];
  const r = yield { qui: j, type: 'cartes', titre, texte: o.texte || '', but: o.but || 'choix', zone: o.zone || 'main', parmi: us.slice(), min, max,
    cartes: o.cartes || null };
  return r.u;
}

function* ordonner(E, j, titre, cartes, o) {
  o = o || {};
  if (cartes.length < 2) return cartes;
  const r = yield { qui: j, type: 'ordre', titre, texte: o.texte || '', parmi: cartes.map(c => c.u), cartes: cartes.map(c => ({ u: c.u, id: c.id })) };
  return r.u.map(u => cartes.find(c => c.u === u));
}

/* ---------- Le contexte d'un effet ---------- */
/* Ce que reçoit un effet de carte : la partie, le CEO qui le joue, la carte
   elle-même — et, pour un Objet, le Joueur qui le porte. */
function ctxDe(E, j, c, extra) {
  return Object.assign({ E, j, c, P: E.j[j], A: E.j[adv(j)] }, extra || {});
}

/* ---------- Avancer, agir ---------- */
function avancer(E, v) {
  let r = E.gen.next(v);
  if (r.done) { E.dem = null; return; }
  E.dem = r.value;
}

/* La demande en cours : à qui, quoi. */
const demande = E => (E.fin ? null : E.dem);

function options(E) {
  const d = demande(E);
  if (!d) return [];
  if (d.type === 'tour') return optionsTour(E);
  if (d.type === 'choix') return d.options.map(o => ({ t: 'choix', v: o.v }));
  return [];
}

const cle = a => JSON.stringify(a, Object.keys(a).sort());

function valider(E, a) {
  const d = demande(E);
  if (!d) throw new Error('La partie est finie.');
  if (d.type === 'tour') {
    const ok = optionsTour(E).some(o => cle(o) === cle(a));
    if (!ok) throw new Error('Action impossible.');
  } else if (d.type === 'choix') {
    if (a.t !== 'choix' || !d.options.some(o => o.v === a.v)) throw new Error('Choix impossible.');
  } else if (d.type === 'cartes') {
    if (a.t !== 'cartes' || !Array.isArray(a.u)) throw new Error('Choix impossible.');
    const set = new Set(a.u);
    if (set.size !== a.u.length || a.u.length < d.min || a.u.length > d.max || a.u.some(u => !d.parmi.includes(u))) throw new Error('Choix impossible.');
  } else if (d.type === 'ordre') {
    if (a.t !== 'ordre' || !Array.isArray(a.u) || a.u.length !== d.parmi.length || d.parmi.some(u => !a.u.includes(u))) throw new Error('Ordre impossible.');
  }
}

/* Jouer une action. Rend les événements qu'elle a produits. `qui` : celui
   qui agit — seul l'abandon peut venir de l'autre. */
function agir(E, a, o) {
  const n0 = E.ev.length;
  if (a.t === 'abandon') {
    if (!E.fin) {
      E.journal.push(a);
      if (E.snap) E.snap.actions.push(a);
      finir(E, adv(a.qui), 'abandon');
      E.dem = null;
    }
    return E.ev.slice(n0);
  }
  if (!(o && o.confiance)) valider(E, a);
  E.journal.push(a);
  if (E.snap) E.snap.actions.push(a);
  avancer(E, a);
  return E.ev.slice(n0);
}

/* ---------- Photographie, copie, reprise ---------- */
function photographier(E) {
  E.snap = { etat: JSON.stringify(E), actions: [] };
}

/* Une copie de la partie, au même point. Elle repart de la photo du début
   du tour et rejoue les actions du tour. */
function cloner(E) {
  if (!E.snap) return rejouer(E.init, E.journal);
  const C = JSON.parse(E.snap.etat);
  cacher(C, 'init', E.init);
  cacher(C, 'ev', []);
  cacher(C, 'journal', E.journal.slice(0, E.journal.length - E.snap.actions.length));
  cacher(C, 'snap', null);
  cacher(C, 'dem', null);
  cacher(C, 'gen', null);
  cacher(C, 'capture', false);
  C.gen = partie(C, true);
  avancer(C);
  for (const a of E.snap.actions) agirConfiance(C, a);
  return C;
}

function agirConfiance(E, a) {
  if (a.t === 'abandon') return agir(E, a);
  E.journal.push(a);
  if (E.snap) E.snap.actions.push(a);
  avancer(E, a);
}

/* Toute la partie, depuis le début : pour reprendre une partie après un
   rechargement, ou suivre celle d'un ami. */
function rejouer(init, journal) {
  const E = creer(init);
  for (const a of journal) agirConfiance(E, a);
  return E;
}

/* ---------- Pour l'interface ---------- */
/* Le résumé d'une attaque : coût, valeur, payable. */
function infoAttaque(E, c, k) {
  const a = carte(c.id).atks[k];
  const cout = coutAttaque(E, c, k);
  return {
    nom: a.nom, cout, val: valeurAttaque(E, c, k), base: a.degats, effet: a.effet,
    payable: payable(E, c.j, cout), plus: a.plus
  };
}

const MODS_VISIBLES = ['def', 'atk', 'kw', 'pasAttaque', 'pasDefenseFace', 'pasJoueur', 'doublePremiere'];

const Combat = {
  REGLE, COULEURS, catalogue, scripts, carte, toutes, baseId, scr,
  creer, agir, demande, options, optionsTour, cloner, rejouer, valider, cle,
  defense, valeurAttaque, coutAttaque, payable, totalCout, aMotCle, shieldActif,
  ciblesAttaque, defenseurs, soutiens, couleurOk, peutAttaquer, infoAttaque, motCleImprime, nomDe,
  joueursDe, tousJoueurs, joueurPermis, ligneDe, enJeu, trouverSurPlateau, porteurDe, premierTourDuPremier,
  /* Les outils des effets (js/combat/effets.js) */
  O: {
    adv, joueursDe, tousJoueurs, joueurPermis, ligneDe, enJeu, nomDe, estCat, carte, baseId, scr, alea, melanger,
    piocher, jouerReserve, engager, desengager, desengagerEssence, engagerEssence, bancer, renvoyerMain,
    defausserMain, defausserPlateau, rendreEssences, deployer, lier, vaincre, toucher, payable, payer,
    ouiNon, choisirUn, choisirCartes, ordonner, ev, aMotCle, motCleImprime, defense, ou, retirerMain,
    porteurDe, trouverSurPlateau, essencesLibres, quitterPlateau, valeurAttaque, retirerObjet, sansAccent,
    shieldActif, couleurOk, benchObjets, REGLE,
    /* Un effet « jusqu'à la fin du tour » (par défaut) ou plus long. Ceux
       qui se voient sur une carte (Défense, attaques, mot-clé, interdiction)
       le disent aussi par un événement, pour que l'arène les montre ; les
       autres (un piège posé, un coût réduit) restent silencieux — un piège
       annoncé ne serait plus un piège. */
    mod: (E, t) => {
      E.temp.push(Object.assign({ jusqua: E.tour }, t));
      if (MODS_VISIBLES.includes(t.type)) ev(E, { t: 'mod', type: t.type, cible: t.cible, camp: t.camp, val: t.val, kw: t.kw });
      return t;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Combat;
racine.Combat = Combat;

})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- js/combat/effets.js
/* Les effets des cartes en combat (version 3.0), carte par carte.

   Chaque entrée traduit le texte imprimé, rangée sous l'identifiant de la
   carte d'origine (une Reverse joue comme elle). Les mots-clés courants —
   Provocation, Garde, Shield, Riposte, Légion — n'ont rien à écrire : le
   moteur les lit sur la carte (js/combat/moteur.js). Restent ici :
     entree      la Signature ★ : l'effet d'entrée, quand le Joueur arrive ;
     sur         les déclencheurs (Signature ⚡, Objets) : sur.recupPV…
     attaques    l'effet imprimé sous une attaque, par numéro d'attaque ;
     plus        le « + » d'une attaque (« 60+ : +10 par Joueur engagé ») ;
     buffAtk / buffDef   Buff : ce qu'il donne aux autres Joueurs ;
     atk / def   un Objet : ce qu'il donne au Joueur qui le porte ;
     effet       un Coach ou un Moment, et jouable() s'il peut l'être ;
     resilience  ce qui se passe quand la carte sort des PV.

   Quand un texte est ambigu, le choix fait est dit en commentaire, et repris
   dans docs/regles-3.0.md. */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const O = Combat.O;
const adv = O.adv;
const R = O.REGLE;

/* ---------- Petits outils ---------- */
const mod = (x, t) => O.mod(x.E, t);
const joueurs = (x, j) => O.joueursDe(x.E, j == null ? x.j : j);
const adverses = x => O.joueursDe(x.E, adv(x.j));
const estObjet = c => O.estCat(c, 'objet');
const estJoueur = c => O.estCat(c, 'joueur');
const estMoment = c => O.estCat(c, 'moment');
const sansProvoc = x => c => !O.aMotCle(x.E, c, 'Provocation');
const mainSauf = x => x.P.main.filter(m => m !== x.c);
const objetsEnJeu = j => E => O.joueursDe(E, j).reduce((l, c) => l.concat(c.obj), []);

function* engagerAdverse(x, filtre, titre) {
  const cs = adverses(x).filter(c => !c.eng && (!filtre || filtre(c)));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Engage un Joueur adverse', cs, { but: 'engagerAdverse' });
  if (t) yield* O.engager(x.E, t);
  return t;
}
function* desengagerAllie(x, filtre, titre) {
  const cs = joueurs(x).filter(c => c.eng && (!filtre || filtre(c)));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Désengage un de tes Joueurs', cs, { but: 'desengagerAllie' });
  if (t) yield* O.desengager(x.E, t);
  return t;
}
function* bancerAdverse(x, filtre, titre) {
  const cs = adverses(x).filter(c => !filtre || filtre(c));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Bench un Joueur adverse', cs, { but: 'bancerAdverse' });
  if (t) O.bancer(x.E, t);
  return t;
}
function* bancerObjetAdverse(x, titre) {
  const cs = objetsEnJeu(adv(x.j))(x.E);
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Bench un Objet adverse', cs, { but: 'bancerObjetAdverse' });
  if (t) O.bancer(x.E, t);
  return t;
}
function* choisirAllie(x, titre, filtre, but) {
  const cs = joueurs(x).filter(c => !filtre || filtre(c));
  return yield* O.choisirUn(x.E, x.j, titre, cs, { but: but || 'allie' });
}
function piocher(x, n) { return O.piocher(x.E, x.j, n); }

/* Retirer une carte précise du Club, de la défausse… */
function prendre(liste, c) {
  const i = liste.indexOf(c);
  if (i >= 0) liste.splice(i, 1);
  return c;
}

/* « Révélez les N cartes du dessus de votre Club et ajoutez une carte X à
   votre main. Défaussez les cartes restantes. » */
function* revelerEtPrendre(x, n, filtre, titre, reste) {
  const E = x.E, P = x.P;
  const top = P.club.splice(0, n);
  O.ev(E, { t: 'revele', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
  const cands = top.filter(filtre);
  const pick = yield* O.choisirUn(E, x.j, titre, cands, { zone: 'liste', montrer: top, but: 'ajouterMain' });
  if (pick) {
    prendre(top, pick);
    P.main.push(pick);
    O.ev(E, { t: 'ajoute', j: x.j, u: pick.u, id: pick.id });
  }
  if (reste === 'dessous') {
    const ord = yield* O.ordonner(E, x.j, 'Dans quel ordre sous ton Club ?', top, { texte: 'La première ira la plus haut.' });
    P.club.push(...ord);
  } else if (reste === 'dessus') {
    const ord = yield* O.ordonner(E, x.j, 'Dans quel ordre sur ton Club ?', top, { texte: 'La première sera piochée la première.' });
    P.club.unshift(...ord);
  } else {
    for (const c of top) { P.defausse.push(c); }
    if (top.length) O.ev(E, { t: 'defausseLot', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
  }
}

/* Regarder ses PV et en échanger un avec une carte de sa main. */
function* echangerPV(x) {
  const E = x.E, P = x.P;
  const main = P.main.filter(m => m !== x.c);
  if (!P.pv.length || !main.length) return;
  O.ev(E, { t: 'regardePV', j: x.j });
  const p = yield* O.choisirUn(E, x.j, 'Choisis un de tes PV', P.pv.slice(), { zone: 'liste', montrer: P.pv, but: 'pvSortir' });
  const m = yield* O.choisirUn(E, x.j, 'Échange-le avec une carte de ta main', main, { zone: 'main', but: 'pvEntrer' });
  if (!p || !m) return;
  P.pv[P.pv.indexOf(p)] = m;
  P.main[P.main.indexOf(m)] = p;
  O.ev(E, { t: 'echangePV', j: x.j });
}

/* « Jouez cette carte » : la Résilience la plus courante. Un Instant joue son
   effet ; un Objet se lie à un de vos Joueurs. Jouer une carte, c'est jouer
   la carte : la restriction par couleur (une Essence de sa couleur déployée,
   Combat.couleurOk) et la limite d'un Coach par tour s'appliquent, comme
   pendant sa propre phase d'action (« Vous ne pouvez jouer qu'une seule
   carte Coach par tour »). Tranché le 2 novembre 2026 (docs/regles-3.0.md,
   § 11, point 5) : le même « jouer » que la restriction par couleur. */
const coachsCeTour = x => x.j === x.E.actif ? x.E.cpt.coachs : x.E.cpt.coachsHors;
function* jouerCetteCarte(x) {
  if (!O.couleurOk(x.E, x.j, x.c)) return;
  if (O.estCat(x.c, 'coach')) {
    if (coachsCeTour(x) >= R.COACHS) return;
    if (x.j === x.E.actif) x.E.cpt.coachs++; else x.E.cpt.coachsHors++;
  }
  if (estObjet(x.c)) {
    const t = yield* choisirAllie(x, 'Lier à quel Joueur ?', null, 'lierAllie');
    if (t) yield* O.lier(x.E, x.j, x.c, t);
    return;
  }
  const s = O.scr(x.c.id);
  if (s.effet) yield* s.effet(x);
}
function peutJouerCetteCarte(x) {
  if (!O.couleurOk(x.E, x.j, x.c)) return false;
  if (O.estCat(x.c, 'coach') && coachsCeTour(x) >= R.COACHS) return false;
  if (estObjet(x.c)) return joueurs(x).length > 0;
  const s = O.scr(x.c.id);
  return !!s.effet && (!s.jouable || s.jouable(x));
}
const JOUER = { resilience: jouerCetteCarte, resPossible: peutJouerCetteCarte };

/* Le choix laissé à l'adversaire (OCE/PCE, C'est officiel !). */
function* choixAdverse(x, titre, a, b) {
  const r = yield {
    qui: adv(x.j), type: 'choix', but: 'choixAdverse', titre, carte: x.c.id,
    options: [{ v: 'a', label: a }, { v: 'b', label: b }]
  };
  return r.v;
}

function* defausserAuChoix(x, j, n, titre, filtre) {
  const P = x.E.j[j];
  const cands = P.main.filter(c => c !== x.c && (!filtre || filtre(c)));
  if (!cands.length) return [];
  const us = yield* O.choisirCartes(x.E, j, titre, cands.map(c => c.u), Math.min(n, cands.length), Math.min(n, cands.length), { but: 'defausse', zone: 'main' });
  O.defausserMain(x.E, j, us);
  return us;
}

/* Une Essence engagée à désengager — de préférence de la couleur demandée. */
function* desengagerEssences(x, n, coul) {
  for (let i = 0; i < n; i++) {
    const e = x.P.ess.find(z => z.eng && (!coul || z.coul === coul));
    if (!e) return;
    yield* O.desengagerEssence(x.E, e);
  }
}

const RENVOI_JOUEUR = c => !!c;

/* =================================================================== */
const S = {};

/* ---------------------------------------------------------- Rose */
/* 010 Broken Brawks — ⚡ Lorsque vous récupérez un PV, engagez ce Joueur. */
S.c010 = { sur: { *recupPV(x, d) { if (d.j === x.j) yield* O.engager(x.E, x.c); } } };

/* 011 Vandale — Glissade : Engagez un Joueur adverse. */
S.c011 = { attaques: { *1(x) { yield* engagerAdverse(x); } } };

/* 012 Squeezie le Toxique — ★ Engagez un Joueur adverse. */
S.c012 = { *entree(x) { yield* engagerAdverse(x); } };

/* 013 Pas Compris — Confusion 60+ : +10 par Joueur engagé (des deux camps,
   l'attaquant compris : il s'engage en attaquant). */
S.c013 = { plus: { 0: E => 10 * O.tousJoueurs(E).filter(c => c.eng).length } };

/* 014 Zacking Buff — Vos Joueurs ont +30 Attaque jusqu'à la fin du tour.
   Résilience : défaussez votre main pour engager un Joueur adverse. */
S.c014 = {
  *effet(x) { mod(x, { type: 'atk', camp: x.j, val: 30 }); },
  *resilience(x) {
    O.defausserMain(x.E, x.j, x.P.main.map(c => c.u));
    yield* engagerAdverse(x);
  },
  resPossible: x => adverses(x).some(c => !c.eng)
};

/* 015 Ravitaillement (Rose) — +10 Attaque, +10 Défense. Lorsque ce Joueur
   est engagé, vous pouvez bench cet Objet pour piocher 1 carte.
   Résilience : engagez 2 de vos Joueurs pour engager un Joueur adverse. */
S.c015 = {
  atk: 10, def: 10,
  sur: {
    *engage(x, d) {
      if (d.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Ravitaillement', { oui: 'Bench et piocher', non: 'Garder', texte: 'Bench cet Objet pour piocher 1 carte ?', carte: x.c.id, but: 'ravitaillement' })) {
        O.bancer(x.E, x.c);
        piocher(x, 1);
      }
    }
  },
  *resilience(x) {
    const miens = joueurs(x).filter(c => !c.eng);
    const us = yield* O.choisirCartes(x.E, x.j, 'Engage 2 de tes Joueurs', miens.map(c => c.u), 2, 2, { zone: 'plateau', but: 'engagerAllies' });
    for (const u of us) yield* O.engager(x.E, O.trouverSurPlateau(x.E, u));
    yield* engagerAdverse(x);
  },
  resPossible: x => joueurs(x).filter(c => !c.eng).length >= 2 && adverses(x).some(c => !c.eng)
};

/* 016 Mur Salvateur — Un de vos Joueurs a +10 Défense et gagne Garde
   jusqu'à la fin du tour adverse. Résilience : un de vos Joueurs gagne Garde
   jusqu'à la fin du tour. */
S.c016 = {
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Garde ?', null, 'buffDef');
    if (!t) return;
    mod(x, { type: 'def', cible: t.u, val: 10, jusqua: x.E.tour + 1 });
    mod(x, { type: 'kw', kw: 'Garde', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => joueurs(x).length > 0,
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Garde ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Garde', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 017 Tout Commence Ici — Buff : vos autres Joueurs ont +10 Attaque. */
S.c017 = { buffAtk: 10 };

/* 018 Buy Bundle M8 !! — Renvoyez 1 Joueur adverse sans Provocation dans la
   main de son propriétaire. Résilience : engagez un Joueur adverse avec
   Provocation. */
S.c018 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Renvoie un Joueur adverse en main', adverses(x).filter(sansProvoc(x)), { but: 'renvoyerAdverse' });
    if (t) O.renvoyerMain(x.E, t);
  },
  jouable: x => adverses(x).some(sansProvoc(x)),
  *resilience(x) { yield* engagerAdverse(x, c => O.aMotCle(x.E, c, 'Provocation')); },
  resPossible: x => adverses(x).some(c => !c.eng && O.aMotCle(x.E, c, 'Provocation'))
};

/* 019 OCE/PCE — Votre adversaire choisit : vous piochez 2 cartes, ou il
   défausse 2 cartes. Résilience : jouez cette carte. */
S.c019 = Object.assign({
  *effet(x) {
    const v = yield* choixAdverse(x, 'OCE/PCE — à toi de choisir', `${x.P.nom} pioche 2 cartes`, 'Tu défausses 2 cartes');
    if (v === 'a') piocher(x, 2);
    else yield* defausserAuChoix(x, adv(x.j), 2, 'Défausse 2 cartes');
  }
}, JOUER);

/* 020 Dégustation d'adversaires — Un Joueur adverse a -30 Défense et votre
   Joueur sur la même ligne a +30 Attaque jusqu'à la fin du tour.
   Résilience : un de vos Joueurs « gagne Buff +20 Défense » jusqu'à la fin
   du tour — lu comme : a +20 Défense. */
S.c020 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse perd 30 Défense ?', adverses(x), { but: 'affaiblirAdverse' });
    if (!t) return;
    mod(x, { type: 'def', cible: t.u, val: -30 });
    const l = O.ligneDe(x.E, t);
    const moi = x.P.lignes[l];
    if (moi) mod(x, { type: 'atk', cible: moi.u, val: 30 });
  },
  jouable: x => adverses(x).length > 0,
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur a +20 Défense ?', null, 'buffDef');
    if (t) mod(x, { type: 'def', cible: t.u, val: 20 });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 021 Trauma Dump III — Renvoyez tous les Objets liés à un Joueur dans la
   main de leur propriétaire. Résilience : renvoyez 1 Objet. */
S.c021 = {
  *effet(x) {
    const cs = O.tousJoueurs(x.E).filter(c => c.obj.length);
    const t = yield* O.choisirUn(x.E, x.j, 'De quel Joueur renvoyer les Objets ?', cs, { but: 'renvoyerObjets' });
    if (t) for (const o of t.obj.slice()) O.renvoyerMain(x.E, o);
  },
  jouable: x => O.tousJoueurs(x.E).some(c => c.obj.length),
  *resilience(x) {
    const cs = objetsEnJeu(0)(x.E).concat(objetsEnJeu(1)(x.E));
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Objet renvoyer en main ?', cs, { but: 'renvoyerObjet' });
    if (t) O.renvoyerMain(x.E, t);
  },
  resPossible: x => O.tousJoueurs(x.E).some(c => c.obj.length)
};

/* 022 Namifique — Omniscience : engagez un Joueur adverse. */
S.c022 = { attaques: { *0(x) { yield* engagerAdverse(x); } } };

/* 024 Agent M.E.L — Buff : vos autres Joueurs ont +20 Attaque. */
S.c024 = { buffAtk: 20 };

/* 026 Pause Technique — Engagez un Joueur adverse sans mot-clé (lu comme :
   dont la carte n'a aucun talent imprimé). */
S.c026 = {
  *effet(x) { yield* engagerAdverse(x, c => !O.motCleImprime(c)); },
  jouable: x => adverses(x).some(c => !c.eng && !O.motCleImprime(c))
};

/* 027 Remontada — Si vous avez moins de PV que votre adversaire, vos
   Joueurs ont +20 Attaque jusqu'à la fin du tour. */
S.c027 = {
  *effet(x) { if (x.P.pv.length < x.A.pv.length) mod(x, { type: 'atk', camp: x.j, val: 20 }); },
  jouable: x => x.P.pv.length < x.A.pv.length
};

/* 028 Championnes d'Europe — Les attaques de vos Joueurs avec Buff ont +20
   jusqu'à la fin du tour. */
S.c028 = {
  *effet(x) { mod(x, { type: 'atk', camp: x.j, val: 20, filtre: 'buff' }); },
  jouable: x => joueurs(x).some(c => O.aMotCle(x.E, c, 'Buff'))
};

/* ---------------------------------------------------------- Orange */
/* 029 Pollo — Demon's Domain 80+ : +20 par Objet lié. ⚡ Lorsque vous liez
   un ou plusieurs Objets à ce Joueur, vous pouvez placer un Objet de votre
   défausse sur votre Club. */
S.c029 = {
  plus: { 0: (E, c) => 20 * c.obj.length },
  sur: {
    *lier(x, d) {
      if (d.cible !== x.c || d.j !== x.j) return;
      const cs = x.P.defausse.filter(estObjet);
      const t = yield* O.choisirUn(x.E, x.j, 'Pollo — un Objet de ta défausse sur ton Club ?', cs, { zone: 'liste', montrer: cs, optionnel: true, passer: 'Non merci', but: 'objetSurClub' });
      if (t) { prendre(x.P.defausse, t); x.P.club.unshift(t); O.ev(x.E, { t: 'surClub', j: x.j, u: t.u, id: t.id }); }
    }
  }
};

/* 030 Worlds Lyon — Vos Joueurs liés ne s'engagent pas lors de leur première
   attaque ce tour. Résilience : un de vos Joueurs gagne Shield jusqu'à la
   fin du tour. */
S.c030 = {
  *effet(x) { mod(x, { type: 'lyon', camp: x.j }); },
  jouable: x => joueurs(x).some(c => c.obj.length && !c.eng),
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Shield ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Shield', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 031 Moi je suis coach — Révélez les 6 cartes du dessus de votre Club,
   ajoutez tous les Objets à votre main, défaussez le reste. Résilience : la
   prochaine Riposte déclenchée ce tour coûte 1 de moins. */
S.c031 = {
  *effet(x) {
    const top = x.P.club.splice(0, 6);
    O.ev(x.E, { t: 'revele', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
    for (const c of top) {
      if (estObjet(c)) { x.P.main.push(c); O.ev(x.E, { t: 'ajoute', j: x.j, u: c.u, id: c.id }); }
      else x.P.defausse.push(c);
    }
  },
  jouable: x => x.P.club.length > 0,
  *resilience(x) { mod(x, { type: 'ripostePlus', camp: x.j, n: 1 }); }
};

/* 032 Invitation — Lorsque ce Joueur est vaincu, bench cet Objet à la place
   (le moteur s'en charge). Résilience : jouez une carte Objet. */
S.c032 = {
  invitation: true,
  *resilience(x) {
    /* « Jouer une carte Objet » : une que la restriction par couleur permet. */
    const o = yield* O.choisirUn(x.E, x.j, 'Quel Objet jouer ?', x.P.main.filter(c => estObjet(c) && O.couleurOk(x.E, x.j, c)), { zone: 'main', but: 'objetMain' });
    if (!o) return;
    const t = yield* choisirAllie(x, 'Lier à quel Joueur ?', null, 'lierAllie');
    if (t) { O.retirerMain(x.P, o.u); yield* O.lier(x.E, x.j, o, t); }
  },
  resPossible: x => x.P.main.some(c => estObjet(c) && O.couleurOk(x.E, x.j, c)) && joueurs(x).length > 0
};

/* 033 Visa Refusé — Un Joueur adverse sans Objet ne peut pas attaquer
   jusqu'à la fin du tour de l'adversaire. Résilience : ajoutez un Objet de
   votre défausse à votre main. */
S.c033 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne pourra pas attaquer ?', adverses(x).filter(c => !c.obj.length), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => adverses(x).some(c => !c.obj.length),
  *resilience(x) {
    const cs = x.P.defausse.filter(estObjet);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Objet reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estObjet)
};

/* 034 Vanyabubu — Baby Shark 60+ : +10 par Objet lié. Riposte. */
S.c034 = { plus: { 0: (E, c) => 10 * c.obj.length } };

/* 036 Maillot Champions '25 — Ce Joueur gagne Riposte. Résilience : un de
   vos Joueurs gagne Riposte jusqu'à la fin du tour. */
S.c036 = {
  donne: ['Riposte'],
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Riposte ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Riposte', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 037 L'Œil de Nikof — Regardez les 4 cartes du dessus, ajoutez un Objet à
   votre main, replacez le reste dessus dans l'ordre de votre choix.
   Résilience : mélangez jusqu'à 2 Objets de votre défausse dans votre Club. */
S.c037 = {
  *effet(x) { yield* revelerEtPrendre(x, 4, estObjet, 'Ajoute un Objet à ta main', 'dessus'); },
  jouable: x => x.P.club.length > 0,
  *resilience(x) {
    const cs = x.P.defausse.filter(estObjet);
    const us = yield* O.choisirCartes(x.E, x.j, 'Jusqu\'à 2 Objets à remettre dans ton Club', cs.map(c => c.u), 0, 2, { zone: 'liste', cartes: cs.map(c => ({ u: c.u, id: c.id })), but: 'recycler' });
    for (const u of us) { const c = x.P.defausse.find(z => z.u === u); prendre(x.P.defausse, c); x.P.club.push(c); }
    if (us.length) { O.melanger(x.E, x.P.club); O.ev(x.E, { t: 'melangeClub', j: x.j, n: us.length }); }
  },
  resPossible: x => x.P.defausse.some(estObjet)
};

/* 115 Champions du Monde — Un de vos Joueurs gagne Riposte et Shield
   jusqu'à la fin du tour adverse. */
S.c115 = {
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Riposte et Shield ?', null, 'buffDef');
    if (!t) return;
    mod(x, { type: 'kw', kw: 'Riposte', cible: t.u, jusqua: x.E.tour + 1 });
    mod(x, { type: 'kw', kw: 'Shield', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => joueurs(x).length > 0
};

/* ---------------------------------------------------------- Jade */
/* 038 Caprice de Gotaga — Défaussez une carte pour jouer la première carte
   de votre Réserve, engagée. Résilience : jouez cette carte. */
S.c038 = Object.assign({
  *effet(x) {
    const d = yield* defausserAuChoix(x, x.j, 1, 'Défausse une carte');
    if (d.length) O.jouerReserve(x.E, x.j, true);
  },
  jouable: x => mainSauf(x).length > 0 && x.P.reserve.length > 0
}, JOUER);

/* ---------------------------------------------------------- Violette */
/* 039 Zéro Soucis — ⚡ Lorsque votre adversaire joue un Joueur, vous pouvez
   échanger la position de ce Joueur et d'un autre de vos Joueurs. */
S.c039 = {
  sur: {
    *deploie(x, d) {
      if (d.j === x.j) return;
      const autres = joueurs(x).filter(c => c !== x.c);
      const t = yield* O.choisirUn(x.E, x.j, 'Zéro Soucis — échanger sa place ?', autres, { optionnel: true, passer: 'Ne rien changer', but: 'echangerPlace' });
      if (t) echangerPlaces(x.E, x.c, t);
    }
  }
};
function echangerPlaces(E, a, b) {
  const P = E.j[a.j];
  const la = P.lignes.indexOf(a), lb = P.lignes.indexOf(b);
  P.lignes[la] = b;
  P.lignes[lb] = a;
  O.ev(E, { t: 'echangePlaces', j: a.j, a: a.u, b: b.u, la: lb, lb: la });
}

/* 040 Les Rois du Saloon — Hold-Up 60+ : +10 par PV que vous avez. */
S.c040 = { plus: { 0: (E, c) => 10 * E.j[c.j].pv.length } };

/* 041 Trauma Dump I — La première fois que votre adversaire récupère un PV
   ce tour, désengagez un de vos Joueurs. Résilience : désengagez un de vos
   Joueurs. */
S.c041 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'recupPV', src: 'c041', nom: 'recup', camp: x.j }); },
  guets: {
    *recup(x, d) {
      if (d.j === x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      yield* desengagerAllie(Object.assign({}, x, { j: x.guet.camp, P: x.E.j[x.guet.camp] }));
    }
  },
  *resilience(x) { yield* desengagerAllie(x); },
  resPossible: x => joueurs(x).some(c => c.eng)
};

/* 042 Reverse Squeeze — Regardez vos PV, choisissez-en un, échangez-le avec
   une carte de votre main. Résilience : défaussez votre premier PV pour
   placer 1 carte de votre main sur vos PV. */
S.c042 = {
  *effet(x) { yield* echangerPV(x); },
  jouable: x => x.P.pv.length > 0 && mainSauf(x).length > 0,
  *resilience(x) {
    const m = yield* O.choisirUn(x.E, x.j, 'Quelle carte poser sur tes PV ?', x.P.main.slice(), { zone: 'main', but: 'pvEntrer' });
    if (!m) return;
    const p = x.P.pv.shift();
    x.P.defausse.push(p);
    O.retirerMain(x.P, m.u);
    x.P.pv.unshift(m);
    O.ev(x.E, { t: 'echangePV', j: x.j });
  },
  resPossible: x => x.P.pv.length > 0 && x.P.main.length > 0
};

/* 043 BLBLBLBL — Échangez la position de 2 de vos Joueurs. Résilience :
   jouez cette carte. */
S.c043 = Object.assign({
  *effet(x) {
    const cs = joueurs(x);
    const us = yield* O.choisirCartes(x.E, x.j, 'Quels Joueurs échanger ?', cs.map(c => c.u), 2, 2, { zone: 'plateau', but: 'echangerPlaces' });
    if (us.length === 2) echangerPlaces(x.E, O.trouverSurPlateau(x.E, us[0]), O.trouverSurPlateau(x.E, us[1]));
  },
  jouable: x => joueurs(x).length >= 2
}, JOUER);

/* 044 Moroccan Monsters — Pinch : désengagez un autre de vos Joueurs.
   ★ Piochez une carte si vous avez plus de 2 PV. */
S.c044 = {
  attaques: { *0(x) { yield* desengagerAllie(x, c => c !== x.c); } },
  *entree(x) { if (x.P.pv.length > 2) piocher(x, 1); }
};

/* 045 Zzzzz — Rêverie : regardez les 4 cartes du dessus de votre Club et
   placez-les dessus ou dessous dans l'ordre de votre choix. ★ Regardez vos
   PV, choisissez-en un, échangez-le avec une carte de votre main. */
S.c045 = {
  attaques: {
    *0(x) {
      const E = x.E, P = x.P;
      const top = P.club.splice(0, 4);
      if (!top.length) return;
      O.ev(E, { t: 'regarde', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
      const bas = yield* O.choisirCartes(E, x.j, 'Lesquelles passer sous ton Club ?', top.map(c => c.u), 0, top.length,
        { zone: 'liste', cartes: top.map(c => ({ u: c.u, id: c.id })), but: 'dessous', texte: 'Les autres restent dessus.' });
      const dessous = top.filter(c => bas.includes(c.u));
      const dessus = top.filter(c => !bas.includes(c.u));
      const h = yield* O.ordonner(E, x.j, 'Ordre sur ton Club', dessus, { texte: 'La première sera piochée la première.' });
      const b = yield* O.ordonner(E, x.j, 'Ordre sous ton Club', dessous);
      P.club.unshift(...h);
      P.club.push(...b);
    }
  },
  *entree(x) { yield* echangerPV(x); }
};

/* 046 Maillot Champions '24 — Lorsque ce Joueur vainc un Joueur (lu ainsi :
   l'Objet parle de son porteur), désengagez une de vos Essences.
   Résilience : désengagez 1 de vos Joueurs. */
S.c046 = {
  sur: { *vainc(x, d) { if (d.par === x.porteur) yield* desengagerEssences(x, 1); } },
  *resilience(x) { yield* desengagerAllie(x); },
  resPossible: x => joueurs(x).some(c => c.eng)
};

/* 047 Champions du Major (Violette) — Jusqu'à la fin du tour, chaque fois
   que vous désengagez un Joueur, désengagez une Essence Violette. */
S.c047 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'desengage', src: 'c047', nom: 'joueur', camp: x.j }); },
  guets: {
    *joueur(x, d) {
      if (d.c.j !== x.guet.camp) return;
      if ((x.E.cpt.majorA = (x.E.cpt.majorA || 0) + 1) > 6) return;
      const P = x.E.j[x.guet.camp];
      const e = P.ess.find(z => z.eng && z.coul === 'violette');
      if (e) yield* O.desengagerEssence(x.E, e);
    }
  }
};
/* 048 Champions du Major (Violette) — Jusqu'à la fin du tour, la première
   fois que vous désengagez une Essence, désengagez un Joueur Violet. */
S.c048 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'desengageEss', src: 'c048', nom: 'ess', camp: x.j }); },
  guets: {
    *ess(x, d) {
      if (d.j !== x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      const t = O.joueursDe(x.E, x.guet.camp).find(c => c.eng && O.carte(c.id).col === 'violette');
      if (t) yield* O.desengager(x.E, t);
    }
  }
};

/* ---------------------------------------------------------- Jaune */
/* 049 Le Roi des rois — Dictature 50+ : +20 par Essence Jaune contrôlée.
   Légion. */
S.c049 = { plus: { 0: (E, c) => 20 * E.j[c.j].ess.filter(e => e.coul === 'jaune').length } };

/* ---------------------------------------------------------- Mauve */
/* 050 La Fée Rosalie — ★ Bench un Joueur adverse engagé sans Provocation. */
S.c050 = { *entree(x) { yield* bancerAdverse(x, c => c.eng && !O.aMotCle(x.E, c, 'Provocation')); } };

/* 052 Most Valuable Planet — Sourire Radieux : mélangez 1 Essence Mauve dans
   votre Réserve. */
S.c052 = { attaques: { *1(x) { O.rendreEssences(x.E, x.j, 'mauve', 1); } } };

/* 053 Ravitaillement (Mauve) — +10 Attaque, +10 Défense. Lorsque ce Joueur
   vainc un Joueur, vous pouvez détruire cet Objet pour piocher 2 cartes.
   Résilience : bench un Objet adverse. */
S.c053 = {
  atk: 10, def: 10,
  sur: {
    *vainc(x, d) {
      if (d.par !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Ravitaillement', { oui: 'Détruire et piocher 2', non: 'Garder', texte: 'Détruire cet Objet pour piocher 2 cartes ?', carte: x.c.id, but: 'ravitaillement' })) {
        O.defausserPlateau(x.E, x.c);
        piocher(x, 2);
      }
    }
  },
  *resilience(x) { yield* bancerObjetAdverse(x); },
  resPossible: x => objetsEnJeu(adv(x.j))(x.E).length > 0
};

/* 054 Trauma Dump II — Mélangez 1 Essence Mauve dans votre Réserve : vos
   Joueurs déployés ont +20 sur leurs attaques jusqu'à la fin du tour.
   Résilience : jouez la première carte de votre Réserve. */
S.c054 = {
  *effet(x) {
    if (O.rendreEssences(x.E, x.j, 'mauve', 1)) mod(x, { type: 'atk', camp: x.j, val: 20 });
  },
  jouable: x => x.P.ess.some(e => e.coul === 'mauve') && joueurs(x).length > 0,
  *resilience(x) { O.jouerReserve(x.E, x.j, false); },
  resPossible: x => x.P.reserve.length > 0
};

/* 055 Target Missed — Si le premier Joueur qui attaque l'adversaire ce tour
   ne vainc aucun Joueur, il gagne Provocation jusqu'à la fin du tour de
   l'adversaire. Résilience : bench un Joueur adverse engagé sans
   Provocation. */
S.c055 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'finAttaque', src: 'c055', nom: 'fin', camp: x.j }); },
  jouable: x => x.E.cpt.attaques === 0,
  guets: {
    *fin(x, X) {
      if (x.guet.fini || X.j !== x.guet.camp) return;
      x.guet.fini = true;
      if (X.rang === 1 && !X.vaincu && O.enJeu(x.E, X.c)) {
        mod(x, { type: 'kw', kw: 'Provocation', cible: X.c.u, jusqua: x.E.tour + 1 });
        O.ev(x.E, { t: 'gagneMotCle', u: X.c.u, kw: 'Provocation' });
      }
    }
  },
  *resilience(x) { yield* bancerAdverse(x, c => c.eng && !O.aMotCle(x.E, c, 'Provocation')); },
  resPossible: x => adverses(x).some(c => c.eng && !O.aMotCle(x.E, c, 'Provocation'))
};

/* 056 Le Maillot Maudit — -10 Attaque. Lorsque ce Joueur vainc un Joueur,
   vous pouvez bench cet Objet pour bench un Joueur adverse engagé.
   Résilience : bench tous vos Joueurs pour mettre fin à la phase de Combat. */
S.c056 = {
  atk: -10,
  sur: {
    *vainc(x, d) {
      if (d.par !== x.porteur) return;
      const cs = adverses(x).filter(c => c.eng);
      if (!cs.length) return;
      if (yield* O.ouiNon(x.E, x.j, 'Le Maillot Maudit', { oui: 'Bench', non: 'Garder', texte: 'Bench cet Objet pour bench un Joueur adverse engagé ?', carte: x.c.id, but: 'maillotMaudit' })) {
        O.bancer(x.E, x.c);
        yield* bancerAdverse(x, c => c.eng);
      }
    }
  },
  *resilience(x) {
    for (const c of joueurs(x).slice()) O.bancer(x.E, c);
    x.E.cpt.combatFini = true;
    O.ev(x.E, { t: 'finCombatForce', j: adv(x.j) });
  }
};

/* 060 Gotaga Pose — Aspiration d'âme 150+ : +100 si l'adversaire a récupéré
   un PV ce tour. Légion. */
S.c060 = { plus: { 0: (E, c) => (E.cpt.pvRecup[adv(c.j)] > 0 ? 100 : 0) } };

/* 061 Champions du Major (Mauve) — Mélangez 3 de vos Essences Mauves dans
   votre Réserve pour bench un Joueur adverse. */
S.c061 = {
  *effet(x) {
    if (O.rendreEssences(x.E, x.j, 'mauve', 3) === 3) yield* bancerAdverse(x);
  },
  jouable: x => x.P.ess.filter(e => e.coul === 'mauve').length >= 3 && adverses(x).length > 0
};

/* 116 The French Sorcerer — Foudre de Rage : bench un Joueur adverse,
   mélangez 1 Essence Mauve dans votre Réserve. Éclairs Vengeurs : mélangez
   2 Essences Mauves dans votre Réserve. */
S.c116 = {
  attaques: {
    *0(x) { yield* bancerAdverse(x); O.rendreEssences(x.E, x.j, 'mauve', 1); },
    *1(x) { O.rendreEssences(x.E, x.j, 'mauve', 2); }
  }
};

/* 117 La Relève — ★ Bench jusqu'à un Baby Driver que vous contrôlez et
   piochez 3 cartes (« jusqu'à » : la pioche ne dépend pas du Bench). */
S.c117 = {
  *entree(x) {
    const bd = joueurs(x).filter(c => O.baseId(c.id) === 'c059');
    const t = yield* O.choisirUn(x.E, x.j, 'Bench un Baby Driver ?', bd, { optionnel: true, passer: 'Non', but: 'bancerAllie' });
    if (t) O.bancer(x.E, t);
    piocher(x, 3);
  }
};

/* 125 6W26L (Secrète) — UltiM8um 60+ : +60 par PV récupéré par votre
   adversaire ce tour. Légion. */
S.c125 = { plus: { 0: (E, c) => 60 * E.cpt.pvRecup[adv(c.j)] } };

/* ---------------------------------------------------------- Verte */
/* 062 Just Passion — Si vous avez moins de 2 PV, doublez la valeur
   d'attaque de ce Joueur. */
S.c062 = { double: (E, c) => E.j[c.j].pv.length < 2 };

/* 063 Calma — ★ Le Joueur adverse sur la même ligne ne peut pas défendre
   une attaque de ce Joueur ce tour. */
S.c063 = { *entree(x) { mod(x, { type: 'pasDefenseFace', cible: x.c.u }); }, ombre: false };

/* ---------------------------------------------------------- Bleue */
/* 064 Bwarks — ⚡ Lorsque vous récupérez un PV, bench un Objet adverse. */
S.c064 = { sur: { *recupPV(x, d) { if (d.j === x.j) yield* bancerObjetAdverse(x); } } };

/* 065 Jus de bagarre — Ce Joueur peut attaquer le Joueur adverse sur sa
   ligne. Résilience : votre adversaire défausse 1 carte Joueur. */
S.c065 = {
  jusDeBagarre: true,
  *resilience(x) { yield* defausserAuChoix(x, adv(x.j), 1, 'Défausse une carte Joueur', estJoueur); },
  resPossible: x => x.A.main.some(estJoueur)
};

/* 066 L'Immense Draculan — Défaussez 1 carte et engagez 2 Essences pour
   mélanger une Essence adverse engagée dans la Réserve de son propriétaire.
   Résilience : engagez 1 Essence adverse. */
S.c066 = {
  *effet(x) {
    const d = yield* defausserAuChoix(x, x.j, 1, 'Défausse une carte');
    if (!d.length) return;
    O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
    const cs = x.A.ess.filter(e => e.eng);
    const e = yield* O.choisirUn(x.E, x.j, 'Quelle Essence adverse renvoyer ?', cs, { zone: 'essences', but: 'essenceAdverse' });
    if (e) {
      x.A.ess.splice(x.A.ess.indexOf(e), 1);
      e.eng = false;
      x.A.reserve.push(e);
      O.melanger(x.E, x.A.reserve);
      O.ev(x.E, { t: 'essRendue', j: adv(x.j), u: [e.u], coul: e.coul });
    }
  },
  jouable: x => mainSauf(x).length > 0 && O.essencesLibres(x.E, x.j).length >= 2 && x.A.ess.some(e => e.eng),
  *resilience(x) {
    const cs = x.A.ess.filter(e => !e.eng);
    const e = yield* O.choisirUn(x.E, x.j, 'Quelle Essence adverse engager ?', cs, { zone: 'essences', but: 'essenceAdverse' });
    if (e) O.engagerEssence(x.E, e);
  },
  resPossible: x => x.A.ess.some(e => !e.eng)
};

/* 067 1% Chance — ★ Ajoutez jusqu'à un « 99% Faith » de votre Club à votre
   main. */
S.c067 = {
  *entree(x) {
    const cs = x.P.club.filter(c => O.baseId(c.id) === 'c068');
    const t = yield* O.choisirUn(x.E, x.j, 'Prendre 99% Faith ?', cs, { zone: 'liste', montrer: cs, optionnel: true, passer: 'Non', but: 'ajouterMain' });
    if (t) { prendre(x.P.club, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
    O.melanger(x.E, x.P.club);
  }
};

/* 068 99% Faith — Si 1% Chance est déployé, ce Joueur gagne Provocation et
   Shield. */
S.c068 = {
  motsCles: (E, c) => (O.joueursDe(E, c.j).some(z => O.baseId(z.id) === 'c067') ? ['Provocation', 'Shield'] : [])
};

/* ---------------------------------------------------------- Azur */
/* 069 L'Arme Nucléaire — WaWar 90+ : +20 par carte en main. ⚡ Lorsque votre
   adversaire est touché, si ce Joueur est votre seul Joueur déployé, il
   défausse le PV sans le regarder (le moteur s'en charge). */
S.c069 = { plus: { 0: (E, c) => 20 * E.j[c.j].main.length }, nucleaire: true };

/* 070 Worlds Japon — À la fin de votre première attaque, ajoutez en main le
   Joueur attaquant et jouez un autre Joueur depuis votre main à la même
   place. Résilience : jouez 2 Joueurs ; à la fin de la phase de Combat,
   bench-les. */
S.c070 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'finAttaque', src: 'c070', nom: 'fin', camp: x.j }); },
  jouable: x => x.E.cpt.attaques === 0 && O.joueurPermis(x.E, x.j) && x.P.main.some(c => c !== x.c && estJoueur(c)),
  guets: {
    *fin(x, X) {
      if (x.guet.fini || X.j !== x.guet.camp) return;
      x.guet.fini = true;
      if (X.rang !== 1 || !O.enJeu(x.E, X.c)) return;
      const P = x.E.j[x.guet.camp];
      const l = O.ligneDe(x.E, X.c);
      O.renvoyerMain(x.E, X.c);
      const cs = O.joueurPermis(x.E, x.guet.camp) ? P.main.filter(c => c !== X.c && estJoueur(c)) : [];
      const t = yield* O.choisirUn(x.E, x.guet.camp, 'Worlds Japon — quel Joueur entre ?', cs, { zone: 'main', but: 'deployer' });
      if (t) { O.retirerMain(P, t.u); yield* O.deployer(x.E, x.guet.camp, t, l); }
    },
    *bench(x) {
      if (x.guet.fini) return;
      x.guet.fini = true;
      for (const u of x.guet.uids) {
        const c = O.trouverSurPlateau(x.E, u);
        if (c && O.enJeu(x.E, c)) O.bancer(x.E, c);
      }
    }
  },
  *resilience(x) {
    const uids = [];
    for (let i = 0; i < 2; i++) {
      if (!x.P.lignes.some(l => !l) || !O.joueurPermis(x.E, x.j)) break;
      const cs = x.P.main.filter(estJoueur);
      const t = yield* O.choisirUn(x.E, x.j, `Worlds Japon — Joueur ${i + 1} sur 2`, cs, { zone: 'main', optionnel: i > 0, passer: 'Plus de Joueur', but: 'deployer' });
      if (!t) break;
      O.retirerMain(x.P, t.u);
      const c = yield* O.deployer(x.E, x.j, t, null);
      if (c) uids.push(c.u);
    }
    if (uids.length) mod(x, { type: 'guet', quand: 'finCombat', src: 'c070', nom: 'bench', camp: x.j, uids });
  },
  resPossible: x => x.P.main.some(estJoueur) && x.P.lignes.some(l => !l) && O.joueurPermis(x.E, x.j)
};

/* 071 Versus Fighting — →↓↘ + 👊 : à la fin de l'attaque, ajoutez ce Joueur
   à votre main et vous pouvez jouer un autre Joueur depuis votre main à sa
   place. Garde. */
S.c071 = {
  attaques: {
    *0(x) {
      if (!O.enJeu(x.E, x.c)) return;
      const l = O.ligneDe(x.E, x.c);
      O.renvoyerMain(x.E, x.c);
      const cs = O.joueurPermis(x.E, x.j) ? x.P.main.filter(c => c !== x.c && estJoueur(c)) : [];
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur prend sa place ?', cs, { zone: 'main', optionnel: true, passer: 'Personne', but: 'deployer' });
      if (t) { O.retirerMain(x.P, t.u); yield* O.deployer(x.E, x.j, t, l); }
    }
  }
};

/* ---------------------------------------------------------- Neutre */
/* 072 Leakof — Regardez la main de votre adversaire. Résilience : jouez
   cette carte. */
S.c072 = Object.assign({
  *effet(x) { O.ev(x.E, { t: 'regarde', j: x.j, de: adv(x.j), cartes: x.A.main.map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 073 L'Héritier — ⚡ Lorsque le CEO adverse lie un Objet à un Joueur, ce
   Joueur a +20 Défense jusqu'à la fin du tour. */
S.c073 = { sur: { *lier(x, d) { if (d.j !== x.j) mod(x, { type: 'def', cible: x.c.u, val: 20 }); } } };

/* 075 Pétrodollars — Vol : regardez les 5 cartes du dessus de votre Club et
   liez jusqu'à 1 Objet parmi elles à un autre de vos Joueurs. ★ Liez 2
   Objets de votre défausse à un autre de vos Joueurs. */
S.c075 = {
  attaques: {
    *0(x) {
      const top = x.P.club.slice(0, 5);
      O.ev(x.E, { t: 'regarde', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
      const autres = joueurs(x).filter(c => c !== x.c);
      const objs = top.filter(estObjet);
      if (!autres.length || !objs.length) return;
      const o = yield* O.choisirUn(x.E, x.j, 'Lier un de ces Objets ?', objs, { zone: 'liste', montrer: top, optionnel: true, passer: 'Non', but: 'lierDepuis' });
      if (!o) return;
      const t = yield* O.choisirUn(x.E, x.j, 'À quel Joueur ?', autres, { but: 'lierAllie' });
      if (t) { prendre(x.P.club, o); yield* O.lier(x.E, x.j, o, t); }
    }
  },
  *entree(x) {
    const autres = joueurs(x).filter(c => c !== x.c);
    const objs = x.P.defausse.filter(estObjet);
    if (!autres.length || !objs.length) return;
    const t = yield* O.choisirUn(x.E, x.j, 'À quel Joueur lier 2 Objets ?', autres, { but: 'lierAllie' });
    if (!t) return;
    const n = Math.min(2, objs.length);
    const us = yield* O.choisirCartes(x.E, x.j, `Quels Objets lier (${n}) ?`, objs.map(c => c.u), n, n, { zone: 'liste', cartes: objs.map(c => ({ u: c.u, id: c.id })), but: 'lierDepuis' });
    for (const u of us) {
      /* Un déclencheur (Pollo) a pu déplacer l'Objet entre-temps. */
      const o = x.P.defausse.find(c => c.u === u);
      if (!o || !O.enJeu(x.E, t)) continue;
      prendre(x.P.defausse, o);
      yield* O.lier(x.E, x.j, o, t);
    }
  }
};

/* 076 Ralliement — Déploiement : révélez les 5 cartes du dessus de votre
   Club, ajoutez une carte Joueur à votre main, défaussez le reste. Buff :
   vos Joueurs alliés gagnent +10 Défense (lu : les autres). */
S.c076 = {
  buffDef: 10,
  attaques: { *0(x) { yield* revelerEtPrendre(x, 5, estJoueur, 'Ajoute un Joueur à ta main'); } }
};

/* 077 Brawks Déter — ⚡ Lorsque votre adversaire récupère un PV suite à
   l'attaque de ce Joueur, piochez une carte. */
S.c077 = { sur: { *recupPV(x, d) { if (d.j !== x.j && d.par === x.c) piocher(x, 1); } } };

/* 079 Instalock — ★ Vous pouvez engager ce Joueur pour bench un Joueur
   adverse. */
S.c079 = {
  *entree(x) {
    if (!adverses(x).length || x.c.eng) return;
    if (yield* O.ouiNon(x.E, x.j, 'Instalock', { oui: 'Engager et bench', non: 'Non', texte: 'Engager Instalock pour bench un Joueur adverse ?', carte: x.c.id, but: 'instalock' })) {
      yield* O.engager(x.E, x.c);
      yield* bancerAdverse(x);
    }
  },
  ombre: false
};

/* 080 Meet & Greeter — ⚡ Lorsque vous défendez avec ce Joueur, vous pouvez
   le renvoyer dans votre Club pour jouer un autre Joueur, engagé, à sa place
   en tant que défenseur. */
S.c080 = {
  sur: {
    *defense(x, X) {
      if (X.defenseur !== x.c || !O.joueurPermis(x.E, x.j)) return;
      const cs = x.P.main.filter(estJoueur);
      if (!cs.length) return;
      const t = yield* O.choisirUn(x.E, x.j, 'Meet & Greeter — qui défend à sa place ?', cs, { zone: 'main', optionnel: true, passer: 'Il reste', but: 'deployer' });
      if (!t) return;
      const l = O.ligneDe(x.E, x.c);
      /* Il quitte le Terrain : ses Objets sont bench. */
      O.benchObjets(x.E, O.quitterPlateau(x.E, x.c));
      x.P.club.push(x.c);
      O.melanger(x.E, x.P.club);
      O.ev(x.E, { t: 'auClub', j: x.j, u: x.c.u, id: x.c.id, ligne: l });
      O.retirerMain(x.P, t.u);
      const n = yield* O.deployer(x.E, x.j, t, l, { engage: true });
      if (n) { X.defenseur = n; X.cible = n.u; }
    }
  }
};

/* 082 Barakataga — Les CEO piochent jusqu'à avoir 4 cartes en main.
   Résilience : piochez 2 cartes. */
S.c082 = {
  *effet(x) {
    for (const j of [x.j, adv(x.j)]) {
      const n = 4 - x.E.j[j].main.length;
      if (n > 0) O.piocher(x.E, j, n);
    }
  },
  jouable: x => mainSauf(x).length < 4,
  *resilience(x) { piocher(x, 2); }
};

/* 083 Mercato — Piochez 3 cartes. Résilience : regardez les 5 cartes du
   dessus, ajoutez un Joueur à votre main, le reste dessous dans l'ordre de
   votre choix. */
S.c083 = {
  *effet(x) { piocher(x, 3); },
  jouable: x => x.P.club.length > 0,
  *resilience(x) { yield* revelerEtPrendre(x, 5, estJoueur, 'Ajoute un Joueur à ta main', 'dessous'); },
  resPossible: x => x.P.club.length > 0
};

/* 084 La Chevalière — Lorsque vous déclenchez une attaque, vous pouvez bench
   cet Objet pour qu'elle coûte 2 Essences Neutres (le moteur le propose).
   Résilience : les prochaines attaques adverses de ce tour coûtent une
   Essence Neutre de plus. */
const CHEVALIERE_RES = {
  *resilience(x) { mod(x, { type: 'cout', payeur: adv(x.j), quand: 'toutes', neutrePlus: 1 }); }
};
S.c084 = Object.assign({ chevaliere: 'banc' }, CHEVALIERE_RES);

/* 085 Cooked — +30 Attaque. Résilience : ajoutez un Moment de votre
   défausse à votre main. */
S.c085 = {
  atk: 30,
  *resilience(x) {
    const cs = x.P.defausse.filter(estMoment);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Moment reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estMoment)
};

/* 086 En slip sur la Faille — Lorsque ce Joueur est engagé, vous pouvez
   bench cet Objet pour le désengager ; il ne peut plus attaquer ce tour.
   Résilience : « Vos Objet bench sont ajoutés à votre main jusqu'à la fin du
   tour. » Bench, c'est la défausse (règles officielles) : les Objets qui y
   sont arrivés par un bench (P.bench) passent en main, et ceux qui y sont
   encore à la fin du tour retournent à la défausse (expirer, moteur). */
S.c086 = {
  sur: {
    *engage(x, d) {
      if (d.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'En slip sur la Faille', { oui: 'Bench et désengager', non: 'Garder', texte: 'Bench cet Objet pour désengager ce Joueur ? Il ne pourra plus attaquer ce tour.', carte: x.c.id, but: 'enSlip' })) {
        const p = x.porteur;
        O.bancer(x.E, x.c);
        mod(x, { type: 'pasAttaque', cible: p.u });
        yield* O.desengager(x.E, p);
      }
    }
  },
  *resilience(x) {
    const objs = x.P.defausse.filter(o => estObjet(o) && x.P.bench.includes(o.u));
    for (const o of objs) { prendre(x.P.defausse, o); x.P.main.push(o); }
    if (objs.length) {
      mod(x, { type: 'retourDefausse', camp: x.j, us: objs.map(o => o.u) });
      O.ev(x.E, { t: 'ajouteLot', j: x.j, cartes: objs.map(o => ({ u: o.u, id: o.id })) });
    }
  },
  resPossible: x => x.P.defausse.some(o => estObjet(o) && x.P.bench.includes(o.u))
};

/* 087 Gros Bonnet — +30 Défense. Résilience : jouez cette carte. */
S.c087 = Object.assign({ def: 30 }, JOUER);

/* 088 M4 — +15 Attaque. Lorsque vous déclenchez une attaque avec ce Joueur,
   vous pouvez défausser jusqu'à 3 cartes : +10 Attaque par carte.
   Résilience : défaussez une carte et piochez une carte ; si c'est un
   Joueur, un Joueur adverse a -30 Attaque. */
S.c088 = {
  atk: 15,
  sur: {
    *attaque(x, X) {
      if (X.c !== x.porteur || !x.P.main.length || O.carte(X.c.id).atks[X.k].degats == null) return;
      const us = yield* O.choisirCartes(x.E, x.j, 'M4 — défausser pour +10 par carte ?', x.P.main.map(c => c.u), 0, 3, { zone: 'main', but: 'm4', texte: 'Jusqu\'à 3 cartes.' });
      if (us.length) { O.defausserMain(x.E, x.j, us); X.bonus += 10 * us.length; O.ev(x.E, { t: 'bonus', u: X.c.u, val: 10 * us.length }); }
    }
  },
  *resilience(x) {
    const [u] = yield* O.choisirCartes(x.E, x.j, 'Défausse une carte', x.P.main.map(c => c.u), 1, 1, { zone: 'main', but: 'defausse' });
    const c = x.P.main.find(z => z.u === u);
    O.defausserMain(x.E, x.j, [u]);
    piocher(x, 1);
    if (c && estJoueur(c)) {
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse a -30 Attaque ?', adverses(x), { but: 'affaiblirAdverse' });
      if (t) mod(x, { type: 'atk', cible: t.u, val: -30 });
    }
  },
  resPossible: x => x.P.main.length > 0
};

/* 089 La Luxueuse I — +10 Défense par Objet lié à ce Joueur (elle compte).
   Résilience : jouez cette carte. */
S.c089 = Object.assign({ def: (E, c) => 10 * c.obj.length }, JOUER);

/* 090 La Luxueuse II — Lorsque l'adversaire attaque cette ligne, mélangez une
   carte de votre défausse dans votre Club et piochez 1 carte. Résilience :
   jouez cette carte. */
function* luxueuse(x, X) {
  if (X.j === x.j || O.ligneDe(x.E, X.c) !== O.ligneDe(x.E, x.porteur)) return;
  const cs = x.P.defausse.slice();
  const t = yield* O.choisirUn(x.E, x.j, 'La Luxueuse — quelle carte remettre dans ton Club ?', cs, { zone: 'liste', montrer: cs, but: 'recycler' });
  if (t) { prendre(x.P.defausse, t); x.P.club.push(t); O.melanger(x.E, x.P.club); }
  piocher(x, 1);
}
S.c090 = Object.assign({ sur: { attaque: luxueuse } }, JOUER);

/* 091 C'est officiel ! — Votre adversaire choisit : vous piochez 3 cartes et
   il en pioche 2 ; ou il défausse 2 cartes et vous en défaussez 1.
   Résilience : jouez cette carte. */
S.c091 = Object.assign({
  *effet(x) {
    const v = yield* choixAdverse(x, 'C\'est officiel ! — à toi de choisir', `${x.P.nom} pioche 3, toi 2`, `Tu défausses 2, ${x.P.nom} 1`);
    if (v === 'a') { piocher(x, 3); O.piocher(x.E, adv(x.j), 2); }
    else {
      yield* defausserAuChoix(x, adv(x.j), 2, 'Défausse 2 cartes');
      yield* defausserAuChoix(x, x.j, 1, 'Défausse 1 carte');
    }
  }
}, JOUER);

/* 092 Clim — Bench un Objet adverse. Résilience : un Joueur adverse sans
   Objet ne peut plus attaquer jusqu'à la fin du tour. */
S.c092 = {
  *effet(x) { yield* bancerObjetAdverse(x); },
  jouable: x => objetsEnJeu(adv(x.j))(x.E).length > 0,
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne peut plus attaquer ?', adverses(x).filter(c => !c.obj.length && !c.eng), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u });
  },
  resPossible: x => adverses(x).some(c => !c.obj.length && !c.eng)
};

/* 093 Alerte Leak — Révélez vos PV. Résilience : jouez cette carte. */
S.c093 = Object.assign({
  *effet(x) { x.P.pvVus = true; O.ev(x.E, { t: 'revelePV', j: x.j, cartes: x.P.pv.map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 094 One More — Chaque fois que vous piochez ce tour, piochez une carte de
   plus. Résilience : votre adversaire doit déclencher une attaque de plus si
   possible. */
S.c094 = {
  *effet(x) { mod(x, { type: 'piochePlus', camp: x.j }); },
  *resilience(x) { x.E.cpt.doitAttaquer += 1; O.ev(x.E, { t: 'doitAttaquer', j: adv(x.j) }); }
};

/* 095 Tunnel — Si vous avez un Joueur seul sur sa ligne, piochez 2 cartes.
   Résilience : jouez cette carte. */
const seulSurSaLigne = x => joueurs(x).some(c => !x.A.lignes[O.ligneDe(x.E, c)]);
S.c095 = Object.assign({
  *effet(x) { if (seulSurSaLigne(x)) piocher(x, 2); },
  jouable: seulSurSaLigne
}, JOUER);

/* 096 Tweet la Défaite — La première fois que votre adversaire récupère un
   PV ce tour, les Joueurs adverses ont -20 Défense. Résilience : un Joueur
   adverse a -20 Attaque. */
S.c096 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'recupPV', src: 'c096', nom: 'recup', camp: x.j }); },
  guets: {
    *recup(x, d) {
      if (d.j === x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      O.mod(x.E, { type: 'def', camp: adv(x.guet.camp), val: -20 });
      O.ev(x.E, { t: 'malus', j: adv(x.guet.camp), def: -20 });
    }
  },
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse a -20 Attaque ?', adverses(x), { but: 'affaiblirAdverse' });
    if (t) mod(x, { type: 'atk', cible: t.u, val: -20 });
  },
  resPossible: x => adverses(x).length > 0
};

/* 097 Doig'Dance — La première attaque que vous déclenchez ce tour coûte 1
   Essence Neutre de moins. Résilience : 2 de vos Joueurs ont +20 Défense. */
S.c097 = {
  *effet(x) { mod(x, { type: 'cout', payeur: x.j, quand: 'premiere', neutreMoins: 1 }); },
  jouable: x => x.E.cpt.attaques === 0,
  *resilience(x) {
    const cs = joueurs(x);
    const us = yield* O.choisirCartes(x.E, x.j, '2 Joueurs à +20 Défense', cs.map(c => c.u), Math.min(2, cs.length), Math.min(2, cs.length), { zone: 'plateau', but: 'buffDef' });
    for (const u of us) mod(x, { type: 'def', cible: u, val: 20 });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 098 Méta Cœurs — Mélangez 6 cartes Joueur de votre défausse dans votre
   Club (jusqu'à 6). Résilience : jouez cette carte. */
S.c098 = Object.assign({
  *effet(x) {
    const cs = x.P.defausse.filter(estJoueur).slice(0, 6);
    for (const c of cs) { prendre(x.P.defausse, c); x.P.club.push(c); }
    O.melanger(x.E, x.P.club);
    O.ev(x.E, { t: 'melangeClub', j: x.j, n: cs.length });
  },
  jouable: x => x.P.defausse.some(estJoueur)
}, JOUER);

/* 099 Méta F*ck — Révélez les 6 cartes du dessus, ajoutez un Moment à votre
   main, défaussez le reste. Résilience : jouez cette carte. */
S.c099 = Object.assign({
  *effet(x) { yield* revelerEtPrendre(x, 6, estMoment, 'Ajoute un Moment à ta main'); },
  jouable: x => x.P.club.length > 0
}, JOUER);

/* 101 Slay — Si ce Joueur est désengagé, l'attaquant face à lui doit le
   cibler. */
S.c101 = { provocSiLibre: true };

/* 102 Monster — ★ Vous pouvez engager 2 Essences pour piocher 2 cartes. */
S.c102 = {
  *entree(x) {
    if (O.essencesLibres(x.E, x.j).length < 2) return;
    if (yield* O.ouiNon(x.E, x.j, 'Monster', { oui: 'Engager 2 Essences', non: 'Non', texte: 'Engager 2 Essences pour piocher 2 cartes ?', carte: x.c.id, but: 'monster' })) {
      O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
      piocher(x, 2);
    }
  }
};

/* 103 Joueur de l'Ombre — Déclenchez l'effet d'entrée d'un Joueur de votre
   défausse (pas ceux qui parlent d'eux-mêmes : Calma, Instalock).
   Résilience : défaussez votre main et piochez autant de cartes. */
const ombreOk = c => estJoueur(c) && O.scr(c.id).entree && O.scr(c.id).ombre !== false;
S.c103 = {
  *effet(x) {
    const cs = x.P.defausse.filter(ombreOk);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel effet d\'entrée rejouer ?', cs, { zone: 'liste', montrer: cs, but: 'ombre' });
    if (t) { O.ev(x.E, { t: 'entree', j: x.j, u: t.u, id: t.id, ombre: true }); yield* O.scr(t.id).entree(Object.assign({}, x, { c: t })); }
  },
  jouable: x => x.P.defausse.some(ombreOk),
  *resilience(x) {
    const n = x.P.main.length;
    O.defausserMain(x.E, x.j, x.P.main.map(c => c.u));
    piocher(x, n);
  },
  resPossible: x => x.P.main.length > 0
};

/* 104 Lofi Girl — Désengagez un de vos Joueurs. Résilience : jouez cette
   carte. */
S.c104 = Object.assign({
  *effet(x) { yield* desengagerAllie(x); },
  jouable: x => joueurs(x).some(c => c.eng)
}, JOUER);

/* 105 M16 — +20 Attaque. Lorsque votre adversaire déclare un défenseur sur
   l'attaque de ce Joueur, révélez la carte du dessus de votre Club : si
   c'est un Joueur, +20 Attaque. Résilience : révélez la carte du dessus ; si
   c'est un Joueur, jouez-la. */
S.c105 = {
  atk: 20,
  sur: {
    *defense(x, X) {
      if (X.c !== x.porteur || !x.P.club.length) return;
      const c = x.P.club[0];
      O.ev(x.E, { t: 'revele', j: x.j, cartes: [{ u: c.u, id: c.id }] });
      if (estJoueur(c)) { X.bonus += 20; O.ev(x.E, { t: 'bonus', u: X.c.u, val: 20 }); }
    }
  },
  *resilience(x) {
    const c = x.P.club[0];
    O.ev(x.E, { t: 'revele', j: x.j, cartes: [{ u: c.u, id: c.id }] });
    if (estJoueur(c) && x.P.lignes.some(l => !l) && O.joueurPermis(x.E, x.j)) {
      x.P.club.shift();
      yield* O.deployer(x.E, x.j, c, null);
    }
  },
  resPossible: x => x.P.club.length > 0
};

/* 106 Trahison++ — Lorsque votre adversaire déclare un défenseur sur
   l'attaque de ce Joueur, vous pouvez bench cet Objet pour désengager ce
   Joueur et annuler l'attaque ; il ne peut plus attaquer ce tour.
   Résilience : un Joueur adverse ne peut plus attaquer ce tour. */
S.c106 = {
  sur: {
    *defense(x, X) {
      if (X.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Trahison++', { oui: 'Annuler l\'attaque', non: 'Continuer', texte: 'Bench cet Objet pour désengager ce Joueur et annuler l\'attaque ?', carte: x.c.id, but: 'trahison' })) {
        const p = x.porteur;
        O.bancer(x.E, x.c);
        X.annulee = true;
        mod(x, { type: 'pasAttaque', cible: p.u });
        O.ev(x.E, { t: 'annule', u: p.u });
        yield* O.desengager(x.E, p);
      }
    }
  },
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne peut plus attaquer ?', adverses(x).filter(c => !c.eng), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u });
  },
  resPossible: x => adverses(x).some(c => !c.eng)
};

/* 107 GP Explorer III — Engagez 2 Essences pour piocher 3 cartes.
   Résilience : désengagez 2 Essences. */
S.c107 = {
  *effet(x) {
    O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
    piocher(x, 3);
  },
  jouable: x => O.essencesLibres(x.E, x.j).length >= 2,
  *resilience(x) { yield* desengagerEssences(x, 2); },
  resPossible: x => x.P.ess.some(e => e.eng)
};

/* 108 Keynote — Renvoyez tous vos Joueurs dans la main de leur
   propriétaire. Résilience : ajoutez un Joueur de votre défausse à votre
   main. */
S.c108 = {
  *effet(x) { for (const c of joueurs(x).slice()) O.renvoyerMain(x.E, c); },
  jouable: x => joueurs(x).length > 0,
  *resilience(x) {
    const cs = x.P.defausse.filter(estJoueur);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estJoueur)
};

/* 109 Hatewatch — Bench un de vos Joueurs et votre adversaire défausse une
   carte. Résilience : jouez cette carte. */
S.c109 = Object.assign({
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur bench ?', null, 'bancerAllie');
    if (!t) return;
    O.bancer(x.E, t);
    yield* defausserAuChoix(x, adv(x.j), 1, 'Défausse une carte');
  },
  jouable: x => joueurs(x).length > 0
}, JOUER);

/* 110 Leakof — Regardez les 5 cartes du dessus du Club adverse.
   Résilience : jouez cette carte. */
S.c110 = Object.assign({
  *effet(x) { O.ev(x.E, { t: 'regarde', j: x.j, de: adv(x.j), cartes: x.A.club.slice(0, 5).map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 111 La Gaming House — La deuxième attaque que vous déclenchez ce tour
   coûte 2 Essences non neutres de moins. Résilience : vos Joueurs ont +10
   Défense jusqu'à la fin du tour. */
S.c111 = {
  *effet(x) { mod(x, { type: 'cout', payeur: x.j, quand: 'deuxieme', couleurMoins: 2 }); },
  jouable: x => x.E.cpt.attaques < 2,
  *resilience(x) { mod(x, { type: 'def', camp: x.j, val: 10 }); }
};

/* 112 M8 Résilience — ⚡ Lorsque le CEO adverse attaque cette ligne,
   piochez 1 carte. */
S.c112 = {
  sur: { *attaque(x, X) { if (X.j !== x.j && O.ligneDe(x.E, X.c) === O.ligneDe(x.E, x.c)) piocher(x, 1); } }
};

/* 113 Kampaï — ★ Si vous avez 3 Joueurs Roses, renvoyez un Joueur adverse
   dans sa main. */
S.c113 = {
  *entree(x) {
    if (joueurs(x).filter(c => O.carte(c.id).col === 'rose').length < 3) return;
    const t = yield* O.choisirUn(x.E, x.j, 'Renvoie un Joueur adverse en main', adverses(x), { but: 'renvoyerAdverse' });
    if (t) O.renvoyerMain(x.E, t);
  }
};

/* 114 SBG — Piochez 1 carte par Joueur adverse engagé. */
S.c114 = {
  *effet(x) { const n = adverses(x).filter(c => c.eng).length; if (n) piocher(x, n); },
  jouable: x => adverses(x).some(c => c.eng)
};

/* 122 La Luxueuse III — +10 Défense par Objet lié ; lorsque le CEO adverse
   attaque cette ligne, mélangez une carte de votre défausse dans votre Club
   et piochez 1 carte. */
S.c122 = { def: (E, c) => 10 * c.obj.length, sur: { attaque: luxueuse } };

/* ---------------------------------------------------------- Promos */
/* P01 / P02 Major de Paris — Cherchez 1 Joueur Mauve ou 1 Essence Mauve dans
   votre Club. Les Essences vivant dans la Réserve (règle 3.0), l'Essence
   Mauve se cherche là, et entre en jeu. */
S.p01 = S.p02 = {
  *effet(x) {
    const js = x.P.club.filter(c => estJoueur(c) && O.carte(c.id).col === 'mauve');
    const es = x.P.reserve.filter(e => e.coul === 'mauve');
    const opts = [];
    if (js.length) opts.push({ v: 'j', label: 'Un Joueur Mauve en main' });
    if (es.length) opts.push({ v: 'e', label: 'Une Essence Mauve en jeu' });
    if (!opts.length) return;
    const r = opts.length === 1 ? opts[0] : yield { qui: x.j, type: 'choix', but: 'major', titre: 'Major de Paris', carte: x.c.id, options: opts };
    if (r.v === 'j') {
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur Mauve ?', js, { zone: 'liste', montrer: js, but: 'ajouterMain' });
      if (t) { prendre(x.P.club, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id, montre: true }); }
      O.melanger(x.E, x.P.club);
    } else {
      const e = es[0];
      prendre(x.P.reserve, e);
      x.P.reserve.unshift(e);
      O.jouerReserve(x.E, x.j, false);
      O.melanger(x.E, x.P.reserve);
    }
  },
  jouable: x => x.P.club.some(c => estJoueur(c) && O.carte(c.id).col === 'mauve') || x.P.reserve.some(e => e.coul === 'mauve')
};

/* P03 Brawks Déter, P04 Squeezie le Toxique (3.0.13) : les cartes #077 et
   #012 en Promo, même texte (photos du propriétaire, 1er novembre 2026). */
S.p03 = S.c077;
S.p04 = S.c012;

/* P05 Tout Commence Ici — Légion (version Promo) : il revient en main sans
   rien défausser. */
S.p05 = { legionGratuite: true };

/* ---------------------------------------------------------- Secrètes */
/* Les trois Secrètes révélées en 3.0.13 (photos du propriétaire). Ce que
   leur texte ne tranche pas est dit ici et dans docs/regles-3.0.md § 11. */

/* 124 Brawks Trop Déter — Signature ⚡ : « Lorsque votre adversaire
   récupère un PV suite à l'attaque de ce Joueur, désengagez tous vos
   Joueurs. » Le même déclencheur que Brawks Déter (#077). */
S.c124 = { sur: { *recupPV(x, d) {
  if (d.j === x.j || d.par !== x.c) return;
  for (const c of joueurs(x)) if (c.eng) yield* O.desengager(x.E, c);
} } };

/* 126 GP Explorer II (Moment Instant) — « Les CEO choisissent chacun 2 de
   leurs Joueurs et récupèrent les autres en main. Vous ne pouvez plus jouer
   de Joueur pour le reste de ce tour. » Lecture retenue : celui qui joue la
   carte choisit d'abord, puis l'adversaire ; un CEO qui a deux Joueurs ou
   moins n'en reprend aucun ; les Objets des Joueurs repris sont bench (« Les
   Objet sont bench lorsque la carte Joueur associée quitte le Terrain »). */
S.c126 = {
  *effet(x) {
    for (const j of [x.j, adv(x.j)]) {
      const js = O.joueursDe(x.E, j);
      if (js.length <= 2) continue;
      const garde = [];
      for (let i = 0; i < 2; i++) {
        const t = yield* O.choisirUn(x.E, j, `GP Explorer II : garde un Joueur (${i + 1} sur 2)`, js.filter(c => !garde.includes(c)), { but: 'garderJoueur', texte: 'Les autres reviennent dans ta main ; leurs Objets vont à la défausse.' });
        if (t) garde.push(t);
      }
      for (const c of js) if (!garde.includes(c)) O.renvoyerMain(x.E, c);
    }
    mod(x, { type: 'pasJoueur', camp: x.j });
  }
};

/* 127 Paris Gentle Mates (Moment Instant) — « Mélangez 2 de vos Essences
   Mauves dans votre Réserve pour doubler la valeur de la première attaque
   que vous déclenchez ce tour. » Lectures retenues : les deux Essences sont
   prises parmi celles en jeu, engagées d'abord (celles qui ont déjà payé) ;
   seule la valeur de l'attaque est doublée, pas un soutien qui s'y ajoute
   (comme Just Passion, #062). Un Moment se joue avant la première attaque
   du tour (la phase de Combat les ferme) : « la première attaque » est
   donc toujours à venir. */
S.c127 = {
  *effet(x) {
    if (x.P.ess.filter(e => e.coul === 'mauve').length < 2) return;
    O.rendreEssences(x.E, x.j, 'mauve', 2);
    mod(x, { type: 'doublePremiere', camp: x.j });
  },
  jouable: x => x.P.ess.filter(e => e.coul === 'mauve').length >= 2
};

/* U01 L'Unique Chevalière — comme La Chevalière, mais l'Objet est défaussé. */
S.u01 = Object.assign({ chevaliere: 'defausse' }, CHEVALIERE_RES);

Combat.scripts(S);

})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- js/combat/decks.js
/* Les decks (version 3.0) : comment on les construit, les deux Starter Decks
   des Sections, et les decks que l'IA reçoit.

   Un deck enregistré : { id, nom, cartes: { id: nombre }, reserve: { couleur:
   nombre }, couverture: id }. Le moteur, lui, veut deux listes à plat : c'est
   versMoteur() qui les déplie.

   Les règles de construction sont les règles officielles (« Construire son
   jeu ») : un Club de 40 cartes (REGLE.CLUB), pas plus de trois exemplaires
   d'une même carte — « une carte possédant le même nom et la même couleur,
   quand bien même son texte ou son art est différent » —, et une Réserve de
   10 Essences (REGLE.RESERVE) de la couleur qu'on veut : les Essences ne se
   possèdent pas, elles se choisissent. */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const R = Combat.REGLE;

const TYPES = ['joueur', 'coach', 'moment', 'objet'];

/* Une « même carte » : le même nom et la même couleur (une Reverse, une
   Promo à l'illustration différente, deux cartes de même nom comme les deux
   Leakof). Le serveur a la même clé (cle_copie, 23_combats.sql). */
function cleCopie(id) {
  const c = Combat.carte(id);
  return c ? Combat.O.sansAccent(c.nom) + '|' + c.col : id;
}
/* Trois exemplaires, quelle que soit la rareté (limite_copies). */
function limite(id) {
  return Combat.carte(id) ? R.COPIES : 0;
}
/* Peut entrer dans un Club : un Joueur, un Coach, un Moment, un Objet — et
   pas une Secrète encore floutée (elle n'a pas de texte). */
const jouable = c => !!c && TYPES.includes(c.cat) && !c.cachee;

const total = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);

/* Ce qui ne va pas dans un deck. `possede` : ce que le joueur a (id →
   exemplaires) ; absent, on ne le vérifie pas (Starter Decks prêtés). */
function verifier(deck, possede) {
  const err = [];
  const cartes = deck.cartes || {};
  const n = total(cartes);
  if (n !== R.CLUB) err.push(n < R.CLUB ? `Il manque ${R.CLUB - n} carte${R.CLUB - n > 1 ? 's' : ''} au Club.` : `Le Club a ${n - R.CLUB} carte${n - R.CLUB > 1 ? 's' : ''} de trop.`);
  const parCle = {}, nomDe = {};
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!q) continue;
    if (!jouable(c)) { err.push(`« ${c ? c.nom : id} » ne se joue pas en combat.`); continue; }
    const k = cleCopie(id);
    parCle[k] = (parCle[k] || 0) + q;
    nomDe[k] = c.nom;
    if (possede && (possede[id] || 0) < q) err.push(`Tu n'as que ${possede[id] || 0} « ${c.nom} »${c.rev ? ' Reverse' : ''}.`);
  }
  for (const k in parCle) {
    if (parCle[k] > R.COPIES) err.push(`« ${nomDe[k]} » : ${R.COPIES} exemplaires au plus, toutes versions comprises.`);
  }
  const r = deck.reserve || {};
  const nr = total(r);
  if (Object.keys(r).some(k => r[k] && !Combat.COULEURS.includes(k))) err.push('Couleur d\'Essence inconnue.');
  if (nr !== R.RESERVE) err.push(`La Réserve doit compter ${R.RESERVE} Essences (${nr}).`);
  return err;
}

function versMoteur(deck) {
  const club = [], reserve = [];
  for (const id in deck.cartes) for (let i = 0; i < deck.cartes[id]; i++) club.push(id);
  for (const k in deck.reserve) for (let i = 0; i < deck.reserve[k]; i++) reserve.push(k);
  return { club, reserve };
}

/* Les couleurs dont un Club a besoin : les symboles de couleur de ses
   attaques, comptés. */
function besoins(cartes) {
  const b = {};
  for (const id in cartes) {
    const c = Combat.carte(id);
    if (!c || c.cat !== 'joueur') continue;
    for (const a of c.atks) for (const k in a.cout) if (k !== 'neutre') b[k] = (b[k] || 0) + a.cout[k] * cartes[id];
    if (cleCopie(id) === 'c049') b.jaune = (b.jaune || 0) + 6 * cartes[id];
  }
  return b;
}

/* Une Réserve qui suit les besoins du Club, au prorata. */
function reserveAuto(cartes, defaut) {
  const b = besoins(cartes);
  const ks = Object.keys(b);
  if (!ks.length) return { [defaut || 'rose']: R.RESERVE };
  const t = ks.reduce((s, k) => s + b[k], 0);
  const r = {};
  let reste = R.RESERVE;
  ks.sort((x, y) => b[y] - b[x]).forEach((k, i) => {
    const n = i === ks.length - 1 ? reste : Math.max(1, Math.round(R.RESERVE * b[k] / t));
    r[k] = Math.min(n, reste);
    reste -= r[k];
  });
  for (const k in r) if (!r[k]) delete r[k];
  if (reste > 0) r[ks[0]] += reste;
  return r;
}

/* ---------- Les Starter Decks ---------- */
/* M8 vend deux Starter Decks : Section Toxique et Section Déter. Ceux d'ici
   sont reconstitués (leur liste réelle n'est pas connue) : la Section
   Toxique joue Rose — engager l'adversaire, des Joueurs qui frappent tôt —,
   la Section Déter joue Mauve — des Joueurs qui reviennent, des coups
   lourds. 40 cartes chacun, en suivant les conseils des règles officielles :
   au moins 15 Joueurs (18 ici), une couleur dans la Réserve, des attaques à
   une ou deux Essences. Chacun contient sa Promo. Ils sont prêtés : on peut
   les jouer sans en posséder les cartes.
   Mesuré le 31 octobre (3.0.12, IA niveau 3 des deux côtés, places
   alternées, 240 parties, graines 2000 + i) : contre des decks tirés au sort
   (Decks.aleatoire, niveau 3), le Toxique gagne 66 %, le Déter 48 % ; face
   à face, **le Toxique 69 %** (165 sur 240 ; 274 sur 400). Le Toxique
   engage les Joueurs adverses, qui ne peuvent alors plus défendre : avec
   les règles officielles, ses attaques passent sur le CEO. Ce déséquilibre
   est connu et ouvert (feuille de route, § 4) : les chiffres d'abord écrits
   ici (64 %, 58 %, 61 %) ne se retrouvent pas sur le même code, et aucune
   des variantes essayées ne le corrige — onze par la première passe (trois
   Fée Rosalie au lieu d'une, des Épiques, Cooked, Doig'Dance, un Toxique
   sans un Squeezie ni un Vandale…), quatre le 31 (un Déter à la courbe plus
   basse : 69 % ; un Toxique sans Tout Commence Ici : 70 % ; les deux :
   72 %). Version 3.0.13 : chacun a la vraie Promo de sa Section — P04
   (Squeezie le Toxique) prend une place de Squeezie, la place libérée va à
   un troisième Vandale ; P03 (Brawks Déter) remplace la Promo provisoire du
   Déter. Mêmes mesures, mêmes graines : le Toxique 68,8 % puis 69,2 % sur
   240 parties, 68,5 % avant comme après sur 400 (274). */
const STARTERS = {
  toxique: {
    id: 'starter-toxique', nom: 'Starter · Section Toxique', starter: true, couverture: 'c012',
    cartes: {
      p04: 1, c010: 3, c011: 3, c012: 2, c013: 2, c017: 1, c073: 2, c078: 2, c079: 1, c074: 1,
      c015: 3, c085: 2, c087: 2, c088: 1,
      c014: 2, c016: 2, c083: 2, c104: 1, c096: 2, c097: 2, c020: 1, c091: 1, c092: 1
    },
    reserve: { rose: 10 }
  },
  deter: {
    id: 'starter-deter', nom: 'Starter · Section Déter', starter: true, couverture: 'c077',
    cartes: {
      p03: 1, c051: 3, c052: 3, c050: 3, c077: 2, c074: 1, c076: 1, c080: 2, c081: 1, c059: 1,
      c053: 3, c087: 2, c088: 2, c056: 1,
      c054: 2, c055: 2, c083: 2, c082: 2, c092: 2, c093: 1, c072: 1, c094: 1, c095: 1
    },
    reserve: { mauve: 10 }
  }
};

/* ---------- Les decks de l'IA ---------- */
/* Un deck tiré au sort dans une ou deux couleurs, plus le Neutre. Le niveau
   (1 à 5) pèse sur les raretés : un adversaire facile joue des Communes, un
   adversaire Légende des Épiques et des Légendaires. */
const POIDS = {
  1: { C: 6, PC: 4, R: 1, E: 0.3, L: 0.1, S: 0, PR: 0.2 },
  2: { C: 4, PC: 4, R: 2, E: 0.8, L: 0.3, S: 0.1, PR: 0.3 },
  3: { C: 3, PC: 3, R: 3, E: 2, L: 0.8, S: 0.3, PR: 0.5 },
  4: { C: 2, PC: 3, R: 3, E: 3, L: 2, S: 0.8, PR: 0.8 },
  5: { C: 1, PC: 2, R: 3, E: 4, L: 4, S: 1.5, PR: 1 }
};
/* 40 cartes, en suivant les conseils des règles officielles (« un minimum
   de 15 Joueur ») : 18 Joueurs, 8 Objets, 14 Coachs et Moments. */
const CIBLES = { joueur: 18, objet: 8, instant: 14 };

function aleatoire(rand, o) {
  o = o || {};
  const niveau = Math.max(1, Math.min(5, o.niveau || 3));
  const couleurs = o.couleurs || tirerCouleurs(rand);
  const pool = Combat.toutes().filter(c => jouable(c) && !c.rev && !c.provisoire && !c.unique
    && (c.col === 'neutre' || couleurs.includes(c.col)) && !(o.exclure || []).includes(c.id));
  const cartes = {};
  const parCle = {};
  const ajouter = c => { cartes[c.id] = (cartes[c.id] || 0) + 1; parCle[cleCopie(c.id)] = (parCle[cleCopie(c.id)] || 0) + 1; };
  const place = c => (parCle[cleCopie(c.id)] || 0) < limite(c.id);
  const poids = c => {
    let w = (POIDS[niveau][c.rar] || 0.5);
    /* Les cartes de la couleur pèsent plus que les Neutres. */
    if (c.col !== 'neutre') w *= 1.6;
    return w;
  };
  const famille = c => (c.cat === 'joueur' ? 'joueur' : c.cat === 'objet' ? 'objet' : 'instant');
  for (const fam of ['joueur', 'objet', 'instant']) {
    let besoin = CIBLES[fam];
    const cands = pool.filter(c => famille(c) === fam);
    let garde = 0;
    while (besoin > 0 && garde++ < 400) {
      const dispo = cands.filter(place);
      if (!dispo.length) break;
      const tot = dispo.reduce((s, c) => s + poids(c), 0);
      let r = rand() * tot;
      let pick = dispo[dispo.length - 1];
      for (const c of dispo) { r -= poids(c); if (r <= 0) { pick = c; break; } }
      ajouter(pick);
      besoin--;
    }
  }
  /* Compléter avec n'importe quoi de jouable, si une couleur est trop
     courte. */
  let garde = 0;
  while (total(cartes) < R.CLUB && garde++ < 400) {
    const dispo = pool.filter(place);
    if (!dispo.length) break;
    ajouter(dispo[Math.floor(rand() * dispo.length)]);
  }
  const reserve = reserveAuto(cartes, couleurs[0]);
  return { id: 'ia', nom: o.nom || 'Deck adverse', cartes, reserve, couverture: couverture(cartes) };
}

/* Les couleurs qui ont assez de cartes pour faire un deck. */
const COULEURS_JOUABLES = ['rose', 'orange', 'violette', 'mauve', 'bleue', 'azur', 'verte'];
function tirerCouleurs(rand) {
  const a = COULEURS_JOUABLES[Math.floor(rand() * COULEURS_JOUABLES.length)];
  if (rand() < 0.45) {
    const reste = COULEURS_JOUABLES.filter(c => c !== a);
    return [a, reste[Math.floor(rand() * reste.length)]];
  }
  return [a];
}

/* La carte qu'on montre sur la boîte du deck : son meilleur Joueur. */
function couverture(cartes) {
  const rang = { S: 7, L: 6, E: 5, R: 4, PR: 4, PC: 3, C: 2 };
  let best = null;
  for (const id in cartes) {
    const c = Combat.carte(id);
    if (!c || c.cat !== 'joueur') continue;
    if (!best || (rang[c.rar] || 0) > (rang[best.rar] || 0)) best = c;
  }
  return best ? best.id : Object.keys(cartes)[0];
}

/* Un deck écrit en une ligne, pour le partager : « M8D1.c012x2.c013x1…|rose10 ». */
function encoder(deck) {
  const c = Object.keys(deck.cartes).filter(k => deck.cartes[k] > 0).sort().map(k => k + (deck.cartes[k] > 1 ? 'x' + deck.cartes[k] : '')).join('.');
  const r = Object.keys(deck.reserve).filter(k => deck.reserve[k] > 0).map(k => k + deck.reserve[k]).join('.');
  return 'M8D1.' + c + '|' + r;
}
function decoder(s) {
  const m = String(s || '').trim().match(/^M8D1\.([^|]*)\|(.*)$/);
  if (!m) return null;
  const cartes = {}, reserve = {};
  for (const p of m[1].split('.').filter(Boolean)) {
    const [id, n] = p.split('x');
    if (!Combat.carte(id)) return null;
    cartes[id] = (cartes[id] || 0) + (+n || 1);
  }
  for (const p of m[2].split('.').filter(Boolean)) {
    const k = p.replace(/\d+$/, ''), n = +p.slice(k.length) || 0;
    if (!Combat.COULEURS.includes(k)) return null;
    reserve[k] = n;
  }
  return { cartes, reserve };
}

/* ---------- Qu'est-ce qu'un bon deck ? ---------- */
/* Les trois « Conseils » des règles officielles (« Construire son jeu ») :
     - « Jouez un minimum de 15 Joueur dans votre Club pour être sûr de ne
       pas manquer » ;
     - « Il est préférable de ne jouer qu'une couleur ou deux dans votre
       Réserve et de construire votre Club autour de ces couleurs » : la
       Réserve accordée aux attaques ;
     - « jouez majoritairement des Joueur avec une attaque coûtant une
       Essence ou deux » : la moitié au moins (« majoritairement »).
   Ce ne sont pas des règles : un deck qui les rate peut gagner. */
const BON = { joueurs: 15, accord: 0.8, bas: 0.5 };

function bilan(deck) {
  const cartes = deck.cartes || {};
  let joueurs = 0, bas = 0;
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!c || !q || c.cat !== 'joueur') continue;
    joueurs += q;
    if (Math.min(...c.atks.map(a => Combat.totalCout(a.cout))) <= 2) bas += q;
  }
  /* L'accord de la Réserve : la part des symboles de couleur des attaques
     que la Réserve couvre, couleur par couleur, au prorata. */
  const b = besoins(cartes), r = deck.reserve || {};
  const tb = total(b), tr = total(r) || 1;
  const accord = tb ? Object.keys(b).reduce((s, k) => s + Math.min((r[k] || 0) / tr, b[k] / tb), 0) : 1;
  const reperes = [
    { cle: 'joueurs', ok: joueurs >= BON.joueurs, titre: `${BON.joueurs} Joueurs au moins`,
      dit: `${joueurs} Joueur${joueurs > 1 ? 's' : ''}.`,
      pourquoi: joueurs >= BON.joueurs ? 'De quoi remplir tes trois cases toute la partie.'
        : 'Les règles officielles conseillent ce minimum « pour être sûr de ne pas manquer ».' },
    { cle: 'reserve', ok: accord >= BON.accord, titre: 'Une Réserve accordée',
      dit: `Accord avec tes attaques : ${Math.round(100 * accord)} %.`,
      pourquoi: accord >= BON.accord ? 'Tes Essences paient tes attaques.'
        : 'Des Essences ne paient aucune de tes attaques et ne permettent pas de jouer tes cartes de couleur. « Régler d\'après mes attaques » la corrige.' },
    { cle: 'bas', ok: joueurs > 0 && bas / joueurs >= BON.bas, titre: 'Des attaques qui partent tôt',
      dit: `${bas} Joueur${bas > 1 ? 's' : ''} sur ${joueurs} attaque${bas > 1 ? 'nt' : ''} pour 1 ou 2 Essences.`,
      pourquoi: joueurs && bas / joueurs >= BON.bas ? 'Tu frappes dès les premiers tours.'
        : 'Une seule Essence arrive par tour. Les règles officielles conseillent « majoritairement » des attaques à une ou deux Essences.' }
  ];
  const note = reperes.filter(x => x.ok).length;
  const nom = note >= 3 ? 'Solide' : note >= 2 ? 'Jouable' : 'À revoir';
  return { reperes, note, sur: reperes.length, nom, joueurs, bas, accord };
}

/* ---------- Les clés d'un deck (3.0.15) ---------- */
/* Le propriétaire, le 2 novembre 2026, en retirant l'assistant de deck (« il
   ruine tout l'aspect création et plaisir de créer ») : « Compense ce manque
   par un meilleur feedback […] donner les meilleurs clés pour créer un bon
   deck, sans trop prendre par la main. Le joueur doit être aidé sans se
   sentir sur un rail. » Les clés disent ce que fait le deck, chiffres à
   l'appui, sans jamais dire quelle carte mettre : des chances de pioche
   exactes (loi hypergéométrique, sur le Club et la Réserve tels qu'ils
   sont), et un repère mesuré sur tout le catalogue (l'attaque médiane à deux
   Essences). Plus de « Compléter pour moi » : seule la Réserve se règle d'un
   geste (reserveAuto, « Régler d'après mes attaques »). */
const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
/* La chance d'avoir au moins une des `k` cartes en en tirant `t` d'une pile de `n`. */
const auMoins = (n, k, t) => (n <= 0 || k <= 0 || t <= 0) ? 0 : k >= n ? 1 : 1 - comb(n - k, Math.min(t, n)) / comb(n, Math.min(t, n));
/* Ce qu'on a vu de son Club à son 3e tour : la main de départ, puis une
   pioche à chaque entretien (« l'entretien pioche aussi pour le premier
   CEO »). */
const VUES_TOUR3 = R.MAIN + 3;
let repereCat = null;
function repereCatalogue() {
  if (repereCat) return repereCat;
  const v = [];
  for (const c of Object.values(Combat.toutes())) {
    if (!c || c.cat !== 'joueur' || c.cachee || Combat.baseId(c.id) !== c.id) continue;
    for (const a of c.atks) if (Combat.totalCout(a.cout) === 2 && a.degats != null) v.push(a.degats);
  }
  v.sort((x, y) => x - y);
  return (repereCat = { atk2: v.length ? v[Math.floor(v.length / 2)] : 120 });
}
const GARDIENS = ['Garde', 'Provocation', 'Shield'];

function cles(deck) {
  const cartes = deck.cartes || {}, res = deck.reserve || {};
  const N = total(cartes) || R.CLUB, NR = total(res) || R.RESERVE;
  const { atk2 } = repereCatalogue();
  let joueurs = 0, bas = 0, tiennent = 0, gardiens = 0, resil = 0;
  const copies = {}, colorees = {};
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!c || !q) continue;
    copies[cleCopie(id)] = (copies[cleCopie(id)] || 0) + q;
    if (c.res) resil += q;
    if (c.cat === 'joueur') {
      joueurs += q;
      if (Math.min(...c.atks.map(a => Combat.totalCout(a.cout))) <= 2) bas += q;
      if (c.def > atk2) tiennent += q;
      if (c.kw && GARDIENS.includes(c.kw.nom)) gardiens += q;
    } else if (c.col && c.col !== 'neutre') colorees[c.col] = (colorees[c.col] || 0) + q;
  }
  /* 1. Le départ : un Joueur qui attaque tôt dans la main de départ, puis
        avec le changement de main (une fois). */
  const p1 = auMoins(N, bas, R.MAIN), p2 = 1 - (1 - p1) * (1 - p1);
  /* 2. Les Essences : chaque couleur que demandent les attaques ou les
        cartes de couleur (« ne peuvent être jouées que si vous avez une
        Essence de la couleur correspondante déployée »), et quand la
        première arrive : une Essence par tour, dans l'ordre de la Réserve. */
  const b = besoins(cartes);
  const couleurs = [...new Set([...Object.keys(b), ...Object.keys(colorees)])]
    .sort((x, y) => ((b[y] || 0) + (colorees[y] || 0)) - ((b[x] || 0) + (colorees[x] || 0)))
    .map(k => {
      const e = +res[k] || 0;
      return { coul: k, e, sur: NR, attaques: b[k] || 0, cartes: colorees[k] || 0,
        tour2: auMoins(NR, e, 2), tour3: auMoins(NR, e, 3) };
    });
  const jamais = couleurs.filter(x => !x.e);
  /* 3. La régularité : combien de noms en 3, 2, 1 exemplaires, et la
        chance d'avoir vu une carte précise à son 3e tour. */
  const n = [0, 0, 0, 0];
  for (const k in copies) n[Math.min(3, copies[k])]++;
  return {
    depart: { bas, main: p1, avecChangement: p2, ok: p2 >= 0.85 },
    essences: { couleurs, jamais, ok: !jamais.length },
    regularite: { en3: n[3], en2: n[2], en1: n[1], vue3: auMoins(N, 3, VUES_TOUR3), vue1: auMoins(N, 1, VUES_TOUR3) },
    tenue: { joueurs, tiennent, atk2, gardiens },
    pv: { resil, auMoinsUne: auMoins(N, resil, R.PV), moyenne: R.PV * resil / N }
  };
}

/* COTES:debut — généré par tools/cotes-cartes.js (6000 parties), ne pas modifier à la main. */
const COTES = {
  c010: -0.018, c011: 0.034, c012: 0.027, c013: 0.031, c014: -0.003, c015: 0.025, c016: -0.016, c017: 0.017,
  c018: 0.028, c019: 0.012, c020: -0.019, c021: -0.001, c022: 0.027, c023: 0.002, c024: 0.013, c025: -0.018,
  c026: 0.001, c027: -0.032, c028: -0.009, c029: 0.017, c030: 0.01, c031: 0.003, c032: 0.027, c033: 0.016,
  c034: 0.006, c035: -0.023, c036: 0.03, c037: -0.01, c039: 0.054, c040: 0.068, c041: 0.072, c042: -0.023,
  c043: 0.01, c044: 0.006, c045: 0.008, c046: 0.005, c047: -0.012, c048: 0.017, c050: 0.01, c051: 0.003,
  c052: 0.029, c053: -0.009, c054: 0.012, c055: 0.01, c056: -0.006, c057: -0.029, c058: 0.027, c059: -0.013,
  c060: -0.037, c061: -0.083, c062: -0.022, c063: -0.022, c064: -0.017, c065: 0.011, c066: 0.009, c067: 0.011,
  c068: -0.027, c069: 0.011, c070: 0.037, c071: 0.035, c072: -0.026, c073: 0.002, c074: 0.017, c075: -0.019,
  c076: -0.014, c077: 0.004, c078: 0.001, c079: -0.001, c080: -0.02, c081: -0.027, c082: -0.007, c083: 0.034,
  c084: -0.004, c085: 0.01, c086: 0.001, c087: -0.001, c088: -0.001, c089: -0.009, c090: 0.004, c091: -0.014,
  c092: 0.003, c093: -0.022, c094: -0.013, c095: 0.012, c096: -0.019, c097: -0.005, c098: -0.009, c099: -0.008,
  c100: -0.009, c101: -0.004, c102: 0.019, c103: -0.011, c104: -0.006, c105: 0.007, c106: -0.007, c107: 0.006,
  c108: -0.008, c109: -0.034, c110: 0.001, c111: -0.018, c112: -0.029, c113: -0.053, c114: 0.047, c115: -0.014,
  c116: -0.042, c117: 0.033, c118: -0.015, c119: 0.019, c120: 0.023, c121: -0.023, c122: -0.01, c123: -0.017,
  c124: -0.004, c125: 0.005, c126: -0.033, c127: -0.018, p01: 0.001, p02: 0.026, p03: 0.004, p04: 0,
  p05: -0.004, p06: -0.015
};
/* COTES:fin */

/* ---------- La copie d'un Starter (3.0.14) ---------- */
/* Un Starter se joue prêté, mais ne se copie qu'avec ses propres cartes (le
   propriétaire, 1er novembre 2026). Chaque carte du Starter se prend dans la
   collection, toutes versions comprises — même nom, même couleur, comme la
   limite de trois exemplaires : celle que liste le Starter d'abord, puis la
   classique, la Reverse, la Promo. `possede` : id → exemplaires. Rend la
   copie (`cartes`), ou ce qui manque (`manque` : { nom, n }, `nManque`). */
function copieStarter(deck, possede) {
  possede = possede || {};
  const rang = id => ({ c: 0, r: 1, p: 2 }[id[0]] ?? 3);
  const versions = {};
  for (const id in possede) {
    if (!(possede[id] > 0) || !jouable(Combat.carte(id))) continue;
    (versions[cleCopie(id)] = versions[cleCopie(id)] || []).push(id);
  }
  const besoin = {}, prefere = {};
  for (const id in deck.cartes || {}) {
    const k = cleCopie(id);
    besoin[k] = (besoin[k] || 0) + (+deck.cartes[id] || 0);
    (prefere[k] = prefere[k] || []).push(id);
  }
  const cartes = {}, manque = [];
  const prendre = (id, n) => { if (n > 0) cartes[id] = (cartes[id] || 0) + n; return Math.max(0, n); };
  for (const k in besoin) {
    let reste = besoin[k];
    /* D'abord chaque carte que liste le Starter, à sa quantité… */
    for (const id of prefere[k]) reste -= prendre(id, Math.min(+deck.cartes[id] || 0, possede[id] || 0, reste));
    /* …puis ce qui reste de chaque version possédée. */
    const l = (versions[k] || []).slice().sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : 1));
    for (const id of l) {
      if (!reste) break;
      reste -= prendre(id, Math.min(reste, possede[id] - (cartes[id] || 0)));
    }
    if (reste) manque.push({ nom: Combat.carte(prefere[k][0]).nom, n: reste });
  }
  const nManque = manque.reduce((s, x) => s + x.n, 0);
  return { ok: !nManque, cartes: nManque ? null : cartes, manque, nManque };
}

const Decks = { cleCopie, limite, jouable, verifier, versMoteur, besoins, reserveAuto, STARTERS, copieStarter, aleatoire, tirerCouleurs, couverture, encoder, decoder, total, bilan, BON, CIBLES,
  cles, auMoins, COTES };
if (typeof module !== 'undefined' && module.exports) module.exports = Decks;
racine.Decks = Decks;

})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- js/combat/ia.js
/* L'IA des combats (version 3.0).

   Elle joue avec les mêmes actions que le joueur, et n'en sait pas plus que
   lui : quand elle essaie un coup, elle le joue sur une copie de la partie
   où ce qu'elle ne peut pas voir — la main et le Club adverses, ses propres
   PV et la suite de son Club — a été remélangé. Elle ne triche donc pas sur
   la carte qu'elle va piocher, ni sur ce que l'adversaire tient en main.

   Cinq niveaux. Aucun ne joue au hasard : un adversaire qui finit son tour
   avec une attaque gagnante sous la main n'apprend rien à personne. Ce qui
   change d'un niveau à l'autre, c'est ce qu'il voit :
     1 Débutant   des règles simples : il déploie, il frappe ce qui tombe ;
                  il ne joue pas ses Moments et ne défend que s'il tient ;
     2 Facile     essaie ses coups sur une copie, mais juge mal (beaucoup
                  d'imprécision) et ne pense pas à la riposte ;
     3 Normal     essaie ses coups, juge à peu près, se méfie un peu ;
     4 Difficile  juge juste, et se méfie de la riposte ;
     5 Légende    pareil, en regardant aussi la réponse adverse la plus
                  probable. Le niveau de son deck fait le reste
                  (js/combat/decks.js). */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const O = Combat.O;
const adv = O.adv;

/* ---------- Ce que vaut une carte ---------- */
function meilleureAttaque(c) {
  return Math.max(0, ...c.atks.map(a => (a.degats == null ? 40 : a.degats)));
}
const BONUS_MC = { provocation: 12, garde: 14, shield: 18, riposte: 14, legion: 12, buff: 18, signature: 10 };
function valeurCarte(id) {
  const c = Combat.carte(id);
  if (!c) return 0;
  if (c.cat === 'joueur') {
    const kw = c.kw ? (BONUS_MC[O.sansAccent(c.kw.nom)] || 8) : 0;
    return 20 + c.def / 5 + meilleureAttaque(c) / 4 + kw;
  }
  if (c.cat === 'objet') return 26;
  if (c.cat === 'coach') return 24;
  return 20;
}

/* Un Joueur sur le plateau. */
function valeurJoueur(E, c) {
  const k = Combat.carte(c.id);
  let v = 30 + Combat.defense(E, c) / 4;
  let best = 0;
  k.atks.forEach((a, i) => { const x = Combat.valeurAttaque(E, c, i); best = Math.max(best, x == null ? 50 : x); });
  v += best / 3.5;
  for (const m of ['Provocation', 'Garde', 'Riposte', 'Légion', 'Buff']) if (Combat.aMotCle(E, c, m)) v += BONUS_MC[O.sansAccent(m)];
  if (Combat.shieldActif(E, c)) v += 18;
  v += 8 * c.obj.length;
  return v;
}

/* ---------- Évaluer une position ---------- */
/* Le point de vue du CEO `j`. Les PV comptent le plus ; puis le plateau, la
   main, les Essences ; enfin ce que l'adversaire peut faire au prochain tour
   (la « menace »). */
function evaluer(E, j, o) {
  o = o || {};
  if (E.fin) return E.fin.gagnant === j ? 1e6 : -1e6;
  const moi = E.j[j], lui = E.j[adv(j)];
  const pv = n => 110 * n + (n === 0 ? -120 : 0) + (n === 1 ? -40 : 0);
  let s = pv(moi.pv.length) - pv(lui.pv.length);
  /* La main ne compte que jusqu'à 5 : au-delà, la fin du tour défausse. */
  s += 14 * Math.min(moi.main.length, 5) - 14 * Math.min(lui.main.length, 5);
  s += 9 * moi.ess.length - 9 * lui.ess.length;
  for (const c of O.joueursDe(E, j)) s += valeurJoueur(E, c);
  for (const c of O.joueursDe(E, adv(j))) s -= valeurJoueur(E, c);
  if (o.menace) {
    /* Qui attaquera au prochain coup ? Si c'est encore le tour de `j`,
       c'est l'adversaire après lui ; sinon l'adversaire, maintenant. */
    s -= menace(E, adv(j), j) * o.menace;
    if (E.actif !== j) s += 0; /* la menace de j se mesurera à son tour */
  }
  return s;
}

/* Ce que l'attaquant `a` peut probablement infliger au défenseur `d` à son
   prochain tour (règles officielles : on n'attaque que le CEO, et chaque
   Joueur désengagé du défenseur peut bloquer une attaque) : des PV, et des
   bloqueurs vaincus. */
function menace(E, a, d) {
  const att = O.joueursDe(E, a);
  if (!att.length) return 0;
  const essences = E.j[a].ess.length + (E.actif === a ? 0 : (E.j[a].reserve.length ? 1 : 0));
  const valeurs = att.map(c => {
    let best = 0;
    Combat.carte(c.id).atks.forEach((x, k) => {
      if (x.degats == null) return;
      if (O.REGLE && Combat.totalCout(x.cout) > essences) return;
      best = Math.max(best, Combat.valeurAttaque(E, c, k) || 0);
    });
    return best;
  }).filter(v => v > 0).sort((x, y) => y - x);
  if (!valeurs.length) return 0;
  let m = 0;
  /* Chaque bloqueur prend une attaque (les plus fortes d'abord) ; s'il ne la
     tient pas, il est vaincu. */
  const dispo = valeurs.slice();
  const bloqueurs = O.joueursDe(E, d).filter(c => !c.eng).sort((x, y) => Combat.defense(E, y) - Combat.defense(E, x));
  for (const b of bloqueurs) {
    if (!dispo.length) break;
    const v = dispo.shift();
    if (v >= Combat.defense(E, b) && !Combat.shieldActif(E, b)) m += 0.5 * valeurJoueur(E, b);
  }
  /* Le CEO : les attaques que personne ne bloque. */
  const passent = dispo.length;
  m += passent * 70;
  if (E.j[d].pv.length === 0 && passent > 0) m += 400;
  return m;
}

/* ---------- Les choix rapides ---------- */
/* Des règles simples : pour les niveaux bas, et pour finir les coups qu'on
   essaie sur une copie. */
function rapide(E, d, r, simple) {
  const j = d.qui;
  if (d.type === 'tour') return tourRapide(E, j, r, simple);
  if (d.type === 'choix') return { t: 'choix', v: choixRapide(E, d, j, simple) };
  if (d.type === 'cartes') return { t: 'cartes', u: cartesRapide(E, d, j) };
  if (d.type === 'ordre') return { t: 'ordre', u: ordreRapide(E, d) };
  throw new Error('demande inconnue');
}

function tourRapide(E, j, r, simple) {
  const opts = Combat.optionsTour(E);
  const P = E.j[j];
  const par = t => opts.filter(o => o.t === t);
  /* Déployer le meilleur Joueur, sur la ligne la plus utile. Remplacer un
     Joueur (le Terrain plein) seulement si le nouveau vaut nettement mieux. */
  const dep = par('deployer').filter(o => !o.remplace || scoreDeploiement(E, j, o) > 0);
  if (dep.length) {
    const best = dep.slice().sort((a, b) => scoreDeploiement(E, j, b) - scoreDeploiement(E, j, a))[0];
    return best;
  }
  /* Lier un Objet au Joueur qui en profite le plus. */
  const lie = par('lier');
  if (lie.length) {
    return lie.slice().sort((a, b) => scoreLien(E, b) - scoreLien(E, a))[0];
  }
  /* Les Instants qui piochent ou renforcent, avant d'attaquer (pas au
     niveau Débutant : il ne lit pas encore ses Moments). */
  const jo = simple ? [] : par('jouer').filter(o => instantUtile(E, j, o));
  if (jo.length) return jo[0];
  /* Attaquer : abattre ce qui tombe, sinon le CEO. Une attaque qui ne fait
     rien (un Joueur qu'elle n'abat pas, un CEO qu'un défenseur protège)
     engage l'attaquant pour rien : elle l'expose à la riposte. */
  const at = par('attaquer');
  if (at.length) {
    const best = at.slice().sort((a, b) => scoreAttaque(E, j, b) - scoreAttaque(E, j, a))[0];
    if (scoreAttaque(E, j, best) > 20) return best;
  }
  return opts.find(o => o.t === 'finTour') || opts[0];
}

function scoreDeploiement(E, j, o) {
  const c = E.j[j].main.find(x => x.u === o.u);
  let s = valeurCarte(c.id);
  if (o.remplace) {
    const v = O.trouverSurPlateau(E, o.remplace);
    return v ? s - valeurJoueur(E, v) - 25 : -1;
  }
  const face = E.j[adv(j)].lignes[o.ligne];
  /* Face à un Joueur adverse : on le tient. Face au vide : on frappe. */
  if (face) s += Combat.carte(c.id).def >= 100 ? 4 : -2;
  return s + o.ligne * 0.01;
}
function scoreLien(E, o) {
  const c = O.trouverSurPlateau(E, o.cible);
  return valeurJoueur(E, c) - 10 * c.obj.length + (c.eng ? -5 : 0);
}
const INSTANTS_SURS = ['c083', 'c082', 'c107', 'c114', 'c095', 'c031', 'c037', 'c099', 'c014', 'c027', 'c028', 'c016', 'c097', 'c018', 'c026', 'c092', 'c033', 'c020', 'c061', 'c054', 'c104', 'c098', 'c103', 'c115', 'c066', 'c038', 'p01'];
function instantUtile(E, j, o) {
  const c = E.j[j].main.find(x => x.u === o.u);
  return INSTANTS_SURS.includes(Combat.baseId(c.id));
}
function scoreAttaque(E, j, o) {
  const c = O.trouverSurPlateau(E, o.u);
  const a = Combat.carte(c.id).atks[o.k];
  if (a.degats == null) return 30;
  const val = Combat.valeurAttaque(E, c, o.k);
  if (o.cible === 'ceo') {
    /* Un défenseur en face qui tient l'attaque : peu d'intérêt. */
    const defs = Combat.defenseurs(E, c, 'ceo');
    const tient = defs.some(d => Combat.defense(E, d) > val);
    return tient ? 15 : 60;
  }
  const t = O.trouverSurPlateau(E, o.cible);
  if (!t) return 0;
  if (Combat.shieldActif(E, t)) return 5;
  return val >= Combat.defense(E, t) ? 40 + valeurJoueur(E, t) : 2;
}

function choixRapide(E, d, j, simple) {
  const ops = d.options.map(o => o.v);
  const non = ops.includes('non') ? 'non' : ops[ops.length - 1];
  switch (d.but) {
    case 'mulligan':
      return E.j[j].main.some(c => O.estCat(c, 'joueur')) ? 'oui' : 'non';
    case 'defense': {
      /* Défendre si le défenseur tient, ou si le CEO n'a plus de marge. */
      const bons = d.options.filter(o => o.info && !o.info.vaincu);
      if (bons.length) return bons.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, a.v)) - valeurJoueur(E, O.trouverSurPlateau(E, b.v)))[0].v;
      if (d.cible === 'ceo' && E.j[j].pv.length <= 1 && !simple) {
        const tous = d.options.filter(o => o.v !== 'non');
        if (tous.length) return tous.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, a.v)) - valeurJoueur(E, O.trouverSurPlateau(E, b.v)))[0].v;
      }
      return 'non';
    }
    case 'soutien': {
      /* Un soutien qui fait tomber le défenseur, le moins cher ; sinon rien. */
      const ok = d.options.filter(o => o.info && o.info.vaincu).sort((a, b) => a.info.val - b.info.val);
      return ok.length ? ok[0].v : non;
    }
    case 'resilience': return 'oui';
    case 'legion': return E.j[j].main.length ? 'oui' : 'non';
    case 'riposte': {
      const ok = d.options.filter(o => o.info && o.info.val >= o.info.def);
      return ok.length ? ok[0].v : non;
    }
    case 'choixAdverse': return E.j[j].main.length >= 4 ? 'b' : 'a';
    case 'ravitaillement': return 'oui';
    case 'instalock': case 'monster': return 'oui';
    case 'enSlip': return 'oui';
    case 'trahison': return 'non';
    case 'maillotMaudit': return 'oui';
    case 'major': return ops[0];
    case 'engagerAdverse': case 'bancerAdverse': case 'renvoyerAdverse': case 'bloquerAdverse': case 'affaiblirAdverse': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, b.v) || { id: b.id, obj: [] }) - valeurJoueur(E, O.trouverSurPlateau(E, a.v) || { id: a.id, obj: [] }))[0].v;
    }
    case 'buffDef': case 'desengagerAllie': case 'lierAllie': case 'garderJoueur': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, b.v)) - valeurJoueur(E, O.trouverSurPlateau(E, a.v)))[0].v;
    }
    case 'bancerAllie': return d.options.find(o => o.v !== 'non') ? (d.options.find(o => o.v === 'non') ? 'non' : d.options[0].v) : non;
    case 'echangerPlace': return 'non';
    case 'ajouterMain': case 'objetMain': case 'deployer': case 'ombre': case 'lierDepuis': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurCarte(b.id) - valeurCarte(a.id))[0].v;
    }
    case 'objetSurClub': return non;
    case 'pvSortir': {
      /* Sortir de ses PV la carte la plus utile. */
      return d.options.slice().sort((a, b) => valeurCarte(b.id) - valeurCarte(a.id))[0].v;
    }
    case 'pvEntrer': {
      /* Y mettre une carte dont la Résilience sert, sinon la moins utile. */
      const cs = d.options.slice();
      const res = cs.filter(o => Combat.carte(o.id).res);
      if (res.length) return res[0].v;
      return cs.sort((a, b) => valeurCarte(a.id) - valeurCarte(b.id))[0].v;
    }
    case 'essenceAdverse': case 'bancerObjetAdverse': case 'renvoyerObjet': case 'renvoyerObjets': case 'recycler':
      return ops[0];
    default:
      return ops[0];
  }
}

function cartesRapide(E, d, j) {
  const val = u => {
    const c = E.j[j].main.find(x => x.u === u) || O.trouverSurPlateau(E, u);
    if (c && c.id) return O.trouverSurPlateau(E, u) && O.enJeu(E, c) ? valeurJoueur(E, c) : valeurCarte(c.id);
    const k = (d.cartes || []).find(x => x.u === u);
    return k ? valeurCarte(k.id) : 0;
  };
  const tri = d.parmi.slice().sort((a, b) => val(a) - val(b));
  switch (d.but) {
    case 'defausse': case 'defausseFin': case 'engagerAllies': return tri.slice(0, d.min);
    case 'm4': return [];
    case 'dessous': return [];
    case 'lierDepuis': case 'buffDef': case 'recycler': return tri.reverse().slice(0, Math.max(d.min, Math.min(d.max, 2)));
    default: return tri.reverse().slice(0, d.min);
  }
}

function ordreRapide(E, d) {
  return d.parmi.slice().sort((a, b) => {
    const ca = d.cartes.find(x => x.u === a), cb = d.cartes.find(x => x.u === b);
    return valeurCarte(cb.id) - valeurCarte(ca.id);
  });
}

/* ---------- Essayer un coup ---------- */
/* Remélanger ce que `j` ne peut pas voir, dans une copie de la partie. */
function brouiller(C, j, r) {
  const m = C.j[j], l = C.j[adv(j)];
  /* La main adverse et son Club se mélangent ensemble : on sait combien il
     tient de cartes, pas lesquelles. */
  const cache = l.main.concat(l.club);
  melangerAvec(cache, r);
  l.main = cache.slice(0, l.main.length);
  l.club = cache.slice(l.main.length);
  /* Ses PV, et ceux de l'adversaire, ne se connaissent pas. */
  const a = m.pv.concat(m.club);
  if (!m.pvVus) { melangerAvec(a, r); m.pv = a.slice(0, m.pv.length); m.club = a.slice(m.pv.length); }
  else melangerAvec(m.club, r);
  if (!l.pvVus) {
    const b = l.pv.concat(l.club);
    melangerAvec(b, r);
    l.pv = b.slice(0, l.pv.length);
    l.club = b.slice(l.pv.length);
  }
  melangerAvec(m.reserve, r);
  melangerAvec(l.reserve, r);
}
function melangerAvec(l, r) {
  for (let i = l.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [l[i], l[k]] = [l[k], l[i]];
  }
}

/* Jouer `a` sur une copie, puis laisser filer la partie avec les choix
   rapides jusqu'à la fin du tour en cours : un Zacking Buff ne vaut que par
   les attaques qui le suivent. On juge la position au début du tour
   suivant — les effets « jusqu'à la fin du tour » se sont éteints. Au
   niveau 5, on laisse aussi l'adversaire jouer son tour. */
function essayer(E, j, a, r, o) {
  const C = Combat.cloner(E);
  brouiller(C, j, r);
  try {
    Combat.agir(C, a, { confiance: true });
  } catch (e) {
    return -1e9;
  }
  const tourDepart = E.tour;
  const fin = o.reponse ? tourDepart + 2 : tourDepart + 1;
  let garde = 0;
  while (Combat.demande(C) && garde++ < 300) {
    const d = Combat.demande(C);
    if (d.type === 'tour' && C.tour >= fin) break;
    Combat.agir(C, rapide(C, d, r), { confiance: true });
  }
  return evaluer(C, j, { menace: o.reponse ? 0 : o.menace });
}

/* ---------- Choisir ---------- */
const NIVEAUX = {
  1: { essai: false, simple: true, menace: 0 },
  2: { essai: true, menace: 0, bruit: 90, essais: 1 },
  3: { essai: true, menace: 0.6, bruit: 12 },
  4: { essai: true, menace: 1, bruit: 0, essais: 3 },
  5: { essai: true, menace: 1, bruit: 0, essais: 4, reponse: true }
};
/* Mesuré (IA contre IA, mêmes decks, places échangées ; docs/economie-3.0.md,
   partie 3 bis) : le Débutant et le Facile d'aujourd'hui battent ceux d'avant
   (qui jouaient au hasard) 84 et 88 fois sur 100 ; le Normal, 63 fois sur
   100. Le niveau au-dessus gagne 86 %, 54 %, 56 % et 68 % des parties : entre
   2, 3 et 4 l'écart est court, et tient surtout au nombre d'essais par coup
   — la méfiance envers la riposte ne change rien de mesurable. La
   difficulté vient aussi du deck adverse (Decks.aleatoire). */

function graineDe(E) {
  return (E.rng ^ (E.journal.length * 2654435761)) >>> 0;
}
function aleaDe(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choisir(E, o) {
  o = o || {};
  /* `reglages` : pour les bancs d'essai (tools/), on remplace une valeur du
     niveau sans toucher au reste. */
  const N = Object.assign({}, NIVEAUX[o.niveau || 3] || NIVEAUX[3], o.reglages || {});
  const d = Combat.demande(E);
  if (!d) return null;
  const j = d.qui;
  const r = aleaDe(graineDe(E) ^ (o.sel || 0));

  if (!N.essai || d.type === 'cartes' || d.type === 'ordre') return rapide(E, d, r, N.simple);

  let cands;
  if (d.type === 'tour') cands = candidatsTour(E, j);
  else cands = d.options.map(x => ({ t: 'choix', v: x.v }));
  if (cands.length === 1) return cands[0];

  /* Combien d'essais par coup : plus il y a de hasard dans la suite, plus il
     en faut ; on reste raisonnable pour un téléphone. */
  const n0 = N.essais || 2;
  const essais = o.essais || (cands.length > 18 ? Math.max(1, n0 - 1) : n0);
  const base = evaluer(E, j, { menace: N.menace });
  let best = null, bestS = -Infinity;
  for (const a of cands) {
    let s = 0;
    for (let i = 0; i < essais; i++) s += essayer(E, j, a, r, N);
    s /= essais;
    if (N.bruit) s += (r() - 0.5) * N.bruit;
    a._s = s;
    if (s > bestS) { bestS = s; best = a; }
  }
  /* Développer avant d'attaquer : la phase de jeu se ferme à la première
     attaque. Une action de jeu qui rapporte passe avant. */
  if (d.type === 'tour' && E.phase === 'jeu' && best.t === 'attaquer') {
    const dev = cands.filter(a => a.t === 'deployer' || a.t === 'lier' || a.t === 'jouer');
    const bonDev = dev.filter(a => a._s > base + 4).sort((x, y) => y._s - x._s)[0];
    if (bonDev) best = bonDev;
  }
  cands.forEach(a => { delete a._s; });
  return best;
}

/* Les coups à essayer : tous, sauf les déploiements en double (la même
   carte sur deux lignes vides équivalentes). */
function candidatsTour(E, j) {
  const opts = Combat.optionsTour(E);
  const vus = new Set();
  const A = E.j[adv(j)];
  return opts.filter(o => {
    if (o.t !== 'deployer') return true;
    const face = A.lignes[o.ligne];
    const k = o.u + ':' + (face ? face.u : 'vide');
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}

const IA = { choisir, evaluer, rapide, valeurCarte, valeurJoueur, menace, NIVEAUX };
if (typeof module !== 'undefined' && module.exports) module.exports = IA;
racine.IA = IA;

})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- js/combat/campagne.js
/* La campagne et les Sections (version 3.0).

   M8 vend deux Starter Decks : Section Toxique et Section Déter. En entrant
   dans les Combats, chacun choisit sa Section, en reçoit la Promo et le
   Starter Deck, puis affronte la Section adverse : vingt combats en quatre
   actes, de plus en plus durs. La finir donne la Promo de l'autre Section.

   Les récompenses sont ici pour l'affichage ; c'est le serveur qui les
   accorde (combat_fin, supabase/installation/23_combats.sql), d'après la même table. Les
   decks adverses sont tirés au sort avec une graine fixe par combat : le
   même combat garde le même adversaire, d'une partie à l'autre. */
"use strict";

const SECTIONS = {
  toxique: {
    id: 'toxique', nom: 'Section Toxique', court: 'Toxique', c: '#62d84e', c2: '#b7f29a',
    promo: 'p04', starter: 'toxique', boite: 'assets/combat/sections/toxique.webp',
    /* Les couleurs de ses adversaires de campagne, quand on affronte cette
       Section. */
    couleurs: ['rose', 'orange', 'verte', 'jaune']
  },
  deter: {
    id: 'deter', nom: 'Section Déter', court: 'Déter', c: '#7c3aed', c2: '#c4b5fd',
    promo: 'p03', starter: 'deter', boite: 'assets/combat/sections/deter.webp',
    couleurs: ['mauve', 'violette', 'bleue', 'azur']
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
/* Les boss d'acte ont un PV de plus que les règles officielles (4), ou une
   Essence d'avance. */
const REGLES_CAMPAGNE = { 4: { pv: 5 }, 9: { pv: 5 }, 14: { ess: 1 }, 19: { pv: 5, ess: 1 } };
const RECOMPENSES_CAMPAGNE = [
  { eclats: 80 }, { eclats: 80 }, { eclats: 100 }, { eclats: 100 }, { eclats: 150, boosters: 2, fragments: 300 },
  { eclats: 120 }, { eclats: 120 }, { eclats: 140 }, { eclats: 140 }, { eclats: 200, boosters: 3, fragments: 500 },
  { eclats: 160 }, { eclats: 160 }, { eclats: 180 }, { eclats: 180 }, { eclats: 250, boosters: 4, fragments: 800 },
  { eclats: 200 }, { eclats: 200 }, { eclats: 220 }, { eclats: 220 }, { eclats: 400, boosters: 5, fragments: 1200 }
];
/* Rejouer un combat déjà gagné : pour le plaisir, et un peu d'Éclats —
   dans la limite des victoires récompensées du jour (PVE_PLAFOND). */
const RECOMPENSE_REJOUER = { eclats: 10 };

/* L'Arcade (l'ancien « PvE infini » ; mode 'infini' côté serveur) : la
   difficulté choisie, ce que rapporte une victoire.
   Au plus PVE_PLAFOND victoires récompensées par jour, tous modes PvE
   confondus (campagne rejouée comprise). Valeurs rééquilibrées pour la 3.0
   (docs/economie-3.0.md) : cinq victoires en Normal rapportent 125 Éclats,
   en Légende 250 — de quoi compter, sans doubler les revenus d'un joueur. */
const PVE_PLAFOND = 5;
const DIFFICULTES = [
  { niveau: 1, nom: 'Débutant', eclats: 10, texte: 'Des règles simples : elle déploie et frappe ce qui tombe, sans Moments.' },
  { niveau: 2, nom: 'Facile', eclats: 15, texte: 'Elle essaie ses coups, mais se trompe souvent.' },
  { niveau: 3, nom: 'Normal', eclats: 25, texte: 'Elle essaie ses coups et se méfie un peu.' },
  { niveau: 4, nom: 'Difficile', eclats: 35, texte: 'Elle calcule juste, et se méfie de ta riposte.' },
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

// ---- js/combat/choc-data.js
/* Le Raid, et l'événement de la version 3.0, « Le Choc des Sections ».

   Le Raid (RAID) : un boss commun à tout le serveur, pour deux semaines —
   un « raid » (une « saison » en base : raid_saisons…). Depuis la version
   3.0.11, ils se comptent depuis le premier jour du Choc des Sections : le
   raid 1 (The French Sorcerer) commence avec lui, le raid 2 (Le
   Marionnettiste) quatorze jours plus tard — depuis la 3.0.13, le
   lendemain de la fin du Choc, qui dure deux semaines —, puis les deux
   boss alternent. La page ne nomme pas un boss avant son arrivée. Avant, ils se comptaient depuis
   le 12 octobre 2026 : le premier raid du Choc s'appelait « saison 2 ».
   Chaque raid, le boss a six phases : chaque PV que les joueurs lui
   prennent en combat s'ajoute aux dégâts de tout le serveur, et chaque
   palier de dégâts atteint abat une phase — tous ceux qui ont combattu dans
   le raid ouvrent alors son coffre commun. En plus, des paliers personnels
   (les dégâts de chacun). Une fois les six phases abattues (si le serveur y
   arrive), le mode Infini : un palier par joueur, qui monte à chaque
   victoire, pour le classement. Trois tentatives par jour. Au raid suivant,
   tout recommence. Pendant le Choc, il paie en Étincelles ; sinon, en Éclats.

   L'événement (CHOC) ajoute l'Épreuve du jour : le même combat pour tout le
   monde — les mêmes deux decks imposés, la même donne, une règle du jour.
   Trois essais, le meilleur compte, et un classement du jour. Une Épreuve
   par jour de l'événement, numérotée de 1 à 14 (de 1 à 21 de la 3.0.11 à la
   3.0.12, quand le Choc durait trois semaines), et un calendrier des règles
   sur les deux semaines (CHOC.epreuve.calendrier).

   Ce fichier est lu par la page et par le serveur de démo
   (_demo/serveur.js). Le serveur réel en a la copie dans
   supabase/installation/25_choc.sql et 27_raid.sql : ils doivent rester d'accord. */
"use strict";

const RAID = {
  /* Les boss, un par raid, à tour de rôle (raid_boss, 27_raid.sql) :
     - The French Sorcerer (#116), Légendaire Mauve : ses éclairs bench les
       Joueurs (à la défausse) et frappent à 200 ;
     - Le Marionnettiste (#121, version 3.0.11), Légendaire Neutre : il tire
       les ficelles (Coup de fil, 160) et riposte quand il tombe.
     `couleur` : celle du boss dans son deck (une seconde change chaque
     jour ; un boss Neutre en prend deux) ; `visage` : le point de
     l'illustration gardé au centre (illuCadre) ; `cadre` et `tapis` : ce
     qu'il porte en combat (le tapis d'un boss : TAPIS ou TAPIS_BOSS,
     js/combat/table.js) ; `ajuste` : ce qu'il a en combat de plus ou de
     moins que la phase ; `vie` : ses seuils de phase, multipliés. */
  bosses: [
    { id: 'c116', nom: 'The French Sorcerer', couleur: 'mauve', visage: [.46, .24], cadre: 'f_foudre', tapis: 't_orage',
      dit: 'Ses éclairs envoient tes Joueurs à la défausse et frappent à 200.',
      /* Règles officielles (3.0.12) : le joueur n'a plus que 4 PV (5 avant),
         et le Sorcier, aux chiffres de la phase, devenait trop dur : 43 %,
         10 % et 6 % des combats des phases 1, 3 et 5 gagnés (un Starter,
         IA niveau 3, 80 combats par case ; 53 %, 26 % et 8 % avant). Avec
         un PV et une Essence d'avance de moins, comme le Marionnettiste :
         65 %, 30 % et 15 % (phases 2, 4 et 6 : 51 %, 40 %, 4 %). Les
         Essences seules (un PV de moins, non) laissaient la phase 3 à 10 %. */
      ajuste: { pv: -1, ess: -1 }, vie: 1 },
    { id: 'c121', nom: 'Le Marionnettiste', couleur: 'neutre', visage: [.45, .58], cadre: 'f_nebuleuse', tapis: 't_ficelles',
      dit: 'Il joue les couleurs des autres, deux nouvelles chaque jour, frappe à 160, et riposte quand il tombe.',
      /* À phases égales, il est plus dur que le Sorcier : son attaque ne
         demande que trois Essences de n'importe quelle couleur, il frappe
         plus tôt. Mesuré (un Starter contre chaque boss, IA niveau 3, 80
         combats par case) : le joueur gagnait 35 %, 5 % et 0 % des combats
         des phases 1, 3 et 5, contre 53 %, 26 % et 8 % face au Sorcier. Avec
         un PV et une Essence d'avance de moins que la phase : 63 %, 29 %,
         8 %, et des dégâts comptés par le serveur équivalents (une victoire
         y vaut les PV de la phase + 4, comme contre le Sorcier). Une IA plus
         douce rendait la phase 1 trop facile (68 %) sans sauver la 5 (3 %).
         Avec les règles officielles (3.0.12), le même réglage : 66 %, 33 %,
         26 %, 25 %, 8 % et 3 % des phases 1 à 6. raidCombat(cle, boss).
         `vie` (version 3.0.14) : ses seuils de phase, multipliés. Mesuré
         (tools/equilibre-raid.js, 100 combats par phase et par profil), un
         joueur lui prend 6,4, 6,2, 5,7, 5,4, 4,4 et 3,3 dégâts par tentative
         des phases 1 à 6, contre 6,9, 6,9, 6,1, 7,0, 6,4 et 4,0 au Sorcier :
         il reste plus dur à chaque combat, mais avec 80 % de sa vie, le
         serveur l'abat au même rythme (la sixième phase, le dernier jour,
         une saison sur deux pour une dizaine de joueurs actifs). */
      ajuste: { pv: -1, ess: -1 }, vie: 0.8 }
  ],
  /* Le premier boss (avant la 3.0.11, le seul). */
  boss: 'c116',
  nom: 'The French Sorcerer',
  tentatives: 3,
  /* Un raid dure `jours` jours. Le premier commence le jour où commence le
     Choc des Sections (raid_ancre, 27_raid.sql) ; sans Choc, le lundi
     `depart`. */
  saison: { jours: 14, depart: '2026-10-12' },
  /* Les six phases. `seuil` : les dégâts cumulés de tout le serveur dans la
     saison pour l'abattre — calculés pour une dizaine de joueurs actifs
     (version 3.0.14, tools/equilibre-raid.js), multipliés par la vie du
     boss (`vie` plus haut) et, sur le vrai serveur, par
     parametres.raid_echelle. Puis le combat (le niveau de l'adversaire, les
     PV du boss, ses Essences d'avance) et le coffre commun. Le dernier est
     l'exploit (le propriétaire, 1er novembre 2026 : « finir la dernière
     phase doit être ressenti comme un vrai exploit ») : une Légendaire qui
     manque, et un titre qu'on ne gagne que là (`bonus`). */
  phases: [
    { seuil: 100, ia: 2, pv: 5, ess: 0, commun: { type: 'boosters', montant: 2, titre: '2 boosters' } },
    { seuil: 250, ia: 3, pv: 6, ess: 0, commun: { type: 'fragments', montant: 300, titre: '300 Fragments' } },
    { seuil: 450, ia: 3, pv: 7, ess: 1, commun: { type: 'boosters', montant: 3, titre: '3 boosters' } },
    { seuil: 700, ia: 4, pv: 7, ess: 1, commun: { type: 'eclats', montant: 500, titre: '500 Éclats' } },
    { seuil: 1000, ia: 4, pv: 8, ess: 2, commun: { type: 'boosters', montant: 5, titre: '5 boosters' } },
    { seuil: 1400, ia: 5, pv: 9, ess: 2, commun: { type: 'legendaire', montant: 1, titre: 'Une Légendaire',
      bonus: { type: 'titre', montant: 1, objet: 't_heros_raid', titre: 'le titre « Héros du Raid »', court: '+ un titre' } } }
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
    return { ia: 5, pvBoss: Math.min(12, 9 + k), ess: Math.min(3, 2 + Math.floor(k / 3)), pvMoi: Math.max(2, Combat.REGLE.PV - Math.floor(Math.max(0, k - 3) / 2)) };
  },
  /* Ce que rapporte un combat : par PV pris, et s'il tombe (+ bonusDegats
     dégâts). Pendant le Choc, en Étincelles ; sinon, en Éclats. */
  parDegat: 3, victoire: 15, bonusDegats: 3,
  parDegatEclats: 2, victoireEclats: 15
};

/* Le combat d'une clé : 'p3' (la phase 3) ou 'i5' (l'Infini, palier 5). */
function raidCombat(cle, boss) {
  const s = String(cle || 'p1');
  const n = Math.max(1, parseInt(s.slice(1), 10) || 1);
  let c;
  if (s[0] === 'i') c = Object.assign({ infini: true, n }, RAID.infini(n));
  else {
    const ph = RAID.phases[Math.min(n, RAID.phases.length) - 1];
    c = { infini: false, n, ia: ph.ia, pvBoss: ph.pv, ess: ph.ess, pvMoi: Combat.REGLE.PV };
  }
  /* Le réglage d'un boss (RAID.bosses › ajuste) : ce qu'il a vraiment en
     combat. Sans `boss`, les chiffres de la phase — ceux que le serveur
     garde pour compter les dégâts (raid_combat, 27_raid.sql). */
  const a = boss ? raidBoss(boss).ajuste : null;
  if (a) c = Object.assign({}, c, { pvBoss: Math.max(3, c.pvBoss + (a.pv || 0)), ess: Math.max(0, c.ess + (a.ess || 0)) });
  return c;
}

/* Le raid (la saison) du jour `j` ('2026-10-20'), à partir de l'ancre (le
   premier jour du Choc ; RAID.saison.depart sans lui) : son numéro, son
   premier jour, le premier jour du suivant, et son boss. Avant l'ancre,
   c'est le premier (raid_saison, 27_raid.sql). */
function raidSaison(j, ancre) {
  const d0 = Date.parse((ancre || RAID.saison.depart) + 'T12:00:00Z');
  const jn = Math.floor((Date.parse(j + 'T12:00:00Z') - d0) / 86400000);
  const n = Math.max(1, Math.floor(jn / RAID.saison.jours) + 1);
  const jour = k => new Date(d0 + k * RAID.saison.jours * 86400000).toISOString().slice(0, 10);
  return { n, debut: jour(n - 1), fin: jour(n), boss: raidBoss(n).id };
}
/* Le boss du raid `n` (ou d'un identifiant de carte) : à tour de rôle. */
function raidBoss(n) {
  if (typeof n === 'string') return RAID.bosses.find(b => b.id === n) || RAID.bosses[0];
  return RAID.bosses[chocMod(Math.max(1, n || 1) - 1, RAID.bosses.length)];
}

const CHOC = {
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
    /* Une règle par jour, à tour de rôle. `pv` et `ess` : [toi, l'adversaire].
       Des variantes du site autour des règles officielles (4 PV chacun) :
       « Classique », ce sont elles, exactement. */
    regles: [
      { id: 'eclair', nom: 'Combat éclair', texte: 'Trois PV chacun au lieu de quatre : la moindre ouverture est fatale.', pv: [3, 3], ess: [0, 0] },
      { id: 'siege', nom: 'Le siège', texte: 'L\'adversaire a 6 PV. Toi, tu commences avec 2 Essences en jeu.', pv: [4, 6], ess: [2, 0] },
      { id: 'renforts', nom: 'Renforts', texte: 'Les deux camps commencent avec une Essence en jeu.', pv: [4, 4], ess: [1, 1] },
      { id: 'miroir', nom: 'Le miroir', texte: 'Les deux camps jouent le même deck.', pv: [4, 4], ess: [0, 0], miroir: true },
      { id: 'outsider', nom: 'L\'outsider', texte: 'Tu as 3 PV, l\'adversaire 5 et une Essence d\'avance.', pv: [3, 5], ess: [0, 1] },
      { id: 'marathon', nom: 'Marathon', texte: 'Six PV chacun : une partie longue, où chaque carte compte.', pv: [6, 6], ess: [0, 0] },
      { id: 'classique', nom: 'Classique', texte: 'Les règles officielles, rien de plus.', pv: [4, 4], ess: [0, 0] }
    ],
    /* Les deux semaines de l'événement, jour par jour (version 3.0.11 ; la
       troisième semaine retirée en 3.0.13) : chaque semaine a les sept
       règles, dans un ordre à elle ; jamais la même règle deux jours de
       suite, ni le même jour de la semaine d'une semaine à l'autre. La
       première Épreuve est « Classique », pour apprendre. Hors de ces 14
       jours (un événement plus long), la règle tourne avec la date
       (regleEpreuve). Les decks, eux, changent chaque jour avec la graine du
       serveur. */
    calendrier: [
      'classique', 'renforts', 'siege', 'miroir', 'eclair', 'outsider', 'marathon',
      'siege', 'eclair', 'marathon', 'classique', 'renforts', 'miroir', 'outsider'
    ]
  }
};

/* Les couleurs du deck d'un boss, le jour `j`. Le Sorcier joue Mauve (ses
   attaques en demandent deux), avec une seconde couleur qui change chaque
   jour — la liste et l'ordre d'avant la 3.0.11, pour que ses decks ne
   changent pas. Un boss Neutre (le Marionnettiste : ses attaques prennent
   n'importe quelle Essence) « joue les couleurs des autres » : chaque jour,
   une couleur assez fournie pour porter un deck (celles de tirerCouleurs,
   js/combat/decks.js), et une seconde. */
const CHOC_ALLIES = ['violette', 'azur', 'rose', 'jaune', 'bleue', 'orange', 'verte', 'jade', 'mauve'];
const CHOC_FORTES = ['rose', 'orange', 'violette', 'mauve', 'bleue', 'azur', 'verte'];
function chocCouleurs(j, boss) {
  const b = raidBoss(boss || RAID.boss);
  const k = chocJourN(j);
  if (b.couleur !== 'neutre') {
    const allies = CHOC_ALLIES.filter(c => c !== b.couleur);
    return [b.couleur, allies[chocMod(k, allies.length)]];
  }
  const a = CHOC_FORTES[chocMod(k, CHOC_FORTES.length)];
  const reste = CHOC_ALLIES.filter(c => c !== a);
  return [a, reste[chocMod(k * 3 + 1, reste.length)]];
}

/* Le numéro d'un jour ('2026-10-11' → nombre de jours depuis le 1er janvier
   2026). Le serveur réel fait le même calcul (choc_jour, 25_choc.sql). */
function chocJourN(j) {
  return Math.round((Date.parse(j + 'T12:00:00Z') - Date.parse('2026-01-01T12:00:00Z')) / 86400000);
}
const chocMod = (n, m) => ((n % m) + m) % m;

/* Le deck du boss `boss` (le Sorcier par défaut), le jour `j`, pour la clé
   `cle` (la phase ou le palier Infini) : un deck tiré au sort dans ses deux
   couleurs du jour, avec le boss dedans — il commence la partie déjà sur le
   plateau (`posesBoss`). Le Sorcier garde exactement la graine d'avant. */
function deckBoss(j, cle, boss) {
  const b = raidBoss(boss || RAID.boss);
  const couleurs = chocCouleurs(j, b.id);
  const c = raidCombat(cle);
  const sel = b.id === 'c116' ? 0 : Number(b.id.slice(1)) * 977;
  const r = aleaGraine(0x3c6ef372 ^ (chocJourN(j) * 31 + c.n * (c.infini ? 7 : 1) + (c.infini ? 1000 : 0) + sel));
  /* Un seul boss : ses exemplaires (et ceux qui comptent pour lui, même nom
     et même couleur) sont écartés du tirage, puis il est posé une fois. */
  const memes = Combat.toutes().filter(k => Decks.cleCopie(k.id) === Decks.cleCopie(b.id)).map(k => k.id);
  const d = Decks.aleatoire(r, { niveau: Math.min(5, c.ia + 1), couleurs, nom: b.nom, exclure: memes });
  imposerCarte(d, b.id, couleurs[0], r);
  d.couverture = b.id;
  return d;
}
const deckSorcier = (j, cle) => deckBoss(j, cle, 'c116');
/* Le boss au milieu de ses trois lignes, dès le début. */
const posesBoss = boss => [[], [{ id: raidBoss(boss || RAID.boss).id, ligne: 1 }]];

/* La règle de l'Épreuve du jour `j`, le `n`-ième jour de l'événement
   (choc_etat › n) : celle du calendrier ; sans `n`, ou au-delà, une par jour
   à tour de rôle. Seule, sans les decks, pour l'accueil de l'événement
   (js/choc.js). */
function regleEpreuve(j, n) {
  const l = CHOC.epreuve.regles, cal = CHOC.epreuve.calendrier;
  const id = n >= 1 && n <= cal.length ? cal[n - 1] : null;
  return (id && l.find(x => x.id === id)) || l[chocMod(chocJourN(j), l.length)];
}

/* L'Épreuve du jour `j` (le `n`-ième de l'événement) : sa règle, et les
   deux decks imposés. La graine du jour vient du serveur (choc_etat) ; tout
   le reste s'en déduit. */
function epreuveDuJour(j, graine, n) {
  const regle = regleEpreuve(j, n);
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

// ---- js/combat/historique.js
/* L'historique des combats (version 3.0.12).

   À la fin d'un combat contre l'IA ou d'un défi entre amis, la page résume
   la partie tour par tour, à partir des événements du moteur (E.ev), et
   l'envoie avec le résultat (combat_fin, defi_fin). Le serveur garde les
   trente derniers combats de chaque joueur (combats_historique,
   supabase/installation/23_combats.sql) ; Combats › Historique les montre.

   Pas de replay : seulement ce que le journal de l'arène racontait, une
   ligne par geste, rangé par tour. Une ligne est une petite liste
   (un code, puis des identifiants de cartes et des valeurs) : le texte se
   refait à l'affichage, avec les noms du catalogue. Un combat pèse ainsi
   quelques Ko. Le tutoriel, écrit d'avance, n'y entre pas.

   `j` est relatif dans le résumé : 0, celui qui regarde ; 1, l'adversaire. */
"use strict";

const Historique = (() => {
  /* Combats gardés par joueur (le serveur fait foi : historique_ajouter). */
  const MAX = 30;
  /* Signes au plus pour le journal d'un combat : au-delà, les derniers tours
     sont coupés (le serveur refuse au-delà de 30 000). */
  const TAILLE = 24000;

  /* ---------- Le résumé ---------- */
  function resumer(E, moi) {
    const r = j => (j === moi ? 0 : 1);
    /* Les événements nomment souvent une carte par son instance (`u`) : on
       retrouve son identifiant dans ceux qui donnent les deux, puis dans
       l'état final (une carte ne quitte jamais la partie). */
    const ids = new Map();
    for (const e of E.ev) if (typeof e.u === 'number' && e.id) ids.set(e.u, e.id);
    for (const P of E.j) {
      for (const z of ['club', 'main', 'pv', 'defausse']) for (const c of P[z]) if (!ids.has(c.u)) ids.set(c.u, c.id);
      for (const c of P.lignes) {
        if (!c) continue;
        if (!ids.has(c.u)) ids.set(c.u, c.id);
        for (const o of c.obj) if (!ids.has(o.u)) ids.set(o.u, o.id);
      }
    }
    const id = u => ids.get(u) || '';
    const tours = [[0, null, []]];
    let l = tours[0][2];
    /* La ligne écrite pour un événement : un remplacement réécrit celle du
       Joueur bench juste avant. */
    const ecrite = new Map();
    for (let i = 0; i < E.ev.length; i++) {
      const e = E.ev[i];
      let x = null;
      switch (e.t) {
        case 'tour': tours.push([e.n, r(e.j), []]); l = tours[tours.length - 1][2]; continue;
        case 'pileFace': x = ['pf', r(e.premier)]; break;
        case 'mulligan': x = ['mu', r(e.j)]; break;
        case 'deploie': {
          if (e.pose) { x = ['po', r(e.j), e.id]; break; }
          /* Toutes les cases prises : le Joueur bench à sa place juste avant
             (ses Objets partent avec lui) — un remplacement, une ligne. */
          let k = i - 1;
          while (k >= 0 && E.ev[k].t === 'banc' && E.ev[k].de != null) k--;
          const b = E.ev[k];
          const y = b && b.t === 'banc' && b.j === e.j && b.ligne === e.ligne && ecrite.get(b);
          if (y) { y.splice(0, y.length, 'rp', r(e.j), b.id, e.id, e.eng ? 1 : 0); continue; }
          x = ['de', r(e.j), e.id, e.eng ? 1 : 0];
          break;
        }
        case 'joue': x = ['jo', r(e.j), e.id]; break;
        case 'lie': x = ['li', r(e.j), e.id, id(e.cible)]; break;
        case 'attaque': x = ['at', r(e.j), id(e.u), e.k, e.cible === 'ceo' ? 'ceo' : id(e.cible)]; break;
        case 'soutien': x = ['so', r(e.j), id(e.u), e.val]; break;
        case 'defend': x = ['df', r(e.j), id(e.u)]; break;
        case 'repousse': x = ['ti', e.val, e.def]; break;
        case 'impact': if (e.cible !== 'ceo' && e.def != null && e.val >= e.def) x = ['to', e.val, e.def]; break;
        case 'vaincu': x = ['va', r(e.j), e.id]; break;
        case 'touche': x = ['pv', r(e.j)]; break;
        case 'pvRecup': x = ['pr', r(e.j)]; break;
        case 'pvDefausse': x = ['pd', r(e.j)]; break;
        case 'resilience': x = ['re', r(e.j), e.id]; break;
        case 'riposte': x = ['ri', r(e.j), e.id, e.val]; break;
        case 'banc': x = ['be', r(e.j), e.id]; break;
        case 'defausse': x = ['jt', r(e.j), e.id]; break;
        case 'clubVide': x = ['cv', r(e.j)]; break;
        case 'legion': x = ['lg', r(e.j), e.id]; break;
        case 'enMain': x = ['em', r(e.j), e.id]; break;
        case 'shield': x = ['sh']; break;
        case 'fin': x = ['fi', r(e.gagnant), e.raison]; break;
      }
      if (x) { l.push(x); ecrite.set(e, x); }
    }
    const res = { v: 1, premier: r(E.premier), tours: tours.filter(t => t[0] > 0 || t[2].length) };
    /* Trop long : on garde les premiers tours, et on le dit. */
    while (JSON.stringify(res).length > TAILLE && res.tours.length > 1) { res.tours.pop(); res.coupe = true; }
    return res;
  }

  /* Ce que la page envoie avec le résultat (p_resume.histo, p_histo). Le
     serveur ajoute ce qu'il sait mieux qu'elle : le mode, l'heure, le
     résultat, et l'adversaire d'un défi. */
  function entree(E, moi, meta) {
    meta = meta || {};
    const a = meta.adversaire || {};
    return {
      titre: String(meta.titre || '').slice(0, 60),
      adversaire: { nom: String(a.nom || '').slice(0, 40), avatar: String(a.avatar || 'star').slice(0, 40), frame: String(a.frame || 'default').slice(0, 40) },
      raison: E.fin ? E.fin.raison : 'abandon',
      tours: E.tour,
      pv: E.j[moi].pv.length, pv_adv: E.j[1 - moi].pv.length,
      deck: meta.deck ? String(meta.deck).slice(0, 32) : null,
      journal: resumer(E, moi)
    };
  }

  /* ---------- Le texte ---------- */
  const nomCarte = id => ((typeof Combat !== 'undefined' && Combat.carte(id)) || byId[id] || {}).nom || 'une carte';
  const nomAttaque = (id, k) => {
    const c = (typeof Combat !== 'undefined' && Combat.carte(id)) || {};
    return ((c.atks || [])[k] || {}).nom || '';
  };
  /* Une ligne, en HTML. `adv` : le nom de l'adversaire. */
  function ligne(x, adv) {
    const A = `<b>${h(adv || 'L\'adversaire')}</b>`;
    const k = id => `<i>${h(nomCarte(id))}</i>`;
    /* Le sujet et son verbe : « Tu déploies », « Lumen déploie ». */
    const s = (j, tu, il) => (j === 0 ? `Tu ${tu}` : `${A} ${il}`);
    switch (x[0]) {
      case 'pf': return x[1] === 0 ? 'Tu commences.' : `${A} commence.`;
      case 'mu': return s(x[1], 'changes de main.', 'change de main.');
      case 'po': return `${s(x[1], 'commences avec', 'commence avec')} ${k(x[2])} en jeu.`;
      case 'de': return `${s(x[1], 'déploies', 'déploie')} ${k(x[2])}${x[3] ? ' (engagé)' : ''}.`;
      case 'rp': return `${s(x[1], 'remplaces', 'remplace')} ${k(x[2])} par ${k(x[3])}${x[4] ? ' (engagé)' : ''}.`;
      case 'jo': return `${s(x[1], 'joues', 'joue')} ${k(x[2])}.`;
      case 'li': return `${s(x[1], 'lies', 'lie')} ${k(x[2])}${x[3] ? ` à ${k(x[3])}` : ''}.`;
      case 'at': {
        const n = nomAttaque(x[2], x[3]);
        const cible = x[4] === 'ceo' ? (x[1] === 0 ? ` le CEO de ${A}` : ' ton CEO') : x[4] ? ` ${k(x[4])}` : '';
        return `${k(x[2])} attaque${cible}${n ? ` (${h(n)})` : ''}.`;
      }
      case 'so': return `${k(x[2])} soutient l'attaque (+${fmtN(x[3])}).`;
      case 'df': return `${k(x[2])} défend.`;
      case 'ti': return `Il tient : ${fmtN(x[1])} contre ${fmtN(x[2])}.`;
      case 'to': return `${fmtN(x[1])} contre ${fmtN(x[2])} : le défenseur tombe.`;
      case 'va': return `${k(x[2])} est vaincu.`;
      case 'pv': return s(x[1], 'es touché.', 'est touché.');
      /* Les règles : le CEO touché récupère en main la carte du dessus de
         ses PV (ou joue sa Résilience). */
      case 'pr': return s(x[1], 'prends ton PV du dessus en main.', 'prend son PV du dessus en main.');
      case 'pd': return x[1] === 0 ? 'Ton PV du dessus part à la défausse.' : `Le PV du dessus de ${A} part à la défausse.`;
      case 're': return `Résilience : ${k(x[2])}.`;
      case 'ri': return `Riposte de ${k(x[2])} (${fmtN(x[3])}).`;
      case 'be': return `${k(x[2])} est bench (à la défausse).`;
      case 'jt': return `${s(x[1], 'défausses', 'défausse')} ${k(x[2])}.`;
      case 'cv': return s(x[1], 'dois piocher dans un Club vide.', 'doit piocher dans un Club vide.');
      case 'lg': return `Légion : ${k(x[2])} revient en main.`;
      case 'em': return `${k(x[2])} retourne en main.`;
      case 'sh': return 'Shield : l\'attaque est ignorée.';
      case 'fi': return x[1] === 0 ? 'Victoire.' : 'Défaite.';
    }
    return '';
  }
  /* Les lignes qui comptent le plus : on les marque, comme le journal de
     l'arène (une carte vaincue, un PV perdu, la fin). */
  const ton = x => (x[0] === 'va' || x[0] === 'pv' || x[0] === 'pd' || x[0] === 'cv' ? (x[1] === 0 ? 'mal' : 'bien')
    : x[0] === 'fi' ? 'sys' : x[0] === 're' || x[0] === 'lg' ? 'bien' : '');

  return { MAX, TAILLE, resumer, entree, ligne, ton };
})();

/* ---------- Combats › Historique ---------- */
const HISTO_MODES = { campagne: 'Campagne', infini: 'Arcade', raid: 'Raid', epreuve: 'Épreuve du jour', defi: 'Versus' };
const HISTO_RAISONS = {
  pv: ['Le CEO adverse n\'avait plus de PV.', 'Ton CEO n\'avait plus de PV.'],
  club: ['L\'adversaire devait piocher dans un Club vide.', 'Tu devais piocher dans un Club vide.'],
  abandon: ['L\'adversaire a abandonné.', 'Tu as abandonné.']
};
let cbHisto = null;
let cbHistoErreur = '';

async function chargerHisto() {
  try {
    cbHisto = await Backend.historique();
    cbHistoErreur = '';
  } catch (e) {
    cbHistoErreur = e.message || 'L\'historique n\'a pas pu être chargé.';
  }
  if (tab === 'combats' && cbVue === 'historique') render();
}

function vCbHistorique() {
  const tete = cbSousTete('Historique', `Tes ${Historique.MAX} derniers combats, tour par tour`);
  if (cbHistoErreur) return tete + vide('Historique indisponible', cbHistoErreur);
  if (!cbHisto) { chargerHisto(); return tete + '<p class="muted boitecharge">Chargement…</p>'; }
  if (!cbHisto.length) return tete + vide('Aucun combat pour l\'instant', 'Tes combats en solo et tes défis entre amis arrivent ici, tour par tour.');
  const v = cbHisto.filter(x => x.gagne).length;
  return tete + `<div class="hc-bilan">
      <span><b class="tnum">${v}</b><small>victoire${v > 1 ? 's' : ''}</small></span>
      <span><b class="tnum">${cbHisto.length - v}</b><small>défaite${cbHisto.length - v > 1 ? 's' : ''}</small></span>
      <span><b class="tnum">${Math.round(100 * v / cbHisto.length)} %</b><small>de victoires</small></span>
    </div>
    <ol class="hc-liste">${cbHisto.map(vHistoLigne).join('')}</ol>`;
}

function vHistoLigne(x) {
  const a = x.adversaire || {};
  return `<li><button class="hc-l ${x.gagne ? 'v' : 'd'}" data-cb="histo" data-v="${h(String(x.id))}">
    <span class="hc-res" aria-label="${x.gagne ? 'Victoire' : 'Défaite'}">${x.gagne ? 'V' : 'D'}</span>
    ${avatarHTML(a.avatar || 'star', a.frame || 'default', 'sm', a.photo || null)}
    <span class="hc-t"><b>${h(a.nom || 'Adversaire')}</b><small>${h(x.titre || HISTO_MODES[x.mode] || 'Combat')}</small></span>
    <span class="hc-d"><small>${h(ilya(x.le))}</small><small class="tnum">${x.tours} tour${x.tours > 1 ? 's' : ''}</small></span>
  </button></li>`;
}

/* Un combat, tour par tour, dans une feuille. */
async function ouvrirHistoCombat(id) {
  const base = (cbHisto || []).find(x => String(x.id) === String(id));
  let x;
  try {
    occupe(true);
    x = await Backend.historiqueCombat(base ? base.id : id);
  } catch (e) {
    return toast(e.message || 'Ce combat n\'a pas pu être chargé.');
  } finally { occupe(false); }
  const a = x.adversaire || {};
  const j = x.journal;
  const raison = (HISTO_RAISONS[x.raison] || [])[x.gagne ? 0 : 1] || '';
  const quand = new Date(srvTime(x.le)).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const tours = j && Array.isArray(j.tours) ? j.tours.map(([n, qui, l]) => `<section class="hc-tour ${qui === 0 ? 'moi' : qui === 1 ? 'lui' : 'mise'}">
      <h4>${n ? `Tour ${n} <small>${qui === 0 ? 'Toi' : h(a.nom || 'Adversaire')}</small>` : 'Mise en place'}</h4>
      <ul>${l.map(y => { const t = Historique.ligne(y, a.nom); return t ? `<li class="${Historique.ton(y)}">${t}</li>` : ''; }).join('')}</ul>
    </section>`).join('') : '<p class="muted small">Le déroulé de ce combat n\'a pas été gardé.</p>';
  openSheet({
    title: x.gagne ? 'Victoire' : 'Défaite',
    body: `<div class="hc-fiche">
        <div class="hc-tete ${x.gagne ? 'v' : 'd'}">${avatarHTML(a.avatar || 'star', a.frame || 'default', 'lg', a.photo || null)}
          <span><b>${h(a.nom || 'Adversaire')}</b><small>${h(x.titre || HISTO_MODES[x.mode] || 'Combat')}</small><small>${h(quand)}</small></span></div>
        <p class="hc-chiffres tnum">${x.tours} tour${x.tours > 1 ? 's' : ''} · PV restants : ${x.pv} contre ${x.pv_adv}${x.deck ? ` · deck « ${h(x.deck)} »` : ''}</p>
        ${raison ? `<p class="muted small">${h(raison)}</p>` : ''}
        <div class="hc-tours">${tours}</div>
        ${j && j.coupe ? '<p class="muted small">La partie était longue : le déroulé s\'arrête là.</p>' : ''}
      </div>`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

// ---- js/combat/verif.js
/* La vérification d'un combat (version 3.0.14).

   Le propriétaire : « Le serveur doit évidemment vérifier les résultats des
   combats. » Jusqu'à la 3.0.13, la page disait au serveur qui avait gagné,
   combien de PV elle avait pris au boss, en combien de tours : il la
   croyait, dans des plafonds. Désormais il rejoue la partie.

   Tout est déterministe : le moteur (js/combat/moteur.js) tire ses mélanges
   d'une graine, et l'adversaire (js/combat/ia.js) tire les siens de l'état
   de la partie — aucune horloge, aucun Math.random, seulement des opérations
   que tous les navigateurs calculent pareil. Le serveur part donc de ce qu'il
   a noté à l'ouverture (combat_debut : le mode, la graine, le deck du joueur,
   le jour, la Section, le boss), rebâtit la partie avec `partie()`, et la
   rejoue coup par coup (`rejouer()`) : chaque coup du joueur doit être
   permis par les règles, chaque coup de l'adversaire doit être celui qu'il
   aurait joué. C'est le résultat de cette partie-là qui paie (`verdict()`).

   Le même fichier sert partout, pour qu'il n'y ait qu'une façon de bâtir une
   partie : la page (js/battle.js : la partie qu'elle joue est celle que le
   serveur rejouera), le faux serveur de la démo (_demo/serveur.js), les
   tests (tools/combat-tests.js) et la fonction du serveur
   (supabase/functions/combat-verifier, qui l'embarque : tools/build-verif.py).

   Le Versus (`defi()`) n'a pas d'adversaire calculé : les deux joueurs
   jouent. Le serveur note qui a envoyé chaque coup (defi_jouer) ; un coup
   envoyé hors de son tour, ou que les règles refusent, fait perdre celui
   qui l'a envoyé. */
const Verif = (() => {
  const PV = () => Combat.REGLE.PV;
  /* Une écriture unique d'un coup : les clés triées à tous les niveaux, sans
     ce que JSON ne transmet pas (une valeur `undefined`). Deux coups égaux
     ont la même. */
  function canon(x) {
    const tri = v => (Array.isArray(v) ? v.map(tri)
      : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = tri(v[k]); return o; }, {})
        : v);
    return JSON.stringify(tri(JSON.parse(JSON.stringify(x))));
  }

  /* La partie d'un combat contre l'adversaire du jeu. `o` : ce que le
     serveur a noté à l'ouverture — { mode, cle, niveau, jour ('2026-11-02'),
     graine, deck (format du moteur : { club: [ids], reserve: [couleurs] }),
     section, boss, n }. Rend { init, niveau } : la partie, et le niveau de
     l'adversaire. Les noms n'y comptent pas (rien de la partie n'en dépend). */
  function partie(o) {
    const g = Number(o.graine) >>> 0;
    let moi = o.deck, adv, pv = [PV(), PV()], ess = [0, 0], poses = null, niveau = Number(o.niveau) || 3;
    if (o.mode === 'campagne') {
      const n = parseInt(String(o.cle || '').slice(2), 10) - 1;
      const f = combatsCampagne(o.section)[n];
      if (!f) throw new Error('Combat inconnu.');
      adv = Decks.versMoteur(deckRival(f, o.section));
      if (f.regle) { pv[1] = f.regle.pv || PV(); ess[1] = f.regle.ess || 0; }
      niveau = f.niveau;
    } else if (o.mode === 'infini') {
      adv = Decks.versMoteur(Decks.aleatoire(aleaGraine(g ^ 0x5bd1e995), { niveau }));
    } else if (o.mode === 'raid') {
      const c = raidCombat(o.cle, o.boss);
      adv = Decks.versMoteur(deckBoss(o.jour, o.cle, o.boss));
      poses = posesBoss(o.boss);
      pv = [c.pvMoi, c.pvBoss];
      ess = [0, c.ess];
      niveau = c.ia;
    } else if (o.mode === 'epreuve') {
      const x = epreuveDuJour(o.jour, g, o.n);
      moi = Decks.versMoteur(x.moi);
      adv = Decks.versMoteur(x.adv);
      pv = x.regle.pv.slice();
      ess = x.regle.ess.slice();
      niveau = CHOC.epreuve.ia;
    } else {
      throw new Error('Mode inconnu.');
    }
    if (!moi || !Array.isArray(moi.club) || !Array.isArray(moi.reserve)) throw new Error('Deck du joueur absent.');
    const init = { decks: [moi, adv], noms: ['Toi', 'Adversaire'], graine: g, pv, essDepart: ess };
    if (poses) init.poses = poses;
    return { init, niveau };
  }

  /* Ce que le serveur retient d'une partie finie (joueur `j`) : qui a gagné
     et comment, les Joueurs vaincus, les PV pris (les dégâts du Raid), ce
     qui reste à chacun. */
  function verdict(E, j) {
    let vaincus = 0, touches = 0;
    for (const ev of E.ev) {
      if (ev.t === 'vaincu' && ev.j !== j) vaincus++;
      if (ev.t === 'touche' && ev.j !== j) touches++;
    }
    const fin = E.fin || { gagnant: 1 - j, raison: 'abandon' };
    return {
      gagne: fin.gagnant === j, raison: fin.raison, abandon: fin.raison === 'abandon' && fin.gagnant !== j,
      tours: E.tour, vaincus, touches, pv: E.j[j].pv.length, pv_adv: E.j[1 - j].pv.length, actions: E.journal.length
    };
  }

  const refus = (raison, k) => ({ etat: 'refus', raison, k });

  /* Rejouer le journal d'un combat contre l'adversaire du jeu. `opt` :
       depuis : les coups de l'adversaire avant cet index ont déjà été
                vérifiés (une passe précédente) : on les rejoue sans les
                recalculer ;
       budget : en millisecondes. Recalculer un coup de l'adversaire coûte
                cher au niveau 5 (jusqu'à 2,4 s pour une partie de Raid,
                mesuré) ; la fonction du serveur n'a que 2 s par appel. Le
                budget épuisé, on rend { etat: 'suite', k } : la passe
                suivante repart de k ;
       meta : le titre, l'adversaire et le deck à écrire dans l'historique
              (de l'affichage seulement : le résultat vient de la partie).
     Rend { etat: 'fini', verdict, histo } ou { etat: 'refus', raison, k }. */
  function rejouer(o, journal, opt) {
    opt = opt || {};
    let p;
    try { p = partie(o); } catch (e) { return refus(e.message || 'Partie impossible à rebâtir.', 0); }
    if (!Array.isArray(journal) || journal.length > 5000) return refus('Journal illisible.', 0);
    const E = Combat.creer(p.init);
    const depuis = opt.depuis || 0;
    const limite = opt.budget ? Date.now() + opt.budget : Infinity;
    /* Chaque passe vérifie au moins un coup de l'adversaire : elle avance
       toujours, même quand rejouer le début a mangé le budget. */
    let fait = false;
    for (let k = 0; k < journal.length; k++) {
      const a = journal[k];
      if (!a || typeof a !== 'object' || Array.isArray(a)) return refus('Coup illisible.', k);
      const d = Combat.demande(E);
      if (!d || E.fin) return refus('Des coups après la fin de la partie.', k);
      if (a.t === 'abandon') {
        /* Seul le joueur abandonne, et c'est son dernier coup. */
        if (a.qui !== 0) return refus('L\'adversaire n\'abandonne jamais.', k);
        if (k !== journal.length - 1) return refus('Des coups après un abandon.', k);
        Combat.agir(E, { t: 'abandon', qui: 0 });
        break;
      }
      if (d.qui !== 0 && k >= depuis) {
        if (fait && Date.now() > limite) return { etat: 'suite', k };
        fait = true;
        let attendu;
        try { attendu = IA.choisir(E, { niveau: p.niveau }); } catch (e) { return refus('Adversaire incalculable : ' + (e.message || e), k); }
        if (canon(attendu) !== canon(a)) return refus('Un coup de l\'adversaire n\'est pas celui qu\'il aurait joué.', k);
      }
      try { Combat.agir(E, a); } catch (e) { return refus('Coup refusé par les règles : ' + (e.message || e), k); }
    }
    if (!E.fin) return refus('La partie n\'est pas finie.', journal.length);
    const v = verdict(E, 0);
    let histo = null;
    if (typeof Historique !== 'undefined') {
      try { histo = Historique.entree(E, 0, opt.meta || {}); } catch (e) { histo = null; }
    }
    return { etat: 'fini', verdict: v, histo };
  }

  /* Un défi entre amis. `x` : { decks: [deck_de, deck_pour], graine,
     actions, auteurs } — `auteurs[k]` : qui a envoyé le coup k (0 : celui qui
     a défié, 1 : l'autre ; absent pour un défi d'avant la 3.0.14). Rend
     { fini, gagnant, fautif, raison, tours, verdicts: [v0, v1], histo } : un
     coup envoyé hors de son tour, ou refusé par les règles, fait perdre son
     auteur (`fautif`), et la partie s'arrête là. `opt` : { moi, meta } —
     l'historique est écrit pour ce joueur-là. */
  function defi(x, opt) {
    opt = opt || {};
    const E = Combat.creer({ decks: x.decks, noms: ['A', 'B'], graine: Number(x.graine) >>> 0 });
    const acts = Array.isArray(x.actions) ? x.actions : [];
    const par = Array.isArray(x.auteurs) ? x.auteurs : [];
    let fautif = null, raison = null;
    for (let k = 0; k < acts.length && fautif == null; k++) {
      const a = acts[k];
      const qui = par[k] === 0 || par[k] === 1 ? par[k] : null;
      if (E.fin) break;
      if (!a || typeof a !== 'object') { fautif = qui; raison = 'Coup illisible.'; break; }
      if (a.t === 'abandon') {
        if (qui != null && a.qui !== qui) { fautif = qui; raison = 'Abandon envoyé pour l\'autre joueur.'; break; }
        Combat.agir(E, { t: 'abandon', qui: a.qui === 1 ? 1 : 0 });
        break;
      }
      const d = Combat.demande(E);
      if (!d) break;
      if (qui != null && d.qui !== qui) { fautif = qui; raison = 'Coup envoyé hors de son tour.'; break; }
      try { Combat.agir(E, a); } catch (e) { fautif = qui != null ? qui : d.qui; raison = 'Coup refusé par les règles : ' + (e.message || e); }
    }
    const fini = fautif != null || !!E.fin;
    const gagnant = fautif != null ? 1 - fautif : E.fin ? E.fin.gagnant : null;
    let histo = null;
    if (fini && (opt.moi === 0 || opt.moi === 1) && typeof Historique !== 'undefined') {
      try { histo = Historique.entree(E, opt.moi, opt.meta || {}); } catch (e) { histo = null; }
    }
    return { fini, gagnant, fautif, raison: fautif != null ? raison : E.fin ? E.fin.raison : null, tours: E.tour,
      verdicts: [verdict(E, 0), verdict(E, 1)], histo };
  }

  return { partie, rejouer, verdict, defi, canon };
})();

// ---- le catalogue des cartes, comme au démarrage de la page
var __cartes = buildCards();
Combat.catalogue(__cartes.concat(buildPromos(), buildReverses(__cartes), buildUniques(), buildSecretes()));
export const EMPREINTE = '22ec4bf8d21b';
export const Jeu = { Verif, Combat: globalThis.Combat, IA: globalThis.IA, Decks: globalThis.Decks };
