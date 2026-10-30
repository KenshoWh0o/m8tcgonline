/* La maîtrise des cartes, et la carte fétiche (version 3.0.7).

   Ce que deviennent les Fragments quand la collection est complète : une
   carte qu'on possède s'améliore, en cinq niveaux, et chaque niveau ajoute
   une finition, comme les versions premium d'une carte imprimée — partout
   où elle apparaît, en combat compris (version 3.0.11, refonte entière) :

     1 · Satin    un vernis : un reflet posé, une lumière qui glisse ;
     2 · Écrin    un fin cadre de métal autour de la carte, à la couleur de
                  son Essence (le liseré de la 3.0.11, posé sur le bord de
                  la carte, la dénaturait : version 3.0.12) ;
     3 · Holo     son illustration devient holographique ;
     4 · Lumière  une lumière fait le tour de l'écrin, des étincelles
                  montent, un halo ; en combat, elle entre dans un éclat, et
                  ses coups brillent ;
     5 · Légende  un écrin prismatique et trois étoiles du logo qui
                  scintillent ; en combat, une onde de choc.
   En combat, chaque niveau se voit à l'entrée de la carte — un Joueur posé,
   mais aussi un Moment ou un Coach joué, un Objet lié (mzEffetCombat). La
   carte reste intacte : c'est sa finition qui change (css/maitrise.css).

   Ce que coûte un niveau : des Fragments, et des exemplaires de la carte.
   Le conflit avec les decks (il en faut trois pour jouer une carte trois
   fois) est réglé ainsi : la maîtrise ne prend que les exemplaires EN TROP —
   au-delà de ce qu'un deck peut contenir (trois, quelle que soit la rareté,
   depuis les règles officielles de la 3.0.12 ; deux, ou un pour une
   Légendaire ou une Secrète, avant), au-delà de ce que le joueur a choisi de garder, et hors de
   ce qui est promis dans un échange. Il en manque ? Chacun se remplace par
   son prix de fabrication en Fragments : la maîtrise n'est jamais bloquée,
   même avec une seule Légendaire. La maîtrise vaut pour la carte (toutes
   ses copies) ; sa Reverse la partage.

   Les montants sont aussi côté serveur (supabase/installation/28_maitrise.sql), qui
   revérifie tout : les deux doivent rester d'accord. */
"use strict";

