# Premier Lobby

Jeu de collection de cartes façon TCG Pocket, qui tourne entièrement dans le navigateur. Les 122 cartes de l'extension *Gentle Mates* sont livrées avec le jeu : on ouvre des boosters et on remplit sa collection.

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
premier-lobby/
├── index.html          Structure de la page + chargement des fichiers
├── cards/              Les images des cartes (une par carte, .avif)
├── css/
│   ├── tokens.css      Couleurs, typos, mode sombre (la charte)
│   ├── base.css        Fond, en-tête, navigation, boutons, fenêtres
│   ├── cards.css       Cartes, grilles, collection
│   ├── booster.css     Écran du paquet
│   ├── opening.css     Ouverture plein écran, révélations, récap
│   ├── viewer.css      Visionneuse 3D
│   └── lab.css         Onglet Labo
├── js/
│   ├── config.js       Nom du jeu, couleurs, raretés, réglages des révélations
│   ├── utils.js        Outils partagés
│   ├── cards-data.js   La liste des cartes de l'extension
│   ├── cards.js        Transforme cette liste en cartes du jeu
│   ├── storage.js      État global + sauvegarde de la progression
│   ├── render-card.js  Affichage d'une carte
│   ├── ui.js           Fenêtre modale
│   ├── fx.js           Particules
│   ├── booster.js      Tickets, taux de tirage, écran du paquet
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
| Mettre une image sur le booster | `js/config.js` (`PACK_ART`) |
| Changer les couleurs ou les typos | `css/tokens.css` |
| Changer les taux de drop ou du godpack | `js/booster.js` (`RATES`, `GOD`) |
| Régler la durée ou les particules d'une révélation | `js/config.js` (`REVEAL`) |
| Modifier les animations de révélation | `css/opening.css` + `doReveal()` dans `js/opening.js` |
| Changer le nombre de boosters gratuits ou le délai | `js/config.js` (`TICKET_CAP`, `INTERVAL`) |
| Accepter d'autres champs de carte | `makeCard()` dans `js/cards.js` |

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

## Dépendances externes

- Polices Google Fonts (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.

Aucune autre bibliothèque : tout le reste est dans le dépôt.
