/* L'onglet Combats (version 3.0).

   Une page d'accueil qui tient dans l'écran, sans défiler : un bandeau
   illustré (le chevalier du tapis « La Luxueuse III », centré sur son
   médaillon), la Section et le niveau ; à la une, le Raid (js/raid.js) ;
   deux portes illustrées, Solo (contre l'IA, sur « 99% Faith ») et Versus
   (entre amis, sur « Marteen Supreme ») ; trois petites tuiles, Decks,
   Missions et Guide. Solo mène à deux modes bien distincts :
   la Campagne (vingt rivaux sur un chemin, acte par acte) et l'Arcade (un
   adversaire tiré au sort, cinq difficultés). Chaque page a un retour vers
   la précédente. Le combat se joue dans l'arène, en plein écran
   (js/combat/table.js) ; l'atelier de decks a son fichier
   (js/combat/atelier.js).

   Le serveur décide de tout ce qui rapporte : la Section rejointe, les
   decks enregistrés, les récompenses et l'XP d'un combat
   (supabase/23_combats.sql, 26_niveaux.sql). Le combat, lui, se joue dans
   la page : le serveur fournit la graine, et reçoit le résultat. */
"use strict";

let cbVue = 'accueil';
/* La difficulté choisie en Arcade ; l'acte de campagne affiché (null : celui
   du prochain combat). */
let cbChoix = { infini: 3, acte: null };
let cbGuide = null;
/* L'onglet du Guide : les règles (par défaut) ou le glossaire. */
let cbGuideOnglet = 'regles';
const CB_VUES = ['accueil', 'solo', 'campagne', 'arcade', 'raid', 'versus', 'decks', 'missions', 'guides', 'atelier'];
/* Les anciennes adresses mènent encore quelque part. */
const CB_ALIAS = { infini: 'arcade', defis: 'versus' };
/* La page d'où l'on vient, pour le bouton retour. */
const CB_PARENT = { campagne: 'solo', arcade: 'solo' };
const CLE_COMBAT = 'mtcg.combat.encours';

/* ---------- L'état de combat du joueur ---------- */
/* Rangé par Backend.apply (save.combat), avec des valeurs par défaut hors
   ligne. */
function cbEtat() {
  const c = save.combat || {};
  return {
    section: c.section || null,
    decks: c.decks || [],
    deckActif: c.deck_actif || null,
    cosm: Object.assign({ tapis: 't_base', sleeve: 's_base' }, c.cosm || {}),
    campagne: Object.assign({ faits: [], finie: false }, c.campagne || {}),
    jour: Object.assign({ recompensees: 0, plafond: PVE_PLAFOND, defis: 0, defis_plafond: DEFI_GAIN.plafond }, c.jour || {}),
    stats: Object.assign({ victoires: 0, defaites: 0, pvp_v: 0, pvp_d: 0 }, c.stats || {}),
    xp: c.xp || 0,
    defis: c.defis || []
  };
}

/* Tous les decks jouables : ceux du joueur, puis le Starter Deck de sa
   Section (prêté), puis l'autre une fois la campagne finie. */
function cbDecks() {
  const e = cbEtat();
  const l = e.decks.slice();
  if (e.section) l.push(Object.assign({}, Decks.STARTERS[e.section]));
  const autre = e.section && autreSection(e.section);
  if (autre && e.campagne.finie) l.push(Object.assign({}, Decks.STARTERS[autre]));
  return l;
}
function cbDeckActif() {
  const l = cbDecks();
  const e = cbEtat();
  return l.find(d => d.id === e.deckActif && deckValide(d)) || l.find(deckValide) || null;
}
/* Ce qu'on possède, pour vérifier un deck : un Starter Deck est prêté. */
const deckValide = d => !Decks.verifier(d, d.starter ? null : save.col).length;

/* ---------- La navigation ---------- */
function allerCb(vue) {
  vue = CB_ALIAS[vue] || vue;
  if (vue !== 'campagne') cbLabo = null;
  cbVue = CB_VUES.includes(vue) ? vue : 'accueil';
  if (cbVue === 'campagne') cbChoix.acte = null;
  if (tab !== 'combats') return aller('combats');
  render();
  const m = $('#main');
  if (m) m.scrollTo({ top: 0 });
}

/* ---------- L'onglet ---------- */
function vCombats() {
  const e = cbEtat();
  /* Sans Section, tout mène au choix — sauf « Apprendre d'abord » : le Guide
     (et le tutoriel) se lisent avant de choisir ; son retour y ramène. */
  if (!e.section) return cbVue === 'guides' ? `<div class="cb cb-v-guides">${vCbGuides(e)}</div>` : vChoixSection();
  if (cbVue === 'atelier' && typeof vAtelier === 'function') return vAtelier();
  const corps = {
    accueil: vCbAccueil, solo: vCbSolo, campagne: vCbCampagne, arcade: vCbArcade, raid: vCbRaid,
    versus: vCbDefis, decks: vCbDecks, missions: vCbMissions, guides: vCbGuides
  }[cbVue] || vCbAccueil;
  return `<div class="cb sec-${e.section} cb-v-${cbVue}" style="--sc:${SECTIONS[e.section].c};--sc2:${SECTIONS[e.section].c2}">${corps(e)}</div>`;
}

/* L'en-tête d'une page : le retour (vers l'accueil, ou vers Solo pour la
   Campagne et l'Arcade), le titre, et à droite ce que la page veut y mettre. */
const cbSousTete = (titre, sous, droite) => `<header class="cb-sous">
  <button class="cb-retour" data-cb="vue" data-v="${CB_PARENT[cbVue] || 'accueil'}" aria-label="Retour">${NAVICO.caret}</button>
  <div class="cb-sous-t"><h1>${h(titre)}</h1>${sous ? `<p>${sous}</p>` : ''}</div>${droite || ''}</header>`;

/* L'emblème d'une Section : une étoile à ses couleurs. */
const emblemeSection = id => `<i class="cb-embleme sec-${id}" aria-hidden="true">${ICON.star}</i>`;

/* Le niveau de combattant : un badge, et la barre jusqu'au suivant. */
function vCbNiveau(e, grand) {
  const n = niveauDe(e.xp);
  const pct = Math.round(100 * n.dans / n.requis);
  return `<button class="cb-niv${grand ? ' grand' : ''}" data-cb="niveau" aria-label="Niveau ${n.niveau} : ${n.dans} XP sur ${n.requis}">
    <span class="cb-niv-n"><small>Niv.</small><b class="tnum">${n.niveau}</b></span>
    <span class="cb-niv-t"><span class="cb-niv-barre"><i style="width:${pct}%"></i></span><small class="tnum">${fmtN(n.dans)} / ${fmtN(n.requis)} XP</small></span>
  </button>`;
}

/* Le niveau, en médaillon : l'anneau autour se remplit avec l'XP. Sur le
   bandeau de l'accueil, à la place de la barre : il laisse voir l'image. */
function vCbNivAnneau(e) {
  const n = niveauDe(e.xp);
  return `<button class="cb-anneau" data-cb="niveau" style="--p:${Math.round(100 * n.dans / n.requis)}%" aria-label="Niveau ${n.niveau} : ${n.dans} XP sur ${n.requis}">
    <span><small>Niv.</small><b class="tnum">${n.niveau}</b></span></button>`;
}

