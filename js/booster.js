/* Boosters : réserve de tickets, composition d'un paquet, écran du paquet en 3D. */
"use strict";

/* ---------- Réserve ---------- */
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

/* Logo : le premier mot porte le lettrage, le reste va sur le bandeau. */
function brand() {
  const w = GAME_NAME.trim().split(/\s+/);
  const main = w.shift() || GAME_NAME;
  const sub = w.join(' ');
  $('#brand').innerHTML = `<span class="bm-main" data-txt="${h(main)}">${h(main)}</span>${sub ? `<span class="bm-sub"><span>${h(sub)}</span></span>` : ''}`;
  document.title = GAME_NAME;
}

/* ---------- Compte à rebours ---------- */
function timerLabel() {
  if (save.unlimited) return 'Mode illimité';
  if (save.tickets >= TICKET_CAP) return 'Réserve pleine';
  return 'Prochain booster';
}

function timerClock() {
  if (save.unlimited) return '∞';
  if (save.tickets >= TICKET_CAP) return 'Max';
  const left = Math.max(0, INTERVAL - (Date.now() - save.lastTick));
  const m = Math.floor(left / 60000);
  const s = Math.floor(left / 1000) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* Part du délai déjà écoulée, pour la jauge de recharge. */
function tickPct() {
  if (save.unlimited || save.tickets >= TICKET_CAP) return 100;
  return Math.min(100, Math.max(0, (Date.now() - save.lastTick) / INTERVAL * 100));
}

/* ---------- Tirage ---------- */
/* SLOT4 : la quatrième carte hésite entre commune et peu commune. HIT : la dernière carte. */
const RATES = { SLOT4: { C: 50, PC: 50 }, HIT: { R: 79.2, E: 16.63, L: 4.17 } };
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

/* Huit cartes : 3 communes, une commune ou peu commune, 2 peu communes, 1 essence, puis le hit.
   Godpack : 4 rares, 3 épiques et la légendaire en dernier. */
function makeBooster(pool, god) {
  const out = [];

  if (god) {
    for (let i = 0; i < 4; i++) out.push(pickFrom(pool, 'R'));
    for (let i = 0; i < 3; i++) out.push(pickFrom(pool, 'E'));
    out.push(pickFrom(pool, 'L'));
    return out.filter(Boolean);
  }

  for (let i = 0; i < 3; i++) out.push(pickFrom(pool, 'C'));
  out.push(pickFrom(pool, weighted(RATES.SLOT4)));
  out.push(pickFrom(pool, 'PC'));
  out.push(pickFrom(pool, 'PC'));

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
  const pips = Array.from({ length: TICKET_CAP },
    (_, i) => `<span class="pip${save.unlimited || i < save.tickets ? ' on' : ''}"></span>`).join('');

  return `<section class="packzone">
  <header class="setbar">
    <img class="setlogo" src="${ART.set}" alt="${h(SET_NAME)}">
    <img class="edition" src="${ART.edition}" alt="Première édition">
    <p class="setmeta">${cards.length} cartes · ${PACK_SIZE} par booster</p>
  </header>

  <div class="packstage">
    <div class="packglow" aria-hidden="true"></div>
    <div class="pack3d" id="pack3d">
      <div class="pack${can ? ' ready' : ''}" id="pack" role="button" tabindex="0" aria-label="Ouvrir un booster">
        <img class="pack-art" src="${packArt}" alt="">
        <div class="pack-foil" aria-hidden="true"></div>
      </div>
    </div>
    <div class="packshadow" aria-hidden="true"></div>
  </div>

  <footer class="packfoot">
    <div class="meter${can ? '' : ' dry'}">
      <div class="meter-head">
        <span class="pips" aria-hidden="true">${pips}</span>
        <span class="meter-count">${save.unlimited ? '∞' : `${save.tickets}<small>/${TICKET_CAP}</small>`}</span>
      </div>
      <div class="meter-bar"><i id="tmbar" style="width:${tickPct()}%"></i></div>
      <div class="meter-foot"><span id="tmlabel">${timerLabel()}</span><b id="tmclock">${timerClock()}</b></div>
    </div>
    <button class="btn packbtn" data-act="open" ${can ? '' : 'disabled'}>${can ? 'Ouvrir un booster' : 'Réserve vide'}</button>
  </footer>
</section>`;
}

/* Le paquet suit le doigt en 3D ; une simple pression l'ouvre. */
function bindPack() {
  const pk = $('#pack');
  const box = $('#pack3d');
  if (!pk || !box) return;

  const T = { rx: 0, ry: 0, mrx: 0, mry: 0, manual: false };
  const alive = () => document.body.contains(pk);

  let pid = null, x0 = 0, y0 = 0, t0 = 0, moved = 0;

  pk.addEventListener('pointerdown', e => {
    if (pid != null) return;
    pid = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = performance.now();
    moved = 0;
    pk.setPointerCapture(e.pointerId);
  });

  pk.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    moved = Math.max(moved, Math.hypot(dx, dy));
    T.manual = true;
    T.mry = Math.max(-28, Math.min(28, dx * .3));
    T.mrx = Math.max(-24, Math.min(24, -dy * .3));
  });

  /* Pression franche et sans glissement : on ouvre. Sinon, on a juste fait tourner le paquet. */
  const up = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    T.manual = false;
    if (moved < 9 && performance.now() - t0 < 600) openBooster();
  };
  pk.addEventListener('pointerup', up);
  pk.addEventListener('pointercancel', () => { pid = null; T.manual = false; });

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
