/* Le tutoriel : une partie écrite d'avance, pour apprendre en jouant. Né en
   3.0.6, réécrit en 3.0.7, et de nouveau en 3.0.12 pour les règles
   officielles (docs/regles-officielles.md).

   Les deux Clubs ne sont pas mélangés (`ordre`, js/combat/moteur.js) : la
   main, les PV et les pioches sont les mêmes à chaque partie. Le Rival joue
   des coups prévus pendant ses deux premiers tours (tutoRival), puis l'IA
   Débutant prend la main. Le joueur est guidé pendant ses trois premiers
   tours : une bulle dit quoi faire, le coup demandé s'allume, et l'arène
   refuse les autres (Table, option `guide`). Au cinquième tour la partie
   est libre, et des remarques arrivent la première fois que quelque chose
   se produit.

   Ce que la partie montre, dans l'ordre : le but (les PV, qui reviennent en
   main ; un Club vide), la main de départ et le mulligan, l'entretien
   (piocher, se désengager, une Essence), l'Arène, les quatre sortes de
   cartes et la carte en grand, déployer plusieurs Joueurs, lier un Objet,
   la restriction par couleur, pas de combat au tout premier tour, la fin du
   tour (5 cartes en main au plus), le tour adverse, défendre avec le Joueur
   de la même ligne, Shield, Légion, Provocation, un Moment, payer une
   attaque, l'attaque déclarée sur le CEO, le soutien d'un voisin, Attaque
   contre Défense, vaincu (à la défausse), Légion, toucher le CEO, la
   Résilience. Le Rival n'a que 2 PV (une vraie partie en compte 4 :
   REGLE.PV), pour que la partie tienne en cinq tours. La première victoire
   fait avancer la quête « Premiers pas »
   (supabase/installation/04_seed.sql, tutoriel_fini). */
"use strict";

/* Les Clubs, dans l'ordre : la main (5), les PV (4 pour toi, 2 pour le
   Rival), puis les pioches. 40 cartes chacun. */
const TUTO_MOI = [
  /* La main */ 'c078', 'c011', 'c085', 'c038', 'c097',
  /* Les PV, le premier d'abord */ 'c087', 'c016', 'c073', 'c017',
  /* Les pioches */ 'c013', 'c014', 'c074',
  'c012', 'c010', 'c015', 'c024', 'c078', 'c011', 'c013', 'c010', 'c073', 'c074', 'c016', 'c083', 'c085', 'c097', 'c017', 'c012', 'c014', 'c087',
  'c015', 'c024', 'c010', 'c012', 'c083', 'c011', 'c016', 'c013', 'c073', 'c078'];
const TUTO_LUI = [
  'c059', 'c051', 'c083', 'c055', 'c053',
  'c052', 'c080',
  'c092', 'c077', 'c088', 'c076', 'c052',
  'c080', 'c077', 'c088', 'c076', 'c059', 'c051', 'c053', 'c055', 'c092', 'c083', 'c087', 'c078', 'c075', 'c081', 'c052', 'c080', 'c077', 'c088',
  'c076', 'c059', 'c051', 'c053', 'c055', 'c092', 'c083', 'c087', 'c078', 'c075'];
const TUTO_PV = [4, 2];
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
      noms: [save.pseudo || 'Toi', 'Le Rival'], graine: 7, premier: 0, ordre: true, pv: TUTO_PV
    },
    moi: 0,
    ia: { niveau: 1, choisir: tutoRival },
    joueurs: [joueurMoi(), { nom: 'Le Rival', avatar: 'ess:mauve', frame: 'default' }],
    cosm: [e.cosm, { tapis: 't_base', sleeve: 's_base' }],
    brillantes: [brillantesMoi(), []],
    titre: 'Tutoriel', sousTitre: 'Une partie pour tout apprendre',
    abandon: 'tuto',
    premierRaison: 'Pour le tutoriel, tu commences.',
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
const place = l => `.ar-camp.moi .ar-place[data-ligne="${l}"]`;

