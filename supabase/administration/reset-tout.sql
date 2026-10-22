-- =====================================================================
--  Mate TCG Online — REMISE A ZERO GENERALE (version 3.0)
--
--  A jouer une seule fois, le jour d'un vrai lancement, pour effacer la
--  progression de TOUS les comptes ouverts pendant la periode de test.
--
--  Regle du proprietaire : aucun SQL 3.0 sur la base de production tant
--  qu'il ne l'a pas decide. Ce script suppose le schema de la 3.0
--  (supabase/TOUT.sql de la branche) ; sur une base 2.x, il s'arrete au
--  garde-fou (tables inconnues ou absentes).
--
--  ------------------------------------------------------------------
--  CE QUI EST EFFACE, pour tout le monde :
--    · les collections, et tout ce qui en depend : exemplaires a garder,
--      favoris, maitrises (et leur journal), journal du recyclage,
--      historique des tirages ;
--    · les Eclats, les Fragments, les boosters en reserve ou en plus, les
--      jetons d'echange, les inventaires, les cadeaux pas encore ouverts ;
--    · la progression des quetes, les compteurs, les boites de reception ;
--    · tous les echanges, y compris ceux en attente ;
--    · les evenements : soldes, Pass, Devine l'illu ;
--      et les etoiles et essais de L'Echauffement (2.1.4) s'il est installe ;
--    · les Combats : Sections, XP et niveaux, decks, campagnes, combats en
--      cours, defis, Epreuves du Choc, Raid (participations ET degats de la
--      saison : le boss repart avec tous ses PV) ;
--    · les vitrines, cartes fetiches, titres, bannieres ; les avatars qui
--      montraient une carte redeviennent l'etoile ; les cadres reviennent
--      a celui de base ;
--    · la carte unique : la chasse reprend, la carte est de nouveau a
--      trouver.
--
--  CE QUI EST GARDE :
--    · les comptes eux-memes — personne n'a a se reinscrire ;
--    · les pseudos, les devises, les reglages « a garder » par rarete ;
--    · les listes d'amis, les invitations, les annonces ;
--    · les droits d'administrateur ;
--    · le calendrier des evenements, le catalogue, les quetes, la boutique.
--
--  ------------------------------------------------------------------
--  AVANT DE LANCER
--
--  1. Ferme le site au public le temps de l'operation :
--     `PORTE.active = true` dans js/gate.js, puis pousse.
--     Sinon quelqu'un peut ouvrir un booster pendant la remise a zero.
--
--  2. Fais une sauvegarde. Supabase > Database > Backups.
--     Cette requete est IRREVERSIBLE : il n'y a pas de corbeille.
--
--  3. Lis d'abord l'etat actuel avec la requete « AVANT » tout en bas.
--     Elle ne modifie rien et dit exactement ce qui va disparaitre.
--
--  4. Change la confirmation ci-dessous. C'est un garde-fou volontaire :
--     tant que la ligne n'est pas modifiee, la requete refuse de s'executer.
--     On ne joue pas ce fichier par accident en le collant trop vite.
--
--  Second garde-fou : le script refuse aussi de tourner si une table du
--  schema pointe vers `profiles` sans qu'il la connaisse (une table
--  ajoutee depuis). Il faut alors le mettre a jour (README § 9.10).
-- =====================================================================

do $$
declare
  -- <<<<<< REMPLACE PAR : 'OUI JE VEUX TOUT EFFACER'
  confirmation text := 'non';

  -- Toutes les tables qui pointent vers profiles, videes ou gardees.
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
  n_profils int; n_cartes bigint; n_eclats bigint;
