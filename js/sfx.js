/* Sons du jeu, fabriqués à la volée par le navigateur (Web Audio).
   Aucun fichier à charger : rien à télécharger, rien à héberger, et le son
   part à l'instant où on touche l'écran. Tout passe par un robinet de volume
   unique, réglable dans Réglages.

   Il n'y a que des bruitages : chacun répond à un geste. Une musique de fond,
   elle, joue sans qu'on l'ait demandée — on l'a retirée.

   ------------------------------------------------------------------------
   Le son sur mobile, et pourquoi ce fichier fait plus que jouer des notes.

   Un navigateur de téléphone ne laisse pas une page faire du bruit quand elle
   veut. Trois règles s'y ajoutent, et chacune coupait le son ici :

   1. Rien avant un geste. L'AudioContext naît « suspended » et ne se réveille
      que dans un gestionnaire d'événement déclenché par la personne. On le
      réveille donc au tout premier contact, quel qu'il soit.

   2. `resume()` prend son temps. Il rend une promesse : juste après l'appel,
      l'état est encore « suspended ». Le code d'avant vérifiait l'état tout de
      suite et renonçait — le premier son d'une session était systématiquement
      perdu. Les sons demandés pendant ce réveil sont désormais mis de côté et
      joués dès que le contexte tourne.

   3. Le système reprend la main. Quitter l'onglet, verrouiller l'écran,
      recevoir un appel : le système suspend le contexte et ne le rend pas. Sans
      reprise explicite, tout restait muet au retour, définitivement. On
      redemande donc le réveil au retour sur l'onglet et à chaque geste.

   Ce qu'on ne peut pas corriger : sur iPhone, l'interrupteur « silencieux » de
   la tranche coupe le son des pages web. Aucune ligne de JavaScript ne passe
   outre — les Réglages le disent au joueur plutôt que de le laisser chercher. */
"use strict";

const SFX = {
  ctx: null,
  bus: null, busSfx: null,
  pret: false,
  reglages: { sfx: true, volSfx: 0.7 }
};

const SFX_CLE = 'mtcg.audio';

(function chargerReglages() {
  try {
    const v = JSON.parse(localStorage.getItem(SFX_CLE) || 'null');
    if (v && typeof v === 'object') {
      if (typeof v.sfx === 'boolean') SFX.reglages.sfx = v.sfx;
      if (typeof v.volSfx === 'number') SFX.reglages.volSfx = Math.max(0, Math.min(1, v.volSfx));
    }
  } catch (e) { /* premier lancement */ }
})();

SFX.sauver = function () {
  try { localStorage.setItem(SFX_CLE, JSON.stringify(SFX.reglages)); } catch (e) { /* mode privé */ }
};

SFX.init = function () {
  if (SFX.pret) return SFX.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  try {
    /* `latencyHint:'interactive'` demande la plus petite latence possible : un
       bruitage de bouton qui arrive 200 ms trop tard ne se rattache plus au
       geste, et on l'entend comme un défaut. */
    SFX.ctx = new AC({ latencyHint: 'interactive' });
  } catch (e) {
    return null;
  }

  SFX.bus = SFX.ctx.createGain();
  SFX.bus.gain.value = 1;
  SFX.bus.connect(SFX.ctx.destination);

  /* Un léger compresseur : les révélations ne saturent pas quand tout part en même temps. */
  const comp = SFX.ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
  comp.connect(SFX.bus);

  SFX.busSfx = SFX.ctx.createGain();
  SFX.busSfx.gain.value = SFX.reglages.sfx ? SFX.reglages.volSfx : 0;
  SFX.busSfx.connect(comp);

  SFX.pret = true;
  return SFX.ctx;
};

/* ---------- Réveil ---------- */
/* Les sons demandés pendant que le contexte se réveille attendent ici. On n'en
   garde que quelques-uns : si le réveil traîne, rejouer dix bruitages d'un coup
   ferait un paquet de bruit sans rapport avec ce que la personne vient de
   faire. */
const enAttente = [];
const ATTENTE_MAX = 4;
let reveilEnCours = false;

SFX.reveiller = function () {
  const c = SFX.init();
  if (!c) return null;
  if (c.state === 'running' || reveilEnCours) return c;

  reveilEnCours = true;
  /* Selon les navigateurs, `resume()` rend une promesse ou rien du tout. */
  let p;
  try { p = c.resume(); } catch (e) { p = null; }
  Promise.resolve(p)
    .then(viderAttente)
    .catch(() => { /* refusé : il faudra un vrai geste */ })
    .then(() => { reveilEnCours = false; });
  return c;
};

function viderAttente() {
  if (!SFX.ctx || SFX.ctx.state !== 'running') return;
  enAttente.splice(0, enAttente.length).forEach(([nom, arg]) => lancer(nom, arg));
}

/* Le son sort-il vraiment ? Sert au bouton « Tester le son » des Réglages :
   c'est la seule réponse honnête à « je n'entends rien ». */
