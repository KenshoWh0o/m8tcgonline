#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique les cosmetiques exclusifs de l'evenement 3.0 « Le Choc des Sections ».

    python3 tools/choc-visuels.py

Ecrit :
  assets/combat/tapis/t_arene.webp (+ -mini)   Pass, palier 30 : « Le Choc des Sections »
  assets/combat/tapis/t_orage.webp (+ -mini)   boutique de l'evenement : « The French Sorcerer »
  assets/combat/sleeves/s_choc.webp            Pass, palier 8 : « Le Choc »

Comme les tapis de la Boutique (tools/cosmetiques.py), ils partent
d'illustrations du jeu, pas d'un dessin invente :
  - Le Choc des Sections : Gotaga Pose (#060, Deter) en haut, chez
    l'adversaire ; Squeezie le Toxique (#012) en bas, chez soi. Chacun teinte
    a la couleur de sa Section, une coupe lumineuse en biais entre les deux.
  - The French Sorcerer : l'illustration de la carte #116, en grand du haut
    jusqu'au milieu, fondue ensuite dans le violet sombre de son ciel.
  - Le Choc (sleeve) : le dos officiel des cartes (assets/card-back.webp),
    recolore moitie vert, moitie violet, la meme coupe en diagonale.
Les memes reperes que les autres tapis : bords sombres, bande plus sombre au
milieu, filet interieur. Necessite Pillow, avec l'AVIF (les cartes)."""
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'combat')
CARTES = os.path.join(ROOT, 'cards')
W, H = 720, 1280
NUIT = (8, 5, 12)
# Les couleurs des Sections (js/combat/campagne.js, SECTIONS) : sombre,
# milieu, clair, pour recolorer une image en degrade.
VERT = ((4, 26, 10), (56, 194, 60), (226, 255, 212))
VIOLET = ((16, 6, 40), (124, 58, 237), (241, 235, 255))

# L'illustration d'une carte : le rectangle sous le titre, au-dessus du
# bandeau « Joueur · Def » (gabarit commun des cartes, 1000 x 1397).
ILLU = (85, 205, 895, 684)
SQUEEZIE = ('012_PC_Joueur_Rose_Squeezie-Le-Toxique.avif', (85, 222, 895, 684))
GOTAGA = ('060_E_Joueur_Mauve_Gotaga-Pose.avif', ILLU)
SORCIER = ('116_L_Joueur_Mauve_The-French-Sorcerer.avif', ILLU)


def dossier(*p):
    d = os.path.join(OUT, *p)
    os.makedirs(d, exist_ok=True)
    return d


def illustration(carte):
    fichier, boite = carte
    return Image.open(os.path.join(CARTES, fichier)).convert('RGB').crop(boite)


def couvrir(im, w, h, cx=.5, cy=.5):
    """Remplit w x h sans deformer ; (cx, cy) : le point garde au centre."""
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = round((im.width - w) * cx)
    y = round((im.height - h) * cy)
    return im.crop((x, y, x + w, y + h))


def teinter(im, teinte, force):
    """Pousse une image vers la couleur d'une Section, sans perdre son dessin."""
    sombre, milieu, clair = teinte
    col = ImageOps.colorize(ImageOps.grayscale(im), sombre, clair, milieu)
    return Image.blend(im, col, force)


def coupe(taille, a, b, couleurs, epaisseur=3):
    """La coupe lumineuse de a a b : un trait blanc, et une lueur de chaque
    couleur de part et d'autre. Renvoie un calque RGBA."""
    calque = Image.new('RGBA', taille, (0, 0, 0, 0))
    for couleur, decal, largeur, flou in ((couleurs[0], -6, 16, 14), (couleurs[1], 6, 16, 14), ((255, 255, 255), 0, 9, 7)):
        l = Image.new('RGBA', taille, couleur + (0,))
        m = Image.new('L', taille, 0)
        ImageDraw.Draw(m).line((a[0], a[1] + decal, b[0], b[1] + decal), fill=200, width=largeur)
        l.putalpha(m.filter(ImageFilter.GaussianBlur(flou)))
        calque = Image.alpha_composite(calque, l)
    ImageDraw.Draw(calque).line((a, b), fill=(255, 255, 255, 255), width=epaisseur)
    return calque


def finitions(im, bande=95):
    """Les reperes communs a tous les tapis : vignette, frontiere, filet."""
    noir = Image.new('RGB', (W, H), NUIT)
    vign = Image.new('L', (W, H), 0)
    dv = ImageDraw.Draw(vign)
    for i in range(48):
        t = i / 48
        dv.rounded_rectangle((t * W * .22, t * H * .16, W - t * W * .22, H - t * H * .16), radius=60,
                             outline=round(200 * (1 - t) ** 2.2), width=7)
    im = Image.composite(noir, im, vign.filter(ImageFilter.GaussianBlur(26)))
    if bande:
        b = Image.new('L', (W, H), 0)
        ImageDraw.Draw(b).rectangle((0, H * .5 - 60, W, H * .5 + 60), fill=bande)
        im = Image.composite(noir, im, b.filter(ImageFilter.GaussianBlur(40)))
    return im


