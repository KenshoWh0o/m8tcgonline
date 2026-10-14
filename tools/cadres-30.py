#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dessine les cadres d'avatar de la version 3.0.

    python3 tools/cadres-30.py

Ecrit dans assets/cadres/ :
  niv10.svg niv20.svg niv30.svg niv50.svg   les niveaux de combattant
                                            (js/combat/niveaux.js) : l'arene,
                                            en bronze, argent, or et prisme
  toxique.svg deter.svg                     les deux Sections (Boutique)
  choc.svg                                  le Pass du Choc des Sections
  secrete.svg                               la premiere Secrete (quete)
  foudre.svg                                The French Sorcerer (boutique du Choc)

Meme gabarit que les autres cadres decores (css/reflets.css) : 128 x 128,
l'avatar au centre sur un rayon de 50, le decor deborde autour. Chaque
fichier a son prefixe d'identifiants : deux cadres sur une meme page ne se
marchent pas dessus.

Meme facon que les cadres de la 2.0 (tools/cadres.py) : un anneau fin, a
peine la, et ce qui fait le cadre dessine autour en trainees effilees, en
degrade de couleur et de transparence, avec leur lueur. Les deux Sections se
repondent : le poison de Toxique monte du bas et s'evapore ; la foudre de
Deter tombe du haut et s'eteint. Le Choc les fait se rencontrer en haut, dans
un eclat blanc. Les quatre cadres d'Arene s'enrichissent d'un palier a
l'autre : le laurier s'allonge, les epees arrivent a 20, les gemmes a 30, le
prisme et ses eclats a 50."""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'cadres')
C = 64
RM = "@media (prefers-reduced-motion:reduce){*{animation:none!important}}"


def f(x):
    return f"{x:.2f}".rstrip('0').rstrip('.')


def pt(r, a):
    a = math.radians(a)
    return C + r * math.cos(a), C + r * math.sin(a)


def P(*ps):
    return ' '.join(f"{f(x)},{f(y)}" for x, y in ps)


def ring_path(r1, r2):
    return (f"M{f(C + r2)} {C}A{r2} {r2} 0 1 0 {f(C - r2)} {C}A{r2} {r2} 0 1 0 {f(C + r2)} {C}Z"
            f"M{f(C + r1)} {C}A{r1} {r1} 0 1 1 {f(C - r1)} {C}A{r1} {r1} 0 1 1 {f(C + r1)} {C}Z")


def star4(x, y, s, fill='#fff', rot=0):
    d = (f"M{f(x)} {f(y - s)}Q{f(x + s * .18)} {f(y - s * .18)} {f(x + s)} {f(y)}Q{f(x + s * .18)} {f(y + s * .18)} {f(x)} {f(y + s)}"
         f"Q{f(x - s * .18)} {f(y + s * .18)} {f(x - s)} {f(y)}Q{f(x - s * .18)} {f(y - s * .18)} {f(x)} {f(y - s)}Z")
    tr = f" transform='rotate({rot} {f(x)} {f(y)})'" if rot else ''
    return f"<path d='{d}' fill='{fill}'{tr}/>"


def twinkle(inner, dur, delay):
    return f"<g class='tw' style='animation-duration:{dur}s;animation-delay:{delay}s'>{inner}</g>"


STYLE_TW = (".tw{transform-box:fill-box;transform-origin:center;animation:tw 2.4s ease-in-out infinite alternate}"
            "@keyframes tw{from{opacity:.25;transform:scale(.55) rotate(-15deg)}to{opacity:1;transform:scale(1) rotate(15deg)}}")


def melange(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f"{round(a[k] + (b[k] - a[k]) * t):02x}" for k in range(3))


def degrade(stops, t):
    for i in range(len(stops) - 1):
        if t <= stops[i + 1][0]:
            u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
            return melange(stops[i][1], stops[i + 1][1], u)
    return stops[-1][1]


class Cadre:
    """Un fichier : ses definitions (degrades, filtres), son style, son corps."""

    def __init__(self, nom, p, marge=0):
        self.nom, self.p = nom, p
        self.defs, self.style, self.corps = [], [STYLE_TW], []
        self.n = 0
        # `marge` : de la place en plus autour du gabarit 128 x 128 (les
        # ailes de l'Arene, la Foudre). La feuille de style agrandit le
        # decor d'autant (inset, css/choc.css) : l'avatar reste au rayon 50.
        self.marge = marge

    def id(self, base=''):
        self.n += 1
        return f"{self.p}{base}{self.n}"

    def flou(self, sd):
        i = self.id('f')
        self.defs.append(f"<filter id='{i}' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='{sd}'/></filter>")
        return i

    def trainee(self, r, a0, a1, n, w0, w1, op0, op1, stops, ond=(0, 0, 0), expo=1.5):
        """Une trainee effilee d'un seul tenant, de a0 (fine, transparente) a
        a1 (epaisse, pleine) : n troncons bord a bord, chacun avec son
        degrade le long de sa corde. `ond` (amplitude, periodes, phase) la
        fait onduler autour du rayon r."""
        amp, k, ph = ond
        rad = lambda t: r + amp * math.sin(2 * math.pi * k * t + ph)
        larg = lambda t: w0 + (w1 - w0) * t ** expo
        alpha = lambda t: op0 + (op1 - op0) * t ** 1.25
        s = ''
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            sous = [t0 + (t1 - t0) * j / 6 for j in range(7)]
            ext = [pt(rad(t) + larg(t) / 2, a0 + (a1 - a0) * t) for t in sous]
            intr = [pt(rad(t) - larg(t) / 2, a0 + (a1 - a0) * t) for t in reversed(sous)]
            g = self.id('g')
            xa, ya = pt(rad(t0), a0 + (a1 - a0) * t0)
            xb, yb = pt(rad(t1), a0 + (a1 - a0) * t1)
            self.defs.append(f"<linearGradient id='{g}' gradientUnits='userSpaceOnUse' x1='{f(xa)}' y1='{f(ya)}' x2='{f(xb)}' y2='{f(yb)}'>"
                             f"<stop offset='0' stop-color='{degrade(stops, t0)}' stop-opacity='{f(alpha(t0))}'/>"
                             f"<stop offset='1' stop-color='{degrade(stops, t1)}' stop-opacity='{f(alpha(t1))}'/></linearGradient>")
            s += f"<polygon points='{P(*(ext + intr))}' fill='url(#{g})'/>"
        return s

    def ecrire(self):
        m = self.marge
        svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{-m} {-m} {128 + 2 * m} {128 + 2 * m}'><defs>{''.join(self.defs)}</defs>"
               f"<style>{''.join(self.style)}{RM}</style>{''.join(self.corps)}</svg>\n")
        with open(os.path.join(OUT, self.nom + '.svg'), 'w', encoding='utf-8') as fi:
            fi.write(svg)
        print('cadre', self.nom, len(svg), 'o')


def anneau_fondu(F, couleurs, op=.3):
    """L'anneau a peine la, comme celui du cadre Maitre."""
    g = F.id('a')
    F.defs.append(f"<linearGradient id='{g}' x1='0' y1='1' x2='1' y2='0'>"
                  + ''.join(f"<stop offset='{o}' stop-color='{c}'/>" for o, c in couleurs) + "</linearGradient>")
    return (f"<path d='{ring_path(50, 54.5)}' fill='url(#{g})' fill-rule='evenodd' opacity='{op}'/>"
            f"<circle cx='64' cy='64' r='50' fill='none' stroke='{couleurs[-1][1]}' stroke-width='.6' opacity='.4'/>")


