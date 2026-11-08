/* Branchement du compte en ligne.
   Ces deux valeurs sont indispensables : il n'y a plus de jeu hors ligne.
   Vides, le jeu ne trouve pas de serveur et bascule en mode local
   (Backend.loadLocal), que l'écran d'entrée ne laisse pas passer tant que
   PORTE.active vaut true (js/gate.js) : on reste devant l'écran d'attente.
   Le mode local n'existe plus que dans le code. Dans la pré-prod,
   tools/demo.py remplace ce fichier : le faux serveur répond à la place.

   Où trouver ces valeurs : Supabase › le projet › Settings › API.

   La clé publique est faite pour être publique : elle n'ouvre que ce que les
   règles de supabase/installation/01_schema.sql autorisent. Selon l'âge du projet, elle
   s'appelle « Publishable key » (sb_publishable_…) ou « anon public » (eyJ…) :
   les deux se collent ici de la même façon.

   Ne JAMAIS coller ici la clé secrète — « Secret key » (sb_secret_…) ou
   « service_role » (eyJ…) : elle contourne toutes les sécurités, et ce fichier
   part en ligne avec le site.

   Marche à suivre complète : SETUP.md */
"use strict";

const SUPABASE_URL = 'https://zgapvgvrwkwgrdpvownj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6cdkmaseOH_BJBl9s2LAiA_ndrZ1DrS';
