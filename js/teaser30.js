/* Le teaser de la version 3.0, dans l'onglet Combats (qui n'a rien d'autre à
   montrer d'ici là).

   Il annonce la refonte visuelle sans rien en montrer : ni capture, ni
   couleur, ni fonctionnalité. Un croquis d'écran se dessine trait par trait
   — des formes que n'importe quelle appli pourrait avoir, aux couleurs du
   site d'aujourd'hui — puis s'efface et recommence. Quelques phrases, et un
   seul lien, implicite, avec les vraies cartes : « quand tu auras les cartes
   en main ».

   Une pastille sur l'onglet Combats tant qu'on ne l'a pas ouvert (une fois
   par appareil). Rien ne passe par le serveur. */
"use strict";

/* Changer cette clé fait revenir la pastille chez tout le monde. */
const TEASER30_CLE = 'refonte';

/* ---------- La pastille ---------- */
function teaser30Nouveau() {
  if (Backend.mode !== 'cloud' || !save) return false;
  return accueilMemoire().teaser30 !== TEASER30_CLE;
}
function teaser30Vu() {
  if (teaser30Nouveau()) accueilNoter({ teaser30: TEASER30_CLE });
}

/* ---------- Le croquis ---------- */
/* Chaque trait a une longueur normalisée (pathLength="1") et son rang dans
   l'ordre du dessin (--i). */
function croquis30() {
  const traits = [
    'M30 12h100a18 18 0 0 1 18 18v260a18 18 0 0 1-18 18H30a18 18 0 0 1-18-18V30a18 18 0 0 1 18-18Z',
    'M28 44h104',
    'M30 30h26', 'M104 30h26',
    'M52 66h56a8 8 0 0 1 8 8v96a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8V74a8 8 0 0 1 8-8Z',
    'M58 92l44 52M102 92l-44 52',
    'M46 196h68',
    'M40 214h80a10 10 0 0 1 0 20H40a10 10 0 0 1 0-20Z',
    'M28 268h104',
    'M40 284h10', 'M66 284h10', 'M92 284h10', 'M118 284h4'
  ];
  return `<svg class="t30-croquis" viewBox="0 0 160 320" aria-hidden="true">
    ${traits.map((d, i) => `<path d="${d}" pathLength="1" style="--i:${i}"/>`).join('')}
  </svg>`;
}

/* ---------- La page ---------- */
function vTeaser30() {
  return `<section class="t30">
    <div class="t30-art">${croquis30()}</div>
    <div class="t30-txt">
      <span class="t30-kick">Version 3.0</span>
      <h2 class="t30-titre">Le jeu se redessine.</h2>
      <p>Chaque écran est repris de zéro. On ne te montre rien : tu découvriras tout d'un coup.</p>
      <p>Et cet onglet ne restera pas vide.</p>
      <p class="t30-pied">Rendez-vous quand tu auras les cartes en main.</p>
    </div>
  </section>`;
}
