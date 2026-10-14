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

    def __init__(self, nom, p):
        self.nom, self.p = nom, p
        self.defs, self.style, self.corps = [], [STYLE_TW], []
        self.n = 0

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
        svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><defs>{''.join(self.defs)}</defs>"
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
METAUX = {
    #        clair      milieu     sombre     trait      reflet
    'niv10': ('#ffe0c4', '#d08a4c', '#7a3f12', '#4a2306', '#ffd9b5'),
    'niv20': ('#ffffff', '#c9d1de', '#6f7889', '#343a47', '#ffffff'),
    'niv30': ('#fff6c8', '#f2c24a', '#9a620a', '#563300', '#fff3b0'),
    'niv50': ('#ffe3f4', '#b38cff', '#3a7bd5', '#24104f', '#ffffff'),
}
# Ce que chaque palier ajoute : le laurier (feuilles par branche, arc
# couvert), les epees, les gemmes, le prisme.
PALIERS = {'niv10': (5, 64, False, False), 'niv20': (6, 82, True, False),
           'niv30': (8, 104, True, True), 'niv50': (9, 120, True, True)}


def feuille(x, y, dx, dy, L, W, fill, trait):
    """Une feuille de laurier : pointue aux deux bouts, une nervure."""
    tx, ty = x + dx * L, y + dy * L
    mx, my = x + dx * L * .5, y + dy * L * .5
    nx, ny = -dy, dx
    return (f"<path d='M{f(x)} {f(y)}Q{f(mx + nx * W)} {f(my + ny * W)} {f(tx)} {f(ty)}Q{f(mx - nx * W)} {f(my - ny * W)} {f(x)} {f(y)}Z' "
            f"fill='{fill}' stroke='{trait}' stroke-width='.5' stroke-linejoin='round'/>"
            f"<path d='M{f(x + dx * L * .12)} {f(y + dy * L * .12)}L{f(x + dx * L * .78)} {f(y + dy * L * .78)}' stroke='{trait}' stroke-width='.35' opacity='.6'/>")


def laurier(n, arc, fill, trait):
    """Deux branches qui partent du bas et remontent le long de l'anneau,
    les feuilles de plus en plus petites vers la pointe."""
    s = ''
    R = 58.6
    for cote in (1, -1):
        a0 = 90 + cote * 9
        a1 = a0 + cote * arc
        p0, p1 = pt(R, a0), pt(R, a1)
        s += (f"<path d='M{f(p0[0])} {f(p0[1])}A{R} {R} 0 0 {1 if cote > 0 else 0} {f(p1[0])} {f(p1[1])}' fill='none' "
              f"stroke='{trait}' stroke-width='1.3' stroke-linecap='round'/>")
        for k in range(n):
            t = (k + .5) / n
            a = a0 + cote * arc * t
            ta = math.radians(a + cote * 90)
            tdx, tdy = math.cos(ta), math.sin(ta)
            ox, oy = math.cos(math.radians(a)), math.sin(math.radians(a))
            L = 8.2 * (1 - .4 * t)
            W = L * .34
            for side in (1, -1):
                dx, dy = tdx + side * .62 * ox, tdy + side * .62 * oy
                m = math.hypot(dx, dy)
                x, y = pt(R + side * .6, a)
                s += feuille(x, y, dx / m, dy / m, L, W, fill, trait)
        # La pointe de la branche : une feuille dans l'axe.
        ta = math.radians(a1 + cote * 90)
        s += feuille(p1[0], p1[1], math.cos(ta), math.sin(ta), 6, 2, fill, trait)
    return s


def epee(x0, y0, x1, y1, lame, garde, trait):
    """Une epee, du pommeau (x0, y0) a la pointe (x1, y1)."""
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    gx, gy = x0 + ux * 7.5, y0 + uy * 7.5        # la garde
    w = 1.7
    pointe = (x1, y1)
    epaule = (x1 - ux * 4, y1 - uy * 4)
    lame_pts = [(gx + nx * w, gy + ny * w), (epaule[0] + nx * w, epaule[1] + ny * w), pointe,
                (epaule[0] - nx * w, epaule[1] - ny * w), (gx - nx * w, gy - ny * w)]
    return (f"<polygon points='{P(*lame_pts)}' fill='{lame}' stroke='{trait}' stroke-width='.55' stroke-linejoin='round'/>"
            f"<line x1='{f(gx + ux)}' y1='{f(gy + uy)}' x2='{f(epaule[0])}' y2='{f(epaule[1])}' stroke='#fff' stroke-width='.6' opacity='.75'/>"
            f"<line x1='{f(x0)}' y1='{f(y0)}' x2='{f(gx)}' y2='{f(gy)}' stroke='{trait}' stroke-width='2.4' stroke-linecap='round'/>"
            f"<line x1='{f(gx - nx * 5)}' y1='{f(gy - ny * 5)}' x2='{f(gx + nx * 5)}' y2='{f(gy + ny * 5)}' stroke='{garde}' stroke-width='2.4' stroke-linecap='round'/>"
            f"<line x1='{f(gx - nx * 5)}' y1='{f(gy - ny * 5)}' x2='{f(gx + nx * 5)}' y2='{f(gy + ny * 5)}' stroke='{trait}' stroke-width='.4' stroke-linecap='round' opacity='.6'/>"
            f"<circle cx='{f(x0)}' cy='{f(y0)}' r='2' fill='{garde}' stroke='{trait}' stroke-width='.5'/>")


