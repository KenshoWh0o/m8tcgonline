#!/usr/bin/env node
/* Les règles du combat, une par une (version 3.0).

     node tools/combat-tests.js

   Chaque test pose une situation à la main — qui est sur quelle ligne,
   engagé ou non, avec quelles Essences — puis joue des actions et vérifie
   ce que dit la règle (docs/regles-3.0.md). */
"use strict";
const { Combat, Decks, Choc, Campagne, Niveaux, Tuto, IA, Histo, Verif, partie, auHasard, rng } = require('./combat-sim.js');

let ok = 0, ko = 0;
function test(nom, f) {
  try { f(); ok++; console.log('  ✓ ' + nom); }
  catch (e) { ko++; console.log('  ✗ ' + nom + '\n      ' + (e.stack || e).split('\n').slice(0, 3).join('\n      ')); }
}
function egal(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }
function vrai(x, m) { if (!x) throw new Error(m || 'faux'); }

/* Une partie dont on fixe tout : deux Clubs de 40 cartes de remplissage,
   puis on pose ce qu'on veut où on veut. */
function situation(o) {
  const remplir = id => Array(40).fill(id || 'c078');
  const E = Combat.creer({ decks: [{ club: remplir(o.club0), reserve: Array(10).fill(o.coul0 || 'rose') }, { club: remplir(o.club1), reserve: Array(10).fill(o.coul1 || 'mauve') }], graine: 1, premier: 0 });
  /* Garder les deux mains. */
  while (Combat.demande(E).but === 'mulligan') Combat.agir(E, { t: 'choix', v: 'oui' });
  /* On est au premier tour de 0 : on passe au tour 3 (le second tour de 0)
     pour pouvoir attaquer. */
  finirTour(E);
  finirTour(E);
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
    for (const x of (o.ess || [])[j] || []) {
      const [coul, eng] = Array.isArray(x) ? x : [x, false];
      P.ess.push({ u: ++E.seq, coul, eng: !!eng, j });
    }
    for (const id of (o.main || [])[j] || []) P.main.push({ u: ++E.seq, id, j });
    if (o.pv && o.pv[j] != null) P.pv = P.pv.slice(0, o.pv[j]);
  }
  return E;
}
/* Finir le tour, et défausser ce qu'il faut pour garder 5 cartes. */
function finirTour(E) {
  Combat.agir(E, { t: 'finTour' });
  const d = Combat.demande(E);
  if (d && d.type === 'cartes' && d.but === 'defausseFin') Combat.agir(E, { t: 'cartes', u: d.parmi.slice(0, d.min) });
}
const L = (E, j, i) => E.j[j].lignes[i];
const options = E => Combat.optionsTour(E);
const attaques = (E, u) => options(E).filter(a => a.t === 'attaquer' && a.u === u);
const repondre = (E, v) => Combat.agir(E, { t: 'choix', v });

console.log('Mise en place et tour (règles officielles)');
test('40 cartes, 5 en main, 4 PV ; le premier CEO pioche dès son premier tour', () => {
  const F = Combat.creer({ decks: [0, 1].map(() => ({ club: Array(40).fill('c078'), reserve: Array(10).fill('rose') })), graine: 5, premier: 0 });
  egal(Combat.demande(F).but, 'mulligan');
  repondre(F, 'oui'); repondre(F, 'oui');
  egal(F.j[1].pv.length, 4);
  egal(F.j[1].main.length, 5);
  egal(F.j[0].main.length, 6, 'pioche du premier tour');
  egal(F.j[0].ess.length, 1, 'une Essence de la Réserve');
  egal(F.j[0].club.length, 40 - 5 - 4 - 1);
});
test('le tirage au sort de qui commence vient après les mains et les PV', () => {
  const F = Combat.creer({ decks: [0, 1].map(() => ({ club: Array(40).fill('c078'), reserve: Array(10).fill('rose') })), graine: 9 });
  repondre(F, 'oui'); repondre(F, 'oui');
  const t = F.ev.map(e => e.t);
  vrai(t.indexOf('pileFace') > t.lastIndexOf('pv'), 'pileFace après les PV');
  vrai(t.indexOf('pileFace') > t.lastIndexOf('main'), 'pileFace après les mains');
});
test('fin du tour : on défausse pour garder 5 cartes au plus', () => {
  const E = situation({ lignes: [[], []], main: [['c078', 'c078', 'c078', 'c078', 'c078', 'c078', 'c078']] });
  Combat.agir(E, { t: 'finTour' });
  const d = Combat.demande(E);
  egal([d.type, d.but, d.min, d.max], ['cartes', 'defausseFin', 2, 2]);
  Combat.agir(E, { t: 'cartes', u: d.parmi.slice(0, 2) });
  egal(E.j[0].main.length, 5);
});
test('un Club vide au moment de piocher fait perdre', () => {
  const E = situation({ lignes: [[], []] });
  E.j[1].club = [];
  Combat.agir(E, { t: 'finTour' });
  egal(E.fin, { gagnant: 0, raison: 'club' });
});

