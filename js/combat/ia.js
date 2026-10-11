/* L'IA des combats (version 3.0).

   Elle joue avec les mêmes actions que le joueur, et n'en sait pas plus que
   lui : quand elle essaie un coup, elle le joue sur une copie de la partie
   où ce qu'elle ne peut pas voir — la main et le Club adverses, ses propres
   PV et la suite de son Club — a été remélangé. Elle ne triche donc pas sur
   la carte qu'elle va piocher, ni sur ce que l'adversaire tient en main.

   Cinq niveaux :
     1 Débutant   joue vite et souvent mal : un coup sur deux au hasard ;
     2 Facile     suit des règles simples, sans rien essayer ;
     3 Normal     essaie chaque coup sur une copie et garde le meilleur, avec
                  un peu d'hésitation ;
     4 Difficile  pareil, sans hésiter, et en se méfiant de la riposte ;
     5 Légende    pareil, en regardant aussi la réponse adverse la plus
                  probable. Le niveau de son deck fait le reste
                  (js/combat/decks.js). */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const O = Combat.O;
const adv = O.adv;

/* ---------- Ce que vaut une carte ---------- */
function meilleureAttaque(c) {
  return Math.max(0, ...c.atks.map(a => (a.degats == null ? 40 : a.degats)));
}
const BONUS_MC = { provocation: 12, garde: 14, shield: 18, riposte: 14, legion: 12, buff: 18, signature: 10 };
function valeurCarte(id) {
  const c = Combat.carte(id);
  if (!c) return 0;
  if (c.cat === 'joueur') {
    const kw = c.kw ? (BONUS_MC[O.sansAccent(c.kw.nom)] || 8) : 0;
    return 20 + c.def / 5 + meilleureAttaque(c) / 4 + kw;
  }
  if (c.cat === 'objet') return 26;
  if (c.cat === 'coach') return 24;
  return 20;
}

/* Un Joueur sur le plateau. */
function valeurJoueur(E, c) {
  const k = Combat.carte(c.id);
  let v = 30 + Combat.defense(E, c) / 4;
  let best = 0;
  k.atks.forEach((a, i) => { const x = Combat.valeurAttaque(E, c, i); best = Math.max(best, x == null ? 50 : x); });
  v += best / 3.5;
  for (const m of ['Provocation', 'Garde', 'Riposte', 'Légion', 'Buff']) if (Combat.aMotCle(E, c, m)) v += BONUS_MC[O.sansAccent(m)];
  if (Combat.shieldActif(E, c)) v += 18;
  v += 8 * c.obj.length;
  return v;
}

/* ---------- Évaluer une position ---------- */
/* Le point de vue du CEO `j`. Les PV comptent le plus ; puis le plateau, la
   main, les Essences ; enfin ce que l'adversaire peut faire au prochain tour
   (la « menace »). */
function evaluer(E, j, o) {
  o = o || {};
  if (E.fin) return E.fin.gagnant === j ? 1e6 : -1e6;
  const moi = E.j[j], lui = E.j[adv(j)];
  const pv = n => 110 * n + (n === 0 ? -120 : 0) + (n === 1 ? -40 : 0);
  let s = pv(moi.pv.length) - pv(lui.pv.length);
  s += 14 * Math.min(moi.main.length, 8) - 14 * Math.min(lui.main.length, 8);
  s += 9 * moi.ess.length - 9 * lui.ess.length;
  for (const c of O.joueursDe(E, j)) s += valeurJoueur(E, c);
  for (const c of O.joueursDe(E, adv(j))) s -= valeurJoueur(E, c);
  if (o.menace) {
    /* Qui attaquera au prochain coup ? Si c'est encore le tour de `j`,
       c'est l'adversaire après lui ; sinon l'adversaire, maintenant. */
    s -= menace(E, adv(j), j) * o.menace;
    if (E.actif !== j) s += 0; /* la menace de j se mesurera à son tour */
  }
  return s;
}

/* Ce que l'attaquant `a` peut probablement infliger au défenseur `d` à son
   prochain tour : des Joueurs engagés abattus, des PV. */
