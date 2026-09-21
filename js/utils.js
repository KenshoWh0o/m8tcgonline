/* Petits outils partagés : sélecteur, échappement HTML, hasard, notifications. */
"use strict";

/* ---------- Sélecteur et texte ---------- */
const $ = s => document.querySelector(s);

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPE_MAP[c]);

const noacc = s => String(s == null ? '' : s)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/* ---------- Hasard ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = a => a[Math.floor(Math.random() * a.length)];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Hash déterministe (FNV-1a) : utilisé pour tirer un rendu stable à partir de l'id d'une carte. */
function hash(s) {
  let x = 2166136261;
  for (const ch of String(s)) {
    x ^= ch.charCodeAt(0);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

/* ---------- Notifications ---------- */
let toastT;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- Cartes ---------- */
const colOf = c => COLORS[c.col] || COLORS.neutre;
const tcol = c => colOf(c).c;
const rk = c => (RAR[c.rar] || RAR.C).rank;

/* L'extension et les Promos, dans une seule liste. À n'utiliser que là où les
   deux ont leur place — un choix d'avatar, une vitrine. Partout où l'on compte
   la collection, c'est `cards` seul : les Promos sont hors extension, et le
   total de 122 ne doit jamais bouger. */
const toutesCartes = () => cards.concat(promos);

/* Les plus rares d'abord, puis par numéro. */
const parRarete = (a, b) => rk(b) - rk(a) || (a.num || 0) - (b.num || 0);

/* Symbole d'une essence : le logo officiel quand il existe, sinon une pastille de couleur. */
const essIcon = (k, cls) => {
  const col = COLORS[k] || COLORS.neutre;
  return col.ic
    ? `<img class="ess ${cls || ''}" src="${col.ic}" alt="${col.nom}">`
    : `<i class="ess dot ${cls || ''}" style="background:${col.c}"></i>`;
};

const dot = k => essIcon(k);
const costDots = cost => Object.entries(cost).map(([k, n]) => dot(k).repeat(n)).join('');
const costText = cost => Object.entries(cost).map(([k, n]) => `${n} ${(COLORS[k] || COLORS.neutre).nom}`).join(', ');

/* ---------- Accessibilité ---------- */
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Gyroscope ---------- */
/* Incliner l'appareil fait tourner la carte. Deux écrans s'en servent —
   l'ouverture d'un booster et la visionneuse — et chacun avait sa copie ; la
   visionneuse, elle, n'en avait aucune, d'où « l'inclinaison ne marche pas
   dans la collection ».

   Deux choses à savoir :
   · Sur iPhone, il faut **demander l'autorisation**, et la demande n'est
     acceptée que si elle part d'un geste. Les deux écrans s'ouvrent sur une
     pression : on appelle donc depuis leur ouverture, jamais plus tard.
   · L'angle brut ne sert à rien. Ce qui compte, c'est l'écart avec la position
     de départ : on retient la première mesure comme origine, sinon la carte
     part de travers selon la façon dont on tient le téléphone. */
let gyroAutorise = null;   /* null = pas encore demandé, true/false = réponse */

function brancherGyro(surInclinaison, ampleur) {
  if (!JEU.gyro || RM() || !window.DeviceOrientationEvent) return () => {};

  let base = null;
  const amp = ampleur || .6;
  const lim = 18;
  const on = e => {
    if (e.beta == null && e.gamma == null) return;
    if (base == null) base = { b: e.beta || 0, g: e.gamma || 0 };
    surInclinaison(
      Math.max(-lim, Math.min(lim, -((e.beta || 0) - base.b) * amp)),
      Math.max(-lim, Math.min(lim, ((e.gamma || 0) - base.g) * amp)));
  };

  const ecouter = () => addEventListener('deviceorientation', on);
  const detacher = () => removeEventListener('deviceorientation', on);

  const demande = typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!demande || gyroAutorise === true) {
    ecouter();
  } else if (gyroAutorise === null) {
    try {
      DeviceOrientationEvent.requestPermission()
        .then(r => { gyroAutorise = r === 'granted'; if (gyroAutorise) ecouter(); })
        .catch(() => { gyroAutorise = false; });
    } catch (e) { gyroAutorise = false; }
  }
  return detacher;
}
