-- 3.0.12 : les règles officielles côté serveur (deck_erreur, cle_copie, limite_copies, starters).
do $$
declare e text; nb int; d jsonb; c jsonb; u uuid := gen_random_uuid();
begin
  -- Le Club : 40 cartes.
  c := jsonb_build_object('c010', 3, 'c011', 3, 'c012', 3, 'c013', 3, 'c073', 3, 'c078', 3, 'c074', 3, 'c085', 3, 'c087', 3, 'c088', 3, 'c014', 3, 'c016', 3, 'c083', 1); select deck_erreur(u, c, '{"rose":10}'::jsonb, true, c) into e;
  raise notice '37 cartes -> %', e;
  if e is null or e not like '%40%' then raise exception 'un Club de 37 devait être refusé (40)'; end if;
  c := jsonb_build_object('c010', 3, 'c011', 3, 'c012', 3, 'c013', 3, 'c073', 3, 'c078', 3, 'c074', 3, 'c085', 3, 'c087', 3, 'c088', 3, 'c014', 3, 'c016', 3, 'c083', 3, 'c097', 1); select deck_erreur(u, c, '{"rose":10}'::jsonb, true, c) into e;
  raise notice '40 cartes -> %', coalesce(e, 'ok');
  if e is not null then raise exception 'un Club de 40 valide refusé : %', e; end if;
  -- Trois exemplaires, toutes versions comprises (Reverse r010 = c010).
  c := jsonb_build_object('c010', 3, 'r010', 1, 'c011', 3, 'c012', 3, 'c013', 3, 'c073', 3, 'c078', 3, 'c074', 3, 'c085', 3, 'c087', 3, 'c088', 3, 'c014', 3, 'c016', 3, 'c083', 3); select deck_erreur(u, c, '{"rose":10}'::jsonb, true, c) into e;
  raise notice '4 Broken Brawks (3 + 1 Reverse) -> %', e;
  if e is null then raise exception '4 exemplaires (3 + Reverse) devaient être refusés'; end if;
  -- Même nom, même couleur : Le Marionnettiste #121 et P06.
  if cle_copie('c121') <> cle_copie('p06') then raise exception 'c121 et p06 : même clé attendue'; end if;
  if cle_copie('c072') <> cle_copie('c110') then raise exception 'c072 et c110 (Leakof) : même clé attendue'; end if;
  if cle_copie('c015') = cle_copie('c053') then raise exception 'Ravitaillement Rose et Mauve : clés différentes attendues'; end if;
  if limite_copies('c113') <> 3 or limite_copies('c010') <> 3 then raise exception 'limite_copies doit valoir 3'; end if;
  -- Les Starters : 40 cartes chacun, valides.
  for d in select jsonb_object_agg(s.card_id, s.n) from starters s group by s.section loop
    select deck_erreur(u, d, '{"rose":10}'::jsonb, true, d) into e;
    if e is not null then raise exception 'Starter invalide : %', e; end if;
  end loop;
  select count(*) into nb from (select st.section, sum(st.n) tot from starters st group by st.section) x where x.tot = 40;
  if nb <> 2 then raise exception 'les deux Starters doivent compter 40 cartes (%)', nb; end if;
  raise warning 'OK : règles officielles (Club de 40, trois exemplaires par nom et couleur, Starters)';
end $$;
