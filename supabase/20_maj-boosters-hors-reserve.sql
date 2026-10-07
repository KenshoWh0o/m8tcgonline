-- =====================================================================
--  Mate TCG Online — mise a jour 1.5.6 : boosters hors reserve, cadre Unique
--  A executer APRES 19_maj-boosters-offerts.sql. Rejouable sans danger.
--
--  1. Les boosters achetes en boutique ou recus en cadeau ne vont plus dans
--     la reserve : ils s'ouvrent a part (open_pack(true)). Melanges a la
--     reserve, ils la faisaient deborder, et une reserve pleine remet son
--     compte a rebours a zero : on perdait des boosters gratuits en en
--     achetant. Ce qui depasse aujourd'hui le plafond y est deplace.
--  2. Celui qui tire la carte unique recoit le cadre d'avatar « Unique »,
--     pose d'office. Rattrape ici si elle a deja ete tiree.
--
--  Dans le SQL Editor de Supabase : tout coller, puis Run. Sur GitHub,
--  prendre le fichier avec « Copy raw file ».
-- =====================================================================

begin;

alter table public.profiles add column if not exists boosters_bonus  integer not null default 0;
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;

-- Version 1.5.6 : ce qui depassait le plafond de la reserve (boosters achetes
-- ou offerts avant) passe dans les boosters en plus, et la reserve repart de
-- son plafond — son compte a rebours reprend. Rejouable : une reserve qui ne
-- depasse pas n'est pas touchee.
update public.profiles
   set boosters_bonus = boosters_bonus + (tickets - public.cfg('ticket_cap')),
       tickets        = public.cfg('ticket_cap')
 where tickets > public.cfg('ticket_cap');
update public.profiles set tickets_offerts = boosters_bonus where tickets_offerts > boosters_bonus;

