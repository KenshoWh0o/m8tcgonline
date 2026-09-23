-- =====================================================================
--  Mate TCG Online — le recyclage des doublons
--  A executer apres 11_boite.sql. Rejouable sans danger.
--
--  On jette un doublon, on touche des Eclats. Toutes les raretes se
--  recyclent sauf les Promos, et on garde toujours au moins un exemplaire de
--  chaque carte : recycler ne fait jamais reculer la collection.
--
--  Les montants et le plafond sont dans cfg() (supabase/01_schema.sql) :
--      Essence 5 · Commune 10 · Peu commune 20 · Rare 100
--      Epique 500 · Legendaire 1 000
--      plafond : 1 500 Eclats par semaine, remis a zero le lundi (Paris)
--
--  ------------------------------------------------------------------
--  POURQUOI UN PLAFOND
--
--  Un booster rapporte en moyenne ~260 Eclats une fois recycle, des que la
--  collection est bien avancee : la derniere carte est une Rare quatre fois
--  sur cinq, et une Rare vaut 100. Simulation, joueur regulier (42 boosters
--  par semaine), mediane :
--
--                         sans plafond      avec 1 500 / semaine
--      semaine 1 ........   3 700 Eclats        1 500
--      semaine 4 ........   8 700               1 500
--      semaine 8 ........   9 900               1 500
--
--  Les quetes, elles, paient ~2 100 Eclats par semaine. Sans plafond, le
--  recyclage aurait paye quatre fois plus que tout le reste du jeu reuni.
--  Pire : un booster achete 350 et recycle en rend ~260. En rachetant des
--  boosters avec ce que rapporte le recyclage, on passait de 42 a ~135
--  boosters par semaine — la collection allait trois fois plus vite, et les
--  cartes Promo de la boutique tombaient en quelques jours.
--
--  A 1 500 par semaine, le recyclage ajoute ~70 % aux Eclats des quetes et
--  ~10 % de boosters. Il aide, il ne remplace pas le temps : c'est la regle
--  que suit tout le reste de l'economie (voir 04_seed.sql).
--
--  Les montants par carte restent ceux qu'on a choisis : une Legendaire
--  recyclee, c'est un evenement. Le plafond ne touche qu'au total.
-- =====================================================================

-- Le journal : qui a recycle quoi, et quand. Il sert au plafond de la semaine,
-- et a retrouver ce qui s'est passe si quelqu'un ecrit « j'ai perdu une carte ».
create table if not exists public.recyclages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  card_id    text not null references public.cards on delete cascade,
  qty        integer not null check (qty > 0),
  eclats     integer not null check (eclats >= 0),
  created_at timestamptz not null default now()
);
create index if not exists recyclages_user_idx on public.recyclages (user_id, created_at desc);

alter table public.recyclages enable row level security;
-- Aucune policy : le navigateur ne lit pas le journal, il recoit le total de
-- la semaine dans me().
revoke all on public.recyclages from anon, authenticated;

-- Le lundi minuit, heure de Paris : la meme frontiere que les quetes
-- hebdomadaires (period_key dans 01_schema.sql).
create or replace function public.debut_semaine() returns timestamptz
language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

-- Ce qu'un joueur a deja touche cette semaine.
create or replace function public.recyclage_semaine(p uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(eclats), 0)::int from recyclages
   where user_id = p and created_at >= debut_semaine();
$$;

revoke all on function public.recyclage_semaine from public, anon, authenticated;

-- ------------------------------------------------------------- recycler
-- `p_lots` : [{ "carte": "c012", "n": 2 }, …]. Tout passe, ou rien : un seul
-- lot refuse annule l'ensemble, et le plafond est verifie sur le total.
--
-- Ce qui est recyclable, carte par carte : ce qu'on possede, moins l'exemplaire
-- qu'on garde toujours, moins ceux qu'on a proposes dans une demande
-- d'echange encore en attente — sinon l'echange, une fois accepte, prendrait
-- le dernier exemplaire et ferait reculer la collection.
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

  -- Un recyclage a la fois par joueur. Sans ce verrou, deux envois partis
  -- ensemble liraient le meme total de la semaine, et passeraient tous les
  -- deux sous le plafond.
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
    if k.promo or k.rar = 'PR' then raise exception 'Les cartes Promo ne se recyclent pas.'; end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    if coalesce(possede, 0) - 1 - reserve < n then
      raise exception 'Pas assez de doublons de « % » : tu gardes toujours un exemplaire.', k.nom;
    end if;

    update collection set qty = qty - n where user_id = p and card_id = cid;
    insert into recyclages (user_id, card_id, qty, eclats) values (p, cid, n, n * prix);
    total := total + n * prix;
  end loop;

  -- Apres la boucle, et non avant : c'est le total de l'envoi qui compte. Le
  -- `raise` annule tout ce que la boucle a deja ecrit.
  if recyclage_semaine(p) > cfg('recyclage_plafond') then
    raise exception 'PLAFOND_RECYCLAGE';
  end if;

  update profiles set shards = shards + total where id = p;
  return me();
end $$;

revoke all on function public.recycler from public, anon;
grant execute on function public.recycler to authenticated;
