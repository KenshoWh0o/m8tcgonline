/* La maîtrise des cartes, et la carte fétiche (version 3.0.7).

   Ce que deviennent les Fragments quand la collection est complète : une
   carte qu'on possède s'améliore, en cinq niveaux, et chaque niveau change
   son allure — partout où elle apparaît, en combat compris.

     1 · Éclat    un reflet de lumière passe sur la carte ;
     2 · Liseré   un liseré de métal, à la couleur de son Essence, la borde ;
     3 · Aura     un halo de son Essence respire derrière elle ;
     4 · Arène    une lumière court sur son liseré ; en combat, elle entre
                  dans l'arène dans un éclat, et ses coups brillent ;
     5 · Légende  un liseré irisé, un reflet irisé très doux, un joyau serti
                  au sommet ; en combat, une onde de choc à son entrée.
   (Version 3.0.8 : plus de trame sur l'illustration ni de couronne ; la
   carte reste intacte, c'est sa finition qui change.)

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
  noms: ['Éclat', 'Liseré', 'Aura', 'Arène', 'Légende'],
  dit: [
    'Un reflet de lumière passe sur la carte.',
    'Un liseré de métal, à la couleur de son Essence, borde la carte.',
    'Un halo de son Essence respire derrière elle.',
    'Une lumière court sur son liseré. En combat, elle entre dans l\'arène dans un éclat, et ses coups brillent.',
    'Un liseré irisé, un reflet irisé et un joyau à son sommet. En combat, une onde de choc à son entrée.'
  ],
  /* Les Fragments d'un niveau (version 3.0.8) : la base de la rareté, fois
     1, 2, 4, 7, 11 — 25 fois la base pour la Légende : 1 500 pour une
     Commune, 15 000 pour une Légendaire (docs/economie-3.0.md, 3 ter). */
  base: { C: 60, PC: 100, R: 200, E: 400, L: 600, S: 600 },
  mult: [1, 2, 4, 7, 11],
  /* Les exemplaires en trop qu'absorbe chaque niveau, selon la rareté : plus
     une carte est rare, moins on en demande. */
  copies: { C: [1, 1, 1, 2, 2], PC: [1, 1, 1, 1, 2], R: [0, 1, 1, 1, 1], E: [0, 0, 1, 0, 1], L: [0, 0, 0, 0, 1], S: [0, 0, 0, 0, 0] }
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

/* Les Fragments du niveau n d'une carte de rareté `rar`. */
const fragmentsMaitrise = (rar, n) => (MAITRISE.base[rar] || 0) * (MAITRISE.mult[n - 1] || 0);

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
  const frag = fragmentsMaitrise(k.rar, n);
  return { n, frag, copies, pris, manque, prixCopie, dispo, total: frag + manque * prixCopie };
}

/* ---------- L'allure ---------- */
/* Ce que renderCard ajoute à une carte maîtrisée : des classes sur son
   enveloppe, et les couches de l'effet — dans la carte (le reflet, le
   liseré, la lumière qui court, le reflet irisé : la carte les découpe à sa
   forme), autour d'elle (le halo, le joyau). `calme` : sans animation (une
   grille de cent cartes). L'arène fait de même (js/combat/table.js,
   htmlCarte et mzAutour). */
const mzDedans = n => `<i class="mz-l" aria-hidden="true"></i>${n >= 2 ? '<i class="mz-e" aria-hidden="true"></i>' : ''}${n >= 4 ? '<i class="mz-b" aria-hidden="true"></i>' : ''}${n >= 5 ? '<i class="mz-h" aria-hidden="true"></i>' : ''}`;
const mzAutourDe = n => `${n >= 3 ? '<i class="mz-a" aria-hidden="true"></i>' : ''}${n >= 5 ? `<i class="mz-c" aria-hidden="true">${JOYAU}</i>` : ''}`;
function maitriseEnveloppe(c, n, calme) {
  if (!n) return { cls: '', style: '', dedans: '', autour: '' };
  const k = carteMaitrise(c);
  return { cls: ` mz mz-${n}${calme ? ' mz-calme' : ''}`, style: `--mc:${tcol(k)}`, dedans: mzDedans(n), autour: mzAutourDe(n) };
}
/* Le joyau de la Légende (à la place de la couronne, version 3.0.8) : une
   pierre taillée à la couleur de l'Essence, sertie d'or, posée à cheval sur
   le bord haut de la carte ; une étincelle y passe de temps en temps. Le
   dégradé d'or porte un identifiant fixe : identique partout, il peut être
   défini plusieurs fois dans la page. */
