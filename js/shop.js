/* Onglet Boutique. On y dépense les Éclats gagnés en quête — rien d'autre :
   aucun paiement, aucune monnaie réelle, nulle part dans le jeu. */
"use strict";

const RAYONS = [
  ['boosters', 'Boosters', 'De quoi ouvrir sans attendre la recharge.'],
  ['echange', 'Échanges', 'Pour lancer une demande avant la fin du délai.'],
  ['cosmetique', 'Cadres d\'avatar', 'Purement décoratif, aucun effet sur le jeu.']
];

function vBoutique() {
  if (Backend.mode !== 'cloud') return horsLigne('Boutique');

  const items = Backend.shop || [];
  if (!items.length) {
    return `<div class="pagehead"><h1>Boutique</h1></div>
      ${vide('Rayons vides', 'Le catalogue n\'a pas encore été chargé sur le serveur.')}`;
  }

  const fiche = it => {
    const possede = it.unique_buy && (save.inv || {})[it.id] > 0;
    const cher = save.shards < it.prix;
    const cadre = FRAMES[it.id];
    return `<article class="offre${possede ? ' owned' : ''}">
      ${cadre ? avatarHTML(save.avatar, it.id, 'lg') : `<span class="ofico">${NAVICO[it.effet === 'trade_token' ? 'swap' : 'star']}</span>`}
      <div class="ofcorps">
        <b>${h(it.titre)}</b>
        <p class="muted small">${h(it.detail)}</p>
      </div>
      ${possede
        ? '<span class="qtag">Débloqué</span>'
        : `<button class="btn tiny ${cher ? 'ghost' : ''}" data-achat="${h(it.id)}" data-snd="piece"
             ${cher ? 'disabled' : ''}>${shardIco}${fmtN(it.prix)}</button>`}
    </article>`;
  };

  const rayons = RAYONS.map(([k, titre, sous]) => {
    const l = items.filter(i => i.categ === k);
    if (!l.length) return '';
    return `<section class="qsec">
      <div class="qsechead"><h2>${titre}</h2><span class="muted small">${sous}</span></div>
      <div class="offres">${l.map(fiche).join('')}</div>
    </section>`;
  }).join('');

  const jetons = (save.inv || {}).trade_token || 0;

  return `<div class="pagehead">
      <h1>Boutique</h1>
      <p class="muted">Tout se paie en ${MONNAIE.nom}, gagnés en accomplissant des quêtes.
        Aucun achat avec de l'argent réel.</p>
    </div>
    <div class="walletrow">
      <span class="wallet">${shardIco}<b>${fmtN(save.shards)}</b> ${MONNAIE.nom}</span>
      ${jetons ? `<span class="wallet ghost">${NAVICO.swap}<b>${jetons}</b> jeton${jetons > 1 ? 's' : ''}</span>` : ''}
    </div>
    ${rayons}`;
}
