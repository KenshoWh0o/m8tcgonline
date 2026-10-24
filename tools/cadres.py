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
# Les couleurs de Tout Commence Ici (la Promo du set complet) : rose poudré,
# lilas, pervenche, et le crème de ses lumières. Une étoile filante fait le
# tour de l'avatar : sa traînée part de presque rien, s'épaissit et
# s'éclaire jusqu'à la tête, qui brille. L'anneau lui-même est à peine là,
# fondu : c'est l'étoile qui dessine le cadre. Elle tourne lentement (CSS :
# arrêtée si le système demande moins d'animations).
def melange(c1, c2, t):
    a=[int(c1[i:i+2],16) for i in (1,3,5)]; b=[int(c2[i:i+2],16) for i in (1,3,5)]
    return '#'+''.join(f"{round(a[k]+(b[k]-a[k])*t):02x}" for k in range(3))
def degrade(stops, t):
    for i in range(len(stops)-1):
        if t<=stops[i+1][0]:
            u=(t-stops[i][0])/(stops[i+1][0]-stops[i][0]); return melange(stops[i][1],stops[i+1][1],u)
    return stops[-1][1]
TCI=[(0,'#5d63c9'),(.35,'#8f86e6'),(.65,'#d9a3e6'),(.88,'#f6b8de'),(1,'#fff3fb')]
# Une traînée effilée, d'un seul tenant : n tronçons pleins, bord à bord,
# chacun avec son dégradé (couleur et transparence) le long de sa corde. Des
# traits superposés laissaient voir des grains là où ils se recouvraient.
GRAD=[]
def trainee(r, a0, a1, n, w0, w1, op0, op1, stops, cle):
    s=''
    larg=lambda t: w0+(w1-w0)*t**1.5
    alpha=lambda t: op0+(op1-op0)*t**1.25
    for i in range(n):
        t0=i/n; t1=(i+1)/n
        sous=[t0+(t1-t0)*k/6 for k in range(7)]
        ext=[pt(r+larg(t)/2,a0+(a1-a0)*t) for t in sous]
        intr=[pt(r-larg(t)/2,a0+(a1-a0)*t) for t in reversed(sous)]
        gid=f"{cle}{i}"
        xa,ya=pt(r,a0+(a1-a0)*t0); xb,yb=pt(r,a0+(a1-a0)*t1)
        GRAD.append(f"<linearGradient id='{gid}' gradientUnits='userSpaceOnUse' x1='{f(xa)}' y1='{f(ya)}' x2='{f(xb)}' y2='{f(yb)}'>"
                    f"<stop offset='0' stop-color='{degrade(stops,t0)}' stop-opacity='{f(alpha(t0))}'/>"
                    f"<stop offset='1' stop-color='{degrade(stops,t1)}' stop-opacity='{f(alpha(t1))}'/></linearGradient>")
        s+=f"<polygon points='{P(*(ext+intr))}' fill='url(#{gid})'/>"
    return s
hx,hy=pt(53,-42)
defs=("<radialGradient id='ma-l'><stop offset='0' stop-color='#fff'/><stop offset='.35' stop-color='#ffe3f4'/><stop offset='1' stop-color='#f6b8de' stop-opacity='0'/></radialGradient>"
      "<linearGradient id='ma-a' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='#5d63c9'/><stop offset='.5' stop-color='#b49be6'/><stop offset='1' stop-color='#f6b8de'/></linearGradient>"
      "<filter id='ma-f' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='1.4'/></filter>")
