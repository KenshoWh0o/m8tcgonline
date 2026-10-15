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
  v.dataset.id = c.id;
  /* Version 3.0.7 : sous la carte, un mini-menu à trois pages qu'on fait
     glisser du doigt (ou qu'on touche) — Infos, Maîtrise, Gérer. La page
     choisie reste d'une carte à l'autre. */
  const ong = (VW && VW.ong) || vwOngletRetenu;

  v.innerHTML = `<div class="vw-bg" data-v="close"></div><button class="vw-close" data-v="close" aria-label="Fermer">✕</button>${vFavVw(c)}
  <div class="vw-stage"><div class="vw-card r${c.rar}" id="vwc">${vCarteVw(c)}</div></div>
  <div class="vw-shadow" id="vwsh"></div>
  <div class="vw-info"><div class="vw-name">${h(c.nom)}</div><div class="vw-meta"><span class="rc-tag r${c.rar}">${R.nom}</span>${c.rev ? '<span class="rc-tag rev">Reverse</span>' : ''}<span class="vw-col">${essIcon(c.col)}${colOf(c).nom}</span><span class="vw-num">${c.promo ? h(c.code) : '#' + String(c.num || 0).padStart(3, '0')}</span><span class="vw-own${n ? '' : ' zero'}">${n ? `Tu en as ${n}` : 'Tu ne l\'as pas'}</span>${lui != null ? `<span class="vw-own autre">${h(qui)} en a ${lui}</span>` : ''}</div></div>
  <section class="vw-fiche" aria-label="Fiche de la carte">
    <div class="vw-ongs" role="tablist">${VW_ONGLETS.map(([k, nom], i) => `<button role="tab" data-v="ong" data-o="${k}" aria-selected="${k === ong}"${k === ong ? ' class="on"' : ''}>${nom}${k === 'maitrise' ? `<span class="vw-ong-mz">${insigneMaitrise(maitrisable(c) ? niveauMaitrise(c) : 0)}</span>` : ''}</button>`).join('')}<i class="vw-ong-barre" style="--i:${Math.max(0, VW_ONGLETS.findIndex(x => x[0] === ong))}"></i></div>
    <div class="vw-pages">${VW_ONGLETS.map(([k]) => `<div class="vw-page" role="tabpanel" data-p="${k}">${vPageVw(k, c)}</div>`).join('')}</div>
  </section>
  <p class="vw-hint">Fais glisser la carte pour la faire pivoter</p>`;
  v.hidden = false;

  const el = $('#vwc');
  const sh = $('#vwsh');
  const st = { rx: 0, ry: 0, drag: false, x0: 0, y0: 0, r0x: 0, r0y: 0, vx: 0, vy: 0, lx: 0, ly: 0,
    grx: 0, gry: 0, t: performance.now() };
  VW = { st, alive: true, c, ong, apercu: 0 };
  const me = VW;
  brancherPagesVw(ong);

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
      const idleY = st.gry + (vwCalme() ? 0 : Math.sin(now / 1500) * 7);
      const idleX = st.grx + (vwCalme() ? 0 : Math.sin(now / 2100) * 4);
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

/* ---------- La fiche : Infos, Maîtrise, Gérer (version 3.0.7) ---------- */
const vwTous = s => [...document.querySelectorAll(s)];
/* Les mouvements réduits : ceux du système, ou le réglage du jeu. */
const vwCalme = () => RM() || document.documentElement.classList.contains('rm');
const VW_ONGLETS = [['infos', 'Infos'], ['maitrise', 'Maîtrise'], ['gerer', 'Gérer']];
let vwOngletRetenu = 'infos';

/* La carte de la visionneuse, avec sa maîtrise (ou l'aperçu du niveau
   suivant, le temps de le regarder). */
function vCarteVw(c) {
  const m = VW && VW.c === c && VW.apercu ? VW.apercu : maitrisable(c) ? niveauMaitrise(c) : 0;
  return renderCard(c, { m }) + '<div class="vw-holo"></div><div class="vw-glare"></div>';
}

function vPageVw(k, c) {
  if (k === 'infos') return vInfosVw(c);
  if (k === 'maitrise') return vMaitriseFiche(c);
  return vGererVw(c);
}

/* Ce que la carte fait en combat, dans le style de la carte agrandie de
   l'arène : la Défense, les attaques (coût, nom, effet, dégâts), le mot-clé
   et les talents, la Résilience ; le texte d'un Objet, d'un Moment, d'un
   Coach. */
const VW_TYPE = { joueur: 'Joueur', objet: 'Objet', moment: 'Moment', coach: 'Coach', essence: 'Essence' };
const VW_COACH = { objet: 'Lié à un Joueur, il le renforce tant qu\'il reste en jeu (3 au plus par Joueur).',
  moment: 'Un effet, à jouer autant que tu veux pendant ton tour.', coach: 'Un effet, un seul Coach par tour.',
  essence: 'Elle paie les attaques. Une Réserve compte dix Essences.' };
