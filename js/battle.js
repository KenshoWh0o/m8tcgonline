/* Onglet Combats. Pendant L'Échauffement (js/echauffement.js), ses défis ;
   le reste du temps, l'annonce : les règles ne sont pas écrites, la page ne
   promet rien d'autre. Elle réutilise les vraies cartes pour la mise en scène. */
"use strict";

function vCombats() {
  if (echActif()) return `<div class="pagehead"><div><h1>Combats</h1></div></div>${vEchauffement()}`;
  const vedettes = cards
    .filter(c => c.cat === 'joueur' && (c.rar === 'L' || c.rar === 'E'))
    .slice(0, 3);

  return `<div class="pagehead"><div><h1>Combats</h1></div></div>
    <section class="soon">
      <div class="soonart" aria-hidden="true">
        ${vedettes.map((c, i) => `<div class="soondeck d${i}">${renderCard(c)}</div>`).join('')}
      </div>
      <span class="soontag">Bientôt disponible</span>
      <h2 class="soontitle">Coming soon</h2>
      <p class="muted">Le mode combat arrivera dans une prochaine mise à jour,
        lorsque les règles seront connues.</p>
      <p class="muted small">En attendant, remplis ta collection : elle servira de deck.</p>
    </section>`;
}
