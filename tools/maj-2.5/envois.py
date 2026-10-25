#!/usr/bin/env python3
# Les trois envois de la mise à jour 2.5 sur la vraie base (après le 24 octobre 2026),
# pour l'outil Supabase (execute_sql), après tools/maj-2.5/banc.sh (base locale « cible »).
#
#   python3 tools/maj-2.5/envois.py     ->  _build/maj-2.5/envoi-1.sql, -2, -3
#
# - Chaque fonction n'est envoyée qu'une fois, dans sa version finale (celle du dernier fichier
#   qui la définit) : la vraie base ne passe jamais par une version intermédiaire (me() de
#   03_rpc.sql, evenement_recap de 21_reflets.sql…).
# - L'ordre garde le site debout : me() en dernier, après la colonne parametres.sorties.
# - Chaque envoi finit par un contrôle des empreintes (pg_get_functiondef, droits) de ses
#   fonctions, comparées à une installation neuve (base locale « cible ») : au moindre écart,
#   tout l'envoi est annulé.
import re, subprocess, os
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = os.path.join(RACINE, 'supabase') + '/'
M = os.path.join(RACINE, '_build', 'maj-2.5') + '/'
os.makedirs(M, exist_ok=True)
ORDRE = ['03_rpc.sql', '04_seed.sql', '12_recyclage.sql', '21_reflets.sql', '22b_echauffement.sql', '22c_reverses.sql',
         '22d_admin.sql', '22e_echauffement-evenement.sql', '22f_sans-fin.sql', '07_vitrine.sql', 'calendrier-2.5.sql']
ENVOIS = [['03_rpc.sql', '04_seed.sql', '12_recyclage.sql'],
          ['21_reflets.sql', '22b_echauffement.sql', '22c_reverses.sql'],
          ['22d_admin.sql', '22e_echauffement-evenement.sql', '22f_sans-fin.sql', '07_vitrine.sql', 'calendrier-2.5.sql']]
DEF = re.compile(r'create or replace function public\.([a-z_0-9]+)\(')

def morceaux(texte):
    """Découpe un fichier en [('fn', nom, texte) | ('sql', None, texte)]."""
    out, i = [], 0
    for m in DEF.finditer(texte):
        if m.start() < i: continue
        a = m.start()
        o = texte.index('$$', a)
        f = texte.index('$$', o + 2)
        fin = texte.index(';', f) + 1
        out.append(('sql', None, texte[i:a]))
        out.append(('fn', m.group(1), texte[a:fin]))
        i = fin
    out.append(('sql', None, texte[i:]))
    return out

fichiers = {f: morceaux(open(R + f, encoding='utf-8').read()) for f in ORDRE}
dernier = {}
for f in ORDRE:
    for k, nom, _ in fichiers[f]:
        if k == 'fn': dernier[nom] = f

# Les empreintes attendues : celles d'une installation neuve (base « cible » du banc).
PSQL = ['psql', '-q', '-h', '/var/tmp/pg-maj', '-p', '5510', '-U', 'postgres', '-d', 'cible', '-tA', '-F', '|', '-c']
req = ("select p.proname, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(pg_get_functiondef(p.oid)), "
       "has_function_privilege('anon', p.oid, 'execute')::text || '/' || has_function_privilege('authenticated', p.oid, 'execute')::text "
       "from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')")
attendu = {}
for l in subprocess.run(PSQL + [req], capture_output=True, text=True, check=True).stdout.strip().split('\n'):
    nom, sig, h, d = l.split('|')
    attendu.setdefault(nom, []).append((sig, h, d))

# Le contenu de l'événement (pas seulement le nombre de lignes) : le Pass, ses quêtes, sa boutique,
# tels qu'une installation neuve les a. Une empreinte par table, sur les lignes entières.
def contenu(table, cle):
    q = (f"select md5(coalesce(string_agg(row_to_json(t)::text, ';' order by t.{cle}), '')) "
         f"from public.{table} t where t.evenement = 'echauffement'")
    return subprocess.run(PSQL + [q], capture_output=True, text=True, check=True).stdout.strip()
def verif_contenu(table, cle, quoi):
    return (f"  if (select md5(coalesce(string_agg(row_to_json(t)::text, ';' order by t.{cle}), '')) from public.{table} t "
            f"where t.evenement = 'echauffement') <> '{contenu(table, cle)}' then\n"
            f"    raise exception 'ECART : contenu de {quoi}'; end if;")

