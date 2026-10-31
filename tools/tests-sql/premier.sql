\set ON_ERROR_STOP 1
-- 3.0.12 : « le perdant commencera la partie suivante » entre deux amis
-- (defi_lancer, vue_defi ; 23_combats.sql).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'p1@t', '{"full_name": "Premier Un"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'p2@t', '{"full_name": "Premier Deux"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'p3@t', '{"full_name": "Premier Trois"}')
on conflict do nothing;
insert into public.beta_invites (cle) values ('p1@t'), ('p2@t'), ('p3@t') on conflict do nothing;
update public.profiles set pseudo = 'prem_un' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set pseudo = 'prem_deux' where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set pseudo = 'prem_trois' where id = '00000000-0000-0000-0000-0000000000c3';
insert into public.friendships (a, b, demandeur, accepte) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', true),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c1', true)
on conflict do nothing;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.combat_section('toxique') is not null;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select public.combat_section('deter') is not null;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select public.combat_section('deter') is not null;

-- Le Starter de la Section d'un joueur, au format du moteur.
create or replace function pg_temp.deck(u uuid) returns jsonb language sql as $$
  select jsonb_build_object('club', jsonb_agg(s.card_id),
           'reserve', case when c.section = 'toxique'
                           then '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb
                           else '["mauve","mauve","mauve","mauve","mauve","azur","azur","azur","azur","azur"]'::jsonb end)
    from combat_joueurs c, starters s, generate_series(1, s.n)
   where c.user_id = u and s.section = c.section
   group by c.section $$;
-- Un defi de `p_de` a `p_pour`, accepte ; rend son id.
create or replace function pg_temp.defi(p_de uuid, pour_pseudo text, p_pour uuid) returns text language plpgsql as $$
declare did text;
begin
  perform set_config('request.jwt.claim.sub', p_de::text, false);
  perform public.defi_lancer(pour_pseudo, pg_temp.deck(p_de));
  select id into did from defis where defis.de = p_de and statut = 'attente' order by cree desc limit 1;
  perform set_config('request.jwt.claim.sub', p_pour::text, false);
  perform public.defi_repondre(did, true, pg_temp.deck(p_pour));
  return did;
end $$;
-- Ce que chacun recoit : init.premier (null s'il est absent), vu par les deux.
create or replace function pg_temp.premier(did text, a uuid, b uuid) returns int language plpgsql as $$
declare x jsonb; y jsonb;
begin
  perform set_config('request.jwt.claim.sub', a::text, false);
  x := public.defi_etat(did, 0)->'init';
  perform set_config('request.jwt.claim.sub', b::text, false);
  y := public.defi_etat(did, 0)->'init';
  if x is distinct from y then raise exception 'ECHEC : les deux ne recoivent pas la meme partie % / %', x, y; end if;
  if x ? 'premier' and jsonb_typeof(x->'premier') = 'null' then raise exception 'ECHEC : premier null ecrit dans init'; end if;
  return (x->>'premier')::int;
end $$;
-- La fin, declaree par l'un ou par les deux (g : 0, celui qui defie).
create or replace function pg_temp.fin(did text, qui uuid, g int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', qui::text, false);
  perform public.defi_fin(did, g, 9, null);
end $$;

-- Chaque etape dans sa propre transaction, comme deux navigateurs : `cree`
-- vaut now(), le debut de la transaction.
do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 1. Le premier defi : tire au sort (pas de premier).
  did := pg_temp.defi(u1, 'prem_deux', u2);
  p := pg_temp.premier(did, u1, u2);
  if p is not null then raise exception 'ECHEC 1 : premier % au premier defi', p; end if;
  perform pg_temp.fin(did, u1, 0); perform pg_temp.fin(did, u2, 0);  -- u1 (qui defiait) gagne
  raise warning 'OK 1 : le premier defi entre deux amis est tire au sort';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 2. u1 redefie u2 : u2 a perdu, il est le CEO 1, il commence.
  did := pg_temp.defi(u1, 'prem_deux', u2);
  p := pg_temp.premier(did, u1, u2);
  if p is distinct from 1 then raise exception 'ECHEC 2 : premier % (attendu 1)', p; end if;
  perform pg_temp.fin(did, u1, 1); perform pg_temp.fin(did, u2, 1);  -- u2 (le CEO 1) gagne
  raise warning 'OK 2 : le perdant (l''ami defie) commence';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 3. u2 defie u1 : u1 a perdu, il est le CEO 1 du nouveau defi.
  did := pg_temp.defi(u2, 'prem_un', u1);
  p := pg_temp.premier(did, u2, u1);
  if p is distinct from 1 then raise exception 'ECHEC 3 : premier % (attendu 1)', p; end if;
  perform pg_temp.fin(did, u2, 1);  -- une seule declaration : u1 (le CEO 1) gagne
  raise warning 'OK 3 : les roles s''inversent, le perdant commence toujours';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 4. u2 redefie u1 : u2 a perdu (une seule declaration suffit), il est le CEO 0.
  did := pg_temp.defi(u2, 'prem_un', u1);
  p := pg_temp.premier(did, u2, u1);
  if p is distinct from 0 then raise exception 'ECHEC 4 : premier % (attendu 0)', p; end if;
  perform pg_temp.fin(did, u2, 0); perform pg_temp.fin(did, u1, 1);  -- desaccord
  raise warning 'OK 4 : le perdant qui defie commence ; une seule declaration suffit';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 5. Apres un desaccord : tire au sort.
  did := pg_temp.defi(u1, 'prem_deux', u2);
  p := pg_temp.premier(did, u1, u2);
  if p is not null then raise exception 'ECHEC 5 : premier % apres un desaccord', p; end if;
  perform pg_temp.fin(did, u1, 0); perform pg_temp.fin(did, u2, 0);  -- u1 gagne
  raise warning 'OK 5 : apres un desaccord, tire au sort';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 6 (a). Un defi refuse.
  perform set_config('request.jwt.claim.sub', u2::text, false);
  perform public.defi_lancer('prem_un', pg_temp.deck(u2));
  select id into did from defis where de = u2 and statut = 'attente';
  perform set_config('request.jwt.claim.sub', u1::text, false);
  perform public.defi_repondre(did, false, null);
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 6 (b). Il ne compte pas : le dernier defi joue (u1 a gagne).
  did := pg_temp.defi(u2, 'prem_un', u1);
  p := pg_temp.premier(did, u2, u1);
  if p is distinct from 0 then raise exception 'ECHEC 6 : premier % (attendu 0 : u2 a perdu le dernier joue)', p; end if;
  perform pg_temp.fin(did, u2, 0);
  raise warning 'OK 6 : un defi refuse ne compte pas';
end $t$;

do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-0000000000c2';
  u3 uuid := '00000000-0000-0000-0000-0000000000c3';
  did text; p int;
begin
  -- 7. Un autre ami : sa propre histoire (u1 et u3 n'ont jamais joue).
  did := pg_temp.defi(u1, 'prem_trois', u3);
  p := pg_temp.premier(did, u1, u3);
  if p is not null then raise exception 'ECHEC 7 : premier % entre u1 et u3', p; end if;
  raise warning 'OK 7 : chaque paire d''amis a sa propre histoire';
end $t$;

