/* L'Échauffement (version 2.1.4) : sept défis, un par jour, après le récap
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

   La page prend les couleurs de la suite (graphite et lavande, jetons
   `--e-*` posés sur .ech, en fin de css/hub.css) : une fenêtre sur ce qui
   vient. Le reste du site ne change pas. */
"use strict";

let echData = null;
let echVue = 'accueil';
let echJour = 0;
let echTri = 'def';
let echOccupe = false;
let echPlace = 0;
/* L'équipe en préparation, défi par défi : [{ carte, a }]. */
const echEquipes = {};

const ECH_POS = ['Devant', 'Milieu', 'Derrière'];
const ECH_PRIX = [80, 80, 140];
const ECH_ASTUCES = {
  aucune: 'Devant, celui qui encaisse le mieux ; derrière, ceux qui frappent fort.',
  carapace: 'Les coups de moins de 100 ne passent pas : un coup d\'éclat peut les doubler.',
  eclair: 'Il frappe à chaque tour : un Joueur solide devant, et finir vite.',
  affinite: 'Des Joueurs Roses : leurs coups comptent double.',
  riposte: 'Chaque coup te coûte 30 : peu de coups, mais des gros.',
  fureur: 'Il frappe de plus en plus fort : il faut le battre vite.',
  final: 'Des coups d\'au moins 80, le plus vite possible, et le coup d\'éclat au bon moment.'
};
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
function echActif() {
  if (!echData || !echData.ouvert) return false;
  return Date.now() < Date.parse(echData.fin);
}
/* La pastille de Combats : les défis ouverts pas encore gagnés. */
function echPastille() {
  if (!echActif()) return 0;
  return echData.defis.filter(d => !d.etoiles).length;
}
async function chargerEch() {
  /* L'aperçu du Labo garde son état inventé jusqu'à « Revenir à l'état réel ». */
  if (Backend.mode !== 'cloud' || !save || (echData && echData.apercu)) return;
  try { echData = await Backend.echEtat(); } catch (e) { return; }
  if ((tab === 'combats' || tab === 'boosters') && !echOccupe) render();
  else if (typeof majDiscrete === 'function') majDiscrete(false);
}
const echDuJour = () => echData.defis[echData.defis.length - 1];
function echDefi() {
  const l = echData.defis;
  if (!l.some(d => d.jour === echJour)) echJour = (echDuJour() || {}).jour || 1;
  return l.find(d => d.jour === echJour);
}
function echEquipe(d) {
  if (!echEquipes[d.jour]) echEquipes[d.jour] = (d.equipe || []).filter(e => byId[e.carte] && echPossede(byId[e.carte])).map(e => ({ carte: e.carte, a: e.a || 0 }));
  return echEquipes[d.jour];
}
const echRestants = d => Math.max(0, (echData.essais_max || 3) - (d.essais_jour || 0));
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
const ECH_ONGLETS = [['defis', 'Défis'], ['indices', 'Indices'], ['recompenses', 'Récompenses']];

function vEchauffement() {
  return echVue === 'defi' ? vEchDefi() : vEchAccueil();
}

function vEchAccueil() {
  const s = echData;
  const reste = Date.parse(s.fin) - Date.now();
  const etoiles = s.etoiles || 0;
  const corps = echOnglet === 'indices' ? vEchIndices() : echOnglet === 'recompenses' ? vEchRecompenses() : vEchDefis();
  return `<section class="ech">
    <header class="ech-hero">
      ${echIllu(byId.c122, .6, .4, 'fond')}
      <span class="ech-hero-haut"><span class="ech-kick">Événement · encore ${h(dureeCourte(reste))}</span>
        <span class="ech-anneau" style="--p:${Math.round(etoiles / 21 * 100)}%" aria-label="${etoiles} étoiles sur 21"><b class="tnum">${etoiles}</b><small>/21</small></span></span>
      <span class="ech-hero-bas"><h2 class="ech-titre">L'Échauffement</h2><small>Sept défis, un par jour.</small></span>
    </header>
    <nav class="ech-onglets" role="tablist">${ECH_ONGLETS.map(([k, n]) => `<button role="tab" data-ech="onglet" data-o="${k}" class="${echOnglet === k ? 'on' : ''}" aria-selected="${echOnglet === k}">${n}</button>`).join('')}</nav>
    <div class="ech-corps">${corps}</div>
  </section>`;
}

