-- Mate TCG Online — mise a jour 2.5, assemblee par tools/build-sql.py le 2026-10-24.
-- A coller d'un bloc dans Supabase > SQL Editor ; rejouable sans danger.
-- Ne pas editer : editer 03_rpc.sql, 04_seed.sql, 07_vitrine.sql, 12_recyclage.sql, 21_reflets.sql, 22b_echauffement.sql, 22c_reverses.sql, 22d_admin.sql, 22e_echauffement-evenement.sql, 22f_sans-fin.sql, calendrier-2.5.sql.

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
  perform garde_beta();

  if p_pseudo is not null then
    if p_pseudo !~ '^[A-Za-z0-9_.\-]{3,16}$' then
      raise exception 'Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ -';
    end if;
    if exists (select 1 from profiles where lower(pseudo) = lower(p_pseudo) and id <> p) then
      raise exception 'Ce pseudo est déjà pris.';
    end if;
  end if;

  -- Un avatar « card:cXXX » doit correspondre a une carte reellement possedee.
  if p_avatar is not null and p_avatar like 'card:%' then
    if not exists (select 1 from collection
                   where user_id = p and card_id = substr(p_avatar, 6) and qty > 0) then
      raise exception 'Tu ne possèdes pas cette carte.';
    end if;
  end if;

  -- Un cadre achete doit etre dans l'inventaire.
  if p_frame is not null and p_frame <> 'default'
     and not exists (select 1 from inventory where user_id = p and item_id = p_frame and qty > 0) then
    raise exception 'Cadre non débloqué.';
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
  perform garde_beta();
  today := (now() at time zone 'Europe/Paris')::date;
  select * into pr from profiles where id = p for update;

  if pr.last_checkin is distinct from today then
    update profiles set
      streak = case when pr.last_checkin = today - 1 then pr.streak + 1 else 1 end,
      last_checkin = today
    where id = p;
    -- La plus longue serie : elle sert aux succes, qui ne doivent pas
    -- disparaitre le jour ou la serie en cours retombe.
    update profiles set serie_max = greatest(serie_max, streak) where id = p;
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
      where in_booster and not promo and rar = essai and cat <> 'essence'
      order by random() limit 1;
    if out_id is not null then return out_id; end if;
  end loop;
  return null;
end $$;

