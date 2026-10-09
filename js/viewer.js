/* Visionneuse 3D plein écran d'une carte. */
"use strict";

/* ---------- Visionneuse 3D ---------- */
document.addEventListener('dragstart', e => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

let VW = null;

/* `qui` : le pseudo du joueur avec qui on est en train d'échanger, quand la
   carte est ouverte depuis un écran d'échange. Sa collection est alors déjà
   connue, et son compte s'affiche à côté du nôtre : c'est exactement ce qu'on
   vient vérifier avant d'accepter. */
function openViewer(c, qui) {
  const n = save.col[c.id] || 0;
  const lui = qui ? sesEx(qui, c.id) : null;
  const R = RAR[c.rar] || RAR.C;
  const v = $('#viewer');

  v.innerHTML = `<div class="vw-bg" data-v="close"></div><button class="vw-close" data-v="close" aria-label="Fermer">✕</button>
  <div class="vw-stage"><div class="vw-card r${c.rar}" id="vwc">${renderCard(c)}<div class="vw-holo"></div><div class="vw-glare"></div></div></div>
  <div class="vw-shadow" id="vwsh"></div>
  <div class="vw-info"><div class="vw-name">${h(c.nom)}</div><div class="vw-meta"><span class="rc-tag r${c.rar}">${R.nom}</span>${c.rev ? '<span class="rc-tag rev">Reverse</span>' : ''}<span class="vw-col">${essIcon(c.col)}${colOf(c).nom}</span><span class="vw-num">${c.promo ? h(c.code) : '#' + String(c.num || 0).padStart(3, '0')}</span><span class="vw-own${n ? '' : ' zero'}">${n ? `Tu en as ${n}` : 'Tu ne l\'as pas'}</span>${lui != null ? `<span class="vw-own autre">${h(qui)} en a ${lui}</span>` : ''}</div></div>
  <div class="vw-gardebox">${vGardeVw(c)}</div>
  ${c.promo ? `<p class="vw-promo">${h(promoSousTitre(c))}${c.illustrateur ? ' · Illustration : ' + h(c.illustrateur) : ''}</p>` : ''}
  <p class="vw-hint">Fais glisser la carte pour la faire pivoter</p>`;
  v.hidden = false;

  const el = $('#vwc');
  const sh = $('#vwsh');
  const st = { rx: 0, ry: 0, drag: false, x0: 0, y0: 0, r0x: 0, r0y: 0, vx: 0, vy: 0, lx: 0, ly: 0,
    grx: 0, gry: 0, t: performance.now() };
  VW = { st, alive: true, c };
  const me = VW;

  /* L'inclinaison de l'appareil fait tourner la carte, comme à l'ouverture d'un
     booster. Branché ici, c'est-à-dire pendant la pression qui ouvre la
     visionneuse : sur iPhone, l'autorisation ne s'obtient pas autrement. */
  me.debrancherGyro = brancherGyro((rx, ry) => { st.grx = rx; st.gry = ry; });

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
      /* Au repos, la carte oscille doucement. L'inclinaison de l'appareil
         s'ajoute à ce balancement : elle le déplace, elle ne le remplace pas. */
      const idleY = st.gry + (RM() ? 0 : Math.sin(now / 1500) * 7);
      const idleX = st.grx + (RM() ? 0 : Math.sin(now / 2100) * 4);
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

/* ---------- Combien j'en garde (version 2.1) ---------- */
/* Réglé ici, carte par carte (supabase/22_garder.sql). Le chiffre change tout
   de suite ; le serveur n'est prévenu qu'une fois les appuis finis, et la
   visionneuse ne se rouvre pas : la carte reste où on l'a tournée. */
function vGardeVw(c) {
  if (Backend.mode !== 'cloud' || c.promo || !mesEx(c.id)) return '';
  const g = aGarder(c);
  const perso = (save.gardes || {})[c.id] != null;
  return `<div class="vw-garde">
    <span class="vw-glab">Garder</span>
    <button data-v="g-" aria-label="Garder un exemplaire de moins" ${g <= 1 ? 'disabled' : ''}>−</button>
    <b class="tnum">${g === GARDE_TOUT ? 'Tous' : g}</b>
    <button data-v="g+" aria-label="Garder un exemplaire de plus" ${g >= GARDE_TOUT ? 'disabled' : ''}>+</button>
    ${perso ? '<button class="vw-gdef" data-v="g0">Comme sa rareté</button>' : '<small>selon sa rareté</small>'}
  </div>`;
}

let gardeEnvoi = null;
function changerGardeVw(sens) {
  const c = VW && VW.c;
  if (!c) return;
  const defaut = Math.max(1, (save.garder || {})[c.rar] || 1);
  const g = aGarder(c);
  let n = sens === 0 ? defaut
    : sens > 0 ? (g >= 10 ? GARDE_TOUT : g + 1)
    : (g === GARDE_TOUT ? 10 : Math.max(1, g - 1));
  save.gardes = Object.assign({}, save.gardes);
  if (n === defaut) delete save.gardes[c.id]; else save.gardes[c.id] = n;
  SFX.jouer(sens > 0 ? 'tap' : 'retour');
  const box = $('#viewer .vw-gardebox');
  if (box) box.innerHTML = vGardeVw(c);

  clearTimeout(gardeEnvoi);
  gardeEnvoi = setTimeout(async () => {
    try {
      await Backend.reglerGarde(c.id, n === defaut ? null : n);
    } catch (e) {
      toast(e.message || 'Le réglage n\'est pas passé.');
      await Backend.pull().catch(() => {});
    }
    if (VW && VW.c === c) { const b = $('#viewer .vw-gardebox'); if (b) b.innerHTML = vGardeVw(c); }
    render();
  }, 600);
}

function closeViewer() {
  if (VW) {
    VW.alive = false;
    if (VW.debrancherGyro) VW.debrancherGyro();
  }
  VW = null;
  const v = $('#viewer');
  v.hidden = true;
  v.innerHTML = '';
}

$('#viewer').addEventListener('click', e => {
  if (e.target.closest('[data-v="close"]')) return closeViewer();
  const g = e.target.closest('[data-v^="g"]');
  if (g) changerGardeVw(g.dataset.v === 'g+' ? 1 : g.dataset.v === 'g-' ? -1 : 0);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && VW) closeViewer();
});
