/* Road to Worlds — le moteur (prototype).

   Un roguelike à deck sur les cartes de l'extension, dans l'esprit de
   Balatro : une saison de quatre étapes (Qualifs, Ligue, Major, Worlds),
   trois matchs par étape, le dernier contre une équipe rivale qui impose
   une contrainte. À chaque manche, on pose jusqu'à cinq Joueurs de sa main ;
   ils forment une « formation » qui donne des Points et un Multi, les
   Joueurs comptés ajoutent leurs Points, le staff (Coachs et Objets)
   modifie le tout, et Points × Multi s'ajoute au score du match.

   Ce fichier ne touche pas à la page : il tourne aussi sous Node, pour
   simuler des parties et équilibrer (tools/run-sim.js). Tout le hasard
   passe par un générateur à graine rangé dans l'état : une partie se
   sauvegarde et se rejoue à l'identique.

   Rien ici n'est la règle du jeu de cartes Mate TCG : c'est un autre jeu,
   qui emprunte ses cartes. */
"use strict";

const M8R = (() => {
  /* ---------- Le hasard, à graine ---------- */
  /* mulberry32 : 32 bits d'état, assez pour un jeu, et sérialisable. */
  function alea(e) {
    e.r = (e.r + 0x6D2B79F5) | 0;
    let t = e.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entier = (e, n) => Math.floor(alea(e) * n);
  const choisir = (e, l) => l[entier(e, l.length)];
  function melanger(e, l) {
    for (let i = l.length - 1; i > 0; i--) {
      const j = entier(e, i + 1);
      [l[i], l[j]] = [l[j], l[i]];
    }
    return l;
  }
  /* Tirage pondéré : [[valeur, poids], …]. */
  function pondere(e, l) {
    const total = l.reduce((s, x) => s + x[1], 0);
    let x = alea(e) * total;
    for (const [v, p] of l) { if ((x -= p) < 0) return v; }
    return l[l.length - 1][0];
  }
  const graineDe = txt => {
    let h = 2166136261;
    for (const ch of String(txt)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h | 0;
  };

  /* ---------- Les cartes ---------- */
  const ESS = {
    rose: { nom: 'Rose', c: '#ee0073' }, orange: { nom: 'Orange', c: '#f77514' },
    jade: { nom: 'Jade', c: '#55e6a6' }, violette: { nom: 'Violette', c: '#8936ff' },
    jaune: { nom: 'Jaune', c: '#ffc73b' }, mauve: { nom: 'Mauve', c: '#ec8fff' },
    verte: { nom: 'Verte', c: '#9df244' }, bleue: { nom: 'Bleue', c: '#2f7fc9' },
    azur: { nom: 'Azur', c: '#39b8ff' }, neutre: { nom: 'Neutre', c: '#90b2a5' }
  };
  const RARS = { C: 'Commune', PC: 'Peu commune', R: 'Rare', E: 'Épique', L: 'Légendaire' };
  const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* Les Points d'un Joueur : sa première attaque chiffrée, divisée par dix. */
  function pointsDe(m) {
    const d = (m.attaques || []).map(a => a && a.degats).filter(x => x != null && x !== '');
    return d.length ? Math.max(1, Math.round(+d[0] / 10)) : 5;
  }

  let JOUEURS = [], PAR_NUM = {}, CARTES = {};
  function charger(data) {
    CARTES = {};
    data.forEach(m => { CARTES[m.num] = m; });
    JOUEURS = data.filter(m => m.categorie === 'Joueur').map(m => ({
      num: m.num, nom: m.nom, ess: sansAccent(m.couleur) in ESS ? sansAccent(m.couleur) : 'neutre',
      rar: m.rarete, pts: pointsDe(m), img: m.fichier
    }));
    PAR_NUM = {};
    JOUEURS.forEach(j => { PAR_NUM[j.num] = j; });
  }
  const joueur = num => PAR_NUM[num];
  const carte = num => CARTES[num];

  /* Le deck de départ : huit Communes et Peu communes, trois exemplaires de
     chacune. Six Essences : de quoi viser une Synergie ou un Roster. */
  const DEPART = [10, 13, 52, 51, 73, 29, 39, 62];

  /* ---------- Les formations ---------- */
  /* Du plus fort au plus faible : la première qui tient l'emporte. `lvl` :
     ce qu'un Moment d'entraînement ajoute par niveau. */
  const FORMES = [
    { id: 'quintuple', nom: 'Quintuplé',     base: 120, multi: 12, lvl: [40, 4], dit: '5 exemplaires de la même carte' },
    { id: 'carre',     nom: 'Carré',         base: 60,  multi: 7,  lvl: [30, 3], dit: '4 exemplaires de la même carte' },
    { id: 'full',      nom: 'Full squad',    base: 40,  multi: 4,  lvl: [25, 2], dit: 'Un Triplé et un Doublé' },
    { id: 'synergie',  nom: 'Synergie',      base: 35,  multi: 4,  lvl: [15, 2], dit: '5 Joueurs de la même Essence' },
    { id: 'roster',    nom: 'Roster',        base: 30,  multi: 4,  lvl: [30, 3], dit: '5 Joueurs de 5 Essences différentes' },
    { id: 'triple',    nom: 'Triplé',        base: 30,  multi: 3,  lvl: [20, 2], dit: '3 exemplaires de la même carte' },
    { id: 'ddouble',   nom: 'Double doublé', base: 20,  multi: 2,  lvl: [20, 1], dit: 'Deux Doublés' },
    { id: 'double',    nom: 'Doublé',        base: 10,  multi: 2,  lvl: [15, 1], dit: '2 exemplaires de la même carte' },
    { id: 'solo',      nom: 'Solo',          base: 5,   multi: 1,  lvl: [10, 1], dit: 'Ta meilleure carte, seule' }
  ];
  const FORME = Object.fromEntries(FORMES.map(f => [f.id, f]));

  /* La formation d'un coup, et les cartes qui comptent (les autres sont
     posées pour rien, comme au poker). `jouees` : instances { uid, num }. */
  function detecter(jouees) {
    const parNum = {};
    jouees.forEach(c => (parNum[c.num] = parNum[c.num] || []).push(c));
    const groupes = Object.values(parNum).sort((a, b) => b.length - a.length);
    const n = groupes.map(g => g.length);
    const ess = new Set(jouees.map(c => joueur(c.num).ess));
    const cinq = jouees.length === 5;
    let id, comptees;
    if (cinq && n[0] === 5) { id = 'quintuple'; comptees = jouees; }
    else if (n[0] >= 4) { id = 'carre'; comptees = groupes[0].slice(0, 4); }
    else if (cinq && n[0] === 3 && n[1] === 2) { id = 'full'; comptees = jouees; }
    else if (cinq && ess.size === 1) { id = 'synergie'; comptees = jouees; }
    else if (cinq && ess.size === 5) { id = 'roster'; comptees = jouees; }
    else if (n[0] === 3) { id = 'triple'; comptees = groupes[0]; }
    else if (n[0] === 2 && n[1] === 2) { id = 'ddouble'; comptees = groupes[0].concat(groupes[1]); }
    else if (n[0] === 2) { id = 'double'; comptees = groupes[0]; }
    else {
      id = 'solo';
      comptees = jouees.length ? [jouees.slice().sort((a, b) => joueur(b.num).pts - joueur(a.num).pts)[0]] : [];
    }
    /* Ce que la main « contient », pour le staff : un Triplé contient un
       Doublé, un Full les deux. */
    const contient = {
      double: n[0] >= 2, triple: n[0] >= 3,
      synergie: cinq && ess.size === 1, roster: cinq && ess.size === 5
    };
    /* Les comptées dans l'ordre où elles ont été posées. */
    const garde = new Set(comptees.map(c => c.uid));
    return { id, comptees: jouees.filter(c => garde.has(c.uid)), contient };
  }

  /* ---------- Le staff : Coachs et Objets ---------- */
  /* Cinq places. Chaque entrée reprend une carte de l'extension pour son
     image ; son effet est propre à ce jeu. `carte` : par Joueur compté ;
     `main` : une fois par coup ; les autres champs jouent hors du calcul. */
  const STAFF = [
    { id: 'barakataga', num: 82, prix: 4, txt: '+4 Multi', main: c => c.plusMulti(4) },
    { id: 'grosbonnet', num: 87, prix: 4, txt: '+30 Points', main: c => c.plusPoints(30) },
    { id: 'zacking', num: 14, prix: 5, txt: 'Chaque Joueur compté : +3 Points', carte: (c, j) => c.plusPoints(3) },
    { id: 'm16', num: 105, prix: 6, txt: 'Chaque Joueur compté : +1 Multi', carte: (c, j) => c.plusMulti(1) },
    { id: 'ravrose', num: 15, prix: 5, txt: 'Chaque Joueur Rose compté : +3 Multi', carte: (c, j) => j.ess === 'rose' && c.plusMulti(3) },
    { id: 'ravmauve', num: 53, prix: 5, txt: 'Chaque Joueur Mauve compté : +3 Multi', carte: (c, j) => j.ess === 'mauve' && c.plusMulti(3) },
    { id: 'slip', num: 86, prix: 4, txt: 'Chaque Joueur Neutre compté : +12 Points', carte: (c, j) => j.ess === 'neutre' && c.plusPoints(12) },
    { id: 'jus', num: 65, prix: 4, txt: '+8 Multi si le coup contient un Doublé', main: c => c.f.contient.double && c.plusMulti(8) },
    { id: 'm4', num: 88, prix: 6, txt: '×3 Multi si le coup contient un Triplé', main: c => c.f.contient.triple && c.foisMulti(3) },
    { id: 'chevaliere', num: 84, prix: 6, txt: '×2 Multi si Synergie', main: c => c.f.contient.synergie && c.foisMulti(2) },
    { id: 'invitation', num: 32, prix: 6, txt: '×3 Multi si Roster', main: c => c.f.contient.roster && c.foisMulti(3) },
    { id: 'cooked', num: 85, prix: 5, txt: '+12 Multi si tu poses 3 cartes ou moins', main: c => c.jouees.length <= 3 && c.plusMulti(12) },
    { id: 'pause', num: 26, prix: 8, txt: '×3 Multi à la dernière manche du match', main: c => c.derniere && c.foisMulti(3) },
    { id: 'ombre', num: 103, prix: 6, txt: '+25 Points par remplacement restant', main: c => c.e.m.remplacements && c.plusPoints(25 * c.e.m.remplacements) },
    { id: 'lux2', num: 90, prix: 5, txt: '+2 Points par $ que tu as', main: c => c.e.argent > 0 && c.plusPoints(2 * c.e.argent) },
    { id: 'coach', num: 31, prix: 4, txt: '+3 Multi par Coach dans ton staff', main: c => c.plusMulti(3 * c.e.staff.filter(s => carte(STAFF_ID[s.id].num).categorie === 'Coach').length) },
    { id: 'm24', num: 46, prix: 6, txt: 'Gagne +1 Multi à chaque coup qui contient un Doublé', val: 0,
      avant: (c, s) => { if (c.f.contient.double) s.val++; }, main: (c, s) => s.val && c.plusMulti(s.val), etat: s => `actuel : +${s.val}` },
    { id: 'trahison', num: 106, prix: 5, txt: '+20 Multi, mais −4 à chaque manche jouée', val: 20,
      main: (c, s) => s.val > 0 && c.plusMulti(s.val), apres: (e, s) => { s.val -= 4; }, etat: s => `actuel : +${Math.max(0, s.val)}` },
    { id: 'm25', num: 36, prix: 7, txt: 'Chaque Épique ou Légendaire comptée : ×1,5 Multi', carte: (c, j) => (j.rar === 'E' || j.rar === 'L') && c.foisMulti(1.5) },
    { id: 'maudit', num: 56, prix: 5, txt: '×3 Multi, mais une manche de moins par match', main: c => c.foisMulti(3), manches: -1 },
    { id: 'lyon', num: 30, prix: 6, txt: '+1 manche par match', manches: 1 },
    { id: 'japon', num: 70, prix: 5, txt: '+1 remplacement par match', remplacements: 1 },
    { id: 'lofi', num: 104, prix: 7, txt: '+1 carte en main', main_taille: 1 },
    { id: 'lux1', num: 89, prix: 4, txt: '+4 $ à la fin de chaque match', gain: 4 },
    { id: 'mercato', num: 83, prix: 4, txt: 'Les Joueurs de la boutique coûtent 2 $ de moins' },
    { id: 'lux3', num: 122, prix: 10, txt: '×4 Multi', main: c => c.foisMulti(4) }
  ];
  const STAFF_ID = Object.fromEntries(STAFF.map(s => [s.id, s]));
  const PLACES = 5;

  /* ---------- Les Moments : l'entraînement d'une formation ---------- */
  const MOMENTS = [
    { forme: 'solo', num: 92 }, { forme: 'double', num: 97 }, { forme: 'ddouble', num: 94 },
    { forme: 'triple', num: 99 }, { forme: 'roster', num: 95 }, { forme: 'synergie', num: 98 },
    { forme: 'full', num: 108 }, { forme: 'carre', num: 107 }, { forme: 'quintuple', num: 115 }
  ];

  /* ---------- La saison ---------- */
  const ETAPES = [
    { nom: 'Qualifs', base: 300 },
    { nom: 'Ligue', base: 800 },
    { nom: 'Major', base: 2200 },
    { nom: 'Worlds', base: 6500 }
  ];
  const MATCHS = [
    { nom: 'Match amical', fois: 1, gain: 3 },
    { nom: 'Match officiel', fois: 1.5, gain: 4 },
    { nom: 'Équipe rivale', fois: 2, gain: 5 }
  ];
  /* Les rivaux : des équipes inventées, chacune avec sa contrainte. */
  const RIVAUX = [
    { id: 'corbeaux', nom: 'Les Corbeaux', txt: 'Les Joueurs Rose ne comptent pas.', muet: j => j.ess === 'rose' },
    { id: 'phantom', nom: 'Phantom', txt: 'Les Joueurs Neutre ne comptent pas.', muet: j => j.ess === 'neutre' },
    { id: 'eclipse', nom: 'Éclipse', txt: 'Les Joueurs Mauve ne comptent pas.', muet: j => j.ess === 'mauve' },
    { id: 'neon', nom: 'Team Néon', txt: 'Une manche de moins.', manches: -1 },
    { id: 'kraken', nom: 'Kraken', txt: 'Une carte de moins en main.', main_taille: -1 },
    { id: 'titans', nom: 'Les Titans', txt: 'Les Doublés et Double doublés ne marquent rien.', nul: f => f === 'double' || f === 'ddouble' },
    { id: 'mur', nom: 'Le Mur', txt: 'Objectif encore plus haut (×1,5).', cible: 1.5 }
  ];
  const FINALE = { id: 'invaincus', nom: 'Les Invaincus', txt: 'Chaque manche doit poser 5 cartes.', cinq: true };

  /* ---------- Une partie ---------- */
  function nouvellePartie(graine) {
    const e = {
      v: 1, graine: String(graine), r: graineDe(graine),
      etape: 0, match: 0, argent: 4,
      deck: [], uid: 0,
      staff: [],
      niveaux: Object.fromEntries(FORMES.map(f => [f.id, 1])),
      stats: { meilleur: 0, manches: 0, formes: {} },
      fini: null, m: null, shop: null
    };
    DEPART.forEach(num => { for (let i = 0; i < 3; i++) e.deck.push({ uid: ++e.uid, num }); });
    const rivaux = melanger(e, RIVAUX.slice());
    e.rivaux = [rivaux[0].id, rivaux[1].id, rivaux[2].id, FINALE.id];
    return e;
  }

  const rival = e => { const id = e.rivaux[e.etape]; return id === FINALE.id ? FINALE : RIVAUX.find(r => r.id === id); };
  const rivalDuMatch = e => (e.match === 2 ? rival(e) : null);
  const cibleDe = (e, etape, match) => {
    let c = ETAPES[etape].base * MATCHS[match].fois;
    if (match === 2 && rival({ rivaux: e.rivaux, etape }).cible) c *= rival({ rivaux: e.rivaux, etape }).cible;
    return Math.round(c);
  };
  const somme = (e, champ) => e.staff.reduce((s, x) => s + (STAFF_ID[x.id][champ] || 0), 0);

  function debutMatch(e) {
    const r = rivalDuMatch(e);
    const manches = Math.max(1, 4 + somme(e, 'manches') + (r && r.manches || 0));
    e.m = {
      cible: cibleDe(e, e.etape, e.match), score: 0,
      manches, remplacements: Math.max(0, 3 + somme(e, 'remplacements')),
      taille: Math.max(4, 8 + somme(e, 'main_taille') + (r && r.main_taille || 0)),
      pioche: melanger(e, e.deck.map(c => ({ uid: c.uid, num: c.num }))),
      main: [], dernier: null
    };
    piocher(e);
    return e.m;
  }

  function piocher(e) {
    const m = e.m;
    while (m.main.length < m.taille && m.pioche.length) m.main.push(m.pioche.pop());
  }

  /* ---------- Le calcul d'un coup ---------- */
  /* Rend le détail, dans l'ordre où l'écran le rejoue : la formation, chaque
     Joueur compté, chaque membre du staff, puis le total. */
  function calculer(e, jouees) {
    const f = detecter(jouees);
    /* Sur une copie du staff : un calcul pour voir (l'aperçu, le bot) ne
       doit rien changer. jouer() reprend la copie. */
    const staff = e.staff.map(s => Object.assign({}, s));
    const forme = FORME[f.id];
    const niv = e.niveaux[f.id];
    const r = rivalDuMatch(e);
    const ctx = {
      e, f, jouees,
      points: forme.base + (niv - 1) * forme.lvl[0],
      multi: forme.multi + (niv - 1) * forme.lvl[1],
      derniere: e.m.manches === 1,
      pas: [], source: null,
      plusPoints(n) { this.points += n; this.pas.push({ de: this.source, pts: n }); },
      plusMulti(n) { this.multi += n; this.pas.push({ de: this.source, multi: n }); },
      foisMulti(n) { this.multi *= n; this.pas.push({ de: this.source, fois: n }); }
    };
    const depart = { forme: f.id, niveau: niv, points: ctx.points, multi: ctx.multi };

    /* Les Doublés valent zéro contre les Titans. */
    if (r && r.nul && r.nul(f.id)) {
      return { forme: f.id, niveau: niv, depart, comptees: [], pas: [{ de: { rival: r.id }, nul: true }], points: 0, multi: 0, total: 0, f, staff };
    }

    /* Le staff qui évolue avant de compter (Maillot Champions '24). */
    staff.forEach(s => { const d = STAFF_ID[s.id]; if (d.avant) d.avant(ctx, s); });

    f.comptees.forEach(c => {
      const j = joueur(c.num);
      if (r && r.muet && r.muet(j)) { ctx.pas.push({ de: { carte: c.uid }, muet: true }); return; }
      ctx.source = { carte: c.uid };
      ctx.plusPoints(j.pts);
      if (j.rar === 'R') ctx.plusMulti(2);
      if (j.rar === 'E') ctx.plusMulti(4);
      if (j.rar === 'L') ctx.foisMulti(1.5);
      staff.forEach((s, i) => {
        const d = STAFF_ID[s.id];
        if (!d.carte) return;
        ctx.source = { staff: i, carte: c.uid };
        d.carte(ctx, j, s);
      });
    });
    staff.forEach((s, i) => {
      const d = STAFF_ID[s.id];
      if (!d.main) return;
      ctx.source = { staff: i };
      d.main(ctx, s);
    });
    const total = Math.floor(ctx.points * ctx.multi);
    return { forme: f.id, niveau: niv, depart, comptees: f.comptees.map(c => c.uid), pas: ctx.pas, points: ctx.points, multi: ctx.multi, total, f, staff };
  }

  /* ---------- Jouer, remplacer ---------- */
  function prendre(e, uids) {
    const m = e.m;
    const pris = uids.map(u => m.main.find(c => c.uid === u)).filter(Boolean);
    m.main = m.main.filter(c => !uids.includes(c.uid));
    return pris;
  }

  function peutJouer(e, uids) {
    if (!e.m || !uids.length || uids.length > 5) return 'Choisis de 1 à 5 cartes.';
    const r = rivalDuMatch(e);
    if (r && r.cinq && uids.length !== 5 && e.m.main.length >= 5) return 'Les Invaincus : pose 5 cartes.';
    return null;
  }

  /* Un coup : le calcul, le score, la pioche, et l'issue du match. */
  function jouer(e, uids) {
    const refus = peutJouer(e, uids);
    if (refus) throw new Error(refus);
    const jouees = uids.map(u => e.m.main.find(c => c.uid === u)).filter(Boolean);
    const res = calculer(e, jouees);
    prendre(e, uids);
    e.staff = res.staff;
    e.m.score += res.total;
    e.m.manches--;
    e.m.dernier = res;
    e.stats.manches++;
    e.stats.meilleur = Math.max(e.stats.meilleur, res.total);
    e.stats.formes[res.forme] = (e.stats.formes[res.forme] || 0) + 1;
    e.staff.forEach(s => { const d = STAFF_ID[s.id]; if (d.apres) d.apres(e, s); });
    /* Trahison++ s'en va quand elle n'apporte plus rien. */
    e.staff = e.staff.filter(s => !(s.id === 'trahison' && s.val <= 0));
    piocher(e);
    res.issue = e.m.score >= e.m.cible ? 'gagne' : e.m.manches <= 0 || !e.m.main.length ? 'perdu' : null;
    if (res.issue === 'perdu') e.fini = { victoire: false, etape: e.etape, match: e.match };
    return res;
  }

  function remplacer(e, uids) {
    if (!e.m || !uids.length || uids.length > 5) throw new Error('Choisis de 1 à 5 cartes.');
    if (e.m.remplacements <= 0) throw new Error('Plus de remplacement pour ce match.');
    prendre(e, uids);
    e.m.remplacements--;
    piocher(e);
  }

  /* ---------- Fin de match : le cash prize ---------- */
  function finMatch(e) {
    const m = e.m;
    const lignes = [{ txt: MATCHS[e.match].nom + ' gagné', $: MATCHS[e.match].gain }];
    if (m.manches > 0) lignes.push({ txt: `${m.manches} manche${m.manches > 1 ? 's' : ''} non jouée${m.manches > 1 ? 's' : ''}`, $: m.manches });
    const interets = Math.min(5, Math.floor(e.argent / 5));
    if (interets) lignes.push({ txt: 'Intérêts (1 $ par tranche de 5 $)', $: interets });
    e.staff.forEach(s => { const d = STAFF_ID[s.id]; if (d.gain) lignes.push({ txt: carte(d.num).nom, $: d.gain }); });
    const total = lignes.reduce((s, l) => s + l.$, 0);
    e.argent += total;
    e.m = null;
    /* Match suivant, ou étape suivante, ou titre. */
    if (e.match === 2 && e.etape === ETAPES.length - 1) {
      e.fini = { victoire: true, etape: e.etape, match: e.match };
    } else if (e.match === 2) { e.etape++; e.match = 0; }
    else e.match++;
    if (!e.fini) ouvrirBoutique(e);
    return { lignes, total };
  }

  /* ---------- La boutique ---------- */
  const PRIX_JOUEUR = { C: 3, PC: 4, R: 5, E: 7, L: 9 };
  const POIDS_RAR = [
    [['C', 50], ['PC', 35], ['R', 15]],
    [['C', 25], ['PC', 35], ['R', 28], ['E', 12]],
    [['PC', 25], ['R', 35], ['E', 30], ['L', 10]],
    [['PC', 15], ['R', 30], ['E', 35], ['L', 20]]
  ];
  const POIDS_STAFF = { C: 50, PC: 30, R: 15, E: 6, L: 2 };

  const prixJoueur = (e, j) => Math.max(1, PRIX_JOUEUR[j.rar] - (e.staff.some(s => s.id === 'mercato') ? 2 : 0));

  function offresStaff(e) {
    const dispo = STAFF.filter(s => !e.staff.some(x => x.id === s.id));
    const l = [];
    for (let i = 0; i < 2 && dispo.length; i++) {
      const s = pondere(e, dispo.map(d => [d, POIDS_STAFF[carte(d.num).rarete] || 10]));
      dispo.splice(dispo.indexOf(s), 1);
      l.push({ type: 'staff', id: s.id, prix: s.prix });
    }
    return l;
  }
  function offresJoueurs(e) {
    const l = [];
    for (let i = 0; i < 2; i++) {
      const rar = pondere(e, POIDS_RAR[Math.min(e.etape, POIDS_RAR.length - 1)]);
      const pool = JOUEURS.filter(j => j.rar === rar);
      const j = choisir(e, pool.length ? pool : JOUEURS);
      l.push({ type: 'joueur', num: j.num, prix: prixJoueur(e, j) });
    }
    return l;
  }
  function offreMoment(e) {
    const mo = choisir(e, MOMENTS);
    return { type: 'moment', forme: mo.forme, num: mo.num, prix: 3 };
  }

  function ouvrirBoutique(e) {
    e.shop = { offres: offresStaff(e).concat(offresJoueurs(e), [offreMoment(e)]), relance: 5 };
  }

  function relancer(e) {
    if (e.argent < e.shop.relance) throw new Error('Pas assez de $.');
    e.argent -= e.shop.relance;
    e.shop.relance++;
    e.shop.offres = offresStaff(e).concat(offresJoueurs(e), [offreMoment(e)]);
  }

  function acheter(e, i) {
    const o = e.shop.offres[i];
    if (!o || o.vendu) throw new Error('Plus disponible.');
    if (e.argent < o.prix) throw new Error('Pas assez de $.');
    if (o.type === 'staff' && e.staff.length >= PLACES) throw new Error('Staff complet : vends quelqu\'un d\'abord.');
    e.argent -= o.prix;
    o.vendu = true;
    if (o.type === 'staff') {
      const d = STAFF_ID[o.id];
      e.staff.push({ id: o.id, val: d.val != null ? d.val : null, prix: o.prix });
    } else if (o.type === 'joueur') e.deck.push({ uid: ++e.uid, num: o.num });
    else if (o.type === 'moment') e.niveaux[o.forme]++;
    return o;
  }

  function vendre(e, i) {
    const s = e.staff[i];
    if (!s) return 0;
    const v = Math.max(1, Math.floor(s.prix / 2));
    e.argent += v;
    e.staff.splice(i, 1);
    return v;
  }

  /* Les services : recruter un double d'un Joueur du deck, ou en libérer un. */
  const PRIX_DOUBLE = 5, PRIX_LIBERER = 3, DECK_MIN = 12;
  function doubler(e, uid) {
    const c = e.deck.find(x => x.uid === uid);
    if (!c) throw new Error('Carte introuvable.');
    if (e.argent < PRIX_DOUBLE) throw new Error('Pas assez de $.');
    e.argent -= PRIX_DOUBLE;
    e.deck.push({ uid: ++e.uid, num: c.num });
  }
  function liberer(e, uid) {
    if (e.deck.length <= DECK_MIN) throw new Error(`Il te faut au moins ${DECK_MIN} cartes.`);
    if (e.argent < PRIX_LIBERER) throw new Error('Pas assez de $.');
    const i = e.deck.findIndex(x => x.uid === uid);
    if (i < 0) throw new Error('Carte introuvable.');
    e.argent -= PRIX_LIBERER;
    e.deck.splice(i, 1);
  }

  return {
    ESS, RARS, FORMES, FORME, STAFF, STAFF_ID, MOMENTS, ETAPES, MATCHS, RIVAUX, FINALE, PLACES,
    PRIX_DOUBLE, PRIX_LIBERER, DECK_MIN,
    charger, joueur, carte, joueurs: () => JOUEURS,
    nouvellePartie, debutMatch, detecter, calculer, jouer, remplacer, peutJouer, finMatch,
    ouvrirBoutique, relancer, acheter, vendre, doubler, liberer,
    rival, rivalDuMatch, cibleDe, graineDe
  };
})();

if (typeof module !== 'undefined') module.exports = M8R;
