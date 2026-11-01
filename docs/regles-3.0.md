# Règles du combat — les règles officielles (3.0.12)

Depuis la 3.0.12, M8 TCG Online applique **les règles officielles du
Gentle Mates TCG**, reçues du propriétaire le 30 octobre 2026 et recopiées
sans en changer un mot dans [`regles-officielles.md`](regles-officielles.md).
**Elles font foi.** Consigne du propriétaire : « respecte ces règles au pied
de la lettre, n'essaye pas d'inventer toi-même tes propres nuances ».

Ce document dit, règle par règle, **où elle vit dans le code**, et **ce que le
texte officiel ne tranche pas** : là, la lecture la plus littérale a été
retenue, l'autre lecture possible est donnée, et le point est repris dans la
liste du § 11 (à soumettre au propriétaire, ou à l'éditeur). Les règles
reconstituées des versions 3.0 à 3.0.11 (Club de 30, 5 PV, un Joueur par
tour, le Banc…) ont disparu ; le § 12 dit ce qui a changé.

## Comment lire ce document

| Statut | Ce que ça veut dire |
|---|---|
| **[Officiel]** | Écrit dans les règles officielles, cité entre guillemets. |
| **[Carte]** | Imprimé sur une carte, citée. |
| **[Lecture]** | Le texte officiel ne le dit pas en toutes lettres. La lecture la plus littérale a été retenue ; l'autre lecture possible est indiquée. Repris au § 11. |
| **[Direction]** | Une consigne du projet, pas une règle du jeu (les Essences qu'on ne possède pas, les modes de M8 TCG Online…). |
| **[Écran]** | Une commodité de l'interface qui ne change pas la règle (le moteur choisit les Essences à engager…). |

Les valeurs (taille du Club, PV, main…) sont dans `REGLE`, en tête de
`js/combat/moteur.js`, chacune avec la phrase officielle qui la fixe (§ 13).

---

## 1. Le but

- **[Officiel]** On gagne immédiatement si : on « attaque avec succès le CEO
  adverse alors qu'il n'a plus de Point de Victoire » ; l'adversaire « doit
  piocher dans son Club mais est dans l'incapacité de le faire » ; ou il
  concède. Dans le code : `toucher()` (`finir(…, 'pv')`), `piocher()`
  (`finir(…, 'club')`, événement `clubVide`), l'action `abandon`.
- Seule une **attaque** touche un CEO : aucune carte ne le touche autrement
  (`toucher()` n'est appelé que par `resoudre()`).
- **[Lecture]** Un effet qui fait piocher plus de cartes que le Club n'en a
  fait perdre (« doit piocher… dans l'incapacité de le faire ») ; on ne
  pioche pas ce qui reste avant. Aucune carte ne dit « piochez jusqu'à ».

## 2. L'Arène

**[Officiel]** « Le Terrain, où sont jouées les cartes comprenant 3 cases où
sont déployés les Joueur » ; les Points de Victoire, « face cachée » ; la
Défausse, « où sont placées toutes les cartes défaussées ou bench » ; le Club
(le deck) ; la Réserve (les Essences) ; la Main.

- **Les lignes.** **[Lecture]** Les deux Terrains se font face, case contre
  case : la case 1 d'un CEO est sur la même ligne que la case 1 de l'autre.
  C'est ce que supposent « un Joueur sur la même ligne » (la défense),
  « l'attaquant face à ce Joueur » (Provocation) et « ses Joueur adjacents »
  (le soutien : la case voisine, de son côté).
- **Les Essences en jeu.** Jouées depuis la Réserve, elles sont « déployées
  sur le Terrain » ; engagées, elles paient les attaques.
- **Il n'y a plus de Banc** : « Le terme Bench signifie qu'une carte déployée
  est envoyée à la défausse. » **[Officiel]**

## 3. Les cartes

| Type | Ce qu'il fait | Statut |
|---|---|---|
| **Joueur** | Déployé sur une case libre. Une **Défense** (« la valeur à atteindre ou dépasser pour vaincre ce Joueur »), une ou plusieurs **attaques**, parfois des **Capacités** (mots-clés, Signature). | [Officiel] |
| **Coach** | « Déclenchez son effet immédiat, puis défaussez-la. » **Un seul par tour.** | [Officiel] |
| **Moment** | « Déclenchez son effet immédiat, puis défaussez-la. » Sans limite. | [Officiel] |
| **Objet** | Lié à un de vos Joueurs ; « Il n'y a pas de limite au nombre de cartes Objet que l'on peut lier à un Joueur » ; « Les Objet sont bench lorsque la carte Joueur associée quitte le Terrain ». | [Officiel] |
| **Essence** | Dans la Réserve ; jouée à l'entretien ; « engagées pour déclencher l'attaque d'un Joueur ». | [Officiel] |

- **Jouer une carte ne coûte rien.** Seules les attaques ont un coût. Les
  deux conditions : la restriction par couleur (§ 5.3) et un Coach par tour.
  **[Officiel]**
- **Les effets** : « Un effet immédiat se déclenche au moment où la carte est
  jouée. Un effet persistant est actif tant que la carte est déployée. Un
  effet réactif se déclenche à n'importe quel moment tant que la carte est
  déployée et que la condition indiquée est remplie. » **[Officiel]** Les
  icônes des Signatures y correspondent : ★ immédiat (l'effet d'entrée), ⚡
  réactif (« Lorsque… »), sans icône persistant (« Si… »). **[Lecture]**,
  forte : tous les textes ⚡ commencent par « Lorsque », tous les textes sans
  icône par une condition.
- **Le coût d'une attaque** : le nombre d'Essences imprimé devant elle ; un
  symbole de couleur veut une Essence de cette couleur, le symbole Neutre
  n'importe laquelle. **[Carte]** « Vous pouvez engager cette Essence pour
  déclencher vos attaques Roses ». **[Écran]** Le moteur choisit lui-même
  quelles Essences engager, en gardant les couleurs dont vos autres attaques
  ont besoin (`payer()`) : la restriction par couleur compte les Essences
  engagées comme les autres, ce choix ne change donc que les attaques
  restantes, et le moteur garde les bonnes.
- **Une attaque sans valeur** (Omniscience de Namifique, Glissade de Vandale,
  Rêverie de Zzzzz, Foudre de Rage de The French Sorcerer) **[Lecture]** :
  c'est une attaque comme les autres — déclarée sur le CEO adverse, elle peut
  être défendue, et touche le CEO si personne ne la défend ; sa valeur compte
  pour 0 ; son effet imprimé se joue dans tous les cas. Autre lecture
  possible : une attaque sans valeur ne fait que son effet et ne touche
  personne (c'était le choix des règles reconstituées).

## 4. Construire son jeu

- **[Officiel]** « Votre Club doit contenir un total de 40 cartes. » ; « Il ne
  peut pas contenir plus de trois exemplaires d'une même carte. Un même
  exemplaire d'une carte est une carte possédant le même nom et la même
  couleur, quand bien même son texte ou son art est différent. » ; « Votre
  Réserve doit contenir 10 cartes Essence de votre choix. »
- Dans le code : `REGLE.CLUB`, `REGLE.RESERVE`, `REGLE.COPIES`,
  `Decks.cleCopie(id)` (le nom sans accents ni majuscules, et la couleur),
  `Decks.verifier()` ; côté serveur `cle_copie()`, `limite_copies()` et
  `deck_erreur()` (`supabase/installation/23_combats.sql`).
- Conséquences : une Reverse, l'illustration alternative d'une Promo (P02 et
  P01), ou deux cartes du même nom et de la même couleur (Le Marionnettiste
  #121 et la Promo P06 ; Leakof #072 et #110) comptent ensemble. Deux cartes
  du même nom et de couleurs différentes sont deux cartes. Il n'y a plus de
  limite propre aux Légendaires, aux Secrètes ni aux Promos.
- **Les conseils officiels** (« un minimum de 15 Joueur », « une couleur ou
  deux », « majoritairement des Joueur avec une attaque coûtant une Essence ou
  deux ») ne sont pas des règles : l'atelier les rappelle (`Decks.bilan()`).
- **[Direction]** On ne possède pas les Essences : on les choisit. Les
  Essences Brillantes qu'on possède brillent en combat.
- **[Direction]** Les deux **Starter Decks** (Toxique, Déter) sont prêtés : on
  les joue sans en posséder les cartes. **Leurs listes ne sont pas connues** :
  celles du jeu sont reconstituées (40 cartes, au moins 15 Joueurs, une
  couleur chacun, `Decks.STARTERS` et la table `starters`). Chacun contient
  la Promo de sa Section, connue depuis la 3.0.13 : P04 *Squeezie le Toxique*
  (le texte de la #012) pour Toxique, P03 *Brawks Déter* (celui de la #077)
  pour Déter.
- Les cinq Secrètes sont révélées depuis la 3.0.13 : elles se jouent toutes.
  Une Secrète encore floutée (aucune aujourd'hui) ne se jouerait pas.

## 5. La partie

### 5.1 Mise en place

**[Officiel]**, dans cet ordre (`miseEnPlace()`) :

1. « Serrez la main de votre adversaire, mélangez votre Club et mélangez
   votre Réserve séparément. » (L'arène ouvre sur le face-à-face des deux
   CEO.) La Réserve est donc mélangée : l'ordre des Essences n'est pas choisi.
2. « Piochez les 5 premières cartes du Club pour former votre Main. Si votre
   Main de départ ne vous convient pas, mélangez-la dans votre Club et
   piochez 5 cartes. Vous ne pouvez effectuer cette action qu'une fois. »
3. « Piochez et empilez 4 nouvelles cartes et placez-les face cachée sur le
   côté de votre Terrain. Ce sont vos Points de Victoire. Vous ne pouvez pas
   regarder ni les changer de place pendant la partie. » (Seul un effet de
   carte le permet : Reverse Squeeze, Alerte Leak…)
4. « Déterminez aléatoirement qui commence la partie. » Le tirage est fait à
   la création (`creer()`, pour que le rejeu donne la même partie) et
   **annoncé** à la fin de la mise en place (événement `pileFace`), après les
   mains et les PV.

- **[Lecture]** Les deux CEO décident de leur main l'un après l'autre (le CEO
  0, puis le CEO 1), chacun sans voir la main de l'autre.
- **« Le perdant commencera la partie suivante. »** **[Décision du
  propriétaire, 31 octobre]** : « oublie-la, joue tout le temps ça au pile ou
  face ». M8 TCG Online n'a pas de match en plusieurs parties : chaque partie
  tire au sort qui commence (le moteur, avec la graine). La 3.0.12 l'avait
  appliquée entre les deux mêmes adversaires ; la 3.0.13 la retire. Le
  moteur accepte encore `init.premier`, qui ne sert qu'au tutoriel (le
  joueur commence toujours).

### 5.2 Le tour (`tour()`)

**[Officiel]** :

1. **Entretien** : « Piochez une carte de votre Club. Désengagez toutes vos
   cartes engagées pour pouvoir les utiliser à nouveau. Jouez la première
   carte de votre Réserve. » Sans exception au premier tour : le CEO qui
   commence pioche aussi.
2. **Phase d'action** : « Jouez autant de cartes Joueur, Objet, Moment que
   vous le voulez. Jouez une carte Coach. »
3. **Phase de Combat** : « Dans l'ordre de votre choix, déclenchez les
   Attaques de vos Joueur. »
4. **Fin de tour** : « Défaussez autant de cartes de votre Main pour en
   garder 5 maximum. » (`REGLE.MAIN_MAX` ; le CEO choisit lesquelles,
   décision `defausseFin`.)

- « Lors du premier tour de la partie, le CEO actif passe sa Phase de
  Combat. » **[Officiel]** — le premier tour du CEO qui commence, et lui seul
  (`premierTourDuPremier`).
- **Les phases se suivent dans l'ordre.** On passe à la phase de Combat en
  déclarant sa première attaque, et on ne revient pas à la phase d'action :
  plus de Joueur, d'Objet, de Moment ni de Coach une fois la première attaque
  déclarée (`optionsTour`, `E.phase`). **[Officiel]** (« chacun composé des
  phases suivantes », numérotées).
- Les effets « jusqu'à la fin du tour » s'éteignent après la défausse de fin
  de tour (`expirer()`). **[Carte]**
- **[Lecture]** Une Essence jouée depuis la Réserve entre désengagée : le
  texte officiel ne le dit pas, mais « jouer la première carte de votre
  Réserve engagée » (Caprice de Gotaga) présente l'inverse comme
  l'exception.
- Aucune carte ne guette le désengagement de l'entretien : les deux cartes
  qui réagissent à un désengagement (#047, #048) ne valent que jusqu'à la fin
  du tour où elles entrent.

### 5.3 Jouer une carte

- **[Officiel]** « S'il s'agit d'une carte Moment, Coach ou Objet, le CEO doit
  vérifier qu'il possède l'Essence de la couleur correspondante. » ;
  « Restriction par couleur : les cartes Objet, Coach et Moment d'une couleur
  spécifique ne peuvent être jouées que si vous avez une Essence de la
  couleur correspondante déployée sur le Terrain. » Ce n'est pas un coût :
  rien ne s'engage. Une carte Neutre n'a pas de couleur spécifique. Dans le
  code : `couleurOk()`. Les Joueurs n'y sont pas soumis.
- **[Lecture]** Une Essence engagée est toujours « déployée sur le Terrain » :
  elle compte.
- **[Officiel]** « S'il s'agit d'une carte Joueur, le CEO doit mettre en jeu
  cette carte sur une case disponible. Si aucune case n'est disponible, il
  peut une fois par tour, bench un Joueur non engagé pour pouvoir jouer cette
  carte. » (`REGLE.REMPLACEMENTS`, l'action `deployer` avec `remplace`.) Le
  Joueur bench part à la défausse avec ses Objets ; il n'est pas « vaincu »
  (ni Riposte, ni Légion). **[Lecture]** Le nouveau Joueur prend la case
  libérée, la seule disponible.
- Un Joueur peut attaquer dès le tour où il est déployé : rien ne l'en
  empêche. (Calma, « ce tour », le suppose.)

## 6. La phase de Combat (`attaquer()`, `resoudre()`)

**[Officiel]**, dans l'ordre :

1. « Le CEO actif engage les Essence nécessaires au déclenchement de
   l'attaque d'un de ses Joueur. »
2. « Le CEO actif engage ce Joueur pour le déclarer comme attaquant sur le
   CEO adverse. » Un Joueur engagé ne peut donc pas attaquer : on ne peut pas
   engager une carte déjà engagée.
3. « Le CEO adverse peut déclarer un Joueur sur la même ligne comme défenseur
   pour cette attaque en l'engageant. » Un Joueur avec **Garde** « peut
   défendre n'importe quelle attaque » : de n'importe quelle case. Un Joueur
   déjà engagé ne peut pas défendre (le déclarer, c'est l'engager).
4. **Le soutien** : « si le CEO adverse déclare un défenseur, le CEO actif
   peut engager les Essence nécessaires à l'attaque d'un de ses Joueur
   adjacents, et engager le Joueur pour le déclarer comme soutien. S'il le
   fait on ajoute la valeur d'attaque du soutien à la valeur du Joueur
   attaquant. » (`soutiens()`, décision `soutien`.)
5. « On compare la valeur d'attaque du Joueur attaquant et la valeur de
   défense du Joueur défenseur, et si la valeur d'attaque est supérieure ou
   égale à la valeur de défense, le Joueur défenseur est vaincu et bench
   (envoyé à la défausse). » Sinon, il ne se passe rien : aucune trace, aucun
   dégât qui reste.
6. « S'il ne déclare pas de défenseur, l'attaque touche directement le CEO
   adverse. » Le CEO « regarde la carte du dessus de ses PV » : Résilience
   (§ 7), ou la carte va dans sa main sans être révélée. La valeur de
   l'attaque ne compte pas contre le CEO : une touche, un PV.
7. « Le CEO actif peut déclencher d'autres attaques tant qu'il possède les
   Essence et les Joueur désengagés nécessaires. »

Ce que le texte ne tranche pas (**[Lecture]**, repris au § 11) :

- **Le soutien** : un seul (« un de ses Joueur adjacents ») ; il doit être
  désengagé (le déclarer, c'est l'engager) ; une attaque sans valeur ne
  soutient pas (elle n'ajouterait rien) ; **seule sa valeur s'ajoute** : son
  effet imprimé ne se joue pas, et ce n'est pas une attaque (elle ne compte
  pas dans « votre deuxième attaque… », ne déclenche pas « Lorsque ce Joueur
  attaque »). Ses bonus d'Attaque (Objets, Buff) comptent dans sa valeur. On
  le déclare après les effets qui réagissent à la défense.
- **L'effet imprimé sous une attaque** se joue après l'attaque, qu'elle ait
  été défendue ou non, sauf si une carte l'annule (Trahison++…).

## 7. La Résilience (`toucher()`)

- **[Officiel]** « Si cette carte a un effet Résilience, il peut la révéler et
  déclencher son effet Résilience au lieu de la récupérer en main. S'il le
  fait, la carte est envoyée à la défausse après sa résolution sauf
  contre-indication (Exemple : jouer cette carte). Il peut également choisir
  de ne pas activer l'effet Résilience. Dans ce cas, il récupère la carte en
  main sans la révéler. »
- « Jouez cette carte » : un Moment ou un Coach joue son effet, un Objet se
  lie à un de vos Joueurs (`jouerCetteCarte`, `effets.js`).
- **[Lecture]** « Jouez cette carte », c'est jouer la carte : la restriction
  par couleur s'applique. Le déclenchement d'une Résilience, lui, n'est pas
  « jouer la carte » : il n'y est pas soumis.
- **[Lecture]** Un Coach joué par sa Résilience (toujours pendant le tour
  adverse : on n'est touché que par une attaque) ne compte pas dans la limite
  d'un Coach par tour. Autre lecture : il compte, et un second Coach joué par
  Résilience dans le même tour adverse serait refusé.
- **[Écran]** Une Résilience qui ne pourrait rien faire (rien à prendre, rien
  à viser) n'est pas proposée (`resPossible`) : la carte va en main.

## 8. Bench, défausse, vaincu

- **Bench = à la défausse.** **[Officiel]** Un Joueur bench emporte ses
  Objets, bench eux aussi (`bancer()`, `benchObjets()`). Les cartes bench
  sont notées (`P.bench`) pour En slip sur la Faille (§ 10).
- **Vaincu** : le Joueur défenseur battu, « bench (envoyé à la défausse) »,
  avec ses Objets. Riposte et Légion ne jouent que pour un Joueur vaincu :
  bench, renvoyé en main ou remplacé, il ne l'est pas. **[Officiel]**
  (« Lorsqu'il est vaincu »).
- **[Lecture]** « Détruire » (Ravitaillement, la Mauve, #053) et « défausser » mettent
  aussi à la défausse ; la seule différence avec « bench » est l'effet de la
  carte (Ravitaillement, la Rose, #015 : bench un Objet fait piocher 1 carte ; la Mauve : le détruire en fait piocher 2).

## 9. Les piles

**[Officiel]** « Chaque fois qu'une pile est touchée par un effet de jeu,
vous devez la mélanger. Cependant, lorsqu'un effet de jeu vous demande de
regarder ou de révéler des cartes d'une pile, replacez ces cartes dans le
même ordre, sans mélanger la pile. »

Lecture retenue (**[Lecture]**, repris au § 11) :

- **Chercher dans une pile, ou y mélanger des cartes** : la pile est mélangée
  ensuite (1% Chance, Major de Paris, Meet & Greeter, Méta Cœurs, L'Œil de
  Nikof en Résilience, The French Sorcerer…).
- **Regarder ou révéler** : les cartes regardées qui retournent dans la pile
  gardent leur ordre.
- **Un texte qui dit où vont les cartes** l'emporte : « replacez le reste
  dessus dans l'ordre de votre choix » (L'Œil de Nikof), « le reste dessous »
  (Mercato), « placez-les dessus ou dessous dans l'ordre de votre choix »
  (Zzzzz), « placer 1 carte de votre main sur vos PV » (Reverse Squeeze) ;
  les mélanger viderait ces textes de leur sens.
- **Échanger un PV avec une carte de sa main** (Reverse Squeeze, Zzzzz) : la
  carte de la main prend la place du PV, les autres gardent leur ordre (ils
  n'ont été que regardés). Autre lecture : la pile des PV a été touchée, on
  la mélange.
- Piocher n'est pas « toucher » une pile.

## 10. Les mots-clés

| Mot-clé | Texte officiel | Précisions |
|---|---|---|
| **Provocation** | « L'attaquant face à ce Joueur doit le cibler. » | **[Lecture]** L'attaque du Joueur d'en face se déclare sur lui au lieu du CEO ; un autre Joueur (Garde) peut encore défendre à sa place ; sinon on compare l'attaque à sa Défense comme pour un défenseur (≥ : vaincu), **sans l'engager** (il n'est pas déclaré défenseur). Engagé ou non, il impose la cible. Slay (#101) fait de même tant qu'il est désengagé **[Carte]**. |
| **Garde** | « Ce Joueur peut défendre n'importe quelle attaque. » | De n'importe quelle case. |
| **Buff** | « Vos autres Joueur ont +X Attaque ou +X Défense. » | Pas lui-même. |
| **Riposte** | « Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant. » | **[Lecture]** Payée avec ses Essences désengagées (pendant le tour adverse : en garder sert) ; « diminué de 1 » retire un Neutre, sinon une couleur ; elle ne se défend pas ; **seule sa valeur compte** (le Joueur est déjà à la défausse : son effet imprimé ne se joue pas) ; une attaque sans valeur ne riposte pas ; un Shield l'ignore. |
| **Légion** | « Lorsqu'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main. » | La Promo Tout Commence Ici en a une version gratuite **[Carte]**. |
| **Shield** | « Tant qu'il est en jeu, ce Joueur ignore la première attaque qu'il subit. » | Comme défenseur ou comme cible (Provocation, Riposte). **[Lecture]** Un Shield gagné « jusqu'à la fin du tour » ignore la première attaque de ce tour-là. |

Lectures de textes de cartes (toutes **[Lecture]**, reprises des versions
précédentes, que les règles officielles ne changent pas) :

- *Ralliement* : « Vos Joueurs alliés gagnent +10 Défense » — les autres, pas
  lui (comme les autres Buff).
- *Dégustation d'adversaires*, Résilience : « gagne Buff +20 Defense » — lu
  comme « a +20 Défense jusqu'à la fin du tour ».
- *Pause Technique* : « sans mot-clés » — un Joueur dont la carte n'imprime
  aucun talent.
- *Maillot Champions '24* : « Lorsque vous vainquez un Joueur » — quand le
  Joueur qui le porte en vainc un.
- *La Relève* : « Bench jusqu'à un Baby Driver… et piochez 3 cartes » — la
  pioche ne dépend pas du Bench (« jusqu'à » permet d'en bench zéro).
- *One More*, Résilience : « Votre adversaire doit déclencher une attaque de
  plus si possible » — il ne peut pas finir son tour tant qu'il peut encore
  attaquer une fois de plus.
- *En slip sur la Faille*, Résilience : « Vos Objet bench sont ajoutés à
  votre main jusqu'à la fin du tour » — les Objets arrivés à la défausse par
  un bench passent en main ; ceux qui y sont encore à la fin du tour
  retournent à la défausse (`retourDefausse`, `expirer()`).
- *Pétrodollars*, Vol : les cartes regardées et non prises restent sur le
  Club, dans le même ordre (§ 9).
- *Major de Paris* (Promo) : « Cherchez 1 Joueur Mauve ou 1 Essence Mauve
  dans votre Club » — les Essences ne sont pas dans le Club (« La Réserve,
  représentant l'ensemble de vos Essence ») : l'Essence Mauve se cherche dans
  la Réserve et entre en jeu.
- *Tout Commence Ici* (Promo) : « Défaussez les Coachs associés » — aucune
  carte ne lie de Coach ; ce morceau est ignoré.
- *Joueur de l'Ombre* : Calma et Instalock sont exclus (leur effet d'entrée
  parle d'eux-mêmes, alors qu'ils sont à la défausse).
- Les effets réactifs simultanés se résolvent en commençant par les cartes du
  CEO dont c'est le tour, chaque Joueur puis ses Objets.
- *GP Explorer II* (Secrète 126) : « Les CEO choisissent chacun 2 de leurs
  Joueurs et récupèrent les autres en main. Vous ne pouvez plus jouer de
  Joueur pour le reste de ce tour. » — celui qui joue la carte choisit
  d'abord, puis l'adversaire ; un CEO qui a deux Joueurs ou moins n'en
  reprend aucun ; les Objets des Joueurs repris sont bench (« Les Objet sont
  bench lorsque la carte Joueur associée quitte le Terrain ») ; « jouer un
  Joueur », c'est le mettre en jeu sur une case (« Jouer une carte ») : ce
  tour-là, ce CEO n'en joue plus, ni par l'action ni par un effet qui dit
  « jouez » (Worlds Japon, Versus Fighting, Meet & Greeter, la Résilience de
  M16) ; `joueurPermis()`.
- *Paris Gentle Mates* (Secrète 127) : « Mélangez 2 de vos Essences Mauves
  dans votre Réserve pour doubler la valeur de la première attaque que vous
  déclenchez ce tour. » — les deux Essences sont prises parmi celles en jeu,
  engagées d'abord (celles qui ont déjà payé, comme les autres cartes qui
  rendent une Essence Mauve) ; seule la valeur de l'attaque double, pas un
  soutien qui s'y ajoute ; un Moment ne se joue plus en phase de Combat, donc
  « la première attaque » est toujours à venir ; une Riposte pendant le tour
  adverse n'est pas une attaque « que vous déclenchez ce tour ».

## 11. Ce que les règles officielles ne tranchent pas — la liste

Sans prétendre à l'exhaustivité (d'autres trous peuvent se révéler à
l'usage). Pour chaque point : la lecture retenue, puis l'autre.

1. **Provocation** : la cible imposée n'est pas engagée et on compare à sa
   Défense ; un Joueur avec Garde peut défendre à sa place. — Autre : la
   Provocation obligerait seulement à la déclarer comme défenseur.
2. **Une attaque sans valeur** se déclare sur le CEO, se défend et touche. —
   Autre : elle ne fait que son effet.
3. **Le soutien** : un seul, désengagé, seule sa valeur s'ajoute (pas son
   effet), ce n'est pas une attaque. — Autre : son effet imprimé se jouerait
   aussi, ou il compterait comme une attaque.
4. **La Riposte** : seule sa valeur compte, elle ne se défend pas. — Autre :
   son effet imprimé se jouerait.
5. **Un Coach joué par Résilience** ne compte pas dans la limite. — Autre :
   il compte.
6. **« Jouez cette carte » respecte la restriction par couleur.** — Autre :
   une Résilience passe outre.
7. **Le mélange des piles** (§ 9) : chercher mélange, regarder garde l'ordre,
   un texte qui place les cartes l'emporte, un échange de PV garde l'ordre.
   — Autre : tout ce qui touche une pile la mélange, même un placement
   imprimé.
8. **« Le perdant commencera la partie suivante »** — **tranché par le
   propriétaire le 31 octobre** : chaque partie se tire à pile ou face (il
   n'y a pas de match en plusieurs parties).
9. **Le remplacement** : le nouveau Joueur prend la case du Joueur bench. —
   Pas d'autre lecture sensée (c'est la seule case disponible).
10. **Une Essence jouée de la Réserve entre désengagée.**
11. **Le mulligan** : les deux CEO décident l'un après l'autre.
12. **Piocher plus que le Club n'en a** fait perdre aussitôt.
13. **La liste des Starter Decks** : inconnue (le propriétaire la fournira).
    Le texte de P03, P04 et des Secrètes 124, 126 et 127 est connu depuis la
    3.0.13 (photos du propriétaire, 1er novembre 2026).
14. **GP Explorer II** (§ 10) : celui qui la joue choisit d'abord ; « jouer un
    Joueur » couvre aussi un effet qui dit « jouez ». — Autre : les deux CEO
    choisiraient en même temps, sans voir le choix de l'autre ; ou seule
    l'action de la phase d'action serait interdite.
15. **Paris Gentle Mates** (§ 10) : les Essences engagées partent d'abord, et
    seule la valeur de l'attaque double. — Autre : le joueur choisirait ses
    deux Essences ; le soutien doublerait aussi.
16. **« Sermont »**, l'attaque de Brawks Trop Déter (Secrète 124) : écrit tel
    qu'imprimé sur la photo ; peut-être une coquille de « Serment ».

## 12. Ce qui a changé depuis les règles reconstituées (3.0 à 3.0.11)

| Sujet | Avant (reconstitué) | Officiel (3.0.12) |
|---|---|---|
| Club | 30 cartes | **40** |
| Exemplaires | 2 (1 pour les Légendaires, Secrètes, Promos, l'Unique) ; une Reverse avec sa classique | **3**, par nom et couleur |
| PV | 5, posés après la main | **4**, posés après la main |
| Qui commence | pile ou face avant la main | tiré au sort après les mains et les PV, à chaque partie |
| Pioche | pas au premier tour du premier CEO | **toujours**, en premier dans l'entretien |
| Second CEO | 2 Essences à son premier tour | rien |
| Joueurs par tour | 1 | **autant qu'on veut** ; plein, un remplacement par tour |
| Objets par Joueur | 3 | **sans limite** |
| Couleur des Objets, Coachs, Moments | libre | **une Essence de leur couleur en jeu** |
| Instants en phase de Combat | permis | **non** : les phases se suivent |
| Cibles | le CEO, ou un Joueur adverse engagé | **le CEO** (sauf Provocation, Slay, Jus de bagarre) |
| Soutien | absent | **un Joueur adjacent** ajoute sa valeur contre un défenseur |
| Attaque sans valeur | ne vise personne, ne se défend pas | une attaque comme les autres |
| Bench | au Banc, retour en main au tour suivant | **à la défausse** |
| Fin de tour | rien | **défausser jusqu'à 5 cartes** |
| Club vide | on pioche dans ses PV | **on perd** |

Les mesures (IA contre IA, Starters, Raid) refaites avec ces règles sont dans
`docs/economie-3.0.md` § 3 bis.

## 13. Valeurs (`REGLE`, js/combat/moteur.js)

| Valeur | `REGLE` | Phrase officielle |
|---|---|---|
| 3 cases | `LIGNES` | « 3 cases où sont déployés les Joueur » |
| 4 PV | `PV` | « Piochez et empilez 4 nouvelles cartes » |
| Main de départ : 5 (+1 mulligan) | `MAIN` | « Piochez les 5 premières cartes » |
| Main en fin de tour : 5 au plus | `MAIN_MAX` | « pour en garder 5 maximum » |
| Club : 40 | `CLUB` | « un total de 40 cartes » |
| Réserve : 10 | `RESERVE` | « 10 cartes Essence de votre choix » |
| Exemplaires : 3 | `COPIES` | « pas plus de trois exemplaires d'une même carte » |
| Coachs par tour : 1 | `COACHS` | « une seule carte Coach par tour » |
| Remplacements par tour : 1 | `REMPLACEMENTS` | « une fois par tour, bench un Joueur non engagé » |
| Essences par tour : 1 | `ESSENCES` | « Jouez la première carte de votre Réserve » |

**Les modes de M8 TCG Online** (Épreuve du jour, campagne, Raid, tutoriel)
changent parfois le nombre de PV ou donnent des Essences d'avance
(`pv`, `essDepart` dans `Combat.creer`) : ce sont des règles de mode
**[Direction]**, annoncées avant le combat, pas des règles du jeu. Un combat
« Classique », l'Arcade et le Versus suivent les règles officielles sans rien
y changer.
