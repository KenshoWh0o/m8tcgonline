/* Le moteur des combats (version 3.0) : les règles, sans écran.

   Tout ce qui se passe dans une partie part d'ici. L'interface
   (js/combat/table.js) montre l'état et transmet les choix du joueur ; l'IA
   (js/combat/ia.js) choisit parmi les mêmes actions que lui. Les effets des
   cartes sont écrits à part, carte par carte (js/combat/effets.js).

   Depuis la 3.0.12, ce sont les RÈGLES OFFICIELLES du Gentle Mates TCG
   (docs/regles-officielles.md, copie du document de l'éditeur), appliquées
   au pied de la lettre ; docs/regles-3.0.md dit, règle par règle, où elles
   sont dans le code, et ce que le texte officiel ne tranche pas. Les valeurs
   de la partie (taille du Club, nombre de PV…) sont dans REGLE, juste en
   dessous. Elles sont recopiées ailleurs : le serveur
   (supabase/installation/23_combats.sql) écrit le Club de 40 et la Réserve
   de 10 dans deck_erreur, les exemplaires dans limite_copies, et la table
   starters recopie les deux Starter Decks ; le Guide (js/combat/guides.js)
   et le tutoriel (js/combat/tutoriel.js) les disent en toutes lettres.

   Trois principes :
   - Déterministe. Le hasard vient d'une graine rangée dans l'état : la même
     graine et les mêmes actions donnent la même partie. C'est ce qui permet
     le combat entre amis (chacun rejoue les actions de l'autre) et la reprise
     d'une partie après un rechargement.
   - Une partie est une coroutine. Son déroulement entier est un générateur :
     chaque fois qu'un CEO doit décider, il s'arrête sur une demande ; l'action
     choisie le relance. Un effet de carte s'écrit donc comme il se lit.
   - L'état n'est fait que de données (JSON). Au début de chaque tour, il est
     photographié : une copie de la partie — pour l'IA, qui essaie ses coups
     avant de les jouer — repart de la photo et rejoue les actions du tour.

   Le fichier marche aussi sous Node (tools/combat-sim.js), sans navigateur. */
"use strict";

