#!/usr/bin/env node
/* Le Circuit : simulations d'équilibrage.
     node tools/circuit-sim.js matchs   — l'IA contre elle-même, équipes miroir
     node tools/circuit-sim.js saisons  — des saisons entières, le joueur joué par l'IA */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/cards-data.js'), 'utf8').replace('const CARD_DATA', 'globalThis.CARD_DATA'), ctx);
const C = require(path.join(ROOT, 'circuit/moteur.js'));
C.charger(ctx.CARD_DATA);

const valeurJ = num => { const j = C.joueur(num); return j.def + Math.max(0, ...j.atks.map(a => (a.degats || 40) / Math.max(1, Object.values(a.cout).reduce((x, y) => x + y, 0)) * 1.5)); };

function jouerMatch(s) {
  C.debutMatch(s);
  let n = 0;
  while (!s.m.fini && n++ < 300) { if (s.m.entreManches) C.mancheSuivante(s); else C.ia(s); }
  return C.finMatch(s);
}

function saison(k) {
  const s = C.nouvelleSaison('sim' + k);
  C.choisirCoach(s, s.offres[0]);
  while (s.etape === 'draft') {
    const best = s.draft.choix.slice().sort((a, b) => valeurJ(b) - valeurJ(a))[0];
    C.choisirDraft(s, best);
  }
  const longueurs = [];
  while (s.etape !== 'fin') {
    if (s.etape === 'tableau') {
      const r = jouerMatch(s);
      longueurs.push(r);
    } else if (s.etape === 'recompense') {
      const o = s.offres;
      let i = o.findIndex(x => x.type === 'joueur' && valeurJ(x.num) > Math.min(...s.roster.map(y => valeurJ(y.num))) + 20);
      if (i >= 0) {
        const pire = s.roster.slice().sort((a, b) => valeurJ(a.num) - valeurJ(b.num))[0];
        C.prendre(s, i, pire.uid);
      } else {
        i = o.findIndex(x => x.type === 'objet' || x.type === 'bootcamp');
        if (i >= 0) {
          const cible = s.roster.slice().sort((a, b) => a.objets.length - b.objets.length || valeurJ(b.num) - valeurJ(a.num))[0];
          C.prendre(s, i, cible.uid);
        } else C.passer(s);
      }
    }
  }
  return s;
}

const mode = process.argv[2] || 'saisons';
const N = +process.argv[3] || 400;
if (mode === 'matchs') {
  let premier = 0, tours = 0, temps = 0, n = 0;
  for (let k = 0; k < N; k++) {
    const s = C.nouvelleSaison('m' + k);
    C.choisirCoach(s, s.offres[0]);
    while (s.etape === 'draft') C.choisirDraft(s, s.draft.choix[0]);
    /* Miroir : l'adversaire du premier match tiré au même niveau. */
    /* Une seule manche : celui qui commence gagne-t-il trop souvent ? */
    C.debutMatch(s);
    let g = 0;
    while (!s.m.entreManches && !s.m.fini && g++ < 300) C.ia(s);
    if (s.m.score.moi) premier++;
    tours += s.m.tour; n++;
  }
  console.log(`${N} matchs (Qualifs, quart) — premier joueur gagne ${(premier * 100 / n).toFixed(1)} %, ${(tours / n).toFixed(1)} tours par manche`);
} else {
  const fin = {};
  let tours = 0, matchs = 0;
  for (let k = 0; k < N; k++) {
    const s = saison(k);
    const cle = s.fini.victoire ? 'Champion du monde' : `${C.TOURNOIS[s.fini.tournoi].nom} · ${C.TOURS_TABLEAU[s.fini.tour]}`;
    fin[cle] = (fin[cle] || 0) + 1;
    tours += s.stats.tours; matchs += s.stats.matchs;
  }
  console.log(`${N} saisons, ${(matchs / N).toFixed(1)} matchs par saison, ${(tours / matchs).toFixed(1)} tours par match`);
  Object.entries(fin).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${(v * 100 / N).toFixed(1)} %`));
}
