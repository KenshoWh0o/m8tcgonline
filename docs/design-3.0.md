# Mate TCG Online — le système visuel 3.0

La version 3.0 refait l'apparence de tout le site. Ce document dit ce qui a
changé, les règles à suivre pour que ça reste cohérent, et d'où elles
viennent. Les valeurs elles-mêmes vivent dans `css/tokens.css` : ce document
explique, le fichier fait foi.

## 1. Ce qui n'allait pas

### Dans la 2.x (audit d'avant la refonte)

L'audit a été fait écran par écran, sur téléphone (390 × 844) et sur
ordinateur (1386 × 900).

- **Une appli web plus qu'un jeu.** Fond prune presque noir et uni, et des
  rectangles sombres identiques partout : rien ne distinguait un écran d'un
  autre.
- **Trop de couleurs actives.** Le violet pour les boutons, le rose pour la
  marque, l'or, le vert, un rose-violet pour l'événement, et dans l'arène
  vert, rouge, or, bleu, blanc et rose. Une couleur ne voulait plus dire une
  chose.
- **Peu d'illustrations hors du booster.**
- **Des barres plates et des boutons lourds**, en majuscules, du même violet
  que le fond.

### Dans la première version de la refonte (pré-prod 3.0.0 à 3.0.2)

Elle a été jugée « pas belle, pas harmonieuse ». À la relecture, ce
jugement tient, pour des raisons qu'on peut nommer :

- **Quatre teintes fortes qui se disputaient** : une nuit indigo, le rose
  de l'action, l'or de l'arène, le corail de l'adversaire. Rose et corail
  sont voisins sur le cercle chromatique sans être assez différents ; l'or
  et le rose tiraient l'œil en même temps.
- **Une couleur d'action qui changeait de lieu en lieu** : rose sur le site,
  or dans l'arène.
- **Des voiles translucides partout** : les blocs laissaient voir un fond
  illustré, flouté, différent par onglet. Le résultat était brouillé, et
  rien ne se posait vraiment.

## 2. Les principes

1. **Le contenu d'abord.** Les cartes et les illustrations portent la
   couleur de l'écran ; l'interface est un gris neutre qui ne se dispute pas
   avec elles.
2. **Des tuiles pleines.** Les blocs sont des aplats posés sur le fond par
   une ombre douce, pas des voiles translucides.
3. **Une couleur d'action, partout la même.** La lavande, sur le site comme
   dans l'arène. Choisir (un onglet, un filtre) n'est pas agir : ça reste
   blanc.
4. **Le verre pour ce qui flotte, et seulement ça** : la barre des onglets,
   l'en-tête, les feuilles.
5. **Lisible d'abord.** Chaque couple texte/fond est vérifié (WCAG 2.2 :
   4,5:1 pour le texte courant, 3:1 pour les gros titres et les éléments
   graphiques). Le verre a un repli opaque.

## 3. La palette « Graphite et lavande »

Elle a été choisie parmi trois propositions présentées sur une même page de
maquettes (l'accueil des Combats, une liste de quêtes, l'arène), par le
responsable du projet.

### Neutres : un graphite à peine violacé

| Jeton | Valeur | Rôle |
| --- | --- | --- |
| `--bg` | `#121119` | Le fond de la page. Pas de noir pur. |
| `--surface`, `-2`, `-3` | `#1c1b25`, `#24232f`, `#2d2b3a` | Les tuiles, de la plus basse à la plus haute. L'élévation se lit à la clarté et à l'ombre `--tuile`. |
| `--bg-2` | noir à 26 % | Le creux : jauge vide, rail de segments, alvéole. |
| `--line`, `-2`, `-3` | blanc à 7 %, 12 %, 20 % | Les filets. |
| `--text` / `--subtle` / `--muted` | `#f1f0f8` / `#c4c1d6` / `#9a97ae` | Texte, secondaire, discret. |

### L'action : la lavande

`--accent` `#8a78f5`, `--accent-soft` `#b3a6ff`, `--cta` (le dégradé du
bouton principal, `#8f7dfb` → `#5d4bd9`, texte blanc à 4,4:1 au milieu au
moins).

