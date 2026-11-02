#!/usr/bin/env node
/* L'assistant de deck (version 3.0.14) : d'où viennent ses choix, et ce
   que valent ses decks.

   Le propriétaire, le 1er novembre 2026 : « la fonction "Compléter pour
   moi" doit être optimisée voire repensée […] un assistant qui fait le deck
   selon tes préférences, mais qui fait un vrai deck optimisé et fort tout
   en respectant les préférences. »

     node tools/assistant-decks.js cotes <parties> <graine> > part.json
     node tools/assistant-decks.js fusion part-*.json
     node tools/assistant-decks.js mesurer [parties] [niveau]

   1. `cotes` : des parties entre decks tirés au sort (Decks.aleatoire, dans
      une ou deux couleurs, l'adversaire du jeu au niveau 2 des deux côtés),
      et pour chaque carte, les parties gagnées par les decks qui la jouent.
   2. `fusion` : la cote de chaque carte — la part de victoires des decks
      qui la jouent, moins celle des decks de sa couleur qui ne la jouent pas
      (pour une Neutre : tous les decks). Elle s'écrit dans js/combat/decks.js,
      entre les marques COTES (Decks.COTES).
   3. `mesurer` : des decks de l'assistant (chaque couleur, chaque style, la
      collection complète) contre une série d'adversaires — les deux
      Starters et des decks tirés au sort au niveau 3 —, et, pour comparer,
      les decks de l'ancien « Compléter pour moi » (completerAncien, plus
      bas) aux mêmes préférences. */
"use strict";
const fs = require('fs');
const path = require('path');
const S = require('./combat-sim.js');
const { Combat, Decks, IA, rng } = S;

const COULEURS = ['rose', 'orange', 'violette', 'mauve', 'bleue', 'azur', 'verte'];

function partie(d0, d1, graine, niveau) {
  const E = Combat.creer({ decks: [Decks.versMoteur(d0), Decks.versMoteur(d1)], graine, noms: ['A', 'B'] });
  let g = 0;
  while (Combat.demande(E) && g++ < 5000) Combat.agir(E, IA.choisir(E, { niveau }));
  return E.fin ? E.fin.gagnant : -1;
}

function cotes(N, graine) {
  const r = rng(graine);
  const st = {};
  const vu = (id, w, couleurs) => {
    const s = (st[id] = st[id] || { n: 0, w: 0 });
    s.n++; s.w += w;
  };
  /* Les decks d'une couleur, avec ou sans la carte : comptés par couleur. */
  const parCouleur = {};
  for (let i = 0; i < N; i++) {
    const a = Decks.aleatoire(r, { niveau: 3 }), b = Decks.aleatoire(r, { niveau: 3 });
    const g = partie(a, b, (graine * 7919 + i) >>> 0, 2);
    if (g < 0) continue;
    [[a, g === 0 ? 1 : 0], [b, g === 1 ? 1 : 0]].forEach(([d, w]) => {
      const cols = [...new Set(Object.keys(d.cartes).map(id => Combat.carte(id).col).filter(c => c !== 'neutre'))].sort();
      for (const c of cols) { const p = (parCouleur[c] = parCouleur[c] || { n: 0, w: 0, cartes: {} }); p.n++; p.w += w; }
      const t = (parCouleur.tous = parCouleur.tous || { n: 0, w: 0, cartes: {} }); t.n++; t.w += w;
      for (const id of Object.keys(d.cartes)) vu(id, w, cols);
    });
    if (i % 200 === 199) process.stderr.write(`${i + 1} parties\n`);
  }
  return { N, graine, cartes: st, couleurs: parCouleur };
}

