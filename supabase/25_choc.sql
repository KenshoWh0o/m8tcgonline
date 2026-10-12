-- =====================================================================
--  Mate TCG Online — version 3.0 : l'evenement « Le Choc des Sections »
--  A executer apres 24_secretes.sql. Rejouable sans danger.
--
--  Trois semaines autour des Combats (23_combats.sql), avec ce qu'un
--  evenement apporte deja depuis la 2.0 (21_reflets.sql) : une monnaie — les
--  Insignes, rangees dans evt_comptes comme les Prismes —, des quetes
--  (04_seed.sql), un Pass de trente paliers, une boutique (04_seed.sql) et un
--  classement. En plus, l'Epreuve du jour : le meme combat pour tout le
--  monde (les decks et la regle se deduisent de la graine du jour,
--  js/combat/choc-data.js). Trois essais, le meilleur compte, un classement
--  du jour.
--
--  Le Raid (27_raid.sql) reste toute l'annee ; pendant l'evenement, il paie
--  en Insignes, et ce qu'on y fait compte pour le recap (choc_joueurs).
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
-- Trente paliers. Le calcul (docs/economie-3.0.md) : un joueur engage
-- (toutes les quetes du jour, trois Raids, trois essais d'Epreuve) gagne
-- ~4 000 Insignes en trois semaines et finit le Pass vers le 18e jour ; un
-- joueur occasionnel ~2 000, palier 19 ou 20.
delete from public.evt_piste where evenement = 'choc' and palier > 30;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('choc',  1,   20, 'boosters',    2, null,            '2 boosters'),
  ('choc',  2,   50, 'eclats',    150, null,            '150 Éclats'),
  ('choc',  3,   90, 'titre',       0, 't_recrue',      'Titre « Recrue du Choc »'),
  ('choc',  4,  140, 'fragments',  250, null,           '250 Fragments'),
  ('choc',  5,  200, 'boosters',    2, null,            '2 boosters'),
  ('choc',  6,  270, 'reverse_R',   1, null,            'Une Reverse Rare'),
  ('choc',  7,  350, 'eclats',    250, null,            '250 Éclats'),
  ('choc',  8,  440, 'sleeve',      0, 's_choc',        'Sleeve « Le Choc »'),
  ('choc',  9,  540, 'boosters',    3, null,            '3 boosters'),
  ('choc', 10,  650, 'fragments',  400, null,           '400 Fragments'),
  ('choc', 11,  770, 'eclats',    300, null,            '300 Éclats'),
  ('choc', 12,  900, 'cadre',       0, 'f_choc',        'Cadre « Choc »'),
  ('choc', 13, 1040, 'boosters',    3, null,            '3 boosters'),
  ('choc', 14, 1180, 'reverse_R',   1, null,            'Une Reverse Rare'),
  ('choc', 15, 1320, 'brillante',   1, null,            'Une Essence Brillante'),
  ('choc', 16, 1460, 'eclats',    400, null,            '400 Éclats'),
  ('choc', 17, 1600, 'fragments',  600, null,           '600 Fragments'),
  ('choc', 18, 1740, 'boosters',    4, null,            '4 boosters'),
  ('choc', 19, 1880, 'titre',       0, 't_veteran',     'Titre « Vétéran du Choc »'),
  ('choc', 20, 2020, 'tapis',       0, 't_arene',       'Tapis « L''Arène »'),
  ('choc', 21, 2160, 'eclats',    500, null,            '500 Éclats'),
  ('choc', 22, 2300, 'reverse_R',   2, null,            'Deux Reverses Rares'),
  ('choc', 23, 2440, 'boosters',    4, null,            '4 boosters'),
  ('choc', 24, 2580, 'fragments',  800, null,           '800 Fragments'),
  ('choc', 25, 2720, 'brillante',   1, null,            'Une Essence Brillante'),
  ('choc', 26, 2860, 'eclats',    600, null,            '600 Éclats'),
  ('choc', 27, 3000, 'boosters',    5, null,            '5 boosters'),
  ('choc', 28, 3150, 'fragments', 1000, null,           '1 000 Fragments'),
  ('choc', 29, 3300, 'titre',       0, 't_maitre_choc', 'Titre « Maître du Choc »'),
  ('choc', 30, 3500, 'legendaire',  1, null,            'Une Légendaire que tu n''as pas')
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
declare j date := jour_paris(); e choc_epreuves;
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
  return jsonb_build_object('niveau', 3, 'phase', null, 'graine', choc_graine(j));
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
declare p uuid := auth.uid(); j date := jour_paris(); e choc_epreuves;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if evenement_en_cours() is distinct from 'choc' then return 'null'::jsonb; end if;
  -- « Passe voir l'evenement », comme evenement_etat (21_reflets.sql).
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite' and q.evenement = 'choc'
  on conflict (user_id, quest_id, period_key) do nothing;
  select * into e from choc_epreuves where user_id = p and jour = j;
  return jsonb_build_object(
    'jour', j,
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
    'raid_niveaux', (select count(*) from raid_tombes t
                      where exists (select 1 from evenements e where e.code = 'choc'
                                     and t.tombe_le >= e.debut and t.tombe_le < e.fin)),
    'epreuves', (select count(*) from choc_epreuves where user_id = p and gagnee),
    'section', (select section from combat_joueurs where user_id = p));
end $$;

-- ============================================================ 7. droits
revoke all on function public.choc_graine, public.choc_score, public.choc_debut, public.choc_fin,
  public.choc_joueur_vue, public.choc_recap from public, anon, authenticated;
revoke all on function public.choc_etat from public, anon;
grant execute on function public.choc_etat to authenticated;

-- =====================================================================
--  Ouvrir l'evenement — a la main, le jour venu, dans le SQL Editor :
--
--    insert into public.evenements (titre, texte, debut, fin, code) values (
--      'Le Choc des Sections',
--      'La version 3.0 : le Raid contre The French Sorcerer et l''Épreuve du jour.',
--      '2026-11-02 18:00+01', '2026-11-23 18:00+01', 'choc');
--
--  (Les dates sont un exemple.) Un evenement sans `ticket_minutes` ne change
--  pas le rythme des boosters. Pour le fermer plus tot :
--    update public.evenements set fin = now() where code = 'choc' and fin > now();
-- =====================================================================
