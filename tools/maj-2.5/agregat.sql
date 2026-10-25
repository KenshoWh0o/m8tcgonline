with reel as (select 'F' as k, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as nom,
       md5(pg_get_functiondef(p.oid)) as h,
       (has_function_privilege('anon', p.oid, 'execute'))::text || '/' || (has_function_privilege('authenticated', p.oid, 'execute'))::text as droits
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all
select 'C', c.table_name || '.' || c.column_name, md5(c.data_type || ':' || coalesce(c.column_default, '') || ':' || c.is_nullable), ''
  from information_schema.columns c where c.table_schema = 'public'
union all
select 'T', t.tablename, (t.rowsecurity)::text,
       (has_table_privilege('anon', 'public.' || quote_ident(t.tablename), 'select'))::text || '/' || (has_table_privilege('authenticated', 'public.' || quote_ident(t.tablename), 'select'))::text
  from pg_tables t where t.schemaname = 'public')
select k, count(*) as n, md5(string_agg(nom || '|' || h || '|' || droits, E'\n' order by nom collate "C")) as empreinte from reel group by k order by k;