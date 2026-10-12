# Mate TCG Online

Jeu de collection de cartes façon TCG Pocket. Les 122 cartes de l'extension *Tout commence ici* sont livrées avec le jeu : on ouvre des boosters, on remplit sa collection, et on échange avec les autres joueurs.

Le site est fait de fichiers statiques — aucune étape de compilation, aucun paquet à installer. Il fonctionne dans **deux régimes** :

- **Hors ligne.** Rien à configurer : la progression est enregistrée dans le navigateur de l'appareil (IndexedDB). **Ce régime n'est plus proposé aux joueurs : on ne joue qu'en se connectant avec Discord** (`porteVisible()`, `js/auth.js`). Sans serveur joignable, le site affiche l'écran de connexion avec « Réessayer ». Il n'y a plus de « jouer sans compte ».
- **En ligne.** Un projet [Supabase](https://supabase.com) gratuit apporte les comptes, la collection sauvegardée sur le compte, un cooldown que la montre du téléphone ne peut pas tromper, les échanges, les quêtes et la boutique. Marche à suivre : **[SETUP.md](SETUP.md)**.

La connexion se fait **par Discord**, en un clic : le public du jeu y est déjà, le pseudo et l'avatar arrivent tout faits, et surtout aucun courriel n'est envoyé — donc aucun joueur bloqué faute d'avoir reçu son lien. L'inscription par adresse existe dans le code et se rouvre en passant `email` à `true` dans `CONNEXION` (`js/config.js`).

Le jeu bascule tout seul : tant que `js/supabase-config.js` est vide, il tourne hors ligne.

> **Rien ne se paie avec de l'argent réel.** La monnaie du jeu, les *Éclats*, se gagne uniquement en accomplissant des quêtes.

## Lancer le projet

**Le plus simple :** double-clique sur `index.html`. Le jeu s'ouvre dans ton navigateur.

**Recommandé pour développer :** ouvre le dossier dans VS Code, installe l'extension *Live Server*, puis clic droit sur `index.html` › *Open with Live Server*. La page se recharge toute seule à chaque modification.

Autre option, si Node.js est installé : `npx serve .` dans le dossier, puis ouvre l'adresse affichée.

> Chaque adresse a sa propre sauvegarde. Si tu passes d'un double-clic à Live Server ou à un site en ligne, tes cartes sont toujours là, mais la progression repart de zéro.

## Mettre en ligne

- **GitHub Pages** : pousse le dossier dans un dépôt GitHub, puis *Settings › Pages › Deploy from branch*.
- **Netlify Drop** (app.netlify.com/drop) : fais glisser le dossier entier, tu obtiens une adresse.

Le service worker et l'installation sur l'écran d'accueil exigent **HTTPS** (ou `localhost`). Un fichier ouvert par double-clic marche, mais sans mode hors ligne ni installation.

Pour brancher les comptes en ligne : **[SETUP.md](SETUP.md)**, écrit pas à pas. Et à tout moment, la page **`verif.html`** du site contrôle l'installation et dit en clair ce qui manque.

## Organisation

```
mate-tcg-online/
├── index.html          Structure de la page + chargement des fichiers
├── verif.html          Page de diagnostic : ce qui est branché, ce qui manque
├── manifest.webmanifest  Identité de l'application installée (nom, icônes, couleurs)
├── sw.js               Service worker : le jeu s'ouvre hors réseau
├── SETUP.md            Mettre le jeu en ligne, pas à pas
├── cards/              Les images des cartes (une par carte, .avif)
├── assets/             Habillage : logos, visuels de booster, dos de carte, essences
│   ├── boosters/       Les quatre visuels de paquet
│   ├── essences/       Les dix symboles d'essence
│   ├── icon-*.png      Icônes de l'application installée (générées)
│   └── og-image.png    Image affichée quand le lien du site est partagé (générée)
├── presse/             Kit presse : visuels prêts à publier et leur mode d'emploi
├── _demo/              La démo autonome : faux serveur, réglages, mode d'emploi (non publié)
├── tools/              Petits scripts de maintenance (Python, sans dépendance)
│   ├── build-sql.py    Assemble supabase/TOUT.sql
│   ├── demo.py         Fabrique la démo autonome dans _build/
│   ├── version.py      Pose le numéro de version et marque les fichiers
│   ├── gen-icons.py    Régénère icônes, favicons et image de partage
│   └── kit-presse.py   Régénère les visuels de presse/visuels/
├── supabase/           Tout le code serveur : tables, sécurité, actions du jeu
│   ├── TOUT.sql        Les fichiers d'installation ci-dessous, en un seul (assemblé)
│   ├── 01_schema.sql   Tables, règles d'accès, recharge des boosters
│   ├── 02_cards.sql    Catalogue des cartes (généré depuis js/cards-data.js)
│   ├── 03_rpc.sql      Ouvrir un booster, échanger, encaisser une quête, acheter
│   ├── 03b_promos.sql  Les cartes Promo et leurs paliers de collection
│   ├── 04_seed.sql     Quêtes et boutique — c'est ici qu'on équilibre
│   ├── 06_social.sql   Amis et fiches de joueur
│   ├── 07_vitrine.sql  La vitrine du profil
│   ├── 11_boite.sql    Boîte de réception : notifications, annonces, temps réel
│   ├── 12_recyclage.sql  Recyclage des doublons en Fragments, et fabrication
│   ├── 13_maj-recyclage-quetes.sql  Mise à jour d'une base déjà installée (28 sept.)
│   ├── 14_classement.sql  Le classement global
│   ├── 15_evenements.sql  Tirages, succès, événements et chasse à la carte unique
│   ├── 16_maj-v1.5.sql   Mise à jour 1.5 d'une base déjà installée
│   ├── 17_maj-quetes.sql Mise à jour 1.5.3 : quêtes rééquilibrées, carte unique en dernière carte
│   ├── 18_cadeaux.sql    Les cadeaux offerts par un administrateur (aussi dans TOUT.sql)
│   ├── 19_maj-boosters-offerts.sql  Mise à jour 1.5.5 : boosters offerts sans carte unique
│   ├── 20_maj-boosters-hors-reserve.sql  Mise à jour 1.5.6 : boosters achetés et offerts hors réserve, cadre Unique
│   ├── 22_garder.sql     Version 2.1 : les exemplaires à garder (aussi dans TOUT.sql)
│   ├── 05_admin.sql    Se donner les droits d'administrateur
│   ├── 08_reset-profil.sql  Remettre un seul joueur à zéro
│   ├── 10_reset-tout.sql    Remettre tous les comptes à zéro (lancement)
│   └── gen-cards-sql.py  Régénère 02_cards.sql
├── css/
│   ├── tokens.css      Couleurs, typos, rythme (la charte)
│   ├── base.css        Fond, en-tête, navigation, boutons, fenêtres
│   ├── cards.css       Cartes, symboles d'essence, grille de collection
│   ├── booster.css     Écran du paquet et animation d'ouverture
│   ├── opening.css     Ouverture plein écran, révélations, récap
│   ├── viewer.css      Visionneuse 3D
│   ├── lab.css         Onglet Labo
│   ├── auth.css        Écran de connexion
│   ├── promo.css       Scène d'obtention d'une carte Promo
│   └── hub.css         En-tête, navigation, et les écrans autour du jeu
├── js/
│   ├── config.js       Nom du jeu, habillage, couleurs, raretés, onglets, révélations
│   ├── supabase-config.js  Les deux clés du compte en ligne (vides = hors ligne)
│   ├── utils.js        Outils partagés
│   ├── sfx.js          Les sons, fabriqués à la volée (Web Audio)
│   ├── cards-data.js   La liste des cartes de l'extension
│   ├── promos-data.js  Les cartes Promo, hors extension
│   ├── cards.js        Transforme ces listes en cartes du jeu
│   ├── storage.js      État global + sauvegarde locale
│   ├── render-card.js  Affichage d'une carte
│   ├── ui.js           Fenêtre modale, avatars, petits blocs répétés
│   ├── backend.js      Un seul jeu d'appels, deux implantations (local / en ligne)
│   ├── gate.js         Écran d'attente et code d'accès
│   ├── auth.js         Écran de connexion et création de compte
│   ├── fx.js           Particules
│   ├── booster.js      Réserve, composition d'un booster, écran du paquet en 3D
│   ├── opening.js      Pile 3D, révélation, godpack, récap
│   ├── collection.js   Onglet Collection
│   ├── viewer.js       Visionneuse 3D
│   ├── trade.js        Échanges (section de Social)
│   ├── social.js       Onglet Social : amis, fiches de joueur
│   ├── quests.js       Onglet Quêtes
│   ├── classement.js   Onglet Classement (menu du compte)
│   ├── tirages.js      Onglet Mes tirages : historique et statistiques
│   ├── partage.js      Image de partage d'un booster
│   ├── promos.js       Détection et mise en scène des cartes Promo
│   ├── boite.js        Boîte de réception, pings, relève et temps réel
│   ├── shop.js         Onglet Boutique
│   ├── recyclage.js    Onglet Recyclage
│   ├── battle.js       Onglet Combats (à venir)
│   ├── profile.js      Onglet Profil
│   ├── settings.js     Onglet Réglages
│   ├── bienvenue.js    Fenêtres d'accueil et lien vers le Discord
│   ├── pwa.js          Ajout à l'écran d'accueil, service worker
│   ├── lab.js          Onglet Labo (administrateurs)
│   ├── cadeaux.js      Les cadeaux : le paquet à ouvrir
│   └── app.js          Navigation, clics, démarrage (chargé en dernier)
```

Les fichiers JavaScript sont des scripts classiques chargés dans l'ordre par `index.html`. Ils partagent leurs variables et fonctions. **L'ordre compte** : un fichier peut utiliser ce qui est défini dans un fichier chargé avant lui, et `app.js` doit rester en dernier.

Chaque feuille de style porte aussi ses propres règles d'adaptation — téléphone, écran court, ordinateur. Une règle qui concerne l'écran Boosters vit dans `booster.css`, y compris quand elle ne s'applique qu'au mobile : chercher à deux endroits pour comprendre un écran, c'est ainsi qu'on finit par en corriger un seul.

## Où modifier quoi

| Je veux… | Fichier |
|---|---|
| Ajouter, retirer ou corriger une carte | `js/cards-data.js` (+ l'image dans `cards/`) |
| Changer le nom du jeu ou de l'extension | `js/config.js` (`GAME_NAME`, `SET_NAME`) |
| Changer les visuels de booster | `js/config.js` (`PACK_ARTS`) + les images dans `assets/boosters/` |
| Changer le dos de carte, le logo d'extension, la pastille | `js/config.js` (`ART`) |
| Changer les couleurs, les typos, les arrondis | `css/tokens.css` |
| Changer le nombre de cartes par booster | `js/config.js` (`PACK_SIZE`) + `makeBooster()` dans `js/booster.js` |
| Changer les taux de drop ou du godpack | **en ligne :** `open_pack()` dans `supabase/03_rpc.sql` · **hors ligne :** `RATES`, `GOD` dans `js/booster.js` |
| Ajouter ou modifier une carte Promo | `js/promos-data.js` (+ l'image dans `cards/promos/`) **et** `supabase/03b_promos.sql` |
| Changer le palier qui donne une Promo | `PROMO_PALIER` dans `js/config.js` **et** `cfg('promo_palier_pct')` dans `supabase/01_schema.sql` |
| Changer le thème par défaut | `poserTheme()` dans `js/settings.js` ; les deux palettes sont dans `css/tokens.css` |
| Annoncer une Promo pas encore livrée | `PROMOS_A_VENIR` dans `js/config.js` |
| Refaire les visuels de promotion | `python3 tools/kit-presse.py` — voir `presse/README.md` |
| **Remettre à zéro tous les joueurs** | `supabase/10_reset-tout.sql` |
| Régler la durée ou les particules d'une révélation | `js/config.js` (`REVEAL`) |
| Modifier l'animation de déchirure du paquet | `showRip()` dans `js/opening.js` + bloc `Déchirure` de `css/booster.css` |
| Modifier les animations de révélation | `css/opening.css` + `doReveal()` dans `js/opening.js` |
| Changer le nombre de boosters gratuits ou le délai | **en ligne :** `cfg()` dans `supabase/01_schema.sql` · **hors ligne :** `TICKET_CAP`, `INTERVAL` dans `js/config.js` |
| Ajouter, retirer ou régler une quête | `supabase/04_seed.sql` |
| Publier une annonce à tous les joueurs | Labo › *Annonce à tous les joueurs*, ou à la main en bas de `supabase/11_boite.sql` |
| Changer les prix ou les articles de la boutique | `supabase/04_seed.sql` |
| Ouvrir le site au public | `PORTE.active` dans `js/gate.js` |
| Modifier la mention légale | `MENTIONS` dans `js/config.js` (elle s'affiche aux trois endroits d'un coup) |
| Changer l'adresse du Discord | `DISCORD_URL` dans `js/config.js` (elle est citée à cinq endroits) |
| Inviter quelqu'un à la bêta | `supabase/09_beta.sql` |
| Changer la date d'ouverture | `beta_lancement()` dans `supabase/01_schema.sql` — et nulle part ailleurs |
| Ouvrir ou fermer une méthode de connexion | `CONNEXION` dans `js/config.js` (+ le fournisseur correspondant dans Supabase) |
| Ajouter ou déplacer un onglet | `TABS` dans `js/config.js` (`bas` = barre du bas, `hub` = page « Plus ») |
| Modifier un son | la recette correspondante dans `RECETTES`, `js/sfx.js` |
| Regénérer l'image de partage et les icônes | `python3 tools/gen-icons.py` |
| Donner les droits d'administrateur | `supabase/05_admin.sql` |
| Changer ce que rapporte le recyclage, ou le coût d'une carte fabriquée | `cfg()` dans `supabase/01_schema.sql` (clés `recyclage_*` et `fabrication_*`) |
| Changer la fréquence des Essences Brillantes ou de la carte unique | `cfg('foil_odds')`, `cfg('chasse_odds')` dans `supabase/01_schema.sql` (+ `FOIL_ODDS` dans `js/config.js` pour le Labo) |
| Lancer un événement, ouvrir la chasse | requêtes en bas de `supabase/15_evenements.sql` |
| Ajouter ou modifier un succès | `succes_de()` dans `supabase/15_evenements.sql` **et** `SUCCES` dans `js/config.js` |
| Changer les critères du classement | `classement()` dans `supabase/14_classement.sql` + `CRITERES` dans `js/classement.js` |
| Fabriquer la démo autonome à envoyer | `python3 tools/demo.py` — voir « La démo autonome » |
| Régler la démo (pseudo, Éclats de départ, recharge) | `_demo/reglages.js` |
| Accepter d'autres champs de carte | `makeCard()` dans `js/cards.js` |

## La démo autonome

Une version du jeu **entière, sans compte ni serveur**, à envoyer en fichier : boosters, collection, quêtes, boutique, recyclage, profil, amis, échanges et boîte de réception. Tout est enregistré dans le navigateur de celui qui l'ouvre.

```
python3 tools/demo.py
```

produit `_build/m8tcg-demo/` (ouvrir `index.html`) et `_build/m8tcg-demo.zip` à envoyer. `_build/` n'est pas versionné.

**Comment ça marche.** Le jeu ne parle au serveur que par le client Supabase (`Backend.sb`). La démo remplace la bibliothèque Supabase par un faux client (`_demo/serveur.js`) qui répond aux mêmes appels avec les mêmes réponses : chaque fonction y est la traduction de sa jumelle SQL, citée en commentaire. Le code du jeu est copié tel quel : **rien ne change sur le site**, et le site ne contient pas la démo — GitHub Pages ne publie pas les dossiers qui commencent par `_`.

**Les autres joueurs sont simulés** : Lumen et Mira sont amis dès le départ, Kairo envoie une demande d'ami peu après l'arrivée, Nova.92 attend qu'on l'ajoute. Ils acceptent les demandes d'ami, répondent aux échanges (le premier est toujours accepté s'il est possible, les suivants trois fois sur quatre) et proposent des échanges de temps en temps.

> **À garder synchronisé.** Les quêtes, la boutique, les taux de drop, `cfg()` et les règles des actions sont recopiés dans `_demo/serveur.js`. Quand ils changent dans `supabase/`, il faut les changer là aussi, puis relancer `tools/demo.py`. Le script s'arrête avec un message clair si `index.html` ou `sw.js` ont changé au point qu'il ne s'y retrouve plus.

Pour repartir de zéro dans la démo : ajouter `?reinitialiser` à la fin de l'adresse.

## Composition d'un booster

Six cartes, dans l'ordre de révélation (`makeBooster()`, `js/booster.js`) :

| Carte | Contenu |
|---|---|
| 1 et 2 | Commune |
| 3 | **Peu commune garantie** |
| 4 | Essence — Brillante une fois sur 50 |
| 5 | **Une Reverse** (version 2.0) : Commune 50 %, Peu commune 35 %, Rare 15 % (`RATES.REVERSE`) |
| 6 | Le hit : rare, épique, légendaire ou secrète (`RATES.HIT` = 79 / 16 / 4,25 / 0,75 %, version 3.0 ; avant : 80 / 16 / 4) |

Environ un booster sur 2 000 (`GOD`) est un **godpack** : 5 rares, 4 épiques et une légendaire en dernier. Rien ne l'annonce, ni écran, ni mot : voir plus bas.

> Ces taux existent à deux endroits : `open_pack()` dans `supabase/03_rpc.sql` (le vrai tirage) et `RATES` dans `js/booster.js` (les ouvertures de test du Labo). Les garder identiques, sinon le Labo ment sur ce qu'il montre.

### L'ouverture

Tout se joue dans **un seul écran, sans jamais remplacer le DOM** : c'est ce qui évite les coupures. `showStack()` (`js/opening.js`) monte la pile complète *et* le paquet par-dessus, puis `packOpen()` déroule la séquence :

1. Le paquet de l'écran Boosters grossit et se fond — on plonge dedans (`.pack.tear`).
2. Le paquet tremble en 3D, un trait lumineux coupe le haut, la bande se détache en dents de scie et bascule vers l'arrière en s'assombrissant (`riptop`, perspective posée par `.stackwrap`).
3. La classe `packed` est retirée : la pile, jusque-là tassée *dans* le paquet (`translateY(11%) scale(.82) rotateX(-16deg)`, calée pour que le bas des cartes ne dépasse jamais sous le sachet), revient à sa position de repos en une seule transition. Les six cartes sortent alignées et se présentent de face pendant que le paquet vide bascule et descend hors champ.

Les délais sont dans `packOpen()`, le reste dans le bloc `Déchirure` de `css/booster.css`.

**Pas de spoiler.** La dernière carte ne reçoit sa classe de rareté que dans `doReveal()` : avant, aucune lueur colorée ne trahit ce qu'il y a dessous. À la place, `bindStack()` écrit `--tilt` sur la scène selon l'inclinaison, et la tranche de la carte s'allume en blanc quand on fait tourner la pile — le spoil devient un geste volontaire.

### Le godpack

Il n'a ni écran, ni lettrage, ni surbrillance carte par carte : **c'est la lumière qui le raconte**, dans la même séquence que n'importe quelle ouverture.

1. Le paquet reste normal, mais `packOpen()` lui accorde 860 ms de plus (`rip-wake`) : l'image s'assombrit (`goddim`), la couture du haut s'allume de plus en plus (`leakwake`) et le tremblement monte (`godtremble`). On sent qu'il y a quelque chose dedans, sans savoir quoi.
2. À la déchirure, la couture explose (`leakflash`) et un faisceau s'échappe par la fente (`.rp-beam`) : un trapèze découpé en `clip-path`, flouté et masqué en radial, qui s'évase vers le haut — un cône de lumière, pas un bloc. La classe `lit` arrive en même temps : la nappe dorée (`.godwash`) inonde la scène, les rayons lents (`.godaura`) apparaissent, la pile prend son halo.
3. Les cartes sortent dans cette lumière et la pluie d'étincelles se relance à mi-parcours pour qu'elle ne s'arrête jamais net.

Dans un godpack, `announce()` **n'ajoute pas** la surbrillance de rareté carte par carte : toutes les cartes sont des hits, les éclairs bleus et violets ne feraient que brouiller l'or. Seule la légendaire finale garde sa révélation complète.

> `PACK_SIZE` sert à l'affichage ; c'est `makeBooster()` qui décide vraiment du contenu — et, en ligne, `open_pack()` dans `supabase/03_rpc.sql`, qui seul fait foi. Les trois doivent bouger ensemble. Les visuels de paquet portent la mention imprimée « Booster de 6 cartes » : si le nombre change, il faut refaire les images, sinon le paquet ment sur ce qu'il contient.

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

### Les Secrètes

Version 3.0. Cinq cartes numérotées après l'extension (#123 à #127), **hors du total** : la barre de progression reste sur 122. Deux sont révélées, trois encore floutées : elles existent, se tirent et s'échangent, mais leur texte arrivera plus tard (`cachee` dans `SECRET_DATA`, `js/promos-data.js` ; `buildSecretes()`, `js/cards.js`). Rareté `S`, tirées à la place du hit une fois sur 133 (0,75 %). Elles s'échangent contre une autre Secrète, mais ne se recyclent ni ne se fabriquent. Côté serveur, ce sont des lignes de `cards` marquées `promo` (hors des 122) et `secrete` (échangeables), créées par `supabase/24_secretes_maitrise.sql`. Quand une Secrète floutée est révélée : remplir sa fiche dans `SECRET_DATA`, retirer `cachee`, poser son image dans `cards/`, et mettre son nom à jour dans le SQL.

> Le numéro sert d'identifiant : changer le `num` d'une carte déjà collectionnée la fait repartir à zéro dans la collection. Les champs `ambiance` et `resilience` sont conservés avec la carte mais ne sont pas affichés : ils font déjà partie de l'image.

## Habillage

Les visuels de la marque vivent dans `assets/` et sont déclarés dans `js/config.js` :

- `boosters/booster-01…04.webp` — les quatre paquets, 337 × 460, recadrés au ras du plastique. Un est tiré au sort à chaque ouverture, **sans aucun effet sur le contenu**. Leurs proportions sont reprises à la main dans `css/booster.css` (`aspect-ratio` de `.pack` et de `.packrip`, et le facteur du `calc()` qui plafonne la largeur) : remplacer les images sans toucher à ces trois valeurs laisserait le paquet flotter dans une boîte qui n'est plus la sienne.
- `essences/<couleur>.svg` et `essences/neutre.png` — les dix symboles d'essence, utilisés dans les filtres de collection et la fiche d'une carte. Leurs couleurs officielles sont reprises dans `COLORS` (`js/config.js`), avec un bleu légèrement éclairci pour rester lisible sur fond sombre.
- `card-back.webp` — le dos affiché quand la dernière carte se retourne.
- `extension-logo.svg` — le logo de l'extension, en haut de l'écran Boosters et sur le récap.
- `1st-edition.svg`, `pack-star.svg`, `star-pink.svg` — pastille de première édition, icône du compteur de boosters, étincelle posée sur le logo et dans les emplacements vides de la collection.
- `logo-m8.webp` — le logo du jeu, affiché en en-tête (`ART.logo`). Il est détouré sur fond transparent depuis le fichier d'origine.
- `logo.webp` et `logo-bw.svg` — le lettrage Gentle Mates d'origine, gardé comme référence si tu retouches la charte.

**Une seule couleur d'interface : le violet.** Boutons, onglet actif, puces sélectionnées, pastilles *NEW*, jauges de recharge et de collection, halos de fond — tout est en `--accent` `#8936ff` / `--accent-soft` `#a95cf2`, avec le rebord `#57189e` sous les éléments pressables. L'orchidée `#df6de8` et le rose pâle `#ffd7f0` du logo ne servent plus qu'au logo lui-même. Les fonds sont un noir teinté prune. Les raretés gardent leurs couleurs propres (bleu, violet, or).

L'étoile du logo (`assets/star-pink.svg`, reprise en ligne dans `ICON.star`) sert d'icône à l'onglet Boosters et au bouton d'ouverture : c'est la seule icône pleine, les deux autres onglets restent au trait.

Les boutons, les puces et les pastilles ont un rebord plein dessous qui s'enfonce au clic (`.btn`, `.chips button`, `.rchip` dans `base.css` et `booster.css`) : c'est ce qui donne le ressenti « jeu de cartes mobile ».

## Les onglets

Ils sont décrits dans `TABS` (`js/config.js`), sur deux niveaux : ce qu'on joue, et ce qui concerne le compte.

| Onglet | Où | Compte requis |
|---|---|---|
| Boosters | barre du bas / rail | non |
| Collection | barre du bas / rail | non |
| Combats | barre du bas / rail | non |
| Social | barre du bas / rail | oui |
| Quêtes | barre du bas / rail | oui |
| Mon profil | tiroir (mobile) · rail (ordinateur) | oui |
| Boutique | tiroir (mobile) · rail (ordinateur) | oui |
| Recyclage | tiroir (mobile) · rail (ordinateur) | oui |
| Réglages | tiroir (mobile) · rail (ordinateur) | non |
| Labo | tiroir · rail | **administrateurs seulement** |
| Boîte de réception | la cloche de l'en-tête | oui |

Pour déplacer un onglet, il suffit de changer son drapeau : `bas: true` le met dans la barre du bas, `tiroir: true` le range dans le menu du compte.

**La barre du bas ne contient que le jeu.** Cinq places, pas une de plus — les cinq endroits où l'on revient tout le temps. Une pastille y signale ce qui attend : récompenses à encaisser sur Quêtes, demandes d'ami et d'échange sur Social.

**Le compte vit dans un tiroir.** Sur mobile, appuyer sur son avatar déplie un panneau depuis le bord droit — celui d'où vient le doigt : pseudo, ressources, profil, boutique, réglages, déconnexion. Un point sur l'avatar prévient quand quelque chose y attend.

**Sur ordinateur, il n'y a pas de tiroir** : le rail a la place d'afficher les deux groupes, séparés par un filet, et l'avatar mène directement au profil. Inutile de cacher derrière un menu ce qui tient à l'écran.

**Mobile d'abord.** La barre du bas tient cinq onglets au pouce ; à partir de 900 px de large elle devient un rail vertical à droite, et les feuilles modales se centrent au lieu de monter du bas. Toute l'adaptation ordinateur tient dans un seul bloc `@media` en bas de `css/hub.css`.

Sur ordinateur, la page est une **grille** (en-tête sur toute la largeur, puis contenu et rail), et non un flex qui passe à la ligne : avec `flex-wrap`, le navigateur répartit la hauteur restante entre les lignes, et l'en-tête s'allongeait dès qu'une page avait peu de contenu. Le contenu se **centre** dans la colonne qui lui reste : collé contre le rail, il donnait l'impression d'une page décalée d'un côté.

> Ces règles de largeur portent sur `#main > *`, et non sur `main > *`. Une classe comme `.pagehead` pose un `margin` raccourci, qui l'emporte sur un sélecteur d'éléments seuls — le titre d'une page se recollait alors à gauche pendant que les panneaux restaient centrés.

> Les règles de la barre du bas sont accrochées à `#nav`, jamais à l'élément `<nav>` : le panneau du tiroir en est un aussi, et héritait sinon de sa mise en colonne.

**L'en-tête montre toujours les deux compteurs et l'avatar**, même hors ligne. Ce sont les seules portes vers la boutique et vers le menu du compte : les cacher revenait à cacher qu'ils existent. Avec un compte, **la cloche** s'y ajoute : c'est l'entrée de la boîte de réception (voir plus bas).

**Les icônes.** Collection : trois cartes en éventail, l'étoile du logo sur celle du dessus — le classeur à pochettes d'avant se lisait comme un tableur. Combats : deux épées croisées complètes, lame, garde et pommeau ; l'ancienne n'en gardait que les pointes et ressemblait à un blason vide.

## Les avatars des autres joueurs

Choisir « Discord » comme avatar n'enregistre pas la photo chez nous : on stocke le
mot `discord`, et l'adresse réelle se lit dans la session ouverte. C'est ce qui fait
qu'une photo changée sur Discord se met à jour toute seule, sans rien à resynchroniser.

**Mais un navigateur n'a qu'une session : la sienne.** En dessinant la liste d'amis, il
résolvait donc `discord` avec la photo de *celui qui regarde* — et tous les joueurs
ayant choisi cet avatar portaient le visage du spectateur.

La photo est désormais une donnée comme une autre : le serveur la joint au profil qu'il
renvoie (`photo_discord()` dans `supabase/01_schema.sql`, appelée par `friend_list`,
`player_profile`, `trade_list` et `find_player`). Elle ne rend que l'adresse de l'image,
rien d'autre de `auth.users`, et seulement pour des joueurs dont le jeu montrait déjà le
pseudo et l'avatar.

Côté navigateur, `avatarHTML(avatar, cadre, taille, photo)` prend la photo en quatrième
argument. **Il n'y a aucun repli sur la session en cours** : sans adresse, on dessine
l'étoile. C'est délibéré — un avatar générique se remarque et se corrige, le visage de
quelqu'un d'autre passe inaperçu et trompe. `maPhoto()` marque explicitement les endroits
où l'on se dessine soi-même.

## Social

Les échanges vivent dans l'onglet **Social**, pas à côté : on n'échange pas avec un inconnu. On cherche quelqu'un par son pseudo, on l'ajoute, on regarde ce qu'il possède, puis on propose.

**Les amis.** Une demande part vers un pseudo, l'autre accepte ou refuse. La table `friendships` range chaque paire dans un ordre stable (`a < b`), ce qui rend impossible deux amitiés croisées entre les mêmes personnes — et une demande envoyée à quelqu'un qui t'avait déjà demandé vaut acceptation.

**La fiche d'un joueur** montre ses compteurs à tout le monde, mais sa collection **seulement entre amis**. On y voit ses doublons : les cartes qu'il a en plusieurs exemplaires, donc celles qu'il peut céder sans se démunir. C'est ce qui permet de viser un échange qui a une chance d'aboutir.

**Les échanges.** Une carte contre une carte, **de rareté identique**, et jamais en simultané : quelqu'un propose, l'autre répond quand il veut, et l'échange ne se fait que si les deux ont validé.

**L'écran des échanges ne dit que ce que les cartes ne disent pas.** Une illustration porte déjà son nom et sa rareté, et un toucher l'ouvre en grand : les trois lignes de texte qu'on empilait sous chaque vignette sont parties. Il reste une étiquette posée sur la carte — combien *j'en ai* : « Nouvelle » si aucune, « Dernière » si je donne mon seul exemplaire — et une légende dessous, « Tu reçois » ou « Tu donnes ». Partout le même ordre, dans les demandes comme dans la composition : à gauche ce qu'on reçoit, à droite ce qu'on donne. La composition tient en trois blocs (avec qui, quoi contre quoi, un mot) et une seule phrase d'aide, celle de l'étape où l'on en est ; la première carte choisie, d'un côté ou de l'autre, fixe la rareté. L'historique est une liste d'une ligne par échange.

Le coût est payé par celui qui lance la demande : **une demande gratuite toutes les 6 heures**, ou un **jeton d'échange** acheté en boutique pour ne pas attendre. Une barre de recharge le montre en haut de la section. Le délai et le jeton sont vérifiés par le serveur, pas par la page.

Au moment où la demande est acceptée, le serveur revérifie **tout** : que les deux joueurs possèdent encore leur carte, que les raretés correspondent toujours, et il échange les deux cartes dans une seule transaction. Personne ne peut donner deux fois la même carte en lançant deux demandes.

## La boîte de réception

Tout ce qui arrive des autres — demande d'ami, demande d'échange, réponse à ses propres demandes — et les annonces publiées pour tout le monde. On l'ouvre par **la cloche de l'en-tête** : ce qui arrive ne concerne pas un onglet en particulier, et l'en-tête est la seule bande visible sur tous les écrans.

**C'est le serveur qui écrit.** Avant, le navigateur comparait deux listes successives pour deviner ce qui était nouveau : une demande d'ami n'était jamais annoncée, et rien de ce qui arrivait pendant qu'on était ailleurs ne l'était non plus. Désormais `friend_request`, `friend_respond`, `trade_create` et `trade_respond` écrivent l'événement dans la boîte du destinataire (`notifier()`, `supabase/11_boite.sql`), au moment où il a lieu.

**Le ping.** Quand quelque chose arrive : la cloche prend une pastille et le titre de l'onglet un « (2) » ; deux notes courtes et une vibration brève ; une carte passe en haut de l'écran avec le visage de celui qui écrit, et la toucher mène là où l'on répond. Rien ne passe pendant l'ouverture d'un paquet ou la scène d'une Promo : les nouveautés attendent la fin. Onglet en arrière-plan, la boîte est quand même relevée — le « (2) » du titre et la pastille de l'icône installée servent justement là — et le bandeau part au retour.

**Deux voies d'arrivée.** Le temps réel de Supabase pousse une ligne dès qu'elle est écrite ; une relève toutes les trente secondes prend le relais s'il ne répond pas. On ne dépend jamais de lui.

**Lu ou non lu** tient en une date par joueur, `profiles.boite_vue_le` : tout ce qui est plus récent est nouveau. Ouvrir la boîte, c'est tout lire. Les demandes d'ami s'y acceptent directement ; une demande d'échange mène à l'onglet Social.

**Les annonces** se publient depuis le Labo (réservé aux administrateurs, et vérifié par le serveur), ou à la main dans le SQL Editor — la requête est en bas de `supabase/11_boite.sql`. On les retire depuis sa propre boîte. Un mois d'historique est gardé, pas plus.

## Le classement

Un classement **global** : tous les joueurs, pas seulement les amis. On l'ouvre depuis le menu du compte. Quatre sous-onglets :

| Critère | Ce qui est compté |
|---|---|
| Collection | Cartes différentes de l'extension, sur 122 (les Promos n'y entrent pas, comme partout) |
| Boosters | Boosters ouverts depuis le début |
| Échanges | Échanges conclus |
| Série | Jours de connexion d'affilée **en cours** : une série dont le dernier jour est avant-hier compte zéro |

Le serveur fait tout le calcul (`classement()`, `supabase/14_classement.sql`) et renvoie les cinquante premiers, plus la ligne du joueur qui regarde s'il est plus bas. Les ex æquo partagent leur rang ; un joueur à zéro n'est pas classé. Tant que le jeu est fermé au public, seuls les comptes invités apparaissent. D'un joueur, on ne voit que ce que le jeu montrait déjà à tout le monde : pseudo, avatar, cadre, et le chiffre du critère. Une ligne se touche pour ouvrir sa fiche.

## Le recyclage et la fabrication

Les doublons deviennent des **Fragments**, et les Fragments **fabriquent une carte qui manque**. Toutes les raretés de l'extension se recyclent et se fabriquent ; jamais ce qui est hors extension (Promos, Essences Brillantes, carte unique). **On garde toujours un exemplaire** de chaque carte : recycler ne fait jamais reculer la collection. Et depuis la version 2.1, **autant d'exemplaires qu'on a choisi d'en garder** (voir plus bas). Les exemplaires proposés dans une demande d'échange encore en attente sont mis de côté — sinon l'échange, une fois accepté, prendrait le dernier.

| Rareté | Recycler rapporte | Fabriquer coûte |
|---|---|---|
| Essence | 1 | 20 |
| Commune | 2 | 40 |
| Peu commune | 5 | 100 |
| Rare | 20 | 400 |
| Épique | 80 | 2 000 |
| Légendaire | 250 | 8 000 |

**Pourquoi des Fragments, et plus d'Éclats.** Recycler contre des Éclats n'avait pas de bon réglage : un joueur régulier produit ~6 300 Éclats de doublons par semaine une fois sa collection avancée. Plafonné, le recyclage ne permettait pas de se débarrasser de ses cartes ; déplafonné, il triplait les Éclats, qui rachètent des boosters. Les Fragments n'achètent qu'une carte manquante : aucune boucle possible, donc **plus de plafond**.

**Ils règlent aussi la fin de collection.** Quand il ne manque qu'une Légendaire, elle met ~42 jours à sortir en moyenne, sans progrès visible. Avec la fabrication, chaque booster plein de doublons la rapproche : ~2 200 Fragments par semaine pour un joueur régulier, soit une Épique tous les six jours ou une Légendaire en un peu moins de quatre semaines. Simulation, médiane du temps pour finir l'extension : 92 → 62 jours pour un joueur à 120 boosters, et 124 → 73 jours pour le quart le plus malchanceux. Le calcul est en tête de `supabase/12_recyclage.sql`.

**On fabrique depuis la Collection** : une case vide se touche, une fiche montre la carte, son prix et le solde qui restera. Seulement une carte qu'on ne possède pas (`fabriquer()`).

**Pas de bêtise.** On choisit carte par carte, exemplaire par exemplaire ; « Tout sélectionner » laisse les Épiques et les Légendaires de côté. Un récapitulatif liste chaque carte et ce qu'elle rapporte — avec une case à cocher s'il y a une Épique ou une Légendaire dedans —, puis une dernière confirmation dont le bouton ne répond qu'au bout de trois secondes. Le serveur revérifie tout (doublons, réservations) et refuse l'envoi entier si un seul point ne tient pas. Chaque recyclage est journalisé dans la table `recyclages`.

## Essences Brillantes, carte unique et événements

**Les exemplaires à garder (version 2.1).** Pour ceux qui collectionnent plusieurs exemplaires d'une carte. Deux réglages, enregistrés sur le compte (`supabase/22_garder.sql`) :
- **par rareté**, dans Réglages › Exemplaires à garder : de 1 à 4 (« garder 2 de chaque Légendaire »), les Reverses à part (clés `rC`, `rPC`, `rR`) ;
- **par carte**, dans la visionneuse (toucher une carte de sa Collection) : de 1 à 10, ou « Tous ». Le réglage d'une carte l'emporte sur celui de sa rareté ; revenu à la même valeur, il s'efface et la carte suit de nouveau sa rareté.

Sans rien toucher, on garde un exemplaire : rien ne change. Ce que ça change sinon : le Recyclage ne propose plus que les exemplaires en plus (le serveur le revérifie dans `recycler`) ; les amis ne voient plus les exemplaires gardés comme des doublons (sa fiche, « Ses doublons », « Chez tes amis ») ; dans la Collection, sous la carte et à côté de son numéro, un point par exemplaire voulu (pleins pour ceux qu'on a, dorés au complet ; « 3/8 » au-delà de cinq ; un cadenas pour « Tous »), et le tiroir de filtres gagne « À compléter ». Les échanges restent libres : proposer ou accepter de céder une carte gardée demande seulement une confirmation.

**Trois quêtes saisonnières vont avec (version 2.1)** : posséder 10 exemplaires d'une même Rare (1 000 Éclats), 5 d'une même Épique (1 500), 3 d'une même Légendaire (2 500). Seules les cartes classiques comptent, pas les Reverses (métriques `ex_R`, `ex_E`, `ex_L`, `sync_collection_quests` dans `supabase/01_schema.sql`). La progression ne recule pas : c'est le plus haut nombre d'exemplaires atteint. Simulation sans recycler la carte : environ 170, 200 et 230 boosters (médianes), soit un mois chacune à six boosters par jour. La quête montre la carte dont on a le plus d'exemplaires ; une pression l'ouvre, pour régler « Garder ».

**Les favoris (version 2.1).** Un cœur, en haut à gauche de la visionneuse, en face de la croix. Rien que pour soi : il ne protège de rien (c'est le rôle des exemplaires à garder) ; il sert à retrouver ses cartes préférées, avec le filtre « Mes favoris » de la Collection, et pose un petit cœur à gauche du numéro, sous la carte. Enregistré sur le compte (table `favoris`, fonction `favori`, `supabase/22_garder.sql`) ; hors ligne, dans le navigateur. On peut aimer une carte qu'on n'a plus.

**Les Essences Brillantes** sont la version brillante des 9 Essences : même illustration, avec un reflet arc-en-ciel et des paillettes posés par le CSS (`.card.r-BR`, `css/cards.css`). La case Essence d'un booster en donne une **une fois sur 50** (`cfg('foil_odds')`) — une tous les huit jours environ pour un joueur régulier. Identifiants `b001` à `b009`, hors extension comme les Promos : ni dans les 122, ni échangeables, ni recyclables, ni fabricables. Elles ont leur section dans la Collection.

**La carte unique**, *L'Unique Chevalière* (`u01`), n'existe qu'en **un exemplaire dans tout le jeu**. Tant que la chasse est ouverte (`chasse.active`) et que personne ne l'a, chaque booster a une chance sur 250 (`cfg('chasse_odds')`) de la contenir : elle prend la place de la dernière carte (le hit), avec la plus longue révélation du jeu. Avec ~70 boosters ouverts par jour dans la communauté, elle sort en trois à quatre jours. C'est la base qui garantit l'unicité : la mise à jour `where gagnant is null` dans `open_pack()` laisse passer un seul gagnant, même si deux joueurs la tirent à la même seconde. Une annonce part alors dans toutes les boîtes de réception ; chaque autre joueur voit aussi, une fois, la fenêtre « La chasse est terminée ». La carte a sa vitrine dans la Collection : en tête, dorée, chez celui qui l'a ; en bas, avec le nom du gagnant, chez les autres. Elle ne s'échange pas et ne se recycle pas. Celui qui la tire reçoit aussi le **cadre d'avatar « Unique »** (`f_unique`), posé d'office et que personne d'autre n'aura, et un écrin « L'Élu » sur son profil et sa fiche. Son visuel est dans `cards/uniques/`.

**Les événements** sont des lignes de la table `evenements` : un titre, un début, une fin, et le rythme de recharge pendant ce temps (`ticket_minutes`, 120 = boosters doublés). `minutes_recharge()` donne le rythme en cours, `regen_tickets()` et le compte à rebours du navigateur le suivent. Un bandeau s'affiche au-dessus du paquet tant qu'un événement ou une chasse est en cours. Les requêtes pour lancer un événement, l'arrêter ou ouvrir la chasse sont en bas de `supabase/15_evenements.sql`.

**La fenêtre des nouveautés** (`montrerNouveautes()`, `js/bienvenue.js`) s'ouvre une fois par version et par appareil, et se rouvre depuis le bandeau. Changer `NOUVEAUTES_VERSION` la remontre à tout le monde.

## Version 2.0 · Reflets

**Les Reverses** (`r001`…) : chaque Commune, Peu commune et Rare de l'extension existe aussi en Reverse — 85 cartes, même illustration, avec un reflet sur tout ce qui n'est pas l'image et le logo *Tout Commence Ici* frappé dans le coin de l'illustration (`.card.rev`, `css/cards.css`). Côté serveur ce sont des lignes de `cards` avec `reverse = true` (`supabase/03b_promos.sql`), côté navigateur des copies construites au démarrage (`buildReverses()`, `js/cards.js`). Une par booster, en 5ᵉ carte. Elles ne s'échangent que contre une autre Reverse. Leur recyclage et leur fabrication (au double du prix d'une classique) restent **fermés** tant que `parametres.fabrication_reverse` ne vaut pas `true` :

    update public.parametres set fabrication_reverse = true where id = 1;

**La Collection** a trois vues : Classiques (les 122), Reverses (les 85) et Spéciales (Promos, Brillantes, carte unique), sous une jauge commune. Une classique dont on a aussi la Reverse porte un petit éclat nacré à côté de son numéro. Dans les listes sans image, une Reverse garde le nom de sa carte, suivi du même éclat (`nomH()`, `js/utils.js`).

**Titres, bannière, devise.** Un titre s'affiche sous le pseudo (profil, fiche, classement). Il se gagne par les succès, les quêtes jalons, le Pass de l'événement ou la boutique (`TITRES`, `js/config.js` ; `titres_de()`, `supabase/21_reflets.sql`). La bannière est une carte qu'on possède, en fond de fiche ; la devise, une phrase de 80 signes. Tout passe par `personnaliser()`. Les cadres Prisme, Sceau, Maître, Reflet, Aurore, Miroir et Nébuleuse sont des cadres décorés, à la manière des décorations d'avatar de Discord : une illustration animée qui entoure l'avatar et déborde de son cercle (`fx` dans `FRAMES` ; un SVG par cadre dans `assets/cadres/`, généré, ses animations dedans).

**L'événement Reflets** (`code = 'reflets'` dans `evenements`) remplace Combats dans la barre du bas tant qu'il dure. Sa monnaie, les **Prismes**, ne se gagne que par ses quêtes (quotidiennes `ev_jour` et de l'événement `ev`, colonne `evenement` de `quests`). Tout Prisme gagné fait avancer un **Pass** de 20 paliers (table `evt_piste`, le calcul de l'équilibrage est en tête de son tableau) ; en dépenser à la **boutique de l'événement** (`shop_items.devise = 'prismes'`) n'y change rien. L'onglet a six sous-onglets — Accueil (aujourd'hui, et les nouveautés de la 2.0), Quêtes, Pass, Devine l'illu, Boutique, Classement — et un bandeau d'une ligne l'annonce sur l'écran Boosters. La boutique principale n'a plus qu'un lien vers celle de l'événement.

**Devine l'illu** : une illustration de l'extension par jour, la même pour tous. Elle arrive en 9 × 6 pixels ; chaque essai raté la précise (12 × 8, 18 × 12, 36 × 24). Quatre essais. Trouvée au premier : 25 Prismes et 120 Éclats, puis 18/90, 12/60, 6/30 (`illu_gain()`) — les Prismes seulement pendant l'événement. Tout est automatique : les 113 illustrations sont rangées une fois pour toutes dans un ordre secret (tiré du sel `parametres.illu_sel`, créé au hasard à l'installation et jamais montré), et chaque jour prend la suivante — aucune ne revient avant 113 jours, et l'ordre ne se devine pas depuis le code, qui est public. Le serveur garde les pixels (`illu_pixels`, rempli par `supabase/21b_illu.sql`) et n'envoie que la grille du moment : le navigateur ne connaît la carte qu'une fois la partie finie. Quand une illustration change : `node tools/illu-pixels.js`, puis `python3 tools/build-sql.py`.

