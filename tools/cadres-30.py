#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dessine les cadres d'avatar de la version 3.0.

    python3 tools/cadres-30.py

Ecrit dans assets/cadres/ :
  niv10.svg niv20.svg niv30.svg niv50.svg   les niveaux de combattant
                                            (js/combat/niveaux.js) : l'arene,
                                            en bronze, argent, or et prisme
  toxique.svg deter.svg                     les deux Sections (Boutique)
  secrete.svg                               la premiere Secrete (quete)

Meme gabarit que les autres cadres decores (css/reflets.css) : 128 x 128,
l'avatar au centre sur un rayon de 50 ; l'anneau va de 51,5 a 57, et le
decor deborde autour. Chaque fichier a son prefixe d'identifiants : deux
cadres sur une meme page ne se marchent pas dessus."""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'cadres')
RM = "@media (prefers-reduced-motion:reduce){*{animation:none!important}}"


def anneau(fill, extra=''):
    return (f"<path d='M121 64A57 57 0 1 0 7 64A57 57 0 1 0 121 64ZM115.5 64A51.5 51.5 0 1 1 12.5 64A51.5 51.5 0 1 1 115.5 64Z' "
            f"fill='{fill}' fill-rule='evenodd'{extra}/>")


def filets(clair, sombre):
    return (f"<circle cx='64' cy='64' r='51.5' fill='none' stroke='{sombre}' stroke-width='.7' opacity='.7'/>"
            f"<circle cx='64' cy='64' r='57' fill='none' stroke='{clair}' stroke-width='.6' opacity='.8'/>")


def pt(r, a):
    a = math.radians(a)
    return 64 + r * math.cos(a), 64 + r * math.sin(a)


def lauriers(fill, trait):
    """Deux branches de laurier le long du bas de l'anneau."""
    s = []
    for cote in (-1, 1):
        for k in range(5):
            a = 90 + cote * (24 + k * 13)
            for d in (-1, 1):
                rot = a + 90 + d * 35 + (0 if cote < 0 else 180)
                ox, oy = pt(60 + d * 2.4, a + cote * 3)
                s.append(f"<ellipse cx='{ox:.2f}' cy='{oy:.2f}' rx='4.3' ry='1.8' transform='rotate({rot:.1f} {ox:.2f} {oy:.2f})' "
                         f"fill='{fill}' stroke='{trait}' stroke-width='.5'/>")
    return ''.join(s)


def epee(x0, y0, x1, y1, lame, garde):
    """Une epee de (x0, y0) (pommeau) a (x1, y1) (pointe)."""
    dx, dy = x1 - x0, y1 - y0
    l = math.hypot(dx, dy)
    ux, uy = dx / l, dy / l
    gx, gy = x0 + ux * 7, y0 + uy * 7
    px, py = -uy, ux
    return (f"<line x1='{gx:.1f}' y1='{gy:.1f}' x2='{x1:.1f}' y2='{y1:.1f}' stroke='{lame}' stroke-width='3' stroke-linecap='round'/>"
            f"<line x1='{gx:.1f}' y1='{gy:.1f}' x2='{x1:.1f}' y2='{y1:.1f}' stroke='#fff' stroke-width='.8' opacity='.7'/>"
            f"<line x1='{gx - px * 5:.1f}' y1='{gy - py * 5:.1f}' x2='{gx + px * 5:.1f}' y2='{gy + py * 5:.1f}' stroke='{garde}' stroke-width='2.6' stroke-linecap='round'/>"
            f"<line x1='{x0:.1f}' y1='{y0:.1f}' x2='{gx:.1f}' y2='{gy:.1f}' stroke='{garde}' stroke-width='2.2' stroke-linecap='round'/>"
            f"<circle cx='{x0:.1f}' cy='{y0:.1f}' r='2' fill='{garde}'/>")


