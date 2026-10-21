/* Onglet Combats. Tant que la 3.0 n'est pas là, il montre son teaser en
   grand : le colis et son suivi (js/teaser30.js). */
"use strict";

function vCombats() {
  return `<div class="pagehead"><div><h1>Combats</h1></div></div>
    <section class="t30-page">${vTeaser30Corps()}</section>`;
}
