/* Onglet Collection.

   Trois axes de tri — type, essence, rareté — et un quatrième réglage : montrer
   tout, ou seulement ce qu'on possède. Les empiler en quatre rangées de puces
   aurait mangé la moitié de l'écran avant la première carte : ils sont rangés
   dans un tiroir de filtres, qui ne s'ouvre que si on le demande et qui dit en
   une ligne ce qui est actif. */
"use strict";

const COL_FILTERS = [
  ['all', 'Tout'],
  ['joueur', 'Joueurs'],
  ['coach', 'Coachs'],
  ['moment', 'Moments'],
  ['objet', 'Objets'],
  ['essence', 'Essences']
];

/* Le tiroir de filtres est-il déplié ? Il survit aux rendus, pas aux rechargements. */
let colOuvert = false;

const filtresActifs = () =>
  (colFilter !== 'all' ? 1 : 0) + (essFilter !== 'all' ? 1 : 0)
  + (rarFilter !== 'all' ? 1 : 0) + (colPossedees ? 1 : 0);

/* Le résumé du tiroir replié : il doit suffire à savoir ce qu'on regarde. */
function resumeFiltres() {
  const bouts = [];
  if (colFilter !== 'all') {
    const f = COL_FILTERS.find(([k]) => k === colFilter);
    if (f) bouts.push(f[1]);
  }
  if (rarFilter !== 'all') bouts.push((RAR[rarFilter] || RAR.C).nom);
  if (essFilter !== 'all') bouts.push((COLORS[essFilter] || COLORS.neutre).nom);
  if (colPossedees) bouts.push('possédées');
  return bouts.length ? bouts.join(' · ') : 'Tout afficher';
}

function vCollection() {
  if (!cards.length) {
    return `<div class="empty"><h1>Collection vide</h1><p class="muted">Le fichier js/cards-data.js ne contient aucune carte.</p></div>`;
  }

  const all = cards.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  const list = all
    .filter(c => colFilter === 'all' || c.cat === colFilter)
    .filter(c => essFilter === 'all' || c.col === essFilter)
    .filter(c => rarFilter === 'all' || c.rar === rarFilter)
    .filter(c => !colPossedees || save.col[c.id] > 0);
  const owned = all.filter(c => save.col[c.id] > 0).length;
  const pct = Math.round(owned / all.length * 100);

  /* Les Secrets prennent la suite de la numérotation sans entrer dans le total.
     On ne les montre que sans filtre : ils n'ont encore ni catégorie ni essence. */
  const noFilter = !filtresActifs();
  const secretFrom = all.reduce((m, c) => Math.max(m, c.num || 0), 0) + 1;

  return `<div class="colhead">
      <div class="colheadtop">
        <h1>Collection</h1>
        <span class="colpct tnum">${pct}<small>%</small></span>
      </div>
      <div class="prog">
        <div class="bar"><i style="width:${pct}%"></i></div>
        <span class="tnum"><b>${owned}</b> / ${all.length}</span>
      </div>
    </div>

    ${vFiltres(all)}

    ${list.length
      ? `<div class="grid">${list.map(vCase).join('')}${noFilter ? secretCells(secretFrom) : ''}</div>`
      : `<p class="empty">Aucune carte avec ces filtres.
          <button class="linkbtn" data-act="col-reset">Tout réafficher</button></p>`}

    ${noFilter || rarFilter === 'PR' ? vPromosSection() : ''}`;
}

