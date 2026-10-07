/* Les briques d'interface partagées par tous les écrans : la feuille modale
   qui monte du bas, les avatars, et les petits blocs qu'on répète — un écran
   vide, un compte à rebours court, l'enveloppe des actions serveur. */
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

/* ---------- Glisser vers le bas pour fermer ---------- */
/* La poignée promet que le panneau repart par où il est venu : on le tire vers
   le bas, il suit le doigt, et lâché assez loin (ou assez vite), il s'en va.
   Même règle que le clic sur le fond : une feuille verrouillée ne se ferme pas
   comme ça, et sur grand écran — feuille centrée, sans poignée — le geste
   n'existe pas.

   Le geste ne vole jamais un défilement : si le contenu (ou un bloc qui défile
   dedans) n'est pas tout en haut, le doigt fait défiler, comme partout. Il ne
   vole pas non plus un glissé horizontal, ni une carte qu'on fait tourner. */
(() => {
  const w = $('#sheet');
  let g = null;

  const defile = el => {
    for (; el && el !== w; el = el.parentElement) if (el.scrollTop > 0) return true;
    return false;
  };
  const sansAnim = () => RM() || document.documentElement.classList.contains('rm');

  w.addEventListener('touchstart', e => {
    g = null;
    const feuille = w.querySelector('.sheet');
    if (sheetLocked || !feuille || e.touches.length > 1 || !feuille.contains(e.target)) return;
    if (getComputedStyle(feuille, '::before').display === 'none') return;
    if (e.target.closest('input,textarea,select,.a3d')) return;
    const t = e.touches[0];
    const poignee = t.clientY - feuille.getBoundingClientRect().top < 28;
    g = { feuille, x0: t.clientX, y0: t.clientY, dy: 0, parti: false,
      defile: !poignee && defile(e.target), y: t.clientY, t: performance.now(), v: 0 };
  }, { passive: true });

  w.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.parti) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      if (g.defile || dy <= 0 || Math.abs(dx) > Math.abs(dy)) { g = null; return; }
      g.parti = true;
      g.feuille.style.animation = 'none';
      g.feuille.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    if (now > g.t) g.v = (t.clientY - g.y) / (now - g.t);
    g.y = t.clientY;
    g.t = now;
    g.dy = Math.max(0, dy);
    g.feuille.style.transform = `translateY(${g.dy}px)`;
  }, { passive: false });

  const lacher = () => {
    const x = g;
    g = null;
    if (!x || !x.parti) return;
    const f = x.feuille;
    const haut = f.offsetHeight;
    if (x.dy > Math.min(haut * .3, 160) || (x.v > .5 && x.dy > 30)) {
      if (sansAnim()) return closeSheet();
      f.style.transition = 'transform .22s cubic-bezier(.4,0,1,1)';
      f.style.transform = `translateY(${haut + 40}px)`;
      w.style.transition = 'opacity .22s';
      w.style.opacity = '0';
      setTimeout(() => {
        w.style.transition = '';
        w.style.opacity = '';
        /* Une autre feuille a pu s'ouvrir entre-temps : on ne ferme que la nôtre. */
        if (f.isConnected) closeSheet();
      }, 220);
    } else {
      f.style.transition = 'transform .28s cubic-bezier(.2,1.1,.4,1)';
      f.style.transform = '';
    }
  };
  w.addEventListener('touchend', lacher);
  w.addEventListener('touchcancel', lacher);
})();

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
  const anim = f.prisme ? ' prisme' : f.sceau ? ' sceau' : f.unique ? ' unique' : '';
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

/* Un moment proche, comme on le dit : « aujourd'hui à 12 h », « demain à
   18 h 30 », « mercredi à 12 h », « le 14 octobre à 12 h ». `lien` le fait
   suivre d'une préposition : « jusqu'à » → « jusqu'à mercredi 12 h »,
   « à partir » → « à partir de demain 12 h ». `t` : un instant de
   l'appareil, en millisecondes. */
function jourHeure(t, lien) {
  const d = new Date(t);
  if (isNaN(d)) return '';
  const minuit = x => new Date(x).setHours(0, 0, 0, 0);
  const j = Math.round((minuit(d) - minuit(Date.now())) / 86400000);
  /* Espaces insécables : « 23 h 49 » ne se coupe pas en fin de ligne. */
  const heure = d.getHours() + '\u00a0h' + (d.getMinutes() ? '\u00a0' + String(d.getMinutes()).padStart(2, '0') : '');
  const jour = j === 0 ? 'aujourd\'hui'
    : j === 1 ? 'demain'
    : j > 1 && j < 7 ? d.toLocaleDateString('fr-FR', { weekday: 'long' })
    : 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  /* Le jour même, l'heure suffit : « jusqu'à 18 h », « à partir de 12 h ». */
  if (lien === 'jusqu\'à') {
    return j === 0 ? `jusqu'à ${heure}` : `jusqu'${jour.startsWith('le ') ? 'au ' + jour.slice(3) : 'à ' + jour} ${heure}`;
  }
  if (lien === 'à partir') {
    return j === 0 ? `à partir de ${heure}` : `à partir ${jour.startsWith('le ') ? 'du ' + jour.slice(3) : 'de ' + jour} ${heure}`;
  }
  return `${jour} à ${heure}`;
}

/* Une date lisible : « 12 sept. à 18:40 ». */
const dateCourte = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/* Depuis quand : « à l'instant », « il y a 12 min », « hier ». Un horodatage
   du serveur, ramené à l'horloge de l'appareil (srvTime, js/backend.js). */
function ilya(iso) {
  const t = srvTime(iso);
  if (isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const hh = Math.floor(m / 60);
  if (hh < 24) return `il y a ${hh} h`;
  const j = Math.floor(hh / 24);
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} j`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
