# Mate TCG Online

Jeu de collection de cartes façon TCG Pocket. Les 122 cartes de l'extension *Tout commence ici* sont livrées avec le jeu : on ouvre des boosters, on remplit sa collection, et on échange avec les autres joueurs.

Le site est fait de fichiers statiques — aucune étape de compilation, aucun paquet à installer. Il fonctionne dans **deux régimes** :

- **Hors ligne.** Rien à configurer : la progression est enregistrée dans le navigateur de l'appareil (IndexedDB). **Ce régime n'est plus proposé aux joueurs : on ne joue qu'en se connectant avec Discord** (`porteVisible()`, `js/auth.js`). Sans serveur joignable, le site affiche l'écran de connexion avec « Réessayer ». Il n'y a plus de « jouer sans compte ».
- **En ligne.** Un projet [Supabase](https://supabase.com) gratuit apporte les comptes, la collection sauvegardée sur le compte, un cooldown que la montre du téléphone ne peut pas tromper, les échanges, les quêtes et la boutique. Marche à suivre : **[SETUP.md](SETUP.md)**.

La connexion se fait **par Discord**, en un clic : le public du jeu y est déjà, le pseudo et l'avatar arrivent tout faits, et surtout aucun courriel n'est envoyé — donc aucun joueur bloqué faute d'avoir reçu son lien. L'inscription par adresse existe dans le code et se rouvre en passant `email` à `true` dans `CONNEXION` (`js/config.js`).

Le jeu bascule tout seul : tant que `js/supabase-config.js` est vide, il tourne hors ligne.

> **Rien ne se paie avec de l'argent réel.** La monnaie du jeu, les *Éclats*, se gagne uniquement en accomplissant des quêtes.

## À lire en premier

Pour reprendre le travail sans rien demander au propriétaire. Ce README est la référence de la ligne 2.x ; `CLAUDE.md` en donne les règles, `docs/feuille-de-route.md` ce qui est prévu et le calendrier.

**L'état du projet (3 novembre 2026).**
- **Le lancement public a été annulé** le 24 septembre 2026, après échange avec Gentle Mates : l'écran d'entrée affiche « Projet annulé · Merci » (`vAnnonceArret()`, `js/gate.js` ; dans la DA de la 3.0 depuis le 1er novembre) et seuls les comptes invités jouent (`beta_lancement()` vaut `infinity`, voir « Écran d'entrée et bêta fermée »). Le jeu vit pour eux.
- **Le vrai site** (racine de `main`) est la **2.5 du 25 octobre, en ligne avant sa sortie** (publiée le 25 à 02 h 22 UTC avec l'accord du propriétaire, `e9f0c36`) : L'Échauffement devenu un événement complet (Braises, Pass, quêtes, boutique, classement, récap) sur la charpente de l'écran Reflets, son mode sans fin à partir du 4 novembre, la fin de combat en scène, l'entrée en face-à-face, la révélation des 21 étoiles, le Labo refait, les Reverses recyclables et fabricables. Il se montre en 2.1.3, avec le récap de Reflets et le teasing de la 2.5, jusqu'au **lundi 26 octobre 2026, 0 h (heure de Paris)**, puis bascule tout seul en 2.5.
- **La vraie base a la mise à jour 2.5 complète** (`MAJ-2.5.sql`, collé par le propriétaire le 25 octobre vers 02 h 35 UTC, après le site) : elle est identique à une installation neuve de la branche — 118 fonctions (définitions et droits), 236 colonnes, 37 tables, 11 règles d'accès, le déclencheur de L'Échauffement, et le même contenu (Pass, quêtes, boutique, défis, indices, adversaires du mode sans fin, calendrier). Le détail, et ce qu'il a fallu corriger (des fins de ligne Windows) : « La mise en ligne » plus bas.
- **La 3.0** se développe sur `version-3.0` et se teste en pré-prod (`matetcg.com/preprod/`). **Sa date est fixée** (le propriétaire, 2 novembre au soir) : maintenance dans la nuit du lundi 9 au mardi 10 novembre 2026 à 0 h, sortie dans la nuit du mardi 10 au mercredi 11 à 0 h (heure de Paris) ; le récap de L'Échauffement l'annonce (`PROCHAINE`, `js/config.js`). Depuis le 2 novembre 2026, une **démo** en est aussi servie à `matetcg.com/demo/` : celle que le propriétaire envoie à Gentle Mates, derrière un code d'accès, qui montre le jeu à son premier jour (ni version, ni nouveautés ; README de la 3.0, « Les démos »).
- **Le 2 novembre 2026**, le propriétaire a supprimé la branche `version-2.5` (tout son contenu est à la racine de `main`) ; `prebuild/` est retiré ; la doc, le SQL et les outils ne sont plus servis par matetcg.com (`_config.yml`, règle 10 de `CLAUDE.md`). On ne touche plus à la 2.x : la 3.0 est imminente. Une retouche depuis, à la demande du propriétaire : la date de la 3.0 dans le récap de L'Échauffement (3 novembre, « Version 2.5 » plus bas).

**Où vit quoi.** La racine de `main` (le vrai site, la 2.x, et ce README), `main/preprod/` (la démo de la 3.0, où le propriétaire la teste), `main/demo/` (la démo de la 3.0 envoyée à Gentle Mates), la branche `version-3.0` (la 3.0, son propre README). `version-2.5` et `prebuild/` n'existent plus depuis le 2 novembre 2026. Le tableau complet est dans « La pré-prod ».

**La direction artistique de la 2.x, en bref** (le détail : « Habillage », « Les onglets », « Le thème ») :
- **sombre uniquement** : des fonds noirs teintés prune, des jetons dans `css/tokens.css` (une feuille prend un jeton, pas une couleur en dur) ;
- **une seule couleur d'interface, le violet** : `--accent` `#8936ff`, `--accent-soft` `#a95cf2`, le rebord `#57189e` sous ce qui se presse ; les raretés gardent leurs couleurs (bleu, violet, or) ; l'orchidée et le rose du logo ne servent qu'au logo ;
- **les polices** : Archivo (titres, en italique très gras) et Figtree (texte), chargées depuis Google Fonts ;
- **le ressenti « jeu de cartes mobile »** : boutons, puces et pastilles ont un rebord plein dessous qui s'enfonce au clic ; icônes au trait, sauf l'étoile du logo (Boosters) ;
- **mobile d'abord** : barre du bas de cinq onglets, tiroir du compte ; à partir de 900 px, un rail à droite ;
- **L'Échauffement a la charpente de l'écran Reflets** (ses composants `.rf-*` et `.rr-*`, `css/reflets.css`), avec les couleurs de l'événement à la place du rose de Reflets : la braise (l'ambre) et la lavande de la 3.0 (`.ech-rf`, en fin de `css/hub.css`), sur les fonds, les textes et les boutons du site — un mélange de la 2.0 et de la 3.0 voulu par le propriétaire (25 octobre 2026), pas une DA à part ; aucune page ne défile d'un tout petit peu (règle 8 de `CLAUDE.md`).
Ce qui est hors de cette DA (la palette « Graphite et lavande » partout, les nouveaux écrans) est la 3.0 : ne pas l'importer dans la 2.x sans demande.

**Liste de reprise.**
1. Lire `CLAUDE.md`, ce README et `docs/feuille-de-route.md` (importés d'office dans Claude Code : il faut quand même les lire en entier).
2. `git fetch origin` : comparer avec `origin/main` et `origin/version-3.0`, jamais avec une branche locale en retard.
3. Le prébuild (`prebuild/`), où la 2.x en préparation se testait, est retiré depuis le 2 novembre 2026 : ne plus le reconstruire ni le publier.
4. Tester le SQL sur un PostgreSQL 16 local (la base de `main`, puis la mise à jour deux fois), l'interface dans Chromium aux quatre tailles (390 × 844, 375 × 667, 360 × 740, 1 280 × 800).
5. Avant tout SQL sur la vraie base : l'accord du propriétaire, et la comparaison des fonctions (`CLAUDE.md`).
6. Ce qui n'est pas propre à la 2.x se reporte dans la 3.0 (`docs/feuille-de-route.md`, § 5).
7. Commiter et pousser au fur et à mesure : le conteneur d'une session peut être remplacé sans prévenir.

## Lancer le projet

**Le plus simple :** double-clique sur `index.html`. Le jeu s'ouvre dans ton navigateur.

**Recommandé pour développer :** ouvre le dossier dans VS Code, installe l'extension *Live Server*, puis clic droit sur `index.html` › *Open with Live Server*. La page se recharge toute seule à chaque modification.

Autre option, si Node.js est installé : `npx serve .` dans le dossier, puis ouvre l'adresse affichée.

> Chaque adresse a sa propre sauvegarde. Si tu passes d'un double-clic à Live Server ou à un site en ligne, tes cartes sont toujours là, mais la progression repart de zéro.

## Mettre en ligne

- **GitHub Pages** : pousse le dossier dans un dépôt GitHub, puis *Settings › Pages › Deploy from branch*. Le dépôt de matetcg.com est privé ; GitHub Pages publie la racine de `main`, sauf ce que `_config.yml` exclut (la doc, le SQL, les outils, le kit presse) et les dossiers qui commencent par `_` ou `.`.
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
├── CLAUDE.md           Consignes pour les agents (règles du propriétaire, quoi lire, quoi tenir à jour)
├── docs/
│   └── feuille-de-route.md  Où on en est, ce qui vient, le calendrier (copie identique sur version-3.0)
├── _config.yml         Ce que GitHub Pages ne publie pas : la doc, le SQL, les outils, le kit presse
├── cards/              Les images des cartes (une par carte, .avif)
├── assets/             Habillage : logos, visuels de booster, dos de carte, essences
│   ├── boosters/       Les quatre visuels de paquet
│   ├── essences/       Les dix symboles d'essence
│   ├── icon-*.png      Icônes de l'application installée (générées)
│   └── og-image.png    Image affichée quand le lien du site est partagé (générée)
├── presse/             Kit presse : visuels prêts à publier et leur mode d'emploi
├── _demo/              Le faux serveur et ses réglages, pour l'ancien prébuild (non publié)
├── tools/              Petits scripts de maintenance (Python, sans dépendance)
│   ├── build-sql.py    Assemble supabase/TOUT.sql
│   ├── demo.py         Fabriquait le prébuild (prebuild/, retiré le 2 novembre 2026)
│   ├── version.py      Pose le numéro de version et marque les fichiers
│   ├── gen-icons.py    Régénère icônes, favicons et image de partage
│   ├── kit-presse.py   Régénère les visuels de presse/visuels/
│   ├── equilibre-reverses.py  Simule le prix de fabrication des Reverses (2.5)
│   └── maj-2.5/        La mise à jour 2.5 de la vraie base : banc PostgreSQL 16 local (banc.sh), trois envois contrôlés (envois.py), leur essai (essai.sh, envoi-24oct.sql), les contrôles en lecture seule (agregat.sql, donnees.sql), les fins de ligne Windows (fix-crlf.sql)
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
│   ├── 22b_echauffement.sql  Version 2.5 : L'Échauffement, sept défis (aussi dans TOUT.sql)
│   ├── 22c_reverses.sql  Version 2.5 : les Reverses se recyclent et se fabriquent (aussi dans TOUT.sql)
│   ├── 22d_admin.sql     Version 2.5 : le Labo (comptes et serveur), la date de sortie (aussi dans TOUT.sql)
│   ├── 22e_echauffement-evenement.sql  Version 2.5 : L'Échauffement devient un événement (Braises, Pass ; aussi dans TOUT.sql)
│   ├── 22f_sans-fin.sql  Version 2.5 : le mode sans fin, un défi par jour après la saison (aussi dans TOUT.sql)
│   ├── calendrier-2.5.sql  Les dates de fin octobre 2026 : Reflets, son récap, la sortie de la 2.5 (rejouable)
│   ├── MAJ-2.5.sql       La mise à jour 2.5 d'un bloc, pour une base en 2.1.0 ou plus (générée : 03, 04, 07, 12, 21, 22b à 22f, calendrier)
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
│   ├── gate.js         Écran d'entrée : l'annonce d'arrêt, l'entrée des invités
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
│   ├── battle.js       Onglet Combats (L'Échauffement pendant sa saison, sinon l'annonce)
│   ├── profile.js      Onglet Profil
│   ├── settings.js     Onglet Réglages
│   ├── bienvenue.js    Fenêtres d'accueil et lien vers le Discord
│   ├── pwa.js          Ajout à l'écran d'accueil, service worker
│   ├── lab.js          Onglet Labo (administrateurs)
│   ├── echauffement.js L'Échauffement : sept défis dans l'onglet Combats (2.5)
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
| Dater la sortie d'une version (le site en ligne avant, qui bascule tout seul) | `SORTIE` dans `js/config.js` **et** `parametres.sorties` (posée par `supabase/calendrier-2.5.sql`, réglable dans le Labo) ; les fonctions dans `js/pwa.js` |
| Changer les dates de la 3.0 annoncées par le récap de L'Échauffement | `PROCHAINE` dans `js/config.js` (affichées par `vEchSuite30()` et `montrerEchRecap()`, `js/echauffement.js`) |
| Changer la fenêtre des nouveautés d'une version | `NOUVEAUTES_25` et `montrerNouveautes25()` dans `js/bienvenue.js` (une ligne par nouveauté), et la section « Version 2.5 » de ce README |
| Changer le nombre de boosters gratuits ou le délai | **en ligne :** `cfg()` dans `supabase/01_schema.sql` · **hors ligne :** `TICKET_CAP`, `INTERVAL` dans `js/config.js` |
| Ajouter, retirer ou régler une quête | `supabase/04_seed.sql` |
| Publier une annonce à tous les joueurs | Labo › *Annonce à tous les joueurs*, ou à la main en bas de `supabase/11_boite.sql` |
| Changer les prix ou les articles de la boutique | `supabase/04_seed.sql` |
| Ouvrir le site au public (projet annulé : rien ne le prévoit) | `PORTE.active` dans `js/gate.js` **et** `beta_lancement()` dans `supabase/01_schema.sql` (« Écran d'entrée et bêta fermée ») |
| Modifier la mention légale | `MENTIONS` dans `js/config.js` (elle s'affiche aux trois endroits d'un coup) |
| Changer l'adresse du Discord | `DISCORD_URL` dans `js/config.js` (elle est citée à cinq endroits) |
| Inviter quelqu'un à la bêta | `supabase/09_beta.sql` |
| Changer la date d'ouverture (aujourd'hui `infinity`) | `beta_lancement()` dans `supabase/01_schema.sql` — et nulle part ailleurs |
| Ouvrir ou fermer une méthode de connexion | `CONNEXION` dans `js/config.js` (+ le fournisseur correspondant dans Supabase) |
| Ajouter ou déplacer un onglet | `TABS` dans `js/config.js` (`bas` = barre du bas, `hub` = page « Plus ») |
| Modifier un son | la recette correspondante dans `RECETTES`, `js/sfx.js` |
| Regénérer l'image de partage et les icônes | `python3 tools/gen-icons.py` |
| Donner les droits d'administrateur | `supabase/05_admin.sql` |
| Changer ce que rapporte le recyclage, ou le coût d'une carte fabriquée | `cfg()` dans `supabase/01_schema.sql` (clés `recyclage_*` et `fabrication_*`) |
| Changer le prix d'une Reverse fabriquée | `prix_reverse()` dans `supabase/22c_reverses.sql` (+ `REV_DEFAUT`, `js/recyclage.js`, et `prixReverse`, `_demo/serveur.js`) ; le calcul : `python3 tools/equilibre-reverses.py` |
| Déplacer l'ouverture des Reverses, ou les ouvrir tout de suite | Labo › Serveur › Ajuster (`labo_reverses`), ou à la main : `parametres.reverses_des` (posée par `supabase/calendrier-2.5.sql`), `parametres.fabrication_reverse` |
| Changer la fréquence des Essences Brillantes ou de la carte unique | `cfg('foil_odds')`, `cfg('chasse_odds')` dans `supabase/01_schema.sql` (+ `FOIL_ODDS` dans `js/config.js` pour le Labo) |
| Lancer un événement, ouvrir la chasse | requêtes en bas de `supabase/15_evenements.sql` |
| Ajouter ou modifier un succès | `succes_de()` dans `supabase/15_evenements.sql` **et** `SUCCES` dans `js/config.js` |
| Changer les critères du classement | `classement()` dans `supabase/14_classement.sql` + `CRITERES` dans `js/classement.js` |
| Publier ou retirer un fichier de la racine sur matetcg.com | `_config.yml` (`exclude`) : la doc, le SQL, les outils et le kit presse n'y sont pas, à la demande du propriétaire (règle 10 de `CLAUDE.md`) |
| Régler la démo (pseudo, Éclats de départ, recharge) | `_demo/reglages.js` |
| Accepter d'autres champs de carte | `makeCard()` dans `js/cards.js` |
| Déplacer la saison de L'Échauffement | Labo › Serveur (« Aller à un état », « Avancer d'un jour » : `labo_calendrier`, `labo_decaler`), ou `ech_saison` à la main ; en démo, les mêmes boutons |
| Ajouter un outil au Labo | une fonction `labo_*` dans `supabase/22d_admin.sql` (qui commence par `labo_garde()`), sa jumelle `RPC.labo_*` dans `_demo/serveur.js`, le bouton dans `js/lab.js` (`labAction`), et la section « Administrateurs » de ce README |
| Changer le calendrier officiel de la 2.5 | `calendrier_officiel()` dans `supabase/22d_admin.sql` (la seule copie côté serveur) **et** `SORTIE` dans `js/config.js`, et `CAL_OFFICIEL` dans `_demo/serveur.js` |
| Changer un défi, une Défense ou un indice de L'Échauffement | `ech_defis` / `ech_indices` dans `supabase/22b_echauffement.sql` **et** `ECH_DEFIS` / `ECH_INDICES` dans `_demo/serveur.js` |
| Préparer une mise à jour de la vraie base, ou la vérifier après coup | `bash tools/maj-2.5/banc.sh`, puis `python3 tools/maj-2.5/envois.py`, puis `bash tools/maj-2.5/essai.sh` (les rejoue sur deux copies du modèle) ; avant : la vraie base doit donner les agrégats de `ref` (`tools/maj-2.5/agregat.sql`) ; après : les agrégats et `tools/maj-2.5/donnees.sql` de `cible` ; un fichier collé depuis Windows : `tools/maj-2.5/fix-crlf.sql` |
| Changer une règle du combat de L'Échauffement | `ech_combat` (SQL, `22b_echauffement.sql`) **et** `echCombat` (`js/echauffement.js`) : à la ligne près, puis refaire le test de parité |
| Changer le Pass, les quêtes ou la boutique de L'Échauffement | le Pass : `evt_piste` dans `supabase/22e_echauffement-evenement.sql` (+ `ECH_PISTE`, `js/echauffement.js`, copie pour les aperçus et la démo) ; quêtes et boutique : `supabase/04_seed.sql` (+ `QUETES`, `BOUTIQUE` dans `_demo/serveur.js`) ; ce que rapportent les étoiles : `ech_terminer` (`22b`) et `ECH_PRIX`, `ECH_BRAISES` (`js/echauffement.js`, `_demo/serveur.js`) |
| Changer un adversaire du mode sans fin, ou ce qu'il rapporte | `ech_sf_adversaires` dans `supabase/22f_sans-fin.sql` **et** `ECH_SF` dans `_demo/serveur.js` (recalibrer la Défense par simulation : en-tête du fichier) ; les Éclats : `ech_sf_terminer` (`22f`) et `ECH_SF_PRIX` (`js/echauffement.js`, `_demo/serveur.js`) |

## Le faux serveur

Le prébuild (« Le prébuild », plus bas) est le jeu **entier, sans compte ni serveur** : boosters, collection, quêtes, boutique, recyclage, profil, amis, échanges et boîte de réception. Tout est enregistré dans le navigateur de celui qui l'ouvre. La démo autonome en zip qui s'en fabriquait (`python3 tools/demo.py` sans option, avec `_demo/LISEZMOI.txt`) a été **retirée le 2 novembre 2026** à la demande du propriétaire.

**Comment ça marche.** Le jeu ne parle au serveur que par le client Supabase (`Backend.sb`). Le prébuild remplace la bibliothèque Supabase par un faux client (`_demo/serveur.js`) qui répond aux mêmes appels avec les mêmes réponses : chaque fonction y est la traduction de sa jumelle SQL, citée en commentaire. Le code du jeu est copié tel quel : **rien ne change sur le site**, et le site ne contient pas le faux serveur — GitHub Pages ne publie pas les dossiers qui commencent par `_`.

**Les autres joueurs sont simulés** : Lumen et Mira sont amis dès le départ, Kairo envoie une demande d'ami peu après l'arrivée, Nova.92 attend qu'on l'ajoute. Ils acceptent les demandes d'ami, répondent aux échanges (le premier est toujours accepté s'il est possible, les suivants trois fois sur quatre) et proposent des échanges de temps en temps.

> **À garder synchronisé.** Les quêtes, la boutique, les taux de drop, `cfg()` et les règles des actions sont recopiés dans `_demo/serveur.js`. Quand ils changent dans `supabase/`, il faut les changer là aussi, puis relancer `tools/demo.py --prebuild`. Le script s'arrête avec un message clair si `index.html` ou `sw.js` ont changé au point qu'il ne s'y retrouve plus.

Pour repartir de zéro dans la démo : ajouter `?reinitialiser` à la fin de l'adresse.

## Composition d'un booster

Six cartes, dans l'ordre de révélation (`makeBooster()`, `js/booster.js`) :

| Carte | Contenu |
|---|---|
| 1 et 2 | Commune |
| 3 | **Peu commune garantie** |
| 4 | Essence — Brillante une fois sur 50 |
| 5 | **Une Reverse** (version 2.0) : Commune 50 %, Peu commune 35 %, Rare 15 % (`RATES.REVERSE`) |
| 6 | Le hit : rare, épique ou légendaire (`RATES.HIT` = 80 / 16 / 4 %) |

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
| Reverse Commune | 2 | 400 |
| Reverse Peu commune | 5 | 500 |
| Reverse Rare | 20 | 2 400 |

Les Reverses se recyclent et se fabriquent depuis la version 2.5 (« Version 2.5 », point « Les Reverses ») : elles rapportent comme leur classique, et coûtent le prix de leur vraie rareté.

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

**Les Reverses** (`r001`…) : chaque Commune, Peu commune et Rare de l'extension existe aussi en Reverse — 85 cartes, même illustration, avec un reflet sur tout ce qui n'est pas l'image et le logo *Tout Commence Ici* frappé dans le coin de l'illustration (`.card.rev`, `css/cards.css`). Côté serveur ce sont des lignes de `cards` avec `reverse = true` (`supabase/03b_promos.sql`), côté navigateur des copies construites au démarrage (`buildReverses()`, `js/cards.js`). Une par booster, en 5ᵉ carte. Elles ne s'échangent que contre une autre Reverse. Leur recyclage et leur fabrication, fermés au lancement de la 2.0 (sinon les Fragments accumulés auraient rempli la collection Reverse d'un coup), **ouvrent à la fin de Reflets**, le vendredi 23 octobre 2026 à minuit, au prix de leur vraie rareté : voir « Version 2.1.4 », point « Les Reverses ».

