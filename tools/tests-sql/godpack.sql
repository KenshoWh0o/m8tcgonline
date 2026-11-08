\set ON_ERROR_STOP 1
-- 3.0.13 : le godpack, trois Epiques, deux Legendaires, une Secrete.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'g1@t', '{"full_name": "God Un"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('g1@t') on conflict do nothing;
update public.profiles set pseudo = 'god_un', boosters_bonus = 50 where id = '00000000-0000-0000-0000-0000000000d1';
-- cfg('god_odds') ramene a 1 le temps du test : chaque booster est un godpack
-- (la base du banc est jetee apres).
do $$ declare src text; begin
  select pg_get_functiondef(p.oid) into src from pg_proc p
   where p.proname = 'cfg' and p.pronamespace = 'public'::regnamespace;
  if position('then 2000       -- 1 chance sur 2000' in src) = 0 then raise exception 'ECHEC : god_odds introuvable dans cfg'; end if;
  execute replace(src, 'then 2000       -- 1 chance sur 2000', 'then 1');
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $t$
declare r jsonb; rars text;
begin
  for i in 1..8 loop
    r := public.open_pack(true);
    if not (r->>'god')::boolean then raise exception 'ECHEC : pas un godpack'; end if;
    select string_agg(k.rar, ',' order by o.i) into rars
      from jsonb_array_elements_text(r->'cards') with ordinality o(id, i) join cards k on k.id = o.id;
    if rars <> 'E,E,E,L,L,S' then raise exception 'ECHEC : godpack %', rars; end if;
  end loop;
  raise warning 'OK : huit godpacks, tous Epique, Epique, Epique, Legendaire, Legendaire, Secrete';
end $t$;