function menace(E, a, d) {
  const att = O.joueursDe(E, a);
  if (!att.length) return 0;
  const essences = E.j[a].ess.length + (E.actif === a ? 0 : (E.j[a].reserve.length ? 1 : 0));
  const valeurs = att.map(c => {
    let best = 0;
    Combat.carte(c.id).atks.forEach((x, k) => {
      if (x.degats == null) return;
      if (O.REGLE && Combat.totalCout(x.cout) > essences) return;
      best = Math.max(best, Combat.valeurAttaque(E, c, k) || 0);
    });
    return best;
  }).filter(v => v > 0).sort((x, y) => y - x);
  if (!valeurs.length) return 0;
  let m = 0;
  /* Les Joueurs engagés du défenseur, à portée des plus fortes attaques. */
  const exposes = O.joueursDe(E, d).filter(c => c.eng && !Combat.shieldActif(E, c));
  let dispo = valeurs.slice();
  for (const c of exposes.sort((x, y) => valeurJoueur(E, y) - valeurJoueur(E, x))) {
    const i = dispo.findIndex(v => v >= Combat.defense(E, c));
    if (i >= 0) { m += 0.55 * valeurJoueur(E, c); dispo.splice(i, 1); }
  }
  /* Le CEO : les attaques que les défenseurs libres ne peuvent pas tenir. */
  const libres = O.joueursDe(E, d).filter(c => !c.eng).length;
  const passent = Math.max(0, dispo.length - libres);
  m += passent * 70;
  if (E.j[d].pv.length === 0 && passent > 0) m += 400;
  return m;
}

/* ---------- Les choix rapides ---------- */
/* Des règles simples : pour les niveaux bas, et pour finir les coups qu'on
   essaie sur une copie. */
function rapide(E, d, r) {
  const j = d.qui;
  if (d.type === 'tour') return tourRapide(E, j, r);
  if (d.type === 'choix') return { t: 'choix', v: choixRapide(E, d, j) };
  if (d.type === 'cartes') return { t: 'cartes', u: cartesRapide(E, d, j) };
  if (d.type === 'ordre') return { t: 'ordre', u: ordreRapide(E, d) };
  throw new Error('demande inconnue');
}

function tourRapide(E, j, r) {
  const opts = Combat.optionsTour(E);
  const P = E.j[j];
  const par = t => opts.filter(o => o.t === t);
  /* Déployer le meilleur Joueur, sur la ligne la plus utile. */
  const dep = par('deployer');
  if (dep.length) {
    const best = dep.slice().sort((a, b) => scoreDeploiement(E, j, b) - scoreDeploiement(E, j, a))[0];
    return best;
  }
  /* Lier un Objet au Joueur qui en profite le plus. */
  const lie = par('lier');
  if (lie.length) {
    return lie.slice().sort((a, b) => scoreLien(E, b) - scoreLien(E, a))[0];
  }
  /* Les Instants qui piochent ou renforcent, avant d'attaquer. */
  const jo = par('jouer').filter(o => instantUtile(E, j, o));
  if (jo.length) return jo[0];
  /* Attaquer : abattre ce qui tombe, sinon le CEO. */
  const at = par('attaquer');
  if (at.length) {
    const best = at.slice().sort((a, b) => scoreAttaque(E, j, b) - scoreAttaque(E, j, a))[0];
    if (scoreAttaque(E, j, best) > 0) return best;
  }
  return opts.find(o => o.t === 'finTour') || opts[0];
}