const JOYAU = '<svg viewBox="0 0 60 28"><defs><linearGradient id="mzjor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#f5c451"/><stop offset="1" stop-color="#8a5a06"/></linearGradient></defs>'
  + '<g fill="none" stroke="url(#mzjor)" stroke-width="1.7" stroke-linecap="round"><path d="M11 14C7 9.6 4 10.4 1.6 12.6M11 14C7 18.4 4 17.6 1.6 15.4M49 14C53 9.6 56 10.4 58.4 12.6M49 14C53 18.4 56 17.6 58.4 15.4"/></g>'
  + '<circle cx="1.6" cy="14" r="1.3" fill="url(#mzjor)"/><circle cx="58.4" cy="14" r="1.3" fill="url(#mzjor)"/>'
  + '<path d="M10 14 17 5.5h26L50 14l-7 8.5H17Z" fill="url(#mzjor)" stroke="#4a3000" stroke-width=".9" stroke-linejoin="round"/>'
  + '<path d="M13 14 18.4 7.6h23.2L47 14l-5.4 6.4H18.4Z" fill="none" stroke="#fff7d6" stroke-width=".6" opacity=".7"/>'
  + '<path d="M15 14 19.5 9h21L45 14l-4.5 5h-21Z" style="fill:var(--mc)" stroke="#2a1a00" stroke-width=".5" stroke-linejoin="round"/>'
  + '<path d="M15 14 19.5 9h21L45 14Z" fill="#fff" opacity=".2"/>'
  + '<path d="M22 14 24.5 11.2h11L38 14l-2.5 2.8h-11Z" style="fill:color-mix(in srgb,var(--mc) 45%,#fff)"/>'
  + '<path d="M24.5 11.2 19.5 9M35.5 11.2 40.5 9M38 14h7M35.5 16.8 40.5 19M24.5 16.8 19.5 19M22 14h-7" stroke="#fff" stroke-width=".45" opacity=".55"/>'
  + '<path class="mz-eclat" d="M25.5 9.4 26.3 11.2 28.1 12 26.3 12.8 25.5 14.6 24.7 12.8 22.9 12 24.7 11.2Z" fill="#fff"/></svg>';

/* Le petit insigne d'une maîtrise : « III ». */
const insigneMaitrise = n => (n ? `<i class="mz-ins mz-ins-${n}" title="Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]}">${CHIFFRES_ROMAINS[n]}</i>` : '');

/* ---------- La fiche : l'onglet Maîtrise (version 3.0.8) ----------
   Tout tient sans défiler : la frise des cinq niveaux (touchée, elle montre
   ce niveau sur la carte, au-dessus ; touchée encore, elle revient), le
   détail du niveau regardé, ce que coûte le suivant, un seul bouton. */
