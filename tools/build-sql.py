#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble les quatre fichiers SQL en un seul, a coller d'un bloc dans Supabase.
    python3 tools/build-sql.py

A relancer apres toute modification de supabase/0*.sql — et notamment apres
`python3 supabase/gen-cards-sql.py`, quand des cartes ont bouge."""
import os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = os.path.join(ROOT, 'supabase')

MORCEAUX = [
    ('01_schema.sql', 'Les tables, les regles de securite, la recharge des boosters'),
    ('02_cards.sql',  'Le catalogue des cartes (le serveur en a besoin pour tirer)'),
    ('03_rpc.sql',    'Les actions du jeu : ouvrir, echanger, encaisser, acheter'),
    ('04_seed.sql',   'Les quetes et le catalogue de la boutique'),
    ('06_social.sql', 'Les amis et les fiches de joueur'),
    ('07_vitrine.sql', 'La vitrine : quatre cartes mises en avant sur le profil'),
]

entete = """-- =====================================================================
--
--   MATE TCG ONLINE — INSTALLATION COMPLETE
--
--   Tout colle, tout d'un bloc, dans Supabase > SQL Editor > New query,
--   puis « Run ». Il n'y a rien a modifier la-dedans.
--
--   Ce fichier est assemble automatiquement a partir des quatre fichiers
--   du dossier supabase/. Ne pas l'editer a la main : editer les fichiers
--   d'origine, puis relancer `python3 tools/build-sql.py`.
--
--   Rejouable sans danger : chaque ligne est mise a jour si elle existe.
--
--   Assemble le %s
--
-- =====================================================================

""" % datetime.date.today().isoformat()

bloc = []
for nom, quoi in MORCEAUX:
    chemin = os.path.join(SB, nom)
    texte = open(chemin, encoding='utf-8').read()
    bloc.append(
        "\n\n-- #####################################################################\n"
        "-- ###  %s\n"
        "-- ###  %s\n"
        "-- #####################################################################\n\n%s"
        % (nom, quoi, texte))

fin = """

-- =====================================================================
--   C'est installe.
--
--   Pour verifier, ouvre la page verif.html du site : elle controle tout
--   et dit en clair ce qui manque encore.
--
--   Il reste deux choses a faire, qui ne se font pas en SQL :
--     - les adresses de retour  (Authentication > URL Configuration)
--     - la connexion Discord    (Authentication > Providers > Discord)
--   Tout est explique dans SETUP.md.
--
--   Et quand ton compte sera cree, pense a supabase/05_admin.sql pour
--   te donner les droits d'administrateur.
-- =====================================================================
"""

sortie = os.path.join(SB, 'TOUT.sql')
open(sortie, 'w', encoding='utf-8').write(entete + ''.join(bloc) + fin)

n = sum(1 for _ in open(sortie, encoding='utf-8'))
print('supabase/TOUT.sql assemble : %d lignes, %.0f Ko' % (n, os.path.getsize(sortie) / 1024))
print('A coller d\'un bloc dans Supabase > SQL Editor.')
