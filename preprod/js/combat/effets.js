/* Les effets des cartes en combat (version 3.0), carte par carte.

   Chaque entrée traduit le texte imprimé, rangée sous l'identifiant de la
   carte d'origine (une Reverse joue comme elle). Les mots-clés courants —
   Provocation, Garde, Shield, Riposte, Légion — n'ont rien à écrire : le
   moteur les lit sur la carte (js/combat/moteur.js). Restent ici :
     entree      la Signature ★ : l'effet d'entrée, quand le Joueur arrive ;
     sur         les déclencheurs (Signature ⚡, Objets) : sur.recupPV…
     attaques    l'effet imprimé sous une attaque, par numéro d'attaque ;
     plus        le « + » d'une attaque (« 60+ : +10 par Joueur engagé ») ;
     buffAtk / buffDef   Buff : ce qu'il donne aux autres Joueurs ;
     atk / def   un Objet : ce qu'il donne au Joueur qui le porte ;
     effet       un Coach ou un Moment, et jouable() s'il peut l'être ;
     resilience  ce qui se passe quand la carte sort des PV.

   Quand un texte est ambigu, le choix fait est dit en commentaire, et repris
   dans docs/regles-3.0.md. */
"use strict";

(function (racine) {
const Combat = racine.Combat || (typeof require === 'function' ? require('./moteur.js') : null);
const O = Combat.O;
const adv = O.adv;
const R = O.REGLE;

/* ---------- Petits outils ---------- */
const mod = (x, t) => O.mod(x.E, t);
const joueurs = (x, j) => O.joueursDe(x.E, j == null ? x.j : j);
const adverses = x => O.joueursDe(x.E, adv(x.j));
const estObjet = c => O.estCat(c, 'objet');
const estJoueur = c => O.estCat(c, 'joueur');
const estMoment = c => O.estCat(c, 'moment');
const sansProvoc = x => c => !O.aMotCle(x.E, c, 'Provocation');
const mainSauf = x => x.P.main.filter(m => m !== x.c);
const objetsEnJeu = j => E => O.joueursDe(E, j).reduce((l, c) => l.concat(c.obj), []);

function* engagerAdverse(x, filtre, titre) {
  const cs = adverses(x).filter(c => !c.eng && (!filtre || filtre(c)));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Engage un Joueur adverse', cs, { but: 'engagerAdverse' });
  if (t) yield* O.engager(x.E, t);
  return t;
}
function* desengagerAllie(x, filtre, titre) {
  const cs = joueurs(x).filter(c => c.eng && (!filtre || filtre(c)));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Désengage un de tes Joueurs', cs, { but: 'desengagerAllie' });
  if (t) yield* O.desengager(x.E, t);
  return t;
}
function* bancerAdverse(x, filtre, titre) {
  const cs = adverses(x).filter(c => !filtre || filtre(c));
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Bench un Joueur adverse', cs, { but: 'bancerAdverse' });
  if (t) O.bancer(x.E, t);
  return t;
}
function* bancerObjetAdverse(x, titre) {
  const cs = objetsEnJeu(adv(x.j))(x.E);
  const t = yield* O.choisirUn(x.E, x.j, titre || 'Bench un Objet adverse', cs, { but: 'bancerObjetAdverse' });
  if (t) O.bancer(x.E, t);
  return t;
}
function* choisirAllie(x, titre, filtre, but) {
  const cs = joueurs(x).filter(c => !filtre || filtre(c));
  return yield* O.choisirUn(x.E, x.j, titre, cs, { but: but || 'allie' });
}
function piocher(x, n) { return O.piocher(x.E, x.j, n); }

/* Retirer une carte précise du Club, de la défausse… */
function prendre(liste, c) {
  const i = liste.indexOf(c);
  if (i >= 0) liste.splice(i, 1);
  return c;
}

/* « Révélez les N cartes du dessus de votre Club et ajoutez une carte X à
   votre main. Défaussez les cartes restantes. » */
function* revelerEtPrendre(x, n, filtre, titre, reste) {
  const E = x.E, P = x.P;
  const top = P.club.splice(0, n);
  O.ev(E, { t: 'revele', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
  const cands = top.filter(filtre);
  const pick = yield* O.choisirUn(E, x.j, titre, cands, { zone: 'liste', montrer: top, but: 'ajouterMain' });
  if (pick) {
    prendre(top, pick);
    P.main.push(pick);
    O.ev(E, { t: 'ajoute', j: x.j, u: pick.u, id: pick.id });
  }
  if (reste === 'dessous') {
    const ord = yield* O.ordonner(E, x.j, 'Dans quel ordre sous ton Club ?', top, { texte: 'La première ira la plus haut.' });
    P.club.push(...ord);
  } else if (reste === 'dessus') {
    const ord = yield* O.ordonner(E, x.j, 'Dans quel ordre sur ton Club ?', top, { texte: 'La première sera piochée la première.' });
    P.club.unshift(...ord);
  } else {
    for (const c of top) { P.defausse.push(c); }
    if (top.length) O.ev(E, { t: 'defausseLot', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
  }
}

/* Regarder ses PV et en échanger un avec une carte de sa main. */
function* echangerPV(x) {
  const E = x.E, P = x.P;
  const main = P.main.filter(m => m !== x.c);
  if (!P.pv.length || !main.length) return;
  O.ev(E, { t: 'regardePV', j: x.j });
  const p = yield* O.choisirUn(E, x.j, 'Choisis un de tes PV', P.pv.slice(), { zone: 'liste', montrer: P.pv, but: 'pvSortir' });
  const m = yield* O.choisirUn(E, x.j, 'Échange-le avec une carte de ta main', main, { zone: 'main', but: 'pvEntrer' });
  if (!p || !m) return;
  P.pv[P.pv.indexOf(p)] = m;
  P.main[P.main.indexOf(m)] = p;
  O.ev(E, { t: 'echangePV', j: x.j });
}

/* « Jouez cette carte » : la Résilience la plus courante. Un Instant joue son
   effet ; un Objet se lie à un de vos Joueurs. Hors de son tour, elle ne
   compte pas dans la limite d'un Coach. */
function* jouerCetteCarte(x) {
  if (estObjet(x.c)) {
    const t = yield* choisirAllie(x, 'Lier à quel Joueur ?', c => c.obj.length < R.OBJETS, 'lierAllie');
    if (t) yield* O.lier(x.E, x.j, x.c, t);
    return;
  }
  const s = O.scr(x.c.id);
  if (s.effet) yield* s.effet(x);
}
function peutJouerCetteCarte(x) {
  if (estObjet(x.c)) return joueurs(x).some(c => c.obj.length < R.OBJETS);
  const s = O.scr(x.c.id);
  return !!s.effet && (!s.jouable || s.jouable(x));
}
const JOUER = { resilience: jouerCetteCarte, resPossible: peutJouerCetteCarte };

/* Le choix laissé à l'adversaire (OCE/PCE, C'est officiel !). */
function* choixAdverse(x, titre, a, b) {
  const r = yield {
    qui: adv(x.j), type: 'choix', but: 'choixAdverse', titre, carte: x.c.id,
    options: [{ v: 'a', label: a }, { v: 'b', label: b }]
  };
  return r.v;
}

function* defausserAuChoix(x, j, n, titre, filtre) {
  const P = x.E.j[j];
  const cands = P.main.filter(c => c !== x.c && (!filtre || filtre(c)));
  if (!cands.length) return [];
  const us = yield* O.choisirCartes(x.E, j, titre, cands.map(c => c.u), Math.min(n, cands.length), Math.min(n, cands.length), { but: 'defausse', zone: 'main' });
  O.defausserMain(x.E, j, us);
  return us;
}

/* Une Essence engagée à désengager — de préférence de la couleur demandée. */
function* desengagerEssences(x, n, coul) {
  for (let i = 0; i < n; i++) {
    const e = x.P.ess.find(z => z.eng && (!coul || z.coul === coul));
    if (!e) return;
    yield* O.desengagerEssence(x.E, e);
  }
}

const RENVOI_JOUEUR = c => !!c;

/* =================================================================== */
const S = {};

/* ---------------------------------------------------------- Rose */
/* 010 Broken Brawks — ⚡ Lorsque vous récupérez un PV, engagez ce Joueur. */
S.c010 = { sur: { *recupPV(x, d) { if (d.j === x.j) yield* O.engager(x.E, x.c); } } };

/* 011 Vandale — Glissade : Engagez un Joueur adverse. */
S.c011 = { attaques: { *1(x) { yield* engagerAdverse(x); } } };

/* 012 Squeezie le Toxique — ★ Engagez un Joueur adverse. */
S.c012 = { *entree(x) { yield* engagerAdverse(x); } };

/* 013 Pas Compris — Confusion 60+ : +10 par Joueur engagé (des deux camps,
   l'attaquant compris : il s'engage en attaquant). */
S.c013 = { plus: { 0: E => 10 * O.tousJoueurs(E).filter(c => c.eng).length } };

/* 014 Zacking Buff — Vos Joueurs ont +30 Attaque jusqu'à la fin du tour.
   Résilience : défaussez votre main pour engager un Joueur adverse. */
S.c014 = {
  *effet(x) { mod(x, { type: 'atk', camp: x.j, val: 30 }); },
  *resilience(x) {
    O.defausserMain(x.E, x.j, x.P.main.map(c => c.u));
    yield* engagerAdverse(x);
  },
  resPossible: x => adverses(x).some(c => !c.eng)
};

/* 015 Ravitaillement (Rose) — +10 Attaque, +10 Défense. Lorsque ce Joueur
   est engagé, vous pouvez bench cet Objet pour piocher 1 carte.
   Résilience : engagez 2 de vos Joueurs pour engager un Joueur adverse. */
S.c015 = {
  atk: 10, def: 10,
  sur: {
    *engage(x, d) {
      if (d.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Ravitaillement', { oui: 'Bench et piocher', non: 'Garder', texte: 'Bench cet Objet pour piocher 1 carte ?', carte: x.c.id, but: 'ravitaillement' })) {
        O.bancer(x.E, x.c);
        piocher(x, 1);
      }
    }
  },
  *resilience(x) {
    const miens = joueurs(x).filter(c => !c.eng);
    const us = yield* O.choisirCartes(x.E, x.j, 'Engage 2 de tes Joueurs', miens.map(c => c.u), 2, 2, { zone: 'plateau', but: 'engagerAllies' });
    for (const u of us) yield* O.engager(x.E, O.trouverSurPlateau(x.E, u));
    yield* engagerAdverse(x);
  },
  resPossible: x => joueurs(x).filter(c => !c.eng).length >= 2 && adverses(x).some(c => !c.eng)
};

/* 016 Mur Salvateur — Un de vos Joueurs a +10 Défense et gagne Garde
   jusqu'à la fin du tour adverse. Résilience : un de vos Joueurs gagne Garde
   jusqu'à la fin du tour. */
S.c016 = {
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Garde ?', null, 'buffDef');
    if (!t) return;
    mod(x, { type: 'def', cible: t.u, val: 10, jusqua: x.E.tour + 1 });
    mod(x, { type: 'kw', kw: 'Garde', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => joueurs(x).length > 0,
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Garde ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Garde', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 017 Tout Commence Ici — Buff : vos autres Joueurs ont +10 Attaque. */
S.c017 = { buffAtk: 10 };

/* 018 Buy Bundle M8 !! — Renvoyez 1 Joueur adverse sans Provocation dans la
   main de son propriétaire. Résilience : engagez un Joueur adverse avec
   Provocation. */
S.c018 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Renvoie un Joueur adverse en main', adverses(x).filter(sansProvoc(x)), { but: 'renvoyerAdverse' });
    if (t) O.renvoyerMain(x.E, t);
  },
  jouable: x => adverses(x).some(sansProvoc(x)),
  *resilience(x) { yield* engagerAdverse(x, c => O.aMotCle(x.E, c, 'Provocation')); },
  resPossible: x => adverses(x).some(c => !c.eng && O.aMotCle(x.E, c, 'Provocation'))
};

/* 019 OCE/PCE — Votre adversaire choisit : vous piochez 2 cartes, ou il
   défausse 2 cartes. Résilience : jouez cette carte. */
S.c019 = Object.assign({
  *effet(x) {
    const v = yield* choixAdverse(x, 'OCE/PCE — à toi de choisir', `${x.P.nom} pioche 2 cartes`, 'Tu défausses 2 cartes');
    if (v === 'a') piocher(x, 2);
    else yield* defausserAuChoix(x, adv(x.j), 2, 'Défausse 2 cartes');
  }
}, JOUER);

/* 020 Dégustation d'adversaires — Un Joueur adverse a -30 Défense et votre
   Joueur sur la même ligne a +30 Attaque jusqu'à la fin du tour.
   Résilience : un de vos Joueurs « gagne Buff +20 Défense » jusqu'à la fin
   du tour — lu comme : a +20 Défense. */
S.c020 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse perd 30 Défense ?', adverses(x), { but: 'affaiblirAdverse' });
    if (!t) return;
    mod(x, { type: 'def', cible: t.u, val: -30 });
    const l = O.ligneDe(x.E, t);
    const moi = x.P.lignes[l];
    if (moi) mod(x, { type: 'atk', cible: moi.u, val: 30 });
  },
  jouable: x => adverses(x).length > 0,
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur a +20 Défense ?', null, 'buffDef');
    if (t) mod(x, { type: 'def', cible: t.u, val: 20 });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 021 Trauma Dump III — Renvoyez tous les Objets liés à un Joueur dans la
   main de leur propriétaire. Résilience : renvoyez 1 Objet. */
S.c021 = {
  *effet(x) {
    const cs = O.tousJoueurs(x.E).filter(c => c.obj.length);
    const t = yield* O.choisirUn(x.E, x.j, 'De quel Joueur renvoyer les Objets ?', cs, { but: 'renvoyerObjets' });
    if (t) for (const o of t.obj.slice()) O.renvoyerMain(x.E, o);
  },
  jouable: x => O.tousJoueurs(x.E).some(c => c.obj.length),
  *resilience(x) {
    const cs = objetsEnJeu(0)(x.E).concat(objetsEnJeu(1)(x.E));
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Objet renvoyer en main ?', cs, { but: 'renvoyerObjet' });
    if (t) O.renvoyerMain(x.E, t);
  },
  resPossible: x => O.tousJoueurs(x.E).some(c => c.obj.length)
};

/* 022 Namifique — Omniscience : engagez un Joueur adverse. */
S.c022 = { attaques: { *0(x) { yield* engagerAdverse(x); } } };

/* 024 Agent M.E.L — Buff : vos autres Joueurs ont +20 Attaque. */
S.c024 = { buffAtk: 20 };

/* 026 Pause Technique — Engagez un Joueur adverse sans mot-clé (lu comme :
   dont la carte n'a aucun talent imprimé). */
S.c026 = {
  *effet(x) { yield* engagerAdverse(x, c => !O.motCleImprime(c)); },
  jouable: x => adverses(x).some(c => !c.eng && !O.motCleImprime(c))
};

/* 027 Remontada — Si vous avez moins de PV que votre adversaire, vos
   Joueurs ont +20 Attaque jusqu'à la fin du tour. */
S.c027 = {
  *effet(x) { if (x.P.pv.length < x.A.pv.length) mod(x, { type: 'atk', camp: x.j, val: 20 }); },
  jouable: x => x.P.pv.length < x.A.pv.length
};

/* 028 Championnes d'Europe — Les attaques de vos Joueurs avec Buff ont +20
   jusqu'à la fin du tour. */
S.c028 = {
  *effet(x) { mod(x, { type: 'atk', camp: x.j, val: 20, filtre: 'buff' }); },
  jouable: x => joueurs(x).some(c => O.aMotCle(x.E, c, 'Buff'))
};

/* ---------------------------------------------------------- Orange */
/* 029 Pollo — Demon's Domain 80+ : +20 par Objet lié. ⚡ Lorsque vous liez
   un ou plusieurs Objets à ce Joueur, vous pouvez placer un Objet de votre
   défausse sur votre Club. */
S.c029 = {
  plus: { 0: (E, c) => 20 * c.obj.length },
  sur: {
    *lier(x, d) {
      if (d.cible !== x.c || d.j !== x.j) return;
      const cs = x.P.defausse.filter(estObjet);
      const t = yield* O.choisirUn(x.E, x.j, 'Pollo — un Objet de ta défausse sur ton Club ?', cs, { zone: 'liste', montrer: cs, optionnel: true, passer: 'Non merci', but: 'objetSurClub' });
      if (t) { prendre(x.P.defausse, t); x.P.club.unshift(t); O.ev(x.E, { t: 'surClub', j: x.j, u: t.u, id: t.id }); }
    }
  }
};

/* 030 Worlds Lyon — Vos Joueurs liés ne s'engagent pas lors de leur première
   attaque ce tour. Résilience : un de vos Joueurs gagne Shield jusqu'à la
   fin du tour. */
S.c030 = {
  *effet(x) { mod(x, { type: 'lyon', camp: x.j }); },
  jouable: x => joueurs(x).some(c => c.obj.length && !c.eng),
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Shield ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Shield', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 031 Moi je suis coach — Révélez les 6 cartes du dessus de votre Club,
   ajoutez tous les Objets à votre main, défaussez le reste. Résilience : la
   prochaine Riposte déclenchée ce tour coûte 1 de moins. */
S.c031 = {
  *effet(x) {
    const top = x.P.club.splice(0, 6);
    O.ev(x.E, { t: 'revele', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
    for (const c of top) {
      if (estObjet(c)) { x.P.main.push(c); O.ev(x.E, { t: 'ajoute', j: x.j, u: c.u, id: c.id }); }
      else x.P.defausse.push(c);
    }
  },
  jouable: x => x.P.club.length > 0,
  *resilience(x) { mod(x, { type: 'ripostePlus', camp: x.j, n: 1 }); }
};

/* 032 Invitation — Lorsque ce Joueur est vaincu, bench cet Objet à la place
   (le moteur s'en charge). Résilience : jouez une carte Objet. */
S.c032 = {
  invitation: true,
  *resilience(x) {
    const o = yield* O.choisirUn(x.E, x.j, 'Quel Objet jouer ?', x.P.main.filter(estObjet), { zone: 'main', but: 'objetMain' });
    if (!o) return;
    const t = yield* choisirAllie(x, 'Lier à quel Joueur ?', c => c.obj.length < R.OBJETS, 'lierAllie');
    if (t) { O.retirerMain(x.P, o.u); yield* O.lier(x.E, x.j, o, t); }
  },
  resPossible: x => x.P.main.some(estObjet) && joueurs(x).some(c => c.obj.length < R.OBJETS)
};

/* 033 Visa Refusé — Un Joueur adverse sans Objet ne peut pas attaquer
   jusqu'à la fin du tour de l'adversaire. Résilience : ajoutez un Objet de
   votre défausse à votre main. */
S.c033 = {
  *effet(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne pourra pas attaquer ?', adverses(x).filter(c => !c.obj.length), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => adverses(x).some(c => !c.obj.length),
  *resilience(x) {
    const cs = x.P.defausse.filter(estObjet);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Objet reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estObjet)
};

/* 034 Vanyabubu — Baby Shark 60+ : +10 par Objet lié. Riposte. */
S.c034 = { plus: { 0: (E, c) => 10 * c.obj.length } };

/* 036 Maillot Champions '25 — Ce Joueur gagne Riposte. Résilience : un de
   vos Joueurs gagne Riposte jusqu'à la fin du tour. */
S.c036 = {
  donne: ['Riposte'],
  *resilience(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Riposte ?', null, 'buffDef');
    if (t) mod(x, { type: 'kw', kw: 'Riposte', cible: t.u });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 037 L'Œil de Nikof — Regardez les 4 cartes du dessus, ajoutez un Objet à
   votre main, replacez le reste dessus dans l'ordre de votre choix.
   Résilience : mélangez jusqu'à 2 Objets de votre défausse dans votre Club. */
S.c037 = {
  *effet(x) { yield* revelerEtPrendre(x, 4, estObjet, 'Ajoute un Objet à ta main', 'dessus'); },
  jouable: x => x.P.club.length > 0,
  *resilience(x) {
    const cs = x.P.defausse.filter(estObjet);
    const us = yield* O.choisirCartes(x.E, x.j, 'Jusqu\'à 2 Objets à remettre dans ton Club', cs.map(c => c.u), 0, 2, { zone: 'liste', cartes: cs.map(c => ({ u: c.u, id: c.id })), but: 'recycler' });
    for (const u of us) { const c = x.P.defausse.find(z => z.u === u); prendre(x.P.defausse, c); x.P.club.push(c); }
    if (us.length) { O.melanger(x.E, x.P.club); O.ev(x.E, { t: 'melangeClub', j: x.j, n: us.length }); }
  },
  resPossible: x => x.P.defausse.some(estObjet)
};

/* 115 Champions du Monde — Un de vos Joueurs gagne Riposte et Shield
   jusqu'à la fin du tour adverse. */
S.c115 = {
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur gagne Riposte et Shield ?', null, 'buffDef');
    if (!t) return;
    mod(x, { type: 'kw', kw: 'Riposte', cible: t.u, jusqua: x.E.tour + 1 });
    mod(x, { type: 'kw', kw: 'Shield', cible: t.u, jusqua: x.E.tour + 1 });
  },
  jouable: x => joueurs(x).length > 0
};

/* ---------------------------------------------------------- Jade */
/* 038 Caprice de Gotaga — Défaussez une carte pour jouer la première carte
   de votre Réserve, engagée. Résilience : jouez cette carte. */
S.c038 = Object.assign({
  *effet(x) {
    const d = yield* defausserAuChoix(x, x.j, 1, 'Défausse une carte');
    if (d.length) O.jouerReserve(x.E, x.j, true);
  },
  jouable: x => mainSauf(x).length > 0 && x.P.reserve.length > 0
}, JOUER);

/* ---------------------------------------------------------- Violette */
/* 039 Zéro Soucis — ⚡ Lorsque votre adversaire joue un Joueur, vous pouvez
   échanger la position de ce Joueur et d'un autre de vos Joueurs. */
S.c039 = {
  sur: {
    *deploie(x, d) {
      if (d.j === x.j) return;
      const autres = joueurs(x).filter(c => c !== x.c);
      const t = yield* O.choisirUn(x.E, x.j, 'Zéro Soucis — échanger sa place ?', autres, { optionnel: true, passer: 'Ne rien changer', but: 'echangerPlace' });
      if (t) echangerPlaces(x.E, x.c, t);
    }
  }
};
function echangerPlaces(E, a, b) {
  const P = E.j[a.j];
  const la = P.lignes.indexOf(a), lb = P.lignes.indexOf(b);
  P.lignes[la] = b;
  P.lignes[lb] = a;
  O.ev(E, { t: 'echangePlaces', j: a.j, a: a.u, b: b.u, la: lb, lb: la });
}

/* 040 Les Rois du Saloon — Hold-Up 60+ : +10 par PV que vous avez. */
S.c040 = { plus: { 0: (E, c) => 10 * E.j[c.j].pv.length } };

/* 041 Trauma Dump I — La première fois que votre adversaire récupère un PV
   ce tour, désengagez un de vos Joueurs. Résilience : désengagez un de vos
   Joueurs. */
S.c041 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'recupPV', src: 'c041', nom: 'recup', camp: x.j }); },
  guets: {
    *recup(x, d) {
      if (d.j === x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      yield* desengagerAllie(Object.assign({}, x, { j: x.guet.camp, P: x.E.j[x.guet.camp] }));
    }
  },
  *resilience(x) { yield* desengagerAllie(x); },
  resPossible: x => joueurs(x).some(c => c.eng)
};

/* 042 Reverse Squeeze — Regardez vos PV, choisissez-en un, échangez-le avec
   une carte de votre main. Résilience : défaussez votre premier PV pour
   placer 1 carte de votre main sur vos PV. */
S.c042 = {
  *effet(x) { yield* echangerPV(x); },
  jouable: x => x.P.pv.length > 0 && mainSauf(x).length > 0,
  *resilience(x) {
    const m = yield* O.choisirUn(x.E, x.j, 'Quelle carte poser sur tes PV ?', x.P.main.slice(), { zone: 'main', but: 'pvEntrer' });
    if (!m) return;
    const p = x.P.pv.shift();
    x.P.defausse.push(p);
    O.retirerMain(x.P, m.u);
    x.P.pv.unshift(m);
    O.ev(x.E, { t: 'echangePV', j: x.j });
  },
  resPossible: x => x.P.pv.length > 0 && x.P.main.length > 0
};

/* 043 BLBLBLBL — Échangez la position de 2 de vos Joueurs. Résilience :
   jouez cette carte. */
S.c043 = Object.assign({
  *effet(x) {
    const cs = joueurs(x);
    const us = yield* O.choisirCartes(x.E, x.j, 'Quels Joueurs échanger ?', cs.map(c => c.u), 2, 2, { zone: 'plateau', but: 'echangerPlaces' });
    if (us.length === 2) echangerPlaces(x.E, O.trouverSurPlateau(x.E, us[0]), O.trouverSurPlateau(x.E, us[1]));
  },
  jouable: x => joueurs(x).length >= 2
}, JOUER);

/* 044 Moroccan Monsters — Pinch : désengagez un autre de vos Joueurs.
   ★ Piochez une carte si vous avez plus de 2 PV. */
S.c044 = {
  attaques: { *0(x) { yield* desengagerAllie(x, c => c !== x.c); } },
  *entree(x) { if (x.P.pv.length > 2) piocher(x, 1); }
};

/* 045 Zzzzz — Rêverie : regardez les 4 cartes du dessus de votre Club et
   placez-les dessus ou dessous dans l'ordre de votre choix. ★ Regardez vos
   PV, choisissez-en un, échangez-le avec une carte de votre main. */
S.c045 = {
  attaques: {
    *0(x) {
      const E = x.E, P = x.P;
      const top = P.club.splice(0, 4);
      if (!top.length) return;
      O.ev(E, { t: 'regarde', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
      const bas = yield* O.choisirCartes(E, x.j, 'Lesquelles passer sous ton Club ?', top.map(c => c.u), 0, top.length,
        { zone: 'liste', cartes: top.map(c => ({ u: c.u, id: c.id })), but: 'dessous', texte: 'Les autres restent dessus.' });
      const dessous = top.filter(c => bas.includes(c.u));
      const dessus = top.filter(c => !bas.includes(c.u));
      const h = yield* O.ordonner(E, x.j, 'Ordre sur ton Club', dessus, { texte: 'La première sera piochée la première.' });
      const b = yield* O.ordonner(E, x.j, 'Ordre sous ton Club', dessous);
      P.club.unshift(...h);
      P.club.push(...b);
    }
  },
  *entree(x) { yield* echangerPV(x); }
};

/* 046 Maillot Champions '24 — Lorsque ce Joueur vainc un Joueur (lu ainsi :
   l'Objet parle de son porteur), désengagez une de vos Essences.
   Résilience : désengagez 1 de vos Joueurs. */
S.c046 = {
  sur: { *vainc(x, d) { if (d.par === x.porteur) yield* desengagerEssences(x, 1); } },
  *resilience(x) { yield* desengagerAllie(x); },
  resPossible: x => joueurs(x).some(c => c.eng)
};

/* 047 Champions du Major (Violette) — Jusqu'à la fin du tour, chaque fois
   que vous désengagez un Joueur, désengagez une Essence Violette. */
S.c047 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'desengage', src: 'c047', nom: 'joueur', camp: x.j }); },
  guets: {
    *joueur(x, d) {
      if (d.c.j !== x.guet.camp) return;
      if ((x.E.cpt.majorA = (x.E.cpt.majorA || 0) + 1) > 6) return;
      const P = x.E.j[x.guet.camp];
      const e = P.ess.find(z => z.eng && z.coul === 'violette');
      if (e) yield* O.desengagerEssence(x.E, e);
    }
  }
};
/* 048 Champions du Major (Violette) — Jusqu'à la fin du tour, la première
   fois que vous désengagez une Essence, désengagez un Joueur Violet. */
S.c048 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'desengageEss', src: 'c048', nom: 'ess', camp: x.j }); },
  guets: {
    *ess(x, d) {
      if (d.j !== x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      const t = O.joueursDe(x.E, x.guet.camp).find(c => c.eng && O.carte(c.id).col === 'violette');
      if (t) yield* O.desengager(x.E, t);
    }
  }
};

/* ---------------------------------------------------------- Jaune */
/* 049 Le Roi des rois — Dictature 50+ : +20 par Essence Jaune contrôlée.
   Légion. */
S.c049 = { plus: { 0: (E, c) => 20 * E.j[c.j].ess.filter(e => e.coul === 'jaune').length } };

/* ---------------------------------------------------------- Mauve */
/* 050 La Fée Rosalie — ★ Bench un Joueur adverse engagé sans Provocation. */
S.c050 = { *entree(x) { yield* bancerAdverse(x, c => c.eng && !O.aMotCle(x.E, c, 'Provocation')); } };

/* 052 Most Valuable Planet — Sourire Radieux : mélangez 1 Essence Mauve dans
   votre Réserve. */
S.c052 = { attaques: { *1(x) { O.rendreEssences(x.E, x.j, 'mauve', 1); } } };

/* 053 Ravitaillement (Mauve) — +10 Attaque, +10 Défense. Lorsque ce Joueur
   vainc un Joueur, vous pouvez détruire cet Objet pour piocher 2 cartes.
   Résilience : bench un Objet adverse. */
S.c053 = {
  atk: 10, def: 10,
  sur: {
    *vainc(x, d) {
      if (d.par !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Ravitaillement', { oui: 'Détruire et piocher 2', non: 'Garder', texte: 'Détruire cet Objet pour piocher 2 cartes ?', carte: x.c.id, but: 'ravitaillement' })) {
        O.defausserPlateau(x.E, x.c);
        piocher(x, 2);
      }
    }
  },
  *resilience(x) { yield* bancerObjetAdverse(x); },
  resPossible: x => objetsEnJeu(adv(x.j))(x.E).length > 0
};

/* 054 Trauma Dump II — Mélangez 1 Essence Mauve dans votre Réserve : vos
   Joueurs déployés ont +20 sur leurs attaques jusqu'à la fin du tour.
   Résilience : jouez la première carte de votre Réserve. */
S.c054 = {
  *effet(x) {
    if (O.rendreEssences(x.E, x.j, 'mauve', 1)) mod(x, { type: 'atk', camp: x.j, val: 20 });
  },
  jouable: x => x.P.ess.some(e => e.coul === 'mauve') && joueurs(x).length > 0,
  *resilience(x) { O.jouerReserve(x.E, x.j, false); },
  resPossible: x => x.P.reserve.length > 0
};

/* 055 Target Missed — Si le premier Joueur qui attaque l'adversaire ce tour
   ne vainc aucun Joueur, il gagne Provocation jusqu'à la fin du tour de
   l'adversaire. Résilience : bench un Joueur adverse engagé sans
   Provocation. */
S.c055 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'finAttaque', src: 'c055', nom: 'fin', camp: x.j }); },
  jouable: x => x.E.cpt.attaques === 0,
  guets: {
    *fin(x, X) {
      if (x.guet.fini || X.j !== x.guet.camp) return;
      x.guet.fini = true;
      if (X.rang === 1 && !X.vaincu && O.enJeu(x.E, X.c)) {
        mod(x, { type: 'kw', kw: 'Provocation', cible: X.c.u, jusqua: x.E.tour + 1 });
        O.ev(x.E, { t: 'gagneMotCle', u: X.c.u, kw: 'Provocation' });
      }
    }
  },
  *resilience(x) { yield* bancerAdverse(x, c => c.eng && !O.aMotCle(x.E, c, 'Provocation')); },
  resPossible: x => adverses(x).some(c => c.eng && !O.aMotCle(x.E, c, 'Provocation'))
};

