#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Les décorations de cadre (version 2.0) : un SVG par cadre, 128 x 128, l'avatar au centre
# (rayon 50). Tout ce qui bouge est animé dans le fichier lui-même.
import math, os
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'cadres')
#     python3 tools/cadres.py   -> assets/cadres/*.svg (css/reflets.css, « Les cadres décorés »)
C=64
def pt(r,a): a=math.radians(a); return (C+r*math.cos(a), C+r*math.sin(a))
def f(x): return f"{x:.2f}".rstrip('0').rstrip('.')
def P(*ps): return ' '.join(f"{f(x)},{f(y)}" for x,y in ps)
def ring_path(r1,r2):
    return (f"M{f(C+r2)} {C}A{r2} {r2} 0 1 0 {f(C-r2)} {C}A{r2} {r2} 0 1 0 {f(C+r2)} {C}Z"
            f"M{f(C+r1)} {C}A{r1} {r1} 0 1 1 {f(C-r1)} {C}A{r1} {r1} 0 1 1 {f(C+r1)} {C}Z")
def star4(x,y,s,fill='#fff'):
    return f"<path d='M{f(x)} {f(y-s)}Q{f(x+s*.18)} {f(y-s*.18)} {f(x+s)} {f(y)}Q{f(x+s*.18)} {f(y+s*.18)} {f(x)} {f(y+s)}Q{f(x-s*.18)} {f(y+s*.18)} {f(x-s)} {f(y)}Q{f(x-s*.18)} {f(y-s*.18)} {f(x)} {f(y-s)}Z' fill='{fill}'/>"
def star5(x,y,R,r,rot=-90):
    ps=[]
    for i in range(10):
        rr=R if i%2==0 else r; a=math.radians(rot+i*36)
        ps.append((x+rr*math.cos(a), y+rr*math.sin(a)))
    return P(*ps)
def twinkle(inner, dur, delay):
    return (f"<g class='tw' style='animation-duration:{dur}s;animation-delay:{delay}s'>{inner}</g>")
STYLE_TW=("<style>.tw{transform-box:fill-box;transform-origin:center;animation:tw 2.4s ease-in-out infinite alternate}"
          "@keyframes tw{from{opacity:.25;transform:scale(.55) rotate(-15deg)}to{opacity:1;transform:scale(1) rotate(15deg)}}"
          "@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>")
def svg(body, defs=''):
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><defs>{defs}</defs>{STYLE_TW}{body}</svg>"
files={}

# ---------------------------------------------------------------- Prisme
# Un anneau de cristal taillé en facettes, trois éclats de cristal qui en
# sortent, et des reflets qui scintillent.
cols=['#f4f8ff','#b8ccff','#e3d6ff','#ffffff','#a8bfff','#d6e4ff','#c9b4ff','#eef3ff']
fac=''
n=24
for i in range(n):
    a0=i*360/n; a1=(i+1)*360/n; am=(a0+a1)/2
    fac+=f"<polygon points='{P(pt(48,a0),pt(55.5,a0),pt(55.5,a1),pt(48,a1))}' fill='{cols[i%len(cols)]}'/>"
    fac+=f"<polygon points='{P(pt(51.5,a0),pt(55.5,am),pt(51.5,a1))}' fill='#fff' opacity='.35'/>"
def shard(a, L, w, rot=0):
    b=pt(52,a); t=pt(52+L,a)
    ang=math.radians(a); nx,ny=-math.sin(ang),math.cos(ang)
    l=(b[0]+nx*w, b[1]+ny*w); r=(b[0]-nx*w, b[1]-ny*w)
    m1=(b[0]+math.cos(ang)*L*.62+nx*w*1.05, b[1]+math.sin(ang)*L*.62+ny*w*1.05)
    m2=(b[0]+math.cos(ang)*L*.62-nx*w*1.05, b[1]+math.sin(ang)*L*.62-ny*w*1.05)
    return (f"<polygon points='{P(l,m1,t,m2,r)}' fill='url(#pr-c)' stroke='#3b3a8f' stroke-width='.9' stroke-linejoin='round'/>"
            f"<polygon points='{P(b,m1,t)}' fill='#fff' opacity='.55'/>"
            f"<line x1='{f(b[0])}' y1='{f(b[1])}' x2='{f(t[0])}' y2='{f(t[1])}' stroke='#3b3a8f' stroke-width='.5' opacity='.5'/>")
defs=("<linearGradient id='pr-c' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.45' stop-color='#bcd2ff'/><stop offset='1' stop-color='#a487ff'/></linearGradient>"
      "<linearGradient id='pr-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
      f"<mask id='pr-m'><path d='{ring_path(48,55.5)}' fill='#fff' fill-rule='evenodd'/></mask>")
