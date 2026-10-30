# Économie de la version 3.0 — ce qui change, et pourquoi

Ce document accompagne le « grand équilibrage des récompenses » demandé pour la 3.0.
Chaque chiffre est classé :

- **[fait]** : une valeur du jeu, lisible dans le code (fichier cité) ;
- **[calcul]** : une conséquence arithmétique des valeurs du jeu ;
- **[hypothèse]** : une estimation qui dépend du comportement des joueurs, que personne n'a encore mesuré.

Une limite s'applique à tout le document : **aucune donnée réelle de jeu n'existe sur les combats**. Le site ne les a jamais ouverts. Les profils de joueurs ci-dessous sont donc des modèles et non des mesures. Après l'ouverture, il faudra les comparer à `quest_progress`, `combat_joueurs` (victoires, défaites, XP), `combats_ouverts` (les combats lancés du jour), `evt_comptes` et `maitrises_journal`.

## 1. Le point de départ (avant la 3.0)

| Source | Valeur | Statut |
|---|---|---|
| Boosters gratuits | 1 toutes les 4 h, réserve de 5 → 6 par jour au plus | [fait] `cfg('ticket_minutes')`, `supabase/01_schema.sql` |
| Booster en boutique | 350 Éclats (300 par lot de 10) | [fait] `supabase/04_seed.sql` |
| Quêtes du jour (Éclats) | 320 au plus | [calcul] 30 + 50 + 80 + 30 + 30 + 60 + 40 |
| Quêtes de la semaine (Éclats) | 2 000 au plus, ≈ 286 par jour | [calcul] |
| **Total maximal par jour** | **≈ 606 Éclats ≈ 1,7 booster** | [calcul] |
| Joueur actif « typique » | ≈ 415 Éclats par jour | [hypothèse] Il rate une partie des quêtes qui dépendent de la chance (Épique, Légendaire) ou d'un autre joueur (échanges). |

## 2. Ce que les combats ajoutent

### Valeurs retenues

| Source | Pré-build initial | **3.0 (retenu)** | Fichier |
|---|---|---|---|
| Victoire PvE, par difficulté | 15 / 25 / 40 / 55 / 75 | **10 / 15 / 25 / 35 / 50** | `js/combat/campagne.js` (`DIFFICULTES`) |
| Victoires PvE récompensées par jour | 5 | 5 | `PVE_PLAFOND` |
| Défi gagné / perdu (3 par jour) | 50 / 15 | **40 / 15** | `js/battle.js` (`DEFI_GAIN`) |
| Quêtes du jour combat | 30 + 50 + 40 = 120 | **20 + 40 + 30 = 90** | `d_combat`, `d_victoire`, `d_vaincus` |
| Quêtes de la semaine combat | 300 + 350 + 200 = 850 | **250 + 300 + 150 = 700** | `w_victoires`, `w_dur`, `w_defi` |
| Quêtes d'XP, ajoutées avec les niveaux | — | **30 par jour, 200 par semaine** | `d_xp` (150 XP), `w_xp` (1 500 XP) |
| Campagne, première fois (une seule fois) | 3 400 Éclats, 14 boosters, 2 800 Fragments, une Promo, un titre | inchangé | `RECOMPENSES_CAMPAGNE` |

### Ce que ça donne par jour [calcul]

| Profil | Avant rééquilibrage | Après | Hausse par rapport à la 2.x (≈ 415/jour) |
|---|---|---|---|
| Combattant régulier : quêtes combat, 5 victoires en Normal, 1 défi gagné | ≈ 491 | **≈ 355** | **+ 85 %** |
| Combattant acharné : tout au maximum, Légende, 3 défis gagnés | ≈ 766 | **≈ 560** | + 135 % |
| Collectionneur qui ne combat pas | 0 | 0 | inchangé |

[calcul] Ces profils datent d'avant les quêtes d'XP : `d_xp` et `w_xp` ajoutent environ **59 Éclats par jour** (30 + 200 / 7) à qui les remplit ; le combattant régulier passe alors à ≈ 414, l'acharné à ≈ 619.

### Pourquoi ces valeurs