-- `p_bonus` : ouvrir un booster « en plus » (boutique, cadeau) plutot qu'un
-- booster de la reserve. Il ne touche ni a la reserve ni a son compte a
-- rebours. L'ancienne signature, sans parametre, est retiree : avec les deux,
-- un appel sans argument serait ambigu.
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

  -- Six cartes, chacune a sa place (version 2.0) :
  --   1 · Commune
  --   2 · Commune
  --   3 · Peu commune
  --   4 · Essence
  --   5 · une Reverse (01_schema.sql) : Commune 50 %, Peu commune 35 %,
  --       Rare 15 %
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
    select id into cid from cards
     where reverse and rar = case when x < 50.0 then 'C' when x < 85.0 then 'PC' else 'R' end
     order by random() limit 1;
    ids := ids || cid;

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
  -- Version 2.0 : les Reverses Rares sorties.
  perform bump_quests(p, 'rev_R', (select count(*)::int from cards
                                   where id = any(ids) and reverse and rar = 'R'));
  perform sync_collection_quests(p);
  perform check_promos(p);

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
  perform garde_beta();
  select * into q from quests where id = p_quest;
  if not found then raise exception 'Quête inconnue.'; end if;
  -- Une quete d'evenement (21_reflets.sql) ne s'encaisse que pendant qu'il dure.
  if q.evenement is not null and q.evenement is distinct from evenement_en_cours() then
    raise exception 'Cet événement est terminé.';
  end if;

  pk := period_key(q.scope);
  select progress, claimed into prog, deja
    from quest_progress where user_id = p and quest_id = q.id and period_key = pk for update;

  if deja then raise exception 'Récompense déjà récupérée.'; end if;
  if coalesce(prog, 0) < q.goal then raise exception 'Quête non terminée.'; end if;

  update quest_progress set claimed = true
    where user_id = p and quest_id = q.id and period_key = pk;

  if q.reward > 0 and q.monnaie = 'prismes' then
    perform crediter_prismes(p, q.evenement, q.reward);
  elsif q.reward > 0 then
    update profiles set shards = shards + q.reward where id = p;
  end if;

  -- Une quete peut payer en objet plutot qu'en Eclats : un cadre, une carte.
  -- `item_id` sert d'abord a l'affichage — la fiche de quete montre ce qu'on
  -- va toucher — et l'accorde ensuite si ce n'est pas deja fait.
  --
  -- `do nothing` et non `qty + 1` : les deux paliers de Promo sont deja
  -- accordes par check_promos() des que le pourcentage est atteint, avant
  -- meme qu'on encaisse la quete. Sans ce garde-fou, encaisser donnerait un
  -- second exemplaire d'une carte qui n'existe qu'en un seul.
  if q.item_id is not null then
    if exists (select 1 from cards where id = q.item_id) then
      insert into collection (user_id, card_id, qty) values (p, q.item_id, 1)
        on conflict (user_id, card_id) do nothing;
    else
      insert into inventory (user_id, item_id, qty) values (p, q.item_id, 1)
        on conflict (user_id, item_id) do nothing;
    end if;
  end if;

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
  perform garde_beta();
  select * into it from shop_items where id = p_item and actif;
  if not found then raise exception 'Article indisponible.'; end if;
  -- Un article d'evenement (21_reflets.sql) ne se vend que pendant qu'il dure.
  if it.evenement is not null and it.evenement is distinct from evenement_en_cours() then
    raise exception 'Cet événement est terminé.';
  end if;
  -- Version 2.1 : un joueur entre par invitation n'invite pas a son tour
  -- (est_filleul, 21_reflets.sql). Verifie avant de faire payer.
  if it.effet = 'invitation' and est_filleul(p) then
    raise exception 'Les joueurs invités ne peuvent pas inviter à leur tour.';
  end if;

  select * into pr from profiles where id = p for update;

  if it.unique_buy and exists (select 1 from inventory where user_id = p and item_id = it.id) then
    raise exception 'Tu possèdes déjà cet article.';
  end if;
  -- `limite` : combien de fois un joueur peut l'acheter. Le compte est tenu
  -- dans l'inventaire, sous l'identifiant de l'article.
  if it.limite is not null and coalesce((select qty from inventory
                                          where user_id = p and item_id = it.id), 0) >= it.limite then
    raise exception 'Tu as atteint la limite pour cet article.';
  end if;

  -- La devise (version 2.0) : Eclats, Fragments, ou Prismes de l'evenement.
  if it.devise = 'fragments' then
    if pr.fragments < it.prix then raise exception 'Pas assez de Fragments.'; end if;
    update profiles set fragments = fragments - it.prix where id = p;
  elsif it.devise = 'prismes' then
    update evt_comptes set solde = solde - it.prix
     where user_id = p and evenement = it.evenement and solde >= it.prix;
    if not found then raise exception 'Pas assez de Prismes.'; end if;
  else
    if pr.shards < it.prix then raise exception 'Pas assez d''Éclats.'; end if;
    update profiles set shards = shards - it.prix where id = p;
  end if;
  if it.limite is not null and not it.unique_buy then
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  if it.effet = 'tickets' then
    -- Les boosters achetes ne vont pas dans la reserve : ils s'ouvrent a part
    -- (open_pack(true)), sans toucher a son compte a rebours.
    update profiles set boosters_bonus = boosters_bonus + it.montant where id = p;
  elsif it.effet = 'refill' then
    update profiles set tickets = greatest(tickets, cfg('ticket_cap')), last_tick = now() where id = p;
  elsif it.effet = 'trade_token' then
    insert into inventory (user_id, item_id, qty) values (p, 'trade_token', it.montant)
      on conflict (user_id, item_id) do update set qty = inventory.qty + excluded.qty;
  elsif it.effet = 'invitation' then
    perform creer_invitation(p);
  elsif it.effet in ('fragments', 'reverse_R') then
    perform accorder(p, it.effet, it.montant, null);
  elsif it.effet = 'carte' then
    -- Une carte achetee entre dans la collection comme n'importe quelle autre.
    -- Elle est marquee `unique_buy` en boutique : on ne l'achete qu'une fois.
    if it.carte_id is null then raise exception 'Article mal configuré.'; end if;
    insert into collection (user_id, card_id, qty) values (p, it.carte_id, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else -- cosmetique : un cadre (f_…) ou un titre (t_…), sous son identifiant
    insert into inventory (user_id, item_id, qty) values (p, it.id, 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  end if;

  return me();
end $$;

-- =====================================================================
--  Echanges : demande, reponse, validation mutuelle.
--  Rarete identique obligatoire ; cout paye par le demandeur.
-- =====================================================================
-- Une demande qui n'aboutit pas ne coute rien.
--
--  Seul un echange CONCLU consomme la demande. Un refus, une annulation, une
--  demande devenue impossible : dans les trois cas rien n'a eu lieu, et le
--  demandeur recupere ce qu'il avait avance — son jeton, ou sa demande
--  gratuite. Le contraire punissait quelqu'un pour une decision qui n'est pas
--  la sienne : on appuyait sur « Proposer », l'autre refusait, et on repartait
--  pour six heures d'attente sans avoir rien obtenu.
--
--  Ca n'ouvre pas la porte a un contournement du delai : un echange qui aboutit
--  n'est jamais rembourse, donc le rythme reel — un echange conclu toutes les
--  six heures — ne bouge pas d'un pouce.
create or replace function public.rembourser_demande(t public.trades)
returns void language plpgsql security definer set search_path = public as $$
begin
  if t.jeton then
    insert into inventory (user_id, item_id, qty) values (t.from_user, 'trade_token', 1)
      on conflict (user_id, item_id) do update set qty = inventory.qty + 1;
  else
    -- La demande gratuite redevient disponible tout de suite. `> now()` evite
    -- de repousser une echeance deja passee dans le passe.
    update profiles set trade_free_at = now()
     where id = t.from_user and trade_free_at > now();
  end if;
end $$;

revoke all on function public.rembourser_demande from public, anon, authenticated;

create or replace function public.trade_create(
  p_pseudo text, p_offer text, p_want text, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); pr profiles; dest profiles;
  ro text; rw text; jeton int; gratuit boolean; tid uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into dest from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then raise exception 'Aucun joueur ne porte ce pseudo.'; end if;
  if dest.id = p then raise exception 'Tu ne peux pas échanger avec toi-même.'; end if;

  select rar into ro from cards where id = p_offer;
  select rar into rw from cards where id = p_want;
  if ro is null or rw is null then raise exception 'Carte inconnue.'; end if;
  if ro <> rw then raise exception 'Les deux cartes doivent être de la même rareté.'; end if;
  if ro = 'ES' then raise exception 'Les Essences ne s''échangent pas.'; end if;
  if ro = 'PR' then raise exception 'Les cartes Promo ne s''échangent pas.'; end if;
  -- Tout ce qui est hors extension — Promos, Essences Brillantes, carte
  -- unique — reste a qui l'a obtenu. Les Reverses, elles, s'echangent : contre
  -- une Reverse de meme rarete.
  if exists (select 1 from cards where id in (p_offer, p_want) and promo and not reverse) then
    raise exception 'Cette carte ne s''échange pas.';
  end if;
  if (select count(distinct reverse) from cards where id in (p_offer, p_want)) > 1 then
    raise exception 'Une Reverse s''échange contre une Reverse.';
  end if;

  if not exists (select 1 from collection where user_id = p and card_id = p_offer and qty > 0) then
    raise exception 'Tu ne possèdes pas la carte que tu proposes.';
  end if;

  if exists (select 1 from trades where from_user = p and to_user = dest.id
             and offer_card = p_offer and want_card = p_want and status = 'pending') then
    raise exception 'Cette demande est déjà en attente.';
  end if;
  if (select count(*) from trades where from_user = p and status = 'pending') >= 10 then
    raise exception 'Tu as déjà 10 demandes en attente.';
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

  insert into trades (from_user, to_user, offer_card, want_card, note, jeton)
  values (p, dest.id, p_offer, p_want, left(coalesce(p_note, ''), 140), not gratuit)
  returning id into tid;

  -- Dans la boite du destinataire (supabase/11_boite.sql). Les deux cartes
  -- voyagent avec l'evenement : la boite les montre sans autre appel.
  perform notifier(dest.id, 'echange_recu', p, tid::text,
                   jsonb_build_object('offer', p_offer, 'want', p_want));

  return me();
end $$;

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); t trades; a uuid; b uuid;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into t from trades where id = p_trade for update;
  if not found then raise exception 'Demande introuvable.'; end if;
  if t.to_user <> p then raise exception 'Cette demande ne t''est pas adressée.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est déjà traitée.'; end if;

  if not p_accept then
    update trades set status = 'declined', resolved_at = now() where id = t.id;
    perform rembourser_demande(t);
    perform notifier(t.from_user, 'echange_refuse', p, t.id::text,
                     jsonb_build_object('offer', t.offer_card, 'want', t.want_card));
    return me();
  end if;

  -- Verrouillage dans un ordre stable, pour que deux echanges croises
  -- ne puissent pas se bloquer mutuellement.
  a := least(t.from_user, t.to_user); b := greatest(t.from_user, t.to_user);
  perform 1 from profiles where id = a for update;
  perform 1 from profiles where id = b for update;

  if not exists (select 1 from collection where user_id = t.from_user and card_id = t.offer_card and qty > 0) then
    -- La demande reste EN ATTENTE, volontairement. Il y avait ici un
    -- `update ... status = 'cancelled'` juste avant le `raise` : il ne servait
    -- a rien. Un `raise exception` annule toute la transaction, donc l'ecriture
    -- qui le precede aussi — la ligne restait « pending » de toute facon, et le
    -- code racontait le contraire de ce qui se passait.
    --
    -- Et c'est tres bien ainsi : le demandeur peut retomber sur cette carte au
    -- prochain booster, et l'echange redevient honorable. Si celui qui recoit
    -- ne veut pas attendre, il a le bouton « Refuser » — qui, lui, rend sa
    -- demande au demandeur.
    raise exception 'Le demandeur ne possède plus cette carte.';
  end if;
  if not exists (select 1 from collection where user_id = p and card_id = t.want_card and qty > 0) then
    raise exception 'Tu ne possèdes pas la carte demandée.';
  end if;

  update collection set qty = qty - 1 where user_id = t.from_user and card_id = t.offer_card;
  update collection set qty = qty - 1 where user_id = p            and card_id = t.want_card;

  insert into collection (user_id, card_id, qty) values (p, t.offer_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;
  insert into collection (user_id, card_id, qty) values (t.from_user, t.want_card, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  update trades set status = 'accepted', resolved_at = now() where id = t.id;
  update profiles set trades_done = trades_done + 1 where id in (p, t.from_user);
  perform notifier(t.from_user, 'echange_accepte', p, t.id::text,
                   jsonb_build_object('offer', t.offer_card, 'want', t.want_card));

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
  perform garde_beta();
  select * into t from trades where id = p_trade for update;
  if not found or t.from_user <> p then raise exception 'Demande introuvable.'; end if;
  if t.status <> 'pending' then raise exception 'Cette demande est déjà traitée.'; end if;
  update trades set status = 'cancelled', resolved_at = now() where id = t.id;
  perform rembourser_demande(t);
  return me();
end $$;

-- Les demandes, avec le pseudo et l'avatar d'en face.
create or replace function public.trade_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'sens', case when t.from_user = p then 'envoyee' else 'recue' end,
      'pseudo', o.pseudo, 'avatar', o.avatar, 'photo', photo_discord(o.id),
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
  perform garde_beta();
  select * into r from profiles where lower(pseudo) = lower(trim(p_pseudo));
  -- Un compte qui n'a pas acces au jeu (01_schema.sql) n'est pas trouvable.
  if not found or not (beta_ouverte() or est_invite(r.id)) then return 'null'::jsonb; end if;
  return jsonb_build_object('pseudo', r.pseudo, 'avatar', r.avatar,
    'frame', r.frame, 'photo', photo_discord(r.id));
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


-- =====================================================================
--  Mate TCG Online — quetes et boutique
--  A jouer apres 03b_promos.sql : deux articles referencent des cartes Promo.
--  Rejouable a volonte : chaque ligne est mise a jour si elle existe deja.
--  C'est ici qu'on equilibre le jeu, pas dans le navigateur.
--
--  ------------------------------------------------------------------
--  L'equilibrage, en une page.
--
--  L'extension compte 122 cartes : 9 essences, 33 communes, 24 peu
--  communes, 28 rares, 18 epiques, 10 legendaires.
--
--  Un booster donne 6 cartes : deux communes, une commune ou peu commune
--  (60/40), une peu commune, une essence, et un dernier tirage a
--  80 % rare / 16 % epique / 4 % legendaire.
--  La reserve tient 5 boosters et se recharge de 1 toutes les 4 h — six
--  boosters par jour pour qui passe regulierement.
--
--  Ce que ca donne, en mediane de simulation :
--      25 % de la collection ......    7 boosters  (le premier jour)
--      50 % .......................   17 boosters  (trois jours)
--      75 % .......................   45 boosters  (une semaine)   -> promo P06
--      90 % .......................  125 boosters  (trois semaines)
--     100 % .......................  693 boosters  (~115 jours)    -> promo P05
--  Le goulot, ce sont les legendaires : dix cartes a 4 % l'une. C'est aussi
--  pourquoi le passage de dix a six cartes n'a presque pas bouge le Master
--  Set (655 -> 693) : le taux de legendaire par paquet, lui, n'a pas change.
--  Ce sont les premiers paliers qui s'allongent, la ou il y avait du gras.
--
--  ------------------------------------------------------------------
--  Ce qui paie, et ce qui ne paie pas.
--
--  Les deux paliers qui donnent une carte Promo ne donnent QUE la carte :
--  zero Eclat. C'est volontaire. Une recompense qui paie deux fois dilue
--  les deux : on se souvient d'avoir debloque la carte, pas d'avoir touche
--  six mille Eclats en meme temps.
--
--  ------------------------------------------------------------------
--  Les raretes completes.
--
--  Une quete par rarete : posseder toutes ses cartes. En mediane de
--  simulation (six boosters par jour, sans echange) :
--      Essences (9) ............   23 boosters  (~4 jours) ......   100
--      Communes (33) ...........   50 boosters  (~8 jours) ......   250
--      Peu communes (24) .......   61 boosters  (~10 jours) .....   350
--      Rares (28) ..............  128 boosters  (~3 semaines) ...  1 200
--      Epiques (18) ............  366 boosters  (~2 mois) .......  3 000
--      Legendaires (10) ........  670 boosters  (~110 jours) ....  6 000
--  Les montants montent avec la duree : peu pour ce qui tombe la premiere
--  semaine (voir « Les Eclats » plus bas), beaucoup pour les deux
--  dernieres raretes, qui demandent des mois. Les Legendaires
--  se completent a peu pres en meme temps que le Master Set, qui donne la
--  carte Promo P05 : les deux recompenses tombent donc presque ensemble.
--
--  L'objectif de chaque quete est calcule sur le catalogue (`count(*)` plus
--  bas) : ajouter une carte a l'extension deplace l'objectif tout seul.
--
--  ------------------------------------------------------------------
--  Les Eclats.
--
--  Depuis la version 1.5, les quetes sont la SEULE source d'Eclats : le
--  recyclage donne des Fragments (12_recyclage.sql). Avant, il rapportait
--  jusqu'a 2 500 Eclats par semaine a un joueur avance ; sans lui, un
--  joueur regulier tombait a ~275 par jour. Les quetes recurrentes
--  (quotidiennes, hebdomadaires) ont donc ete relevees, et les premiers
--  paliers baisses : c'etaient eux qui offraient a un nouveau venu un x10
--  en cinq jours et une Promo en sept.
--
--  Simulation (mediane, sans echange, tous les doublons recycles), Eclats
--  par jour une fois les paliers passes, et jour ou l'on atteint un total :
--                                    par jour    3 000 (x10)   5 000 (Promo)
--      regulier, 6 boosters/jour
--        nouveau venu ..............    ~340      7e jour       10e jour
--        joueur avance .............    ~340     10e jour       14e jour
--      occasionnel, 4/jour 5 j sur 7
--        nouveau venu ..............    ~160     11e jour       21e jour
--        joueur avance .............    ~155     21e jour       31e jour
--  (avant : ~275 par jour pour un regulier avance, et un nouveau venu a
--  3 000 le 5e jour, 5 000 le 7e.)
--
--  Ce que ca achete, pour un regulier avance :
--      x1 booster (350) ...............  un jour
--      x10 boosters (3 000) ...........  neuf a dix jours
--      un cadre (1 200 a 5 000) .......  de quatre a quinze jours
--      une carte Promo (5 000) ........  quinze jours
--  Tout depenser en boosters ajoute ~1,1 booster par jour aux six de la
--  reserve (+18 %) : les Eclats aident, ils ne remplacent pas le temps.
--
--  « Petit menage » (recycler 5 doublons) est la quete quotidienne de fin de
--  collection : « Du sang neuf » devient impossible quand il ne manque plus
--  rien, celle-ci reste faisable tant qu'on tire des doublons.
-- =====================================================================

-- Une quete peut accorder un objet en plus — ou a la place — des Eclats :
-- un cadre, une carte. C'est ce qui permet a un palier de payer autrement
-- qu'en monnaie.
alter table public.quests add column if not exists item_id text;

-- ---------------------------------------------------------------- quetes
-- metric : packs | new_cards | rarity_R | rarity_E | rarity_L | trades
--          | checkin | recycle | collection_pct | set_ES … set_L
--          (tous mesures cote serveur)
--
-- Les objectifs quotidiens sont calibres sur six boosters par jour. A ce
-- rythme, « une Epique » tombe environ trois jours sur quatre (20 % de
-- chances par paquet, six paquets) — assez souvent pour ne pas decourager,
-- assez rarement pour valoir quelque chose.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   30, null, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
  ('d_epic',    'daily',     'rarity_E',       1,   80, null, 'Au moins une Épique',  'Décroche une Épique ou une Légendaire.', 3),
  ('d_new',     'daily',     'new_cards',      3,   30, null, 'Du sang neuf',         'Trouve 3 cartes que tu n''avais pas.', 4),
  ('d_recycle', 'daily',     'recycle',        5,   30, null, 'Petit ménage',         'Recycle 5 doublons.', 5),
  ('d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un échange avec un autre joueur.', 6),

  -- Trente boosters sur les quarante-deux qu'une semaine complete rapporte :
  -- on peut sauter deux jours et finir quand meme.
  ('w_check',   'weekly',    'checkin',        5,  200, null, 'Habitué de la maison', 'Connecte-toi 5 jours dans la semaine.', 1),
  ('w_packs',   'weekly',    'packs',         30,  250, null, 'Ouvreur en série',     'Ouvre 30 boosters cette semaine.', 2),
  ('w_new',     'weekly',    'new_cards',     15,  150, null, 'Chasseur de vides',    'Trouve 15 cartes inédites.', 3),
  -- Huit et non dix : la derniere carte du paquet donne desormais une Epique
  -- ou mieux une fois sur cinq, contre pres d'une sur trois avant. A dix, la
  -- quete passait de huit semaines sur dix a une sur trois — un objectif qu'on
  -- rate sans avoir rien fait de mal n'apprend rien a personne.
  ('w_epic',    'weekly',    'rarity_E',       8,  350, null, 'Huit Épiques',         'Décroche 8 Épiques ou mieux.', 4),
  ('w_legend',  'weekly',    'rarity_L',       1,  450, null, 'Une Légendaire',       'Sors une Légendaire cette semaine.', 5),
  ('w_trade',   'weekly',    'trades',         5,  350, null, 'Le marché',            'Conclus 5 échanges.', 6),

  -- Saisonnieres : une seule fois, pour toujours.
  ('m_legend',  'milestone', 'rarity_L',       1,  200, null, 'Première Légendaire',  'Sors ta toute première Légendaire d''un booster.', 1),

  -- Les paliers de collection. Ceux qui donnent une Promo ne donnent rien d'autre.
  ('m_col25',   'milestone', 'collection_pct', 25,  100, null,  'Un quart du chemin', 'Possède 25 % de la collection.', 2),
  ('m_col50',   'milestone', 'collection_pct', 50,  250, null,  'La moitié',          'Possède 50 % de la collection.', 3),
  ('m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possède 75 % de la collection.', 4),
  ('m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Tout Commence Ici',  'Possède les 122 cartes de l''extension.', 5),

  -- Les raretes completes : toutes les cartes d'une rarete. L'objectif est le
  -- nombre de cartes de cette rarete dans le catalogue.
  ('m_setES',   'milestone', 'set_ES', (select count(*)::int from public.cards where rar = 'ES' and not promo),
                                               100, null,      'Toutes les Essences',     'Possède toutes les Essences de l''extension.', 6),
  ('m_setC',    'milestone', 'set_C',  (select count(*)::int from public.cards where rar = 'C'  and not promo),
                                               250, null,      'Toutes les Communes',     'Possède toutes les Communes de l''extension.', 7),
  ('m_setPC',   'milestone', 'set_PC', (select count(*)::int from public.cards where rar = 'PC' and not promo),
                                               350, null,      'Toutes les Peu communes', 'Possède toutes les Peu communes de l''extension.', 8),
  ('m_setR',    'milestone', 'set_R',  (select count(*)::int from public.cards where rar = 'R'  and not promo),
                                              1200, null,      'Toutes les Rares',        'Possède toutes les Rares de l''extension.', 9),
  ('m_setE',    'milestone', 'set_E',  (select count(*)::int from public.cards where rar = 'E'  and not promo),
                                              3000, null,      'Toutes les Épiques',      'Possède toutes les Épiques de l''extension.', 10),
  ('m_setL',    'milestone', 'set_L',  (select count(*)::int from public.cards where rar = 'L'  and not promo),
                                              6000, null,      'Toutes les Légendaires',  'Possède toutes les Légendaires de l''extension.', 11),

  -- Les paliers de boosters ouverts : la seule progression qui ne depende que
  -- du temps passe, et pas de la chance.
  ('m_packs25', 'milestone', 'packs',          25,  150, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 12),
  ('m_packs50', 'milestone', 'packs',          50,  300, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 13),
  ('m_packs100','milestone', 'packs',         100,  800, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 14),
  ('m_packs200','milestone', 'packs',         200, 2000, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 15),

  ('m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 16),

  -- ---------------------------------------------------------- version 2.0
  -- Les Reverses (03b_promos.sql) : une Rare reverse par jour et cinq par
  -- semaine (15 % par booster : ~62 % des jours, ~65 % des semaines), et les
  -- Reverses completes par rarete. Pour ne pas gonfler les Eclats, le passage
  -- du jour et les cinq paquets baissent de 10 chacun : +~28 Eclats par jour
  -- pour un regulier, ~370 au lieu de ~340.
  ('d_revR',    'daily',     'rev_R',          1,   40, null, 'Reflet rare',          'Décroche une Reverse Rare.', 7),
  ('w_revR',    'weekly',    'rev_R',          5,  250, null, 'Cinq reflets',         'Décroche 5 Reverses Rares cette semaine.', 7),
  ('m_revC',    'milestone', 'rset_C',  (select count(*)::int from public.cards where reverse and rar = 'C'),
                                               400, null,      'Reverses Communes',       'Possède toutes les Reverses Communes.', 17),
  ('m_revPC',   'milestone', 'rset_PC', (select count(*)::int from public.cards where reverse and rar = 'PC'),
                                               700, null,      'Reverses Peu communes',   'Possède toutes les Reverses Peu communes.', 18),
  ('m_revR',    'milestone', 'rset_R',  (select count(*)::int from public.cards where reverse and rar = 'R'),
                                              2500, null,      'Reverses Rares',          'Possède toutes les Reverses Rares.', 19),
  -- Les cadres et titres gagnes en jouant (js/config.js : FRAMES, TITRES).
  ('m_revALL',  'milestone', 'rset_ALL',(select count(*)::int from public.cards where reverse),
                                                 0, 'f_reflet', 'Le Reflet complet',     'Possède les 85 Reverses.', 20),
  ('m_master',  'milestone', 'collection_pct',100,  0, 'f_master', 'Maître de l''extension', 'Possède les 122 cartes de l''extension.', 21),
  ('m_brill',   'milestone', 'brill_ALL', 9,           0, 'f_aurore', 'Aurore',               'Possède les 9 Essences Brillantes.', 22),
  ('m_packs300','milestone', 'packs',     300,         0, 'f_sceau',  'Trois cents paquets',  'Ouvre 300 boosters en tout.', 23),
  ('m_illu10',  'milestone', 'illu',       10,         0, 't_devin',  'Le Devin',             'Trouve 10 illustrations à Devine l''illu.', 24),
  ('m_invite',  'milestone', 'invite',      1,         0, 't_hote',   'L''Hôte',              'Un ami entre dans le jeu avec ton invitation.', 25),
  -- ---------------------------------------------------------- version 2.1
  -- Plusieurs exemplaires d'une meme carte classique (pas une Reverse) :
  -- l'appel des exemplaires a garder (22_garder.sql). Simulation, sans rien
  -- recycler de la carte : 10 d'une meme Rare vers 170 boosters, 5 d'une
  -- meme Epique vers 200, 3 d'une meme Legendaire vers 230 (medianes) —
  -- un mois environ chacune a six boosters par jour. Les echanges y aident.
  ('m_exR',     'milestone', 'ex_R',       10,      1000, null,      'Dix fois la même',      'Possède 10 exemplaires d''une même Rare.', 26),
  ('m_exE',     'milestone', 'ex_E',        5,      1500, null,      'Cinq fois la même',     'Possède 5 exemplaires d''une même Épique.', 27),
  ('m_exL',     'milestone', 'ex_L',        3,      2500, null,      'Trois fois la même',    'Possède 3 exemplaires d''une même Légendaire.', 28),
  -- ---------------------------------------------------------- version 2.5
  -- Le mode sans fin de L'Echauffement (22f_sans-fin.sql) : dix jours
  -- gagnes, le titre « Infatigable ». Un defi par jour, gagne une fois sur
  -- deux a trois a peu pres (simulation, en tete du fichier) : trois
  -- semaines environ pour un joueur qui vient chaque jour.
  ('m_sf10',    'milestone', 'sf_victoire', 10,         0, 't_ech_infatigable', 'Infatigable', 'Gagne 10 défis du jour, après L''Échauffement.', 29)
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id,
  titre = excluded.titre, detail = excluded.detail, ordre = excluded.ordre;

delete from public.quests where id not in (
  'd_check','d_packs','d_epic','d_new','d_recycle','d_trade',
  'w_check','w_packs','w_new','w_epic','w_legend','w_trade',
  'm_legend','m_col25','m_col50','m_col75','m_col100',
  'm_setES','m_setC','m_setPC','m_setR','m_setE','m_setL',
  'm_packs25','m_packs50','m_packs100','m_packs200',
  'm_trade25',
  'd_revR','w_revR','m_revC','m_revPC','m_revR','m_revALL','m_master','m_brill','m_packs300','m_illu10','m_invite',
  'm_exR','m_exE','m_exL','m_sf10',
  'e_check','e_packs','e_illu','e_revR','e_titre','e_perso','e_revC','e_rev45','e_trade','e_illu7','e_packs70',
  'e_recycle','e_invite',
  'ej_visite','ej_combat','ej_victoire','ej_packs',
  'ee_sept','ee_parfaits','ee_etoiles','ee_joueurs','ee_eclats','ee_reverse','ee_packs','ee_recycle','ee_trade');

-- ------------------------------------------------- l'evenement « Reflets »
-- Ses quetes paient en Prismes (21_reflets.sql). Du jour : 50 Prismes pour
-- qui les fait toutes, plus ce que rapporte Devine l'illu (6 a 25). De
-- l'evenement, une fois : 380. Elles portent sur les nouveautes de la 2.0 —
-- c'est le role de l'evenement de les faire essayer. Le calcul du Pass est
-- en tete de son tableau, dans 21_reflets.sql.
-- Etalees sur les deux semaines, pour un joueur qui ouvre ses 6 boosters par
-- jour : 45 Reverses differentes vers le 11e jour (on en tire ~84, dont ~51
-- differentes en 14 jours), 20 Communes differentes vers le 10e, 70 boosters
-- vers le 12e, 7 illustrations sur 14 jours. Titre et personnalisation sont
-- immediats : elles font decouvrir la 2.0, et ne paient que 20.
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre, evenement, monnaie) values
  ('e_check',   'ev_jour', 'ev_visite',   1, 10, null, 'Un reflet par jour',     'Passe voir l''événement aujourd''hui.', 1, 'reflets', 'prismes'),
  ('e_packs',   'ev_jour', 'packs',     4, 15, null, 'Quatre boosters',        'Ouvre 4 boosters aujourd''hui.', 2, 'reflets', 'prismes'),
  ('e_illu',    'ev_jour', 'illu',      1, 10, null, 'L''illu du jour',        'Trouve l''illustration du jour.', 3, 'reflets', 'prismes'),
  ('e_revR',    'ev_jour', 'rev_R',     1, 15, null, 'Reflet rare',            'Décroche une Reverse Rare.', 4, 'reflets', 'prismes'),
  ('e_titre',   'ev',      'titre',     1, 20, null, 'Un titre à ton nom',     'Équipe un titre sur ton profil.', 1, 'reflets', 'prismes'),
  ('e_perso',   'ev',      'perso',     1, 20, null, 'À ton image',            'Choisis une bannière ou une devise.', 2, 'reflets', 'prismes'),
  ('e_rev45',   'ev',      'rset_ALL', 45, 50, null, 'Quarante-cinq reflets',  'Possède 45 Reverses différentes.', 3, 'reflets', 'prismes'),
  ('e_revC',    'ev',      'rset_C',   20, 60, null, 'Vingt Communes reverses', 'Possède 20 Reverses Communes différentes.', 4, 'reflets', 'prismes'),
  ('e_illu7',   'ev',      'illu',      7, 60, null, 'L''œil affûté',          'Trouve 7 illustrations pendant l''événement.', 5, 'reflets', 'prismes'),
  ('e_packs70', 'ev',      'packs',    70, 50, null, 'Soixante-dix boosters',  'Ouvre 70 boosters pendant l''événement.', 6, 'reflets', 'prismes'),
  ('e_trade',   'ev',      'trades',    3, 40, null, 'Échanges de reflets',    'Conclus 3 échanges.', 7, 'reflets', 'prismes'),
  ('e_recycle', 'ev',      'recycle', 150, 30, null, 'Grand ménage',           'Recycle 150 doublons pendant l''événement.', 8, 'reflets', 'prismes'),
  ('e_invite',  'ev',      'invite',    1, 50, null, 'Un ami de plus',         'Un ami entre dans le jeu avec ton invitation.', 9, 'reflets', 'prismes'),
  -- ------------------------------------- l'evenement « L'Echauffement » (2.5)
  -- Ses quetes paient en Braises (22e_echauffement-evenement.sql, ou est le
  -- calcul du Pass). Du jour : 50 pour qui les fait toutes. De l'evenement,
  -- une fois : 390. Elles portent sur les defis, et sur ce que la 2.5 ouvre
  -- d'autre (fabriquer une Reverse). Comptees par le serveur : ech_terminer
  -- (ech_combat, ech_victoire, ech_eclat, et ech_sync_quetes pour les
  -- etats), fabriquer (fab_rev), open_pack, recycler, trade_respond.
  ('ej_visite',   'ev_jour', 'ev_visite',     1, 10, null, 'À l''entraînement',     'Passe voir L''Échauffement aujourd''hui.', 1, 'echauffement', 'prismes'),
  ('ej_combat',   'ev_jour', 'ech_combat',    1, 10, null, 'Un combat',             'Termine un combat de L''Échauffement.', 2, 'echauffement', 'prismes'),
  ('ej_victoire', 'ev_jour', 'ech_victoire',  1, 15, null, 'Une victoire',          'Gagne un combat de L''Échauffement.', 3, 'echauffement', 'prismes'),
  ('ej_packs',    'ev_jour', 'packs',         4, 15, null, 'Quatre boosters',       'Ouvre 4 boosters aujourd''hui.', 4, 'echauffement', 'prismes'),
  ('ee_sept',     'ev',      'ech_gagnes',    7, 60, null, 'Les sept défis',        'Gagne les sept défis.', 1, 'echauffement', 'prismes'),
  ('ee_parfaits', 'ev',      'ech_parfaits',  3, 40, null, 'Trois fois parfait',    'Fais trois étoiles à 3 défis.', 2, 'echauffement', 'prismes'),
  ('ee_etoiles',  'ev',      'ech_etoiles',  21, 80, null, 'Vingt et une étoiles',  'Les trois étoiles aux sept défis.', 3, 'echauffement', 'prismes'),
  ('ee_joueurs',  'ev',      'ech_joueurs',  10, 40, null, 'Tout l''effectif',      'Fais combattre 10 Joueurs différents.', 4, 'echauffement', 'prismes'),
  ('ee_eclats',   'ev',      'ech_eclat',     5, 30, null, 'Cinq coups d''éclat',   'Place 5 coups d''éclat.', 5, 'echauffement', 'prismes'),
  ('ee_reverse',  'ev',      'fab_rev',       1, 40, null, 'Une Reverse fabriquée', 'Fabrique une Reverse avec tes Fragments.', 6, 'echauffement', 'prismes'),
  ('ee_packs',    'ev',      'packs',        30, 40, null, 'Trente boosters',       'Ouvre 30 boosters pendant l''événement.', 7, 'echauffement', 'prismes'),
  ('ee_recycle',  'ev',      'recycle',     100, 30, null, 'Grand ménage',          'Recycle 100 doublons pendant l''événement.', 8, 'echauffement', 'prismes'),
  ('ee_trade',    'ev',      'trades',        2, 30, null, 'Deux échanges',         'Conclus 2 échanges pendant l''événement.', 9, 'echauffement', 'prismes')
on conflict (id) do update set
  scope = excluded.scope, metric = excluded.metric, goal = excluded.goal,
  reward = excluded.reward, item_id = excluded.item_id, titre = excluded.titre,
  detail = excluded.detail, ordre = excluded.ordre, evenement = excluded.evenement,
  monnaie = excluded.monnaie;

-- -------------------------------------------------------------- boutique
-- effet : tickets | refill | trade_token | cosmetique | carte
--
-- Les intitules commencent par la quantite : « x5 Boosters » se lit d'un
-- coup d'oeil la ou « Cinq boosters » demande une lecture. C'est une liste
-- qu'on parcourt, pas un catalogue qu'on epluche.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre) values
  ('s_pack1',  'boosters',   'x1 Booster',   'Un booster à ouvrir tout de suite, sans toucher à ta réserve.', 350, 'tickets',  1, null, false, 1),
  ('s_pack5',  'boosters',   'x5 Boosters',  'Cinq boosters d''un coup, un peu moins cher à l''unité.',   1600, 'tickets',  5, null, false, 2),
  ('s_pack10', 'boosters',   'x10 Boosters', 'Le meilleur prix à l''unité du rayon.',                     3000, 'tickets', 10, null, false, 3),

  ('s_token1', 'echange',    'x1 Jeton d''échange',   'Lance une demande d''échange sans attendre la fin du délai.',  600, 'trade_token', 1, null, false, 1),
  ('s_token5', 'echange',    'x5 Jetons d''échanges', 'Cinq demandes d''échange immédiates.',                        2500, 'trade_token', 5, null, false, 2),

  -- Les deux Promos achetables. A 5 000, c'est un peu plus de deux semaines
  -- d'epargne : assez pour que le choix « j'ouvre ou j'economise » existe,
  -- pas assez pour decourager.
  ('s_p01',    'promo',      'Carte Promo P01', 'Major de Paris, illustré par Justice Wong & HL. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p01', true, 1),
  ('s_p02',    'promo',      'Carte Promo P02', 'Major de Paris, illustration alternative de Rexpo. Introuvable en booster.',
                                                                                                          5000, 'carte', 1, 'p02', true, 2),

  ('f_azur',   'cosmetique', 'Cadre Azur',   'Un liseré bleu autour de ton avatar.',                      1200, 'cosmetique', 1, null, true, 1),
  ('f_rose',   'cosmetique', 'Cadre Rose',   'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique', 1, null, true, 2),
  ('f_or',     'cosmetique', 'Cadre Or',     'Doré, comme les Légendaires.',                              2500, 'cosmetique', 1, null, true, 3),
  ('f_prisme', 'cosmetique', 'Cadre Prisme', 'Un anneau de cristal taillé, et son éclat qui scintille.',  5000, 'cosmetique', 1, null, true, 4)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy,
  ordre = excluded.ordre, actif = true;

-- Le Cadre Sceau ne se vend pas, et aucune quete ne le donne pour l'instant
-- (voir FRAMES dans js/config.js). On le retire de la boutique s'il y
-- trainait.
-- Version 2.0 : l'invitation, payee en Eclats (21_reflets.sql), et la
-- boutique de l'evenement « Reflets », payee en Prismes.
insert into public.shop_items (id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, devise, evenement, limite) values
  ('s_invite',     'invitation', 'Invitation', 'Un code pour faire entrer un ami. Il reçoit 10 boosters et 1 000 Éclats de bienvenue.',
                                                                                               2000, 'invitation', 1, null, false, 1, 'eclats', null, 3),
  -- Un joueur assidu gagne ~1 100 Prismes sur l'evenement : la boutique en
  -- coute ~1 300, il faut choisir.
  ('ev_boosters',  'evenement', 'x2 Boosters',       'Deux boosters à ouvrir tout de suite.',     70, 'tickets',    2, null, false, 1, 'prismes', 'reflets', 5),
  ('ev_fragments', 'evenement', '500 Fragments',     'De quoi fabriquer les cartes qui manquent.', 60, 'fragments', 500, null, false, 2, 'prismes', 'reflets', 5),
  ('ev_reverse',   'evenement', 'Une Reverse Rare',  'Une Reverse Rare que tu n''as pas encore.', 150, 'reverse_R',  1, null, false, 3, 'prismes', 'reflets', 3),
  ('t_collect',    'evenement', 'Titre « Collectionneur de Reflets »', 'Un titre qui ne se vendra plus après l''événement.',
                                                                                                200, 'cosmetique', 1, null, true, 4, 'prismes', 'reflets', null),
  -- Version 2.5 : la boutique de L'Echauffement, payee en Braises
  -- (22e_echauffement-evenement.sql). Tout acheter coute 1 120 ; un joueur
  -- regulier en gagne ~815 : il faut choisir.
  ('eh_boosters',  'evenement', 'x2 Boosters',       'Deux boosters à ouvrir tout de suite.',      80, 'tickets',    2, null, false, 1, 'prismes', 'echauffement', 4),
  ('eh_fragments', 'evenement', '500 Fragments',     'De quoi fabriquer les cartes qui manquent.', 70, 'fragments', 500, null, false, 2, 'prismes', 'echauffement', 4),
  ('eh_reverse',   'evenement', 'Une Reverse Rare',  'Une Reverse Rare que tu n''as pas encore.', 160, 'reverse_R',  1, null, false, 3, 'prismes', 'echauffement', 2),
  ('t_ech_entraineur', 'evenement', 'Titre « Entraîneur »', 'Un titre qui ne se vendra plus après l''événement.',
                                                                                                200, 'cosmetique', 1, null, true, 4, 'prismes', 'echauffement', null)
on conflict (id) do update set
  categ = excluded.categ, titre = excluded.titre, detail = excluded.detail,
  prix = excluded.prix, effet = excluded.effet, montant = excluded.montant,
  carte_id = excluded.carte_id, unique_buy = excluded.unique_buy, ordre = excluded.ordre,
  devise = excluded.devise, evenement = excluded.evenement, limite = excluded.limite, actif = true;

delete from public.shop_items where id not in (
  's_pack1','s_pack5','s_pack10','s_token1','s_token5',
  's_p01','s_p02',
  'f_azur','f_rose','f_or','f_prisme',
  's_invite','ev_boosters','ev_fragments','ev_reverse','t_collect',
  'eh_boosters','eh_fragments','eh_reverse','t_ech_entraineur');


-- =====================================================================
--  Mate TCG Online — la vitrine : quatre cartes mises en avant sur le profil
--  A executer apres 06_social.sql. Rejouable sans danger.
-- =====================================================================

alter table public.profiles
  add column if not exists vitrine text[] not null default '{}';

-- Quatre cartes au maximum, toutes possedees, sans doublon : le serveur
-- verifie, sinon n'importe qui exposerait une Legendaire qu'il n'a pas.
create or replace function public.set_vitrine(p_cards text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); propre text[]; c text;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  p_cards := coalesce(p_cards, '{}');
  if array_length(p_cards, 1) > 4 then raise exception 'Quatre cartes au maximum.'; end if;

  propre := '{}';
  foreach c in array p_cards loop
    if c = any(propre) then continue; end if;                 -- pas deux fois la meme
    if not exists (select 1 from collection
                   where user_id = moi and card_id = c and qty > 0) then
      raise exception 'Tu ne possèdes pas une des cartes choisies.';
    end if;
    propre := propre || c;
  end loop;

  update profiles set vitrine = propre where id = moi;
  return me();
end $$;

revoke all on function public.set_vitrine from public, anon;
grant execute on function public.set_vitrine to authenticated;

-- ------------------------------------------------- la vitrine dans me()
-- me() est redefinie ici pour ajouter le champ : la version de 03_rpc.sql ne le
-- connait pas. Rejouer 03_rpc.sql apres ce fichier l'effacerait — il faut alors
-- rejouer celui-ci, ou plus simplement recoller TOUT.sql qui les met dans l'ordre.
-- C'est la derniere version de me() : elle ajoute la vitrine au profil, et
-- c'est donc ici que se pose l'appel a check_promos (supabase/03b_promos.sql).
-- Une carte Promo de palier peut etre debloquee par un echange aussi bien que
-- par un booster : sans cet appel, elle n'arriverait qu'a la prochaine
-- ouverture de paquet.
--
-- Elle lit aussi la boite de reception et le recyclage, dont les fonctions
-- sont creees plus loin (11_boite.sql, 12_recyclage.sql). PL/pgSQL resout les
-- appels a l'execution : a la fin de TOUT.sql, tout est la.
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
      -- Version 2.0 (21_reflets.sql) : le titre, la banniere, la devise, et
      -- les titres debloques.
      'titre', pr.titre, 'banniere', pr.banniere, 'devise', pr.devise,
      'titres', to_jsonb(titres_de(p)),
      -- Version 2.1 (22_garder.sql) : les exemplaires a garder, par rarete.
      'garder', pr.garder,
      -- Version 2.1 : entre grace au code d'un autre, il n'invite pas a son tour.
      'filleul', est_filleul(p),
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
    -- Version 2.0 : un evenement fini depuis moins de trois jours (son recap,
    -- 21_reflets.sql). Fonction resolue a l'execution : elle est creee plus loin.
    'recap', evenement_recent(),
    'chasse', chasse_etat(),
    -- Version 2.0 : les reglages, le solde de Prismes de l'evenement en
    -- cours, et les invitations achetees. Les Reverses (version 2.5,
    -- 22c_reverses.sql) : ouvertes ou non, a partir de quand, et leur prix.
    -- Plus de `fabrication_reverse` ici : le site 2.1.3 l'aurait affiche au
    -- double, il garde donc les Reverses fermees.
    'parametres', jsonb_build_object('reverses', jsonb_build_object(
      'ouvertes', reverses_ouvertes(),
      'des', (select reverses_des from parametres where id = 1),
      'couts', jsonb_build_object('C', prix_reverse('C'), 'PC', prix_reverse('PC'), 'R', prix_reverse('R'))),
      -- Version 2.5 (22d_admin.sql) : la date de sortie de chaque version,
      -- que le site suit plutot que la sienne (SORTIE, js/config.js).
      'sorties', coalesce((select sorties from parametres where id = 1), '{}'::jsonb)),
    'prismes', coalesce((select solde from evt_comptes
                          where user_id = p and evenement = evenement_en_cours()), 0),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'cree_le', i.cree_le,
                                          'utilise_par', (select pseudo from profiles where id = i.utilise_par),
                                          'utilise_le', i.utilise_le) order by i.cree_le)
        from invitations i where i.auteur = p), '[]'::jsonb),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    -- Version 2.1 : les exemplaires a garder, carte par carte.
    'gardes', coalesce((select jsonb_object_agg(card_id, n) from gardes where user_id = p), '{}'::jsonb),
    -- Version 2.1 : les cartes en favori, de la plus ancienne a la plus recente.
    'favoris', coalesce((select jsonb_agg(card_id order by le) from favoris where user_id = p), '[]'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'item', q.item_id, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false),
        'monnaie', q.monnaie, 'evenement', q.evenement) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
      -- Les quetes d'un evenement n'existent que pendant qu'il dure.
      where (q.evenement is null or q.evenement = evenement_en_cours())
        -- Un filleul ne peut pas inviter : les quetes d'invitation lui sont cachees.
        and not (q.metric = 'invite' and est_filleul(p))
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------- la vitrine sur la fiche publique
-- La vitrine est visible de tous : c'est fait pour etre montre.
create or replace function public.player_profile(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int; rev int; rev_total int;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;

  ami := o.id = moi or exists (
    select 1 from friendships
     where a = least(moi, o.id) and b = greatest(moi, o.id) and accepte);

  -- `not promo`, des deux cotes. Les cartes Promo vivent dans `cards` pour
  -- pouvoir entrer dans une collection, mais elles n'appartiennent pas a
  -- l'extension : ni dans son total, ni dans son pourcentage (voir la table
  -- `cards` et sync_collection_quests dans 01_schema.sql).
  --
  -- Sans ce garde-fou, la fiche d'un joueur annoncait « / 126 » pendant que
  -- son propre ecran Collection et le palier des 100 % comptaient 122. Deux
  -- ecrans, deux verites, et un joueur a 122/122 qui se voyait incomplet.
  select count(*) into total from cards where not promo;
  select count(*) into possede
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and not k.promo;
  -- Version 2.0 : les Reverses, comptees a part.
  select count(*) into rev_total from cards where reverse;
  select count(*) into rev
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and k.reverse;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'reverses', rev, 'reverses_total', rev_total,
    'titre', o.titre, 'banniere', o.banniere, 'devise', o.devise,
    'vitrine', to_jsonb(o.vitrine),
    'succes', succes_de(o.id),
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end,
    -- Version 2.1 (22_garder.sql) : entre amis, ce qu'il garde au-dela d'un
    -- exemplaire. Ses doublons, ce sont les exemplaires en plus.
    'garde', case when ami then
      coalesce((select jsonb_object_agg(x.card_id, x.g) from (
                  select card_id, garde_de(o.id, card_id) as g from collection
                   where user_id = o.id and qty > 0) x where x.g > 1), '{}'::jsonb)
      else null end);
