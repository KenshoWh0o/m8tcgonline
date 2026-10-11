/* Version 3.0 : l'événement « Le Choc des Sections ».

   Comme l'onglet de Reflets (js/reflets.js) : un en-tête, et des
   sous-onglets qui ont chacun leur page. Le Raid et l'Épreuve du jour se
   jouent dans l'arène des Combats (js/combat/table.js), lancés par
   demarrer() (js/battle.js) ; les règles et les chiffres de l'événement sont
   dans js/combat/choc-data.js.

   Ce qui compte se décide côté serveur (supabase/25_choc.sql) : la barre
   commune du Raid, les tentatives du jour, la graine de l'Épreuve, les
   Insignes. */
"use strict";

/* evenement_etat (le solde, le Pass, le classement des Insignes) et
   choc_etat (le Raid, l'Épreuve, la Guerre de l'événement). */
let chEv = null;
let chEtat = null;
let chErreur = '';
let chVue = 'accueil';
let chPassPlace = false;
let chClassement = 'raid';

const CH_VUES = [
  ['accueil', 'Accueil'],
  ['raid', 'Raid'],
  ['epreuve', 'Épreuve'],
  ['quetes', 'Quêtes'],
  ['pass', 'Pass'],
  ['boutique', 'Boutique'],
  ['classement', 'Classement']
];

async function chargerChoc() {
  try {
    const [ev, ch] = await Promise.all([Backend.evenementEtat(), Backend.chocEtat()]);
    chEv = ev;
    chEtat = ch;
    chErreur = '';
    const visite = (save.quetes || []).find(q => q.metric === 'ev_visite');
    if (visite && !visite.progress) await Backend.pull().catch(() => {});
  } catch (e) {
    chErreur = e.message || 'L\'événement n\'a pas pu être chargé.';
  }
  if (tab === 'choc' && !ecranOccupe()) render();
}

/* ---------- Ce qui attend ---------- */
const chQuetesPretes = () => (save.quetes || [])
  .filter(x => x.evenement === 'choc' && x.progress >= x.goal && !x.claimed).length;
const chPaliersPrets = () => chEv ? chEv.piste.filter(x => !x.pris && chEv.total >= x.seuil).length : 0;
/* Les récompenses de phase du Raid qu'on peut réclamer. */
function chPhasesPretes() {
  const r = chEtat && chEtat.raid;
  if (!r || (r.moi.degats || 0) < CHOC.raid.minimum) return 0;
  return r.phases.filter(p => p.tombee && !r.prises.includes(p.n)).length;
}
const chTentativesRestantes = () => (chEtat ? Math.max(0, chEtat.raid.moi.max - chEtat.raid.moi.tentatives) : 0);
const chEpreuveAJouer = () => !!(chEtat && chEtat.epreuve.essais.length < chEtat.epreuve.max);

/* La pastille de l'onglet, dans le tiroir et le rail. */
function chocPastille() {
  if (evenementEnCours() !== 'choc') return 0;
  return chQuetesPretes() + chPaliersPrets() + chPhasesPretes();
}

function allerCh(vue) {
  chVue = CH_VUES.some(v => v[0] === vue) ? vue : 'accueil';
  if (chVue === 'pass') chPassPlace = false;
  if (tab !== 'choc') return aller('choc');
  render();
  const m = $('#main');
  if (m) m.scrollTo({ top: 0 });
}

/* ---------- L'onglet ---------- */
function vChoc() {
  if (recapChoc()) return vChRecap();
  const ev = save.evenement;
  if (!ev || evenementEnCours() !== 'choc') return vide('Pas d\'événement en ce moment', 'Reviens bientôt.');
  if (Backend.mode !== 'cloud') return horsLigne('L\'événement');
  if (chErreur) return vide('Événement indisponible', chErreur);
  if (!chEv || !chEtat) return '<p class="muted boitecharge">Chargement de l\'événement…</p>';
  const corps = {
    accueil: vChAccueil, raid: vChRaid, epreuve: vChEpreuve, quetes: vChQuetes,
    pass: vChPass, boutique: vChBoutique, classement: vChClassement
  }[chVue] || vChAccueil;
  return `<div class="rf ch">${vChTete(srvTime(ev.fin))}<div class="rf-page">${corps()}</div></div>`;
}

/* L'illustration du Marionnettiste (#121), en fond de l'en-tête et des
   bandeaux, cadrée sur son visage. */
function chArt() {
  const c = byId[CHOC.raid.boss];
  return c && c.img ? `<span class="rf-fond ch-fond" aria-hidden="true"><i style="background-image:url('${h(c.img)}')"></i></span>` : '';
}

function vChTete(fin) {
  const pastille = id => {
    const n = id === 'quetes' ? chQuetesPretes() : id === 'pass' ? chPaliersPrets() : id === 'raid' ? chPhasesPretes() : 0;
    if (n) return `<i class="rf-pastille">${n}</i>`;
    if (id === 'raid' && chTentativesRestantes()) return '<i class="rf-point" aria-label="Tentatives disponibles"></i>';
    return id === 'epreuve' && chEpreuveAJouer() ? '<i class="rf-point" aria-label="À jouer"></i>' : '';
  };
  return `<header class="rf-tete ch-tete">
    ${chArt()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom">
        <small>Événement · Version 3.0</small>
        <h1>Le Choc<span>des Sections</span></h1>
      </div>
      <div class="rf-tetechiffres">
        <span class="rf-solde" title="${CHOC.monnaie.nom} à dépenser">${insigneIco}<b class="tnum">${fmtN(chEv.solde)}</b></span>
        <span class="rf-fin">${NAVICO.clock}<b data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</b></span>
      </div>
    </div>
    <nav class="rf-onglets" role="tablist">
      ${CH_VUES.map(([id, nom]) => `<button class="${chVue === id ? 'on' : ''}" data-ch="vue" data-v="${id}" role="tab"
        aria-selected="${chVue === id}">${nom}${pastille(id)}</button>`).join('')}
    </nav>
  </header>`;
}

