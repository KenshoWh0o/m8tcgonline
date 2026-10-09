#!/usr/bin/env node
/* Road to Worlds : simule des parties avec un joueur automatique, pour
   régler les objectifs. Pas un joueur parfait : il pose le meilleur coup de
   sa main, remplace quand ce coup ne suffira pas, et achète simplement.

       node tools/run-sim.js [parties] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/cards-data.js'), 'utf8').replace('const CARD_DATA', 'globalThis.CARD_DATA'), ctx);
const R = require(path.join(ROOT, 'run/moteur.js'));
R.charger(ctx.CARD_DATA);

function sousEnsembles(l, max) {
  const out = [];
  const rec = (i, cur) => {
    if (cur.length) out.push(cur.slice());
    if (cur.length === max) return;
    for (let j = i; j < l.length; j++) { cur.push(l[j]); rec(j + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

function meilleurCoup(e) {
  let best = null;
  for (const s of sousEnsembles(e.m.main, 5)) {
    if (R.peutJouer(e, s.map(c => c.uid))) continue;
    const r = R.calculer(e, s);
    if (!best || r.total > best.r.total) best = { s, r };
  }
  return best;
}

function jouerMatch(e) {
  R.debutMatch(e);
  for (;;) {
    const b = meilleurCoup(e);
    const reste = e.m.cible - e.m.score;
    if (b && b.r.total * e.m.manches < reste && e.m.remplacements > 0) {
      const garde = new Set(b.r.comptees);
      const jeter = e.m.main.filter(c => !garde.has(c.uid))
        .sort((a, c) => R.joueur(a.num).pts - R.joueur(c.num).pts).slice(0, 5).map(c => c.uid);
      if (jeter.length) { R.remplacer(e, jeter); continue; }
    }
    const res = R.jouer(e, b.s.map(c => c.uid));
    if (res.issue) return res.issue;
  }
}

const VALEUR = { lux3: 9, pause: 7, m4: 6, maudit: 5, m25: 5, invitation: 3, chevaliere: 4, m16: 6, barakataga: 6, jus: 6, zacking: 5, m24: 6,
  ravrose: 4, ravmauve: 4, slip: 3, cooked: 3, trahison: 4, coach: 3, grosbonnet: 4, lofi: 5, lyon: 5, japon: 3, lux1: 3, lux2: 3, ombre: 4, mercato: 1 };

function magasiner(e) {
  for (let tour = 0; tour < 6; tour++) {
    const o = e.shop.offres.map((x, i) => ({ x, i })).filter(({ x }) => !x.vendu && x.prix <= e.argent);
    const staff = o.filter(({ x }) => x.type === 'staff' && e.staff.length < R.PLACES).sort((a, b) => VALEUR[b.x.id] - VALEUR[a.x.id])[0];
    if (staff) { R.acheter(e, staff.i); continue; }
    const mom = o.find(({ x }) => x.type === 'moment');
    if (mom) { R.acheter(e, mom.i); continue; }
    const j = o.find(({ x }) => x.type === 'joueur' && ['E', 'L', 'R'].includes(R.joueur(x.num).rar));
    if (j && e.argent - j.x.prix >= 2) { R.acheter(e, j.i); continue; }
    break;
  }
}

const N = +process.argv[2] || 300;
const fin = {};
const meilleurs = [];
for (let k = 0; k < N; k++) {
  const e = R.nouvellePartie('sim' + k);
  while (!e.fini) {
    const issue = jouerMatch(e);
    if (issue === 'perdu') break;
    R.finMatch(e);
    if (e.shop && !e.fini) magasiner(e);
  }
  const cle = e.fini.victoire ? 'Victoire' : `${R.ETAPES[e.fini.etape].nom} · ${R.MATCHS[e.fini.match].nom}`;
  fin[cle] = (fin[cle] || 0) + 1;
  meilleurs.push(e.stats.meilleur);
}
const ordre = Object.entries(fin).sort((a, b) => b[1] - a[1]);
console.log(`${N} parties`);
ordre.forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${(v * 100 / N).toFixed(1)} %`));
meilleurs.sort((a, b) => a - b);
console.log('meilleur coup, médiane', meilleurs[Math.floor(N / 2)], 'max', meilleurs[N - 1]);
