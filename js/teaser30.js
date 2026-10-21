/* Le teaser de la version 3.0 : le colis.

   La 3.0 sortira à peu près quand les vraies cartes arriveront chez les
   joueurs. On ne le dit pas en toutes lettres : on le montre. Un colis
   ouvert d'où montent trois dos de carte, et un suivi d'expédition en quatre
   étapes — celles des vraies cartes. La dernière, « Chez toi », ajoute
   « et ici » : c'est tout le message.

   Où il se voit :
     · un bandeau au-dessus du paquet, sur l'écran Boosters, tant que la 3.0
       n'est pas là ;
     · une fenêtre, montrée une fois par appareil à chaque étape franchie
       (file d'attente de js/bienvenue.js : jamais par-dessus autre chose) ;
     · l'onglet Combats, qui le montre en grand.

   Faire avancer le colis : changer TEASER30_ETAPE, poser une version
   (tools/version.py), pousser. La fenêtre revient alors une fois chez tout
   le monde, avec la nouvelle étape. Rien ne passe par le serveur. */
"use strict";

/* 0 : en préparation · 1 : expédiées · 2 : en route · 3 : chez toi. */
const TEASER30_ETAPE = 0;
const TEASER30_ETAPES = ['En préparation', 'Expédiées', 'En route', 'Chez toi'];

/* ---------- Le colis ---------- */
/* Deux calques autour des cartes : le fond de la boîte et ses rabats arrière
   derrière, ses faces avant devant — les cartes sortent de la boîte. */
function colisArt(mini) {
  const fond = `<svg class="t30-svg" viewBox="0 0 240 180" aria-hidden="true">
    <defs>
      <radialGradient id="t30lueur${mini ? 'm' : ''}" cx="50%" cy="58%" r="55%">
        <stop offset="0" stop-color="#d9c7ff" stop-opacity=".95"/>
        <stop offset=".35" stop-color="#9b6bff" stop-opacity=".55"/>
        <stop offset="1" stop-color="#5b2bb8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="t30rab${mini ? 'm' : ''}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#7a5536"/><stop offset="1" stop-color="#c79b6c"/>
      </linearGradient>
    </defs>
    <ellipse class="t30-halo" cx="120" cy="70" rx="110" ry="74" fill="url(#t30lueur${mini ? 'm' : ''})"/>
    <path d="M40 92 120 68 108 30 24 52Z" fill="url(#t30rab${mini ? 'm' : ''})"/>
    <path d="M120 68 200 92 216 52 132 30Z" fill="url(#t30rab${mini ? 'm' : ''})"/>
    <path d="M40 92 120 68 200 92 120 116Z" fill="#20160f"/>
    <path d="M40 92 120 68 200 92 120 116Z" fill="url(#t30lueur${mini ? 'm' : ''})" opacity=".8"/>
  </svg>`;
  const face = `<svg class="t30-svg t30-face" viewBox="0 0 240 180" aria-hidden="true">
    <defs>
      <linearGradient id="t30g${mini ? 'm' : ''}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b8875a"/><stop offset="1" stop-color="#7d5638"/>
      </linearGradient>
      <linearGradient id="t30d${mini ? 'm' : ''}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#946843"/><stop offset="1" stop-color="#5e3f27"/>
      </linearGradient>
    </defs>
    <path d="M40 92 120 116 120 174 40 150Z" fill="url(#t30g${mini ? 'm' : ''})"/>
    <path d="M120 116 200 92 200 150 120 174Z" fill="url(#t30d${mini ? 'm' : ''})"/>
    <path d="M40 92 120 116 104 140 22 112Z" fill="#c4956a"/>
    <path d="M120 116 200 92 220 112 138 140Z" fill="#a87a50"/>
    <path d="M40 92 120 116 200 92" fill="none" stroke="#e7d6ff" stroke-opacity=".7" stroke-width="1.6" stroke-linejoin="round"/>
    ${mini ? '' : `<g transform="matrix(1,-.3,0,1,120,116)">
      <rect x="18" y="30" width="48" height="22" rx="2" fill="#f3ede4"/>
      ${[0, 3, 5, 9, 11, 14, 18, 20, 23, 26, 28].map((x, i) => `<rect x="${22 + x}" y="34" width="${i % 3 ? 1.2 : 2}" height="9" fill="#2a2033"/>`).join('')}
      <text x="22" y="49" font-size="4.6" font-weight="800" fill="#5b2bb8" letter-spacing=".4">M8 TCG · 3.0</text>
    </g>`}
  </svg>`;
  const dos = [0, 2, 1].map(i => `<img class="t30-dos d${i}" src="${ART.back}" alt="">`).join('');
  const etincelles = mini ? '' : '<i class="t30-et e0"></i><i class="t30-et e1"></i><i class="t30-et e2"></i><i class="t30-et e3"></i>';
  return `<span class="t30-colis${mini ? ' mini' : ''}" aria-hidden="true">${fond}${dos}${etincelles}${face}</span>`;
}

