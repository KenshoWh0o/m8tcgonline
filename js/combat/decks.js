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
/* M8 vend deux Starter Decks : Section Toxique et Section Déter. Depuis la
   3.0.17, **leurs listes officielles** (le propriétaire, 8 novembre 2026) :
   40 cartes chacun, dont 16 Joueurs et la Promo de la Section (P04, P03) ;
   la Réserve, 7 Rose et 3 Orange pour le Toxique, 7 Mauve et 3 Violette
   pour le Déter. Ils sont prêtés : on peut les jouer sans en posséder les
   cartes. Jusqu'à la 3.0.16, des listes reconstituées par la session
   (docs/economie-3.0.md, § 3 bis). */
const STARTERS = {
  toxique: {
    id: 'starter-toxique', nom: 'Starter · Section Toxique', starter: true, couverture: 'c012',
    cartes: { p04: 1, c012: 2, c073: 3, c034: 3, c011: 3, c013: 3, c074: 1, c016: 2, c033: 2, c097: 3, c092: 2, c083: 3, c082: 3, c015: 3, c085: 3, c087: 3 },
    reserve: { rose: 7, orange: 3 }
  },
  deter: {
    id: 'starter-deter', nom: 'Starter · Section Déter', starter: true, couverture: 'c077',
    cartes: { p03: 1, c077: 2, c079: 3, c040: 3, c051: 3, c052: 3, c074: 1, c041: 2, c054: 2, c097: 3, c092: 2, c083: 3, c082: 3, c087: 3, c085: 3, c053: 3 },
    reserve: { mauve: 7, violette: 3 }
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
  /* Version 3.0.16 (le propriétaire : « les 5 clés du decks sont très
     confusantes, oublie ça et laisse juste le système des 3 étoiles, quitte
     à le moduler ») : un conseil presque suivi vaut une demi-étoile, et
     chaque conseil dit ce qui manque pour l'étoile entière. */
  const etat = (x, ok, presque) => (x >= ok ? 'ok' : x >= presque ? 'presque' : 'ko');
  const s = n => (n > 1 ? 's' : '');
  const eJ = etat(joueurs, BON.joueurs, BON.joueurs - 3);
  const eR = etat(accord, BON.accord, 0.6);
  const eB = joueurs ? etat(bas / joueurs, BON.bas, 0.35) : 'ko';
  const manqueJ = Math.max(0, BON.joueurs - joueurs);
  const manqueB = Math.max(0, Math.ceil(BON.bas * Math.max(joueurs, 1)) - bas);
  const reperes = [
    { cle: 'joueurs', etat: eJ, titre: `${BON.joueurs} Joueurs au moins`,
      dit: `${joueurs} Joueur${s(joueurs)}${manqueJ ? ` : encore ${manqueJ} pour l'étoile entière` : ''}.`,
      pourquoi: eJ === 'ok' ? 'De quoi remplir tes trois cases toute la partie.'
        : 'Les règles officielles conseillent ce minimum « pour être sûr de ne pas manquer ».' },
    { cle: 'reserve', etat: eR, titre: 'Une Réserve accordée',
      dit: `Accord avec tes attaques : ${Math.round(100 * accord)} %${eR === 'ok' ? '' : ` (${Math.round(100 * BON.accord)} % pour l'étoile entière)`}.`,
      pourquoi: eR === 'ok' ? 'Tes Essences paient tes attaques.'
        : 'Des Essences ne paient aucune de tes attaques et ne permettent pas de jouer tes cartes de couleur. « Régler d\'après mes attaques » la corrige.' },
    { cle: 'bas', etat: eB, titre: 'Des attaques qui partent tôt',
      dit: `${bas} Joueur${s(bas)} sur ${joueurs} attaque${bas > 1 ? 'nt' : ''} pour 1 ou 2 Essences${eB === 'ok' ? '' : ` : encore ${manqueB} pour l'étoile entière`}.`,
      pourquoi: eB === 'ok' ? 'Tu frappes dès les premiers tours.'
        : 'Une seule Essence arrive par tour. Les règles officielles conseillent « majoritairement » des attaques à une ou deux Essences.' }
  ];
  reperes.forEach(x => { x.ok = x.etat === 'ok'; });
  const note = reperes.reduce((t, x) => t + (x.etat === 'ok' ? 1 : x.etat === 'presque' ? 0.5 : 0), 0);
  const nom = note >= 3 ? 'Solide' : note >= 2 ? 'Jouable' : 'À revoir';
  return { reperes, note, sur: reperes.length, nom, joueurs, bas, accord };
}


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
};
if (typeof module !== 'undefined' && module.exports) module.exports = Decks;
racine.Decks = Decks;

})(typeof globalThis !== 'undefined' ? globalThis : this);