const chTitre = (titre, texte) => `<div class="rf-ptitre"><h2>${titre}</h2>${texte ? `<p>${texte}</p>` : ''}</div>`;

/* La barre de vie commune du Marionnettiste. */
function vChBarre(r, grand) {
  const p = chocPhase(r.phase);
  const rappel = r.phase > CHOC.raid.phases.length;
  const reste = rappel ? 1 : Math.max(0, 1 - r.degats / r.pv);
  return `<div class="ch-barre${grand ? ' grand' : ''}${rappel ? ' rappel' : ''}">
    <div class="ch-barre-tete"><b>${rappel ? 'Le rappel' : `Phase ${r.phase}/${CHOC.raid.phases.length}`} · ${h(p.nom)}</b>
      <span class="tnum">${rappel ? `${fmtN(r.degats)} dégâts` : `${fmtN(Math.max(0, r.pv - r.degats))} / ${fmtN(r.pv)} PV`}</span></div>
    <div class="ch-pv"><i style="width:${Math.round(reste * 1000) / 10}%"></i>${rappel ? '' : CHOC.raid.phases.map((x, i) => i ? `<em style="left:${i * 20}%"></em>` : '').join('')}</div>
  </div>`;
}

/* =====================================================================
   Accueil
   ===================================================================== */
function vChAccueil() {
  const r = chEtat.raid;
  const ep = chEtat.epreuve;
  const qj = (save.quetes || []).filter(q => q.evenement === 'choc' && q.scope === 'ev_jour');
  const qFaites = qj.filter(q => q.progress >= q.goal).length;
  const piste = chEv.piste;
  const atteint = piste.filter(x => chEv.total >= x.seuil).length;
  const prochain = piste.find(x => chEv.total < x.seuil);
  const regle = epreuveRegle();
  const tuile = (vue, ico, titre, valeur, sous, chaud) => `<button class="rf-tuile${chaud ? ' chaud' : ''}" data-ch="vue" data-v="${vue}">
      <span class="rf-tuileico">${NAVICO[ico]}</span>
      <span class="rf-tuiletxt"><small>${titre}</small><b>${valeur}</b><span>${sous}</span></span>
    </button>`;
  const tr = chTentativesRestantes();
  const er = ep.max - ep.essais.length;
  return `<button class="ch-hero" data-ch="vue" data-v="raid">
      <span class="ch-hero-carte">${renderCard(byId[CHOC.raid.boss] || {})}</span>
      <span class="ch-hero-txt"><small>Raid communautaire</small><b>${h(CHOC.raid.nom)}</b>
        <em>${r.joueurs} joueur${r.joueurs > 1 ? 's' : ''} l'ont déjà frappé. À toi.</em>
        ${vChBarre(r)}</span>
    </button>
    <section class="rf-jour">
      <h3 class="rf-sous">Aujourd'hui</h3>
      <div class="rf-tuiles ch-tuiles">
        ${tuile('raid', 'fils', 'Raid', `${tr} / ${r.moi.max}`, tr ? `tentative${tr > 1 ? 's' : ''} restante${tr > 1 ? 's' : ''}` : 'Reviens demain', tr > 0)}
        ${tuile('epreuve', 'epreuve', 'Épreuve du jour', ep.gagnee ? 'Gagnée' : er ? `${er} essai${er > 1 ? 's' : ''}` : 'Terminée', h(regle.nom), er > 0 && !ep.gagnee)}
        ${tuile('quetes', 'quest', 'Quêtes du jour', `${qFaites} / ${qj.length}`,
          chQuetesPretes() ? `${chQuetesPretes()} à récupérer` : `Nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}`, chQuetesPretes() > 0)}
        ${tuile('pass', 'trophy', 'Pass', `Palier ${atteint} / ${piste.length}`,
          chPaliersPrets() ? `${chPaliersPrets()} à récupérer` : prochain ? `Suivant dans ${fmtN(prochain.seuil - chEv.total)}` : 'Terminé', chPaliersPrets() > 0)}
      </div>
    </section>
    ${vChGuerre()}
    <section class="rf-nouveau">
      <h3 class="rf-sous">Au programme</h3>
      <div class="rf-nvgrille">
        <article class="rf-nv"><div class="rf-nvvisuel ch-nvico">${NAVICO.fils}</div><div class="rf-nvtexte"><b>Le Raid</b>
          <p>Un boss pour tout le serveur. Chaque PV que tu lui prends entame sa barre commune ; chaque phase tombée ouvre une récompense à ceux qui l'ont frappé.</p></div></article>
        <article class="rf-nv"><div class="rf-nvvisuel ch-nvico">${NAVICO.epreuve}</div><div class="rf-nvtexte"><b>L'Épreuve du jour</b>
          <p>Le même combat pour tout le monde : mêmes decks, même donne. Gagne en le moins de tours possible.</p></div></article>
        <article class="rf-nv"><div class="rf-nvvisuel ch-nvico">${NAVICO.choc}</div><div class="rf-nvtexte"><b>Points doublés</b>
          <p>Chaque point de Section compte double. La Section qui en marque le plus gagne le titre « Vainqueur du Choc ».</p></div></article>
        <article class="rf-nv"><div class="rf-nvvisuel ch-nvico">${insigneIco}</div><div class="rf-nvtexte"><b>${CHOC.monnaie.nom}</b>
          <p>Quêtes, Raid et Épreuve en rapportent. Elles font monter le Pass — trente paliers — et se dépensent dans la boutique.</p></div></article>
      </div>
    </section>`;
}