/* ---------- Le suivi ---------- */
function vSuivi30() {
  return `<div class="t30-suivi" role="list" aria-label="Les vraies cartes : ${h(TEASER30_ETAPES[TEASER30_ETAPE])}">
    ${TEASER30_ETAPES.map((nom, i) => {
      const etat = i < TEASER30_ETAPE ? 'fait' : i === TEASER30_ETAPE ? 'ici' : '';
      return `<span class="t30-et-${i} t30-pas ${etat}" role="listitem">
        <i class="t30-pt">${i < TEASER30_ETAPE ? NAVICO.check : ''}</i>
        <b>${nom}</b>${i === TEASER30_ETAPES.length - 1 ? '<small>et ici</small>' : ''}
      </span>`;
    }).join('')}
  </div>`;
}

/* Le corps commun à la fenêtre et à l'onglet Combats. */
function vTeaser30Corps() {
  const point = (ico, titre, texte) => `<li><span class="bvico">${NAVICO[ico]}</span><span><b>${titre}</b> ${texte}</span></li>`;
  return `<div class="t30-hero">
      ${colisArt(false)}
      <span class="t30-kick">Version 3.0</span>
      <b class="t30-titre">Tes cartes vont se battre.</b>
      <small class="t30-sous">Elle arrive avec les vraies cartes.</small>
    </div>
    <div class="t30-bloc">
      <small class="t30-lab">Les vraies cartes</small>
      ${vSuivi30()}
    </div>
    <ol class="bvpoints nvpoints t30-points">
      ${point('sword', 'Des combats.', 'Construis ton deck avec ta collection, et affronte l\'ordinateur, une campagne ou tes amis.')}
      ${point('star', 'Au-delà des 122.', 'Des cartes plus rares que tout ce que tu as tiré jusqu\'ici.')}
      ${point('prisme', 'Tes cartes préférées évoluent.', 'Fais briller celles que tu aimes le plus.')}
      ${point('trophy', 'Un nouvel événement.', 'Et un boss à abattre tous ensemble.')}
    </ol>
    <p class="muted small t30-pied">Pas encore de date : elle suit le colis.</p>`;
}

/* ---------- Le bandeau de l'écran Boosters ---------- */
function vTeaser30() {
  return `<button class="teaser30" data-act="teaser30" aria-label="Version 3.0 : en savoir plus">
    ${colisArt(true)}
    <span class="t30-txt">
      <small>Version 3.0 · <b>${TEASER30_ETAPES[TEASER30_ETAPE]}</b></small>
      <b>Elle arrive avec les vraies cartes.</b>
    </span>
    <span class="t30-fl" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- La fenêtre ---------- */
function teaser30AVoir() {
  if (Backend.mode !== 'cloud' || !save) return false;
  return accueilMemoire().teaser30 !== String(TEASER30_ETAPE);
}

function montrerTeaser30() {
  accueilNoter({ teaser30: String(TEASER30_ETAPE) });
  openSheet({
    title: 'Bientôt',
    body: `<div class="t30-fen">${vTeaser30Corps()}</div>`,
    actions: [{ label: 'J\'ai hâte', primary: true, fn: closeSheet }]
  });
}
