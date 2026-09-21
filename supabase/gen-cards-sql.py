#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenere supabase/02_cards.sql a partir de js/cards-data.js.
A relancer (puis rejouer le SQL dans Supabase) des qu'une carte est ajoutee ou retiree :
    python3 supabase/gen-cards-sql.py
Le serveur tire les boosters dans cette table ; si elle est en retard sur le jeu,
les nouvelles cartes ne sortiront jamais."""
import re, os, unicodedata, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'js', 'cards-data.js'), encoding='utf-8').read()

def noacc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').lower().strip()

def norm_col(v):
    s = noacc(v)
    return {'violet': 'violette', 'vert': 'verte', 'bleu': 'bleue'}.get(s, s)

def norm_cat(v):
    s = noacc(v)
    for k in ('joueur', 'coach', 'moment', 'objet', 'essence'):
        if s.startswith(k):
            return k
    return 'joueur'

def field(block, name):
    m = re.search(r'\b%s\s*:\s*"((?:[^"\\]|\\.)*)"' % name, block)
    if m:
        return m.group(1).replace('\\"', '"').replace('\\\\', '\\')
    m = re.search(r'\b%s\s*:\s*([0-9]+)' % name, block)
    return m.group(1) if m else None

# Chaque carte commence par « { fichier: » ou « { num: » au premier niveau du tableau.
blocks = re.split(r'\n  \{', src)[1:]
rows, seen = [], set()
for b in blocks:
    num = field(b, 'num')
    nom = field(b, 'nom')
    if not num or not nom:
        continue
    cid = 'c' + str(int(num)).zfill(3)
    if cid in seen:
        print('  ! doublon ignore : %s (%s)' % (cid, nom), file=sys.stderr)
        continue
    seen.add(cid)
    cat = norm_cat(field(b, 'categorie') or 'joueur')
    col = norm_col(field(b, 'couleur') or 'neutre')
    rar = (field(b, 'rarete') or ('ES' if cat == 'essence' else 'C')).upper()
    inb = 'false' if re.search(r'\bbooster\s*:\s*false', b) else 'true'
    rows.append((cid, int(num), nom, cat, col, rar, inb))

rows.sort(key=lambda r: r[1])
q = lambda s: "'" + s.replace("'", "''") + "'"
out = ["""-- =====================================================================
--  Mate TCG Online — catalogue des cartes (genere, ne pas editer a la main)
--  Source : js/cards-data.js  ·  Regenerer : python3 supabase/gen-cards-sql.py
--  A rejouer dans Supabase apres chaque ajout ou retrait de carte.
-- =====================================================================

insert into public.cards (id, num, nom, cat, col, rar, in_booster) values"""]
out.append(',\n'.join(
    "  (%s, %d, %s, %s, %s, %s, %s)" % (q(c), n, q(nm), q(ct), q(cl), q(rr), ib)
    for (c, n, nm, ct, cl, rr, ib) in rows))
out.append("""on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat,
  col = excluded.col, rar = excluded.rar, in_booster = excluded.in_booster;

-- Une carte retiree de js/cards-data.js disparait aussi du tirage serveur.
delete from public.cards where id not in (%s);
""" % ', '.join(q(r[0]) for r in rows))

open(os.path.join(ROOT, 'supabase', '02_cards.sql'), 'w', encoding='utf-8').write('\n'.join(out))

from collections import Counter
print('%d cartes ecrites dans supabase/02_cards.sql' % len(rows))
print('  raretes :', dict(sorted(Counter(r[5] for r in rows).items())))
print('  categories :', dict(sorted(Counter(r[3] for r in rows).items())))
print('  essences :', dict(sorted(Counter(r[4] for r in rows).items())))
