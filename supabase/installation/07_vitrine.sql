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
-- c'est donc ici que se pose l'appel a check_promos (supabase/installation/03b_promos.sql).
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
    -- La pastille de la boite de reception (supabase/installation/11_boite.sql).
    'boite', boite_non_lues(p),
    -- Le recyclage et la fabrication (supabase/installation/12_recyclage.sql) : ce que
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
    -- cours, et les invitations achetees. Les Reverses (reportees de la 2.5,
    -- 22c_reverses.sql) : ouvertes ou non, a partir de quand, et leur prix.
    'parametres', jsonb_build_object('reverses', jsonb_build_object(
      'ouvertes', reverses_ouvertes(),
      'des', (select reverses_des from parametres where id = 1),
      'couts', jsonb_build_object('C', prix_reverse('C'), 'PC', prix_reverse('PC'), 'R', prix_reverse('R')))),
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
    -- Version 3.0 : l'etat des Combats (combat_etat, 23_combats.sql).
    'combat', combat_etat(p),
    -- Version 3.0.7 : les cartes maitrisees et la carte fetiche
    -- (maitrise_etat, 28_maitrise.sql).
    'maitrise', maitrise_etat(p),
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
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int; rev int; rev_total int; sec int;
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
  -- Version 3.0.11 : ses Secretes, que la fiche compte au-dela du total
  -- (« 127 / 122 », comme la Collection).
  select count(*) into sec
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and k.secrete;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'reverses', rev, 'reverses_total', rev_total, 'secretes', sec,
    'titre', o.titre, 'banniere', o.banniere, 'devise', o.devise,
    'vitrine', to_jsonb(o.vitrine),
    -- Version 3.0 : son XP de combattant (26_niveaux.sql), pour le niveau
    -- pose sur l'avatar ; la page le calcule, comme pour me().
    'xp', xp_de(o.id),
    -- Version 3.0.7 : sa carte fetiche et sa maitrise (fetiche_de,
    -- 28_maitrise.sql) ; rien s'il n'en a pas, ou plus.
    'fetiche', fetiche_de(o.id),
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
