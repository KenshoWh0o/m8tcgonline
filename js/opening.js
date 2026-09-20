/* Ouverture plein écran : pile 3D, révélation de la dernière carte, godpack, récap. */
"use strict";

/* ---------- Ouverture ---------- */
function openBooster(opts) {
  opts = opts || {};
  if (opening) return;

  const pool = poolFor();
  if (!pool.some(c => c.cat !== 'essence')) {
    toast('Ce booster est vide : aucune carte à tirer.');
    return;
  }
  if (!opts.test && !save.unlimited && save.tickets < 1) {
    toast('Plus de booster pour le moment.');
    return;
  }

  opening = true;
  if (!opts.test && !save.unlimited) {
    if (save.tickets >= TICKET_CAP) save.lastTick = Date.now();
    save.tickets--;
  }

  const god = opts.god != null ? opts.god : Math.random() < GOD;
  const drawn = makeBooster(pool, god);
  if (opts.force && !god) {
    const c = pickFrom(pool, opts.force);
    if (c) drawn[drawn.length - 1] = c;
  }

  /* Les images arrivent du dossier cards/ : on lance leur chargement avant l'animation d'ouverture. */
  drawn.forEach(c => { if (c.img) new Image().src = c.img; });

  const news = drawn.map(c => !(save.col[c.id] > 0));
  if (!opts.test) {
    drawn.forEach(c => save.col[c.id] = (save.col[c.id] || 0) + 1);
    persist();
  }
  header();

  rv = { cards: drawn, news, idx: 0, god, test: !!opts.test, opts, revealed: false };

  const pk = $('#pack');
  if (pk && !RM()) {
    pk.classList.add('tear');
    const r = pk.getBoundingClientRect();
    setTimeout(() => tab === 'boosters' && FX.burst(r.left + r.width / 2, r.top + 26, { n: 60, colors: ['#ffffff', '#ff2e88', '#ffc53d', '#62d0ff'], speed: 7, up: 3, shape: 'star' }), 240);
    setTimeout(() => pk.classList.add('spill'), 420);
    setTimeout(startTheater, 1050);
  } else {
    startTheater();
  }
}

function startTheater() {
  opening = false;
  if (rv.god) showGod();
  else showStack();
}

function theater(html) {
  const t = $('#theater');
  t.innerHTML = html;
  t.hidden = false;
  t.scrollTop = 0;
  document.body.classList.add('intheater');
}

function closeTheater() {
  const t = $('#theater');
  t.hidden = true;
  t.innerHTML = '';
  document.body.classList.remove('intheater');
  FX.clear();
  rv = null;
  rollPack();
  render();
}

function showGod() {
  theater(`<div class="godscreen" data-t="god"><div class="godrays"></div><div class="godtxt">GODPACK</div><p>Tout le booster est rare ou mieux.</p><span class="godtap">Touche pour ouvrir</span></div>`);
  setTimeout(() => FX.sparkle({ n: 140, colors: ['#ffc53d', '#fff3b0', '#ff2e88', '#ffffff'] }), 300);
}

function showStack() {
  const n = rv.cards.length;
  const last = n - 1;
  const fin = rk(rv.cards[last]) >= 3;
  theater(`<div class="th-stage ${rv.god ? 'god' : ''}" id="opening">
    <div class="th-top"><span class="th-count" id="opcount">1 / ${n}</span>${rv.test ? '<span class="th-test">Test</span>' : ''}<button class="th-skip" data-t="skip">Tout voir</button></div>
    <div class="stackwrap"><div class="charge-ring" aria-hidden="true"></div><div class="shock" id="shock" aria-hidden="true"></div>
      <div class="stack3d intro" id="s3d"><div class="stack" id="stack">${rv.cards.map((c, i) => {
        const f = i === last && fin;
        return `<div class="scard${f ? ' veiled final r' + c.rar : ''}" data-i="${i}" style="--z:${i}">${f ? `<div class="lifter"><div class="spinner">${renderCard(c)}<div class="spinback r${c.rar}"><img src="${ART.back}" alt=""></div></div></div>` : renderCard(c)}<div class="sheen"></div></div>`;
      }).join('')}</div></div></div>
    <div class="op-rar" id="oprar"></div>
    <p class="op-hint" id="ophint">Glisse lentement pour voir la pile en 3D, d'un coup sec pour passer</p></div>`);
  bindStack();
}