console.log('Cibles, défense, soutien');
test('une attaque se déclare sur le CEO adverse, jamais sur un Joueur, même engagé', () => {
  const E = situation({ lignes: [['c078'], ['c057', ['c074', { eng: true }], 'c051']], ess: [['rose', 'rose']] });
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], ['ceo']);
});
test('Provocation en face impose sa cible', () => {
  const E = situation({ lignes: [['c078'], ['c058', ['c074', { eng: true }]]], ess: [['rose', 'rose']] });
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], [L(E, 1, 0).u]);
});
test('Slay désengagé impose sa cible, engagé non', () => {
  const E = situation({ lignes: [['c078'], ['c101']], ess: [['rose', 'rose']] });
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], [L(E, 1, 0).u]);
  L(E, 1, 0).eng = true;
  egal([...new Set(attaques(E, L(E, 0, 0).u).map(a => a.cible))], ['ceo']);
});
test('seul le Joueur de la même ligne défend — et Garde, de partout', () => {
  const E = situation({ lignes: [['c078'], [null, 'c051', 'c074']], ess: [['rose', 'rose']] });
  const d = Combat.defenseurs(E, L(E, 0, 0), 'ceo').map(c => c.id);
  egal(d, ['c074'], 'Grand Respect a Garde');
  const E2 = situation({ lignes: [['c078'], ['c051', 'c078']], ess: [['rose', 'rose']] });
  egal(Combat.defenseurs(E2, L(E2, 0, 0), 'ceo').map(c => c.id), ['c051']);
});
test('défendre engage le défenseur ; une attaque plus faible ne passe pas', () => {
  const E = situation({ lignes: [['c078'], ['c010']], ess: [['rose', 'rose']] });
  /* Le Chevalier Rose : Serment 120 contre Broken Brawks 130 — repoussé. */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  egal(Combat.demande(E).but, 'defense');
  repondre(E, L(E, 1, 0).u);
  vrai(L(E, 1, 0).eng, 'le défenseur est engagé');
  egal(E.j[1].pv.length, 4, 'pas de PV perdu');
  vrai(L(E, 0, 0).eng, 'l\'attaquant est engagé');
});
test('défenseur vaincu si l\'attaque l\'égale ou le dépasse : bench, à la défausse', () => {
  const E = situation({ lignes: [['c078'], ['c051']], ess: [['rose', 'rose']] });
  /* Serment 120 contre La Planète 110 : vaincue. Légion : on refuse. */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  if (Combat.demande(E) && Combat.demande(E).but === 'legion') repondre(E, 'non');
  egal(L(E, 1, 0), null);
  egal(E.j[1].defausse.slice(-1)[0].id, 'c051');
});
test('le soutien : un Joueur voisin ajoute la valeur de son attaque', () => {
  /* Serment 120 (2 Essences) contre Broken Brawks 130 : repoussé seul ;
     avec le soutien d'Assaut 90 (1 Essence) d'un Chevalier voisin : 210. */
  const E = situation({ lignes: [['c078', 'c078'], [null, 'c010']], ess: [['rose', 'rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 1).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 1).u);
  const d = Combat.demande(E);
  egal(d.but, 'soutien');
  const o = d.options.find(x => x.u === L(E, 0, 0).u && x.k === 0);
  vrai(o && o.info.total === 210 && o.info.vaincu, 'total 210');
  repondre(E, o.v);
  egal(L(E, 1, 1), null, 'Broken Brawks vaincu');
  vrai(L(E, 0, 0).eng, 'le soutien est engagé');
  egal(E.j[0].ess.filter(e => !e.eng).length, 0, 'trois Essences engagées');
});
test('le soutien ne se propose que s\'il change l\'issue (3.0.14)', () => {
  /* Serment 120 contre La Planète 110 : l'attaque seule suffit, pas de
     soutien proposé, alors qu'un Chevalier voisin pourrait le donner. */
  const E = situation({ lignes: [['c078', 'c078'], [null, 'c051']], ess: [['rose', 'rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 1).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 1).u);
  vrai(!Combat.demande(E) || Combat.demande(E).but !== 'soutien', 'aucun soutien quand l\'attaque suffit');
  vrai(!L(E, 0, 0).eng, 'le voisin reste désengagé');
  /* Assaut 90 contre Broken Brawks 130 : repoussé seul. Il reste une
     Essence, le soutien payable (l'Assaut du voisin, 90) donne 180 : il
     change l'issue, il est proposé — et seulement les soutiens qui
     suffisent. */
  const E2 = situation({ lignes: [['c078', 'c078'], [null, 'c010']], ess: [['rose', 'rose']] });
  Combat.agir(E2, { t: 'attaquer', u: L(E2, 0, 1).u, k: 0, cible: 'ceo' });
  repondre(E2, L(E2, 1, 1).u);
  const d2 = Combat.demande(E2);
  egal(d2 && d2.but, 'soutien', '90 + 90 = 180 ≥ 130 : proposé');
  vrai(d2.options.filter(o => o.v !== 'non').every(o => o.info.total >= 130), 'chaque soutien proposé suffit');
  /* Estafilade 90 contre Mon Cogneur 170, le seul voisin (Le Roi des rois)
     n'apporte que 50 : 140 ne suffit pas, rien n'est proposé. */
  const E3 = situation({ lignes: [['c049', 'c078'], [null, 'c081']], ess: [['rose', 'rose']] });
  Combat.agir(E3, { t: 'attaquer', u: L(E3, 0, 1).u, k: 0, cible: 'ceo' });
  repondre(E3, L(E3, 1, 1).u);
  vrai(!Combat.demande(E3) || Combat.demande(E3).but !== 'soutien', 'aucun soutien quand rien ne suffit');
  vrai(Combat.soutiens(E3, L(E3, 0, 1)).length > 0, 'un soutien était possible : c\'est le filtre qui l\'écarte');
});
test('pas de soutien sans défenseur, ni d\'une case qui n\'est pas voisine', () => {
  const E = situation({ lignes: [['c078', null, 'c078'], [null, null, null]], ess: [['rose', 'rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 2).u, k: 0, cible: 'ceo' });
  vrai(!Combat.demande(E) || Combat.demande(E).but !== 'soutien');
  egal(Combat.soutiens(E, L(E, 0, 2)).length, 0, 'la case 0 n\'est pas voisine de la 2');
});
test('le CEO touché récupère son premier PV en main', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']] });
  const premier = E.j[1].pv[0];
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.j[1].pv.length, 3);
  vrai(E.j[1].main.includes(premier));
});
test('sans PV, le CEO touché a perdu', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], pv: [4, 0] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.fin, { gagnant: 0, raison: 'pv' });
});
test('une attaque sans valeur ne vise personne : son effet, sans toucher le CEO (3.0.16)', () => {
  /* Namifique, Omniscience (1 Rose, pas de valeur) : « Engagez un Joueur
     adverse ». Le propriétaire, 3 novembre : elle ne doit pas compter comme
     une attaque au CEO. Même face à une Provocation (Pas Compris, c013). */
  const E = situation({ lignes: [['c022'], ['c013', 'c078']], ess: [['rose']] });
  const pv = E.j[1].pv.length;
  const opts = attaques(E, L(E, 0, 0).u);
  egal(opts.map(o => o.cible), [null], 'une seule option, sans cible');
  Combat.agir(E, opts[0]);
  const d = Combat.demande(E);
  egal(d.qui, 0, 'le choix revient à l\'attaquant');
  vrai(d.but === 'engagerAdverse', 'il choisit le Joueur à engager, pas de défense : ' + d.but);
  Combat.agir(E, { t: 'choix', v: L(E, 1, 1).u });
  vrai(L(E, 1, 1).eng, 'le Joueur choisi est engagé');
  egal(E.j[1].pv.length, pv, 'le CEO n\'est pas touché');
  vrai(L(E, 0, 0).eng, 'l\'attaquant s\'est engagé');
  egal(E.cpt.attaques, 1, 'elle compte comme une attaque');
});
test('Confusion (+10 par Joueur engagé) : l\'aperçu compte l\'attaquant, la défense compte le défenseur (3.0.16)', () => {
  /* Pas Compris (c013), Confusion 60+ ; personne d'engagé au départ. */
  const E = situation({ lignes: [['c013'], ['c078']], ess: [['rose', 'rose', 'rose']] });
  const c = L(E, 0, 0);
  egal(Combat.infoAttaque(E, c, 0).val, 70, 'l\'aperçu : 60 + 10 (l\'attaquant, qui s\'engage)');
  Combat.agir(E, attaques(E, c.u)[0]);
  const d = Combat.demande(E);
  egal(d.but, 'defense');
  egal(d.options.find(o => o.u === L(E, 1, 0).u).info.val, 80, 'défendre engage le défenseur : 80');
});
test('un Joueur engagé ne peut pas attaquer ; le premier CEO n\'attaque pas au tour 1', () => {
  const E = situation({ lignes: [[['c078', { eng: true }]], []], ess: [['rose', 'rose']] });
  egal(attaques(E, L(E, 0, 0).u).length, 0);
  const F = Combat.creer({ decks: [{ club: Array(40).fill('c078'), reserve: Array(10).fill('rose') }, { club: Array(40).fill('c078'), reserve: Array(10).fill('rose') }], graine: 3, premier: 0 });
  repondre(F, 'oui'); repondre(F, 'oui');
  Combat.agir(F, { t: 'deployer', u: F.j[0].main[0].u, ligne: 0 });
  egal(options(F).filter(a => a.t === 'attaquer').length, 0);
});

console.log('Coûts, Essences, couleurs');
test('couleur exacte pour les symboles de couleur, n\'importe laquelle pour le Neutre', () => {
  const E = situation({ lignes: [['c012'], []], ess: [['mauve', 'mauve']] });
  egal(attaques(E, L(E, 0, 0).u).length, 0, 'Trash-talk veut du Rose');
  const F = situation({ lignes: [['c012'], []], ess: [['rose', 'mauve']] });
  vrai(attaques(F, L(F, 0, 0).u).length > 0);
});
test('payer engage les Essences ; elles se désengagent à l\'entretien', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  egal(E.j[0].ess.filter(e => e.eng).length, 2);
  finirTour(E);
  finirTour(E);
  egal(E.j[0].ess.filter(e => e.eng).length, 0);
  vrai(!L(E, 0, 0).eng);
});
test('restriction par couleur : un Coach, un Moment ou un Objet de couleur veut une Essence de sa couleur en jeu', () => {
  /* Zacking Buff, Coach Rose ; Ravitaillement Rose, Objet. */
  const E = situation({ lignes: [['c078'], []], ess: [['mauve']], main: [['c014', 'c015']] });
  egal(options(E).filter(a => a.t === 'jouer' || a.t === 'lier').length, 0, 'pas de Rose en jeu');
  const F = situation({ lignes: [['c078'], []], ess: [[['rose', true]]], main: [['c014', 'c015']] });
  vrai(options(F).some(a => a.t === 'jouer'), 'une Essence Rose engagée suffit : ce n\'est pas un coût');
  vrai(options(F).some(a => a.t === 'lier'));
  const G = situation({ lignes: [['c078'], []], ess: [['mauve']], main: [['c083', 'c087']] });
  vrai(options(G).some(a => a.t === 'jouer') && options(G).some(a => a.t === 'lier'), 'les Neutres n\'ont pas de condition');
});
test('Doig\'Dance : la première attaque coûte un Neutre de moins', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], main: [['c097']] });
  egal(attaques(E, L(E, 0, 0).u).filter(a => a.k === 1).length, 0);
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  vrai(attaques(E, L(E, 0, 0).u).some(a => a.k === 1), 'Serment devient payable');
});
test('La Chevalière : l\'attaque peut coûter 2 Neutres, et elle part à la défausse', () => {
  const E = situation({ lignes: [[['c081', { obj: ['c084'] }]], []], ess: [['rose', 'rose']] });
  const a = attaques(E, L(E, 0, 0).u).find(x => x.chevaliere && x.cible === 'ceo');
  vrai(a, 'Hexa-Punch (4) payable avec 2');
  Combat.agir(E, a);
  vrai(E.j[0].defausse.some(c => c.id === 'c084'), 'à la défausse');
});

console.log('Mots-clés');
test('Shield ignore la première attaque', () => {
  const E = situation({ lignes: [['c078'], ['c059']], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  vrai(L(E, 1, 0), 'Baby Driver tient');
  vrai(L(E, 1, 0).shieldUse);
  egal(E.j[1].pv.length, 4);
});
test('Riposte : une de ses attaques, pour un coût diminué de 1, sur l\'attaquant', () => {
  /* Vanyabubu (Défense 90, Riposte) défend contre Serment 120 et tombe. */
  const E = situation({ lignes: [['c078'], ['c034']], ess: [['rose', 'rose'], ['orange']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  egal(Combat.demande(E).but, 'riposte');
  repondre(E, 0);
  vrai(L(E, 0, 0), 'Baby Shark 60 contre Le Chevalier Rose 80 : il tient');
});
test('Légion : défausser une carte pour le reprendre en main', () => {
  const E = situation({ lignes: [['c078'], ['c051']], ess: [['rose', 'rose']], main: [[], ['c078']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
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

console.log('PV, Résilience, bench');
test('Résilience : « Jouez cette carte » joue l\'effet au lieu de la garder', () => {
  const E = situation({ lignes: [['c078'], ['c010']], ess: [['rose'], ['mauve']] });
  /* On pose Lofi Girl (Neutre) en premier PV de 1. */
  E.j[1].pv[0] = { u: ++E.seq, id: 'c104', j: 1 };
  L(E, 1, 0).eng = true;
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(Combat.demande(E).but, 'resilience');
  repondre(E, 'oui');
  const d = Combat.demande(E);
  if (d && d.type === 'choix' && d.but === 'desengagerAllie') repondre(E, L(E, 1, 0).u);
  egal(E.j[1].defausse.slice(-1)[0].id, 'c104');
});
test('Résilience : un deuxième Coach joué par « Jouez cette carte » le même tour ne se joue pas (un Coach par tour)', () => {
  const E = situation({ lignes: [['c078', 'c078'], ['c010']], ess: [['rose', 'rose'], ['mauve']] });
  /* Deux Lofi Girl (Coach Neutre, « Résilience : Jouez cette carte ») en tête des PV de 1. */
  E.j[1].pv[0] = { u: ++E.seq, id: 'c104', j: 1 };
  E.j[1].pv[1] = { u: ++E.seq, id: 'c104', j: 1 };
  L(E, 1, 0).eng = true;
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(Combat.demande(E).but, 'resilience', 'la première se joue');
  repondre(E, 'oui');
  let d = Combat.demande(E);
  if (d && d.type === 'choix' && d.but === 'desengagerAllie') repondre(E, L(E, 1, 0).u);
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 1).u, k: 0, cible: 'ceo' });
  d = Combat.demande(E);
  vrai(!d || d.but !== 'resilience', 'la seconde ne se propose pas');
  vrai(E.j[1].main.some(c => c.id === 'c104'), 'la seconde revient en main');
});
test('bench : la carte va à la défausse (« une carte déployée est envoyée à la défausse »)', () => {
  const E = situation({ lignes: [['c078'], ['c057']], ess: [['rose']], main: [['c092'], []] });
  L(E, 1, 0).obj.push({ u: ++E.seq, id: 'c087', j: 1 });
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  repondre(E, L(E, 1, 0).obj[0].u);
  vrai(E.j[1].defausse.some(c => c.id === 'c087'));
  finirTour(E);
  vrai(!E.j[1].main.some(c => c.id === 'c087'), 'ne revient pas en main');
});
test('un Joueur qui quitte le Terrain : ses Objets sont bench', () => {
  /* Cooked (+30 Attaque, pas de Défense) sur La Planète, vaincue. */
  const E = situation({ lignes: [['c078'], ['c051']], ess: [['rose', 'rose']] });
  L(E, 1, 0).obj.push({ u: ++E.seq, id: 'c085', j: 1 });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  if (Combat.demande(E) && Combat.demande(E).but === 'legion') repondre(E, 'non');
  vrai(E.j[1].defausse.some(c => c.id === 'c085'));
  vrai(E.j[1].bench.length >= 1);
});
test('Invitation : bench à la place du Joueur vaincu', () => {
  const E = situation({ lignes: [['c078'], [['c051', { obj: ['c032'] }]]], ess: [['rose', 'rose']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  vrai(L(E, 1, 0), 'toujours là');
  vrai(E.j[1].defausse.some(c => c.id === 'c032'));
});
test('Target Missed : un Joueur sauvé par Invitation n\'a pas été vaincu', () => {
  const E = situation({ lignes: [['c078'], [['c051', { obj: ['c032'] }]]], ess: [['rose', 'rose', 'mauve']], main: [['c055']] });
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 1, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  vrai(L(E, 1, 0), 'sauvé par Invitation');
  vrai(Combat.aMotCle(E, L(E, 0, 0), 'Provocation'), 'l\'attaquant gagne Provocation');
});

console.log('Le tour : déployer, lier, jouer');
test('autant de Joueurs qu\'il y a de cases ; un seul Coach par tour', () => {
  const E = situation({ lignes: [[], []], ess: [['rose']], main: [['c078', 'c078', 'c083', 'c083']] });
  Combat.agir(E, { t: 'deployer', u: E.j[0].main[0].u, ligne: 0 });
  vrai(options(E).some(a => a.t === 'deployer'), 'un deuxième Joueur');
  Combat.agir(E, { t: 'deployer', u: E.j[0].main.find(c => c.id === 'c078').u, ligne: 1 });
  Combat.agir(E, { t: 'jouer', u: E.j[0].main.find(c => c.id === 'c083').u });
  egal(options(E).filter(a => a.t === 'jouer').length, 0);
});
test('Terrain plein : une fois par tour, bench un Joueur non engagé pour en jouer un autre à sa place', () => {
  const E = situation({ lignes: [['c078', ['c078', { eng: true }], 'c078'], []], main: [['c051', 'c052']] });
  const r = options(E).filter(a => a.t === 'deployer');
  vrai(r.length && r.every(a => a.remplace), 'seulement des remplacements');
  vrai(!r.some(a => a.remplace === L(E, 0, 1).u), 'pas le Joueur engagé');
  const a = r.find(x => x.u === E.j[0].main[0].u && x.ligne === 0);
  const vieux = L(E, 0, 0);
  Combat.agir(E, a);
  egal(L(E, 0, 0).id, 'c051');
  vrai(E.j[0].defausse.includes(vieux), 'l\'ancien est bench');
  egal(options(E).filter(x => x.t === 'deployer').length, 0, 'une fois par tour');
});
test('pas de limite d\'Objets sur un Joueur', () => {
  const E = situation({ lignes: [['c078'], []], main: [['c087', 'c087', 'c087', 'c088', 'c085']] });
  for (let i = 0; i < 5; i++) Combat.agir(E, options(E).find(a => a.t === 'lier'));
  egal(L(E, 0, 0).obj.length, 5);
});
test('en phase de Combat, plus que des attaques', () => {
  const E = situation({ lignes: [['c078'], []], ess: [['rose']], main: [['c078', 'c087', 'c083']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(options(E).filter(a => ['deployer', 'lier', 'jouer'].includes(a.t)).length, 0);
});

console.log('Les cartes révélées en 3.0.13 (P03, P04, Secrètes 124, 126, 127)');
test('P03 et P04 : le texte de Brawks Déter (#077) et de Squeezie le Toxique (#012)', () => {
  egal(Decks.cleCopie('p03'), Decks.cleCopie('c077'), 'P03 compte avec Brawks Déter');
  egal(Decks.cleCopie('p04'), Decks.cleCopie('c012'), 'P04 compte avec Squeezie le Toxique');
  vrai(Decks.STARTERS.deter.cartes.p03 === 1 && Decks.STARTERS.toxique.cartes.p04 === 1, 'chaque Starter a la Promo de sa Section');
  /* P03 touche le CEO : on pioche une carte. */
  const E = situation({ lignes: [['p03'], []], ess: [['rose']] });
  const main = E.j[0].main.length;
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.j[1].pv.length, 3);
  egal(E.j[0].main.length, main + 1, 'pioche');
  /* P04 entre : un Joueur adverse est engagé. */
  const F = situation({ lignes: [[], ['c078']], main: [['p04'], []] });
  Combat.agir(F, { t: 'deployer', u: F.j[0].main[0].u, ligne: 0 });
  const d = Combat.demande(F);
  if (d && d.type === 'choix') repondre(F, L(F, 1, 0).u);
  vrai(L(F, 1, 0).eng, 'le Joueur adverse est engagé');
});
test('Brawks Trop Déter (124) : il touche le CEO, tous ses Joueurs se désengagent', () => {
  const E = situation({ lignes: [['c124', ['c078', { eng: true }]], []], ess: [['violette', 'violette']] });
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  egal(E.j[1].pv.length, 3);
  vrai(!L(E, 0, 0).eng && !L(E, 0, 1).eng, 'les deux sont désengagés');
  vrai(attaques(E, L(E, 0, 0).u).length === 0, 'plus d\'Essence pour attaquer encore');
});
test('GP Explorer II (126) : chaque CEO garde deux Joueurs, et plus de Joueur à jouer ce tour', () => {
  const E = situation({ lignes: [['c078', 'c051', 'c071'], ['c010', 'c057', 'c078']], main: [['c126', 'c052'], []] });
  L(E, 1, 2).obj.push({ u: ++E.seq, id: 'c087', j: 1 });
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  let d = Combat.demande(E);
  egal([d.qui, d.but], [0, 'garderJoueur']);
  repondre(E, L(E, 0, 0).u); repondre(E, L(E, 0, 2).u);
  d = Combat.demande(E);
  egal([d.qui, d.but], [1, 'garderJoueur'], 'puis l\'adversaire');
  repondre(E, L(E, 1, 0).u); repondre(E, L(E, 1, 1).u);
  egal(E.j[0].lignes.map(c => c && c.id), ['c078', null, 'c071']);
  egal(E.j[1].lignes.map(c => c && c.id), ['c010', 'c057', null]);
  vrai(E.j[0].main.some(c => c.id === 'c051') && E.j[1].main.some(c => c.id === 'c078'), 'les autres en main');
  egal(E.j[1].defausse.slice(-1)[0].id, 'c087', 'leurs Objets à la défausse');
  egal(options(E).filter(a => a.t === 'deployer').length, 0, 'plus de Joueur ce tour');
  /* Même par un effet qui dit « jouez » : Versus Fighting revient en main,
     et personne ne prend sa place. */
  E.j[0].ess = [{ u: ++E.seq, coul: 'azur', eng: false, j: 0 }, { u: ++E.seq, coul: 'azur', eng: false, j: 0 }];
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 2).u, k: 0, cible: 'ceo' });
  d = Combat.demande(E);
  vrai(!d || d.but !== 'deployer', 'pas de choix de remplaçant');
  egal(L(E, 0, 2), null);
  /* Au tour suivant de ce CEO, il rejoue des Joueurs. */
  finirTour(E); finirTour(E);
  vrai(options(E).some(a => a.t === 'deployer'), 'de nouveau permis');
});
test('Paris Gentle Mates (127) : deux Essences Mauves rendues, la première attaque du tour double', () => {
  const E = situation({ lignes: [['c078', 'c078'], ['c010']], ess: [[['mauve', true], 'mauve', 'mauve', 'rose', 'rose']], main: [['c127'], []] });
  const engagee = E.j[0].ess[0].u;
  egal(Combat.valeurAttaque(E, L(E, 0, 0), 0), 90);
  Combat.agir(E, { t: 'jouer', u: E.j[0].main[0].u });
  egal(E.j[0].ess.filter(e => e.coul === 'mauve').length, 1, 'deux Mauves en moins');
  vrai(E.j[0].reserve.some(e => e.u === engagee), 'l\'engagée d\'abord');
  egal(Combat.valeurAttaque(E, L(E, 0, 0), 0), 180, 'doublée avant la première attaque');
  egal(Combat.valeurAttaque(E, L(E, 0, 1), 0), 180);
  /* Estafilade 180 contre Broken Brawks 130, sans soutien : vaincu. */
  Combat.agir(E, { t: 'attaquer', u: L(E, 0, 0).u, k: 0, cible: 'ceo' });
  repondre(E, L(E, 1, 0).u);
  let d = Combat.demande(E);
  if (d && d.but === 'soutien') { repondre(E, 'non'); d = Combat.demande(E); }
  if (d && d.but === 'legion') repondre(E, 'non');
  egal(L(E, 1, 0), null, 'le défenseur est vaincu');
  egal(Combat.valeurAttaque(E, L(E, 0, 1), 0), 90, 'la deuxième ne double pas');
  /* Sans deux Mauves en jeu, elle ne se joue pas. */
  const F = situation({ lignes: [['c078'], []], ess: [['mauve', 'rose']], main: [['c127'], []] });
  egal(options(F).filter(a => a.t === 'jouer').length, 0);
});

console.log('Decks');
test('les deux Starter Decks sont valides : 40 cartes, 10 Essences, au moins 15 Joueurs', () => {
  for (const k of ['toxique', 'deter']) {
    egal(Decks.verifier(Decks.STARTERS[k]), [], k);
    vrai(Decks.bilan(Decks.STARTERS[k]).joueurs >= 15, k + ' : 15 Joueurs');
  }
});
test('trois exemplaires au plus d\'une même carte : même nom et même couleur (Reverse, Promo, Leakof)', () => {
  const base = Object.assign({}, Decks.STARTERS.toxique.cartes);
  const d = c => Decks.verifier({ cartes: c, reserve: { rose: 10 } });
  egal(d(base), []);
  vrai(d(Object.assign({}, base, { c010: 3, r010: 1, c078: 1 })).some(e => /3 exemplaires/.test(e)), 'Reverse comptée avec sa carte');
  egal(Decks.cleCopie('c072'), Decks.cleCopie('c110'), 'les deux Leakof');
  egal(Decks.cleCopie('c121'), Decks.cleCopie('p06'), 'Le Marionnettiste et sa Promo');
  vrai(Decks.cleCopie('c015') !== Decks.cleCopie('c053'), 'Ravitaillement Rose et Mauve : deux cartes');
  egal(Decks.limite('c113'), 3, 'une Légendaire aussi');
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
test('le deck de chaque boss est valide et le contient, chaque jour, à chaque phase et en Infini', () => {
  for (const b of Choc.RAID.bosses) {
    for (let j = 0; j < 28; j++) {
      const jour = new Date(Date.UTC(2026, 10, 2 + j)).toISOString().slice(0, 10);
      const coul = Choc.chocCouleurs(jour, b.id);
      vrai(coul.length === 2 && coul[0] !== coul[1] && !coul.includes('neutre'), b.id + ' ' + jour + ' : deux vraies couleurs ' + coul);
      for (const cle of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'i1', 'i4', 'i9']) {
        const d = Choc.deckBoss(jour, cle, b.id);
        egal(Decks.verifier(d), [], b.id + ' ' + jour + ' ' + cle);
        vrai(d.cartes[b.id] === 1, b.nom + ' manque');
        egal(d.couverture, b.id);
        egal(JSON.stringify(Choc.deckBoss(jour, cle, b.id)), JSON.stringify(d), 'même jour, même deck');
      }
    }
  }
  egal(JSON.stringify(Choc.deckSorcier('2026-11-03', 'p2')), JSON.stringify(Choc.deckBoss('2026-11-03', 'p2', 'c116')), 'deckSorcier = deckBoss du Sorcier');
});
test('l\'Épreuve du jour est la même pour tous, et ses decks sont valides les 14 jours', () => {
  const a = Choc.epreuveDuJour('2026-10-11', 123456789, 3), b = Choc.epreuveDuJour('2026-10-11', 123456789, 3);
  egal(JSON.stringify(a), JSON.stringify(b));
  for (let n = 1; n <= 14; n++) {
    const jour = new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10);
    for (const g of [1, 77, 123456789, 4294967295]) {
      const x = Choc.epreuveDuJour(jour, g, n);
      egal(Decks.verifier(x.moi), [], 'jour ' + n + ' graine ' + g + ' (toi)');
      egal(Decks.verifier(x.adv), [], 'jour ' + n + ' graine ' + g + ' (IA)');
      egal(x.regle.id, Choc.CHOC.epreuve.calendrier[n - 1], 'la règle du calendrier, jour ' + n);
    }
  }
});
/* Deux semaines depuis la 3.0.13 (trois de la 3.0.11 à la 3.0.12). */
test('le calendrier des 14 Épreuves : chaque semaine ses sept règles, jamais deux jours de suite', () => {
  const cal = Choc.CHOC.epreuve.calendrier, ids = Choc.CHOC.epreuve.regles.map(r => r.id);
  egal(cal.length, 14);
  for (const id of cal) vrai(ids.includes(id), 'règle inconnue ' + id);
  for (let s = 0; s < 2; s++) egal(new Set(cal.slice(7 * s, 7 * s + 7)).size, 7, 'semaine ' + (s + 1));
  for (let k = 1; k < 14; k++) vrai(cal[k] !== cal[k - 1], 'deux jours de suite : ' + (k + 1));
  for (const id of ids) {
    const places = [0, 1].map(s => cal.slice(7 * s, 7 * s + 7).indexOf(id));
    egal(new Set(places).size, 2, id + ' : jamais le même jour de la semaine');
  }
  /* Hors calendrier (sans numéro, ou au-delà du 14e jour) : une règle par
     jour, à tour de rôle, comme avant la 3.0.11. */
  const vus = new Set();
  for (let j = 0; j < 7; j++) vus.add(Choc.regleEpreuve(new Date(Date.UTC(2026, 9, 1 + j)).toISOString().slice(0, 10)).id);
  egal(vus.size, 7, 'une règle différente chaque jour de la semaine');
  egal(Choc.regleEpreuve('2026-11-16', 15).id, Choc.regleEpreuve('2026-11-16').id, 'le 15e jour tourne');
});
test('le score de l\'Épreuve : victoire, puis moins de tours, puis plus de PV', () => {
  const s = Choc.scoreEpreuve;
  vrai(s({ gagne: true, tours: 20, pv: 1 }) > s({ gagne: false, touches: 6, pv: 5 }));
  vrai(s({ gagne: true, tours: 8, pv: 1 }) > s({ gagne: true, tours: 9, pv: 5 }));
  vrai(s({ gagne: true, tours: 8, pv: 3 }) > s({ gagne: true, tours: 8, pv: 2 }));
  vrai(s({ gagne: false, touches: 4, pv: 0 }) > s({ gagne: false, touches: 3, pv: 2 }));
});
test('chaque boss commence sur le plateau, au milieu, jamais en main ni en PV', () => {
  for (const b of Choc.RAID.bosses) {
    for (let g = 1; g <= 40; g++) {
      const E = Combat.creer({ decks: [Decks.versMoteur(Decks.STARTERS.deter), Decks.versMoteur(Choc.deckBoss('2026-10-11', 'p3', b.id))],
        graine: g, pv: [5, 7], essDepart: [0, 1], poses: Choc.posesBoss(b.id) });
      while (Combat.demande(E) && Combat.demande(E).but === 'mulligan') Combat.agir(E, { t: 'choix', v: 'oui' });
      const P = E.j[1];
      egal((P.lignes[1] || {}).id, b.id, b.id + ' graine ' + g);
      const ailleurs = ['main', 'pv', 'club', 'defausse'].reduce((n, z) => n + P[z].filter(c => Decks.cleCopie(c.id) === Decks.cleCopie(b.id)).length, 0);
      egal(ailleurs, 0, 'un seul ' + b.nom + ', graine ' + g);
      egal(P.pv.length, 7);
    }
  }
});
test('le Raid : des phases de plus en plus dures, des paliers croissants, un Infini qui se durcit', () => {
  const ph = Choc.RAID.phases;
  egal(ph.length, 6);
  for (let k = 1; k < ph.length; k++) vrai(ph[k].seuil > ph[k - 1].seuil, 'les paliers montent, phase ' + (k + 1));
  let avant = Choc.raidCombat('p1');
  for (let k = 2; k <= 6; k++) {
    const c = Choc.raidCombat('p' + k);
    vrai(c.ia >= avant.ia && c.pvBoss >= avant.pvBoss && c.ess >= avant.ess, 'jamais plus facile, phase ' + k);
    avant = c;
  }
  let pi = Choc.raidCombat('i1');
  vrai(pi.infini && pi.pvBoss >= Choc.raidCombat('p6').pvBoss, 'l\'Infini part de la dernière phase');
  for (let n = 2; n <= 20; n++) {
    const c = Choc.raidCombat('i' + n);
    vrai(c.pvBoss >= pi.pvBoss && c.ess >= pi.ess && c.pvMoi <= pi.pvMoi, 'jamais plus facile, Infini ' + n);
    vrai(c.pvBoss <= 12 && c.ess <= 3 && c.pvMoi >= 2, 'des plafonds, Infini ' + n);
    pi = c;
  }
  const p = Choc.RAID.perso;
  for (let k = 1; k < p.length; k++) vrai(p[k].seuil > p[k - 1].seuil, 'paliers personnels croissants');
});
test('les étoiles d\'un deck : trois conseils, comptés par demies (3.0.16), plus de clés ni de cote', () => {
  const b = Decks.bilan(Decks.STARTERS.toxique);
  egal(b.sur, 3);
  vrai(b.note === 3 && b.nom === 'Solide', 'le Starter Toxique : trois étoiles');
  /* Le même Club avec une Réserve tout en Mauve : la Réserve n'est plus
     accordée (0 ou une demi-étoile), et le conseil dit pourquoi. */
  const d = JSON.parse(JSON.stringify(Decks.STARTERS.toxique));
  d.reserve = { mauve: 10 };
  const r = Decks.bilan(d).reperes.find(x => x.cle === 'reserve');
  vrai(r.etat !== 'ok' && /pour l'étoile entière/.test(r.dit), 'une Réserve mal accordée');
  /* 13 Joueurs : presque (une demi-étoile), « encore 2 ». */
  const treize = {};
  let nj = 0;
  for (const [id, q] of Object.entries(Decks.STARTERS.toxique.cartes)) {
    if (Combat.carte(id).cat !== 'joueur' || nj >= 13) continue;
    treize[id] = Math.min(q, 13 - nj); nj += treize[id];
  }
  const j = Decks.bilan({ cartes: treize, reserve: {} }).reperes.find(x => x.cle === 'joueurs');
  vrai(j.etat === 'presque' && /encore 2/.test(j.dit), '13 Joueurs : presque');
  vrai(typeof Decks.cles === 'undefined' && typeof Decks.COTES === 'undefined', 'plus de clés ni de cote');
  vrai(typeof Decks.assistant === 'undefined', 'plus d\'assistant');
});
test('le Raid : la page et le serveur ont les mêmes phases, les mêmes coffres, la même vie des boss', () => {
  /* 27_raid.sql garde sa copie des chiffres (raid_phases, raid_perso,
     raid_vie) : elle doit dire la même chose que js/combat/choc-data.js. */
  const sql = require('fs').readFileSync(require('path').join(__dirname, '../supabase/installation/27_raid.sql'), 'utf8');
  const bloc = f => JSON.parse(sql.split('function public.' + f + '()')[1].split("select '")[1].split("'::jsonb")[0]);
  egal(bloc('raid_phases'), JSON.parse(JSON.stringify(Choc.RAID.phases)), 'raid_phases');
  egal(bloc('raid_perso'), JSON.parse(JSON.stringify(Choc.RAID.perso)), 'raid_perso');
  const vie = sql.split('function public.raid_vie(b text)')[1].split('$$;')[0];
  for (const b of Choc.RAID.bosses) {
    const m = vie.match(new RegExp("when '" + b.id + "' then ([0-9.]+)"));
    egal(m ? Number(m[1]) : 1, b.vie || 1, 'la vie de ' + b.id);
  }
  /* Le dernier coffre est l'exploit : une Légendaire, et un titre qui existe. */
  const fin = Choc.RAID.phases[5].commun;
  egal(fin.type, 'legendaire');
  vrai(fin.bonus && fin.bonus.type === 'titre' && Choc.TITRES[fin.bonus.objet], 'le titre du dernier coffre existe');
});
test('les raids durent deux semaines depuis le premier jour du Choc, sans trou ni chevauchement', () => {
  /* Un Choc ouvert le lundi 2 novembre à minuit, pour 21 jours. */
  const A = '2026-11-02';
  const a = Choc.raidSaison('2026-11-02', A), b = Choc.raidSaison('2026-11-15', A), c = Choc.raidSaison('2026-11-16', A);
  egal([a.n, b.n, c.n], [1, 1, 2]);
  egal(a.debut, '2026-11-02'); egal(a.fin, '2026-11-16'); egal(c.debut, a.fin);
  egal([a.boss, c.boss, Choc.raidSaison('2026-11-30', A).boss], ['c116', 'c121', 'c116'], 'les boss à tour de rôle');
  /* Le raid 2 commence une semaine avant la fin de l'événement (le 23). */
  egal(Math.round((Date.parse('2026-11-23T00:00:00Z') - Date.parse(c.debut + 'T00:00:00Z')) / 86400000), 7);
  egal(Choc.raidSaison('2026-10-20', A).n, 1, 'avant le Choc, le raid 1');
  /* Sans Choc : depuis RAID.saison.depart, comme avant la 3.0.11. */
  const v = Choc.raidSaison('2026-10-25'), w = Choc.raidSaison('2026-10-26');
  egal([v.n, w.n, v.debut], [1, 2, '2026-10-12']);
  egal(Choc.raidBoss(1).id, 'c116'); egal(Choc.raidBoss(2).id, 'c121'); egal(Choc.raidBoss('c121').nom, 'Le Marionnettiste');
});
test('une partie de Raid (phase 5) va à son terme, contre chaque boss, avec son réglage', () => {
  const ph = Choc.raidCombat('p5');
  /* La phase 5 depuis la 3.0.16 (le Raid allégé) : 7 PV, une Essence
     d'avance. */
  egal([ph.pvBoss, ph.ess], [7, 1], 'les chiffres de la phase');
  /* Règles officielles (3.0.12) : les deux boss, un PV et une Essence de
     moins que la phase. */
  for (const id of ['c121', 'c116']) {
    const m = Choc.raidCombat('p5', id);
    egal([m.pvBoss, m.ess], [6, 0], `${id} : un PV et une Essence de moins`);
  }
  for (const b of Choc.RAID.bosses) {
    const p = Choc.raidCombat('p5', b.id);
    for (const g of [77, 78, 79]) {
      const E = Combat.creer({ decks: [Decks.versMoteur(Decks.STARTERS.deter), Decks.versMoteur(Choc.deckBoss('2026-11-17', 'p5', b.id))],
        graine: g, pv: [p.pvMoi, p.pvBoss], essDepart: [0, p.ess], poses: Choc.posesBoss(b.id) });
      egal(E.j[1].pvDepart, p.pvBoss);
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
      vrai(E.fin, b.nom + ' : la partie doit finir (graine ' + g + ')');
    }
  }
});

console.log('XP et niveaux');
test('la courbe d\'XP : 100 au niveau 1, +25 par niveau, plafonnée à 1 100', () => {
  egal(Niveaux.xpRequis(1), 100);
  egal(Niveaux.xpRequis(2), 125);
  egal(Niveaux.xpRequis(41), 1100);
  egal(Niveaux.xpRequis(200), 1100);
  egal(JSON.stringify(Niveaux.niveauDe(0)), JSON.stringify({ niveau: 1, dans: 0, requis: 100 }));
  egal(Niveaux.niveauDe(99).niveau, 1);
  egal(Niveaux.niveauDe(100).niveau, 2);
  egal(JSON.stringify(Niveaux.niveauDe(230)), JSON.stringify({ niveau: 3, dans: 5, requis: 150 }));
});
test('l\'XP d\'un combat : victoire > défaite, difficulté, vaincus plafonnés', () => {
  egal(Niveaux.xpCombat('infini', 3, true, 0, 9), 50);
  egal(Niveaux.xpCombat('infini', 3, false, 0, 9), 20);
  egal(Niveaux.xpCombat('infini', 3, false, 0, 2), 0, 'un abandon au 2e tour ne rapporte rien');
  egal(Niveaux.xpCombat('infini', 5, true, 0, 3), 75);
  egal(Niveaux.xpCombat('campagne', 1, true, 2, 8), 38);
  egal(Niveaux.xpCombat('infini', 3, true, 40, 8), 74);
  egal(Niveaux.xpCombat('defi', 0, true, 0, 7), 80);
});
test('chaque niveau paie, les paliers paient plus, sans fin après 50', () => {
  egal(Niveaux.recompenseNiveau(1), null);
  egal(Niveaux.recompenseNiveau(2).eclats, 50);
  egal(Niveaux.recompenseNiveau(10).cadre, 'f_niv10');
  egal(Niveaux.recompenseNiveau(55).boosters, 2);
  egal(Niveaux.recompenseNiveau(56).boosters, undefined);
  vrai(Niveaux.prochainsPaliers(1, 3).map(r => r.niveau).join() === '3,5,10');
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

console.log('Le tutoriel (js/combat/tutoriel.js)');
test('la partie écrite se déroule comme les bulles le disent', () => {
  const E = Combat.creer({ decks: [{ club: Tuto.TUTO_MOI, reserve: Array(10).fill('rose') }, { club: Tuto.TUTO_LUI, reserve: Array(10).fill('mauve') }],
    graine: 7, premier: 0, ordre: true, pv: Tuto.TUTO_PV });
  egal(Tuto.TUTO_MOI.length, 40, 'mon Club : 40 cartes');
  egal(Tuto.TUTO_LUI.length, 40, 'le Club du Rival : 40 cartes');
  const d = () => Combat.demande(E);
  const u = (j, id) => { const P = E.j[j]; const c = P.main.find(x => x.id === id) || P.lignes.find(x => x && x.id === id); return c && c.u; };
  const coup = f => { const a = Combat.optionsTour(E).find(f); vrai(a, 'coup introuvable au tour ' + E.tour); Combat.agir(E, a); };
  const rival = () => { let n = 0; while (d() && d().qui === 1 && n++ < 40) Combat.agir(E, Tuto.tutoRival(E)); };
  Combat.agir(E, { t: 'choix', v: 'oui' }); rival();
  /* Tour 1 : l'entretien a pioché Pas Compris ; deux Joueurs, un Objet ;
     Caprice de Gotaga (Jade) ne se joue pas ; pas d'attaque. */
  egal(E.j[0].main.map(c => c.id), ['c078', 'c011', 'c085', 'c038', 'c097', 'c013'], 'la main après la pioche du tour 1');
  egal(E.j[0].pv.length, 4, '4 PV');
  egal(E.j[1].pv.length, 2, 'le Rival : 2 PV');
  coup(a => a.t === 'deployer' && a.u === u(0, 'c078') && a.ligne === 1);
  coup(a => a.t === 'deployer' && a.u === u(0, 'c011') && a.ligne === 0);
  coup(a => a.t === 'lier' && a.u === u(0, 'c085') && a.cible === u(0, 'c011'));
  vrai(!Combat.optionsTour(E).some(a => a.u === u(0, 'c038')), 'Caprice de Gotaga : pas d\'Essence Jade');
  vrai(!Combat.optionsTour(E).some(a => a.t === 'attaquer'), 'pas de combat au premier tour');
  Combat.agir(E, { t: 'finTour' });
  rival();
  /* Tour 2 : Baby Driver attaque, Vandale défend et tient ; le Rival
     défausse à la fin de son tour. */
  egal(d().but, 'defense', 'Baby Driver attaque');
  Combat.agir(E, { t: 'choix', v: u(0, 'c011') });
  rival();
  egal(E.tour, 3);
  egal(E.j[1].main.length, 5, 'le Rival a défaussé jusqu\'à 5 cartes');
  /* Tour 3 : Provocation, Doig'Dance, l'attaque, la défense de La
     Planète, le soutien de Vandale, Légion, puis Pas Compris touche. */
  coup(a => a.t === 'deployer' && a.u === u(0, 'c013') && a.ligne === 2);
  coup(a => a.t === 'jouer' && a.u === u(0, 'c097'));
  coup(a => a.t === 'attaquer' && a.u === u(0, 'c078') && a.k === 0);
  rival();
  egal(d().but, 'soutien', 'La Planète défend : le soutien est proposé');
  const sv = d().options.find(o => o.u === u(0, 'c011'));
  vrai(sv && sv.info.vaincu, 'avec Vandale, La Planète tombe');
  Combat.agir(E, { t: 'choix', v: sv.v });
  rival();
  vrai(!E.j[1].lignes[1], 'La Planète vaincue');
  vrai(E.j[1].main.some(c => c.id === 'c051'), 'Légion : La Planète en main');
  coup(a => a.t === 'attaquer' && a.u === u(0, 'c013') && a.cible === 'ceo');
  rival();
  egal(E.j[1].pv.length, 1, 'le Rival touché');
  Combat.agir(E, { t: 'finTour' });
  rival();
  /* Tour 4 : Baby Driver touche ; la Résilience de Gros Bonnet. */
  egal(d().but, 'resilience', 'touché : la Résilience de Gros Bonnet');
  Combat.agir(E, { t: 'choix', v: 'oui' });
  egal(d().but, 'lierAllie', 'Gros Bonnet se lie');
  Combat.agir(E, { t: 'choix', v: d().options[0].v });
  rival();
  /* Tour 5 : deux touches gagnent. */
  egal(E.tour, 5);
  coup(a => a.t === 'attaquer' && a.u === u(0, 'c011') && a.cible === 'ceo'); rival();
  coup(a => a.t === 'attaquer' && a.u === u(0, 'c013') && a.cible === 'ceo'); rival();
  vrai(E.fin && E.fin.gagnant === 0 && E.fin.raison === 'pv', 'la victoire au tour 5');
});

/* ---------- L'historique des combats (version 3.0.12) ---------- */
test('l\'historique résume chaque partie tour par tour, et chaque ligne se lit', () => {
  const r0 = rng(31);
  let max = 0, total = 0, remplacements = 0;
  for (let i = 0; i < 150; i++) {
    const d1 = Decks.aleatoire(r0, {}), d2 = Decks.aleatoire(r0, {});
    const E = partie([d1, d2], 7000 + i, [auHasard, auHasard]);
    for (const moi of [0, 1]) {
      const x = Histo.resumer(E, moi);
      egal(x.v, 1);
      egal(x.premier, E.premier === moi ? 0 : 1, 'qui commence, vu par ' + moi);
      const taille = JSON.stringify(x).length;
      vrai(taille <= Histo.TAILLE, 'trop long : ' + taille);
      max = Math.max(max, taille); total += taille;
      let n = -1;
      for (const [k, qui, l] of x.tours) {
        vrai(k > n, 'les tours dans l\'ordre'); n = k;
        vrai(k === 0 ? qui === null : qui === 0 || qui === 1, 'à qui le tour');
        for (const y of l) {
          const t = Histo.ligne(y, 'Rival');
          vrai(t && !/undefined|NaN|une carte/.test(t), 'ligne illisible : ' + JSON.stringify(y) + ' → ' + t);
        }
      }
      const der = x.tours[x.tours.length - 1][2];
      if (!x.coupe) egal(der[der.length - 1][0], 'fi', 'la dernière ligne dit la fin');
      /* Chaque déploiement a sa ligne : déployé, posé au départ, ou en
         remplacement d'un Joueur bench juste avant. */
      const dep = E.ev.filter(e => e.t === 'deploie').length;
      const lignesDep = x.tours.reduce((s, t) => s + t[2].filter(y => ['de', 'po', 'rp'].includes(y[0])).length, 0);
      if (!x.coupe) egal(lignesDep, dep, 'une ligne par déploiement');
      remplacements += x.tours.reduce((s, t) => s + t[2].filter(y => y[0] === 'rp').length, 0);
      const att = E.ev.filter(e => e.t === 'attaque').length;
      if (!x.coupe) egal(x.tours.reduce((s, t) => s + t[2].filter(y => y[0] === 'at').length, 0), att, 'une ligne par attaque');
    }
    const en = Histo.entree(E, 0, { titre: 'Arcade · Normal', adversaire: { nom: 'IA', avatar: 'star' }, deck: 'Mon deck' });
    egal([en.tours, en.pv, en.pv_adv, en.raison], [E.tour, E.j[0].pv.length, E.j[1].pv.length, E.fin.raison]);
  }
  vrai(remplacements > 0, 'aucun remplacement dans 300 résumés : le cas n\'est pas éprouvé');
  console.log(`      (300 résumés : ${Math.round(total / 300)} signes en moyenne, ${max} au plus, ${remplacements} remplacements)`);
});

test('l\'historique d\'une partie entre deux IA : taille, et la fin', () => {
  const E = partie([Decks.STARTERS.toxique, Decks.STARTERS.deter], 4242, [E => IA.choisir(E, { niveau: 3 }), E => IA.choisir(E, { niveau: 3 })]);
  const x = Histo.resumer(E, 0);
  const fin = x.tours[x.tours.length - 1][2].slice(-1)[0];
  egal(fin, ['fi', E.fin.gagnant === 0 ? 0 : 1, E.fin.raison]);
  vrai(JSON.stringify(x).length < 12000, 'une partie de Starters tient en moins de 12 000 signes : ' + JSON.stringify(x).length);
  console.log(`      (${E.tour} tours, ${JSON.stringify(x).length} signes)`);
});

/* ---------- La copie d'un Starter (version 3.0.14) ---------- */
test('un Starter ne se copie qu\'avec ses propres cartes, toutes versions comprises', () => {
  const st = Decks.STARTERS.toxique;
  let r = Decks.copieStarter(st, {});
  egal([r.ok, r.nManque, r.cartes], [false, 40, null], 'sans rien');
  const exact = Object.assign({}, st.cartes);
  r = Decks.copieStarter(st, exact);
  const tri = o => Object.fromEntries(Object.entries(o).sort());
  egal(tri(r.cartes), tri(st.cartes), 'avec exactement ses cartes, la copie est le Starter');
  /* Sans P04 mais avec trois Squeezie classiques : même nom, même couleur. */
  const sansPromo = Object.assign({}, st.cartes, { c012: 3 }); delete sansPromo.p04;
  r = Decks.copieStarter(st, sansPromo);
  egal([r.ok, r.cartes.c012, r.cartes.p04], [true, 3, undefined], 'la classique remplace la Promo');
  /* Une Reverse compte comme sa classique ; la copie reste valide contre la collection. */
  const reverse = Object.assign({}, st.cartes, { c010: 1, r010: 2 });
  r = Decks.copieStarter(st, reverse);
  egal([r.cartes.c010, r.cartes.r010], [1, 2]);
  egal(Decks.verifier({ cartes: r.cartes, reserve: st.reserve }, reverse), [], 'copie valide');
  /* Plus d'exemplaires qu'il n'en faut : la Promo du Starter garde sa place. */
  r = Decks.copieStarter(st, Object.assign({}, st.cartes, { c012: 5 }));
  egal([r.cartes.p04, r.cartes.c012, Decks.total(r.cartes)], [1, 2, 40]);
  /* Il en manque deux : ni copie, ni carte inventée. */
  r = Decks.copieStarter(st, Object.assign({}, st.cartes, { c015: 1 }));
  egal([r.ok, r.nManque, r.manque], [false, 2, [{ nom: Combat.carte('c015').nom, n: 2 }]]);
});

/* ---------- La vérification des combats (3.0.14) ---------- */
/* Une partie comme l'arène la joue (capture : les photos de l'animation),
   le joueur tenu par l'IA d'un niveau donné, l'adversaire par le sien. */
function jouerVerif(o, nivJoueur) {
  const p = Verif.partie(o);
  const E = Combat.creer(p.init, { capture: true });
  let g = 0;
  while (Combat.demande(E) && g++ < 4000) {
    const d = Combat.demande(E);
    Combat.agir(E, IA.choisir(E, { niveau: d.qui === 0 ? (nivJoueur || 2) : p.niveau }));
  }
  return { E, journal: JSON.parse(JSON.stringify(E.journal)), p };
}
const deckMoteur = s => Decks.versMoteur(Decks.STARTERS[s]);
const OUVERTURES = [
  { mode: 'campagne', cle: 'cp01', section: 'toxique', graine: 11, deck: deckMoteur('toxique') },
  { mode: 'campagne', cle: 'cp12', section: 'deter', graine: 12, deck: deckMoteur('deter') },
  { mode: 'infini', cle: '1', niveau: 1, graine: 13, deck: deckMoteur('deter') },
  { mode: 'infini', cle: '3', niveau: 3, graine: 14, deck: deckMoteur('toxique') },
  { mode: 'raid', cle: 'p2', jour: '2026-11-03', boss: 'c116', graine: 15, deck: deckMoteur('toxique') },
  { mode: 'raid', cle: 'p3', jour: '2026-11-17', boss: 'c121', graine: 16, deck: deckMoteur('deter') },
  { mode: 'epreuve', cle: '2026-11-04', jour: '2026-11-04', n: 4, graine: 17 },
  { mode: 'epreuve', cle: '2026-11-07', jour: '2026-11-07', n: 7, graine: 18 }
];
const PARTIES = OUVERTURES.map(o => Object.assign({ o }, jouerVerif(o)));

test('le serveur rejoue chaque mode et confirme le résultat de la page', () => {
  for (const { o, E, journal } of PARTIES) {
    const r = Verif.rejouer(o, journal, { meta: { titre: 'Test' } });
    egal(r.etat, 'fini', o.mode + ' ' + o.cle + ' : ' + (r.raison || ''));
    const v = Verif.verdict(E, 0);
    egal(r.verdict, v, o.mode + ' ' + o.cle);
    vrai(r.histo && r.histo.titre === 'Test' && r.histo.journal, 'l\'historique est bâti par le serveur');
  }
});

test('la partie de la page est celle du serveur (deck, PV, Essences, boss, niveau)', () => {
  const raid = Verif.partie(OUVERTURES[4]);
  const c = Choc.raidCombat('p2', 'c116');
  egal([raid.init.pv, raid.init.essDepart, raid.niveau, raid.init.poses], [[c.pvMoi, c.pvBoss], [0, c.ess], c.ia, Choc.posesBoss('c116')]);
  const ep = Verif.partie(OUVERTURES[6]);
  const x = Choc.epreuveDuJour('2026-11-04', 17, 4);
  egal([ep.init.decks, ep.init.pv, ep.niveau], [[Decks.versMoteur(x.moi), Decks.versMoteur(x.adv)], x.regle.pv, Choc.CHOC.epreuve.ia]);
  const cp = Verif.partie(OUVERTURES[1]);
  const f = Campagne.combatsCampagne('deter')[11];
  egal([cp.init.decks[1], cp.niveau], [Decks.versMoteur(Campagne.deckRival(f, 'deter')), f.niveau]);
  let err = null;
  try { Verif.partie({ mode: 'infini', niveau: 3, graine: 1 }); } catch (e) { err = e.message; }
  egal(err, 'Deck du joueur absent.');
});

test('un coup de l\'adversaire falsifié, un coup impossible, un abandon prêté à l\'adversaire : refusés', () => {
  const { o, journal } = PARTIES[3];
  /* Le premier coup de l'adversaire qui avait une autre possibilité : on la lui fait jouer. */
  const p = Verif.partie(o);
  const E = Combat.creer(p.init);
  let faux = null;
  for (let k = 0; k < journal.length && !faux; k++) {
    const d = Combat.demande(E);
    if (d.qui === 1) {
      const autre = Combat.options(E).find(a => Verif.canon(a) !== Verif.canon(journal[k]));
      if (autre) faux = { k, autre };
    }
    Combat.agir(E, journal[k]);
  }
  vrai(faux, 'une décision de l\'adversaire avait un autre choix');
  const j1 = journal.slice(0, faux.k).concat([faux.autre], journal.slice(faux.k + 1));
  let r = Verif.rejouer(o, j1);
  egal([r.etat, r.k], ['refus', faux.k]);
  vrai(/pas celui qu'il aurait joué/.test(r.raison), r.raison);
  /* Un coup du joueur que les règles refusent. */
  const E2 = Combat.creer(p.init);
  let kj = -1;
  for (let k = 0; k < journal.length; k++) {
    const d = Combat.demande(E2);
    if (d.qui === 0 && d.type === 'tour' && kj < 0 && E2.tour >= 3) { kj = k; break; }
    Combat.agir(E2, journal[k]);
  }
  vrai(kj >= 0);
  const j2 = journal.slice(0, kj).concat([{ t: 'attaquer', u: 99999, k: 0, cible: 'ceo' }], journal.slice(kj + 1));
  r = Verif.rejouer(o, j2);
  egal([r.etat, r.k], ['refus', kj]);
  vrai(/refusé par les règles/.test(r.raison), r.raison);
  /* L'adversaire « abandonne » : la page ne peut pas le dire. */
  r = Verif.rejouer(o, journal.slice(0, 10).concat([{ t: 'abandon', qui: 1 }]));
  egal(r.etat, 'refus');
  vrai(/n'abandonne jamais/.test(r.raison), r.raison);
});

test('un abandon se vérifie (perdu), une partie inachevée est refusée, rien après la fin', () => {
  const { o, journal } = PARTIES[2];
  let r = Verif.rejouer(o, journal.slice(0, 12).concat([{ t: 'abandon', qui: 0 }]));
  egal([r.etat, r.verdict && r.verdict.gagne, r.verdict && r.verdict.abandon, r.verdict && r.verdict.raison], ['fini', false, true, 'abandon']);
  r = Verif.rejouer(o, journal.slice(0, 12));
  egal(r.etat, 'refus');
  vrai(/pas finie/.test(r.raison), r.raison);
  r = Verif.rejouer(o, journal.concat([{ t: 'choix', v: 'oui' }]));
  egal([r.etat, r.k], ['refus', journal.length]);
  r = Verif.rejouer(o, journal.slice(0, 5).concat([{ t: 'abandon', qui: 0 }, { t: 'choix', v: 'oui' }]));
  egal(r.etat, 'refus');
});

test('vérifier en plusieurs passes donne le même verdict qu\'en une', () => {
  const { o, journal } = PARTIES[4];
  const une = Verif.rejouer(o, journal);
  let k = 0, passes = 0, r;
  do {
    r = Verif.rejouer(o, journal, { depuis: k, budget: 1 });
    passes++;
    if (r.etat === 'suite') { vrai(r.k > k || passes === 1, 'chaque passe avance (' + k + ' → ' + r.k + ')'); k = r.k; }
    /* Un budget d'1 ms laisse au moins un coup par passe : jamais plus de passes que de coups. */
    vrai(passes <= journal.length + 2, 'trop de passes');
  } while (r.etat === 'suite');
  egal(r.etat, 'fini');
  egal(r.verdict, une.verdict);
  vrai(passes > 1, 'il a fallu plusieurs passes (' + passes + ')');
});

test('un défi entre amis : le gagnant se rejoue ; un coup hors de son tour fait perdre son auteur', () => {
  const decks = [deckMoteur('toxique'), deckMoteur('deter')];
  const E = Combat.creer({ decks, noms: ['A', 'B'], graine: 21 });
  let g = 0;
  const auteurs = [];
  while (Combat.demande(E) && g++ < 4000) { const d = Combat.demande(E); auteurs.push(d.qui); Combat.agir(E, IA.choisir(E, { niveau: 2 })); }
  const actions = JSON.parse(JSON.stringify(E.journal));
  let r = Verif.defi({ decks, graine: 21, actions, auteurs });
  egal([r.fini, r.gagnant, r.fautif], [true, E.fin.gagnant, null]);
  /* Le coup 6 envoyé par l'autre joueur. */
  const a2 = auteurs.slice(); a2[6] = 1 - a2[6];
  r = Verif.defi({ decks, graine: 21, actions, auteurs: a2 });
  egal([r.fini, r.fautif, r.gagnant], [true, a2[6], 1 - a2[6]]);
  /* Un coup impossible : son auteur perd. */
  const a3 = actions.slice(); a3[8] = { t: 'attaquer', u: 424242, k: 0, cible: 'ceo' };
  r = Verif.defi({ decks, graine: 21, actions: a3, auteurs });
  egal([r.fautif, r.gagnant], [auteurs[8], 1 - auteurs[8]]);
  /* Un abandon envoyé au nom de l'autre. */
  const a4 = actions.slice(0, 9).concat([{ t: 'abandon', qui: 1 - auteurs[9] }]);
  r = Verif.defi({ decks, graine: 21, actions: a4, auteurs: auteurs.slice(0, 9).concat([auteurs[9]]) });
  egal([r.fautif, r.gagnant], [auteurs[9], 1 - auteurs[9]]);
  /* Un vrai abandon : l'autre gagne. */
  r = Verif.defi({ decks, graine: 21, actions: actions.slice(0, 9).concat([{ t: 'abandon', qui: 0 }]), auteurs: auteurs.slice(0, 9).concat([0]) });
  egal([r.fini, r.gagnant, r.fautif, r.raison], [true, 1, null, 'abandon']);
  /* Pas fini : rien à payer. */
  r = Verif.defi({ decks, graine: 21, actions: actions.slice(0, 9), auteurs });
  egal([r.fini, r.gagnant], [false, null]);
});

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