/* La Guerre des Sections, sur tout l'événement. */
function vChGuerre() {
  const g = chEtat.guerre || { toxique: 0, deter: 0, moi: 0 };
  const t = g.toxique || 0, d = g.deter || 0, tot = t + d;
  const pt = tot ? Math.round(100 * t / tot) : 50;
  const sec = cbEtat().section;
  return `<section class="cb-guerre ch-guerre">
    <div class="cb-guerre-tete"><b>La Guerre du Choc</b><small>points ×${CHOC.guerre.multiplicateur} · jusqu'à la fin</small></div>
    <div class="cb-guerre-barre" style="--pt:${pt}%">
      <span class="t">${emblemeSection('toxique')}<b class="tnum">${fmtN(t)}</b></span>
      <span class="d"><b class="tnum">${fmtN(d)}</b>${emblemeSection('deter')}</span>
    </div>
    <p class="muted small">${sec ? `Pour la ${h(SECTIONS[sec].nom)}, tu as marqué <b>${fmtN(g.moi || 0)} point${(g.moi || 0) > 1 ? 's' : ''}</b>.` : 'Rejoins une Section dans Combats pour marquer des points.'}
      À la fin, chaque membre de la Section gagnante qui a marqué reçoit le titre « ${h(TITRES[CHOC.guerre.titre].nom)} ».</p>
  </section>`;
}

/* =====================================================================
   Le Raid
   ===================================================================== */