def eclair(r, a0, a1, pas, ecart, graine):
    """Un eclair qui suit l'anneau de a0 a a1 : une ligne brisee, le rayon
    tire au hasard d'un sommet a l'autre (graine fixe : le dessin ne bouge
    pas d'un tirage a l'autre)."""
    rnd = random.Random(graine)
    n = max(2, round(abs(a1 - a0) / pas))
    ps = []
    for i in range(n + 1):
        t = i / n
        e = 0 if i in (0, n) else (rnd.uniform(.45, 1) * ecart * (1 if i % 2 else -1))
        ps.append(pt(r + e, a0 + (a1 - a0) * t))
    return 'M' + ' L'.join(f"{f(x)} {f(y)}" for x, y in ps)


def crepite(F, r, a0, a1, couleur, pas=7, ecart=2.4, graine=1, large=3.2, classe='ec'):
    """Un eclair qui crepite : deux dessins qui alternent, une lueur floue
    de la couleur, un coeur blanc."""
    d1 = eclair(r, a0, a1, pas, ecart, graine)
    d2 = eclair(r, a0, a1, pas, ecart, graine + 100)
    fl = F.flou(.9)
    anim = f"<animate attributeName='d' values='{d1};{d2}' dur='.36s' calcMode='discrete' repeatCount='indefinite'/>"
    return (f"<g class='{classe}'><path d='{d1}' fill='none' stroke='{couleur}' stroke-width='{large}' stroke-linecap='round' "
            f"stroke-linejoin='round' opacity='.75' filter='url(#{fl})'>{anim}</path>"
            f"<path d='{d1}' fill='none' stroke='#fff' stroke-width='{large * .36:.2f}' stroke-linecap='round' stroke-linejoin='round'>{anim}</path></g>")


# ------------------------------------------------------------ Toxique
TOX = [(0, '#0c4a1c'), (.35, '#2fa83a'), (.72, '#86ff5e'), (1, '#e2ffd4')]
VIO = [(0, '#25095f'), (.35, '#6a2bd6'), (.72, '#b79bff'), (1, '#f6f1ff')]


def goutte(x, y, h, w, fill, contour):
    """Une coulure qui pend sous l'anneau : un col qui s'amincit, une goutte
    ronde au bout."""
    r = w * .78
    yb = y + h - r
    return (f"<path d='M{f(x - w)} {f(y)}C{f(x - w * .5)} {f(y + h * .25)} {f(x - r * .55)} {f(yb - r * 1.2)} {f(x - r)} {f(yb)}"
            f"A{f(r)} {f(r)} 0 1 0 {f(x + r)} {f(yb)}C{f(x + r * .55)} {f(yb - r * 1.2)} {f(x + w * .5)} {f(y + h * .25)} {f(x + w)} {f(y)}Z' "
            f"fill='{fill}' stroke='{contour}' stroke-width='.4'/>"
            f"<circle cx='{f(x - r * .35)}' cy='{f(yb - r * .1)}' r='{f(r * .3)}' fill='#fff' opacity='.8'/>")


def bulle(x, y, r, fill, contour, classe=''):
    return (f"<g class='{classe}'><circle cx='{f(x)}' cy='{f(y)}' r='{r}' fill='{fill}' stroke='{contour}' stroke-width='.45'/>"
            f"<circle cx='{f(x - r * .35)}' cy='{f(y - r * .35)}' r='{f(r * .3)}' fill='#fff' opacity='.85'/></g>")


