-- =====================================================================
--  Mate TCG Online — version 3.0.7 : la maitrise des cartes, et la carte
--  fetiche. A executer apres 27_raid.sql. Rejouable sans danger.
--
--  Ce que deviennent les Fragments quand la collection est complete : une
--  carte qu'on possede s'ameliore, en cinq niveaux (Eclat, Lisere, Aura,
--  Arene, Legende), et chaque niveau change son allure partout ou elle
--  apparait, en combat compris (js/maitrise.js, css/maitrise.css).
--
--  Ce que coute un niveau (version 3.0.8, docs/economie-3.0.md partie 3 ter) :
--    · des Fragments : une base selon la rarete, fois 1, 2, 4, 7 et 11
--      (25 fois la base pour la Legende) :
--          Commune      60    120    240    420    660   =  1 500
--          Peu commune  100   200    400    700  1 100   =  2 500
--          Rare         200   400    800  1 400  2 200   =  5 000
--          Epique       400   800  1 600  2 800  4 400   = 10 000
--          Legendaire,  600 1 200  2 400  4 200  6 600   = 15 000
--          Secrete
--    · des exemplaires EN TROP, d'autant moins que la carte est rare :
--          Commune                1  1  1  2  2
--          Peu commune            1  1  1  1  2
--          Rare                   0  1  1  1  1
--          Epique                 0  0  1  0  1
--          Legendaire             0  0  0  0  1
--          Secrete                0  0  0  0  0
--
--  Le conflit avec les decks (trois exemplaires pour jouer une carte trois
--  fois, regles officielles depuis la 3.0.12 ; deux avant) : la maitrise ne
--  prend que les exemplaires EN TROP — au-dela de ce
--  qu'un deck peut contenir (limite_copies, 23_combats.sql), au-dela de ce
--  que le joueur garde (garde_de, 22_garder.sql), hors de ce qui est promis
--  dans un echange en attente. Il en manque ? Chacun se remplace par son prix
--  de fabrication (cfg, 01_schema.sql) : la maitrise n'est jamais bloquee
--  par la chance, seulement par les Fragments.
--
--  La maitrise vaut pour la carte (toutes ses copies) ; sa Reverse la
--  partage — elle se range sous la carte classique (cle_copie). Ni les
--  Essences, ni les Promos (sauf les Secretes), ni les Essences Brillantes,
--  ni l'Unique.
--
--  Les montants sont aussi dans le navigateur (MAITRISE, js/maitrise.js),
--  qui affiche le cout ; le serveur revérifie tout.
-- =====================================================================

