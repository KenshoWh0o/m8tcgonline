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
├── tools/              Petits scripts de maintenance (Python, sans dépendance)
│   ├── build-sql.py    Assemble supabase/TOUT.sql
│   └── gen-icons.py    Régénère icônes, favicons et image de partage
├── supabase/           Tout le code serveur : tables, sécurité, actions du jeu
│   ├── TOUT.sql        Les quatre fichiers ci-dessous, en un seul (assemblé)
│   ├── 01_schema.sql   Tables, règles d'accès, recharge des boosters
│   ├── 02_cards.sql    Catalogue des cartes (généré depuis js/cards-data.js)
│   ├── 03_rpc.sql      Ouvrir un booster, échanger, encaisser une quête, acheter
│   ├── 04_seed.sql     Quêtes et boutique — c'est ici qu'on équilibre
│   ├── 05_admin.sql    Se donner les droits d'administrateur
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
│   └── hub.css         Onglets v2 + adaptation ordinateur
├── js/
│   ├── config.js       Nom du jeu, habillage, couleurs, raretés, onglets, révélations
│   ├── supabase-config.js  Les deux clés du compte en ligne (vides = hors ligne)
│   ├── utils.js        Outils partagés
│   ├── sfx.js          Les sons, fabriqués à la volée (Web Audio)
│   ├── cards-data.js   La liste des cartes de l'extension
│   ├── cards.js        Transforme cette liste en cartes du jeu
│   ├── storage.js      État global + sauvegarde locale
│   ├── render-card.js  Affichage d'une carte
│   ├── ui.js           Fenêtre modale, avatars, petits blocs répétés
│   ├── backend.js      Un seul jeu d'appels, deux implantations (local / en ligne)
│   ├── auth.js         Écran de connexion et création de compte
│   ├── fx.js           Particules
│   ├── booster.js      Réserve, composition d'un booster, écran du paquet en 3D
│   ├── opening.js      Pile 3D, révélation, godpack, récap
│   ├── collection.js   Onglet Collection
│   ├── viewer.js       Visionneuse 3D
│   ├── trade.js        Onglet Échanges
│   ├── quests.js       Onglet Quêtes
│   ├── shop.js         Onglet Boutique
│   ├── battle.js       Onglet Combats (à venir)
│   ├── profile.js      Onglet Profil
│   ├── settings.js     Onglet Réglages
│   ├── pwa.js          Ajout à l'écran d'accueil, service worker
│   ├── lab.js          Onglet Labo (administrateurs)
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
| Changer les taux de drop ou du godpack | **en ligne :** `open_pack()` dans `supabase/03_rpc.sql` · **hors ligne :** `RATES`, `GOD` dans `js/booster.js` |
| Régler la durée ou les particules d'une révélation | `js/config.js` (`REVEAL`) |
| Modifier l'animation de déchirure du paquet | `showRip()` dans `js/opening.js` + bloc `Déchirure` de `css/booster.css` |
| Modifier les animations de révélation | `css/opening.css` + `doReveal()` dans `js/opening.js` |
| Changer le nombre de boosters gratuits ou le délai | **en ligne :** `cfg()` dans `supabase/01_schema.sql` · **hors ligne :** `TICKET_CAP`, `INTERVAL` dans `js/config.js` |
| Ajouter, retirer ou régler une quête | `supabase/04_seed.sql` |
| Changer les prix ou les articles de la boutique | `supabase/04_seed.sql` |
| Ouvrir ou fermer une méthode de connexion | `CONNEXION` dans `js/config.js` (+ le fournisseur correspondant dans Supabase) |
| Ajouter ou déplacer un onglet | `TABS` dans `js/config.js` (`bas` = barre du bas, `hub` = page « Plus ») |
| Modifier un son | la recette correspondante dans `RECETTES`, `js/sfx.js` |
| Changer la musique d'ambiance | `ACCORDS` et `SFX.musiqueOn()` dans `js/sfx.js` |
| Regénérer l'image de partage et les icônes | `python3 tools/gen-icons.py` |
| Donner les droits d'administrateur | `supabase/05_admin.sql` |
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

Environ un booster sur 2 000 (`GOD`) est un **godpack** : 4 rares, 3 épiques et une légendaire en dernier. Rien ne l'annonce, ni écran, ni mot : voir plus bas.

### L'ouverture

