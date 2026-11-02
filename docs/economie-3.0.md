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

## 3. L'événement « Le Choc des Sections » (14 jours depuis la 3.0.13) et le Raid

**[fait] Version 3.0.13 : deux semaines au lieu de trois.** Le propriétaire, le 1er novembre 2026 : « serait-il pas mieux de mettre le choc à une durée de 2 semaines, et d'équilibrer les récompenses en conséquence ? comme ça quand l'event finit, on enchaine direct sur le marionnetiste. » Les raids durent déjà quatorze jours et se comptent depuis le premier jour du Choc (`raid_ancre`) : le raid 1 couvre désormais tout l'événement, et le raid 2 commence le lendemain de sa fin — sans rien changer au Raid. Ce qui change : 14 Épreuves (le calendrier des règles perd sa troisième semaine), le Pass (20 paliers), les objectifs des quêtes de l'événement qui dépendent du temps (aux deux tiers) et les limites de sa boutique. Les montants par jour (quêtes du jour, Raid, Épreuve) ne bougent pas. Les chiffres d'avant sont gardés plus bas, barrés de « jusqu'à la 3.0.12 ».

### Le Raid, par saisons et phases [fait] `RAID`, `js/combat/choc-data.js` ; `supabase/27_raid.sql`

Version 3.0.6 : pensé pour un serveur d'une dizaine de joueurs, à la manière des boss de guilde d'*AFK Journey*. **Version 3.0.14 : réglé de nouveau**, à la demande du propriétaire (1er novembre 2026) : « Équilibre bien le raid pour un serveur avec une dizaine de joueurs actifs, et rends la tâche pas trop facile, finir la dernière phase doit être ressenti comme un vrai exploit. Ajuste les récompenses en conséquence. »

- Un boss commun par **saisons de 14 jours**, comptées depuis le premier jour du Choc (`raid_ancre`) : The French Sorcerer, puis Le Marionnettiste, à tour de rôle. Les dégâts de tous s'additionnent sur la saison.
- **Six phases**, chacune à un seuil de dégâts cumulés, multiplié par la **vie du boss** (`RAID.bosses` › `vie` ; `raid_vie`, 3.0.14 : 1 pour le Sorcier, 0,8 pour le Marionnettiste) et, sur le vrai serveur, par `parametres.raid_echelle` (1 par défaut). Chaque phase est un combat plus dur :

| Phase | Seuil (Sorcier) | Seuil (Marionnettiste) | IA | PV du boss | Essences d'avance | Coffre commun |
|---|---|---|---|---|---|---|
| 1 | 100 | 80 | 2 ★ | 5 | 0 | 2 boosters |
| 2 | 250 | 200 | 3 ★ | 6 | 0 | 300 Fragments |
| 3 | 450 | 360 | 3 ★ | 7 | 1 | 3 boosters |
| 4 | 700 | 560 | 4 ★ | 7 | 1 | 500 Éclats |
| 5 | 1 000 | 800 | 4 ★ | 8 | 2 | 5 boosters |
| 6 | 1 400 | 1 120 | 5 ★ | 9 | 2 | **une Légendaire qui manque, et le titre « Héros du Raid »** |

