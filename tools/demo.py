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

A relancer apres chaque modification du jeu, pour que la demo suive.

    python3 tools/demo.py --preprod

Produit la meme demo dans preprod/, publiee par GitHub Pages a cote du vrai
site (matetcg.com/preprod/) : c'est la que se teste la version suivante,
sans compte et sans toucher au vrai serveur. Par rapport a la demo :
  - tout ce que la page range dans le navigateur (localStorage, IndexedDB)
    porte un prefixe a part : la pre-prod ne lit ni n'ecrase les reglages,
    les fenetres deja vues ou la session du vrai site, qui partage l'adresse ;
  - pas de service worker : celui du vrai site couvre deja l'adresse, et deux
    service workers sur la meme origine se videraient leurs caches ;
  - un bandeau « PRE-PROD », pas d'indexation, et le Labo ouvert."""
import json, os, re, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_demo')
BUILD = os.path.join(ROOT, '_build')
PREBUILD = '--prebuild' in sys.argv
PREPROD = '--preprod' in sys.argv or PREBUILD
# Le prebuild : la meme chose que la pre-prod, mais pour la version 2.x en
# cours (une branche partie de main), dans prebuild/, avec son propre
# stockage — la pre-prod de la 3.0 et lui vivent cote a cote sur main.
DOSSIER = 'prebuild' if PREBUILD else 'preprod'
OUT = os.path.join(ROOT, DOSSIER) if PREPROD else os.path.join(BUILD, 'm8tcg-demo')

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

# --- Devine l'illu : les grilles de pixels du serveur (supabase/21b_illu.sql).
#     Une demo n'a rien a cacher : le faux serveur les garde dans la page.
illu = dict(re.findall(r"\('(c\d+)', decode\('([^']+)', 'base64'\)\)",
                       open(os.path.join(ROOT, 'supabase', '21b_illu.sql'), encoding='utf-8').read()))
