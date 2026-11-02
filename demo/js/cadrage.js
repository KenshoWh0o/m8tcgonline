/* Le cadrage de l'app installée (lancée depuis l'écran d'accueil).

   Au premier lancement, sur téléphone, la page pouvait mesurer `100dvh` plus
   haut que l'écran : la barre du bas sortait de l'écran, et il fallait
   relancer l'app pour que ça se remette. Dans l'app installée, on pose donc
   la hauteur nous-mêmes — celle de la fenêtre, jamais plus que l'écran — et
   on la remesure quand elle change (rotation, retour au premier plan) et
   dans les secondes qui suivent le lancement. Dans un navigateur, rien ne
   change : la page garde `100dvh` (css/tokens.css, `html.cadre-app`).
   Chargé en tête de page, avant tout le reste. */
"use strict";
(function () {
  const enApp = matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
  if (!enApp) return;
  const racine = document.documentElement;
  function mesurer() {
    let h = window.innerHeight;
    const debout = window.innerHeight >= window.innerWidth;
    const ecran = debout ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    if (ecran && h > ecran) h = ecran;
    if (!(h > 0)) return;
    racine.style.setProperty('--app-h', h + 'px');
    racine.classList.add('cadre-app');
  }
  mesurer();
  addEventListener('resize', mesurer);
  addEventListener('orientationchange', () => setTimeout(mesurer, 250));
  addEventListener('pageshow', mesurer);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(mesurer, 120); });
  [80, 350, 1000, 2500].forEach(t => setTimeout(mesurer, t));
})();