const MAITRISE = {
  max: 5,
  noms: ['Satin', 'Écrin', 'Holo', 'Lumière', 'Légende'],
  dit: [
    'Un vernis satiné : un reflet se pose sur la carte, une lumière la traverse de temps en temps.',
    'Un fin écrin de métal autour de la carte, à la couleur de son Essence : la carte, elle, reste intacte.',
    'Son illustration devient holographique : un reflet prismatique la traverse, des paillettes s\'y allument.',
    'Une lumière fait le tour de son écrin, des étincelles montent, un halo l\'entoure. En combat, elle entre dans un éclat, et ses coups brillent.',
    'Un écrin prismatique et trois étoiles qui scintillent. En combat, une onde de choc traverse le plateau.'
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
/* Ce qu'un deck peut en contenir (REGLE.COPIES, js/combat/moteur.js) :
   trois, quelle que soit la rareté (règles officielles, 3.0.12). */
const limiteDeck = () => (typeof Combat !== 'undefined' ? Combat.REGLE.COPIES : 3);

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
   enveloppe, et les couches des finitions — dans la carte (le vernis,
   l'holo, les étincelles, les étoiles : la carte les découpe à sa forme),
   autour d'elle (le halo, l'écrin et sa lumière). `calme` : sans animation
   (une grille de cent cartes). L'arène fait de même (js/combat/table.js,
   htmlCarte et mzAutour). L'ordre des couches compte : le halo sous
   l'écrin, sa lumière par-dessus ; dans la carte, les étoiles au-dessus de
   tout. */
/* L'étoile du logo, à quatre branches : l'insigne, les étoiles de la
   Légende. */
const MZ_ETOILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .6c1 6.6 4.3 10 11.4 11.4C16.3 13.4 13 16.8 12 23.4 11 16.8 7.7 13.4.6 12 7.7 10.6 11 7.2 12 .6Z"/></svg>';
/* La même, au prisme des Secrètes (l'insigne de la Légende). Le dégradé
   porte un identifiant fixe : identique partout, il peut être défini
   plusieurs fois dans la page. */
const MZ_ETOILE_V = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="mzprisme" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc4e4"/><stop offset=".35" stop-color="#d9c9ff"/><stop offset=".65" stop-color="#b9e4ff"/><stop offset="1" stop-color="#bff3dc"/></linearGradient></defs><path d="M12 .6c1 6.6 4.3 10 11.4 11.4C16.3 13.4 13 16.8 12 23.4 11 16.8 7.7 13.4.6 12 7.7 10.6 11 7.2 12 .6Z"/></svg>';
const mzDedans = n => '<i class="mz-s" aria-hidden="true"></i>'
  + (n >= 3 ? '<i class="mz-h" aria-hidden="true"></i>' : '')
  + (n >= 4 ? '<i class="mz-p" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></i>' : '')
  + (n >= 5 ? `<i class="mz-g" aria-hidden="true">${MZ_ETOILE}${MZ_ETOILE}${MZ_ETOILE}</i>` : '');
const mzAutourDe = n => (n >= 4 ? '<i class="mz-a" aria-hidden="true"></i>' : '')
  + (n >= 2 ? '<i class="mz-t" aria-hidden="true"></i>' : '')
  + (n >= 4 ? '<i class="mz-b" aria-hidden="true"></i>' : '');
function maitriseEnveloppe(c, n, calme) {
  if (!n) return { cls: '', style: '', dedans: '', autour: '' };
  const k = carteMaitrise(c);
  return { cls: ` mz mz-${n}${calme ? ' mz-calme' : ''}`, style: `--mc:${tcol(k)}`, dedans: mzDedans(n), autour: mzAutourDe(n) };
}

/* Le petit insigne d'une maîtrise : « ✦ III » (version 3.0.11 : l'étoile du
   logo et le chiffre, sur une pastille graphite ; plus de jaune). */
const insigneMaitrise = n => (n ? `<i class="mz-ins mz-ins-${n}" title="Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]}">${n >= 5 ? MZ_ETOILE_V : MZ_ETOILE}<b>${CHIFFRES_ROMAINS[n]}</b></i>` : '');

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
  else if (!cout) action = `<p class="mz-max">${insigneMaitrise(MAITRISE.max)}Maîtrise au maximum : c'est une Légende.</p>`;
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
  /* La carte change d'allure sous les yeux : elle est redessinée en place,
     puis la montée se joue sur elle (jouerMonteeMaitrise). */
  rafraichirFicheVw();
  render();
  await jouerMonteeMaitrise(document.querySelector('#vwc'), cout.n, tcol(k));
}

/* La montée d'un niveau, sur une carte affichée (la fiche ; l'aperçu du
   Labo, js/lab.js) : la carte se soulève, un éclat blanc, un trait de
   lumière la traverse, et le chiffre du niveau s'inscrit sur elle avec son
   nom ; des étincelles de sa couleur, un carillon (plus riche de niveau en
   niveau). `el` contient la carte (son .cwrap) ; elle a déjà sa nouvelle
   finition. Avec les mouvements réduits : le carillon et un message. */
