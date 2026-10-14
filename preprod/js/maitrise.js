/* La maîtrise des cartes, et la carte fétiche (version 3.0.7).

   Ce que deviennent les Fragments quand la collection est complète : une
   carte qu'on possède s'améliore, en cinq niveaux, et chaque niveau change
   son allure — partout où elle apparaît, en combat compris.

     1 · Éclat    un éclat de lumière passe sur la carte ;
     2 · Gravure  une gravure de reflets, aux couleurs de son Essence ;
     3 · Aura     une aura de son Essence l'entoure, des étincelles montent ;
     4 · Arène    une bordure de lumière en fait le tour ; en combat, elle
                  entre dans l'arène dans un éclat, et ses coups brillent ;
     5 · Légende  holographique et couronnée ; en combat, une onde de choc à
                  son entrée.

   Ce que coûte un niveau : des Fragments, et des exemplaires de la carte.
   Le conflit avec les decks (il en faut deux pour jouer une carte deux
   fois) est réglé ainsi : la maîtrise ne prend que les exemplaires EN TROP —
   au-delà de ce qu'un deck peut contenir (deux, un pour une Légendaire ou
   une Secrète), au-delà de ce que le joueur a choisi de garder, et hors de
   ce qui est promis dans un échange. Il en manque ? Chacun se remplace par
   son prix de fabrication en Fragments : la maîtrise n'est jamais bloquée,
   même avec une seule Légendaire. La maîtrise vaut pour la carte (toutes
   ses copies) ; sa Reverse la partage.

   Les montants sont aussi côté serveur (supabase/28_maitrise.sql), qui
   revérifie tout : les deux doivent rester d'accord. */
"use strict";

const MAITRISE = {
  max: 5,
  noms: ['Éclat', 'Gravure', 'Aura', 'Arène', 'Légende'],
  dit: [
    'Un éclat de lumière passe sur la carte.',
    'Une gravure de reflets, aux couleurs de son Essence, couvre la carte.',
    'Une aura de son Essence l\'entoure, et des étincelles montent autour.',
    'Une bordure de lumière en fait le tour. En combat, elle entre dans l\'arène dans un éclat, et ses coups brillent.',
    'Holographique et couronnée. En combat, une onde de choc à son entrée.'
  ],
  /* Les Fragments pour atteindre chaque niveau : 11 500 pour la Légende. */
  fragments: [300, 700, 1500, 3000, 6000],
  /* Les exemplaires en trop qu'absorbe chaque niveau, selon la rareté : plus
     une carte est rare, moins on en demande. */
  copies: { C: [1, 1, 2, 2, 3], PC: [1, 1, 2, 2, 3], R: [0, 1, 1, 2, 2], E: [0, 1, 1, 1, 1], L: [0, 0, 1, 0, 1], S: [0, 0, 0, 0, 0] }
};
const CHIFFRES_ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V'];

/* La carte dont on parle : une Reverse partage la maîtrise de sa carte. */
const carteMaitrise = c => (c && c.rev && c.base ? byId[c.base] || c : c);
/* Ce qui se maîtrise : les cartes de l'extension (sauf les Essences) et les
   Secrètes ; ni les Promos, ni les Essences Brillantes, ni l'Unique. */
const maitrisable = c => {
  const k = carteMaitrise(c);
  return !!k && !!MAITRISE.copies[k.rar] && k.cat !== 'essence' && (!k.promo || !!k.secrete);
};
/* Le niveau d'une carte, pour soi ; `niveaux` : ceux d'un autre joueur. */
const niveauMaitrise = (c, niveaux) => {
  const k = carteMaitrise(c);
  const n = k && (niveaux || (save && save.maitrises) || {})[k.id];
  return Math.max(0, Math.min(MAITRISE.max, n || 0));
};
/* Ce qu'un deck peut en contenir (REGLE.COPIES, js/combat/moteur.js). */
const limiteDeck = c => (['L', 'S', 'UN', 'PR'].includes(c.rar) ? 1 : 2);

