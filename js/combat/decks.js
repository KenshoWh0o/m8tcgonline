/* Les decks (version 3.0) : comment on les construit, les deux Starter Decks
   des Sections, et les decks que l'IA reçoit.

   Un deck enregistré : { id, nom, cartes: { id: nombre }, reserve: { couleur:
   nombre }, couverture: id }. Le moteur, lui, veut deux listes à plat : c'est
   versMoteur() qui les déplie.

   Les règles de construction sont les règles officielles (« Construire son
   jeu ») : un Club de 40 cartes (REGLE.CLUB), pas plus de trois exemplaires
   d'une même carte — « une carte possédant le même nom et la même couleur,
   quand bien même son texte ou son art est différent » —, et une Réserve de
   10 Essences (REGLE.RESERVE) de la couleur qu'on veut : les Essences ne se
   possèdent pas, elles se choisissent. */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const R = Combat.REGLE;

const TYPES = ['joueur', 'coach', 'moment', 'objet'];

/* Une « même carte » : le même nom et la même couleur (une Reverse, une
   Promo à l'illustration différente, deux cartes de même nom comme les deux
   Leakof). Le serveur a la même clé (cle_copie, 23_combats.sql). */
function cleCopie(id) {
  const c = Combat.carte(id);
  return c ? Combat.O.sansAccent(c.nom) + '|' + c.col : id;
}
/* Trois exemplaires, quelle que soit la rareté (limite_copies). */
function limite(id) {
  return Combat.carte(id) ? R.COPIES : 0;
}
/* Peut entrer dans un Club : un Joueur, un Coach, un Moment, un Objet — et
   pas une Secrète encore floutée (elle n'a pas de texte). */
const jouable = c => !!c && TYPES.includes(c.cat) && !c.cachee;

const total = o => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);

/* Ce qui ne va pas dans un deck. `possede` : ce que le joueur a (id →
   exemplaires) ; absent, on ne le vérifie pas (Starter Decks prêtés). */
function verifier(deck, possede) {
  const err = [];
  const cartes = deck.cartes || {};
  const n = total(cartes);
  if (n !== R.CLUB) err.push(n < R.CLUB ? `Il manque ${R.CLUB - n} carte${R.CLUB - n > 1 ? 's' : ''} au Club.` : `Le Club a ${n - R.CLUB} carte${n - R.CLUB > 1 ? 's' : ''} de trop.`);
  const parCle = {}, nomDe = {};
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!q) continue;
    if (!jouable(c)) { err.push(`« ${c ? c.nom : id} » ne se joue pas en combat.`); continue; }
    const k = cleCopie(id);
    parCle[k] = (parCle[k] || 0) + q;
    nomDe[k] = c.nom;
    if (possede && (possede[id] || 0) < q) err.push(`Tu n'as que ${possede[id] || 0} « ${c.nom} »${c.rev ? ' Reverse' : ''}.`);
  }
  for (const k in parCle) {
    if (parCle[k] > R.COPIES) err.push(`« ${nomDe[k]} » : ${R.COPIES} exemplaires au plus, toutes versions comprises.`);
  }
  const r = deck.reserve || {};
  const nr = total(r);
  if (Object.keys(r).some(k => r[k] && !Combat.COULEURS.includes(k))) err.push('Couleur d\'Essence inconnue.');
  if (nr !== R.RESERVE) err.push(`La Réserve doit compter ${R.RESERVE} Essences (${nr}).`);
  return err;
}

function versMoteur(deck) {
  const club = [], reserve = [];
  for (const id in deck.cartes) for (let i = 0; i < deck.cartes[id]; i++) club.push(id);
  for (const k in deck.reserve) for (let i = 0; i < deck.reserve[k]; i++) reserve.push(k);
  return { club, reserve };
}

/* Les couleurs dont un Club a besoin : les symboles de couleur de ses
   attaques, comptés. */
