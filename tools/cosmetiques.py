#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique les visuels de la version 3.0 a partir des originaux de _sources/combat/.

    python3 tools/cosmetiques.py

Ecrit :
  assets/combat/tapis/<id>.webp        les tapis de jeu, au format du plateau
  assets/combat/tapis/<id>-mini.webp   leur vignette, pour la boutique
  assets/combat/sleeves/<id>.webp      les dos de carte (sleeves)
  assets/combat/sections/<id>.webp     les boites des Starter Decks, detourees
  cards/<num>_S_....avif               les Secretes

Les originaux restent dans _sources/ (non publie). A relancer si l'un d'eux
change. Necessite Pillow (pip install pillow)."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_sources', 'combat')
OUT = os.path.join(ROOT, 'assets', 'combat')


def dossier(*p):
    d = os.path.join(OUT, *p)
    os.makedirs(d, exist_ok=True)
    return d


# ---------------------------------------------------------------- tapis
# Le plateau est en portrait (9:16), comme un telephone tenu en main. Un
# tapis, c'est l'illustration, assombrie pour que les cartes s'y lisent, une
# vignette sur les bords, une bande plus sombre au milieu (la frontiere entre
# les deux camps) et un filet fin a l'interieur du bord, comme la couture
# d'un vrai tapis. Les emplacements des cartes sont dessines par la page
# (css/combat.css), pas dans l'image : ils suivent la mise en page.
W, H = 720, 1280

TAPIS = {
    't_chateau':   ('tapis-chateau.jpg',     dict(lum=.74, sat=1.05, cadrage=.42)),
    't_reverie':   ('tapis-reverie.webp',    dict(lum=.72, sat=1.1,  cadrage=.5)),
    't_chevalier': ('tapis-chevalier.webp',  dict(lum=.86, sat=1.05, cadrage=.4)),
    't_veste':     ('tapis-veste-rose.webp', dict(lum=.62, sat=.95,  cadrage=.45)),
    't_pilote':    ('tapis-pilote.webp',     dict(lum=.68, sat=1.0,  cadrage=.5)),
    't_peche':     ('tapis-peche.webp',      dict(lum=.68, sat=1.05, cadrage=.5)),
}


def couvrir(im, w, h, cadrage=.5):
    """Remplit w x h sans deformer ; `cadrage` choisit la hauteur gardee."""
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2
    y = round((im.height - h) * cadrage)
    return im.crop((x, y, x + w, y + h))


def degrade_radial(w, h, centre=.0, bord=.6):
    """Un masque sombre aux bords (vignette)."""
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    pas = 60
    for i in range(pas):
        t = i / pas
        a = round(255 * (centre + (bord - centre) * (1 - t) ** 2))
        dx, dy = w * t * .5, h * t * .5
        d.ellipse((-w * .25 + dx, -h * .2 + dy, w * 1.25 - dx, h * 1.2 - dy), fill=a)
    return m.filter(ImageFilter.GaussianBlur(40))


