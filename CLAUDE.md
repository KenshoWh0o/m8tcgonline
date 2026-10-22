# Consignes pour les agents (ligne 2.x)

Cette branche porte le **vrai site** (la 2.x). La 3.0 vit sur la branche `version-3.0`, avec son propre `README.md` et son propre `CLAUDE.md`.

**Avant toute modification, lire tous les `.md` du dépôt** : `README.md` (en entier), `SETUP.md`, `presse/README.md`. Si le travail touche à la 3.0 ou à `preprod/`, lire aussi `README.md` et `CLAUDE.md` de `origin/version-3.0` (`git show origin/version-3.0:README.md`). Ils sont là pour que le propriétaire n'ait pas à se répéter.

## Règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Aucun SQL 3.0 sur la base de production ; `version-3.0` ne se fusionne jamais dans `main` ; de la 3.0, seul `preprod/` va sur `main`. La 2.x évolue à la demande du propriétaire, et ne se publie à la racine de `main` qu'avec son accord explicite.
2. **Pas de pull request** sans demande explicite.
3. **Français partout** : interface, commentaires, documentation, messages de commit, réponses.
4. **Mode sombre uniquement.**
5. **Aucun identifiant de modèle d'IA** dans les messages de commit (pas de ligne `Co-Authored-By` qui nomme un modèle), le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : ce qui est sûr, ce qui est supposé, ce qui n'a pas été testé.
7. **Ne jamais jouer de SQL sur la vraie base** sans l'action ou l'accord explicite du propriétaire : on livre le fichier (par exemple `supabase/MAJ-2.1.4.sql`), il le colle.

## À chaque modification

- **Mettre les `.md` à jour dans le même commit** : `README.md` (la section du domaine, l'arborescence si un fichier change, « Où modifier quoi », « Administrateurs » si le Labo change), et ce fichier si une règle change. Un README faux est pire que pas de README.
- Ne jamais modifier `prebuild/` à la main : `python3 tools/demo.py --prebuild`. Ne jamais lancer `--preprod` ici (`preprod/` est la 3.0).
- Une règle de jeu a plusieurs copies : SQL, `_demo/serveur.js`, et parfois une constante JS (pour L'Échauffement : `ech_simuler` et `echCombat`, à la ligne près).
- `TOUT.sql` et `MAJ-*.sql` sont générés : `python3 tools/build-sql.py`.
- Vérifier : le SQL sur un PostgreSQL local (la base de `main` d'abord, puis la mise à jour, deux fois) ; toute modification visible dans Chromium (Playwright) à 390 × 844, 375 × 667, 360 × 740 et 1280 × 800, captures regardées.