def toxique():
    """Une brume de poison qui monte du bas, des deux cotes, ondule et
    s'evapore avant le haut ; sous l'anneau, la flaque qui coule ; des
    bulles qui montent."""
    F = Cadre('toxique', 'tx')
    F.defs.append("<radialGradient id='tx-b' cx='.35' cy='.3' r='.75'><stop offset='0' stop-color='#ffffff'/>"
                  "<stop offset='.35' stop-color='#86ff5e'/><stop offset='1' stop-color='#2fa83a'/></radialGradient>"
                  "<linearGradient id='tx-p' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e2ffd4'/>"
                  "<stop offset='.35' stop-color='#86ff5e'/><stop offset='1' stop-color='#1f7a2c'/></linearGradient>"
                  "<radialGradient id='tx-h'><stop offset='0' stop-color='#86ff5e' stop-opacity='.55'/><stop offset='1' stop-color='#86ff5e' stop-opacity='0'/></radialGradient>")
    F.style.append(".sg{transform-origin:64px 64px;animation:sg 5s ease-in-out infinite alternate}.sd{animation-name:sd}"
                   "@keyframes sg{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}@keyframes sd{from{transform:rotate(3deg)}to{transform:rotate(-3deg)}}"
                   ".bu{transform-box:fill-box;transform-origin:center;animation:bu 3s ease-in infinite}.bu2{animation-delay:-1s}.bu3{animation-delay:-2s}"
                   "@keyframes bu{0%{transform:translateY(0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translateY(-11px) scale(1.05);opacity:0}}"
                   ".gt{animation:gt 2.6s ease-in infinite}@keyframes gt{0%,40%{transform:translateY(0);opacity:1}100%{transform:translateY(9px);opacity:0}}")
    fl2 = F.flou(3)
    c = [anneau_fondu(F, [(0, '#0c4a1c'), (.5, '#38c23c'), (1, '#e2ffd4')], .32)]
    # La lueur de la flaque, sous l'avatar.
    c.append("<ellipse cx='64' cy='118' rx='30' ry='9' fill='url(#tx-h)'/>")
    for cote, (a0, a1), ph in (('sg', (232, 96), 0), ('sg sd', (-52, 84), 1.7)):
        c.append(f"<g class='{cote}'>"
                 f"<g filter='url(#{fl2})' opacity='.7'>{F.trainee(53.5, a0, a1, 14, .5, 11, 0, .85, TOX, (2.3, 1.6, ph))}</g>"
                 + F.trainee(53.5, a0, a1, 26, .2, 6.2, 0, 1, TOX, (2.3, 1.6, ph))
                 + F.trainee(59, a0 + (a1 - a0) * .28, a1, 10, .1, 1.7, 0, .8, TOX, (1.2, 2.2, ph + 1))
                 + F.trainee(48.6, a0 + (a1 - a0) * .4, a1, 10, .1, 1.3, 0, .7, TOX, (.8, 2, ph + 2.2))
                 + "</g>")
    # La flaque, au bas de l'anneau, et ses coulures.
    flaque = [(0, '#2fa83a'), (.6, '#86ff5e'), (1, '#c8ffb0')]
    c.append(F.trainee(54.2, 60, 90, 8, 1, 5.2, .2, .95, flaque) + F.trainee(54.2, 120, 90, 8, 1, 5.2, .2, .95, flaque))
    for a, h, w in ((79, 8, 2), (91, 12.5, 2.5), (102, 6.5, 1.7)):
        x, y = pt(56, a)
        c.append(goutte(x, y - 1.2, h, w, 'url(#tx-p)', '#0c4a1c'))
    x, y = pt(56, 91)
    c.append(f"<g class='gt'><circle cx='{f(x)}' cy='{f(y + 14)}' r='1.6' fill='#86ff5e' stroke='#0c4a1c' stroke-width='.4'/></g>")
    # Des volutes qui s'echappent de la brume, vers l'exterieur.
    for a0, a1, r, ph in ((205, 150, 61, .6), (-25, 30, 61, 2.4), (238, 196, 57.5, 1.4), (-58, -18, 57.5, 3)):
        c.append(F.trainee(r, a0, a1, 10, .1, 2, 0, .75, TOX, (1.6, 1.2, ph)))
    # Des bulles qui montent le long de la brume.
    for a, r, k in ((122, 2.4, 'bu'), (150, 1.8, 'bu bu2'), (200, 1.4, 'bu bu3'), (58, 2.2, 'bu bu2'), (28, 1.6, 'bu'), (-12, 1.3, 'bu bu3')):
        x, y = pt(57.5, a)
        c.append(bulle(x, y, r, 'url(#tx-b)', '#0c4a1c', k))
    for a, r in ((140, 1.6), (40, 1.4)):
        x, y = pt(53.5, a)
        c.append(bulle(x, y, r, 'url(#tx-b)', '#0c4a1c'))
    F.corps = c
    F.ecrire()


# ------------------------------------------------------------ Deter
def chevrons(cx, cy, s, F, couleurs, contour):
    """L'insigne de Deter : un losange, un double chevron qui monte."""
    g = F.id('e')
    F.defs.append(f"<linearGradient id='{g}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{couleurs[0]}'/>"
                  f"<stop offset='1' stop-color='{couleurs[1]}'/></linearGradient>")
    fl = F.flou(1.6)
    return (f"<path d='M{f(cx)} {f(cy - s * 1.15)}L{f(cx + s)} {f(cy)}L{f(cx)} {f(cy + s * 1.15)}L{f(cx - s)} {f(cy)}Z' fill='#fff' opacity='.5' filter='url(#{fl})'/>"
            f"<path d='M{f(cx)} {f(cy - s * 1.15)}L{f(cx + s)} {f(cy)}L{f(cx)} {f(cy + s * 1.15)}L{f(cx - s)} {f(cy)}Z' fill='url(#{g})' stroke='{contour}' stroke-width='1.2' stroke-linejoin='round'/>"
            f"<path d='M{f(cx - s * .45)} {f(cy + s * .05)}L{f(cx)} {f(cy - s * .4)}L{f(cx + s * .45)} {f(cy + s * .05)}"
            f"M{f(cx - s * .45)} {f(cy + s * .52)}L{f(cx)} {f(cy + s * .07)}L{f(cx + s * .45)} {f(cy + s * .52)}' fill='none' stroke='#fff' "
            f"stroke-width='{f(s * .2)}' stroke-linecap='round' stroke-linejoin='round'/>")