def ecrire(nom, corps):
    with open(os.path.join(OUT, nom + '.svg'), 'w', encoding='utf-8') as f:
        f.write(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>{corps}</svg>\n")
    print('cadre', nom)


# ------------------------------------------------------------ l'arene
METAUX = {
    'niv10': ('Bronze', ['#ffe0c4', '#d08a4c', '#7a3f12'], '#5a2c08', '#ffd9b5'),
    'niv20': ('Argent', ['#ffffff', '#c9d1de', '#6f7889'], '#3d4452', '#ffffff'),
    'niv30': ('Or', ['#fff6c8', '#f2c24a', '#9a620a'], '#5e3a00', '#fff3b0'),
    'niv50': ('Prisme', ['#ffd3ec', '#b38cff', '#39b8ff'], '#2a0b63', '#ffffff'),
}


def arene(cle, n):
    _, (c1, c2, c3), sombre, clair = METAUX[cle]
    p = cle
    prisme = cle == 'niv50'
    defs = (f"<defs><linearGradient id='{p}-m' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{c1}'/>"
            f"<stop offset='.5' stop-color='{c2}'/><stop offset='1' stop-color='{c3}'/></linearGradient>"
            f"<linearGradient id='{p}-b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{c1}'/><stop offset='1' stop-color='{c3}'/></linearGradient>"
            f"<linearGradient id='{p}-g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>"
            f"<stop offset='.5' stop-color='#fff' stop-opacity='.85'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
            f"<clipPath id='{p}-c'><path d='M52 2.5h24v14c0 7-5.5 11.5-12 14-6.5-2.5-12-7-12-14Z'/></clipPath></defs>")
    style = ("<style>.lu{animation:lu 3.6s ease-in-out infinite}@keyframes lu{0%,55%{transform:translateX(-30px)}100%{transform:translateX(30px)}}"
             + (".pr{animation:pr 7s linear infinite}@keyframes pr{to{filter:hue-rotate(360deg)}}" if prisme else '')
             + RM + "</style>")
    corps = defs + style + f"<g class='{'pr' if prisme else ''}'>"
    corps += anneau(f'url(#{p}-m)') + filets(clair, sombre)
    corps += lauriers(f'url(#{p}-b)', sombre)
    # Deux epees croisees derriere l'ecusson.
    corps += epee(37, 24, 91, 3, f'url(#{p}-b)', sombre) + epee(91, 24, 37, 3, f'url(#{p}-b)', sombre)
    # L'ecusson, son chiffre, et un reflet qui passe.
    corps += (f"<path d='M52 2.5h24v14c0 7-5.5 11.5-12 14-6.5-2.5-12-7-12-14Z' fill='url(#{p}-m)' stroke='{sombre}' stroke-width='1'/>"
              f"<path d='M54.5 5h19v11.3c0 5.6-4.4 9.2-9.5 11.3-5.1-2.1-9.5-5.7-9.5-11.3Z' fill='none' stroke='{clair}' stroke-width='.6' opacity='.8'/>"
              f"<text x='64' y='19.6' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='{11 if n < 100 else 9}' "
              f"fill='{sombre}' stroke='{clair}' stroke-width='.35'>{n}</text>"
              f"<g clip-path='url(#{p}-c)'><rect class='lu' x='44' y='0' width='14' height='34' fill='url(#{p}-g)' transform='skewX(-18)'/></g>")
    corps += "</g>"
    ecrire(cle, corps)


# ------------------------------------------------------------ les Sections
ETOILE = "M0-6.2 1.6-2 6-1.9 2.5.8 3.7 5 0 2.6-3.7 5-2.5.8-6-1.9-1.6-2Z"


def section(cle, c, fonce, clair, motif):
    p = cle
    defs = (f"<defs><linearGradient id='{p}-a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{clair}'/>"
            f"<stop offset='.5' stop-color='{c}'/><stop offset='1' stop-color='{fonce}'/></linearGradient>"
            f"<radialGradient id='{p}-e' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='{clair}'/><stop offset='1' stop-color='{c}'/></radialGradient></defs>")
    if motif == 'gouttes':
        style = ("<style>.gt{animation:gt 2.6s ease-in infinite}.gt2{animation-delay:-.9s}.gt3{animation-delay:-1.7s}"
                 "@keyframes gt{0%,40%{transform:translateY(0);opacity:1}100%{transform:translateY(9px);opacity:0}}" + RM + "</style>")
        deco = ''
        for k, (a, cls) in enumerate(((110, 'gt'), (90, 'gt gt2'), (70, 'gt gt3'))):
            x, y = pt(57, a)
            deco += (f"<path d='M{x:.1f} {y - 1:.1f}c2.2 3.6 3.4 5.4 3.4 7.2a3.4 3.4 0 0 1-6.8 0c0-1.8 1.2-3.6 3.4-7.2Z' fill='{c}' stroke='{fonce}' stroke-width='.6'/>"
                     f"<circle class='{cls}' cx='{x:.1f}' cy='{y + 11:.1f}' r='1.6' fill='{c}'/>")
    else:
        style = ("<style>.ai{animation:ai 2.2s ease-in-out infinite alternate}@keyframes ai{from{opacity:.55}to{opacity:1}}" + RM + "</style>")
        deco = ''
        for cote in (-1, 1):
            for k in range(2):
                x = 64 + cote * (57.5 + k * 4.6)
                deco += (f"<path class='ai' d='M{x:.1f} {53 + k * 2:.1f}l{cote * 5:.1f} {11 - k * 2}-{cote * 5:.1f} {11 - k * 2}' fill='none' stroke='{clair if k == 0 else c}' "
                         f"stroke-width='{3 - k * .7:.1f}' stroke-linecap='round' stroke-linejoin='round' opacity='{1 - k * .25:.2f}'/>")
    corps = defs + style + anneau(f'url(#{p}-a)') + filets(clair, fonce) + deco
    corps += (f"<circle cx='64' cy='7.5' r='8.5' fill='url(#{p}-e)' stroke='{fonce}' stroke-width='1'/>"
              f"<path d='{ETOILE}' transform='translate(64 8) scale(1.05)' fill='#fff'/>")
    ecrire(cle, corps)


# ------------------------------------------------------------ la Secrete
def secrete():
    p = 'se'
    defs = ("<defs><linearGradient id='se-a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffffff'/>"
            "<stop offset='.3' stop-color='#c9d6ff'/><stop offset='.55' stop-color='#ffd0ec'/><stop offset='.8' stop-color='#c8fff0'/>"
            "<stop offset='1' stop-color='#8e98b3'/></linearGradient>"
            "<linearGradient id='se-g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>"
            "<stop offset='.5' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
            "<mask id='se-m'><path d='M121 64A57 57 0 1 0 7 64A57 57 0 1 0 121 64ZM115.5 64A51.5 51.5 0 1 1 12.5 64A51.5 51.5 0 1 1 115.5 64Z' fill='#fff' fill-rule='evenodd'/></mask></defs>")
    style = ("<style>.lu{transform-origin:64px 64px;animation:lu 5s linear infinite}@keyframes lu{to{transform:rotate(360deg)}}"
             ".tw{transform-box:fill-box;transform-origin:center;animation:tw 2.2s ease-in-out infinite alternate}.tw2{animation-delay:-.7s}.tw3{animation-delay:-1.4s}"
             "@keyframes tw{from{opacity:.2;transform:scale(.5)}to{opacity:1;transform:scale(1)}}" + RM + "</style>")
    corps = defs + style + anneau('url(#se-a)') + filets('#ffffff', '#5a6480')
    corps += "<g mask='url(#se-m)'><rect class='lu' x='60' y='0' width='10' height='70' fill='url(#se-g)'/></g>"
    # Le medaillon et sa serrure.
    corps += ("<circle cx='64' cy='8' r='9' fill='#1b1530' stroke='url(#se-a)' stroke-width='2'/>"
              "<circle cx='64' cy='6.3' r='2.4' fill='url(#se-a)'/><path d='M62.6 7.5h2.8l1 5.3h-4.8Z' fill='url(#se-a)'/>")
    for k, (x, y, s) in enumerate(((16, 30, 1), (114, 94, .8), (22, 104, .7), (108, 24, .9))):
        corps += (f"<path class='tw tw{k % 3 + 1}' d='M{x} {y - 5 * s}l{1.2 * s} {3.8 * s} {3.8 * s} {1.2 * s}-{3.8 * s} {1.2 * s}-{1.2 * s} {3.8 * s}"
                  f"-{1.2 * s}-{3.8 * s}-{3.8 * s}-{1.2 * s} {3.8 * s}-{1.2 * s}Z' fill='#fff'/>")
    ecrire('secrete', corps)


if __name__ == '__main__':
    for cle, n in (('niv10', 10), ('niv20', 20), ('niv30', 30), ('niv50', 50)):
        arene(cle, n)
    section('toxique', '#62d84e', '#1f5a14', '#e3fbd6', 'gouttes')
    section('deter', '#7c3aed', '#33106e', '#ede4ff', 'chevrons')
    secrete()