def tapis(cle, fichier, o):
    im = Image.open(os.path.join(SRC, fichier)).convert('RGB')
    im = couvrir(im, W, H, o['cadrage'])
    im = ImageEnhance.Color(im).enhance(o['sat'])
    im = ImageEnhance.Brightness(im).enhance(o['lum'])
    im = ImageEnhance.Contrast(im).enhance(1.06)
    noir = Image.new('RGB', (W, H), (8, 5, 12))
    # Vignette : les bords plongent dans le noir de la page.
    vign = Image.new('L', (W, H), 0)
    dv = ImageDraw.Draw(vign)
    for i in range(48):
        t = i / 48
        a = round(190 * (1 - t) ** 2.2)
        dv.rounded_rectangle((t * W * .22, t * H * .16, W - t * W * .22, H - t * H * .16), radius=60, outline=a, width=7)
    vign = vign.filter(ImageFilter.GaussianBlur(26))
    im = Image.composite(noir, im, vign)
    # La frontiere : une bande sombre et douce a mi-hauteur.
    bande = Image.new('L', (W, H), 0)
    db = ImageDraw.Draw(bande)
    db.rectangle((0, H * .5 - 70, W, H * .5 + 70), fill=120)
    bande = bande.filter(ImageFilter.GaussianBlur(46))
    im = Image.composite(noir, im, bande)
    # Le filet interieur, comme une couture.
    filet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(filet)
    df.rounded_rectangle((16, 16, W - 17, H - 17), radius=34, outline=(255, 236, 250, 60), width=2)
    df.rounded_rectangle((24, 24, W - 25, H - 25), radius=28, outline=(255, 236, 250, 22), width=1)
    df.line((60, H // 2, W - 60, H // 2), fill=(255, 236, 250, 38), width=2)
    im = Image.alpha_composite(im.convert('RGBA'), filet).convert('RGB')
    d = dossier('tapis')
    im.save(os.path.join(d, cle + '.webp'), 'WEBP', quality=80, method=6)
    im.resize((180, 320), Image.LANCZOS).save(os.path.join(d, cle + '-mini.webp'), 'WEBP', quality=82, method=6)
    print('tapis', cle, os.path.getsize(os.path.join(d, cle + '.webp')) // 1024, 'Ko')


# ---------------------------------------------------------------- sleeves
# Les photos montrent la sleeve sur fond clair, une carte qui depasse en
# haut. On garde le rectangle de la sleeve seule, sous la carte.
SLEEVES = {
    's_sorcier': ('sleeve-sorcier.jpg', (328, 145, 851, 868)),
    's_argent':  ('sleeve-argent.jpg',  (328, 215, 851, 939)),
}


def sleeve(cle, fichier, boite):
    im = Image.open(os.path.join(SRC, fichier)).convert('RGB').crop(boite)
    im = im.resize((360, round(360 * im.height / im.width)), Image.LANCZOS)
    d = dossier('sleeves')
    im.save(os.path.join(d, cle + '.webp'), 'WEBP', quality=84, method=6)
    print('sleeve', cle, im.size)


# ---------------------------------------------------------------- boites
# Les Starter Decks, detoures : le fond gris clair devient transparent.
def detourer(fichier, cle):
    im = Image.open(os.path.join(SRC, fichier)).convert('RGBA')
    fond = im.getpixel((4, 4))[:3]
    masque = Image.new('L', im.size, 0)
    px = im.load()
    w, h = im.size
    # Remplissage depuis les bords : tout ce qui touche le fond par un chemin
    # de pixels proches du gris de fond.
    vu = bytearray(w * h)
    pile = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    pm = masque.load()
    while pile:
        x, y = pile.pop()
        i = y * w + x
        if vu[i]:
            continue
        vu[i] = 1
        r, g, b, _ = px[x, y]
        if abs(r - fond[0]) + abs(g - fond[1]) + abs(b - fond[2]) > 26:
            continue
        pm[x, y] = 255
        if x > 0: pile.append((x - 1, y))
        if x < w - 1: pile.append((x + 1, y))
        if y > 0: pile.append((x, y - 1))
        if y < h - 1: pile.append((x, y + 1))
    masque = masque.filter(ImageFilter.GaussianBlur(1.2))
    alpha = Image.eval(masque, lambda v: 255 - v)
    im.putalpha(alpha)
    im = im.crop(im.getbbox())
    im = im.resize((560, round(560 * im.height / im.width)), Image.LANCZOS)
    d = dossier('sections')
    im.save(os.path.join(d, cle + '.webp'), 'WEBP', quality=84, method=6)
    print('boite', cle, im.size)


# ---------------------------------------------------------------- Secretes
SECRETES = [
    ('secrete-123.jpg', '123_S_Joueur_Orange_Le-Quatrieme-du-Nom.avif'),
    ('secrete-floue-a.jpg', '124_S_Secrete.avif'),
    ('secrete-125.jpg', '125_S_Joueur_Mauve_6W26L.avif'),
    ('secrete-floue-b.jpg', '126_S_Secrete.avif'),
    ('secrete-floue-c.jpg', '127_S_Secrete.avif'),
]


def secrete(fichier, sortie):
    im = Image.open(os.path.join(SRC, fichier)).convert('RGB')
    if im.width < 1000:
        im = im.resize((1000, 1397), Image.LANCZOS)
    else:
        im = im.resize((1000, 1397), Image.LANCZOS)
    p = os.path.join(ROOT, 'cards', sortie)
    im.save(p, 'AVIF', quality=62)
    print('secrete', sortie, os.path.getsize(p) // 1024, 'Ko')


if __name__ == '__main__':
    for k, (f, o) in TAPIS.items():
        tapis(k, f, o)
    for k, (f, b) in SLEEVES.items():
        sleeve(k, f, b)
    detourer('starter-toxique.jpg', 'toxique')
    detourer('starter-deter.jpg', 'deter')
    for f, s in SECRETES:
        secrete(f, s)