def deter():
    """La foudre tombe du haut : un insigne a double chevron, d'ou partent
    deux decharges qui descendent le long de l'anneau et s'eteignent avant
    le bas ; un eclair crepite dans chacune, des etincelles autour."""
    F = Cadre('deter', 'dt')
    F.style.append(".ec{animation:ec 2.2s steps(1) infinite}.ec2{animation-delay:-1.1s}"
                   "@keyframes ec{0%,58%{opacity:1}60%{opacity:.2}64%{opacity:1}68%{opacity:.35}72%,100%{opacity:1}}"
                   ".et{transform-box:fill-box;transform-origin:center;animation:et 1.4s ease-in-out infinite alternate}.et2{animation-delay:-.7s}"
                   "@keyframes et{from{opacity:.2;transform:scale(.5)}to{opacity:1;transform:scale(1)}}")
    fl2 = F.flou(3)
    c = [anneau_fondu(F, [(0, '#25095f'), (.5, '#7c3aed'), (1, '#f1ebff')], .32)]
    for a0, a1 in ((132, 262), (48, -82)):
        c.append(f"<g filter='url(#{fl2})' opacity='.75'>{F.trainee(53.5, a0, a1, 14, .5, 11, 0, .85, VIO)}</g>"
                 + F.trainee(53.5, a0, a1, 26, .2, 6, 0, 1, VIO)
                 + F.trainee(59, a0 + (a1 - a0) * .35, a1, 10, .1, 1.5, 0, .8, VIO)
                 + F.trainee(48.6, a0 + (a1 - a0) * .45, a1, 10, .1, 1.2, 0, .7, VIO))
    # Les eclairs, dans la partie epaisse des decharges.
    c.append(crepite(F, 53.5, 258, 196, '#b79bff', graine=3) + crepite(F, 53.5, -78, -16, '#b79bff', graine=7, classe='ec ec2'))
    # Deux petits arcs qui jaillissent vers l'exterieur, dans le meme crepitement.
    c.append(crepite(F, 58.5, 222, 205, '#b79bff', pas=4, ecart=1.8, graine=21, large=2.2)
             + crepite(F, 58.5, -42, -25, '#b79bff', pas=4, ecart=1.8, graine=23, large=2.2, classe='ec ec2'))
    for a, r, k in ((236, 60.5, 'et'), (304, 61, 'et et2'), (176, 58.5, 'et et2'), (6, 59, 'et')):
        x, y = pt(r, a)
        c.append(f"<circle class='{k}' cx='{f(x)}' cy='{f(y)}' r='1.3' fill='#fff'/>")
    c.append(chevrons(64, 9.5, 8.6, F, ('#8f5cff', '#2c0c72'), '#f1ebff'))
    F.corps = c
    F.ecrire()


# ------------------------------------------------------------ le Choc
def choc():
    """Les deux Sections se rencontrent : la brume verte monte par la
    gauche, la decharge violette par la droite, et elles se heurtent en
    haut dans un eclat blanc qui palpite."""
    F = Cadre('choc', 'ck')
    F.defs.append("<radialGradient id='ck-l'><stop offset='0' stop-color='#fff'/><stop offset='.3' stop-color='#fff' stop-opacity='.85'/>"
                  "<stop offset='.6' stop-color='#e9e2ff' stop-opacity='.35'/><stop offset='1' stop-color='#e9e2ff' stop-opacity='0'/></radialGradient>"
                  "<radialGradient id='ck-b' cx='.35' cy='.3' r='.75'><stop offset='0' stop-color='#ffffff'/>"
                  "<stop offset='.35' stop-color='#86ff5e'/><stop offset='1' stop-color='#2fa83a'/></radialGradient>")
    F.style.append(".pl{transform-box:fill-box;transform-origin:center;animation:pl 1.8s ease-in-out infinite alternate}"
                   "@keyframes pl{from{transform:scale(.86);opacity:.85}to{transform:scale(1.08);opacity:1}}"
                   ".ec{animation:ec 2.2s steps(1) infinite}@keyframes ec{0%,58%{opacity:1}60%{opacity:.2}64%{opacity:1}68%{opacity:.35}72%,100%{opacity:1}}"
                   ".bu{transform-box:fill-box;transform-origin:center;animation:bu 3s ease-in infinite}.bu2{animation-delay:-1.5s}"
                   "@keyframes bu{0%{transform:translateY(0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translateY(-11px) scale(1.05);opacity:0}}")
    fl2 = F.flou(3)
    c = []
    # L'anneau fondu, vert a gauche, violet a droite.
    g = F.id('a')
    F.defs.append(f"<linearGradient id='{g}' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#38c23c'/><stop offset='.45' stop-color='#a8f08a'/>"
                  f"<stop offset='.55' stop-color='#c4b5fd'/><stop offset='1' stop-color='#7c3aed'/></linearGradient>")
    c.append(f"<path d='{ring_path(50, 54.5)}' fill='url(#{g})' fill-rule='evenodd' opacity='.3'/>"
             "<circle cx='64' cy='64' r='50' fill='none' stroke='#fff' stroke-width='.6' opacity='.35'/>")
    for (a0, a1), pal, ond in (((100, 262), TOX, (1.6, 1.5, 0)), ((80, -82), VIO, (0, 0, 0))):
        c.append(f"<g filter='url(#{fl2})' opacity='.75'>{F.trainee(53.5, a0, a1, 14, .5, 11, 0, .85, pal, ond)}</g>"
                 + F.trainee(53.5, a0, a1, 26, .2, 6.2, 0, 1, pal, ond)
                 + F.trainee(59, a0 + (a1 - a0) * .4, a1, 10, .1, 1.6, 0, .8, pal, ond)
                 + F.trainee(48.6, a0 + (a1 - a0) * .5, a1, 10, .1, 1.2, 0, .7, pal, ond))
    # Ce qui fait chaque cote : des bulles a gauche, un eclair a droite.
    for a, r, k in ((160, 2, 'bu'), (205, 1.6, 'bu bu2'), (128, 1.4, 'bu bu2')):
        x, y = pt(57.5, a)
        c.append(bulle(x, y, r, 'url(#ck-b)', '#0c4a1c', k))
    c.append(crepite(F, 53.5, -80, -14, '#b79bff', graine=11))
    # L'eclat du Choc : un halo, deux etoiles croisees, des rayons des deux
    # couleurs.
    rayons = ''
    for k in range(8):
        a = -90 + k * 45 + 22.5
        x0, y0 = 64 + 5 * math.cos(math.radians(a)), 9 + 5 * math.sin(math.radians(a))
        x1, y1 = 64 + 13 * math.cos(math.radians(a)), 9 + 13 * math.sin(math.radians(a))
        col = '#86ff5e' if math.cos(math.radians(a)) < 0 else '#b79bff'
        rayons += f"<line x1='{f(x0)}' y1='{f(y0)}' x2='{f(x1)}' y2='{f(y1)}' stroke='{col}' stroke-width='1.3' stroke-linecap='round'/>"
    c.append(f"<g class='pl'><circle cx='64' cy='9' r='15' fill='url(#ck-l)'/>{rayons}"
             f"{star4(64, 9, 11.5)}{star4(64, 9, 6, '#fff', 45)}<circle cx='64' cy='9' r='2.4' fill='#fff'/></g>")
    F.corps = c
    F.ecrire()