/* Le défi du jour, puis les sept. */
function vEchDefis() {
  const s = echData;
  const dj = echDuJour();
  const adv = byId[dj.adversaire];
  const jours = Array.from({ length: s.total || 7 }, (_, i) => {
    const j = i + 1;
    const x = s.defis.find(y => y.jour === j);
    if (!x) return `<span class="ech-jour ferme" aria-label="Défi ${j}, pas encore ouvert"><i>${NAVICO.lock}</i><span class="ech-et"></span></span>`;
    return `<button class="ech-jour ${x.etoiles === 3 ? 'fini' : x.etoiles ? 'gagne' : ''}" data-ech="defi" data-j="${j}" aria-label="Défi ${j}">
      <i>${j}</i>${echEtoiles(x.etoiles)}</button>`;
  }).join('');
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
    <p class="ech-mini">Trois essais par défi et par jour ; les jours passés restent ouverts.</p>`;
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

/* Les récompenses, toutes écrites, avec où on en est. */
function vEchRecompenses() {
  const s = echData;
  const total = s.total || 7;
  const etoiles = s.etoiles || 0;
  const gagnes = s.gagnes || 0;
  const pris = s.paliers || [];
  const eclats = s.defis.reduce((m, d) => m + ECH_PRIX.slice(0, d.etoiles || 0).reduce((a, b) => a + b, 0), 0);
  const maxEclats = total * ECH_PRIX.reduce((a, b) => a + b, 0);
  const nInd = (s.indices || []).filter(x => x.jour > 0).length;
  const jauge = (v, max) => `<span class="ech-rj"><i style="width:${Math.min(100, Math.round(v / max * 100))}%"></i></span>`;
  const etat = (ok, v, max) => (ok ? '<em class="ok">Obtenu</em>' : `<em class="tnum">${v}/${max}</em>`);
  return `<div class="ech-r-tete">
      <span><small>Éclats gagnés</small><b class="tnum">${fmtN(eclats)}<i> / ${fmtN(maxEclats)}</i></b></span>
      ${jauge(eclats, maxEclats)}
    </div>
    <div class="ech-rs">
      <div class="ech-r"><span class="ech-r-ico">${echEtoiles(3)}</span><b>Chaque étoile</b>
        <span class="ech-r-quoi">★ 80 · ★★ 80 · ★★★ 140 Éclats, par défi</span>${etat(false, etoiles, total * 3)}</div>
      <button class="ech-r" data-ech="onglet" data-o="indices"><span class="ech-r-ico">${NAVICO.cards}</span><b>Trois étoiles</b>
        <span class="ech-r-quoi">un indice sur ce qui se prépare</span>${etat(nInd === total, nInd, total)}</button>
      <div class="ech-r"><span class="ech-r-ico"><img src="${ART.seal}" alt=""></span><b>Les sept défis gagnés</b>
        <span class="ech-r-quoi">3 boosters</span>${etat(pris.includes('sept'), gagnes, total)}${jauge(gagnes, total)}</div>
      <div class="ech-r"><span class="ech-r-ico titre">${h((TITRES.t_echauffe || {}).nom || 'Échauffé')}</span><b>Les 21 étoiles</b>
        <span class="ech-r-quoi">le titre « ${h((TITRES.t_echauffe || {}).nom || 'Échauffé')} »</span>${etat(pris.includes('parfait'), etoiles, total * 3)}${jauge(etoiles, total * 3)}</div>
    </div>`;
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
      <button class="ech-retour" data-ech="accueil">‹ L'Échauffement</button>
      <button class="ech-q" data-ech="regles" aria-label="Comment ça marche">?</button>
    </div>

    <div class="ech-adv">
      <button class="ech-adv-carte" data-show="${adv.id}" aria-label="Voir ${h(adv.nom)}">${renderCard(adv)}</button>
      <span class="ech-adv-txt">
        <small class="ech-kick">Défi ${d.jour}</small>
        <b class="ech-adv-nom">${h(adv.nom)}</b>
        <span class="ech-adv-val">
          <span class="def" aria-label="Défense ${d.pv}"><b class="tnum">${fmtN(d.pv)}</b></span>
          <span class="frappe" aria-label="Frappe ${aA.degats}, ${echRythme(aA.cout)}"><b class="tnum">${aA.degats}</b><em>${echRythme(aA.cout)}</em></span>
        </span>
      </span>
    </div>
    <span class="ech-regle">${echIco(d.regle)}<span><b>${d.regle === 'aucune' ? 'Sans règle' : h(d.titre)}</b>${d.regle === 'aucune' ? ' Fais connaissance.' : ' ' + h(d.texte)}</span></span>

    <div class="ech-equipe">
      <h3>Ton équipe <small>dans l'ordre : devant, celui qui encaisse</small></h3>
      <div class="ech-ligne">${places}</div>
    </div>

    <button class="btn ech-lancer" data-ech="lancer" ${eq.length && restants && !echOccupe ? '' : 'disabled'}>${restants ? 'Lancer le défi' : 'Plus d\'essai aujourd\'hui'}</button>
    <p class="ech-pied">${echEtoiles(d.etoiles)}<span>${restants} essai${restants > 1 ? 's' : ''} aujourd'hui</span><span class="ech-pied-prix">★ 80 · ★★ 80 · ★★★ 140 + l'indice</span></p>
  </section>`;
}

