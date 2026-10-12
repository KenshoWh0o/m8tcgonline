/* Version 3.0 : l'événement « Le Choc des Sections ».

   Bâti comme l'événement de la 2.0 (Reflets, js/reflets.js) : un en-tête
   qui reste en place, des sous-onglets, et une page entière par rubrique —
   Accueil, Raid, Épreuve, Quêtes, Pass, Boutique, Classement. L'accueil ne
   montre que l'essentiel du jour et ce que la 3.0 apporte ; chaque
   rubrique a la place de respirer dans sa propre page.

   L'en-tête montre les deux Sections face à face : Squeezie le Toxique
   (#012) et Gotaga Pose (#060), fondus l'un dans l'autre et coupés en biais ;
   l'illustration de The French Sorcerer est réservée au Raid, pour ne pas
   répéter le même visuel deux fois sur le même écran. Le Raid reste toute l'année (js/raid.js) :
   l'onglet de l'événement en montre la page, et pendant l'événement il paie
   en Insignes. L'Épreuve se joue dans l'arène (js/combat/table.js), lancée
   par demarrer() (js/battle.js) ; les règles et les chiffres sont dans
   js/combat/choc-data.js.

   Ce qui compte se décide côté serveur (supabase/25_choc.sql) : la graine
   de l'Épreuve, les Insignes. */
"use strict";

/* evenement_etat (le solde, le Pass, le classement des Insignes) et
   choc_etat (l'Épreuve). Le Raid a son état à lui (rdEtat, js/raid.js). */
let chEv = null;
let chEtat = null;
let chErreur = '';
let chVue = 'accueil';
let chPassPlace = false;
let chClassement = 'raid';

const CH_ONGLETS = [
  ['accueil', 'Accueil'],
  ['raid', 'Raid'],
  ['epreuve', 'Épreuve'],
  ['quetes', 'Quêtes'],
  ['pass', 'Pass'],
  ['boutique', 'Boutique'],
  ['classement', 'Classement']
];
const CH_VUES = CH_ONGLETS.map(x => x[0]);

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
  if ((tab === 'choc' || tab === 'combats') && !ecranOccupe()) render();
}

/* ---------- Ce qui attend ---------- */
const chQuetesPretes = () => (save.quetes || [])
  .filter(x => x.evenement === 'choc' && x.progress >= x.goal && !x.claimed).length;
const chPaliersPrets = () => chEv ? chEv.piste.filter(x => !x.pris && chEv.total >= x.seuil).length : 0;
const chEpreuveAJouer = () => !!(chEtat && chEtat.epreuve.essais.length < chEtat.epreuve.max);

/* La pastille de l'onglet, dans le tiroir et le rail. */
function chocPastille() {
  if (evenementEnCours() !== 'choc') return 0;
  return chQuetesPretes() + chPaliersPrets();
}

function allerCh(vue) {
  chVue = CH_VUES.includes(vue) ? vue : 'accueil';
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
    accueil: vChAccueil, raid: () => vRaid(), epreuve: vChEpreuve, quetes: vChQuetes,
    pass: vChPass, boutique: vChBoutique, classement: vChClassement
  }[chVue] || vChAccueil;
  return `<div class="rf ch">${vChTete(srvTime(ev.fin))}<div class="rf-page">${corps()}</div></div>`;
}

/* L'affiche de l'en-tête : une illustration par Section, teintée à sa
   couleur, la coupe en biais qui brille entre les deux, et le VS dessus
   (css/choc.css). */
function chAffiche() {
  return `<span class="ch-affiche" aria-hidden="true">
    <span class="ch-aff-sec toxique"></span>
    <span class="ch-aff-sec deter"></span>
    <span class="ch-aff-coupe"><i></i></span>
    <span class="ch-aff-vs">VS</span>
  </span>`;
}

/* L'illustration de The French Sorcerer (#116) : le Raid, et le bandeau de
   l'écran Boosters. Cadrée sur son visage. */
function chArt() {
  const c = byId[RAID.boss];
  return c && c.img ? `<span class="rf-fond ch-fond" aria-hidden="true"><i style="background-image:url('${h(c.img)}')"></i></span>` : '';
}

/* L'en-tête, sur toutes les pages : les deux Sections, le nom, le temps
   qui reste, le solde, et les sous-onglets. */