(function (racine) {

/* ---------- Les valeurs de la partie ---------- */
/* Celles des règles officielles, citées. */
const REGLE = {
  LIGNES: 3,          /* « Le Terrain […] comprenant 3 cases où sont déployés les Joueur » */
  PV: 4,              /* « Piochez et empilez 4 nouvelles cartes […] face cachée » */
  MAIN: 5,            /* « Piochez les 5 premières cartes du Club pour former votre Main » */
  MAIN_MAX: 5,        /* fin de tour : « Défaussez […] pour en garder 5 maximum » */
  CLUB: 40,           /* « Votre Club doit contenir un total de 40 cartes » */
  RESERVE: 10,        /* « Votre Réserve doit contenir 10 cartes Essence » */
  COPIES: 3,          /* « pas plus de trois exemplaires d'une même carte » (même nom et même couleur) */
  COACHS: 1,          /* « Vous ne pouvez jouer qu'une seule carte Coach par tour » */
  REMPLACEMENTS: 1,   /* « il peut une fois par tour, bench un Joueur non engagé pour pouvoir jouer cette carte » */
  ESSENCES: 1         /* entretien : « Jouez la première carte de votre Réserve » */
};

/* Les neuf couleurs d'Essence. Le Neutre n'en est pas une : c'est un coût
   que n'importe quelle Essence paie. */
const COULEURS = ['rose', 'orange', 'jade', 'violette', 'jaune', 'mauve', 'verte', 'bleue', 'azur'];

/* ---------- Le catalogue et les effets ---------- */
let CAT = {};
let SCRIPTS = {};

/* Les cartes du jeu, telles que js/cards.js les construit. */
function catalogue(liste) {
  CAT = {};
  liste.forEach(c => { CAT[c.id] = c; });
}
const carte = id => CAT[id];
const toutes = () => Object.values(CAT);
/* Une Reverse joue comme sa carte d'origine : même effet, autre reflet. */
const baseId = id => { const c = CAT[id]; return (c && c.base && c.cat !== 'essence') ? c.base : id; };
const scr = id => SCRIPTS[baseId(id)] || SCRIPTS[id] || {};
function scripts(table) { Object.assign(SCRIPTS, table); }

const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Le hasard ---------- */
/* mulberry32 : rapide, assez bon, et tout son état tient dans un entier. */
function alea(E) {
  let t = (E.rng = (E.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function melanger(E, l) {
  for (let i = l.length - 1; i > 0; i--) {
    const k = Math.floor(alea(E) * (i + 1));
    [l[i], l[k]] = [l[k], l[i]];
  }
  return l;
}

/* ---------- L'état ---------- */
const nouvelleInst = (E, id, j) => ({ u: ++E.seq, id, j });

function joueurVide(o, i) {
  return {
    nom: (o.noms && o.noms[i]) || (i ? 'Adversaire' : 'Toi'),
    club: [], main: [], pv: [], reserve: [], ess: [], defausse: [],
    /* Les cartes « bench » : la défausse les reçoit comme les autres (« Le
       terme Bench signifie qu'une carte déployée est envoyée à la
       défausse »), mais un effet peut les viser (« Vos Objet bench »,
       En slip sur la Faille). */
    bench: [],
    lignes: Array(REGLE.LIGNES).fill(null),
    tours: 0, pvVus: false,
    /* Bonus de départ d'un adversaire de campagne (« maison ») */
    pvDepart: (o.pv && o.pv[i]) || REGLE.PV,
    essDepart: (o.essDepart && o.essDepart[i]) || 0
  };
}

const compteursVides = () => ({
  attaques: 0, pvRecup: [0, 0], deploie: 0, coachs: 0, remplace: 0,
  combatFini: false, doitAttaquer: 0
});

/* Une partie. `o` : {
     decks: [{ club: [ids], reserve: [couleurs] }, …],
     noms: ['Toi', 'Lumen'], graine: entier, premier: 0 | 1 (le tutoriel ;
     sinon pile ou face, à chaque partie),
     pv: [4, 5] et essDepart: [0, 1] (facultatifs : les variantes des modes,
     campagne, Épreuve, Raid) } */
/* `x` : ce qui ne fait pas partie de la partie et ne se rejoue pas —
   `capture` (l'arène : les photos des événements dès la mise en place, pour
   animer la donne, le mulligan, les PV et le tirage du premier). */
function creer(o, x) {
  const E = {
    rng: (o.graine >>> 0) || 1, seq: 0, tour: 0, actif: 0, premier: 0,
    phase: 'mise', fin: null, temp: [], cpt: compteursVides(),
    j: [0, 1].map(i => joueurVide(o, i))
  };
  cacher(E, 'init', JSON.parse(JSON.stringify(o)));
  cacher(E, 'ev', []);
  cacher(E, 'journal', []);
  cacher(E, 'snap', null);
  cacher(E, 'dem', null);
  cacher(E, 'gen', null);
  /* `capture` (version 3.0.7) : chaque événement emporte une photo de la
     partie à l'instant où il se produit (`e.etat`, du JSON). L'arène s'en
     sert pour dessiner chaque étape d'une action dans l'ordre — sans elle,
     elle ne voyait que l'état final, et un Joueur vaincu disparaissait du
     plateau avant même que l'attaque ne le touche. Seule la partie affichée
     l'allume : les copies de l'IA (cloner) ne photographient rien. */
  cacher(E, 'capture', !!(x && x.capture));
  [0, 1].forEach(i => {
    const d = o.decks[i];
    E.j[i].club = d.club.map(id => nouvelleInst(E, id, i));
    E.j[i].reserve = d.reserve.map(coul => ({ u: ++E.seq, coul, eng: false, j: i }));
  });
  /* Qui commence : « Déterminez aléatoirement qui commence la partie ». Tiré
     ici pour que la partie reste la même d'un rejeu à l'autre, mais annoncé
     à la fin de la mise en place, comme l'ordre des règles le veut (le
     jeton de l'écran de combat le montre alors, js/combat/table.js). */
  E.premier = o.premier === 0 || o.premier === 1 ? o.premier : (alea(E) < 0.5 ? 0 : 1);
  E.actif = E.premier;
  E.gen = partie(E, false);
  avancer(E);
  return E;
}

/* Ce qui ne fait pas partie de l'état de jeu : ni photographié, ni copié. */
function cacher(E, k, v) {
  Object.defineProperty(E, k, { value: v, enumerable: false, writable: true, configurable: true });
}

/* ---------- Événements ---------- */
/* Ce que l'interface anime et que le journal raconte. */
function ev(E, e) {
  if (E.capture) Object.defineProperty(e, 'etat', { value: JSON.stringify(E), enumerable: false, writable: true, configurable: true });
  E.ev.push(e);
  return e;
}

/* ---------- Petits accès ---------- */
const adv = j => 1 - j;
const joueursDe = (E, j) => E.j[j].lignes.filter(Boolean);
const tousJoueurs = E => joueursDe(E, 0).concat(joueursDe(E, 1));
/* GP Explorer II (#126, 3.0.13) : « Vous ne pouvez plus jouer de Joueur pour
   le reste de ce tour. » Jouer un Joueur, c'est le mettre en jeu sur une case
   (« Jouer une carte ») : l'action de la phase d'action, mais aussi un effet
   qui dit « jouez » (Worlds Japon, Versus Fighting, Meet & Greeter, M16). */
const joueurPermis = (E, j) => !E.temp.some(t => t.type === 'pasJoueur' && t.camp === j);
const ligneDe = (E, c) => E.j[c.j].lignes.indexOf(c);
const enJeu = (E, c) => !!c && E.j[c.j].lignes.includes(c);
const nomDe = c => (carte(c.id) || {}).nom || '?';
const estCat = (c, cat) => (carte(c.id) || {}).cat === cat;
const essencesLibres = (E, j) => E.j[j].ess.filter(e => !e.eng);

function trouverSurPlateau(E, u) {
  for (const P of E.j) for (const c of P.lignes) {
    if (!c) continue;
    if (c.u === u) return c;
    for (const o of c.obj) if (o.u === u) return o;
  }
  return null;
}
function porteurDe(E, o) {
  for (const P of E.j) for (const c of P.lignes) if (c && c.obj.includes(o)) return c;
  return null;
}

/* ---------- Mots-clés ---------- */
/* Un Joueur a un mot-clé imprimé (le talent de sa carte), un mot-clé donné
   par un Objet (Maillot Champions '25 donne Riposte), un mot-clé gagné pour
   un temps (Mur Salvateur donne Garde), ou un mot-clé sous condition (99%
   Faith). */
const MOTS_CLES = ['Provocation', 'Garde', 'Shield', 'Riposte', 'Légion', 'Buff', 'Signature'];
function motCleImprime(c) {
  const k = carte(c.id) && carte(c.id).kw;
  return k ? MOTS_CLES.find(m => sansAccent(m) === sansAccent(k.nom)) || k.nom : null;
}
function aMotCle(E, c, m) {
  if (sansAccent(motCleImprime(c)) === sansAccent(m)) return true;
  for (const o of c.obj || []) if ((scr(o.id).donne || []).includes(m)) return true;
  if (E.temp.some(t => t.type === 'kw' && t.kw === m && t.cible === c.u && !t.utilise)) return true;
  const s = scr(c.id);
  return !!(s.motsCles && s.motsCles(E, c).includes(m));
}
/* Le Shield s'use : « ignore la première attaque qu'il subit ». */
function shieldActif(E, c) {
  if (E.temp.some(t => t.type === 'kw' && t.kw === 'Shield' && t.cible === c.u && !t.utilise)) return true;
  if (c.shieldUse) return false;
  if (sansAccent(motCleImprime(c)) === 'shield') return true;
  const s = scr(c.id);
  return !!(s.motsCles && s.motsCles(E, c).includes('Shield'));
}
function userShield(E, c) {
  const t = E.temp.find(x => x.type === 'kw' && x.kw === 'Shield' && x.cible === c.u && !x.utilise);
  if (t) t.utilise = true; else c.shieldUse = true;
}

/* ---------- Les valeurs ---------- */
function bonusAttaque(E, c) {
  let b = 0;
  for (const o of c.obj) {
    const a = scr(o.id).atk;
    b += typeof a === 'function' ? a(E, c) : (a || 0);
  }
  for (const x of joueursDe(E, c.j)) if (x !== c) b += scr(x.id).buffAtk || 0;
  for (const t of E.temp) {
    if (t.type !== 'atk') continue;
    if (t.cible != null ? t.cible === c.u : t.camp === c.j && (!t.filtre || filtreOk(E, c, t.filtre))) b += t.val;
  }
  return b;
}
function filtreOk(E, c, f) {
  if (f === 'buff') return aMotCle(E, c, 'Buff');
  return true;
}

function defense(E, c) {
  let d = (carte(c.id) && carte(c.id).def) || 0;
  for (const o of c.obj) {
    const v = scr(o.id).def;
    d += typeof v === 'function' ? v(E, c) : (v || 0);
  }
  for (const x of joueursDe(E, c.j)) if (x !== c) d += scr(x.id).buffDef || 0;
  for (const t of E.temp) {
    if (t.type !== 'def') continue;
    if (t.cible != null ? t.cible === c.u : t.camp === c.j) d += t.val;
  }
  return Math.max(0, d);
}

/* La valeur d'une attaque, au moment où on la lit. `null` : une attaque sans
   valeur, qui n'a qu'un effet. */
function valeurAttaque(E, c, k, bonus) {
  const a = carte(c.id).atks[k];
  if (!a || a.degats == null) return null;
  const s = scr(c.id);
  let v = a.degats + bonusAttaque(E, c) + (bonus || 0);
  if (s.plus && s.plus[k]) v += s.plus[k](E, c);
  if (s.double && s.double(E, c)) v *= 2;
  /* Paris Gentle Mates (#127, 3.0.13) : la première attaque du tour de ce
     camp vaut double — avant qu'elle parte, toutes ses attaques possibles
     l'affichent ; ensuite, seulement celle qui est partie. */
  if (E.temp.some(t => t.type === 'doublePremiere' && t.camp === c.j)
      && (E.cpt.attaques === 0 || (E.cpt.attaques === 1 && E.cpt.premierAttaquant === c.u))) v *= 2;
  return Math.max(0, v);
}

/* ---------- Le coût d'une attaque ---------- */
const copieCout = c => Object.assign({}, c);
const totalCout = c => Object.values(c).reduce((a, b) => a + b, 0);

function coutAttaque(E, c, k, o) {
  o = o || {};
  let cout = o.chevaliere ? { neutre: 2 } : copieCout(carte(c.id).atks[k].cout);
  const rang = o.rang || (E.cpt.attaques + 1);
  for (const t of E.temp) {
    if (t.type !== 'cout' || t.payeur !== c.j) continue;
    if (t.quand === 'premiere' && rang === 1 && cout.neutre) cout.neutre = Math.max(0, cout.neutre - t.neutreMoins);
    if (t.quand === 'deuxieme' && rang === 2) cout = reduireCouleur(cout, t.couleurMoins);
    if (t.quand === 'toutes') cout.neutre = (cout.neutre || 0) + t.neutrePlus;
  }
  return nettoyerCout(cout);
}
function nettoyerCout(c) {
  const r = {};
  for (const k in c) if (c[k] > 0) r[k] = c[k];
  return r;
}
function reduireCouleur(c, n) {
  c = copieCout(c);
  for (const k of Object.keys(c)) {
    if (k === 'neutre') continue;
    while (n > 0 && c[k] > 0) { c[k]--; n--; }
  }
  return nettoyerCout(c);
}
/* « Un coût diminué de 1 » (Riposte) : un Neutre d'abord, sinon une couleur. */
function reduireUn(c, n) {
  c = copieCout(c);
  while (n > 0 && totalCout(c) > 0) {
    if (c.neutre) c.neutre--; else { const k = Object.keys(c).find(x => c[x] > 0); c[k]--; }
    n--;
  }
  return nettoyerCout(c);
}

/* Peut-on payer ce coût avec les Essences désengagées ? Les symboles de
   couleur veulent leur couleur ; le Neutre prend n'importe laquelle. */
function payable(E, j, cout) {
  const libres = essencesLibres(E, j);
  const par = {};
  libres.forEach(e => { par[e.coul] = (par[e.coul] || 0) + 1; });
  let reste = libres.length;
  for (const k in cout) {
    if (k === 'neutre') continue;
    if ((par[k] || 0) < cout[k]) return false;
    reste -= cout[k];
  }
  return reste >= (cout.neutre || 0);
}

/* Le paiement. Le CEO ne choisit pas une à une les Essences qu'il engage :
   le moteur prend pour le Neutre les couleurs dont ses autres attaques ont le
   moins besoin. */
function payer(E, j, cout) {
  const libres = essencesLibres(E, j);
  const prises = [];
  for (const k in cout) {
    if (k === 'neutre') continue;
    for (let i = 0; i < cout[k]; i++) {
      const e = libres.find(x => x.coul === k && !prises.includes(x));
      prises.push(e);
    }
  }
  if (cout.neutre) {
    const besoin = {};
    for (const c of joueursDe(E, j)) for (const a of carte(c.id).atks) {
      for (const k in a.cout) if (k !== 'neutre') besoin[k] = (besoin[k] || 0) + a.cout[k];
    }
    const dispo = libres.filter(e => !prises.includes(e))
      .sort((a, b) => (besoin[a.coul] || 0) - (besoin[b.coul] || 0));
    prises.push(...dispo.slice(0, cout.neutre));
  }
  prises.forEach(e => { e.eng = true; });
  if (prises.length) ev(E, { t: 'paie', j, ess: prises.map(e => e.u) });
  return prises;
}

/* ---------- Le déroulement ---------- */
function* partie(E, reprise) {
  if (!reprise) yield* miseEnPlace(E);
  while (!E.fin) {
    photographier(E);
    yield* tour(E);
    if (E.fin) break;
    E.actif = adv(E.actif);
  }
  E.phase = 'fin';
}

function* miseEnPlace(E) {
  /* Le boss du Raid : déjà sur le plateau au début, sans effet d'entrée.
     `poses` : [[{ id, ligne }], …]. L'exemplaire est sorti du Club avant la
     donne (sinon il pourrait finir en main ou en PV) ; s'il n'y est pas, il
     est ajouté. */
  const poses = [0, 1].map(i => ((E.init.poses || [])[i] || []).map(p => {
    const P = E.j[i];
    const k = P.club.findIndex(c => c.id === p.id);
    return { ligne: p.ligne, c: k >= 0 ? P.club.splice(k, 1)[0] : nouvelleInst(E, p.id, i) };
  }));
  /* `ordre` (le tutoriel, js/combat/tutoriel.js) : les Clubs et les
     Réserves restent dans l'ordre donné — la partie est la même à chaque
     fois. */
  if (!E.init.ordre) for (const i of [0, 1]) {
    melanger(E, E.j[i].club);
    melanger(E, E.j[i].reserve);
  }
  /* 2. « Piochez les 5 premières cartes du Club pour former votre Main. Si
        votre Main de départ ne vous convient pas, mélangez-la dans votre Club
        et piochez 5 cartes. Vous ne pouvez effectuer cette action qu'une
        fois. » */
  for (const i of [0, 1]) {
    const P = E.j[i];
    P.main = P.club.splice(0, REGLE.MAIN);
    ev(E, { t: 'main', j: i, n: P.main.length });
    const garder = yield* ouiNon(E, i, 'Garder cette main de départ ?',
      { oui: 'Garder', non: 'Changer de main', but: 'mulligan' });
    if (!garder) {
      P.club.push(...P.main);
      P.main = [];
      melanger(E, P.club);
      P.main = P.club.splice(0, REGLE.MAIN);
      ev(E, { t: 'mulligan', j: i });
    }
  }
  /* 3. « Piochez et empilez 4 nouvelles cartes et placez-les face cachée sur
        le côté de votre Terrain. Ce sont vos Points de Victoire. » */
  for (const i of [0, 1]) {
    const P = E.j[i];
    P.pv = P.club.splice(0, P.pvDepart);
    ev(E, { t: 'pv', j: i, n: P.pv.length });
    /* Campagne : un adversaire qui commence avec des Essences en jeu. */
    for (let k = 0; k < P.essDepart; k++) jouerReserve(E, i, false);
    for (const { ligne, c } of poses[i]) {
      if (P.lignes[ligne]) { P.club.push(c); continue; }
      Object.assign(c, { j: i, eng: false, obj: [], shieldUse: false, nAtt: 0 });
      P.lignes[ligne] = c;
      ev(E, { t: 'deploie', j: i, u: c.u, id: c.id, ligne, eng: false, pose: true });
    }
  }
  /* 4. « Déterminez aléatoirement qui commence la partie. » */
  ev(E, { t: 'pileFace', premier: E.premier });
}

function* tour(E) {
  const j = E.actif, P = E.j[j];
  E.tour++;
  P.tours++;
  E.cpt = compteursVides();
  E.phase = 'debut';
  ev(E, { t: 'tour', j, n: E.tour });

  /* 01. Phase d'entretien, dans l'ordre des règles. « Piochez une carte de
         votre Club » : un Club vide fait perdre (« Votre adversaire doit
         piocher dans son Club mais est dans l'incapacité de le faire »). */
  piocher(E, j, 1);
  if (E.fin) return;
  /* « Désengagez toutes vos cartes engagées. » Aucune carte ne guette ce
     désengagement-là : les deux qui réagissent à un désengagement (#047,
     #048) ne valent que jusqu'à la fin du tour où elles entrent. */
  for (const c of joueursDe(E, j)) {
    c.eng = false;
    c.nAtt = 0;
  }
  for (const e of P.ess) e.eng = false;
  ev(E, { t: 'desengagement', j });
  /* « Jouez la première carte de votre Réserve. » */
  for (let i = 0; i < REGLE.ESSENCES; i++) if (P.reserve.length) jouerReserve(E, j, false);

  /* 02. Phase d'action (`jeu`), puis 03. Phase de Combat (`combat`) : on y
     entre en déclarant la première attaque, et on n'en ressort pas. */
  E.phase = 'jeu';
  ev(E, { t: 'phaseAction', j });
  while (!E.fin) {
    const a = yield { qui: j, type: 'tour' };
    if (a.t === 'finTour') break;
    yield* actionTour(E, j, a);
  }
  if (E.fin) return;

  /* La fin de la phase de Combat, puis 04. Fin de tour (`cloture`) :
     « Défaussez autant de cartes de votre Main pour en garder 5 maximum. » */
  yield* declencher(E, 'finCombat', { j });
  if (E.fin) return;
  E.phase = 'cloture';
  ev(E, { t: 'cloture', j });
  const trop = P.main.length - REGLE.MAIN_MAX;
  if (trop > 0) {
    const us = yield* choisirCartes(E, j, `Défausse ${trop} carte${trop > 1 ? 's' : ''}`, P.main.map(x => x.u), trop, trop,
      { but: 'defausseFin', zone: 'main', texte: `Fin du tour : tu gardes ${REGLE.MAIN_MAX} cartes au plus en main.` });
    defausserMain(E, j, us);
  }
  expirer(E);
  ev(E, { t: 'finTour', j });
}

function finir(E, gagnant, raison) {
  if (E.fin) return;
  E.fin = { gagnant, raison };
  ev(E, { t: 'fin', gagnant, raison });
}

/* Les effets « jusqu'à la fin du tour » s'éteignent. Des cartes prêtées à la
   main « jusqu'à la fin du tour » (En slip sur la Faille) retournent à la
   défausse si elles y sont encore. */
function expirer(E) {
  for (const t of E.temp) {
    if (t.type !== 'retourDefausse' || t.jusqua > E.tour) continue;
    const P = E.j[t.camp];
    const l = P.main.filter(c => t.us.includes(c.u));
    for (const c of l) { P.main.splice(P.main.indexOf(c), 1); P.defausse.push(c); }
    if (l.length) ev(E, { t: 'retourDefausse', j: t.camp, u: l.map(c => c.u) });
  }
  E.temp = E.temp.filter(t => t.jusqua > E.tour);
}

/* ---------- Les actions du tour ---------- */
function* actionTour(E, j, a) {
  const P = E.j[j];
  if (a.t === 'deployer') {
    const c = retirerMain(P, a.u);
    E.cpt.deploie++;
    /* Plus de case libre : « une fois par tour, bench un Joueur non engagé
       pour pouvoir jouer cette carte » — à sa place. */
    if (a.remplace) {
      const x = trouverSurPlateau(E, a.remplace);
      E.cpt.remplace++;
      if (x && enJeu(E, x)) bancer(E, x);
    }
    yield* deployer(E, j, c, a.ligne);
  } else if (a.t === 'lier') {
    const o = retirerMain(P, a.u);
    yield* lier(E, j, o, trouverSurPlateau(E, a.cible));
  } else if (a.t === 'jouer') {
    yield* jouerInstant(E, j, a.u);
  } else if (a.t === 'attaquer') {
    if (E.phase !== 'combat') { E.phase = 'combat'; ev(E, { t: 'phaseCombat', j }); }
    yield* attaquer(E, j, trouverSurPlateau(E, a.u), a.k, a.cible, !!a.chevaliere);
  }
}

function retirerMain(P, u) {
  const i = P.main.findIndex(c => c.u === u);
  return i < 0 ? null : P.main.splice(i, 1)[0];
}

/* « Restriction par couleur : les cartes Objet, Coach et Moment d'une
   couleur spécifique ne peuvent être jouées que si vous avez une Essence de
   la couleur correspondante déployée sur le Terrain » — engagée ou non ; ce
   n'est pas un coût. Une carte Neutre n'a pas de couleur spécifique. */
function couleurOk(E, j, c) {
  const col = (carte(c.id) || {}).col;
  if (!col || col === 'neutre') return true;
  return E.j[j].ess.some(e => e.coul === col);
}

/* Les actions possibles, à ce moment du tour. C'est la liste que l'interface
   rend cliquable et parmi laquelle l'IA choisit. Phase d'action (`jeu`) :
   « Jouez autant de cartes Joueur, Objet, Moment que vous le voulez. Jouez
   une carte Coach. » Phase de Combat : les attaques seulement. */
function optionsTour(E) {
  const j = E.actif, P = E.j[j], out = [];
  if (E.phase === 'jeu') {
    const libres = P.lignes.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
    const permis = joueurPermis(E, j);
    for (const c of P.main) if (estCat(c, 'joueur') && permis) {
      for (const l of libres) out.push({ t: 'deployer', u: c.u, ligne: l });
      /* « Si aucune case n'est disponible, il peut une fois par tour, bench
         un Joueur non engagé pour pouvoir jouer cette carte. » */
      if (!libres.length && E.cpt.remplace < REGLE.REMPLACEMENTS) {
        P.lignes.forEach((x, l) => { if (x && !x.eng) out.push({ t: 'deployer', u: c.u, ligne: l, remplace: x.u }); });
      }
    }
    for (const o of P.main) if (estCat(o, 'objet') && couleurOk(E, j, o)) {
      for (const c of joueursDe(E, j)) out.push({ t: 'lier', u: o.u, cible: c.u });
    }
    for (const c of P.main) {
      const k = carte(c.id).cat;
      if (k !== 'coach' && k !== 'moment') continue;
      if (k === 'coach' && E.cpt.coachs >= REGLE.COACHS) continue;
      if (!couleurOk(E, j, c)) continue;
      const s = scr(c.id);
      if (!s.effet) continue;
      if (s.jouable && !s.jouable(ctxDe(E, j, c))) continue;
      out.push({ t: 'jouer', u: c.u });
    }
  }
  const attaques = optionsAttaque(E, j);
  out.push(...attaques);
  if (!(E.cpt.doitAttaquer > 0 && attaques.length)) out.push({ t: 'finTour' });
  return out;
}

const premierTourDuPremier = (E, j) => j === E.premier && E.j[j].tours === 1;

function peutAttaquer(E, c) {
  if (c.eng) return false;
  if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) return false;
  return true;
}

function optionsAttaque(E, j) {
  const out = [];
  if (premierTourDuPremier(E, j) || E.cpt.combatFini) return out;
  for (const c of joueursDe(E, j)) {
    if (!peutAttaquer(E, c)) continue;
    const atks = carte(c.id).atks;
    const chev = c.obj.some(o => scr(o.id).chevaliere);
    atks.forEach((a, k) => {
      const normal = payable(E, j, coutAttaque(E, c, k));
      const avecChev = chev && payable(E, j, coutAttaque(E, c, k, { chevaliere: true }));
      if (!normal && !avecChev) return;
      const variantes = [];
      if (normal) variantes.push(false);
      if (avecChev && !normal) variantes.push(true);
      else if (avecChev && totalCout(coutAttaque(E, c, k, { chevaliere: true })) < totalCout(coutAttaque(E, c, k))) variantes.push(true);
      /* Une attaque sans valeur imprimée (seulement un effet) est une attaque
         comme les autres : elle se déclare sur le CEO adverse, se défend, et
         touche si personne ne défend (règles officielles, « Déroulement de
         la Phase de Combat » ; sa valeur compte pour 0). */
      for (const chevaliere of variantes) {
        for (const cible of ciblesAttaque(E, c)) {
          out.push(Object.assign({ t: 'attaquer', u: c.u, k, cible }, chevaliere ? { chevaliere } : {}));
        }
      }
    });
  }
  return out;
}

/* Ce qu'une attaque vise : « Le CEO actif engage ce Joueur pour le déclarer
   comme attaquant sur le CEO adverse. » Deux exceptions, imprimées : le
   Joueur d'en face, s'il a Provocation (« L'attaquant face à ce Joueur doit
   le cibler ») ou s'il est Slay et désengagé, l'impose ; « Jus de bagarre »
   permet d'attaquer le Joueur adverse de sa ligne. */
function ciblesAttaque(E, c) {
  const A = E.j[adv(c.j)], l = ligneDe(E, c), face = A.lignes[l];
  if (face && (aMotCle(E, face, 'Provocation') || (scr(face.id).provocSiLibre && !face.eng))) return [face.u];
  const cs = ['ceo'];
  if (face && c.obj.some(o => scr(o.id).jusDeBagarre)) cs.push(face.u);
  return cs;
}

/* Le soutien : « si le CEO adverse déclare un défenseur, le CEO actif peut
   engager les Essence nécessaires à l'attaque d'un de ses Joueur adjacents,
   et engager le Joueur pour le déclarer comme soutien. S'il le fait on
   ajoute la valeur d'attaque du soutien à la valeur du Joueur attaquant. »
   Adjacent : la case voisine, de son côté du Terrain. Une attaque sans valeur
   n'ajoute rien : elle ne se propose pas. */
function soutiens(E, c) {
  const P = E.j[c.j], l = ligneDe(E, c), out = [];
  for (const i of [l - 1, l + 1]) {
    const s = P.lignes[i];
    if (!s || s.eng) continue;
    carte(s.id).atks.forEach((a, k) => {
      const val = valeurAttaque(E, s, k);
      if (val == null) return;
      const cout = coutAttaque(E, s, k, { rang: 0 });
      if (payable(E, c.j, cout)) out.push({ c: s, k, val, cout });
    });
  }
  return out;
}

/* Qui peut défendre : le Joueur désengagé de la ligne de l'attaquant, et
   tout Joueur désengagé qui a Garde. */
function defenseurs(E, c, cible) {
  const A = E.j[adv(c.j)], l = ligneDe(E, c);
  const pasFace = E.temp.some(t => t.type === 'pasDefenseFace' && t.cible === c.u);
  const out = [];
  A.lignes.forEach((x, i) => {
    if (!x || x.eng || x.u === cible) return;
    if (i === l) { if (!pasFace) out.push(x); }
    else if (aMotCle(E, x, 'Garde')) out.push(x);
  });
  return out;
}

/* ---------- Jouer des cartes ---------- */
function* deployer(E, j, c, ligne, o) {
  o = o || {};
  const P = E.j[j];
  if (ligne == null || P.lignes[ligne]) {
    ligne = P.lignes.findIndex(x => !x);
    if (ligne < 0) { P.main.push(c); return null; }
  }
  Object.assign(c, { j, eng: !!o.engage, obj: [], shieldUse: false, nAtt: 0 });
  P.lignes[ligne] = c;
  ev(E, { t: 'deploie', j, u: c.u, id: c.id, ligne, eng: c.eng });
  yield* declencher(E, 'deploie', { j, c });
  const s = scr(c.id);
  if (s.entree && !o.sansEntree && enJeu(E, c)) {
    ev(E, { t: 'entree', j, u: c.u, id: c.id });
    yield* s.entree(ctxDe(E, j, c));
  }
  return c;
}

/* « Il n'y a pas de limite au nombre de cartes Objet que l'on peut lier à un
   Joueur. » */
function* lier(E, j, o, cible, opts) {
  if (!cible || !enJeu(E, cible)) {
    E.j[o.j].defausse.push(o);
    return;
  }
  cible.obj.push(o);
  ev(E, { t: 'lie', j, u: o.u, id: o.id, cible: cible.u });
  if (!(opts && opts.sansDeclencheur)) yield* declencher(E, 'lier', { j, o, cible });
}

function* jouerInstant(E, j, u) {
  const P = E.j[j];
  const c = retirerMain(P, u);
  if (!c) return;
  if (estCat(c, 'coach')) E.cpt.coachs++;
  ev(E, { t: 'joue', j, u: c.u, id: c.id });
  yield* scr(c.id).effet(ctxDe(E, j, c));
  /* Un Instant joué va à la défausse — sauf s'il a déjà été déplacé. */
  if (!ou(E, c)) P.defausse.push(c);
}

/* Où est une carte ? null : nulle part (en train d'être jouée). */
function ou(E, c) {
  for (const P of E.j) {
    for (const z of ['club', 'main', 'pv', 'defausse']) if (P[z].includes(c)) return z;
    for (const x of P.lignes) if (x && (x === c || x.obj.includes(c))) return 'plateau';
  }
  return null;
}

/* ---------- L'attaque ---------- */
function* attaquer(E, j, c, k, cible, chevaliere) {
  const opp = adv(j);
  const atk = carte(c.id).atks[k];
  const rang = E.cpt.attaques + 1;

  /* Le coût. La Chevalière, liée à l'attaquant, peut le remplacer. */
  let cout = coutAttaque(E, c, k, { rang });
  if (chevaliere) {
    const o = c.obj.find(x => scr(x.id).chevaliere);
    if (o) {
      cout = coutAttaque(E, c, k, { rang, chevaliere: true });
      if (scr(o.id).chevaliere === 'defausse') defausserPlateau(E, o);
      else bancer(E, o);
    }
  }
  payer(E, j, cout);
  E.cpt.attaques = rang;
  if (rang === 1) E.cpt.premierAttaquant = c.u;
  if (E.cpt.doitAttaquer > 0) E.cpt.doitAttaquer--;
  c.nAtt = (c.nAtt || 0) + 1;

  /* L'attaquant s'engage (Worlds Lyon l'en dispense, une fois). */
  const lyon = E.temp.some(t => t.type === 'lyon' && t.camp === j) && c.obj.length > 0 && c.nAtt === 1;
  const X = { c, k, cible, rang, bonus: 0, annulee: false, vaincu: false, defenseur: null, j };
  ev(E, { t: 'attaque', j, u: c.u, k, nom: atk.nom, cible });
  if (!lyon) yield* engager(E, c);
  if (E.fin) return;

  yield* declencher(E, 'attaque', X);
  if (E.fin) return;

  {
    /* La cible a pu disparaître entre-temps. */
    if (X.cible !== 'ceo' && !enJeu(E, trouverSurPlateau(E, X.cible))) X.cible = 'ceo';

    /* « Le CEO adverse peut déclarer un Joueur sur la même ligne comme
       défenseur pour cette attaque en l'engageant. » */
    const defs = defenseurs(E, c, X.cible);
    if (defs.length && enJeu(E, c)) {
      const val = valeurAttaque(E, c, k, X.bonus) || 0;
      const opts = defs.map(d => ({
        v: d.u, u: d.u, label: `Défendre avec ${nomDe(d)}`,
        info: { def: defense(E, d), val, vaincu: val >= defense(E, d) && !shieldActif(E, d) }
      }));
      opts.push({ v: 'non', label: X.cible === 'ceo' ? 'Ne pas défendre' : 'Laisser passer' });
      const choix = yield {
        qui: opp, type: 'choix', but: 'defense', titre: `${nomDe(c)} attaque`,
        texte: X.cible === 'ceo' ? `${atk.nom} · ${val} — vise ton CEO` : `${atk.nom} · ${val} — vise ${nomDe(trouverSurPlateau(E, X.cible))}`,
        attaquant: c.u, cible: X.cible, options: opts
      };
      if (choix.v !== 'non') {
        const d = trouverSurPlateau(E, choix.v);
        X.defenseur = d;
        X.cible = d.u;
        ev(E, { t: 'defend', j: opp, u: d.u, attaquant: c.u });
        yield* engager(E, d);
        yield* declencher(E, 'defense', X);
        if (E.fin) return;
        /* Le soutien (soutiens, plus haut) : choisi par l'attaquant, une
           fois le défenseur connu. */
        const sout = enJeu(E, c) && !X.annulee && enJeu(E, d) ? soutiens(E, c) : [];
        if (sout.length) {
          const def = defense(E, d), base = valeurAttaque(E, c, k, X.bonus) || 0;
          const opts2 = sout.map(z => ({
            v: z.c.u + ':' + z.k, u: z.c.u, k: z.k, label: `Soutien de ${nomDe(z.c)} · +${z.val}`, cout: z.cout,
            info: { val: z.val, total: base + z.val, def, vaincu: base + z.val >= def && !shieldActif(E, d) }
          }));
          opts2.push({ v: 'non', label: 'Pas de soutien' });
          const r = yield {
            qui: j, type: 'choix', but: 'soutien', titre: `${nomDe(d)} défend`,
            texte: `Défense ${def}, ton attaque ${base}. Un Joueur voisin peut engager son attaque en soutien : sa valeur s'ajoute.`,
            attaquant: c.u, defenseur: d.u, options: opts2
          };
          if (r.v !== 'non') {
            const z = sout.find(x => x.c.u + ':' + x.k === r.v);
            payer(E, j, z.cout);
            X.soutien = z.c;
            X.soutienK = z.k;
            ev(E, { t: 'soutien', j, u: z.c.u, k: z.k, val: z.val, attaquant: c.u });
            yield* engager(E, z.c);
            if (E.fin) return;
          }
        }
      }
    }
    if (!X.annulee && enJeu(E, c)) yield* resoudre(E, X);
    else if (!X.annulee) ev(E, { t: 'attaquePerdue', u: c.u });
  }
  if (E.fin) return;

  /* L'effet imprimé sous l'attaque. */
  if (!X.annulee) {
    const s = scr(c.id);
    if (s.attaques && s.attaques[k]) yield* s.attaques[k](ctxDe(E, j, c, { X }));
  }
  if (E.fin) return;
  yield* declencher(E, 'finAttaque', X);
}

/* « On compare la valeur d'attaque du Joueur attaquant et la valeur de
   défense du Joueur défenseur, et si la valeur d'attaque est supérieure ou
   égale à la valeur de défense, le Joueur défenseur est vaincu et bench
   (envoyé à la défausse). […] S'il ne déclare pas de défenseur, l'attaque
   touche directement le CEO adverse. » Le soutien s'ajoute à l'attaque. */
function* resoudre(E, X) {
  const c = X.c, opp = adv(c.j);
  const sv = X.soutien && enJeu(E, X.soutien) ? (valeurAttaque(E, X.soutien, X.soutienK) || 0) : 0;
  const val = (valeurAttaque(E, c, X.k, X.bonus) || 0) + sv;
  if (X.cible === 'ceo') {
    ev(E, { t: 'impact', u: c.u, cible: 'ceo', val });
    yield* toucher(E, opp, c);
    return;
  }
  const t = trouverSurPlateau(E, X.cible);
  if (!t || !enJeu(E, t)) return;
  if (shieldActif(E, t)) {
    userShield(E, t);
    ev(E, { t: 'shield', u: t.u, par: c.u, val });
    return;
  }
  const def = defense(E, t);
  ev(E, { t: 'impact', u: c.u, cible: t.u, val, def, soutien: X.soutien ? X.soutien.u : null });
  if (val >= def) {
    /* Vaincu seulement si « Invitation » ne l'a pas sauvé (vaincre() rend
       false) : Target Missed (c055) lit X.vaincu à la fin de l'attaque. */
    X.vaincu = (yield* vaincre(E, t, c)) !== false;
  } else {
    ev(E, { t: 'repousse', u: t.u, par: c.u, val, def });
  }
}

/* Le CEO est touché : il récupère son premier PV. Sans PV, il a perdu. */
function* toucher(E, j, par) {
  const P = E.j[j];
  ev(E, { t: 'touche', j, par: par ? par.u : null });
  if (!P.pv.length) {
    finir(E, adv(j), 'pv');
    return;
  }
  const c = P.pv.shift();
  /* L'Arme Nucléaire, seule sur le plateau : le PV part à la défausse. */
  if (par && joueursDe(E, par.j).length === 1 && scr(par.id).nucleaire && enJeu(E, par)) {
    P.defausse.push(c);
    ev(E, { t: 'pvDefausse', j, u: c.u, id: c.id });
    return;
  }
  E.cpt.pvRecup[j]++;
  ev(E, { t: 'pvRecup', j, u: c.u, id: c.id });
  let utilisee = false;
  const s = scr(c.id), k = carte(c.id);
  if (k && k.res && s.resilience) {
    const x = ctxDe(E, j, c);
    if (!s.resPossible || s.resPossible(x)) {
      const ok = yield* ouiNon(E, j, `Résilience — ${k.nom}`,
        { oui: 'Jouer la Résilience', non: 'Garder en main', texte: k.res, carte: c.id, but: 'resilience' });
      if (ok) {
        utilisee = true;
        ev(E, { t: 'resilience', j, u: c.u, id: c.id });
        yield* s.resilience(x);
        if (!ou(E, c)) P.defausse.push(c);
      }
    }
  }
  if (!utilisee) P.main.push(c);
  yield* declencher(E, 'recupPV', { j, par });
}

/* Un Joueur vaincu quitte le plateau ; ses Objets vont à la défausse. */
function* vaincre(E, t, par) {
  const j = t.j, P = E.j[j];
  /* « Invitation » : l'Objet est bench (à la défausse) à la place du Joueur. */
  const inv = t.obj.find(o => scr(o.id).invitation);
  if (inv) {
    bancer(E, inv);
    ev(E, { t: 'sauve', u: t.u, par: inv.u, id: inv.id });
    return false;
  }
  /* Ce qu'il faut savoir de lui avant qu'il parte. */
  const riposte = aMotCle(E, t, 'Riposte');
  const legion = aMotCle(E, t, 'Légion');
  const valeurs = carte(t.id).atks.map((a, k) => valeurAttaque(E, t, k));
  const ligne = ligneDe(E, t);
  P.lignes[ligne] = null;
  /* « Les Objet sont bench lorsque la carte Joueur associée quitte le
     Terrain. » */
  for (const o of t.obj) { E.j[o.j].defausse.push(o); E.j[o.j].bench.push(o.u); }
  const objets = t.obj.map(o => o.u);
  t.obj = [];
  t.eng = false;
  ev(E, { t: 'vaincu', j, u: t.u, id: t.id, ligne, par: par ? par.u : null, objets });

  /* Riposte : une de ses attaques, pour un coût diminué de 1, sur l'attaquant. */
  if (riposte && par && enJeu(E, par)) yield* riposter(E, t, valeurs, par);
  if (E.fin) return true;

  /* Légion : défausser une carte pour le reprendre en main. */
  let enMain = false;
  if (legion) {
    if (scr(t.id).legionGratuite) enMain = true;
    else if (P.main.length) {
      const ok = yield* ouiNon(E, j, `Légion — ${nomDe(t)}`,
        { oui: 'Défausser une carte', non: 'Non', texte: 'Défausse une carte pour reprendre ce Joueur en main.', carte: t.id, but: 'legion' });
      if (ok) {
        const [u] = yield* choisirCartes(E, j, 'Quelle carte défausser ?', P.main.map(x => x.u), 1, 1, { but: 'defausse', zone: 'main' });
        defausserMain(E, j, [u]);
        enMain = true;
      }
    }
  }
  if (enMain) { P.main.push(t); ev(E, { t: 'legion', j, u: t.u, id: t.id }); }
  else P.defausse.push(t);

  if (par && enJeu(E, par)) yield* declencher(E, 'vainc', { par, t });
  return true;
}

function* riposter(E, t, valeurs, par) {
  const j = t.j;
  let moins = 1;
  for (const x of E.temp) if (x.type === 'ripostePlus' && x.camp === j && !x.utilise) moins += x.n;
  const opts = [];
  carte(t.id).atks.forEach((a, k) => {
    if (valeurs[k] == null) return;
    const cout = reduireUn(a.cout, moins);
    if (payable(E, j, cout)) opts.push({ v: k, label: `${a.nom} · ${valeurs[k]}`, cout, info: { val: valeurs[k], def: defense(E, par) } });
  });
  if (!opts.length) return;
  opts.push({ v: 'non', label: 'Pas de Riposte' });
  const r = yield { qui: j, type: 'choix', but: 'riposte', titre: `Riposte — ${nomDe(t)}`,
    texte: `Une attaque contre ${nomDe(par)} (Défense ${defense(E, par)}).`, carte: t.id, options: opts };
  if (r.v === 'non') return;
  const o = opts.find(x => x.v === r.v);
  E.temp.forEach(x => { if (x.type === 'ripostePlus' && x.camp === j) x.utilise = true; });
  payer(E, j, o.cout);
  const val = valeurs[r.v];
  ev(E, { t: 'riposte', j, id: t.id, k: r.v, cible: par.u, val });
  if (shieldActif(E, par)) { userShield(E, par); ev(E, { t: 'shield', u: par.u, val }); return; }
  const def = defense(E, par);
  ev(E, { t: 'impact', u: t.u, cible: par.u, val, def, riposte: true });
  if (val >= def) yield* vaincre(E, par, null);
  else ev(E, { t: 'repousse', u: par.u, val, def });
}

/* ---------- Les gestes de base ---------- */
function piocher(E, j, n) {
  const P = E.j[j];
  /* One More : chaque pioche de ce tour en apporte une de plus. */
  if (E.actif === j && E.temp.some(t => t.type === 'piochePlus' && t.camp === j)) n += 1;
  const pris = P.club.splice(0, n);
  P.main.push(...pris);
  if (pris.length) ev(E, { t: 'pioche', j, u: pris.map(c => c.u), n: pris.length });
  /* « Votre adversaire doit piocher dans son Club mais est dans l'incapacité
     de le faire » : c'est une condition de victoire pour l'autre CEO. */
  if (pris.length < n) {
    ev(E, { t: 'clubVide', j });
    finir(E, adv(j), 'club');
  }
  return pris;
}

function jouerReserve(E, j, engagee) {
  const P = E.j[j];
  if (!P.reserve.length) return null;
  const e = P.reserve.shift();
  e.eng = !!engagee;
  P.ess.push(e);
  ev(E, { t: 'essence', j, u: e.u, coul: e.coul, eng: e.eng });
  return e;
}

function* engager(E, c) {
  if (!c || c.eng || !enJeu(E, c)) return;
  c.eng = true;
  ev(E, { t: 'engage', u: c.u });
  yield* declencher(E, 'engage', { c });
}

function* desengager(E, c) {
  if (!c || !c.eng || !enJeu(E, c)) return;
  c.eng = false;
  ev(E, { t: 'desengage', u: c.u });
  yield* declencher(E, 'desengage', { c });
}

function* desengagerEssence(E, e) {
  if (!e || !e.eng) return;
  e.eng = false;
  ev(E, { t: 'essDesengage', j: e.j, u: e.u });
  yield* declencher(E, 'desengageEss', { e, j: e.j });
}

function engagerEssence(E, e) {
  if (!e || e.eng) return;
  e.eng = true;
  ev(E, { t: 'essEngage', j: e.j, u: e.u });
}

function retirerObjet(E, porteur, o) {
  const i = porteur.obj.indexOf(o);
  if (i >= 0) porteur.obj.splice(i, 1);
}

/* Retirer un Joueur du plateau, pour une autre raison que la défaite. Ses
   Objets, rendus à l'appelant, sont bench (« Les Objet sont bench lorsque
   la carte Joueur associée quitte le Terrain ») : benchObjets(). */
function quitterPlateau(E, c) {
  const P = E.j[c.j];
  const l = ligneDe(E, c);
  if (l >= 0) P.lignes[l] = null;
  const objets = c.obj || [];
  c.obj = [];
  c.eng = false;
  return objets;
}

/* Les Objets d'un Joueur qui quitte le Terrain : bench, donc à la défausse. */
function benchObjets(E, objets) {
  for (const o of objets) { E.j[o.j].defausse.push(o); E.j[o.j].bench.push(o.u); }
}

/* « Bench » : « Le terme Bench signifie qu'une carte déployée est envoyée à
   la défausse. » Un Joueur bench emporte ses Objets avec lui. Ce n'est pas
   être vaincu : ni Riposte, ni Légion (« Lorsqu'il est vaincu »). */
function bancer(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].defausse.push(x);
    E.j[x.j].bench.push(x.u);
    ev(E, { t: 'banc', j: x.j, u: x.u, id: x.id, de: porteur.u });
    return;
  }
  if (enJeu(E, x)) {
    const ligne = ligneDe(E, x);
    const objets = quitterPlateau(E, x);
    E.j[x.j].defausse.push(x);
    E.j[x.j].bench.push(x.u);
    benchObjets(E, objets);
    ev(E, { t: 'banc', j: x.j, u: x.u, id: x.id, ligne, objets: objets.map(o => o.u) });
  }
}

/* Renvoyer en main : un Joueur (ses Objets sont bench), ou un Objet seul. */
function renvoyerMain(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].main.push(x);
    ev(E, { t: 'enMain', j: x.j, u: x.u, id: x.id, de: porteur.u });
    return;
  }
  if (enJeu(E, x)) {
    const ligne = ligneDe(E, x);
    const objets = quitterPlateau(E, x);
    E.j[x.j].main.push(x);
    benchObjets(E, objets);
    ev(E, { t: 'enMain', j: x.j, u: x.u, id: x.id, ligne, objets: objets.map(o => o.u), benchObjets: true });
  }
}

