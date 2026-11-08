#!/usr/bin/env bash
# Joue le SQL du serveur sur un PostgreSQL 16 local, comme Supabase le ferait :
# la base de production (supabase/TOUT.sql de origin/main, version 2.1), puis
# le TOUT.sql de la branche deux fois (il doit etre rejouable), puis, si on
# en donne, des fichiers de test.
#
#     tools/tester-sql.sh [test1.sql test2.sql …]
#
# Le serveur PostgreSQL tourne dans /var/tmp/pg-m8 (port 5499) ; il est cree
# au premier lancement et laisse allume. Pour l'arreter :
#     su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg-m8/data stop"
# Chaque lancement repart d'une base « m8 » neuve.
set -euo pipefail
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
D=/var/tmp/pg-m8
if [ ! -d "$D/data" ]; then
  mkdir -p "$D" && chown postgres "$D"
  su postgres -c "$PGBIN/initdb -D $D/data -A trust -E UTF8 --locale=C.UTF-8" > /dev/null
fi
if ! su postgres -c "$PGBIN/pg_ctl -D $D/data status" > /dev/null 2>&1; then
  su postgres -c "$PGBIN/pg_ctl -D $D/data -o '-p 5499 -k $D' -l $D/log start" > /dev/null
  sleep 1
fi
export PGOPTIONS="-c client_min_messages=warning"
P="psql -q -h $D -p 5499 -U postgres -v ON_ERROR_STOP=1"
$P -c "drop database if exists m8" -c "create database m8"
$P -d m8 -f "$RACINE/tools/sql-stub.sql" > /dev/null
if git -C "$RACINE" cat-file -e origin/main:supabase/TOUT.sql 2> /dev/null; then
  git -C "$RACINE" show origin/main:supabase/TOUT.sql > "$D/tout-prod.sql"
  $P -d m8 -f "$D/tout-prod.sql" > /dev/null && echo "· production (origin/main) installée"
fi
for i in 1 2; do $P -d m8 -f "$RACINE/supabase/TOUT.sql" > /dev/null && echo "· TOUT.sql de la branche, passage $i : ok"; done
for t in "$@"; do echo "· $t"; $P -d m8 -f "$t"; done