end $$;

grant execute on function public.me, public.player_profile to authenticated;


-- =====================================================================
--  Mate TCG Online — le recyclage des doublons, et la fabrication
--  A executer apres 11_boite.sql. Rejouable sans danger.
--
--  On jette un doublon, on touche des Fragments. Avec des Fragments, on
--  fabrique une carte qui manque. Toutes les raretes de l'extension se
--  recyclent et se fabriquent ; jamais ce qui est hors extension (Promos,
--  Essences Brillantes, carte unique). On garde toujours au moins un
--  exemplaire de chaque carte : recycler ne fait jamais reculer la
--  collection.
--
--  Les montants sont dans cfg() (supabase/01_schema.sql) :
--      recyclage    Essence 1 · Commune 2 · Peu commune 5 · Rare 20
--                   Epique 80 · Legendaire 250
--      fabrication  Essence 20 · Commune 40 · Peu commune 100 · Rare 400
--                   Epique 2 000 · Legendaire 8 000
--  Les Reverses (version 2.0, ouvertes en 2.5) : recyclees comme leur
--  classique, fabriquees au prix de prix_reverse (22c_reverses.sql) :
--                   Commune 400 · Peu commune 500 · Rare 2 400
--
--  ------------------------------------------------------------------
--  POURQUOI DES FRAGMENTS, ET PLUS D'ECLATS
--
--  Recycler contre des Eclats posait un probleme sans solution : un joueur
--  regulier produit ~6 300 Eclats de doublons par semaine une fois sa
--  collection avancee. Plafonne, le recyclage ne permettait pas de se
--  debarrasser de ses cartes ; deplafonne, il triplait les Eclats, et les
--  Eclats achetent des boosters — la boucle s'emballait.
--
--  Les Fragments n'achetent qu'une chose : une carte qu'on n'a pas. Ils ne
--  rachetent pas de boosters, il n'y a donc plus de boucle, et plus de
--  plafond. Ils transforment aussi la fin de collection : la derniere
--  Legendaire mettait ~42 jours a sortir en moyenne, sans le moindre progres
--  visible ; chaque booster rempli de doublons la rapproche desormais.
--
--  Simulation (six boosters par jour, tous les doublons recycles), mediane
--  du temps pour finir l'extension :
--                               sans fabrication   avec   (quart le plus lent)
--      joueur a  60 boosters ....   112 jours      72 j      147 -> 86 j
--      joueur a 120 boosters ....    92 jours      62 j      124 -> 73 j
--  ~2 200 Fragments par semaine pour un joueur regulier : une Epique tous
--  les six jours, ou une Legendaire en un peu moins de quatre semaines.
-- =====================================================================

-- Le journal : qui a recycle quoi, et quand. Il sert a retrouver ce qui
-- s'est passe si quelqu'un ecrit « j'ai perdu une carte ». `eclats` date de
-- l'ancien recyclage ; les recyclages d'aujourd'hui y mettent 0 et remplissent
-- `fragments`.
create table if not exists public.recyclages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  card_id    text not null references public.cards on delete cascade,
  qty        integer not null check (qty > 0),
  eclats     integer not null check (eclats >= 0),
  created_at timestamptz not null default now()
);
alter table public.recyclages add column if not exists fragments integer not null default 0;
create index if not exists recyclages_user_idx on public.recyclages (user_id, created_at desc);

alter table public.recyclages enable row level security;
-- Aucune policy : le navigateur ne lit pas le journal.
revoke all on public.recyclages from anon, authenticated;

-- Le lundi minuit, heure de Paris : la meme frontiere que les quetes
-- hebdomadaires (period_key dans 01_schema.sql).
create or replace function public.debut_semaine() returns timestamptz
language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

-- Les Eclats touches cette semaine avec l'ancien recyclage. Plus rien ne
-- l'appelle ; elle reste pour qui voudrait relire le journal.
create or replace function public.recyclage_semaine(p uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(eclats), 0)::int from recyclages
   where user_id = p and created_at >= debut_semaine();
$$;

revoke all on function public.recyclage_semaine from public, anon, authenticated;

-- ------------------------------------------------------------- recycler
-- `p_lots` : [{ "carte": "c012", "n": 2 }, …]. Tout passe, ou rien : un seul
-- lot refuse annule l'ensemble.
--
-- Ce qui est recyclable, carte par carte : ce qu'on possede, moins l'exemplaire
-- qu'on garde toujours, moins ceux qu'on a proposes dans une demande
-- d'echange encore en attente — sinon l'echange, une fois accepte, prendrait
-- le dernier exemplaire et ferait reculer la collection.
create or replace function public.recycler(p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); lot jsonb; cid text; n int; k cards;
  possede int; reserve int; prix int; total int := 0; nb int := 0; vus text[] := '{}'; garde int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_lots is null or jsonb_typeof(p_lots) <> 'array' or jsonb_array_length(p_lots) = 0 then
    raise exception 'Rien à recycler.';
  end if;
  if jsonb_array_length(p_lots) > 150 then raise exception 'Trop de cartes d''un coup.'; end if;

  -- Un recyclage a la fois par joueur : deux envois partis ensemble ne
  -- doivent pas compter deux fois le meme exemplaire.
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
    if k.promo and not k.reverse then raise exception 'Cette carte ne se recycle pas.'; end if;
    -- Les Reverses (version 2.0) se recyclent et se fabriquent ensemble, a
    -- partir de la date d'ouverture (reverses_ouvertes, 22c_reverses.sql).
    -- Une Reverse rapporte comme sa classique.
    if k.reverse and not reverses_ouvertes() then
      raise exception 'Les Reverses ne se recyclent pas encore.';
    end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    -- Version 2.1 : ce que le joueur a choisi de garder (garde_de,
    -- 22_garder.sql), un exemplaire au moins.
    garde := garde_de(p, cid);
    if coalesce(possede, 0) - garde - reserve < n then
      if garde > 1 then
        raise exception 'Tu as choisi de garder % exemplaires de « % ».', garde, k.nom;
      end if;
      raise exception 'Pas assez de doublons de « % » : tu gardes toujours un exemplaire.', k.nom;
    end if;

    update collection set qty = qty - n where user_id = p and card_id = cid;
    insert into recyclages (user_id, card_id, qty, eclats, fragments) values (p, cid, n, 0, n * prix);
    total := total + n * prix;
    nb := nb + n;
  end loop;

  update profiles set fragments = fragments + total where id = p;
  -- La quete quotidienne « Petit menage » (04_seed.sql) compte les cartes.
  perform bump_quests(p, 'recycle', nb);
  return me();
end $$;

-- ------------------------------------------------------------- fabriquer
-- Une carte de l'extension qu'on ne possede pas, contre des Fragments.
-- Seulement une carte qui manque : fabriquer un doublon pour le recycler ne
-- rapporterait rien, mais fabriquer une Legendaire qu'on a deja ne sert a
-- rien non plus, et c'est ce qui garde les doublons de haute rarete rares.
create or replace function public.fabriquer(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; cout int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo and not k.reverse then raise exception 'Cette carte ne se fabrique pas.'; end if;
  cout := cfg('fabrication_' || k.rar);
  -- Les Reverses (version 2.0) : fermees au lancement, sinon les Fragments
  -- accumules rempliraient la collection Reverse d'un coup ; ouvertes a la
  -- sortie de la 2.5, au prix de leur vraie rarete (version 2.5 :
  -- reverses_ouvertes et prix_reverse, 22c_reverses.sql).
  if k.reverse then
    if not reverses_ouvertes() then
      raise exception 'La fabrication des Reverses n''est pas encore ouverte.';
    end if;
    cout := prix_reverse(k.rar);
  end if;
  if cout is null then raise exception 'Cette carte ne se fabrique pas.'; end if;

  select fragments into reste from profiles where id = p for update;
  if exists (select 1 from collection where user_id = p and card_id = p_carte and qty > 0) then
    raise exception 'Tu possèdes déjà cette carte.';
  end if;
  if reste < cout then raise exception 'Pas assez de Fragments.'; end if;

  update profiles set fragments = fragments - cout, fabrications = fabrications + 1 where id = p;
  insert into collection (user_id, card_id, qty) values (p, p_carte, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  -- Version 2.5 : la quete de L'Echauffement « Une Reverse fabriquee »
  -- (04_seed.sql).
  if k.reverse then perform bump_quests(p, 'fab_rev', 1); end if;
  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

revoke all on function public.recycler, public.fabriquer from public, anon;
grant execute on function public.recycler, public.fabriquer to authenticated;


-- =====================================================================
--  Mate TCG Online — version 2.0 « Reflets »
--  A executer apres 18_cadeaux.sql. Rejouable sans danger.
--
--  Ce que la 2.0 ajoute cote serveur, hors des fichiers qu'elle retouche
--  (les Reverses sont dans 03b_promos.sql, leur case de booster dans
--  03_rpc.sql) :
--    1. les parametres du jeu qu'un administrateur ouvre a la main ;
--    2. l'evenement « Reflets » : sa monnaie (les Prismes), son Pass de
--       recompenses, sa boutique et ses quetes (04_seed.sql) ;
--    3. Devine l'illu, l'illustration a deviner chaque jour (ses pixels sont
--       dans 21b_illu.sql) ;
--    4. les invitations, achetees en boutique ;
--    5. les titres et la personnalisation du profil.
-- =====================================================================

-- ============================================================ 1. reglages
-- Une seule ligne. `fabrication_reverse` : fermee au lancement de la 2.0 —
-- les Fragments deja accumules rempliraient la collection Reverse d'un coup.
-- L'ouvrir, plus tard, dans le SQL Editor :
--   update public.parametres set fabrication_reverse = true where id = 1;
create table if not exists public.parametres (
  id                  int primary key check (id = 1),
  fabrication_reverse boolean not null default false
);
-- Le sel de Devine l'illu : tire au hasard a l'installation, jamais montre.
-- Sans lui, l'ordre des illustrations se calculerait depuis le code public.
alter table public.parametres add column if not exists illu_sel text not null default md5(random()::text || clock_timestamp()::text);
insert into public.parametres (id) values (1) on conflict (id) do nothing;
alter table public.parametres enable row level security;
revoke all on public.parametres from anon, authenticated;

-- ===================================================== 2. l'evenement en cours
-- Le code de l'evenement en cours (15_evenements.sql), s'il en a un.
create or replace function public.evenement_en_cours() returns text
language sql stable security definer set search_path = public as $$
  select e.code from evenements e
   where e.code is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
$$;

-- ------------------------------------------------------------- les Prismes
-- La monnaie d'un evenement : `solde` se depense dans sa boutique, `total`
-- (tout ce qu'on a gagne) fait avancer sa piste de recompenses — acheter ne
-- fait jamais reculer la piste.
create table if not exists public.evt_comptes (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  solde     integer not null default 0 check (solde >= 0),
  total     integer not null default 0,
  primary key (user_id, evenement)
);
alter table public.evt_comptes enable row level security;
revoke all on public.evt_comptes from anon, authenticated;

create or replace function public.crediter_prismes(p uuid, ev text, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ev is null or coalesce(n, 0) <= 0 then return; end if;
  insert into evt_comptes (user_id, evenement, solde, total) values (p, ev, n, n)
  on conflict (user_id, evenement)
    do update set solde = evt_comptes.solde + n, total = evt_comptes.total + n;
end $$;

-- ------------------------------------------------------- le Pass de l'evenement
-- (`evt_piste` dans les tables : le Pass s'appelait la piste.)
create table if not exists public.evt_piste (
  evenement text not null,
  palier    integer not null,
  seuil     integer not null,
  -- boosters | eclats | fragments | titre | cadre | reverse_R | brillante
  type      text not null,
  montant   integer not null default 0,
  objet     text,
  titre     text not null,
  primary key (evenement, palier)
);
create table if not exists public.evt_piste_prises (
  user_id   uuid not null references public.profiles on delete cascade,
  evenement text not null,
  palier    integer not null,
  pris_le   timestamptz not null default now(),
  primary key (user_id, evenement, palier)
);
alter table public.evt_piste enable row level security;
alter table public.evt_piste_prises enable row level security;
revoke all on public.evt_piste, public.evt_piste_prises from anon, authenticated;

-- Vingt paliers. Le calcul (quetes de 04_seed.sql, recompenses de Devine
-- l'illu plus bas) :
--   - un joueur qui vient chaque jour gagne ~55 Prismes par jour (du jour :
--     10 + 15 + ~15 pour l'illu trouvee + ~20 de l'illu elle-meme + 15 x 62 %
--     pour la Reverse Rare, 6 boosters par jour), soit ~770 en 14 jours, et
--     ~330 avec les quetes de l'evenement : ~1 100. Il finit le Pass dans les
--     derniers jours ;
--   - un joueur regulier (10 jours sur 14) en gagne ~700 : palier 14 ;
--   - un joueur de passage (5 jours) ~320 : palier 7.
-- Les ecarts grandissent, pour que les premiers paliers tombent vite.
delete from public.evt_piste where evenement = 'reflets' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('reflets',  1,   15, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  2,   40, 'eclats',   150, null,          '150 Éclats'),
  ('reflets',  3,   70, 'titre',      0, 't_eclaireur', 'Titre « Éclaireur des Reflets »'),
  ('reflets',  4,  105, 'fragments', 250, null,         '250 Fragments'),
  ('reflets',  5,  145, 'boosters',   2, null,          '2 boosters'),
  ('reflets',  6,  190, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets',  7,  240, 'eclats',   300, null,          '300 Éclats'),
  ('reflets',  8,  295, 'boosters',   3, null,          '3 boosters'),
  ('reflets',  9,  355, 'fragments', 400, null,         '400 Fragments'),
  ('reflets', 10,  420, 'cadre',      0, 'f_miroir',    'Cadre « Miroir »'),
  ('reflets', 11,  490, 'eclats',   400, null,          '400 Éclats'),
  ('reflets', 12,  560, 'reverse_R',  1, null,          'Une Reverse Rare'),
  ('reflets', 13,  630, 'boosters',   3, null,          '3 boosters'),
  ('reflets', 14,  700, 'fragments', 600, null,         '600 Fragments'),
  ('reflets', 15,  770, 'brillante',  1, null,          'Une Essence Brillante'),
  ('reflets', 16,  840, 'eclats',   500, null,          '500 Éclats'),
  ('reflets', 17,  910, 'boosters',   4, null,          '4 boosters'),
  ('reflets', 18,  980, 'reverse_R',  2, null,          'Deux Reverses Rares'),
  ('reflets', 19, 1040, 'titre',      0, 't_ame',       'Titre « Âme des Reflets »'),
  ('reflets', 20, 1100, 'cadre',      0, 'f_nebuleuse', 'Cadre « Nébuleuse »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ----------------------------------------------------------- accorder
-- Ce qu'une recompense donne, quelle qu'en soit la source (Pass, boutique
-- d'evenement). Renvoie les cartes accordees, pour que le navigateur les
-- montre.
--   reverse_R : une Reverse Rare qu'on n'a pas (une au hasard si on les a
--               toutes) ; brillante : une Essence Brillante qu'on n'a pas
--               (2 000 Fragments si on les a toutes).
create or replace function public.accorder(p uuid, t text, n int, objet text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cartes text[] := '{}'; cid text; i int;
begin
  if t = 'boosters' then
    update profiles set boosters_bonus = boosters_bonus + n where id = p;
  elsif t = 'eclats' then
    update profiles set shards = shards + n where id = p;
  elsif t = 'fragments' then
    update profiles set fragments = fragments + n where id = p;
  elsif t in ('titre', 'cadre') then
    insert into inventory (user_id, item_id, qty) values (p, objet, 1)
      on conflict (user_id, item_id) do nothing;
  elsif t = 'reverse_R' then
    for i in 1..greatest(n, 1) loop
      select k.id into cid from cards k
       where k.reverse and k.rar = 'R' and k.id <> all (cartes)
         and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
       order by random() limit 1;
      if cid is null then
        select k.id into cid from cards k where k.reverse and k.rar = 'R' order by random() limit 1;
      end if;
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end loop;
  elsif t = 'brillante' then
    select k.id into cid from cards k
     where k.rar = 'BR'
       and not exists (select 1 from collection c where c.user_id = p and c.card_id = k.id and c.qty > 0)
     order by random() limit 1;
    if cid is null then
      update profiles set fragments = fragments + 2000 where id = p;
    else
      insert into collection (user_id, card_id, qty) values (p, cid, 1)
        on conflict (user_id, card_id) do update set qty = collection.qty + 1;
      cartes := cartes || cid;
    end if;
  else
    raise exception 'Récompense inconnue.';
  end if;
  if array_length(cartes, 1) is not null then
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;
  return to_jsonb(cartes);
end $$;

-- ----------------------------------------------- reclamer un palier du Pass
create or replace function public.piste_reclamer(p_palier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); pa evt_piste; tot int; cartes jsonb;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then raise exception 'Aucun événement en cours.'; end if;
  select * into pa from evt_piste where evenement = ev and palier = p_palier;
  if not found then raise exception 'Palier inconnu.'; end if;
  select total into tot from evt_comptes where user_id = p and evenement = ev for update;
  if coalesce(tot, 0) < pa.seuil then raise exception 'Palier pas encore atteint.'; end if;

  insert into evt_piste_prises (user_id, evenement, palier) values (p, ev, p_palier)
    on conflict do nothing;
  if not found then raise exception 'Récompense déjà récupérée.'; end if;

  cartes := accorder(p, pa.type, pa.montant, pa.objet);
  return jsonb_build_object('cartes', cartes, 'etat', me());
end $$;

-- ----------------------------------------------- l'etat de l'evenement
-- Pour l'onglet de l'evenement : son solde, son Pass, et les dix joueurs qui
-- ont gagne le plus de Prismes.
create or replace function public.evenement_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); ev text := evenement_en_cours(); cpt evt_comptes;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if ev is null then return 'null'::jsonb; end if;
  -- Ouvrir l'onglet de l'evenement accomplit sa quete du jour « Passe voir
  -- l'evenement ». Pas la connexion du jour (`checkin`) : elle a souvent eu
  -- lieu avant l'ouverture de l'evenement, et la quete serait restee vide.
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), 1 from quests q where q.metric = 'ev_visite'
  on conflict (user_id, quest_id, period_key) do nothing;
  select * into cpt from evt_comptes where user_id = p and evenement = ev;

  return jsonb_build_object(
    'code', ev,
    'solde', coalesce(cpt.solde, 0),
    'total', coalesce(cpt.total, 0),
    'piste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palier', pa.palier, 'seuil', pa.seuil, 'type', pa.type, 'montant', pa.montant,
               'objet', pa.objet, 'titre', pa.titre,
               'pris', exists (select 1 from evt_piste_prises x
                                where x.user_id = p and x.evenement = ev and x.palier = pa.palier))
             order by pa.palier)
        from evt_piste pa where pa.evenement = ev), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = ev and total > 0
               order by total desc limit 10) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb));
end $$;

-- --------------------------------------------- apres l'evenement : le recap
-- Pendant trois jours apres la fin d'un evenement, son onglet devient un
-- recap : ce que le joueur y a fait, le podium, et la suite. me() en porte
-- l'annonce (le code, les dates) ; evenement_recap() donne le detail.
create or replace function public.evenement_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                            'jusqua', e.fin + interval '3 days')
    from evenements e
   where e.code is not null and now() >= e.fin and now() < e.fin + interval '3 days'
     and evenement_en_cours() is null
   order by e.fin desc limit 1;
$$;

create or replace function public.evenement_recap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); e evenements; cpt evt_comptes; rang int; nb int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into e from evenements
   where code is not null and now() >= fin and now() < fin + interval '3 days'
   order by fin desc limit 1;
  if not found then return 'null'::jsonb; end if;
  select * into cpt from evt_comptes where user_id = p and evenement = e.code;
  select count(*) + 1 into rang from evt_comptes
   where evenement = e.code and total > coalesce(cpt.total, 0);
  select count(*) into nb from evt_comptes where evenement = e.code and total > 0;
  return jsonb_build_object(
    'code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
    'jusqua', e.fin + interval '3 days',
    'total', coalesce(cpt.total, 0),
    'paliers', (select count(*) from evt_piste pa where pa.evenement = e.code and pa.seuil <= coalesce(cpt.total, 0)),
    'paliers_max', (select count(*) from evt_piste pa where pa.evenement = e.code),
    'pris', (select count(*) from evt_piste_prises x where x.user_id = p and x.evenement = e.code),
    'illus', (select count(*) from devine_illu d where d.user_id = p and d.trouve
               and d.jour between (e.debut at time zone 'Europe/Paris')::date and (e.fin at time zone 'Europe/Paris')::date),
    'reverses', (select count(*) from collection c join cards k on k.id = c.card_id
                  where c.user_id = p and c.qty > 0 and k.reverse),
    'reverses_max', (select count(*) from cards where reverse),
    'quetes', (select count(*) from quest_progress qp join quests q on q.id = qp.quest_id
                where qp.user_id = p and qp.claimed and q.evenement = e.code),
    'rang', case when coalesce(cpt.total, 0) > 0 then rang end,
    'joueurs', nb,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = e.code and total > 0
               order by total desc limit 3) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb));
