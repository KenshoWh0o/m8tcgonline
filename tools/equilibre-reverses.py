#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le prix de fabrication des Reverses (version 2.1.4), simule.
    python3 tools/equilibre-reverses.py [joueurs par ligne, 600 par defaut]

La fabrication des classiques fait gagner ~33 % sur la mediane du temps pour
finir l'extension, et ~41 % sur le quart le plus lent (cfg() de
supabase/01_schema.sql, en-tete de supabase/12_recyclage.sql). Ce script
cherche la grille de prix des Reverses qui donne le meme effet sur les 85
Reverses. Resultat et raisonnement : en-tete de supabase/22c_reverses.sql.

Hypotheses : joueur present depuis l'ouverture (24 septembre, jour 0) ;
Reverses en booster depuis la 2.0 (jour 16 ici, ~9-10 octobre) ; recyclage et
fabrication des Reverses ouverts le 24 octobre (jour 30) ; doublons recycles
chaque soir (on garde un exemplaire) ; achats le soir, la carte la plus chere
qu'on peut payer, et les Reverses seulement une fois les 122 completes
(« prudent ») ou des que possible (« presse »). Pas d'echange, pas de booster
achete ou offert, pas de godpack, pas de Reverse du Pass. Sans dependance."""
import random, statistics, sys

N = {'ES': 9, 'C': 33, 'PC': 24, 'R': 28, 'E': 18, 'L': 10}          # cartes par rarete
REC = {'ES': 1, 'C': 2, 'PC': 5, 'R': 20, 'E': 80, 'L': 250}          # cfg('recyclage_*')
FAB = {'ES': 20, 'C': 40, 'PC': 100, 'R': 400, 'E': 2000, 'L': 8000}  # cfg('fabrication_*')
RN = {'C': 33, 'PC': 24, 'R': 28}                                     # les 85 Reverses
HIT = {'R': 80, 'E': 16, 'L': 4}                                      # RATES.HIT
REV = {'C': 50, 'PC': 35, 'R': 15}                                    # RATES.REVERSE
V20, OUV = 16, 30                                                     # 2.0, ouverture


def tirer(t):
    x = random.random() * sum(t.values())
    for k, v in t.items():
        x -= v
        if x < 0:
            return k
    return k


def partie(par_jour, jours_semaine, prix, politique, horizon=700):
    """Le jour ou le joueur a les 122 classiques, et celui ou il a les 85 Reverses."""
    cl = {r: set(range(n)) for r, n in N.items()}   # ce qui manque
    rv = {r: set(range(n)) for r, n in RN.items()}
    frag = attente = 0
    fin = {}
    for d in range(horizon):
        for _ in range(par_jour if d % 7 < jours_semaine else 0):
            mixte = 'PC' if d >= V20 else tirer({'C': 60, 'PC': 40})   # avant la 2.0
            for r in ('C', 'C', mixte, 'PC', 'ES', tirer(HIT)):
                i = random.randrange(N[r])
                if i in cl[r]:
                    cl[r].discard(i)
                else:
                    frag += REC[r]
            if d >= V20:
                r = tirer(REV)
                i = random.randrange(RN[r])
                if i in rv[r]:
                    rv[r].discard(i)
                elif d >= OUV:
                    frag += REC[r]
                else:
                    attente += REC[r]          # recyclees le jour de l'ouverture
        if d == OUV:
            frag += attente
        while True:
            choix = [(FAB[r], cl, r) for r in N if cl[r] and FAB[r] <= frag]
            if d >= OUV and (politique == 'presse' or not any(cl.values())):
                choix += [(prix[r], rv, r) for r in RN if rv[r] and prix[r] <= frag]
            if not choix:
                break
            cout, lot, r = max(choix, key=lambda x: x[0])
            frag -= cout
            lot[r].pop()
        if not any(cl.values()):
            fin.setdefault('cl', d)
        if not any(rv.values()):
            fin.setdefault('rv', d)
        if len(fin) == 2:
            break
    return fin


def quantile(l, p):
    l = sorted(l)
    return l[int(p * (len(l) - 1))]


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 600
    random.seed(7)
    grilles = [None, (80, 200, 800), (400, 400, 2000), (400, 500, 2400), (500, 500, 3000),
               (1000, 1000, 4800)]
    for nom, pj, js in (('regulier, 6 par jour', 6, 7), ('occasionnel, 4 par jour, 5 jours sur 7', 4, 5)):
        print('==', nom)
        base = None
        for g in grilles:
            prix = dict(zip(('C', 'PC', 'R'), g)) if g else {'C': 10**9, 'PC': 10**9, 'R': 10**9}
            res = [partie(pj, js, prix, 'prudent') for _ in range(n)]
            rv = [r['rv'] for r in res if 'rv' in r]
            ecart = [r['rv'] - r['cl'] for r in res if len(r) == 2]
            m, q = statistics.median(rv), quantile(rv, .75)
            if base is None:
                base = (m, q)
                print('  sans fabrication        85 Reverses : mediane jour %d, quart le plus lent jour %d' % (m, q))
                continue
            presse = [partie(pj, js, prix, 'presse') for _ in range(n // 3)]
            print('  %-22s  jour %d (%d) · gain %+.0f %% / %+.0f %% · %d j apres les 122 · 122 : jour %d, si presse jour %d'
                  % ('%d / %d / %d' % g, m, q, -100 * (1 - (m - OUV) / (base[0] - OUV)),
                     -100 * (1 - (q - OUV) / (base[1] - OUV)), statistics.median(ecart),
                     statistics.median([r['cl'] for r in res if 'cl' in r]),
                     statistics.median([r['cl'] for r in presse if 'cl' in r])))


if __name__ == '__main__':
    main()
