\set ON_ERROR_STOP 1
-- 3.0.14 : le serveur verifie les combats. La page ne dit plus qui a gagne :
-- combat_debut note le deck et ce qui fait la partie, la fonction du serveur
-- (supabase/functions/combat-verifier) rejoue et paie par des fonctions que
-- seule la cle de service appelle. Ici, la partie SQL ; la partie rejouee
-- est eprouvee par tools/combat-tests.js et tools/verif/essai.ts.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000015a1', 've1@t', '{"full_name": "Verif Un"}'),
  ('00000000-0000-0000-0000-0000000015a2', 've2@t', '{"full_name": "Verif Deux"}')
on conflict do nothing;
insert into public.beta_invites (cle) values ('ve1@t'), ('ve2@t') on conflict do nothing;
update public.profiles set pseudo = 'verif_un', is_admin = true where id = '00000000-0000-0000-0000-0000000015a1';
update public.profiles set pseudo = 'verif_deux' where id = '00000000-0000-0000-0000-0000000015a2';
insert into public.friendships (a, b, demandeur, accepte)
values ('00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015a2', '00000000-0000-0000-0000-0000000015a1', true)
on conflict do nothing;
create or replace function pg_temp.deck_de(sec text) returns jsonb language sql as $$
  select jsonb_build_object('club', jsonb_agg(s.card_id), 'reserve',
         case sec when 'toxique' then '["rose","rose","rose","rose","rose","jade","jade","jade","jade","jade"]'::jsonb
                  else '["mauve","mauve","mauve","mauve","mauve","azur","azur","azur","azur","azur"]'::jsonb end)
    from starters s, generate_series(1, s.n) where s.section = sec;
$$;

