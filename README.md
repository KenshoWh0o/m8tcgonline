# Mate TCG Online

Jeu de collection de cartes façon TCG Pocket, qui tourne entièrement dans le navigateur. Les 122 cartes de l'extension *Tout commence ici* sont livrées avec le jeu : on ouvre des boosters et on remplit sa collection.

Il n'y a ni serveur ni base de données. Les cartes font partie du code ; seule la progression (boosters et collection) est enregistrée dans le navigateur de l'appareil (IndexedDB).

## Lancer le projet

**Le plus simple :** double-clique sur `index.html`. Le jeu s'ouvre dans ton navigateur.

**Recommandé pour développer :** ouvre le dossier dans VS Code, installe l'extension *Live Server*, puis clic droit sur `index.html` › *Open with Live Server*. La page se recharge toute seule à chaque modification.

Autre option, si Node.js est installé : `npx serve .` dans le dossier, puis ouvre l'adresse affichée.

> Chaque adresse a sa propre sauvegarde. Si tu passes d'un double-clic à Live Server ou à un site en ligne, tes cartes sont toujours là, mais la progression repart de zéro.

## Mettre en ligne

- **Netlify Drop** (app.netlify.com/drop) : fais glisser le dossier entier, tu obtiens une adresse.
- **GitHub Pages** : pousse le dossier dans un dépôt GitHub, puis *Settings › Pages › Deploy from branch*.

## Organisation

```
mate-tcg-online/
├── index.html          Structure de la page + chargement des fichiers
├── cards/              Les images des cartes (une par carte, .avif)
├── assets/             Habillage : logos, visuels de booster, dos de carte, essences
│   ├── boosters/       Les quatre visuels de paquet
│   └── essences/       Les dix symboles d'essence
├── css/
│   ├── tokens.css      Couleurs, typos, rythme (la charte)
│   ├── base.css        Fond, en-tête, navigation, boutons, fenêtres
│   ├── cards.css       Cartes, symboles d'essence, grille de collection
│   ├── booster.css     Écran du paquet et animation d'ouverture
│   ├── opening.css     Ouverture plein écran, révélations, récap
│   ├── viewer.css      Visionneuse 3D
│   └── lab.css         Onglet Labo
├── js/
│   ├── config.js       Nom du jeu, habillage, couleurs, raretés, révélations
│   ├── utils.js        Outils partagés
│   ├── cards-data.js   La liste des cartes de l'extension
│   ├── cards.js        Transforme cette liste en cartes du jeu
│   ├── storage.js      État global + sauvegarde de la progression
│   ├── render-card.js  Affichage d'une carte
│   ├── ui.js           Fenêtre modale
│   ├── fx.js           Particules
│   ├── booster.js      Réserve, composition d'un booster, écran du paquet en 3D
│   ├── opening.js      Pile 3D, révélation, godpack, récap
│   ├── collection.js   Onglet Collection
│   ├── viewer.js       Visionneuse 3D
│   ├── lab.js          Onglet Labo
│   └── app.js          Navigation, clics, démarrage (chargé en dernier)
```

Les fichiers JavaScript sont des scripts classiques chargés dans l'ordre par `index.html`. Ils partagent leurs variables et fonctions. **L'ordre compte** : un fichier peut utiliser ce qui est défini dans un fichier chargé avant lui, et `app.js` doit rester en dernier.

## Où modifier quoi