function vChTete(fin) {
  const pastille = id => {
    const n = id === 'quetes' ? chQuetesPretes() : id === 'pass' ? chPaliersPrets() : id === 'raid' ? rdCoffres() : 0;
    if (n) return `<i class="rf-pastille">${n}</i>`;
    const aJouer = (id === 'raid' && rdTentatives() > 0) || (id === 'epreuve' && chEpreuveAJouer() && !chEtat.epreuve.gagnee);
    return aJouer ? '<i class="rf-point" aria-label="À jouer"></i>' : '';
  };
  return `<header class="rf-tete ch-tete">
    ${chAffiche()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom">
        <small>Événement · Version 3.0</small>
        <h1>Le Choc<span>des Sections</span></h1>
      </div>
      <div class="rf-tetechiffres">
        <button class="rf-solde" data-ch="vue" data-v="boutique" title="${CHOC.monnaie.nom} à dépenser">${insigneIco}<b class="tnum">${fmtN(chEv.solde)}</b></button>
        <span class="rf-fin">${NAVICO.clock}<b data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</b></span>
      </div>
    </div>
    <nav class="rf-onglets" role="tablist">
      ${CH_ONGLETS.map(([id, nom]) => `<button class="${chVue === id ? 'on' : ''}" data-ch="vue" data-v="${id}" role="tab"
        aria-selected="${chVue === id}">${nom}${pastille(id)}</button>`).join('')}
    </nav>
  </header>`;
}

/* Le titre d'une page, sous l'en-tête. */
const chTitre = (titre, texte) => `<div class="rf-ptitre"><h2>${titre}</h2>${texte ? `<p>${texte}</p>` : ''}</div>`;

/* =====================================================================
   Accueil
   ===================================================================== */