/* Le détail du niveau : ce qui attend, et comment on gagne de l'XP. */
function ouvrirNiveau() {
  const e = cbEtat();
  const n = niveauDe(e.xp);
  const palier = r => [r.boosters ? `${r.boosters} booster${r.boosters > 1 ? 's' : ''}` : '', r.fragments ? `${fmtN(r.fragments)} Fragments` : '',
    r.cadre ? `cadre « ${h((FRAMES[r.cadre] || {}).nom || r.cadre)} »` : '', r.titre ? `titre « ${h((TITRES[r.titre] || {}).nom || r.titre)} »` : ''].filter(Boolean).join(', ');
  openSheet({
    title: `Niveau ${n.niveau}`,
    body: `<div class="cb-nivfiche">
        <div class="cb-niv-barre grand"><i style="width:${Math.round(100 * n.dans / n.requis)}%"></i></div>
        <p class="tnum"><b>${fmtN(n.requis - n.dans)} XP</b> avant le niveau ${n.niveau + 1} · ${fmtN(e.xp)} XP en tout</p>
        <h4>Ce qui attend</h4>
        <ul class="cb-paliers">${prochainsPaliers(n.niveau, 4).map(r => `<li><b>Niveau ${r.niveau}</b><span>${palier(r)}${r.eclats ? ` et ${r.eclats} Éclats` : ''}</span></li>`).join('')}</ul>
        <p class="muted small">Chaque niveau rapporte aussi ${NIVEAUX.eclats} Éclats.</p>
        <h4>Gagner de l'XP</h4>
        <p class="small">Chaque combat fini en rapporte, <b>sans limite par jour</b> : ${NIVEAUX.victoire} pour une victoire en Normal, ${NIVEAUX.defaite} pour une défaite, plus pour un adversaire plus fort (×${NIVEAUX.facteur[5]} en Légende), +${NIVEAUX.parVaincu} par Joueur adverse vaincu. Un défi entre amis : ${NIVEAUX.defi.victoire} ou ${NIVEAUX.defi.defaite}. Ne comptent pas : les combats de moins de 20 secondes, et les défaites de moins de ${NIVEAUX.toursDefaite} tours.</p>
      </div>`,
    actions: [{ label: 'Voir les missions', primary: true, fn: () => { closeSheet(); allerCb('missions'); } }, { label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- Choisir sa Section ---------- */
function vChoixSection() {
  const carte = (id, s) => `<button class="cb-sec sec-${id}" data-cb="section" data-v="${id}" style="--sc:${s.c};--sc2:${s.c2}">
      <span class="cb-sec-boite"><img src="${s.boite}" alt="Starter Deck ${h(s.nom)}"></span>
      <span class="cb-sec-txt"><b>${h(s.nom)}</b><small>${h(s.devise)}</small>
        <em>Tu reçois sa Promo et son Starter Deck</em></span>
    </button>`;
  return `<div class="cb-choix">
    <div class="cb-choix-tete">
      <small>Version 3.0 · Pré-build</small>
      <h1>Choisis ta Section</h1>
      <p class="muted">Deux Sections, comme les deux Starter Decks. Ta Section te donne sa Promo et son deck, et tu affronteras l'autre en campagne.</p>
    </div>
    <div class="cb-secs">${carte('toxique', SECTIONS.toxique)}<span class="cb-vs">VS</span>${carte('deter', SECTIONS.deter)}</div>
    <p class="muted small cb-choix-pied">Ce choix est définitif. La Promo de l'autre Section se gagne en finissant la campagne.</p>
    <button class="btn ghost" data-cb="vue" data-v="guides">Apprendre d'abord (tutoriel, glossaire)</button>
  </div>`;
}

function choisirSection(id) {
  const s = SECTIONS[id];
  openSheet({
    title: `Rejoindre la ${s.nom} ?`,
    body: `<div class="cb-confirm sec-${id}"><img src="${s.boite}" alt=""><p class="muted">${h(s.devise)}</p>
      <p>Tu reçois la Promo <b>${h((byId[s.promo] || {}).nom || s.promo)}</b> et le Starter Deck. Ce choix est définitif.</p></div>`,
    actions: [
      { label: 'Rejoindre', primary: true, fn: () => { closeSheet(); agir(() => Backend.combatSection(id), `Bienvenue dans la ${s.nom} !`).then(ok => { if (ok) { cbVue = 'accueil'; render(); proposerTutoriel(); } }); } },
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}

/* Juste après avoir rejoint une Section : apprendre en jouant ? */
function proposerTutoriel() {
  if (typeof tutoFait !== 'function' || tutoFait()) return;
  openSheet({
    title: 'Apprendre en jouant ?',
    body: '<p>Une partie guidée, bulle après bulle : déployer, attaquer, défendre, les PV, la Résilience, les mots-clés. Quelques minutes, et 200 Éclats la première fois. Elle se rejoue quand tu veux, depuis le Guide.</p>',
    actions: [
      { label: 'Lancer le tutoriel', primary: true, fn: () => { closeSheet(); lancerTutoriel(); } },
      { label: 'Plus tard', fn: closeSheet }
    ]
  });
}

/* ---------- L'accueil ---------- */
/* Les missions de combat à récupérer (js/quests.js). */
const cbMissionsPretes = () => (save.quetes || []).filter(q => estMissionCombat(q) && questePrete(q)).length;

/* Les icônes des portes et des tuiles : au trait, en deux tons (le fond
   teinté, le trait clair ; css/combat.css). Solo : un cavalier d'échecs, la
   pièce qu'on joue seul contre la machine. Versus : deux cartes qui se font
   face, et l'éclair du duel entre elles. */
const CB_ICO = {
  solo: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="f" d="M15.5 37c.4-5.6 2.8-8.9 6.6-11.6l-5.4.6c-2.6.1-4.6-1.9-4.2-4.4l2-3.6c2.6-3.6 6.2-6.4 10.3-7.8l1.9-4.6 2.6 4.1c4.6 2.6 6.8 8.1 6.3 14.6-.4 4.9-1.5 8.7-2 12.7z"/><path d="M29.8 11.8c2.6 3.6 3.2 8.4 2.1 13.6"/><circle cx="24.2" cy="15.6" r="1.3" class="e"/><rect class="f" x="12" y="37" width="24" height="5" rx="2"/></svg>',
  versus: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="4.5" y="13" width="16" height="23" rx="3" transform="rotate(-14 12.5 24.5)"/><rect class="f" x="27.5" y="13" width="16" height="23" rx="3" transform="rotate(14 35.5 24.5)"/><path class="e" d="M26.5 6.5 19 22h5.2l-3.2 11.5L30 17.5h-5.4z"/></svg>',
  decks: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="9" y="13" width="20" height="28" rx="3.5"/><path d="M15 9h17a3.5 3.5 0 0 1 3.5 3.5V34"/><path d="M21 5h12a6 6 0 0 1 6 6v18"/></svg>',
  missions: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="10" y="8" width="28" height="33" rx="4"/><path d="M17 21.5l4 4 9-9M17 32h14"/></svg>',
  guide: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="f" d="M8 11.5c5.5-2 11-1.5 16 1.5v26c-5-3-10.5-3.5-16-1.5z"/><path class="f" d="M40 11.5c-5.5-2-11-1.5-16 1.5v26c5-3 10.5-3.5 16-1.5z"/></svg>'
};

/* Les illustrations des portes : Solo sur « 99% Faith » (#068), l'Arcade
   sur « Monster » (#102), Versus sur « Marteen Supreme » (#023). */
const COUV = { solo: 'c068', arcade: 'c102', versus: 'c023' };

/* Le fond d'une porte : l'illustration d'une carte (sa partie haute).
   L'adresse est absolue : dans une variable CSS, une adresse relative se
   lirait depuis la feuille de style (css/), pas depuis la page. */
const cbArt = id => { const c = byId[id]; return c && c.img ? ` style="--art:url('${h(new URL(c.img, location.href).href)}')"` : ''; };

function vCbAccueil(e) {
  const deck = cbDeckActif();
  const fait = new Set(e.campagne.faits);
  const enCours = combatEnCours();
  const defis = e.defis.filter(d => d.pour_moi && d.statut === 'attente').length;
  const missions = cbMissionsPretes();
  if (!rdEtat) relireRaid();
  const petit = (v, ico, titre, sous, n) => `<button class="cb-petit" data-cb="vue" data-v="${v}">
      <span class="cb-petit-ico">${CB_ICO[ico]}</span><b>${titre}</b><small>${sous}</small>${n ? `<i class="rf-pastille">${n}</i>` : ''}
    </button>`;
  /* Version 3.0.7 : tant que le tutoriel n'est pas fait, il a sa propre
     tuile, sous le Raid — une pastille « Nouveau » sur la petite tuile du
     Guide ne suffisait pas à le faire voir. */
  const tuto = typeof tutoFait === 'function' && !tutoFait();
  return `<section class="cb-hero">
      <span class="cb-hero-art" aria-hidden="true"></span>
      <div class="cb-hero-haut"><span class="cb-badge" title="Ta Section">${emblemeSection(e.section)}<b>${h(SECTIONS[e.section].court)}</b></span>${vCbNivAnneau(e)}</div>
      <h1 class="cb-hero-titre">Combats</h1>
    </section>
    ${enCours ? `<section class="cb-une cb-reprendre"><span class="cb-une-t"><small>Combat en cours</small><b>${h(enCours.meta && enCours.meta.titre || 'Combat')}</b><em>Reprends-le où tu l'as laissé.</em></span>
      <span class="cb-reprendre-act"><button class="btn tiny" data-cb="reprendre">Reprendre</button><button class="btn tiny ghost" data-cb="oublier">Abandonner</button></span></section>`
      : vRaidAffiche()}
    ${tuto ? `<button class="cb-tuto" data-cb="tuto">
      <span class="cb-tuto-art"${cbArt('c012')} aria-hidden="true"></span>
      <span class="cb-tuto-t"><small>Nouveau · le tutoriel</small><b>Apprends à combattre</b><em>Une partie guidée · 200 Éclats la première fois</em></span>
      <span class="cb-une-go">Jouer</span>
    </button>` : ''}
    <div class="cb-portes">
      <button class="cb-porte solo" data-cb="vue" data-v="solo">
        <span class="cb-porte-art"${cbArt(COUV.solo)}></span>
        <span class="cb-porte-ico">${CB_ICO.solo}</span>
        <span class="cb-porte-t"><b>Solo</b><small>${e.campagne.finie ? 'Campagne finie' : `Campagne ${fait.size}/20`} · Arcade</small></span>
      </button>
      <button class="cb-porte versus" data-cb="vue" data-v="versus">
        <span class="cb-porte-art"${cbArt(COUV.versus)}></span>
        <span class="cb-porte-ico">${CB_ICO.versus}</span>
        <span class="cb-porte-t"><b>Versus</b><small>${defis ? `${defis} défi${defis > 1 ? 's' : ''} pour toi` : 'Entre amis, en direct'}</small></span>
        ${defis ? `<i class="rf-pastille">${defis}</i>` : ''}
      </button>
    </div>
    <div class="cb-petits">
      ${petit('decks', 'decks', 'Decks', deck ? h(deck.nom) : 'Aucun deck valide')}
      ${petit('missions', 'missions', 'Missions', missions ? `${missions} à récupérer` : 'Quêtes de combat', missions)}
      ${petit('guides', 'guide', 'Guide', 'Règles et glossaire')}
    </div>`;
}

/* ---------- Solo : deux modes, deux portes ---------- */
function vCbSolo(e) {
  const combats = combatsCampagne(e.section);
  const fait = new Set(e.campagne.faits);
  const prochain = combats.find(f => !fait.has(f.id));
  const adverse = SECTIONS[autreSection(e.section)];
  const acte = prochain ? prochain.acte : ACTES[ACTES.length - 1];
  const n = cbChoix.infini || 3;
  return `${cbSousTete('Solo', 'Contre l\'IA')}
    <button class="cb-mode campagne" data-cb="vue" data-v="campagne">
      <span class="cb-mode-art"${cbArt(prochain ? prochain.rival : adverse.promo)}></span>
      <span class="cb-mode-t">
        <small>Campagne · ${e.campagne.finie ? 'terminée' : `acte ${ACTES.indexOf(acte) + 1} sur ${ACTES.length}`}</small>
        <b>${e.campagne.finie ? 'Les vingt rivaux sont tombés' : h(acte.nom)}</b>
        <span class="cb-mode-desc">Vingt rivaux de la ${h(adverse.nom)}, quatre actes. Au bout, sa Promo.</span>
        <span class="cb-mode-prog"><span class="cb-barre"><i style="width:${Math.round(100 * fait.size / 20)}%"></i></span><b class="tnum">${fait.size}/20</b></span>
      </span>
      <span class="cb-une-go">${e.campagne.finie ? 'Revoir' : fait.size ? 'Continuer' : 'Commencer'}</span>
    </button>
    <button class="cb-mode arcade" data-cb="vue" data-v="arcade">
      <span class="cb-mode-art"${cbArt(COUV.arcade)}></span>
      <span class="cb-mode-t">
        <small>Arcade</small>
        <b>De Débutant à Légende</b>
        <span class="cb-mode-desc">Cinq difficultés, un deck adverse tiré au sort à chaque partie. Rejoue autant que tu veux.</span>
        <span class="cb-mode-prog">${etoiles(n)}<em>${h(DIFFICULTES[n - 1].nom)}</em></span>
      </span>
      <span class="cb-une-go">Jouer</span>
    </button>
    ${vCbJour(e)}`;
}

/* Les victoires payées du jour, dites une fois, clairement. */
function vCbJour(e) {
  const fait = Math.min(e.jour.recompensees, e.jour.plafond);
  return `<section class="cb-jour">
    <div class="cb-jour-l"><b>Éclats du jour</b>${cbPips(fait, e.jour.plafond)}<span class="tnum">${fait}/${e.jour.plafond}</span></div>
    <p>Contre l'IA, tes ${e.jour.plafond} premières victoires de la journée rapportent des Éclats (en Arcade, et en rejouant un combat de campagne déjà gagné). Battre un rival de campagne pour la première fois paie toujours, en plus. L'XP, elle, n'a pas de limite.</p>
  </section>`;
}
const cbPips = (n, max) => `<span class="cb-pips" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/* ---------- Missions : les quêtes de combat et de niveau ---------- */
function vCbMissions(e) {
  const qs = (save.quetes || []).filter(estMissionCombat);
  const n = niveauDe(e.xp);
  const groupe = (titre, l, sous) => {
    const ouvertes = trierQuetes(l.filter(q => !q.claimed));
    if (!ouvertes.length) return '';
    return `<section class="cb-mgroupe"><h3>${h(titre)}${sous ? `<small>${sous}</small>` : ''}</h3><div class="questlist">${ouvertes.map(q => vQuete(q)).join('')}</div></section>`;
  };
  /* Les quêtes de saison forment des chaînes (25, 50, 100…) : la prochaine
     de chaque chaîne, plus celles déjà prêtes. */
  const saison = [];
  const chaines = {};
  qs.filter(q => q.scope === 'milestone').forEach(q => (chaines[q.metric] = chaines[q.metric] || []).push(q));
  Object.values(chaines).forEach(ch => {
    ch.sort((a, b) => a.goal - b.goal);
    const ouvertes = ch.filter(q => !q.claimed);
    ouvertes.filter(q => q.progress >= q.goal).forEach(q => saison.push(q));
    const prochaine = ouvertes.find(q => q.progress < q.goal);
    if (prochaine) saison.push(prochaine);
  });
  const corps = groupe('Aujourd\'hui', qs.filter(q => q.scope === 'daily'), dureeCourte(resteAvantRemise('daily')))
    + groupe('Cette semaine', qs.filter(q => q.scope === 'weekly'), dureeCourte(resteAvantRemise('weekly')))
    + groupe('Niveau', saison.filter(q => q.metric === 'niveau'))
    + groupe('Saison', saison.filter(q => q.metric !== 'niveau'))
    + (evenementEnCours() === 'choc' ? groupe(CHOC.nom, qs.filter(q => q.evenement === 'choc' && (q.scope === 'ev_jour' || q.scope === 'ev'))) : '');
  return `${cbSousTete('Missions', 'Les quêtes des combats et de ton niveau', vCbNiveau(e))}
    ${corps || vide('Tout est fait', 'Plus aucune mission en cours : reviens demain.')}
    <p class="muted small">Toutes les quêtes sont aussi dans l'onglet Quêtes. Niveau ${n.niveau} : ${fmtN(n.requis - n.dans)} XP avant le suivant.</p>`;
}

/* ---------- La campagne ---------- */
/* Un acte à la fois, choisi en haut ; ses cinq rivaux sur un chemin qui
   serpente, du premier au boss. Le chemin s'éclaire à mesure qu'on gagne. */
/* Le Labo (js/lab.js) peut montrer la campagne d'une Section, toute
   dévoilée et en lecture seule : `cbLabo = { section }`. */
let cbLabo = null;
function vCbCampagne(e) {
  const section = cbLabo ? cbLabo.section : e.section;
  const combats = combatsCampagne(section);
  const fait = new Set(cbLabo ? [] : e.campagne.faits);
  const ouvert = cbLabo ? () => true : f => f.n === 0 || fait.has(combats[f.n - 1].id) || fait.has(f.id);
  const moi = SECTIONS[section], adverse = SECTIONS[autreSection(section)];
  const prochain = combats.find(f => !fait.has(f.id));
  const iaDefaut = prochain ? ACTES.indexOf(prochain.acte) : ACTES.length - 1;
  const acteOuvert = i => { const l = combats.filter(f => f.acte.id === ACTES[i].id); return !!l.length && ouvert(l[0]); };
  const ia = cbChoix.acte != null && acteOuvert(cbChoix.acte) ? cbChoix.acte : iaDefaut;
  const a = ACTES[ia];
  const fs = combats.filter(f => f.acte.id === a.id);
  const boss = fs.find(f => f.rang) || fs[fs.length - 1];
  /* Un acte pas encore ouvert ne se dévoile pas : ni son boss en bandeau,
     ni ses rivaux (vRoute). */
  const acteFerme = !ouvert(fs[0]);
  const onglets = ACTES.map((x, i) => {
    const l = combats.filter(f => f.acte.id === x.id);
    const n = l.filter(f => fait.has(f.id)).length;
    const ferme = !ouvert(l[0]);
    /* Version 3.0.7 : un acte verrouillé ne s'ouvre pas du tout — son
       onglet est éteint, on ne peut pas aller voir ce qu'il cache. */
    return `<button class="cb-acte-ong${i === ia ? ' on' : ''}${n === l.length ? ' fini' : ''}${ferme ? ' ferme' : ''}"${ferme ? ' disabled aria-disabled="true" title="Finis l\'acte précédent pour l\'ouvrir"' : ` data-cb="acte" data-v="${i}"`}>
      <small>Acte ${i + 1}</small><i>${n === l.length ? NAVICO.check : ferme ? NAVICO.lock : `<b class="tnum">${n}/${l.length}</b>`}</i></button>`;
  }).join('');
  const promo = byId[adverse.promo] || {};
  const labo = cbLabo ? `<p class="cb-labo">Labo · la campagne de la ${h(moi.nom)}, toute dévoilée. Touche un rival pour voir sa carte ; rien ne se joue d'ici.
      <button class="btn tiny ghost" data-cb="labo-fin">Quitter</button></p>` : '';
  return `${cbSousTete('Campagne', `${h(moi.court)} contre ${h(adverse.court)}`, `<span class="cb-jour-chip"><b class="tnum">${fait.size}/20</b><small>gagnés</small></span>`)}
    ${labo}<nav class="cb-actes-ong">${onglets}</nav>
    <section class="cb-acte">
      <header class="cb-acte-tete${acteFerme ? ' ferme' : ''}"${acteFerme ? '' : cbArt(boss.rival)}>
        <small>Acte ${ia + 1}${ia === ACTES.length - 1 ? ' · le dernier' : ''}${acteFerme ? ' · verrouillé' : ''}</small><h2>${h(a.nom)}</h2>
        <p>${acteFerme ? 'Finis l\'acte précédent pour découvrir ses rivaux.' : h(a.texte)}</p>
      </header>
      ${vRoute(fs, fait, ouvert)}
    </section>
    <div class="cb-campagne-fin${e.campagne.finie ? ' eue' : ''}">${renderCard(promo)}<div><small>${e.campagne.finie ? 'Gagné' : 'Au bout de la campagne'}</small><b>${h(promo.nom || '')}</b>
      <p class="muted small">La Promo de la ${h(adverse.nom)}, le titre « Champion des Sections » et son Starter Deck, prêté pour toujours.</p></div></div>`;
}

/* Le chemin d'un acte : les rivaux à gauche, à droite, à gauche…, le boss au
   milieu, en bas. Le tracé est un SVG étiré sur la largeur (le trait garde
   son épaisseur : vector-effect). */
const ROUTE_X = [26, 74, 26, 74, 50];
const ROUTE_H = 116;
function vRoute(fs, fait, ouvert) {
  const pts = fs.map((f, i) => [ROUTE_X[i % ROUTE_X.length], ROUTE_H * i + ROUTE_H / 2]);
  const trace = l => l.map(([x, y], i) => (i ? `C${l[i - 1][0]} ${l[i - 1][1] + ROUTE_H / 2} ${x} ${y - ROUTE_H / 2} ${x} ${y}` : `M${x} ${y}`)).join('');
  const gagnes = fs.filter(f => fait.has(f.id)).length;
  const eclaire = pts.slice(0, Math.min(fs.length, gagnes + 1));
  const H = ROUTE_H * fs.length + 34;
  return `<div class="cb-route" style="height:${H}px">
    <svg class="cb-route-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="fond" d="${trace(pts)}"/>${eclaire.length > 1 ? `<path class="fait" d="${trace(eclaire)}"/>` : ''}
    </svg>
    ${fs.map((f, i) => {
      const k = byId[f.rival] || {};
      const etat = fait.has(f.id) ? 'fait' : ouvert(f) ? 'ouvert' : 'ferme';
      const [x, y] = pts[i];
      const cote = x < 50 ? 'd' : x > 50 ? 'g' : 'b';
      /* Un rival qu'on n'a pas encore débloqué reste une silhouette : ni son
         nom, ni son illustration. */
      const cache = etat === 'ferme';
      const geste = cbLabo ? `data-show="${f.rival}"` : `data-cb="combat" data-v="${f.id}"`;
      return `<button class="cb-etape ${etat}${f.rang ? ' ' + f.rang : ''} lbl-${cote}" style="--x:${x}%;--y:${y}px" ${geste} ${cache ? 'aria-disabled="true"' : ''}>
        <span class="cb-etape-art">${k.img && !cache ? `<img src="${k.img}" alt="" loading="lazy">` : ''}${etat === 'fait' ? `<i class="cb-coche">${NAVICO.check}</i>` : cache ? '<i class="cb-mystere">?</i>' : ''}</span>
        <span class="cb-etape-t"><small>${f.rang === 'final' ? 'La finale' : f.rang ? 'Boss de l\'acte' : `Combat ${f.n + 1}`}</small><b>${cache ? '???' : h(k.nom || '?')}</b>
          ${etoiles(f.niveau)}<em>${etat === 'fait' ? 'Gagné' : cache ? 'Verrouillé' : recompenseTexte(f.recompense)}${cbLabo && f.regle ? ` · ${f.regle.pv ? `${f.regle.pv} PV` : ''}${f.regle.pv && f.regle.ess ? ', ' : ''}${f.regle.ess ? `+${f.regle.ess} Essence` : ''}` : ''}</em></span>
      </button>`;
    }).join('')}
  </div>`;
}

let cbRouvrir = null;
function ouvrirCombatCampagne(id) {
  cbRouvrir = () => ouvrirCombatCampagne(id);
  const e = cbEtat();
  const combats = combatsCampagne(e.section);
  const f = combats.find(x => x.id === id);
  if (!f) return;
  const fait = new Set(e.campagne.faits);
  if (!(f.n === 0 || fait.has(combats[f.n - 1].id) || fait.has(f.id))) return toast('Gagne d\'abord le combat précédent.');
  const k = byId[f.rival] || {};
  const deja = fait.has(f.id);
  const r = f.recompense;
  const regle = f.regle ? [f.regle.pv ? `il a ${f.regle.pv} PV` : '', f.regle.ess ? `il commence avec ${f.regle.ess} Essence en jeu` : ''].filter(Boolean).join(', ') : '';
  openSheet({
    title: `${f.acte.nom} · combat ${f.n + 1}`,
    body: `<div class="cb-fiche">
        <div class="cb-fiche-art">${renderCard(k)}</div>
        <div class="cb-fiche-txt">
          <small>Rival · ${h(SECTIONS[autreSection(e.section)].nom)}</small>
          <b>${h(k.nom || '')}</b>
          <p class="cb-fiche-diff">${etoiles(f.niveau)}<span>${DIFFICULTES[f.niveau - 1].nom}</span></p>
          ${regle ? `<p class="cb-regle">Avantage : ${h(regle)}.</p>` : ''}
          <p class="cb-gain">${deja ? `Déjà gagné — rejouer rapporte ${RECOMPENSE_REJOUER.eclats} Éclats (dans la limite du jour).`
            : `Première victoire : ${recompenseTexte(r)}${f.n === 19 ? ', la Promo de la Section adverse et un titre' : ''}.`}</p>
        </div>
      </div>${vChoixDeck()}`,
    actions: [
      { label: 'Combattre', primary: true, fn: () => { closeSheet(); lancerCampagne(f); } },
      { label: 'Plus tard', fn: closeSheet }
    ]
  });
}

const recompenseTexte = r => [r.eclats ? `${fmtN(r.eclats)} Éclats` : '', r.boosters ? `${r.boosters} booster${r.boosters > 1 ? 's' : ''}` : '', r.fragments ? `${fmtN(r.fragments)} Fragments` : ''].filter(Boolean).join(', ');

/* Le deck avec lequel on part : le deck actif, modifiable sur place. */
function vChoixDeck() {
  const d = cbDeckActif();
  return `<div class="cb-choixdeck"><span class="cb-choixdeck-art">${d ? renderCard(byId[d.couverture] || {}) : ''}</span>
    <span><small>Ton deck</small><b>${d ? h(d.nom) : 'Aucun deck valide'}</b></span>
    <button class="btn tiny ghost" data-cb="choisir-deck">Changer</button></div>`;
}

function choisirDeckRapide(apres) {
  const l = cbDecks();
  const e = cbEtat();
  openSheet({
    title: 'Avec quel deck ?',
    body: `<div class="cb-decks-mini">${l.map(d => {
      const ok = deckValide(d);
      return `<button class="cb-deck-mini${d.id === (cbDeckActif() || {}).id ? ' on' : ''}" data-cbdeck="${h(d.id)}" ${ok ? '' : 'disabled'}>
        <span>${renderCard(byId[d.couverture] || {})}</span><b>${h(d.nom)}</b><small>${ok ? (d.starter ? 'Prêté' : 'Prêt') : 'Incomplet'}</small></button>`;
    }).join('')}</div>`,
    actions: [{ label: 'Fermer', fn: () => { closeSheet(); if (apres) apres(); } }]
  });
  document.querySelectorAll('[data-cbdeck]').forEach(b => b.addEventListener('click', async ev => {
    ev.stopPropagation();
    await agir(() => Backend.combatReglages({ deck_actif: b.dataset.cbdeck }));
    closeSheet();
    if (apres) apres();
  }));
}

/* ---------- L'Arcade ---------- */
/* Cinq difficultés ; celle choisie en grand, avec ce qu'elle rapporte. */
function vCbArcade(e) {
  const n = cbChoix.infini || 3;
  const d = DIFFICULTES[n - 1];
  const reste = Math.max(0, e.jour.plafond - e.jour.recompensees);
  const xp = Math.round(NIVEAUX.victoire * NIVEAUX.facteur[n]);
  return `${cbSousTete('Arcade', 'Cinq difficultés, un deck adverse tiré au sort')}
    <section class="cb-arc n${n}">
      <div class="cb-arc-tete">
        <small>Difficulté</small><b>${h(d.nom)}</b>${etoiles(n)}
        <p>${h(d.texte)}</p>
      </div>
      <div class="cb-arc-gains">
        <span><b class="tnum">${reste ? `+${d.eclats}` : '0'}</b><small>${reste ? 'Éclats par victoire' : 'Éclats : les 5 du jour sont faites'}</small></span>
        <span><b class="tnum">+${xp}</b><small>XP par victoire, sans limite</small></span>
      </div>
      <div class="cb-arc-diffs" role="radiogroup" aria-label="Difficulté">${DIFFICULTES.map(x => `<button role="radio" aria-checked="${x.niveau === n}" class="${x.niveau === n ? 'on' : ''}" data-cb="diff" data-v="${x.niveau}">
        <b class="tnum">${x.niveau}</b><small>${h(x.nom)}</small></button>`).join('')}</div>
    </section>
    ${vChoixDeck()}
    <button class="btn cb-lancer" data-cb="lancer-infini">Lancer le combat</button>
    ${vCbJour(e)}`;
}

/* ---------- Le Raid ---------- */
const vCbRaid = () => cbSousTete('Raid', `${rdEtat ? `Saison ${rdEtat.n} · ` : ''}un boss pour tout le serveur`) + vRaid();

/* ---------- Les défis entre amis ---------- */
function vCbDefis(e) {
  const tete = cbSousTete('Versus', 'Entre amis, en direct');
  if (Backend.mode !== 'cloud') return tete + horsLigne('Les défis');
  const amis = (Backend.amis || []).filter(a => a.lien === 'ami');
  const recus = e.defis.filter(d => d.pour_moi && d.statut === 'attente');
  const envoyes = e.defis.filter(d => !d.pour_moi && d.statut === 'attente');
  const enCours = e.defis.filter(d => d.statut === 'en_cours');
  const ligne = (d, act) => `<div class="cb-defi">${avatarHTML(d.avatar, d.frame, 'sm', d.photo, d.xp)}<span><b>${h(d.pseudo)}</b><small>${h(d.texte || '')}</small></span>${act}</div>`;
  const payes = Math.min(e.jour.defis, e.jour.defis_plafond);
  return `${tete}<p class="cb-intro">Pas de recherche d'adversaire : défie un ami. Il accepte, et vous jouez en direct, chacun sur son écran, 60 secondes par tour.</p>
    <section class="cb-jour">
      <div class="cb-jour-l"><b>Défis payés aujourd'hui</b>${cbPips(payes, e.jour.defis_plafond)}<span class="tnum">${payes}/${e.jour.defis_plafond}</span></div>
      <p>${payes < e.jour.defis_plafond
        ? `Tes ${e.jour.defis_plafond} premiers défis de la journée rapportent ${DEFI_GAIN.victoire} Éclats gagnés, ${DEFI_GAIN.defaite} perdus. Ensuite, l'XP seulement : elle n'a pas de limite.`
        : `Les ${e.jour.defis_plafond} défis payés du jour sont faits : les suivants rapportent l'XP seulement. Ça repart demain.`}</p>
    </section>
    ${recus.length ? `<section class="cb-bloc"><h3>Pour toi</h3>${recus.map(d => ligne(Object.assign({ texte: 'te défie' }, d),
      `<span class="cb-defi-act"><button class="btn tiny" data-cb="defi-ok" data-v="${d.id}">Accepter</button><button class="btn tiny ghost" data-cb="defi-non" data-v="${d.id}">Refuser</button></span>`)).join('')}</section>` : ''}
    ${enCours.length ? `<section class="cb-bloc"><h3>En cours</h3>${enCours.map(d => ligne(Object.assign({ texte: 'combat en cours' }, d),
      `<button class="btn tiny" data-cb="defi-jouer" data-v="${d.id}">Reprendre</button>`)).join('')}</section>` : ''}
    ${envoyes.length ? `<section class="cb-bloc"><h3>Envoyés</h3>${envoyes.map(d => ligne(Object.assign({ texte: 'en attente de réponse' }, d),
      `<button class="btn tiny ghost" data-cb="defi-annuler" data-v="${d.id}">Annuler</button>`)).join('')}</section>` : ''}
    <section class="cb-bloc"><h3>Tes amis</h3>
      ${amis.length ? amis.map(a => ligne(Object.assign({ texte: a.en_ligne ? 'en ligne' : '' }, a),
        `<button class="btn tiny ghost" data-cb="defier" data-v="${h(a.pseudo)}">Défier</button>`)).join('')
        : `<p class="muted">Ajoute des amis depuis l'onglet Social pour les défier.</p><button class="btn ghost" data-tab="social">Aller dans Social</button>`}
    </section>`;
}
/* Rééquilibré pour la 3.0 (docs/economie-3.0.md) : un défi rapporte un
   peu plus qu'une victoire en Normal, puisqu'il faut un ami en face. */
const DEFI_GAIN = { victoire: 40, defaite: 15, plafond: 3 };

/* ---------- Les decks et la personnalisation ---------- */
/* Deux volets : les decks, et l'apparence (tapis, sleeves, Essences
   Brillantes). Le deck actif en tête, en grand, avec sa note ; les autres
   en lignes ; et ce qui fait un bon deck, à portée de main. */
let cbDecksVue = 'decks';
const ETOILES_DECK = (n, sur = 3) => `<span class="dk-etoiles" aria-label="${n} sur ${sur}">${Array.from({ length: sur }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function vCbDecks(e) {
  const seg = `<div class="dk-seg" role="tablist">
      <button class="${cbDecksVue === 'decks' ? 'on' : ''}" data-cb="decks-vue" data-v="decks" role="tab">Mes decks</button>
      <button class="${cbDecksVue === 'apparence' ? 'on' : ''}" data-cb="decks-vue" data-v="apparence" role="tab">Apparence</button>
    </div>`;
  if (cbDecksVue === 'apparence') return `${cbSousTete('Decks', 'Tapis, sleeves et Essences Brillantes')}${seg}${vPersonnaliser(e)}`;
  const l = cbDecks();
  const actif = cbDeckActif();
  const essences = d => Object.keys(d.reserve || {}).filter(k => d.reserve[k]).map(k => `${essIcon(k)}<i>${d.reserve[k]}</i>`).join('');
  const bouton = d => d.starter
    ? `<button class="btn tiny ghost" data-cb="copier-deck" data-v="${h(d.id)}">Dupliquer</button>`
    : `<button class="btn tiny ghost" data-cb="editer" data-v="${h(d.id)}">Modifier</button>`;
  let une = '';
  if (actif) {
    const b = Decks.bilan(actif);
    une = `<section class="dk-actif">
      <span class="dk-actif-art"${cbArt(actif.couverture)}></span>
      <div class="dk-actif-t"><small>Ton deck actif</small><b>${h(actif.nom)}</b>
        <button class="dk-note" data-cb="bilan" data-v="${h(actif.id)}">${ETOILES_DECK(b.note)}<span>${b.nom}</span>${NAVICO.caret}</button>
        <span class="cb-deck-ess">${essences(actif)}</span></div>
      <div class="dk-actif-act">${bouton(actif)}<button class="btn tiny ghost" data-cb="voir-deck" data-v="${h(actif.id)}">Voir</button></div>
    </section>`;
  }
  const autres = l.filter(d => !actif || d.id !== actif.id);
  const ligne = d => {
    const err = Decks.verifier(d, d.starter ? null : save.col);
    const b = Decks.bilan(d);
    return `<div class="dk-ligne">
      <button class="dk-ligne-art" data-cb="${d.starter ? 'voir-deck' : 'editer'}" data-v="${h(d.id)}"${cbArt(d.couverture)} aria-label="${d.starter ? 'Voir' : 'Modifier'} ${h(d.nom)}"></button>
      <div class="dk-ligne-t"><b>${h(d.nom)}</b>
        <small>${d.starter ? 'Starter Deck · prêté' : err.length ? `<span class="cb-ko">${h(err[0])}</span>` : 'Prêt à jouer'}</small>
        ${err.length ? '' : `<button class="dk-note petit" data-cb="bilan" data-v="${h(d.id)}">${ETOILES_DECK(b.note)}<span>${b.nom}</span></button>`}</div>
      <div class="dk-ligne-act">
        <button class="btn tiny" data-cb="activer" data-v="${h(d.id)}" ${err.length ? 'disabled' : ''}>Utiliser</button>
        ${bouton(d)}</div>
    </div>`;
  };
  return `${cbSousTete('Decks', `${Combat.REGLE.CLUB} cartes et ${Combat.REGLE.RESERVE} Essences`)}${seg}
    ${une}
    <div class="dk-boutons">
      <button class="dk-nouveau" data-cb="nouveau-deck"><span>+</span>Nouveau deck</button>
      <button class="dk-nouveau" data-cb="importer-deck"><span>${NAVICO.partage}</span>Importer un code</button>
    </div>
    ${autres.length ? `<h3 class="dk-sous">Tes autres decks</h3><div class="dk-liste">${autres.map(ligne).join('')}</div>` : ''}
    ${vBonDeck()}`;
}

/* Ce qui fait un bon deck : les trois repères de Decks.bilan, expliqués
   avec ce qu'ils valent, et le chemin le plus court pour en construire un. */
function vBonDeck() {
  const B = Decks.BON;
  const point = (t, x) => `<li><b>${t}</b><span>${x}</span></li>`;
  return `<details class="dk-bon" data-garde="bon-deck">
    <summary><span class="dk-bon-ico">${GD_ICO.deck}</span><span><b>Qu'est-ce qu'un bon deck ?</b><small>Trois repères, mesurés en faisant jouer l'IA</small></span>${NAVICO.caret}</summary>
    <ol class="dk-bon-l">
      ${point(`${B.joueurs} Joueurs au moins.`, 'Ce sont eux qui attaquent et qui tiennent tes lignes. Avec 8, un deck gagne 3 parties sur 10 ; avec 12, un peu plus de 4 ; à partir de 16, la moitié ou plus — et en mettre davantage ne fait pas de mal.')}
      ${point('Une Réserve accordée à tes attaques.', 'Si tes attaques demandent du Rose, mets du Rose : une Réserve d\'une autre couleur fait perdre environ 8 parties sur 100. « Réserve auto », dans l\'atelier, la règle pour toi.')}
      ${point('Des attaques qui partent tôt.', 'Tu ne poses qu\'une Essence par tour. Des Joueurs qui attaquent tous pour 2 Essences ou moins ont gagné 59 parties sur 100 : vise au moins la moitié.')}
    </ol>
    <p class="muted small">Ce qui n'a pas changé le résultat, mesuré de la même façon : jouer une, deux ou trois couleurs, ou le nombre d'Objets et de Moments. Le plus court chemin : pars d'un Starter Deck (« Dupliquer »), remplace ses cartes par tes meilleures, et laisse l'atelier régler la Réserve. Un repère tenu, une étoile.</p>
  </details>`;
}

/* Le bilan d'un deck, repère par repère. */
function ouvrirBilan(id) {
  const d = cbVue === 'atelier' && atelier ? atelier.deck : cbDecks().find(x => x.id === id);
  if (!d) return;
  const b = Decks.bilan(d);
  openSheet({
    title: `${d.nom} · ${b.nom}`,
    body: `<div class="dk-bilan-tete">${ETOILES_DECK(b.note, b.sur)}<span>${b.note} repère${b.note > 1 ? 's' : ''} tenu${b.note > 1 ? 's' : ''} sur ${b.sur}</span></div>
      <ul class="dk-bilan">${b.reperes.map(x => `<li class="${x.ok ? 'ok' : 'ko'}"><i>${x.ok ? NAVICO.check : '!'}</i>
        <span><b>${x.titre}</b><small>${h(x.dit)} ${h(x.pourquoi)}</small></span></li>`).join('')}</ul>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

function vPersonnaliser(e) {
  /* Le cosmétique de base est à tout le monde ; les autres, achetés ou gagnés. */
  const possede = id => {
    const x = TAPIS[id] || SLEEVES[id];
    return !!x && ((x.prix === 0 && !x.ev) || (save.inv || {})[id] > 0);
  };
  /* Un cosmétique d'événement ne s'achète pas en Éclats : il dit d'où il vient. */
  const tuile = (type, id, x, actif) => {
    const a = possede(id);
    const verrou = x.ev ? `<i class="cb-cosm-prix ev">${h(x.ev)}</i>` : `<i class="cb-cosm-prix">${shardIco}${fmtN(x.prix)}</i>`;
    return `<button class="cb-cosm ${type}${actif ? ' on' : ''}${a ? '' : ' verrou'}" data-cb="${a ? 'cosm' : x.ev ? 'cosm-ev' : 'boutique-cosm'}" data-t="${type}" data-v="${id}">
      <span class="cb-cosm-img">${type === 'tapis' ? (x.img ? `<img src="${x.img.replace('.webp', '-mini.webp')}" alt="" loading="lazy">` : '<i class="cb-tapis-base"></i>')
        : `<img src="${x.img}" alt="" loading="lazy">`}${a ? '' : verrou}</span>
      <b>${h(x.nom)}</b></button>`;
  };
  return `<section class="cb-bloc cb-perso">
    <p class="muted small">Tapis de jeu et sleeves s'achètent dans la Boutique. Les Essences Brillantes que tu possèdes brillent en combat.</p>
    <h4>Tapis de jeu</h4><div class="cb-cosms tapis" data-defil="cosm-tapis">${Object.keys(TAPIS).map(id => tuile('tapis', id, TAPIS[id], e.cosm.tapis === id)).join('')}</div>
    <h4>Sleeves</h4><div class="cb-cosms sleeve" data-defil="cosm-sleeve">${Object.keys(SLEEVES).map(id => tuile('sleeve', id, SLEEVES[id], e.cosm.sleeve === id)).join('')}</div>
    <h4>Essences Brillantes</h4><div class="cb-brillantes">${Combat.COULEURS.map(k => {
      const a = (save.col || {})['b' + String(Combat.COULEURS.indexOf(k) + 1).padStart(3, '0')] > 0;
      return `<span class="cb-br${a ? ' eue' : ''}" title="${COLORS[k].nom}${a ? ' — brillante' : ''}">${essIcon(k)}</span>`;
    }).join('')}</div>
  </section>`;
}

function voirDeck(id) {
  const d = cbDecks().find(x => x.id === id);
  if (!d) return;
  const ids = Object.keys(d.cartes).sort((a, b) => ordreType(a) - ordreType(b) || (byId[a] || {}).num - (byId[b] || {}).num);
  openSheet({
    title: d.nom,
    body: `<div class="cb-liste-deck">${ids.map(id => `<span class="cb-ld">${renderCard(byId[id] || {})}${d.cartes[id] > 1 ? `<i>×${d.cartes[id]}</i>` : ''}</span>`).join('')}</div>
      <p class="muted small">Réserve : ${Object.keys(d.reserve).map(k => `${d.reserve[k]} ${COLORS[k].nom}`).join(', ')}.</p>`,
    actions: [
      { label: 'Dupliquer pour le modifier', primary: true, fn: () => { closeSheet(); copierDeck(id); } },
      { label: 'Fermer', fn: closeSheet }
    ]
  });
}
const ordreType = id => ({ joueur: 0, objet: 1, coach: 2, moment: 3 }[(byId[id] || {}).cat] ?? 4);

/* ---------- Les guides ---------- */
/* Une icône par guide (le bouclier pour défendre, l'étiquette pour les
   mots-clés…), et les guides déjà lus, retenus dans ce navigateur. */
const GD_ICO = {
  essentiel: NAVICO.star, cartes: NAVICO.cards, tour: NAVICO.rotate, attaquer: NAVICO.sword,
  defendre: '<svg viewBox="0 0 24 24"><path d="M12 2.8 19.5 5.6v6.2c0 4.4-3.1 7.6-7.5 9.4-4.4-1.8-7.5-5-7.5-9.4V5.6Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/></svg>',
  pv: NAVICO.coeur,
  motscles: '<svg viewBox="0 0 24 24"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0Z"/><circle cx="8" cy="8" r="1.5"/></svg>',
  deck: '<svg viewBox="0 0 24 24"><rect x="4.5" y="7.5" width="11" height="14" rx="2"/><path d="M8.5 4.5h9a2 2 0 0 1 2 2V17"/></svg>',
  modes: NAVICO.trophy, maison: NAVICO.flask
};
const GD_GROUPES = [
  ['Pour commencer', ['essentiel', 'cartes', 'tour', 'attaquer']],
  ['Pour aller plus loin', ['defendre', 'pv', 'motscles', 'deck']],
  ['Bon à savoir', ['modes', 'maison']]
];
const GD_CLE = 'mtcg.guides.lus';
const guidesLus = () => { try { return JSON.parse(localStorage.getItem(GD_CLE) || '[]'); } catch (e) { return []; } };
function marquerLu(id) {
  const l = guidesLus();
  if (l.includes(id)) return;
  l.push(id);
  try { localStorage.setItem(GD_CLE, JSON.stringify(l)); } catch (e) { /* */ }
}

function vCbGuides() {
  const g = GUIDES.find(x => x.id === cbGuide);
  if (g) {
    marquerLu(g.id);
    const i = GUIDES.indexOf(g);
    const voisin = (x, sens) => x ? `<button class="gd-voisin ${sens}" data-cb="guide" data-v="${x.id}"><small>${sens === 'prec' ? 'Précédent' : 'Suivant'}</small><b>${h(x.titre)}</b></button>` : '<span></span>';
    return `<div class="gd">
      <header class="cb-sous"><button class="cb-retour" data-cb="guide" data-v="" aria-label="Tous les guides">${NAVICO.caret}</button>
        <div class="cb-sous-t"><p>Guide ${i + 1} sur ${GUIDES.length}</p><span class="gd-avance"><i style="width:${Math.round(100 * (i + 1) / GUIDES.length)}%"></i></span></div></header>
      <article class="gd-page"><header><span class="gd-ico">${GD_ICO[g.id] || NAVICO.quest}</span><h2>${h(g.titre)}</h2></header>${g.html()}</article>
      <nav class="gd-suite">${voisin(GUIDES[i - 1], 'prec')}${voisin(GUIDES[i + 1], 'suiv')}</nav>
    </div>`;
  }
  const lus = guidesLus();
  const n = GUIDES.filter(x => lus.includes(x.id)).length;
  const suivant = GUIDES.find(x => !lus.includes(x.id)) || GUIDES[0];
  const entree = x => `<button class="gd-entree${lus.includes(x.id) ? ' lu' : ''}" data-cb="guide" data-v="${x.id}">
      <span class="gd-ico">${GD_ICO[x.id] || NAVICO.quest}</span>
      <span class="gd-entree-t"><b>${h(x.titre)}</b><small>${h(x.resume)}</small></span>
      ${lus.includes(x.id) ? `<i class="gd-lu" title="Lu">${NAVICO.check}</i>` : NAVICO.caret}</button>`;
  /* Version 3.0.6 : le Guide est d'abord un glossaire. En tête, le
     tutoriel (une partie guidée, js/combat/tutoriel.js) ; puis chaque mot
     du jeu, cherchable ; les chapitres, en dessous, pour lire d'un trait. */
  const fait = typeof tutoFait === 'function' && tutoFait();
  const mots = GLOSSAIRE().slice().sort((a, b) => noacc(a.mot).localeCompare(noacc(b.mot)));
  const lettres = [...new Set(mots.map(x => noacc(x.mot)[0].toUpperCase()))];
  const glossaire = lettres.map(L => `<section class="gd-lettre" data-lettre="${L}"><h3>${L}</h3><dl>${mots.filter(x => noacc(x.mot)[0].toUpperCase() === L).map(x =>
    `<div class="gd-mot" data-mot="${h(noacc(x.mot + ' ' + x.def))}"><dt>${h(x.mot)}</dt><dd>${h(x.def)}${x.voir ? ` <button class="gd-voir" data-cb="guide" data-v="${x.voir}">${h((GUIDES.find(g => g.id === x.voir) || {}).titre || 'Lire')}</button>` : ''}</dd></div>`).join('')}</dl></section>`).join('');
  /* Version 3.0.7 : deux onglets sous le tutoriel, les règles d'abord —
     rangées tout en bas du glossaire, elles ne se voyaient plus. */
  const ong = cbGuideOnglet === 'glossaire' ? 'glossaire' : 'regles';
  const regles = `<section class="gd-regles">
      <p class="gd-regles-tete"><span><b>${n}</b> chapitre${n > 1 ? 's' : ''} lu${n > 1 ? 's' : ''} sur ${GUIDES.length}</span>
        <button class="btn tiny" data-cb="guide" data-v="${suivant.id}">${n ? 'La suite' : 'Commencer'} : ${h(suivant.titre)}</button></p>
      ${GD_GROUPES.map(([titre, ids]) => `<section class="gd-groupe"><h3>${titre}</h3><div class="gd-liste">${ids.map(id => GUIDES.find(x => x.id === id)).filter(Boolean).map(entree).join('')}</div></section>`).join('')}
    </section>`;
  const glo = `<div class="gd-cherche"><input id="gd-q" type="search" placeholder="Chercher un mot : Garde, Réserve, Banc…" autocomplete="off" aria-label="Chercher dans le glossaire"></div>
    <nav class="gd-abc" aria-label="Lettres">${lettres.map(L => `<a href="#" data-lettre-va="${L}">${L}</a>`).join('')}</nav>
    <div class="gd-glossaire" id="gd-glo">${glossaire}<p class="muted gd-rien" hidden>Aucun mot ne correspond.</p></div>`;
  return `${cbSousTete('Guide', 'Le tutoriel, les règles, chaque mot du jeu')}
    <button class="gd-tuto${fait ? ' fait' : ''}" data-cb="tuto">
      <span class="gd-tuto-art"${cbArt('c012')}></span>
      <span class="gd-tuto-t"><small>${fait ? 'Fait · à rejouer quand tu veux' : 'Nouveau · 200 Éclats la première fois'}</small>
        <b>Le tutoriel</b><em>Une partie guidée, bulle après bulle : déployer, attaquer, défendre, les PV, la Résilience, les mots-clés…</em></span>
      <span class="cb-une-go">${fait ? 'Rejouer' : 'Jouer'}</span>
    </button>
    <div class="segbar gd-ong" role="tablist">
      <button role="tab" aria-selected="${ong === 'regles'}" class="${ong === 'regles' ? 'on' : ''}" data-cb="gd-ong" data-v="regles">${NAVICO.livre}Les règles</button>
      <button role="tab" aria-selected="${ong === 'glossaire'}" class="${ong === 'glossaire' ? 'on' : ''}" data-cb="gd-ong" data-v="glossaire">${NAVICO.quest}Glossaire · ${mots.length} mots</button>
    </div>
    ${ong === 'regles' ? regles : glo}
    <p class="muted small">Les règles officielles ne sont pas publiées : elles sont reconstituées à partir des cartes. Ce qui a été inventé est dit dans « Ce qui est maison ».</p>`;
}

/* La recherche du glossaire filtre sans redessiner la page : le champ garde
   son curseur. Les lettres mènent à leur section. */
function bindGuide() {
  const q = $('#gd-q');
  if (q && !q.dataset.lie) {
    q.dataset.lie = '1';
    q.addEventListener('input', () => {
      const v = noacc(q.value.trim());
      let n = 0;
      document.querySelectorAll('.gd-mot').forEach(x => { const ok = !v || x.dataset.mot.includes(v); x.hidden = !ok; if (ok) n++; });
      document.querySelectorAll('.gd-lettre').forEach(x => { x.hidden = !x.querySelector('.gd-mot:not([hidden])'); });
      const r = document.querySelector('.gd-rien');
      if (r) r.hidden = n > 0;
    });
  }
  document.querySelectorAll('[data-lettre-va]:not([data-lie])').forEach(a => {
    a.dataset.lie = '1';
    a.addEventListener('click', e => {
      e.preventDefault();
      const x = document.querySelector(`.gd-lettre[data-lettre="${a.dataset.lettreVa}"]`);
      if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* Les guides, par-dessus l'arène, sans la quitter. */
function ouvrirGuidesSurcouche() {
  const z = document.createElement('div');
  z.className = 'gd-surcouche';
  const montrer = id => {
    const g = GUIDES.find(x => x.id === id);
    z.innerHTML = `<div class="gd-surcouche-in">
      <header><b>${g ? h(g.titre) : 'Guides'}</b><button class="ar-bouton" data-gx="fermer" aria-label="Fermer">✕</button></header>
      ${g ? `<article class="gd-page">${g.html()}</article><button class="btn ghost" data-gx="">Tous les guides</button>`
        : `<div class="gd-liste">${GUIDES.map((x, i) => `<button class="gd-entree" data-gx="${x.id}"><span class="gd-num">${i + 1}</span><span><b>${h(x.titre)}</b><small>${h(x.resume)}</small></span></button>`).join('')}</div>`}
    </div>`;
  };
  z.addEventListener('click', e => {
    const b = e.target.closest('[data-gx]');
    if (!b) { if (e.target === z) z.remove(); return; }
    if (b.dataset.gx === 'fermer') return z.remove();
    montrer(b.dataset.gx);
  });
  montrer(null);
  (document.getElementById('arene') || document.body).appendChild(z);
}

/* ---------- Lancer un combat ---------- */
function joueurMoi() {
  return { nom: save.pseudo, avatar: save.avatar, frame: save.frame, photo: maPhoto(), xp: monXp() };
}
function brillantesMoi() {
  return Combat.COULEURS.filter((k, i) => (save.col || {})['b' + String(i + 1).padStart(3, '0')] > 0);
}

async function lancerCampagne(f) {
  const e = cbEtat();
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (onglet Decks).');
  const rival = byId[f.rival] || {};
  const deckIA = deckRival(f, e.section);
  const adverse = SECTIONS[autreSection(e.section)];
  await demarrer({
    mode: 'campagne', cle: f.id, niveau: f.niveau, deck, deckIA,
    adversaire: { nom: rival.nom, avatar: 'card:' + f.rival, frame: f.rang ? 'f_or' : 'default' },
    pv: f.regle && f.regle.pv, ess: f.regle && f.regle.ess,
    cosmAdv: { tapis: 't_base', sleeve: 's_base' },
    titre: `${f.acte.nom} · ${f.n + 1}/20`, sousTitre: adverse.nom
  });
}

async function lancerInfini() {
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (onglet Decks).');
  const n = cbChoix.infini || 3;
  const diff = DIFFICULTES[n - 1];
  await demarrer({
    mode: 'infini', cle: String(n), niveau: n, deck,
    deckIA: null, /* tiré avec la graine du serveur */
    adversaire: { nom: `IA · ${diff.nom}`, avatar: 'star', frame: n >= 5 ? 'f_or' : n >= 4 ? 'f_rose' : 'default' },
    titre: `Arcade · ${diff.nom}`, sousTitre: 'Un adversaire tiré au sort'
  });
}

/* Le serveur ouvre le combat et donne la graine ; la page le joue ; le
   serveur reçoit le résultat et paie. */
async function demarrer(o) {
  let ouv;
  try {
    occupe(true);
    ouv = await Backend.combatDebut(o.mode, o.cle, o.niveau);
  } catch (err) {
    toast(err.message || 'Le combat n\'a pas pu commencer.');
    return;
  } finally { occupe(false); }
  const deckIA = o.deckIA || Decks.aleatoire(aleaGraine(ouv.graine ^ 0x5bd1e995), { niveau: o.niveau, nom: o.adversaire.nom });
  const init = {
    decks: [Decks.versMoteur(o.deck), Decks.versMoteur(deckIA)],
    noms: [save.pseudo, o.adversaire.nom], graine: ouv.graine,
    pv: [o.pvMoi || Combat.REGLE.PV, o.pv || Combat.REGLE.PV], essDepart: [o.essMoi || 0, o.ess || 0]
  };
  /* Des cartes déjà en jeu au départ (le boss du Raid). */
  if (o.poses) init.poses = o.poses;
  const meta = { id: ouv.id, mode: o.mode, cle: o.cle, niveau: o.niveau, adversaire: o.adversaire, titre: o.titre, sousTitre: o.sousTitre, cosmAdv: o.cosmAdv || null, boss: !!o.boss };
  ouvrirArene({ init }, meta);
}

/* L'arène, avec ce qu'il faut pour payer à la fin. Sert aussi à reprendre
   un combat après un rechargement. */
function ouvrirArene(partie, meta) {
  const e = cbEtat();
  Table.ouvrir(Object.assign(partie, {
    moi: 0, ia: { niveau: meta.niveau },
    joueurs: [joueurMoi(), meta.adversaire],
    cosm: [e.cosm, meta.cosmAdv || { tapis: 't_base', sleeve: 's_base' }],
    brillantes: [brillantesMoi(), []],
    titre: meta.titre, sousTitre: meta.sousTitre, boss: meta.boss,
    sauver: CLE_COMBAT, meta,
    surFin: (E, gagne) => finirCombat(meta, E, gagne),
    surQuitter: () => { render(); }
  }));
}

async function finirCombat(meta, E, gagne) {
  const resume = resumeCombat(E, 0);
  const r = await Backend.combatFin(meta.id, gagne, resume);
  try { localStorage.removeItem(CLE_COMBAT); } catch (err) { /* */ }
  /* Le Raid a bougé (js/raid.js) ; l'Épreuve, l'état de l'événement
     (js/choc.js), comme le Raid pendant le Choc. */
  if (meta.mode === 'raid') chargerRaid();
  if (meta.mode === 'epreuve' || (meta.mode === 'raid' && evenementEnCours() === 'choc')) chargerChoc();
  return htmlRecompense(r);
}

/* Ce qu'on dit au serveur d'un combat : il s'en sert pour les quêtes. */
function resumeCombat(E, j) {
  let vaincus = 0, touches = 0;
  for (const ev of E.ev) {
    if (ev.t === 'vaincu' && ev.j !== j) vaincus++;
    if (ev.t === 'touche' && ev.j !== j) touches++;
  }
  return { tours: E.tour, vaincus, touches, pv: E.j[j].pv.length, actions: E.journal.length };
}

function htmlRecompense(r) {
  if (!r) return '';
  const g = r.recompense || {};
  const l = [];
  if (g.degats) l.push(`<span class="ar-recompense">${NAVICO.foudre}${fmtN(g.degats)} dégât${g.degats > 1 ? 's' : ''}</span>`);
  if (g.insignes) l.push(`<span class="ar-recompense">${etincelleIco}+${fmtN(g.insignes)}</span>`);
  if (g.eclats) l.push(`<span class="ar-recompense">${shardIco}+${fmtN(g.eclats)}</span>`);
  if (g.boosters) l.push(`<span class="ar-recompense"><img src="${ART.seal}" alt="">+${g.boosters}</span>`);
  if (g.fragments) l.push(`<span class="ar-recompense">${NAVICO.fragment}+${fmtN(g.fragments)}</span>`);
  if (g.carte) l.push(`<span class="ar-recompense">${NAVICO.promo}${h((byId[g.carte] || {}).nom || g.carte)}</span>`);
  if (g.titre) l.push(`<span class="ar-recompense">Titre « ${h((TITRES[g.titre] || {}).nom || g.titre)} »</span>`);
  const msg = g.message ? `<p class="ar-consigne">${h(g.message)}</p>` : '';
  return htmlXp(g.xp) + (l.length ? `<div class="ar-recompenses">${l.join('')}</div>` : '') + msg;
}

/* L'XP gagnée : la barre du niveau qui se remplit, et chaque niveau franchi
   avec ce qu'il paie. */
function htmlXp(x) {
  if (!x || !x.gagne) return '';
  const n = niveauDe(x.total);
  const avant = niveauDe(x.total - x.gagne);
  /* La barre part de là où elle était (0 si on a changé de niveau). */
  const de = avant.niveau === n.niveau ? Math.round(100 * avant.dans / n.requis) : 0;
  const vers = Math.round(100 * n.dans / n.requis);
  const palier = r => [r.eclats ? `${shardIco}${r.eclats}` : '', r.boosters ? `<img src="${ART.seal}" alt="">${r.boosters}` : '',
    r.fragments ? `${NAVICO.fragment}${fmtN(r.fragments)}` : '', r.cadre ? `cadre « ${h((FRAMES[r.cadre] || {}).nom || r.cadre)} »` : '',
    r.titre ? `titre « ${h((TITRES[r.titre] || {}).nom || r.titre)} »` : ''].filter(Boolean).join(' · ');
  return `<div class="ar-xp">
    <div class="ar-xp-l"><span class="ar-xp-n">Niv. <b>${n.niveau}</b></span><b class="ar-xp-g">+${fmtN(x.gagne)} XP</b><small class="tnum">${fmtN(n.dans)} / ${fmtN(n.requis)}</small></div>
    <span class="ar-xp-barre" style="--de:${de}%;--vers:${vers}%"><i></i></span>
    ${(x.paliers || []).map(r => `<p class="ar-xp-palier"><b>Niveau ${r.niveau} !</b><span>${palier(r)}</span></p>`).join('')}
  </div>`;
}

/* Un combat interrompu (page rechargée) : on le reprend où il en était. */
function combatEnCours() {
  try { return JSON.parse(localStorage.getItem(CLE_COMBAT) || 'null'); } catch (e) { return null; }
}
function reprendreCombat() {
  const s = combatEnCours();
  if (!s) return;
  let E;
  try { E = Combat.rejouer(s.init, s.journal); } catch (err) { localStorage.removeItem(CLE_COMBAT); return toast('Ce combat ne peut pas être repris.'); }
  if (E.fin) { localStorage.removeItem(CLE_COMBAT); return toast('Ce combat était déjà fini.'); }
  ouvrirArene({ E }, s.meta);
}
function oublierCombat() {
  const s = combatEnCours();
  openSheet({
    title: 'Abandonner ce combat ?',
    body: '<p class="muted">Il compte comme une défaite.</p>',
    actions: [
      { label: 'Abandonner', primary: true, fn: async () => {
        closeSheet();
        try { localStorage.removeItem(CLE_COMBAT); } catch (e) { /* */ }
        if (s && s.meta && s.meta.id) await agir(() => Backend.combatFin(s.meta.id, false, { abandon: true }));
        render();
      } },
      { label: 'Garder', fn: closeSheet }
    ]
  });
}

/* ---------- Les clics de l'onglet ---------- */
function cbAction(k, el) {
  const v = el.dataset.v;
  switch (k) {
    case 'vue': return allerCb(v);
    case 'acte': cbChoix.acte = +v; return render();
    case 'niveau': return ouvrirNiveau();
    case 'section': return choisirSection(v);
    case 'combat': return ouvrirCombatCampagne(v);
    case 'diff': cbChoix.infini = +v; return render();
    case 'lancer-infini': return lancerInfini();
    case 'choisir-deck': {
      /* Depuis la fiche d'un combat : on y revient une fois le deck choisi. */
      const rouvrir = !$('#sheet').hidden && cbRouvrir;
      closeSheet();
      return choisirDeckRapide(() => (rouvrir ? rouvrir() : render()));
    }
    case 'reprendre': return reprendreCombat();
    case 'oublier': return oublierCombat();
    case 'guide': cbGuide = v || null; render(); return $('#main').scrollTo({ top: 0 });
    case 'gd-ong': cbGuideOnglet = v; return render();
    case 'activer': return agir(() => Backend.combatReglages({ deck_actif: v }), 'Deck activé.');
    case 'cosm': return agir(() => Backend.combatReglages({ [el.dataset.t]: v }));
    case 'boutique-cosm': shopVue = 'combat'; return aller('boutique');
    case 'cosm-ev': {
      const x = TAPIS[v] || SLEEVES[v] || {};
      if (evenementEnCours() === 'choc') return allerCh(x.vue || 'pass');
      return toast(`${x.nom || 'Ce cosmétique'} : exclusif à l'événement « ${CHOC.nom} ».`);
    }
    case 'voir-deck': return voirDeck(v);
    case 'decks-vue': cbDecksVue = v; return render();
    case 'tuto': return lancerTutoriel();
    case 'labo-fin': cbLabo = null; return aller('labo');
    case 'bilan': return ouvrirBilan(v);
    case 'copier-deck': return copierDeck(v);
    case 'editer': return ouvrirAtelier(v);
    case 'nouveau-deck': return ouvrirAtelier(null);
    case 'importer-deck': return importerDeck();
    case 'defier': return defier(v);
    case 'defi-ok': return accepterDefi(v);
    case 'defi-non': return agir(() => Backend.defiRepondre(v, false), 'Défi refusé.');
    case 'defi-annuler': return agir(() => Backend.defiRepondre(v, false), 'Défi annulé.');
    case 'defi-jouer': return jouerDefi(v);
  }
  if (typeof atelierAction === 'function') return atelierAction(k, el);
}