**La Collection** a trois vues : Classiques (les 122), Reverses (les 85) et Spéciales (Promos, Brillantes, carte unique), sous une jauge commune. Une classique dont on a aussi la Reverse porte un petit éclat nacré à côté de son numéro. Dans les listes sans image, une Reverse garde le nom de sa carte, suivi du même éclat (`nomH()`, `js/utils.js`).

**Titres, bannière, devise.** Un titre s'affiche sous le pseudo (profil, fiche, classement). Il se gagne par les succès, les quêtes jalons, le Pass de l'événement ou la boutique (`TITRES`, `js/config.js` ; `titres_de()`, `supabase/21_reflets.sql`). La bannière est une carte qu'on possède, en fond de fiche ; la devise, une phrase de 80 signes. Tout passe par `personnaliser()`. Les cadres Prisme, Sceau, Maître, Reflet, Aurore, Miroir et Nébuleuse sont des cadres décorés, à la manière des décorations d'avatar de Discord : une illustration animée qui entoure l'avatar et déborde de son cercle (`fx` dans `FRAMES` ; un SVG par cadre dans `assets/cadres/`, généré, ses animations dedans).

**L'événement Reflets** (`code = 'reflets'` dans `evenements`) remplace Combats dans la barre du bas tant qu'il dure. Sa monnaie, les **Prismes**, ne se gagne que par ses quêtes (quotidiennes `ev_jour` et de l'événement `ev`, colonne `evenement` de `quests`). Tout Prisme gagné fait avancer un **Pass** de 20 paliers (table `evt_piste`, le calcul de l'équilibrage est en tête de son tableau) ; en dépenser à la **boutique de l'événement** (`shop_items.devise = 'prismes'`) n'y change rien. L'onglet a six sous-onglets — Accueil (aujourd'hui, et les nouveautés de la 2.0), Quêtes, Pass, Devine l'illu, Boutique, Classement — et un bandeau d'une ligne l'annonce sur l'écran Boosters. La boutique principale n'a plus qu'un lien vers celle de l'événement.