body=(# L'anneau, fondu.
      f"<path d='{ring_path(50,55.5)}' fill='url(#ma-a)' fill-rule='evenodd' opacity='.28'/>"
      "<circle cx='64' cy='64' r='50' fill='none' stroke='#fff3fb' stroke-width='.6' opacity='.35'/>"
      "<g class='cm'>"
      # La lueur de la traînée, floue, puis la traînée nette, et deux fils plus fins.
      f"<g filter='url(#ma-f)' opacity='.75'>{trainee(53,-300,-42,16,.5,8,0,.9,TCI,'mg')}</g>"
      + trainee(53,-300,-42,30,.2,4.8,0,1,TCI,'mt')
      + trainee(58,-205,-46,10,.1,1.5,0,.85,TCI,'mx')
      + trainee(48.6,-235,-50,10,.1,1.2,0,.7,TCI,'mi')
      # La tête : un halo, un cœur blanc, un éclat à quatre branches.
      + f"<circle cx='{f(hx)}' cy='{f(hy)}' r='11' fill='url(#ma-l)' opacity='.9'/>"
      + f"<g transform='rotate(-12 {f(hx)} {f(hy)})'>{star4(hx,hy,9,'#fff')}</g>"
      + f"<circle cx='{f(hx)}' cy='{f(hy)}' r='2.6' fill='#fff'/>"
      + "".join(f"<circle cx='{f(pt(rr,aa)[0])}' cy='{f(pt(rr,aa)[1])}' r='{f(rs)}' fill='#fff3fb' opacity='{op}'/>"
                for rr,aa,rs,op in ((56,-70,.9,.9),(50,-95,.7,.7),(57.5,-125,.6,.55),(51,-160,.5,.4)))
      + "</g>"
      "<style>.cm{transform-origin:64px 64px;animation:cm 18s linear infinite}@keyframes cm{to{transform:rotate(360deg)}}"
      "@media (prefers-reduced-motion:reduce){.cm{animation:none}}</style>"
      # Quelques étoiles qui scintillent autour, fixes.
      + twinkle(star4(*pt(61,150),3.2,'#f6b8de'),2.4,.5)+twinkle(star4(*pt(60,62),2.6,'#fff3fb'),2.9,1.2)+twinkle(star4(*pt(62,-170),2.2,'#d9a3e6'),2.2,1.8))
files['maitre']=svg(body,defs+''.join(GRAD))

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

# ================================================== version 2.5 : L'Échauffement
# Les deux cadres du Pass, aux couleurs de l'événement : graphite et lavande,
# et le cœur chaud d'une braise (css/hub.css, jetons --e-*).

# ---------------------------------------------------------------- Braise
# Un anneau de graphite liseré de lavande, une lueur qui en fait le tour, et
# des braises qui montent du haut de l'anneau, s'allument et s'éteignent.
defs=("<linearGradient id='bz-r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#3a3750'/><stop offset='.5' stop-color='#24232f'/><stop offset='1' stop-color='#2d2b3a'/></linearGradient>"
      "<linearGradient id='bz-l' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#8a78f5' stop-opacity='0'/><stop offset='.5' stop-color='#c8bfff'/><stop offset='1' stop-color='#8a78f5' stop-opacity='0'/></linearGradient>"
      "<radialGradient id='bz-e'><stop offset='0' stop-color='#fff4dc'/><stop offset='.35' stop-color='#ffcf8a'/><stop offset='.7' stop-color='#b3a6ff' stop-opacity='.7'/><stop offset='1' stop-color='#8a78f5' stop-opacity='0'/></radialGradient>"
      f"<mask id='bz-m'><path d='{ring_path(48.5,55)}' fill='#fff' fill-rule='evenodd'/></mask>")
def braise(a, r0, s, dur, delay, monte=9):
    x,y=pt(r0,a)
    return (f"<circle cx='{f(x)}' cy='{f(y)}' r='{s}' fill='url(#bz-e)' opacity='0'>"
            f"<animate attributeName='cy' values='{f(y)};{f(y-monte)}' dur='{dur}s' begin='{delay}s' repeatCount='indefinite'/>"
            f"<animate attributeName='opacity' values='0;1;.9;0' keyTimes='0;.25;.6;1' dur='{dur}s' begin='{delay}s' repeatCount='indefinite'/></circle>")
body=(f"<path d='{ring_path(48.5,55)}' fill='url(#bz-r)' fill-rule='evenodd'/>"
      "<circle cx='64' cy='64' r='55' fill='none' stroke='#c8bfff' stroke-width='.9' opacity='.75'/>"
      "<circle cx='64' cy='64' r='48.5' fill='none' stroke='#8a78f5' stroke-width='.8' opacity='.8'/>"
      "<g mask='url(#bz-m)'><g><rect x='34' y='0' width='60' height='20' fill='url(#bz-l)' opacity='.9'/>"
      "<animateTransform attributeName='transform' type='rotate' from='0 64 64' to='360 64 64' dur='7s' repeatCount='indefinite'/></g></g>"
      # le cœur chaud, en haut de l'anneau
      + ''.join(f"<circle cx='{f(pt(51.7,a)[0])}' cy='{f(pt(51.7,a)[1])}' r='{s}' fill='url(#bz-e)'><animate attributeName='opacity' values='.55;1;.55' dur='{d}s' begin='{b}s' repeatCount='indefinite'/></circle>"
                for a,s,d,b in ((-90,4.2,1.6,0),(-118,3.2,1.9,.5),(-62,3.4,2.1,.9),(-140,2.4,1.7,.3),(-40,2.6,2.3,1.2)))
      + braise(-95,57,2.4,2.6,0)+braise(-75,56,1.8,2.2,.7)+braise(-115,56,2,2.9,1.3)+braise(-55,57,1.5,2.4,1.9)
      + braise(-135,56,1.6,3.1,.4,7)+braise(-85,58,1.4,2,1.6,11)+braise(-30,56,1.3,2.7,2.2,6)
      + twinkle(star4(*pt(60,150),2.6,'#e8e2ff'),2.6,.4))
