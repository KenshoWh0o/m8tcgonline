/* Affichage d'une carte.

   Une carte, c'est son illustration : les 122 de l'extension et les 4 Promos
   en ont une, et le format de données l'exige (voir le champ `fichier` dans
   js/cards-data.js). Le reste — attaques, défense, mots-clés — est imprimé
   dessus ; ces champs restent dans la donnée pour le mode Combat à venir,
   mais rien ne les redessine ici.

   Le jeu savait autrefois fabriquer une carte de toutes pièces quand l'image
   manquait. Ça flattait l'oubli : on obtenait une carte crédible, et l'image
   absente ne se voyait jamais. Un emplacement qui le dit franchement rend le
   service inverse, pour cinquante lignes de moins. */
"use strict";

/* Une url() posée dans une variable CSS se résout par rapport à la feuille de
   style qui l'utilise (css/), pas à la page : on la donne donc en absolu. */
let logoAbs = '';
const logoAbsolu = () => logoAbs || (logoAbs = new URL(ART.set, document.baseURI).href);

/* `o` (version 3.0.7) : `m`, le niveau de maîtrise à montrer (0 : aucun) ;
   `calme`, sans animation — pour une grille de cent cartes (js/maitrise.js,
   css/maitrise.css). Rien n'est deviné : qui veut la maîtrise la demande. */
function renderCard(c, o) {
  if (!c) return '';

  if (c.img) {
    const m = o && o.m && typeof maitriseEnveloppe === 'function' ? maitriseEnveloppe(c, o.m, o.calme) : null;
    /* Une Reverse (version 2.0) : la carte, un reflet sur tout ce qui n'est
       pas l'illustration, et le logo Tout Commence Ici frappé en holographique. */
    return `<div class="cwrap${m ? m.cls : ''}"${m ? ` style="${m.style}"` : ''}><div class="card img-card r-${c.rar}${c.rev ? ' rev' : ''}" style="--tc:${tcol(c)}">
      <img src="${c.img}" alt="${h(c.nom)}" loading="lazy" decoding="async">${c.rev
        ? `<i class="revtampon" aria-hidden="true" style="--logo:url('${logoAbsolu()}')"><i></i></i><i class="revlueur" aria-hidden="true"></i>` : ''}${m ? m.dedans : ''}</div>${m ? m.autour : ''}</div>`;
  }

  /* Version 3.0 : une carte dont le visuel n'est pas encore connu (les
     Promos provisoires des Starter Decks). Elle a un vrai texte : on la
     compose en typographie, sans prétendre à une illustration. */
  if (c.provisoire) return carteTextuelle(c);

  /* Pas d'illustration : la carte existe dans la donnée mais pas sur le
     disque. On le montre plutôt que de le maquiller. */
  return `<div class="cwrap"><div class="card sans-image" style="--tc:${tcol(c)}">
    <b>${h(c.nom)}</b><small>illustration manquante</small></div></div>`;
}

/* La carte en texte : le nom, le type, la Défense, les attaques avec leur
   coût en Essences, et la mention qui dit que le visuel arrive. */
function carteTextuelle(c) {
  const cout = o => Object.keys(o || {}).flatMap(k => Array(o[k]).fill(k))
    .sort((a, b) => (a === 'neutre') - (b === 'neutre')).map(k => essIcon(k)).join('');
  const type = { joueur: 'Joueur', coach: 'Coach', moment: 'Moment', objet: 'Objet' }[c.cat] || '';
  return `<div class="cwrap"><div class="card textuel r-${c.rar}" style="--tc:${tcol(c)}">
    <div class="tx-tete"><b>${h(c.nom)}</b><i>${h(c.code || '')}</i></div>
    <div class="tx-type"><span>${type}</span>${c.def != null ? `<span>Déf <b>${c.def}</b></span>` : ''}</div>
    <div class="tx-corps">${(c.atks || []).map(a => `<div class="tx-atk"><span class="tx-cout">${cout(a.cout)}</span><span>${h(a.nom)}</span><b>${a.degats == null ? '' : a.degats}</b></div>`).join('')}
      ${(c.fx || []).map(t => `<p>${h(t)}</p>`).join('')}</div>
    <div class="tx-pied">Visuel à venir</div></div></div>`;
}