/* ---------- Le Rival ---------- */
/* Ses deux premiers tours sont écrits. Tour 2 : le Coach Mercato, Baby
   Driver (case 1) en face de Vandale, La Planète (case 2) en face du
   Chevalier Rose, puis Baby Driver attaque ton CEO. Au tour 3, La Planète
   défend contre le Chevalier, et revient par Légion. Tour 4 : La Planète
   reprend sa case, Baby Driver attaque. Ensuite, l'IA Débutant. */
function tutoRival(E) {
  const d = Combat.demande(E);
  if (d.type === 'choix' && d.but === 'mulligan') return { t: 'choix', v: 'oui' };
  if (E.tour <= 4 && d.type === 'choix' && d.but === 'defense') {
    const pl = d.options.find(o => o.u && tuIdDe(E, o.u) === 'c051');
    return { t: 'choix', v: pl && tuIdDe(E, d.attaquant) === 'c078' ? pl.v : 'non' };
  }
  if (E.tour <= 4 && d.type === 'choix' && d.but === 'legion') return { t: 'choix', v: 'oui' };
  if (d.type === 'tour' && (E.tour === 2 || E.tour === 4)) {
    const o = Combat.optionsTour(E);
    const id = a => tuIdDe(E, a.u);
    const plan = E.tour === 2
      ? [a => a.t === 'jouer' && id(a) === 'c083', a => a.t === 'deployer' && id(a) === 'c059' && a.ligne === 0,
        a => a.t === 'deployer' && id(a) === 'c051' && a.ligne === 1, a => a.t === 'attaquer' && id(a) === 'c059' && a.cible === 'ceo']
      : [a => a.t === 'deployer' && id(a) === 'c051' && a.ligne === 1, a => a.t === 'attaquer' && id(a) === 'c059' && a.cible === 'ceo'];
    for (const f of plan) { const a = o.find(f); if (a) return a; }
    return { t: 'finTour' };
  }
  return IA.choisir(E, { niveau: 1 });
}

/* ---------- Le scénario ---------- */
/* Une étape « à lire » (info) s'affiche et attend « Compris ». Une étape « à
   faire » allume ce qu'il faut toucher, et seul le coup `attend` passe. */
