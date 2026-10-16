# Consignes pour les agents

**Lire [`README.md`](README.md) en entier avant toute modification.** C'est la documentation de référence du projet : où vit quoi, architecture, direction artistique, serveur, pièges, dette connue.

## Règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Le travail sur la 3.0 ne touche que `preprod/` sur `main` ; aucun SQL 3.0 n'est joué sur la base Supabase de production ; la branche `version-3.0` ne se fusionne jamais dans `main` (procédure de publication : README § 2.5). Le vrai site (la 2.x), lui, peut évoluer quand le propriétaire le demande (README § 1.3).
2. **Pas de pull request** sans demande explicite.
3. **Français partout** : interface, commentaires, documentation, messages de commit, réponses.
4. **Mode sombre uniquement.** La DA « Graphite et lavande » (README § 5) s'applique à tout écran nouveau ou retouché.
5. **Aucun identifiant de modèle d'IA** dans les messages de commit (pas de ligne `Co-Authored-By` qui nomme un modèle), le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : dire ce qui est sûr, ce qui est supposé, ce qui n'a pas été testé.

## À chaque modification

- **Mettre `README.md` à jour dans le même commit** (README § 1.4 dit quelles sections toucher). Un README faux est pire que pas de README.
- Modifier les sources (`js/`, `css/`, `_demo/`, `supabase/`), jamais `preprod/` à la main : reconstruire avec `python3 tools/demo.py --preprod`.
- Une règle de jeu a trois copies : SQL, `_demo/serveur.js`, constante JS (README § 9.8).
- Vérifier : `node tools/combat-tests.js` ; toute modification visible se regarde dans Chromium (Playwright) aux largeurs 390, 375, 360 et sur ordinateur ; le SQL se teste sur PostgreSQL local (README § 2.3).
