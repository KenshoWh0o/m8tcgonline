/* Branchement du compte en ligne.
   Tant que ces deux valeurs restent vides, le jeu tourne en mode hors ligne :
   la progression reste dans le navigateur, et les onglets qui ont besoin des
   autres joueurs (Échanges, Quêtes, Boutique) invitent à se connecter.

   Où trouver ces valeurs : Supabase › ton projet › Settings › API.
   La clé « anon » est faite pour être publique : elle n'ouvre que ce que les
   règles de supabase/01_schema.sql autorisent. Ne jamais coller ici la clé
   « service_role », qui contourne toutes les sécurités.

   Marche à suivre complète : SETUP.md */
"use strict";

const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