function besoins(cartes) {
  const b = {};
  for (const id in cartes) {
    const c = Combat.carte(id);
    if (!c || c.cat !== 'joueur') continue;
    for (const a of c.atks) for (const k in a.cout) if (k !== 'neutre') b[k] = (b[k] || 0) + a.cout[k] * cartes[id];
    if (cleCopie(id) === 'c049') b.jaune = (b.jaune || 0) + 6 * cartes[id];
  }
  return b;
}

/* Une Réserve qui suit les besoins du Club, au prorata. */
function reserveAuto(cartes, defaut) {
  const b = besoins(cartes);
  const ks = Object.keys(b);
  if (!ks.length) return { [defaut || 'rose']: R.RESERVE };
  const t = ks.reduce((s, k) => s + b[k], 0);
  const r = {};
  let reste = R.RESERVE;
  ks.sort((x, y) => b[y] - b[x]).forEach((k, i) => {
    const n = i === ks.length - 1 ? reste : Math.max(1, Math.round(R.RESERVE * b[k] / t));
    r[k] = Math.min(n, reste);
    reste -= r[k];
  });
  for (const k in r) if (!r[k]) delete r[k];
  if (reste > 0) r[ks[0]] += reste;
  return r;
}

/* ---------- Les Starter Decks ---------- */
/* M8 vend deux Starter Decks : Section Toxique et Section Déter. Ceux d'ici
   sont reconstitués (leur liste réelle n'est pas connue) : la Section
   Toxique joue Rose — engager l'adversaire, des Joueurs qui frappent tôt —,
   la Section Déter joue Mauve — des Joueurs qui reviennent, des coups
   lourds. 40 cartes chacun, en suivant les conseils des règles officielles :
   au moins 15 Joueurs (18 ici), une couleur dans la Réserve, des attaques à
   une ou deux Essences. Chacun contient sa Promo. Ils sont prêtés : on peut
   les jouer sans en posséder les cartes.
   Mesuré le 31 octobre (3.0.12, IA niveau 3 des deux côtés, places
   alternées, 240 parties, graines 2000 + i) : contre des decks tirés au sort
   (Decks.aleatoire, niveau 3), le Toxique gagne 66 %, le Déter 48 % ; face
   à face, **le Toxique 69 %** (165 sur 240 ; 274 sur 400). Le Toxique
   engage les Joueurs adverses, qui ne peuvent alors plus défendre : avec
   les règles officielles, ses attaques passent sur le CEO. Ce déséquilibre
   est connu et ouvert (feuille de route, § 4) : les chiffres d'abord écrits
   ici (64 %, 58 %, 61 %) ne se retrouvent pas sur le même code, et aucune
   des variantes essayées ne le corrige — onze par la première passe (trois
   Fée Rosalie au lieu d'une, des Épiques, Cooked, Doig'Dance, un Toxique
   sans un Squeezie ni un Vandale…), quatre le 31 (un Déter à la courbe plus
   basse : 69 % ; un Toxique sans Tout Commence Ici : 70 % ; les deux :
   72 %). Version 3.0.13 : chacun a la vraie Promo de sa Section — P04
   (Squeezie le Toxique) prend une place de Squeezie, la place libérée va à
   un troisième Vandale ; P03 (Brawks Déter) remplace la Promo provisoire du
   Déter. Mêmes mesures, mêmes graines : le Toxique 68,8 % puis 69,2 % sur
   240 parties, 68,5 % avant comme après sur 400 (274). */
const STARTERS = {
  toxique: {
    id: 'starter-toxique', nom: 'Starter · Section Toxique', starter: true, couverture: 'c012',
    cartes: {
      p04: 1, c010: 3, c011: 3, c012: 2, c013: 2, c017: 1, c073: 2, c078: 2, c079: 1, c074: 1,
      c015: 3, c085: 2, c087: 2, c088: 1,
      c014: 2, c016: 2, c083: 2, c104: 1, c096: 2, c097: 2, c020: 1, c091: 1, c092: 1
    },
    reserve: { rose: 10 }
  },
  deter: {
    id: 'starter-deter', nom: 'Starter · Section Déter', starter: true, couverture: 'c077',
    cartes: {
      p03: 1, c051: 3, c052: 3, c050: 3, c077: 2, c074: 1, c076: 1, c080: 2, c081: 1, c059: 1,
      c053: 3, c087: 2, c088: 2, c056: 1,
      c054: 2, c055: 2, c083: 2, c082: 2, c092: 2, c093: 1, c072: 1, c094: 1, c095: 1
    },
    reserve: { mauve: 10 }
  }
};