Elle marque **ce qu'on peut faire** : le bouton principal, l'onglet en
cours, une carte jouable, une place libre, une attaque payable. Le décor
(icônes au trait, lavis) en prend une version claire et pâle (`--deco-ink`
`#c8bfff`, `--deco-wash`) : même famille, moins de force.

### L'or

`--gold` `#f5c451` : **les récompenses et la rareté Légendaire, rien
d'autre.**

### Les signaux

| Jeton | Valeur | Sens |
| --- | --- | --- |
| `--ok` | `#4fd6a0` | Fait, réussi, gagné. |
| `--danger` | `#ff6b6b` | Erreur, défaite ; dans l'arène, l'adversaire. |
| `--brand` | `#ff5f7e` | Les pastilles rouges qui réclament l'attention (une quête à récupérer). |

### Les Sections

Toxique est **vert** (`#62d84e`), Déter est **violet** (`#7c3aed`). Ces
couleurs ne servent qu'à dire une Section (emblème, cadre, affiche).

### Les raretés

Inchangées (`--r-es` … `--r-pr`) : elles appartiennent aux cartes.

## 4. Les matières

| Matière | Où | Recette |
| --- | --- | --- |
| **Tuile** | Les blocs de contenu : panneaux, quêtes, offres, tuiles de menu. | Un aplat `--surface` + l'ombre `--tuile` (un reflet en haut, une ombre dessous). |
| **Verre** | Ce qui flotte : barre des onglets, rail, capsules de l'en-tête, toasts. | `--glass` + `backdrop-filter: blur(…) saturate(…)` + filet clair en haut. |
| **Verre couvrant** | Feuilles, tiroir du compte. | `--glass-strong`, assez opaque pour lire. |

Règles : pas de verre sur du verre ; on n'anime jamais le flou ; le flou
s'écrit en dur (Safari ignore une variable dans `-webkit-backdrop-filter`) ;
sans `backdrop-filter`, le verre devient l'aplat `--glass-solid`.

## 5. Typographie

- **Archivo** (la typo du logo) pour les titres et les chiffres qui comptent.
  L'**italique** est réservé aux grands titres et aux noms mis en scène.
- **Figtree** pour tout le reste. Petites capitales espacées pour les
  catégories, jamais pour les phrases.
- Boutons en casse de phrase.

## 6. Formes, rythme, mouvement

- **Rayons** : 28, 22, 18, 12, 8 (`--radius-xl` … `--radius-xs`).
- **Espacements** : 6 / 10 / 14 / 20 / 28 (`--gap-1` à `-5`).
- **Mouvement** : un ressort pour ce qu'on touche, une courbe douce pour ce
  qui entre. `prefers-reduced-motion` et « Animations réduites » coupent
  tout.

## 7. Le fond

Un seul fond pour tous les onglets : le graphite, avec une lueur lavande en
haut. Les illustrations floutées par onglet de la première version sont
retirées (`assets/ambiance/`) : elles brouillaient les tuiles et changeaient
la teinte de chaque écran.

## 8. Les écrans

- **Combats** : un bandeau illustré fondu dans la page (le chevalier du
  tapis « La Luxueuse III », son casque et sa chaîne d'or), le titre en
  italique penché en bas à gauche, la Section et le niveau en anneau en haut
  à droite : ils ne se croisent plus. Puis l'affiche du prochain combat, deux
  **portes illustrées** (Solo sur l'illustration du prochain rival, Versus
  sur les deux Sections coupées en biais), l'affiche du Raid (le boss à
  droite, fondu dans le noir), trois petites tuiles. L'icône de Solo est un
  cavalier d'échecs : la pièce qu'on joue seul contre la machine.
- **Solo** : deux grandes affiches, Campagne et Arcade, puis la règle des
  Éclats du jour écrite une fois, avec des pastilles. **Campagne** : les
  actes en onglets ; l'acte choisi sous un bandeau à l'image de son boss ;
  ses cinq rivaux sur un chemin qui serpente et s'éclaire à mesure qu'on
  gagne. **Arcade** : la difficulté en grand, ce qu'elle rapporte, les cinq
  au choix.
