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
/* Cinq formes possibles :
     'discord'        la photo du compte Discord, toujours à jour
     'card:c042'      une carte possédée
     'ess:rose'       un des dix symboles d'essence
     'star', 'back'…  un visuel livré avec le jeu
     'https://…'      une adresse déposée à l'inscription (ancien format)
   Chacune renvoie une image et la façon de la cadrer : les photos et les cartes
   remplissent le cercle, les symboles restent entiers au centre. */
function avatarInfo(a) {
  a = a || 'star';

  if (a === 'discord') {
    return Backend.photoDiscord
      ? { src: Backend.photoDiscord, plein: true }
      : { src: AVATARS.star.art, ico: true, bg: AVATARS.star.bg };
  }
  if (a.startsWith('card:')) {
    const c = byId[a.slice(5)];
    return c && c.img ? { src: c.img, objet: true } : { src: ART.star, ico: true, bg: '#8936ff' };
  }
  if (a.startsWith('ess:')) {
    const k = a.slice(4);
    const col = COLORS[k] || COLORS.neutre;
    return { src: col.ic, ico: true, bg: col.c };
  }

  if (a.startsWith('http')) return { src: a, plein: true };

  const v = AVATARS[a] || AVATARS.star;
  return { src: v.art, ico: !!v.ico, objet: !!v.objet, bg: v.bg, plein: !v.ico && !v.objet };
}

const avatarSrc = a => avatarInfo(a).src;

/* Trois cadrages, et un seul choix à faire : de quelle forme est l'image ?
     `plein`  une photo, déjà carrée : elle remplit le cercle.
     `ico`    un symbole : il reste entier, au centre, sur un fond de sa couleur.
     `objet`  une carte, un dos, un booster — un rectangle haut. Le forcer dans
              un rond l'écrasait : on le pose entier, et c'est sa propre image
              floutée qui remplit le tour.
   Le fond flouté passe par `--abi`, lu par `.ava.objet::before` (css/hub.css). */
function avatarHTML(a, frame, cls) {
  const f = FRAMES[frame] || FRAMES.default;
  const v = avatarInfo(a);
  const mode = v.ico ? ' ico' : v.objet ? ' objet' : '';
  const vars = [`--f1:${f.c1}`, `--f2:${f.c2}`];
  if (v.bg) vars.push('--ab:' + v.bg);
  if (v.objet) vars.push(`--abi:url("${encodeURI(v.src)}")`);
  return `<span class="ava ${cls || ''}${f.prisme ? ' prisme' : ''}${mode}"
    style="${vars.join(';')}"><img src="${v.src}" alt=""></span>`;
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

/* Enveloppe une action serveur : curseur d'attente, erreur affichée, rendu final.
   Renvoie `true` si le serveur a dit oui — les appelants qui enchaînent quelque
   chose derrière (une confirmation, une animation) ont besoin de le savoir,
   sinon ils fêtent un achat que le serveur a refusé. */
async function agir(fn, msg) {
  occupe(true);
  try {
    await fn();
    if (msg) { toast(msg); SFX.jouer('gagne'); }
    render();
    return true;
  } catch (e) {
    toast(e.message || 'Quelque chose a raté.');
    SFX.jouer('erreur');
    return false;
  } finally {
    occupe(false);
  }
}