SFX.audible = function () {
  return !!(SFX.pret && SFX.ctx && SFX.ctx.state === 'running'
    && SFX.reglages.sfx && SFX.reglages.volSfx > 0);
};

SFX.appliquer = function () {
  if (!SFX.pret) return;
  const t = SFX.ctx.currentTime;
  SFX.busSfx.gain.setTargetAtTime(SFX.reglages.sfx ? SFX.reglages.volSfx : 0, t, .05);
  SFX.sauver();
};

/* ------------------------------------------------------------- briques ---- */
let bruitBuf = null;
function bruit() {
  if (bruitBuf) return bruitBuf;
  const n = Math.floor(SFX.ctx.sampleRate * 1.6);
  bruitBuf = SFX.ctx.createBuffer(1, n, SFX.ctx.sampleRate);
  const d = bruitBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return bruitBuf;
}

/* Un souffle filtré : sert de base à tout ce qui frotte, déchire ou glisse. */
function souffle(o) {
  const t = SFX.ctx.currentTime + (o.delai || 0);
  const s = SFX.ctx.createBufferSource();
  s.buffer = bruit();
  s.playbackRate.value = o.vitesse || 1;

  const f = SFX.ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.Q.value = o.q == null ? 1 : o.q;
  f.frequency.setValueAtTime(o.f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1 || o.f0), t + o.duree);

  const g = SFX.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attaque || .006));
  g.gain.exponentialRampToValueAtTime(.0001, t + o.duree);

  s.connect(f); f.connect(g); g.connect(SFX.busSfx);
  s.start(t, Math.random() * 0.8);
  s.stop(t + o.duree + .02);
}

/* Une note : l'ossature des clics, des pièces et des carillons. */
function note(o) {
  const t = SFX.ctx.currentTime + (o.delai || 0);
  const s = SFX.ctx.createOscillator();
  s.type = o.onde || 'sine';
  s.frequency.setValueAtTime(o.f0, t);
  if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + o.duree);

  const g = SFX.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attaque || .008));
  g.gain.exponentialRampToValueAtTime(.0001, t + o.duree);

  let dernier = s;
  if (o.filtre) {
    const f = SFX.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.filtre, t);
    if (o.filtre1) f.frequency.exponentialRampToValueAtTime(o.filtre1, t + o.duree);
    s.connect(f); dernier = f;
  }
  dernier.connect(g); g.connect(SFX.busSfx);
  s.start(t); s.stop(t + o.duree + .02);
}

/* ------------------------------------------------------------- le nuancier -- */
/* Chaque son est une recette courte : quelques souffles, quelques notes. */
const RECETTES = {
  /* Interface */
  tap:    () => { note({ f0: 880, f1: 1320, duree: .05, gain: .10, onde: 'triangle' });
                  souffle({ f0: 3600, f1: 1800, duree: .04, gain: .05, q: .8 }); },
  onglet: () => { note({ f0: 520, f1: 760, duree: .09, gain: .11, onde: 'sine', filtre: 2600 }); },
  retour: () => { note({ f0: 620, f1: 380, duree: .10, gain: .10, onde: 'sine', filtre: 2200 }); },

  /* Cartes : du papier, pas du synthé. */
  carte:  () => { souffle({ f0: 1100, f1: 3400, duree: .13, gain: .16, q: .55, vitesse: 1.3 }); },
  retourne: () => { souffle({ f0: 700, f1: 2800, duree: .10, gain: .14, q: .7 });
                    note({ f0: 300, f1: 180, duree: .09, gain: .06, onde: 'sine' }); },

  /* Le paquet : le plastique qui craque, puis la déchirure. */
  craque: () => { for (let i = 0; i < 5; i++)
                    souffle({ f0: 2200 + Math.random() * 3000, duree: .035, gain: .07, q: 2.4,
                              delai: i * .05 + Math.random() * .03 }); },
  dechire: () => {
    souffle({ f0: 700, f1: 5200, duree: .40, gain: .26, q: .45, type: 'bandpass', attaque: .02 });
    souffle({ f0: 4200, f1: 900, duree: .30, gain: .14, q: .9, delai: .06 });
    note({ f0: 120, f1: 55, duree: .35, gain: .18, onde: 'sine' });
    for (let i = 0; i < 9; i++)
      souffle({ f0: 3000 + Math.random() * 4000, duree: .03, gain: .06, q: 3, delai: .04 + i * .035 });
  },
  woosh:  () => { souffle({ f0: 300, f1: 2600, duree: .28, gain: .15, q: .6, attaque: .08 }); },

  /* Révélations : trois paliers, même geste, de plus en plus large. */
  monte:  d => { const dur = (d || 800) / 1000;
                 const t = SFX.ctx.currentTime;
                 const s = SFX.ctx.createOscillator(); s.type = 'sawtooth';
                 s.frequency.setValueAtTime(90, t);
                 s.frequency.exponentialRampToValueAtTime(900, t + dur);
                 const f = SFX.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
                 f.frequency.setValueAtTime(240, t);
                 f.frequency.exponentialRampToValueAtTime(5200, t + dur);
                 const g = SFX.ctx.createGain();
                 g.gain.setValueAtTime(0, t);
                 g.gain.linearRampToValueAtTime(.10, t + dur * .7);
                 g.gain.exponentialRampToValueAtTime(.0001, t + dur + .12);
                 s.connect(f); f.connect(g); g.connect(SFX.busSfx);
                 s.start(t); s.stop(t + dur + .15);
                 souffle({ f0: 400, f1: 6000, duree: dur, gain: .07, q: .5, attaque: dur * .8 }); },

  rare:   () => carillon([784, 1175, 1568], .55, .12),
  epique: () => { carillon([659, 988, 1318, 1976], .9, .13);
                  note({ f0: 82, duree: .7, gain: .16, onde: 'sine' }); },
  legend: () => { carillon([523, 784, 1046, 1568, 2093], 1.5, .13);
                  carillon([659, 988, 1318], 1.2, .08, .18);
                  note({ f0: 65, duree: 1.3, gain: .20, onde: 'sine' });
                  souffle({ f0: 8000, f1: 2000, duree: 1.1, gain: .05, q: .4, attaque: .3 }); },

  /* Retours d'action */
  piece:  () => { note({ f0: 1568, f1: 2093, duree: .09, gain: .11, onde: 'triangle' });
                  note({ f0: 2093, duree: .22, gain: .09, onde: 'triangle', delai: .07 }); },
  gagne:  () => carillon([523, 659, 784, 1046], .6, .11),
  ouvre:  () => { note({ f0: 300, f1: 640, duree: .16, gain: .10, onde: 'sine', filtre: 2000 }); },
  erreur: () => { note({ f0: 220, f1: 150, duree: .18, gain: .13, onde: 'square', filtre: 900 }); }
};