function montrerRegles() {
  openSheet({
    title: 'Comment ça marche',
    body: `<ol class="bvpoints nvpoints">
      <li><span class="bvico">${NAVICO.cards}</span><span><b>Trois Joueurs, dans l'ordre.</b> L'adversaire frappe celui de devant ; à 0 de Défense, il est KO et le suivant avance.</span></li>
      <li><span class="bvico">${NAVICO.clock}</span><span><b>L'élan.</b> À chaque tour, chacun gagne 1 élan et frappe dès qu'il en a autant que le coût de son attaque (les Essences dessinées sur la carte). Deux Joueurs de la même couleur partent avec 1 élan d'avance.</span></li>
      <li><span class="bvico">${NAVICO.star}</span><span><b>Le coup d'éclat.</b> Une fois par combat, touche un Joueur qui brille : son coup compte double.</span></li>
      <li><span class="bvico">${NAVICO.trophy}</span><span><b>Les étoiles.</b> ★ gagner avant le 10ᵉ tour, ★★ en perdant au plus un Joueur, ★★★ sans perte. Trois essais par défi et par jour ; ta meilleure note compte.</span></li>
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
    dep = await Backend.echCommencer(d.jour, eq);
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
  v.setAttribute('aria-label', `Défi ${d.jour} : ${adv.nom}`);
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
      r = essai == null ? echTerminerApercu(d, c.fin) : await Backend.echTerminer(essai, eclat);
    } catch (e) {
      fin.innerHTML = `<b class="ech-sc-verdict">Pas enregistré</b><small>${h(e.message || 'Le serveur n\'a pas répondu.')}</small>
        <button class="btn" data-sc="reessayer">Réessayer</button><button class="btn ghost" data-sc="fermer">Fermer</button>`;
      return;
    }
    echData = r.etat;
    const res = r.resultat;
    if (res.etoiles !== c.fin.etoiles) console.warn('Échauffement : le serveur et la page ne sont pas d\'accord', res, c.fin);
    const g = r.gain || {};
    const gains = [];
    if (g.eclats) gains.push(`+${fmtN(g.eclats)} Éclats`);
    if (g.boosters) gains.push(`+${g.boosters} boosters`);
    if (g.titre) gains.push(`Titre « ${h((TITRES[g.titre] || {}).nom || 'Échauffé')} »`);
    fin.innerHTML = `<b class="ech-sc-verdict">${res.gagne ? 'Victoire' : 'Pas cette fois'}</b>
      ${echEtoiles(res.etoiles, 'grand')}
      <small class="ech-sc-tours">${res.gagne ? `En ${res.tours} tour${res.tours > 1 ? 's' : ''}${res.ko ? `, ${res.ko} KO` : ', sans perte'}` : res.tours >= 10 ? 'Le temps est écoulé.' : 'Ton équipe est tombée.'}</small>
      ${gains.length ? `<div class="ech-gains">${gains.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
      ${r.indice ? `<button class="ech-sc-indice" data-sc="indice"><span class="ech-flip"><span class="dos"><img src="${ART.back}" alt=""></span><span class="face">${vIndiceVisuel(r.indice)}</span></span><span class="ech-sc-ind-txt"><b>Un indice</b><small>Touche pour le retourner</small></span></button>` : ''}
      ${res.etoiles < 3 ? `<small class="ech-astuce">${h(ECH_ASTUCES[d.regle] || '')}</small>` : ''}
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
    }
  });
  jouer();
}

/* La fin d'un combat d'aperçu, comme ech_terminer la rendrait, sans serveur :
   la note et l'indice restent dans l'état inventé. */
function echTerminerApercu(d, res) {
  const avant = d.etoiles || 0;
  const gain = { eclats: 0, boosters: 0, titre: null };
  for (let k = avant + 1; k <= res.etoiles; k++) gain.eclats += ECH_PRIX[k - 1];
  d.etoiles = Math.max(avant, res.etoiles);
  const indice = res.etoiles === 3 && avant < 3 ? (echData.apercuIndices || []).find(x => x.jour === d.jour) || null : null;
  if (indice && !echIndice(d.jour)) echData.indices.push(indice);
  echData.etoiles = echData.defis.reduce((n, x) => n + (x.etoiles || 0), 0);
  return { resultat: res, avant, gain, indice, etat: echData };
}

/* ---------- Le bandeau de l'écran Boosters ---------- */
/* La même couverture que l'onglet : le médaillon de « La Luxueuse III ». */
function vBandeauEch() {
  if (!echActif()) return '';
  const n = echPastille();
  return `<button class="ech-ban" data-tab="combats" aria-label="L'Échauffement : aller au défi du jour">
    ${echIllu(byId.c122, .6, .4, 'fond')}
    <span class="ech-ban-txt"><small>Événement · encore ${h(dureeCourte(Date.parse(echData.fin) - Date.now()))}</small><b>L'Échauffement</b></span>
    ${n ? `<i class="ech-ban-n">${n}</i>` : ''}<span class="ech-ban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- La fenêtre d'annonce, une fois ---------- */
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
        <li><span class="bvico">${NAVICO.trophy}</span><span><b>Jusqu'à 2 100 Éclats</b>, 3 boosters pour les sept défis gagnés, et un titre pour les 21 étoiles.</span></li>
      </ol>`,
    actions: [
      { label: 'Plus tard', fn: closeSheet },
      { label: 'Premier défi', primary: true, fn: () => { closeSheet(); echVue = 'accueil'; aller('combats'); } }
    ]
  });
}
