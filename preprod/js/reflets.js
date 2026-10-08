/* Version 2.0 : l'événement « Reflets » et le Cartle.

   L'onglet de l'événement sert deux buts : faire jouer — quêtes, piste de
   récompenses, boutique, Cartle — et faire découvrir ce que la 2.0 apporte.
   Il remplace Combats dans la barre du bas tant qu'il dure (js/app.js), et
   un bandeau l'annonce en tête de l'écran Boosters (js/booster.js).

   Tout ce qui compte se décide côté serveur (supabase/21_reflets.sql) : le
   solde de Prismes, les paliers, la carte du Cartle — que le navigateur ne
   connaît qu'une fois la partie finie. */
"use strict";

let rfData = null;
let rfErreur = '';
let cartleData = null;
let cartleCherche = '';

async function chargerReflets() {
  try {
    const [ev, ct] = await Promise.all([Backend.evenementEtat(), Backend.cartleEtat()]);
    rfData = ev;
    cartleData = ct;
    rfErreur = '';
  } catch (e) {
    rfErreur = e.message || 'L\'événement n\'a pas pu être chargé.';
  }
  if (tab === 'reflets' || tab === 'cartle') render();
}

async function chargerCartle() {
  try { cartleData = await Backend.cartleEtat(); } catch (e) { /* l'écran le dira */ }
  if (tab === 'reflets' || tab === 'cartle') render();
}

/* Ce qui réclame l'attention dans l'onglet : les quêtes d'événement à
   encaisser, et les paliers atteints pas encore récupérés. */
function evQuetesPretes() {
  if (!evenementEnCours()) return 0;
  const q = (save.quetes || []).filter(x => x.evenement && x.progress >= x.goal && !x.claimed).length;
  const p = rfData ? rfData.piste.filter(x => !x.pris && rfData.total >= x.seuil).length : 0;
  return q + p;
}

/* ---------- L'onglet ---------- */
function vReflets() {
  const ev = save.evenement;
  if (!ev || evenementEnCours() !== 'reflets') return vide('Pas d\'événement en ce moment', 'Reviens bientôt.');
  if (rfErreur) return vide('Événement indisponible', rfErreur);
  if (!rfData) return '<p class="muted boitecharge">Chargement de l\'événement…</p>';

  const fin = srvTime(ev.fin);
  return `${vRfHero(fin)}
    <nav class="rf-ancres">
      ${[['rf-nouveautes', 'Nouveautés'], ['rf-quetes', 'Quêtes'], ['rf-piste', 'Piste'],
         ['rf-cartle', 'Cartle'], ['rf-boutique', 'Boutique'], ['rf-top', 'Classement']]
        .map(([id, n]) => `<button data-ancre="${id}">${n}</button>`).join('')}
    </nav>
    ${vRfNouveautes()}
    ${vRfQuetes()}
    ${vRfPiste()}
    <section class="rf-section" id="rf-cartle">
      <div class="rf-titre"><span>${NAVICO.cartle}</span><div><h2>Le Cartle du jour</h2>
        <p>Une carte à deviner en sept essais. Trouvée : 30 Éclats, et la quête du jour en Prismes.</p></div></div>
      ${vCartle()}
    </section>
    ${vRfBoutique()}
    ${vRfTop()}`;
}

/* Le haut de l'onglet : un éclat holographique, le compte à rebours, le solde. */
function vRfHero(fin) {
  const u = reverses.length ? reverses[Math.floor(Date.now() / 86400000) % reverses.length] : null;
  return `<section class="rf-hero">
    <div class="rf-holo" aria-hidden="true"></div>
    <div class="rf-rayons" aria-hidden="true"></div>
    <div class="rf-herotexte">
      <span class="rf-kicker">Événement · Version 2.0</span>
      <h1 class="rf-nom">Reflets</h1>
      <p>Les Reverses arrivent. Gagne des ${PRISMES.nom} en jouant, remonte la piste, et vide la boutique avant la fin.</p>
      <div class="rf-chiffres">
        <span class="rf-solde">${prismeIco}<b class="tnum">${fmtN(rfData.solde)}</b><small>${PRISMES.nom}</small></span>
        <span class="rf-fin">${NAVICO.clock}<span>encore <b data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</b></span></span>
      </div>
    </div>
    ${u ? `<div class="rf-herocarte" aria-hidden="true">${renderCard(u)}</div>` : ''}
  </section>`;
}

