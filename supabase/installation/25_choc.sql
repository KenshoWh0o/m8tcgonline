-- =====================================================================
--  Mate TCG Online — version 3.0 : l'evenement « Le Choc des Sections »
--  A executer apres 24_secretes.sql. Rejouable sans danger.
--
--  Deux semaines autour des Combats (23_combats.sql ; trois jusqu'a la
--  3.0.12, ramenees a deux en 3.0.13 a la demande du proprietaire : a la fin
--  du Choc commence le raid suivant), avec ce qu'un evenement apporte deja
--  depuis la 2.0 (21_reflets.sql) : une monnaie — les Etincelles, rangees
--  dans evt_comptes comme les Prismes —, des quetes (04_seed.sql), un Pass
--  de vingt paliers, une boutique (04_seed.sql) et un classement. En plus, l'Epreuve du jour : le meme combat pour tout le
--  monde (les decks et la regle se deduisent de la graine du jour,
--  js/combat/choc-data.js). Trois essais, le meilleur compte, un classement
--  du jour.
--
--  Le Raid (27_raid.sql) reste toute l'annee ; pendant l'evenement, il paie
--  en Etincelles, et ce qu'on y fait compte pour le recap (choc_joueurs).
--
--  La Guerre de l'evenement (points de Section doubles) a ete retiree du
--  pre-build : ses tables et ses fonctions sont supprimees plus bas si une
--  base de test les a encore.
--
--  Les chiffres de l'Epreuve sont aussi dans js/combat/choc-data.js
--  (CHOC) : les deux doivent rester d'accord. L'equilibrage est explique
--  dans docs/economie-3.0.md.
--
--  L'evenement ne s'ouvre pas tout seul : voir tout en bas de ce fichier.
-- =====================================================================

-- ============================================================ 1. tables
-- Ce que chaque joueur a fait au boss du Raid pendant l'evenement (le
-- recap) : raid_fin (27_raid.sql) le tient a jour.
create table if not exists public.choc_joueurs (
  user_id   uuid primary key references public.profiles on delete cascade,
  degats    integer not null default 0,
  victoires integer not null default 0
);
-- L'Epreuve du jour : les essais d'un joueur, un jour donne
-- ([{ gagne, tours, pv, touches }]), et si sa premiere victoire est payee.
create table if not exists public.choc_epreuves (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  jsonb not null default '[]'::jsonb,
  gagnee  boolean not null default false,
  primary key (user_id, jour)
);

-- La Guerre de l'evenement : retiree.
drop function if exists public.choc_points(uuid, text, int);
drop function if exists public.choc_multiplicateur();
drop table if exists public.choc_guerre;
drop table if exists public.choc_contrib;

alter table public.choc_joueurs    enable row level security;
alter table public.choc_epreuves   enable row level security;
revoke all on public.choc_joueurs, public.choc_epreuves from anon, authenticated;

