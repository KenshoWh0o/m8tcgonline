# Premier Lobby

Jeu de collection de cartes façon TCG Pocket, qui tourne entièrement dans le navigateur. Les cartes sont importées par le joueur (zip d'images + fichier json), puis ouvertes en boosters.

Il n'y a ni serveur ni base de données : tout est enregistré dans le navigateur de l'appareil (IndexedDB).

## Lancer le projet

**Le plus simple :** double-clique sur `index.html`. Le jeu s'ouvre dans ton navigateur.

**Recommandé pour développer :** ouvre le dossier dans VS Code, installe l'extension *Live Server*, puis clic droit sur `index.html` › *Open with Live Server*. La page se recharge toute seule à chaque modification.

Autre option, si Node.js est installé : `npx serve .` dans le dossier, puis ouvre l'adresse affichée.

> Chaque adresse a sa propre sauvegarde. Si tu passes d'un double-clic à Live Server ou à un site en ligne, il faudra réimporter tes cartes.

## Mettre en ligne

- **Netlify Drop** (app.netlify.com/drop) : fais glisser le dossier entier, tu obtiens une adresse.
- **GitHub Pages** : pousse le dossier dans un dépôt GitHub, puis *Settings › Pages › Deploy from branch*.

## Organisation

```
premier-lobby/
├── index.html          Structure de la page + chargement des fichiers
├── css/
│   ├── tokens.css      Couleurs, typos, mode sombre (la charte)
│   ├── base.css        Fond, en-tête, navigation, boutons, formulaires, fenêtres
│   ├── cards.css       Cartes, grilles, collection
│   ├── booster.css     Écran du paquet
│   ├── opening.css     Ouverture plein écran, révélations, récap
│   ├── viewer.css      Visionneuse 3D
│   ├── lab.css         Onglet Labo
│   └── combat.css      Combat (désactivé)
├── js/
│   ├── config.js       Couleurs, raretés, réglages des révélations
│   ├── utils.js        Outils partagés
│   ├── storage.js      État global + sauvegarde
│   ├── effects.js      Lecture des textes d'effet
│   ├── render-card.js  Affichage d'une carte
│   ├── ui.js           Fenêtre modale
│   ├── fx.js           Particules
│   ├── booster.js      Tickets, taux de tirage, écran du paquet
│   ├── opening.js      Pile 3D, révélation, godpack, récap
│   ├── collection.js   Onglet Collection
│   ├── deck.js         Deck (pour le combat)
│   ├── import.js       Import zip/json, édition, design du booster
│   ├── viewer.js       Visionneuse 3D
│   ├── lab.js          Onglet Labo
│   ├── app.js          Navigation, clics, démarrage (chargé en dernier)
│   └── combat/         Moteur et interface du combat (désactivés)
└── vendor/
    └── jszip.min.js    Lecture des fichiers zip (licence MIT, voir JSZIP-LICENSE.md)
```

Les fichiers JavaScript sont des scripts classiques chargés dans l'ordre par `index.html`. Ils partagent leurs variables et fonctions. **L'ordre compte** : un fichier peut utiliser ce qui est défini dans un fichier chargé avant lui, et `app.js` doit rester en dernier.

## Où modifier quoi

| Je veux… | Fichier |
|---|---|
| Changer les couleurs ou les typos | `css/tokens.css` |
| Changer les taux de drop ou du godpack | `js/booster.js` (`RATES`, `GOD`) |
| Régler la durée ou les particules d'une révélation | `js/config.js` (`REVEAL`) |
| Modifier les animations de révélation | `css/opening.css` + `doReveal()` dans `js/opening.js` |
| Changer le nombre de boosters gratuits ou le délai | `js/config.js` (`TICKET_CAP`, `INTERVAL`) |
| Accepter d'autres champs dans le json | `makeCustom()` dans `js/import.js` |
| Ajouter un onglet | bouton dans `<nav>` (`index.html`) + une fonction `vXxx()` + le routeur `render()` dans `js/app.js` |

## Format du json

Place un fichier `.json` dans le zip, à côté des images. Chaque entrée est reliée à son image par `fichier`.

```json
[
  {"fichier":"001.png","num":1,"nom":"Mon joueur","categorie":"Joueur",
   "couleur":"Rose","rarete":"PC","def":110,
   "attaques":[{"nom":"Frappe","cout":{"rose":1,"neutre":1},"degats":100}]},
  {"fichier":"002.png","num":2,"nom":"Mon objet","categorie":"Objet",
   "couleur":"Neutre","rarete":"C","effets":[{"texte":"Ce Joueur a +20 Attaque."}]}
]
```

- **Catégories :** Joueur, Coach, Moment, Objet, Essence
- **Raretés :** ES, C, PC, R, E, L
- **Couleurs :** Rose, Orange, Jade, Violette, Jaune, Mauve, Verte, Bleue, Azur, Neutre
- **Images :** avif, png, jpg, webp

## Réactiver le combat

1. Dans `index.html`, décommente `css/combat.css` et les deux scripts `js/combat/…`.
2. Ajoute dans `<nav>` les boutons `data-tab="deck"` et `data-tab="combat"`.
3. Dans `css/base.css`, passe `nav{grid-template-columns:repeat(4,1fr)}` à `repeat(6,1fr)`.

## Dépendances externes

- Polices Google Fonts (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.
- JSZip, inclus localement dans `vendor/`.