open(os.path.join(OUT, 'js', 'demo-illu.js'), 'w', encoding='utf-8').write(
    '/* Devine l\'illu : les grilles du serveur, pour le faux serveur de la demo. */\n'
    'window.DEMO_ILLU = ' + json.dumps(illu, separators=(',', ':')) + ';\n')

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
# La marque des fichiers (version et empreinte, tools/version.py), et le
# numero que lit le joueur (APP_VERSION), pour le titre et le bandeau.
version = re.search(r'js/config\.js\?v=([^"]+)"', page)
marque = version.group(1) if version else 'demo'
num = re.search(r"const APP_VERSION = '([^']+)'", open(os.path.join(ROOT, 'js', 'pwa.js'), encoding='utf-8').read())
v = num.group(1) if num else marque
page = remplacer(page,
    r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js[^"]*"[^>]*></script>',
    f'<script src="js/demo-reglages.js?v={marque}"></script>\n'
    f'<script src="js/demo-illu.js?v={marque}"></script>\n'
    f'<script src="js/demo-serveur.js?v={marque}"></script>',
    'la balise de la bibliotheque Supabase dans index.html')
ecrire('index.html', page)

# --- le service worker garde aussi ces deux fichiers pour le hors reseau
sw = lire('sw.js')
sw = remplacer(sw, r"'js/app\.js',",
    "'js/app.js', 'js/demo-reglages.js', 'js/demo-illu.js', 'js/demo-serveur.js',",
    "la liste ESSENTIEL de sw.js")
ecrire('sw.js', sw)

# --- la pre-prod : isolee du vrai site qui partage son adresse
TETE_PREPROD = """<head>
<meta name="robots" content="noindex, nofollow">
@@ECH@@
<script>
/* Pre-prod : tout ce que la page range porte le prefixe « preprod: ». Le
   vrai site partage cette adresse (matetcg.com) : sans ce prefixe, les deux
   se liraient et s'ecraseraient leurs reglages. */
(function () {
  var P = '@@DOSSIER@@:', S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem, k = S.key;
  S.getItem = function (x) { return g.call(this, P + x); };
  S.setItem = function (x, v) { return s.call(this, P + x, v); };
  S.removeItem = function (x) { return r.call(this, P + x); };
  S.clear = function () {
    for (var i = this.length - 1; i >= 0; i--) { var n = k.call(this, i); if (n && n.indexOf(P) === 0) r.call(this, n); }
  };
})();
</script>
<style>
.preprod-bandeau{position:fixed;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);z-index:99999;
  pointer-events:none;font:800 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;
  padding:4px 10px 5px;border-radius:0 0 8px 8px;background:#ffc73b;color:#3a2600;box-shadow:0 2px 8px rgba(0,0,0,.25)}
</style>
"""

if PREPROD:
    page = lire('index.html')
    # En tout premier : le stockage du navigateur passe sous un prefixe.
    # Le prebuild ouvre L'Echauffement d'office, ses sept defis (_demo/serveur.js).
    tete = TETE_PREPROD.replace('@@DOSSIER@@', DOSSIER).replace('@@ECH@@',
        '<script>var DEMO_ECHAUFFEMENT = 7;</script>\n' if PREBUILD else '')
    page = remplacer(page, r'<head>\n', lambda m: tete, "la balise <head> d'index.html")
    nomv = 'PRÉBUILD' if PREBUILD else 'PRÉ-PROD'
    page = remplacer(page, r'<title>[^<]*</title>', lambda m: f'<title>{nomv} {v} · Mate TCG Online</title>',
                     'le titre de la page')
    page = remplacer(page, r'<body([^>]*)>',
                     lambda m: m.group(0) + "\n<div class=\"preprod-bandeau\">" + ('Prébuild ' + v if PREBUILD else 'Pré-prod') + " · démo, rien n'est réel</div>",
                     "la balise <body> d'index.html")
    ecrire('index.html', page)
    # Une base IndexedDB a part.
    ecrire('js/storage.js', remplacer(lire('js/storage.js'), r"indexedDB\.open\('premier-lobby'",
                                      lambda m: "indexedDB.open('premier-lobby-" + DOSSIER + "'", 'la base IndexedDB de js/storage.js'))
    # Pas de service worker.
    ecrire('js/pwa.js', remplacer(lire('js/pwa.js'), r'function brancherSW\(\) \{',
                                  lambda m: m.group(0) + '\n  return; /* pre-prod : pas de service worker (tools/demo.py) */',
                                  'brancherSW dans js/pwa.js'))
    # Installee sur l'ecran d'accueil, elle ne se confond pas avec le vrai jeu.
    ecrire('manifest.webmanifest', remplacer(lire('manifest.webmanifest'), r'"name": "[^"]*",\s*"short_name": "[^"]*"',
        lambda m: ('"name": "Mate TCG Prébuild",\n  "short_name": "TCG Prébuild"' if PREBUILD
                   else '"name": "Mate TCG Pré-prod",\n  "short_name": "TCG Pré-prod"'), 'les noms du manifeste'))
    os.remove(os.path.join(OUT, 'sw.js'))
    os.remove(os.path.join(OUT, 'LISEZMOI.txt'))
    # Le joueur de la pre-prod est administrateur : le Labo sert a tout tester.
    ecrire('js/demo-serveur.js', remplacer(lire('js/demo-serveur.js'),
        r"S\.profils\[MOI\] = nouveauProfil\(MOI, D\.pseudo, \{ shards: D\.eclats \}\);",
        lambda m: m.group(0) + '\n    S.profils[MOI].is_admin = true; /* pre-prod : le Labo est ouvert */',
        'la creation du joueur dans demo-serveur.js'))
    print(f'{"Prebuild" if PREBUILD else "Pre-prod"} pret(e) : {DOSSIER}/ (version {v}), publie(e) a matetcg.com/{DOSSIER}/ une fois pousse(e) sur main')
    sys.exit(0)

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
