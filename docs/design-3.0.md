# Mate TCG Online — le système visuel 3.0

La version 3.0 refait l'apparence de tout le site. Ce document dit ce qui a
changé, les règles à suivre pour que ça reste cohérent, et d'où elles
viennent. Les valeurs elles-mêmes vivent dans `css/tokens.css` : ce document
explique, le fichier fait foi.

## 1. Ce qui n'allait pas (audit de la 2.x)

L'audit a été fait écran par écran, sur téléphone (390 × 844) et sur
ordinateur (1386 × 900), avant la refonte.

- **Une appli web plus qu'un jeu.** Fond prune presque noir et uni, et des
  rectangles sombres identiques partout (quêtes, boutique, échanges, boîte
  de réception) : rien ne distinguait un écran d'un autre.
- **Trop de couleurs actives.** Le violet pour les boutons, le rose pour la
  marque, l'or, le vert, un rose-violet pour l'événement, et dans l'arène
  vert (places libres), rouge (cibles), or (jouable), bleu (défense), blanc
  (sélection), rose (choix de cible). Une couleur ne voulait plus dire une
  chose.
- **Peu d'illustrations hors du booster.** Le jeu a 127 illustrations ; les
  écrans de menus n'en montraient presque aucune.
- **Des barres plates.** En-tête et barre du bas collés aux bords, fond
  plein, filet : la page s'arrêtait net dessous.
- **Des boutons à rebord en majuscules.** Lourds, et le même violet que le
  fond, donc peu contrastés en teinte.

## 2. Les principes

1. **Le contenu d'abord, le chrome ensuite.** Les cartes et les illustrations
   portent l'écran ; l'interface flotte au-dessus, en verre, et se fait
   oublier.
2. **Une couleur, un sens.** Une seule couleur d'action par écran. Choisir
   (un onglet, un filtre) n'est pas agir : ça ne prend pas la couleur
   d'action.
3. **Chaque écran a sa lumière.** Une illustration du jeu, floutée, éclaire
   le fond de chaque onglet.
4. **Le verre a quelque chose à flouter.** Il n'existe que parce que la page
   passe dessous. Pas de verre posé sur du vide, pas de verre sur du verre.
5. **Lisible d'abord.** Chaque couple texte/fond est vérifié (WCAG 2.2 :
   4,5:1 pour le texte courant, 3:1 pour les gros titres et les éléments
   graphiques). Le verre a un repli opaque.

## 3. La palette

### Neutres : une nuit indigo

| Jeton | Valeur | Rôle |
| --- | --- | --- |
| `--bg` | `#0a071f` | Le fond de la page. Jamais de noir pur : un noir pur fait des trous, et le verre n'a rien à teinter. |
| `--surface`, `-2`, `-3` | blanc à 4,5 %, 7,5 %, 11 % | Les voiles de contenu, du plus bas au plus haut. L'élévation se lit à la clarté, pas à l'ombre. |
| `--bg-2` | nuit à 42 % | Le creux : jauge vide, rail de segments, alvéole. |
| `--plate`, `-2`, `-3` | `#120b29` … `#231c40` | Les mêmes surfaces, opaques, pour ce qui se pose sur une image et doit la masquer. |
| `--line`, `-2`, `-3` | blanc à 8,5 %, 15 %, 24 % | Les filets. Transparents : ils prennent la teinte de ce qu'ils bordent. |
| `--text` / `--subtle` / `--muted` | `#f6f4ff` / `#c6c3e2` / `#9591b9` | Texte, secondaire, discret. `--muted` garde plus de 5:1 sur un voile : c'est le plancher. |

### L'action : le rose M8

`--accent` `#e0378d`, `--accent-soft` `#ff7ac4`, `--cta` (le dégradé du bouton
principal, `#f7509f` → `#c8207a`).

C'est le rose du logo. Il marque **ce qu'on peut faire** : le bouton
principal, l'icône de l'onglet en cours, une pastille qui réclame
l'attention, un lien. Il n'est jamais un fond de bloc ni un titre. Le blanc
garde 4,3:1 au milieu du dégradé (4,8:1 en bas), avec une ombre de texte
pour les bords clairs.

Pourquoi le rose et plus le violet : sur un fond violet, un bouton violet ne
se détache que par la clarté. Sur une nuit indigo, le rose se détache aussi
par la teinte — c'est ce qui fait qu'on le trouve sans le chercher.