function isFinalHit() {
  return rv && rv.idx === rv.cards.length - 1 && rk(rv.cards[rv.idx]) >= 3 && !rv.revealed;
}

function announce() {
  if (!rv) return;
  const c = rv.cards[rv.idx];
  if (!c) return;

  const el = $('#oprar');
  const top = document.querySelector(`.scard[data-i="${rv.idx}"]`);
  const R = RAR[c.rar] || RAR.C;
  const nw = rv.news[rv.idx];
  if (!el || !top) return;

  $('#opcount').textContent = `${rv.idx + 1} / ${rv.cards.length}`;

  if (isFinalHit()) {
    el.className = 'op-rar';
    el.innerHTML = '';
    $('#ophint').textContent = '';
    rv.lock = true;
    const cur = rv;
    setTimeout(() => {
      if (rv === cur && document.body.contains(top)) doReveal(() => { cur.lock = false; });
    }, RM() ? 0 : 300);
    return;
  }

  el.className = 'op-rar r' + c.rar;
  el.innerHTML = `${rk(c) >= 3 ? R.nom : ''}${nw ? ' <em>NEW</em>' : ''}`;
  $('#ophint').textContent = rv.idx === rv.cards.length - 1 ? 'Glisse pour voir ton récap' : 'Glisse d\'un coup sec ou touche pour passer';

  if (rk(c) >= 3) {
    top.classList.add('hitcard', 'h' + c.rar);
    if (rv.god && !RM()) {
      const r = top.getBoundingClientRect();
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 30, colors: REVEAL[c.rar].colors, speed: 6, shape: 'star' });
    }
  }
}

function doReveal(done) {
  if (!rv) return;
  const c = rv.cards[rv.idx];
  const cfg = REVEAL[c.rar] || REVEAL.R;
  const top = document.querySelector(`.scard[data-i="${rv.idx}"]`);
  const stage = $('#opening');
  if (!top || !stage) {
    done();
    return;
  }

  stage.style.setProperty('--rc', cfg.rc);
  stage.classList.add('charging', 'charge-' + c.rar);
  top.classList.add('charging');

  setTimeout(() => {
    if (!document.body.contains(top)) {
      done();
      return;
    }
    stage.classList.remove('charging');
    top.classList.remove('veiled', 'charging');
    top.classList.add('unveil', 'hitcard', 'h' + c.rar);
    if (c.rar === 'E' || c.rar === 'L') top.classList.add('spin' + c.rar);
    rv.revealed = true;

    const r = top.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const sh = $('#shock');
    sh.className = 'shock';
    void sh.offsetWidth;
    sh.className = 'shock go r' + c.rar;
    if (c.rar === 'L') {
      setTimeout(() => {
        const s2 = $('#shock');
        if (!s2) return;
        s2.className = 'shock';
        void s2.offsetWidth;
        s2.className = 'shock go r' + c.rar;
      }, 220);
    }

    const s3 = $('#s3d');
    s3.classList.remove('punch');
    void s3.offsetWidth;
    s3.classList.add('punch');

    stage.classList.remove('flash-R', 'flash-E', 'flash-L');
    void stage.offsetWidth;
    stage.classList.add('flash-' + c.rar);

    FX.burst(cx, cy, { n: cfg.n, colors: cfg.colors, speed: cfg.speed, shape: 'star', g: .06, size: 4, life: 45 });
    FX.burst(cx, cy, { n: Math.round(cfg.n / 2), colors: cfg.colors, speed: cfg.speed * .55, g: .03, size: 2.2, life: 40 });
    if (c.rar === 'L') setTimeout(() => FX.sparkle({ n: 120, colors: cfg.colors, size: 4 }), 200);
    else if (c.rar === 'E') setTimeout(() => FX.sparkle({ n: 45, colors: cfg.colors }), 200);

    $('#oprar').className = 'op-rar big r' + c.rar;
    $('#oprar').innerHTML = `<span class="slam">${cfg.label}</span>${rv.news[rv.idx] ? '<em>NEW</em>' : ''}`;
    $('#ophint').textContent = 'Glisse d\'un coup sec pour voir ton récap';

    setTimeout(done, c.rar === 'L' ? 900 : c.rar === 'E' ? 600 : 250);
  }, RM() ? 0 : cfg.charge);
}