end $$;

-- ========================================================= 3. Devine l'illu
-- Une illustration a deviner par jour, la meme pour tout le monde : celle
-- d'une carte de l'extension, Essences exceptees. Elle arrive pixelisee, et
-- chaque essai rate la rend plus nette : 9 x 6 pixels, puis 12 x 8, 18 x 12
-- et 36 x 24. Quatre essais. Plus on trouve tot, plus ca rapporte : des
-- Eclats toujours, et des Prismes pendant l'evenement Reflets.
--
-- Le serveur garde les grilles (illu_pixels, remplie par 21b_illu.sql) et
-- n'envoie que celle du moment : le navigateur ne connait la carte qu'une
-- fois la partie finie. Le jeu est ne avec l'evenement Reflets et lui
-- survit : il a ensuite son propre onglet.
create table if not exists public.illu_pixels (
  card_id text primary key references public.cards on delete cascade,
  data    bytea not null          -- 36 x 24 pixels, 12 bits chacun
);
create table if not exists public.devine_illu (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  essais  text[] not null default '{}',
  trouve  boolean not null default false,
  primary key (user_id, jour)
);
alter table public.illu_pixels enable row level security;
alter table public.devine_illu enable row level security;
revoke all on public.illu_pixels, public.devine_illu from anon, authenticated;

create or replace function public.illu_jour() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date; $$;

-- L'illustration du jour, la meme pour tous. Les cartes sont rangees une
-- fois pour toutes dans un ordre secret (md5 du sel de `parametres`), et
-- chaque jour prend la suivante : aucune ne revient avant d'avoir vu passer
-- toutes les autres (113 jours). Rien a lancer chaque jour : la date suffit.
create or replace function public.illu_cible(j date) returns text
language sql stable security definer set search_path = public as $$
  with l as (
    select k.id, row_number() over (order by md5((select illu_sel from parametres where id = 1) || ':' || k.id)) - 1 as rang
      from cards k join illu_pixels x on x.card_id = k.id
     where not k.promo and k.cat <> 'essence')
  select id from l
   where rang = ((j - date '2026-01-01') % (select count(*) from l) + (select count(*) from l)) % (select count(*) from l);
$$;

-- Ce que rapporte l'illu trouvee au n-ieme essai.
create or replace function public.illu_gain(n int) returns jsonb
language sql immutable as $$
  select case n when 1 then '{"prismes":25,"eclats":120}'::jsonb
                when 2 then '{"prismes":18,"eclats":90}'::jsonb
                when 3 then '{"prismes":12,"eclats":60}'::jsonb
                else        '{"prismes":6,"eclats":30}'::jsonb end;
$$;