# ------------------------------------------------------------ la Secrete
def secrete():
    """Le reflet des Secretes : un anneau fin et irise qui tourne
    lentement, une brume des memes couleurs autour, un eclat qui passe ; en
    haut a droite, leur symbole (deux etoiles, comme le ✦✦ de la rarete)."""
    F = Cadre('secrete', 'se')
    F.defs.append("<linearGradient id='se-i' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff9ad5'/><stop offset='.25' stop-color='#ffe08a'/>"
                  "<stop offset='.5' stop-color='#8ff0c8'/><stop offset='.75' stop-color='#8fd3ff'/><stop offset='1' stop-color='#c3b2ff'/>"
                  "<animateTransform attributeName='gradientTransform' type='rotate' from='0 .5 .5' to='360 .5 .5' dur='10s' repeatCount='indefinite'/></linearGradient>"
                  "<linearGradient id='se-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>"
                  "<stop offset='.5' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
                  f"<mask id='se-m'><path d='{ring_path(50.5, 54.5)}' fill='#fff' fill-rule='evenodd'/></mask>"
                  "<radialGradient id='se-h'><stop offset='0' stop-color='#fff' stop-opacity='.95'/><stop offset='.35' stop-color='#ffd0ec' stop-opacity='.55'/>"
                  "<stop offset='.7' stop-color='#8fd3ff' stop-opacity='.2'/><stop offset='1' stop-color='#c3b2ff' stop-opacity='0'/></radialGradient>")
    F.style.append(".lu{transform-origin:64px 64px;animation:lu 6s linear infinite}@keyframes lu{to{transform:rotate(360deg)}}")
    fl = F.flou(2.6)
    sx, sy = pt(57, -50)
    tx, ty = pt(63, -29)
    c = [f"<circle cx='64' cy='64' r='55' fill='none' stroke='url(#se-i)' stroke-width='7' opacity='.55' filter='url(#{fl})'/>",
         f"<path d='{ring_path(50.5, 54.5)}' fill='url(#se-i)' fill-rule='evenodd'/>",
         "<circle cx='64' cy='64' r='54.5' fill='none' stroke='#fff' stroke-width='.7' opacity='.85'/>",
         "<circle cx='64' cy='64' r='50.5' fill='none' stroke='#2a2540' stroke-width='.6' opacity='.5'/>",
         "<g mask='url(#se-m)'><g class='lu'><ellipse cx='64' cy='9' rx='15' ry='6' fill='url(#se-s)'/></g></g>",
         # Le symbole : deux etoiles, la grande sur l'anneau, la petite au-dessus.
         f"<circle cx='{f(sx)}' cy='{f(sy)}' r='13' fill='url(#se-h)'/>",
         twinkle(star4(sx, sy, 10.5, '#fff', 8), 2.6, 0),
         twinkle(star4(tx, ty, 5.2, '#fff', -10), 2.2, 1.1)]
    for r, a, s, d, b in ((60, 150, 3, 2.6, .4), (59, 205, 2.2, 2.2, 1.4), (61, 100, 2.4, 2.9, .9), (60, 28, 2, 2.4, 1.8), (61, -120, 2.4, 2.8, .2)):
        c.append(twinkle(star4(*pt(r, a), s, '#fff'), d, b))
    F.corps = c
    F.ecrire()


# ------------------------------------------------------------ l'Arene
# Version 3.0.7 : les cadres d'Arene sont refaits a la maniere des bordures
# de niveau des grands jeux en ligne. Un anneau de metal epais, biseaute et
# grave ; une plaque en bas qui porte le niveau ; un cimier en haut et sa
# gemme ; et, d'un palier a l'autre, des ailes qui grandissent :
#   10 · bronze : l'anneau, la plaque, le cimier ;
#   20 · argent : de petites ailes, trois plumes ;
#   30 · or     : de grandes ailes, cinq plumes, deux gemmes sur les cotes ;
#   50 · prisme : les grandes ailes deployees, une couronne sur le cimier,
#                 une aura, le metal irise qui change de couleur.
METAUX = {
    #        clair      milieu     sombre     trait      reflet     gemme
    'niv10': ('#ffd9b8', '#c47a3e', '#6b3410', '#3a1a05', '#ffe6cf', '#ff6a3d'),
    'niv20': ('#ffffff', '#c3ccd9', '#5f6878', '#2c313b', '#ffffff', '#4ea8ff'),
    'niv30': ('#fff4c2', '#f0bd3c', '#8a5606', '#4a2c00', '#fff8d6', '#ff3d7a'),
    'niv50': ('#ffe9f8', '#c4a6ff', '#4a58d8', '#1d0f4a', '#ffffff', '#ffffff'),
}
AILES = {'niv10': (0, 0), 'niv20': (4, .9), 'niv30': (6, 1.1), 'niv50': (8, 1.28)}


def plume(x, y, ang, L, W, fill, trait, veine):
    """Une plume large, en goutte : sa base en (x, y), sa pointe a L dans la
    direction `ang` ; un bord plus bombe que l'autre, une nervure."""
    d = (f"M0 0C{f(L * .22)} {f(-W)} {f(L * .72)} {f(-W * .95)} {f(L)} 0"
         f"C{f(L * .78)} {f(W * .5)} {f(L * .3)} {f(W * .62)} 0 0Z")
    return (f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)})'>"
            f"<path d='{d}' fill='{fill}' stroke='{trait}' stroke-width='.6' stroke-linejoin='round'/>"
            f"<path d='M{f(L * .06)} 0Q{f(L * .5)} {f(-W * .18)} {f(L * .92)} 0' fill='none' stroke='{veine}' stroke-width='.55' opacity='.8'/></g>")


