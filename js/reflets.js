/* Version 2.0 : l'événement « Reflets » et Devine l'illu.

   L'onglet de l'événement sert deux buts : faire jouer — quêtes, Pass,
   boutique, Devine l'illu — et faire découvrir ce que la 2.0 apporte. Il
   remplace Combats dans la barre du bas tant qu'il dure (js/app.js), et un
   bandeau l'annonce en tête de l'écran Boosters (js/booster.js).

   Un en-tête, et des sous-onglets qui ont chacun leur page : rien ne
   s'empile. Le sous-onglet ouvert vit dans `rfVue`.

   Tout ce qui compte se décide côté serveur (supabase/21_reflets.sql) : le
   solde de Prismes, les paliers, l'illustration du jour — que le navigateur
   ne reçoit qu'en pixels, et ne connaît qu'une fois la partie finie. */
"use strict";

let rfData = null;
let rfErreur = '';
let illuData = null;
let illuCherche = '';
let rfVue = 'accueil';
/* Le Pass se place tout seul sur le palier en cours, une fois par visite. */
let passPlace = false;

const RF_VUES = [
  ['accueil', 'Accueil'],
  ['quetes', 'Quêtes'],
  ['pass', 'Pass'],
  ['illu', 'Devine l\'illu'],
  ['boutique', 'Boutique'],
  ['classement', 'Classement']
];

async function chargerReflets() {
  try {
    const [ev, il] = await Promise.all([Backend.evenementEtat(), Backend.illuEtat()]);
    rfData = ev;
    illuData = il;
    rfErreur = '';
    /* Ouvrir l'onglet accomplit « Passe voir l'événement » côté serveur : on
       relit les quêtes pour l'afficher tout de suite. */
    const visite = (save.quetes || []).find(q => q.metric === 'ev_visite');
    if (visite && !visite.progress) await Backend.pull().catch(() => {});
  } catch (e) {
    rfErreur = e.message || 'L\'événement n\'a pas pu être chargé.';
  }
  if (tab === 'reflets') render();
}

/* Ce qui réclame l'attention, par sous-onglet. */
const rfQuetesPretes = () => (save.quetes || [])
  .filter(x => x.evenement && x.progress >= x.goal && !x.claimed).length;
const rfPaliersPrets = () => rfData ? rfData.piste.filter(x => !x.pris && rfData.total >= x.seuil).length : 0;
const rfIlluAJouer = () => !!(illuData && !illuData.fini);

/* La pastille de l'onglet, dans la barre du bas. */
function evQuetesPretes() {
  if (!evenementEnCours()) return 0;
  return rfQuetesPretes() + rfPaliersPrets() + (rfIlluAJouer() ? 1 : 0);
}

function allerRf(vue) {
  rfVue = RF_VUES.some(v => v[0] === vue) ? vue : 'accueil';
  if (rfVue === 'pass') passPlace = false;
  if (tab !== 'reflets') return aller('reflets');
  render();
  const m = $('#main');
  if (m) m.scrollTo({ top: 0 });
}

/* ---------- L'onglet ---------- */
function vReflets() {
  const ev = save.evenement;
  if (recapReflets()) return vRfRecap();
  if (!ev || evenementEnCours() !== 'reflets') return vide('Pas d\'événement en ce moment', 'Reviens bientôt.');
  if (rfErreur) return vide('Événement indisponible', rfErreur);
  if (!rfData) return '<p class="muted boitecharge">Chargement de l\'événement…</p>';

  const corps = {
    accueil: vRfAccueil, quetes: vRfQuetes, pass: vRfPass, illu: vRfIllu,
    boutique: vRfBoutique, classement: vRfClassement
  }[rfVue] || vRfAccueil;
  return `<div class="rf">${vRfTete(srvTime(ev.fin))}<div class="rf-page">${corps()}</div></div>`;
}

/* L'illustration de La Relève (#117) : le fond de l'en-tête et du bandeau
   de l'écran Boosters. Cadrée sur l'illustration (.rf-fond,
   css/reflets.css), pas sur la carte. */
function rfArt() {
  const c = byId.c117 || cards.find(k => k.img);
  return c && c.img ? `<span class="rf-fond" aria-hidden="true"><i style="background-image:url('${h(c.img)}')"></i></span>` : '';
}

