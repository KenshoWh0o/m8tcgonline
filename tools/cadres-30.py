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
# Leurs couleurs sont celles des boites des Starter Decks : un vert toxique,
# fume et luisant, pour Toxique ; un violet electrique, zebre d'eclairs,
# pour Deter. Un anneau epais et lumineux, un ecusson en haut, et ce qui
# fait la Section : le poison qui bout et qui coule, la foudre qui crepite.

def halo(p, c):
    """Une lueur douce derriere l'anneau."""
    return (f"<defs><filter id='{p}-h' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='2.6'/></filter></defs>"
            f"<circle cx='64' cy='64' r='55' fill='none' stroke='{c}' stroke-width='7' opacity='.55' filter='url(#{p}-h)'/>")


def toxique():
    p = 'tx'
    neon, mid, fonce, clair = '#86ff5e', '#38c23c', '#0c4a1c', '#e2ffd4'
    defs = (f"<defs><linearGradient id='{p}-a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{clair}'/>"
            f"<stop offset='.28' stop-color='{neon}'/><stop offset='.7' stop-color='{mid}'/><stop offset='1' stop-color='{fonce}'/></linearGradient>"
            f"<radialGradient id='{p}-b' cx='.35' cy='.3' r='.75'><stop offset='0' stop-color='#ffffff'/><stop offset='.35' stop-color='{neon}'/>"
            f"<stop offset='1' stop-color='{mid}'/></radialGradient>"
            f"<linearGradient id='{p}-e' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1d6e2c'/><stop offset='1' stop-color='{fonce}'/></linearGradient></defs>")
    style = ("<style>.bu{transform-box:fill-box;transform-origin:center;animation:bu 2.8s ease-in infinite}"
             ".bu2{animation-delay:-.9s}.bu3{animation-delay:-1.8s}"
             "@keyframes bu{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-8px) scale(1.1);opacity:0}}"
             ".gt{animation:gt 2.4s ease-in infinite}.gt2{animation-delay:-.8s}.gt3{animation-delay:-1.6s}"
             "@keyframes gt{0%,45%{transform:translateY(0);opacity:1}100%{transform:translateY(10px);opacity:0}}" + RM + "</style>")
    corps = defs + style + halo(p, neon)
    corps += anneau(f'url(#{p}-a)') + filets(clair, fonce)
    # Le poison qui bout : des bulles sur l'anneau, dont certaines s'echappent.
    for a, r, cls in ((205, 3.4, ''), (225, 2.2, 'bu'), (250, 2.8, ''), (290, 2.4, 'bu bu2'), (315, 3.2, ''), (335, 2.1, 'bu bu3'),
                      (160, 2.6, ''), (20, 2.4, ''), (40, 1.8, 'bu bu2')):
        x, y = pt(54.3, a)
        corps += (f"<circle class='{cls}' cx='{x:.1f}' cy='{y:.1f}' r='{r}' fill='url(#{p}-b)' stroke='{fonce}' stroke-width='.5'/>"
                  f"<circle cx='{x - r * .35:.1f}' cy='{y - r * .35:.1f}' r='{r * .28:.2f}' fill='#fff' opacity='.8'/>")
    # Et qui coule : trois coulures sous l'anneau, une goutte qui tombe.
    for a, h, cls in ((112, 9, 'gt'), (90, 13, 'gt gt2'), (70, 8, 'gt gt3')):
        x, y = pt(56.5, a)
        corps += (f"<path d='M{x - 3.2:.1f} {y - 2:.1f}c0 {h * .5:.1f} 1.2 {h:.1f} 3.2 {h:.1f}s3.2-{h * .5:.1f} 3.2-{h:.1f}Z' fill='url(#{p}-a)' stroke='{fonce}' stroke-width='.5'/>"
                  f"<path d='M{x - 1.2:.1f} {y:.1f}v{h * .55:.1f}' stroke='#fff' stroke-width='.8' stroke-linecap='round' opacity='.7'/>"
                  f"<circle class='{cls}' cx='{x:.1f}' cy='{y + h + 3.4:.1f}' r='1.8' fill='{neon}' stroke='{fonce}' stroke-width='.4'/>")
    # L'ecusson : un hexagone, une goutte.
    corps += (f"<path d='M64 -1.5 73.5 4v11L64 20.5 54.5 15V4Z' fill='url(#{p}-e)' stroke='{neon}' stroke-width='1.4' stroke-linejoin='round'/>"
              f"<path d='M64 3.6c2.9 4.4 4.4 6.6 4.4 8.6a4.4 4.4 0 0 1-8.8 0c0-2 1.5-4.2 4.4-8.6Z' fill='url(#{p}-b)'/>"
              f"<path d='M62.4 10.6a2 2 0 0 0 1.6 3' stroke='#fff' stroke-width='.9' fill='none' stroke-linecap='round'/>")
    ecrire('toxique', corps)


