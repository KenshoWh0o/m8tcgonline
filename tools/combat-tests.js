#!/usr/bin/env node
/* Les règles du combat, une par une (version 3.0).

     node tools/combat-tests.js

   Chaque test pose une situation à la main — qui est sur quelle ligne,
   engagé ou non, avec quelles Essences — puis joue des actions et vérifie
   ce que dit la règle (docs/regles-3.0.md). */
"use strict";
const { Combat, Decks, Choc, Campagne } = require('./combat-sim.js');

let ok = 0, ko = 0;
function test(nom, f) {
  try { f(); ok++; console.log('  ✓ ' + nom); }
  catch (e) { ko++; console.log('  ✗ ' + nom + '\n      ' + (e.stack || e).split('\n').slice(0, 3).join('\n      ')); }
}
function egal(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }
function vrai(x, m) { if (!x) throw new Error(m || 'faux'); }

/* Une partie dont on fixe tout : deux Clubs de 30 cartes de remplissage,
   puis on pose ce qu'on veut où on veut. */
function situation(o) {
  const remplir = id => Array(30).fill(id || 'c078');
  const E = Combat.creer({ decks: [{ club: remplir(o.club0), reserve: Array(10).fill(o.coul0 || 'rose') }, { club: remplir(o.club1), reserve: Array(10).fill(o.coul1 || 'mauve') }], graine: 1, premier: 0 });
  /* Garder les deux mains. */
  while (Combat.demande(E).but === 'mulligan') Combat.agir(E, { t: 'choix', v: 'oui' });
  /* On est au premier tour de 0 : on passe au tour 3 (le second tour de 0)
     pour pouvoir attaquer. */
  Combat.agir(E, { t: 'finTour' });
  Combat.agir(E, { t: 'finTour' });
  for (const j of [0, 1]) {
    const P = E.j[j];
    P.lignes = [null, null, null];
    P.main = [];
    P.ess = [];
    const lignes = (o.lignes || [])[j] || [];
    lignes.forEach((x, i) => {
      if (!x) return;
      const [id, opts] = Array.isArray(x) ? x : [x, {}];
      const c = { u: ++E.seq, id, j, eng: !!opts.eng, obj: [], tour: 0, shieldUse: false, nAtt: 0 };
      for (const oid of opts.obj || []) c.obj.push({ u: ++E.seq, id: oid, j });
      P.lignes[i] = c;
    });
    for (const coul of (o.ess || [])[j] || []) P.ess.push({ u: ++E.seq, coul, eng: false, j });
    for (const id of (o.main || [])[j] || []) P.main.push({ u: ++E.seq, id, j });
    if (o.pv && o.pv[j] != null) P.pv = P.pv.slice(0, o.pv[j]);
  }
  return E;
}
const L = (E, j, i) => E.j[j].lignes[i];
const options = E => Combat.optionsTour(E);
const attaques = (E, u) => options(E).filter(a => a.t === 'attaquer' && a.u === u);
const repondre = (E, v) => Combat.agir(E, { t: 'choix', v });

