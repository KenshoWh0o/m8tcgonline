/* Le teaser de la version 3.0, dans l'onglet Combats (qui n'a rien d'autre à
   montrer d'ici là).

   Ce qu'il montre surtout : la refonte visuelle. Un téléphone, et dedans le
   même écran deux fois — tel qu'il est aujourd'hui, et tel qu'il sera. On
   fait glisser la séparation pour passer de l'un à l'autre. Quatre écrans :
   Boosters, Collection, Profil, et Combats (le « Coming soon » d'aujourd'hui
   face à l'accueil des Combats de la 3.0). Ce sont de vraies captures, prises
   sur la démo de la 2.1.2 et sur celle de la 3.0 avec la même collection
   (assets/teaser30/, 720 px de large).

   Le lien avec les vraies cartes reste implicite : « quand tu auras les
   cartes en main ».

   Une pastille sur l'onglet Combats tant qu'on ne l'a pas ouvert (une fois
   par appareil). Rien ne passe par le serveur. */
"use strict";

/* Changer cette clé fait revenir la pastille chez tout le monde. */
const TEASER30_CLE = 'refonte';
const TEASER30_ECRANS = [
  { id: 'boosters', nom: 'Boosters' },
  { id: 'collection', nom: 'Collection' },
  { id: 'profil', nom: 'Profil' },
  { id: 'combats', nom: 'Combats' }
];
const teaser30Img = (id, v) => `assets/teaser30/${id}-${v}.webp`;

let t30Ecran = 'boosters';
/* La séparation, en % depuis la gauche : à gauche d'elle, aujourd'hui ; à
   droite, la 3.0. */
let t30Pos = 50;
let t30Montre = false;

/* ---------- La pastille ---------- */
function teaser30Nouveau() {
  if (Backend.mode !== 'cloud' || !save) return false;
  return accueilMemoire().teaser30 !== TEASER30_CLE;
}
function teaser30Vu() {
  if (teaser30Nouveau()) accueilNoter({ teaser30: TEASER30_CLE });
}

/* ---------- La page ---------- */
function vTeaser30() {
  const e = TEASER30_ECRANS.find(x => x.id === t30Ecran) || TEASER30_ECRANS[0];
  const point = (titre, texte) => `<li><b>${titre}</b><span>${texte}</span></li>`;
  /* Après le rendu : la séparation fait un aller-retour, une fois par
     visite, pour montrer qu'elle se tire. */
  if (!t30Montre) setTimeout(t30Montrer, 900);
  return `<section class="t30">
    <div class="t30-tete">
      <span class="t30-kick">Version 3.0</span>
      <h2 class="t30-titre">Une nouvelle allure.</h2>
      <p class="t30-sous">Tout le jeu a été redessiné. Fais glisser pour voir.</p>
    </div>
    <div class="t30-app">
      <div class="t30-leg" aria-hidden="true"><span>‹ Aujourd'hui</span><span>Version 3.0 ›</span></div>
      <div class="t30-tel" style="--p:${t30Pos}%" role="group" aria-label="${h(e.nom)} : aujourd'hui et en version 3.0">
        <div class="t30-cal"><img class="t30-img" src="${teaser30Img(e.id, 'apres')}" alt="L'écran ${h(e.nom)} en version 3.0" draggable="false"></div>
        <div class="t30-cal t30-avant"><img class="t30-img" src="${teaser30Img(e.id, 'avant')}" alt="L'écran ${h(e.nom)} aujourd'hui" draggable="false"></div>
        <span class="t30-sep" aria-hidden="true"><i>‹ ›</i></span>
        <input class="t30-range" type="range" min="0" max="100" value="${t30Pos}" aria-label="Comparer aujourd'hui et la version 3.0">
      </div>
    </div>
    <div class="t30-cote">
        <div class="t30-ecrans" role="tablist">
          ${TEASER30_ECRANS.map(x => `<button class="t30-ec${x.id === e.id ? ' on' : ''}" data-t30="${x.id}" role="tab" aria-selected="${x.id === e.id}">${x.nom}</button>`).join('')}
        </div>
        <ul class="t30-points">
          ${point('Graphite et lavande.', 'Un fond neutre : ce sont tes cartes qui donnent la couleur à l\'écran.')}
          ${point('Du verre, là où ça flotte.', 'La barre des onglets, l\'en-tête et les fenêtres, en verre dépoli.')}
          ${point('Plus lisible.', 'Une seule couleur pour agir, des contrastes revus partout.')}
          ${point('Et cet onglet prend vie.', 'Tes cartes vont se battre.')}
        </ul>
        <p class="t30-pied">Rendez-vous quand tu auras les cartes en main.</p>
    </div>
  </section>`;
}

