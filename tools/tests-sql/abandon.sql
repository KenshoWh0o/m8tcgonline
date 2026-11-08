\set ON_ERROR_STOP 1
-- 3.0.14 : un combat abandonne ne fait avancer aucune quete ; en solo, il ne
-- compte pas (ni defaite, ni serie) ; au Raid, il compte comme une defaite ;
-- un combat solo laisse ouvert ne compte plus comme perdu. 3.0.16 : le Raid
-- ne compte plus du tout dans le bilan victoires-defaites ni la serie (le
-- proprietaire : « pas niquer le ratio W-L ») ; ses degats, si.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000014a1', 'ab1@t', '{"full_name": "Abandon Un"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('ab1@t') on conflict do nothing;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000014a1', false);
select public.combat_section('toxique') is not null;
create or replace function pg_temp.deck_de(sec text) returns jsonb language sql as $$
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve', '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb)
    from starters s, generate_series(1, s.n) where s.section = sec;
$$;
do $t$
declare
  u uuid := '00000000-0000-0000-0000-0000000014a1';
  x jsonb; cid text; d int; s int; q int; h int; m text;
  combats_q int;
begin
  -- Ce que le joueur a fait avancer dans les quetes « combats ».
  select coalesce(sum(qp.progress), 0) into combats_q from quest_progress qp join quests k on k.id = qp.quest_id
   where qp.user_id = u and k.metric = 'combats';

  -- 1. Un combat de campagne abandonne : rien ne compte, l'historique le garde.
  x := public.combat_debut('campagne', 'cp01', null, pg_temp.deck_de('toxique'));
  cid := x->>'id';
  update combats_ouverts set debut = now() - interval '5 minutes' where combats_ouverts.id = cid;
  x := public.combat_fin_verifie(u, cid, '{"gagne": false, "abandon": true, "tours": 3}', '{"tours": 3, "raison": "abandon"}');
  select defaites, serie into d, s from combat_joueurs where user_id = u;
  select coalesce(sum(qp.progress), 0) into q from quest_progress qp join quests k on k.id = qp.quest_id
   where qp.user_id = u and k.metric = 'combats';
  select count(*) into h from combats_historique where user_id = u;
  m := x->'recompense'->>'message';
  if d <> 0 or q <> combats_q or h <> 1 or m not like 'Combat abandonné%' then
    raise exception 'ECHEC : abandon solo — defaites %, quetes % (avant %), historique %, message %', d, q, combats_q, h, m;
  end if;
  if (x->'recompense'->'xp') is not null then raise exception 'ECHEC : de l''XP pour un abandon solo'; end if;

  -- 2. Une defaite jouee jusqu'au bout compte, elle (defaite, quete « combats »).
  x := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  cid := x->>'id';
  update combats_ouverts set debut = now() - interval '5 minutes' where combats_ouverts.id = cid;
  x := public.combat_fin_verifie(u, cid, '{"gagne": false, "tours": 8}', '{"tours": 8, "raison": "pv"}');
  select defaites into d from combat_joueurs where user_id = u;
  select coalesce(sum(qp.progress), 0) into q from quest_progress qp join quests k on k.id = qp.quest_id
   where qp.user_id = u and k.metric = 'combats';
  if d <> 1 or q <= combats_q then raise exception 'ECHEC : defaite jouee — defaites %, quetes % (avant %)', d, q, combats_q; end if;
  combats_q := q;

  -- 3. Un combat solo laisse ouvert, puis un autre ouvert : le premier ne compte pas.
  x := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  x := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  select defaites into d from combat_joueurs where user_id = u;
  if d <> 1 then raise exception 'ECHEC : un combat solo laisse compte comme perdu (defaites %)', d; end if;
  delete from combats_ouverts where user_id = u;

  -- 4. Au Raid, un abandon : ses degats comptent (une defaite du Raid), sans
  -- quete, et hors du bilan (3.0.16).
  insert into combats_ouverts (id, user_id, mode, cle, niveau, phase, jour, graine, debut)
    values ('cb-raid-ab', u, 'raid', 'p1', 3, 1, jour_paris(), 1, now() - interval '5 minutes');
  x := public.combat_fin_verifie(u, 'cb-raid-ab', '{"gagne": false, "abandon": true, "touches": 1, "tours": 4}', '{"tours": 4, "raison": "abandon"}');
  select defaites into d from combat_joueurs where user_id = u;
  select coalesce(sum(qp.progress), 0) into q from quest_progress qp join quests k on k.id = qp.quest_id
   where qp.user_id = u and k.metric in ('combats', 'raid', 'raid_degats');
  if d <> 1 then raise exception 'ECHEC : abandon au Raid compte dans le bilan — defaites %', d; end if;
  if q <> combats_q then raise exception 'ECHEC : abandon au Raid — quetes % (avant %)', q, combats_q; end if;
  if coalesce((x->'recompense'->>'degats')::int, -1) <> 1 then raise exception 'ECHEC : abandon au Raid — degats % (attendu 1)', x->'recompense'->>'degats'; end if;

  -- 4 bis. Une defaite au Raid jouee jusqu'au bout : hors du bilan et de la serie.
  update combat_joueurs set serie = 2 where user_id = u;
  insert into combats_ouverts (id, user_id, mode, cle, niveau, phase, jour, graine, debut)
    values ('cb-raid-def', u, 'raid', 'p1', 3, 1, jour_paris(), 1, now() - interval '5 minutes');
  x := public.combat_fin_verifie(u, 'cb-raid-def', '{"gagne": false, "touches": 2, "tours": 9}', '{"tours": 9, "raison": "pv"}');
  select defaites, serie into d, s from combat_joueurs where user_id = u;
  if d <> 1 or s <> 2 then raise exception 'ECHEC : defaite au Raid — defaites % (attendu 1), serie % (attendu 2)', d, s; end if;

  -- 5. Un combat de Raid laisse ouvert : hors du bilan aussi (3.0.16).
  insert into combats_ouverts (id, user_id, mode, cle, niveau, phase, jour, graine)
    values ('cb-raid-laisse', u, 'raid', 'p1', 3, 1, jour_paris(), 1);
  x := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  select defaites into d from combat_joueurs where user_id = u;
  if d <> 1 then raise exception 'ECHEC : un combat de Raid laisse compte dans le bilan (defaites %)', d; end if;
  raise warning 'OK : abandons — solo sans rien (ni defaite, ni XP, ni quete, historique garde), defaite jouee comptee, combat solo laisse sans perte, Raid hors du bilan et de la serie (abandon, defaite, combat laisse), ses degats comptes';
end $t$;
select set_config('request.jwt.claim.sub', '', false);
