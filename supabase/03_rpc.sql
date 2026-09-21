-- =====================================================================
--  Mate TCG Online — les actions du jeu.
--  Le navigateur ne fait qu'appeler ces fonctions : il ne peut ni
--  s'offrir un booster, ni se donner une carte, ni forcer un echange.
--  A executer apres 01_schema.sql et 02_cards.sql.
-- =====================================================================

-- ------------------------------------------------- etat complet du joueur
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  pr := regen_tickets(p);
  perform sync_collection_quests(p);

  return jsonb_build_object(
    'profil', jsonb_build_object(
      'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
      'is_admin', pr.is_admin, 'shards', pr.shards, 'tickets', pr.tickets,
      'last_tick', pr.last_tick, 'trade_free_at', pr.trade_free_at,
      'packs_opened', pr.packs_opened, 'trades_done', pr.trades_done,
      'streak', pr.streak, 'last_checkin', pr.last_checkin,
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', cfg('ticket_minutes'),
      'serveur', now()),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false)) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------- profil (pseudo…)
create or replace function public.set_profile(p_pseudo text, p_avatar text, p_frame text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;

  if p_pseudo is not null then
    if p_pseudo !~ '^[A-Za-z0-9_.\-]{3,16}$' then
      raise exception 'Pseudo invalide : 3 a 16 caracteres, lettres, chiffres, . _ -';
    end if;
    if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> p) then
      raise exception 'Ce pseudo est deja pris.';
    end if;
  end if;

  -- Un avatar « card:cXXX » doit correspondre a une carte reellement possedee.
  if p_avatar is not null and p_avatar like 'card:%' then
    if not exists (select 1 from collection
                   where user_id = p and card_id = substr(p_avatar, 6) and qty > 0) then
      raise exception 'Tu ne possedes pas cette carte.';
    end if;
  end if;

  -- Un cadre achete doit etre dans l'inventaire.
  if p_frame is not null and p_frame <> 'default'
     and not exists (select 1 from inventory where user_id = p and item_id = p_frame and qty > 0) then
    raise exception 'Cadre non debloque.';
  end if;

  update profiles set
    pseudo = coalesce(p_pseudo, pseudo),
    avatar = coalesce(p_avatar, avatar),
    frame  = coalesce(p_frame,  frame)
  where id = p;

  return me();
end $$;

-- ------------------------------------------------------- visite du jour
create or replace function public.checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles; today date;
begin
  if p is null then raise exception 'non connecte'; end if;
  today := (now() at time zone 'Europe/Paris')::date;
  select * into pr from profiles where id = p for update;

  if pr.last_checkin is distinct from today then
    update profiles set
      streak = case when pr.last_checkin = today - 1 then pr.streak + 1 else 1 end,
      last_checkin = today
    where id = p;
    perform bump_quests(p, 'checkin', 1);
  end if;
  return me();
end $$;

-- =====================================================================
--  Ouverture d'un booster
-- =====================================================================
create or replace function public.pick_card(r text) returns text
language plpgsql volatile as $$
declare out_id text; ord text[]; essai text;
begin
  -- On vise la rarete demandee, puis on se rabat sur la plus proche si elle est vide.
  ord := case r
    when 'C'  then array['C','PC','R','E','L']
    when 'PC' then array['PC','C','R','E','L']
    when 'R'  then array['R','PC','E','C','L']
    when 'E'  then array['E','R','L','PC','C']
    when 'L'  then array['L','E','R','PC','C']
    else array['C','PC','R','E','L'] end;

  foreach essai in array ord loop
    select id into out_id from cards
      where in_booster and rar = essai and cat <> 'essence'
      order by random() limit 1;
    if out_id is not null then return out_id; end if;
  end loop;
  return null;
end $$;

create or replace function public.open_pack() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles;
  god boolean; ids text[] := '{}'; cid text; x double precision;
  nouvelles int := 0; i int;
