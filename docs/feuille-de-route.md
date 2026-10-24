# Feuille de route

> **Ce fichier existe en deux copies identiques**, une sur `version-2.5` (donc aussi sur `main`) et une sur `version-3.0`. Toute modification se fait dans les deux, dans la même session : copier le fichier d'une branche à l'autre (`git show origin/version-2.5:docs/feuille-de-route.md > docs/feuille-de-route.md`, ou l'inverse), puis vérifier que `git diff origin/version-2.5 origin/version-3.0 -- docs/feuille-de-route.md` est vide une fois les deux poussées.

Mise à jour : samedi 24 octobre 2026, au soir.

## 1. Ce que le propriétaire a dicté

Mot pour mot. Rien de ce qui suit n'est à faire sans sa demande : c'est une trace, pas un ordre de travail.

**Le 23 octobre 2026 :**

> **2.5 (dimanche soir minuit)** : rajout de quelques petits trucs pour pas tourner uniquement la version autour de l'event, event échauffement, pendant 7 jours, puis continuité de l'event en mode infini et avec moins de récompense (mais pas comme devine l'illu, ça reste un event) du temps qu'on pourra pas publier la 3.0, puis dès qu'on sait la date de sortie de celle-ci on commencera le teasing final avant de faire une maintenance et faire l'update
>
> **3.0** : peaufinage de l'onglet d'event et globalement de l'interface, intégration des VRAIES règles de combat (lorsqu'on les aura), intégration des visuels des P03/P04, refonte des icones du site bannière etc en accord avec la nouvelle DA,…

Le « … » final est du propriétaire : la liste de la 3.0 n'est pas close.

**Le 24 octobre 2026 :**

> tu as mon accord pour coller MAJ-2.5.sql
>
> pour le mode infini de l'échauffement, il commence le 4 novembre après le rattrapage. en gros, il y aura la page de récap d'event sur l'onglet booster (comme actuellement pour reflets), et dans l'onglet combat le mode infini (ça sera expliqué dans un pop-up et dans l'onglet de récap).
>
> on y joue des adversaires plus ou moins durs, je te laisse t'en occuper. mais pas de difficulté croissante comme sur l'event du coup.
>
> il rapporte des récompenses équilibrées, comme le devine l'illu devenu permanent
>
> en fait y a un problème là, la 2.5 ne fait pas assez update, c'est juste un mini mode de jeu.
>
> il va falloir que tu me crées un truc à la hauteur de reflets et le choc, et que tu me donnes des idées de ce qu'on peut mettre en plus dans cette 2.5
>
> brainstorme moi tout ça, il faut que la 2.5 soit stylée, quitte à rework un peu l'écchauffement
>
> la ligne qui montre les fragments dans la collection n'est pas la même dans l'onglet classique et reverses. mets celle de classique partout
>
> l'onglet récompense de l'échaufffement est pas très beau

**Lecture des deux dictées sur le mode sans fin.** Le 23 disait « avec moins de récompense (mais pas comme devine l'illu, ça reste un event) » ; le 24 dit « des récompenses équilibrées, comme le devine l'illu devenu permanent ». Le plus récent a été suivi : le niveau de récompense de Devine l'illu (120 Éclats au plus par jour), dans un mode qui garde des atours d'événement (l'onglet Combats, un classement, une série, un titre). C'est une interprétation : à confirmer par le propriétaire.

## 2. Le calendrier (heure de Paris)

| Quand | Quoi | Où c'est réglé |
|---|---|---|
| ven. 23 oct., minuit (sam. 24, 0 h, heure d'été) | Fin de Reflets ; son récap commence, avec le teasing de la 2.5 | `evenements.fin` (calendrier-2.5.sql) |
| nuit du sam. 24 au dim. 25 | Changement d'heure (3 h d'été → 2 h d'hiver) | — |
| **dim. 25 oct., minuit (lun. 26, 0 h, heure d'hiver)** | **Sortie de la 2.5** : fin du récap de Reflets, L'Échauffement (défi 1) et son événement (Braises, Pass, quêtes, boutique, classement), Reverses recyclables et fabricables, numéro « 2.5 », fenêtre des nouveautés | `evenements.recap_jusqua`, `ech_saison.debut` (la ligne d'événement `echauffement` la suit), `parametres.reverses_des`, `parametres.sorties` ; `SORTIE` dans `js/config.js` |
| lun. 26 → dim. 1er nov., chaque jour à 0 h | Un défi de plus (2 le mardi 27… 7 le dimanche 1er) ; les quêtes du jour de l'événement se renouvellent | `ech_jour_ouvert()` (24 h depuis `ech_saison.debut`) |
| lun. 2 et mar. 3 nov. | Pas de nouveau défi : on rattrape (trois essais par défi et par jour, jours passés jouables) | — |
| **mer. 4 nov., 0 h** (+ une heure de grâce pour un essai commencé) | Fin de la saison et de l'événement ; **le récap** commence (bandeau sur Boosters, sous-onglet « Le récap » de Combats, une fenêtre qui explique la suite) ; **le mode sans fin** commence : un défi par jour, le même pour tous | `ech_saison.fin` ; `evenements.recap_jusqua` (fin + 3 jours) ; `ech_sf_premier()` |
| sam. 7 nov., 0 h | Fin du récap de L'Échauffement | `evenements.recap_jusqua` |
| ensuite, chaque jour à 0 h | Un nouvel adversaire du mode sans fin (21 adversaires, puis on recommence), sans date de fin, jusqu'à la 3.0 (qui le ferme) | `ech_sf_adversaires`, `22f_sans-fin.sql` |

En UTC : la sortie de la 2.5 tombe le **dimanche 25 octobre à 23 h 00 UTC** ; la fin de Reflets, le vendredi 23 à 22 h 00 UTC ; la fin de la saison, le mardi 3 novembre à 23 h 00 UTC.

## 3. La 2.5

**Fait** (branche `version-2.5`) :
- L'Échauffement (sept défis, coup d'éclat, indices), sous le nom 2.1.4 jusqu'au 23 octobre ; en ligne sur `main` depuis le 23 octobre, en attente de sa sortie ;
- les Reverses recyclables et fabricables (400 / 500 / 2 400 Fragments), reportées de la fin de Reflets à la sortie de la 2.5 ;
- la sortie datée : le site se montre en « 2.1.3 » jusqu'à la minute dite, puis bascule seul (README, « Version 2.5 · La sortie datée ») ;
- la fenêtre des nouveautés de la 2.5 ; le teasing de la 2.5 dans le récap de Reflets ;
- l'indice 3 corrigé : 127 cartes (122 + 5 Secrètes), et non 128 ;
- les marques de cache à empreinte (`tools/version.py`) ;
- **le Labo refait** (README, « Administrateurs ») : le serveur (le calendrier en frise, aller à un état — jusqu'au mode sans fin —, avancer d'un jour, les Reverses, remettre L'Échauffement à zéro), son compte (sauvegarde et restauration, master set, ressources, cosmétiques, ses étoiles), les joueurs, les aperçus ;
- **24 octobre, à la demande du propriétaire** (§ 1) :
  - **L'Échauffement devient un événement** à la hauteur de Reflets (`22e_echauffement-evenement.sql`) : sa monnaie, les **Braises** (étoiles des défis, quêtes du jour et de l'événement : 1 225 au plus) ; un **Pass** de 20 paliers (10 boosters, 600 Éclats, 1 100 Fragments, 4 Reverses Rares, une Brillante, les titres « Premier round » et « Feu sacré », les cadres décorés « Braise » et « Ardeur ») ; 13 **quêtes** ; une **boutique** (boosters, Fragments, Reverse Rare, titre « Entraîneur ») ; un **classement** ; un **récap** de trois jours. Six sous-onglets dans Combats (Défis, Pass, Quêtes, Boutique, Classement, Indices) ; l'ancien « Récompenses » (« pas très beau ») est remplacé par le Pass ;
  - **le mode sans fin** (`22f_sans-fin.sql`), à partir du 4 novembre : un défi par jour, le même pour tous, parmi 21 adversaires de niveaux mêlés (Facile, Moyen, Difficile, Redoutable), sans difficulté qui monte ; trois essais par jour ; 30 / 30 / 60 Éclats (120 au plus, comme une illu trouvée du premier coup) ; le titre « Infatigable » après dix jours gagnés ; une série et un classement ; expliqué par une fenêtre et par l'onglet du récap ;
  - la ligne des Fragments de la Collection, la même dans Classiques et Reverses ;
  - au profil, les cadres Braise et Ardeur verrouillés disent d'où ils viennent ;
  - **la mise à jour de la vraie base, prête mais pas appliquée** (§ 6) : l'accord est donné ; l'envoi du 24 au soir attendait une confirmation du propriétaire dans l'outil Supabase, qui n'est pas venue à temps.

**Décidé le 24 octobre sur le mode sans fin** (les quatre questions laissées ouvertes le 23) :
- *quand il commence* : le mercredi 4 novembre, après le rattrapage (le propriétaire) ;
- *ce qu'on y joue* : des adversaires « plus ou moins durs », « pas de difficulté croissante » (le propriétaire) ; le détail — 21 adversaires, un par jour dans un ordre qui mélange les niveaux, jamais la même règle deux jours de suite, chaque Défense calibrée par simulation — est un choix de la session (tableau dans `22f_sans-fin.sql`) ;
- *ce qu'il rapporte* : « des récompenses équilibrées, comme le devine l'illu devenu permanent » (le propriétaire, et § 1 pour la lecture) ; les montants, le titre, la série et le classement sont des choix de la session ;
- *les indices* : ils se relisent (sous-onglet « Indices ») ; le mode sans fin n'en donne pas de nouveaux (choix de la session).

**Idées pour étoffer la 2.5** (demandées par le propriétaire le 24 octobre, « brainstorme moi tout ça » ; **aucune n'est faite ni décidée**). Ce sont des propositions de la session, pas une liste exhaustive de ce qui est possible ; les durées sont des estimations, pas des mesures. Contrainte commune : rien de ce qui est déjà la 3.0 (règle 1 ; voir la fin de la liste), et ce qui n'est pas propre à la 2.x devra être reporté dans la 3.0 (§ 5).

*Faisables avant la sortie (lundi 0 h), sans risque pour le reste :*
1. **Un cadeau de sortie** (par exemple 3 boosters et 500 Fragments) par Labo › Joueurs › « Offrir un cadeau », qui existe déjà : chacun ouvre un paquet à sa visite suivante. Aucun code ; un geste du propriétaire sur le vrai site, après la publication. Pour : marque la mise à jour, et les Fragments servent tout de suite aux Reverses qui ouvrent. Limite : une décision d'économie (3 boosters, c'est une demi-journée de réserve). Rien à reporter.
2. **Une recharge accélérée pendant l'événement** (« un booster toutes les 3 h » pendant les sept jours de défis, ou le seul week-end) : la ligne d'événement a déjà sa colonne `ticket_minutes`, que `minutes_recharge()` suit. Une ligne de SQL, plus une heure pour vérifier que le bandeau de l'événement le dit. Pour : plus de boosters, donc plus de doublons pour les Fragments et les Reverses. Limite : à 3 h au lieu de 4 h, c'est +33 % de boosters pendant sept jours (environ 14 de plus pour un joueur régulier) : la dose est à décider. Rien à reporter.
3. **Une scène de fin de combat plus spectaculaire** : les étoiles qui tombent une à une, chacune avec son son, un jaillissement de braises à trois étoiles, le tampon « Parfait ». Deux à quatre heures. Pour : c'est le « stylé » demandé, vu à chaque combat. Limite : la scène doit rester courte (on rejoue) et tenir à 375 × 667. Rien à reporter (propre à L'Échauffement).
4. **Des succès de la 2.5** : gagner un défi, un défi à trois étoiles, les 21 étoiles, dix coups d'éclat qui frappent, dix défis du jour, une Reverse fabriquée. Calculés à la volée comme les autres (`succes_de()`), noms dans `SUCCES`. Deux à trois heures avec les tests. Pour : ils restent au profil après l'événement. Limite : **à reporter dans la 3.0** (sinon ils disparaissent des profils à sa sortie).

*Pendant l'événement (une 2.5.1, dans la semaine) :*
5. **Partager un combat en image**, comme un booster (`js/partage.js`) : l'équipe, l'adversaire, les étoiles, les tours, le pseudo. Trois à cinq heures. Pour : chacun montre ses trois étoiles sur le Discord. Limite : l'image dévoile une équipe gagnante (c'est aussi s'entraider). Rien à reporter.
6. **La liste de souhaits** : marquer les cartes qu'on cherche ; « Chez tes amis », la fiche d'un ami et la composition d'un échange les mettent en avant. Cinq à huit heures (une table, deux fonctions, Collection, Social, la démo). Pour : sert les échanges, le cœur du jeu entre amis, et dure après l'événement. Limite : sans lien avec l'événement ; **à reporter dans la 3.0**.
7. **La contre-proposition d'échange** : répondre à une demande par une autre carte au lieu de la refuser. Quatre à six heures. Pour : moins d'échanges qui meurent. Limite : **à reporter dans la 3.0**.
8. **Les week-ends du mode sans fin** : le samedi et le dimanche, un adversaire Redoutable qui paie double. Une à deux heures. Pour : garde le mode sans fin vivant. Limite : une variation à valider (ce n'est pas une difficulté qui monte, mais c'est un rythme). Rien à reporter.
9. **Le bilan de la communauté** : chaque jour, pour le défi de la veille (jamais celui du jour), l'équipe la plus jouée et le taux de victoire. Trois à quatre heures. Pour : de la vie entre joueurs. Rien à reporter.
10. **Les valeurs de combat dans la visionneuse** d'un Joueur (Défense, attaques, coût en élan) et ses meilleurs résultats en défi. Deux à trois heures. Pour : aide à composer une équipe. Rien à reporter (propre à L'Échauffement).

*Écartées par la session, à dire au propriétaire :*
- **Tout ce qui est déjà la 3.0** (règle 1, et les indices l'annoncent) : decks, deux Sections, maîtrise, Versus entre amis, Raid, cartes Secrètes, la DA « Graphite et lavande » partout, tapis et sleeves.
- **Une offre du jour en boutique** : faisable, mais elle déplace l'économie des Éclats (calculée dans `04_seed.sql`) ; à simuler d'abord.
- **Un second mini-jeu quotidien** (un quiz sur les cartes) : un rendez-vous de plus à côté de Devine l'illu et du défi du jour, qui tourne à la corvée.

*L'avis de la session (une opinion, pas un fait) :* pour lundi, 1, 2 et 3 ; dans la semaine, 5 ; 6 si le propriétaire veut une nouveauté qui dure au-delà de l'événement.

**Prévu par le propriétaire, pas encore fait :**
- Dès que la date de sortie de la 3.0 est connue : le **teasing final**, puis une **maintenance**, puis la mise à jour 3.0. Rien n'est préparé côté 2.x pour la maintenance (pas d'écran de maintenance aujourd'hui ; l'écran d'attente de la bêta, `js/gate.js`, en est le plus proche). Le mode sans fin s'arrête avec la 3.0 (son `29_labo.sql` en retire les fonctions).

## 4. La 3.0

**Où elle en est** : branche `version-3.0`, démo publiée sur `main` dans `preprod/` (matetcg.com/preprod/), version 3.0.10 (24 octobre : les reports de la 2.5, et son propre Labo refait — le Choc d'un état à l'autre, le Raid à une phase, son compte, sa sauvegarde, le master set à la limite de deck pour tester les combats). Le même jour, au soir : les titres et cadres de L'Échauffement de la 2.5, la fermeture de son mode sans fin, et ses deux remises à zéro réparées (elles s'arrêtaient sur `labo_sauvegardes`) ; la `preprod/` publiée n'a pas été refaite pour si peu (rien n'y change à l'écran). Son README dit tout ce qui est fait.

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
| Reverses : recyclage et fabrication datés (`parametres.reverses_des`, `reverses_ouvertes()`), prix 400 / 500 / 2 400 (`prix_reverse()`), `me()` › `parametres.reverses`, la page | 22-23 oct. | **reporté** (3.0.10, 24 oct.) : `supabase/installation/22c_reverses.sql`, même corps de fichier |
| Fin du récap réglable (`evenements.recap_jusqua`) | 22 oct. | **reporté** (3.0.10) |
| Marques de cache à empreinte (`tools/version.py`) | 23 oct. | **reporté** (3.0.10) |
| Les milliers en espace insécable (`fmtN`) | 22 oct. | **reporté** (3.0.10) |
| Sortie datée d'une version (`SORTIE`, `parametres.sorties`) | 23 oct. | à décider : la 3.0 sortira après une maintenance, pas forcément ainsi |
| L'Échauffement (`ech_*`), l'indice 127 | 22-23 oct. | propre à la 2.x : la 3.0 a ses propres combats. Sa base doit seulement ne pas casser les tables `ech_*` à la sortie (README de la 3.0, « Pièges ») |
| Labo de la 2.5 | 23 oct. | la 3.0 a son propre Labo, refait sur le même modèle (3.0.10, `29_labo.sql`) : il remplace celui de la 2.5 sur la base le jour de la sortie |
| La ligne des Fragments, la même dans Classiques et Reverses | 24 oct. | **reporté** (24 oct.) |
| L'Échauffement devenu événement (`22e` : ligne d'événement, Braises, Pass, 13 quêtes, boutique) | 24 oct. | propre à la 2.x ; la 3.0 doit seulement le supporter : **testé** (24 oct.) — la 3.0 rejouée deux fois sur une base où deux joueurs l'ont joué retire ses quêtes et sa boutique sans casser les inventaires |
| Ses titres et cadres (`t_echauffe`, `t_ech_round`, `t_ech_feu`, `t_ech_entraineur`, `t_ech_infatigable`, `f_braise`, `f_ardeur`) | 22-24 oct. | **reporté** (24 oct.) : `TITRES`, `FRAMES`, `CADRE_SOURCE`, les deux SVG, `css/reflets.css`, `tools/cadres.py` ; ceux qui les ont les gardent (inventaire) |
| Le mode sans fin (`22f`), « en attendant la 3.0 » | 24 oct. | **fermé par la 3.0** (24 oct.) : `29_labo.sql` retire ses neuf fonctions et le déclencheur de `22e` ; ses tables restent et se vident aux remises à zéro |
| Une quête d'événement ne compte que pendant son événement (`bump_quests`) | 24 oct. | rien à reporter : la 3.0 l'avait déjà (`01_schema.sql`) |
| Monnaie d'événement générique (`MONNAIES_EV`, `evIco`), classement (`evenement_etat` › `rang`, `joueurs`) | 24 oct. | rien à reporter : la 2.5 les a repris de la 3.0 |
| Les remises à zéro de la 3.0 ne connaissaient pas `labo_sauvegardes` | (3.0.10) | **corrigé dans la 3.0** (24 oct.) : gardée par `reset-profil.sql`, effacée par `reset-tout.sql` |
| Si la 3.0 sort pendant le récap de L'Échauffement (4-7 novembre) | — | **à reprendre ce jour-là** : son `evenement_recap` n'a pas le bloc propre à la 2.5 (étoiles, défis) |

## 6. Dimanche 25 octobre : publier la 2.5

À faire avant **23 h, heure de Paris** (22 h UTC), pour laisser une heure de marge. **L'ordre compte : le site d'abord, la base ensuite.** La base mise à jour crée la ligne d'événement `echauffement`, que le site publié le 23 octobre ne connaît pas : il rouvrirait une fois à chaque joueur la fenêtre des nouveautés de la 2.1, puis, à la sortie, appellerait les Braises « Prismes », compterait les quêtes de l'événement dans la pastille de Quêtes sans les montrer, et n'aurait ni Pass ni boutique de l'événement. La dernière `version-2.5` est faite pour marcher avec et sans la mise à jour (sans : ni événement ni mode sans fin, Labo « fonction absente ») ; c'est vérifié avec (prébuild), et seulement à la lecture du code sans.

1. **L'accord du propriétaire pour publier sur la racine de `main`** la 2.5 du 24 octobre (règle 1) ; s'il retient des idées du § 3, elles d'abord, sur `version-2.5`, essayées dans le prébuild (`python3 tools/demo.py --prebuild`, puis reporter `prebuild/` sur `main`).
2. **Le site** : `python3 tools/version.py 2.5` (en dernier, après toute autre modification des CSS et des JS), commit, `version-2.5` fusionnée dans `main`, poussée. Contrôle : le site dit toujours « version 2.1.3 », le récap de Reflets est là.
3. **La base** (accord donné le 24 octobre) :
   - comparer d'abord la vraie base au modèle (`tools/maj-2.5/agregat.sql`, en lecture seule) : `C|210|281c441b…`, `F|87|eb557b19…`, `T|33|669f1168…` (rien n'est passé) ; ou `C|214|f2c0e67e…`, `F|105|bb6ab1e2…`, `T|34|feaad1e2…` (l'envoi tenté le 24 au soir est passé après coup : les envois ci-dessous conviennent aussi) ; tout autre résultat : s'arrêter et chercher ;
   - les trois envois, par l'outil Supabase, chacun avec la confirmation du propriétaire (ils contiennent `delete from` et `drop`) : `_build/maj-2.5/envoi-1.sql`, `-2`, `-3`, refaits au besoin par `bash tools/maj-2.5/banc.sh` puis `python3 tools/maj-2.5/envois.py` ; chacun s'annule entier au moindre écart d'empreinte ;
   - à défaut de l'outil : coller `supabase/MAJ-2.5.sql` d'un bloc dans le SQL Editor (rejouable) ;
   - contrôle final : `C|236|8236f2bf…`, `F|118|e44e662b…`, `T|37|7ace681b…` (une installation neuve de la branche).
4. **Contrôle** : `verif.html` tout vert (y compris L'Échauffement et le mode sans fin) ; le site dit « version 2.1.3 » ; aucune fenêtre ne se rouvre.
5. **Après minuit** : le site dit « version 2.5 », la fenêtre des nouveautés s'ouvre, le défi 1 se joue et paie ses Braises, le Pass, les quêtes et la boutique de l'événement répondent, une Reverse se fabrique.
6. **Mercredi 4 novembre, 0 h** : la saison se termine, le récap (bandeau, fenêtre, sous-onglet) et le défi du jour apparaissent. **Samedi 7, 0 h** : fin du récap.

**Si l'étape 3 n'est pas faite**, le site sort quand même à l'heure (la date est aussi dans le code), avec L'Échauffement de la 2.1.4 (sept défis, sans Braises, Pass, quêtes, boutique ni mode sans fin) ; les outils du Labo qui touchent au serveur répondent « fonction absente ». **Si l'étape 2 n'est pas faite**, la 2.5 du 23 octobre sort seule à minuit, et l'étape 3 doit attendre que le site soit publié (voir plus haut pourquoi).

## 7. Décisions récentes, et pourquoi

- **22 oct.** La vraie base était restée au SQL de la 2.1.0 : la mise à jour rattrape la 2.1.1. Règle ajoutée : comparer la base avant toute mise à jour.
- **22 oct.** Prix des Reverses fabriquées : 400 / 500 / 2 400 et non le double d'une classique (simulation, `tools/equilibre-reverses.py`).
- **23 oct.** La 2.1.4 devient la **2.5**, une mise à jour à part entière (fenêtre, numéro), qui sort à la fin du récap de Reflets.
- **23 oct.** Les Reverses ouvrent avec la 2.5, et non à la fin de Reflets.
- **23 oct.** L'indice 3 dit **127** (122 + 5 Secrètes).
- **23 oct.** Branches : `version-2.5` remplace `claude/interface-ux-fixes-o92u4a` et `teaser-2.x` (toutes deux contenues dans `version-2.5` et `main`). Leur suppression est à faire par le propriétaire : le proxy GitHub des sessions Claude Code refuse de supprimer une branche.
- **23 oct.** Le Labo est refait : ce qui touche le serveur est réel et se confirme, ce qui touche son compte se sauvegarde et se restaure, les aperçus restent locaux. L'onglet « Affichage » (des changements « affichage seulement ») disparaît.
- **24 oct.** La 3.0 reçoit les reports de la 2.5 et son Labo refait (3.0.10). La session de travail tournait dans un conteneur remplacé sans prévenir : le travail de la 3.0, testé mais pas encore commité, a été perdu puis refait. Règle ajoutée aux deux `CLAUDE.md` : commiter et pousser au fur et à mesure.
- **24 oct.** « La 2.5 ne fait pas assez update » (le propriétaire) : L'Échauffement devient un événement sur la charpente de Reflets, sans toucher aux règles du combat ; les montants (Braises, Pass, boutique) sont calculés en tête de `22e_echauffement-evenement.sql`.
- **24 oct.** Le mode sans fin commence le 4 novembre, après le rattrapage ; son récap passe par Boosters, lui par Combats (le propriétaire) ; 21 adversaires de niveaux mêlés, pas de difficulté qui monte, le niveau de récompense de Devine l'illu.
- **24 oct.** Le sous-onglet « Récompenses » cède la place au Pass ; la ligne des Fragments est la même dans Classiques et Reverses (le propriétaire).
- **24 oct.** Règle 8 de `CLAUDE.md` élargie : toutes les vues de l'événement tiennent dans l'écran (les six sous-onglets pendant la saison, puis le défi du jour, son classement, les indices et le récap).
- **24 oct.** La mise à jour de la vraie base attend : l'accord est donné, mais l'outil Supabase demande au propriétaire une confirmation pour chaque envoi qui efface ou retire (`delete from`, `drop`), et celle du 24 au soir n'est pas venue dans la minute. Elle est prête en trois envois contrôlés (`tools/maj-2.5/`), à faire **après** la publication du site (§ 6).
- **24 oct.** La 3.0 fermera le mode sans fin à sa sortie (« du temps qu'on pourra pas publier la 3.0 ») : sinon ses appels continueraient de verser des Éclats.