function defausserPlateau(E, x) {
  const porteur = porteurDe(E, x);
  if (porteur) {
    retirerObjet(E, porteur, x);
    E.j[x.j].defausse.push(x);
    ev(E, { t: 'defausseObjet', j: x.j, u: x.u, id: x.id, de: porteur.u });
  }
}

function defausserMain(E, j, us) {
  const P = E.j[j];
  for (const u of us) {
    const c = retirerMain(P, u);
    if (c) { P.defausse.push(c); ev(E, { t: 'defausse', j, u: c.u, id: c.id }); }
  }
}

/* « Mélangez une Essence Mauve dans votre Réserve » : on rend d'abord les
   Essences engagées, celles qui ne servent plus ce tour. */
function rendreEssences(E, j, coul, n) {
  const P = E.j[j];
  const cands = P.ess.filter(e => !coul || e.coul === coul).sort((a, b) => (b.eng ? 1 : 0) - (a.eng ? 1 : 0));
  const pris = cands.slice(0, n);
  for (const e of pris) {
    P.ess.splice(P.ess.indexOf(e), 1);
    e.eng = false;
    P.reserve.push(e);
  }
  if (pris.length) {
    melanger(E, P.reserve);
    ev(E, { t: 'essRendue', j, u: pris.map(e => e.u), coul });
  }
  return pris.length;
}

