/* Onglet Quêtes. Toute la progression est comptée par le serveur au moment où
   l'événement arrive vraiment (supabase/installation/03_rpc.sql) : rien n'est déclaré par
   le navigateur, donc rien n'est gonflable depuis la console.

   Trois périodes, trois sous-onglets. Tout afficher d'un coup faisait une page
   de seize cartes qu'on ne lisait plus : on n'a qu'une question à la fois —
   « qu'est-ce que je peux finir aujourd'hui ? ». */
"use strict";

/* L'ordre compte : c'est celui des sous-onglets, et le premier est celui qu'on
   ouvre par défaut. `titre` sert au sous-onglet, `plein` au bandeau de période. */
const SCOPES = [
  { id: 'daily',     titre: 'Quotidiennes',  plein: 'Quêtes du jour',      remise: 'jour' },
  { id: 'weekly',    titre: 'Hebdomadaires', plein: 'Quêtes de la semaine', remise: 'semaine' },
  { id: 'milestone', titre: 'Saisonnières',  plein: 'Quêtes de saison',     remise: null }
];

/* Le sous-onglet ouvert. Il survit aux rendus, pas aux rechargements. */
let qVue = 'daily';

/* Une icône par famille d'objectif : on reconnaît la quête avant de la lire. */
const QICO = {
  checkin: 'clock', packs: 'star', new_cards: 'cards', tutoriel: 'livre',
  rarity_R: 'quest', rarity_E: 'quest', rarity_L: 'coin',
  trades: 'swap', recycle: 'recycle', collection_pct: 'cards',
  /* Toutes les cartes d'une rareté (supabase/installation/04_seed.sql). */
  set_ES: 'cards', set_C: 'cards', set_PC: 'cards', set_R: 'cards', set_E: 'cards', set_L: 'coin',
  /* Version 2.0 : Reverses, Brillantes, Devine l'illu, invitations, personnalisation. */
  rev_R: 'reflets', rset_C: 'reflets', rset_PC: 'reflets', rset_R: 'reflets', rset_ALL: 'reflets',
  brill_ALL: 'promo', illu: 'illu', ev_visite: 'reflets', invite: 'amis', titre: 'user', perso: 'user',
  /* Version 2.1 : plusieurs exemplaires d'une même carte. */
  ex_R: 'cards', ex_E: 'cards', ex_L: 'coin',
  /* Version 3.0 : les combats, les Secrètes, le Choc des Sections. */
  combats: 'sword', victoires: 'sword', vaincus: 'sword', victoires_dures: 'sword', defis: 'amis',
  campagne: 'trophy', legende: 'trophy', rarity_S: 'coin',
  raid: 'foudre', raid_degats: 'foudre', raid_victoires: 'foudre', epreuve: 'epreuve', epreuve_victoires: 'epreuve',
  deck: 'cards', cosm: 'user',
  /* L'XP et le niveau de combattant (js/combat/niveaux.js). */
  xp: 'niveau', niveau: 'niveau'
};

/* Les quêtes qui parlent de combat : la page Missions de l'onglet Combats
   les réunit, et les quêtes de saison en font un thème. */
const METRIQUES_COMBAT = ['combats', 'victoires', 'vaincus', 'victoires_dures', 'defis', 'campagne', 'legende',
  'xp', 'niveau', 'raid', 'raid_degats', 'raid_victoires', 'epreuve', 'epreuve_victoires'];
const estMissionCombat = q => METRIQUES_COMBAT.includes(q.metric);

/* ---------- Comptages ---------- */
const questesDe = scope => (save.quetes || []).filter(q => q.scope === scope);
const questePrete = q => !q.claimed && q.progress >= q.goal;

/* Nombre de récompenses à encaisser : sert la pastille de la barre du bas.
   Les seules quêtes de l'onglet : celles d'un événement ont leur pastille
   sur l'onglet de l'événement, pas ici. */
const SCOPES_ONGLET = SCOPES.map(s => s.id);
function questesPretes() {
  return (save.quetes || []).filter(q => SCOPES_ONGLET.includes(q.scope) && questePrete(q)).length;
}

const questesPretesDe = scope => questesDe(scope).filter(questePrete).length;

/* ---------- Remise à zéro ---------- */
/* Les périodes sont calées sur l'heure de Paris côté serveur (period_key dans
   supabase/installation/01_schema.sql) : on calcule ici la même frontière, sinon le compte à
   rebours du joueur et la remise à zéro réelle ne tomberaient pas ensemble.

   `Intl` donne l'heure de Paris quelle que soit celle du téléphone, et gère
   l'heure d'été sans table de dates à tenir à jour. */
