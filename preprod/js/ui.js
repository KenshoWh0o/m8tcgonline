/* Les briques d'interface partagées par tous les écrans : la feuille modale
   qui monte du bas, les avatars, et les petits blocs qu'on répète — un écran
   vide, un compte à rebours court, l'enveloppe des actions serveur. */
"use strict";

/* ---------- Feuille modale ---------- */
/* Une vraie fenêtre de dialogue (3.0.13) : nommée par son titre, le focus y
   entre à l'ouverture, Tab y tourne en rond sans s'échapper derrière, Échap
   la ferme (sauf verrouillée), et le focus revient à ce qui l'a ouverte. */
let sheetLocked = false;
let sheetRetour = null;
const FOCUSABLES = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

function openSheet({ title, body, actions, locked, cls }) {
  sheetLocked = !!locked;
  const w = $('#sheet');
  if (w.hidden) sheetRetour = document.activeElement;
  w.innerHTML = `<div class="sheet${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true" tabindex="-1"${title ? ' aria-labelledby="sheet-titre"' : ''}>${title ? `<h3 id="sheet-titre">${h(title)}</h3>` : ''}${body || ''}<div class="acts">${(actions || []).map((a, i) => `<button class="btn ${a.primary ? '' : 'ghost'}" data-si="${i}" ${a.disabled ? 'disabled' : ''}>${h(a.label)}</button>`).join('')}</div></div>`;
  w.hidden = false;
  w.querySelectorAll('[data-si]').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const a = actions[+b.dataset.si];
      if (a && a.fn) a.fn();
    };
  });
  const d = w.querySelector('.sheet');
  if (d && !d.contains(document.activeElement)) d.focus({ preventScroll: true });
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
  sheetLocked = false;
  const r = sheetRetour;
  sheetRetour = null;
  if (r && r.isConnected && typeof r.focus === 'function' && r !== document.body) r.focus({ preventScroll: true });
}