function jouerMonteeMaitrise(el, n, mc) {
  const w = el && el.querySelector('.cwrap');
  SFX.jouer(n >= 5 ? 'legend' : n >= 3 ? 'epique' : 'rare');
  vibrer(n >= 5 ? [30, 60, 40] : 30);
  if (!w || RM()) {
    toast(`Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]} !`);
    return Promise.resolve();
  }
  w.style.setProperty('--mc', mc);
  w.classList.remove('mz-monte'); void w.offsetWidth; w.classList.add('mz-monte');
  const sceau = document.createElement('span');
  sceau.className = 'mz-sceau';
  sceau.innerHTML = `<b>${CHIFFRES_ROMAINS[n]}</b><small>${MAITRISE.noms[n - 1]}</small>`;
  w.appendChild(sceau);
  if (typeof FX !== 'undefined') {
    const r = w.getBoundingClientRect();
    const couleurs = n >= 5 ? ['#fff', mc, '#ffc4e4', '#b9e4ff', '#d9c9ff'] : ['#fff', mc, mc];
    setTimeout(() => FX.burst(r.left + r.width / 2, r.top + r.height * .45, { n: 30 + n * 12, colors: couleurs, speed: 7, size: 3.2, g: .08 }), 160);
  }
  return new Promise(fin => setTimeout(() => { w.classList.remove('mz-monte'); sceau.remove(); fin(); }, 1750));
}

/* En combat (js/combat/table.js) et dans l'aperçu du Labo : ce que fait une
   carte maîtrisée en entrant — un Joueur posé, un Moment ou un Coach joué
   (montré en grand), un Objet lié (sur le Joueur qui le reçoit). Avant la
   3.0.11, seuls les Joueurs des niveaux IV et V avaient leur entrée.
     I et plus   un trait de lumière passe sur la carte ;
     III et plus un anneau de sa couleur part d'elle ;
     IV et plus  un éclat, des étincelles, un carillon ;
     V           une onde de choc traverse le plateau, qui tremble.
   `x` : l'élément de la carte (positionné) ; `o.scene` : le plateau, où
   poser l'anneau et l'onde ; `o.secousse(force)` : faire trembler le
   plateau ; `o.vitesse` : le réglage « Animations rapides » de l'arène.
   Renvoie une promesse : le temps à attendre avant la suite. */
function mzEffetCombat(x, n, mc, o) {
  o = o || {};
  if (!x || !n) return Promise.resolve();
  const calme = RM();
  if (n >= 4) SFX.jouer(n >= 5 ? 'legend' : 'rare');
  else SFX.jouer('piece');
  if (calme) return Promise.resolve();
  const trait = document.createElement('i');
  trait.className = 'mz-trait';
  trait.style.setProperty('--mc', mc);
  x.appendChild(trait);
  setTimeout(() => trait.remove(), 800);
  const scene = o.scene || x.offsetParent || document.body;
  const r = x.getBoundingClientRect(), sc = scene.getBoundingClientRect();
  const centre = el => { el.style.left = (r.left - sc.left + r.width / 2) + 'px'; el.style.top = (r.top - sc.top + r.height / 2) + 'px'; el.style.setProperty('--mc', mc); };
  if (n >= 3) {
    const a = document.createElement('i');
    a.className = 'mz-anneau';
    centre(a);
    scene.appendChild(a);
    setTimeout(() => a.remove(), 1000);
  }
  if (n >= 4) {
    x.style.setProperty('--mc', mc);
    x.classList.remove('mz-entree'); void x.offsetWidth; x.classList.add('mz-entree');
    setTimeout(() => x.classList.remove('mz-entree'), 1100);
    if (typeof FX !== 'undefined') FX.burst(r.left + r.width / 2, r.top + r.height / 2, { n: n >= 5 ? 46 : 30, colors: ['#fff', mc, mc, color2(mc)], speed: 6, size: 3, g: .1 });
  }
  if (n >= 5) {
    const w = document.createElement('i');
    w.className = 'mz-onde';
    centre(w);
    scene.appendChild(w);
    setTimeout(() => w.remove(), 1300);
    if (o.secousse) o.secousse(6);
  }
  const ms = n >= 5 ? 700 : n >= 4 ? 420 : n >= 3 ? 260 : 120;
  return new Promise(fin => setTimeout(fin, ms * (o.vitesse || 1)));
}
/* Une seconde teinte des étincelles : la couleur, éclaircie de moitié. Les
   particules sont dessinées dans un canvas : une couleur #rrggbb, pas un
   color-mix(). */
