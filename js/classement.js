/* Le classement : tous les joueurs, pas seulement les amis.

   Quatre critères, un sous-onglet chacun. Le serveur fait tout le calcul
   (classement(), supabase/14_classement.sql) et renvoie les cinquante
   premiers, plus sa propre ligne : on veut savoir où l'on en est, pas
   seulement qui est devant.

   Une ligne se touche pour ouvrir la fiche du joueur, comme partout. */
"use strict";

const CRITERES = [
  { id: 'collection', titre: 'Collection', dit: 'Cartes différentes de l\'extension',
    val: n => `${fmtN(n)}<small> / ${cards.length}</small>` },
  { id: 'boosters', titre: 'Boosters', dit: 'Boosters ouverts depuis le début',
    val: n => fmtN(n) },
  { id: 'echanges', titre: 'Échanges', dit: 'Échanges conclus',
    val: n => fmtN(n) },
  { id: 'serie', titre: 'Série', dit: 'Jours de connexion d\'affilée, en cours',
    val: n => `${fmtN(n)}<small> j</small>` }
];

let clVue = 'collection';
/* Une réponse par critère, gardée une minute : passer d'un sous-onglet à
   l'autre ne refait pas l'appel à chaque fois. */
const clCache = {};
const CL_FRAIS = 60000;

async function chargerClassement(force) {
  const vue = clVue;
  const c = clCache[vue];
  if (!force && c && Date.now() - c.t < CL_FRAIS) return;
  try {
    clCache[vue] = { d: await Backend.classement(vue), t: Date.now() };
  } catch (e) {
    clCache[vue] = { erreur: e.message || 'Le classement n\'a pas pu être chargé.', t: 0 };
  }
  if (tab === 'classement' && clVue === vue) render();
}

function vClassement() {
  if (Backend.mode !== 'cloud') return horsLigne('Classement');
  const def = CRITERES.find(c => c.id === clVue) || CRITERES[0];
  const c = clCache[def.id];

  const tete = `<div class="pagehead"><div>
      <h1>Classement</h1>
      <p>Tous les joueurs, pas seulement tes amis.</p>
    </div></div>
    <div class="segbar">${CRITERES.map(x =>
      `<button data-clv="${x.id}" class="${x.id === def.id ? 'on' : ''}">${h(x.titre)}</button>`).join('')}</div>`;

  if (!c) return tete + '<p class="muted boitecharge">Chargement…</p>';
  if (c.erreur) return tete + vide('Classement indisponible', c.erreur);

  const d = c.d || {};
  const top = d.top || [];
  if (!top.length) return tete + vide('Personne pour l\'instant', 'Le classement se remplit dès qu\'un joueur a quelque chose à y montrer.');

  const ligne = j => `<button class="clligne${j.moi ? ' moi' : ''}${j.rang <= 3 ? ' podium p' + j.rang : ''}"
      data-fiche="${h(j.pseudo)}" aria-label="${h(j.pseudo)}, ${j.rang}e">
    <span class="clrang tnum">${j.rang}</span>
    ${avatarHTML(j.avatar, j.frame, 'sm', j.moi ? maPhoto() : j.photo)}
    <span class="clnom">${h(j.pseudo)}${j.moi ? ' <i class="qtag">toi</i>' : ''}</span>
    <span class="clval tnum">${def.val(j.valeur)}</span>
  </button>`;

  /* Sa propre ligne, si elle n'est pas déjà dans la liste. */
  const moiDedans = top.some(j => j.moi);
  const suite = d.moi && !moiDedans
    ? `<p class="clsep" aria-hidden="true">…</p>${ligne(d.moi)}`
    : !d.moi ? '<p class="muted small clpas">Tu n\'es pas encore classé ici.</p>' : '';

  return tete + `<p class="muted small cldit">${h(def.dit)} · ${fmtN(d.classes || top.length)} joueur${(d.classes || 0) > 1 ? 's' : ''} classé${(d.classes || 0) > 1 ? 's' : ''}${(d.classes || 0) > top.length ? `, les ${top.length} premiers affichés` : ''}.</p>
    <section class="cllist">${top.map(ligne).join('')}${suite}</section>`;
}