-- La grille du niveau 1 a 4 : la grille fine, moyennee par blocs de 4, 3, 2
-- ou 1 pixels de cote. En RGB, 3 octets par pixel, en base64.
create or replace function public.illu_grille(cid text, niveau int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  src bytea; f int := case niveau when 1 then 4 when 2 then 3 when 3 then 2 else 1 end;
  w int := 36 / f; h int := 24 / f; o bytea; x int; y int; dx int; dy int; k int; i int; n int;
  s int[];
begin
  select data into src from illu_pixels where card_id = cid;
  if src is null then return null; end if;
  o := decode(repeat('00', w * h * 3), 'hex');
  for y in 0 .. h - 1 loop
    for x in 0 .. w - 1 loop
      s := array[0, 0, 0];
      for dy in 0 .. f - 1 loop
        for dx in 0 .. f - 1 loop
          i := (y * f + dy) * 36 + x * f + dx;
          for k in 0 .. 2 loop
            n := i * 3 + k;
            s[k + 1] := s[k + 1] + 17 * (case when n % 2 = 0 then get_byte(src, n / 2) >> 4
                                               else get_byte(src, n / 2) & 15 end);
          end loop;
        end loop;
      end loop;
      for k in 0 .. 2 loop
        o := set_byte(o, (y * w + x) * 3 + k, round(s[k + 1]::numeric / (f * f))::int);
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('w', w, 'h', h, 'data', encode(o, 'base64'));
end $$;

create or replace function public.illu_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; fini boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  cible := illu_cible(j);
  if cible is null then return 'null'::jsonb; end if;
  select * into d from devine_illu where user_id = p and jour = j;
  n := coalesce(array_length(d.essais, 1), 0);
  fini := coalesce(d.trouve, false) or n >= 4;
  return jsonb_build_object(
    'jour', j, 'max', 4,
    'essais', to_jsonb(coalesce(d.essais, '{}')),
    'trouve', coalesce(d.trouve, false),
    'fini', fini,
    'niveau', case when fini then 4 else n + 1 end,
    'grille', case when fini then null else illu_grille(cible, n + 1) end,
    'cible', case when fini then cible end,
    'gain', case when d.trouve then illu_gain(n) end,
    'gains', jsonb_build_array(illu_gain(1), illu_gain(2), illu_gain(3), illu_gain(4)),
    -- Les Prismes ne se gagnent que pendant l'evenement.
    'prismes', evenement_en_cours() is not distinct from 'reflets');
end $$;

-- Trouver rapporte des Prismes et des Eclats selon l'essai (illu_gain), et
-- fait avancer les quetes « illu ».
create or replace function public.illu_essai(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); j date := illu_jour(); d devine_illu; cible text; n int; g jsonb; ok boolean;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  cible := illu_cible(j);
  if not exists (select 1 from cards where id = p_carte and not promo and cat <> 'essence') then
    raise exception 'Cette carte ne fait pas partie du jeu.';
  end if;

  insert into devine_illu (user_id, jour) values (p, j) on conflict do nothing;
  select * into d from devine_illu where user_id = p and jour = j for update;
  n := coalesce(array_length(d.essais, 1), 0);
  if d.trouve or n >= 4 then raise exception 'La partie du jour est finie : rendez-vous demain.'; end if;
  if p_carte = any (d.essais) then raise exception 'Tu as déjà proposé cette carte.'; end if;

  ok := p_carte = cible;
  update devine_illu set essais = essais || p_carte, trouve = ok where user_id = p and jour = j;
  if ok then
    g := illu_gain(n + 1);
    update profiles set shards = shards + (g->>'eclats')::int where id = p;
    if evenement_en_cours() = 'reflets' then
      perform crediter_prismes(p, 'reflets', (g->>'prismes')::int);
    end if;
    perform bump_quests(p, 'illu', 1);
  end if;
  return jsonb_build_object('illu', illu_etat(), 'etat', me());
end $$;

-- ------------------------------------------------ les doublons de mes amis
-- Pour l'onglet Echanges : chaque carte qui me manque et qu'un ami a en
-- double (donc qu'il peut ceder), avec ces amis-la, le plus fourni en tete.
-- Seulement des cartes echangeables : ni Essences ni Promos (les Reverses
-- le sont).
create or replace function public.amis_doublons() returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid();
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return coalesce((
    select jsonb_agg(jsonb_build_object('carte', x.id, 'amis', x.amis) order by x.n desc, x.id)
      from (select k.id, count(*) as n,
                   jsonb_agg(jsonb_build_object('pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
                                                'photo', photo_discord(o.id), 'n', c.qty)
                             order by c.qty desc, lower(o.pseudo)) as amis
              from friendships f
              join profiles o on o.id = case when f.a = moi then f.b else f.a end
              -- Version 2.1 : au-dela de ce qu'il garde (garde_de, 22_garder.sql).
              join collection c on c.user_id = o.id and c.qty > garde_de(o.id, c.card_id)
              join cards k on k.id = c.card_id
             where (f.a = moi or f.b = moi) and f.accepte
               and k.cat <> 'essence' and (not k.promo or k.reverse)
               and not exists (select 1 from collection m where m.user_id = moi and m.card_id = k.id and m.qty > 0)
             group by k.id) x), '[]'::jsonb);
end $$;

-- =========================================================== 4. invitations
-- Achetees en boutique (2 000 Eclats, trois par joueur, shop_buy dans
-- 03_rpc.sql). Un code sert une fois : la personne invitee se connecte avec
-- Discord, le saisit sur l'ecran d'attente, et entre sur la liste des
-- invites. Elle trouve un cadeau de bienvenue de la part de son parrain :
-- 10 boosters hors reserve (en plus des 5 de depart) et 1 000 Eclats.
create table if not exists public.invitations (
  code        text primary key,
  auteur      uuid not null references public.profiles on delete cascade,
  cree_le     timestamptz not null default now(),
  utilise_par uuid references public.profiles on delete set null,
  utilise_le  timestamptz
);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;

-- Un filleul : un compte entre grace au code d'un autre. Il ne peut pas
-- inviter a son tour (version 2.1) : sinon chaque invite ouvre la porte a
-- d'autres, et la liste d'acces ne veut plus rien dire.
create or replace function public.est_filleul(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invitations where utilise_par = p)
$$;

create or replace function public.creer_invitation(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if est_filleul(p) then raise exception 'Les joueurs invités ne peuvent pas inviter à leur tour.'; end if;
  loop
    c := 'M8-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from invitations where code = c);
  end loop;
  insert into invitations (code, auteur) values (c, p);
  return c;
end $$;

-- La seule fonction du jeu qu'un compte pas encore invite peut appeler, avec
-- me() : c'est elle qui le fait entrer.
create or replace function public.utiliser_invitation(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); inv invitations; u auth.users; parrain text;
begin
  if p is null then raise exception 'non connecte'; end if;
  if beta_ouverte() or est_invite(p) then raise exception 'Tu as déjà accès au jeu.'; end if;

  select * into inv from invitations
   where upper(code) = upper(trim(coalesce(p_code, ''))) and utilise_par is null for update;
  if not found then raise exception 'Code inconnu ou déjà utilisé.'; end if;
  if inv.auteur = p then raise exception 'Ce code est le tien : donne-le à un ami.'; end if;

  select * into u from auth.users where id = p;
  select pseudo into parrain from profiles where id = inv.auteur;
  insert into beta_invites (cle, note)
  values (coalesce(nullif(u.raw_user_meta_data->>'provider_id', ''), lower(u.email)),
          'Invité par ' || coalesce(parrain, '?') || ' (' || inv.code || ')')
  on conflict (cle) do nothing;

  update invitations set utilise_par = p, utilise_le = now() where code = inv.code;
  perform bump_quests(inv.auteur, 'invite', 1);
  insert into cadeaux (user_id, boosters, eclats, message, auteur)
  values (p, 10, 1000, 'Bienvenue ! ' || coalesce(parrain, 'Un joueur') || ' t''a invité : voici de quoi bien commencer.', inv.auteur);
  return me();
end $$;

-- Version 2.1 : les codes qu'un filleul avait achetes avant la regle, et
-- qui n'ont pas servi, sont annules et rembourses (prix de l'article, et
-- une place de plus dans sa limite d'achat). Rejouable : une fois annules,
-- il n'en reste plus a rembourser. Les codes deja utilises restent : on ne
-- reprend pas l'acces a quelqu'un qui est entre.
with revoques as (
  delete from public.invitations i
   where i.utilise_par is null
     and exists (select 1 from public.invitations f where f.utilise_par = i.auteur)
  returning i.auteur
), parjoueur as (
  select auteur, count(*)::int as n from revoques group by auteur
), rembourse as (
  update public.profiles pr
     set shards = pr.shards + j.n * coalesce((select prix from public.shop_items where id = 's_invite'), 2000)
    from parjoueur j where pr.id = j.auteur
  returning pr.id
)
update public.inventory iv
   set qty = greatest(0, iv.qty - j.n)
  from parjoueur j
 where iv.user_id = j.auteur and iv.item_id = 's_invite';

-- ===================================================== 5. titres et profil
-- Les titres qu'un joueur a debloques. La plupart viennent de ses succes
-- (15_evenements.sql), calcules a la volee comme eux ; les autres sont des
-- objets gagnes (inventaire, `t_…`) : Pass d'evenement, boutique, quetes.
-- Les noms vivent dans TITRES (js/config.js).
create or replace function public.titres_de(p uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := succes_de(p); t text[] := '{}';
begin
  if s ? 'pionnier'          then t := array_append(t, 't_pionnier'); end if;
  if s ? 'unique'            then t := array_append(t, 't_elu'); end if;
  if s ? 'master_set'        then t := array_append(t, 't_maitre'); end if;
  if s ? 'negociant'         then t := array_append(t, 't_negociant'); end if;
  if s ? 'godpack'           then t := array_append(t, 't_chanceux'); end if;
  if s ? 'boosters_100'      then t := array_append(t, 't_centurion'); end if;
  if s ? 'serie_30'          then t := array_append(t, 't_fidele'); end if;
  if s ? 'artisan'           then t := array_append(t, 't_artisan'); end if;
  if s ? 'toutes_brillantes' then t := array_append(t, 't_prisme'); end if;
  if s ? 'reverses_toutes'   then t := array_append(t, 't_reflet'); end if;
  if exists (select 1 from profiles where id = p and is_admin) then t := array_append(t, 't_admin'); end if;
  select t || coalesce(array_agg(item_id order by item_id), '{}') into t
    from inventory where user_id = p and qty > 0 and item_id like 't\_%';
  return t;
end $$;

-- Changer son titre, sa banniere ou sa devise. Un parametre vide ('') retire,
-- un parametre absent (null) ne touche a rien.
create or replace function public.personnaliser(p_titre text, p_banniere text, p_devise text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); d text;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_titre is not null then
    if p_titre <> '' and not (p_titre = any (titres_de(p))) then
      raise exception 'Ce titre n''est pas encore débloqué.';
    end if;
    update profiles set titre = nullif(p_titre, '') where id = p;
    if p_titre <> '' then perform bump_quests(p, 'titre', 1); end if;
  end if;

  if p_banniere is not null then
    if p_banniere <> '' and not exists (select 1 from collection
                                         where user_id = p and card_id = p_banniere and qty > 0) then
      raise exception 'Tu ne possèdes pas cette carte.';
    end if;
    update profiles set banniere = nullif(p_banniere, '') where id = p;
    if p_banniere <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  if p_devise is not null then
    d := left(regexp_replace(trim(p_devise), '\s+', ' ', 'g'), 80);
    update profiles set devise = nullif(d, '') where id = p;
    if d <> '' then perform bump_quests(p, 'perso', 1); end if;
  end if;

  return me();
end $$;

-- ================================================ l'evenement « Reflets »
-- Deux semaines a partir de la mise a jour, sans rien changer au rythme des
-- boosters. Le redater, dans le SQL Editor :
--   update public.evenements set debut = …, fin = … where code = 'reflets';
insert into public.evenements (titre, texte, debut, fin, ticket_minutes, code)
select 'Reflets', 'La version 2.0 : les Reverses, des cadres, des titres, Devine l''illu. Gagne des Prismes et remonte le Pass.',
       now(), now() + interval '14 days', null, 'reflets'
 where not exists (select 1 from public.evenements where code = 'reflets');

-- ================================================================= droits
revoke all on function public.evenement_en_cours, public.crediter_prismes, public.accorder,
  public.illu_cible, public.illu_grille, public.creer_invitation, public.est_filleul, public.titres_de
  from public, anon, authenticated;
revoke all on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser, public.evenement_recap,
  public.evenement_recent, public.amis_doublons from public, anon;
grant execute on function public.piste_reclamer, public.evenement_etat, public.illu_etat,
  public.illu_essai, public.utiliser_invitation, public.personnaliser, public.evenement_recap,
  public.amis_doublons to authenticated;


-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement, un mini-evenement
--  A executer apres 22_garder.sql. Rejouable sans danger.
--
--  Sept defis, un par jour, juste apres l'evenement Reflets. Chaque defi
--  oppose une equipe de trois Joueurs de sa collection a un adversaire du
--  jour, avec une regle du jour. Le combat se deroule tout seul, a partir
--  des valeurs imprimees sur les cartes (Defense, cout et degats des
--  attaques) : le joueur ne fait que des choix — qui, dans quel ordre, avec
--  quelle attaque. C'est un avant-gout, sans rien dire de ce qui vient.
--
--  LES REGLES (ech_simuler ; la meme chose dans _demo/serveur.js)
--    · les trois Joueurs combattent ensemble ; celui de devant (le premier
--      encore debout) encaisse les coups de l'adversaire ;
--    · a chaque tour, chacun gagne 1 elan ; il frappe des que son elan
--      atteint le cout de son attaque (les Essences dessinees sur la carte),
--      et le depense ; l'adversaire fait de meme, apres eux ;
--    · deux Joueurs de la meme couleur partent avec 1 elan d'avance ;
--    · la Defense d'un Joueur est sa resistance : a 0, il est KO ;
--    · victoire si l'adversaire tombe avant la fin du 10e tour ;
--    · LE COUP D'ECLAT, le seul geste pendant le combat : une fois par
--      combat, on touche un Joueur qui va frapper ce tour-ci, et son coup
--      compte double (avant la Carapace : c'est ce qui permet de la percer).
--  Etoiles : 1 pour la victoire, 2 en perdant au plus un Joueur, 3 sans
--  en perdre aucun. La meilleure note compte.
--
--  LES ESSAIS : trois par defi et par jour de Paris, compte au depart
--  (ech_commencer) comme l'Epreuve du jour de la 3.0 ; un essai abandonne est
--  perdu. Les defis des jours passes restent jouables (meme plafond) : sans
--  rattrapage, un jour manque ferait perdre pour de bon son indice. Le combat
--  se joue dans le navigateur (le coup d'eclat se decide en direct), puis
--  ech_terminer le rejoue ici avec le meme geste : c'est ce resultat-la qui
--  compte.
--
--  RECOMPENSES : 80, 80 puis 140 Eclats pour les etoiles 1, 2 et 3 de chaque
--  defi (300 par defi, 2 100 en tout), et 15, 15 puis 25 Braises (55 par
--  defi, 385 en tout : la monnaie de l'evenement, 22e_echauffement-
--  evenement.sql) ; 3 boosters quand les sept defis sont gagnes ; le titre
--  « Echauffe » pour les 21 etoiles.
--
--  LES INDICES : trois etoiles au defi n debloquent l'indice n — une phrase
--  sur ce qui vient, sans rien montrer. Leur texte n'est que dans la base
--  (ech_indices) : le navigateur ne le recoit qu'une fois l'indice gagne.
--
--  LE CALENDRIER : la saison commence a la fin du recap de Reflets. Les
--  dates exactes de 2026 sont posees par calendrier-2.5.sql (a jouer une
--  fois, apres ce fichier).
--
--  L'EQUILIBRAGE (simulation sur les 51 Joueurs, toutes les equipes, et
--  chaque coup d'eclat possible) : chaque defi a une equipe a trois etoiles,
--  qui demande le coup d'eclat au bon moment les jours 3 et 7 ; une equipe au
--  hasard, meme avec le meilleur coup d'eclat, ne fait trois etoiles qu'une
--  fois sur trente a cent ; une collection aux deux tiers trouve presque
--  toujours ses trois etoiles, une collection au tiers deux ou trois.
--
--  Sa saison (ech_saison) commence a la fin du recap de Reflets. Depuis le
--  24 octobre 2026, L'Echauffement est aussi un evenement au sens de la table
--  `evenements` (code 'echauffement', 22e_echauffement-evenement.sql), calee
--  sur la saison : sa monnaie, ses quetes, son Pass, sa boutique, son
--  classement et son recap. Il vit dans l'onglet Combats ; apres la saison,
--  le mode sans fin y prend sa place (22f_sans-fin.sql).
--
--  Les noms commencent tous par `ech_` : la version 3.0 a deja ses `defis`.
-- =====================================================================

-- ------------------------------------------------ la fin du recap, reglable
-- Jusqu'ici, le recap d'un evenement durait trois jours apres sa fin, en dur
-- (21_reflets.sql). `recap_jusqua` permet de le fixer ; vide, rien ne change.
-- Les deux fonctions sont redefinies ici, a l'identique sauf cette date.
alter table public.evenements add column if not exists recap_jusqua timestamptz;

create or replace function public.evenement_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                            'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
    from evenements e
   where e.code is not null and now() >= e.fin and now() < coalesce(e.recap_jusqua, e.fin + interval '3 days')
     and evenement_en_cours() is null
   order by e.fin desc limit 1;
$$;

create or replace function public.evenement_recap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); e evenements; cpt evt_comptes; rang int; nb int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into e from evenements
   where code is not null and now() >= fin and now() < coalesce(recap_jusqua, fin + interval '3 days')
   order by fin desc limit 1;
  if not found then return 'null'::jsonb; end if;
  select * into cpt from evt_comptes where user_id = p and evenement = e.code;
  select count(*) + 1 into rang from evt_comptes
   where evenement = e.code and total > coalesce(cpt.total, 0);
  select count(*) into nb from evt_comptes where evenement = e.code and total > 0;
  return jsonb_build_object(
    'code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
    'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'),
    'total', coalesce(cpt.total, 0),
    'paliers', (select count(*) from evt_piste pa where pa.evenement = e.code and pa.seuil <= coalesce(cpt.total, 0)),
    'paliers_max', (select count(*) from evt_piste pa where pa.evenement = e.code),
    'pris', (select count(*) from evt_piste_prises x where x.user_id = p and x.evenement = e.code),
    'illus', (select count(*) from devine_illu d where d.user_id = p and d.trouve
               and d.jour between (e.debut at time zone 'Europe/Paris')::date and (e.fin at time zone 'Europe/Paris')::date),
    'reverses', (select count(*) from collection c join cards k on k.id = c.card_id
                  where c.user_id = p and c.qty > 0 and k.reverse),
    'reverses_max', (select count(*) from cards where reverse),
    'quetes', (select count(*) from quest_progress qp join quests q on q.id = qp.quest_id
                where qp.user_id = p and qp.claimed and q.evenement = e.code),
    'rang', case when coalesce(cpt.total, 0) > 0 then rang end,
    'joueurs', nb,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = e.code and total > 0
               order by total desc limit 3) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb))
    -- L'Echauffement (22e_echauffement-evenement.sql) : ses defis, en plus.
    || case when e.code = 'echauffement' then jsonb_build_object(
         'etoiles', coalesce((select sum(etoiles) from ech_scores where user_id = p), 0),
         'gagnes', (select count(*) from ech_scores where user_id = p and etoiles > 0),
         'parfaits', (select count(*) from ech_scores where user_id = p and etoiles = 3),
         'defis', (select count(*) from ech_defis),
         'combats', (select count(*) from ech_essais where user_id = p and fini))
       else '{}'::jsonb end;
end $$;

-- La saison : une seule ligne. Elle commence a la fin du recap de Reflets
-- (ou tout de suite s'il est deja fini) et dure neuf jours : un defi de plus
-- chaque jour pendant sept jours, puis deux jours pour rattraper.
--   Avancer ou reculer :  update public.ech_saison set debut = ..., fin = ... where id = 1;
--   (la ligne de l'evenement suit : 22e_echauffement-evenement.sql ; le Labo
--   le fait aussi, 22d_admin.sql.)
create table if not exists public.ech_saison (
  id    integer primary key default 1 check (id = 1),
  debut timestamptz not null,
  fin   timestamptz not null check (fin > debut)
);
insert into public.ech_saison (id, debut, fin)
select 1, d, d + interval '9 days'
  from (select greatest(now(), coalesce((select max(coalesce(recap_jusqua, fin + interval '3 days'))
                                           from public.evenements where code = 'reflets'), now())) as d) x
on conflict (id) do nothing;

-- Les Joueurs et leurs valeurs imprimees (genere depuis js/cards-data.js).
-- Les attaques sans degats (un effet seulement) n'y sont pas.
create table if not exists public.ech_joueurs (
  card_id  text primary key references public.cards on delete cascade,
  def      integer not null,
  couleur  text not null,
  attaques jsonb not null
);
insert into public.ech_joueurs (card_id, def, couleur, attaques) values
  ('c010', 130, 'rose', '[{"nom":"Roi du Silence","cout":1,"degats":50}]'),
  ('c011', 90, 'rose', '[{"nom":"S-Privilège","cout":1,"degats":90}]'),
  ('c012', 110, 'rose', '[{"nom":"Trash-talk","cout":2,"degats":110}]'),
  ('c013', 70, 'rose', '[{"nom":"Confusion","cout":1,"degats":60}]'),
  ('c017', 90, 'rose', '[{"nom":"Premier Souffle","cout":1,"degats":90}]'),
  ('c022', 90, 'rose', '[{"nom":"Rotation","cout":2,"degats":160}]'),
  ('c023', 120, 'rose', '[{"nom":"Clutch","cout":2,"degats":126},{"nom":"World Record","cout":3,"degats":180}]'),
  ('c024', 120, 'rose', '[{"nom":"Coup de fil","cout":2,"degats":100}]'),
  ('c025', 120, 'rose', '[{"nom":"Locked In","cout":2,"degats":130}]'),
  ('c029', 120, 'orange', '[{"nom":"Demon''s Domain","cout":2,"degats":80}]'),
  ('c034', 90, 'orange', '[{"nom":"Baby Shark","cout":1,"degats":60}]'),
  ('c035', 120, 'orange', '[{"nom":"Eclosion","cout":2,"degats":130}]'),
  ('c039', 90, 'violette', '[{"nom":"What a Save !","cout":1,"degats":90}]'),
  ('c040', 70, 'violette', '[{"nom":"Hold-Up","cout":1,"degats":60}]'),
  ('c044', 140, 'violette', '[{"nom":"Pinch","cout":3,"degats":80}]'),
  ('c045', 70, 'violette', '[]'),
  ('c049', 100, 'jaune', '[{"nom":"Dictature","cout":1,"degats":50}]'),
  ('c050', 140, 'mauve', '[{"nom":"Soutien Constant","cout":3,"degats":150}]'),
  ('c051', 110, 'mauve', '[{"nom":"Télépathie","cout":2,"degats":120}]'),
  ('c052', 90, 'mauve', '[{"nom":"Regard Sombre","cout":1,"degats":90},{"nom":"Sourire Radieux","cout":2,"degats":150}]'),
  ('c057', 160, 'mauve', '[{"nom":"AimBot.exe","cout":2,"degats":90},{"nom":"Titanic","cout":3,"degats":140}]'),
  ('c058', 130, 'mauve', '[{"nom":"Menace Fantôme","cout":2,"degats":120}]'),
  ('c059', 40, 'mauve', '[{"nom":"Vroom Vroom","cout":1,"degats":40}]'),
  ('c060', 150, 'mauve', '[{"nom":"Aspiration d''âme","cout":4,"degats":150}]'),
  ('c062', 80, 'verte', '[{"nom":"Confusion","cout":1,"degats":90}]'),
  ('c063', 160, 'verte', '[{"nom":"Sh*t On","cout":4,"degats":180}]'),
  ('c064', 90, 'bleue', '[{"nom":"Frappe de faute","cout":1,"degats":90}]'),
  ('c067', 60, 'bleue', '[{"nom":"Rien à perdre","cout":1,"degats":60}]'),
  ('c068', 120, 'bleue', '[{"nom":"Tout à gagner","cout":2,"degats":120}]'),
  ('c069', 130, 'azur', '[{"nom":"WaWar","cout":3,"degats":90}]'),
  ('c071', 90, 'azur', '[{"nom":"→↓↘ + 👊","cout":2,"degats":90}]'),
  ('c073', 110, 'neutre', '[{"nom":"Ascension","cout":2,"degats":120}]'),
  ('c074', 130, 'neutre', '[{"nom":"Déboutonnage","cout":3,"degats":150}]'),
  ('c075', 140, 'neutre', '[{"nom":"Vol","cout":3,"degats":90}]'),
  ('c076', 100, 'neutre', '[{"nom":"Déploiement","cout":2,"degats":10}]'),
  ('c077', 90, 'neutre', '[{"nom":"Déboîtement d''épaule","cout":1,"degats":90}]'),
  ('c078', 80, 'neutre', '[{"nom":"Estafilade","cout":1,"degats":90},{"nom":"Serment","cout":2,"degats":120}]'),
  ('c079', 70, 'neutre', '[{"nom":"Pré-Clic","cout":2,"degats":110}]'),
  ('c080', 100, 'neutre', '[{"nom":"Permutation","cout":2,"degats":100}]'),
  ('c081', 170, 'neutre', '[{"nom":"Hexa-Punch","cout":4,"degats":190}]'),
  ('c100', 130, 'neutre', '[{"nom":"Doig BYE BYE BYE","cout":3,"degats":160}]'),
  ('c101', 120, 'neutre', '[{"nom":"Choc D''Août","cout":2,"degats":120}]'),
  ('c102', 70, 'neutre', '[{"nom":"Hyper-Vitesse","cout":1,"degats":100}]'),
  ('c112', 130, 'neutre', '[{"nom":"Avenir Radieux","cout":2,"degats":120}]'),
  ('c113', 150, 'rose', '[{"nom":"Coup d''jus","cout":3,"degats":150}]'),
  ('c116', 180, 'mauve', '[{"nom":"Éclairs Vengeurs","cout":4,"degats":200}]'),
  ('c117', 120, 'mauve', '[{"nom":"Sang Froid","cout":2,"degats":140}]'),
  ('c118', 90, 'mauve', '[{"nom":"Cancel Slide","cout":2,"degats":150}]'),
  ('c119', 110, 'neutre', '[{"nom":"Contre-Pitre","cout":1,"degats":10}]'),
  ('c120', 150, 'neutre', '[{"nom":"Mâchouille","cout":2,"degats":120}]'),
  ('c121', 140, 'neutre', '[{"nom":"Coup de fil","cout":3,"degats":160}]')
on conflict (card_id) do update set def = excluded.def, couleur = excluded.couleur, attaques = excluded.attaques;

-- Les sept defis. `pv` : la Defense de l'adversaire pour ce defi.
create table if not exists public.ech_defis (
  jour       integer primary key check (jour between 1 and 7),
  adversaire text not null references public.cards,
  pv         integer not null check (pv > 0),
  regle      text not null check (regle in ('aucune', 'carapace', 'eclair', 'affinite', 'riposte', 'fureur', 'final')),
  param      jsonb not null default '{}',
  titre      text not null,
  texte      text not null
);
insert into public.ech_defis (jour, adversaire, pv, regle, param, titre, texte) values
  (1, 'c010',  900, 'aucune',   '{}',                          'Premier contact', 'Pas de règle aujourd''hui : fais connaissance.'),
  (2, 'c044', 1350, 'carapace', '{"seuil": 100}',              'Carapace',        'Il ignore les coups de moins de 100.'),
  (3, 'c102',  600, 'eclair',   '{}',                          'Frappe éclair',   'Il frappe à chaque tour.'),
  (4, 'c060', 1900, 'affinite', '{"couleur": "rose"}',         'Affinité Rose',   'Tes Joueurs Roses frappent deux fois plus fort.'),
  (5, 'c081',  900, 'riposte',  '{"degats": 30}',              'Riposte',         'Chaque coup que tu lui portes te coûte 30 de Défense.'),
  (6, 'c120', 1000, 'fureur',   '{"plus": 30}',                'Fureur',          'Ses coups gagnent 30 de dégâts à chaque fois.'),
  (7, 'c116', 1150, 'final',    '{"seuil": 80, "plus": 20}',   'Le dernier défi', 'Il ignore les coups de moins de 80, et les siens gagnent 20 à chaque fois.')
on conflict (jour) do update set adversaire = excluded.adversaire, pv = excluded.pv, regle = excluded.regle,
  param = excluded.param, titre = excluded.titre, texte = excluded.texte;

-- Les indices : un par defi, gagne avec ses trois etoiles. `visuel` dit
-- comment l'afficher : un nombre, un mot, des etoiles, l'ombre d'une carte,
-- la teinte de la suite, un eventail de dos de cartes. Le dernier message
-- (jour 0) vient quand les sept sont gagnes. Rien de ce qu'ils disent ne
-- repose sur une regle de combat reconstituee (taille du deck, nombre de
-- lignes ou de PV : des choix « maison », docs/regles-3.0.md de la 3.0) ;
-- seulement sur ce que la suite contient : la refonte, les decks, les
-- Secretes (122 + cinq Secretes = 127, chiffre confirme par le proprietaire
-- le 23 octobre 2026 ; l'indice disait 128 auparavant),
-- les Sections, la maitrise, le Versus, le Raid.
create table if not exists public.ech_indices (
  jour   integer primary key check (jour between 0 and 7),
  titre  text not null,
  texte  text not null,
  visuel jsonb not null default '{}'
);
insert into public.ech_indices (jour, titre, texte, visuel) values
  (1, 'Nouveau visage',   'Tout le jeu va changer de visage. Les couleurs de cette page en sont un avant-goût.', '{"type": "teinte"}'),
  (2, 'Ton deck',         'Tes cartes ne resteront pas dans un classeur : tu en feras ton deck.',               '{"type": "eventail"}'),
  (3, 'Cent vingt-sept',  'La collection ne s''arrête pas à 122 : elle comptera 127 cartes.',                  '{"type": "nombre", "valeur": "127"}'),
  (4, 'Deux',             'Deux camps. Il faudra choisir le tien.',                                            '{"type": "mot", "valeur": "Deux"}'),
  (5, 'Plus loin',        'Tes cartes préférées pourront aller plus loin. Beaucoup plus loin.',                '{"type": "etoiles", "valeur": 5}'),
  (6, 'Face à face',      'Un jour, ce sera contre tes amis.',                                                 '{"type": "mot", "valeur": "VS"}'),
  (7, 'Il reviendra',     'Et la prochaine fois, vous l''affronterez tous ensemble.',                          '{"type": "carte", "carte": "c116"}'),
  (0, 'Tout est prêt',    'Rendez-vous quand tu auras les cartes en main.',                                    '{"type": "mot", "valeur": "Bientôt"}')
on conflict (jour) do update set titre = excluded.titre, texte = excluded.texte, visuel = excluded.visuel;

-- La meilleure note de chaque joueur, defi par defi.
create table if not exists public.ech_scores (
  user_id uuid not null references public.profiles on delete cascade,
  jour    integer not null references public.ech_defis on delete cascade,
  etoiles smallint not null check (etoiles between 0 and 3),
  equipe  jsonb not null,
  tours   integer not null,
  le      timestamptz not null default now(),
  primary key (user_id, jour)
);
-- Chaque essai, des son depart : le plafond du jour se compte ici, et un
-- essai jamais termine reste compte (perdu).
create table if not exists public.ech_essais (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  jour    integer not null references public.ech_defis on delete cascade,
  equipe  jsonb not null,
  le      timestamptz not null default now(),
  fini    boolean not null default false,
  eclat   jsonb,
  etoiles smallint
);
create index if not exists ech_essais_user_idx on public.ech_essais (user_id, jour, le desc);
-- Les paliers deja payes : « sept » (sept defis gagnes), « parfait » (21 etoiles).
create table if not exists public.ech_paliers (
  user_id uuid not null references public.profiles on delete cascade,
  palier  text not null,
  le      timestamptz not null default now(),
  primary key (user_id, palier)
);
alter table public.ech_saison  enable row level security;
alter table public.ech_joueurs enable row level security;
alter table public.ech_defis   enable row level security;
alter table public.ech_scores  enable row level security;
alter table public.ech_paliers enable row level security;
alter table public.ech_indices enable row level security;
alter table public.ech_essais  enable row level security;
revoke all on public.ech_saison, public.ech_joueurs, public.ech_defis, public.ech_scores, public.ech_paliers,
  public.ech_indices, public.ech_essais from anon, authenticated;

-- Les essais d'un joueur sur un defi, aujourd'hui (jour de Paris).
create or replace function public.ech_essais_du_jour(p uuid, p_jour integer) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from ech_essais
   where user_id = p and jour = p_jour
     and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
$$;

-- Le dernier defi ouvert : 0 avant le debut, 1 le premier jour, 7 au plus.
create or replace function public.ech_jour_ouvert() returns integer
language sql stable security definer set search_path = public as $$
  select case when now() < s.debut then 0
              else least(7, floor(extract(epoch from now() - s.debut) / 86400)::int + 1) end
    from ech_saison s where s.id = 1
$$;

-- ---------------------------------------------------------------- le combat
-- p_equipe : [{"carte": "c010", "a": 0}, ...], dans l'ordre, deja verifiee.
-- p_eclat : {"tour": t, "i": i} (le coup d'eclat), ou null.
-- Rend { gagne, etoiles, tours, ko, log } ; chaque ligne du log :
--   [tour, "eclat", i]                   (le coup d'eclat, juste avant le coup)
--   [tour, "frappe", i, degats, pv restants de l'adversaire]
--   [tour, "bloque", i, degats]          (la carapace)
--   [tour, "riposte", i, degats, defense restante]
--   [tour, "subit", i, degats, defense restante]
--   [tour, "ko", i]
-- `i` part de 0. La meme chose, a la ligne pres, est echCombat (js/echauffement.js).
--
-- ech_combat joue un defi donne : une ligne de ech_defis, ou l'adversaire du
-- jour du mode sans fin, mis sous la meme forme (22f_sans-fin.sql) ;
-- ech_simuler, celui d'un des sept jours.
drop function if exists public.ech_simuler(integer, jsonb);
create or replace function public.ech_combat(d ech_defis, p_equipe jsonb, p_eclat jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  n int; i int; t int; e jsonb; j ech_joueurs; at jsonb;
  pv int[] := '{}'; elan int[] := '{}'; cout int[] := '{}'; deg int[] := '{}'; col text[] := '{}';
  pv_b int; elan_b int := 0; cout_b int; deg_b int; fureur int := 0; ko int := 0; dd int;
  journal jsonb := '[]'; seuil int; plus int; riposte int; affin text;
  ec_tour int; ec_i int; ec_pris boolean := false; issue text := null;
begin
  pv_b := d.pv;
  seuil := coalesce((d.param ->> 'seuil')::int, 0);
  plus := coalesce((d.param ->> 'plus')::int, 0);
  riposte := coalesce((d.param ->> 'degats')::int, 0);
  affin := d.param ->> 'couleur';
  if p_eclat is not null and jsonb_typeof(p_eclat) = 'object' then
    ec_tour := (p_eclat ->> 'tour')::int; ec_i := (p_eclat ->> 'i')::int;
  end if;

  -- L'adversaire frappe avec sa plus forte attaque (la premiere, a egalite).
  select (x.value ->> 'cout')::int, (x.value ->> 'degats')::int into cout_b, deg_b
    from ech_joueurs ej, jsonb_array_elements(ej.attaques) with ordinality x(value, k)
   where ej.card_id = d.adversaire
   order by (x.value ->> 'degats')::int desc, x.k limit 1;
  if d.regle = 'eclair' then cout_b := 1; end if;

  n := jsonb_array_length(p_equipe);
  for i in 1..n loop
    e := p_equipe -> (i - 1);
    select * into j from ech_joueurs where card_id = e ->> 'carte';
    at := j.attaques -> coalesce((e ->> 'a')::int, 0);
    pv := pv || j.def; elan := elan || 0; col := col || j.couleur;
    cout := cout || (at ->> 'cout')::int; deg := deg || (at ->> 'degats')::int;
  end loop;
  -- Deux Joueurs de la meme couleur : 1 elan d'avance.
  for i in 1..n loop
    if (select count(*) from unnest(col) c where c = col[i]) > 1 then elan[i] := 1; end if;
  end loop;

  for t in 1..10 loop
    elan_b := elan_b + 1;
    for i in 1..n loop
      exit when issue is not null;
      continue when pv[i] <= 0;
      elan[i] := elan[i] + 1;
      continue when cout[i] is null or elan[i] < cout[i];
      elan[i] := elan[i] - cout[i];
      dd := deg[i];
      if d.regle = 'affinite' and col[i] = affin then dd := dd * 2; end if;
      if ec_tour = t and ec_i = i - 1 and not ec_pris then
        dd := dd * 2; ec_pris := true;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'eclat', i - 1));
      end if;
      if d.regle in ('carapace', 'final') and dd < seuil then
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'bloque', i - 1, dd));
        continue;
      end if;
      pv_b := pv_b - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'frappe', i - 1, dd, greatest(0, pv_b)));
      if pv_b <= 0 then issue := 'gagne'; exit; end if;
      if d.regle = 'riposte' then
        pv[i] := pv[i] - riposte;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'riposte', i - 1, riposte, greatest(0, pv[i])));
        if pv[i] <= 0 then
          ko := ko + 1;
          journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
          if not exists (select 1 from unnest(pv) v where v > 0) then issue := 'perdu'; exit; end if;
        end if;
      end if;
    end loop;

    if issue is null and elan_b >= cout_b then
      elan_b := elan_b - cout_b;
      select min(k) into i from generate_subscripts(pv, 1) k where pv[k] > 0;
      dd := deg_b + fureur;
      if d.regle in ('fureur', 'final') then fureur := fureur + plus; end if;
      pv[i] := pv[i] - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'subit', i - 1, dd, greatest(0, pv[i])));
      if pv[i] <= 0 then
        ko := ko + 1;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
        if not exists (select 1 from unnest(pv) v where v > 0) then issue := 'perdu'; end if;
      end if;
    end if;
    if issue is null and t >= 10 then issue := 'perdu'; end if;
    if issue is not null then
      return jsonb_build_object('gagne', issue = 'gagne', 'tours', t, 'ko', ko,
        'etoiles', case when issue = 'gagne' then (case when ko = 0 then 3 when ko = 1 then 2 else 1 end) else 0 end,
        'log', journal);
    end if;
  end loop;
  return null;
