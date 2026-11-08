\set ON_ERROR_STOP 1
-- 3.0.12 : l'historique des combats (23_combats.sql, section 8).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'h1@t', '{"full_name": "Histo Un"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'h2@t', '{"full_name": "Histo Deux"}')
on conflict do nothing;
insert into public.beta_invites (cle) values ('h1@t'), ('h2@t') on conflict do nothing;
update public.profiles set pseudo = 'histo_un', is_admin = true where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set pseudo = 'histo_deux' where id = '00000000-0000-0000-0000-0000000000a2';
insert into public.friendships (a, b, demandeur, accepte)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', true)
on conflict do nothing;

-- Un deck de Starter au format du moteur (3.0.14 : combat_debut le demande).
create or replace function pg_temp.deck_de(sec text) returns jsonb language sql as $$
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve',
         case sec when 'toxique' then '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb
                  else '["mauve","mauve","mauve","mauve","mauve","azur","azur","azur","azur","azur"]'::jsonb end)
    from starters s, generate_series(1, s.n) where s.section = sec;
$$;

-- 0. Les droits ; defi_fin et combat_fin retirees (3.0.14 : le serveur verifie).
do $t$
begin
  if has_function_privilege('anon', 'public.combats_historique()', 'execute') then raise exception 'ECHEC : anon lit l''historique'; end if;
  if not has_function_privilege('authenticated', 'public.combats_historique()', 'execute') then raise exception 'ECHEC : authenticated ne lit pas l''historique'; end if;
  if not has_function_privilege('authenticated', 'public.combat_historique(bigint)', 'execute') then raise exception 'ECHEC : combat_historique'; end if;
  if has_function_privilege('authenticated', 'public.historique_ajouter(uuid, text, text, integer, boolean, jsonb, jsonb)', 'execute') then
    raise exception 'ECHEC : historique_ajouter appelable par un joueur'; end if;
  if exists (select 1 from pg_proc where proname in ('defi_fin', 'combat_fin') and pronamespace = 'public'::regnamespace) then
    raise exception 'ECHEC : defi_fin ou combat_fin existe encore'; end if;
  if has_table_privilege('authenticated', 'public.combats_historique', 'select') then raise exception 'ECHEC : table lisible'; end if;
  raise warning 'OK 0 : droits, defi_fin et combat_fin retirees, table fermee';
end $t$;

-- 1. Un combat contre l'IA : l'entree, la liste, le deroule.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.combat_section('toxique') is not null;
do $t$
declare o jsonb; r jsonb; l jsonb; x jsonb; histo jsonb;
begin
  histo := '{"titre": "Arcade · Normal", "adversaire": {"nom": "IA · Normal", "avatar": "star", "frame": "default"},
             "raison": "pv", "tours": 7, "pv": 2, "pv_adv": 0, "deck": "Mon deck",
             "journal": {"v": 1, "premier": 0, "tours": [[0, null, [["pf", 0]]], [1, 0, [["de", 0, "c078", 0]]], [7, 0, [["fi", 0, "pv"]]]]}}';
  o := public.combat_debut('infini', '3', 3, pg_temp.deck_de('toxique'));
  r := public.combat_fin_verifie(auth.uid(), o->>'id', '{"gagne": true, "tours": 7, "vaincus": 2}', histo);
  if r->'recompense' is null then raise exception 'ECHEC : combat_fin_verifie ne rend pas la recompense'; end if;
  l := public.combats_historique();
  if jsonb_array_length(l) <> 1 then raise exception 'ECHEC : % entrees au lieu de 1', jsonb_array_length(l); end if;
  x := l->0;
  if x->>'mode' <> 'infini' or x->>'cle' <> '3' or (x->>'niveau')::int <> 3 or not (x->>'gagne')::boolean
     or x->>'titre' <> 'Arcade · Normal' or x->'adversaire'->>'nom' <> 'IA · Normal' or x->>'raison' <> 'pv'
     or (x->>'tours')::int <> 7 or (x->>'pv')::int <> 2 or (x->>'pv_adv')::int <> 0 or x->>'deck' <> 'Mon deck'
     or not (x->>'journal')::boolean then
    raise exception 'ECHEC : entree inattendue %', x;
  end if;
  r := public.combat_historique((x->>'id')::bigint);
  if r ? 'user_id' then raise exception 'ECHEC : user_id rendu'; end if;
  if jsonb_array_length(r->'journal'->'tours') <> 3 or r->'journal'->'tours'->1->2->0->>1 <> '0' then
    raise exception 'ECHEC : deroule inattendu %', r->'journal';
  end if;
  raise warning 'OK 1 : un combat contre l''IA, sa ligne et son deroule';
