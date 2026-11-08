\set ON_ERROR_STOP 1
-- 0. 3.0.17 : la maintenance de la mise a jour se leve d'elle-meme a la
-- sortie prevue (mercredi 11 novembre 2026, 0 h, heure de Paris), si la base
-- l'a recue avant ; apres, elle attend un administrateur.
do $t$
declare m maintenance;
begin
  select * into m from maintenance where id = 1;
  if now() < timestamptz '2026-11-11 00:00:00+01' then
    if not m.fin_auto or m.fin <> timestamptz '2026-11-11 00:00:00+01' then raise exception 'ECHEC : levee automatique % %', m.fin_auto, m.fin; end if;
  elsif m.fin_auto or m.fin is not null then raise exception 'ECHEC : levee automatique apres la date % %', m.fin_auto, m.fin;
  end if;
  raise warning 'OK 0 : la maintenance de la mise a jour se leve d''elle-meme a % (auto : %)', coalesce(m.fin::text, 'personne'), m.fin_auto;
end $t$;
-- 1. Sans compte : porte() dit la version et la maintenance.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $t$
declare r jsonb := public.porte();
begin
  if r->>'version' <> '3.0' then raise exception 'ECHEC : version %', r->>'version'; end if;
  if r->'maintenance' is null or jsonb_typeof(r->'maintenance') <> 'object' or r->'maintenance'->>'message' is null then
    raise exception 'ECHEC : maintenance absente de porte() %', r; end if;
  raise warning 'OK 1 : porte() sans compte : version 3.0, maintenance %', r->'maintenance'->>'message';
end $t$;
reset role;

-- 2. Un joueur invité : refusé ; me() répond quand même.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $t$
declare ok boolean := false; m jsonb;
begin
  begin perform public.checkin(); exception when others then ok := sqlerrm = 'MAINTENANCE'; end;
  if not ok then raise exception 'ECHEC : checkin passe pendant la maintenance'; end if;
  ok := false;
  begin perform public.combat_section('toxique'); exception when others then ok := sqlerrm = 'MAINTENANCE'; end;
  if not ok then raise exception 'ECHEC : combat_section passe pendant la maintenance'; end if;
  m := public.me();
  if m is null or (m->>'is_admin')::boolean then raise exception 'ECHEC : me() du joueur'; end if;
  ok := false;
  begin perform public.labo_maintenance(false); exception when others then ok := sqlerrm = 'Réservé aux administrateurs.'; end;
  if not ok then raise exception 'ECHEC : un joueur leve la maintenance'; end if;
  raise warning 'OK 2 : un joueur est refuse (MAINTENANCE), me() repond, il ne leve rien';
end $t$;

-- 3. L'administrateur joue, et regle la maintenance.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $t$
declare e jsonb; d1 timestamptz; ok boolean := false;
begin
  perform public.checkin();
  perform public.combat_section('deter');
  e := public.labo_etat();
  if not (e->'maintenance'->>'actif')::boolean then raise exception 'ECHEC : labo_etat ne voit pas la maintenance'; end if;
  d1 := (e->'maintenance'->>'depuis')::timestamptz;
  -- Changer le message garde l'heure de depart et l'auteur.
  e := public.labo_maintenance(true, '  On revient a 21 h.  ', now() + interval '2 hours');
  if e->'maintenance'->>'message' <> 'On revient a 21 h.' or (e->'maintenance'->>'depuis')::timestamptz <> d1
     or e->'maintenance'->>'par' <> 'la mise à jour 3.0' or e->'maintenance'->>'fin' is null then
    raise exception 'ECHEC : mise a jour du message %', e->'maintenance'; end if;
  begin perform public.labo_maintenance(true, 'x', now() - interval '1 minute'); exception when others then ok := sqlerrm like 'L''heure de retour%'; end;
  if not ok then raise exception 'ECHEC : une heure de retour passee acceptee'; end if;
  e := public.labo_maintenance(false);
  if (e->'maintenance'->>'actif')::boolean or e->'maintenance'->>'message' is not null or e->'maintenance'->>'depuis' is not null then
    raise exception 'ECHEC : levee incomplete %', e->'maintenance'; end if;
  if public.porte()->'maintenance' <> 'null'::jsonb then raise exception 'ECHEC : porte() voit encore la maintenance'; end if;
  e := public.labo_maintenance(true, 'Essai', null);
  if e->'maintenance'->>'par' <> 'maint_admin' or e->'maintenance'->>'depuis' is null then raise exception 'ECHEC : auteur ou depart %', e->'maintenance'; end if;
  perform public.labo_maintenance(false);
  raise warning 'OK 3 : l''administrateur joue, change le message (depart garde), refuse une heure passee, leve, rallume, leve';
end $t$;

-- 4. Levee : le joueur joue de nouveau.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $t$
begin
  perform public.checkin();
  perform public.combat_section('toxique');
  raise warning 'OK 4 : maintenance levee, le joueur joue';
end $t$;

-- 5. 3.0.17 : une maintenance qui se leve d'elle-meme a son heure de retour.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $t$
declare e jsonb;
begin
  e := public.labo_maintenance(true, 'Retour a l''heure dite', now() + interval '1 day', true);
  if not (e->'maintenance'->>'auto')::boolean or public.porte()->'maintenance' = 'null'::jsonb then raise exception 'ECHEC : maintenance automatique %', e->'maintenance'; end if;
end $t$;
reset role;
update public.maintenance set fin = now() - interval '1 second' where id = 1;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $t$
begin
  if public.porte()->'maintenance' <> 'null'::jsonb then raise exception 'ECHEC : porte() voit une maintenance passee son heure'; end if;
  perform public.checkin();
  raise warning 'OK 5 : passee son heure de retour, la maintenance automatique ne compte plus (porte, garde)';
end $t$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select public.labo_maintenance(false) is not null as levee;