body=(f"<path d='{ring_path(47.2,56.3)}' fill='#3b3a8f' fill-rule='evenodd'/>{fac}"
      # le reflet qui fait le tour de l'anneau
      f"<g mask='url(#pr-m)'><rect x='-30' y='0' width='26' height='128' fill='url(#pr-s)' transform='rotate(25 64 64)'>"
      "<animate attributeName='x' values='-30;140' dur='4.5s' repeatCount='indefinite' keyTimes='0;1'/></rect></g>"
      + shard(-55,15,4.2)+shard(-30,9,3)+shard(150,11,3.4)+shard(118,7,2.4)
      + twinkle(star4(*pt(66,-72),5),2.2,0)+twinkle(star4(*pt(60,165),3.6),2.8,.9)+twinkle(star4(*pt(58,40),3),2.5,1.6))
files['prisme']=svg(body,defs)

# ---------------------------------------------------------------- Sceau
# Une couronne de laurier dorée, et le sceau du booster en bas : une
# médaille violette frappée d'une étoile d'or, sur laquelle passe un éclat.
defs=("<linearGradient id='sc-o' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff1b8'/><stop offset='.45' stop-color='#f2c24a'/><stop offset='1' stop-color='#a66a0c'/></linearGradient>"
      "<linearGradient id='sc-f' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffe7a0'/><stop offset='.6' stop-color='#e2a92c'/><stop offset='1' stop-color='#8a5406'/></linearGradient>"
      "<radialGradient id='sc-m' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#9a6bff'/><stop offset='.6' stop-color='#5a1fc0'/><stop offset='1' stop-color='#2a0b63'/></radialGradient>"
      "<linearGradient id='sc-g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.9'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
      "<clipPath id='sc-c'><circle cx='64' cy='116' r='10.5'/></clipPath>")
leaves=''
for side in (1,-1):
    for k in range(9):
        a=90+side*(14+k*14.5)
        for off,tilt in ((3,1),(-3,-1)):
            x,y=pt(54+off*.6,a)
            rot=a+90*side+side*tilt*-28
            leaves+=(f"<ellipse cx='{f(x)}' cy='{f(y)}' rx='5.6' ry='2.3' transform='rotate({f(rot)} {f(x)} {f(y)})' fill='url(#sc-f)' stroke='#6b3f00' stroke-width='.55'/>")
stem=''
for side in (1,-1):
    a0=90+side*12; a1=90+side*140
    p0=pt(54,a0); p1=pt(54,a1)
    sweep=1 if side==1 else 0
    stem+=f"<path d='M{f(p0[0])} {f(p0[1])}A54 54 0 0 {sweep} {f(p1[0])} {f(p1[1])}' fill='none' stroke='#8a5406' stroke-width='1.3'/>"
body=(f"<path d='{ring_path(49,52.5)}' fill='url(#sc-o)' fill-rule='evenodd' stroke='#6b3f00' stroke-width='.5'/>"
      + stem + leaves +
      "<circle cx='64' cy='116' r='12' fill='url(#sc-o)' stroke='#6b3f00' stroke-width='.8'/>"
      "<circle cx='64' cy='116' r='10.5' fill='url(#sc-m)'/>"
      f"<polygon points='{star5(64,116.4,6.4,2.7)}' fill='url(#sc-o)' stroke='#6b3f00' stroke-width='.45'/>"
      "<g clip-path='url(#sc-c)'><rect x='30' y='100' width='9' height='32' fill='url(#sc-g)' transform='rotate(20 64 116)'>"
      "<animate attributeName='x' values='40;40;90' keyTimes='0;.6;1' dur='4s' repeatCount='indefinite'/></rect></g>"
      + twinkle(star4(*pt(60,-62),3.4),2.6,.4)+twinkle(star4(*pt(59,-118),2.6),3,1.3))
files['sceau']=svg(body,defs)

# ---------------------------------------------------------------- Maître
# La direction artistique de Tout Commence Ici : un anneau rose pailleté, et
# l'étoile du logo — un disque rose incliné, l'étoile blanche en filé — qui
# file autour, une traînée derrière elle.
defs=("<linearGradient id='ma-r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff8ad0'/><stop offset='.5' stop-color='#ee0073'/><stop offset='1' stop-color='#b3005a'/></linearGradient>"
      "<linearGradient id='ma-d' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff9ad5'/><stop offset='1' stop-color='#d4006a'/></linearGradient>"
      "<linearGradient id='ma-t' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ff4fb4' stop-opacity='0'/><stop offset='1' stop-color='#ffd6ef' stop-opacity='.95'/></linearGradient>")
