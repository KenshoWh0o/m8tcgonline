/* Feuille modale (fenêtre qui monte du bas). */
"use strict";

/* ---------- Feuille modale ---------- */
let sheetLocked = false;

function openSheet({ title, body, actions, locked }) {
  sheetLocked = !!locked;
  const w = $('#sheet');
  w.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${title ? `<h3>${h(title)}</h3>` : ''}${body || ''}<div class="acts">${(actions || []).map((a, i) => `<button class="btn ${a.primary ? '' : 'ghost'}" data-si="${i}" ${a.disabled ? 'disabled' : ''}>${h(a.label)}</button>`).join('')}</div></div>`;
  w.hidden = false;
  bindTilt(w);
  w.querySelectorAll('[data-si]').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const a = actions[+b.dataset.si];
      if (a && a.fn) a.fn();
    };
  });
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
  sheetLocked = false;
}

$('#sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet' && !sheetLocked) closeSheet();
});

function showCard(c) {
  openViewer(c);
}

/* ---------- Avatars ---------- */
/* Un avatar est soit une carte possédée (`card:c042`), soit un des visuels
   livrés avec le jeu, soit l'image renvoyée par Discord (une adresse http). */
function avatarSrc(a) {
  a = a || 'star';
  if (a.startsWith('card:')) {
    const c = byId[a.slice(5)];
    return c && c.img ? c.img : ART.star;
  }
  if (a.startsWith('http')) return a;
  return (AVATARS[a] || AVATARS.star).art;
}

function avatarHTML(a, frame, cls) {
  const f = FRAMES[frame] || FRAMES.default;
  const carte = String(a || '').startsWith('card:');
  return `<span class="ava ${cls || ''}${f.prisme ? ' prisme' : ''}${carte ? ' carte' : ''}"
    style="--f1:${f.c1};--f2:${f.c2}"><img src="${avatarSrc(a)}" alt=""></span>`;
}

/* ---------- Petits blocs répétés ---------- */
const shardIco = '<svg class="shard" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 9.5 12 22 4 9.5Z" fill="currentColor" opacity=".9"/><path d="M12 2 4 9.5h16Z" fill="#fff" opacity=".35"/></svg>';

const fmtN = n => String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* Compte à rebours court : « 2 h 40 », « 12 min », « 8 s ». */
function dans(ms) {
  if (ms <= 0) return 'maintenant';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min';
  const hh = Math.floor(m / 60);
  return hh + ' h' + (m % 60 ? ' ' + (m % 60) : '');
}

/* Un écran vide, toujours dessiné pareil. */
const vide = (titre, texte, bouton) =>
  `<div class="empty"><h2 class="ec">${h(titre)}</h2><p class="muted">${h(texte)}</p>${bouton || ''}</div>`;

/* Une section qui n'existe qu'avec un compte. */
const horsLigne = quoi =>
  vide(quoi + ' hors ligne', Backend.dispo
    ? 'Connecte-toi pour retrouver ' + quoi.toLowerCase() + ' sur ton compte.'
    : "Le serveur n'est pas encore branché sur ce site.",
    Backend.dispo ? '<button class="btn" data-act="connexion">Se connecter</button>' : '');

/* ---------- Bandeau de chargement ---------- */
let occupeN = 0;
function occupe(v) {
  occupeN = Math.max(0, occupeN + (v ? 1 : -1));
  document.body.classList.toggle('busy', occupeN > 0);
}

/* Enveloppe une action serveur : curseur d'attente, erreur affichée, rendu final. */
async function agir(fn, msg) {
  occupe(true);
  try {
    await fn();
    if (msg) { toast(msg); SFX.jouer('gagne'); }
    render();
  } catch (e) {
    toast(e.message || 'Quelque chose a raté.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
  }
}