/* 056 Le Maillot Maudit — -10 Attaque. Lorsque ce Joueur vainc un Joueur,
   vous pouvez bench cet Objet pour bench un Joueur adverse engagé.
   Résilience : bench tous vos Joueurs pour mettre fin à la phase de Combat. */
S.c056 = {
  atk: -10,
  sur: {
    *vainc(x, d) {
      if (d.par !== x.porteur) return;
      const cs = adverses(x).filter(c => c.eng);
      if (!cs.length) return;
      if (yield* O.ouiNon(x.E, x.j, 'Le Maillot Maudit', { oui: 'Bench', non: 'Garder', texte: 'Bench cet Objet pour bench un Joueur adverse engagé ?', carte: x.c.id, but: 'maillotMaudit' })) {
        O.bancer(x.E, x.c);
        yield* bancerAdverse(x, c => c.eng);
      }
    }
  },
  *resilience(x) {
    for (const c of joueurs(x).slice()) O.bancer(x.E, c);
    x.E.cpt.combatFini = true;
    O.ev(x.E, { t: 'finCombatForce', j: adv(x.j) });
  }
};

/* 060 Gotaga Pose — Aspiration d'âme 150+ : +100 si l'adversaire a récupéré
   un PV ce tour. Légion. */
S.c060 = { plus: { 0: (E, c) => (E.cpt.pvRecup[adv(c.j)] > 0 ? 100 : 0) } };