/* ---------- Le tiroir de filtres ---------- */
function vFiltres(all) {
  const cats = COL_FILTERS.filter(([k]) => k === 'all' || all.some(c => c.cat === k));
  const essences = Object.keys(COLORS).filter(k => all.some(c => c.col === k));
  const rars = RAR_FILTRES.filter(k => all.some(c => c.rar === k));
  const n = filtresActifs();

  const ligne = (titre, contenu) =>
    `<div class="filigne"><span class="filab">${titre}</span>${contenu}</div>`;

  return `<div class="filtres${colOuvert ? ' open' : ''}">
    <button class="filbar" data-act="col-toggle" aria-expanded="${colOuvert}">
      <span class="filico">${NAVICO.filtre}</span>
      <span class="filresume">${h(resumeFiltres())}</span>
      ${n ? `<i class="pastille">${n}</i>` : ''}
      <span class="filcaret">${NAVICO.caret}</span>
    </button>

    <div class="filcorps">
      ${ligne('Type', `<div class="chips">${cats.map(([k, l]) =>
        `<button data-filter="${k}" class="${colFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>`)}

      ${ligne('Rareté', `<div class="chips">
        <button data-rar="all" class="${rarFilter === 'all' ? 'on' : ''}">Toutes</button>
        ${rars.map(k => `<button data-rar="${k}" class="rarchip r${k} ${rarFilter === k ? 'on' : ''}">
          <i class="rardot"></i>${(RAR[k] || RAR.C).nom}</button>`).join('')}
        ${promos.length ? `<button data-rar="PR" class="rarchip rPR ${rarFilter === 'PR' ? 'on' : ''}">
          <i class="rardot"></i>Promo</button>` : ''}
      </div>`)}

      ${ligne('Essence', `<div class="essrow">
        <button data-ess="all" class="${essFilter === 'all' ? 'on' : ''}">Toutes</button>
        ${essences.map(k => `<button data-ess="${k}" class="${essFilter === k ? 'on' : ''}"
          style="--ec:${COLORS[k].c}">${essIcon(k)}${COLORS[k].nom}</button>`).join('')}
      </div>`)}

      <label class="toggle filtoggle">
        <span>Seulement mes cartes<small>Masque les emplacements vides</small></span>
        <input type="checkbox" id="col-poss" ${colPossedees ? 'checked' : ''}>
      </label>

      ${n ? '<button class="linkbtn filreset" data-act="col-reset">Tout réafficher</button>' : ''}
    </div>
  </div>`;
}

/* ---------- Les cases ---------- */
/* Un emplacement vide ne porte que son numéro. L'étincelle rose qu'on y posait
   avant attirait l'œil sur ce qu'on n'a pas — c'est le contraire de ce qu'une
   grille de collection doit faire. */
const caseVide = (etiquette, cls, sous) =>
  `<div class="gcell${cls ? ' ' + cls : ''}">
    <div class="cwrap"><div class="card ghost-card${cls === 'secretcell' ? ' secret-card' : ''}">
      <span>${h(etiquette)}</span></div></div>
    ${sous ? `<span class="promocomment">${h(sous)}</span>` : '<span class="num">&nbsp;</span>'}
  </div>`;

function vCase(c) {
  const n = save.col[c.id] || 0;
  const no = '#' + String(c.num || 0).padStart(3, '0');
  return n
    ? `<button class="gcell" data-show="${c.id}">${n > 1 ? `<span class="count">×${n}</span>` : ''}${renderCard(c)}<span class="num">${no}</span></button>`
    : caseVide(no);
}

/* Les Secrets prolongent la grille sans en changer le total : des emplacements vides
   comme les autres, seul le reflet les distingue. */
function secretCells(from) {
  return Array.from({ length: SECRETS }, (_, i) =>
    caseVide('#' + String(from + i).padStart(3, '0'), 'secretcell')).join('');
}

/* ---------- Les Promos ---------- */
/* Hors de l'extension, donc hors du total et hors de la grille principale. Une
   case vide y dit comment obtenir la carte : c'est la seule grille du jeu où
   l'absence se répare autrement qu'en ouvrant des paquets.

   Les cases sortent dans l'ordre des codes : celles qu'on a, celles qu'on peut
   obtenir, et celles qui n'existent pas encore. Une série se lit entière ou pas
   du tout — laisser un trou entre P02 et P05 donnerait l'impression d'un bug
   plutôt que d'une suite à venir. */
function cellulesPromo() {
  const connues = promos.map(p => {
    const n = save.col[p.id] || 0;
    return { code: p.code, tri: p.num, html: n
      ? `<button class="gcell" data-show="${p.id}">${n > 1 ? `<span class="count">×${n}</span>` : ''}${renderCard(p)}<span class="num">${h(p.code)}</span></button>`
      : caseVide(p.code, 'promovide', PROMO_COMMENT[p.obtention] || '') };
  });

  const aVenir = PROMOS_A_VENIR.map(code => ({
    code, tri: +code.replace(/\D/g, '') || 0,
    html: caseVide(code, 'promovide avenir', PROMO_COMMENT.bientot)
  }));

  return connues.concat(aVenir).sort((a, b) => a.tri - b.tri).map(x => x.html).join('');
}

function vPromosSection() {
  if (!promos.length) return '';
  const eus = promos.filter(p => save.col[p.id] > 0).length;
  /* Le total de la série, emplacements à venir compris : c'est le nombre que le
     joueur voit dans la grille, et celui qu'il cherche à atteindre. */
  const serie = promos.length + PROMOS_A_VENIR.length;

  return `<section class="promosec">
    <div class="promohead">
      <span class="qpico">${NAVICO.promo}</span>
      <div>
        <h2>Cartes Promo</h2>
        <p>Hors extension : elles ne comptent pas dans les ${cards.length} cartes.</p>
      </div>
      <span class="qpreste"><b class="tnum">${eus}</b><small>/ ${serie}</small></span>
    </div>
    <div class="grid">${cellulesPromo()}</div>
  </section>`;
}
