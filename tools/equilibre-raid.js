#!/usr/bin/env node
/* L'équilibre du Raid (version 3.0.14).

   Le propriétaire : « Équilibre bien le raid pour un serveur avec une
   dizaine de joueurs actifs, et rends la tâche pas trop facile, finir la
   dernière phase doit être ressenti comme un vrai exploit. »

     node tools/equilibre-raid.js mesurer <boss> <profil> <N> > mesure.json
     node tools/equilibre-raid.js simuler mesure-*.json

   1. `mesurer` : N combats par phase contre un boss (c116 ou c121), joués
      par un profil de joueur (le joueur tenu par l'adversaire du jeu, à un
      niveau donné, avec un deck donné). Rend, par phase, les dégâts que le
      serveur compte (raid_fin, 27_raid.sql : une victoire vaut les PV de la
      phase + 4 ; une défaite, les PV pris, plafonnés aux PV de la phase + 1).
   2. `simuler` : une saison de 14 jours, 2 000 fois, pour trois serveurs
      (des profils et une activité, SERVEURS plus bas) : chaque jour, chaque
      tentative tire ses dégâts dans la mesure de la phase en cours ; le
      jour où chaque phase tombe, et la part des saisons où la sixième
      tombe. Les seuils sont ceux du jeu (RAID.phases), multipliés par la
      vie du boss (RAID.bosses › vie) ; SEUILS=… et VIE_C121=… en essaient
      d'autres.

   Ce qui a fixé les chiffres de la 3.0.14 (docs/economie-3.0.md, § 3) :
   N = 100. Dégâts par tentative, phases 1 à 6, en moyenne des trois
   profils : le Sorcier 6,9 6,9 6,1 7,0 6,4 4,0 ; le Marionnettiste 6,4 6,2
   5,7 5,4 4,4 3,3. Aux seuils de la 3.0.13 (120 … 1 600), dix joueurs
   actifs n'abattaient jamais la sixième phase. Aux seuils 100, 250, 450,
   700, 1 000, 1 400 et la vie du Marionnettiste à 0,8 : la sixième tombe
   le dernier jour, 62 % des saisons (Sorcier) et 50 % (Marionnettiste) ;
   le 9ᵉ jour si tous jouent leurs trois tentatives ; jamais pour six
   joueurs calmes (la phase 3).

   Version 3.0.16 (le propriétaire : « beaucoup trop compliqué, surtout en
   mode infini, facilite-le un chouille ») : les combats plus doux d'un cran
   (RAID.phases : IA 2 2 3 3 4 4, PV 5 6 6 7 7 8, Essences 0 0 1 1 1 2 ;
   l'Infini comme la phase 6). N = 60 : le Sorcier 7,4 6,7 6,7 6,7 7,5 6,5 ;
   le Marionnettiste 6,6 5,9 6,2 5,2 5,6 4,9. Aux seuils 115, 290, 520, 810,
   1 150, 1 620 : la sixième tombe le 14ᵉ jour, 98 % des saisons (Sorcier)
   et 88 % (Marionnettiste) ; aux seuils d'avant, le 13ᵉ jour, presque à
   coup sûr ; à 120 … 1 700, 76 et 46 %. */
"use strict";
const fs = require('fs');
const S = require('./combat-sim.js');
const { Combat, Decks, IA, Choc, rng } = S;

const PROFILS = {
  /* Un nouveau venu : un Starter, l'adversaire du jeu au niveau 2 pour lui. */
  debutant: { niveau: 2, deck: i => Decks.STARTERS[i % 2 ? 'toxique' : 'deter'] },
  /* Un joueur régulier : un Starter, niveau 3. */
  regulier: { niveau: 3, deck: i => Decks.STARTERS[i % 2 ? 'toxique' : 'deter'] },
  /* Un joueur fort : un Starter, niveau 4. (Un deck tiré au sort, même au
     meilleur niveau, joue moins bien qu'un Starter : mesuré, il faisait d'un
     « fort » un joueur plus faible que le régulier.) */
  fort: { niveau: 4, deck: i => Decks.STARTERS[i % 2 ? 'toxique' : 'deter'] }
};

function mesurer(boss, profil, N) {
  const P = PROFILS[profil];
  const out = { boss, profil, N, phases: [] };
  for (let k = 1; k <= 6; k++) {
    const cle = 'p' + k;
    const c = Choc.raidCombat(cle, boss);
    const pvServeur = Choc.RAID.phases[k - 1].pv;
    const degats = [];
    let victoires = 0;
    for (let i = 0; i < N; i++) {
      const jour = '2026-11-' + String(1 + (i % 14)).padStart(2, '0');
      const init = { decks: [Decks.versMoteur(P.deck(i)), Decks.versMoteur(Choc.deckBoss(jour, cle, boss))],
        graine: 31000 + k * 997 + i, noms: ['Toi', 'Boss'], pv: [c.pvMoi, c.pvBoss], essDepart: [0, c.ess], poses: Choc.posesBoss(boss) };
      const E = Combat.creer(init);
      let g = 0;
      while (Combat.demande(E) && g++ < 4000) { const d = Combat.demande(E); Combat.agir(E, IA.choisir(E, { niveau: d.qui === 0 ? P.niveau : c.ia })); }
      const v = S.Verif.verdict(E, 0);
      const d = v.gagne ? pvServeur + 1 + 3 : Math.min(pvServeur + 1, v.touches);
      if (v.gagne) victoires++;
      degats.push(d);
    }
    out.phases.push({ phase: k, victoires: victoires / N, moyenne: degats.reduce((a, b) => a + b, 0) / N, degats });
    process.stderr.write(`${boss} ${profil} phase ${k} : ${Math.round(100 * victoires / N)} % de victoires, ${(degats.reduce((a, b) => a + b, 0) / N).toFixed(1)} dégâts\n`);
  }
  return out;
}