/* 061 Champions du Major (Mauve) — Mélangez 3 de vos Essences Mauves dans
   votre Réserve pour bench un Joueur adverse. */
S.c061 = {
  *effet(x) {
    if (O.rendreEssences(x.E, x.j, 'mauve', 3) === 3) yield* bancerAdverse(x);
  },
  jouable: x => x.P.ess.filter(e => e.coul === 'mauve').length >= 3 && adverses(x).length > 0
};

/* 116 The French Sorcerer — Foudre de Rage : bench un Joueur adverse,
   mélangez 1 Essence Mauve dans votre Réserve. Éclairs Vengeurs : mélangez
   2 Essences Mauves dans votre Réserve. */
S.c116 = {
  attaques: {
    *0(x) { yield* bancerAdverse(x); O.rendreEssences(x.E, x.j, 'mauve', 1); },
    *1(x) { O.rendreEssences(x.E, x.j, 'mauve', 2); }
  }
};

/* 117 La Relève — ★ Bench jusqu'à un Baby Driver que vous contrôlez et
   piochez 3 cartes (« jusqu'à » : la pioche ne dépend pas du Bench). */
S.c117 = {
  *entree(x) {
    const bd = joueurs(x).filter(c => O.baseId(c.id) === 'c059');
    const t = yield* O.choisirUn(x.E, x.j, 'Bench un Baby Driver ?', bd, { optionnel: true, passer: 'Non', but: 'bancerAllie' });
    if (t) O.bancer(x.E, t);
    piocher(x, 3);
  }
};