def aile(n, cote, echelle, fill, fill2, trait, veine):
    """Une aile qui part d'un seul point, en haut sur le cote de l'anneau, et
    se deploie en eventail serre vers l'exterieur : les grandes plumes du
    haut aux petites du bas, qui se recouvrent ; une rangee de petites
    plumes par-dessus (des le palier 30). `cote` : -1 a gauche, 1 a droite."""
    rx, ry = pt(52.5, -90 + cote * 50)
    s = ''
    rangs = [(i / max(1, n - 1)) for i in range(n)]
    # Du bas (horizontale, courte) vers le haut (dressee, longue) : celles du
    # haut recouvrent celles du bas.
    for t in reversed(rangs):
        ang = -90 + cote * (22 + t * 88)
        L = (31 - t * 14) * echelle
        W = (6.8 - t * 1.6) * echelle
        s += plume(rx, ry, ang, L, -W * cote, fill, trait, veine)
    if n >= 5:
        for t in reversed(rangs[:-1]):
            ang = -90 + cote * (30 + t * 76)
            s += plume(rx, ry, ang, (16 - t * 6) * echelle, -(5 - t) * echelle * cote, fill2, trait, veine)
    return s


def arene(cle, n):
    clair, mid, sombre, trait, reflet, gem = METAUX[cle]
    ailes, echelle = AILES[cle]
    prisme = cle == 'niv50'
    F = Cadre(cle, cle, marge=12)
    p = cle
    F.defs.append(
        # Le metal : une lumiere en haut a gauche, l'ombre en bas a droite.
        f"<linearGradient id='{p}-m' x1='.15' y1='0' x2='.85' y2='1'><stop offset='0' stop-color='{clair}'/>"
        f"<stop offset='.38' stop-color='{mid}'/><stop offset='.62' stop-color='{sombre}'/><stop offset='.82' stop-color='{mid}'/>"
        f"<stop offset='1' stop-color='{clair}'/></linearGradient>"
        f"<linearGradient id='{p}-v' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{clair}'/><stop offset='.5' stop-color='{mid}'/>"
        f"<stop offset='1' stop-color='{sombre}'/></linearGradient>"
        f"<linearGradient id='{p}-w' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='{sombre}'/><stop offset='.45' stop-color='{mid}'/>"
        f"<stop offset='1' stop-color='{clair}'/></linearGradient>"
        f"<linearGradient id='{p}-pl' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{mid}'/><stop offset='1' stop-color='{sombre}'/></linearGradient>"
        f"<linearGradient id='{p}-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>"
        f"<stop offset='.5' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
        f"<radialGradient id='{p}-g' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#fff'/><stop offset='.35' stop-color='{gem}'/>"
        f"<stop offset='1' stop-color='{melange(gem, '#000000', .55)}'/></radialGradient>"
        f"<mask id='{p}-r'><path d='{ring_path(50, 57)}' fill='#fff' fill-rule='evenodd'/></mask>")
    if prisme:
        F.defs.append(f"<linearGradient id='{p}-i' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff9ad5'/><stop offset='.25' stop-color='#ffe08a'/>"
                      "<stop offset='.5' stop-color='#8ff0c8'/><stop offset='.75' stop-color='#8fd3ff'/><stop offset='1' stop-color='#c3b2ff'/>"
                      "<animateTransform attributeName='gradientTransform' type='rotate' from='0 .5 .5' to='360 .5 .5' dur='8s' repeatCount='indefinite'/></linearGradient>")
    F.style.append(".rt{transform-origin:64px 64px;animation:rt 6s linear infinite}@keyframes rt{to{transform:rotate(360deg)}}"
                   ".gm{transform-box:fill-box;transform-origin:center;animation:gm 2.8s ease-in-out infinite alternate}"
                   "@keyframes gm{from{opacity:.55}to{opacity:1}}"
                   + (".au{transform-origin:64px 64px;animation:au 3.2s ease-in-out infinite alternate}@keyframes au{from{opacity:.45;transform:scale(.97)}to{opacity:.9;transform:scale(1.03)}}" if prisme else ''))
    metal = f'url(#{p}-i)' if prisme else f'url(#{p}-m)'
    c = []
    if prisme:
        fl = F.flou(3.4)
        c.append(f"<g class='au'><circle cx='64' cy='64' r='56' fill='none' stroke='url(#{p}-i)' stroke-width='9' opacity='.7' filter='url(#{fl})'/></g>")
    # Les ailes, derriere l'anneau.
    if ailes:
        c.append(aile(ailes, -1, echelle, f'url(#{p}-w)', f'url(#{p}-v)', trait, reflet) + aile(ailes, 1, echelle, f'url(#{p}-w)', f'url(#{p}-v)', trait, reflet))
    # L'anneau : la bande de metal, son biseau (un filet clair dedans, un
    # trait sombre dehors), ses gravures, et un eclat qui en fait le tour.
    gravures = ''.join(
        f"<line x1='{f(pt(50.6, a)[0])}' y1='{f(pt(50.6, a)[1])}' x2='{f(pt(56.4, a)[0])}' y2='{f(pt(56.4, a)[1])}' stroke='{trait}' stroke-width='.45' opacity='.55'/>"
        for a in range(0, 360, 15) if a not in (90, 270))
    c.append(f"<path d='{ring_path(49.6, 57.4)}' fill='{trait}' fill-rule='evenodd'/>"
             f"<path d='{ring_path(50.2, 56.8)}' fill='{metal}' fill-rule='evenodd'/>"
             f"<circle cx='64' cy='64' r='53.5' fill='none' stroke='{trait}' stroke-width='.5' opacity='.5'/>"
             f"{gravures}"
             f"<circle cx='64' cy='64' r='56.3' fill='none' stroke='{reflet}' stroke-width='.55' opacity='.7'/>"
             f"<circle cx='64' cy='64' r='50.7' fill='none' stroke='{reflet}' stroke-width='.5' opacity='.55'/>"
             f"<g mask='url(#{p}-r)'><g class='rt'><ellipse cx='64' cy='7.5' rx='16' ry='5' fill='url(#{p}-s)'/></g></g>")
    # Les rivets (10, 20) ou les gemmes (30, 50), a trois et neuf heures.
    for a in (0, 180):
        x, y = pt(53.5, a)
        if ailes >= 5:
            c.append(f"<path d='M{f(x)} {f(y - 4.4)}L{f(x + 3.2)} {f(y)}L{f(x)} {f(y + 4.4)}L{f(x - 3.2)} {f(y)}Z' fill='{trait}'/>"
                     f"<path class='gm' d='M{f(x)} {f(y - 3.4)}L{f(x + 2.4)} {f(y)}L{f(x)} {f(y + 3.4)}L{f(x - 2.4)} {f(y)}Z' fill='url(#{p}-g)'/>")
        else:
            c.append(f"<circle cx='{f(x)}' cy='{f(y)}' r='2.2' fill='{trait}'/><circle cx='{f(x)}' cy='{f(y)}' r='1.5' fill='url(#{p}-v)'/>"
                     f"<circle cx='{f(x - .5)}' cy='{f(y - .5)}' r='.5' fill='#fff' opacity='.8'/>")
    # Le cimier : une pointe de metal, sa gemme ; la couronne au palier 50.
    cimier = "M64 1.5 72.5 9 70 17.5 64 21.5 58 17.5 55.5 9Z"
    c.append(f"<path d='{cimier}' fill='{trait}' transform='translate(0 .8)'/>"
             f"<path d='{cimier}' fill='{metal}' stroke='{trait}' stroke-width='.8' stroke-linejoin='round'/>"
             f"<path d='M64 4.5 69.6 9.6 67.8 15.8 64 18.6 60.2 15.8 58.4 9.6Z' fill='none' stroke='{reflet}' stroke-width='.5' opacity='.75'/>"
             f"<circle cx='64' cy='11.6' r='4.3' fill='{trait}'/><circle class='gm' cx='64' cy='11.6' r='3.4' fill='url(#{p}-g)'/>"
             f"<circle cx='62.8' cy='10.4' r='1' fill='#fff' opacity='.9'/>")
    if prisme:
        couronne = "M54 2.5 57.5 -3.5 60.6 1 64 -5.5 67.4 1 70.5 -3.5 74 2.5Z"
        c.append(f"<g transform='translate(0 5)'><path d='{couronne}' fill='url(#{p}-i)' stroke='{trait}' stroke-width='.7' stroke-linejoin='round'/></g>")
    # La plaque du niveau, en bas, et ses deux rubans.
    for cote in (-1, 1):
        x0 = 64 + cote * 17
        c.append(f"<path d='M{f(x0)} 110.5 L{f(x0 + cote * 15)} 113 L{f(x0 + cote * 10.5)} 118.5 L{f(x0 + cote * 15)} 124 L{f(x0)} 122.5Z' "
                 f"fill='url(#{p}-pl)' stroke='{trait}' stroke-width='.7' stroke-linejoin='round'/>"
                 f"<path d='M{f(x0)} 110.5 L{f(x0 + cote * 2.5)} 113 L{f(x0)} 116Z' fill='{trait}' opacity='.6'/>")
    c.append(f"<path d='M45 107.5h38l3.6 7.5-3.6 7.5H45l-3.6-7.5Z' fill='{trait}'/>"
             f"<path d='M45.7 108.6h36.6l3 6.4-3 6.4H45.7l-3-6.4Z' fill='{metal}'/>"
             f"<path d='M47.4 110.4h33.2l2.2 4.6-2.2 4.6H47.4l-2.2-4.6Z' fill='url(#{p}-pl)'/>"
             f"<text x='64' y='118.5' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='9.6' "
             f"letter-spacing='.2' fill='#fff' stroke='{trait}' stroke-width='.5' paint-order='stroke'>NIV {n}</text>")
    if prisme:
        for r, a, sz, d, b in ((62, -40, 3.4, 2.4, 0), (62, -140, 3, 2.8, .9), (61, 32, 2.4, 2.2, 1.5), (61, 148, 2.4, 2.6, .5), (60, 62, 2, 2.3, 1.1)):
            c.append(twinkle(star4(*pt(r, a), sz, '#fff'), d, b))
    F.corps = c
    F.ecrire()


