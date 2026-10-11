# Règles du combat — version reconstituée (pré-build 3.0)

Les règles officielles du Gentle Mates TCG ne sont pas publiées. Celles-ci
sont **reconstituées à partir des 122 cartes de l'extension, des Promos et
des deux Secrètes révélées**. Quand les cartes ne disent rien, un choix a
été fait pour que le jeu tourne. La 3.0 ne sortira pas avant que les
vraies règles soient connues : ce document sert à les remplacer point par
point le jour venu.

## Comment lire ce document

Chaque règle porte un statut :

| Statut | Ce que ça veut dire |
|---|---|
| **[Carte]** | C'est imprimé sur une ou plusieurs cartes, citées. |
| **[Déduit]** | Ce n'est écrit nulle part tel quel, mais c'est la seule lecture cohérente des textes cités. La force de la déduction est indiquée (forte / moyenne / faible). |
| **[Maison]** | Rien ne permet de le savoir. C'est un choix pour combler le vide. Les choix inspirés d'un autre jeu le disent. |
| **[Direction]** | Une consigne donnée pour le projet, pas une règle tirée des cartes. |

Les nombres « maison » (taille du Club, PV, Essences…) sont tous réglables
au même endroit : `REGLE`, en tête de `js/combat/moteur.js`. Ils ont été
réglés par simulation (`node tools/combat-sim.js`, IA contre IA).

**Ressemblance avec le One Piece Card Game.** La structure qui se dégage
des cartes — un « leader » sans carte (le CEO), une pile d'énergie à part
(la Réserve), des points de vie faits de cartes face cachée qu'on récupère en
main quand on est touché, une capacité qui se déclenche à ce moment-là (la
Résilience), des personnages qui s'engagent en attaquant et qu'on peut
attaquer quand ils sont engagés — ressemble beaucoup à celle du One Piece
Card Game (Bandai). C'est une **observation**, pas une information : rien ne
dit que Gentle Mates s'en soit inspiré. Plusieurs choix « maison » ci-dessous
reprennent la solution de One Piece quand les cartes laissent la question
ouverte ; c'est dit à chaque fois.

---

## 1. Le but

- Deux joueurs, appelés **CEO**, s'affrontent. **[Carte]** « Les CEO
  piochent » (Barakataga), « le CEO adverse » (L'Héritier, M8 Résilience,
  La Luxueuse III, Major de Paris).
- **Victoire : le CEO adverse est touché alors qu'il n'a plus de PV.**
  **[Maison]**, solution de One Piece. Les cartes disent qu'on « récupère »
  ses PV quand on est touché (§ 7), mais pas ce qui se passe quand il n'y en
  a plus. Alternative tout aussi plausible, non retenue : perdre au moment où
  l'on récupère son dernier PV (une touche de moins pour gagner).
- **Club vide : on pioche dans ses PV.** Au moment de piocher, un CEO dont le
  Club est vide est touché à la place (il récupère un PV, ou perd s'il n'en a
  plus). **[Maison]**. La plupart des jeux font perdre le joueur qui ne peut
  plus piocher ; en simulation, c'était 10 à 25 % des parties qui finissaient
  ainsi, sur une défaite que personne n'avait vue venir. Avec cette règle,
  toutes les parties se gagnent par les PV.

## 2. Le matériel

