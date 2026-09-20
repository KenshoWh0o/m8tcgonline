/* Affichage d'une carte : image importée, ou carte générée si pas d'image. */
"use strict";

/* ---------- Illustrations générées ---------- */
function artSVG(card) {
  const t = colOf(card);
  const s = hash(card.id);
  const r = n => ((s >>> n) & 255) / 255;
  const ink = '#151a4a';

  let g = `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="70" fill="${t.c}"/><circle cx="${20 + r(1) * 60}" cy="${10 + r(5) * 50}" r="${30 + r(9) * 20}" fill="#fff" opacity=".18"/>`;

  for (let y = 6; y < 70; y += 9) {
    for (let x = 6; x < 100; x += 9) {
      if (((x * 7 + y * 3 + s) % 5) === 0) g += `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity=".35"/>`;
    }
  }

  if (rk(card) >= 4) {
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 + r(3) * 30) * Math.PI / 180;
      g += `<line x1="50" y1="35" x2="${50 + Math.cos(a) * 80}" y2="${35 + Math.sin(a) * 80}" stroke="#fff" stroke-width="3" opacity=".22"/>`;
    }
  }

  if (card.cat === 'joueur') {
    const v = s % 4;
    const rot = Math.round(r(11) * 90);
    if (v === 0) {
      g += `<g transform="translate(50 35) rotate(${rot})" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"><circle r="19"/><circle r="8"/><line x1="-29" x2="-13"/><line x1="13" x2="29"/><line y1="-29" y2="-13"/><line y1="13" y2="29"/></g><circle cx="50" cy="35" r="3" fill="${ink}"/>`;
    } else if (v === 1) {
      for (let i = 0; i < 4; i++) {
        g += `<line x1="${8 + r(i * 3) * 8}" y1="${18 + i * 11}" x2="${30 + r(i * 5) * 10}" y2="${18 + i * 11}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
      }
      g += `<polygon points="58,6 38,38 52,38 44,64 70,28 55,28 64,6" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
    } else if (v === 2) {
      const p = [
        [22 + r(2) * 10, 20 + r(4) * 10],
        [48 + r(6) * 8, 12 + r(8) * 10],
        [74 + r(10) * 6, 24 + r(12) * 12],
        [34 + r(14) * 10, 50 + r(16) * 8],
        [64 + r(18) * 10, 52 + r(20) * 6]
      ];
      [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4], [1, 4]].forEach(([a, b]) => {
        g += `<line x1="${p[a][0]}" y1="${p[a][1]}" x2="${p[b][0]}" y2="${p[b][1]}" stroke="#fff" stroke-width="2.5"/>`;
      });
      p.forEach((q, i) => {
        g += `<circle cx="${q[0]}" cy="${q[1]}" r="${i === 1 ? 7 : 5}" fill="#fff" stroke="${ink}" stroke-width="2"/>`;
      });
    } else {
      for (let i = 0; i < 7; i++) {
        const w = 10 + r(i * 4) * 26;
        const x = 14 + r(i * 3 + 1) * 60;
        const y = 8 + r(i * 2 + 2) * 48;
        g += `<rect x="${x}" y="${y}" width="${w}" height="${4 + r(i + 7) * 9}" fill="${i % 3 === 0 ? ink : '#fff'}" opacity=".8"/>`;
      }
      g += `<rect x="34" y="20" width="32" height="30" fill="none" stroke="#fff" stroke-width="3"/>`;
    }
  } else if (card.cat === 'coach') {
    g += `<rect x="33" y="10" width="34" height="50" rx="5" fill="#fff" stroke="${ink}" stroke-width="2.5"/><rect x="43" y="6" width="14" height="8" rx="2" fill="${ink}"/><line x1="39" y1="26" x2="61" y2="26" stroke="${t.c}" stroke-width="3"/><line x1="39" y1="35" x2="61" y2="35" stroke="${t.c}" stroke-width="3"/><line x1="39" y1="44" x2="54" y2="44" stroke="${t.c}" stroke-width="3"/>`;
  } else if (card.cat === 'moment') {
    g += `<polygon points="50,8 57,28 78,28 61,40 67,61 50,48 33,61 39,40 22,28 43,28" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else if (card.cat === 'objet') {
    g += `<polygon points="50,8 72,30 50,62 28,30" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/><line x1="28" y1="30" x2="72" y2="30" stroke="${ink}" stroke-width="2"/><line x1="50" y1="8" x2="50" y2="62" stroke="${t.c}" stroke-width="2"/>`;
  } else {
    g += `<circle cx="50" cy="35" r="20" fill="#fff" stroke="${ink}" stroke-width="2.5"/><circle cx="50" cy="35" r="11" fill="${t.c}"/>`;
  }

  return g + '</svg>';
}

const artOf = c => c.img ? `<img src="${c.img}" alt="">` : artSVG(c);
const catLine = c => `${CATS[c.cat]}${c.sous ? ' ' + h(c.sous) : ''} ${colOf(c).nom}`;

/* ---------- Rendu complet d'une carte ---------- */
function renderCard(c) {
  const tc = tcol(c);
  const R = RAR[c.rar] || RAR.C;

  if (c.img) {
    return `<div class="cwrap"><div class="card img-card r-${c.rar}" style="--tc:${tc}"><img src="${c.img}" alt="${h(c.nom)}"></div></div>`;
  }

  let body = '';
  if (c.cat === 'joueur') {
    if (c.kw) body += `<div class="c-kw"><b>${h(c.kw.nom)}</b> ${h(c.kw.texte)}</div>`;
    body += c.atks.map(a => `<div class="c-atk"><span class="c-cost">${costDots(a.cout)}</span><span>${h(a.nom)}</span><span class="c-dmg">${a.degats == null ? '' : a.degats}${a.plus ? '+' : ''}</span></div>${a.effet ? `<div class="c-fx">${h(a.effet)}</div>` : ''}`).join('');
  } else {
    body = (c.fx || []).map(t => `<div class="c-fx" style="font-size:.66em">${h(t)}</div>`).join('');
  }

  return `<div class="cwrap"><div class="card r-${c.rar}" style="--tc:${tc}"><div class="c-top"><span class="c-name">${h(c.nom)}</span>${c.cat === 'joueur' ? `<span class="c-hp">DEF <b>${c.def}</b></span>` : ''}</div><div class="c-art">${artSVG(c)}</div><div class="c-type">${catLine(c)}</div>${body}<div class="c-foot"><span>${R.nom}</span></div></div></div>`;
}

/* ---------- Vignette en liste (onglet import, choix de deck…) ---------- */
function thumbRow(c, right) {
  return `<div class="li" style="--tc:${tcol(c)}"><div class="th">${artOf(c)}</div><div class="tx"><b>${h(c.nom)}</b><small>${CATS[c.cat]} ${colOf(c).nom}${c.cat === 'joueur' ? ', ' + c.def + ' DEF' : ''}</small></div>${right}</div>`;
}
