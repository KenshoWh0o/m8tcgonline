# -*- coding: utf-8 -*-
"""Genere les icones de l'application, le favicon et l'image de partage.

    python3.13 tools/gen-icons.py

Ecrit dans assets/ : icon-192, icon-512, icon-maskable-512, apple-touch-icon,
favicon-16, favicon-32, favicon.svg et og-image (1200 x 630, l'image qu'on
voit quand le lien du site est partage). A relancer si le logo ou la charte
changent.

Version 3.0.11 : la palette « Graphite et lavande » (css/tokens.css,
docs/design-3.0.md) remplace le prune et l'orchidee de la 2.x. L'icone :
l'etoile du logo (le meme trace que ICON.star dans js/config.js), en
degrade du blanc a la lavande, sur le graphite eclaire d'une lueur lavande.
L'image de partage : le logo du jeu (il garde ses couleurs : la marque ne
sert plus qu'au logo), cinq Legendaires en eventail, une phrase, l'adresse.

Necessite Pillow, avec le WebP et l'AVIF (le logo, les cartes) : sur ce
poste, celui de python3.13. Les polices viennent de presse/polices/. Avant
la 3.0.11, le script se passait de toute bibliotheque mais appelait `sips`
(macOS) pour lire le logo."""
import os
import re
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
CARTES = os.path.join(ROOT, 'cards')
POLICES = os.path.join(ROOT, 'presse', 'polices')

# ---------- Couleurs de la charte (css/tokens.css) ----------
BG = (0x12, 0x11, 0x19)        # --bg
SURFACE = (0x1c, 0x1b, 0x25)   # --surface
ACCENT = (0x8a, 0x78, 0xf5)    # --accent
SOFT = (0xb3, 0xa6, 0xff)      # --accent-soft
DECO = (0xc8, 0xbf, 0xff)      # --deco-ink
TEXT = (0xf1, 0xf0, 0xf8)      # --text
SUBTLE = (0xc4, 0xc1, 0xd6)    # --subtle
MUTED = (0x9a, 0x97, 0xae)     # --muted

# ---------- L'etoile du logo (ICON.star, js/config.js : viewBox 20 x 14) ----------
ETOILE = ('M8.13814 0L8.07808 0.158491L6.03604 5.54717L0.21021 6.63019L0 6.68302L0.21021 6.73585L4.8949 8.10943'
          'L1.95195 13.7623L1.83183 14L2.04204 13.8151L7.92793 8.98113L12.6426 10.3547H12.7628L12.7027 10.2755'
          'L10.9009 6.97358L19.6096 1.90189L20 1.66415L19.5496 1.79623L9.75976 4.80755L8.1982 0.158491L8.13814 0Z')


def points_etoile():
    """Le trace (M, L, H, Z, en absolu) en liste de points."""
    pts, x, y = [], 0.0, 0.0
    for cmd, args in re.findall(r'([MLHZ])([^MLHZ]*)', ETOILE):
        v = [float(t) for t in re.findall(r'-?\d*\.?\d+', args)]
        if cmd in 'ML':
            for i in range(0, len(v), 2):
                x, y = v[i], v[i + 1]
                pts.append((x, y))
        elif cmd == 'H':
            for vx in v:
                x = vx
                pts.append((x, y))
    return pts


def masque_etoile(taille, cx, cy, largeur, angle=-3.5, ss=4):
    """Le masque (L) de l'etoile : centree en (cx, cy), `largeur` pixels de
    large, tournee de `angle` degres. Dessinee a ss x puis reduite : bords
    lisses."""
    import math
    W, H = taille
    m = Image.new('L', (W * ss, H * ss), 0)
    pts = points_etoile()
    k = largeur / 20.0
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    poly = []
    for px, py in pts:
        dx, dy = (px - 10) * k, (py - 7) * k
        rx, ry = dx * ca - dy * sa, dx * sa + dy * ca
        poly.append(((cx + rx) * ss, (cy + ry) * ss))
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m.resize((W, H), Image.LANCZOS)