const tourDe = (E, d, n) => d && d.type === 'tour' && d.qui === 0 && E.tour === n;
/* Les petits signes des bulles : une Essence, la Défense. */
const tuEss = c => (typeof essIcon === 'function' ? essIcon(c, 'tu-ico') : '');
const TU_DEF = '<svg class="tu-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z" fill="#1e1d28" stroke="#fff" stroke-width="1.8"/></svg>';
const ETAPES = [
  { info: true, quand: (E, d) => d && d.but === 'mulligan', titre: 'Bienvenue dans l\'arène',
    texte: () => 'Deux <b>CEO</b> : toi en bas, le Rival en haut. Chacun a des <b>Points de Victoire</b> (PV), des cartes face cachée (4 dans une vraie partie, 2 pour le Rival aujourd\'hui). <b>Touché</b>, un CEO prend son premier PV <b>en main</b>. Tu gagnes en touchant le CEO adverse <b>quand il n\'a plus de PV</b>, ou s\'il doit piocher dans un Club vide.' },
  { quand: (E, d) => d && d.but === 'mulligan', titre: 'Ta main de départ',
    texte: () => 'Cinq cartes. Une fois, tu peux les remélanger dans ton Club pour en piocher cinq autres. Celle-ci est bonne : <b>garde-la</b>. Ensuite viennent les PV, puis le tirage au sort de qui commence.',
    attend: a => a.t === 'choix' && a.v === 'oui', vise: () => ['[data-ar="opt"][data-v="oui"]'] },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'L\'entretien', vise: () => ['.ar-info.phases', '.ar-zone.moi .ar-ess-zone'],
    texte: () => `Chaque tour suit quatre phases, allumées au milieu : <b>Entretien</b>, <b>Action</b>, <b>Combat</b>, <b>Fin</b>. L'entretien se fait tout seul : tu <b>pioches</b> une carte, tes cartes se <b>désengagent</b>, et la première Essence de ta <b>Réserve</b> entre en jeu (une Rose ${tuEss('rose')}).` },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'Ton Terrain', vise: () => ['.ar-camp.moi .ar-lignes', '.ar-ceo.moi'],
    texte: () => '<b>Trois cases</b>, face à celles du Rival : une case et celle d\'en face forment une <b>ligne</b>. À côté : ta Réserve, ta <b>Défausse</b> (tout ce qui est joué, vaincu ou bench y va) et ton <b>Club</b>. Tes PV sont près de ton CEO.' },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'Quatre sortes de cartes', vise: () => ['.ar-main'],
    texte: () => '<b>Joueurs</b> : sur tes cases, ils attaquent et défendent. <b>Objets</b> : liés à un Joueur, ils le renforcent. <b>Moments</b> : un effet, autant que tu veux. <b>Coachs</b> : un effet, <b>un seul par tour</b>. Jouer une carte ne coûte rien : seules les <b>attaques</b> se paient. Touche une carte pour la voir <b>en grand</b>.' },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Déploie un Joueur',
    texte: () => 'C\'est la phase d\'<b>Action</b>. Touche <b>Le Chevalier Rose</b>, puis la <b>case du milieu</b>.',
    attend: (a, E) => a.t === 'deployer' && tuIdDe(E, a.u) === 'c078' && a.ligne === 1 && !a.remplace, vise: E => [enMain(E, 'c078'), place(1)],
    refus: 'Pose Le Chevalier Rose sur la case du milieu.' },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Et un deuxième',
    texte: () => 'On déploie <b>autant de Joueurs qu\'on veut</b>, tant qu\'il reste des cases. Pose <b>Vandale</b> sur la <b>case de gauche</b>.',
    attend: (a, E) => a.t === 'deployer' && tuIdDe(E, a.u) === 'c011' && a.ligne === 0 && !a.remplace, vise: E => [enMain(E, 'c011'), place(0)],
    refus: 'Pose Vandale sur la case de gauche.' },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Lie un Objet',
    texte: () => '<b>Cooked</b> donne +30 Attaque. Touche-le, puis touche <b>Vandale</b> : il le portera tant qu\'il reste en jeu. Un Joueur porte autant d\'Objets qu\'on veut.',
    attend: (a, E) => a.t === 'lier' && tuIdDe(E, a.u) === 'c085' && a.cible === tuU(E, 0, 'c011'), vise: E => [enMain(E, 'c085'), surPlateau(E, 0, 'c011')],
    refus: 'Lie Cooked à Vandale.' },
  { info: true, quand: (E, d) => tourDe(E, d, 1), titre: 'La restriction par couleur', vise: E => [enMain(E, 'c038')],
    texte: () => `<b>Caprice de Gotaga</b> est une carte Jade ${tuEss('jade')}. Un Objet, un Moment ou un Coach d'une couleur ne se joue que si une <b>Essence de sa couleur</b> est en jeu. Tu n'as que du Rose ${tuEss('rose')} : elle attendra. Les cartes Neutres ${tuEss('neutre')}, elles, se jouent toujours.` },
  { quand: (E, d) => tourDe(E, d, 1), titre: 'Fin du tour',
    texte: () => 'Le <b>tout premier tour</b> de la partie n\'a <b>pas de phase de Combat</b>. À la fin de chaque tour, on garde <b>5 cartes en main au plus</b> (le surplus va à la défausse). Touche « Fin du tour ».',
    attend: a => a.t === 'finTour', vise: () => ['.ar-fin'], refus: 'Garde tes autres cartes pour plus tard : touche « Fin du tour ».' },
  { quand: (E, d) => d && d.but === 'defense' && E.tour === 2, titre: 'On t\'attaque !', pos: 'haut',
    texte: () => `Baby Driver attaque : une attaque se déclare toujours <b>sur le CEO</b> (la flèche). Le Joueur de la <b>même ligne</b>, s'il est désengagé, peut <b>défendre</b> : on compare l'Attaque <b>40</b> à sa Défense ${TU_DEF}<b>90</b>. Plus basse : il tient. Défends avec <b>Vandale</b>.`,
    attend: (a, E) => a.t === 'choix' && a.v === tuU(E, 0, 'c011'), vise: E => [`[data-ar="opt"][data-v="${tuU(E, 0, 'c011')}"]`] },
  { info: true, quand: (E, d) => tourDe(E, d, 3), titre: 'Un nouvel entretien', vise: () => ['.ar-zone.moi .ar-ess-zone'],
    texte: () => `Vandale s'était <b>engagé</b> en défendant (tourné de côté) : l'entretien l'a <b>redressé</b>. Tu as pioché, et une <b>deuxième Essence</b> ${tuEss('rose')} est arrivée.` },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Provocation',
    texte: () => '<b>Pas Compris</b> a Provocation : l\'attaquant <b>face à lui</b> doit le cibler. Pose-le sur la <b>case de droite</b>.',
    attend: (a, E) => a.t === 'deployer' && tuIdDe(E, a.u) === 'c013' && a.ligne === 2 && !a.remplace, vise: E => [enMain(E, 'c013'), place(2)],
    refus: 'Pose Pas Compris sur la case de droite.' },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Un Moment',
    texte: () => `<b>Doig'Dance</b> (Neutre ${tuEss('neutre')}) : ta première attaque du tour coûte une Essence Neutre de moins. Touche-la, puis « Jouer ce Moment ».`,
    attend: (a, E) => a.t === 'jouer' && tuIdDe(E, a.u) === 'c097', vise: E => [enMain(E, 'c097'), '[data-ar="jouer"]'] },
  { info: true, quand: (E, d) => tourDe(E, d, 3), titre: 'Attaquer',
    texte: () => `Les Essences dessinées devant une attaque sont son coût : une de couleur ${tuEss('rose')} veut sa couleur, une <b>Neutre</b> ${tuEss('neutre')} n'importe laquelle. Attaquer <b>engage</b> le Joueur, et ouvre la <b>phase de Combat</b> : on n'y joue plus que des attaques. Baby Driver est encore engagé (il a attaqué) : il ne peut pas défendre.` },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Attaque !', pos: 'bas',
    texte: () => 'Touche <b>Le Chevalier Rose</b>, puis son attaque <b>Estafilade</b> (gratuite grâce à Doig\'Dance). Elle se déclare sur le CEO du Rival.',
    attend: (a, E) => a.t === 'attaquer' && a.u === tuU(E, 0, 'c078') && a.k === 0,
    vise: E => [surPlateau(E, 0, 'c078'), `[data-ar="attaque"][data-u="${tuU(E, 0, 'c078')}"][data-k="0"]`],
    refus: 'Attaque avec Le Chevalier Rose : Estafilade.' },
  { quand: (E, d) => d && d.but === 'soutien' && E.tour === 3, titre: 'Le soutien', pos: 'haut',
    texte: () => `La Planète défend : ta valeur <b>90</b> contre sa Défense ${TU_DEF}<b>110</b>, ça ne passe pas. Mais un Joueur <b>voisin</b> de l'attaquant peut le <b>soutenir</b> : il paie et engage son attaque, et sa valeur <b>s'ajoute</b>. Choisis <b>Vandale</b> (+120 avec Cooked).`,
    attend: a => a.t === 'choix' && a.v !== 'non',
    vise: E => [`.ar-sheet [data-ar="opt"][data-v^="${tuU(E, 0, 'c011')}:"]`] },
  { quand: (E, d) => tourDe(E, d, 3) && E.j[1].pv.length === TUTO_PV[1], titre: 'Touche son CEO', pos: 'bas',
    texte: () => 'Personne ne peut défendre la ligne de <b>Pas Compris</b> : sa case d\'en face est vide. Attaque avec lui : l\'attaque <b>touche le CEO</b>.',
    attend: (a, E) => a.t === 'attaquer' && a.u === tuU(E, 0, 'c013'),
    vise: E => [surPlateau(E, 0, 'c013'), `[data-ar="attaque"][data-u="${tuU(E, 0, 'c013')}"]`],
    refus: 'Attaque avec Pas Compris.' },
  { quand: (E, d) => tourDe(E, d, 3), titre: 'Fin du tour',
    texte: () => 'Tes Essences sont toutes engagées : termine ton tour. Tes trois Joueurs ont attaqué ou soutenu : ils restent engagés jusqu\'à ton prochain entretien, et <b>ne pourront pas défendre</b>.',
    attend: a => a.t === 'finTour', vise: () => ['.ar-fin'] },
  { quand: (E, d) => d && d.but === 'resilience', titre: 'Touché… et Résilience', pos: 'haut',
    texte: () => 'Ton CEO est touché : il regarde son premier PV, <b>Gros Bonnet</b>. Il a une <b>Résilience</b> : au lieu de prendre la carte en main, tu peux jouer son effet <b>tout de suite, gratuitement</b>. Ici : « jouez cette carte ». Joue-la.',
    attend: a => a.t === 'choix' && a.v === 'oui', vise: () => ['[data-ar="opt"][data-v="oui"]'] },
  { quand: (E, d) => d && d.but === 'lierAllie' && E.tour === 4, titre: 'Gros Bonnet', pos: 'haut',
    texte: () => 'Gros Bonnet (+30 Défense) se lie à un de tes Joueurs : touche celui que tu veux (ils s\'allument).',
    attend: a => a.t === 'choix',
    vise: E => { const d = Combat.demande(E); return ((d && d.options) || []).filter(o => o.u).map(o => `.ar-j[data-u="${o.u}"]`); } },
  { info: true, quand: (E, d) => tourDe(E, d, 5), titre: 'À toi de jouer',
    texte: E => `Le Rival n'a plus que <b>${E.j[1].pv.length} PV</b>. Baby Driver est engagé : la ligne de Vandale est libre, celle de Pas Compris aussi. Touche son CEO jusqu'à ce qu'il n'ait plus de PV, puis <b>une dernière fois</b>. Une bulle reviendra si quelque chose de nouveau arrive.`,
    alors: () => { tuto.libre = true; } }
];

