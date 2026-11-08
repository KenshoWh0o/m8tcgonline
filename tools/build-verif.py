#!/usr/bin/env python3
"""Assemble le code du jeu pour la fonction du serveur qui vérifie les combats
(version 3.0.14).

    python3 tools/build-verif.py

écrit supabase/functions/combat-verifier/jeu.js : les fichiers du moteur, des
decks, de l'adversaire, des modes et de la vérification (js/combat/verif.js),
mis bout à bout en un module (Deno, comme le navigateur charge ses scripts
l'un après l'autre), puis le catalogue des cartes. Le fichier est généré :
le refaire après toute modification de ces fichiers, comme TOUT.sql. La
liste est celle de tools/combat-sim.js, sans ce qui ne sert qu'aux tests
(tutoriel, niveaux)."""
import hashlib
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIERS = [
    'js/config.js', 'js/utils.js', 'js/cards-data.js', 'js/promos-data.js', 'js/cards.js',
    'js/combat/moteur.js', 'js/combat/effets.js', 'js/combat/decks.js', 'js/combat/ia.js',
    'js/combat/campagne.js', 'js/combat/choc-data.js', 'js/combat/historique.js', 'js/combat/verif.js',
]
SORTIE = os.path.join(RACINE, 'supabase', 'functions', 'combat-verifier', 'jeu.js')


def main():
    morceaux = []
    for f in FICHIERS:
        with open(os.path.join(RACINE, f), encoding='utf-8') as x:
            morceaux.append('// ---- ' + f + '\n' + x.read())
    corps = '\n'.join(morceaux)
    empreinte = hashlib.sha256(corps.encode('utf-8')).hexdigest()[:12]
    tete = (
        '// Généré par tools/build-verif.py (empreinte ' + empreinte + ') : ne pas modifier à la main.\n'
        '// Le code du jeu, tel que le navigateur le charge, pour rejouer un combat sur le serveur.\n'
        '/* eslint-disable */\n'
        '// @ts-nocheck\n'
        'var window = globalThis;\n'
        # js/combat/historique.js lit byId (js/storage.js) et fmtN (js/ui.js), qui ne viennent pas ici.
        'var byId = {};\n'
        'var fmtN = n => String(n == null ? 0 : n);\n'
    )
    pied = (
        '\n// ---- le catalogue des cartes, comme au démarrage de la page\n'
        'var __cartes = buildCards();\n'
        'Combat.catalogue(__cartes.concat(buildPromos(), buildReverses(__cartes), buildUniques(), buildSecretes()));\n'
        'export const EMPREINTE = ' + repr(empreinte) + ';\n'
        # Le moteur, les decks et l'adversaire s'accrochent a globalThis (leurs
        # fichiers sont des fonctions qui s'executent d'elles-memes) ; un
        # `const Combat` ici masquerait la leur pour tout le module.
        'export const Jeu = { Verif, Combat: globalThis.Combat, IA: globalThis.IA, Decks: globalThis.Decks };\n'
    )
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, 'w', encoding='utf-8') as x:
        x.write(tete + corps + pied)
    print('supabase/functions/combat-verifier/jeu.js assemblé : %d Ko, empreinte %s' % (len((tete + corps + pied).encode('utf-8')) // 1024, empreinte))


if __name__ == '__main__':
    main()