def gemme(x, y, s, fill, trait):
    return (f"<path d='M{f(x)} {f(y - s)}L{f(x + s * .8)} {f(y)}L{f(x)} {f(y + s)}L{f(x - s * .8)} {f(y)}Z' fill='{fill}' stroke='{trait}' stroke-width='.5'/>"
            f"<path d='M{f(x)} {f(y - s)}L{f(x + s * .8)} {f(y)}L{f(x)} {f(y)}Z' fill='#fff' opacity='.45'/>")


def arene(cle, n):
    clair, mid, sombre, trait, reflet = METAUX[cle]
    feuilles, arc, epees, gemmes = PALIERS[cle]
    prisme = cle == 'niv50'
    F = Cadre(cle, cle)
    p = cle
    F.defs.append(f"<linearGradient id='{p}-m' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{clair}'/>"
                  f"<stop offset='.45' stop-color='{mid}'/><stop offset='1' stop-color='{sombre}'/></linearGradient>"
                  f"<linearGradient id='{p}-b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{clair}'/><stop offset='.55' stop-color='{mid}'/>"
                  f"<stop offset='1' stop-color='{sombre}'/></linearGradient>"
                  f"<linearGradient id='{p}-g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>"
                  f"<stop offset='.5' stop-color='#fff' stop-opacity='.9'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
                  f"<clipPath id='{p}-c'><path d='M52.5 1.5h23v10.5c0 7-5 11-11.5 13.5-6.5-2.5-11.5-6.5-11.5-13.5Z'/></clipPath>"
                  f"<mask id='{p}-r'><path d='{ring_path(50, 55)}' fill='#fff' fill-rule='evenodd'/></mask>"
                  f"<radialGradient id='{p}-h'><stop offset='0' stop-color='{reflet}' stop-opacity='.7'/><stop offset='1' stop-color='{reflet}' stop-opacity='0'/></radialGradient>")
    F.style.append(".lu{animation:lu 4s ease-in-out infinite}@keyframes lu{0%,55%{transform:translateX(-32px)}100%{transform:translateX(32px)}}"
                   ".rt{transform-origin:64px 64px;animation:rt 7s linear infinite}@keyframes rt{to{transform:rotate(360deg)}}"
                   + (".pr{animation:pr 8s linear infinite}@keyframes pr{to{filter:hue-rotate(360deg)}}" if prisme else ''))
    c = []
    if prisme:
        fl = F.flou(2.6)
        c.append(f"<circle cx='64' cy='64' r='55' fill='none' stroke='{mid}' stroke-width='7' opacity='.55' filter='url(#{fl})'/>")
    c.append(f"<g class='{'pr' if prisme else ''}'>")
    # L'anneau de metal, biseaute, et un reflet qui en fait le tour.
    c.append(f"<path d='{ring_path(50, 55)}' fill='url(#{p}-m)' fill-rule='evenodd'/>"
             f"<circle cx='64' cy='64' r='55' fill='none' stroke='{trait}' stroke-width='.8'/>"
             f"<circle cx='64' cy='64' r='50.6' fill='none' stroke='{reflet}' stroke-width='.7' opacity='.8'/>"
             f"<circle cx='64' cy='64' r='52.8' fill='none' stroke='{trait}' stroke-width='.35' opacity='.45'/>"
             f"<g mask='url(#{p}-r)'><g class='rt'><ellipse cx='64' cy='9' rx='13' ry='5' fill='url(#{p}-g)'/></g></g>")
    c.append(laurier(feuilles, arc, f'url(#{p}-b)', trait))
    if gemmes:
        for a in (180, 0, 135, 45):
            x, y = pt(52.5, a)
            c.append(gemme(x, y, 3.2 if a in (0, 180) else 2.5, 'url(#%s-m)' % p if prisme else '#8a78f5', trait))
    if epees:
        c.append(epee(78.5, 16.5, 31, 3.5, f'url(#{p}-m)', f'url(#{p}-b)', trait)
                 + epee(49.5, 16.5, 97, 3.5, f'url(#{p}-m)', f'url(#{p}-b)', trait))
    # L'ecusson, son chiffre, et un eclat qui passe dessus.
    c.append(f"<circle cx='64' cy='11' r='15' fill='url(#{p}-h)'/>"
             f"<path d='M52.5 1.5h23v10.5c0 7-5 11-11.5 13.5-6.5-2.5-11.5-6.5-11.5-13.5Z' fill='url(#{p}-m)' stroke='{trait}' stroke-width='1'/>"
             f"<path d='M55 4h18v8c0 5.4-3.8 8.6-9 10.7-5.2-2.1-9-5.3-9-10.7Z' fill='none' stroke='{reflet}' stroke-width='.6' opacity='.85'/>"
             f"<text x='64' y='16.4' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='11.5' "
             f"fill='{trait}' stroke='{reflet}' stroke-width='.3'>{n}</text>"
             f"<g clip-path='url(#{p}-c)'><rect class='lu' x='45' y='0' width='12' height='30' fill='url(#{p}-g)' transform='skewX(-18)'/></g>")
    c.append("</g>")
    if prisme:
        for r, a, s, d, b in ((61, -38, 3.6, 2.4, 0), (61, -142, 3, 2.8, .9), (60, 30, 2.4, 2.2, 1.5), (60, 150, 2.4, 2.6, .5)):
            c.append(twinkle(star4(*pt(r, a), s, '#fff'), d, b))
    F.corps = c
    F.ecrire()


if __name__ == '__main__':
    for cle, n in (('niv10', 10), ('niv20', 20), ('niv30', 30), ('niv50', 50)):
        arene(cle, n)
    toxique()
    deter()
    choc()
    secrete()
