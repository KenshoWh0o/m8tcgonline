\set ON_ERROR_STOP 1
-- 3.0.13 : la serie de victoires, les decks publics, ce que la fiche d'un
-- joueur montre de ses combats (combat_public, player_profile).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'pc1@t', '{"full_name": "Profil Un"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'pc2@t', '{"full_name": "Profil Deux"}') on conflict do nothing;
insert into public.beta_invites (cle) values ('pc1@t'), ('pc2@t') on conflict do nothing;
update public.profiles set pseudo = 'profil_un' where id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set pseudo = 'profil_deux' where id = '00000000-0000-0000-0000-0000000000f2';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
do $t$
declare u uuid := '00000000-0000-0000-0000-0000000000f1'; r jsonb; c record; did text; complet jsonb; reserve jsonb;
begin
  -- La serie : deux victoires, une defaite, trois victoires.
  perform public.combat_joueur(u);
  perform public.combat_serie(u, true); perform public.combat_serie(u, true);
  perform public.combat_serie(u, false);
  perform public.combat_serie(u, true); perform public.combat_serie(u, true); perform public.combat_serie(u, true);
  select serie, serie_max into c from combat_joueurs where user_id = u;
  if c.serie <> 3 or c.serie_max <> 3 then raise exception 'ECHEC : serie % / %', c.serie, c.serie_max; end if;
  perform public.combat_serie(u, false);
  select serie, serie_max into c from combat_joueurs where user_id = u;
  if c.serie <> 0 or c.serie_max <> 3 then raise exception 'ECHEC : serie apres defaite % / %', c.serie, c.serie_max; end if;
  r := public.me();
  if (r->'combat'->'stats'->>'serie_max')::int <> 3 then raise exception 'ECHEC : me() sans serie_max : %', r->'combat'->'stats'; end if;
  raise warning 'OK 1 : la serie de victoires, en cours et record, dans me()';

  -- Un deck incomplet ne se publie pas ; un deck complet si.
  insert into collection (user_id, card_id, qty)
    select u, k.id, 3 from cards k where not k.promo and k.cat in ('joueur', 'coach', 'moment', 'objet')
    on conflict (user_id, card_id) do update set qty = 3;
  r := public.deck_sauver(jsonb_build_object('nom', 'Brouillon', 'cartes', jsonb_build_object((select id from cards where cat = 'joueur' and not promo order by id limit 1), 2)));
  select id into did from decks where user_id = u and nom = 'Brouillon';
  begin
    perform public.deck_publier(did, true);
    raise exception 'ECHEC : un deck incomplet publie';
  exception when others then
    if sqlerrm not like 'Seul un deck complet%' then raise; end if;
  end;
  select jsonb_object_agg(id, 3) into complet from (select id from cards where not promo and cat in ('joueur', 'coach', 'moment', 'objet') order by id limit 13) x;
  complet := complet || jsonb_build_object((select id from cards where not promo and cat = 'joueur' order by id offset 13 limit 1), 1);
  reserve := '{"rose": 10}'::jsonb;
  r := public.deck_sauver(jsonb_build_object('nom', 'Complet', 'cartes', complet, 'reserve', reserve));
  select id into did from decks where user_id = u and nom = 'Complet';
  if (select public from decks where id = did) then raise exception 'ECHEC : public sans le demander'; end if;
  r := public.deck_publier(did, true);
  if not (select public from decks where id = did) then raise exception 'ECHEC : deck_publier'; end if;
  if not exists (select 1 from jsonb_array_elements(r->'combat'->'decks') d where d->>'id' = did and (d->>'public')::boolean) then
    raise exception 'ECHEC : me() sans le drapeau public';
  end if;
  -- Reenregistre sans la cle : il reste public ; avec public=false : il ne l'est plus.
  r := public.deck_sauver(jsonb_build_object('id', did, 'nom', 'Complet', 'cartes', complet, 'reserve', reserve));
  if not (select public from decks where id = did) then raise exception 'ECHEC : public perdu sans la cle'; end if;
  raise warning 'OK 2 : un deck incomplet refuse, un complet publie, le drapeau garde a l''enregistrement';

  -- La fiche, vue par un autre joueur : ses chiffres et son deck public, pas le brouillon.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
  r := public.player_profile('profil_un');
  if (r->'combat'->'stats'->>'serie_max')::int <> 3 then raise exception 'ECHEC : fiche sans stats : %', r->'combat'; end if;
  if jsonb_array_length(r->'combat'->'decks') <> 1 or r->'combat'->'decks'->0->>'nom' <> 'Complet' then
    raise exception 'ECHEC : fiche, decks publics : %', r->'combat'->'decks';
  end if;
  -- Un joueur qui n'a jamais combattu : null.
  r := public.player_profile('profil_deux');
  if r->'combat' is not null and jsonb_typeof(r->'combat') <> 'null' then raise exception 'ECHEC : combat d''un joueur sans combat : %', r->'combat'; end if;
  -- Le deck repris : il disparait de la fiche.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
  r := public.deck_publier(did, false);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
  r := public.player_profile('profil_un');
  if jsonb_array_length(r->'combat'->'decks') <> 0 then raise exception 'ECHEC : deck repris encore visible'; end if;
  -- On ne publie pas le deck d'un autre.
  begin
    perform public.deck_publier(did, true);
    raise exception 'ECHEC : deck d''un autre publie';
  exception when others then
    if sqlerrm <> 'Deck introuvable.' then raise; end if;
  end;
  raise warning 'OK 3 : la fiche montre la serie et les decks publics, rien pour qui n''a pas combattu, rien d''un deck repris';
end $t$;
-- Les droits : ni anon ni authenticated n'appellent combat_serie et combat_public.
do $t$ begin
  if has_function_privilege('authenticated', 'public.combat_serie(uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.combat_public(uuid)', 'execute')
     or has_function_privilege('anon', 'public.deck_publier(text, boolean)', 'execute') then
    raise exception 'ECHEC : droits';
  end if;
  raise warning 'OK 4 : droits';
end $t$;
