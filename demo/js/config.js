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
  'assets/boosters/booster-01.webp?v=fa4b32',
  'assets/boosters/booster-02.webp?v=fa4b32',
  'assets/boosters/booster-03.webp?v=fa4b32',
  'assets/boosters/booster-04.webp?v=fa4b32'
];

/* Le sceau assets/pack-star.svg?v=fa4b32 sert d'icône au compteur de boosters, directement dans index.html. */
const ART = {
  logo: 'assets/logo-m8.webp?v=fa4b32',         /* logo du jeu, en en-tête */
  back: 'assets/card-back.webp?v=fa4b32',       /* dos de carte */
  set: 'assets/extension-logo.svg?v=fa4b32',    /* logo de l'extension */
  edition: 'assets/1st-edition.svg?v=fa4b32',   /* pastille 1re édition */
  seal: 'assets/pack-star.svg?v=fa4b32',        /* sceau, icône de la réserve */
  star: 'assets/star-pink.svg?v=fa4b32',        /* étincelle, repli d'avatar */
  jeton: 'assets/jeton-echange.webp?v=fa4b32'   /* le jeton d'échange, frappé du M8 */
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
  rose: { nom: 'Rose', c: '#ee0073', ic: 'assets/essences/rose.svg?v=fa4b32' },
  orange: { nom: 'Orange', c: '#f77514', ic: 'assets/essences/orange.svg?v=fa4b32' },
  jade: { nom: 'Jade', c: '#55e6a6', ic: 'assets/essences/jade.svg?v=fa4b32' },
  violette: { nom: 'Violette', c: '#8936ff', ic: 'assets/essences/violette.svg?v=fa4b32' },
  jaune: { nom: 'Jaune', c: '#ffc73b', ic: 'assets/essences/jaune.svg?v=fa4b32' },
  mauve: { nom: 'Mauve', c: '#ec8fff', ic: 'assets/essences/mauve.svg?v=fa4b32' },
  verte: { nom: 'Verte', c: '#9df244', ic: 'assets/essences/verte.svg?v=fa4b32' },
  bleue: { nom: 'Bleue', c: '#2f7fc9', ic: 'assets/essences/bleue.svg?v=fa4b32' },
  azur: { nom: 'Azur', c: '#39b8ff', ic: 'assets/essences/azur.svg?v=fa4b32' },
  neutre: { nom: 'Neutre', c: '#90b2a5', ic: 'assets/essences/neutre.png?v=fa4b32' }
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
  star: { nom: 'Étoile', art: 'assets/pack-star.svg?v=fa4b32', ico: true, bg: '#5d4bd9' },
  back: { nom: 'Dos de carte', art: 'assets/card-back.webp?v=fa4b32', objet: true, pos: '50%' },
  pack: { nom: 'Booster', art: 'assets/boosters/booster-01.webp?v=fa4b32', objet: true, pos: '40%' },
  set:  { nom: 'Extension', art: 'assets/extension-logo.svg?v=fa4b32', ico: true, bg: '#5d4bd9' },
  ed1:  { nom: '1re édition', art: 'assets/1st-edition.svg?v=fa4b32', ico: true, bg: '#ee0073' }
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