def deter():
    p = 'dt'
    elec, mid, fonce, clair = '#b79bff', '#7c3aed', '#25095f', '#f1ebff'
    defs = (f"<defs><linearGradient id='{p}-a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{clair}'/>"
            f"<stop offset='.3' stop-color='{elec}'/><stop offset='.68' stop-color='{mid}'/><stop offset='1' stop-color='{fonce}'/></linearGradient>"
            f"<linearGradient id='{p}-e' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#5a26c9'/><stop offset='1' stop-color='{fonce}'/></linearGradient></defs>")
    style = ("<style>.ec{animation:ec 1.9s steps(1) infinite}.ec2{animation-delay:-.6s}.ec3{animation-delay:-1.2s}"
             "@keyframes ec{0%,62%{opacity:1}64%{opacity:.15}68%{opacity:1}72%{opacity:.3}76%,100%{opacity:1}}"
             ".et{transform-box:fill-box;transform-origin:center;animation:et 1.6s ease-in-out infinite alternate}.et2{animation-delay:-.8s}"
             "@keyframes et{from{opacity:.25;transform:scale(.6)}to{opacity:1;transform:scale(1)}}" + RM + "</style>")
    corps = defs + style + halo(p, elec)
    corps += anneau(f'url(#{p}-a)') + filets(clair, fonce)
    # La foudre : trois eclairs qui traversent l'anneau et crepitent.
    def eclair(a, l, cls):
        x, y = pt(54.3, a)
        ox, oy = pt(54.3 + l, a)
        ix, iy = pt(54.3 - l * .55, a)
        nx, ny = -(oy - iy), (ox - ix)
        n = math.hypot(nx, ny) or 1
        nx, ny = nx / n * 3.2, ny / n * 3.2
        pts = [(ix, iy), (x + nx, y + ny), (x - nx * .4, y - ny * .4), (ox, oy)]
        d = 'M' + ' L'.join(f'{px:.1f} {py:.1f}' for px, py in pts)
        return (f"<path class='{cls}' d='{d}' fill='none' stroke='{elec}' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round' opacity='.55'/>"
                f"<path class='{cls}' d='{d}' fill='none' stroke='#ffffff' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/>")
    corps += eclair(200, 9, 'ec') + eclair(338, 10, 'ec ec2') + eclair(128, 8, 'ec ec3')
    for a, cls in ((230, 'et'), (305, 'et et2'), (95, 'et'), (165, 'et et2')):
        x, y = pt(60.5, a)
        corps += f"<circle class='{cls}' cx='{x:.1f}' cy='{y:.1f}' r='1.5' fill='#fff'/>"
    # L'ecusson : un blason, un double chevron qui monte.
    corps += (f"<path d='M54 -1h20v11.5c0 6-4.4 9.6-10 11.8-5.6-2.2-10-5.8-10-11.8Z' fill='url(#{p}-e)' stroke='{elec}' stroke-width='1.4' stroke-linejoin='round'/>"
              f"<path d='M58.5 10.5 64 5.5l5.5 5M58.5 15.5 64 10.5l5.5 5' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>")
    ecrire('deter', corps)