/* ---------- Les decks de l'IA ---------- */
/* Un deck tiré au sort dans une ou deux couleurs, plus le Neutre. Le niveau
   (1 à 5) pèse sur les raretés : un adversaire facile joue des Communes, un
   adversaire Légende des Épiques et des Légendaires. */
const POIDS = {
  1: { C: 6, PC: 4, R: 1, E: 0.3, L: 0.1, S: 0, PR: 0.2 },
  2: { C: 4, PC: 4, R: 2, E: 0.8, L: 0.3, S: 0.1, PR: 0.3 },
  3: { C: 3, PC: 3, R: 3, E: 2, L: 0.8, S: 0.3, PR: 0.5 },
  4: { C: 2, PC: 3, R: 3, E: 3, L: 2, S: 0.8, PR: 0.8 },
  5: { C: 1, PC: 2, R: 3, E: 4, L: 4, S: 1.5, PR: 1 }
};
/* 40 cartes, en suivant les conseils des règles officielles (« un minimum
   de 15 Joueur ») : 18 Joueurs, 8 Objets, 14 Coachs et Moments. */
const CIBLES = { joueur: 18, objet: 8, instant: 14 };

function aleatoire(rand, o) {
  o = o || {};
  const niveau = Math.max(1, Math.min(5, o.niveau || 3));
  const couleurs = o.couleurs || tirerCouleurs(rand);
  const pool = Combat.toutes().filter(c => jouable(c) && !c.rev && !c.provisoire && !c.unique
    && (c.col === 'neutre' || couleurs.includes(c.col)) && !(o.exclure || []).includes(c.id));
  const cartes = {};
  const parCle = {};
  const ajouter = c => { cartes[c.id] = (cartes[c.id] || 0) + 1; parCle[cleCopie(c.id)] = (parCle[cleCopie(c.id)] || 0) + 1; };
  const place = c => (parCle[cleCopie(c.id)] || 0) < limite(c.id);
  const poids = c => {
    let w = (POIDS[niveau][c.rar] || 0.5);
    /* Les cartes de la couleur pèsent plus que les Neutres. */
    if (c.col !== 'neutre') w *= 1.6;
    return w;
  };
  const famille = c => (c.cat === 'joueur' ? 'joueur' : c.cat === 'objet' ? 'objet' : 'instant');
  for (const fam of ['joueur', 'objet', 'instant']) {
    let besoin = CIBLES[fam];
    const cands = pool.filter(c => famille(c) === fam);
    let garde = 0;
    while (besoin > 0 && garde++ < 400) {
      const dispo = cands.filter(place);
      if (!dispo.length) break;
      const tot = dispo.reduce((s, c) => s + poids(c), 0);
      let r = rand() * tot;
      let pick = dispo[dispo.length - 1];
      for (const c of dispo) { r -= poids(c); if (r <= 0) { pick = c; break; } }
      ajouter(pick);
      besoin--;
    }
  }
  /* Compléter avec n'importe quoi de jouable, si une couleur est trop
     courte. */
  let garde = 0;
  while (total(cartes) < R.CLUB && garde++ < 400) {
    const dispo = pool.filter(place);
    if (!dispo.length) break;
    ajouter(dispo[Math.floor(rand() * dispo.length)]);
  }
  const reserve = reserveAuto(cartes, couleurs[0]);
  return { id: 'ia', nom: o.nom || 'Deck adverse', cartes, reserve, couverture: couverture(cartes) };
}

