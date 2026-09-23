# Mate TCG Online

Jeu de collection de cartes façon TCG Pocket. Les 122 cartes de l'extension *Tout commence ici* sont livrées avec le jeu : on ouvre des boosters, on remplit sa collection, et on échange avec les autres joueurs.

Le site est fait de fichiers statiques — aucune étape de compilation, aucun paquet à installer. Il fonctionne dans **deux régimes** :

- **Hors ligne.** Rien à configurer : la progression est enregistrée dans le navigateur de l'appareil (IndexedDB). Les onglets qui ont besoin des autres joueurs invitent à créer un compte.
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
├── tools/              Petits scripts de maintenance (Python, sans dépendance)
│   ├── build-sql.py    Assemble supabase/TOUT.sql
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
│   ├── 12_recyclage.sql  Recyclage des doublons et son plafond hebdomadaire
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
| Changer ce que rapporte le recyclage, ou son plafond | `cfg()` dans `supabase/01_schema.sql` (clés `recyclage_*`) |
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
| Accepter d'autres champs de carte | `makeCard()` dans `js/cards.js` |

## Composition d'un booster

Huit cartes, dans l'ordre de révélation (`makeBooster()`, `js/booster.js`) :

| Carte | Contenu |
|---|---|
| 1 à 4 | Commune |
| 5 à 7 | Peu commune |
| 8 | Essence |
| 9 | **Rare garantie** |
| 10 | Le hit : rare, épique ou légendaire (`RATES.HIT` = 70 / 26 / 4 %) |

La rare garantie en neuvième position est le pivot de l'équilibrage : elle assure qu'**aucun paquet ne soit vide de sens**. Il y a toujours au moins deux cartes de rang R ou mieux, donc toujours quelque chose qui fait avancer la collection quelque part.

Environ un booster sur 2 000 (`GOD`) est un **godpack** : 5 rares, 4 épiques et une légendaire en dernier. Rien ne l'annonce, ni écran, ni mot : voir plus bas.

> Ces taux existent à deux endroits : `open_pack()` dans `supabase/03_rpc.sql` (le vrai tirage) et `RATES` dans `js/booster.js` (les ouvertures de test du Labo). Les garder identiques, sinon le Labo ment sur ce qu'il montre.

### L'ouverture

Tout se joue dans **un seul écran, sans jamais remplacer le DOM** : c'est ce qui évite les coupures. `showStack()` (`js/opening.js`) monte la pile complète *et* le paquet par-dessus, puis `packOpen()` déroule la séquence :

1. Le paquet de l'écran Boosters grossit et se fond — on plonge dedans (`.pack.tear`).
2. Le paquet tremble en 3D, un trait lumineux coupe le haut, la bande se détache en dents de scie et bascule vers l'arrière en s'assombrissant (`riptop`, perspective posée par `.stackwrap`).
3. La classe `packed` est retirée : la pile, jusque-là tassée *dans* le paquet (`translateY(17%) scale(.82) rotateX(-16deg)`), revient à sa position de repos en une seule transition. Les six cartes sortent alignées et se présentent de face pendant que le paquet vide bascule et descend hors champ.

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

### Les Secrets

