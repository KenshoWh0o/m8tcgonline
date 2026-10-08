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

function renderCard(c) {
  if (!c) return '';

  if (c.img) {
    return `<div class="cwrap"><div class="card img-card r-${c.rar}" style="--tc:${tcol(c)}">
      <img src="${c.img}" alt="${h(c.nom)}" loading="lazy" decoding="async"></div></div>`;
  }

  /* Pas d'illustration : la carte existe dans la donnée mais pas sur le
     disque. On le montre plutôt que de le maquiller. */
  return `<div class="cwrap"><div class="card sans-image" style="--tc:${tcol(c)}">
    <b>${h(c.nom)}</b><small>illustration manquante</small></div></div>`;
}