def degrade(taille, haut_gauche, milieu, bas_droite):
    """Un degrade en diagonale, du haut a gauche au bas a droite."""
    W, H = taille
    petit = Image.new('RGB', (64, 64))
    px = petit.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126.0
            if t < .5:
                u = t / .5
                c = tuple(round(haut_gauche[i] + (milieu[i] - haut_gauche[i]) * u) for i in range(3))
            else:
                u = (t - .5) / .5
                c = tuple(round(milieu[i] + (bas_droite[i] - milieu[i]) * u) for i in range(3))
            px[x, y] = c
    return petit.resize((W, H), Image.BICUBIC)


def fond(taille, lueur_y=.32, force=.5):
    """Le graphite, avec la lueur lavande en haut (comme le fond du site)."""
    W, H = taille
    im = Image.new('RGB', (W, H), BG)
    lueur = Image.new('L', (W, H), 0)
    r = max(W, H) * .62
    ImageDraw.Draw(lueur).ellipse((W / 2 - r, H * lueur_y - r, W / 2 + r, H * lueur_y + r), fill=round(255 * force))
    lueur = lueur.filter(ImageFilter.GaussianBlur(max(W, H) * .22))
    teinte = Image.new('RGB', (W, H), (0x3a, 0x30, 0x7a))
    im = Image.composite(teinte, im, lueur)
    # Un peu plus sombre en bas.
    bas = Image.linear_gradient('L').resize((W, H))
    noir = Image.new('RGB', (W, H), (0x0b, 0x0a, 0x10))
    return Image.composite(noir, im, bas.point(lambda v: round(v * .45)))


def etoile_sur(im, cx, cy, largeur, lueur=True):
    """Pose l'etoile du logo : sa lueur lavande, puis l'etoile en degrade du
    blanc a la lavande."""
    m = masque_etoile(im.size, cx, cy, largeur)
    if lueur:
        halo = m.filter(ImageFilter.GaussianBlur(largeur * .09))
        im.paste(Image.new('RGB', im.size, ACCENT), (0, 0), halo.point(lambda v: round(v * .85)))
        halo2 = m.filter(ImageFilter.GaussianBlur(largeur * .03))
        im.paste(Image.new('RGB', im.size, DECO), (0, 0), halo2.point(lambda v: round(v * .5)))
    im.paste(degrade(im.size, (255, 255, 255), DECO, ACCENT), (0, 0), m)
    return im


def icone(taille, largeur, coins=0):
    im = fond((taille, taille), .3, .55)
    etoile_sur(im, taille * .5, taille * .52, largeur)
    if coins:
        masque = Image.new('L', (taille * 4, taille * 4), 0)
        ImageDraw.Draw(masque).rounded_rectangle((0, 0, taille * 4 - 1, taille * 4 - 1), radius=coins * 4, fill=255)
        rgba = im.convert('RGBA')
        rgba.putalpha(masque.resize((taille, taille), Image.LANCZOS))
        return rgba
    return im