function fusion(fichiers) {
  const cartes = {}, couleurs = {};
  let N = 0;
  for (const f of fichiers) {
    const x = JSON.parse(fs.readFileSync(f, 'utf8'));
    N += x.N;
    for (const id in x.cartes) { const s = (cartes[id] = cartes[id] || { n: 0, w: 0 }); s.n += x.cartes[id].n; s.w += x.cartes[id].w; }
    for (const k in x.couleurs) { const s = (couleurs[k] = couleurs[k] || { n: 0, w: 0 }); s.n += x.couleurs[k].n; s.w += x.couleurs[k].w; }
  }
  /* La cote : victoires des decks qui la jouent, moins celles des decks de
     sa couleur qui ne la jouent pas. Peu de parties : ramenée vers 0 (un
     prior de 60 parties à la moyenne de la couleur). */
  const out = {};
  for (const id in cartes) {
    const c = Combat.carte(id);
    if (!c) continue;
    const coul = c.col === 'neutre' ? couleurs.tous : couleurs[c.col];
    if (!coul) continue;
    const s = cartes[id];
    const sans = { n: coul.n - s.n, w: coul.w - s.w };
    if (sans.n < 30) continue;
    const base = sans.w / sans.n;
    const avec = (s.w + 60 * base) / (s.n + 60);
    out[id] = Math.round(1000 * (avec - base)) / 1000;
  }
  return { N, out };
}

