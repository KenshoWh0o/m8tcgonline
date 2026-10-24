#!/bin/bash
# La mise à jour 2.5 de la vraie base, préparée sur un PostgreSQL 16 local.
#
#   bash tools/maj-2.5/banc.sh          puis      python3 tools/maj-2.5/envois.py
#
# Trois bases, dans /var/tmp/pg-maj (port 5510, laissé allumé pour envois.py) :
#   ref    ce que la vraie base est censée avoir au 24 octobre 2026 : TOUT.sql et
#          calendrier-2.1.4.sql du 22 octobre (21b1c79), les deux mises à jour du 23
#          (Reverses au 26, indice 3 à 127), sans ech_admin_rejouer (jamais posée) ;
#   cible  une installation neuve de la branche (TOUT.sql + calendrier-2.5.sql) ;
#   maj    ref + MAJ-2.5.sql, deux fois.
# Écrit les empreintes de chacune (_build/maj-2.5/emp-*.txt) et vérifie que maj = cible.
# Les agrégats de ref (à comparer à la vraie base avant tout envoi) s'affichent à la fin.
set -e
R="$(cd "$(dirname "$0")/../.." && pwd)"; H="$R/tools/maj-2.5"; O="$R/_build/maj-2.5"; mkdir -p "$O"
PGB=/usr/lib/postgresql/16/bin; D=/var/tmp/pg-maj; PORT=5510
su postgres -c "$PGB/pg_ctl -D $D/data stop -m fast" >/dev/null 2>&1 || true; rm -rf $D; mkdir -p $D && chown postgres $D
su postgres -c "$PGB/initdb -D $D/data -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null && $PGB/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log start >/dev/null"; sleep 2
git -C "$R" show 21b1c79:supabase/TOUT.sql > $D/ref.sql
git -C "$R" show 21b1c79:supabase/calendrier-2.1.4.sql > $D/refcal.sql
cp "$R/supabase/TOUT.sql" $D/cible.sql; cp "$R/supabase/calendrier-2.5.sql" $D/cal.sql; cp "$R/supabase/MAJ-2.5.sql" $D/maj.sql
cp "$H/stub.sql" "$H/empreintes.sql" "$H/agregat.sql" $D/; chmod 644 $D/*.sql
export PGOPTIONS="-c client_min_messages=warning"
P="psql -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1"
for b in ref cible maj; do $P -c "create database $b" && $P -d $b -f $D/stub.sql >/dev/null 2>&1; done
for b in ref cible maj; do $P -d $b -c "alter database $b set search_path = public, extensions" >/dev/null; done
for b in ref maj; do
  $P -d $b -f $D/ref.sql >/dev/null && $P -d $b -f $D/refcal.sql >/dev/null && echo "· $b : 2.1.4 du 22 octobre"
  $P -d $b -c "update public.parametres set reverses_des = timestamptz '2026-10-26 00:00:00+01' where id = 1" -c "update public.ech_indices set titre = 'Cent vingt-sept', texte = 'La collection ne s''arrête pas à 122 : elle comptera 127 cartes.', visuel = '{\"type\": \"nombre\", \"valeur\": \"127\"}'::jsonb where jour = 3" >/dev/null
done
$P -d ref -c "drop function public.ech_admin_rejouer()" >/dev/null && echo "· ref : sans ech_admin_rejouer (comme la vraie base)"
$P -d cible -f $D/cible.sql >/dev/null && $P -d cible -f $D/cal.sql >/dev/null && echo "· cible : installation neuve de la branche"
for i in 1 2; do $P -d maj --single-transaction -f $D/maj.sql >/dev/null && echo "· maj : MAJ-2.5.sql, passage $i"; done
for b in ref cible maj; do $P -d $b -tA -F '|' -f $D/empreintes.sql > "$O/emp-$b.txt"; echo "· $b : $(grep -c '^F' "$O/emp-$b.txt") fonctions, $(grep -c '^C' "$O/emp-$b.txt") colonnes, $(grep -c '^T' "$O/emp-$b.txt") tables"; done
echo "--- maj contre cible :"; diff "$O/emp-maj.txt" "$O/emp-cible.txt" && echo "identiques"
echo "--- agrégats de ref (la vraie base doit donner les mêmes avant le premier envoi : agregat.sql) :"
$P -d ref -tA -F '|' -f $D/agregat.sql
