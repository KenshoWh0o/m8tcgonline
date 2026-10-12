-- =====================================================================
--  Mate TCG Online — version 3.0 : le Raid
--  A executer apres 26_niveaux.sql. Rejouable sans danger.
--
--  Un boss commun a tout le serveur, toute l'annee : The French Sorcerer.
--  Une seule barre de vie : chaque PV qu'un joueur lui prend en combat
--  l'entame. Quand elle est vide, le niveau tombe — chacun de ceux qui l'ont
--  frappe a ce niveau peut ouvrir un coffre — et le boss revient au niveau
--  suivant, plus fort. Trois tentatives par jour.
--
--  Pendant le Choc des Sections (25_choc.sql), un combat de Raid paie en
--  Insignes ; le reste du temps, en Eclats.
--
--  Il remplace le Raid a cinq phases et calendrier des pre-builds 3.0.0 a
--  3.0.4 : ses tables et fonctions sont supprimees plus bas.
--
--  Les chiffres sont aussi dans js/combat/choc-data.js (RAID) : les deux
--  doivent rester d'accord.
-- =====================================================================

-- ============================================================ 1. reglage
-- La barre depend du nombre de joueurs, que personne ne connait d'avance :
-- `raid_echelle` la multiplie. Se regle sans rien redeployer :
--   update public.parametres set raid_echelle = 0.5 where id = 1;
alter table public.parametres add column if not exists raid_echelle numeric not null default 1
  check (raid_echelle > 0);

-- ============================================================ 2. tables
-- L'etat du boss : une seule ligne.
create table if not exists public.raid_etat (
  id     integer primary key check (id = 1),
  niveau integer not null default 1,
  degats integer not null default 0,   -- dans le niveau en cours
  total  bigint  not null default 0
);
insert into public.raid_etat (id) values (1) on conflict (id) do nothing;

create table if not exists public.raid_tombes (
  niveau   integer primary key,
  tombe_le timestamptz not null default now()
);
-- Ce que chaque joueur a fait au boss, depuis toujours (le classement).
create table if not exists public.raid_joueurs (
  user_id   uuid primary key references public.profiles on delete cascade,
  degats    integer not null default 0,
  victoires integer not null default 0
);
-- Qui a frappe quel niveau : c'est ce qui ouvre son coffre.
create table if not exists public.raid_frappes (
  user_id uuid not null references public.profiles on delete cascade,
  niveau  integer not null,
  degats  integer not null default 0,
  primary key (user_id, niveau)
);
create table if not exists public.raid_coffres (
  user_id uuid not null references public.profiles on delete cascade,
  niveau  integer not null,
  pris_le timestamptz not null default now(),
  primary key (user_id, niveau)
);
create table if not exists public.raid_tentatives (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  n       integer not null default 0,
  primary key (user_id, jour)
);

-- L'ancien Raid a phases : retire.
drop function if exists public.raid_reclamer(int);
drop function if exists public.choc_avancer();
drop function if exists public.choc_frapper(uuid, int);
drop function if exists public.choc_pv_phase(int);
drop table if exists public.choc_phases;
drop table if exists public.choc_raid;
drop table if exists public.choc_tombees;
drop table if exists public.choc_tentatives;
drop table if exists public.choc_prises;

alter table public.raid_etat       enable row level security;
alter table public.raid_tombes     enable row level security;
alter table public.raid_joueurs    enable row level security;
alter table public.raid_frappes    enable row level security;
alter table public.raid_coffres    enable row level security;
alter table public.raid_tentatives enable row level security;
revoke all on public.raid_etat, public.raid_tombes, public.raid_joueurs, public.raid_frappes,
  public.raid_coffres, public.raid_tentatives from anon, authenticated;

-- ============================================================ 3. les regles
-- La barre d'un niveau (RAID.pv), a l'echelle du serveur.
create or replace function public.raid_pv(n int) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(20, round((300 + 150 * (greatest(n, 1) - 1))
                            * (select raid_echelle from parametres where id = 1))::int);
$$;

