-- =====================================================================
--  Mate TCG Online — version 2.0 « Reflets »
--  A executer apres 18_cadeaux.sql. Rejouable sans danger.
--
--  Ce que la 2.0 ajoute cote serveur, hors des fichiers qu'elle retouche
--  (les Reverses sont dans 03b_promos.sql, leur case de booster dans
--  03_rpc.sql) :
--    1. les parametres du jeu qu'un administrateur ouvre a la main ;
--    2. l'evenement « Reflets » : sa monnaie (les Prismes), son Pass de
--       recompenses, sa boutique et ses quetes (04_seed.sql) ;
--    3. Devine l'illu, l'illustration a deviner chaque jour (ses pixels sont
--       dans 21b_illu.sql) ;
--    4. les invitations, achetees en boutique ;
--    5. les titres et la personnalisation du profil.
-- =====================================================================

-- ============================================================ 1. reglages
-- Une seule ligne. `fabrication_reverse` : fermee au lancement de la 2.0 —
-- les Fragments deja accumules rempliraient la collection Reverse d'un coup.
-- L'ouvrir, plus tard, dans le SQL Editor :
--   update public.parametres set fabrication_reverse = true where id = 1;
create table if not exists public.parametres (
  id                  int primary key check (id = 1),
  fabrication_reverse boolean not null default false
);
-- Le sel de Devine l'illu : tire au hasard a l'installation, jamais montre.
-- Sans lui, l'ordre des illustrations se calculerait depuis le code public.
alter table public.parametres add column if not exists illu_sel text not null default md5(random()::text || clock_timestamp()::text);
insert into public.parametres (id) values (1) on conflict (id) do nothing;
alter table public.parametres enable row level security;
revoke all on public.parametres from anon, authenticated;

-- ===================================================== 2. l'evenement en cours
-- Le code de l'evenement en cours (15_evenements.sql), s'il en a un.
create or replace function public.evenement_en_cours() returns text
language sql stable security definer set search_path = public as $$
  select e.code from evenements e
   where e.code is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
$$;

