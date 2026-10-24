-- =====================================================================
--  Mate TCG Online — les Reverses se recyclent et se fabriquent.
--  Reporte de la 2.5 (branche version-2.5, supabase/22c_reverses.sql) :
--  meme fichier, a garder identique a partir de « LE PRIX ». A executer
--  apres 22_garder.sql. Rejouable sans danger.
--
--  Fermes depuis la 2.0 (21_reflets.sql : parametres.fabrication_reverse),
--  le recyclage et la fabrication des Reverses ouvrent avec la 2.5.
--
--   1. L'ouverture est datee : parametres.reverses_des. Passe cet instant,
--      recycler et fabriquer (12_recyclage.sql) acceptent les Reverses, et
--      me() (07_vitrine.sql) le dit au navigateur, qui bascule tout seul.
--      Sur la vraie base, la 2.5 l'a posee au lundi 26 octobre 2026, 0 h,
--      heure de Paris : quand la 3.0 sortira, elles seront deja ouvertes et
--      la date reste. Vide (une installation neuve de la 3.0) : ferme.
--      `fabrication_reverse = true` ouvre tout de suite, comme avant.
--
--   2. Le prix n'est plus le double d'une classique, mais celui de leur
--      vraie rarete (prix_reverse, plus bas).
--
--  me() envoie `parametres.reverses` (ouvertes, date, prix), et plus
--  `parametres.fabrication_reverse`.
--
--  ------------------------------------------------------------------
--  LE PRIX
--
--  Ce qu'on attend d'une carte precise, en boosters (un booster : deux
--  Communes, une Peu commune, une Essence, une Reverse, un hit) :
--      classiques   Commune 16,5 · Peu commune 24 · Rare 35 · Epique 112
--                   Legendaire 250
--      Reverses     Commune 66 · Peu commune 69 · Rare 187
--  Une Reverse Commune est plus rare qu'une Rare classique ; une Reverse
--  Rare, plus rare qu'une Epique. Le double (80, 200, 800) les vendait
--  moins cher que des cartes deux fois plus faciles a tirer.
--
--  Deux regles :
--    · jamais moins cher qu'une classique plus facile a tirer : Commune et
--      Peu commune reverses au moins 400 (une Rare), Rare reverse au moins
--      2 000 (une Epique) ; et l'ordre des raretes respecte ;
--    · le meme effet que la fabrication des classiques sur la fin de
--      collection : -33 % sur la mediane, -41 % sur le quart le plus lent
--      (cfg() de 01_schema.sql, en-tete de 12_recyclage.sql).
--
--  Simulation (python3 tools/equilibre-reverses.py : 600 joueurs par
--  ligne, presents depuis l'ouverture du 24 septembre ; Reverses en booster
--  depuis la 2.0 ; ouvertes le 24 octobre ; doublons recycles chaque soir ;
--  classiques fabriquees d'abord), date des 85 Reverses, mediane (quart le
--  plus lent) :
--                              sans fabrication      400 / 500 / 2 400
--      regulier (6 par jour)    30 janvier (23 fevrier)  25 decembre (5 janvier)
--      occasionnel (4 par jour,  5 juin (8 aout)         28 mars (18 avril)
--        5 jours sur 7)
--  Gain compte depuis l'ouverture : -37 % / -40 % pour le regulier,
--  -31 % / -39 % pour l'occasionnel ; en moyenne, celui des classiques.
--  A titre de comparaison : le double faisait gagner -46 % / -49 % et
--  finissait les Reverses cinq jours apres les 122 ; ces prix, deux semaines
--  apres (quatre pour l'occasionnel) — les Fragments gardent un usage une
--  fois l'extension complete. Au prix de leur rarete exacte (1 000 / 1 000 /
--  4 800), le gain tombait a -24 % / -31 %.
--  Le revers : un joueur qui met ses Fragments dans les Reverses avant
--  d'avoir les 122 finit l'extension environ trois semaines plus tard
--  (jour 98 au lieu de 78 ; au double, 83). La fiche de fabrication d'une Reverse le
--  rappelle (js/recyclage.js).
--  Pas d'avalanche : il faut 92 400 Fragments pour les 85 (29 840 au
--  double) ; un joueur qui en aurait garde 16 000 sans jamais rien fabriquer
--  comble le premier soir entre le tiers et la moitie de ce qui lui manque,
--  selon le nombre de boosters qu'il a ouverts.
--
--  Le recyclage ne change pas : une Reverse rapporte comme sa classique
--  (2, 5, 20). L'aligner sur ces prix (un vingtieme, comme les classiques :
--  20, 25, 120) donnerait +57 % de Fragments a un joueur avance et
--  raccourcirait d'un tiers la fabrication des classiques ; et un
--  doublon de Reverse garde sa valeur d'echange (contre une Reverse).
--
--  Ce que la simulation ignore : les echanges, les boosters achetes ou
--  offerts, les godpacks, les Reverses du Pass et de la boutique de Reflets.
-- =====================================================================

alter table public.parametres add column if not exists reverses_des timestamptz;

-- Ouvert a la main, ou passe la date.
create or replace function public.reverses_ouvertes() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select fabrication_reverse or coalesce(now() >= reverses_des, false)
                     from parametres where id = 1), false);
$$;

-- Fabriquer une Reverse, en Fragments (le calcul est en tete du fichier).
-- A garder egal a REV_DEFAUT (js/recyclage.js, l'affichage hors ligne) et a
-- prixReverse (_demo/serveur.js).
create or replace function public.prix_reverse(p_rar text) returns integer
language sql immutable as $$
  select case p_rar when 'C' then 400 when 'PC' then 500 when 'R' then 2400 end;
$$;

revoke all on function public.reverses_ouvertes, public.prix_reverse from public, anon, authenticated;

-- Pour verifier :
--   select reverses_ouvertes(), reverses_des at time zone 'Europe/Paris' from public.parametres;
-- Ouvrir tout de suite :
--   update public.parametres set fabrication_reverse = true where id = 1;
-- Deplacer l'ouverture :
--   update public.parametres set reverses_des = timestamptz '2026-10-24 00:00:00+02' where id = 1;
