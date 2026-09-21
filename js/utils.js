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
