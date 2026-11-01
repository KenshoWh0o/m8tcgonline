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
    code: 'P06', fichier: 'promos/P06-Le_Marionnettiste.webp', nom: 'Le Marionnettiste',
    categorie: 'Joueur', couleur: 'Neutre', def: 140,
    attaques: [
      { nom: 'Coup de fil', cout: { neutre: 3 }, degats: 160 }
    ],
    mot_cle: { nom: 'Riposte', texte: "Lorsqu'il est vaincu, ce Joueur active sa Capacité d'Attaque la plus puissante." },
    illustrateur: 'Gobli Prim',
    ambiance: 'Merci, Ô grand Squeezie, pour la générosité',
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