-- 0. Les droits : le joueur ouvre un combat, seule la cle de service paie.
do $t$
declare f text;
begin
  foreach f in array array['public.combat_a_verifier(uuid, text, jsonb, jsonb)', 'public.combat_verif_avance(uuid, text, integer)',
                           'public.combat_fin_verifie(uuid, text, jsonb, jsonb)', 'public.combat_refuse(uuid, text, text, integer)',
                           'public.defi_a_verifier(uuid, text)', 'public.defi_fin_verifie(uuid, text, jsonb, jsonb)',
                           'public.combat_payer(uuid, public.combats_ouverts, jsonb, jsonb)'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'ECHEC : % appelable par un joueur', f; end if;
  end loop;
  foreach f in array array['public.combat_a_verifier(uuid, text, jsonb, jsonb)', 'public.combat_verif_avance(uuid, text, integer)',
                           'public.combat_fin_verifie(uuid, text, jsonb, jsonb)', 'public.combat_refuse(uuid, text, text, integer)',
                           'public.defi_a_verifier(uuid, text)', 'public.defi_fin_verifie(uuid, text, jsonb, jsonb)'] loop
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'ECHEC : % fermee a la cle de service', f; end if;
  end loop;
  if not has_function_privilege('authenticated', 'public.combat_debut(text, text, integer, jsonb)', 'execute') then
    raise exception 'ECHEC : combat_debut fermee'; end if;
  if exists (select 1 from pg_proc where proname = 'combat_debut' and pronamespace = 'public'::regnamespace and pronargs = 3) then
    raise exception 'ECHEC : l''ancienne combat_debut a trois arguments existe encore'; end if;
  if has_function_privilege('authenticated', 'public.garde_beta_de(uuid)', 'execute') then raise exception 'ECHEC : garde_beta_de ouverte'; end if;
  raise warning 'OK 0 : droits (le joueur ouvre, la cle de service paie)';
end $t$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000015a1', false);
select public.combat_section('toxique') is not null;

-- 1. combat_debut : un deck est demande, possede ou prete ; il est note.
do $t$
declare o jsonb; ok boolean; d jsonb := pg_temp.deck_de('toxique'); r combats_ouverts;
begin
  ok := false;
  begin perform public.combat_debut('infini', '3', 3); exception when others then ok := sqlerrm = 'Choisis un deck.'; end;
  if not ok then raise exception 'ECHEC : un combat sans deck'; end if;
  -- Le Starter de l'autre Section n'est pas prete avant la fin de la campagne.
  ok := false;
  begin perform public.combat_debut('infini', '3', 3, pg_temp.deck_de('deter')); exception when others then ok := sqlerrm like 'Tu n''as pas assez d''exemplaires%'; end;
  if not ok then raise exception 'ECHEC : un deck aux cartes ni possedees ni pretees'; end if;
  o := public.combat_debut('infini', '3', 3, d);
  select * into r from combats_ouverts where id = o->>'id';
  if r.deck <> d or r.section <> 'toxique' or r.journal is not null or r.verif_k <> 0 then
    raise exception 'ECHEC : combat ouvert inattendu (deck note : %, section %)', r.deck = d, r.section; end if;
  if o->>'section' <> 'toxique' or (o->>'niveau')::int <> 3 or (o->>'jour')::date <> jour_paris() or o->>'graine' is null then
    raise exception 'ECHEC : combat_debut rend %', o; end if;
  raise warning 'OK 1 : deck demande, verifie, note (et rendu a la page avec la graine)';
end $t$;

-- 2. combat_a_verifier : la partie s'ecrit une fois ; une passe avance ; un
--    refus ferme le combat sans rien payer, et le Labo le voit.
do $t$
declare o jsonb; v jsonb; u uuid := '00000000-0000-0000-0000-0000000015a1'; e0 int; e1 int; ok boolean;
begin
  o := public.combat_debut('infini', '3', 3, pg_temp.deck_de('toxique'));
  v := public.combat_a_verifier(u, o->>'id', '[{"t":"choix","v":"oui"}]', '{"titre": "Arcade"}');
  if v->'journal' <> '[{"t":"choix","v":"oui"}]' or v->>'mode' <> 'infini' or v->'deck' is null or v->'meta'->>'titre' <> 'Arcade' then
    raise exception 'ECHEC : combat a verifier %', v; end if;
  v := public.combat_a_verifier(u, o->>'id', '[{"t":"choix","v":"non"}]', '{"titre": "Autre"}');
  if v->'journal' <> '[{"t":"choix","v":"oui"}]' or v->'meta'->>'titre' <> 'Arcade' then
    raise exception 'ECHEC : la partie a change a la seconde passe'; end if;
  perform public.combat_verif_avance(u, o->>'id', 12);
  perform public.combat_verif_avance(u, o->>'id', 5);
  if (public.combat_a_verifier(u, o->>'id', null, null)->>'verif_k')::int <> 12 then raise exception 'ECHEC : verif_k recule'; end if;
  -- Un autre joueur ne verifie pas le combat d'un autre.
  ok := false;
  begin perform public.combat_a_verifier('00000000-0000-0000-0000-0000000015a2', o->>'id', '[]', null);
  exception when others then ok := sqlerrm = 'Ce combat n''est plus ouvert.'; end;
  if not ok then raise exception 'ECHEC : le combat d''un autre'; end if;
  -- Une partie illisible n'est pas ecrite.
  ok := false;
  begin perform public.combat_a_verifier(u, (public.combat_debut('infini', '1', 1, pg_temp.deck_de('toxique')))->>'id', '{"pas": "un tableau"}', null);
  exception when others then ok := sqlerrm = 'Partie illisible.'; end;
  if not ok then raise exception 'ECHEC : partie illisible acceptee'; end if;
  -- Un refus : rien de paye, le combat ferme, une ligne pour le Labo.
  o := public.combat_debut('infini', '5', 5, pg_temp.deck_de('toxique'));
  select shards into e0 from profiles where id = u;
  v := public.combat_refuse(u, o->>'id', 'Un coup de l''adversaire n''est pas celui qu''il aurait joué.', 17);
  select shards into e1 from profiles where id = u;
  if e1 <> e0 or not (v->>'refuse')::boolean or exists (select 1 from combats_ouverts where id = o->>'id') then
    raise exception 'ECHEC : refus (eclats % -> %, %)', e0, e1, v; end if;
  if not exists (select 1 from combats_refuses where user_id = u and mode = 'infini' and cle = '5' and coup = 17) then
    raise exception 'ECHEC : le refus n''est pas note'; end if;
  raise warning 'OK 2 : la partie ecrite une fois, les passes, le refus note';
end $t$;

-- 3. combat_fin_verifie paie ce que dit le verdict, une fois.
do $t$
declare o jsonb; v jsonb; u uuid := '00000000-0000-0000-0000-0000000015a1'; e0 int; e1 int; ok boolean;
begin
  o := public.combat_debut('infini', '4', 4, pg_temp.deck_de('toxique'));
  update combats_ouverts set debut = now() - interval '5 minutes' where id = o->>'id';
  select shards into e0 from profiles where id = u;
  v := public.combat_fin_verifie(u, o->>'id', '{"gagne": true, "tours": 9, "vaincus": 3, "touches": 4, "pv": 2}', '{"titre": "Arcade", "tours": 9, "raison": "pv"}');
  select shards into e1 from profiles where id = u;
  if e1 - e0 <> (select eclats from pve_difficultes where niveau = 4) or (v->'recompense'->>'eclats')::int <> e1 - e0 then
    raise exception 'ECHEC : paiement % (eclats % -> %)', v, e0, e1; end if;
  ok := false;
  begin perform public.combat_fin_verifie(u, o->>'id', '{"gagne": true}', null); exception when others then ok := sqlerrm = 'Ce combat n''est plus ouvert.'; end;
  if not ok then raise exception 'ECHEC : paye deux fois'; end if;
  raise warning 'OK 3 : le verdict paie, une fois';
end $t$;

-- 4. Le Raid rend son boss ; l'Epreuve, le jour de l'evenement.
do $t$
declare o jsonb; s int := raid_saison(jour_paris()); r combats_ouverts; e jsonb;
begin
  o := public.combat_debut('raid', 'p' || raid_phase(s), null, pg_temp.deck_de('toxique'));
  select * into r from combats_ouverts where id = o->>'id';
  if o->>'boss' is distinct from raid_boss(s) or r.boss is distinct from raid_boss(s) then raise exception 'ECHEC : boss du Raid % / %', o->>'boss', r.boss; end if;
  e := public.labo_evenement('jour', 3);
  o := public.combat_debut('epreuve', jour_paris()::text, null, null);
  select * into r from combats_ouverts where id = o->>'id';
  if (o->>'n')::int <> 3 or r.n <> 3 or r.deck is not null then raise exception 'ECHEC : Epreuve n % / %, deck %', o->>'n', r.n, r.deck; end if;
  if (o->>'graine')::bigint <> choc_graine(jour_paris()) then raise exception 'ECHEC : graine de l''Epreuve'; end if;
  raise warning 'OK 4 : le Raid note son boss, l''Epreuve son jour (n = 3) et impose son deck';
end $t$;

-- 5. Un defi : chaque coup note son auteur ; le verdict du serveur paie.
do $t$
declare did text; d1 jsonb := pg_temp.deck_de('toxique'); d2 jsonb := pg_temp.deck_de('deter'); x jsonb; v jsonb;
        a uuid := '00000000-0000-0000-0000-0000000015a1'; b uuid := '00000000-0000-0000-0000-0000000015a2';
begin
  perform set_config('request.jwt.claim.sub', b::text, false);
  perform public.combat_section('deter');
  perform set_config('request.jwt.claim.sub', a::text, false);
  perform public.defi_lancer('verif_deux', d1);
  select id into did from defis where de = a order by cree desc limit 1;
  perform set_config('request.jwt.claim.sub', b::text, false);
  perform public.defi_repondre(did, true, d2);
  perform public.defi_jouer(did, 0, '{"t":"choix","v":"oui"}');
  perform set_config('request.jwt.claim.sub', a::text, false);
  perform public.defi_jouer(did, 1, '{"t":"choix","v":"oui"}');
  x := public.defi_a_verifier(a, did);
  if x->'auteurs' <> '[1, 0]' or jsonb_array_length(x->'actions') <> 2 or (x->>'moi')::int <> 0 then
    raise exception 'ECHEC : defi a verifier %', x; end if;
  v := public.defi_fin_verifie(b, did, '{"gagnant": 1, "tours": 7, "fautif": null}', null);
  if (select pvp_v from combat_joueurs where user_id = b) <> 1 then raise exception 'ECHEC : la victoire verifiee de B'; end if;
  v := public.defi_fin_verifie(a, did, '{"gagnant": 1, "tours": 7, "fautif": null}', null);
  if (select pvp_d from combat_joueurs where user_id = a) <> 1 then raise exception 'ECHEC : la defaite verifiee de A'; end if;
  raise warning 'OK 5 : les auteurs des coups, le verdict paie chacun';
end $t$;
select set_config('request.jwt.claim.sub', '', false);
