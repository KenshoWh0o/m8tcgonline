/* Ouverture plein écran : pile 3D, révélation de la dernière carte, godpack, récap. */
"use strict";

/* ---------- Ouverture ---------- */
async function openBooster(opts) {
  opts = opts || {};
  if (opening) return;
  opening = true;

  /* La collection telle qu'elle est juste avant le tirage : c'est elle qui dit
     quelles cartes sont inédites, y compris quand c'est le serveur qui l'a déjà
     mise à jour de son côté. */
  const avant = Object.assign({}, save.col);

  /* Le paquet plonge vers la caméra pendant que le serveur tire : l'attente est
     couverte par l'animation, et l'écran ne reste jamais figé. */
  const pk = $('#pack');
  if (pk && !RM()) pk.classList.add('tear');
  SFX.jouer('craque');

  let tirage;
  try {
    tirage = await Backend.openPack(opts);
  } catch (e) {
    opening = false;
    if (pk) pk.classList.remove('tear');
    toast(e.message || 'Impossible d\'ouvrir ce booster.');
    SFX.jouer('erreur');
    render();
    return;
  }

  const drawn = tirage.cards;
  if (!drawn.length) {
    opening = false;
    if (pk) pk.classList.remove('tear');
    toast('Ce booster est vide : aucune carte à tirer.');
    return;
  }

  /* Les images arrivent du dossier cards/ : on lance leur chargement avant l'animation. */
  drawn.forEach(c => { if (c.img) new Image().src = c.img; });

  const news = drawn.map(c => !(avant[c.id] > 0));
  header();
  if (!opts.test) noterPaquetOuvert();

  rv = { cards: drawn, news, idx: 0, god: tirage.god, test: !!opts.test, opts, revealed: false };

  /* « Aller droit au récap » : on saute le défilé, pas le tirage. La
     collection a déjà été mise à jour par le serveur. */
  if (JEU.recapDirect && !opts.test) {
    rv.idx = rv.cards.length;
    opening = false;
    return showRecap();
  }

  if (pk && !RM()) setTimeout(startTheater, 120);
  else startTheater();
}

function startTheater() {
  opening = false;
  showStack();
}

/* Ouverture du paquet. La pile et le paquet sont dans le même écran depuis le début :
   le paquet se déchire par le haut, puis les cartes en sortent d'un seul mouvement
   jusqu'à venir se présenter face au joueur. Aucun remplacement de DOM, donc aucune coupure. */
function packOpen(done) {
  const st = $('#opening');
  const pack = $('#packrip');
  if (!st || !pack) {
    done();
    return;
  }

  const god = rv.god;
  const cur = rv;
  const cols = god ? ['#fff6d0', '#ffc73b', '#ffffff', '#ffe08a'] : ['#ffffff', '#ffd7f0', '#a95cf2', '#8936ff'];
  const at = (ms, fn) => setTimeout(() => {
    if (rv === cur && document.body.contains(st)) fn();
  }, ms);
  const blast = (y, n, speed, size) => {
    const r = pack.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height * y, { n, colors: cols, speed, up: 3, shape: 'star', size, g: .05, life: 48 });
  };

  /* Godpack : rien ne le dit encore. La lumière monte lentement dans le paquet, la couture s'allume,
     et tout se déverse au moment de la déchirure. Aucun texte, aucun écran, aucune coupure. */
  const wake = god ? 860 : 0;
  st.classList.add(god ? 'rip-wake' : 'rip-shake');

  if (god) at(0, () => SFX.jouer('monte', 900));

  at(wake + 360, () => {
    st.classList.add('rip-cut');
    SFX.jouer('dechire');
    blast(.09, god ? 120 : 40, god ? 11 : 7, god ? 4 : 3.2);
  });

  at(wake + 640, () => {
    st.classList.add('rip-open');
    if (god) st.classList.add('lit');
  });

  /* Retirer « packed » relâche la transition de la pile : elle sort du paquet et vient de face. */
  at(wake + 920, () => {
    st.classList.remove('packed');
    st.classList.add('rip-pull');
    SFX.jouer('woosh');
    blast(.16, god ? 190 : 56, god ? 13 : 8, god ? 4.6 : 4);
    if (god) FX.sparkle({ n: 150, colors: cols, size: 4.4 });
  });

  /* Une seconde nappe d'étincelles pour que la pluie dorée ne s'arrête jamais net. */
  if (god) at(wake + 1500, () => FX.sparkle({ n: 110, colors: cols, size: 3.6 }));

  at(wake + 2050, () => {
    pack.remove();
    st.classList.remove('rip-wake', 'rip-shake', 'rip-cut', 'rip-open', 'rip-pull');
    done();
  });
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