document.addEventListener('keydown', e => {
  const w = $('#sheet');
  if (w.hidden) return;
  /* Échap ferme la feuille, et rien d'autre (preventDefault : la fiche ou
     le tiroir dessous le lisent). Verrouillée, elle ne se ferme pas, et rien
     dessous non plus. */
  if (e.key === 'Escape') {
    e.preventDefault();
    if (!sheetLocked) closeSheet();
    return;
  }
  if (e.key !== 'Tab') return;
  const f = [...w.querySelectorAll(FOCUSABLES)].filter(x => x.getClientRects().length);
  if (!f.length) { e.preventDefault(); return; }
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
});

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
  const sansAnim = RM;

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
   (voir photo_discord() dans supabase/installation/01_schema.sql). */
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
  /* Une carte : cadrée sur son illustration, comme Devine l'illu
     (`.ava.carte`, css/reflets.css), pas sur la carte entière. */
  if (a.startsWith('card:')) {
    const c = byId[a.slice(5)];
    return c && c.img ? { src: c.img, carte: true } : { src: ART.star, ico: true, bg: '#8936ff' };
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
/* `xp` (version 3.0) : l'XP de combattant du joueur. Donné, son niveau se
   pose en pastille en bas à droite, partout où son cadre s'affiche ; absent
   (un aperçu de cadre, un sélecteur), l'avatar seul. */
function avatarHTML(a, frame, cls, photo, xp) {
  const f = FRAMES[frame] || FRAMES.default;
  const v = avatarInfo(a, photo);
  const mode = v.ico ? ' ico' : v.carte ? ' objet carte' : v.objet ? ' objet' : '';
  /* `fx` : un cadre décoré, une illustration autour de l'avatar (css/reflets.css). */
  const anim = f.unique ? ' unique' : f.fx ? ' fx fx-' + f.fx : '';
  const vars = [`--f1:${f.c1}`, `--f2:${f.c2}`];
  if (v.bg) vars.push('--ab:' + v.bg);
  if (v.pos) vars.push('--apos:' + v.pos);
  const html = `<span class="ava ${cls || ''}${anim}${mode}"
    style="${vars.join(';')}">${v.carte ? `<span class="ava-illu"><img src="${v.src}" alt=""></span>` : `<img src="${v.src}" alt="">`}${f.fx ? '<i class="fx-deco" aria-hidden="true"></i>' : ''}</span>`;
  return xp == null ? html : avatarNiveau(html, xp, cls);
}

/* Version 3.0 : l'avatar, son niveau de combattant posé en bas à droite
   (js/combat/niveaux.js). `xp` absent : l'avatar seul. */
function avatarNiveau(html, xp, cls) {
  if (xp == null || typeof niveauDe !== 'function') return html;
  const n = niveauDe(xp).niveau;
  return `<span class="ava-nivw ${cls || ''}">${html}<i class="ava-niv tnum" title="Niveau ${n}" aria-label="Niveau ${n}">${n}</i></span>`;
}
/* L'XP du joueur lui-même : son niveau suit son avatar comme celui des autres. */
const monXp = () => (typeof cbEtat === 'function' ? cbEtat().xp : null);

/* L'illustration d'une carte, recadrée dans une case de n'importe quelle
   forme (version 3.0.7). Toutes les cartes suivent le même gabarit (1000 ×
   1397, l'illustration de (85, 205) à (895, 684)) : la case montre
   l'illustration seule — jamais le titre ni le cadre de la carte —, la
   couvre entièrement, et garde au centre le point (fx, fy) de
   l'illustration (0 à 1), le visage en général. Le calcul est dans
   css/base.css (.illu-cadre). `zoom` > 1 resserre sur ce point. */
function illuCadre(id, fx, fy, zoom) {
  const c = typeof id === 'string' ? byId[id] : id;
  if (!c || !c.img) return '';
  return `<span class="illu-cadre" aria-hidden="true" style="--fx:${fx == null ? .5 : fx};--fy:${fy == null ? .35 : fy}${zoom ? `;--z:${zoom}` : ''}"><i style="background-image:url('${h(c.img)}')"></i></span>`;
}

/* ---------- Petits blocs répétés ---------- */
const shardIco = '<svg class="shard" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 9.5 12 22 4 9.5Z" fill="currentColor" opacity=".9"/><path d="M12 2 4 9.5h16Z" fill="#fff" opacity=".35"/></svg>';

/* Le Prisme, monnaie de l'événement (version 2.0). */
const prismeIco = '<svg class="prismeico" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="prg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7cc8"/><stop offset=".5" stop-color="#b38cff"/><stop offset="1" stop-color="#7fd8ff"/></linearGradient></defs><path d="M12 2.5 21 18.5H3Z" fill="url(#prg)"/><path d="M12 2.5 9.4 18.5h5.2Z" fill="#fff" opacity=".35"/></svg>';

/* L'Étincelle, monnaie du Choc des Sections (version 3.0) : quand Toxique
   et Déter se heurtent, ça fait des étincelles. Une étoile à quatre
   branches, verte à gauche et violette à droite (les deux Sections, coupées
   comme la bannière), un cœur blanc, deux éclats autour. Lisible à 14 px :
   une forme franche, pas de détail qui se brouille. */
const etincelleIco = '<svg class="prismeico etincelleico" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="etg" x1="0" y1="0" x2="1" y2="0"><stop offset=".22" stop-color="#62d84e"/><stop offset=".48" stop-color="#e9ffe0"/><stop offset=".52" stop-color="#ece6ff"/><stop offset=".78" stop-color="#9b70ff"/></linearGradient><radialGradient id="etc"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M12 1.2C13.1 7.7 16.3 10.9 22.8 12 16.3 13.1 13.1 16.3 12 22.8 10.9 16.3 7.7 13.1 1.2 12 7.7 10.9 10.9 7.7 12 1.2Z" fill="url(#etg)"/><circle cx="12" cy="12" r="4.6" fill="url(#etc)"/><path d="M19.4 2.4 20 4 21.6 4.6 20 5.2 19.4 6.8 18.8 5.2 17.2 4.6 18.8 4Z" fill="#c4b5fd"/><path d="M4.6 17.2 5.1 18.5 6.4 19 5.1 19.5 4.6 20.8 4.1 19.5 2.8 19 4.1 18.5Z" fill="#b7f29a"/></svg>';

/* La Braise, monnaie de L'Échauffement (version 2.5) : une flamme lavande,
   les couleurs de l'événement, et son cœur chaud. Lisible à 14 px : une
   forme franche, deux tons. */
const braiseIco = '<svg class="prismeico braiseico" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="brg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffcf8a"/><stop offset=".45" stop-color="#c8b4ff"/><stop offset="1" stop-color="#8a78f5"/></linearGradient></defs><path d="M12 2.4c1.6 3.5 6.2 5.7 6.2 11.1a6.2 6.2 0 0 1-12.4 0c0-2.7 1.3-4.5 2.8-5.8.1 2 .9 3.2 2.1 3.5-.5-3.1.1-6 1.3-8.8Z" fill="url(#brg)"/><path d="M12 12.4c1.5 1.5 2.7 2.7 2.7 4.5a2.7 2.7 0 0 1-5.4 0c0-1.6 1.1-3 2.7-4.5Z" fill="#fff4dc" opacity=".92"/></svg>';

/* L'icône de la monnaie de l'événement en cours (MONNAIES_EV, js/config.js). */
const evIco = () => ({ choc: etincelleIco, echauffement: braiseIco }[evMonnaieCode()] || prismeIco);

/* Les milliers sont séparés par une espace insécable : « 2 000 » ne se coupe
   jamais en fin de ligne. */
const fmtN = n => String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

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
    /* La feuille « Personnaliser » (3.0.13) montre le nouveau choix. */
    if (typeof rafraichirPerso === 'function') rafraichirPerso();
    return true;
  } catch (e) {
    toast(e.message || 'Quelque chose a raté.');
    SFX.jouer('erreur');
    return false;
  } finally {
    occupe(false);
  }
}