Tout se joue dans **un seul écran, sans jamais remplacer le DOM** : c'est ce qui évite les coupures. `showStack()` (`js/opening.js`) monte la pile complète *et* le paquet par-dessus, puis `packOpen()` déroule la séquence :

1. Le paquet de l'écran Boosters grossit et se fond — on plonge dedans (`.pack.tear`).
2. Le paquet tremble en 3D, un trait lumineux coupe le haut, la bande se détache en dents de scie et bascule vers l'arrière en s'assombrissant (`riptop`, perspective posée par `.stackwrap`).
3. La classe `packed` est retirée : la pile, jusque-là tassée *dans* le paquet (`translateY(17%) scale(.82) rotateX(-16deg)`), revient à sa position de repos en une seule transition. Les huit cartes sortent alignées et se présentent de face pendant que le paquet vide bascule et descend hors champ.

Les délais sont dans `packOpen()`, le reste dans le bloc `Déchirure` de `css/booster.css`.

**Pas de spoiler.** La dernière carte ne reçoit sa classe de rareté que dans `doReveal()` : avant, aucune lueur colorée ne trahit ce qu'il y a dessous. À la place, `bindStack()` écrit `--tilt` sur la scène selon l'inclinaison, et la tranche de la carte s'allume en blanc quand on fait tourner la pile — le spoil devient un geste volontaire.

### Le godpack

Il n'a ni écran, ni lettrage, ni surbrillance carte par carte : **c'est la lumière qui le raconte**, dans la même séquence que n'importe quelle ouverture.

1. Le paquet reste normal, mais `packOpen()` lui accorde 860 ms de plus (`rip-wake`) : l'image s'assombrit (`goddim`), la couture du haut s'allume de plus en plus (`leakwake`) et le tremblement monte (`godtremble`). On sent qu'il y a quelque chose dedans, sans savoir quoi.
2. À la déchirure, la couture explose (`leakflash`) et un faisceau s'échappe par la fente (`.rp-beam`) : un trapèze découpé en `clip-path`, flouté et masqué en radial, qui s'évase vers le haut — un cône de lumière, pas un bloc. La classe `lit` arrive en même temps : la nappe dorée (`.godwash`) inonde la scène, les rayons lents (`.godaura`) apparaissent, la pile prend son halo.
3. Les cartes sortent dans cette lumière et la pluie d'étincelles se relance à mi-parcours pour qu'elle ne s'arrête jamais net.

Dans un godpack, `announce()` **n'ajoute pas** la surbrillance de rareté carte par carte : toutes les cartes sont des hits, les éclairs bleus et violets ne feraient que brouiller l'or. Seule la légendaire finale garde sa révélation complète.

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

### Les Secrets

