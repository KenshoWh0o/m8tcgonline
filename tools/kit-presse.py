#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique les visuels de promotion du jeu.

    python3 tools/kit-presse.py

Ce que ca fait : ecrit dans presse/visuels/ une serie d'images prete a poster,
aux formats de Twitter (paysage 16:9, carre, portrait 4:5), plus une animation
en GIF.

Pourquoi un script et pas des images faites a la main : parce qu'un visuel qui
vit dans le depot se refait. Le jour ou une carte change, ou l'extension
s'agrandit, ou l'adresse du site bouge, on relance le script. On ne rouvre pas
un logiciel de retouche pour corriger un chiffre.

Tout est compose a partir des vrais fichiers du jeu — les memes cartes, le meme
logo, les memes polices (presse/polices/). L'identite n'est pas imitee : elle
est reutilisee.
"""
import os, math, random

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(ROOT, 'presse', 'visuels')
POLICES = os.path.join(ROOT, 'presse', 'polices')

SITE = 'matetcg.com'
MENTION = ('Projet non affilié à Gentle Mates. '
           'Images utilisées à titre informatif.')

# ---------------------------------------------------------------- palette
NOIR      = (5, 2, 8)
PRUNE     = (44, 16, 64)
VIOLET    = (169, 92, 242)
VIOLET_F  = (137, 54, 255)
ROSE      = (238, 0, 115)
ROSE_PALE = (255, 215, 240)
BLANC     = (255, 255, 255)


# ================================================================ polices
def police(nom, taille, graisse=900, largeur=112):
    """Une police du jeu, a la graisse et a la chasse voulues.

    Archivo est une police variable : plutot que de choisir parmi des fichiers
    pre-decoupes, on regle les deux axes — graisse et largeur — exactement
    comme le fait la feuille de style du site (`font-stretch:112%`).
    """
    f = ImageFont.truetype(os.path.join(POLICES, nom), taille)
    try:
        f.set_variation_by_axes([graisse, largeur])
    except Exception:
        pass  # police non variable : on garde le reglage par defaut
    return f


TITRE = lambda t: police('Archivo-Italic.ttf', t, 900, 114)
GRAS  = lambda t: police('Figtree.ttf', t, 800, 100)
TEXTE = lambda t: police('Figtree.ttf', t, 500, 100)


# ================================================================= outils
def ouvrir(chemin, hauteur=None):
    im = Image.open(os.path.join(ROOT, chemin)).convert('RGBA')
    if hauteur:
        l = round(im.width * hauteur / im.height)
        im = im.resize((l, hauteur), Image.LANCZOS)
    return im


def coller(fond, im, cx, cy, rot=0, ombre=None):
    """Pose une image centree sur (cx, cy), avec rotation et ombre portee."""
    if rot:
        im = im.rotate(rot, Image.BICUBIC, expand=True)
    if ombre:
        rayon, dy, force = ombre
        o = Image.new('RGBA', (im.width + rayon * 4, im.height + rayon * 4), (0, 0, 0, 0))
        masque = im.split()[3]
        noir = Image.new('RGBA', im.size, (0, 0, 0, force))
        o.paste(noir, (rayon * 2, rayon * 2), masque)
        o = o.filter(ImageFilter.GaussianBlur(rayon))
        fond.alpha_composite(o, (round(cx - o.width / 2), round(cy - o.height / 2 + dy)))
    fond.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))


def texte(im, xy, txt, font, couleur=BLANC, ancre='mm', halo=None, interligne=1.15):
    """Du texte centre, avec au besoin une lueur derriere.

    La lueur est du texte **floute**, pas un contour epais : un contour suit la
    lettre et l'epaissit, une lueur s'en detache et eclaire ce qu'il y a autour.
    C'est la difference entre un effet de traitement de texte et une enseigne.
    """
    lignes = txt.split('\n')
    pas = font.size * interligne
    y0 = xy[1] - (len(lignes) - 1) * pas / 2

    if halo:
        lueur = Image.new('RGBA', im.size, (0, 0, 0, 0))
        dl = ImageDraw.Draw(lueur)
        for i, l in enumerate(lignes):
            dl.text((xy[0], y0 + i * pas), l, font=font, fill=halo + (170,), anchor=ancre)
        im.alpha_composite(lueur.filter(ImageFilter.GaussianBlur(24)))
        im.alpha_composite(lueur.filter(ImageFilter.GaussianBlur(10)))

    # Une ombre nette juste dessous : sans elle, le texte flotte au-dessus de
    # l'image au lieu d'y appartenir.
    ombre = Image.new('RGBA', im.size, (0, 0, 0, 0))
    do = ImageDraw.Draw(ombre)
    for i, l in enumerate(lignes):
        do.text((xy[0], y0 + i * pas + 3), l, font=font, fill=(0, 0, 0, 190), anchor=ancre)
    im.alpha_composite(ombre.filter(ImageFilter.GaussianBlur(5)))

    d = ImageDraw.Draw(im)
    for i, l in enumerate(lignes):
        d.text((xy[0], y0 + i * pas), l, font=font, fill=couleur, anchor=ancre)


def degrade_vertical(taille, haut, bas):
    l, h = taille
    g = Image.new('RGB', (1, h))
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(haut[i] + (bas[i] - haut[i]) * t) for i in range(3))
    return g.resize(taille, Image.BILINEAR).convert('RGBA')


def fond(l, h, foyer=.38):
    """Le fond commun : nappe prune, rayons lents, grain.

    C'est exactement la scene du jeu quand une carte se revele. Le visuel de
    promotion et l'ecran d'obtention doivent se ressembler, sinon la promesse
    faite sur Twitter n'est pas celle qu'on tient a l'ouverture.
    """
    im = degrade_vertical((l, h), (12, 5, 20), NOIR)

    cx, cy = l / 2, h * foyer

    # --- les rayons, en eventail depuis le foyer ---
    ray = Image.new('RGBA', (l, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ray)
    R = max(l, h) * 1.6
    for i in range(30):
        a0 = i * 12 + 1
        a1 = a0 + 2.6
        p = [(cx, cy)]
        for a in (a0, a1):
            r = math.radians(a)
            p.append((cx + math.cos(r) * R, cy + math.sin(r) * R))
        dr.polygon(p, fill=(255, 255, 255, 15))
    ray = ray.filter(ImageFilter.GaussianBlur(3))
    # Un masque radial : les rayons s'effacent en s'eloignant du foyer.
    m = Image.new('L', (l, h), 0)
    dm = ImageDraw.Draw(m)
    for i in range(70, 0, -1):
        r = R * .62 * i / 70
        dm.ellipse([cx - r, cy - r, cx + r, cy + r], fill=round(150 * (1 - i / 70) ** .7))
    ray.putalpha(Image.composite(ray.split()[3], Image.new('L', (l, h), 0), m))
    im.alpha_composite(ray)

    # --- le halo violet/rose ---
    halo = Image.new('RGBA', (l, h), (0, 0, 0, 0))
    dh = ImageDraw.Draw(halo)
    R2 = max(l, h) * .78
    for i in range(90, 0, -1):
        r = R2 * i / 90
        t = 1 - i / 90
        a = round(96 * t ** 2.2)
        c = tuple(round(VIOLET[k] + (ROSE[k] - VIOLET[k]) * (1 - t) * .55) for k in range(3))
        dh.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (a,))
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(40)))

    # --- le grain, comme la trame de points du site ---
    grain = Image.new('RGBA', (l, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(grain)
    for y in range(0, h, 26):
        for x in range(0, l, 26):
            a = round(16 * max(0, 1 - y / (h * .8)))
            if a:
                dg.ellipse([x, y, x + 1.6, y + 1.6], fill=(255, 255, 255, a))
    im.alpha_composite(grain)
    return im


def tracking(d, cx, cy, txt, font, couleur, ecart):
    """Du texte en capitales espacees, lettre par lettre.

    Intercaler des espaces fines entre les caracteres semblait plus court —
    mais Figtree n'a pas de glyphe pour l'espace fine, et chaque intervalle
    ressortait en carre vide. On avance donc le curseur a la main : c'est le
    seul moyen d'avoir une vraie approche typographique plutot qu'un mot
    trafique.
    """
    larg = sum(d.textlength(c, font=font) for c in txt) + ecart * (len(txt) - 1)
    x = cx - larg / 2
    for c in txt:
        d.text((x, cy), c, font=font, fill=couleur, anchor='lm')
        x += d.textlength(c, font=font) + ecart
    return larg


def ruban(im, cx, cy, txt, font, c1=ROSE, c2=VIOLET, pad=(32, 13), ecart=3.5):
    """La pastille en capitales espacees, comme les etiquettes du site."""
    d = ImageDraw.Draw(im)
    txt = txt.upper()
    larg = sum(d.textlength(c, font=font) for c in txt) + ecart * (len(txt) - 1)
    l, h = larg + pad[0] * 2, font.size + pad[1] * 2

    plaque = Image.new('RGBA', (round(l), round(h)), (0, 0, 0, 0))
    dp = ImageDraw.Draw(plaque)
    for x in range(round(l)):
        t = x / max(1, l - 1)
        dp.line([(x, 0), (x, h)],
                fill=tuple(round(c1[k] + (c2[k] - c1[k]) * t) for k in range(3)))
    masque = Image.new('L', plaque.size, 0)
    ImageDraw.Draw(masque).rounded_rectangle([0, 0, l - 1, h - 1], radius=h / 2, fill=255)
    plaque.putalpha(masque)

    # Une lueur sous la pastille : elle se pose sur le fond au lieu d'y etre collee.
    lueur = Image.new('RGBA', im.size, (0, 0, 0, 0))
    lueur.alpha_composite(plaque, (round(cx - l / 2), round(cy - h / 2)))
    im.alpha_composite(lueur.filter(ImageFilter.GaussianBlur(18)))
    im.alpha_composite(plaque, (round(cx - l / 2), round(cy - h / 2)))

    tracking(ImageDraw.Draw(im), cx, cy, txt, font, BLANC, ecart)


def mention(d, l, h):
    d.text((l / 2, h - 26), MENTION, font=TEXTE(15), fill=(255, 255, 255, 95), anchor='mm')


def chiffre(im, d, cx, cy, valeur, libelle):
    """Une case de statistique : le nombre en grand, le mot en petit."""
    L, H = 200, 118
    case = Image.new('RGBA', (L, H), (0, 0, 0, 0))
    dc = ImageDraw.Draw(case)
    dc.rounded_rectangle([0, 0, L - 1, H - 1], radius=20, fill=(255, 255, 255, 16),
                         outline=(255, 255, 255, 30), width=2)
    im.alpha_composite(case, (round(cx - L / 2), round(cy - H / 2)))
    d.text((cx, cy - 18), valeur, font=TITRE(46), fill=ROSE_PALE, anchor='mm')
    tracking(d, cx, cy + 34, libelle.upper(), GRAS(13), (255, 255, 255, 150), 1.6)


def eventail(im, chemins, cx, cy, hauteur, ecart, angle, creux, vedette=None):
    """Des cartes en eventail. L'index va de -n/2 a +n/2 : un seul nombre pilote
    l'ecart, l'angle et la profondeur, donc l'eventail reste equilibre quel que
    soit le nombre de cartes."""
    n = len(chemins)
    for k, ch in enumerate(chemins):
        i = k - (n - 1) / 2
        centre = abs(i) < .6
        haut = round(hauteur * (1.0 if centre else .92))
        c = ouvrir(ch, haut)
        coller(im, c, cx + i * ecart, cy + i * i * creux, rot=-i * angle,
               ombre=(26, 18, 200))
        if centre and vedette:
            pass


# ============================================================== les visuels
def v1_annonce():
    l, h = 1200, 675
    im = fond(l, h, .40)
    d = ImageDraw.Draw(im)

    coller(im, ouvrir('assets/logo-m8.webp', 104), l / 2, 168)
    # Le nom de l'extension est compose, pas illustre : son logo officiel est un
    # SVG que PIL ne sait pas lire, et empiler deux logos affaiblissait les deux.
    # Archivo penche et etire, c'est deja l'identite du site.
    texte(im, (l / 2, 320), 'TOUT COMMENCE ICI', TITRE(74), BLANC, halo=ROSE)
    texte(im, (l / 2, 430),
          "Ouvre des boosters, complète les 122 cartes de l'extension,\néchange avec les autres joueurs.",
          TEXTE(23), (255, 255, 255, 195), interligne=1.5)
    texte(im, (l / 2, 566), SITE, TITRE(40), ROSE_PALE, halo=ROSE)
    mention(d, l, h)
    return im


def v2_cartes():
    l, h = 1200, 675
    im = fond(l, h, .42)
    d = ImageDraw.Draw(im)
    eventail(im, [
        'cards/115_L_Moment-Instant_Orange_Champions-Du-Monde.avif',
        'cards/118_L_Joueur_Mauve_Gotaga-Dance.avif',
        'cards/121_L_Joueur_Neutre_Le-Marionnettiste.avif',
        'cards/116_L_Joueur_Mauve_The-French-Sorcerer.avif',
        'cards/113_L_Joueur_Rose_Kampai.avif',
    ], l / 2, 272, 352, 202, 8, 15)
    texte(im, (l / 2, 572), 'Dix légendaires.\nUne seule collection.', TITRE(50), BLANC,
          halo=ROSE, interligne=1.12)
    return im


def v3_chiffres():
    l, h = 1200, 675
    im = fond(l, h, .40)
    d = ImageDraw.Draw(im)
    ruban(im, l / 2, 148, 'Tout commence ici', GRAS(17))
    for k, (v, lib) in enumerate([('122', 'cartes'), ('6', 'par booster'),
                                  ('6', 'boosters / jour'), ('0 €', 'pour jouer')]):
        chiffre(im, d, l / 2 + (k - 1.5) * 224, 318, v, lib)
    texte(im, (l / 2, 470),
          "Gratuit, sans achat intégré, sans publicité.\nLa seule monnaie du jeu se gagne en jouant.",
          TEXTE(22), (255, 255, 255, 185), interligne=1.5)
    texte(im, (l / 2, 578), SITE, TITRE(36), ROSE_PALE, halo=ROSE)
    mention(d, l, h)
    return im


def v4_booster():
    l, h = 1080, 1350
    im = fond(l, h, .44)
    d = ImageDraw.Draw(im)
    coller(im, ouvrir('assets/logo-m8.webp', 82), l / 2, 132)
    coller(im, ouvrir('assets/boosters/booster-01.webp', 700), l / 2, 580,
           ombre=(40, 34, 215))
    texte(im, (l / 2, 1042), 'Le premier\nest pour toi.', TITRE(70), BLANC,
          halo=ROSE, interligne=1.1)
    texte(im, (l / 2, 1220), SITE, TITRE(42), ROSE_PALE, halo=ROSE)
    mention(d, l, h)
    return im


def v5_promos():
    l, h = 1080, 1080
    im = fond(l, h, .40)
    d = ImageDraw.Draw(im)
    ruban(im, l / 2, 136, 'Cartes promo', GRAS(17), c1=(255, 91, 176), c2=VIOLET)
    eventail(im, [
        'cards/promos/P01-Major_De_Paris.webp',
        'cards/promos/P02-Major_De_Paris.webp',
        'cards/promos/P05-Tout_Commence_Ici.webp',
        'cards/promos/P06-Le_Marionnettiste_v2.webp',
    ], l / 2, 452, 398, 200, 7, 16)
    texte(im, (l / 2, 828), 'Introuvables\nen booster.', TITRE(54), BLANC,
          halo=(255, 91, 176), interligne=1.12)
    texte(im, (l / 2, 968), "Deux s'achètent. Deux se méritent.",
          TEXTE(22), (255, 255, 255, 180))
    mention(d, l, h)
    return im


def v6_teaser():
    l, h = 1200, 675
    im = fond(l, h, .38)
    d = ImageDraw.Draw(im)
    coller(im, ouvrir('assets/logo-m8.webp', 86), l / 2, 158)
    texte(im, (l / 2, 300), 'COMING SOON', TITRE(92), BLANC, halo=ROSE)
    texte(im, (l / 2, 424),
          "L'extension Tout commence ici et ses 122 cartes\narrivent bientôt.\nBoosters, collections, échanges,…",
          TEXTE(22), (255, 255, 255, 185), interligne=1.5)
    texte(im, (l / 2, 566), SITE, TITRE(36), ROSE_PALE, halo=ROSE)
    mention(d, l, h)
    return im


# ================================================================= le GIF
def gif_teaser():
    """Une boucle courte : le paquet flotte, la lumiere tourne, le titre pulse.

    Douze images a 12 par seconde, en boucle : assez pour que ca respire, assez
    leger pour passer en piece jointe sans compression aggressive.
    """
    L, H = 800, 450
    N = 24
    base = fond(L, H, .40)
    pack = ouvrir('assets/boosters/booster-01.webp', 300)
    logo = ouvrir('assets/logo-m8.webp', 54)

    images = []
    for i in range(N):
        t = i / N
        im = base.copy()
        # Le paquet monte et redescend, et s'incline legerement : le meme
        # flottement que sur l'ecran Boosters du jeu.
        dy = math.sin(t * 2 * math.pi) * 14
        rot = math.sin(t * 2 * math.pi + 1.1) * 2.6
        coller(im, pack, L / 2, 228 + dy, rot=rot, ombre=(26, 22, 205))
        coller(im, logo, L / 2, 62)

        d = ImageDraw.Draw(im)
        # Le titre respire en opacite plutot qu'en taille : un texte qui change
        # de corps d'une image a l'autre tremble.
        a = round(210 + 45 * math.sin(t * 2 * math.pi))
        d.text((L / 2, 392), SITE, font=TITRE(30), fill=ROSE_PALE[:3] + (a,), anchor='mm')
        images.append(im.convert('P', palette=Image.ADAPTIVE, colors=180))

    sortie = os.path.join(SORTIE, 'teaser-anime.gif')
    images[0].save(sortie, save_all=True, append_images=images[1:],
                   duration=83, loop=0, optimize=True, disposal=2)
    return sortie


def gif_ouverture():
    """Le geste du jeu, en six secondes : le paquet flotte, disparait dans un
    eclat, les cartes se deploient en eventail.

    C'est la seule chose qu'une image fixe ne sait pas raconter — et c'est
    precisement ce qu'on vend. Un booster, on l'ouvre.

    Trois temps, calques sur le vrai theatre d'ouverture du site :
      0 %  -  38 % : le paquet flotte, la lumiere monte derriere lui
     38 %  -  52 % : l'eclat, le paquet s'efface
     52 %  - 100 % : les cartes sortent et s'ouvrent en eventail
    """
    L, H = 800, 450
    N = 42
    base = fond(L, H, .44)
    pack = ouvrir('assets/boosters/booster-01.webp', 290)
    logo = ouvrir('assets/logo-m8.webp', 48)

    # Cinq cartes (un vrai paquet en a six : l'eventail reste lisible a 800 px),
    # le hit au centre.
    tirage = [
        'cards/010_C_Joueur_Rose_Broken-Brawks.avif',
        'cards/047_E_Moment-Instant_Violette_Champions-du-Major.avif',
        'cards/121_L_Joueur_Neutre_Le-Marionnettiste.avif',
        'cards/116_L_Joueur_Mauve_The-French-Sorcerer.avif',
        'cards/022_E_Joueur_Rose_Namifique.avif',
    ]
    cartes = [ouvrir(c, 250) for c in tirage]

    images = []
    for i in range(N):
        t = i / (N - 1)
        im = base.copy()
        coller(im, logo, L / 2, 52)

        if t < .52:
            # --- Le paquet, et la lumiere qui monte ---
            u = t / .52
            dy = math.sin(t * 5.2) * 10
            ech = 1 + (u ** 3) * .5
            p2 = pack if ech == 1 else pack.resize(
                (round(pack.width * ech), round(pack.height * ech)), Image.LANCZOS)

            # La lueur derriere grossit avec l'attente : on sent que ca va lacher.
            if u > .55:
                v = (u - .55) / .45
                lueur = Image.new('RGBA', (L, H), (0, 0, 0, 0))
                dl = ImageDraw.Draw(lueur)
                R = 60 + v * 260
                for k in range(26, 0, -1):
                    r = R * k / 26
                    dl.ellipse([L/2 - r, 232 - r, L/2 + r, 232 + r],
                               fill=(255, 235, 255, round(70 * v * (1 - k / 26))))
                im.alpha_composite(lueur.filter(ImageFilter.GaussianBlur(26)))

            if u < .92:
                op = 1 if u < .8 else (.92 - u) / .12
                if op < 1:
                    a = p2.split()[3].point(lambda x: round(x * op))
                    p2 = p2.copy(); p2.putalpha(a)
                coller(im, p2, L / 2, 232 + dy, ombre=(24, 20, 190))
        else:
            # --- L'eventail ---
            u = (t - .52) / .48
            e = 1 - (1 - u) ** 3          # sortie douce
            n = len(cartes)
            for k, c in enumerate(cartes):
                idx = k - (n - 1) / 2
                ech = .55 + .45 * e
                cc = c.resize((round(c.width * ech), round(c.height * ech)), Image.LANCZOS)
                coller(im, cc,
                       L / 2 + idx * 132 * e,
                       232 + idx * idx * 9 * e - 14 * e,
                       rot=-idx * 8 * e, ombre=(20, 14, 185))

        d = ImageDraw.Draw(im)
        a = round(200 + 55 * math.sin(t * 6))
        d.text((L / 2, 404), SITE, font=TITRE(28), fill=ROSE_PALE[:3] + (a,), anchor='mm')
        images.append(im.convert('P', palette=Image.ADAPTIVE, colors=200))

    sortie = os.path.join(SORTIE, 'ouverture-anime.gif')
    # La derniere image tient plus longtemps : l'eventail est la chute, on la
    # laisse se lire avant que la boucle reparte.
    durees = [70] * (N - 1) + [1500]
    images[0].save(sortie, save_all=True, append_images=images[1:],
                   duration=durees, loop=0, optimize=True, disposal=2)
    return sortie


# ==================================================================== main
def main():
    os.makedirs(SORTIE, exist_ok=True)
    random.seed(7)

    visuels = [
        ('01-annonce-paysage.png', v1_annonce),
        ('02-cartes-paysage.png', v2_cartes),
        ('03-chiffres-paysage.png', v3_chiffres),
        ('04-booster-portrait.png', v4_booster),
        ('05-promos-carre.png', v5_promos),
        ('06-teaser-paysage.png', v6_teaser),
    ]
    for nom, fn in visuels:
        im = fn().convert('RGB')
        p = os.path.join(SORTIE, nom)
        im.save(p, 'PNG', optimize=True)
        print('  %-28s %5d x %-5d %6.0f Ko' % (nom, im.width, im.height,
                                               os.path.getsize(p) / 1024))

    for g in (gif_teaser(), gif_ouverture()):
        print('  %-28s %6.0f Ko' % (os.path.basename(g), os.path.getsize(g) / 1024))
    print('\nTout est dans presse/visuels/.')


if __name__ == '__main__':
    main()