- **[fait]** Un booster vaut 350 Éclats. Au pré-build initial, un combattant régulier gagnait ≈ 1,4 booster de plus par jour. Avec 6 boosters gratuits, cela faisait + 23 % de cartes entrantes.
- **[hypothèse]** Les combats deviennent l'activité principale de la 3.0. Ils doivent donc rapporter assez pour qu'on y revienne. Mais doubler le revenu d'un joueur actif accélère la complétion de la collection, et vide le jeu de son objectif de long terme. Les valeurs retenues se placent entre les deux : environ + 1 booster par jour pour un combattant régulier.
- **[fait]** De nouveaux postes de dépense absorbent une partie de ce surplus : 6 tapis (25 000 Éclats en tout) et 2 sleeves (5 500).
- **Ce que ça ne résout pas** : le rythme réel de jeu reste inconnu. Si les joueurs ne combattent qu'une fois par semaine, ces gains sont trop faibles pour motiver. S'ils enchaînent, le plafond de 5 victoires par jour tient (il est appliqué côté serveur), mais les quêtes de la semaine restent atteignables par tous.

### Ce qui ne bouge pas

- Les quêtes et récompenses de collection d'avant la 3.0. Les baisser retirerait quelque chose aux joueurs existants.
- Le taux de la Légendaire passe de 4 % à **4,25 %** et celui de la Secrète arrive à **0,75 %**. C'est la Rare qui cède (80 % → 79 %), à la demande explicite. [fait] `RATES.HIT`, `js/booster.js`

## 2 bis. L'XP et le niveau de combattant (sans plafond)

Demande explicite : un système de niveaux **sans limite par jour** — « tu gagnes autant que tu joues ». Les Éclats des combats restent plafonnés (5 victoires payées par jour) ; l'XP, non. Fichiers : `js/combat/niveaux.js`, `supabase/26_niveaux.sql`.

### Valeurs retenues [fait]

| Élément | Valeur |
|---|---|
| Victoire contre l'IA | 50 XP × difficulté (×0,6 / 0,8 / 1 / 1,25 / 1,5) |
| Défaite contre l'IA | 20 XP × difficulté, **seulement si la partie a duré 6 tours** |
| Joueur adverse vaincu | +4 XP, 6 au plus |
| Défi entre amis | 80 (victoire) / 35 (défaite, 6 tours) |
| Combat de moins de 20 s | 0 |
| XP pour passer du niveau n au suivant | 100 + 25 × (n − 1), plafonné à 1 100 |
| Chaque niveau atteint | 50 Éclats |
| Paliers | niv. 3 : 1 booster · 5 : 2 boosters + titre · 10 : 2 boosters + cadre · 15 : 3 boosters · 20 : cadre + titre · 25 : 500 Fragments · 30 : 3 boosters + cadre · 40 : 5 boosters + titre · 50 : cadre + titre · puis 2 boosters tous les 5 niveaux |

La règle des 6 tours pour une défaite est un garde-fou : sans elle, lancer un combat et abandonner après 20 secondes rapportait 20 XP par 20 s, soit plus vite que jouer.

### Combien de temps pour chaque niveau [calcul]

XP cumulée : niveau 5 = 550 · niveau 10 = 1 800 · niveau 20 = 6 175 · niveau 30 = 13 050 · niveau 40 = 22 425 · niveau 50 = 33 400.

| Profil (hypothèse) | XP par jour | Niveau 10 | Niveau 20 | Niveau 30 | Niveau 50 |
|---|---|---|---|---|---|
| Régulier : 5 victoires en Normal, 2 défaites, 1 défi gagné | ≈ 420 | 5 jours | 15 jours | 31 jours | 80 jours |
| Acharné : ~25 combats en Difficile (≈ 60 % de victoires) | ≈ 1 450 | 2 jours | 5 jours | 9 jours | 23 jours |

### Ce que ça ajoute à l'économie [calcul]