dots=''.join(f"<circle cx='{f(pt(52,a)[0])}' cy='{f(pt(52,a)[1])}' r='{.9 if i%3 else 1.3}' fill='#fff' opacity='{.95 if i%3==0 else .6}'/>" for i,a in enumerate(range(0,360,12)))
trail_p0=pt(57,-148); trail_p1=pt(57,-62)
body=(f"<path d='{ring_path(48.5,55.5)}' fill='url(#ma-r)' fill-rule='evenodd'/>"
      f"<circle cx='64' cy='64' r='48.6' fill='none' stroke='#fff' stroke-width='.8' opacity='.8'/>{dots}"
      f"<path d='M{f(trail_p0[0])} {f(trail_p0[1])}A57 57 0 0 1 {f(trail_p1[0])} {f(trail_p1[1])}' fill='none' stroke='url(#ma-t)' stroke-width='5' stroke-linecap='round'/>"
      "<g transform='translate(92 20)'><g class='mst'>"
      "<ellipse cx='0' cy='2' rx='14' ry='8.5' transform='rotate(-18)' fill='url(#ma-d)' stroke='#fff' stroke-width='1.2'/>"
      f"<polygon points='{star5(1,-1,11,4.6,-80)}' fill='#fff' stroke='#c2005e' stroke-width='.6'/>"
      "<path d='M-16 4 -6 1M-17 9 -7 5' stroke='#fff' stroke-width='1.6' stroke-linecap='round' opacity='.9'/></g></g>"
      "<style>.mst{transform-box:fill-box;transform-origin:center;animation:mst 2.8s ease-in-out infinite alternate}"
      "@keyframes mst{from{transform:rotate(-8deg) scale(.95)}to{transform:rotate(6deg) scale(1.06)}}</style>"
      + twinkle(star4(*pt(60,150),3.4,'#ffd6ef'),2.4,.5)+twinkle(star4(*pt(59,30),2.8),2.9,1.2)+twinkle(star4(*pt(61,-160),2.4),2.2,1.8))
files['maitre']=svg(body,defs)

# ---------------------------------------------------------------- Reflet
# L'anneau en nacre irisée qui tourne doucement, et trois Reverses en
# éventail en haut à droite, sur lesquelles passe la lumière.
defs=("<linearGradient id='rf-r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff9ad5'/><stop offset='.25' stop-color='#c8b0ff'/><stop offset='.5' stop-color='#8fe3ff'/><stop offset='.75' stop-color='#b8ffd9'/><stop offset='1' stop-color='#ffd6a0'/>"
      "<animateTransform attributeName='gradientTransform' type='rotate' from='0 .5 .5' to='360 .5 .5' dur='9s' repeatCount='indefinite'/></linearGradient>"
      "<linearGradient id='rf-c' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff8fcf'/><stop offset='.5' stop-color='#b99bff'/><stop offset='1' stop-color='#7fd8ff'/></linearGradient>"
      "<linearGradient id='rf-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.9'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
      "<clipPath id='rf-k'><rect x='-6.5' y='-9.5' width='13' height='19' rx='2'/></clipPath>")
def mini(x,y,rot):
    return (f"<g transform='translate({x} {y}) rotate({rot})'>"
            "<rect x='-7.5' y='-10.5' width='15' height='21' rx='2.4' fill='#fff' stroke='#3c1f6b' stroke-width='.8'/>"
            "<rect x='-6.5' y='-9.5' width='13' height='19' rx='2' fill='url(#rf-c)'/>"
            "<rect x='-4.8' y='-7.6' width='9.6' height='7' rx='.8' fill='#3c1f6b' opacity='.3'/>"
            f"<polygon points='{star5(0,4.2,3.2,1.3)}' fill='#fff'/>"
            "<g clip-path='url(#rf-k)'><rect x='-24' y='-14' width='7' height='30' fill='url(#rf-s)' transform='rotate(25)'>"
            "<animate attributeName='x' values='-24;-24;20' keyTimes='0;.55;1' dur='3.6s' repeatCount='indefinite'/></rect></g></g>")
body=(f"<path d='{ring_path(48.5,55)}' fill='url(#rf-r)' fill-rule='evenodd'/>"
      "<circle cx='64' cy='64' r='55' fill='none' stroke='#fff' stroke-width='.9' opacity='.8'/>"
      "<circle cx='64' cy='64' r='48.5' fill='none' stroke='#3c1f6b' stroke-width='.7' opacity='.4'/>"
      + mini(92,16,-24)+mini(103,24,0)+mini(111,36,22)
      + twinkle(star4(*pt(60,155),3.2),2.4,.3)+twinkle(star4(*pt(59,100),2.6),2.8,1.1))
