#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pose un numero de version partout, et l'accroche aux fichiers du site.

    python3 tools/version.py 2.3.1

Ce que ca fait :
  - ecrit la version dans js/pwa.js (APP_VERSION) et sw.js (VERSION du cache)
  - ajoute ?v=<version> a chaque css et js de index.html et verif.html

A quoi ca sert : GitHub Pages sert les fichiers avec un cache de dix minutes.
Sans marque de version, une correction poussee peut mettre ce temps-la a
arriver — voire ne jamais arriver sur un navigateur qui a garde l'ancienne
copie. Avec le ?v=, chaque version est une adresse differente : le navigateur
ne peut pas servir l'ancienne par erreur.

A lancer avant chaque mise en ligne qui touche au code."""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if len(sys.argv) < 2 or not re.fullmatch(r'\d+\.\d+\.\d+', sys.argv[1]):
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

# --- les deux constantes ---
ecrire('js/pwa.js', lambda s: re.sub(r"const APP_VERSION = '[^']*'",
                                     "const APP_VERSION = '%s'" % V, s))
ecrire('sw.js', lambda s: re.sub(r"const VERSION = 'mtcg-v[^']*'",
                                 "const VERSION = 'mtcg-v%s'" % V, s))

# --- la marque sur chaque fichier local ---
MARQUE = re.compile(r'((?:href|src)=")((?!https?:|//)[^"?]+\.(?:css|js))(?:\?v=[^"]*)?(")')
n = 0
for page in ('index.html', 'verif.html'):
    compteur = [0]
    def poser(m):
        compteur[0] += 1
        return '%s%s?v=%s%s' % (m.group(1), m.group(2), V, m.group(3))
    ecrire(page, lambda s: MARQUE.sub(poser, s))
    print('  %-12s %d fichiers marques' % (page, compteur[0]))
    n += compteur[0]

print('Version %s posee sur %d references.' % (V, n))
print('Pense a `git add -A && git commit && git push` pour la mettre en ligne.')