- **La difficulté** se lit en **cinq places d'étoiles**, pleines (lavande)
  ou vides : plus de pastille or (l'or reste aux récompenses).
- **Événement** : un en-tête où les deux Sections se font face —
  Squeezie le Toxique à gauche, teinté vert, sous le titre ; Brawks Déter à
  droite, teinté violet (Gotaga Pose en 3.0.5, remplacé en 3.0.6) —, une
  coupe lumineuse en biais entre les deux, sans VS depuis la 3.0.6 ; une
  rangée d'onglets (Accueil, Raid, Épreuve, Quêtes, Pass,
  Boutique, Classement). Sur l'Accueil, quatre tuiles « Aujourd'hui », puis
  les nouveautés : les Combats en grand, six tuiles illustrées. Le Pass
  montre d'abord ses trois exclusifs.
- **Profil, fiche** : le niveau de combattant est une pastille lavande en
  bas à droite de l'avatar.

## 9. L'arène de combat

| Couleur | Sens | Exemples |
| --- | --- | --- |
| **Lavande** | Ce que tu peux faire maintenant. | Une carte jouable, une place libre, un Joueur prêt, une attaque payable, « Fin du tour », la phase en cours. |
| **Rouge** | L'adversaire. | Une cible, une attaque qui arrive, ses cartes jouées, le boss. |
| **Blanc** | Ce que tu as choisi. | La carte sélectionnée, le défenseur. |
| **Neutre** | Tout le reste. | Compteurs, piles, Défense, plateau. |
| **Vert** | Réussi. | Une Défense qui monte, un défenseur qui tient. |

La lecture du jeu :

- **Le rythme.** L'IA marque un temps entre deux actions (environ une
  seconde), et chaque animation adverse dure assez pour être suivie. Le
  réglage « Animations rapides » raccourcit tout.
- **Les cartes de l'adversaire se lisent.** Un Moment, un Coach, un Objet
  ou une Résilience joués par l'adversaire s'affichent en grand avec leur
  effet écrit, le temps de le lire (plus longtemps si le texte est long) ;
  toucher l'écran passe à la suite. Un Objet file ensuite sur le Joueur qui
  le reçoit, entouré de rouge pendant qu'on le montre. Une attaque adverse
  annonce son nom, sa cible et son effet.