function scoreDeploiement(E, j, o) {
  const c = E.j[j].main.find(x => x.u === o.u);
  let s = valeurCarte(c.id);
  const face = E.j[adv(j)].lignes[o.ligne];
  /* Face à un Joueur adverse : on le tient. Face au vide : on frappe. */
  if (face) s += Combat.carte(c.id).def >= 100 ? 4 : -2;
  return s + o.ligne * 0.01;
}
function scoreLien(E, o) {
  const c = O.trouverSurPlateau(E, o.cible);
  return valeurJoueur(E, c) - 10 * c.obj.length + (c.eng ? -5 : 0);
}
const INSTANTS_SURS = ['c083', 'c082', 'c107', 'c114', 'c095', 'c031', 'c037', 'c099', 'c014', 'c027', 'c028', 'c016', 'c097', 'c018', 'c026', 'c092', 'c033', 'c020', 'c061', 'c054', 'c104', 'c098', 'c103', 'c115', 'c066', 'c038', 'p01', 'c012'];
function instantUtile(E, j, o) {
  const c = E.j[j].main.find(x => x.u === o.u);
  return INSTANTS_SURS.includes(Combat.baseId(c.id));
}
function scoreAttaque(E, j, o) {
  const c = O.trouverSurPlateau(E, o.u);
  const a = Combat.carte(c.id).atks[o.k];
  if (a.degats == null) return 30;
  const val = Combat.valeurAttaque(E, c, o.k);
  if (o.cible === 'ceo') {
    /* Un défenseur en face qui tient l'attaque : peu d'intérêt. */
    const defs = Combat.defenseurs(E, c, 'ceo');
    const tient = defs.some(d => Combat.defense(E, d) > val);
    return tient ? 15 : 60;
  }
  const t = O.trouverSurPlateau(E, o.cible);
  if (!t) return 0;
  if (Combat.shieldActif(E, t)) return 5;
  return val >= Combat.defense(E, t) ? 40 + valeurJoueur(E, t) : 2;
}

function choixRapide(E, d, j) {
  const ops = d.options.map(o => o.v);
  const non = ops.includes('non') ? 'non' : ops[ops.length - 1];
  switch (d.but) {
    case 'mulligan':
      return E.j[j].main.some(c => O.estCat(c, 'joueur')) ? 'oui' : 'non';
    case 'defense': {
      /* Défendre si le défenseur tient, ou si le CEO n'a plus de marge. */
      const bons = d.options.filter(o => o.info && !o.info.vaincu);
      if (bons.length) return bons.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, a.v)) - valeurJoueur(E, O.trouverSurPlateau(E, b.v)))[0].v;
      if (d.cible === 'ceo' && E.j[j].pv.length <= 1) {
        const tous = d.options.filter(o => o.v !== 'non');
        if (tous.length) return tous.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, a.v)) - valeurJoueur(E, O.trouverSurPlateau(E, b.v)))[0].v;
      }
      return 'non';
    }
    case 'resilience': return 'oui';
    case 'legion': return E.j[j].main.length ? 'oui' : 'non';
    case 'riposte': {
      const ok = d.options.filter(o => o.info && o.info.val >= o.info.def);
      return ok.length ? ok[0].v : non;
    }
    case 'choixAdverse': return E.j[j].main.length >= 4 ? 'b' : 'a';
    case 'ravitaillement': return 'oui';
    case 'instalock': case 'monster': return 'oui';
    case 'enSlip': return 'oui';
    case 'trahison': return 'non';
    case 'maillotMaudit': return 'oui';
    case 'major': return ops[0];
    case 'engagerAdverse': case 'bancerAdverse': case 'renvoyerAdverse': case 'bloquerAdverse': case 'affaiblirAdverse': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, b.v) || { id: b.id, obj: [] }) - valeurJoueur(E, O.trouverSurPlateau(E, a.v) || { id: a.id, obj: [] }))[0].v;
    }
    case 'buffDef': case 'desengagerAllie': case 'lierAllie': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurJoueur(E, O.trouverSurPlateau(E, b.v)) - valeurJoueur(E, O.trouverSurPlateau(E, a.v)))[0].v;
    }
    case 'bancerAllie': return d.options.find(o => o.v !== 'non') ? (d.options.find(o => o.v === 'non') ? 'non' : d.options[0].v) : non;
    case 'echangerPlace': return 'non';
    case 'ajouterMain': case 'objetMain': case 'deployer': case 'ombre': case 'lierDepuis': {
      const cs = d.options.filter(o => o.v !== 'non');
      if (!cs.length) return non;
      return cs.sort((a, b) => valeurCarte(b.id) - valeurCarte(a.id))[0].v;
    }
    case 'objetSurClub': return non;
    case 'pvSortir': {
      /* Sortir de ses PV la carte la plus utile. */
      return d.options.slice().sort((a, b) => valeurCarte(b.id) - valeurCarte(a.id))[0].v;
    }
    case 'pvEntrer': {
      /* Y mettre une carte dont la Résilience sert, sinon la moins utile. */
      const cs = d.options.slice();
      const res = cs.filter(o => Combat.carte(o.id).res);
      if (res.length) return res[0].v;
      return cs.sort((a, b) => valeurCarte(a.id) - valeurCarte(b.id))[0].v;
    }
    case 'essenceAdverse': case 'bancerObjetAdverse': case 'renvoyerObjet': case 'renvoyerObjets': case 'recycler':
      return ops[0];
    default:
      return ops[0];
  }
}