**Devine l'illu** : une illustration de l'extension par jour, la même pour tous. Elle arrive en 9 × 6 pixels ; chaque essai raté la précise (12 × 8, 18 × 12, 36 × 24). Quatre essais. Trouvée au premier : 25 Prismes et 120 Éclats, puis 18/90, 12/60, 6/30 (`illu_gain()`) — les Prismes seulement pendant l'événement. Tout est automatique : les 113 illustrations sont rangées une fois pour toutes dans un ordre secret (tiré du sel `parametres.illu_sel`, créé au hasard à l'installation et jamais montré), et chaque jour prend la suivante — aucune ne revient avant 113 jours, et l'ordre ne se devine pas depuis le code, qui est public. Le serveur garde les pixels (`illu_pixels`, rempli par `supabase/21b_illu.sql`) et n'envoie que la grille du moment : le navigateur ne connaît la carte qu'une fois la partie finie. Quand une illustration change : `node tools/illu-pixels.js`, puis `python3 tools/build-sql.py`.

**Les invitations** s'achètent en boutique : 2 000 Éclats, trois par joueur (`shop_items.limite`). Chaque achat crée un code `M8-XXXX-XXXX`, valable une fois. L'ami se connecte avec Discord, arrive sur l'écran d'entrée, et saisit le code — ou le reçoit tout rempli par le lien `/?invitation=CODE`. Il entre avec un cadeau de bienvenue : 10 boosters hors réserve (en plus des 5 de départ) et 1 000 Éclats. Pour que ce soit possible, **un compte non invité est désormais créé** à la connexion (`handle_new_user`) : il reste bloqué par `garde_beta()` sur toutes les actions du jeu et n'apparaît ni dans la recherche ni dans le classement, mais il peut utiliser un code. **Un invité n'invite pas à son tour** (version 2.1, `est_filleul()`) : sinon chaque nouveau venu ouvrirait la porte à d'autres et la liste d'accès ne voudrait plus rien dire. Le serveur refuse l'achat (`shop_buy`, `creer_invitation`), la boutique ne lui montre pas l'article et ses quêtes d'invitation sont cachées (`me()`). Les codes achetés par un invité avant cette règle et jamais utilisés ont été annulés et remboursés ; ceux déjà utilisés restent valables.

**Après l'événement.** Pendant trois jours, son onglet devient un **récap** (`evenement_recap()`) : le bilan du joueur, le podium, ce qui reste, et un « À suivre » sur les Combats et les Secrets ; le bandeau de l'écran Boosters y mène, et une fenêtre l'annonce une fois. Puis l'onglet disparaît. **Devine l'illu continue** dans son propre onglet (tiroir) : il rapporte toujours ses Éclats (120, 90, 60, 30 selon l'essai), plus de Prismes. Le Labo montre l'onglet récap, la fenêtre et le bandeau avec des chiffres inventés.

**Échanges · Chez tes amis** : les cartes qui te manquent et qu'un ami a en double (`amis_doublons()`), une pression sur l'ami prépare la demande.

**Sortie de la 2.0.** Fusionner la branche dans `main`, puis coller `supabase/TOUT.sql` dans Supabase : il passe sur une base existante sans rien perdre, et lance l'événement Reflets pour 14 jours à partir de ce moment-là.

## Version 2.5 · L'Échauffement, et les Reverses

**Une mise à jour, pas seulement un événement.** Elle s'appelait 2.1.4 jusqu'au 23 octobre 2026 ; le propriétaire l'a renommée 2.5. Elle **sort le lundi 26 octobre 2026 à 0 h, heure de Paris** (dimanche soir minuit, la fin du récap de Reflets) : L'Échauffement commence — un événement complet depuis le 24 octobre, à la hauteur de Reflets (Braises, Pass, quêtes, boutique, classement, récap), suivi d'un mode sans fin —, les Reverses se recyclent et se fabriquent, le jeu passe en 2.5 et le dit par sa fenêtre de nouveautés. Le propriétaire a demandé des idées pour étoffer encore la version : elles sont dans `docs/feuille-de-route.md` (§ 3), à trancher par lui.

### La sortie datée

Le code de la 2.5 peut être en ligne **avant** sa sortie : jusqu'à la minute dite, le jeu se montre tel qu'avant, puis bascule tout seul, page ouverte ou non. Rien à pousser à minuit.

- **La date** : `SORTIE = { version: '2.5', le: '2026-10-26T00:00:00+01:00', avant: '2.1.3' }` dans `js/config.js`. Si le serveur en donne une pour cette version (`me()` › `parametres.sorties`, colonne `parametres.sorties` de `supabase/22d_admin.sql`), c'est la sienne qui compte : le Labo la déplace avec le reste du calendrier. Toujours comparée à l'heure du serveur (`sortieFaite()`, `js/pwa.js`) : avancer la montre du téléphone n'avance rien.
- **Avant** : le numéro lu par le joueur (tiroir, Réglages) est `SORTIE.avant`, « 2.1.3 » (`versionJeu()`) ; la fenêtre des nouveautés est celle de la 2.1 ; le récap de Reflets annonce la 2.5 (la tuile « Version 2.5 » d'« À suivre », avec son compte à rebours, `vTeaser25()` dans `js/reflets.js`, et une ligne dans la fenêtre de fin) ; la Collection › Reverses dit « ouverture avec la 2.5 ». L'onglet Combats garde son annonce « Coming soon ».
- **À la minute dite** : la boucle d'une seconde de `js/app.js` voit `sortieFaite()` changer et redessine ; `prochaineBascule()` (`js/booster.js`) a déjà redemandé l'état au serveur à la fin du récap, à l'ouverture des Reverses et au début de L'Échauffement (`chargerEch()`). Vérifié dans Chromium : page ouverte, le numéro passe de 2.1.3 à 2.5, le récap disparaît, L'Échauffement et son bandeau apparaissent, en moins de 32 s.
- **La fenêtre de la 2.5** (`montrerNouveautes25()`, `js/bienvenue.js`) : « Mise à jour · Version 2.5 », puis une ligne par nouveauté (`NOUVEAUTES_25`, à tenir en accord avec cette section). Une fois par appareil (`NOUVEAUTES_VERSION = '2.5'`), seulement après la sortie (`nouveautesVersion()`), et elle vaut aussi l'annonce de L'Échauffement (`echauffement: 'vu'`) : deux fenêtres pour la même chose, ce serait une de trop. Elle se rouvre depuis Réglages › À propos (« ses nouveautés »). Elle tient sans défiler à 375 × 667.
- **Les marques de cache** : `python3 tools/version.py 2.5` pose `APP_VERSION = '2.5'` et accroche aux fichiers `?v=2.5-<empreinte du code>` : republier la 2.5 avant sa sortie (les ajouts du propriétaire) ne sert jamais une copie périmée.

### L'Échauffement

Un mini-événement juste après Reflets, qui prépare la suite sans rien en dire : **sept défis, un par jour**, dans l'onglet **Combats** (`js/echauffement.js`, styles `.ech-*` en fin de `css/hub.css` ; serveur `supabase/22b_echauffement.sql` ; démo : `RPC.ech_etat`, `RPC.ech_commencer`, `RPC.ech_terminer` dans `_demo/serveur.js`).

- **Le jeu** : on compose une équipe de trois Joueurs de sa collection, dans l'ordre (celui de devant encaisse), et on choisit l'attaque de ceux qui en ont deux. Le combat se joue avec les valeurs imprimées sur les cartes : Défense, coût des attaques (l'élan : chacun gagne 1 élan par tour et frappe dès qu'il en a autant que le coût), dégâts. Deux Joueurs de la même couleur partent avec 1 élan d'avance. Les règles complètes sont en tête du fichier SQL.
- **Le coup d'éclat**, le seul geste pendant le combat : quand un Joueur va frapper, il brille pendant 1,7 s ; le toucher double son coup, **une fois par combat**, avant la Carapace (c'est ce qui permet de la percer). « Passer » déroule la fin sans pause.
- **L'entrée du combat, en face-à-face** (`entree()` dans `echScene`, 25 octobre 2026) : l'adversaire arrive de près, un bandeau traverse l'écran (le numéro du défi — ou « Défi du jour » et son niveau —, le nom de l'adversaire, sa règle ; un filet de braise dessus, de lavande dessous), puis l'équipe monte, carte par carte (`vs`, puis `carte` trois fois). 1,75 s ; un toucher n'importe où l'abrège (« Passer » aussi, qui saute le combat) ; rien avec le mouvement réduit. Pendant le combat, « Bloqué » (la Carapace) est une pastille lisible sur la carte, avec un tintement (`bloque`) ; le coup qui suit le coup d'éclat fait trembler la scène et jaillir des éclats d'or de l'adversaire (`impact`).
- **La fin du combat, en scène** (`echFinEnScene`, demandée par le propriétaire le 25 octobre 2026) : le verdict tombe ; les étoiles se posent une à une dans leurs trois cases, chacune avec sa note, de plus en plus haute (`SFX.jouer('etoile', k)`), et ses éclats ; à trois étoiles, le tampon « Parfait » s'abat (`tampon` : un coup sourd et un carillon), la scène tremble et des braises volent ; puis les gains défilent (Éclats, Braises, boosters, titre) et l'indice gagné attend qu'on le retourne. Les particules passent au-dessus de la scène le temps du combat (`#fx.dessus`). Un toucher sur la fenêtre pose tout d'un coup ; avec le mouvement réduit, tout est posé d'emblée et un seul son joue. Une défaite reste sobre : les cases vides, ce qui a manqué, et le conseil du jour.
- **Le déroulé** : `ech_commencer(jour, équipe)` vérifie l'équipe et **compte l'essai** ; le combat se joue dans la page (`echCombat`, pas à pas) ; puis `ech_terminer(essai, coup d'éclat)` le **rejoue côté serveur** avec le même geste (`ech_simuler`), et c'est ce résultat qui compte. Les deux copies doivent rester identiques à la ligne près ; le faux serveur se sert de `echSimuler`, celle du jeu.
- **Les essais** : **trois par défi et par jour** (jour de Paris), comptés au départ comme l'Épreuve du jour de la 3.0 — un essai abandonné est perdu. Les **jours passés restent jouables**, avec le même plafond : sans rattrapage, un jour manqué ferait perdre son indice pour de bon. Une heure de grâce après la fin de la saison pour terminer un essai commencé.
- **Les défis** (`ech_defis`) : un adversaire et une règle par jour — aucune, Carapace (coups < 100 ignorés), Frappe éclair (il frappe à chaque tour), Affinité Rose (×2), Riposte (30 par coup porté), Fureur (+30 par coup subi), puis The French Sorcerer (Carapace 80 + Fureur 20). Défenses : 900, 1 350, 600, 1 900, 900, 1 000, 1 150. Un défi s'ouvre toutes les 24 h depuis le début de la saison.
- **Les étoiles** : ★ gagner (avant la fin du 10ᵉ tour), ★★ en perdant au plus un Joueur, ★★★ sans perte. La meilleure note compte.
- **Les indices** : trois étoiles au défi n débloquent l'indice n — une phrase sur ce qui vient, sans rien montrer ; les sept débloquent un dernier mot. Leur texte n'est que dans la base (`ech_indices`) : le navigateur ne le reçoit qu'une fois gagné. Ils se retournent comme une carte à la fin du combat, et se relisent dans le sous-onglet Indices (et tous dans le Labo). **La 21ᵉ étoile a sa révélation** (`montrerDernierMot()`, 25 octobre 2026) : en fermant ce combat-là, une fenêtre « Les 21 étoiles » étale les sept indices en éventail et retourne le dernier mot au milieu (tout seul, ou d'un toucher ; le carillon `legend`, des étincelles), puis son texte ; rien n'y est versé (le titre l'a été par `ech_terminer`). Elle tient à 375 × 667 ; avec le mouvement réduit, tout est posé d'emblée.

  | Défi | Titre | Ce qu'il dit | Visuel |
  |---|---|---|---|
  | 1 | Nouveau visage | Tout le jeu va changer de visage ; les couleurs de cette page en sont un avant-goût (la refonte) | `teinte` : la teinte graphite et lavande |
  | 2 | Ton deck | Tes cartes ne resteront pas dans un classeur : tu en feras ton deck | `eventail` : trois dos de carte |
  | 3 | Cent vingt-sept | La collection ne s'arrête pas à 122 : elle comptera 127 cartes | `nombre` 127 |
  | 4 | Deux | Deux camps, il faudra choisir le tien (les Sections) | `mot` Deux |
  | 5 | Plus loin | Tes cartes préférées pourront aller plus loin (la maîtrise) | `etoiles` 5 |
  | 6 | Face à face | Un jour, ce sera contre tes amis (le Versus) | `mot` VS |
  | 7 | Il reviendra | Vous l'affronterez tous ensemble (le Raid) | `carte` c116, assombrie |
  | 0 | Tout est prêt | Rendez-vous quand tu auras les cartes en main | `mot` Bientôt |

  **Aucun indice ne repose sur une règle de combat reconstituée** : la taille du deck (30), le nombre de lignes (3) et de PV (5) de la 3.0 sont des choix « maison » (`docs/regles-3.0.md` de la branche `version-3.0`), pas des faits — d'où le retrait de « Trois lignes, cinq vies » et de « Trente cartes ». « 127 » (122 + cinq Secrètes, #123 à #127, comme la 3.0) : le propriétaire l'a confirmé le 23 octobre 2026 ; l'indice disait « 128 » auparavant, corrigé le même jour dans les fichiers et sur la vraie base. Un mot ou un nombre se règle sur la largeur de sa case et sur sa longueur (`--l`, container queries) : « Bientôt » tient dans une case de carte.
