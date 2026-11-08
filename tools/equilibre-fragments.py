#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Combien de Fragments gagne un joueur regulier, et a quelle frequence sort
une carte precise : les chiffres qui fondent le bareme de la maitrise
(docs/economie-3.0.md, partie 3 ter ; supabase/installation/28_maitrise.sql).

    python3 tools/equilibre-fragments.py [joueurs] [jours]

Modele : 6 boosters par jour (la reserve), composition de open_pack
(C, C, PC, Essence, Reverse, hit R 79 % / E 16 % / L 4,25 % / S 0,75 %),
les doublons recycles chaque jour au-dela de 2 exemplaires (1 pour une
Legendaire ; 1 pour une Essence), aux valeurs de cfg('recyclage_...'). Les
Reverses ne se recyclent pas (fabrication_reverse fermee). Aucune quete,
aucun Pass : seulement le recyclage. Sans dependance."""
import random
import statistics as st
import sys

N = {'ES': 9, 'C': 33, 'PC': 24, 'R': 28, 'E': 18, 'L': 10, 'S': 5}
RECYCLAGE = {'ES': 1, 'C': 2, 'PC': 5, 'R': 20, 'E': 80, 'L': 250, 'S': 0}
GARDE = {'ES': 1, 'C': 2, 'PC': 2, 'R': 2, 'E': 2, 'L': 1, 'S': 1}


def booster(rng):
    cartes = [('C', rng.randrange(33)), ('C', rng.randrange(33)), ('PC', rng.randrange(24)), ('ES', rng.randrange(9))]
    x = rng.random()
    hit = 'R' if x < .79 else 'E' if x < .95 else 'L' if x < .9925 else 'S'
    cartes.append((hit, rng.randrange(N[hit])))
    return cartes  # la Reverse (5e carte) est omise : elle ne se recycle pas


def joueur(jours, par_jour, graine):
    rng = random.Random(graine)
    col, frag, histo = {}, 0, []
    for _ in range(jours):
        for _ in range(par_jour):
            for c in booster(rng):
                col[c] = col.get(c, 0) + 1
        for c, q in col.items():
            garde = GARDE[c[0]]
            if q > garde:
                frag += (q - garde) * RECYCLAGE[c[0]]
                col[c] = garde
        histo.append(frag)
    return histo


if __name__ == '__main__':
    joueurs = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    jours = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    H = [joueur(jours, 6, g) for g in range(joueurs)]
    print(f'{joueurs} joueurs, 6 boosters par jour, mediane :')
    for d in (14, 30, 60, 90, 120):
        if d <= jours:
            par_semaine = st.median(h[d - 1] - h[d - 8] for h in H)
            print(f'  jour {d:3d} : {st.median(h[d - 1] for h in H):7.0f} Fragments cumules, {par_semaine:5.0f} par semaine')
    print('Une carte precise sort :')
    for k, p in (('C', 2 / 33), ('PC', 1 / 24), ('R', .79 / 28), ('E', .16 / 18), ('L', .0425 / 10), ('S', .0075 / 5)):
        print(f'  {k:2s} : tous les {1 / p:4.0f} boosters ({1 / p / 6:5.1f} jours)')