`SECRETS` (`js/config.js`) prolonge la grille de collection avec des emplacements numérotés à la suite des cartes existantes (#123 à #127 aujourd'hui) mais **hors du total** : la barre de progression reste sur 122. Ils s'ajoutent dans la même grille, juste après la dernière carte (`secretCells()`), et disparaissent dès qu'un filtre est actif puisqu'ils n'ont encore ni catégorie ni essence. Mets `SECRETS = 0` pour les masquer ; ajoute les vraies cartes dans `js/cards-data.js` quand elles sortent, et baisse `SECRETS` d'autant.

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
| Échanges | barre du bas / rail | oui |
| Quêtes | barre du bas / rail | oui |
| Mon profil | tiroir (mobile) · rail (ordinateur) | oui |
| Boutique | tiroir (mobile) · rail (ordinateur) | oui |
| Réglages | tiroir (mobile) · rail (ordinateur) | non |
| Labo | tiroir · rail | **administrateurs seulement** |

Pour déplacer un onglet, il suffit de changer son drapeau : `bas: true` le met dans la barre du bas, `tiroir: true` le range dans le menu du compte.

**La barre du bas ne contient que le jeu.** Cinq places, pas une de plus — les cinq endroits où l'on revient tout le temps. Une pastille y signale ce qui attend : récompenses à encaisser sur Quêtes, demandes reçues sur Échanges.

**Le compte vit dans un tiroir.** Sur mobile, appuyer sur son avatar déplie un panneau depuis le bord droit — celui d'où vient le doigt : pseudo, ressources, profil, boutique, réglages, déconnexion. Un point sur l'avatar prévient quand quelque chose y attend.

**Sur ordinateur, il n'y a pas de tiroir** : le rail a la place d'afficher les deux groupes, séparés par un filet, et l'avatar mène directement au profil. Inutile de cacher derrière un menu ce qui tient à l'écran.

**Mobile d'abord.** La barre du bas tient cinq onglets au pouce ; à partir de 900 px de large elle devient un rail vertical à droite, et les feuilles modales se centrent au lieu de monter du bas. Toute l'adaptation ordinateur tient dans un seul bloc `@media` en bas de `css/hub.css`.

Sur ordinateur, la page est une **grille** (en-tête sur toute la largeur, puis contenu et rail), et non un flex qui passe à la ligne : avec `flex-wrap`, le navigateur répartit la hauteur restante entre les lignes, et l'en-tête s'allongeait dès qu'une page avait peu de contenu.

> Les règles de la barre du bas sont accrochées à `#nav`, jamais à l'élément `<nav>` : le panneau du tiroir en est un aussi, et héritait sinon de sa mise en colonne.

**L'en-tête montre toujours les deux compteurs et l'avatar**, même hors ligne. Ce sont les seules portes vers la boutique et vers le menu du compte : les cacher revenait à cacher qu'ils existent.

## Échanges

Une carte contre une carte, **de rareté identique**, et jamais en simultané : quelqu'un propose, l'autre répond quand il veut, et l'échange ne se fait que si les deux ont validé.

Le coût est payé par celui qui lance la demande : **une demande gratuite toutes les 6 heures**, ou un **jeton d'échange** acheté en boutique pour ne pas attendre. Le délai et le jeton sont vérifiés par le serveur, pas par la page.

Au moment où la demande est acceptée, le serveur revérifie **tout** : que les deux joueurs possèdent encore leur carte, que les raretés correspondent toujours, et il échange les deux cartes dans une seule transaction. Personne ne peut donner deux fois la même carte en lançant deux demandes.

## Quêtes et boutique

Les quêtes paient en **Éclats**, la seule monnaie du jeu. La boutique les dépense : des boosters, des jetons d'échange, des cadres d'avatar. Aucun achat avec de l'argent réel, nulle part.

La progression d'une quête n'est **jamais** envoyée par le navigateur : c'est le serveur qui l'incrémente au moment où l'événement arrive vraiment, dans `open_pack()` et `trade_respond()`. C'est pour ça que toutes les quêtes portent sur des choses qu'il peut constater lui-même — boosters ouverts, cartes inédites, raretés sorties, échanges conclus, jours de connexion, pourcentage de collection.

Objectifs, récompenses, articles et prix sont tous dans `supabase/04_seed.sql`. On équilibre là, on rejoue le fichier, c'est pris en compte : ni déploiement, ni mise à jour du site.

## Les sons

Aucun fichier audio dans le dépôt : tout est **fabriqué à la volée** par le navigateur (`js/sfx.js`, Web Audio). Rien à télécharger, rien à héberger, aucune question de droits, et le son part à l'instant où on touche l'écran.

Chaque son est une recette courte dans `RECETTES` : quelques souffles de bruit filtré pour tout ce qui frotte, glisse ou se déchire, quelques notes pour les clics et les carillons. La déchirure du paquet, le passage d'une carte, la montée avant une révélation et les trois paliers de carillon (rare, épique, légendaire) sont branchés dans `js/opening.js`.

La **musique d'ambiance** est un tapis de quatre accords qui tournent lentement, avec un souffle très filtré par-dessus. Volontairement discrète, et **coupée par défaut** : elle s'active dans les Réglages, avec son propre volume.

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

## Administrateurs

L'onglet **Labo** n'est plus accessible à tout le monde. Il n'apparaît que pour les profils marqués `is_admin` en base, et ce drapeau ne peut être posé que depuis le tableau de bord Supabase (`supabase/05_admin.sql`) : aucune fonction du jeu ne l'expose, et le navigateur n'a pas le droit d'écrire dans la table des profils.

Cacher un bouton ne protège rien — ce qui protège, c'est que le serveur refuse les actions. Les boutons du Labo qui touchent à la collection ne modifient que l'affichage local : en ligne, la vérité reste celle du serveur, et la page la récupère telle quelle au rafraîchissement suivant.

## Dépendances externes

- **Polices Google Fonts** (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.
- **supabase-js**, chargé depuis un CDN, uniquement pour le compte en ligne. S'il est absent (hors réseau, bloqueur), le jeu bascule tout seul en mode hors ligne.

Aucune autre bibliothèque, aucune étape de compilation : tout le reste est dans le dépôt.