end $t$;

-- 2. Une entree mal formee ne bloque jamais le paiement ; un deroule trop
--    long ou d'une autre forme est laisse de cote, pas l'entree.
do $t$
declare o jsonb; r jsonb; n0 int; n1 int; long text;
begin
  n0 := jsonb_array_length(public.combats_historique());
  o := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  r := public.combat_fin_verifie(auth.uid(), o->>'id', '{"gagne": false}', '{"tours": "beaucoup"}');
  if r->'recompense' is null then raise exception 'ECHEC : le paiement bloque par un historique mal forme'; end if;
  n1 := jsonb_array_length(public.combats_historique());
  if n1 <> n0 then raise exception 'ECHEC : une entree mal formee a ete gardee'; end if;
  long := repeat('x', 31000);
  o := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  r := public.combat_fin_verifie(auth.uid(), o->>'id', '{"gagne": false}', jsonb_build_object('tours', 3,
        'journal', jsonb_build_object('v', 1, 'tours', jsonb_build_array(jsonb_build_array(1, 0, jsonb_build_array(jsonb_build_array('jo', 0, long)))))));
  o := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  r := public.combat_fin_verifie(auth.uid(), o->>'id', '{"gagne": false}', '{"tours": 2, "journal": [1, 2, 3], "raison": "triche", "titre": ""}');
  if jsonb_array_length(public.combats_historique()) <> n0 + 2 then raise exception 'ECHEC : les deux entrees sans deroule manquent'; end if;
  if exists (select 1 from jsonb_array_elements(public.combats_historique()) e
              where (e->>'journal')::boolean and (e->>'tours')::int in (2, 3)) then
    raise exception 'ECHEC : un deroule trop long ou mal forme a ete garde'; end if;
  if exists (select 1 from combats_historique where tours = 2 and (raison is not null or titre is not null)) then
    raise exception 'ECHEC : raison inconnue ou titre vide gardes'; end if;
  -- Sans histo : pas d'entree, et le combat paie.
  o := public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique'));
  r := public.combat_fin_verifie(auth.uid(), o->>'id', '{"gagne": false, "abandon": true}', null);
  if jsonb_array_length(public.combats_historique()) <> n0 + 2 then raise exception 'ECHEC : une entree sans histo'; end if;
  raise warning 'OK 2 : mal forme ignore, deroule trop long ou mal forme ecarte, sans histo rien';
end $t$;

-- 3. Trente au plus, les plus recents.
do $t$
declare o jsonb; i int; l jsonb;
begin
  for i in 1..34 loop
    o := public.combat_debut('infini', '2', 2, pg_temp.deck_de('toxique'));
    perform public.combat_fin_verifie(auth.uid(), o->>'id', jsonb_build_object('gagne', i % 2 = 0), jsonb_build_object('titre', 'n' || i, 'tours', i));
  end loop;
  l := public.combats_historique();
  if jsonb_array_length(l) <> 30 then raise exception 'ECHEC : % entrees au lieu de 30', jsonb_array_length(l); end if;
  if l->0->>'titre' <> 'n34' or l->29->>'titre' <> 'n5' then raise exception 'ECHEC : ordre ou coupe : % … %', l->0->>'titre', l->29->>'titre'; end if;
  if (select count(*) from combats_historique where user_id = '00000000-0000-0000-0000-0000000000a1') <> 30 then
    raise exception 'ECHEC : la table garde plus de 30 lignes'; end if;
  raise warning 'OK 3 : trente au plus, du plus recent au plus ancien';
end $t$;

-- 4. Chacun le sien ; sans compte, rien.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $t$
declare id1 bigint; ok boolean := false;
begin
  if jsonb_array_length(public.combats_historique()) <> 0 then raise exception 'ECHEC : histo_deux voit l''historique d''un autre'; end if;
  select id into id1 from combats_historique where user_id = '00000000-0000-0000-0000-0000000000a1' limit 1;
  begin perform public.combat_historique(id1); exception when others then ok := sqlerrm = 'Combat introuvable.'; end;
  if not ok then raise exception 'ECHEC : histo_deux lit un combat d''un autre'; end if;
  raise warning 'OK 4 : chacun ne lit que le sien';
end $t$;
select set_config('request.jwt.claim.sub', '', false);
do $t$
declare ok boolean := false;
begin
  begin perform public.combats_historique(); exception when others then ok := sqlerrm = 'non connecte'; end;
  if not ok then raise exception 'ECHEC : historique sans compte'; end if;
  raise warning 'OK 4 bis : sans compte, refuse';
end $t$;