end $$;

create or replace function public.ech_simuler(p_jour integer, p_equipe jsonb, p_eclat jsonb default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select ech_combat(d, p_equipe, p_eclat) from ech_defis d where d.jour = p_jour
$$;

-- L'equipe proposee, verifiee et mise au propre : un a trois Joueurs
-- possedes (une Reverse joue comme sa carte classique), sans doublon, chacun
-- avec une attaque qui existe. Pour ech_commencer et ech_sf_commencer.
create or replace function public.ech_equipe_propre(p uuid, p_equipe jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e jsonb; cid text; nb int; vus text[] := '{}'; propre jsonb := '[]'; a int; natt int;
begin
  if p_equipe is null or jsonb_typeof(p_equipe) <> 'array' then raise exception 'Équipe invalide.'; end if;
  nb := jsonb_array_length(p_equipe);
  if nb < 1 or nb > 3 then raise exception 'Une équipe compte un à trois Joueurs.'; end if;
  for e in select value from jsonb_array_elements(p_equipe) loop
    cid := e ->> 'carte';
    -- Une Reverse joue comme sa carte classique.
    if cid ~ '^r[0-9]' then cid := 'c' || substr(cid, 2); end if;
    if cid is null or not exists (select 1 from ech_joueurs where card_id = cid) then raise exception 'Ce n''est pas un Joueur.'; end if;
    if cid = any(vus) then raise exception 'Un Joueur apparaît deux fois.'; end if;
    vus := vus || cid;
    if not exists (select 1 from collection where user_id = p and qty > 0
                    and card_id in (cid, 'r' || substr(cid, 2))) then
      raise exception 'Tu ne possèdes pas un des Joueurs choisis.';
    end if;
    natt := (select jsonb_array_length(attaques) from ech_joueurs where card_id = cid);
    a := coalesce((e ->> 'a')::int, 0);
    if a < 0 or (natt > 0 and a >= natt) or (natt = 0 and a <> 0) then raise exception 'Attaque inconnue.'; end if;
    propre := propre || jsonb_build_array(jsonb_build_object('carte', cid, 'a', a));
  end loop;
  return propre;
end $$;

-- Ce que les quetes de L'Echauffement recomptent (04_seed.sql) : des etats,
-- pas des compteurs, comme sync_collection_quests — les defis gagnes, ceux
-- a trois etoiles, les etoiles, et les Joueurs differents qui ont combattu.
create or replace function public.ech_sync_quetes(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g int; t int; e int; nj int;
begin
  select count(*) filter (where etoiles > 0), count(*) filter (where etoiles = 3), coalesce(sum(etoiles), 0)
    into g, t, e from ech_scores where user_id = p;
  select count(distinct x ->> 'carte') into nj
    from ech_essais es, jsonb_array_elements(es.equipe) x where es.user_id = p and es.fini;
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope),
         case q.metric when 'ech_gagnes' then g when 'ech_parfaits' then t when 'ech_etoiles' then e else nj end
    from quests q
   where q.metric in ('ech_gagnes', 'ech_parfaits', 'ech_etoiles', 'ech_joueurs')
     and (q.evenement is null or q.evenement = evenement_en_cours())
  on conflict (user_id, quest_id, period_key)
    do update set progress = greatest(quest_progress.progress, excluded.progress)
    where not quest_progress.claimed;
end $$;

-- ------------------------------------------------------------------ l'etat
create or replace function public.ech_etat_de(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert(), 'serveur', now(),
    'total', (select count(*) from ech_defis), 'essais_max', 3,
    'defis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
        'titre', d.titre, 'texte', d.texte,
        'etoiles', coalesce(sc.etoiles, 0), 'equipe', sc.equipe,
        'essais_jour', ech_essais_du_jour(p, d.jour)) order by d.jour)
        from ech_defis d
        left join ech_scores sc on sc.user_id = p and sc.jour = d.jour
       where d.jour <= ech_jour_ouvert()), '[]'::jsonb),
    'etoiles', coalesce((select sum(etoiles) from ech_scores where user_id = p), 0),
    'gagnes', (select count(*) from ech_scores where user_id = p and etoiles > 0),
    'paliers', coalesce((select jsonb_agg(palier) from ech_paliers where user_id = p), '[]'::jsonb),
    -- Seulement ceux qu'on a gagnes : le texte des autres ne sort pas de la base.
    'indices', coalesce((
      select jsonb_agg(jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) order by i.jour)
        from ech_indices i
       where (i.jour > 0 and exists (select 1 from ech_scores sc where sc.user_id = p and sc.jour = i.jour and sc.etoiles = 3))
          or (i.jour = 0 and (select count(*) from ech_scores sc where sc.user_id = p and sc.etoiles = 3) = 7)), '[]'::jsonb))
  from ech_saison s where s.id = 1
$$;

create or replace function public.ech_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return ech_etat_de(p);
end $$;

-- ------------------------------------------------------------- commencer
-- Verifie l'equipe et compte l'essai (trois par defi et par jour de Paris).
-- Rend { essai, equipe, restants }. Le combat se joue ensuite dans le
-- navigateur, puis ech_terminer.
drop function if exists public.ech_jouer(integer, jsonb);
create or replace function public.ech_commencer(p_jour integer, p_equipe jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); s ech_saison; nb int; propre jsonb; deja int; eid bigint;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  if not found or now() < s.debut then raise exception 'L''Échauffement n''a pas commencé.'; end if;
  if now() >= s.fin then raise exception 'L''Échauffement est terminé.'; end if;
  if p_jour is null or p_jour < 1 or p_jour > ech_jour_ouvert() then raise exception 'Ce défi n''est pas encore ouvert.'; end if;

  if p_equipe is null or jsonb_typeof(p_equipe) <> 'array' then raise exception 'Équipe invalide.'; end if;
  nb := jsonb_array_length(p_equipe);
  if nb < 1 or nb > 3 then raise exception 'Une équipe compte un à trois Joueurs.'; end if;

  -- Un depart a la fois : deux appuis partis ensemble ne comptent qu'un essai.
  perform 1 from profiles where id = p for update;
  deja := ech_essais_du_jour(p, p_jour);
  if deja >= 3 then raise exception 'Plus d''essai pour ce défi aujourd''hui : reviens demain.'; end if;

  propre := ech_equipe_propre(p, p_equipe);
  insert into ech_essais (user_id, jour, equipe) values (p, p_jour, propre) returning id into eid;
  return jsonb_build_object('essai', eid, 'equipe', propre, 'restants', 2 - deja);
end $$;

-- -------------------------------------------------------------- terminer
-- Rejoue le combat de l'essai avec le coup d'eclat choisi, garde la
-- meilleure note, paie, et fait avancer les quetes de l'evenement. Rend
-- { resultat, avant, gain: { eclats, braises, boosters, titre }, indice,
-- etat, me }.
create or replace function public.ech_terminer(p_essai bigint, p_eclat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); s ech_saison; es ech_essais; r jsonb; avant int; nouv int; k int; ec jsonb := null;
  eclats int := 0; braises int := 0; boosters int := 0; titre text := null; indice jsonb := null;
  prix int[] := array[80, 80, 140];
  prix_braises int[] := array[15, 15, 25];
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  -- Une heure de grace : un essai commence a 23 h 59 le dernier soir se termine.
  if not found or now() >= s.fin + interval '1 hour' then raise exception 'L''Échauffement est terminé.'; end if;

  perform 1 from profiles where id = p for update;
  select * into es from ech_essais where id = p_essai and user_id = p for update;
  if not found then raise exception 'Essai inconnu.'; end if;
  if es.fini then raise exception 'Cet essai est déjà joué.'; end if;

  if p_eclat is not null and jsonb_typeof(p_eclat) <> 'null' then
    if jsonb_typeof(p_eclat) <> 'object' or jsonb_typeof(p_eclat -> 'tour') <> 'number' or jsonb_typeof(p_eclat -> 'i') <> 'number'
       or (p_eclat ->> 'tour')::numeric not between 1 and 10
       or (p_eclat ->> 'i')::numeric not between 0 and jsonb_array_length(es.equipe) - 1 then
      raise exception 'Coup d''éclat invalide.';
    end if;
    ec := jsonb_build_object('tour', (p_eclat ->> 'tour')::int, 'i', (p_eclat ->> 'i')::int);
  end if;

  r := ech_simuler(es.jour, es.equipe, ec);
  nouv := (r ->> 'etoiles')::int;
  update ech_essais set fini = true, eclat = ec, etoiles = nouv where id = es.id;
  select etoiles into avant from ech_scores where user_id = p and jour = es.jour;
  avant := coalesce(avant, 0);

  if nouv > avant then
    for k in (avant + 1)..nouv loop eclats := eclats + prix[k]; braises := braises + prix_braises[k]; end loop;
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, nouv, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set etoiles = excluded.etoiles, equipe = excluded.equipe,
      tours = excluded.tours, le = now();
    perform accorder(p, 'eclats', eclats, null);
    -- Les Braises, la monnaie de l'evenement (22e_echauffement-evenement.sql).
    perform crediter_prismes(p, 'echauffement', braises);
  else
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, 0, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do nothing;
  end if;

  -- Les quetes de l'evenement (04_seed.sql) : un combat de plus, une
  -- victoire, un coup d'eclat qui a vraiment frappe ; puis ce qui se recompte.
  perform bump_quests(p, 'ech_combat', 1);
  if (r ->> 'gagne')::boolean then perform bump_quests(p, 'ech_victoire', 1); end if;
  if exists (select 1 from jsonb_array_elements(r -> 'log') l where l ->> 1 = 'eclat') then
    perform bump_quests(p, 'ech_eclat', 1);
  end if;
  perform ech_sync_quetes(p);

  -- Un indice : les trois etoiles, pour la premiere fois.
  if nouv = 3 and avant < 3 then
    select jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) into indice
      from ech_indices i where i.jour = es.jour;
  end if;

  -- Les paliers.
  if (select count(*) from ech_scores where user_id = p and etoiles > 0) = 7 then
    insert into ech_paliers (user_id, palier) values (p, 'sept') on conflict do nothing;
    if found then boosters := 3; perform accorder(p, 'boosters', 3, null); end if;
  end if;
  if (select sum(etoiles) from ech_scores where user_id = p) = 21 then
    insert into ech_paliers (user_id, palier) values (p, 'parfait') on conflict do nothing;
    if found then titre := 't_echauffe'; perform accorder(p, 'titre', 0, 't_echauffe'); end if;
  end if;

  return jsonb_build_object('resultat', r, 'avant', avant,
    'gain', jsonb_build_object('eclats', eclats, 'braises', braises, 'boosters', boosters, 'titre', titre),
    'indice', indice, 'etat', ech_etat_de(p), 'me', me());
end $$;

-- -------------------------------------------------------- administration
-- Pour le Labo : ce que les joueurs ne voient pas — la saison, les sept
-- defis meme fermes, les huit indices avec leur texte, et la participation.
-- Reserve aux administrateurs (le serveur le verifie, pas la page).
create or replace function public.ech_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return (select jsonb_build_object(
    'debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert(), 'serveur', now(),
    'total', (select count(*) from ech_defis), 'essais_max', 3,
    'defis', (select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
        'titre', d.titre, 'texte', d.texte,
        'essais', (select count(*) from ech_essais e where e.jour = d.jour),
        'gagnes', (select count(*) from ech_scores sc where sc.jour = d.jour and sc.etoiles > 0),
        'parfaits', (select count(*) from ech_scores sc where sc.jour = d.jour and sc.etoiles = 3)) order by d.jour)
      from ech_defis d),
    'indices', (select jsonb_agg(jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) order by i.jour)
      from ech_indices i),
    'joueurs', (select count(distinct user_id) from ech_essais),
    'sept', (select count(*) from ech_paliers where palier = 'sept'),
    'parfait', (select count(*) from ech_paliers where palier = 'parfait'))
  from ech_saison s where s.id = 1);
end $$;

-- Rejouer : efface les essais du jour de l'administrateur lui-meme, pour
-- tester sans attendre le lendemain. Ses notes et ses gains restent.
create or replace function public.ech_admin_rejouer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); n int;
begin
  if p is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  delete from ech_essais
   where user_id = p and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  get diagnostics n = row_count;
  return jsonb_build_object('effaces', n, 'etat', ech_etat_de(p));
end $$;

revoke all on function public.ech_jour_ouvert, public.ech_simuler, public.ech_etat_de, public.ech_essais_du_jour,
  public.ech_combat, public.ech_equipe_propre, public.ech_sync_quetes
  from public, anon, authenticated;
revoke all on function public.ech_etat, public.ech_commencer, public.ech_terminer,
  public.ech_admin, public.ech_admin_rejouer from public, anon;
grant execute on function public.ech_etat, public.ech_commencer, public.ech_terminer,
  public.ech_admin, public.ech_admin_rejouer to authenticated;


-- =====================================================================
--  Mate TCG Online — version 2.5 : les Reverses se recyclent et se
--  fabriquent. A executer apres 22b_echauffement.sql. Rejouable sans danger.
--  (La 2.5 s'appelait 2.1.4 jusqu'au 23 octobre 2026.)
--
--  Fermes depuis la 2.0 (21_reflets.sql : parametres.fabrication_reverse),
--  le recyclage et la fabrication des Reverses ouvrent avec la 2.5.
--
--   1. L'ouverture est datee : parametres.reverses_des. Passe cet instant,
--      recycler et fabriquer (12_recyclage.sql) acceptent les Reverses, et
--      me() (07_vitrine.sql) le dit au navigateur, qui bascule tout seul.
--      Sur la vraie base, la date est posee par calendrier-2.5.sql : le
--      lundi 26 octobre 2026 a 0 h, heure de Paris (dimanche soir minuit),
--      la sortie de la 2.5 et la fin du recap de Reflets. Vide (une
--      installation neuve) : ferme. `fabrication_reverse = true` ouvre tout
--      de suite, comme avant.
--
--   2. Le prix n'est plus le double d'une classique, mais celui de leur
--      vraie rarete (prix_reverse, plus bas).
--
--  me() n'envoie plus `parametres.fabrication_reverse` : un site 2.1.3
--  afficherait le double au lieu du vrai prix. Il garde donc les Reverses
--  fermees ; la 2.5 lit `parametres.reverses`.
--
--  ------------------------------------------------------------------
--  LE PRIX
--
--  Ce qu'on attend d'une carte precise, en boosters (un booster : deux
--  Communes, une Peu commune, une Essence, une Reverse, un hit) :
--      classiques   Commune 16,5 · Peu commune 24 · Rare 35 · Epique 112
--                   Legendaire 250
--      Reverses     Commune 66 · Peu commune 69 · Rare 187
--  Une Reverse Commune est plus rare qu'une Rare classique ; une Reverse
--  Rare, plus rare qu'une Epique. Le double (80, 200, 800) les vendait
--  moins cher que des cartes deux fois plus faciles a tirer.
--
--  Deux regles :
--    · jamais moins cher qu'une classique plus facile a tirer : Commune et
--      Peu commune reverses au moins 400 (une Rare), Rare reverse au moins
--      2 000 (une Epique) ; et l'ordre des raretes respecte ;
--    · le meme effet que la fabrication des classiques sur la fin de
--      collection : -33 % sur la mediane, -41 % sur le quart le plus lent
--      (cfg() de 01_schema.sql, en-tete de 12_recyclage.sql).
--
--  Simulation (python3 tools/equilibre-reverses.py : 600 joueurs par
--  ligne, presents depuis l'ouverture du 24 septembre ; Reverses en booster
--  depuis la 2.0 ; ouvertes le 24 octobre ; doublons recycles chaque soir ;
--  classiques fabriquees d'abord), date des 85 Reverses, mediane (quart le
--  plus lent) :
--                              sans fabrication      400 / 500 / 2 400
--      regulier (6 par jour)    30 janvier (23 fevrier)  25 decembre (5 janvier)
--      occasionnel (4 par jour,  5 juin (8 aout)         28 mars (18 avril)
--        5 jours sur 7)
--  Gain compte depuis l'ouverture : -37 % / -40 % pour le regulier,
--  -31 % / -39 % pour l'occasionnel ; en moyenne, celui des classiques.
--  A titre de comparaison : le double faisait gagner -46 % / -49 % et
--  finissait les Reverses cinq jours apres les 122 ; ces prix, deux semaines
--  apres (quatre pour l'occasionnel) — les Fragments gardent un usage une
--  fois l'extension complete. Au prix de leur rarete exacte (1 000 / 1 000 /
--  4 800), le gain tombait a -24 % / -31 %.
--  Le revers : un joueur qui met ses Fragments dans les Reverses avant
--  d'avoir les 122 finit l'extension environ trois semaines plus tard
--  (jour 98 au lieu de 78 ; au double, 83). La fiche de fabrication d'une Reverse le
--  rappelle (js/recyclage.js).
--  Pas d'avalanche : il faut 92 400 Fragments pour les 85 (29 840 au
--  double) ; un joueur qui en aurait garde 16 000 sans jamais rien fabriquer
--  comble le premier soir entre le tiers et la moitie de ce qui lui manque,
--  selon le nombre de boosters qu'il a ouverts.
--
--  Le recyclage ne change pas : une Reverse rapporte comme sa classique
--  (2, 5, 20). L'aligner sur ces prix (un vingtieme, comme les classiques :
--  20, 25, 120) donnerait +57 % de Fragments a un joueur avance et
--  raccourcirait d'un tiers la fabrication des classiques ; et un
--  doublon de Reverse garde sa valeur d'echange (contre une Reverse).
--
--  Ce que la simulation ignore : les echanges, les boosters achetes ou
--  offerts, les godpacks, les Reverses du Pass et de la boutique de Reflets.
-- =====================================================================

alter table public.parametres add column if not exists reverses_des timestamptz;

-- Ouvert a la main, ou passe la date.
create or replace function public.reverses_ouvertes() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select fabrication_reverse or coalesce(now() >= reverses_des, false)
                     from parametres where id = 1), false);
$$;

