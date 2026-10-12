/* La maîtrise des cartes (version 3.0).

   Quand on approche du Master Set, un booster ne rapporte plus que des
   doublons. La maîtrise leur rend un sens : chaque exemplaire obtenu d'une
   carte — Reverse comprise — la fait progresser, définitivement, même si on
   le recycle ou l'échange ensuite. Quatre paliers, purement décoratifs :
   Bronze, Argent, Or, Prisme. Ils habillent la carte — un cadre, une texture,
   un reflet — partout où elle est à soi : Collection, visionneuse, combats.

   Les seuils dépendent de la rareté : une Commune sort douze fois plus
   qu'une Rare. Le serveur compte les exemplaires (collection.total,
   supabase/24_secretes_maitrise.sql) ; il fait le même calcul pour les
   quêtes de maîtrise. */
"use strict";

const MAITRISE = {
  noms: ['', 'Bronze', 'Argent', 'Or', 'Prisme'],
  /* Exemplaires obtenus pour atteindre chaque palier. */
  seuils: {
    ES: [10, 30, 60, 120],
    C: [5, 15, 30, 60],
    PC: [4, 10, 20, 40],
    R: [3, 7, 15, 30],
    E: [2, 4, 8, 15],
    L: [2, 3, 5, 8],
    S: [2, 3, 4, 5]
  }
};

/* La carte d'origine : une Reverse progresse avec elle. */
const baseMaitrise = c => (c && c.rev ? c.base : c && c.id);

/* Les exemplaires obtenus d'une carte, Reverse comprise. Sans le compte du
   serveur (hors ligne), on se contente de ce qu'on possède. */
function obtenusDe(c) {
  if (!c) return 0;
  const id = baseMaitrise(c);
  const o = (save && save.obtenus) || null;
  const r = 'r' + id.slice(1);
  if (o) return (o[id] || 0) + (byId[r] ? (o[r] || 0) : 0);
  return (save.col[id] || 0) + (byId[r] ? (save.col[r] || 0) : 0);
}

/* Le palier (0 à 4), et ce qu'il reste pour le suivant. */
function maitriseDe(c) {
  const k = c && c.rev ? byId[c.base] : c;
  const s = k && !k.promo && !k.unique && !k.cachee && MAITRISE.seuils[k.rar];
  if (!s) return null;
  const n = obtenusDe(k);
  const niveau = s.filter(x => n >= x).length;
  return { niveau, n, prochain: s[niveau] || null, seuils: s, nom: MAITRISE.noms[niveau] };
}

/* Une carte habillée de sa maîtrise : une classe de plus sur son enveloppe,
   et un médaillon dans le coin, pour qu'on reconnaisse le palier d'un coup
   d'œil — même en petit, dans la Collection. `niveau` force un palier
   (l'aperçu de la visionneuse). */
function avecMaitrise(html, c, niveau) {
  const m = maitriseDe(c);
  const n = niveau != null ? niveau : m ? m.niveau : 0;
  if (!n) return html;
  const nom = MAITRISE.noms[n];
  return html.replace('<div class="cwrap">', `<div class="cwrap mt${n}" data-maitrise="${nom}"><i class="mt-badge mt${n}" title="Maîtrise ${nom}" aria-label="Maîtrise ${nom}"></i>`);
}

/* La ligne de la visionneuse : le palier, et la jauge vers le suivant. */
function vMaitrise(c) {
  const m = maitriseDe(c);
  if (!m) return '';
  const de = m.niveau ? m.seuils[m.niveau - 1] : 0;
  const pct = m.prochain ? Math.round(100 * (m.n - de) / (m.prochain - de)) : 100;
  /* L'aperçu : les quatre paliers, à essayer sur la carte elle-même. */
  const apercu = [1, 2, 3, 4].map(k => `<button class="vw-mt-ap mt${k}${k <= m.niveau ? ' eu' : ''}" data-v="mt${k}" aria-label="Voir la carte en maîtrise ${MAITRISE.noms[k]}">
      <i class="mt-badge mt${k}"></i><span>${MAITRISE.noms[k]}</span><small>${m.seuils[k - 1]} ex.</small></button>`).join('');
  return `<div class="vw-maitrise mt${m.niveau}">
    <span class="vw-mt-nom">${m.niveau ? `Maîtrise ${m.nom}` : 'Pas encore de maîtrise'}</span>
    <span class="vw-mt-barre"><i style="width:${Math.max(4, Math.min(100, pct))}%"></i></span>
    <small>${m.prochain ? `${m.n} / ${m.prochain} exemplaires obtenus pour ${MAITRISE.noms[m.niveau + 1]}` : `${m.n} exemplaires obtenus — maîtrise complète`}</small>
    <div class="vw-mt-apercu" role="group" aria-label="Aperçu des paliers">${apercu}</div>
  </div>`;
}
