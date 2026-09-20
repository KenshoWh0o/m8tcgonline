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
  const list = all
    .filter(c => colFilter === 'all' || c.cat === colFilter)
    .filter(c => essFilter === 'all' || c.col === essFilter);
  const owned = all.filter(c => save.col[c.id] > 0).length;
  const pct = Math.round(owned / all.length * 100);

  const cats = COL_FILTERS.filter(([k]) => k === 'all' || all.some(c => c.cat === k));
  const essences = Object.keys(COLORS).filter(k => all.some(c => c.col === k));

  /* Les Secrets prennent la suite de la numérotation sans entrer dans le total.
     On ne les montre que sans filtre : ils n'ont encore ni catégorie ni essence. */
  const noFilter = colFilter === 'all' && essFilter === 'all';
  const secretFrom = all.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1;

  return `<div class="colhead">
    <h1>Collection</h1>
    <div class="prog"><div class="bar"><i style="width:${pct}%"></i></div><span><b>${owned}</b> / ${all.length}</span></div>
  </div>
  <div class="chips">${cats.map(([k, l]) => `<button data-filter="${k}" class="${colFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="essrow">
    <button data-ess="all" class="${essFilter === 'all' ? 'on' : ''}">Toutes les essences</button>
    ${essences.map(k => `<button data-ess="${k}" class="${essFilter === k ? 'on' : ''}" style="--ec:${COLORS[k].c}">${essIcon(k)}${COLORS[k].nom}</button>`).join('')}
  </div>
  ${list.length ? `<div class="grid">${list.map(c => {
    const n = save.col[c.id] || 0;
    const no = '#' + String(c.num || 0).padStart(3, '0');
    return n
      ? `<button class="gcell" data-show="${c.id}"><span class="count">×${n}</span>${renderCard(c)}<span class="num">${no}</span></button>`
      : `<div class="gcell"><div class="cwrap"><div class="card ghost-card"><img src="${ART.star}" alt=""><span>${no}</span></div></div><span class="num">&nbsp;</span></div>`;
  }).join('')}${noFilter ? secretCells(secretFrom) : ''}</div>` : '<p class="empty">Aucune carte avec ces filtres.</p>'}`;
}

/* Les Secrets prolongent la grille sans en changer le total : des emplacements vides
   comme les autres, seul le reflet les distingue. */
function secretCells(from) {
  return Array.from({ length: SECRETS }, (_, i) => {
    const no = '#' + String(from + i).padStart(3, '0');
    return `<div class="gcell"><div class="cwrap"><div class="card ghost-card secret-card"><img src="${ART.star}" alt=""><span>${no}</span></div></div><span class="num">&nbsp;</span></div>`;
  }).join('');
}
