/* Réglages de la démo — le seul fichier à retoucher à la main.
   Ils ne s'appliquent qu'à une démo neuve : pour repartir de zéro avec de
   nouveaux réglages, ouvrir la démo avec ?reinitialiser à la fin de
   l'adresse. */
"use strict";

const DEMO_REGLAGES = {
  /* Le pseudo de départ. Il se change ensuite dans le Profil, comme en vrai. */
  pseudo: 'Visiteur',
  /* Les Éclats offerts au départ, pour essayer la boutique sans attendre. */
  eclats: 6000,
  /* Un booster se recharge toutes les… (en minutes). 240 dans le vrai jeu. */
  ticket_minutes: 240,
  /* Version 3.0 : la barre de vie du Raid (Le Choc des Sections), à
     l'échelle d'une démo où l'on joue presque seul. 1 = celle du vrai jeu
     (js/combat/choc-data.js) ; 0,25 = quatre fois plus courte. */
  raid_echelle: 0.25
};
