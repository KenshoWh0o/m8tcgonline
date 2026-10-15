#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenere supabase/installation/02_cards.sql a partir de js/cards-data.js.
A relancer (puis rejouer le SQL dans Supabase) des qu'une carte est ajoutee ou retiree :
    python3 tools/gen-cards-sql.py
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
--  Source : js/cards-data.js  ·  Regenerer : python3 tools/gen-cards-sql.py
--  A rejouer dans Supabase apres chaque ajout ou retrait de carte.
-- =====================================================================

-- La colonne qui distingue les Promos du reste. Elle est aussi creee par
-- 01_schema.sql ; on la redemande ici pour que ce fichier reste jouable seul,
-- ce qui est son usage courant : on le rejoue a chaque ajout de carte.
alter table public.cards add column if not exists promo boolean not null default false;

insert into public.cards (id, num, nom, cat, col, rar, in_booster) values"""]
out.append(',\n'.join(
    "  (%s, %d, %s, %s, %s, %s, %s)" % (q(c), n, q(nm), q(ct), q(cl), q(rr), ib)
    for (c, n, nm, ct, cl, rr, ib) in rows))
liste = ', '.join(q(r[0]) for r in rows)
out.append("""on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat,
  col = excluded.col, rar = excluded.rar, in_booster = excluded.in_booster;

-- ---------------------------------------------------------------- menage
-- Une carte retiree de js/cards-data.js disparait aussi du tirage serveur.
--
-- Ce bloc est plus long qu'un simple `delete` pour deux raisons, apprises
-- chacune a ses depens :
--
-- 1. `and not promo`. Ce fichier ne connait que l'extension. Les cartes Promo
--    sont creees plus loin, par 03b_promos.sql, et n'apparaissent donc jamais
--    dans la liste ci-dessus. Sans ce garde-fou, rejouer l'installation les
--    effacait — et la boutique, qui en vend deux, refusait l'operation :
--        violates foreign key constraint "shop_items_carte_id_fkey"
--    La premiere execution passait (les Promos n'existaient pas encore), la
--    seconde echouait. C'est le genre de piege qui ne se voit qu'au deuxieme
--    passage.
--
-- 2. Les echanges en attente. `trades` pointe vers `cards` sans cascade : une
--    carte retiree alors qu'un echange la propose bloquerait toute
--    l'installation sur un message illisible. On annule donc ces demandes
--    d'abord — elles ne peuvent de toute facon plus etre honorees — et on le
--    dit dans les logs.
--
-- Ce qui reste volontairement bloquant : une carte encore vendue en boutique.
-- La, c'est une erreur de configuration, et l'effacer en silence ferait bien
-- plus de degats que de s'arreter.
do $$
declare
  a_retirer text[];
  vendues   text[];
  n_ech     int;
begin
  select array_agg(id) into a_retirer
    from public.cards
   where not promo and id <> all (array[__IDS__]);

  if a_retirer is null then
    raise notice 'Catalogue a jour : aucune carte a retirer.';
    return;
  end if;

  select array_agg(carte_id) into vendues
    from public.shop_items where carte_id = any (a_retirer);
  if vendues is not null then
    raise exception
      'Menage impossible : la boutique vend encore %. Retire l''article '
      'correspondant de 04_seed.sql, ou remets la carte dans js/cards-data.js.',
      vendues;
  end if;

  -- Ces annulations-la ne sont PAS remboursees, et c'est deliberate :
  -- rembourser_demande() vit dans 03_rpc.sql, qui est joue apres ce
  -- fichier-ci. L'appeler d'ici ferait dependre l'installation de son propre
  -- ordre. Le cas est de toute facon une operation d'administration — on
  -- retire une carte du jeu —, pas quelque chose qu'un joueur declenche.
  update public.trades set status = 'cancelled', resolved_at = now()
   where status = 'pending'
     and (offer_card = any (a_retirer) or want_card = any (a_retirer));
  get diagnostics n_ech = row_count;
  if n_ech > 0 then
    raise notice '% demande(s) d''echange annulee(s) : la carte proposee n''existe plus.', n_ech;
  end if;

  delete from public.trades where offer_card = any (a_retirer) or want_card = any (a_retirer);
  delete from public.cards  where id = any (a_retirer);
  raise notice '% carte(s) retiree(s) du catalogue serveur.', array_length(a_retirer, 1);
end $$;
""".replace('__IDS__', liste))

open(os.path.join(ROOT, 'supabase', 'installation', '02_cards.sql'), 'w', encoding='utf-8').write('\n'.join(out))

from collections import Counter
print('%d cartes ecrites dans supabase/installation/02_cards.sql' % len(rows))
print('  raretes :', dict(sorted(Counter(r[5] for r in rows).items())))
print('  categories :', dict(sorted(Counter(r[3] for r in rows).items())))
print('  essences :', dict(sorted(Counter(r[4] for r in rows).items())))