/* L'en-tête : le nom, le compte à rebours, le solde, et les sous-onglets. */
function vRfTete(fin) {
  const pastille = id => {
    const n = id === 'quetes' ? rfQuetesPretes() : id === 'pass' ? rfPaliersPrets() : 0;
    if (n) return `<i class="rf-pastille">${n}</i>`;
    return id === 'illu' && rfIlluAJouer() ? '<i class="rf-point" aria-label="À jouer"></i>' : '';
  };
  return `<header class="rf-tete">
    ${rfArt()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom">
        <small>Événement · Version 2.0</small>
        <h1>Reflets</h1>
      </div>
      <div class="rf-tetechiffres">
        <span class="rf-solde" title="${PRISMES.nom} à dépenser">${prismeIco}<b class="tnum">${fmtN(rfData.solde)}</b></span>
        <span class="rf-fin">${NAVICO.clock}<b data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</b></span>
      </div>
    </div>
    <nav class="rf-onglets" role="tablist">
      ${RF_VUES.map(([id, nom]) => `<button class="${rfVue === id ? 'on' : ''}" data-rfvue="${id}" role="tab"
        aria-selected="${rfVue === id}">${nom}${pastille(id)}</button>`).join('')}
    </nav>
  </header>`;
}

/* Un titre de page, sous l'en-tête. */
const rfTitre = (titre, texte) => `<div class="rf-ptitre"><h2>${titre}</h2>${texte ? `<p>${texte}</p>` : ''}</div>`;

/* =====================================================================
   Accueil : aujourd'hui, et ce que la 2.0 apporte
   ===================================================================== */
function vRfAccueil() {
  const qj = (save.quetes || []).filter(q => q.evenement === 'reflets' && q.scope === 'ev_jour');
  const qFaites = qj.filter(q => q.progress >= q.goal).length;
  const piste = rfData.piste;
  const atteint = piste.filter(x => rfData.total >= x.seuil).length;
  const prochain = piste.find(x => rfData.total < x.seuil);
  const il = illuData;
  const illuTxt = !il ? 'Chargement…'
    : il.fini ? (il.trouve ? `Trouvée en ${il.essais.length} essai${il.essais.length > 1 ? 's' : ''}` : 'Ratée — demain, une autre')
    : il.essais.length ? `${il.max - il.essais.length} essai${il.max - il.essais.length > 1 ? 's' : ''} restant${il.max - il.essais.length > 1 ? 's' : ''}`
    : 'Pas encore jouée';

  const tuile = (vue, ico, titre, valeur, sous, chaud) => `<button class="rf-tuile${chaud ? ' chaud' : ''}" data-rfvue="${vue}">
      <span class="rf-tuileico">${NAVICO[ico]}</span>
      <span class="rf-tuiletxt"><small>${titre}</small><b>${valeur}</b><span>${sous}</span></span>
    </button>`;

  return `<section class="rf-jour">
      <h3 class="rf-sous">Aujourd'hui</h3>
      <div class="rf-tuiles">
        ${tuile('illu', 'illu', 'Devine l\'illu', il && il.fini ? (il.trouve ? 'Trouvée' : 'Terminée') : 'À jouer', h(illuTxt), rfIlluAJouer())}
        ${tuile('quetes', 'quest', 'Quêtes du jour', `${qFaites} / ${qj.length}`,
          rfQuetesPretes() ? `${rfQuetesPretes()} à récupérer` : `Nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}`, rfQuetesPretes() > 0)}
        ${tuile('pass', 'trophy', 'Pass', `Palier ${atteint} / ${piste.length}`,
          rfPaliersPrets() ? `${rfPaliersPrets()} à récupérer` : prochain ? `Suivant dans ${fmtN(prochain.seuil - rfData.total)} ${PRISMES.nom}` : 'Terminé', rfPaliersPrets() > 0)}
      </div>
    </section>
    ${vRfNouveautes()}`;
}