files['reflet']=svg(body,defs)

# ---------------------------------------------------------------- Aurore
# Une aurore boréale : trois rubans de lumière qui ondulent au-dessus de
# l'avatar, sur un anneau de nuit, et quelques étoiles.
def wave(r, amp, k, phase, a0=192, a1=348, steps=48):
    ps=[]
    for i in range(steps+1):
        a=a0+(a1-a0)*i/steps
        rr=r+amp*math.sin(math.radians(a*k)+phase)
        ps.append(pt(rr,a))
    return 'M'+' L'.join(f"{f(x)} {f(y)}" for x,y in ps)
def ribbon(r,amp,k,col,w,dur,op):
    d1=wave(r,amp,k,0); d2=wave(r,amp,k,math.pi*.9); 
    return (f"<path d='{d1}' fill='none' stroke='{col}' stroke-width='{w}' stroke-linecap='round' opacity='{op}' filter='url(#au-b)'>"
            f"<animate attributeName='d' values='{d1};{d2};{d1}' dur='{dur}s' repeatCount='indefinite' calcMode='spline' keySplines='.45 0 .55 1;.45 0 .55 1'/></path>")
defs=("<filter id='au-b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='.6'/></filter>"
      "<linearGradient id='au-r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0f2a4a'/><stop offset='.5' stop-color='#123b4f'/><stop offset='1' stop-color='#2a1450'/></linearGradient>"
      "<linearGradient id='au-g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#3dffb0' stop-opacity='0'/><stop offset='.25' stop-color='#3dffb0'/><stop offset='.7' stop-color='#59d6ff'/><stop offset='1' stop-color='#59d6ff' stop-opacity='0'/></linearGradient>"
      "<linearGradient id='au-p' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ff6fb5' stop-opacity='0'/><stop offset='.4' stop-color='#ff6fb5'/><stop offset='.8' stop-color='#b38cff'/><stop offset='1' stop-color='#b38cff' stop-opacity='0'/></linearGradient>")
body=(f"<path d='{ring_path(49,53.5)}' fill='url(#au-r)' fill-rule='evenodd' stroke='#59d6ff' stroke-opacity='.5' stroke-width='.6'/>"
      + ribbon(56.5,2.4,5,'url(#au-g)',5.5,6.5,.95) + ribbon(61,2,6,'url(#au-p)',3.6,7.5,.9) + ribbon(52.5,1.2,7,'url(#au-g)',2.4,5.5,1)
      + ''.join(f"<circle cx='{f(pt(r,a)[0])}' cy='{f(pt(r,a)[1])}' r='{s}' fill='#fff'><animate attributeName='opacity' values='.2;1;.2' dur='{d}s' begin='{b}s' repeatCount='indefinite'/></circle>"
                for r,a,s,d,b in ((57,30,.9,2.6,0),(60,70,.7,3.1,.8),(58,120,.8,2.2,1.4),(61,160,.6,2.9,.4)))
      + twinkle(star4(*pt(62,-90),3.4,'#e8fff5'),2.6,.2))
files['aurore']=svg(body,defs)

# ---------------------------------------------------------------- Miroir
# Un anneau de chrome biseauté, un reflet qui en fait le tour, des éclats de
# miroir en bas à gauche, et une étoile qui scintille.
defs=("<linearGradient id='mi-r' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.22' stop-color='#a7b0c4'/><stop offset='.42' stop-color='#f6f8ff'/><stop offset='.58' stop-color='#5f6a84'/><stop offset='.78' stop-color='#d9deea'/><stop offset='1' stop-color='#7d879d'/></linearGradient>"
      "<linearGradient id='mi-e' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.5' stop-color='#cfd8ec'/><stop offset='1' stop-color='#8e9ab4'/></linearGradient>"
      "<radialGradient id='mi-h'><stop offset='0' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient>"
      f"<mask id='mi-m'><path d='{ring_path(48,55.5)}' fill='#fff' fill-rule='evenodd'/></mask>")
def eclat(cx,cy,pts,rot):
    pp=P(*[(cx+x,cy+y) for x,y in pts])
    return f"<polygon points='{pp}' transform='rotate({rot} {cx} {cy})' fill='url(#mi-e)' stroke='#4e5872' stroke-width='.7' stroke-linejoin='round'/>"
