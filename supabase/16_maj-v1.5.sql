-- =====================================================================
--  Mise a jour 1.5 — pour une base deja installee.
--
--  Fragments et fabrication, Essences Brillantes, succes, historique des
--  tirages, evenement « boosters doubles » et chasse a la carte unique.
--  Une seule transaction : tout passe, ou rien. Rejouable : le relancer ne
--  cree pas un second evenement et ne rouvre pas une chasse gagnee.
--
--  Ce fichier est une copie : chaque definition vient telle quelle des
--  fichiers d'installation (01, 03, 03b, 07, 12, 15), que TOUT.sql
--  contient aussi. Une base neuve n'en a pas besoin.
-- =====================================================================
begin;

-- 1. Les nouvelles colonnes.
alter table public.profiles add column if not exists fragments    integer not null default 0;
alter table public.profiles add column if not exists fabrications integer not null default 0;
alter table public.profiles add column if not exists serie_max    integer not null default 0;
do $$ begin
  alter table public.profiles add constraint fragments_positifs check (fragments >= 0);
exception when duplicate_object then null; end $$;
alter table public.recyclages add column if not exists fragments integer not null default 0;
update public.profiles set serie_max = greatest(serie_max, streak);

-- 2. Les reglages : Fragments, fabrication, Brillantes, chasse.
create or replace function public.cfg(k text) returns integer
language sql immutable as $$
  select case k
    when 'ticket_cap'        then 5          -- boosters en reserve au maximum
    when 'ticket_minutes'    then 240        -- un booster toutes les 4 h, soit 6 par jour
    when 'pack_size'         then 6
    when 'god_odds'          then 2000       -- 1 chance sur 2000
    when 'trade_cooldown_h'  then 6          -- un echange gratuit toutes les 6 h
    when 'shards_per_dup'    then 0
    -- Le palier de collection qui accorde la carte Promo « palier ».
    -- Doit rester egal a PROMO_PALIER dans js/config.js, qui ne sert qu'a
    -- l'affichage : c'est check_promos() qui accorde vraiment la carte.
    when 'promo_palier_pct'  then 75
    -- Recyclage (supabase/12_recyclage.sql) : ce que rapporte un doublon jete,
    -- en Fragments. Les Fragments n'achetent qu'une chose — une carte qui
    -- manque (fabriquer) — : ils ne font pas tourner de boucle avec les
    -- boosters, il n'y a donc plus de plafond. Le calcul est en tete de
    -- 12_recyclage.sql.
    when 'recyclage_ES'      then 1
    when 'recyclage_C'       then 2
    when 'recyclage_PC'      then 5
    when 'recyclage_R'       then 20
    when 'recyclage_E'       then 80
    when 'recyclage_L'       then 250
    -- Fabriquer une carte qui manque, en Fragments. Simulation (six boosters
    -- par jour, tous les doublons recycles) : un joueur a 120 boosters finit
    -- l'extension en ~62 jours au lieu de ~92, et le quart le plus malchanceux
    -- en ~73 au lieu de ~124. Moins cher, la fin de collection ne valait plus
    -- rien ; plus cher, la fabrication ne changeait presque rien.
    when 'fabrication_ES'    then 20
    when 'fabrication_C'     then 40
    when 'fabrication_PC'    then 100
    when 'fabrication_R'     then 400
    when 'fabrication_E'     then 2000
    when 'fabrication_L'     then 8000
    -- Une Essence Brillante remplace l'Essence du paquet une fois sur 50 :
    -- environ une tous les huit jours pour un joueur regulier.
    when 'foil_odds'         then 50
    -- La chasse a la carte unique (supabase/15_evenements.sql) : une chance
    -- sur 250 par booster, tant que personne ne l'a trouvee. Avec ~70 boosters
    -- ouverts par jour dans la communaute, elle sort en ~3 a 4 jours.
    when 'chasse_odds'       then 250
  end;
$$;

