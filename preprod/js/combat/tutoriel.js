/* Le tutoriel : une partie écrite d'avance, pour apprendre en jouant. Né en
   3.0.6, réécrit et vérifié dans Chromium en 3.0.7, retouché en 3.0.8 (la
   bulle de l'attaque suit la zone de détails de l'arène).

   Les deux Clubs ne sont pas mélangés (`ordre`, js/combat/moteur.js) : la
   main, les PV et les pioches sont les mêmes à chaque partie. Le Rival joue
   des coups prévus pendant ses deux premiers tours, puis l'IA Débutant
   prend la main. Le joueur, lui, est guidé jusqu'à son troisième tour : une
   bulle dit quoi faire, le coup demandé s'allume, et l'arène refuse les
   autres (Table, option `guide`). Ensuite la partie est libre, et des
   remarques arrivent la première fois que quelque chose se produit — une
   touche, un Joueur vaincu, un Banc, une Légion…

   Ce que la partie montre, dans l'ordre : le but (les PV, qui reviennent en
   main), la main de départ, le camp, les Essences, les quatre sortes de
   cartes et la carte en grand (3.0.7), déployer, lier un Objet, finir son
   tour, le tour adverse
   et ses deux Essences, défendre, Shield, le tour suivant (redresser,
   piocher), Provocation, un Moment, un Coach, payer une attaque (la Neutre),
   Attaque contre Défense (3.0.7), attaquer un Joueur engagé, le vaincre, être touché, la Résilience, Garde,
   Légion. Il se rejoue à l'infini ; la première victoire fait avancer la
   quête « Premiers pas » (supabase/installation/04_seed.sql, tutoriel_fini). */
"use strict";

const TUTO_MOI = [
  /* La main */ 'c012', 'c085', 'c014', 'c097', 'c078',
  /* Les PV, le premier d'abord */ 'c016', 'c087', 'c083', 'c011', 'c073',
  /* Les pioches */ 'c013', 'c074', 'c010', 'c015', 'c017', 'c024', 'c011', 'c013', 'c010', 'c078',
  'c073', 'c074', 'c087', 'c083', 'c085', 'c015', 'c016', 'c014', 'c097', 'c017'];
const TUTO_LUI = [
  'c059', 'c051', 'c052', 'c055', 'c053',
  'c087', 'c092', 'c104', 'c078', 'c052',
  'c051', 'c059', 'c053', 'c055', 'c087', 'c092', 'c104', 'c078', 'c080', 'c080',
  'c077', 'c077', 'c076', 'c076', 'c075', 'c075', 'c088', 'c088', 'c082', 'c082'];
const TUTO_CLE = 'mtcg.tutoriel';

let tuto = null;

const tutoFait = () => {
  const q = (save.quetes || []).find(x => x.id === 'm_tutoriel');
  if (q && q.progress >= q.goal) return true;
  try { return !!localStorage.getItem(TUTO_CLE); } catch (e) { return false; }
};

function lancerTutoriel() {
  if (typeof Table === 'undefined' || Table.ouverte()) return;
  closeSheet && closeSheet();
  tuto = { i: 0, attente: null, bloque: false, occupe: false, libre: false, vus: new Set() };
  const e = cbEtat();
  Table.ouvrir({
    init: {
      decks: [{ club: TUTO_MOI, reserve: Array(10).fill('rose') }, { club: TUTO_LUI, reserve: Array(10).fill('mauve') }],
      noms: [save.pseudo || 'Toi', 'Le Rival'], graine: 7, premier: 0, ordre: true, pv: [5, 3]
    },
    moi: 0,
    ia: { niveau: 1, choisir: tutoRival },
    joueurs: [joueurMoi(), { nom: 'Le Rival', avatar: 'ess:mauve', frame: 'default' }],
    cosm: [e.cosm, { tapis: 't_base', sleeve: 's_base' }],
    brillantes: [brillantesMoi(), []],
    titre: 'Tutoriel', sousTitre: 'Une partie pour tout apprendre',
    guide: { permis: tutoPermis, refus: tutoRefus, apresRendu: tutoSurligner, surDecision: tutoDecision, apresAction: tutoApres, avantIA: tutoAvantIA },
    surFin: tutoFin,
    surQuitter: () => { tuto = null; render(); }
  });
}