function vMaitriseFiche(c) {
  const k = carteMaitrise(c);
  if (!maitrisable(k)) {
    return `<p class="mz-rien">${k && k.cat === 'essence' ? 'Les Essences ne se maîtrisent pas.' : 'Cette carte ne se maîtrise pas : seules les cartes de l\'extension et les Secrètes le peuvent.'}</p>`;
  }
  const n = niveauMaitrise(k);
  const vu = VW && VW.c === c && VW.apercu ? VW.apercu : 0;
  const en = Backend.mode === 'cloud';
  const possede = mesEx(k.id) > 0;
  const cout = coutMaitrise(k);
  /* La frise. */
  const etapes = MAITRISE.noms.map((nom, i) => {
    const m = i + 1;
    const etat = m <= n ? 'fait' : m === n + 1 ? 'suivant' : 'loin';
    return `<button class="mz-etape ${etat}${m === 5 ? ' legende' : ''}${vu === m ? ' vu' : ''}" data-v="mz-voir" data-n="${m}" aria-pressed="${vu === m}"
        aria-label="Niveau ${CHIFFRES_ROMAINS[m]}, ${nom}${m <= n ? ', atteint' : ''}"><b>${CHIFFRES_ROMAINS[m]}</b><small>${nom}</small></button>`;
  }).join('');
  /* Le niveau regardé : celui touché, sinon le suivant (ou la Légende). */
  const d = vu || Math.min(n + 1, MAITRISE.max);
  const statut = vu ? 'Aperçu sur la carte · touche encore pour revenir'
    : d <= n ? 'Atteint' : d === n + 1 ? 'Prochain niveau' : '';
  const detail = `<div class="mz-detail${d <= n ? ' fait' : ''}">
      <b>${CHIFFRES_ROMAINS[d]} · ${MAITRISE.noms[d - 1]}</b><small>${h(statut)}</small>
      <p>${h(MAITRISE.dit[d - 1])}</p></div>`;
  let action = '';
  if (!en) action = '<p class="mz-rien">La maîtrise se joue en ligne.</p>';
  else if (!possede) action = `<p class="mz-rien">Il faut posséder ${c.rev ? 'sa carte classique' : 'la carte'} pour la maîtriser.</p>`;
  else if (!cout) action = '<p class="mz-max">Maîtrise au maximum : c\'est une Légende.</p>';
  else {
    const assez = (save.fragments || 0) >= cout.total;
    const morceaux = [`${NAVICO.fragment}<b class="tnum">${fmtN(cout.frag)}</b>`];
    if (cout.pris) morceaux.push(`${NAVICO.cards}<b class="tnum">${cout.pris}</b> en trop`);
    if (cout.manque) morceaux.push(`<span class="manque">+<b class="tnum">${fmtN(cout.manque * cout.prixCopie)}</b> pour ${cout.manque} qui manque${cout.manque > 1 ? 'nt' : ''}</span>`);
    action = `<button class="btn mz-go" data-v="maitriser" ${assez ? '' : 'disabled'}>
        <span>Passer au niveau ${CHIFFRES_ROMAINS[cout.n]}</span><span class="mz-tot">${NAVICO.fragment}${fmtN(cout.total)}</span></button>
      <p class="mz-cout">${morceaux.join('<i>·</i>')}<i>·</i>tu as <b class="tnum">${fmtN(save.fragments || 0)}</b></p>
      ${assez ? '' : `<p class="mz-rien">Il te manque ${fmtN(cout.total - (save.fragments || 0))} Fragments : le recyclage des doublons en rapporte.</p>`}`;
  }
  return `<div class="mz-fiche" style="--mc:${tcol(k)}">
    <div class="mz-frise" style="--n:${n}">${etapes}</div>
    ${detail}
    ${action}
    <p class="mz-note">Seuls les exemplaires en trop sont pris : jamais ceux qu'un deck peut contenir (${limiteDeck(k)}), ni ceux que tu gardes.</p>
  </div>`;
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
function voirNiveauVw(m) {
  const c = VW && VW.c;
  if (!c) return;
  const n = niveauMaitrise(c);
  /* Touché encore, ou son niveau actuel : on revient à la carte telle qu'elle est. */
  VW.apercu = VW.apercu === m || m === n ? 0 : m;
  const carteEl = document.querySelector('#vwc');
  if (carteEl) carteEl.innerHTML = vCarteVw(c);
  const p = document.querySelector('#viewer .vw-page[data-p="maitrise"]');
  if (p) p.innerHTML = vMaitriseFiche(c);
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
