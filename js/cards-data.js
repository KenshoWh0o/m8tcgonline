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
    fichier: "060_E_Joueur_Mauve_Gotaga-Pose.avif", num: 60, nom: "Gotaga Posé",
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
    ambiance: "Merci, Ô grand Squeezie, pour la générosité"
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