console.log('Cibles et défense');
test('on vise le CEO ou un Joueur engagé, jamais un Joueur désengagé', () => {
  const E = situation({ lignes: [['c078'], ['c057', ['c074', { eng: true }], 'c051']], ess: [['rose', 'rose']] });
  const cibles = attaques(E, L(E, 0, 0).u).filter(a => a.k === 0).map(a => a.cible);
  egal(cibles.sort(), ['ceo', L(E, 1, 1).u].sort());
});
test('Provocation en face impose sa cible', () => {
  const E = situation({ lignes: [['c078'], ['c058', ['c074', { eng: true }]]], ess: [['rose', 'rose']] });
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], [L(E, 1, 0).u]);
});
test('Slay désengagé impose sa cible, engagé non', () => {
  const E = situation({ lignes: [['c078'], ['c101']], ess: [['rose', 'rose']] });
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], [L(E, 1, 0).u]);
  L(E, 1, 0).eng = true;
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))].sort(), ['ceo', L(E, 1, 0).u].sort());
});
test('seul le Joueur de la même ligne défend — et Garde, de partout', () => {
  const E = situation({ lignes: [['c078'], [null, 'c051', 'c074']], ess: [['rose', 'rose']] });
  const d = Combat.defenseurs(E, L(E, 0, 0), 'ceo').map(c => c.id);
  egal(d, ['c074'], 'Grand Respect a Garde');
  const E2 = situation({ lignes: [['c078'], ['c051', 'c078']], ess: [['rose', 'rose']] });
  egal(Combat.defenseurs(E2, L(E2, 0, 0), 'ceo').map(c => c.id), ['c051']);
});
test('défendre engage le défenseur ; attaque ≥ Défense : vaincu', () => {
  const E = situation({ lignes: [['c078'], ['c010']], ess: [['rose', 'rose']] });
  /* Le Chevalier Rose : Serment 120 contre Broken Brawks 130 — repoussé. */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  const d = Combat.demande(E);
  egal(d.but, 'defense');
  repondre(E, L(E, 1, 0).u);
  vrai(L(E, 1, 0).eng, 'le défenseur est engagé');
  egal(E.j[1].pv.length, 5, 'pas de PV perdu');
  vrai(L(E, 0, 0).eng, 'l\'attaquant est engagé');
});
test('défenseur vaincu si l\'attaque l\'égale', () => {
  const E = situation({ lignes: [['c078'], ['c051']], ess: [['rose', 'rose']] });
  /* Serment 120 contre La Planète 110 : vaincue. Légion : on refuse. */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  egal(L(E, 1, 0), null);
  egal(E.j[1].defausse.slice(-1)[0].id, 'c051');
});
test('le CEO touché récupère son premier PV en main', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']] });
  const premier = E.j[1].pv[0];
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.j[1].pv.length, 4);
  vrai(E.j[1].main.includes(premier));
});
test('sans PV, le CEO touché a perdu', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], pv: [5, 0] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.fin, { gagnant: 0, raison: 'pv' });
});
test('un Joueur engagé ne peut pas attaquer ; le premier CEO n\'attaque pas au tour 1', () => {
  const E = situation({ lignes: [[['c078', { eng: true }]], []], ess: [['rose', 'rose']] });
  egal(attaques(E, L(E, 0, 0).u).length, 0);
  const F = Combat.creer({ decks: [{ club: Array(30).fill('c078'), reserve: Array(10).fill('rose') }, { club: Array(30).fill('c078'), reserve: Array(10).fill('rose') }], graine: 3, premier: 0 });
  repondre(F, 'oui'); repondre(F, 'oui');
  Combat.agir(F, { t: 'deployer', u: F.j[0].main[0].u, ligne: 0 });
  egal(options(F).filter(a => a.t === 'attaquer').length, 0);
});

console.log('Coûts et Essences');
test('couleur exacte pour les symboles de couleur, n\'importe laquelle pour le Neutre', () => {
  const E = situation({ lignes: [['c012'], []], ess: [['mauve', 'mauve']] });
  egal(attaques(E, L(E, 0, 0).u).length, 0, 'Trash-talk veut du Rose');
  const F = situation({ lignes: [['c012'], []], ess: [['rose', 'mauve']] });
  vrai(attaques(F, L(F, 0, 0).u).length > 0);
});
test('payer engage les Essences ; elles reviennent au début du tour', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  egal(E.j[0].ess.filter(e => e.eng).length, 2);
  Combat.agir(E, { t: 'finTour' });
  Combat.agir(E, { t: 'finTour' });
  egal(E.j[0].ess.filter(e => e.eng).length, 0);
  vrai(!L(E, 0, 0).eng);
});
test('Doig\'Dance : la première attaque coûte un Neutre de moins', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], main: [['c097']] });
  egal(attaques(E, L(E, 0, 0).u).filter(a => a.k === 1).length, 0);
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  vrai(attaques(E, L(E, 0, 0).u).some(a => a.k === 1), 'Serment devient payable');
});
test('La Chevalière : l\'attaque peut coûter 2 Neutres', () => {
  const E = situation({ lignes: [[['c081', { obj: ['c084'] }]], []], ess: [['rose', 'rose']] });
  const a = attaques(E, L(E, 0, 0).u).find(x => x.chevaliere && x.cible === 'ceo');
  vrai(a, 'Hexa-Punch (4) payable avec 2');
  Combat.agir(E, a);
  egal(E.j[0].banc.map(c => c.id), ['c084']);
});

