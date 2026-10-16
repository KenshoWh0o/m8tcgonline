/* Version 2.1.3 : le signal. Un teaser de la version suivante, sans rien
   d'explicite : ni date, ni numéro, ni mot « combat ».

   De temps en temps, au hasard, une capsule « Signal capté » apparaît en haut
   de l'écran. Elle ne reste que quelques secondes : qui la touche voit un
   fragment, une vraie image de la suite (la nouvelle interface, un combat,
   une Secrète, une carte maîtrisée, les deux camps de l'événement), avec une
   phrase et rien d'autre. Un fragment par jour au plus, cinq en tout, dans le
   même ordre pour tous. Une fois les cinq vus, le signal se tait.

   Rien ne passe par le serveur : ce qui a été vu reste sur l'appareil
   (localStorage, SIGNAL_CLE). `?signal` dans l'adresse le fait apparaître
   tout de suite (pour essayer). */
"use strict";

const SIGNAL_CLE = 'mtcg.signal';
const SIGNAUX = [
  { img: 'assets/signal/interface.webp', mot: 'Une autre lumière.' },
  { img: 'assets/signal/combat.webp',    mot: 'Trois lignes. Cinq vies.' },
  { img: 'assets/signal/secrete.webp',   mot: 'Au-delà de 122.', carte: true },
  { img: 'assets/signal/maitrise.webp',  mot: 'Certaines cartes s\'en souviendront.', carte: true },
  { img: 'assets/signal/choc.webp',      mot: 'Deux camps. Bientôt.' }
];
/* Une chance sur deux par visite, entre 8 et 25 secondes après l'arrivée. */
const SIGNAL_CHANCE = 0.5;

function signalEtat() {
  try { return Object.assign({ vus: 0, jour: '' }, JSON.parse(localStorage.getItem(SIGNAL_CLE) || '{}')); }
  catch (e) { return { vus: 0, jour: '' }; }
}
function signalNoter(e) {
  try { localStorage.setItem(SIGNAL_CLE, JSON.stringify(e)); } catch (err) { /* navigation privée */ }
}
const signalJour = () => new Date().toISOString().slice(0, 10);

/* Le signal ne se montre jamais par-dessus une ouverture de booster, une
   feuille ou une scène de Promo. */
function signalLibre() {
  const sheet = document.getElementById('sheet');
  return !document.body.classList.contains('intheater') && !(sheet && !sheet.hidden)
    && !(typeof promoEnCours !== 'undefined' && promoEnCours) && !document.querySelector('.sg-voile');
}

function signalCapsule(e) {
  const b = document.createElement('button');
  b.className = 'sg-capsule';
  b.setAttribute('aria-label', 'Signal capté');
  b.innerHTML = '<i class="sg-onde" aria-hidden="true"></i><span>Signal capté</span>';
  document.body.appendChild(b);
  requestAnimationFrame(() => b.classList.add('on'));
  if (typeof SFX === 'object' && SFX.jouer) SFX.jouer('tap');
  /* Il ne reste pas : qui le rate le reverra peut-être un autre jour. */
  const perdu = setTimeout(() => { b.classList.add('perdu'); setTimeout(() => b.remove(), 700); }, 12000);
  b.onclick = () => { clearTimeout(perdu); b.remove(); signalOuvrir(e); };
}

function signalOuvrir(e) {
  const n = Math.min(e.vus, SIGNAUX.length - 1);
  const s = SIGNAUX[n];
  e.vus = n + 1; e.jour = signalJour(); signalNoter(e);
  const v = document.createElement('div');
  v.className = 'sg-voile';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-label', 'Fragment ' + e.vus + ' sur ' + SIGNAUX.length);
  v.innerHTML = `<div class="sg-in">
      <small class="sg-num">Fragment ${e.vus} / ${SIGNAUX.length}</small>
      <div class="sg-fen${s.carte ? ' carte' : ''}"><img src="${s.img}" alt=""><i class="sg-lignes"></i><i class="sg-balaye"></i></div>
      <p class="sg-mot">${s.mot}</p>
      <div class="sg-suite" aria-hidden="true">${SIGNAUX.map((x, i) => `<i class="${i < e.vus ? 'vu' : ''}${i === n ? ' ici' : ''}"></i>`).join('')}</div>
      ${e.vus >= SIGNAUX.length ? '<p class="sg-fin">À très vite.</p>' : ''}
    </div>`;
  document.body.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));
  v.onclick = () => { v.classList.remove('on'); setTimeout(() => v.remove(), 300); };
}

/* Au démarrage : faut-il émettre aujourd'hui ? */
(function signalDemarrer() {
  const force = /[?&]signal\b/.test(location.search);
  const e = signalEtat();
  if (!force && (e.vus >= SIGNAUX.length || e.jour === signalJour() || Math.random() >= SIGNAL_CHANCE)) return;
  const tenter = (essais) => {
    if (signalLibre() && document.querySelector('#main')) return signalCapsule(force && e.vus >= SIGNAUX.length ? { vus: 0, jour: '' } : e);
    if (essais > 0) setTimeout(() => tenter(essais - 1), 4000);
  };
  setTimeout(() => tenter(15), force ? 1500 : 8000 + Math.random() * 17000);
})();