/* ---------- Les déclencheurs ---------- */
/* Les Joueurs du CEO actif d'abord, puis ceux de l'autre ; pour chacun, le
   Joueur puis ses Objets ; enfin les effets « jusqu'à la fin du tour » qui
   guettent quelque chose (Trauma Dump I…). */
function* declencher(E, quand, data) {
  const ordre = [E.actif, adv(E.actif)];
  const sources = [];
  for (const j of ordre) for (const c of E.j[j].lignes) {
    if (!c) continue;
    if (scr(c.id).sur && scr(c.id).sur[quand]) sources.push({ c, porteur: null });
    for (const o of c.obj) if (scr(o.id).sur && scr(o.id).sur[quand]) sources.push({ c: o, porteur: c });
  }
  for (const s of sources) {
    if (E.fin) return;
    /* Toujours là ? Un effet précédent a pu l'emporter. */
    if (s.porteur ? !(enJeu(E, s.porteur) && s.porteur.obj.includes(s.c)) : !enJeu(E, s.c)) continue;
    yield* scr(s.c.id).sur[quand](ctxDe(E, s.c.j, s.c, { porteur: s.porteur }), data);
  }
  const guetteurs = E.temp.filter(t => t.type === 'guet' && t.quand === quand && !t.fini);
  for (const t of guetteurs) {
    if (E.fin) return;
    const h = SCRIPTS[t.src] && SCRIPTS[t.src].guets && SCRIPTS[t.src].guets[t.nom];
    if (h) yield* h(ctxDe(E, t.camp, null, { guet: t }), data);
  }
}

