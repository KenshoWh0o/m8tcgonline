# Consignes pour les agents (ligne 2.x)

Cette branche, `version-2.5`, porte le **vrai site** (la 2.x, aujourd'hui la 2.5) ; `main` en est la copie publiée, plus `demo/`, la démo de la 3.0 présentée à Gentle Mates (`matetcg.com/demo/`, derrière un code d'accès ; `preprod/` et `prebuild/` en ont été retirés le 2 novembre 2026). La 3.0 vit sur la branche `version-3.0`, avec son propre `README.md` et son propre `CLAUDE.md`. Où on en est, ce qui vient, et le calendrier précis : `docs/feuille-de-route.md` (importé plus bas, et en copie identique sur `version-3.0`).

**La branche de travail.** Le travail de la 2.x se fait sur `version-2.5`. Une session qui impose sa propre branche (`claude/…`) la part de `version-2.5`, y travaille, puis la fusionne dans `version-2.5` à la fin (sans réécrire l'historique), avec l'accord du propriétaire ; rien ne va sur `main` sans son accord explicite (règle 1).

**La documentation de cette branche est chargée d'office** : les fichiers importés en bas de ce document (syntaxe `@chemin` de Claude Code) entrent dans le contexte au démarrage de chaque session, sans qu'il faille penser à les ouvrir. Les lire vraiment, en entier, avant toute modification : ils sont là pour que le propriétaire n'ait pas à se répéter. Si le travail touche à la 3.0 ou à `demo/`, lire aussi `README.md`, `CLAUDE.md` et `docs/*.md` de `origin/version-3.0` (`git show origin/version-3.0:README.md`), qui ne peuvent pas être importés d'ici.

## Règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Aucun SQL 3.0 sur la base de production ; `version-3.0` ne se fusionne jamais dans `main` ; de la 3.0, seul `demo/` va sur `main`, et seulement quand le propriétaire demande de la republier. La 2.x évolue à la demande du propriétaire, et ne se publie à la racine de `main` qu'avec son accord explicite.
2. **Pas de pull request** sans demande explicite.
3. **Français partout** : interface, commentaires, documentation, messages de commit, réponses.
4. **Mode sombre uniquement.**
5. **Aucun identifiant de modèle d'IA** dans les messages de commit (pas de ligne `Co-Authored-By` qui nomme un modèle), le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : ce qui est sûr, ce qui est supposé, ce qui n'a pas été testé.
7. **Ne jamais jouer de SQL sur la vraie base** sans l'action ou l'accord explicite du propriétaire : on livre le fichier (par exemple `supabase/MAJ-2.5.sql`), il le colle.
8. **L'Échauffement : pas d'écran qui défile d'un tout petit peu** (précisé par le propriétaire le 25 octobre 2026 : « c'est pour éviter les écrans où il faut juste scroll un tout petit peu alors que ça pourrait tenir en un screen ; pour les choses détaillées, y a pas de soucis si il faut scroll »). Aux quatre tailles de référence (README, « Version 2.5 »), une vue qui pourrait tenir tient : l'écran du défi, la scène du combat, et les sous-onglets courts (Boutique, Classement, Indices, le défi du jour, le récap) ; une page détaillée (Défis, Quêtes, Pass) défile franchement. Et l'onglet reste **cohérent avec l'écran Reflets** (sa charpente et ses composants, `css/reflets.css`), avec les couleurs de l'événement : un mélange de la 2.0 et de la 3.0, pas une DA à part.
9. **Un indice ne promet rien d'incertain** : pas de règle de combat de la 3.0 qui soit un choix « maison » (taille du deck, lignes, PV : `docs/regles-3.0.md` de la 3.0).

## À chaque modification

- **Reporter dans la 3.0** ce qui n'est pas propre à la 2.x (une règle d'économie, un correctif, un outil) : dans la même session si possible, sinon l'inscrire dans le registre de `docs/feuille-de-route.md` (§ 5), « à reporter ». Les deux lignes ne se fusionnent pas l'une dans l'autre : on reporte à la main et on teste dans la 3.0.
- **Mettre les `.md` à jour dans le même commit** : `README.md` (la section du domaine, l'arborescence si un fichier change, « Où modifier quoi », « Administrateurs » si le Labo change), et ce fichier si une règle change. Un README faux est pire que pas de README.
- Ne jamais modifier `prebuild/` à la main : `python3 tools/demo.py --prebuild` (en local : il n'est plus versionné ni publié). Ne jamais lancer `--preprod` ni `--demo` ici (c'est la 3.0).
- Une règle de jeu a plusieurs copies : SQL, `_demo/serveur.js`, et parfois une constante JS (pour L'Échauffement : `ech_simuler` et `echCombat`, à la ligne près).
- `TOUT.sql` et `MAJ-*.sql` sont générés : `python3 tools/build-sql.py`.
- **Avant toute mise à jour de la vraie base, comparer ses fonctions** (empreintes de `pg_get_functiondef`, droits, colonnes) à une installation locale du SQL qu'on croit en place : elle peut être en retard sur le site (le 22 octobre 2026, elle était restée au SQL 2.1.0 alors que le site était en 2.1.3). Les outils de la 2.5 (`tools/maj-2.5/` : banc local, envois tout faits, contrôles en lecture seule) servent de modèle. **La voie sûre : le propriétaire colle le fichier** dans le SQL Editor, puis la session vérifie en lecture seule (`agregat.sql`, `donnees.sql`), ce que l'outil Supabase fait sans confirmation. Un envoi par l'outil qui contient `delete from` ou `drop` attend une confirmation du propriétaire qui n'attend qu'une minute, et elle ne lui est jamais parvenue (trois fois sur trois, les 24 et 25 octobre 2026) : si on tente quand même, prévenir le propriétaire avant, et relire les empreintes de la base avant toute suite (un envoi confirmé après coup a pu passer). Un fichier copié depuis un navigateur sous Windows arrive en fins de ligne `\r\n` dans les corps de fonction : le jeu n'en souffre pas, mais les empreintes changent (le 25 octobre 2026, 79 fonctions) — `tools/maj-2.5/fix-crlf.sql` les rétablit. Comparer un contenu en `jsonb` (`to_jsonb`), jamais en `row_to_json` : l'ordre des colonnes de la vraie base n'est pas celui d'une installation neuve.
- **Commiter et pousser au fur et à mesure** : la session tourne dans un conteneur qui peut être remplacé sans prévenir (le 24 octobre 2026, un travail testé mais pas commité a été perdu et refait).
- Vérifier : le SQL sur un PostgreSQL local (la base de `main` d'abord, puis la mise à jour, deux fois) ; toute modification visible dans Chromium (Playwright) à 390 × 844, 375 × 667, 360 × 740 et 1280 × 800, captures regardées ; pour L'Échauffement, mesurer `#main.scrollHeight - #main.clientHeight` sur chaque vue : 0 pour les vues courtes, et jamais un débordement de quelques dizaines de pixels.

## La documentation importée

@README.md
@docs/feuille-de-route.md
@SETUP.md
@presse/README.md
