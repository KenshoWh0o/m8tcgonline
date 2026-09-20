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
}

/* Titre de la page et logo : le dernier mot du nom passe en ligne basse, comme « TRADING CARD GAME » sous le logo M8. */
function brand() {
  const w = GAME_NAME.trim().split(/\s+/);
  const last = w.length > 1 ? w.pop() : '';
  const main = w.join(' ');
  $('#brand').innerHTML = `<span class="bm-main" data-txt="${h(main)}">${h(main)}</span>${last ? `<span class="bm-sub">${h(last)}</span>` : ''}`;
  document.title = GAME_NAME;
}

function timerText() {
  if (save.unlimited) return 'Boosters illimités activés.';
  if (save.tickets >= TICKET_CAP) return `Réserve pleine (${TICKET_CAP} boosters).`;
  const left = INTERVAL - (Date.now() - save.lastTick);
  const m = Math.max(0, Math.floor(left / 60000));
  const s = Math.max(0, Math.floor(left / 1000) % 60);
  return `Prochain booster gratuit dans ${m}:${String(s).padStart(2, '0')}.`;
}

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
function vBoosters() {
  if (!cards.length) {
    return `<div class="empty"><h1>Aucune carte</h1><p class="muted">Le fichier js/cards-data.js ne contient aucune carte.</p></div>`;
  }
  const can = save.unlimited || save.tickets > 0;

  return `<section class="packzone">
  <header class="setbar">
    <img class="setlogo" src="${ART.set}" alt="${h(SET_NAME)}">
    <img class="edition" src="${ART.edition}" alt="Première édition">
    <p class="setmeta">${cards.length} cartes · 10 par booster</p>
  </header>

  <div class="packstage">
    <div class="packglow" aria-hidden="true"></div>
    <div class="pack3d" id="pack3d">
      <div class="pack" id="pack" role="button" tabindex="0" aria-label="Ouvrir le booster">
        <img class="pack-art" src="${packArt}" alt="">
        <div class="pack-foil" aria-hidden="true"></div>
        <div class="pack-crimp" aria-hidden="true"><i class="tearline" id="tearline"></i></div>
        ${can ? '<div class="finger" aria-hidden="true"></div>' : ''}
      </div>
    </div>
    <div class="packshadow" aria-hidden="true"></div>
  </div>

  <footer class="packfoot">
    <button class="btn" data-act="open" ${can ? '' : 'disabled'}>${can ? 'Ouvrir le booster' : 'Plus de booster'}</button>
    <p class="packhint">${can ? 'ou glisse le long du haut du paquet' : 'Reviens quand la réserve est remontée'}</p>
    <p class="muted small" id="timer">${timerText()}</p>
  </footer>
</section>`;
}

/* Le paquet suit le doigt en 3D, comme la pile de l'ouverture ; glisser le long du haut le déchire. */
function bindPack() {
  const pk = $('#pack');
  const box = $('#pack3d');
  if (!pk || !box) return;

  const T = { rx: 0, ry: 0, mrx: 0, mry: 0, manual: false, alive: true };
  const alive = () => T.alive && document.body.contains(pk);

  let pid = null, x0 = 0, y0 = 0, tearing = false, w = 1;

  pk.addEventListener('pointerdown', e => {
    if (pid != null) return;
    pid = e.pointerId;
    const r = pk.getBoundingClientRect();
    x0 = e.clientX;
    y0 = e.clientY;
    w = r.width;
    tearing = e.clientY - r.top < r.height * .28;
    pk.setPointerCapture(e.pointerId);
  });

  pk.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (tearing) {
      const p = Math.max(0, Math.min(1, dx / (w * .7)));
      $('#tearline').style.width = (p * 100) + '%';
      if (p >= 1) {
        pid = null;
        tearing = false;
        openBooster();
      }
      return;
    }
    T.manual = true;
    T.mry = Math.max(-26, Math.min(26, dx * .3));
    T.mrx = Math.max(-22, Math.min(22, -dy * .3));
  });

  const end = () => {
    pid = null;
    T.manual = false;
    tearing = false;
    const l = $('#tearline');
    if (l) l.style.width = '0';
  };
  pk.addEventListener('pointerup', end);
  pk.addEventListener('pointercancel', end);

  pk.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBooster();
    }
  });

  const frame = now => {
    if (!alive()) return;
    const trx = T.manual ? T.mrx : (RM() ? 0 : Math.sin(now / 2400) * 3.5);
    const tryy = T.manual ? T.mry : (RM() ? 0 : Math.sin(now / 1900) * 6);
    T.rx += (trx - T.rx) * .12;
    T.ry += (tryy - T.ry) * .12;
    box.style.transform = `rotateX(${T.rx.toFixed(2)}deg) rotateY(${T.ry.toFixed(2)}deg)`;
    pk.style.setProperty('--fx', (50 + T.ry * 1.8).toFixed(1) + '%');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
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
