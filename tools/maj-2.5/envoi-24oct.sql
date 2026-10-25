-- Envoi A : 22d_admin.sql (le Labo de la 2.5, la date de sortie), ech_admin_rejouer, fabriquer.
-- =====================================================================
--  Mate TCG Online — version 2.5 : le Labo refait, et la date de sortie
--  d'une version. A executer apres 22c_reverses.sql. Rejouable sans danger.
--
--  LA DATE DE SORTIE
--  Le site peut etre en ligne avant sa sortie (SORTIE, js/config.js) : il
--  se montre tel qu'avant, puis bascule a la minute dite. Cette minute est
--  ecrite dans le code ; si parametres.sorties en donne une pour la version
--  (cle : son numero, valeur : l'instant, ou null pour « deja sortie »),
--  c'est celle du serveur qui compte. me() l'envoie (07_vitrine.sql), et le
--  Labo la deplace avec le reste du calendrier.
--
--  LE CALENDRIER OFFICIEL de la 2.5 vit ici, et nulle part ailleurs cote
--  serveur (calendrier_officiel) : calendrier-2.5.sql l'applique, le Labo y
--  revient.
--
--  LE LABO (js/lab.js) : ce qu'un administrateur regle lui-meme, pour de vrai.
--  Chaque fonction verifie le droit (labo_garde) : cacher l'onglet ne
--  suffirait pas, c'est le serveur qui refuse.
--
--   Le serveur, pour tout le monde :
--     labo_etat()                 ce qui est en vigueur, et le calendrier officiel
--     labo_calendrier(etat, n)    poser un etat coherent de tout le calendrier :
--                                   'officiel'   les dates de la 2.5 ;
--                                   'avant'      le recap de Reflets, la 2.5 dans
--                                                n minutes (2 par defaut) ;
--                                   'defi'       la 2.5 sortie, le defi n ouvert ;
--                                   'rattrapage' les sept ouverts, la saison court ;
--                                   'fini'       la saison terminee
--     labo_decaler(heures)        avancer (positif) ou reculer la saison
--     labo_reverses(ouvertes)     ouvrir ou fermer les Reverses a la main
--     labo_ech_raz('EFFACER')     effacer essais, notes et paliers de tous les
--                                 joueurs (les gains deja verses restent)
--   Son propre compte :
--     labo_cartes(quoi)           'master' (tout sauf la carte unique),
--                                 'classiques' (les 122), 'joueurs' (ceux de
--                                 L'Echauffement), 'vider'
--     labo_monnaies(valeurs)      poser Eclats, Fragments, boosters en plus,
--                                 reserve, Prismes
--     labo_cosmetiques(ids)       des cadres (f_…) et des titres (t_…)
--     labo_ech_moi(action, ...)   ses etoiles a un defi ('etoiles'), ses essais
--                                 du jour ('essais'), tout ('raz') ; rien n'est
--                                 verse
--     labo_sauver(), labo_restaurer()  mettre son compte de cote, le remettre
--     labo_raz_moi()              repartir de zero, comme un nouveau joueur
--
--  Un apercu sans rien changer reste dans le navigateur (onglet Apercus du
--  Labo) ; ce qui passe ici est reel.
-- =====================================================================

alter table public.parametres add column if not exists sorties jsonb not null default '{}'::jsonb;

-- Une sauvegarde par administrateur : son compte tel qu'il etait.
create table if not exists public.labo_sauvegardes (
  user_id uuid primary key references public.profiles on delete cascade,
  le      timestamptz not null default now(),
  contenu jsonb not null
);
alter table public.labo_sauvegardes enable row level security;
-- Aucune policy : seules les fonctions du Labo y touchent.
revoke all on public.labo_sauvegardes from anon, authenticated;

-- ---------------------------------------------------------------- le garde
-- L'appelant, s'il est administrateur ; sinon, rien ne passe.
create or replace function public.labo_garde() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return p;
end $$;

-- ------------------------------------------------------ le calendrier officiel
-- Heure de Paris : vendredi 23 octobre minuit (heure d'ete), dimanche 25
-- minuit (heure d'hiver, apres le changement d'heure), mercredi 4 novembre.
create or replace function public.calendrier_officiel() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'reflets_fin',  timestamptz '2026-10-24 00:00:00+02',
    'recap_jusqua', timestamptz '2026-10-26 00:00:00+01',
    'saison_debut', timestamptz '2026-10-26 00:00:00+01',
    'saison_fin',   timestamptz '2026-11-04 00:00:00+01',
    'reverses_des', timestamptz '2026-10-26 00:00:00+01',
    'sortie_25',    timestamptz '2026-10-26 00:00:00+01')
$$;

-- Poser tout le calendrier d'un coup : la fin de Reflets et de son recap,
-- la saison de L'Echauffement, l'ouverture des Reverses (et plus
-- d'ouverture a la main), la sortie de la 2.5.
create or replace function public.poser_calendrier(p_reflets_fin timestamptz, p_recap timestamptz,
  p_saison timestamptz, p_saison_fin timestamptz, p_reverses timestamptz, p_sortie timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update evenements
     set debut = least(debut, p_reflets_fin - interval '1 day'), fin = p_reflets_fin, recap_jusqua = p_recap
   where code = 'reflets';
  insert into ech_saison (id, debut, fin) values (1, p_saison, p_saison_fin)
    on conflict (id) do update set debut = excluded.debut, fin = excluded.fin;
  update parametres
     set reverses_des = p_reverses, fabrication_reverse = false,
         sorties = sorties || jsonb_build_object('2.5', p_sortie)
   where id = 1;
end $$;

create or replace function public.calendrier_officiel_poser() returns void
language plpgsql security definer set search_path = public as $$
declare o jsonb := calendrier_officiel();
begin
  perform poser_calendrier((o->>'reflets_fin')::timestamptz, (o->>'recap_jusqua')::timestamptz,
    (o->>'saison_debut')::timestamptz, (o->>'saison_fin')::timestamptz,
    (o->>'reverses_des')::timestamptz, (o->>'sortie_25')::timestamptz);
end $$;

-- ------------------------------------------------------------ l'etat du jeu
create or replace function public.labo_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  return jsonb_build_object(
    'serveur', now(),
    'officiel', calendrier_officiel(),
    'reflets', (select jsonb_build_object('debut', e.debut, 'fin', e.fin,
                         'recap_jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
                  from evenements e where e.code = 'reflets' order by e.fin desc limit 1),
    'sortie', (select sorties -> '2.5' from parametres where id = 1),
    'saison', (select jsonb_build_object('debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert())
                 from ech_saison s where s.id = 1),
    'reverses', (select jsonb_build_object('des', reverses_des, 'manuel', fabrication_reverse,
                          'ouvertes', reverses_ouvertes())
                   from parametres where id = 1),
    'chasse', chasse_etat(),
    'recharge', jsonb_build_object('minutes', minutes_recharge(), 'cap', cfg('ticket_cap')),
    'recharges', coalesce((select jsonb_agg(jsonb_build_object('titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                                   'minutes', e.ticket_minutes) order by e.debut)
                             from evenements e where e.code is null and e.fin > now()), '[]'::jsonb),
    'echauffement', ech_admin(),
    'joueurs', (select count(*) from profiles),
    'sauvegarde', (select jsonb_build_object('le', s.le, 'cartes', jsonb_array_length(s.contenu -> 'collection'))
                     from labo_sauvegardes s where s.user_id = p));
end $$;

-- ------------------------------------------------------- naviguer les etats
create or replace function public.labo_calendrier(p_etat text, p_n integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d timestamptz; n int;
begin
  perform labo_garde();
  if p_etat = 'officiel' then
    perform calendrier_officiel_poser();
  elsif p_etat = 'avant' then
    -- Le recap de Reflets court ; la 2.5 sort dans n minutes.
    n := coalesce(p_n, 2);
    if n < 1 or n > 10080 then raise exception 'Entre 1 minute et 7 jours.'; end if;
    d := now() + make_interval(mins => n);
    perform poser_calendrier(now() - interval '1 day', d, d, d + interval '9 days', d, d);
  elsif p_etat in ('defi', 'rattrapage', 'fini') then
    -- La 2.5 est sortie, au debut de la saison ; le recap avait dure deux jours.
    n := case p_etat when 'defi' then coalesce(p_n, 1) when 'rattrapage' then 8 else 10 end;
    if p_etat = 'defi' and (n < 1 or n > 7) then raise exception 'Un défi de 1 à 7.'; end if;
    d := now() - make_interval(days => n - 1) - interval '1 hour';
    perform poser_calendrier(d - interval '2 days', d, d, d + interval '9 days', d, d);
  else
    raise exception 'État inconnu.';
  end if;
  return labo_etat();
end $$;

-- Avancer la saison de p_heures (24 : un defi de plus), ou la reculer.
create or replace function public.labo_decaler(p_heures integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform labo_garde();
  if p_heures is null or p_heures = 0 or abs(p_heures) > 336 then raise exception 'De 1 à 336 heures.'; end if;
  update ech_saison set debut = debut - make_interval(hours => p_heures),
                        fin = fin - make_interval(hours => p_heures)
   where id = 1;
  return labo_etat();
end $$;

-- Les Reverses a la main : ouvertes tout de suite, ou fermees sans date (le
-- calendrier officiel remet la date).
create or replace function public.labo_reverses(p_ouvertes boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform labo_garde();
  if p_ouvertes then
    update parametres set fabrication_reverse = true where id = 1;
  else
    update parametres set fabrication_reverse = false, reverses_des = null where id = 1;
  end if;
  return labo_etat();
end $$;

-- Remettre L'Echauffement a zero pour tout le monde. Ce qui a ete verse
-- (Eclats, boosters, titre) reste : on ne reprend rien a un joueur.
create or replace function public.labo_ech_raz(p_confirmation text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int;
begin
  perform labo_garde();
  if p_confirmation is distinct from 'EFFACER' then raise exception 'Confirmation manquante.'; end if;
  delete from ech_essais where true;
  get diagnostics a = row_count;
  delete from ech_scores where true;
  get diagnostics b = row_count;
  delete from ech_paliers where true;
  get diagnostics c = row_count;
  return jsonb_build_object('essais', a, 'notes', b, 'paliers', c, 'etat', labo_etat());
end $$;

-- --------------------------------------------------------- son propre compte
-- Les cartes : le master set (tout le catalogue, sauf la carte unique, qui
-- n'existe qu'en un exemplaire), les 122, les Joueurs de L'Echauffement, ou
-- plus rien. Une carte deja la garde ses exemplaires.
create or replace function public.labo_cartes(p_quoi text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  if p_quoi = 'vider' then
    -- Ses demandes d'echange en attente n'ont plus d'objet.
    update trades set status = 'cancelled', resolved_at = now()
     where status = 'pending' and (from_user = p or to_user = p);
    delete from collection where user_id = p;
  elsif p_quoi in ('master', 'classiques', 'joueurs') then
    insert into collection (user_id, card_id, qty)
    select p, k.id, 1 from cards k
     where case p_quoi when 'master' then k.rar <> 'UN'
                       when 'classiques' then not k.promo
                       else k.id in (select card_id from ech_joueurs) end
    on conflict (user_id, card_id) do update set qty = greatest(collection.qty, 1);
  else
    raise exception 'Choix inconnu.';
  end if;
  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

-- Les monnaies, posees a la valeur dite : eclats, fragments, boosters (en
-- plus, hors reserve), reserve, prismes (de l'evenement en cours, ou du
-- dernier). Une cle absente ne change rien.
create or replace function public.labo_monnaies(p_valeurs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); k text; v numeric; lim numeric; ev text;
begin
  if p_valeurs is null or jsonb_typeof(p_valeurs) <> 'object' then raise exception 'Valeurs invalides.'; end if;
  for k in select jsonb_object_keys(p_valeurs) loop
    if k not in ('eclats', 'fragments', 'boosters', 'reserve', 'prismes') then raise exception 'Valeur inconnue : %.', k; end if;
    if jsonb_typeof(p_valeurs -> k) <> 'number' then raise exception 'Un nombre est attendu.'; end if;
    v := (p_valeurs ->> k)::numeric;
    lim := case k when 'reserve' then 99 when 'boosters' then 999 else 10000000 end;
    if v < 0 or v > lim then raise exception 'Valeur hors limites : %.', k; end if;
  end loop;
  update profiles set
    shards         = coalesce(round((p_valeurs ->> 'eclats')::numeric)::int, shards),
    fragments      = coalesce(round((p_valeurs ->> 'fragments')::numeric)::int, fragments),
    boosters_bonus = coalesce(round((p_valeurs ->> 'boosters')::numeric)::int, boosters_bonus),
    tickets_offerts = case when p_valeurs ? 'boosters'
                           then least(tickets_offerts, round((p_valeurs ->> 'boosters')::numeric)::int)
                           else tickets_offerts end,
    tickets        = coalesce(round((p_valeurs ->> 'reserve')::numeric)::int, tickets),
    last_tick      = case when p_valeurs ? 'reserve' then now() else last_tick end
   where id = p;
  if p_valeurs ? 'prismes' then
    ev := coalesce(evenement_en_cours(),
                   (select e.code from evenements e where e.code is not null order by e.fin desc limit 1));
    if ev is null then raise exception 'Aucun événement : pas de Prismes à poser.'; end if;
    insert into evt_comptes (user_id, evenement, solde, total)
    values (p, ev, round((p_valeurs ->> 'prismes')::numeric)::int, round((p_valeurs ->> 'prismes')::numeric)::int)
    on conflict (user_id, evenement) do update
      set solde = excluded.solde, total = greatest(evt_comptes.total, excluded.solde);
  end if;
  return me();
end $$;

-- Des cadres et des titres, par leur identifiant (le navigateur envoie ceux
-- de FRAMES et TITRES, js/config.js).
create or replace function public.labo_cosmetiques(p_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); x text;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then
    raise exception 'Liste vide ou trop longue.';
  end if;
  foreach x in array p_ids loop
    if x !~ '^[ft]_[a-z0-9_]{1,40}$' then raise exception 'Identifiant invalide : %.', x; end if;
    insert into inventory (user_id, item_id, qty) values (p, x, 1)
      on conflict (user_id, item_id) do update set qty = greatest(inventory.qty, 1);
  end loop;
  return me();
end $$;

-- L'Echauffement, sur son compte : ses etoiles a un defi (0 les efface),
-- ses essais du jour, ou tout. Rien n'est verse : c'est pour voir.
create or replace function public.labo_ech_moi(p_action text, p_jour integer default null,
  p_etoiles integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  if p_action = 'etoiles' then
    if p_jour is null or p_jour < 1 or p_jour > 7 then raise exception 'Un défi de 1 à 7.'; end if;
    if p_etoiles is null or p_etoiles < 0 or p_etoiles > 3 then raise exception 'De 0 à 3 étoiles.'; end if;
    if p_etoiles = 0 then
      delete from ech_scores where user_id = p and jour = p_jour;
    else
      insert into ech_scores (user_id, jour, etoiles, equipe, tours) values (p, p_jour, p_etoiles, '[]'::jsonb, 0)
        on conflict (user_id, jour) do update set etoiles = excluded.etoiles, le = now();
    end if;
  elsif p_action = 'essais' then
    delete from ech_essais
     where user_id = p and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  elsif p_action = 'raz' then
    delete from ech_essais where user_id = p;
    delete from ech_scores where user_id = p;
    delete from ech_paliers where user_id = p;
  else
    raise exception 'Action inconnue.';
  end if;
  return ech_etat_de(p);
end $$;

-- Ce qu'une sauvegarde emporte, et ce que « repartir de zero » efface : tout
-- ce qui est a soi, sauf les amis, la boite de reception et les echanges.
create or replace function public.labo_tables() returns text[]
language sql immutable as $$
  select array['collection', 'inventory', 'quest_progress', 'evt_comptes', 'evt_piste_prises',
               'gardes', 'favoris', 'devine_illu', 'ech_scores', 'ech_paliers', 'ech_essais',
               'tirages', 'recyclages']
$$;

create or replace function public.labo_sauver() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); c jsonb; t text; r jsonb;
begin
  c := jsonb_build_object('profil', (select to_jsonb(x) from profiles x where x.id = p));
  foreach t in array labo_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into r using p;
    c := c || jsonb_build_object(t, r);
  end loop;
  insert into labo_sauvegardes (user_id, le, contenu) values (p, now(), c)
    on conflict (user_id) do update set le = excluded.le, contenu = excluded.contenu;
  return labo_etat();
end $$;

-- Remettre le compte tel qu'il etait a la sauvegarde. Les lignes qui ne
-- tiennent plus (une carte, une quete, un defi disparus depuis) sont laissees.
create or replace function public.labo_restaurer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); s labo_sauvegardes; t text; r profiles; filtre text;
begin
  select * into s from labo_sauvegardes where user_id = p;
  if not found then raise exception 'Aucune sauvegarde.'; end if;
  foreach t in array labo_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using p;
    filtre := case
      when t in ('collection', 'gardes', 'favoris', 'recyclages') then 'where x.card_id in (select id from public.cards)'
      when t = 'quest_progress' then 'where x.quest_id in (select id from public.quests)'
      when t in ('ech_scores', 'ech_essais') then 'where x.jour in (select jour from public.ech_defis)'
      else '' end;
    execute format('insert into public.%I overriding system value select x.* from jsonb_populate_recordset(null::public.%I, $1) x %s',
                   t, t, filtre)
      using coalesce(s.contenu -> t, '[]'::jsonb);
  end loop;
  r := jsonb_populate_record(null::public.profiles, s.contenu -> 'profil');
  update profiles set
    shards = coalesce(r.shards, shards), fragments = coalesce(r.fragments, fragments),
    tickets = coalesce(r.tickets, tickets), last_tick = coalesce(r.last_tick, last_tick),
    trade_free_at = coalesce(r.trade_free_at, trade_free_at),
    boosters_bonus = coalesce(r.boosters_bonus, boosters_bonus), tickets_offerts = coalesce(r.tickets_offerts, tickets_offerts),
    packs_opened = coalesce(r.packs_opened, packs_opened), trades_done = coalesce(r.trades_done, trades_done),
    streak = coalesce(r.streak, streak), last_checkin = r.last_checkin, serie_max = coalesce(r.serie_max, serie_max),
    fabrications = coalesce(r.fabrications, fabrications), avatar = coalesce(r.avatar, avatar), frame = coalesce(r.frame, frame),
    titre = r.titre, banniere = r.banniere, devise = r.devise,
    vitrine = coalesce(r.vitrine, vitrine), garder = coalesce(r.garder, garder)
   where id = p;
  return me();
end $$;

-- Repartir de zero, comme un nouveau joueur : tout ce que labo_tables()
-- liste, et les compteurs du profil. Garde le compte, le pseudo, les amis,
-- la boite de reception, les droits. Penser a labo_sauver() avant.
create or replace function public.labo_raz_moi() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); t text;
begin
  update trades set status = 'cancelled', resolved_at = now()
   where status = 'pending' and (from_user = p or to_user = p);
  foreach t in array labo_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using p;
  end loop;
  update profiles set
    shards = 0, fragments = 0, tickets = cfg('ticket_cap'), last_tick = now(), trade_free_at = now(),
    boosters_bonus = 0, tickets_offerts = 0, packs_opened = 0, trades_done = 0, streak = 0,
    last_checkin = null, serie_max = 0, fabrications = 0, avatar = 'star', frame = 'default',
    titre = null, banniere = null, devise = null, vitrine = '{}', garder = '{}'
   where id = p;
  return me();
end $$;

revoke all on function public.labo_garde, public.calendrier_officiel, public.poser_calendrier,
  public.calendrier_officiel_poser, public.labo_tables from public, anon, authenticated;
revoke all on function public.labo_etat, public.labo_calendrier, public.labo_decaler, public.labo_reverses,
  public.labo_ech_raz, public.labo_cartes, public.labo_monnaies, public.labo_cosmetiques, public.labo_ech_moi,
  public.labo_sauver, public.labo_restaurer, public.labo_raz_moi from public, anon;
grant execute on function public.labo_etat, public.labo_calendrier, public.labo_decaler, public.labo_reverses,
  public.labo_ech_raz, public.labo_cartes, public.labo_monnaies, public.labo_cosmetiques, public.labo_ech_moi,
  public.labo_sauver, public.labo_restaurer, public.labo_raz_moi to authenticated;


-- Rejouer : efface les essais du jour de l'administrateur lui-meme, pour
-- tester sans attendre le lendemain. Ses notes et ses gains restent.
create or replace function public.ech_admin_rejouer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); n int;
begin
  if p is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  delete from ech_essais
   where user_id = p and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  get diagnostics n = row_count;
  return jsonb_build_object('effaces', n, 'etat', ech_etat_de(p));
end $$;
revoke all on function public.ech_admin_rejouer from public, anon;
grant execute on function public.ech_admin_rejouer to authenticated;

create or replace function public.fabriquer(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; cout int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo and not k.reverse then raise exception 'Cette carte ne se fabrique pas.'; end if;
  cout := cfg('fabrication_' || k.rar);
  -- Les Reverses (version 2.0) : fermees au lancement, sinon les Fragments
  -- accumules rempliraient la collection Reverse d'un coup ; ouvertes a la
  -- sortie de la 2.5, au prix de leur vraie rarete (version 2.5 :
  -- reverses_ouvertes et prix_reverse, 22c_reverses.sql).
  if k.reverse then
    if not reverses_ouvertes() then
      raise exception 'La fabrication des Reverses n''est pas encore ouverte.';
    end if;
    cout := prix_reverse(k.rar);
  end if;
  if cout is null then raise exception 'Cette carte ne se fabrique pas.'; end if;

  select fragments into reste from profiles where id = p for update;
  if exists (select 1 from collection where user_id = p and card_id = p_carte and qty > 0) then
    raise exception 'Tu possèdes déjà cette carte.';
  end if;
  if reste < cout then raise exception 'Pas assez de Fragments.'; end if;

  update profiles set fragments = fragments - cout, fabrications = fabrications + 1 where id = p;
  insert into collection (user_id, card_id, qty) values (p, p_carte, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

-- Controle : chaque fonction de cet envoi doit avoir exactement l'empreinte et
-- les droits d'une installation neuve de la 2.5. Au moindre ecart, tout
-- l'envoi est annule.
do $verif$
declare r record; n int := 0;
begin
  for r in select a.nom, a.h, a.droits,
                  (select md5(pg_get_functiondef(p.oid)) from pg_proc p
                    where p.pronamespace = 'public'::regnamespace
                      and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = a.nom) as h_reel,
                  (select has_function_privilege('anon', p.oid, 'execute')::text || '/' || has_function_privilege('authenticated', p.oid, 'execute')::text
                     from pg_proc p where p.pronamespace = 'public'::regnamespace
                      and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = a.nom) as d_reel
             from (values
    ('labo_garde()', '92c5c0bf530376603ac0efccf8e4a1f1', 'false/false'),
    ('calendrier_officiel()', 'aaa78f8bf60e0e04f4cefe40bf71d2cc', 'false/false'),
    ('poser_calendrier(p_reflets_fin timestamp with time zone, p_recap timestamp with time zone, p_saison timestamp with time zone, p_saison_fin timestamp with time zone, p_reverses timestamp with time zone, p_sortie timestamp with time zone)', 'cc231fd65feb7061410916a2865831a2', 'false/false'),
    ('calendrier_officiel_poser()', '2f22a38fa39a8934ba7ce0193854dde0', 'false/false'),
    ('labo_etat()', 'aecc4e868d160e09a4a8b7e261377752', 'false/true'),
    ('labo_calendrier(p_etat text, p_n integer)', '296378b179759e8888e950ef30eace6d', 'false/true'),
    ('labo_decaler(p_heures integer)', '5f278957d8939243a281b7506950c026', 'false/true'),
    ('labo_reverses(p_ouvertes boolean)', '49b73209150347f5c5910de42a9e4ea1', 'false/true'),
    ('labo_ech_raz(p_confirmation text)', '9fd848f2fa7179f24c513f1b5fc9db42', 'false/true'),
    ('labo_cartes(p_quoi text)', 'dcb124e67a1ab79431a7672d1ca935c4', 'false/true'),
    ('labo_monnaies(p_valeurs jsonb)', 'b55974850c0953fed901353068fd4950', 'false/true'),
    ('labo_cosmetiques(p_ids text[])', '51ea80d1c6d360a48e42efb6a5bdbee1', 'false/true'),
    ('labo_ech_moi(p_action text, p_jour integer, p_etoiles integer)', '8238bd77503fc7bc71f61be5a2c06dde', 'false/true'),
    ('labo_tables()', '8540169aec5a393c82ce284b40211ec1', 'false/false'),
    ('labo_sauver()', 'bfc1ee998791afd88a3ae8e3947dc46c', 'false/true'),
    ('labo_restaurer()', '7fdc523569e2a1a01b6447009137e190', 'false/true'),
    ('labo_raz_moi()', 'd7798be7f22929c9250e7b18f739c6d9', 'false/true'),
    ('ech_admin_rejouer()', 'e470fa780f0d0fcbd27c4ba45c0983a3', 'false/true'),
    ('fabriquer(p_carte text)', 'eb4b763a5eac96c1701c9924b84a75b4', 'false/true')) as a(nom, h, droits) loop
    if r.h_reel is distinct from r.h or r.d_reel is distinct from r.droits then
      raise exception 'ECART sur % : empreinte % (attendue %), droits % (attendus %)', r.nom, r.h_reel, r.h, r.d_reel, r.droits;
    end if;
    n := n + 1;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'parametres' and column_name = 'sorties') then
    raise exception 'ECART : parametres.sorties manque'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.labo_sauvegardes'::regclass)
     or has_table_privilege('authenticated', 'public.labo_sauvegardes', 'select') or has_table_privilege('anon', 'public.labo_sauvegardes', 'select') then
    raise exception 'ECART : labo_sauvegardes mal protegee'; end if;
  raise notice 'controle ok : % fonctions', n;
end $verif$;