**Les invitations** s'achètent en boutique : 2 000 Éclats, trois par joueur (`shop_items.limite`). Chaque achat crée un code `M8-XXXX-XXXX`, valable une fois. L'ami se connecte avec Discord, arrive sur l'écran d'attente, et saisit le code — ou le reçoit tout rempli par le lien `/?invitation=CODE`. Il entre avec un cadeau de bienvenue : 10 boosters hors réserve (en plus des 5 de départ) et 1 000 Éclats. Pour que ce soit possible, **un compte non invité est désormais créé** à la connexion (`handle_new_user`) : il reste bloqué par `garde_beta()` sur toutes les actions du jeu et n'apparaît ni dans la recherche ni dans le classement, mais il peut utiliser un code. **Un invité n'invite pas à son tour** (version 2.1, `est_filleul()`) : sinon chaque nouveau venu ouvrirait la porte à d'autres et la liste d'accès ne voudrait plus rien dire. Le serveur refuse l'achat (`shop_buy`, `creer_invitation`), la boutique ne lui montre pas l'article et ses quêtes d'invitation sont cachées (`me()`). Les codes achetés par un invité avant cette règle et jamais utilisés ont été annulés et remboursés ; ceux déjà utilisés restent valables.

**Après l'événement.** Pendant trois jours, son onglet devient un **récap** (`evenement_recap()`) : le bilan du joueur, le podium, ce qui reste, et un « À suivre » sur les Combats et les Secrets ; le bandeau de l'écran Boosters y mène, et une fenêtre l'annonce une fois. Puis l'onglet disparaît. **Devine l'illu continue** dans son propre onglet (tiroir) : il rapporte toujours ses Éclats (120, 90, 60, 30 selon l'essai), plus de Prismes. Le Labo montre l'onglet récap, la fenêtre et le bandeau avec des chiffres inventés.