-- ------------------------------------------------------------- open_pack
-- (1.5.6) Les boosters en plus, hors reserve : leurs colonnes, et l'ancienne
-- signature d'open_pack retiree (avec les deux, un appel sans argument serait
-- ambigu).
alter table public.profiles add column if not exists boosters_bonus  integer not null default 0;
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;
drop function if exists public.open_pack();
create or replace function public.open_pack(p_bonus boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles;
  god boolean; ids text[] := '{}'; cid text; x double precision;
  nouvelles int := 0; i int; ch_active boolean; ch_gagnant uuid; ch_ouvre timestamptz; unique_id text;
  offert boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  pr := regen_tickets(p);
  if coalesce(p_bonus, false) then
    if pr.boosters_bonus < 1 then raise exception 'BONUS_VIDE'; end if;
    -- Parmi les boosters en plus, ceux d'un cadeau (18_cadeaux.sql) partent en
    -- premier, et ne peuvent pas contenir la carte unique : elle se trouve,
    -- elle ne s'offre pas.
    offert := pr.tickets_offerts > 0;
  else
    if pr.tickets < 1 then raise exception 'RESERVE_VIDE'; end if;
    offert := false;
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
  -- de la contenir. Elle prend la place de la derniere carte, le hit — celle
  -- qui porte la revelation ; le booster garde ses six cartes. La mise a jour
  -- `where gagnant is null` tranche entre deux tirages simultanes : le second
  -- relit la ligne apres le premier, n'y trouve plus de place, et repart
  -- avec un booster ordinaire.
  select active, gagnant, ouvre_le into ch_active, ch_gagnant, ch_ouvre from chasse where id = 1;
  if coalesce(ch_active, false) and ch_gagnant is null and (ch_ouvre is null or now() >= ch_ouvre)
     and not offert and random() < 1.0 / cfg('chasse_odds') then
    update chasse set gagnant = p, trouvee_le = now()
     where id = 1 and gagnant is null
     returning carte into unique_id;
    if unique_id is not null then
      ids[array_length(ids, 1)] := unique_id;
      -- Son cadre, que personne d'autre n'aura : pose d'office sur son avatar.
      insert into inventory (user_id, item_id, qty) values (p, 'f_unique', 1)
        on conflict (user_id, item_id) do nothing;
      update profiles set frame = 'f_unique' where id = p;
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

  -- Un booster pris dans la reserve pleine relance le compte a rebours. Un
  -- booster en plus ne touche ni a l'un ni a l'autre.
  if coalesce(p_bonus, false) then
    update profiles set
      boosters_bonus  = boosters_bonus - 1,
      tickets_offerts = greatest(tickets_offerts - case when offert then 1 else 0 end, 0),
      packs_opened    = packs_opened + 1
    where id = p;
  else
    update profiles set
      tickets      = tickets - 1,
      last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
      packs_opened = packs_opened + 1
    where id = p;
  end if;

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
revoke all on function public.open_pack from public, anon;
grant execute on function public.open_pack to authenticated;

-- -------------------------------------------------------------- boutique
create or replace function public.shop_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); it shop_items; pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into it from shop_items where id = p_item and actif;
  if not found then raise exception 'Article indisponible.'; end if;

  select * into pr from profiles where id = p for update;
  if pr.shards < it.prix then raise exception 'Pas assez d''Éclats.'; end if;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possèdes déjà cet article.';
  end if;

  update profiles set shards = shards - it.prix where id = p;

  if it.effet = 'tickets' then
    -- Les boosters achetes ne vont pas dans la reserve : ils s'ouvrent a part
    -- (open_pack(true)), sans toucher a son compte a rebours.
    update profiles set boosters_bonus = boosters_bonus + it.montant where id = p;
  elsif it.effet = 'refill' then
    update profiles set tickets = greatest(tickets, cfg('ticket_cap')), last_tick = now() where id = p;
  elsif it.effet = 'trade_token' then
    insert into inventory (user_id, item_id, qty) values (p, 'trade_token', it.montant)
      on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty;
  elsif it.effet = 'carte' then
    -- Une carte achetee entre dans la collection comme n'importe quelle autre.
    -- Elle est marquee `unique_buy` en boutique : on ne l'achete qu'une fois.
    if it.carte_id is null then raise exception 'Article mal configuré.'; end if;
    insert into collection (user_id, card_id, qty) values (p, it.carte_id, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else -- cosmetique
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  return me();
end $$;

-- ---------------------------------------------------------------- me()
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
      -- Les boosters en plus (boutique, cadeaux), hors reserve.
      'boosters_bonus', pr.boosters_bonus, 'bonus_offerts', pr.tickets_offerts,
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

-- --------------------------------------------------------------- cadeaux
create or replace function public.ouvrir_cadeau(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c cadeaux;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  update cadeaux set ouvert_le = now()
   where id = p_id and user_id = p and ouvert_le is null
   returning * into c;
  if not found then raise exception 'Ce cadeau a déjà été ouvert.'; end if;

  -- Les boosters offerts s'ouvrent a part, hors reserve, comme ceux de la
  -- boutique, et sans carte unique (tickets_offerts).
  update profiles set shards    = shards + c.eclats,
                      boosters_bonus  = boosters_bonus + c.boosters,
                      tickets_offerts = tickets_offerts + c.boosters,
                      fragments = fragments + c.fragments
   where id = p;

  if c.carte is not null then
    insert into collection (user_id, card_id, qty) values (p, c.carte, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    -- Une carte qui se vend en boutique (une Promo) est notee comme acquise :
    -- la boutique ne la revendra pas a qui l'a recue.
    insert into inventory (user_id, item_id, qty)
    select p, s.id, 1 from shop_items s where s.carte_id = c.carte and s.unique_buy
    on conflict (user_id, item_id) do nothing;
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;

  return me();
end $$;

-- ---------------------------------------------------------- cadre Unique
-- Celui qui a tire la carte unique a son cadre d'avatar, « Unique » : pose
-- par open_pack au moment du tirage, et rattrape ici pour une carte tiree
-- avant que le cadre existe (version 1.5.6).
insert into public.inventory (user_id, item_id, qty)
select gagnant, 'f_unique', 1 from public.chasse where gagnant is not null
on conflict (user_id, item_id) do nothing;
update public.profiles p set frame = 'f_unique'
  from public.chasse c where c.gagnant = p.id and p.frame = 'default';

commit;

-- Verification : la reserve ne deborde plus, et le cadre Unique a son
-- detenteur s'il y en a un.
select (select count(*) from public.profiles where tickets > public.cfg('ticket_cap')) as reserves_qui_debordent,
       (select coalesce(sum(boosters_bonus), 0) from public.profiles) as boosters_en_plus,
       (select string_agg(p.pseudo, ', ') from public.inventory i join public.profiles p on p.id = i.user_id
         where i.item_id = 'f_unique') as cadre_unique;