-- Le combat d'un niveau (RAID.combat) : l'IA, les PV du boss, ses Essences
-- d'avance.
create or replace function public.raid_combat(n int) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'ia',      least(5, 2 + ceil(greatest(n, 1) / 2.0)::int),
    'pv_boss', least(9, 5 + ceil(greatest(n, 1) / 2.0)::int),
    'ess',     least(2, (greatest(n, 1) - 1) / 2));
$$;

-- Le coffre d'un niveau tombe (RAID.coffres), a tour de role.
create or replace function public.raid_coffre(n int) returns jsonb
language sql immutable as $$
  select (array[
    '{"type": "boosters",  "montant": 2,   "titre": "2 boosters"}',
    '{"type": "fragments", "montant": 300, "titre": "300 Fragments"}',
    '{"type": "boosters",  "montant": 3,   "titre": "3 boosters"}',
    '{"type": "eclats",    "montant": 400, "titre": "400 Éclats"}'
  ]::jsonb[])[((greatest(n, 1) - 1) % 4) + 1];
$$;

-- Des degats sur la barre commune. Le surplus entame le niveau suivant, et
-- compte pour celui qui l'a donne. Renvoie le dernier niveau tombe.
create or replace function public.raid_frapper(p uuid, d int) returns integer
language plpgsql security definer set search_path = public as $$
declare r raid_etat; pv int; reste int := d; part int; tombe int;
begin
  if coalesce(d, 0) <= 0 then return null; end if;
  select * into r from raid_etat where id = 1 for update;
  insert into raid_joueurs (user_id, degats) values (p, d)
    on conflict (user_id) do update set degats = raid_joueurs.degats + d;
  r.total := r.total + d;
  loop
    pv := raid_pv(r.niveau);
    part := least(reste, pv - r.degats);
    insert into raid_frappes (user_id, niveau, degats) values (p, r.niveau, part)
      on conflict (user_id, niveau) do update set degats = raid_frappes.degats + part;
    r.degats := r.degats + part;
    reste := reste - part;
    exit when r.degats < pv;
    insert into raid_tombes (niveau) values (r.niveau) on conflict do nothing;
    tombe := r.niveau;
    r.niveau := r.niveau + 1;
    r.degats := 0;
    exit when reste <= 0;
  end loop;
  update raid_etat set niveau = r.niveau, degats = r.degats, total = r.total where id = 1;
  return tombe;
end $$;