/* ---------- Les décisions ---------- */
function* ouiNon(E, j, titre, o) {
  o = o || {};
  const r = yield {
    qui: j, type: 'choix', titre, texte: o.texte || '', carte: o.carte || null, but: o.but || 'ouiNon',
    options: [{ v: 'oui', label: o.oui || 'Oui' }, { v: 'non', label: o.non || 'Non' }]
  };
  return r.v === 'oui';
}

/* Choisir une carte parmi des instances (sur le plateau, en main, révélées). */
function* choisirUn(E, j, titre, cands, o) {
  o = o || {};
  if (!cands.length) return null;
  const options = cands.map(c => ({ v: c.u, u: c.u, id: c.id, coul: c.coul, label: c.id ? nomDe(c) : 'Essence ' + c.coul }));
  if (o.optionnel) options.push({ v: 'non', label: o.passer || 'Passer' });
  const r = yield { qui: j, type: 'choix', titre, texte: o.texte || '', but: o.but || 'cible', zone: o.zone || 'plateau', options,
    cartes: o.montrer ? o.montrer.map(c => ({ u: c.u, id: c.id })) : null };
  if (r.v === 'non') return null;
  return cands.find(c => c.u === r.v) || null;
}

function* choisirCartes(E, j, titre, us, min, max, o) {
  o = o || {};
  max = Math.min(max, us.length);
  min = Math.min(min, max);
  if (max <= 0) return [];
  const r = yield { qui: j, type: 'cartes', titre, texte: o.texte || '', but: o.but || 'choix', zone: o.zone || 'main', parmi: us.slice(), min, max,
    cartes: o.cartes || null };
  return r.u;
}

