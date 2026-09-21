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