| Je veux… | Fichier |
|---|---|
| Ajouter, retirer ou corriger une carte | `js/cards-data.js` (+ l'image dans `cards/`) |
| Changer le nom du jeu ou de l'extension | `js/config.js` (`GAME_NAME`, `SET_NAME`) |
| Changer les visuels de booster | `js/config.js` (`PACK_ARTS`) + les images dans `assets/boosters/` |
| Changer le dos de carte, le logo d'extension, la pastille | `js/config.js` (`ART`) |
| Changer les couleurs, les typos, les arrondis | `css/tokens.css` |
| Changer le nombre de cartes par booster | `js/config.js` (`PACK_SIZE`) + `makeBooster()` dans `js/booster.js` |
| Changer les taux de drop ou du godpack | `js/booster.js` (`RATES`, `GOD`) |
| Régler la durée ou les particules d'une révélation | `js/config.js` (`REVEAL`) |
| Modifier l'animation de déchirure du paquet | `showRip()` dans `js/opening.js` + bloc `Déchirure` de `css/booster.css` |
| Modifier les animations de révélation | `css/opening.css` + `doReveal()` dans `js/opening.js` |
| Changer le nombre de boosters gratuits ou le délai | `js/config.js` (`TICKET_CAP`, `INTERVAL`) |
| Accepter d'autres champs de carte | `makeCard()` dans `js/cards.js` |

## Composition d'un booster

Huit cartes, dans l'ordre de révélation (`makeBooster()`, `js/booster.js`) :

| Carte | Contenu |
|---|---|
| 1 à 3 | Commune |
| 4 | Commune ou peu commune (`RATES.SLOT4`, 50/50) |
| 5 et 6 | Peu commune |
| 7 | Essence |
| 8 | Le hit : rare, épique ou légendaire (`RATES.HIT` ≈ 79 / 17 / 4 %) |

Environ un booster sur 2 000 (`GOD`) est un **godpack** : 4 rares, 3 épiques et une légendaire en dernier. Il n'a pas d'écran à lui — la déchirure vire à l'or, puis une charge, un éclair et le lettrage *GODPACK* claquent au-dessus de la pile avant que les cartes se révèlent normalement.

### L'ouverture

Tout se joue dans **un seul écran, sans jamais remplacer le DOM** : c'est ce qui évite les coupures. `showStack()` (`js/opening.js`) monte la pile complète *et* le paquet par-dessus, puis `packOpen()` déroule la séquence :

1. Le paquet de l'écran Boosters grossit et se fond — on plonge dedans (`.pack.tear`).
2. Le paquet tremble en 3D, un trait lumineux coupe le haut, la bande se détache en dents de scie et bascule vers l'arrière en s'assombrissant (`riptop`, perspective posée par `.stackwrap`).
3. La classe `packed` est retirée : la pile, jusque-là tassée *dans* le paquet (`translateY(17%) scale(.82) rotateX(-16deg)`), revient à sa position de repos en une seule transition. Les huit cartes sortent alignées et se présentent de face pendant que le paquet vide bascule et descend hors champ.

Les délais sont dans `packOpen()`, le reste dans le bloc `Déchirure` de `css/booster.css`.

**Pas de spoiler.** La dernière carte ne reçoit sa classe de rareté que dans `doReveal()` : avant, aucune lueur colorée ne trahit ce qu'il y a dessous. À la place, `bindStack()` écrit `--tilt` sur la scène selon l'inclinaison, et la tranche de la carte s'allume en blanc quand on fait tourner la pile — le spoil devient un geste volontaire.

> `PACK_SIZE` sert à l'affichage ; c'est `makeBooster()` qui décide vraiment du contenu. Pense à changer les deux si tu touches au nombre de cartes. Les visuels de paquet fournis portent la mention imprimée « Booster de 10 cartes » : elle vient des images d'origine, pas du jeu.

## Ajouter une carte

1. Dépose son image dans `cards/` (avif, png, jpg ou webp).
2. Ajoute une entrée dans `js/cards-data.js`. Le champ `fichier` la relie à son image, et `num` fixe son numéro dans la collection.

```js
  {
    fichier: "123_R_Joueur_Rose_Mon-Joueur.avif", num: 123, nom: "Mon joueur",
    categorie: "Joueur", couleur: "Rose", rarete: "R", def: 120,
    attaques: [
      { nom: "Frappe", cout: { rose: 1, neutre: 1 }, degats: 100 }
    ],
    mot_cle: { nom: "Signature", texte: "…" }
  },
  {
    fichier: "124_C_Objet-Lien_Neutre_Mon-Objet.avif", num: 124, nom: "Mon objet",
    categorie: "Objet", sous_type: "Lien", couleur: "Neutre", rarete: "C",
    effets: [
      { texte: "Ce Joueur a +20 Attaque." }
    ]
  }
```

- **Catégories :** Joueur, Coach, Moment, Objet, Essence
- **Raretés :** ES, C, PC, R, E, L
- **Couleurs :** Rose, Orange, Jade, Violette, Jaune, Mauve, Verte, Bleue, Azur, Neutre
- **Facultatif :** `sous_type`, `mot_cle`, `ambiance`, `resilience`, et `booster: false` pour qu'une carte ne sorte jamais dans un paquet.

> Le numéro sert d'identifiant : changer le `num` d'une carte déjà collectionnée la fait repartir à zéro dans la collection. Les champs `ambiance` et `resilience` sont conservés avec la carte mais ne sont pas affichés : ils font déjà partie de l'image.

## Habillage

Les visuels de la marque vivent dans `assets/` et sont déclarés dans `js/config.js` :

- `boosters/booster-01…04.webp` — les quatre paquets. Un est tiré au sort à chaque ouverture, **sans aucun effet sur le contenu**.
- `essences/<couleur>.svg` et `essences/neutre.png` — les dix symboles d'essence, utilisés dans les filtres de collection et la fiche d'une carte. Leurs couleurs officielles sont reprises dans `COLORS` (`js/config.js`), avec un bleu légèrement éclairci pour rester lisible sur fond sombre.
- `card-back.webp` — le dos affiché quand la dernière carte se retourne.
- `extension-logo.svg` — le logo de l'extension, en haut de l'écran Boosters et sur le récap.
- `1st-edition.svg`, `pack-star.svg`, `star-pink.svg` — pastille de première édition, icône du compteur de boosters, étincelle posée sur le logo et dans les emplacements vides de la collection.
- `logo-m8.webp` — le logo du jeu, affiché en en-tête (`ART.logo`). Il est détouré sur fond transparent depuis le fichier d'origine.
- `logo.webp` et `logo-bw.svg` — le lettrage Gentle Mates d'origine, gardé comme référence si tu retouches la charte.

**La palette sort du logo.** L'orchidée `#df6de8` de l'ellipse sert de couleur de marque (onglet actif, étoile, halos) et le rose pâle `#ffd7f0` du lettrage de couleur claire. La couleur d'action est le violet `#8936ff` (dégradé vers `#a95cf2`, rebord `#57189e`) : boutons, puces sélectionnées, pastilles *NEW*, jauges. Les fonds sont un noir teinté prune plutôt qu'un gris froid. Les raretés gardent leurs couleurs propres (bleu, violet, or).

L'étoile du logo (`assets/star-pink.svg`, reprise en ligne dans `ICON.star`) sert d'icône à l'onglet Boosters et au bouton d'ouverture : c'est la seule icône pleine, les deux autres onglets restent au trait.

Les boutons, les puces et les pastilles ont un rebord plein dessous qui s'enfonce au clic (`.btn`, `.chips button`, `.rchip` dans `base.css` et `booster.css`) : c'est ce qui donne le ressenti « jeu de cartes mobile ».

## Dépendances externes

- Polices Google Fonts (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.

Aucune autre bibliothèque : tout le reste est dans le dépôt.