/* ---------- Petits accès ---------- */
const tuU = (E, j, id) => {
  const P = E.j[j];
  const c = P.main.find(x => x.id === id) || P.lignes.find(x => x && x.id === id);
  return c ? c.u : null;
};
const tuIdDe = (E, u) => {
  for (const P of E.j) {
    const c = P.main.find(x => x.u === u) || P.lignes.find(x => x && x.u === u);
    if (c) return c.id;
  }
  return null;
};
const enMain = (E, id) => `.ar-m[data-mu="${tuU(E, 0, id)}"]`;
const surPlateau = (E, j, id) => `.ar-j[data-u="${tuU(E, j, id)}"]`;
const placesLibres = '.ar-camp.moi .ar-place:not(:has(.ar-j))';

/* ---------- Le Rival ---------- */
/* Ses deux premiers tours sont écrits : Baby Driver en face de Squeezie,
   qui attaque ton CEO ; puis La Planète, qui attaque quand tes Joueurs sont
   engagés. Ensuite, l'IA Débutant. */
function tutoRival(E) {
  const d = Combat.demande(E);
  if (d.type === 'choix' && d.but === 'mulligan') return { t: 'choix', v: 'oui' };
  if (d.type === 'tour' && (E.tour === 2 || E.tour === 4)) {
    const o = Combat.optionsTour(E);
    const id = E.tour === 2 ? 'c059' : 'c051';
    const sq = E.j[0].lignes.findIndex(c => c && c.id === 'c012');
    const dep = o.filter(x => x.t === 'deployer' && tuIdDe(E, x.u) === id);
    const a = dep.find(x => x.ligne === sq) || dep[0];
    if (a) return a;
    const at = o.find(x => x.t === 'attaquer' && tuIdDe(E, x.u) === id && x.cible === 'ceo');
    if (at) return at;
    return o.find(x => x.t === 'finTour') || IA.choisir(E, { niveau: 1 });
  }
  return IA.choisir(E, { niveau: 1 });
}

/* ---------- Le scénario ---------- */
/* Une étape « à lire » (info) s'affiche et attend « Compris ». Une étape « à
   faire » allume ce qu'il faut toucher, et seul le coup `attend` passe. */
