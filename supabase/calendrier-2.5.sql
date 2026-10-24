-- =====================================================================
--  Mate TCG Online — le calendrier de la 2.5, fin octobre 2026 (dates)
--  Apres 22d_admin.sql. Pas dans TOUT.sql : ce sont des dates. Rejouable :
--  il pose toujours les memes.
--
--   · Reflets se termine le vendredi 23 octobre a minuit ;
--   · son recap reste jusqu'au dimanche 25 octobre a minuit ;
--   · a cette minute-la (lundi 26, 0 h) sort la 2.5 :
--       - L'Echauffement commence, et dure neuf jours : un defi de plus
--         chaque jour jusqu'au dimanche 1er novembre, puis deux jours pour
--         rattraper (fin le mercredi 4 novembre, 0 h) ;
--       - les Reverses se recyclent et se fabriquent (22c_reverses.sql), et
--         plus d'ouverture a la main (fabrication_reverse) ;
--       - le site lui-meme bascule (parametres.sorties ; la meme minute est
--         ecrite dans le code, SORTIE dans js/config.js).
--   · L'Echauffement est aussi un evenement (22e_echauffement-evenement.sql) :
--     sa ligne `evenements` suit la saison toute seule (un declencheur), et
--     son recap court trois jours de plus, jusqu'au samedi 7 novembre, 0 h ;
--   · a la fin de la saison (mercredi 4 novembre, 0 h) commence le mode sans
--     fin (22f_sans-fin.sql) : un defi par jour, sans date de fin.
--
--  Les dates elles-memes sont dans calendrier_officiel() (22d_admin.sql),
--  leur seule copie cote serveur : le Labo (« Calendrier officiel ») et ce
--  fichier passent par elle.
--
--  Heure de Paris. Le changement d'heure tombe dans la nuit du samedi 24 au
--  dimanche 25 : vendredi minuit est en heure d'ete (+02), dimanche minuit en
--  heure d'hiver (+01).
--
--  Historique : la vraie base a recu ce calendrier le jeudi 22 octobre 2026
--  (sous le nom calendrier-2.1.4.sql, les Reverses alors au vendredi
--  minuit), puis les Reverses ont ete reportees a la sortie de la 2.5 le
--  vendredi 23 octobre, avant leur ouverture.
-- =====================================================================

select public.calendrier_officiel_poser();

-- Pour verifier (heure de Paris) :
select code, fin at time zone 'Europe/Paris' as fin_paris, recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'reflets';
select debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris from public.ech_saison;
select code, debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris,
       recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'echauffement';
select reverses_des at time zone 'Europe/Paris' as reverses_paris, reverses_ouvertes() as ouvertes,
       fabrication_reverse, sorties from public.parametres;
