# Mate TCG Online

**M8 TCG Online** (ou *Mate TCG*) est un jeu de cartes à collectionner en ligne, fait par des fans autour de **Gentle Mates** (sans lien officiel avec Gentle Mates). On y ouvre des boosters de l'extension *Tout commence ici* (122 cartes), on complète sa collection, on échange avec ses amis et, depuis la version 3.0, on **combat** avec ses decks.

Le site est **statique** : HTML, CSS et JavaScript « vanilla », sans framework, sans paquet npm et sans étape de compilation. Il est hébergé sur **GitHub Pages** (`matetcg.com`). Le serveur est un projet **Supabase** : PostgreSQL, et des fonctions SQL (RPC) qui appliquent toutes les règles du jeu.

> **Ce README est la porte d'entrée unique du projet.** Il est écrit pour quelqu'un, humain ou agent, qui ne connaît rien au dépôt. Il doit rester vrai : **chaque modification du projet met ce fichier à jour dans le même commit** (voir [§ 1.4](#14-garder-ce-readme-à-jour)).

---

## Sommaire

1. [À lire en premier](#1-à-lire-en-premier)
2. [Lancer, tester, publier](#2-lancer-tester-publier)
3. [Arborescence du dépôt](#3-arborescence-du-dépôt)
4. [Architecture du client](#4-architecture-du-client)
5. [Direction artistique](#5-direction-artistique)
6. [Cartes, collection et progression](#6-cartes-collection-et-progression)
7. [Les Combats](#7-les-combats)
8. [Les événements](#8-les-événements)
9. [Le serveur (Supabase)](#9-le-serveur-supabase)
10. [Le Labo (administrateurs)](#10-le-labo-administrateurs)
11. [La pré-prod et le faux serveur](#11-la-pré-prod-et-le-faux-serveur)
12. [Outils, sources et visuels](#12-outils-sources-et-visuels)
13. [Pièges](#13-pièges)
14. [Dette connue](#14-dette-connue)
15. [Historique des versions](#15-historique-des-versions)

Autres documents : [`SETUP.md`](SETUP.md) (mettre un serveur Supabase en ligne, pas à pas), [`docs/design-3.0.md`](docs/design-3.0.md) (le système visuel et son histoire), [`docs/regles-3.0.md`](docs/regles-3.0.md) (les règles du jeu de combat, justifiées), [`docs/economie-3.0.md`](docs/economie-3.0.md) (l'équilibrage, chiffre par chiffre), [`presse/README.md`](presse/README.md) (le kit presse).

---

## 1. À lire en premier

### 1.1 Le projet en une minute

- **Le jeu.** Une réserve de boosters gratuits se recharge (un toutes les 4 h, 5 au plus). Chaque booster contient 6 cartes. Les quêtes paient en **Éclats**, la monnaie du jeu, qui achète boosters et cosmétiques. Les doublons se recyclent en **Fragments**, qui fabriquent les cartes manquantes et, depuis la 3.0.7, font monter la **maîtrise** d'une carte. On échange une carte contre une carte de même rareté avec ses amis. **Aucun argent réel n'entre nulle part.**
- **La 3.0** ajoute les **Combats** : un jeu de cartes complet contre l'IA (tutoriel, campagne de 20 rivaux, Arcade, Raid contre un boss commun) ou contre ses amis (Versus), les **Secrètes** (5 cartes cachées au-delà des 122), l'XP de combattant, l'événement « **Le Choc des Sections** », une **refonte visuelle** complète (palette « Graphite et lavande », verre réservé à ce qui flotte), la maîtrise des cartes et la carte fétiche.
- **La technique.** Une page unique (`index.html`) charge une cinquantaine de scripts classiques qui partagent l'espace global. L'interface est rendue par chaînes HTML (`render()` dans `js/app.js`). Toutes les écritures passent par des RPC SQL `security definer` : le navigateur ne fait foi sur rien d'important.

### 1.2 Où vit quoi : production, branche de travail, pré-prod

| Lieu | Contenu | Version |
|---|---|---|
| **`main`, à la racine** | **Le vrai site**, servi à `matetcg.com` par GitHub Pages (`CNAME`). | **2.1.2** |
| **`main`, dossier `preprod/`** | La pré-prod : une copie *construite* de la version suivante, servie à `matetcg.com/preprod/`, qui tourne avec un **faux serveur** dans le navigateur (aucun compte, aucune base). | 3.0.x |
| **Branche de travail `version-3.0`** | Le **code source** de la version suivante, à la racine. `preprod/` y est aussi versionné : identique à `main` juste après une publication, en avance entre deux (`git diff --stat origin/main HEAD -- preprod`). | 3.0.8 |
| **Base Supabase de production** | Installée en 2.1. **Aucun SQL 3.0 n'y a été joué.** | 2.1 |

**État du projet.** Le 24 septembre 2026, le lancement public a été **annulé** après échange avec Gentle Mates (`vAnnonceArret()`, `js/gate.js`) : l'écran d'entrée du vrai site affiche « Projet annulé · Merci ». Les comptes déjà invités jouent toujours à la 2.1.2. Le développement de la 3.0 continue **uniquement en pré-prod**.

**Conséquence pratique.** On développe sur la branche, on construit `preprod/` avec `python3 tools/demo.py --preprod`, et on ne reporte **que `preprod/`** sur `main` ([§ 2.5](#25-construire-et-publier-la-pré-prod)). **La branche ne se fusionne jamais dans `main`** : sa racine est la 3.0, qui appelle des RPC absentes de la base de production.

### 1.3 Les règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Le travail sur la 3.0 ne touche que `preprod/` sur `main`, et aucun SQL 3.0 n'est joué sur la base de production. Le vrai site (la 2.x) peut, lui, évoluer à la demande du propriétaire : on travaille alors sur une branche partie de `main` (par exemple `teaser-2.x`), et on ne publie qu'après son accord.
2. **Pas de pull request** sans demande explicite.
3. **Français**, partout : interface, commentaires, documentation, messages de commit.
4. **Mode sombre uniquement.** Il n'y a qu'un thème.
5. **Aucun identifiant de modèle d'IA** dans les messages de commit, le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : dire ce qui est sûr, ce qui est supposé et ce qui n'a pas été testé.
7. **Ce README est tenu à jour à chaque modification** ([§ 1.4](#14-garder-ce-readme-à-jour)).
8. **La DA s'applique partout** ([§ 5](#5-direction-artistique)) : un écran nouveau ou retouché doit s'y fondre.

### 1.4 Garder ce README à jour

Ce fichier n'est utile que s'il est vrai. Toute modification du projet, même petite, se termine par une relecture des sections qu'elle touche :

- **un fichier ajouté, supprimé ou déplacé** → [§ 3](#3-arborescence-du-dépôt) ;
- **une règle de jeu, un montant ou un taux** → la section du domaine, et [§ 9.8](#98-une-règle-plusieurs-copies) (les copies à tenir d'accord) ;
- **un élément visuel** → [§ 5](#5-direction-artistique) ;
- **une RPC, une table** → [§ 9](#9-le-serveur-supabase) ;
- **un piège découvert** → [§ 13](#13-pièges) ; **une dette** → [§ 14](#14-dette-connue) ;
- **une nouvelle version** → [§ 15](#15-historique-des-versions).

Un README faux est pire que pas de README : en cas de doute, vérifier dans le code, et corriger le README.

### 1.5 Premiers pas (liste de reprise)

1. Lire ce README en entier, puis [`docs/design-3.0.md`](docs/design-3.0.md) avant de toucher à un écran, et [`docs/regles-3.0.md`](docs/regles-3.0.md) avant de toucher aux combats.
2. `git fetch origin` : la branche `main` locale peut être en retard sur `origin/main`. Toujours comparer avec `origin/main`.
3. `node tools/combat-tests.js` : les tests de règles doivent tous passer.
4. `python3 tools/demo.py --preprod`, puis servir le dépôt ([§ 2.1](#21-servir-le-site-en-local)) et ouvrir `/preprod/` : c'est là que la 3.0 se teste.
5. Regarder [§ 14](#14-dette-connue) : ce qui est connu pour être faux ou mort.

---

## 2. Lancer, tester, publier

### 2.1 Servir le site en local

```bash
npx http-server -p 8781 -c-1 -s .        # ou : python3 -m http.server 8781
```

- **`http://localhost:8781/preprod/`** : la 3.0 avec le faux serveur. C'est **l'adresse de travail**. Il faut d'abord `python3 tools/demo.py --preprod` après chaque modification : `preprod/` est une copie construite, pas un lien vers les sources.
- **`http://localhost:8781/`** : la racine de la branche. Elle parle au **vrai** Supabase (clés réelles dans `js/supabase-config.js`), qui est en 2.1 : on n'y voit que l'écran « Projet annulé ». Ne pas s'en servir pour tester la 3.0.
- `.claude/launch.json` lance `python3 -m http.server 8781` (configuration « mate-tcg ») : même adresse, mais ce serveur-là laisse le navigateur garder ses fichiers en cache.
- `-c-1` coupe le cache du serveur ; un service worker de production ne s'installe pas en local sous `/preprod/`, mais il peut traîner dans un navigateur qui a déjà visité la racine : en cas de doute, navigation privée.

**Remettre la démo à zéro** : ajouter `?reinitialiser` à l'adresse. Cela n'efface que l'état du faux serveur ; les réglages du navigateur (`preprod:mtcg.*` dans `localStorage` : tutoriel vu, fenêtres vues…) restent. Pour tout effacer, vider aussi le stockage du site.

### 2.2 Les tests

| Commande | Ce qu'elle vérifie |
|---|---|
| `node tools/combat-tests.js` | Les règles du combat, une à une (38 tests ; code de sortie 1 en cas d'échec). |
| `node tools/combat-sim.js aleatoire 2000` | Des parties au hasard : aucun plantage, et le rejeu redonne la même partie. |
| `node tools/combat-sim.js clone 200` | La fidélité de `Combat.cloner` (en cas d'écart : `/tmp/a.json` et `/tmp/b.json`). |
| `node tools/combat-sim.js ia 200 3 4` | L'équilibre entre deux niveaux d'IA. |
| `node tools/combat-sim.js starters 200` | L'équilibre entre les deux Starter Decks. |

Il n'y a pas de tests automatisés de l'interface. **Toute modification visible se vérifie dans Chromium** (Playwright est installé dans l'environnement cloud : `require(<npm root -g>/playwright)`, Chromium dans `/opt/pw-browsers`), aux largeurs **390 × 844**, **375 × 667**, **360 × 740** et sur ordinateur (**1280 × 800**). Une capture regardée vaut mieux qu'une hypothèse.

### 2.3 Tester le SQL sur un PostgreSQL local

PostgreSQL 16 est installé dans l'environnement cloud. Une commande fait tout :

```bash
tools/tester-sql.sh [test1.sql …]
```

Elle démarre un PostgreSQL local (`/var/tmp/pg-m8`, port 5499, laissé allumé), recrée une base `m8`, y joue `tools/sql-stub.sql` (l'imitation de Supabase : rôles `anon` / `authenticated` / `service_role`, schéma `auth`, `auth.users`, `auth.uid()` lu dans `request.jwt.claim.sub`, publication `supabase_realtime`), puis **la base de production** (`supabase/TOUT.sql` d'`origin/main`, la 2.1), puis le `TOUT.sql` de la branche **deux fois** (il doit être rejouable), puis les fichiers de test donnés. Pour l'arrêter : `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg-m8/data stop"`.

Jouer en tant que joueur : insérer un utilisateur **avec une adresse e-mail** dans `auth.users` (le profil se crée par trigger), puis inscrire **cette adresse** dans `beta_invites` (`insert into beta_invites (cle) values ('moi@exemple.fr');` : la clé est l'e-mail ou le `provider_id` Discord, jamais l'uuid ; sans cela, tout répond `BETA_FERMEE`). Puis :

```sql
select set_config('request.jwt.claim.sub', '<uuid>', false);
set role authenticated;
select open_pack();
reset role;   -- pour relire les tables (le rôle authenticated n'y a pas accès)
```

### 2.4 Changer de version

```bash
python3 tools/version.py 3.0.8
```

Le script écrit `APP_VERSION` (`js/pwa.js`) et `VERSION = 'mtcg-v3.0.8'` (`sw.js`), ajoute `?v=3.0.8` à chaque CSS et JS local d'`index.html` et de `verif.html`, et **régénère la liste `ESSENTIEL` de `sw.js`**. Il ne touche ni `preprod/` (relancer `demo.py --preprod` ensuite), ni `NOUVEAUTES_VERSION` (`js/bienvenue.js`), ni ce README.

**Pourquoi.** GitHub Pages met en cache dix minutes, et le service worker garde les fichiers : sans `?v=`, une correction peut ne jamais arriver chez un joueur.

### 2.5 Construire et publier la pré-prod

```bash
python3 tools/version.py 3.0.x            # si la version change (avant demo.py : il relit la version)
python3 tools/demo.py --preprod           # construit preprod/
git add -A && git commit && git push -u origin <branche>

# Reporter preprod/ seul sur main :
W=<dossier temporaire>; git fetch origin main
git worktree add --detach $W origin/main
rm -rf $W/preprod && cp -a preprod $W/preprod
cd $W && git add -A preprod && git status --short   # ne doit lister que preprod/
git commit -m "Pré-prod 3.0.x : …" && git push origin HEAD:main
cd - && git worktree remove --force $W
```

Contrôle après coup : `git diff --stat origin/main~1 origin/main` ne liste que `preprod/`. GitHub Pages publie en une à deux minutes.

### 2.6 La démo autonome

`python3 tools/demo.py` (sans option) construit la même chose dans `_build/m8tcg-demo/` et `_build/m8tcg-demo.zip` (ignorés par git) : un jeu complet à envoyer en fichier, qui s'ouvre sans serveur. `_demo/LISEZMOI.txt` l'accompagne. Les réglages de départ (pseudo, Éclats offerts, rythme des boosters, échelle du Raid) sont dans `_demo/reglages.js`.

### 2.7 Le jour d'une sortie en production

Il n'y en a pas de prévue (projet annulé). Si cela changeait : fusionner la branche dans `main`, coller `supabase/TOUT.sql` dans Supabase (il passe sur une base 2.x sans rien perdre, testé), régler `PORTE` et `beta_lancement()` ([§ 4.9](#49-porte-bêta-et-connexion)), puis ouvrir l'événement à la main (commande en fin de `supabase/installation/25_choc.sql`). La mise en place d'un serveur neuf est décrite dans [`SETUP.md`](SETUP.md).

---

## 3. Arborescence du dépôt

```
.
├── index.html             La page unique : squelette DOM, chargement ordonné des CSS et des JS
├── verif.html             Diagnostic d'une installation Supabase (non copié dans la pré-prod)
├── manifest.webmanifest   Application installable (nom, icônes, couleurs)
├── sw.js                  Service worker (cache hors réseau, versionné)
├── CNAME                  matetcg.com (ne compte que sur main)
├── README.md              Ce fichier
├── SETUP.md               Mettre un serveur Supabase en ligne, pas à pas
├── CLAUDE.md              Consignes lues d'abord par les agents : renvoi à ce README, règles du propriétaire (copie du § 1.3 : modifier les deux ensemble)
├── .claude/launch.json    Serveur local pour les agents (port 8781) ; .claude/worktrees/ (ignoré) reçoit les copies de travail des agents
├── .gitignore             _build/, __pycache__/, .claude/worktrees/
├── .gitattributes         Fins de ligne normalisées ; les .avif en binaire
│
├── js/                    Le client (scripts classiques, un espace global)
│   ├── config.js          Configuration : nom, couleurs, raretés, cadres, titres, succès, onglets, icônes
│   ├── supabase-config.js Les deux clés publiques Supabase (réécrites dans la pré-prod)
│   ├── utils.js           Petits outils ($, h, toast, RM, essIcon, gyroscope…)
│   ├── sfx.js             Bruitages synthétisés (Web Audio, aucun fichier son)
│   ├── cards-data.js      Les 122 cartes de l'extension (données brutes)
│   ├── promos-data.js     Promos, carte unique, Secrètes (données brutes)
│   ├── cards.js           Fabrique les objets carte (aussi chargé par Node)
│   ├── storage.js         État global (save, cards, byId…) et IndexedDB
│   ├── render-card.js     renderCard(c, {m, calme}) : une carte en HTML
│   ├── maitrise.js        Maîtrise des cartes et carte fétiche (3.0.7)
│   ├── ui.js              Feuilles, avatars, recadrage d'illustration, agir(), formats
│   ├── backend.js         Toutes les données passent ici : RPC Supabase (ou mode local)
│   ├── gate.js            Écran d'entrée : porte, bêta, invitation, annonce d'arrêt
│   ├── auth.js            Écran de connexion (Discord ; e-mail désactivé)
│   ├── fx.js              Particules (canvas #fx)
│   ├── booster.js         Réserve, tirage local, écran Boosters, bandeaux d'événement
│   ├── opening.js         Ouverture plein écran, révélations, récap
│   ├── collection.js      Onglet Collection
│   ├── viewer.js          Fiche de carte plein écran (pages Infos, Maîtrise, Gérer)
│   ├── trade.js           Échanges, et utilitaires d'exemplaires utilisés partout
│   ├── social.js          Onglet Social : amis, fiche d'un joueur
│   ├── quests.js          Onglet Quêtes, notifications de quête
│   ├── classement.js      Onglet Classement
│   ├── tirages.js         Onglet Mes tirages
│   ├── partage.js         Image de partage d'un booster (canvas 1080 × 1350)
│   ├── promos.js          Scène d'obtention d'une Promo
│   ├── boite.js           Boîte de réception, cloche, temps réel
│   ├── shop.js            Boutique, scène d'achat, invitations
│   ├── recyclage.js       Recyclage et fabrication
│   ├── combat/            Les Combats (3.0)
│   │   ├── moteur.js      Les règles : générateur, état JSON, déterminisme (aussi sous Node)
│   │   ├── effets.js      L'effet de chaque carte
│   │   ├── decks.js       Decks : limites, vérification, Starters, aléatoire, codes, bilan
│   │   ├── ia.js          L'IA, cinq niveaux
│   │   ├── campagne.js    Sections, rivaux de la campagne, récompenses, Arcade
│   │   ├── choc-data.js   Chiffres du Raid et de l'Épreuve du jour
│   │   ├── niveaux.js     XP et niveaux de combattant
│   │   ├── guides.js      Guide et glossaire pour les joueurs
│   │   ├── table.js       L'arène plein écran (TAPIS et SLEEVES en bas du fichier)
│   │   ├── tutoriel.js    La partie guidée
│   │   ├── atelier.js     L'atelier de decks
│   │   └── defis.js       Versus entre amis
│   ├── battle.js          Onglet Combats (accueil, campagne, Arcade, Versus, decks, guides)
│   ├── profile.js         Onglet Profil (avatar, cadre, titre, bannière, vitrine, fétiche)
│   ├── settings.js        Onglet Réglages (et bindReglages(), rejoué à chaque rendu)
│   ├── bienvenue.js       Fenêtres d'accueil, nouveautés, Discord
│   ├── cadeaux.js         Les cadeaux d'un administrateur
│   ├── reflets.js         Événement 2.0 « Reflets », et Devine l'illu
│   ├── choc.js            Événement 3.0 « Le Choc des Sections »
│   ├── raid.js            Le Raid
│   ├── pwa.js             Installation, service worker, APP_VERSION
│   ├── lab.js             Onglet Labo (administrateurs)
│   ├── cadrage.js         Hauteur de l'application installée (chargé dans <head>)
│   └── app.js             Navigation, rendu, clics, démarrage (chargé en dernier)
│
├── css/                   Les styles, chargés dans cet ordre
│   ├── tokens.css         Les jetons : palette, typographies, rayons, ombres
│   ├── base.css           Fond, en-tête, barre du bas, boutons, panneaux, feuilles
│   ├── cards.css          Cartes, reflets de rareté, grille de la Collection
│   ├── booster.css        Écran Boosters et déchirure du paquet
│   ├── opening.css        Théâtre d'ouverture et récap
│   ├── viewer.css         Fiche de carte
│   ├── maitrise.css       Maîtrise, carte fétiche
│   ├── lab.css            Labo
│   ├── auth.css           Connexion, écran d'entrée, champs de saisie communs
│   ├── hub.css            Écrans autour du jeu, tiroir, rail d'ordinateur, mouvements réduits
│   ├── promo.css          Scène d'obtention d'une Promo
│   ├── reflets.css        Charpente des événements (réutilisée par le Choc), cadres décorés 2.0
│   ├── combat.css         Onglet Combats
│   ├── arene.css          L'arène
│   └── choc.css           Le Choc des Sections, cadres 3.0
│
├── supabase/              Le serveur (voir § 9)
│   ├── TOUT.sql           Assemblé par tools/build-sql.py : ce qu'on colle dans Supabase
│   ├── installation/      01_schema.sql … 28_maitrise.sql : les 21 fichiers assemblés dans TOUT.sql
│   └── administration/    admin.sql, beta.sql, reset-profil.sql, reset-tout.sql : à jouer à la main
│
├── cards/                 Les images des cartes (.avif 1000 × 1397), promos/ et uniques/
├── assets/                Habillage : logos, paquets, essences, cadres, cosmétiques de combat, icônes
├── docs/                  design-3.0.md, regles-3.0.md, economie-3.0.md
├── tools/                 Scripts de maintenance (§ 12)
├── _demo/                 Le faux serveur, ses réglages, LISEZMOI.txt de la démo autonome (non publié)
├── _sources/              Images d'origine des visuels générés (non publié)
├── presse/                Kit presse : visuels, polices, mode d'emploi
└── preprod/               La pré-prod CONSTRUITE (ne jamais l'éditer à la main)
```

GitHub Pages passe par Jekyll : les dossiers qui commencent par `_` (`_demo/`, `_sources/`, `_build/`) ne sont pas publiés. Sur `main`, `preprod/`, `presse/`, `tools/` et `supabase/` le sont. `docs/`, `CLAUDE.md` et `_sources/` n'existent que sur la branche.

---

## 4. Architecture du client

### 4.1 Scripts classiques, un seul espace global

Il n'y a **ni modules ni bundler**. `index.html` charge les scripts dans un ordre strict ; chaque `const`, `let` ou `function` de premier niveau devient global.

- **Ordre** : `config` → `supabase-config` → `utils` → `sfx` → `cards-data` → `promos-data` → `cards` → `storage` → `render-card` → `maitrise` → `ui` → `backend` → `gate` → `auth` → `fx` → `booster` → `opening` → `collection` → `viewer` → `trade` → `social` → `quests` → `classement` → `tirages` → `partage` → `promos` → `boite` → `shop` → `recyclage` → `combat/{moteur, effets, decks, ia, campagne, choc-data, niveaux, guides, table, tutoriel, atelier, defis}` → `battle` → `profile` → `settings` → `bienvenue` → `cadeaux` → `reflets` → `choc` → `raid` → `pwa` → `lab` → **`app` en dernier**. `js/cadrage.js` est chargé à part, dans `<head>`.
- **Deux déclarations de même nom** au premier niveau : si l'une est un `const` ou un `let`, le second script lève une `SyntaxError` et ne s'exécute pas du tout ; si ce sont deux `function`, il n'y a **aucune erreur** : la dernière chargée remplace l'autre partout, en silence. Chercher le nom (`grep -rn`) avant d'en créer un.
- **Le code exécuté au chargement** doit trouver ses dépendances déjà chargées. Le code dans les fonctions peut, lui, utiliser n'importe quel script (la résolution se fait à l'appel).
- `moteur.js`, `effets.js`, `decks.js` et `ia.js` sont enfermés dans une IIFE (`globalThis`) et n'exposent que `Combat`, `Decks` et `IA`. **Tournent aussi sous Node**, dans un contexte sans DOM ni `localStorage` (`tools/combat-sim.js`, donc aussi `combat-tests.js`) : `config.js`, `utils.js`, `cards-data.js`, `promos-data.js`, `cards.js`, `combat/moteur.js`, `effets.js`, `decks.js`, `ia.js`, `campagne.js`, `choc-data.js`, `niveaux.js` et `tutoriel.js`. Aucun ne doit toucher au DOM au chargement. Un nouveau fichier de règles s'ajoute à cette liste (un fichier absent est sauté sans message).
- La bibliothèque Supabase (`supabase-js@2.116.0`, UMD) vient de jsDelivr. Dans la pré-prod, `demo.py` la remplace par le faux serveur.
- **Ajouter un fichier** : la balise dans `index.html` à sa place, puis `python3 tools/version.py <version en cours>` (le numéro est obligatoire : sans lui, le script affiche son aide et s'arrête). Sinon `sw.js` ne connaît pas le fichier, et le démarrage hors réseau casse.

### 4.2 Le démarrage (`js/app.js`, fin du fichier)

1. Construire les cartes : `buildCards`, `buildPromos`, `buildBrillantes`, `buildReverses`, `buildUniques`, `buildSecretes`, puis `rebuild()` (l'index `byId`) et `Combat.catalogue(…)`.
2. `brand()`, `rollPack()`, `oublierTheme()`, `poserRM(reglageRM())`.
3. `brancherSW()` — **avant le premier `await`** : il écoute `load`.
4. `lireErreurRetour()` — **avant `Backend.init()`**, qui nettoie l'URL au retour de Discord.
5. `await Backend.init()` : session Supabase, puis `pull()` (la RPC `me`).
6. Si `PORTE.active` : `Porte.lire()`. Si la porte est fermée : `render()` et arrêt.
7. En ligne : `checkin()` (une fois par jour de Paris), `loadShop`, `loadTrades`, `loadAmis`, `demarrerBoite()`, `relireCadeaux()`, `chargerIllu()`.
8. `render()`.

### 4.3 Le rendu

- **`render()`** réécrit `#main.innerHTML` avec `VUES[tab]()` : chaque vue est une fonction `vXxx()` qui renvoie une chaîne HTML. Il n'y a ni DOM virtuel ni composants : l'état d'interface vit dans des globales (`colVue`, `cbVue`, `trVue`, `socVue`, `qVue`, `shopVue`, `chVue`…).
- Ordre : porte fermée → `vPorte()` ; sinon connexion nécessaire → `vAuth()` ; sinon en-tête (`header()`), barre (`navHTML()`), puis la vue.
- **Ce qui survit à un rendu** (sur le même onglet) : le défilement de `#main` ; l'état ouvert des `<details data-garde="clé">` ; le défilement des éléments `[data-defil="clé"]` ; dans un `[role=tablist][data-defil]`, l'élément `.on` est ramené en vue.
- `#main` reçoit la classe `tab-<onglet>` : c'est par elle qu'on stylise un onglet (`#main.tab-boosters`). **Jamais de `data-tab` sur `<body>`** : chaque clic deviendrait un retour à l'onglet.
- Après le rendu : `bindPack()` (Boosters), `placerPass()` / `placerPassChoc()` (Pass), `bindAtelier()` / `bindGuide()` (Combats), **`bindReglages()` à chaque rendu** (il rebranche tous les champs à `id` du jeu), puis `viderFilePromos()` et `proposerAccueil()`.
- **`aller(id)`** change d'onglet (son, défilement en haut, `render()`) et relance le chargement propre à l'onglet (Social, Boutique, Choc, Classement…).
- **Seul `<main>` défile** : `html` et `body` sont en `overflow:hidden`. Utiliser `$('#main').scrollTop`, jamais `window.scrollTo`.

### 4.4 Les clics

Un seul gestionnaire, `clicPage(e)` (`js/app.js`), écoute `#main`, `#sheet` et `#tiroir`. Il cherche le premier ancêtre qui porte un des attributs de la liste du `closest(…)` et le traite dans cet ordre :

1. `data-tab` → `aller()` (**traité avant tout** : un autre attribut posé sur le même élément est ignoré, sauf `data-colvue`, appliqué juste avant pour ouvrir une vue précise de la Collection) ;
2. les préfixes de module : `data-cb` → `cbAction` (Combats), `data-ch` → `chAction` (Choc), `data-rd` → `raidAction` (Raid) ;
3. les attributs spécialisés (`data-show`, `data-craft`, `data-shop`, `data-quete`, `data-tr…`, `data-rec…`, `data-vit-…`, `data-palier`, `data-illu`…) ;
4. enfin `switch (d.act)` sur `data-act`.

Ont leur propre délégation : `#nav` et l'en-tête, `#viewer` (`data-v`, `js/viewer.js`), `#theater` (`data-t`, `js/opening.js`), les feuilles (`data-si`, `js/ui.js`) et l'arène (`data-ar`, `js/combat/table.js`).

**Ajouter un bouton** : de préférence `data-act="mon-action"` et un `case` dans le `switch`. Un attribut `data-x` nouveau doit **aussi** être ajouté à la liste du `closest(…)`, sinon il est ignoré.

### 4.5 La boucle d'une seconde et le redessin discret

Un `setInterval` d'une seconde (`js/app.js`) : relève le serveur quand un booster devrait être rechargé, ou au passage d'une bascule d'événement (au plus toutes les 30 s), met à jour les comptes à rebours `[data-rebours]` et la remise des quêtes.

`majDiscrete(pageAussi)` met à jour l'en-tête, la barre et le tiroir, mais **ne redessine la page que si** `!ecranOccupe()` (ouverture de booster, scène Promo, combat) **et** `!enTrainDEcrire()` (un champ de saisie a le focus : échanges, Labo, devise, atelier…). **Tout nouveau champ de saisie** doit être ajouté à `enTrainDEcrire()`, sinon un rafraîchissement de fond lui vole le focus.

Au retour sur l'onglet du navigateur (`visibilitychange`) : `pull`, relève de la boîte, des cadeaux et de Devine l'illu.

### 4.6 L'objet `save` et `Backend`

- **`save`** est l'état du joueur. En ligne, **il est entièrement reconstruit** par `Backend.apply(me())` à chaque `pull()`, `checkin()` ou action : un champ posé à la main sur `save` disparaît au rafraîchissement suivant. Ne jamais y ranger d'état d'interface.
- Champs principaux : `id`, `pseudo`, `avatar`, `frame`, `isAdmin`, `invite` (strictement `=== true`), `filleul` ; `tickets`, `bonus`, `lastTick` ; `col` (`{id: nombre}`), `inv`, `vitrine`, `garder`, `gardes`, `favoris` ; `shards` (Éclats), `fragments`, `prismes` (monnaie de l'événement en cours) ; `quetes`, `succes`, `titre`, `banniere`, `devise`, `titres` ; `evenement`, `recap`, `chasse` ; `combat` ; `maitrises` (`{idClassique: niveau}`) et `fetiche`.
- `Backend.apply` écrase aussi `TICKET_CAP` et `INTERVAL` (le serveur impose le rythme), calcule `Backend.skew` (décalage d'horloge : `srvTime(iso)` en tient compte), puis appelle `signalerQuetes` et `signalerPromos`, qui comparent l'état précédent au nouveau.
- **`Backend.rpc(nom, args)`** appelle une RPC, retire les préfixes d'erreur SQL et traduit les codes connus (`MSG_SERVEUR` : `BETA_FERMEE`, `RESERVE_VIDE`, `BONUS_VIDE`, `BOOSTER_VIDE`, `ECHANGE_EN_RECHARGE`, `non connecte`). Les autres messages SQL sont **montrés tels quels au joueur** : ils doivent être en français.
- **`agir(fn, msg)`** (`js/ui.js`) enveloppe une action : `occupe`, `await fn`, toast, `render()` ; renvoie `true` ou `false`. À utiliser pour toute action serveur déclenchée par un bouton.
- Le mode `local` (sauvegarde IndexedDB, sans compte) existe encore dans le code mais **n'est plus atteignable** ([§ 4.9](#49-porte-bêta-et-connexion)).

### 4.7 Les onglets

Les onglets sont décrits par `TABS` (`js/config.js`) :

| Drapeau | Effet |
|---|---|
| `bas: true` | Barre du bas sur mobile, rail sur ordinateur : **Boosters, Collection, Combats, Social, Quêtes** (cinq places, pas une de plus). |
| `tiroir: true` | Tiroir du compte sur mobile (on l'ouvre par l'avatar), second groupe du rail sur ordinateur : Mon profil, Mes tirages, Devine l'illu, Classement, Boutique, Recyclage, Réglages, Labo. |
| `evenement: 'code'` | L'onglet d'un événement (`reflets`, `choc`) : présent pendant l'événement et les 3 jours de son récap, **en tête du tiroir**. |
| `horsEvenement: 'reflets'` | Devine l'illu disparaît pendant Reflets (le jeu vit alors dans l'onglet Reflets). |
| `admin: true` | Labo : seulement si `save.isAdmin`. |

La boîte de réception n'a pas d'onglet visible : on l'ouvre par **la cloche** de l'en-tête. Sur ordinateur (`min-width: 900px`, `surOrdi()`), la barre devient un **rail à droite** et il n'y a pas de tiroir. Les **pastilles** (`pastilleOnglet()`) signalent ce qui attend : boosters disponibles, quêtes à encaisser, demandes sur Social, défis et coffres du Raid sur Combats, paliers et quêtes d'événement.

**Ajouter un onglet** : une entrée `TABS` (`id`, `nom`, `ico` = clé de `NAVICO`, `bas` ou `tiroir`, `desc`), une vue dans `VUES` (`js/app.js`), et si besoin un chargement dans `aller()`, une pastille dans `pastilleOnglet()`.

### 4.8 Feuilles, toasts, notifications, fenêtres d'accueil

- **Feuille** : `openSheet({title, body, actions: [{label, fn, primary}], locked})` (`js/ui.js`). `body` est du HTML brut (échapper avec `h()`). L'action `primary` devient un bouton plein, les autres des boutons « ghost ». Sur mobile elle monte du bas et se ferme d'un glissé vers le bas ; sur ordinateur elle se centre. `locked` empêche de la fermer en touchant le fond.
- **Toast** : `toast(message)` (2,6 s). **Notification** en haut d'écran : `notifQuete()` (quêtes), `notifBoite()` (boîte).
- **Fenêtres d'accueil** (`js/bienvenue.js`) : une seule proposition par session, par `quandCalme()` qui attend que l'écran soit libre. Ordre de `proposerAccueil()` : bienvenue, fin de chasse, récap Reflets, récap Choc, nouveautés, Discord. La fenêtre des **nouveautés** se montre une fois par valeur de `NOUVEAUTES_VERSION` (aujourd'hui `'3.0'`) et à l'annonce puis au début d'un événement ; `montrerNouveautes()` choisit la fonction selon la version (le test `=== '3.0'` est écrit en dur).

### 4.9 Porte, bêta et connexion

Deux écrans peuvent remplacer le jeu :

- **la porte** (`vPorte()`, `js/gate.js`, `body.inlock`) : l'écran d'entrée ;
- **la connexion** (`vAuth()`, `js/auth.js`, `body.inauth`).

`etatPorte()` décide :

1. `PORTE.active === false` → ouvert ;
2. pas de session en ligne → `'attente'` : l'annonce « Projet annulé · Merci », le lien Discord, « J'ai déjà un accès » (connexion Discord) et Matepedia ;
3. connecté et `save.invite === true` → le jeu ; sinon `'refus'` : la saisie d'un **code d'invitation** (`utiliser_invitation`) et « Changer de compte ».

Avec `PORTE.active = true` (la valeur actuelle, sur `main` comme sur la branche), **`vAuth()` n'est jamais visible** et le jeu sans compte n'est plus atteignable. Côté serveur, `beta_lancement()` vaut `'infinity'` : la bêta est fermée pour toujours ; `garde_beta()` refuse toute action d'un compte qui n'est pas dans `beta_invites`. **Rouvrir le jeu** demanderait les deux : `PORTE.active = false` **et** une date passée dans `beta_lancement()`.

Un lien `?invitation=CODE` est retenu (`mtcg.invitation`). Tant qu'un code est gardé, l'écran d'attente devient « Tu es invité », avec le seul bouton « Me connecter avec Discord » ; après la connexion, le code est essayé automatiquement, une seule fois (`essayerInvitationGardee`, lancé par `bindPorte`). La connexion se fait **par Discord** ; l'e-mail existe dans le code mais est fermé (`CONNEXION.email = false`, `js/config.js`).

### 4.10 PWA, service worker, versionnage

- `manifest.webmanifest` + `sw.js` rendent le site installable et consultable hors réseau. `js/pwa.js` propose l'installation (après 2 boosters ouverts, pas dans les 14 jours suivant un refus ; trois étapes illustrées sur iPhone) et prévient d'une nouvelle version (« Recharger »).
- `sw.js` : le **code** (CSS, JS) est servi réseau d'abord, puis cache ; les **médias** (images, polices) sont servis **depuis le cache, à vie, jusqu'au prochain changement de `VERSION`**. Une image retouchée sous le même nom reste donc l'ancienne chez les joueurs : changer son nom, ou changer de version.
- La pré-prod n'a pas de service worker (`brancherSW()` neutralisé par `demo.py`), **mais celui du vrai site couvre aussi `/preprod/`**. C'est pourquoi `demo.py` ajoute `?v=<version>` à toutes les URL `assets/…` de la pré-prod (pas à `cards/`).
- `js/cadrage.js` corrige la hauteur de l'application installée (`--app-h`, `html.cadre-app`).

### 4.11 Stockage local et réglages de l'appareil

| Clé `localStorage` | Contenu |
|---|---|
| `mtcg.rm` | Réglage « Animations réduites » (pose `html.rm`). |
| `mtcg.jeu` | `{recapDirect, vibrer, gyro, rapide}` (récap direct à l'ouverture, vibrations, gyroscope, combats rapides). |
| `mtcg.audio` | Réglages du son. |
| `mtcg.accueil` | Fenêtres d'accueil déjà vues. |
| `mtcg.install` | Proposition d'installation. |
| `mtcg.invitation` | Code d'invitation gardé. |
| `mtcg.tutoriel`, `mtcg.guides.lus` | Tutoriel réussi, chapitres du Guide lus. |
| `mtcg.combat.encours` | Combat en cours, pour la reprise après rechargement. |

IndexedDB : base `premier-lobby` (en pré-prod `premier-lobby-preprod`), magasin `kv` ; le faux serveur y range tout son état sous la clé `demo-serveur`. Dans la pré-prod, **toutes** les clés `localStorage` sont préfixées par `preprod:` (le vrai site partage l'adresse).

### 4.12 Sons et particules

- **Sons** (`js/sfx.js`) : tout est synthétisé en Web Audio, il n'y a aucun fichier son. Une recette par son dans `RECETTES` (`tap`, `onglet`, `carte`, `retourne`, `dechire`, `rare`, `epique`, `legend`, `gagne`, `erreur`…) ; `SFX.jouer(nom)`. Chaque `button` sonne seul ; `data-snd="nom"` choisit le son, `data-snd="non"` le coupe. Sur mobile, le contexte audio est réveillé au premier geste et repris au retour sur l'onglet (sur iPhone, l'interrupteur silencieux coupe tout).
- **Particules** (`js/fx.js`) : `FX.burst`, `FX.sparkle`, `FX.confetti` sur `canvas#fx`.

---

## 5. Direction artistique

> Le système visuel complet, son histoire et ses sources sont dans [`docs/design-3.0.md`](docs/design-3.0.md). **Les valeurs font foi dans `css/tokens.css`.** Cette section est le guide pratique : ce qu'il faut savoir pour qu'un écran nouveau s'intègre sans qu'on le remarque.

### 5.1 L'esprit : graphite, lavande et verre liquide

La DA 3.0 s'appelle **« Graphite et lavande »**. Elle a été choisie sur maquettes parmi trois propositions, après une première refonte jugée « pas belle, pas harmonieuse ». Ses cinq principes :

1. **Le contenu d'abord.** L'interface est un **gris anthracite neutre**, à peine violacé ; ce sont les cartes et les illustrations qui portent la couleur de l'écran.
2. **Des tuiles pleines.** Les blocs sont des aplats posés sur le fond par une ombre douce, à la manière de *Pokémon TCG Pocket* — jamais des voiles translucides.
3. **Une seule couleur d'action, la lavande**, partout, arène comprise. **Choisir n'est pas agir** : ce qu'on a choisi est **blanc**.
4. **Le verre pour ce qui flotte, et seulement ça.** C'est le principe du *Liquid Glass* d'Apple (WWDC 2025) : un verre dépoli, lumineux sur son bord haut, réservé à la couche qui flotte au-dessus du contenu (barre des onglets, en-tête, feuilles, tiroir, toasts). **Jamais de verre sur du verre**, jamais de flou animé, toujours un repli opaque.
5. **Lisible d'abord.** Contraste WCAG 2.2 vérifié : 4,5:1 pour le texte, 3:1 pour les gros titres et les éléments graphiques.

**Sombre uniquement** (`color-scheme: dark`) : il n'y a qu'un thème, et `oublierTheme()` efface un ancien réglage.

### 5.2 La palette

Les principaux jetons de `css/tokens.css` (onze jetons inutilisés en ont été retirés en 3.0.8 ; s'y ajoutent `--on-accent` `#fff`, le texte posé sur `--cta` ; `--warn` `#f5c451`, même valeur que `--gold` ; `--violet-glow` `rgba(140,120,255,.3)`, le halo lavande des grands avatars) :

| Jeton | Valeur | Usage |
|---|---|---|
| `--bg` | `#121119` | Fond de page (jamais de noir pur ; aussi `theme-color`) |
| `--bg-2` | `rgba(0,0,0,.26)` | Le creux : jauge vide, rail de `.segbar`, case vide |
| `--surface` / `-2` / `-3` | `#1c1b25` / `#24232f` / `#2d2b3a` | Les tuiles, de la plus basse à la plus haute |
| `--plate` / `-2` / `-3` | `#16151e` / `#1c1b25` / `#2a2837` | Aplats opaques posés **sur une image** (badges, compteurs) |
| `--veil-2` | `rgba(18,17,25,.92)` | Voile presque opaque |
| `--scrim` | `rgba(8,7,12,.66)` | Fond derrière une feuille ou le tiroir |
| `--line` / `-2` / `-3` | blanc à 7 / 12 / 20 % | Filets |
| `--text` / `--subtle` / `--muted` | `#f1f0f8` / `#c4c1d6` / `#9a97ae` | Texte, secondaire, discret |
| `--accent` | `#8a78f5` | **La lavande d'action** |
| `--accent-soft` | `#b3a6ff` | Lavande claire : icône d'onglet actif, liens, anneaux (le jeton le plus utilisé) |
| `--accent-deep` | `#5d4bd9` | Bas du dégradé d'action |
| `--accent-wash` / `-2` | lavande à 12 / 22 % | Lavis |
| `--accent-glow` | `rgba(140,120,255,.45)` | Lueur sous un bouton, halos |
| `--cta` | `linear-gradient(180deg,#8f7dfb,#5d4bd9)` | **Le** bouton principal (un par écran) |
| `--brand` | `#ff5f7e` | Le rouge des **pastilles d'attention** (malgré son nom) |
| `--brand-light` | `#e6e1ff` | Montants en Éclats |
| `--deco-wash` / `--deco-ink` | `rgba(157,140,255,.13)` / `#c8bfff` | Le décor : tuile d'icône au trait, lavis d'en-tête |
| `--progress` | `linear-gradient(90deg,#7a68ec,#b3a6ff)` | Toutes les jauges |
| `--gold` (+ `-light`, `-ink`, `-wash`, `-line`) | `#f5c451` | **Récompenses et Légendaire uniquement** |
| `--ok` (+ `-deep`, `-wash`, `-line`) | `#4fd6a0` | « Réussi » |
| `--danger` (+ `-wash`, `-line`) | `#ff6b6b` | Erreur, défaite, adversaire |
| `--glass` | `rgba(30,29,40,.74)` | Verre |
| `--glass-strong` | `linear-gradient(180deg,rgba(38,37,50,.95),rgba(24,23,32,.97))` | Verre couvrant (feuilles, tiroir) |
| `--glass-line` / `--glass-line-top` | blanc à 10 / 20 % | Bord du verre, plus clair en haut |
| `--glass-hi` | `inset 0 1px 0 rgba(255,255,255,.12)` | Reflet du bord haut |
| `--glass-solid` | `rgba(26,25,34,.97)` | Repli opaque du verre |
| `--sh-1` … `--sh-4` | de `0 1px 2px` à `0 24px 60px` | Ombres (légère → objets flottants) |
| `--tuile` | `inset 0 1px 0 rgba(255,255,255,.05),0 6px 18px rgba(0,0,0,.24)` | **L'ombre de tuile** |
| `--gloss` / `--gloss-soft` | blanc à 34 / 14 % | Reflet des boutons |
| `--hover` | blanc à 5 % | Survol |
| `--radius-xs` … `--radius-xl` | 8, 12, 18 (`--radius`), 22 (`--radius-lg`), 28 px | Rayons concentriques |
| `--gap-2` … `--gap-5` | 10, 14, 20, 28 px | Espacements |
| `--spring` | `cubic-bezier(.2,1.25,.4,1)` | Ressort : ce qu'on touche |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Courbe douce : ce qui entre |
| `--top-h` / `--nav-h` | 58 px / 66 px | Hauteurs de l'en-tête et de la barre du bas |

Les « salles obscures » (`#theater`, `#viewer`, `.promoscene`) redéfinissent `--bg`, `--surface` et `--line` un cran plus sombres. L'arène a ses propres variables `--ar-*` ([§ 5.11](#511-dans-larène)).

### 5.3 Le code couleur

| Couleur | Sens | Exemples |
|---|---|---|
| **Lavande** | Ce que tu peux faire maintenant | `--cta`, `--accent`, ce qui est jouable en combat |
| **Blanc** | Ce que tu as choisi | puce ou segment `.on` (blanc à 12–17 % et filets intérieurs), carte choisie |
| **Rouge** | Attention, adversaire | pastilles `--brand`, `--danger`, `--ar-adv` |
| **Vert** | Réussi | `--ok` |
| **Or** | Récompenses et Légendaire | `--gold` |

Une couleur, un sens, partout le même. Ne pas utiliser l'or pour décorer, ni la lavande pour un choix.

### 5.4 Essences, raretés, Sections

**Les Essences** (`COLORS`, `js/config.js`) arrivent dans le CSS par des variables posées en ligne (`--tc` sur une carte, `--ec`, `--mc`, `--fc`) ; leurs symboles sont dans `assets/essences/`.

| Essence | Couleur | Essence | Couleur |
|---|---|---|---|
| Rose | `#ee0073` | Mauve | `#ec8fff` |
| Orange | `#f77514` | Verte | `#9df244` |
| Jade | `#55e6a6` | Bleue | `#2f7fc9` |
| Violette | `#8936ff` | Azur | `#39b8ff` |
| Jaune | `#ffc73b` | Neutre | `#90b2a5` |

**Les raretés** (jetons `--r-*`) : Essence `#90b2a5`, Commune `#a29dbb`, Peu commune `#7bd6b4`, Rare `#5aa9ff`, Épique `#a98bff`, Légendaire `#f5c451`, Promo `#ff7eb6`. Secrète, Brillante et Unique ont leurs effets propres (reflet irisé, prisme, liseré d'or) dans `css/cards.css`.

**Les Sections** (`SECTIONS`, `js/combat/campagne.js`) : **Toxique** `#62d84e` (clair `#b7f29a`), **Déter** `#7c3aed` (clair `#c4b5fd`). Ces couleurs ne servent **qu'à dire une Section** ; l'onglet Combats les reçoit en `--sc` / `--sc2`.

### 5.5 Typographie

- **Archivo** (`--display`) pour les titres et les chiffres : axe de largeur 62–125 %, graisses 400–900, **italique seulement en 700–900**.
- **Figtree** (`--body`) pour tout le reste : graisses 400, 600, 700, 800 (**pas de 500 ni de 900** : demander 900 donne 800).
- `h1` : Archivo 900 italique, `font-stretch:112%`, 29 px. `h2` : Archivo 800 droit, 17 px. Corps : 15 px, interligne 1,45.
- **Titre mis en scène** : Archivo 900 italique, 17 à 28 px, interligne 1 à 1,1.
- **Kicker** (petites capitales au-dessus d'un titre) : 10,5 px, 800, `letter-spacing:.1em`, majuscules, `--accent-soft`.
- **Chiffres** : Archivo 900 avec `.tnum` (chiffres tabulaires).

### 5.6 Les matières

| Matière | Recette |
|---|---|
| **Tuile** | `background: var(--surface); box-shadow: inset 0 0 0 1px var(--line), var(--tuile); border-radius: var(--radius-lg);` (la classe `.panel` en est une ancienne forme, avec `border`). |
| **Verre** (*liquid glass*) | `background: var(--glass);` + `-webkit-backdrop-filter` **et** `backdrop-filter: blur(22px) saturate(170%);` + `border: 1px solid var(--glass-line); border-top-color: var(--glass-line-top);` + `box-shadow: var(--glass-hi), var(--sh-3 ou --sh-4);` |
| **Verre couvrant** | `--glass-strong` + `blur(32px) saturate(160%)` : feuilles, tiroir. |

**Règles du verre.** Pas de verre sur du verre (les capsules de l'en-tête, `.pill` et `.hdrbtn`, n'ont pas de flou à elles). On n'anime jamais le flou. **Repli obligatoire** : tout nouvel élément de verre s'ajoute aux deux listes de `css/base.css` (`@supports not (backdrop-filter…)` et `@media (prefers-reduced-transparency: reduce)`), qui le passent à `--glass-solid`. Aujourd'hui, ces listes ne couvrent que `#nav`, `.sheet`, `.tiroir-panneau`, `#toast` et `.qn` (plus `.top::before`) : le verre des pieds collants (`.at-pied`, `.recpied`), des capsules illustrées (`.rf-*`, `.cb-badge`, `.cb-porte-ico`) et de l'arène n'a pas encore de repli ([§ 14.3](#143-écarts-à-la-da)).

Où se trouve le verre : `#nav`, le fond de l'en-tête, `.sheet`, le tiroir, `#toast`, les notifications, les pieds collants (`.at-pied`, `.recpied`) ; dans l'arène, les boutons, la carte agrandie, les feuilles et le journal ; sur les bandeaux illustrés, les petites capsules (`.rf-solde`, `.rf-fin`, `.rf-onglets`).

### 5.7 Les composants

- **Boutons** (`css/base.css`) : `.btn` (principal, `--cta`, pleine largeur, Archivo 800 16 px, reflet `--gloss`, lueur `--accent-glow`, `scale(.97)` à l'appui avec `--spring`) ; `.btn.ghost` (verre clair, secondaire) ; `.btn.tiny` (compact) ; `.linkbtn` (lien discret). **Un seul bouton principal par écran.**
- **`.segbar`** : le rail segmenté (sous-navigation). Fond `--bg-2` ; le segment `.on` en blanc à 15 %.
- **`.chips`** : rangée de puces qui glisse de côté ; la puce `.on` est blanche.
- **`.panel`** : la tuile classique d'un écran ; `.pagehead` : le titre d'onglet et sa ligne d'explication.
- **Pastilles** : `.pastille` (rouge, une attente) ; `.ava-niv` (niveau, lavande) ; `.qtag` (étiquette en petites capitales) ; `.new` (nouvelle carte).
- **Bandeau illustré** (`.cb-mode`, `.cb-porte`, `.ch-nv-une`…) : conteneur `position:relative; isolation:isolate; overflow:hidden; border-radius:var(--radius-xl)`, un calque d'art en `z-index:-2` (`background: var(--art) 50% 22%/cover`), un `::after` en `z-index:-1` qui fond l'image vers la tuile (`linear-gradient(180deg, transparent …, rgba(24,23,33,.97) 80%)`), le texte en bas.
- **Lavis d'en-tête** : `linear-gradient(135deg, var(--deco-wash), var(--surface) 62%)` (variantes vert `--ok-wash`, or `--gold-wash`).
- **Tuile d'icône** : 36 à 42 px, `--radius-sm`, fond `--deco-wash`, couleur `--deco-ink`, SVG **au trait** (`fill:none; stroke:currentColor; stroke-width:1.8–2.2; stroke-linecap/linejoin:round`). Les icônes de l'interface sont dans `NAVICO` (`js/config.js`) et sont toutes au trait, sauf l'étoile du logo (`ICON.star`).
- **Jauge** : piste `--bg-2` + `inset 0 0 0 1px var(--line)`, remplissage `--progress`. **Anneau** : `conic-gradient(var(--accent-soft) var(--p), rgba(255,255,255,.14) 0)`.
- **Avatars** : `avatarHTML(avatar, cadre, 'sm|md|lg|xl', photo, xp)` (`js/ui.js`) ; avec `xp`, la pastille de niveau. Les **cadres** (`FRAMES`, `js/config.js`) sont un anneau coloré (`--f1`, `--f2`) ou un **cadre décoré** : un SVG animé dans `assets/cadres/` qui déborde du cercle (`.ava.fx-<nom> .fx-deco`).
- **Recadrer une illustration de carte** dans une case : `illuCadre(id, fx, fy, zoom)` (`js/ui.js`) : `fx`/`fy` est le point de l'illustration gardé au centre.
- **Cartes** : toujours par `renderCard(c, o)` ; `o.m` montre un niveau de maîtrise, `o.calme` coupe les animations (grilles).

### 5.8 Mouvement

- `--spring` pour ce qu'on touche (`:active` en `scale(.93 à .98)`), `--ease` pour ce qui entre ; les feuilles montent en `.34s`.
- **Mouvements réduits** : la préférence système (`prefers-reduced-motion`) **et** le réglage du jeu « Animations réduites » (`html.rm`, clé `mtcg.rm`) coupent toutes les animations (règles globales dans `base.css` et `hub.css`). **En JavaScript, tester les deux** : `RM() || document.documentElement.classList.contains('rm')` — `RM()` seul ne voit que la préférence système. Une animation qui doit laisser un état de repos (un reflet posé, des étincelles cachées) le déclare sous `html.rm …` et sous la media query.

### 5.9 Écrans, bords et couches

- **Conçu d'abord pour un téléphone de 390 × 844** ; vérifié en 375 × 667 et 360 × 740. Point de rupture principal : **900 px** (ordinateur : rail à droite, feuilles centrées, `#main > *` limité à 860 px, 1 180 px pour Boosters et Collection). Autres : 359, 420, 560, 640.
- Chaque élément qui touche un bord tient compte de la **safe-area** (`env(safe-area-inset-*, 0px)`).
- `#main > *` est centré par `margin-inline:auto` : un `margin` raccourci posé en ligne sur un enfant direct le décentre.
- **Pile des `z-index`** : `.bgdeco` −1 · `.top`, `#nav` 6 · `#theater` 30 · surcouche du Guide 35 · `#arene` 40 · `#tiroir` 45 · `.sheet-wrap` 50 · `#viewer` 55 · `.promoscene`, `#fx` 60 · `#qnotif` 70 · `#toast` 80 · bandeau de la pré-prod 99999.

### 5.10 Organisation du CSS

Les fichiers se chargent dans l'ordre du [§ 3](#3-arborescence-du-dépôt) (« les jetons d'abord ») ; l'ordre compte (`choc.css` surcharge `reflets.css`). Chaque écran a son fichier **et son préfixe de classes** ; ses règles d'adaptation (mobile, ordinateur) vivent dans le même fichier.

| Fichier | Préfixes |
|---|---|
| `base.css` | briques génériques : `btn`, `linkbtn`, `chips`, `panel`, `sheet`, `top`, `qn`, `#nav`, `#toast` (les composants partagés `segbar`, `pagehead`, `pastille`, `qtag`, `ava*` sont en tête de `hub.css`) |
| `hub.css` | `q*` (quêtes), `of*` (boutique), `a3d-*` (scène d'achat), `ava*`, `vit*`, `cl*`, `ami*`, `troc-*`, `b*` (boîte), `rec*`, `tiroir-*`, `moi-*`, `garde-*`… |
| `cards.css` | `card`, `cwrap`, `gcell`, `fil*`, `col*`, `rar*`, `tx-*`, `rev*` |
| `booster.css` | `pack*`, `res*`, `rp-*`, `rip-*`, `evb*` |
| `opening.css` | `th-*`, `scard`, `op-rar`, `rc-*`, `charge-*`, `flash-*`, `god*` |
| `viewer.css` | `vw-*` |
| `maitrise.css` | `mz-*`, `fet-*` |
| `lab.css` | `lab*` |
| `auth.css` | `auth*`, `lock*` |
| `promo.css` | `pr-*`, `promo*` |
| `reflets.css` | `rf-*`, `rfban*`, `il-*`, `rr-*`, `titre*`, `inv*`, `fx-*` |
| `combat.css` | `cb-*`, `rd-*` (Raid), `at-*` (atelier), `gd-*` (guides), `dk-*` (decks) |
| `arene.css` | `ar-*`, `mk-*`, `tuto-*` |
| `choc.css` | `ch-*`, `chban` |

**États** : `.on` (choisi), `.ok`, `.pret`, `.pris`, `.fait`, `.ferme`, `.eng`, `.moi` / `.lui`, `.vide`. Le CSS utilise des fonctions récentes (`color-mix()`, `:has()`, `@property`, container queries `cqi`/`cqw`/`cqh`, `dvh`, `scroll-snap`) : un navigateur récent est requis.

### 5.11 Dans l'arène

L'arène (`#arene`, `css/arene.css`) a ses variables locales : `--ar-act` `#9d8cff` et `--ar-act2` `#c8bfff` (l'action), `--ar-adv` `#ff6b6b` (l'adversaire), `--t-joueur`, `--t-objet`, `--t-coach`, `--t-moment` (couleurs des sortes de cartes), `--ar-barres`, `--ar-main`. Elles **n'existent que sous `#arene`** : hors de l'arène, les redéfinir (voir `.ar-fin-apercu`, `css/lab.css`). Les surbrillances se posent sur `::after`, jamais sur la carte ; les mesures sont en `cqi` (la place `.ar-place` est un conteneur à la largeur d'une carte). `#arene button{font:inherit}` l'emporte sur une simple classe : écrire `#arene .x`.

### 5.12 Recettes

- **Un écran d'onglet** : `<div class="pagehead"><div><h1>Titre</h1><p>Une ligne.</p></div></div>`, puis des tuiles, un seul `.btn`, des `.btn ghost` à côté, une `.segbar` pour les sous-pages. Un nouveau préfixe, dans le fichier de l'écran. **Uniquement des jetons** (les rgba blancs et noirs sont tolérés pour les filets et les voiles).
- **Une couleur nouvelle** : un jeton dans `tokens.css`, documenté dans `docs/design-3.0.md`. Ne jamais réécrire `#8f7dfb, #5d4bd9` : `var(--cta)`.
- **Une image en variable CSS** : une URL **absolue** (`new URL(img, location.href)`) ; une URL relative dans `--art` se résout depuis `css/`.
- **Un élément de verre** : la recette du [§ 5.6](#56-les-matières), les deux préfixes, et l'ajout aux deux listes de repli.
- **Une animation** : `@keyframes` préfixée, état de repos sous `html.rm` et la media query, et en JS le double test.
- **Un cadre décoré** : un SVG dans `assets/cadres/` (128 × 128, avatar au rayon 50 ; ou 152 avec la marge des cadres 3.0), la règle `.ava.fx-<id> .fx-deco{background-image:url('../assets/cadres/<id>.svg')}` (avec `inset:-26%` pour une marge de 12), et `FRAMES.f_<id> = {nom, fx:'<id>', c1, c2}`. Les cadres sont dessinés par `tools/cadres.py` (2.0) et `tools/cadres-30.py` (3.0).

---

## 6. Cartes, collection et progression

### 6.1 Les familles de cartes

| Famille | Identifiants | Nombre | Rareté (`RAR`, rang) | D'où elle vient | Échange | Recyclage / fabrication | Maîtrise |
|---|---|---|---|---|---|---|---|
| **Extension** « Tout commence ici » | `c001`…`c122` | 122 | ES 0, C 1, PC 2, R 3, E 4, L 5 | les boosters | même rareté (sauf ES) | oui (ES compris) | oui, sauf ES |
| **Reverses** | `r` + numéro (`r010`…) | 85 | celle de la classique (C, PC, R) | 5ᵉ carte du booster | contre une Reverse | fermés tant que `parametres.fabrication_reverse` est faux ; fabrication au double | partage celle de sa classique |
| **Secrètes** | `c123`…`c127` | 5 | S (5,5) | le hit, 0,75 % | contre une Secrète (serveur) | non | oui, sans exemplaire |
| **Promos** | `p01`…`p06` | 6 | PR (6) | boutique, paliers, Sections | non | non | non |
| **Essences Brillantes** | `b001`…`b009` | 9 | BR (7) | case Essence, 1 fois sur 50 | non | non | non |
| **Carte unique** | `u01` | 1 | UN (8) | la chasse | non | non | non |

- **« 122 » est sacré.** Côté navigateur, le tableau `cards` (`js/storage.js`) ne contient que l'extension : Promos, Reverses et Secrètes vivent dans leurs propres listes (`promos`, `reverses`, `secretes`…). Côté serveur, la table `public.cards` contient **tout**, et c'est `not promo` qui isole les 122 (`check_promos()`, `sync_collection_quests()`, `player_profile`, classement). Les jauges, les paliers Promo et les quêtes de collection en dépendent. Les Secrètes sont **hors de tout total**.
- **Deux conventions pour le drapeau `promo`.** Côté **serveur**, Promos, Brillantes, Unique, Reverses **et Secrètes** ont `cards.promo = true` (c'est ce qui les protège du ménage de `02_cards.sql`) ; les colonnes `reverse` et `secrete` les distinguent. Côté **navigateur**, Reverses et Secrètes ont `promo: false`, et ce sont `rev` et `secrete` qui les mettent à part.
- **Une Reverse et une Brillante n'ont pas d'image à elles** : elles reprennent celle de leur carte (`base`), avec un traitement CSS (`.card.rev`, `.card.r-BR`).
- `toutesCartes()` (`js/utils.js`) concatène extension, Reverses, Promos, Brillantes et Unique, **sans les Secrètes** (voir [§ 14](#14-dette-connue)).

### 6.2 Données et images

**`js/cards-data.js`** est le seul fichier à toucher pour une carte de l'extension : `const CARD_DATA = [...]`, 122 entrées.

```js
  {
    fichier: "012_R_Joueur_Rose_Squeezie-le-Toxique.avif", num: 12, nom: "…",
    categorie: "Joueur", couleur: "Rose", rarete: "R", def: 120,
    attaques: [ { nom: "…", cout: { rose: 1, neutre: 1 }, degats: 100, effet: "…" } ],
    mot_cle: { nom: "Signature", texte: "…" }
  },
```

- Obligatoires : `fichier`, `num`, `nom`, `categorie` (Joueur, Coach, Moment, Objet, Essence), `couleur` (Rose, Orange, Jade, Violette, Jaune, Mauve, Verte, Bleue, Azur, Neutre), `rarete` (ES, C, PC, R, E, L).
- Facultatifs : `sous_type` (`Instant`, `Lien`), `def` (alias `pv`), `attaques` (`{nom, cout, degats, effet?, plus?}`), `mot_cle`, `effets: [{texte}]`, `resilience`, `ambiance` (texte d'intention, lu par aucun code), et `booster: false` (ne sort jamais en paquet).
- **Le format est un contrat** : guillemets doubles et blocs qui commencent par `"\n  {"` (deux espaces). `tools/gen-cards-sql.py` découpe le fichier ainsi ; `tools/illu-pixels.js` l'exécute après avoir remplacé `const CARD_DATA` par `globalThis.CARD_DATA` ; `tools/combat-sim.js` (et `combat-tests.js`) le charge tel quel dans un contexte `vm`. Une carte mal formée est **ignorée en silence** par le générateur SQL.
- **Le numéro est l'identifiant** (`cardId` → `c` + 3 chiffres). Changer le `num` d'une carte possédée la fait repartir à zéro.

**`js/cards.js`** normalise tout en objets carte : `{id, num, nom, cat, col, rar, sous, img, inBoost, atks, talents, kw, fx, def, res}`, plus `code`, `promo`, `foil`, `rev`, `base`, `unique`, `secrete`, `cachee`, `provisoire` selon la famille. Une attaque sans coût (absent, `{}` ou que des zéros) devient un **talent** (`c.talents`), qui ne se paie pas ; dans un coût, une Essence inconnue compte comme `neutre` ; un Joueur sans attaque reçoit une attaque par défaut (`DEFD`, `DEFV` dans `config.js`). Ce fichier est aussi chargé **par Node** (`combat-sim.js`) : il ne touche jamais au DOM.

**`js/promos-data.js`** : `PROMO_DATA` (6), `UNIQUE_DATA` (1), `SECRET_DATA` (5).

| Promo | Nom | Obtention |
|---|---|---|
| P01 | Major de Paris | Boutique, 5 000 Éclats |
| P02 | Major de Paris (illustration alternative) | Boutique, 5 000 Éclats |
| P03 | Section Toxique (provisoire, sans image : dessinée en texte par `carteTextuelle`) | Rejoindre la Section Toxique, puis finir la campagne de l'autre |
| P04 | Section Déter (provisoire, idem) | Rejoindre la Section Déter, idem |
| P05 | Tout Commence Ici | 100 % de l'extension (Master Set) |
| P06 | Le Marionnettiste | 75 % de l'extension (`cfg('promo_palier_pct')` = `PROMO_PALIER`) |

Les paliers ne donnent **que** la carte. `check_promos()` (`supabase/installation/03b_promos.sql`) les accorde, de façon idempotente, depuis `me()` et `open_pack()`. Le champ `obtention` ne sert qu'à l'affichage ; `PROMOS_A_VENIR` (`config.js`) peut réserver des cases « à venir » (vide aujourd'hui).

**Secrètes** : #123 *Le Quatrième du Nom* et #125 *6W26L* sont révélées ; #124, #126, #127 sont `cachee` (nom « Secrète n°NNN », image floutée `NNN_S_Secrete.avif`, pas de texte, injouables). Leur code s'affiche `#123/122`.

**Images** (`cards/`, voir [§ 12.4](#124-les-images-des-cartes)) : `NNN_RAR_Catégorie[-SousType]_Couleur_Nom.avif` en 1000 × 1397 ; Promos dans `cards/promos/` (WebP 640 × 880) ; l'Unique dans `cards/uniques/`. Seul le champ `fichier` fait le lien : le nom n'est qu'indicatif. **Une image refaite change de nom** (suffixe `_v2`), sinon le service worker resert l'ancienne ([§ 13](#13-pièges)).

### 6.3 Les boosters

**La réserve** : un booster toutes les 4 h, 5 au plus (`cfg('ticket_minutes')` = 240, `cfg('ticket_cap')` = 5), recalculée par le serveur à chaque `me()` (`regen_tickets`). Un événement peut accélérer le rythme (`evenements.ticket_minutes`, 120 = boosters doublés). Côté client, `TICKET_CAP` et `INTERVAL` (`config.js`) sont des `let` **écrasés** par `Backend.apply`. Les boosters achetés, offerts ou gagnés vont **hors réserve** (`profiles.boosters_bonus`, `save.bonus`), ouverts par `open_pack(true)` : mélangés à la réserve, ils la faisaient déborder et remettaient son compte à rebours à zéro. Parmi eux, ceux d'un cadeau (`tickets_offerts`) partent en premier et ne peuvent pas contenir la carte unique.

**Composition** (`open_pack()` dans `supabase/installation/03_rpc.sql` fait foi ; `makeBooster()` dans `js/booster.js` sert au Labo ; `tirerPaquet()` dans `_demo/serveur.js` à la pré-prod) :

| Case | Contenu |
|---|---|
| 1 et 2 | Commune |
| 3 | Peu commune |
| 4 | Essence — **Brillante** une fois sur 50 (`cfg('foil_odds')`, `FOIL_ODDS`) |
| 5 | **Reverse** : C 50 %, PC 35 %, R 15 % |
| 6 | Le hit : R 79 %, E 16 %, L 4,25 %, **S 0,75 %** |

- **Godpack** : une fois sur 2 000 (`cfg('god_odds')`, `GOD`), six cartes tirées dans les tables `[R90/E10, R70/E30, R50/E50, E90/L10, E60/L40, L100]` (Légendaire garantie à la fin), sans Essence ni Reverse. Il n'est **annoncé par rien** : c'est la lumière qui le raconte (paquet qui s'assombrit et tremble, faisceau à la déchirure, nappe dorée ; `packOpen()` lui donne 860 ms de plus).
- **Chasse** : tant que `chasse.active` et que personne ne l'a, l'Unique a une chance sur 250 (`cfg('chasse_odds')`) de **remplacer le hit**. La mise à jour `where gagnant is null` garantit un seul gagnant. Le gagnant reçoit le cadre `f_unique` et une annonce part chez tout le monde.
- **Repli** : si la rareté visée est vide, `pick_card` / `pickFrom` se rabattent sur la plus proche (S sans Secrète → L). Les deux ordres de repli diffèrent légèrement ([§ 14](#14-dette-connue)).
- Le visuel du paquet porte la mention imprimée « Booster de 6 cartes » : changer la taille oblige à refaire les images.

**L'ouverture** (`js/opening.js`, `css/booster.css` bloc « Déchirure », `css/opening.css`) se joue dans **un seul écran sans remplacer le DOM** : `showStack()` monte la pile et le paquet, `packOpen()` déroule la déchirure (délais : coupe +360 ms, ouvre +640, sortie de la pile +920, fin +2 050). **Pas de spoiler** : la dernière carte, si elle est rare ou mieux, ne reçoit sa classe de rareté qu'au `doReveal()` (charge R 450 ms, E 800, L 1 150, S 1 500, UN 1 900 — `REVEAL`). Passer : balayage, toucher bref, ou → / Espace / Entrée. Le récap montre la meilleure carte, les nouvelles, le partage. `JEU.recapDirect` (Réglages) saute la révélation.

### 6.4 La Collection et la fiche de carte

**La Collection** (`js/collection.js`) a trois vues (`colVue`) sous une jauge commune de 223 (122 + 85 + 16) :

- **Classiques** : les 122, puis les Secrètes à la fin (seulement sans filtre) ;
- **Reverses** : les 85 ;
- **Spéciales** : Promos (6), Brillantes (9) et la vitrine de l'Unique (quatre états : la mienne, trouvée par un autre, chasse ouverte, bientôt).

Filtres (`vFiltres`) : Essence, rareté, et trois cases « Afficher » (possédées, à compléter, favoris). Une case possédée ouvre la fiche (`data-show`) ; une case manquante, **en ligne**, lance la fabrication (`data-craft`). Sous la carte : `×n`, le cœur, l'éclat « Reverse possédée », l'insigne de maîtrise, et les points « à garder » (cadenas pour « Tous », « 3/8 » au-delà de cinq).

**La fiche** (`js/viewer.js`, `#viewer`, `css/viewer.css`) : la carte en 3D (inclinaison au doigt ou au gyroscope), puis **trois pages glissées** (`VW_ONGLETS`, scroll-snap) : **Infos** (Défense, attaques avec leur coût dessiné par `Table.coutHTML`, mot-clé, talents, Résilience, ou le texte d'un Objet / Moment / Coach), **Maîtrise** (`vMaitriseFiche`), **Gérer** (favori, à garder, carte fétiche). La page choisie est retenue d'une carte à l'autre (`vwOngletRetenu`). Ouverte depuis un échange (`data-qui`), elle dit aussi « X en a N ». Ses clics passent par `data-v` (pas par `clicPage`). Sur ordinateur (≥ 900 px), carte et pages sont côte à côte.

### 6.5 À garder et favoris (2.1)

- **À garder** (`supabase/installation/22_garder.sql`) : par rareté dans Réglages (1 à 4 ; clés `ES`…`L`, et `rC`, `rPC`, `rR` pour les Reverses ; `profiles.garder`), et par carte dans la page Gérer (1 à 10, ou 99 = « Tous » ; table `gardes`). Le réglage d'une carte l'emporte ; revenu à la valeur de sa rareté, il s'efface. Envoi différé de 600 ms (`Backend.reglerGarde`).
- **Ce que ça protège** : les exemplaires gardés échappent au recyclage, à la maîtrise, et aux « doublons » que voient les amis. Un échange qui cède une carte gardée demande une confirmation, sans être interdit.
- **Favori** : un cœur pour soi (table `favoris`), filtre « Favoris » de la Collection ; possible sur une carte qu'on n'a plus.
- Trois quêtes saisonnières vont avec : 10 exemplaires d'une même Rare, 5 d'une Épique, 3 d'une Légendaire (métriques `ex_R`, `ex_E`, `ex_L`, classiques seulement).

### 6.6 Recyclage et fabrication

Les doublons deviennent des **Fragments** (`recycler`, `supabase/installation/12_recyclage.sql`) ; les Fragments **fabriquent une carte qui manque** (`fabriquer`, depuis une case vide de la Collection).

| Rareté | Recycler rapporte | Fabriquer coûte |
|---|---|---|
| Essence | 1 | 20 |
| Commune | 2 | 40 |
| Peu commune | 5 | 100 |
| Rare | 20 | 400 |
| Épique | 80 | 2 000 |
| Légendaire | 250 | 8 000 |

- Montants : `cfg('recyclage_*')` / `cfg('fabrication_*')` (`01_schema.sql`), envoyés au client par `me().recyclage` ; `REC_DEFAUT` / `FAB_DEFAUT` (`js/recyclage.js`) ne sont que des secours.
- On garde **toujours** un exemplaire, et autant qu'on a choisi d'en garder ; les exemplaires promis dans un échange en attente sont réservés (`recDispo = mesEx − aGarder − réservés`). 150 lots au plus par envoi ; le serveur refuse tout l'envoi si un seul point ne tient pas ; journal `recyclages`.
- Garde-fous de l'interface : « Tout prendre » laisse E et L de côté ; une case à cocher si une E ou une L est sélectionnée ; une dernière confirmation dont le bouton ne répond qu'après 3 s.
- **Pourquoi des Fragments et pas des Éclats** (1.5) : recycler en Éclats créait une boucle (les Éclats rachètent des boosters). Les Fragments n'achètent qu'une carte manquante : pas de boucle, donc pas de plafond. Le calcul est en tête de `12_recyclage.sql`.

### 6.7 La maîtrise et la carte fétiche (3.0.7, refaite en 3.0.8)

- **Cinq niveaux** par carte : I Éclat, II Liseré, III Aura, IV Arène, V Légende. Seules les cartes de l'extension (hors Essence) et les Secrètes se maîtrisent ; **une Reverse partage la maîtrise de sa classique** (`carteMaitrise`, `maitrise_carte`).
- **Coût (3.0.8)** : la **base de la rareté × 1, 2, 4, 7, 11** Fragments (25 fois la base pour la Légende), plus des exemplaires **en trop** :

| Rareté | Base | Fragments niveaux I → V | Total | Exemplaires en trop (I → V) |
|---|---|---|---|---|
| C | 60 | 60 · 120 · 240 · 420 · 660 | 1 500 | 1 · 1 · 1 · 2 · 2 |
| PC | 100 | 100 · 200 · 400 · 700 · 1 100 | 2 500 | 1 · 1 · 1 · 1 · 2 |
| R | 200 | 200 · 400 · 800 · 1 400 · 2 200 | 5 000 | 0 · 1 · 1 · 1 · 1 |
| E | 400 | 400 · 800 · 1 600 · 2 800 · 4 400 | 10 000 | 0 · 0 · 1 · 0 · 1 |
| L, S | 600 | 600 · 1 200 · 2 400 · 4 200 · 6 600 | 15 000 | L : 0 · 0 · 0 · 0 · 1 ; S : aucun |

- **« En trop »** = au-delà de `max(limite de deck (1 pour L, S, UN, PR ; 2 sinon), à garder)`, moins les exemplaires engagés dans un échange. Chaque exemplaire qui manque se paie au **prix de fabrication** : la maîtrise n'est jamais bloquée par la chance. Seuls les exemplaires de la classique sont pris. Pour un joueur régulier (≈ 2 000 Fragments de recyclage par semaine), une Commune en Légende prend moins d'une semaine, une Légendaire de 7 à 11 semaines (`docs/economie-3.0.md`, 3 ter ; simulation : `python3 tools/equilibre-fragments.py`).
- **Les effets (3.0.8)** : la carte reste **intacte** (aucun voile sur l'illustration ni le texte), c'est sa finition qui change. Dans la carte (`mzDedans`) : `.mz-l` un reflet qui passe (I), `.mz-e` un liseré de métal à la couleur de l'Essence (II), `.mz-b` une lumière qui court sur ce liseré (IV), `.mz-h` un reflet irisé en `soft-light` (V) ; autour (`mzAutourDe`) : `.mz-a` un halo qui respire (III), `.mz-c` **le joyau** (V, `JOYAU` : une pierre taillée à la couleur de l'Essence, sertie d'or, à cheval sur le bord haut — il remplace la couronne). Au niveau V, le liseré devient irisé (`--mz-irid`). `--mc` porte la couleur de l'Essence ; tout est en `cqi` (la largeur de la carte). L'or n'apparaît qu'à la Légende. `.mz-calme` (grilles) et le mouvement réduit immobilisent tout.
- **Rendu** : `renderCard(c, {m, calme})` appelle `maitriseEnveloppe` ; rien n'est déduit tout seul, l'appelant passe le niveau. Dans une grille, `calme: true`. En combat (`table.js`, mêmes `mzDedans` / `mzAutourDe`) : seulement ses propres cartes ; flash d'entrée au niveau IV, onde de choc au niveau V, impact coloré dès le IV.
- **La fiche (3.0.8)** : la page Maîtrise tient sans défiler — la frise des cinq niveaux (atteints à la couleur de l'Essence, le suivant cerclé de lavande ; touché, un niveau s'affiche sur la carte, touché encore il revient : `voirNiveauVw`, `VW.apercu`), le détail du niveau regardé, un bouton « Passer au niveau … » avec le total, et la ligne du coût. La page Gérer n'a plus que « À garder » et « Carte fétiche » (le favori est le cœur en haut). L'insigne (`insigneMaitrise`, « III ») est une pastille graphite ; or pour la Légende.
- **Serveur** : tables `maitrises` et `maitrises_journal`, RPC `maitriser(p_carte)`, `maitrise_fragments(rar, n)` et `maitrise_copies(rar, n)` ; état dans `me().maitrise = {niveaux, fetiche}` → `save.maitrises`, `save.fetiche`.
- **La carte fétiche** : une carte possédée, mise en avant en haut du profil et sur la fiche publique (`vFetiche`, `js/maitrise.js` ; `fetiche_de` revérifie la possession). Depuis la 3.0.8, c'est une tuile pleine : le fond est l'illustration floutée de la carte (`.fet-fond`) ; la carte et sa maîtrise à gauche ; à droite, le nom, la rareté à sa couleur (`--r-*`), l'Essence, le numéro, la maîtrise et « Changer ». Sans fétiche, une carte fantôme et « Choisir une carte ». Elle se choisit dans Gérer (`set_fetiche(id|null)`, colonne `profiles.fetiche`). Elle est distincte de la vitrine (4 cartes).
- **Trois copies des chiffres** : `MAITRISE.base` / `.mult` / `.copies` (`js/maitrise.js`, `fragmentsMaitrise`), `maitrise_fragments` / `maitrise_copies` (`28_maitrise.sql`), `MZ_BASE` / `MZ_MULT` / `MZ_COPIES` (`_demo/serveur.js`). Justification : `docs/economie-3.0.md`, partie 3 ter.

### 6.8 Échanges et Social

- **On échange avec n'importe quel joueur** : un ami, ou un pseudo exact (`find_player`) ; `trade_create` ne vérifie pas l'amitié. Seules la collection de l'autre (`player_profile`) et la vue « Chez tes amis » sont réservées aux amis. L'onglet Social (`js/social.js`) a deux volets, Amis et Échanges (`js/trade.js`).
- **Amis** (`supabase/installation/06_social.sql`) : table `friendships` rangée `a < b` ; une demande croisée vaut acceptation ; 25 demandes en attente au plus. La **fiche d'un joueur** (`player_profile`) montre à tous bannière, avatar, titre, devise, niveau, l'Élu, la fétiche, la vitrine, les statistiques et les succès ; **entre amis seulement**, sa collection et ses 12 meilleurs doublons (R ou mieux).
- **Règles d'un échange** (`trade_create`, `trade_respond`, `03_rpc.sql`) : une carte contre une carte **de même rareté** ; ni Essence, ni Promo, ni Brillante, ni Unique ; Reverse contre Reverse, Secrète contre Secrète ; posséder ce qu'on offre ; 10 demandes en attente au plus ; une note de 140 caractères. **Coût** : une demande gratuite toutes les 6 h (`cfg('trade_cooldown_h')`), sinon un jeton (`trade_token`, boutique), sinon `ECHANGE_EN_RECHARGE`. À l'acceptation, le serveur revérifie tout et échange dans une seule transaction.
- **Écran** : à gauche ce qu'on **reçoit**, à droite ce qu'on **donne**, partout. L'étiquette dit combien *j'en ai* (« Nouvelle », « ×n », « Dernière », « Gardée »). « Chez tes amis » liste ce qui te manque et qu'un ami a en double (`amis_doublons`).
- **La photo Discord des autres** : on stocke le mot `discord`, et le serveur joint l'adresse de la photo (`photo_discord()`) aux profils qu'il renvoie. `avatarHTML(a, cadre, taille, photo)` **ne se rabat jamais sur la session** : sans adresse, on dessine l'étoile (avant, tout le monde portait le visage du spectateur).

### 6.9 Profil, succès, titres

- **Avatar** (`set_profile`) : `'discord'`, `'card:<id>'`, une clé d'`AVATARS`, ou `'ess:<couleur>'`. **Cadre** : un `f_*` possédé (`FRAMES`, `config.js` : `fx` = SVG animé, `vente: false`, `unique`). Les cadres « Arène » (`f_niv10/20/30/50`) se gagnent aux niveaux de combattant.
- **Titre, bannière, devise** (`personnaliser`, `null` = inchangé, `''` = retirer) : le titre se gagne par les succès, les quêtes jalons, le Pass ou la boutique (`TITRES`, 27 ; `titres_de()` côté serveur) ; la bannière est une carte possédée ; la devise, 80 signes.
- **Vitrine** : 4 cartes (`set_vitrine`). **L'Élu** : l'écrin du gagnant de la chasse. **Fétiche** : [§ 6.7](#67-la-maîtrise-et-la-carte-fétiche-307-refaite-en-308).
- **Succès** : calculés à la volée par `succes_de()` (`15_evenements.sql`) ; noms dans `SUCCES` (18, `config.js`). Les identifiants doivent rester les mêmes des deux côtés.

### 6.10 Quêtes

- **Portées** : `daily`, `weekly`, `milestone` (« Saisonnières »), et pour un événement `ev_jour` / `ev`. La clé de période est calculée **à l'heure de Paris** (`period_key`) ; l'interface affiche le temps restant avec le même calendrier (`resteAvantRemise`).
- **La progression n'est jamais envoyée par le navigateur** : le serveur l'avance quand l'événement arrive vraiment (`bump_quests`, appelé par `open_pack`, `trade_respond`, `recycler`, `combat_fin`…). Seule nuance : pour un combat, le serveur croit le navigateur sur le **résultat** (`combat_fin`, `tutoriel_fini`), dans les limites du [§ 7.11](#711-ce-que-le-serveur-vérifie). Les quêtes « d'état » ne reculent pas : pourcentage de collection, raretés complètes `set_*` / `rset_*`, Brillantes et exemplaires `ex_*` sont recalculés par `sync_collection_quests` (`01_schema.sql`) ; le niveau de combattant (métrique `niveau`) l'est par `gagner_xp` (`26_niveaux.sql`).
- **97 quêtes** dans `supabase/installation/04_seed.sql` (`d_*`, `w_*`, `m_*`, Reflets `e_*`, Choc `c_*`), avec leurs récompenses (Éclats, `item_id`, ou `monnaie = 'prismes'`). Calculs d'équilibrage en tête du fichier.
- **Signalement** : une carte passe 4 s en haut de l'écran (`notifQuete`), puis la pastille de l'onglet reste tant qu'il y a quelque chose à encaisser. C'est `Backend.apply` qui compare l'état avant / après.
- L'onglet Quêtes a trois sous-onglets (Quotidiennes, Hebdomadaires, Saisonnières) ; les quêtes de combat vivent aussi dans Combats › Missions (`METRIQUES_COMBAT`).

### 6.11 La boutique

Trois rayons (`RAYONS`, `js/shop.js`) : **Cartes**, **Cosmétiques**, **Combats** ; les articles d'événement vivent dans l'onglet de l'événement. 32 articles dans `04_seed.sql` (catégories `boosters`, `echange`, `invitation`, `promo`, `cosmetique`, `tapis`, `sleeve`, `evenement`).

| Article | Prix |
|---|---|
| 1 / 5 / 10 boosters | 350 / 1 600 / 3 000 Éclats |
| 1 / 5 jetons d'échange | 600 / 2 500 |
| Promo P01, P02 | 5 000 chacune |
| Cadres Azur, Rose / Or / Prisme / Toxique, Déter | 1 200 / 2 500 / 5 000 / 3 000 |
| Invitation (3 par joueur) | 2 000 |
| 6 tapis de jeu | 4 000 (La Luxueuse III : 5 000) ; 25 000 en tout |
| 2 sleeves | 3 000 (6W26L) et 2 500 (Argent) |

- **Un achat demande toujours deux gestes** (ouvrir la fiche, confirmer), avec le solde restant affiché. Sur la fiche, on manipule l'objet (paquet qui tourne, lot en éventail, Promo recto-verso). Les remises (« −14 % ») sont **calculées** contre l'article unitaire de même effet et même devise (`remiseDe`).
- Après l'achat : des boosters s'ouvrent aussitôt (`openBooster({bonus:true})`) ; une Promo passe par sa scène ; un tapis ou une sleeve propose de l'équiper ; une invitation montre son code.
- **Invitations** : un code `M8-XXXX-XXXX` à usage unique, aussi transmissible par le lien `/?invitation=CODE`. L'invité entre avec 10 boosters et 1 000 Éclats. **Un invité n'invite pas à son tour** (2.1.1, `est_filleul()`).

### 6.12 Boîte de réception, cadeaux, classement, tirages, partage

- **Boîte** (`js/boite.js`, `supabase/installation/11_boite.sql`) : demandes d'ami et d'échange, réponses, défis, annonces. Le **serveur écrit** l'événement au moment où il a lieu (`notifier()`). Arrivée par le temps réel Supabase, avec une relève toutes les 30 s en secours. Lu / non lu = une date par joueur (`boite_vue_le`). Ping : pastille sur la cloche, « (n) » dans le titre, badge d'app, carte en haut de l'écran — **jamais** pendant une ouverture, une scène de Promo ou un combat (`ecranOccupe()`). Annonces publiées depuis le Labo ; 30 jours d'historique.
- **Cadeaux** (`js/cadeaux.js`, `18_cadeaux.sql`) : un administrateur offre Éclats, boosters, Fragments, une carte (pas l'Unique) et un mot ; le joueur ouvre un paquet-cadeau, et c'est `ouvrir_cadeau` qui crédite, une seule fois.
- **Classement** (`js/classement.js`, `14_classement.sql`) : quatre critères affichés (`CRITERES` : niveau, collection, Secrètes, Versus) ; le serveur en sait huit (aussi Reverses, boosters, échanges, série). Top 50 et ma ligne ; seuls les comptes invités ; cache de 60 s.
- **Mes tirages** (`js/tirages.js`, table `tirages`) : les 30 derniers boosters, depuis la 1.5.
- **Partage** (`js/partage.js`) : une image 1080 × 1350 dessinée en canvas ; Web Share si possible, sinon téléchargement. Refusé en `file://`.

### 6.13 Monnaies et équilibrage

| Monnaie | Où elle vit | Gagnée par | Dépensée pour |
|---|---|---|---|
| **Éclats** | `profiles.shards`, `save.shards` | quêtes, combats, niveaux, Raid hors Choc, Devine l'illu, cadeaux | boosters, cosmétiques, Promos, jetons, invitations |
| **Fragments** | `profiles.fragments` | recyclage, Pass, coffres du Raid, campagne | fabrication, maîtrise |
| **Prismes / Étincelles** | `evt_comptes` (`monnaie = 'prismes'` en base) | quêtes d'événement, Épreuve, Raid pendant le Choc, Devine l'illu pendant Reflets | boutique de l'événement (le Pass avance sur le **total** gagné) |
| Jetons d'échange | `inventory.trade_token` | boutique | une demande sans attendre |

**Aucun argent réel, nulle part.** Repères (simulation, `docs/economie-3.0.md` et en-tête de `04_seed.sql`) : un joueur régulier ouvre ~6 boosters par jour ; avant la 3.0, les quêtes rapportaient au plus ~606 Éclats par jour (~415 en jeu « typique ») ; tout dépenser en boosters ajoute ~1 booster par jour (les Éclats aident, ils ne remplacent pas le temps). La campagne rapporte une fois 3 400 Éclats, 14 boosters et 2 800 Fragments. Le goulot de la collection, ce sont les dix Légendaires (simulation 2.x, six boosters par jour, en tête de `04_seed.sql`) : 25 % en 7 boosters, 50 % en 17, **75 % (P06) en 45, soit une semaine**, 90 % en 125, **100 % (P05) en ~690, soit près de quatre mois** (un peu moins depuis que la Légendaire est passée à 4,25 %). **Il n'existe aucune donnée réelle sur les combats** : à mesurer à l'ouverture (`quest_progress`, `combat_joueurs`, `evt_comptes`, `maitrises_journal` ; la table `combat_parties` que cite `docs/economie-3.0.md` n'existe pas).

### 6.14 Recettes

- **Ajouter une carte d'extension** : poser l'image, ajouter l'entrée à `CARD_DATA`, puis `python3 tools/gen-cards-sql.py`, `node tools/illu-pixels.js`, `python3 tools/build-sql.py`. Si la carte a un texte (hors mots-clés lus par le moteur), écrire son script `S.cNNN` dans `js/combat/effets.js` et son test ([§ 7.12](#712-recettes)). Vérifier `starters` / `cle_copie` (`23_combats.sql`), la boutique (`04_seed.sql`) et les textes en dur (« 122 », « 85 », `CADRE_SOURCE`). ⚠ **Les numéros 123 à 127 sont pris par les Secrètes** : un `num: 123` écraserait `c123` des deux côtés.
- **Révéler une Secrète** : compléter son entrée de `SECRET_DATA` et retirer `cachee` ; poser l'image (`tools/cosmetiques.py` ou à la main ; le nom de fichier change, le cache suit) ; corriger dans `24_secretes.sql` son nom **et sa catégorie et sa couleur** (provisoirement `joueur` / `neutre`, lues par `deck_erreur`) ; écrire son script dans `js/combat/effets.js` si elle a un texte.
- **Ajouter une Promo** : `PROMO_DATA` et l'image dans `cards/promos/` ; la ligne `pNN` dans `03b_promos.sql` ; si elle se vend, l'article dans `04_seed.sql` (effet `carte`, `carte_id`) **et son identifiant dans la liste du `delete … not in (…)`**, puis dans `BOUTIQUE` (`_demo/serveur.js`) ; si elle est jouable, son script dans `js/combat/effets.js`.
- **Changer les taux** : `open_pack` (SQL), `RATES` / `GOD` (`booster.js`) **et** `tirerPaquet` (`_demo/serveur.js`), ensemble.
- **Changer recyclage / fabrication** : `cfg()` (`01_schema.sql`), `REC_DEFAUT` / `FAB_DEFAUT`, `CFG` du faux serveur.
- **Ouvrir recyclage et fabrication des Reverses** : `update public.parametres set fabrication_reverse = true where id = 1;`.
- **Ajouter une page à la fiche** : une entrée dans `VW_ONGLETS` et son cas dans `vPageVw`, **avant** le `return vGererVw(c)` final (une clé inconnue affiche la page Gérer) ; ses boutons en `data-v`, traités dans la délégation de `#viewer`. `rafraichirFicheVw` la redessine déjà, comme toutes les pages sauf Infos.
- **Remettre un critère au Classement** : un objet `{id, titre, dit, val}` dans `CRITERES` (le serveur sait déjà le calculer).
- **Tester une ouverture** : Labo, `openBooster({test:true, force, god, brillante, unique, reverseR})` (tirage local, rien n'est écrit).

---

## 7. Les Combats

> **Les règles sont reconstituées.** Les règles officielles du jeu de cartes n'étaient pas publiées : celles de M8 TCG Online sont déduites des cartes, et tout ce qui est inventé est signalé. **La source qui fait foi est [`docs/regles-3.0.md`](docs/regles-3.0.md)** (chaque règle porte un statut [Carte] / [Déduit] / [Maison] / [Direction] ; § 10 les lectures de textes ambigus ; § 12 les 17 points inconnus ; § 13 les valeurs), avec `REGLE` dans `js/combat/moteur.js`.

### 7.1 Les règles en bref

- **Deux CEO**, chacun avec **5 PV** : 5 cartes du Club posées face cachée. Touché, un CEO prend son premier PV **en main** ; touché sans PV, il a perdu. Club vide au moment de piocher : le CEO est touché.
- **Zones** : Club (deck de 30), Réserve (10 Essences au choix, jamais possédées), main (5 au départ, mulligan possible), PV, Essences en jeu, **3 lignes** par camp, Banc, défausse.
- **Sortes de cartes** : **Joueur** (Défense, une ou deux attaques, éventuellement un mot-clé ou un talent) ; **Coach** (Instant, un par tour) ; **Moment** (Instant, sans limite) ; **Objet** (se lie à un Joueur, 3 au plus) ; **Essence** (Réserve uniquement). **Rien ne coûte à jouer, sauf les attaques.**
- **Le tour** : désengagement → le Banc revient en main → pioche (pas au premier tour du premier CEO) → une Essence de la Réserve (2 au premier tour du second) → **phase de jeu** (1 déploiement, des liens d'Objets, des Instants) → **phase de combat**, ouverte par la première attaque → fin du tour. Le premier CEO n'attaque pas à son premier tour.
- **Attaquer** : payer (une couleur demande sa couleur, le Neutre n'importe laquelle), **s'engager**, viser le CEO ou un Joueur adverse **engagé**. **Défendre** : le Joueur désengagé de la même ligne, ou un Joueur avec Garde ; il s'engage et devient la cible. **Attaque ≥ Défense** : vaincu (défausse, avec ses Objets) ; sinon repoussée, sans trace. Contre le CEO, toute touche vaut un PV.
- **Résilience** : une carte récupérée depuis les PV peut être jouée aussitôt, gratuitement, même pendant le tour adverse.
- **Mots-clés** : Provocation (l'attaquant d'en face doit le viser), Garde (défend n'importe quelle ligne), Shield (ignore la première attaque subie), Riposte (vaincu, il contre-attaque), Légion (vaincu, il revient en main contre une carte défaussée), Buff (renforce les autres Joueurs), Signature (★ entrée, ⚡ déclencheur, sinon permanent). **Bench** : au Banc, retour en main au prochain tour (ce n'est pas « vaincu »).

| `REGLE` | `LIGNES` | `PV` | `MAIN` | `CLUB` | `RESERVE` | `OBJETS` | `COPIES` | `COPIES_RARES` | `DEPLOIEMENTS` | `COACHS` | `ESSENCES` | `ESSENCES_P2` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| valeur | 3 | 5 | 5 | 30 | 10 | 3 | 2 | 1 | 1 | 1 | 1 | 2 |

### 7.2 Le moteur (`js/combat/moteur.js`)

- **Aucun affichage**, et il tourne aussi sous Node (IIFE sur `globalThis`, `module.exports`). Il expose `Combat` : `creer`, `agir`, `demande`, `optionsTour`, `cloner`, `rejouer`, `catalogue`, `scripts`, les calculs (`defense`, `valeurAttaque`, `infoAttaque`, `defenseurs`…) et **`Combat.O`**, la boîte à outils des effets (`piocher`, `engager`, `bancer`, `vaincre`, `toucher`, `payer`, `choisirUn`, `choisirCartes`, `ouiNon`, `ordonner`, `mod`, `alea`, `melanger`…).
- **Un générateur** : `partie()` → `miseEnPlace()` → `tour()` en boucle. Il s'arrête (`yield`) à chaque décision : `{type:'tour'}`, `{type:'choix', but, options…}`, `{type:'cartes', parmi, min, max}`, `{type:'ordre'}`. Un effet de carte est une coroutine qui fait `yield*` sur ses décisions.
- **Actions** : `deployer {u, ligne}`, `lier {u, cible}`, `jouer {u}`, `attaquer {u, k, cible, chevaliere?}`, `finTour`, et en réponse `choix {v}`, `cartes {u:[…]}`, `ordre {u:[…]}` ; `abandon` à tout moment. `agir(E, a)` valide l'action (`valider`, comparaison par `cle()` = JSON à clés triées), l'ajoute au journal, avance, et **renvoie les événements produits**.
- **L'état `E` est du JSON pur** : `{v, rng, seq, tour, actif, premier, phase, fin, temp, cpt, j:[P0, P1]}` ; chaque objet porte un numéro unique `u`. Les propriétés techniques (`ev`, `journal`, `snap`, `dem`, `gen`, `capture`, `init`) sont **non énumérables** : ni copiées, ni photographiées.
- **Déterminisme absolu** : hasard par `O.alea` (mulberry32 dont l'état tient dans `E.rng`) et `O.melanger`. Même graine + mêmes actions = même partie : c'est ce qui permet la reprise après rechargement, les défis (chaque navigateur rejoue les actions de l'autre) et l'IA (`cloner` repart de la photo du début de tour et rejoue les actions du tour).
- **Options de `creer`** : `decks`, `noms`, `graine`, `premier`, `pv:[n,n]` et `essDepart:[n,n]` (avantages de campagne / Raid), `poses` (le boss du Raid est posé d'avance), `ordre: true` (pas de mélange : le tutoriel).
- **Effets temporaires** : `E.temp` avec une durée `jusqua` (« jusqu'à la fin du tour adverse » = `E.tour + 1` ; `E.tour` compte les tours des deux CEO). Types `atk`, `def`, `kw`, `pasAttaque`, `pasDefenseFace` (visibles, événement `mod`) et `cout`, `lyon`, `piochePlus`, `ripostePlus`, `guet` (silencieux : un piège annoncé n'en est plus un).
- **Déclencheurs** (`declencher`) : `deploie`, `lier`, `attaque`, `defense`, `finAttaque`, `engage`, `desengage`, `desengageEss`, `recupPV`, `vainc`, `finCombat` ; les Joueurs du CEO actif d'abord, chaque Joueur puis ses Objets, puis les guetteurs.
- **`E.capture`** (3.0.7) : chaque événement reçoit `e.etat`, l'état sérialisé à cet instant, pour que l'arène anime depuis l'état de chaque moment. Seule la `Table` l'allume (c'est un `JSON.stringify` par événement).

### 7.3 Les effets des cartes (`js/combat/effets.js`)

Un objet `S` indexé par l'identifiant de la **carte d'origine** (`c010`…`c125`, `p01`, `p05`, `u01`), donné à `Combat.scripts(S)`. Une Reverse joue comme sa carte (`baseId`).

| Champ | Rôle |
|---|---|
| `entree(x)` | effet d'entrée ★ |
| `sur.{quand}(x, data)` | déclencheur ⚡ (ou d'un Objet) |
| `attaques.{k}(x)` / `plus.{k}(E,c)` | effet sous l'attaque k / bonus « 60+ » |
| `double(E,c)` | double la valeur d'attaque |
| `buffAtk` / `buffDef`, `atk` / `def` | ce que donne un Buff aux autres / un Objet à son porteur |
| `effet(x)` + `jouable(x)` | effet d'un Coach ou d'un Moment, et sa condition |
| `resilience(x)` + `resPossible(x)` | Résilience |
| `guets.{nom}` | gestionnaires d'un guetteur (`E.temp` de type `guet`) |
| `donne`, `motsCles(E,c)` | mots-clés donnés ou conditionnels |

Contexte `x = {E, j, c, P, A}` (+ `porteur`, `X` l'attaque en cours, `guet`). Drapeaux lus par le moteur : `provocSiLibre`, `jusDeBagarre`, `invitation`, `chevaliere`, `nucleaire`, `legionGratuite`, `ombre:false`. Couverture vérifiée : aucune des 122 cartes jouables n'a de texte sans script ; les trois Secrètes floutées ne se jouent pas.

### 7.4 L'IA (`js/combat/ia.js`)

`IA.choisir(E, {niveau})` essaie chaque coup candidat sur une copie (`cloner`), **brouille ce qu'elle ne peut pas voir** (main et Club adverses mélangés, ses propres PV et Club, les Réserves), laisse filer la partie avec des choix rapides jusqu'au tour suivant, et note la position (`evaluer` : PV, main, Essences, plateau, menace). Elle préfère développer avant d'attaquer. Son hasard ne touche jamais `E.rng`.

| Niveau | Nom | Réglage |
|---|---|---|
| 1 | Débutant | règles simples, **ne joue aucun Instant** (Coachs compris) |
| 2 | Facile | un essai, beaucoup d'imprécision |
| 3 | Normal | deux essais, un peu d'imprécision |
| 4 | Difficile | trois essais |
| 5 | Légende | quatre essais, et la réponse adverse (deux tours) |

**Tout nouveau `but` de décision doit être ajouté à `choixRapide` / `cartesRapide`**, sinon l'IA prend la première option. `INSTANTS_SURS` liste les Instants que l'IA rapide joue. Mesures (IA contre IA, decks) dans `docs/economie-3.0.md` § 3 bis.

### 7.5 Decks et atelier

- **`js/combat/decks.js`** (`Decks`) : un deck enregistré vaut `{id, nom, cartes:{id:n}, reserve:{couleur:n}, couverture}` ; `versMoteur()` le met à plat. Limites : **1 exemplaire** pour L, S, UN, PR et les Promos non Reverse, **2 sinon** ; une Reverse compte avec sa classique ; alias `p02 → p01`, `p06 → c121`. `jouable()` exclut les Essences et les Secrètes cachées. `verifier(deck, possede)` renvoie la liste des erreurs.
- **Starter Decks** (`STARTERS`) : `toxique` (avec `p03`, Réserve rose ×10) et `deter` (avec `p04`, mauve ×10), **prêtés** (on n'a pas besoin d'en posséder les cartes). Les listes sont reconstituées.
- `aleatoire(rand, {niveau, couleurs})` tire un deck crédible (16 Joueurs, 5 Objets, 9 Instants) : decks adverses de la campagne (`deckRival`), de l'Arcade, du Raid (`deckSorcier`) et de l'Épreuve. Sans `couleurs`, il les tire par `tirerCouleurs` (une ou deux, ni jade ni jaune : Arcade, Épreuve) ; la campagne impose celles du rival (jaune compris), le Raid Mauve plus un allié du jour (`CHOC_ALLIES`, jaune et jade compris). `bilan()` note un deck « Solide / Jouable / À revoir » sur trois repères mesurés. Code de partage `M8D1.c012x2.c013|rose10` (`encoder` / `decoder`).
- **L'atelier** (`js/combat/atelier.js`) : filtres, grille, Réserve, « Compléter » (cibles 16 / 5 / 9 triées par `IA.valeurCarte`), import / export du code, enregistrement par `deck_sauver` (le serveur revérifie).

### 7.6 L'arène (`js/combat/table.js`, `css/arene.css`)

- **`Table.ouvrir(o)`** : `init` (partie à créer) ou `E` (reprise), `moi`, `ia: {niveau, choisir?}` (ou `null` contre un humain), `joueurs`, `cosm`, `titre`, `boss`, `minuteur`, `sauver` (clé `localStorage`), et les rappels `surFin(E, gagne)`, `surAction(a, E, deMoi)`, `surQuitter`. L'option **`guide`** (`permis`, `refus`, `apresRendu`, `surDecision`, `apresAction`, `avantIA`) sert au tutoriel.
- **La boucle** avance tant que ce n'est pas au joueur ; l'IA marque un temps (1 000 ms, 650 pour un choix) avant `IA.choisir`. `executer(a)` : `Combat.agir` → `surAction` → `sauver` → `animer(evs)`.
- **Ce qu'on dessine et ce qu'on décide** : `rendre()` dessine `vue()` (la photo `e.etat` de l'événement en cours, sinon `T.E`) ; **les décisions se lisent toujours sur `T.E`**, qui est déjà à l'état final pendant une animation. `rendre()` est repoussé pendant `T.anim`, sauf `rendre(true)` depuis un geste d'animation.
- **`ANIM[e.t]`** : un geste par type d'événement (vol de carte, secousse, bandeau, flèche de visée, éclats, `entreeMaitrisee`). `journaliser` écrit le journal, `historiser` les « cartes jouées ».
- **La carte agrandie** (`ouvrirFocus`), deux mises en page :
  - **la zone de détails** (`.ar-focus.large`, 3.0.8) : **pendant son tour**, une carte de sa main ou un de ses Joueurs posés s'ouvre **au-dessus de son camp** (`.haut`), dont les trois places restent visibles et touchables ; la carte à gauche, `zoneDetails()` à droite : nom, sorte et couleur, Défense (réelle pour un Joueur posé), Prêt / Engagé, Objets, attaques (boutons `data-ar="attaque"` pour ses Joueurs, la lançable en lavande), mot-clé, talents, effet, Résilience, « En ce moment », et pour une carte de la main **le geste** (`panneauMain` : « Touche une place libre », « Jouer ce Moment », ou pourquoi pas), collé en bas de la colonne quand elle défile. Tout y est écrit : pas de « Lire le texte ». Sur un écran de 900 px ou plus, toute carte s'ouvre ainsi ;
  - **la carte en très grand** (3.0.7), sur téléphone le reste du temps (tour adverse, carte de l'adversaire) : la carte intacte, son état dessous, « Lire le texte en grand ».
  Un Joueur engagé ne pivote pas : il est assombri, avec l'étiquette « Engagé ».
- **Les places libres** (`marquerPlacesCarte`, 3.0.8) : une carte de la main tenue (touchée ou glissée), chaque place où elle peut aller montre **la carte en fantôme** (`.ar-place-f`, sans maîtrise) dans un liseré lavande qui respire lentement ; survolée en glissant, elle se précise. Les fantômes ne sont pas redessinés d'un rendu à l'autre et partent avec la surbrillance (`surligner`). Le sélecteur du tutoriel `.ar-camp.moi .ar-place:not(:has(.ar-j))` n'en dépend pas.
- **Décisions** : mulligan, choix, cartes, ordre, dans une feuille `.ar-sheet` ; les choix qui portent sur le plateau se font en touchant les éléments `.option`. Échap referme ; `T.bloqueClic` (350 ms) corrige les touchers fantômes de Safari iOS.
- **Défis** : `minuteur` secondes par tour (une décision prise pendant son propre tour prend sur ce temps), 20 s (`CHRONO_DECISION`) pour une décision pendant le tour adverse. Son propre temps écoulé, l'arène joue à sa place (`tempsEcoule` : fin du tour, ou choix de l'IA niveau 1) ; l'adversaire, lui, est marqué « Ne répond plus » 20 s après la fin de son temps.
- **Cosmétiques** : `TAPIS` et `SLEEVES` en bas du fichier (identifiants = articles de `shop_items` ; chaque tapis a sa vignette `-mini.webp`). Les Essences Brillantes possédées brillent en combat.
- Vitesse : `localStorage['mtcg.jeu'].rapide` (×0,55) ; mouvement réduit ×0,4.

### 7.7 Le tutoriel (`js/combat/tutoriel.js`)

Une partie écrite d'avance (`graine 7`, `ordre: true`, PV 5 contre 3, Réserves rose contre mauve ; decks `TUTO_MOI` / `TUTO_LUI` dans l'ordre main, PV, pioches). Le Rival est scénarisé aux tours 2 et 4 (`tutoRival`), puis joue en niveau 1. **21 étapes** (`ETAPES`) : une étape « à lire » attend « Compris » ; une étape « à faire » allume ce qu'il faut toucher (`vise` → sélecteurs CSS) et l'arène refuse les autres coups (`guide.permis`). **14 remarques** (`REMARQUES`) à la première occurrence. La fin écrit `mtcg.tutoriel` et appelle `tutoriel_fini` (quête « Premiers pas », 200 Éclats une fois). La variable `--tuto-h` arrête la carte agrandie au-dessus de la bulle. **Le tutoriel dépend du DOM de l'arène** : changer une classe de `table.js` peut le casser en silence (les sélecteurs fautifs sont avalés) — le rejouer dans un navigateur à chaque retouche de l'arène.

### 7.8 L'onglet Combats (`js/battle.js`, `css/combat.css`)

- **Vues** (`cbVue`) : `accueil`, `solo`, `campagne`, `arcade`, `raid`, `versus`, `decks`, `missions`, `guides`, `atelier`. Sans Section, `vChoixSection()` s'affiche d'abord (Toxique ou Déter, avec leur Starter et leur Promo) ; seul « Apprendre d'abord » y échappe : il ouvre le Guide (et le tutoriel) avant de choisir, et son retour ramène au choix.
- **L'accueil** : le bandeau illustré (`assets/combat/banniere-combats.webp`, le chevalier de « La Luxueuse III »), Section et niveau, le Tutoriel en avant, l'affiche du prochain combat de campagne, les portes Solo et Versus, l'affiche du Raid, les raccourcis Decks, Missions (quêtes de combat et de niveau), Guide.
- **Lancer un combat** : `demarrer(o)` appelle `combat_debut(mode, cle, niveau)` → `{id, graine}`, puis `ouvrirArene` → `Table.ouvrir({sauver: 'mtcg.combat.encours', surFin: finirCombat})`. `finirCombat` envoie `combat_fin(id, gagne, {tours, vaincus, touches, pv, actions})` et affiche ce qui a été gagné. Un combat interrompu se reprend (`reprendreCombat`, par `Combat.rejouer`).
- **Guides** (`js/combat/guides.js`) : deux onglets, Règles (chapitres `GUIDES`) puis Glossaire (`GLOSSAIRE()`, ~50 mots reliés à leur chapitre).

### 7.9 Les modes

| Mode | Fichiers | Ce que c'est | Ce que ça rapporte |
|---|---|---|---|
| **Campagne** | `campagne.js` | 20 rivaux **de l'autre Section** (`RIVAUX`), en 4 actes ; IA 1 → 5 (`NIVEAUX_CAMPAGNE`), règles spéciales aux combats 5, 10, 15, 20 (`REGLES_CAMPAGNE`) ; la finir donne la Promo de l'autre Section | une récompense par combat (`RECOMPENSES_CAMPAGNE`, 3 400 Éclats, 14 boosters, 2 800 Fragments en tout), puis 10 Éclats en rejouant |
| **Arcade** (`'infini'` côté serveur) | `battle.js` | 5 difficultés, deck adverse tiré de la graine du serveur | 10 / 15 / 25 / 35 / 50 Éclats ; **5 victoires payées par jour** (`PVE_PLAFOND`) |
| **Raid** | `raid.js`, `RAID` dans `choc-data.js`, `27_raid.sql` | The French Sorcerer (`c116`), boss commun au serveur, déjà posé sur le plateau. Saisons de 14 jours (depuis le 12 octobre 2026), **6 phases** abattues par les dégâts de tous (chacune ouvre un coffre commun), 3 paliers personnels, puis le mode Infini. **3 tentatives par jour** | coffres ; 2 Éclats par dégât +15 si victoire (3 Étincelles par dégât +15 pendant le Choc) |
| **Épreuve du jour** | `choc.js` | pendant le Choc seulement ([§ 8.6](#86-le-choc-des-sections)) | Étincelles |
| **Versus** | `defis.js`, `23_combats.sql` | défi entre amis, en direct, 60 s par tour ; le serveur range les actions numérotées, chaque navigateur rejoue celles de l'autre ; les deux déclarent le gagnant (désaccord noté) | 40 Éclats la victoire, 15 la défaite, **3 défis payés par jour** ; rien sous 12 actions |

Le seuil des phases du Raid se règle sans redéployer : `update public.parametres set raid_echelle = 0.5 where id = 1;` (rétroactif : recalculé à chaque lecture).

### 7.10 XP et niveau de combattant (`js/combat/niveaux.js`, `26_niveaux.sql`)

Chaque combat fini rapporte de l'XP, **sans limite** : 50 la victoire, 20 la défaite (rien sous 6 tours), × un facteur de difficulté, +4 par Joueur vaincu (6 au plus) ; défi 80 / 35. `xpRequis(n) = min(100 + 25(n−1), 1100)`. Chaque niveau paie **50 Éclats** ; des paliers (3, 5, 10, 15, 20, 25, 30, 40, 50) ajoutent boosters, cadres Arène (`f_niv10/20/30/50`) et titres ; au-delà de 50, 2 boosters tous les 5 niveaux. Le niveau s'affiche en pastille sur l'avatar. Attention : `NIVEAUX` (global, ici) n'a rien à voir avec `IA.NIVEAUX`.

### 7.11 Ce que le serveur vérifie

Le serveur **ne fait pas tourner le moteur**. Il fixe la graine de chaque combat (`combat_debut`, table `combats_ouverts`), plafonne ce qu'un combat rapporte, et **croit le navigateur sur le résultat** : un combat de moins de 20 s ne rapporte rien ; 5 victoires payées par jour, partagées entre l'Arcade et la campagne rejouée (les premières victoires de campagne, le Raid et l'Épreuve n'y comptent pas) ; 3 défis payés ; un défi de moins de 12 actions ne paie pas ; les dégâts du Raid sont plafonnés (PV du boss + 1, + 3 si victoire). Un essai d'Épreuve ou une tentative de Raid est **consommé au départ** (abandonner ne le rend pas). **Le deck n'est pas envoyé au début d'un combat contre l'IA** : `deck_erreur` (qui recopie 30 / 10, les alias et les limites) ne vérifie un deck qu'à l'enregistrement (`deck_sauver`, qui accepte un deck incomplet) et pour un défi (`deck_defi_erreur`, deck complet exigé).

### 7.12 Recettes

- **Ajouter ou modifier l'effet d'une carte** : écrire `S.cNNN = {…}` dans `effets.js` (texte imprimé en commentaire), en ne passant que par `O.*` et `x.E` ; émettre un `O.ev(E, {t:…})` pour tout ce que l'arène doit montrer (et son geste dans `ANIM` si `t` est nouveau) ; ajouter tout nouveau `but` à l'IA ; toujours fournir `jouable` / `resPossible` ; écrire un test dans `tools/combat-tests.js` (`situation()`), puis `combat-sim.js aleatoire 2000` et `clone 200` ; noter toute lecture ambiguë dans `docs/regles-3.0.md` § 10.
- **Ajouter une étape au tutoriel** : un objet dans `ETAPES` **à sa place chronologique** ; outils `tourDe`, `tuU`, `tuIdDe`, `enMain`, `surPlateau`, `placesLibres` ; mettre à jour le test du tutoriel dans `combat-tests.js` et rejouer le tutoriel dans Chromium.
- **Changer une valeur de règle** : `REGLE`, **puis** les copies en dur : SQL (`deck_erreur` pour 30 / 10, `limite_copies` pour 1 / 2, la table `starters` qui recopie `Decks.STARTERS`, tout dans `23_combats.sql`), textes de `guides.js`, du tutoriel et de l'arène, `docs/regles-3.0.md` § 13 ; et mesurer avec `combat-sim ia`.
- **Ajouter un mode contre l'IA** : `demarrer({mode, cle, niveau, deck, deckIA, …})` ; dans `23_combats.sql`, trois endroits : le test `if p_mode not in (…)` de `combat_debut`, la contrainte `check (mode in (…))` de `combats_ouverts` (dans un `create table if not exists` : sur une base existante, `alter table public.combats_ouverts drop constraint combats_ouverts_mode_check, add constraint …`), et l'aiguillage de `combat_fin` (un mode inconnu y est payé comme l'Arcade) ; `xp_combat` (`26_niveaux.sql`) si l'XP diffère ; enfin `RPC.combat_debut` / `RPC.combat_fin` de `_demo/serveur.js`.
- **Ajouter un tapis ou une sleeve** : l'image (et sa `-mini`) dans `assets/combat/…` (générée par `tools/cosmetiques.py` ou `choc-visuels.py`), l'entrée dans `TAPIS` / `SLEEVES`, l'article `shop_items` du même identifiant (SQL et `BOUTIQUE` du faux serveur).

---

## 8. Les événements

### 8.1 Le modèle

Un événement est **une ligne de `evenements`** (`supabase/installation/15_evenements.sql`) : `titre`, `texte`, `debut`, `fin`, `ticket_minutes` (facultatif), `code` (facultatif).

- **Sans code**, il ne change que le rythme des boosters (`ticket_minutes`, 120 = doublés) et pose un bandeau sur l'écran Boosters.
- **Avec un code** (`reflets`, `choc`), il active tout ce qui porte ce code : les quêtes (`quests.evenement`), la boutique (`shop_items.evenement`), le Pass (`evt_piste.evenement`), le compte de monnaie (`evt_comptes.evenement`), et l'onglet du même nom.

**Cycle de vie** :

1. **À venir** : début dans moins de 15 jours → `me().evenement.a_venir` ; le bandeau compte à rebours.
2. **En cours** : `evenement_en_cours()` renvoie le code ; l'onglet existe, **en tête du tiroir** (Combats garde sa place dans la barre du bas).
3. **Récap** : pendant 3 jours après `fin` (si aucun autre événement codé n'a commencé), `me().recap = evenement_recent()` ; l'onglet devient un récap et une fenêtre l'annonce une fois.
4. **Fini** : l'onglet disparaît. **Tout ce qui n'a pas été réclamé est perdu** (`piste_reclamer` et `claim_quest` refusent dès la fin).

**Côté client** : `evenementEnCours()` et `ongletDispo` (`js/app.js`, avec `RECAPS = {reflets, choc}`), `TABS` (`{id:'reflets', evenement:'reflets'}`, `{id:'choc', evenement:'choc'}` ; Devine l'illu porte `horsEvenement: 'reflets'`). Le bandeau de l'écran Boosters (`vBandeauEvenement`, `js/booster.js`) choisit, dans l'ordre : récap Reflets, Reflets, récap Choc, Choc, puis l'événement sans code ou la chasse. La boutique principale a aussi son bandeau. `prochaineBascule()` relit l'état au début et à la fin.

### 8.2 Les monnaies d'événement

- **Une seule table**, `evt_comptes(user_id, evenement, solde, total)` : `solde` se dépense en boutique, `total` fait avancer le Pass. **Acheter ne fait jamais reculer le Pass.**
- **En base, la monnaie s'appelle toujours `prismes`** (`quests.monnaie = 'prismes'`, `shop_items.devise = 'prismes'`), quel que soit l'événement. Le nom affiché vient de `MONNAIES_EV` (`config.js` : `reflets` → Prismes, `choc` → Étincelles), lu par les accesseurs `PRISMES.nom` / `PRISMES.un` ; l'icône par `evIco()`. Les Étincelles s'appelaient d'abord « Insignes » : d'où les clés serveur `insignes` qui restent.
- `me().prismes` = le solde de l'événement en cours. Crédits : quêtes, Devine l'illu (pendant Reflets), Épreuve (`choc_fin`), Raid pendant le Choc (`raid_fin`).

### 8.3 Quêtes, Pass, boutique

- **Quêtes** : `scope = 'ev_jour'` (chaque jour de Paris) et `'ev'` (une fois pour tout l'événement, clé `'all'`). La quête de visite (`ev_visite`) est validée **en ouvrant l'onglet** (`evenement_etat` et `choc_etat` écrivent). Totaux : Choc 75 Étincelles par jour et 670 une fois ; Reflets 50 par jour et 380 une fois.
- **Le Pass** (« piste » en base) : `evt_piste(evenement, palier, seuil, type, montant, objet, titre)` et `evt_piste_prises`. `piste_reclamer(p_palier)` exige un événement en cours, `total ≥ seuil` et une prise unique ; il passe par `accorder()` (types `boosters`, `eclats`, `fragments`, `titre`, `cadre`, `tapis`, `sleeve`, `reverse_R`, `brillante`, et `legendaire`, géré mais utilisé par aucun palier).
  - **Pass Reflets** (20 paliers, 15 → 1 100) : 14 boosters, 1 350 Éclats, 1 250 Fragments, 4 Reverses Rares, 1 Brillante, titres `t_eclaireur` et `t_ame`, cadres `f_miroir` et `f_nebuleuse`.
  - **Pass Choc** (30 paliers, 20 → 3 500) : 23 boosters, 2 200 Éclats, 3 750 Fragments, 5 Reverses Rares, la Brillante (palier 15), la sleeve `s_choc` (8), le cadre `f_choc` (12), les titres `t_recrue`, `t_veteran`, `t_maitre_choc`, et **le tapis `t_arene`** (30).
- **Boutique d'événement** (`categ = 'evenement'`, `devise = 'prismes'`, `limite` par joueur) :
  - Reflets : `ev_boosters` (70, ×5), `ev_fragments` (60, ×5), `ev_reverse` (150, ×3), `t_collect` (200, unique) ;
  - Choc : `ch_boosters` (2 boosters, 80, ×10), `ch_boosters5` (5 boosters, 180, ×3), `ch_fragments` (500 Fragments, 70, ×8), tapis `t_orage` « The French Sorcerer » (600), titre `t_supporter` (200), cadre `f_foudre` (400) — **3 100 Étincelles** pour tout acheter. L'ordre (`shop_items.ordre`) place le tapis et le cadre du Sorcier l'un sous l'autre, dans la même colonne de la grille à deux colonnes.

### 8.4 Le récap

`evenement_recap()` renvoie le total, les paliers atteints / pris, les illus trouvées, les Reverses, les quêtes réclamées, le rang, le nombre de joueurs et le podium ; pour le Choc s'ajoutent les dégâts au Raid, les phases tombées et les Épreuves (`choc_recap`). Le Labo en montre un aperçu factice (`apercuRecap`, `apercuRecapChoc`), sans rien enregistrer.

### 8.5 Reflets (2.0) et Devine l'illu

- **Reflets** (`js/reflets.js`, `css/reflets.css`, `supabase/installation/21_reflets.sql`) : l'événement de la 2.0, terminé en production. Son onglet a six sous-onglets (Accueil et ses Nouveautés 2.0, Quêtes, Pass, Devine l'illu, Boutique, Classement). Son code et sa CSS servent de **charpente** au Choc. En pré-prod, il est remplacé par le Choc.
- **Devine l'illu** survit à l'événement, dans son onglet (`illu`, tiroir) : une illustration par jour de Paris, la même pour tous, dans un ordre secret (cartes triées par `md5(illu_sel || ':' || id)`, cycle de 113 jours ; le sel `parametres.illu_sel` n'est jamais montré). Pixels 36 × 24 à 12 bits dans `illu_pixels` (`21b_illu.sql`, généré par `node tools/illu-pixels.js`) ; le serveur n'envoie que la grille du niveau en cours (9 × 6 → 12 × 8 → 18 × 12 → 36 × 24) et ne révèle la carte qu'à la fin. 4 essais ; gains 120 / 90 / 60 / 30 Éclats, plus 25 / 18 / 12 / 6 Prismes **pendant Reflets seulement** (`illu_gain`). Partage façon Wordle. En pré-prod, les grilles viennent de `preprod/js/demo-illu.js` (`window.DEMO_ILLU`), écrit par `tools/demo.py` à partir de `21b_illu.sql` ; l'ordre des illustrations n'y est pas salé.

### 8.6 Le Choc des Sections

L'événement de la 3.0 (`code = 'choc'`, trois semaines ; `js/choc.js`, `css/choc.css`, `js/combat/choc-data.js`, `supabase/installation/25_choc.sql`). Il oppose les deux Sections : **Toxique** (vert, Squeezie le Toxique, #012) et **Déter** (violet, Brawks Déter, #077).

- **Sept sous-onglets** (`CH_ONGLETS`) : Accueil (l'affiche coupée en biais `chAffiche()`, les Nouveautés de la 3.0), Raid, Épreuve, Quêtes, Pass, Boutique, Classement (Raid ou Étincelles).
- **L'Épreuve du jour** : un combat imposé, **le même pour tous** (`choc_etat()` donne `jour` et `graine` ; le client en tire la règle du jour parmi 7 — `eclair`, `siege`, `renforts`, `miroir`, `outsider`, `marathon`, `classique` — et les decks de niveau 3 par `epreuveDuJour`). **3 essais**, le meilleur compte (`scoreEpreuve` ↔ `choc_score`). L'essai est enregistré perdu dès le départ. 5 Étincelles par essai joué (plus de 20 s), +25 à la première victoire du jour. Le serveur ne vérifie ni la règle ni les decks.
- **Le Raid paie en Étincelles** pendant le Choc (3 par dégât, +15 si victoire), et alimente `choc_joueurs`.
- **Les Nouveautés** (`vChNouveautes`) : la grande bannière des Combats (`.ch-nv-combats`, le chevalier cadré sur son médaillon comme dans l'onglet Combats), les Secrètes en éventail (celles qu'on possède se retournent ; elles mènent aux Classiques), la refonte visuelle (qui ouvre `montrerNouveautes30`), et une grille de six tuiles (maîtrise, Raid, cadre Secrète, niveau, tapis et sleeves, atelier).
- **Les bandeaux** (`vBandeauChoc`, écran Boosters et Boutique) : l'affiche des deux Sections, la coupe mesurée depuis la droite (172 px) pour que la tête de Brawks tombe entière entre la coupe et la flèche ; rien ne se pose sur elle (ce qui reste à prendre : une pastille au coin ; dans la Boutique, le solde passe dans le texte).
- **Visuels** (`tools/choc-visuels.py`) : les affiches `choc-toxique.webp` et `choc-deter.webp`, les tapis `t_arene` (Brawks en haut — la même illustration que la bannière, avec ses couleurs, la tête au milieu du camp adverse —, Squeezie en bas) et `t_orage`, la sleeve `s_choc`. Cadres `f_choc` et `f_foudre` (`tools/cadres-30.py`).

### 8.7 La fenêtre des Nouveautés

`montrerNouveautes()` (`js/bienvenue.js`) s'ouvre une fois par version et par appareil (`NOUVEAUTES_VERSION = '3.0'`), et **se rouvre** quand un événement est annoncé puis quand il commence (clé `titre|debut|avant/pendant`). Elle se rouvre aussi à la main (`data-act="nouveautes"` : bandeau, tuile « refonte », Labo). Pour une nouvelle fenêtre : changer `NOUVEAUTES_VERSION`, écrire `montrerNouveautesXX()` **et** modifier le dispatch de `montrerNouveautes()`, qui teste `=== '3.0'` en dur. À ne pas confondre avec la page « Nouveau dans la 3.0 » de l'onglet du Choc (`vChNouveautes`).

### 8.8 Recettes

```sql
-- Lancer un événement à code (production)
insert into public.evenements (titre, texte, debut, fin, code) values
  ('Le Choc des Sections', 'La version 3.0 : …', '2026-11-02 18:00+01', '2026-11-23 18:00+01', 'choc');
-- Boosters doublés (sans code) : … (titre, texte, debut, fin, ticket_minutes) values (…, 120)
-- Arrêter : le récap s'affiche 3 jours (pour le sauter : fin = now() - interval '3 days', en gardant fin > debut)
update public.evenements set fin = now() where code = 'choc' and fin > now();
-- Ouvrir la chasse
update public.chasse set active = true, ouvre_le = now() where id = 1;
```

- **Ne jamais réutiliser un code** : soldes, paliers pris et quêtes `ev` (clé `'all'`) sont indexés par code. Relancer `reflets` repartirait de la première édition : Prismes restants et Pass déjà avancé, paliers déjà pris impossibles à reprendre, quêtes « ev » déjà encaissées.
- **Ne pas chevaucher** un événement sans code et un événement codé : le client affiche le dernier commencé (avec ou sans code, `evenement_actif`), le serveur crédite le dernier **codé** (`evenement_en_cours`) — l'onglet du Choc disparaîtrait pendant que le serveur continue de payer.
- **Ajouter un nouvel événement** : SQL (Pass `evt_piste`, quêtes `evenement = code`, articles `devise = 'prismes'`, ajoutés aux listes `delete … not in` de `04_seed.sql`, message d'erreur de `shop_buy`, éventuellement un `xxx_recap`) ; JS (`MONNAIES_EV`, `evIco`, `TABS`, `VUES`, `RECAPS`, `pastilleOnglet`, chargement dans `aller()`, `vBandeauEvenement`, bandeau de la boutique, `proposerAccueil`, Labo) ; faux serveur (`PISTES`, `QUETES`, `BOUTIQUE`, `S.evenement`).
- **Changer l'Épreuve ou le Raid** : `CHOC` / `RAID` dans `choc-data.js` **et** les valeurs écrites en dur dans `25_choc.sql` (`>= 3`, `'max', 3`, `insignes := 5`, `+ 25`, `'niveau', 3`, et `choc_score`, copie de `scoreEpreuve`) et `27_raid.sql` (`raid_phases()`, `raid_perso()`, `raid_fin()`, `n < 3`, `raid_combat()` pour la formule de l'Infini, `raid_saison()` / `raid_saison_debut()` pour le départ du 12 octobre 2026 et les 14 jours).

---

## 9. Le serveur (Supabase)

### 9.1 Principes et sécurité

- **Le serveur fait foi sur tout ce qui compte** : tirages, monnaies, collection, quêtes, récompenses. Le navigateur affiche et propose ; les copies de règles côté client ne servent qu'à l'affichage, au Labo et à la pré-prod.
- **Aucune écriture directe.** RLS activée sur les 43 tables ; le navigateur ne peut **rien** écrire, et ne lit directement que `cards`, `quests`, `shop_items` (plus `friendships`, `notifications`, `annonces` une fois connecté, pour le temps réel). Tout passe par des fonctions **`security definer set search_path = public`**.
- **Modèle de chaque RPC joueur** :

  ```sql
  create or replace function public.ma_rpc(p_x text) returns jsonb
  language plpgsql security definer set search_path = public as $$
  declare p uuid := auth.uid();
  begin
    if p is null then raise exception 'non connecte'; end if;
    perform garde_beta();
    -- … vérifier, écrire …
    return me();
  end $$;
  revoke all on function public.ma_rpc(text) from public, anon;
  grant execute on function public.ma_rpc(text) to authenticated;
  ```

  **`revoke … from public` est obligatoire** : PostgreSQL accorde EXECUTE à PUBLIC par défaut, et `anon` en hérite. RPC qui ne passent pas par `garde_beta` : `porte()` (ouverte à `anon`), `me()` (elle renvoie `invite`), `utiliser_invitation()`, `mes_cadeaux()` (lecture seule), et les quatre RPC d'administration (`annonce_publier`, `annonce_retirer`, `offrir_cadeau`, `admin_joueurs`), qui ne vérifient que `is_admin`.
- **La bêta est fermée pour toujours** : `beta_lancement()` renvoie `'infinity'` ; seuls les comptes de `beta_invites` (par e-mail ou identifiant Discord, `est_invite`) jouent. `handle_new_user` crée quand même le profil (pour qu'un code d'invitation puisse servir), mais `garde_beta()` refuse tout le reste avec `BETA_FERMEE`. **Même l'administrateur doit être dans `beta_invites`.**
- **Administrateur** : `profiles.is_admin`, posé **uniquement en SQL** (`supabase/administration/admin.sql`). `annonce_*`, `offrir_cadeau`, `admin_joueurs` le vérifient côté serveur.
- **Les messages d'erreur sont montrés tels quels** : ils sont en français. Un code en majuscules (`RESERVE_VIDE`, `BONUS_VIDE`, `BOOSTER_VIDE`, `ECHANGE_EN_RECHARGE`, `BETA_FERMEE`) doit être traduit dans `MSG_SERVEUR` (`js/backend.js`).
- **Jours à l'heure de Paris** partout (`period_key`, `jour_paris`, `illu_jour`, `checkin`).
- **Ce que l'écran d'attente ne protège pas** : les *fichiers*. Le site est statique et public ; seul le *jeu* est fermé (le serveur ne répond rien sans invitation).

### 9.2 Les fichiers SQL

| Fichiers | Nature | Dans `TOUT.sql` |
|---|---|---|
| `01`, `02`, `03`, `03b`, `04`, `06`, `07`, `11`, `12`, `14`, `15`, `18`, `21`, `21b`, `22`, `23`, `24`, `25`, `26`, `27`, `28` | **Installation**, rejouable (`if not exists`, `on conflict`, `create or replace`) | oui, dans cet ordre (`MORCEAUX`, `tools/build-sql.py`) |
| `02_cards.sql`, `21b_illu.sql` | **Générés** (`python3 tools/gen-cards-sql.py`, `node tools/illu-pixels.js`) : ne jamais éditer | oui |
| `administration/admin.sql`, `beta.sql`, `reset-profil.sql`, `reset-tout.sql` | **Outils d'administration** ponctuels ([§ 9.10](#910-outils-dadministration)) | non |

Les fichiers d'installation vivent dans `supabase/installation/` ; leur préfixe numérique est leur ordre dans `TOUT.sql` (les numéros manquants, `05`, `08`–`10`, `13`, `16`, `17`, `19`, `20`, étaient des outils, devenus `administration/`, ou des **mises à jour historiques** des bases 1.4 / 1.5, dangereuses à rejouer et **supprimées en 3.0.8** : elles restent dans l'historique git, commit `80a621f` et avant).
| `TOUT.sql` | **Assemblé** par `python3 tools/build-sql.py` (~6 100 lignes) : c'est ce qu'on colle dans Supabase | — |

| Fichier | Contenu |
|---|---|
| `01_schema.sql` | Tables de base (`profiles`, `cards`, `collection`, `quests`, `quest_progress`, `shop_items`, `inventory`, `trades`, `beta_invites`), `cfg()`, la porte et la bêta, `handle_new_user`, `regen_tickets`, `period_key`, `bump_quests`, `sync_collection_quests`, droits |
| `02_cards.sql` | Les 122 cartes ; ménage des cartes `not promo` absentes (et de leurs échanges et exemplaires) |
| `03_rpc.sql` | `me` (version courte), `open_pack`, `claim_quest`, `shop_buy`, échanges, `find_player`, `pick_card` |
| `03b_promos.sql` | Promos, Brillantes, Reverses, carte unique, `check_promos` |
| `04_seed.sql` | 97 quêtes, 32 articles (chaque liste finit par un `delete … not in (…)`) |
| `06_social.sql` | Amis, `player_profile` (version courte) |
| `07_vitrine.sql` | Vitrine, et **les versions définitives de `me()` et `player_profile()`** |
| `11_boite.sql` | Notifications, annonces, temps réel |
| `12_recyclage.sql` | `recycler`, `fabriquer` |
| `14_classement.sql` | `classement(p_critere)` |
| `15_evenements.sql` | `tirages`, `evenements`, `chasse`, `succes_de`, `mes_tirages` |
| `18_cadeaux.sql` | Cadeaux d'un administrateur, boosters hors réserve |
| `21_reflets.sql` | `parametres`, moteur d'événements (`evt_*`, `accorder`, Pass), Devine l'illu, invitations, titres, `personnaliser` ; **crée l'événement Reflets pour 14 jours s'il n'existe pas** |
| `22_garder.sql` | À garder, favoris |
| `23_combats.sql` | Sections, decks, combats (`combat_debut` / `combat_fin`), campagne, Arcade, Starters, défis, tutoriel |
| `24_secretes.sql` | Les 5 Secrètes |
| `25_choc.sql` | Le Choc : Pass, Épreuve, `choc_etat`, `choc_recap` |
| `26_niveaux.sql` | XP et niveaux |
| `27_raid.sql` | Le Raid par saisons et phases, `raid_echelle` |
| `28_maitrise.sql` | Maîtrise et carte fétiche |

**Ordre** : `03b` avant `04` (la boutique vend `p01`) ; `21` avant `21b` ; `23` avant `26`. Ailleurs, PL/pgSQL résout les appels à l'exécution : `me()` (07) appelle des fonctions de 11 à 28 — **il faut passer tout `TOUT.sql`**.

### 9.3 Les tables (43)

- **Joueur** : `profiles` (pseudo, avatar, cadre, `shards`, `fragments`, `tickets`, `last_tick`, `boosters_bonus`, `tickets_offerts`, `is_admin`, `garder`, `vitrine`, `titre`, `banniere`, `devise`, `fetiche`…), `collection`, `inventory`, `quest_progress`, `favoris`, `gardes`, `tirages`, `recyclages`, `cadeaux`, `notifications`.
- **Catalogue et réglages** : `cards`, `quests`, `shop_items`, `parametres` (une ligne : `fabrication_reverse`, `illu_sel`, `raid_echelle`), `pve_campagne`, `pve_difficultes`, `starters`, `niveau_paliers`, `illu_pixels`, `evt_piste`.
- **Social** : `friendships`, `trades`, `annonces`, `invitations`, `beta_invites`.
- **Événements** : `evenements`, `chasse`, `evt_comptes`, `evt_piste_prises`, `devine_illu`, `choc_joueurs`, `choc_epreuves`.
- **Combat** : `combat_joueurs` (section, deck actif, cosmétiques, campagne, plafonds du jour, statistiques, `xp`), `decks`, `combats_ouverts`, `defis`.
- **Raid** : `raid_saisons`, `raid_tombees`, `raid_participants`, `raid_pris`, `raid_tentatives`.
- **Maîtrise** : `maitrises`, `maitrises_journal`.

Préfixes d'inventaire : `f_` cadres, `t_` titres **et** tapis, `s_` sleeves (et articles), `trade_token`.

### 9.4 Les RPC publiques (58, `porte` comprise)

| Domaine | RPC (→ retour) | Appelées par |
|---|---|---|
| Compte et état | `porte()` (aussi `anon`), `me()` → l'état complet, `checkin()`, `set_profile(p_pseudo, p_avatar, p_frame)`, `personnaliser(p_titre, p_banniere, p_devise)`, `set_vitrine(p_cards)`, `utiliser_invitation(p_code)` | `gate`, `app`, `settings`, `profile` |
| Boosters, quêtes, boutique | `open_pack(p_bonus)` → `{cards, god, etat}`, `claim_quest(p_quest)`, `shop_buy(p_item)`, `mes_tirages()` | `opening`, `app`, `shop`, `tirages` |
| Collection | `regler_garder(p_carte, p_n)`, `regler_garder_defaut(p_garder)`, `favori(p_carte, p_on)` → liste, `recycler(p_lots)`, `fabriquer(p_carte)`, `maitriser(p_carte)`, `set_fetiche(p_carte)` | `viewer`, `settings`, `recyclage`, `maitrise` |
| Social | `trade_create`, `trade_respond`, `trade_cancel`, `trade_list`, `find_player`, `friend_request`, `friend_respond`, `friend_remove`, `friend_list`, `player_profile(p_pseudo)`, `amis_doublons()`, `classement(p_critere)`, `boite()`, `boite_lue()` | `trade`, `social`, `classement`, `boite` |
| Cadeaux | `mes_cadeaux()`, `ouvrir_cadeau(p_id)` | `cadeaux` |
| Administration | `annonce_publier`, `annonce_retirer`, `offrir_cadeau(p_joueurs, p_eclats, p_boosters, p_fragments, p_carte, p_message)`, `admin_joueurs()` | `lab`, `app` |
| Événements | `evenement_etat()`, `piste_reclamer(p_palier)`, `evenement_recap()`, `illu_etat()`, `illu_essai(p_carte)`, `choc_etat()`, `raid_etat()`, `raid_reclamer(p_saison, p_quoi, p_n)` | `reflets`, `choc`, `raid` |
| Combats | `tutoriel_fini()`, `combat_section`, `combat_reglages`, `deck_sauver`, `deck_supprimer`, `combat_debut(p_mode, p_cle, p_niveau)` → `{id, graine}`, `combat_fin(p_id, p_gagne, p_resume)` → `{etat, recompense}`, `defi_lancer`, `defi_repondre`, `defi_etat(p_id, p_depuis)`, `defi_jouer(p_id, p_n, p_action)`, `defi_fin(p_id, p_gagnant, p_tours)` | `battle`, `combat/*` |

La plupart des RPC qui écrivent renvoient `me()`, que `Backend.apply` transforme en `save`. **Le faux serveur `_demo/serveur.js` implémente exactement les mêmes 58** (vérifié). Les rouages internes (`regen_tickets`, `bump_quests`, `pick_card`, `check_promos`, `garde_beta`, `notifier`, `accorder`, `crediter_prismes`, `evenement_en_cours`, `titres_de`, `garde_de`, toutes les fonctions de combat, Choc, Raid, niveaux, maîtrise…) ne sont pas appelables depuis le navigateur.

### 9.5 `cfg()` : les réglages d'économie

`cfg(k)` (`01_schema.sql`, fonction `immutable`) renvoie un entier, ou `null` pour une clé inconnue (signal utilisé : `cfg('recyclage_BR')` = `null` → « ne se recycle pas »).

| Clé | Valeur | Clé | Valeur |
|---|---|---|---|
| `ticket_cap` | 5 | `promo_palier_pct` | 75 |
| `ticket_minutes` | 240 | `foil_odds` | 50 |
| `god_odds` | 2000 | `chasse_odds` | 250 |
| `trade_cooldown_h` | 6 | `recyclage_ES/C/PC/R/E/L` | 1 / 2 / 5 / 20 / 80 / 250 |
| `pack_size`, `shards_per_dup` | morts | `fabrication_ES/C/PC/R/E/L` | 20 / 40 / 100 / 400 / 2000 / 8000 |

### 9.6 `me()` et `Backend`

- **`me()`** (`07_vitrine.sql`) appelle `regen_tickets`, `sync_collection_quests` et `check_promos`, puis renvoie `profil`, `boite`, `recyclage {valeurs, couts}`, `succes`, `evenement`, `recap`, `chasse`, `parametres`, `prismes`, `invitations`, `col`, `gardes`, `favoris`, `combat`, `maitrise`, `inv`, `quetes` (filtrées sur l'événement en cours). **Pour exposer un champ, c'est ici** (et dans `Backend.apply` et le faux serveur).
- **`js/backend.js`** est la seule couche d'accès aux données. `Backend.init()` crée le client Supabase (Discord : scopes `identify email`), puis `pull()` ; si `me()` échoue au démarrage, on revient à l'écran d'entrée (plus de repli hors ligne). `Backend.rpc(nom, args)` retire le préfixe d'erreur et traduit via `MSG_SERVEUR`. `Backend.apply(etat)` reconstruit `save`, écrase `TICKET_CAP` / `INTERVAL`, calcule `Backend.skew` (horloge serveur) et appelle `signalerQuetes` / `signalerPromos`. `srvTime(iso)` corrige une date par `skew`.
- `js/supabase-config.js` contient l'URL et la **clé publique** (`sb_publishable_…`, faite pour être publiée). **Jamais la clé secrète** : `verif.html` la détecte.

### 9.7 Installer, mettre à jour, vérifier

- **Installer ou mettre à jour** : coller **tout** `supabase/TOUT.sql` dans Supabase › SQL Editor › Run. Le fichier n'a ni `BEGIN` ni `COMMIT` : c'est l'éditeur, qui l'envoie en une seule requête, qui en fait une seule transaction (une erreur annule tout ; supposé, non vérifié). Avec `psql -f`, ajouter `--single-transaction`, sinon ce qui précède l'erreur reste appliqué. Idempotent, passe sur une base 2.x sans rien perdre (testé sur PostgreSQL 16). **Règle du propriétaire : aucun SQL 3.0 sur la base de production.**
- **Un serveur neuf** : [`SETUP.md`](SETUP.md) (projet, `TOUT.sql`, clés, URL de retour, Discord, SMTP, administrateur, GitHub Pages, domaine). Ajouter son compte à `beta_invites`. Une installation neuve **lance l'événement Reflets** pour 14 jours.
- **Vérifier** : ouvrir `verif.html` sur le site (clés, réglages d'authentification, catalogue, présence de chaque RPC jusqu'à `maitriser`, compte administrateur). Une RPC indispensable à une version mérite sa sonde.
- **Chiffres attendus** après installation : 122 cartes d'extension, 85 Reverses, 9 Brillantes, 5 Secrètes, 6 Promos, 1 Unique, 97 quêtes, 32 articles. `verif.html` affiche « 122 cartes d'extension et 106 promos » : il range sous « promos » tout ce qui porte `promo = true` (6 Promos + 85 Reverses + 9 Brillantes + 5 Secrètes + l'Unique).

### 9.8 Une règle, plusieurs copies

Chaque règle de jeu existe en **trois exemplaires** : le SQL (qui fait foi), le **faux serveur** `_demo/serveur.js` (la pré-prod), et une **constante JS** (affichage, Labo). Une valeur changée à un seul endroit rend la pré-prod ou le Labo faux, sans erreur visible.

| Règle | SQL | Faux serveur | Client |
|---|---|---|---|
| Taux des boosters | `open_pack`, `pick_card` (03) | `tirerPaquet` | `RATES`, `GOD`, `pickFrom` (`booster.js`) |
| Réglages d'économie | `cfg()` (01) | `CFG` | `REC_DEFAUT`, `FAB_DEFAUT`, `TRADE_COOLDOWN_H`, `PROMO_PALIER`, `FOIL_ODDS` |
| Quêtes, boutique | `04_seed.sql`, 21, 23, 25, 26 | `QUETES`, `BOUTIQUE` | `QICO`, `JALON_THEMES` |
| Pass | `evt_piste` (21, 25) | `PISTE`, `PISTE_CHOC` | — |
| Maîtrise | `maitrise_fragments(rar, n)`, `maitrise_copies(rar, n)` (28) | `MZ_BASE`, `MZ_MULT`, `MZ_COPIES` | `MAITRISE` (`maitrise.js`) |
| Limites de deck | `deck_erreur`, `cle_copie`, `limite_copies` (23) | via `Decks` | `REGLE`, `Decks.limite`, `ALIAS` |
| Campagne, Arcade, défis | `pve_campagne`, `pve_difficultes`, plafonds 5 / 3, 40 / 15 (23) | via `campagne.js` | `RECOMPENSES_CAMPAGNE`, `DIFFICULTES`, `PVE_PLAFOND`, `DEFI_GAIN` |
| XP | `xp_requis`, `xp_combat`, `niveau_paliers` (26) | via `niveaux.js` | `NIVEAUX` (`niveaux.js`) |
| Raid | `raid_phases`, `raid_perso`, `raid_fin` (27) | via `choc-data.js` | `RAID` (`choc-data.js`) |
| Épreuve | `choc_debut`, `choc_fin`, `choc_score` (25) | via `choc-data.js` | `CHOC`, `scoreEpreuve` |
| Devine l'illu | `illu_gain` (21) | `ILLU_GAINS` | — |
| Succès, titres | `succes_de` (15), `titres_de` (21) | `succesDe`, `titresDe` | `SUCCES`, `TITRES` (`config.js`) |

### 9.9 Recettes

- **Ajouter une RPC** : écrire la fonction selon le modèle du [§ 9.1](#91-principes-et-sécurité) ; si c'est un nouveau fichier, l'ajouter à `MORCEAUX` (`tools/build-sql.py`) ; `Backend.xxx` dans `js/backend.js` ; `RPC.xxx` dans `_demo/serveur.js` (refuser par `refuser('…')`, renvoyer `me(p)`) ; une sonde dans `verif.html` si elle est indispensable ; `python3 tools/build-sql.py`.
- **Ajouter une quête ou un article** : l'insérer dans `04_seed.sql` **et ajouter son identifiant à la liste du `delete … not in (…)`** (sinon il est effacé, avec sa progression, à chaque rejeu) ; implémenter la métrique (`bump_quests` ou `sync_collection_quests`) ; recopier dans le faux serveur.
- **Changer un réglage d'économie** : `cfg()`, puis la copie du faux serveur et la constante JS, `build-sql.py`, rejouer `TOUT.sql`.
- **Tester** : PostgreSQL local ([§ 2.3](#23-tester-le-sql-sur-un-postgresql-local)), en jouant la 2.1 de `origin/main` puis `TOUT.sql` deux fois.

### 9.10 Outils d'administration

| Fichier | Rôle | Attention |
|---|---|---|
Dans `supabase/administration/`, à coller dans Supabase › SQL Editor (aucun n'entre dans `TOUT.sql`) :

| Fichier | Rôle | Attention |
|---|---|---|
| `admin.sql` | Donner `is_admin` à une adresse e-mail (le Labo apparaît) | Remplacer l'adresse d'exemple |
| `beta.sql` | Lister les comptes de la bêta (partie 1, seule active), inviter, retirer, supprimer un compte (parties 2 à 6, en commentaire) | Décommenter la ligne voulue et la lancer seule |
| `reset-profil.sql` | Remettre **un** joueur à zéro (pseudo en dur, deux endroits) : collection, monnaies, inventaire, quêtes, événements, combats, maîtrise, fétiche ; garde le compte, le pseudo, la devise, les amis, les droits | Annule ses échanges en attente ; rouvre la chasse s'il avait la carte unique ; ses dégâts au Raid restent dans le total de la saison |
| `reset-tout.sql` | Remettre **tout le monde** à zéro, le jour d'un vrai lancement (confirmation écrite exigée) | Efface aussi les dégâts du Raid (le boss repart plein) et rouvre la chasse ; fermer le site (`PORTE.active = true`) et sauvegarder avant |

Les deux remises à zéro (réécrites pour la 3.0 en 3.0.8, testées sur PostgreSQL 16) ont un **garde-fou** : elles refusent de tourner si une table du schéma pointe vers `profiles` sans figurer dans leur liste `connues`. **Ajouter une table qui appartient à un joueur, c'est donc aussi l'ajouter à ces deux scripts** (l'effacer, ou la ranger parmi ce qu'on garde).

---

## 10. Le Labo (administrateurs)

L'onglet **Labo** (`js/lab.js`, `css/lab.css`) n'apparaît que pour `save.isAdmin` (posé en SQL, [§ 9.1](#91-principes-et-sécurité)). En pré-prod, le faux serveur rend le visiteur administrateur : **le Labo y est toujours ouvert**. Il sert à **voir ce qu'on ne peut pas provoquer**. Presque tout y est local : les boutons qui touchent la collection ne modifient que l'affichage, et le `pull` suivant remet l'état du serveur. Le Labo n'est jamais redessiné en arrière-plan (`enTrainDEcrire()`).

| Panneau | Ce qu'il permet |
|---|---|
| Ouvertures de test | normale, R / E / L / Secrète forcées, Essence Brillante, carte unique, godpack, Reverse Rare (tirage local `makeBooster`, rien n'est écrit) ; l'image de partage d'un booster |
| Événement et chasse | l'état serveur (événement, rythme, chasse) ; 4 aperçus (`avant`, `pendant`, `trouvee`, `mienne`) ; « Revenir à l'état réel » ; les fenêtres de nouveautés et de fin de chasse ; les requêtes SQL à copier |
| Promos | la scène d'obtention de chaque Promo, ou toutes à la suite |
| **Offrir un cadeau** (réel) | Éclats, boosters, Fragments, une carte et un mot à un ou plusieurs joueurs (liste avec leur retard sur la médiane) ; aperçu sans rien envoyer |
| Version 2.0 · Reflets | Nouveautés 2.1, fenêtres de palier, invitation achetée (`M8-TEST-0000`), l'onglet (si Reflets est en cours), Devine l'illu, le récap (onglet, fenêtre, bandeau) |
| Version 3.0 · Choc | Nouveautés 3.0, l'onglet (si le Choc est en cours), le récap |
| Version 3.0 · Combats | campagnes dévoilées, **toutes les récompenses** (`laboRecompenses` : campagne, Arcade, niveaux 2 → 60, Raid, Pass), une fin de combat à deux niveaux, la fiche de niveau, le bilan d'un Starter |
| **Annonce à tous** (réelle) | `annonce_publier`, avec confirmation |
| Notifications | quête accomplie, ping de la boîte, message court |
| Aperçu de la collection (local) | tout débloquer, vider, 90 %, +10 boosters, +5 000 Fragments, tous les succès, boosters illimités |
| Équilibrage | les valeurs en vigueur (lecture seule), barèmes de recyclage et de fabrication |

Les clics du Labo passent par `clicPage` (`data-act="t-*"`, `data-apercu`, `data-promo`).

---

## 11. La pré-prod et le faux serveur

### 11.1 Ce que fait `tools/demo.py`

Il copie `index.html`, `manifest.webmanifest`, `sw.js`, `assets/`, `cards/`, `css/`, `js/`, puis **modifie la copie** :

1. `_demo/serveur.js` devient `js/demo-serveur.js`, `_demo/reglages.js` devient `js/demo-reglages.js` ; `js/demo-illu.js` (`window.DEMO_ILLU`, 113 grilles) est extrait de `supabase/installation/21b_illu.sql`.
2. La balise supabase-js est remplacée par ces trois scripts (chargés **avant** `config.js`) ; `js/supabase-config.js` reçoit de fausses valeurs (`https://demo.invalid`).
3. `vPorteAttente()` (`js/gate.js`) commence par `return demoPorte()` ; les trois fichiers entrent dans `ESSENTIEL` (`sw.js`).

**Avec `--preprod`** (sortie : `preprod/`) :

- `noindex` ; un script qui **préfixe tout le stockage par `preprod:`** (`Storage.prototype.getItem/setItem/removeItem/clear`) ; la base IndexedDB devient `premier-lobby-preprod` : la pré-prod ne lit ni n'écrase rien du vrai site, qui partage l'adresse.
- Titre `PRÉ-PROD 3.0.x`, bandeau « Pré-prod · démo, rien n'est réel », noms du manifeste.
- **Pas de service worker** (`brancherSW` commence par `return;`, `sw.js` supprimé). **Mais celui du vrai site (portée racine) contrôle aussi `/preprod/`** et sert les médias depuis son cache : c'est pourquoi `demo.py` ajoute `?v=<version>` à chaque `assets/…` cité dans les CSS, JS et HTML (pas à `cards/`).
- Le visiteur est administrateur (Labo ouvert).

**Sans option** : la démo autonome, dans `_build/m8tcg-demo/` et `_build/m8tcg-demo.zip` (ignorés par git), avec `_demo/LISEZMOI.txt`.

`remplacer()` **arrête la construction** si un motif attendu est introuvable. S'il apparaît plusieurs fois, seule la première occurrence est remplacée, sans avertissement (`count=1`). Les chaînes qu'il cherche (la balise supabase-js, `function vPorteAttente() {`, `'js/app.js',` dans `sw.js`, `<head>`, `<title>`, `<body`, `indexedDB.open('premier-lobby'`, `function brancherSW() {`, le nom du manifeste, la création du profil dans `serveur.js`) sont des **contrats** et doivent rester uniques.

### 11.2 Le faux serveur (`_demo/serveur.js`)

- Il définit `window.supabase = {createClient: () => client}` : **le code du jeu croit parler à Supabase**. Il implémente les **58 mêmes RPC**, avec les mêmes noms, paramètres et messages d'erreur, et `from('shop_items')`.
- **Un appel** (`appeler`) : charge l'état, refuse `'non connecte'` sans session, copie l'état, fait vivre les bots, exécute `RPC[nom](MOI, args)`, sauvegarde, attend 60 à 150 ms. **Une exception annule tout l'appel** (bots compris). Un refus s'écrit `refuser('…')` (jamais un `throw` brut : sur `me`, il déclencherait la recréation du monde).
- **Stockage** : l'état entier `S` dans IndexedDB (`kvSet('demo-serveur', S)`). Le seul numéro de schéma est `S.v === 1` : **ne jamais le changer** (cela effacerait toutes les parties). Les ajouts se font dans `completer()` (`S.x = S.x || …`) ou dans une fonction `mondeXX()` idempotente.
- **Il ne lit rien du jeu au chargement** (il est chargé avant `config.js`) : seulement à l'intérieur de fonctions (`cards`, `byId`, `Decks`, `Combat`, `IA`, `RAID`, `CHOC`, `niveauDe`, `recompenseNiveau`…).
- **Session** : connecté sauf si `localStorage['mtcg.demo.connecte'] === '0'` ; « Discord » pose `'1'`. **`?reinitialiser`** efface l'état du faux serveur (pas le `localStorage` du client : tutoriel vu, accueil, etc.).
- **Réglages** (`_demo/reglages.js`) : pseudo `Visiteur`, 6 000 Éclats, `ticket_minutes` 240, `raid_echelle` 0,25. Pseudo et Éclats ne valent que pour un monde neuf ; le rythme et l'échelle du Raid s'appliquent tout de suite.

### 11.3 Le monde de démo

- **Quatre bots** : Lumen (`f_or`, ami), Mira (`f_rose`, amie), Kairo (`f_azur`), Nova.92 (`f_prisme`, gagnant de la chasse : il porte `f_unique`). Leurs collections viennent de vrais tirages. Ils font leur check-in, acceptent une demande d'ami (6 à 20 s) ou d'échange (12 à 40 s ; le premier échange possible est toujours accepté, les suivants 3 fois sur 4), proposent des échanges, acceptent et jouent tes défis (IA niveau 3 ; `defi_fin` **rejoue** la partie, contrairement au vrai serveur), te défient une fois, frappent le Raid toutes les 30 s environ, tentent l'Épreuve. **Ils ne vivent que page ouverte** (minuteur de 4 s).
- **Événements** : `monde20()` crée Reflets, puis `monde30()` le remplace par **le Choc, commencé 4 jours avant la première visite en 3.0 et prévu pour 21 jours**. Au-delà (17 jours plus le récap de 3), plus d'événement : seul `?reinitialiser` le relance. Un seul `S.evenement` à la fois.
- **Raid** : `mondeRaid()` inflige 102 dégâts à la saison courante (avec `raid_echelle` 0,25 : deux phases tombées, la troisième en cours). Le Raid suit le vrai calendrier : une nouvelle saison repart à zéro.

---

## 12. Outils, sources et visuels

### 12.1 Les outils

| Commande | Dépendances | Produit |
|---|---|---|
| `python3 tools/version.py X.Y.Z` | aucune | `APP_VERSION`, `VERSION` du service worker, `?v=` d'`index.html` / `verif.html`, liste `ESSENTIEL` |
| `python3 tools/demo.py [--preprod]` | aucune | `preprod/` ou `_build/m8tcg-demo(.zip)` |
| `python3 tools/build-sql.py` | aucune | `supabase/TOUT.sql` |
| `tools/tester-sql.sh [tests.sql…]` | PostgreSQL 16 | joue la production puis `TOUT.sql` deux fois sur une base locale ([§ 2.3](#23-tester-le-sql-sur-un-postgresql-local)) ; `tools/sql-stub.sql` imite Supabase |
| `python3 tools/equilibre-fragments.py [joueurs] [jours]` | aucune | les Fragments gagnés par semaine et la fréquence d'une carte : la base du barème de la maîtrise |
| `python3 tools/gen-cards-sql.py` | aucune | `supabase/installation/02_cards.sql` |
| `node tools/illu-pixels.js` | Node, Playwright (Chromium) | `supabase/installation/21b_illu.sql` (puis `build-sql.py` et `demo.py`) |
| `node tools/combat-tests.js` | Node | les tests de règles |
| `node tools/combat-sim.js <mode> N …` | Node | parties simulées (`aleatoire`, `clone`, `ia`, `starters`) |
| `python3 tools/cadres.py` | aucune | les 7 cadres SVG de la 2.0 (`assets/cadres/`) |
| `python3 tools/cadres-30.py` | aucune | les 9 cadres SVG de la 3.0 |
| `python3 tools/cosmetiques.py` | Pillow (AVIF) | 6 tapis (+ `-mini`), 2 sleeves, 2 boîtes de Starter, **les 5 Secrètes dans `cards/`** |
| `python3 tools/choc-visuels.py` | Pillow (AVIF) | 2 affiches du Choc, tapis `t_arene` et `t_orage`, sleeve `s_choc` |
| `python3 tools/gen-icons.py` | **macOS** (`sips`) | icônes d'app, favicons, `og-image.png` (palette **2.1**, pas refaites en 3.0) |
| `python3 tools/kit-presse.py` | Pillow | `presse/visuels/*` |

L'environnement cloud a Python 3 avec Pillow (AVIF), Node 22, Playwright et Chromium, `http-server`, PostgreSQL 16 ; pas `sips`.

### 12.2 Les sources (`_sources/`, branche de travail seulement)

| Source | Script | Sortie |
|---|---|---|
| `combat/brawks-deter.jpg` (1490 × 1055) | `choc-visuels.py` | `choc-deter.webp`, haut de `t_arene` |
| `combat/secrete-123.jpg`, `secrete-125.jpg` | `cosmetiques.py` | les deux Secrètes révélées |
| `combat/secrete-floue-a/b/c.jpg` | `cosmetiques.py` | les trois Secrètes floutées |
| `combat/sleeve-argent.jpg`, `sleeve-sorcier.jpg` | `cosmetiques.py` | `s_argent`, `s_sorcier` |
| `combat/starter-deter.jpg`, `starter-toxique.jpg` | `cosmetiques.py` | `assets/combat/sections/*.webp` (détourées) |
| `combat/tapis-*.jpg / .webp` (6) | `cosmetiques.py` | `assets/combat/tapis/t_*.webp` |

Les autres visuels partent des cartes elles-mêmes (`cards/`). `assets/combat/banniere-combats.webp` est faite à la main (aucun script).

### 12.3 L'habillage (`assets/`)

- `cadres/` : 16 SVG animés (7 de la 2.0 + 9 de la 3.0), branchés par `.ava.fx-<id> .fx-deco` dans `css/reflets.css` et `css/choc.css`.
- `combat/` : `tapis/` (8 + `-mini`), `sleeves/` (3), `sections/` (2 boîtes), `choc-toxique.webp`, `choc-deter.webp`, `banniere-combats.webp`.
- `boosters/booster-01…04.webp` (`PACK_ARTS`), `essences/*.svg`, `card-back.webp`, `logo-m8.webp`, `extension-logo.svg`, `favicon.svg`, `pack-star.svg`, `star-pink.svg`, `1st-edition.svg`, `jeton-echange.webp` ; icônes PNG générées.

### 12.4 Les images des cartes

- `cards/NNN_RAR_Catégorie[-SousType]_Couleur_Nom.avif` (1000 × 1397), `NNN` de 001 à 127 ; Secrètes cachées `NNN_S_Secrete.avif`. Le nom ne se découpe pas sur `_` (certains noms en contiennent).
- `cards/promos/PNN-Nom.webp` (640 × 880 ; P03 et P04 n'ont pas d'image) ; `cards/uniques/U01-L_Unique_Chevaliere_v2.webp`.
- Le gabarit d'une carte (1000 × 1397) a son illustration de (85, 205) à (895, 684) : c'est ce qu'utilisent `illuCadre()` (`js/ui.js`) et `tools/choc-visuels.py` (`ILLU`) pour recadrer une illustration.

### 12.5 Le kit presse (`presse/`)

`presse/README.md` (mode d'emploi, ordre de publication, textes), `presse/visuels/` (6 PNG et 2 GIF composés par `tools/kit-presse.py`), `presse/visuels.html` (les mêmes visuels en HTML, `?v=N`), `presse/polices/` (Archivo, Figtree, sous licence SIL OFL). Le kit date de la 2.x.

---

## 13. Pièges

Ce qui a déjà coûté du temps, ou en coûtera. Chaque point renvoie à sa section.

**Production et branches**

1. **Rien de la 3.0 sur le vrai site** : le travail 3.0 ne touche que `preprod/` sur `main`, aucun SQL 3.0 en production. **Ne jamais fusionner `version-3.0` dans `main`.** Une évolution de la 2.x se fait sur une branche partie de `main`, publiée seulement avec l'accord du propriétaire.
2. La racine de la branche parle au **vrai** Supabase (clés réelles dans `js/supabase-config.js`) : on n'y voit que « Projet annulé ». La 3.0 se teste dans `/preprod/` ([§ 2.1](#21-servir-le-site-en-local)).
3. La branche `main` locale peut être en retard : toujours comparer avec `origin/main` après un `fetch`.
4. `preprod/` est **construit** : on modifie `js/`, `css/`, `_demo/`, puis `python3 tools/demo.py --preprod`. Une retouche faite dans `preprod/` est écrasée à la prochaine construction.
5. Ajouter un `.nojekyll` sur `main` publierait `_demo/` et `_sources/`.

**JavaScript**

6. **Un seul espace global** : un `const` / `let` qui reprend le nom d'un autre `const`, `let` ou `function` au niveau d'un script = `SyntaxError`, et tout le second fichier est ignoré. Deux `function` de même nom ne lèvent **rien** : la seconde remplace la première sans prévenir. Le code exécuté au chargement doit trouver ses dépendances déjà chargées (ordre d'`index.html`).
7. **`save` est reconstruit à chaque `pull()`** : n'y ranger aucun état d'interface ; ne pas garder de référence à `save.col` ; les comparaisons avant / après se font dans `Backend.apply`.
8. **`data-tab` est traité avant tout le reste** dans `clicPage` : un élément qui porte `data-tab` et un autre attribut voit l'autre ignoré, sauf `data-colvue`, lu juste avant `aller()` (lien vers une vue précise de la Collection). Ne jamais mettre `data-tab` sur `<body>`. Un nouvel attribut `data-x` doit être ajouté au sélecteur `closest()` de `clicPage`. Un `data-act` posé dans la fiche (`#viewer`) ou le théâtre n'est pas traité par `clicPage`.
9. **On défile `#main`**, jamais `window` (`body` est en `overflow:hidden`).
10. **Un champ de saisie** doit être rebranché dans `bindReglages()` et déclaré dans `enTrainDEcrire()`, sinon un rafraîchissement de fond lui vole le focus.
11. `brancherSW()` reste **avant** le premier `await` du démarrage ; `lireErreurRetour()` **avant** `Backend.init()`.
12. **Mouvement réduit** : `RM()` ne lit que la préférence système. Une animation en JS teste `RM()` **et** `document.documentElement.classList.contains('rm')`.
13. `h()` échappe le HTML et remplace l'espace qui suit `«` et celle qui précède `»` par une espace insécable : en tenir compte pour comparer des chaînes.
14. `toutesCartes()` n'inclut pas les Secrètes.

**CSS et DA**

15. Pas de couleur en dur quand un jeton existe ; verre seulement sur ce qui flotte, jamais de flou sur du verre ; toute nouvelle classe de verre entre dans **les deux listes de repli** de `base.css` ([§ 5.6](#56-les-matières)).
16. `#main > *` est centré par `margin-inline: auto` : un `margin` raccourci en style en ligne le décentre.
17. En 3D (`preserve-3d`), `mix-blend-mode` ne s'applique pas et un `filter` sur l'enveloppe floute la carte.
18. Ne pas toucher `.sheet::before` sans lire `js/ui.js` (il détecte l'ordinateur par son `display`). Plusieurs sélecteurs reposent sur `:empty` : le JS ne doit pas y laisser d'espaces.
19. Le lien Google Fonts d'`index.html` ne charge Archivo en italique qu'en 700–900, et Figtree qu'en 400, 600, 700 et 800 : toute autre graisse (Figtree 500 ou 900, par exemple) est simulée par le navigateur.

**Cache et versions**

20. **Une image retouchée sous le même nom reste l'ancienne** chez les joueurs (le service worker garde les médias jusqu'à la prochaine version). Donner un nouveau nom, ou changer de version. En pré-prod, seuls les `assets/` reçoivent `?v=`, pas `cards/`.
21. `?v=` des CSS / JS = `VERSION` de `sw.js` : passer par `tools/version.py`, **avant** `demo.py` (qui relit la version).
22. Un nouveau fichier JS ou CSS : l'ajouter à `index.html` puis lancer `version.py` (qui régénère `ESSENTIEL`), sinon le démarrage hors réseau casse.

**Serveur**

23. **Ne jamais éditer** `TOUT.sql`, `02_cards.sql`, `21b_illu.sql` (générés).
24. **Ne jamais ressortir de l'historique git** les anciennes mises à jour `13`, `16`, `17`, `19`, `20` (supprimées en 3.0.8) : elles réinstallent d'anciennes versions (`17` supprime les quêtes 2.0 / 3.0 et leur progression), malgré leurs en-têtes « rejouable sans danger ».
25. Rejouer `03_rpc.sql` ou `06_social.sql` seul remplace `me()` / `player_profile()` par des versions tronquées : toujours rejouer `TOUT.sql`.
26. Une carte créée ailleurs que dans `02_cards.sql` doit être `promo = true`, sinon le ménage de `02` la supprime avec tous ses exemplaires.
27. Les listes `delete … not in (…)` de `04_seed.sql` : un identifiant oublié efface la quête ou l'article, et sa progression.
28. Toute règle a trois copies ([§ 9.8](#98-une-règle-plusieurs-copies)).
29. `revoke … from public` sur chaque nouvelle fonction ; les messages d'erreur sont en français et montrés tels quels.
30. Une installation neuve lance Reflets pour 14 jours ; l'administrateur lui-même doit être dans `beta_invites`.

**Pré-prod**

31. Dans `_demo/serveur.js` : rien lu du jeu au niveau du module ; `refuser()` plutôt que `throw` ; ne jamais changer `S.v`.
32. Le Choc de la démo expire (21 jours après le début, posé 4 jours avant la première visite) ; les bots ne vivent que page ouverte.
33. Le préfixe `preprod:` ne réécrit que `getItem`, `setItem`, `removeItem`, `clear` : `key()` et `length` voient aussi les clés du vrai site.

**Combats et événements**

34. **Déterminisme** : aucun `Math.random` ni `Date` dans le moteur et les effets ; l'état reste du JSON sans référence.
35. Une action doit être **exactement** l'une de `optionsTour` (`chevaliere` n'existe que s'il vaut `true`).
36. Pendant une animation, `T.E` est déjà à l'état final : dessiner `vue()`, décider sur `T.E`.
37. Tout nouveau `but` de décision doit être connu de l'IA **et** de l'interface.
38. Le tutoriel dépend des classes de l'arène : le rejouer après toute retouche de `table.js` / `arene.css`.
39. Un défi ne tolère aucun trou dans la numérotation des actions (« Actions désynchronisées »).
40. Ne jamais réutiliser un code d'événement ; ne pas chevaucher un événement sans code et un événement codé.

---

## 14. Dette connue

État au moment de l'écriture. Ce qui est corrigé sort de cette liste dans le même commit.

### 14.1 Bugs

- **Échanger une Secrète est impossible depuis l'interface** (`ouvrirChoixCarte` part de `cards` et `reverses`, `RAR_ORDRE` n'a pas `S`), alors que le serveur l'accepte et que l'interface le promet.
- `titres_de()` range les **tapis** (`t_*`) parmi les titres : `personnaliser` accepte un tapis comme titre (l'interface filtre).
- `set_profile` accepte comme cadre n'importe quel objet d'inventaire ; l'avatar n'est pas borné en longueur.
- `RM()` ignore le réglage « Animations réduites » du jeu : particules, gyroscope et vibrations n'en tiennent pas compte.
- `localStorage['mtcg.jeu']` a deux écrivains (Réglages écrit tout `JEU`, l'arène seulement `rapide`) : changer un réglage peut restaurer l'ancienne vitesse de combat.
- Les raccourcis du manifeste (`?onglet=boosters`, `?onglet=collection`) ne sont pas lus : les deux ouvrent Boosters.
- La pastille de l'onglet d'événement n'allume pas l'alerte de l'avatar (`pastilleTiroir` ne compte que les onglets `tiroir`).
- `brand()` et `majSignalBoite()` réécrivent `document.title` : le titre « PRÉ-PROD » disparaît.
- L'avertissement « Nouvelle version » peut remplacer une feuille ouverte.
- Combat : `resoudre` pose `X.vaincu = true` avant `vaincre()` (un Joueur sauvé par Invitation reste « vaincu » pour Target Missed) ; un `defiJouer` perdu fait avancer le compteur local quand même.
- `deck_sauver` ignore les cartes prêtées (impossible d'enregistrer une copie d'un Starter sans en posséder les cartes) ; `deck_erreur` ne refuse pas une Secrète cachée.
- Les deux ordres de repli de rareté (`pickFrom` / `pick_card`) diffèrent.

### 14.2 Code mort

Le gros du code mort a été retiré en 3.0.8 (navigation, données, combat, événements, CSS ; détail dans l'historique git, commits « code mort retiré » et « CSS mort retiré »), après vérification qu'aucun JS, HTML, faux serveur ni outil ne le produisait. Ce qui reste, volontairement :

- **Porte** : `vCompteARebours`, `ouvrirLaPorte`, `Porte.lancee`, `Porte.reste` ; l'appel `Porte.lire()` au démarrage ne change rien. **Mode local et `vAuth`** : inatteignables tant que `PORTE.active` vaut `true`. Gardés : c'est l'architecture du jour où le jeu rouvrirait.
- **Données** : la branche des **talents** (une attaque sans coût) est vivante dans le code (`k.talents`, lu par l'arène et la fiche) mais aucune carte n'en a ; `PROMOS_A_VENIR` est vide mais c'est un réglage ([§ 6.2](#62-données-et-images)) ; `profil.bonus_offerts` est envoyé par le serveur (`07_vitrine.sql`, `_demo/serveur.js`) et lu par personne. `Backend.erreur` n'est lu que par l'écran d'entrée de la démo (`demoPorte`, `_demo/serveur.js`) : ne pas le supprimer.
- **SQL** : `cfg('pack_size')`, `cfg('shards_per_dup')`, `recyclage_semaine()` / `debut_semaine()`, la branche `'legendaire'` d'`accorder`, `choc_joueurs.victoires`, les critères de classement non affichés, l'effet de boutique `refill` (plus aucun article ne s'en sert ; retiré côté client).
- **Combat** : trois copies du même mulberry32 (moteur, IA, campagne), une vingtaine d'exports jamais appelés de l'extérieur. `CB_ALIAS` n'est **pas** mort : la boîte de réception ouvre encore `defis` pour un défi reçu.
- **Événements** : `montrerNouveautes21` et les boutons `t-v2-*` du Labo (joignables, ils rejouent les fenêtres de la 2.0).

### 14.3 Écarts à la DA

- `--cta` réécrit en dur 16 fois ; `#5d4bd9`, `#c8bfff`, `#16151e`, `#121119`, `#b3a6ff`, `#ff6b6b` réécrits au lieu de leurs jetons ; le vert de réussite de l'arène est `#8ff0c8` et non `--ok`.
- Restes de la palette 2.x (`#b38cff` surtout dans `reflets.css`, `rgba(154,115,255,…)`, le dégradé rose de `.colpct`) ; couleurs de rareté hors jetons dans l'ouverture, la fiche, le podium, les succès.
- Le « choisi » en lavande au lieu du blanc (`.cb-acte-ong.on`, `.filpuce.on`, `.rf-onglets .on::after`…) ; l'or hors des récompenses (`.dk-etoiles`, `.labalerte`…) ; trois roses différents pour le cœur favori ; le vert de Toxique n'est pas le même partout (et `f_toxique` est décrit « rose » dans la boutique).
- Icônes d'app, favicons et image de partage encore à la palette 2.1 (`tools/gen-icons.py`, qui exige macOS).

### 14.4 Documentation et commentaires périmés

`SETUP.md`, `docs/`, le kit presse, `verif.html`, le LISEZMOI de la démo et les commentaires de code signalés ici ont été remis d'accord avec le code en 3.0.8. Reste :

- **`04_seed.sql`** : les médianes de simulation en tête du fichier (boosters pour 25 / 50 / 75 / 90 / 100 % de la collection) datent du booster de la 1.x et n'ont pas été recalculées (l'en-tête le dit).
- **Mise en page** : en passant les chemins à `supabase/installation/`, une cinquantaine de lignes de commentaire dépassent 90 caractères (rien de faux, seulement long).
- `docs/design-3.0.md` reste un journal de conception, version par version : ses premières sections décrivent ce qui a été changé depuis (il le dit à chaque fois). Ce README fait foi.

### 14.5 Pistes non engagées

- Montrer la maîtrise de l'adversaire en Versus (il faudrait l'envoyer avec le défi).
- Mesurer l'économie réelle (maîtrise, combats) une fois le jeu ouvert.
- Rendre les Secrètes échangeables depuis l'interface (le serveur l'accepte déjà).

---

## 15. Historique des versions

| Version | Date | Ce qu'elle a apporté |
|---|---|---|
| **1.0** | 22 sept. 2026 | Boosters, Collection, Social (amis et échanges), Quêtes, Profil, Boutique, Réglages ; l'onglet Combats annoncé « à venir ». |
| 1.x | 23–28 sept. | Feuilles qui se ferment d'un glissé ; **connexion Discord obligatoire, plus de jeu hors ligne** ; le 24 septembre, **le lancement public est annulé** (écran « Projet annulé · Merci ») ; démo autonome ; recyclage rééquilibré, quêtes de raretés complètes, classement global. |
| **1.5** | 3 oct. | Fragments (le recyclage ne paie plus en Éclats), fabrication, Essences Brillantes, succès, historique des tirages, partage d'un booster, **chasse à la carte unique** ; puis cadeaux d'administrateur et boosters offerts ou achetés **hors réserve**. 1.5.8 : teaser de la 2.0. |
| **2.0 « Reflets »** | 8 oct. | **Reverses**, Collection en trois vues, titres / bannière / devise, cadres décorés animés, l'événement Reflets (Prismes, Pass, boutique, récap), **Devine l'illu**, invitations, « Chez tes amis » ; la pré-prod à `matetcg.com/preprod/`. |
| **2.1** | 9 oct. | Exemplaires **à garder** (par rareté et par carte), **favoris**, quêtes « Dix fois la même ». 2.1.1 : un invité n'invite pas à son tour. |
| **2.1.2** | 13 oct. | Cadre Maître refait, flèche du menu, pastille Devine l'illu, cadrage de l'app installée. **C'est la version en production.** |
| 3.0.0 – 3.0.1 | 11–12 oct. | Pré-build : moteur de combat, effets, IA, règles reconstituées, arène, onglet Combats, atelier, guides, défis, cosmétiques ; Secrètes et nouveaux taux ; l'événement « Le Choc des Sections » (Raid, Épreuve du jour, Pass) ; XP et niveaux ; SQL `23`–`26`. |
| 3.0.2 – 3.0.4 | 12 oct. | Refonte visuelle complète, puis la palette **« Graphite et lavande »** (verre réservé à ce qui flotte) ; la « Guerre » des Sections et la première maîtrise retirées ; la pré-prod ne reste plus bloquée sur « Merci ». |
| 3.0.5 | 12 oct. | Onglet Combats refait (bannière du Chevalier, portes Solo et Versus, campagne en chemin, Arcade) ; Raid permanent ; événement refait (bannière, Nouveautés, Pass et boutique rééquilibrés). |
| 3.0.6 | 13–14 oct. | **Raid par saisons et phases** (`27_raid.sql`) ; **tutoriel jouable** ; Guide en glossaire ; IA sans coups au hasard (mesurée) ; Decks avec bilan ; Classement Niveau / Secrètes / Versus ; bannière Squeezie le Toxique contre Brawks Déter, sans VS ; Insignes renommées **Étincelles** ; cadres 3.0 redessinés ; le Labo montre tout. |
| **3.0.7** | 14 oct. | **Maîtrise des cartes** (`28_maitrise.sql`) et **carte fétiche** ; fiche de carte en trois pages (Infos, Maîtrise, Gérer) ; arène : carte agrandie intacte avec son état dessous, Joueur engagé qui ne pivote plus, animations rejouées depuis l'état de chaque instant, flèche de visée, touchers iOS ; tutoriel réécrit et vérifié dans Chromium (390, 375, 360) ; récap de booster sans défilement, pastille Boosters, niveau dans l'en-tête, Classement à quatre critères. |
| **3.0.8** | 14–15 oct. | **README réécrit de zéro** et `CLAUDE.md` ; bandeau et tapis « Le Choc des Sections » recadrés sur Brawks Déter, Nouveautés sans « Deux Sections » ; tapis et cadre du Sorcier dans la même colonne de la boutique du Choc ; « Apprendre d'abord » ouvre le Guide ; liens `data-colvue` réparés ; cadres Arène sans plaque « NIV » ; **carte fétiche** refaite dans la DA ; **maîtrise refaite** (barème par rareté, effets sans voile, un joyau à la place de la couronne, fiche qui tient sans défiler) ; arène : **zone de détails** au-dessus de son camp pour sa main et ses Joueurs, **fantôme de la carte** dans les places libres à la place du « + » ; **dépôt rangé** (SQL en `installation/` et `administration/`, remises à zéro réécrites pour la 3.0 et protégées par un garde-fou, mises à jour historiques supprimées, code et CSS morts retirés, `SETUP.md` et docs remis d'accord avec le code) ; solde du Choc à jour après un achat. ; branches rangées : la branche de travail s'appelle désormais `version-3.0`. |

**Choix d'interprétation de la 3.0.7, à connaître** : « Éclats » dans la demande sur la maîtrise a été lu comme **Fragments** ; le conflit entre exemplaires et decks est résolu par les exemplaires **en trop** seulement (le manque se paie en Fragments) ; la carte fétiche est distincte de la vitrine ; le Classement est réduit à quatre critères. Non vérifié sur un vrai appareil iOS (zones sûres, glissé des pages de la fiche).

**Choix d'interprétation de la 3.0.8, à connaître** : « les cartes joueurs dans notre main ne sont pas adaptées au nouvel affichage » a été lu comme **l'affichage d'une carte touchée** (la carte en grand de la 3.0.7, qui laissait un vide à côté d'une carte de la main), et « garder la zone de détails aussi de nos 3 emplacements » comme **la zone de détails de la 3.0.6, pour la main et pour ses Joueurs posés, son camp restant visible** ; la main elle-même (l'éventail en bas) n'a pas changé. « Le cadre et le tapis dans la même colonne » de la boutique du Choc a été pris à la lettre : l'un sous l'autre dans la grille à deux colonnes. L'équilibrage de la maîtrise repose sur une **simulation** (`tools/equilibre-fragments.py`), pas sur des données réelles. Non vérifié sur un vrai appareil iOS.
