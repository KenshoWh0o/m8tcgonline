#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Calcule l'empreinte d'un code d'acces, a recopier dans js/gate.js.

    python3 tools/code-porte.py "MonNouveauCode"

Le code lui-meme n'est jamais ecrit dans le site : seule son empreinte l'est,
pour qu'on ne le trouve pas en clair en lisant la page."""
import hashlib, sys

SEL = 'mtcg.v2.porte:'

if len(sys.argv) < 2:
    print(__doc__)
    raise SystemExit(1)

code = sys.argv[1]
empreinte = hashlib.sha256((SEL + code).encode('utf-8')).hexdigest()

print("Code      : %s" % code)
print("Empreinte : %s" % empreinte)
print()
print("A recopier dans js/gate.js :")
print("  empreinte: '%s'," % empreinte)
print()
print("Les personnes qui avaient l'ancien code devront ressaisir le nouveau.")
