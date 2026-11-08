#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pose un numero de version partout, et l'accroche aux fichiers du site.

    python3 tools/version.py 3.0.10     (ou 3.1, etc.)

Ce que ca fait :
  - ecrit la version dans js/pwa.js (APP_VERSION, le numero que lit le joueur)
  - accroche a chaque css et js de index.html et verif.html la marque
    ?v=<version>-<empreinte>, et la meme dans sw.js (VERSION du cache)

L'empreinte : six caracteres tires du contenu de tous ces fichiers. Deux mises
en ligne de la meme version avec un code different ont donc des adresses
differentes (avant la 2.5 et la 3.0.10, republier la meme version servait l'ancienne copie
pendant dix minutes) ; relancer le script sans rien changer ne change rien.

A quoi ca sert : GitHub Pages sert les fichiers avec un cache de dix minutes.
Sans marque, une correction poussee peut mettre ce temps-la a arriver — voire
ne jamais arriver sur un navigateur qui a garde l'ancienne copie, ou melanger
un fichier neuf et un vieux. Avec le ?v=, chaque etat du code est une adresse
differente : le navigateur ne peut pas servir l'ancien par erreur.

A lancer avant chaque mise en ligne qui touche au code, en dernier (apres
toute autre modification des css et des js)."""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if len(sys.argv) < 2 or not re.fullmatch(r'\d+\.\d+(\.\d+)?', sys.argv[1]):
    print(__doc__)
    raise SystemExit(1)
V = sys.argv[1]

def ecrire(rel, fn):
    chemin = os.path.join(ROOT, rel)
    avant = open(chemin, encoding='utf-8').read()
    apres = fn(avant)
    if apres != avant:
        open(chemin, 'w', encoding='utf-8').write(apres)
    return apres != avant

# --- le numero lu par le joueur ---
ecrire('js/pwa.js', lambda s: re.sub(r"const APP_VERSION = '[^']*'",
                                     "const APP_VERSION = '%s'" % V, s))

# --- l'empreinte du code (apres le numero : js/pwa.js en fait partie) ---
FICHIER = re.compile(r'(?:href|src)="((?!https?:|//)[^"?]+\.(?:css|js))')
pages = ''.join(open(os.path.join(ROOT, p), encoding='utf-8').read() for p in ('index.html', 'verif.html'))
empreinte = hashlib.sha1()
for f in sorted(set(FICHIER.findall(pages))):
    empreinte.update(f.encode('utf-8'))
    empreinte.update(open(os.path.join(ROOT, f), 'rb').read())
T = '%s-%s' % (V, empreinte.hexdigest()[:6])

ecrire('sw.js', lambda s: re.sub(r"const VERSION = 'mtcg-v[^']*'",
                                 "const VERSION = 'mtcg-v%s'" % T, s))

# --- la marque sur chaque fichier local ---
MARQUE = re.compile(r'((?:href|src)=")((?!https?:|//)[^"?]+\.(?:css|js))(?:\?v=[^"]*)?(")')
n = 0
for page in ('index.html', 'verif.html'):
    compteur = [0]
    def poser(m):
        compteur[0] += 1
        return '%s%s?v=%s%s' % (m.group(1), m.group(2), T, m.group(3))
    ecrire(page, lambda s: MARQUE.sub(poser, s))
    print('  %-12s %d fichiers marques' % (page, compteur[0]))
    n += compteur[0]

print('Version %s posee (marque %s) sur %d references.' % (V, T, n))


# --- le cache hors reseau suit la page, automatiquement ---
# La liste ESSENTIEL de sw.js doit contenir exactement les css et les js que
# charge index.html. Tenue a la main, elle avait deja divergé : js/promos.js
# manquait, et comme render() l'appelle a chaque rendu, l'application ne
# demarrait plus du tout sans reseau. On la regenere depuis la page plutot que
# d'esperer que personne n'oublie une ligne.
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
# La marque ?v= vient d'etre posee juste au-dessus : on s'arrete au ? comme au ".
fichiers = re.findall(r'(?:href|src)="((?:css|js)/[^"?]+)', html)

sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
deb = sw.index('const ESSENTIEL')
i = sw.index("'./', 'index.html', 'manifest.webmanifest',", deb)
j = sw.index("'assets/logo-m8.webp'", i)

lignes, courante = [], "  './', 'index.html', 'manifest.webmanifest',"
for f in fichiers:
    bout = " '%s'," % f
    if len(courante) + len(bout) > 96:
        lignes.append(courante)
        courante = ' '
    courante += bout
lignes.append(courante)
neuf = chr(10).join(lignes).strip() + chr(10) + '  '

if sw[i:j] != neuf:
    open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw[:i] + neuf + sw[j:])
    print('  sw.js        cache hors reseau resynchronise (%d css/js)' % len(fichiers))
else:
    print('  sw.js        cache hors reseau deja a jour (%d css/js)' % len(fichiers))

print('Pense a `git add -A && git commit && git push` pour la mettre en ligne.')