-- ===================================================== 4. ouvrir, clore
-- Appeles par combat_debut et combat_fin (23_combats.sql). `p_cle` : le
-- niveau que la page a affiche — s'il a change entre-temps, on recharge.
create or replace function public.raid_debut(p uuid, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r raid_etat; v_t int; j date := jour_paris(); c jsonb;
begin
  select * into r from raid_etat where id = 1;
  if p_cle is distinct from r.niveau::text then
    raise exception 'Le boss a changé de niveau : recharge le Raid.';
  end if;
  insert into raid_tentatives (user_id, jour, n) values (p, j, 0) on conflict do nothing;
  update raid_tentatives set n = n + 1 where user_id = p and jour = j and n < 3
  returning raid_tentatives.n into v_t;
  if v_t is null then raise exception 'Plus de tentative aujourd''hui : reviens demain.'; end if;
  c := raid_combat(r.niveau);
  return jsonb_build_object('niveau', (c->>'ia')::int, 'phase', r.niveau,
                            'graine', floor(random() * 4294967295)::bigint + 1);
end $$;

-- Les degats : les PV pris au boss (plafonnes a ses PV + 1), ou tous et 3
-- de plus s'il tombe. Pendant le Choc : 3 Insignes par degat, +15 s'il
-- tombe. Sinon : 4 Eclats par degat, +20.
create or replace function public.raid_fin(p uuid, o public.combats_ouverts, gagne boolean, res jsonb, trop boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb; pb int; d int; gain int; msg text := ''; tombe int;
begin
  perform bump_quests(p, 'raid', 1);
  if trop then
    return jsonb_build_object('degats', 0, 'message', 'Combat trop court pour compter.');
  end if;
  c := raid_combat(coalesce(o.phase, 1));
  pb := (c->>'pv_boss')::int;
  d := least(pb + 1, greatest(0, coalesce((res->>'touches')::int, 0)));
  if gagne then d := pb + 1 + 3; end if;
  tombe := raid_frapper(p, d);
  perform bump_quests(p, 'raid_degats', d);
  if gagne then
    update raid_joueurs set victoires = victoires + 1 where user_id = p;
    perform bump_quests(p, 'raid_victoires', 1);
  end if;
  if tombe is not null then
    msg := 'Le boss est tombé ! Ton coffre t''attend dans le Raid.';
  elsif d = 0 then
    msg := 'Pas un PV de pris : il rira moins la prochaine fois.';
  end if;
  if evenement_en_cours() = 'choc' then
    gain := d * 3 + case when gagne then 15 else 0 end;
    perform crediter_prismes(p, 'choc', gain);
    insert into choc_joueurs (user_id, degats, victoires) values (p, d, case when gagne then 1 else 0 end)
      on conflict (user_id) do update set degats = choc_joueurs.degats + d,
                                          victoires = choc_joueurs.victoires + excluded.victoires;
    return jsonb_build_object('insignes', gain, 'degats', d, 'message', msg);
  end if;
  gain := d * 4 + case when gagne then 20 else 0 end;
  update profiles set shards = shards + gain where id = p;
  return jsonb_build_object('eclats', gain, 'degats', d, 'message', msg);
end $$;

-- ===================================================== 5. ce que voit la page
create or replace function public.raid_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := jour_paris(); r raid_etat; moi raid_joueurs;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into r from raid_etat where id = 1;
  select * into moi from raid_joueurs where user_id = p;
  return jsonb_build_object(
    'jour', j, 'niveau', r.niveau, 'degats', r.degats, 'pv', raid_pv(r.niveau), 'total', r.total,
    'joueurs', (select count(*) from raid_frappes where niveau = r.niveau and degats > 0),
    'evenement', evenement_en_cours() is not distinct from 'choc',
    'moi', jsonb_build_object(
      'degats', coalesce(moi.degats, 0), 'victoires', coalesce(moi.victoires, 0),
      'niveau', coalesce((select degats from raid_frappes where user_id = p and niveau = r.niveau), 0),
      'tentatives', coalesce((select n from raid_tentatives where user_id = p and jour = j), 0),
      'max', 3),
    -- Les coffres a ouvrir : les niveaux tombes qu'on a frappes.
    'coffres', coalesce((
      select jsonb_agg(jsonb_build_object('niveau', t.niveau) || raid_coffre(t.niveau) order by t.niveau)
        from raid_tombes t
        join raid_frappes f on f.niveau = t.niveau and f.user_id = p and f.degats > 0
       where not exists (select 1 from raid_coffres c where c.user_id = p and c.niveau = t.niveau)), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(choc_joueur_vue(x.user_id) || jsonb_build_object('degats', x.degats, 'moi', x.user_id = p)
                       order by x.degats desc)
        from (select * from raid_joueurs where degats > 0 order by degats desc limit 10) x), '[]'::jsonb));
end $$;

-- Le coffre d'un niveau tombe : une fois, pour qui l'a frappe.
create or replace function public.raid_reclamer(p_niveau int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c jsonb; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if not exists (select 1 from raid_tombes where niveau = p_niveau) then
    raise exception 'Ce niveau n''est pas encore tombé.';
  end if;
  if coalesce((select degats from raid_frappes where user_id = p and niveau = p_niveau), 0) < 1 then
    raise exception 'Tu n''as pas frappé le boss à ce niveau.';
  end if;
  insert into raid_coffres (user_id, niveau) values (p, p_niveau) on conflict do nothing;
  if not found then raise exception 'Coffre déjà ouvert.'; end if;
  c := raid_coffre(p_niveau);
  cartes := accorder(p, c->>'type', (c->>'montant')::int, null);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- ============================================================ 6. droits
revoke all on function public.raid_pv, public.raid_combat, public.raid_coffre, public.raid_frapper,
  public.raid_debut, public.raid_fin from public, anon, authenticated;
revoke all on function public.raid_etat, public.raid_reclamer from public, anon;
grant execute on function public.raid_etat, public.raid_reclamer to authenticated;