`SECRETS` (`js/config.js`) prolonge la grille de collection avec des emplacements numérotés à la suite des cartes existantes (#123 à #127 aujourd'hui) mais **hors du total** : la barre de progression reste sur 122. Ils s'ajoutent dans la même grille, juste après la dernière carte (`secretCells()`), et disparaissent dès qu'un filtre est actif puisqu'ils n'ont encore ni catégorie ni essence. Mets `SECRETS = 0` pour les masquer ; ajoute les vraies cartes dans `js/cards-data.js` quand elles sortent, et baisse `SECRETS` d'autant.

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

## Le recyclage

Les doublons deviennent des Éclats. Toutes les raretés se recyclent sauf les Promos, et **on garde toujours un exemplaire** de chaque carte : recycler ne fait jamais reculer la collection. Les exemplaires proposés dans une demande d'échange encore en attente sont mis de côté — sinon l'échange, une fois accepté, prendrait le dernier.

| Rareté | Éclats |
|---|---|
| Essence | 5 |
| Commune | 10 |
| Peu commune | 20 |
| Rare | 100 |
| Épique | 500 |
| Légendaire | 1 000 |

**Le plafond : 1 500 Éclats par semaine**, remis à zéro le lundi (heure de Paris, comme les quêtes hebdomadaires). Il n'est pas décoratif. Une fois la collection bien avancée, un booster recyclé rend ~260 Éclats — la dernière carte est une Rare quatre fois sur cinq, et une Rare vaut 100. Sans plafond, un joueur régulier aurait touché 7 000 à 10 000 Éclats par semaine au recyclage, quatre fois ce que paient les quêtes ; et comme un booster acheté 350 en rend ~260, racheter des boosters avec faisait passer de 42 à ~135 boosters par semaine. La collection allait trois fois plus vite, et les Promos de la boutique tombaient en quelques jours. À 1 500, le recyclage ajoute ~70 % aux Éclats des quêtes et ~10 % de boosters : il aide, il ne remplace pas le temps. Le calcul est en tête de `supabase/12_recyclage.sql`.

**Pas de bêtise.** On choisit carte par carte, exemplaire par exemplaire ; « Tout sélectionner » laisse les Épiques et les Légendaires de côté. Un récapitulatif liste chaque carte et ce qu'elle rapporte — avec une case à cocher s'il y a une Épique ou une Légendaire dedans —, puis une dernière confirmation dont le bouton ne répond qu'au bout de trois secondes. Le serveur revérifie tout (doublons, réservations, plafond) et refuse l'envoi entier si un seul point ne tient pas. Chaque recyclage est journalisé dans la table `recyclages`.

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

Un joueur régulier gagne environ **300 Éclats par jour** (quotidiennes + hebdomadaires, sans compter les échanges qui demandent un partenaire).

| Article | Prix | À 300/jour |
|---|---|---|
| Un booster | 350 | un peu plus d'une journée |
| Dix boosters | 3 000 | dix jours |
| Jeton d'échange | 250 | moins d'une journée |
| Un cadre | 1 200 à 6 000 | de quatre à vingt jours |
| **Une carte Promo** | 10 000 | **un mois d'épargne** |

Tout dépenser en boosters n'accélère la collection que d'environ **17 %** — 94 jours au lieu de 110. C'est le réglage qu'on cherchait : les Éclats aident, ils ne remplacent pas le temps. Et à 10 000, une carte Promo coûte assez cher pour que « j'ouvre, ou j'économise » soit une vraie décision plutôt qu'un réflexe.

Le détail du calcul est en tête de `supabase/04_seed.sql`, à côté des valeurs elles-mêmes.

## Quêtes et boutique

Les quêtes paient en **Éclats**, la seule monnaie du jeu. La boutique les dépense. Aucun achat avec de l'argent réel, nulle part.

La progression d'une quête n'est **jamais** envoyée par le navigateur : c'est le serveur qui l'incrémente au moment où l'événement arrive vraiment, dans `open_pack()` et `trade_respond()`. C'est pour ça que toutes les quêtes portent sur des choses qu'il peut constater lui-même — boosters ouverts, cartes inédites, raretés sorties, échanges conclus, jours de connexion, pourcentage de collection.

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

Les deux paliers ne donnent **que** la carte, zéro Éclat. Une récompense qui paie deux fois dilue les deux : on se souvient d'avoir débloqué la carte, pas d'avoir touché six mille Éclats en même temps. Même chose pour les 500 boosters, qui donnent le **Cadre Sceau** — le seul objet du jeu qu'aucune boutique ne vend.

Elles vivent dans `promos`, jamais dans `cards` : c'est ce qui garantit que « 122 » reste 122 partout, et que le pourcentage de collection ne bouge pas quand on en ajoute une. Côté serveur, la colonne `cards.promo` les exclut du tirage (`pick_card`) et du calcul d'avancement (`sync_collection_quests`).

Les deux cartes de palier sont accordées par `check_promos()` (`supabase/03b_promos.sql`), appelée depuis `me()` et `open_pack()`. L'insertion est idempotente : une carte déjà possédée n'est pas redonnée, sinon le compteur d'exemplaires grimperait tout seul à chaque rafraîchissement.

> **Pourquoi 75 % et non 50 %.** La moitié de l'extension se fait en une dizaine de paquets, c'est-à-dire le deuxième jour. Une récompense décrochée le deuxième jour n'en est pas une. À 75 % il faut une bonne semaine de jeu régulier, et ça laisse les 100 % — cent dix jours — comme dernier sommet.

> **Pourquoi des emplacements pour P03 et P04.** Une série se lit entière ou pas du tout : un trou entre P02 et P05 se lirait comme un bug plutôt que comme une suite à venir. Les deux cases portent « Coming soon… », et le compteur affiche bien `/ 6`. La liste est dans `PROMOS_A_VENIR` (`js/config.js`) : le jour où les images arrivent, on déplace la ligne vers `js/promos-data.js`.

**L'obtention a sa propre scène** (`js/promos.js`, `css/promo.css`) : la carte arrive de loin, dos tourné, se retourne, et le nom tombe. Rien à toucher avant la fin — le bouton ne devient cliquable qu'une fois la carte révélée, sinon un doigt posé au hasard fermait la scène avant le retournement. La détection suit le même principe que les quêtes : on compare deux états successifs envoyés par le serveur, et une file d'attente enchaîne les cartes si plusieurs tombent ensemble.

## Thème clair et sombre

Deux palettes, une seule liste de noms, dans `css/tokens.css`. Le sombre est la référence — c'est là que les cartes brillent — et le clair reprend chaque jeton un par un. **Aucune couleur n'est écrite en dur ailleurs :** une feuille qui poserait un `#181320` serait juste dans un thème et fausse dans l'autre.

Le réglage vit sur `<html>` : `data-theme="dark"` ou `"light"`. En « automatique », l'attribut est **retiré** — c'est la requête média qui décide, et elle suit le système en direct sans qu'on ait à l'écouter. Le choix est rangé dans le navigateur, pas sur le compte : il décrit cet écran-ci, et on peut vouloir le clair sur le téléphone et le sombre sur l'ordinateur.

Trois surfaces ne suivent pas le thème : le **théâtre d'ouverture**, la **visionneuse** et la **scène des Promos**. Ce sont des salles obscures — une carte se regarde sur du noir. Elles redéclarent donc la palette sombre pour tout ce qu'elles contiennent (bas de `css/tokens.css`) : sans ça, une couleur de rareté calculée pour du papier blanc — l'or à `#a06b00` — se retrouverait posée sur du noir, où elle disparaît.

Les visuels de marque sont l'autre exception. Le logo du jeu, celui de l'extension et la pastille « 1re édition » sont des images pensées pour du noir : du blanc, de l'argenté, des halos. En thème clair, elles reçoivent une **plaque sombre taillée à leur forme** plutôt qu'un filtre — c'est ce que fait n'importe quelle charte quand un logo n'existe qu'en version claire.

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

**L'accès est nominatif.** Il n'y a plus de code à saisir : on se connecte avec son compte
Discord, et c'est le serveur qui vérifie que ce compte figure dans la table
`beta_invites`. On invite, on retire, on regarde qui est entré depuis
`supabase/09_beta.sql`.

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

- les cinq ouvertures de test (normale, rare, épique, légendaire, godpack) ;
- **l'animation d'obtention de chaque carte Promo**, une par une ou toutes à la suite — c'est exactement ce que verra un joueur, seule l'écriture dans la collection est sautée ;
- les notifications qui passent en haut de l'écran, dont le ping de la boîte de réception ;
- **publier une annonce** dans la boîte de réception de tous les joueurs ;
- la collection remplie à 90 %, pour regarder la grille et la jauge dans un état intermédiaire ;
- un tableau des valeurs d'équilibrage en cours, telles que le serveur les impose.

Pour obtenir une Promo **pour de vrai** sur son compte — et vérifier la détection, la boutique et les paliers de bout en bout — les requêtes sont commentées en bas de `supabase/03b_promos.sql`.

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