create table if not exists public.maitrises (
  user_id uuid not null references public.profiles on delete cascade,
  card_id text not null references public.cards on delete cascade,
  niveau  smallint not null check (niveau between 1 and 5),
  le      timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.maitrises enable row level security;
revoke all on public.maitrises from anon, authenticated;

-- Le journal : ce que chaque niveau a pris. Il sert a repondre a « j'ai
-- perdu des exemplaires » : la maitrise en absorbe.
create table if not exists public.maitrises_journal (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profiles on delete cascade,
  card_id   text not null references public.cards on delete cascade,
  niveau    smallint not null,
  fragments integer not null,
  copies    integer not null,
  le        timestamptz not null default now()
);
create index if not exists maitrises_journal_user_idx on public.maitrises_journal (user_id, le desc);
alter table public.maitrises_journal enable row level security;
revoke all on public.maitrises_journal from anon, authenticated;

-- La carte fetiche : une carte possedee, mise en scene sur le profil.
alter table public.profiles add column if not exists fetiche text references public.cards on delete set null;

-- Les Fragments du niveau n (1 a 5), selon la rarete : la base de la rarete,
-- fois 1, 2, 4, 7, 11. Version 3.0.8 : la base depend de la rarete (avant,
-- 300 a 6 000 pour toutes, une Commune coutait autant qu'une Legendaire).
drop function if exists public.maitrise_fragments(int);
create or replace function public.maitrise_fragments(rar text, n int) returns integer
language sql immutable as $$
  select (case rar when 'C' then 60 when 'PC' then 100 when 'R' then 200 when 'E' then 400
                   when 'L' then 600 when 'S' then 600 else 0 end)
         * coalesce((array[1, 2, 4, 7, 11])[n], 0)
$$;

-- Les exemplaires en trop que prend le niveau n, selon la rarete.
create or replace function public.maitrise_copies(rar text, n int) returns integer
language sql immutable as $$
  select coalesce((case rar
    when 'C'  then array[1, 1, 1, 2, 2]
    when 'PC' then array[1, 1, 1, 1, 2]
    when 'R'  then array[0, 1, 1, 1, 1]
    when 'E'  then array[0, 0, 1, 0, 1]
    when 'L'  then array[0, 0, 0, 0, 1]
    when 'S'  then array[0, 0, 0, 0, 0]
  end)[n], 0)
$$;

-- La carte qui porte la maitrise (une Reverse : sa carte classique), si
-- elle se maitrise ; null sinon.
create or replace function public.maitrise_carte(p_carte text) returns text
language sql stable security definer set search_path = public as $$
  select k.id from cards k
   where k.id = (case when p_carte ~ '^r[0-9]' then 'c' || substr(p_carte, 2) else p_carte end)
     and k.cat <> 'essence' and not k.reverse
     and (not k.promo or k.secrete)
     and k.rar in ('C', 'PC', 'R', 'E', 'L', 'S')
$$;

-- Ce que le joueur a maitrise, et sa carte fetiche : pour me().
create or replace function public.maitrise_etat(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'niveaux', coalesce((select jsonb_object_agg(card_id, niveau) from maitrises where user_id = p), '{}'::jsonb),
    'fetiche', (select fetiche from profiles where id = p))
$$;

-- La carte fetiche d'un joueur, pour sa fiche publique : la carte, et sa
-- maitrise. Seulement s'il la possede encore — une carte echangee depuis
-- disparait de son profil.
create or replace function public.fetiche_de(u uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when pr.fetiche is null then null
    when not exists (select 1 from collection c where c.user_id = u and c.card_id = pr.fetiche and c.qty > 0) then null
    else jsonb_build_object('carte', pr.fetiche,
      'niveau', coalesce((select m.niveau from maitrises m
                           where m.user_id = u and m.card_id = maitrise_carte(pr.fetiche)), 0))
    end
    from profiles pr where pr.id = u
$$;

revoke all on function public.maitrise_fragments, public.maitrise_copies, public.maitrise_carte,
  public.maitrise_etat, public.fetiche_de from public, anon, authenticated;

-- ---------------------------------------------------------------- maitriser
-- Le niveau suivant d'une carte. Rend me().
create or replace function public.maitriser(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); cid text; k cards; n int; possede int; reserve int; garde int;
  copies int; dispo int; pris int; manque int; prix int; total int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  cid := maitrise_carte(p_carte);
  if cid is null then
    if not exists (select 1 from cards where id = p_carte) then raise exception 'Carte inconnue.'; end if;
    raise exception 'Cette carte ne se maîtrise pas.';
  end if;
  select * into k from cards where id = cid;

  -- Une maitrise a la fois par joueur : deux appuis partis ensemble ne
  -- doivent pas payer deux fois le meme niveau, ni compter deux fois le
  -- meme exemplaire.
  select fragments into reste from profiles where id = p for update;

  select qty into possede from collection where user_id = p and card_id = cid for update;
  if coalesce(possede, 0) < 1 then raise exception 'Il faut posséder la carte pour la maîtriser.'; end if;

  n := coalesce((select niveau from maitrises where user_id = p and card_id = cid), 0) + 1;
  if n > 5 then raise exception 'Cette carte est déjà au niveau maximum.'; end if;

  -- Les exemplaires en trop : ni ceux d'un deck, ni ceux qu'on garde, ni ceux
  -- qu'on a promis dans un echange.
  select count(*) into reserve from trades
   where from_user = p and offer_card = cid and status = 'pending';
  garde := garde_de(p, cid);
  dispo := greatest(0, possede - greatest(coalesce(limite_copies(cid), 3), garde) - reserve);
  copies := maitrise_copies(k.rar, n);
  pris := least(copies, dispo);
  manque := copies - pris;
  prix := coalesce(cfg('fabrication_' || k.rar), 0);
  total := maitrise_fragments(k.rar, n) + manque * prix;

  if reste < total then raise exception 'Pas assez de Fragments : il en faut %.', total; end if;

  update profiles set fragments = fragments - total where id = p;
  if pris > 0 then
    update collection set qty = qty - pris where user_id = p and card_id = cid;
  end if;
  insert into maitrises (user_id, card_id, niveau) values (p, cid, n)
    on conflict (user_id, card_id) do update set niveau = excluded.niveau, le = now();
  insert into maitrises_journal (user_id, card_id, niveau, fragments, copies)
    values (p, cid, n, total, pris);
  return me();
end $$;

-- ------------------------------------------------------------ la carte fetiche
-- Une carte possedee, ou null pour la retirer. Rend me().
create or replace function public.set_fetiche(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_carte is not null and not exists (
    select 1 from collection where user_id = p and card_id = p_carte and qty > 0) then
    raise exception 'Tu ne possèdes pas cette carte.';
  end if;
  update profiles set fetiche = p_carte where id = p;
  return me();
end $$;

revoke all on function public.maitriser, public.set_fetiche from public, anon;
grant execute on function public.maitriser, public.set_fetiche to authenticated;