/* Les couleurs qui ont assez de cartes pour faire un deck. */
const COULEURS_JOUABLES = ['rose', 'orange', 'violette', 'mauve', 'bleue', 'azur', 'verte'];
function tirerCouleurs(rand) {
  const a = COULEURS_JOUABLES[Math.floor(rand() * COULEURS_JOUABLES.length)];
  if (rand() < 0.45) {
    const reste = COULEURS_JOUABLES.filter(c => c !== a);
    return [a, reste[Math.floor(rand() * reste.length)]];
  }
  return [a];
}

/* La carte qu'on montre sur la boîte du deck : son meilleur Joueur. */
function couverture(cartes) {
  const rang = { S: 7, L: 6, E: 5, R: 4, PR: 4, PC: 3, C: 2 };
  let best = null;
  for (const id in cartes) {
    const c = Combat.carte(id);
    if (!c || c.cat !== 'joueur') continue;
    if (!best || (rang[c.rar] || 0) > (rang[best.rar] || 0)) best = c;
  }
  return best ? best.id : Object.keys(cartes)[0];
}

/* Un deck écrit en une ligne, pour le partager : « M8D1.c012x2.c013x1…|rose10 ». */
function encoder(deck) {
  const c = Object.keys(deck.cartes).filter(k => deck.cartes[k] > 0).sort().map(k => k + (deck.cartes[k] > 1 ? 'x' + deck.cartes[k] : '')).join('.');
  const r = Object.keys(deck.reserve).filter(k => deck.reserve[k] > 0).map(k => k + deck.reserve[k]).join('.');
  return 'M8D1.' + c + '|' + r;
}
function decoder(s) {
  const m = String(s || '').trim().match(/^M8D1\.([^|]*)\|(.*)$/);
  if (!m) return null;
  const cartes = {}, reserve = {};
  for (const p of m[1].split('.').filter(Boolean)) {
    const [id, n] = p.split('x');
    if (!Combat.carte(id)) return null;
    cartes[id] = (cartes[id] || 0) + (+n || 1);
  }
  for (const p of m[2].split('.').filter(Boolean)) {
    const k = p.replace(/\d+$/, ''), n = +p.slice(k.length) || 0;
    if (!Combat.COULEURS.includes(k)) return null;
    reserve[k] = n;
  }
  return { cartes, reserve };
}

/* ---------- Qu'est-ce qu'un bon deck ? ---------- */
/* Les trois « Conseils » des règles officielles (« Construire son jeu ») :
     - « Jouez un minimum de 15 Joueur dans votre Club pour être sûr de ne
       pas manquer » ;
     - « Il est préférable de ne jouer qu'une couleur ou deux dans votre
       Réserve et de construire votre Club autour de ces couleurs » : la
       Réserve accordée aux attaques ;
     - « jouez majoritairement des Joueur avec une attaque coûtant une
       Essence ou deux » : la moitié au moins (« majoritairement »).
   Ce ne sont pas des règles : un deck qui les rate peut gagner. */
const BON = { joueurs: 15, accord: 0.8, bas: 0.5 };