files['braise']=svg(body,defs)

# ---------------------------------------------------------------- Ardeur
# La couronne du dernier palier : un anneau lavande, et tout autour des
# flammes lavande au cœur clair, qui vacillent chacune à son rythme.
defs=("<linearGradient id='ar-r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#c8bfff'/><stop offset='.45' stop-color='#8a78f5'/><stop offset='1' stop-color='#5d4bd9'/></linearGradient>"
      "<linearGradient id='ar-s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.95'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
      "<radialGradient id='ar-f' cx='.5' cy='1' r='1'><stop offset='0' stop-color='#fff4dc'/><stop offset='.35' stop-color='#d9d0ff'/><stop offset='.75' stop-color='#8a78f5'/><stop offset='1' stop-color='#5d4bd9' stop-opacity='0'/></radialGradient>"
      f"<mask id='ar-m'><path d='{ring_path(48,54)}' fill='#fff' fill-rule='evenodd'/></mask>")
STYLE_FL=("<style>.fl{transform-box:fill-box;transform-origin:50% 100%;animation:fl 1.4s ease-in-out infinite alternate}"
          "@keyframes fl{from{transform:scaleY(.72) scaleX(1.06)}to{transform:scaleY(1.08) scaleX(.94)}}"
          "@media (prefers-reduced-motion:reduce){.fl{animation:none}}</style>")
def flamme(a, L, w, dur, delay):
    # une flamme dressée vers l'extérieur : base sur l'anneau (r 53), pointe à r 53 + L
    tip=pt(53+L,a); b1=pt(53.2,a-w); b2=pt(53.2,a+w); c1=pt(53+L*.55,a-w*1.35); c2=pt(53+L*.55,a+w*1.35)
    d=(f"M{f(b1[0])} {f(b1[1])}Q{f(c1[0])} {f(c1[1])} {f(tip[0])} {f(tip[1])}Q{f(c2[0])} {f(c2[1])} {f(b2[0])} {f(b2[1])}Z")
    return f"<path class='fl' d='{d}' fill='url(#ar-f)' style='animation-duration:{dur}s;animation-delay:{delay}s'/>"
fl=''.join(flamme(a, 8 + 4 * ((i * 7) % 3) / 2, 5.2, 1.1 + (i % 5) * .17, -(i * .23)) for i, a in enumerate(range(-90, 270, 20)))
body=(STYLE_FL + fl
      + f"<path d='{ring_path(48,54)}' fill='url(#ar-r)' fill-rule='evenodd'/>"
      "<circle cx='64' cy='64' r='54' fill='none' stroke='#fff' stroke-width='.8' opacity='.7'/>"
      "<circle cx='64' cy='64' r='48' fill='none' stroke='#3b2f7a' stroke-width='.8' opacity='.7'/>"
      "<g mask='url(#ar-m)'><rect x='-30' y='0' width='24' height='128' fill='url(#ar-s)' transform='rotate(25 64 64)'>"
      "<animate attributeName='x' values='-30;140' dur='4s' repeatCount='indefinite'/></rect></g>"
      + twinkle(star4(*pt(66,-90),4.2,'#fff4dc'),2.2,0)+twinkle(star4(*pt(64,30),2.6,'#e8e2ff'),2.8,.9)+twinkle(star4(*pt(64,150),2.4,'#e8e2ff'),2.5,1.5))
files['ardeur']=svg(body,defs)

for k,v in files.items():
    open(os.path.join(OUT,k+'.svg'),'w').write(v)
    print(k, len(v))