# ------------------------------------------------------------ la Foudre
def foudre():
    """Le cadre de The French Sorcerer (boutique du Choc, version 3.0.7) :
    un anneau d'orage violet, grave de runes, que des eclairs parcourent en
    crepitant ; une brume d'orage autour ; en haut, l'oeil du Sorcier, qui
    brille comme ses yeux sur sa carte ; des arcs qui jaillissent vers
    l'exterieur, et un eclair qui frappe de temps en temps."""
    F = Cadre('foudre', 'fo', marge=12)
    ORAGE = [(0, '#1b0846'), (.4, '#5b2bd6'), (.75, '#a98bff'), (1, '#e9f4ff')]
    F.defs.append("<linearGradient id='fo-m' x1='.1' y1='0' x2='.9' y2='1'><stop offset='0' stop-color='#d9c8ff'/><stop offset='.35' stop-color='#6d3ff0'/>"
                  "<stop offset='.65' stop-color='#22105c'/><stop offset='1' stop-color='#8f6dff'/></linearGradient>"
                  "<radialGradient id='fo-o' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#ffffff'/><stop offset='.3' stop-color='#d7f0ff'/>"
                  "<stop offset='.6' stop-color='#8fb8ff' stop-opacity='.6'/><stop offset='1' stop-color='#6d3ff0' stop-opacity='0'/></radialGradient>"
                  f"<mask id='fo-r'><path d='{ring_path(50, 56.5)}' fill='#fff' fill-rule='evenodd'/></mask>"
                  "<linearGradient id='fo-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#e9f4ff' stop-opacity='0'/>"
                  "<stop offset='.5' stop-color='#e9f4ff'/><stop offset='1' stop-color='#e9f4ff' stop-opacity='0'/></linearGradient>")
    F.style.append(".ec{animation:ec 2.2s steps(1) infinite}.ec2{animation-delay:-.7s}.ec3{animation-delay:-1.5s}"
                   "@keyframes ec{0%,58%{opacity:1}60%{opacity:.15}64%{opacity:1}68%{opacity:.3}72%,100%{opacity:1}}"
                   ".rt{transform-origin:64px 64px;animation:rt 3.4s linear infinite}@keyframes rt{to{transform:rotate(360deg)}}"
                   ".rn{transform-origin:64px 64px;animation:rn 40s linear infinite}@keyframes rn{to{transform:rotate(-360deg)}}"
                   ".oe{transform-box:fill-box;transform-origin:center;animation:oe 2.4s ease-in-out infinite alternate}"
                   "@keyframes oe{from{opacity:.7;transform:scale(.88)}to{opacity:1;transform:scale(1.1)}}"
                   ".fr{animation:fr 5.5s steps(1) infinite}@keyframes fr{0%,88%{opacity:0}89%{opacity:1}91%{opacity:.2}93%{opacity:1}96%,100%{opacity:0}}")
    fl2 = F.flou(3)
    fl4 = F.flou(4.5)
    c = [f"<circle cx='64' cy='64' r='55' fill='none' stroke='#7c4dff' stroke-width='10' opacity='.55' filter='url(#{fl4})'/>"]
    # La brume d'orage, des deux cotes, qui monte vers l'oeil.
    for a0, a1, ph in ((150, 262, 0), (30, -82, 1.7)):
        c.append(f"<g filter='url(#{fl2})' opacity='.8'>{F.trainee(55, a0, a1, 14, 1, 12, 0, .9, ORAGE, (1.6, 1.3, ph))}</g>"
                 + F.trainee(57.5, a0 + (a1 - a0) * .3, a1, 12, .1, 2.2, 0, .85, ORAGE, (1.4, 1.8, ph + 1)))
    # L'anneau : metal d'orage, biseau, runes gravees qui tournent lentement.
    runes = ''
    rnd = random.Random(5)
    for k in range(24):
        a = k * 15 + 7.5
        x, y = pt(53.4, a)
        g = rnd.choice(['M-1.2 -1.4V1.4M-1.2 0H1.2', 'M-1.2 1.4L0 -1.4L1.2 1.4', 'M-1.2 -1.4L1.2 1.4M1.2 -1.4L-1.2 1.4', 'M0 -1.4V1.4M-1.2 -.6L1.2 -.6', 'M-1.2 -1.4H1.2L-1.2 1.4H1.2'])
        runes += f"<path d='{g}' transform='translate({f(x)} {f(y)}) rotate({f(a + 90)})' fill='none' stroke='#cfe4ff' stroke-width='.45' stroke-linecap='round' opacity='.75'/>"
    c.append(f"<path d='{ring_path(49.6, 57)}' fill='#0e0526' fill-rule='evenodd'/>"
             f"<path d='{ring_path(50.2, 56.4)}' fill='url(#fo-m)' fill-rule='evenodd'/>"
             f"<g class='rn'>{runes}</g>"
             "<circle cx='64' cy='64' r='56' fill='none' stroke='#e9f4ff' stroke-width='.5' opacity='.7'/>"
             "<circle cx='64' cy='64' r='50.6' fill='none' stroke='#b9a4ff' stroke-width='.5' opacity='.6'/>"
             "<g mask='url(#fo-r)'><g class='rt'><ellipse cx='64' cy='8' rx='14' ry='4.5' fill='url(#fo-s)'/></g></g>")
    # Des eclairs qui courent le long de l'anneau.
    c.append(crepite(F, 53.3, 196, 238, '#b79bff', pas=6, ecart=2, graine=31, large=2.6)
             + crepite(F, 53.3, -58, -16, '#b79bff', pas=6, ecart=2, graine=37, large=2.6, classe='ec ec2')
             + crepite(F, 53.3, 70, 112, '#8fb8ff', pas=6, ecart=1.8, graine=41, large=2.2, classe='ec ec3'))
    # Des arcs qui jaillissent vers l'exterieur.
    for (a0, a1), g, k in (((214, 186), 51, 'ec'), ((-34, -6), 53, 'ec ec2'), ((156, 128), 57, 'ec ec3'), ((24, 52), 59, 'ec'), ((100, 80), 61, 'ec ec2')):
        c.append(crepite(F, 61.5, a0, a1, '#c9b6ff', pas=4, ecart=3, graine=g, large=2.4, classe=k))
    # L'eclair qui frappe : du haut de l'oeil, vers l'exterieur, de temps en temps.
    c.append(f"<g class='fr'><path d='M64 4 59 -2 63 -1.5 57 -9' fill='none' stroke='#e9f4ff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' filter='url(#{F.flou(.8)})'/>"
             "<path d='M64 4 59 -2 63 -1.5 57 -9' fill='none' stroke='#fff' stroke-width='.6' stroke-linecap='round' stroke-linejoin='round'/></g>")
    # L'oeil du Sorcier : un orbe de lumiere sur un losange sombre.
    c.append("<g class='oe'><circle cx='64' cy='8.5' r='15' fill='url(#fo-o)' opacity='.75'/></g>"
             "<path d='M64 -1.5 77 8.5 64 18.5 51 8.5Z' fill='#0e0526' stroke='#d7c6ff' stroke-width='1' stroke-linejoin='round'/>"
             "<path d='M64 1.8 72.6 8.5 64 15.2 55.4 8.5Z' fill='#2a1470'/>"
             "<g class='oe'><circle cx='64' cy='8.5' r='9' fill='url(#fo-o)'/></g>"
             "<ellipse cx='64' cy='8.5' rx='5.6' ry='2' fill='#fff'/><circle cx='64' cy='8.5' r='1.3' fill='#8fb8ff'/>")
    for r, a, sz, d, b in ((61, 128, 1.8, 2.2, .3), (61, 52, 1.6, 2.6, 1.2), (62, 168, 1.4, 2.4, .8), (62, 12, 1.4, 2, 1.6)):
        c.append(twinkle(star4(*pt(r, a), sz, '#e9f4ff'), d, b))
    F.corps = c
    F.ecrire()


if __name__ == '__main__':
    for cle, n in (('niv10', 10), ('niv20', 20), ('niv30', 30), ('niv50', 50)):
        arene(cle, n)
    foudre()
    toxique()
    deter()
    choc()
    secrete()