function bilan(deck) {
  const cartes = deck.cartes || {};
  let joueurs = 0, bas = 0;
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!c || !q || c.cat !== 'joueur') continue;
    joueurs += q;
    if (Math.min(...c.atks.map(a => Combat.totalCout(a.cout))) <= 2) bas += q;
  }
  /* L'accord de la Réserve : la part des symboles de couleur des attaques
     que la Réserve couvre, couleur par couleur, au prorata. */
  const b = besoins(cartes), r = deck.reserve || {};
  const tb = total(b), tr = total(r) || 1;
  const accord = tb ? Object.keys(b).reduce((s, k) => s + Math.min((r[k] || 0) / tr, b[k] / tb), 0) : 1;
  const reperes = [
    { cle: 'joueurs', ok: joueurs >= BON.joueurs, titre: `${BON.joueurs} Joueurs au moins`,
      dit: `${joueurs} Joueur${joueurs > 1 ? 's' : ''}.`,
      pourquoi: joueurs >= BON.joueurs ? 'De quoi remplir tes trois cases toute la partie.'
        : 'Les règles officielles conseillent ce minimum « pour être sûr de ne pas manquer ».' },
    { cle: 'reserve', ok: accord >= BON.accord, titre: 'Une Réserve accordée',
      dit: `Accord avec tes attaques : ${Math.round(100 * accord)} %.`,
      pourquoi: accord >= BON.accord ? 'Tes Essences paient tes attaques.'
        : 'Des Essences ne paient aucune de tes attaques et ne permettent pas de jouer tes cartes de couleur. « Régler d\'après mes attaques » la corrige.' },
    { cle: 'bas', ok: joueurs > 0 && bas / joueurs >= BON.bas, titre: 'Des attaques qui partent tôt',
      dit: `${bas} Joueur${bas > 1 ? 's' : ''} sur ${joueurs} attaque${bas > 1 ? 'nt' : ''} pour 1 ou 2 Essences.`,
      pourquoi: joueurs && bas / joueurs >= BON.bas ? 'Tu frappes dès les premiers tours.'
        : 'Une seule Essence arrive par tour. Les règles officielles conseillent « majoritairement » des attaques à une ou deux Essences.' }
  ];
  const note = reperes.filter(x => x.ok).length;
  const nom = note >= 3 ? 'Solide' : note >= 2 ? 'Jouable' : 'À revoir';
  return { reperes, note, sur: reperes.length, nom, joueurs, bas, accord };
}

/* ---------- Les clés d'un deck (3.0.15) ---------- */
/* Le propriétaire, le 2 novembre 2026, en retirant l'assistant de deck (« il
   ruine tout l'aspect création et plaisir de créer ») : « Compense ce manque
   par un meilleur feedback […] donner les meilleurs clés pour créer un bon
   deck, sans trop prendre par la main. Le joueur doit être aidé sans se
   sentir sur un rail. » Les clés disent ce que fait le deck, chiffres à
   l'appui, sans jamais dire quelle carte mettre : des chances de pioche
   exactes (loi hypergéométrique, sur le Club et la Réserve tels qu'ils
   sont), et un repère mesuré sur tout le catalogue (l'attaque médiane à deux
   Essences). Plus de « Compléter pour moi » : seule la Réserve se règle d'un
   geste (reserveAuto, « Régler d'après mes attaques »). */
const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
/* La chance d'avoir au moins une des `k` cartes en en tirant `t` d'une pile de `n`. */
const auMoins = (n, k, t) => (n <= 0 || k <= 0 || t <= 0) ? 0 : k >= n ? 1 : 1 - comb(n - k, Math.min(t, n)) / comb(n, Math.min(t, n));
/* Ce qu'on a vu de son Club à son 3e tour : la main de départ, puis une
   pioche à chaque entretien (« l'entretien pioche aussi pour le premier
   CEO »). */
const VUES_TOUR3 = R.MAIN + 3;
let repereCat = null;
function repereCatalogue() {
  if (repereCat) return repereCat;
  const v = [];
  for (const c of Object.values(Combat.toutes())) {
    if (!c || c.cat !== 'joueur' || c.cachee || Combat.baseId(c.id) !== c.id) continue;
    for (const a of c.atks) if (Combat.totalCout(a.cout) === 2 && a.degats != null) v.push(a.degats);
  }
  v.sort((x, y) => x - y);
  return (repereCat = { atk2: v.length ? v[Math.floor(v.length / 2)] : 120 });
}
const GARDIENS = ['Garde', 'Provocation', 'Shield'];