body=(f"<path d='{ring_path(48,55.5)}' fill='url(#mi-r)' fill-rule='evenodd'/>"
      "<circle cx='64' cy='64' r='55.5' fill='none' stroke='#4e5872' stroke-width='.8'/>"
      "<circle cx='64' cy='64' r='48' fill='none' stroke='#fff' stroke-width='.9'/>"
      "<circle cx='64' cy='64' r='51.8' fill='none' stroke='#fff' stroke-width='.5' opacity='.6'/>"
      "<g mask='url(#mi-m)'><g><ellipse cx='64' cy='8' rx='16' ry='7' fill='url(#mi-h)'/>"
      "<animateTransform attributeName='transform' type='rotate' from='0 64 64' to='360 64 64' dur='6s' repeatCount='indefinite'/></g></g>"
      + twinkle(star4(*pt(61,-45),7.5),2.4,0) + twinkle(star4(*pt(58,-18),2.6),2.9,1)
      + twinkle(star4(*pt(60,140),4),2.7,.6) + twinkle(star4(*pt(57,162),2.2),2.2,1.5))
files['miroir']=svg(body,defs)

# ---------------------------------------------------------------- Nébuleuse
# Un anneau de ciel profond — nuages roses et bleus, poussière d'étoiles —,
# et une petite planète à anneau qui en fait le tour.
defs=("<filter id='ne-b' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='2.2'/></filter>"
      "<radialGradient id='ne-p' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#e9dcff'/><stop offset='.5' stop-color='#b38cff'/><stop offset='1' stop-color='#5b2bb8'/></radialGradient>"
      f"<mask id='ne-m'><path d='{ring_path(47.5,57)}' fill='#fff' fill-rule='evenodd'/></mask>")
clouds=''.join(f"<circle cx='{f(pt(52,a)[0])}' cy='{f(pt(52,a)[1])}' r='{r}' fill='{c}' opacity='{o}'/>"
               for a,r,c,o in ((-80,10,'#ff7cc8',1),(-20,9,'#7fd8ff',.95),(40,11,'#c9a0ff',1),(110,10,'#ff7cc8',.95),(170,9,'#59d6ff',.9),(230,11,'#9a6bff',1),(-130,8,'#ff9ad5',.9),(75,8,'#7fd8ff',.8)))
specks=''.join(f"<circle cx='{f(pt(r,a)[0])}' cy='{f(pt(r,a)[1])}' r='{s}' fill='#fff' opacity='{o}'/>" for r,a,s,o in
               ((52,-60,.7,.9),(50,5,.5,.7),(54,60,.6,.9),(51,95,.5,.6),(53,140,.7,.8),(50,200,.5,.7),(54,250,.6,.9),(52,300,.5,.7),(55,-100,.4,.8),(49,-140,.5,.7)))
body=(f"<path d='{ring_path(47.5,57)}' fill='#1a0d33' fill-rule='evenodd'/>"
      f"<g mask='url(#ne-m)'><g filter='url(#ne-b)'>{clouds}<animateTransform attributeName='transform' type='rotate' from='0 64 64' to='360 64 64' dur='40s' repeatCount='indefinite'/></g>{specks}</g>"
      "<circle cx='64' cy='64' r='57' fill='none' stroke='#e9dcff' stroke-width='.8' opacity='.85'/>"
      "<circle cx='64' cy='64' r='47.5' fill='none' stroke='#e9dcff' stroke-width='.6' opacity='.6'/>"
      "<g><g transform='translate(64 3)'>"
      "<ellipse cx='0' cy='0' rx='9.5' ry='3.2' transform='rotate(-18)' fill='none' stroke='#ff7cc8' stroke-width='1.6'/>"
      "<circle r='5.2' fill='url(#ne-p)' stroke='#2a1050' stroke-width='.6'/>"
      "<path d='M-8.7 3.2A9.5 3.2 -18 0 0 9 -2.6' transform='rotate(0)' fill='none' stroke='#ff7cc8' stroke-width='1.6'/></g>"
      "<animateTransform attributeName='transform' type='rotate' from='0 64 64' to='360 64 64' dur='24s' repeatCount='indefinite'/></g>"
      + twinkle(star4(*pt(61,35),3.2,'#ffd6f0'),2.6,.3)+twinkle(star4(*pt(60,165),2.6),3,1.2)+twinkle(star4(*pt(62,-130),2.2),2.3,.8))
files['nebuleuse']=svg(body,defs)

for k,v in files.items():
    open(os.path.join(OUT,k+'.svg'),'w').write(v)
    print(k, len(v))
