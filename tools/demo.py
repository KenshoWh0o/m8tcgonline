#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique les deux demos de la 3.0, qui tournent sans compte ni serveur.

Comment ca marche : le jeu ne parle au serveur que par le client Supabase.
La demo remplace ce client par un faux (_demo/serveur.js) qui applique les
memes regles, dans le navigateur. Le code du jeu est copie tel quel.

    python3 tools/demo.py --preprod

Produit la pre-prod dans preprod/, publiee par GitHub Pages a cote du vrai
site (matetcg.com/preprod/) : c'est la que le proprietaire teste la 3.0
qu'il publiera pour les joueurs du vrai site, sans compte et sans toucher
au vrai serveur.
  - tout ce que la page range dans le navigateur (localStorage, IndexedDB)
    porte un prefixe a part : la pre-prod ne lit ni n'ecrase les reglages,
    les fenetres deja vues ou la session du vrai site, qui partage l'adresse ;
  - pas de service worker : celui du vrai site couvre deja l'adresse, et deux
    service workers sur la meme origine se videraient leurs caches ;
  - un bandeau « PRE-PROD », pas d'indexation, et le Labo ouvert.

    python3 tools/demo.py --demo

Produit la demo presentee a Gentle Mates dans demo/, reportee sur main a
matetcg.com/demo/ (version 3.0.14, a la demande du proprietaire). Comme la
pre-prod (stockage a part, prefixe « demo: », pas de service worker, pas
d'indexation, le Labo ouvert), avec en plus :
  - une porte a code (_demo/acces.js) : le jeu ne demarre qu'une fois le bon
    code entre ; la page n'en connait que l'empreinte ;
  - window.DEMO_M8 = true, que lit js/config.js (DEMO) : ni numero de
    version, ni nouveautes, ni traces des evenements passes, une
    presentation a la premiere visite, le Labo en console de test ;
  - pas de bandeau.
preprod/ est suivi par git sur la branche version-3.0, demo/ non.

La demo autonome en zip (sans option) a ete retiree le 2 novembre 2026, a
la demande du proprietaire : la demo en ligne la remplace."""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_demo')
PREPROD = '--preprod' in sys.argv
DEMO_M8 = '--demo' in sys.argv
if PREPROD == DEMO_M8:
    raise SystemExit('Usage : python3 tools/demo.py --preprod (preprod/) ou --demo (demo/).')
OUT = os.path.join(ROOT, 'preprod' if PREPROD else 'demo')

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

# --- Devine l'illu : les grilles de pixels du serveur (supabase/installation/21b_illu.sql).
#     Une demo n'a rien a cacher : le faux serveur les garde dans la page.
illu = dict(re.findall(r"\('(c\d+)', decode\('([^']+)', 'base64'\)\)",
                       open(os.path.join(ROOT, 'supabase', 'installation', '21b_illu.sql'), encoding='utf-8').read()))
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

# --- l'ecran d'entree : celui de la demo, jamais l'annonce d'arret du vrai
#     site. Deconnecte, on y revient d'un geste ; si la demo n'a pas demarre,
#     il dit pourquoi et propose de repartir de zero (window.demoPorte,
#     _demo/serveur.js). Sans ca, un echec au demarrage laissait la page sur
#     « Merci », sans issue.
ecrire('js/gate.js', remplacer(lire('js/gate.js'), r'function vPorteAttente\(\) \{',
    lambda m: m.group(0) + "\n  if (typeof demoPorte === 'function') return demoPorte(); /* demo (tools/demo.py) */",
    "vPorteAttente dans js/gate.js"))

# --- le service worker garde aussi ces deux fichiers pour le hors reseau
sw = lire('sw.js')
sw = remplacer(sw, r"'js/app\.js',",
    "'js/app.js', 'js/demo-reglages.js', 'js/demo-illu.js', 'js/demo-serveur.js',",
    "la liste ESSENTIEL de sw.js")
ecrire('sw.js', sw)

# --- la pre-prod : isolee du vrai site qui partage son adresse
TETE_PREPROD = """<head>
<meta name="robots" content="noindex, nofollow">
<script>
/* Pre-prod : tout ce que la page range porte le prefixe « preprod: ». Le
   vrai site partage cette adresse (matetcg.com) : sans ce prefixe, les deux
   se liraient et s'ecraseraient leurs reglages. */
(function () {
  var P = '__PREFIXE__:', S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem, k = S.key;
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
  padding:4px 10px 5px;border-radius:0 0 8px 8px;background:#2d2b3a;color:#e6e1ff;box-shadow:inset 0 0 0 1px rgba(179,166,255,.45),0 2px 8px rgba(0,0,0,.3)}
</style>
"""

if PREPROD or DEMO_M8:
    prefixe = 'demo' if DEMO_M8 else 'preprod'
    page = lire('index.html')
    # En tout premier : le stockage du navigateur passe sous un prefixe.
    tete = TETE_PREPROD.replace('__PREFIXE__', prefixe)
    if DEMO_M8:
        # La demo de Gentle Mates : le drapeau que lit js/config.js (DEMO),
        # pose avant tout script ; pas de bandeau.
        tete = tete.replace('<script>\n', '<script>\nwindow.DEMO_M8 = true;\n', 1)
    page = remplacer(page, r'<head>\n', lambda m: tete, "la balise <head> d'index.html")
    page = remplacer(page, r'<title>[^<]*</title>',
                     lambda m: '<title>Mate TCG Online · Démo</title>' if DEMO_M8 else f'<title>PRÉ-PROD {v} · Mate TCG Online</title>',
                     'le titre de la page')
    page = remplacer(page, r'<link rel="canonical"[^>]*>\n', lambda m: '', "l'adresse canonique d'index.html")
    if DEMO_M8:
        # La porte a code, chargee juste avant js/app.js, qui l'attend.
        page = remplacer(page, r'<script src="js/app\.js',
                         lambda m: f'<script src="js/demo-acces.js?v={marque}"></script>\n' + m.group(0),
                         "la balise de js/app.js dans index.html")
    else:
        page = remplacer(page, r'<body([^>]*)>',
                         lambda m: m.group(0) + "\n<div class=\"preprod-bandeau\">Pré-prod · démo, rien n'est réel</div>",
                         "la balise <body> d'index.html")
    if DEMO_M8:
        # Pas de numero de version dans les adresses des fichiers : la marque
        # garde seulement son empreinte (tools/version.py).
        neutre = marque.split('-')[-1]
        page = page.replace('?v=' + marque, '?v=' + neutre)
        v = neutre
    ecrire('index.html', page)
    if DEMO_M8:
        shutil.copy2(os.path.join(SRC, 'acces.js'), os.path.join(OUT, 'js', 'demo-acces.js'))
        ecrire('js/app.js', remplacer(lire('js/app.js'), r'\(async \(\) => \{\n  cards = buildCards\(\);',
            lambda m: '(async () => {\n  if (window.demoAcces) await window.demoAcces(); /* demo : la porte a code (tools/demo.py) */\n  cards = buildCards();',
            'le demarrage du jeu dans js/app.js'))
    # Une base IndexedDB a part.
    ecrire('js/storage.js', remplacer(lire('js/storage.js'), r"indexedDB\.open\('premier-lobby'",
                                      lambda m: f"indexedDB.open('premier-lobby-{prefixe}'", 'la base IndexedDB de js/storage.js'))
    # Pas de service worker.
    ecrire('js/pwa.js', remplacer(lire('js/pwa.js'), r'function brancherSW\(\) \{',
                                  lambda m: m.group(0) + '\n  return; /* pre-prod et demo : pas de service worker (tools/demo.py) */',
                                  'brancherSW dans js/pwa.js'))
    # Installee sur l'ecran d'accueil, elle ne se confond pas avec le vrai jeu.
    noms = ('"name": "Mate TCG Démo",\n  "short_name": "TCG Démo"' if DEMO_M8
            else '"name": "Mate TCG Pré-prod",\n  "short_name": "TCG Pré-prod"')
    ecrire('manifest.webmanifest', remplacer(lire('manifest.webmanifest'), r'"name": "[^"]*",\s*"short_name": "[^"]*"',
        lambda m: noms, 'les noms du manifeste'))
    # Les images de assets/ portent la version. Le service worker du vrai
    # site couvre aussi /preprod/ et sert les images depuis son cache sans
    # jamais les redemander (sw.js, « estMedia ») : une image retouchee sous
    # le meme nom restait l'ancienne chez qui avait deja visite le site.
    # Les cartes (cards/) ne changent pas : elles gardent leur adresse.
    motif = re.compile(r"((?<![\w/.-])(?:\.\./)?assets/[\w./-]+\.(?:svg|webp|png|jpe?g|avif|gif))(?![?\w])")
    for dossier, _, fichiers in os.walk(OUT):
        for f in fichiers:
            if not re.search(r'\.(css|js|html)$', f) or f.startswith('demo-illu'):
                continue
            chemin = os.path.join(dossier, f)
            texte = open(chemin, encoding='utf-8').read()
            nouveau = motif.sub(lambda m: m.group(1) + '?v=' + v, texte)
            if nouveau != texte:
                open(chemin, 'w', encoding='utf-8').write(nouveau)
    os.remove(os.path.join(OUT, 'sw.js'))
    # Le joueur de la pre-prod est administrateur : le Labo sert a tout tester.
    ecrire('js/demo-serveur.js', remplacer(lire('js/demo-serveur.js'),
        r"S\.profils\[MOI\] = nouveauProfil\(MOI, D\.pseudo, \{ shards: D\.eclats \}\);",
        lambda m: m.group(0) + '\n    S.profils[MOI].is_admin = true; /* pre-prod et demo : le Labo est ouvert */',
        'la creation du joueur dans demo-serveur.js'))
    if DEMO_M8:
        print(f'Demo prete : demo/ (marque {v}), a reporter sur main pour matetcg.com/demo/')
    else:
        print(f'Pre-prod prete : preprod/ (version {v}), publiee a matetcg.com/preprod/ une fois poussee sur main')
    sys.exit(0)