/* Les remarques : la première fois que quelque chose arrive. `evs` : ce que
   l'action vient de produire ; `d` : la décision qui s'ouvre. */
const REMARQUES = [
  { id: 'rival', avant: (E, d) => E.tour === 2 && d.qui === 1 && d.type === 'tour', titre: 'Le tour du Rival',
    texte: () => 'Son entretien : il pioche, se désengage, joue une Essence. Lui peut <b>attaquer dès son premier tour</b> : seul le tout premier tour de la partie n\'a pas de combat.' },
  { id: 'shield-vu', evs: evs => evs.some(e => e.t === 'deploie' && e.id === 'c059'), titre: 'Baby Driver',
    texte: () => 'Il a <b>Shield</b> : tant qu\'il est en jeu, il <b>ignore la première attaque</b> qu\'il subit.' },
  { id: 'planete', evs: evs => evs.some(e => e.t === 'deploie' && e.id === 'c051'), titre: 'La Planète',
    texte: () => 'Elle a <b>Légion</b> : vaincue, elle peut revenir dans la main du Rival s\'il défausse une carte.' },
  { id: 'tient', evs: evs => evs.some(e => e.t === 'repousse'), titre: 'Il tient',
    texte: () => '40 contre 90 : l\'attaque ne passe pas, et les dégâts ne restent pas. Mais défendre <b>engage</b> : Vandale est tourné de côté, il ne pourra ni attaquer ni défendre avant ton prochain entretien.' },
  { id: 'defausse-fin', evs: (evs, E) => E.tour <= 3 && evs.some(e => e.t === 'defausse' && e.j === 1), titre: 'La fin de son tour',
    texte: () => 'Le Rival avait <b>6 cartes</b> en main : à la fin du tour, on en garde <b>5 au plus</b>. Il en défausse une.' },
  { id: 'vaincu', evs: evs => evs.some(e => e.t === 'vaincu'), titre: 'Vaincu',
    texte: (E, evs) => {
      const v = evs.find(e => e.t === 'vaincu');
      return v && v.j === 0
        ? 'Un de tes Joueurs est <b>vaincu</b> : il part à la défausse, avec ses Objets. Une case vide, c\'est un défenseur en moins.'
        : '210 contre 110 : quand l\'Attaque est <b>au moins égale</b> à la Défense, le défenseur est <b>vaincu</b> — à la défausse, avec ses Objets. Les Joueurs n\'ont pas de PV : seuls les CEO en ont.';
    } },
  { id: 'legion', evs: evs => evs.some(e => e.t === 'legion'), titre: 'Légion',
    texte: () => 'Le Rival a défaussé une carte pour reprendre La Planète en main : elle reviendra.' },
  { id: 'touche-lui', evs: evs => evs.some(e => e.t === 'touche' && e.j === 1), titre: 'Touché !',
    texte: E => `Le Rival prend son premier PV dans sa main. ${E.j[1].pv.length ? `Plus que <b>${E.j[1].pv.length}</b>.` : ''} Contre un CEO, la valeur de l'attaque ne compte pas : une touche, un PV.` },
  { id: 'zero', evs: (evs, E) => E.tour >= 2 && E.j[1].pv.length === 0 && !E.fin, titre: 'Plus aucun PV',
    texte: () => 'Le Rival n\'a plus de PV : <b>la prochaine attaque qui touche son CEO gagne la partie</b>.' },
  { id: 'remplace', dec: (E, d) => tuto.libre && d.type === 'tour' && Combat.optionsTour(E).some(a => a.t === 'deployer' && a.remplace), titre: 'Trois cases prises',
    texte: () => 'Pour déployer un Joueur quand tes trois cases sont prises : <b>une fois par tour</b>, tu peux <b>bench</b> un de tes Joueurs non engagés (il part à la défausse) et poser le nouveau à sa place. Touche le Joueur de ta main, puis celui à remplacer.' },
  { id: 'garde', dec: (E, d) => tuto.libre && d.type === 'tour' && E.j[0].main.some(c => c.id === 'c074'), titre: 'Grand Respect',
    texte: () => 'Il a <b>Garde</b> : il peut défendre <b>n\'importe quelle attaque</b>, pas seulement celle de sa ligne.' },
  { id: 'riposte', dec: (E, d) => d.but === 'riposte', titre: 'Riposte',
    texte: () => 'Ton Joueur vaincu peut déclencher une de ses attaques contre celui qui l\'a vaincu, pour une Essence de moins, payée avec tes Essences encore désengagées.' },
  { id: 'banc', evs: evs => evs.some(e => e.t === 'banc'), titre: 'Bench',
    texte: () => '« Bench » une carte, c\'est l\'envoyer à la <b>défausse</b>. Ce n\'est pas être vaincu : ni Riposte, ni Légion.' },
  { id: 'defense-libre', dec: (E, d) => tuto.libre && d.but === 'defense', titre: 'Défendre ?',
    texte: () => 'Défendre engage ton Joueur, et il tombe si l\'Attaque atteint sa Défense. Ne pas défendre coûte un PV, mais ce PV arrive dans ta main.' },
  { id: 'soutien-libre', dec: (E, d) => tuto.libre && d.but === 'soutien', titre: 'Soutenir ?',
    texte: () => 'Un soutien engage aussi ton voisin : il ne pourra plus défendre jusqu\'à ton prochain entretien.' },
  { id: 'touche-moi', evs: (evs, E) => E.tour > 4 && evs.some(e => e.t === 'touche' && e.j === 0), titre: 'Touché',
    texte: () => 'Chaque touche te coûte un PV, mais te donne une carte. Garder des Joueurs <b>désengagés</b>, c\'est garder des défenseurs.' }
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
    <p class="ar-s-texte">Toutes les règles sont dans le Guide (onglet Combats), avec un glossaire. Prochaine étape : la campagne.</p>${msg}`;
}
