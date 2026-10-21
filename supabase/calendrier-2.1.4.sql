-- =====================================================================
--  Mate TCG Online — le calendrier de fin octobre 2026 (a jouer une fois)
--  Apres 22b_echauffement.sql. Pas dans TOUT.sql : ce sont des dates.
--
--   · Reflets se termine le vendredi 23 octobre a minuit (et non plus a midi) ;
--   · son recap reste jusqu'au dimanche 25 octobre a minuit ;
--   · L'Echauffement commence a cette minute-la (lundi 26, 0 h), et dure neuf
--     jours : un defi de plus chaque jour jusqu'au dimanche 1er novembre,
--     puis deux jours pour rattraper (fin le mercredi 4 novembre, 0 h).
--
--  Heure de Paris. Le changement d'heure tombe dans la nuit du samedi 24 au
--  dimanche 25 : vendredi minuit est en heure d'ete (+02), dimanche minuit en
--  heure d'hiver (+01).
--
--  A jouer AVANT vendredi midi : passe midi, Reflets serait deja fini (le
--  rejouer apres le rouvrirait jusqu'a minuit, sans rien perdre).
-- =====================================================================

update public.evenements
   set fin = timestamptz '2026-10-24 00:00:00+02',
       recap_jusqua = timestamptz '2026-10-26 00:00:00+01'
 where code = 'reflets';

insert into public.ech_saison (id, debut, fin)
values (1, timestamptz '2026-10-26 00:00:00+01', timestamptz '2026-11-04 00:00:00+01')
on conflict (id) do update set debut = excluded.debut, fin = excluded.fin;

-- Pour verifier (heure de Paris) :
select code, fin at time zone 'Europe/Paris' as fin_paris, recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'reflets';
select debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris from public.ech_saison;
