-- =====================================================================
--  Mate TCG Online — les cartes Promo
--
--  Elles n'appartiennent pas a l'extension : jamais tirees dans un booster,
--  jamais comptees dans les 122 cartes, jamais echangeables. On les obtient
--  autrement — en boutique, ou en recompense d'un palier de collection.
--
--  A jouer apres 03_rpc.sql et AVANT 04_seed.sql : la boutique vend deux de
--  ces cartes, et ne peut pas les referencer avant qu'elles existent.
--  Rejouable sans danger.
-- =====================================================================

-- ------------------------------------------------------------ catalogue
-- `promo = true` les exclut du tirage (pick_card) et du pourcentage de
-- collection (sync_collection_quests) : c'est le seul drapeau a poser.
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo) values
  ('p01',  1, 'Major de Paris',    'coach',  'mauve',  'PR', false, true),
  ('p02',  2, 'Major de Paris',    'coach',  'mauve',  'PR', false, true),
  ('p05',  5, 'Tout Commence Ici', 'joueur', 'rose',   'PR', false, true),
  ('p06',  6, 'Le Marionnettiste', 'joueur', 'neutre', 'PR', false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- ------------------------------------------- les Essences Brillantes
-- La version brillante de chacune des Essences : meme carte, autre finition.
-- `b` + le numero de l'Essence (c001 -> b001). Hors extension (promo = true) :
-- jamais dans le total de 122, jamais echangeables, jamais recyclees ni
-- fabriquees. Elles ne sortent que de la case Essence d'un booster, une fois
-- sur cfg('foil_odds') (voir open_pack, 03_rpc.sql).
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo)
select 'b' || substr(k.id, 2), k.num, k.nom || ' Brillante', k.cat, k.col, 'BR', false, true
  from public.cards k
 where k.cat = 'essence' and not k.promo and k.id like 'c%'
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- ------------------------------------------------------- les Reverses
-- Version 2.0. Chaque Commune, Peu commune et Rare de l'extension a sa Reverse :
-- `r` + son numero (c010 -> r010), meme rarete, frappee du logo Tout Commence
-- Ici. 33 + 24 + 28 = 85. Hors des 122 (promo), mais echangeables,
-- recyclables et fabricables (reverse) — voir 01_schema.sql. Elles sortent
-- de la 4e case d'un booster (open_pack, 03_rpc.sql).
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo, reverse)
select 'r' || substr(k.id, 2), k.num, k.nom, k.cat, k.col, k.rar, false, true, true
  from public.cards k
 where k.rar in ('C', 'PC', 'R') and not k.promo and k.id like 'c%'
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo,
  reverse = excluded.reverse;

-- ------------------------------------------------- la carte unique
-- Un seul exemplaire dans tout le jeu : celui ou celle qui la tire la garde.
-- C'est la chasse (15_evenements.sql) qui la distribue, une seule fois.
insert into public.cards (id, num, nom, cat, col, rar, in_booster, promo) values
  ('u01', 1, 'L''Unique Chevalière', 'objet', 'neutre', 'UN', false, true)
on conflict (id) do update set
  num = excluded.num, nom = excluded.nom, cat = excluded.cat, col = excluded.col,
  rar = excluded.rar, in_booster = excluded.in_booster, promo = excluded.promo;

-- =====================================================================
--  Les paliers de collection
--
--  Deux cartes s'obtiennent en completant la collection. Le serveur les
--  accorde lui-meme : le navigateur ne peut ni les reclamer, ni mentir sur
--  son avancement.
--
--  Idempotent : une carte deja possedee n'est pas redonnee. C'est important,
--  parce que check_promos() est appele a chaque ouverture de booster et a
--  chaque visite — sans ce garde-fou, le compteur d'exemplaires grimperait
--  tout seul.
-- =====================================================================
-- open_pack() (03_rpc.sql) appelle cette fonction alors qu'elle n'existe pas
-- encore au moment ou il est cree : PL/pgSQL resout les appels a l'execution,
-- pas a la creation, et ce fichier est joue juste apres. Au premier booster
-- ouvert, elle est la.
create or replace function public.check_promos(p uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pct int;
begin
  -- Le meme calcul que sync_collection_quests : les Promos ne comptent pas
  -- dans leur propre condition d'obtention.
  select case when count(*) = 0 then 0
         else floor(count(*) filter (where c.qty > 0) * 100.0 / count(*)) end
    into pct
    from cards k left join collection c on c.card_id = k.id and c.user_id = p
   where not k.promo;

  -- Palier intermediaire : la carte du milieu de parcours.
  if pct >= cfg('promo_palier_pct') then
    insert into collection (user_id, card_id, qty) values (p, 'p06', 1)
      on conflict (user_id, card_id) do nothing;
  end if;

  -- Master Set : l'extension entiere.
  if pct >= 100 then
    insert into collection (user_id, card_id, qty) values (p, 'p05', 1)
      on conflict (user_id, card_id) do nothing;
  end if;
end $$;

-- me() appelle check_promos a chaque rafraichissement : une collection
-- completee par un echange — et non par un booster — accorde la carte au
-- rafraichissement suivant. Cet appel est pose dans 07_vitrine.sql, qui est le
-- dernier fichier a redefinir me() : l'ajouter ici serait inutile, la version
-- de 07 l'ecraserait.

-- check_promos est un rouage interne : appele par me() et open_pack, jamais
-- par le navigateur.
revoke all on function public.check_promos from public, anon, authenticated;

-- =====================================================================
--  Outil : accorder une carte Promo a la main
--
--  Sert a tester l'animation d'obtention sans avoir a completer la
--  collection. Remplace le pseudo et l'identifiant, puis execute.
--  Pour rejouer l'animation, retire d'abord la carte (requete du bas).
-- =====================================================================
-- insert into public.collection (user_id, card_id, qty)
-- select id, 'p05', 1 from public.profiles where lower(pseudo) = lower('TonPseudo')
-- on conflict (user_id, card_id) do update set qty = collection.qty + 1;

-- delete from public.collection
--  where card_id in ('p01','p02','p05','p06')
--    and user_id = (select id from public.profiles where lower(pseudo) = lower('TonPseudo'));