### Les lumières : violet et cyan

`--violet` `#9a73ff` et `--cyan` `#40d1f7`, les couleurs des visuels de
l'extension. Elles éclairent les fonds (`.bgdeco`), les halos et les dégradés
décoratifs. **Elles ne marquent jamais un état** : un élément violet n'est ni
sélectionné ni cliquable pour autant.

### L'or

`--gold` `#ffbd34`. Les récompenses (paliers, cadeaux, Légendaires), et
dans l'arène, ce qu'on peut jouer (voir § 8). Texte posé dessus : `--gold-ink`
`#2a1700` (12:1).

### Les signaux

| Jeton | Valeur | Sens |
| --- | --- | --- |
| `--ok` | `#41dca5` | Fait, réussi, gagné : une quête accomplie, une victoire. |
| `--warn` | `#ffbd34` | Attention : une perte, une limite atteinte. |
| `--danger` | `#ff6b5e` | Erreur, défaite, adversaire. Corail et non rose : le rose est pris par l'action, et une erreur ne doit pas ressembler à un bouton. |

### Les raretés

Inchangées (`--r-es` … `--r-pr`) : elles appartiennent aux cartes, pas à
l'interface. On ne s'en sert que pour dire une rareté.

## 4. Les matières

Trois matières, pas une de plus.

| Matière | Où | Recette |
| --- | --- | --- |
| **Verre** | Ce qui flotte au-dessus du contenu : barre du bas, rail, capsules de l'en-tête, toasts, notifications. | `--glass` (nuit à 50 %) + `backdrop-filter: blur(22px) saturate(170%)` + filet `--glass-line` plus clair en haut (`--glass-line-top`) + reflet `--glass-hi` + ombre `--sh-3/4`. |
| **Verre couvrant** | Feuilles modales, tiroir du compte. | `--glass-strong` (dégradé nuit à 84–92 %) + `blur(32px) saturate(160%)`. Assez opaque pour lire, assez clair pour savoir d'où ça vient. |
| **Voile** | Les blocs de contenu : panneaux, quêtes, offres, messages. | `--surface` + filet `--line` + reflet discret. **Sans flou** : ce sont des listes, et un flou par élément coûterait cher sur téléphone. |

Règles :

- **Pas de verre sur du verre.** Dans une feuille, un bloc est un voile, pas
  du verre.
- **Trois ou quatre couches de verre par écran, au plus** (en-tête, barre du
  bas, une feuille, un toast).
- **On n'anime jamais le flou.** On anime l'opacité ou la transformation.
- **Le flou s'écrit en dur.** Safari ignore une variable CSS dans
  `-webkit-backdrop-filter` : chaque règle écrit les deux propriétés avec
  leurs valeurs.
- **Le repli.** Sans `backdrop-filter`, ou si le système demande moins de
  transparence (`prefers-reduced-transparency`, encore peu pris en charge),
  le verre devient l'aplat `--glass-solid` (css/base.css).
- **Pas de réfraction SVG.** L'effet de lentille par filtre SVG ne marche que
  dans Chromium : on ne s'en sert pas.

## 5. Typographie

- **Archivo** (la typo du logo) pour les titres et les chiffres qui comptent.
  L'**italique** est réservé au titre de page (`h1`) et aux noms mis en scène
  (un boss, un événement, un nom de carte en fiche).
- Les titres de section (`h2`) sont droits, sans trait de couleur.
- **Figtree** pour tout le reste. Les étiquettes en petites capitales
  (11 px, espacées) servent aux catégories, jamais aux phrases.
- Les boutons sont en casse de phrase (« Ouvrir », pas « OUVRIR »).

## 6. Formes, rythme, profondeur, mouvement

- **Rayons concentriques** : 30 (feuille, tiroir), 24 (panneau), 18 (bloc,
  carte de menu), 12 (élément intérieur), 8 (puce). Un rayon intérieur vaut
  le rayon extérieur moins la marge.
- **Espacements** : 6 / 10 / 14 / 20 / 28 (`--gap-1` à `-5`).
- **Ombres** teintées de la nuit (`--sh-1` à `-4`), jamais noires.
- **Mouvement** : un ressort (`--spring`) pour ce qu'on touche — un bouton se
  tasse à 97 % — et une courbe douce (`--ease`) pour ce qui entre.
  `prefers-reduced-motion` et le réglage « Animations réduites » coupent
  tout.