/* Écrit les cotes dans js/combat/decks.js, entre les marques. */
function ecrire(cotes, N) {
  const f = path.join(__dirname, '../js/combat/decks.js');
  let s = fs.readFileSync(f, 'utf8');
  const ids = Object.keys(cotes).sort();
  const lignes = [];
  for (let i = 0; i < ids.length; i += 8) lignes.push('  ' + ids.slice(i, i + 8).map(id => `${id}: ${cotes[id]}`).join(', ') + ',');
  const bloc = `/* COTES:debut — généré par tools/assistant-decks.js (${N} parties), ne pas modifier à la main. */
const COTES = {
${lignes.join('\n').replace(/,$/, '')}
};
/* COTES:fin */`;
  s = s.replace(/\/\* COTES:debut[\s\S]*?\/\* COTES:fin \*\//, bloc);
  fs.writeFileSync(f, s);
}

/* Les adversaires d'une mesure : les deux Starters, et des decks tirés au
   sort (niveau 3), les mêmes pour chaque deck mesuré. */
function serie(n) {
  const r = rng(424242);
  const l = [Decks.STARTERS.toxique, Decks.STARTERS.deter];
  while (l.length < n) l.push(Decks.aleatoire(r, { niveau: 3 }));
  return l;
}
function mesurerDeck(d, adversaires, parties, niveau) {
  let g = 0, n = 0;
  for (let i = 0; i < parties; i++) {
    const adv = adversaires[i % adversaires.length];
    const moiDabord = i % 2 === 0;
    const w = moiDabord ? partie(d, adv, 90000 + i, niveau) : partie(adv, d, 90000 + i, niveau);
    if (w < 0) continue;
    n++;
    if ((moiDabord && w === 0) || (!moiDabord && w === 1)) g++;
  }
  return g / Math.max(1, n);
}

/* L'ancien « Compléter pour moi » (jusqu'à la 3.0.13, js/combat/atelier.js),
   pour comparer : les cartes de plus grande valeur pour l'IA (IA.valeurCarte),
   vers la composition CIBLES, dans les couleurs données. */
function completerAncien(prefs, possede) {
  const d = { cartes: {} };
  const couleurs = new Set(prefs.couleurs || []);
  const cible = Decks.CIBLES;
  const fam = c => (c.cat === 'joueur' ? 'joueur' : c.cat === 'objet' ? 'objet' : 'instant');
  const compte = f => Object.keys(d.cartes).filter(id => fam(Combat.carte(id)) === f).reduce((s, id) => s + d.cartes[id], 0);
  const cands = Combat.toutes().filter(c => Decks.jouable(c) && possede[c.id] > 0 && (!couleurs.size || c.col === 'neutre' || couleurs.has(c.col)))
    .sort((a, b) => IA.valeurCarte(b.id) - IA.valeurCarte(a.id));
  const place = c => {
    const cle = Decks.cleCopie(c.id);
    const tot = Object.keys(d.cartes).filter(id => Decks.cleCopie(id) === cle).reduce((s, id) => s + d.cartes[id], 0);
    return tot < Decks.limite(c.id) && (d.cartes[c.id] || 0) < (possede[c.id] || 0);
  };
  let garde = 0;
  while (Decks.total(d.cartes) < Combat.REGLE.CLUB && garde++ < 200) {
    const manque = ['joueur', 'objet', 'instant'].sort((a, b) => (compte(a) / cible[a]) - (compte(b) / cible[b]));
    let pris = null;
    for (const f of manque) { pris = cands.find(c => fam(c) === f && place(c)); if (pris) break; }
    if (!pris) pris = cands.find(place);
    if (!pris) break;
    d.cartes[pris.id] = (d.cartes[pris.id] || 0) + 1;
  }
  d.reserve = Decks.reserveAuto(d.cartes, [...couleurs][0] || 'rose');
  return d;
}

function toutPosseder() {
  const p = {};
  for (const c of Combat.toutes()) if (Decks.jouable(c)) p[c.id] = 3;
  return p;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'cotes') {
  process.stdout.write(JSON.stringify(cotes(+args[0] || 500, +args[1] || 1)));
} else if (mode === 'fusion') {
  const { N, out } = fusion(args);
  ecrire(out, N);
  const tri = Object.entries(out).sort((a, b) => b[1] - a[1]);
  console.log(`${N} parties, ${tri.length} cartes cotées`);
  console.log('les meilleures :', tri.slice(0, 12).map(([id, v]) => `${Combat.carte(id).nom} ${v}`).join(' · '));
  console.log('les moins bonnes :', tri.slice(-8).map(([id, v]) => `${Combat.carte(id).nom} ${v}`).join(' · '));
} else if (mode === 'mesurer') {
  const parties = +args[0] || 40, niveau = +args[1] || 3;
  const adv = serie(10);
  const possede = toutPosseder();
  const lignes = [];
  for (const coul of (process.env.COULEURS || COULEURS.join(',')).split(',')) {
    for (const style of (process.env.STYLES || 'rapide,equilibre,solide').split(',')) {
      const d = Decks.assistant({ couleurs: [coul], style }, possede).deck;
      const v = mesurerDeck(d, adv, parties, niveau);
      lignes.push({ coul, style, v });
      process.stderr.write(`${coul} ${style} : ${Math.round(100 * v)} %\n`);
    }
    {
      const a = completerAncien({ couleurs: [coul] }, possede);
      const v = mesurerDeck(a, adv, parties, niveau);
      lignes.push({ coul, style: 'ancien', v });
      process.stderr.write(`${coul} ancien « Compléter pour moi » : ${Math.round(100 * v)} %\n`);
    }
  }
  console.log(JSON.stringify(lignes));
} else if (mode === 'auto') {
  /* Les couleurs au choix de l'assistant : avec toute la collection, puis
     avec une collection partielle (chaque carte possédée avec la probabilité
     `part`, en 1 à 3 exemplaires), contre la même série. */
  const parties = +args[0] || 40, niveau = +args[1] || 3, part = +(args[2] || 1);
  const adv = serie(10);
  const r = rng(777);
  const lignes = [];
  for (let k = 0; k < (+process.env.COLLECTIONS || 1); k++) {
    const possede = {};
    for (const c of Combat.toutes()) if (Decks.jouable(c) && r() < part) possede[c.id] = 1 + Math.floor(r() * 3);
    for (const style of ['rapide', 'equilibre', 'solide']) {
      const x = Decks.assistant({ style }, possede);
      const v = mesurerDeck(x.deck, adv, parties, niveau);
      const a = completerAncien({ couleurs: x.couleurs }, possede);
      const va = mesurerDeck(a, adv, parties, niveau);
      lignes.push({ collection: k, part, style, couleurs: x.couleurs, complet: x.complet, v, ancien: va });
      process.stderr.write(`collection ${k} (${Math.round(100 * part)} %) ${style} : ${x.couleurs.join('+')} ${Math.round(100 * v)} % (ancien, mêmes couleurs : ${Math.round(100 * va)} %)\n`);
    }
  }
  console.log(JSON.stringify(lignes));
} else {
  console.log('node tools/assistant-decks.js cotes <parties> <graine> | fusion fichiers… | mesurer [parties] [niveau] | auto [parties] [niveau] [part]');
}