begin
  if p is null then raise exception 'non connecte'; end if;

  pr := regen_tickets(p);
  if pr.tickets < 1 then
    raise exception 'RESERVE_VIDE';
  end if;

  god := random() < 1.0 / cfg('god_odds');

  if god then
    for i in 1..4 loop ids := ids || pick_card('R'); end loop;
    for i in 1..3 loop ids := ids || pick_card('E'); end loop;
    ids := ids || pick_card('L');
  else
    for i in 1..3 loop ids := ids || pick_card('C'); end loop;
    ids := ids || pick_card(case when random() < 0.5 then 'C' else 'PC' end);
    ids := ids || pick_card('PC');
    ids := ids || pick_card('PC');

    select id into cid from cards where in_booster and cat = 'essence' order by random() limit 1;
    ids := ids || coalesce(cid, pick_card('C'));

    x := random() * 100.0;
    ids := ids || pick_card(case when x < 79.2 then 'R'
                                 when x < 95.83 then 'E'
                                 else 'L' end);
  end if;

  ids := array_remove(ids, null);
  if array_length(ids, 1) is null then raise exception 'BOOSTER_VIDE'; end if;

  -- Les cartes encore jamais obtenues, avant de mettre a jour la collection.
  select count(*) into nouvelles from unnest(ids) u(cid2)
    where not exists (select 1 from collection c
                      where c.user_id = p and c.card_id = u.cid2 and c.qty > 0);

  insert into collection (user_id, card_id, qty)
  select p, u.cid2, count(*) from unnest(ids) u(cid2) group by u.cid2
  on conflict (user_id, card_id) do update set qty = collection.qty + excluded.qty;

  -- Un booster consomme depuis la reserve pleine relance le compte a rebours.
  update profiles set
    tickets      = tickets - 1,
    last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
    packs_opened = packs_opened + 1
  where id = p;

  perform bump_quests(p, 'packs', 1);
  perform bump_quests(p, 'new_cards', nouvelles);
  perform bump_quests(p, 'rarity_R', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('R','E','L')));
  perform bump_quests(p, 'rarity_E', (select count(*)::int from cards
                                      where id = any(ids) and rar in ('E','L')));
  perform bump_quests(p, 'rarity_L', (select count(*)::int from cards
                                      where id = any(ids) and rar = 'L'));
  perform sync_collection_quests(p);

  return jsonb_build_object('cards', to_jsonb(ids), 'god', god, 'etat', me());
end $$;

-- =====================================================================
--  Quetes : encaisser une recompense
-- =====================================================================
create or replace function public.claim_quest(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); q quests; pk text; prog int; deja boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  select * into q from quests where id = p_quest;
  if not found then raise exception 'Quete inconnue.'; end if;

  pk := period_key(q.scope);
  select progress, claimed into prog, deja
    from quest_progress where user_id = p and quest_id = q.id and period_key = pk for update;

  if deja then raise exception 'Recompense deja recuperee.'; end if;
  if coalesce(prog, 0) < q.goal then raise exception 'Quete non terminee.'; end if;

  update quest_progress set claimed = true
    where user_id = p and quest_id = q.id and period_key = pk;
  update profiles set shards = shards + q.reward where id = p;

  return me();
end $$;

-- =====================================================================
--  Boutique
-- =====================================================================
create or replace function public.shop_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); it shop_items; pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  select * into it from shop_items where id = p_item and actif;
  if not found then raise exception 'Article indisponible.'; end if;

  select * into pr from profiles where id = p for update;
  if pr.shards < it.prix then raise exception 'Pas assez d''Eclats.'; end if;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possedes deja cet article.';
  end if;

  update profiles set shards = shards - it.prix where id = p;

  if it.effet = 'tickets' then
    -- Les boosters achetes s'ajoutent par-dessus le plafond de la reserve.
    update profiles set tickets = tickets + it.montant where id = p;
  elsif it.effet = 'refill' then
    update profiles set tickets = greatest(tickets, cfg('ticket_cap')), last_tick = now() where id = p;
  elsif it.effet = 'trade_token' then
    insert into inventory (user_id, item_id, qty) values (p, 'trade_token', it.montant)
      on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty;
  else -- cosmetique
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  return me();
end $$;

-- =====================================================================
--  Echanges : demande, reponse, validation mutuelle.
--  Rarete identique obligatoire ; cout paye par le demandeur.
-- =====================================================================
create or replace function public.trade_create(
  p_pseudo text, p_offer text, p_want text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles; dest profiles;
  ro text; rw text; jeton int; gratuit boolean;
begin
  if p is null then raise exception 'non connecte'; end if;

  select * into dest from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if dest.id = p then raise exception 'Tu ne peux pas echanger avec toi-meme.'; end if;

  select rar into ro from cards where id = p_offer;
  select rar into rw from cards where id = p_want;
  if ro is null or rw is null then raise exception 'Carte inconnue.'; end if;
  if ro <> rw then raise exception 'Les deux cartes doivent etre de la meme rarete.'; end if;
  if ro = 'ES' then raise exception 'Les Essences ne s''echangent pas.'; end if;

  if not exists (select 1 from collection where user_id = p and card_id = p_offer and qty > 0) then
    raise exception 'Tu ne possedes pas la carte que tu proposes.';
  end if;

  if exists (select 1 from trades where from_user = p and to_user = dest.id
             and offer_card = p_offer and want_card = p_want and status = 'pending') then
    raise exception 'Cette demande est deja en attente.';
  end if;
  if (select count(*) from trades where from_user = p and status = 'pending') >= 10 then
    raise exception 'Tu as deja 10 demandes en attente.';
  end if;

  -- Cout : l'echange gratuit si le delai est passe, sinon un jeton d'echange.
  select * into pr from profiles where id = p for update;
  gratuit := pr.trade_free_at <= now();
  if gratuit then
    update profiles set trade_free_at = now() + make_interval(hours => cfg('trade_cooldown_h'))
      where id = p;
  else
    select qty into jeton from inventory where user_id = p and item_id = 'trade_token' for update;
    if coalesce(jeton, 0) < 1 then raise exception 'ECHANGE_EN_RECHARGE'; end if;
    update inventory set qty = qty - 1 where user_id = p and item_id = 'trade_token';
  end if;

  insert into trades (from_user, to_user, offer_card, want_card, note)
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140));

  return me();