function color2(mc) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(mc || '').trim());
  if (!m) return '#ffffff';
  const v = parseInt(m[1], 16);
  return '#' + [16, 8, 0].map(k => Math.round((((v >> k) & 255) + 255) / 2).toString(16).padStart(2, '0')).join('');
}

/* L'aperçu du niveau suivant, posé sur la carte de la fiche le temps de le
   regarder ; un second appui le retire. */
function voirNiveauVw(m) {
  const c = VW && VW.c;
  if (!c) return;
  const n = niveauMaitrise(c);
  /* Touché encore, ou son niveau actuel : on revient à la carte telle qu'elle est. */
  VW.apercu = VW.apercu === m || m === n ? 0 : m;
  /* La carte change de finition en place : ses classes et ses calques, pas
     son image (version 3.0.12 ; la redessiner rechargeait l'illustration). */
  const w = document.querySelector('#vwc .cwrap');
  if (w) poserMaitrise(w, c, VW.apercu || n);
  const p = document.querySelector('#viewer .vw-page[data-p="maitrise"]');
  if (p) { p.innerHTML = vMaitriseFiche(c); hauteurPagesVw(); }
}

/* La finition d'une carte déjà affichée (renderCard), changée sans la
   redessiner : les classes de son enveloppe, les calques dans la carte et
   autour d'elle. */
function poserMaitrise(w, c, n) {
  const e = maitriseEnveloppe(c, n, w.classList.contains('mz-calme'));
  [...w.classList].filter(k => /^mz(-\d)?$/.test(k)).forEach(k => w.classList.remove(k));
  w.querySelectorAll(':scope>.card>:is(.mz-s,.mz-h,.mz-p,.mz-g),:scope>:is(.mz-a,.mz-t,.mz-b)').forEach(x => x.remove());
  if (!n) { w.style.removeProperty('--mc'); return; }
  w.classList.add('mz', 'mz-' + n);
  w.style.setProperty('--mc', tcol(carteMaitrise(c)));
  const carte = w.querySelector(':scope>.card');
  if (carte) carte.insertAdjacentHTML('beforeend', e.dedans);
  w.insertAdjacentHTML('beforeend', e.autour);
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
  const crans = Array.from({ length: MAITRISE.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<section class="fet${n ? ' fet-mz' + n : ''}" style="--fc:${tcol(k)}">
    <span class="fet-fond" aria-hidden="true" style="background-image:url('${h(c.img)}')"></span>
    <button class="fet-carte" data-show="${c.id}" data-snd="carte" aria-label="Voir ${h(c.nom)}">${renderCard(c, { m: n })}</button>
    <div class="fet-t">
      <small>${MZ_ETOILE}${o.moi ? 'Ma carte fétiche' : 'Sa carte fétiche'}</small>
      <b>${h(c.nom)}</b>
      <span class="fet-meta"><span class="fet-rar r${c.rar}" ${rar}>${R.nom}${c.rev ? ' · Reverse' : ''}</span>
        <span class="fet-ess">${essIcon(k.col)}${h(col.nom)}</span><span class="fet-num tnum">${c.num ? '#' + String(c.num).padStart(3, '0') : h(c.code || '')}</span></span>
      ${n ? `<span class="fet-mz"><span>${insigneMaitrise(n)}Maîtrise · <b>${MAITRISE.noms[n - 1]}</b></span><span class="fet-crans${n >= MAITRISE.max ? ' max' : ''}" aria-hidden="true">${crans}</span></span>`
        : maitrisable(c) ? '<span class="fet-mz"><span>Pas encore maîtrisée</span></span>' : ''}
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
  rafraichirFicheVw();
  render();
}