/* ---------- Les bandes qui défilent de côté (3.0.14) ---------- */
/* Les rangées de puces (filtres de la Collection et de l'atelier, onglets
   d'un événement, amis d'un échange, rendez-vous du jour…) défilent au doigt
   sur téléphone, mais une souris ne sait pas « glisser » : sur ordinateur,
   ce qui dépassait à droite était hors d'atteinte (le propriétaire, 1er
   novembre 2026 : « C'est un gros problème »). Trois gestes, pour toutes
   les bandes à la fois, trouvées d'après leur style (overflow-x qui défile
   et un contenu plus large que la bande) :
   - tirer à la souris, bouton enfoncé : la bande suit ; le clic qui finit
     un glissé ne déclenche rien ;
   - la molette, sur une bande basse (une rangée de puces ou d'onglets) :
     elle défile de côté, et rend la main à la page une fois au bout ;
   - un fondu sur le bord qui cache encore quelque chose (`bd-g`, `bd-d`,
     css/base.css), pour qu'on sache qu'il y a une suite.
   Les pavés de texte (code SQL du Labo) et les pages d'une fiche de carte,
   qui ont leur propre geste, sont exclus. */
(function () {
  const EXCLUS = '.vw-pages,.labsql,input,textarea,select,[data-nodrag]';
  const defile = x => {
    if (x.scrollWidth <= x.clientWidth + 1) return false;
    const o = getComputedStyle(x).overflowX;
    return o === 'auto' || o === 'scroll';
  };
  /* La bande sous le pointeur : le premier ancêtre qui défile de côté. */
  function bande(el) {
    for (let x = el; x && x.nodeType === 1 && x !== document.body; x = x.parentElement) {
      if (x.matches(EXCLUS)) return null;
      if (defile(x)) return x;
    }
    return null;
  }
  /* Les fondus des bords. */
  function bords(x) {
    const max = x.scrollWidth - x.clientWidth;
    const d = max > 1 && getComputedStyle(x).overflowX !== 'visible';
    x.classList.toggle('bd-g', d && x.scrollLeft > 2);
    x.classList.toggle('bd-d', d && x.scrollLeft < max - 2);
  }
  const SEL = '.chips,.essrow,.at-chips,.souschips,.auj-l,.amirow,.segbar,.rf-onglets,.ar-liste,.dk-seg,.cb-chips';
  let attente = 0;
  function tousLesBords() {
    attente = 0;
    document.querySelectorAll(SEL).forEach(bords);
  }
  const plusTard = () => { if (!attente) attente = requestAnimationFrame(tousLesBords); };
  document.addEventListener('scroll', e => { const x = e.target; if (x && x.nodeType === 1 && x.matches(SEL)) bords(x); }, true);
  addEventListener('resize', plusTard);
  /* Les bandes vivent dans la page et dans les feuilles : on n'observe
     qu'elles (l'arène, qui change à chaque coup, n'a pas à payer ce suivi). */
  const obs = new MutationObserver(plusTard);
  ['main', 'sheet'].forEach(id => { const n = document.getElementById(id); if (n) obs.observe(n, { childList: true, subtree: true }); });

  /* Tirer à la souris. */
  let tir = null;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const x = bande(e.target);
    if (x) tir = { x, depart: e.clientX, gauche: x.scrollLeft, glisse: false, id: e.pointerId };
  });
  document.addEventListener('pointermove', e => {
    if (!tir || e.pointerId !== tir.id) return;
    const dx = e.clientX - tir.depart;
    if (!tir.glisse && Math.abs(dx) < 6) return;
    if (!tir.glisse) { tir.glisse = true; tir.x.classList.add('bd-tire'); }
    tir.x.scrollLeft = tir.gauche - dx;
    e.preventDefault();
  });
  const lacher = e => {
    if (!tir || (e && e.pointerId !== tir.id)) return;
    const t = tir;
    tir = null;
    if (!t.glisse) return;
    t.x.classList.remove('bd-tire');
    /* Le clic qui suit un glissé n'est pas un choix. */
    const avaler = c => { c.stopPropagation(); c.preventDefault(); };
    document.addEventListener('click', avaler, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', avaler, true), 60);
  };
  document.addEventListener('pointerup', lacher);
  document.addEventListener('pointercancel', lacher);

  /* La molette, sur une bande basse. Un pavé tactile qui glisse déjà de côté
     (deltaX) et le zoom (Ctrl) passent tels quels. */
  document.addEventListener('wheel', e => {
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const x = bande(e.target);
    if (!x || x.clientHeight > 72) return;
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? x.clientWidth : 1);
    const max = x.scrollWidth - x.clientWidth;
    if ((d < 0 && x.scrollLeft <= 0) || (d > 0 && x.scrollLeft >= max - 1)) return;
    x.scrollLeft += d;
    e.preventDefault();
  }, { passive: false });
})();