function* ordonner(E, j, titre, cartes, o) {
  o = o || {};
  if (cartes.length < 2) return cartes;
  const r = yield { qui: j, type: 'ordre', titre, texte: o.texte || '', parmi: cartes.map(c => c.u), cartes: cartes.map(c => ({ u: c.u, id: c.id })) };
  return r.u.map(u => cartes.find(c => c.u === u));
}

/* ---------- Le contexte d'un effet ---------- */
/* Ce que reçoit un effet de carte : la partie, le CEO qui le joue, la carte
   elle-même — et, pour un Objet, le Joueur qui le porte. */
function ctxDe(E, j, c, extra) {
  return Object.assign({ E, j, c, P: E.j[j], A: E.j[adv(j)] }, extra || {});
}

/* ---------- Avancer, agir ---------- */
function avancer(E, v) {
  let r = E.gen.next(v);
  if (r.done) { E.dem = null; return; }
  E.dem = r.value;
}

/* La demande en cours : à qui, quoi. */
const demande = E => (E.fin ? null : E.dem);

function options(E) {
  const d = demande(E);
  if (!d) return [];
  if (d.type === 'tour') return optionsTour(E);
  if (d.type === 'choix') return d.options.map(o => ({ t: 'choix', v: o.v }));
  return [];
}