function cartesRapide(E, d, j) {
  const val = u => {
    const c = E.j[j].main.find(x => x.u === u) || O.trouverSurPlateau(E, u);
    if (c && c.id) return O.trouverSurPlateau(E, u) && O.enJeu(E, c) ? valeurJoueur(E, c) : valeurCarte(c.id);
    const k = (d.cartes || []).find(x => x.u === u);
    return k ? valeurCarte(k.id) : 0;
  };
  const tri = d.parmi.slice().sort((a, b) => val(a) - val(b));
  switch (d.but) {
    case 'defausse': case 'engagerAllies': return tri.slice(0, d.min);
    case 'm4': return [];
    case 'dessous': return [];
    case 'lierDepuis': case 'buffDef': case 'recycler': return tri.reverse().slice(0, Math.max(d.min, Math.min(d.max, 2)));
    default: return tri.reverse().slice(0, d.min);
  }
}

function ordreRapide(E, d) {
  return d.parmi.slice().sort((a, b) => {
    const ca = d.cartes.find(x => x.u === a), cb = d.cartes.find(x => x.u === b);
    return valeurCarte(cb.id) - valeurCarte(ca.id);
  });
}

/* ---------- Essayer un coup ---------- */
/* Remélanger ce que `j` ne peut pas voir, dans une copie de la partie. */
function brouiller(C, j, r) {
  const m = C.j[j], l = C.j[adv(j)];
  /* La main adverse et son Club se mélangent ensemble : on sait combien il
     tient de cartes, pas lesquelles. */
  const cache = l.main.concat(l.club);
  melangerAvec(cache, r);
  l.main = cache.slice(0, l.main.length);
  l.club = cache.slice(l.main.length);
  /* Ses PV, et ceux de l'adversaire, ne se connaissent pas. */
  const a = m.pv.concat(m.club);
  if (!m.pvVus) { melangerAvec(a, r); m.pv = a.slice(0, m.pv.length); m.club = a.slice(m.pv.length); }
  else melangerAvec(m.club, r);
  if (!l.pvVus) {
    const b = l.pv.concat(l.club);
    melangerAvec(b, r);
    l.pv = b.slice(0, l.pv.length);
    l.club = b.slice(l.pv.length);
  }
  melangerAvec(m.reserve, r);
  melangerAvec(l.reserve, r);
}
function melangerAvec(l, r) {
  for (let i = l.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [l[i], l[k]] = [l[k], l[i]];
  }
}

/* Jouer `a` sur une copie, puis laisser filer la partie avec les choix
   rapides jusqu'à la fin du tour en cours : un Zacking Buff ne vaut que par
   les attaques qui le suivent. On juge la position au début du tour
   suivant — les effets « jusqu'à la fin du tour » se sont éteints. Au
   niveau 5, on laisse aussi l'adversaire jouer son tour. */