CONTROLE = """
-- Controle : chaque fonction de cet envoi doit avoir exactement l'empreinte et
-- les droits d'une installation neuve de la 2.5. Au moindre ecart, tout
-- l'envoi est annule.
do $verif$
declare r record; n int := 0;
begin
  for r in select a.nom, a.h, a.droits,
                  (select md5(pg_get_functiondef(p.oid)) from pg_proc p
                    where p.pronamespace = 'public'::regnamespace
                      and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = a.nom) as h_reel,
                  (select has_function_privilege('anon', p.oid, 'execute')::text || '/' || has_function_privilege('authenticated', p.oid, 'execute')::text
                     from pg_proc p where p.pronamespace = 'public'::regnamespace
                      and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = a.nom) as d_reel
             from (values
@@LIGNES@@) as a(nom, h, droits) loop
    if r.h_reel is distinct from r.h or r.d_reel is distinct from r.droits then
      raise exception 'ECART sur % : empreinte % (attendue %), droits % (attendus %)', r.nom, r.h_reel, r.h, r.d_reel, r.droits;
    end if;
    n := n + 1;
  end loop;
@@EXTRAS@@
  raise notice 'controle ok : % fonctions', n;
end $verif$;
"""
EXTRAS = {
    0: """  if (select count(*) from public.quests where evenement = 'echauffement') <> 13 or not exists (select 1 from public.quests where id = 'm_sf10')
     or (select count(*) from public.shop_items where evenement = 'echauffement') <> 4 then
    raise exception 'ECART : quetes ou boutique de L''Echauffement'; end if;
""" + verif_contenu('quests', 'id', 'ses quetes') + '\n' + verif_contenu('shop_items', 'id', 'sa boutique'),
    1: """  if exists (select 1 from pg_proc where proname = 'ech_simuler' and pronargs = 2 and pronamespace = 'public'::regnamespace) then
    raise exception 'ECART : l''ancien ech_simuler est encore la'; end if;""",
    2: """  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'parametres' and column_name = 'sorties') then
    raise exception 'ECART : parametres.sorties manque'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.labo_sauvegardes'::regclass)
     or has_table_privilege('authenticated', 'public.labo_sauvegardes', 'select') or has_table_privilege('anon', 'public.labo_sauvegardes', 'select') then
    raise exception 'ECART : labo_sauvegardes mal protegee'; end if;
  if (select count(*) from public.ech_sf_adversaires) <> 21 or has_table_privilege('authenticated', 'public.ech_sf_scores', 'select')
     or not (select relrowsecurity from pg_class where oid = 'public.ech_sf_essais'::regclass) then
    raise exception 'ECART : tables du mode sans fin'; end if;
  if (select count(*) from public.evt_piste where evenement = 'echauffement') <> 20 then raise exception 'ECART : Pass'; end if;
""" + verif_contenu('evt_piste', 'palier', 'son Pass') + """
  if not exists (select 1 from pg_trigger where tgname = 'ech_saison_evenement') then raise exception 'ECART : declencheur'; end if;
  -- Le calendrier officiel, et la ligne de l'evenement qui suit la saison.
  if (select sorties ->> '2.5' from public.parametres where id = 1)::timestamptz <> timestamptz '2026-10-26 00:00:00+01'
     or (select reverses_des from public.parametres where id = 1) <> timestamptz '2026-10-26 00:00:00+01'
     or (select debut from public.ech_saison where id = 1) <> timestamptz '2026-10-26 00:00:00+01'
     or (select fin from public.ech_saison where id = 1) <> timestamptz '2026-11-04 00:00:00+01'
     or (select fin from public.evenements where code = 'reflets') <> timestamptz '2026-10-24 00:00:00+02'
     or (select recap_jusqua from public.evenements where code = 'reflets') <> timestamptz '2026-10-26 00:00:00+01'
     or (select count(*) from public.evenements where code = 'echauffement') <> 1
     or (select debut from public.evenements where code = 'echauffement') <> timestamptz '2026-10-26 00:00:00+01'
     or (select fin from public.evenements where code = 'echauffement') <> timestamptz '2026-11-04 00:00:00+01'
     or (select recap_jusqua from public.evenements where code = 'echauffement') <> timestamptz '2026-11-07 00:00:00+01' then
    raise exception 'ECART : calendrier'; end if;"""
}
for k, groupe in enumerate(ENVOIS):
    corps, noms = [], []
    for f in groupe:
        corps.append(f'\n-- ======================================== {f}\n')
        for t, nom, texte in fichiers[f]:
            if t == 'fn' and dernier[nom] != f:
                corps.append(f'-- ({nom} : sa version finale est dans {dernier[nom]})\n')
                continue
            if t == 'fn' and nom not in noms: noms.append(nom)
            corps.append(texte)
    lignes = []
    for nom in noms:
        for sig, h, d in attendu[nom]:
            lignes.append("    ('%s', '%s', '%s')" % (sig.replace("'", "''"), h, d))
    sortie = (f"-- Envoi {k + 1} sur 3 de la mise a jour 2.5 (apres le 24 octobre 2026) : {', '.join(groupe)}.\n"
              "-- Fabrique par tools/maj-2.5/envois.py : chaque fonction dans sa version finale ; controle a la fin.\n"
              + ''.join(corps) + CONTROLE.replace('@@LIGNES@@', ',\n'.join(lignes)).replace('@@EXTRAS@@', EXTRAS[k]))
    open(M + f'envoi-{k + 1}.sql', 'w', encoding='utf-8').write(sortie)
    print(f'_build/maj-2.5/envoi-{k + 1}.sql : {len(sortie) // 1024} Ko, {len(noms)} fonctions ({len(lignes)} signatures)')