def filet(im):
    f = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(f)
    df.rounded_rectangle((16, 16, W - 17, H - 17), radius=34, outline=(255, 236, 250, 60), width=2)
    df.rounded_rectangle((24, 24, W - 25, H - 25), radius=28, outline=(255, 236, 250, 22), width=1)
    return Image.alpha_composite(im.convert('RGBA'), f).convert('RGB')


def enregistrer_tapis(im, cle):
    d = dossier('tapis')
    im.save(os.path.join(d, cle + '.webp'), 'WEBP', quality=82, method=6)
    im.resize((180, 320), Image.LANCZOS).save(os.path.join(d, cle + '-mini.webp'), 'WEBP', quality=84, method=6)
    print('tapis', cle, os.path.getsize(os.path.join(d, cle + '.webp')) // 1024, 'Ko')


# ------------------------------------------------- Le Choc des Sections
def choc_des_sections():
    """Deter en haut, Toxique en bas ; la coupe passe en biais au milieu."""
    haut = couvrir(illustration(GOTAGA), W, 760, cx=.52, cy=.5)
    haut = ImageEnhance.Contrast(ImageEnhance.Brightness(haut).enhance(.56)).enhance(1.15)
    haut = teinter(haut, ((10, 4, 28), (96, 40, 200), (226, 214, 255)), .4)
    bas = couvrir(illustration(SQUEEZIE), W, 760, cx=.4, cy=.35)
    bas = teinter(ImageEnhance.Brightness(bas).enhance(.85), VERT, .35)
    im = Image.new('RGB', (W, H), NUIT)
    im.paste(bas, (0, H - 760))
    a, b = (0, 668), (W, 612)
    masque = Image.new('L', (W, H), 0)
    ImageDraw.Draw(masque).polygon([(0, 0), (W, 0), b, a], fill=255)
    toile = Image.new('RGB', (W, H), NUIT)
    toile.paste(haut, (0, 0))
    im = Image.composite(toile, im, masque)
    im = finitions(im, bande=70)
    im = Image.alpha_composite(im.convert('RGBA'), coupe((W, H), a, b, ((196, 181, 253), (183, 242, 154)))).convert('RGB')
    enregistrer_tapis(filet(im), 't_arene')


# ------------------------------------------------- The French Sorcerer
def french_sorcerer():
    """L'illustration en grand dans le camp du haut et jusqu'au milieu ;
    elle se fond ensuite dans le violet sombre de son ciel."""
    art = illustration(SORCIER)
    fond = couvrir(art, W, H, cx=.45, cy=.5).filter(ImageFilter.GaussianBlur(30))
    fond = teinter(ImageEnhance.Brightness(fond).enhance(.42), VIOLET, .45)
    grand = couvrir(art, W, 860, cx=.42, cy=.5).filter(ImageFilter.UnsharpMask(2, 60, 2))
    grand = ImageEnhance.Brightness(grand).enhance(.84)
    m = Image.new('L', grand.size, 255)
    dm = ImageDraw.Draw(m)
    for y in range(260):
        dm.line((0, grand.height - 1 - y, W, grand.height - 1 - y), fill=round(255 * (y / 260) ** 1.4))
    fond.paste(grand, (0, 0), m)
    im = finitions(fond)
    enregistrer_tapis(filet(im), 't_orage')


# ------------------------------------------------- La sleeve
def sleeve():
    """Le dos officiel, recolore : vert a gauche, violet a droite."""
    dos = Image.open(os.path.join(ROOT, 'assets', 'card-back.webp')).convert('RGBA')
    w, h = 360, round(360 * dos.height / dos.width)
    dos = dos.resize((w, h), Image.LANCZOS)
    alpha = dos.getchannel('A')
    gris = ImageEnhance.Contrast(ImageOps.grayscale(dos.convert('RGB'))).enhance(1.25)
    vert = ImageOps.colorize(gris, (3, 20, 8), (214, 250, 196), (40, 150, 48))
    violet = ImageOps.colorize(gris, (12, 4, 32), (232, 224, 255), (102, 44, 206))
    a, b = (round(w * .64), 0), (round(w * .36), h)
    masque = Image.new('L', (w, h), 0)
    ImageDraw.Draw(masque).polygon([(0, 0), a, b, (0, h)], fill=255)
    im = Image.composite(vert, violet, masque).convert('RGBA')
    im = Image.alpha_composite(im, coupe((w, h), a, b, ((183, 242, 154), (196, 181, 253)), epaisseur=2))
    im.putalpha(alpha)
    d = dossier('sleeves')
    im.save(os.path.join(d, 's_choc.webp'), 'WEBP', quality=86, method=6)
    print('sleeve s_choc', (w, h))


if __name__ == '__main__':
    choc_des_sections()
    french_sorcerer()
    sleeve()
