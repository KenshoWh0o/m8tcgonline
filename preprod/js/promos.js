/* Les cartes Promo : détection de l'obtention, et la scène qui la célèbre.

   Une Promo ne sort d'aucun booster. Elle arrive par la boutique ou par un
   palier de collection — donc toujours au milieu d'un écran qui parlait d'autre
   chose. Sans mise en scène, la carte la plus rare du jeu apparaîtrait dans une
   grille, entre deux communes, et personne ne saurait qu'il vient de se passer
   quelque chose.

   La détection suit le même principe que les quêtes : on ne croit pas le
   navigateur, on compare deux états successifs envoyés par le serveur. */
"use strict";

/* ---------- Détection ---------- */
/* Les promos possédées dans un état donné de la collection. */
const promosPossedees = col =>
  new Set(promos.filter(p => (col || {})[p.id] > 0).map(p => p.id));

/* Appelé depuis Backend.apply, juste avant que `save` soit remplacé.
   `avant` à null — première ouverture de session — n'annonce rien : sinon on
   rejouerait la scène à chaque connexion pour des cartes obtenues il y a un
   mois. */
function signalerPromos(avant, apres) {
  if (!avant) return;
  const deja = promosPossedees(avant);
  const neuves = promos.filter(p => (apres || {})[p.id] > 0 && !deja.has(p.id));
  if (neuves.length) filePromos.push(...neuves);
}

/* Deux promos peuvent tomber ensemble — le palier des 100 % accorde la sienne
   pendant qu'on vient d'en acheter une. On les montre l'une après l'autre. */
const filePromos = [];
let promoEnCours = false;

/* Rejouée après chaque rendu : c'est le moment où l'écran est stable. */
function viderFilePromos() {
  if (promoEnCours || !filePromos.length) return;
  /* Le théâtre d'ouverture a la priorité : on attend qu'il se referme. */
  if (rv || opening || document.body.classList.contains('intheater')) return;
  /* Version 3.0 : pas par-dessus un combat. */
  if (typeof Table !== 'undefined' && Table.ouverte()) return;
  montrerPromo(filePromos.shift());
}

/* ---------- La scène ---------- */
/* Trois temps : la carte arrive de loin, dos tourné ; elle se retourne ; le nom
   tombe. Aucun bouton avant la fin — on ne peut pas sauter ce qu'on n'a pas
   encore vu — puis un seul, pour reprendre. */
function montrerPromo(c) {
  if (!c) return;
  promoEnCours = true;

  const anim = !RM();
  const t = $('#theater');
  t.innerHTML = `<div class="promoscene${anim ? '' : ' direct'}" id="promoscene">
    <div class="pr-rays" aria-hidden="true"></div>
    <div class="pr-glow" aria-hidden="true"></div>

    <span class="pr-kicker">Carte promo obtenue</span>

    <div class="pr-stage">
      <div class="pr-card" id="prcard">
        <div class="pr-face">${renderCard(c)}</div>
        <div class="pr-back"><img src="${ART.back}" alt=""></div>
      </div>
      <div class="pr-shadow" aria-hidden="true"></div>
    </div>

    <div class="pr-id">
      <span class="pr-code">${h(c.code)}</span>
      <h2 class="pr-nom">${h(c.nom)}</h2>
      <p class="pr-sous">${h(promoSousTitre(c))}</p>
    </div>

    <div class="pr-acts"><button class="btn" data-t="promo-ok">Superbe</button></div>
  </div>`;
  t.hidden = false;
  document.body.classList.add('intheater');

  if (!anim) return finirEntreePromo(c);

  const sc = $('#promoscene');
  SFX.jouer('woosh');
  /* Une image d'attente avant d'animer, sinon la transition est avalée. */
  requestAnimationFrame(() => sc && sc.classList.add('go'));

  /* Le retournement commence à 52 % des 1150 ms de `pr-come`, soit 598 ms. */
  setTimeout(() => { if (document.body.contains(sc)) SFX.jouer('retourne'); }, 600);

  /* L'échange des deux faces, lui, n'est plus piloté d'ici : il est devenu une
     animation calée sur la même horloge que la carte (voir css/promo.css).
     Un minuteur dérive d'une image ou deux — et une image de trop montrait le
     dos de la carte retourné en miroir. */
  setTimeout(() => {
    if (!document.body.contains(sc)) return;
    sc.classList.add('face');
    finirEntreePromo(c);
  }, 1100);
}

function finirEntreePromo(c) {
  const sc = $('#promoscene');
  if (!sc) return;
  sc.classList.add('dit');
  SFX.jouer('legend');

  if (RM()) return;
  const el = $('#prcard');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cols = ['#ff5bb0', '#ffd7f0', '#ffffff', '#a95cf2', '#ffc73b'];
  FX.burst(r.left + r.width / 2, r.top + r.height / 2,
    { n: 170, colors: cols, speed: 13, shape: 'star', g: .05, size: 4.4, life: 52 });
  setTimeout(() => FX.sparkle({ n: 130, colors: cols, size: 4 }), 180);
  setTimeout(() => FX.sparkle({ n: 90, colors: cols, size: 3.2 }), 900);
}

/* D'où vient la carte : c'est la seule chose que le joueur ne peut pas déduire
   de l'image. */
function promoSousTitre(c) {
  if (c.unique) return 'Carte unique — un seul exemplaire dans tout le jeu.';
  if (c.foil) return 'Essence Brillante — une Essence sur ' + FOIL_ODDS + ' sort dans cette version.';
  if (c.obtention === 'master') return 'Récompense du Master Set — les ' + cards.length + ' cartes réunies.';
  if (c.obtention === 'palier') return 'Récompense de collection — ' + PROMO_PALIER + ' % de l\'extension.';
  /* Version 3.0 : la Promo d'un Starter Deck, gagnée en Combats. */
  if (c.obtention === 'section') return `Promo du Starter Deck ${c.section === 'deter' ? 'Section Déter' : 'Section Toxique'} — gagnée en Combats.`;
  return 'Achetée en boutique.';
}

function fermerPromo() {
  const t = $('#theater');
  t.hidden = true;
  t.innerHTML = '';
  document.body.classList.remove('intheater');
  FX.clear();
  promoEnCours = false;
  /* S'il en reste une dans la file, elle enchaîne. */
  if (filePromos.length) return setTimeout(viderFilePromos, 220);
  render();
}
