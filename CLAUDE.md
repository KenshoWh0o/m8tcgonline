# Consignes pour les agents

**Toute la documentation de la branche est chargée d'office** : les fichiers importés en bas de ce document (syntaxe `@chemin` de Claude Code) entrent dans le contexte au démarrage de chaque session — `README.md`, la référence (où vit quoi, architecture, direction artistique, serveur, pièges, dette connue), `docs/design-3.0.md` (avant un écran), `docs/regles-3.0.md` (avant les combats), `docs/economie-3.0.md` (avant un montant), `docs/feuille-de-route.md` (ce qui est prévu, et ce qui passe de la 2.x à la 3.0), `SETUP.md` (le serveur) et `presse/README.md`. Les lire vraiment, en entier, avant toute modification : ils existent pour que le propriétaire n'ait pas à se répéter.

**La ligne 2.x** (le vrai site) vit sur la branche `version-2.5`, avec son propre `README.md` et son `CLAUDE.md` : les lire avant de toucher à la racine de `main` (`git show origin/version-2.5:README.md`). Les deux lignes ont trop divergé pour se fusionner : on reporte à la main.

**La feuille de route** (`docs/feuille-de-route.md`, importée plus bas) existe en deux copies identiques, ici et sur `version-2.5` : ce que le propriétaire a dicté pour la 2.5 et la 3.0, le calendrier, et le registre de ce qui passe de la 2.x à la 3.0. La modifier dans les deux branches, dans la même session.

## Règles du propriétaire (non négociables)

1. **Rien de la 3.0 sur le vrai site.** Le travail sur la 3.0 ne touche que `demo/` sur `main`, la démo présentée à Gentle Mates (`matetcg.com/demo/`, derrière un code d'accès), et **seulement quand le propriétaire demande de la republier** (« arrête de mettre à jour le fichier demo dans le repo », 1er novembre 2026) ; aucun SQL 3.0 n'est joué sur la base Supabase de production ; la branche `version-3.0` ne se fusionne jamais dans `main` (procédure de publication : README § 2.5). Le vrai site (la 2.x), lui, peut évoluer quand le propriétaire le demande (README § 1.3).
7. **La démo de Gentle Mates montre le jeu à son premier jour** : ni numéro de version, ni nouveautés, ni mise à jour, ni événement passé (le Choc y est « un event ponctuel »), et aucune mention de l'IA, même implicite (README § 2.6).
2. **Pas de pull request** sans demande explicite.
3. **Français partout** : interface, commentaires, documentation, messages de commit, réponses.
4. **Mode sombre uniquement.** La DA « Graphite et lavande » (README § 5) s'applique à tout écran nouveau ou retouché.
5. **Aucun identifiant de modèle d'IA** dans les messages de commit (pas de ligne `Co-Authored-By` qui nomme un modèle), le code ou la documentation.
6. **Comptes rendus honnêtes et exhaustifs** : dire ce qui est sûr, ce qui est supposé, ce qui n'a pas été testé.

## À chaque modification

- **Mettre les `.md` à jour dans le même commit** : `README.md` (README § 1.4 dit quelles sections toucher), `docs/*.md` si leur sujet change, ce fichier si une règle change. Un README faux est pire que pas de README.
- Modifier les sources (`js/`, `css/`, `_demo/`, `supabase/`), jamais `preprod/` ni `demo/` à la main : reconstruire avec `python3 tools/demo.py --preprod` (essais en local) ou `--demo`. Ni l'un ni l'autre n'est versionné sur la branche ; une modification visible ne se voit donc chez le propriétaire qu'une fois `demo/` republiée, à sa demande : le dire dans le compte rendu.
- Une règle de jeu a trois copies : SQL, `_demo/serveur.js`, constante JS (README § 9.8).
- **Ce qui change dans la 2.x se reporte ici** s'il n'est pas propre à la 2.x (L'Échauffement l'est) : dans la même session si possible, sinon inscrit « à reporter » dans `docs/feuille-de-route.md` § 5. Sinon le `TOUT.sql` de la 3.0 défait la règle de la 2.x le jour de la sortie (README § 13, piège 31).
- **Le jour de la sortie, la vraie base** : comparer ses empreintes avant ; le propriétaire colle le fichier, on vérifie en lecture seule ; fins de ligne Windows et comparaisons en `jsonb` (README § 13, point 33).
- **Commiter et pousser au fur et à mesure** : la session tourne dans un conteneur qui peut être remplacé sans prévenir (le 24 octobre 2026, un travail testé mais pas commité a été perdu et refait).
- Vérifier : `node tools/combat-tests.js` ; toute modification visible se regarde dans Chromium (Playwright) aux largeurs 390, 375, 360 et sur ordinateur ; le SQL se teste sur PostgreSQL local (README § 2.3).

## La documentation importée

@README.md
@docs/feuille-de-route.md
@docs/design-3.0.md
@docs/regles-3.0.md
@docs/economie-3.0.md
@SETUP.md
@presse/README.md