/* 125 6W26L (Secrète) — UltiM8um 60+ : +60 par PV récupéré par votre
   adversaire ce tour. Légion. */
S.c125 = { plus: { 0: (E, c) => 60 * E.cpt.pvRecup[adv(c.j)] } };

/* ---------------------------------------------------------- Verte */
/* 062 Just Passion — Si vous avez moins de 2 PV, doublez la valeur
   d'attaque de ce Joueur. */
S.c062 = { double: (E, c) => E.j[c.j].pv.length < 2 };

/* 063 Calma — ★ Le Joueur adverse sur la même ligne ne peut pas défendre
   une attaque de ce Joueur ce tour. */
S.c063 = { *entree(x) { mod(x, { type: 'pasDefenseFace', cible: x.c.u }); }, ombre: false };

/* ---------------------------------------------------------- Bleue */
/* 064 Bwarks — ⚡ Lorsque vous récupérez un PV, bench un Objet adverse. */
S.c064 = { sur: { *recupPV(x, d) { if (d.j === x.j) yield* bancerObjetAdverse(x); } } };

/* 065 Jus de bagarre — Ce Joueur peut attaquer le Joueur adverse sur sa
   ligne. Résilience : votre adversaire défausse 1 carte Joueur. */
S.c065 = {
  jusDeBagarre: true,
  *resilience(x) { yield* defausserAuChoix(x, adv(x.j), 1, 'Défausse une carte Joueur', estJoueur); },
  resPossible: x => x.A.main.some(estJoueur)
};

