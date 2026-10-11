/* Onglet Collection.

   Trois axes de tri — type, essence, rareté — et un quatrième réglage : montrer
   tout, ou seulement ce qu'on possède. Les empiler en quatre rangées de puces
   aurait mangé la moitié de l'écran avant la première carte : ils sont rangés
   dans un tiroir de filtres, qui ne s'ouvre que si on le demande et qui dit en
   une ligne ce qui est actif. */
"use strict";

const COL_FILTERS = [
  ['all', 'Tout'],
  ['joueur', 'Joueurs'],
  ['coach', 'Coachs'],
  ['moment', 'Moments'],
  ['objet', 'Objets'],
  ['essence', 'Essences']
];

/* Le tiroir de filtres est-il déplié ? Il survit aux rendus, pas aux rechargements. */
let colOuvert = false;

const filtresActifs = () =>
  (colFilter !== 'all' ? 1 : 0) + (essFilter !== 'all' ? 1 : 0)
  + (rarFilter !== 'all' ? 1 : 0) + (colPossedees ? 1 : 0) + (colObjectifs ? 1 : 0) + (colFavoris ? 1 : 0);

/* Le résumé du tiroir replié : il doit suffire à savoir ce qu'on regarde. */
function resumeFiltres() {
  const bouts = [];
  if (colFilter !== 'all') {
    const f = COL_FILTERS.find(([k]) => k === colFilter);
    if (f) bouts.push(f[1]);
  }
  if (rarFilter !== 'all') bouts.push((RAR[rarFilter] || RAR.C).nom);
  if (essFilter !== 'all') bouts.push((COLORS[essFilter] || COLORS.neutre).nom);
  if (colPossedees) bouts.push('possédées');
  if (colObjectifs) bouts.push('à compléter');
  if (colFavoris) bouts.push('favoris');
  return bouts.length ? bouts.join(' · ') : 'Tout afficher';
}

/* Version 2.0 : trois vues. Classiques (les 122 de l'extension), Reverses
   (les 85, une par booster) et Spéciales (Promos, Brillantes, carte unique).
   Une jauge pour tout en tête, et chaque vue a la sienne. */
let colVue = 'classiques';

const possedees = l => l.filter(c => (save.col[c.id] || 0) > 0).length;
const speciales = () => promos.concat(brillantes, uniques);

function vCollection() {
  if (!cards.length) {
    return `<div class="empty"><h1>Collection vide</h1><p class="muted">Le fichier js/cards-data.js ne contient aucune carte.</p></div>`;
  }

  const sp = speciales();
  const vues = [
    { id: 'classiques', nom: 'Classiques', n: possedees(cards), total: cards.length },
    { id: 'reverses', nom: 'Reverses', n: possedees(reverses), total: reverses.length },
    { id: 'speciales', nom: 'Spéciales', n: possedees(sp), total: sp.length }
  ].filter(v => v.total > 0);
  if (!vues.some(v => v.id === colVue)) colVue = 'classiques';
  const toutes = vues.reduce((n, v) => n + v.total, 0);
  const miennes = vues.reduce((n, v) => n + v.n, 0);
  const pctTout = Math.floor(miennes / toutes * 100);

  const tete = `<div class="colhead">
      <div class="colheadtop">
        <h1>Collection</h1>
        <span class="colpct tnum">${pctTout}<small>%</small></span>
      </div>
      <div class="prog">
        <div class="bar"><i style="width:${pctTout}%"></i></div>
        <span class="tnum"><b>${miennes}</b> / ${toutes} cartes</span>
      </div>
    </div>
    <div class="colvues" role="tablist">${vues.map(v => `<button class="colvue ${v.id}${colVue === v.id ? ' on' : ''}" data-colvue="${v.id}"
        role="tab" aria-selected="${colVue === v.id}">
        <b>${v.nom}</b><span class="tnum">${v.n}<small> / ${v.total}</small></span>
        <i class="colvuebar"><i style="width:${Math.round(v.n / v.total * 100)}%"></i></i></button>`).join('')}</div>`;

  return tete + (colVue === 'reverses' ? vColReverses() : colVue === 'speciales' ? vColSpeciales() : vColClassiques());
}

