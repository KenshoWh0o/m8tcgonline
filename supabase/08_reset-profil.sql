-- =====================================================================
--  Mate TCG Online — remettre un profil a zero
--
--  A coller dans Supabase > SQL Editor. Change le pseudo ligne 20, puis Run.
--  N'affecte QUE ce profil : les autres joueurs ne bougent pas.
--
--  Ce qui est efface : collection, Eclats, jetons, cadres achetes, vitrine,
--  progression des quetes, compteurs, serie de connexion, demandes d'echange
--  en attente.
--  Ce qui est garde : le compte lui-meme, le pseudo, l'avatar, le cadre en
--  cours, les amis, et les droits d'administrateur.
--
--  Irreversible. La requete du bas montre l'etat avant, si tu veux regarder
--  d'abord.
-- =====================================================================

do $$
declare
  cible text := 'kenshowho';   -- <<<<<< LE PSEUDO A REMETTRE A ZERO
  uid uuid;
begin
  select id into uid from public.profiles where lower(pseudo) = lower(cible);
  if uid is null then
    raise exception 'Aucun profil ne porte le pseudo %', cible;
  end if;

  delete from public.collection     where user_id = uid;
  delete from public.quest_progress where user_id = uid;
  delete from public.inventory      where user_id = uid;

  -- Les demandes d'echange en cours n'ont plus d'objet sans collection.
  update public.trades set status = 'cancelled', resolved_at = now()
   where status = 'pending' and (from_user = uid or to_user = uid);

  update public.profiles set
    shards        = 0,
    tickets       = public.cfg('ticket_cap'),
    last_tick     = now(),
    trade_free_at = now(),
    packs_opened  = 0,
    trades_done   = 0,
    streak        = 0,
    last_checkin  = null,
    vitrine       = '{}',
    frame         = 'default'
  where id = uid;

  raise notice 'Profil % remis a zero.', cible;
end $$;

-- Verification : le profil doit afficher 0 partout, et 0 carte.
select p.pseudo, p.tickets, p.shards, p.packs_opened, p.trades_done, p.streak,
       p.is_admin, coalesce(count(c.card_id), 0) as cartes
  from public.profiles p
  left join public.collection c on c.user_id = p.id and c.qty > 0
 where lower(p.pseudo) = lower('kenshowho')   -- <<<<<< le meme pseudo
 group by p.id;