function vRfNouveautes() {
  const rv = reverses.filter(c => c.rar === 'R');
  const exemple = rv.length ? rv[(new Date().getDate()) % rv.length] : null;
  const nb = l => l.filter(c => save.col[c.id] > 0).length;
  const ligne = (cls, visuel, titre, texte, cta) => `<article class="rf-nv ${cls}">
      <div class="rf-nvvisuel">${visuel}</div>
      <div class="rf-nvtexte"><b>${titre}</b><p>${texte}</p>${cta}</div>
    </article>`;

  return `<section class="rf-nouveau">
    <h3 class="rf-sous">Nouveau dans la 2.0</h3>
    ${ligne('grand', exemple ? `<div class="rf-nvcarte">${renderCard(exemple)}</div>` : '',
      'Les Reverses',
      `Une dans chaque booster, frappée du logo <i>Tout Commence Ici</i>. ${reverses.length} à trouver — tu en as <b>${nb(reverses)}</b>.`,
      '<button class="btn tiny" data-colvue="reverses" data-tab="collection">Mes Reverses</button>')}
    <div class="rf-nvgrille">
      ${ligne('', `<div class="rf-nvillu" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>`,
        'Devine l\'illu',
        'Une illustration pixelisée par jour. Quatre essais.',
        '<button class="btn tiny ghost" data-rfvue="illu">Jouer</button>')}
      ${ligne('', `<div class="rf-nvava">${avatarHTML(save.avatar, 'f_miroir', 'xl', maPhoto())}</div>`,
        'Cadres et titres',
        'De nouveaux cadres à gagner, et un titre sous ton pseudo.',
        '<button class="btn tiny ghost" data-tab="profil">Mon profil</button>')}
      ${ligne('', `<div class="rf-nvjauge"><b class="tnum">3</b><small>vues</small></div>`,
        'La Collection',
        'Classiques, Reverses et Spéciales, chacune sa page.',
        '<button class="btn tiny ghost" data-tab="collection">Ouvrir</button>')}
      ${save.filleul ? '' : ligne('', `<div class="rf-nvinvit">M8-<b>••••</b></div>`,
        'Les invitations',
        'Fais entrer un ami, avec un cadeau de bienvenue.',
        '<button class="btn tiny ghost" data-tab="boutique">Boutique</button>')}
    </div>
  </section>`;
}

/* =====================================================================
   Quêtes
   ===================================================================== */
function vRfQuetes() {
  const qs = (save.quetes || []).filter(q => q.evenement === 'reflets');
  const jour = qs.filter(q => q.scope === 'ev_jour');
  const ev = qs.filter(q => q.scope === 'ev');
  return `${rfTitre('Quêtes', `Elles paient en ${PRISMES.nom}, et chaque ${PRISMES.un} gagné fait avancer le Pass.`)}
    <h3 class="rf-sous">Du jour <small>· nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}</small></h3>
    ${vListeQuetes(jour)}
    <h3 class="rf-sous">De l'événement</h3>
    ${vListeQuetes(ev)}`;
}

/* =====================================================================
   Le Pass
   ===================================================================== */
const RF_TYPE_ICO = { boosters: 'star', eclats: null, fragments: 'fragment', titre: 'user', cadre: 'user',
  reverse_R: 'reflets', brillante: 'promo' };

/* L'icône d'une récompense : sur le Pass, et dans la fenêtre du gain. */
function rfIco(x, taille) {
  return x.type === 'eclats' ? shardIco
    : x.type === 'cadre' ? avatarHTML(save.avatar, x.objet, taille || 'sm', maPhoto())
    : x.type === 'titre' ? `<i class="rf-titrebadge">${NAVICO.user}</i>`
    : NAVICO[RF_TYPE_ICO[x.type] || 'star'];
}