## 7. Les composants

- **Bouton principal** (`.btn`) : capsule rose bombée, lueur rose dessous.
  Un par écran.
- **Bouton secondaire** (`.btn.ghost`) : verre clair, texte blanc.
- **Puce de filtre, segment, onglet en cours** : verre plus clair et texte
  blanc. Pas de rose : choisir n'est pas agir.
- **Barre du bas** : capsule de verre flottante, décollée des bords de 12 px.
  L'onglet en cours est une lentille plus claire qui glisse depuis l'onglet
  quitté ; son icône prend le rose.
- **En-tête** : sans fond. Logo à gauche, capsules de verre à droite ; dessous,
  un bord qui floute et assombrit ce qui remonte.
- **Ordinateur** : la barre du bas devient un rail à droite, la même capsule
  debout.

## 8. Les fonds d'ambiance

Chaque onglet a sa lumière : une illustration du jeu, floutée, assombrie et
saturée d'avance par `tools/ambiances.py` (moins de 1,5 Ko par image),
posée en haut de l'écran et effacée vers le bas. Le flou est calculé une
fois, pas par le navigateur à chaque image.

| Onglet | Illustration |
| --- | --- |
| Boosters | le booster de l'extension |
| Collection | Kampai, Gotaga Dance, Champions du Monde, BrawksSaga |
| Combats | The French Sorcerer (le boss du Raid) |
| Le Choc | les deux sections, Déter et Toxique |
| Quêtes | M8 Résilience |
| Social | Grand Respect |
| Boutique | La Luxueuse III |
| Classement | Championnes d'Europe |
| Profil | La Relève |

## 9. L'arène de combat

L'arène est une scène à part : son fond est la nuit indigo, et **la couleur
d'action y devient l'or**. Chaque couleur y a un sens, un seul :

| Couleur | Sens | Exemples |
| --- | --- | --- |
| **Or** | Ce que tu peux faire maintenant. | Une carte jouable en main, une place libre où la poser, un Joueur prêt à attaquer, une attaque payable, « Fin du tour », « Continuer ». |
| **Corail** | L'adversaire, ce qu'on vise ou ce qui menace. | Une cible d'attaque, une attaque adverse annoncée, le boss, des PV perdus. |
| **Blanc** | Ce que tu as choisi. | La carte sélectionnée, la place visée. |
| **Neutre** (verre, gris lavande) | Tout le reste. | Compteurs, piles, Défense, plateau. |
| **Vert** | Réussi, et rien d'autre. | Une victoire, des PV rendus. |

Il n'y a plus de vert pour les places libres, de bleu pour la Défense, de
rose pour le choix d'une cible : ces couleurs disaient la même chose (« tu
peux ») ou ne disaient rien.

## 10. Sources

La refonte s'appuie sur ces références (consultées pendant la refonte ;
les captures de jeux sont des observations d'interface, pas des documents
officiels) :

- Apple, *Human Interface Guidelines*, pages « Materials » et « Color », et
  les sessions WWDC 2025 « Meet Liquid Glass » et « Get to know the new
  design system » : verre réservé à la couche de navigation qui flotte
  au-dessus du contenu, pas de verre sur du verre, teinte réservée aux
  actions principales, rayons concentriques.
- Google, *Material Design 3*, guide du thème sombre : pas de noir pur,
  élévation par la clarté de la surface, couleurs désaturées sur fond
  sombre.
- W3C, *WCAG 2.2*, critères 1.4.3 (contraste du texte) et 1.4.11 (contraste
  des éléments non textuels).
- MDN, `backdrop-filter` et `prefers-reduced-transparency` (prise en charge
  partielle de cette dernière).
- Observations de *Pokémon TCG Pocket* (cibles valides qui pulsent, zones
  invalides éteintes, résolution automatique quand il n'y a qu'un choix) et
  de *Marvel Snap* (le plateau d'abord, les informations classées par
  importance, un code couleur réduit).

Ce que ce document ne prétend pas : il n'existe pas de mesure objective de ce
qui est « beau ». Les contrastes sont mesurés ; le choix des teintes (rose,
indigo, or) est un choix de direction artistique, justifié par la cohérence
avec le logo et les visuels de l'extension, pas une vérité.
