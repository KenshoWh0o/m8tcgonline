/* Les cartes Promo : elles ne sortent jamais d'un booster et ne comptent pas
   dans le total de l'extension. On les obtient autrement — en boutique, ou en
   récompense d'un palier de collection.

   Elles vivent dans leur propre liste (`promos`, et non `cards`) : c'est ce qui
   garantit que « 122 cartes » reste 122 partout, et que le pourcentage de
   collection ne bouge pas quand on en ajoute une.

   Le champ `obtention` n'est là que pour l'affichage : c'est le serveur qui
   accorde vraiment ces cartes (supabase/09_promos.sql). */
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
  /* Version 3.0 : les Promos des deux Starter Decks. Leur contenu n'est pas
     encore connu : ces deux cartes sont provisoires (`provisoire`), sans
     illustration — renderCard leur dessine un visuel en texte — et avec des
     valeurs de combat sobres, sans talent, en attendant les vraies. On les
     reçoit en rejoignant sa Section, puis en finissant la campagne. */
  {
    code: 'P03', nom: 'Section Toxique', provisoire: true, section: 'toxique',
    categorie: 'Joueur', couleur: 'Rose', def: 120,
    attaques: [
      { nom: 'Toxicité', cout: { rose: 1, neutre: 1 }, degats: 120 }
    ],
    ambiance: 'Promo du Starter Deck Section Toxique — visuel à venir.',
    obtention: 'section'
  },
  {
    code: 'P04', nom: 'Section Déter', provisoire: true, section: 'deter',
    categorie: 'Joueur', couleur: 'Mauve', def: 130,
    attaques: [
      { nom: 'Déter', cout: { mauve: 1, neutre: 1 }, degats: 120 }
    ],
    ambiance: 'Promo du Starter Deck Section Déter — visuel à venir.',
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
   chasse (supabase/15_evenements.sql). Comme les Promos, elle vit hors de
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
   se fabriquent. Trois ne sont pas encore révélées (`cachee`) : leur visuel
   est flouté, et elles n'ont ni nom ni texte connus — on peut les obtenir,
   pas les jouer. Le serveur les tire dans public.cards (supabase/23_combats.sql). */
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
  { fichier: '124_S_Secrete.avif', num: 124, cachee: true },
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
  { fichier: '126_S_Secrete.avif', num: 126, cachee: true },
  { fichier: '127_S_Secrete.avif', num: 127, cachee: true }
];