-- ------------------------------------------------------------- les Prismes
-- La monnaie d'un evenement : `solde` se depense dans sa boutique, `total`
-- (tout ce qu'on a gagne) fait avancer sa piste de recompenses — acheter ne
-- fait jamais reculer la piste.
create table if not exists public.evt_comptes (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  solde     integer not null default 0 check (solde >= 0),
  total     integer not null default 0,
  primary key (user_id, evenement)
);
alter table public.evt_comptes enable row level security;
revoke all on public.evt_comptes from anon, authenticated;

create or replace function public.crediter_prismes(p uuid, ev text, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ev is null or coalesce(n, 0) <= 0 then return; end if;
  insert into evt_comptes (user_id, evenement, solde, total) values (p, ev, n, n)
  on conflict (user_id, evenement)
    do update set solde = evt_comptes.solde + n, total = evt_comptes.total + n;
end $$;

-- ------------------------------------------------------- le Pass de l'evenement
-- (`evt_piste` dans les tables : le Pass s'appelait la piste.)
create table if not exists public.evt_piste (
  evenement text not null,
  palier    integer not null,
  seuil     integer not null,
  -- boosters | eclats | fragments | titre | cadre | reverse_R | brillante
  type      text not null,
  montant   integer not null default 0,
  objet     text,
  titre     text not null,
  primary key (evenement, palier)
);
create table if not exists public.evt_piste_prises (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  palier    integer not null,
  pris_le   timestamptz not null default now(),
  primary key (user_id, evenement, palier)
);
alter table public.evt_piste enable row level security;
alter table public.evt_piste_prises enable row level security;
revoke all on public.evt_piste, public.evt_piste_prises from anon, authenticated;

-- Vingt paliers. Le calcul (quetes de 04_seed.sql, recompenses de Devine
-- l'illu plus bas) :
--   - un joueur qui vient chaque jour gagne ~55 Prismes par jour (du jour :
--     10 + 15 + ~15 pour l'illu trouvee + ~20 de l'illu elle-meme + 15 x 62 %
--     pour la Reverse Rare, 6 boosters par jour), soit ~770 en 14 jours, et
--     ~330 avec les quetes de l'evenement : ~1 100. Il finit le Pass dans les
--     derniers jours ;
--   - un joueur regulier (10 jours sur 14) en gagne ~700 : palier 14 ;
--   - un joueur de passage (5 jours) ~320 : palier 7.
-- Les ecarts grandissent, pour que les premiers paliers tombent vite.
delete from public.evt_piste where evenement = 'reflets' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('reflets',  1,   15, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  2,   40, 'eclats',   150, null,          '150 Éclats'),
  ('reflets',  3,   70, 'titre',      0, 't_eclaireur', 'Titre « Éclaireur des Reflets »'),
  ('reflets',  4,  105, 'fragments', 250, null,         '250 Fragments'),
  ('reflets',  5,  145, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  6,  190, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets',  7,  240, 'eclats',   300, null,          '300 Éclats'),
  ('reflets',  8,  295, 'boosters',   3, null,          '3 boosters'),
  ('reflets',  9,  355, 'fragments', 400, null,         '400 Fragments'),
  ('reflets', 10,  420, 'cadre',      0, 'f_miroir',    'Cadre « Miroir »'),
  ('reflets', 11,  490, 'eclats',   400, null,          '400 Éclats'),
  ('reflets', 12,  560, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets', 13,  630, 'boosters',   3, null,          '3 boosters'),
  ('reflets', 14,  700, 'fragments', 600, null,         '600 Fragments'),
  ('reflets', 15,  770, 'brillante',  1, null,          'Une Essence Brillante'),
  ('reflets', 16,  840, 'eclats',   500, null,          '500 Éclats'),
  ('reflets', 17,  910, 'boosters',   4, null,          '4 boosters'),
  ('reflets', 18,  980, 'reverse_R',  2, null,          'Deux Reverses Rares'),
  ('reflets', 19, 1040, 'titre',      0, 't_ame',       'Titre « Âme des Reflets »'),
  ('reflets', 20, 1100, 'cadre',      0, 'f_nebuleuse', 'Cadre « Nébuleuse »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ----------------------------------------------------------- accorder
-- Ce qu'une recompense donne, quelle qu'en soit la source (Pass, boutique
-- d'evenement). Renvoie les cartes accordees, pour que le navigateur les
-- montre.
--   reverse_R : une Reverse Rare qu'on n'a pas (une au hasard si on les a
--               toutes) ; brillante : une Essence Brillante qu'on n'a pas
--               (2 000 Fragments si on les a toutes) ; legendaire : une
--               Legendaire qu'on n'a pas (4 000 Fragments sinon) ; tapis,
--               sleeve : un cosmetique de combat (version 3.0).
create or replace function public.accorder(p uuid, t text, n int, objet text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cartes text[] := '{}'; cid text; i int;
begin
  if t = 'boosters' then
    update profiles set boosters_bonus = boosters_bonus + n where id = p;
  elsif t = 'eclats' then
    update profiles set shards = shards + n where id = p;
  elsif t = 'fragments' then
    update profiles set fragments = fragments + n where id = p;
  elsif t in ('titre', 'cadre', 'tapis', 'sleeve') then
    -- Version 3.0 : un tapis de jeu ou un sleeve (23_combats.sql) se range
    -- comme un cadre, sous son identifiant.
    insert into inventory (user_id, item_id, qty) values (p, objet, 1)
      on conflict (user_id, item_id) do nothing;
  elsif t = 'legendaire' then
    -- Version 3.0 (Pass du Choc) : une Legendaire de l'extension qu'on n'a
    -- pas ; si on les a toutes, la moitie du prix d'une Legendaire fabriquee.
    select k.id into cid from cards k
     where k.rar = 'L' and not k.promo
       and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
     order by random() limit 1;
    if cid is null then
      update profiles set fragments = fragments + cfg('fabrication_L') / 2 where id = p;
    else
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end if;
  elsif t = 'reverse_R' then
    for i in 1..greatest(n, 1) loop
      select k.id into cid from cards k
       where k.reverse and k.rar = 'R' and k.id <> all (cartes)
         and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
       order by random() limit 1;
      if cid is null then
        select k.id into cid from cards k where k.reverse and k.rar = 'R' order by random() limit 1;
      end if;
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end loop;
  elsif t = 'brillante' then
    select k.id into cid from cards k
     where k.rar = 'BR'
       and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
     order by random() limit 1;
    if cid is null then
      update profiles set fragments = fragments + 2000 where id = p;
    else
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end if;
  else
    raise exception 'Récompense inconnue.';
  end if;
  if array_length(cartes, 1) is not null then
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;
  return to_jsonb(cartes);
end $$;

-- ----------------------------------------------- reclamer un palier du Pass
create or replace function public.piste_reclamer(p_palier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); pa evt_piste; tot int; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then raise exception 'Aucun événement en cours.'; end if;
  select * into pa from evt_piste where evenement = ev and palier = p_palier;
  if not found then raise exception 'Palier inconnu.'; end if;
  select total into tot from evt_comptes where user_id = p and evenement = ev for update;
  if coalesce(tot, 0) < pa.seuil then raise exception 'Palier pas encore atteint.'; end if;

  insert into evt_piste_prises (user_id, evenement, palier) values (p, ev, p_palier)
    on conflict do nothing;
  if not found then raise exception 'Récompense déjà récupérée.'; end if;

  cartes := accorder(p, pa.type, pa.montant, pa.objet);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- ----------------------------------------------- l'etat de l'evenement
-- Pour l'onglet de l'evenement : son solde, son Pass, et les dix joueurs qui
-- ont gagne le plus de Prismes.
create or replace function public.evenement_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); cpt evt_comptes;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then return 'null'::jsonb; end if;
  -- Ouvrir l'onglet de l'evenement accomplit sa quete du jour « Passe voir
  -- l'evenement ». Pas la connexion du jour (`checkin`) : elle a souvent eu
  -- lieu avant l'ouverture de l'evenement, et la quete serait restee vide.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite' and q.evenement = ev
  on conflict (user_id, quest_id, period_key) do nothing;
  select * into cpt from evt_comptes where user_id = p and evenement = ev;

  return jsonb_build_object(
    'code', ev,
    'solde', coalesce(cpt.solde, 0),
    'total', coalesce(cpt.total, 0),
    'piste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palier', pa.palier, 'seuil', pa.seuil, 'type', pa.type, 'montant', pa.montant,
               'objet', pa.objet, 'titre', pa.titre,
               'pris', exists (select 1 from evt_piste_prises x
                                where x.user_id = p and x.evenement = ev and x.palier = pa.palier))
             order by pa.palier)
        from evt_piste pa where pa.evenement = ev), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'xp', xp_de(pr.id), 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = ev and total > 0
               order by total desc limit 10) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb));
end $$;

-- --------------------------------------------- apres l'evenement : le recap
-- Pendant trois jours apres la fin d'un evenement, son onglet devient un
-- recap : ce que le joueur y a fait, le podium, et la suite. me() en porte
-- l'annonce (le code, les dates) ; evenement_recap() donne le detail.
-- Version 2.5 (reportee) : `recap_jusqua` fixe la fin du recap ; vide, trois
-- jours apres la fin de l'evenement, comme avant. La 2.5 l'a pose pour Reflets
-- (jusqu'au dimanche 25 octobre 2026 minuit).
alter table public.evenements add column if not exists recap_jusqua timestamptz;

create or replace function public.evenement_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                            'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
    from evenements e
   where e.code is not null and now() >= e.fin and now() < coalesce(e.recap_jusqua, e.fin + interval '3 days')
     and evenement_en_cours() is null
   order by e.fin desc limit 1;
$$;

create or replace function public.evenement_recap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); e evenements; cpt evt_comptes; rang int; nb int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into e from evenements
   where code is not null and now() >= fin and now() < coalesce(recap_jusqua, fin + interval '3 days')
   order by fin desc limit 1;
  if not found then return 'null'::jsonb; end if;
  select * into cpt from evt_comptes where user_id = p and evenement = e.code;
  select count(*) + 1 into rang from evt_comptes
   where evenement = e.code and total > coalesce(cpt.total, 0);
  select count(*) into nb from evt_comptes where evenement = e.code and total > 0;
  return jsonb_build_object(
    'code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
    'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'),
    'total', coalesce(cpt.total, 0),
    'paliers', (select count(*) from evt_piste pa where pa.evenement = e.code and pa.seuil <= coalesce(cpt.total, 0)),
    'paliers_max', (select count(*) from evt_piste pa where pa.evenement = e.code),
    'pris', (select count(*) from evt_piste_prises x where x.user_id = p and x.evenement = e.code),
    'illus', (select count(*) from devine_illu d where d.user_id = p and d.trouve
               and d.jour between (e.debut at time zone 'Europe/Paris')::date and (e.fin at time zone 'Europe/Paris')::date),
    'reverses', (select count(*) from collection c join cards k on k.id = c.card_id
                  where c.user_id = p and c.qty > 0 and k.reverse),
    'reverses_max', (select count(*) from cards where reverse),
    'quetes', (select count(*) from quest_progress qp join quests q on q.id = qp.quest_id
                where qp.user_id = p and qp.claimed and q.evenement = e.code),
    'rang', case when coalesce(cpt.total, 0) > 0 then rang end,
    'joueurs', nb,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'xp', xp_de(pr.id), 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = e.code and total > 0
               order by total desc limit 3) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb))
    -- Version 3.0 : ce que le Choc des Sections ajoute au recap (25_choc.sql) —
    -- et le titre de la Section gagnante, accorde ici.
    || case when e.code = 'choc' then choc_recap(p) else '{}'::jsonb end;