# ------------------------------------------------------------ le Choc
def choc():
    """Les deux Sections dans un meme anneau : le vert Toxique a gauche, le
    violet Deter a droite, coupes en biais par un trait de lumiere. En haut,
    un medaillon partage de meme, frappe d'un eclair blanc ; une bulle
    d'un cote, un crepitement de l'autre."""
    p = 'ck'
    vert = ('#e2ffd4', '#86ff5e', '#38c23c', '#0c4a1c')
    viol = ('#f1ebff', '#b79bff', '#7c3aed', '#25095f')
    # La coupe : une droite de (70, -4) a (58, 132), qui passe par le
    # centre du medaillon (64, 8) a peu pres.
    a, b = (70.5, -4), (57.5, 132)
    # Clairs pres de la coupe, sombres vers les bords : le choc se lit au
    # milieu.
    defs = (f"<defs><linearGradient id='{p}-v' x1='.62' y1='.2' x2='0' y2='.8'><stop offset='0' stop-color='{vert[0]}'/>"
            f"<stop offset='.25' stop-color='{vert[1]}'/><stop offset='.65' stop-color='{vert[2]}'/><stop offset='1' stop-color='{vert[3]}'/></linearGradient>"
            f"<linearGradient id='{p}-m' x1='.4' y1='.8' x2='1' y2='.2'><stop offset='0' stop-color='{viol[0]}'/>"
            f"<stop offset='.25' stop-color='{viol[1]}'/><stop offset='.62' stop-color='{viol[2]}'/><stop offset='1' stop-color='{viol[3]}'/></linearGradient>"
            f"<clipPath id='{p}-g'><path d='M-10 -10H{a[0]}L{b[0]} 140H-10Z'/></clipPath>"
            f"<clipPath id='{p}-d'><path d='M{a[0]} -10H140V140H{b[0]}Z'/></clipPath>"
            f"<mask id='{p}-r'><path d='M121 64A57 57 0 1 0 7 64A57 57 0 1 0 121 64ZM115.5 64A51.5 51.5 0 1 1 12.5 64A51.5 51.5 0 1 1 115.5 64Z' fill='#fff' fill-rule='evenodd'/>"
            f"<circle cx='64' cy='8' r='11.5' fill='#fff'/></mask>"
            f"<filter id='{p}-f' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='1.6'/></filter>"
            f"<filter id='{p}-h' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='2.6'/></filter></defs>")
    style = ("<style>.bu{transform-box:fill-box;transform-origin:center;animation:bu 2.8s ease-in infinite}.bu2{animation-delay:-1.4s}"
             "@keyframes bu{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-8px) scale(1.1);opacity:0}}"
             ".ec{animation:ec 1.9s steps(1) infinite}.ec2{animation-delay:-.9s}"
             "@keyframes ec{0%,62%{opacity:1}64%{opacity:.15}68%{opacity:1}72%{opacity:.3}76%,100%{opacity:1}}"
             ".cp{animation:cp 2.6s ease-in-out infinite alternate}@keyframes cp{from{opacity:.55}to{opacity:1}}" + RM + "</style>")
    corps = defs + style
    # Les lueurs, chacune de son cote.
    corps += (f"<g clip-path='url(#{p}-g)'><circle cx='64' cy='64' r='55' fill='none' stroke='{vert[1]}' stroke-width='7' opacity='.5' filter='url(#{p}-h)'/></g>"
              f"<g clip-path='url(#{p}-d)'><circle cx='64' cy='64' r='55' fill='none' stroke='{viol[1]}' stroke-width='7' opacity='.55' filter='url(#{p}-h)'/></g>")
    corps += f"<g clip-path='url(#{p}-g)'>{anneau(f'url(#{p}-v)')}</g><g clip-path='url(#{p}-d)'>{anneau(f'url(#{p}-m)')}</g>"
    corps += filets('#ffffff', '#140a22')
    # Une bulle qui monte a gauche, un eclair qui crepite a droite.
    for ang, r, cls in ((200, 3, ''), (226, 2.2, 'bu'), (250, 2.6, ''), (150, 2.4, 'bu bu2')):
        x, y = pt(54.3, ang)
        corps += (f"<circle class='{cls}' cx='{x:.1f}' cy='{y:.1f}' r='{r}' fill='{vert[1]}' stroke='{vert[3]}' stroke-width='.5'/>"
                  f"<circle cx='{x - r * .35:.1f}' cy='{y - r * .35:.1f}' r='{r * .28:.2f}' fill='#fff' opacity='.85'/>")
    for ang, cls in ((330, 'ec'), (25, 'ec ec2')):
        x, y = pt(54.3, ang)
        ox, oy = pt(63.5, ang)
        ix, iy = pt(49, ang)
        nx, ny = -(oy - iy), (ox - ix)
        n = math.hypot(nx, ny) or 1
        nx, ny = nx / n * 3, ny / n * 3
        d = f"M{ix:.1f} {iy:.1f} L{x + nx:.1f} {y + ny:.1f} L{x - nx * .4:.1f} {y - ny * .4:.1f} L{ox:.1f} {oy:.1f}"
        corps += (f"<path class='{cls}' d='{d}' fill='none' stroke='{viol[1]}' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round' opacity='.55'/>"
                  f"<path class='{cls}' d='{d}' fill='none' stroke='#fff' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/>")
    # Le medaillon, partage comme l'anneau, et l'eclair blanc du Choc.
    corps += (f"<circle cx='64' cy='8' r='12.5' fill='#fff' opacity='.35' filter='url(#{p}-f)'/>"
              f"<g clip-path='url(#{p}-g)'><circle cx='64' cy='8' r='10.5' fill='#0f3a18'/></g>"
              f"<g clip-path='url(#{p}-d)'><circle cx='64' cy='8' r='10.5' fill='#2c0c72'/></g>"
              f"<circle cx='64' cy='8' r='10.5' fill='none' stroke='#fff' stroke-width='1.4'/>"
              f"<path d='M66.6 .4 59.4 9.8h4.4l-1.8 7.2 7.2-9.6h-4.5Z' fill='#fff'/>")
    # La coupe : un trait de lumiere, seulement sur l'anneau et le medaillon.
    corps += (f"<g mask='url(#{p}-r)'><line class='cp' x1='{a[0]}' y1='{a[1]}' x2='{b[0]}' y2='{b[1]}' stroke='#fff' stroke-width='4' filter='url(#{p}-f)'/>"
              f"<line x1='{a[0]}' y1='{a[1]}' x2='{b[0]}' y2='{b[1]}' stroke='#fff' stroke-width='1.2'/></g>")
    ecrire('choc', corps)


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
    toxique()
    deter()
    choc()
    secrete()