console.log('Mots-clés');
test('Shield ignore la première attaque', () => {
  const E = situation({ lignes: [['c078'], [['c059', { eng: true }]]], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: L(E, 1, 0).u });
  vrai(L(E, 1, 0), 'Baby Driver tient');
  vrai(L(E, 1, 0).shieldUse);
});
test('Riposte : contre-attaque pour un coût diminué de 1', () => {
  const E = situation({ lignes: [['c078'], [['c035', { eng: true }]]], ess: [['rose', 'rose'], ['orange']] });
  /* Pitchounes (Éclosion 2 Orange, 130) vaincu par Serment 120 ? Non : 120 < 120 ? */
  L(E, 1, 0).id = 'c034'; /* Vanyabubu, Défense 90, Baby Shark 1 Orange → 0 */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: L(E, 1, 0).u });
  const d = Combat.demande(E);
  egal(d.but, 'riposte');
  repondre(E, 0);
  /* Baby Shark 60 contre Le Chevalier Rose 80 : repoussé. */
  vrai(L(E, 0, 0), 'le Chevalier tient');
});
test('Légion : défausser une carte pour le reprendre en main', () => {
  const E = situation({ lignes: [['c078'], [['c051', { eng: true }]]], ess: [['rose', 'rose']], main: [[], ['c078']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: L(E, 1, 0).u });
  egal(Combat.demande(E).but, 'legion');
  repondre(E, 'oui');
  Combat.agir(E, { t: 'cartes', u: [E.j[1].main[0].u] });
  vrai(E.j[1].main.some(c => c.id === 'c051'));
});
test('Buff : les autres Joueurs ont +10 Attaque', () => {
  const E = situation({ lignes: [['c078', 'c017'], []], ess: [['rose']] });
  egal(Combat.valeurAttaque(E, L(E, 0, 0), 0), 100);
  egal(Combat.valeurAttaque(E, L(E, 0, 1), 0), 90, 'pas lui-même');
});

console.log('PV, Résilience, Banc');
test('Résilience : « Jouez cette carte » joue l\'effet au lieu de la garder', () => {
  const E = situation({ lignes: [['c078'], ['c010']], ess: [['rose']] });
  /* On pose Lofi Girl en premier PV de 1. */
  E.j[1].pv[0] = { u: ++E.seq, id: 'c104', j: 1 };
  L(E, 1, 0).eng = true;
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(Combat.demande(E).but, 'resilience');
  repondre(E, 'oui');
  /* Lofi Girl : désengagez un de vos Joueurs. Broken Brawks s'engage aussi
     en récupérant un PV — le choix porte sur lui. */
  const d = Combat.demande(E);
  if (d && d.type === 'choix' && d.but === 'desengagerAllie') repondre(E, L(E, 1, 0).u);
  egal(E.j[1].defausse.slice(-1)[0].id, 'c104');
});
test('bench : la carte revient en main au début du tour de son propriétaire', () => {
  const E = situation({ lignes: [['c078'], ['c057']], ess: [['rose']], main: [['c092'], []] });
  L(E, 1, 0).obj.push({ u: ++E.seq, id: 'c087', j: 1 });
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  repondre(E, L(E, 1, 0).obj[0].u);
  egal(E.j[1].banc.map(c => c.id), ['c087']);
  Combat.agir(E, { t: 'finTour' });
  vrai(E.j[1].main.some(c => c.id === 'c087'));
  egal(E.j[1].banc.length, 0);
});
test('Invitation : bench à la place du Joueur vaincu', () => {
  const E = situation({ lignes: [['c078'], [['c051', { eng: true, obj: ['c032'] }]]], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: L(E, 1, 0).u });
  vrai(L(E, 1, 0), 'toujours là');
  egal(E.j[1].banc.map(c => c.id), ['c032']);
});

console.log('Limites du tour');
test('un seul Joueur déployé, un seul Coach par tour', () => {
  const E = situation({ lignes: [[], []], ess: [['rose']], main: [['c078', 'c078', 'c083', 'c083']] });
  Combat.agir(E, { t: 'deployer', u: E.j[0].main[0].u, ligne: 0 });
  egal(options(E).filter(a => a.t === 'deployer').length, 0);
  Combat.agir(E, { t: 'jouer', u: E.j[0].main.find(c => c.id === 'c083').u });
  egal(options(E).filter(a => a.t === 'jouer').length, 0);
});
test('après la première attaque, plus de Joueur ni d\'Objet', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], main: [['c078', 'c087']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(options(E).filter(a => a.t === 'deployer' || a.t === 'lier').length, 0);
});

