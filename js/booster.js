/* Boosters : tickets, taux de tirage, écran du paquet et geste de déchirure. */
"use strict";

/* ---------- Tickets ---------- */
function regen() {
  if (save.tickets >= TICKET_CAP) {
    save.lastTick = Date.now();
    return;
  }
  const n = Math.floor((Date.now() - save.lastTick) / INTERVAL);
  if (n > 0) {
    save.tickets = Math.min(TICKET_CAP, save.tickets + n);
    save.lastTick += n * INTERVAL;
    if (save.tickets >= TICKET_CAP) save.lastTick = Date.now();
    persist();
  }
}

function header() {
  $('#tk').textContent = save.unlimited ? '∞' : String(save.tickets);
  const w = gameName().trim().split(/\s+/);
  const last = w.length > 1 ? w.pop() : '';
  $('#brand').innerHTML = `<span>${h(w.join(' '))}</span>${last ? `<span class="tape">${h(last)}</span>` : ''}`;
  document.title = gameName();
}

function timerText() {
  if (save.unlimited) return 'Boosters illimités activés.';
  if (save.tickets >= TICKET_CAP) return `Réserve pleine (${TICKET_CAP} boosters).`;
  const left = INTERVAL - (Date.now() - save.lastTick);
  const m = Math.max(0, Math.floor(left / 60000));
  const s = Math.max(0, Math.floor(left / 1000) % 60);
  return `Prochain booster gratuit dans ${m}:${String(s).padStart(2, '0')}.`;
}

const setName = () => (save && save.setName) || 'Mes cartes';
const gameName = () => (save && save.gameName) || 'Premier Lobby';

/* ---------- Tirage ---------- */
const RATES = { CPC: { C: 75, PC: 25 }, HIT: { R: 79.2, E: 16.63, L: 4.17 } };
const GOD = 1 / 2000;

function pickFrom(pool, r) {
  const order = ['C', 'PC', 'R', 'E', 'L'].sort((a, b) =>
    Math.abs(RAR[a].rank - RAR[r].rank) - Math.abs(RAR[b].rank - RAR[r].rank) || RAR[b].rank - RAR[a].rank
  );
  for (const k of order) {
    const c = pool.filter(p => p.rar === k && p.cat !== 'essence');
    if (c.length) return rnd(c);
  }
  return null;
}

function weighted(w) {
  let tot = 0;
  for (const k in w) tot += w[k];
  let x = Math.random() * tot;
  for (const k in w) {
    x -= w[k];
    if (x <= 0) return k;
  }
  return Object.keys(w)[0];
}

function makeBooster(pool, god) {
  const out = [];
  if (god) {
    for (let i = 0; i < 9; i++) out.push(pickFrom(pool, weighted({ R: 55, E: 45 })));
    out.push(pickFrom(pool, 'L'));
    return out.filter(Boolean);
  }
  for (let i = 0; i < 8; i++) out.push(pickFrom(pool, weighted(RATES.CPC)));
  const ess = pool.filter(c => c.cat === 'essence');
  out.push(ess.length ? rnd(ess) : pickFrom(pool, 'C'));
  out.push(pickFrom(pool, weighted(RATES.HIT)));
  return out.filter(Boolean);
}

/* ---------- Écran booster ---------- */
function packCover() {
  const p = poolFor().filter(c => c.img && c.cat !== 'essence').sort((a, b) => rk(b) - rk(a));
  return p.length ? p[hash('cover' + p.length) % Math.min(3, p.length)] : null;
}

function vBoosters() {
  if (!custom.length) {
    return `<div class="empty"><div class="empty-pack"></div><h1>Aucune carte pour l'instant</h1><p class="muted">Importe ton zip de cartes pour remplir les boosters.</p><button class="btn" data-go="import">Importer mes cartes</button></div>`;
  }
  const can = save.unlimited || save.tickets > 0;
  const cv = packCover();
  return `<div class="packzone">
  <div class="rays" aria-hidden="true"></div>
  <div class="packfloat"><div class="pack${packImg ? ' custom' : ''}" id="pack" role="button" tabindex="0" aria-label="Glisse le long du haut du booster pour l'ouvrir">
    ${packImg ? `<img class="pack-art" src="${packImg}" alt="">` : `<div class="pack-body"><div class="pack-band"></div><div class="pack-dots"></div></div>
    ${cv ? `<div class="pack-cover"><img src="${cv.img}" alt=""></div>` : ''}`}
    <div class="pack-foil"></div>
    <div class="crimp"><div class="tearline" id="tearline"></div>${can ? '<div class="finger" aria-hidden="true"></div>' : ''}</div>
    ${packImg ? '' : `<div class="pack-name"><small>${h(gameName())}</small><b>${h(setName())}</b><span class="pack-count">10 cartes</span></div>`}
  </div></div>
  <div class="pedestal" aria-hidden="true"></div>
  <p class="packhint">${can ? "Glisse le long du haut pour l'ouvrir" : 'Plus de booster disponible'}</p>
  ${can ? '<button class="linkbtn" data-act="open">Ouvrir sans glisser</button>' : ''}
  <p class="muted small" id="timer">${timerText()}</p></div>
  <details class="rates"><summary>Contenu d'un booster</summary><p>10 cartes : 8 communes ou peu communes, 1 Essence, puis une rare garantie qui peut être remplacée par une épique (environ 1 sur 6) ou une légendaire (environ 1 sur 24). Chaque booster est tiré indépendamment. Très rarement, un godpack ne contient que des rares, des épiques et une légendaire.</p></details>`;
}

function bindPack() {
  const pk = $('#pack');
  if (!pk) return;
  let x0 = null;
  let w = 1;

  pk.addEventListener('pointerdown', e => {
    const r = pk.getBoundingClientRect();
    if (e.clientY - r.top > r.height * .3) return;
    x0 = e.clientX;
    w = r.width;
    pk.setPointerCapture(e.pointerId);
  });

  pk.addEventListener('pointermove', e => {
    if (x0 == null) return;
    const p = Math.max(0, Math.min(1, (e.clientX - x0) / (w * .7)));
    $('#tearline').style.width = (p * 100) + '%';
    if (p >= 1) {
      x0 = null;
      openBooster();
      if (!opening && !rv) {
        const t = $('#tearline');
        if (t) t.style.width = '0';
      }
    }
  });

  const end = () => {
    if (x0 == null) return;
    x0 = null;
    const t = $('#tearline');
    if (t) t.style.width = '0';
  };
  pk.addEventListener('pointerup', end);
  pk.addEventListener('pointercancel', end);

  pk.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBooster();
    }
  });
}

function bindTilt(root) {
  (root || document).querySelectorAll('.tilt').forEach(el => {
    const set = (x, y) => {
      el.style.setProperty('--rx', ((.5 - y) * 16).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x - .5) * 20).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      el.style.setProperty('--ga', '1');
    };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--ga', '0');
    });
  });
}
