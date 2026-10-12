#!/usr/bin/env node
/* Banc d'essai du combat (version 3.0) : des parties entières, sans
   navigateur, pour éprouver le moteur et régler les valeurs de la partie.

     node tools/combat-sim.js aleatoire 2000     parties au hasard : plantages
     node tools/combat-sim.js ia 200 [n1] [n2]   IA contre IA : durée, équilibre
     node tools/combat-sim.js starters 200 [n]   Toxique contre Déter

   Les fichiers du jeu sont chargés tels quels, dans un même contexte —
   comme le navigateur charge ses scripts. */
"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math, JSON, Date, Intl, setTimeout, clearTimeout });
ctx.globalThis = ctx;
ctx.window = ctx;
for (const f of ['js/config.js', 'js/utils.js', 'js/cards-data.js', 'js/promos-data.js', 'js/cards.js',
  'js/combat/moteur.js', 'js/combat/effets.js', 'js/combat/decks.js', 'js/combat/ia.js',
  'js/combat/campagne.js', 'js/combat/choc-data.js', 'js/combat/niveaux.js']) {
  const p = path.join(RACINE, f);
  if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  var __cartes = buildCards();
  var __liste = __cartes.concat(buildPromos(), buildReverses(__cartes), buildUniques(), buildSecretes());
  Combat.catalogue(__liste);
`, ctx);
const Combat = ctx.Combat, Decks = ctx.Decks, IA = ctx.IA;
/* L'événement du Choc des Sections (ses `const` ne sont pas des propriétés
   du contexte : on les sort une par une). */
const Choc = vm.runInContext('({ CHOC, chocPhase, chocPhaseMax, deckSorcier, posesBoss, epreuveDuJour, scoreEpreuve })', ctx);
const Campagne = vm.runInContext('({ combatsCampagne, deckRival, SECTIONS })', ctx);
const Niveaux = vm.runInContext('({ NIVEAUX, xpRequis, niveauDe, xpCombat, recompenseNiveau, prochainsPaliers })', ctx);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Une action au hasard, parmi celles permises. */
function auHasard(E, r) {
  const d = Combat.demande(E);
  if (d.type === 'tour') {
    const o = Combat.optionsTour(E);
    /* Un joueur au hasard qui finirait son tour une fois sur deux ne ferait
       jamais rien : il ne le finit que quand il n'a plus envie d'autre chose. */
    const autres = o.filter(a => a.t !== 'finTour');
    if (autres.length && r() < 0.85) return autres[Math.floor(r() * autres.length)];
    return o.find(a => a.t === 'finTour') || o[Math.floor(r() * o.length)];
  }
  if (d.type === 'choix') return { t: 'choix', v: d.options[Math.floor(r() * d.options.length)].v };
  if (d.type === 'cartes') {
    const n = d.min + Math.floor(r() * (d.max - d.min + 1));
    const l = d.parmi.slice().sort(() => r() - 0.5).slice(0, n);
    return { t: 'cartes', u: l };
  }
  if (d.type === 'ordre') return { t: 'ordre', u: d.parmi.slice().sort(() => r() - 0.5) };
  throw new Error('demande inconnue ' + d.type);
}

function partie(decks, seed, joueurs, opts) {
  const E = Combat.creer(Object.assign({ decks: decks.map(d => Decks.versMoteur(d)), graine: seed, noms: ['A', 'B'] }, opts || {}));
  const r = rng(seed * 7 + 1);
  let n = 0;
  while (Combat.demande(E)) {
    if (++n > 4000) throw new Error('partie sans fin');
    const d = Combat.demande(E);
    const a = joueurs[d.qui](E, r);
    Combat.agir(E, a);
  }
  return E;
}

const mode = require.main === module ? (process.argv[2] || 'aleatoire') : null;
const N = +process.argv[3] || 200;

if (mode === 'aleatoire') {
  const r0 = rng(42);
  let ok = 0, tours = 0, fins = {};
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const d1 = Decks.aleatoire(r0, { niveau: 1 + (i % 5) });
    const d2 = Decks.aleatoire(r0, { niveau: 1 + ((i + 2) % 5) });
    for (const d of [d1, d2]) {
      const e = Decks.verifier(d);
      if (e.length) { console.log('deck invalide', e, JSON.stringify(d)); process.exit(1); }
    }
    let E;
    try {
      E = partie([d1, d2], 1000 + i, [auHasard, auHasard]);
      /* La copie d'une partie doit donner la même partie. */
      if (i % 25 === 0) {
        const C = Combat.rejouer(E.init, E.journal);
        if (JSON.stringify(C) !== JSON.stringify(E)) throw new Error('rejouer ne redonne pas la même partie');
      }
    } catch (e) {
      console.log('PLANTAGE partie', i, e.stack);
      process.exit(1);
    }
    ok++;
    tours += E.tour;
    fins[E.fin.raison] = (fins[E.fin.raison] || 0) + 1;
  }
  console.log(`${ok} parties au hasard sans plantage — ${(tours / ok).toFixed(1)} tours en moyenne — fins`, fins, `— ${Date.now() - t0} ms`);
}

if (mode === 'clone') {
  /* Une copie en cours de partie rejoue exactement la même suite. */
  const r0 = rng(7);
  for (let i = 0; i < N; i++) {
    const d1 = Decks.aleatoire(r0, {}), d2 = Decks.aleatoire(r0, {});
    const E = Combat.creer({ decks: [Decks.versMoteur(d1), Decks.versMoteur(d2)], graine: 500 + i });
    const r = rng(i);
    let n = 0;
    while (Combat.demande(E) && n++ < 3000) {
      if (n % 17 === 0) {
        const C = Combat.cloner(E);
        const a = JSON.stringify(C), b = JSON.stringify(E);
        if (a !== b) {
          console.log('CLONE DIFFÉRENT partie', i, 'action', n);
          fs.writeFileSync('/tmp/a.json', a); fs.writeFileSync('/tmp/b.json', b);
          process.exit(1);
        }
      }
      Combat.agir(E, auHasard(E, r));
    }
  }
  console.log(N, 'parties : les copies sont fidèles');
}

if ((mode === 'ia' || mode === 'starters') && IA) {
  const n1 = +process.argv[4] || 3, n2 = +process.argv[5] || n1;
  const r0 = rng(99);
  let gagne = [0, 0], tours = 0, premier = 0, fins = {}, t0 = Date.now(), decisions = 0;
  for (let i = 0; i < N; i++) {
    const d1 = mode === 'starters' ? Decks.STARTERS.toxique : Decks.aleatoire(r0, { niveau: 3 });
    const d2 = mode === 'starters' ? Decks.STARTERS.deter : Decks.aleatoire(r0, { niveau: 3 });
    const joueur = niv => (E) => { decisions++; return IA.choisir(E, { niveau: niv }); };
    const E = partie(i % 2 ? [d2, d1] : [d1, d2], 2000 + i, i % 2 ? [joueur(n2), joueur(n1)] : [joueur(n1), joueur(n2)]);
    const g = i % 2 ? 1 - E.fin.gagnant : E.fin.gagnant;
    gagne[g]++;
    if (E.fin.gagnant === E.premier) premier++;
    tours += E.tour;
    fins[E.fin.raison] = (fins[E.fin.raison] || 0) + 1;
  }
  const ms = Date.now() - t0;
  console.log(`${mode} niveaux ${n1}/${n2} : victoires ${gagne[0]} / ${gagne[1]} — le premier joueur gagne ${Math.round(100 * premier / N)} % — ${(tours / N).toFixed(1)} tours — fins`, fins,
    `— ${(ms / N).toFixed(0)} ms/partie, ${(ms / decisions).toFixed(2)} ms/décision`);
}

module.exports = { Combat, Decks, IA, Choc, Campagne, Niveaux, partie, auHasard, rng };