/* Ce que coûte le niveau suivant. null : déjà au maximum. */
function coutMaitrise(c) {
  const k = carteMaitrise(c);
  const n = niveauMaitrise(k) + 1;
  if (n > MAITRISE.max) return null;
  const copies = (MAITRISE.copies[k.rar] || [])[n - 1] || 0;
  const reserve = (typeof Backend !== 'undefined' && Backend.trades || [])
    .filter(t => t.sens === 'envoyee' && t.status === 'pending' && t.offer === k.id).length;
  const dispo = Math.max(0, mesEx(k.id) - Math.max(limiteDeck(k), aGarder(k)) - reserve);
  const pris = Math.min(copies, dispo);
  const manque = copies - pris;
  const prixCopie = (typeof fabCouts === 'function' ? fabCouts() : {})[k.rar] || 0;
  const frag = MAITRISE.fragments[n - 1];
  return { n, frag, copies, pris, manque, prixCopie, dispo, total: frag + manque * prixCopie };
}

/* ---------- L'allure ---------- */
/* Ce que renderCard ajoute à une carte maîtrisée : des classes sur son
   enveloppe, et les couches de l'effet — dans la carte (la lumière, la
   gravure, l'holographique : la carte les découpe à sa forme), autour
   d'elle (l'aura, la bordure, la couronne). `calme` : sans animation
   (une grille de cent cartes). */
function maitriseEnveloppe(c, n, calme) {
  if (!n) return { cls: '', style: '', dedans: '', autour: '' };
  const k = carteMaitrise(c);
  return {
    cls: ` mz mz-${n}${calme ? ' mz-calme' : ''}`,
    style: `--mc:${tcol(k)}`,
    dedans: `<i class="mz-l" aria-hidden="true"></i>${n >= 5 ? '<i class="mz-h" aria-hidden="true"></i>' : ''}`,
    autour: `${n >= 3 ? '<i class="mz-a" aria-hidden="true"></i>' : ''}${n >= 4 ? '<i class="mz-b" aria-hidden="true"></i>' : ''}${n >= 5 ? `<i class="mz-c" aria-hidden="true">${COURONNE}</i>` : ''}`
  };
}
const COURONNE = '<svg viewBox="0 0 24 16"><path d="M2 14 1 4l6 4 5-7 5 7 6-4-1 10Z" fill="url(#mzor)" stroke="#5a3a00" stroke-width="1" stroke-linejoin="round"/><defs><linearGradient id="mzor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#f2c24a"/><stop offset="1" stop-color="#9a620a"/></linearGradient></defs><circle cx="12" cy="9.5" r="1.8" fill="#ff5c8a" stroke="#5a3a00" stroke-width=".6"/></svg>';

/* Le petit insigne d'une maîtrise : « III ». */
const insigneMaitrise = n => (n ? `<i class="mz-ins mz-ins-${n}" title="Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]}">${CHIFFRES_ROMAINS[n]}</i>` : '');