-- ============================================================ 3. le Pass
-- Vingt paliers (trente jusqu'a la 3.0.12, pour trois semaines). Le calcul
-- (docs/economie-3.0.md) : un joueur engage (toutes les quetes du jour, trois
-- Raids, trois essais d'Epreuve) gagne ~2 900 Etincelles en deux semaines et
-- finit le Pass vers le 12e jour ; un joueur occasionnel ~1 450, palier 14.
-- Les six exclusifs (trois titres, le sleeve, le cadre, le tapis) et
-- l'Essence Brillante restent ; boosters, Eclats, Fragments et Reverses sont
-- ramenes a environ deux tiers, comme la duree.
delete from public.evt_piste where evenement = 'choc' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('choc',  1,   20, 'boosters',    2, null,            '2 boosters'),
  ('choc',  2,   50, 'titre',       0, 't_recrue',      'Titre « Recrue du Choc »'),
  ('choc',  3,   90, 'eclats',    200, null,            '200 Éclats'),
  ('choc',  4,  140, 'fragments',  400, null,           '400 Fragments'),
  ('choc',  5,  200, 'sleeve',      0, 's_choc',        'Sleeve « Le Choc »'),
  ('choc',  6,  270, 'boosters',    3, null,            '3 boosters'),
  ('choc',  7,  350, 'reverse_R',   1, null,            'Une Reverse Rare'),
  ('choc',  8,  440, 'eclats',    400, null,            '400 Éclats'),
  ('choc',  9,  540, 'cadre',       0, 'f_choc',        'Cadre « Choc »'),
  ('choc', 10,  650, 'boosters',    3, null,            '3 boosters'),
  ('choc', 11,  770, 'fragments',  700, null,           '700 Fragments'),
  ('choc', 12,  900, 'brillante',   1, null,            'Une Essence Brillante'),
  ('choc', 13, 1040, 'eclats',    500, null,            '500 Éclats'),
  ('choc', 14, 1200, 'boosters',    4, null,            '4 boosters'),
  ('choc', 15, 1380, 'titre',       0, 't_veteran',     'Titre « Vétéran du Choc »'),
  ('choc', 16, 1580, 'reverse_R',   2, null,            'Deux Reverses Rares'),
  ('choc', 17, 1800, 'fragments', 1000, null,           '1 000 Fragments'),
  ('choc', 18, 2040, 'boosters',    4, null,            '4 boosters'),
  ('choc', 19, 2280, 'titre',       0, 't_maitre_choc', 'Titre « Maître du Choc »'),
  ('choc', 20, 2500, 'tapis',       0, 't_arene',       'Tapis « Le Choc des Sections »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ============================================================ 4. outils
-- La graine de l'Epreuve : la meme pour tout le monde un jour donne, et
-- impossible a deviner d'avance (le sel de parametres, 21_reflets.sql).
create or replace function public.choc_graine(j date) returns bigint
language sql stable security definer set search_path = public as $$
  select ('x' || substr(md5('choc-epreuve:' || j::text || (select illu_sel from parametres where id = 1)), 1, 8))::bit(32)::bigint + 1;
$$;

-- Le score d'un essai (scoreEpreuve, js/combat/choc-data.js) : la victoire
-- d'abord ; entre deux victoires, le moins de tours puis le plus de PV ;
-- entre deux defaites, le plus de PV pris a l'adversaire.
create or replace function public.choc_score(s jsonb) returns integer
language sql immutable as $$
  select case when s is null then 0
    when coalesce((s->>'gagne')::boolean, false)
      then 100000 + (100 - least(99, greatest(0, coalesce((s->>'tours')::int, 0)))) * 100
           + least(99, greatest(0, coalesce((s->>'pv')::int, 0)))
    else least(99, greatest(0, coalesce((s->>'touches')::int, 0))) * 100
           + least(99, greatest(0, coalesce((s->>'pv')::int, 0))) end;
$$;

-- L'ancien Raid a phases et calendrier : retire (27_raid.sql).
drop function if exists public.choc_jour_ev();

-- ===================================================== 5. ouvrir, clore
-- Appeles par combat_debut et combat_fin (23_combats.sql).
create or replace function public.choc_debut(p uuid, p_mode text, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j date := jour_paris(); e choc_epreuves; ev evenements;
begin
  if evenement_en_cours() is distinct from 'choc' then raise exception 'L''événement est terminé.'; end if;
  if p_mode <> 'epreuve' then raise exception 'Mode inconnu.'; end if;
  -- L'Epreuve : l'essai compte des l'ouverture — en abandonner un ne le
  -- rend pas. Il est note perdu jusqu'a ce que le resultat arrive.
  if p_cle is distinct from j::text then raise exception 'L''Épreuve a changé : recharge la page.'; end if;
  insert into choc_epreuves (user_id, jour) values (p, j) on conflict do nothing;
  select * into e from choc_epreuves where user_id = p and jour = j for update;
  if jsonb_array_length(e.essais) >= 3 then raise exception 'Épreuve terminée : une nouvelle demain.'; end if;
  update choc_epreuves set essais = essais || '[{"gagne":false,"tours":0,"pv":0,"touches":0,"abandon":true}]'::jsonb
   where user_id = p and jour = j;
  -- `n` (3.0.14) : le n-ieme jour de l'evenement, comme choc_etat : il
  -- choisit la regle du jour ; le serveur le garde pour rejouer le combat.
  select * into ev from evenements x where x.code = 'choc' and now() >= x.debut and now() < x.fin
   order by x.debut desc limit 1;
  return jsonb_build_object('niveau', 3, 'phase', null, 'graine', choc_graine(j),
                            'n', j - (ev.debut at time zone 'Europe/Paris')::date + 1);
end $$;

create or replace function public.choc_fin(p uuid, o public.combats_ouverts, gagne boolean, res jsonb, trop boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare insignes int := 0; msg text := ''; e choc_epreuves; i int; score jsonb;
begin
  -- L'Epreuve du jour : le resultat remplace le premier essai encore ouvert.
  perform bump_quests(p, 'epreuve', 1);
  select * into e from choc_epreuves where user_id = p and jour = o.jour for update;
  score := jsonb_build_object('gagne', gagne, 'tours', greatest(0, coalesce((res->>'tours')::int, 0)),
                              'pv', greatest(0, coalesce((res->>'pv')::int, 0)),
                              'touches', greatest(0, coalesce((res->>'touches')::int, 0)));
  select min(k - 1) into i from jsonb_array_elements(e.essais) with ordinality t(x, k)
   where coalesce((x->>'abandon')::boolean, false);
  if i is not null then
    update choc_epreuves set essais = jsonb_set(essais, array[i::text], score) where user_id = p and jour = o.jour;
  end if;
  if trop then
    return jsonb_build_object('insignes', 0, 'message', 'Combat trop court pour compter.');
  end if;
  insignes := 5;
  if gagne and not e.gagnee then
    update choc_epreuves set gagnee = true where user_id = p and jour = o.jour;
    insignes := insignes + 25;
    perform bump_quests(p, 'epreuve_victoires', 1);
    msg := 'Épreuve du jour gagnée !';
  elsif gagne then
    msg := 'Déjà gagnée aujourd''hui : ton meilleur score est gardé.';
  end if;
  perform crediter_prismes(p, 'choc', insignes);
  return jsonb_build_object('insignes', insignes, 'message', msg);
end $$;

-- ===================================================== 6. l'etat de l'evenement
create or replace function public.choc_joueur_vue(id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
                            'xp', xp_de(pr.id), 'photo', photo_discord(pr.id),
                            'section', (select section from combat_joueurs where user_id = pr.id))
    from profiles pr where pr.id = choc_joueur_vue.id;
$$;

create or replace function public.choc_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := jour_paris(); e choc_epreuves; ev evenements;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'choc' then return 'null'::jsonb; end if;
  -- « Passe voir l'evenement », comme evenement_etat (21_reflets.sql).
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite' and q.evenement = 'choc'
  on conflict (user_id, quest_id, period_key) do nothing;
  select * into e from choc_epreuves where user_id = p and jour = j;
  select * into ev from evenements x where x.code = 'choc' and now() >= x.debut and now() < x.fin
   order by x.debut desc limit 1;
  return jsonb_build_object(
    'jour', j,
    -- Version 3.0.11 : le numero de l'Epreuve, le n-ieme jour de l'evenement
    -- (heure de Paris), sur `jours` (14 pour un Choc ouvert a minuit : les
    -- dates qu'il touche). Il choisit la regle du calendrier
    -- (CHOC.epreuve.calendrier, js/combat/choc-data.js).
    'n', j - (ev.debut at time zone 'Europe/Paris')::date + 1,
    'jours', ((ev.fin - interval '1 microsecond') at time zone 'Europe/Paris')::date
             - (ev.debut at time zone 'Europe/Paris')::date + 1,
    'epreuve', jsonb_build_object(
      'graine', choc_graine(j),
      'essais', coalesce(e.essais, '[]'::jsonb),
      'max', 3,
      'meilleur', (select x from jsonb_array_elements(coalesce(e.essais, '[]'::jsonb)) x order by choc_score(x) desc limit 1),
      'gagnee', coalesce(e.gagnee, false),
      'top', coalesce((
        select jsonb_agg(choc_joueur_vue(b.user_id) || b.s || jsonb_build_object('moi', b.user_id = p) order by choc_score(b.s) desc)
          from (select ce.user_id,
                       (select x from jsonb_array_elements(ce.essais) x
                         where not coalesce((x->>'abandon')::boolean, false)
                         order by choc_score(x) desc limit 1) s
                  from choc_epreuves ce where ce.jour = j) b
         where b.s is not null), '[]'::jsonb)));
end $$;

-- Ce que le recap de l'evenement ajoute (evenement_recap, 21_reflets.sql) :
-- le Raid pendant l'evenement, et l'Epreuve.
create or replace function public.choc_recap(p uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'degats', coalesce((select degats from choc_joueurs where user_id = p), 0),
    -- Les phases du Raid abattues pendant l'evenement (27_raid.sql).
    'raid_phases', (select count(*) from raid_tombees t
                     where exists (select 1 from evenements e where e.code = 'choc'
                                    and t.tombee_le >= e.debut and t.tombee_le < e.fin)),
    'epreuves', (select count(*) from choc_epreuves where user_id = p and gagnee),
    'section', (select section from combat_joueurs where user_id = p));
end $$;

-- ============================================================ 7. droits
revoke all on function public.choc_graine, public.choc_score, public.choc_debut, public.choc_fin,
  public.choc_joueur_vue, public.choc_recap from public, anon, authenticated;
revoke all on function public.choc_etat from public, anon;
grant execute on function public.choc_etat to authenticated;

-- Version 3.0.17 (le proprietaire, 8 novembre 2026 : la sortie ce soir a
-- minuit, « essaye d'automatiser ou de faire toi-meme au maximum ») : une base
-- 2.x qui recoit la 3.0 ouvre le Choc d'elle-meme, a la sortie (lundi
-- 9 novembre 2026, 0 h, heure de Paris ; collee un autre jour, a minuit ce
-- jour-la), pour quatorze jours : quatorze Epreuves, le raid 1 des le premier
-- jour. Une seule fois : seulement si cette meme mise a jour vient de mettre
-- la base en maintenance (01_schema.sql), et si aucun Choc n'existe.
do $$
declare d timestamptz;
begin
  if exists (select 1 from maintenance where id = 1 and par = 'la mise à jour 3.0' and depuis > now() - interval '1 hour')
     and not exists (select 1 from evenements where code = 'choc') then
    d := greatest(timestamptz '2026-11-09 00:00:00+01',
                  (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris');
    insert into evenements (titre, texte, debut, fin, code) values (
      'Le Choc des Sections',
      'La version 3.0 : le Raid, un nouveau boss toutes les deux semaines, et l''Épreuve du jour.',
      d, d + interval '14 days', 'choc');
  end if;
end $$;

-- =====================================================================
--  Ouvrir l'evenement — a la main, le jour venu, dans le SQL Editor :
--
--    insert into public.evenements (titre, texte, debut, fin, code) values (
--      'Le Choc des Sections',
--      'La version 3.0 : le Raid, un nouveau boss toutes les deux semaines, et l''Épreuve du jour.',
--      '2026-11-02 00:00+01', '2026-11-16 00:00+01', 'choc');
--
--  (Les dates sont un exemple.) A minuit, heure de Paris : quatorze jours
--  pleins, donc quatorze Epreuves (choc_etat › n, de 1 a 14) ; le raid 1
--  commence le premier jour, et le raid 2 le lendemain de la fin du Choc
--  (raid_ancre, 27_raid.sql : un raid tous les quatorze jours). Ouvert a une
--  autre heure, l'evenement touche quinze dates : la premiere et la derniere
--  Epreuve sont plus courtes, et la quinzieme reprend une regle a tour de
--  role (regleEpreuve). Un evenement sans `ticket_minutes` ne change pas le
--  rythme des boosters.
--  Pour le fermer plus tot :
--    update public.evenements set fin = now() where code = 'choc' and fin > now();
-- =====================================================================