-- Fabriquer une Reverse, en Fragments (le calcul est en tete du fichier).
-- A garder egal a REV_DEFAUT (js/recyclage.js, l'affichage hors ligne) et a
-- prixReverse (_demo/serveur.js).
create or replace function public.prix_reverse(p_rar text) returns integer
language sql immutable as $$
  select case p_rar when 'C' then 400 when 'PC' then 500 when 'R' then 2400 end;
$$;

revoke all on function public.reverses_ouvertes, public.prix_reverse from public, anon, authenticated;

-- Pour verifier :
--   select reverses_ouvertes(), reverses_des at time zone 'Europe/Paris' from public.parametres;
-- Ouvrir tout de suite :
--   update public.parametres set fabrication_reverse = true where id = 1;
-- Deplacer l'ouverture :
--   update public.parametres set reverses_des = timestamptz '2026-10-24 00:00:00+02' where id = 1;


-- =====================================================================
--  Mate TCG Online — version 2.5 : le Labo refait, et la date de sortie
--  d'une version. A executer apres 22c_reverses.sql. Rejouable sans danger.
--
--  LA DATE DE SORTIE
--  Le site peut etre en ligne avant sa sortie (SORTIE, js/config.js) : il
--  se montre tel qu'avant, puis bascule a la minute dite. Cette minute est
--  ecrite dans le code ; si parametres.sorties en donne une pour la version
--  (cle : son numero, valeur : l'instant, ou null pour « deja sortie »),
--  c'est celle du serveur qui compte. me() l'envoie (07_vitrine.sql), et le
--  Labo la deplace avec le reste du calendrier.
--
--  LE CALENDRIER OFFICIEL de la 2.5 vit ici, et nulle part ailleurs cote
--  serveur (calendrier_officiel) : calendrier-2.5.sql l'applique, le Labo y
--  revient.
--
--  LE LABO (js/lab.js) : ce qu'un administrateur regle lui-meme, pour de vrai.
--  Chaque fonction verifie le droit (labo_garde) : cacher l'onglet ne
--  suffirait pas, c'est le serveur qui refuse.
--
--   Le serveur, pour tout le monde :
--     labo_etat()                 ce qui est en vigueur, et le calendrier officiel
--     labo_calendrier(etat, n)    poser un etat coherent de tout le calendrier :
--                                   'officiel'   les dates de la 2.5 ;
--                                   'avant'      le recap de Reflets, la 2.5 dans
--                                                n minutes (2 par defaut) ;
--                                   'defi'       la 2.5 sortie, le defi n ouvert ;
--                                   'rattrapage' les sept ouverts, la saison court ;
--                                   'fini'       la saison terminee depuis une
--                                                heure : son recap ;
--                                   'sans_fin'   le jour n du mode sans fin
--                                                (4 par defaut : recap fini)
--     labo_decaler(heures)        avancer (positif) ou reculer la saison
--     labo_reverses(ouvertes)     ouvrir ou fermer les Reverses a la main
--     labo_ech_raz('EFFACER')     effacer essais, notes et paliers de tous les
--                                 joueurs, mode sans fin compris (les gains
--                                 deja verses restent, Braises comprises)
--  La ligne de l'evenement L'Echauffement suit la saison toute seule
--  (declencheur, 22e_echauffement-evenement.sql).
--   Son propre compte :
--     labo_cartes(quoi)           'master' (tout sauf la carte unique),
--                                 'classiques' (les 122), 'joueurs' (ceux de
--                                 L'Echauffement), 'vider'
--     labo_monnaies(valeurs)      poser Eclats, Fragments, boosters en plus,
--                                 reserve, Prismes
--     labo_cosmetiques(ids)       des cadres (f_…) et des titres (t_…)
--     labo_ech_moi(action, ...)   ses etoiles a un defi ('etoiles'), ses essais
--                                 du jour ('essais', mode sans fin compris),
--                                 tout ('raz') ; rien n'est verse
--     labo_sauver(), labo_restaurer()  mettre son compte de cote, le remettre
--     labo_raz_moi()              repartir de zero, comme un nouveau joueur
--
--  Un apercu sans rien changer reste dans le navigateur (onglet Apercus du
--  Labo) ; ce qui passe ici est reel.
-- =====================================================================

alter table public.parametres add column if not exists sorties jsonb not null default '{}'::jsonb;

-- Une sauvegarde par administrateur : son compte tel qu'il etait.
create table if not exists public.labo_sauvegardes (
  user_id uuid primary key references public.profiles on delete cascade,
  le      timestamptz not null default now(),
  contenu jsonb not null
);
alter table public.labo_sauvegardes enable row level security;
-- Aucune policy : seules les fonctions du Labo y touchent.
revoke all on public.labo_sauvegardes from anon, authenticated;

-- ---------------------------------------------------------------- le garde
-- L'appelant, s'il est administrateur ; sinon, rien ne passe.
create or replace function public.labo_garde() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return p;
end $$;

-- ------------------------------------------------------ le calendrier officiel
-- Heure de Paris : vendredi 23 octobre minuit (heure d'ete), dimanche 25
-- minuit (heure d'hiver, apres le changement d'heure), mercredi 4 novembre.
create or replace function public.calendrier_officiel() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'reflets_fin',  timestamptz '2026-10-24 00:00:00+02',
    'recap_jusqua', timestamptz '2026-10-26 00:00:00+01',
    'saison_debut', timestamptz '2026-10-26 00:00:00+01',
    'saison_fin',   timestamptz '2026-11-04 00:00:00+01',
    'reverses_des', timestamptz '2026-10-26 00:00:00+01',
    'sortie_25',    timestamptz '2026-10-26 00:00:00+01',
    -- Pour la frise du Labo : la fin du recap de L'Echauffement (trois jours
    -- apres la saison, 22e_echauffement-evenement.sql).
    'ech_recap',    timestamptz '2026-11-07 00:00:00+01')
$$;

-- Poser tout le calendrier d'un coup : la fin de Reflets et de son recap,
-- la saison de L'Echauffement, l'ouverture des Reverses (et plus
-- d'ouverture a la main), la sortie de la 2.5.
create or replace function public.poser_calendrier(p_reflets_fin timestamptz, p_recap timestamptz,
  p_saison timestamptz, p_saison_fin timestamptz, p_reverses timestamptz, p_sortie timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update evenements
     set debut = least(debut, p_reflets_fin - interval '1 day'), fin = p_reflets_fin, recap_jusqua = p_recap
   where code = 'reflets';
  insert into ech_saison (id, debut, fin) values (1, p_saison, p_saison_fin)
    on conflict (id) do update set debut = excluded.debut, fin = excluded.fin;
  update parametres
     set reverses_des = p_reverses, fabrication_reverse = false,
         sorties = sorties || jsonb_build_object('2.5', p_sortie)
   where id = 1;
end $$;

create or replace function public.calendrier_officiel_poser() returns void
language plpgsql security definer set search_path = public as $$
declare o jsonb := calendrier_officiel();
begin
  perform poser_calendrier((o->>'reflets_fin')::timestamptz, (o->>'recap_jusqua')::timestamptz,
    (o->>'saison_debut')::timestamptz, (o->>'saison_fin')::timestamptz,
    (o->>'reverses_des')::timestamptz, (o->>'sortie_25')::timestamptz);
end $$;

-- ------------------------------------------------------------ l'etat du jeu
create or replace function public.labo_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  return jsonb_build_object(
    'serveur', now(),
    'officiel', calendrier_officiel(),
    'reflets', (select jsonb_build_object('debut', e.debut, 'fin', e.fin,
                         'recap_jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
                  from evenements e where e.code = 'reflets' order by e.fin desc limit 1),
    'sortie', (select sorties -> '2.5' from parametres where id = 1),
    'saison', (select jsonb_build_object('debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert())
                 from ech_saison s where s.id = 1),
    -- L'evenement L'Echauffement (22e_echauffement-evenement.sql) : la fin de
    -- son recap ; et le mode sans fin (22f_sans-fin.sql) : l'adversaire du jour.
    'ech_recap', (select coalesce(e.recap_jusqua, e.fin + interval '3 days') from evenements e
                   where e.code = 'echauffement' order by e.fin desc limit 1),
    'sans_fin', (select jsonb_build_object('ordre', ech_sf_ordre(j), 'niveau', ech_sf_niveau(j),
                          'adversaire', (ech_sf_defi(j)).adversaire, 'titre', (ech_sf_defi(j)).titre,
                          'joueurs', (select count(distinct user_id) from ech_sf_essais),
                          'gagnes', (select count(*) from ech_sf_scores where jour = j and etoiles > 0))
                   from (select (now() at time zone 'Europe/Paris')::date as j) x),
    'reverses', (select jsonb_build_object('des', reverses_des, 'manuel', fabrication_reverse,
                          'ouvertes', reverses_ouvertes())
                   from parametres where id = 1),
    'chasse', chasse_etat(),
    'recharge', jsonb_build_object('minutes', minutes_recharge(), 'cap', cfg('ticket_cap')),
    'recharges', coalesce((select jsonb_agg(jsonb_build_object('titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                                   'minutes', e.ticket_minutes) order by e.debut)
                             from evenements e where e.code is null and e.fin > now()), '[]'::jsonb),
    'echauffement', ech_admin(),
    'joueurs', (select count(*) from profiles),
    'sauvegarde', (select jsonb_build_object('le', s.le, 'cartes', jsonb_array_length(s.contenu -> 'collection'))
                     from labo_sauvegardes s where s.user_id = p));
end $$;

-- ------------------------------------------------------- naviguer les etats
create or replace function public.labo_calendrier(p_etat text, p_n integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d timestamptz; n int;
begin
  perform labo_garde();
  if p_etat = 'officiel' then
    perform calendrier_officiel_poser();
  elsif p_etat = 'avant' then
    -- Le recap de Reflets court ; la 2.5 sort dans n minutes.
    n := coalesce(p_n, 2);
    if n < 1 or n > 10080 then raise exception 'Entre 1 minute et 7 jours.'; end if;
    d := now() + make_interval(mins => n);
    perform poser_calendrier(now() - interval '1 day', d, d, d + interval '9 days', d, d);
  elsif p_etat in ('defi', 'rattrapage', 'fini', 'sans_fin') then
    -- La 2.5 est sortie, au debut de la saison ; le recap avait dure deux jours.
    -- 'sans_fin' : la saison est finie depuis n - 1 jours et une heure.
    n := case p_etat when 'defi' then coalesce(p_n, 1) when 'rattrapage' then 8 when 'fini' then 10
                     else 9 + coalesce(p_n, 4) end;
    if p_etat = 'defi' and (n < 1 or n > 7) then raise exception 'Un défi de 1 à 7.'; end if;
    if p_etat = 'sans_fin' and (n < 10 or n > 9 + 60) then raise exception 'Un jour de 1 à 60.'; end if;
    d := now() - make_interval(days => n - 1) - interval '1 hour';
    perform poser_calendrier(d - interval '2 days', d, d, d + interval '9 days', d, d);
  else
    raise exception 'État inconnu.';
  end if;
  return labo_etat();
end $$;

-- Avancer la saison de p_heures (24 : un defi de plus), ou la reculer.
create or replace function public.labo_decaler(p_heures integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform labo_garde();
  if p_heures is null or p_heures = 0 or abs(p_heures) > 336 then raise exception 'De 1 à 336 heures.'; end if;
  update ech_saison set debut = debut - make_interval(hours => p_heures),
                        fin = fin - make_interval(hours => p_heures)
   where id = 1;
  return labo_etat();
end $$;

-- Les Reverses a la main : ouvertes tout de suite, ou fermees sans date (le
-- calendrier officiel remet la date).
create or replace function public.labo_reverses(p_ouvertes boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform labo_garde();
  if p_ouvertes then
    update parametres set fabrication_reverse = true where id = 1;
  else
    update parametres set fabrication_reverse = false, reverses_des = null where id = 1;
  end if;
  return labo_etat();
end $$;

-- Remettre L'Echauffement a zero pour tout le monde. Ce qui a ete verse
-- (Eclats, boosters, titre) reste : on ne reprend rien a un joueur.
create or replace function public.labo_ech_raz(p_confirmation text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; a2 int; b2 int;
begin
  perform labo_garde();
  if p_confirmation is distinct from 'EFFACER' then raise exception 'Confirmation manquante.'; end if;
  delete from ech_essais where true;
  get diagnostics a = row_count;
  delete from ech_scores where true;
  get diagnostics b = row_count;
  delete from ech_paliers where true;
  get diagnostics c = row_count;
  -- Le mode sans fin (22f_sans-fin.sql).
  delete from ech_sf_essais where true;
  get diagnostics a2 = row_count;
  delete from ech_sf_scores where true;
  get diagnostics b2 = row_count;
  return jsonb_build_object('essais', a + a2, 'notes', b + b2, 'paliers', c, 'etat', labo_etat());
end $$;

-- --------------------------------------------------------- son propre compte
-- Les cartes : le master set (tout le catalogue, sauf la carte unique, qui
-- n'existe qu'en un exemplaire), les 122, les Joueurs de L'Echauffement, ou
-- plus rien. Une carte deja la garde ses exemplaires.
create or replace function public.labo_cartes(p_quoi text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  if p_quoi = 'vider' then
    -- Ses demandes d'echange en attente n'ont plus d'objet.
    update trades set status = 'cancelled', resolved_at = now()
     where status = 'pending' and (from_user = p or to_user = p);
    delete from collection where user_id = p;
  elsif p_quoi in ('master', 'classiques', 'joueurs') then
    insert into collection (user_id, card_id, qty)
    select p, k.id, 1 from cards k
     where case p_quoi when 'master' then k.rar <> 'UN'
                       when 'classiques' then not k.promo
                       else k.id in (select card_id from ech_joueurs) end
    on conflict (user_id, card_id) do update set qty = greatest(collection.qty, 1);
  else
    raise exception 'Choix inconnu.';
  end if;
  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

-- Les monnaies, posees a la valeur dite : eclats, fragments, boosters (en
-- plus, hors reserve), reserve, prismes (de l'evenement en cours, ou du
-- dernier). Une cle absente ne change rien.
create or replace function public.labo_monnaies(p_valeurs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); k text; v numeric; lim numeric; ev text;
begin
  if p_valeurs is null or jsonb_typeof(p_valeurs) <> 'object' then raise exception 'Valeurs invalides.'; end if;
  for k in select jsonb_object_keys(p_valeurs) loop
    if k not in ('eclats', 'fragments', 'boosters', 'reserve', 'prismes') then raise exception 'Valeur inconnue : %.', k; end if;
    if jsonb_typeof(p_valeurs -> k) <> 'number' then raise exception 'Un nombre est attendu.'; end if;
    v := (p_valeurs ->> k)::numeric;
    lim := case k when 'reserve' then 99 when 'boosters' then 999 else 10000000 end;
    if v < 0 or v > lim then raise exception 'Valeur hors limites : %.', k; end if;
  end loop;
  update profiles set
    shards         = coalesce(round((p_valeurs ->> 'eclats')::numeric)::int, shards),
    fragments      = coalesce(round((p_valeurs ->> 'fragments')::numeric)::int, fragments),
    boosters_bonus = coalesce(round((p_valeurs ->> 'boosters')::numeric)::int, boosters_bonus),
    tickets_offerts = case when p_valeurs ? 'boosters'
                           then least(tickets_offerts, round((p_valeurs ->> 'boosters')::numeric)::int)
                           else tickets_offerts end,
    tickets        = coalesce(round((p_valeurs ->> 'reserve')::numeric)::int, tickets),
    last_tick      = case when p_valeurs ? 'reserve' then now() else last_tick end
   where id = p;
  if p_valeurs ? 'prismes' then
    ev := coalesce(evenement_en_cours(),
                   (select e.code from evenements e where e.code is not null order by e.fin desc limit 1));
    if ev is null then raise exception 'Aucun événement : pas de Prismes à poser.'; end if;
    insert into evt_comptes (user_id, evenement, solde, total)
    values (p, ev, round((p_valeurs ->> 'prismes')::numeric)::int, round((p_valeurs ->> 'prismes')::numeric)::int)
    on conflict (user_id, evenement) do update
      set solde = excluded.solde, total = greatest(evt_comptes.total, excluded.solde);
  end if;
  return me();
end $$;

-- Des cadres et des titres, par leur identifiant (le navigateur envoie ceux
-- de FRAMES et TITRES, js/config.js).
create or replace function public.labo_cosmetiques(p_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); x text;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then
    raise exception 'Liste vide ou trop longue.';
  end if;
  foreach x in array p_ids loop
    if x !~ '^[ft]_[a-z0-9_]{1,40}$' then raise exception 'Identifiant invalide : %.', x; end if;
    insert into inventory (user_id, item_id, qty) values (p, x, 1)
      on conflict (user_id, item_id) do update set qty = greatest(inventory.qty, 1);
  end loop;
  return me();
end $$;

-- L'Echauffement, sur son compte : ses etoiles a un defi (0 les efface),
-- ses essais du jour, ou tout. Rien n'est verse : c'est pour voir.
create or replace function public.labo_ech_moi(p_action text, p_jour integer default null,
  p_etoiles integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde();
begin
  if p_action = 'etoiles' then
    if p_jour is null or p_jour < 1 or p_jour > 7 then raise exception 'Un défi de 1 à 7.'; end if;
    if p_etoiles is null or p_etoiles < 0 or p_etoiles > 3 then raise exception 'De 0 à 3 étoiles.'; end if;
    if p_etoiles = 0 then
      delete from ech_scores where user_id = p and jour = p_jour;
    else
      insert into ech_scores (user_id, jour, etoiles, equipe, tours) values (p, p_jour, p_etoiles, '[]'::jsonb, 0)
        on conflict (user_id, jour) do update set etoiles = excluded.etoiles, le = now();
    end if;
  elsif p_action = 'essais' then
    delete from ech_essais
     where user_id = p and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
    delete from ech_sf_essais where user_id = p and jour = (now() at time zone 'Europe/Paris')::date;
  elsif p_action = 'raz' then
    delete from ech_essais where user_id = p;
    delete from ech_scores where user_id = p;
    delete from ech_paliers where user_id = p;
    delete from ech_sf_essais where user_id = p;
    delete from ech_sf_scores where user_id = p;
  else
    raise exception 'Action inconnue.';
  end if;
  return ech_etat_de(p);
end $$;

-- Ce qu'une sauvegarde emporte, et ce que « repartir de zero » efface : tout
-- ce qui est a soi, sauf les amis, la boite de reception et les echanges.
create or replace function public.labo_tables() returns text[]
language sql immutable as $$
  select array['collection', 'inventory', 'quest_progress', 'evt_comptes', 'evt_piste_prises',
               'gardes', 'favoris', 'devine_illu', 'ech_scores', 'ech_paliers', 'ech_essais',
               'ech_sf_scores', 'ech_sf_essais', 'tirages', 'recyclages']
$$;

create or replace function public.labo_sauver() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); c jsonb; t text; r jsonb;
begin
  c := jsonb_build_object('profil', (select to_jsonb(x) from profiles x where x.id = p));
  foreach t in array labo_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into r using p;
    c := c || jsonb_build_object(t, r);
  end loop;
  insert into labo_sauvegardes (user_id, le, contenu) values (p, now(), c)
    on conflict (user_id) do update set le = excluded.le, contenu = excluded.contenu;
  return labo_etat();
end $$;

-- Remettre le compte tel qu'il etait a la sauvegarde. Les lignes qui ne
-- tiennent plus (une carte, une quete, un defi disparus depuis) sont laissees.
create or replace function public.labo_restaurer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); s labo_sauvegardes; t text; r profiles; filtre text;
begin
  select * into s from labo_sauvegardes where user_id = p;
  if not found then raise exception 'Aucune sauvegarde.'; end if;
  foreach t in array labo_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using p;
    filtre := case
      when t in ('collection', 'gardes', 'favoris', 'recyclages') then 'where x.card_id in (select id from public.cards)'
      when t = 'quest_progress' then 'where x.quest_id in (select id from public.quests)'
      when t in ('ech_scores', 'ech_essais') then 'where x.jour in (select jour from public.ech_defis)'
      else '' end;
    execute format('insert into public.%I overriding system value select x.* from jsonb_populate_recordset(null::public.%I, $1) x %s',
                   t, t, filtre)
      using coalesce(s.contenu -> t, '[]'::jsonb);
  end loop;
  r := jsonb_populate_record(null::public.profiles, s.contenu -> 'profil');
  update profiles set
    shards = coalesce(r.shards, shards), fragments = coalesce(r.fragments, fragments),
    tickets = coalesce(r.tickets, tickets), last_tick = coalesce(r.last_tick, last_tick),
    trade_free_at = coalesce(r.trade_free_at, trade_free_at),
    boosters_bonus = coalesce(r.boosters_bonus, boosters_bonus), tickets_offerts = coalesce(r.tickets_offerts, tickets_offerts),
    packs_opened = coalesce(r.packs_opened, packs_opened), trades_done = coalesce(r.trades_done, trades_done),
    streak = coalesce(r.streak, streak), last_checkin = r.last_checkin, serie_max = coalesce(r.serie_max, serie_max),
    fabrications = coalesce(r.fabrications, fabrications), avatar = coalesce(r.avatar, avatar), frame = coalesce(r.frame, frame),
    titre = r.titre, banniere = r.banniere, devise = r.devise,
    vitrine = coalesce(r.vitrine, vitrine), garder = coalesce(r.garder, garder)
   where id = p;
  return me();
end $$;

-- Repartir de zero, comme un nouveau joueur : tout ce que labo_tables()
-- liste, et les compteurs du profil. Garde le compte, le pseudo, les amis,
-- la boite de reception, les droits. Penser a labo_sauver() avant.
create or replace function public.labo_raz_moi() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := labo_garde(); t text;
begin
  update trades set status = 'cancelled', resolved_at = now()
   where status = 'pending' and (from_user = p or to_user = p);
  foreach t in array labo_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using p;
  end loop;
  update profiles set
    shards = 0, fragments = 0, tickets = cfg('ticket_cap'), last_tick = now(), trade_free_at = now(),
    boosters_bonus = 0, tickets_offerts = 0, packs_opened = 0, trades_done = 0, streak = 0,
    last_checkin = null, serie_max = 0, fabrications = 0, avatar = 'star', frame = 'default',
    titre = null, banniere = null, devise = null, vitrine = '{}', garder = '{}'
   where id = p;
  return me();
end $$;

revoke all on function public.labo_garde, public.calendrier_officiel, public.poser_calendrier,
  public.calendrier_officiel_poser, public.labo_tables from public, anon, authenticated;
revoke all on function public.labo_etat, public.labo_calendrier, public.labo_decaler, public.labo_reverses,
  public.labo_ech_raz, public.labo_cartes, public.labo_monnaies, public.labo_cosmetiques, public.labo_ech_moi,
  public.labo_sauver, public.labo_restaurer, public.labo_raz_moi from public, anon;
grant execute on function public.labo_etat, public.labo_calendrier, public.labo_decaler, public.labo_reverses,
  public.labo_ech_raz, public.labo_cartes, public.labo_monnaies, public.labo_cosmetiques, public.labo_ech_moi,
  public.labo_sauver, public.labo_restaurer, public.labo_raz_moi to authenticated;


-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement, un vrai evenement
--  A executer apres 22d_admin.sql. Rejouable sans danger.
--
--  Jusqu'au 24 octobre 2026, L'Echauffement n'etait que ses sept defis
--  (22b_echauffement.sql). Il devient un evenement a la maniere de Reflets
--  (21_reflets.sql), sur la meme charpente : une ligne de `evenements` (code
--  'echauffement'), calee sur sa saison, et tout ce qui porte ce code — sa
--  monnaie, ses quetes, son Pass, sa boutique, son classement, son recap.
--
--  LA MONNAIE : les Braises (on s'echauffe). En base, comme les Prismes de
--  Reflets, elles vivent dans evt_comptes (evenement = 'echauffement') et
--  s'appellent `prismes` partout ou une monnaie d'evenement est attendue
--  (quests.monnaie, shop_items.devise) : seul le nom affiche change
--  (MONNAIES_EV, js/config.js). `solde` se depense dans sa boutique, `total`
--  fait avancer le Pass : acheter ne le fait jamais reculer.
--
--  CE QUI EN RAPPORTE (calcul du Pass) :
--    · les etoiles des defis : 15, 15 puis 25 par defi (ech_terminer,
--      22b_echauffement.sql), 385 en tout ;
--    · quatre quetes du jour (04_seed.sql) : 50 par jour, 450 sur les neuf
--      jours de la saison ;
--    · neuf quetes de l'evenement, une fois : 390.
--  Soit 1 225 au plus. Un joueur qui vient chaque jour et fait tout finit le
--  Pass (1 050) vers le huitieme jour ; un joueur regulier (sept jours sur
--  neuf, les quatre cinquiemes des quetes du jour, deux tiers de celles de
--  l'evenement, quinze etoiles) en gagne ~815 : palier 15 ; un joueur de
--  passage (quatre jours, huit etoiles) ~395 : palier 8.
--
--  LE PASS : vingt paliers, les ecarts grandissent pour que les premiers
--  tombent vite. En tout : 10 boosters, 600 Eclats, 1 100 Fragments, 4
--  Reverses Rares, une Essence Brillante, deux titres et deux cadres
--  decores (« Braise », « Ardeur » : tools/cadres.py). A peu pres les trois
--  quarts du Pass de Reflets, pour un evenement de neuf jours au lieu de
--  quatorze, qui paie deja ses defis en Eclats (2 100) et en boosters (3).
--
--  LA BOUTIQUE (04_seed.sql) : tout acheter coute 1 120 Braises ; un joueur
--  regulier doit choisir.
--
--  LE CLASSEMENT : les dix joueurs qui ont gagne le plus de Braises
--  (evenement_etat, 21_reflets.sql).
--
--  APRES : trois jours de recap (evenement_recap, 22b_echauffement.sql), et
--  le mode sans fin dans l'onglet Combats (22f_sans-fin.sql).
-- =====================================================================

-- ------------------------------------------------- la ligne de l'evenement
-- Les memes dates que la saison (ech_saison), et trois jours de recap
-- apres. Le declencheur les garde ensemble : la saison bouge (Labo,
-- calendrier-2.5.sql, ou a la main), l'evenement suit.
create or replace function public.ech_saison_evenement() returns trigger
language plpgsql set search_path = public as $$
begin
  update evenements
     set debut = new.debut, fin = new.fin, recap_jusqua = new.fin + interval '3 days'
   where code = 'echauffement';
  return new;
end $$;
drop trigger if exists ech_saison_evenement on public.ech_saison;
create trigger ech_saison_evenement after insert or update on public.ech_saison
  for each row execute function public.ech_saison_evenement();

insert into public.evenements (titre, texte, debut, fin, ticket_minutes, code, recap_jusqua)
select 'L''Échauffement', 'Sept défis, un par jour, avec tes Joueurs. Gagne des Braises et remonte le Pass.',
       s.debut, s.fin, null, 'echauffement', s.fin + interval '3 days'
  from public.ech_saison s
 where s.id = 1 and not exists (select 1 from public.evenements where code = 'echauffement');
update public.evenements e
   set debut = s.debut, fin = s.fin, recap_jusqua = s.fin + interval '3 days'
  from public.ech_saison s
 where s.id = 1 and e.code = 'echauffement';

-- ----------------------------------------------- les quetes, pendant l'evenement
-- bump_quests (01_schema.sql), a l'identique sauf une chose : une quete
-- d'evenement ne compte que pendant son evenement. Avant, « Ouvre 30
-- boosters pendant l'evenement » aurait compte ceux ouverts avant son
-- debut — la ligne de la quete existe des la mise a jour.
create or replace function public.bump_quests(p uuid, m text, amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount <= 0 then return; end if;
  insert into quest_progress (user_id, quest_id, period_key, progress)
  select p, q.id, period_key(q.scope), amount from quests q
   where q.metric = m and (q.evenement is null or q.evenement = evenement_en_cours())
  on conflict (user_id, quest_id, period_key)
    do update set progress = quest_progress.progress + amount
    where not quest_progress.claimed;
end $$;

-- ------------------------------------------------------------------ le Pass
delete from public.evt_piste where evenement = 'echauffement' and palier > 20;
insert into public.evt_piste (evenement, palier, seuil, type, montant, objet, titre) values
  ('echauffement',  1,   20, 'boosters',   1, null,              '1 booster'),
  ('echauffement',  2,   50, 'fragments', 150, null,             '150 Fragments'),
  ('echauffement',  3,   85, 'titre',      0, 't_ech_round',     'Titre « Premier round »'),
  ('echauffement',  4,  125, 'boosters',   2, null,              '2 boosters'),
  ('echauffement',  5,  170, 'eclats',   150, null,              '150 Éclats'),
  ('echauffement',  6,  220, 'reverse_R',  1, null,              'Une Reverse Rare'),
  ('echauffement',  7,  275, 'fragments', 250, null,             '250 Fragments'),
  ('echauffement',  8,  335, 'boosters',   2, null,              '2 boosters'),
  ('echauffement',  9,  400, 'cadre',      0, 'f_braise',        'Cadre « Braise »'),
  ('echauffement', 10,  465, 'fragments', 300, null,             '300 Fragments'),
  ('echauffement', 11,  530, 'boosters',   2, null,              '2 boosters'),
  ('echauffement', 12,  595, 'reverse_R',  1, null,              'Une Reverse Rare'),
  ('echauffement', 13,  660, 'eclats',   200, null,              '200 Éclats'),
  ('echauffement', 14,  725, 'fragments', 400, null,             '400 Fragments'),
  ('echauffement', 15,  790, 'brillante',  1, null,              'Une Essence Brillante'),
  ('echauffement', 16,  850, 'boosters',   3, null,              '3 boosters'),
  ('echauffement', 17,  910, 'eclats',   250, null,              '250 Éclats'),
  ('echauffement', 18,  965, 'reverse_R',  2, null,              'Deux Reverses Rares'),
  ('echauffement', 19, 1010, 'titre',      0, 't_ech_feu',       'Titre « Feu sacré »'),
  ('echauffement', 20, 1050, 'cadre',      0, 'f_ardeur',        'Cadre « Ardeur »')
on conflict (evenement, palier) do update set
  seuil = excluded.seuil, type = excluded.type, montant = excluded.montant,
  objet = excluded.objet, titre = excluded.titre;

-- ================================================================= droits
revoke all on function public.ech_saison_evenement from public, anon, authenticated;
revoke all on function public.bump_quests from public, anon, authenticated;


-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement continue, sans fin
--  A executer apres 22e_echauffement-evenement.sql. Rejouable sans danger.
--
--  Apres la saison (ech_saison.fin : le mercredi 4 novembre 2026, 0 h),
--  l'onglet Combats garde L'Echauffement, en mode sans fin, tant que la 3.0
--  n'est pas la : un defi par jour, le meme pour tout le monde, tire d'une
--  liste de 21 adversaires de niveaux varies. La difficulte ne monte pas,
--  elle change d'un jour a l'autre : l'ordre (`ordre`) melange Facile,
--  Moyen, Difficile et Redoutable, et ne met jamais deux fois la meme regle
--  deux jours de suite. Apres le 21e jour, on recommence au premier.
--
--  LE COMBAT est celui de la saison (ech_combat, 22b_echauffement.sql), avec
--  les memes regles (aucune, carapace, eclair, affinite, riposte, fureur,
--  final) et d'autres reglages. Trois essais par jour, comptes au depart ;
--  le combat se joue dans le navigateur, puis ech_sf_terminer le rejoue ici.
--  Seul le defi du jour se joue : pas de rattrapage, c'est un rendez-vous
--  quotidien, pas une collection a completer.
--
--  LES RECOMPENSES, comme Devine l'illu devenu permanent : de quoi revenir
--  chaque jour sans peser sur l'economie. 30, 30 puis 60 Eclats pour les
--  etoiles 1, 2 et 3 du jour (120 au plus, autant qu'une illu trouvee au
--  premier essai). Dix jours gagnes : le titre « Infatigable » (quete
--  saisonniere m_sf10, 04_seed.sql).
--
--  L'EQUILIBRAGE (simulation sur les 51 Joueurs, toutes les equipes
--  ordonnees, la meilleure attaque et le meilleur coup d'eclat ; la Defense
--  de chaque adversaire est le multiple de 50 qui approche le mieux la cible
--  de son niveau) :
--                       une equipe au hasard     une collection d'un tiers
--                       gagne     fait 3 ★       trouve ses 3 ★
--      Facile .......   70-93 %   17-25 %        toujours
--      Moyen ........   53-88 %    6-9 %         98-100 %
--      Difficile ....   31-51 %    2-3 %         75-99 %
--      Redoutable ...   16-35 %    ~1 %          58-83 %
--  Pour comparer, les sept defis de la saison sont entre Difficile et
--  Redoutable (une equipe au hasard fait 3 ★ une fois sur trente a cent).
--  Le detail, adversaire par adversaire, est dans le tableau ci-dessous.
-- =====================================================================

create table if not exists public.ech_sf_adversaires (
  ordre      integer primary key check (ordre between 1 and 99),
  adversaire text not null references public.cards,
  pv         integer not null check (pv > 0),
  regle      text not null check (regle in ('aucune', 'carapace', 'eclair', 'affinite', 'riposte', 'fureur', 'final')),
  param      jsonb not null default '{}',
  niveau     smallint not null check (niveau between 1 and 4),
  titre      text not null,
  texte      text not null
);
-- La simulation, par ligne : une equipe au hasard gagne (G) / fait trois
-- etoiles (3), et une collection d'un tiers trouve ses trois etoiles (T).
insert into public.ech_sf_adversaires (ordre, adversaire, pv, regle, param, niveau, titre, texte) values
  ( 1, 'c057',  850, 'aucune',   '{}',                        1, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 91 %, 3 17,5 %, T 100 %
  ( 2, 'c063', 1000, 'carapace', '{"seuil": 80}',             2, 'Carapace',           'Il ignore les coups de moins de 80.'),                             -- G 70 %, 3 8,8 %, T 98 %
  ( 3, 'c079',  600, 'eclair',   '{}',                        3, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 51 %, 3 2,8 %, T 99 %
  ( 4, 'c074',  750, 'riposte',  '{"degats": 20}',            1, 'Riposte',            'Chaque coup que tu lui portes te coûte 20 de Défense.'),           -- G 86 %, 3 21,9 %, T 100 %
  ( 5, 'c100', 1200, 'final',    '{"seuil": 70, "plus": 15}', 4, 'Carapace et fureur', 'Il ignore les coups de moins de 70, et les siens gagnent 15 à chaque fois.'), -- G 33 %, 3 0,9 %, T 58 %
  ( 6, 'c112', 1150, 'affinite', '{"couleur": "rose"}',       2, 'Affinité Rose',      'Tes Joueurs Roses frappent deux fois plus fort.'),                 -- G 53 %, 3 7,4 %, T 100 %
  ( 7, 'c071',  500, 'eclair',   '{}',                        1, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 82 %, 3 17 %, T 100 %
  ( 8, 'c035',  950, 'fureur',   '{"plus": 30}',              3, 'Fureur',             'Ses coups gagnent 30 de dégâts à chaque fois.'),                   -- G 36 %, 3 2,1 %, T 99 %
  ( 9, 'c023',  850, 'aucune',   '{}',                        2, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 88 %, 3 6,1 %, T 100 %
  (10, 'c117',  900, 'carapace', '{"seuil": 100}',            4, 'Carapace',           'Il ignore les coups de moins de 100.'),                            -- G 16 %, 3 0,7 %, T 83 %
  (11, 'c058', 1050, 'affinite', '{"couleur": "neutre"}',     1, 'Affinité Neutre',    'Tes Joueurs Neutres frappent deux fois plus fort.'),               -- G 70 %, 3 18,6 %, T 100 %
  (12, 'c029', 1100, 'final',    '{"seuil": 90, "plus": 25}', 3, 'Carapace et fureur', 'Il ignore les coups de moins de 90, et les siens gagnent 25 à chaque fois.'), -- G 42 %, 3 1,6 %, T 93 %
  (13, 'c012',  700, 'riposte',  '{"degats": 30}',            2, 'Riposte',            'Chaque coup que tu lui portes te coûte 30 de Défense.'),           -- G 65 %, 3 5,8 %, T 99 %
  (14, 'c118',  550, 'fureur',   '{"plus": 40}',              1, 'Fureur',             'Ses coups gagnent 40 de dégâts à chaque fois.'),                   -- G 93 %, 3 24,7 %, T 100 %
  (15, 'c022',  500, 'eclair',   '{}',                        4, 'Frappe éclair',      'Il frappe à chaque tour.'),                                        -- G 35 %, 3 0,8 %, T 80 %
  (16, 'c113', 1650, 'affinite', '{"couleur": "mauve"}',      3, 'Affinité Mauve',     'Tes Joueurs Mauves frappent deux fois plus fort.'),                -- G 31 %, 3 2,7 %, T 83 %
  (17, 'c121',  900, 'fureur',   '{"plus": 20}',              2, 'Fureur',             'Ses coups gagnent 20 de dégâts à chaque fois.'),                   -- G 85 %, 3 6 %, T 98 %
  (18, 'c069', 1200, 'aucune',   '{}',                        1, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 80 %, 3 22,1 %, T 100 %
  (19, 'c050', 1100, 'carapace', '{"seuil": 90}',             3, 'Carapace',           'Il ignore les coups de moins de 90.'),                             -- G 46 %, 3 2,6 %, T 75 %
  (20, 'c025',  850, 'aucune',   '{}',                        2, 'Sans règle',         'Pas de règle aujourd''hui.'),                                      -- G 65 %, 3 6,1 %, T 100 %
  (21, 'c068',  800, 'riposte',  '{"degats": 40}',            4, 'Riposte',            'Chaque coup que tu lui portes te coûte 40 de Défense.')            -- G 26 %, 3 1,1 %, T 75 %
on conflict (ordre) do update set adversaire = excluded.adversaire, pv = excluded.pv, regle = excluded.regle,
  param = excluded.param, niveau = excluded.niveau, titre = excluded.titre, texte = excluded.texte;
delete from public.ech_sf_adversaires where ordre > 21;

-- Chaque essai, des son depart (le plafond du jour se compte ici), et la
-- meilleure note de chaque jour.
create table if not exists public.ech_sf_essais (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  equipe  jsonb not null,
  le      timestamptz not null default now(),
  fini    boolean not null default false,
  eclat   jsonb,
  etoiles smallint
);
create index if not exists ech_sf_essais_user_idx on public.ech_sf_essais (user_id, jour);
create table if not exists public.ech_sf_scores (
  user_id uuid not null references public.profiles on delete cascade,
  jour    date not null,
  etoiles smallint not null check (etoiles between 0 and 3),
  equipe  jsonb not null,
  tours   integer not null,
  le      timestamptz not null default now(),
  primary key (user_id, jour)
);
alter table public.ech_sf_adversaires enable row level security;
alter table public.ech_sf_essais enable row level security;
alter table public.ech_sf_scores enable row level security;
revoke all on public.ech_sf_adversaires, public.ech_sf_essais, public.ech_sf_scores from anon, authenticated;

-- Le jour de Paris, et le premier jour du mode sans fin : celui ou la
-- saison se termine.
create or replace function public.ech_sf_premier() returns date
language sql stable security definer set search_path = public as $$
  select (s.fin at time zone 'Europe/Paris')::date from ech_saison s where s.id = 1
$$;

-- La place d'un jour dans la liste : elle se deroule dans l'ordre, un
-- adversaire par jour, puis recommence.
create or replace function public.ech_sf_ordre(j date) returns integer
language sql stable security definer set search_path = public as $$
  select (((j - ech_sf_premier()) % n) + n) % n + 1
    from (select count(*)::int as n from ech_sf_adversaires) x
$$;
-- L'adversaire d'un jour, sous la forme d'un defi (ech_defis) pour ech_combat.
create or replace function public.ech_sf_defi(j date) returns ech_defis
language sql stable security definer set search_path = public as $$
  select jsonb_populate_record(null::ech_defis, to_jsonb(a) || jsonb_build_object('jour', 0))
    from ech_sf_adversaires a where a.ordre = ech_sf_ordre(j)
$$;
create or replace function public.ech_sf_niveau(j date) returns smallint
language sql stable security definer set search_path = public as $$
  select a.niveau from ech_sf_adversaires a where a.ordre = ech_sf_ordre(j)
$$;

create or replace function public.ech_sf_essais_du_jour(p uuid, j date) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from ech_sf_essais where user_id = p and jour = j
$$;

-- ------------------------------------------------------------------ l'etat
-- { ouvert, debut, serveur, jour, n (le combien de jours depuis le debut),
--   essais_max, prix, defi (l'adversaire du jour, sa note, son equipe, ses
--   essais), demain (le niveau du lendemain), victoires, etoiles, serie,
--   top (les dix qui ont le plus d'etoiles), rang }.
create or replace function public.ech_sf_etat_de(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s ech_saison; j date := (now() at time zone 'Europe/Paris')::date; d ech_defis; sc ech_sf_scores;
  serie int := 0; k date; tot int; rang int;
begin
  select * into s from ech_saison where id = 1;
  if not found then return 'null'::jsonb; end if;
  if now() < s.fin then
    return jsonb_build_object('ouvert', false, 'debut', s.fin, 'serveur', now());
  end if;
  d := ech_sf_defi(j);
  select * into sc from ech_sf_scores where user_id = p and jour = j;
  -- La serie : les jours gagnes d'affilee, jusqu'a aujourd'hui (ou hier, si
  -- le defi du jour n'est pas encore gagne).
  k := case when coalesce(sc.etoiles, 0) > 0 then j else j - 1 end;
  while exists (select 1 from ech_sf_scores where user_id = p and jour = k and etoiles > 0) loop
    serie := serie + 1; k := k - 1;
  end loop;
  select coalesce(sum(etoiles), 0) into tot from ech_sf_scores where user_id = p;
  select count(*) + 1 into rang from (select user_id from ech_sf_scores group by user_id having sum(etoiles) > tot) x;
  return jsonb_build_object(
    'ouvert', true, 'debut', s.fin, 'serveur', now(), 'jour', j, 'n', j - ech_sf_premier() + 1,
    'essais_max', 3, 'prix', jsonb_build_array(30, 30, 60),
    'defi', jsonb_build_object('adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
      'titre', d.titre, 'texte', d.texte, 'niveau', ech_sf_niveau(j),
      'etoiles', coalesce(sc.etoiles, 0), 'equipe', sc.equipe, 'essais_jour', ech_sf_essais_du_jour(p, j)),
    'demain', ech_sf_niveau(j + 1),
    'victoires', (select count(*) from ech_sf_scores where user_id = p and etoiles > 0),
    'etoiles', tot,
    'serie', serie,
    'rang', case when tot > 0 then rang end,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', x.total, 'moi', pr.id = p) order by x.total desc, lower(pr.pseudo))
        from (select user_id, sum(etoiles)::int as total from ech_sf_scores group by user_id
               having sum(etoiles) > 0 order by sum(etoiles) desc limit 10) x
        join profiles pr on pr.id = x.user_id), '[]'::jsonb));
end $$;

create or replace function public.ech_sf_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return ech_sf_etat_de(p);
end $$;

-- ------------------------------------------------------------- commencer
-- Verifie l'equipe (ech_equipe_propre) et compte l'essai du jour. Rend
-- { essai, equipe, restants }.
create or replace function public.ech_sf_commencer(p_equipe jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); s ech_saison; j date := (now() at time zone 'Europe/Paris')::date; nb int;
  propre jsonb; deja int; eid bigint;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  if not found or now() < s.fin then raise exception 'Le défi du jour commence après L''Échauffement.'; end if;
  if p_equipe is null or jsonb_typeof(p_equipe) <> 'array' then raise exception 'Équipe invalide.'; end if;
  nb := jsonb_array_length(p_equipe);
  if nb < 1 or nb > 3 then raise exception 'Une équipe compte un à trois Joueurs.'; end if;
  -- Un depart a la fois : deux appuis partis ensemble ne comptent qu'un essai.
  perform 1 from profiles where id = p for update;
  deja := ech_sf_essais_du_jour(p, j);
  if deja >= 3 then raise exception 'Plus d''essai aujourd''hui : un autre adversaire t''attend demain.'; end if;
  propre := ech_equipe_propre(p, p_equipe);
  insert into ech_sf_essais (user_id, jour, equipe) values (p, j, propre) returning id into eid;
  return jsonb_build_object('essai', eid, 'equipe', propre, 'restants', 2 - deja);
end $$;

-- -------------------------------------------------------------- terminer
-- Rejoue le combat de l'essai (contre l'adversaire de son jour) avec le
-- coup d'eclat choisi, garde la meilleure note du jour, paie les etoiles
-- nouvelles. Un essai se termine dans l'heure : commence a 23 h 59, il
-- compte pour son jour. Rend { resultat, avant, gain: { eclats }, etat, me }.
create or replace function public.ech_sf_terminer(p_essai bigint, p_eclat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); es ech_sf_essais; r jsonb; avant int; nouv int; k int; ec jsonb := null;
  eclats int := 0; prix int[] := array[30, 30, 60];
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  perform 1 from profiles where id = p for update;
  select * into es from ech_sf_essais where id = p_essai and user_id = p for update;
  if not found then raise exception 'Essai inconnu.'; end if;
  if es.fini then raise exception 'Cet essai est déjà joué.'; end if;
  if now() > es.le + interval '1 hour' then raise exception 'Cet essai a expiré.'; end if;

  if p_eclat is not null and jsonb_typeof(p_eclat) <> 'null' then
    if jsonb_typeof(p_eclat) <> 'object' or jsonb_typeof(p_eclat -> 'tour') <> 'number' or jsonb_typeof(p_eclat -> 'i') <> 'number'
       or (p_eclat ->> 'tour')::numeric not between 1 and 10
       or (p_eclat ->> 'i')::numeric not between 0 and jsonb_array_length(es.equipe) - 1 then
      raise exception 'Coup d''éclat invalide.';
    end if;
    ec := jsonb_build_object('tour', (p_eclat ->> 'tour')::int, 'i', (p_eclat ->> 'i')::int);
  end if;

  r := ech_combat(ech_sf_defi(es.jour), es.equipe, ec);
  nouv := (r ->> 'etoiles')::int;
  update ech_sf_essais set fini = true, eclat = ec, etoiles = nouv where id = es.id;
  select etoiles into avant from ech_sf_scores where user_id = p and jour = es.jour;
  avant := coalesce(avant, 0);

  if nouv > avant then
    for k in (avant + 1)..nouv loop eclats := eclats + prix[k]; end loop;
    insert into ech_sf_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, nouv, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set etoiles = excluded.etoiles, equipe = excluded.equipe,
      tours = excluded.tours, le = now();
    perform accorder(p, 'eclats', eclats, null);
    -- La premiere victoire du jour fait avancer « Infatigable » (04_seed.sql).
    if avant = 0 then perform bump_quests(p, 'sf_victoire', 1); end if;
  else
    insert into ech_sf_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, 0, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do nothing;
  end if;

  return jsonb_build_object('resultat', r, 'avant', avant, 'gain', jsonb_build_object('eclats', eclats),
    'etat', ech_sf_etat_de(p), 'me', me());
end $$;

revoke all on function public.ech_sf_premier, public.ech_sf_ordre, public.ech_sf_defi, public.ech_sf_niveau,
  public.ech_sf_essais_du_jour, public.ech_sf_etat_de from public, anon, authenticated;
revoke all on function public.ech_sf_etat, public.ech_sf_commencer, public.ech_sf_terminer from public, anon;
grant execute on function public.ech_sf_etat, public.ech_sf_commencer, public.ech_sf_terminer to authenticated;


-- =====================================================================
--  Mate TCG Online — le calendrier de la 2.5, fin octobre 2026 (dates)
--  Apres 22d_admin.sql. Pas dans TOUT.sql : ce sont des dates. Rejouable :
--  il pose toujours les memes.
--
--   · Reflets se termine le vendredi 23 octobre a minuit ;
--   · son recap reste jusqu'au dimanche 25 octobre a minuit ;
--   · a cette minute-la (lundi 26, 0 h) sort la 2.5 :
--       - L'Echauffement commence, et dure neuf jours : un defi de plus
--         chaque jour jusqu'au dimanche 1er novembre, puis deux jours pour
--         rattraper (fin le mercredi 4 novembre, 0 h) ;
--       - les Reverses se recyclent et se fabriquent (22c_reverses.sql), et
--         plus d'ouverture a la main (fabrication_reverse) ;
--       - le site lui-meme bascule (parametres.sorties ; la meme minute est
--         ecrite dans le code, SORTIE dans js/config.js).
--
--  Les dates elles-memes sont dans calendrier_officiel() (22d_admin.sql),
--  leur seule copie cote serveur : le Labo (« Calendrier officiel ») et ce
--  fichier passent par elle.
--
--  Heure de Paris. Le changement d'heure tombe dans la nuit du samedi 24 au
--  dimanche 25 : vendredi minuit est en heure d'ete (+02), dimanche minuit en
--  heure d'hiver (+01).
--
--  Historique : la vraie base a recu ce calendrier le jeudi 22 octobre 2026
--  (sous le nom calendrier-2.1.4.sql, les Reverses alors au vendredi
--  minuit), puis les Reverses ont ete reportees a la sortie de la 2.5 le
--  vendredi 23 octobre, avant leur ouverture.
-- =====================================================================

select public.calendrier_officiel_poser();

-- Pour verifier (heure de Paris) :
select code, fin at time zone 'Europe/Paris' as fin_paris, recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'reflets';
select debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris from public.ech_saison;
select reverses_des at time zone 'Europe/Paris' as reverses_paris, reverses_ouvertes() as ouvertes,
       fabrication_reverse, sorties from public.parametres;
