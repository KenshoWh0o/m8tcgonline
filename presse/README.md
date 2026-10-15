# Kit de presse

De quoi annoncer le jeu sur Twitter sans rien fabriquer à la main.

Tout est composé à partir des vrais fichiers du projet — les mêmes cartes, le même
logo, les mêmes polices. L'identité n'est pas imitée, elle est réutilisée : ce qu'on
promet sur Twitter est exactement ce qu'on trouve en arrivant sur le site.

```bash
python3 tools/kit-presse.py
```

Une seule commande refait tout. Le jour où une carte change, où l'extension s'agrandit,
où l'adresse bouge : on relance, on ne rouvre pas un logiciel de retouche pour corriger
un chiffre.

---

## Ce qu'il y a dans `visuels/`

| Fichier | Format | Pour quoi |
|---|---|---|
| `01-annonce-paysage.png` | 1200 × 675 | Le tweet d'annonce. Logo, nom de l'extension, promesse, adresse. |
| `02-cartes-paysage.png` | 1200 × 675 | Cinq légendaires en éventail. Le visuel qui donne envie d'ouvrir. |
| `03-chiffres-paysage.png` | 1200 × 675 | 122 cartes, 6 par booster, 6 par jour, 0 €. Pour couper court aux questions. |
| `04-booster-portrait.png` | 1080 × 1350 | Portrait, occupe toute la hauteur du fil sur mobile. |
| `05-promos-carre.png` | 1080 × 1080 | Quatre des six cartes Promo (P01, P02, P05, P06) ; les deux Promos de Section, encore sans illustration, n'y sont pas. Le post « pour les collectionneurs ». |
| `06-teaser-paysage.png` | 1200 × 675 | « Coming soon », à poster **avant** l'ouverture. |
| `teaser-anime.gif` | 800 × 450 | Le paquet qui flotte. Court, léger, en boucle. |
| `ouverture-anime.gif` | 800 × 450 | **Le meilleur asset du lot.** Un booster s'ouvre, cinq cartes se déploient en éventail (un vrai booster en a six). |

> Twitter accepte les GIF jusqu'à 15 Mo : les deux passent largement.
> Un GIF est lu automatiquement dans le fil, sans son et sans clic — c'est
> précisément ce qu'il faut pour arrêter un pouce qui défile.

---

## Dans quel ordre poster

Le jeu se découvre en trois temps. Les visuels sont faits pour ça.

**1. Avant l'ouverture — `06-teaser` puis `teaser-anime`**
Deux ou trois jours avant. On ne dit pas ce que c'est, on montre le paquet.
L'adresse est dessus : les curieux tombent sur l'écran d'attente, et celui-ci
fait le reste du travail.

**2. Le jour de l'ouverture — `ouverture-anime`**
C'est le post principal. Une ouverture de booster se comprend sans légende, dans
n'importe quelle langue, en trois secondes. Mets `01-annonce` en seconde image du
même tweet pour ceux qui veulent le détail.

**3. Les jours suivants — `02-cartes`, `03-chiffres`, `05-promos`**
Un par jour, pas trois d'un coup. Chacun répond à une question différente :
« c'est joli ? », « c'est payant ? », « il y a de quoi chasser ? ».

---

## Les textes

À reprendre tels quels ou à retailler. Ils disent tous la même chose : c'est
gratuit, c'est complet, et ça se joue maintenant.

**Teaser (avant)**

> Quelque chose arrive.
> 122 cartes. Des boosters. Des échanges.
> matetcg.com

**Annonce (le jour J)**

> Mate TCG Online est en ligne.
>
> Ouvre des boosters, complète les 122 cartes de l'extension *Tout commence ici*,
> échange avec les autres joueurs.
>
> Gratuit. Pas de pub, pas d'achat intégré.
> → matetcg.com

**Les cartes**

> Dix légendaires dans l'extension.
> Six boosters par jour, gratuits.
> Le reste, c'est de la patience.
>
> matetcg.com

**L'économie, pour couper court**

> Non, il n'y a rien à payer.
> Pas de pub non plus.
> La seule monnaie du jeu se gagne en accomplissant des quêtes, et elle ne sert
> qu'à acheter des boosters et des cosmétiques.
>
> matetcg.com

**Les promos**

> Six cartes Promo, introuvables en booster.
> Deux s'achètent avec la monnaie du jeu.
> Deux se méritent : 75 % de la collection, et le Master Set complet.
> Deux attendent les Combats : une par Section, pour qui la rejoint.
>
> matetcg.com

**Réponse type « c'est officiel ? »**

> Non, c'est un projet de fan, non affilié à Gentle Mates.
> Les visuels des cartes sont ceux du TCG, utilisés à titre informatif.

---

## Les captures du jeu

Le script ne sait pas photographier le jeu en train de tourner : pour ça, il faut
un vrai navigateur. C'est deux minutes, et le résultat est meilleur qu'une
simulation.

1. Ouvre le site sur ton téléphone, ou en mode mobile dans Chrome
   (F12 → l'icône téléphone → iPhone 14 Pro).
2. Le site n'a qu'un thème, sombre : c'est l'ambiance des visuels ci-dessus.
3. Les écrans qui valent le détour :
   - **Boosters** — le paquet et la réserve pleine
   - **l'ouverture** — juste après la révélation d'une légendaire
   - **le récap** — la grille des six cartes
   - **Collection** — avec une bonne moitié des cases remplies
   - **une carte en grand** — depuis la Collection, elle tourne en 3D
   - **les Promos** — le bas de l'onglet Collection

Si ton compte est administrateur, l'onglet **Labo** prépare la mise en scène en un
clic : « Monter à 90 % » remplit la collection, et les boutons d'ouverture rejouent
n'importe quelle révélation sans attendre la chance.

---

## Retoucher les visuels

Le texte, les couleurs et les compositions sont dans `tools/kit-presse.py`, en haut
du fichier. Chaque visuel est une fonction courte : `v1_annonce()`, `v2_cartes()`…
On change, on relance.

`visuels.html` est la même chose en version page web. Elle sert à deux choses que
le script ne fait pas :

- **capturer en haute densité** — ouvre `presse/visuels.html?v=2` et fais une capture
  d'écran sur un écran Retina : tu obtiens le double de définition ;
- **filmer** — la page affiche le vrai logo de l'extension (un SVG que le script
  Python ne sait pas lire) et les vraies animations du site.

---

## Les polices

`polices/` contient Archivo et Figtree, les deux polices du jeu, sous licence
SIL Open Font — libres d'usage, y compris commercial. Elles sont là pour que le
script tourne sans connexion et pour que les visuels restent identiques d'une
machine à l'autre.