function vInfosVw(c) {
  const cout = x => (typeof Table !== 'undefined' && Table.coutHTML ? Table.coutHTML(x || {}) : '');
  const l = [];
  if (c.cachee) l.push('<p class="vw-i-texte">Cette Secrète n\'est pas encore révélée.</p>');
  else if (c.cat === 'joueur') {
    l.push(`<div class="vw-i-tete"><span class="ar-f-defv" aria-label="Défense ${c.def}">${VW_DEF}<small>Déf</small><b>${c.def != null ? c.def : '?'}</b></span><span class="vw-i-type">Joueur${c.sous ? ' · ' + h(c.sous) : ''}</span></div>`);
    l.push(`<div class="ar-f-atqs">${(c.atks || []).map(a => `<div class="ar-f-atq lu">${cout(a.cout)}<span class="ar-f-at"><b>${h(a.nom)}</b>${a.effet ? `<small>${h(a.effet)}</small>` : ''}</span>${a.degats == null ? '' : `<em>${a.degats}</em>`}</div>`).join('')}</div>`);
    const puces = [];
    if (c.kw) puces.push(`<span class="ar-puce kw"><b>${h(c.kw.nom)}</b> ${h(c.kw.texte)}</span>`);
    (c.talents || []).forEach(t => puces.push(`<span class="ar-puce kw"><b>${h(t.nom)}</b> ${h(t.texte)}</span>`));
    if (puces.length) l.push(`<div class="vw-i-puces">${puces.join('')}</div>`);
  } else {
    l.push(`<div class="vw-i-tete"><span class="vw-i-type">${VW_TYPE[c.cat] || ''}</span></div>`);
    if ((c.fx || []).length) l.push(`<div class="vw-i-texte">${c.fx.map(t => `<p>${h(t)}</p>`).join('')}</div>`);
    if (VW_COACH[c.cat]) l.push(`<p class="vw-i-aide">${VW_COACH[c.cat]}</p>`);
  }
  if (c.res) l.push(`<p class="vw-i-res"><b>Résilience</b> ${h(c.res)}<small>Jouée gratuitement quand la carte sort de tes PV.</small></p>`);
  if (c.promo) l.push(`<p class="vw-promo">${h(promoSousTitre(c))}${c.illustrateur ? ' · Illustration : ' + h(c.illustrateur) : ''}</p>`);
  if (c.secrete) l.push(`<p class="vw-promo">Secrète ${h(c.code)} — hors des ${cards.length}, ${c.cachee ? 'pas encore révélée' : 'Illustration : ' + h(c.illustrateur || '?')}. Elle s'échange, mais ne se recycle ni ne se fabrique.</p>`);
  return l.join('');
}
const VW_DEF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z"/></svg>';

/* Gérer : combien en garder, la carte fétiche. */
function vGererVw(c) {
  /* Le favori est le cœur en haut de la fiche (version 3.0.8 : plus de
     doublon ici). Deux réglages, chacun sur une ligne. */
  const fet = (save.fetiche || null) === c.id;
  const possede = mesEx(c.id) > 0;
  const enLigne = Backend.mode === 'cloud';
  return `<div class="vw-g">
    ${enLigne && !c.promo && possede ? `<div class="vw-g-ligne"><span><b>À garder</b><small>Ni recyclés, ni pris par la maîtrise.</small></span><div class="vw-gardebox">${vGardeVw(c)}</div></div>` : ''}
    <div class="vw-g-ligne"><span><b>Carte fétiche</b><small>${fet ? 'C\'est elle qu\'on voit en premier sur ton profil.' : 'En avant sur ton profil et ta fiche de joueur.'}</small></span>
      ${!enLigne ? '<small class="vw-g-non">En ligne</small>' : possede || fet
        ? `<button class="btn tiny${fet ? ' ghost' : ''}" data-v="fetiche">${fet ? 'Retirer' : 'Choisir'}</button>`
        : '<small class="vw-g-non">Pas dans ta collection</small>'}</div>
  </div>`;
}

/* Les pages glissent en scroll-snap : l'onglet suit le doigt, et toucher un
   onglet fait glisser jusqu'à sa page. */