function vChAccueil() {
  const r = rdEtat;
  const ep = chEtat.epreuve;
  const qj = (save.quetes || []).filter(q => q.evenement === 'choc' && q.scope === 'ev_jour');
  const qFaites = qj.filter(q => q.progress >= q.goal).length;
  const piste = chEv.piste;
  const atteint = piste.filter(x => chEv.total >= x.seuil).length;
  const prochain = piste.find(x => chEv.total < x.seuil);
  const regle = epreuveRegle();
  const tr = rdTentatives();
  const er = ep.max - ep.essais.length;
  const coffres = rdCoffres();
  const paliers = chPaliersPrets();
  const qPretes = chQuetesPretes();
  const tuile = (vue, ico, titre, valeur, sous, chaud) => `<button class="rf-tuile${chaud ? ' chaud' : ''}" data-ch="vue" data-v="${vue}">
      <span class="rf-tuileico">${ico}</span>
      <span class="rf-tuiletxt"><small>${titre}</small><b>${valeur}</b><span>${sous}</span></span>
    </button>`;
  return `<section class="rf-jour">
      <h3 class="rf-sous">Aujourd'hui</h3>
      <div class="rf-tuiles ch-tuiles">
        ${tuile('raid', NAVICO.foudre, 'Le Raid', r ? `Niveau ${r.niveau}` : '…',
          coffres ? `${coffres} coffre${coffres > 1 ? 's' : ''} à ouvrir` : tr ? `${tr} tentative${tr > 1 ? 's' : ''} aujourd'hui` : 'Reviens demain', coffres > 0 || tr > 0)}
        ${tuile('epreuve', NAVICO.epreuve, 'Épreuve du jour', h(regle.nom),
          ep.gagnee ? 'Gagnée aujourd\'hui' : er ? `${er} essai${er > 1 ? 's' : ''} restant${er > 1 ? 's' : ''}` : 'Terminée', er > 0 && !ep.gagnee)}
        ${tuile('quetes', NAVICO.quest, 'Quêtes du jour', `${qFaites} / ${qj.length}`,
          qPretes ? `${qPretes} à récupérer` : `Nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}`, qPretes > 0)}
        ${tuile('pass', NAVICO.trophy, 'Pass', `Palier ${atteint} / ${piste.length}`,
          paliers ? `${paliers} à récupérer` : prochain ? `Suivant dans ${fmtN(prochain.seuil - chEv.total)} ${CHOC.monnaie.nom}` : 'Terminé', paliers > 0)}
      </div>
    </section>
    ${vChNouveautes()}`;
}

/* Ce que la 3.0 apporte : l'événement est aussi sa vitrine. Les Combats en
   grand, sous le chevalier de leur bandeau ; puis six tuiles illustrées,
   chacune menant à ce qu'elle montre. */
function vChNouveautes() {
  const sec = (secretes || []).find(c => c.img) || (secretes || [])[0];
  const n = niveauDe(cbEtat().xp || 0);
  const deck = cbDeckActif();
  const fond = url => (url ? `<i style="background-image:url('${h(url)}')"></i>` : '');
  const tuile = (attrs, art, titre, texte, cls) => `<button class="ch-nv${cls ? ' ' + cls : ''}" ${attrs}>
      <span class="ch-nv-art">${art}</span>
      <span class="ch-nv-t"><b>${titre}</b><small>${texte}</small></span>
    </button>`;
  return `<section class="ch-nouveau">
    <h3 class="rf-sous">Nouveau dans la 3.0</h3>
    <button class="ch-nv-une" data-tab="combats">
      <span class="ch-nv-une-t"><small>Le grand ajout</small><b>Les Combats</b>
        <span>Choisis ta Section, construis ton deck, et entre dans l'arène.</span>
        <span class="ch-nv-modes"><i>Campagne</i><i>Arcade</i><i>Raid</i><i>Versus</i></span></span>
      <span class="cb-une-go">Jouer</span>
    </button>
    <div class="ch-nv-grille">
      ${tuile('data-cb="vue" data-v="raid"', fond((byId[RAID.boss] || {}).img), 'Le Raid', 'Un boss pour tout le serveur, toute l\'année.', 'raid')}
      ${tuile('data-colvue="speciales" data-tab="collection"', fond(sec && sec.img), 'Les Secrètes', `${(secretes || []).length || 5} cartes au-delà des 122, une finition à part.`, 'secrete')}
      ${tuile('data-cb="niveau"', `<span class="ch-nv-niv" style="--p:${Math.round(100 * n.dans / n.requis)}%"><span><b class="tnum">${n.niveau}</b><small>niveau</small></span></span>`, 'Ton niveau', 'Chaque combat rapporte de l\'XP ; les paliers paient.', 'niv')}
      ${tuile('data-cb="vue" data-v="decks"', fond(TAPIS.t_veste.img.replace('.webp', '-mini.webp')), 'Tapis et sleeves', 'Habille ton plateau et le dos de tes cartes.', 'tapis')}
      ${tuile('data-cb="vue" data-v="decks"', fond(deck && (byId[deck.couverture] || {}).img), 'L\'atelier de decks', 'Trente cartes, dix Essences, un code à partager.', 'deck')}
      ${tuile('data-cb="vue" data-v="guides"', `<span class="ch-nv-ico">${NAVICO.quest}</span>`, 'Le Guide', 'Les règles du combat, en dix pages courtes.', 'guide')}
    </div>
  </section>`;
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
      <p class="muted small">Chaque essai : ${CHOC.epreuve.participation} ${CHOC.monnaie.nom}. Première victoire du jour : +${CHOC.epreuve.victoire} ${CHOC.monnaie.nom}. La donne est la même à chaque essai : apprends-la.</p>
      ${sec ? `<button class="btn cb-lancer ch-lancer" data-ch="ep-go" ${restants ? '' : 'disabled'}>${restants ? `Tenter l'Épreuve · essai ${ep.essais.length + 1}/${ep.max}` : 'Épreuve terminée — nouvelle demain'}</button>`
        : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
    </section>
    ${(ep.top || []).length ? `<section><h3 class="rf-sous">Classement du jour</h3>
      <ol class="rf-top">${ep.top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo, j.xp)}
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
    ${vListeQuetes(qs.filter(q => q.scope === 'ev_jour'), 'choc-jour')}
    <h3 class="rf-sous">De l'événement</h3>
    ${vListeQuetes(qs.filter(q => q.scope === 'ev'), 'choc-ev')}`;
}

/* =====================================================================
   Le Pass
   ===================================================================== */
/* L'icône d'une récompense : celles de Reflets, plus les cosmétiques de
   combat. */
function chIco(x, taille) {
  if (x.type === 'tapis' && TAPIS[x.objet]) return `<img class="ch-ico-tapis" src="${TAPIS[x.objet].img.replace('.webp', '-mini.webp')}" alt="">`;
  if (x.type === 'sleeve' && SLEEVES[x.objet]) return `<img class="ch-ico-sleeve" src="${SLEEVES[x.objet].img}" alt="">`;
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
    const rare = ['cadre', 'titre', 'tapis', 'sleeve', 'brillante'].includes(x.type);
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
  return `${chTitre('Le Pass', `Trente paliers, en ${CHOC.monnaie.nom} gagnés.`)}
    <section class="rf-passtete">
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
    ${vChExclus(piste, total)}
    ${prets > 1 ? `<button class="btn rf-tout" data-ch="pass-tout" data-snd="piece">${NAVICO.check}Tout récupérer · ${prets} paliers</button>` : ''}
    <ol class="rf-pass" style="--fait:${atteint}">${piste.map(ligne).join('')}</ol>`;
}

/* Les trois exclusifs du Pass, en vitrine : ce qu'on vise. */
function vChExclus(piste, total) {
  const l = piste.filter(x => ['sleeve', 'cadre', 'tapis'].includes(x.type));
  if (!l.length) return '';
  const vis = x => x.type === 'tapis' && TAPIS[x.objet] ? `<img class="ch-ex-tapis" src="${TAPIS[x.objet].img.replace('.webp', '-mini.webp')}" alt="">`
    : x.type === 'sleeve' && SLEEVES[x.objet] ? `<img class="ch-ex-sleeve" src="${SLEEVES[x.objet].img}" alt="">`
    : x.type === 'cadre' ? avatarHTML(save.avatar, x.objet, 'xl', maPhoto()) : '';
  return `<section class="ch-exclus">
    <h3 class="rf-sous">Exclusifs du Pass</h3>
    <div class="ch-ex-l">${l.map(x => `<button class="ch-ex${x.pris ? ' pris' : total >= x.seuil ? ' pret' : ''}" data-ch="aller-palier" data-v="${x.palier}">
      <span class="ch-ex-vis">${vis(x)}</span>
      <b>${h(x.titre.replace(/^[^«]*« ?| ?»$/g, ''))}</b><small>${x.pris ? 'Récupéré' : `Palier ${x.palier}`}</small></button>`).join('')}</div>
  </section>`;
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
  if (!RM()) FX.sparkle({ n: 100, colors: ['#62d84e', '#7c3aed', '#f5c451', '#fff'], size: 3.4 });
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
        : `<button class="btn tiny ghost" data-shop="${h(it.id)}" ${chEv.solde < it.prix ? 'disabled' : ''}>${insigneIco}${fmtN(it.prix)}</button>`}
    </article>`;
  };
  return `${chTitre('Boutique', `En ${CHOC.monnaie.nom}, seulement pendant l'événement.`)}
    ${items.length ? `<div class="rf-arts">${items.map(article).join('')}</div>` : '<p class="muted">Chargement de la boutique…</p>'}`;
}

/* =====================================================================
   Le classement
   ===================================================================== */
function vChClassement() {
  const top = chEv.top || [];
  const seg = [['raid', 'Raid'], ['insignes', CHOC.monnaie.nom]]
    .map(([id, nom]) => `<button class="${chClassement === id ? 'on' : ''}" data-ch="classement" data-v="${id}">${nom}</button>`).join('');
  let corps;
  if (chClassement === 'insignes') {
    corps = top.length ? `<ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo, j.xp)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.titre && TITRES[j.titre] ? `<small class="titreligne t${TITRES[j.titre].ton}">${h(TITRES[j.titre].nom)}</small>` : ''}</span>
        <span class="rf-pts tnum">${insigneIco}${fmtN(j.total)}</span></li>`).join('')}</ol>`
      : `<p class="muted">Personne n'a encore gagné d'${CHOC.monnaie.nom} : à toi de commencer.</p>`;
  } else {
    corps = vTopRaid(10) || '<p class="muted">Personne n\'a encore frappé le Sorcier.</p>';
  }
  return `${chTitre('Classement', `Ceux qui frappent le plus fort, et ceux qui gagnent le plus d'${CHOC.monnaie.nom}.`)}
    <div class="segbar ch-seg">${seg}</div>${corps}`;
}

/* =====================================================================
   Les bandeaux : écran Boosters, Combats, Boutique
   ===================================================================== */
function vBandeauChoc(lieu) {
  const ev = save.evenement;
  const fin = ev ? srvTime(ev.fin) : Date.now();
  const n = chocPastille();
  const vers = lieu === 'boutique' ? 'boutique' : 'accueil';
  const sous = lieu === 'boutique' ? `En ${CHOC.monnaie.nom}, pendant l'événement`
    : 'L\'Épreuve du jour, et le Raid en Insignes';
  return `<button class="rfban chban${lieu ? ' ' + lieu : ''}" data-ch="vue" data-v="${vers}" aria-label="Ouvrir l'événement Le Choc des Sections">
    ${chAffiche()}
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
    degats: 214, raid_niveaux: 6, epreuves: 13,
    section: cbEtat().section || 'toxique',
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
    ${chAffiche()}
    <div class="rf-tetehaut">
      <div class="rf-tetenom"><small>Événement terminé · le récap</small><h1>Le Choc<span>des Sections</span></h1></div>
      <div class="rf-tetechiffres">${reste ? `<span class="rf-fin">${NAVICO.clock}<span>encore <b data-rebours="${reste}">${h(dureeCourte(reste - Date.now()))}</b></span></span>` : ''}</div>
    </div>
    ${r && r.apercu ? '<button class="btn tiny ghost rf-quitter" data-ch="recap-quitter">Quitter l\'aperçu</button>' : ''}
  </header>`;
  if (!r) { chargerRecapChoc(); return `<div class="rf ch">${tete}<p class="muted boitecharge">Chargement du récap…</p></div>`; }
  const stat = (ico, val, lib, sous) => `<div class="rr-stat"><span class="rr-ico">${ico}</span>
    <b class="tnum">${val}</b><span>${lib}</span>${sous ? `<small>${sous}</small>` : ''}</div>`;
  const podium = (r.top || []).map((j, i) => `<li class="p${i + 1}${j.moi ? ' moi' : ''}">
      <span class="rr-place">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'lg', j.photo, j.xp)}
      <b>${h(j.pseudo)}</b><small>${insigneIco}${fmtN(j.total)}</small></li>`).join('');
  return `<div class="rf ch">${tete}<div class="rf-page">
    <section class="rr-bilan">
      <h2>Ton bilan</h2>
      <div class="rr-stats">
        ${stat(insigneIco, fmtN(r.total), CHOC.monnaie.nom + ' gagnés', r.rang ? `${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup> sur ${r.joueurs}` : '')}
        ${stat(NAVICO.trophy, `${r.paliers}<small>/${r.paliers_max}</small>`, 'paliers du Pass', r.paliers >= r.paliers_max ? 'Pass terminé' : '')}
        ${stat(NAVICO.foudre, fmtN(r.degats || 0), 'dégâts au Sorcier', `${r.raid_niveaux || 0} niveau${(r.raid_niveaux || 0) > 1 ? 'x' : ''} tombé${(r.raid_niveaux || 0) > 1 ? 's' : ''}`)}
        ${stat(NAVICO.epreuve, r.epreuves || 0, 'Épreuves gagnées', '')}
        ${stat(NAVICO.quest, r.quetes, 'quêtes accomplies', '')}
      </div>
    </section>
    ${podium ? `<section class="rr-podium"><h2>Le podium</h2><ol>${podium}</ol></section>` : ''}
    <section class="rr-continue">
      <h2>Ce qui reste</h2>
      <div class="rr-cartes">
        <button class="rr-lien" data-cb="vue" data-v="raid"><span class="rr-ico">${NAVICO.foudre}</span><b>Le Raid continue</b><small>Le même boss, toute l'année, payé en Éclats.</small></button>
        <button class="rr-lien" data-tab="combats"><span class="rr-ico">${NAVICO.sword}</span><b>Les Combats continuent</b><small>Campagne, Arcade, défis entre amis.</small></button>
        <button class="rr-lien" data-colvue="speciales" data-tab="collection"><span class="rr-ico">${NAVICO.promo}</span><b>Les Secrètes restent</b><small>Une chance dans chaque booster.</small></button>
      </div>
    </section>
  </div></div>`;
}

