# Feuille de route

> **Ce fichier existe en deux copies identiques**, une sur `version-2.5` (donc aussi sur `main`) et une sur `version-3.0`. Toute modification se fait dans les deux, dans la même session : copier le fichier d'une branche à l'autre (`git show origin/version-2.5:docs/feuille-de-route.md > docs/feuille-de-route.md`, ou l'inverse), puis vérifier que `git diff origin/version-2.5 origin/version-3.0 -- docs/feuille-de-route.md` est vide une fois les deux poussées.

Mise à jour : vendredi 23 octobre 2026.

## 1. Ce que le propriétaire a dicté (23 octobre 2026)

Mot pour mot. Rien de ce qui suit n'est à faire sans sa demande : c'est une trace, pas un ordre de travail.

> **2.5 (dimanche soir minuit)** : rajout de quelques petits trucs pour pas tourner uniquement la version autour de l'event, event échauffement, pendant 7 jours, puis continuité de l'event en mode infini et avec moins de récompense (mais pas comme devine l'illu, ça reste un event) du temps qu'on pourra pas publier la 3.0, puis dès qu'on sait la date de sortie de celle-ci on commencera le teasing final avant de faire une maintenance et faire l'update
>
> **3.0** : peaufinage de l'onglet d'event et globalement de l'interface, intégration des VRAIES règles de combat (lorsqu'on les aura), intégration des visuels des P03/P04, refonte des icones du site bannière etc en accord avec la nouvelle DA,…

Le « … » final est du propriétaire : la liste de la 3.0 n'est pas close.

## 2. Le calendrier (heure de Paris)

| Quand | Quoi | Où c'est réglé |
|---|---|---|
| ven. 23 oct., minuit (sam. 24, 0 h, heure d'été) | Fin de Reflets ; son récap commence, avec le teasing de la 2.5 | `evenements.fin` (calendrier-2.5.sql) |
| nuit du sam. 24 au dim. 25 | Changement d'heure (3 h d'été → 2 h d'hiver) | — |
| **dim. 25 oct., minuit (lun. 26, 0 h, heure d'hiver)** | **Sortie de la 2.5** : fin du récap, L'Échauffement (défi 1), Reverses recyclables et fabricables, numéro « 2.5 », fenêtre des nouveautés | `evenements.recap_jusqua`, `ech_saison.debut`, `parametres.reverses_des`, `parametres.sorties` ; `SORTIE` dans `js/config.js` |
| lun. 26 → dim. 1er nov., chaque jour à 0 h | Un défi de plus (2 le mardi 27… 7 le dimanche 1er) | `ech_jour_ouvert()` (24 h depuis `ech_saison.debut`) |
| lun. 2 et mar. 3 nov. | Pas de nouveau défi : on rattrape (trois essais par défi et par jour, jours passés jouables) | — |
| mer. 4 nov., 0 h (+ une heure de grâce) | Fin de la saison de L'Échauffement | `ech_saison.fin` |
| ensuite | *Mode sans fin de L'Échauffement* : **pas fait**, voir § 3 | — |

En UTC : la sortie de la 2.5 tombe le **dimanche 25 octobre à 23 h 00 UTC** ; la fin de Reflets, le vendredi 23 à 22 h 00 UTC.

## 3. La 2.5

**Fait** (branche `version-2.5`, en ligne sur `main` depuis le 23 octobre, en attente de sa sortie) :
- L'Échauffement (sept défis, coup d'éclat, indices, récompenses), sous le nom 2.1.4 jusqu'au 23 octobre ;
- les Reverses recyclables et fabricables (400 / 500 / 2 400 Fragments), reportées de la fin de Reflets à la sortie de la 2.5 ;
- la sortie datée : le site se montre en « 2.1.3 » jusqu'à la minute dite, puis bascule seul (README, « Version 2.5 · La sortie datée ») ;
- la fenêtre des nouveautés de la 2.5 ; le teasing de la 2.5 dans le récap de Reflets ;
- l'indice 3 corrigé : 127 cartes (122 + 5 Secrètes), et non 128 ;
- les marques de cache à empreinte (`tools/version.py`) ;
- **le Labo refait** (README, « Administrateurs ») : le serveur (le calendrier en frise, aller à un état, avancer d'un jour, les Reverses, remettre L'Échauffement à zéro), son compte (sauvegarde et restauration, master set, ressources, cosmétiques, ses étoiles), les joueurs, les aperçus. Il est sur `version-2.5` et dans le prébuild ; sur le vrai site, il arrive avec la publication de dimanche, et ses fonctions avec `MAJ-2.5.sql` (§ 6).

**Prévu par le propriétaire, pas encore fait :**
- « quelques petits trucs pour pas tourner uniquement la version autour de l'event » : le propriétaire compte les ajouter avant dimanche soir. Chacun s'ajoute aussi à la fenêtre des nouveautés (`NOUVEAUTES_25`, `js/bienvenue.js`) et au README.
- Après les 7 jours : L'Échauffement continue « en mode infini et avec moins de récompense (mais pas comme devine l'illu, ça reste un event) », tant que la 3.0 n'est pas publiable. **Rien n'est décidé ni fait.** Questions ouvertes, à trancher par le propriétaire :
  - quand il commence : après le défi 7 (lundi 2 novembre) ou après le rattrapage (mercredi 4 novembre, la fin actuelle de la saison) ;
  - ce qu'on y joue : les sept défis à nouveau, des défis tirés au hasard, une difficulté qui monte… ;
  - ce qu'il rapporte (« moins de récompense ») et s'il garde un classement, des étoiles, un titre ;
  - ce que deviennent les indices (tous déjà gagnables pendant les 7 jours).
- Dès que la date de sortie de la 3.0 est connue : le **teasing final**, puis une **maintenance**, puis la mise à jour 3.0. Rien n'est préparé côté 2.x pour la maintenance (pas d'écran de maintenance aujourd'hui ; l'écran d'attente de la bêta, `js/gate.js`, en est le plus proche).

## 4. La 3.0

**Où elle en est** : branche `version-3.0`, démo publiée sur `main` dans `preprod/` (matetcg.com/preprod/), version 3.0.9. Son README dit tout ce qui est fait.

**Prévu par le propriétaire** (§ 1) :
- peaufiner l'onglet d'événement et l'interface en général ;
- intégrer les **vraies** règles de combat, quand elles seront connues : celles de la pré-prod sont reconstituées, avec des choix « maison » (taille du deck, lignes, PV : `docs/regles-3.0.md` de la 3.0) ;
- intégrer les visuels des Promos P03 et P04 (aujourd'hui « Coming soon », `PROMOS_A_VENIR`) ;
- refaire les icônes du site, la bannière, etc., selon la nouvelle DA (« Graphite et lavande », `docs/design-3.0.md` de la 3.0) ;
- « … » : la liste reste ouverte.

## 5. Ce qui passe de la 2.x à la 3.0

**Règle** (dans les deux `CLAUDE.md`) : tout changement de la 2.x qui n'est pas propre à la 2.x se reporte dans la 3.0, dans la même session si possible ; sinon il est inscrit ici, « à reporter ». La 3.0 ne se fusionne jamais dans `main`, et la 2.x ne se fusionne pas dans `version-3.0` (leurs fichiers ont trop divergé) : on reporte à la main, fichier par fichier, et on teste dans la 3.0.

| Changement de la 2.x | Date | Dans la 3.0 |
|---|---|---|
| Reverses : recyclage et fabrication datés (`parametres.reverses_des`, `reverses_ouvertes()`), prix 400 / 500 / 2 400 (`prix_reverse()`), `me()` › `parametres.reverses`, la page | 22-23 oct. | à reporter |
| Marques de cache à empreinte (`tools/version.py`) | 23 oct. | à reporter |
| Sortie datée d'une version (`SORTIE`, `parametres.sorties`) | 23 oct. | à décider : la 3.0 sortira après une maintenance, pas forcément ainsi |
| L'Échauffement (`ech_*`), l'indice 127 | 22-23 oct. | propre à la 2.x : la 3.0 a ses propres combats. Sa base doit seulement ne pas casser les tables `ech_*` à la sortie (README de la 3.0, « Pièges ») |
| Labo de la 2.5 | 23 oct. | la 3.0 a son propre Labo, refait à part |

## 6. Dimanche 25 octobre : publier la 2.5

À faire avant **23 h, heure de Paris** (22 h UTC), pour laisser une heure de marge :

1. Les ajouts du propriétaire sur `version-2.5`, essayés dans le prébuild (`python3 tools/demo.py --prebuild`, puis reporter `prebuild/` sur `main`).
2. **Avec l'accord du propriétaire**, la mise à jour SQL de la vraie base : `supabase/MAJ-2.5.sql` (rejouable). Elle apporte ce que la base n'a pas encore : `22d_admin.sql` (le Labo de la 2.5 et la date de sortie), le nouveau `me()` (qui envoie `parametres.sorties`), `ech_admin_rejouer`. Avant : comparer les fonctions de la base à une installation locale (CLAUDE.md, « À chaque modification »).
3. **Avec l'accord du propriétaire** (règle 1 de `CLAUDE.md`) : `python3 tools/version.py 2.5`, commit, `version-2.5` fusionnée dans `main`, poussée.
4. Contrôle : `verif.html` tout vert ; le site dit « version 2.1.3 » et le récap annonce la 2.5.
5. Après minuit : le site dit « version 2.5 », la fenêtre des nouveautés s'ouvre, le défi 1 est jouable, une Reverse se fabrique.

**Si l'étape 2 n'est pas faite**, le site sort quand même à l'heure (la date est aussi dans le code) ; seuls les outils du Labo de la 2.5 qui touchent au serveur répondent « fonction absente ». **Si l'étape 3 n'est pas faite**, la 2.5 déjà en ligne sort seule à minuit, sans les ajouts du propriétaire.

## 7. Décisions récentes, et pourquoi

- **22 oct.** La vraie base était restée au SQL de la 2.1.0 : la mise à jour rattrape la 2.1.1. Règle ajoutée : comparer la base avant toute mise à jour.
- **22 oct.** Prix des Reverses fabriquées : 400 / 500 / 2 400 et non le double d'une classique (simulation, `tools/equilibre-reverses.py`).
- **23 oct.** La 2.1.4 devient la **2.5**, une mise à jour à part entière (fenêtre, numéro), qui sort à la fin du récap de Reflets.
- **23 oct.** Les Reverses ouvrent avec la 2.5, et non à la fin de Reflets.
- **23 oct.** L'indice 3 dit **127** (122 + 5 Secrètes).
- **23 oct.** Branches : `version-2.5` remplace `claude/interface-ux-fixes-o92u4a` et `teaser-2.x` (toutes deux contenues dans `version-2.5` et `main`). Leur suppression est à faire par le propriétaire : le proxy GitHub des sessions Claude Code refuse de supprimer une branche.
- **23 oct.** Le Labo est refait : ce qui touche le serveur est réel et se confirme, ce qui touche son compte se sauvegarde et se restaure, les aperçus restent locaux. L'onglet « Affichage » (des changements « affichage seulement ») disparaît.