end $$;

-- ========================================================= 3. Devine l'illu
-- Une illustration a deviner par jour, la meme pour tout le monde : celle
-- d'une carte de l'extension, Essences exceptees. Elle arrive pixelisee, et
-- chaque essai rate la rend plus nette : 9 x 6 pixels, puis 12 x 8, 18 x 12
-- et 36 x 24. Quatre essais. Plus on trouve tot, plus ca rapporte : des
-- Eclats toujours, et des Prismes pendant l'evenement Reflets.
--
-- Le serveur garde les grilles (illu_pixels, remplie par 21b_illu.sql) et
-- n'envoie que celle du moment : le navigateur ne connait la carte qu'une
-- fois la partie finie. Le jeu est ne avec l'evenement Reflets et lui
-- survit : il a ensuite son propre onglet.
create table if not exists public.illu_pixels (
  card_id text primary key references public.cards on delete cascade,
  data    bytea not null          -- 36 x 24 pixels, 12 bits chacun
);
create table if not exists public.devine_illu (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  text[] not null default '{}',
  trouve  boolean not null default false,
  primary key (user_id, jour)
);
alter table public.illu_pixels enable row level security;
alter table public.devine_illu enable row level security;
revoke all on public.illu_pixels, public.devine_illu from anon, authenticated;

