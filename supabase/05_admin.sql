-- =====================================================================
--  Mate TCG Online — se donner les droits d'administrateur
--  L'onglet Labo n'apparait que pour les profils marques is_admin.
--  Ce drapeau ne peut etre pose que d'ici : aucune fonction du jeu ne
--  l'expose, et le navigateur n'a pas le droit d'ecrire dans profiles.
--
--  Remplace l'adresse ci-dessous par la tienne, puis execute.
-- =====================================================================

update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('ton.adresse@exemple.com');

-- Verification : la liste des admins.
select p.pseudo, u.email, p.is_admin
  from public.profiles p join auth.users u on u.id = p.id
 where p.is_admin;

-- Pour retirer les droits a quelqu'un :
-- update public.profiles set is_admin = false where lower(pseudo) = lower('SonPseudo');