const PARIS = { timeZone: 'Europe/Paris', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit' };

function heureParis(d) {
  const p = {};
  new Intl.DateTimeFormat('fr-FR', PARIS).formatToParts(d)
    .forEach(x => { if (x.type !== 'literal') p[x.type] = +x.value; });
  /* `24` pour minuit selon les navigateurs : on ramène à 0. */
  if (p.hour === 24) p.hour = 0;
  return p;
}

/* Millisecondes avant la prochaine remise à zéro de la période. */
function resteAvantRemise(scope) {
  if (scope === 'milestone') return null;
  const maintenant = Date.now() + Backend.skew;
  const p = heureParis(new Date(maintenant));
  const ecoule = (p.hour * 3600 + p.minute * 60 + p.second) * 1000;

  if (scope === 'daily') return 86400000 - ecoule;

  /* La semaine ISO commence le lundi : `getUTCDay()` sur une date construite à
     partir des composantes parisiennes donne le bon jour, sans fuseau qui s'en
     mêle. */
  const jour = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
  return (7 - jour) * 86400000 - ecoule;
}

/* « 4 h 20 », « 38 min », « 2 j 6 h » — le format se resserre quand l'échéance
   approche : à trois jours, les minutes n'intéressent personne. */
function dureeCourte(ms) {
  if (ms == null) return '';
  if (ms <= 0) return 'maintenant';
  const s = Math.floor(ms / 1000);
  const j = Math.floor(s / 86400);
  const hh = Math.floor(s / 3600) % 24;
  const mm = Math.floor(s / 60) % 60;
  if (j) return `${j} j ${hh} h`;
  if (hh) return `${hh} h ${String(mm).padStart(2, '0')}`;
  if (mm) return `${mm} min`;
  return `${s} s`;
}

/* ---------- Notification d'accomplissement ---------- */
/* Une quête finie se signale deux fois : une carte qui passe et s'en va, et la
   pastille de l'onglet, elle, qui reste. La carte dit « c'est arrivé », la
   pastille dit « il reste à encaisser » — l'une n'a pas à faire le travail de
   l'autre, donc elle ne s'attarde pas et ne demande rien.

   Le serveur seul décide de l'avancement : on ne fait que comparer deux états
   successifs (voir Backend.apply) et annoncer ce qui vient de basculer. */

const QNOTIF_DUREE = 4000;

const questesFinies = liste =>
  new Set((liste || []).filter(q => q.progress >= q.goal).map(q => q.id));

/* `avant` à null — première ouverture de session — n'annonce rien : sinon on
   accueillerait le joueur avec la pile de tout ce qu'il a déjà fait. */
function signalerQuetes(avant, apres) {
  if (!avant) return;
  const dejaFait = questesFinies(avant);
  const neuves = (apres || []).filter(q => q.progress >= q.goal && !dejaFait.has(q.id));
  /* Plusieurs à la fois (un combat en finit souvent trois) : une seule carte
     qui les compte, au lieu d'une pile qui couvre la moitié de l'écran
     (version 3.0.11). */
  if (neuves.length > 1) notifQuetes(neuves);
  else if (neuves.length) notifQuete(neuves[0]);
}

function notifQuete(q) {
  /* Une quête qui paie en objet l'annonce en toutes lettres : « ◆ 0 » sur une
     bannière de réussite donnerait l'impression d'un bug. */
  const gain = q.reward > 0
    ? `${q.monnaie === 'prismes' ? evIco() : shardIco}${fmtN(q.reward)}`
    : q.item ? 'Récompense' : '';
  carteQuete(q.titre, 'Quête accomplie', gain, q.scope);
}

/* Plusieurs quêtes d'un coup : leurs titres sur une ligne, et la somme de
   leurs gains, monnaie par monnaie. */
function notifQuetes(l) {
  const somme = ev => l.filter(q => q.reward > 0 && (q.monnaie === 'prismes') === ev).reduce((s, q) => s + q.reward, 0);
  const ec = somme(false), ev = somme(true);
  const gain = [ec ? `${shardIco}${fmtN(ec)}` : '', ev ? `${evIco()}${fmtN(ev)}` : ''].filter(Boolean).join(' ');
  carteQuete(l.map(q => q.titre).join(' · '), `${l.length} quêtes accomplies`, gain || 'Récompenses', l[0].scope);
}

/* La carte en haut de l'écran : ce qui est fait, une ligne d'état, le gain. */
function carteQuete(titre, etat, gain, vue) {
  const pile = $('#qnotif');
  if (!pile) return;

  const el = document.createElement('div');
  el.className = 'qn';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="qnico">${NAVICO.check}</span>
    <span class="qntxt"><b>${h(titre)}</b><small>${h(etat)}</small></span>
    ${gain ? `<span class="qngain">${gain}</span>` : ''}`;

  /* Deux quêtes peuvent tomber ensemble : un seul son pour la volée, sinon le
     même bruitage se superpose à lui-même. */
  if (!pile.children.length) SFX.jouer('gagne');
  pile.appendChild(el);

  /* On retire la carte du flux dès le départ de l'animation : les suivantes
     remontent pendant qu'elle s'efface, au lieu d'attendre sa disparition. */
  const partir = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  setTimeout(partir, QNOTIF_DUREE);
  el.onclick = () => { partir(); qVue = vue; aller('quetes'); };
}

/* ---------- L'écran ---------- */
function vQuetes() {
  if (Backend.mode !== 'cloud') return horsLigne('Quêtes');

  const qs = save.quetes || [];
  if (!qs.length) {
    return `<div class="pagehead"><div><h1>Quêtes</h1></div></div>
      ${vide('Rien à faire', 'Aucune quête n\'est configurée sur le serveur.')}`;
  }

  /* Un sous-onglet vide n'existe pas : on bascule sur le premier qui a du
     contenu plutôt que d'afficher une page blanche. */
  const dispo = SCOPES.filter(s => questesDe(s.id).length);
  if (!dispo.some(s => s.id === qVue)) qVue = dispo.length ? dispo[0].id : 'daily';

  const onglets = dispo.map(s => {
    const n = questesPretesDe(s.id);
    return `<button data-qv="${s.id}" class="${qVue === s.id ? 'on' : ''}">
      ${h(s.titre)}${n ? `<i class="pastille">${n}</i>` : ''}</button>`;
  }).join('');

  return `<div class="pagehead">
      <div>
        <h1>Quêtes</h1>
        <p>Elles paient en ${MONNAIE.nom}, la monnaie de la boutique.</p>
      </div>
      <span class="wallet pageact">${shardIco}<b>${fmtN(save.shards)}</b></span>
    </div>
    ${vAujourdhui()}
    <div class="segbar" role="tablist" aria-label="Période">${onglets}</div>
    ${vQuetesSection(qVue)}`;
}

/* ---------- Aujourd'hui (3.0.13) ---------- */
/* Ce qu'il reste à faire aujourd'hui, en une rangée, en tête des Quêtes :
   les rendez-vous qui ont un plafond par jour — les boosters de la réserve,
   Devine l'illu, l'Épreuve du Choc, les tentatives du Raid, les victoires
   payées en solo, les défis payés entre amis. Pas un onglet de plus (le
   propriétaire : « il y a déjà beaucoup d'onglets »), et pas une pastille
   de plus : chaque rendez-vous a déjà la sienne là où il vit. Un toucher y
   mène. Ce qui reste à faire passe devant ; ce qui est fait se coche. */
function chargerAujourdhui() {
  if (Backend.mode !== 'cloud' || !save) return;
  if (typeof illuData !== 'undefined' && !illuData) chargerIllu();
  if (cbEtat().section) relireRaid();
  if (evenementEnCours() === 'choc' && !chEtat) chargerChoc();
}

function vAujourdhui() {
  if (Backend.mode !== 'cloud') return '';
  const l = [];
  const ajoute = (fait, ico, titre, etat, lien) => l.push({ fait, html:
    `<button class="auj-c${fait ? ' fait' : ''}" ${lien}>
      <span class="auj-ico" aria-hidden="true">${NAVICO[fait ? 'check' : ico]}</span>
      <span class="auj-tx"><b>${titre}</b><small>${etat}</small></span>
    </button>` });

  const n = save.unlimited ? 1 : (save.tickets || 0) + (save.bonus || 0);
  ajoute(n <= 0, 'star', 'Boosters',
    save.unlimited ? 'illimités' : n > 0 ? `${n} à ouvrir` : `le prochain dans ${timerClock()}`, 'data-tab="boosters"');

  if (typeof illuData !== 'undefined' && illuData) {
    ajoute(!!illuData.fini, 'illu', 'Devine l\'illu',
      illuData.fini ? (illuData.trouve ? 'trouvée' : 'à demain') : 'l\'illustration du jour', 'data-tab="illu"');
  }

  if (evenementEnCours() === 'choc' && typeof chEtat !== 'undefined' && chEtat && chEtat.epreuve) {
    const r = chEtat.epreuve.max - chEtat.epreuve.essais.length;
    ajoute(r <= 0, 'epreuve', 'L\'Épreuve', r > 0 ? `${r} essai${r > 1 ? 's' : ''}` : 'faite', 'data-tab="choc" data-chv="epreuve"');
  }

  const e = cbEtat();
  if (e.section) {
    if (typeof rdEtat !== 'undefined' && rdEtat) {
      const t = rdTentatives();
      ajoute(t <= 0, 'foudre', 'Le Raid', t > 0 ? `${t} tentative${t > 1 ? 's' : ''}` : 'à demain', 'data-tab="combats" data-cbv="raid"');
    }
    const j = e.jour;
    ajoute(j.recompensees >= j.plafond, 'sword', 'Solo',
      `${Math.min(j.recompensees, j.plafond)}/${j.plafond} victoires payées`, 'data-tab="combats" data-cbv="solo"');
    ajoute(j.defis >= j.defis_plafond, 'amis', 'Versus',
      `${Math.min(j.defis, j.defis_plafond)}/${j.defis_plafond} défis payés`, 'data-tab="combats" data-cbv="versus"');
  } else {
    ajoute(false, 'sword', 'Combats', 'choisis ta Section', 'data-tab="combats"');
  }

  const reste = l.filter(x => !x.fait).length;
  l.sort((a, b) => a.fait - b.fait);
  return `<section class="auj" aria-labelledby="auj-titre">
      <div class="auj-tete"><h2 id="auj-titre">Aujourd'hui</h2><small>${reste ? `${reste} à faire` : 'Tout est fait'}</small></div>
      <div class="auj-l" data-defil="auj">${l.map(x => x.html).join('')}</div>
    </section>`;
}

function vQuetesSection(scope) {
  const def = SCOPES.find(s => s.id === scope) || SCOPES[0];
  const liste = questesDe(scope);
  const restantes = liste.filter(q => !q.claimed).length;
  const reste = resteAvantRemise(scope);

  /* Rien à faire : le bandeau passe au vert et sa coche remplace le compteur.
     Un second bandeau pour l'annoncer répétait, deux centimètres plus bas, ce
     que « 0 restante » disait déjà. */
  const fini = !restantes;

  const bandeau = `<div class="qperiode${fini ? ' fini' : ''}">
    <span class="qpico">${NAVICO[fini ? 'check' : reste == null ? 'promo' : 'clock']}</span>
    <span class="qptxt">
      <b>${h(def.plein)}</b>
      <small>${reste == null
        ? fini ? 'Il n\'en reste aucune : tu les as toutes.' : 'Une seule fois, pour toujours.'
        : `${fini ? 'De nouvelles dans' : 'Remise à zéro dans'} <b class="tnum" id="qremise">${dureeCourte(reste)}</b>`}</small>
    </span>
    <span class="qpreste">${fini
      ? `<i class="qpok">${NAVICO.check}</i><small>tout est fait</small>`
      : `<b class="tnum">${restantes}</b><small>${restantes > 1 ? 'restantes' : 'restante'}</small>`}</span>
  </div>`;

  return bandeau + (scope === 'milestone' ? vJalons(liste) : vListeQuetes(liste));
}

/* L'ordre d'une liste : ce qui est à récupérer d'abord, puis ce qui avance
   (le plus avancé en tête), et les quêtes déjà récupérées repliées en bas. */
const rangQuete = q => q.claimed ? 2 : q.progress >= q.goal ? 0 : 1;
function trierQuetes(l) {
  return l.slice().sort((a, b) => rangQuete(a) - rangQuete(b)
    || b.progress / b.goal - a.progress / a.goal || (a.ordre || 0) - (b.ordre || 0));
}
function vListeQuetes(liste, cle) {
  const l = trierQuetes(liste);
  const faites = l.filter(q => q.claimed);
  /* Plusieurs récompenses à prendre : un seul geste (version 3.0.11). */
  const prets = l.filter(questePrete);
  const tout = prets.length > 1 ? `<button class="btn rf-tout qtout" data-act="quetes-tout" data-ids="${prets.map(q => h(q.id)).join(',')}" data-snd="piece">${NAVICO.check}Tout récupérer · ${prets.length} quêtes</button>` : '';
  return `${tout}<div class="questlist">${l.filter(q => !q.claimed).map(q => vQuete(q)).join('')}</div>
    ${faites.length ? `<details class="qfaites" data-garde="qfaites-${cle || 'liste'}"><summary>${NAVICO.check}Récupérées <b>${faites.length}</b></summary>
      <div class="questlist">${faites.map(q => vQuete(q)).join('')}</div></details>` : ''}`;
}

/* « Tout récupérer » (version 3.0.11) : les quêtes prêtes d'une liste, une
   à une côté serveur (claim_quest : le serveur revérifie chacune), et un
   seul message à la fin plutôt qu'un par quête. */
async function recupererQuetes(ids) {
  if (!ids.length) return;
  occupe(true);
  let n = 0;
  try {
    for (const id of ids) { await Backend.claimQuest(id); n++; }
  } catch (e) {
    toast(e.message || 'Une récompense n\'est pas passée.');
  } finally {
    occupe(false);
  }
  if (n) { SFX.jouer('gagne'); toast(`${n} récompense${n > 1 ? 's' : ''} encaissée${n > 1 ? 's' : ''}.`); }
  render();
  if (tab === 'choc' && typeof chargerChoc === 'function') chargerChoc();
  if (tab === 'reflets' && typeof chargerReflets === 'function') chargerReflets();
}

/* Les quêtes de saison, par thème. Les paliers d'une même mesure (25, 50,
   100 boosters…) forment une chaîne : on n'en montre que le prochain, avec
   le nombre de paliers qui suivent — plus ceux qui sont déjà à récupérer. */
const qThemes = {};
document.addEventListener('toggle', e => {
  const t = e.target.dataset && e.target.dataset.qtheme;
  if (t) qThemes[t] = e.target.open;
}, true);
const JALON_THEMES = [
  ['Collection', m => m === 'collection_pct' || m.startsWith('set_') || m.startsWith('rarity_') || m.startsWith('ex_')],
  ['Combats', m => METRIQUES_COMBAT.includes(m) && m !== 'niveau'],
  ['Niveau', m => m === 'niveau'],
  ['Reverses', m => m.startsWith('rset_')],
  ['Boosters', m => m === 'packs'],
  ['Et aussi', () => true]
];
function vJalons(liste) {
  const chaines = {};
  liste.forEach(q => (chaines[q.metric] = chaines[q.metric] || []).push(q));
  const montrees = [];
  Object.values(chaines).forEach(ch => {
    ch.sort((a, b) => a.goal - b.goal || (a.ordre || 0) - (b.ordre || 0));
    const ouvertes = ch.filter(q => !q.claimed);
    const pretes = ouvertes.filter(q => q.progress >= q.goal);
    const prochaine = ouvertes.find(q => q.progress < q.goal);
    pretes.forEach(q => montrees.push({ q, apres: 0 }));
    if (prochaine) montrees.push({ q: prochaine, apres: ouvertes.length - pretes.length - 1 });
  });
  const faites = liste.filter(q => q.claimed);
  const vues = new Set();
  const blocs = JALON_THEMES.map(([nom, test]) => {
    const l = trierQuetes(montrees.filter(x => !vues.has(x.q.id) && test(x.q.metric)).map(x => x.q));
    l.forEach(q => vues.add(q.id));
    if (!l.length) return '';
    const apres = id => (montrees.find(x => x.q.id === id) || {}).apres || 0;
    const pretes = l.filter(q => q.progress >= q.goal).length;
    /* Un thème se replie. Ouvert d'office s'il y a quelque chose à récupérer,
       ou si c'est le premier ; sinon, le choix du joueur tient jusqu'au
       rechargement. */
    const ouvert = qThemes[nom] != null ? qThemes[nom] : pretes > 0 || nom === JALON_THEMES[0][0];
    return `<details class="qgroupe" data-qtheme="${nom}" data-garde="qtheme-${nom}"${ouvert ? ' open' : ''}>
      <summary><b>${nom}</b><small>${l.length}</small>${pretes ? `<i class="pastille">${pretes}</i>` : ''}<span class="qchev">${NAVICO.caret}</span></summary>
      <div class="questlist">${l.map(q => vQuete(q, apres(q.id))).join('')}</div></details>`;
  }).join('');
  return blocs + (faites.length ? `<details class="qfaites" data-garde="qfaites-jalons"><summary>${NAVICO.check}Récupérées <b>${faites.length}</b></summary>
    <div class="questlist">${trierQuetes(faites).map(q => vQuete(q)).join('')}</div></details>` : '');
}

/* Ce que la quête rapporte. Un palier qui donne une carte ne donne pas
   d'Éclats : afficher « ◆ 0 » serait un mensonge par omission. On montre donc
   l'objet — la carte, le cadre — à la place du montant.

   La carte, en vignette de 34 px, ne se lit pas : une pression l'ouvre dans la
   visionneuse, comme partout ailleurs dans le jeu. On veut voir ce qu'on va
   gagner avant de s'y mettre. */
function vRecompense(q) {
  const c = q.item ? byId[q.item] : null;
  if (c) {
    return `<button class="qreward objet voir" data-show="${c.id}" data-snd="carte"
      title="${h(c.nom)}" aria-label="Voir la carte ${h(c.nom)}">
      <span class="qrcarte">${renderCard(c)}</span>
      <small>${h(c.code || c.nom)}</small></button>`;
  }
  const t = q.item ? TITRES[q.item] : null;
  if (t) {
    return `<span class="qreward objet titre" title="Titre ${h(t.nom)}">
      <span class="qrtitre t${t.ton}">${h(t.nom)}</span><small>Titre</small></span>`;
  }
  if (q.monnaie === 'prismes') return `<span class="qreward prismes">${evIco()}${fmtN(q.reward)}</span>`;
  const f = q.item ? FRAMES[q.item] : null;
  if (f) {
    return `<span class="qreward objet" title="Cadre ${h(f.nom)}">
      <span class="qrcadre">${avatarHTML(save.avatar, q.item, 'sm', maPhoto())}</span>
      <small>Cadre</small></span>`;
  }
  return `<span class="qreward">${shardIco}${fmtN(q.reward)}</span>`;
}

/* Une quête, compacte : le titre et ce qu'elle rapporte, une ligne
   d'explication, puis la barre et le compte — ou le bouton, quand c'est fait.
   `apres` : les paliers qui suivent dans la même chaîne (quêtes de saison). */
function vQuete(q, apres) {
  const fini = q.progress >= q.goal;
  const pct = Math.min(100, Math.round(q.progress / q.goal * 100));
  const unite = q.metric === 'collection_pct' ? ' %' : '';

  return `<article class="quest${q.claimed ? ' done' : fini ? ' ready' : ''}">
    <span class="qico">${NAVICO[fini ? 'check' : (q.metric === 'ev_visite' && q.evenement === 'choc' ? 'choc' : QICO[q.metric]) || 'quest']}</span>
    <div class="qcorps">
      <div class="qhead"><b>${h(q.titre)}</b>${vRecompense(q)}</div>
      <p class="qdetail">${h(q.detail)}${apres ? ` <span class="qsuite">+${apres} palier${apres > 1 ? 's' : ''}</span>` : ''}${q.claimed ? '' : vMeilleure(q)}</p>
      ${q.claimed ? '' : `<div class="qfoot"><div class="qbar"><i style="width:${pct}%"></i></div>
        ${fini ? `<button class="btn tiny qbtn" data-quete="${h(q.id)}" data-snd="piece">Récupérer</button>`
          : `<span class="qcompte"><b>${fmtN(q.progress)}${unite}</b> / ${fmtN(q.goal)}${unite}</span>`}</div>`}
    </div>
  </article>`;
}

/* Version 2.1 : pour « plusieurs exemplaires d'une même carte », celle dont
   on a le plus — une pression l'ouvre, et c'est là qu'on règle « Garder »
   pour ne pas la recycler en route. */
function vMeilleure(q) {
  if (!q.metric.startsWith('ex_')) return '';
  const rar = q.metric.slice(3);
  const c = cards.filter(k => k.rar === rar && !k.promo && mesEx(k.id) > 0)
    .sort((a, b) => mesEx(b.id) - mesEx(a.id) || a.num - b.num)[0];
  return c ? ` <button class="linkbtn qmeilleure" data-show="${c.id}" data-snd="carte">${nomH(c)} ×${mesEx(c.id)}</button>` : '';
}

/* Le compte à rebours bat sans redessiner la page : un seul nœud change. */
function majRemiseQuetes() {
  const el = $('#qremise');
  if (!el) return;
  const reste = resteAvantRemise(qVue);
  if (reste == null) return;
  /* Passé zéro, c'est le serveur qui a la vérité : on va la chercher. */
  if (reste <= 0) return Backend.pull().then(render).catch(() => {});
  el.textContent = dureeCourte(reste);
}
