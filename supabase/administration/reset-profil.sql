-- =====================================================================
--  Mate TCG Online — remettre UN profil a zero (version 3.0)
--
--  A coller dans Supabase > SQL Editor. Change le pseudo plus bas (deux
--  endroits, marques <<<<<<), puis Run. N'affecte QUE ce profil : les
--  autres joueurs ne bougent pas.
--
--  Regle du proprietaire : aucun SQL 3.0 sur la base de production tant
--  qu'il ne l'a pas decide. Ce script suppose le schema de la 3.0
--  (supabase/TOUT.sql de la branche) ; sur une base 2.x, il s'arrete au
--  garde-fou (tables inconnues ou absentes).
--
--  CE QUI EST EFFACE, pour ce joueur :
--    · la collection, et tout ce qui en depend : exemplaires a garder,
--      favoris, maitrises (et leur journal), journal du recyclage,
--      historique des tirages ;
--    · les Eclats, les Fragments, les boosters en reserve ou en plus, les
--      jetons d'echange, l'inventaire (cadres, tapis, sleeves, titres
--      achetes ou gagnes), les cadeaux pas encore ouverts ;
--    · la progression des quetes, les compteurs (boosters ouverts,
--      echanges, fabrications, serie de jours), la boite de reception ;
--    · les evenements : soldes (Prismes, Etincelles…), Pass, Devine l'illu ;
--      et les etoiles et essais de L'Echauffement (2.1.4) s'il est installe ;
--    · les Combats : Section, XP et niveau, decks, campagne, combats en
--      cours, defis (les siens ET ceux qu'on lui a lances), Epreuve du
--      Choc, participation au Raid ;
--    · la vitrine, la carte fetiche, le titre, la banniere ; un avatar qui
--      montrait une carte redevient l'etoile ; le cadre revient a celui de
--      base.
--
--  CE QUI EST GARDE : le compte, le pseudo, la devise, les amis, les
--  invitations qu'il a creees, ses reglages « a garder » par rarete, et
--  les droits d'administrateur.
--
--  ET AUTOUR :
--    · ses demandes d'echange en attente sont annulees (l'historique reste) ;
--    · s'il avait trouve la carte unique, la chasse reprend : la carte est
--      de nouveau a trouver ;
--    · les degats qu'il a faits au boss du Raid restent dans le total de
--      la saison (le boss ne reprend pas de PV).
--
--  Irreversible. La requete du bas montre l'etat du profil : lance-la
--  seule d'abord si tu veux regarder.
--
--  GARDE-FOU : le script refuse de tourner si une table du schema pointe
--  vers `profiles` sans qu'il la connaisse (une table ajoutee depuis). Il
--  faut alors le mettre a jour : effacer ce qu'elle contient pour ce
--  joueur, ou la ranger parmi ce qu'on garde (README § 9.10).
-- =====================================================================

do $$
declare
  cible text := 'kenshowho';   -- <<<<<< LE PSEUDO A REMETTRE A ZERO
  uid uuid;
  -- Toutes les tables qui pointent vers profiles, effacees ou gardees.
  connues text[] := array[
    'collection', 'gardes', 'favoris', 'maitrises', 'maitrises_journal',
    'recyclages', 'tirages', 'quest_progress', 'inventory', 'cadeaux',
    'notifications', 'evt_comptes', 'evt_piste_prises', 'devine_illu',
    'combat_joueurs', 'decks', 'combats_ouverts', 'defis', 'choc_joueurs',
    'choc_epreuves', 'raid_participants', 'raid_pris', 'raid_tentatives',
    'trades', 'chasse',
    -- L'Echauffement (2.1.4), s'il a ete installe sur cette base :
    'ech_scores', 'ech_essais', 'ech_paliers',
    -- gardees :
    'friendships', 'invitations', 'annonces'];
  inconnues text;
  unique_rendue boolean;
