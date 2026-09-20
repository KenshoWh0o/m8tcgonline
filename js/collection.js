/* Onglet Collection. */
"use strict";

/* ---------- Collection ---------- */
const COL_FILTERS = [
  ['all', 'Tout'],
  ['joueur', 'Joueurs'],
  ['coach', 'Coachs'],
  ['moment', 'Moments'],
  ['objet', 'Objets'],
  ['essence', 'Essences']
];

function vCollection() {
  if (!cards.length) {
    return `<div class="empty"><h1>Collection vide</h1><p class="muted">Le fichier js/cards-data.js ne contient aucune carte.</p></div>`;
  }

  const all = cards.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  const list = colFilter === 'all' ? all : all.filter(c => c.cat === colFilter);
  const owned = all.filter(c => save.col[c.id] > 0).length;
  const pct = Math.round(owned / all.length * 100);
  const f = COL_FILTERS.filter(([k]) => k === 'all' || all.some(c => c.cat === k));

  return `<div class="colhead"><h1>Collection</h1><div class="prog"><div class="bar"><i style="width:${pct}%"></i></div><span><b>${owned}</b> / ${all.length}</span></div></div>
  <div class="chips">${f.map(([k, l]) => `<button data-filter="${k}" class="${colFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="grid">${list.map(c => {
    const n = save.col[c.id] || 0;
    const no = '#' + String(c.num || 0).padStart(3, '0');
    return n
      ? `<button class="gcell" data-show="${c.id}"><span class="count">×${n}</span>${renderCard(c)}<span class="num">${no}</span></button>`
      : `<div class="gcell"><div class="cwrap"><div class="card ghost-card"><span>${no}</span></div></div><span class="num">&nbsp;</span></div>`;
  }).join('')}</div>`;
}
