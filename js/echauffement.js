/* L'Échauffement (version 2.5) : sept défis, un par jour, après le récap
   de Reflets, dans l'onglet Combats.

   On compose une équipe de trois Joueurs de sa collection, dans l'ordre :
   celui de devant encaisse. Le combat se déroule tout seul, à partir des
   valeurs imprimées sur les cartes, avec un seul geste : le coup d'éclat
   (une fois par combat, toucher un Joueur qui va frapper double son coup).

   Le déroulé : ech_commencer compte l'essai (trois par défi et par jour), le
   combat se joue ici, en direct, avec echCombat ; puis ech_terminer le
   rejoue côté serveur avec le même coup d'éclat, et c'est son résultat qui
   compte. echCombat et ech_simuler (supabase/22b_echauffement.sql) doivent
   rester identiques, à la ligne près ; le faux serveur se sert de echSimuler.

   Trois étoiles à un défi débloquent un indice sur ce qui se prépare : leur
   texte n'est pas ici, le serveur ne l'envoie qu'une fois gagné.

   C'est aussi un événement, sur la charpente de Reflets (supabase/
   22e_echauffement-evenement.sql) : sa monnaie, les Braises, ses quêtes, son
   Pass, sa boutique et son classement ont chacun leur sous-onglet, à côté des
   Défis et des Indices. Après la saison, l'onglet garde L'Échauffement en
   mode sans fin (supabase/22f_sans-fin.sql) : un défi par jour, le même pour
   tous, et trois jours de récap.

   La page prend les couleurs de la suite (graphite et lavande, jetons
   `--e-*` posés sur .ech, en fin de css/hub.css) : une fenêtre sur ce qui
   vient. Le reste du site ne change pas. Règle du propriétaire : chaque vue
   tient dans l'écran, sans défiler. */
"use strict";

let echData = null;
/* L'événement (evenement_etat, supabase/21_reflets.sql) : le total de
   Braises, le Pass, le classement. Chargé en ouvrant l'onglet. */
let echEv = null;
/* Le mode sans fin (ech_sf_etat), et le récap de l'événement (evenement_recap). */
let echSf = null;
let echRecap = null;
let echRecapApercu = null;
let echVue = 'accueil';
let echJour = 0;
let echTri = 'def';
let echOccupe = false;
let echPlace = 0;
let echQVue = 'jour';
let echSfOnglet = 'jour';
/* L'équipe en préparation, défi par défi : [{ carte, a }] (0 : le défi du jour du mode sans fin). */
const echEquipes = {};

const ECH_POS = ['Devant', 'Milieu', 'Derrière'];
const ECH_PRIX = [80, 80, 140];
/* Les Braises de chaque étoile (ech_terminer), et les Éclats du mode sans fin (ech_sf_terminer). */
const ECH_BRAISES = [15, 15, 25];
const ECH_SF_PRIX = [30, 30, 60];
const ECH_NIVEAUX = ['', 'Facile', 'Moyen', 'Difficile', 'Redoutable'];
const ECH_COULEURS = { rose: 'Roses', mauve: 'Mauves', neutre: 'Neutres', orange: 'Orange', violette: 'Violettes', bleue: 'Bleus' };
const echCouleur = c => ECH_COULEURS[c] || (c ? c[0].toUpperCase() + c.slice(1) : '');
/* Ce qu'on dit après un combat raté : la règle du jour, avec ses chiffres. */
const ECH_ASTUCES = {
  aucune: () => 'Devant, celui qui encaisse le mieux ; derrière, ceux qui frappent fort.',
  carapace: d => `Les coups de moins de ${d.param.seuil} ne passent pas : un coup d'éclat peut les doubler.`,
  eclair: () => 'Il frappe à chaque tour : un Joueur solide devant, et finir vite.',
  affinite: d => `Des Joueurs ${echCouleur(d.param.couleur)} : leurs coups comptent double.`,
  riposte: d => `Chaque coup te coûte ${d.param.degats} : peu de coups, mais des gros.`,
  fureur: () => 'Il frappe de plus en plus fort : il faut le battre vite.',
  final: d => `Des coups d'au moins ${d.param.seuil}, le plus vite possible, et le coup d'éclat au bon moment.`
};
/* Le Pass de L'Échauffement : une copie de evt_piste (supabase/22e_echauffement-
   evenement.sql), pour les aperçus du Labo et pour le faux serveur de la démo.
   Le jeu, lui, lit celui du serveur (evenement_etat). */
const ECH_PISTE = [
  [1, 20, 'boosters', 1, null, '1 booster'], [2, 50, 'fragments', 150, null, '150 Fragments'],
  [3, 85, 'titre', 0, 't_ech_round', 'Titre « Premier round »'], [4, 125, 'boosters', 2, null, '2 boosters'],
  [5, 170, 'eclats', 150, null, '150 Éclats'], [6, 220, 'reverse_R', 1, null, 'Une Reverse Rare'],
  [7, 275, 'fragments', 250, null, '250 Fragments'], [8, 335, 'boosters', 2, null, '2 boosters'],
  [9, 400, 'cadre', 0, 'f_braise', 'Cadre « Braise »'], [10, 465, 'fragments', 300, null, '300 Fragments'],
  [11, 530, 'boosters', 2, null, '2 boosters'], [12, 595, 'reverse_R', 1, null, 'Une Reverse Rare'],
  [13, 660, 'eclats', 200, null, '200 Éclats'], [14, 725, 'fragments', 400, null, '400 Fragments'],
  [15, 790, 'brillante', 1, null, 'Une Essence Brillante'], [16, 850, 'boosters', 3, null, '3 boosters'],
  [17, 910, 'eclats', 250, null, '250 Éclats'], [18, 965, 'reverse_R', 2, null, 'Deux Reverses Rares'],
  [19, 1010, 'titre', 0, 't_ech_feu', 'Titre « Feu sacré »'], [20, 1050, 'cadre', 0, 'f_ardeur', 'Cadre « Ardeur »']
].map(([palier, seuil, type, montant, objet, titre]) => ({ palier, seuil, type, montant, objet, titre }));
const ECH_ICO = {
  aucune: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/>',
  carapace: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  affinite: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  riposte: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  fureur: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  final: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'
};
const echIco = r => `<svg class="ech-ico" viewBox="0 0 24 24" aria-hidden="true">${ECH_ICO[r] || ECH_ICO.aucune}</svg>`;

/* ---------- Les valeurs d'un Joueur ---------- */
/* Les attaques qui font des dégâts (celles qui n'ont qu'un effet ne
   comptent pas, comme côté serveur), avec leur coût en élan. */
const echAttaques = c => (c.atks || []).filter(a => a.degats).map(a => ({
  nom: a.nom, degats: a.degats, cout: Object.values(a.cout || {}).reduce((x, y) => x + y, 0)
}));
/* ech_joueurs, côté navigateur. */
const echStats = id => { const c = byId[id]; return c ? { def: c.def, couleur: c.col, attaques: echAttaques(c) } : null; };
const echRythme = n => (n <= 1 ? 'à chaque tour' : `tous les ${n} tours`);
const echPossede = c => mesEx(c.id) > 0 || mesEx('r' + c.id.slice(1)) > 0;
const echJoueurs = () => cards.filter(c => c.cat === 'joueur' && !c.promo && echPossede(c));

/* ---------- Le combat (copie de ech_simuler) ---------- */
/* Pas à pas : c.prets() dit qui frappera au prochain tour, c.tour(i) le joue
   (i : le Joueur qui reçoit le coup d'éclat, ou null) et rend ses lignes de
   journal ; c.fin est posé à la dernière. */
function echCombat(d, equipe, stats) {
  const P = d.param || {}, R = d.regle;
  const aB = stats(d.adversaire).attaques.reduce((m, a) => (a.degats > m.degats ? a : m));
  const coutB = R === 'eclair' ? 1 : aB.cout;
  const al = equipe.map(e => {
    const j = stats(e.carte); const at = j.attaques[e.a || 0];
    return { pv: j.def, def: j.def, col: j.couleur, cout: at ? at.cout : null, deg: at ? at.degats : null, elan: 0 };
  });
  al.forEach(a => { if (al.filter(b => b.col === a.col).length > 1) a.elan = 1; });
  const c = { t: 0, pvB: d.pv, elanB: 0, ko: 0, fureur: 0, eclat: false, fin: null, log: [], al, coutB, aB };
  const finir = g => { c.fin = { gagne: g, tours: c.t, ko: c.ko, etoiles: g ? (c.ko === 0 ? 3 : c.ko === 1 ? 2 : 1) : 0 }; };
  const tombe = (i, ev) => {
    c.ko++; ev.push([c.t, 'ko', i]);
    if (al.every(x => x.pv <= 0)) finir(false);
  };
  c.prets = () => al.map((a, i) => (a.pv > 0 && a.cout != null && a.elan + 1 >= a.cout ? i : -1)).filter(i => i >= 0);
  c.tour = eclatI => {
    if (c.fin) return [];
    const ev = [];
    const t = ++c.t;
    c.elanB++;
    for (let i = 0; i < al.length && !c.fin; i++) {
      const a = al[i];
      if (a.pv <= 0) continue;
      a.elan++;
      if (a.cout == null || a.elan < a.cout) continue;
      a.elan -= a.cout;
      let dd = a.deg;
      if (R === 'affinite' && a.col === P.couleur) dd *= 2;
      if (eclatI === i && !c.eclat) { dd *= 2; c.eclat = true; ev.push([t, 'eclat', i]); }
      if ((R === 'carapace' || R === 'final') && dd < P.seuil) { ev.push([t, 'bloque', i, dd]); continue; }
      c.pvB -= dd; ev.push([t, 'frappe', i, dd, Math.max(0, c.pvB)]);
      if (c.pvB <= 0) { finir(true); break; }
      if (R === 'riposte') {
        a.pv -= P.degats; ev.push([t, 'riposte', i, P.degats, Math.max(0, a.pv)]);
        if (a.pv <= 0) tombe(i, ev);
      }
    }
    if (!c.fin && c.elanB >= coutB) {
      c.elanB -= coutB;
      const i = al.findIndex(x => x.pv > 0);
      const dd = aB.degats + c.fureur;
      if (R === 'fureur' || R === 'final') c.fureur += P.plus;
      al[i].pv -= dd; ev.push([t, 'subit', i, dd, Math.max(0, al[i].pv)]);
      if (al[i].pv <= 0) tombe(i, ev);
    }
    if (!c.fin && t >= 10) finir(false);
    c.log.push(...ev);
    return ev;
  };
  return c;
}
/* Le combat d'une traite, avec un coup d'éclat décidé d'avance. */
function echSimuler(d, equipe, stats, eclat) {
  const c = echCombat(d, equipe, stats);
  while (!c.fin) c.tour(eclat && eclat.tour === c.t + 1 ? eclat.i : null);
  return Object.assign({}, c.fin, { log: c.log });
}