-- 3. Les Essences Brillantes et la carte unique.
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo)
select 'b' || substr(k.id, 2), k.num, k.nom || ' Brillante', k.cat, k.col, 'BR', false, true
  from public.cards k
 where k.cat = 'essence' and not k.promo and k.id like 'c%'
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo) values
  ('u01', 1, 'L''Unique Chevalière', 'objet', 'neutre', 'UN', false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- 4. Tirages, evenements, chasse, succes (15_evenements.sql).
-- --------------------------------------------------------------- tirages
create table if not exists public.tirages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  cartes     text[] not null,
  god        boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tirages_user_idx on public.tirages (user_id, id desc);

alter table public.tirages enable row level security;
-- Aucune policy : le navigateur passe par mes_tirages().
revoke all on public.tirages from anon, authenticated;

-- ------------------------------------------------------------ evenements
-- `ticket_minutes` : la recharge pendant l'evenement (120 = boosters
-- doubles). Vide : l'evenement ne change pas le rythme.
create table if not exists public.evenements (
  id             bigint generated always as identity primary key,
  titre          text not null,
  texte          text not null default '',
  debut          timestamptz not null,
  fin            timestamptz not null,
  ticket_minutes integer check (ticket_minutes is null or ticket_minutes between 10 and 1440),
  constraint evenement_dans_l_ordre check (fin > debut)
);

alter table public.evenements enable row level security;
revoke all on public.evenements from anon, authenticated;

-- -------------------------------------------------------------- chasse
-- Une seule ligne. `gagnant` vide : la carte est encore a trouver. La mise a
-- jour qui le remplit (open_pack, 03_rpc.sql) porte `where gagnant is null` :
-- c'est elle, et pas le navigateur, qui garantit qu'il n'y a qu'un gagnant.
create table if not exists public.chasse (
  id         int primary key check (id = 1),
  carte      text not null references public.cards,
  active     boolean not null default false,
  gagnant    uuid references public.profiles on delete set null,
  trouvee_le timestamptz
);
insert into public.chasse (id, carte, active) values (1, 'u01', false)
on conflict (id) do nothing;

alter table public.chasse enable row level security;
revoke all on public.chasse from anon, authenticated;

-- ----------------------------------------------------- le rythme en cours
-- 240 minutes d'ordinaire ; celui de l'evenement en cours s'il en change.
create or replace function public.minutes_recharge() returns integer
language plpgsql stable security definer set search_path = public as $$
declare m int;
begin
  select e.ticket_minutes into m from evenements e
   where e.ticket_minutes is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
  return coalesce(m, cfg('ticket_minutes'));
end $$;

-- L'evenement en cours, pour le bandeau et la fenetre des nouveautes.
create or replace function public.evenement_actif() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return (select jsonb_build_object('titre', e.titre, 'texte', e.texte,
                                    'debut', e.debut, 'fin', e.fin,
                                    'ticket_minutes', e.ticket_minutes)
            from evenements e
           where now() >= e.debut and now() < e.fin
           order by e.debut desc limit 1);
end $$;

-- Ou en est la chasse : ouverte ou non, trouvee ou non, et par qui. Le
-- gagnant est public : c'est tout l'interet.
create or replace function public.chasse_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return (select jsonb_build_object('carte', c.carte, 'active', c.active,
                                    'trouvee', c.gagnant is not null,
                                    'gagnant', (select pseudo from profiles where id = c.gagnant),
                                    'trouvee_le', c.trouvee_le)
            from chasse c where c.id = 1);
end $$;

