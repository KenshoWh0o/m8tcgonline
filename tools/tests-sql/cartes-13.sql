\set ON_ERROR_STOP 1
-- 3.0.13 : P03, P04 et les Secretes 124, 126, 127 revelees (photos du
-- proprietaire, 1er novembre 2026). Le catalogue, les Starters, et la Promo
-- donnee par chaque Section (combat_section) puis par la fin de la campagne.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'k1@t', '{"full_name": "Cartes Un"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'k2@t', '{"full_name": "Cartes Deux"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('k1@t'), ('k2@t') on conflict do nothing;
do $t$
declare nb int; k record;
begin
  -- Le catalogue.
  select * into k from cards where id = 'p03';
  if k.nom <> 'Brawks Déter' or k.col <> 'neutre' or k.cat <> 'joueur' or not k.promo then raise exception 'ECHEC : p03 %', row_to_json(k); end if;
  select * into k from cards where id = 'p04';
  if k.nom <> 'Squeezie le Toxique' or k.col <> 'rose' or k.cat <> 'joueur' or not k.promo then raise exception 'ECHEC : p04 %', row_to_json(k); end if;
  select * into k from cards where id = 'c124';
  if k.nom <> 'Brawks Trop Déter' or k.col <> 'violette' or k.cat <> 'joueur' or not k.secrete then raise exception 'ECHEC : c124 %', row_to_json(k); end if;
  select * into k from cards where id = 'c126';
  if k.nom <> 'GP Explorer II' or k.col <> 'neutre' or k.cat <> 'moment' or not k.secrete then raise exception 'ECHEC : c126 %', row_to_json(k); end if;
  select * into k from cards where id = 'c127';
  if k.nom <> 'Paris Gentle Mates' or k.col <> 'mauve' or k.cat <> 'moment' or not k.secrete then raise exception 'ECHEC : c127 %', row_to_json(k); end if;
  select count(*) into nb from cards where nom like 'Secrète n°%' or nom like 'Section %';
  if nb <> 0 then raise exception 'ECHEC : % cartes gardent un nom provisoire', nb; end if;
  -- Les copies : une Promo compte avec sa carte.
  if cle_copie('p03') <> cle_copie('c077') then raise exception 'ECHEC : p03 et c077 doivent partager leur cle'; end if;
  if cle_copie('p04') <> cle_copie('c012') then raise exception 'ECHEC : p04 et c012 doivent partager leur cle'; end if;
  -- Les Starters : la Promo de leur Section, trois Squeezie et trois Brawks Deter au plus.
  if not exists (select 1 from starters s where s.section = 'toxique' and s.card_id = 'p04' and s.n = 1)
     or not exists (select 1 from starters s where s.section = 'deter' and s.card_id = 'p03' and s.n = 1)
     or exists (select 1 from starters where (section, card_id) in (('toxique', 'p03'), ('deter', 'p04'))) then
    raise exception 'ECHEC : les Promos des Starters';
  end if;
  select sum(s.n) into nb from starters s where s.section = 'toxique' and s.card_id in ('p04', 'c012');
  if nb <> 3 then raise exception 'ECHEC : % Squeezie le Toxique dans le Starter Toxique', nb; end if;
  select sum(s.n) into nb from starters s where s.section = 'deter' and s.card_id in ('p03', 'c077');
  if nb <> 3 then raise exception 'ECHEC : % Brawks Deter dans le Starter Deter', nb; end if;
  raise warning 'OK 1 : le catalogue, les copies et les Starters';
end $t$;

-- Rejoindre une Section donne sa Promo : Toxique -> P04, Deter -> P03.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select public.combat_section('toxique') is not null;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select public.combat_section('deter') is not null;
select set_config('request.jwt.claim.sub', '', false);
do $t$
begin
  if not exists (select 1 from collection where user_id = '00000000-0000-0000-0000-0000000000e1' and card_id = 'p04')
     or exists (select 1 from collection where user_id = '00000000-0000-0000-0000-0000000000e1' and card_id = 'p03') then
    raise exception 'ECHEC : Toxique doit recevoir P04, et seulement elle';
  end if;
  if not exists (select 1 from collection where user_id = '00000000-0000-0000-0000-0000000000e2' and card_id = 'p03')
     or exists (select 1 from collection where user_id = '00000000-0000-0000-0000-0000000000e2' and card_id = 'p04') then
    raise exception 'ECHEC : Deter doit recevoir P03, et seulement elle';
  end if;
  raise warning 'OK 2 : la Promo de sa Section (combat_section)';
end $t$;
