/* Réglages de la démo — le seul fichier à retoucher à la main.
   Ils ne s'appliquent qu'à une démo neuve : pour repartir de zéro avec de
   nouveaux réglages, ouvrir la démo avec ?reinitialiser à la fin de
   l'adresse (voir LISEZMOI.txt). */
"use strict";

const DEMO_REGLAGES = {
  /* Le pseudo de départ. Il se change ensuite dans le Profil, comme en vrai. */
  pseudo: 'Visiteur',
  /* Les Éclats offerts au départ, pour essayer la boutique sans attendre. */
  eclats: 6000,
  /* Un booster se recharge toutes les… (en minutes). 240 dans le vrai jeu. */
  ticket_minutes: 240
};
