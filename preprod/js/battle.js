/* L'onglet Combats (version 3.0).

   Une page d'accueil courte, faite pour qu'on y lance un combat en deux
   gestes : en tête, son niveau de combattant ; puis la grande affiche du
   moment (le Raid pendant l'événement, sinon le prochain combat de
   campagne) ; deux grandes tuiles, Solo (contre l'IA) et Versus (entre
   amis) ; trois petites, Decks, Missions et Guide. Un bandeau illustré en
   tête, en biais, comme les écrans de Pokémon TCG Pocket. Chaque tuile
   ouvre sa page, avec un retour vers
   l'accueil. Le combat se joue dans l'arène, en plein écran
   (js/combat/table.js) ; l'atelier de decks a son fichier
   (js/combat/atelier.js).

   Le serveur décide de tout ce qui rapporte : la Section rejointe, les
   decks enregistrés, les récompenses et l'XP d'un combat
   (supabase/23_combats.sql, 26_niveaux.sql). Le combat, lui, se joue dans
   la page : le serveur fournit la graine, et reçoit le résultat. */
"use strict";

let cbVue = 'accueil';
/* Le combat de campagne ou la difficulté choisis ; la moitié de Solo ouverte. */
let cbChoix = { infini: 3, solo: 'campagne' };
let cbGuide = null;
const CB_VUES = ['accueil', 'solo', 'versus', 'decks', 'missions', 'guides', 'atelier'];
/* Les anciennes adresses (avant la nouvelle page d'accueil) mènent encore
   quelque part. */
const CB_ALIAS = { campagne: ['solo', 'campagne'], infini: ['solo', 'infini'], defis: ['versus'] };
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
    cosm: Object.assign({ tapis: 't_base', sleeve: 's_base', jeton: 'j_base' }, c.cosm || {}),
    campagne: Object.assign({ faits: [], finie: false }, c.campagne || {}),
    jour: Object.assign({ recompensees: 0, plafond: PVE_PLAFOND }, c.jour || {}),
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
function allerCb(vue, sous) {
  const alias = CB_ALIAS[vue];
  if (alias) { vue = alias[0]; if (alias[1]) cbChoix.solo = alias[1]; }
  if (sous && vue === 'solo') cbChoix.solo = sous;
  cbVue = CB_VUES.includes(vue) ? vue : 'accueil';
  if (tab !== 'combats') return aller('combats');
  render();
  const m = $('#main');
  if (m) m.scrollTo({ top: 0 });
}

/* ---------- L'onglet ---------- */
function vCombats() {
  const e = cbEtat();
  if (!e.section) return vChoixSection();
  if (cbVue === 'atelier' && typeof vAtelier === 'function') return vAtelier();
  const corps = {
    accueil: vCbAccueil, solo: vCbSolo, versus: vCbDefis,
    decks: vCbDecks, missions: vCbMissions, guides: vCbGuides
  }[cbVue] || vCbAccueil;
  return `<div class="cb sec-${e.section}" style="--sc:${SECTIONS[e.section].c};--sc2:${SECTIONS[e.section].c2}">${corps(e)}</div>`;
}

/* L'en-tête d'une page : le retour vers l'accueil, le titre, et à droite ce
   que la page veut y mettre. */
const cbSousTete = (titre, sous, droite) => `<header class="cb-sous">
  <button class="cb-retour" data-cb="vue" data-v="accueil" aria-label="Retour à l'accueil des Combats">${NAVICO.caret}</button>
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
    <button class="btn ghost" data-cb="vue" data-v="guides">Lire les règles d'abord</button>
  </div>`;
}