- **Les récompenses** : 80 / 80 / 140 Éclats pour les étoiles 1, 2, 3 de chaque défi (2 100 en tout), et 15 / 15 / 25 **Braises** (385 en tout, la monnaie de l'événement : voir plus bas) ; **3 boosters** quand les sept sont gagnés ; le titre **« Échauffé »** (`t_echauffe`) pour les 21 étoiles. Tout est versé par le serveur (`accorder`, `crediter_prismes`), une seule fois.
- **L'équilibrage** (simulé sur les 51 Joueurs, toutes les équipes et chaque coup d'éclat possible) : chaque défi a une équipe à trois étoiles, qui demande le coup d'éclat au bon moment les jours 3 et 7 ; une équipe au hasard, même avec le meilleur coup d'éclat, ne fait trois étoiles qu'une fois sur trente à cent ; une collection aux deux tiers trouve presque toujours ses trois étoiles, une collection au tiers deux ou trois.
- **L'interface a la charpente de l'écran Reflets** (refaite le 25 octobre 2026 : la première version, en graphite et lavande, tassée pour ne jamais défiler, était « moche, et pas du tout en accord avec la DA ni de la 2.0 ni de la 3.0 », selon le propriétaire). Les composants sont ceux de Reflets (`.rf-tete`, `.rf-onglets`, `.rf-tuile`, la piste `.rf-pass`, `.rf-art`, `.rf-top`, les blocs `.rr-*` du récap, le bandeau `.rfban`), comme Le Choc de la 3.0 les reprend ; seules les couleurs changent, la braise (`#ffb35c`) et la lavande (`#c8bfff`, `#8a78f5`) à la place du rose de Reflets (`.ech-rf`, en fin de `css/hub.css`), sur les fonds, les textes et les boutons du site (les jetons `--e-*` pointent sur ceux de `css/tokens.css`). L'en-tête : l'illustration de « La Luxueuse III » (#122, le médaillon d'or au bout de sa chaîne), « Événement · Version 2.5 », le solde de Braises et le temps qui reste, puis **six sous-onglets** (`echOnglet`, `ECH_ONGLETS`) : **Défis** (« Aujourd'hui » : le défi du jour en vedette, sa carte et « Relever le défi », puis trois tuiles — quêtes du jour, Pass, classement ; « Les sept défis » sur la piste de Reflets, chacun avec son adversaire, sa règle et ses étoiles, « à rattraper » s'il est passé sans être gagné, son compte à rebours s'il n'est pas ouvert ; « Les bonus de la saison » ; « Comment ça marche »), **Quêtes** (les listes de l'onglet Quêtes, `vListeQuetes`), **Pass** (la piste de Reflets, qui se place sur le palier en cours), **Boutique**, **Classement**, **Indices** (huit cases de carte). Sans l'événement côté serveur (base sans `MAJ-2.5.sql`), seuls Défis et Indices restent. L'ancien sous-onglet « Récompenses », jugé pas très beau par le propriétaire le 24 octobre, est remplacé par le Pass. L'**écran du défi** : l'adversaire en bandeau (sa Défense, sa frappe et son rythme, sa règle), trois places ; sous chaque Joueur, sa Défense posée sur la carte, ses attaques en pastilles (dégâts, et le coût en élan en points : un point, un tour) — **deux pastilles côte à côte quand il en a deux, la choisie en blanc**, le rythme toujours écrit dessous ; une attaque doublée par l'Affinité est en vert, une attaque arrêtée par la Carapace barrée en rouge ; sous le bouton, ce que paie le défi. Puis la scène de combat plein écran. Les clics passent par `data-ech` → `echAction()` (`clicPage`, `js/app.js`).
- **Règle du propriétaire : pas de page qui défile d'un tout petit peu** (règle 8 de `CLAUDE.md`, précisée le 25 octobre 2026). Une vue qui pourrait tenir tient, de 360 × 740 à l'ordinateur en passant par 375 × 667 : l'écran du défi et la scène du combat (`.ech` prend toute la hauteur de `#main`, l'équipe se mesure sur la place qui reste par container queries : `.ech-ligne`, `--cw`), et les sous-onglets courts — Boutique, Classement, Indices, le défi du jour, le récap — grâce à deux crans pour les écrans bas (`@media (max-height:760px)` : l'en-tête se resserre ; `(max-height:760px) and (max-width:639px)` : la boutique passe en liste, les indices en petites cases ; `(max-height:700px)` : le podium du récap passe en trois pastilles, l'avatar à côté du nom, sans son titre ; le récap tient avec son podium : six chiffres — sur téléphone, trois grands et trois pastilles d'une ligne (`.rr-stat.mineur`, sans icône sous 400 px) —, le rang dans le coin, la suite en deux cartes, le défi du jour et la 3.0, avec une phrase plus courte pour le défi du jour sur un écran bas (`.ech-court`)). Les pages détaillées (Défis, Quêtes, Pass) défilent franchement, comme dans Reflets. Ajouter du contenu, c'est mesurer `#main.scrollHeight - #main.clientHeight` sur chaque vue aux quatre tailles : 0, ou une page vraiment longue.
- **La saison** (`ech_saison`, une ligne) commence à la fin du récap de Reflets — la sortie de la 2.5 — (ou à l'installation s'il est fini) et dure neuf jours : sept jours de défis, puis deux pour rattraper. Ensuite, trois jours de récap et le mode sans fin (plus bas). La ligne d'événement `echauffement` (`evenements`) la suit toute seule (un déclencheur, `22e_echauffement-evenement.sql`) : elle commence quand le récap de Reflets finit, ne le masque donc pas.
- **La fin du récap, réglable** : la colonne `evenements.recap_jusqua` (vide : trois jours après la fin, comme avant) ; `evenement_recent()` et `evenement_recap()` sont redéfinies dans `22b_echauffement.sql`.
- **Le calendrier de 2026** (`supabase/calendrier-2.5.sql`, rejouable, pas dans `TOUT.sql`) : Reflets jusqu'au vendredi 23 octobre minuit, son récap jusqu'au dimanche 25 minuit ; à cette minute (lundi 26, 0 h) sortent la 2.5 (`parametres.sorties`), L'Échauffement (jusqu'au mercredi 4 novembre, 0 h) et les Reverses (`parametres.reverses_des`). Heure de Paris ; le changement d'heure tombe la nuit du 24 au 25.
- **Où ça se voit** : la fenêtre de la 2.5, une fois (file de `proposerAccueil`), qui dit aussi l'événement, ses Braises et la suite sans fin (la fenêtre d'annonce propre à l'événement, `montrerEchAnnonce()`, ne sert plus qu'à qui n'a pas vu celle de la version) ; un bandeau sur Boosters (après le récap de Reflets), couvert du même médaillon que l'onglet, avec le solde de Braises ; un lien vers la boutique de l'événement en tête de la Boutique ; la pastille de Combats compte les défis ouverts pas encore gagnés, les quêtes et les paliers à récupérer (celle de Quêtes ne compte plus les quêtes d'événement, qui ont la leur). `verif.html` signale si `ech_etat()` manque (`MAJ-2.5.sql` pas joué).
- **Le Labo** : `ech_admin()` (administrateurs) rend la saison, les sept défis, la participation et les huit indices ; `ech_admin_rejouer()` efface les essais du jour de l'administrateur lui-même (pas ses notes) ; des aperçus locaux de la page, de la fenêtre, du bandeau et d'un combat (voir « Administrateurs »).
- **Tests** (banc PostgreSQL local : la base de `main`, puis la mise à jour — alors `MAJ-2.1.4.sql`, aujourd'hui `MAJ-2.5.sql` — deux fois, puis `TOUT.sql`) : `ech_simuler` et la copie JS donnent le même combat, au coup près, sur 1 050 combats tirés au hasard dont 812 avec un coup d'éclat ; dates du calendrier exactes ; refus vérifiés (Joueur non possédé, doublon, plus de trois, attaque inconnue, 4ᵉ essai du jour, essai terminé deux fois ou d'un autre joueur, coup d'éclat hors limites, avant le début, après la fin et l'heure de grâce, anonyme, Labo sans droit) ; une Reverse joue comme sa carte ; les sept défis à 3★ paient 2 100 Éclats, 3 boosters et le titre. **Depuis l'événement (24 octobre)** : la parité refaite sur 1 400 combats (les défis de la saison et les adversaires du mode sans fin, 709 avec un coup d'éclat qui frappe), à l'identique ; neuf blocs de tests de l'événement et du mode sans fin (la ligne d'événement suit la saison ; Braises et quêtes du combat ; un coup d'éclat ne compte que s'il frappe ; Pass, cadres et titres, boutique et ses limites, Reflets fermé ; une Reverse fabriquée ; une quête d'événement ne compte que pendant son événement ; le récap, quêtes et Pass fermés après la fin ; le mode sans fin : état, trois essais, 30 / 30 / 60, `m_sf10` une fois par jour, meilleure note, expiration, refus, série, fermé pendant la saison ; le Labo, les droits, le calendrier officiel) ; `TOUT.sql` rejoué deux fois sur une base qui a des joueurs garde leurs quêtes et une seule ligne d'événement. Interface vérifiée dans Chromium à 390 × 844, 375 × 667, 360 × 740 et 1 280 × 800 (le 24 octobre au soir : 52 vues, un combat du mode sans fin, le parcours d'un joueur — une quête, un défi, un palier, un achat en Braises, le Labo). **Le 25 octobre**, après la refonte sur la charpente de Reflets : 52 vues mesurées (`#main.scrollHeight − clientHeight`) — Boutique, Classement, Indices, l'écran du défi, le défi du jour, son classement, ses indices et son écran, le récap : 0 aux quatre tailles ; Défis, Quêtes et Pass défilent franchement (de 595 à 1 169 px) ; le récap avec un podium (aperçu du Labo) : 0 aux quatre tailles ; aucune erreur dans la console. La fin de combat : trois étoiles, une défaite, le mouvement réduit, à 375 × 667, 390 × 844 et 1 280 × 800 (verdict, étoiles posées, tampon, gains comptés, la fenêtre dans l'écran, les particules rendues à leur place). L'entrée en face-à-face, « Bloqué » et le coup d'éclat qui porte, image par image. La révélation des 21 étoiles : par le Labo aux quatre tailles, et en vrai dans la démo (six défis à trois étoiles par l'API, le septième joué à l'écran, coup d'éclat au bon tour, puis la fenêtre). SQL refait le même jour : installation neuve et les neuf blocs de tests de l'événement et du mode sans fin, tous OK ; parité sur 1 400 nouveaux combats tirés au hasard (699 avec un coup d'éclat) : 1 400 identiques. **Le 3 novembre**, la 3.0 dans le récap (dans un prébuild construit en local, jamais publié) : le récap avec son podium (aperçu du Labo) mesure 0 aux quatre tailles, avec 7 à 24 px de marge ; la fenêtre de fin, 0 ; aucune erreur dans la console. Pas vérifié : sur un vrai téléphone, ni avec les vraies données (le récap n'ouvre que le 4 novembre à 0 h).
- **Dans la démo** : `?echauffement` dans l'adresse ouvre la saison tout de suite, trois défis ouverts (`?echauffement=7` : les sept ; `?echauffement=fin` : la saison finie depuis une heure, son récap ; `?echauffement=sf` : le quatrième jour du mode sans fin).

#### L'événement : Braises, Pass, quêtes, boutique, classement (24 octobre 2026)

Le propriétaire a jugé, le 24 octobre, que la 2.5 « ne fait pas assez update, c'est juste un mini mode de jeu », et demandé « un truc à la hauteur de Reflets et le Choc ». L'Échauffement est donc devenu un événement sur la charpente de Reflets (`supabase/22e_echauffement-evenement.sql`), sans toucher aux règles du combat :

- **La ligne d'événement** `echauffement` (`evenements`) a les dates de la saison et trois jours de récap ; un déclencheur sur `ech_saison` la garde à jour (Labo, `calendrier-2.5.sql`, ou une mise à jour à la main). Tout ce qui porte ce code s'active : quêtes (`quests.evenement`), boutique (`shop_items.evenement`), Pass (`evt_piste`), compte de monnaie (`evt_comptes`).
- **Les Braises** : la monnaie de l'événement (en base, `prismes` comme partout, `evt_comptes.evenement = 'echauffement'` ; le nom et l'icône viennent de `MONNAIES_EV`, `js/config.js`, et `evIco()`, `js/ui.js`, comme la 3.0 le fait pour ses Étincelles). Elles se gagnent avec les étoiles des défis (15 / 15 / 25, 385 en tout), quatre quêtes du jour (50 par jour : passer voir l'événement, un combat, une victoire, quatre boosters) et neuf quêtes de l'événement (390 : les sept défis, trois fois parfait, les 21 étoiles, dix Joueurs différents, cinq coups d'éclat, une Reverse fabriquée, trente boosters, cent doublons recyclés, deux échanges) — 1 225 au plus. Les quêtes sont dans `supabase/04_seed.sql` ; les compteurs, côté serveur (`ech_terminer` : `ech_combat`, `ech_victoire`, `ech_eclat` — seulement un coup d'éclat qui a vraiment frappé — et `ech_sync_quetes` pour les états ; `fabriquer` : `fab_rev`). **Une quête d'événement ne compte plus que pendant son événement** (`bump_quests`, redéfinie dans `22e`) : « Ouvre 30 boosters pendant l'événement » ne compte pas ceux d'avant.
- **Le Pass** (refait le 25 octobre 2026 à la demande du propriétaire : « des paliers significatifs », et pas d'Essence Brillante, « c'est qu'un mini event ») : vingt paliers en quatre blocs de cinq, de 40 à 1 050 Braises gagnées (dépenser ne le fait pas reculer). **Chaque cinquième palier est un cosmétique** : le titre « Premier round » (5, à 200 Braises), le cadre décoré « Braise » (10, à 450), le titre « Feu sacré » (15, à 750), le cadre « Ardeur » (20, à 1 050 ; `tools/cadres.py`, `assets/cadres/braise.svg` et `ardeur.svg`). Entre eux, toujours le même ordre — des boosters, des Fragments, des Éclats, puis deux boosters ou une Reverse Rare —, avec des montants qui grandissent d'un bloc à l'autre. En tout : 10 boosters, 700 Éclats, 1 000 Fragments, 2 Reverses Rares, deux titres, deux cadres. Calcul en tête de `22e` : un joueur qui fait tout le finit vers le huitième jour ; un joueur régulier (sept jours sur neuf) atteint le palier 16 environ ; un joueur de passage, le 8. En page, la piste du Pass de Reflets ; les jalons (tous les cinq paliers) un peu plus grands ; « Récupérer » d'un geste, « Tout récupérer » s'il y en a plusieurs.
- **La boutique** : 2 boosters (80, quatre fois), 500 Fragments (70, quatre fois), une Reverse Rare (160, deux fois), le titre « Entraîneur » (200) : 1 120 pour tout acheter, il faut choisir. Un lien en tête de la Boutique principale y mène.
- **Le classement** : les dix qui ont gagné le plus de Braises, et sa place sinon (`evenement_etat` rend aussi `rang` et `joueurs`).
- **Le récap**, trois jours après la saison : `evenement_recap()` ajoute à son bilan les étoiles, les défis gagnés, les indices, les combats ; un bandeau sur Boosters (« Terminé · le récap ») mène au sous-onglet « Le récap » de Combats ; une fenêtre, une fois (`montrerEchRecap()`), dit le bilan et explique la suite — le défi du jour. **Depuis le 3 novembre** (le propriétaire), le récap annonce aussi **la 3.0** : dans « La suite », une carte « La version 3.0 » (maintenance le lundi 9 novembre au soir, à minuit ; sortie le mardi 10 au soir, à minuit ; le temps qui reste avant la sortie, à l'heure du serveur), et une ligne dans la fenêtre ; les dates sont dans `PROCHAINE` (`js/config.js`), et tout disparaît une fois la 3.0 sortie (`vEchSuite30()`, `ech30AVenir()`).
- **L'ancienne monnaie dans les écrans communs** : le tiroir, la Boutique et les quêtes montrent la monnaie de l'événement en cours (`evIco()`, `PRISMES.nom`), Braises ou Prismes.

#### Le mode sans fin : un défi par jour (à partir du 4 novembre 2026)

Demande du propriétaire (24 octobre) : après le rattrapage, L'Échauffement continue dans l'onglet Combats, « des adversaires plus ou moins durs », « pas de difficulté croissante », des récompenses « équilibrées, comme le Devine l'illu devenu permanent », expliqué « dans un pop-up et dans l'onglet de récap ». C'est `supabase/22f_sans-fin.sql` :

- **Un défi par jour, le même pour tous** : 21 adversaires (`ech_sf_adversaires`), un par jour dans l'ordre de la liste, puis on recommence. Chacun a un niveau (Facile, Moyen, Difficile, Redoutable) et l'ordre les mélange, sans jamais la même règle deux jours de suite : la difficulté varie, elle ne monte pas. Les règles sont celles de la saison (aucune, Carapace, Frappe éclair, Affinité, Riposte, Fureur, les deux à la fois), avec d'autres réglages ; le combat aussi (`ech_combat`, partagé avec la saison). Chaque Défense a été calibrée par simulation (toutes les équipes ordonnées des 51 Joueurs, la meilleure attaque et le meilleur coup d'éclat) : une équipe au hasard fait trois étoiles de 17 à 25 % des fois en Facile, ~1 % en Redoutable ; une collection d'un tiers trouve toujours ses trois étoiles en Facile, de 58 à 83 % des fois en Redoutable. Le tableau, adversaire par adversaire, est dans le fichier SQL.
- **Trois essais par jour**, comptés au départ ; seul le défi du jour se joue (un rendez-vous, pas une collection) ; un essai commencé se termine dans l'heure.
- **Les récompenses** : 30, 30 puis 60 Éclats pour les étoiles du jour (120 au plus, comme une illu trouvée au premier essai) ; dix jours gagnés donnent le titre « Infatigable » (quête saisonnière `m_sf10`). Une série (jours gagnés d'affilée) et un classement des étoiles (les dix premiers, et sa place).
- **En page** : le sous-onglet « Défi du jour » (l'adversaire en grand, son niveau en quatre crans, la série, les victoires, le niveau du lendemain), « Classement », « Indices » (on relit ceux de la saison), et « Le récap » pendant trois jours. Le bandeau de Boosters annonce le niveau du jour. La page redemande l'état à minuit (`prochaineBascule()`).
- **Dans la démo** : `?echauffement=sf` ; les joueurs simulés ont joué les jours passés.
#### La mise en ligne

En trois temps, tous faits : le jeudi 22 octobre 2026, sous le nom 2.1.4 (avec l'accord du propriétaire) ; le vendredi 23 ; et le dimanche 25, dans la nuit (le site, puis la base).

- **22 octobre · la vraie base n'était pas où on la croyait** : comparée fonction par fonction à une installation de `main`, elle était restée au SQL de la **2.1.0** — la 2.1.1 (`est_filleul`, « un invité n'invite pas à son tour » : `shop_buy`, `creer_invitation`, `me()`) n'avait jamais été jouée, alors que le site, lui, était en 2.1.3. La mise à jour (aujourd'hui `MAJ-2.5.sql`) rattrape donc aussi la 2.1.1 : elle rejoue `03_rpc.sql`, `07_vitrine.sql`, `12_recyclage.sql`, `21_reflets.sql`, puis `22b_echauffement.sql`, `22c_reverses.sql`, `22d_admin.sql` et `calendrier-2.5.sql` (assemblée par `tools/build-sql.py`). Le remboursement des codes achetés par des invités n'avait rien à faire (3 codes, tous utilisés) ; le Pass de Reflets de la base était déjà celui du fichier.
- **Comment elle a été appliquée** : par l'outil Supabase, en cinq morceaux dans un ordre où le site reste debout à chaque étape (les fonctions dont dépend `me()` d'abord, `me()` en dernier), chacun terminé par un contrôle qui compare l'empreinte de chaque fonction, de ses droits et des tables créées à une installation neuve de la branche, et annule le morceau entier au moindre écart (vérifié : un chiffre changé fait tout annuler). `me()` a été essayé sur un vrai compte, ses effets annulés. Résultat : la base a exactement les fonctions, les droits et les colonnes d'une installation neuve, **sauf `ech_admin_rejouer`** (le bouton « Rejouer mes essais du jour » du Labo) : l'outil demande une confirmation pour tout envoi contenant `delete from`, et elle n'a pas été donnée. Elle se pose en recollant `MAJ-2.5.sql` (rejouable) dans le SQL Editor.
- **Le site, alors appelé 2.1.4**, a été publié le même jour sur `main`. L'Échauffement n'apparaît qu'à sa saison (`echActif()` demande une saison ouverte) ; d'ici là, l'onglet Combats montre son annonce « Coming soon » (le teaser « le signal » de la 2.1.3 est retiré : il promettait « Trois lignes. Cinq vies. », une règle « maison » de la 3.0). Tous les noms commencent par `ech_` : la 3.0 a déjà ses `defis`.
- **23 octobre, à la demande du propriétaire** (avant toute ouverture) : sur la vraie base, l'ouverture des Reverses passe du vendredi minuit à la sortie de la 2.5 (`reverses_des` = lundi 26, 0 h) et l'indice 3 dit 127 (deux mises à jour d'une ligne, contrôlées avant et après) ; sur `main`, le site devient la 2.5 en attente de sa sortie (« La sortie datée » plus haut), numéro « 2.1.3 » et teasing de la 2.5 dans le récap.
- **24 octobre · l'accord pour la base, pas encore appliqué.** Le propriétaire a donné son accord pour `MAJ-2.5.sql`, qui a grossi le même jour : l'événement (`22e`), le mode sans fin (`22f`), les quêtes et la boutique de l'événement (`04_seed.sql`), et les fonctions retouchées pour eux (`03_rpc.sql`, `12_recyclage.sql`, `21_reflets.sql`, `22b`, `22d`). Avant l'envoi, la vraie base a été comparée deux fois à ce qu'on croyait y être (le SQL du 22 octobre et les deux mises à jour du 23) : identique (210 colonnes, 87 fonctions, 33 tables, mêmes empreintes et mêmes droits). Un premier envoi (le Labo de la 2.5, `ech_admin_rejouer`, `fabriquer`, dans leur version d'avant l'événement) a été tenté par l'outil Supabase ; l'outil demande au propriétaire une confirmation pour tout envoi qui contient `delete from` ou `drop`, et elle n'est pas venue dans la minute. **Rien n'a été appliqué à notre connaissance** ; si la confirmation a été donnée après coup, cet envoi a pu passer : la comparaison qui précède le prochain envoi le dira (les trois envois ci-dessous ramènent la base au bon état dans les deux cas). La mise à jour est prête en **trois envois** : chaque fonction dans sa version finale, `me()` en dernier ; chacun finit par un contrôle des empreintes et des droits de ses fonctions, comparés à une installation neuve, qui annule l'envoi entier au moindre écart ; le premier contrôle aussi le contenu des quêtes et de la boutique de l'événement, le troisième les tables du mode sans fin, le contenu du Pass, le déclencheur et toutes les dates du calendrier (depuis le 25 octobre, le contenu et non plus seulement le nombre de lignes). Essayés (`tools/maj-2.5/essai.sh`, refait le 25 octobre avec le Pass refait) sur deux copies locales de `ref`, le modèle de la vraie base (le SQL du 22 octobre et les deux mises à jour du 23, aux mêmes empreintes qu'elle le 24) : telle quelle, et avec l'envoi du 24 (`envoi-24oct.sql`, le fichier préparé pour lui) au cas où il serait passé après coup ; chaque envoi joué deux fois de suite ; les deux finissent identiques à une installation neuve (118 fonctions, 236 colonnes, 37 tables, mêmes empreintes et mêmes droits) ; un Pass altéré dans le troisième envoi le fait annuler en entier (vérifié). Ce n'est pas un essai sur la vraie base ni sur une copie de ses données : ses lignes (joueurs, inventaires) ne sont pas dans le banc. Chacun demandera sa confirmation au propriétaire. Ils se refont en trois commandes, `bash tools/maj-2.5/banc.sh`, `python3 tools/maj-2.5/envois.py` (dans `_build/maj-2.5/`, non versionné) et `bash tools/maj-2.5/essai.sh`, à partir de `supabase/` et d'une installation locale ; la procédure : `docs/feuille-de-route.md`, § 6.
- **L'ordre : le site d'abord, la base ensuite.** La base mise à jour crée la ligne d'événement `echauffement`, que le site publié le 23 octobre ne connaît pas : il rouvrirait une fois la fenêtre des nouveautés de la 2.1 à chaque joueur (l'événement « à venir » change la clé qui la commande), puis, à la sortie, afficherait les Braises sous le nom de Prismes, compterait les quêtes de l'événement dans la pastille de Quêtes sans les montrer, et n'aurait ni Pass ni boutique de l'événement. La dernière `version-2.5`, elle, est faite pour marcher avec et sans la mise à jour (sans : les sous-onglets de l'événement n'apparaissent pas, ni Braises ni mode sans fin, le Labo dit « fonction absente ») ; avec, c'est vérifié dans le prébuild ; sans, seulement à la lecture du code (`chargerEch()` rattrape l'absence de `ech_sf_etat`, l'événement n'existe que si le serveur le donne), pas en vrai. Donc : publier sur `main` la dernière `version-2.5` (accord du propriétaire, règle 1), puis la base, puis `verif.html`.
- **25 octobre · le site, puis la base** (accord du propriétaire : « vasy publie sur main et fais le sql »). Le site d'abord : `python3 tools/version.py 2.5` (marque `2.5-198119`), `version-2.5` fusionnée dans `main` (`e9f0c36` ; seul conflit, `prebuild/index.html`, pris de `version-2.5` ; `preprod/` et `CNAME` intacts), chargé dans Chromium sans erreur (« 2.1.3 », l'écran d'entrée), servi par GitHub Pages à 02 h 22 UTC. La base ensuite : comparée d'abord en lecture seule, elle était exactement le modèle (`C|210|281c441b…`, `F|87|eb557b19…`, `T|33|669f1168…`, 11 règles d'accès, aucun déclencheur) — l'envoi du 24 n'était donc jamais passé. Le premier des trois envois a été tenté deux fois par l'outil Supabase : les deux fois, la confirmation demandée au propriétaire ne lui est pas parvenue dans la minute, et l'outil a tout annulé (la base, relue entre les deux, n'avait pas bougé). **Le propriétaire a alors collé `supabase/MAJ-2.5.sql` lui-même** dans le SQL Editor (depuis matetcg.com/supabase/MAJ-2.5.sql), vers 02 h 35 UTC. Vérifié ensuite en lecture seule : colonnes, tables, règles d'accès, déclencheur, droits des 118 fonctions et tout le contenu (Pass, quêtes, boutique, défis, indices, adversaires, calendrier) étaient ceux d'une installation neuve ; mais **79 fonctions avaient des fins de ligne Windows** (`\r\n`) dans leur corps — la copie depuis le navigateur —, d'où une autre empreinte (`F|118|6fcb5c2e…`). Le diagnostic est exact : `MAJ-2.5.sql` rejoué sur le banc en fins de ligne Windows donne cette empreinte-là. Sans effet sur le jeu (aucune de ces fonctions n'a de texte sur plusieurs lignes : les `\r` ne tombaient que dans des blancs et des commentaires), mais toute comparaison future aurait été faussée : `tools/maj-2.5/fix-crlf.sql` (recrée chaque fonction touchée depuis sa propre définition, sans les `\r`), essayé sur le banc puis envoyé — sans `delete` ni `drop`, l'outil ne demande pas de confirmation. Résultat, relu : `C|236|8236f2bf…`, `F|118|e44e662b…`, `T|37|7ace681b…`, 11 règles d'accès, 1 déclencheur, aucune fonction avec `\r` : exactement une installation neuve. Enfin, en tant que compte administrateur, dans un bloc qui annule tout à la fin : `me()` (les Reverses et leur date, la sortie, l'événement à venir), `ech_etat()` (la saison du lundi 0 h au 4 novembre 0 h), `ech_sf_etat()` (le 4 novembre), `evenement_etat()`, `labo_etat()`, `ech_admin()` (7 défis, 8 indices) répondent sans erreur sur les vraies données. Deux leçons, dans `CLAUDE.md` : la confirmation de l'outil n'est jamais arrivée (trois fois sur trois, les 24 et 25), coller le fichier reste la voie sûre ; et les contrôles de contenu se font en `jsonb` (`to_jsonb`), car l'ordre des colonnes de la vraie base n'est pas celui d'une installation neuve (`quests.item_id`, `shop_items.carte_id`, ajoutées après coup) — avec `row_to_json`, le contrôle du premier envoi aurait refusé un contenu identique.
- **Reste à vérifier** : après lundi 0 h, que le site dit « 2.5 », que la fenêtre des nouveautés s'ouvre, que le défi 1 se joue et paie ses Braises, que le Pass, les quêtes et la boutique de l'événement répondent, qu'une Reverse se fabrique (`docs/feuille-de-route.md`, § 6). `verif.html`, à un administrateur connecté, n'a pas encore été ouvert sur le vrai site.

### Les Reverses

- **Leur recyclage et leur fabrication** (`supabase/22c_reverses.sql`) ouvrent avec la 2.5, le lundi 26 octobre à 0 h (prévus d'abord à la fin de Reflets, le vendredi 23 à minuit, et reportés à la sortie de la 2.5 par le propriétaire le 23 octobre, avant leur ouverture).
  - **L'ouverture est datée** : `parametres.reverses_des`, posée par `calendrier-2.5.sql` ; `reverses_ouvertes()` vaut vrai passé cette date, ou si `fabrication_reverse` est vrai (ouverture à la main, comme avant). Sans date (installation neuve) : fermé. Rien à jouer à minuit.
  - **Le prix** n'est plus le double d'une classique (80, 200, 800), qui vendait une Reverse moins cher qu'une classique deux fois plus facile à tirer (une carte précise sort en moyenne au bout de 66 boosters pour une Reverse Commune, 35 pour une Rare classique ; 187 pour une Reverse Rare, 112 pour une Épique). Deux règles : jamais moins cher qu'une classique plus facile à tirer, et le même effet que la fabrication des classiques sur la fin de collection (−33 % sur la médiane, −41 % sur le quart le plus lent). Résultat : **400 (Commune), 500 (Peu commune), 2 400 (Rare)** (`prix_reverse()`). Simulation (`python3 tools/equilibre-reverses.py`, 600 joueurs par ligne) : les 85 Reverses le 25 décembre au lieu du 30 janvier pour un joueur régulier (−37 % ; le quart le plus lent −40 %), le 28 mars au lieu du 5 juin pour un occasionnel (−31 % / −39 %) ; elles finissent deux semaines après les 122, ce qui laisse un usage aux Fragments une fois l'extension complète (au double : cinq jours après). Le revers : qui met ses Fragments dans les Reverses avant d'avoir les 122 finit l'extension environ trois semaines plus tard ; la fiche de fabrication d'une Reverse le rappelle. Le détail, et ce que la simulation ignore, est en tête du fichier SQL.
  - **Le recyclage** ne change pas : une Reverse rapporte comme sa classique (2, 5, 20). L'aligner sur ces prix donnerait +57 % de Fragments à un joueur avancé.
  - **Un site 2.1.3 garde les Reverses fermées** : `me()` n'envoie plus `parametres.fabrication_reverse`, qu'il aurait affiché au double ; la 2.5 lit `parametres.reverses` (ouvertes, date, prix).
  - **Où ça se voit** : la Collection › Reverses a la même ligne que les Classiques (`vLigneFragments`, `js/collection.js` : le solde de Fragments, « touche une case vide pour la fabriquer » ; avant l'ouverture, quand elle ouvre, avec un compte à rebours) ; une case vide se touche pour fabriquer, et sa fiche dit le prix ; le Recyclage propose les doublons de Reverses ; le récap de Reflets l'annonce avec la 2.5 (« À suivre ») ; une fois ouvertes, la fenêtre de la 2.5 les présente. À la minute dite, la page bascule toute seule (`revOuvertes()`, `js/recyclage.js`) et redemande l'état au serveur (`prochaineBascule()`, `js/booster.js`). `verif.html` dit, à un compte connecté, si `me()` renvoie `parametres.reverses`.
  - **Tests** : sur la base de `main`, la mise à jour (deux fois) refuse le recyclage et la fabrication d'une Reverse avant la date, les accepte après au bon prix (400, 500, 2 400), refuse une carte déjà possédée et un solde insuffisant ; une classique se recycle et se fabrique comme avant ; `fabrication_reverse` ouvre même avant la date ; ni `anon` ni `authenticated` n'appellent `prix_reverse()` et `reverses_ouvertes()` ; après la seule mise à jour, la base a exactement les fonctions, les colonnes et les droits d'une installation neuve. Dans Chromium, aux quatre tailles : fermé avec sa date, ouvert avec ses prix, fabrication et recyclage, fenêtre et récap de Reflets, Labo ; et la bascule toute seule, page ouverte, en moins de 32 s.
  - **Dans la démo** : la date est le début de L'Échauffement de la démo (`revDes()`, `_demo/serveur.js`), lui-même à la fin du récap de Reflets ; le prébuild, où L'Échauffement est ouvert, les a donc ouvertes.
### Le prébuild

**Retiré le 2 novembre 2026** (le propriétaire : on ne touche plus à la 2.x). Ce qui suit dit ce qu'il était.

- `python3 tools/demo.py --prebuild` construit la démo de cette version dans `prebuild/` (stockage à part, pas de service worker, Labo ouvert, L'Échauffement ouvert d'office avec ses sept défis, Reflets fini, des Joueurs offerts) ; publié sur `main`, il se teste à **matetcg.com/prebuild/**. Ne jamais lancer `--preprod` depuis une branche 2.x : `preprod/` est la 3.0. Le prébuild contient le faux serveur, donc **le texte des indices** : il n'est pas plus secret que la pré-prod 3.0, publiée au même endroit.

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

Chaque son est une recette courte dans `RECETTES` : quelques souffles de bruit filtré pour tout ce qui frotte, glisse ou se déchire, quelques notes pour les clics et les carillons. La déchirure du paquet, le passage d'une carte, la montée avant une révélation et les trois paliers de carillon (rare, épique, légendaire) sont branchés dans `js/opening.js`. Les combats de L'Échauffement ont les leurs (`js/echauffement.js`) : l'entrée en face-à-face (`vs`, un souffle et un coup sourd ; `carte` pour chaque Joueur qui monte), un coup (`tap`), un coup arrêté par la Carapace (`bloque`, un tintement), le coup d'éclat (`rare`) et le coup qui le suit (`impact`, un choc plus lourd), et la fin — une note par étoile, plus haute à chaque fois (`etoile`, avec le rang de l'étoile), et le tampon « Parfait » (`tampon`).

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

## Écran d'entrée et bêta fermée

**Le projet est annulé depuis le 24 septembre 2026** : l'ouverture au public, prévue ce jour-là à 18 h, n'a pas eu lieu, après échange avec Gentle Mates. L'écran d'entrée affiche l'annonce d'arrêt (`vAnnonceArret()`, `js/gate.js`) : « Projet annulé · Merci », puis, dans une tuile, « M8 TCG Online ne verra pas le jour. » et la raison, les remerciements, le bouton du Discord, un lien vers Matepedia (`MATEPEDIA_URL`) et, en discret, l'entrée des comptes invités (« J'ai un accès »). **Seuls les comptes invités jouent**, et le jeu continue pour eux (Reflets, la 2.5, L'Échauffement).

**Depuis le 1er novembre 2026, cet écran est dans la DA de la 3.0** (demande du propriétaire, publiée tout de suite sur `main`) : la palette « Graphite et lavande » et les boutons de la 3.0, sur cet écran seulement — ses jetons sont redéclarés sur `body.inlock` (fin de `css/auth.css`), le reste du site garde ceux de la 2.x. Le paquet ne flotte plus (il ne promet plus rien) ; la phrase « ne verra pas le jour » est la plus visible. Un compte connecté sans accès lit « <pseudo> n'a pas accès au jeu. » ; un refus au retour de Discord, « Ce compte n'a pas accès au jeu. » (`porteRefus`, `lireErreurRetour()` dans `js/auth.js`), ou « Connexion annulée. » si la personne a refusé l'autorisation chez Discord. Plus rien ne parle d'« ouverture » ni de « pas encore ». Tout tient sans défiler aux quatre tailles de référence, dans les quatre états (l'annonce, le refus de Discord, le compte sans accès, l'invitation) : sur un écran bas, le paquet s'efface quand l'état a plus à dire.

Deux verrous, l'un pour l'écran, l'autre pour le serveur :
- `PORTE.active` vaut `true` dans `js/gate.js` (figé : on ne le bascule pas depuis la console) : l'écran d'entrée est en place ;
- `beta_lancement()` vaut `infinity` dans `supabase/01_schema.sql` : `beta_ouverte()` reste faux, et `garde_beta()` refuse **toute action du jeu** à un compte qui n'est pas dans `beta_invites`. C'est lui qui protège vraiment : l'écran seul ne suffirait pas.

**Rouvrir à tous** demanderait les deux : `active` à `false` dans `js/gate.js`, et une date passée dans `beta_lancement()` (puis jouer la fonction dans Supabase). Rien ne le prévoit aujourd'hui.

**L'accès est nominatif.** On se connecte avec son compte Discord, et c'est le serveur qui vérifie que ce compte figure dans la table `beta_invites`. On invite, on retire, on regarde qui est entré depuis `supabase/09_beta.sql`. Depuis la 2.0, un joueur peut aussi inviter un ami avec un code acheté en boutique (voir « Version 2.0 · Reflets ») : le code inscrit le compte Discord de l'ami dans `beta_invites`, une seule fois ; depuis la 2.1, un invité n'invite pas à son tour.

**Pourquoi plus de code d'accès** (abandonné avant l'ouverture prévue) : son empreinte était dans la page et la comparaison se faisait dans le navigateur (écrire la valeur attendue dans le stockage local suffisait à entrer) ; et un code se transmet, alors qu'une invitation se retire.

**La maintenance de la 3.0, programmée (8 novembre 2026).** Le propriétaire : « programmer la maintenance sur main pour la date prévue, et tout automatiser », puis, le même jour : « on part pour ce soir minuit […] Maintenance à 23h50, sortie à minuit. Mets sur le vrai site en évidence cette date de sortie pour hype les gens ». Jusqu'à la sortie, **le bandeau de l'écran Boosters annonce la 3.0** avec son compte à rebours (`vBandeau30`, `js/booster.js`, avant tous les autres bandeaux), et **une fenêtre s'ouvre une fois par appareil** (`montrerHype30`, `js/bienvenue.js` : ce qui arrive, l'heure de la maintenance ; le bandeau la rouvre). À `PROCHAINE.maintenance` (`js/config.js` : dimanche 8 novembre 2026, 23 h 50, heure de Paris ; la sortie, `PROCHAINE.sortie`, lundi 9 novembre, 0 h), comptée à l'heure du serveur (`srvTime`), le site ne montre plus que l'écran « La 3.0 arrive » (`vMaintenance30`, `js/gate.js`, appelé en tête de `render()`), à tout le monde, administrateurs compris : le retour à minuit, un compte à rebours, le Discord. Une page déjà ouverte y passe d'elle-même dans la seconde ; passé `PROCHAINE.sortie`, elle se recharge seule (entre 45 s et 1 min 45) pour recevoir la 3.0. Rien à pousser à minuit. Le serveur 2.5, lui, ne bloque rien : l'écran suffit, et la base entre en maintenance d'elle-même en recevant la 3.0 (README de la 3.0, § 2.7). Vérifié dans Chromium à 390, 375 et 1 280 px, l'heure du serveur avancée : l'écran tient sans défiler, aucune erreur.

**Ce qui reste de l'ouverture datée.** L'écran ne consulte pas la montre de l'appareil : il demande au serveur (`porte()`, appelable sans compte) si c'est ouvert, quand ça ouvre et quelle heure il est chez lui, puis compte avec `performance.now()`. Sans réponse du serveur, l'écran reste fermé. Trois fermetures vont avec : le drapeau `invite` de `me()` doit valoir `true` explicitement ; `PORTE` est figé et les fonctions de l'écran sont des constantes ; `est_invite()`, `garde_beta()`, `photo_discord()` et `check_promos()` ne sont pas appelables sans compte (le droit est retiré au rôle `public`, pas seulement à `anon` et `authenticated`).

> **Ce que cet écran protège, et ce qu'il ne protège pas.** Il protège le *jeu* : sans invitation, le serveur ne répond rien. Il ne protège pas les *fichiers* : le site est statique, ses scripts, ses images et la liste des cartes se téléchargent à l'adresse où ils sont publiés, et le dépôt lui-même est lisible s'il est public. La seule réponse est du côté de l'hébergement (dépôt privé, et un hébergeur qui demande une identité avant de servir le premier octet). Aucune ligne de JavaScript ne peut le faire à leur place.

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

Ni l'un ni l'autre ne touche aux tables des événements (`evt_*` de Reflets, `ech_*` de L'Échauffement) : un joueur remis à zéro garde ses Prismes et ses étoiles. À ajouter aux deux fichiers si on s'en sert un jour.

Les invitations de la bêta, elles, ne sont pas touchées : la remise à zéro vide
les collections, pas la table `beta_invites`. Pour retirer quelqu'un de la liste,
c'est `supabase/09_beta.sql`.

## Le Discord

`DISCORD_URL` dans `js/config.js` porte l'adresse du serveur, et elle est citée partout où
elle a sa place : sur l'écran d'entrée (sous l'annonce d'arrêt, c'est la seule chose
qu'un visiteur non invité puisse faire), au pied du tiroir du compte et du rail
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

L'onglet **Labo** n'apparaît que pour les profils marqués `is_admin` en base, et ce drapeau ne peut être posé que depuis le tableau de bord Supabase (`supabase/05_admin.sql`) : aucune fonction du jeu ne l'expose, et le navigateur n'a pas le droit d'écrire dans la table des profils. Cacher un bouton ne protège rien : **chaque fonction du Labo vérifie elle-même le droit** (`labo_garde()`, `supabase/22d_admin.sql`), et un joueur qui les appellerait se voit refuser.

**Le Labo de la 2.5** (`js/lab.js`, styles en fin de `css/lab.css`, serveur `supabase/22d_admin.sql`, démo : `RPC.labo_*` dans `_demo/serveur.js`) sert à **tout régler** : l'état du serveur, son propre compte, les joueurs, et à voir les mises en scène. Quatre sous-onglets (`labVue`) :

- **Serveur** — *pour tout le monde, pour de vrai* (une étiquette « pour tout le monde » le rappelle, et chaque geste se confirme sur le vrai site ; dans la démo, rien n'est demandé).
  - **Le serveur, maintenant** : trois puces (la version, sortie ou pas ; L'Échauffement, défi N sur 7 ; les Reverses), puis le calendrier en frise — fin de Reflets, fin de son récap, sortie de la 2.5, début et fin de L'Échauffement, ouverture des Reverses — avec ce qui est passé, maintenant, ce qui vient, et, en jaune, la date officielle quand un jalon s'en écarte (`labo_etat()`).
  - **Aller à un état** (`labo_calendrier(état, n)`) : tout le calendrier bouge d'un coup et reste cohérent. « Avant la 2.5 » (le récap de Reflets court, la 2.5 sort dans 2 min ou dans 1 h : de quoi regarder la bascule) ; « défi 1 » à « défi 7 » (la 2.5 sortie, L'Échauffement à ce jour-là) ; « Rattrapage » (les sept ouverts, deux jours avant la fin) ; « Saison finie » (depuis une heure : son récap et le défi du jour) ; « Mode sans fin » (son quatrième jour, récap fini : `labo_calendrier('sans_fin', n)`) ; et **« Revenir au calendrier officiel »**, les dates de la 2.5, dont la seule copie côté serveur est `calendrier_officiel()`. La ligne d'événement de L'Échauffement suit (son déclencheur) ; la frise montre aussi la fin de son récap.
  - **Ajuster** : avancer ou reculer la saison d'un jour (`labo_decaler`), ouvrir ou fermer les Reverses à la main (`labo_reverses`).
  - **L'Échauffement** : la participation défi par défi (essais, gagnés, trois étoiles), le défi du jour du mode sans fin (son adversaire, son niveau, qui l'a tenté), les huit indices avec leur texte, et **la remise à zéro** de tous les joueurs, mode sans fin compris (`labo_ech_raz`, qui demande d'écrire EFFACER) — ce qui a été versé reste, Braises comprises.
  - **En vigueur** : joueurs inscrits, recharge et réserve, carte unique, godpack, Brillantes, échange gratuit, les événements de recharge à venir, et ce que rapporte et coûte chaque rareté en Fragments, Reverses comprises ; puis quelques requêtes SQL pour ce que le Labo ne fait pas (un événement de recharge).
- **Mon compte** — *son propre compte, pour de vrai* : **la sauvegarde** (`labo_sauver`, `labo_restaurer` : collection, monnaies, cosmétiques, quêtes, Échauffement, historique, tels qu'ils étaient — pas les amis, la boîte ni les échanges ; une par administrateur, table `labo_sauvegardes`) ; la collection (**master set** : tout le catalogue sauf la carte unique ; les 122 ; les Joueurs de L'Échauffement ; vider — `labo_cartes`) ; les ressources posées à la valeur dite (Éclats, Fragments, boosters en plus, réserve, Prismes — `labo_monnaies`) ; tous les cadres et titres (`labo_cosmetiques`) ; ses étoiles à chaque défi de L'Échauffement, sans rien verser, « Rejouer aujourd'hui » (efface ses essais du jour) et « Tout effacer » (`labo_ech_moi`) ; **repartir de zéro** comme un nouveau joueur (`labo_raz_moi`). Le classement le voit tel qu'il est : mettre son compte de côté avant, le restaurer après.
- **Joueurs** — *réel* : publier une annonce dans la boîte de tous les joueurs ; **offrir un cadeau** à un ou plusieurs joueurs : des Éclats, des boosters, des Fragments, une carte (sauf la carte unique) et un mot. La liste montre, pour chacun, sa date d'inscription, ses boosters ouverts, ses cartes et son retard sur la médiane, de quoi doser un rattrapage. Le joueur le découvre à sa visite suivante, dans un paquet qu'il ouvre lui-même : c'est l'ouverture, côté serveur, qui crédite le compte, une seule fois (`supabase/18_cadeaux.sql`, `js/cadeaux.js`). Une Promo offerte compte comme achetée : la boutique ne la revend pas. Les boosters offerts, comme ceux de la boutique, **ne vont pas dans la réserve** : ils s'ouvrent à part (`open_pack(true)`, colonne `boosters_bonus`), tout de suite après l'achat ou l'ouverture du cadeau, ou plus tard par « Ouvrir un booster en plus » sur l'écran Boosters. Mélangés à la réserve, ils la faisaient déborder du plafond, et une réserve pleine remet son compte à rebours à zéro : on perdait des boosters gratuits en en achetant. Parmi eux, ceux d'un cadeau (`tickets_offerts`) partent en premier et **ne peuvent pas contenir la carte unique**. *Voir un cadeau reçu* montre le paquet tel que le verra le joueur, sans rien envoyer.
- **Aperçus** — *rien n'est envoyé* : les huit ouvertures de test (normale, rare, épique, légendaire, Essence Brillante, carte unique, godpack, Reverse Rare) et l'image de partage d'un booster ; L'Échauffement (la page au premier jour, tout gagné — avec un Pass, un classement et des Braises inventés —, son annonce, les indices, la révélation des 21 étoiles, le défi du jour d'après la saison, son récap et sa fenêtre de fin ; dans l'aperçu, les défis se jouent avec sa collection, sans limite d'essais) et son bandeau ; les fenêtres (nouveautés de la 2.5 et de la 2.1, fin de Reflets avec le teasing de la 2.5, invitation achetée, cadeau reçu) ; le récap de Reflets et son bandeau, avec des chiffres inventés ; l'obtention de chaque carte Promo, une par une ou toutes à la suite ; les notifications du haut de l'écran. « Revenir à l'état réel » efface tout aperçu.

**Si les fonctions manquent** (la base n'a pas reçu `MAJ-2.5.sql`), Serveur et Mon compte le disent et donnent le fichier à coller ; Joueurs et Aperçus marchent quand même. `verif.html` le signale aussi, à un administrateur connecté.

Ce qui a été retiré en 2.5 (alors appelée 2.1.4), parce que plus rien ne s'en sert : les quatre aperçus de la chasse à la carte unique (version 1.5) et ses requêtes, la fenêtre de fin de chasse, les fenêtres de palier du Pass de Reflets, les nouveautés 2.0, et les boutons qui ne faisaient qu'ouvrir un onglet ; puis, avec le Labo de la 2.5, l'onglet « Affichage » (une collection remplie, des boosters ou des Fragments « affichage seulement », effacés au rafraîchissement suivant, et l'interrupteur « Boosters illimités », sans effet en ligne) : « Mon compte » fait la même chose pour de vrai, et se restaure.

Pour obtenir une Promo **pour de vrai** sur son compte sans le master set — et vérifier la détection, la boutique et les paliers de bout en bout — les requêtes sont commentées en bas de `supabase/03b_promos.sql`.

## La pré-prod

La version suivante se teste à **matetcg.com/preprod/**, à côté du vrai site, sans le toucher (`prebuild/`, la 2.x en préparation, a été retiré le 2 novembre 2026) :

    python3 tools/demo.py --preprod

C'est le jeu avec le faux serveur (`_demo/serveur.js`), publié dans `preprod/` : pas de compte, pas de vrai serveur, des joueurs simulés, et le Labo ouvert. Un bandeau « Pré-prod » le rappelle, et la page n'est pas indexée. Tout ce qu'elle range dans le navigateur porte un préfixe à part (`preprod:` pour le stockage local, une base IndexedDB à son nom) : elle ne lit ni n'écrase les réglages ou la session du vrai site, qui partage l'adresse. Elle n'a pas de service worker, pour ne pas vider les caches de celui du vrai site.

Le développement se fait sur une branche à part ; `main` reste le site public. Trois lignes coexistent :

| Lieu | Contenu |
|---|---|
| `main`, à la racine | le vrai site : depuis le 25 octobre 2026, la 2.5 complète en attente de sa sortie (elle se montre en « 2.1.3 » jusqu'au lundi 26 octobre, 0 h, puis bascule toute seule : « Version 2.5 · La sortie datée ») |
| `main`, `prebuild/` | **retiré le 2 novembre 2026** (c'était la démo de la 2.5) |
| `main`, `preprod/` | la démo de la 3.0, construite depuis la branche `version-3.0` (qui a son propre README et son `CLAUDE.md`) : c'est là que le propriétaire teste la 3.0 |
| `main`, `demo/` | la démo de la 3.0 envoyée à Gentle Mates (depuis le 2 novembre 2026), derrière un code d'accès, construite depuis `version-3.0` (`tools/demo.py --demo`) : le jeu à son premier jour, sans version ni nouveautés |
| branche `version-2.5` | **supprimée par le propriétaire le 2 novembre 2026**, avec `claude/interface-ux-fixes-o92u4a` et `teaser-2.x` ; tout son contenu est à la racine de `main` |
| branche `version-3.0` | la 3.0 ; **ne se fusionne jamais dans `main`** |

Pour publier une pré-prod ou une démo : la construire sur `version-3.0`, puis reporter **ce seul dossier** sur `main` (un `git worktree` d'`origin/main`, copier le dossier, `git status` ne doit lister que lui). Le SQL de la version suivante ne touche pas la vraie base avant la sortie : il est testé sur une base PostgreSQL locale, et le faux serveur en reproduit les règles.

## Mettre à jour le site

GitHub Pages sert les fichiers avec un cache de dix minutes. Sans précaution, une
correction poussée peut mettre ce temps-là à apparaître — voire ne jamais apparaître sur
un navigateur qui garde l'ancienne copie. C'est la raison d'être de `tools/version.py` :

```bash
python3 tools/version.py 2.5        # ou 2.5.1, etc.
git add -A && git commit -m "…" && git push
```

Le script écrit le numéro dans `js/pwa.js` (`APP_VERSION`, celui que lit le joueur une
fois la version sortie), et accroche `?v=2.5-<empreinte>` à chaque css et js de
`index.html` et `verif.html`, et la même marque dans `sw.js` (le nom du cache).
L'empreinte, six caractères, est tirée du contenu de ces fichiers (depuis la 2.5) : chaque
état du code a sa propre adresse, même sous le même numéro. Republier la 2.5 après une
correction ne sert donc jamais l'ancienne copie, ni un mélange de fichiers neufs et
vieux ; relancer le script sans rien changer ne change rien. Le service worker met en
réserve les mêmes adresses marquées, et propose la mise à jour au lieu de recharger sous
les doigts.

**À lancer avant chaque mise en ligne qui touche au code, en dernier** (après toute
autre modification des css et des js : sinon l'empreinte ne correspond plus). Les images
et les cartes ne sont pas marquées : elles ne changent jamais sans changer de nom.

Une version qui doit sortir à une heure précise se publie à l'avance : voir « Version 2.5
· La sortie datée » (`SORTIE`, `js/config.js`).

## Dépendances externes

- **Polices Google Fonts** (Archivo, Figtree), chargées en ligne. Sans connexion, le navigateur utilise des polices de secours.
- **supabase-js**, chargé depuis un CDN, uniquement pour le compte en ligne. S'il est absent (hors réseau, bloqueur), le jeu bascule tout seul en mode hors ligne.

Aucune autre bibliothèque, aucune étape de compilation : tout le reste est dans le dépôt.
