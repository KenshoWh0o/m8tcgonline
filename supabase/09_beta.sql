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
--  navigateur, et quelqu'un qui sait ouvrir la console finit toujours par
--  passer derriere un ecran. Il ecarte les curieux — y compris ceux qui
--  avancent la date de leur telephone, depuis qu'il demande l'heure au
--  serveur — mais il n'arrete pas quelqu'un de decide.
--
--  La serrure, c'est cette table. Jusqu'a l'heure d'ouverture fixee dans
--  beta_ouverte() (supabase/01_schema.sql), AUCUNE action du jeu n'aboutit
--  pour qui ne figure pas dedans : ni ouvrir un booster, ni consulter un
--  profil, ni meme creer un compte. Le refus tombe cote serveur, il ne se
--  contourne pas depuis le navigateur.
--
--  Les comptes DEJA crees sont concernes eux aussi : le controle est pose a
--  l'entree de chaque action (garde_beta), pas seulement a l'inscription.
--  Retirer une invitation suffit donc a fermer la porte a quelqu'un ; pour
--  effacer aussi ce qu'il a accumule, voir le point 5.
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
--  6. L'OUVERTURE AU PUBLIC
--
--  Elle est datee, et elle se fait toute seule : le 24 septembre 2026 a
--  18 h, beta_ouverte() bascule et le serveur repond a tout le monde. Rien
--  a rejouer, rien a pousser ce soir-la.
--
--  Pour avancer ou reculer la date : beta_lancement() dans
--  supabase/01_schema.sql, puis rejouer TOUT.sql. C'est le seul endroit :
--  l'ecran d'attente la demande au serveur (porte()), avec l'heure du
--  serveur. Rien a pousser sur le site.
--
--  La table `beta_invites` peut rester : passe la date, elle n'est plus
--  consultee du tout.
-- =====================================================================
-- select porte();
