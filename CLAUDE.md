# Consignes pour les agents (ligne 2.x)

Cette branche porte le **vrai site** (la 2.x). La 3.0 vit sur la branche `version-3.0`, avec son propre `README.md` et son propre `CLAUDE.md`.

**La documentation de cette branche est chargée d'office** : les fichiers importés en bas de ce document (syntaxe `@chemin` de Claude Code) entrent dans le contexte au démarrage de chaque session, sans qu'il faille penser à les ouvrir. Les lire vraiment, en entier, avant toute modification : ils sont là pour que le propriétaire n'ait pas à se répéter. Si le travail touche à la 3.0 ou à `preprod/`, lire aussi `README.md`, `CLAUDE.md` et `docs/*.md` de `origin/version-3.0` (`git show origin/version-3.0:README.md`), qui ne peuvent pas être importés d'ici.

## Règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Aucun SQL 3.0 sur la base de production ; `version-3.0` ne se fusionne jamais dans `main` ; de la 3.0, seul `preprod/` va sur `main`. La 2.x évolue à la demande du propriétaire, et ne se publie à la racine de `main` qu'avec son accord explicite.
2. **Pas de pull request** sans demande explicite.
3. **Français partout** : interface, commentaires, documentation, messages de commit, réponses.
4. **Mode sombre uniquement.**
5. **Aucun identifiant de modèle d'IA** dans les messages de commit (pas de ligne `Co-Authored-By` qui nomme un modèle), le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : ce qui est sûr, ce qui est supposé, ce qui n'a pas été testé.
7. **Ne jamais jouer de SQL sur la vraie base** sans l'action ou l'accord explicite du propriétaire : on livre le fichier (par exemple `supabase/MAJ-2.1.4.sql`), il le colle.
8. **L'Échauffement tient dans l'écran, sans défiler** : ses trois sous-onglets, l'écran du défi et la scène de combat, aux quatre tailles de référence (README, « Version 2.1.4 »).
9. **Un indice ne promet rien d'incertain** : pas de règle de combat de la 3.0 qui soit un choix « maison » (taille du deck, lignes, PV : `docs/regles-3.0.md` de la 3.0).

## À chaque modification

- **Mettre les `.md` à jour dans le même commit** : `README.md` (la section du domaine, l'arborescence si un fichier change, « Où modifier quoi », « Administrateurs » si le Labo change), et ce fichier si une règle change. Un README faux est pire que pas de README.
- Ne jamais modifier `prebuild/` à la main : `python3 tools/demo.py --prebuild`. Ne jamais lancer `--preprod` ici (`preprod/` est la 3.0).
- Une règle de jeu a plusieurs copies : SQL, `_demo/serveur.js`, et parfois une constante JS (pour L'Échauffement : `ech_simuler` et `echCombat`, à la ligne près).
- `TOUT.sql` et `MAJ-*.sql` sont générés : `python3 tools/build-sql.py`.
- **Avant toute mise à jour de la vraie base, comparer ses fonctions** (empreintes de `pg_get_functiondef`, droits, colonnes) à une installation locale du SQL qu'on croit en place : elle peut être en retard sur le site (le 22 octobre 2026, elle était restée au SQL 2.1.0 alors que le site était en 2.1.3). Avec l'outil Supabase : envoyer par morceaux, chacun terminé par un contrôle d'empreintes qui l'annule en cas d'écart ; un envoi qui contient `delete from` attend une confirmation du propriétaire.
- Vérifier : le SQL sur un PostgreSQL local (la base de `main` d'abord, puis la mise à jour, deux fois) ; toute modification visible dans Chromium (Playwright) à 390 × 844, 375 × 667, 360 × 740 et 1280 × 800, captures regardées ; pour L'Échauffement, `#main` ne défile pas.

## La documentation importée

@README.md
@SETUP.md
@presse/README.md
