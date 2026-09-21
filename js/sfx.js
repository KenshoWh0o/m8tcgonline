/* Sons du jeu, fabriqués à la volée par le navigateur (Web Audio).
   Aucun fichier à charger : rien à télécharger, rien à héberger, et le son
   part à l'instant où on touche l'écran. Tout passe par deux robinets de
   volume, un pour les bruitages et un pour l'ambiance, réglables dans Réglages. */
"use strict";

const SFX = {
  ctx: null,
  bus: null, busSfx: null, busMus: null,
  pret: false,
  reglages: { sfx: true, mus: false, volSfx: 0.7, volMus: 0.35 }
};

const SFX_CLE = 'mtcg.audio';

(function chargerReglages() {
  try {
    const v = JSON.parse(localStorage.getItem(SFX_CLE) || 'null');
    if (v && typeof v === 'object') Object.assign(SFX.reglages, v);
  } catch (e) { /* premier lancement */ }
})();

SFX.sauver = function () {
  try { localStorage.setItem(SFX_CLE, JSON.stringify(SFX.reglages)); } catch (e) { /* mode privé */ }
};

/* Les navigateurs refusent le son tant que la personne n'a rien touché :
   on prépare tout au premier geste, quel qu'il soit. */
SFX.init = function () {
  if (SFX.pret) return SFX.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  SFX.ctx = new AC();
  SFX.bus = SFX.ctx.createGain();
  SFX.bus.gain.value = 1;
  SFX.bus.connect(SFX.ctx.destination);

  /* Un léger compresseur : les révélations ne saturent pas quand tout part en même temps. */
  const comp = SFX.ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
  comp.connect(SFX.bus);

  SFX.busSfx = SFX.ctx.createGain();
  SFX.busMus = SFX.ctx.createGain();
  SFX.busSfx.gain.value = SFX.reglages.sfx ? SFX.reglages.volSfx : 0;
  SFX.busMus.gain.value = 0;
  SFX.busSfx.connect(comp);
  SFX.busMus.connect(comp);

  SFX.pret = true;
  return SFX.ctx;
};

SFX.reveiller = function () {
  const c = SFX.init();
  if (c && c.state === 'suspended') c.resume();
  return c;
};

SFX.appliquer = function () {
  if (!SFX.pret) return;
  const t = SFX.ctx.currentTime;
  SFX.busSfx.gain.setTargetAtTime(SFX.reglages.sfx ? SFX.reglages.volSfx : 0, t, .05);
  SFX.busMus.gain.setTargetAtTime(SFX.reglages.mus ? SFX.reglages.volMus : 0, t, .4);
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
  frotte: () => { for (let i = 0; i < 3; i++)
                    souffle({ f0: 900 + i * 400, f1: 2600, duree: .11, gain: .10, q: .5, delai: i * .045 }); },
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

SFX.jouer = function (nom, arg) {
  if (!SFX.reglages.sfx) return;
  const r = RECETTES[nom];
  if (!r) return;
  const c = SFX.reveiller();
  if (!c || c.state !== 'running') return;
  try { r(arg); } catch (e) { /* un son raté n'interrompt pas la partie */ }
};

/* ------------------------------------------------------------- l'ambiance --- */
/* Un tapis lent : quatre accords qui tournent, un souffle très doux par-dessus.
   Volontairement discret, pensé pour être laissé en fond sans lasser. */
const ACCORDS = [
  [146.83, 220.00, 293.66, 369.99],  /* Ré mineur */
  [174.61, 261.63, 349.23, 440.00],  /* Fa majeur */
  [130.81, 196.00, 261.63, 329.63],  /* Do majeur */
  [110.00, 164.81, 220.00, 277.18]   /* La mineur */
];

let musique = null;

SFX.musiqueOn = function () {
  const c = SFX.reveiller();
  if (!c || musique) return;

  const sortie = SFX.busMus;
  const voix = ACCORDS[0].map(() => {
    const o = SFX.ctx.createOscillator(); o.type = 'triangle';
    const d = SFX.ctx.createOscillator(); d.type = 'sine';
    const g = SFX.ctx.createGain(); g.gain.value = 0;
    const f = SFX.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = .4;
    o.connect(f); d.connect(f); f.connect(g); g.connect(sortie);
    o.start(); d.start();
    return { o, d, g };
  });

  /* Un souffle d'air très filtré : la respiration du morceau. */
  const air = SFX.ctx.createBufferSource();
  air.buffer = bruit(); air.loop = true;
  const airF = SFX.ctx.createBiquadFilter(); airF.type = 'bandpass';
  airF.frequency.value = 500; airF.Q.value = .5;
  const airG = SFX.ctx.createGain(); airG.gain.value = .016;
  air.connect(airF); airF.connect(airG); airG.connect(sortie);
  air.start();

  let i = 0;
  const changer = () => {
    const t = SFX.ctx.currentTime;
    const acc = ACCORDS[i % ACCORDS.length];
    voix.forEach((v, k) => {
      v.o.frequency.setTargetAtTime(acc[k], t, 1.6);
      v.d.frequency.setTargetAtTime(acc[k] * 2.003, t, 1.6);
      v.g.gain.setTargetAtTime(.055 / (1 + k * .3), t, 2.2);
    });
    airF.frequency.setTargetAtTime(380 + (i % 3) * 190, t, 3);
    i++;
  };
  changer();
  musique = { voix, air, airG, minuteur: setInterval(changer, 9000) };
};

SFX.musiqueOff = function () {
  if (!musique) return;
  const t = SFX.ctx.currentTime;
  clearInterval(musique.minuteur);
  musique.voix.forEach(v => v.g.gain.setTargetAtTime(0, t, .6));
  musique.airG.gain.setTargetAtTime(0, t, .6);
  const m = musique;
  setTimeout(() => {
    m.voix.forEach(v => { try { v.o.stop(); v.d.stop(); } catch (e) { /* déjà arrêté */ } });
    try { m.air.stop(); } catch (e) { /* déjà arrêté */ }
  }, 2500);
  musique = null;
};

SFX.majMusique = function () {
  if (SFX.reglages.mus) SFX.musiqueOn(); else SFX.musiqueOff();
  SFX.appliquer();
};

/* Premier geste : on débloque le son, et l'ambiance démarre si elle était active. */
['pointerdown', 'keydown'].forEach(evt =>
  addEventListener(evt, function amorce() {
    removeEventListener(evt, amorce);
    SFX.reveiller();
    SFX.appliquer();
    if (SFX.reglages.mus) SFX.musiqueOn();
  }, { once: true, passive: true }));

/* Un clic sur un bouton sonne, sans avoir à le brancher partout. */
addEventListener('pointerdown', e => {
  const b = e.target.closest('button, .gcell[data-show], [role="button"]');
  if (!b || b.disabled) return;
  SFX.jouer(b.dataset.snd || (b.closest('#nav, .tiroir-liste') ? 'onglet' : 'tap'));
}, { passive: true, capture: true });

/* L'ambiance se met en veille quand on quitte l'onglet du navigateur. */
addEventListener('visibilitychange', () => {
  if (!SFX.pret) return;
  SFX.bus.gain.setTargetAtTime(document.hidden ? 0 : 1, SFX.ctx.currentTime, .2);
});