const tourDe = (E, d, n) => d && d.type === 'tour' && d.qui === 0 && E.tour === n;
/* Les petits signes des bulles (version 3.0.7) : une Essence, la Défense. */
const tuEss = c => (typeof essIcon === 'function' ? essIcon(c, 'tu-ico') : '');
const TU_DEF = '<svg class="tu-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z" fill="#1e1d28" stroke="#fff" stroke-width="1.8"/></svg>';
const defDe = (E, j, id) => { const c = E.j[j].lignes.find(x => x && x.id === id); return c ? Combat.defense(E, c) : '?'; };
const ETAPES = [
  { info: true, quand: (E, d) => d && d.but === 'mulligan', titre: 'Bienvenue dans l\'arène',
    texte: () => 'Deux <b>CEO</b> s\'affrontent : toi en bas, le Rival en haut. Chacun a des <b>PV</b> : des cartes posées face cachée. Quand ton CEO est <b>touché</b>, il perd un PV… et cette carte <b>rejoint ta main</b>. Pour gagner : toucher le CEO adverse <b>quand il n\'a plus de PV</b>. Le Rival n\'en a que 3 aujourd\'hui.' },
  { quand: (E, d) => d && d.but === 'mulligan', titre: 'Ta main de départ',
    texte: () => 'Cinq cartes. Tu peux une fois en changer, mais celle-ci est bonne : <b>garde-la</b>.',
    attend: a => a.t === 'choix' && a.v === 'oui', vise: () => ['[data-ar="opt"][data-v="oui"]'] },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'Ton camp',
    texte: () => '<b>Trois lignes</b>, face à celles du Rival : tu y poses tes Joueurs, et chacun garde la ligne où il est. Tes <b>5 PV</b> sont à côté de ton CEO, en bas.', vise: () => ['.ar-camp.moi .ar-lignes', '.ar-ceo.moi'] },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'Les Essences',
    texte: () => `Au début de chaque tour, une Essence de ta <b>Réserve</b> entre en jeu (ici, une Rose ${tuEss('rose')}). Elles <b>paient les attaques</b>, et rien d'autre : poser un Joueur, lier un Objet, jouer un Moment, tout ça est gratuit.`, vise: () => ['.ar-zone.moi .ar-ess-zone'] },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'Quatre sortes de cartes',
    texte: () => '<b>Joueurs</b> : sur tes lignes, ils attaquent et défendent. <b>Objets</b> : liés à un Joueur, ils le renforcent. <b>Moments</b> : un effet, autant que tu veux. <b>Coachs</b> : un effet, <b>un par tour</b>. Touche n\'importe quelle carte pour la voir <b>en grand</b> : ses attaques, leur coût, ses dégâts et sa Défense <b>en direct</b>.', vise: () => ['.ar-main'] },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Déploie un Joueur',
    texte: () => 'Touche <b>Squeezie le Toxique</b> dans ta main, puis une <b>ligne libre</b> (elles s\'allument). Un seul Joueur déployé par tour.',
    attend: (a, E) => a.t === 'deployer' && tuIdDe(E, a.u) === 'c012', vise: E => [enMain(E, 'c012'), placesLibres] },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Lie un Objet',
    texte: () => '<b>Cooked</b> donne +30 Attaque. Touche-le, puis touche <b>Squeezie</b> : il le portera tant qu\'il reste en jeu (3 Objets au plus par Joueur). Regarde ses chiffres monter.',
    attend: (a, E) => a.t === 'lier' && tuIdDe(E, a.u) === 'c085', vise: E => [enMain(E, 'c085'), surPlateau(E, 0, 'c012')] },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Fin du tour',
    texte: () => 'Celui qui commence <b>n\'attaque pas à son premier tour</b>. Garde le Coach et le Moment pour plus tard : touche « Fin du tour ». C\'est au Rival.',
    attend: a => a.t === 'finTour', vise: () => ['.ar-fin'], refus: 'Garde tes autres cartes pour le tour prochain : touche « Fin du tour ».' },
  { quand: (E, d) => d && d.but === 'defense' && E.tour === 2, titre: 'On t\'attaque !', pos: 'haut',
    texte: E => `La <b>flèche rouge</b> montre ce que vise Baby Driver : ton CEO. <b>Squeezie</b>, debout (désengagé) et sur la même ligne, peut <b>s'interposer</b>. On compare deux chiffres : sa Défense ${TU_DEF}<b>${defDe(E, 0, 'c012')}</b> contre l'Attaque <b>40</b>. Plus haute : l'attaque est repoussée. Défends avec lui.`,
    attend: (a, E) => a.t === 'choix' && a.v === tuU(E, 0, 'c012'), vise: E => [`[data-ar="opt"][data-v="${tuU(E, 0, 'c012')}"]`] },
  { info: true, quand: (E, d) => tourDe(E, d, 3), titre: 'Un nouveau tour',
    texte: () => `Tes Joueurs et tes Essences se <b>redressent</b> (ils sont de nouveau désengagés), tu <b>pioches</b> une carte (Pas Compris), et une <b>deuxième Essence</b> ${tuEss('rose')} arrive.`, vise: () => ['.ar-zone.moi .ar-ess-zone'] },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Provocation',
    texte: () => '<b>Pas Compris</b> a Provocation : un attaquant face à lui <b>doit le viser</b>. Un bouclier pour tes autres Joueurs. Déploie-le sur une ligne libre.',
    attend: (a, E) => a.t === 'deployer' && tuIdDe(E, a.u) === 'c013', vise: E => [enMain(E, 'c013'), placesLibres] },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Un Moment',
    texte: () => `Les <b>Moments</b> se jouent autant que tu veux. <b>Doig'Dance</b> rend ta première attaque du tour moins chère d'une Essence <b>Neutre</b> ${tuEss('neutre')}. Touche-la, puis « Jouer ce Moment ».`,
    attend: (a, E) => a.t === 'jouer' && tuIdDe(E, a.u) === 'c097', vise: E => [enMain(E, 'c097'), '[data-ar="jouer"]'] },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Un Coach',
    texte: () => 'Les <b>Coachs</b> : <b>un seul par tour</b>. <b>Zacking Buff</b> donne +30 Attaque à tes Joueurs jusqu\'à la fin du tour. Joue-le.',
    attend: (a, E) => a.t === 'jouer' && tuIdDe(E, a.u) === 'c014', vise: E => [enMain(E, 'c014'), '[data-ar="jouer"]'] },
  { info: true, quand: (E, d) => tourDe(E, d, 3), titre: 'Payer une attaque',
    texte: () => `Le coût, ce sont les Essences dessinées devant l'attaque. Une de couleur ${tuEss('rose')} veut <b>sa couleur</b> ; la <b>Neutre</b> ${tuEss('neutre')} prend <b>n'importe laquelle</b>. Trash-talk coûte ${tuEss('rose')}${tuEss('neutre')} ; avec Doig'Dance, ${tuEss('rose')} suffit. Une Essence payée s'éteint jusqu'à ton prochain tour.` },
  { info: true, quand: (E, d) => tourDe(E, d, 3), titre: 'Attaque contre Défense',
    texte: () => `Une attaque compare son <b>Attaque</b> à la <b>Défense</b> ${TU_DEF} de sa cible. <b>Égale ou plus haute</b> : la cible est <b>vaincue</b>, à la défausse. <b>Plus basse</b> : elle est <b>repoussée</b>. Contre un <b>CEO</b>, la valeur ne compte pas : il est <b>touché</b>, il perd un PV.` },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Attaque !', pos: 'bas',
    texte: () => 'Baby Driver s\'est <b>engagé</b> en attaquant : on peut le viser (un Joueur debout, non). Touche <b>Squeezie</b> : sa carte s\'ouvre en grand, et son attaque <b>s\'allume juste à côté</b>. Touche-la, puis <b>Baby Driver</b>. Ta première attaque ouvre la <b>phase de Combat</b> : plus de déploiement ensuite.',
    attend: (a, E) => a.t === 'attaquer' && a.u === tuU(E, 0, 'c012') && a.cible === tuU(E, 1, 'c059'),
    vise: E => [surPlateau(E, 0, 'c012'), `[data-ar="attaque"][data-u="${tuU(E, 0, 'c012')}"]`, surPlateau(E, 1, 'c059')],
    refus: 'Attaque Baby Driver avec Squeezie : c\'est lui qu\'on vise.' },
  { quand: (E, d) => tourDe(E, d, 3) && tuU(E, 1, 'c059'), titre: 'Encore une fois', pos: 'bas',
    texte: () => 'Son Shield a pris le coup ; la suivante passera. Attaque <b>Baby Driver</b> avec <b>Pas Compris</b>.',
    attend: (a, E) => a.t === 'attaquer' && a.u === tuU(E, 0, 'c013') && a.cible === tuU(E, 1, 'c059'),
    vise: E => [surPlateau(E, 0, 'c013'), `[data-ar="attaque"][data-u="${tuU(E, 0, 'c013')}"]`, surPlateau(E, 1, 'c059')],
    refus: 'Attaque Baby Driver avec Pas Compris.' },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Fin du tour',
    texte: () => 'Tes Essences sont toutes engagées : plus rien à payer. Termine ton tour.',
    attend: a => a.t === 'finTour', vise: () => ['.ar-fin'] },
  { quand: (E, d) => d && d.but === 'resilience', titre: 'Touché… et Résilience', pos: 'haut',
    texte: () => 'Tes deux Joueurs ont attaqué : ils sont <b>engagés</b>, personne ne peut défendre. Ton CEO est <b>touché</b> : son premier PV, <b>Mur Salvateur</b>, part dans ta main. Il a une <b>Résilience</b> : un effet que tu peux jouer <b>tout de suite, gratuitement</b>, quand la carte sort de tes PV. Joue-la.',
    attend: a => a.t === 'choix' && a.v === 'oui', vise: () => ['[data-ar="opt"][data-v="oui"]'] },
  { quand: (E, d) => d && d.but === 'buffDef', titre: 'Garde', pos: 'haut',
    texte: () => 'Touche un de tes Joueurs (ils s\'allument) : il gagne <b>Garde</b> jusqu\'à la fin du tour — il peut alors défendre <b>n\'importe quelle ligne</b>, pas seulement la sienne.',
    attend: a => a.t === 'choix',
    vise: E => { const d = Combat.demande(E); return ((d && d.options) || []).filter(o => o.u).map(o => `.ar-j[data-u="${o.u}"]`); } },
  { info: true, quand: (E, d) => tourDe(E, d, 5), titre: 'À toi de jouer',
    texte: E => `Le Rival a <b>${E.j[1].pv.length} PV</b> : touche son CEO jusqu'à ce qu'il n'en ait plus, puis une dernière fois. À retenir : <b>un Joueur</b> et <b>un Coach</b> par tour ; les Essences ne paient que les attaques ; <b>Attaque contre Défense</b> ; un Joueur <b>debout</b> peut défendre. Les bulles reviendront quand il se passera quelque chose de nouveau.`,
    alors: () => { tuto.libre = true; } }
];

