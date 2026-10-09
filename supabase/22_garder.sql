-- =====================================================================
--  Mate TCG Online — version 2.1 : les exemplaires a garder
--  A executer apres 21_reflets.sql. Rejouable sans danger.
--
--  Jusqu'ici, une carte en deux exemplaires avait un doublon : le second
--  partait au recyclage d'un geste, et les amis le voyaient comme cessible.
--  Un collectionneur qui veut trois exemplaires d'une carte n'avait aucun
--  moyen de le dire.
--
--  Deux reglages, sur le compte :
--    · par rarete (profiles.garder) : « garder 2 de chaque Legendaire » ;
--    · par carte (gardes) : « garder 3 de celle-ci », ou toutes (99).
--  Le reglage d'une carte l'emporte sur celui de sa rarete. Sans rien, on
--  garde un exemplaire : rien ne change pour qui n'y touche pas.
--
--  Ce que ca change : le recyclage ne touche plus aux exemplaires gardes
--  (recycler, 12_recyclage.sql), et les amis ne les voient plus comme des
--  doublons (amis_doublons, 21_reflets.sql ; player_profile, 07_vitrine.sql).
--  Les echanges restent libres : le navigateur previent, il n'interdit pas.
-- =====================================================================

alter table public.profiles
  add column if not exists garder jsonb not null default '{}';

create table if not exists public.gardes (
  user_id uuid not null references public.profiles on delete cascade,
  card_id text not null references public.cards on delete cascade,
  n       smallint not null check (n between 1 and 99),
  primary key (user_id, card_id)
);
alter table public.gardes enable row level security;
revoke all on public.gardes from anon, authenticated;

-- Combien d'exemplaires de cette carte le joueur garde : jamais moins d'un.
create or replace function public.garde_de(p uuid, cid text) returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, coalesce(
    (select g.n from gardes g where g.user_id = p and g.card_id = cid),
    (select (pr.garder ->> k.rar)::int from profiles pr, cards k where pr.id = p and k.id = cid),
    1))
$$;
revoke all on function public.garde_de from public, anon, authenticated;

-- Le reglage d'une carte. Egal a celui de sa rarete, il s'efface : la carte
-- suit alors sa rarete si celle-ci change.
create or replace function public.regler_garder(p_carte text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; defaut int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo and not k.reverse then raise exception 'Cette carte se garde toujours.'; end if;
  if p_n is not null and (p_n < 1 or p_n > 99) then raise exception 'Entre 1 et 99 exemplaires.'; end if;

  select greatest(1, coalesce((garder ->> k.rar)::int, 1)) into defaut from profiles where id = p;
  if p_n is null or p_n = defaut then
    delete from gardes where user_id = p and card_id = p_carte;
  else
    insert into gardes (user_id, card_id, n) values (p, p_carte, p_n)
    on conflict (user_id, card_id) do update set n = excluded.n;
  end if;
  return me();
end $$;

-- Le reglage par rarete : de 1 a 4 exemplaires. Seuls les ecarts a 1 sont
-- gardes.
create or replace function public.regler_garder_defaut(p_garder jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); propre jsonb := '{}'; cle text; v jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_garder is null or jsonb_typeof(p_garder) <> 'object' then raise exception 'Réglage invalide.'; end if;
  for cle, v in select key, value from jsonb_each(p_garder) loop
    if cle not in ('ES', 'C', 'PC', 'R', 'E', 'L') then raise exception 'Rareté inconnue.'; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not in (1, 2, 3, 4) then
      raise exception 'Entre 1 et 4 exemplaires.';
    end if;
    if (v #>> '{}')::int > 1 then propre := propre || jsonb_build_object(cle, (v #>> '{}')::int); end if;
  end loop;
  update profiles set garder = propre where id = p;
  return me();
end $$;

revoke all on function public.regler_garder, public.regler_garder_defaut from public, anon;
grant execute on function public.regler_garder, public.regler_garder_defaut to authenticated;