const cle = a => JSON.stringify(a, Object.keys(a).sort());

function valider(E, a) {
  const d = demande(E);
  if (!d) throw new Error('La partie est finie.');
  if (d.type === 'tour') {
    const ok = optionsTour(E).some(o => cle(o) === cle(a));
    if (!ok) throw new Error('Action impossible.');
  } else if (d.type === 'choix') {
    if (a.t !== 'choix' || !d.options.some(o => o.v === a.v)) throw new Error('Choix impossible.');
  } else if (d.type === 'cartes') {
    if (a.t !== 'cartes' || !Array.isArray(a.u)) throw new Error('Choix impossible.');
    const set = new Set(a.u);
    if (set.size !== a.u.length || a.u.length < d.min || a.u.length > d.max || a.u.some(u => !d.parmi.includes(u))) throw new Error('Choix impossible.');
  } else if (d.type === 'ordre') {
    if (a.t !== 'ordre' || !Array.isArray(a.u) || a.u.length !== d.parmi.length || d.parmi.some(u => !a.u.includes(u))) throw new Error('Ordre impossible.');
  }
}

/* Jouer une action. Rend les événements qu'elle a produits. `qui` : celui
   qui agit — seul l'abandon peut venir de l'autre. */
function agir(E, a, o) {
  const n0 = E.ev.length;
  if (a.t === 'abandon') {
    if (!E.fin) {
      E.journal.push(a);
      if (E.snap) E.snap.actions.push(a);
      finir(E, adv(a.qui), 'abandon');
      E.dem = null;
    }
    return E.ev.slice(n0);
  }
  if (!(o && o.confiance)) valider(E, a);
  E.journal.push(a);
  if (E.snap) E.snap.actions.push(a);
  avancer(E, a);
  return E.ev.slice(n0);
}