/* Les remarques : la première fois que quelque chose arrive. `evs` : ce que
   l'action vient de produire ; `d` : la décision qui s'ouvre. */
const REMARQUES = [
  { id: 'rival', avant: (E, d) => E.tour === 2 && d.qui === 1 && d.type === 'tour', titre: 'Le tour du Rival',
    texte: () => 'Il joue en second : il <b>pioche</b>, et reçoit <b>deux Essences</b> à son premier tour pour compenser.' },
  { id: 'shield-vu', evs: (evs, E) => evs.some(e => e.t === 'deploie' && e.id === 'c059'), titre: 'Baby Driver',
    texte: () => 'Il a <b>Shield</b> : il ignore la <b>première attaque</b> qu\'il subit. Retiens-le.' },
  { id: 'repousse', evs: evs => evs.some(e => e.t === 'repousse' || e.t === 'defend'), quandTour: 2, titre: 'Repoussée',
    texte: () => 'L\'attaque s\'écrase sur Squeezie. Mais un défenseur <b>s\'engage</b> (sa carte s\'assombrit, marquée « Engagé ») : un Joueur engagé peut être <b>visé</b>, et ne peut plus défendre ce tour-ci.' },
  { id: 'shield', evs: evs => evs.some(e => e.t === 'shield'), titre: 'Shield !',
    texte: () => 'La première attaque contre Baby Driver est <b>ignorée</b> : c\'était son Shield. Il est maintenant sans protection.' },
  { id: 'vaincu', evs: evs => evs.some(e => e.t === 'vaincu'), titre: 'Vaincu',
    texte: (E, evs) => {
      const v = evs.find(e => e.t === 'vaincu');
      return v && v.j === 0
        ? 'Un de tes Joueurs est <b>vaincu</b> : il part à la défausse, avec ses Objets. Une ligne vide, c\'est un défenseur en moins.'
        : 'Quand l\'<b>Attaque</b> est au moins égale à la <b>Défense</b>, le Joueur est <b>vaincu</b> : à la défausse, avec ses Objets. Les Joueurs n\'ont pas de PV : seuls les CEO en ont.';
    } },
  { id: 'planete', evs: evs => evs.some(e => e.t === 'deploie' && e.id === 'c051'), titre: 'La Planète',
    texte: () => 'Elle a <b>Légion</b> : vaincue, elle peut revenir dans la main du Rival s\'il défausse une carte.' },
  { id: 'touche-lui', evs: evs => evs.some(e => e.t === 'touche' && e.j === 1), titre: 'Touché !',
    texte: E => `Le Rival récupère un PV dans sa main — lui aussi peut tomber sur une Résilience. ${E.j[1].pv.length ? `Plus que <b>${E.j[1].pv.length}</b>.` : ''} <b>La valeur de l'attaque ne compte pas</b> : une touche, un PV.` },
  { id: 'zero', evs: (evs, E) => E.tour >= 2 && E.j[1].pv.length === 0 && !E.fin, titre: 'Plus aucun PV',
    texte: () => 'Le Rival n\'a plus de PV : <b>la prochaine touche sur son CEO gagne la partie</b>.' },
  { id: 'legion', evs: evs => evs.some(e => e.t === 'legion'), titre: 'Légion',
    texte: () => 'Le Joueur vaincu revient dans la main de son propriétaire, contre une carte défaussée.' },
  { id: 'banc', evs: evs => evs.some(e => e.t === 'banc'), titre: 'Le Banc',
    texte: () => 'Une carte <b>benchée</b> quitte le jeu un moment : elle revient dans la main de son propriétaire <b>au début de son prochain tour</b>. Ce n\'est pas être vaincu.' },
  { id: 'touche-moi', evs: (evs, E) => E.tour > 4 && evs.some(e => e.t === 'touche' && e.j === 0), titre: 'Touché',
    texte: () => 'Chaque touche te coûte un PV, mais te donne une carte. Garder des Joueurs <b>désengagés</b>, c\'est garder des défenseurs.' },
  { id: 'garde', dec: (E, d) => tuto.libre && d.type === 'tour' && E.j[0].main.some(c => c.id === 'c074'), titre: 'Grand Respect',
    texte: () => 'Il a <b>Garde</b> : déployé, il peut défendre une attaque sur <b>n\'importe quelle ligne</b>. Son attaque coûte trois Neutres : n\'importe quelles Essences.' },
  { id: 'riposte', dec: (E, d) => d.but === 'riposte', titre: 'Riposte',
    texte: () => 'Ton Joueur vaincu peut déclencher une de ses attaques contre celui qui l\'a vaincu, pour une Essence de moins, payée avec tes Essences encore désengagées.' },
  { id: 'defense-libre', dec: (E, d) => tuto.libre && d.but === 'defense', titre: 'Défendre ?',
    texte: () => 'Un défenseur qui <b>tient</b> ne perd rien, mais s\'engage. Un défenseur qui <b>tombe</b> sauve un PV contre un Joueur. À toi de peser.' }
];