/* 066 L'Immense Draculan — Défaussez 1 carte et engagez 2 Essences pour
   mélanger une Essence adverse engagée dans la Réserve de son propriétaire.
   Résilience : engagez 1 Essence adverse. */
S.c066 = {
  *effet(x) {
    const d = yield* defausserAuChoix(x, x.j, 1, 'Défausse une carte');
    if (!d.length) return;
    O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
    const cs = x.A.ess.filter(e => e.eng);
    const e = yield* O.choisirUn(x.E, x.j, 'Quelle Essence adverse renvoyer ?', cs, { zone: 'essences', but: 'essenceAdverse' });
    if (e) {
      x.A.ess.splice(x.A.ess.indexOf(e), 1);
      e.eng = false;
      x.A.reserve.push(e);
      O.melanger(x.E, x.A.reserve);
      O.ev(x.E, { t: 'essRendue', j: adv(x.j), u: [e.u], coul: e.coul });
    }
  },
  jouable: x => mainSauf(x).length > 0 && O.essencesLibres(x.E, x.j).length >= 2 && x.A.ess.some(e => e.eng),
  *resilience(x) {
    const cs = x.A.ess.filter(e => !e.eng);
    const e = yield* O.choisirUn(x.E, x.j, 'Quelle Essence adverse engager ?', cs, { zone: 'essences', but: 'essenceAdverse' });
    if (e) O.engagerEssence(x.E, e);
  },
  resPossible: x => x.A.ess.some(e => !e.eng)
};

/* 067 1% Chance — ★ Ajoutez jusqu'à un « 99% Faith » de votre Club à votre
   main. */
S.c067 = {
  *entree(x) {
    const cs = x.P.club.filter(c => O.baseId(c.id) === 'c068');
    const t = yield* O.choisirUn(x.E, x.j, 'Prendre 99% Faith ?', cs, { zone: 'liste', montrer: cs, optionnel: true, passer: 'Non', but: 'ajouterMain' });
    if (t) { prendre(x.P.club, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
    O.melanger(x.E, x.P.club);
  }
};

/* 068 99% Faith — Si 1% Chance est déployé, ce Joueur gagne Provocation et
   Shield. */
S.c068 = {
  motsCles: (E, c) => (O.joueursDe(E, c.j).some(z => O.baseId(z.id) === 'c067') ? ['Provocation', 'Shield'] : [])
};

/* ---------------------------------------------------------- Azur */
/* 069 L'Arme Nucléaire — WaWar 90+ : +20 par carte en main. ⚡ Lorsque votre
   adversaire est touché, si ce Joueur est votre seul Joueur déployé, il
   défausse le PV sans le regarder (le moteur s'en charge). */
S.c069 = { plus: { 0: (E, c) => 20 * E.j[c.j].main.length }, nucleaire: true };

/* 070 Worlds Japon — À la fin de votre première attaque, ajoutez en main le
   Joueur attaquant et jouez un autre Joueur depuis votre main à la même
   place. Résilience : jouez 2 Joueurs ; à la fin de la phase de Combat,
   bench-les. */
S.c070 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'finAttaque', src: 'c070', nom: 'fin', camp: x.j }); },
  jouable: x => x.E.cpt.attaques === 0 && x.P.main.some(c => c !== x.c && estJoueur(c)),
  guets: {
    *fin(x, X) {
      if (x.guet.fini || X.j !== x.guet.camp) return;
      x.guet.fini = true;
      if (X.rang !== 1 || !O.enJeu(x.E, X.c)) return;
      const P = x.E.j[x.guet.camp];
      const l = O.ligneDe(x.E, X.c);
      O.renvoyerMain(x.E, X.c);
      const cs = P.main.filter(c => c !== X.c && estJoueur(c));
      const t = yield* O.choisirUn(x.E, x.guet.camp, 'Worlds Japon — quel Joueur entre ?', cs, { zone: 'main', but: 'deployer' });
      if (t) { O.retirerMain(P, t.u); yield* O.deployer(x.E, x.guet.camp, t, l); }
    },
    *bench(x) {
      if (x.guet.fini) return;
      x.guet.fini = true;
      for (const u of x.guet.uids) {
        const c = O.trouverSurPlateau(x.E, u);
        if (c && O.enJeu(x.E, c)) O.bancer(x.E, c);
      }
    }
  },
  *resilience(x) {
    const uids = [];
    for (let i = 0; i < 2; i++) {
      if (!x.P.lignes.some(l => !l)) break;
      const cs = x.P.main.filter(estJoueur);
      const t = yield* O.choisirUn(x.E, x.j, `Worlds Japon — Joueur ${i + 1} sur 2`, cs, { zone: 'main', optionnel: i > 0, passer: 'Plus de Joueur', but: 'deployer' });
      if (!t) break;
      O.retirerMain(x.P, t.u);
      const c = yield* O.deployer(x.E, x.j, t, null);
      if (c) uids.push(c.u);
    }
    if (uids.length) mod(x, { type: 'guet', quand: 'finCombat', src: 'c070', nom: 'bench', camp: x.j, uids });
  },
  resPossible: x => x.P.main.some(estJoueur) && x.P.lignes.some(l => !l)
};

/* 071 Versus Fighting — →↓↘ + 👊 : à la fin de l'attaque, ajoutez ce Joueur
   à votre main et vous pouvez jouer un autre Joueur depuis votre main à sa
   place. Garde. */
S.c071 = {
  attaques: {
    *0(x) {
      if (!O.enJeu(x.E, x.c)) return;
      const l = O.ligneDe(x.E, x.c);
      O.renvoyerMain(x.E, x.c);
      const cs = x.P.main.filter(c => c !== x.c && estJoueur(c));
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur prend sa place ?', cs, { zone: 'main', optionnel: true, passer: 'Personne', but: 'deployer' });
      if (t) { O.retirerMain(x.P, t.u); yield* O.deployer(x.E, x.j, t, l); }
    }
  }
};

/* ---------------------------------------------------------- Neutre */
/* 072 Leakof — Regardez la main de votre adversaire. Résilience : jouez
   cette carte. */
