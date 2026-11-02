#!/usr/bin/env node
/* La cote de chaque carte (Decks.COTES), montrée dans l'atelier en cinq
   barres et par le tri « Cote » : ce qu'une carte ajoute aux victoires de sa
   couleur, mesuré.

     node tools/cotes-cartes.js cotes <parties> <graine> > part.json
     node tools/cotes-cartes.js fusion part-*.json

   1. `cotes` : des parties entre decks tirés au sort (Decks.aleatoire, dans
      une ou deux couleurs, l'adversaire du jeu au niveau 2 des deux côtés),
      et pour chaque carte, les parties gagnées par les decks qui la jouent.
   2. `fusion` : la cote de chaque carte — la part de victoires des decks
      qui la jouent, moins celle des decks de sa couleur qui ne la jouent pas
      (pour une Neutre : tous les decks). Elle s'écrit dans js/combat/decks.js,
      entre les marques COTES (Decks.COTES).

   L'assistant de deck qui s'en servait (3.0.14) a été retiré le 2 novembre
   2026, à la demande du propriétaire : il « ruine tout l'aspect création et
   plaisir de créer ». Les clés de l'analyse (Decks.cles) le remplacent. */
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
  const bloc = `/* COTES:debut — généré par tools/cotes-cartes.js (${N} parties), ne pas modifier à la main. */
const COTES = {
${lignes.join('\n').replace(/,$/, '')}
};
/* COTES:fin */`;
  s = s.replace(/\/\* COTES:debut[\s\S]*?\/\* COTES:fin \*\//, bloc);
  fs.writeFileSync(f, s);
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
} else {
  console.log('node tools/cotes-cartes.js cotes <parties> <graine> | fusion fichiers…');
}