function vChRaid() {
  const r = chEtat.raid;
  const p = chocPhase(r.phase);
  const couleurs = CHOC_PAIRES[chocMod(chocJourN(chEtat.jour), CHOC_PAIRES.length)];
  const tr = chTentativesRestantes();
  const k = byId[CHOC.raid.boss] || {};
  const assez = (r.moi.degats || 0) >= CHOC.raid.minimum;
  const phases = CHOC.raid.phases.map(x => {
    const s = r.phases.find(y => y.n === x.n) || {};
    const pris = r.prises.includes(x.n);
    const etat = s.tombee ? (pris ? 'pris' : 'tombee') : x.n === r.phase ? 'cours' : 'loin';
    return `<li class="ch-ph ${etat}">
      <span class="ch-ph-n">${s.tombee ? NAVICO.check : x.n}</span>
      <div class="ch-ph-txt"><b>${h(x.nom)}</b><small>${fmtN(s.pv || x.pv)} PV · IA ${'★'.repeat(x.ia)} · ${x.pvBoss} PV${x.ess ? ` · ${x.ess} Essence${x.ess > 1 ? 's' : ''} d'avance` : ''}</small></div>
      <span class="ch-ph-gain"><span class="rf-palico">${chIco(Object.assign({ type: x.recompense.type, objet: x.recompense.objet }, x.recompense))}</span>
        ${pris ? '<span class="rf-paletat">Récupéré</span>'
          : s.tombee && assez ? `<button class="btn tiny" data-ch="phase" data-v="${x.n}" data-snd="piece">Récupérer</button>`
          : s.tombee ? '<span class="rf-paletat">Frappe-le d\'abord</span>'
          : `<small>${h(x.recompense.titre)}</small>`}</span>
    </li>`;
  }).join('');
  const sec = cbEtat().section;
  return `${chTitre('Le Raid', `${h(CHOC.raid.nom)} tire les fils de tout le serveur. Chaque PV que tu lui prends compte pour tout le monde.`)}
    <section class="ch-boss">
      <div class="ch-boss-carte">${renderCard(k)}</div>
      <div class="ch-boss-txt">
        ${vChBarre(r, true)}
        <p class="ch-boss-dit">${h(p.texte)}</p>
        <p class="ch-couleurs">Aujourd'hui, il joue ${couleurs.map(c => `${essIcon(c)}<b>${h(COLORS[c].nom)}</b>`).join(' et ')} — avec du Neutre.</p>
        <ul class="ch-regles">
          <li>IA ${h(DIFFICULTES[p.ia - 1].nom)} ${'★'.repeat(p.ia)}</li>
          <li>${p.pvBoss} PV</li>
          ${p.ess ? `<li>${p.ess} Essence${p.ess > 1 ? 's' : ''} en jeu au départ</li>` : ''}
        </ul>
      </div>
    </section>
    <section class="ch-attaque">
      <div class="ch-moi">
        <div><b class="tnum">${fmtN(r.moi.degats)}</b><small>dégâts infligés</small></div>
        <div><b class="tnum">${r.moi.victoires}</b><small>fois vaincu</small></div>
        <div><b class="tnum">${tr}<small>/${r.moi.max}</small></b><small>tentatives du jour</small></div>
      </div>
      ${sec ? vChoixDeck() : ''}
      ${sec ? `<button class="btn cb-lancer ch-lancer" data-ch="raid-go" ${tr ? '' : 'disabled'}>${NAVICO.sword}${tr ? 'Attaquer le Marionnettiste' : 'Plus de tentative aujourd\'hui'}</button>`
        : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
      <p class="muted small">Chaque PV que tu lui prends : un dégât sur la barre commune, et ${CHOC.raid.parDegat} ${CHOC.monnaie.nom}. S'il tombe : +${CHOC.raid.bonusDegats} dégâts, +${CHOC.raid.bonusVictoire} ${CHOC.monnaie.nom} et ${CHOC.raid.points * CHOC.guerre.multiplicateur} points de Section. Les tentatives reviennent chaque jour.</p>
    </section>
    <section>
      <h3 class="rf-sous">Les cinq phases</h3>
      <ol class="ch-phases">${phases}</ol>
      ${r.phase > CHOC.raid.phases.length ? `<p class="ch-rappel">${h(CHOC.raid.rappel.texte)}</p>` : ''}
      <p class="muted small">Pour réclamer une phase tombée, il faut avoir infligé au moins ${CHOC.raid.minimum} dégât${CHOC.raid.minimum > 1 ? 's' : ''} au Marionnettiste pendant l'événement — peu importe quand.</p>
    </section>
    ${vChTopRaid(5)}`;
}

/* Le classement des dégâts du Raid. */
function vChTopRaid(n) {
  const top = (chEtat.raid.top || []).slice(0, n || 10);
  if (!top.length) return '';
  return `<section><h3 class="rf-sous">Ceux qui frappent le plus</h3>
    <ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
      <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
      <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.section ? `<small class="ch-sec">${emblemeSection(j.section)}${h(SECTIONS[j.section].court)}</small>` : ''}</span>
      <span class="rf-pts tnum">${fmtN(j.degats)}<small class="muted">&nbsp;dégâts</small></span></li>`).join('')}</ol></section>`;
}

async function lancerRaid() {
  if (!chEtat) return;
  const r = chEtat.raid;
  if (!chTentativesRestantes()) return toast('Plus de tentative aujourd\'hui : reviens demain.');
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (Combats, onglet Decks).');
  const p = chocPhase(r.phase);
  await demarrer({
    mode: 'raid', cle: String(r.phase), niveau: p.ia, deck,
    deckIA: deckMarionnettiste(chEtat.jour, r.phase),
    adversaire: { nom: CHOC.raid.nom, avatar: 'card:' + CHOC.raid.boss, frame: 'f_fils' },
    pv: p.pvBoss, ess: p.ess,
    cosmAdv: { tapis: 't_theatre', sleeve: 's_base' },
    titre: `Raid · ${r.phase > CHOC.raid.phases.length ? 'Le rappel' : `Phase ${r.phase}`}`, sousTitre: p.nom
  });
}

async function reclamerPhase(n) {
  const x = CHOC.raid.phases.find(p => p.n === n);
  occupe(true);
  try {
    const cartes = (await Backend.raidReclamer(n)).map(id => byId[id]).filter(Boolean);
    chEtat = await Backend.chocEtat();
    SFX.jouer('gagne');
    if (!RM()) FX.sparkle({ n: 90, colors: ['#ee0073', '#8936ff', '#ffc73b', '#fff'], size: 3.4 });
    const boosters = x.recompense.type === 'boosters';
    openSheet({
      title: `Phase ${n} tombée`,
      body: `<div class="rf-gain">
          ${cartes.length ? `<div class="rf-gaincartes">${cartes.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
            : `<span class="rf-gainico ch-gainico">${chIco(x.recompense, 'md')}</span>`}
          <b>${h(x.recompense.titre)}</b>
          <p class="muted small">Tout le serveur a fait tomber « ${h(x.nom)} ». Ta part du butin est sur ton compte.</p>
        </div>`,
      actions: boosters
        ? [{ label: 'Ouvrir maintenant', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
           { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
        : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
    });
  } catch (e) {
    toast(e.message || 'La récompense n\'a pas pu être récupérée.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
  }
}

/* =====================================================================
   L'Épreuve du jour
   ===================================================================== */
const epreuveRegle = () => CHOC.epreuve.regles[chocMod(chocJourN(chEtat.jour), CHOC.epreuve.regles.length)];
let chEpreuveCache = { cle: '', v: null };
function epreuveCourante() {
  const cle = chEtat.jour + ':' + chEtat.epreuve.graine;
  if (chEpreuveCache.cle !== cle) chEpreuveCache = { cle, v: epreuveDuJour(chEtat.jour, chEtat.epreuve.graine) };
  return chEpreuveCache.v;
}
const texteScore = s => (!s ? '—' : s.gagne ? `Victoire en ${s.tours} tour${s.tours > 1 ? 's' : ''} · ${s.pv} PV` : `Défaite · ${s.touches || 0} PV pris`);

function vChEpreuve() {
  const ep = chEtat.epreuve;
  const x = epreuveCourante();
  const restants = ep.max - ep.essais.length;
  const sec = cbEtat().section;
  const pips = Array.from({ length: ep.max }, (_, i) => {
    const s = ep.essais[i];
    return `<i class="${s ? (s.gagne ? 'ok' : 'ko') : ''}" title="${s ? h(texteScore(s)) : 'Essai libre'}"></i>`;
  }).join('');
  const deck = (d, qui, cle) => `<button class="ch-ep-deck" data-ch="ep-deck" data-v="${cle}">
      <span class="ch-ep-deck-art">${renderCard(byId[d.couverture] || {})}</span>
      <span><small>${qui}</small><b>${h(d.nom)}</b><em>${Object.keys(d.reserve).filter(k => d.reserve[k]).map(k => essIcon(k)).join('')} Voir les ${Decks.total(d.cartes)} cartes</em></span>
    </button>`;
  return `${chTitre('L\'Épreuve du jour', 'Le même combat pour tout le monde : les mêmes deux decks, la même donne. Trois essais, ton meilleur compte.')}
    <section class="ch-ep-regle">
      <span class="ch-ep-ico">${NAVICO.epreuve}</span>
      <div><small>Règle du jour</small><b>${h(x.regle.nom)}</b><p>${h(x.regle.texte)}</p></div>
    </section>
    <div class="ch-ep-decks">${deck(x.moi, 'Ton deck imposé', 'moi')}<span class="cb-vs">VS</span>${deck(x.adv, `L'IA · ${h(DIFFICULTES[CHOC.epreuve.ia - 1].nom)}`, 'adv')}</div>
    <section class="ch-ep-etat">
      <div class="ch-ep-pips">${pips}</div>
      <p><b>Ton meilleur :</b> ${h(texteScore(ep.meilleur))}</p>
      <p class="muted small">Chaque essai : ${CHOC.epreuve.participation} ${CHOC.monnaie.nom}. Première victoire du jour : +${CHOC.epreuve.victoire} ${CHOC.monnaie.nom} et ${CHOC.epreuve.points * CHOC.guerre.multiplicateur} points de Section. La donne est la même à chaque essai : apprends-la.</p>
      ${sec ? `<button class="btn cb-lancer ch-lancer" data-ch="ep-go" ${restants ? '' : 'disabled'}>${restants ? `Tenter l'Épreuve · essai ${ep.essais.length + 1}/${ep.max}` : 'Épreuve terminée — nouvelle demain'}</button>`
        : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
    </section>
    ${(ep.top || []).length ? `<section><h3 class="rf-sous">Classement du jour</h3>
      <ol class="rf-top">${ep.top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b><small class="muted">${h(texteScore(j))}</small></span></li>`).join('')}</ol></section>` : ''}`;
}

function voirDeckEpreuve(qui) {
  const x = epreuveCourante();
  const d = qui === 'adv' ? x.adv : x.moi;
  const ids = Object.keys(d.cartes).sort((a, b) => ordreType(a) - ordreType(b) || (byId[a] || {}).num - (byId[b] || {}).num);
  openSheet({
    title: d.nom,
    body: `<div class="cb-liste-deck">${ids.map(id => `<span class="cb-ld">${renderCard(byId[id] || {})}${d.cartes[id] > 1 ? `<i>×${d.cartes[id]}</i>` : ''}</span>`).join('')}</div>
      <p class="muted small">Réserve : ${Object.keys(d.reserve).filter(k => d.reserve[k]).map(k => `${d.reserve[k]} ${COLORS[k].nom}`).join(', ')}.</p>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

async function lancerEpreuve() {
  const ep = chEtat && chEtat.epreuve;
  if (!ep || ep.essais.length >= ep.max) return toast('Épreuve terminée : une nouvelle demain.');
  const x = epreuveCourante();
  await demarrer({
    mode: 'epreuve', cle: chEtat.jour, niveau: CHOC.epreuve.ia,
    deck: x.moi, deckIA: x.adv,
    adversaire: { nom: 'L\'adversaire du jour', avatar: 'card:' + x.adv.couverture, frame: 'f_choc' },
    pvMoi: x.regle.pv[0], essMoi: x.regle.ess[0], pv: x.regle.pv[1], ess: x.regle.ess[1],
    titre: `Épreuve · ${x.regle.nom}`, sousTitre: `Essai ${ep.essais.length + 1}/${ep.max}`
  });
}

/* =====================================================================
   Quêtes
   ===================================================================== */
function vChQuetes() {
  const qs = (save.quetes || []).filter(q => q.evenement === 'choc');
  return `${chTitre('Quêtes', `Elles paient en ${CHOC.monnaie.nom}, et chaque ${CHOC.monnaie.un} gagné fait avancer le Pass.`)}
    <h3 class="rf-sous">Du jour <small>· nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}</small></h3>
    ${vListeQuetes(qs.filter(q => q.scope === 'ev_jour'))}
    <h3 class="rf-sous">De l'événement</h3>
    ${vListeQuetes(qs.filter(q => q.scope === 'ev'))}`;
}

/* =====================================================================
   Le Pass
   ===================================================================== */
/* L'icône d'une récompense : celles de Reflets, plus les cosmétiques de
   combat et la Légendaire. */
function chIco(x, taille) {
  if (x.type === 'tapis' && TAPIS[x.objet]) return `<img class="ch-ico-tapis" src="${TAPIS[x.objet].img.replace('.webp', '-mini.webp')}" alt="">`;
  if (x.type === 'sleeve' && SLEEVES[x.objet]) return `<img class="ch-ico-sleeve" src="${SLEEVES[x.objet].img}" alt="">`;
  if (x.type === 'legendaire') return `<i class="ch-ico-l">${ICON.star}</i>`;
  if (x.type === 'insignes') return insigneIco;
  return rfIco(x, taille);
}

function vChPass() {
  const total = chEv.total;
  const piste = chEv.piste;
  const atteint = piste.filter(x => total >= x.seuil).length;
  const prochain = piste.find(x => total < x.seuil);
  const avant = prochain ? (piste[prochain.palier - 2] || { seuil: 0 }).seuil : 0;
  const pct = prochain ? Math.round((total - avant) / (prochain.seuil - avant) * 100) : 100;
  const prets = chPaliersPrets();
  const ligne = x => {
    const ok = total >= x.seuil;
    const etat = x.pris ? 'pris' : ok ? 'pret' : x === prochain ? 'prochain' : 'loin';
    const rare = ['cadre', 'titre', 'tapis', 'sleeve', 'legendaire', 'brillante'].includes(x.type);
    return `<li class="rf-pal ${etat}${rare ? ' rare' : ''}" id="chpal-${x.palier}">
      <span class="rf-palnum tnum">${x.pris ? NAVICO.check : x.palier}</span>
      <div class="rf-palcarte">
        <span class="rf-palico">${chIco(x)}</span>
        <span class="rf-paltxt"><b>${h(x.titre)}</b><small>${insigneIco}<span class="tnum">${fmtN(x.seuil)}</span></small></span>
        ${x.pris ? '<span class="rf-paletat">Récupéré</span>'
          : ok ? `<button class="btn tiny" data-ch="palier" data-v="${x.palier}" data-snd="piece">Récupérer</button>`
          : x === prochain ? `<span class="rf-paletat">encore ${fmtN(x.seuil - total)}</span>` : ''}
      </div>
    </li>`;
  };
  return `<section class="rf-passtete">
      <div class="rf-passniv"><small>Palier</small><b class="tnum">${atteint}<span>/${piste.length}</span></b></div>
      <div class="rf-passjauge">
        <div class="rf-passchiffres">
          <span><b class="tnum">${fmtN(total)}</b> ${CHOC.monnaie.nom} gagnés</span>
          <small>${prochain ? `encore <b class="tnum">${fmtN(prochain.seuil - total)}</b>` : 'Pass terminé'}</small>
        </div>
        <div class="rf-jauge"><i style="width:${pct}%"></i></div>
        <small class="muted">Dépenser en boutique ne fait pas reculer le Pass.</small>
      </div>
    </section>
    ${prets > 1 ? `<button class="btn rf-tout" data-ch="pass-tout" data-snd="piece">${NAVICO.check}Tout récupérer · ${prets} paliers</button>` : ''}
    <ol class="rf-pass" style="--fait:${atteint}">${piste.map(ligne).join('')}</ol>`;
}

function placerPassChoc() {
  if (tab !== 'choc' || chVue !== 'pass' || chPassPlace || !chEv) return;
  chPassPlace = true;
  const x = chEv.piste.find(p => !p.pris && chEv.total >= p.seuil) || chEv.piste.find(p => chEv.total < p.seuil);
  const el = x && document.getElementById('chpal-' + x.palier);
  if (el && x.palier > 3) el.scrollIntoView({ block: 'center' });
}

/* Un ou plusieurs paliers, puis une seule fenêtre. */
async function chReclamer(paliers) {
  const l = paliers.map(n => chEv.piste.find(p => p.palier === n)).filter(Boolean);
  if (!l.length) return;
  occupe(true);
  const pris = [];
  let cartes = [];
  try {
    for (const x of l) {
      cartes = cartes.concat((await Backend.pisteReclamer(x.palier)) || []);
      pris.push(x);
    }
  } catch (e) {
    toast(e.message || 'Un palier n\'a pas pu être récupéré.');
  }
  try { chEv = await Backend.evenementEtat(); } catch (e) { /* l'ancien suffit */ }
  occupe(false);
  if (!pris.length) return render();
  SFX.jouer('gagne');
  if (!RM()) FX.sparkle({ n: 100, colors: ['#ee0073', '#8936ff', '#ffc73b', '#fff'], size: 3.4 });
  const ks = cartes.map(id => byId[id]).filter(Boolean);
  const boosters = pris.some(x => x.type === 'boosters');
  const cosm = pris.find(x => x.type === 'tapis' || x.type === 'sleeve');
  const un = pris.length === 1 ? pris[0] : null;
  openSheet({
    title: un ? `Palier ${un.palier}` : `${pris.length} paliers récupérés`,
    body: `<div class="rf-gain">
        ${ks.length ? `<div class="rf-gaincartes">${ks.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
          : un ? `<span class="rf-gainico ch-gainico">${chIco(un, 'md')}</span>` : ''}
        ${un ? `<b>${h(un.titre)}</b>` : `<ul class="rf-gainliste">${pris.map(x => `<li><span class="rf-palico">${chIco(x)}</span>${h(x.titre)}</li>`).join('')}</ul>`}
        ${cosm ? '<p class="muted small">À choisir dans Combats, onglet Decks : Personnaliser.</p>' : ''}
      </div>`,
    actions: boosters
      ? [{ label: 'Ouvrir mes boosters', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
         { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
      : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
  });
}

/* =====================================================================
   La boutique
   ===================================================================== */
function vChBoutique() {
  const items = (Backend.shop || []).filter(it => it.evenement === 'choc');
  const article = it => {
    const deja = (save.inv || {})[it.id] || 0;
    const fini = it.unique_buy ? deja > 0 : it.limite != null && deja >= it.limite;
    const reste = it.limite != null && !it.unique_buy ? `${it.limite - deja} / ${it.limite}` : it.unique_buy ? 'Exclusif' : '';
    const visuel = TAPIS[it.id] ? `<img class="ch-art-tapis" src="${TAPIS[it.id].img.replace('.webp', '-mini.webp')}" alt="">`
      : SLEEVES[it.id] ? `<img class="ch-art-sleeve" src="${SLEEVES[it.id].img}" alt="">`
      : FRAMES[it.id] ? avatarHTML(save.avatar, it.id, 'xl', maPhoto())
      : TITRES[it.id] ? `<span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span>`
      : it.effet === 'reverse_R' ? NAVICO.reflets : it.effet === 'fragments' ? NAVICO.fragment
      : it.effet === 'brillante' ? NAVICO.promo : `<img class="ch-art-pack" src="${PACK_ARTS[0]}" alt="">`;
    return `<article class="rf-art${fini ? ' fini' : ''}">
      <div class="rf-artvis">${visuel}</div>
      <b>${h(it.titre)}</b>
      <small>${h(it.detail)}</small>
      ${reste ? `<span class="rf-artreste">${fini && !it.unique_buy ? 'Épuisé' : reste}</span>` : ''}
      ${fini ? '<span class="qtag">Acquis</span>'
        : `<button class="btn tiny" data-shop="${h(it.id)}" ${chEv.solde < it.prix ? 'disabled' : ''}>${insigneIco}${fmtN(it.prix)}</button>`}
    </article>`;
  };
  return `${chTitre('Boutique', `En ${CHOC.monnaie.nom}, seulement pendant l'événement. Ton solde : ${insigneIco}<b class="tnum">${fmtN(chEv.solde)}</b>`)}
    ${items.length ? `<div class="rf-arts">${items.map(article).join('')}</div>` : '<p class="muted">Chargement de la boutique…</p>'}`;
}

/* =====================================================================
   Le classement
   ===================================================================== */
function vChClassement() {
  const top = chEv.top || [];
  const seg = [['raid', 'Raid'], ['insignes', CHOC.monnaie.nom], ['sections', 'Sections']]
    .map(([id, nom]) => `<button class="${chClassement === id ? 'on' : ''}" data-ch="classement" data-v="${id}">${nom}</button>`).join('');
  let corps;
  if (chClassement === 'insignes') {
    corps = top.length ? `<ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.titre && TITRES[j.titre] ? `<small class="titreligne t${TITRES[j.titre].ton}">${h(TITRES[j.titre].nom)}</small>` : ''}</span>
        <span class="rf-pts tnum">${insigneIco}${fmtN(j.total)}</span></li>`).join('')}</ol>`
      : `<p class="muted">Personne n'a encore gagné d'${CHOC.monnaie.nom} : à toi de commencer.</p>`;
  } else if (chClassement === 'sections') {
    corps = vChGuerre();
  } else {
    corps = vChTopRaid(10) || '<p class="muted">Personne n\'a encore frappé le Marionnettiste.</p>';
  }
  return `${chTitre('Classement', 'Les dégâts du Raid, les Insignes gagnés, et la Guerre du Choc.')}
    <div class="segbar ch-seg">${seg}</div>${corps}`;
}

/* =====================================================================
   Les bandeaux : écran Boosters, Combats, Boutique
   ===================================================================== */
function vBandeauChoc(lieu) {
  const ev = save.evenement;
  const fin = ev ? srvTime(ev.fin) : Date.now();
  const n = chocPastille();
  const vers = lieu === 'boutique' ? 'boutique' : lieu === 'combats' ? 'raid' : 'accueil';
  const r = chEtat && chEtat.raid;
  const sous = lieu === 'boutique' ? `En ${CHOC.monnaie.nom}, pendant l'événement`
    : r ? `Raid · ${r.phase > CHOC.raid.phases.length ? 'le rappel' : `phase ${r.phase}/${CHOC.raid.phases.length}`}` : 'Le Raid est ouvert';
  return `<button class="rfban chban${lieu ? ' ' + lieu : ''}" data-ch="vue" data-v="${vers}" aria-label="Ouvrir l'événement Le Choc des Sections">
    ${chArt()}
    <span class="rfban-txt">
      <small>${lieu === 'boutique' ? 'Boutique de l\'événement' : `Événement 3.0 · encore <span data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</span>`}</small>
      <b>Le Choc des Sections</b>
      ${lieu ? `<em class="chban-sous">${h(sous)}</em>` : ''}
    </span>
    ${n ? `<span class="rfban-n">${n}</span>` : `<span class="rfban-solde">${insigneIco}${fmtN(save.prismes || 0)}</span>`}
    <span class="rfban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* =====================================================================
   Après l'événement : le récap (trois jours)
   ===================================================================== */
let chRecap = null;
let chRecapApercu = null;
const recapChoc = () => chRecapApercu
  || (save && save.recap && save.recap.code === 'choc' && !evenementEnCours() ? save.recap : null);

async function chargerRecapChoc() {
  if (chRecapApercu) { chRecap = chRecapApercu; return chRecap; }
  try { chRecap = await Backend.rpc('evenement_recap'); } catch (e) { chRecap = null; }
  if (tab === 'choc') render();
  return chRecap;
}

/* L'aperçu du Labo : des chiffres plausibles, rien d'enregistré. */
function apercuRecapChoc() {
  const t = Date.now();
  const bots = [['Nova.92', 'deter', 3870], ['Lumen', 'toxique', 3410], ['Mira', 'toxique', 2990]];
  chRecapApercu = {
    code: 'choc', titre: CHOC.nom, debut: new Date(t - 21 * 86400000).toISOString(), fin: new Date(t - 3600000).toISOString(),
    jusqua: new Date(t + 3 * 86400000 - 3600000).toISOString(), apercu: true,
    total: 2840, paliers: 24, paliers_max: 30, pris: 24, quetes: 58, rang: 6, joueurs: 41,
    degats: 214, raid_phases: 5, epreuves: 13,
    guerre: { toxique: 18420, deter: 17975 }, section: cbEtat().section || 'toxique', gagnante: 'toxique', titre_gagne: true,
    top: bots.map(([pseudo, section, total]) => ({ pseudo, section, total, avatar: 'star', frame: 'f_choc', photo: null, moi: false }))
  };
  chRecap = chRecapApercu;
}
function quitterApercuRecapChoc() { chRecapApercu = null; chRecap = null; aller('labo'); }

function vChRecap() {
  const r = chRecap;
  const a = recapChoc();
  const reste = a && a.jusqua ? srvTime(a.jusqua) : 0;
  const tete = `<header class="rf-tete ch-tete rf-recap">
    ${chArt()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom"><small>Événement terminé · le récap</small><h1>Le Choc<span>des Sections</span></h1></div>
      <div class="rf-tetechiffres">${reste ? `<span class="rf-fin">${NAVICO.clock}<span>encore <b data-rebours="${reste}">${h(dureeCourte(reste - Date.now()))}</b></span></span>` : ''}</div>
    </div>
    ${r && r.apercu ? '<button class="btn tiny ghost rf-quitter" data-ch="recap-quitter">Quitter l\'aperçu</button>' : ''}
  </header>`;
  if (!r) { chargerRecapChoc(); return `<div class="rf ch">${tete}<p class="muted boitecharge">Chargement du récap…</p></div>`; }
  const stat = (ico, val, lib, sous) => `<div class="rr-stat"><span class="rr-ico">${ico}</span>
    <b class="tnum">${val}</b><span>${lib}</span>${sous ? `<small>${sous}</small>` : ''}</div>`;
  const g = r.guerre || { toxique: 0, deter: 0 };
  const gagnante = r.gagnante && SECTIONS[r.gagnante];
  const podium = (r.top || []).map((j, i) => `<li class="p${i + 1}${j.moi ? ' moi' : ''}">
      <span class="rr-place">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'lg', j.photo)}
      <b>${h(j.pseudo)}</b><small>${insigneIco}${fmtN(j.total)}</small></li>`).join('');
  return `<div class="rf ch">${tete}<div class="rf-page">
    ${gagnante ? `<section class="ch-vainqueur sec-${r.gagnante}" style="--sc:${gagnante.c};--sc2:${gagnante.c2}">
      <img src="${gagnante.boite}" alt="">
      <div><small>La Guerre du Choc</small><b>${h(gagnante.nom)} l'emporte</b>
        <p class="tnum">${fmtN(g.toxique)} points pour Toxique · ${fmtN(g.deter)} pour Déter</p>
        ${r.titre_gagne ? `<p class="ch-vainqueur-titre">Le titre « ${h(TITRES[CHOC.guerre.titre].nom)} » est à toi.</p>`
          : r.section === r.gagnante ? '<p class="muted small">Il fallait avoir marqué au moins un point pour le titre.</p>' : '<p class="muted small">Ta Section s\'inclinera avec les honneurs.</p>'}</div>
    </section>` : ''}
    <section class="rr-bilan">
      <h2>Ton bilan</h2>
      <div class="rr-stats">
        ${stat(insigneIco, fmtN(r.total), CHOC.monnaie.nom + ' gagnés', r.rang ? `${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup> sur ${r.joueurs}` : '')}
        ${stat(NAVICO.trophy, `${r.paliers}<small>/${r.paliers_max}</small>`, 'paliers du Pass', r.paliers >= r.paliers_max ? 'Pass terminé' : '')}
        ${stat(NAVICO.fils, fmtN(r.degats || 0), 'dégâts au Marionnettiste', `${r.raid_phases || 0}/5 phases tombées`)}
        ${stat(NAVICO.epreuve, r.epreuves || 0, 'Épreuves gagnées', '')}
        ${stat(NAVICO.quest, r.quetes, 'quêtes accomplies', '')}
      </div>
    </section>
    ${podium ? `<section class="rr-podium"><h2>Le podium</h2><ol>${podium}</ol></section>` : ''}
    <section class="rr-continue">
      <h2>Ce qui reste</h2>
      <div class="rr-cartes">
        <button class="rr-lien" data-tab="combats"><span class="rr-ico">${NAVICO.sword}</span><b>Les Combats continuent</b><small>Campagne, PvE infini, défis : la Guerre des Sections repart chaque lundi.</small></button>
        <button class="rr-lien" data-tab="collection"><span class="rr-ico">${NAVICO.cards}</span><b>La maîtrise des cartes</b><small>Chaque exemplaire obtenu fait monter ta carte de Bronze à Prisme.</small></button>
      </div>
    </section>
  </div></div>`;
}

function vBandeauChocRecap() {
  return `<button class="rfban chban rf-recap" data-tab="choc" aria-label="Voir le récap du Choc des Sections">
    ${chArt()}
    <span class="rfban-txt"><small>Terminé · le récap</small><b>Le Choc des Sections</b></span>
    <span class="rfban-solde">Ton bilan</span>
    <span class="rfban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* La fenêtre de fin : une fois, au premier passage après la fin. */
function recapChocAVoir() {
  const a = save && save.recap;
  return !!(a && a.code === 'choc' && !evenementEnCours() && accueilMemoire().recap !== a.fin);
}
async function montrerRecapChoc() {
  const a = recapChoc();
  if (a && !a.apercu) accueilNoter({ recap: a.fin });
  const r = chRecapApercu || await chargerRecapChoc();
  if (!r) return;
  const gagnante = r.gagnante && SECTIONS[r.gagnante];
  openSheet({
    title: 'Le Choc des Sections, c\'est fini',
    body: `<div class="rr-pop">
        <div class="rr-poptete">${chArt()}<b>${gagnante ? `${h(gagnante.nom)} l'emporte` : 'Merci d\'avoir joué'}</b><small>Trois semaines de combats — voici les tiens.</small></div>
        <div class="rr-popstats">
          <div><b class="tnum">${fmtN(r.total)}</b><small>${CHOC.monnaie.nom}</small></div>
          <div><b class="tnum">${r.paliers}/${r.paliers_max}</b><small>Pass</small></div>
          <div><b class="tnum">${fmtN(r.degats || 0)}</b><small>dégâts</small></div>
          ${r.rang ? `<div><b class="tnum">${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup></b><small>sur ${r.joueurs}</small></div>` : ''}
        </div>
        ${r.titre_gagne ? `<p class="ch-vainqueur-titre">Titre « ${h(TITRES[CHOC.guerre.titre].nom)} » débloqué.</p>` : ''}
        <p class="muted small">Le récap complet reste trois jours dans l'onglet de l'événement.</p>
      </div>`,
    actions: [{ label: 'Voir le récap', primary: true, fn: () => { closeSheet(); aller('choc'); } },
              { label: 'Plus tard', fn: closeSheet }]
  });
}

/* =====================================================================
   Les clics
   ===================================================================== */
function chAction(k, el) {
  const v = el.dataset.v;
  switch (k) {
    case 'vue': return allerCh(v);
    case 'raid-go': return lancerRaid();
    case 'phase': return reclamerPhase(+v);
    case 'ep-go': return lancerEpreuve();
    case 'ep-deck': return voirDeckEpreuve(v);
    case 'palier': return chReclamer([+v]);
    case 'pass-tout': return chReclamer(chEv.piste.filter(p => !p.pris && chEv.total >= p.seuil).map(p => p.palier));
    case 'classement': chClassement = v; return render();
    case 'recap-quitter': return quitterApercuRecapChoc();
  }
}