function vRfPass() {
  const total = rfData.total;
  const piste = rfData.piste;
  const atteint = piste.filter(x => total >= x.seuil).length;
  const prochain = piste.find(x => total < x.seuil);
  const avant = prochain ? (piste[prochain.palier - 2] || { seuil: 0 }).seuil : 0;
  const pct = prochain ? Math.round((total - avant) / (prochain.seuil - avant) * 100) : 100;
  const prets = rfPaliersPrets();

  const ligne = x => {
    const ok = total >= x.seuil;
    const etat = x.pris ? 'pris' : ok ? 'pret' : x === prochain ? 'prochain' : 'loin';
    return `<li class="rf-pal ${etat}${x.type === 'cadre' || x.type === 'titre' || x.palier === piste.length ? ' rare' : ''}" id="pal-${x.palier}">
      <span class="rf-palnum tnum">${x.pris ? NAVICO.check : x.palier}</span>
      <div class="rf-palcarte">
        <span class="rf-palico">${rfIco(x)}</span>
        <span class="rf-paltxt"><b>${h(x.titre)}</b><small>${prismeIco}<span class="tnum">${fmtN(x.seuil)}</span></small></span>
        ${x.pris ? '<span class="rf-paletat">Récupéré</span>'
          : ok ? `<button class="btn tiny" data-palier="${x.palier}" data-snd="piece">Récupérer</button>`
          : x === prochain ? `<span class="rf-paletat">encore ${fmtN(x.seuil - total)}</span>` : ''}
      </div>
    </li>`;
  };

  return `<section class="rf-passtete">
      <div class="rf-passniv">
        <small>Palier</small>
        <b class="tnum">${atteint}<span>/${piste.length}</span></b>
      </div>
      <div class="rf-passjauge">
        <div class="rf-passchiffres">
          <span><b class="tnum">${fmtN(total)}</b> ${PRISMES.nom} gagnés</span>
          <small>${prochain ? `encore <b class="tnum">${fmtN(prochain.seuil - total)}</b>` : 'Pass terminé'}</small>
        </div>
        <div class="rf-jauge"><i style="width:${pct}%"></i></div>
        <small class="muted">Dépenser en boutique ne fait pas reculer le Pass.</small>
      </div>
    </section>
    ${prets > 1 ? `<button class="btn rf-tout" data-act="pass-tout" data-snd="piece">${NAVICO.check}Tout récupérer · ${prets} paliers</button>` : ''}
    <ol class="rf-pass" style="--fait:${atteint}">${piste.map(ligne).join('')}</ol>`;
}

/* À l'ouverture du Pass : le premier palier à récupérer, ou le suivant, au
   milieu de l'écran. Appelé après le rendu (js/app.js). */