-- ---------------------------------------------------------------- succes
-- Les identifiants doivent rester ceux de SUCCES dans js/config.js, qui
-- porte les noms et les descriptions. Un succes lie a la collection peut
-- disparaitre si l'on cede la carte qui le tenait : c'est le prix d'un calcul
-- sans stockage, et c'est rare (les Promos et les Brillantes ne s'echangent
-- pas).
create or replace function public.succes_de(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pr profiles; s text[] := '{}';
  ext int; ext_total int; leg int; leg_total int; br int; br_total int; uni boolean;
begin
  select * into pr from profiles where id = p;
  if not found then return '[]'::jsonb; end if;

  select count(*) filter (where not k.promo),
         count(*) filter (where not k.promo and k.rar = 'L'),
         count(*) filter (where k.rar = 'BR'),
         coalesce(bool_or(k.rar = 'UN'), false)
    into ext, leg, br, uni
    from collection c join cards k on k.id = c.card_id
   where c.user_id = p and c.qty > 0;
  select count(*) filter (where not promo),
         count(*) filter (where not promo and rar = 'L'),
         count(*) filter (where rar = 'BR')
    into ext_total, leg_total, br_total
    from cards;

  if pr.packs_opened >= 1   then s := array_append(s, 'premier_booster'); end if;
  if pr.packs_opened >= 100 then s := array_append(s, 'boosters_100'); end if;
  if pr.packs_opened >= 500 then s := array_append(s, 'boosters_500'); end if;
  if ext * 2 >= ext_total   then s := array_append(s, 'collection_50'); end if;
  if ext >= ext_total       then s := array_append(s, 'master_set'); end if;
  if leg >= leg_total       then s := array_append(s, 'toutes_legendaires'); end if;
  if pr.trades_done >= 1    then s := array_append(s, 'premier_echange'); end if;
  if pr.trades_done >= 25   then s := array_append(s, 'negociant'); end if;
  if greatest(pr.serie_max, pr.streak) >= 7  then s := array_append(s, 'serie_7'); end if;
  if greatest(pr.serie_max, pr.streak) >= 30 then s := array_append(s, 'serie_30'); end if;
  if exists (select 1 from tirages t where t.user_id = p and t.god) then s := array_append(s, 'godpack'); end if;
  if br >= 1                then s := array_append(s, 'brillante'); end if;
  if br_total > 0 and br >= br_total then s := array_append(s, 'toutes_brillantes'); end if;
  if pr.fabrications >= 1   then s := array_append(s, 'artisan'); end if;
  if uni                    then s := array_append(s, 'unique'); end if;
  -- Ceux qui etaient la avant la version 1.5.
  if pr.created_at < timestamptz '2026-10-04 00:00:00+02' then s := array_append(s, 'pionnier'); end if;

  return to_jsonb(s);
end $$;

-- --------------------------------------------------------- mes tirages
-- Les trente derniers boosters, et des statistiques sur tout le journal :
-- combien de cartes de chaque rarete, combien de godpacks et de Brillantes.
-- Le journal commence a la version 1.5 : les boosters ouverts avant n'y
-- sont pas (`depuis` le dit).
create or replace function public.mes_tirages() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  return jsonb_build_object(
    'total',  (select count(*) from tirages where user_id = p),
    'god',    (select count(*) from tirages where user_id = p and god),
    'depuis', (select min(created_at) from tirages where user_id = p),
    'raretes', coalesce((
      select jsonb_object_agg(r.rar, r.n)
        from (select k.rar, count(*) as n
                from tirages t, unnest(t.cartes) as u(cid)
                join cards k on k.id = u.cid
               where t.user_id = p
               group by k.rar) r), '{}'::jsonb),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object('quand', t.created_at, 'cartes', to_jsonb(t.cartes), 'god', t.god)
                       order by t.id desc)
        from (select * from tirages where user_id = p order by id desc limit 30) t), '[]'::jsonb));
end $$;

-- Rouages internes (appeles par me(), player_profile, open_pack) : pas
-- depuis le navigateur. mes_tirages, elle, est une action du joueur.
revoke all on function public.minutes_recharge, public.evenement_actif, public.chasse_etat,
  public.succes_de from public, anon, authenticated;
revoke all on function public.mes_tirages from public, anon;
grant execute on function public.mes_tirages to authenticated;

