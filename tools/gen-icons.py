# -*- coding: utf-8 -*-
"""Genere les icones de l'application, le favicon et l'image de partage.
    python3 tools/gen-icons.py

Ecrit dans assets/ : icon-192, icon-512, icon-maskable-512, apple-touch-icon,
favicon-16, favicon-32 et og-image. A relancer si le logo ou la charte changent.

PNG pur, sans aucune dependance : decodage et encodage ecrits a la main, et
l'etoile du logo (le meme trace que ICON.star dans js/config.js) est rasterisee
par balayage de lignes. Seul `sips`, livre avec macOS, sert a convertir le logo
webp en png avant de le composer."""
import struct, zlib, math, os, sys, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
SP = tempfile.mkdtemp(prefix='mtcg-icones-')
subprocess.run(['sips', '-s', 'format', 'png',
                os.path.join(OUT, 'logo-m8.webp'),
                '--out', os.path.join(SP, 'logo.png')],
               check=True, capture_output=True)

# ---------- PNG ----------
def png_read(path):
    d = open(path, 'rb').read()
    w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', d[16:29])
    assert bd == 8 and ct == 6 and il == 0, 'attendu RGBA8 non entrelace'
    raw, i = b'', 8
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ = d[i+4:i+8]
        if typ == b'IDAT': raw += d[i+8:i+8+ln]
        i += 12 + ln
    data = zlib.decompress(raw)
    px, stride, prev = bytearray(w*h*4), w*4, bytearray(stride_zero := w*4)
    pos = 0
    for y in range(h):
        f = data[pos]; pos += 1
        line = bytearray(data[pos:pos+stride]); pos += stride
        for x in range(stride):
            a = line[x-4] if x >= 4 else 0
            b = prev[x]
            c = prev[x-4] if x >= 4 else 0
            if   f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        px[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, px

def png_write(path, w, h, px):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += px[y*w*4:(y+1)*w*4]
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    body = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))
    open(path, 'wb').write(body)
    return len(body)

# ---------- Couleurs de la charte (css/tokens.css) ----------
INK   = (0x1a, 0x0a, 0x1e)   # --brand-ink
DEEP  = (0x7b, 0x0c, 0x84)   # --brand-deep
ORCH  = (0xdf, 0x6d, 0xe8)   # --brand
PALE  = (0xff, 0xd7, 0xf0)   # --brand-light
ACC   = (0x89, 0x36, 0xff)   # --accent

def mix(a, b, t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(3))