- **Jusqu'à la 3.0.13** : seuils 120, 300, 550, 850, 1 200, 1 600 pour les deux boss ; coffres 2 boosters, 300 Fragments, 3 boosters, 500 Éclats, 4 boosters, 5 boosters. **[calcul, sur les mesures ci-dessous]** Avec les règles officielles (4 PV), un serveur de dix joueurs actifs n'abattait jamais la sixième phase (0 % des saisons simulées) : ce n'était pas un exploit, c'était impossible.
- **[fait] Le dernier coffre (3.0.14)** : une Légendaire de l'extension que le joueur n'a pas (`accorder('legendaire')` ; s'il les a toutes, 4 000 Fragments, la moitié d'une fabrication), et le titre « Héros du Raid » (`t_heros_raid`, ton Légendaire), qu'on ne gagne que là — une seule fois : les raids suivants redonnent la Légendaire, pas le titre. **[choix de la session, à valider]** La Légendaire plutôt que des boosters : c'est le goulot de la collection (dix cartes à 4 %, README « L'équilibrage »), une récompense qui se sent. **[calcul]** Pour un serveur qui l'abat une saison sur deux, une Légendaire par mois ; un joueur régulier en fabrique une en un peu moins de quatre semaines de Fragments (README, « Le recyclage »).
- **[fait] Ce que le joueur affronte vraiment** : chaque boss a un réglage (`RAID.bosses` › `ajuste`) ; depuis les règles officielles, **les deux boss ont un PV et une Essence d'avance de moins que la phase** (phase 1 : 4 PV, 0 Essence ; phase 6 : 8 PV, 1 Essence). Le serveur garde les chiffres du tableau pour compter les dégâts : une victoire vaut « PV de la phase + 1 + 3 », une défaite les PV pris, au plus PV de la phase + 1.
- **[mesuré] 3.0.14** (`tools/equilibre-raid.js mesurer`, 100 combats par phase, par boss et par profil ; le joueur tenu par l'adversaire du jeu avec un Starter : débutant au niveau 2, régulier au niveau 3, fort au niveau 4) : les dégâts que le serveur compte, par tentative, en moyenne des trois profils.

| Phase | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| The French Sorcerer : dégâts par tentative | 6,9 | 6,9 | 6,1 | 7,0 | 6,4 | 4,0 |
| … victoires (débutant / régulier / fort) | 63 / 66 / 63 % | 50 / 55 / 45 % | 23 / 28 / 31 % | 41 / 34 / 39 % | 16 / 27 / 25 % | 0 / 7 / 6 % |
| Le Marionnettiste : dégâts par tentative | 6,4 | 6,2 | 5,7 | 5,4 | 4,4 | 3,3 |
| … victoires (débutant / régulier / fort) | 52 / 55 / 61 % | 40 / 36 / 40 % | 21 / 30 / 16 % | 11 / 20 / 23 % | 3 / 3 / 5 % | 0 / 1 / 2 % |

  Marge : environ ± 10 points sur une part de victoires, ± 0,3 sur une moyenne de dégâts. Ce qui se lit : les phases 1 à 5 du Sorcier rapportent à peu près autant chacune (une victoire en phase 5 vaut plus de dégâts, ce qui compense des victoires plus rares) ; le mur, c'est la phase 6 (adversaire au niveau 5). Le Marionnettiste devient plus dur à chaque phase. Le profil « fort » (niveau 4) ne fait pas mieux que le régulier : le niveau du joueur simulé change peu, à deck égal ; les profils se distinguent surtout par leur activité.
- **[calcul, simulation] Les saisons** (`tools/equilibre-raid.js simuler`, 2 000 saisons de 14 jours par ligne ; chaque tentative tire ses dégâts dans la mesure de la phase en cours). **[hypothèse]** Les serveurs : « dix actifs », 3 forts à 2,6 tentatives par jour, 4 réguliers à 1,8, 3 débutants à 1 (18 tentatives par jour) ; « acharnés », les mêmes à 3 tentatives chaque jour (30) ; « calme », six joueurs, 5,6 tentatives par jour.

| Serveur | Boss | Jour médian où tombent les phases 1 à 6 | La 6ᵉ tombe dans les 14 jours |
|---|---|---|---|
| Dix actifs | Sorcier | 1, 2, 4, 6, 9, 14 | 62 % des saisons |
| Dix actifs | Marionnettiste | 1, 2, 4, 6, 9, 14 | 50 % |
| Acharnés | Sorcier | 1, 2, 3, 4, 6, 9 | 100 % |
| Acharnés | Marionnettiste | 1, 2, 2, 4, 6, 9 | 100 % |
| Calme | Sorcier | 3, 7, 13, —, —, — | 0 % (la phase 3 : 97 %) |
| Calme | Marionnettiste | 3, 6, 11, —, —, — | 0 % (la phase 3 : 100 %) |

  Une dizaine de joueurs actifs abat donc la dernière phase le dernier jour, une saison sur deux : il faut tenir jusqu'au bout. Sans la vie à 0,8, le Marionnettiste ne tombait jamais (0 %) ; à 0,75, 95 % des saisons.
- **[inconnu]** L'activité réelle. Elle décide de tout : 5 % de dégâts en plus ou en moins sur la saison font passer la dernière phase d'une saison sur trois à quatre sur cinq. Le réglage se fait sans redéployer, par `raid_echelle` (Labo › Serveur › Raid) : un serveur plus petit le baisse (0,6 pour six joueurs actifs, à peu près), un plus grand le monte.
- Une phase tombée ouvre un **coffre commun** pour **chaque joueur qui a combattu au moins une fois dans la saison**, même s'il n'a pas porté le dernier coup. Il se réclame pendant la saison et la suivante.
- Trois **paliers personnels** par saison, sur ses propres dégâts : 30 (1 booster), 80 (300 Fragments), 150 (2 boosters). **[calcul]** Sur une saison du serveur « dix actifs » : un fort fait environ 200 dégâts (les trois paliers), un régulier 140 (deux, parfois trois), un débutant 75 (un, parfois deux) ; un peu moins contre le Marionnettiste.
- Les six phases tombées, le **mode Infini** : chaque victoire fait monter son propre palier (boss jusqu'à 12 PV et 3 Essences d'avance, puis c'est le joueur qui a moins de PV). Il ne débloque plus rien pour tous : c'est la performance de chacun, avec son classement.
- Ce que paie un combat (inchangé) : pendant le Choc, 3 Étincelles par dégât et 15 si le boss tombe ; le reste du temps, 2 Éclats par dégât et 15. Depuis la 3.0.14, le serveur rejoue le combat avant de compter (§ « Ce que le serveur vérifie »).

| [calcul] Par jour, au plus (3 victoires) | Phase 1 (boss à 5 PV) | Phase 6 (boss à 9 PV) |
|---|---|---|
| Dégâts par victoire | 5 + 1 + 3 = 9 | 9 + 1 + 3 = 13 |
| Hors événement, en Éclats | 3 × (9 × 2 + 15) = 99 | 3 × (13 × 2 + 15) = 123 |
| Pendant le Choc, en Étincelles | 3 × (9 × 3 + 15) = 126 | 3 × (13 × 3 + 15) = 162 |

- **[calcul]** Tout ce qu'une saison complète donne à chaque participant, en coffres communs : 10 boosters, 300 Fragments, 500 Éclats, une Légendaire (et le titre, la première fois) ; plus 3 boosters et 300 Fragments de paliers personnels. Jusqu'à la 3.0.13 : 14 boosters, 300 Fragments, 500 Éclats — mais la sixième phase ne tombait pas, et les cinq premières donnaient 9 boosters (10 désormais).

### Ce que rapportent les Étincelles [calcul]

| Source | Par jour, au plus |
|---|---|
| Quêtes du jour | 75 |
| Raid : 3 tentatives (voir plus haut) | 135 à 162 |
| Épreuve : 5 par essai, + 25 à la première victoire | 40 |
| Quêtes de l'événement (une fois) | 670 au total |

| Profil [hypothèse] | Étincelles sur 14 jours (3.0.13) | Pass (20 paliers, 2 500 pour le dernier) |
|---|---|---|
| Tout au maximum | ≈ 4 550 | fini vers le 8ᵉ jour |
| Engagé (toutes les quêtes du jour, 3 Raids, 3 Épreuves) | ≈ 2 900 | fini vers le 12ᵉ jour |
| Occasionnel (1 Raid, 1 Épreuve, la moitié des quêtes) | ≈ 1 450 | palier 14 (sur 20) |

[calcul] Ces chiffres reprennent le gain par jour des profils d'avant ((6 500 − 670) / 21 ≈ 278, (4 000 − 670) / 21 ≈ 159, (2 000 − 335) / 21 ≈ 79), sur 14 jours, plus les quêtes de l'événement (670, la moitié pour l'occasionnel), qui gardent leurs récompenses.

Jusqu'à la 3.0.12 (21 jours, 30 paliers, 3 500 pour le dernier) : ≈ 6 500 Étincelles au maximum (Pass fini vers le 11ᵉ jour), ≈ 4 000 pour un engagé (vers le 18ᵉ), ≈ 2 000 pour un occasionnel (palier 19 ou 20).

### Le Pass [fait] `PISTE_CHOC`, `_demo/serveur.js` ; `evt_piste`, `supabase/25_choc.sql`

- **3.0.13** : 20 paliers, de 20 à 2 500 Étincelles. Les sept récompenses à part restent toutes : trois titres (paliers 2, 15, 19), le sleeve « Le Choc » (5), le cadre « Choc » (9), **une** Essence Brillante (12) et, au bout, le tapis « Le Choc des Sections » (20). Le reste est ramené à environ deux tiers, comme la durée : **16 boosters, 1 100 Éclats, 2 100 Fragments, 3 Reverses Rares** (70 %, 50 %, 56 % et 60 % d'avant). [avis] Les Éclats baissent le plus : ce sont eux qui rachètent des boosters, et le Pass en donnait déjà beaucoup.
- Jusqu'à la 3.0.12, il rapportait : 23 boosters, 2 200 Éclats, 3 750 Fragments, 5 Reverses Rares, **une** Essence Brillante (palier 15), le sleeve « Le Choc » (palier 8), le cadre « Choc » (palier 12), trois titres, et au bout, au palier 30, le tapis « Le Choc des Sections ».
- Retirés à la demande : la Légendaire du palier 30 (« trop op ») et la seconde Essence Brillante (palier 25). Le palier 30 est désormais le tapis (il était au palier 20) ; le 20 donne une Reverse Rare, le 25, 700 Fragments.
- C'est plus gros que le Pass Reflets (14 boosters, 1 350 Éclats, 1 250 Fragments), sans carte rare garantie au-delà d'une Essence Brillante.

### La boutique de l'événement [fait] `04_seed.sql`, `_demo/serveur.js`

| Article | Prix | Limite (3.0.13) | Total |
|---|---|---|---|
| 2 boosters | 80 | 7 (10 avant) | 560 |
| 5 boosters | 180 | 2 (3 avant) | 360 |
| 500 Fragments | 70 | 5 (8 avant) | 350 |
| Tapis « The French Sorcerer » | 600 | 1 | 600 |
| Titre « Supporter du Choc » | 200 | 1 | 200 |
| Cadre « The French Sorcerer » (`f_foudre`) | 400 | 1 | 400 |

- Tout acheter coûte **2 470 Étincelles** [calcul] depuis la 3.0.13 (3 100 jusqu'à la 3.0.12, 2 700 avant l'arrivée du cadre `f_foudre`, 3 140 avant le premier rééquilibrage) : les limites des boosters et des Fragments sont ramenées aux deux tiers, les trois exclusifs ne bougent pas. Retirés à la demande : l'Essence Brillante et la Reverse Rare. Pour que les Étincelles gardent un usage, les boosters et les Fragments y sont un peu moins chers et plus nombreux, et un lot de 5 boosters s'ajoute.
- [hypothèse] Un joueur engagé (≈ 2 900 Étincelles en deux semaines) peut tout acheter ; un occasionnel (≈ 1 450) prend le tapis, le titre et une partie des boosters — comme avant, sur trois semaines.
- Le Pass compte les Étincelles **gagnées**, la boutique dépense le **solde** : acheter ne fait pas reculer dans le Pass.

### Ce que le serveur vérifie [fait]

- **Depuis la 3.0.14, le serveur rejoue chaque combat avant de le payer** (README, § 7.11) : une fonction Supabase (`supabase/functions/combat-verifier`, en Deno, qui exécute le moteur JavaScript du jeu) rebâtit la partie à partir de ce que le serveur a noté à l'ouverture (graine, deck, mode, jour), la rejoue coup par coup — chaque coup du joueur doit être permis, chaque coup de l'adversaire doit être celui qu'il aurait joué — et paie ce que la partie rejouée dit : la victoire, les PV pris au boss, les tours. Postgres n'exécute toujours pas le moteur ; c'est la fonction qui le fait, avec la clé de service.
- Pour les défis entre amis, elle rejoue les coups que le serveur a rangés, avec leurs auteurs : un coup envoyé hors de son tour, ou refusé par les règles, fait perdre son auteur. Plus personne ne déclare son résultat.
- **Avant (jusqu'à la 3.0.13)**, le serveur croyait le client sur le résultat, pour le PvE comme pour le Raid, et chaque joueur d'un défi déclarait son résultat. Les garde-fous restent : les dégâts d'un combat sont plafonnés (PV du boss + 1, + 3 s'il tombe), un combat doit durer au moins 20 s, et on a 3 tentatives de Raid par jour.
- Ce qui n'est pas vérifié : la façon dont le joueur choisit ses coups. Une partie jouée avec l'aide d'un programme reste une partie permise, contre l'adversaire du jeu.

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
| Starter Toxique contre des decks tirés au sort (niveau 3) | 66 % (mesuré le 31 octobre ; 64 % annoncé d'abord) | 240 |
| Starter Déter contre des decks tirés au sort | 48 % (mesuré le 31 octobre ; 58 % annoncé d'abord) | 240 |
| Toxique contre Déter, face à face | **Toxique 69 %** (165 sur 240, 274 sur 400 ; 61 % annoncé d'abord) | 240 et 400 |

**[mesuré]** Le Toxique (engager les Joueurs adverses, qui ne peuvent alors plus défendre) profite plus des règles officielles que le Déter. **Les premiers chiffres de ce tableau (64 %, 58 %, 61 %) ne se retrouvent pas** : remesurés le 31 octobre sur le même code (le commit qui les a écrits, `8b403fc`, donne aussi 165 sur 240 face à face), avec la méthode de `tools/combat-sim.js starters` (IA niveau 3 des deux côtés, places alternées, graines 2 000 + i). Onze variantes du Déter ont été essayées par la première passe, quatre le 31 (un Déter à la courbe plus basse : 69 % ; un Toxique sans Tout Commence Ici : 70 % ; les deux : 72 %) : aucune ne corrige le face-à-face. **[ouvert]** Un écart de 69 / 31 entre les deux Starters pèse sur deux nouveaux venus qui s'affrontent en Versus ; la décision (attendre les listes officielles, ou refaire les deux listes) est au propriétaire (feuille de route, § 4). **[inconnu]** Les vraies listes des Starter Decks : quand elles seront connues, elles remplaceront celles-ci, et ces chiffres seront à refaire. Le Raid, réglé de nouveau : [§ 3](#3-lévénement--le-choc-des-sections--21-jours-et-le-raid) et README § 7.9.

Le bilan d'un deck (`Decks.bilan`) suit désormais les conseils officiels : **15 Joueurs au moins** (16 avant, d'après la mesure de la 3.0.6), une Réserve accordée, la moitié des Joueurs qui attaquent pour 1 ou 2 Essences.

### L'assistant de deck (3.0.14) [mesuré] `Decks.assistant`, `Decks.COTES` ; `node tools/assistant-decks.js`

Le propriétaire, le 1er novembre 2026 : « la fonction "Compléter pour moi" doit être optimisée voire repensée […] un assistant qui fait le deck selon tes préférences, mais qui fait un vrai deck optimisé et fort tout en respectant les préférences. »

- **La cote d'une carte** [mesuré] : 6 000 parties entre decks tirés au sort (`Decks.aleatoire`, une ou deux couleurs, raretés du niveau 3), l'adversaire du jeu au niveau 2 des deux côtés (≈ 0,15 s la partie : le niveau 3 aurait demandé deux fois et demie plus de temps). Pour chaque carte, la part de victoires des decks qui la jouent, moins celle des decks de sa couleur qui ne la jouent pas (pour une Neutre : tous les decks), ramenée vers 0 quand elle a peu joué (60 parties fictives à la moyenne). 122 cartes cotées, de −0,083 (Champions du Major) à +0,072 (Trauma Dump I) ; les meilleures ensuite : Les Rois du Saloon, Zéro Soucis, SBG, Worlds Japon. Marge : ± 0,03 environ pour une carte qui a peu joué. Elles sont écrites dans `js/combat/decks.js` (`COTES`, entre deux marques, par `fusion`).
- **Ce que la cote ne voit pas** [limite connue] : les associations (deux cartes qui ne valent que l'une avec l'autre), le jeu d'un humain (l'adversaire du niveau 2 ne joue pas comme un joueur), les Promos et Secrètes qui sortent peu des tirages (sans cote, elles comptent 0). Elle change si une règle ou une carte change : `node tools/assistant-decks.js cotes 1500 <graine>` sur quatre processus (≈ 4 min), puis `fusion`. Dans l'atelier, elle se lit en cinq barres (le rang parmi les cartes cotées), avec la mention « un repère, pas une règle ».
- **L'assistant** [fait] : les cartes du joueur, les mieux cotées, dans ses couleurs (une ou deux ; à son choix, chaque couleur et chaque paire, une paire devant faire nettement mieux), en tenant les règles (40 cartes, trois exemplaires par nom et couleur, ses propres exemplaires) et les conseils des règles officielles ; le style déplace les curseurs : **Rapide** 20 Joueurs (70 % au moins attaquant pour 1 ou 2 Essences), 7 Objets, 13 Coachs et Moments ; **Équilibré** 18 / 8 / 14 (55 %) ; **Solide** 17 / 9 / 14 (45 %), la Défense et Garde ou Provocation comptées en plus. Il peut garder le deck en cours et le compléter (ses couleurs deviennent celles du deck). La Réserve suit les attaques (`reserveAuto`). Le geste s'annule.
- **Ce que valent ses decks** [mesuré] (`mesurer` et `auto`, l'adversaire du jeu au niveau 3 des deux côtés, 60 parties par deck contre une série de dix adversaires : les deux Starters et huit decks tirés au sort ; marge ± 12 points). Toute la collection, une couleur imposée :

| Couleur | Rapide | Équilibré | Solide | L'ancien « Compléter pour moi » |
|---|---|---|---|---|
| Rose | 87 % | 93 % | 92 % | 32 % |
| Violette | 88 % | 83 % | 77 % | 47 % |
| Azur | 77 % | 78 % | 75 % | 47 % |
| Orange | 70 % | 78 % | 58 % | 42 % |
| Mauve | 77 % | 68 % | 67 % | 25 % |
| Verte | 57 % | 60 % | 50 % | 32 % |
| Bleue | 43 % | 53 % | 53 % | 27 % |

  Les couleurs à son choix : avec toute la collection, Rose et Violette, 90 / 87 / 82 % (l'ancien, aux mêmes couleurs : 23 %) ; avec 60 % des cartes (deux collections tirées au sort), Rose et Violette, 87 à 95 % (l'ancien : 30 et 42 %) ; avec 35 %, Rose et Mauve 68 à 72 % (45 %), ou Rose et Violette 52 à 57 % (45 %). **[lecture]** Le Rose domine, comme le Starter Toxique (§ 3 bis) : ce n'est pas l'assistant qui le crée, il le trouve.
- **[ouvert]** Des decks aussi forts, partagés par code, pèsent sur le Versus et les classements de combat. L'assistant ne fait qu'utiliser les cartes qu'on a ; mais si le Rose reste au-dessus du reste, c'est un équilibrage des cartes (ou des Starters) qu'il faudra, pas un réglage de l'assistant.

## 3 ter. La maîtrise des cartes (version 3.0.7, rééquilibrée en 3.0.8, refaite en 3.0.13, allégée en 3.0.14)

Le rôle : donner un usage durable aux Fragments et aux doublons une fois la collection complète. **Depuis la 3.0.13, c'est l'endgame du jeu**, à la demande du propriétaire (31 octobre 2026) : « Il faut un certain nombre d'exemplaire et de fragments pour monter le niveau, et ce nombre d'exemplaire et de fragments dépend de la rareté. Il n'est pas possible de compenser un manque d'exemplaire avec des fragments. Quand tu montes la mastery, les exemplaires sont CONSOMMES. Il faut que monter la mastery soit une tâche ardue, c'est un peu l'endgame du jeu. » Les règles sont dans l'en-tête de `supabase/installation/28_maitrise.sql` (le serveur décide), dans `js/maitrise.js` (l'affichage) et dans `_demo/serveur.js` (la pré-prod) ; les trois portent les mêmes montants.

### Valeurs retenues (3.0.14) [fait] `maitrise_fragments(rar, n)`, `maitrise_copies(rar, n)`

**3.0.14** (le propriétaire, 1er novembre 2026 : « Pour la mastery, l'esthétique est parfait. Pour l'équilibrage, c'est à revoir. 2 ans pour maxer une secrète c'est un peu too much. Reste raisonnable, tout en rendant la chose assez ardue. ») : deux changements, choisis par simulation parmi plusieurs barèmes (`python3 tools/equilibre-maitrise.py`) — **la maîtrise laisse un exemplaire** (plus ce qu'on garde, ce que ses decks jouent, ce qu'on a promis), et non plus toujours trois ; **une Légendaire consomme 5 exemplaires** (au lieu de 7), **une Secrète 2** (niveaux I et V ; ses niveaux II à IV ne demandent que des Fragments). Les Fragments ne changent pas. Résultat (régulier, collection complète, médiane) : Légendaire en Légende en 133 jours (au lieu de 301), Secrète en 191 (au lieu de 770).

Un niveau demande **des exemplaires de la carte, consommés**, et **des Fragments** : la base de la rareté fois 1, 2, 4, 7 puis 11 (25 fois la base pour la Légende).

| Rareté | Exemplaires consommés (I à V) | Total | Fragments (I à V) | Total |
|---|---|---|---|---|
| Commune | 2 · 3 · 4 · 5 · 6 | **20** | 80 · 160 · 320 · 560 · 880 | **2 000** |
| Peu commune | 2 · 2 · 3 · 4 · 5 | **16** | 120 · 240 · 480 · 840 · 1 320 | **3 000** |
| Rare | 1 · 2 · 2 · 3 · 4 | **12** | 250 · 500 · 1 000 · 1 750 · 2 750 | **6 250** |
| Épique | 1 · 1 · 2 · 2 · 3 | **9** | 500 · 1 000 · 2 000 · 3 500 · 5 500 | **12 500** |
| Légendaire | 1 · 1 · 1 · 1 · 1 | **5** (7 en 3.0.13) | 800 · 1 600 · 3 200 · 5 600 · 8 800 | **20 000** |
| Secrète | 1 · 0 · 0 · 0 · 1 | **2** (5 en 3.0.13) | 800 · 1 600 · 3 200 · 5 600 · 8 800 | **20 000** |

- **Plus une carte est rare, moins elle demande d'exemplaires et plus de Fragments** ; au moins un exemplaire par niveau, sauf pour une Secrète (niveaux II à IV : des Fragments seulement). **[lecture]** « Il faut un certain nombre d'exemplaires … et ce nombre dépend de la rareté » a été lu comme permettant zéro à certains niveaux de la rareté la plus rare : avec au moins un exemplaire par niveau, une Secrète en demande cinq, soit 16 mois de boosters au mieux (une Secrète précise sort tous les 111 jours) ; à valider.
- **Seuls les exemplaires en trop sont consommés** (3.0.14) : au-delà d'un (la carte reste dans la collection), de ce que le joueur a choisi de garder (`garde_de`), **du plus qu'en contient un de ses decks**, et hors des exemplaires promis dans un échange en attente. Seuls ceux de la carte classique comptent (pas ceux de sa Reverse, qui partage pourtant sa maîtrise). Un deck n'est donc jamais privé d'une carte par la maîtrise. Jusqu'à la 3.0.13, trois exemplaires restaient toujours (la limite d'un deck), même pour une carte jouée dans aucun : une Secrète en demandait huit.
- **Il en manque ? Le niveau attend.** Jusqu'à la 3.0.12, chaque exemplaire manquant se remplaçait par son prix de fabrication (40 à 8 000 Fragments) : la maîtrise n'était bloquée que par les Fragments. Ce n'est plus possible (`maitriser` refuse : « Il faut 3 exemplaires en trop de « … » : tu en as 1. »).
- Ni les Essences, ni les Promos (sauf les Secrètes), ni les Essences Brillantes, ni l'Unique.
- **Avant (3.0.8 à 3.0.12)** : Fragments 60, 100, 200, 400, 600 et 600 de base (1 500 à 15 000 pour la Légende) ; exemplaires en trop 7, 6, 4, 2, 1 et 0 pour toute la maîtrise, remplaçables par des Fragments.

### Les temps, simulés (3.0.14) [calcul] `python3 tools/equilibre-maitrise.py 200`

Le modèle (**[hypothèse]**, le comportement réel des joueurs n'est pas mesuré) : 200 joueurs par ligne, comparaisons appariées (les mêmes boosters d'une stratégie à l'autre) ; chaque soir, le joueur recycle ce qui dépasse ce qu'il garde — trois exemplaires de chaque carte (un seul de la carte qu'il veut maîtriser, qu'il ne joue dans aucun deck), **plus tous ceux que la maîtrise de ses cartes visées demandera** (il les met de côté dès le premier jour : c'est le cas le plus rapide ; qui les recycle d'abord ira moins vite) ; il dépense le soir (la collection d'abord : classiques, puis Reverses, puis la maîtrise, le niveau le moins cher en premier). Ni godpack, ni Pass d'événement, ni échange, ni achat de Fragments. Profils : **régulier** 6 boosters par jour ; **combattant** 8, et des Fragments ponctuels (la campagne, 2 800 ; le niveau 25, 500 ; un raid fini tous les 14 jours, 600) ; **occasionnel** 4 boosters, 5 jours sur 7.

**1. Une seule carte menée en Légende**, en jours **après la collection complète** (122 classiques et 85 Reverses) ; médiane (quart le plus lent) ; part des joueurs qui y arrivent en moins d'un an :

| Rareté | Régulier | Combattant | Occasionnel |
|---|---|---|---|
| Commune | 6 (7) · 100 % | 4 (5) · 100 % | 14 (15) · 100 % |
| Peu commune | 10 (11) · 100 % | 7 (8) · 100 % | 21 (23) · 100 % |
| Rare | 21 (22) · 100 % | 14 (15) · 100 % | 43 (48) · 100 % |
| Épique | 91 (126) · 100 % | 71 (97) · 100 % | 188 (263) · 94 % |
| Légendaire | **133 (196) · 98 %** | 105 (151) · 100 % | 281 (413) · 69 % |
| Secrète | **191 (328) · 79 %** | 147 (248) · 86 % | 401 (688) · 46 % |

En 3.0.13 (trois exemplaires toujours gardés ; L 7, S 5) : Épique 129, Légendaire 301, Secrète 770 jours pour un régulier.

- **[calcul]** Pour les Communes, Peu communes et Rares, les exemplaires mis de côté pendant la collection suffisent ; ce sont les Fragments qui comptent (une à trois semaines). Pour les Épiques, les Légendaires et les Secrètes, ce sont les exemplaires : une Légendaire précise sort en moyenne tous les 39 jours pour un régulier, une Secrète précise tous les 111 jours. Une carte jouée en trois exemplaires dans un deck en garde trois : compter deux exemplaires de plus à attendre (environ 80 jours pour une Légendaire, 220 pour une Secrète).
- **[calcul]** Le niveau I d'une Légendaire vient 3 jours après la collection complète (régulier), celui d'une Secrète 86 jours (3.0.13 : 51 et 311).
- **[hypothèse] La Secrète reste la plus longue**, environ six mois pour un régulier (un an pour le quart le plus lent, treize mois pour un occasionnel) : « raisonnable, tout en rendant la chose assez ardue ». Les barèmes essayés avant celui-ci (même modèle, régulier, médiane) : le 3.0.13 en gardant un exemplaire au lieu de trois, Légendaire 209, Secrète 524 jours ; une Secrète à trois exemplaires (I, III, V), 314 jours ; une Légendaire à quatre, 90 jours (trop proche de l'Épique).

**2. Toutes les cartes d'un deck** : les 22 cartes maîtrisables du Starter Toxique (12 Communes, 7 Peu communes, 3 Rares), soit **63 750 Fragments et 388 exemplaires** consommés pour les mener toutes en Légende ; jours après la collection complète, médiane (quart le plus lent) :

| Profil | Collection complète | Toutes au niveau I | Toutes au III | Toutes en Légende |
|---|---|---|---|---|
| Régulier | jour 91 | 20 (22) | 129 (133) | **198 (202)**, ≈ 6 mois et demi |
| Combattant | jour 66 | 14 (15) | 88 (91) | **136 (139)**, ≈ 4 mois et demi |
| Occasionnel | jour 191 | 42 (45) | 270 (279) | **416 (424)**, ≈ 14 mois |

(3.0.12 : 158, 108 et 332 jours. La 3.0.14 ne change rien ici : le Starter n'a ni Épique, ni Légendaire, ni Secrète, et ses Communes, Peu communes et Rares sont limitées par les Fragments.) Un deck réel avec des Épiques et des Légendaires prend plus : leurs exemplaires arrivent lentement.

**3. La maîtrise avant la collection** (un joueur parti de zéro) : elle retarde les 122 de **24 jours** en médiane (54 pour le quart le plus touché) chez le régulier (jour 114 au lieu de 82), de 21 (42) chez le combattant (jour 85 au lieu de 62). D'où le rappel dans la fiche de maîtrise tant que la collection n'est pas complète.

**4. Le recyclage** (Fragments par semaine, médiane, un joueur parti de zéro, sans maîtrise), selon ce qu'on garde de chaque carte :

| Profil | Garder | Semaine 2 | Semaine 4 | Semaine 8 | Semaine 12 | Semaine 16 |
|---|---|---|---|---|---|---|
| Régulier | 2 (1 pour une L), avant la 3.0.12 | 833 | 1 388 | 1 977 | 2 177 | 2 240 |
| Régulier | 3 (règles officielles) | 473 | 996 | 1 470 | 1 897 | 2 002 |
| Occasionnel | 2 (1 pour une L) | 176 | 402 | 652 | 807 | 885 |
| Occasionnel | 3 | 80 | 260 | 484 | 581 | 686 |

**Ce que la simulation ne dit pas** : le rythme réel des joueurs ; les échanges (le seul autre moyen d'avoir des exemplaires : une carte contre une carte de même rareté) ; le Pass et la boutique des événements ; les cartes que chacun voudra vraiment maîtriser (le Starter n'est qu'un exemple, sans Épique ni Légendaire). `maitrises_journal` garde chaque niveau payé (Fragments et exemplaires) : de quoi revoir les montants après l'ouverture.

### La carte fétiche [fait] `profiles.fetiche`, `set_fetiche`, `fetiche_de`

Gratuite : une carte possédée, mise en scène en haut du profil et sur la fiche publique (avec sa maîtrise). Échangée ou perdue, elle disparaît de la fiche (`fetiche_de` revérifie la possession).

## 4. Ce qui reste ouvert

1. Le rythme réel de jeu des combats : à mesurer après l'ouverture (voir l'introduction). Il fixe aussi la vitesse de montée en niveau (partie 2 bis).
2. La valeur de `raid_echelle` au lancement : elle dépend du nombre de joueurs, et décide de la fréquence des coffres du Raid.
3. Le prix des cosmétiques de combat (4 000 à 5 000 Éclats par tapis) est une proposition. Rien ne permet encore de dire s'il est trop haut ou trop bas.
4. Les montants de la maîtrise (partie 3 ter, refaits en 3.0.13, allégés en 3.0.14 : un exemplaire gardé au lieu de trois, Légendaire 5, Secrète 2) restent une proposition : à revoir avec `maitrises_journal` après l'ouverture ; la Secrète en Légende (≈ six mois pour un régulier) et ses niveaux II à IV sans exemplaire sont à valider par le propriétaire.
5. Les règles du jeu elles-mêmes sont reconstituées (`docs/regles-3.0.md`). Si les vraies règles changent la durée d'une partie, le rythme des gains change avec elle.