/* ---------- Ce que la 2.0 apporte ---------- */
function vRfNouveautes() {
  const rv = reverses.filter(c => c.rar === 'R');
  const exemple = rv.length ? rv[(new Date().getDate()) % rv.length] : null;
  const nb = l => l.filter(c => save.col[c.id] > 0).length;
  const total = cards.length + reverses.length + promos.length + brillantes.length + uniques.length;
  const carte = (cls, visuel, titre, texte, cta) => `<article class="rf-nv ${cls}">
      <div class="rf-nvvisuel">${visuel}</div>
      <div class="rf-nvtexte"><b>${titre}</b><p>${texte}</p>${cta}</div>
    </article>`;

  return `<section class="rf-section" id="rf-nouveautes">
    <div class="rf-titre"><span>${NAVICO.reflets}</span><div><h2>Ce qui arrive avec la 2.0</h2>
      <p>Tout ce qui est nouveau, et où le trouver.</p></div></div>
    <div class="rf-nvgrille">
      ${carte('grand', exemple ? `<div class="rf-nvcarte">${renderCard(exemple)}</div>` : '',
        'Les Reverses',
        `${reverses.length} cartes frappées du logo Tout Commence Ici, une dans chaque booster — en 4ᵉ carte. Communes, Peu communes et Rares : les Rares sont plus de cinq fois plus dures à trouver que leur version classique. Tu en as <b>${nb(reverses)}</b>.`,
        '<button class="btn tiny" data-colvue="reverses" data-tab="collection">Voir mes Reverses</button>')}
      ${carte('', `<div class="rf-nvjauge"><b class="tnum">${total}</b><small>cartes</small></div>`,
        'La Collection repensée',
        'Classiques, Reverses, Spéciales : trois vues, une jauge pour tout, et un reflet sur chaque carte dont tu as aussi la Reverse.',
        '<button class="btn tiny ghost" data-tab="collection">Ouvrir la Collection</button>')}
      ${carte('', `<div class="rf-nvava">${avatarHTML(save.avatar, 'f_miroir', 'xl', maPhoto())}</div>`,
        'Cadres et titres',
        `De nouveaux cadres à gagner (Miroir, Reflet, Aurore, Maître…) et ${Object.keys(TITRES).length} titres à porter sous ton pseudo.`,
        '<button class="btn tiny ghost" data-tab="profil">Choisir mon titre</button>')}
      ${carte('', `<div class="rf-nvperso"><i></i><i></i><i></i></div>`,
        'Ton profil, à ton image',
        'Une bannière tirée de ta collection et une devise en tête de ta fiche.',
        '<button class="btn tiny ghost" data-tab="profil">Personnaliser</button>')}
      ${carte('', `<div class="rf-nvcartle">${['=', '+', 'x', '='].map(v => `<i class="ct-${v === '=' ? 'ok' : v === 'x' ? 'non' : 'pres'}"></i>`).join('')}</div>`,
        'Le Cartle',
        'La carte du jour à deviner, la même pour tout le monde. Sept essais, des indices à chaque fois.',
        '<button class="btn tiny ghost" data-ancre="rf-cartle">Jouer</button>')}
      ${carte('', `<div class="rf-nvinvit">M8-<b>••••</b></div>`,
        'Les invitations',
        `Fais entrer un ami : 2 000 ${FRAGMENTS.nom} l'invitation, trois au maximum. Il arrive avec un cadeau de bienvenue.`,
        '<button class="btn tiny ghost" data-tab="boutique">Boutique</button>')}
    </div>
  </section>`;
}

/* ---------- Les quêtes de l'événement ---------- */
function vRfQuetes() {
  const qs = (save.quetes || []).filter(q => q.evenement === 'reflets');
  const jour = qs.filter(q => q.scope === 'ev_jour');
  const ev = qs.filter(q => q.scope === 'ev');
  const reste = resteAvantRemise('daily');
  return `<section class="rf-section" id="rf-quetes">
    <div class="rf-titre"><span>${NAVICO.quest}</span><div><h2>Les quêtes</h2>
      <p>Elles paient en ${PRISMES.nom}, et portent sur les nouveautés.</p></div></div>
    <h3 class="rf-sous">Aujourd'hui <small class="muted">· nouvelles dans ${h(dureeCourte(reste))}</small></h3>
    <div class="questlist">${jour.map(vQuete).join('')}</div>
    <h3 class="rf-sous">Pendant l'événement</h3>
    <div class="questlist">${ev.map(vQuete).join('')}</div>
  </section>`;
}

/* ---------- La piste ---------- */
const RF_TYPE_ICO = { boosters: 'star', eclats: null, fragments: 'fragment', titre: 'user', cadre: 'user',
  reverse_R: 'reflets', brillante: 'promo' };

/* L'icône d'une récompense de la piste : sur la piste, et dans la fenêtre du gain. */
function rfIco(x, taille) {
  return x.type === 'eclats' ? shardIco
    : x.type === 'cadre' ? avatarHTML(save.avatar, x.objet, taille || 'sm', maPhoto())
    : x.type === 'titre' ? `<i class="rf-titrebadge">${NAVICO.user}</i>`
    : NAVICO[RF_TYPE_ICO[x.type] || 'star'];
}

function vRfPiste() {
  const total = rfData.total;
  const piste = rfData.piste;
  const max = piste.length ? piste[piste.length - 1].seuil : 1;
  const prochain = piste.find(x => total < x.seuil);
  const pct = Math.min(100, total / max * 100);

  const noeud = x => {
    const atteint = total >= x.seuil;
    const etat = x.pris ? 'pris' : atteint ? 'pret' : 'loin';
    const ico = rfIco(x);
    return `<li class="rf-palier ${etat}${x.palier === piste.length ? ' final' : ''}">
      <span class="rf-seuil tnum">${prismeIco}${fmtN(x.seuil)}</span>
      <span class="rf-recomp">${ico}</span>
      <span class="rf-quoi">${h(x.titre)}</span>
      ${x.pris ? `<span class="rf-etat">${NAVICO.check}Récupéré</span>`
        : atteint ? `<button class="btn tiny" data-palier="${x.palier}" data-snd="piece">Récupérer</button>`
        : `<span class="rf-etat">Palier ${x.palier}</span>`}
    </li>`;
  };

  return `<section class="rf-section" id="rf-piste">
    <div class="rf-titre"><span>${NAVICO.trophy}</span><div><h2>La piste</h2>
      <p>Tout ce que tu gagnes en ${PRISMES.nom} la fait avancer — dépenser n'y change rien.</p></div></div>
    <div class="rf-pistetete">
      <b class="tnum">${fmtN(total)}</b><span>${PRISMES.nom} gagnés</span>
      ${prochain ? `<small>Prochain palier dans <b class="tnum">${fmtN(prochain.seuil - total)}</b></small>` : '<small>Piste terminée. Bravo.</small>'}
    </div>
    <div class="rf-jauge"><i style="width:${pct}%"></i></div>
    <ol class="rf-paliers">${piste.map(noeud).join('')}</ol>
  </section>`;
}

async function reclamerPalier(palier) {
  const x = rfData && rfData.piste.find(p => p.palier === palier);
  occupe(true);
  try {
    const cartes = await Backend.pisteReclamer(palier);
    rfData = await Backend.evenementEtat();
    SFX.jouer('gagne');
    if (!RM()) FX.sparkle({ n: 90, colors: ['#ff7cc8', '#b38cff', '#7fd8ff', '#fff'], size: 3.4 });
    montrerPalier(palier, x, (cartes || []).map(id => byId[id]).filter(Boolean));
  } catch (e) {
    toast(e.message || 'Le palier n\'a pas pu être récupéré.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
  }
}

/* La fenêtre du gain — aussi ouverte par le Labo, sans rien réclamer. */
function montrerPalier(palier, x, ks) {
  openSheet({
    title: `Palier ${palier}`,
    body: `<div class="rf-gain">
        ${ks.length ? `<div class="rf-gaincartes">${ks.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
          : x ? `<span class="rf-gainico">${rfIco(x, 'md')}</span>` : ''}
        <b>${h(x ? x.titre : 'Récompense')}</b>
        <p class="muted small">${x && x.type === 'boosters' ? 'Ils t\'attendent sur l\'écran Boosters, hors réserve.'
          : x && (x.type === 'titre' || x.type === 'cadre') ? 'À choisir dans ton profil.' : 'C\'est sur ton compte.'}</p>
      </div>`,
    actions: x && x.type === 'boosters'
      ? [{ label: 'Ouvrir maintenant', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
         { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
      : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
  });
}

/* ---------- La boutique de l'événement ---------- */
function vRfBoutique() {
  const items = (Backend.shop || []).filter(it => it.evenement === 'reflets');
  const ligne = it => {
    const deja = (save.inv || {})[it.id] || 0;
    const fini = it.unique_buy ? deja > 0 : it.limite != null && deja >= it.limite;
    const reste = it.limite != null && !it.unique_buy ? `${it.limite - deja} / ${it.limite}` : '';
    const visuel = FRAMES[it.id] ? avatarHTML(save.avatar, it.id, 'lg', maPhoto())
      : TITRES[it.id] ? `<span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span>`
      : it.effet === 'reverse_R' ? NAVICO.reflets : it.effet === 'fragments' ? NAVICO.fragment : NAVICO.star;
    return `<article class="rf-article${fini ? ' fini' : ''}">
      <div class="rf-artvisuel">${visuel}</div>
      <div class="rf-arttexte"><b>${h(it.titre)}</b><small>${h(it.detail)}</small>
        ${reste ? `<small class="muted">Encore ${reste}</small>` : ''}</div>
      ${fini ? '<span class="qtag">Acquis</span>'
        : `<button class="btn tiny" data-shop="${h(it.id)}" ${rfData.solde < it.prix ? 'disabled' : ''}>${prismeIco}${fmtN(it.prix)}</button>`}
    </article>`;
  };
  return `<section class="rf-section" id="rf-boutique">
    <div class="rf-titre"><span>${NAVICO.shop}</span><div><h2>La boutique</h2>
      <p>En ${PRISMES.nom}, et seulement pendant l'événement. Ton solde : ${prismeIco}<b>${fmtN(rfData.solde)}</b></p></div></div>
    ${items.length ? `<div class="rf-articles">${items.map(ligne).join('')}</div>` : '<p class="muted">Chargement de la boutique…</p>'}
  </section>`;
}

/* ---------- Le classement de l'événement ---------- */
function vRfTop() {
  const top = rfData.top || [];
  return `<section class="rf-section" id="rf-top">
    <div class="rf-titre"><span>${NAVICO.trophy}</span><div><h2>Les plus brillants</h2>
      <p>Ceux qui ont gagné le plus de ${PRISMES.nom}.</p></div></div>
    ${top.length ? `<ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'sm', j.photo)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.titre && TITRES[j.titre] ? `<small class="titreligne t${TITRES[j.titre].ton}">${h(TITRES[j.titre].nom)}</small>` : ''}</span>
        <span class="rf-pts tnum">${prismeIco}${fmtN(j.total)}</span></li>`).join('')}</ol>`
      : '<p class="muted">Personne n\'a encore gagné de Prismes : à toi de commencer.</p>'}
  </section>`;
}

/* =====================================================================
   Le Cartle
   ===================================================================== */
const CT_CATS = { joueur: 'Joueur', coach: 'Coach', moment: 'Moment', objet: 'Objet' };
const cartleCartes = () => cards.filter(c => c.cat !== 'essence');

function vCartlePage() {
  return `<div class="pagehead"><div><h1>Cartle</h1>
      <p>La carte du jour, la même pour tout le monde. Sept essais.</p></div></div>
    ${vCartle()}`;
}

function vCartle() {
  if (!cartleData) return '<p class="muted boitecharge">Chargement du Cartle…</p>';
  const d = cartleData;
  const essais = d.essais || [];
  const ligne = r => {
    const c = byId[r.carte];
    if (!c) return '';
    const fl = v => v === '+' ? '↑' : v === '-' ? '↓' : '';
    const cls = v => v === '=' ? 'ok' : v === 'x' ? 'non' : 'pres';
    return `<div class="ct-ligne">
      <button class="ct-carte" data-show="${c.id}">${renderCard(c)}</button>
      <span class="ct-case ${cls(r.cat)}"><small>Type</small>${h(CT_CATS[c.cat] || c.cat)}</span>
      <span class="ct-case ${cls(r.col)}"><small>Essence</small>${h((COLORS[c.col] || COLORS.neutre).nom)}</span>
      <span class="ct-case ${cls(r.rar)}"><small>Rareté</small>${h((RAR[c.rar] || RAR.C).nom)} ${fl(r.rar)}</span>
      <span class="ct-case ${cls(r.num)}"><small>N°</small>#${String(c.num).padStart(3, '0')} ${fl(r.num)}</span>
    </div>`;
  };

  let pied;
  if (d.fini) {
    const k = byId[d.cible];
    pied = `<div class="ct-fin ${d.trouve ? 'gagne' : 'perdu'}">
      ${k ? `<button class="ct-reponse" data-show="${k.id}">${renderCard(k)}</button>` : ''}
      <div><b>${d.trouve ? `Trouvée en ${essais.length} essai${essais.length > 1 ? 's' : ''} !` : 'Pas cette fois.'}</b>
        <p class="muted small">${d.trouve ? '+30 Éclats. ' : ''}${k ? `C'était <b>${h(k.nom)}</b>. ` : ''}Une nouvelle carte demain.</p>
        <button class="btn tiny ghost" data-act="cartle-partager">${NAVICO.partage}Partager</button></div>
    </div>`;
  } else {
    pied = `<div class="ct-saisie">
      <input id="ct-saisie" type="text" placeholder="Tape le nom d'une carte…" autocomplete="off" spellcheck="false"
        value="${h(cartleCherche)}" aria-label="Proposer une carte">
      <div class="ct-sugg" id="ct-sugg">${vCartleSugg()}</div>
    </div>`;
  }

  return `<div class="cartle">
    <div class="ct-tete">
      <span class="ct-essais">${Array.from({ length: d.max }, (_, i) =>
        `<i class="${i < essais.length ? (d.trouve && i === essais.length - 1 ? 'ok' : 'fait') : ''}"></i>`).join('')}</span>
      <small class="muted">${essais.length} / ${d.max} essais</small>
    </div>
    ${pied}
    <div class="ct-lignes">${essais.slice().reverse().map(ligne).join('')}</div>
    ${essais.length ? '' : `<p class="muted small ct-aide">Chaque essai dit si le type, l'essence, la rareté et le numéro
      sont les bons. Pour la rareté et le numéro, une flèche dit si la bonne réponse est plus haut ou plus bas.</p>`}
  </div>`;
}

function vCartleSugg() {
  const q = noacc(cartleCherche).trim();
  if (!q) return '';
  const deja = new Set(((cartleData && cartleData.essais) || []).map(e => e.carte));
  const l = cartleCartes().filter(c => !deja.has(c.id) && noacc(c.nom).includes(q)).slice(0, 7);
  if (!l.length) return '<p class="muted small">Aucune carte de ce nom.</p>';
  return l.map(c => `<button class="ct-prop" data-cartle="${c.id}">
      <span class="ct-mini">${renderCard(c)}</span><b>${h(c.nom)}</b><small>#${String(c.num).padStart(3, '0')}</small></button>`).join('');
}

