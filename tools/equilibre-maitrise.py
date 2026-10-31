#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""L'economie de la maitrise (version 3.0.12), simulee.
    python3 tools/equilibre-maitrise.py [joueurs par ligne, 300 par defaut]

Trois questions (docs/economie-3.0.md, partie 3 ter) :
  1. Combien de Fragments rapporte le recyclage, si l'on garde trois
     exemplaires de chaque carte (la limite d'un deck depuis les regles
     officielles, 3.0.12) plutot que deux (avant) ?
  2. Combien de temps pour maitriser les cartes d'un deck (celles du Starter
     Toxique), une fois la collection complete ?
  3. Combien de jours la maitrise fait-elle perdre sur les 122, a qui la
     prefere a la fabrication ?

Lu dans le depot, pour ne rien recopier : les raretes (js/cards-data.js),
le Starter Toxique (table starters, supabase/installation/23_combats.sql).
Recopies, et a garder d'accord avec leurs sources : recyclage et
fabrication (cfg, 01_schema.sql), prix des Reverses (prix_reverse,
22c_reverses.sql), bareme de la maitrise (maitrise_fragments,
maitrise_copies, 28_maitrise.sql), taux du booster (RATES, js/booster.js).

Hypotheses (le comportement reel des joueurs n'est pas mesure) :
  · un booster : 2 Communes, 1 Peu commune, 1 Essence, 1 Reverse
    (C 50 / PC 35 / R 15), 1 hit (R 79 / E 16 / L 4,25 / S 0,75) ; ni
    godpack (1 sur 2 000), ni Essence Brillante (1 sur 50, ni recyclable ni
    maitrisable) ;
  · le soir, le joueur recycle ce qui depasse ce qu'il garde : K exemplaires
    de chaque carte (K = 3 : de quoi jouer chaque carte trois fois), plus,
    pour une carte qu'il veut maitriser, les exemplaires que ses niveaux
    restants prendront ; une Essence, une Reverse ; les Secretes ne se
    recyclent pas ;
  · la maitrise ne prend que les exemplaires au-dela de K (comme
    maitriser() : au-dela de limite_copies et de ce qu'on garde) ; un
    exemplaire qui manque se paie au prix de fabrication ;
  · le joueur depense le soir : la carte la plus chere qu'il peut payer pour
    la collection, le niveau de maitrise le moins cher pour la maitrise ;
  · profils : « regulier » 6 boosters par jour ; « combattant » 8 (les
    Eclats des quetes et des combats changes en boosters) et des Fragments
    ponctuels — la campagne (2 800, etales sur 20 jours), le palier du
    niveau 25 (500, jour 20), un raid fini tous les 14 jours (600) ;
    « occasionnel » 4 boosters, 5 jours sur 7. Ni Pass d'evenement, ni
    echange, ni achat de Fragments.
Sans dependance."""
import os
import random
import re
import statistics
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = {'ES': 9, 'C': 33, 'PC': 24, 'R': 28, 'E': 18, 'L': 10, 'S': 5}
REC = {'ES': 1, 'C': 2, 'PC': 5, 'R': 20, 'E': 80, 'L': 250, 'S': 0}
FAB = {'ES': 20, 'C': 40, 'PC': 100, 'R': 400, 'E': 2000, 'L': 8000}
PRIX_REV = {'C': 400, 'PC': 500, 'R': 2400}
BASE = {'C': 60, 'PC': 100, 'R': 200, 'E': 400, 'L': 600, 'S': 600}
FOIS = [1, 2, 4, 7, 11]
COPIES = {'C': [1, 1, 1, 2, 2], 'PC': [1, 1, 1, 1, 2], 'R': [0, 1, 1, 1, 1],
          'E': [0, 0, 1, 0, 1], 'L': [0, 0, 0, 0, 1], 'S': [0, 0, 0, 0, 0]}
HIT = (('R', 79), ('E', 16), ('L', 4.25), ('S', .75))
REVERSE = (('C', 50), ('PC', 35), ('R', 15))
CLASSIQUES = ('ES', 'C', 'PC', 'R', 'E', 'L')
# Ce qu'un deck peut contenir, donc ce que la maitrise laisse (limite_copies) :
# avant la 3.0.12, 2 exemplaires (1 pour une Legendaire ou une Secrete) ;
# avec les regles officielles, 3 pour toutes.
AVANT = {'C': 2, 'PC': 2, 'R': 2, 'E': 2, 'L': 1, 'S': 1}
OFFICIEL = {'C': 3, 'PC': 3, 'R': 3, 'E': 3, 'L': 3, 'S': 3}
LIMITES = (('avant (2, 1 pour une L)', AVANT), ('officiel (3)', OFFICIEL))


def tirer(rng, t):
    x = rng.random() * sum(v for _, v in t)
    for k, v in t:
        x -= v
        if x < 0:
            return k
    return t[-1][0]


def starter(section='toxique'):
    """Les cartes maitrisables d'un Starter, en (rarete, rang dans la rarete)."""
    donnees = open(os.path.join(RACINE, 'js', 'cards-data.js'), encoding='utf-8').read()
    rar = {int(n): r for n, r in re.findall(r'num:\s*(\d+)[^}]*?rarete:\s*"(\w+)"', donnees, re.S)}
    assert len(rar) == 122 and all(sum(1 for x in rar.values() if x == r) == N[r] for r in CLASSIQUES), 'js/cards-data.js a change'
    par = {}
    for num in sorted(rar):
        par.setdefault(rar[num], []).append(num)
    sql = open(os.path.join(RACINE, 'supabase', 'installation', '23_combats.sql'), encoding='utf-8').read()
    ids = re.findall(r"\('%s', 'c(\d{3})', \d\)" % section, sql)
    return [(rar[int(i)], par[rar[int(i)]].index(int(i))) for i in ids if rar.get(int(i)) in COPIES]


CIBLES = starter()


def cout_niveau(r, n, surplus):
    """Ce que coute le niveau n+1 (n = niveau actuel) : Fragments, et exemplaires pris."""
    besoin = COPIES[r][n]
    pris = min(besoin, surplus)
    return BASE[r] * FOIS[n] + (besoin - pris) * FAB.get(r, 0), pris


def joueur(graine, profil, politique, K, depart, horizon=900, cibles=None):
    """Un joueur. La meme graine donne les memes boosters d'une politique a
    l'autre : les comparaisons sont appariees."""
    rng = random.Random(graine)
    par_jour, jours, extra = profil
    cartes = {(r, i): 0 for r in CLASSIQUES + ('S',) for i in range(N[r])}
    rev = {(r, i): 0 for r in ('C', 'PC', 'R') for i in range(N[r])}
    niveau = {c: 0 for c in (cibles or CIBLES)}
    if depart == 'complet':
        for c in cartes:
            if c[0] != 'S':
                cartes[c] = 1
        for c in rev:
            rev[c] = 1
    frag = 0
    recycle = []                    # Fragments du recyclage, jour par jour
    fin = {}
    pour_copies = 0                 # Fragments payes a la place d'exemplaires
    for d in range(horizon):
        jour_rec = 0
        for _ in range(par_jour if d % 7 < jours else 0):
            for r in ('C', 'C', 'PC', 'ES', tirer(rng, HIT)):
                cartes[(r, rng.randrange(N[r]))] += 1
            r = tirer(rng, REVERSE)
            c = (r, rng.randrange(N[r]))
            if rev[c]:
                jour_rec += REC[r]
            else:
                rev[c] = 1
        frag += extra(d)
        # Le recyclage du soir : ce qui depasse ce qu'on garde.
        for c, q in cartes.items():
            r = c[0]
            if r == 'S' or q <= 1:
                continue
            garde = 1 if r == 'ES' else K[r]
            if c in niveau:
                garde += sum(COPIES[r][niveau[c]:])
            if q > garde:
                jour_rec += (q - garde) * REC[r]
                cartes[c] = garde
        frag += jour_rec
        recycle.append(jour_rec)
        # Les depenses du soir.
        while True:
            manque_cl = [c for c, q in cartes.items() if q == 0 and c[0] != 'S']
            manque_rv = [c for c, q in rev.items() if q == 0]
            fabriquer = [(FAB[c[0]], 'cl', c) for c in manque_cl if FAB[c[0]] <= frag]
            reverses = [(PRIX_REV[c[0]], 'rv', c) for c in manque_rv if PRIX_REV[c[0]] <= frag]
            maitrise = []
            for c, n in niveau.items():
                if n < 5 and cartes[c] > 0:
                    prix, pris = cout_niveau(c[0], n, max(0, cartes[c] - K[c[0]]))
                    if prix <= frag:
                        maitrise.append((prix, 'mz', c, pris))
            if politique == 'collection':
                choix = (sorted(fabriquer, reverse=True)[:1] or (sorted(reverses, reverse=True)[:1] if not manque_cl else [])
                         or (sorted(maitrise)[:1] if not manque_cl and not manque_rv else []))
            elif politique == 'classiques':
                choix = sorted(fabriquer, reverse=True)[:1] or (sorted(maitrise)[:1] if not manque_cl else [])
            else:  # 'maitrise' : la maitrise d'abord, la collection avec ce qui reste
                choix = sorted(maitrise)[:1] or sorted(fabriquer, reverse=True)[:1]
            if not choix:
                break
            x = choix[0]
            frag -= x[0]
            if x[1] == 'cl':
                cartes[x[2]] = 1
            elif x[1] == 'rv':
                rev[x[2]] = 1
            else:
                c, pris = x[2], x[3]
                pour_copies += (COPIES[c[0]][niveau[c]] - pris) * FAB.get(c[0], 0)
                cartes[c] -= pris
                niveau[c] += 1
        if not [1 for c, q in cartes.items() if q == 0 and c[0] != 'S']:
            fin.setdefault('cl', d)
        if not [1 for q in rev.values() if q == 0]:
            fin.setdefault('rv', d)
        for k in (1, 3, 5):
            if all(n >= k for n in niveau.values()):
                fin.setdefault('mz%d' % k, d)
        if 'mz5' in fin and 'cl' in fin:
            break
    fin['copies'] = pour_copies
    fin['recycle'] = recycle
    return fin


def q(l, p):
    l = sorted(l)
    return l[int(p * (len(l) - 1))] if l else None


def mediane(l):
    return statistics.median(l) if l else None


def jours(x):
    return '—' if x is None else '%d' % x


PROFILS = {
    'regulier': (6, 7, lambda d: 0),
    'combattant': (8, 7, lambda d: (140 if d < 20 else 0) + (500 if d == 20 else 0) + (600 if d % 14 == 13 else 0)),
    'occasionnel': (4, 5, lambda d: 0),
}


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    print('Cibles : les %d cartes maitrisables du Starter Toxique (%s)' % (
        len(CIBLES), ', '.join('%d %s' % (sum(1 for c in CIBLES if c[0] == r), r) for r in ('C', 'PC', 'R', 'E', 'L') if any(c[0] == r for c in CIBLES))))
    cout = sum(BASE[r] * sum(FOIS) for r, _ in CIBLES)
    print('Les mener toutes en Legende : %d Fragments, et %d exemplaires en trop (ou leur prix de fabrication)\n' % (
        cout, sum(sum(COPIES[r]) for r, _ in CIBLES)))

    print('1. Le recyclage, Fragments par semaine (mediane), un joueur parti de zero, sans maitrise :')
    for nom in ('regulier', 'occasionnel'):
        for lib, K in LIMITES:
            res = [joueur(1000 + i, PROFILS[nom], 'classiques', K, 'nouveau', horizon=120)['recycle'] for i in range(n // 3)]
            sem = ['%5d' % mediane([sum(r[w * 7 - 7:w * 7]) for r in res]) for w in (2, 4, 8, 12, 16)]
            print('   %-11s %-24s semaines 2, 4, 8, 12, 16 : %s' % (nom, lib, ' '.join(sem)))

    print('\n2. Maitriser les cartes du Starter, une fois la collection complete (122 et 85 Reverses) :')
    print('   jours apres la collection complete, mediane (quart le plus lent) ; la collection d\'abord')
    for nom in ('regulier', 'combattant', 'occasionnel'):
        for lib, K in LIMITES:
            res = [joueur(2000 + i, PROFILS[nom], 'collection', K, 'nouveau', horizon=1400) for i in range(n)]
            ligne = []
            for k in (1, 3, 5):
                l = [r['mz%d' % k] - max(r['cl'], r['rv']) for r in res if 'mz%d' % k in r and 'cl' in r and 'rv' in r]
                ligne.append('tout %s : %s (%s)' % ({1: 'I', 3: 'III', 5: 'V'}[k], jours(mediane(l)), jours(q(l, .75))))
            fini = [max(r['cl'], r['rv']) for r in res if 'cl' in r and 'rv' in r]
            print('   %-11s %-24s collection complete jour %s · %s ; payes a la place d\'exemplaires : %d Fragments' % (
                nom, lib, jours(mediane(fini)), ' · '.join(ligne), mediane([r['copies'] for r in res])))

    print('\n3. Un joueur parti de zero : le jour des 122 classiques, selon ce qu\'il fait de ses Fragments (regles officielles) :')
    for nom in ('regulier', 'combattant'):
        res = {pol: [joueur(3000 + i, PROFILS[nom], pol, OFFICIEL, 'nouveau') for i in range(n)] for pol in ('collection', 'classiques', 'maitrise')}
        deux = [joueur(3000 + i, PROFILS[nom], 'collection', AVANT, 'nouveau') for i in range(n)]
        ecart = [b['cl'] - a['cl'] for a, b in zip(deux, res['collection']) if 'cl' in a and 'cl' in b]
        print('   %-11s garder 3 exemplaires plutot que 2 (1 pour une L) : les 122 %s jours plus tard (mediane ; quart le plus touche : %s)' % (
            nom, jours(mediane(ecart)), jours(q(ecart, .75))))
        for pol, l in res.items():
            cl = [r['cl'] for r in l if 'cl' in r]
            rv = [r['rv'] for r in l if 'rv' in r]
            mz = [r['mz5'] for r in l if 'mz5' in r]
            print('   %-11s %-11s 122 : jour %s (%s) · 85 Reverses : jour %s · Starter en Legende : jour %s' % (
                nom, pol, jours(mediane(cl)), jours(q(cl, .75)), jours(mediane(rv)), jours(mediane(mz))))
        # Le retard sur les 122, joueur par joueur (meme graine, meme chance).
        retard = [b['cl'] - a['cl'] for a, b in zip(res['collection'], res['maitrise']) if 'cl' in a and 'cl' in b]
        print('   %-11s la maitrise d\'abord retarde les 122 de %s jours (mediane ; quart le plus touche : %s)' % (
            nom, jours(mediane(retard)), jours(q(retard, .75))))

    print('\n4. Une seule carte rare en Legende, une fois la collection complete (regulier, la collection d\'abord) :')
    for r in ('E', 'L'):
        for lib, K in LIMITES:
            res = [joueur(4000 + i, PROFILS['regulier'], 'collection', K, 'nouveau', horizon=1400, cibles=[(r, 0)]) for i in range(n)]
            l = [x['mz5'] - max(x['cl'], x['rv']) for x in res if 'mz5' in x and 'cl' in x and 'rv' in x]
            payants = sum(1 for x in res if x['copies'] > 0)
            print('   %s %-24s : %s jours apres la collection (quart le plus lent %s) ; %d %% paient un exemplaire en Fragments (mediane %d)' % (
                {'E': 'Epique    ', 'L': 'Legendaire'}[r], lib, jours(mediane(l)), jours(q(l, .75)), round(100 * payants / len(res)),
                mediane([x['copies'] for x in res])))


if __name__ == '__main__':
    main()