function choisirSection(id) {
  const s = SECTIONS[id];
  openSheet({
    title: `Rejoindre la ${s.nom} ?`,
    body: `<div class="cb-confirm sec-${id}"><img src="${s.boite}" alt=""><p class="muted">${h(s.devise)}</p>
      <p>Tu reçois la Promo <b>${h((byId[s.promo] || {}).nom || s.promo)}</b> et le Starter Deck. Ce choix est définitif.</p></div>`,
    actions: [
      { label: 'Rejoindre', primary: true, fn: () => { closeSheet(); agir(() => Backend.combatSection(id), `Bienvenue dans la ${s.nom} !`).then(ok => { if (ok) { cbVue = 'accueil'; render(); } }); } },
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}

/* ---------- L'accueil ---------- */
/* Les missions de combat à récupérer (js/quests.js). */
const cbMissionsPretes = () => (save.quetes || []).filter(q => estMissionCombat(q) && questePrete(q)).length;

/* Les icônes des tuiles de l'accueil : au trait, en deux tons (le fond
   teinté, le trait clair ; css/combat.css). Versus : deux cartes qui se
   font face, et l'éclair du duel entre elles. */
const CB_ICO = {
  solo: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="13" y="7" width="22" height="32" rx="4"/><path class="f" d="M24 15.5l2.6 5.4 5.9.7-4.4 4 1.2 5.9L24 28.6l-5.3 2.9 1.2-5.9-4.4-4 5.9-.7z"/></svg>',
  versus: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="4.5" y="13" width="16" height="23" rx="3" transform="rotate(-14 12.5 24.5)"/><rect class="f" x="27.5" y="13" width="16" height="23" rx="3" transform="rotate(14 35.5 24.5)"/><path class="e" d="M26.5 6.5 19 22h5.2l-3.2 11.5L30 17.5h-5.4z"/></svg>',
  decks: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="9" y="13" width="20" height="28" rx="3.5"/><path d="M15 9h17a3.5 3.5 0 0 1 3.5 3.5V34"/><path d="M21 5h12a6 6 0 0 1 6 6v18"/></svg>',
  missions: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="f" x="10" y="8" width="28" height="33" rx="4"/><path d="M17 21.5l4 4 9-9M17 32h14"/></svg>',
  guide: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="f" d="M8 11.5c5.5-2 11-1.5 16 1.5v26c-5-3-10.5-3.5-16-1.5z"/><path class="f" d="M40 11.5c-5.5-2-11-1.5-16 1.5v26c5-3 10.5-3.5 16-1.5z"/></svg>'
};

/* L'illustration du bandeau : le boss du Raid pendant l'événement, sinon le
   prochain rival de la campagne, sinon la Promo de l'autre Section. */
function cbHeroArt(e, prochain) {
  const id = prochain ? prochain.rival : SECTIONS[autreSection(e.section)].promo;
  const c = byId[id];
  return c && c.img ? `<span class="cb-hero-art" aria-hidden="true" style="background-image:url('${h(c.img)}')"></span>` : '';
}

function vCbAccueil(e) {
  const deck = cbDeckActif();
  const combats = combatsCampagne(e.section);
  const fait = new Set(e.campagne.faits);
  const prochain = combats.find(f => !fait.has(f.id));
  const reste = Math.max(0, e.jour.plafond - e.jour.recompensees);
  const enCours = combatEnCours();
  const defis = e.defis.filter(d => d.pour_moi && d.statut === 'attente').length;
  const missions = cbMissionsPretes();
  const tuile = (v, ico, titre, sous, n) => `<button class="cb-tuile" data-cb="vue" data-v="${v}">
      <span class="cb-tuile-ico">${CB_ICO[ico]}</span><b>${titre}</b><small>${sous}</small>${n ? `<i class="rf-pastille">${n}</i>` : ''}
    </button>`;
  const petit = (v, ico, titre, sous, n) => `<button class="cb-petit" data-cb="vue" data-v="${v}">
      <span class="cb-petit-ico">${CB_ICO[ico]}</span><b>${titre}</b><small>${sous}</small>${n ? `<i class="rf-pastille">${n}</i>` : ''}
    </button>`;
  return `<section class="cb-hero">
      ${cbHeroArt(e, prochain)}
      <div class="cb-hero-haut"><span class="cb-badge" title="Ta Section">${emblemeSection(e.section)}<b>${h(SECTIONS[e.section].court)}</b></span>${vCbNiveau(e)}</div>
      <h1 class="cb-hero-titre">Combats</h1>
    </section>
    ${vCbAffiche(e, prochain)}
    ${enCours ? `<section class="cb-reprendre"><div><b>Un combat est en cours</b><p class="muted small">${h(enCours.meta && enCours.meta.titre || 'Combat')} — reprends-le où tu l'as laissé.</p></div>
      <div class="cb-reprendre-act"><button class="btn tiny" data-cb="reprendre">Reprendre</button><button class="btn tiny ghost" data-cb="oublier">Abandonner</button></div></section>` : ''}
    <div class="cb-tuiles">
      ${tuile('solo', 'solo', 'Solo', `${e.campagne.finie ? 'Campagne finie' : `Campagne ${fait.size}/20`} · ${reste ? `${reste} victoire${reste > 1 ? 's' : ''} payée${reste > 1 ? 's' : ''}` : 'XP à volonté'}`)}
      ${tuile('versus', 'versus', 'Versus', defis ? `${defis} défi${defis > 1 ? 's' : ''} pour toi` : 'Défie un ami, en direct', defis)}
    </div>
    <div class="cb-petits">
      ${petit('decks', 'decks', 'Decks', deck ? h(deck.nom) : 'Aucun deck valide')}
      ${petit('missions', 'missions', 'Missions', missions ? `${missions} à récupérer` : 'Quêtes de combat', missions)}
      ${petit('guides', 'guide', 'Guide', 'Les règles')}
    </div>`;
}

/* La grande affiche : le Raid pendant le Choc des Sections, sinon le
   prochain combat de la campagne, sinon le PvE infini. */
function vCbAffiche(e, prochain) {
  const une = (attrs, sur, titre, sous, go, art) => `<button class="cb-une" ${attrs}>
      ${art ? `<span class="cb-une-art">${renderCard(byId[art] || {})}</span>` : ''}
      <span class="cb-une-t"><small>${sur}</small><b>${titre}</b><em>${sous}</em></span>
      <span class="cb-une-go">${go}</span>
    </button>`;
  if (prochain) {
    const k = byId[prochain.rival] || {};
    return une(`data-cb="combat" data-v="${prochain.id}"`, `Campagne · ${h(prochain.acte.nom)}`, h(k.nom || ''),
      `Combat ${prochain.n + 1}/20 · ${'★'.repeat(prochain.niveau)}`, 'Combattre');
  }
  const n = cbChoix.infini || 3;
  return une('data-cb="vue" data-v="infini"', 'PvE infini', `${h(DIFFICULTES[n - 1].nom)} ${'★'.repeat(n)}`,
    'Un deck adverse tiré au sort, à chaque fois', 'Jouer');
}

/* ---------- Solo : la campagne et le PvE infini ---------- */
function vCbSolo(e) {
  const reste = Math.max(0, e.jour.plafond - e.jour.recompensees);
  const seg = (id, nom) => `<button class="${cbChoix.solo === id ? 'on' : ''}" data-cb="solo" data-v="${id}">${nom}</button>`;
  return `${cbSousTete('Solo', 'Contre l\'IA', `<span class="cb-jour-chip" title="Victoires payées en Éclats aujourd'hui (l'XP, elle, est sans limite)"><b class="tnum">${reste}/${e.jour.plafond}</b><small>payées</small></span>`)}
    <div class="segbar cb-seg">${seg('campagne', 'Campagne')}${seg('infini', 'PvE infini')}</div>
    ${cbChoix.solo === 'infini' ? vCbInfini(e) : vCbCampagne(e)}`;
}

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
function vCbCampagne(e) {
  const combats = combatsCampagne(e.section);
  const fait = new Set(e.campagne.faits);
  const ouvert = f => f.n === 0 || fait.has(combats[f.n - 1].id) || fait.has(f.id);
  const adverse = SECTIONS[autreSection(e.section)];
  const actes = ACTES.map((a, ia) => {
    const fs = combats.filter(f => f.acte.id === a.id);
    const fini = fs.every(f => fait.has(f.id));
    return `<section class="cb-acte${fini ? ' fini' : ''}">
      <div class="cb-acte-tete"><small>Acte ${ia + 1}</small><b>${h(a.nom)}</b><p class="muted small">${h(a.texte)}</p></div>
      <div class="cb-chemin">${fs.map(f => {
        const k = byId[f.rival] || {};
        const etat = fait.has(f.id) ? 'fait' : ouvert(f) ? 'ouvert' : 'ferme';
        return `<button class="cb-noeud ${etat}${f.rang ? ' ' + f.rang : ''}" data-cb="combat" data-v="${f.id}" ${etat === 'ferme' ? 'aria-disabled="true"' : ''}>
          <span class="cb-noeud-art">${k.img ? `<img src="${k.img}" alt="" loading="lazy">` : ''}${etat === 'fait' ? `<i class="cb-coche">${NAVICO.check}</i>` : etat === 'ferme' ? `<i class="cb-cadenas">${NAVICO.lock}</i>` : ''}</span>
          <b>${h(k.nom || '?')}</b><small>${'★'.repeat(f.niveau)}${f.rang === 'final' ? ' · finale' : f.rang ? ' · boss' : ''}</small>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  return `<p class="cb-intro">Ta Section contre la ${h(adverse.nom)}. ${e.campagne.finie
      ? 'Terminée : la Promo adverse est à toi. Rejoue pour le plaisir.'
      : `Finis-la pour gagner la Promo de la ${h(adverse.nom)}.`}</p>
    <div class="cb-campagne-prog"><span class="cb-barre"><i style="width:${Math.round(100 * fait.size / 20)}%"></i></span><b class="tnum">${fait.size}/20</b></div>
    ${actes}
    <div class="cb-campagne-fin${e.campagne.finie ? ' eue' : ''}">${renderCard(byId[adverse.promo] || {})}<div><b>Au bout de la campagne</b>
      <p class="muted small">La Promo ${h((byId[adverse.promo] || {}).nom || '')}, le titre « Champion des Sections » et le Starter Deck adverse, prêté pour toujours.</p></div></div>`;
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
          <p class="cb-niv">${DIFFICULTES[f.niveau - 1].nom} ${'★'.repeat(f.niveau)}</p>
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

/* ---------- Le PvE infini ---------- */
function vCbInfini(e) {
  const reste = Math.max(0, e.jour.plafond - e.jour.recompensees);
  const n = cbChoix.infini || 3;
  return `<p class="cb-intro">L'IA reçoit un deck tiré au sort, dans une ou deux couleurs. Plus c'est dur, plus ça rapporte — en Éclats (${e.jour.plafond} victoires par jour) comme en XP (sans limite).</p>
    <div class="cb-diffs">${DIFFICULTES.map(d => `<button class="cb-diff n${d.niveau}${n === d.niveau ? ' on' : ''}" data-cb="diff" data-v="${d.niveau}">
        <span class="cb-diff-et">${'★'.repeat(d.niveau)}</span><b>${h(d.nom)}</b><small>${h(d.texte)}</small>
        <em>${reste ? `+${d.eclats} Éclats` : 'pour le plaisir'}</em></button>`).join('')}</div>
    ${vChoixDeck()}
    <button class="btn cb-lancer" data-cb="lancer-infini">Lancer le combat</button>`;
}

/* ---------- Les défis entre amis ---------- */
function vCbDefis(e) {
  const tete = cbSousTete('Versus', 'Entre amis, en direct');
  if (Backend.mode !== 'cloud') return tete + horsLigne('Les défis');
  const amis = (Backend.amis || []).filter(a => a.lien === 'ami');
  const recus = e.defis.filter(d => d.pour_moi && d.statut === 'attente');
  const envoyes = e.defis.filter(d => !d.pour_moi && d.statut === 'attente');
  const enCours = e.defis.filter(d => d.statut === 'en_cours');
  const ligne = (d, act) => `<div class="cb-defi">${avatarHTML(d.avatar, d.frame, 'sm', d.photo, d.xp)}<span><b>${h(d.pseudo)}</b><small>${h(d.texte || '')}</small></span>${act}</div>`;
  return `${tete}<p class="cb-intro">Pas de recherche d'adversaire : défie un ami. Il accepte, et vous jouez en direct, chacun sur son écran.</p>
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
    </section>
    <p class="muted small">Un défi gagné rapporte ${DEFI_GAIN.victoire} Éclats, un défi perdu ${DEFI_GAIN.defaite} (${DEFI_GAIN.plafond} défis récompensés par jour).</p>`;
}
/* Rééquilibré pour la 3.0 (docs/economie-3.0.md) : un défi rapporte un
   peu plus qu'une victoire en Normal, puisqu'il faut un ami en face. */
const DEFI_GAIN = { victoire: 40, defaite: 15, plafond: 3 };

/* ---------- Les decks et la personnalisation ---------- */
function vCbDecks(e) {
  const l = cbDecks();
  const actif = cbDeckActif();
  const ligne = d => {
    const err = Decks.verifier(d, d.starter ? null : save.col);
    const n = Decks.total(d.cartes);
    return `<div class="cb-deck${actif && actif.id === d.id ? ' actif' : ''}">
      <button class="cb-deck-art" data-cb="${d.starter ? 'voir-deck' : 'editer'}" data-v="${h(d.id)}">${renderCard(byId[d.couverture] || {})}</button>
      <div class="cb-deck-txt"><b>${h(d.nom)}</b>
        <small>${d.starter ? 'Starter Deck · prêté' : err.length ? `<span class="cb-ko">${h(err[0])}</span>` : `${n} cartes · prêt`}</small>
        <span class="cb-deck-ess">${Object.keys(d.reserve || {}).filter(k => d.reserve[k]).map(k => `${essIcon(k)}<i>${d.reserve[k]}</i>`).join('')}</span></div>
      <div class="cb-deck-act">
        ${actif && actif.id === d.id ? '<span class="cb-actif">Actif</span>' : `<button class="btn tiny ghost" data-cb="activer" data-v="${h(d.id)}" ${err.length ? 'disabled' : ''}>Utiliser</button>`}
        ${d.starter ? `<button class="btn tiny ghost" data-cb="copier-deck" data-v="${h(d.id)}">Copier</button>` : `<button class="btn tiny ghost" data-cb="editer" data-v="${h(d.id)}">Modifier</button>`}
      </div></div>`;
  };
  return `${cbSousTete('Decks', `${Combat.REGLE.CLUB} cartes et ${Combat.REGLE.RESERVE} Essences`)}
    <div class="cb-decks">${l.map(ligne).join('')}
      <button class="cb-deck nouveau" data-cb="nouveau-deck"><span>+</span><b>Nouveau deck</b></button>
      <button class="cb-deck nouveau" data-cb="importer-deck"><span>${NAVICO.partage}</span><b>Importer un code</b></button>
    </div>
    ${vPersonnaliser(e)}`;
}

function vPersonnaliser(e) {
  /* Le cosmétique de base est à tout le monde ; les autres, achetés ou gagnés. */
  const possede = id => {
    const x = TAPIS[id] || SLEEVES[id] || JETONS[id];
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
  return `<section class="cb-bloc cb-perso"><h3>Personnaliser</h3>
    <p class="muted small">Tapis de jeu et sleeves s'achètent dans la Boutique. Les Essences Brillantes que tu possèdes brillent en combat.</p>
    <h4>Tapis de jeu</h4><div class="cb-cosms tapis">${Object.keys(TAPIS).map(id => tuile('tapis', id, TAPIS[id], e.cosm.tapis === id)).join('')}</div>
    <h4>Sleeves</h4><div class="cb-cosms sleeve">${Object.keys(SLEEVES).map(id => tuile('sleeve', id, SLEEVES[id], e.cosm.sleeve === id)).join('')}</div>
    <h4>Jeton</h4><div class="cb-cosms jeton">${Object.keys(JETONS).map(id => tuile('jeton', id, JETONS[id], e.cosm.jeton === id)).join('')}</div>
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
      { label: 'Copier pour le modifier', primary: true, fn: () => { closeSheet(); copierDeck(id); } },
      { label: 'Fermer', fn: closeSheet }
    ]
  });
}
const ordreType = id => ({ joueur: 0, objet: 1, coach: 2, moment: 3 }[(byId[id] || {}).cat] ?? 4);

/* ---------- Les guides ---------- */
function vCbGuides() {
  const g = GUIDES.find(x => x.id === cbGuide);
  if (g) {
    const i = GUIDES.indexOf(g);
    return `<div class="gd">
      <button class="gd-retour" data-cb="guide" data-v="">${NAVICO.caret}<span>Tous les guides</span></button>
      <article class="gd-page"><header><span class="gd-ico">${NAVICO[g.ico] || NAVICO.quest}</span><h2>${h(g.titre)}</h2></header>${g.html()}</article>
      <nav class="gd-suite">${i > 0 ? `<button class="btn ghost" data-cb="guide" data-v="${GUIDES[i - 1].id}">← ${h(GUIDES[i - 1].titre)}</button>` : '<span></span>'}
        ${i < GUIDES.length - 1 ? `<button class="btn" data-cb="guide" data-v="${GUIDES[i + 1].id}">${h(GUIDES[i + 1].titre)} →</button>` : ''}</nav>
    </div>`;
  }
  return `${cbSousTete('Guide', 'Les règles, section par section')}<p class="cb-intro">Elles sont reconstituées à partir des cartes : ce qui a été inventé est dit dans « Ce qui est maison ».</p>
    <div class="gd-liste">${GUIDES.map((x, i) => `<button class="gd-entree" data-cb="guide" data-v="${x.id}">
      <span class="gd-num">${i + 1}</span><span class="gd-ico">${NAVICO[x.ico] || NAVICO.quest}</span>
      <span><b>${h(x.titre)}</b><small>${h(x.resume)}</small></span>${NAVICO.caret}</button>`).join('')}</div>`;
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
    titre: `PvE infini · ${diff.nom}`, sousTitre: '★'.repeat(n)
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
  /* Le Raid et l'Épreuve ont changé l'état de l'événement (js/choc.js). */
  if (meta.mode === 'raid' || meta.mode === 'epreuve') chargerChoc();
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
  if (g.insignes) l.push(`<span class="ar-recompense">${insigneIco}+${fmtN(g.insignes)}</span>`);
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
    case 'solo': cbChoix.solo = v; return render();
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
    case 'activer': return agir(() => Backend.combatReglages({ deck_actif: v }), 'Deck activé.');
    case 'cosm': return agir(() => Backend.combatReglages({ [el.dataset.t]: v }));
    case 'boutique-cosm': shopVue = 'combat'; return aller('boutique');
    case 'cosm-ev': {
      const x = TAPIS[v] || SLEEVES[v] || {};
      if (evenementEnCours() === 'choc') return allerCh(x.vue || 'pass');
      return toast(`${x.nom || 'Ce cosmétique'} : exclusif à l'événement « ${CHOC.nom} ».`);
    }
    case 'voir-deck': return voirDeck(v);
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