function placerPass() {
  if (tab !== 'reflets' || rfVue !== 'pass' || passPlace || !rfData) return;
  passPlace = true;
  const x = rfData.piste.find(p => !p.pris && rfData.total >= p.seuil) || rfData.piste.find(p => rfData.total < p.seuil);
  const el = x && document.getElementById('pal-' + x.palier);
  if (el && x.palier > 3) el.scrollIntoView({ block: 'center' });
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

/* Tous les paliers atteints d'un coup, puis une seule fenêtre. */
async function reclamerTout() {
  const l = rfData ? rfData.piste.filter(p => !p.pris && rfData.total >= p.seuil) : [];
  if (!l.length) return;
  occupe(true);
  const pris = [];
  let cartes = [];
  try {
    for (const x of l) {
      const c = await Backend.pisteReclamer(x.palier);
      pris.push(x);
      cartes = cartes.concat(c || []);
    }
  } catch (e) {
    toast(e.message || 'Un palier n\'a pas pu être récupéré.');
  }
  try { rfData = await Backend.evenementEtat(); } catch (e) { /* le rendu gardera l'ancien */ }
  occupe(false);
  if (!pris.length) return render();
  SFX.jouer('gagne');
  if (!RM()) FX.sparkle({ n: 120, colors: ['#ff7cc8', '#b38cff', '#7fd8ff', '#fff'], size: 3.4 });
  const ks = cartes.map(id => byId[id]).filter(Boolean);
  const boosters = pris.some(x => x.type === 'boosters');
  openSheet({
    title: `${pris.length} paliers récupérés`,
    body: `<div class="rf-gain">
        ${ks.length ? `<div class="rf-gaincartes">${ks.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>` : ''}
        <ul class="rf-gainliste">${pris.map(x => `<li><span class="rf-palico">${rfIco(x)}</span>${h(x.titre)}</li>`).join('')}</ul>
      </div>`,
    actions: boosters
      ? [{ label: 'Ouvrir mes boosters', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
         { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
      : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
  });
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

/* =====================================================================
   La boutique de l'événement
   ===================================================================== */
function vRfBoutique() {
  const items = (Backend.shop || []).filter(it => it.evenement === 'reflets');
  const article = it => {
    const deja = (save.inv || {})[it.id] || 0;
    const fini = it.unique_buy ? deja > 0 : it.limite != null && deja >= it.limite;
    const reste = it.limite != null && !it.unique_buy ? `${it.limite - deja} / ${it.limite}` : it.unique_buy ? 'Exclusif' : '';
    const visuel = FRAMES[it.id] ? avatarHTML(save.avatar, it.id, 'xl', maPhoto())
      : TITRES[it.id] ? `<span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span>`
      : it.effet === 'reverse_R' ? NAVICO.reflets : it.effet === 'fragments' ? NAVICO.fragment : NAVICO.star;
    return `<article class="rf-art${fini ? ' fini' : ''}">
      <div class="rf-artvis">${visuel}</div>
      <b>${h(it.titre)}</b>
      <small>${h(it.detail)}</small>
      ${reste ? `<span class="rf-artreste">${fini && !it.unique_buy ? 'Épuisé' : reste}</span>` : ''}
      ${fini ? '<span class="qtag">Acquis</span>'
        : `<button class="btn tiny" data-shop="${h(it.id)}" ${rfData.solde < it.prix ? 'disabled' : ''}>${prismeIco}${fmtN(it.prix)}</button>`}
    </article>`;
  };
  return `${rfTitre('Boutique', `En ${PRISMES.nom}, seulement pendant l'événement. Ton solde : ${prismeIco}<b class="tnum">${fmtN(rfData.solde)}</b>`)}
    ${items.length ? `<div class="rf-arts">${items.map(article).join('')}</div>` : '<p class="muted">Chargement de la boutique…</p>'}`;
}

/* =====================================================================
   Le classement
   ===================================================================== */
function vRfClassement() {
  const top = rfData.top || [];
  return `${rfTitre('Classement', `Ceux qui ont gagné le plus de ${PRISMES.nom} depuis le début de l'événement.`)}
    ${top.length ? `<ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.titre && TITRES[j.titre] ? `<small class="titreligne t${TITRES[j.titre].ton}">${h(TITRES[j.titre].nom)}</small>` : ''}</span>
        <span class="rf-pts tnum">${prismeIco}${fmtN(j.total)}</span></li>`).join('')}</ol>`
      : '<p class="muted">Personne n\'a encore gagné de Prismes : à toi de commencer.</p>'}`;
}

/* =====================================================================
   Devine l'illu
   ===================================================================== */
const illuCartes = () => cards.filter(c => c.cat !== 'essence');

/* La grille reçue du serveur, en image : un canevas aux dimensions de la
   grille, agrandi sans lissage par le CSS. */
let illuImg = { cle: '', url: '' };
function illuImage(g) {
  if (!g) return '';
  const cle = g.w + 'x' + g.h + g.data.slice(0, 40);
  if (illuImg.cle === cle) return illuImg.url;
  const o = Uint8Array.from(atob(g.data), c => c.charCodeAt(0));
  const cv = document.createElement('canvas');
  cv.width = g.w; cv.height = g.h;
  const x = cv.getContext('2d');
  const im = x.createImageData(g.w, g.h);
  for (let i = 0; i < g.w * g.h; i++) {
    im.data[i * 4] = o[i * 3]; im.data[i * 4 + 1] = o[i * 3 + 1]; im.data[i * 4 + 2] = o[i * 3 + 2]; im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  illuImg = { cle, url: cv.toDataURL() };
  return illuImg.url;
}

/* Le niveau affiché au dernier rendu : quand il monte, l'image se précise
   avec une petite animation. */
let illuNiveauVu = 0;

function vRfIllu() {
  return `${rfTitre('Devine l\'illu', 'Une illustration de l\'extension se cache derrière ces pixels. Quatre essais : à chaque erreur, elle se précise.')}
    ${vIllu()}`;
}

function vIllu() {
  const d = illuData;
  if (!d) return '<p class="muted boitecharge">Chargement de l\'illustration…</p>';
  const essais = d.essais || [];
  const gains = d.gains || [];
  const nouveau = d.niveau > illuNiveauVu && illuNiveauVu > 0;
  illuNiveauVu = d.niveau;

  const marches = gains.map((g, i) => {
    const etat = d.fini ? (d.trouve && i === essais.length - 1 ? 'ok' : i < essais.length ? 'rate' : 'vide')
      : i < essais.length ? 'rate' : i === essais.length ? 'cours' : 'vide';
    return `<li class="${etat}"><span>${i + 1}<sup>${i ? 'e' : 'er'}</sup> essai</span>
      ${d.prismes ? `<b>${prismeIco}${g.prismes}</b><small>${shardIco}${g.eclats}</small>` : `<b>${shardIco}${g.eclats}</b>`}</li>`;
  }).join('');

  let haut, bas;
  if (d.fini) {
    const k = byId[d.cible];
    haut = `<div class="il-cadre fini">${k && k.img ? `<div class="il-art" style="background-image:url('${h(k.img)}')"></div>` : ''}</div>`;
    bas = `<div class="il-fin ${d.trouve ? 'gagne' : 'perdu'}">
      ${k ? `<button class="il-carte" data-show="${k.id}">${renderCard(k)}</button>` : ''}
      <div>
        <b>${d.trouve ? `Trouvée au ${essais.length}${essais.length > 1 ? 'e' : 'er'} essai !` : 'Pas cette fois.'}</b>
        <p>${k ? `C'était <b>${h(k.nom)}</b>.` : ''}</p>
        ${d.trouve && d.gain ? `<p class="il-gain">${d.prismes ? `${prismeIco}<b>+${d.gain.prismes}</b> ${PRISMES.nom} · ` : ''}${shardIco}<b>+${d.gain.eclats}</b> Éclats</p>` : ''}
        <p class="muted small">Nouvelle illustration dans ${h(dureeCourte(resteAvantRemise('daily')))}.</p>
        <button class="btn tiny ghost" data-act="illu-partager">${NAVICO.partage}Partager</button>
      </div>
    </div>`;
  } else {
    haut = `<div class="il-cadre"><img class="il-pix${nouveau ? ' net' : ''}" src="${illuImage(d.grille)}" alt="Illustration pixelisée"></div>`;
    bas = `<div class="il-saisie">
      <input id="il-saisie" type="text" placeholder="Le nom de la carte…" autocomplete="off" spellcheck="false"
        value="${h(illuCherche)}" aria-label="Proposer une carte">
      <div class="il-sugg" id="il-sugg">${vIlluSugg()}</div>
    </div>`;
  }

  /* Les cartes déjà proposées ne s'affichent pas : la page ne dit rien de
     plus que l'image. */
  return `<div class="illu">
    ${haut}
    <ol class="il-marches">${marches}</ol>
    ${bas}
  </div>`;
}

function vIlluSugg() {
  const q = noacc(illuCherche).trim();
  if (!q) return '';
  const deja = new Set((illuData && illuData.essais) || []);
  const l = illuCartes().filter(c => !deja.has(c.id) && noacc(c.nom).includes(q)).slice(0, 6);
  if (!l.length) return '<p class="muted small">Aucune carte de ce nom.</p>';
  return l.map(c => `<button class="il-prop" data-illu="${c.id}"><b>${h(c.nom)}</b><small>#${String(c.num).padStart(3, '0')}</small></button>`).join('');
}

/* La saisie ne redessine que la liste des suggestions : un rendu complet
   ferait perdre le curseur. */
document.addEventListener('input', e => {
  if (e.target.id !== 'il-saisie') return;
  illuCherche = e.target.value;
  const s = $('#il-sugg');
  if (s) s.innerHTML = vIlluSugg();
});

async function illuProposer(id) {
  occupe(true);
  try {
    illuData = await Backend.illuEssai(id);
    illuCherche = '';
    if (illuData.trouve) {
      SFX.jouer('gagne');
      if (!RM()) FX.sparkle({ n: 110, colors: ['#55e6a6', '#ff7cc8', '#b38cff', '#fff'], size: 3.4 });
    } else SFX.jouer(illuData.fini ? 'erreur' : 'carte');
    try { rfData = await Backend.evenementEtat(); } catch (e) { /* l'ancien suffit */ }
    render();
    if (!illuData.fini) { const champ = $('#il-saisie'); if (champ) champ.focus(); }
  } catch (e) {
    toast(e.message || 'Cet essai n\'a pas pu être envoyé.');
  } finally {
    occupe(false);
  }
}

/* Le résultat, sans la réponse : une case par essai. */
function illuPartager() {
  const d = illuData;
  if (!d) return;
  const j = String(d.jour || '').split('-').reverse().slice(0, 2).join('/');
  const cases = Array.from({ length: d.max }, (_, i) =>
    i < d.essais.length ? (d.trouve && i === d.essais.length - 1 ? '🟩' : '🟥') : '⬛').join('');
  const texte = `Devine l'illu — ${GAME_NAME} — ${j} — ${d.trouve ? d.essais.length : 'X'}/${d.max}\n${cases}\n`
    + String(SITE_URL || '').replace(/^https?:\/\//, '');
  if (navigator.share) navigator.share({ text: texte }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(texte).then(() => toast('Résultat copié.')).catch(() => toast(texte));
  else toast(texte);
}

/* =====================================================================
   Devine l'illu, après l'événement : son propre onglet
   ===================================================================== */
async function chargerIllu() {
  try { illuData = await Backend.illuEtat(); } catch (e) { /* l'écran le dira */ }
  if (tab === 'illu' || tab === 'reflets') render();
}

function vIlluPage() {
  return `<div class="pagehead"><div><h1>Devine l'illu</h1>
      <p>Une illustration de l'extension par jour, la même pour tout le monde. Quatre essais : à chaque erreur, elle se précise.</p></div></div>
    ${vIllu()}`;
}

/* =====================================================================
   Après l'événement : le récap (trois jours)
   ===================================================================== */
/* L'événement fini depuis moins de trois jours (me(), supabase/21_reflets.sql),
   ou l'aperçu du Labo. */
let rfRecap = null;
let rfRecapApercu = null;
const recapReflets = () => rfRecapApercu
  || (save && save.recap && save.recap.code === 'reflets' && !evenementEnCours() ? save.recap : null);

async function chargerRecap() {
  if (rfRecapApercu) { rfRecap = rfRecapApercu; return rfRecap; }
  try { rfRecap = await Backend.rpc('evenement_recap'); } catch (e) { rfRecap = null; }
  if (tab === 'reflets') render();
  return rfRecap;
}

/* L'aperçu du Labo : des chiffres plausibles, et rien d'enregistré. */
function apercuRecap() {
  const t = Date.now();
  const bots = [['Nova.92', 't_elu', 1130], ['Lumen', 't_centurion', 1064], ['Mira', null, 980]];
  rfRecapApercu = {
    code: 'reflets', titre: 'Reflets', debut: new Date(t - 14 * 86400000).toISOString(), fin: new Date(t - 3600000).toISOString(),
    jusqua: new Date(t + 3 * 86400000 - 3600000).toISOString(), apercu: true,
    total: 870, paliers: 16, paliers_max: 20, pris: 16, illus: 9, reverses: 52, reverses_max: reverses.length || 85,
    quetes: 41, rang: 5, joueurs: 37,
    top: bots.map(([pseudo, titre, total]) => ({ pseudo, titre, total, avatar: 'star', frame: 'f_prisme', photo: null, moi: false }))
  };
  rfRecap = rfRecapApercu;
}
function quitterApercuRecap() { rfRecapApercu = null; rfRecap = null; aller('labo'); }

function vRfRecap() {
  const r = rfRecap;
  const a = recapReflets();
  const reste = a && a.jusqua ? srvTime(a.jusqua) : 0;
  const tete = `<header class="rf-tete rf-recap">
    ${rfArt()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom"><small>Événement terminé · le récap</small><h1>Reflets</h1></div>
      <div class="rf-tetechiffres">
        ${reste ? `<span class="rf-fin">${NAVICO.clock}<span>encore <b data-rebours="${reste}">${h(dureeCourte(reste - Date.now()))}</b></span></span>` : ''}
      </div>
    </div>
    ${r && r.apercu ? '<button class="btn tiny ghost rf-quitter" data-act="recap-quitter">Quitter l\'aperçu</button>' : ''}
  </header>`;
  if (!r) { chargerRecap(); return `<div class="rf">${tete}<p class="muted boitecharge">Chargement du récap…</p></div>`; }

  const stat = (ico, val, lib, sous) => `<div class="rr-stat"><span class="rr-ico">${ico}</span>
    <b class="tnum">${val}</b><span>${lib}</span>${sous ? `<small>${sous}</small>` : ''}</div>`;
  const pct = r.reverses_max ? Math.round(r.reverses / r.reverses_max * 100) : 0;
  const podium = (r.top || []).map((j, i) => `<li class="p${i + 1}${j.moi ? ' moi' : ''}">
      <span class="rr-place">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'lg', j.photo)}
      <b>${h(j.pseudo)}</b><small>${prismeIco}${fmtN(j.total)}</small></li>`).join('');

  return `<div class="rf">${tete}<div class="rf-page">
    <section class="rr-bilan">
      <h2>Ton bilan</h2>
      <div class="rr-stats">
        ${stat(prismeIco, fmtN(r.total), PRISMES.nom + ' gagnés', r.rang ? `${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup> sur ${r.joueurs}` : '')}
        ${stat(NAVICO.trophy, `${r.paliers}<small>/${r.paliers_max}</small>`, 'paliers du Pass', r.paliers >= r.paliers_max ? 'Pass terminé' : '')}
        ${stat(NAVICO.reflets, `${r.reverses}<small>/${r.reverses_max}</small>`, 'Reverses', `${pct} % de la série`)}
        ${stat(NAVICO.illu, r.illus, 'illus trouvées', '')}
        ${stat(NAVICO.quest, r.quetes, 'quêtes accomplies', '')}
      </div>
    </section>
    ${podium ? `<section class="rr-podium"><h2>Le podium</h2><ol>${podium}</ol></section>` : ''}
    <section class="rr-continue">
      <h2>Ce qui reste</h2>
      <div class="rr-cartes">
        <button class="rr-lien" data-tab="illu"><span class="rr-ico">${NAVICO.illu}</span><b>Devine l'illu continue</b><small>Une illustration par jour, dans son propre onglet.</small></button>
        <button class="rr-lien" data-colvue="reverses" data-tab="collection"><span class="rr-ico">${NAVICO.reflets}</span><b>Les Reverses restent</b><small>Toujours une par booster.</small></button>
      </div>
    </section>
    <section class="rr-suite">
      <h2>À suivre</h2>
      <article class="rr-teaser combats">
        <span class="rr-tico">${NAVICO.sword}</span>
        <div><small>Version 3.0</small><b>Les Combats</b><p>Tes cartes vont bientôt quitter le classeur. Prépare ton deck.</p></div>
      </article>
      <article class="rr-teaser secrets">
        <span class="rr-secrets" aria-hidden="true"><i></i><i></i><i></i></span>
        <div><small>Bientôt</small><b>Les Secrets</b><p>Des cartes que personne n'a encore vues. Elles se cachent déjà au bout de ta Collection.</p></div>
      </article>
    </section>
  </div></div>`;
}

/* Le bandeau de l'écran Boosters, en version récap. */
function vBandeauRecap() {
  const a = recapReflets();
  return `<button class="rfban rf-recap" data-tab="reflets" aria-label="Voir le récap de l'événement Reflets">
    ${rfArt()}
    <span class="rfban-txt"><small>Terminé · le récap</small><b>Reflets</b></span>
    <span class="rfban-solde">Ton bilan</span>
    <span class="rfban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* La fenêtre de fin d'événement : une fois, au premier passage après la fin. */
function recapAVoir() {
  const a = save && save.recap;
  return !!(a && a.code === 'reflets' && !evenementEnCours() && accueilMemoire().recap !== a.fin);
}
async function montrerRecap() {
  const a = recapReflets();
  if (a && !a.apercu) accueilNoter({ recap: a.fin });
  const r = rfRecapApercu || await chargerRecap();
  if (!r) return;
  openSheet({
    title: 'Reflets, c\'est fini',
    body: `<div class="rr-pop">
        <div class="rr-poptete">${rfArt()}<b>Merci d'avoir joué</b><small>Deux semaines de reflets — voici les tiens.</small></div>
        <div class="rr-popstats">
          <div><b class="tnum">${fmtN(r.total)}</b><small>${PRISMES.nom}</small></div>
          <div><b class="tnum">${r.paliers}/${r.paliers_max}</b><small>Pass</small></div>
          <div><b class="tnum">${r.reverses}</b><small>Reverses</small></div>
          ${r.rang ? `<div><b class="tnum">${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup></b><small>sur ${r.joueurs}</small></div>` : ''}
        </div>
        <p class="muted small">Le récap complet reste trois jours dans l'onglet de l'événement. Devine l'illu, lui, continue.</p>
      </div>`,
    actions: [{ label: 'Voir le récap', primary: true, fn: () => { closeSheet(); aller('reflets'); } },
              { label: 'Plus tard', fn: closeSheet }]
  });
}