/* ---------- La fiche : l'onglet Maîtrise ---------- */
function vMaitriseFiche(c) {
  const k = carteMaitrise(c);
  if (!maitrisable(k)) {
    return `<p class="mz-rien">${k && k.cat === 'essence' ? 'Les Essences ne se maîtrisent pas.' : 'Cette carte ne se maîtrise pas : seules les cartes de l\'extension et les Secrètes le peuvent.'}</p>`;
  }
  const n = niveauMaitrise(k);
  const en = Backend.mode === 'cloud';
  const possede = mesEx(k.id) > 0;
  const cout = coutMaitrise(k);
  const pips = Array.from({ length: MAITRISE.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  const niveaux = MAITRISE.noms.map((nom, i) => {
    const etat = i < n ? 'fait' : i === n ? 'suivant' : '';
    return `<li class="mz-niv ${etat}"><b>${CHIFFRES_ROMAINS[i + 1]}</b><span><em>${nom}</em><small>${h(MAITRISE.dit[i])}</small></span>${i < n ? NAVICO.check : ''}</li>`;
  }).join('');
  let action = '';
  if (!en) action = '<p class="mz-rien">La maîtrise se joue en ligne.</p>';
  else if (!possede) action = `<p class="mz-rien">Il faut posséder ${c.rev ? 'sa carte classique' : 'la carte'} pour la maîtriser.</p>`;
  else if (!cout) action = '<p class="mz-max">Maîtrise au maximum : c\'est une Légende.</p>';
  else {
    const assez = (save.fragments || 0) >= cout.total;
    const lignes = [`<span>${NAVICO.fragment}<b class="tnum">${fmtN(cout.frag)}</b> Fragments</span>`];
    if (cout.copies) {
      lignes.push(cout.pris
        ? `<span>${NAVICO.cards}<b class="tnum">${cout.pris}</b> exemplaire${cout.pris > 1 ? 's' : ''} en trop absorbé${cout.pris > 1 ? 's' : ''}</span>` : '');
      if (cout.manque) lignes.push(`<span class="manque">${NAVICO.fragment}<b class="tnum">+${fmtN(cout.manque * cout.prixCopie)}</b> pour ${cout.manque} exemplaire${cout.manque > 1 ? 's' : ''} qui manque${cout.manque > 1 ? 'nt' : ''}</span>`);
    }
    action = `<div class="mz-cout">${lignes.filter(Boolean).join('')}</div>
      <button class="btn" data-v="maitriser" ${assez ? '' : 'disabled'}>Passer au niveau ${CHIFFRES_ROMAINS[cout.n]} · ${MAITRISE.noms[cout.n - 1]}<span class="mz-tot">${fmtN(cout.total)}</span></button>
      ${assez ? '' : `<p class="mz-rien">Il te manque ${fmtN(cout.total - (save.fragments || 0))} Fragments (tu en as ${fmtN(save.fragments || 0)}). Le recyclage des doublons en rapporte.</p>`}
      <button class="linkbtn mz-apercu" data-v="mz-apercu">Voir le niveau ${CHIFFRES_ROMAINS[cout.n]} sur la carte</button>
      <p class="mz-note">Seuls les exemplaires en trop sont pris : jamais ceux qu'un deck peut contenir (${limiteDeck(k)}), ni ceux que tu as choisi de garder.</p>`;
  }
  return `<div class="mz-tete"><span class="mz-titre">${n ? `Maîtrise ${CHIFFRES_ROMAINS[n]} · <b>${MAITRISE.noms[n - 1]}</b>` : 'Pas encore maîtrisée'}</span><span class="mz-pips">${pips}</span></div>
    ${action}
    <ol class="mz-niveaux">${niveaux}</ol>`;
}

async function maitriserVw() {
  const c = VW && VW.c;
  if (!c) return;
  const k = carteMaitrise(c);
  const cout = coutMaitrise(k);
  if (!cout) return;
  const b = document.querySelector('#viewer [data-v="maitriser"]');
  if (b) b.disabled = true;
  try {
    await Backend.maitriser(k.id);
  } catch (e) {
    toast(e.message || 'La maîtrise n\'est pas passée.');
    if (b) b.disabled = false;
    return;
  }
  SFX.jouer('legend');
  vibrer(30);
  /* La carte change d'allure sous les yeux : elle est redessinée en place,
     un éclair la traverse. */
  rafraichirFicheVw(true);
  toast(`Maîtrise ${CHIFFRES_ROMAINS[cout.n]} · ${MAITRISE.noms[cout.n - 1]} !`);
  render();
}

/* L'aperçu du niveau suivant, posé sur la carte de la fiche le temps de le
   regarder ; un second appui le retire. */
function apercuMaitriseVw() {
  const c = VW && VW.c;
  if (!c) return;
  const cout = coutMaitrise(c);
  if (!cout) return;
  VW.apercu = VW.apercu ? 0 : cout.n;
  const carteEl = document.querySelector('#vwc');
  if (carteEl) carteEl.innerHTML = vCarteVw(c);
  const b = document.querySelector('#viewer [data-v="mz-apercu"]');
  if (b) b.textContent = VW.apercu ? 'Revenir au niveau actuel' : `Voir le niveau ${CHIFFRES_ROMAINS[cout.n]} sur la carte`;
}

/* ---------- La carte fétiche ---------- */
/* La carte fétiche (profil, fiche d'un joueur ; version 3.0.8) : une tuile
   de la DA, pleine, sans rayons ni projecteur. La lumière vient de la carte
   elle-même — son illustration, très floue, teinte le fond — ; la carte,
   intacte, se tient à gauche avec sa maîtrise ; à droite, son nom en grand
   et ce qui la situe : rareté (à sa couleur), Essence, numéro, maîtrise. */
const FET_RAR = { ES: '--r-es', C: '--r-c', PC: '--r-pc', R: '--r-r', E: '--r-e', L: '--r-l', PR: '--r-pr' };

function vFetiche(id, niveau, o) {
  o = o || {};
  const c = id && byId[id];
  if (!c) {
    return o.edit ? `<section class="fet vide">
        <span class="fet-fantome" aria-hidden="true">${NAVICO.star}</span>
        <div class="fet-t"><small>Ma carte fétiche</small><b>Aucune, pour l'instant</b>
          <span class="fet-dit">Celle que tu montres en premier, sur ton profil et ta fiche. Touche une carte de ta Collection, puis « Gérer ».</span>
          <button class="btn tiny" data-tab="collection">Choisir une carte</button></div>
      </section>` : '';
  }
  const k = carteMaitrise(c);
  const n = niveau == null ? (maitrisable(c) ? niveauMaitrise(c) : 0) : niveau;
  const R = RAR[c.rar] || RAR.C;
  const col = COLORS[k.col] || COLORS.neutre;
  const rar = FET_RAR[c.rar] ? `style="color:var(${FET_RAR[c.rar]})"` : '';
  return `<section class="fet${n ? ' fet-mz' + n : ''}" style="--fc:${tcol(k)}">
    <span class="fet-fond" aria-hidden="true" style="background-image:url('${h(c.img)}')"></span>
    <button class="fet-carte" data-show="${c.id}" data-snd="carte" aria-label="Voir ${h(c.nom)}">${renderCard(c, { m: n })}</button>
    <div class="fet-t">
      <small>${o.moi ? 'Ma carte fétiche' : 'Sa carte fétiche'}</small>
      <b>${h(c.nom)}</b>
      <span class="fet-meta"><span class="fet-rar r${c.rar}" ${rar}>${R.nom}${c.rev ? ' · Reverse' : ''}</span>
        <span class="fet-ess">${essIcon(k.col)}${h(col.nom)}</span><span class="fet-num tnum">${c.num ? '#' + String(c.num).padStart(3, '0') : h(c.code || '')}</span></span>
      ${n ? `<span class="fet-mz">${insigneMaitrise(n)}<span>Maîtrise ${CHIFFRES_ROMAINS[n]} · <b>${MAITRISE.noms[n - 1]}</b></span></span>` : ''}
      ${o.edit ? '<button class="btn tiny ghost fet-changer" data-tab="collection">Changer</button>' : ''}
    </div>
  </section>`;
}

async function choisirFeticheVw() {
  const c = VW && VW.c;
  if (!c) return;
  const on = (save.fetiche || null) !== c.id;
  try {
    await Backend.setFetiche(on ? c.id : null);
  } catch (e) { toast(e.message || 'Le choix n\'est pas passé.'); return; }
  SFX.jouer(on ? 'rare' : 'retour');
  toast(on ? `${c.nom} est ta carte fétiche.` : 'Carte fétiche retirée.');
  rafraichirFicheVw(false);
  render();
}
