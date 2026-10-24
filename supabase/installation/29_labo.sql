-- =====================================================================
--  Mate TCG Online — version 3.0 : le Labo
--  A executer apres 28_maitrise.sql. Rejouable sans danger.
--
--  Ce qu'un administrateur regle lui-meme, pour de vrai, depuis l'onglet
--  Labo (js/lab.js). Chaque fonction verifie le droit (labo_garde) : cacher
--  l'onglet ne suffirait pas, c'est le serveur qui refuse.
--
--  La base de la 3.0 sera celle de la 2.5, qui a deja un Labo
--  (supabase/22d_admin.sql de la branche version-2.5). Ce fichier le
--  remplace : memes noms et memes arguments quand le geste est le meme
--  (PostgreSQL refuse de renommer un argument), et il retire ce qui n'a plus
--  d'objet en 3.0 (le calendrier de la 2.5, les outils de L'Echauffement).
--  La table des sauvegardes est la meme : une sauvegarde faite en 2.5 se
--  restaure en 3.0 (ce qu'elle ne contient pas reste tel quel).
--
--   Le serveur, pour tout le monde :
--     labo_etat()                    ce qui est en vigueur
--     labo_evenement(etat, n)        le Choc des Sections dans un etat coherent :
--                                      'avant'  il commence dans n minutes ;
--                                      'jour'   il en est a son n-ieme jour (1 a 21) ;
--                                      'recap'  il est fini, son recap court ;
--                                      'fini'   son recap aussi est fini.
--                                    Les autres evenements (Reflets) sont clos.
--     labo_decaler(heures)           avancer (positif) ou reculer le Choc
--     labo_evenement_raz('EFFACER')  effacer ce que tout le monde a fait pendant
--                                    le Choc (les gains deja verses restent)
--     labo_reverses(ouvertes)        ouvrir ou fermer les Reverses a la main
--     labo_raid(phase)               la saison du Raid en cours a la phase dite
--                                    (7 : les six abattues, l'Infini)
--     labo_raid_echelle(x)           l'echelle des seuils du Raid
--     labo_raid_raz('EFFACER')       la saison du Raid en cours a zero
--   Son propre compte :
--     labo_cartes(quoi)              'master', 'classiques', 'combat', 'vider'
--     labo_monnaies(valeurs)         Eclats, Fragments, boosters en plus, reserve,
--                                    monnaie de l'evenement, niveau de combattant
--     labo_cosmetiques(ids)          cadres, titres, tapis, sleeves
--     labo_combats_moi(action, v)    sa Section, sa campagne, ses essais et
--                                    plafonds du jour, ses maitrises
--     labo_sauver(), labo_restaurer()  mettre son compte de cote, le remettre
--     labo_raz_moi()                 repartir de zero, comme un nouveau joueur
--
--  Rien de ce qui touche son compte ne verse de recompense : poser un niveau
--  ne paie pas ses paliers, finir la campagne ne donne pas la Promo de
--  l'autre Section. Un apercu sans rien changer reste dans le navigateur
--  (onglet Apercus du Labo).
-- =====================================================================

-- Ce que la 2.5 avait et que la 3.0 n'a plus (22d_admin.sql de la 2.5).
drop function if exists public.labo_calendrier(text, integer);
drop function if exists public.labo_ech_raz(text);
drop function if exists public.labo_ech_moi(text, integer, integer);
drop function if exists public.calendrier_officiel_poser();
drop function if exists public.poser_calendrier(timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz);
drop function if exists public.calendrier_officiel();
-- Le mode sans fin de L'Echauffement (22f_sans-fin.sql de la 2.5 : un defi par
-- jour, sans date de fin, « en attendant la 3.0 ») s'arrete avec elle : sans
-- ces trois appels, il continuerait de verser des Eclats a qui l'appelle a la
-- main. Ses tables restent (ech_sf_*, l'historique) ; « repartir de zero » et
-- les deux remises a zero les vident. Le declencheur qui calait la ligne de
-- l'evenement sur la saison (22e de la 2.5) part avec sa fonction.
drop function if exists public.ech_sf_etat();
drop function if exists public.ech_sf_commencer(jsonb);
drop function if exists public.ech_sf_terminer(bigint, jsonb);
drop function if exists public.ech_sf_etat_de(uuid);
drop function if exists public.ech_sf_essais_du_jour(uuid, date);
drop function if exists public.ech_sf_niveau(date);
drop function if exists public.ech_sf_defi(date);
drop function if exists public.ech_sf_ordre(date);
drop function if exists public.ech_sf_premier();
drop function if exists public.ech_saison_evenement() cascade;

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

-- ------------------------------------------------------------ l'etat du jeu
create or replace function public.labo_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p uuid := labo_garde(); sa int := raid_saison(jour_paris());
begin
  return jsonb_build_object(
    'serveur', now(),
    'choc', (select jsonb_build_object('debut', e.debut, 'fin', e.fin,
                       'recap_jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
               from evenements e where e.code = 'choc' order by e.fin desc limit 1),
    'en_cours', evenement_en_cours(),
    'recent', evenement_recent(),
    'participation', jsonb_build_object(
      'joueurs', (select count(*) from evt_comptes where evenement = 'choc' and total > 0),
      'etincelles', (select coalesce(sum(total), 0) from evt_comptes where evenement = 'choc'),
      'epreuves', (select count(*) from choc_epreuves),
      'gagnees', (select count(*) from choc_epreuves where gagnee),
      'raid', (select coalesce(sum(degats), 0) from choc_joueurs)),
    'raid', jsonb_build_object(
      'saison', sa, 'debut', raid_saison_debut(sa), 'fin', raid_saison_debut(sa + 1),
      'degats', coalesce((select degats from raid_saisons where n = sa), 0),
      'phase', raid_phase(sa),
      'seuils', (select jsonb_agg(raid_seuil(k) order by k) from generate_series(1, 6) k),
      'echelle', (select raid_echelle from parametres where id = 1),
      'joueurs', (select count(*) from raid_participants where saison = sa and combats > 0)),
    'reverses', (select jsonb_build_object('des', reverses_des, 'manuel', fabrication_reverse,
                          'ouvertes', reverses_ouvertes())
                   from parametres where id = 1),
    'sections', (select jsonb_build_object('toxique', count(*) filter (where section = 'toxique'),
                                           'deter', count(*) filter (where section = 'deter'))
                   from combat_joueurs),
    'chasse', chasse_etat(),
    'recharge', jsonb_build_object('minutes', minutes_recharge(), 'cap', cfg('ticket_cap')),
    'recharges', coalesce((select jsonb_agg(jsonb_build_object('titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                                   'minutes', e.ticket_minutes) order by e.debut)
                             from evenements e where e.code is null and e.fin > now()), '[]'::jsonb),
    'joueurs', (select count(*) from profiles),
    'sauvegarde', (select jsonb_build_object('le', s.le, 'version', coalesce(s.contenu ->> 'version', '2.5'),
                            'cartes', jsonb_array_length(coalesce(s.contenu -> 'collection', '[]'::jsonb)))
                     from labo_sauvegardes s where s.user_id = p));
end $$;

-- ------------------------------------------------- le Choc des Sections
-- Trois semaines, comme a son ouverture (fin de 25_choc.sql). La ligne est
-- creee si la base n'en a pas encore.
create or replace function public.labo_evenement(p_etat text, p_n integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d timestamptz; n int; duree interval := interval '21 days'; id_choc bigint;
begin
  perform labo_garde();
  if p_etat = 'avant' then
    n := coalesce(p_n, 2);
    if n < 1 or n > 10080 then raise exception 'Entre 1 minute et 7 jours.'; end if;
    d := now() + make_interval(mins => n);
  elsif p_etat = 'jour' then
    n := coalesce(p_n, 1);
    if n < 1 or n > 21 then raise exception 'Un jour de 1 à 21.'; end if;
    d := now() - make_interval(days => n - 1) - interval '1 hour';
  elsif p_etat = 'recap' then
    -- Fini depuis une heure : le recap court encore pres de trois jours.
    d := now() - duree - interval '1 hour';
  elsif p_etat = 'fini' then
    d := now() - duree - interval '4 days';
  else
    raise exception 'État inconnu.';
  end if;
  -- Les autres evenements (Reflets) : clos, et leur recap aussi.
  update evenements set fin = least(fin, now()), recap_jusqua = now()
   where code is not null and code <> 'choc' and debut <= now()
     and coalesce(recap_jusqua, fin + interval '3 days') > now();
  select e.id into id_choc from evenements e where e.code = 'choc' order by e.fin desc limit 1;
  if id_choc is null then
    insert into evenements (titre, texte, debut, fin, code) values ('Le Choc des Sections',
      'La version 3.0 : le Raid contre The French Sorcerer et l''Épreuve du jour.', d, d + duree, 'choc');
  else
    update evenements set debut = d, fin = d + duree, recap_jusqua = null where id = id_choc;
  end if;
  return labo_etat();
end $$;

-- Avancer le Choc de p_heures (24 : un jour de plus), ou le reculer.
create or replace function public.labo_decaler(p_heures integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare id_choc bigint;
begin
  perform labo_garde();
  if p_heures is null or p_heures = 0 or abs(p_heures) > 336 then raise exception 'De 1 à 336 heures.'; end if;
  select e.id into id_choc from evenements e where e.code = 'choc' order by e.fin desc limit 1;
  if id_choc is null then raise exception 'Pas de Choc à décaler : pose d''abord un état.'; end if;
  update evenements set debut = debut - make_interval(hours => p_heures),
                        fin = fin - make_interval(hours => p_heures),
                        recap_jusqua = recap_jusqua - make_interval(hours => p_heures)
   where id = id_choc;
  return labo_etat();
end $$;

-- Effacer ce que tout le monde a fait pendant le Choc : l'Epreuve du jour,
-- les degats comptes pour le recap, les Etincelles, le Pass et les quetes de
-- l'evenement. Ce qui a ete verse (Eclats, boosters, cosmetiques) reste : on
-- ne reprend rien a un joueur. Le Raid a sa propre remise a zero.
create or replace function public.labo_evenement_raz(p_confirmation text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; e int;
begin
  perform labo_garde();
  if p_confirmation is distinct from 'EFFACER' then raise exception 'Confirmation manquante.'; end if;
  delete from choc_epreuves where true;
  get diagnostics a = row_count;
  delete from choc_joueurs where true;
  get diagnostics b = row_count;
  delete from evt_comptes where evenement = 'choc';
  get diagnostics c = row_count;
  delete from evt_piste_prises where evenement = 'choc';
  get diagnostics d = row_count;
  delete from quest_progress where quest_id in (select id from quests where evenement = 'choc');
  get diagnostics e = row_count;
  return jsonb_build_object('epreuves', a, 'raid', b, 'comptes', c, 'pass', d, 'quetes', e, 'etat', labo_etat());
end $$;

-- Les Reverses a la main : ouvertes tout de suite, ou fermees sans date.
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

-- ---------------------------------------------------------------- le Raid
-- La saison en cours a la phase p_phase : les degats du serveur sont poses
-- au seuil de la phase d'avant (7 : les six abattues, l'Infini). Les coffres
-- deja ouverts le restent.
create or replace function public.labo_raid(p_phase integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sa int := raid_saison(jour_paris()); d int;
begin
  perform labo_garde();
  if p_phase is null or p_phase < 1 or p_phase > 7 then raise exception 'Une phase de 1 à 7.'; end if;
  d := case when p_phase = 1 then 0 else raid_seuil(p_phase - 1) end;
  insert into raid_saisons (n, degats) values (sa, d) on conflict (n) do update set degats = excluded.degats;
  delete from raid_tombees where saison = sa and phase >= p_phase;
  insert into raid_tombees (saison, phase) select sa, k from generate_series(1, p_phase - 1) k
    on conflict do nothing;
  return labo_etat();
end $$;

create or replace function public.labo_raid_echelle(p_echelle numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform labo_garde();
  if p_echelle is null or p_echelle < 0.05 or p_echelle > 20 then raise exception 'Une échelle de 0,05 à 20.'; end if;
  update parametres set raid_echelle = p_echelle where id = 1;
  return labo_etat();
end $$;

-- La saison en cours a zero : les degats, les phases, la part de chacun, les
-- coffres ouverts, les tentatives du jour. Ce qui a ete verse reste.
create or replace function public.labo_raid_raz(p_confirmation text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sa int := raid_saison(jour_paris()); a int; b int;
begin
  perform labo_garde();
  if p_confirmation is distinct from 'EFFACER' then raise exception 'Confirmation manquante.'; end if;
  delete from raid_participants where saison = sa;
  get diagnostics a = row_count;
  delete from raid_pris where saison = sa;
  get diagnostics b = row_count;
  delete from raid_tombees where saison = sa;
  delete from raid_tentatives where jour = jour_paris();
  update raid_saisons set degats = 0 where n = sa;
  return jsonb_build_object('joueurs', a, 'coffres', b, 'etat', labo_etat());
end $$;

-- --------------------------------------------------------- son propre compte
-- Les cartes, avec de quoi construire n'importe quel deck : autant
-- d'exemplaires que la limite d'un deck (limite_copies, 23_combats.sql :
-- deux, un pour une Legendaire, une Secrete, une Promo). Une carte deja la
-- garde ses exemplaires en plus.
--   master      tout le catalogue, sauf la carte unique (un seul exemplaire
--               dans tout le jeu) ;
--   classiques  les 122, un exemplaire ;
--   combat      les Joueurs, Coachs, Moments et Objets des 122 ;
--   vider       plus rien (et ses demandes d'echange en attente sont annulees).
create or replace function public.labo_cartes(p_quoi text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  if p_quoi = 'vider' then
    update trades set status = 'cancelled', resolved_at = now()
     where status = 'pending' and (from_user = p or to_user = p);
    delete from collection where user_id = p;
  elsif p_quoi in ('master', 'classiques', 'combat') then
    insert into collection (user_id, card_id, qty)
    select p, k.id, case when p_quoi = 'classiques' then 1 else coalesce(limite_copies(k.id), 1) end
      from cards k
     where case p_quoi when 'master' then k.rar <> 'UN'
                       when 'classiques' then not k.promo
                       else not k.promo and k.cat in ('joueur', 'coach', 'moment', 'objet') end
    on conflict (user_id, card_id) do update set qty = greatest(collection.qty, excluded.qty);
  else
    raise exception 'Choix inconnu.';
  end if;
  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

-- Les monnaies, posees a la valeur dite : eclats, fragments, boosters (en
-- plus, hors reserve), reserve, prismes (la monnaie de l'evenement en cours,
-- ou du dernier : les Etincelles du Choc), niveau (de combattant : l'XP est
-- posee au debut du niveau, sans payer ses paliers). Une cle absente ne
-- change rien.
create or replace function public.labo_monnaies(p_valeurs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); k text; v numeric; lim numeric; bas numeric; ev text; niv int; xp_n int;
begin
  if p_valeurs is null or jsonb_typeof(p_valeurs) <> 'object' then raise exception 'Valeurs invalides.'; end if;
  for k in select jsonb_object_keys(p_valeurs) loop
    if k not in ('eclats', 'fragments', 'boosters', 'reserve', 'prismes', 'niveau') then
      raise exception 'Valeur inconnue : %.', k;
    end if;
    if jsonb_typeof(p_valeurs -> k) <> 'number' then raise exception 'Un nombre est attendu.'; end if;
    v := (p_valeurs ->> k)::numeric;
    -- (calculees avant le IF : un CASE dans sa condition trouble PL/pgSQL)
    lim := case k when 'reserve' then 99 when 'boosters' then 999 when 'niveau' then 100 else 10000000 end;
    bas := case k when 'niveau' then 1 else 0 end;
    if v < bas or v > lim then raise exception 'Valeur hors limites : %.', k; end if;
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
    if ev is null then raise exception 'Aucun événement : pas de monnaie d''événement à poser.'; end if;
    insert into evt_comptes (user_id, evenement, solde, total)
    values (p, ev, round((p_valeurs ->> 'prismes')::numeric)::int, round((p_valeurs ->> 'prismes')::numeric)::int)
    on conflict (user_id, evenement) do update
      set solde = excluded.solde, total = greatest(evt_comptes.total, excluded.solde);
  end if;
  if p_valeurs ? 'niveau' then
    niv := round((p_valeurs ->> 'niveau')::numeric)::int;
    xp_n := (select coalesce(sum(xp_requis(x)), 0) from generate_series(1, niv - 1) x);
    perform combat_joueur(p);
    update combat_joueurs set xp = xp_n where user_id = p;
    -- Les quetes « niveau » suivent, comme apres un combat (gagner_xp).
    insert into quest_progress (user_id, quest_id, period_key, progress)
    select p, q.id, period_key(q.scope), niv from quests q where q.metric = 'niveau'
    on conflict (user_id, quest_id, period_key)
      do update set progress = greatest(quest_progress.progress, excluded.progress)
      where not quest_progress.claimed;
  end if;
  return me();
end $$;

-- Des cadres (f_…), des titres et des tapis (t_…), des sleeves (s_…), par
-- leur identifiant : le navigateur envoie ceux de FRAMES, TITRES, TAPIS et
-- SLEEVES.
create or replace function public.labo_cosmetiques(p_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); x text;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 300 then
    raise exception 'Liste vide ou trop longue.';
  end if;
  foreach x in array p_ids loop
    if x !~ '^[fts]_[a-z0-9_]{1,40}$' then raise exception 'Identifiant invalide : %.', x; end if;
    insert into inventory (user_id, item_id, qty) values (p, x, 1)
      on conflict (user_id, item_id) do update set qty = greatest(inventory.qty, 1);
  end loop;
  return me();
end $$;

-- Ses combats. Rien n'est verse : c'est pour voir et pour retester.
--   section   'toxique', 'deter' (avec sa Promo, comme combat_section), ou
--             null : choisir de nouveau depuis l'onglet Combats ;
--   campagne  'finie' (les vingt combats gagnes) ou 'raz' ;
--   jour      ses plafonds et ses essais du jour a zero : victoires payees,
--             defis payes, tentatives du Raid, essais de l'Epreuve ;
--   maitrises 'max' (toutes ses cartes au niveau 5) ou 'raz'.
create or replace function public.labo_combats_moi(p_action text, p_valeur text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  perform combat_joueur(p);
  if p_action = 'section' then
    if p_valeur is not null and p_valeur not in ('toxique', 'deter') then raise exception 'Section inconnue.'; end if;
    update combat_joueurs set section = p_valeur where user_id = p;
    if p_valeur is not null then
      insert into collection (user_id, card_id, qty)
      values (p, case p_valeur when 'toxique' then 'p03' else 'p04' end, 1)
        on conflict (user_id, card_id) do nothing;
    end if;
  elsif p_action = 'campagne' then
    if p_valeur = 'finie' then
      update combat_joueurs set faits = (select array_agg('cp' || lpad(k::text, 2, '0') order by k)
                                           from generate_series(1, 20) k), finie = true
       where user_id = p;
    elsif p_valeur = 'raz' then
      update combat_joueurs set faits = '{}', finie = false where user_id = p;
    else
      raise exception 'Choix inconnu.';
    end if;
  elsif p_action = 'jour' then
    update combat_joueurs set recompensees = 0, jour = null, defis_rec = 0, defis_jour = null where user_id = p;
    delete from raid_tentatives where user_id = p and jour = jour_paris();
    delete from choc_epreuves where user_id = p and jour = jour_paris();
  elsif p_action = 'maitrises' then
    if p_valeur = 'max' then
      insert into maitrises (user_id, card_id, niveau)
      select distinct p, maitrise_carte(c.card_id), 5 from collection c
       where c.user_id = p and c.qty > 0 and maitrise_carte(c.card_id) is not null
      on conflict (user_id, card_id) do update set niveau = 5, le = now();
    elsif p_valeur = 'raz' then
      delete from maitrises where user_id = p;
    else
      raise exception 'Choix inconnu.';
    end if;
  else
    raise exception 'Action inconnue.';
  end if;
  return me();
end $$;

-- Ce qu'une sauvegarde emporte, et ce que « repartir de zero » efface : tout
-- ce qui est a soi, sauf les amis, la boite de reception, les echanges et les
-- defis entre amis. Les tables de L'Echauffement (la 2.5) n'existent que sur
-- une base qui l'a connue.
create or replace function public.labo_tables() returns text[]
language sql stable as $$
  select coalesce(array_agg(x.t order by x.o), '{}') from unnest(array[
    'collection', 'inventory', 'quest_progress', 'evt_comptes', 'evt_piste_prises', 'gardes', 'favoris',
    'devine_illu', 'tirages', 'recyclages', 'combat_joueurs', 'decks', 'choc_joueurs', 'choc_epreuves',
    'raid_participants', 'raid_pris', 'raid_tentatives', 'maitrises', 'maitrises_journal',
    'ech_scores', 'ech_paliers', 'ech_essais', 'ech_sf_scores', 'ech_sf_essais']) with ordinality as x(t, o)
   where to_regclass('public.' || x.t) is not null
$$;

create or replace function public.labo_sauver() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); c jsonb; t text; r jsonb;
begin
  c := jsonb_build_object('version', '3.0', 'profil', (select to_jsonb(x) from profiles x where x.id = p));
  foreach t in array labo_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into r using p;
    c := c || jsonb_build_object(t, r);
  end loop;
  insert into labo_sauvegardes (user_id, le, contenu) values (p, now(), c)
    on conflict (user_id) do update set le = excluded.le, contenu = excluded.contenu;
  return labo_etat();
end $$;

-- Remettre le compte tel qu'il etait a la sauvegarde. Une table que la
-- sauvegarde ne contient pas (une sauvegarde de la 2.5 n'a pas les combats)
-- reste telle quelle ; une colonne apparue depuis prend sa valeur par
-- defaut ; une ligne qui ne tient plus (une carte, une quete disparues) est
-- laissee de cote.
create or replace function public.labo_restaurer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); s labo_sauvegardes; t text; r profiles; lignes jsonb; x jsonb;
        cols text; vals text; pf jsonb;
begin
  select * into s from labo_sauvegardes where user_id = p;
  if not found then raise exception 'Aucune sauvegarde.'; end if;
  foreach t in array labo_tables() loop
    continue when not (s.contenu ? t);
    execute format('delete from public.%I where user_id = $1', t) using p;
    lignes := s.contenu -> t;
    continue when jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) = 0;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
           string_agg('x.' || quote_ident(a.attname), ', ' order by a.attnum)
      into cols, vals
      from pg_attribute a
     where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
       and a.attgenerated = '' and (lignes -> 0) ? a.attname::text;
    begin
      execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I, $1) x',
                     t, cols, vals, t) using lignes;
    exception when foreign_key_violation or unique_violation or check_violation or not_null_violation then
      for x in select value from jsonb_array_elements(lignes) loop
        begin
          execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_record(null::public.%I, $1) x',
                         t, cols, vals, t) using x;
        exception when foreign_key_violation or unique_violation or check_violation or not_null_violation then
          null;
        end;
      end loop;
    end;
  end loop;
  pf := s.contenu -> 'profil';
  r := jsonb_populate_record(null::public.profiles, pf);
  update profiles set
    shards = coalesce(r.shards, shards), fragments = coalesce(r.fragments, fragments),
    tickets = coalesce(r.tickets, tickets), last_tick = coalesce(r.last_tick, last_tick),
    trade_free_at = coalesce(r.trade_free_at, trade_free_at),
    boosters_bonus = coalesce(r.boosters_bonus, boosters_bonus), tickets_offerts = coalesce(r.tickets_offerts, tickets_offerts),
    packs_opened = coalesce(r.packs_opened, packs_opened), trades_done = coalesce(r.trades_done, trades_done),
    streak = coalesce(r.streak, streak), last_checkin = r.last_checkin, serie_max = coalesce(r.serie_max, serie_max),
    fabrications = coalesce(r.fabrications, fabrications), avatar = coalesce(r.avatar, avatar), frame = coalesce(r.frame, frame),
    titre = r.titre, banniere = r.banniere, devise = r.devise,
    vitrine = coalesce(r.vitrine, vitrine), garder = coalesce(r.garder, garder),
    fetiche = case when not (pf ? 'fetiche') then fetiche
                   when r.fetiche in (select id from cards) then r.fetiche end
   where id = p;
  return me();
end $$;

-- Repartir de zero, comme un nouveau joueur : tout ce que labo_tables()
-- liste, le combat ouvert, et les compteurs du profil. Garde le compte, le
-- pseudo, les amis, la boite de reception, les droits. La Section est a
-- choisir de nouveau. Penser a labo_sauver() avant.
create or replace function public.labo_raz_moi() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); t text;
begin
  update trades set status = 'cancelled', resolved_at = now()
   where status = 'pending' and (from_user = p or to_user = p);
  delete from combats_ouverts where user_id = p;
  foreach t in array labo_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using p;
  end loop;
  update profiles set
    shards = 0, fragments = 0, tickets = cfg('ticket_cap'), last_tick = now(), trade_free_at = now(),
    boosters_bonus = 0, tickets_offerts = 0, packs_opened = 0, trades_done = 0, streak = 0,
    last_checkin = null, serie_max = 0, fabrications = 0, avatar = 'star', frame = 'default',
    titre = null, banniere = null, devise = null, vitrine = '{}', garder = '{}', fetiche = null
   where id = p;
  return me();
end $$;

revoke all on function public.labo_garde, public.labo_tables from public, anon, authenticated;
revoke all on function public.labo_etat, public.labo_evenement, public.labo_decaler, public.labo_evenement_raz,
  public.labo_reverses, public.labo_raid, public.labo_raid_echelle, public.labo_raid_raz, public.labo_cartes,
  public.labo_monnaies, public.labo_cosmetiques, public.labo_combats_moi, public.labo_sauver,
  public.labo_restaurer, public.labo_raz_moi from public, anon;
grant execute on function public.labo_etat, public.labo_evenement, public.labo_decaler, public.labo_evenement_raz,
  public.labo_reverses, public.labo_raid, public.labo_raid_echelle, public.labo_raid_raz, public.labo_cartes,
  public.labo_monnaies, public.labo_cosmetiques, public.labo_combats_moi, public.labo_sauver,
  public.labo_restaurer, public.labo_raz_moi to authenticated;
