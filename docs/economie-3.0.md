# Économie de la version 3.0 — ce qui change, et pourquoi

Ce document accompagne le « grand équilibrage des récompenses » demandé pour la 3.0.
Chaque chiffre est classé :

- **[fait]** : une valeur du jeu, lisible dans le code (fichier cité) ;
- **[calcul]** : une conséquence arithmétique des valeurs du jeu ;
- **[hypothèse]** : une estimation qui dépend du comportement des joueurs, que personne n'a encore mesuré.

Une limite s'applique à tout le document : **aucune donnée réelle de jeu n'existe sur les combats**. Le site ne les a jamais ouverts. Les profils de joueurs ci-dessous sont donc des modèles et non des mesures. Après l'ouverture, il faudra les comparer à `quest_progress`, `combat_parties` et `evt_comptes`.

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
| Campagne, première fois (une seule fois) | 3 400 Éclats, 14 boosters, 2 800 Fragments, une Promo, un titre | inchangé | `RECOMPENSES_CAMPAGNE` |

### Ce que ça donne par jour [calcul]

| Profil | Avant rééquilibrage | Après | Hausse par rapport à la 2.x (≈ 415/jour) |
|---|---|---|---|
| Combattant régulier : quêtes combat, 5 victoires en Normal, 1 défi gagné | ≈ 491 | **≈ 355** | **+ 85 %** |
| Combattant acharné : tout au maximum, Légende, 3 défis gagnés | ≈ 766 | **≈ 560** | + 135 % |
| Collectionneur qui ne combat pas | 0 | 0 | inchangé |

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

### Le Raid, toute l'année [fait] `RAID`, `js/combat/choc-data.js` ; `supabase/27_raid.sql`

- Un boss commun à tout le serveur, The French Sorcerer, par **niveaux**. La barre d'un niveau vaut `300 + 150 × (n − 1)` dégâts, multipliés sur le vrai serveur par `parametres.raid_echelle` (1 par défaut).
- Chaque PV pris au boss en combat fait un dégât sur la barre ; le faire tomber ajoute 3 dégâts. Les dégâts d'un combat sont plafonnés côté serveur (PV du boss + 1, + 3 s'il tombe).
- Trois tentatives par jour. Le combat durcit avec le niveau : IA de 3 à 5 étoiles, boss de 6 à 9 PV, jusqu'à 2 Essences d'avance.
- Quand la barre est vide, **chacun de ceux qui ont frappé ce niveau** ouvre un coffre, à tour de rôle : 2 boosters, 300 Fragments, 3 boosters, 400 Éclats. Le boss revient au niveau suivant ; les dégâts en trop passent sur la nouvelle barre.
- Ce que paie un combat : pendant le Choc, 3 Insignes par dégât et 15 si le boss tombe ; le reste de l'année, 2 Éclats par dégât et 15 s'il tombe. Une victoire compte « PV du boss + 1 » dégâts (le PV qui manque fait gagner), plus les 3 du bonus.

| [calcul] Par jour, au plus (3 victoires) | Boss à 6 PV (niveaux 1-2) | Boss à 9 PV (niveau 7 et plus) |
|---|---|---|
| Dégâts par victoire | 6 + 1 + 3 = 10 | 9 + 1 + 3 = 13 |
| Hors événement, en Éclats | 3 × (10 × 2 + 15) = 105 | 3 × (13 × 2 + 15) = 123 |
| Pendant le Choc, en Insignes | 3 × (10 × 3 + 15) = 135 | 3 × (13 × 3 + 15) = 162 |

- **[calcul]** Hors événement, le Raid ajoute donc jusqu'à ≈ 105-125 Éclats par jour à un joueur qui gagne ses trois tentatives, l'équivalent de cinq victoires payées en Normal, en plus de celles-ci. Un premier réglage (4 Éclats par dégât, 20 par victoire) montait à 216 par jour, soit ≈ +50 % de revenu pour un joueur actif : jugé trop généreux, il a été divisé par deux environ avant la sortie.
- **[inconnu]** La vitesse à laquelle les niveaux tombent : elle dépend du nombre de joueurs qui frappent. Un joueur engagé fait ≈ 20 dégâts par jour ; il faut ≈ 15 joueurs engagés pour faire tomber le niveau 1 en un jour, ≈ 30 pour le niveau 5 (900 dégâts). Le réglage se fait sans redéployer : `update public.parametres set raid_echelle = … where id = 1;`.

### Ce que rapportent les Insignes [calcul]

| Source | Par jour, au plus |
|---|---|
| Quêtes du jour | 75 |
| Raid : 3 tentatives (voir plus haut) | 135 à 162 |
| Épreuve : 5 par essai, + 25 à la première victoire | 40 |
| Quêtes de l'événement (une fois) | 670 au total |

| Profil [hypothèse] | Insignes sur 21 jours | Pass (30 paliers, 3 500 pour le dernier) |
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

- Tout acheter coûte **2 700 Insignes** [calcul] (3 140 avant). Retirés à la demande : l'Essence Brillante et la Reverse Rare. Pour que les Insignes gardent un usage, les boosters et les Fragments y sont un peu moins chers et plus nombreux, et un lot de 5 boosters s'ajoute.
- [hypothèse] Un joueur engagé (≈ 4 000 Insignes) peut tout acheter ; un occasionnel (≈ 2 000) prend le tapis, le titre et une partie des boosters.
- Le Pass compte les Insignes **gagnées**, la boutique dépense le **solde** : acheter ne fait pas reculer dans le Pass.

### Ce que le serveur croit sur parole [fait]

- Le serveur ne rejoue pas les combats contre l'IA : il croit le client sur le résultat, pour le PvE comme pour le Raid. Trois garde-fous : les dégâts d'un combat sont plafonnés (PV du boss + 1, + 3 s'il tombe), un combat doit durer au moins 20 s, et on a 3 tentatives par jour. Un tricheur peut donc gagner au plus 54 Insignes (ou 41 Éclats) et 13 dégâts par tentative.
- Pour les défis entre amis, le serveur de démo rejoue la partie, puisqu'il dispose du moteur en JavaScript. Le vrai serveur ne le peut pas : Postgres n'exécute pas ce moteur. Chaque joueur y déclare donc son résultat, et un désaccord entre les deux déclarations est enregistré (`defis.desaccord`) pour que l'administration puisse le voir.

## 4. Ce qui reste ouvert

1. Le rythme réel de jeu des combats : à mesurer après l'ouverture (voir l'introduction). Il fixe aussi la vitesse de montée en niveau (partie 2 bis).
2. La valeur de `raid_echelle` au lancement : elle dépend du nombre de joueurs, et décide de la fréquence des coffres du Raid.
3. Le prix des cosmétiques de combat (4 000 à 5 000 Éclats par tapis) est une proposition. Rien ne permet encore de dire s'il est trop haut ou trop bas.
4. Les règles du jeu elles-mêmes sont reconstituées (`docs/regles-3.0.md`). Si les vraies règles changent la durée d'une partie, le rythme des gains change avec elle.
