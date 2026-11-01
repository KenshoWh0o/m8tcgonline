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
| **`main`, à la racine** | **Le vrai site**, servi à `matetcg.com` par GitHub Pages (`CNAME`). La 2.5, publiée le 25 octobre 2026 (`e9f0c36`) et sortie d'elle-même le lundi 26 octobre à 0 h, heure de Paris (README de la 2.x, « La sortie datée » ; aucune session n'a encore vérifié le site après cette minute : feuille de route, § 6). | **2.5** |
| **`main`, dossier `prebuild/`** | La démo de la prochaine 2.x, construite depuis `version-2.5` et servie à `matetcg.com/prebuild/` (faux serveur, comme la pré-prod). | 2.5 (Labo refait) |
| **`main`, dossier `preprod/`** | La pré-prod : une copie *construite* de la 3.0, servie à `matetcg.com/preprod/`, qui tourne avec un **faux serveur** dans le navigateur (aucun compte, aucune base). | 3.0.x |
| **Branche de travail `version-3.0`** | Le **code source** de la 3.0, à la racine. `preprod/` y est aussi versionné : identique à `main` juste après une publication, en avance entre deux (`git diff --stat origin/main HEAD -- preprod`). | 3.0.12 |
| **Branche `version-2.5`** | La **ligne 2.x** (le vrai site), avec son propre `README.md` et son `CLAUDE.md`. Elle ne se publie à la racine de `main` qu'avec l'accord du propriétaire. Elle remplace `claude/interface-ux-fixes-o92u4a` et `teaser-2.x`, toutes deux contenues dans `main` et à supprimer par le propriétaire. | 2.5 |
| **Base Supabase de production** | `supabase/MAJ-2.5.sql` de la 2.x, collé par le propriétaire le 25 octobre 2026, puis ses fins de ligne Windows corrigées : identique à une installation neuve de `version-2.5` (README de la 2.x, « La mise en ligne »). **Aucun SQL 3.0 n'y a été joué.** | 2.5 |

**État du projet.** Le 24 septembre 2026, le lancement public a été **annulé** après échange avec Gentle Mates (`vAnnonceArret()`, `js/gate.js`) : l'écran d'entrée du vrai site affiche « Projet annulé · Merci ». Les comptes déjà invités jouent toujours à la 2.x : la 2.5, sortie le 26 octobre 2026, avec L'Échauffement (jusqu'au 4 novembre à 0 h, puis son récap jusqu'au 7 et un défi par jour, « le mode sans fin », jusqu'à la 3.0). Le développement de la 3.0 continue **uniquement en pré-prod** ; sa date de sortie n'est pas fixée. **La feuille de route** ([`docs/feuille-de-route.md`](docs/feuille-de-route.md), copie identique sur `version-2.5`) dit ce que le propriétaire a prévu pour la 2.5 et la 3.0, et ce qui doit passer de la 2.x à la 3.0.