/* Le serveur : dix joueurs actifs. `activite` : tentatives par jour, en
   moyenne (un joueur ne joue pas forcément tous les jours). */
const SERVEURS = {
  /* Ce que le propriétaire décrit : une dizaine de joueurs actifs. */
  dizaine: [
    { n: 3, profil: 'fort', activite: 2.6 },
    { n: 4, profil: 'regulier', activite: 1.8 },
    { n: 3, profil: 'debutant', activite: 1.0 }
  ],
  /* Les mêmes, tous à fond (3 tentatives chaque jour). */
  acharnes: [
    { n: 3, profil: 'fort', activite: 3 },
    { n: 4, profil: 'regulier', activite: 3 },
    { n: 3, profil: 'debutant', activite: 3 }
  ],
  /* Un serveur plus calme : six joueurs, une tentative par jour. */
  calme: [
    { n: 2, profil: 'fort', activite: 1.2 },
    { n: 2, profil: 'regulier', activite: 1 },
    { n: 2, profil: 'debutant', activite: 0.6 }
  ]
};
const SEUILS = {
  /* Ceux du jeu (RAID.phases) ; jusqu'à la 3.0.13 : 120, 300, 550, 850, 1200, 1600. */
  actuels: Choc.RAID.phases.map(p => p.seuil),
  proposes: (process.env.SEUILS || '').split(',').filter(Boolean).map(Number)
};

/* La vie d'un boss (RAID.bosses › vie) : ses seuils, multipliés. VIE_C121=0.8
   pour en essayer une autre. */
const vieDe = boss => +(process.env['VIE_' + boss.toUpperCase()] || (Choc.RAID.bosses.find(b => b.id === boss) || {}).vie || 1);

function simuler(mesures, seuils0, serveur, R = 2000) {
  const par = {};
  for (const m of mesures) (par[m.boss] = par[m.boss] || {})[m.profil] = m.phases;
  const r = rng(99);
  const res = {};
  for (const boss of Object.keys(par)) {
    const seuils = seuils0.map(x => Math.round(x * vieDe(boss)));
    const jours = seuils.map(() => []);
    for (let it = 0; it < R; it++) {
      let total = 0, k = 0;
      const tombe = seuils.map(() => null);
      for (let jour = 1; jour <= 14 && k < 6; jour++) {
        for (const g of serveur) {
          for (let j = 0; j < g.n; j++) {
            /* Le nombre de tentatives de ce joueur ce jour-là (au plus 3). */
            let t = Math.floor(g.activite) + (r() < g.activite % 1 ? 1 : 0);
            t = Math.min(3, t);
            for (let a = 0; a < t && k < 6; a++) {
              const l = par[boss][g.profil][k].degats;
              total += l[Math.floor(r() * l.length)];
              while (k < 6 && total >= seuils[k]) { tombe[k] = jour; k++; }
            }
          }
        }
      }
      tombe.forEach((d, i) => jours[i].push(d == null ? 99 : d));
    }
    res[boss] = jours.map(l => {
      const s = l.slice().sort((a, b) => a - b);
      const q = p => s[Math.floor(p * (s.length - 1))];
      return { mediane: q(.5), q1: q(.25), q3: q(.75), tombe: l.filter(x => x <= 14).length / l.length };
    });
  }
  return res;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'mesurer') {
  const [boss, profil, N] = args;
  process.stdout.write(JSON.stringify(mesurer(boss, profil, +N || 20)));
} else if (mode === 'simuler') {
  const mesures = args.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const aff = x => (x > 14 ? '—' : x);
  for (const [nomS, seuils] of Object.entries(SEUILS)) {
    if (!seuils.length) continue;
    console.log(`\n== Seuils ${nomS} : ${seuils.join(', ')}`);
    for (const [nomV, serveur] of Object.entries(SERVEURS)) {
      const res = simuler(mesures, seuils, serveur);
      for (const boss of Object.keys(res)) {
        console.log(`  ${nomV.padEnd(9)} ${boss} (vie ${vieDe(boss)}) : ` + res[boss].map((p, i) => `P${i + 1} j${aff(p.mediane)} (${Math.round(100 * p.tombe)} %)`).join(' · '));
      }
    }
  }
} else {
  console.log('node tools/equilibre-raid.js mesurer <c116|c121> <debutant|regulier|fort> <N> | simuler fichiers…');
}