/* ---------- L'état ---------- */
/* La saison : ses sept défis se jouent. */
function echActif() {
  if (!echData || !echData.ouvert) return false;
  return Date.now() < Date.parse(echData.fin);
}
/* L'événement : sa monnaie, ses quêtes, son Pass (la ligne `echauffement`
   d'evenements, calée sur la saison). */
const echEnCours = () => (echData && echData.apercu ? !!echEv : evenementEnCours() === 'echauffement');
/* Après la saison : le défi du jour. */
const echSfActif = () => !!(echSf && echSf.ouvert);
/* Les trois jours de récap (me() › recap), ou l'aperçu du Labo. */
const echRecapEnCours = () => echRecapApercu
  || (save && save.recap && save.recap.code === 'echauffement' && !evenementEnCours() ? save.recap : null);

/* Ce qui attend dans l'onglet de l'événement, sous-onglet par sous-onglet. */
const echQuetesPretes = () => (save.quetes || []).filter(q => q.evenement === 'echauffement' && !q.claimed && q.progress >= q.goal).length;
const echPaliersPrets = () => (echEv ? echEv.piste.filter(x => !x.pris && echEv.total >= x.seuil).length : 0);
/* La pastille de Combats : les défis ouverts pas encore gagnés, les quêtes et
   les paliers à récupérer ; après la saison, le défi du jour pas encore gagné. */
function echPastille() {
  if (echActif()) return echData.defis.filter(d => !d.etoiles).length + echQuetesPretes() + echPaliersPrets();
  if (echSfActif()) return echSf.defi && !echSf.defi.etoiles ? 1 : 0;
  return 0;
}
/* `avecEv` : en ouvrant l'onglet. Lire l'état de l'événement accomplit
   « À l'entraînement » (evenement_etat) : seulement quand on vient le voir. */
async function chargerEch(avecEv) {
  /* L'aperçu du Labo garde son état inventé jusqu'à « Revenir à l'état réel ». */
  if (Backend.mode !== 'cloud' || !save || (echData && echData.apercu)) return;
  const ev = avecEv || tab === 'combats';
  try {
    const [e, v, sf] = await Promise.all([
      Backend.echEtat(),
      ev && evenementEnCours() === 'echauffement' ? Backend.evenementEtat().catch(() => null) : null,
      /* Absente tant que la base n'a pas reçu MAJ-2.5.sql : rien de grave. */
      Backend.echSfEtat().catch(() => null)
    ]);
    echData = e;
    if (v && v.code === 'echauffement') echEv = v;
    else if (evenementEnCours() !== 'echauffement') echEv = null;
    echSf = sf;
    /* Minuit à Paris : le prochain adversaire (prochaineBascule, js/booster.js). */
    if (sf && sf.ouvert) sf._fin = Date.now() + resteAvantRemise('daily') + 2000;
    const visite = (save.quetes || []).find(q => q.id === 'ej_visite');
    if (v && visite && !visite.progress) await Backend.pull().catch(() => {});
    if (echRecapEnCours() && !echRecapApercu && (!echRecap || ev)) echRecap = await Backend.rpc('evenement_recap').catch(() => echRecap);
    if (ev && evenementEnCours() === 'echauffement' && !Backend.shop.length) await Backend.loadShop().catch(() => {});
  } catch (err) { return; }
  if ((tab === 'combats' || tab === 'boosters') && !echOccupe) render();
  else if (typeof majDiscrete === 'function') majDiscrete(false);
}
const echDuJour = () => echData.defis[echData.defis.length - 1];
/* Le défi du jour du mode sans fin, sous la forme d'un défi de la saison :
   `jour` 0, et `sf` pour le reconnaître. */
const echSfDefi = () => (echSf && echSf.defi ? Object.assign({ jour: 0, sf: true }, echSf.defi) : null);
function echDefi() {
  if (echJour === 0 && echSfDefi()) return echSfDefi();
  const l = echData.defis;
  if (!l.some(d => d.jour === echJour)) echJour = (echDuJour() || {}).jour || 1;
  return l.find(d => d.jour === echJour);
}
function echEquipe(d) {
  if (!echEquipes[d.jour]) echEquipes[d.jour] = (d.equipe || []).filter(e => byId[e.carte] && echPossede(byId[e.carte])).map(e => ({ carte: e.carte, a: e.a || 0 }));
  return echEquipes[d.jour];
}
const echRestants = d => Math.max(0, ((d.sf ? echSf : echData).essais_max || 3) - (d.essais_jour || 0));
const echEtoiles = (n, cls) => `<span class="ech-et ${cls || ''}" role="img" aria-label="${n} étoile${n > 1 ? 's' : ''} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
const echAdvAttaque = (d, adv) => {
  const a = echAttaques(adv).reduce((m, x) => (x.degats > m.degats ? x : m));
  return Object.assign({}, a, { cout: d.regle === 'eclair' ? 1 : a.cout });
};
const echIndice = j => (echData.indices || []).find(x => x.jour === j);
/* L'illustration seule d'une carte, recadrée : le cadre ne se voit jamais. */
const echIllu = (c, fx, fy, cls) => (c && c.img
  ? `<span class="ech-illu ${cls || ''}" style="--fx:${fx == null ? .5 : fx};--fy:${fy == null ? .3 : fy}" aria-hidden="true"><img src="${c.img}" alt="" decoding="async"></span>`
  : '');

/* ---------- Un indice ---------- */
/* Le visuel d'un indice, dans une case de carte ou en grand : un nombre, un
   mot (sa taille suit sa longueur, --l, pour tenir dans la case), des
   étoiles, l'ombre d'une carte, la teinte de la suite, un éventail de dos. */
function vIndiceVisuel(x) {
  const v = x.visuel || {};
  if (v.type === 'etoiles') return `<span class="ech-iv etoiles">${Array.from({ length: v.valeur || 5 }, (_, i) => `<i class="${i >= 3 ? 'au-dela' : ''}">★</i>`).join('')}</span>`;
  if (v.type === 'carte' && byId[v.carte]) return `<span class="ech-iv carte">${echIllu(byId[v.carte], .5, .3)}</span>`;
  if (v.type === 'teinte') return '<span class="ech-iv teinte"><i>✦</i></span>';
  if (v.type === 'eventail') return `<span class="ech-iv eventail">${[0, 1, 2].map(() => `<img src="${ART.back}" alt="">`).join('')}</span>`;
  const t = String(v.valeur || '');
  return `<span class="ech-iv ${v.type === 'nombre' ? 'nombre' : 'mot'}" style="--l:${Math.max(2, [...t].length)}">${h(t)}</span>`;
}
function montrerIndice(j) {
  const x = echIndice(j);
  if (!x) return;
  openSheet({
    title: j ? `Indice ${j}` : 'Le dernier mot',
    body: `<div class="ech-ind-grand">${vIndiceVisuel(x)}<b>${h(x.titre)}</b><p>${h(x.texte)}</p></div>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

/* ---------- L'accueil ---------- */
/* Règle du propriétaire : chaque vue de l'événement tient dans l'écran, sans
   défiler, de 360 × 740 à l'ordinateur en passant par 375 × 667. La page
   prend toute la hauteur de #main (.ech, height:100%), le bandeau une part
   fixe, et chaque sous-onglet mesure ses tuiles sur la place qui reste
   (container queries, css/hub.css). Le bandeau : l'illustration de « La
   Luxueuse III » (#122), le médaillon d'or au bout de sa chaîne. */
let echOnglet = 'defis';
/* Les sous-onglets de la saison. Ceux de l'événement (Pass, Quêtes, Boutique,
   Classement) n'existent que si le serveur l'a : sans MAJ-2.5.sql, la page
   reste celle des sept défis. */
const ECH_ONGLETS = [['defis', 'Défis'], ['pass', 'Pass'], ['quetes', 'Quêtes'], ['boutique', 'Boutique'],
  ['classement', 'Classement'], ['indices', 'Indices']];
const echOngletsDispo = () => ECH_ONGLETS.filter(([k]) => echEv || k === 'defis' || k === 'indices');

function vEchauffement() {
  return echVue === 'defi' ? vEchDefi() : vEchAccueil();
}

/* Le solde de Braises, posé dans le bandeau. */
const echSolde = () => `<span class="ech-solde" aria-label="${fmtN(save.prismes || 0)} ${MONNAIES_EV.echauffement.nom}">${braiseIco}<b class="tnum">${fmtN(save.prismes || 0)}</b></span>`;