/* La saisie ne redessine que la liste des suggestions : un rendu complet
   ferait perdre le curseur. */
document.addEventListener('input', e => {
  if (e.target.id !== 'ct-saisie') return;
  cartleCherche = e.target.value;
  const s = $('#ct-sugg');
  if (s) s.innerHTML = vCartleSugg();
});

async function cartleProposer(id) {
  occupe(true);
  try {
    cartleData = await Backend.cartleEssai(id);
    cartleCherche = '';
    const fin = cartleData.fini;
    if (cartleData.trouve) {
      SFX.jouer('gagne');
      if (!RM()) FX.sparkle({ n: 100, colors: ['#55e6a6', '#ffc73b', '#fff'], size: 3.4 });
    } else SFX.jouer(fin ? 'erreur' : 'carte');
    if (tab === 'reflets' && rfData) rfData = await Backend.evenementEtat().catch(() => rfData);
    render();
    const champ = $('#ct-saisie');
    if (champ) champ.focus();
  } catch (e) {
    toast(e.message || 'Cet essai n\'a pas pu être envoyé.');
  } finally {
    occupe(false);
  }
}

/* Le résultat, comme au Wordle : une ligne d'emojis par essai. */
function cartlePartager() {
  const d = cartleData;
  if (!d) return;
  const e = v => v === '=' ? '🟩' : v === 'x' ? '🟥' : v === '+' ? '⬆️' : '⬇️';
  const j = String(d.jour || '').split('-').reverse().slice(0, 2).join('/');
  const texte = `Cartle ${GAME_NAME} — ${j} — ${d.trouve ? d.essais.length : 'X'}/${d.max}\n`
    + d.essais.map(r => [r.cat, r.col, r.rar, r.num].map(e).join('')).join('\n')
    + `\n${String(SITE_URL || '').replace(/^https?:\/\//, '')}`;
  if (navigator.share) navigator.share({ text: texte }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(texte).then(() => toast('Résultat copié.')).catch(() => toast(texte));
  else toast(texte);
}