def enregistrer(im, nom):
    chemin = os.path.join(OUT, nom)
    im.save(chemin, optimize=True)
    print(nom, im.size, os.path.getsize(chemin) // 1024, 'Ko')


# ---------- Les icones ----------
# « any » : l'etoile occupe une bonne part du carre ; « maskable » : elle tient
# dans la zone sure (le cercle central de 80 %), le systeme rogne le reste.
enregistrer(icone(512, 330), 'icon-512.png')
enregistrer(icone(192, 124), 'icon-192.png')
enregistrer(icone(512, 250), 'icon-maskable-512.png')
enregistrer(icone(180, 116), 'apple-touch-icon.png')
enregistrer(icone(32, 26, coins=7), 'favicon-32.png')
enregistrer(icone(16, 14, coins=3), 'favicon-16.png')

# Le favicon vectoriel : le meme dessin, a la main.
SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- L'etoile du logo Mate TCG, sur le graphite de la charte 3.0 (tools/gen-icons.py). -->
  <defs>
    <radialGradient id="f" cx="50%" cy="30%" r="75%">
      <stop offset="0" stop-color="#3a307a"/>
      <stop offset=".55" stop-color="#1c1b25"/>
      <stop offset="1" stop-color="#0d0c12"/>
    </radialGradient>
    <linearGradient id="e" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".5" stop-color="#c8bfff"/>
      <stop offset="1" stop-color="#8a78f5"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#f)"/>
  <g transform="translate(32 33.5) rotate(-3.5) scale(2.45) translate(-10 -7)">
    <path fill="url(#e)" d="{ETOILE}"/>
  </g>
</svg>
'''
with open(os.path.join(OUT, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(SVG)
print('favicon.svg')

# ---------- L'image de partage (Open Graph / Twitter) ----------
W, H = 1200, 630
og = fond((W, H), .05, .42).convert('RGBA')

# Cinq Legendaires en eventail, a droite.
EVENTAIL = ['116_L_Joueur_Mauve_The-French-Sorcerer.avif', '113_L_Joueur_Rose_Kampai.avif',
            '122_L_Objet-Lien_Neutre_La-Luxueuse-III.avif', '121_L_Joueur_Neutre_Le-Marionnettiste.avif',
            '120_L_Joueur_Neutre_BrawksSaga.avif']
cw = 192
ch = round(cw * 1397 / 1000)
centre = (912, 330)
for i, fichier in enumerate(EVENTAIL):
    k = i - 2
    carte = Image.open(os.path.join(CARTES, fichier)).convert('RGBA').resize((cw, ch), Image.LANCZOS)
    coins = Image.new('L', (cw * 4, ch * 4), 0)
    ImageDraw.Draw(coins).rounded_rectangle((0, 0, cw * 4 - 1, ch * 4 - 1), radius=round(cw * .055) * 4, fill=255)
    carte.putalpha(coins.resize((cw, ch), Image.LANCZOS))
    angle = -k * 8
    tourne = carte.rotate(angle, resample=Image.BICUBIC, expand=True)
    x = round(centre[0] + k * 74 - tourne.width / 2)
    y = round(centre[1] + abs(k) * 16 - tourne.height / 2)
    ombre = Image.new('RGBA', tourne.size, (0, 0, 0, 0))
    ombre.putalpha(tourne.getchannel('A').point(lambda v: round(v * .55)))
    ombre = ombre.filter(ImageFilter.GaussianBlur(14))
    og.alpha_composite(ombre, (x + 6, y + 16))
    og.alpha_composite(tourne, (x, y))

# Le logo, a gauche.
logo = Image.open(os.path.join(OUT, 'logo-m8.webp')).convert('RGBA')
lw = 470
logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
og.alpha_composite(logo, (66, 112))

d = ImageDraw.Draw(og)
titre = ImageFont.truetype(os.path.join(POLICES, 'Archivo-Italic.ttf'), 46)
try:
    titre.set_variation_by_axes([900, 112])
except Exception:
    pass
texte = ImageFont.truetype(os.path.join(POLICES, 'Figtree.ttf'), 27)
try:
    texte.set_variation_by_axes([600])
except Exception:
    pass
petit = ImageFont.truetype(os.path.join(POLICES, 'Figtree.ttf'), 24)
try:
    petit.set_variation_by_axes([800])
except Exception:
    pass
d.text((74, 382), 'Ouvre. Collectionne.', font=titre, fill=TEXT)
d.text((74, 434), 'Affronte.', font=titre, fill=SOFT)
d.text((76, 504), 'Le jeu de cartes de la communauté M8.', font=texte, fill=SUBTLE)
d.text((76, 548), 'matetcg.com', font=petit, fill=MUTED)
# Un filet lavande en bas, qui s'eteint sur les bords.
filet = Image.linear_gradient('L').rotate(90, expand=True).resize((W, 4))
filet = filet.point(lambda v: round(255 * (1 - abs(v / 127.5 - 1)) ** .7))
og.paste(Image.new('RGBA', (W, 4), ACCENT + (255,)), (0, H - 4), filet)
enregistrer(og.convert('RGB'), 'og-image.png')
