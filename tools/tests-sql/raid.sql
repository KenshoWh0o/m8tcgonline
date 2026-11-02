\set ON_ERROR_STOP 1
-- 3.0.14 : le Raid reequilibre (tools/equilibre-raid.js). Les seuils d'une
-- phase dependent du boss du raid (raid_vie) et de l'echelle du serveur ; le
-- coffre de la derniere phase donne une Legendaire qui manque et le titre
-- « Heros du Raid », une seule fois ; a qui a toutes les Legendaires, des
-- Fragments a la place ; pas de coffre d'une phase debout, ni deux fois le
-- meme, ni sans avoir combattu.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000016a1', 'rd1@t', '{"full_name": "Raid Un"}'),
  ('00000000-0000-0000-0000-0000000016a2', 'rd2@t', '{"full_name": "Raid Deux"}'),
  ('00000000-0000-0000-0000-0000000016a3', 'rd3@t', '{"full_name": "Raid Trois"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('rd1@t'), ('rd2@t'), ('rd3@t') on conflict do nothing;
do $t$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000016a1';
  u2 uuid := '00000000-0000-0000-0000-0000000016a2';
  u3 uuid := '00000000-0000-0000-0000-0000000016a3';
  s int := raid_saison(jour_paris());
  x jsonb; k int; a int; b int; f0 int; f1 int; ok boolean; v jsonb;
begin
  -- 1. Les seuils : ceux de raid_phases, a la vie du boss de chaque raid.
  update parametres set raid_echelle = 1 where id = 1;
  for k in 1..6 loop
    if raid_seuil(k, 1) <> round(((raid_phases()->(k - 1))->>'seuil')::int * raid_vie(raid_boss(1)))
       or raid_seuil(k, 2) <> round(((raid_phases()->(k - 1))->>'seuil')::int * raid_vie(raid_boss(2))) then
      raise exception 'ECHEC : seuil de la phase % (raid 1 : %, raid 2 : %)', k, raid_seuil(k, 1), raid_seuil(k, 2);
    end if;
    if k > 1 and (raid_seuil(k, 1) <= raid_seuil(k - 1, 1) or raid_seuil(k, 2) <= raid_seuil(k - 1, 2)) then
      raise exception 'ECHEC : les seuils ne montent pas a la phase %', k;
    end if;
  end loop;
  if raid_boss(1) <> 'c116' or raid_boss(2) <> 'c121' then raise exception 'ECHEC : boss % puis %', raid_boss(1), raid_boss(2); end if;
  -- L'echelle du serveur multiplie le tout.
  update parametres set raid_echelle = 0.5 where id = 1;
  if raid_seuil(6, 1) <> round(((raid_phases()->5)->>'seuil')::int * raid_vie('c116') * 0.5) then
    raise exception 'ECHEC : l''echelle n''est pas appliquee (%)', raid_seuil(6, 1);
  end if;
  update parametres set raid_echelle = 1 where id = 1;
  -- La page lit les memes seuils (raid_etat › phases › seuil).
  perform set_config('request.jwt.claim.sub', u1::text, false);
  v := raid_etat();
  for k in 1..6 loop
    if ((v->'phases'->(k - 1))->>'seuil')::int <> raid_seuil(k, s) then
      raise exception 'ECHEC : raid_etat donne % pour la phase %, raid_seuil %', (v->'phases'->(k - 1))->>'seuil', k, raid_seuil(k, s);
    end if;
  end loop;

  -- 2. Un raid tout neuf : le coffre de la phase 1 n'est pas a prendre.
  insert into raid_saisons (n, degats) values (s, 0) on conflict (n) do update set degats = 0;
  insert into raid_participants (saison, user_id, combats) values (s, u1, 1), (s, u2, 1)
    on conflict (saison, user_id) do update set combats = 1;
  ok := false;
  begin perform raid_reclamer(s, 'commun', 1); exception when others then ok := sqlerrm like '%pas encore abattue%'; end;
  if not ok then raise exception 'ECHEC : le coffre d''une phase debout s''ouvre'; end if;

  -- 3. Le serveur passe le dernier seuil : les six phases tombent.
  update raid_saisons set degats = raid_seuil(6, s) - 1 where n = s;
  if raid_phase(s) <> 6 then raise exception 'ECHEC : un degat avant la fin, phase % au lieu de 6', raid_phase(s); end if;
  update raid_saisons set degats = raid_seuil(6, s) where n = s;
  if raid_phase(s) <> 7 then raise exception 'ECHEC : seuil atteint, phase % au lieu de 7', raid_phase(s); end if;

  -- 4. Le coffre de la derniere phase : une Legendaire qui manquait, et le titre.
  select count(*) into a from collection c join cards k on k.id = c.card_id
   where c.user_id = u1 and k.rar = 'L' and not k.promo and c.qty > 0;
  x := raid_reclamer(s, 'commun', 6);
  select count(*) into b from collection c join cards k on k.id = c.card_id
   where c.user_id = u1 and k.rar = 'L' and not k.promo and c.qty > 0;
  if b <> a + 1 or jsonb_array_length(x->'cartes') <> 1 then
    raise exception 'ECHEC : Legendaires % puis %, cartes rendues %', a, b, x->'cartes';
  end if;
  if not exists (select 1 from cards where id = x->'cartes'->>0 and rar = 'L' and not promo) then
    raise exception 'ECHEC : la carte rendue (%) n''est pas une Legendaire de l''extension', x->'cartes'->>0;
  end if;
  if not ('t_heros_raid' = any (titres_de(u1))) then raise exception 'ECHEC : pas de titre Heros du Raid'; end if;
  -- Deux fois : refuse.
  ok := false;
  begin perform raid_reclamer(s, 'commun', 6); exception when others then ok := sqlerrm like '%déjà ouvert%'; end;
  if not ok then raise exception 'ECHEC : le dernier coffre s''ouvre deux fois'; end if;

  -- 5. Qui a deja toutes les Legendaires : la moitie d'une fabrication, et le titre.
  perform set_config('request.jwt.claim.sub', u2::text, false);
  insert into collection (user_id, card_id, qty)
    select u2, id, 1 from cards where rar = 'L' and not promo on conflict (user_id, card_id) do update set qty = 1;
  insert into inventory (user_id, item_id, qty) values (u2, 't_heros_raid', 1) on conflict do nothing;
  select fragments into f0 from profiles where id = u2;
  x := raid_reclamer(s, 'commun', 6);
  select fragments into f1 from profiles where id = u2;
  if f1 <> f0 + cfg('fabrication_L') / 2 or jsonb_array_length(x->'cartes') <> 0 then
    raise exception 'ECHEC : toutes les Legendaires — Fragments % puis %, cartes %', f0, f1, x->'cartes';
  end if;
  -- Le titre deja la : il ne se double pas.
  select qty into a from inventory where user_id = u2 and item_id = 't_heros_raid';
  if a <> 1 then raise exception 'ECHEC : le titre en % exemplaires', a; end if;

  -- 6. Sans avoir combattu dans le raid : rien.
  perform set_config('request.jwt.claim.sub', u3::text, false);
  ok := false;
  begin perform raid_reclamer(s, 'commun', 1); exception when others then ok := sqlerrm like '%pas combattu%'; end;
  if not ok then raise exception 'ECHEC : un coffre ouvert sans avoir combattu'; end if;

  -- Le raid en cours, rendu tel qu'il etait : les tests suivants l'ouvrent a la phase 1.
  delete from raid_pris where saison = s and user_id in (u1, u2, u3);
  delete from raid_participants where saison = s and user_id in (u1, u2, u3);
  delete from raid_tombees where saison = s;
  update raid_saisons set degats = 0 where n = s;

  raise warning 'OK : Raid — seuils a la vie de chaque boss (raid 1 : %, raid 2 : % pour la derniere phase) et a l''echelle, raid_etat d''accord, dernier coffre (Legendaire et titre, une fois ; Fragments a qui les a toutes), refus',
    raid_seuil(6, 1), raid_seuil(6, 2);
end $t$;
