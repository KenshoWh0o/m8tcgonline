/* Onglet Quêtes. Toute la progression est comptée par le serveur au moment où
   l'événement arrive vraiment (supabase/03_rpc.sql) : rien n'est déclaré par
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
  checkin: 'clock', packs: 'star', new_cards: 'cards',
  rarity_R: 'quest', rarity_E: 'quest', rarity_L: 'coin',
  trades: 'swap', recycle: 'recycle', collection_pct: 'cards',
  /* Toutes les cartes d'une rareté (supabase/04_seed.sql). */
  set_ES: 'cards', set_C: 'cards', set_PC: 'cards', set_R: 'cards', set_E: 'cards', set_L: 'coin'
};

/* ---------- Comptages ---------- */
const questesDe = scope => (save.quetes || []).filter(q => q.scope === scope);
const questePrete = q => !q.claimed && q.progress >= q.goal;

/* Nombre de récompenses à encaisser : sert la pastille de la barre du bas. */
function questesPretes() {
  return (save.quetes || []).filter(questePrete).length;
}

const questesPretesDe = scope => questesDe(scope).filter(questePrete).length;

/* ---------- Remise à zéro ---------- */
/* Les périodes sont calées sur l'heure de Paris côté serveur (period_key dans
   supabase/01_schema.sql) : on calcule ici la même frontière, sinon le compte à
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
  (apres || []).forEach(q => {
    if (q.progress >= q.goal && !dejaFait.has(q.id)) notifQuete(q);
  });
}

function notifQuete(q) {
  const pile = $('#qnotif');
  if (!pile) return;

  const el = document.createElement('div');
  el.className = 'qn';
  el.setAttribute('role', 'status');
  /* Une quête qui paie en objet l'annonce en toutes lettres : « ◆ 0 » sur une
     bannière de réussite donnerait l'impression d'un bug. */
  const gain = q.reward > 0
    ? `${shardIco}${fmtN(q.reward)}`
    : q.item ? 'Récompense' : '';
  el.innerHTML = `<span class="qnico">${NAVICO.check}</span>
    <span class="qntxt"><b>${h(q.titre)}</b><small>Quête accomplie</small></span>
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
  el.onclick = () => { partir(); qVue = q.scope; aller('quetes'); };
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
    <div class="segbar">${onglets}</div>
    ${vQuetesSection(qVue)}`;
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

  return bandeau + liste.map(vQuete).join('');
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
  const f = q.item ? FRAMES[q.item] : null;
  if (f) {
    return `<span class="qreward objet" title="Cadre ${h(f.nom)}">
      <span class="qrcadre">${avatarHTML(save.avatar, q.item, 'sm', maPhoto())}</span>
      <small>Cadre</small></span>`;
  }
  return `<span class="qreward">${shardIco}${fmtN(q.reward)}</span>`;
}

function vQuete(q) {
  const fini = q.progress >= q.goal;
  const pct = Math.min(100, Math.round(q.progress / q.goal * 100));
  const unite = q.metric === 'collection_pct' ? ' %' : '';

  return `<article class="quest${q.claimed ? ' done' : fini ? ' ready' : ''}">
    <span class="qico">${NAVICO[fini && !q.claimed ? 'check' : QICO[q.metric] || 'quest']}</span>
    <div class="qcorps">
      <div class="qhead">
        <div><b>${h(q.titre)}</b><p>${h(q.detail)}</p></div>
        ${vRecompense(q)}
      </div>
      <div class="qbar"><i style="width:${pct}%"></i></div>
      <div class="qfoot">
        <span class="qcompte"><b>${fmtN(q.progress)}${unite}</b> / ${fmtN(q.goal)}${unite}</span>
        ${q.claimed
          ? '<span class="qtag">Récupérée</span>'
          : fini
            ? `<button class="btn tiny" data-quete="${h(q.id)}" data-snd="piece">Récupérer</button>`
            : '<span class="qtag">En cours</span>'}
      </div>
    </div>
  </article>`;
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
