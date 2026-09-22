-- =====================================================================
--  Mate TCG Online — la beta fermee
--
--  A jouer APRES 01_schema.sql, qui cree la table et pose le controle.
--  Ce fichier-ci est un outil : on y revient pour inviter, retirer, ou
--  regarder qui est entre. Rien ici n'est joue a l'installation.
--
--  ------------------------------------------------------------------
--  POURQUOI CETTE TABLE EXISTE
--
--  L'ecran d'attente (js/gate.js) n'est pas une serrure. Il vit dans le
--  navigateur : son empreinte est ecrite en clair dans la page, et deux
--  lignes dans la console suffisent a passer derriere. Il n'a jamais
--  pretendu faire autre chose — son en-tete le dit depuis le premier jour.
--  Il ecarte les curieux, il n'arrete pas quelqu'un de decide.
--
--  La serrure, c'est cette table. Tant que cfg('beta_fermee') vaut 1, une
--  inscription est refusee a qui ne figure pas dedans, et le refus tombe
--  cote serveur : il ne se contourne pas depuis le navigateur.
--
--  Ce que ca ne change pas : les comptes DEJA crees. Le controle ne
--  s'applique qu'a la creation. Pour un compte de trop, voir plus bas.
-- =====================================================================


-- =====================================================================
--  1. QUI EST DEJA ENTRE
--  A lancer en premier : c'est l'etat des lieux.
-- =====================================================================
select p.pseudo,
       u.email,
       u.raw_user_meta_data->>'provider_id'          as discord_id,
       u.raw_user_meta_data->>'global_name'          as discord_nom,
       p.created_at                                  as inscrit_le,
       p.packs_opened                                as boosters,
       p.shards                                      as eclats,
       p.is_admin,
       exists (select 1 from public.beta_invites b
                where lower(b.cle) = lower(coalesce(u.email, ''))
                   or b.cle = coalesce(u.raw_user_meta_data->>'provider_id', ''))
                                                     as invite
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.created_at desc;


-- =====================================================================
--  2. INVITER
--
--  La cle est une adresse e-mail OU un identifiant Discord — selon ce
--  qu'on connait de la personne. Les deux fonctionnent, l'un suffit.
--
--  Trouver un identifiant Discord : dans Discord, Parametres > Avances >
--  Mode developpeur, puis clic droit sur la personne > Copier l'identifiant.
-- =====================================================================
insert into public.beta_invites (cle, note) values
  ('quelquun@exemple.com', 'testeur — ami'),
  ('123456789012345678',   'testeur — Discord')
on conflict (cle) do update set note = excluded.note;


-- =====================================================================
--  3. INVITER TOUT LE MONDE CE QUI EST DEJA LA
--
--  Pratique juste apres avoir ferme la beta : les comptes deja crees
--  entrent dans la liste, pour que personne ne se retrouve dehors si on
--  doit un jour recreer un compte. A ne PAS lancer si on veut justement
--  faire le tri.
-- =====================================================================
-- insert into public.beta_invites (cle, note)
-- select coalesce(nullif(u.email, ''), u.raw_user_meta_data->>'provider_id'),
--        'testeur de la premiere heure'
--   from auth.users u
--  where coalesce(nullif(u.email, ''), u.raw_user_meta_data->>'provider_id') is not null
-- on conflict (cle) do nothing;


-- =====================================================================
--  4. RETIRER UNE INVITATION
--  Le compte deja cree, lui, continue d'exister : voir le point 5.
-- =====================================================================
-- delete from public.beta_invites where lower(cle) = lower('quelquun@exemple.com');


-- =====================================================================
--  5. UN COMPTE DE TROP
--
--  Deux gestes, du plus doux au plus definitif.
--
--  a) Le vider sans le supprimer : la personne garde son compte mais
--     repart de zero. C'est supabase/08_reset-profil.sql.
--
--  b) Le supprimer pour de bon. Irreversible : la collection, les Eclats,
--     les echanges et les amities partent avec (tout est en cascade sur
--     auth.users). Le pseudo redevient libre.
-- =====================================================================
-- delete from auth.users where lower(email) = lower('quelquun@exemple.com');
-- delete from auth.users where raw_user_meta_data->>'provider_id' = '123456789012345678';


-- =====================================================================
--  6. LE JOUR DE L'OUVERTURE AU PUBLIC
--
--  Une seule valeur a changer, dans supabase/01_schema.sql :
--      when 'beta_fermee'       then 1     -->   then 0
--  puis rejouer ce fichier-la (il est rejouable sans danger).
--
--  La table `beta_invites` peut rester : elle ne sert simplement plus a
--  rien tant que l'interrupteur est a 0.
-- =====================================================================
-- select cfg('beta_fermee') as beta_fermee;