-- 5. Les fonctions qui changent.
create or replace function public.regen_tickets(p uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare pr profiles; gained int; step interval;
begin
  select * into pr from profiles where id = p for update;
  if not found then raise exception 'profil introuvable'; end if;

  -- minutes_recharge() (15_evenements.sql) : 240 d'ordinaire, moins pendant
  -- un evenement « boosters doubles ». Le pas s'applique a tout le temps ecoule
  -- depuis last_tick : au debut et a la fin d'un evenement, le premier booster
  -- arrive un peu plus tot ou un peu plus tard. Ecart d'un booster au plus.
  step := make_interval(mins => minutes_recharge());
  if pr.tickets >= cfg('ticket_cap') then
    if pr.last_tick < now() then
      update profiles set last_tick = now() where id = p returning * into pr;
    end if;
    return pr;
  end if;

  gained := floor(extract(epoch from (now() - pr.last_tick)) / extract(epoch from step));
  if gained > 0 then
    update profiles set
      tickets   = least(cfg('ticket_cap'), tickets + gained),
      last_tick = case when least(cfg('ticket_cap'), tickets + gained) >= cfg('ticket_cap')
                       then now() else last_tick + (gained * step) end
    where id = p returning * into pr;
  end if;
  return pr;
end $$;

create or replace function public.checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles; today date;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  today := (now() at time zone 'Europe/Paris')::date;
  select * into pr from profiles where id = p for update;

  if pr.last_checkin is distinct from today then
    update profiles set
      streak = case when pr.last_checkin = today - 1 then pr.streak + 1 else 1 end,
      last_checkin = today
    where id = p;
    -- La plus longue serie : elle sert aux succes, qui ne doivent pas
    -- disparaitre le jour ou la serie en cours retombe.
    update profiles set serie_max = greatest(serie_max, streak) where id = p;
    perform bump_quests(p, 'checkin', 1);
  end if;
  return me();
end $$;

create or replace function public.open_pack() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles;
  god boolean; ids text[] := '{}'; cid text; x double precision;
  nouvelles int := 0; i int; ch_active boolean; ch_gagnant uuid; unique_id text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  pr := regen_tickets(p);
  if pr.tickets < 1 then
    raise exception 'RESERVE_VIDE';
  end if;

  god := random() < 1.0 / cfg('god_odds');

  -- Six cartes, chacune a sa place :
  --   1 · Commune
  --   2 · Commune
  --   3 · Commune (60 %) ou Peu commune (40 %)
  --   4 · Peu commune
  --   5 · Essence
  --   6 · le hit : Rare 80 %, Epique 16 %, Legendaire 4 %
  -- L'ordre compte : c'est celui dans lequel la pile se feuillette, et la
  -- derniere carte porte la mise en scene de la revelation.
  --
  -- Godpack : six cartes qui montent, de la rare a la legendaire garantie.
  --
  -- Ces taux doivent rester identiques a RATES dans js/booster.js, qui sert
  -- aux ouvertures de test du Labo.
  if god then
    x := random() * 100.0; ids := ids || pick_card(case when x < 90.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 70.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 50.0 then 'R' else 'E' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 90.0 then 'E' else 'L' end);
    x := random() * 100.0; ids := ids || pick_card(case when x < 60.0 then 'E' else 'L' end);
    ids := ids || pick_card('L');
  else
    ids := ids || pick_card('C');
    ids := ids || pick_card('C');
    x := random() * 100.0; ids := ids || pick_card(case when x < 60.0 then 'C' else 'PC' end);
    ids := ids || pick_card('PC');

    select id into cid from cards
      where in_booster and not promo and cat = 'essence' order by random() limit 1;
    -- Une fois sur cfg('foil_odds'), l'Essence sort dans sa version
    -- Brillante (03b_promos.sql) : meme Essence, `b` au lieu de `c`.
    if cid is not null and random() < 1.0 / cfg('foil_odds') then
      cid := coalesce((select k.id from cards k where k.id = 'b' || substr(cid, 2)), cid);
    end if;
    ids := ids || coalesce(cid, pick_card('C'));

    x := random() * 100.0;
    ids := ids || pick_card(case when x < 80.0 then 'R'
                                 when x < 96.0 then 'E'
                                 else 'L' end);
  end if;

  ids := array_remove(ids, null);
  if array_length(ids, 1) is null then raise exception 'BOOSTER_VIDE'; end if;

  -- La chasse (15_evenements.sql) : tant qu'elle est ouverte et que personne
  -- n'a la carte unique, chaque booster a une chance sur cfg('chasse_odds')
  -- de la contenir, en septieme carte — la derniere revelee. La mise a jour
  -- `where gagnant is null` tranche entre deux tirages simultanes : le second
  -- relit la ligne apres le premier, n'y trouve plus de place, et repart
  -- avec un booster ordinaire.
  select active, gagnant into ch_active, ch_gagnant from chasse where id = 1;
  if coalesce(ch_active, false) and ch_gagnant is null and random() < 1.0 / cfg('chasse_odds') then
    update chasse set gagnant = p, trouvee_le = now()
     where id = 1 and gagnant is null
     returning carte into unique_id;
    if unique_id is not null then
      ids := ids || unique_id;
      insert into annonces (titre, texte) values (
        (select nom from cards where id = unique_id) || ' a été trouvée !',
        pr.pseudo || ' l''a tirée d''un booster. Il n''en existe qu''une seule dans tout le jeu.');
    end if;
  end if;

  -- Les cartes encore jamais obtenues, avant de mettre a jour la collection.
  select count(*) into nouvelles from unnest(ids) u(cid2)
    where not exists (select 1 from collection c
                      where c.user_id = p and c.card_id = u.cid2 and c.qty > 0);

  insert into collection (user_id, card_id, qty)
  select p, u.cid2, count(*) from unnest(ids) u(cid2) group by u.cid2
  on conflict (user_id, card_id) do update set qty = collection.qty + excluded.qty;

  -- Un booster consomme depuis la reserve pleine relance le compte a rebours.
  update profiles set
    tickets      = tickets - 1,
    last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
    packs_opened = packs_opened + 1
  where id = p;

  -- Le journal des tirages : l'historique et les statistiques du joueur
  -- (mes_tirages, 15_evenements.sql), et le succes « godpack ».
  insert into tirages (user_id, cartes, god) values (p, ids, god);

  perform bump_quests(p, 'packs', 1);
  perform bump_quests(p, 'new_cards', nouvelles);
  perform bump_quests(p, 'rarity_R', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('R','E','L')));
  perform bump_quests(p, 'rarity_E', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('E','L')));
  perform bump_quests(p, 'rarity_L', (select count(*)::int from cards
                                      where id = any(ids) and rar = 'L'));
  perform sync_collection_quests(p);
  perform check_promos(p);

  return jsonb_build_object('cards', to_jsonb(ids), 'god', god, 'etat', me());