function vBandeauChocRecap() {
  return `<button class="rfban chban rf-recap" data-tab="choc" aria-label="Voir le récap du Choc des Sections">
    ${chAffiche()}
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
  openSheet({
    title: 'Le Choc des Sections, c\'est fini',
    body: `<div class="rr-pop">
        <div class="rr-poptete">${chArt()}<b>Merci d'avoir joué</b><small>Trois semaines de combats — voici les tiens.</small></div>
        <div class="rr-popstats">
          <div><b class="tnum">${fmtN(r.total)}</b><small>${CHOC.monnaie.nom}</small></div>
          <div><b class="tnum">${r.paliers}/${r.paliers_max}</b><small>Pass</small></div>
          <div><b class="tnum">${fmtN(r.degats || 0)}</b><small>dégâts</small></div>
          ${r.rang ? `<div><b class="tnum">${r.rang}<sup>${r.rang > 1 ? 'e' : 'er'}</sup></b><small>sur ${r.joueurs}</small></div>` : ''}
        </div>
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
    case 'ep-go': return lancerEpreuve();
    case 'ep-deck': return voirDeckEpreuve(v);
    case 'palier': return chReclamer([+v]);
    case 'aller-palier': {
      const el2 = document.getElementById('chpal-' + v);
      if (el2) el2.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    case 'pass-tout': return chReclamer(chEv.piste.filter(p => !p.pris && chEv.total >= p.seuil).map(p => p.palier));
    case 'classement': chClassement = v; return render();
    case 'recap-quitter': return quitterApercuRecapChoc();
  }
}
