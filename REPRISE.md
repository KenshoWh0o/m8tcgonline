# Reprise du chantier — à lire en premier

Écrit pour un agent qui ne connaît rien au projet. Branche de travail :
`claude/new-session-kjkzxl` (elle reprend `claude/interface-ux-fixes-o92u4a`,
qui n'a plus bougé). Ne pas créer de PR sans qu'on te le demande.

## Le projet en bref
- **M8 TCG Online** (« Mate TCG ») : jeu de cartes à collectionner en ligne,
  site statique HTML/CSS/JS vanilla (pas de framework, pas de build JS),
  backend **Supabase** (Postgres + RPC `security definer`), hébergé sur
  **GitHub Pages** (branche `main`).
- Le vrai site (racine de `main`) est en **2.1.x**. La **3.0** (Combats,
  Secrètes, Raid, événement « Choc des Sections », niveaux, refonte visuelle)
  n'existe qu'en **pré-prod** : dossier `preprod/` de `main`, servi sur
  matetcg.com/preprod, qui tourne avec un **serveur de démo local**
  (`_demo/serveur.js`, imite les RPC SQL en mémoire/localStorage).
- **Règle absolue du propriétaire : rien sur le vrai site.** Aucun SQL 3.0
  joué en production, aucun fichier hors `preprod/` modifié sur `main`.
- Le propriétaire écrit en français, veut des réponses exhaustives et
  honnêtes (ce qui est sûr / supposé / non testé). Mode sombre uniquement.
- Commits : pas d'identifiant de modèle dans les messages ni le code.

## Arborescence utile
- `index.html`, `js/*.js`, `css/*.css` : l'app. Rendu par chaînes HTML
  (`render()` dans `js/app.js`, onglets `js/battle.js`, `js/collection.js`,
  `js/profile.js`, `js/social.js`, `js/choc.js` (événement), `js/raid.js`…).
- `js/combat/` : moteur de combat (`moteur.js`, générateur d'événements avec
  instantanés `e.etat` pour l'animation), arène (`table.js`), IA, decks,
  tutoriel (`tutoriel.js`), guides/glossaire (`guides.js`).
- `js/config.js` (cosmétiques, cadres), `js/cards-data.js` (122 cartes),
  `js/cards.js` (Reverses `r###`, Brillantes `b###`), `js/render-card.js`.
- `supabase/NN_*.sql` : fichiers rejouables ; `tools/build-sql.py` les
  assemble en `supabase/TOUT.sql` (liste `MORCEAUX`). `07_vitrine.sql`
  contient la version définitive de `me()` et `player_profile()`.
- `tools/` : `demo.py --preprod` (construit `preprod/` depuis la racine),
  `version.py` (numéro de version), `combat-tests.js` (`node tools/combat-tests.js`,
  38 tests), `combat-sim.js`, `cadres-30.py` (génère les SVG de cadres
  `assets/cadres/`), `choc-visuels.py` (bannières/tapis de l'événement).
- `docs/` : règles, économie 3.0, etc. `README.md` : notes de version.

## Publier la pré-prod (seulement `preprod/` sur `main`)
```
python3 tools/demo.py --preprod
W=/tmp/wt-main; git worktree add --detach $W origin/main   # une fois
cd $W && git fetch -q origin main && git checkout -q --detach origin/main
rm -rf $W/preprod && cp -a <repo>/preprod $W/preprod
git add -A preprod && git commit -m "Pré-prod 3.0.x : …" && git push origin HEAD:main
```
Tester en local : `npx http-server -p 8781 -c-1 -s .` puis Chromium/Playwright
(Chromium préinstallé dans l'environnement cloud).

## État au moment de la passation (dernier commit de la branche)
La 3.0.7 est finie, poussée sur la branche et publiée en pré-prod
(`preprod/` de `main`). En plus des retours 3.0.6 (voir les notes de
version 3.0.7 du README) :
- **Maîtrise des cartes** branchée de bout en bout : `28_maitrise.sql` dans
  `TOUT.sql`, `maitrise_etat` dans `me()`, `fetiche_de` dans
  `player_profile()` ; serveur de démo (`maitriser`, `set_fetiche`) ;
  `Backend.maitriser/setFetiche`, `save.maitrises/save.fetiche` ;
  `renderCard(c, {m, calme})` ; `css/maitrise.css` ; Collection (immobile +
  insigne), vitrine, fiche, combat (main, plateau, carte agrandie ; éclat
  d'entrée au niveau 4, onde de choc au 5, coups colorés dès le 4).
- **Fiche de carte** (`js/viewer.js`) : pages glissables Infos | Maîtrise |
  Gérer ; sur grand écran, la fiche est à côté de la carte.
- **Carte fétiche** en haut du profil et sur la fiche des autres.
- **Tutoriel** : rejoué en entier dans Chromium (390×844 et 375×667, jusqu'à
  la victoire), et la partie guidée en 360×740. Corrigé : l'attaque sous la
  carte agrandie ne s'allumait pas ; l'étape « Garde » n'allumait rien ; en
  petit écran la bulle cachait le bouton à toucher (la carte agrandie
  s'arrête maintenant au-dessus d'elle, `--tuto-h`).
- SQL testé sur PostgreSQL 16 local : 2.1 de `main`, puis `TOUT.sql` trois
  fois ; `maitriser`/`set_fetiche`/`fetiche_de` vérifiés (coûts, exemplaires,
  maximum, Reverse, Essence refusée, fétiche perdue, `anon` refusé).
- Tests : `combat-tests` 38/38 ; 200 parties simulées sans plantage.

## Ce qui reste à faire
Rien d'engagé. Pistes non demandées : afficher la maîtrise de l'adversaire en
Versus (il faudrait l'envoyer avec le défi) ; mesurer l'économie de la
maîtrise après l'ouverture (`maitrises_journal`, `docs/economie-3.0.md`
partie 3 ter).

## Choix d'interprétation à signaler au propriétaire
- « Éclats » dans sa demande de maîtrise a été lu comme **Fragments** (le
  contexte était « nouvelle utilité des fragments »).
- Conflit exemplaires/decks résolu comme ci-dessus (exemplaires en trop
  seulement, manque payé en Fragments).
- Classement réduit à 4 critères ; la carte fétiche est distincte de la
  vitrine de 4 cartes.
- Non vérifié : vrai appareil iOS (safe-area, glissé des pages de la fiche),
  maîtrise de l'adversaire en Versus (non affichée, volontairement).
