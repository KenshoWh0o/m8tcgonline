-- =====================================================================
--  Mate TCG Online — version 3.0.7 : la maitrise des cartes, et la carte
--  fetiche. A executer apres 27_raid.sql. Rejouable sans danger.
--
--  Ce que deviennent les Fragments quand la collection est complete : une
--  carte qu'on possede s'ameliore, en cinq niveaux (Eclat, Lisere, Aura,
--  Arene, Legende), et chaque niveau change son allure partout ou elle
--  apparait, en combat compris (js/maitrise.js, css/maitrise.css).
--
--  Ce que coute un niveau (version 3.0.13, docs/economie-3.0.md partie 3 ter).
--  Le proprietaire, le 31 octobre 2026 : « Il faut un certain nombre
--  d'exemplaire et de fragments pour monter le niveau, et ce nombre
--  d'exemplaire et de fragments depend de la rarete. Il n'est pas possible
--  de compenser un manque d'exemplaire avec des fragments. Quand tu montes
--  la mastery, les exemplaires sont CONSOMMES. Il faut que monter la mastery
--  soit une tache ardue, c'est un peu l'endgame du jeu. »
--    · des Fragments : une base selon la rarete, fois 1, 2, 4, 7 et 11
--      (25 fois la base pour la Legende) :
--          Commune       80    160    320    560    880   =  2 000
--          Peu commune  120    240    480    840  1 320   =  3 000
--          Rare         250    500  1 000  1 750  2 750   =  6 250
--          Epique       500  1 000  2 000  3 500  5 500   = 12 500
--          Legendaire,  800  1 600  3 200  5 600  8 800   = 20 000
--          Secrete
--    · des exemplaires de la carte, CONSOMMES, d'autant moins que la carte
--      est rare (au moins un a chaque niveau) :
--          Commune                2  3  4  5  6   (20)
--          Peu commune            2  2  3  4  5   (16)
--          Rare                   1  2  2  3  4   (12)
--          Epique                 1  1  2  2  3   ( 9)
--          Legendaire             1  1  1  2  2   ( 7)
--          Secrete                1  1  1  1  1   ( 5)
--    Avant la 3.0.13, un exemplaire qui manquait se remplacait par son prix
--    de fabrication : ce n'est plus possible, le niveau attend.
--
--  Le conflit avec les decks (trois exemplaires pour jouer une carte trois
--  fois, regles officielles depuis la 3.0.12) : la maitrise ne prend que
--  les exemplaires EN TROP — au-dela de ce qu'un deck peut contenir
--  (limite_copies, 23_combats.sql), au-dela de ce que le joueur garde
--  (garde_de, 22_garder.sql), hors de ce qui est promis dans un echange en
--  attente. Seuls les exemplaires de la carte classique comptent (pas ceux
--  de sa Reverse).
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
-- 300 a 6 000 pour toutes) ; 3.0.13 : bases relevees d'un tiers.
drop function if exists public.maitrise_fragments(int);
create or replace function public.maitrise_fragments(rar text, n int) returns integer
language sql immutable as $$
  select (case rar when 'C' then 80 when 'PC' then 120 when 'R' then 250 when 'E' then 500
                   when 'L' then 800 when 'S' then 800 else 0 end)
         * coalesce((array[1, 2, 4, 7, 11])[n], 0)
$$;

-- Les exemplaires que consomme le niveau n, selon la rarete (3.0.13).
create or replace function public.maitrise_copies(rar text, n int) returns integer
language sql immutable as $$
  select coalesce((case rar
    when 'C'  then array[2, 3, 4, 5, 6]
    when 'PC' then array[2, 2, 3, 4, 5]
    when 'R'  then array[1, 2, 2, 3, 4]
    when 'E'  then array[1, 1, 2, 2, 3]
    when 'L'  then array[1, 1, 1, 2, 2]
    when 'S'  then array[1, 1, 1, 1, 1]
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
  copies int; dispo int; total int; reste int;
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
  -- Version 3.0.13 : un exemplaire qui manque ne se paie plus en Fragments.
  if dispo < copies then
    raise exception 'Il faut % exemplaire% en trop de « % » : tu en as %.',
      copies, case when copies > 1 then 's' else '' end, k.nom, dispo;
  end if;
  total := maitrise_fragments(k.rar, n);
  if reste < total then raise exception 'Pas assez de Fragments : il en faut %.', total; end if;

  update profiles set fragments = fragments - total where id = p;
  update collection set qty = qty - copies where user_id = p and card_id = cid;
  insert into maitrises (user_id, card_id, niveau) values (p, cid, n)
    on conflict (user_id, card_id) do update set niveau = excluded.niveau, le = now();
  insert into maitrises_journal (user_id, card_id, niveau, fragments, copies)
    values (p, cid, n, total, copies);
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