def background(w, h, cx, cy, spread):
    """Degrade radial orchidee -> prune profond, avec la trame de points du site."""
    px = bytearray(w*h*4)
    R = spread
    for y in range(h):
        for x in range(w):
            d = math.hypot((x-cx)/R, (y-cy)/R)
            c = mix(mix(DEEP, ACC, 0.35), INK, min(1.0, d**0.72))
            # halo central
            c = mix(c, ORCH, max(0.0, 0.30*(1.0-d*1.15)))
            i = (y*w+x)*4
            px[i], px[i+1], px[i+2], px[i+3] = c[0], c[1], c[2], 255
    # trame de points, comme .bgdeco::after
    step = max(6, w//52)
    for y in range(0, h, step):
        for x in range(0, w, step):
            fade = 1.0 - y/float(h)
            if fade <= 0.04: continue
            i = (y*w+x)*4
            for k in range(3):
                px[i+k] = min(255, int(px[i+k] + 26*fade))
    return px

# ---------- Etoile du logo (meme trace que ICON.star dans js/config.js) ----------
STAR = [(8.13814,0),(8.07808,0.158491),(6.03604,5.54717),(0.21021,6.63019),(0,6.68302),
        (0.21021,6.73585),(4.8949,8.10943),(1.95195,13.7623),(1.83183,14),(2.04204,13.8151),
        (7.92793,8.98113),(12.6426,10.3547),(12.7628,10.3547),(12.7027,10.2755),(10.9009,6.97358),
        (19.6096,1.90189),(20,1.66415),(19.5496,1.79623),(9.75976,4.80755),(8.1982,0.158491)]

def star_mask(w, h, cx, cy, scale, rot=0.0, ss=4):
    """Couverture 0..1 de l'etoile, par balayage de lignes suréchantillonné."""
    ca, sa = math.cos(rot), math.sin(rot)
    pts = []
    for (px_, py_) in STAR:
        X, Y = (px_-10.0)*scale, (py_-7.0)*scale
        pts.append((cx + X*ca - Y*sa, cy + X*sa + Y*ca))
    mask = [0.0]*(w*h)
    ys = [p[1] for p in pts]
    y0, y1 = max(0, int(min(ys))-1), min(h, int(max(ys))+2)
    n = len(pts)
    for y in range(y0, y1):
        acc = [0.0]*w
        for s in range(ss):
            yy = y + (s+0.5)/ss
            xs = []
            for i in range(n):
                ax, ay = pts[i]; bx, by = pts[(i+1) % n]
                if (ay <= yy < by) or (by <= yy < ay):
                    xs.append(ax + (yy-ay)*(bx-ax)/(by-ay))
            xs.sort()
            for j in range(0, len(xs)-1, 2):
                xa, xb = xs[j], xs[j+1]
                ia, ib = max(0, int(math.floor(xa))), min(w-1, int(math.ceil(xb)))
                for x in range(ia, ib+1):
                    cov = min(x+1.0, xb) - max(float(x), xa)
                    if cov > 0: acc[x] += cov/ss
        for x in range(w):
            if acc[x] > 0: mask[y*w+x] = min(1.0, acc[x])
    return mask

def paint_mask(px, w, h, mask, color, glow=0.0):
    if glow > 0:  # halo bon marche : dilatation floue de la couverture
        rad = max(1, int(glow))
        blur = [0.0]*(w*h)
        for y in range(h):
            row = y*w; run = 0.0
            for x in range(w):
                run += mask[row+x]
                if x >= 2*rad+1: run -= mask[row+x-2*rad-1]
                blur[row+min(w-1, x-rad if x >= rad else 0)] = run/(2*rad+1)
        for x in range(w):
            run = 0.0
            for y in range(h):
                run += blur[y*w+x]
                if y >= 2*rad+1: run -= blur[(y-2*rad-1)*w+x]
                yy = max(0, y-rad)
                v = min(1.0, run/(2*rad+1)*2.2)
                if v > 0.004:
                    i = (yy*w+x)*4
                    for k in range(3):
                        px[i+k] = min(255, int(px[i+k] + (color[k]-px[i+k])*v*0.55))
    for y in range(h):
        for x in range(w):
            a = mask[y*w+x]
            if a <= 0: continue
            i = (y*w+x)*4
            for k in range(3):
                px[i+k] = int(px[i+k] + (color[k]-px[i+k])*a)

def blit(px, w, h, src, sw, sh, dx, dy, dw):
    """Colle une image RGBA redimensionnee (echantillonnage par boite)."""
    dh = max(1, int(round(dw*sh/float(sw))))
    fx, fy = sw/float(dw), sh/float(dh)
    for y in range(dh):
        ty = dy+y
        if not (0 <= ty < h): continue
        sy0, sy1 = int(y*fy), max(int(y*fy)+1, int((y+1)*fy))
        for x in range(dw):
            tx = dx+x
            if not (0 <= tx < w): continue
            sx0, sx1 = int(x*fx), max(int(x*fx)+1, int((x+1)*fx))
            r = g = b = a = cnt = 0
            for yy in range(sy0, min(sy1, sh)):
                for xx in range(sx0, min(sx1, sw)):
                    j = (yy*sw+xx)*4
                    al = src[j+3]
                    r += src[j]*al; g += src[j+1]*al; b += src[j+2]*al; a += al; cnt += 1
            if not cnt or not a: continue
            al = a/float(cnt)/255.0
            r, g, b = r/float(a), g/float(a), b/float(a)
            i = (ty*w+tx)*4
            px[i]   = int(px[i]   + (r-px[i])*al)
            px[i+1] = int(px[i+1] + (g-px[i+1])*al)
            px[i+2] = int(px[i+2] + (b-px[i+2])*al)
    return dh

made = []

# ---------- Icones ----------
def icon(size, star_scale, glow):
    px = background(size, size, size*0.5, size*0.42, size*0.62)
    m = star_mask(size, size, size*0.5, size*0.52, size*star_scale, rot=-0.06)
    paint_mask(px, size, size, m, PALE, glow=size*glow)
    return px

for name, size, sc, gl in [('icon-192.png', 192, 0.036, 0.05),
                           ('icon-512.png', 512, 0.036, 0.05),
                           ('icon-maskable-512.png', 512, 0.026, 0.045),
                           ('apple-touch-icon.png', 180, 0.034, 0.05),
                           ('favicon-32.png', 32, 0.040, 0.0),
                           ('favicon-16.png', 16, 0.042, 0.0)]:
    p = os.path.join(OUT, name)
    n = png_write(p, size, size, icon(size, sc, gl))
    made.append((name, size, size, n))

# ---------- Image de partage (Open Graph / Twitter) ----------
W, H = 1200, 630
px = background(W, H, W*0.5, H*0.44, W*0.60)
# etoiles decoratives
for (cx, cy, s, t) in [(112, 128, 3.4, .55), (1092, 506, 4.0, .40), (1016, 118, 2.4, .62),
                       (162, 512, 2.7, .48), (636, 58, 1.9, .66), (330, 566, 2.1, .58),
                       (900, 588, 1.6, .68), (66, 330, 1.7, .66)]:
    m = star_mask(W, H, cx, cy, s, rot=0.2)
    paint_mask(px, W, H, m, mix(PALE, INK, t))
lw, lh, lpx = png_read(os.path.join(SP, 'logo.png'))
dh = blit(px, W, H, lpx, lw, lh, (W-660)//2, 176, 660)
# filet de marque en bas
for y in range(H-10, H):
    for x in range(W):
        i = (y*W+x)*4
        c = mix(ACC, ORCH, x/float(W))
        px[i], px[i+1], px[i+2] = c
n = png_write(os.path.join(OUT, 'og-image.png'), W, H, px)
made.append(('og-image.png', W, H, n))

for m_ in made:
    print('%-26s %4dx%-4d %7.1f Ko' % (m_[0], m_[1], m_[2], m_[3]/1024.0))