| Zone | Ce que c'est | Statut |
|---|---|---|
| **Club** | Le deck principal : Joueurs, Coachs, Moments, Objets. | [Carte] « votre Club » (Mercato, L'Œil de Nikof, Méta Cœurs…) |
| **Réserve** | La pile des Essences, à part du Club. | [Carte] « Mélangez 1 Essence Mauve dans votre Réserve » (Most Valuable Planet), « Jouez la première carte de votre Réserve » (Trauma Dump II) |
| **Main** | Les cartes en main. | [Carte] |
| **PV** | Des cartes face cachée. | [Carte] « Regardez vos PV et choisissez une carte » (Reverse Squeeze), « Révélez vos PV » (Alerte Leak), « défausse le PV sans le regarder » (L'Arme Nucléaire) |
| **Essences en jeu** | Les Essences sorties de la Réserve, engagées ou non. | [Carte] « Essence adverse engagée » (L'Immense Draculan), « essence Jaune contrôlée » (Le Roi des rois) |
| **Lignes** | Les places des Joueurs, face à face. | [Carte] « le Joueur adverse sur la même ligne » (Calma, Dégustation), « seul sur sa ligne » (Tunnel), « échangez la position » (BLBLBLBL) |
| **Défausse** | Les cartes jouées, vaincues, défaussées. | [Carte] |
| **Banc** | Là où vont les cartes « benchées ». | [Carte] le verbe « bench » (Clim, La Fée Rosalie, Le Maillot Maudit…) ; le fonctionnement est **[Maison]**, § 9 |

Valeurs :

- **Club : 30 cartes.** [Maison]
- **Réserve : 10 Essences.** [Maison] (One Piece en a 10.)
- **PV : 5 cartes**, prises sur le dessus du Club après la main de départ.
  [Maison] pour le nombre ; [Déduit, moyenne] pour l'origine : Reverse
  Squeeze place une carte de la main sur les PV, donc les PV sont des cartes
  ordinaires ; et la Résilience, imprimée sur les cartes du Club, n'a de
  sens que si ces cartes peuvent se trouver dans les PV. Les seuils imprimés
  (« moins de 2 PV », « plus de 2 PV », « +10 pour chaque PV que vous
  avez ») sont compatibles avec 4, 5 ou 6.
- **3 lignes, une place par CEO sur chacune.** [Maison]. « Si vous avez 3
  Joueurs Roses » (Kampaï) dit qu'on peut en avoir au moins trois.
- **Main de départ : 5 cartes**, une seule fois la possibilité d'en changer.
  [Maison]

## 3. Les cartes

### Les types

| Type | Ce qu'il fait | Statut |
|---|---|---|
| **Joueur** | Se déploie sur une ligne. A une **Défense**, une ou deux **attaques**, parfois un **talent**. | [Carte] |
| **Coach** (Instant) | Un effet, puis à la défausse. **Un seul par tour.** | effet [Carte] ; limite **[Maison]** |
| **Moment** (Instant) | Un effet, puis à la défausse. **Autant qu'on veut.** | effet [Carte] ; absence de limite **[Maison]** |
| **Objet** (Lien) | Se **lie** à un de vos Joueurs et reste avec lui. **3 au plus par Joueur.** | lien [Carte] « Ce Joueur », « Objet Lié à ce Joueur » ; limite **[Maison]** |
| **Essence** | Dans la Réserve, jamais dans le Club. Engagée, elle paie les attaques. | [Carte] « Vous pouvez engager cette Essence pour déclencher vos attaques Roses » ; hors du Club **[Direction]** |

- Pourquoi un seul Coach par tour : le sous-type de Major de Paris est
  « Support », le nom que le Pokémon TCG donne aux cartes limitées à une par
  tour (Supporter). **[Déduit, faible]** — c'est un indice, pas une preuve.
- **Aucune carte n'a de coût pour être jouée.** Joueurs, Coachs, Moments et
  Objets n'en impriment aucun ; seules les attaques en ont. **[Déduit,
  forte]** pour l'absence de coût imprimé ; les limites qui la compensent
  (un Joueur et un Coach par tour) sont **[Maison]**.

### Attaques et talents

- **Une attaque a un coût : le nombre d'Essences imprimé devant elle.**
  **[Direction]** (« il y a le nombre d'essence devant chaque attaque »).
- **Une ligne sans Essence devant n'est pas une attaque : c'est un talent.**
  **[Direction]**. Un talent ne se paie pas et ne se « déclenche » pas comme
  une attaque.
- Dans les données du jeu, aucune des attaques des 122 cartes n'est sans
  coût. Les talents qu'on y trouve sont les mots-clés et les **Signatures**.
- Une attaque **sans valeur** (Omniscience de Namifique, Glissade de Vandale,
  Rêverie de Zzzzz, Foudre de Rage de The French Sorcerer) n'a que son effet :
  elle ne vise personne et ne peut pas être défendue. **[Maison]**

### Les trois sortes de Signature

Les Signatures portent une petite icône. **[Carte]** (deux icônes dans les
données : « étoile » et « déclencheur » ; certaines n'en ont pas).

| Icône | Lecture retenue | Statut |
|---|---|---|
| ★ étoile | **Effet d'entrée** : il se joue quand le Joueur arrive sur le plateau. | [Déduit, moyenne] : Joueur de l'Ombre parle d'« effet d'entrée d'un Joueur » ; Calma dit « ce tour », ce qui n'a de sens qu'au moment où il arrive. |
| ⚡ déclencheur | **Se déclenche** quand sa condition arrive (« Lorsque… »). | [Déduit, forte] : tous ces textes commencent par « Lorsque ». |
| sans icône | **Permanent** (« Si… »). | [Déduit, forte] : Just Passion, 99% Faith, Slay. |

## 4. Mise en place

1. Le Club et la Réserve de chacun sont mélangés. [Maison]
2. **Pile ou face** : le jeton désigne qui commence. [Maison]
3. Chacun pioche 5 cartes, et peut une fois les remettre pour en piocher 5
   autres. [Maison]
4. Chacun pose les 5 cartes du dessus de son Club face cachée : ses PV.
   [Maison]

## 5. Le tour

1. **Désengagement** : vos Joueurs et vos Essences se désengagent.
   [Déduit, forte] : « désengager » existe (Lofi Girl, Pinch, GP Explorer
   III) et attaquer engage (§ 6) — sans désengagement, un Joueur n'attaquerait
   qu'une fois de toute la partie.
2. **Le Banc revient** dans votre main. [Maison], § 9.
3. **Pioche** : 1 carte. Le CEO qui commence ne pioche pas à son premier
   tour. [Maison]
4. **Réserve** : la première Essence de votre Réserve entre en jeu,
   désengagée. [Déduit, moyenne] : « Jouez la première carte de votre
   Réserve » (Trauma Dump II) est un bonus, donc il y a un rythme normal ;
   « jouer la première carte de votre Réserve **engagée** » (Caprice de
   Gotaga) dit que, d'ordinaire, elle entre désengagée. Le rythme d'**une
   par tour** est [Maison]. (One Piece en donne deux par tour ; en
   simulation, deux par tour raccourcissaient les parties sans les rendre
   plus disputées.)
5. **Phase de jeu**, dans l'ordre qu'on veut :
   - **déployer un Joueur** sur une ligne libre (**un par tour**) ;
   - **lier des Objets** à vos Joueurs ;
   - **jouer des Instants** (un Coach par tour, Moments à volonté).
   Limite d'un Joueur par tour : **[Maison]**, appuyée par un indice
   **[Déduit, faible]** : la Résilience de Worlds Japon (« Jouez 2 Joueurs »)
   présente comme exceptionnel le fait d'en jouer deux.
6. **Phase de Combat** : vos Joueurs attaquent, un par un. On peut encore y
   jouer des Instants, plus de Joueur ni d'Objet. [Carte] la phase existe
   (« mettre fin à la phase de Combat », Le Maillot Maudit ; « À la fin de
   la phase de Combat », Worlds Japon) ; ce qu'on peut y faire est **[Maison]**.
   On y entre en déclarant sa première attaque.
7. **Fin du tour** : les effets « jusqu'à la fin du tour » s'éteignent.
   [Carte]

- **Le premier CEO n'attaque pas à son premier tour.** [Maison] (Pokémon et
  One Piece font de même).
- **Le second CEO joue 2 Essences à son premier tour**, au lieu d'une : sa
  compensation pour jouer en second. [Maison] Sur 400 parties entre deux IA
  de niveau Normal, le premier CEO gagnait 55 % des parties sans cette
  compensation, 49 % avec.
- **Un Joueur peut attaquer dès le tour où il est déployé.** [Déduit,
  moyenne] : l'effet d'entrée de Calma (« ne peut pas défendre une attaque
  de ce Joueur **ce tour** ») suppose qu'il attaque le tour de son entrée.

## 6. Attaquer

- **Payer** : on engage autant d'Essences que de symboles. Un symbole de
  couleur veut une Essence de cette couleur ; le symbole **Neutre** se paie
  avec n'importe laquelle. [Carte] (« engager cette Essence pour déclencher
  vos attaques Roses » ; « coûte 2 Essence Neutre »). Le moteur choisit
  lui-même quelles Essences engager, en gardant les couleurs dont vos autres
  attaques ont besoin. [Maison, simplification]
- **L'attaquant s'engage.** [Déduit, forte] : Worlds Lyon (« Vos Joueurs
  liés ne s'engagent pas lors de leur première attaque ») présente le fait de
  ne pas s'engager comme l'exception.
- **Un Joueur engagé ne peut pas attaquer.** [Déduit, forte] : sinon
  « désengagez un de vos Joueurs » (Lofi Girl, Pinch) ne servirait à rien.
  Il n'y a pas d'autre limite : un Joueur désengagé par un effet peut
  attaquer de nouveau.
- **Cibles : le CEO adverse, ou un Joueur adverse engagé** (sur n'importe
  quelle ligne). **[Maison]**, solution de One Piece, appuyée par des
  indices **[Déduit, faible à moyenne]** : beaucoup d'effets engagent les
  Joueurs adverses (toute la couleur Rose) ou visent « un Joueur adverse
  engagé » (La Fée Rosalie, Le Maillot Maudit, Target Missed) — engager
  quelqu'un doit donc l'exposer.
- **Le Joueur d'en face peut imposer la cible** :
  - **Provocation** : « L'attaquant face à ce Joueur doit le cibler. » [Carte]
  - **Slay** désengagé : même chose. [Carte]
  - Dans les deux cas il peut être visé même désengagé. [Déduit, forte]
- **Jus de bagarre** permet de viser le Joueur adverse de sa ligne, même
  désengagé. [Carte] — ce qui confirme qu'en temps normal on ne le peut pas.
  [Déduit, moyenne]

## 7. Défendre, et ce que fait une attaque

- **Déclarer un défenseur.** [Carte] « Lorsque votre adversaire déclare un
  défenseur » (M16, Trahison++).
- **Qui peut défendre : le Joueur de la ligne de l'attaquant**, s'il est
  désengagé ; **un Joueur avec Garde** défend n'importe quelle ligne.
  [Déduit, forte] : Garde (« peut défendre n'importe quelle attaque ») n'a de
  sens que si, d'ordinaire, on ne défend pas tout ; Calma (« le Joueur
  adverse sur la même ligne ne peut pas défendre ») désigne celui qui
  défendrait normalement. La condition « désengagé » est **[Maison]**.
- **Défendre engage le défenseur**, qui devient la cible de l'attaque.
  [Maison] (comme les « Blockers » de One Piece). Indice faible : Meet &
  Greeter fait entrer un remplaçant « engagé » comme défenseur.
- On peut défendre une attaque qui vise le CEO comme une attaque qui vise un
  autre Joueur. [Déduit, moyenne] (Garde : « n'importe quelle attaque »).
- **Contre un Joueur : si l'Attaque est au moins égale à sa Défense, il est
  vaincu.** Sinon, l'attaque est repoussée et il ne garde aucune trace.
  **[Maison]**. Aucune carte ne parle de dégâts qui restent, de marqueurs ou
  de soins ; la Défense est une valeur qu'on modifie « jusqu'à la fin du
  tour ». Un seuil est la lecture la plus simple. L'égalité qui l'emporte est
  aussi [Maison] (c'est la règle de One Piece).
- **Contre le CEO : il est touché, et récupère son premier PV.** [Carte]
  « Lorsque votre adversaire est touché » (L'Arme Nucléaire), « récupère un
  PV » (Trauma Dump I, Tweet la Défaite, Gotaga Pose). « Récupérer » = la
  carte va dans sa main : [Déduit, moyenne] (le mot, et la Résilience qui se
  joue « depuis » ce PV). **La valeur de l'attaque ne compte pas contre le
  CEO** : une touche = un PV. [Maison]
- L'Arme Nucléaire, seule sur le plateau : le PV va à la défausse sans être
  regardé — pas en main, pas de Résilience. [Carte]

## 8. La Résilience

- Imprimée sur les Coachs, Moments et Objets (jamais sur les Joueurs ; pas
  sur les Épiques ni les Légendaires). [Carte]
- **Quand un CEO récupère un PV qui a une Résilience, il peut la jouer
  aussitôt, gratuitement, au lieu de garder la carte en main** ; la carte va
  ensuite à la défausse (un Objet joué par « Jouez cette carte » reste lié).
  [Déduit, moyenne] : le mot (on « résiste » au moment où l'on est touché),
  la formule « Jouez cette carte » qui n'a de sens que si la carte n'est pas
  jouée normalement, et la mécanique « Trigger » de One Piece, identique.
- « Jouez cette carte » : un Instant joue son effet ; un Objet se lie à un
  de vos Joueurs. Jouée ainsi, hors de votre tour, elle ne compte pas dans
  la limite d'un Coach. [Maison]

## 9. Le Banc, la défausse, détruire

- **« Bench » une carte l'envoie sur le Banc de son propriétaire ; elle
  revient dans sa main au début de son prochain tour.** **[Maison]**.
  Les cartes distinguent trois sorts : « bench » (Clim), « défausser »
  (M4), « détruire » (Ravitaillement Mauve). Comparaison qui oriente :
  bench un Objet fait piocher 1 carte (Ravitaillement Rose), le détruire en
  fait piocher 2 (Ravitaillement Mauve) — le Banc coûte donc moins cher que
  la destruction : on y perd la carte un temps, pas pour de bon. « Bench tous
  vos Joueurs pour mettre fin à la phase de Combat » (Le Maillot Maudit) et
  « Jouez 2 Joueurs ; à la fin de la phase de Combat, bench-les » (Worlds
  Japon) vont dans le même sens : un repli, pas une perte.
- Un Joueur benché emporte ses Objets au Banc ; un Joueur vaincu les envoie à
  la défausse. [Maison]
- **Détruire = mettre à la défausse.** [Maison]
- Être benché ou renvoyé en main n'est pas être « vaincu » : ni Riposte, ni
  Légion. [Déduit, forte] : ces mots-clés disent « Lorsqu'il est vaincu ».

## 10. Les mots-clés

| Mot-clé | Texte imprimé | Précisions |
|---|---|---|
| **Provocation** | « L'attaquant face à ce Joueur doit le cibler. » | Seulement l'attaquant de sa ligne. [Carte] |
| **Garde** | « Ce Joueur peut défendre n'importe quelle attaque. » | [Carte] |
| **Shield** | « Tant qu'il est en jeu, ce Joueur ignore la première attaque qu'il subit. » | Un Shield gagné « jusqu'à la fin du tour » ignore la première attaque de ce tour-là. [Carte / Maison pour le second cas] |
| **Riposte** | « Lorsqu'il est vaincu, vous pouvez déclencher une des attaques de ce Joueur pour un coût diminué de 1, en ciblant le Joueur attaquant. » | Payée avec vos Essences désengagées — pendant le tour adverse : garder des Essences sert. La Riposte ne se défend pas. « Diminué de 1 » : un Neutre en moins, sinon une couleur. [Carte / Maison pour les précisions] |
| **Légion** | « Lorsqu'il est vaincu, vous pouvez défausser une carte pour récupérer ce Joueur dans votre main. » | La Promo Tout Commence Ici a une version plus ancienne, gratuite. [Carte] |
| **Buff** | « Vos autres Joueurs ont +10 Attaque. » (ou +20, ou +10 Défense) | [Carte] |
| **Signature** | Le talent propre au Joueur. | § 3. |

Interprétations retenues pour des textes ambigus (toutes **[Maison]**) :

- *Ralliement* : « Vos Joueurs alliés gagnent +10 Défense » — les autres,
  pas lui (comme les autres Buff).
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
  votre main jusqu'à la fin du tour » — ils reviennent simplement en main.
- *Pétrodollars*, Vol : les cartes regardées et non prises restent sur le
  Club, dans le même ordre.
- *Major de Paris* (Promo) : « Cherchez 1 Joueur Mauve ou 1 Essence Mauve
  dans votre Club » — les Essences n'étant pas dans le Club (§ 3), l'Essence
  Mauve se cherche dans la Réserve et entre en jeu. Le texte vient
  probablement d'une version antérieure des règles.
- *Tout Commence Ici* (Promo) : « Défaussez les Coachs associés » — aucune
  carte ne lie de Coach ; ce morceau est ignoré. Même remarque.
- *Joueur de l'Ombre* : Calma et Instalock sont exclus (leur effet d'entrée
  parle d'eux-mêmes, alors qu'ils sont à la défausse).
- Les « Lorsque » simultanés se résolvent en commençant par les cartes du
  CEO dont c'est le tour. [Maison]

## 11. Construire un deck

- **Club : 30 cartes. Réserve : 10 Essences, des couleurs qu'on veut.**
  [Maison] pour les nombres. On ne possède pas les Essences : on les choisit.
  [Direction] Les Essences Brillantes qu'on possède apparaissent brillantes
  en combat. [Direction]
- **2 exemplaires au plus d'une même carte** ; **1 seul** d'une Légendaire,
  d'une Secrète, d'une Promo ou de l'Unique. Une Reverse compte comme sa
  carte d'origine. [Maison]
- Une Secrète encore floutée ne se joue pas (on ne connaît pas son texte).
- Les deux **Starter Decks** (Section Toxique, Section Déter) sont prêtés :
  on peut les jouer sans en posséder les cartes. Leurs listes sont
  reconstituées : les vraies ne sont pas connues. [Maison]
- Les Promos P03 et P04 (une par Starter Deck) sont **provisoires** : nom,
  valeurs et visuel en attendant les vrais. [Maison]

## 12. Ce qu'on ne sait pas — liste

Sans prétendre à l'exhaustivité (d'autres trous peuvent se révéler à
l'usage), voici ce que les cartes ne permettent pas de trancher et qui a
été comblé :

1. Le nombre de PV, la taille du Club, de la Réserve, de la main.
2. Le nombre de lignes et de places par ligne.
3. Le rythme des Essences (combien par tour).
4. S'il y a un coût pour jouer Joueurs, Coachs, Moments, Objets, ou une
   limite par tour — et laquelle.
5. La différence de règles entre un Coach et un Moment (les deux sont des
   « Instant »).
6. Ce qu'on peut viser en attaquant (le CEO toujours ? les Joueurs engagés ?
   tous les Joueurs ?).
7. Si la défense engage, et si un Joueur engagé peut défendre.
8. Si une attaque laisse des dégâts sur un Joueur qui survit.
9. Si la valeur d'une attaque compte contre le CEO.
10. Ce que devient une carte « benchée ».
11. La condition de victoire exacte, et ce qui arrive quand le Club est vide.
12. Qui commence, et la compensation éventuelle du second.
13. La limite d'Objets par Joueur.
14. Le nombre d'exemplaires d'une carte dans un deck.
15. L'ordre de résolution de déclencheurs simultanés.
16. Les listes des Starter Decks et le contenu des Promos P03/P04.
17. Le texte des trois Secrètes floutées (124, 126, 127).

## 13. Valeurs en un coup d'œil (`REGLE`, js/combat/moteur.js)

| Valeur | Choisi | Statut |
|---|---|---|
| Lignes | 3 | Maison |
| PV | 5 | Maison |
| Main de départ | 5 (+1 changement) | Maison |
| Club | 30 | Maison |
| Réserve | 10 | Maison |
| Essences par tour | 1 (2 au premier tour du second CEO) | Maison |
| Joueurs déployés par tour | 1 | Maison |
| Coachs par tour | 1 | Maison (indice faible) |
| Objets par Joueur | 3 | Maison |
| Exemplaires par carte | 2 (1 pour L, S, Promo, Unique) | Maison |
