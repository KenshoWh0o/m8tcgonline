#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique la demo autonome : le jeu entier, sans compte ni serveur.

    python3 tools/demo.py

Produit :
  _build/m8tcg-demo/       le dossier, pret a ouvrir (index.html)
  _build/m8tcg-demo.zip    le meme, a envoyer

Comment ca marche : le jeu ne parle au serveur que par le client Supabase.
La demo remplace ce client par un faux (_demo/serveur.js) qui applique les
memes regles, dans le navigateur. Le code du jeu est copie tel quel : rien
de ce qui est publie sur le site ne change, et le site ne contient pas la
demo (les dossiers commencant par _ ne sont pas publies par GitHub Pages).

A relancer apres chaque modification du jeu, pour que la demo suive."""
import os, re, shutil, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_demo')
BUILD = os.path.join(ROOT, '_build')
OUT = os.path.join(BUILD, 'm8tcg-demo')

# Ce qui part dans la demo. Tout le reste (serveur SQL, outils, kit presse,
# page de diagnostic, adresse du site) n'a rien a y faire.
FICHIERS = ['index.html', 'manifest.webmanifest', 'sw.js']
DOSSIERS = ['assets', 'cards', 'css', 'js']


def lire(rel):
    return open(os.path.join(OUT, rel), encoding='utf-8').read()


def ecrire(rel, texte):
    open(os.path.join(OUT, rel), 'w', encoding='utf-8').write(texte)


def remplacer(texte, avant, apres, quoi):
    """Un remplacement qui doit avoir lieu : s'il ne trouve rien, c'est que
    le jeu a change et que la demo ne le suit plus. On s'arrete."""
    nouveau, n = re.subn(avant, apres, texte, count=1)
    if n != 1:
        raise SystemExit('Echec : impossible de trouver ' + quoi + '. Le script est a mettre a jour.')
    return nouveau


shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
for f in FICHIERS:
    shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
for d in DOSSIERS:
    shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))

# --- le faux serveur et ses reglages
shutil.copy2(os.path.join(SRC, 'serveur.js'), os.path.join(OUT, 'js', 'demo-serveur.js'))
shutil.copy2(os.path.join(SRC, 'reglages.js'), os.path.join(OUT, 'js', 'demo-reglages.js'))
shutil.copy2(os.path.join(SRC, 'LISEZMOI.txt'), os.path.join(OUT, 'LISEZMOI.txt'))

# --- plus de vraies cles : Backend.init() voit une configuration, et le faux
#     client la prend en charge.
ecrire('js/supabase-config.js', '''/* Demo autonome : aucun serveur. Ces valeurs ne servent qu'a dire au jeu
   « un compte existe » ; c'est js/demo-serveur.js qui repond a sa place. */
"use strict";

const SUPABASE_URL = 'https://demo.invalid';
const SUPABASE_ANON_KEY = 'demo-locale-aucune-cle-necessaire';
''')

# --- la page charge le faux client a la place de la bibliotheque Supabase
page = lire('index.html')
version = re.search(r'js/config\.js\?v=([\d.]+)', page)
v = version.group(1) if version else 'demo'
page = remplacer(page,
    r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^"]*"[^>]*></script>',
    f'<script src="js/demo-reglages.js?v={v}"></script>\n'
    f'<script src="js/demo-serveur.js?v={v}"></script>',
    'la balise de la bibliotheque Supabase dans index.html')
ecrire('index.html', page)

# --- le service worker garde aussi ces deux fichiers pour le hors reseau
sw = lire('sw.js')
sw = remplacer(sw, r"'js/app\.js',",
    "'js/app.js', 'js/demo-reglages.js', 'js/demo-serveur.js',",
    "la liste ESSENTIEL de sw.js")
ecrire('sw.js', sw)

# --- l'archive a envoyer
archive = os.path.join(BUILD, 'm8tcg-demo.zip')
if os.path.exists(archive):
    os.remove(archive)
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for dossier, _, fichiers in os.walk(OUT):
        for f in sorted(fichiers):
            chemin = os.path.join(dossier, f)
            z.write(chemin, os.path.join('m8tcg-demo', os.path.relpath(chemin, OUT)))

taille = os.path.getsize(archive) / 1e6
print(f'Demo prete : {os.path.relpath(OUT, ROOT)}/index.html')
print(f'Archive    : {os.path.relpath(archive, ROOT)} ({taille:.1f} Mo)')