**Conséquence pratique.** On développe sur la branche, on construit `preprod/` avec `python3 tools/demo.py --preprod`, et on ne reporte **que `preprod/`** sur `main` ([§ 2.5](#25-construire-et-publier-la-pré-prod)). **La branche ne se fusionne jamais dans `main`** : sa racine est la 3.0, qui appelle des RPC absentes de la base de production.

### 1.3 Les règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Le travail sur la 3.0 ne touche que `preprod/` sur `main`, et aucun SQL 3.0 n'est joué sur la base de production. Le vrai site (la 2.x) peut, lui, évoluer à la demande du propriétaire : on travaille alors sur la branche de la ligne 2.x (`version-2.5`), et on ne publie qu'après son accord. Ce qui change dans la 2.x et n'est pas propre à elle se **reporte dans la 3.0** ([`docs/feuille-de-route.md`](docs/feuille-de-route.md), § 5).
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

1. Lire ce README en entier, puis [`docs/design-3.0.md`](docs/design-3.0.md) avant de toucher à un écran, et [`docs/regles-3.0.md`](docs/regles-3.0.md) avant de toucher aux combats. Dans Claude Code, `CLAUDE.md` les importe tous (`@README.md`, `@docs/…`) : ils sont déjà dans le contexte, mais il faut les lire.
2. `git fetch origin` : la branche `main` locale peut être en retard sur `origin/main`. Toujours comparer avec `origin/main`.
3. `node tools/combat-tests.js` : les tests de règles doivent tous passer.
4. `python3 tools/demo.py --preprod`, puis servir le dépôt ([§ 2.1](#21-servir-le-site-en-local)) et ouvrir `/preprod/` : c'est là que la 3.0 se teste.
5. Regarder [§ 14](#14-dette-connue) : ce qui est connu pour être faux ou mort.
6. Si le travail touche à `main` (la racine ou `prebuild/`), lire aussi le `README.md` et le `CLAUDE.md` de la ligne 2.x : `git show origin/version-2.5:README.md`.
7. Lire [`docs/feuille-de-route.md`](docs/feuille-de-route.md) : ce que le propriétaire a prévu, et le registre de ce qui passe de la 2.x à la 3.0.

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
| `node tools/combat-tests.js` | Les règles du combat, une à une, le tutoriel et l'historique des combats (58 tests en 3.0.13 ; code de sortie 1 en cas d'échec). |
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

Elle démarre un PostgreSQL local (`/var/tmp/pg-m8`, port 5499, laissé allumé), recrée une base `m8`, y joue `tools/sql-stub.sql` (l'imitation de Supabase : rôles `anon` / `authenticated` / `service_role`, schéma `auth`, `auth.users`, `auth.uid()` lu dans `request.jwt.claim.sub`, publication `supabase_realtime`), puis **la base de production** (`supabase/TOUT.sql` d'`origin/main`, la 2.5), puis le `TOUT.sql` de la branche **deux fois** (il doit être rejouable), puis les fichiers de test donnés. Pour l'arrêter : `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg-m8/data stop"`.

**Les tests SQL versionnés** (3.0.12), dans `tools/tests-sql/` : `regles.sql` (le Club de 40, trois exemplaires par nom et couleur, les Starters), `historique.sql` (l'historique des combats : droits, entrées mal formées, plafond de 30, défis, Labo), `godpack.sql` (3.0.13 : trois Épiques, deux Légendaires, une Secrète, avec `god_odds` ramené à 1 le temps du test), `maitrise.sql` (3.0.13 : le barème, les refus sans exemplaire en trop — deck, réglage « garder », échange en attente —, la consommation, les Fragments, la Légende, la Reverse, le Labo), `profil-combat.sql` (3.0.13 : la série de victoires, les decks montrés, ce que la fiche d'un joueur montre de ses combats, les droits), `choc.sql` (3.0.13 : le Choc de deux semaines — Pass de vingt paliers, quêtes, Labo, Épreuve 14/14, le raid suivant le lendemain de la fin), `cartes-13.sql` (3.0.13 : P03, P04 et les Secrètes révélées — le catalogue, les copies, les Starters, la Promo de chaque Section), `abandon.sql` (3.0.14 : un abandon en solo ne compte rien, au Raid une défaite, jamais de quête ; un combat laissé ouvert) ; chacun dit « OK » étape par étape et s'arrête au premier échec :

```bash
tools/tester-sql.sh tools/tests-sql/regles.sql tools/tests-sql/historique.sql tools/tests-sql/godpack.sql tools/tests-sql/maitrise.sql tools/tests-sql/profil-combat.sql tools/tests-sql/choc.sql tools/tests-sql/cartes-13.sql
bash tools/tests-sql/maintenance.sh   # une base 2.5 avec deux joueurs reçoit la 3.0, trois fois (base m8mig)
```

Les tests des versions précédentes (Raid, Épreuve, cosmétiques…) sont restés dans les sessions qui les ont écrits : le README de chaque version dit ce qui a été vérifié.

Jouer en tant que joueur : insérer un utilisateur **avec une adresse e-mail** dans `auth.users` (le profil se crée par trigger), puis inscrire **cette adresse** dans `beta_invites` (`insert into beta_invites (cle) values ('moi@exemple.fr');` : la clé est l'e-mail ou le `provider_id` Discord, jamais l'uuid ; sans cela, tout répond `BETA_FERMEE`). Puis :

```sql
select set_config('request.jwt.claim.sub', '<uuid>', false);
set role authenticated;
select open_pack();
reset role;   -- pour relire les tables (le rôle authenticated n'y a pas accès)
```

### 2.4 Changer de version

```bash
python3 tools/version.py 3.0.13
```

Le script écrit `APP_VERSION` (`js/pwa.js`), accroche à chaque CSS et JS local d'`index.html` et de `verif.html` la marque `?v=3.0.10-<empreinte>` (six caractères tirés du contenu de tous ces fichiers, depuis la 3.0.10, comme la 2.5) et la même dans `VERSION` (`sw.js`), et **régénère la liste `ESSENTIEL` de `sw.js`**. Deux publications de la même version avec un code différent ont donc des adresses différentes ; relancer le script sans rien changer ne change rien. Le lancer en dernier, après toute modification des CSS et des JS. Il ne touche ni `preprod/` (relancer `demo.py --preprod` ensuite), ni `NOUVEAUTES_VERSION` (`js/bienvenue.js`), ni ce README.

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

Pas de date. La feuille de route ([`docs/feuille-de-route.md`](docs/feuille-de-route.md)) prévoit, une fois la date connue : un teasing final sur la 2.x, une **maintenance**, puis la mise à jour. **L'écran de maintenance existe depuis la 3.0.12** ([§ 4.9](#49-porte-bêta-et-connexion)) ; le jour venu, **avec l'accord du propriétaire** (règle 1), dans cet ordre :

1. **Comparer** les fonctions de la vraie base à une installation locale de la 2.5 (elle a déjà été en retard sur le site ; les outils de `tools/maj-2.5/` de la 2.x servent de modèle).
2. **Publier le code de la branche à la racine de `main`.** La base est encore en 2.5 : `porte()` ne donne pas de version, et le site 3.0 montre **l'écran de maintenance à tout le monde** (« La version 3.0 arrive… »), administrateurs compris, sans lire la base. Une page 2.5 encore ouverte chez un joueur continue de jouer sur la base 2.5 : rien n'est mélangé.
3. **Coller `supabase/TOUT.sql`** dans le SQL Editor (il passe sur une base 2.5 sans rien perdre, testé : les dates de la 2.5 et les Reverses ouvertes sont gardées, le Labo de la 2.5 est remplacé par celui de la 3.0). **Une base 2.x qui a des joueurs entre d'office en maintenance** en recevant la 3.0 (table `maintenance`, `01_schema.sql`, testé sur une base 2.5 avec deux joueurs) : `garde_beta()` refuse alors toute action aux non-administrateurs — les pages 2.5 encore ouvertes ne peuvent plus rien écrire —, et le site 3.0 garde l'écran de maintenance pour eux.
4. **Vérifier en administrateur** : sur l'écran de maintenance, « Accès administrateur » (Discord) ; une pastille « Maintenance en cours » rappelle l'état. `verif.html` dit la version de la base et la maintenance.
5. **Lever la maintenance** : Labo › Serveur › Maintenance › « Lever la maintenance ». Chaque écran de maintenance redemande toutes les 30 s et recharge la page de lui-même (après un délai tiré au hasard, jusqu'à 13 s : pas tout le monde à la même seconde).
6. Garder `PORTE` et `beta_lancement()` ([§ 4.9](#49-porte-bêta-et-connexion)) tant que le projet reste fermé, puis ouvrir l'événement (Labo › Serveur › Le Choc, ou la commande en fin de `supabase/installation/25_choc.sql`).

On peut aussi mettre en maintenance avant le jour J, pour l'annoncer avec un message et une heure de retour : seulement une fois la 3.0 en place (le Labo de la 2.5 n'a pas de maintenance). La mise en place d'un serveur neuf est décrite dans [`SETUP.md`](SETUP.md) : une installation neuve n'est pas en maintenance.

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
├── CLAUDE.md              Consignes lues d'abord par les agents : règles du propriétaire (copie du § 1.3 : modifier les deux ensemble), et import (`@…`) de toute la documentation, chargée d'office à chaque session
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
│   │   ├── defis.js       Versus entre amis
│   │   └── historique.js  L'historique des combats, tour par tour (3.0.12)
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
│   ├── installation/      01_schema.sql … 29_labo.sql : les 23 fichiers assemblés dans TOUT.sql
│   └── administration/    admin.sql, beta.sql, reset-profil.sql, reset-tout.sql, fix-crlf.sql : à jouer à la main
│
├── cards/                 Les images des cartes (.avif 1000 × 1397), promos/ et uniques/
├── assets/                Habillage : logos, paquets, essences, cadres, cosmétiques de combat, icônes
├── docs/                  design-3.0.md, regles-3.0.md, economie-3.0.md, feuille-de-route.md (copie identique sur version-2.5)
├── tools/                 Scripts de maintenance (§ 12)
├── _demo/                 Le faux serveur, ses réglages, LISEZMOI.txt de la démo autonome (non publié)
├── _sources/              Images d'origine des visuels générés (non publié)
├── presse/                Kit presse : visuels, polices, mode d'emploi
└── preprod/               La pré-prod CONSTRUITE (ne jamais l'éditer à la main)
```

GitHub Pages passe par Jekyll : les dossiers qui commencent par `_` (`_demo/`, `_sources/`, `_build/`) ne sont pas publiés. Sur `main`, `preprod/`, `presse/`, `tools/` et `supabase/` le sont. `docs/`, `CLAUDE.md` et `_sources/` n'existent que sur la branche (et `docs/feuille-de-route.md`, aussi sur `version-2.5`, donc sur `main`).

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

- **Feuille** : `openSheet({title, body, actions: [{label, fn, primary}], locked})` (`js/ui.js`). `body` est du HTML brut (échapper avec `h()`). L'action `primary` devient un bouton plein, les autres des boutons « ghost ». Sur mobile elle monte du bas et se ferme d'un glissé vers le bas ; sur ordinateur elle se centre. `locked` empêche de la fermer en touchant le fond ou par Échap. **Depuis la 3.0.13, c'est une vraie fenêtre de dialogue** : nommée par son titre (`aria-labelledby="sheet-titre"`), le focus y entre à l'ouverture, Tab et Maj+Tab y tournent en rond, Échap la ferme (et seulement elle : `preventDefault`, que la fiche de carte, le tiroir et l'arène lisent avant de se fermer à leur tour), et le focus revient à ce qui l'a ouverte s'il existe encore.
- **Toast** : `toast(message)` (2,6 s). **Notification** en haut d'écran : `notifQuete()` (quêtes), `notifBoite()` (boîte).
- **Les bandes qui défilent de côté** (3.0.14, fin de `js/ui.js`, styles `bd-*` en fin de `css/base.css`) : toute rangée qui défile horizontalement (filtres de la Collection et de l'atelier, raretés du choix d'une carte d'échange, amis d'un échange, onglets d'un événement, « Aujourd'hui »…) se tire **à la souris** (le clic qui finit un glissé ne choisit rien), défile **à la molette** si elle est basse (72 px au plus ; elle rend la molette à la page une fois au bout ; un pavé tactile qui glisse déjà de côté, et Ctrl + molette, passent tels quels), et montre **un fondu** sur le bord qui cache encore quelque chose (`bd-g`, `bd-d`, recalculés au défilement, au redimensionnement et à chaque rendu de `#main` ou `#sheet`). Les bandes sont trouvées d'après leur style (`overflow-x` qui défile et un contenu plus large) : une nouvelle rangée en profite sans rien ajouter ; pour les fondus, son sélecteur va dans `SEL`. Exclus : les pages d'une fiche de carte (`.vw-pages`), le code SQL du Labo, les champs, et ce qui porte `data-nodrag`. Vérifié dans Chromium (`bandes.js` des sessions) : glissé, molette, fondus, clic après un glissé, clic simple. Sans réglage sur téléphone : le doigt faisait déjà défiler.
- **Fenêtres d'accueil** (`js/bienvenue.js`) : une seule proposition par session, par `quandCalme()` qui attend que l'écran soit libre. Ordre de `proposerAccueil()` : bienvenue, fin de chasse, récap Reflets, récap Choc, nouveautés, Discord. La fenêtre des **nouveautés** se montre une fois par valeur de `NOUVEAUTES_VERSION` (aujourd'hui `'3.0'`) et à l'annonce puis au début d'un événement ; `montrerNouveautes()` choisit la fonction selon la version (le test `=== '3.0'` est écrit en dur).

### 4.9 Porte, bêta et connexion

Deux écrans peuvent remplacer le jeu :

- **la porte** (`vPorte()`, `js/gate.js`, `body.inlock`) : l'écran d'entrée, ou l'écran de maintenance ;
- **la connexion** (`vAuth()`, `js/auth.js`, `body.inauth`).

`etatPorte()` décide :

0. **la maintenance** (3.0.12) : `'maintenance'` si `porte()` ne donne pas de version (la base n'a pas reçu la 3.0 : tout le monde), ou si une maintenance est en cours et que le compte n'est pas administrateur (`maintenanceBloque`) ;
1. `PORTE.active === false` → ouvert ;
2. pas de session en ligne → `'attente'` : l'annonce « Projet annulé · Merci », le lien Discord, « J'ai déjà un accès » (connexion Discord) et Matepedia ;
3. connecté et `save.invite === true` → le jeu ; sinon `'refus'` : la saisie d'un **code d'invitation** (`utiliser_invitation`) et « Changer de compte ».

Avec `PORTE.active = true` (la valeur actuelle, sur `main` comme sur la branche), **`vAuth()` n'est jamais visible** et le jeu sans compte n'est plus atteignable. Côté serveur, `beta_lancement()` vaut `'infinity'` : la bêta est fermée pour toujours ; `garde_beta()` refuse toute action d'un compte qui n'est pas dans `beta_invites`. **Rouvrir le jeu** demanderait les deux : `PORTE.active = false` **et** une date passée dans `beta_lancement()`.

**La maintenance (3.0.12).** Une ligne côté serveur (table `maintenance`, `supabase/installation/01_schema.sql` : `actif`, `message`, `fin` — l'heure de retour prévue, affichée seulement —, `depuis`, `par`). `porte()` (appelable sans compte, `security definer` depuis la 3.0.12) rend aussi `version: '3.0'` et `maintenance` (`{message, fin, depuis}` ou null). Pendant une maintenance, `garde_beta()` refuse toute action du jeu à qui n'est pas administrateur (`MAINTENANCE`) ; `me()` répond toujours. La page lit `porte()` **avant** `me()` (`Backend.init`) : devant une base qui n'est pas en 3.0, elle ne lit pas l'état du compte. **L'écran** (`vMaintenance`, styles en fin de `css/auth.css`) reprend la coquille de l'écran d'entrée (`vCoquillePorte`) : le logo, le paquet qui flotte et, autour, un anneau lavande qui tourne ; « Maintenance », « On revient vite », une barre qui file, le message (ou `MAINT_DEFAUT`), « Retour prévu vers 21 h 30 · dans 1 h 12 » s'il y a une heure, « Suivre sur le Discord », « La page s'ouvrira d'elle-même au retour du jeu », puis « Réessayer maintenant » et « Accès administrateur » (ou le compte connecté et « Changer de compte » ; rien de tel devant une base pas encore en 3.0). Il tient sans défiler aux quatre tailles (mesuré, `#main.scrollHeight − clientHeight` = 0). Il redemande `porte()` toutes les 30 s (`battreMaintenance`) et, à la levée, recharge la page après 1 à 13 s (`finMaintenance`). Un joueur en plein jeu au moment où elle commence y bascule à son action suivante (le refus `MAINTENANCE`, `Backend.rpc`). Un administrateur qui joue voit une pastille « Maintenance en cours » sous l'en-tête, qui mène au Labo. Le Labo l'allume, change son message ou son heure, la lève, et montre l'écran ([§ 10](#10-le-labo-administrateurs)). **Une base 2.x qui reçoit la 3.0 avec des joueurs entre d'office en maintenance** (détecté une seule fois, à la création de la table : pas de `combat_joueurs`, au moins un profil) : voir [§ 2.7](#27-le-jour-dune-sortie-en-production).

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

### 4.13 Accessibilité (état des lieux du 1er novembre 2026, 3.0.13)

Demandé par le propriétaire (« état des lieux sur l'accessibilité et refonte nécessaire en conséquence »). **Comment c'est mesuré** : axe-core 4.10.2, le moteur de référence des audits automatiques, sur 31 vues de la pré-prod (chaque onglet, les sous-vues des Combats, l'atelier, trois onglets du Choc, la fiche d'une carte, l'arène en plein combat), règles WCAG 2.0, 2.1 et 2.2 de niveaux A et AA, au téléphone (390 × 844) et à l'ordinateur (1 280 × 800) ; puis à la main : le clavier, les fenêtres, la refusion à 320 px, les contrastes des jetons. Les scripts sont dans les sessions de travail, pas dans le dépôt.

**Ce qu'axe trouvait avant** (identique aux deux tailles), et ce qui est fait :

| Constat | Gravité (axe) | Correctif |
|---|---|---|
| Le zoom interdit (`maximum-scale=1, user-scalable=no`), sur les 31 vues | critique (WCAG 1.4.4) | retiré d'`index.html` et `verif.html` ; le double toucher ne zoome pas (`touch-action:manipulation` sur `html`) ; au doigt, un champ fait 16 px au moins (sinon l'iPhone zoome dès qu'on le touche) |
| Le chiffre blanc des pastilles sur `#ff5f7e` : 2,9:1 | sérieux (1.4.3) | `--badge` `#d6294a`, le même rose plus profond : 4,9:1 |
| `aria-label` sur des `span`/`div` sans rôle (tentatives du Raid, Essences de l'arène ; et, vus à la main, la difficulté du Raid, les étoiles d'un deck, deux marques du Choc) | sérieux (4.1.2) | `role="img"` (ou `group` pour les Essences) |
| Les sous-onglets du Classement : `role="tablist"` sans onglets | critique (1.3.1) | `normaliserOnglets()` (`js/app.js`), après chaque rendu : dans toute rangée `role="tablist"`, chaque bouton devient un onglet, celui en cours le dit (`aria-selected`), lui seul prend le Tab |

**Vus à la main, corrigés** : les feuilles n'étaient des dialogues que de nom (pas de nom, le focus restait derrière, Tab s'échappait sous la feuille, pas d'Échap) : voir [§ 4.8](#48-feuilles-toasts-notifications-fenêtres-daccueil). Les rangées d'onglets se parcourent aux flèches, Début et Fin (`js/app.js`), et le focus suit l'onglet ouvert d'un rendu à l'autre (`FOCUS_ATTRS`). Le contour du focus vaut aussi pour les liens et les interrupteurs (`label:has(input:focus-visible)`, dans une règle à part : un navigateur sans `:has()` ne perd qu'elle). Le texte blanc du bouton principal descendait à 4,4:1 au milieu du dégradé : `--cta` passe à `#8370f6` → `#5442cf` (4,55:1 au tiers de la hauteur, 5,0:1 au milieu). À 320 px de large (WCAG 1.4.10), seul l'écran Boosters défilait de côté (le halo du paquet, 124vw, transparent sur les bords) : `.packstage{overflow-x:clip}`.

**Après** : axe ne trouve plus rien, sur les 31 vues, aux deux tailles ; à 320 px, aucune des 27 vues mesurées ne défile de côté ; seize vérifications au clavier (une feuille ouverte, Tab, Maj+Tab, Échap, le retour du focus, une feuille verrouillée, une feuille sur la fiche d'une carte, les onglets de la Collection et du Classement) passent toutes.

**Ce qui était déjà là** : `lang="fr"` ; `#toast` en `role="status"` ; `#annonce` (`annonceLecteur()`, `js/utils.js`) pour ce qui se voit sans se dire (une carte ajoutée au deck, les coups du combat) ; `RM()` et le réglage « Animations réduites » ; le combat au clavier ([§ 7.6](#76-larène-jscombattablejs-cssarenecss)) ; un geste de glisser a toujours son équivalent en touchers (poser une carte, fermer une feuille).

**Ce qui reste, et ce qui n'a pas été vérifié** :
- **Aucun lecteur d'écran réel** (VoiceOver, TalkBack, NVDA) n'a été essayé : axe vérifie que les noms et les rôles existent, pas qu'un parcours se comprend à l'oreille. L'arène, très visuelle, est la plus douteuse.
- **Les contrastes posés sur une image ou un dégradé** (le texte des tuiles illustrées, des bandeaux, des cartes) : axe ne sait pas les calculer et les classe « à vérifier » ; ils n'ont pas été mesurés un à un.
- **Le temps limité du Versus** (60 s par tour, sans réglage) : WCAG 2.2.1 en exempte le temps réel « essentiel », ce qu'est un défi en direct ; un Versus en différé (feuille de route, suggestion 1) le rendrait jouable sans chrono.
- **Les flashs** (le godpack, la Légende d'une carte maîtrisée, les secousses) ne sont pas mesurés contre la règle des trois flashs par seconde (2.3.1) ; « Animations réduites » les coupe.
- **Les images des cartes** portent leur texte : la fiche d'une carte le redonne en clair, mais une case de la Collection ne dit que le nom.
- **Le zoom au doigt dans l'arène** n'a pas été essayé sur un vrai téléphone (rien ne l'empêche ; les glisser de cartes restent sur leurs éléments, `touch-action:none`).

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
| `--cta` | `linear-gradient(180deg,#8370f6,#5442cf)` | **Le** bouton principal (un par écran) ; un cran plus profond depuis la 3.0.13 (texte blanc à 4,5:1 au moins) |
| `--brand` | `#ff5f7e` | Le rose de la marque |
| `--badge` | `#d6294a` | Les **pastilles d'attention** (3.0.13 : le chiffre blanc à 4,9:1 ; sur `--brand`, 2,9:1) |
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
| **Rouge** | Attention, adversaire | pastilles `--badge`, `--danger`, `--ar-adv` |
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

**L'en-tête** (3.0.11) : transparent en haut de page ; dès que la page passe dessous (`body.defile`, posé par `majDefile()` dans `js/app.js`), une bande de verre nette, bordée d'un filet, sans transition (on n'anime pas le flou). Avant, un bord flou et dégradé (`mask`) effaçait le haut de la page jusqu'à 26 px sous l'en-tête, « un faded de flou » jugé bizarre sur téléphone.

Où se trouve le verre : `#nav`, le fond de l'en-tête (quand la page défile), `.sheet`, le tiroir, `#toast`, les notifications, les pieds collants (`.at-pied`, `.recpied`) ; dans l'arène, les boutons, la carte agrandie, les feuilles et le journal ; sur les bandeaux illustrés, les petites capsules (`.rf-solde`, `.rf-fin`, `.rf-onglets`).

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
- **Mouvements réduits** : la préférence système (`prefers-reduced-motion`) **et** le réglage du jeu « Animations réduites » (`html.rm`, clé `mtcg.rm`) coupent toutes les animations (règles globales dans `base.css` et `hub.css`). **En JavaScript, `RM()` teste les deux** (depuis la 3.0.11 ; avant, il ne voyait que la préférence système, et particules, gyroscope et vibrations ignoraient le réglage du jeu). Une animation qui doit laisser un état de repos (un reflet posé, des étincelles cachées) le déclare sous `html.rm …` et sous la media query.

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
- **Une couleur nouvelle** : un jeton dans `tokens.css`, documenté dans `docs/design-3.0.md`. Ne jamais réécrire le dégradé du bouton principal : `var(--cta)`.
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
| **Reverses** | `r` + numéro (`r010`…) | 85 | celle de la classique (C, PC, R) | 5ᵉ carte du booster | contre une Reverse | ouverts à la date `parametres.reverses_des` (le 26 octobre 2026 sur la vraie base, posée par la 2.5) ou à la main ; fabrication au prix de leur vraie rareté (400 / 500 / 2 400) | partage celle de sa classique |
| **Secrètes** | `c123`…`c127` | 5 | S (5,5) | le hit, 0,75 % | contre une Secrète | non | oui, sans exemplaire |
| **Promos** | `p01`…`p06` | 6 | PR (6) | boutique, paliers, Sections | non | non | non |
| **Essences Brillantes** | `b001`…`b009` | 9 | BR (7) | case Essence, 1 fois sur 50 | contre une Brillante (3.0.11) | non | non |
| **Carte unique** | `u01` | 1 | UN (8) | la chasse | non | non | non |

- **« 122 » est sacré.** Côté navigateur, le tableau `cards` (`js/storage.js`) ne contient que l'extension : Promos, Reverses et Secrètes vivent dans leurs propres listes (`promos`, `reverses`, `secretes`…). Côté serveur, la table `public.cards` contient **tout**, et c'est `not promo` qui isole les 122 (`check_promos()`, `sync_collection_quests()`, `player_profile`, classement). Les jauges, les paliers Promo et les quêtes de collection en dépendent. Les Secrètes sont **hors de tout total** : depuis la 3.0.11, elles se comptent **au-delà** (« 127 / 122 », comme les cartes secrètes d'un vrai jeu) dans la Collection, le Profil, la fiche d'un joueur (`player_profile` envoie `secretes`) et le récap d'ouverture, mais n'entrent ni dans une jauge ni dans un pourcentage.
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
| P03 | Brawks Déter (la #077 en Promo, même texte) | Rejoindre la Section Déter ; un joueur Toxique la reçoit en finissant sa campagne |
| P04 | Squeezie le Toxique (la #012 en Promo, même texte) | Rejoindre la Section Toxique ; un joueur Déter la reçoit en finissant sa campagne |
| P05 | Tout Commence Ici | 100 % de l'extension (Master Set) |
| P06 | Le Marionnettiste | 75 % de l'extension (`cfg('promo_palier_pct')` = `PROMO_PALIER`) |

P03 et P04 sont les vraies Promos des Starter Decks depuis la 3.0.13 (photos du propriétaire, 1er novembre 2026) ; avant, deux cartes provisoires sans image, et **dans l'autre sens** (P03 pour Toxique) : `combat_section`, la fin de campagne (`combat_fin`), le Labo et la démo (`SEC_PROMO`, avec une migration des parties d'avant) suivent le nouveau sens. Une Promo `provisoire` (sans image, dessinée en texte par `carteTextuelle`) reste possible, sans carte qui s'en serve.

Les paliers ne donnent **que** la carte. `check_promos()` (`supabase/installation/03b_promos.sql`) les accorde, de façon idempotente, depuis `me()` et `open_pack()`. Le champ `obtention` ne sert qu'à l'affichage ; `PROMOS_A_VENIR` (`config.js`) peut réserver des cases « à venir » (vide aujourd'hui).

**Secrètes** : les cinq sont révélées depuis la 3.0.13 — #123 *Le Quatrième du Nom*, #124 *Brawks Trop Déter* (Joueur Violette), #125 *6W26L*, #126 *GP Explorer II* (Moment Instant Neutre) et #127 *Paris Gentle Mates* (Moment Instant Mauve). Leur code s'affiche `#123/122`. Une Secrète `cachee` (nom « Secrète n°NNN », image floutée, pas de texte, injouable) reste possible, sans carte qui s'en serve.

**Les photos redressées (3.0.13)** : les visuels de P03, P04, 124, 126 et 127 viennent de photos du propriétaire (cartes sous pochette ou sous cadre, prises de biais), redressées par `node tools/redresser-photo.js` (une homographie dessinée par Chromium, encodée en WebP par son canvas ; les coins de chaque photo sont dans l'en-tête du script, qui refait les fichiers à l'octet près). Reflets, flou et teinte de l'éclairage restent ; 126 est la plus terne. Un scan propre les remplacera sous un autre nom de fichier (« Images », juste dessous).

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

- **Godpack** : une fois sur 2 000 (`cfg('god_odds')`, `GOD`), **trois Épiques, deux Légendaires et une Secrète**, dans cet ordre (3.0.13, décidé par le propriétaire ; avant : six cartes de la Rare à une Légendaire garantie), sans Essence ni Reverse. La Secrète vient en dernier : c'est elle qui porte la révélation (la plus longue, comme une Secrète tirée en hit). Il n'est **annoncé par rien** : c'est la lumière qui le raconte (paquet qui s'assombrit et tremble, faisceau à la déchirure, nappe dorée ; `packOpen()` lui donne 860 ms de plus).
- **Chasse** : tant que `chasse.active` et que personne ne l'a, l'Unique a une chance sur 250 (`cfg('chasse_odds')`) de **remplacer le hit**. La mise à jour `where gagnant is null` garantit un seul gagnant. Le gagnant reçoit le cadre `f_unique` et une annonce part chez tout le monde.
- **Repli** : si la rareté visée est vide, `pick_card` / `pickFrom` se rabattent sur la plus proche (S sans Secrète → L), dans le même ordre (`REPLI_RARETE`, `booster.js`, et `REPLI`, `_demo/serveur.js`, recopiés de `pick_card` en 3.0.11).
- Le visuel du paquet porte la mention imprimée « Booster de 6 cartes » : changer la taille oblige à refaire les images.

**L'ouverture** (`js/opening.js`, `css/booster.css` bloc « Déchirure », `css/opening.css`) se joue dans **un seul écran sans remplacer le DOM** : `showStack()` monte la pile et le paquet, `packOpen()` déroule la déchirure (délais de base : coupe +360 ms, ouvre +640, sortie de la pile +920, fin +2 050). **Pas de spoiler** : la dernière carte, si elle est rare ou mieux, ne reçoit sa classe de rareté qu'au `doReveal()` (charge R 450 ms, E 800, L 1 150, S 1 500, UN 1 900 — `REVEAL`). Passer : balayage, toucher bref, ou → / Espace / Entrée. Le récap montre la meilleure carte, les nouvelles, le partage. `JEU.recapDirect` (Réglages) saute la révélation.

**Moins d'attente pour qui en ouvre beaucoup (3.0.11)** : la déchirure a un rythme `k` (`rv.k`, et `--rk` sur la scène pour les durées CSS) — 1 pour un godpack (toute la mise en scène), 0,72 pour un booster ordinaire, 0,55 pour celui qu'on enchaîne depuis le récap (« Ouvrir un autre ») ; mesuré dans Chromium : la pile se touche 1,7 s après l'appui (1,4 s enchaîné), contre environ 2,3 s avant. Les pauses forcées raccourcissent (une Reverse 350 ms au lieu de 750, une Brillante 1 s au lieu de 1,6). Il n'y a pas de « Tout ouvrir » : la 3.0.11 en avait un (dix boosters d'un coup, un seul récap), **retiré en 3.0.12** à la demande du propriétaire — un geste qu'on rate du doigt, et chaque booster mérite sa révélation.

### 6.4 La Collection et la fiche de carte

**La Collection** (`js/collection.js`) a trois vues (`colVue`) sous une jauge commune de 223 (122 + 85 + 16) ; le nombre compte en plus les Secrètes possédées (jusqu'à « 228 / 223 », et « 127 / 122 » sur l'onglet Classiques), la jauge et le pourcentage non :

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
| Reverse Commune | 2 | 400 |
| Reverse Peu commune | 5 | 500 |
| Reverse Rare | 20 | 2 400 |

- **Les Reverses** (reportées de la 2.5, `supabase/installation/22c_reverses.sql`) : fermées tant que ni la date `parametres.reverses_des` n'est passée ni `fabrication_reverse` n'est vrai (`reverses_ouvertes()`) ; une Reverse rapporte comme sa classique et coûte `prix_reverse()`. Le calcul de ces prix est en tête du fichier (simulation : `python3 tools/equilibre-reverses.py`). `me()` envoie `parametres.reverses` (`ouvertes`, `des`, `couts`) ; la page (`revOuvertes`, `revCouts`, `revQuand`, `js/recyclage.js`) bascule toute seule à la minute dite (`prochaineBascule`, `js/booster.js`) ; en tête de la Collection › Reverses, la même ligne des Fragments que les Classiques (`vLigneFragments`, `js/collection.js` ; avant l'ouverture, elle dit quand). Sur une installation neuve, la date est vide : fermées. Sur la vraie base, la 2.5 l'a posée au 26 octobre 2026 : quand la 3.0 sortira, elles seront ouvertes.
- Montants : `cfg('recyclage_*')` / `cfg('fabrication_*')` (`01_schema.sql`), envoyés au client par `me().recyclage` ; `REC_DEFAUT` / `FAB_DEFAUT` (`js/recyclage.js`) ne sont que des secours.
- On garde **toujours** un exemplaire, et autant qu'on a choisi d'en garder ; les exemplaires promis dans un échange en attente sont réservés (`recDispo = mesEx − aGarder − réservés`). 150 lots au plus par envoi ; le serveur refuse tout l'envoi si un seul point ne tient pas ; journal `recyclages`.
- Garde-fous de l'interface : « Tout prendre » laisse E et L de côté ; une case à cocher si une E ou une L est sélectionnée ; une dernière confirmation dont le bouton ne répond qu'après 3 s.
- **Pourquoi des Fragments et pas des Éclats** (1.5) : recycler en Éclats créait une boucle (les Éclats rachètent des boosters). Les Fragments n'achètent qu'une carte manquante : pas de boucle, donc pas de plafond. Le calcul est en tête de `12_recyclage.sql`.

### 6.7 La maîtrise et la carte fétiche (3.0.7, refaite en 3.0.8, en 3.0.11, puis en 3.0.13 : l'endgame)

- **Cinq niveaux** par carte : **I Satin, II Reflet, III Holo, IV Lumière, V Légende** (3.0.13 ; II s'appelait Écrin en 3.0.12, Liseré en 3.0.11 ; avant : Éclat, Liseré, Aura, Arène, Légende). Seules les cartes de l'extension (hors Essence) et les Secrètes se maîtrisent ; **une Reverse partage la maîtrise de sa classique** (`carteMaitrise`, `maitrise_carte`).
- **Coût (3.0.13 : l'endgame du jeu, à la demande du propriétaire)** : à chaque niveau, **des exemplaires de la carte, consommés**, et **des Fragments** (la base de la rareté × 1, 2, 4, 7, 11) :

| Rareté | Exemplaires consommés (I → V) | Fragments (I → V) | Total jusqu'à la Légende |
|---|---|---|---|
| C | 2 · 3 · 4 · 5 · 6 | 80 · 160 · 320 · 560 · 880 | 20 exemplaires, 2 000 |
| PC | 2 · 2 · 3 · 4 · 5 | 120 · 240 · 480 · 840 · 1 320 | 16, 3 000 |
| R | 1 · 2 · 2 · 3 · 4 | 250 · 500 · 1 000 · 1 750 · 2 750 | 12, 6 250 |
| E | 1 · 1 · 2 · 2 · 3 | 500 · 1 000 · 2 000 · 3 500 · 5 500 | 9, 12 500 |
| L | 1 · 1 · 1 · 1 · 1 | 800 · 1 600 · 3 200 · 5 600 · 8 800 | 5, 20 000 |
| S | 1 · 0 · 0 · 0 · 1 | 800 · 1 600 · 3 200 · 5 600 · 8 800 | 2, 20 000 |

- **Seuls les exemplaires « en trop » sont consommés** (3.0.14) : au-delà de `max(1, à garder, le plus qu'en contient un de ses decks)`, moins ceux promis dans un échange en attente ; seuls ceux de la classique comptent (`maitriser`, `exemplairesMaitrise`, `RPC.maitriser` de la démo). Jusqu'à la 3.0.13, trois restaient toujours (la limite d'un deck), même pour une carte jouée dans aucun. **Il en manque ? Le niveau attend** : depuis la 3.0.13, un exemplaire ne se remplace plus par son prix de fabrication (`maitriser` refuse, avec le nombre qui manque). **Le barème allégé en 3.0.14** (le propriétaire : « 2 ans pour maxer une secrète c'est un peu too much. Reste raisonnable, tout en rendant la chose assez ardue ») : une Légendaire consomme 5 exemplaires (au lieu de 7), une Secrète 2, aux niveaux I et V (ses niveaux II à IV ne demandent que des Fragments ; la fiche le dit : « Aucun exemplaire à ce niveau ») — **[lecture]** à valider. Simulation (`python3 tools/equilibre-maitrise.py`, `docs/economie-3.0.md` 3 ter) : une fois la collection complète, un joueur régulier mène en Légende une Commune en une semaine, une Rare en trois, une Épique en trois mois, une Légendaire en quatre et demi, une Secrète en six environ (médianes ; le quart le plus lent : un an pour une Secrète) ; les 22 cartes du Starter Toxique, en six mois et demi. La maîtrise avant la collection retarde les 122 de 24 jours en médiane, d'où **un rappel dans la fiche** tant qu'il manque des cartes à l'extension (`.mz-rappel`). Test : `tools/tests-sql/maitrise.sql`.
- **Les finitions (refaites en 3.0.13** : le propriétaire, « l'esthétique ne me plait pas du tout […] les upgrades sont moches » ; avant, la 3.0.8 était « soit trop sobre soit too much et trop cheap », et le liseré de la 3.0.11 « dénaturait » la carte). **La lumière, jamais un trait** : plus aucun cadre ni liseré sur la carte ou autour d'elle, la couleur de l'Essence (`--mc`) n'arrive que dans la lumière. Chaque niveau garde ce que donnent ceux d'avant (`mzDedans`, `mzAutourDe`, `js/maitrise.js` ; `css/maitrise.css`, son en-tête dit tout) :
  - **I Satin** (`.mz-v`) : un vernis — la lumière vient d'en haut à gauche, une bande la traverse toutes les 9 s (au I seulement : dès le II, la fenêtre du reflet passe déjà) ;
  - **II Reflet** (`.mz-f`) : l'illustration sur une feuille de métal. Un calque en `color-dodge` sur le haut de la carte (fondu en haut et en bas) : une matière (`::before`, un métal à peine teinté de l'Essence, avec un grain fin au-dessus de 120 px) multipliée par une fenêtre de lumière qui passe (`::after`) ; le sombre reste sombre, le clair s'allume ;
  - **III Holo** (même calque) : la matière devient un prisme en bandes fines, **sombre** (un prisme clair délavait l'illustration) ; trois reflets en étoile (`.mz-e`, l'étoile du logo, sans filtre) ; dans la fiche, le prisme glisse avec l'inclinaison de la carte (`--fx`, `js/viewer.js`) ;
  - **IV Lumière** (`.mz-a` autour, `.mz-r` et `.mz-p` dedans) : une source derrière la carte, en haut à droite — le bord s'éclaire de ce côté (contre-jour, masqué en dégradé), une lueur ronde et pâle déborde du coin, une lueur faible tout autour, des rais tombent du coin sur l'illustration et oscillent, des grains de lumière montent ;
  - **V Légende** (`.mz-c`) : la source devient visible — l'étoile du logo, un cœur blanc et des rais fins, sur le coin haut droit, par-dessus la carte ; elle respire et tourne d'un rien. Dans la Collection, elle s'efface (elle tomberait sous la pastille du nombre d'exemplaires).
  - Essayé et écarté en chemin (captures à l'appui) : la teinte de l'Essence en `color-dodge` (elle rougissait toute l'illustration de Squeezie), un prisme clair, des rayons tournants derrière la carte (un autocollant), une aurore floue (une tache), une lueur découpée par sa boîte.
- **Ce qui ne s'anime que par `transform` et `opacity`** : les bandes et les fenêtres glissent, les rais oscillent, l'étoile tourne, les lueurs respirent par leur opacité ; aucun `filter` (les reflets en étoile ont une lueur dessinée, pas un `drop-shadow`) ; seule la feuille (`color-dodge`, dans laquelle la fenêtre se multiplie) garde un mode de fusion — le vernis, les rais et l'étoile sont en fusion normale depuis la 3.0.13 (mesuré : +4 images par seconde). **Mesuré** dans Chromium sans carte graphique (rendu logiciel), processeur ralenti 4 fois, la fiche ouverte (la carte oscille sans cesse) : 49 images par seconde sans maîtrise, 44 au III, 39 à 41 au V ; d'une passe à l'autre, ±3. Non vérifié sur un vrai téléphone, où la carte graphique fait les fusions. `.mz-calme` (grilles) et le mouvement réduit immobilisent tout.
- **Rendu** : `renderCard(c, {m, calme})` appelle `maitriseEnveloppe` ; rien n'est déduit tout seul, l'appelant passe le niveau. Dans une grille, `calme: true`.
- **En combat** (`js/combat/table.js`) : seulement ses propres cartes. **Sur le plateau et dans la main, la finition est posée, immobile** (3.0.13 : huit cartes qui s'animent ensemble coûtaient des images) ; engagée, la lumière de derrière baisse et l'étoile s'efface. **Une carte maîtrisée entre avec sa maîtrise à tous les niveaux et quel que soit son type** (`mzEffetCombat`, `js/maitrise.js`, appelée par `entreeMaitrisee`, depuis la 3.0.11) : I et II, un trait de lumière ; III, un anneau de sa couleur ; IV, un éclat et des étincelles ; V, une onde de choc qui traverse le plateau, qui tremble. Un Joueur posé l'a à son arrivée ; **un Moment, un Coach, une Résilience** sont montrés en grand avec leur finition, qui vit (`montrer(…, {m})`), puis leur entrée se joue ; **un Objet** vole avec sa finition, son entrée se joue sur le Joueur qui le reçoit, et son médaillon prend un anneau de sa couleur (`.ar-obj.mzo`, prismatique au V). Les coups d'une carte de niveau IV ou plus brillent de sa couleur.
- **La fiche (refaite en 3.0.13 pour dire ce qu'il faut)** : la frise des cinq niveaux (atteints à la couleur de l'Essence, le suivant cerclé de lavande ; touché, un niveau s'affiche sur la carte, touché encore il revient : `voirNiveauVw`, `VW.apercu`) ; le niveau regardé (deux lignes réservées : regarder un autre niveau ne change pas la hauteur) ; **ce qu'il faut pour le suivant**, deux lignes cochées en vert ou barrées en rouge — les exemplaires consommés (« 16 en trop », ou « il en manque 2 ») et les Fragments (« tu en as 1 380 », ou « il en manque 140 ») — (`vMaitriseAction`, `exemplairesMaitrise`) ; le bouton « Monter au niveau … », qui pose **une confirmation à sa place** (« 2 exemplaires de « … » seront consommés et 120 Fragments dépensés. C'est définitif. », `VW.mzConfirme`) ; **d'où viennent les exemplaires en trop** (« Tu en as 19 : 3 restent pour tes decks, 16 en trop. », avec ceux qu'on garde et ceux promis dans un échange) ; **le coût de chaque niveau** en table, pour la rareté de la carte, le suivant sur un lavis lavande. **La montée d'un niveau** (`jouerMonteeMaitrise`, 3.0.13) : les exemplaires consommés montent un à un dans la carte et s'y fondent (`.mz-copie`, Web Animations : transform et opacité), la carte encore à son ancien niveau ; puis un éclat blanc, et elle prend sa nouvelle finition sous les yeux ; le chiffre et le nom du niveau s'inscrivent sur elle, des étincelles, un carillon plus riche de niveau en niveau. Depuis la 3.0.12 : changer de page ne déplace pas la carte, la carte change de finition **en place** (`poserMaitrise`, sans recharger son illustration). Parcours vérifié dans la démo (Chromium, 375 × 667, 390 × 844, ordinateur) : 19 exemplaires et 1 500 Fragments, niveau I d'une Peu commune, 17 et 1 380 après, la montée jouée, aucune erreur.
- **L'insigne (3.0.11)** (`insigneMaitrise`, « ✦ III ») : l'étoile du logo et le chiffre sur une pastille graphite ; l'étoile s'éclaire de niveau en niveau dans la famille du décor (du gris à la lavande pâle) ; au V, elle et le contour prennent le prisme des Secrètes. **Plus de pastille jaune.**
- **Le Labo** › Aperçus › **La maîtrise** (3.0.11) : les cinq finitions sur une carte au choix (Joueur, Objet, Moment, Coach ; « Une autre carte »), la montée d'un niveau (avec ses exemplaires, 3.0.13), l'entrée en combat sur un petit plateau qui reprend celui de l'arène, la fiche à ce niveau. Rien n'est enregistré. Pour l'essayer pour de vrai : Labo › Mon compte › **« Pour la maîtrise »** (3.0.13, `labo_cartes('maitrise')`) donne à chaque carte qui se maîtrise de quoi aller jusqu'à la Légende (les trois d'un deck, plus 5 à 20 exemplaires).
- **Serveur** : tables `maitrises` et `maitrises_journal`, RPC `maitriser(p_carte)`, `maitrise_fragments(rar, n)` et `maitrise_copies(rar, n)` ; état dans `me().maitrise = {niveaux, fetiche}` → `save.maitrises`, `save.fetiche`.
- **La carte fétiche** : une carte possédée, mise en avant en haut du profil et sur la fiche publique (`vFetiche`, `js/maitrise.js` ; `fetiche_de` revérifie la possession). Depuis la 3.0.8, c'est une tuile pleine : le fond est l'illustration floutée de la carte (`.fet-fond`) ; la carte et sa maîtrise à gauche ; à droite, le nom, la rareté à sa couleur (`--r-*`), l'Essence, le numéro, la maîtrise et « Changer ». **3.0.11** : un projecteur doux de sa couleur derrière la carte, l'étoile du logo devant « Ma carte fétiche », le nouvel insigne et la maîtrise en cinq crans (pleins à la couleur de l'Essence, prismatiques à la Légende), « Pas encore maîtrisée » sinon. Sans fétiche, une carte fantôme et « Choisir une carte ». Elle se choisit dans Gérer (`set_fetiche(id|null)`, colonne `profiles.fetiche`). Elle est distincte de la vitrine (4 cartes).
- **Trois copies des chiffres** : `MAITRISE.base` / `.mult` / `.copies` (`js/maitrise.js`, `fragmentsMaitrise`), `maitrise_fragments` / `maitrise_copies` (`28_maitrise.sql`), `MZ_BASE` / `MZ_MULT` / `MZ_COPIES` (`_demo/serveur.js`). Justification : `docs/economie-3.0.md`, partie 3 ter.

### 6.8 Échanges et Social

- **On échange avec n'importe quel joueur** : un ami, ou un pseudo exact (`find_player`) ; `trade_create` ne vérifie pas l'amitié. Seules la collection de l'autre (`player_profile`) et la vue « Chez tes amis » sont réservées aux amis. L'onglet Social (`js/social.js`) a deux volets, Amis et Échanges (`js/trade.js`).
- **Amis** (`supabase/installation/06_social.sql`) : table `friendships` rangée `a < b` ; une demande croisée vaut acceptation ; 25 demandes en attente au plus. La **fiche d'un joueur** (`player_profile`) montre à tous bannière, avatar, titre, devise, niveau, l'Élu, la fétiche, la vitrine, les statistiques et les succès ; **entre amis seulement**, sa collection et ses 12 meilleurs doublons (R ou mieux).
- **Règles d'un échange** (`trade_create`, `trade_respond`, `03_rpc.sql`) : une carte contre une carte **de même rareté** ; ni Essence, ni Promo, ni Unique ; Reverse contre Reverse, Secrète contre Secrète, **Brillante contre Brillante** (3.0.11 : `trade_create` laisse passer la rareté `BR`, `amis_doublons` les montre) ; la composition (`ouvrirChoixCarte`, `js/trade.js`) a trois côtés, Classiques, Reverses et Spéciales (Secrètes et Brillantes), choisis par `trCote` ; posséder ce qu'on offre ; 10 demandes en attente au plus ; une note de 140 caractères. **Coût** : une demande gratuite toutes les 6 h (`cfg('trade_cooldown_h')`), sinon un jeton (`trade_token`, boutique), sinon `ECHANGE_EN_RECHARGE`. À l'acceptation, le serveur revérifie tout et échange dans une seule transaction.
- **Écran** : à gauche ce qu'on **reçoit**, à droite ce qu'on **donne**, partout. L'étiquette dit combien *j'en ai* (« Nouvelle », « ×n », « Dernière », « Gardée »). « Chez tes amis » liste ce qui te manque et qu'un ami a en double (`amis_doublons`).
- **La photo Discord des autres** : on stocke le mot `discord`, et le serveur joint l'adresse de la photo (`photo_discord()`) aux profils qu'il renvoie. `avatarHTML(a, cadre, taille, photo)` **ne se rabat jamais sur la session** : sans adresse, on dessine l'étoile (avant, tout le monde portait le visage du spectateur).

### 6.9 Profil, succès, titres

- **Le profil et la fiche d'un joueur ne font plus qu'un (3.0.13)** : la carte de visite (`vCarteJoueur`, `js/profile.js`), la même pour son profil (`donneesMoi()`, depuis `save`) et pour la fiche que voient les autres (`player_profile`, `ouvrirFiche`, `js/social.js`). Dans l'ordre : l'en-tête (le fond, l'avatar et son cadre, le pseudo, le titre, la devise, la Section, les jours d'affilée), **quatre chiffres** (collection, Reverses, boosters, échanges), l'Élu, la carte fétiche, la vitrine, **les combats** (niveau de combattant ; victoires et pourcentage ; contre l'IA et entre amis ; série en cours et record ; campagne sur 20 ; **les decks montrés**), les succès ; sur la fiche d'un ami, sa collection ensuite. Styles `.pj-*` (`css/hub.css`). Le propriétaire trouvait l'ancien profil « un peu le bordel » : il empilait en une page de 3 900 px (téléphone) la vitrine et tous les réglages ; il en fait 1 280.
- **« Personnaliser »** (le bouton de l'en-tête de son profil) : une feuille à cinq onglets — Avatar, Cadre (ceux à débloquer disent où), Titre (ceux à débloquer en liste repliée), Fond (la bannière) et devise, Pseudo (`ouvrirPerso`, `vPersoOnglet`). Chaque choix s'applique tout de suite et la feuille se redessine à sa place (`rafraichirPerso`, appelé par `agir`) ; choisir une carte en avatar ou en fond ouvre une autre feuille, dont « Retour » ramène à « Personnaliser » (`revenirPerso`). Ce qui a été sacrifié : le nombre d'exemplaires dans les chiffres, le bouton « Ma fiche » (le profil est la fiche).
- **Les statistiques de combat (3.0.13)** : `combat_joueurs` comptait déjà `victoires`, `defaites` (contre l'IA ; depuis la 3.0.14, un combat abandonné ne compte perdu qu'au Raid, voir « Les abandons » plus bas), `pvp_v`, `pvp_d` (défis entre amis) ; s'y ajoutent `serie` et `serie_max` (`combat_serie(p, gagne)`, appelée par `combat_fin` et `defi_fin` ; un combat abandonné la remet à zéro). `me()` les donne dans `combat.stats` ; la fiche d'un autre, par `combat_public(u)` (`player_profile` › `combat` : Section, chiffres, campagne, decks montrés ; `null` pour qui n'a jamais combattu).
- **Les decks montrés (3.0.13)** : `decks.public` ; `deck_publier(p_id, p_public)` (seul un deck complet se montre : 40 cartes, 10 Essences ; `deck_sauver` garde le drapeau si la page ne l'envoie pas, et le retire à un deck qui n'est plus complet). Dans Combats › Decks, un deck complet a son bouton « Montrer sur ton profil » (« ✓ Montré sur ton profil » une fois montré). Sur une fiche, un deck montré s'ouvre (ses cartes, sa Réserve) et son code se copie (`voirDeckMontre`) ; sur son profil, « Ne plus le montrer ». Test : `tools/tests-sql/profil-combat.sql`. Dans la démo, Lumen et Nova.92 montrent la copie du Starter de leur Section, et les quatre joueurs simulés ont des chiffres (`mondeCombats13`).
- **Avatar** (`set_profile`) : `'discord'`, `'card:<id>'`, une clé d'`AVATARS`, ou `'ess:<couleur>'` ; le serveur refuse tout autre mot (40 signes au plus : minuscules, chiffres, `_ : -`), puisque l'avatar part chez tous ceux qui voient le joueur. **Cadre** : un `f_*` possédé (le serveur refuse un tapis ou un titre, depuis la 3.0.11) (`FRAMES`, `config.js` : `fx` = SVG animé, `vente: false`, `unique`). Les cadres « Arène » (`f_niv10/20/30/50`) se gagnent aux niveaux de combattant.
- **Titre, bannière, devise** (`personnaliser`, `null` = inchangé, `''` = retirer) : le titre se gagne par les succès, les quêtes jalons, le Pass ou la boutique (`TITRES`, 27 ; `titres_de()` côté serveur, sans les tapis, qui partagent le préfixe `t_` : `est_cosmetique_combat`) ; la bannière est une carte possédée ; la devise, 80 signes.
- **Vitrine** : 4 cartes (`set_vitrine`). **L'Élu** : l'écrin du gagnant de la chasse. **Fétiche** : [§ 6.7](#67-la-maîtrise-et-la-carte-fétiche-307-refaite-en-308).
- **Succès** : calculés à la volée par `succes_de()` (`15_evenements.sql`) ; noms dans `SUCCES` (18, `config.js`). Les identifiants doivent rester les mêmes des deux côtés.

### 6.10 Quêtes

- **Portées** : `daily`, `weekly`, `milestone` (« Saisonnières »), et pour un événement `ev_jour` / `ev`. La clé de période est calculée **à l'heure de Paris** (`period_key`) ; l'interface affiche le temps restant avec le même calendrier (`resteAvantRemise`).
- **La progression n'est jamais envoyée par le navigateur** : le serveur l'avance quand l'événement arrive vraiment (`bump_quests`, appelé par `open_pack`, `trade_respond`, `recycler`, `combat_fin`…). Seule nuance : pour un combat, le serveur croit le navigateur sur le **résultat** (`combat_fin`, `tutoriel_fini`), dans les limites du [§ 7.11](#711-ce-que-le-serveur-vérifie). Les quêtes « d'état » ne reculent pas : pourcentage de collection, raretés complètes `set_*` / `rset_*`, Brillantes et exemplaires `ex_*` sont recalculés par `sync_collection_quests` (`01_schema.sql`) ; le niveau de combattant (métrique `niveau`) l'est par `gagner_xp` (`26_niveaux.sql`).
- **97 quêtes** dans `supabase/installation/04_seed.sql` (`d_*`, `w_*`, `m_*`, Reflets `e_*`, Choc `c_*`), avec leurs récompenses (Éclats, `item_id`, ou `monnaie = 'prismes'`). Calculs d'équilibrage en tête du fichier.
- **Signalement** : une carte passe 4 s en haut de l'écran (`notifQuete`), puis la pastille de l'onglet reste tant qu'il y a quelque chose à encaisser. C'est `Backend.apply` qui compare l'état avant / après. **Plusieurs quêtes finies ensemble** (un combat en finit souvent trois) font **une seule carte** (3.0.11, `notifQuetes`) : leurs titres sur une ligne, « 3 quêtes accomplies », la somme des gains par monnaie ; avant, trois cartes empilées couvraient le haut de l'écran.
- L'onglet Quêtes a trois sous-onglets (Quotidiennes, Hebdomadaires, Saisonnières) ; les quêtes de combat vivent aussi dans Combats › Missions (`METRIQUES_COMBAT`).
- **« Aujourd'hui »** (3.0.13, `vAujourdhui`, `js/quests.js` ; styles `.auj` de `css/hub.css`) : en tête de l'onglet Quêtes, une rangée des rendez-vous qui ont un plafond par jour — les boosters de la réserve, Devine l'illu, l'Épreuve (pendant le Choc), les tentatives du Raid, les victoires payées en solo, les défis payés entre amis (« Combats · choisis ta Section » avant d'en avoir une). Ce qui reste à faire passe devant ; ce qui est fait se coche en vert. Un toucher y mène (`data-tab` avec `data-cbv` pour une vue des Combats, `data-chv` pour une vue du Choc). **Pas un onglet de plus et pas une pastille de plus** (le propriétaire : « il y a déjà beaucoup d'onglets ») : la rangée défile au doigt sur téléphone, devient une grille sur ordinateur. L'Épreuve, le Raid et Devine l'illu ne se chargeaient qu'en visitant leur écran : `chargerAujourdhui()` les demande en arrivant sur Quêtes (le Raid au plus toutes les 20 s, `relireRaid`), et leurs chargeurs redessinent aussi l'onglet Quêtes.
- **« Tout récupérer »** (3.0.11) : dès que deux quêtes d'une liste sont prêtes, un bouton en tête de la liste les encaisse d'un geste (`recupererQuetes`, `js/quests.js` : une à une côté serveur, `claim_quest` revérifiant chacune, puis un seul message). Il vaut pour les listes du jour, de la semaine et de l'événement (`vListeQuetes`), pas pour les jalons.

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
- **Ouvrir recyclage et fabrication des Reverses** : Labo › Serveur › Les Reverses, ou `update public.parametres set fabrication_reverse = true where id = 1;` ; les dater : `parametres.reverses_des`. **Changer leur prix** : `prix_reverse()` (`22c_reverses.sql`), `REV_DEFAUT` (`js/recyclage.js`), `prixReverse` (`_demo/serveur.js`), et le `22c_reverses.sql` de la 2.x.
- **Ajouter une page à la fiche** : une entrée dans `VW_ONGLETS` et son cas dans `vPageVw`, **avant** le `return vGererVw(c)` final (une clé inconnue affiche la page Gérer) ; ses boutons en `data-v`, traités dans la délégation de `#viewer`. `rafraichirFicheVw` la redessine déjà, comme toutes les pages sauf Infos.
- **Remettre un critère au Classement** : un objet `{id, titre, dit, val}` dans `CRITERES` (le serveur sait déjà le calculer).
- **Tester une ouverture** : Labo, `openBooster({test:true, force, god, brillante, unique, reverseR})` (tirage local, rien n'est écrit).

---

## 7. Les Combats

> **Les règles officielles depuis la 3.0.12.** Le propriétaire a transmis le 30 octobre 2026 les règles du Gentle Mates TCG ; elles sont recopiées sans modification dans [`docs/regles-officielles.md`](docs/regles-officielles.md) et **font foi**, « au pied de la lettre ». [`docs/regles-3.0.md`](docs/regles-3.0.md) dit où vit chaque règle dans le code, la liste de ce que le texte ne tranche pas (§ 11 : la lecture retenue, et l'autre) et ce qui a changé depuis les règles reconstituées des versions 3.0 à 3.0.11 (§ 12). `REGLE`, en tête de `js/combat/moteur.js`, cite la phrase officielle de chaque valeur.

### 7.1 Les règles en bref

- **Gagner** : attaquer avec succès le CEO adverse quand il n'a plus de PV ; ou l'adversaire doit piocher et ne peut pas (Club vide) ; ou il abandonne.
- **Zones** : le Terrain (**3 cases** par CEO, face à face : une case et celle d'en face font une « ligne »), **4 PV** face cachée, la Défausse, le Club (**40 cartes**, **3 exemplaires** au plus d'une même carte : même nom et même couleur), la Réserve (**10 Essences** au choix, mélangées), la Main. **Plus de Banc** : « bench », c'est la défausse.
- **Mise en place** : mélanger Club et Réserve ; main de 5, un mulligan ; 4 PV ; puis **qui commence, à pile ou face, à chaque partie** (le moteur, avec la graine). La phrase officielle « Le perdant commencera la partie suivante » ne s'applique pas : le propriétaire l'a décidé le 31 octobre (la 3.0.12 l'avait appliquée, la 3.0.13 la retire). Seul le tutoriel fait toujours commencer le joueur : l'arène dit alors « Qui commence », et la pièce se pose sans tourner.
- **Le tour** : **entretien** (piocher 1 carte — le premier CEO aussi —, tout désengager, jouer la première Essence de la Réserve) → **phase d'action** (des Joueurs sur les cases libres, autant qu'on veut ; plein, une fois par tour, bench un Joueur non engagé pour mettre le nouveau à sa place ; des Objets, sans limite par Joueur ; des Moments ; **un Coach**) → **phase de Combat** (les attaques seulement : on ne revient pas en arrière) → **fin de tour** (défausser pour garder 5 cartes en main). Le tout premier tour de la partie n'a pas de phase de Combat.
- **Restriction par couleur** : un Objet, un Coach ou un Moment d'une couleur ne se joue qu'avec une Essence de cette couleur en jeu (engagée ou non : ce n'est pas un coût). Seules les attaques coûtent.
- **Attaquer** : engager les Essences du coût (une couleur demande sa couleur, le Neutre n'importe laquelle), engager le Joueur : l'attaque se déclare **sur le CEO adverse** (Provocation ou Slay d'en face imposent leur cible ; Jus de bagarre permet de viser le Joueur d'en face). **Défendre** : le Joueur désengagé de la même ligne (Garde : n'importe lequel), qui s'engage. **Soutien** : contre un défenseur, l'attaquant peut engager l'attaque d'un de ses Joueurs **adjacents** ; sa valeur s'ajoute. **Attaque ≥ Défense** : le défenseur est vaincu (à la défausse, avec ses Objets) ; sinon rien. **Sans défenseur, le CEO est touché** : il prend son premier PV en main, ou en joue la Résilience.
- **Mots-clés** : Provocation, Garde, Buff, Riposte, Légion, Shield (textes officiels, `docs/regles-3.0.md` § 10) ; Signature (★ immédiat, ⚡ réactif, sans icône persistant).

| `REGLE` | `LIGNES` | `PV` | `MAIN` | `MAIN_MAX` | `CLUB` | `RESERVE` | `COPIES` | `COACHS` | `REMPLACEMENTS` | `ESSENCES` |
|---|---|---|---|---|---|---|---|---|---|---|
| valeur | 3 | 4 | 5 | 5 | 40 | 10 | 3 | 1 | 1 | 1 |

### 7.2 Le moteur (`js/combat/moteur.js`)

- **Aucun affichage**, et il tourne aussi sous Node (IIFE sur `globalThis`, `module.exports`). Il expose `Combat` : `creer`, `agir`, `demande`, `optionsTour`, `cloner`, `rejouer`, `catalogue`, `scripts`, les calculs (`defense`, `valeurAttaque`, `infoAttaque`, `defenseurs`…) et **`Combat.O`**, la boîte à outils des effets (`piocher`, `engager`, `bancer`, `vaincre`, `toucher`, `payer`, `choisirUn`, `choisirCartes`, `ouiNon`, `ordonner`, `mod`, `alea`, `melanger`…).
- **Un générateur** : `partie()` → `miseEnPlace()` → `tour()` en boucle. Il s'arrête (`yield`) à chaque décision : `{type:'tour'}`, `{type:'choix', but, options…}`, `{type:'cartes', parmi, min, max}`, `{type:'ordre'}`. Un effet de carte est une coroutine qui fait `yield*` sur ses décisions.
- **Actions** : `deployer {u, ligne, remplace?}` (`remplace` : le Joueur non engagé bench pour faire place, une fois par tour, quand les trois cases sont prises), `lier {u, cible}`, `jouer {u}`, `attaquer {u, k, cible, chevaliere?}`, `finTour`, et en réponse `choix {v}`, `cartes {u:[…]}`, `ordre {u:[…]}` ; `abandon` à tout moment. Décisions propres aux règles officielles : `soutien` (l'attaquant, une fois le défenseur déclaré : `v = 'u:k'` ou `'non'`), `defausseFin` (garder 5 cartes en fin de tour). `E.phase` vaut `jeu` (phase d'action) puis `combat` (déclarée par la première attaque) ; `E.j[i].bench` note les cartes bench (à la défausse). `agir(E, a)` valide l'action (`valider`, comparaison par `cle()` = JSON à clés triées), l'ajoute au journal, avance, et **renvoie les événements produits**.
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

Contexte `x = {E, j, c, P, A}` (+ `porteur`, `X` l'attaque en cours, `guet`). Drapeaux lus par le moteur : `provocSiLibre`, `jusDeBagarre`, `invitation`, `chevaliere`, `nucleaire`, `legionGratuite`, `ombre:false`. Couverture vérifiée : aucune des 122 cartes jouables n'a de texte sans script, les Promos et les Secrètes non plus (3.0.13 : `S.p03`, `S.p04` reprennent `S.c077` et `S.c012` ; `S.c124`, `S.c126`, `S.c127` et leurs tests). Effets de tour posés par ces Secrètes : `pasJoueur` (GP Explorer II, lu par `joueurPermis`, qui bloque aussi les effets « jouez un Joueur » — Worlds Japon, Versus Fighting, Meet & Greeter, M16) et `doublePremiere` (Paris Gentle Mates, lu par `valeurAttaque` avec `E.cpt.premierAttaquant`).

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

- **`js/combat/decks.js`** (`Decks`) : un deck enregistré vaut `{id, nom, cartes:{id:n}, reserve:{couleur:n}, couverture, public}` (`public` : montré sur le profil, 3.0.13, [§ 6.9](#69-profil-succès-titres)) ; `versMoteur()` le met à plat. Limite (règles officielles) : **3 exemplaires** d'une « même carte », c'est-à-dire **même nom et même couleur** (`cleCopie(id)` = nom sans accents ni majuscules + couleur) : une Reverse et sa classique, P01 et P02, Le Marionnettiste #121 et P06, Brawks Déter #077 et P03, Squeezie le Toxique #012 et P04, les deux Leakof (#072, #110) comptent ensemble ; pas de limite propre aux raretés. `jouable()` exclut les Essences et les Secrètes cachées. `verifier(deck, possede)` renvoie la liste des erreurs.
- **Starter Decks** (`STARTERS`) : `toxique` (avec `p04`, Réserve rose ×10) et `deter` (avec `p03`, mauve ×10), 40 cartes et 18 Joueurs chacun, **prêtés** (on les joue sans en posséder les cartes) ; **ils ne se copient qu'avec ses propres cartes** (3.0.14, le propriétaire) : `copieStarter(deck, possede)` prend chaque carte dans la collection, toutes versions comprises (même nom, même couleur : celle que liste le Starter d'abord, puis la classique, la Reverse, la Promo), et rend la copie ou ce qui manque ; le bouton « Dupliquer » n'apparaît qu'avec toutes les cartes, sinon la fiche du Starter dit ce qui manque (`voirDeck`, `js/battle.js`) ; test : « un Starter ne se copie qu'avec ses propres cartes » (`tools/combat-tests.js`). Les listes sont reconstituées : les règles officielles ne les donnent pas, et le propriétaire les fournira. Depuis la 3.0.13, chacun a la vraie Promo de sa Section : P04 (Squeezie le Toxique) prend une des trois places de Squeezie dans le Toxique, et la place libérée va à un troisième Vandale ; P03 (Brawks Déter) remplace l'ancienne Promo provisoire du Déter, avec ses deux Brawks Déter. Mesuré sur les mêmes parties (IA niveau 3, places alternées, graines 2000 + i) : le Toxique gagne 68,8 % avant et 69,2 % après sur 240, 68,5 % avant comme après sur 400 — le déséquilibre connu ne bouge pas.
- `aleatoire(rand, {niveau, couleurs})` tire un deck crédible (`CIBLES` : 18 Joueurs, 8 Objets, 14 Coachs et Moments, sur 40) : decks adverses de la campagne (`deckRival`), de l'Arcade, du Raid (`deckSorcier`) et de l'Épreuve. Sans `couleurs`, il les tire par `tirerCouleurs` (une ou deux, ni jade ni jaune : Arcade, Épreuve) ; la campagne impose celles du rival (jaune compris), le Raid Mauve plus un allié du jour (`CHOC_ALLIES`, jaune et jade compris). `bilan()` note un deck « Solide / Jouable / À revoir » sur les trois conseils des règles officielles (15 Joueurs au moins, une Réserve accordée aux attaques, une majorité d'attaques à 1 ou 2 Essences ; `BON`). Code de partage `M8D1.c012x2.c013|rose10` (`encoder` / `decoder`).
- **L'atelier** (`js/combat/atelier.js`, styles « L'atelier de decks » de `css/combat.css`), **refait en 3.0.13** (le propriétaire : « très fonctionnel, mais très peu accessible, y a beaucoup de texte entassé et mal organisé ») :
  - **la tête**, collée en haut de l'écran (`.at-haut`) : le retour, le nom (modifiable sur place, un crayon le dit), le menu (code à partager, vider, supprimer), **Enregistrer** (discret tant que rien n'a changé, l'action principale ensuite), puis **trois onglets** — Cartes, **Club** et **Réserve**, ces deux derniers avec leur jauge (40 cartes, 10 pastilles aux couleurs des Essences ; une jauge pleine passe au vert). Rien ne s'enregistre sans « Enregistrer » ; quitter avec des changements le demande.
  - **une ligne, la prochaine étape** (`vAtEtape`) : « Encore 12 cartes à choisir » (avec « Compléter pour moi »), « Encore 4 Essences à choisir » (avec « Régler d'après mes attaques »), la première erreur, ou « Prêt à jouer ». Sur téléphone, l'onglet Réserve la remplace par sa propre ligne.
  - **Cartes** : la recherche, et « Filtres » qui déplie le type, la couleur et « Aussi celles que je n'ai pas » (le nombre de filtres actifs sur le bouton) ; toucher une carte l'ajoute (pastille blanche du nombre, « − » pour en retirer, « i » pour la voir ; une carte qu'on ne peut plus ajouter s'assombrit, et la toucher dit pourquoi). Le 40ᵉ ajout le dit (« Club complet. Reste la Réserve. »).
  - **Club** : le bilan (étoiles, « Solide », « Voir l'analyse ») puis la liste par type — l'illustration, la Défense et le coût de chaque attaque (« 1 et 3 Essences »), l'étoile de la couverture, − et +.
  - **Réserve** : ce que demandent les attaques (« Dans tes attaques : 15 Rose ») ; « Régler d'après mes attaques » (`Decks.reserveAuto`) en bouton principal tant qu'elle n'est pas pleine, rien quand la Réserve est déjà celle qu'il poserait ; **neuf tuiles** en trois colonnes (le symbole, le nombre, − et +), une tuile demandée et vide cerclée d'or. Elle tient dans l'écran aux quatre tailles (mesuré : 0 px de débordement, Club vide, plein, Réserve réglée ou non) ; à 375 × 667, les noms des couleurs cèdent la place aux seuls symboles, comme dans les filtres.
  - **l'analyse** (répartition par type, Joueurs par coût, Défense moyenne, Résilience, couleurs manquantes : `vStatsDeck`) est dans la feuille du bilan (`ouvrirBilan`, `js/battle.js`), sous les trois conseils.
  - **sur ordinateur** (900 px et plus) : les cartes à gauche, le Club puis la Réserve à droite (une colonne collée qui défile seule) ; l'onglet Cartes disparaît, Club et Réserve amènent la colonne à leur partie.
  - **pour un lecteur d'écran** : les onglets sont des `tab` reliés à leur panneau, chaque ajout et chaque retrait est dit (« Ajout : Vandale. 12 sur 40. », `annonceLecteur`, `js/utils.js`), et le focus reste sur le bouton touché d'un rendu à l'autre (`retenirFocus` / `rendreFocus`, `js/app.js`, valable pour tout le site).
  - « Compléter pour moi » vise `Decks.CIBLES` avec les cartes triées par `IA.valeurCarte` ; l'enregistrement passe par `deck_sauver` (le serveur revérifie).

### 7.6 L'arène (`js/combat/table.js`, `css/arene.css`)

- **`Table.ouvrir(o)`** : `init` (partie à créer) ou `E` (reprise), `moi`, `ia: {niveau, choisir?}` (ou `null` contre un humain), `joueurs`, `cosm`, `titre`, `boss`, `minuteur`, `sauver` (clé `localStorage`), et les rappels `surFin(E, gagne)`, `surAction(a, E, deMoi)`, `surQuitter`. L'option **`guide`** (`permis`, `refus`, `apresRendu`, `surDecision`, `apresAction`, `avantIA`) sert au tutoriel.
- **La boucle** avance tant que ce n'est pas au joueur ; l'IA marque un temps (1 000 ms, 650 pour un choix) avant `IA.choisir`. `executer(a)` : `Combat.agir` → `surAction` → `sauver` → `animer(evs)`.
- **Ce qu'on dessine et ce qu'on décide** : `rendre()` dessine `vue()` (la photo `e.etat` de l'événement en cours, sinon `T.E`) ; **les décisions se lisent toujours sur `T.E`**, qui est déjà à l'état final pendant une animation. `rendre()` est repoussé pendant `T.anim`, sauf `rendre(true)` depuis un geste d'animation.
- **`ANIM[e.t]`** : un geste par type d'événement (vol de carte, secousse, bandeau, visée, éclats, `entreeMaitrisee`). `journaliser` écrit le journal, `historiser` les « cartes jouées ». **Depuis la 3.0.12 (règles officielles), chaque étape a le sien** : la mise en place s'anime (`Combat.creer(init, { capture: true })` photographie dès la donne ; `#arene.mise` cache la main jusqu'à son arrivée) — la donne (`main`), le mulligan (`mulligan` ; **refait en 3.0.14** : sa main se retourne en volant au centre, s'y empile, le paquet se mélange en deux passes — deux dos qui s'écartent et se croisent, `paquet()`, son `melange` dans `js/sfx.js` —, rentre dans le Club, puis la nouvelle main est donnée ; celle d'en face rentre dans son Club, qui tremble, et en ressort ; « Animations réduites » : les vols seuls, en 0,7 s. Environ 3 s du clic à la nouvelle main, 1,7 s en vitesse rapide. Jusqu'à la 3.0.13, une seconde entrée `mulligan`, restée de la première arène plus bas dans `ANIM`, écrasait celle-ci : la main changeait sans geste et quatre des cinq nouvelles cartes restaient cachées jusqu'à la fin de la mise en place), les 4 PV (`pv`), puis le tirage du premier (`pileFace`, la pièce, après les mains et les PV comme dans les règles ; `o.premierRaison` dit pourquoi un CEO commence) ; l'entretien (`pioche` des deux côtés, `desengagement` : les cartes se redressent, `essence`) ; `phaseAction`, `phaseCombat` (bandeau « Phase de Combat »), `cloture` ; le **soutien** (`soutien` : le voisin se lève, un trait de lumière file de lui à l'attaquant, « +N ») ; le **duel** (`duel()`, dans `impact` : « Attaque N ≥ / < Défense M », avec la part du soutien) ; tout ce qui est **bench**, **vaincu** ou **défaussé** vole jusqu'à la pile de défausse de son camp (`versDefausse`), Légion l'en ramène ; « Club vide » en bandeau.
- **La carte agrandie** (`ouvrirFocus`), deux mises en page :
  - **la zone de détails** (`.ar-focus.large`, 3.0.8) : **pendant son tour**, une carte de sa main ou un de ses Joueurs posés s'ouvre **au-dessus de son camp** (`.haut`), dont les trois places restent visibles et touchables ; la carte à gauche, `zoneDetails()` à droite : nom, sorte et couleur, Défense (réelle pour un Joueur posé), Prêt / Engagé, Objets, attaques (boutons `data-ar="attaque"` pour ses Joueurs, la lançable en lavande), mot-clé, talents, effet, Résilience, « En ce moment », et pour une carte de la main **le geste** (`panneauMain` : « Touche une place libre », « Jouer ce Moment », ou pourquoi pas), collé en bas de la colonne quand elle défile. Tout y est écrit : pas de « Lire le texte ». Sur un écran de 900 px ou plus, toute carte s'ouvre ainsi ;
  - **la carte en très grand** (3.0.7), sur téléphone le reste du temps (tour adverse, carte de l'adversaire) : la carte intacte, son état dessous, « Lire le texte en grand ».
  **Un Joueur engagé est tourné d'un quart de tour** (3.0.12, règles officielles : « Engager une carte signifie la tourner à 90° ») : seule l'illustration tourne (`.ar-j.eng>.ar-c`, vers la gauche chez l'adversaire), sa Défense, ses Objets et ses pastilles restent droits ; un peu assombri, avec l'étiquette « Engagé ». (De la 3.0.7 à la 3.0.11, il ne pivotait pas.)
- **Les places libres** (`marquerPlacesCarte`, 3.0.8) : une carte de la main tenue (touchée ou glissée), chaque place où elle peut aller montre **la carte en fantôme** (`.ar-place-f`, sans maîtrise) dans un liseré lavande qui respire lentement ; survolée en glissant, elle se précise. Les fantômes ne sont pas redessinés d'un rendu à l'autre et partent avec la surbrillance (`surligner`). Le sélecteur du tutoriel `.ar-camp.moi .ar-place:not(:has(.ar-j))` n'en dépend pas.
- **Décisions** : mulligan, choix, cartes, ordre, dans une feuille `.ar-sheet` ; les choix qui portent sur le plateau se font en touchant les éléments `.option` (une carte qui porte plusieurs options — un soutien à deux attaques — se choisit dans la feuille). **Le soutien** a sa feuille (`decisionSoutien` : l'attaque contre la Défense, puis chaque voisin avec le total et l'issue) ; **la défausse de fin de tour** (`defausseFin`) passe par la feuille des cartes. **Le remplacement** (trois cases prises) : le Joueur qu'on peut bench s'allume en pointillé (`.remplacable`), et le geste se confirme (`confirmerRemplacement`). Échap referme ; `T.bloqueClic` (350 ms) corrige les touchers fantômes de Safari iOS.
- **La bande du milieu** : les quatre phases officielles (Entretien › Action › Combat › Fin, `PHASES`), celle en cours allumée — lavande pendant son tour, corail pendant celui d'en face ; au tout premier tour, « Combat » est barré.
- **La visée (refaite en 3.0.13** ; le propriétaire, de la flèche : « pas très esthétique, trouve mieux ») : plus rien n'est tendu à travers le plateau. `trait()` dessine, dans la seule boîte qui entoure les deux cartes, un trait de lumière (un halo large et pâle, un cœur blanc, sans filtre) qui file de l'attaquant à sa cible et s'y résorbe en 0,4 s ; `viser()` pose sur la cible une **mire** (`.ar-mire` : quatre coins qui se referment, un halo qui respire), de la couleur de l'attaquant — lavande pour soi, corail pour l'adversaire —, jusqu'à l'impact ; un défenseur qui s'interpose reprend la mire. Le soutien reprend le même trait (`.ar-trait.soutien`). Mouvements réduits : la mire seule, posée d'emblée.
- **Performances (3.0.12)** : l'ombre d'un Joueur est une `box-shadow` sur sa carte (plus de `filter: drop-shadow` sur tout le bloc), et les pulsations sans fin (Joueur prêt, case libre, « Fin du tour », consigne, avatar actif, PV bas) n'animent plus que l'opacité d'un calque, jamais une `box-shadow` ou un filtre.
- **Performances (3.0.13)**, après une mesure animation par animation (`T.evEnCours`, processeur ralenti quatre fois, téléphone 390 × 844) : les reflets des Légendaires, Reverses et Secrètes glissent par `transform` (ils déplaçaient la position d'un fond, repeint à chaque image) ; la main porte son ombre en `box-shadow` et s'assombrit sous un voile (plus de filtre) ; les cartes qui volent aussi ; les éclairs d'une carte (posée, effet, coup maîtrisé, vaincue, repoussée) sont l'opacité d'un voile `.ar-eclair` (`eclair()`), plus des filtres animés ; le bouton d'attaque prêt pulse par un calque ; les flous derrière la carte agrandie, les feuilles et le journal, déjà presque opaques, sont retirés ; un déploiement ou un Objet lié mesure sa place une fois, avant de redessiner (`rectDe`) — relire la position après coup forçait une remise en page complète. Hors de l'arène : `RM()` ne recrée plus sa requête média à chaque appel, et le paquet de l'écran Boosters ne s'anime plus sous l'arène, sous une fenêtre ni onglet caché (`js/booster.js`). Mesuré sur deux minutes de partie : les tâches longues pendant les déploiements passent de 14 (jusqu'à 217 ms) à 8 (jusqu'à 148 ms), au repos de 11 à 6 ; le nombre d'images par seconde bouge peu dans ce banc (rendu logiciel, sans carte graphique) — un vrai téléphone n'a pas été essayé.
- **Accessibilité (3.0.13)** : les Joueurs posés, les places libres où poser une carte et le CEO adverse se prennent au clavier (Tab, puis Entrée ou Espace), avec ce qu'en dit un lecteur d'écran (« Ton Joueur Vandale, Défense 90, attaque 110, prêt, Provocation ») ; la carte agrandie prend le focus en s'ouvrant (son geste principal, sinon « Fermer ») et le rend en se refermant ; le combat est raconté aux lecteurs d'écran (les lignes du journal d'un même geste, dites ensemble par `#annonce`) ; l'anneau de focus suit l'arrondi des cartes.
- **Les images des cartes (3.0.12)** : une carte pèse 107 Ko en moyenne ; sur un réseau lent (« 3G rapide », cache vide), la main de départ arrivait vide et l'on décidait du mulligan devant des cartes sans image pendant près de 4 s (mesuré). La main se charge désormais avant la donne (au plus 2,5 s d'attente), la feuille du mulligan attend ses cinq images (au plus 4 s de plus), et la nouvelle main d'un mulligan se charge pendant que l'ancienne repart. Ensuite, à chaque rendu, ce qui va se montrer bientôt — les deux mains, les PV, les trois prochaines cartes de chaque Club — se charge en fond, deux images à la fois et seulement quand la page est au repos (`requestIdleCallback`) : jamais tout le Club (8 Mo pour les deux), et pas pendant une animation (mesuré : la fluidité ne bouge pas, 53,6 à 55,5 images par seconde au processeur ralenti quatre fois, contre 55,1 à 55,8 sans). `precharger`, `prochaines`, `chargee` en tête de `js/combat/table.js`.
- **Défis** : `minuteur` secondes par tour (une décision prise pendant son propre tour prend sur ce temps), 20 s (`CHRONO_DECISION`) pour une décision pendant le tour adverse. Son propre temps écoulé, l'arène joue à sa place (`tempsEcoule` : fin du tour, ou choix de l'IA niveau 1) ; l'adversaire, lui, est marqué « Ne répond plus » 20 s après la fin de son temps.
- **Cosmétiques** : `TAPIS` et `SLEEVES` en bas du fichier (identifiants = articles de `shop_items` ; chaque tapis a sa vignette `-mini.webp`). Les Essences Brillantes possédées brillent en combat. Le serveur ne pose qu'un tapis qui en est un, et un sleeve qui en est un (`combat_reglages`, `est_cosmetique_combat` dans `21_reflets.sql`, `estCosmetiqueCombat` dans le faux serveur) : un article de catégorie `tapis` ou `sleeve`, un article d'événement qui en porte le nom (« Tapis « … » »), ou un palier de Pass de ce type.
- Vitesse : `JEU.rapide` (clé `mtcg.jeu`, écrite par le seul `sauverJeu`, `settings.js`) (×0,55) ; mouvement réduit ×0,4.

### 7.7 Le tutoriel (`js/combat/tutoriel.js`)

Une partie écrite d'avance (`graine 7`, `ordre: true`, Réserves rose contre mauve ; decks `TUTO_MOI` / `TUTO_LUI` de 40 cartes, dans l'ordre main, PV, pioches ; **4 PV contre 2** (`TUTO_PV` : le Rival n'en a que 2 pour que la partie tienne en cinq tours, et la première bulle le dit). **Réécrite en 3.0.12 pour les règles officielles.** Le Rival est scénarisé aux tours 2 et 4 (`tutoRival` : le Coach Mercato, deux Joueurs, une attaque ; La Planète défend au tour 3 et revient par Légion), puis joue en niveau 1. **22 étapes** (`ETAPES`) : le but, la main de départ, l'entretien et les quatre phases, le Terrain, les sortes de cartes, deux Joueurs déployés le même tour, un Objet lié, la restriction par couleur (Caprice de Gotaga, Jade, ne se joue pas), pas de combat au premier tour, la défausse de fin de tour, défendre avec le Joueur de la même ligne, un nouvel entretien, Provocation, un Moment, payer et déclarer une attaque, **le soutien** d'un voisin (Vandale, +120 avec Cooked, contre La Planète), toucher le CEO, la Résilience (Gros Bonnet, « jouez cette carte »), puis la partie libre (deux touches gagnent au tour 5). Une étape « à lire » attend « Compris » ; une étape « à faire » allume ce qu'il faut toucher (`vise` → sélecteurs CSS) et l'arène refuse les autres coups (`guide.permis`). **16 remarques** (`REMARQUES`) à la première occurrence (Shield, Légion, il tient, la défausse du Rival, vaincu, touché, plus de PV, trois cases prises, Garde, Riposte, bench, défendre et soutenir en partie libre…). La fin écrit `mtcg.tutoriel` et appelle `tutoriel_fini` (quête « Premiers pas », 200 Éclats une fois). La variable `--tuto-h` arrête la carte agrandie au-dessus de la bulle. **Le tutoriel dépend du DOM de l'arène** : changer une classe de `table.js` peut le casser en silence (les sélecteurs fautifs sont avalés) — le rejouer dans un navigateur à chaque retouche de l'arène.

### 7.8 L'onglet Combats (`js/battle.js`, `css/combat.css`)

- **Vues** (`cbVue`) : `accueil`, `solo`, `campagne`, `arcade`, `raid`, `versus`, `decks`, `missions`, `guides`, `historique`, `atelier`. Sans Section, `vChoixSection()` s'affiche d'abord (Toxique ou Déter, avec leur Starter et leur Promo) ; seul « Apprendre d'abord » y échappe : il ouvre le Guide (et le tutoriel) avant de choisir, et son retour ramène au choix.
- **L'accueil** : le bandeau illustré (`assets/combat/banniere-combats.webp`, le chevalier de « La Luxueuse III »), Section et niveau, le Tutoriel en avant, l'affiche du prochain combat de campagne, les portes Solo et Versus, l'affiche du Raid, les raccourcis Decks, Missions (quêtes de combat et de niveau), Guide, Historique (3.0.12 ; quatre colonnes égales, `minmax(0,1fr)`).
- **Lancer un combat** : `demarrer(o)` appelle `combat_debut(mode, cle, niveau)` → `{id, graine}`, puis `ouvrirArene` → `Table.ouvrir({sauver: 'mtcg.combat.encours', surFin: finirCombat})`. `finirCombat` envoie `combat_fin(id, gagne, {tours, vaincus, touches, pv, actions, histo})` et affiche ce qui a été gagné. Un combat interrompu se reprend (`reprendreCombat`, par `Combat.rejouer`). **Depuis la 3.0.12, une partie finie reste notée** (`fini`, `mtcg.combat.encours`) jusqu'à ce que `combat_fin` ait pris son résultat : refusé (une maintenance, le réseau), l'accueil montre « Combat terminé · Son résultat n'a pas été enregistré » avec « Envoyer » (`envoyerCombatFini`) et « Oublier » ; avant, l'arène l'effaçait dès la fin, et une victoire refusée était perdue (le serveur la comptait perdue au combat suivant).
- **Les abandons (3.0.14)**, demandés par le propriétaire (« Les combats abandonnés comptent comme une défaite seulement en online ou en raid. Et ils n'aident pas à avancer des quêtes ») : la page dit au serveur qu'il y a eu abandon (`resumeCombat` → `abandon`) ; `combat_fin` ne fait alors avancer **aucune quête**, et **en solo** (campagne, Arcade, Épreuve) ne compte rien d'autre — ni défaite, ni série, ni XP ; l'historique le garde ; l'essai d'une Épreuve reste pris (il est compté à l'ouverture) ; **au Raid**, il compte comme une défaite (ses dégâts comptent, `raid_fin` sans quête). **En Versus**, `defi_fin` voit l'abandon dans les actions du défi (celles que le serveur a rangées, pas ce que dit la page) : défaite pour qui abandonne, aucune quête pour les deux. Un combat **laissé ouvert** (`combat_debut` en ouvre un autre) ne compte plus perdu qu'au Raid. La confirmation le dit (`texteAbandon`, `js/combat/table.js`). Le faux serveur fait de même. Test : `tools/tests-sql/abandon.sql`.
- **L'historique des combats** (3.0.12, `js/combat/historique.js`, demandé par le propriétaire : « juste un historique tour par tour », sans replay) : les **30 derniers combats** contre l'IA et entre amis (pas le tutoriel, écrit d'avance). À la fin d'un combat, `Historique.entree(E, moi, meta)` résume la partie à partir des événements du moteur (`E.ev`) — les gestes que le journal de l'arène racontait, rangés par tour, en lignes compactes (`['de', qui, 'c078', 0]` : un code, des identifiants de cartes, des valeurs ; `qui` relatif, 0 = soi) — et la page l'envoie avec le résultat (`p_resume.histo` de `combat_fin`, `p_histo` de `defi_fin`, et l'abandon depuis l'accueil, rejoué depuis la sauvegarde). Le texte se refait à l'affichage (`Historique.ligne`) : « Tu déploies… », « Lumen remplace X par Y » (un Joueur bench juste avant un déploiement à sa place : une seule ligne), « Il tient : 500 contre 600 », « Tu prends ton PV du dessus en main ». Un combat pèse **1,2 Ko en moyenne, 2,1 Ko au plus** (300 parties au hasard) ; au-delà de 24 000 signes, les derniers tours sont coupés et la fiche le dit. Combats › Historique : le bilan (victoires, défaites, taux), une ligne par combat (V ou D, l'adversaire, le mode, quand, combien de tours), et un toucher ouvre la feuille du déroulé, tour par tour (le sien sur un filet lavande, celui de l'adversaire sur un filet rouge). Le serveur ajoute le mode, l'heure, le résultat et, pour un défi, l'adversaire tel qu'il le connaît ([§ 9.3](#93-les-tables-45)). **Ce qui n'y entre pas** : un combat compté perdu parce qu'un autre a été ouvert (`combat_debut`) — le serveur n'en a pas le déroulé —, un combat fini par un navigateur d'avant la 3.0.12, le tutoriel.
- **Guides** (`js/combat/guides.js`) : deux onglets, Règles (chapitres `GUIDES`, réécrits en 3.0.12 pour les règles officielles ; le dernier, `lectures`, dit ce que le texte officiel ne tranche pas) puis Glossaire (`GLOSSAIRE()`, 56 mots reliés à leur chapitre).

### 7.9 Les modes

| Mode | Fichiers | Ce que c'est | Ce que ça rapporte |
|---|---|---|---|
| **Campagne** | `campagne.js` | 20 rivaux **de l'autre Section** (`RIVAUX`), en 4 actes ; IA 1 → 5 (`NIVEAUX_CAMPAGNE`), règles spéciales aux combats 5, 10, 15, 20 (`REGLES_CAMPAGNE`) ; la finir donne la Promo de l'autre Section | une récompense par combat (`RECOMPENSES_CAMPAGNE`, 3 400 Éclats, 14 boosters, 2 800 Fragments en tout), puis 10 Éclats en rejouant |
| **Arcade** (`'infini'` côté serveur) | `battle.js` | 5 difficultés, deck adverse tiré de la graine du serveur | 10 / 15 / 25 / 35 / 50 Éclats ; **5 victoires payées par jour** (`PVE_PLAFOND`) |
| **Raid** | `raid.js`, `RAID` dans `choc-data.js`, `27_raid.sql` | un boss commun au serveur, déjà posé sur le plateau, pour **deux semaines** : un **raid** (une « saison » dans les tables). **Depuis la 3.0.11, les raids se comptent depuis le premier jour du Choc** (`raid_ancre`) : le raid 1 commence avec lui (**The French Sorcerer**, `c116`), le raid 2 quatorze jours plus tard — **depuis la 3.0.13, le lendemain de la fin du Choc**, qui dure deux semaines (**Le Marionnettiste**, `c121`) —, puis ils alternent (`raid_boss`, `RAID.bosses`). **La page ne nomme un boss qu'à son arrivée** (3.0.13, le propriétaire : « ne mentionne pas le marionnetiste avant sa sortie, juste le fait que les raids sont périodiques ») : guides, fenêtre des nouveautés, tuile du Choc et texte de l'événement disent « un nouveau boss toutes les deux semaines » ; seul le Labo, réservé aux administrateurs, nomme le suivant. Chacun a son deck (`deckBoss`), son cadre, son tapis (`t_orage`, `t_ficelles`). **6 phases** abattues par les dégâts de tous (chacune ouvre un coffre commun), 3 paliers personnels, puis le mode Infini. **3 tentatives par jour**. Les coffres s'ouvrent un par un (le « Tout ouvrir » de la 3.0.11 est retiré en 3.0.12, comme celui des boosters) | coffres ; 2 Éclats par dégât +15 si victoire (3 Étincelles par dégât +15 pendant le Choc) |
| **Épreuve du jour** | `choc.js` | pendant le Choc seulement ([§ 8.6](#86-le-choc-des-sections)) | Étincelles |
| **Versus** | `defis.js`, `23_combats.sql` | défi entre amis, en direct, 60 s par tour ; le serveur range les actions numérotées, chaque navigateur rejoue celles de l'autre ; les deux déclarent le gagnant (désaccord noté) | 40 Éclats la victoire, 15 la défaite, **3 défis payés par jour** ; rien sous 12 actions |

Le seuil des phases du Raid se règle sans redéployer : `update public.parametres set raid_echelle = 0.5 where id = 1;` (rétroactif : recalculé à chaque lecture).

**Les deux boss (3.0.11)** : avant, les raids se comptaient depuis le lundi 12 octobre 2026, et le premier raid du Choc s'appelait « saison 2 » ; les écrans disent désormais « Raid 1 », « Raid 2 », avec le boss. Le serveur dit lequel (`raid_etat` › `boss`, `labo_etat` › `raid.boss`) ; tout le reste (nom, visage, phrase, cadre, tapis) est dans `RAID.bosses`. **Depuis les règles officielles (3.0.12), les deux boss ont un PV et une Essence d'avance de moins que la phase** (`ajuste`) : le joueur n'a plus que 4 PV, et le Sorcier aux chiffres de la phase tombait à 43 %, 10 % et 6 % de victoires aux phases 1, 3 et 5 ; réglé, 65 %, 30 % et 15 %, le Marionnettiste 66 %, 26 % et 8 % (un Starter, IA niveau 3, 80 combats par case ; le serveur compte toujours les dégâts avec les PV de la phase). **Le Marionnettiste avait été réglé le premier** (3.0.11) : à phases égales, son attaque (trois Essences de n'importe quelle couleur, 160 dégâts) le rendait bien plus dur que le Sorcier (mesuré, 80 combats par case, un Starter et l'IA niveau 3 : le joueur gagnait 35 %, 5 % et 0 % des phases 1, 3 et 5, contre 53 %, 26 % et 8 %). Il a donc **un PV et une Essence d'avance de moins que la phase** (`ajuste`, appliqué par `raidCombat(cle, boss)`) : 63 %, 29 % et 8 %, et des dégâts comptés par le serveur équivalents (≈ 6,5, 5,7 et 3,9 par combat, contre 6,5, 5,8 et 4,2). Ce réglage n'existe que dans la page : le serveur compte les dégâts avec les PV de la phase (`raid_combat`), si bien qu'une victoire vaut autant contre les deux boss. Le choix du Marionnettiste est celui de la session, à valider par le propriétaire. Les decks du Sorcier n'ont pas changé (vérifié sur 1 320 decks).

### 7.10 XP et niveau de combattant (`js/combat/niveaux.js`, `26_niveaux.sql`)

Chaque combat fini rapporte de l'XP, **sans limite** : 50 la victoire, 20 la défaite (rien sous 6 tours), × un facteur de difficulté, +4 par Joueur vaincu (6 au plus) ; défi 80 / 35. `xpRequis(n) = min(100 + 25(n−1), 1100)`. Chaque niveau paie **50 Éclats** ; des paliers (3, 5, 10, 15, 20, 25, 30, 40, 50) ajoutent boosters, cadres Arène (`f_niv10/20/30/50`) et titres ; au-delà de 50, 2 boosters tous les 5 niveaux. Le niveau s'affiche en pastille sur l'avatar. Attention : `NIVEAUX` (global, ici) n'a rien à voir avec `IA.NIVEAUX`.

### 7.11 Ce que le serveur vérifie

Le serveur **ne fait pas tourner le moteur**. Il fixe la graine de chaque combat (`combat_debut`, table `combats_ouverts`), plafonne ce qu'un combat rapporte, et **croit le navigateur sur le résultat** : un combat de moins de 20 s ne rapporte rien ; 5 victoires payées par jour, partagées entre l'Arcade et la campagne rejouée (les premières victoires de campagne, le Raid et l'Épreuve n'y comptent pas) ; 3 défis payés ; un défi de moins de 12 actions ne paie pas ; les dégâts du Raid sont plafonnés (PV du boss + 1, + 3 si victoire). Un essai d'Épreuve ou une tentative de Raid est **consommé au départ** (abandonner ne le rend pas). **Le deck n'est pas envoyé au début d'un combat contre l'IA** : `deck_erreur` (qui recopie 40 / 10 et la limite de 3 par nom et couleur, `cle_copie`) ne vérifie un deck qu'à l'enregistrement (`deck_sauver`, qui accepte un deck incomplet) et pour un défi (`deck_defi_erreur`, deck complet exigé).

### 7.12 Recettes

- **Ajouter ou modifier l'effet d'une carte** : écrire `S.cNNN = {…}` dans `effets.js` (texte imprimé en commentaire), en ne passant que par `O.*` et `x.E` ; émettre un `O.ev(E, {t:…})` pour tout ce que l'arène doit montrer (et son geste dans `ANIM` si `t` est nouveau) ; ajouter tout nouveau `but` à l'IA ; toujours fournir `jouable` / `resPossible` ; écrire un test dans `tools/combat-tests.js` (`situation()`), puis `combat-sim.js aleatoire 2000` et `clone 200` ; noter toute lecture ambiguë dans `docs/regles-3.0.md` § 10.
- **Ajouter une étape au tutoriel** : un objet dans `ETAPES` **à sa place chronologique** ; outils `tourDe`, `tuU`, `tuIdDe`, `enMain`, `surPlateau`, `placesLibres` ; mettre à jour le test du tutoriel dans `combat-tests.js` et rejouer le tutoriel dans Chromium.
- **Changer une valeur de règle** : `REGLE`, **puis** les copies en dur : SQL (`deck_erreur` pour 40 / 10, `limite_copies` pour 3, `cle_copie` pour « même nom et même couleur », la table `starters` qui recopie `Decks.STARTERS`, tout dans `23_combats.sql`), textes de `guides.js`, du tutoriel et de l'arène, `docs/regles-3.0.md` § 13 ; et mesurer avec `combat-sim ia`.
- **Ajouter un mode contre l'IA** : `demarrer({mode, cle, niveau, deck, deckIA, …})` ; dans `23_combats.sql`, trois endroits : le test `if p_mode not in (…)` de `combat_debut`, la contrainte `check (mode in (…))` de `combats_ouverts` (dans un `create table if not exists` : sur une base existante, `alter table public.combats_ouverts drop constraint combats_ouverts_mode_check, add constraint …`), et l'aiguillage de `combat_fin` (un mode inconnu y est payé comme l'Arcade) ; `xp_combat` (`26_niveaux.sql`) si l'XP diffère ; enfin `RPC.combat_debut` / `RPC.combat_fin` de `_demo/serveur.js`.
- **Changer ce que raconte l'historique** : un code de ligne dans `resumer` (l'événement du moteur qu'il traduit) **et** son texte dans `ligne` (`js/combat/historique.js`) ; un ancien code inconnu s'affiche vide (`ligne` rend '') : garder les codes déjà écrits tant que des combats les contiennent (trente par joueur). Le nombre gardé : `limit 30` d'`historique_ajouter` (`23_combats.sql`), `Historique.MAX` et `l.splice(30)` du faux serveur.
- **Ajouter un tapis ou une sleeve** : l'image (et sa `-mini`) dans `assets/combat/…` (générée par `tools/cosmetiques.py` ou `choc-visuels.py`), l'entrée dans `TAPIS` / `SLEEVES`, l'article `shop_items` du même identifiant (SQL et `BOUTIQUE` du faux serveur), de catégorie `tapis` ou `sleeve` — ou, pour un article d'événement, un nom qui commence par « Tapis » ou « Sleeve » ; ou un palier de Pass de type `tapis` / `sleeve`. Sans l'un des trois, le serveur refuse de le poser, et un tapis serait compté parmi les titres.

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
  - **Pass Choc** (20 paliers, 20 → 2 500, depuis la 3.0.13 ; 30 paliers jusqu'à 3 500 pour les trois semaines d'avant) : 16 boosters, 1 100 Éclats, 2 100 Fragments, 3 Reverses Rares, la Brillante (palier 12), la sleeve `s_choc` (5), le cadre `f_choc` (9), les titres `t_recrue` (2), `t_veteran` (15), `t_maitre_choc` (19), et **le tapis `t_arene`** (20).
- **Boutique d'événement** (`categ = 'evenement'`, `devise = 'prismes'`, `limite` par joueur) :
  - Reflets : `ev_boosters` (70, ×5), `ev_fragments` (60, ×5), `ev_reverse` (150, ×3), `t_collect` (200, unique) ;
  - Choc : `ch_boosters` (2 boosters, 80, ×10), `ch_boosters5` (5 boosters, 180, ×3), `ch_fragments` (500 Fragments, 70, ×8), tapis `t_orage` « The French Sorcerer » (600), titre `t_supporter` (200), cadre `f_foudre` (400) — **3 100 Étincelles** pour tout acheter. L'ordre (`shop_items.ordre`) place le tapis et le cadre du Sorcier l'un sous l'autre, dans la même colonne de la grille à deux colonnes.

### 8.4 Le récap

`evenement_recap()` renvoie le total, les paliers atteints / pris, les illus trouvées, les Reverses, les quêtes réclamées, le rang, le nombre de joueurs et le podium ; pour le Choc s'ajoutent les dégâts au Raid, les phases tombées et les Épreuves (`choc_recap`). Le Labo montre celui du Choc avec des chiffres inventés (`apercuRecapChoc`), sans rien enregistrer ; l'aperçu de celui de Reflets a été retiré en 3.0.9.

### 8.5 Reflets (2.0) et Devine l'illu

- **Reflets** (`js/reflets.js`, `css/reflets.css`, `supabase/installation/21_reflets.sql`) : l'événement de la 2.0, terminé en production. Son onglet a six sous-onglets (Accueil et ses Nouveautés 2.0, Quêtes, Pass, Devine l'illu, Boutique, Classement). Son code et sa CSS servent de **charpente** au Choc. En pré-prod, il est remplacé par le Choc.
- **Devine l'illu** survit à l'événement, dans son onglet (`illu`, tiroir) : une illustration par jour de Paris, la même pour tous, dans un ordre secret (cartes triées par `md5(illu_sel || ':' || id)`, cycle de 113 jours ; le sel `parametres.illu_sel` n'est jamais montré). Pixels 36 × 24 à 12 bits dans `illu_pixels` (`21b_illu.sql`, généré par `node tools/illu-pixels.js`) ; le serveur n'envoie que la grille du niveau en cours (9 × 6 → 12 × 8 → 18 × 12 → 36 × 24) et ne révèle la carte qu'à la fin. 4 essais ; gains 120 / 90 / 60 / 30 Éclats, plus 25 / 18 / 12 / 6 Prismes **pendant Reflets seulement** (`illu_gain`). Partage façon Wordle. En pré-prod, les grilles viennent de `preprod/js/demo-illu.js` (`window.DEMO_ILLU`), écrit par `tools/demo.py` à partir de `21b_illu.sql` ; l'ordre des illustrations n'y est pas salé.

### 8.6 Le Choc des Sections

L'événement de la 3.0 (`code = 'choc'`, **deux semaines depuis la 3.0.13** — trois avant ; à la demande du propriétaire, le 1er novembre : « comme ça quand l'event finit, on enchaine direct sur le marionnetiste » ; `js/choc.js`, `css/choc.css`, `js/combat/choc-data.js`, `supabase/installation/25_choc.sql`). Il oppose les deux Sections : **Toxique** (vert, Squeezie le Toxique, #012) et **Déter** (violet, Brawks Déter, #077).

- **Sept sous-onglets** (`CH_ONGLETS`) : Accueil (l'affiche coupée en biais `chAffiche()`, les Nouveautés de la 3.0), Raid, Épreuve, Quêtes, Pass, Boutique, Classement (Raid ou Étincelles).
- **L'Épreuve du jour** : un combat imposé, **le même pour tous** (`choc_etat()` donne `jour` et `graine` ; le client en tire la règle du jour parmi 7 — `eclair`, `siege`, `renforts`, `miroir`, `outsider`, `marathon`, `classique` — et les decks de niveau 3 par `epreuveDuJour`). **Une par jour de l'événement, numérotée (3.0.11)** : `choc_etat()` donne aussi `n` (le n-ième jour, heure de Paris) et `jours` (les dates que l'événement touche : 14 pour un Choc ouvert à minuit) ; l'écran dit « Épreuve 5 sur 14 ». La règle suit un **calendrier de deux semaines** (`CHOC.epreuve.calendrier`, la troisième semaine retirée en 3.0.13) : chaque semaine a les sept règles dans un ordre à elle, jamais la même deux jours de suite ni le même jour de la semaine d'une semaine à l'autre, la première est « Classique » ; hors de ces 14 jours, la règle tourne avec la date, comme avant. Les decks changent chaque jour avec la graine. Vérifié : les 14 jours ont des decks valides (quatre graines chacun), le calendrier tient ses règles (`tools/combat-tests.js`), `n` et `jours` sur PostgreSQL. **3 essais**, le meilleur compte (`scoreEpreuve` ↔ `choc_score`). L'essai est enregistré perdu dès le départ. 5 Étincelles par essai joué (plus de 20 s), +25 à la première victoire du jour. Le serveur ne vérifie ni la règle ni les decks.
- **Le Raid paie en Étincelles** pendant le Choc (3 par dégât, +15 si victoire), et alimente `choc_joueurs`. Les tuiles « Aujourd'hui » disent le raid (« Raid 1 », la phase, le boss) et l'Épreuve (« Épreuve 9 sur 14 »).
- **Les Nouveautés** (`vChNouveautes`) : la grande bannière des Combats (`.ch-nv-combats`, le chevalier cadré sur son médaillon comme dans l'onglet Combats), les Secrètes en éventail (celles qu'on possède se retournent, **toutes floutées**, même révélées, depuis la 3.0.11, pour que les cinq se répondent ; elles mènent aux Classiques), la refonte visuelle (qui ouvre `montrerNouveautes30`), et une grille de six tuiles (maîtrise, Raid, **l'échange des Brillantes** — qui ouvre une demande d'échange du côté des Spéciales, `data-act="echange-brillantes"` ; elle remplace le cadre Secrète depuis la 3.0.11 —, niveau, tapis et sleeves, atelier).
- **Les bandeaux** (`vBandeauChoc`, écran Boosters et Boutique) : l'affiche des deux Sections, la coupe mesurée depuis la droite (172 px) pour que la tête de Brawks tombe entière entre la coupe et la flèche ; rien ne se pose sur elle (ce qui reste à prendre : une pastille au coin ; dans la Boutique, le solde passe dans le texte).
- **Visuels** (`tools/choc-visuels.py`) : les affiches `choc-toxique.webp` et `choc-deter.webp`, les tapis `t_arene` (Brawks en haut — la même illustration que la bannière, avec ses couleurs, à l'échelle 1,5 depuis la 3.0.11 : elle couvre le camp du haut jusqu'au bord, la tête au milieu du camp adverse ; avant, un fondu de 200 px laissait une bande sombre en haut du tapis —, Squeezie en bas) et `t_orage`, la sleeve `s_choc`. Cadres `f_choc` et `f_foudre` (`tools/cadres-30.py`).

### 8.7 La fenêtre des Nouveautés

`montrerNouveautes()` (`js/bienvenue.js`) s'ouvre une fois par version et par appareil (`NOUVEAUTES_VERSION = '3.0'`), et **se rouvre** quand un événement est annoncé puis quand il commence (clé `titre|debut|avant/pendant`). Elle se rouvre aussi à la main (`data-act="nouveautes"` : bandeau, tuile « refonte », Labo). Pour une nouvelle fenêtre : changer `NOUVEAUTES_VERSION`, écrire `montrerNouveautesXX()` **et** modifier le dispatch de `montrerNouveautes()`, qui teste `=== '3.0'` en dur. À ne pas confondre avec la page « Nouveau dans la 3.0 » de l'onglet du Choc (`vChNouveautes`).

### 8.8 Recettes

```sql
-- Lancer un événement à code (production)
insert into public.evenements (titre, texte, debut, fin, code) values
  ('Le Choc des Sections', 'La version 3.0 : …', '2026-11-02 00:00+01', '2026-11-16 00:00+01', 'choc');
-- À minuit, heure de Paris : 14 Épreuves (1 à 14), le raid 1 le premier jour, le raid 2 le lendemain de la fin.
-- Boosters doublés (sans code) : … (titre, texte, debut, fin, ticket_minutes) values (…, 120)
-- Arrêter : le récap s'affiche 3 jours (pour le sauter : fin = now() - interval '3 days', en gardant fin > debut)
update public.evenements set fin = now() where code = 'choc' and fin > now();
-- Ouvrir la chasse
update public.chasse set active = true, ouvre_le = now() where id = 1;
```

- **Ne jamais réutiliser un code** : soldes, paliers pris et quêtes `ev` (clé `'all'`) sont indexés par code. Relancer `reflets` repartirait de la première édition : Prismes restants et Pass déjà avancé, paliers déjà pris impossibles à reprendre, quêtes « ev » déjà encaissées.
- **Ne pas chevaucher** un événement sans code et un événement codé : le client affiche le dernier commencé (avec ou sans code, `evenement_actif`), le serveur crédite le dernier **codé** (`evenement_en_cours`) — l'onglet du Choc disparaîtrait pendant que le serveur continue de payer.
- **Ajouter un nouvel événement** : SQL (Pass `evt_piste`, quêtes `evenement = code`, articles `devise = 'prismes'`, ajoutés aux listes `delete … not in` de `04_seed.sql`, message d'erreur de `shop_buy`, éventuellement un `xxx_recap`) ; JS (`MONNAIES_EV`, `evIco`, `TABS`, `VUES`, `RECAPS`, `pastilleOnglet`, chargement dans `aller()`, `vBandeauEvenement`, bandeau de la boutique, `proposerAccueil`, Labo) ; faux serveur (`PISTES`, `QUETES`, `BOUTIQUE`, `S.evenement`).
- **Changer l'Épreuve ou le Raid** : `CHOC` / `RAID` dans `choc-data.js` **et** les valeurs écrites en dur dans `25_choc.sql` (`>= 3`, `'max', 3`, `insignes := 5`, `+ 25`, `'niveau', 3`, et `choc_score`, copie de `scoreEpreuve`) et `27_raid.sql` (`raid_phases()`, `raid_perso()`, `raid_fin()`, `n < 3`, `raid_combat()` pour la formule de l'Infini, `raid_ancre()` / `raid_saison()` / `raid_saison_debut()` pour le départ — le premier jour du Choc, sinon le 12 octobre 2026 — et les 14 jours, `raid_boss()` pour l'ordre des boss, à tenir d'accord avec `RAID.bosses`). Un boss de plus : une entrée de `RAID.bosses` (et son `ajuste` mesuré, voir [§ 7.9](#79-les-modes)), le tableau de `raid_boss()`, un tapis dans `TAPIS_BOSS` (`js/combat/table.js`). Le calendrier des Épreuves : `CHOC.epreuve.calendrier` (21 identifiants de règles).

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
| `01`, `02`, `03`, `03b`, `04`, `06`, `07`, `11`, `12`, `14`, `15`, `18`, `21`, `21b`, `22`, `22c`, `23`, `24`, `25`, `26`, `27`, `28`, `29` | **Installation**, rejouable (`if not exists`, `on conflict`, `create or replace`) | oui, dans cet ordre (`MORCEAUX`, `tools/build-sql.py`) |
| `02_cards.sql`, `21b_illu.sql` | **Générés** (`python3 tools/gen-cards-sql.py`, `node tools/illu-pixels.js`) : ne jamais éditer | oui |
| `administration/admin.sql`, `beta.sql`, `reset-profil.sql`, `reset-tout.sql`, `fix-crlf.sql` | **Outils d'administration** ponctuels ([§ 9.10](#910-outils-dadministration)) | non |

Les fichiers d'installation vivent dans `supabase/installation/` ; leur préfixe numérique est leur ordre dans `TOUT.sql` (les numéros manquants, `05`, `08`–`10`, `13`, `16`, `17`, `19`, `20`, étaient des outils, devenus `administration/`, ou des **mises à jour historiques** des bases 1.4 / 1.5, dangereuses à rejouer et **supprimées en 3.0.8** : elles restent dans l'historique git, commit `80a621f` et avant).
| `TOUT.sql` | **Assemblé** par `python3 tools/build-sql.py` (~6 800 lignes) : c'est ce qu'on colle dans Supabase | — |

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
| `21_reflets.sql` | `parametres`, moteur d'événements (et `evenements.recap_jusqua`, la fin du récap réglable, reportée de la 2.5) (`evt_*`, `accorder`, Pass), Devine l'illu, invitations, titres, `personnaliser` ; **crée l'événement Reflets pour 14 jours s'il n'existe pas** |
| `22_garder.sql` | À garder, favoris |
| `22c_reverses.sql` | Reporté de la 2.5 : `reverses_ouvertes()`, `prix_reverse()`, la colonne `parametres.reverses_des` |
| `23_combats.sql` | Sections, decks, combats (`combat_debut` / `combat_fin`), campagne, Arcade, Starters, défis, tutoriel |
| `24_secretes.sql` | Les 5 Secrètes |
| `25_choc.sql` | Le Choc : Pass, Épreuve, `choc_etat`, `choc_recap` |
| `26_niveaux.sql` | XP et niveaux |
| `27_raid.sql` | Le Raid par saisons et phases, `raid_echelle` |
| `28_maitrise.sql` | Maîtrise et carte fétiche |
| `29_labo.sql` | Le Labo ([§ 10](#10-le-labo-administrateurs)) : `labo_*`, `labo_sauvegardes` ; retire le calendrier et les outils de L'Échauffement du Labo de la 2.5, et ferme le mode sans fin de la 2.5 (`ech_sf_*`) |

**Ordre** : `03b` avant `04` (la boutique vend `p01`) ; `21` avant `21b` ; `23` avant `26`. Ailleurs, PL/pgSQL résout les appels à l'exécution : `me()` (07) appelle des fonctions de 11 à 28 — **il faut passer tout `TOUT.sql`**.

### 9.3 Les tables (46)

- **Joueur** : `profiles` (pseudo, avatar, cadre, `shards`, `fragments`, `tickets`, `last_tick`, `boosters_bonus`, `tickets_offerts`, `is_admin`, `garder`, `vitrine`, `titre`, `banniere`, `devise`, `fetiche`…), `collection`, `inventory`, `quest_progress`, `favoris`, `gardes`, `tirages`, `recyclages`, `cadeaux`, `notifications`.
- **Catalogue et réglages** : `cards`, `quests`, `shop_items`, `parametres` (une ligne : `fabrication_reverse`, `reverses_des`, `illu_sel`, `raid_echelle` ; une base passée par la 2.5 a aussi `sorties`, que la 3.0 ne lit pas), `pve_campagne`, `pve_difficultes`, `starters`, `niveau_paliers`, `illu_pixels`, `evt_piste`.
- **Social** : `friendships`, `trades`, `annonces`, `invitations`, `beta_invites`.
- **Événements** : `evenements`, `chasse`, `evt_comptes`, `evt_piste_prises`, `devine_illu`, `choc_joueurs`, `choc_epreuves`.
- **Combat** : `combat_joueurs` (section, deck actif, cosmétiques, campagne, plafonds du jour, statistiques, `xp`), `decks`, `combats_ouverts`, `defis`, `combats_historique` (3.0.12 : les 30 derniers combats de chaque joueur et leur déroulé ; aucune policy, lue par `combats_historique()` et `combat_historique(p_id)`, écrite par `historique_ajouter`, appelée par `combat_fin` et `defi_fin` dans un bloc qui ne peut pas empêcher de payer).
- **Raid** : `raid_saisons`, `raid_tombees`, `raid_participants`, `raid_pris`, `raid_tentatives`.
- **Maîtrise** : `maitrises`, `maitrises_journal`.
- **Labo** : `labo_sauvegardes` (une par administrateur ; aucune policy).
- **Maintenance** (3.0.12) : `maintenance` (une ligne : `actif`, `message`, `fin`, `depuis`, `par` ; aucune policy, lue par `porte()` et `garde_beta()`, écrite par `labo_maintenance`).
- Une base passée par la 2.5 a en plus les tables de L'Échauffement (`ech_saison`, `ech_defis`, `ech_indices`, `ech_essais`, `ech_scores`, `ech_paliers`, `ech_joueurs`) : la 3.0 ne s'en sert pas et n'y touche pas, sauf le Labo (sauvegarde et remise à zéro de son propre compte).

Préfixes d'inventaire : `f_` cadres, `t_` titres **et** tapis, `s_` sleeves (et articles), `trade_token`.

### 9.4 Les RPC publiques (76, `porte` comprise)

| Domaine | RPC (→ retour) | Appelées par |
|---|---|---|
| Compte et état | `porte()` (aussi `anon` ; 3.0.12 : aussi `version` et `maintenance`), `me()` → l'état complet, `checkin()`, `set_profile(p_pseudo, p_avatar, p_frame)`, `personnaliser(p_titre, p_banniere, p_devise)`, `set_vitrine(p_cards)`, `utiliser_invitation(p_code)` | `gate`, `app`, `settings`, `profile` |
| Boosters, quêtes, boutique | `open_pack(p_bonus)` → `{cards, god, etat}`, `claim_quest(p_quest)`, `shop_buy(p_item)`, `mes_tirages()` | `opening`, `app`, `shop`, `tirages` |
| Collection | `regler_garder(p_carte, p_n)`, `regler_garder_defaut(p_garder)`, `favori(p_carte, p_on)` → liste, `recycler(p_lots)`, `fabriquer(p_carte)`, `maitriser(p_carte)`, `set_fetiche(p_carte)` | `viewer`, `settings`, `recyclage`, `maitrise` |
| Social | `trade_create`, `trade_respond`, `trade_cancel`, `trade_list`, `find_player`, `friend_request`, `friend_respond`, `friend_remove`, `friend_list`, `player_profile(p_pseudo)`, `amis_doublons()`, `classement(p_critere)`, `boite()`, `boite_lue()` | `trade`, `social`, `classement`, `boite` |
| Cadeaux | `mes_cadeaux()`, `ouvrir_cadeau(p_id)` | `cadeaux` |
| Administration | `annonce_publier`, `annonce_retirer`, `offrir_cadeau(p_joueurs, p_eclats, p_boosters, p_fragments, p_carte, p_message)`, `admin_joueurs()` | `lab`, `app` |
| Labo (administrateurs, `29_labo.sql`) | `labo_etat()`, `labo_evenement(p_etat, p_n)`, `labo_decaler(p_heures)`, `labo_evenement_raz(p_confirmation)`, `labo_reverses(p_ouvertes)`, `labo_raid(p_phase)`, `labo_raid_echelle(p_echelle)`, `labo_raid_raz(p_confirmation)`, `labo_cartes(p_quoi)`, `labo_monnaies(p_valeurs)`, `labo_cosmetiques(p_ids)`, `labo_combats_moi(p_action, p_valeur)`, `labo_sauver()`, `labo_restaurer()`, `labo_raz_moi()`, `labo_maintenance(p_actif, p_message, p_fin)` (3.0.12) | `lab` (`Backend.labo`) |
| Événements | `evenement_etat()`, `piste_reclamer(p_palier)`, `evenement_recap()`, `illu_etat()`, `illu_essai(p_carte)`, `choc_etat()`, `raid_etat()`, `raid_reclamer(p_saison, p_quoi, p_n)` | `reflets`, `choc`, `raid` |
| Combats | `tutoriel_fini()`, `combat_section`, `combat_reglages`, `deck_sauver`, `deck_publier(p_id, p_public)` (3.0.13), `deck_supprimer`, `combat_debut(p_mode, p_cle, p_niveau)` → `{id, graine}`, `combat_fin(p_id, p_gagne, p_resume)` → `{etat, recompense}`, `defi_lancer` (3.0.12 : pose `premier`, que `defi_etat` rend dans `init`), `defi_repondre`, `defi_etat(p_id, p_depuis)`, `defi_jouer(p_id, p_n, p_action)`, `defi_fin(p_id, p_gagnant, p_tours, p_histo)` (3.0.12 : la version à trois arguments est retirée), `combats_historique()` → la liste sans les déroulés, `combat_historique(p_id)` → un combat avec le sien | `battle`, `combat/*` |

La plupart des RPC qui écrivent renvoient `me()`, que `Backend.apply` transforme en `save`. **Le faux serveur `_demo/serveur.js` implémente exactement les mêmes 76** (vérifié en 3.0.10, puis en 3.0.12 : les fonctions exécutables par `authenticated` d'une installation passée par la base de `main`, moins les outils internes, celles de pgcrypto et celles de L'Échauffement laissées par la 2.5, sont les `RPC.*` du faux serveur). Les rouages internes (`regen_tickets`, `bump_quests`, `pick_card`, `check_promos`, `garde_beta`, `notifier`, `accorder`, `crediter_prismes`, `evenement_en_cours`, `titres_de`, `garde_de`, toutes les fonctions de combat, Choc, Raid, niveaux, maîtrise…) ne sont pas appelables depuis le navigateur.

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
| Reverses (ouverture, prix) | `reverses_ouvertes`, `prix_reverse` (22c ; aussi dans la 2.x) | `revDes`, `revOuvertes`, `prixReverse` | `REV_DEFAUT`, `revOuvertes` (`recyclage.js`) |
| Labo | `labo_*` (29) | `RPC.labo_*`, `laboEtat`, `laboCompte` | `js/lab.js` (`CHOC_JOURS` = 21) |
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
| `reset-profil.sql` | Remettre **un** joueur à zéro (pseudo en dur, deux endroits) : collection, monnaies, inventaire, quêtes, événements, combats (et leur historique, 3.0.12), maîtrise, fétiche ; garde le compte, le pseudo, la devise, les amis, les droits, la sauvegarde du Labo d'un administrateur | Annule ses échanges en attente ; rouvre la chasse s'il avait la carte unique ; ses dégâts au Raid restent dans le total de la saison |
| `reset-tout.sql` | Remettre **tout le monde** à zéro, le jour d'un vrai lancement (confirmation écrite exigée) | Efface aussi les dégâts du Raid (le boss repart plein) et les sauvegardes du Labo, et rouvre la chasse ; fermer le site (`PORTE.active = true`) et sauvegarder avant |
| `fix-crlf.sql` | Retirer les fins de ligne Windows (`\r\n`) des corps de fonction, après un fichier collé depuis un navigateur sous Windows ([§ 13](#13-pièges), point 33) | Rejouable, sans `delete` ni `drop` ; chaque fonction touchée est recréée depuis sa propre définition (mêmes droits) |

Les deux remises à zéro (réécrites pour la 3.0 en 3.0.8, testées sur PostgreSQL 16) ont un **garde-fou** : elles refusent de tourner si une table du schéma pointe vers `profiles` sans figurer dans leur liste `connues`. **Ajouter une table qui appartient à un joueur, c'est donc aussi l'ajouter à ces deux scripts** (l'effacer, ou la ranger parmi ce qu'on garde).

---

## 10. Le Labo (administrateurs)

L'onglet **Labo** (`js/lab.js`, `css/lab.css`, serveur `supabase/installation/29_labo.sql`) n'apparaît que pour `save.isAdmin` (posé en SQL, [§ 9.1](#91-principes-et-sécurité)). En pré-prod, le faux serveur rend le visiteur administrateur : **le Labo y est toujours ouvert**, et ses gestes s'y jouent sur le monde de démo. **Refait en 3.0.10** à la demande du propriétaire (« pouvoir gérer entièrement ce qui se passe : mon compte, le serveur, naviguer entre les états ») : ce qui touche le serveur est **réel**, ce qui touche son compte est **réel et se sauvegarde**, les aperçus restent **locaux**. Chaque fonction `labo_*` vérifie le droit (`labo_garde`) : cacher l'onglet ne protégerait rien. Le Labo n'est jamais redessiné en arrière-plan (`enTrainDEcrire()`).

Il a **cinq sous-onglets** (`labVue`, barre `.labvues` qui passe à la ligne plutôt que de cacher un onglet hors de l'écran) :

| Sous-onglet | Ce qu'il permet |
|---|---|
| **Serveur** (pour tout le monde) | **la maintenance** (3.0.12, en tête) : en service ou en maintenance (depuis quand, par qui), le message, l'heure de retour prévue (facultative, à l'heure de l'appareil), « Mettre en maintenance » (confirmé), « Mettre à jour », « Lever la maintenance » (confirmé), « Voir l'écran » (l'aperçu avec ce qui est saisi, sans rien envoyer) ; trois puces (le Choc, le Raid, les Reverses) et le calendrier en frise (début, fin et récap du Choc, saisons du Raid, ouverture des Reverses, « Maintenant ») ; **le Choc des Sections** dans un état : avant (2 min, 1 h), un jour de 1 à 21, son récap, fini (`labo_evenement` ; la ligne `choc` est créée si besoin, les autres événements sont clos), avancer ou reculer d'un jour (`labo_decaler`), la participation, **remettre le Choc à zéro** (écrire EFFACER) ; **le Raid** : le raid en cours (son numéro, son boss ; la frise montre le suivant et son boss) à une phase de 1 à 6 ou à l'Infini (`labo_raid`), l'échelle des seuils (× 0,25 à × 2), remettre le raid à zéro (EFFACER) ; depuis la 3.0.11, **un jour du Choc commence à minuit** (heure de Paris) : « jour 15 » pose l'Épreuve 15 et le raid 2 ; **les Reverses** : ouvrir, fermer ; **en vigueur** : joueurs, Sections, recharge, carte unique, barèmes de Fragments (Reverses comprises), et les requêtes SQL de ce que le Labo ne fait pas |
| **Mon compte** | **la sauvegarde** (`labo_sauver` / `labo_restaurer` : tout ce qui est à soi, l'historique des combats compris (3.0.12), sauf amis, boîte, échanges et défis ; une sauvegarde de la 2.5 se restaure aussi) ; **la collection** : master set (tout sauf la carte unique, à la limite d'un deck : de quoi construire n'importe quel deck), les 122, les cartes de combat, « Pour la maîtrise » (3.0.13 : chaque carte qui se maîtrise, avec de quoi la mener en Légende), vider ; **les ressources** : Éclats, Fragments, boosters en plus, réserve, monnaie de l'événement, niveau (l'XP posée au début du niveau, sans payer ses paliers) ; **les cosmétiques** : tous les cadres, titres, tapis et sleeves ; **repartir de zéro** |
| **Combats** | sa **Section** (Toxique, Déter, ou aucune pour la choisir de nouveau), la **campagne** gagnée ou à zéro (sans récompense), **rejouer aujourd'hui** (victoires payées, tentatives du Raid, essais de l'Épreuve), **tout maîtriser** ou les maîtrises à zéro (`labo_combats_moi`) ; puis **ce que le jeu cache**, en lecture seule : campagnes dévoilées, toutes les récompenses (`laboRecompenses`), une fin de combat à deux niveaux, la fiche de niveau, le bilan d'un Starter |
| **Joueurs** (réel) | `annonce_publier`, avec confirmation ; **offrir un cadeau** : Éclats, boosters, Fragments, une carte et un mot à un ou plusieurs joueurs (liste avec leur retard sur la médiane) ; aperçu sans rien envoyer |
| **Aperçus** (local) | **la maîtrise** (3.0.11 : les cinq finitions sur une carte au choix, la montée d'un niveau, l'entrée en combat d'un Joueur, d'un Moment, d'un Coach, d'un Objet, la fiche à ce niveau, [§ 6.7](#67-la-maîtrise-et-la-carte-fétiche-307-refaite-en-308-puis-en-3011)) ; ouvertures de test (normale, R / E / L / Secrète forcées, Essence Brillante, carte unique, Reverse Rare, godpack ; tirage local, rien n'est écrit), l'image de partage ; le Choc : Nouveautés 3.0, le récap avec des chiffres inventés (onglet, fenêtre, bandeau) ; les fenêtres (invitation `M8-TEST-0000`, cadeau reçu, **l'écran de maintenance**, 3.0.12 : son message en cours, ou celui de la mise à jour) ; l'obtention de chaque Promo ; les notifications (dont « Trois quêtes d'un coup », 3.0.11). « Revenir à l'état réel » efface un aperçu |

Sur le vrai site, un geste « pour tout le monde » demande une confirmation, et une remise à zéro qu'on écrive EFFACER ; dans la pré-prod (`labDemo()`), le faux serveur les joue sans rien demander (les remises à zéro demandent toujours le mot). Après un geste sur le serveur, la page relit `me()`, le Choc, le Raid et `porte()` (la maintenance).

Retiré en 3.0.10 : l'onglet **Affichage** (tout débloquer, vider, 90 %, +10 boosters, +5 000 Fragments, tous les succès, boosters illimités, qui ne changeaient que l'affichage jusqu'au rafraîchissement suivant : remplacés par les vrais gestes de Mon compte) ; « Maintenant » et « Scènes » sont devenus Serveur et Aperçus. Retiré en 3.0.9 : les aperçus de la chasse 1.5, le panneau « Version 2.0 · Reflets ».

**Une base passée par la 2.5** avait le Labo de la 2.5 (`22d_admin.sql` de la 2.x : mêmes noms pour les gestes communs). `29_labo.sql` le remplace, garde sa table `labo_sauvegardes`, et supprime ce qui n'a plus d'objet (`labo_calendrier`, `labo_ech_raz`, `labo_ech_moi`, `calendrier_officiel`, `poser_calendrier`, `calendrier_officiel_poser`), ainsi que le mode sans fin de L'Échauffement (les neuf fonctions `ech_sf_*`, et le déclencheur `ech_saison_evenement` avec sa fonction) : il devait durer « du temps qu'on pourra pas publier la 3.0 », et ses appels continueraient sinon de verser des Éclats à qui les lance à la main. Ses tables `ech_sf_scores` et `ech_sf_essais` restent ; « repartir de zéro » (`labo_tables()`) et les deux remises à zéro les vident. Tests : `labo_*` sur une base 2.5 + 3.0 rejouée deux fois (refus d'un joueur, droits, chaque état du Choc, chaque phase du Raid, remises à zéro avec et sans confirmation, master set à la limite de deck, niveau sans palier, restauration à l'identique, sauvegarde de la 2.5) ; la page dans Chromium aux quatre tailles.

Les clics du Labo passent par `clicPage` (`data-labv`, `data-lab` → `labAction`, `data-act="t-*"`, `data-promo`).

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

- Il définit `window.supabase = {createClient: () => client}` : **le code du jeu croit parler à Supabase**. Il implémente les **76 mêmes RPC**, avec les mêmes noms, paramètres et messages d'erreur, et `from('shop_items')`.
- **Un appel** (`appeler`) : charge l'état, refuse `'non connecte'` sans session, copie l'état, fait vivre les bots, exécute `RPC[nom](MOI, args)`, sauvegarde, attend 60 à 150 ms. **Une exception annule tout l'appel** (bots compris). Un refus s'écrit `refuser('…')` (jamais un `throw` brut : sur `me`, il déclencherait la recréation du monde).
- **Stockage** : l'état entier `S` dans IndexedDB (`kvSet('demo-serveur', S)`). Le seul numéro de schéma est `S.v === 1` : **ne jamais le changer** (cela effacerait toutes les parties). Les ajouts se font dans `completer()` (`S.x = S.x || …`) ou dans une fonction `mondeXX()` idempotente.
- **Il ne lit rien du jeu au chargement** (il est chargé avant `config.js`) : seulement à l'intérieur de fonctions (`cards`, `byId`, `Decks`, `Combat`, `IA`, `RAID`, `CHOC`, `niveauDe`, `recompenseNiveau`…).
- **Session** : connecté sauf si `localStorage['mtcg.demo.connecte'] === '0'` ; « Discord » pose `'1'`. **`?reinitialiser`** efface l'état du faux serveur (pas le `localStorage` du client : tutoriel vu, accueil, etc.).
- **Réglages** (`_demo/reglages.js`) : pseudo `Visiteur`, 6 000 Éclats, `ticket_minutes` 240, `raid_echelle` 0,25. Pseudo et Éclats ne valent que pour un monde neuf ; le rythme et l'échelle du Raid s'appliquent tout de suite (l'échelle posée par le Labo, `S.parametres.raid_echelle`, l'emporte).

### 11.3 Le monde de démo

- **Quatre bots** : Lumen (`f_or`, ami), Mira (`f_rose`, amie), Kairo (`f_azur`), Nova.92 (`f_prisme`, gagnant de la chasse : il porte `f_unique`). Leurs collections viennent de vrais tirages. Ils font leur check-in, acceptent une demande d'ami (6 à 20 s) ou d'échange (12 à 40 s ; le premier échange possible est toujours accepté, les suivants 3 fois sur 4), proposent des échanges, acceptent et jouent tes défis (IA niveau 3 ; `defi_fin` **rejoue** la partie, contrairement au vrai serveur), te défient une fois, frappent le Raid toutes les 30 s environ, tentent l'Épreuve. **Ils ne vivent que page ouverte** (minuteur de 4 s).
- **Événements** : `monde20()` crée Reflets, puis `monde30()` le remplace par **le Choc, commencé 4 jours avant la première visite en 3.0 et prévu pour 14 jours** (une partie de démo d'avant la 3.0.13, à 21 jours, passe à 14). Au-delà (10 jours plus le récap de 3), plus d'événement : le Labo (Serveur › Le Choc) le remet à n'importe quel jour, ou `?reinitialiser` recrée le monde. Les Reverses y sont ouvertes dès la création du monde (`revDes()`), sauf date posée par le Labo. Un seul `S.evenement` à la fois.
- **Raid** : `mondeRaid()` inflige 102 dégâts au raid en cours (avec `raid_echelle` 0,25 : deux phases tombées, la troisième en cours). Les raids se comptent depuis le début du Choc de la démo (`raidAncre()`, comme `raid_ancre`), qui commence à minuit quatre jours avant la première visite : on arrive au raid 1 et à l'Épreuve 5. Un monde d'avant la 3.0.11 (raids comptés depuis le 12 octobre) repart d'un Raid neuf une fois (`S.raid.v`).

---

## 12. Outils, sources et visuels

### 12.1 Les outils

| Commande | Dépendances | Produit |
|---|---|---|
| `python3 tools/version.py X.Y[.Z]` | aucune | `APP_VERSION`, la marque `?v=<version>-<empreinte>` d'`index.html` / `verif.html` et `VERSION` du service worker, liste `ESSENTIEL` |
| `python3 tools/demo.py [--preprod]` | aucune | `preprod/` ou `_build/m8tcg-demo(.zip)` |
| `python3 tools/build-sql.py` | aucune | `supabase/TOUT.sql` |
| `tools/tests-sql/*.sql`, `tools/tests-sql/maintenance.sh` | PostgreSQL 16 | les tests SQL de la 3.0.12 et de la 3.0.13 ([§ 2.3](#23-tester-le-sql-sur-un-postgresql-local)) |
| `tools/tester-sql.sh [tests.sql…]` | PostgreSQL 16 | joue `TOUT.sql` de `origin/main` (la 2.5, sans le Labo de la 2.5 ni le calendrier : pour une base fidèle à la production, jouer aussi `origin/version-2.5:supabase/calendrier-2.5.sql`) puis `TOUT.sql` deux fois sur une base locale ([§ 2.3](#23-tester-le-sql-sur-un-postgresql-local)) ; `tools/sql-stub.sql` imite Supabase |
| `python3 tools/equilibre-fragments.py [joueurs] [jours]` | aucune | les Fragments gagnés par semaine et la fréquence d'une carte : la base du barème de la maîtrise (modèle d'avant la 3.0.12 : 2 exemplaires gardés, 1 pour une Légendaire) |
| `python3 tools/equilibre-maitrise.py [joueurs]` | aucune | l'économie de la maîtrise (3.0.12) : le recyclage selon la limite de deck (2 ou 3), le temps pour maîtriser les cartes d'un Starter, le retard sur les 122 si la maîtrise passe d'abord, une Épique et une Légendaire seules ; lit `js/cards-data.js` et le Starter de `23_combats.sql` ; ≈ 1 min 30 pour 300 joueurs par ligne |
| `python3 tools/equilibre-reverses.py` | aucune | la simulation qui a fixé le prix des Reverses (400 / 500 / 2 400), reprise de la 2.5 |
| `python3 tools/gen-cards-sql.py` | aucune | `supabase/installation/02_cards.sql` |
| `node tools/illu-pixels.js` | Node, Playwright (Chromium) | `supabase/installation/21b_illu.sql` (puis `build-sql.py` et `demo.py`) |
| `node tools/combat-tests.js` | Node | les tests de règles |
| `node tools/combat-sim.js <mode> N …` | Node | parties simulées (`aleatoire`, `clone`, `ia`, `starters`) |
| `python3 tools/cadres.py` | aucune | les 9 cadres SVG de la 2.x (`assets/cadres/`) : 7 de la 2.0, 2 de la 2.5 (Braise, Ardeur) |
| `python3 tools/cadres-30.py` | aucune | les 9 cadres SVG de la 3.0 |
| `python3 tools/cosmetiques.py` | Pillow (AVIF) | 6 tapis (+ `-mini`), 2 sleeves, 2 boîtes de Starter, **les Secrètes 123 et 125 dans `cards/`** |
| `node tools/redresser-photo.js <photo> "<coins>" <largeur> <sortie> [qualité]` | Playwright (Chromium) | une photo de carte redressée en WebP (3.0.13 : P03, P04, Secrètes 124, 126, 127 ; la table des coins est dans le script) |
| `python3 tools/choc-visuels.py` | Pillow (AVIF) | 2 affiches du Choc, tapis `t_arene` et `t_orage`, le tapis du boss `t_ficelles` (3.0.11), sleeve `s_choc` |
| `python3.13 tools/gen-icons.py` | Pillow (WebP, AVIF) | icônes d'app, favicons (`favicon.svg` compris), `og-image.png` — **en graphite et lavande depuis la 3.0.11** (avant : la palette 2.1, et `sips` de macOS) |
| `python3 tools/kit-presse.py` | Pillow | `presse/visuels/*` |

L'environnement cloud a Node 22, Playwright et Chromium, `http-server`, PostgreSQL 16, et Python 3 ; **Pillow (avec l'AVIF) n'y est installé que pour `python3.13`** : le `python3` par défaut (3.11) ne le trouve pas, lancer `python3.13 tools/choc-visuels.py` (ou `cosmetiques.py`, `kit-presse.py`, `gen-icons.py`). Pas de `sips`.

### 12.2 Les sources (`_sources/`, branche de travail seulement)

| Source | Script | Sortie |
|---|---|---|
| `combat/brawks-deter.jpg` (1490 × 1055) | `choc-visuels.py` | `choc-deter.webp`, haut de `t_arene` |
| `combat/secrete-123.jpg`, `secrete-125.jpg` | `cosmetiques.py` | les deux Secrètes révélées |
| `combat/secrete-floue-a/b/c.jpg` | — | les trois Secrètes floutées, plus utilisées depuis la 3.0.13 (gardées pour revenir aux visuels floutés) |
| `combat/sleeve-argent.jpg`, `sleeve-sorcier.jpg` | `cosmetiques.py` | `s_argent`, `s_sorcier` |
| `combat/starter-deter.jpg`, `starter-toxique.jpg` | `cosmetiques.py` | `assets/combat/sections/*.webp` (détourées) |
| `combat/tapis-*.jpg / .webp` (6) | `cosmetiques.py` | `assets/combat/tapis/t_*.webp` |

Les autres visuels partent des cartes elles-mêmes (`cards/`). `assets/combat/banniere-combats.webp` est faite à la main (aucun script).

### 12.3 L'habillage (`assets/`)

- `cadres/` : 18 SVG animés (7 de la 2.0, 2 de la 2.5, 9 de la 3.0), branchés par `.ava.fx-<id> .fx-deco` dans `css/reflets.css` et `css/choc.css`.
- `combat/` : `tapis/` (9 + `-mini`, dont `t_ficelles`, le tapis du Marionnettiste, réservé au boss : `TAPIS_BOSS`), `sleeves/` (3), `sections/` (2 boîtes), `choc-toxique.webp`, `choc-deter.webp`, `banniere-combats.webp`.
- `boosters/booster-01…04.webp` (`PACK_ARTS`), `essences/*.svg`, `card-back.webp`, `logo-m8.webp`, `extension-logo.svg`, `favicon.svg`, `pack-star.svg`, `star-pink.svg`, `1st-edition.svg`, `jeton-echange.webp` ; icônes PNG et image de partage générées (`tools/gen-icons.py` : l'étoile du logo en dégradé lavande sur le graphite ; l'image de partage, le logo et cinq Légendaires en éventail).

### 12.4 Les images des cartes

- `cards/NNN_RAR_Catégorie[-SousType]_Couleur_Nom.avif` (1000 × 1397), `NNN` de 001 à 127 ; les Secrètes 124, 126 et 127 en `.webp` (900 × 1257, photos redressées). Le nom ne se découpe pas sur `_` (certains noms en contiennent).
- `cards/promos/PNN-Nom.webp` (640 × 880 ; P03 et P04, photos redressées, 640 × 894) ; `cards/uniques/U01-L_Unique_Chevaliere_v2.webp`.
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
12. **Mouvement réduit** : `RM()` lit la préférence système **et** le réglage du jeu (`html.rm`) depuis la 3.0.11. Avant, il ne voyait que la première : trois fichiers testaient la classe à la main, les autres ignoraient le réglage. Une animation en JS n'a besoin que de `RM()`.
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
31. **La base de production sera passée par la 2.5** quand la 3.0 sortira : tables `ech_*` de L'Échauffement, `evenements.recap_jusqua`, `parametres.reverses_des` (le 26 octobre 2026) et `parametres.sorties`, le Labo de la 2.5. Depuis la 3.0.10, `TOUT.sql` de la 3.0 en reprend ce qui la concerne (`recap_jusqua` dans `evenement_recent` / `evenement_recap`, les Reverses datées de `22c_reverses.sql`, `me()` avec `parametres.reverses`) et remplace le Labo ; testé deux fois sur `TOUT.sql` de `version-2.5` + `calendrier-2.5.sql` : dates gardées, Reverses ouvertes au bon prix, fin du récap au 26. Il ne touche pas aux tables `ech_*` ; les deux remises à zéro les vident si elles existent. **Depuis le 24 octobre, la 2.5 fait de L'Échauffement un événement** (`22e_echauffement-evenement.sql` et `22f_sans-fin.sql` de la 2.x) : une ligne `evenements` de code `echauffement` (sa monnaie, les Braises, rangée comme les autres dans `evt_comptes`), son Pass de 20 paliers dans `evt_piste`, 13 quêtes et 4 articles de boutique marqués `evenement = 'echauffement'`, la quête `m_sf10`, un déclencheur sur `ech_saison`, et un mode sans fin (un défi par jour à partir du 4 novembre 2026, sans date de fin : tables `ech_sf_*`, fonctions `ech_sf_*`). Testé (24 octobre) : la 3.0 rejouée deux fois sur une base 2.5 où deux joueurs ont joué l'événement (Braises, Pass, boutique, quêtes) ; son `04_seed.sql` retire les quêtes et les articles de la 2.5 sans casser les inventaires ; les cadres (`f_braise`, `f_ardeur`) et titres (`t_echauffe`, `t_ech_round`, `t_ech_feu`, `t_ech_entraineur`, `t_ech_infatigable`) gagnés restent à leurs joueurs, et la 3.0 les connaît (`TITRES`, `FRAMES`, `CADRE_SOURCE`, `assets/cadres/braise.svg` et `ardeur.svg`) ; `29_labo.sql` ferme le mode sans fin ; les remises à zéro tournent (elles s'arrêtaient sur `labo_sauvegardes`, que la 3.0.10 avait oubliée). Si la 3.0 sortait pendant le récap de L'Échauffement (du 4 au 7 novembre 2026), son `evenement_recap` n'en aurait pas le bloc propre à la 2.5 (étoiles, défis) : à reprendre ce jour-là ; sa monnaie, elle, s'affiche déjà sous son nom (`MONNAIES_EV.echauffement`, les Braises, et leur icône `braiseIco`, depuis le 25 octobre). **Depuis le 25 octobre 2026, la vraie base est passée par la 2.5** (le site la sert depuis le 25, elle sort le 26 à 0 h) : la 3.0 a été rejouée deux fois de plus, ce jour-là, sur une base 2.5 finale (le Pass refait du 25 : titres aux paliers 5 et 15, cadres aux paliers 10 et 20) où un joueur a gagné « Premier round », « Feu sacré », « Entraîneur », « Braise » et « Ardeur » : il les garde, `titres_de` les donne, le mode sans fin est fermé. **Une règle qui change dans la 2.x doit être reportée ici** ([`docs/feuille-de-route.md`](docs/feuille-de-route.md), § 5) : sinon le `TOUT.sql` de la 3.0 la défait le jour de la sortie.
32. Dans `_demo/serveur.js` : rien lu du jeu au niveau du module ; `refuser()` plutôt que `throw` ; ne jamais changer `S.v`.
33. **La vraie base, le jour de la sortie** (leçons de la mise à jour 2.5 de la 2.x, les 24 et 25 octobre 2026) : comparer d'abord ses empreintes (fonctions avec leurs droits, colonnes, tables) à une installation locale de ce qu'on croit en place ; **la voie sûre est que le propriétaire colle le fichier** dans le SQL Editor, puis qu'on vérifie en lecture seule — l'outil Supabase demande au propriétaire une confirmation pour tout envoi qui contient `delete from` ou `drop`, qui n'attend qu'une minute, et elle ne lui est jamais parvenue (trois fois sur trois). Un fichier copié depuis un navigateur sous Windows arrive en fins de ligne `\r\n` dans les corps de fonction : rien ne change pour le jeu (sauf un texte écrit sur plusieurs lignes), mais toutes les empreintes changent (79 fonctions sur 118 le 25 octobre) — `supabase/administration/fix-crlf.sql` les rétablit. Comparer un contenu en `jsonb` (`to_jsonb`), jamais en `row_to_json` : sur la vraie base, des colonnes ajoutées après coup (`quests.item_id`, `shop_items.carte_id`) ne sont pas à la même place que dans une installation neuve. Les outils de la 2.5 (`tools/maj-2.5/` de `version-2.5` : banc, envois contrôlés, `agregat.sql`, `donnees.sql`) servent de modèle.
34. Le Choc de la démo expire (14 jours après le début, posé 4 jours avant la première visite) ; les bots ne vivent que page ouverte.
35. Le préfixe `preprod:` ne réécrit que `getItem`, `setItem`, `removeItem`, `clear` : `key()` et `length` voient aussi les clés du vrai site.
36. **Un changement des sources n'existe pour le propriétaire qu'une fois `preprod/` reconstruit et publié sur `main`** : c'est là qu'il teste. Le 24 octobre 2026, les cadres de la 2.5 (`f_braise`, `f_ardeur`) ont été ajoutés aux sources sans refaire la pré-prod, au motif que « rien n'y change à l'écran » — à tort : le Profil montre tous les cadres, possédés ou non. Le 30, le propriétaire ne les voyait pas. Toute modification visible se publie.

**Combats et événements**

37. **Déterminisme** : aucun `Math.random` ni `Date` dans le moteur et les effets ; l'état reste du JSON sans référence.
38. Une action doit être **exactement** l'une de `optionsTour` (`chevaliere` n'existe que s'il vaut `true`).
39. Pendant une animation, `T.E` est déjà à l'état final : dessiner `vue()`, décider sur `T.E`.
40. Tout nouveau `but` de décision doit être connu de l'IA **et** de l'interface.
41. Le tutoriel dépend des classes de l'arène : le rejouer après toute retouche de `table.js` / `arene.css`.
42. Un défi ne tolère aucun trou dans la numérotation des actions (« Actions désynchronisées »).
43. Ne jamais réutiliser un code d'événement ; ne pas chevaucher un événement sans code et un événement codé.
44. **Les raids suivent la ligne `choc`** (`raid_ancre`, 3.0.11) : déplacer le Choc (Labo, ou à la main) renumérote les raids ; les dégâts déjà inscrits restent sous leur ancien numéro, et un numéro déjà servi peut redevenir le raid en cours avec ses dégâts (au Labo, « Remettre le raid à zéro »). Sur la vraie base, ne pas déplacer le Choc une fois les raids commencés.
45. **Un Choc ouvert à une autre heure que minuit** (heure de Paris) touche 22 dates : la première et la dernière Épreuve sont plus courtes, et la 22ᵉ reprend une règle à tour de rôle. L'ouvrir à minuit ([§ 8.8](#88-recettes)).
46. **Une maîtrise ne s'anime que par `transform` et `opacity`**, et jamais sous un `filter` : un filtre (ombre en `drop-shadow`, assombrissement) sur un élément qui contient une finition animée se recalcule à chaque image — la fiche de carte tombait ainsi à 20 images par seconde (3.0.8). Mesurer (`requestAnimationFrame` sur deux secondes) avant d'ajouter un effet.
47. **Le réglage du Marionnettiste n'existe que dans la page** (`RAID.bosses` › `ajuste`) : le serveur compte les dégâts avec les PV de la phase, c'est voulu ([§ 7.9](#79-les-modes)). Changer l'un sans l'autre, ou le boss lui-même, demande de mesurer de nouveau.
48. **La fin d'un défi attend sa file d'envoi** (`surFin`, `js/combat/defis.js`, 3.0.12) : les actions partent une à une (`defiActif.file`) ; arrêter le défi (`arreterDefi`) avant que la dernière soit partie la jetait (`defiActif !== D`), et l'ami ne voyait jamais le coup final ni l'abandon. Toute nouvelle sortie du défi doit d'abord attendre la file.
49. **« Animations réduites » coupe tout** (`html.rm *{animation:none!important}`, `css/hub.css`) : l'état final d'une animation doit aussi être l'état de l'élément sans elle. La pièce du tirage montrait la face du joueur quand l'adversaire commençait, parce que seule l'animation la retournait (`.ar-piece.revers`, corrigé en 3.0.12).
50. **`now()` vaut le début de la transaction** : des lignes créées dans une même transaction (un test SQL qui enchaîne plusieurs appels dans un seul bloc) ont la même date, et un tri sur la date seule devient arbitraire. En vrai, chaque appel est sa propre transaction ; un test doit faire de même (une étape par bloc), ou la requête trier par un identifiant qui croît (`combats_historique` trie par `id`, une identité, pas par date).

---

## 14. Dette connue

État au moment de l'écriture. Ce qui est corrigé sort de cette liste dans le même commit.

### 14.1 Bugs

Corrigés en 3.0.11 ([§ 15](#15-historique-des-versions)) : les tapis comptés parmi les titres, le cadre et l'avatar de `set_profile`, `RM()` aveugle au réglage du jeu, la vitesse de combat remise à l'ancienne, les raccourcis du manifeste, la pastille de l'événement sur l'avatar, le titre « PRÉ-PROD », l'avertissement « Nouvelle version » par-dessus une fenêtre, Target Missed contre Invitation, les actions perdues d'un défi entre amis, le repli de rareté du Labo. Restent les deux bugs des decks :

- ~~**Une copie de Starter ne s'enregistre pas** tant qu'on n'en possède pas les cartes~~ : **tranché le 1er novembre 2026** (le propriétaire : « La copie d'un starter n'est pas possible si la personne ne possède pas les cartes correspondantes »). Depuis la 3.0.14, un Starter ne se duplique qu'avec ses propres cartes (`Decks.copieStarter`, [§ 7.5](#75-decks-et-atelier)) ; sinon, sa fiche dit ce qui manque. Le serveur refusait déjà d'enregistrer une copie aux cartes prêtées (`deck_sauver`). Reste une différence connue : `deck_defi_erreur` (défis entre amis) accepte encore les cartes prêtées d'un Starter **copié** ; sans copie possible, le cas ne se présente plus par l'interface.
- `deck_erreur` ne refuse pas une Secrète cachée — sans objet depuis la 3.0.13 (aucune Secrète n'est cachée) ; à corriger si une Secrète cachée revenait.

### 14.2 Code mort

Le gros du code mort a été retiré en 3.0.8 (navigation, données, combat, événements, CSS ; détail dans l'historique git, commits « code mort retiré » et « CSS mort retiré »), après vérification qu'aucun JS, HTML, faux serveur ni outil ne le produisait. Ce qui reste, volontairement :

- **Porte** : `vCompteARebours`, `ouvrirLaPorte`, `Porte.lancee`, `Porte.reste` ; l'appel `Porte.lire()` au démarrage ne change rien. **Mode local et `vAuth`** : inatteignables tant que `PORTE.active` vaut `true`. Gardés : c'est l'architecture du jour où le jeu rouvrirait.
- **Données** : la branche des **talents** (une attaque sans coût) est vivante dans le code (`k.talents`, lu par l'arène et la fiche) mais aucune carte n'en a ; `PROMOS_A_VENIR` est vide mais c'est un réglage ([§ 6.2](#62-données-et-images)) ; `profil.bonus_offerts` est envoyé par le serveur (`07_vitrine.sql`, `_demo/serveur.js`) et lu par personne. `Backend.erreur` n'est lu que par l'écran d'entrée de la démo (`demoPorte`, `_demo/serveur.js`) : ne pas le supprimer.
- **SQL** : `cfg('pack_size')`, `cfg('shards_per_dup')`, `recyclage_semaine()` / `debut_semaine()`, la branche `'legendaire'` d'`accorder`, `choc_joueurs.victoires`, les critères de classement non affichés, l'effet de boutique `refill` (plus aucun article ne s'en sert ; retiré côté client).
- **Combat** : trois copies du même mulberry32 (moteur, IA, campagne), une vingtaine d'exports jamais appelés de l'extérieur. `CB_ALIAS` n'est **pas** mort : la boîte de réception ouvre encore `defis` pour un défi reçu.

### 14.3 Écarts à la DA

La passe de la 3.0.12 ([§ 15](#15-historique-des-versions), le détail dans `docs/design-3.0.md`, § 10 quater) a corrigé ce que cette liste comptait : `--cta` et les couleurs de l'interface réécrites en dur (`#5d4bd9`, `#c8bfff`, `#16151e`, `#121119`, `#b3a6ff`, `#ff6b6b`) prennent leurs jetons ; le vert de réussite de l'arène est `--ok` ; les restes de la 2.x (`#b38cff` de `reflets.css`, `rgba(154,115,255,…)`, le dégradé rose de `.colpct`) sont partis ; le « choisi » est blanc (onglets d'acte, difficultés de l'Arcade, decks, filtres, couverture d'un deck, onglets de l'événement) ; l'or ne sert plus aux étoiles des decks ni aux alertes du Labo ; un seul rose pour le cœur des favoris (`--fav`) ; un seul vert pour Toxique (`#62d84e`, et `f_toxique` n'est plus décrit « rose »). Reste, volontairement ou en question :

- **Les finitions des cartes** (le reflet des Reverses et des Secrètes, `cards.css`, `opening.css`, la Secrète de l'arène) gardent leurs couleurs écrites : ce ne sont pas des couleurs d'interface. De même les couleurs de rareté de l'ouverture, de la fiche, du podium et des succès, et les palettes de particules (`FX`, dessinées dans un canvas qui ne lit pas les variables CSS).
- **`--warn` a la valeur de l'or** (`#f5c451`) : l'« attention » (une Essence qui manque dans l'atelier, une maintenance en cours au Labo) se lit comme une récompense. Un ambre à part (`#ffb84d`, déjà écrit dans `.dk-bilan li.ko`) le distinguerait : à décider.
- **Les Étincelles** (le solde du Choc, `choc.css`) s'écrivent en or. C'est une monnaie gagnée, donc une récompense : gardé, mais c'est la seule monnaie en or (les Éclats sont en blanc).
- Le jeton plein de la réserve de boosters (`.resjeton.plein`) part de `#a98bff`, une lavande intermédiaire sans jeton.

### 14.4 Documentation et commentaires périmés

`SETUP.md`, `docs/`, le kit presse, `verif.html`, le LISEZMOI de la démo et les commentaires de code signalés ici ont été remis d'accord avec le code en 3.0.8. Reste :

- **`04_seed.sql`** : les médianes de simulation en tête du fichier (boosters pour 25 / 50 / 75 / 90 / 100 % de la collection) datent du booster de la 1.x et n'ont pas été recalculées (l'en-tête le dit).
- **Mise en page** : en passant les chemins à `supabase/installation/`, une cinquantaine de lignes de commentaire dépassent 90 caractères (rien de faux, seulement long).
- `docs/design-3.0.md` reste un journal de conception, version par version : ses premières sections décrivent ce qui a été changé depuis (il le dit à chaque fois). Ce README fait foi.

### 14.5 Pistes non engagées

- Montrer la maîtrise de l'adversaire en Versus (il faudrait l'envoyer avec le défi).
- Mesurer l'économie réelle (maîtrise, combats) une fois le jeu ouvert.

---

## 15. Historique des versions

| Version | Date | Ce qu'elle a apporté |
|---|---|---|
| **1.0** | 22 sept. 2026 | Boosters, Collection, Social (amis et échanges), Quêtes, Profil, Boutique, Réglages ; l'onglet Combats annoncé « à venir ». |
| 1.x | 23–28 sept. | Feuilles qui se ferment d'un glissé ; **connexion Discord obligatoire, plus de jeu hors ligne** ; le 24 septembre, **le lancement public est annulé** (écran « Projet annulé · Merci ») ; démo autonome ; recyclage rééquilibré, quêtes de raretés complètes, classement global. |
| **1.5** | 3 oct. | Fragments (le recyclage ne paie plus en Éclats), fabrication, Essences Brillantes, succès, historique des tirages, partage d'un booster, **chasse à la carte unique** ; puis cadeaux d'administrateur et boosters offerts ou achetés **hors réserve**. 1.5.8 : teaser de la 2.0. |
| **2.0 « Reflets »** | 8 oct. | **Reverses**, Collection en trois vues, titres / bannière / devise, cadres décorés animés, l'événement Reflets (Prismes, Pass, boutique, récap), **Devine l'illu**, invitations, « Chez tes amis » ; la pré-prod à `matetcg.com/preprod/`. |
| **2.1** | 9 oct. | Exemplaires **à garder** (par rareté et par carte), **favoris**, quêtes « Dix fois la même ». 2.1.1 : un invité n'invite pas à son tour. |
| **2.1.2** | 13 oct. | Cadre Maître refait, flèche du menu, pastille Devine l'illu, cadrage de l'app installée. |
| **2.1.3** | 20 oct. | Teaser de la 3.0 dans l'onglet Combats (« le signal »). C'était la version en production au 22 octobre. Faite sur la ligne 2.x (`claude/interface-ux-fixes-o92u4a`). |
| 2.1.4 | 21–22 oct. | Ligne 2.x, renommée 2.5 le 23 : **L'Échauffement**, sept défis du 26 octobre au 4 novembre 2026 dans l'onglet Combats, avec un indice sur la suite par défi réussi à trois étoiles ; Labo de la 2.x réorganisé. Détail dans le README de `version-2.5`. |
| **2.5** | 25–26 oct. | Ligne 2.x : L'Échauffement devenu un événement (Braises, Pass, quêtes, boutique, classement, récap), son mode sans fin à partir du 4 novembre, la fin de combat en scène ; les Reverses recyclables et fabricables ; le Labo refait. **C'est la version en production** : site et base mis à jour le 25 octobre, elle sort le lundi 26 à 0 h. Détail dans le README de `version-2.5`. |
| 3.0.0 – 3.0.1 | 11–12 oct. | Pré-build : moteur de combat, effets, IA, règles reconstituées, arène, onglet Combats, atelier, guides, défis, cosmétiques ; Secrètes et nouveaux taux ; l'événement « Le Choc des Sections » (Raid, Épreuve du jour, Pass) ; XP et niveaux ; SQL `23`–`26`. |
| 3.0.2 – 3.0.4 | 12 oct. | Refonte visuelle complète, puis la palette **« Graphite et lavande »** (verre réservé à ce qui flotte) ; la « Guerre » des Sections et la première maîtrise retirées ; la pré-prod ne reste plus bloquée sur « Merci ». |
| 3.0.5 | 12 oct. | Onglet Combats refait (bannière du Chevalier, portes Solo et Versus, campagne en chemin, Arcade) ; Raid permanent ; événement refait (bannière, Nouveautés, Pass et boutique rééquilibrés). |
| 3.0.6 | 13–14 oct. | **Raid par saisons et phases** (`27_raid.sql`) ; **tutoriel jouable** ; Guide en glossaire ; IA sans coups au hasard (mesurée) ; Decks avec bilan ; Classement Niveau / Secrètes / Versus ; bannière Squeezie le Toxique contre Brawks Déter, sans VS ; Insignes renommées **Étincelles** ; cadres 3.0 redessinés ; le Labo montre tout. |
| **3.0.7** | 14 oct. | **Maîtrise des cartes** (`28_maitrise.sql`) et **carte fétiche** ; fiche de carte en trois pages (Infos, Maîtrise, Gérer) ; arène : carte agrandie intacte avec son état dessous, Joueur engagé qui ne pivote plus, animations rejouées depuis l'état de chaque instant, flèche de visée, touchers iOS ; tutoriel réécrit et vérifié dans Chromium (390, 375, 360) ; récap de booster sans défilement, pastille Boosters, niveau dans l'en-tête, Classement à quatre critères. |
| **3.0.8** | 14–15 oct. | **README réécrit de zéro** et `CLAUDE.md` ; bandeau et tapis « Le Choc des Sections » recadrés sur Brawks Déter, Nouveautés sans « Deux Sections » ; tapis et cadre du Sorcier dans la même colonne de la boutique du Choc ; « Apprendre d'abord » ouvre le Guide ; liens `data-colvue` réparés ; cadres Arène sans plaque « NIV » ; **carte fétiche** refaite dans la DA ; **maîtrise refaite** (barème par rareté, effets sans voile, un joyau à la place de la couronne, fiche qui tient sans défiler) ; arène : **zone de détails** au-dessus de son camp pour sa main et ses Joueurs, **fantôme de la carte** dans les places libres à la place du « + » ; **dépôt rangé** (SQL en `installation/` et `administration/`, remises à zéro réécrites pour la 3.0 et protégées par un garde-fou, mises à jour historiques supprimées, code et CSS morts retirés, `SETUP.md` et docs remis d'accord avec le code) ; solde du Choc à jour après un achat. ; branches rangées : la branche de travail s'appelle désormais `version-3.0`. |
| **3.0.9** | 22 oct. | **Labo réorganisé** en cinq sous-onglets (Maintenant, Combats, Scènes, Joueurs, Affichage), sans les aperçus de la chasse 1.5 ni le panneau Reflets (`montrerNouveautes21`, `apercuRecap` retirés) ; remises à zéro compatibles avec une base qui a reçu la 2.1.4 (tables `ech_*`) ; README et `CLAUDE.md` à jour des trois lignes (racine de `main`, `prebuild/`, `preprod/`) ; `CLAUDE.md` importe toute la documentation (`@README.md`, `@docs/…`, `@SETUP.md`, `@presse/README.md`). |
| **3.0.10** | 24 oct. | **Reports de la 2.5** : les Reverses se recyclent et se fabriquent à une date (`22c_reverses.sql`, `parametres.reverses_des`), au prix de leur vraie rareté (400 / 500 / 2 400, `tools/equilibre-reverses.py`), la page bascule seule ; la fin du récap réglable (`evenements.recap_jusqua`) ; les marques de cache à empreinte (`tools/version.py`). **Labo refait** ([§ 10](#10-le-labo-administrateurs)) : Serveur (le Choc d'un état à l'autre, le Raid à une phase, l'échelle, les Reverses, remises à zéro), Mon compte (sauvegarde, master set à la limite de deck, ressources et niveau, cosmétiques), Combats (Section, campagne, essais du jour, maîtrises), Joueurs, Aperçus ; `29_labo.sql`, 15 RPC. Les milliers prennent une espace insécable (`fmtN`). Puis, le même jour : la ligne des Fragments de la Collection, la même dans Classiques et Reverses ; les titres et cadres de L'Échauffement devenu événement dans la 2.5 (`t_echauffe`, `t_ech_round`, `t_ech_feu`, `t_ech_entraineur`, `t_ech_infatigable`, `f_braise`, `f_ardeur`), la fermeture de son mode sans fin (`29_labo.sql`), et les remises à zéro qui connaissent `labo_sauvegardes` et `ech_sf_*` ([§ 13](#13-pièges), point 31). Le 25 : les Braises, monnaie de L'Échauffement (`MONNAIES_EV`, `braiseIco`, `evIco`), pour une 3.0 qui sortirait pendant lui ou son récap ; la compatibilité refaite avec la 2.5 finale ; `fix-crlf.sql` et les leçons de la mise à jour de la vraie base (point 33). |
| **3.0.11** | 30 oct. | À la demande du propriétaire (dictée du 30 octobre, `docs/feuille-de-route.md`) : **les cadres de la 2.5 au Profil** (la pré-prod n'avait pas été refaite, [§ 13](#13-pièges), point 36) ; **les Secrètes comptées au-delà du total** (« 127 / 122 ») dans la Collection et la fiche ; **l'onglet du Choc** (Secrètes toutes floutées, **l'échange des Brillantes** à la place du cadre Secrète, tapis « Le Choc » recadré sans bande violette) ; **deux raids** comptés depuis le premier jour du Choc (The French Sorcerer, puis Le Marionnettiste, réglé par simulation ; plus de « saison 2 ») ; **21 Épreuves numérotées** et leur calendrier ; l'en-tête net au lieu du fondu flou ; **l'ouverture des boosters** plus rapide et « Tout ouvrir » (dix d'un coup, un récap) ; **icônes, favicon et image de partage** en graphite et lavande ; **la maîtrise refaite** (Satin, Liseré, Holo, Lumière, Légende ; insigne ✦ sans jaune ; la fiche qui ne déplace plus la carte et tourne à 60 images par seconde ; la montée d'un niveau ; la maîtrise des Moments, Coachs et Objets en combat ; aperçus au Labo) ; la carte fétiche retouchée ; **« Tout récupérer »** sur les quêtes. Puis, le même jour, **les bugs connus** ([§ 14.1](#141-bugs)) : `RM()` suit aussi le réglage du jeu ; une seule écriture de `mtcg.jeu` (la vitesse de combat ne se perd plus) ; les raccourcis de l'application installée (`?onglet=`) ; la pastille de l'événement allume l'avatar ; le titre « PRÉ-PROD » reste ; « Nouvelle version » attend que l'écran soit libre ; Target Missed voit qu'un Joueur sauvé par Invitation n'a pas été vaincu (un test de plus) ; plusieurs quêtes finies ensemble font une seule notification ; « Tout ouvrir » sur les coffres du Raid ; en Versus, les actions partent une à une et une action perdue fait reprendre le défi tel que le serveur l'a noté ; le repli de rareté du Labo est celui du serveur ; côté serveur (et faux serveur), les tapis ne sont plus des titres, `set_profile` n'accepte qu'un cadre `f_` et un avatar court, `combat_reglages` qu'un vrai tapis et un vrai sleeve (`est_cosmetique_combat`). Auto-critique et suggestions : feuille de route, § 4. |
| **3.0.12** | 30–31 oct. | À la demande du propriétaire (dictée du 30 octobre au soir, `docs/feuille-de-route.md`), avec **les règles officielles du Gentle Mates TCG** (`docs/regles-officielles.md`, recopiées sans modification ; [§ 7](#7-les-combats)) : **le moteur aux règles officielles** (Club de 40, 3 exemplaires par nom et couleur, Réserve de 10 ; 4 PV posés après la main et le mulligan, puis qui commence ; l'entretien pioche aussi pour le premier CEO ; autant de Joueurs qu'on veut, un remplacement par tour quand les trois cases sont prises ; Objets sans limite ; un Coach par tour ; restriction par couleur ; plus d'Instant en phase de Combat ; les attaques sur le CEO, le soutien d'un Joueur adjacent ; plus de Banc, « bench » c'est la défausse ; défausse à 5 en fin de tour ; Club vide, partie perdue ; **le perdant commence la partie suivante**), avec les effets, l'IA, les Starters de 40, le SQL et les variantes de l'Épreuve, de la campagne et du Raid ; `docs/regles-3.0.md` réécrit (chaque règle et son code, les 13 points que le texte ne tranche pas, ce qui a changé) ; **l'arène** anime chaque étape (la donne, le mulligan, les PV, qui commence, l'entretien, les quatre phases, le soutien, le duel, ce qui part à la défausse, le remplacement), un Joueur engagé tourne d'un quart de tour, 55,6 images par seconde au processeur ralenti quatre fois ; **le tutoriel** (une partie guidée de cinq tours) et **le Guide** réécrits ; **« Tout ouvrir » retiré** (boosters et coffres du Raid) ; **la fiche de carte** ne saute plus et ne rame plus d'un onglet à l'autre, et **le niveau II de maîtrise devient l'Écrin** (un cadre autour de la carte, qui ne la touche plus) ; **l'historique des combats**, tour par tour (Combats › Historique, `combats_historique`) ; **l'écran de maintenance** pour la sortie (`maintenance`, `porte()`, Labo › Serveur, une base 2.x avec des joueurs y entre d'office) ; un résultat de combat refusé ne se perd plus ; **la simulation de l'économie de la maîtrise** (`tools/equilibre-maitrise.py`, `docs/economie-3.0.md` § 3 ter) et un rappel dans la fiche ; **la passe complète sur la DA** (`docs/design-3.0.md` § 10 quater). Corrigés en chemin : la fin d'un défi pouvait ne jamais envoyer le dernier coup à l'ami ; avec « Animations réduites », la pièce du tirage montrait la mauvaise face ; « Tour adverse » pendant la mise en place ; deux textes restés aux anciennes règles (« Trente cartes » dans le Choc, « deux de chaque » au Labo) ; sur un réseau lent, la main de départ ne s'affiche plus vide : ses images se chargent avant la donne, et le mulligan les attend. |
| **3.0.13** | 31 oct. – 1er nov. | À la demande du propriétaire (dictées du 31 octobre et du 1er novembre, `docs/feuille-de-route.md`) : **qui commence, toujours à pile ou face** ; **le godpack** : trois Épiques, deux Légendaires, une Secrète ; **la maîtrise consomme ses exemplaires** (un barème par rareté ; un exemplaire qui manque ne se remplace plus par des Fragments) et **refaite** (la lumière, jamais un trait : Satin, Reflet, Holo, Lumière, Légende), avec une fiche qui dit ce qu'il faut et ce qui sera consommé ; **le profil et la fiche d'un joueur** refaits en une carte de visite, les réglages dans « Personnaliser », **les statistiques de combat** et **les decks montrés sur le profil** (`deck_publier`) ; **l'atelier de decks** refait (une tête collée en haut, trois onglets avec leur jauge, une ligne pour l'étape suivante, la Réserve qui tient dans l'écran) ; **l'arène** : la visée refaite (un trait de lumière, puis une mire sur la cible), plus fluide (tâches longues d'un déploiement : 14 → 8), jouable au clavier et racontée aux lecteurs d'écran ; **le surlignage** garde la forme de ce qu'il entoure, la jauge des Spéciales a sa couleur, « Attaque » et « Défense » ; **le Choc en deux semaines** (Pass de vingt paliers, quêtes et boutique aux deux tiers, le raid suivant le lendemain de la fin) et **le boss suivant tu** jusqu'à son arrivée ; **P03, P04 et les Secrètes 124, 126, 127** (textes, effets, photos redressées en attendant des scans ; les Promos des Sections dans le bon sens) ; **des textes plus directs**, et plus de « IA » à l'écran ; **l'accessibilité** (état des lieux par axe-core, [§ 4.13](#413-accessibilité-état-des-lieux-du-1er-novembre-2026-3013) : zoom permis, contrastes, fenêtres et onglets au clavier, refusion à 320 px) ; **« Aujourd'hui »** en tête des Quêtes. Corrigés en chemin : la quête « deck » attendait 30 cartes au lieu de 40 ; le Labo finissait le Choc à 23 h à travers le passage à l'heure d'hiver ; le Guide disait encore « le perdant commence » ; le choix de la Section disait « Pré-build ». |
| **3.0.14** (en cours) | 1er nov. | À la demande du propriétaire (dictée du 1er novembre au soir, `docs/feuille-de-route.md`) : **un Starter ne se duplique qu'avec ses propres cartes** (`Decks.copieStarter`) ; **le soutien ne se propose que s'il change l'issue** (`attaquer()`, `docs/regles-3.0.md` § 6) ; **« Ma fiche »** au Profil ; les nouveautés du Choc montrent **la refonte du profil** au lieu de l'atelier ; le choix de la Section sans phrase d'intro ni devises ; **P06** a son visuel propre (`P06-Le_Marionnettiste_v2.webp`) ; les avatars des amis d'un échange ne sont plus rognés ; **les bandes qui défilent se tirent à la souris** et défilent à la molette ([§ 4.8](#48-feuilles-toasts-notifications-fenêtres-daccueil)) ; **le surlignage du tutoriel épouse les formes** (une gemme, une case, une carte, l'avatar du CEO, au lieu du rectangle de leur zone) ; **la lueur des boutons du panneau d'une carte** n'est plus coupée net (`.ar-f-bas`) ; **la maîtrise allégée en haut de l'échelle** (un exemplaire gardé au lieu de trois, plus ceux des decks ; Légendaire 5 exemplaires, Secrète 2 ; une Secrète en Légende en six mois environ au lieu de deux ans) ; **les abandons** ne font avancer aucune quête, et ne comptent comme une défaite qu'au Raid et en Versus ; **le changement de main s'anime** (la main rendue, le paquet mélangé au centre, la nouvelle main donnée : l'animation existait, une entrée en double l'écrasait). |

**Choix d'interprétation de la 3.0.7, à connaître** : « Éclats » dans la demande sur la maîtrise a été lu comme **Fragments** ; le conflit entre exemplaires et decks est résolu par les exemplaires **en trop** seulement (le manque se paie en Fragments) ; la carte fétiche est distincte de la vitrine ; le Classement est réduit à quatre critères. Non vérifié sur un vrai appareil iOS (zones sûres, glissé des pages de la fiche).

**Choix d'interprétation de la 3.0.8, à connaître** : « les cartes joueurs dans notre main ne sont pas adaptées au nouvel affichage » a été lu comme **l'affichage d'une carte touchée** (la carte en grand de la 3.0.7, qui laissait un vide à côté d'une carte de la main), et « garder la zone de détails aussi de nos 3 emplacements » comme **la zone de détails de la 3.0.6, pour la main et pour ses Joueurs posés, son camp restant visible** ; la main elle-même (l'éventail en bas) n'a pas changé. « Le cadre et le tapis dans la même colonne » de la boutique du Choc a été pris à la lettre : l'un sous l'autre dans la grille à deux colonnes. L'équilibrage de la maîtrise repose sur une **simulation** (`tools/equilibre-fragments.py`), pas sur des données réelles. Non vérifié sur un vrai appareil iOS.
