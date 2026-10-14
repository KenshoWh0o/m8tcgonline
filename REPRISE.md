# Reprise du chantier — à lire en premier

Écrit pour un agent qui ne connaît rien au projet. Branche de travail :
`claude/interface-ux-fixes-o92u4a`. Ne pas créer de PR sans qu'on te le demande.

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
Fait et poussé sur la branche (pas encore publié en pré-prod sur `main` ;
la pré-prod en ligne est la 3.0.6) :
- Récap de booster sans défilement sur mobile ; compteur de boosters retiré
  de la barre du haut → pastille sur l'onglet Boosters.
- En-tête mobile : avatar recadré, niveau affiché.
- Onglet Combats : accueil qui remplit l'écran, tuile Tutoriel mise en avant,
  titre qui ne chevauche plus ; onglets d'Actes verrouillés non cliquables ;
  Guide à onglets « Règles | Glossaire » (règles en premier).
- Collection : options d'affichage remises (possédées, favoris, objectif).
- Classement réduit à 4 critères (niveau, collection, Secrètes, Versus).
- Événement : Brawks « Déter » en illustration propre (`_sources/combat/brawks-deter.jpg`),
  tapis adapté ; Nouveautés et Raid recadrés (`illuCadre()` dans `js/ui.js`) ;
  cadre « The French Sorcerer » (`f_foudre`) dans la boutique d'événement ;
  Nouveautés : la refonte visuelle remplace le Guide, cadre Secrète mis en avant,
  texte des Secrètes corrigé.
- Cadres Foudre et Arène (niv10/20/30/50) redessinés (`tools/cadres-30.py`).
- Combat : animations rejouées depuis des instantanés par événement (cibles
  qui ne disparaissent plus avant l'impact), effets temporaires visibles
  (événements `mod`), flèche de visée, clics perdus sur iOS corrigés ;
  **carte agrandie** = carte intacte en grand + panneau d'état en direct
  dessous (rien n'est posé sur la carte : demande explicite du propriétaire) ;
  **engagement sans rotation** (carte assombrie + étiquette « Engagé »).
- Tutoriel : textes réécrits, deux étapes d'info ajoutées.
- Tests : `combat-tests` 38/38 ; parties complètes simulées sans erreur.

## Ce qui reste à faire (dans cet ordre)
1. **Tutoriel (tâche en cours)** : rejouer le tutoriel dans Chromium après
   les changements de carte agrandie et d'engagement ; vérifier que les
   sélecteurs `vise` de `js/combat/tutoriel.js` pointent encore sur des
   éléments existants (notamment `[data-ar="attaque"]` dans le panneau sous
   la carte agrandie).
2. **Maîtrise des cartes (Fragments + exemplaires)** — commencée, inerte pour
   l'instant (rien n'est branché) :
   - Fait : `js/maitrise.js` (config, coûts, enveloppe visuelle, onglet
     Maîtrise de la fiche, carte fétiche) et `supabase/28_maitrise.sql`
     (tables `maitrises`, `maitrises_journal`, colonne `profiles.fetiche`,
     `maitriser()`, `set_fetiche()`, `maitrise_etat()`, `fetiche_de()`).
     Lire leurs en-têtes : toute la règle y est.
   - Règle décidée : 5 niveaux (Éclat, Gravure, Aura, Arène, Légende) ;
     Fragments 300/700/1500/3000/6000 ; exemplaires par rareté
     C/PC 1-1-2-2-3, R 0-1-1-2-2, E 0-1-1-1-1, L 0-0-1-0-1, S 0 ; seuls les
     exemplaires EN TROP sont pris (au-delà de la limite de deck 2 — 1 pour
     L/S —, de « à garder » et des échanges en attente) ; chaque exemplaire
     manquant est remplacé par son coût de fabrication en Fragments ; une
     Reverse partage la maîtrise de sa carte ; ni Essences ni Promos (sauf
     Secrètes).
   - À faire : ajouter `28_maitrise.sql` à `tools/build-sql.py` ; ajouter
     `'maitrise', maitrise_etat(p)` dans `me()` et `'fetiche', fetiche_de(o.id)`
     dans `player_profile()` (`07_vitrine.sql`) ; reconstruire `TOUT.sql` ;
     tester sur un Postgres local (installer 2.1 de `main` puis la 3.0 deux
     fois : doit être rejouable) ; serveur de démo : RPC `maitriser`,
     `set_fetiche`, champs `maitrise`/`fetiche` ; `Backend.maitriser`,
     `Backend.setFetiche` et `save.maitrises`/`save.fetiche` (mapping depuis
     `etat.maitrise`) ; `renderCard(c, {m, calme})` qui utilise
     `maitriseEnveloppe` ; nouveau `css/maitrise.css` (lumière, gravure, aura
     à particules, bordure lumineuse, couronne/holo, variante `mz-calme` sans
     animation pour les grilles) ; inclure `js/maitrise.js` (après
     `render-card.js`) et `css/maitrise.css` dans `index.html` et dans la
     liste de cache de `sw.js`.
   - Fiche de carte (`js/viewer.js`, `css/viewer.css`) : mini-menu
     **swipable** sous la carte (pages en scroll-snap, comme les fiches de
     profil) : « Infos » (attaques, Défense, passifs, style commun aux
     combats) | « Maîtrise » (`vMaitriseFiche`) | « Gérer » (favori, à garder,
     carte fétiche). Écrire `rafraichirFicheVw(eclair)` et brancher les
     clics `data-v="maitriser"`, `"mz-apercu"`, fétiche.
   - Combat : classes de maîtrise sur mes cartes (plateau, main, carte
     agrandie) ; à l'entrée, éclat dès le niveau 4, onde de choc au 5 ;
     coups colorés dès le 4.
3. **Carte fétiche sur le profil** : `vFetiche()` en haut de son profil
   (`js/profile.js`, au-dessus de la vitrine de 4 cartes, qui reste), et sur
   la fiche des autres joueurs (`js/social.js`) ; CSS `.fet` (projecteur aux
   couleurs de l'Essence, rayons, carte flottante) — « il faut que ça claque ».
4. **Finition** : `node tools/combat-tests.js`, parties simulées, tutoriel,
   captures mobile (390/375/360 px) et PC, cadres en petite taille ;
   `python3 tools/version.py` → 3.0.7 ; README (notes de version) et
   `docs/` (économie : la maîtrise) ; commit, push de la branche, publication
   de la pré-prod ; compte rendu honnête au propriétaire.

## Choix d'interprétation à signaler au propriétaire
- « Éclats » dans sa demande de maîtrise a été lu comme **Fragments** (le
  contexte était « nouvelle utilité des fragments »).
- Conflit exemplaires/decks résolu comme ci-dessus (exemplaires en trop
  seulement, manque payé en Fragments).
- Classement réduit à 4 critères ; la carte fétiche est distincte de la
  vitrine de 4 cartes.
- Non vérifié : vrai appareil iOS (safe-area), maîtrise de l'adversaire en
  Versus (non affichée).