function showStack() {
  const n = rv.cards.length;
  const last = n - 1;
  const fin = rk(rv.cards[last]) >= 3;
  const anim = !RM();

  /* La carte à surprise ne porte pas encore sa rareté : sa couleur ne doit rien révéler
     avant la révélation. doReveal() ajoute la classe au dernier moment. */
  theater(`<div class="th-stage${rv.god ? ' god' : ''}${anim ? ' packed' : ''}" id="opening">
    <div class="th-top"><span class="th-count" id="opcount">1 / ${n}</span>${rv.test ? '<span class="th-test">Test</span>' : ''}<button class="th-skip" data-t="skip">Tout voir</button></div>
    <div class="stackwrap">${rv.god ? '<div class="godaura" aria-hidden="true"></div><div class="godwash" aria-hidden="true"></div>' : ''}<div class="charge-ring" aria-hidden="true"></div><div class="shock" id="shock" aria-hidden="true"></div>
      <div class="stack3d" id="s3d"><div class="stack" id="stack">${rv.cards.map((c, i) => {
        const f = i === last && fin;
        /* Le reflet (`.sheen`) est posé sur la FACE, pas sur l'emplacement :
           la dernière carte pivote sur elle-même, et un reflet resté face à la
           caméra se détachait en grand rectangle blanchâtre derrière elle. */
        return `<div class="scard${f ? ' veiled final' : ''}" data-i="${i}" style="--z:${i}">${f ? `<div class="lifter"><div class="spinner">${renderCard(c)}<div class="sheen"></div><div class="spinback"><img src="${ART.back}" alt=""></div></div></div>` : `${renderCard(c)}<div class="sheen"></div>`}</div>`;
      }).join('')}</div></div>
      ${anim ? `<div class="packrip" id="packrip" aria-hidden="true">
        <img class="rp-body" src="${packArt}" alt="">
        <div class="rp-top"><img src="${packArt}" alt=""></div>
        <i class="rp-line"></i>${rv.god ? '<i class="rp-leak"></i><i class="rp-beam"></i>' : ''}
      </div>` : ''}</div>
    <div class="op-rar" id="oprar"></div>
    <p class="op-hint" id="ophint"></p></div>`);

  const start = () => {
    bindStack();
  };
  if (anim) packOpen(start);
  else start();
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

  el.className = 'op-rar r' + c.rar + (c.rev ? ' rev' : '');
  el.innerHTML = `${c.rev ? '<span class="oprev">Reverse</span>' : ''}${rk(c) >= 3 ? R.nom : ''}${nw ? ' <em>NEW</em>' : ''}`;

  /* Une Essence Brillante tombe au milieu du paquet : elle n'a pas la
     révélation de la dernière carte, mais elle ne passe pas inaperçue. */
  const indice = rv.idx === rv.cards.length - 1 ? 'Glisse d\'un coup sec ou touche pour voir ton récap' : 'Glisse d\'un coup sec ou touche pour passer';
  if (c.foil && !rv.vuBrillante) {
    rv.vuBrillante = true;
    SFX.jouer('epique');
    vibrer([20, 40, 20]);
    el.className = 'op-rar big rBR';
    el.innerHTML = `<span class="slam">Brillante</span>${nw ? '<em>NEW</em>' : ''}`;
    top.classList.add('foilhit', 'hitcard', 'hBR');
    if (!RM()) {
      const r = top.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const couleurs = ['#ff5bb0', '#ffc73b', '#55e6a6', '#39b8ff', '#ffffff'];
      FX.burst(x, y, { n: 90, colors: couleurs, speed: 10, shape: 'star', g: .05, size: 3.6, life: 44 });
      setTimeout(() => FX.sparkle({ n: 60, colors: couleurs, size: 3 }), 500);
    }
    /* La carte se tient une seconde et demie : un doigt qui tapote pour
       feuilleter le paquet ne la fait plus défiler sans qu'on l'ait vue. */
    rv.lock = true;
    const cur = rv;
    $('#ophint').textContent = '';
    setTimeout(() => {
      if (rv !== cur) return;
      cur.lock = false;
      const hint = $('#ophint');
      if (hint) hint.textContent = indice;
    }, RM() ? 700 : 1600);
    return;
  }
  /* Une Reverse se montre un court instant avant qu'on puisse passer : le
     temps de voir son reflet, sans freiner le paquet comme une Brillante. */
  if (c.rev && !rv.god) {
    top.classList.add('revhit');
    if (rk(c) >= 3) top.classList.add('hitcard', 'h' + c.rar);
    vibrer(12);
    rv.lock = true;
    const cur = rv;
    $('#ophint').textContent = '';
    setTimeout(() => {
      if (rv !== cur) return;
      cur.lock = false;
      const hint = $('#ophint');
      if (hint) hint.textContent = indice;
    }, RM() ? 300 : 750);
    return;
  }
  $('#ophint').textContent = indice;

  if (rk(c) >= 3 && !rv.god) top.classList.add('hitcard', 'h' + c.rar);
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
  SFX.jouer('monte', cfg.charge);
  /* La rareté n'est posée sur la carte qu'ici : avant, sa couleur vendrait la mèche. */
  top.classList.add('charging', 'r' + c.rar);

  setTimeout(() => {
    if (!document.body.contains(top)) {
      done();
      return;
    }
    stage.classList.remove('charging');
    top.classList.remove('veiled', 'charging');
    top.classList.add('unveil', 'hitcard', 'h' + c.rar);
    const haut = c.rar === 'L' || c.rar === 'UN' || c.rar === 'S';
    SFX.jouer(haut ? 'legend' : c.rar === 'E' ? 'epique' : 'rare');
    /* La vibration double le son : sur un téléphone en silencieux, c'est tout ce
       qui reste pour dire qu'il vient de se passer quelque chose. */
    vibrer(c.rar === 'UN' ? [40, 60, 40, 60, 40, 60, 120] : haut ? [30, 50, 30, 50, 60] : c.rar === 'E' ? [25, 45, 40] : 30);
    if (c.rar === 'E' || c.rar === 'L') top.classList.add('spin' + c.rar);
    if (c.rar === 'UN' || c.rar === 'S') top.classList.add('spinL');
    rv.revealed = true;

    const r = top.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const sh = $('#shock');
    sh.className = 'shock';
    void sh.offsetWidth;
    sh.className = 'shock go r' + c.rar;
    if (haut) {
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

    stage.classList.remove('flash-R', 'flash-E', 'flash-L', 'flash-S', 'flash-UN');
    void stage.offsetWidth;
    stage.classList.add('flash-' + c.rar);

    FX.burst(cx, cy, { n: cfg.n, colors: cfg.colors, speed: cfg.speed, shape: 'star', g: .06, size: 4, life: 45 });
    FX.burst(cx, cy, { n: Math.round(cfg.n / 2), colors: cfg.colors, speed: cfg.speed * .55, g: .03, size: 2.2, life: 40 });
    if (haut) setTimeout(() => FX.sparkle({ n: c.rar === 'UN' || c.rar === 'S' ? 220 : 120, colors: cfg.colors, size: 4 }), 200);
    if (c.rar === 'UN' || c.rar === 'S') setTimeout(() => FX.sparkle({ n: 160, colors: cfg.colors, size: 3.4 }), 1100);
    else if (c.rar === 'E') setTimeout(() => FX.sparkle({ n: 45, colors: cfg.colors }), 200);

    $('#oprar').className = 'op-rar big r' + c.rar;
    $('#oprar').innerHTML = `<span class="slam">${cfg.label}</span>${rv.news[rv.idx] ? '<em>NEW</em>' : ''}`;
    $('#ophint').textContent = 'Glisse d\'un coup sec ou touche pour voir ton récap';

    setTimeout(done, c.rar === 'UN' || c.rar === 'S' ? 1400 : c.rar === 'L' ? 900 : c.rar === 'E' ? 600 : 250);
  }, RM() ? 0 : cfg.charge);
}

function bindStack() {
  const st = $('#stack');
  const s3 = $('#s3d');
  const stage = $('#opening');
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
    SFX.jouer('carte');
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

  /* Une seule mécanique de gyroscope pour tout le jeu : voir brancherGyro()
     dans js/utils.js. Branché à la première pression sur la pile — sur iPhone,
     l'autorisation ne s'obtient que depuis un geste. */
  const reqGyro = () => {
    if (T.gyro) return;
    T.gyro = true;
    T.debrancher = brancherGyro((rx, ry) => {
      if (!alive()) return T.debrancher && T.debrancher();
      T.grx = rx;
      T.gry = ry;
    });
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
    /* L'inclinaison fait briller la tranche de la carte à surprise : le spoil devient volontaire. */
    if (stage) stage.style.setProperty('--tilt', Math.min(1, Math.abs(T.ry) / 30).toFixed(3));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function showRecap() {
  const drawn = rv.cards;
  const best = drawn.reduce((m, c) => rk(c) > rk(m) ? c : m, drawn[0]);
  const bi = drawn.indexOf(best);
  const nNew = rv.news.filter(Boolean).length;
  const hits = drawn.filter(c => rk(c) >= 3).length;
  /* Toutes les cartes, Essences comprises : c'est le même total que l'onglet
     Collection, sinon les deux écrans s'obstinent à ne pas dire la même chose. */
  const all = cards;
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
    <div class="rc-actions">${vRecapActions()}</div>
  </div>`);

  SFX.jouer('gagne');
  if ((best.rar === 'L' || best.rar === 'UN' || best.rar === 'S') && !RM()) setTimeout(() => FX.sparkle({ n: 90, colors: (REVEAL[best.rar] || REVEAL.L).colors }), 500);
  /* Le paquet qu'on vient d'ouvrir, gardé pour le bouton « Partager ». */
  dernierTirage = { ids: drawn.map(c => c.id), god: rv.god, quand: new Date().toISOString() };
}

/* Le dernier booster ouvert, pour le partage depuis le récap. */
let dernierTirage = null;

/* Les deux boutons du récap. « Ouvrir un autre booster » ne disait pas s'il en
   restait un : on appuyait, et le jeu répondait « réserve vide ». Le compte est
   désormais sur le bouton, et quand il n'y en a plus le bouton le dit et cède
   la place principale à « Terminer ». */
function vRecapActions() {
  if (rv.test) {
    return '<button class="btn" data-t="again">Relancer ce test</button>'
      + '<button class="btn ghost dark" data-t="done">Terminer</button>';
  }

  /* Une série de boosters en plus (boutique, cadeau) : on enchaîne sur le
     suivant tant qu'il en reste. */
  if (rv.opts && rv.opts.bonus && save.bonus > 0) {
    return `<button class="btn" data-t="again">${NAVICO.promo}Booster suivant<span class="rc-reste">${save.bonus}</span></button>
      <div class="rc-duo"><button class="btn ghost dark" data-t="share">${NAVICO.partage}Partager</button>
      <button class="btn ghost dark" data-t="done">Terminer</button></div>`;
  }

  const reste = save.unlimited ? Infinity : save.tickets;
  if (!reste) {
    return `<div class="rc-duo"><button class="btn ghost dark" data-t="share">${NAVICO.partage}Partager</button>
      <button class="btn" data-t="done">Terminer</button></div>
      <p class="rc-vide">${NAVICO.clock} Réserve vide · prochain booster dans
        <b class="tnum">${h(timerClock())}</b></p>`;
  }

  const compte = save.unlimited
    ? '<span class="rc-reste">∞</span>'
    : `<span class="rc-reste">${reste}</span>`;
  return `<button class="btn" data-t="again">${ICON.star}Ouvrir un autre${compte}</button>
    <div class="rc-duo"><button class="btn ghost dark" data-t="share">${NAVICO.partage}Partager</button>
    <button class="btn ghost dark" data-t="done">Terminer</button></div>`;
}

$('#theater').addEventListener('click', e => {
  const t = e.target.closest('[data-t]');
  if (!t) return;
  switch (t.dataset.t) {
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
      /* Les boosters en plus épuisés, « Ouvrir un autre » repart sur la réserve. */
      const o = Object.assign({}, rv.opts);
      if (o.bonus && !(save.bonus > 0)) delete o.bonus;
      FX.clear();
      openBooster(o);
      break;
    }
    case 'done':
      closeTheater();
      break;
    case 'share':
      if (dernierTirage) partagerTirage(dernierTirage);
      break;
    /* La scène d'obtention d'une Promo vit dans le même théâtre, mais elle a
       sa propre sortie : voir fermerPromo() dans js/promos.js. */
    case 'promo-ok':
      fermerPromo();
      break;
  }
});
