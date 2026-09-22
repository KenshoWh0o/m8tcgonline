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

function brand() {
  $('#brand').innerHTML = `<img src="${ART.logo}" alt="${h(GAME_NAME)}">`;
  document.title = GAME_NAME;
}

/* ---------- Compte à rebours ---------- */
/* Avec une recharge de quatre heures, « 240:00 » n'a plus de sens : on passe en
   heures et minutes tant qu'il en reste plus d'une, et on ne descend à la
   seconde que sur la dernière minute, là où elle devient intéressante. */
function timerClock() {
  if (save.unlimited) return '∞';
  if (save.tickets >= TICKET_CAP) return 'Pleine';
  const left = Math.max(0, INTERVAL - (Date.now() - save.lastTick));
  const s = Math.floor(left / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor(s / 60) % 60;
  if (hh) return `${hh} h ${String(mm).padStart(2, '0')}`;
  if (mm) return `${mm} min`;
  return `${s} s`;
}

/* Ce que raconte la ligne sous l'horloge : un mot, jamais deux. */
function timerLabel() {
  if (save.unlimited) return 'Illimité';
  if (save.tickets >= TICKET_CAP) return 'Réserve pleine';
  return 'Prochain booster';
}

/* Part du délai déjà écoulée, pour la jauge de recharge. */
function tickPct() {
  if (save.unlimited || save.tickets >= TICKET_CAP) return 100;
  return Math.min(100, Math.max(0, (Date.now() - save.lastTick) / INTERVAL * 100));
}

/* ---------- Tirage ---------- */
/* Les cases tirées au sort du paquet. Le reste est fixe.
   Ces tables doivent rester identiques à celles de open_pack() dans
   supabase/03_rpc.sql : le serveur tire, celui-ci ne sert qu'aux ouvertures de
   test du Labo, mais deux tables divergentes rendraient le Labo menteur. */
const RATES = {
  /* Troisième carte : encore une commune, ou déjà une peu commune. */
  MIXTE: { C: 60, PC: 40 },
  /* La dernière, celle qu'on attend. */
  HIT: { R: 80, E: 16, L: 4 },
  /* Le godpack, case par case : ça monte jusqu'à la légendaire garantie. */
  GODPACK: [
    { R: 90, E: 10 },
    { R: 70, E: 30 },
    { R: 50, E: 50 },
    { E: 90, L: 10 },
    { E: 60, L: 40 },
    { L: 100 }
  ]
};
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

/* Six cartes, chacune à sa place :
     1 · Commune
     2 · Commune
     3 · Commune (60 %) ou Peu commune (40 %)
     4 · Peu commune
     5 · Essence
     6 · le hit : Rare 80 %, Épique 16 %, Légendaire 4 %
   L'ordre compte : la pile se feuillette de la première à la dernière, et
   c'est la dernière qui porte la mise en scène de la révélation.
   Godpack : six cartes qui montent, de la rare à la légendaire garantie. */
function makeBooster(pool, god) {
  const out = [];

  if (god) {
    RATES.GODPACK.forEach(table => out.push(pickFrom(pool, weighted(table))));
    return out.filter(Boolean);
  }

  out.push(pickFrom(pool, 'C'));
  out.push(pickFrom(pool, 'C'));
  out.push(pickFrom(pool, weighted(RATES.MIXTE)));
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
  const full = save.unlimited || save.tickets >= TICKET_CAP;

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
    ${vReserve(full)}
    <button class="btn packbtn" data-act="open" ${can ? '' : 'disabled'}>${ICON.star}${can ? 'Ouvrir' : 'Réserve vide'}</button>
  </footer>
</section>`;
}

/* La réserve : une rangée de jetons, un par booster disponible, et la recharge
   en dessous. Le sablier et son « Max » ne disaient ni combien il en restait ni
   combien de temps il fallait attendre — deux pastilles côte à côte qu'il
   fallait lire l'une après l'autre pour comprendre.

   Ici tout se voit d'un coup d'œil : cinq alvéoles, celles qui sont pleines
   brillent, la dernière se remplit sous les yeux. */
function vReserve(full) {
  if (save.unlimited) {
    return `<div class="reserve illimite">
      <div class="resjetons"><img class="resinf" src="${ART.seal}" alt=""><b>∞</b></div>
      <p class="reslab">Boosters illimités</p>
    </div>`;
  }

  /* On n'ecrete pas : un achat peut faire monter la réserve au-dessus du
     plafond, et ces boosters-là existent pour de bon. Le plafond ne borne que
     la recharge automatique — voir regen_tickets() dans supabase/01_schema.sql
     et shop_buy(), qui ajoute sans rien plafonner. */
  const total = save.tickets;
  const n = Math.min(total, TICKET_CAP);
  const surplus = Math.max(0, total - TICKET_CAP);
  const pct = tickPct();
  /* Le jeton en cours de remplissage est le premier vide : c'est lui qui porte
     la jauge, pour que l'attente ait un endroit précis où se lire. */
  const jetons = Array.from({ length: TICKET_CAP }, (_, i) => {
    const plein = i < n;
    const encours = !plein && i === n && !full;
    return `<i class="resjeton${plein ? ' plein' : ''}${encours ? ' encours' : ''}"
      ${encours ? `style="--p:${pct}%"` : ''}></i>`;
  }).join('');

  return `<div class="reserve${full ? ' pleine' : ''}">
    <div class="resjetons" role="img" aria-label="${total} booster${total > 1 ? 's' : ''} en réserve">
      ${jetons}${surplus ? `<i class="ressurplus">+${surplus}</i>` : ''}
    </div>
    <p class="reslab">
      <b class="tnum">${total}</b>
      <span class="resmax">${surplus ? `booster${total > 1 ? 's' : ''}` : '/' + TICKET_CAP}</span>
      <span class="ressep" aria-hidden="true"></span>
      ${full ? '' : NAVICO.clock}
      <span class="restemps">${surplus ? 'Réserve pleine, et ' + surplus + ' d\'avance'
        : h(timerLabel())}${full ? '' : ' · '}</span>
      ${full ? '' : `<b class="tnum" id="tmclock">${timerClock()}</b>`}
    </p>
  </div>`;
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