/* ---------- La bulle ---------- */
function tutoBulle(s, E, extra) {
  const T = Table.etat;
  if (!T) return null;
  let b = T.el.querySelector('.ar-tuto');
  if (!b) {
    b = document.createElement('div');
    b.className = 'ar-tuto';
    /* Ses clics restent à elle : le plateau ne les voit pas. */
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('[data-tuto="ok"]') && tuto && tuto.fermer) tuto.fermer();
    });
    T.el.appendChild(b);
  }
  const texte = typeof s.texte === 'function' ? s.texte(E, extra) : s.texte;
  const n = ETAPES.indexOf(s);
  b.className = 'ar-tuto' + (s.info || s.remarque ? ' bloque' : '') + (s.pos ? ' ' + s.pos : '');
  b.innerHTML = `<div class="ar-tuto-in" role="dialog" aria-live="polite">
      <small>${s.remarque ? 'Bon à savoir' : `Tutoriel · ${Math.max(1, n + 1)} / ${ETAPES.length}`}</small>
      <b>${s.titre}</b><p>${texte}</p>
      ${s.info || s.remarque ? '<button class="ar-b or" data-tuto="ok">Compris</button>' : ''}
    </div>`;
  b.hidden = false;
  /* La place qu'elle prend en bas : la carte agrandie s'y arrête (version
     3.0.7) — sur un petit écran, la bulle cachait l'attaque à toucher. */
  T.el.style.setProperty('--tuto-h', s.info || s.remarque ? '0px' : `${b.firstElementChild.offsetHeight + 16}px`);
  return b;
}
function tutoCacher() {
  const T = Table.etat;
  const b = T && T.el.querySelector('.ar-tuto');
  if (b) { b.hidden = true; b.innerHTML = ''; }
  if (T) T.el.style.setProperty('--tuto-h', '0px');
}
/* Une bulle à lire : la partie attend « Compris ». */
function tutoLire(s, E, extra) {
  return new Promise(res => {
    tuto.bloque = true;
    tuto.fermer = () => { tuto.bloque = false; tuto.fermer = null; tutoCacher(); SFX.jouer('carte'); res(); };
    if (!tutoBulle(s, E, extra)) tuto.fermer();
    tutoSurligner();
  });
}