/* ---------- Photographie, copie, reprise ---------- */
function photographier(E) {
  E.snap = { etat: JSON.stringify(E), actions: [] };
}

/* Une copie de la partie, au même point. Elle repart de la photo du début
   du tour et rejoue les actions du tour. */
function cloner(E) {
  if (!E.snap) return rejouer(E.init, E.journal);
  const C = JSON.parse(E.snap.etat);
  cacher(C, 'init', E.init);
  cacher(C, 'ev', []);
  cacher(C, 'journal', E.journal.slice(0, E.journal.length - E.snap.actions.length));
  cacher(C, 'snap', null);
  cacher(C, 'dem', null);
  cacher(C, 'gen', null);
  cacher(C, 'capture', false);
  C.gen = partie(C, true);
  avancer(C);
  for (const a of E.snap.actions) agirConfiance(C, a);
  return C;
}

function agirConfiance(E, a) {
  if (a.t === 'abandon') return agir(E, a);
  E.journal.push(a);
  if (E.snap) E.snap.actions.push(a);
  avancer(E, a);
}

/* Toute la partie, depuis le début : pour reprendre une partie après un
   rechargement, ou suivre celle d'un ami. */
function rejouer(init, journal) {
  const E = creer(init);
  for (const a of journal) agirConfiance(E, a);
  return E;
}

/* ---------- Pour l'interface ---------- */
/* Le résumé d'une attaque : coût, valeur, payable. */
function infoAttaque(E, c, k) {
  const a = carte(c.id).atks[k];
  const cout = coutAttaque(E, c, k);
  return {
    nom: a.nom, cout, val: valeurAttaque(E, c, k), base: a.degats, effet: a.effet,
    payable: payable(E, c.j, cout), plus: a.plus
  };
}

const MODS_VISIBLES = ['def', 'atk', 'kw', 'pasAttaque', 'pasDefenseFace', 'pasJoueur', 'doublePremiere'];

const Combat = {
  REGLE, COULEURS, catalogue, scripts, carte, toutes, baseId, scr,
  creer, agir, demande, options, optionsTour, cloner, rejouer, valider, cle,
  defense, valeurAttaque, coutAttaque, payable, totalCout, aMotCle, shieldActif,
  ciblesAttaque, defenseurs, soutiens, couleurOk, peutAttaquer, infoAttaque, motCleImprime, nomDe,
  joueursDe, tousJoueurs, joueurPermis, ligneDe, enJeu, trouverSurPlateau, porteurDe, premierTourDuPremier,
  /* Les outils des effets (js/combat/effets.js) */
  O: {
    adv, joueursDe, tousJoueurs, joueurPermis, ligneDe, enJeu, nomDe, estCat, carte, baseId, scr, alea, melanger,
    piocher, jouerReserve, engager, desengager, desengagerEssence, engagerEssence, bancer, renvoyerMain,
    defausserMain, defausserPlateau, rendreEssences, deployer, lier, vaincre, toucher, payable, payer,
    ouiNon, choisirUn, choisirCartes, ordonner, ev, aMotCle, motCleImprime, defense, ou, retirerMain,
    porteurDe, trouverSurPlateau, essencesLibres, quitterPlateau, valeurAttaque, retirerObjet, sansAccent,
    shieldActif, couleurOk, benchObjets, REGLE,
    /* Un effet « jusqu'à la fin du tour » (par défaut) ou plus long. Ceux
       qui se voient sur une carte (Défense, attaques, mot-clé, interdiction)
       le disent aussi par un événement, pour que l'arène les montre ; les
       autres (un piège posé, un coût réduit) restent silencieux — un piège
       annoncé ne serait plus un piège. */
    mod: (E, t) => {
      E.temp.push(Object.assign({ jusqua: E.tour }, t));
      if (MODS_VISIBLES.includes(t.type)) ev(E, { t: 'mod', type: t.type, cible: t.cible, camp: t.camp, val: t.val, kw: t.kw });
      return t;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Combat;
racine.Combat = Combat;

})(typeof globalThis !== 'undefined' ? globalThis : this);
