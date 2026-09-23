-- =====================================================================
--  Mate TCG Online — REMISE A ZERO GENERALE
--
--  A jouer une seule fois, le jour du vrai lancement, pour effacer la
--  progression de TOUS les comptes ouverts pendant la periode de test.
--
--  ------------------------------------------------------------------
--  CE QUI EST EFFACE, pour tout le monde :
--    · la collection (toutes les cartes, promos comprises)
--    · les Eclats
--    · les jetons d'echange et les cadres achetes
--    · la vitrine du profil
--    · la progression et les recompenses de quetes
--    · les compteurs : boosters ouverts, echanges conclus, serie de jours
--    · les demandes d'echange, y compris celles en attente
--    · la boite de reception de chacun, et le journal du recyclage
--
--  CE QUI EST GARDE :
--    · les comptes eux-memes — personne n'a a se reinscrire
--    · les pseudos, les avatars, les cadres en cours de port
--    · les listes d'amis
--    · les droits d'administrateur
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
--  4. Change le mot de passe ci-dessous. C'est un garde-fou volontaire :
--     tant que la ligne n'est pas modifiee, la requete refuse de s'executer.
--     On ne joue pas ce fichier par accident en le collant trop vite.
-- =====================================================================

do $$
declare
  -- <<<<<< REMPLACE PAR : 'OUI JE VEUX TOUT EFFACER'
  confirmation text := 'non';

  n_profils int; n_cartes bigint; n_eclats bigint;
begin
  if confirmation is distinct from 'OUI JE VEUX TOUT EFFACER' then
    raise exception
      'Remise a zero annulee. Pour la lancer vraiment, remplace la ligne '
      '`confirmation text := ''non'';` par `:= ''OUI JE VEUX TOUT EFFACER'';` '
      'puis relance. Relis l''en-tete du fichier avant.';
  end if;

  -- Ce qu'on s'apprete a effacer, pour la trace dans les logs.
  select count(*) into n_profils from public.profiles;
  select coalesce(sum(qty), 0) into n_cartes from public.collection;
  select coalesce(sum(shards), 0) into n_eclats from public.profiles;
  raise notice 'Remise a zero : % profils, % exemplaires de cartes, % Eclats.',
    n_profils, n_cartes, n_eclats;

  -- --------------------------------------------------------------- effacer
  -- L'ordre n'a pas d'importance ici : aucune de ces tables ne se reference
  -- l'une l'autre. On les vide en entier plutot que ligne a ligne.
  delete from public.collection;
  delete from public.inventory;
  delete from public.quest_progress;
  delete from public.trades;
  -- La boite de reception parle d'echanges qui n'existent plus, et le journal
  -- du recyclage compterait contre le plafond de la semaine du lancement.
  -- Les annonces, elles, restent : elles s'adressent a tout le monde.
  delete from public.notifications;
  delete from public.recyclages;

  -- ------------------------------------------------------- remettre a neuf
  -- La reserve repart pleine et le compte a rebours a zero : tout le monde
  -- commence le jour du lancement avec cinq boosters a ouvrir.
  --
  -- `frame` revient a 'default' : les cadres achetes viennent d'etre effaces
  -- de l'inventaire, et set_profile() refuserait ensuite un cadre qu'on ne
  -- possede plus — le joueur se retrouverait avec un profil qu'il ne peut
  -- plus modifier.
  --
  -- `avatar` ne revient a 'star' que s'il pointait vers une carte : une photo
  -- Discord ou un symbole d'essence reste valable.
  update public.profiles set
    shards        = 0,
    tickets       = cfg('ticket_cap'),
    last_tick     = now(),
    trade_free_at = now(),
    packs_opened  = 0,
    trades_done   = 0,
    streak        = 0,
    last_checkin  = null,
    vitrine       = '{}',
    frame         = 'default',
    avatar        = case when avatar like 'card:%' then 'star' else avatar end;

  raise notice 'Termine. Les comptes, les pseudos, les amis et les droits admin sont intacts.';
end $$;

-- =====================================================================
--  AVANT : a lancer seul, pour regarder sans rien casser.
-- =====================================================================
-- select
--   (select count(*) from public.profiles)                as profils,
--   (select count(*) from public.collection)              as lignes_collection,
--   (select coalesce(sum(qty),0) from public.collection)  as exemplaires,
--   (select coalesce(sum(shards),0) from public.profiles) as eclats,
--   (select count(*) from public.inventory)               as objets,
--   (select count(*) from public.trades)                  as echanges,
--   (select coalesce(sum(packs_opened),0) from public.profiles) as boosters_ouverts;

-- =====================================================================
--  APRES : la verification.
--  Les quatre premieres colonnes doivent etre a zero, `profils` inchange.
-- =====================================================================
-- select
--   (select count(*) from public.collection)              as lignes_collection,
--   (select count(*) from public.inventory)               as objets,
--   (select count(*) from public.quest_progress)          as progression_quetes,
--   (select coalesce(sum(shards),0) from public.profiles) as eclats,
--   (select count(*) from public.profiles)                as profils;

-- =====================================================================
--  Et apres ?
--
--  · Les comptes de test gardent leur pseudo : si tu veux en liberer un,
--    change-le a la main dans la table `profiles`.
--
--  · Pour remettre a zero UN SEUL joueur — un tricheur, un bug — c'est
--    supabase/08_reset-profil.sql, qui ne touche que lui.
--
--  · Pense a rouvrir le site : `PORTE.active = false` dans js/gate.js.
--
--  · Les invitations (table `beta_invites`) ne sont pas touchees : voir
--    supabase/09_beta.sql pour en retirer.
-- =====================================================================
