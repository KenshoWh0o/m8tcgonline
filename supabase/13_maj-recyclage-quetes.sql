-- =====================================================================
--  Mise a jour du 28 septembre 2026 : recyclage et quetes de raretes
--  (Legendaires : 6 000 Eclats). Rejouable : le relancer applique les
--  valeurs du jour sans rien casser.
--  Pour une base deja installee : ne contient que ce qui a change.
--  Une seule transaction : tout passe, ou rien.
--  Ce contenu est aussi dans TOUT.sql (01_schema.sql, 04_seed.sql).
-- =====================================================================
begin;

-- 1. Recyclage : Rare 50, Epique 200, Legendaire 500, plafond 2 500.
create or replace function public.cfg(k text) returns integer
language sql immutable as $$
  select case k
    when 'ticket_cap'        then 5
    when 'ticket_minutes'    then 240
    when 'pack_size'         then 6
    when 'god_odds'          then 2000
    when 'trade_cooldown_h'  then 6
    when 'shards_per_dup'    then 0
    when 'promo_palier_pct'  then 75
    when 'recyclage_ES'      then 5
    when 'recyclage_C'       then 10
    when 'recyclage_PC'      then 20
    when 'recyclage_R'       then 50
    when 'recyclage_E'       then 200
    when 'recyclage_L'       then 500
    when 'recyclage_plafond' then 2500
  end;
$$;

-- 2. L'avancement des raretes completes.
create or replace function public.sync_collection_quests(p uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pct int;
begin
  select case when count(*) = 0 then 0
         else floor(count(*) filter (where c.qty > 0) * 100.0 / count(*)) end
    into pct
    from cards k left join collection c on c.card_id = k.id and c.user_id = p
   where not k.promo;

  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all', pct from quests q where q.metric = 'collection_pct'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress);

  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, 'all',
         (select count(*) from collection c join cards k on k.id = c.card_id
           where c.user_id = p and c.qty > 0 and not k.promo
             and k.rar = substr(q.metric, 5))
    from quests q where q.metric like 'set\_%'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress);
end $$;

-- 3. Les six quetes de raretes, et le nouvel ordre des paliers.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('m_setES', 'milestone', 'set_ES', (select count(*)::int from public.cards where rar = 'ES' and not promo), 250, null, 'Toutes les Essences', 'Possède toutes les Essences de l''extension.', 6),
  ('m_setC', 'milestone', 'set_C', (select count(*)::int from public.cards where rar = 'C' and not promo), 500, null, 'Toutes les Communes', 'Possède toutes les Communes de l''extension.', 7),
  ('m_setPC', 'milestone', 'set_PC', (select count(*)::int from public.cards where rar = 'PC' and not promo), 600, null, 'Toutes les Peu communes', 'Possède toutes les Peu communes de l''extension.', 8),
  ('m_setR', 'milestone', 'set_R', (select count(*)::int from public.cards where rar = 'R' and not promo), 1500, null, 'Toutes les Rares', 'Possède toutes les Rares de l''extension.', 9),
  ('m_setE', 'milestone', 'set_E', (select count(*)::int from public.cards where rar = 'E' and not promo), 3000, null, 'Toutes les Épiques', 'Possède toutes les Épiques de l''extension.', 10),
  ('m_setL', 'milestone', 'set_L', (select count(*)::int from public.cards where rar = 'L' and not promo), 6000, null, 'Toutes les Légendaires', 'Possède toutes les Légendaires de l''extension.', 11)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

update public.quests set ordre = 12 where id = 'm_packs25';
update public.quests set ordre = 13 where id = 'm_packs50';
update public.quests set ordre = 14 where id = 'm_packs100';
update public.quests set ordre = 15 where id = 'm_packs200';
update public.quests set ordre = 16 where id = 'm_trade25';

-- 4. La quete des 500 boosters disparait (son avancement part avec elle).
delete from public.quests where id = 'm_packs500';

commit;

-- Verification : 27 quetes, et les nouvelles valeurs du recyclage.
select count(*) as quetes, cfg('recyclage_R') as rare, cfg('recyclage_E') as epique,
       cfg('recyclage_L') as legendaire, cfg('recyclage_plafond') as plafond
  from public.quests;
