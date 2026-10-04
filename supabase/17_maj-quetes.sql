-- =====================================================================
--  Mate TCG Online — mise a jour 1.5.3 : quetes et carte unique
--  A executer APRES 16_maj-v1.5.sql. Rejouable sans danger.
--
--  1. Les quetes : les seules sources d'Eclats depuis la version 1.5. Les
--     quotidiennes et hebdomadaires montent, les premiers paliers baissent,
--     et une quotidienne apparait : « Petit menage », recycler 5 doublons.
--     Le detail et la simulation sont en tete de 04_seed.sql. Les quetes
--     deja encaissees le restent ; les autres paient le nouveau montant.
--  2. recycler() fait avancer « Petit menage ».
--  3. open_pack() : la carte unique prend la place de la derniere carte du
--     booster au lieu de s'ajouter en septieme.
--
--  Dans le SQL Editor de Supabase : tout coller, puis Run. Sur GitHub,
--  prendre le fichier avec « Copy raw file ».
-- =====================================================================

begin;

-- Les boosters recus en cadeau (18_cadeaux.sql), comptes a part : open_pack
-- plus bas en a besoin.
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;

-- ---------------------------------------------------------------- 1. quetes
insert into public.quests (id, scope, metric, goal, reward, item_id, titre, detail, ordre) values
  ('d_check',   'daily',     'checkin',        1,   40, null, 'Premier passage',      'Ouvre le jeu aujourd''hui.', 1),
  ('d_packs',   'daily',     'packs',          5,   60, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2),
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

  ('m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 16)
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
  'm_trade25');

-- -------------------------------------------------------------- 2. recycler
create or replace function public.recycler(p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); lot jsonb; cid text; n int; k cards;
  possede int; reserve int; prix int; total int := 0; nb int := 0; vus text[] := '{}';
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
    if k.promo then raise exception 'Cette carte ne se recycle pas.'; end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    if coalesce(possede, 0) - 1 - reserve < n then
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

-- ------------------------------------------------------------- 3. open_pack
create or replace function public.open_pack() returns jsonb
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
  if pr.tickets < 1 then
    raise exception 'RESERVE_VIDE';
  end if;
  -- Les boosters recus en cadeau (18_cadeaux.sql) partent en premier, et ne
  -- peuvent pas contenir la carte unique : elle se trouve, elle ne s'offre pas.
  offert := coalesce(pr.tickets_offerts, 0) > 0;

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

  -- Un booster consomme depuis la reserve pleine relance le compte a rebours.
  update profiles set
    tickets      = tickets - 1,
    tickets_offerts = greatest(tickets_offerts - case when offert then 1 else 0 end, 0),
    last_tick    = case when pr.tickets >= cfg('ticket_cap') then now() else last_tick end,
    packs_opened = packs_opened + 1
  where id = p;

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

commit;

-- Verification : 28 quetes, dont « Petit menage » a 30 Eclats.
select count(*) as quetes,
       (select reward from public.quests where id = 'd_recycle') as petit_menage,
       (select reward from public.quests where id = 'd_check') as premier_passage
  from public.quests;
