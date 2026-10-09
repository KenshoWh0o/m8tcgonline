/* Le Circuit — le moteur.

   Un jeu à part, construit sur les cartes de l'extension et sur ce qu'elles
   portent déjà : la Défense d'un Joueur est sa résistance, ses attaques
   coûtent les Essences imprimées et font les dégâts imprimés, ses mots-clés
   (Provocation, Shield, Garde, Riposte, Légion, Buff) et, quand c'est
   possible, sa Signature, jouent ici aussi. Ce n'est pas la règle officielle
   du jeu de cartes : c'est une lecture, pour un jeu solo.

   Un match se joue en deux manches gagnantes (BO3). Une manche : deux
   équipes de cinq, trois sur le terrain, deux sur le banc. À chaque tour,
   on tire des Essences de sa Réserve ; chaque Joueur peut agir une fois,
   s'il peut payer. Mettre un Joueur adverse hors jeu rapporte un PV ; le
   premier à 3 PV prend la manche. Entre deux manches, tout le monde repart
   frais, on peut changer ses titulaires, et l'équipe qui a perdu commence.

   Une saison : trois tournois (Qualifs, Major, Worlds), en double
   élimination — une défaite envoie au tableau des perdants, la seconde
   élimine. Entre les matchs, on recrute, on équipe des Objets, on garde des
   Moments pour les coups durs, on enrichit sa Réserve.

   Ce fichier n'a pas d'interface : il tourne aussi sous Node (simulations
   d'équilibrage, tools/circuit-sim.js). Tout le hasard passe par un
   générateur à graine rangé dans l'état. */
"use strict";

