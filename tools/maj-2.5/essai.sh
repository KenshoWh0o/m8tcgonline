#!/bin/bash
# Rejoue les trois envois (_build/maj-2.5/envoi-1.sql, -2, -3) sur des copies de la base « ref »
# du banc (le modèle de la vraie base), et vérifie qu'on obtient exactement « cible » (une
# installation neuve de la branche). Après banc.sh et envois.py :
#
#   bash tools/maj-2.5/banc.sh && python3 tools/maj-2.5/envois.py && bash tools/maj-2.5/essai.sh
#
# Deux départs :
#   e1  ref telle quelle (rien n'est passé le 24 octobre) ;
#   e2  ref + envoi-24oct.sql (le fichier préparé pour l'envoi tenté le 24 octobre au soir, au
#       cas où la confirmation serait venue après coup et l'aurait laissé passer).
# Chaque envoi se joue en une transaction, deux fois de suite (un envoi renvoyé par erreur ne
# doit rien casser). Puis les empreintes de e1 et e2 sont comparées à celles de cible, et les
# agrégats (agregat.sql) affichés : ce sont ceux que la vraie base doit donner après le
# troisième envoi.
set -e
R="$(cd "$(dirname "$0")/../.." && pwd)"; H="$R/tools/maj-2.5"; O="$R/_build/maj-2.5"
D=/var/tmp/pg-maj; PORT=5510
export PGOPTIONS="-c client_min_messages=warning"
P="psql -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1"
for f in envoi-1 envoi-2 envoi-3; do cp "$O/$f.sql" $D/; done; cp "$H/envoi-24oct.sql" $D/; chmod 644 $D/*.sql
for b in e1 e2; do $P -c "drop database if exists $b" >/dev/null; $P -c "create database $b template ref" >/dev/null; done
$P -d e2 --single-transaction -f $D/envoi-24oct.sql >/dev/null && echo "· e2 : ref + l'envoi du 24 octobre"
$P -d e2 -tA -F '|' -f $D/agregat.sql | sed 's/^/    /'
for b in e1 e2; do
  for passage in 1 2; do
    for f in envoi-1 envoi-2 envoi-3; do $P -d $b --single-transaction -f $D/$f.sql >/dev/null; done
    echo "· $b : les trois envois, passage $passage"
  done
  $P -d $b -tA -F '|' -f $D/empreintes.sql > "$O/emp-$b.txt"
  if diff -q "$O/emp-$b.txt" "$O/emp-cible.txt" >/dev/null; then echo "· $b = cible (fonctions, droits, colonnes, tables)"; else echo "ÉCART : $b n'est pas cible"; diff "$O/emp-$b.txt" "$O/emp-cible.txt" | head -20; exit 1; fi
done
echo "--- agrégats attendus de la vraie base après le troisième envoi :"
$P -d e1 -tA -F '|' -f $D/agregat.sql
