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