/* ---------- Les 122 de l'extension ---------- */
function vColClassiques() {
  const all = cards.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  const list = filtrer(all);
  const owned = possedees(all);

  /* Les Secrets prennent la suite de la numérotation sans entrer dans le total.
     On ne les montre que sans filtre : ils n'ont encore ni catégorie ni essence. */
  const noFilter = !filtresActifs();

  return `${Backend.mode === 'cloud' && owned < all.length
      ? `<div class="colsous"><span class="colfab">${NAVICO.fragment}<b class="tnum">${fmtN(save.fragments || 0)}</b> ${FRAGMENTS.nom} · touche une case vide pour la fabriquer</span></div>`
      : ''}

    ${noFilter && uniques[0] && save.col[uniques[0].id] > 0 ? vUniqueVitrine() : ''}

    ${vFiltres(all)}

    ${list.length
      ? `<div class="grid">${list.map(vCase).join('')}${noFilter ? cellulesSecretes() : ''}</div>`
      : `<p class="empty">Aucune carte avec ces filtres.
          <button class="linkbtn" data-act="col-reset">Tout réafficher</button></p>`}`;
}

/* ---------- Les 85 Reverses ---------- */
function vColReverses() {
  const all = reverses.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  const list = filtrer(all);
  const ouverte = (save.parametres || {}).fabrication_reverse;
  return `<p class="colsous revfab">${NAVICO.fragment}${ouverte
      ? 'Fabrication ouverte : le double du prix d\'une classique.'
      : 'La fabrication des Reverses ouvrira plus tard.'}</p>
    ${vFiltres(all)}
    ${list.length
      ? `<div class="grid">${list.map(vCase).join('')}</div>`
      : `<p class="empty">Aucune Reverse avec ces filtres.
          <button class="linkbtn" data-act="col-reset">Tout réafficher</button></p>`}`;
}

/* ---------- Promos, Brillantes, carte unique ---------- */
function vColSpeciales() {
  return `${uniques[0] && save.col[uniques[0].id] > 0 ? vUniqueVitrine() : ''}
    ${vPromosSection()}
    ${vBrillantesSection()}
    ${uniques[0] && !(save.col[uniques[0].id] > 0) ? vUniqueVitrine() : ''}`;
}

/* Les filtres du tiroir, appliqués à une liste. */
const filtrer = all => all
  .filter(c => colFilter === 'all' || c.cat === colFilter)
  .filter(c => essFilter === 'all' || c.col === essFilter)
  .filter(c => rarFilter === 'all' || c.rar === rarFilter)
  .filter(c => !colPossedees || save.col[c.id] > 0)
  .filter(c => !colObjectifs || aCompleter(c))
  .filter(c => !colFavoris || estFavori(c));

/* Version 2.1 : les cartes en favori (le cœur de la visionneuse). */
const estFavori = c => !!c && (save.favoris || []).includes(c.id);

/* Version 2.1 : une carte qu'on a, mais en moins d'exemplaires qu'on veut
   en garder. Celles qui manquent ont déjà leur case vide : les mêler ici
   noierait la liste. « Toutes » n'a pas de compte à atteindre. */
const aCompleter = c => { const g = aGarder(c); const n = mesEx(c.id); return g > 1 && g < GARDE_TOUT && n > 0 && n < g; };
/* Le filtre n'apparaît qu'une fois un objectif posé : sans, il serait vide. */
const objectifsPoses = () => Backend.mode === 'cloud' && (Object.keys(save.gardes || {}).length > 0
  || Object.values(save.garder || {}).some(n => n > 1));

