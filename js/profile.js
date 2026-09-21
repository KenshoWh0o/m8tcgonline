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
    <button class="btn tiny ghost" data-fiche="${h(save.pseudo)}">Ma fiche</button>
  </section>

  <section class="panel vitpanel">
    <h2>Ma vitrine <span class="muted small">— ce que les autres voient en premier</span></h2>
    ${vVitrine(save.vitrine, save.frame, true)}
    <p class="muted small">Le cadre est celui de ton avatar. Les autres s'achètent en boutique.</p>
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

/* ---------- La vitrine ---------- */
/* Quatre cartes mises en avant, les premières choses qu'on voit sur un profil.
   C'est ce que les cadres de la boutique encadrent. */
const VITRINE_MAX = 4;

function vVitrine(liste, cadre, modifiable) {
  const v = (liste || []).slice(0, VITRINE_MAX);
  const cases = [];

  for (let i = 0; i < VITRINE_MAX; i++) {
    const c = v[i] ? byId[v[i]] : null;
    if (c) {
      cases.push(`<div class="vit rempli">
        <button class="vitcarte" data-show="${c.id}" data-snd="carte">${renderCard(c)}</button>
        ${modifiable ? `<button class="vitx" data-vit-off="${c.id}" aria-label="Retirer">✕</button>` : ''}
        <span class="vitnom">${h(c.nom)}</span></div>`);
    } else if (modifiable) {
      cases.push(`<button class="vit vide" data-act="vit-add">
        <span class="vitplus">+</span><span class="muted small">Ajouter</span></button>`);
    } else {
      cases.push('<div class="vit vide muette"><span class="vitplus">·</span></div>');
    }
  }

  const f = FRAMES[cadre] || FRAMES.default;
  return `<div class="vitrine${f.prisme ? ' prisme' : ''}" style="--f1:${f.c1};--f2:${f.c2}">
    ${cases.join('')}</div>`;
}

/* Choisir une carte à exposer : tout ce qu'on possède, les plus rares d'abord. */
function ouvrirChoixVitrine() {
  const deja = save.vitrine || [];
  const liste = cards
    .filter(c => (save.col[c.id] || 0) > 0 && c.img && !deja.includes(c.id))
    .sort((a, b) => rk(b) - rk(a) || a.num - b.num);

  openSheet({
    title: 'Exposer une carte',
    body: liste.length
      ? `<p class="muted small">Quatre cartes au maximum. Elles apparaissent en haut de ton
           profil, et tous ceux qui le consultent les voient.</p>
         <div class="pickgrid">${liste.map(c =>
           `<button class="pick" data-vit-on="${c.id}" data-snd="carte">${renderCard(c)}
             <span class="picknom">${h(c.nom)}</span>
             <span class="pickmeta r${c.rar}">${(RAR[c.rar] || RAR.C).nom}</span></button>`).join('')}</div>`
      : `<p class="muted">${deja.length >= VITRINE_MAX
          ? 'Ta vitrine est pleine : retire une carte pour en mettre une autre.'
          : 'Ouvre quelques boosters d\'abord.'}</p>`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

const vitrineAjouter = id => agir(
  () => Backend.setVitrine([...(save.vitrine || []), id].slice(0, VITRINE_MAX)),
  'Carte exposée.');

const vitrineRetirer = id => agir(
  () => Backend.setVitrine((save.vitrine || []).filter(x => x !== id)));