create or replace function public.illu_jour() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date; $$;

-- L'illustration du jour, la meme pour tous. Les cartes sont rangees une
-- fois pour toutes dans un ordre secret (md5 du sel de `parametres`), et
-- chaque jour prend la suivante : aucune ne revient avant d'avoir vu passer
-- toutes les autres (113 jours). Rien a lancer chaque jour : la date suffit.
create or replace function public.illu_cible(j date) returns text
language sql stable security definer set search_path = public as $$
  with l as (
    select k.id, row_number() over (order by md5((select illu_sel from parametres where id = 1) || ':' || k.id)) - 1 as rang
      from cards k join illu_pixels x on x.card_id = k.id
     where not k.promo and k.cat <> 'essence')
  select id from l
   where rang = ((j - date '2026-01-01') % (select count(*) from l) + (select count(*) from l)) % (select count(*) from l);
$$;

-- Ce que rapporte l'illu trouvee au n-ieme essai.
create or replace function public.illu_gain(n int) returns jsonb
language sql immutable as $$
  select case n when 1 then '{"prismes":25,"eclats":120}'::jsonb
                when 2 then '{"prismes":18,"eclats":90}'::jsonb
                when 3 then '{"prismes":12,"eclats":60}'::jsonb
                else        '{"prismes":6,"eclats":30}'::jsonb end;
$$;

