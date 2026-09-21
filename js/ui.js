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
/* Ma photo Discord à moi, lue dans ma session. À ne passer qu'en dessinant mon
   propre avatar : pour tous les autres, c'est le serveur qui fournit l'adresse
   (voir photo_discord() dans supabase/01_schema.sql). */
const maPhoto = () => Backend.photoDiscord;

/* Cinq formes possibles :
     'discord'        la photo du compte Discord, toujours à jour
     'card:c042'      une carte possédée
     'ess:rose'       un des dix symboles d'essence
     'star', 'back'…  un visuel livré avec le jeu
     'https://…'      une adresse déposée à l'inscription (ancien format)
   Chacune renvoie une image et la façon de la cadrer : les photos et les cartes
   remplissent le cercle, les symboles restent entiers au centre. */
function avatarInfo(a, photo) {
  a = a || 'star';

  /* `photo` est l'adresse de la photo Discord DU JOUEUR AFFICHE. Elle est
     obligatoire, et il n'y a volontairement aucun repli sur la session en
     cours : c'est ce repli qui causait le bug où chacun voyait ses amis avec
     sa propre photo. Sans adresse, on retombe sur l'étoile — un avatar
     générique se remarque et se corrige, le visage de quelqu'un d'autre passe
     inaperçu et induit en erreur. */
  if (a === 'discord') {
    return photo
      ? { src: photo, plein: true }
      : { src: AVATARS.star.art, ico: true, bg: AVATARS.star.bg };
  }
  /* `pos` : où viser en recadrant. L'illustration d'une carte occupe le haut ;
     viser le centre aurait cadré sur la ligne d'attaque. */
  if (a.startsWith('card:')) {
    const c = byId[a.slice(5)];
    return c && c.img ? { src: c.img, objet: true, pos: '30%' } : { src: ART.star, ico: true, bg: '#8936ff' };
  }
  if (a.startsWith('ess:')) {
    const k = a.slice(4);
    const col = COLORS[k] || COLORS.neutre;
    return { src: col.ic, ico: true, bg: col.c };
  }

  if (a.startsWith('http')) return { src: a, plein: true };

  const v = AVATARS[a] || AVATARS.star;
  return { src: v.art, ico: !!v.ico, objet: !!v.objet, bg: v.bg, pos: v.pos,
    plein: !v.ico && !v.objet };
}

const avatarSrc = (a, photo) => avatarInfo(a, photo).src;

/* Trois cadrages, et un seul choix à faire : de quelle forme est l'image ?
     `plein`  une photo, déjà carrée : elle remplit le cercle.
     `ico`    un symbole : il reste entier, au centre, sur un fond de sa couleur.
     `objet`  une carte, un dos, un booster — un rectangle haut. Il remplit le
              cercle par recadrage, jamais par étirement : `--apos` dit où
              viser, parce que l'endroit intéressant n'est pas au milieu.
   Le cadre animé (Prisme, Sceau) est posé en classe, ses couleurs en variables.

   `photo` : l'adresse de la photo Discord du joueur qu'on dessine. Pour soi,
   c'est `maPhoto()` ; pour quelqu'un d'autre, c'est le champ `photo` renvoyé
   par le serveur. Ne rien passer dessine l'étoile — jamais le visage d'un
   autre. */
function avatarHTML(a, frame, cls, photo) {
  const f = FRAMES[frame] || FRAMES.default;
  const v = avatarInfo(a, photo);
  const mode = v.ico ? ' ico' : v.objet ? ' objet' : '';
  const anim = f.prisme ? ' prisme' : f.sceau ? ' sceau' : '';
  const vars = [`--f1:${f.c1}`, `--f2:${f.c2}`];
  if (v.bg) vars.push('--ab:' + v.bg);
  if (v.pos) vars.push('--apos:' + v.pos);
  return `<span class="ava ${cls || ''}${anim}${mode}"
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
