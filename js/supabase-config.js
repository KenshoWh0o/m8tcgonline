/* Branchement du compte en ligne.
   Tant que ces deux valeurs restent vides, le jeu tourne en mode hors ligne :
   la progression reste dans le navigateur, et les onglets qui ont besoin des
   autres joueurs (Échanges, Quêtes, Boutique) invitent à se connecter.

   Où trouver ces valeurs : Supabase › le projet › Settings › API.

   La clé publique est faite pour être publique : elle n'ouvre que ce que les
   règles de supabase/01_schema.sql autorisent. Selon l'âge du projet, elle
   s'appelle « Publishable key » (sb_publishable_…) ou « anon public » (eyJ…) :
   les deux se collent ici de la même façon.

   Ne JAMAIS coller ici la clé secrète — « Secret key » (sb_secret_…) ou
   « service_role » (eyJ…) : elle contourne toutes les sécurités, et ce fichier
   part en ligne avec le site.

   Marche à suivre complète : SETUP.md */
"use strict";

const SUPABASE_URL = 'https://zgapvgvrwkwgrdpvownj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6cdkmaseOH_BJBl9s2LAiA_ndrZ1DrS';