function essayer(E, j, a, r, o) {
  const C = Combat.cloner(E);
  brouiller(C, j, r);
  try {
    Combat.agir(C, a, { confiance: true });
  } catch (e) {
    return -1e9;
  }
  const tourDepart = E.tour;
  const fin = o.reponse ? tourDepart + 2 : tourDepart + 1;
  let garde = 0;
  while (Combat.demande(C) && garde++ < 300) {
    const d = Combat.demande(C);
    if (d.type === 'tour' && C.tour >= fin) break;
    Combat.agir(C, rapide(C, d, r), { confiance: true });
  }
  return evaluer(C, j, { menace: o.reponse ? 0 : o.menace });
}

/* ---------- Choisir ---------- */
const NIVEAUX = {
  1: { hasard: 0.5, essai: false, menace: 0 },
  2: { hasard: 0.12, essai: false, menace: 0 },
  3: { hasard: 0.08, essai: true, menace: 0.5, bruit: 18 },
  4: { hasard: 0, essai: true, menace: 1, bruit: 0 },
  5: { hasard: 0, essai: true, menace: 1, bruit: 0, reponse: true }
};

function graineDe(E) {
  return (E.rng ^ (E.journal.length * 2654435761)) >>> 0;
}
function aleaDe(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choisir(E, o) {
  o = o || {};
  const N = NIVEAUX[o.niveau || 3] || NIVEAUX[3];
  const d = Combat.demande(E);
  if (!d) return null;
  const j = d.qui;
  const r = aleaDe(graineDe(E) ^ (o.sel || 0));

  /* Le hasard des niveaux bas : un coup permis, n'importe lequel. */
  if (N.hasard && r() < N.hasard) {
    const opts = d.type === 'tour' ? Combat.optionsTour(E) : null;
    if (opts && opts.length) {
      const sansFin = opts.filter(x => x.t !== 'finTour');
      if (sansFin.length && r() < 0.8) return sansFin[Math.floor(r() * sansFin.length)];
    } else if (d.type === 'choix') return { t: 'choix', v: d.options[Math.floor(r() * d.options.length)].v };
  }
  if (!N.essai || d.type === 'cartes' || d.type === 'ordre') return rapide(E, d, r);

  let cands;
  if (d.type === 'tour') cands = candidatsTour(E, j);
  else cands = d.options.map(x => ({ t: 'choix', v: x.v }));
  if (cands.length === 1) return cands[0];

  /* Combien d'essais par coup : plus il y a de hasard dans la suite, plus il
     en faut ; on reste raisonnable pour un téléphone. */
  const essais = o.essais || (cands.length > 18 ? 1 : 2);
  const base = evaluer(E, j, { menace: N.menace });
  let best = null, bestS = -Infinity;
  for (const a of cands) {
    let s = 0;
    for (let i = 0; i < essais; i++) s += essayer(E, j, a, r, N);
    s /= essais;
    if (N.bruit) s += (r() - 0.5) * N.bruit;
    a._s = s;
    if (s > bestS) { bestS = s; best = a; }
  }
  /* Développer avant d'attaquer : la phase de jeu se ferme à la première
     attaque. Une action de jeu qui rapporte passe avant. */
  if (d.type === 'tour' && E.phase === 'jeu' && best.t === 'attaquer') {
    const dev = cands.filter(a => a.t === 'deployer' || a.t === 'lier' || a.t === 'jouer');
    const bonDev = dev.filter(a => a._s > base + 4).sort((x, y) => y._s - x._s)[0];
    if (bonDev) best = bonDev;
  }
  cands.forEach(a => { delete a._s; });
  return best;
}

/* Les coups à essayer : tous, sauf les déploiements en double (la même
   carte sur deux lignes vides équivalentes). */
function candidatsTour(E, j) {
  const opts = Combat.optionsTour(E);
  const vus = new Set();
  const A = E.j[adv(j)];
  return opts.filter(o => {
    if (o.t !== 'deployer') return true;
    const face = A.lignes[o.ligne];
    const k = o.u + ':' + (face ? face.u : 'vide');
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}

const IA = { choisir, evaluer, rapide, valeurCarte, valeurJoueur, menace, NIVEAUX };
if (typeof module !== 'undefined' && module.exports) module.exports = IA;
racine.IA = IA;

})(typeof globalThis !== 'undefined' ? globalThis : this);