function brancherPagesVw(ong) {
  const pages = $('#viewer .vw-pages');
  if (!pages) return;
  const i0 = Math.max(0, VW_ONGLETS.findIndex(x => x[0] === ong));
  pages.scrollLeft = i0 * pages.clientWidth;
  hauteurPagesVw();
  let raf = 0;
  pages.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
      majOngletVw(VW_ONGLETS[Math.max(0, Math.min(VW_ONGLETS.length - 1, i))][0]);
    });
  }, { passive: true });
}
function majOngletVw(k) {
  if (!VW) return;
  VW.ong = vwOngletRetenu = k;
  const i = VW_ONGLETS.findIndex(x => x[0] === k);
  vwTous('#viewer .vw-ongs [data-o]').forEach(b => { const on = b.dataset.o === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const barre = $('#viewer .vw-ong-barre');
  if (barre) barre.style.setProperty('--i', i);
  hauteurPagesVw();
}
/* Les pages n'ont pas la même hauteur : le cadre prend celle de la page
   montrée, sans quoi Infos laissait sous elle le vide de la page Maîtrise. */
function hauteurPagesVw() {
  const pages = $('#viewer .vw-pages');
  const i = Math.max(0, VW_ONGLETS.findIndex(x => x[0] === (VW && VW.ong)));
  const p = pages && pages.children[i];
  if (p) pages.style.height = p.scrollHeight + 'px';
}
function allerOngletVw(k) {
  const pages = $('#viewer .vw-pages');
  const i = VW_ONGLETS.findIndex(x => x[0] === k);
  if (!pages || i < 0) return;
  SFX.jouer('tap');
  majOngletVw(k);
  pages.scrollTo({ left: i * pages.clientWidth, behavior: vwCalme() ? 'auto' : 'smooth' });
}

/* Après une maîtrise, un choix de carte fétiche : la carte et les pages se
   redessinent en place. `eclair` : un éclair traverse la carte — elle vient
   de changer d'allure sous les yeux. */
function rafraichirFicheVw(eclair) {
  if (!VW) return;
  const c = VW.c;
  VW.apercu = 0;
  const el = $('#vwc');
  if (el) {
    el.innerHTML = vCarteVw(c);
    if (eclair && !vwCalme()) { el.classList.remove('vw-eclair'); void el.offsetWidth; el.classList.add('vw-eclair'); }
  }
  for (const [k] of VW_ONGLETS) {
    if (k === 'infos') continue;
    const p = $(`#viewer .vw-page[data-p="${k}"]`);
    if (p) p.innerHTML = vPageVw(k, c);
  }
  hauteurPagesVw();
  const ins = $('#viewer .vw-ong-mz');
  if (ins) ins.innerHTML = insigneMaitrise(maitrisable(c) ? niveauMaitrise(c) : 0);
  const own = $('#viewer .vw-own:not(.autre)');
  const n = save.col[c.id] || 0;
  if (own) { own.classList.toggle('zero', !n); own.textContent = n ? `Tu en as ${n}` : 'Tu ne l\'as pas'; }
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
    <button data-v="g-" aria-label="Garder un exemplaire de moins" ${g <= 1 ? 'disabled' : ''}>−</button>
    <b class="tnum">${g === GARDE_TOUT ? 'Tous' : g}</b>
    <button data-v="g+" aria-label="Garder un exemplaire de plus" ${g >= GARDE_TOUT ? 'disabled' : ''}>+</button>
    ${perso ? '<button class="vw-gdef" data-v="g0">Comme sa rareté</button>' : '<small>selon sa rareté</small>'}
  </div>`;
}

/* ---------- Le cœur (version 2.1) ---------- */
/* En haut à gauche, en face de la croix. Rien que pour soi : il sert à
   retrouver ses cartes préférées dans la Collection (filtre « Mes
   favoris »). On peut aimer une carte qu'on n'a pas, ou plus. */
const vFavVw = c => `<button class="vw-fav${estFavori(c) ? ' on' : ''}" data-v="fav"
  aria-pressed="${estFavori(c)}" aria-label="${estFavori(c) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${NAVICO.coeur}</button>`;

async function basculerFavoriVw() {
  const c = VW && VW.c;
  if (!c) return;
  const on = !estFavori(c);
  const maj = () => vwTous('#viewer [data-v="fav"]').forEach(b => {
    b.classList.toggle('on', estFavori(c));
    b.setAttribute('aria-pressed', estFavori(c));
    b.setAttribute('aria-label', estFavori(c) ? 'Retirer des favoris' : 'Ajouter aux favoris');
  });
  /* Tout de suite à l'écran ; le serveur suit. */
  save.favoris = on ? (save.favoris || []).concat(c.id) : (save.favoris || []).filter(id => id !== c.id);
  maj();
  if (on) vwTous('#viewer [data-v="fav"]').forEach(b => { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
  SFX.jouer(on ? 'tap' : 'retour');
  if (on) vibrer(12);
  try {
    await Backend.favori(c.id, on);
  } catch (e) {
    toast(e.message || 'Le cœur n\'est pas passé.');
    await Backend.pull().catch(() => {});
    maj();
  }
  render();
}

let gardeEnvoi = null;
function changerGardeVw(sens) {
  const c = VW && VW.c;
  if (!c) return;
  const defaut = gardeRarete(c);
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
  if (e.target.closest('[data-v="fav"]')) return basculerFavoriVw();
  const o = e.target.closest('[data-v="ong"]');
  if (o) return allerOngletVw(o.dataset.o);
  if (e.target.closest('[data-v="maitriser"]')) return maitriserVw();
  const mv = e.target.closest('[data-v="mz-voir"]');
  if (mv) return voirNiveauVw(+mv.dataset.n);
  if (e.target.closest('[data-v="fetiche"]')) return choisirFeticheVw();
  const g = e.target.closest('[data-v^="g"]');
  if (g) changerGardeVw(g.dataset.v === 'g+' ? 1 : g.dataset.v === 'g-' ? -1 : 0);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && VW) closeViewer();
});