end $$;

create or replace function public.trade_create(
  p_pseudo text, p_offer text, p_want text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles; dest profiles;
  ro text; rw text; jeton int; gratuit boolean; tid uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into dest from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if dest.id = p then raise exception 'Tu ne peux pas échanger avec toi-même.'; end if;

  select rar into ro from cards where id = p_offer;
  select rar into rw from cards where id = p_want;
  if ro is null or rw is null then raise exception 'Carte inconnue.'; end if;
  if ro <> rw then raise exception 'Les deux cartes doivent être de la même rareté.'; end if;
  if ro = 'ES' then raise exception 'Les Essences ne s''échangent pas.'; end if;
  if ro = 'PR' then raise exception 'Les cartes Promo ne s''échangent pas.'; end if;
  -- Tout ce qui est hors extension — Promos, Essences Brillantes, carte
  -- unique — reste a qui l'a obtenu.
  if exists (select 1 from cards where id in (p_offer, p_want) and promo) then
    raise exception 'Cette carte ne s''échange pas.';
  end if;

  if not exists (select 1 from collection where user_id = p and card_id = p_offer and qty > 0) then
    raise exception 'Tu ne possèdes pas la carte que tu proposes.';
  end if;

  if exists (select 1 from trades where from_user = p and to_user = dest.id
             and offer_card = p_offer and want_card = p_want and status = 'pending') then
    raise exception 'Cette demande est déjà en attente.';
  end if;
  if (select count(*) from trades where from_user = p and status = 'pending') >= 10 then
    raise exception 'Tu as déjà 10 demandes en attente.';
  end if;

  -- Cout : l'echange gratuit si le delai est passe, sinon un jeton d'echange.
  select * into pr from profiles where id = p for update;
  gratuit := pr.trade_free_at <= now();
  if gratuit then
    update profiles set trade_free_at = now() + make_interval(hours => cfg('trade_cooldown_h'))
      where id = p;
  else
    select qty into jeton from inventory where user_id = p and item_id = 'trade_token' for update;
    if coalesce(jeton, 0) < 1 then raise exception 'ECHANGE_EN_RECHARGE'; end if;
    update inventory set qty = qty - 1 where user_id = p and item_id = 'trade_token';
  end if;

  insert into trades (from_user, to_user, offer_card, want_card, note, jeton)
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140), not gratuit)
  returning id into tid;

  -- Dans la boite du destinataire (supabase/11_boite.sql). Les deux cartes
  -- voyagent avec l'evenement : la boite les montre sans autre appel.
  perform notifier(dest.id, 'echange_recu', p, tid::text,
                   jsonb_build_object('offer', p_offer, 'want', p_want));

  return me();