-- La grille du niveau 1 a 4 : la grille fine, moyennee par blocs de 4, 3, 2
-- ou 1 pixels de cote. En RGB, 3 octets par pixel, en base64.
create or replace function public.illu_grille(cid text, niveau int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  src bytea; f int := case niveau when 1 then 4 when 2 then 3 when 3 then 2 else 1 end;
  w int := 36 / f; h int := 24 / f; o bytea; x int; y int; dx int; dy int; k int; i int; n int;
  s int[];
begin
  select data into src from illu_pixels where card_id = cid;
  if src is null then return null; end if;
  o := decode(repeat('00', w * h * 3), 'hex');
  for y in 0 .. h - 1 loop
    for x in 0 .. w - 1 loop
      s := array[0, 0, 0];
      for dy in 0 .. f - 1 loop
        for dx in 0 .. f - 1 loop
          i := (y * f + dy) * 36 + x * f + dx;
          for k in 0 .. 2 loop
            n := i * 3 + k;
            s[k + 1] := s[k + 1] + 17 * (case when n % 2 = 0 then get_byte(src, n / 2) >> 4
                                               else get_byte(src, n / 2) & 15 end);
          end loop;
        end loop;
      end loop;
      for k in 0 .. 2 loop
        o := set_byte(o, (y * w + x) * 3 + k, round(s[k + 1]::numeric / (f * f))::int);
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('w', w, 'h', h, 'data', encode(o, 'base64'));
end $$;

create or replace function public.illu_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; fini boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  cible := illu_cible(j);
  if cible is null then return 'null'::jsonb; end if;
  select * into d from devine_illu where user_id = p and jour = j;
  n := coalesce(array_length(d.essais, 1), 0);
  fini := coalesce(d.trouve, false) or n >= 4;
  return jsonb_build_object(
    'jour', j, 'max', 4,
    'essais', to_jsonb(coalesce(d.essais, '{}')),
    'trouve', coalesce(d.trouve, false),
    'fini', fini,
    'niveau', case when fini then 4 else n + 1 end,
    'grille', case when fini then null else illu_grille(cible, n + 1) end,
    'cible', case when fini then cible end,
    'gain', case when d.trouve then illu_gain(n) end,
    'gains', jsonb_build_array(illu_gain(1), illu_gain(2), illu_gain(3), illu_gain(4)),
    -- Les Prismes ne se gagnent que pendant l'evenement.
    'prismes', evenement_en_cours() is not distinct from 'reflets');
end $$;

-- Trouver rapporte des Prismes et des Eclats selon l'essai (illu_gain), et
-- fait avancer les quetes « illu ».
create or replace function public.illu_essai(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; g jsonb; ok boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  cible := illu_cible(j);
  if not exists (select 1 from cards where id = p_carte and not promo and cat <> 'essence') then
    raise exception 'Cette carte ne fait pas partie du jeu.';
  end if;

  insert into devine_illu (user_id, jour) values (p, j) on conflict do nothing;
  select * into d from devine_illu where user_id = p and jour = j for update;
  n := coalesce(array_length(d.essais, 1), 0);
  if d.trouve or n >= 4 then raise exception 'La partie du jour est finie : rendez-vous demain.'; end if;
  if p_carte = any (d.essais) then raise exception 'Tu as déjà proposé cette carte.'; end if;

  ok := p_carte = cible;
  update devine_illu set essais = essais || p_carte, trouve = ok where user_id = p and jour = j;
  if ok then
    g := illu_gain(n + 1);
    update profiles set shards = shards + (g->>'eclats')::int where id = p;
    if evenement_en_cours() = 'reflets' then
      perform crediter_prismes(p, 'reflets', (g->>'prismes')::int);
    end if;
    perform bump_quests(p, 'illu', 1);
  end if;
  return jsonb_build_object('illu', illu_etat(), 'etat', me());
end $$;

-- ------------------------------------------------ les doublons de mes amis
-- Pour l'onglet Echanges : chaque carte qui me manque et qu'un ami a en
-- double (donc qu'il peut ceder), avec ces amis-la, le plus fourni en tete.
-- Seulement des cartes echangeables : ni Essences ni Promos (les Reverses
-- le sont).
create or replace function public.amis_doublons() returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return coalesce((
    select jsonb_agg(jsonb_build_object('carte', x.id, 'amis', x.amis) order by x.n desc, x.id)
      from (select k.id, count(*) as n,
                   jsonb_agg(jsonb_build_object('pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame, 'xp', xp_de(o.id),
                                                'photo', photo_discord(o.id), 'n', c.qty)
                             order by c.qty desc, lower(o.pseudo)) as amis
              from friendships f
              join profiles o on o.id = case when f.a = moi then f.b else f.a end
              -- Version 2.1 : au-dela de ce qu'il garde (garde_de, 22_garder.sql).
              join collection c on c.user_id = o.id and c.qty > garde_de(o.id, c.card_id)
              join cards k on k.id = c.card_id
             where (f.a = moi or f.b = moi) and f.accepte
               -- Version 3.0.11 : les Essences Brillantes, qui s'echangent entre elles.
               and (k.cat <> 'essence' or k.rar = 'BR') and (not k.promo or k.reverse or k.secrete or k.rar = 'BR')
               and not exists (select 1 from collection m where m.user_id = moi and m.card_id = k.id and m.qty > 0)
             group by k.id) x), '[]'::jsonb);
end $$;

-- =========================================================== 4. invitations
-- Achetees en boutique (2 000 Eclats, trois par joueur, shop_buy dans
-- 03_rpc.sql). Un code sert une fois : la personne invitee se connecte avec
-- Discord, le saisit sur l'ecran d'attente, et entre sur la liste des
-- invites. Elle trouve un cadeau de bienvenue de la part de son parrain :
-- 10 boosters hors reserve (en plus des 5 de depart) et 1 000 Eclats.
create table if not exists public.invitations (
  code        text primary key,
  auteur      uuid not null references public.profiles on delete cascade,
  cree_le     timestamptz not null default now(),
  utilise_par uuid references public.profiles on delete set null,
  utilise_le  timestamptz
);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;

-- Un filleul : un compte entre grace au code d'un autre. Il ne peut pas
-- inviter a son tour (version 2.1) : sinon chaque invite ouvre la porte a
-- d'autres, et la liste d'acces ne veut plus rien dire.
create or replace function public.est_filleul(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invitations where utilise_par = p)
$$;

create or replace function public.creer_invitation(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if est_filleul(p) then raise exception 'Les joueurs invités ne peuvent pas inviter à leur tour.'; end if;
  loop
    c := 'M8-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from invitations where code = c);
  end loop;
  insert into invitations (code, auteur) values (c, p);
  return c;
end $$;

-- La seule fonction du jeu qu'un compte pas encore invite peut appeler, avec
-- me() : c'est elle qui le fait entrer.
create or replace function public.utiliser_invitation(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); inv invitations; u auth.users; parrain text;
begin
  if p is null then raise exception 'non connecte'; end if;
  if beta_ouverte() or est_invite(p) then raise exception 'Tu as déjà accès au jeu.'; end if;

  select * into inv from invitations
   where upper(code) = upper(trim(coalesce(p_code, ''))) and utilise_par is null for update;
  if not found then raise exception 'Code inconnu ou déjà utilisé.'; end if;
  if inv.auteur = p then raise exception 'Ce code est le tien : donne-le à un ami.'; end if;

  select * into u from auth.users where id = p;
  select pseudo into parrain from profiles where id = inv.auteur;
  insert into beta_invites (cle, note)
  values (coalesce(nullif(u.raw_user_meta_data->>'provider_id', ''), lower(u.email)),
          'Invité par ' || coalesce(parrain, '?') || ' (' || inv.code || ')')
  on conflict (cle) do nothing;

  update invitations set utilise_par = p, utilise_le = now() where code = inv.code;
  perform bump_quests(inv.auteur, 'invite', 1);
  insert into cadeaux (user_id, boosters, eclats, message, auteur)
  values (p, 10, 1000, 'Bienvenue ! ' || coalesce(parrain, 'Un joueur') || ' t''a invité : voici de quoi bien commencer.', inv.auteur);
  return me();
end $$;

-- Version 2.1 : les codes qu'un filleul avait achetes avant la regle, et
-- qui n'ont pas servi, sont annules et rembourses (prix de l'article, et
-- une place de plus dans sa limite d'achat). Rejouable : une fois annules,
-- il n'en reste plus a rembourser. Les codes deja utilises restent : on ne
-- reprend pas l'acces a quelqu'un qui est entre.
with revoques as (
  delete from public.invitations i
   where i.utilise_par is null
     and exists (select 1 from public.invitations f where f.utilise_par = i.auteur)
  returning i.auteur
), parjoueur as (
  select auteur, count(*)::int as n from revoques group by auteur
), rembourse as (
  update public.profiles pr
     set shards = pr.shards + j.n * coalesce((select prix from public.shop_items where id = 's_invite'), 2000)
    from parjoueur j where pr.id = j.auteur
  returning pr.id
)
update public.inventory iv
   set qty = greatest(0, iv.qty - j.n)
  from parjoueur j
 where iv.user_id = j.auteur and iv.item_id = 's_invite';

-- ===================================================== 5. titres et profil
-- Les titres qu'un joueur a debloques. La plupart viennent de ses succes
-- (15_evenements.sql), calcules a la volee comme eux ; les autres sont des
-- objets gagnes (inventaire, `t_…`) : Pass d'evenement, boutique, quetes.
-- Les noms vivent dans TITRES (js/config.js).
create or replace function public.titres_de(p uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := succes_de(p); t text[] := '{}';
begin
  if s ? 'pionnier'          then t := array_append(t, 't_pionnier'); end if;
  if s ? 'unique'            then t := array_append(t, 't_elu'); end if;
  if s ? 'master_set'        then t := array_append(t, 't_maitre'); end if;
  if s ? 'negociant'         then t := array_append(t, 't_negociant'); end if;
  if s ? 'godpack'           then t := array_append(t, 't_chanceux'); end if;
  if s ? 'boosters_100'      then t := array_append(t, 't_centurion'); end if;
  if s ? 'serie_30'          then t := array_append(t, 't_fidele'); end if;
  if s ? 'artisan'           then t := array_append(t, 't_artisan'); end if;
  if s ? 'toutes_brillantes' then t := array_append(t, 't_prisme'); end if;
  if s ? 'reverses_toutes'   then t := array_append(t, 't_reflet'); end if;
  if exists (select 1 from profiles where id = p and is_admin) then t := array_append(t, 't_admin'); end if;
  select t || coalesce(array_agg(item_id order by item_id), '{}') into t
    from inventory where user_id = p and qty > 0 and item_id like 't\_%';
  return t;
end $$;

-- Changer son titre, sa banniere ou sa devise. Un parametre vide ('') retire,
-- un parametre absent (null) ne touche a rien.
create or replace function public.personnaliser(p_titre text, p_banniere text, p_devise text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_titre is not null then
    if p_titre <> '' and not (p_titre = any (titres_de(p))) then
      raise exception 'Ce titre n''est pas encore débloqué.';
    end if;
    update profiles set titre = nullif(p_titre, '') where id = p;
    if p_titre <> '' then perform bump_quests(p, 'titre', 1); end if;
  end if;

  if p_banniere is not null then
    if p_banniere <> '' and not exists (select 1 from collection
                                         where user_id = p and card_id = p_banniere and qty > 0) then
      raise exception 'Tu ne possèdes pas cette carte.';
    end if;
    update profiles set banniere = nullif(p_banniere, '') where id = p;
    if p_banniere <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  if p_devise is not null then
    d := left(regexp_replace(trim(p_devise), '\s+', ' ', 'g'), 80);
    update profiles set devise = nullif(d, '') where id = p;
    if d <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  return me();
end $$;

-- ================================================ l'evenement « Reflets »
-- Deux semaines a partir de la mise a jour, sans rien changer au rythme des
-- boosters. Le redater, dans le SQL Editor :
--   update public.evenements set debut = …, fin = … where code = 'reflets';
insert into public.evenements (titre, texte, debut, fin, ticket_minutes, code)
select 'Reflets', 'La version 2.0 : les Reverses, des cadres, des titres, Devine l''illu. Gagne des Prismes et remonte le Pass.',
       now(), now() + interval '14 days', null, 'reflets'
 where not exists (select 1 from public.evenements where code = 'reflets');

-- ================================================================= droits
revoke all on function public.evenement_en_cours, public.crediter_prismes, public.accorder,
  public.illu_cible, public.illu_grille, public.creer_invitation, public.est_filleul, public.titres_de
  from public, anon, authenticated;
revoke all on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser, public.evenement_recap,
  public.evenement_recent, public.amis_doublons from public, anon;
grant execute on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser, public.evenement_recap,
  public.amis_doublons to authenticated;
