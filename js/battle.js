/* Onglet Combats. Version 2.1.3 : un teaser, sans rien d'explicite. On ne
   promet ni date ni règle : on laisse entrevoir une arène dans l'ombre, et
   une lumière qui n'est pas celle du reste du site (le graphite et la
   lavande de la version suivante). Trois places attendent leurs cartes. */
"use strict";

function vCombats() {
  return `<div class="pagehead"><div><h1>Combats</h1></div></div>
    <section class="teaser" aria-label="Bientôt">
      <div class="tz-scene" aria-hidden="true">
        <div class="tz-ombre" style="background-image:url('assets/combat/arene-ombre.webp')"></div>
        <i class="tz-trait"></i>
        <div class="tz-places"><i></i><i></i><i></i></div>
      </div>
      <p class="tz-mot">Prépare ton deck.</p>
      <p class="tz-sous">Ta collection ne fait que commencer.</p>
    </section>`;
}