function cles(deck) {
  const cartes = deck.cartes || {}, res = deck.reserve || {};
  const N = total(cartes) || R.CLUB, NR = total(res) || R.RESERVE;
  const { atk2 } = repereCatalogue();
  let joueurs = 0, bas = 0, tiennent = 0, gardiens = 0, resil = 0;
  const copies = {}, colorees = {};
  for (const id in cartes) {
    const c = Combat.carte(id), q = +cartes[id] || 0;
    if (!c || !q) continue;
    copies[cleCopie(id)] = (copies[cleCopie(id)] || 0) + q;
    if (c.res) resil += q;
    if (c.cat === 'joueur') {
      joueurs += q;
      if (Math.min(...c.atks.map(a => Combat.totalCout(a.cout))) <= 2) bas += q;
      if (c.def > atk2) tiennent += q;
      if (c.kw && GARDIENS.includes(c.kw.nom)) gardiens += q;
    } else if (c.col && c.col !== 'neutre') colorees[c.col] = (colorees[c.col] || 0) + q;
  }
  /* 1. Le départ : un Joueur qui attaque tôt dans la main de départ, puis
        avec le changement de main (une fois). */
  const p1 = auMoins(N, bas, R.MAIN), p2 = 1 - (1 - p1) * (1 - p1);
  /* 2. Les Essences : chaque couleur que demandent les attaques ou les
        cartes de couleur (« ne peuvent être jouées que si vous avez une
        Essence de la couleur correspondante déployée »), et quand la
        première arrive : une Essence par tour, dans l'ordre de la Réserve. */
  const b = besoins(cartes);
  const couleurs = [...new Set([...Object.keys(b), ...Object.keys(colorees)])]
    .sort((x, y) => ((b[y] || 0) + (colorees[y] || 0)) - ((b[x] || 0) + (colorees[x] || 0)))
    .map(k => {
      const e = +res[k] || 0;
      return { coul: k, e, sur: NR, attaques: b[k] || 0, cartes: colorees[k] || 0,
        tour2: auMoins(NR, e, 2), tour3: auMoins(NR, e, 3) };
    });
  const jamais = couleurs.filter(x => !x.e);
  /* 3. La régularité : combien de noms en 3, 2, 1 exemplaires, et la
        chance d'avoir vu une carte précise à son 3e tour. */
  const n = [0, 0, 0, 0];
  for (const k in copies) n[Math.min(3, copies[k])]++;
  return {
    depart: { bas, main: p1, avecChangement: p2, ok: p2 >= 0.85 },
    essences: { couleurs, jamais, ok: !jamais.length },
    regularite: { en3: n[3], en2: n[2], en1: n[1], vue3: auMoins(N, 3, VUES_TOUR3), vue1: auMoins(N, 1, VUES_TOUR3) },
    tenue: { joueurs, tiennent, atk2, gardiens },
    pv: { resil, auMoinsUne: auMoins(N, resil, R.PV), moyenne: R.PV * resil / N }
  };
}

/* COTES:debut — généré par tools/cotes-cartes.js (6000 parties), ne pas modifier à la main. */
const COTES = {
  c010: -0.018, c011: 0.034, c012: 0.027, c013: 0.031, c014: -0.003, c015: 0.025, c016: -0.016, c017: 0.017,
  c018: 0.028, c019: 0.012, c020: -0.019, c021: -0.001, c022: 0.027, c023: 0.002, c024: 0.013, c025: -0.018,
  c026: 0.001, c027: -0.032, c028: -0.009, c029: 0.017, c030: 0.01, c031: 0.003, c032: 0.027, c033: 0.016,
  c034: 0.006, c035: -0.023, c036: 0.03, c037: -0.01, c039: 0.054, c040: 0.068, c041: 0.072, c042: -0.023,
  c043: 0.01, c044: 0.006, c045: 0.008, c046: 0.005, c047: -0.012, c048: 0.017, c050: 0.01, c051: 0.003,
  c052: 0.029, c053: -0.009, c054: 0.012, c055: 0.01, c056: -0.006, c057: -0.029, c058: 0.027, c059: -0.013,
  c060: -0.037, c061: -0.083, c062: -0.022, c063: -0.022, c064: -0.017, c065: 0.011, c066: 0.009, c067: 0.011,
  c068: -0.027, c069: 0.011, c070: 0.037, c071: 0.035, c072: -0.026, c073: 0.002, c074: 0.017, c075: -0.019,
  c076: -0.014, c077: 0.004, c078: 0.001, c079: -0.001, c080: -0.02, c081: -0.027, c082: -0.007, c083: 0.034,
  c084: -0.004, c085: 0.01, c086: 0.001, c087: -0.001, c088: -0.001, c089: -0.009, c090: 0.004, c091: -0.014,
  c092: 0.003, c093: -0.022, c094: -0.013, c095: 0.012, c096: -0.019, c097: -0.005, c098: -0.009, c099: -0.008,
  c100: -0.009, c101: -0.004, c102: 0.019, c103: -0.011, c104: -0.006, c105: 0.007, c106: -0.007, c107: 0.006,
  c108: -0.008, c109: -0.034, c110: 0.001, c111: -0.018, c112: -0.029, c113: -0.053, c114: 0.047, c115: -0.014,
  c116: -0.042, c117: 0.033, c118: -0.015, c119: 0.019, c120: 0.023, c121: -0.023, c122: -0.01, c123: -0.017,
  c124: -0.004, c125: 0.005, c126: -0.033, c127: -0.018, p01: 0.001, p02: 0.026, p03: 0.004, p04: 0,
  p05: -0.004, p06: -0.015
};
/* COTES:fin */

