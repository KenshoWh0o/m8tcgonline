-- =====================================================================
--  Mate TCG Online — version 2.5 : le Labo refait, et la date de sortie
--  d'une version. A executer apres 22c_reverses.sql. Rejouable sans danger.
--
--  LA DATE DE SORTIE
--  Le site peut etre en ligne avant sa sortie (SORTIE, js/config.js) : il
--  se montre tel qu'avant, puis bascule a la minute dite. Cette minute est
--  ecrite dans le code ; si parametres.sorties en donne une pour la version
--  (cle : son numero, valeur : l'instant, ou null pour « deja sortie »),
--  c'est celle du serveur qui compte. me() l'envoie (07_vitrine.sql), et le
--  Labo la deplace avec le reste du calendrier.
-- =====================================================================

alter table public.parametres add column if not exists sorties jsonb not null default '{}'::jsonb;
