-- =====================================================================
--  Mate TCG Online — mise a jour 1.5.5 : boosters offerts sans carte unique
--  A executer APRES 18_cadeaux.sql. Rejouable sans danger.
--
--  Les boosters recus en cadeau sont comptes a part (tickets_offerts). Ils
--  partent en premier a l'ouverture, et ne peuvent pas contenir la carte
--  unique : elle se trouve, elle ne s'offre pas.
--
--  Dans le SQL Editor de Supabase : tout coller, puis Run. Sur GitHub,
--  prendre le fichier avec « Copy raw file ».
-- =====================================================================

begin;

alter table public.profiles add column if not exists tickets_offerts integer not null default 0;

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

commit;

-- Verification : la colonne existe, et open_pack la lit.
select (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles' and column_name = 'tickets_offerts') as colonne,
       (select prosrc like '%tickets_offerts%' from pg_proc where proname = 'open_pack') as open_pack_a_jour;
