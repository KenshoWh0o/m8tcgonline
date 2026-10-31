#!/usr/bin/env bash
# La maintenance (3.0.12) : une base 2.5 de production avec deux joueurs
# reçoit la 3.0, trois fois. À lancer après tools/tester-sql.sh (qui démarre
# le PostgreSQL local) : bash tools/tests-sql/maintenance.sh
set -euo pipefail
V="$(cd "$(dirname "$0")/../.." && pwd)"
D=/var/tmp/pg-m8
export PGOPTIONS="-c client_min_messages=warning"
P="psql -q -h $D -p 5499 -U postgres -v ON_ERROR_STOP=1"
$P -c "drop database if exists m8mig" -c "create database m8mig"
$P -d m8mig -f "$V/tools/sql-stub.sql" > /dev/null
git -C "$V" show origin/main:supabase/TOUT.sql > "$D/tout-prod.sql"
$P -d m8mig -f "$D/tout-prod.sql" > /dev/null && echo "· production 2.5 installée"
$P -d m8mig -c "insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'm1@t', '{\"full_name\": \"Maint Un\"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'm2@t', '{\"full_name\": \"Maint Admin\"}');
  insert into public.beta_invites (cle) values ('m1@t'), ('m2@t') on conflict do nothing;
  update public.profiles set pseudo = 'maint_un' where id = '00000000-0000-0000-0000-0000000000b1';
  update public.profiles set pseudo = 'maint_admin', is_admin = true where id = '00000000-0000-0000-0000-0000000000b2';" > /dev/null
echo "· deux joueurs sur la 2.5 (un administrateur)"
$P -d m8mig -f "$V/supabase/TOUT.sql" > /dev/null && echo "· 3.0, passage 1"
$P -d m8mig -At -c "select 'après passage 1 : actif=' || actif || ' message=' || coalesce(message, '-') || ' par=' || coalesce(par, '-') from public.maintenance"
$P -d m8mig -f "$V/supabase/TOUT.sql" > /dev/null && echo "· 3.0, passage 2"
$P -d m8mig -At -c "select 'après passage 2 : actif=' || actif from public.maintenance"
$P -d m8mig -f "$(dirname "$0")/maintenance.sql"
$P -d m8mig -f "$V/supabase/TOUT.sql" > /dev/null && echo "· 3.0, passage 3 (après la levée)"
$P -d m8mig -At -c "select 'après passage 3 : actif=' || actif || ' (doit rester false)' from public.maintenance"
