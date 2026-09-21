/* Onglet Profil : pseudo, avatar, cadre, statistiques.
   L'avatar peut être n'importe quelle carte de la collection — le serveur vérifie
   qu'elle est bien possédée avant de l'accepter. */
"use strict";

function vProfil() {
  if (Backend.mode !== 'cloud') return horsLigne('Profil');

  const total = cards.length;
  const possede = cards.filter(c => save.col[c.id] > 0).length;
  const exemplaires = Object.values(save.col).reduce((a, b) => a + b, 0);
  const cadres = Object.keys(FRAMES).filter(k => k === 'default' || (save.inv || {})[k] > 0);

  const stat = (n, l) => `<div class="stat"><b>${fmtN(n)}</b><span>${l}</span></div>`;

  return `<div class="pagehead"><h1>Profil</h1></div>

  <section class="idcard">
    ${avatarHTML(save.avatar, save.frame, 'xl')}
    <div class="idnom">
      <b>${h(save.pseudo)}</b>
      ${save.isAdmin ? '<span class="qtag ok">Admin</span>' : ''}
      <p class="muted small">${save.streak > 1 ? save.streak + ' jours d\'affilée' : 'Membre'}</p>
    </div>
    <span class="wallet">${shardIco}<b>${fmtN(save.shards)}</b></span>
  </section>

  <div class="stats">
    ${stat(possede + ' / ' + total, 'cartes différentes')}
    ${stat(exemplaires, 'exemplaires')}
    ${stat(save.packsOpened, 'boosters ouverts')}
    ${stat(save.tradesDone, 'échanges conclus')}
  </div>

  <section class="panel">
    <h2>Pseudo</h2>
    <p class="muted small">C'est lui que les autres tapent pour te proposer un échange.
      3 à 16 caractères : lettres, chiffres, point, tiret, souligné.</p>
    <div class="findrow">
      <input id="pf-pseudo" type="text" maxlength="16" value="${h(save.pseudo)}"
        autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny ghost" data-act="pf-pseudo">Changer</button>
    </div>
  </section>

  <section class="panel">
    <h2>Avatar</h2>
    <div class="avagrid">
      ${Backend.photoDiscord
        ? `<button class="avapick${save.avatar === 'discord' ? ' on' : ''}" data-ava="discord">
            ${avatarHTML('discord', save.frame, 'md')}<span>Discord</span></button>`
        : ''}
      <button class="avapick${String(save.avatar).startsWith('card:') ? ' on' : ''}" data-act="pf-carte">
        ${String(save.avatar).startsWith('card:')
          ? avatarHTML(save.avatar, save.frame, 'md')
          : '<span class="ava md ico"><span class="avaplus">+</span></span>'}
        <span>Une carte</span></button>
      ${Object.entries(AVATARS).map(([k, a]) =>
        `<button class="avapick${save.avatar === k ? ' on' : ''}" data-ava="${k}">
          ${avatarHTML(k, save.frame, 'md')}<span>${h(a.nom)}</span></button>`).join('')}
      ${Object.keys(COLORS).map(k =>
        `<button class="avapick${save.avatar === 'ess:' + k ? ' on' : ''}" data-ava="ess:${k}">
          ${avatarHTML('ess:' + k, save.frame, 'md')}<span>${h(COLORS[k].nom)}</span></button>`).join('')}
    </div>
  </section>

  <section class="panel">
    <h2>Cadre</h2>
    ${cadres.length > 1 ? '' : '<p class="muted small">Les autres cadres s\'achètent en boutique.</p>'}
    <div class="avagrid">
      ${cadres.map(k => `<button class="avapick${save.frame === k ? ' on' : ''}" data-frame="${k}"
        title="${h(FRAMES[k].nom)}">${avatarHTML(save.avatar, k, 'md')}</button>`).join('')}
    </div>
  </section>`;
}

/* Choisir une carte possédée comme avatar. */
function ouvrirChoixAvatar() {
  const liste = cards
    .filter(c => (save.col[c.id] || 0) > 0 && c.img)
    .sort((a, b) => rk(b) - rk(a) || a.num - b.num);
  openSheet({
    title: 'Une carte en avatar',
    body: liste.length
      ? `<p class="muted small">Parmi les ${liste.length} cartes que tu possèdes.</p>
         <div class="pickgrid">${liste.map(c =>
           `<button class="pick" data-avacard="${c.id}" data-snd="carte">${renderCard(c)}
             <span class="picknom">${h(c.nom)}</span></button>`).join('')}</div>`
      : '<p class="muted">Ouvre quelques boosters d\'abord.</p>',
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}