function vEchAccueil() {
  const s = echData;
  const reste = Date.parse(s.fin) - Date.now();
  const etoiles = s.etoiles || 0;
  const dispo = echOngletsDispo();
  if (!dispo.some(([k]) => k === echOnglet)) echOnglet = 'defis';
  const corps = { indices: vEchIndices, pass: vEchPass, quetes: vEchQuetes, boutique: vEchBoutique,
    classement: vEchClassement }[echOnglet] || vEchDefis;
  const pastille = k => {
    const n = k === 'pass' ? echPaliersPrets() : k === 'quetes' ? echQuetesPretes() : 0;
    return n ? `<i class="ech-on-n">${n}</i>` : '';
  };
  return `<section class="ech">
    <header class="ech-hero">
      ${echIllu(byId.c122, .6, .4, 'fond')}
      <span class="ech-hero-haut"><span class="ech-kick">Événement · ${h(dureeCourte(reste))}</span>
        <span class="ech-hero-d">${echEv ? echSolde() : ''}
        <span class="ech-anneau" style="--p:${Math.round(etoiles / 21 * 100)}%" aria-label="${etoiles} étoiles sur 21"><b class="tnum">${etoiles}</b><small>/21</small></span></span></span>
      <span class="ech-hero-bas"><h2 class="ech-titre">L'Échauffement</h2><small>Sept défis, un par jour.</small></span>
    </header>
    <nav class="ech-onglets" role="tablist">${dispo.map(([k, n]) => `<button role="tab" data-ech="onglet" data-o="${k}" class="${echOnglet === k ? 'on' : ''}" aria-selected="${echOnglet === k}">${n}${pastille(k)}</button>`).join('')}</nav>
    <div class="ech-corps">${corps()}</div>
  </section>`;
}

/* Le défi du jour, les sept, et les deux bonus de la saison. */
function vEchDefis() {
  const s = echData;
  const dj = echDuJour();
  const adv = byId[dj.adversaire];
  const total = s.total || 7;
  const jours = Array.from({ length: total }, (_, i) => {
    const j = i + 1;
    const x = s.defis.find(y => y.jour === j);
    if (!x) return `<span class="ech-jour ferme" aria-label="Défi ${j}, pas encore ouvert"><i>${NAVICO.lock}</i><span class="ech-et"></span></span>`;
    return `<button class="ech-jour ${x.etoiles === 3 ? 'fini' : x.etoiles ? 'gagne' : ''}" data-ech="defi" data-j="${j}" aria-label="Défi ${j}">
      <i>${j}</i>${echEtoiles(x.etoiles)}</button>`;
  }).join('');
  const pris = s.paliers || [];
  const bonus = (ok, ico, titre, quoi, v, max) => `<span class="ech-bon${ok ? ' ok' : ''}">
      <span class="ech-bon-ico">${ok ? NAVICO.check : ico}</span>
      <span class="ech-bon-txt"><b>${titre}</b><small>${quoi}</small></span>
      <em class="tnum">${ok ? 'Obtenu' : `${v}/${max}`}</em></span>`;
  return `<button class="ech-porte" data-ech="defi" data-j="${dj.jour}">
      ${echIllu(adv, .55, .3, 'fond')}
      <span class="ech-porte-txt">
        <small>Défi ${dj.jour} · aujourd'hui</small>
        <b>${h(adv.nom)}</b>
        <span class="ech-porte-regle">${echIco(dj.regle)}${h(dj.titre)}</span>
        ${echEtoiles(dj.etoiles)}
      </span>
      <span class="ech-porte-cta">${dj.etoiles === 3 ? 'Revoir' : 'Relever'}</span>
    </button>
    <div class="ech-jours">${jours}</div>
    <div class="ech-bonus">
      ${bonus(pris.includes('sept'), `<img src="${ART.seal}" alt="">`, 'Les sept défis', '3 boosters', s.gagnes || 0, total)}
      ${bonus(pris.includes('parfait'), NAVICO.star, '21 étoiles', `titre ${h((TITRES.t_echauffe || {}).nom || 'Échauffé')}`, s.etoiles || 0, total * 3)}
    </div>`;
}

/* Le carnet : huit cases de carte, en deux rangées de quatre — un indice par
   défi réussi à trois étoiles, et le dernier mot, quand les sept le sont. */
function vEchIndices() {
  const s = echData;
  const total = s.total || 7;
  const n = (s.indices || []).filter(x => x.jour > 0).length;
  const cas = (j, x, verrou) => (x
    ? `<button class="ech-case" data-ech="indice" data-j="${j}" aria-label="${j ? 'Indice ' + j : 'Le dernier mot'} : ${h(x.titre)}"><span class="ech-ind ouvert">${vIndiceVisuel(x)}</span><small>${h(x.titre)}</small></button>`
    : `<span class="ech-case" aria-label="${verrou}"><span class="ech-ind"><img src="${ART.back}" alt="">${NAVICO.lock}</span><small>${j ? 'Défi ' + j : 'Les sept'}</small></span>`);
  const tuiles = Array.from({ length: total }, (_, i) => cas(i + 1, echIndice(i + 1), `Indice ${i + 1}, à gagner`)).join('')
    + cas(0, echIndice(0), 'Le dernier mot, quand les sept sont à trois étoiles');
  return `<p class="ech-mini">Trois étoiles à un défi : son indice sur ce qui se prépare. <b class="tnum">${n}/${total}</b></p>
    <div class="ech-inds">${tuiles}</div>`;
}

/* ---------- Le Pass ---------- */
/* Vingt médaillons, en grille : tout tient dans l'écran (règle du
   propriétaire). Un médaillon se touche : ce qu'il donne, et « Récupérer ». */
const ECH_TYPE_NOM = { boosters: 'Boosters', eclats: MONNAIE.nom, fragments: FRAGMENTS.nom, titre: 'Titre', cadre: 'Cadre',
  reverse_R: 'Reverse', brillante: 'Brillante' };
function echPalIco(x, taille) {
  if (x.type === 'eclats') return shardIco;
  if (x.type === 'boosters') return `<img src="${ART.seal}" alt="">`;
  if (x.type === 'cadre') return avatarHTML(save.avatar, x.objet, taille || 'sm', maPhoto());
  if (x.type === 'titre') return `<i class="ech-pal-titre">${NAVICO.user}</i>`;
  if (x.type === 'fragments') return NAVICO.fragment;
  if (x.type === 'reverse_R') return NAVICO.reflets;
  return NAVICO.promo;
}
/* Ce qu'on lit sous un médaillon : le montant, ou le genre. */
const echPalMot = x => (x.type === 'boosters' ? `×${x.montant}` : x.type === 'eclats' || x.type === 'fragments' ? fmtN(x.montant)
  : x.type === 'reverse_R' && x.montant > 1 ? '×2' : ECH_TYPE_NOM[x.type] || '');

function vEchPass() {
  const v = echEv;
  if (!v) return '<p class="ech-mini">Chargement du Pass…</p>';
  const total = v.total || 0;
  const piste = v.piste;
  const atteint = piste.filter(x => total >= x.seuil).length;
  const prochain = piste.find(x => total < x.seuil);
  const avant = prochain ? (piste[prochain.palier - 2] || { seuil: 0 }).seuil : 0;
  const pct = prochain ? Math.round((total - avant) / (prochain.seuil - avant) * 100) : 100;
  const prets = echPaliersPrets();
  const med = x => {
    const ok = total >= x.seuil;
    const etat = x.pris ? 'pris' : ok ? 'pret' : x === prochain ? 'prochain' : 'loin';
    const rare = x.type === 'cadre' || x.type === 'titre' || x.type === 'brillante';
    return `<li><button class="ech-pal ${etat}${rare ? ' rare' : ''}" data-ech="palier" data-p="${x.palier}" aria-label="Palier ${x.palier} : ${h(x.titre)}${x.pris ? ', récupéré' : ok ? ', à récupérer' : ''}">
      <span class="ech-pal-ico">${echPalIco(x)}</span>
      <small class="ech-pal-mot">${h(echPalMot(x))}</small>
      <i class="ech-pal-n tnum">${x.pris ? NAVICO.check : x.palier}</i></button></li>`;
  };
  return `<div class="ech-pass-tete">
      <span class="ech-pass-niv"><small>Palier</small><b class="tnum">${atteint}<i>/${piste.length}</i></b></span>
      <span class="ech-pass-j">
        <span class="ech-pass-ch">${braiseIco}<b class="tnum">${fmtN(total)}</b> gagnées<small>${prochain ? `encore <b class="tnum">${fmtN(prochain.seuil - total)}</b>` : 'Pass terminé'}</small></span>
        <span class="ech-rj lav"><i style="width:${pct}%"></i></span>
      </span>
      ${prets ? `<button class="ech-pass-tout" data-ech="pass-tout" data-snd="piece">${prets > 1 ? `Tout récupérer · ${prets}` : 'Récupérer'}</button>` : ''}
    </div>
    <ol class="ech-pass">${piste.map(med).join('')}</ol>
    <p class="ech-mini">Chaque Braise gagnée fait avancer le Pass ; dépenser en boutique ne le fait pas reculer.</p>`;
}

