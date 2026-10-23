#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble les fichiers SQL d'installation en un seul, a coller d'un bloc dans Supabase.
    python3 tools/build-sql.py

Seuls les fichiers d'installation entrent dans TOUT.sql : 05_admin.sql et
08_reset-profil.sql sont des outils ponctuels, a jouer a la main quand on en
a besoin.

A relancer apres toute modification des fichiers assembles — et notamment apres
`python3 supabase/gen-cards-sql.py`, quand des cartes ont bouge."""
import os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = os.path.join(ROOT, 'supabase')

# L'ordre compte : 03b_promos.sql cree les cartes Promo, et 04_seed.sql en
# vend deux en boutique — il ne peut pas les referencer avant qu'elles existent.
MORCEAUX = [
    ('01_schema.sql',  'Les tables, les regles de securite, la recharge des boosters'),
    ('02_cards.sql',   'Le catalogue des cartes (le serveur en a besoin pour tirer)'),
    ('03_rpc.sql',     'Les actions du jeu : ouvrir, echanger, encaisser, acheter'),
    ('03b_promos.sql', 'Les cartes Promo et leurs paliers de collection'),
    ('04_seed.sql',    'Les quetes et le catalogue de la boutique'),
    ('06_social.sql',  'Les amis et les fiches de joueur'),
    ('07_vitrine.sql', 'La vitrine : quatre cartes mises en avant sur le profil'),
    ('11_boite.sql',   'La boite de reception : notifications et annonces'),
    ('12_recyclage.sql', 'Le recyclage des doublons contre des Fragments, et la fabrication'),
    ('14_classement.sql', 'Le classement global des joueurs'),
    ('15_evenements.sql', 'Tirages, succes, evenements et chasse a la carte unique'),
    ('18_cadeaux.sql', 'Les cadeaux offerts par un administrateur'),
    ('21_reflets.sql', 'Version 2.0 : evenement Reflets, Devine l\'illu, invitations, titres'),
    ('21b_illu.sql',   'Devine l\'illu : les illustrations en pixels'),
    ('22_garder.sql',  'Version 2.1 : les exemplaires a garder, et les favoris'),
    ('22b_echauffement.sql', 'Version 2.5 : L\'Echauffement, sept defis avant la suite'),
    ('22c_reverses.sql', 'Version 2.5 : les Reverses se recyclent et se fabriquent'),
    ('22d_admin.sql',  'Version 2.5 : le Labo (comptes et serveur), la date de sortie'),
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

# La mise a jour de la 2.5 (appelee 2.1.4 jusqu'au 23 octobre 2026), d'un
# bloc, pour une base deja installee en 2.1.0 ou plus, dans l'ordre de
# TOUT.sql :
#   · la 2.1.1, que la vraie base n'avait pas recue (elle etait en 2.1.0 le
#     22 octobre) : est_filleul, shop_buy et creer_invitation (03_rpc.sql,
#     21_reflets.sql) ;
#   · les Reverses : me, recycler, fabriquer (07_vitrine.sql, 12_recyclage.sql)
#     et 22c_reverses.sql ;
#   · L'Echauffement (22b_echauffement.sql) ;
#   · le Labo de la 2.5 et la date de sortie (22d_admin.sql), puis le
#     calendrier.
# Les fichiers sont rejoues entiers : ils ne contiennent rien qu'une version
# plus recente redefinirait ailleurs, et leurs donnees sont des mises a jour
# idempotentes (verifie : le Pass de Reflets de la vraie base est celui du
# fichier ; le remboursement des codes de filleuls n'y trouve rien).
# La vraie base en a recu la premiere partie le 22 octobre 2026 (tout sauf
# ech_admin_rejouer, 22d_admin.sql et la date de sortie dans me() : voir le
# README, « Version 2.5 », Mise en ligne).
MAJ_25 = ['03_rpc.sql', '07_vitrine.sql', '12_recyclage.sql', '21_reflets.sql',
          '22b_echauffement.sql', '22c_reverses.sql', '22d_admin.sql', 'calendrier-2.5.sql']
maj = os.path.join(SB, 'MAJ-2.5.sql')
open(maj, 'w', encoding='utf-8').write(
    "-- Mate TCG Online — mise a jour 2.5, assemblee par tools/build-sql.py le %s.\n"
    "-- A coller d'un bloc dans Supabase > SQL Editor ; rejouable sans danger.\n"
    "-- Ne pas editer : editer %s.\n\n" % (datetime.date.today().isoformat(), ', '.join(MAJ_25))
    + '\n\n'.join(open(os.path.join(SB, f), encoding='utf-8').read() for f in MAJ_25))
print('supabase/MAJ-2.5.sql assemble.')

n = sum(1 for _ in open(sortie, encoding='utf-8'))
print('supabase/TOUT.sql assemble : %d lignes, %.0f Ko' % (n, os.path.getsize(sortie) / 1024))
print('A coller d\'un bloc dans Supabase > SQL Editor.')