/* ---------- Le tiroir de filtres ---------- */
function vFiltres(all) {
  const cats = COL_FILTERS.filter(([k]) => k === 'all' || all.some(c => c.cat === k));
  const essences = Object.keys(COLORS).filter(k => all.some(c => c.col === k));
  const rars = RAR_FILTRES.filter(k => all.some(c => c.rar === k));
  const n = filtresActifs();

  const ligne = (titre, contenu) =>
    `<div class="filigne"><span class="filab">${titre}</span>${contenu}</div>`;

  return `<div class="filtres${colOuvert ? ' open' : ''}">
    <button class="filbar" data-act="col-toggle" aria-expanded="${colOuvert}">
      <span class="filico">${NAVICO.filtre}</span>
      <span class="filresume">${h(resumeFiltres())}</span>
      ${n ? `<i class="pastille">${n}</i>` : ''}
      <span class="filcaret">${NAVICO.caret}</span>
    </button>

    <div class="filcorps">
      ${ligne('Type', `<div class="chips">${cats.map(([k, l]) =>
        `<button data-filter="${k}" class="${colFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>`)}

      ${ligne('Rareté', `<div class="chips">
        <button data-rar="all" class="${rarFilter === 'all' ? 'on' : ''}">Toutes</button>
        ${rars.map(k => `<button data-rar="${k}" class="rarchip r${k} ${rarFilter === k ? 'on' : ''}">
          <i class="rardot"></i>${(RAR[k] || RAR.C).nom}</button>`).join('')}
      </div>`)}

      ${ligne('Essence', `<div class="essrow">
        <button data-ess="all" class="${essFilter === 'all' ? 'on' : ''}">Toutes</button>
        ${essences.map(k => `<button data-ess="${k}" class="${essFilter === k ? 'on' : ''}"
          style="--ec:${COLORS[k].c}">${essIcon(k)}${COLORS[k].nom}</button>`).join('')}
      </div>`)}

      <label class="toggle filtoggle">
        <span>Seulement mes cartes<small>Masque les emplacements vides</small></span>
        <input type="checkbox" id="col-poss" ${colPossedees ? 'checked' : ''}>
      </label>
      ${(save.favoris || []).length || colFavoris ? `<label class="toggle filtoggle">
        <span>Mes favoris<small>Les cartes où tu as posé un cœur</small></span>
        <input type="checkbox" id="col-fav" ${colFavoris ? 'checked' : ''}>
      </label>` : ''}
      ${objectifsPoses() || colObjectifs ? `<label class="toggle filtoggle">
        <span>À compléter<small>Tu les as, mais moins que ce que tu veux garder</small></span>
        <input type="checkbox" id="col-obj" ${colObjectifs ? 'checked' : ''}>
      </label>` : ''}

      ${n ? '<button class="linkbtn filreset" data-act="col-reset">Tout réafficher</button>' : ''}
    </div>
  </div>`;
}

/* ---------- Les cases ---------- */
/* Un emplacement vide porte son numéro, et derrière lui une marque très en
   retrait qui lui donne une forme — sans elle, la case n'est qu'un rectangle
   gris.

   Deux marques, et la distinction compte : l'étincelle veut dire « une carte
   de l'extension, que tu n'as pas encore ». Le point d'interrogation veut dire
   « on ne sait pas encore laquelle » — les emplacements Secrets et les Promos
   annoncées mais pas encore sorties. Promettre une carte précise là où il n'y
   en a pas encore, ce serait mentir avec une icône. */
const caseVide = (etiquette, cls, sous) => {
  const classes = cls || '';
  const secret = classes.includes('secretcell');
  const inconnue = secret || classes.includes('avenir');
  return `<div class="gcell${cls ? ' ' + cls : ''}">
    <div class="cwrap"><div class="card ghost-card${secret ? ' secret-card' : ''}">
      <i class="ghostmark${inconnue ? ' inconnue' : ''}" aria-hidden="true">${inconnue ? '?' : ICON.star}</i>
      <span>${h(etiquette)}</span></div></div>
    ${sous ? `<span class="promocomment">${h(sous)}</span>` : '<span class="num">&nbsp;</span>'}
  </div>`;
};

function vCase(c) {
  const n = save.col[c.id] || 0;
  const no = '#' + String(c.num || 0).padStart(3, '0');
  /* Une classique dont on a aussi la Reverse : un petit éclat nacré à côté
     de son numéro, sous la carte — rien sur l'illustration. */
  const rev = !c.rev && byId['r' + c.id.slice(1)] && save.col['r' + c.id.slice(1)] > 0;
  if (n) return `<button class="gcell${c.rev ? ' revcell' : ''}" data-show="${c.id}">${vCompte(n)}${avecMaitrise(renderCard(c), c)}<span class="num"><span class="numtxt">${vCoeur(c)}${no}${rev ? '<i class="revico" role="img" aria-label="Tu as aussi sa Reverse" title="Tu as aussi sa Reverse"></i>' : ''}${vGarde(c, n)}</span></span></button>`;
  /* Une carte qui manque se fabrique (js/recyclage.js) : la case vide devient
     un bouton. Hors ligne, il n'y a pas de Fragments, elle reste une case. */
  if (Backend.mode !== 'cloud') return caseVide(no);
  return caseVide(no).replace('<div class="gcell"', `<button class="gcell fab" data-craft="${c.id}" aria-label="Fabriquer la carte ${no}"`)
    .replace(/<\/div>\s*$/, '</button>');
}

/* Version 2.1 : un petit cœur à gauche du numéro, en miroir de l'objectif
   à droite : le numéro reste au centre. */
const vCoeur = c => estFavori(c)
  ? `<i class="gfav" role="img" aria-label="Dans tes favoris" title="Dans tes favoris">${NAVICO.coeur}</i>` : '';

/* Le compte posé sur une case : celui d'avant, inchangé. */
const vCompte = n => n > 1 ? `<span class="count">×${n}</span>` : '';

/* Version 2.1 : où on en est de ce qu'on veut garder. Rien sur la carte :
   sous elle, à côté du numéro, comme l'éclat de la Reverse. Un point par
   exemplaire voulu, plein pour ceux qu'on a, dorés une fois au complet ;
   au-delà de cinq, « 3/8 » ; un cadenas pour « Tous ». */
function vGarde(c, n) {
  const g = aGarder(c);
  if (g <= 1) return '';
  if (g === GARDE_TOUT) {
    return `<i class="gmark glock" role="img" aria-label="Tu gardes tous tes exemplaires" title="Tu gardes tous tes exemplaires">${NAVICO.lock}</i>`;
  }
  const dit = `Tu en as ${n}, tu veux en garder ${g}`;
  if (g > 5) return `<i class="gmark gnum${n >= g ? ' ok' : ''}" role="img" aria-label="${dit}" title="${dit}">${Math.min(n, g)}/${g}</i>`;
  return `<i class="gmark gpips${n >= g ? ' ok' : ''}" role="img" aria-label="${dit}" title="${dit}">${
    Array.from({ length: g }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</i>`;
}

/* Les Secrètes (version 3.0) prolongent la grille sans en changer le total.
   Obtenue, une Secrète s'y montre comme les autres — floutée si elle n'est
   pas encore révélée ; sinon, un emplacement vide marqué d'un « ? ». */
function cellulesSecretes() {
  return secretes.map(c => (save.col[c.id] > 0 ? vCase(c)
    : caseVide('#' + String(c.num).padStart(3, '0'), 'secretcell'))).join('');
}

/* ---------- Les Promos ---------- */
/* Hors de l'extension, donc hors du total et hors de la grille principale. Une
   case vide y dit comment obtenir la carte : c'est la seule grille du jeu où
   l'absence se répare autrement qu'en ouvrant des paquets.

   Les cases sortent dans l'ordre des codes : celles qu'on a, celles qu'on peut
   obtenir, et celles qui n'existent pas encore. Une série se lit entière ou pas
   du tout — laisser un trou entre P02 et P05 donnerait l'impression d'un bug
   plutôt que d'une suite à venir. */
function cellulesPromo() {
  const connues = promos.map(p => {
    const n = save.col[p.id] || 0;
    return { code: p.code, tri: p.num, html: n
      ? `<button class="gcell" data-show="${p.id}">${vCompte(n)}${renderCard(p)}<span class="num"><span class="numtxt">${vCoeur(p)}${h(p.code)}</span></span></button>`
      : caseVide(p.code, 'promovide', PROMO_COMMENT[p.obtention] || '') };
  });

  const aVenir = PROMOS_A_VENIR.map(code => ({
    code, tri: +code.replace(/\D/g, '') || 0,
    html: caseVide(code, 'promovide avenir', PROMO_COMMENT.bientot)
  }));

  return connues.concat(aVenir).sort((a, b) => a.tri - b.tri).map(x => x.html).join('');
}

function vPromosSection() {
  if (!promos.length) return '';
  const eus = promos.filter(p => save.col[p.id] > 0).length;
  /* Le total de la série, emplacements à venir compris : c'est le nombre que le
     joueur voit dans la grille, et celui qu'il cherche à atteindre. */
  const serie = promos.length + PROMOS_A_VENIR.length;

  return `<section class="promosec">
    <div class="promohead">
      <span class="qpico">${NAVICO.promo}</span>
      <div>
        <h2>Cartes Promo</h2>
      </div>
      <span class="qpreste"><b class="tnum">${eus}</b><small>/ ${serie}</small></span>
    </div>
    <div class="grid">${cellulesPromo()}</div>
  </section>`;
}

/* ---------- Les Essences Brillantes ---------- */
/* Neuf cases, une par Essence. Elles ne se fabriquent pas : une case vide dit
   seulement d'où elles viennent. */
function vBrillantesSection() {
  if (!brillantes.length) return '';
  const eus = brillantes.filter(b => save.col[b.id] > 0).length;
  const cases = brillantes.map(b => {
    const n = save.col[b.id] || 0;
    return n
      ? `<button class="gcell" data-show="${b.id}">${vCompte(n)}${renderCard(b)}<span class="num"><span class="numtxt">${vCoeur(b)}${h(b.code)}</span></span></button>`
      : caseVide(b.code, 'promovide');
  }).join('');
  return `<section class="promosec brsec">
    <div class="promohead">
      <span class="qpico">${NAVICO.promo}</span>
      <div><h2>Essences Brillantes</h2></div>
      <span class="qpreste"><b class="tnum">${eus}</b><small>/ ${brillantes.length}</small></span>
    </div>
    <div class="grid">${cases}</div>
  </section>`;
}

/* ---------- La carte unique ---------- */
/* Pas une case parmi d'autres : une vitrine. Chez celui qui l'a tirée, elle
   ouvre la Collection — c'est la pièce que personne d'autre n'aura. Chez les
   autres, elle la referme, avec l'état de la chasse : à venir, ouverte, ou
   terminée et par qui. */
function vUniqueVitrine() {
  const u = uniques[0];
  if (!u) return '';
  const ch = save.chasse || {};
  const mienne = save.col[u.id] > 0;
  const le = iso => new Date(srvTime(iso)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  let etat, kicker, texte;
  if (mienne) {
    etat = 'mienne';
    kicker = 'À toi, pour toujours';
    texte = `Il n'en existe qu'une dans tout le jeu, et c'est la tienne${ch.trouvee_le ? ` — tirée le ${h(le(ch.trouvee_le))}` : ''}.
      Elle ne s'échange pas et ne se recycle pas.`;
  } else if (ch.trouvee) {
    etat = 'trouvee';
    kicker = 'Chasse terminée';
    texte = `Tirée par <b>${h(ch.gagnant || 'un joueur')}</b>${ch.trouvee_le ? ` le ${h(le(ch.trouvee_le))}` : ''}.
      Il n'en existera jamais d'autre.`;
  } else if (ch.active) {
    etat = 'ouverte';
    kicker = 'Chasse ouverte';
    texte = 'Un seul exemplaire, caché dans un booster. La première personne qui le tire le garde pour toujours.';
  } else {
    etat = 'bientot';
    kicker = 'Bientôt';
    texte = ch.ouvre_le
      ? `Un seul exemplaire, caché dans un booster ${h(jourHeure(srvTime(ch.ouvre_le), 'à partir'))}. La première personne qui le tire le garde pour toujours.`
      : 'Un seul exemplaire dans tout le jeu. La chasse n\'est pas encore ouverte.';
  }

  return `<section class="unvitrine ${etat}">
    <div class="unrayons" aria-hidden="true"></div>
    <button class="uncarte" data-show="${u.id}" aria-label="Voir ${h(u.nom)}">${renderCard(u)}</button>
    <div class="untexte">
      <span class="unkicker">${kicker}</span>
      <b class="unnom">${h(u.nom)}</b>
      <span class="unserie">Carte unique · ${h(u.code)}</span>
      <p>${texte}</p>
      ${mienne ? `<button class="btn tiny unpart" data-act="unique-partager">${NAVICO.partage}Partager</button>` : ''}
    </div>
  </section>`;
}
