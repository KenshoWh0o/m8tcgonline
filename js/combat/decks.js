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
   les jouer sans en posséder les cartes. */
const STARTERS = {
  toxique: {
    id: 'starter-toxique', nom: 'Starter · Section Toxique', starter: true, couverture: 'c012',
    cartes: {
      p03: 1, c010: 3, c011: 2, c012: 3, c013: 2, c017: 1, c073: 2, c078: 2, c079: 1, c074: 1,
      c015: 3, c085: 2, c087: 2, c088: 1,
      c014: 2, c016: 2, c083: 2, c104: 1, c096: 2, c097: 2, c020: 1, c091: 1, c092: 1
    },
    reserve: { rose: 10 }
  },
  deter: {
    id: 'starter-deter', nom: 'Starter · Section Déter', starter: true, couverture: 'c077',
    cartes: {
      p04: 1, c051: 3, c052: 3, c050: 1, c077: 2, c074: 1, c076: 1, c080: 2, c081: 1, c078: 2, c059: 1,
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
      pourquoi: joueurs >= BON.joueurs ? 'Assez de monde pour tenir tes trois cases tout le combat.'
        : 'Le conseil des règles officielles : « un minimum de 15 Joueur dans votre Club pour être sûr de ne pas manquer ».' },
    { cle: 'reserve', ok: accord >= BON.accord, titre: 'Une Réserve accordée',
      dit: `Elle suit tes attaques à ${Math.round(100 * accord)} %.`,
      pourquoi: accord >= BON.accord ? 'Les couleurs de ta Réserve sont celles que tes attaques demandent.'
        : 'Des Essences qui ne paient aucune de tes attaques (et qui n\'autorisent pas tes Objets, Coachs et Moments de couleur). « Réserve auto » la règle d\'après tes cartes.' },
    { cle: 'bas', ok: joueurs > 0 && bas / joueurs >= BON.bas, titre: 'Des attaques qui partent tôt',
      dit: `${bas} Joueur${bas > 1 ? 's' : ''} sur ${joueurs} attaque${bas > 1 ? 'nt' : ''} pour 2 Essences ou moins.`,
      pourquoi: joueurs && bas / joueurs >= BON.bas ? 'Tu peux frapper dès les premiers tours.'
        : 'Le conseil des règles officielles : « jouez majoritairement des Joueur avec une attaque coûtant une Essence ou deux ». Une seule Essence arrive par tour.' }
  ];
  const note = reperes.filter(x => x.ok).length;
  const nom = note >= 3 ? 'Solide' : note >= 2 ? 'Jouable' : 'À revoir';
  return { reperes, note, sur: reperes.length, nom, joueurs, bas, accord };
}

const Decks = { cleCopie, limite, jouable, verifier, versMoteur, besoins, reserveAuto, STARTERS, aleatoire, tirerCouleurs, couverture, encoder, decoder, total, bilan, BON, CIBLES };
if (typeof module !== 'undefined' && module.exports) module.exports = Decks;
racine.Decks = Decks;

})(typeof globalThis !== 'undefined' ? globalThis : this);