function bindStack() {
  const st = $('#stack');
  const s3 = $('#s3d');
  if (!st) return;

  const T = { rx: 0, ry: 0, mrx: 0, mry: 0, manual: false, grx: 0, gry: 0, alive: true, b0: null };
  const alive = () => T.alive && document.body.contains(st);
  announce();

  let x0 = 0, y0 = 0, t0 = 0, busy = false, pid = null;
  const top = () => st.querySelector(`.scard[data-i="${rv.idx}"]`);

  const next = dir => {
    const el = top();
    if (!el || busy || !rv || rv.lock) return;
    busy = true;
    el.style.transition = RM() ? 'none' : 'transform .32s cubic-bezier(.4,0,.8,.4),opacity .32s';
    el.style.transform = `translateZ(0) translate(${dir * 150}%,-14%) rotate(${dir * 26}deg)`;
    el.style.opacity = '0';
    setTimeout(() => {
      if (!rv) return;
      el.remove();
      rv.idx++;
      busy = false;
      if (rv.idx >= rv.cards.length) {
        T.alive = false;
        showRecap();
        return;
      }
      st.querySelectorAll('.scard').forEach(s => s.style.setProperty('--z', +s.dataset.i - rv.idx));
      announce();
    }, RM() ? 0 : 280);
  };

  const reqGyro = () => {
    if (T.gyro) return;
    T.gyro = true;
    const on = e => {
      if (!alive()) {
        removeEventListener('deviceorientation', on);
        return;
      }
      if (e.beta == null) return;
      if (T.b0 == null) T.b0 = e.beta;
      T.gry = Math.max(-18, Math.min(18, (e.gamma || 0) * .6));
      T.grx = Math.max(-18, Math.min(18, -(e.beta - T.b0) * .6));
    };
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(r => {
          if (r === 'granted') addEventListener('deviceorientation', on);
        }).catch(() => {});
      } else if (window.DeviceOrientationEvent) {
        addEventListener('deviceorientation', on);
      }
    } catch (e) {}
  };

  let samples = [];
  st.addEventListener('pointerdown', e => {
    if (pid != null) return;
    reqGyro();
    pid = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = performance.now();
    samples = [{ x: x0, y: y0, t: t0 }];
    st.setPointerCapture(e.pointerId);
  });

  st.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const now = performance.now();
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    samples.push({ x: e.clientX, y: e.clientY, t: now });
    while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
    T.manual = true;
    T.mry = Math.max(-38, Math.min(38, dx * .35));
    T.mrx = Math.max(-38, Math.min(38, -dy * .35));
  });

  const up = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    T.manual = false;
    const now = performance.now();
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const dt = now - t0;
    const f = samples[0];
    const vx = f && now - f.t > 0 ? (e.clientX - f.x) / (now - f.t) : 0;
    if (Math.abs(vx) > .55 && Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * .7) next(vx > 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 8 && dt < 350) next(-1);
  };
  st.addEventListener('pointerup', up);
  st.addEventListener('pointercancel', e => {
    if (e.pointerId === pid) {
      pid = null;
      T.manual = false;
    }
  });
  st.addEventListener('dragstart', e => e.preventDefault());

  const key = e => {
    if (!alive()) {
      document.removeEventListener('keydown', key);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      next(-1);
    }
  };
  document.addEventListener('keydown', key);

  const frame = now => {
    if (!alive()) return;
    let trx, tr_y;
    if (T.manual) {
      trx = T.mrx;
      tr_y = T.mry;
    } else {
      trx = T.grx + (RM() ? 0 : Math.sin(now / 1700) * 3);
      tr_y = T.gry + (RM() ? 0 : Math.sin(now / 2300) * 5);
    }
    T.rx += (trx - T.rx) * .14;
    T.ry += (tr_y - T.ry) * .14;
    st.style.transform = `rotateX(${T.rx.toFixed(2)}deg) rotateY(${T.ry.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  setTimeout(() => {
    if (s3) s3.classList.remove('intro');
  }, RM() ? 0 : 900);
}

function showRecap() {
  const drawn = rv.cards;
  const best = drawn.reduce((m, c) => rk(c) > rk(m) ? c : m, drawn[0]);
  const bi = drawn.indexOf(best);
  const nNew = rv.news.filter(Boolean).length;
  const hits = drawn.filter(c => rk(c) >= 3).length;
  const all = cards.filter(c => c.cat !== 'essence');
  const owned = all.filter(c => save.col[c.id] > 0).length;
  const R = RAR[best.rar] || RAR.C;

  theater(`<div class="recap ${rv.god ? 'god' : ''}">
    <div class="rc-head"><span class="rc-kicker">${rv.test ? 'Ouverture de test' : 'Booster ouvert'}</span><img class="rc-setlogo" src="${ART.set}" alt="${h(SET_NAME)}"></div>
    <div class="rc-hero r${best.rar}"><div class="rc-halo"></div><button class="rc-best" data-t="show" data-id="${best.id}">${renderCard(best)}</button>
      <div class="rc-bestlabel"><span class="rc-tag r${best.rar}">${R.nom}</span>${rv.news[bi] ? '<em>NEW</em>' : ''}</div></div>
    <div class="rc-stats">
      <div><b>${nNew}</b><span>nouvelle${nNew > 1 ? 's' : ''}</span></div>
      <div><b>${hits}</b><span>rare${hits > 1 ? 's' : ''} ou mieux</span></div>
      <div><b>${owned}<small>/${all.length}</small></b><span>collection</span></div>
    </div>
    <div class="rc-grid">${drawn.map((c, i) => `<button class="rc-cell" data-t="show" data-id="${c.id}" style="--d:${200 + i * 70}ms">${rv.news[i] ? '<span class="new">NEW</span>' : ''}${renderCard(c)}</button>`).join('')}</div>
    <div class="rc-actions"><button class="btn" data-t="again">${rv.test ? 'Relancer ce test' : 'Ouvrir un autre booster'}</button><button class="btn ghost dark" data-t="done">Terminer</button></div>
  </div>`);

  if (best.rar === 'L' && !RM()) setTimeout(() => FX.sparkle({ n: 90, colors: REVEAL.L.colors }), 500);
}

$('#theater').addEventListener('click', e => {
  const t = e.target.closest('[data-t]');
  if (!t) return;
  switch (t.dataset.t) {
    case 'god':
      showStack();
      break;
    case 'skip':
      if (!rv) return;
      rv.lock = false;
      rv.idx = rv.cards.length;
      FX.clear();
      showRecap();
      break;
    case 'show': {
      const c = byId[t.dataset.id];
      if (c) openViewer(c);
      break;
    }
    case 'again': {
      const o = rv.opts;
      if (!o.test && !save.unlimited && save.tickets < 1) {
        toast('Plus de booster pour le moment.');
        return;
      }
      FX.clear();
      openBooster(o);
      break;
    }
    case 'done':
      closeTheater();
      break;
  }
});