/* ---------- Le déroulé ---------- */
async function tutoDerouler(E, d) {
  if (!tuto || tuto.occupe) return;
  tuto.occupe = true;
  try {
    while (tuto && tuto.i < ETAPES.length) {
      const s = ETAPES[tuto.i];
      if (tuto.attente === s) break;
      if (!s.quand(E, d)) break;
      if (s.info) {
        await tutoLire(s, E);
        if (!tuto) return;
        if (s.alors) s.alors();
        tuto.i++;
        continue;
      }
      tuto.attente = s;
      tutoBulle(s, E);
      tutoSurligner();
      break;
    }
  } finally { if (tuto) tuto.occupe = false; }
}

async function tutoRemarques(liste, E) {
  for (const [r, extra] of liste) {
    if (!tuto || tuto.vus.has(r.id)) continue;
    tuto.vus.add(r.id);
    await tutoLire(Object.assign({ remarque: true }, r), E, extra);
  }
}

/* ---------- Les crochets de l'arène ---------- */
function tutoPermis(a, E) {
  if (!tuto) return true;
  if (tuto.bloque) return 'Lis la bulle, puis touche « Compris ».';
  if (tuto.attente) {
    /* Le coup accepté est retenu : après coup, la carte peut avoir quitté
       la main ou le plateau (un Objet lié, un Moment joué, un Joueur
       vaincu), et on ne pourrait plus la reconnaître. */
    if (tuto.attente.attend(a, E)) { tuto.accepte = a; return true; }
    return tuto.attente.refus || `Le tutoriel attend autre chose : « ${tuto.attente.titre} ».`;
  }
  return true;
}
function tutoRefus(msg) {
  toast(msg);
  const b = Table.etat && Table.etat.el.querySelector('.ar-tuto');
  if (b) { b.classList.remove('secoue'); void b.offsetWidth; b.classList.add('secoue'); }
}