**Échanges · Chez tes amis** : les cartes qui te manquent et qu'un ami a en double (`amis_doublons()`), une pression sur l'ami prépare la demande.

**Sortie de la 2.0.** Fusionner la branche dans `main`, puis coller `supabase/TOUT.sql` dans Supabase : il passe sur une base existante sans rien perdre, et lance l'événement Reflets pour 14 jours à partir de ce moment-là.

## Version 3.0 · Les Combats

> **Pré-build.** Les règles du jeu de cartes ne sont pas encore publiées : celles du jeu sont **reconstituées** à partir des cartes, et tout ce qui a été inventé est signalé (`docs/regles-3.0.md`, et le guide « Ce qui est maison » dans le jeu). La 3.0 ne sortira qu'avec les vraies règles et les visuels des Secrètes.

**Le moteur** (`js/combat/moteur.js`) fait tourner une partie entière dans la page, sans serveur de jeu : un générateur qui s'arrête à chaque décision, une graine tirée par le serveur, et un journal d'actions qui suffit à rejouer la partie à l'identique (reprise après un rechargement, défis entre amis). Les effets des cartes sont dans `js/combat/effets.js`, l'IA (cinq niveaux, du hasard à la recherche sur deux tours) dans `js/combat/ia.js`, l'arène animée dans `js/combat/table.js`. Le banc d'essai et les tests tournent sans navigateur :

    node tools/combat-tests.js          les règles, une par une
    node tools/combat-sim.js ia 200     IA contre IA : durée, équilibre