begin
  select string_agg(distinct r.relname, ', ') into inconnues
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
   where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
     and n.nspname = 'public' and r.relname <> all (connues);
  if inconnues is not null then
    raise exception 'Remise a zero annulee : ce script ne connait pas %. Mets-le a jour avant de le jouer.', inconnues;
  end if;

  select id into uid from public.profiles where lower(pseudo) = lower(cible);
  if uid is null then
    raise exception 'Aucun profil ne porte le pseudo %', cible;
  end if;

  -- La collection, et ce qui en depend.
  delete from public.collection        where user_id = uid;
  delete from public.gardes            where user_id = uid;
  delete from public.favoris           where user_id = uid;
  delete from public.maitrises         where user_id = uid;
  delete from public.maitrises_journal where user_id = uid;
  delete from public.recyclages        where user_id = uid;
  delete from public.tirages           where user_id = uid;

  -- La progression, l'inventaire, la boite.
  delete from public.quest_progress    where user_id = uid;
  delete from public.inventory         where user_id = uid;
  delete from public.cadeaux           where user_id = uid;
  delete from public.notifications     where user_id = uid;

  -- Les evenements.
  delete from public.evt_comptes       where user_id = uid;
  delete from public.evt_piste_prises  where user_id = uid;
  delete from public.devine_illu       where user_id = uid;

  -- Les Combats.
  delete from public.combat_joueurs    where user_id = uid;
  delete from public.decks             where user_id = uid;
  delete from public.combats_ouverts   where user_id = uid;
  delete from public.defis             where de = uid or pour = uid;
  delete from public.choc_joueurs      where user_id = uid;
  delete from public.choc_epreuves     where user_id = uid;
  delete from public.raid_participants where user_id = uid;
  delete from public.raid_pris         where user_id = uid;
  delete from public.raid_tentatives   where user_id = uid;
  -- L'Echauffement (2.1.4) : ses tables n'existent que sur une base qui l'a recu.
  if to_regclass('public.ech_scores') is not null then
    execute 'delete from public.ech_scores  where user_id = $1' using uid;
    execute 'delete from public.ech_essais  where user_id = $1' using uid;
    execute 'delete from public.ech_paliers where user_id = $1' using uid;
  end if;

  -- Les demandes d'echange en cours n'ont plus d'objet sans collection.
  update public.trades set status = 'cancelled', resolved_at = now()
   where status = 'pending' and (from_user = uid or to_user = uid);

  -- La carte unique partait avec sa collection : la chasse reprend.
  update public.chasse set gagnant = null, trouvee_le = null where gagnant = uid;
  unique_rendue := found;

  update public.profiles set
    shards          = 0,
    fragments       = 0,
    tickets         = public.cfg('ticket_cap'),
    last_tick       = now(),
    boosters_bonus  = 0,
    tickets_offerts = 0,
    trade_free_at   = now(),
    packs_opened    = 0,
    trades_done     = 0,
    fabrications    = 0,
    streak          = 0,
    serie_max       = 0,
    last_checkin    = null,
    vitrine         = '{}',
    fetiche         = null,
    titre           = null,
    banniere        = null,
    frame           = 'default',
    avatar          = case when avatar like 'card:%' then 'star' else avatar end,
    boite_vue_le    = now()
  where id = uid;

  raise notice 'Profil % remis a zero.%', cible,
    case when unique_rendue then ' Il avait la carte unique : la chasse reprend.' else '' end;
end $$;

-- Verification : le profil doit afficher 0 partout, et 0 carte.
select p.pseudo, p.tickets, p.shards, p.fragments, p.packs_opened, p.trades_done,
       p.streak, p.is_admin,
       (select count(*) from public.collection c where c.user_id = p.id and c.qty > 0) as cartes,
       (select count(*) from public.combat_joueurs j where j.user_id = p.id)         as combats,
       (select count(*) from public.maitrises m where m.user_id = p.id)              as maitrises
  from public.profiles p
 where lower(p.pseudo) = lower('kenshowho');   -- <<<<<< le meme pseudo
