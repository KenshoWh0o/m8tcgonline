#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique les cosmetiques exclusifs de l'evenement 3.0 « Le Choc des Sections ».

    python3 tools/choc-visuels.py

Ecrit :
  assets/combat/tapis/t_arene.webp (+ -mini)    Pass, palier 20
  assets/combat/tapis/t_theatre.webp (+ -mini)  boutique de l'evenement
  assets/combat/sleeves/s_choc.webp             Pass, palier 8

Contrairement aux tapis de tools/cosmetiques.py, ceux-ci ne partent d'aucune
illustration : ils sont dessines ici, aux couleurs des deux Sections (le rose
Toxique, le mauve Deter). Les memes reperes que les autres tapis : bords
sombres, bande plus sombre au milieu, filet interieur. Necessite Pillow."""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'combat')
W, H = 720, 1280
ROSE = (238, 0, 115)
ROSE2 = (255, 154, 213)
MAUVE = (137, 54, 255)
MAUVE2 = (201, 168, 255)
NUIT = (10, 6, 16)
OR = (255, 199, 59)


def dossier(*p):
    d = os.path.join(OUT, *p)
    os.makedirs(d, exist_ok=True)
    return d


def police(taille):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
              '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, taille)
    return ImageFont.load_default()


def melange(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lueur(taille, centre, rayon, couleur, force, flou):
    """Une tache de lumiere coloree, a ajouter par-dessus."""
    calque = Image.new('RGBA', taille, couleur + (0,))
    m = Image.new('L', taille, 0)
    ImageDraw.Draw(m).ellipse((centre[0] - rayon[0], centre[1] - rayon[1], centre[0] + rayon[0], centre[1] + rayon[1]),
                              fill=round(255 * force))
    calque.putalpha(m.filter(ImageFilter.GaussianBlur(flou)))
    return calque


def finitions(im):
    """Les reperes communs a tous les tapis : vignette, frontiere, filet."""
    noir = Image.new('RGB', (W, H), NUIT)
    vign = Image.new('L', (W, H), 0)
    dv = ImageDraw.Draw(vign)
    for i in range(48):
        t = i / 48
        a = round(200 * (1 - t) ** 2.2)
        dv.rounded_rectangle((t * W * .22, t * H * .16, W - t * W * .22, H - t * H * .16), radius=60, outline=a, width=7)
    im = Image.composite(noir, im, vign.filter(ImageFilter.GaussianBlur(26)))
    bande = Image.new('L', (W, H), 0)
    ImageDraw.Draw(bande).rectangle((0, H * .5 - 60, W, H * .5 + 60), fill=95)
    im = Image.composite(noir, im, bande.filter(ImageFilter.GaussianBlur(40)))
    filet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(filet)
    df.rounded_rectangle((16, 16, W - 17, H - 17), radius=34, outline=(255, 236, 250, 60), width=2)
    df.rounded_rectangle((24, 24, W - 25, H - 25), radius=28, outline=(255, 236, 250, 22), width=1)
    return Image.alpha_composite(im.convert('RGBA'), filet).convert('RGB')


def enregistrer_tapis(im, cle):
    d = dossier('tapis')
    im.save(os.path.join(d, cle + '.webp'), 'WEBP', quality=82, method=6)
    im.resize((180, 320), Image.LANCZOS).save(os.path.join(d, cle + '-mini.webp'), 'WEBP', quality=84, method=6)
    print('tapis', cle, os.path.getsize(os.path.join(d, cle + '.webp')) // 1024, 'Ko')


def eclair(d, points, couleur, largeur):
    d.line(points, fill=couleur, width=largeur, joint='curve')


def ligne_brisee(rand, x0, x1, y, amp, pas):
    pts = []
    x = x0
    while x <= x1:
        pts.append((x, y + rand.uniform(-amp, amp)))
        x += pas * rand.uniform(.6, 1.3)
    pts.append((x1, y))
    return pts


# ------------------------------------------------------------ L'Arene
def arene():
    """Le camp du haut au mauve Deter, celui du bas au rose Toxique, et entre
    les deux une faille d'energie. Au sol, les anneaux d'une arene, et deux
    projecteurs qui tombent du plafond."""
    rand = random.Random(30)
    im = Image.new('RGB', (W, H), NUIT)
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        haut = melange((40, 12, 84), (22, 8, 40), min(1, t * 2))
        bas = melange((26, 6, 22), (70, 4, 40), max(0, t * 2 - 1))
        c = haut if t < .5 else bas
        for x in range(W):
            px[x, y] = c
    im = im.convert('RGBA')
    # Deux projecteurs, un par camp.
    im = Image.alpha_composite(im, lueur((W, H), (W * .5, H * .22), (330, 260), MAUVE, .55, 70))
    im = Image.alpha_composite(im, lueur((W, H), (W * .5, H * .78), (330, 260), ROSE, .5, 70))
    # Le sol de l'arene : des anneaux concentriques, et des rayons.
    sol = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sol)
    cx, cy = W / 2, H / 2
    for i, r in enumerate((120, 210, 300, 400, 520, 660)):
        a = 70 - i * 8
        ds.ellipse((cx - r, cy - r * .62, cx + r, cy + r * .62), outline=(255, 255, 255, a), width=2)
    for k in range(16):
        ang = k * math.pi / 8
        ds.line((cx + math.cos(ang) * 130, cy + math.sin(ang) * 130 * .62,
                 cx + math.cos(ang) * 700, cy + math.sin(ang) * 700 * .62), fill=(255, 255, 255, 18), width=1)
    im = Image.alpha_composite(im, sol.filter(ImageFilter.GaussianBlur(.6)))
    # Les hexagones d'un ecran de tournoi, tres discrets.
    hexa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dh = ImageDraw.Draw(hexa)
    r = 34
    for row in range(-1, int(H / (r * 1.5)) + 2):
        for col in range(-1, int(W / (r * 1.73)) + 2):
            x = col * r * 1.732 + (r * .866 if row % 2 else 0)
            y = row * r * 1.5
            c = MAUVE2 if y < H / 2 else ROSE2
            a = 16 if abs(y - H / 2) > 180 else 6
            pts = [(x + r * math.cos(math.pi / 6 + k * math.pi / 3), y + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
            dh.polygon(pts, outline=c + (a,))
    im = Image.alpha_composite(im, hexa)
    # La faille : un eclair horizontal, avec son halo.
    halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(halo)
    pts = ligne_brisee(rand, -10, W + 10, H / 2, 26, 60)
    eclair(dl, pts, (255, 140, 220, 255), 26)
    im = Image.alpha_composite(im, halo.filter(ImageFilter.GaussianBlur(18)))
    trait = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dt = ImageDraw.Draw(trait)
    eclair(dt, pts, (255, 220, 245, 230), 4)
    for _ in range(9):
        i = rand.randrange(1, len(pts) - 1)
        x, y = pts[i]
        bx = [(x, y)]
        sens = rand.choice((-1, 1))
        for _ in range(3):
            x += rand.uniform(-30, 30)
            y += sens * rand.uniform(18, 40)
            bx.append((x, y))
        eclair(dt, bx, (255, 200, 240, 150), 2)
    im = Image.alpha_composite(im, trait)
    # Des etincelles.
    et = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    de = ImageDraw.Draw(et)
    for _ in range(140):
        x, y = rand.uniform(0, W), rand.gauss(H / 2, 160)
        s = rand.uniform(.8, 2.4)
        c = MAUVE2 if y < H / 2 else ROSE2
        de.ellipse((x - s, y - s, x + s, y + s), fill=c + (rand.randrange(60, 200),))
    im = Image.alpha_composite(im, et.filter(ImageFilter.GaussianBlur(.4)))
    enregistrer_tapis(finitions(im.convert('RGB')), 't_arene')


# ----------------------------------------------------------- Le Theatre
def theatre():
    """La scene du Marionnettiste : des rideaux de velours sur les cotes, un
    plancher, des fils d'or qui tombent des cintres, et la croix de bois du
    marionnettiste tout en haut."""
    rand = random.Random(121)
    im = Image.new('RGB', (W, H), NUIT)
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        c = melange((30, 10, 22), (16, 8, 14), abs(t - .5) * 2)
        for x in range(W):
            px[x, y] = c
    im = im.convert('RGBA')
    im = Image.alpha_composite(im, lueur((W, H), (W * .5, H * .62), (300, 380), OR, .26, 90))
    # Le plancher, sur la moitie basse.
    planc = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dp = ImageDraw.Draw(planc)
    for k in range(-14, 15):
        x0 = W / 2 + k * 40
        x1 = W / 2 + k * 130
        dp.line((x0, H * .52, x1, H + 20), fill=(255, 210, 150, 24), width=2)
    y = H * .52
    pas = 18
    while y < H:
        dp.line((0, y, W, y), fill=(255, 210, 150, 18), width=1)
        pas *= 1.18
        y += pas
    im = Image.alpha_composite(im, planc)
    # Les rideaux : des plis verticaux, rouge sombre, sur les deux bords.
    rid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(rid)
    for cote in (0, 1):
        for i in range(9):
            larg = 150 - i * 12
            x = (i * 15) if cote == 0 else W - i * 15
            for j in range(larg):
                t = j / larg
                ombre = .5 + .5 * math.cos(t * math.pi * 2 + i)
                c = melange((60, 4, 22), (150, 16, 60), ombre * (1 - i / 10))
                xx = x + j if cote == 0 else x - j
                if 0 <= xx < W:
                    dr.line((xx, 0, xx + (rand.uniform(-2, 2)), H), fill=c + (round(210 * (1 - t) ** .7 * (1 - i / 10)),))
    im = Image.alpha_composite(im, rid.filter(ImageFilter.GaussianBlur(3)))
    # Le lambrequin, en haut.
    lam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lam)
    for k in range(10):
        x0 = k * W / 10
        dl.pieslice((x0 - 10, -60, x0 + W / 10 + 10, 110), 0, 180, fill=(110, 10, 44, 200))
        dl.arc((x0 - 10, -60, x0 + W / 10 + 10, 110), 0, 180, fill=OR + (150,), width=3)
    im = Image.alpha_composite(im, lam.filter(ImageFilter.GaussianBlur(1)))
    # Les fils d'or, et la croix du marionnettiste.
    fils = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    df = ImageDraw.Draw(fils)
    cx, cy = W / 2, 120
    df.rounded_rectangle((cx - 120, cy - 7, cx + 120, cy + 7), radius=6, fill=(120, 80, 40, 230))
    df.rounded_rectangle((cx - 7, cy - 60, cx + 7, cy + 60), radius=6, fill=(120, 80, 40, 230))
    attaches = [(cx - 112, cy), (cx + 112, cy), (cx, cy - 52), (cx, cy + 52), (cx - 60, cy), (cx + 60, cy)]
    bouts = [(130, 640), (590, 640), (360, 360), (360, 900), (230, 1020), (490, 1020)]
    for (x0, y0), (x1, y1) in zip(attaches, bouts):
        df.line((x0, y0, x1, y1), fill=OR + (90,), width=2)
        df.ellipse((x1 - 5, y1 - 5, x1 + 5, y1 + 5), fill=OR + (150,))
    im = Image.alpha_composite(im, fils.filter(ImageFilter.GaussianBlur(4)))
    im = Image.alpha_composite(im, fils)
    # De la poussiere dans la lumiere.
    pd = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(pd)
    for _ in range(120):
        x, y = rand.gauss(W / 2, 150), rand.uniform(H * .2, H * .95)
        s = rand.uniform(.6, 2)
        dd.ellipse((x - s, y - s, x + s, y + s), fill=(255, 225, 170, rand.randrange(40, 150)))
    im = Image.alpha_composite(im, pd)
    enregistrer_tapis(finitions(im.convert('RGB')), 't_theatre')


# ----------------------------------------------------------- la sleeve
def sleeve():
    """Le dos des cartes : coupe en diagonale, rose et mauve, un eclair dans
    la coupure, et l'ecusson du Choc au milieu."""
    w, h = 360, 498
    rand = random.Random(8)
    im = Image.new('RGBA', (w, h), NUIT + (255,))
    px = im.load()
    for y in range(h):
        for x in range(w):
            d = (x / w - y / h)  # > 0 : en haut a droite
            if d > 0:
                c = melange((80, 30, 170), (34, 10, 72), min(1, d * 1.6))
            else:
                c = melange((150, 0, 72), (48, 4, 30), min(1, -d * 1.6))
            px[x, y] = c + (255,)
    # La coupure.
    pts = []
    for i in range(13):
        t = i / 12
        pts.append((t * w + rand.uniform(-8, 8), t * h + rand.uniform(-8, 8)))
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(halo).line(pts, fill=(255, 150, 225, 255), width=12, joint='curve')
    im = Image.alpha_composite(im, halo.filter(ImageFilter.GaussianBlur(9)))
    tr = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(tr).line(pts, fill=(255, 235, 250, 240), width=3, joint='curve')
    im = Image.alpha_composite(im, tr)
    # L'ecusson.
    ec = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    de = ImageDraw.Draw(ec)
    cx, cy = w / 2, h / 2
    bouclier = [(cx, cy - 92), (cx + 78, cy - 62), (cx + 70, cy + 30), (cx, cy + 96), (cx - 70, cy + 30), (cx - 78, cy - 62)]
    ombre = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(ombre).polygon([(x, y + 6) for x, y in bouclier], fill=(0, 0, 0, 150))
    im = Image.alpha_composite(im, ombre.filter(ImageFilter.GaussianBlur(8)))
    de.polygon(bouclier, fill=(18, 10, 28, 235), outline=OR + (255,))
    de.line(bouclier + [bouclier[0]], fill=OR + (255,), width=4, joint='curve')
    interieur = [(cx + (x - cx) * .84, cy + (y - cy) * .84) for x, y in bouclier]
    de.line(interieur + [interieur[0]], fill=OR + (120,), width=1)
    # Deux etoiles, une par Section, et l'eclair entre elles.
    def etoile(x, y, r, c):
        p = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * .45
            p.append((x + rr * math.cos(a), y + rr * math.sin(a)))
        de.polygon(p, fill=c)
    etoile(cx - 30, cy - 18, 24, ROSE + (255,))
    etoile(cx + 30, cy - 18, 24, MAUVE + (255,))
    de.polygon([(cx + 6, cy - 52), (cx - 10, cy - 8), (cx + 2, cy - 8), (cx - 8, cy + 26), (cx + 14, cy - 18), (cx + 2, cy - 18)],
               fill=(255, 240, 200, 255))
    f = police(19)
    texte = 'LE CHOC'
    tw = de.textlength(texte, font=f)
    de.text((cx - tw / 2, cy + 34), texte, font=f, fill=OR + (255,))
    im = Image.alpha_composite(im, ec)
    # Le bord dore.
    bord = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    db = ImageDraw.Draw(bord)
    db.rounded_rectangle((6, 6, w - 7, h - 7), radius=18, outline=OR + (220,), width=3)
    db.rounded_rectangle((14, 14, w - 15, h - 15), radius=12, outline=OR + (90,), width=1)
    im = Image.alpha_composite(im, bord)
    d = dossier('sleeves')
    im.convert('RGB').save(os.path.join(d, 's_choc.webp'), 'WEBP', quality=86, method=6)
    print('sleeve s_choc', (w, h))


if __name__ == '__main__':
    arene()
    theatre()
    sleeve()
