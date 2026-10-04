/* Les cadeaux : ce qu'un administrateur offre à un joueur (Labo > Offrir un
   cadeau, supabase/18_cadeaux.sql).

   Le joueur le découvre à sa visite suivante : un paquet qui frémit, qu'il
   ouvre lui-même — c'est l'ouverture, côté serveur, qui crédite le compte —,
   puis ce qu'il contenait. Plusieurs cadeaux s'ouvrent l'un après l'autre.
   Fermer la fenêtre sans ouvrir le garde pour plus tard. */
"use strict";

let cadeaux = [];
let cadeauAffiche = false;

/* Le paquet, dessiné : une boîte violette, un ruban rose, un nœud. */
const CADEAU_SVG = `<svg class="cdsvg" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="cdboite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b4dff"/><stop offset="1" stop-color="#5a1fb0"/></linearGradient>
    <linearGradient id="cdcouv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b57aff"/><stop offset="1" stop-color="#7f35e6"/></linearGradient>
    <linearGradient id="cdruban" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7cc8"/><stop offset="1" stop-color="#ec4fb0"/></linearGradient>
  </defs>
  <rect x="20" y="52" width="80" height="58" rx="6" fill="url(#cdboite)"/>
  <rect x="53" y="52" width="14" height="58" fill="url(#cdruban)"/>
  <g class="cdcouvercle">
    <rect x="14" y="38" width="92" height="18" rx="5" fill="url(#cdcouv)"/>
    <rect x="53" y="38" width="14" height="18" fill="url(#cdruban)"/>
    <path d="M60 38c-6-14-26-18-26-6 0 7 14 7 26 6Z" fill="url(#cdruban)"/>
    <path d="M60 38c6-14 26-18 26-6 0 7-14 7-26 6Z" fill="url(#cdruban)"/>
    <circle cx="60" cy="37" r="5" fill="#ffc73b"/>
  </g>
</svg>`;

async function relireCadeaux() {
  if (Backend.mode !== 'cloud' || !save) return;
  try { cadeaux = await Backend.mesCadeaux(); } catch (e) { return; }
  proposerCadeau();
}

/* Comme les fenêtres d'accueil : jamais par-dessus une ouverture de booster,
   une autre fenêtre ou la visionneuse. On réessaie tant que l'écran est pris. */
function proposerCadeau() {
  if (cadeauAffiche || !cadeaux.length) return;
  cadeauAffiche = true;
  const occupe = () => document.body.classList.contains('intheater')
    || !$('#sheet').hidden || !$('#viewer').hidden || (typeof ecranOccupe === 'function' && ecranOccupe());
  const essayer = () => (occupe() ? setTimeout(essayer, 1500) : montrerCadeau(cadeaux[0]));
  setTimeout(essayer, 900);
}

function montrerCadeau(c) {
  if (!c) { cadeauAffiche = false; return; }
  const reste = cadeaux.length - 1;
  openSheet({
    title: reste ? `Un cadeau pour toi (et ${reste} autre${reste > 1 ? 's' : ''})` : 'Un cadeau pour toi',
    body: `<div class="cadeau">
        <div class="cdrayons" aria-hidden="true"></div>
        <button class="cdpaquet" id="cdpaquet" aria-label="Ouvrir le cadeau">${CADEAU_SVG}</button>
        <p class="cdde">De la part de <b>${h(c.de || 'l\'équipe du jeu')}</b></p>
        ${c.message ? `<blockquote class="cdmot">${h(c.message)}</blockquote>` : ''}
        <p class="muted small cdaide">Touche le paquet pour l'ouvrir.</p>
      </div>`,
    actions: [{ label: 'Ouvrir', primary: true, fn: () => ouvrirCadeau(c) }]
  });
  const paquet = $('#cdpaquet');
  if (paquet) paquet.onclick = () => ouvrirCadeau(c);
  SFX.jouer('notif');
}

async function ouvrirCadeau(c) {
  const paquet = $('#cdpaquet');
  if (!paquet || paquet.classList.contains('ouvre')) return;
  paquet.classList.add('ouvre');
  document.querySelectorAll('#sheet [data-si]').forEach(b => b.disabled = true);
  SFX.jouer('ouvre');

  const attente = new Promise(r => setTimeout(r, RM() ? 0 : 750));
  try {
    await Promise.all([Backend.ouvrirCadeau(c.id), attente]);
  } catch (e) {
    paquet.classList.remove('ouvre');
    document.querySelectorAll('#sheet [data-si]').forEach(b => b.disabled = false);
    toast(e.message || 'Le cadeau n\'a pas pu être ouvert.');
    SFX.jouer('erreur');
    return;
  }
  cadeaux = cadeaux.filter(x => x.id !== c.id);
  header();
  montrerContenu(c);
}

function montrerContenu(c) {
  const k = c.carte ? byId[c.carte] : null;
  const ligne = (ico, n, quoi) => `<li><span class="cdico">${ico}</span><b class="tnum">+${fmtN(n)}</b><span>${quoi}</span></li>`;
  const suivant = cadeaux.length > 0;
  openSheet({
    title: 'Dans le paquet',
    body: `<div class="cadeau ouvert">
        <div class="cdrayons" aria-hidden="true"></div>
        ${k ? `<button class="cdcarte" data-show="${k.id}" aria-label="Voir ${h(k.nom)}">${renderCard(k)}</button>` : ''}
        <ul class="cdliste">
          ${c.eclats ? ligne(shardIco, c.eclats, 'Éclats') : ''}
          ${c.boosters ? ligne(NAVICO.star, c.boosters, c.boosters > 1 ? 'boosters, ajoutés à ta réserve' : 'booster, ajouté à ta réserve') : ''}
          ${c.fragments ? ligne(NAVICO.fragment, c.fragments, FRAGMENTS.nom) : ''}
          ${k ? `<li><span class="cdico">${NAVICO.cards}</span><b>${h(k.nom)}</b><span>${h((RAR[k.rar] || RAR.C).nom)}, dans ta collection</span></li>` : ''}
        </ul>
      </div>`,
    actions: [{ label: suivant ? 'Cadeau suivant' : 'Merci !', primary: true, fn: () => {
      closeSheet();
      if (suivant) setTimeout(() => montrerCadeau(cadeaux[0]), 250);
      else { cadeauAffiche = false; render(); }
    }}]
  });
  SFX.jouer('gagne');
  vibrer([30, 50, 30]);
  if (!RM()) FX.sparkle({ n: 110, colors: ['#ffc73b', '#ff7cc8', '#b57aff', '#fff'], size: 3.6 });
}