- **Tout ce qui a été joué reste consultable.** Les trois dernières cartes
  jouées sont en vignettes au bout de la bande du milieu (liseré rouge pour
  celles de l'adversaire) ; les toucher ouvre la liste de la partie, tour
  par tour, et chaque carte s'ouvre en grand.
- **Les Objets liés** se voient sur le Joueur (médaillons agrandis) et,
  dans sa fiche, avec leur nom et leur effet.
- **Un clic de moins.** Attaquer ne demande plus de confirmation « Passer en
  phase de Combat ? » : le panneau des attaques le dit avant, en une ligne,
  et la bande du milieu montre les deux phases du tour (Jeu › Combat).
- **Rien n'interrompt une animation.** Pendant qu'une action se joue, la
  page ne se redessine pas : toucher une carte ou ouvrir le menu reste
  possible (en lecture seule), et le combat continue derrière.
- **Ce qui touche une carte se lit sur elle.** La Défense est une pastille
  sobre (plus d'écusson ni de grand chiffre qui déborde) ; une marque
  lavande (bonus) ou rouge (malus) signale un effet en cours, et la fiche
  de la carte les écrit en clair (« En ce moment »). Plus de signe de sorte
  de carte : le joueur la reconnaît à son illustration.
- **Un défi a un chrono.** 60 secondes par tour entre amis ; le compte
  s'affiche dans la barre de celui qui joue. Passé le temps, le tour se
  termine ; une décision attendue en dehors de son tour (défendre, choisir
  une carte) a 20 secondes, puis se fait toute seule.

## 10. Les Secrètes

Un reflet irisé (rose, or, menthe, ciel, lavande) traverse la carte en
diagonale puis se repose, en « soft-light » : il colore la lumière sans
voiler l'illustration. Huit éclats scintillent à des places fixes et
irrégulières, et autant à contretemps. Autour, une lueur lavande. La trame de
points de la première version (une grille régulière, qui se lisait comme une
moustiquaire) et son voile arc-en-ciel sont retirés. Dans la visionneuse et
sur le plateau, en 3D, les modes de mélange ne s'appliquent pas : le reflet
y est posé en clair, plus léger, et l'enveloppe n'a plus de `filter`, qui
rendait la carte floue.

## 10 bis. Version 3.0.6 : ce qui a changé après les retours

- **Les cadres** (`tools/cadres-30.py`) adoptent la manière des cadres 2.0 (Maître, Aurore, Nébuleuse) : un anneau fin, à peine là, et le motif dessiné en traînées effilées, en dégradé de couleur et de transparence, avec leur lueur. Toxique et Déter se répondent (le poison monte du bas, la foudre tombe du haut) ; le Choc les fait se heurter en haut, dans un éclat blanc ; la Secrète reprend le reflet irisé des cartes et leur ✦✦. L'Arène s'enrichissait par palier (laurier, épées à 20, gemmes à 30, prisme à 50) ; refaite en 3.0.7 (anneau de métal, rivets, cimier et sa gemme, puis des ailes qui grandissent à 20, 30 et 50, couronne et métal irisé à 50), elle a perdu en 3.0.8 sa plaque « NIV » (le niveau se lit sur la pastille de l'avatar). `tools/cadres-30.py` décrit l'état actuel.
- **L'en-tête mobile** : plus de chevron ni de pastille sur la photo. Une pilule de verre, les trois traits du menu puis l'avatar dans un anneau qui se remplit avec l'XP du niveau.
- **Le tutoriel** : une bulle sombre bordée de lavande, en haut, ou en bas quand la carte agrandie occupe le haut ; ce qu'il faut toucher a un contour blanc qui respire. Une bulle à lire assombrit légèrement l'arène et retient les doigts ; une bulle à faire les laisse passer.
- **Fermer d'un geste** : dans l'arène, tout ce qui flotte se referme en touchant à côté (le flou, le vide, le voile). C'est la règle des feuilles du site, étendue à l'arène.
- **Les filtres sur téléphone** : une rangée par critère, qui glisse de côté, l'intitulé à gauche ; sur ordinateur, les rangées passent à la ligne, faute de geste pour glisser.

## 11. Sources

Consultées pendant la refonte. Les captures de jeux sont des observations
d'interface, pas des documents de conception officiels.

- Captures d'écran de *Pokémon TCG Pocket* (DeNA / Creatures / The Pokémon
  Company), recueil publié par eternia.fr,
  <https://www.eternia.fr/fr/site/article/5352-pokemon-pocket-les-screenshots/>.
  Observé : fonds neutres clairs ou sombres, tuiles pleines aux coins
  arrondis, un grand titre en diagonale sur les écrans de mode, icônes au
  trait, peu de couleurs d'interface, les cartes portant la couleur.
- Pratt Institute, programme IxD, « Design Critique: Pokémon TCG Pocket
  (Android App) », septembre 2025,
  <https://ixd.prattsi.org/2025/09/design-critique-pokemon-tcg-pocket-android-app/>.
  Une critique fondée sur les principes de Don Norman, consacrée surtout à
  l'ouverture des boosters et au combat en solo.
- Retours de joueurs de *Pokémon TCG Pocket* (forum r/PTCGP) : voir l'énergie
  de l'adversaire, résoudre seul un effet quand il n'y a qu'un choix valide.
  Ce sont des avis, pas des études.
- L'historique des cartes jouées s'inspire de la colonne d'historique de
  *Hearthstone* (Blizzard), citée de mémoire et non vérifiée pendant cette
  refonte.
- Apple, *Human Interface Guidelines* (« Materials », « Color ») et sessions
  WWDC 2025 sur Liquid Glass : le verre réservé à la couche qui flotte, pas
  de verre sur du verre.
- Google, *Material Design 3*, thème sombre : pas de noir pur, élévation par
  la clarté de la surface.
- W3C, *WCAG 2.2*, critères 1.4.3 et 1.4.11.

Ce que ce document ne prétend pas : il n'existe pas de mesure objective de ce
qui est « beau ». Les contrastes sont mesurés. La palette est un choix de
direction artistique, fait sur maquettes par le responsable du projet. Sa
justification (un neutre qui laisse la couleur aux cartes, une seule teinte
d'action) est un raisonnement de cohérence, pas une preuve.