function carillon(freqs, duree, gain, delai) {
  freqs.forEach((f, i) => {
    note({ f0: f, duree: duree * (1 - i * .08), gain: gain / (1 + i * .35),
           onde: 'sine', delai: (delai || 0) + i * .055, attaque: .01 });
    note({ f0: f * 2.004, duree: duree * .4, gain: gain * .18,
           onde: 'sine', delai: (delai || 0) + i * .055 });
  });
}

function lancer(nom, arg) {
  const r = RECETTES[nom];
  if (!r) return;
  try { r(arg); } catch (e) { /* un son raté n'interrompt pas la partie */ }
}

SFX.jouer = function (nom, arg) {
  if (!SFX.reglages.sfx || !RECETTES[nom]) return;

  const c = SFX.reveiller();
  if (!c) return;

  /* Le contexte tourne : on joue tout de suite. Sinon on met de côté — le
     réveil est en cours et videra la file. Renoncer ici, c'était perdre le
     premier son de chaque session et tous ceux d'après un retour d'arrière-plan. */
  if (c.state === 'running') return lancer(nom, arg);
  if (enAttente.length < ATTENTE_MAX) enAttente.push([nom, arg]);
};

/* Chaque geste est une occasion de réveiller le son : c'est le seul moment où
   les navigateurs de téléphone l'autorisent. L'appel ne coûte rien quand le
   contexte tourne déjà — il ressort à la première ligne. */
['pointerdown', 'touchstart', 'keydown'].forEach(evt =>
  addEventListener(evt, () => SFX.reveiller(), { passive: true, capture: true }));

/* Un clic sur un bouton sonne, sans avoir à le brancher partout. */
addEventListener('pointerdown', e => {
  const b = e.target.closest('button, .gcell[data-show], [role="button"]');
  if (!b || b.disabled || b.dataset.snd === 'non') return;
  SFX.jouer(b.dataset.snd || (b.closest('#nav, .tiroir-liste, .segbar') ? 'onglet' : 'tap'));
}, { passive: true, capture: true });

/* Quitter l'onglet coupe le son ; y revenir le rend. Le système a pu suspendre
   le contexte pendant l'absence : on le redemande, sans quoi tout reste muet
   jusqu'au rechargement de la page. */
addEventListener('visibilitychange', () => {
  if (!SFX.pret) return;
  if (document.hidden) {
    SFX.bus.gain.setTargetAtTime(0, SFX.ctx.currentTime, .2);
    return;
  }
  SFX.reveiller();
  SFX.bus.gain.setTargetAtTime(1, SFX.ctx.currentTime, .2);
});

/* Certains navigateurs mobiles signalent la reprise par `pageshow` et non par
   `visibilitychange` — notamment au retour depuis le cache de navigation. */
addEventListener('pageshow', () => { if (SFX.pret) SFX.reveiller(); });
