/* Onglet Combats. Les règles ne sont pas écrites : la page annonce la couleur
   et ne promet rien d'autre. Elle réutilise les vraies cartes pour la mise en scène. */
"use strict";

function vCombats() {
  const vedettes = cards
    .filter(c => c.cat === 'joueur' && (c.rar === 'L' || c.rar === 'E'))
    .slice(0, 3);

  return `<div class="pagehead"><h1>Combats</h1></div>
    <section class="soon">
      <div class="soonart" aria-hidden="true">
        ${vedettes.map((c, i) => `<div class="soondeck d${i}">${renderCard(c)}</div>`).join('')}
      </div>
      <span class="soontag">Bientôt disponible</span>
      <h2 class="soontitle">Coming soon</h2>
      <p class="muted">Les règles du jeu de combat sont encore en écriture.
        Cet onglet ouvrira quand elles seront prêtes.</p>
      <p class="muted small">En attendant, remplis ta collection : elle servira de deck.</p>
    </section>`;
}