/* ---------- Le glissé ---------- */
function t30Poser(tel, pct) {
  t30Pos = Math.max(0, Math.min(100, pct));
  tel.style.setProperty('--p', t30Pos + '%');
  const r = tel.querySelector('.t30-range');
  if (r) r.value = Math.round(t30Pos);
}

/* L'aller-retour d'invitation : vers la 3.0, vers aujourd'hui, au milieu.
   Un doigt posé l'interrompt. */
function t30Montrer() {
  const tel = document.querySelector('.t30-tel');
  if (!tel || t30Montre) return;
  t30Montre = true;
  if (document.documentElement.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const etapes = [[50, 82, 700], [82, 22, 1000], [22, 50, 700]];
  let i = 0, t0 = 0;
  const pas = t => {
    if (tel.dataset.touche || !tel.isConnected) return;
    if (!t0) t0 = t;
    const [a, b, d] = etapes[i];
    const k = Math.min(1, (t - t0) / d);
    t30Poser(tel, a + (b - a) * (0.5 - Math.cos(Math.PI * k) / 2));
    if (k < 1) return requestAnimationFrame(pas);
    if (++i < etapes.length) { t0 = 0; requestAnimationFrame(pas); }
  };
  requestAnimationFrame(pas);
}

/* Un doigt qui glisse de côté tire la séparation ; un doigt qui monte ou
   descend fait défiler la page (touch-action: pan-y) ; un simple appui la
   pose où il touche. */
let t30Tire = null;
document.addEventListener('pointerdown', ev => {
  const tel = ev.target.closest && ev.target.closest('.t30-tel');
  if (!tel) return;
  tel.dataset.touche = '1';
  t30Tire = { tel, x: ev.clientX, y: ev.clientY, actif: false };
});
const t30Suivre = ev => {
  const r = t30Tire.tel.getBoundingClientRect();
  t30Poser(t30Tire.tel, (ev.clientX - r.left) / r.width * 100);
};
document.addEventListener('pointermove', ev => {
  if (!t30Tire) return;
  if (!t30Tire.actif) {
    const dx = Math.abs(ev.clientX - t30Tire.x), dy = Math.abs(ev.clientY - t30Tire.y);
    if (dx < 6 || dx < dy) return;
    t30Tire.actif = true;
  }
  t30Suivre(ev);
});
document.addEventListener('pointerup', ev => {
  if (t30Tire && !t30Tire.actif && Math.abs(ev.clientY - t30Tire.y) < 10) t30Suivre(ev);
  t30Tire = null;
});
document.addEventListener('pointercancel', () => { t30Tire = null; });
/* Au clavier : le curseur caché. */
document.addEventListener('input', ev => {
  if (!ev.target.classList || !ev.target.classList.contains('t30-range')) return;
  const tel = ev.target.closest('.t30-tel');
  tel.dataset.touche = '1';
  t30Poser(tel, +ev.target.value);
});
/* Les quatre écrans : on change d'images sans redessiner la page. */
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-t30]');
  if (!b) return;
  t30Ecran = b.dataset.t30;
  const e = TEASER30_ECRANS.find(x => x.id === t30Ecran);
  const tel = document.querySelector('.t30-tel');
  if (!tel || !e) return;
  const [apres, avant] = tel.querySelectorAll('.t30-img');
  apres.src = teaser30Img(e.id, 'apres'); apres.alt = `L'écran ${e.nom} en version 3.0`;
  avant.src = teaser30Img(e.id, 'avant'); avant.alt = `L'écran ${e.nom} aujourd'hui`;
  tel.setAttribute('aria-label', `${e.nom} : aujourd'hui et en version 3.0`);
  document.querySelectorAll('.t30-ec').forEach(x => {
    const on = x.dataset.t30 === e.id;
    x.classList.toggle('on', on);
    x.setAttribute('aria-selected', on);
  });
  if (typeof SFX === 'object' && SFX.jouer) SFX.jouer('tap');
});