S.c072 = Object.assign({
  *effet(x) { O.ev(x.E, { t: 'regarde', j: x.j, de: adv(x.j), cartes: x.A.main.map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 073 L'Héritier — ⚡ Lorsque le CEO adverse lie un Objet à un Joueur, ce
   Joueur a +20 Défense jusqu'à la fin du tour. */
S.c073 = { sur: { *lier(x, d) { if (d.j !== x.j) mod(x, { type: 'def', cible: x.c.u, val: 20 }); } } };

/* 075 Pétrodollars — Vol : regardez les 5 cartes du dessus de votre Club et
   liez jusqu'à 1 Objet parmi elles à un autre de vos Joueurs. ★ Liez 2
   Objets de votre défausse à un autre de vos Joueurs. */
S.c075 = {
  attaques: {
    *0(x) {
      const top = x.P.club.slice(0, 5);
      O.ev(x.E, { t: 'regarde', j: x.j, cartes: top.map(c => ({ u: c.u, id: c.id })) });
      const autres = joueurs(x).filter(c => c !== x.c && c.obj.length < R.OBJETS);
      const objs = top.filter(estObjet);
      if (!autres.length || !objs.length) return;
      const o = yield* O.choisirUn(x.E, x.j, 'Lier un de ces Objets ?', objs, { zone: 'liste', montrer: top, optionnel: true, passer: 'Non', but: 'lierDepuis' });
      if (!o) return;
      const t = yield* O.choisirUn(x.E, x.j, 'À quel Joueur ?', autres, { but: 'lierAllie' });
      if (t) { prendre(x.P.club, o); yield* O.lier(x.E, x.j, o, t); }
    }
  },
  *entree(x) {
    const autres = joueurs(x).filter(c => c !== x.c && c.obj.length < R.OBJETS);
    const objs = x.P.defausse.filter(estObjet);
    if (!autres.length || !objs.length) return;
    const t = yield* O.choisirUn(x.E, x.j, 'À quel Joueur lier 2 Objets ?', autres, { but: 'lierAllie' });
    if (!t) return;
    const n = Math.min(2, R.OBJETS - t.obj.length, objs.length);
    const us = yield* O.choisirCartes(x.E, x.j, `Quels Objets lier (${n}) ?`, objs.map(c => c.u), n, n, { zone: 'liste', cartes: objs.map(c => ({ u: c.u, id: c.id })), but: 'lierDepuis' });
    for (const u of us) {
      /* Un déclencheur (Pollo) a pu déplacer l'Objet entre-temps. */
      const o = x.P.defausse.find(c => c.u === u);
      if (!o || !O.enJeu(x.E, t)) continue;
      prendre(x.P.defausse, o);
      yield* O.lier(x.E, x.j, o, t);
    }
  }
};

/* 076 Ralliement — Déploiement : révélez les 5 cartes du dessus de votre
   Club, ajoutez une carte Joueur à votre main, défaussez le reste. Buff :
   vos Joueurs alliés gagnent +10 Défense (lu : les autres). */
S.c076 = {
  buffDef: 10,
  attaques: { *0(x) { yield* revelerEtPrendre(x, 5, estJoueur, 'Ajoute un Joueur à ta main'); } }
};

/* 077 Brawks Déter — ⚡ Lorsque votre adversaire récupère un PV suite à
   l'attaque de ce Joueur, piochez une carte. */
S.c077 = { sur: { *recupPV(x, d) { if (d.j !== x.j && d.par === x.c) piocher(x, 1); } } };

/* 079 Instalock — ★ Vous pouvez engager ce Joueur pour bench un Joueur
   adverse. */
S.c079 = {
  *entree(x) {
    if (!adverses(x).length || x.c.eng) return;
    if (yield* O.ouiNon(x.E, x.j, 'Instalock', { oui: 'Engager et bench', non: 'Non', texte: 'Engager Instalock pour bench un Joueur adverse ?', carte: x.c.id, but: 'instalock' })) {
      yield* O.engager(x.E, x.c);
      yield* bancerAdverse(x);
    }
  },
  ombre: false
};

/* 080 Meet & Greeter — ⚡ Lorsque vous défendez avec ce Joueur, vous pouvez
   le renvoyer dans votre Club pour jouer un autre Joueur, engagé, à sa place
   en tant que défenseur. */
S.c080 = {
  sur: {
    *defense(x, X) {
      if (X.defenseur !== x.c) return;
      const cs = x.P.main.filter(estJoueur);
      if (!cs.length) return;
      const t = yield* O.choisirUn(x.E, x.j, 'Meet & Greeter — qui défend à sa place ?', cs, { zone: 'main', optionnel: true, passer: 'Il reste', but: 'deployer' });
      if (!t) return;
      const l = O.ligneDe(x.E, x.c);
      const objets = O.quitterPlateau(x.E, x.c);
      objets.forEach(o => x.P.defausse.push(o));
      x.P.club.push(x.c);
      O.melanger(x.E, x.P.club);
      O.ev(x.E, { t: 'auClub', j: x.j, u: x.c.u, id: x.c.id, ligne: l });
      O.retirerMain(x.P, t.u);
      const n = yield* O.deployer(x.E, x.j, t, l, { engage: true });
      if (n) { X.defenseur = n; X.cible = n.u; }
    }
  }
};

/* 082 Barakataga — Les CEO piochent jusqu'à avoir 4 cartes en main.
   Résilience : piochez 2 cartes. */
S.c082 = {
  *effet(x) {
    for (const j of [x.j, adv(x.j)]) {
      const n = 4 - x.E.j[j].main.length;
      if (n > 0) O.piocher(x.E, j, n);
    }
  },
  jouable: x => mainSauf(x).length < 4,
  *resilience(x) { piocher(x, 2); }
};

/* 083 Mercato — Piochez 3 cartes. Résilience : regardez les 5 cartes du
   dessus, ajoutez un Joueur à votre main, le reste dessous dans l'ordre de
   votre choix. */
S.c083 = {
  *effet(x) { piocher(x, 3); },
  jouable: x => x.P.club.length > 0,
  *resilience(x) { yield* revelerEtPrendre(x, 5, estJoueur, 'Ajoute un Joueur à ta main', 'dessous'); },
  resPossible: x => x.P.club.length > 0
};

/* 084 La Chevalière — Lorsque vous déclenchez une attaque, vous pouvez bench
   cet Objet pour qu'elle coûte 2 Essences Neutres (le moteur le propose).
   Résilience : les prochaines attaques adverses de ce tour coûtent une
   Essence Neutre de plus. */
const CHEVALIERE_RES = {
  *resilience(x) { mod(x, { type: 'cout', payeur: adv(x.j), quand: 'toutes', neutrePlus: 1 }); }
};
S.c084 = Object.assign({ chevaliere: 'banc' }, CHEVALIERE_RES);

/* 085 Cooked — +30 Attaque. Résilience : ajoutez un Moment de votre
   défausse à votre main. */
S.c085 = {
  atk: 30,
  *resilience(x) {
    const cs = x.P.defausse.filter(estMoment);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Moment reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estMoment)
};

/* 086 En slip sur la Faille — Lorsque ce Joueur est engagé, vous pouvez
   bench cet Objet pour le désengager ; il ne peut plus attaquer ce tour.
   Résilience : vos Objets au Banc reviennent dans votre main. */
S.c086 = {
  sur: {
    *engage(x, d) {
      if (d.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'En slip sur la Faille', { oui: 'Bench et désengager', non: 'Garder', texte: 'Bench cet Objet pour désengager ce Joueur ? Il ne pourra plus attaquer ce tour.', carte: x.c.id, but: 'enSlip' })) {
        const p = x.porteur;
        O.bancer(x.E, x.c);
        mod(x, { type: 'pasAttaque', cible: p.u });
        yield* O.desengager(x.E, p);
      }
    }
  },
  *resilience(x) {
    const objs = x.P.banc.filter(estObjet);
    for (const o of objs) { prendre(x.P.banc, o); x.P.main.push(o); }
    if (objs.length) O.ev(x.E, { t: 'retourBanc', j: x.j, n: objs.length });
  },
  resPossible: x => x.P.banc.some(estObjet)
};

/* 087 Gros Bonnet — +30 Défense. Résilience : jouez cette carte. */
S.c087 = Object.assign({ def: 30 }, JOUER);

/* 088 M4 — +15 Attaque. Lorsque vous déclenchez une attaque avec ce Joueur,
   vous pouvez défausser jusqu'à 3 cartes : +10 Attaque par carte.
   Résilience : défaussez une carte et piochez une carte ; si c'est un
   Joueur, un Joueur adverse a -30 Attaque. */
S.c088 = {
  atk: 15,
  sur: {
    *attaque(x, X) {
      if (X.c !== x.porteur || !x.P.main.length || O.carte(X.c.id).atks[X.k].degats == null) return;
      const us = yield* O.choisirCartes(x.E, x.j, 'M4 — défausser pour +10 par carte ?', x.P.main.map(c => c.u), 0, 3, { zone: 'main', but: 'm4', texte: 'Jusqu\'à 3 cartes.' });
      if (us.length) { O.defausserMain(x.E, x.j, us); X.bonus += 10 * us.length; O.ev(x.E, { t: 'bonus', u: X.c.u, val: 10 * us.length }); }
    }
  },
  *resilience(x) {
    const [u] = yield* O.choisirCartes(x.E, x.j, 'Défausse une carte', x.P.main.map(c => c.u), 1, 1, { zone: 'main', but: 'defausse' });
    const c = x.P.main.find(z => z.u === u);
    O.defausserMain(x.E, x.j, [u]);
    piocher(x, 1);
    if (c && estJoueur(c)) {
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse a -30 Attaque ?', adverses(x), { but: 'affaiblirAdverse' });
      if (t) mod(x, { type: 'atk', cible: t.u, val: -30 });
    }
  },
  resPossible: x => x.P.main.length > 0
};

/* 089 La Luxueuse I — +10 Défense par Objet lié à ce Joueur (elle compte).
   Résilience : jouez cette carte. */
S.c089 = Object.assign({ def: (E, c) => 10 * c.obj.length }, JOUER);

/* 090 La Luxueuse II — Lorsque l'adversaire attaque cette ligne, mélangez une
   carte de votre défausse dans votre Club et piochez 1 carte. Résilience :
   jouez cette carte. */
function* luxueuse(x, X) {
  if (X.j === x.j || O.ligneDe(x.E, X.c) !== O.ligneDe(x.E, x.porteur)) return;
  const cs = x.P.defausse.slice();
  const t = yield* O.choisirUn(x.E, x.j, 'La Luxueuse — quelle carte remettre dans ton Club ?', cs, { zone: 'liste', montrer: cs, but: 'recycler' });
  if (t) { prendre(x.P.defausse, t); x.P.club.push(t); O.melanger(x.E, x.P.club); }
  piocher(x, 1);
}
S.c090 = Object.assign({ sur: { attaque: luxueuse } }, JOUER);

/* 091 C'est officiel ! — Votre adversaire choisit : vous piochez 3 cartes et
   il en pioche 2 ; ou il défausse 2 cartes et vous en défaussez 1.
   Résilience : jouez cette carte. */
S.c091 = Object.assign({
  *effet(x) {
    const v = yield* choixAdverse(x, 'C\'est officiel ! — à toi de choisir', `${x.P.nom} pioche 3, toi 2`, `Tu défausses 2, ${x.P.nom} 1`);
    if (v === 'a') { piocher(x, 3); O.piocher(x.E, adv(x.j), 2); }
    else {
      yield* defausserAuChoix(x, adv(x.j), 2, 'Défausse 2 cartes');
      yield* defausserAuChoix(x, x.j, 1, 'Défausse 1 carte');
    }
  }
}, JOUER);

/* 092 Clim — Bench un Objet adverse. Résilience : un Joueur adverse sans
   Objet ne peut plus attaquer jusqu'à la fin du tour. */
S.c092 = {
  *effet(x) { yield* bancerObjetAdverse(x); },
  jouable: x => objetsEnJeu(adv(x.j))(x.E).length > 0,
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne peut plus attaquer ?', adverses(x).filter(c => !c.obj.length && !c.eng), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u });
  },
  resPossible: x => adverses(x).some(c => !c.obj.length && !c.eng)
};

/* 093 Alerte Leak — Révélez vos PV. Résilience : jouez cette carte. */
S.c093 = Object.assign({
  *effet(x) { x.P.pvVus = true; O.ev(x.E, { t: 'revelePV', j: x.j, cartes: x.P.pv.map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 094 One More — Chaque fois que vous piochez ce tour, piochez une carte de
   plus. Résilience : votre adversaire doit déclencher une attaque de plus si
   possible. */
S.c094 = {
  *effet(x) { mod(x, { type: 'piochePlus', camp: x.j }); },
  *resilience(x) { x.E.cpt.doitAttaquer += 1; O.ev(x.E, { t: 'doitAttaquer', j: adv(x.j) }); }
};

/* 095 Tunnel — Si vous avez un Joueur seul sur sa ligne, piochez 2 cartes.
   Résilience : jouez cette carte. */
const seulSurSaLigne = x => joueurs(x).some(c => !x.A.lignes[O.ligneDe(x.E, c)]);
S.c095 = Object.assign({
  *effet(x) { if (seulSurSaLigne(x)) piocher(x, 2); },
  jouable: seulSurSaLigne
}, JOUER);

/* 096 Tweet la Défaite — La première fois que votre adversaire récupère un
   PV ce tour, les Joueurs adverses ont -20 Défense. Résilience : un Joueur
   adverse a -20 Attaque. */
S.c096 = {
  *effet(x) { mod(x, { type: 'guet', quand: 'recupPV', src: 'c096', nom: 'recup', camp: x.j }); },
  guets: {
    *recup(x, d) {
      if (d.j === x.guet.camp || x.guet.fini) return;
      x.guet.fini = true;
      O.mod(x.E, { type: 'def', camp: adv(x.guet.camp), val: -20 });
      O.ev(x.E, { t: 'malus', j: adv(x.guet.camp), def: -20 });
    }
  },
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse a -20 Attaque ?', adverses(x), { but: 'affaiblirAdverse' });
    if (t) mod(x, { type: 'atk', cible: t.u, val: -20 });
  },
  resPossible: x => adverses(x).length > 0
};

/* 097 Doig'Dance — La première attaque que vous déclenchez ce tour coûte 1
   Essence Neutre de moins. Résilience : 2 de vos Joueurs ont +20 Défense. */
S.c097 = {
  *effet(x) { mod(x, { type: 'cout', payeur: x.j, quand: 'premiere', neutreMoins: 1 }); },
  jouable: x => x.E.cpt.attaques === 0,
  *resilience(x) {
    const cs = joueurs(x);
    const us = yield* O.choisirCartes(x.E, x.j, '2 Joueurs à +20 Défense', cs.map(c => c.u), Math.min(2, cs.length), Math.min(2, cs.length), { zone: 'plateau', but: 'buffDef' });
    for (const u of us) mod(x, { type: 'def', cible: u, val: 20 });
  },
  resPossible: x => joueurs(x).length > 0
};

/* 098 Méta Cœurs — Mélangez 6 cartes Joueur de votre défausse dans votre
   Club (jusqu'à 6). Résilience : jouez cette carte. */
S.c098 = Object.assign({
  *effet(x) {
    const cs = x.P.defausse.filter(estJoueur).slice(0, 6);
    for (const c of cs) { prendre(x.P.defausse, c); x.P.club.push(c); }
    O.melanger(x.E, x.P.club);
    O.ev(x.E, { t: 'melangeClub', j: x.j, n: cs.length });
  },
  jouable: x => x.P.defausse.some(estJoueur)
}, JOUER);

/* 099 Méta F*ck — Révélez les 6 cartes du dessus, ajoutez un Moment à votre
   main, défaussez le reste. Résilience : jouez cette carte. */
S.c099 = Object.assign({
  *effet(x) { yield* revelerEtPrendre(x, 6, estMoment, 'Ajoute un Moment à ta main'); },
  jouable: x => x.P.club.length > 0
}, JOUER);

/* 101 Slay — Si ce Joueur est désengagé, l'attaquant face à lui doit le
   cibler. */
S.c101 = { provocSiLibre: true };

/* 102 Monster — ★ Vous pouvez engager 2 Essences pour piocher 2 cartes. */
S.c102 = {
  *entree(x) {
    if (O.essencesLibres(x.E, x.j).length < 2) return;
    if (yield* O.ouiNon(x.E, x.j, 'Monster', { oui: 'Engager 2 Essences', non: 'Non', texte: 'Engager 2 Essences pour piocher 2 cartes ?', carte: x.c.id, but: 'monster' })) {
      O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
      piocher(x, 2);
    }
  }
};

/* 103 Joueur de l'Ombre — Déclenchez l'effet d'entrée d'un Joueur de votre
   défausse (pas ceux qui parlent d'eux-mêmes : Calma, Instalock).
   Résilience : défaussez votre main et piochez autant de cartes. */
const ombreOk = c => estJoueur(c) && O.scr(c.id).entree && O.scr(c.id).ombre !== false;
S.c103 = {
  *effet(x) {
    const cs = x.P.defausse.filter(ombreOk);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel effet d\'entrée rejouer ?', cs, { zone: 'liste', montrer: cs, but: 'ombre' });
    if (t) { O.ev(x.E, { t: 'entree', j: x.j, u: t.u, id: t.id, ombre: true }); yield* O.scr(t.id).entree(Object.assign({}, x, { c: t })); }
  },
  jouable: x => x.P.defausse.some(ombreOk),
  *resilience(x) {
    const n = x.P.main.length;
    O.defausserMain(x.E, x.j, x.P.main.map(c => c.u));
    piocher(x, n);
  },
  resPossible: x => x.P.main.length > 0
};

/* 104 Lofi Girl — Désengagez un de vos Joueurs. Résilience : jouez cette
   carte. */
S.c104 = Object.assign({
  *effet(x) { yield* desengagerAllie(x); },
  jouable: x => joueurs(x).some(c => c.eng)
}, JOUER);

/* 105 M16 — +20 Attaque. Lorsque votre adversaire déclare un défenseur sur
   l'attaque de ce Joueur, révélez la carte du dessus de votre Club : si
   c'est un Joueur, +20 Attaque. Résilience : révélez la carte du dessus ; si
   c'est un Joueur, jouez-la. */
S.c105 = {
  atk: 20,
  sur: {
    *defense(x, X) {
      if (X.c !== x.porteur || !x.P.club.length) return;
      const c = x.P.club[0];
      O.ev(x.E, { t: 'revele', j: x.j, cartes: [{ u: c.u, id: c.id }] });
      if (estJoueur(c)) { X.bonus += 20; O.ev(x.E, { t: 'bonus', u: X.c.u, val: 20 }); }
    }
  },
  *resilience(x) {
    const c = x.P.club[0];
    O.ev(x.E, { t: 'revele', j: x.j, cartes: [{ u: c.u, id: c.id }] });
    if (estJoueur(c) && x.P.lignes.some(l => !l)) {
      x.P.club.shift();
      yield* O.deployer(x.E, x.j, c, null);
    }
  },
  resPossible: x => x.P.club.length > 0
};

/* 106 Trahison++ — Lorsque votre adversaire déclare un défenseur sur
   l'attaque de ce Joueur, vous pouvez bench cet Objet pour désengager ce
   Joueur et annuler l'attaque ; il ne peut plus attaquer ce tour.
   Résilience : un Joueur adverse ne peut plus attaquer ce tour. */
S.c106 = {
  sur: {
    *defense(x, X) {
      if (X.c !== x.porteur) return;
      if (yield* O.ouiNon(x.E, x.j, 'Trahison++', { oui: 'Annuler l\'attaque', non: 'Continuer', texte: 'Bench cet Objet pour désengager ce Joueur et annuler l\'attaque ?', carte: x.c.id, but: 'trahison' })) {
        const p = x.porteur;
        O.bancer(x.E, x.c);
        X.annulee = true;
        mod(x, { type: 'pasAttaque', cible: p.u });
        O.ev(x.E, { t: 'annule', u: p.u });
        yield* O.desengager(x.E, p);
      }
    }
  },
  *resilience(x) {
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur adverse ne peut plus attaquer ?', adverses(x).filter(c => !c.eng), { but: 'bloquerAdverse' });
    if (t) mod(x, { type: 'pasAttaque', cible: t.u });
  },
  resPossible: x => adverses(x).some(c => !c.eng)
};

/* 107 GP Explorer III — Engagez 2 Essences pour piocher 3 cartes.
   Résilience : désengagez 2 Essences. */
S.c107 = {
  *effet(x) {
    O.essencesLibres(x.E, x.j).slice(0, 2).forEach(e => O.engagerEssence(x.E, e));
    piocher(x, 3);
  },
  jouable: x => O.essencesLibres(x.E, x.j).length >= 2,
  *resilience(x) { yield* desengagerEssences(x, 2); },
  resPossible: x => x.P.ess.some(e => e.eng)
};

/* 108 Keynote — Renvoyez tous vos Joueurs dans la main de leur
   propriétaire. Résilience : ajoutez un Joueur de votre défausse à votre
   main. */
S.c108 = {
  *effet(x) { for (const c of joueurs(x).slice()) O.renvoyerMain(x.E, c); },
  jouable: x => joueurs(x).length > 0,
  *resilience(x) {
    const cs = x.P.defausse.filter(estJoueur);
    const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur reprendre ?', cs, { zone: 'liste', montrer: cs, but: 'ajouterMain' });
    if (t) { prendre(x.P.defausse, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id }); }
  },
  resPossible: x => x.P.defausse.some(estJoueur)
};

/* 109 Hatewatch — Bench un de vos Joueurs et votre adversaire défausse une
   carte. Résilience : jouez cette carte. */
S.c109 = Object.assign({
  *effet(x) {
    const t = yield* choisirAllie(x, 'Quel Joueur bench ?', null, 'bancerAllie');
    if (!t) return;
    O.bancer(x.E, t);
    yield* defausserAuChoix(x, adv(x.j), 1, 'Défausse une carte');
  },
  jouable: x => joueurs(x).length > 0
}, JOUER);

/* 110 Leakof — Regardez les 5 cartes du dessus du Club adverse.
   Résilience : jouez cette carte. */
S.c110 = Object.assign({
  *effet(x) { O.ev(x.E, { t: 'regarde', j: x.j, de: adv(x.j), cartes: x.A.club.slice(0, 5).map(c => ({ u: c.u, id: c.id })) }); }
}, JOUER);

/* 111 La Gaming House — La deuxième attaque que vous déclenchez ce tour
   coûte 2 Essences non neutres de moins. Résilience : vos Joueurs ont +10
   Défense jusqu'à la fin du tour. */
S.c111 = {
  *effet(x) { mod(x, { type: 'cout', payeur: x.j, quand: 'deuxieme', couleurMoins: 2 }); },
  jouable: x => x.E.cpt.attaques < 2,
  *resilience(x) { mod(x, { type: 'def', camp: x.j, val: 10 }); }
};

/* 112 M8 Résilience — ⚡ Lorsque le CEO adverse attaque cette ligne,
   piochez 1 carte. */
S.c112 = {
  sur: { *attaque(x, X) { if (X.j !== x.j && O.ligneDe(x.E, X.c) === O.ligneDe(x.E, x.c)) piocher(x, 1); } }
};

/* 113 Kampaï — ★ Si vous avez 3 Joueurs Roses, renvoyez un Joueur adverse
   dans sa main. */
S.c113 = {
  *entree(x) {
    if (joueurs(x).filter(c => O.carte(c.id).col === 'rose').length < 3) return;
    const t = yield* O.choisirUn(x.E, x.j, 'Renvoie un Joueur adverse en main', adverses(x), { but: 'renvoyerAdverse' });
    if (t) O.renvoyerMain(x.E, t);
  }
};

/* 114 SBG — Piochez 1 carte par Joueur adverse engagé. */
S.c114 = {
  *effet(x) { const n = adverses(x).filter(c => c.eng).length; if (n) piocher(x, n); },
  jouable: x => adverses(x).some(c => c.eng)
};

/* 122 La Luxueuse III — +10 Défense par Objet lié ; lorsque le CEO adverse
   attaque cette ligne, mélangez une carte de votre défausse dans votre Club
   et piochez 1 carte. */
S.c122 = { def: (E, c) => 10 * c.obj.length, sur: { attaque: luxueuse } };

/* ---------------------------------------------------------- Promos */
/* P01 / P02 Major de Paris — Cherchez 1 Joueur Mauve ou 1 Essence Mauve dans
   votre Club. Les Essences vivant dans la Réserve (règle 3.0), l'Essence
   Mauve se cherche là, et entre en jeu. */
S.p01 = S.p02 = {
  *effet(x) {
    const js = x.P.club.filter(c => estJoueur(c) && O.carte(c.id).col === 'mauve');
    const es = x.P.reserve.filter(e => e.coul === 'mauve');
    const opts = [];
    if (js.length) opts.push({ v: 'j', label: 'Un Joueur Mauve en main' });
    if (es.length) opts.push({ v: 'e', label: 'Une Essence Mauve en jeu' });
    if (!opts.length) return;
    const r = opts.length === 1 ? opts[0] : yield { qui: x.j, type: 'choix', but: 'major', titre: 'Major de Paris', carte: x.c.id, options: opts };
    if (r.v === 'j') {
      const t = yield* O.choisirUn(x.E, x.j, 'Quel Joueur Mauve ?', js, { zone: 'liste', montrer: js, but: 'ajouterMain' });
      if (t) { prendre(x.P.club, t); x.P.main.push(t); O.ev(x.E, { t: 'ajoute', j: x.j, u: t.u, id: t.id, montre: true }); }
      O.melanger(x.E, x.P.club);
    } else {
      const e = es[0];
      prendre(x.P.reserve, e);
      x.P.reserve.unshift(e);
      O.jouerReserve(x.E, x.j, false);
      O.melanger(x.E, x.P.reserve);
    }
  },
  jouable: x => x.P.club.some(c => estJoueur(c) && O.carte(c.id).col === 'mauve') || x.P.reserve.some(e => e.coul === 'mauve')
};

/* P05 Tout Commence Ici — Légion (version Promo) : il revient en main sans
   rien défausser. */
S.p05 = { legionGratuite: true };

/* U01 L'Unique Chevalière — comme La Chevalière, mais l'Objet est défaussé. */
S.u01 = Object.assign({ chevaliere: 'defausse' }, CHEVALIERE_RES);

Combat.scripts(S);

})(typeof globalThis !== 'undefined' ? globalThis : this);
