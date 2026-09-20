/* Visionneuse 3D plein écran d'une carte. */
"use strict";

/* ---------- Visionneuse 3D ---------- */
document.addEventListener('dragstart', e => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

let VW = null;

function openViewer(c) {
  const n = save.col[c.id] || 0;
  const R = RAR[c.rar] || RAR.C;
  const v = $('#viewer');

  v.innerHTML = `<div class="vw-bg" data-v="close"></div><button class="vw-close" data-v="close" aria-label="Fermer">✕</button>
  <div class="vw-stage"><div class="vw-card r${c.rar}" id="vwc">${renderCard(c)}<div class="vw-holo"></div><div class="vw-glare"></div></div></div>
  <div class="vw-shadow" id="vwsh"></div>
  <div class="vw-info"><div class="vw-name">${h(c.nom)}</div><div class="vw-meta"><span class="rc-tag r${c.rar}">${R.nom}</span><span class="vw-num">#${String(c.num || 0).padStart(3, '0')}</span>${n ? `<span class="vw-own">×${n}</span>` : ''}</div></div>
  <p class="vw-hint">Fais glisser la carte pour la faire pivoter</p>`;
  v.hidden = false;

  const el = $('#vwc');
  const sh = $('#vwsh');
  const st = { rx: 0, ry: 0, drag: false, x0: 0, y0: 0, r0x: 0, r0y: 0, vx: 0, vy: 0, lx: 0, ly: 0, t: performance.now() };
  VW = { st, alive: true };
  const me = VW;

  el.addEventListener('pointerdown', e => {
    st.drag = true;
    st.x0 = e.clientX;
    st.y0 = e.clientY;
    st.r0x = st.rx;
    st.r0y = st.ry;
    st.lx = e.clientX;
    st.ly = e.clientY;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!st.drag) return;
    st.ry = Math.max(-60, Math.min(60, st.r0y + (e.clientX - st.x0) * .45));
    st.rx = Math.max(-45, Math.min(45, st.r0x - (e.clientY - st.y0) * .35));
    st.vy = (e.clientX - st.lx) * .45;
    st.vx = -(e.clientY - st.ly) * .35;
    st.lx = e.clientX;
    st.ly = e.clientY;
  });

  const up = () => { st.drag = false; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('dragstart', e => e.preventDefault());

  const frame = now => {
    if (!me.alive) return;
    if (!st.drag) {
      const idleY = RM() ? 0 : Math.sin(now / 1500) * 7;
      const idleX = RM() ? 0 : Math.sin(now / 2100) * 4;
      st.vy *= .9;
      st.vx *= .9;
      st.ry += st.vy;
      st.rx += st.vx;
      st.ry += (idleY - st.ry) * .06;
      st.rx += (idleX - st.rx) * .06;
    }
    el.style.transform = `rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)`;
    el.style.setProperty('--gx', (50 + st.ry * 1.3).toFixed(1) + '%');
    el.style.setProperty('--gy', (40 - st.rx * 1.3).toFixed(1) + '%');
    el.style.setProperty('--hx', (50 + st.ry * 1.6).toFixed(1) + '%');
    sh.style.transform = `translateX(${(-st.ry * .8).toFixed(1)}px) scaleX(${(1 - Math.abs(st.ry) / 200).toFixed(3)})`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function closeViewer() {
  if (VW) VW.alive = false;
  VW = null;
  const v = $('#viewer');
  v.hidden = true;
  v.innerHTML = '';
}

$('#viewer').addEventListener('click', e => {
  if (e.target.closest('[data-v="close"]')) closeViewer();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && VW) closeViewer();
});
