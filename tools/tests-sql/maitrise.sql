\set ON_ERROR_STOP 1
-- 3.0.13 : la maitrise consomme des exemplaires en trop, et un exemplaire qui
-- manque ne se paie plus en Fragments. 3.0.14 : un exemplaire reste (plus
-- ceux qu'on garde, ceux de ses decks, ceux promis) ; bareme L et S allege.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'mz1@t', '{"full_name": "Maitre Un"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('mz1@t') on conflict do nothing;
update public.profiles set pseudo = 'maitre_un', fragments = 100000 where id = '00000000-0000-0000-0000-0000000000e1';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $t$
declare
  u uuid := '00000000-0000-0000-0000-0000000000e1';
  c text; nom text; q int; f int; n int; ok boolean;
begin
  -- Une Commune de l'extension (pas une Essence).
  select id, k.nom into c, nom from cards k where k.rar = 'C' and k.cat = 'joueur' and not k.reverse and not k.promo order by id limit 1;

  -- Le bareme, tel que la doc le dit (3.0.14 : L 1-1-1-1-1, S 1-0-0-0-1).
  if public.maitrise_copies('C', 1) <> 2 or public.maitrise_copies('C', 5) <> 6
     or public.maitrise_copies('L', 4) <> 1 or public.maitrise_copies('S', 5) <> 1
     or public.maitrise_copies('S', 2) <> 0 or public.maitrise_copies('S', 4) <> 0
     or public.maitrise_fragments('C', 1) <> 80 or public.maitrise_fragments('L', 5) <> 8800
     or public.maitrise_fragments('E', 3) <> 2000 then
    raise exception 'ECHEC : bareme inattendu';
  end if;

  -- Un exemplaire reste toujours (3.0.14) : deux exemplaires, un seul en
  -- trop, le niveau I (deux) est refuse, rien n'est pris.
  insert into collection (user_id, card_id, qty) values (u, c, 2)
    on conflict (user_id, card_id) do update set qty = 2;
  ok := false;
  begin
    perform public.maitriser(c);
  exception when others then
    ok := sqlerrm like 'Il faut 2 exemplaires en trop de%tu en as 1.';
    if not ok then raise exception 'ECHEC : message inattendu : %', sqlerrm; end if;
  end;
  if not ok then raise exception 'ECHEC : niveau I accepte avec un seul exemplaire en trop'; end if;
  select fragments into f from profiles where id = u;
  if f <> 100000 then raise exception 'ECHEC : des Fragments payes pour un refus (%)', f; end if;

  -- Les exemplaires d'un deck sont proteges : un deck en joue trois, il en a
  -- quatre — un seul en trop, refuse.
  update collection set qty = 4 where user_id = u and card_id = c;
  insert into decks (id, user_id, nom, cartes) values ('mz-test', u, 'Essai', jsonb_build_object(c, 3))
    on conflict (id) do update set cartes = excluded.cartes;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : niveau I accepte sur les exemplaires d''un deck';
  exception when others then
    if sqlerrm not like 'Il faut 2 exemplaires%tu en as 1.' then raise; end if;
  end;
  select qty into q from collection where user_id = u and card_id = c;
  if q <> 4 then raise exception 'ECHEC : exemplaires pris lors d''un refus (%)', q; end if;
  delete from decks where id = 'mz-test';

  -- Trois, et aucun deck : niveau I, deux exemplaires consommes, 80 Fragments ; il en reste un.
  update collection set qty = 3 where user_id = u and card_id = c;
  perform public.maitriser(c);
  select qty into q from collection where user_id = u and card_id = c;
  select fragments into f from profiles where id = u;
  select niveau into n from maitrises where user_id = u and card_id = c;
  if q <> 1 or f <> 100000 - 80 or n <> 1 then raise exception 'ECHEC : niveau I : qty %, fragments %, niveau %', q, f, n; end if;
  if not exists (select 1 from maitrises_journal where user_id = u and card_id = c and niveau = 1 and copies = 2 and fragments = 80) then
    raise exception 'ECHEC : journal du niveau I';
  end if;

  -- Ce que le joueur garde est protege : garder 5, en avoir 7, le niveau II (3) est refuse.
  update collection set qty = 7 where user_id = u and card_id = c;
  insert into gardes (user_id, card_id, n) values (u, c, 5) on conflict (user_id, card_id) do update set n = 5;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : niveau II accepte sur des exemplaires gardes';
  exception when others then
    if sqlerrm not like 'Il faut 3 exemplaires%tu en as 2.' then raise; end if;
  end;
  delete from gardes where user_id = u and card_id = c;

  -- Un exemplaire promis dans un echange est protege aussi : quatre, un promis, deux en trop.
  insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-0000000000e2', 'mz2@t', '{"full_name": "Maitre Deux"}') on conflict do nothing;
  update collection set qty = 4 where user_id = u and card_id = c;
  insert into trades (from_user, to_user, offer_card, want_card, status)
    values (u, '00000000-0000-0000-0000-0000000000e2', c, c, 'pending');
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : niveau II accepte sur un exemplaire promis';
  exception when others then
    if sqlerrm not like 'Il faut 3 exemplaires%tu en as 2.' then raise; end if;
  end;
  delete from trades where from_user = u;

  -- Pas assez de Fragments : refuse, rien n'est pris.
  update collection set qty = 6 where user_id = u and card_id = c;
  update profiles set fragments = 100 where id = u;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : niveau II accepte sans assez de Fragments';
  exception when others then
    if sqlerrm not like 'Pas assez de Fragments : il en faut 160.' then raise; end if;
  end;
  select qty into q from collection where user_id = u and card_id = c;
  if q <> 6 then raise exception 'ECHEC : exemplaires pris sans Fragments (%)', q; end if;

  -- Jusqu'a la Legende : 3 + 4 + 5 + 6 exemplaires de plus, 160 + 320 + 560 + 880 Fragments ; il en reste un.
  update profiles set fragments = 1920 where id = u;
  update collection set qty = 1 + 18 where user_id = u and card_id = c;
  for i in 2..5 loop perform public.maitriser(c); end loop;
  select qty into q from collection where user_id = u and card_id = c;
  select fragments into f from profiles where id = u;
  select niveau into n from maitrises where user_id = u and card_id = c;
  if q <> 1 or f <> 0 or n <> 5 then raise exception 'ECHEC : Legende : qty %, fragments %, niveau %', q, f, n; end if;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : un sixieme niveau';
  exception when others then
    if sqlerrm not like 'Cette carte est déjà au niveau maximum.' then raise; end if;
  end;

  -- Une Secrete (3.0.14) : un exemplaire au niveau I, aucun aux niveaux II a IV, un au V.
  select id into c from cards where secrete order by id limit 1;
  insert into collection (user_id, card_id, qty) values (u, c, 2) on conflict (user_id, card_id) do update set qty = 2;
  update profiles set fragments = 100000 where id = u;
  for i in 1..4 loop perform public.maitriser(c); end loop;
  select qty into q from collection where user_id = u and card_id = c;
  select niveau into n from maitrises where user_id = u and card_id = c;
  if q <> 1 or n <> 4 then raise exception 'ECHEC : Secrete jusqu''au niveau IV : qty %, niveau %', q, n; end if;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : Secrete au niveau V sans exemplaire en trop';
  exception when others then
    if sqlerrm not like 'Il faut 1 exemplaire en trop de%tu en as 0.' then raise; end if;
  end;
  update collection set qty = 2 where user_id = u and card_id = c;
  perform public.maitriser(c);
  select qty into q from collection where user_id = u and card_id = c;
  select niveau into n from maitrises where user_id = u and card_id = c;
  if q <> 1 or n <> 5 then raise exception 'ECHEC : Secrete en Legende : qty %, niveau %', q, n; end if;

  -- Une Reverse partage la maitrise de sa classique : seuls les exemplaires
  -- de la classique comptent.
  select k.id into c from cards k where k.rar = 'R' and k.reverse limit 1;
  insert into collection (user_id, card_id, qty) values (u, c, 9) on conflict (user_id, card_id) do update set qty = 9;
  insert into collection (user_id, card_id, qty) values (u, 'c' || substr(c, 2), 1) on conflict (user_id, card_id) do update set qty = 1;
  update profiles set fragments = 100000 where id = u;
  begin
    perform public.maitriser(c);
    raise exception 'ECHEC : les Reverses comptees comme exemplaires de la classique';
  exception when others then
    if sqlerrm not like 'Il faut 1 exemplaire en trop de%tu en as 0.' then raise; end if;
  end;
  -- Le Labo (3.0.13) : de quoi mener chaque carte en Legende.
  update profiles set is_admin = true where id = u;
  perform public.labo_cartes('maitrise');
  if (select qty from collection where user_id = u and card_id = (select id from cards where rar = 'C' and cat = 'joueur' and not reverse and not promo order by id offset 1 limit 1)) <> 23
     or (select qty from collection where user_id = u and card_id = (select id from cards where rar = 'L' and not reverse and not promo limit 1)) <> 8
     or exists (select 1 from collection co join cards k on k.id = co.card_id where co.user_id = u and k.cat = 'essence') then
    raise exception 'ECHEC : labo_cartes(maitrise)';
  end if;
  update profiles set is_admin = false where id = u;
  raise warning 'OK : maitrise — bareme 3.0.14, un exemplaire reste, refus sans exemplaires en trop (deck, garde, echange), consommation, Fragments, Legende, Secrete, Reverse, Labo';
end $t$;