end $$;

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades; a uuid; b uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  select * into t from trades where id = p_trade for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if t.to_user <> p then raise exception 'Cette demande ne t''est pas adressee.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est deja traitee.'; end if;

  if not p_accept then
    update trades set status = 'declined', resolved_at = now() where id = t.id;
    return me();
  end if;

  -- Verrouillage dans un ordre stable, pour que deux echanges croises
  -- ne puissent pas se bloquer mutuellement.
  a := least(t.from_user, t.to_user); b := greatest(t.from_user, t.to_user);
  perform 1 from profiles where id = a for update;
  perform 1 from profiles where id = b for update;

  if not exists (select 1 from collection where user_id = t.from_user and card_id = t.offer_card and qty > 0) then
    update trades set status = 'cancelled', resolved_at = now() where id = t.id;
    raise exception 'Le demandeur ne possede plus cette carte.';
  end if;
  if not exists (select 1 from collection where user_id = p and card_id = t.want_card and qty > 0) then
    raise exception 'Tu ne possedes pas la carte demandee.';
  end if;

  update collection set qty = qty - 1 where user_id = t.from_user and card_id = t.offer_card;
  update collection set qty = qty - 1 where user_id = p            and card_id = t.want_card;

  insert into collection (user_id, card_id, qty) values (p, t.offer_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;
  insert into collection (user_id, card_id, qty) values (t.from_user, t.want_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  update trades set status = 'accepted', resolved_at = now() where id = t.id;
  update profiles set trades_done = trades_done + 1 where id in (p, t.from_user);

  perform bump_quests(p, 'trades', 1);
  perform bump_quests(t.from_user, 'trades', 1);
  perform sync_collection_quests(p);
  perform sync_collection_quests(t.from_user);

  return me();
end $$;

create or replace function public.trade_cancel(p_trade uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades;
begin
  if p is null then raise exception 'non connecte'; end if;
  select * into t from trades where id = p_trade for update;
  if not found or t.from_user <> p then raise exception 'Demande introuvable.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est deja traitee.'; end if;
  update trades set status = 'cancelled', resolved_at = now() where id = t.id;
  return me();
end $$;

-- Les demandes, avec le pseudo et l'avatar d'en face.
create or replace function public.trade_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'sens', case when t.from_user = p then 'envoyee' else 'recue' end,
      'pseudo', o.pseudo, 'avatar', o.avatar,
      'offer', t.offer_card, 'want', t.want_card, 'note', t.note,
      'status', t.status, 'created_at', t.created_at,
      'possible', exists (select 1 from collection c
                          where c.user_id = p and c.qty > 0
                            and c.card_id = case when t.from_user = p then t.offer_card else t.want_card end))
      order by t.created_at desc)
    from trades t
    join profiles o on o.id = case when t.from_user = p then t.to_user else t.from_user end
    where (t.from_user = p or t.to_user = p)
      and (t.status = 'pending' or t.resolved_at > now() - interval '7 days')
  ), '[]'::jsonb);
end $$;

-- Recherche d'un joueur par pseudo (pour viser sa demande d'echange).
create or replace function public.find_player(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r profiles;
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  select * into r from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;
  return jsonb_build_object('pseudo', r.pseudo, 'avatar', r.avatar, 'frame', r.frame);
end $$;

-- =====================================================================
--  Droits d'appel : les fonctions ne sont ouvertes qu'aux comptes connectes.
-- =====================================================================
-- pick_card, bump_quests, regen_tickets et sync_collection_quests sont des rouages
-- internes : personne n'a a les appeler depuis le navigateur.
revoke all on function public.pick_card, public.bump_quests, public.regen_tickets,
  public.sync_collection_quests from public, anon, authenticated;

revoke all on function public.me, public.set_profile, public.checkin, public.open_pack,
  public.claim_quest, public.shop_buy, public.trade_create, public.trade_respond,
  public.trade_cancel, public.trade_list, public.find_player from public, anon;

grant execute on function public.me, public.set_profile, public.checkin, public.open_pack,
  public.claim_quest, public.shop_buy, public.trade_create, public.trade_respond,
  public.trade_cancel, public.trade_list, public.find_player to authenticated;
