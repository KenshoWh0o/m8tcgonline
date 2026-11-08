\set ON_ERROR_STOP 1
-- 3.0.17 : une Reverse rapporte au recyclage le double de sa classique.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'r1@t', '{"full_name": "Recy Un"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('r1@t') on conflict do nothing;
update public.profiles set pseudo = 'recy_un', fragments = 0 where id = '00000000-0000-0000-0000-0000000000e1';
update public.parametres set fabrication_reverse = true where id = 1;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $t$
declare rc text; cc text; rar text; avant int; apres int; base int;
begin
  -- Une Reverse Commune et une Commune classique, trois exemplaires de chaque.
  select id, k.rar into rc, rar from cards k where k.reverse and k.rar = 'C' order by id limit 1;
  select id into cc from cards k where not k.reverse and not k.promo and k.rar = 'C' order by id limit 1;
  insert into collection (user_id, card_id, qty) values
    ('00000000-0000-0000-0000-0000000000e1', rc, 3), ('00000000-0000-0000-0000-0000000000e1', cc, 3)
    on conflict (user_id, card_id) do update set qty = excluded.qty;
  base := cfg('recyclage_C');
  select fragments into avant from profiles where id = '00000000-0000-0000-0000-0000000000e1';
  perform public.recycler(jsonb_build_array(jsonb_build_object('carte', cc, 'n', 2)));
  select fragments into apres from profiles where id = '00000000-0000-0000-0000-0000000000e1';
  if apres - avant <> 2 * base then raise exception 'ECHEC : deux Communes rapportent % (attendu %)', apres - avant, 2 * base; end if;
  avant := apres;
  perform public.recycler(jsonb_build_array(jsonb_build_object('carte', rc, 'n', 2)));
  select fragments into apres from profiles where id = '00000000-0000-0000-0000-0000000000e1';
  if apres - avant <> 4 * base then raise exception 'ECHEC : deux Reverses Communes rapportent % (attendu %)', apres - avant, 4 * base; end if;
  raise warning 'OK : une Commune rapporte %, sa Reverse % (le double)', base, 2 * base;
end $t$;