-- 5. Un defi entre amis : une entree pour chacun, l'adversaire vu par le
--    serveur, une seule fois.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select public.combat_section('deter') is not null;
do $t$
declare d1 jsonb; d2 jsonb; did text; l jsonb; histo jsonb;
begin
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve', '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb)
    into d1 from starters s, generate_series(1, s.n) where s.section = 'toxique';
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve', '["mauve","mauve","mauve","mauve","mauve","azur","azur","azur","azur","azur"]'::jsonb)
    into d2 from starters s, generate_series(1, s.n) where s.section = 'deter';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
  perform public.defi_lancer('histo_deux', d1);
  select id into did from defis where de = '00000000-0000-0000-0000-0000000000a1' order by cree desc limit 1;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
  perform public.defi_repondre(did, true, d2);
  histo := '{"titre": "Défi entre amis", "adversaire": {"nom": "Faux nom", "avatar": "star"}, "raison": "pv", "tours": 9, "pv": 0, "pv_adv": 1,
             "journal": {"v": 1, "premier": 1, "tours": [[1, 1, [["de", 1, "c051", 0]]]]}}';
  perform public.defi_fin_verifie(auth.uid(), did, '{"gagnant": 0, "tours": 9}', histo);
  perform public.defi_fin_verifie(auth.uid(), did, '{"gagnant": 0, "tours": 9}', histo);
  l := public.combats_historique();
  if jsonb_array_length(l) <> 1 then raise exception 'ECHEC : histo_deux a % entrees de defi', jsonb_array_length(l); end if;
  if l->0->>'mode' <> 'defi' or (l->0->>'gagne')::boolean or l->0->'adversaire'->>'nom' <> 'histo_un' or l->0->>'cle' <> did then
    raise exception 'ECHEC : entree de defi inattendue %', l->0;
  end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
  -- Sans histo : rien.
  perform public.defi_fin_verifie(auth.uid(), did, '{"gagnant": 0, "tours": 9}', null);
  if exists (select 1 from combats_historique where user_id = '00000000-0000-0000-0000-0000000000a1' and mode = 'defi') then
    raise exception 'ECHEC : une entree de defi sans histo'; end if;
  -- Deja paye : un second appel, avec histo, n'ajoute plus rien.
  perform public.defi_fin_verifie(auth.uid(), did, '{"gagnant": 0, "tours": 9}', '{"tours": 9}');
  if exists (select 1 from combats_historique where user_id = '00000000-0000-0000-0000-0000000000a1' and mode = 'defi') then
    raise exception 'ECHEC : une entree apres coup'; end if;
  raise warning 'OK 5 : un defi, une entree par joueur, une fois, l''adversaire du serveur';
end $t$;

-- 5 bis. Le lanceur d'un nouveau defi, avec un histo sans deroule.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $t$
declare d1 jsonb; d2 jsonb; did text; l jsonb;
begin
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve', '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb)
    into d1 from starters s, generate_series(1, s.n) where s.section = 'toxique';
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve', '["mauve","mauve","mauve","mauve","mauve","azur","azur","azur","azur","azur"]'::jsonb)
    into d2 from starters s, generate_series(1, s.n) where s.section = 'deter';
  perform public.defi_lancer('histo_deux', d1);
  select id into did from defis where de = '00000000-0000-0000-0000-0000000000a1' and statut = 'attente' order by cree desc limit 1;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
  perform public.defi_repondre(did, true, d2);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
  perform public.defi_fin_verifie(auth.uid(), did, '{"gagnant": 0, "tours": 9}', '{"tours": 9, "adversaire": {"nom": "Faux"}}');
  l := public.combats_historique();
  if l->0->>'mode' <> 'defi' or not (l->0->>'gagne')::boolean or l->0->'adversaire'->>'nom' <> 'histo_deux' or (l->0->>'journal')::boolean then
    raise exception 'ECHEC : entree de defi du lanceur inattendue %', l->0;
  end if;
  raise warning 'OK 5 bis : le lanceur, son entree sans deroule';
end $t$;

-- 6. Le Labo : la sauvegarde l'emporte, « repartir de zero » l'efface, la
--    restauration le rend tel quel.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $t$
declare avant jsonb; apres jsonb;
begin
  avant := public.combats_historique();
  perform public.labo_sauver();
  perform public.labo_raz_moi();
  if jsonb_array_length(public.combats_historique()) <> 0 then raise exception 'ECHEC : repartir de zero garde l''historique'; end if;
  perform public.labo_restaurer();
  apres := public.combats_historique();
  if apres <> avant then raise exception 'ECHEC : restauration differente'; end if;
  raise warning 'OK 6 : sauvegarde, remise a zero, restauration (% combats)', jsonb_array_length(apres);
end $t$;
