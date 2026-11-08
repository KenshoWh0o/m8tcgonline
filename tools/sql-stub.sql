-- Imitation minimale de Supabase, pour jouer supabase/TOUT.sql sur un
-- PostgreSQL nu (tools/tester-sql.sh). Ce n'est pas du SQL de production.
-- Les roles valent pour tout le serveur : on ne les cree qu'une fois.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
-- auth.uid() lit l'identifiant que l'on pose a la main :
--   select set_config('request.jwt.claim.sub', '<uuid>', false);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