end $$;

create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  pr := regen_tickets(p);
  perform sync_collection_quests(p);
  perform check_promos(p);

  return jsonb_build_object(
    'profil', jsonb_build_object(
      'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
      'is_admin', pr.is_admin, 'shards', pr.shards, 'tickets', pr.tickets,
      'last_tick', pr.last_tick, 'trade_free_at', pr.trade_free_at,
      'packs_opened', pr.packs_opened, 'trades_done', pr.trades_done,
      'streak', pr.streak, 'last_checkin', pr.last_checkin,
      'vitrine', to_jsonb(pr.vitrine),
      'fragments', pr.fragments,
      -- La seule fonction qui reponde a un compte non invite : c'est elle qui
      -- permet au navigateur d'afficher « tu n'es pas sur la liste » au lieu
      -- d'une erreur muette. Toutes les autres refusent (garde_beta).
      'invite', (beta_ouverte() or est_invite(p)),
      -- Le rythme en cours : plus court pendant un evenement (minutes_recharge,
      -- 15_evenements.sql). Le compte a rebours du navigateur suit celui-ci.
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', minutes_recharge(),
      'serveur', now()),
    -- La pastille de la boite de reception (supabase/11_boite.sql).
    'boite', boite_non_lues(p),
    -- Le recyclage et la fabrication (supabase/12_recyclage.sql) : ce que
    -- rapporte chaque rarete en Fragments, et ce que coute une carte. Les
    -- montants partent d'ici pour que le navigateur n'en garde pas une copie
    -- qui finirait par mentir.
    'recyclage', jsonb_build_object(
      'valeurs', jsonb_build_object(
        'ES', cfg('recyclage_ES'), 'C', cfg('recyclage_C'), 'PC', cfg('recyclage_PC'),
        'R', cfg('recyclage_R'), 'E', cfg('recyclage_E'), 'L', cfg('recyclage_L')),
      'couts', jsonb_build_object(
        'ES', cfg('fabrication_ES'), 'C', cfg('fabrication_C'), 'PC', cfg('fabrication_PC'),
        'R', cfg('fabrication_R'), 'E', cfg('fabrication_E'), 'L', cfg('fabrication_L'))),
    -- Les succes, l'evenement en cours et la chasse (15_evenements.sql).
    'succes', succes_de(p),
    'evenement', evenement_actif(),
    'chasse', chasse_etat(),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'item', q.item_id, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false)) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.player_profile(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;

  ami := o.id = moi or exists (
    select 1 from friendships
     where a = least(moi, o.id) and b = greatest(moi, o.id) and accepte);

  -- `not promo`, des deux cotes. Les cartes Promo vivent dans `cards` pour
  -- pouvoir entrer dans une collection, mais elles n'appartiennent pas a
  -- l'extension : ni dans son total, ni dans son pourcentage (voir la table
  -- `cards` et sync_collection_quests dans 01_schema.sql).
  --
  -- Sans ce garde-fou, la fiche d'un joueur annoncait « / 126 » pendant que
  -- son propre ecran Collection et le palier des 100 % comptaient 122. Deux
  -- ecrans, deux verites, et un joueur a 122/122 qui se voyait incomplet.
  select count(*) into total from cards where not promo;
  select count(*) into possede
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and not k.promo;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'vitrine', to_jsonb(o.vitrine),
    'succes', succes_de(o.id),
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end);
end $$;