const CIRCUIT = (() => {
  /* ---------- Le hasard ---------- */
  function alea(s) {
    s.r = (s.r + 0x6D2B79F5) | 0;
    let t = s.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entier = (s, n) => Math.floor(alea(s) * n);
  const choisir = (s, l) => l[entier(s, l.length)];
  function melanger(s, l) {
    for (let i = l.length - 1; i > 0; i--) { const j = entier(s, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  }
  function pondere(s, l) {
    const tot = l.reduce((a, x) => a + x[1], 0);
    let x = alea(s) * tot;
    for (const [v, p] of l) if ((x -= p) < 0) return v;
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
    azur: { nom: 'Azur', c: '#39b8ff' }
  };
  const COULEURS = Object.keys(ESS);
  const RARS = { C: 'Commune', PC: 'Peu commune', R: 'Rare', E: 'Épique', L: 'Légendaire' };
  const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let JOUEURS = [], J = {}, CARTES = {};
  function charger(data) {
    CARTES = {};
    data.forEach(m => { CARTES[m.num] = m; });
    JOUEURS = data.filter(m => m.categorie === 'Joueur').map(m => {
      const ess = sansAccent(m.couleur);
      const atks = (m.attaques || []).map(a => {
        const cout = {};
        Object.entries(a.cout || {}).forEach(([k, v]) => { const c = sansAccent(k); cout[c in ESS ? c : 'neutre'] = (cout[c in ESS ? c : 'neutre'] || 0) + (+v || 0); });
        return { nom: a.nom, cout, degats: a.degats == null || a.degats === '' ? null : +a.degats, effet: a.effet || '', plus: !!a.plus };
      });
      const kw = m.mot_cle && m.mot_cle.nom ? { nom: m.mot_cle.nom, texte: m.mot_cle.texte || '' } : null;
      return { num: m.num, nom: m.nom, ess: ess in ESS ? ess : 'neutre', rar: m.rarete, def: +m.def || 100, atks, kw, img: m.fichier, ambiance: m.ambiance || '' };
    });
    J = {};
    JOUEURS.forEach(j => { J[j.num] = j; });
  }
  const joueur = num => J[num];
  const carte = num => CARTES[num];

  /* ---------- Les mots-clés, lus pour ce jeu ---------- */
  /* Le texte que l'écran affiche, et les effets : la carte imprimée dit
     l'intention, ceci dit comment elle joue ici. */
  const MOTS = {
    Provocation: 'Les attaques adverses doivent le viser.',
    Shield: 'Ignore la première attaque qu\'il subit dans le match.',
    Garde: 'Une fois par tour adverse, détourne sur lui une attaque visant un autre de tes Joueurs.',
    Riposte: 'Mis hors jeu, il frappe son attaquant avec sa première attaque.',
    'Légion': 'Mis hors jeu, il revient une fois sur le banc avec toute sa Défense.'
  };
  /* Buff : le texte imprimé dit le bonus (« +10 Attaque », « +10 Défense »). */
  function buffDe(j) {
    if (!j.kw || j.kw.nom !== 'Buff') return null;
    const m = /\+(\d+)\s*(Attaque|Défense)/i.exec(j.kw.texte);
    return m ? { n: +m[1], quoi: /att/i.test(m[2]) ? 'atk' : 'def' } : null;
  }

  /* Les Signatures qui ont un sens ici, carte par carte. Le texte est notre
     lecture ; les autres Signatures n'ont pas d'effet dans le Circuit. */
  const SIGNATURES = {
    12: 'En entrant sur le terrain, engage le meilleur attaquant adverse.',
    13: null, 40: null,
    44: 'Au début de ton tour, si tu as au moins 2 PV : +1 Essence.',
    50: 'Au début de ton tour, renvoie au banc un Joueur adverse engagé sans Provocation.',
    62: 'Si tu as moins de 2 PV, son attaque est doublée.',
    63: 'Ses attaques ignorent Shield et Garde.',
    68: 'Si 1% Chance est sur le terrain, il gagne Provocation et Shield.',
    77: 'Mis hors jeu : +1 Essence.',
    79: 'Peut s\'engager pour renvoyer au banc un Joueur adverse.',
    101: 'Tant qu\'il n\'est pas engagé, les attaques adverses doivent le viser.',
    102: 'Peut défausser 2 Essences pour en tirer 2 autres.',
    112: 'Quand il est attaqué : +1 Essence.',
    113: 'Au début de ton tour, avec 3 Joueurs Rose sur le terrain, renvoie au banc un Joueur adverse.',
    117: 'En entrant sur le terrain : +3 Essences.'
  };
  /* Les effets d'attaque, lus de leur texte imprimé. */
  function effetDe(atk) {
    const t = sansAccent(atk.effet);
    if (!t) return null;
    if (t.includes('engagez un joueur adverse')) return { type: 'engage' };
    if (t.includes('par joueur engage')) return { type: 'parEngage', n: 10 };
    if (t.includes('objet lie')) return { type: 'parObjet', n: +((/\+(\d+)/.exec(t) || [])[1] || 10) };
    if (t.includes('pv que vous avez')) return { type: 'parPV', n: 10 };
    if (t.includes('essence jaune')) return { type: 'parJaune', n: 20 };
    if (t.includes('carte que vous avez en main')) return { type: 'parEssence', n: 20 };
    if (t.includes('desengagez un autre')) return { type: 'desengage' };
    if (t.includes('si l\'adversaire a recupere un pv')) return { type: 'vengeance', n: 100 };
    if (t.includes('bench un joueur adverse')) return { type: 'bench', mauves: (/(\d+) de vos essences mauves/.exec(t) || [0, 1])[1] | 0 || 1 };
    if (t.includes('essences mauves dans votre reserve')) return { type: 'mauves', n: +((/melangez (\d+)/.exec(t) || [])[1] || 1) };
    if (t.includes('essence mauve dans votre reserve')) return { type: 'mauves', n: 1 };
    if (t.includes('ajoutez ce joueur a votre main')) return { type: 'repli' };
    if (t.includes('regardez les 4 cartes')) return { type: 'tirer', n: 1 };
    if (t.includes('ajoutez une carte joueur')) return { type: 'tirer', n: 2 };
    return null;
  }
  const TEXTE_EFFET = {
    engage: 'Engage la cible : elle ne pourra pas agir à son prochain tour.',
    parEngage: '+10 par Joueur engagé sur le terrain.',
    parObjet: n => `+${n} par Objet lié à ce Joueur.`,
    parPV: '+10 par PV que tu as.',
    parJaune: '+20 par Essence Jaune dans ta réserve du tour.',
    parEssence: '+20 par Essence qu\'il te reste.',
    desengage: 'Désengage un autre de tes Joueurs.',
    vengeance: '+100 si l\'adversaire a marqué un PV à son dernier tour.',
    bench: 'Renvoie la cible au banc, et ajoute des Essences Mauves à ta Réserve.',
    mauves: n => `Ajoute ${n} Essence${n > 1 ? 's' : ''} Mauve${n > 1 ? 's' : ''} à ta Réserve.`,
    repli: 'Après l\'attaque, il passe au banc et le premier remplaçant entre.',
    tirer: n => `+${n} Essence${n > 1 ? 's' : ''}.`
  };
  function texteEffet(atk) {
    const e = effetDe(atk);
    if (!e) return '';
    const t = TEXTE_EFFET[e.type];
    return typeof t === 'function' ? t(e.n) : t;
  }

  /* ---------- Coachs, Objets, Moments ---------- */
  /* Chacun reprend une carte de l'extension : son illustration, son nom, et
     un effet écrit pour ce jeu, dans l'esprit de la carte. */
  const COACHS = [
    { id: 'zacking', num: 14, txt: 'Au premier tour de chaque match, tes Joueurs ont +30 Attaque.' },
    { id: 'barakataga', num: 82, txt: 'Tes Joueurs ont +20 Défense.' },
    { id: 'lyon', num: 30, txt: 'Tu commences chaque match avec 3 Essences de plus.' },
    { id: 'lofi', num: 104, txt: 'Tes Joueurs au banc récupèrent 50 Défense par tour, au lieu de 20.' },
    { id: 'ombre', num: 103, txt: 'Tes attaques contre un Joueur engagé infligent +40.' },
    { id: 'pause', num: 26, txt: 'Une fois par match : désengage tes Joueurs et tire 2 Essences.' },
    { id: 'bundle', num: 18, txt: 'Après chaque victoire, 4 récompenses au choix au lieu de 3.' },
    { id: 'japon', num: 70, txt: 'Tire 1 Essence de plus à chaque tour pair.' }
  ];
  const COACH = Object.fromEntries(COACHS.map(c => [c.id, c]));

  const OBJETS = [
    { id: 'm4', num: 88, txt: '+20 Attaque.', atk: 20 },
    { id: 'm16', num: 105, txt: '+40 Attaque.', atk: 40 },
    { id: 'bonnet', num: 87, txt: '+40 Défense.', def: 40 },
    { id: 'mcl24', num: 46, txt: '+20 Attaque, +20 Défense.', atk: 20, def: 20 },
    { id: 'mcl25', num: 36, txt: '+30 Attaque, +30 Défense.', atk: 30, def: 30 },
    { id: 'maudit', num: 56, txt: '+60 Attaque, −40 Défense.', atk: 60, def: -40 },
    { id: 'chevaliere', num: 84, txt: 'Shield : ignore la première attaque subie.', shield: true },
    { id: 'jus', num: 65, txt: 'Riposte : mis hors jeu, il frappe son attaquant.', riposte: true },
    { id: 'rav', num: 15, txt: 'Récupère 20 Défense au début de ton tour.', regen: 20 },
    { id: 'lux1', num: 89, txt: 'Sur le terrain : +1 Essence de sa couleur tous les deux tours.', lux: 2 },
    { id: 'lux3', num: 122, txt: 'Sur le terrain : +1 Essence de sa couleur à chaque tour.', lux: 1 },
    { id: 'trahison', num: 106, txt: 'Sa première attaque de chaque match engage la cible.', trahison: true },
    { id: 'slip', num: 86, txt: 'Coût de ses attaques −1 (Essence au choix), −30 Défense.', remise: 1, def: -30 }
  ];
  const OBJET = Object.fromEntries(OBJETS.map(o => [o.id, o]));

  const MOMENTS = [
    { id: 'mur', num: 16, cout: 1, txt: 'Un de tes Joueurs gagne Shield.', cible: 'allie' },
    { id: 'clim', num: 92, cout: 0, txt: 'Désengage tous tes Joueurs.', cible: null },
    { id: 'tunnel', num: 95, cout: 0, txt: 'Fais entrer un Joueur du banc sans payer.', cible: 'rotation' },
    { id: 'onemore', num: 94, cout: 2, txt: 'Un de tes Joueurs qui a déjà agi peut agir encore.', cible: 'allieAgi' },
    { id: 'leak', num: 93, cout: 0, txt: 'Tire 2 Essences.', cible: null },
    { id: 'missed', num: 55, cout: 1, txt: 'La prochaine attaque adverse échoue.', cible: null },
    { id: 'trauma', num: 41, cout: 1, txt: 'Engage un Joueur adverse.', cible: 'adverse' },
    { id: 'degustation', num: 20, cout: 1, txt: '+60 Attaque à un de tes Joueurs pour ce tour.', cible: 'allie' },
    { id: 'major', num: 47, cout: 1, txt: 'Un de tes Joueurs récupère 80 Défense.', cible: 'allie' },
    { id: 'remontada', num: 27, cout: 2, txt: 'Si tu as moins de PV que l\'adversaire, tous tes Joueurs récupèrent 60 Défense.', cible: null },
    { id: 'keynote', num: 108, cout: 0, txt: 'Tire 3 Essences, puis défausses-en une.', cible: null, tire: 3 },
    { id: 'officiel', num: 91, cout: 0, txt: 'Ajoute 2 Essences de ta couleur dominante à ta Réserve pour le match.', cible: null }
  ];
  const MOMENT = Object.fromEntries(MOMENTS.map(m => [m.id, m]));
  const MOMENTS_MAX = 3;

  /* ---------- Les règles du match ---------- */
  const R = {
    terrain: 3, banc: 2, pvVictoire: 3,
    tirage: 3, premierTirage: 1, reserveMax: 7, manches: 2,
    regenBanc: 20, tours: 12, coutRotation: 1
  };

  /* ---------- Une saison ---------- */
  const TOURNOIS = [
    { nom: 'Qualifs', sous: 'Division ouverte' },
    { nom: 'Major', sous: 'Les huit meilleures équipes' },
    { nom: 'Worlds', sous: 'Le titre mondial' }
  ];
  const TOURS_TABLEAU = ['Quart de finale', 'Demi-finale', 'Finale'];
  const EQUIPES = [
    'Nova Club', 'Les Corbeaux', 'Team Néon', 'Overclock', 'Zénith', 'Vortex', 'Solaris', 'Kraken Club',
    'Phantom', 'Les Titans', 'Éclipse', 'Orbit', 'Mirage', 'Cobalt', 'Nébuleuse', 'Pulse'
  ];
  const FINALISTE = 'Les Invaincus';

  function nouvelleSaison(graine) {
    const s = {
      v: 1, graine: String(graine), r: graineDe(graine),
      coach: null, roster: [], reserve: [], moments: [], uid: 0,
      tournoi: 0, tour: 0, defaites: 0, perdants: false,
      equipes: melanger({ r: graineDe(graine + '#e') }, EQUIPES.slice()),
      adv: 0, fini: null, palmares: [],
      stats: { matchs: 0, victoires: 0, ko: 0, meilleurCoup: 0, tours: 0 },
      etape: 'coach', offres: null, draft: null, m: null
    };
    s.offres = melanger(s, COACHS.slice()).slice(0, 3).map(c => c.id);
    return s;
  }

  function choisirCoach(s, id) {
    if (s.etape !== 'coach' || !s.offres.includes(id)) throw new Error('Coach indisponible.');
    s.coach = id;
    s.etape = 'draft';
    s.draft = { tour: 0, choix: tirageDraft(s, 0) };
  }

  /* La draft : cinq tours, trois Joueurs proposés, un choisi. Les deux
     derniers tours tirent un peu plus haut. */
  const POIDS_DRAFT = [
    [['C', 60], ['PC', 40]], [['C', 50], ['PC', 50]], [['C', 40], ['PC', 50], ['R', 10]],
    [['PC', 60], ['R', 40]], [['PC', 40], ['R', 50], ['E', 10]]
  ];
  function tirageDraft(s, t) {
    const pris = new Set(s.roster.map(x => x.num));
    const l = [];
    while (l.length < 3) {
      const rar = pondere(s, POIDS_DRAFT[t]);
      const pool = JOUEURS.filter(j => j.rar === rar && !pris.has(j.num) && !l.includes(j.num));
      if (pool.length) l.push(choisir(s, pool).num);
    }
    return l;
  }

  function choisirDraft(s, num) {
    if (s.etape !== 'draft' || !s.draft.choix.includes(num)) throw new Error('Choix impossible.');
    s.roster.push(nouveauMembre(s, num));
    s.draft.tour++;
    if (s.draft.tour >= 5) {
      s.draft = null;
      /* La Réserve de départ : deux Essences par Joueur de couleur, et pour
         les Neutres, la couleur la plus représentée de l'équipe. */
      s.reserve = [];
      const couleurs = s.roster.map(x => J[x.num].ess).filter(c => c !== 'neutre');
      const dominante = dominanteDe(couleurs) || choisir(s, COULEURS);
      s.roster.forEach(x => { const c = J[x.num].ess; const e = c === 'neutre' ? dominante : c; s.reserve.push(e, e); });
      s.etape = 'tableau';
    } else s.draft.choix = tirageDraft(s, s.draft.tour);
  }

  const nouveauMembre = (s, num) => ({ uid: ++s.uid, num, objets: [], atk: 0, def: 0 });
  function dominanteDe(l) {
    const n = {};
    l.forEach(c => { n[c] = (n[c] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
  }

  /* ---------- L'adversaire ---------- */
  /* Plus on avance, plus ses Joueurs sont rares et plus ils tapent fort. */
  const POIDS_ADV = [
    [['C', 55], ['PC', 40], ['R', 5]],
    [['C', 35], ['PC', 45], ['R', 20]],
    [['C', 20], ['PC', 45], ['R', 30], ['E', 5]],
    [['PC', 40], ['R', 40], ['E', 20]],
    [['PC', 30], ['R', 40], ['E', 30]],
    [['PC', 20], ['R', 40], ['E', 35], ['L', 5]],
    [['R', 40], ['E', 45], ['L', 15]],
    [['R', 30], ['E', 50], ['L', 20]],
    [['R', 20], ['E', 50], ['L', 30]]
  ];
  const niveauMatch = s => s.tournoi * 3 + s.tour;
  function equipeAdverse(s) {
    const n = Math.min(niveauMatch(s), POIDS_ADV.length - 1);
    const finale = s.tournoi === 2 && s.tour === 2 && !s.perdants;
    const nom = finale ? FINALISTE : s.equipes[s.adv % s.equipes.length];
    const st = { r: graineDe(s.graine + '#adv' + s.adv) };
    const roster = [];
    while (roster.length < 5) {
      const rar = finale && roster.length < 2 ? 'L' : pondere(st, POIDS_ADV[n]);
      const pool = JOUEURS.filter(j => j.rar === rar && !roster.some(x => x.num === j.num));
      if (pool.length) roster.push({ uid: 1000 + roster.length, num: choisir(st, pool).num, objets: [], atk: 0, def: 0 });
    }
    /* À partir du Major, l'adversaire s'équipe aussi. */
    const nbObjets = s.tournoi === 0 ? 0 : s.tournoi === 1 ? 2 : 4;
    for (let i = 0; i < nbObjets; i++) {
      const o = choisir(st, OBJETS.filter(o => !o.lux));
      const x = roster[i % 5];
      if (x.objets.length < 2) x.objets.push(o.id);
    }
    /* Les chiffres des cartes ne bougent jamais : la difficulté passe par la
       rareté des Joueurs, leurs Objets, et les Essences que l'équipe tire à
       chaque tour (deux aux Qualifs, trois au Major, quatre aux Worlds). */
    const fort = 1;
    const tirage = s.tournoi === 0 ? 2 : s.tournoi === 1 ? 3 : 4;
    const couleurs = roster.map(x => J[x.num].ess).filter(c => c !== 'neutre');
    const dom = dominanteDe(couleurs) || choisir(st, COULEURS);
    const reserve = [];
    roster.forEach(x => { const c = J[x.num].ess; const e = c === 'neutre' ? dom : c; reserve.push(e, e); });
    return { nom, roster, reserve, fort, finale, tirage };
  }

  /* ---------- Le match ---------- */
  function unite(x, camp, s, fort) {
    const j = J[x.num];
    const obj = x.objets.map(id => OBJET[id]);
    let def = j.def + x.def + obj.reduce((a, o) => a + (o.def || 0), 0);
    if (camp === 'moi' && s.coach === 'barakataga') def += 20;
    def = Math.max(20, Math.round(def * (fort || 1) / 10) * 10);
    return {
      uid: x.uid, num: x.num, camp, defMax: def, vie: def,
      atkBonus: x.atk + obj.reduce((a, o) => a + (o.atk || 0), 0), fort: fort || 1,
      objets: x.objets.slice(),
      shield: (j.kw && j.kw.nom === 'Shield') || obj.some(o => o.shield),
      engage: false, bloque: false, agi: false, legion: false, trahison: obj.some(o => o.trahison), boostTour: 0
    };
  }

  function debutMatch(s) {
    const adv = equipeAdverse(s);
    s.m = {
      adv: { nom: adv.nom, finale: adv.finale, fort: adv.fort, roster: adv.roster, reserve: adv.reserve, tirage: adv.tirage },
      manche: 0, score: { moi: 0, eux: 0 }, entreManches: false,
      moments: s.moments.map(mid => ({ id: mid, joue: false })), pause: s.coach === 'pause',
      camps: null, trait: 'moi', tour: 1, fini: null
    };
    return debutManche(s, 'moi');
  }

  /* Une manche : deux équipes fraîches, dans l'ordre du roster. */
  function debutManche(s, premier) {
    const m = s.m, adv = m.adv;
    const camp = (id, roster, reserve, fort) => {
      const us = roster.map(x => unite(x, id, s, fort));
      return {
        terrain: us.slice(0, R.terrain), banc: us.slice(R.terrain), hors: [],
        pv: 0, reserve: melanger(s, reserve.slice()), defausse: [], main: [],
        marque: false, gardeUtilisee: false, rate: false
      };
    };
    m.manche++;
    m.entreManches = false;
    m.camps = { moi: camp('moi', s.roster, s.reserve, 1), eux: camp('eux', adv.roster, adv.reserve, adv.fort) };
    m.trait = premier; m.premier = premier; m.tour = 1; m.demiTour = 0;
    const ev = [{ t: 'manche', n: m.manche, premier }];
    if (s.coach === 'lyon') tirer(s, 'moi', 3, ev);
    ['moi', 'eux'].forEach(c => m.camps[c].terrain.forEach(u => entree(s, u, ev)));
    debutTour(s, premier, ev);
    return ev;
  }

  function mancheSuivante(s) {
    const m = s.m;
    if (!m || !m.entreManches) throw new Error('Pas de manche à lancer.');
    return debutManche(s, m.perdantManche);
  }

  const adverse = c => (c === 'moi' ? 'eux' : 'moi');
  const tous = (m, c) => m.camps[c].terrain.filter(Boolean);
  const trouver = (m, uid) => {
    for (const c of ['moi', 'eux']) {
      const k = m.camps[c];
      const u = k.terrain.find(x => x && x.uid === uid) || k.banc.find(x => x.uid === uid);
      if (u) return u;
    }
    return null;
  };

  function tirer(s, c, n, ev) {
    const k = s.m.camps[c];
    for (let i = 0; i < n; i++) {
      if (!k.reserve.length) { k.reserve = melanger(s, k.defausse); k.defausse = []; }
      if (!k.reserve.length) break;
      const e = k.reserve.pop();
      if (k.main.length >= R.reserveMax) { k.defausse.push(e); continue; }
      k.main.push(e);
      if (ev) ev.push({ t: 'essence', camp: c, ess: e });
    }
  }

  /* Ce qu'un Joueur a de plus que sa carte, sur le terrain. */
  function attaqueDe(s, u, atk, cible) {
    if (atk.degats == null) return 0;
    const m = s.m, k = m.camps[u.camp];
    let n = atk.degats + u.atkBonus + u.boostTour;
    tous(m, u.camp).forEach(a => { if (a !== u) { const b = buffDe(J[a.num]); if (b && b.quoi === 'atk') n += b.n; } });
    const e = effetDe(atk);
    if (e) {
      if (e.type === 'parEngage') n += e.n * tous(m, 'moi').concat(tous(m, 'eux')).filter(x => x.engage).length;
      if (e.type === 'parObjet') n += e.n * u.objets.length;
      if (e.type === 'parPV') n += e.n * k.pv;
      if (e.type === 'parJaune') n += e.n * k.main.filter(x => x === 'jaune').length;
      if (e.type === 'parEssence') n += e.n * Math.max(0, k.main.length - totalCout(s, u, atk));
      if (e.type === 'vengeance' && m.camps[adverse(u.camp)].marque) n += e.n;
    }
    if (u.num === 62 && k.pv < 2) n *= 2;
    if (u.camp === 'moi' && s.coach === 'zacking' && m.tour <= 2) n += 30;
    if (u.camp === 'moi' && s.coach === 'ombre' && cible && cible.engage) n += 40;
    return Math.round(n * u.fort);
  }

  /* Le coût réel : celui imprimé, moins la remise d'un Objet. */
  function coutDe(u, atk) {
    const c = Object.assign({}, atk.cout);
    const remise = u.objets.reduce((a, id) => a + (OBJET[id].remise || 0), 0);
    for (let i = 0; i < remise; i++) {
      if (c.neutre > 0) c.neutre--;
      else { const k = Object.keys(c).find(x => c[x] > 0); if (k) c[k]--; }
    }
    return c;
  }
  const totalCout = (s, u, atk) => Object.values(coutDe(u, atk)).reduce((a, b) => a + b, 0);

  /* Payer : les couleurs exigées d'abord ; le reste avec les Essences les
     plus nombreuses, pour garder la variété. Rend les indices pris. */
  function paiement(main, cout) {
    const dispo = main.map((e, i) => ({ e, i }));
    const pris = [];
    for (const [c, n] of Object.entries(cout)) {
      if (c === 'neutre') continue;
      for (let k = 0; k < n; k++) {
        const x = dispo.find(d => d.e === c && !pris.includes(d.i));
        if (!x) return null;
        pris.push(x.i);
      }
    }
    for (let k = 0; k < (cout.neutre || 0); k++) {
      const reste = dispo.filter(d => !pris.includes(d.i));
      if (!reste.length) return null;
      const n = {};
      reste.forEach(d => { n[d.e] = (n[d.e] || 0) + 1; });
      reste.sort((a, b) => n[b.e] - n[a.e]);
      pris.push(reste[0].i);
    }
    return pris;
  }
  function payer(s, c, cout) {
    const k = s.m.camps[c];
    const pris = paiement(k.main, cout);
    if (!pris) return null;
    const payees = pris.map(i => k.main[i]);
    k.main = k.main.filter((e, i) => !pris.includes(i));
    k.defausse.push(...payees);
    return payees;
  }

  /* Qui un attaquant peut viser : Provocation, Slay désengagé et 99% Faith
     avec 1% Chance imposent leur cible. */
  function provoque(m, u) {
    const j = J[u.num];
    if (j.kw && j.kw.nom === 'Provocation') return true;
    if (u.num === 101 && !u.engage) return true;
    if (u.num === 68 && tous(m, u.camp).some(x => x.num === 67)) return true;
    return false;
  }
  function ciblesPossibles(m, attaquant) {
    const l = tous(m, adverse(attaquant.camp));
    const p = l.filter(x => provoque(m, x));
    return p.length ? p : l;
  }

  function peutAgir(s, u) {
    return u && !u.bloque && !u.agi && s.m.trait === u.camp && !s.m.fini && !s.m.entreManches;
  }

  /* Ce qu'un Joueur peut faire maintenant. */
  function options(s, uid) {
    const m = s.m, u = trouver(m, uid);
    if (!u || !m.camps[u.camp].terrain.includes(u)) return { attaques: [], speciales: [] };
    const k = m.camps[u.camp];
    const ok = peutAgir(s, u);
    const attaques = J[u.num].atks.map((a, i) => {
      const cout = coutDe(u, a);
      return { i, nom: a.nom, cout, degats: a.degats, valeur: attaqueDe(s, u, a), effet: texteEffet(a),
        possible: ok && !!paiement(k.main, cout), cibles: ciblesPossibles(m, u).map(x => x.uid) };
    });
    const speciales = [];
    if (u.num === 79) speciales.push({ id: 'instalock', nom: 'Instalock', txt: SIGNATURES[79], possible: ok && tous(m, adverse(u.camp)).length > 0 && m.camps[adverse(u.camp)].banc.length > 0 });
    if (u.num === 102) speciales.push({ id: 'monster', nom: 'Hyper-Vitesse', txt: SIGNATURES[102], possible: ok && k.main.length >= 2 });
    const rotation = ok && k.banc.length > 0 && k.main.length >= R.coutRotation;
    return { attaques, speciales, rotation, agi: u.agi, bloque: u.bloque };
  }

  /* ---------- Les actions ---------- */
  function attaquer(s, uid, iAtk, cibleUid) {
    const m = s.m, u = trouver(m, uid);
    if (!peutAgir(s, u)) throw new Error('Ce Joueur ne peut pas agir.');
    const atk = J[u.num].atks[iAtk];
    if (!atk) throw new Error('Attaque inconnue.');
    const e = effetDe(atk);
    let cible = cibleUid != null ? trouver(m, cibleUid) : null;
    const cibles = ciblesPossibles(m, u);
    if (atk.degats != null || (e && ['engage', 'bench'].includes(e.type))) {
      if (!cible || !cibles.includes(cible)) throw new Error('Cible impossible.');
    }
    const payees = payer(s, u.camp, coutDe(u, atk));
    if (!payees) throw new Error('Pas assez d\'Essences.');
    u.agi = true;
    const ev = [{ t: 'attaque', de: u.uid, vers: cible && cible.uid, nom: atk.nom, payees, camp: u.camp }];
    const kAdv = m.camps[adverse(u.camp)];

    /* Target Missed : l'attaque échoue. */
    if (kAdv.rate && cible) {
      kAdv.rate = false;
      ev.push({ t: 'rate', vers: cible.uid });
      return finAction(s, ev);
    }
    /* Garde : un Joueur adverse détourne l'attaque sur lui. */
    if (cible && u.num !== 63 && !kAdv.gardeUtilisee) {
      const garde = tous(m, kAdv === m.camps.moi ? 'moi' : 'eux').find(x => x !== cible && !x.engage &&
        (((J[x.num].kw || {}).nom === 'Garde')) && !provoque(m, cible));
      if (garde) { kAdv.gardeUtilisee = true; ev.push({ t: 'garde', de: garde.uid, vers: cible.uid }); cible = garde; }
    }
    if (cible && cible.num === 112) tirer(s, cible.camp, 1, ev);

    if (atk.degats != null && cible) {
      if (cible.shield && u.num !== 63) {
        cible.shield = false;
        ev.push({ t: 'shield', vers: cible.uid });
      } else {
        const n = attaqueDe(s, u, atk, cible);
        frapper(s, u, cible, n, ev);
      }
    }
    if (e && cible && trouver(m, cible.uid)) {
      if (e.type === 'engage') { cible.engage = true; ev.push({ t: 'engage', vers: cible.uid }); }
      if (e.type === 'bench') benchForce(s, cible, ev);
    }
    if (u.trahison && cible && trouver(m, cible.uid) && m.camps[cible.camp].terrain.includes(cible)) {
      u.trahison = false; cible.engage = true; ev.push({ t: 'engage', vers: cible.uid });
    }
    if (e && e.type === 'mauves') ajouterEssences(s, u.camp, 'mauve', e.n, ev);
    if (e && e.type === 'bench') ajouterEssences(s, u.camp, 'mauve', e.mauves || 1, ev);
    if (e && e.type === 'tirer') tirer(s, u.camp, e.n, ev);
    if (e && e.type === 'desengage') {
      const a = tous(m, u.camp).find(x => x !== u && (x.engage || x.bloque));
      if (a) { a.engage = false; a.bloque = false; ev.push({ t: 'desengage', vers: a.uid }); }
    }
    if (e && e.type === 'repli' && m.camps[u.camp].banc.length && trouver(m, u.uid)) rotation(s, u.uid, null, ev, true);
    return finAction(s, ev);
  }

  function frapper(s, u, cible, n, ev) {
    const m = s.m;
    cible.vie = Math.max(0, cible.vie - n);
    ev.push({ t: 'degats', de: u.uid, vers: cible.uid, n, vie: cible.vie });
    if (u.camp === 'moi') s.stats.meilleurCoup = Math.max(s.stats.meilleurCoup, n);
    if (cible.vie <= 0) horsJeu(s, cible, u, ev);
  }

  function horsJeu(s, cible, par, ev) {
    const m = s.m;
    const k = m.camps[cible.camp], kPar = m.camps[adverse(cible.camp)];
    const pos = k.terrain.indexOf(cible);
    if (pos < 0) return;
    k.terrain[pos] = null;
    kPar.pv++;
    kPar.marque = true;
    if (cible.camp === 'eux') s.stats.ko++;
    ev.push({ t: 'ko', vers: cible.uid, camp: cible.camp, pv: kPar.pv, pour: kPar === m.camps.moi ? 'moi' : 'eux' });
    if (cible.num === 77) tirer(s, cible.camp, 1, ev);
    /* Riposte : il frappe celui qui l'a mis hors jeu. */
    const riposte = (J[cible.num].kw || {}).nom === 'Riposte' || cible.objets.some(id => OBJET[id].riposte);
    if (riposte && par && trouver(m, par.uid) && m.camps[par.camp].terrain.includes(par)) {
      const a = J[cible.num].atks.find(x => x.degats != null);
      if (a) {
        const n = Math.round((a.degats + cible.atkBonus) * cible.fort);
        ev.push({ t: 'riposte', de: cible.uid, vers: par.uid });
        frapper(s, cible, par, n, ev);
      }
    }
    /* Légion : il revient une fois sur le banc. */
    if ((J[cible.num].kw || {}).nom === 'Légion' && !cible.legion) {
      cible.legion = true;
      cible.vie = cible.defMax; cible.engage = false; cible.bloque = false;
      k.banc.push(cible);
      ev.push({ t: 'legion', vers: cible.uid });
    } else k.hors.push(cible);
    if (kPar.pv >= R.pvVictoire) return;
    remplacer(s, cible.camp, pos, ev);
  }

  function remplacer(s, c, pos, ev) {
    const k = s.m.camps[c];
    if (k.terrain[pos] || !k.banc.length) return;
    const u = k.banc.shift();
    k.terrain[pos] = u;
    u.agi = true;
    ev.push({ t: 'entree', vers: u.uid, camp: c, pos });
    entree(s, u, ev);
  }

  function entree(s, u, ev) {
    const m = s.m;
    if (u.num === 12) {
      const l = tous(m, adverse(u.camp)).filter(x => !x.engage)
        .sort((a, b) => maxAtk(s, b) - maxAtk(s, a));
      if (l[0]) { l[0].engage = true; ev.push({ t: 'engage', vers: l[0].uid, de: u.uid }); }
    }
    if (u.num === 117) tirer(s, u.camp, 3, ev);
  }
  const maxAtk = (s, u) => Math.max(0, ...J[u.num].atks.map(a => attaqueDe(s, u, a)));

  function benchForce(s, cible, ev) {
    const m = s.m, k = m.camps[cible.camp];
    const pos = k.terrain.indexOf(cible);
    if (pos < 0 || !k.banc.length) return;
    const entrant = k.banc.shift();
    k.terrain[pos] = entrant;
    cible.engage = false; cible.bloque = false;
    k.banc.push(cible);
    ev.push({ t: 'bench', vers: cible.uid, entre: entrant.uid, pos, camp: cible.camp });
    entree(s, entrant, ev);
  }

  function ajouterEssences(s, c, e, n, ev) {
    const k = s.m.camps[c];
    for (let i = 0; i < n; i++) k.reserve.splice(entier(s, k.reserve.length + 1), 0, e);
    ev.push({ t: 'reserve', camp: c, ess: e, n });
  }

  /* Faire entrer un remplaçant : 1 Essence, et l'entrant a déjà agi. */
  function rotation(s, uidTerrain, uidBanc, ev, gratuit) {
    const m = s.m;
    ev = ev || [];
    const u = trouver(m, uidTerrain);
    const k = m.camps[u.camp];
    const pos = k.terrain.indexOf(u);
    if (pos < 0 || !k.banc.length) throw new Error('Pas de remplaçant.');
    if (!gratuit) {
      if (!peutAgir(s, u)) throw new Error('Ce Joueur ne peut pas sortir.');
      if (!payer(s, u.camp, { neutre: R.coutRotation })) throw new Error('Il faut 1 Essence.');
    }
    const iB = uidBanc != null ? k.banc.findIndex(x => x.uid === uidBanc) : 0;
    const entrant = k.banc.splice(Math.max(0, iB), 1)[0];
    k.terrain[pos] = entrant;
    entrant.agi = true;
    u.agi = true;
    k.banc.push(u);
    ev.push({ t: 'rotation', sort: u.uid, entre: entrant.uid, pos, camp: u.camp });
    entree(s, entrant, ev);
    return gratuit ? ev : finAction(s, ev);
  }

  function speciale(s, uid, id, cibleUid) {
    const m = s.m, u = trouver(m, uid);
    if (!peutAgir(s, u)) throw new Error('Ce Joueur ne peut pas agir.');
    const ev = [];
    if (id === 'instalock') {
      const c = trouver(m, cibleUid);
      if (!c || c.camp === u.camp) throw new Error('Cible impossible.');
      u.agi = true; u.engage = true;
      ev.push({ t: 'speciale', de: u.uid, nom: 'Instalock' });
      benchForce(s, c, ev);
    } else if (id === 'monster') {
      const k = m.camps[u.camp];
      if (k.main.length < 2) throw new Error('Il faut 2 Essences.');
      u.agi = true;
      k.defausse.push(...k.main.splice(0, 2));
      ev.push({ t: 'speciale', de: u.uid, nom: 'Hyper-Vitesse' });
      tirer(s, u.camp, 2, ev);
    }
    return finAction(s, ev);
  }

  function jouerMoment(s, i, cibleUid) {
    const m = s.m, k = m.camps.moi;
    const mo = m.moments[i];
    if (!mo || mo.joue || m.trait !== 'moi' || m.fini || m.entreManches) throw new Error('Moment indisponible.');
    const d = MOMENT[mo.id];
    if (d.cout && !payer(s, 'moi', { neutre: d.cout })) throw new Error(`Il faut ${d.cout} Essence${d.cout > 1 ? 's' : ''}.`);
    const c = cibleUid != null ? trouver(m, cibleUid) : null;
    const ev = [{ t: 'moment', id: d.id }];
    switch (d.id) {
      case 'mur': if (!c) throw new Error('Choisis un Joueur.'); c.shield = true; ev.push({ t: 'gainShield', vers: c.uid }); break;
      case 'clim': tous(m, 'moi').forEach(x => { if (x.engage || x.bloque) { x.engage = false; x.bloque = false; ev.push({ t: 'desengage', vers: x.uid }); } }); break;
      case 'tunnel': if (!c) throw new Error('Choisis un Joueur.'); rotation(s, c.uid, null, ev, true); break;
      case 'onemore': if (!c) throw new Error('Choisis un Joueur.'); c.agi = false; ev.push({ t: 'desengage', vers: c.uid }); break;
      case 'leak': tirer(s, 'moi', 2, ev); break;
      case 'missed': m.camps.eux.rate = true; break;
      case 'trauma': if (!c) throw new Error('Choisis un Joueur.'); c.engage = true; ev.push({ t: 'engage', vers: c.uid }); break;
      case 'degustation': if (!c) throw new Error('Choisis un Joueur.'); c.boostTour += 60; ev.push({ t: 'boost', vers: c.uid, n: 60 }); break;
      case 'major': if (!c) throw new Error('Choisis un Joueur.'); soigner(c, 80, ev); break;
      case 'remontada': if (k.pv < m.camps.eux.pv) tous(m, 'moi').forEach(x => soigner(x, 60, ev)); break;
      case 'keynote': tirer(s, 'moi', 3, ev); if (k.main.length) k.defausse.push(k.main.shift()); break;
      case 'officiel': {
        const dom = dominanteDe(k.main.concat(k.reserve)) || 'rose';
        ajouterEssences(s, 'moi', dom, 2, ev);
        break;
      }
    }
    mo.joue = true;
    return finAction(s, ev);
  }
  function soigner(u, n, ev) {
    const avant = u.vie;
    u.vie = Math.min(u.defMax, u.vie + n);
    if (u.vie > avant) ev.push({ t: 'soin', vers: u.uid, n: u.vie - avant, vie: u.vie });
  }

  function pauseTechnique(s) {
    const m = s.m;
    if (!m.pause || m.trait !== 'moi' || m.entreManches) throw new Error('Indisponible.');
    m.pause = false;
    const ev = [{ t: 'moment', id: 'pause' }];
    tous(m, 'moi').forEach(x => { if (x.engage || x.bloque) { x.engage = false; x.bloque = false; ev.push({ t: 'desengage', vers: x.uid }); } });
    tirer(s, 'moi', 2, ev);
    return finAction(s, ev);
  }

  /* Après chaque action : la victoire, sinon on continue. */
  function finAction(s, ev) {
    const m = s.m;
    if (m.entreManches || m.fini) return ev;
    for (const c of ['moi', 'eux']) {
      const k = m.camps[c];
      if (k.pv >= R.pvVictoire || !tous(m, adverse(c)).length) { finManche(s, c, ev); break; }
    }
    return ev;
  }

  function finManche(s, gagnant, ev, temps) {
    const m = s.m;
    m.score[gagnant]++;
    m.perdantManche = adverse(gagnant);
    s.stats.tours += m.tour;
    ev.push({ t: 'mancheFin', gagnant, score: Object.assign({}, m.score), temps: !!temps });
    if (m.score[gagnant] >= R.manches) {
      m.fini = { gagnant };
      ev.push({ t: 'fin', gagnant });
    } else m.entreManches = true;
  }

  /* ---------- Les tours ---------- */
  function debutTour(s, c, ev) {
    const m = s.m, k = m.camps[c];
    k.marque = false;
    m.camps[adverse(c)].gardeUtilisee = false;
    /* Les places vides se remplissent. */
    k.terrain.forEach((u, i) => { if (!u) remplacer(s, c, i, ev); });
    tous(m, c).forEach(u => {
      u.agi = false; u.boostTour = 0;
      u.bloque = u.engage; u.engage = false;
      if (u.bloque) ev.push({ t: 'bloque', vers: u.uid });
    });
    /* Le banc récupère. */
    const regen = c === 'moi' && s.coach === 'lofi' ? 50 : R.regenBanc;
    k.banc.forEach(u => { u.vie = Math.min(u.defMax, u.vie + regen); });
    tous(m, c).forEach(u => { const r = u.objets.reduce((a, id) => a + (OBJET[id].regen || 0), 0); if (r) soigner(u, r, ev); });
    /* Celui qui ouvre la manche tire moins à son premier tour. */
    const base = c === 'eux' ? m.adv.tirage : R.tirage;
    let n = (m.demiTour === 0 ? Math.min(R.premierTirage, base) : base) + (c === 'moi' && s.coach === 'japon' && m.tour % 2 === 0 ? 1 : 0);
    tirer(s, c, n, ev);
    /* Les Signatures de début de tour. */
    tous(m, c).forEach(u => {
      if (u.num === 44 && k.pv >= 2) tirer(s, c, 1, ev);
      u.objets.forEach(id => { const o = OBJET[id]; if (o.lux && m.tour % o.lux === 0) ajouterMain(s, c, J[u.num].ess === 'neutre' ? null : J[u.num].ess, ev); });
      if (u.num === 50) {
        const x = tous(m, adverse(c)).find(y => y.engage && !provoque(m, y));
        if (x) benchForce(s, x, ev);
      }
      if (u.num === 113 && tous(m, c).filter(y => J[y.num].ess === 'rose').length >= 3) {
        const x = tous(m, adverse(c)).sort((a, b) => b.vie - a.vie)[0];
        if (x) benchForce(s, x, ev);
      }
    });
    ev.push({ t: 'tour', camp: c, tour: m.tour });
  }
  function ajouterMain(s, c, e, ev) {
    const k = s.m.camps[c];
    if (k.main.length >= R.reserveMax) return;
    const ess = e || dominanteDe(k.main.concat(k.reserve)) || 'rose';
    k.main.push(ess);
    ev.push({ t: 'essence', camp: c, ess });
  }

  function finTour(s) {
    const m = s.m;
    if (m.fini || m.entreManches) return [];
    const ev = [];
    const c = m.trait;
    m.trait = adverse(c);
    m.demiTour++;
    if (m.trait === m.premier) m.tour++;
    if (m.tour > R.tours) {
      const a = m.camps.moi, b = m.camps.eux;
      const pct = k => tous(m, k).concat(m.camps[k].banc).reduce((x, u) => x + u.vie / u.defMax, 0);
      const g = a.pv !== b.pv ? (a.pv > b.pv ? 'moi' : 'eux') : (pct('moi') >= pct('eux') ? 'moi' : 'eux');
      finManche(s, g, ev, true);
      return ev;
    }
    debutTour(s, m.trait, ev);
    return ev;
  }

  /* ---------- L'adversaire joue ---------- */
  /* Une IA sans tricherie : elle voit ce que voit le joueur. Pour chaque
     Joueur prêt, elle cherche le coup qui met hors jeu, sinon celui qui fait
     le plus de dégâts utiles, en gardant des Essences pour plus fort. */
  function iaChoix(s) {
    const m = s.m, c = m.trait, k = m.camps[c];
    let best = null;
    tous(m, c).forEach(u => {
      if (!peutAgir(s, u)) return;
      J[u.num].atks.forEach((a, i) => {
        const cout = coutDe(u, a);
        if (!paiement(k.main, cout)) return;
        const e = effetDe(a);
        const cibles = ciblesPossibles(m, u);
        const nCout = Object.values(cout).reduce((x, y) => x + y, 0);
        cibles.forEach(cb => {
          let v = 0;
          if (a.degats != null) {
            const n = cb.shield ? 0 : attaqueDe(s, u, a, cb);
            v = Math.min(n, cb.vie) + (n >= cb.vie ? 400 : 0) - nCout * 12;
          }
          if (e && e.type === 'engage' && !cb.engage) v += 60 + maxAtk(s, cb) * 0.4;
          if (e && e.type === 'bench') v += 120;
          if (v > 0 && (!best || v > best.v)) best = { v, type: 'attaque', u, i, cb };
        });
        if (a.degats == null && e && !['engage', 'bench'].includes(e.type)) {
          const v = 50 - nCout * 10;
          if (v > 0 && (!best || v > best.v)) best = { v, type: 'attaque', u, i, cb: null };
        }
      });
    });
    if (best) return best;
    /* Un Joueur à bout de souffle sort, si un remplaçant plus frais attend. */
    const faible = tous(m, c).filter(u => peutAgir(s, u) && u.vie / u.defMax < 0.3).sort((a, b) => a.vie - b.vie)[0];
    if (faible && k.banc.length && k.banc[0].vie / k.banc[0].defMax > 0.7 && k.main.length >= 1) return { type: 'rotation', u: faible };
    return null;
  }

  /* Un coup de l'adversaire, ou `null` quand il a fini (il faut alors
     appeler finTour). L'écran s'en sert pour jouer les coups un à un. */
  function iaPas(s) {
    const m = s.m;
    if (m.fini || m.entreManches) return null;
    const b = iaChoix(s);
    if (!b) return null;
    if (b.type === 'rotation') return rotation(s, b.u.uid, null, []);
    return attaquer(s, b.u.uid, b.i, b.cb && b.cb.uid);
  }

  function ia(s) {
    const m = s.m;
    const ev = [];
    let garde = 0, x;
    while (garde++ < 14 && (x = iaPas(s))) ev.push(...x);
    if (!m.fini && !m.entreManches) ev.push(...finTour(s));
    return ev;
  }

  /* ---------- Après le match ---------- */
  function finMatch(s) {
    const m = s.m;
    const gagne = m.fini.gagnant === 'moi';
    s.stats.matchs++;
    if (gagne) s.stats.victoires++;
    const res = { gagne, adv: m.adv.nom, tournoi: s.tournoi, tour: s.tour, perdants: s.perdants, score: [m.score.moi, m.score.eux] };
    s.m = null;
    s.adv++;
    if (!gagne) {
      s.defaites++;
      if (s.defaites >= 2) { s.fini = { victoire: false, tournoi: s.tournoi, tour: s.tour }; s.etape = 'fin'; return res; }
      /* Première défaite du tournoi : le tableau des perdants, un match de
         rattrapage, puis on reprend où on en était. */
      s.perdants = true;
      s.etape = 'tableau';
      return res;
    }
    /* Gagner au tableau des perdants vaut le match perdu : on reprend la
       route vers la finale. */
    s.perdants = false;
    if (s.tour === 2) {
      s.palmares.push(TOURNOIS[s.tournoi].nom);
      if (s.tournoi === 2) { s.fini = { victoire: true }; s.etape = 'fin'; return res; }
      s.tournoi++; s.tour = 0; s.defaites = 0;
      res.trophee = TOURNOIS[s.tournoi - 1].nom;
    } else s.tour++;
    s.etape = 'recompense';
    s.offres = recompenses(s, !!res.trophee);
    return res;
  }

  /* ---------- Les récompenses ---------- */
  function recompenses(s, trophee) {
    const n = s.coach === 'bundle' ? 4 : 3;
    const types = ['joueur', 'objet', 'moment', 'essences', 'bootcamp'];
    const l = [];
    const deja = new Set();
    let essais = 0;
    while (l.length < n && essais++ < 50) {
      const t = l.length === 0 && trophee ? 'joueur' : choisir(s, types);
      if (deja.has(t) && essais < 30) continue;
      deja.add(t);
      if (t === 'joueur') {
        const rar = pondere(s, trophee ? [['E', 70], ['L', 30]] : POIDS_ADV[Math.min(niveauMatch(s) + 1, POIDS_ADV.length - 1)]);
        const pool = JOUEURS.filter(j => j.rar === rar && !s.roster.some(x => x.num === j.num));
        if (pool.length) l.push({ type: 'joueur', num: choisir(s, pool).num });
      } else if (t === 'objet') l.push({ type: 'objet', id: choisir(s, OBJETS).id });
      else if (t === 'moment') l.push({ type: 'moment', id: choisir(s, MOMENTS.filter(x => !s.moments.includes(x.id))).id });
      else if (t === 'essences') {
        const cs = s.roster.map(x => J[x.num].ess).filter(c => c !== 'neutre');
        const c = cs.length ? choisir(s, cs) : choisir(s, COULEURS);
        l.push({ type: 'essences', ess: c, n: 2 });
      } else l.push({ type: 'bootcamp', atk: 20, def: 30 });
    }
    return l;
  }

  /* Prendre une récompense. `cible` : le Joueur qui la reçoit (Objet,
     bootcamp), ou celui qui part (recrutement). */
  function prendre(s, i, cible) {
    if (s.etape !== 'recompense') throw new Error('Pas de récompense en attente.');
    const o = s.offres[i];
    if (!o) throw new Error('Récompense inconnue.');
    if (o.type === 'joueur') {
      const k = s.roster.findIndex(x => x.uid === cible);
      if (k < 0) throw new Error('Choisis qui laisse sa place.');
      s.roster[k] = nouveauMembre(s, o.num);
      /* La Réserve suit l'équipe : deux Essences de sa couleur. */
      const c = J[o.num].ess;
      if (c !== 'neutre') s.reserve.push(c, c);
    } else if (o.type === 'objet') {
      const x = s.roster.find(y => y.uid === cible);
      if (!x) throw new Error('Choisis un Joueur.');
      if (x.objets.length >= 2) x.objets.shift();
      x.objets.push(o.id);
    } else if (o.type === 'moment') {
      if (s.moments.length >= MOMENTS_MAX) {
        const k = s.moments.indexOf(cible);
        if (k < 0) throw new Error('Choisis le Moment à remplacer.');
        s.moments[k] = o.id;
      } else s.moments.push(o.id);
    } else if (o.type === 'essences') {
      for (let k = 0; k < o.n; k++) s.reserve.push(o.ess);
    } else if (o.type === 'bootcamp') {
      const x = s.roster.find(y => y.uid === cible);
      if (!x) throw new Error('Choisis un Joueur.');
      x.atk += o.atk; x.def += o.def;
    }
    s.offres = null;
    s.etape = 'tableau';
  }
  function passer(s) { if (s.etape === 'recompense') { s.offres = null; s.etape = 'tableau'; } }

  /* Changer l'ordre du roster : les trois premiers commencent sur le terrain. */
  function ordonner(s, uids) {
    const l = uids.map(u => s.roster.find(x => x.uid === u)).filter(Boolean);
    if (l.length === s.roster.length) s.roster = l;
  }

  return {
    ESS, COULEURS, RARS, MOTS, SIGNATURES, COACHS, COACH, OBJETS, OBJET, MOMENTS, MOMENT, MOMENTS_MAX, R,
    TOURNOIS, TOURS_TABLEAU, FINALISTE,
    charger, joueur, carte, joueurs: () => JOUEURS, buffDe, effetDe, texteEffet,
    nouvelleSaison, choisirCoach, choisirDraft, equipeAdverse,
    debutMatch, mancheSuivante, options, attaquer, rotation, speciale, jouerMoment, pauseTechnique, finTour, ia, iaPas,
    finMatch, prendre, passer, ordonner, attaqueDe, coutDe, ciblesPossibles, provoque, trouver, tous, adverse,
    graineDe, niveauMatch
  };
})();

if (typeof module !== 'undefined') module.exports = CIRCUIT;