begin
  if confirmation is distinct from 'OUI JE VEUX TOUT EFFACER' then
    raise exception
      'Remise a zero annulee. Pour la lancer vraiment, remplace la ligne '
      '`confirmation text := ''non'';` par `:= ''OUI JE VEUX TOUT EFFACER'';` '
      'puis relance. Relis l''en-tete du fichier avant.';
  end if;

  select string_agg(distinct r.relname, ', ') into inconnues
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
   where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
     and n.nspname = 'public' and r.relname <> all (connues);
  if inconnues is not null then
    raise exception 'Remise a zero annulee : ce script ne connait pas %. Mets-le a jour avant de le jouer.', inconnues;
  end if;

  -- Ce qu'on s'apprete a effacer, pour la trace dans les logs.
  select count(*) into n_profils from public.profiles;
  select coalesce(sum(qty), 0) into n_cartes from public.collection;
  select coalesce(sum(shards), 0) into n_eclats from public.profiles;
  raise notice 'Remise a zero : % profils, % exemplaires de cartes, % Eclats.',
    n_profils, n_cartes, n_eclats;

  -- --------------------------------------------------------------- effacer
  -- Aucune de ces tables n'est referencee par une autre : l'ordre ne
  -- compte pas. Les annonces restent : elles s'adressent a tout le monde.
  delete from public.collection;
  delete from public.gardes;
  delete from public.favoris;
  delete from public.maitrises;
  delete from public.maitrises_journal;
  delete from public.recyclages;
  delete from public.tirages;
  delete from public.quest_progress;
  delete from public.inventory;
  delete from public.cadeaux;
  delete from public.notifications;
  delete from public.trades;
  delete from public.evt_comptes;
  delete from public.evt_piste_prises;
  delete from public.devine_illu;
  delete from public.combat_joueurs;
  delete from public.decks;
  delete from public.combats_ouverts;
  delete from public.defis;
  delete from public.choc_joueurs;
  delete from public.choc_epreuves;
  delete from public.raid_participants;
  delete from public.raid_pris;
  delete from public.raid_tentatives;
  -- L'Echauffement (2.1.4) : ses tables n'existent que sur une base qui l'a recu.
  if to_regclass('public.ech_scores') is not null then
    execute 'delete from public.ech_scores';
    execute 'delete from public.ech_essais';
    execute 'delete from public.ech_paliers';
  end if;
  -- Le boss du Raid repart avec tous ses PV : les degats de chaque saison
  -- et les phases abattues s'effacent (raid_saisons se recree tout seul).
  delete from public.raid_tombees;
  delete from public.raid_saisons;
  -- La carte unique est partie avec les collections : la chasse reprend.
  update public.chasse set gagnant = null, trouvee_le = null;

  -- ------------------------------------------------------- remettre a neuf
  -- La reserve repart pleine et le compte a rebours a zero : tout le monde
  -- commence le jour du lancement avec ses boosters a ouvrir.
  --
  -- `frame` revient a 'default' : les cadres viennent d'etre effaces de
  -- l'inventaire, et set_profile() refuserait ensuite un cadre qu'on ne
  -- possede plus — le joueur se retrouverait avec un profil qu'il ne peut
  -- plus modifier. Meme raison pour le titre, la banniere et la fetiche.
  --
  -- `avatar` ne revient a 'star' que s'il pointait vers une carte : une
  -- photo Discord ou un symbole d'essence reste valable.
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
    boite_vue_le    = now();

  raise notice 'Termine. Les comptes, les pseudos, les amis, les invitations et les droits admin sont intacts.';
end $$;

-- =====================================================================
--  AVANT : a lancer seul, pour regarder sans rien casser.
-- =====================================================================
-- select
--   (select count(*) from public.profiles)                       as profils,
--   (select coalesce(sum(qty),0) from public.collection)         as exemplaires,
--   (select coalesce(sum(shards),0) from public.profiles)        as eclats,
--   (select coalesce(sum(fragments),0) from public.profiles)     as fragments,
--   (select count(*) from public.inventory)                      as objets,
--   (select count(*) from public.trades)                         as echanges,
--   (select count(*) from public.combat_joueurs)                 as combattants,
--   (select count(*) from public.decks)                          as decks,
--   (select count(*) from public.maitrises)                      as maitrises,
--   (select coalesce(sum(packs_opened),0) from public.profiles)  as boosters_ouverts;

-- =====================================================================
--  APRES : la verification.
--  Tout doit etre a zero, sauf `profils`, inchange.
-- =====================================================================
-- select
--   (select count(*) from public.collection)                 as lignes_collection,
--   (select count(*) from public.inventory)                  as objets,
--   (select count(*) from public.quest_progress)             as progression_quetes,
--   (select count(*) from public.combat_joueurs)             as combattants,
--   (select count(*) from public.maitrises)                  as maitrises,
--   (select coalesce(sum(shards),0) from public.profiles)    as eclats,
--   (select coalesce(sum(fragments),0) from public.profiles) as fragments,
--   (select count(*) from public.profiles)                   as profils;

-- =====================================================================
--  Et apres ?
--
--  · Les comptes de test gardent leur pseudo : si tu veux en liberer un,
--    change-le a la main dans la table `profiles`.
--
--  · Pour remettre a zero UN SEUL joueur — un tricheur, un bug — c'est
--    supabase/administration/reset-profil.sql, qui ne touche que lui.
--
--  · Pense a rouvrir le site : `PORTE.active = false` dans js/gate.js.
--
--  · Les invitations (table `beta_invites`) ne sont pas touchees : voir
--    supabase/administration/beta.sql pour en retirer.
-- =====================================================================
