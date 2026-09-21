/* Onglet Quêtes. Toute la progression est comptée par le serveur au moment où
   l'événement arrive vraiment (supabase/03_rpc.sql) : rien n'est déclaré par
   le navigateur, donc rien n'est gonflable depuis la console. */
"use strict";

const SCOPES = [
  ['daily', 'Aujourd\'hui', 'Remis à zéro chaque nuit, heure de Paris.'],
  ['weekly', 'Cette semaine', 'Remis à zéro le lundi.'],
  ['milestone', 'Paliers', 'Une seule fois, pour toujours.']
];

/* Nombre de récompenses à encaisser : sert la pastille de la barre du bas. */
function questesPretes() {
  return (save.quetes || []).filter(q => !q.claimed && q.progress >= q.goal).length;
}

/* ---------- Notification d'accomplissement ---------- */
/* Une quête finie se signale deux fois : une carte qui passe et s'en va, et la
   pastille de l'onglet, elle, qui reste. La carte dit « c'est arrivé », la
   pastille dit « il reste à encaisser » — l'une n'a pas à faire le travail de
   l'autre, donc elle ne s'attarde pas et ne demande rien.

   Le serveur seul décide de l'avancement : on ne fait que comparer deux états
   successifs (voir Backend.apply) et annoncer ce qui vient de basculer. */

const QNOTIF_DUREE = 4000;

/* Les identifiants des quêtes déjà terminées dans un état donné. */
const questesFinies = liste =>
  new Set((liste || []).filter(q => q.progress >= q.goal).map(q => q.id));

/* Compare l'ancien état au nouveau et annonce ce qui vient de se terminer.
   `avant` à null — première ouverture de session — n'annonce rien : sinon on
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
  el.innerHTML = `<span class="qnico">${NAVICO.quest}</span>
    <span class="qntxt"><b>${h(q.titre)}</b><small>Quête accomplie</small></span>
    <span class="qngain">${shardIco}${fmtN(q.reward)}</span>`;
  /* Deux quêtes peuvent tomber ensemble : un seul son pour la volée, sinon le
     même bruitage se superpose à lui-même. */
  if (!pile.children.length) SFX.jouer('gagne');
  pile.appendChild(el);

  /* On retire la carte du flux dès le départ de l'animation : les suivantes
     remontent pendant qu'elle s'efface, au lieu d'attendre qu'elle ait disparu. */
  const partir = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  setTimeout(partir, QNOTIF_DUREE);
  el.onclick = () => { partir(); aller('quetes'); };
}

function vQuetes() {
  if (Backend.mode !== 'cloud') return horsLigne('Quêtes');

  const qs = save.quetes || [];
  const pretes = questesPretes();

  const carte = q => {
    const fini = q.progress >= q.goal;
    const pct = Math.min(100, Math.round(q.progress / q.goal * 100));
    const suffixe = q.metric === 'collection_pct' ? ' %' : '';
    return `<article class="quest${q.claimed ? ' done' : fini ? ' ready' : ''}">
      <div class="qhead">
        <div><b>${h(q.titre)}</b><p class="muted small">${h(q.detail)}</p></div>
        <span class="qreward">${shardIco}${fmtN(q.reward)}</span>
      </div>
      <div class="qbar"><i style="width:${pct}%"></i></div>
      <div class="qfoot">
        <span class="muted small">${q.progress}${suffixe} / ${q.goal}${suffixe}</span>
        ${q.claimed
          ? '<span class="qtag">Récupérée</span>'
          : fini
            ? `<button class="btn tiny" data-quete="${h(q.id)}" data-snd="piece">Récupérer</button>`
            : '<span class="qtag muted">En cours</span>'}
      </div>
    </article>`;
  };

  const sections = SCOPES.map(([k, titre, sous]) => {
    const l = qs.filter(q => q.scope === k);
    if (!l.length) return '';
    const reste = l.filter(q => !q.claimed).length;
    return `<section class="qsec">
      <div class="qsechead"><h2>${titre}</h2><span class="muted small">${sous}</span></div>
      ${reste ? '' : '<p class="muted small qallgood">Tout est fait. Reviens plus tard.</p>'}
      ${l.map(carte).join('')}
    </section>`;
  }).join('');

  return `<div class="pagehead">
      <h1>Quêtes</h1>
      <p class="muted">Elles paient en ${MONNAIE.nom}, la monnaie de la boutique.</p>
    </div>
    ${pretes ? `<div class="notice ok">${pretes} récompense${pretes > 1 ? 's' : ''} à récupérer.</div>` : ''}
    ${sections || vide('Rien à faire', 'Aucune quête n\'est configurée sur le serveur.')}`;
}
