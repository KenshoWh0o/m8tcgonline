-- =====================================================================
--  Mate TCG Online — le calendrier de la 2.5, fin octobre 2026 (dates)
--  Apres 22b_echauffement.sql et 22c_reverses.sql. Pas dans TOUT.sql : ce
--  sont des dates. Rejouable : il pose toujours les memes.
--
--   · Reflets se termine le vendredi 23 octobre a minuit ;
--   · son recap reste jusqu'au dimanche 25 octobre a minuit ;
--   · a cette minute-la (lundi 26, 0 h) sort la 2.5 :
--       - L'Echauffement commence, et dure neuf jours : un defi de plus
--         chaque jour jusqu'au dimanche 1er novembre, puis deux jours pour
--         rattraper (fin le mercredi 4 novembre, 0 h) ;
--       - les Reverses se recyclent et se fabriquent (22c_reverses.sql) ;
--       - le site lui-meme bascule (parametres.sorties, 22d_admin.sql ; la
--         meme minute est ecrite dans le code, SORTIE dans js/config.js).
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

update public.evenements
   set fin = timestamptz '2026-10-24 00:00:00+02',
       recap_jusqua = timestamptz '2026-10-26 00:00:00+01'
 where code = 'reflets';

insert into public.ech_saison (id, debut, fin)
values (1, timestamptz '2026-10-26 00:00:00+01', timestamptz '2026-11-04 00:00:00+01')
on conflict (id) do update set debut = excluded.debut, fin = excluded.fin;

update public.parametres set reverses_des = timestamptz '2026-10-26 00:00:00+01' where id = 1;

-- La sortie du site 2.5 (22d_admin.sql), la meme minute que SORTIE.le
-- dans js/config.js.
update public.parametres
   set sorties = sorties || jsonb_build_object('2.5', timestamptz '2026-10-26 00:00:00+01')
 where id = 1;

-- Pour verifier (heure de Paris) :
select code, fin at time zone 'Europe/Paris' as fin_paris, recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'reflets';
select debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris from public.ech_saison;
select reverses_des at time zone 'Europe/Paris' as reverses_paris, reverses_ouvertes() as ouvertes,
       sorties from public.parametres;