create or replace function public.recycler(p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); lot jsonb; cid text; n int; k cards;
  possede int; reserve int; prix int; total int := 0; vus text[] := '{}';
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_lots is null or jsonb_typeof(p_lots) <> 'array' or jsonb_array_length(p_lots) = 0 then
    raise exception 'Rien à recycler.';
  end if;
  if jsonb_array_length(p_lots) > 150 then raise exception 'Trop de cartes d''un coup.'; end if;

  -- Un recyclage a la fois par joueur : deux envois partis ensemble ne
  -- doivent pas compter deux fois le meme exemplaire.
  perform 1 from profiles where id = p for update;

  for lot in select value from jsonb_array_elements(p_lots) loop
    cid := lot->>'carte';
    if jsonb_typeof(lot->'n') <> 'number' then raise exception 'Quantité invalide.'; end if;
    n := (lot->>'n')::int;
    if cid is null or n < 1 then raise exception 'Quantité invalide.'; end if;
    if cid = any(vus) then raise exception 'Une carte apparaît deux fois.'; end if;
    vus := vus || cid;

    select * into k from cards where id = cid;
    if not found then raise exception 'Carte inconnue.'; end if;
    if k.promo then raise exception 'Cette carte ne se recycle pas.'; end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    if coalesce(possede, 0) - 1 - reserve < n then
      raise exception 'Pas assez de doublons de « % » : tu gardes toujours un exemplaire.', k.nom;
    end if;

    update collection set qty = qty - n where user_id = p and card_id = cid;
    insert into recyclages (user_id, card_id, qty, eclats, fragments) values (p, cid, n, 0, n * prix);
    total := total + n * prix;
  end loop;

  update profiles set fragments = fragments + total where id = p;
  return me();
end $$;

create or replace function public.fabriquer(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; cout int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo then raise exception 'Cette carte ne se fabrique pas.'; end if;
  cout := cfg('fabrication_' || k.rar);
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

revoke all on function public.recycler, public.fabriquer from public, anon;
grant execute on function public.recycler, public.fabriquer to authenticated;

-- 6. L'evenement de lancement : boosters doubles pendant trois jours, a
--    partir de maintenant. Pas de doublon si on relance le fichier.
insert into public.evenements (titre, texte, debut, fin, ticket_minutes)
select 'Boosters doublés', 'Un booster toutes les 2 h au lieu de 4, pendant trois jours.',
       now(), now() + interval '3 days', 120
 where not exists (select 1 from public.evenements where titre = 'Boosters doublés');

-- 7. La chasse a l'Unique Chevaliere est ouverte.
update public.chasse set active = true where id = 1;

commit;

-- Verification : 9 Brillantes, la carte unique, l'evenement et la chasse.
select (select count(*) from public.cards where rar = 'BR') as brillantes,
       (select count(*) from public.cards where rar = 'UN') as unique,
       (select titre || ' jusqu''au ' || to_char(fin at time zone 'Europe/Paris', 'DD/MM HH24:MI')
          from public.evenements order by id desc limit 1) as evenement,
       (select active from public.chasse where id = 1) as chasse_ouverte;