**L'onglet Combats** (`js/battle.js`) : on choisit sa **Section** (Toxique ou Déter, les deux Starter Decks — sa Promo et son deck, prêté), puis la **campagne** (vingt combats en quatre actes contre l'autre Section ; la finir donne sa Promo), le **PvE infini** (cinq difficultés, cinq victoires récompensées par jour), les **défis** entre amis (en direct, chacun sur son écran : le serveur range les actions, chaque navigateur rejoue celles de l'autre), l'**atelier de decks** (`js/combat/atelier.js` ; codes de partage) et les **Guides** (`js/combat/guides.js`). Chaque victoire marque des points pour sa Section dans la **Guerre des Sections** de la semaine ; le lundi, ceux qui ont marqué reçoivent leur part (2 boosters et 200 Éclats dans la Section gagnante, un booster dans l'autre).

**Les cosmétiques** : six tapis de jeu et deux sleeves en boutique (rayon Combats ; visuels adaptés des illustrations par `tools/cosmetiques.py`), plus ceux de l'événement (`tools/choc-visuels.py`). Les Essences Brillantes qu'on possède brillent en combat.

**La maîtrise des cartes** (`js/maitrise.js`) : chaque exemplaire obtenu d'une carte — Reverse comprise, même s'il est recyclé ou échangé ensuite — la fait monter de palier : Bronze, Argent, Or, Prisme. Les seuils dépendent de la rareté. Le serveur compte les exemplaires dans `collection.total` (un déclencheur, `supabase/01_schema.sql`) ; les collections d'avant la 3.0 partent de ce qu'elles possèdent.

**L'événement « Le Choc des Sections »** (`code = 'choc'`, trois semaines ; `js/choc.js`, `js/combat/choc-data.js`, `supabase/25_choc.sql`) : le **Raid** contre The French Sorcerer (une barre de vie commune à tout le serveur ; cinq phases qui s'ouvrent une à une, aux jours 1, 4, 8, 12 et 16, pour que le Raid dure les trois semaines ; chaque phase tombée ouvre une récompense à ceux qui l'ont frappé ; trois tentatives par jour ; le Sorcier commence chaque combat déjà sur le plateau), l'**Épreuve du jour** (le même combat pour tout le monde, trois essais, un classement du jour), la Guerre des Sections **doublée** et un titre pour la Section gagnante, des quêtes et un **Pass de trente paliers** en **Insignes**, une boutique. Son onglet passe en tête du tiroir : Combats garde sa place dans la barre du bas, et un bandeau annonce l'événement sur les écrans Boosters, Combats et Boutique. La barre du Raid se règle sans redéployer, selon le nombre de joueurs : `update public.parametres set raid_echelle = … where id = 1;`. L'équilibrage complet, chiffres et hypothèses, est dans **`docs/economie-3.0.md`**.

**Côté serveur** : `supabase/23_combats.sql` (Sections, decks, combats, défis, Guerre), `24_secretes_maitrise.sql` (les Secrètes) et `25_choc.sql` (l'événement), plus des retouches des fichiers existants (taux du hit, compteur d'exemplaires, quêtes et boutique 3.0, `me()`). Le serveur ne fait pas tourner le moteur : il fixe la graine de chaque combat, plafonne ce qu'un combat peut rapporter, et croit le navigateur sur le résultat — un défi est déclaré par les deux joueurs, et un désaccord est noté (`defis.desaccord`). `verif.html` contrôle que la 3.0 est installée.

**Sortie de la 3.0.** Fusionner la branche dans `main`, puis coller `supabase/TOUT.sql` dans Supabase (il passe sur une base 2.x sans rien perdre — testé sur PostgreSQL 16). L'événement ne s'ouvre pas tout seul : la commande est en fin de `supabase/25_choc.sql`.

## Succès, historique et partage

**Les succès** sont calculés à la volée par le serveur (`succes_de()`, `supabase/15_evenements.sql`) à partir de ce qu'il sait déjà : boosters, collection, échanges, plus longue série (`profiles.serie_max`), godpacks du journal, Brillantes, fabrications, carte unique. Rien à stocker ni à synchroniser. Les noms et descriptions sont dans `SUCCES` (`js/config.js`) ; les identifiants doivent rester les mêmes des deux côtés. Le profil les montre tous (obtenus en couleur, les autres grisés), la fiche d'un joueur seulement les siens.

**L'historique** : chaque booster ouvert est journalisé dans `tirages`. L'onglet *Mes tirages* (menu du compte) montre les trente derniers, avec quelques compteurs (Légendaires, Brillantes, godpacks), et chaque booster se partage en image. Le journal commence à la version 1.5 : les boosters ouverts avant n'y sont pas.

**Le partage** dessine une image 1080 × 1350 du booster dans un canvas (`js/partage.js`) : le logo, le pseudo, les cartes avec la lueur de leur rareté, l'adresse du jeu. Sur téléphone, le menu de partage du système s'ouvre ; ailleurs, l'image se télécharge. Le bouton est dans le récap d'ouverture et sur chaque booster de l'historique. Ouvert comme fichier (la démo), le navigateur refuse d'exporter l'image : il faut une adresse web.

## L'équilibrage

Tout le jeu tient sur une seule tension : **le temps contre la collection.** Les 122 cartes ne s'achètent pas, elles se trouvent ; les Éclats ne font qu'accélérer un peu. Les chiffres ci-dessous viennent d'une simulation, pas d'une intuition.

### La collection

Six boosters gratuits par jour (un toutes les 4 h, réserve de 5). En médiane :

| Étape | Boosters | Environ |
|---|---|---|
| 25 % | 4 | le premier jour |
| 50 % | 10 | deux jours |
| 75 % | 26 | une semaine |
| **90 %** | 85 | deux semaines — donne la Promo **P06** |
| **100 %** | 655 | ~110 jours — donne la Promo **P05** |

La courbe est volontairement brutale à la fin : le goulot, ce sont les **dix légendaires à 4 %** chacune. Tout le reste se complète en un mois ; c'est la dernière poignée de cartes qui fait la valeur du Master Set.

### Les Éclats

Depuis la version 1.5, **les quêtes sont la seule source d'Éclats** : le recyclage donne des Fragments. Les quêtes quotidiennes et hebdomadaires ont été relevées pour compenser, et les premiers paliers baissés : ce sont eux qui offraient à un nouveau venu dix boosters en cinq jours et une Promo en sept.

Simulation, médiane, sans échange (les échanges ajoutent des quêtes à part) :

| Joueur | Éclats par jour | 3 000 (x10 boosters) | 5 000 (une Promo) |
|---|---|---|---|
| Régulier (6 boosters/jour), nouveau venu | ~340 | 7ᵉ jour | 10ᵉ jour |
| Régulier, avancé | ~340 | 10ᵉ jour | 14ᵉ jour |
| Occasionnel (4/jour, 5 jours sur 7), nouveau venu | ~160 | 11ᵉ jour | 21ᵉ jour |
| Occasionnel, avancé | ~155 | 21ᵉ jour | 31ᵉ jour |

Avant, un régulier avancé touchait ~275 Éclats par jour, et un nouveau venu atteignait 3 000 le 5ᵉ jour, 5 000 le 7ᵉ.

| Article | Prix | Pour un régulier avancé |
|---|---|---|
| Un booster | 350 | un jour |
| Dix boosters | 3 000 | neuf à dix jours |
| Un cadre | 1 200 à 5 000 | de quatre à quinze jours |
| **Une carte Promo** | 5 000 | quinze jours |

Tout dépenser en boosters ajoute ~1,1 booster par jour aux six de la réserve (**+18 %**) : les Éclats aident, ils ne remplacent pas le temps.

La quête quotidienne **Petit ménage** (recycler 5 doublons) sert la fin de collection : *Du sang neuf* devient impossible quand il ne manque plus rien, celle-ci reste faisable tant qu'on tire des doublons.

Le détail du calcul est en tête de `supabase/04_seed.sql`, à côté des valeurs elles-mêmes.

## Quêtes et boutique

Les quêtes paient en **Éclats**, la seule monnaie du jeu. La boutique les dépense. Aucun achat avec de l'argent réel, nulle part.

La progression d'une quête n'est **jamais** envoyée par le navigateur : c'est le serveur qui l'incrémente au moment où l'événement arrive vraiment, dans `open_pack()`, `trade_respond()` et `recycler()`. C'est pour ça que toutes les quêtes portent sur des choses qu'il peut constater lui-même — boosters ouverts, cartes inédites, raretés sorties, échanges conclus, doublons recyclés, jours de connexion, pourcentage de collection, raretés complètes.

**Les raretés complètes** sont six quêtes saisonnières : posséder toutes les Essences, toutes les Communes, et ainsi de suite jusqu'aux Légendaires. L'objectif est le nombre de cartes de la rareté, calculé sur le catalogue ; l'avancement est recompté par `sync_collection_quests()`, comme le pourcentage de collection, et ne recule pas si l'on cède une carte ensuite. Les récompenses suivent le temps médian qu'il faut (simulation, six boosters par jour) :

| Rareté | Cartes | Environ | Récompense |
|---|---|---|---|
| Essences | 9 | 4 jours | 100 Éclats |
| Communes | 33 | 8 jours | 250 Éclats |
| Peu communes | 24 | 10 jours | 350 Éclats |
| Rares | 28 | 3 semaines | 1 200 Éclats |
| Épiques | 18 | 2 mois | 3 000 Éclats |
| Légendaires | 10 | ~110 jours | 6 000 Éclats |

Objectifs, récompenses, articles et prix sont tous dans `supabase/04_seed.sql`. On équilibre là, on rejoue le fichier, c'est pris en compte : ni déploiement, ni mise à jour du site.

**Trois périodes, trois sous-onglets.** Quotidiennes, Hebdomadaires, Saisonnières. Les seize quêtes d'un seul tenant faisaient une page qu'on ne lisait plus : on n'a qu'une question à la fois, « qu'est-ce que je peux finir aujourd'hui ? ». Chaque période affiche le temps qui lui reste — « remise à zéro dans 3 h 20 » plutôt que « remis à zéro chaque nuit », qui ne dit pas quand. Le calcul est calé sur l'heure de Paris via `Intl`, exactement comme `period_key()` côté serveur : les deux frontières doivent tomber ensemble.

Une quête qui se termine se signale **deux fois**, et jamais en travers du chemin : une carte passe en haut de l'écran pendant quatre secondes (`notifQuete()`, `js/quests.js`), puis la pastille de l'onglet prend le relais et reste tant qu'il y a une récompense à encaisser. C'est `Backend.apply()` qui les repère, en comparant l'état reçu du serveur au précédent.

**La boutique a deux rayons** — Cartes et Cosmétiques — et un étal plutôt qu'une liste : on voit l'objet avant son libellé. Un achat demande **toujours deux gestes**, ouvrir la fiche puis confirmer, avec le solde restant affiché avant de payer. Un article à 5 000 Éclats ne doit jamais partir sur un doigt posé de travers.

**Et sur la fiche, on manipule ce qu'on achète.** Le paquet tourne sous le doigt, un lot s'ouvre en éventail — cinq paquets pour un lot de cinq —, la carte Promo se retourne recto-verso, le jeton s'empile. On n'achète pas une icône. La bascule recto-verso ne se fie pas à `backface-visibility` : la propriété ne s'hérite pas, et la carte imbriquée se retrouvait dessinée en miroir. On échange les deux faces au quart de tour exact, quand la carte est sur la tranche et que l'échange ne se voit pas.

**Les remises sont calculées, pas décrétées.** « −14 % » se vérifie contre le prix à l'unité du même rayon ; « éco » se croyait sur parole.

## Les cartes Promo

Quatre cartes hors extension. Elles ne sortent d'aucun booster, ne comptent pas dans les 122, et ne s'échangent pas — le serveur refuse les trois.

| Carte | Comment l'obtenir |
|---|---|
| **P01** Major de Paris | Boutique, 5 000 Éclats |
| **P02** Major de Paris *(illustration alternative)* | Boutique, 5 000 Éclats |
| **P03**, **P04** | *À venir* — leur emplacement est déjà dans la grille |
| **P06** Le Marionnettiste | 75 % de la collection |
| **P05** Tout Commence Ici | Master Set complet (les 122 cartes) |

Les deux paliers ne donnent **que** la carte, zéro Éclat. Une récompense qui paie deux fois dilue les deux : on se souvient d'avoir débloqué la carte, pas d'avoir touché six mille Éclats en même temps. Le **Cadre Sceau** n'est vendu nulle part et n'est plus donné par aucune quête : ceux qui l'ont déjà le gardent. Pour le rendre accessible, le poser en `item_id` d'une quête dans `supabase/04_seed.sql`.

Elles vivent dans `promos`, jamais dans `cards` : c'est ce qui garantit que « 122 » reste 122 partout, et que le pourcentage de collection ne bouge pas quand on en ajoute une. Côté serveur, la colonne `cards.promo` les exclut du tirage (`pick_card`) et du calcul d'avancement (`sync_collection_quests`).

Les deux cartes de palier sont accordées par `check_promos()` (`supabase/03b_promos.sql`), appelée depuis `me()` et `open_pack()`. L'insertion est idempotente : une carte déjà possédée n'est pas redonnée, sinon le compteur d'exemplaires grimperait tout seul à chaque rafraîchissement.

> **Pourquoi 75 % et non 50 %.** La moitié de l'extension se fait en une dizaine de paquets, c'est-à-dire le deuxième jour. Une récompense décrochée le deuxième jour n'en est pas une. À 75 % il faut une bonne semaine de jeu régulier, et ça laisse les 100 % — cent dix jours — comme dernier sommet.

> **Pourquoi des emplacements pour P03 et P04.** Une série se lit entière ou pas du tout : un trou entre P02 et P05 se lirait comme un bug plutôt que comme une suite à venir. Les deux cases portent « Coming soon… », et le compteur affiche bien `/ 6`. La liste est dans `PROMOS_A_VENIR` (`js/config.js`) : le jour où les images arrivent, on déplace la ligne vers `js/promos-data.js`.

**L'obtention a sa propre scène** (`js/promos.js`, `css/promo.css`) : la carte arrive de loin, dos tourné, se retourne, et le nom tombe. Rien à toucher avant la fin — le bouton ne devient cliquable qu'une fois la carte révélée, sinon un doigt posé au hasard fermait la scène avant le retournement. La détection suit le même principe que les quêtes : on compare deux états successifs envoyés par le serveur, et une file d'attente enchaîne les cartes si plusieurs tombent ensemble.

## Le thème

Un seul thème, **sombre**, depuis la version 2.0 : c'est là que les cartes brillent. Ses couleurs sont des jetons, dans `css/tokens.css` ; une feuille qui a besoin d'une teinte prend le jeton plutôt que d'écrire la couleur en dur. Le thème clair et son réglage ont été retirés ; un ancien choix rangé dans le navigateur est effacé au démarrage (`oublierTheme()`, `js/settings.js`).

## Les sons

Aucun fichier audio dans le dépôt : tout est **fabriqué à la volée** par le navigateur (`js/sfx.js`, Web Audio). Rien à télécharger, rien à héberger, aucune question de droits, et le son part à l'instant où on touche l'écran.

Chaque son est une recette courte dans `RECETTES` : quelques souffles de bruit filtré pour tout ce qui frotte, glisse ou se déchire, quelques notes pour les clics et les carillons. La déchirure du paquet, le passage d'une carte, la montée avant une révélation et les trois paliers de carillon (rare, épique, légendaire) sont branchés dans `js/opening.js`.

Il n'y a **que des bruitages** : chacun répond à un geste. Une musique de fond, elle, joue sans qu'on l'ait demandée — le jeu n'en a pas.

### Le son sur mobile

Un navigateur de téléphone ne laisse pas une page faire du bruit quand elle veut, et trois règles s'ajoutent les unes aux autres. Chacune coupait le son ici :

1. **Rien avant un geste.** L'`AudioContext` naît suspendu et ne se réveille que dans un gestionnaire déclenché par la personne. On le réveille au tout premier contact, quel qu'il soit.
2. **`resume()` prend son temps.** Il rend une promesse : juste après l'appel, l'état est encore `suspended`. L'ancien code vérifiait l'état tout de suite et renonçait — le premier son de chaque session était systématiquement perdu. Les sons demandés pendant ce réveil sont désormais **mis de côté** et joués dès que le contexte tourne.
3. **Le système reprend la main.** Quitter l'onglet, verrouiller l'écran, recevoir un appel : le contexte est suspendu et n'est pas rendu. Sans reprise explicite, tout restait muet au retour, définitivement. On redemande le réveil sur `visibilitychange`, sur `pageshow`, et à chaque geste.

Ce qu'on ne peut pas corriger : sur iPhone, l'interrupteur « silencieux » de la tranche coupe le son des pages web. Aucune ligne de JavaScript ne passe outre — les Réglages le disent au joueur plutôt que de le laisser chercher, et un bouton **Tester le son** répond honnêtement (`SFX.audible()`).

Les navigateurs interdisent le son tant que la personne n'a rien touché : tout se débloque au premier geste, quel qu'il soit. Un clic sur n'importe quel bouton sonne sans avoir à le brancher, grâce à un écouteur unique posé sur la page.

## Installation sur l'écran d'accueil

`manifest.webmanifest` et `sw.js` font du site une application installable : ouverte en plein écran, sans barre d'adresse, avec son icône — et consultable sans réseau.

Sur Android, le navigateur propose lui-même l'installation : `js/pwa.js` récupère sa demande et la déclenche au bon moment. **Sur iPhone, rien de tel n'existe** — il faut passer par le bouton *Partager* de Safari — alors le jeu dessine la marche à suivre en trois étapes illustrées, avec une flèche qui pointe vers le bas de l'écran.

La bulle ne s'affiche **jamais au premier écran** : elle attend que deux boosters aient été ouverts, et ne revient pas avant deux semaines si on a dit non. Le bouton dans les Réglages permet de la rappeler à tout moment.

Le service worker sert le code par le réseau d'abord (les corrections arrivent sans attendre) et les images par le cache (elles ne changent jamais sans changer de nom). Quand une nouvelle version est en ligne, il prévient au lieu de recharger sous les doigts.

## Identité visuelle

`python3 tools/gen-icons.py` régénère les icônes de l'application, les favicons et l'image de partage à partir de `assets/logo-m8.webp` et des couleurs de `css/tokens.css`. Le script n'a besoin d'aucune bibliothèque : il écrit les PNG à la main et rasterise l'étoile du logo lui-même.

`assets/favicon.svg` est écrit à la main et reste net à toutes les tailles ; les PNG sont là pour les navigateurs qui n'acceptent pas le SVG, et pour l'icône d'iPhone qui l'exige.

Les balises de partage (Open Graph et Twitter Card) sont en haut de `index.html`. Elles pointent en relatif, ce qui marche partout ; si tu prends un vrai domaine, renseigne `SITE_URL` dans `js/config.js` — il sert aussi d'adresse de retour après un courriel de confirmation ou un détour par Discord.

## Écran d'attente et bêta fermée

Tant que `PORTE.active` vaut `true` dans `js/gate.js`, le jeu n'est ouvert qu'aux comptes
invités. Les autres voient un paquet qui flotte, « Bientôt disponible », le lien vers le
Discord — pour suivre l'actualité du jeu et discuter avec la communauté — et, en discret,
« J'ai déjà un accès » pour les comptes invités.

**L'accès est nominatif.** On se connecte avec son compte Discord, et c'est le serveur qui
vérifie que ce compte figure dans la table `beta_invites`. On invite, on retire, on
regarde qui est entré depuis `supabase/09_beta.sql`. Depuis la 2.0, un joueur peut aussi
inviter un ami avec un code acheté en boutique (voir « Version 2.0 · Reflets ») : le code
inscrit le compte Discord de l'ami dans `beta_invites`, une seule fois.

Deux raisons d'avoir abandonné le code d'accès, et les deux ont servi contre nous :

1. **L'empreinte était dans la page.** Le code n'y figurait pas en clair, mais son
   empreinte si — et la comparaison se faisait dans le navigateur. Ouvrir la console et
   écrire la valeur attendue dans le stockage local suffisait à entrer.
2. **Un code se transmet.** Une fois dans un salon Discord, il n'appartient plus à
   personne et ne se reprend plus. Une invitation, elle, se retire.

Le contrôle vit maintenant côté serveur, dans `garde_beta()` : tant que la bêta est
fermée, **aucune action du jeu n'aboutit** pour un compte non invité — ni ouvrir un
booster, ni consulter un profil, ni chercher un joueur. Le mode hors ligne ne franchit
plus cet écran non plus : c'était la vraie faille, puisqu'il donnait accès à tout le jeu
sans le moindre compte.

### L'ouverture est datée — par le serveur

La date d'ouverture au public — **jeudi 24 septembre 2026 à 18 h** — vit à un seul endroit :
`beta_lancement()`, dans `supabase/01_schema.sql`. Un compte à rebours s'affiche tout seul,
et à la seconde dite l'écran s'efface : pas de rechargement, pas de geste à faire, rien à
pousser ce soir-là.

**L'écran ne consulte plus la montre de l'appareil.** Il comparait l'heure d'ouverture à
`Date.now()` : avancer la date du téléphone suffisait à l'effacer, et derrière lui le mode
hors ligne donnait accès à tout le jeu, sans compte. C'est par là que des visiteurs
passaient. Désormais il demande au serveur (`porte()`, appelable sans compte) si c'est
ouvert, quand ça ouvre et quelle heure il est chez lui, puis compte le temps qui passe avec
`performance.now()` — une horloge qui démarre avec la page et qu'on ne règle pas. Sans
réponse du serveur, l'écran reste fermé. Au retour sur l'onglet, il redemande l'heure : un
téléphone en veille peut avoir arrêté l'horloge de la page.

Trois autres fermetures vont avec : le drapeau `invite` renvoyé par `me()` doit valoir
`true` explicitement (un champ absent valait « invité ») ; `PORTE` est figé et les fonctions
de l'écran sont des constantes, qu'on ne remplace plus d'une ligne dans la console ; et
`est_invite()`, `garde_beta()`, `photo_discord()` et `check_promos()` ne sont plus
appelables sans compte — le droit n'avait été retiré qu'à `anon` et `authenticated`, pas au
rôle `public` dont ils héritent.

Le passage est étalé exprès. Personne ne recharge : la page se redessine sur place, et le
premier appel au serveur part après un délai tiré au hasard entre 0 et 20 secondes. Sans
ça, tous ceux qui attendent le compte à rebours frapperaient le serveur à la même
seconde.

> **Ce que cet écran protège, et ce qu'il ne protège pas.** Il protège le *jeu* : sans
> invitation, le serveur ne répond rien. Il ne protège pas les *fichiers*. Le site est
> statique : ses scripts, ses images et la liste des cartes se téléchargent à l'adresse
> où ils sont publiés, écran d'attente ou non — et le dépôt lui-même est lisible s'il est
> public. La seule réponse à ça est du côté de l'hébergement : dépôt privé, et un
> hébergeur capable de demander une identité avant de servir le premier octet
> (Cloudflare Access, un mot de passe Netlify, un proxy). Aucune ligne de JavaScript ne
> peut le faire à leur place.

### Ouvrir le jeu à tout le monde

Il n'y a rien à faire : la date suffit. Le 24 septembre à 18 h, `beta_ouverte()` bascule
côté serveur, et l'écran, qui lit l'heure du serveur, s'efface au même instant.

Une fois l'ouverture passée et la poussière retombée, on peut faire le ménage :
`PORTE.active` → `false` dans `js/gate.js`, ce qui retire définitivement l'écran d'attente
du chemin. Ce n'est qu'un nettoyage — le jeu est déjà ouvert sans ça.

## Remettre les compteurs à zéro

Deux fichiers, deux portées. Aucun des deux ne touche aux comptes eux-mêmes :
personne n'a jamais à se réinscrire.

| Fichier | Pour qui | Ce qu'il efface |
|---|---|---|
| `supabase/08_reset-profil.sql` | **un** joueur | sa collection, ses Éclats, ses quêtes, ses compteurs |
| `supabase/10_reset-tout.sql` | **tout le monde** | la même chose, pour tous les comptes |

Le second est celui du jour du lancement, quand la période de test se termine et
que tout le monde doit repartir du même point. Il demande une confirmation écrite
dans le fichier avant de s'exécuter : tant qu'on n'a pas remplacé une ligne à la
main, la requête refuse de tourner. Ce n'est pas un fichier qu'on joue par accident
en le collant trop vite.

Ce qu'il garde : les comptes, les pseudos, les listes d'amis, les droits
d'administrateur. Ce qu'il remet à neuf : la réserve repart pleine, donc tout le
monde ouvre cinq boosters le jour de l'ouverture.

> Le cadre porté revient à « aucun », et un avatar qui pointait vers une carte
> revient à l'étoile. Sans ça, `set_profile()` refuserait ensuite un cadre ou une
> carte qu'on ne possède plus, et le joueur se retrouverait avec un profil qu'il
> ne peut plus modifier.

Les invitations de la bêta, elles, ne sont pas touchées : la remise à zéro vide
les collections, pas la table `beta_invites`. Pour retirer quelqu'un de la liste,
c'est `supabase/09_beta.sql`.

## Le Discord

`DISCORD_URL` dans `js/config.js` porte l'adresse du serveur, et elle est citée partout où
elle a sa place : sur l'écran d'attente (en bouton principal — avant l'ouverture, c'est la
seule chose qu'un visiteur puisse faire), au pied du tiroir du compte et du rail
d'ordinateur, dans un panneau des Réglages, et dans les deux fenêtres d'accueil.

Ces fenêtres vivent dans `js/bienvenue.js` :

- **La bienvenue** — une fois par compte et par appareil. Elle pose le cadre en trois
  points : ce qu'on fait ici, à quel rythme, et qu'aucun argent réel n'entre dans
  l'affaire. C'est la première question qu'on se pose devant un jeu de cartes.
- **Le rappel du Discord** — une seule fois, après trois boosters, et seulement pour qui
  n'est pas déjà passé par le lien de la bienvenue.

Les deux passent par `quandCalme()`, qui attend que l'écran soit rendu au joueur et
n'autorise **qu'une proposition par session** — la bienvenue, le Discord et l'installation
sur l'écran d'accueil (`js/pwa.js`) partagent la même file. Sans ça, elles pouvaient se
succéder juste après la déchirure d'un paquet, c'est-à-dire au seul moment du jeu où l'on
ne veut voir personne.

## Administrateurs

L'onglet **Labo** n'est plus accessible à tout le monde. Il n'apparaît que pour les profils marqués `is_admin` en base, et ce drapeau ne peut être posé que depuis le tableau de bord Supabase (`supabase/05_admin.sql`) : aucune fonction du jeu ne l'expose, et le navigateur n'a pas le droit d'écrire dans la table des profils.

Cacher un bouton ne protège rien — ce qui protège, c'est que le serveur refuse les actions. Les boutons du Labo qui touchent à la collection ne modifient que l'affichage local : en ligne, la vérité reste celle du serveur, et la page la récupère telle quelle au rafraîchissement suivant.

Le Labo sert à **voir ce qu'on ne peut pas provoquer** :

- les sept ouvertures de test (normale, rare, épique, légendaire, Essence Brillante, carte unique, godpack), et l'image de partage d'un booster ;
- **l'événement et la chasse** : ce que le serveur dit en ce moment (événement, rythme de recharge, état de la chasse), quatre aperçus de l'interface (avant le départ, pendant, chasse terminée, carte unique en main), les fenêtres des nouveautés et de fin de chasse, et les requêtes SQL pour lancer ou arrêter un événement et ouvrir la chasse ;
- **l'animation d'obtention de chaque carte Promo**, une par une ou toutes à la suite — c'est exactement ce que verra un joueur, seule l'écriture dans la collection est sautée ;
- les notifications qui passent en haut de l'écran, dont le ping de la boîte de réception ;
- **publier une annonce** dans la boîte de réception de tous les joueurs ;
- **offrir un cadeau** à un ou plusieurs joueurs : des Éclats, des boosters, des Fragments, une carte (sauf la carte unique) et un mot. La liste montre, pour chacun, sa date d'inscription, ses boosters ouverts, ses cartes et son retard sur la médiane, de quoi doser un rattrapage. Le joueur le découvre à sa visite suivante, dans un paquet qu'il ouvre lui-même : c'est l'ouverture, côté serveur, qui crédite le compte, une seule fois (`supabase/18_cadeaux.sql`, `js/cadeaux.js`). Une Promo offerte compte comme achetée : la boutique ne la revend pas. Les boosters offerts, comme ceux de la boutique, **ne vont pas dans la réserve** : ils s'ouvrent à part (`open_pack(true)`, colonne `boosters_bonus`), tout de suite après l'achat ou l'ouverture du cadeau, ou plus tard par « Ouvrir un booster en plus » sur l'écran Boosters. Mélangés à la réserve, ils la faisaient déborder du plafond, et une réserve pleine remet son compte à rebours à zéro : on perdait des boosters gratuits en en achetant. Parmi eux, ceux d'un cadeau (`tickets_offerts`) partent en premier et **ne peuvent pas contenir la carte unique**. Le bouton *Voir un cadeau reçu* montre le paquet et son ouverture tels que les verra le joueur, avec ce qui est saisi (ou un exemple), sans rien envoyer ni créditer ;
- la collection remplie à 90 %, des Fragments et tous les succès en affichage, pour regarder la grille, la fabrication et le profil dans des états qu'on ne croise pas tous les jours ;
- un tableau des valeurs d'équilibrage en cours, telles que le serveur les impose, avec ce que rapporte et coûte chaque rareté en Fragments.

Pour obtenir une Promo **pour de vrai** sur son compte — et vérifier la détection, la boutique et les paliers de bout en bout — les requêtes sont commentées en bas de `supabase/03b_promos.sql`.

## La pré-prod

La version suivante se teste à **matetcg.com/preprod/**, à côté du vrai site, sans le toucher :

    python3 tools/demo.py --preprod

C'est la démo autonome (faux serveur, `_demo/serveur.js`) publiée dans `preprod/` : pas de compte, pas de vrai serveur, des joueurs simulés, et le Labo ouvert. Un bandeau « Pré-prod » le rappelle, et la page n'est pas indexée. Tout ce qu'elle range dans le navigateur porte un préfixe à part (`preprod:` pour le stockage local, une base IndexedDB à son nom) : elle ne lit ni n'écrase les réglages ou la session du vrai site, qui partage l'adresse. Elle n'a pas de service worker, pour ne pas vider les caches de celui du vrai site.

Le développement se fait sur une branche à part ; `main` reste le site public. Pour publier une pré-prod : construire `preprod/` sur la branche, puis le reporter seul sur `main`. Le SQL de la version suivante ne touche pas la vraie base avant la sortie : il est testé sur une base PostgreSQL locale, et le faux serveur en reproduit les règles.

## Mettre à jour le site

GitHub Pages sert les fichiers avec un cache de dix minutes. Sans précaution, une
correction poussée peut mettre ce temps-là à apparaître — voire ne jamais apparaître sur
un navigateur qui garde l'ancienne copie. C'est la raison d'être de `tools/version.py` :

```bash
python3 tools/version.py 2.3.2
git add -A && git commit -m "…" && git push
```

Le script écrit le numéro dans `js/pwa.js` et `sw.js`, et accroche `?v=2.3.2` à chaque
css et js de `index.html` et `verif.html`. Chaque version devient ainsi une adresse
différente : le navigateur ne peut plus servir l'ancienne par erreur. Le service worker
met en réserve les mêmes adresses marquées, et propose la mise à jour au lieu de
recharger sous les doigts.

**À lancer avant chaque mise en ligne qui touche au code.** Les images et les cartes ne
sont pas marquées : elles ne changent jamais sans changer de nom.

## Dépendances externes

- **Polices Google Fonts** (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.
- **supabase-js**, chargé depuis un CDN, uniquement pour le compte en ligne. S'il est absent (hors réseau, bloqueur), le jeu bascule tout seul en mode hors ligne.

Aucune autre bibliothèque, aucune étape de compilation : tout le reste est dans le dépôt.