console.log('Decks');
test('les deux Starter Decks sont valides', () => {
  for (const k of ['toxique', 'deter']) egal(Decks.verifier(Decks.STARTERS[k]), [], k);
});
test('les decks de campagne et tirés au sort sont valides', () => {
  let s = 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) egal(Decks.verifier(Decks.aleatoire(r, { niveau: 1 + (i % 5) })), []);
});
test('le code d\'un deck se relit à l\'identique', () => {
  const d = Decks.STARTERS.toxique;
  const x = Decks.decoder(Decks.encoder(d));
  egal(x.cartes, Object.fromEntries(Object.keys(d.cartes).sort().map(k => [k, d.cartes[k]])));
  egal(x.reserve, d.reserve);
});

test('les quarante rivaux de campagne ont un deck valide, avec leur carte', () => {
  for (const sec of ['toxique', 'deter']) {
    for (const f of Campagne.combatsCampagne(sec)) {
      const d = Campagne.deckRival(f, sec);
      egal(Decks.verifier(d), [], sec + ' ' + f.id);
      vrai(d.cartes[f.rival] >= 1, f.rival + ' absent');
    }
  }
});

console.log('Le Choc des Sections');
test('le deck du Sorcier est valide et le contient, chaque jour et à chaque phase', () => {
  for (let j = 0; j < 14; j++) {
    const jour = new Date(Date.UTC(2026, 9, 1 + j)).toISOString().slice(0, 10);
    for (let n = 1; n <= 6; n++) {
      const d = Choc.deckSorcier(jour, n);
      egal(Decks.verifier(d), [], jour + ' phase ' + n);
      vrai(d.cartes[Choc.CHOC.raid.boss] === 1, 'The French Sorcerer manque');
      egal(JSON.stringify(Choc.deckSorcier(jour, n)), JSON.stringify(d), 'même jour, même deck');
    }
  }
});
test('l\'Épreuve du jour est la même pour tous, et ses decks sont valides', () => {
  const a = Choc.epreuveDuJour('2026-10-11', 123456789), b = Choc.epreuveDuJour('2026-10-11', 123456789);
  egal(JSON.stringify(a), JSON.stringify(b));
  egal(Decks.verifier(a.moi), []);
  egal(Decks.verifier(a.adv), []);
  const vus = new Set();
  for (let j = 0; j < 7; j++) vus.add(Choc.epreuveDuJour(new Date(Date.UTC(2026, 9, 1 + j)).toISOString().slice(0, 10), 1).regle.id);
  egal(vus.size, Choc.CHOC.epreuve.regles.length, 'une règle différente chaque jour de la semaine');
});
test('le score de l\'Épreuve : victoire, puis moins de tours, puis plus de PV', () => {
  const s = Choc.scoreEpreuve;
  vrai(s({ gagne: true, tours: 20, pv: 1 }) > s({ gagne: false, touches: 6, pv: 5 }));
  vrai(s({ gagne: true, tours: 8, pv: 1 }) > s({ gagne: true, tours: 9, pv: 5 }));
  vrai(s({ gagne: true, tours: 8, pv: 3 }) > s({ gagne: true, tours: 8, pv: 2 }));
  vrai(s({ gagne: false, touches: 4, pv: 0 }) > s({ gagne: false, touches: 3, pv: 2 }));
});
test('le Sorcier commence sur le plateau, au milieu, jamais en main ni en PV', () => {
  const boss = Choc.CHOC.raid.boss;
  for (let g = 1; g <= 40; g++) {
    const E = Combat.creer({ decks: [Decks.versMoteur(Decks.STARTERS.deter), Decks.versMoteur(Choc.deckSorcier('2026-10-11', 3))],
      graine: g, pv: [5, 7], essDepart: [0, 1], poses: Choc.posesBoss() });
    while (Combat.demande(E) && Combat.demande(E).but === 'mulligan') Combat.agir(E, { t: 'choix', v: 'oui' });
    const P = E.j[1];
    egal((P.lignes[1] || {}).id, boss, 'graine ' + g);
    const ailleurs = ['main', 'pv', 'club', 'defausse'].reduce((n, z) => n + P[z].filter(c => c.id === boss).length, 0);
    egal(ailleurs, 0, 'un seul Sorcier, graine ' + g);
    egal(P.pv.length, 7);
  }
});
test('les phases du Raid s\'ouvrent une à une sur les trois semaines', () => {
  egal(Choc.chocPhaseMax(0), 1);
  egal(Choc.chocPhaseMax(3), 2);
  egal(Choc.chocPhaseMax(14), 4);
  egal(Choc.chocPhaseMax(15), 5);
  const o = Choc.CHOC.raid.phases.map(p => p.ouvre);
  vrai(o.every((x, i) => !i || x > o[i - 1]), 'des ouvertures croissantes');
  vrai(o[o.length - 1] <= 17, 'la dernière phase laisse au moins quatre jours');
});
test('une partie de Raid (8 PV, 2 Essences d\'avance) va à son terme', () => {
  const p = Choc.chocPhase(5);
  const E = Combat.creer({ decks: [Decks.versMoteur(Decks.STARTERS.deter), Decks.versMoteur(Choc.deckSorcier('2026-10-11', 5))],
    graine: 77, pv: [5, p.pvBoss], essDepart: [0, p.ess], poses: Choc.posesBoss() });
  egal(E.j[1].pvDepart, 8);
  let n = 0;
  while (Combat.demande(E) && n++ < 3000) {
    const d = Combat.demande(E);
    let a;
    if (d.type === 'tour') { const o = Combat.optionsTour(E); a = o.find(x => x.t === 'attaquer') || o.find(x => x.t === 'deployer') || o.find(x => x.t === 'finTour'); }
    else if (d.type === 'choix') a = { t: 'choix', v: d.options[0].v };
    else if (d.type === 'cartes') a = { t: 'cartes', u: d.parmi.slice(0, d.min) };
    else a = { t: 'ordre', u: d.parmi };
    Combat.agir(E, a);
  }
  vrai(E.fin, 'la partie doit finir');
});

console.log('Copie et reprise');
test('rejouer redonne exactement la même partie', () => {
  const r = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const d1 = Decks.STARTERS.toxique, d2 = Decks.STARTERS.deter;
  const E = Combat.creer({ decks: [Decks.versMoteur(d1), Decks.versMoteur(d2)], graine: 12345 });
  let n = 0;
  while (Combat.demande(E) && n++ < 400) {
    const d = Combat.demande(E);
    let a;
    if (d.type === 'tour') { const o = Combat.optionsTour(E); a = o[Math.floor(r() * o.length)]; }
    else if (d.type === 'choix') a = { t: 'choix', v: d.options[0].v };
    else if (d.type === 'cartes') a = { t: 'cartes', u: d.parmi.slice(0, d.min) };
    else a = { t: 'ordre', u: d.parmi };
    Combat.agir(E, a);
  }
  egal(JSON.stringify(Combat.rejouer(E.init, E.journal)), JSON.stringify(E));
});

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
