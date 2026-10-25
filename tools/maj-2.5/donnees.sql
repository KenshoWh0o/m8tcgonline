-- Le contenu des tables de catalogue touchées par la mise à jour 2.5, et les règles
-- d'accès (lecture seule). En jsonb : l'ordre des colonnes, qui diffère entre la
-- vraie base et une installation neuve, ne compte pas. À comparer avec la base
-- « cible » du banc (bash tools/maj-2.5/banc.sh) :
--   psql -h /var/tmp/pg-maj -p 5510 -U postgres -d cible -f tools/maj-2.5/donnees.sql
select 'quests' t, count(*)::text n, md5(string_agg(to_jsonb(x)::text, ';' order by x.id)) e from public.quests x
union all select 'shop_items', count(*)::text, md5(string_agg(to_jsonb(x)::text, ';' order by x.id)) from public.shop_items x
union all select 'evt_piste', count(*)::text, md5(string_agg(to_jsonb(x)::text, ';' order by x.evenement, x.palier)) from public.evt_piste x
union all select 'ech_defis', count(*)::text, md5(string_agg(to_jsonb(x)::text, ';' order by x.jour)) from public.ech_defis x
union all select 'ech_indices', count(*)::text, md5(string_agg(to_jsonb(x)::text, ';' order by x.jour)) from public.ech_indices x
union all select 'ech_sf_adversaires', count(*)::text, md5(string_agg(to_jsonb(x)::text, ';' order by x.ordre)) from public.ech_sf_adversaires x
union all select 'calendrier', '1', md5(concat_ws('|', (select sorties::text from public.parametres where id = 1), (select reverses_des::text from public.parametres where id = 1),
  (select fabrication_reverse::text from public.parametres where id = 1), (select debut::text || fin::text from public.ech_saison where id = 1),
  (select string_agg(code || debut::text || fin::text || coalesce(recap_jusqua::text, '') || coalesce(ticket_minutes::text, ''), ';' order by code) from public.evenements where code = 'echauffement'),
  (select fin::text || coalesce(recap_jusqua::text, '') from public.evenements where code = 'reflets')))
union all select 'policies', count(*)::text, md5(string_agg(concat_ws('|', tablename, policyname, cmd, roles::text, qual, with_check), ';' order by tablename, policyname))
  from pg_policies where schemaname = 'public'
union all select 'triggers', count(*)::text, md5(string_agg(c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid), ';' order by c.relname, t.tgname))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
union all select 'fonctions avec retour chariot', count(*)::text, '' from pg_proc p where p.pronamespace = 'public'::regnamespace and position(E'\r' in p.prosrc) > 0
order by 1;
