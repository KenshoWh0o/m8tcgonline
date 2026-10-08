/* Affichage d'une carte.

   Une carte, c'est son illustration : les 122 de l'extension et les 4 Promos
   en ont une, et le format de données l'exige (voir le champ `fichier` dans
   js/cards-data.js). Le reste — attaques, défense, mots-clés — est imprimé
   dessus ; ces champs restent dans la donnée pour le mode Combat à venir,
   mais rien ne les redessine ici.

   Le jeu savait autrefois fabriquer une carte de toutes pièces quand l'image
   manquait. Ça flattait l'oubli : on obtenait une carte crédible, et l'image
   absente ne se voyait jamais. Un emplacement qui le dit franchement rend le
   service inverse, pour cinquante lignes de moins. */
"use strict";

/* Une url() posée dans une variable CSS se résout par rapport à la feuille de
   style qui l'utilise (css/), pas à la page : on la donne donc en absolu. */
let logoAbs = '';
const logoAbsolu = () => logoAbs || (logoAbs = new URL(ART.set, document.baseURI).href);

function renderCard(c) {
  if (!c) return '';

  if (c.img) {
    /* Une Reverse (version 2.0) : la carte, un reflet sur tout ce qui n'est
       pas l'illustration, et le logo Tout Commence Ici frappé en holographique. */
    return `<div class="cwrap"><div class="card img-card r-${c.rar}${c.rev ? ' rev' : ''}" style="--tc:${tcol(c)}">
      <img src="${c.img}" alt="${h(c.nom)}" loading="lazy" decoding="async">${c.rev
        ? `<i class="revtampon" aria-hidden="true" style="--logo:url('${logoAbsolu()}')"><i></i></i>` : ''}</div></div>`;
  }

  /* Pas d'illustration : la carte existe dans la donnée mais pas sur le
     disque. On le montre plutôt que de le maquiller. */
  return `<div class="cwrap"><div class="card sans-image" style="--tc:${tcol(c)}">
    <b>${h(c.nom)}</b><small>illustration manquante</small></div></div>`;
}
