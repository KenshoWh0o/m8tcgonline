-- =====================================================================
--  Mate TCG Online — le classement
--  A executer apres 12_recyclage.sql. Rejouable sans danger.
--
--  Un classement global : tous les joueurs, pas seulement les amis. Quatre
--  criteres, un seul appel par critere :
--    · collection : cartes differentes de l'extension (Promos exclues, comme
--                   partout ailleurs : le total reste 122) ;
--    · boosters   : boosters ouverts depuis le debut ;
--    · echanges   : echanges conclus ;
--    · serie      : jours de connexion d'affilee, en cours. Une serie dont le
--                   dernier jour est avant-hier ou plus ancien est rompue : elle
--                   compte zero, meme si le chiffre dort encore dans le profil.
--
--  Ce qui est montre d'un joueur ne va pas au-dela de ce que le jeu montrait
--  deja a n'importe qui (find_player, player_profile) : pseudo, avatar, cadre,
--  et le chiffre du critere. Jamais les Eclats, jamais le drapeau admin.
--
--  Tant que le jeu est ferme au public, seuls les comptes invites sont
--  classes : un compte cree pendant une ouverture, puis ferme, ne peut plus
--  jouer, il n'a rien a faire dans la liste.
--
--  Les ex aequo partagent leur rang (rank()) : deux joueurs a 87 cartes sont
--  tous les deux 3e, et le suivant est 5e. Un joueur a zero n'est pas classe.
-- =====================================================================

create or replace function public.classement(p_critere text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  moi uuid := auth.uid();
  auj date := (now() at time zone 'Europe/Paris')::date;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  if p_critere is null or p_critere not in ('collection', 'reverses', 'boosters', 'echanges', 'serie') then
    raise exception 'Classement inconnu.';
  end if;

  return (
    with valeurs as (
      select pr.id, pr.pseudo, pr.avatar, pr.frame, pr.titre,
             (case p_critere
                when 'collection' then (select count(*) from collection c join cards k on k.id = c.card_id
                                         where c.user_id = pr.id and c.qty > 0 and not k.promo)
                -- Version 2.0 : les Reverses differentes.
                when 'reverses'   then (select count(*) from collection c join cards k on k.id = c.card_id
                                         where c.user_id = pr.id and c.qty > 0 and k.reverse)
                when 'boosters'   then pr.packs_opened
                when 'echanges'   then pr.trades_done
                else case when pr.last_checkin >= auj - 1 then pr.streak else 0 end
              end)::int as valeur
        from profiles pr
       where beta_ouverte() or est_invite(pr.id)
    ),
    classes as (
      select v.*,
             rank()       over (order by v.valeur desc)                   as rang,
             row_number() over (order by v.valeur desc, lower(v.pseudo))  as n
        from valeurs v
       where v.valeur > 0
    )
    select jsonb_build_object(
      'critere', p_critere,
      'classes', (select count(*) from classes),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rang', c.rang, 'pseudo', c.pseudo, 'avatar', c.avatar, 'frame', c.frame, 'titre', c.titre,
                 'photo', photo_discord(c.id), 'valeur', c.valeur, 'moi', c.id = moi)
               order by c.n)
          from classes c where c.n <= 50), '[]'::jsonb),
      -- Sa propre ligne, meme hors des cinquante premiers : on veut savoir ou
      -- l'on en est, pas seulement qui est devant.
      'moi', (select jsonb_build_object(
                'rang', c.rang, 'pseudo', c.pseudo, 'avatar', c.avatar, 'frame', c.frame, 'titre', c.titre,
                'photo', photo_discord(c.id), 'valeur', c.valeur, 'moi', true)
                from classes c where c.id = moi))
  );
end $$;

revoke all on function public.classement from public, anon;
grant execute on function public.classement to authenticated;
