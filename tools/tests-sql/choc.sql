\set ON_ERROR_STOP 1
-- 3.0.13 : le Choc des Sections dure deux semaines ; son Pass a vingt
-- paliers ; le raid 2 commence le lendemain de sa fin ; son texte ne nomme
-- pas le boss suivant.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'ch1@t', '{"full_name": "Choc Un"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('ch1@t') on conflict do nothing;
update public.profiles set pseudo = 'choc_un', is_admin = true where id = '00000000-0000-0000-0000-0000000000c1';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $t$
declare e jsonb; ev evenements; j date; r1 int; r2 int; n int; s int;
begin
  -- Le Pass : vingt paliers, le dernier a 2 500, le tapis au bout.
  select count(*), max(seuil) into n, s from evt_piste where evenement = 'choc';
  if n <> 20 or s <> 2500 then raise exception 'ECHEC : Pass du Choc (% paliers, dernier %)', n, s; end if;
  if (select objet from evt_piste where evenement = 'choc' and palier = 20) <> 't_arene' then raise exception 'ECHEC : le tapis au palier 20'; end if;
  -- Les quetes de l'evenement ramenees a deux semaines.
  if (select goal from quests where id = 'c_ep7') <> 5 or (select goal from quests where id = 'c_packs60') <> 40 then
    raise exception 'ECHEC : objectifs des quetes du Choc';
  end if;

  -- Le Labo pose le Choc au jour 14 (le dernier), refuse le jour 15.
  e := public.labo_evenement('jour', 14);
  begin
    perform public.labo_evenement('jour', 15);
    raise exception 'ECHEC : jour 15 accepte';
  exception when others then
    if sqlerrm not like 'Un jour de 1 à 14.' then raise; end if;
  end;
  select * into ev from evenements where code = 'choc' order by fin desc limit 1;
  -- Quatorze dates, de minuit a minuit (heure de Paris), meme a travers le
  -- passage a l'heure d'hiver.
  if (ev.fin at time zone 'Europe/Paris')::date - (ev.debut at time zone 'Europe/Paris')::date <> 14
     or (ev.debut at time zone 'Europe/Paris')::time <> '00:00' or (ev.fin at time zone 'Europe/Paris')::time <> '00:00' then
    raise exception 'ECHEC : du % au % (heure de Paris)', ev.debut at time zone 'Europe/Paris', ev.fin at time zone 'Europe/Paris';
  end if;
  if ev.texte like '%Marionnettiste%' then raise exception 'ECHEC : le texte du Choc nomme le boss suivant'; end if;

  -- choc_etat : Epreuve 14 sur 14.
  e := public.choc_etat();
  if (e->>'n')::int <> 14 or (e->>'jours')::int <> 14 then raise exception 'ECHEC : choc_etat n %, jours %', e->>'n', e->>'jours'; end if;

  -- Le raid du dernier jour du Choc est le raid 1 ; le lendemain de la fin, le raid 2.
  j := (ev.debut at time zone 'Europe/Paris')::date;
  r1 := public.raid_saison(j + 13);
  r2 := public.raid_saison(j + 14);
  if r1 <> 1 or r2 <> 2 then raise exception 'ECHEC : raids % puis %', r1, r2; end if;
  if (ev.fin at time zone 'Europe/Paris')::date <> public.raid_saison_debut(2) then
    raise exception 'ECHEC : le raid 2 (%) ne commence pas a la fin du Choc (%)', public.raid_saison_debut(2), (ev.fin at time zone 'Europe/Paris')::date;
  end if;
  raise warning 'OK : Choc de deux semaines — Pass de vingt paliers, quetes, Labo (jour 14, refus du 15), Epreuve 14/14, raid 2 le lendemain de la fin, texte sans le boss suivant';
end $t$;
