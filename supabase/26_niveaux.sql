-- =====================================================================
--  Mate TCG Online — version 3.0 : l'XP et le niveau de combattant
--  A executer apres 25_choc.sql. Rejouable sans danger.
--
--  Chaque combat fini rapporte de l'XP, sans limite par jour : c'est la
--  recompense de ceux qui jouent beaucoup, quand les Eclats des combats
--  s'arretent a cinq victoires recompensees par jour (23_combats.sql).
--  Chaque niveau atteint paie des Eclats ; certains paliers ajoutent des
--  boosters, des Fragments, un cadre ou un titre. Pas de niveau maximum.
--
--  Les chiffres sont aussi dans js/combat/niveaux.js (NIVEAUX) : les deux
--  doivent rester d'accord. L'equilibrage est explique dans
--  docs/economie-3.0.md. combat_fin et defi_fin (23_combats.sql) appellent
--  gagner_xp ; PL/pgSQL resout l'appel a l'execution.
-- =====================================================================

alter table public.combat_joueurs add column if not exists xp integer not null default 0;

-- Les paliers qui paient plus que les Eclats de chaque niveau.
create table if not exists public.niveau_paliers (
  niveau    integer primary key check (niveau >= 2),
  boosters  integer not null default 0,
  fragments integer not null default 0,
  cadre     text,
  titre     text
);
delete from public.niveau_paliers where niveau not in (3, 5, 10, 15, 20, 25, 30, 40, 50);
insert into public.niveau_paliers (niveau, boosters, fragments, cadre, titre) values
  (3,  1, 0,   null,      null),
  (5,  2, 0,   null,      't_bagarreur'),
  (10, 2, 0,   'f_niv10', null),
  (15, 3, 0,   null,      null),
  (20, 0, 0,   'f_niv20', 't_veteran_arene'),
  (25, 0, 500, null,      null),
  (30, 3, 0,   'f_niv30', null),
  (40, 5, 0,   null,      't_maitre_arene'),
  (50, 0, 0,   'f_niv50', 't_legende_arene')
on conflict (niveau) do update set boosters = excluded.boosters, fragments = excluded.fragments,
  cadre = excluded.cadre, titre = excluded.titre;
alter table public.niveau_paliers enable row level security;
revoke all on public.niveau_paliers from anon, authenticated;

-- L'XP pour passer du niveau n au suivant (xpRequis).
create or replace function public.xp_requis(n int) returns integer
language sql immutable as $$ select least(100 + 25 * (n - 1), 1100); $$;

-- Le niveau d'un total d'XP (niveauDe).
create or replace function public.niveau_de(xp int) returns integer
language plpgsql immutable as $$
declare v_n int := 1; reste int := greatest(0, coalesce(xp, 0));
begin
  while reste >= xp_requis(v_n) loop
    reste := reste - xp_requis(v_n);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- L'XP d'un combat (xpCombat) : contre l'IA, selon la difficulte (1 a 5) ;
-- un defi entre amis a ses propres montants. Plus 4 par Joueur adverse
-- vaincu, six au plus. Une defaite ne rapporte que si la partie a dure six
-- tours : sinon, abandonner tout de suite rapporterait plus vite que jouer.
drop function if exists public.xp_combat(text, int, boolean, int);
create or replace function public.xp_combat(p_mode text, etoiles int, gagne boolean, vaincus int, tours int) returns integer
language sql immutable as $$
  select case when not gagne and coalesce(tours, 0) < 6 then 0
    else (case when p_mode = 'defi' then case when gagne then 80 else 35 end
              else round((case when gagne then 50 else 20 end)
                         * (array[0.6, 0.8, 1, 1.25, 1.5])[least(5, greatest(1, coalesce(etoiles, 3)))])::int end
         + least(6, greatest(0, coalesce(vaincus, 0))) * 4) end;
$$;

-- Gagner de l'XP : chaque niveau franchi paie (50 Eclats, plus son palier ;
-- apres 50, deux boosters tous les cinq niveaux). Les quetes « xp » avancent,
-- les quetes « niveau » suivent le niveau atteint. Renvoie ce qu'il faut
-- montrer en fin de combat.
create or replace function public.gagner_xp(p uuid, d int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare avant int; apres int; total int; k int; pal niveau_paliers; paliers jsonb := '[]'::jsonb;
        g_eclats int; g_boosters int;
begin
  if coalesce(d, 0) <= 0 then return null; end if;
  update combat_joueurs set xp = xp + d where user_id = p returning xp into total;
  if total is null then return null; end if;
  avant := niveau_de(total - d);
  apres := niveau_de(total);
  for k in avant + 1 .. apres loop
    select * into pal from niveau_paliers where niveau = k;
    g_eclats := 50;
    g_boosters := coalesce(pal.boosters, 0) + case when k > 50 and k % 5 = 0 then 2 else 0 end;
    update profiles set shards = shards + g_eclats, boosters_bonus = boosters_bonus + g_boosters,
                        fragments = fragments + coalesce(pal.fragments, 0)
     where id = p;
    if pal.cadre is not null then perform accorder(p, 'cadre', 1, pal.cadre); end if;
    if pal.titre is not null then perform accorder(p, 'titre', 1, pal.titre); end if;
    paliers := paliers || jsonb_build_object('niveau', k, 'eclats', g_eclats, 'boosters', g_boosters,
      'fragments', coalesce(pal.fragments, 0), 'cadre', pal.cadre, 'titre', pal.titre);
    pal := null;
  end loop;
  perform bump_quests(p, 'xp', d);
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), apres from quests q where q.metric = 'niveau'
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress)
    where not quest_progress.claimed;
  return jsonb_build_object('gagne', d, 'total', total, 'avant', avant, 'niveau', apres, 'paliers', paliers);
end $$;

revoke all on function public.xp_requis, public.niveau_de, public.xp_combat, public.gagner_xp
  from public, anon, authenticated;