- Régulier, sur ses 15 premiers jours (jusqu'au niveau 20) : 19 × 50 = 950 Éclats et 8 boosters (≈ 2 800 Éclats de valeur), soit **≈ + 250 Éclats-équivalent par jour**, puis de moins en moins : au-delà du niveau 30, un niveau prend ≈ 2,5 jours (≈ 20 Éclats par jour, plus 2 boosters tous les cinq niveaux après le 50).
- Acharné : les mêmes paliers en 5 jours, puis ≈ 1,3 niveau par jour (≈ 65 Éclats par jour, et les boosters des paliers).
- **C'est voulu, et c'est un choix** : sans plafond, celui qui joue le plus gagne le plus. La pente de la courbe (plafond à 1 100 XP par niveau) et le fait que les paliers s'espacent limitent l'écart, sans le supprimer.
- **Ce qu'on ne sait pas** : la durée réelle d'une partie. [fait] Une partie IA contre IA dure en moyenne 12 tours au total, soit 6 par joueur (`node tools/combat-sim.js ia 60`, niveau 3). [hypothèse] Avec un humain, qui lit et choisit, cela donnerait 3 à 5 minutes ; ce n'est mesuré sur personne. On ne sait pas non plus quelle part des joueurs enchaînera les combats. Si les parties sont plus courtes, tout va plus vite d'autant. Les « 6 tours » de la règle des défaites sont des tours de la partie (les deux joueurs comptés), donc environ la moitié d'une partie moyenne.

## 3. L'événement « Le Choc des Sections » (21 jours) et le Raid

### Le Raid, par saisons et phases [fait] `RAID`, `js/combat/choc-data.js` ; `supabase/27_raid.sql`

Version 3.0.6 : pensé pour un serveur d'une dizaine de joueurs, à la manière des boss de guilde d'*AFK Journey*.

- Un boss commun, The French Sorcerer, par **saisons de 14 jours** (la première a commencé le 12 octobre 2026). Les dégâts de tous s'additionnent sur la saison.
- **Six phases**, chacune à un seuil de dégâts cumulés : 120, 300, 550, 850, 1 200, 1 600 (multipliés sur le vrai serveur par `parametres.raid_echelle`, 1 par défaut). Chaque phase est un combat plus dur :

| Phase | Seuil | IA | PV du boss | Essences d'avance | Coffre commun |
|---|---|---|---|---|---|
| 1 | 120 | 2 ★ | 5 | 0 | 2 boosters |
| 2 | 300 | 3 ★ | 6 | 0 | 300 Fragments |
| 3 | 550 | 3 ★ | 7 | 1 | 3 boosters |
| 4 | 850 | 4 ★ | 7 | 1 | 500 Éclats |
| 5 | 1 200 | 4 ★ | 8 | 2 | 4 boosters |
| 6 | 1 600 | 5 ★ | 9 | 2 | 5 boosters |

- **[fait] Ce que le joueur affronte vraiment (3.0.11, puis 3.0.12)** : chaque boss a un réglage (`RAID.bosses` › `ajuste`). Depuis les règles officielles (le joueur a 4 PV au lieu de 5), **les deux boss ont un PV et une Essence d'avance de moins que la phase** (phase 1 : 4 PV, 0 Essence ; phase 6 : 8 PV, 1 Essence). **[mesuré]** Un Starter, IA niveau 3, 80 combats par case : le joueur gagne contre le Sorcier 65 %, 51 %, 30 %, 40 %, 15 % et 4 % des phases 1 à 6, contre le Marionnettiste 66 %, 33 %, 26 %, 25 %, 8 % et 3 % (marge ± 10 points). Le serveur garde les chiffres du tableau pour compter les dégâts : une victoire vaut toujours « PV de la phase + 1 + 3 ».
- Une phase tombée ouvre un **coffre commun** pour **chaque joueur qui a combattu au moins une fois dans la saison**, même s'il n'a pas porté le dernier coup. Il se réclame pendant la saison et la suivante.
- Trois **paliers personnels** par saison, sur ses propres dégâts : 30 (1 booster), 80 (300 Fragments), 150 (2 boosters).
- Les six phases tombées, le **mode Infini** : chaque victoire fait monter son propre palier (boss jusqu'à 12 PV et 3 Essences d'avance, puis c'est le joueur qui a moins de PV). Il ne débloque plus rien pour tous : c'est la performance de chacun, avec son classement.
- Ce que paie un combat (inchangé) : pendant le Choc, 3 Étincelles par dégât et 15 si le boss tombe ; le reste du temps, 2 Éclats par dégât et 15. Une victoire compte « PV du boss + 1 » dégâts, plus 3 de bonus (9 en phase 1, 13 en phase 6) ; une défaite, les PV pris. Les dégâts d'un combat sont plafonnés côté serveur.

| [calcul] Par jour, au plus (3 victoires) | Phase 1 (boss à 5 PV) | Phase 6 (boss à 9 PV) |
|---|---|---|
| Dégâts par victoire | 5 + 1 + 3 = 9 | 9 + 1 + 3 = 13 |
| Hors événement, en Éclats | 3 × (9 × 2 + 15) = 99 | 3 × (13 × 2 + 15) = 123 |
| Pendant le Choc, en Étincelles | 3 × (9 × 3 + 15) = 126 | 3 × (13 × 3 + 15) = 162 |

**[calcul, sur des hypothèses d'activité]** Combien de phases tombent dans une saison, à `raid_echelle = 1` :

| [hypothèse] Activité | Dégâts par jour | Sur 14 jours | Phases abattues | Jour où tombe la 6ᵉ |
|---|---|---|---|---|
| 10 joueurs, 3 tentatives, 7 dégâts en moyenne | 210 | 2 940 | 6 | ≈ 8ᵉ jour |
| 6 joueurs, 2 tentatives, 6 dégâts | 72 | 1 008 | 4 | jamais (22 jours) |
| 4 joueurs, 1,5 tentative, 5 dégâts | 30 | 420 | 2 | jamais |

- **[inconnu]** L'activité réelle : c'est elle qui décide si l'Infini arrive (« si ça arrive, ce n'est même pas sûr »). Le réglage se fait sans redéployer, par `raid_echelle` : à 1, un serveur très engagé finit en une semaine, un serveur moyen s'arrête vers la phase 4.
- **[calcul]** Tout ce qu'une saison complète donne à chaque participant, en coffres communs : 14 boosters, 300 Fragments, 500 Éclats ; plus 3 boosters et 300 Fragments de paliers personnels.

### Ce que rapportent les Étincelles [calcul]

| Source | Par jour, au plus |
|---|---|
| Quêtes du jour | 75 |
| Raid : 3 tentatives (voir plus haut) | 135 à 162 |
| Épreuve : 5 par essai, + 25 à la première victoire | 40 |
| Quêtes de l'événement (une fois) | 670 au total |

| Profil [hypothèse] | Étincelles sur 21 jours | Pass (30 paliers, 3 500 pour le dernier) |
|---|---|---|
| Tout au maximum | ≈ 6 500 | fini vers le 11ᵉ jour |
| Engagé (toutes les quêtes du jour, 3 Raids, 3 Épreuves) | ≈ 4 000 | fini vers le 18ᵉ jour |
| Occasionnel (1 Raid, 1 Épreuve, la moitié des quêtes) | ≈ 2 000 | palier 19 ou 20 |

### Le Pass [fait] `PISTE_CHOC`, `_demo/serveur.js` ; `evt_piste`, `supabase/25_choc.sql`

- Il rapporte en tout : 23 boosters, 2 200 Éclats, 3 750 Fragments, 5 Reverses Rares, **une** Essence Brillante (palier 15), le sleeve « Le Choc » (palier 8), le cadre « Choc » (palier 12), trois titres, et au bout, au palier 30, le tapis « Le Choc des Sections ».
- Retirés à la demande : la Légendaire du palier 30 (« trop op ») et la seconde Essence Brillante (palier 25). Le palier 30 est désormais le tapis (il était au palier 20) ; le 20 donne une Reverse Rare, le 25, 700 Fragments.
- C'est plus gros que le Pass Reflets (14 boosters, 1 350 Éclats, 1 250 Fragments), sans carte rare garantie au-delà d'une Essence Brillante.

### La boutique de l'événement [fait] `04_seed.sql`, `_demo/serveur.js`

| Article | Prix | Limite | Total |
|---|---|---|---|
| 2 boosters | 80 | 10 | 800 |
| 5 boosters | 180 | 3 | 540 |
| 500 Fragments | 70 | 8 | 560 |
| Tapis « The French Sorcerer » | 600 | 1 | 600 |
| Titre « Supporter du Choc » | 200 | 1 | 200 |
| Cadre « The French Sorcerer » (`f_foudre`) | 400 | 1 | 400 |

- Tout acheter coûte **3 100 Étincelles** [calcul] (2 700 avant l'arrivée du cadre `f_foudre`, 3 140 avant le premier rééquilibrage). Retirés à la demande : l'Essence Brillante et la Reverse Rare. Pour que les Étincelles gardent un usage, les boosters et les Fragments y sont un peu moins chers et plus nombreux, et un lot de 5 boosters s'ajoute.
- [hypothèse] Un joueur engagé (≈ 4 000 Étincelles) peut tout acheter ; un occasionnel (≈ 2 000) prend le tapis, le titre et une partie des boosters.
- Le Pass compte les Étincelles **gagnées**, la boutique dépense le **solde** : acheter ne fait pas reculer dans le Pass.

### Ce que le serveur croit sur parole [fait]

- Le serveur ne rejoue pas les combats contre l'IA : il croit le client sur le résultat, pour le PvE comme pour le Raid. Trois garde-fous : les dégâts d'un combat sont plafonnés (PV du boss + 1, + 3 s'il tombe), un combat doit durer au moins 20 s, et on a 3 tentatives par jour. Un tricheur peut donc gagner au plus 54 Étincelles (ou 41 Éclats) et 13 dégâts par tentative.
- Pour les défis entre amis, le serveur de démo rejoue la partie, puisqu'il dispose du moteur en JavaScript. Le vrai serveur ne le peut pas : Postgres n'exécute pas ce moteur. Chaque joueur y déclare donc son résultat, et un désaccord entre les deux déclarations est enregistré (`defis.desaccord`) pour que l'administration puisse le voir.

## 3 bis. Un bon deck, et la force de l'IA (version 3.0.6) [mesuré]

Mesures faites en faisant jouer l'IA contre elle-même (`tools/combat-sim.js`), places échangées à chaque paire de decks pour que l'ordre de jeu ne décide pas. Marge (intervalle à 95 %) : environ ±6 points pour 300 parties, ±9 pour 120.

**Le deck** (IA Difficile des deux côtés, 300 parties par point, contre des decks de référence tirés au sort) :

| Ce qui change | Taux de victoire |
|---|---|
| Joueurs : 8 / 10 / 12 / 14 / 16 / 18 / 22 / 26 | 29 % / 40 % / 44 % / 51 % / 51 % / 56 % / 58 % / 56 % |
| Réserve accordée aux attaques / d'une autre couleur | 43 % / 35 % |
| Joueurs qui attaquent tous pour 2 Essences ou moins | 59 % |
| Joueurs qui attaquent tous pour 3 Essences ou plus | 17 % (biaisé : il n'y en a pas assez, ces decks n'ont que 12,7 Joueurs en moyenne) |
| Couleurs : 1 / 2 / 3 | 51 % / 50 % / 50 % |

D'où les trois repères du bilan (`Decks.bilan`) : 16 Joueurs au moins, une Réserve accordée, au moins la moitié des Joueurs qui attaquent pour 2 Essences ou moins (ce seuil de la moitié est un choix, la mesure ne porte que sur les extrêmes). Le nombre de couleurs n'a pas d'effet mesurable : il n'est pas un repère. **Limite** : c'est l'IA qui joue ces decks, pas un humain ; un humain qui joue mieux les Moments pourrait profiter d'autres compositions.

**L'IA** (mêmes decks, places échangées) :

| Duel | Victoires du premier | Parties |
|---|---|---|
| Nouveau Débutant contre ancien Débutant (qui jouait un coup sur deux au hasard) | 84 % | 200 |
| Nouveau Facile contre ancien Facile | 88 % | 200 |
| Nouveau Normal contre ancien Normal | 63 % | 120 |
| Nouveau Difficile contre ancien Difficile | 47 % | 120 |
| Débutant contre Facile (réglage final) | 14 % | 200 |
| Facile contre Normal (réglage final) | 46 % | 120 |
| Normal contre Difficile (réglage final) | 44 % | 120 |
| Difficile contre Légende (réglage final) | 32 % | 60 |
| Difficile à 4 essais contre Difficile à 2 | 58 % | 120 |
| Difficile sans méfiance contre Difficile | 47 % | 120 |

**[mesuré]** Les niveaux bas sont bien plus solides qu'avant, et l'échelle monte à chaque marche (le niveau au-dessus gagne 86 %, 54 %, 56 % et 68 % des parties). **[mesuré]** Les marches Facile → Normal et Normal → Difficile restent courtes, dans la marge d'erreur : à deck égal, ces trois niveaux jouent presque aussi bien ; la difficulté de l'Arcade et de la campagne vient aussi du deck adverse, dont les raretés montent avec le niveau. Le seul levier qui a montré un gain est le nombre d'essais par coup (porté à 3 et 4 pour les niveaux 4 et 5) ; la méfiance envers la riposte n'en a montré aucun. **[inconnu]** La force perçue par un humain : à mesurer avec les taux de victoire réels après l'ouverture.

### Avec les règles officielles (3.0.12) [mesuré]

Les mesures ci-dessus datent des règles reconstituées (Club de 30, 5 PV, un Joueur par tour). Refaites avec les règles officielles (`tools/combat-sim.js`, IA contre IA) :

| Ce qui est mesuré | Résultat | Parties |
|---|---|---|
| Parties au hasard sans plantage, durée, fins | 13,1 tours ; 1 482 fins aux PV, 18 au Club vide | 1 500 |
| Copies de l'IA fidèles (`clone`) | oui | 150 |
| IA Normal contre Normal : le premier CEO gagne | 57 % (aucune compensation pour le second dans les règles officielles) ; 10,4 tours | 400 |
| Starter Toxique contre des decks tirés au sort (niveau 3) | 64 % | 240 |
| Starter Déter contre des decks tirés au sort | 58 % (50 % avant d'y mettre trois Fée Rosalie) | 240 |
| Toxique contre Déter, face à face | Toxique 61 % | 240 |

**[mesuré]** Le Toxique (engager les Joueurs adverses, qui ne peuvent alors plus défendre) profite plus des règles officielles que le Déter : onze variantes du Déter ont été essayées, une seule sortait du bruit (± 3 points). **[inconnu]** Les vraies listes des Starter Decks : quand elles seront connues, elles remplaceront celles-ci, et ces chiffres seront à refaire. Le Raid, réglé de nouveau : [§ 3](#3-lévénement--le-choc-des-sections--21-jours-et-le-raid) et README § 7.9.

Le bilan d'un deck (`Decks.bilan`) suit désormais les conseils officiels : **15 Joueurs au moins** (16 avant, d'après la mesure de la 3.0.6), une Réserve accordée, la moitié des Joueurs qui attaquent pour 1 ou 2 Essences.

## 3 ter. La maîtrise des cartes (version 3.0.7, rééquilibrée en 3.0.8)

Le rôle : donner un usage durable aux Fragments une fois la collection complète, et récompenser les cartes qu'on joue. Les règles sont dans l'en-tête de `supabase/28_maitrise.sql` (le serveur décide), de `js/maitrise.js` (l'affichage) et de `_demo/serveur.js` (la pré-prod) ; les trois portent les mêmes montants.

### Pourquoi la 3.0.8 change les montants [calcul]

En 3.0.7, chaque niveau coûtait 300, 700, 1 500, 3 000 puis 6 000 Fragments **quelle que soit la rareté** (11 500 pour la Légende). Or, simulation (`python3 tools/equilibre-fragments.py` : 40 joueurs, 6 boosters par jour, doublons recyclés au-delà de 2, recyclage seul) :

| Moment | Fragments gagnés par semaine (médiane) |
|---|---|
| Fin du 1er mois | ≈ 1 550 |
| 2e et 3e mois | ≈ 1 800 à 1 900 |
| 4e mois | ≈ 2 000 |

Une Commune en Légende demandait donc six semaines de tout le recyclage, autant qu'une Légendaire : c'était à la fois trop cher pour les cartes communes et pas assez distinctif pour les rares. Les exemplaires demandés, eux, ignoraient la fréquence réelle des cartes (une Commune précise sort tous les 16 boosters ; une Épique, tous les 112 ; une Légendaire, tous les 235).

### Valeurs retenues [fait] `maitrise_fragments(rar, n)`, `maitrise_copies`, `supabase/28_maitrise.sql`

Un niveau coûte **la base de la rareté, fois 1, 2, 4, 7 puis 11** (25 fois la base pour aller jusqu'à la Légende), plus des exemplaires **en trop** :

| Rareté | Base | I · Satin | II · Liseré | III · Holo | IV · Lumière | V · Légende | Total | Exemplaires en trop (I à V) |
|---|---|---|---|---|---|---|---|---|
| Commune | 60 | 60 | 120 | 240 | 420 | 660 | **1 500** | 1 · 1 · 1 · 2 · 2 (7) |
| Peu commune | 100 | 100 | 200 | 400 | 700 | 1 100 | **2 500** | 1 · 1 · 1 · 1 · 2 (6) |
| Rare | 200 | 200 | 400 | 800 | 1 400 | 2 200 | **5 000** | 0 · 1 · 1 · 1 · 1 (4) |
| Épique | 400 | 400 | 800 | 1 600 | 2 800 | 4 400 | **10 000** | 0 · 0 · 1 · 0 · 1 (2) |
| Légendaire | 600 | 600 | 1 200 | 2 400 | 4 200 | 6 600 | **15 000** | 0 · 0 · 0 · 0 · 1 (1) |
| Secrète | 600 | 600 | 1 200 | 2 400 | 4 200 | 6 600 | **15 000** | aucun |

- Seuls les exemplaires **en trop** sont pris : au-delà de la limite de deck (2 ; 1 pour une Légendaire ou une Secrète, `limite_copies`), au-delà de ce que le joueur garde (`garde_de`), hors des échanges en attente. Un deck n'est donc jamais privé d'une carte par la maîtrise.
- Chaque exemplaire qui manque est remplacé par son **prix de fabrication** en Fragments (`cfg('fabrication_…')` : 40, 100, 400, 2 000, 8 000). La maîtrise n'est jamais bloquée par la chance.
- La Reverse partage la maîtrise de sa carte ; ni les Essences, ni les Promos (sauf les Secrètes), ni l'Unique.

### Ce que coûte une carte jusqu'à la Légende [calcul]

| Rareté | Avec tous les exemplaires en trop | Sans aucun (tout en Fragments) | Pour un joueur régulier (≈ 2 000 Fragments par semaine) | Face à la fabrication |
|---|---|---|---|---|
| Commune | 1 500 | 1 780 | moins d'une semaine | 37 fois son prix (40) |
| Peu commune | 2 500 | 3 100 | 9 à 11 jours | 25 fois (100) |
| Rare | 5 000 | 6 600 | 2 semaines et demie à 3 semaines | 12 fois (400) |
| Épique | 10 000 | 14 000 | 5 à 7 semaines | 5 fois (2 000) |
| Légendaire | 15 000 | 23 000 | 7 semaines et demie à 11 semaines | 2 à 3 fois (8 000) |
| Secrète | 15 000 | 15 000 | 7 semaines et demie | (ne se fabrique pas) |

- **[calcul]** Les premiers niveaux sont à portée de main (une Commune au niveau I : 60 Fragments et un doublon), la Légende d'une Légendaire est un trophée de deux à trois mois. Maîtriser une carte coûte toujours plus que la fabriquer, sans être hors d'atteinte.
- **[calcul]** Un exemplaire en trop vaut bien plus dans la maîtrise qu'au recyclage : une Commune rapporte 2 Fragments recyclée, mais en économise 40 dans une maîtrise ; une Légendaire, 250 contre 8 000. Une fois la collection complète, la maîtrise devient le meilleur usage des doublons.
- **[calcul]** S'y ajoutent les sources ponctuelles : 2 800 une fois (campagne), 3 750 pendant le Choc (Pass), 600 par saison de Raid pour qui la finit (coffres et palier), 500 au niveau 25.
- **[hypothèse]** Combien de cartes un joueur actif maîtrisera par mois : à mesurer après l'ouverture (`maitrises_journal` garde chaque niveau payé : Fragments et exemplaires).

### La carte fétiche [fait] `profiles.fetiche`, `set_fetiche`, `fetiche_de`

Gratuite : une carte possédée, mise en scène en haut du profil et sur la fiche publique (avec sa maîtrise). Échangée ou perdue, elle disparaît de la fiche (`fetiche_de` revérifie la possession).

## 4. Ce qui reste ouvert

1. Le rythme réel de jeu des combats : à mesurer après l'ouverture (voir l'introduction). Il fixe aussi la vitesse de montée en niveau (partie 2 bis).
2. La valeur de `raid_echelle` au lancement : elle dépend du nombre de joueurs, et décide de la fréquence des coffres du Raid.
3. Le prix des cosmétiques de combat (4 000 à 5 000 Éclats par tapis) est une proposition. Rien ne permet encore de dire s'il est trop haut ou trop bas.
4. Les montants de la maîtrise (partie 3 ter, rééquilibrés en 3.0.8 sur la simulation du recyclage) restent une proposition : à revoir avec `maitrises_journal` après l'ouverture.
5. Les règles du jeu elles-mêmes sont reconstituées (`docs/regles-3.0.md`). Si les vraies règles changent la durée d'une partie, le rythme des gains change avec elle.