/* Ce que l'étape en cours demande de toucher brille. */
function tutoSurligner() {
  const T = Table.etat;
  if (!T || !tuto) return;
  T.el.querySelectorAll('.tuto-vise').forEach(x => x.classList.remove('tuto-vise'));
  const s = tuto.attente || (tuto.bloque && ETAPES[tuto.i]);
  if (!s || !s.vise) return;
  for (const sel of s.vise(T.E)) {
    try { T.el.querySelectorAll(sel).forEach(x => x.classList.add('tuto-vise')); } catch (e) { /* un sélecteur sans cible */ }
  }
}

function tutoDecision(E, d) {
  if (!tuto) return;
  (async () => {
    const liste = REMARQUES.filter(r => r.dec && !tuto.vus.has(r.id) && r.dec(E, d)).map(r => [r]);
    if (liste.length && !tuto.attente) await tutoRemarques(liste, E);
    await tutoDerouler(E, d);
  })();
}

async function tutoApres(evs, E, a, deMoi) {
  if (!tuto) return;
  if (deMoi && tuto.attente && tuto.accepte === a) {
    tuto.attente = null;
    tuto.accepte = null;
    tuto.i++;
    tutoCacher();
  }
  const liste = REMARQUES.filter(r => r.evs && !tuto.vus.has(r.id) && (!r.quandTour || r.quandTour === E.tour) && r.evs(evs, E)).map(r => [r, evs]);
  await tutoRemarques(liste, E);
}

async function tutoAvantIA(E, d) {
  if (!tuto) return;
  if (!tuto.attente) tutoCacher();
  const liste = REMARQUES.filter(r => r.avant && !tuto.vus.has(r.id) && r.avant(E, d)).map(r => [r]);
  await tutoRemarques(liste, E);
}

/* ---------- La fin ---------- */
async function tutoFin(E, gagne) {
  const deja = tutoFait();
  tuto = null;
  if (!gagne) return '<p class="ar-consigne">Pas grave : le tutoriel se rejoue autant que tu veux, depuis le Guide des Combats.</p>';
  try { localStorage.setItem(TUTO_CLE, '1'); } catch (e) { /* */ }
  let msg = '';
  try { await Backend.tutorielFini(); } catch (e) { msg = `<p class="ar-s-texte">${h(e.message || 'Le serveur n\'a pas répondu.')}</p>`; }
  return `<p class="ar-consigne">${deja ? 'Tutoriel réussi, encore une fois.' : 'Tutoriel réussi ! La quête « Premiers pas » est accomplie : ses 200 Éclats t\'attendent dans les Quêtes.'}</p>
    <p class="ar-s-texte">Tout le vocabulaire du jeu est dans le Guide, en glossaire. Prochaine étape : la campagne.</p>${msg}`;
}