/* La fiche d'un palier : ce qu'il donne, et le bouton s'il est atteint. */
function montrerPalierEch(n) {
  const v = echEv;
  const x = v && v.piste.find(p => p.palier === n);
  if (!x) return;
  const ok = v.total >= x.seuil;
  openSheet({
    title: `Palier ${x.palier}`,
    body: `<div class="rf-gain ech-gain">
        <span class="rf-gainico ech-gainico">${echPalIco(x, 'md')}</span>
        <b>${h(x.titre)}</b>
        <p class="muted small">${x.pris ? 'Déjà récupéré.' : ok ? 'Atteint : il t\'attend.'
          : `À ${fmtN(x.seuil)} ${MONNAIES_EV.echauffement.nom} gagnées : encore ${fmtN(x.seuil - v.total)}.`}
          ${x.type === 'titre' || x.type === 'cadre' ? ' À choisir ensuite dans ton profil.' : ''}</p>
      </div>`,
    actions: !x.pris && ok
      ? [{ label: 'Récupérer', primary: true, fn: () => { closeSheet(); echReclamer([x]); } }, { label: 'Fermer', fn: closeSheet }]
      : [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

/* Un ou plusieurs paliers, puis une seule fenêtre (piste_reclamer). */
async function echReclamer(l) {
  if (!l.length || (echData && echData.apercu)) return l.length && toast('Aperçu du Labo : rien n\'est récupéré.');
  occupe(true);
  const pris = [];
  let cartes = [];
  try {
    for (const x of l) { cartes = cartes.concat(await Backend.pisteReclamer(x.palier) || []); pris.push(x); }
  } catch (e) {
    toast(e.message || 'Un palier n\'a pas pu être récupéré.');
    SFX.jouer('erreur');
  }
  try { const v = await Backend.evenementEtat(); if (v && v.code === 'echauffement') echEv = v; } catch (e) { /* l'ancien suffit */ }
  occupe(false);
  if (!pris.length) return render();
  SFX.jouer('gagne');
  if (!RM()) FX.sparkle({ n: 100, colors: ['#ffcf8a', '#c8b4ff', '#8a78f5', '#fff'], size: 3.4 });
  const ks = cartes.map(id => byId[id]).filter(Boolean);
  const boosters = pris.some(x => x.type === 'boosters');
  openSheet({
    title: pris.length > 1 ? `${pris.length} paliers récupérés` : `Palier ${pris[0].palier}`,
    body: `<div class="rf-gain ech-gain">
        ${ks.length ? `<div class="rf-gaincartes">${ks.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>` : ''}
        <ul class="rf-gainliste">${pris.map(x => `<li><span class="rf-palico">${echPalIco(x)}</span>${h(x.titre)}</li>`).join('')}</ul>
      </div>`,
    actions: boosters
      ? [{ label: 'Ouvrir mes boosters', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
         { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
      : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
  });
}

/* ---------- Les quêtes ---------- */
/* Deux listes, du jour et de l'événement : une ligne par quête, pour tenir
   dans l'écran. Une ligne se touche : son détail. */
function vEchQuetes() {
  const qs = (save.quetes || []).filter(q => q.evenement === 'echauffement');
  const jour = qs.filter(q => q.scope === 'ev_jour'), ev = qs.filter(q => q.scope === 'ev');
  const l = trierQuetes(echQVue === 'ev' ? ev : jour);
  const pret = q => !q.claimed && q.progress >= q.goal;
  const n = l2 => l2.filter(pret).length;
  const ligne = q => `<li class="ech-qt${q.claimed ? ' fait' : pret(q) ? ' pret' : ''}">
      <span class="ech-q-ico">${NAVICO[q.claimed || pret(q) ? 'check' : QICO[q.metric] || 'quest']}</span>
      <button class="ech-q-txt" data-ech="quete" data-q="${h(q.id)}"><b>${h(q.titre)}</b>
        ${q.claimed ? '<small>Récupérée</small>' : `<span class="ech-q-bar"><i style="width:${Math.min(100, Math.round(q.progress / q.goal * 100))}%"></i></span>`}</button>
      ${pret(q) ? `<button class="ech-q-btn" data-quete="${h(q.id)}" data-snd="piece">${braiseIco}${fmtN(q.reward)}</button>`
        : `<span class="ech-q-gain">${q.claimed ? '' : `<small class="tnum">${fmtN(q.progress)}/${fmtN(q.goal)}</small>`}${braiseIco}${fmtN(q.reward)}</span>`}
    </li>`;
  return `<div class="segbar ech-seg">
      <button data-ech="qvue" data-o="jour" class="${echQVue !== 'ev' ? 'on' : ''}">Du jour${n(jour) ? `<i class="ech-on-n">${n(jour)}</i>` : ''}</button>
      <button data-ech="qvue" data-o="ev" class="${echQVue === 'ev' ? 'on' : ''}">De l'événement${n(ev) ? `<i class="ech-on-n">${n(ev)}</i>` : ''}</button>
    </div>
    ${l.length ? `<ol class="ech-qs">${l.map(ligne).join('')}</ol>` : '<p class="ech-mini">Pas de quête pour l\'instant.</p>'}
    <p class="ech-mini">${echQVue === 'ev' ? 'Une fois pour tout l\'événement.' : `Nouvelles dans ${h(dureeCourte(resteAvantRemise('daily')))}.`}
      Elles paient en ${MONNAIES_EV.echauffement.nom}.</p>`;
}
function montrerQueteEch(id) {
  const q = (save.quetes || []).find(x => x.id === id);
  if (!q) return;
  const pret = !q.claimed && q.progress >= q.goal;
  openSheet({
    title: q.titre,
    body: `<p>${h(q.detail)}</p><p class="muted small">${q.claimed ? 'Récupérée.' : `${fmtN(q.progress)} sur ${fmtN(q.goal)}.`}
      Elle rapporte ${fmtN(q.reward)} ${MONNAIES_EV.echauffement.nom}.</p>`,
    actions: pret ? [{ label: 'Récupérer', primary: true, fn: () => { closeSheet(); echEncaisser(q.id); } },
      { label: 'Fermer', fn: closeSheet }] : [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}
const echEncaisser = id => agir(() => Backend.claimQuest(id), 'Récompense encaissée.').then(ok => { if (ok) chargerEch(true); });

/* ---------- La boutique ---------- */
function vEchBoutique() {
  const items = (Backend.shop || []).filter(it => it.evenement === 'echauffement');
  if (!items.length) return '<p class="ech-mini">Chargement de la boutique…</p>';
  const solde = save.prismes || 0;
  const art = it => {
    const deja = (save.inv || {})[it.id] || 0;
    const fini = it.unique_buy ? deja > 0 : it.limite != null && deja >= it.limite;
    const reste = it.limite != null && !it.unique_buy ? `${it.limite - deja}/${it.limite}` : it.unique_buy ? 'Exclusif' : '';
    const vis = TITRES[it.id] ? `<span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span>`
      : it.effet === 'tickets' ? `<img src="${ART.seal}" alt=""><i class="ech-art-x">×${it.montant}</i>`
      : it.effet === 'fragments' ? NAVICO.fragment : it.effet === 'reverse_R' ? NAVICO.reflets : NAVICO.star;
    return `<button class="ech-art${fini ? ' fini' : solde < it.prix ? ' cher' : ''}" ${fini ? 'disabled' : `data-shop="${h(it.id)}"`}>
      <span class="ech-art-vis">${vis}</span>
      <b>${h(it.titre)}</b>
      ${reste ? `<small>${fini && !it.unique_buy ? 'Épuisé' : reste}</small>` : ''}
      <span class="ech-art-prix">${fini ? 'Acquis' : `${braiseIco}${fmtN(it.prix)}`}</span>
    </button>`;
  };
  return `<p class="ech-mini">En ${MONNAIES_EV.echauffement.nom}, seulement pendant l'événement. Il t'en reste ${braiseIco}<b class="tnum">${fmtN(solde)}</b>.</p>
    <div class="ech-arts">${items.map(art).join('')}</div>`;
}

/* ---------- Le classement ---------- */
/* Ceux qui ont gagné le plus de Braises ; et sa place, si on n'est pas dans
   les dix. */
function vEchClassement(liste, unite, vide, moi) {
  const top = liste || (echEv && echEv.top) || [];
  const u = unite || braiseIco;
  const r = moi || (echEv ? { rang: echEv.rang, joueurs: echEv.joueurs, total: echEv.total } : null);
  const ligne = (j, i) => `<li class="${j.moi ? 'moi' : ''}"><span class="ech-rang r${i + 1}">${i + 1}</span>
      ${avatarHTML(j.avatar, j.frame, 'sm', j.photo)}<span class="ech-top-nom"><b>${h(j.pseudo)}</b>${j.titre && TITRES[j.titre] ? `<small class="titreligne t${TITRES[j.titre].ton}">${h(TITRES[j.titre].nom)}</small>` : ''}</span>
      <span class="ech-top-pts tnum">${u}${fmtN(j.total)}</span></li>`;
  return `${top.length ? `<ol class="ech-top">${top.map(ligne).join('')}</ol>` : `<p class="ech-mini">${vide || 'Personne n\'a encore gagné de Braises : à toi de commencer.'}</p>`}
    ${r && r.rang && !top.some(j => j.moi) ? `<p class="ech-mini">Ta place : <b class="tnum">${r.rang}<sup>e</sup></b>${r.joueurs ? ` sur ${fmtN(r.joueurs)}` : ''}, avec ${fmtN(r.total)}.</p>` : ''}`;
}

/* =====================================================================
   Après la saison : le mode sans fin, et le récap
   ===================================================================== */
const ECH_SF_ONGLETS = [['jour', 'Défi du jour'], ['classement', 'Classement'], ['indices', 'Indices'], ['recap', 'Le récap']];

function vEchSansFin() {
  if (echVue === 'defi' && echJour === 0 && echSfDefi()) return vEchDefi();
  const sf = echSf;
  const recap = echRecapEnCours();
  const dispo = ECH_SF_ONGLETS.filter(([k]) => (k === 'recap' ? !!recap : k === 'jour' || k === 'classement' ? echSfActif() : !!echData));
  if (!dispo.some(([k]) => k === echSfOnglet)) echSfOnglet = dispo.length ? dispo[0][0] : 'jour';
  const corps = { jour: vEchSfJour, classement: vEchSfClassement, indices: vEchIndices, recap: vEchRecap }[echSfOnglet] || vEchSfJour;
  const serie = sf && sf.serie || 0;
  return `<section class="ech">
    <header class="ech-hero">
      ${echIllu(byId.c122, .6, .4, 'fond')}
      <span class="ech-hero-haut"><span class="ech-kick">${recap ? 'Événement terminé · le récap' : 'L\'Échauffement continue'}</span>
        <span class="ech-hero-d">${serie ? `<span class="ech-solde serie" aria-label="Série de ${serie} jour${serie > 1 ? 's' : ''}">${NAVICO.sword}<b class="tnum">${serie}</b></span>` : ''}
        ${echSfOnglet === 'recap' && (echRecapApercu || echRecap) ? (r => `<span class="ech-anneau" style="--p:${Math.round((r.etoiles || 0) / 21 * 100)}%" aria-label="${r.etoiles || 0} étoiles sur 21"><b class="tnum">${r.etoiles || 0}</b><small>/21</small></span>`)(echRecapApercu || echRecap)
          : sf && sf.defi ? `<span class="ech-anneau" style="--p:${Math.round((sf.defi.etoiles || 0) / 3 * 100)}%" aria-label="${sf.defi.etoiles || 0} étoile sur 3 aujourd'hui"><b class="tnum">${sf.defi.etoiles || 0}</b><small>/3</small></span>` : ''}</span></span>
      <span class="ech-hero-bas"><h2 class="ech-titre">${echSfOnglet === 'recap' ? 'L\'Échauffement' : 'Le défi du jour'}</h2><small>${echSfOnglet === 'recap' ? 'Neuf jours, sept défis : ton bilan.' : 'Un adversaire par jour, le même pour tous.'}</small></span>
    </header>
    ${dispo.length > 1 ? `<nav class="ech-onglets" role="tablist">${dispo.map(([k, n]) => `<button role="tab" data-ech="sf-onglet" data-o="${k}" class="${echSfOnglet === k ? 'on' : ''}" aria-selected="${echSfOnglet === k}">${n}</button>`).join('')}</nav>` : ''}
    <div class="ech-corps">${corps()}</div>
  </section>`;
}

/* Le niveau du jour, en quatre crans. */
const echNiveau = n => `<span class="ech-niv n${n}" aria-label="Niveau ${h(ECH_NIVEAUX[n] || '')}">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<em>${h(ECH_NIVEAUX[n] || '')}</em></span>`;

function vEchSfJour() {
  const sf = echSf;
  if (!echSfActif()) return '<p class="ech-mini">Le défi du jour commence à la fin de la saison.</p>';
  const d = echSfDefi();
  const adv = byId[d.adversaire];
  const tuile = (v, lib, sous, mot) => `<span class="ech-sf-t"><b class="tnum${mot ? ' mot' : ''}">${v}</b><small>${lib}</small>${sous ? `<em>${sous}</em>` : ''}</span>`;
  return `<button class="ech-porte" data-ech="sf-defi">
      ${adv ? echIllu(adv, .55, .3, 'fond') : ''}
      <span class="ech-porte-txt">
        <small>Jour ${fmtN(sf.n)} · ${echNiveau(d.niveau)}</small>
        <b>${h(adv ? adv.nom : d.adversaire)}</b>
        <span class="ech-porte-regle">${echIco(d.regle)}${h(d.titre)}</span>
        ${echEtoiles(d.etoiles)}
      </span>
      <span class="ech-porte-cta">${d.etoiles === 3 ? 'Revoir' : echRestants(d) ? 'Relever' : 'Voir'}</span>
    </button>
    <div class="ech-sf-ts">
      ${tuile(sf.serie || 0, 'jours d\'affilée', '')}
      ${tuile(sf.victoires || 0, 'défis gagnés', `${fmtN(sf.etoiles || 0)} ★ en tout`)}
      ${tuile(sf.demain ? echNiveau(sf.demain) : '—', 'demain', `dans ${h(dureeCourte(resteAvantRemise('daily')))}`, true)}
    </div>
    <p class="ech-mini">★ ${ECH_SF_PRIX[0]} · ★★ ${ECH_SF_PRIX[1]} · ★★★ ${ECH_SF_PRIX[2]} ${MONNAIE.nom} chaque jour · trois essais.</p>`;
}

function vEchSfClassement() {
  const sf = echSf || {};
  return `<p class="ech-mini">Les étoiles gagnées au défi du jour, depuis le début.</p>
    ${vEchClassement(sf.top || [], '<i class="ech-top-et">★</i>', 'Personne n\'a encore d\'étoile : à toi de commencer.',
      { rang: sf.rang, total: sf.etoiles })}`;
}

/* Le récap, trois jours après la saison : son bilan, le podium, et la suite
   (le défi du jour) — c'est ici, et dans la fenêtre de fin, qu'on l'explique. */
function vEchRecap() {
  const r = echRecapApercu || echRecap;
  if (!r) { chargerEch(true); return '<p class="ech-mini">Chargement du récap…</p>'; }
  const stat = (v, lib, sous) => `<span class="ech-rc"><b class="tnum">${v}</b><small>${lib}</small>${sous ? `<em>${sous}</em>` : ''}</span>`;
  const podium = (r.top || []).map((j, i) => `<li class="p${i + 1}${j.moi ? ' moi' : ''}">${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
      <b>${h(j.pseudo)}</b><small>${braiseIco}${fmtN(j.total)}</small><span class="ech-rang r${i + 1}">${i + 1}</span></li>`).join('');
  return `<div class="ech-rcs">
      ${stat(`${braiseIco}${fmtN(r.total || 0)}`, MONNAIES_EV.echauffement.nom, r.rang ? `${r.rang}<sup>e</sup> sur ${fmtN(r.joueurs)}` : '')}
      ${stat(`${r.paliers || 0}<i>/${r.paliers_max || 20}</i>`, 'paliers du Pass', '')}
      ${stat(`${r.etoiles || 0}<i>/${(r.defis || 7) * 3}</i>`, 'étoiles', `${r.gagnes || 0} défi${(r.gagnes || 0) > 1 ? 's' : ''} gagné${(r.gagnes || 0) > 1 ? 's' : ''}`)}
      ${stat(`${r.parfaits || 0}<i>/${r.defis || 7}</i>`, 'indices', '')}
      ${stat(fmtN(r.combats || 0), 'combats', '')}
      ${stat(fmtN(r.quetes || 0), 'quêtes', '')}
    </div>
    ${podium ? `<ol class="ech-podium">${podium}</ol>` : ''}
    <button class="ech-suite" data-ech="sf-onglet" data-o="jour">
      <span class="ech-suite-ico">${NAVICO.sword}</span>
      <span><b>L'Échauffement continue</b><small>Un défi par jour, le même pour tous, de Facile à Redoutable : jusqu'à ${ECH_SF_PRIX.reduce((a, b) => a + b, 0)} ${MONNAIE.nom}, trois essais.</small></span>
      <span class="ech-ban-fl" aria-hidden="true">›</span>
    </button>`;
}

/* ---------- Le défi ---------- */
/* Une attaque, dans une place : ses dégâts (doublés par l'Affinité, barrés si
   la Carapace les arrête) et son coût en élan, un point par tour. */
function echChoixAttaque(d, c, e, i) {
  const at = echAttaques(c);
  if (!at.length) return '<span class="ech-atq"><span class="ech-a seule"><b>—</b></span></span><small class="ech-ryt">ne frappe pas</small>';
  const affin = d.regle === 'affinite' && c.col === d.param.couleur;
  const pastille = (a, k) => {
    const dg = affin ? a.degats * 2 : a.degats;
    const bloque = (d.regle === 'carapace' || d.regle === 'final') && dg < d.param.seuil;
    const pips = '<i>' + '●'.repeat(Math.min(a.cout, 5)) + '</i>';
    const cls = `ech-a${bloque ? ' bloque' : ''}${affin ? ' double' : ''}`;
    return at.length > 1
      ? `<button class="${cls}${k === e.a ? ' on' : ''}" data-ech="attaque" data-i="${i}" data-k="${k}" aria-pressed="${k === e.a}" aria-label="${h(a.nom)} : ${dg} dégâts, ${echRythme(a.cout)}"><b class="tnum">${dg}</b>${pips}</button>`
      : `<span class="${cls} seule" aria-label="${h(a.nom)} : ${dg} dégâts, ${echRythme(a.cout)}"><b class="tnum">${dg}</b>${pips}</span>`;
  };
  const choisie = at[e.a] || at[0];
  return `<span class="ech-atq${at.length > 1 ? ' deux' : ''}">${at.map(pastille).join('')}</span>
    <small class="ech-ryt">${echRythme(choisie.cout)}</small>`;
}

function vEchDefi() {
  const d = echDefi();
  const adv = byId[d.adversaire];
  const aA = echAdvAttaque(d, adv);
  const eq = echEquipe(d);
  const restants = echRestants(d);

  const couleurs = {};
  eq.forEach(e => { const c = byId[e.carte]; couleurs[c.col] = (couleurs[c.col] || 0) + 1; });
  const places = [0, 1, 2].map(i => {
    const e = eq[i];
    if (!e) {
      const libre = i <= eq.length;
      return `<div class="ech-place"><span class="ech-place-tete"><small>${ECH_POS[i]}</small></span>
        <button class="ech-vide" data-ech="choisir" data-i="${Math.min(i, eq.length)}" ${libre ? '' : 'disabled'} aria-label="Choisir un Joueur"><i>+</i></button></div>`;
    }
    const c = byId[e.carte];
    let marque = '';
    if (d.regle === 'affinite' && c.col === d.param.couleur) marque = '<em class="bon">×2</em>';
    else if (couleurs[c.col] > 1) marque = '<em class="bon">+1 élan</em>';
    return `<div class="ech-place plein"><span class="ech-place-tete"><small>${ECH_POS[i]}</small></span>
      <span class="ech-carte">
        <button class="ech-carte-b" data-ech="choisir" data-i="${i}" aria-label="Changer ${h(c.nom)}">${renderCard(c)}</button>
        <b class="ech-def tnum" aria-label="Défense ${c.def}">${c.def}</b>
        <button class="ech-x" data-ech="retirer" data-i="${i}" aria-label="Retirer ${h(c.nom)}">×</button>
        ${marque}
      </span>
      ${echChoixAttaque(d, c, e, i)}
    </div>`;
  }).join('');

  return `<section class="ech ech-ecran">
    <div class="ech-barre-haut">
      <button class="ech-retour" data-ech="accueil">‹ ${d.sf ? 'Le défi du jour' : 'L\'Échauffement'}</button>
      <button class="ech-q" data-ech="regles" aria-label="Comment ça marche">?</button>
    </div>

    <div class="ech-adv">
      <button class="ech-adv-carte" data-show="${adv.id}" aria-label="Voir ${h(adv.nom)}">${renderCard(adv)}</button>
      <span class="ech-adv-txt">
        <small class="ech-kick">${d.sf ? `Jour ${fmtN(echSf.n)} · ${h(ECH_NIVEAUX[d.niveau] || '')}` : `Défi ${d.jour}`}</small>
        <b class="ech-adv-nom">${h(adv.nom)}</b>
        <span class="ech-adv-val">
          <span class="def" aria-label="Défense ${d.pv}"><b class="tnum">${fmtN(d.pv)}</b></span>
          <span class="frappe" aria-label="Frappe ${aA.degats}, ${echRythme(aA.cout)}"><b class="tnum">${aA.degats}</b><em>${echRythme(aA.cout)}</em></span>
        </span>
      </span>
    </div>
    <span class="ech-regle">${echIco(d.regle)}<span><b>${d.regle === 'aucune' ? 'Sans règle' : h(d.titre)}</b>${d.regle === 'aucune' ? (d.sf ? ' La force brute.' : ' Fais connaissance.') : ' ' + h(d.texte)}</span></span>

    <div class="ech-equipe">
      <h3>Ton équipe <small>dans l'ordre : devant, celui qui encaisse</small></h3>
      <div class="ech-ligne">${places}</div>
    </div>

    <button class="btn ech-lancer" data-ech="lancer" ${eq.length && restants && !echOccupe ? '' : 'disabled'}>${restants ? 'Lancer le défi' : 'Plus d\'essai aujourd\'hui'}</button>
    <p class="ech-pied">${echEtoiles(d.etoiles)}<span>${restants} essai${restants > 1 ? 's' : ''} aujourd'hui</span>${d.sf
      ? `<span class="ech-pied-prix">★ ${ECH_SF_PRIX.join(' · ')} ${MONNAIE.nom}</span>`
      : `<span class="ech-pied-prix">★ ${ECH_PRIX.join(' · ')} ${shardIco}</span>${echEnCours() ? `<span class="ech-pied-prix braises">${ECH_BRAISES.join(' · ')} ${braiseIco}</span>` : ''}<span class="ech-pied-prix">+ l'indice</span>`}</p>
  </section>`;
}

function montrerRegles() {
  openSheet({
    title: 'Comment ça marche',
    body: `<ol class="bvpoints nvpoints">
      <li><span class="bvico">${NAVICO.cards}</span><span><b>Trois Joueurs, dans l'ordre.</b> L'adversaire frappe celui de devant ; à 0 de Défense, il est KO et le suivant avance.</span></li>
      <li><span class="bvico">${NAVICO.clock}</span><span><b>L'élan.</b> À chaque tour, chacun gagne 1 élan et frappe dès qu'il en a autant que le coût de son attaque (les Essences dessinées sur la carte). Deux Joueurs de la même couleur partent avec 1 élan d'avance.</span></li>
      <li><span class="bvico">${NAVICO.star}</span><span><b>Le coup d'éclat.</b> Une fois par combat, touche un Joueur qui brille : son coup compte double.</span></li>
      <li><span class="bvico">${NAVICO.trophy}</span><span><b>Les étoiles.</b> ★ gagner avant le 10ᵉ tour, ★★ en perdant au plus un Joueur, ★★★ sans perte. Trois essais par défi et par jour ; ta meilleure note compte.${echSfActif() ? ' Le défi du jour ne se joue que le jour même.' : ' Les jours passés restent ouverts.'}</span></li>
      ${echEnCours() ? `<li><span class="bvico">${braiseIco}</span><span><b>Les ${MONNAIES_EV.echauffement.nom}.</b> Chaque étoile nouvelle en rapporte (${ECH_BRAISES.join(', ')}), les quêtes de l'événement aussi : elles font avancer le Pass et se dépensent dans sa boutique.</span></li>` : ''}
    </ol>`,
    actions: [{ label: 'Compris', primary: true, fn: closeSheet }]
  });
}

/* ---------- Composer l'équipe ---------- */
function echChoisir(i) {
  const d = echDefi();
  echPlace = i;
  const eq = echEquipe(d);
  const pris = eq.map(e => e.carte);
  const l = echJoueurs().map(c => ({ c, at: echAttaques(c) }));
  const meilleur = x => x.at.reduce((m, a) => Math.max(m, a.degats), 0);
  const vite = x => x.at.reduce((m, a) => Math.min(m, a.cout), 9);
  l.sort((x, y) => (echTri === 'def' ? y.c.def - x.c.def
    : echTri === 'deg' ? meilleur(y) - meilleur(x)
      : vite(x) - vite(y) || meilleur(y) - meilleur(x)) || x.c.num - y.c.num);
  const tri = [['def', 'Défense'], ['deg', 'Dégâts'], ['vite', 'Rapidité']];
  openSheet({
    title: i === 0 ? 'Devant' : i === 1 ? 'Au milieu' : 'Derrière',
    body: `<div class="segbar ech-tri">${tri.map(([k, n]) => `<button data-ech="tri" data-c="${k}" class="${echTri === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${l.length ? `<div class="pickgrid ech-picks">${l.map(({ c, at }) => {
        const a = at.reduce((m, x) => (x.degats > m.degats ? x : m), at[0] || null);
        const deja = pris.includes(c.id) && !(eq[i] && eq[i].carte === c.id);
        return `<button class="pick ech-pick" data-ech="pick" data-c="${c.id}" ${deja ? 'disabled' : ''}>
          <span class="pickimg">${renderCard(c, { calme: true })}</span>
          <span class="ech-val"><b>${c.def}</b><i></i><b>${a ? a.degats : '—'}</b></span></button>`;
      }).join('')}</div>` : '<p class="muted">Tu n\'as encore aucun Joueur : ouvre quelques boosters !</p>'}`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}
function echPrendre(id) {
  const eq = echEquipe(echDefi());
  const at = echAttaques(byId[id]);
  /* Par défaut, sa plus forte attaque. */
  const a = at.length ? at.indexOf(at.reduce((m, x) => (x.degats > m.degats ? x : m))) : 0;
  const ailleurs = eq.findIndex(e => e.carte === id);
  if (ailleurs >= 0) eq.splice(ailleurs, 1);
  if (echPlace < eq.length) eq[echPlace] = { carte: id, a };
  else eq.push({ carte: id, a });
  closeSheet();
  render();
}

/* ---------- Les clics (data-ech, via clicPage, js/app.js) ---------- */
function echAction(act, el) {
  const x = el.dataset;
  if (act === 'defi') { echJour = +x.j; echVue = 'defi'; $('#main').scrollTop = 0; return render(); }
  if (act === 'accueil') { echVue = 'accueil'; return render(); }
  if (act === 'regles') return montrerRegles();
  if (act === 'indice') return montrerIndice(+x.j);
  if (act === 'choisir') return echChoisir(+x.i);
  if (act === 'pick') return echPrendre(x.c);
  if (act === 'tri') { echTri = x.c; return echChoisir(echPlace); }
  if (act === 'retirer') { echEquipe(echDefi()).splice(+x.i, 1); return render(); }
  if (act === 'attaque') { echEquipe(echDefi())[+x.i].a = +x.k; return render(); }
  if (act === 'onglet') { echOnglet = x.o; echVue = 'accueil'; return render(); }
  if (act === 'lancer') return echLancer();
  if (act === 'annonce') return montrerEchAnnonce();
  /* L'événement : le Pass, les quêtes, la boutique (voir aussi data-shop, js/shop.js). */
  if (act === 'palier') return montrerPalierEch(+x.p);
  if (act === 'pass-tout') return echReclamer(echEv ? echEv.piste.filter(p => !p.pris && echEv.total >= p.seuil) : []);
  if (act === 'qvue') { echQVue = x.o; return render(); }
  if (act === 'quete') return montrerQueteEch(x.q);
  /* Depuis ailleurs (la Boutique, un bandeau) : un sous-onglet de l'événement. */
  if (act === 'aller') { echOnglet = x.o; echVue = 'accueil'; return aller('combats'); }
  /* Après la saison : le défi du jour, ses sous-onglets, le récap. */
  if (act === 'sf-defi') { echJour = 0; echVue = 'defi'; $('#main').scrollTop = 0; return render(); }
  if (act === 'sf-onglet') { echSfOnglet = x.o; echVue = 'accueil'; return tab === 'combats' ? render() : aller('combats'); }
  if (act === 'recap') { echSfOnglet = 'recap'; echVue = 'accueil'; return aller('combats'); }
}

/* ---------- Le combat, en direct ---------- */
async function echLancer() {
  const d = echDefi();
  const eq = echEquipe(d).slice();
  if (!eq.length || echOccupe || !echRestants(d)) return;
  echOccupe = true;
  /* Aperçu du Labo : le combat se joue ici seulement, sans essai ni gain. */
  if (echData.apercu) return echScene(d, eq, null);
  let dep;
  try {
    dep = d.sf ? await Backend.echSfCommencer(eq) : await Backend.echCommencer(d.jour, eq);
  } catch (e) {
    echOccupe = false;
    toast(e.message || 'Le défi n\'a pas pu commencer.');
    return chargerEch();
  }
  d.essais_jour = (d.essais_jour || 0) + 1;
  echScene(d, dep.equipe, dep.essai);
}

function echScene(d, equipe, essai) {
  const adv = byId[d.adversaire];
  const c = echCombat(d, equipe, echStats);
  const reduit = RM() || document.documentElement.classList.contains('rm');
  let eclat = null;

  const pips = (n, plein) => Array.from({ length: n }, (_, i) => `<i class="${i < plein ? 'on' : ''}"></i>`).join('');
  const v = document.createElement('div');
  v.className = 'ech-scene';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-label', `${d.sf ? 'Défi du jour' : `Défi ${d.jour}`} : ${adv.nom}`);
  v.innerHTML = `${echIllu(adv, .5, .3, 'fond')}<div class="ech-sc">
      <div class="ech-sc-haut"><span class="ech-sc-tour">Tour 1</span><span class="ech-sc-regle">${echIco(d.regle)}${h(d.titre)}</span><button class="ech-passer">Passer ›</button></div>
      <div class="ech-sc-adv ech-sc-u">
        <div class="ech-sc-carte">${renderCard(adv)}<i class="ech-flot"></i><i class="ech-eclat"></i></div>
        <div class="ech-jauge adv"><i style="width:100%"></i><span class="tnum">${fmtN(d.pv)}</span></div>
        <div class="ech-pips adv">${pips(c.coutB, 0)}</div>
      </div>
      <p class="ech-sc-aide">Touche un Joueur qui brille : coup d'éclat, une fois.</p>
      <div class="ech-sc-eq">${c.al.map((a, i) => `<button class="ech-sc-j ech-sc-u" data-i="${i}" aria-label="${h(byId[equipe[i].carte].nom)}">
          <span class="ech-sc-carte">${renderCard(byId[equipe[i].carte])}<i class="ech-flot"></i><i class="ech-eclat"></i><i class="ech-ko">KO</i></span>
          <span class="ech-jauge"><i style="width:100%"></i><span class="tnum">${a.def}</span></span>
          <span class="ech-pips">${pips(a.cout || 0, a.elan)}</span>
        </button>`).join('')}</div>
      <div class="ech-sc-fin" hidden></div>
    </div>`;
  document.body.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));

  const advEl = v.querySelector('.ech-sc-adv');
  const jEl = i => v.querySelector(`.ech-sc-j[data-i="${i}"]`);
  const aide = v.querySelector('.ech-sc-aide');
  const majPips = (avance) => {
    c.al.forEach((a, i) => {
      const n = a.pv > 0 ? Math.min(a.cout || 0, a.elan + (avance ? 1 : 0)) : 0;
      jEl(i).querySelector('.ech-pips').innerHTML = pips(a.cout || 0, n);
    });
    advEl.querySelector('.ech-pips').innerHTML = pips(c.coutB, Math.min(c.coutB, c.elanB + (avance ? 1 : 0)));
  };
  const jauge = (el, reste, max) => {
    el.querySelector('.ech-jauge i').style.width = Math.max(0, reste / max * 100) + '%';
    el.querySelector('.ech-jauge span').textContent = fmtN(Math.max(0, reste));
  };
  const rejouer = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const flotte = (el, txt, cls) => {
    const f = el.querySelector('.ech-flot');
    f.textContent = txt; f.className = 'ech-flot ' + (cls || '');
    rejouer(f, 'go');
  };
  const ligne = ev => {
    const [, type, i, dg, reste] = ev;
    const a = c.al[i];
    if (type === 'eclat') { rejouer(jEl(i), 'eclate'); if (typeof SFX === 'object') SFX.jouer('rare'); }
    else if (type === 'frappe') {
      rejouer(jEl(i), 'frappe'); rejouer(advEl, 'touche'); flotte(advEl, '−' + dg, dg >= 150 ? 'gros' : '');
      jauge(advEl, reste, d.pv); if (typeof SFX === 'object') SFX.jouer('tap');
    } else if (type === 'bloque') { rejouer(jEl(i), 'frappe'); rejouer(advEl, 'bloque'); flotte(advEl, 'Bloqué', 'gris'); }
    else if (type === 'riposte') { flotte(jEl(i), '−' + dg, 'petit'); jauge(jEl(i), reste, a.def); }
    else if (type === 'subit') { rejouer(advEl, 'attaque'); rejouer(jEl(i), 'touche'); flotte(jEl(i), '−' + dg, 'rouge'); jauge(jEl(i), reste, a.def); }
    else if (type === 'ko') { jEl(i).classList.add('ko'); if (typeof vibrer === 'function') vibrer(25); }
  };

  /* Le tour : les Joueurs qui vont frapper brillent ; s'ils peuvent encore
     recevoir le coup d'éclat, on leur laisse un moment pour être touchés. */
  let passer = false, attente = null, reveil = null, choix = null;
  const pause = ms => new Promise(r => { reveil = r; attente = setTimeout(r, passer ? 0 : ms); });
  v.addEventListener('click', ev => {
    const j = ev.target.closest('.ech-sc-j.pret');
    if (j && choix) { const f = choix; choix = null; f(+j.dataset.i); return; }
    if (ev.target.closest('.ech-passer')) {
      // Passer coupe aussi la pause en cours : sans le réveil, le combat resterait figé.
      passer = true; clearTimeout(attente);
      if (reveil) reveil();
      if (choix) { const f = choix; choix = null; f(null); }
    }
  });
  const attendreChoix = prets => new Promise(r => {
    prets.forEach(i => jEl(i).classList.add('pret'));
    aide.classList.add('on');
    choix = r;
    attente = setTimeout(() => { if (choix) { choix = null; r(null); } }, passer ? 0 : 1700);
  });

  const jouer = async () => {
    await pause(650);
    while (!c.fin) {
      v.querySelector('.ech-sc-tour').textContent = `Tour ${c.t + 1}`;
      majPips(true);
      let i = null;
      const prets = c.eclat || eclat ? [] : c.prets();
      if (prets.length && !passer) i = await attendreChoix(prets);
      v.querySelectorAll('.ech-sc-j.pret').forEach(x => x.classList.remove('pret'));
      aide.classList.remove('on');
      if (i != null) eclat = { tour: c.t + 1, i };
      if (!prets.length) await pause(reduit ? 150 : 380);
      const evs = c.tour(i);
      majPips(false);
      for (const e of evs) { ligne(e); await pause(reduit ? 200 : e[1] === 'eclat' ? 380 : 560); }
    }
    if (c.fin.gagne) advEl.classList.add('vaincu');
    v.querySelector('.ech-passer').hidden = true;
    aide.remove();
    await terminer();
  };

  const fin = v.querySelector('.ech-sc-fin');
  const terminer = async () => {
    fin.innerHTML = '<b class="ech-sc-verdict">…</b>';
    fin.hidden = false; requestAnimationFrame(() => fin.classList.add('on'));
    let r;
    try {
      r = essai == null ? echTerminerApercu(d, c.fin)
        : d.sf ? await Backend.echSfTerminer(essai, eclat) : await Backend.echTerminer(essai, eclat);
    } catch (e) {
      fin.innerHTML = `<b class="ech-sc-verdict">Pas enregistré</b><small>${h(e.message || 'Le serveur n\'a pas répondu.')}</small>
        <button class="btn" data-sc="reessayer">Réessayer</button><button class="btn ghost" data-sc="fermer">Fermer</button>`;
      return;
    }
    if (d.sf) echSf = r.etat; else echData = r.etat;
    const res = r.resultat;
    if (res.etoiles !== c.fin.etoiles) console.warn('Échauffement : le serveur et la page ne sont pas d\'accord', res, c.fin);
    const g = r.gain || {};
    const gains = [];
    if (g.eclats) gains.push(`+${fmtN(g.eclats)} Éclats`);
    if (g.braises) gains.push(`+${fmtN(g.braises)} ${MONNAIES_EV.echauffement.nom}`);
    if (g.boosters) gains.push(`+${g.boosters} boosters`);
    if (g.titre) gains.push(`Titre « ${h((TITRES[g.titre] || {}).nom || 'Échauffé')} »`);
    fin.innerHTML = `<b class="ech-sc-verdict">${res.gagne ? 'Victoire' : 'Pas cette fois'}</b>
      ${echEtoiles(res.etoiles, 'grand')}
      <small class="ech-sc-tours">${res.gagne ? `En ${res.tours} tour${res.tours > 1 ? 's' : ''}${res.ko ? `, ${res.ko} KO` : ', sans perte'}` : res.tours >= 10 ? 'Le temps est écoulé.' : 'Ton équipe est tombée.'}</small>
      ${gains.length ? `<div class="ech-gains">${gains.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
      ${r.indice ? `<button class="ech-sc-indice" data-sc="indice"><span class="ech-flip"><span class="dos"><img src="${ART.back}" alt=""></span><span class="face">${vIndiceVisuel(r.indice)}</span></span><span class="ech-sc-ind-txt"><b>Un indice</b><small>Touche pour le retourner</small></span></button>` : ''}
      ${res.etoiles < 3 ? `<small class="ech-astuce">${h(ECH_ASTUCES[d.regle] ? ECH_ASTUCES[d.regle](d) : '')}</small>` : ''}
      ${essai == null ? '<small class="ech-astuce">Aperçu du Labo : rien n\'est enregistré.</small>' : ''}
      <button class="btn" data-sc="fermer">${res.gagne ? 'Continuer' : 'Changer d\'équipe'}</button>`;
    if (res.gagne && typeof SFX === 'object') SFX.jouer(res.etoiles === 3 ? 'legend' : 'gagne');
    if (typeof vibrer === 'function') vibrer(res.gagne ? [20, 40, 20] : 30);
    fin.onclick = e2 => {
      const b = e2.target.closest('[data-sc]');
      if (!b) return;
      if (b.dataset.sc === 'indice' && !b.classList.contains('vu')) {
        b.classList.add('vu');
        b.querySelector('.ech-sc-ind-txt').innerHTML = `<b>${h(r.indice.titre)}</b><small>${h(r.indice.texte)}</small>`;
        if (typeof SFX === 'object') SFX.jouer('rare');
      }
    };
  };
  fin.addEventListener('click', e2 => {
    const b = e2.target.closest('[data-sc]');
    if (!b) return;
    if (b.dataset.sc === 'reessayer') return terminer();
    if (b.dataset.sc === 'fermer') {
      v.classList.remove('on');
      setTimeout(() => v.remove(), 250);
      echOccupe = false;
      render();
      /* Des Braises et des quêtes ont pu bouger : le Pass suit. */
      if (essai != null && !d.sf) chargerEch(true);
    }
  });
  jouer();
}

/* La fin d'un combat d'aperçu, comme ech_terminer la rendrait, sans serveur :
   la note et l'indice restent dans l'état inventé. */
function echTerminerApercu(d, res) {
  const avant = d.etoiles || 0;
  const prix = d.sf ? ECH_SF_PRIX : ECH_PRIX;
  const gain = { eclats: 0, braises: 0, boosters: 0, titre: null };
  for (let k = avant + 1; k <= res.etoiles; k++) { gain.eclats += prix[k - 1]; if (!d.sf && echEv) gain.braises += ECH_BRAISES[k - 1]; }
  if (d.sf) { echSf.defi.etoiles = Math.max(avant, res.etoiles); return { resultat: res, avant, gain, indice: null, etat: echSf }; }
  d.etoiles = Math.max(avant, res.etoiles);
  const indice = res.etoiles === 3 && avant < 3 ? (echData.apercuIndices || []).find(x => x.jour === d.jour) || null : null;
  if (indice && !echIndice(d.jour)) echData.indices.push(indice);
  echData.etoiles = echData.defis.reduce((n, x) => n + (x.etoiles || 0), 0);
  return { resultat: res, avant, gain, indice, etat: echData };
}

/* ---------- Les bandeaux ---------- */
/* L'écran Boosters : pendant la saison, l'événement ; pendant trois jours, son
   récap ; ensuite, le défi du jour. La même couverture que l'onglet : le
   médaillon de « La Luxueuse III ». */
function vBandeauEch() {
  const ban = (act, petit, titre, droite, label) => `<button class="ech-ban" ${act} aria-label="${h(label)}">
    ${echIllu(byId.c122, .6, .4, 'fond')}
    <span class="ech-ban-txt"><small>${petit}</small><b>${titre}</b></span>
    ${droite}<span class="ech-ban-fl" aria-hidden="true">›</span>
  </button>`;
  if (echActif()) {
    const n = echPastille();
    return ban('data-tab="combats"', `Événement · encore ${h(dureeCourte(Date.parse(echData.fin) - Date.now()))}`, 'L\'Échauffement',
      n ? `<i class="ech-ban-n">${n}</i>` : echEnCours() ? `<span class="ech-ban-solde">${braiseIco}${fmtN(save.prismes || 0)}</span>` : '',
      'L\'Échauffement : aller au défi du jour');
  }
  const r = echRecapEnCours();
  if (r) return ban('data-ech="recap"', 'Terminé · le récap', 'L\'Échauffement', '<span class="ech-ban-solde">Ton bilan</span>', 'Voir le récap de L\'Échauffement');
  if (echSfActif()) {
    const d = echSf.defi || {};
    return ban('data-ech="sf-onglet" data-o="jour"', `Le défi du jour · ${h(ECH_NIVEAUX[d.niveau] || '')}`, 'L\'Échauffement',
      d.etoiles ? echEtoiles(d.etoiles) : '<i class="ech-ban-n">1</i>', 'L\'Échauffement : le défi du jour');
  }
  return '';
}

/* La Boutique principale : un lien vers celle de l'événement, dans Combats. */
function vBandeauEchBoutique() {
  return `<button class="ech-ban shopev" data-ech="aller" data-o="boutique" aria-label="Ouvrir la boutique de L'Échauffement">
    ${echIllu(byId.c122, .6, .4, 'fond')}
    <span class="ech-ban-txt"><small>En ${MONNAIES_EV.echauffement.nom}, pendant l'événement</small><b>Boutique de L'Échauffement</b></span>
    <span class="ech-ban-solde">${braiseIco}${fmtN(save.prismes || 0)}</span><span class="ech-ban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- La fenêtre d'annonce, une fois ---------- */
/* Pour qui n'a pas vu celle de la 2.5 (js/bienvenue.js), qui la remplace. */
function echAnnonceAVoir() {
  return echActif() && accueilMemoire().echauffement !== 'vu';
}
function montrerEchAnnonce() {
  if (!echData.apercu) accueilNoter({ echauffement: 'vu' });
  const d = echData.defis[0];
  const adv = d && byId[d.adversaire];
  openSheet({
    title: '',
    body: `<div class="ech-annonce">${echIllu(adv, .5, .25, 'fond')}<span><small>Nouvel événement</small><b>L'Échauffement</b><span>Sept défis, un par jour, dans l'onglet Combats.</span></span></div>
      <ol class="bvpoints nvpoints">
        <li><span class="bvico">${NAVICO.cards}</span><span><b>Trois Joueurs de ta collection</b>, et le combat se joue avec les valeurs de tes cartes.</span></li>
        <li><span class="bvico">${NAVICO.star}</span><span><b>Trois étoiles, un indice</b> sur ce qui se prépare.</span></li>
        <li><span class="bvico">${braiseIco}</span><span><b>Des ${MONNAIES_EV.echauffement.nom}</b> pour un Pass de vingt paliers et une boutique, en plus des ${fmtN(2100)} ${MONNAIE.nom} des défis.</span></li>
      </ol>`,
    actions: [
      { label: 'Plus tard', fn: closeSheet },
      { label: 'Premier défi', primary: true, fn: () => { closeSheet(); echVue = 'accueil'; echOnglet = 'defis'; aller('combats'); } }
    ]
  });
}

/* ---------- La fin de l'événement, une fois ---------- */
/* Au premier passage après la saison : le bilan, et ce qui continue — c'est
   ici et dans le récap que le défi du jour s'explique (demande du propriétaire). */
function echRecapAVoir() {
  const a = save && save.recap;
  return !!(a && a.code === 'echauffement' && !evenementEnCours() && accueilMemoire().echRecap !== a.fin);
}
async function montrerEchRecap() {
  const a = echRecapEnCours();
  if (a && !a.apercu) accueilNoter({ echRecap: a.fin });
  let r = echRecapApercu || echRecap;
  if (!r) { try { r = echRecap = await Backend.rpc('evenement_recap'); } catch (e) { r = null; } }
  openSheet({
    title: '',
    body: `<div class="ech-annonce maj25">${echIllu(byId.c122, .6, .4, 'fond')}<span><small>Événement terminé</small><b>Merci d'avoir joué</b><span>Neuf jours d'Échauffement : voici les tiens.</span></span></div>
      ${r ? `<div class="rr-popstats ech-popstats">
        <div><b class="tnum">${r.etoiles || 0}<small>/21</small></b><small>étoiles</small></div>
        <div><b class="tnum">${r.paliers || 0}<small>/${r.paliers_max || 20}</small></b><small>Pass</small></div>
        <div><b class="tnum">${fmtN(r.total || 0)}</b><small>${MONNAIES_EV.echauffement.nom}</small></div>
        ${r.rang ? `<div><b class="tnum">${r.rang}<sup>e</sup></b><small>sur ${fmtN(r.joueurs)}</small></div>` : ''}
      </div>` : ''}
      <ol class="bvpoints nvpoints">
        <li><span class="bvico">${NAVICO.sword}</span><span><b>L'Échauffement continue.</b> Dans l'onglet Combats, un défi par jour, le même pour tout le monde : un adversaire et une règle, de Facile à Redoutable.</span></li>
        <li><span class="bvico">${shardIco}</span><span><b>Jusqu'à ${ECH_SF_PRIX.reduce((x, y) => x + y, 0)} ${MONNAIE.nom} par jour</b> (★ ${ECH_SF_PRIX.join(', ')}), trois essais ; et un titre pour dix jours gagnés.</span></li>
      </ol>`,
    actions: [{ label: 'Le défi du jour', primary: true, fn: () => { closeSheet(); echSfOnglet = 'jour'; echVue = 'accueil'; aller('combats'); } },
              { label: 'Voir le récap', fn: () => { closeSheet(); echSfOnglet = 'recap'; echVue = 'accueil'; aller('combats'); } }]
  });
}