/* ---------- La copie d'un Starter (3.0.14) ---------- */
/* Un Starter se joue prêté, mais ne se copie qu'avec ses propres cartes (le
   propriétaire, 1er novembre 2026). Chaque carte du Starter se prend dans la
   collection, toutes versions comprises — même nom, même couleur, comme la
   limite de trois exemplaires : celle que liste le Starter d'abord, puis la
   classique, la Reverse, la Promo. `possede` : id → exemplaires. Rend la
   copie (`cartes`), ou ce qui manque (`manque` : { nom, n }, `nManque`). */
function copieStarter(deck, possede) {
  possede = possede || {};
  const rang = id => ({ c: 0, r: 1, p: 2 }[id[0]] ?? 3);
  const versions = {};
  for (const id in possede) {
    if (!(possede[id] > 0) || !jouable(Combat.carte(id))) continue;
    (versions[cleCopie(id)] = versions[cleCopie(id)] || []).push(id);
  }
  const besoin = {}, prefere = {};
  for (const id in deck.cartes || {}) {
    const k = cleCopie(id);
    besoin[k] = (besoin[k] || 0) + (+deck.cartes[id] || 0);
    (prefere[k] = prefere[k] || []).push(id);
  }
  const cartes = {}, manque = [];
  const prendre = (id, n) => { if (n > 0) cartes[id] = (cartes[id] || 0) + n; return Math.max(0, n); };
  for (const k in besoin) {
    let reste = besoin[k];
    /* D'abord chaque carte que liste le Starter, à sa quantité… */
    for (const id of prefere[k]) reste -= prendre(id, Math.min(+deck.cartes[id] || 0, possede[id] || 0, reste));
    /* …puis ce qui reste de chaque version possédée. */
    const l = (versions[k] || []).slice().sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : 1));
    for (const id of l) {
      if (!reste) break;
      reste -= prendre(id, Math.min(reste, possede[id] - (cartes[id] || 0)));
    }
    if (reste) manque.push({ nom: Combat.carte(prefere[k][0]).nom, n: reste });
  }
  const nManque = manque.reduce((s, x) => s + x.n, 0);
  return { ok: !nManque, cartes: nManque ? null : cartes, manque, nManque };
}

const Decks = { cleCopie, limite, jouable, verifier, versMoteur, besoins, reserveAuto, STARTERS, copieStarter, aleatoire, tirerCouleurs, couverture, encoder, decoder, total, bilan, BON, CIBLES,
  cles, auMoins, COTES };
if (typeof module !== 'undefined' && module.exports) module.exports = Decks;
racine.Decks = Decks;

})(typeof globalThis !== 'undefined' ? globalThis : this);
