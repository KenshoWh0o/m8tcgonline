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

  return `<div class="pagehead"><div><h1>Profil</h1></div></div>

  <section class="idcard${(save.succes || []).includes('unique') ? ' elu' : ''}${save.banniere ? ' banniere' : ''}">
    ${vBanniere(save.banniere)}
    ${avatarHTML(save.avatar, save.frame, 'xl', maPhoto())}
    <div class="idnom">
      <span class="idnomligne"><b>${h(save.pseudo)}</b></span>
      ${vTitreLigne(save.titre)}
      ${save.devise ? `<p class="iddevise">« ${h(save.devise)} »</p>` : ''}
      <p class="muted small">${save.streak > 1 ? save.streak + ' jours d\'affilée' : 'Membre'}</p>
    </div>
    <span class="wallet">${shardIco}<b>${fmtN(save.shards)}</b></span>
    <button class="btn tiny ghost" data-fiche="${h(save.pseudo)}">Ma fiche</button>
  </section>
  ${vElu(save.succes, true)}

  ${vPerso()}

  <section class="panel vitpanel">
    <h2>Ma vitrine <span class="muted small">— ce que les autres voient en premier</span></h2>
    ${vVitrine(save.vitrine, true)}
    <p class="muted small">Quatre cartes au maximum, visibles par tous ceux qui ouvrent ta fiche.</p>
  </section>

  <div class="stats">
    ${stat(possede + ' / ' + total, 'cartes différentes')}
    ${stat(exemplaires, 'exemplaires')}
    ${stat(save.packsOpened, 'boosters ouverts')}
    ${stat(save.tradesDone, 'échanges conclus')}
  </div>

  <section class="panel">
    <h2>Succès <span class="muted small">— ${(save.succes || []).length} / ${SUCCES.length}</span></h2>
    ${vSucces(save.succes, true)}
    <p class="muted small">Ceux que tu as débloqués apparaissent aussi sur ta fiche.</p>
  </section>

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
            ${avatarHTML('discord', save.frame, 'md', maPhoto())}<span>Discord</span></button>`
        : ''}
      <button class="avapick${String(save.avatar).startsWith('card:') ? ' on' : ''}" data-act="pf-carte">
        ${String(save.avatar).startsWith('card:')
          ? avatarHTML(save.avatar, save.frame, 'md', maPhoto())
          : '<span class="ava md ico"><span class="avaplus">+</span></span>'}
        <span>Une carte</span></button>
      ${Object.entries(AVATARS).map(([k, a]) =>
        `<button class="avapick${save.avatar === k ? ' on' : ''}" data-ava="${k}">
          ${avatarHTML(k, save.frame, 'md', maPhoto())}<span>${h(a.nom)}</span></button>`).join('')}
      ${Object.keys(COLORS).map(k =>
        `<button class="avapick${save.avatar === 'ess:' + k ? ' on' : ''}" data-ava="ess:${k}">
          ${avatarHTML('ess:' + k, save.frame, 'md')}<span>${h(COLORS[k].nom)}</span></button>`).join('')}
    </div>
  </section>

  <section class="panel">
    <h2>Cadre de l'avatar</h2>
    <div class="avagrid">
      ${cadres.map(k => `<button class="avapick${save.frame === k ? ' on' : ''}" data-frame="${k}"
        title="${h(FRAMES[k].nom)}">${avatarHTML(save.avatar, k, 'md', maPhoto())}<span>${h(FRAMES[k].nom)}</span></button>`).join('')}
      ${Object.keys(FRAMES).filter(k => !cadres.includes(k) && CADRE_SOURCE[k]).map(k =>
        `<span class="avapick verrou" title="${h(CADRE_SOURCE[k])}">${avatarHTML(save.avatar, k, 'md', maPhoto())}
          <span>${h(FRAMES[k].nom)}</span><small>${h(CADRE_SOURCE[k])}</small></span>`).join('')}
    </div>
  </section>`;
}

/* ---------- Version 2.0 : titre, bannière, devise ---------- */
/* Où se gagne chaque cadre qu'on n'a pas encore : le dire vaut mieux qu'une
   case grise muette. */
const CADRE_SOURCE = {
  f_azur: 'Boutique', f_rose: 'Boutique', f_or: 'Boutique', f_prisme: 'Boutique',
  f_sceau: '300 boosters ouverts', f_master: 'Les 122 cartes', f_reflet: 'Les 85 Reverses',
  f_aurore: 'Les 9 Brillantes', f_miroir: 'Pass Reflets, palier 10', f_nebuleuse: 'Pass Reflets, palier 20',
  f_unique: 'La carte unique',
  /* Version 3.0. */
  f_choc: 'Pass du Choc, palier 12', f_foudre: 'Raid, phase 5',
  f_niv10: 'Niveau 10 de combattant', f_niv20: 'Niveau 20 de combattant', f_niv30: 'Niveau 30 de combattant',
  f_niv50: 'Niveau 50 de combattant', f_toxique: 'Boutique', f_deter: 'Boutique',
  f_secrete: 'Ta première Secrète', f_maitrise: 'Une carte en maîtrise Prisme'
};

/* Le titre sous un pseudo. */
function vTitreLigne(id) {
  const t = id && TITRES[id];
  return t ? `<span class="titreligne t${t.ton}">${h(t.nom)}</span>` : '';
}

/* La bannière : l'illustration d'une carte, floutée derrière l'en-tête. */
function vBanniere(id) {
  const c = id && byId[id];
  return c && c.img ? `<span class="idbanniere" aria-hidden="true"><i style="background-image:url('${c.img}')"></i></span>` : '';
}

function vPerso() {
  const miens = save.titres || [];
  const c = save.banniere && byId[save.banniere];
  return `<section class="panel perso">
    <h2>Personnalisation <span class="muted small">— ce que les autres voient sur ta fiche</span></h2>

    <h3 class="persotitre">Titre</h3>
    <div class="titregrille">
      <button class="titrechoix${!save.titre ? ' on' : ''}" data-titre="">Aucun</button>
      ${Object.keys(TITRES).filter(k => miens.includes(k)).map(k =>
        `<button class="titrechoix${save.titre === k ? ' on' : ''}" data-titre="${k}"><span class="titreligne t${TITRES[k].ton}">${h(TITRES[k].nom)}</span></button>`).join('')}
    </div>
    ${Object.keys(TITRES).some(k => !miens.includes(k) && k !== 't_admin') ? `<details class="titresverrou">
      <summary>${Object.keys(TITRES).filter(k => !miens.includes(k) && k !== 't_admin').length} titres à débloquer</summary>
      <ul>${Object.keys(TITRES).filter(k => !miens.includes(k) && k !== 't_admin').map(k =>
        `<li><span class="titreligne t${TITRES[k].ton}">${h(TITRES[k].nom)}</span><small>${h(TITRES[k].comment)}</small></li>`).join('')}</ul>
    </details>` : ''}

    <h3 class="persotitre">Bannière</h3>
    <div class="banchoix">
      <span class="banapercu">${c ? renderCard(c) : '<span class="banvide">Aucune</span>'}</span>
      <div class="row">
        <button class="btn tiny ghost" data-act="pf-banniere">${c ? 'Changer' : 'Choisir une carte'}</button>
        ${c ? '<button class="btn tiny ghost" data-banniere="">Retirer</button>' : ''}
      </div>
    </div>

    <h3 class="persotitre">Devise</h3>
    <div class="findrow">
      <input id="pf-devise" type="text" maxlength="80" value="${h(save.devise || '')}" placeholder="Une phrase, 80 signes au plus">
      <button class="btn tiny ghost" data-act="pf-devise">Enregistrer</button>
    </div>
  </section>`;
}

const choisirTitre = id => agir(() => Backend.personnaliser(id || '', null, null),
  id ? `Titre « ${TITRES[id] ? TITRES[id].nom : id} » équipé.` : 'Titre retiré.');

const choisirBanniere = id => { closeSheet(); return agir(() => Backend.personnaliser(null, id || '', null), id ? 'Bannière posée.' : 'Bannière retirée.'); };

function enregistrerDevise() {
  const v = ($('#pf-devise') || {}).value || '';
  return agir(() => Backend.personnaliser(null, null, v), v.trim() ? 'Devise enregistrée.' : 'Devise retirée.');
}

function ouvrirChoixBanniere() {
  const liste = toutesCartes().filter(c => (save.col[c.id] || 0) > 0 && c.img).sort(parRarete);
  openSheet({
    title: 'Une bannière',
    body: liste.length
      ? `<p class="muted small">Son illustration passe en tête de ton profil et de ta fiche.</p>
         <div class="pickgrid">${liste.map(c => `<button class="pick" data-banniere="${c.id}" data-snd="carte">${renderCard(c)}
           <span class="picknom">${nomH(c)}</span></button>`).join('')}</div>`
      : '<p class="muted">Ouvre quelques boosters d\'abord.</p>',
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- Les succès ---------- */
/* `tous` : le profil montre aussi ceux qui restent à obtenir, grisés, avec ce
   qu'il faut faire. La fiche d'un autre joueur ne montre que les siens. */
/* ---------- L'Élu ---------- */
/* Celui qui a tiré la carte unique : un écrin sur son profil et sur sa fiche,
   en plus du cadre « Unique » sur son avatar, partout où il apparaît. Le
   succès « unique » (supabase/15_evenements.sql) dit qui c'est. */
function vElu(succes, moi) {
  const u = uniques[0];
  if (!u || !(succes || []).includes('unique')) return '';
  const ch = save.chasse || {};
  const quand = ch.trouvee_le ? new Date(srvTime(ch.trouvee_le)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  return `<button class="elu-ecrin" data-show="${u.id}" aria-label="Voir ${h(u.nom)}">
    <span class="elu-rayons" aria-hidden="true"></span>
    <span class="elu-carte">${renderCard(u)}</span>
    <span class="elu-texte">
      <i class="elu-kick">${NAVICO.trophy}L'Élu</i>
      <b>${moi ? 'Tu détiens' : 'Détient'} ${h(u.nom.replace(/^L'/, 'l\''))}</b>
      <small>Le seul exemplaire du jeu${quand ? `, tiré le ${h(quand)}` : ''}. Personne d'autre ne l'aura jamais.</small>
    </span>
  </button>`;
}

function vSucces(obtenus, tous) {
  const ok = new Set(obtenus || []);
  const liste = tous ? SUCCES : SUCCES.filter(s => ok.has(s.id));
  if (!liste.length) return '<p class="muted small">Aucun succès pour l\'instant.</p>';
  return `<div class="succes${tous ? '' : ' compact'}">${liste.map(s =>
    `<div class="badge t${s.ton}${ok.has(s.id) ? ' on' : ''}" title="${h(s.dit)}">
      <span class="sucico">${NAVICO[s.ico] || NAVICO.promo}</span>
      <span class="suctxt"><b>${h(s.nom)}</b><small>${h(s.dit)}</small></span>
    </div>`).join('')}</div>`;
}

/* Choisir une carte possédée comme avatar. */
function ouvrirChoixAvatar() {
  /* Les Promos comptent : ce sont les cartes dont on est le plus fier. */
  const liste = toutesCartes()
    .filter(c => (save.col[c.id] || 0) > 0 && c.img)
    .sort(parRarete);
  openSheet({
    title: 'Une carte en avatar',
    body: liste.length
      ? `<p class="muted small">Parmi les ${liste.length} cartes que tu possèdes.</p>
         <div class="pickgrid">${liste.map(c =>
           `<button class="pick" data-avacard="${c.id}" data-snd="carte">${renderCard(c)}
             <span class="picknom">${nomH(c)}</span></button>`).join('')}</div>`
      : '<p class="muted">Ouvre quelques boosters d\'abord.</p>',
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- La vitrine ---------- */
/* Quatre cartes mises en avant, les premières choses qu'on voit sur un profil.

   Elles ne portent plus le cadre d'avatar. Un cadre est fait pour cercler une
   vignette ronde ; posé autour d'une carte il ajoutait un second bord au bord
   déjà imprimé sur la carte, et les deux se disputaient l'œil. Les cartes se
   montrent telles qu'elles sont. */
const VITRINE_MAX = 4;

function vVitrine(liste, modifiable) {
  const v = (liste || []).slice(0, VITRINE_MAX);
  const cases = [];

  for (let i = 0; i < VITRINE_MAX; i++) {
    const c = v[i] ? byId[v[i]] : null;
    if (c) {
      cases.push(`<div class="vit rempli">
        <button class="vitcarte" data-show="${c.id}" data-snd="carte">${renderCard(c)}</button>
        ${modifiable ? `<button class="vitx" data-vit-off="${c.id}" aria-label="Retirer">✕</button>` : ''}
        <span class="vitnom">${nomH(c)}</span></div>`);
    } else if (modifiable) {
      cases.push(`<button class="vit vide" data-act="vit-add">
        <span class="vitplus">+</span><span class="muted small">Ajouter</span></button>`);
    } else {
      cases.push('<div class="vit vide muette"><span class="vitplus">·</span></div>');
    }
  }

  return `<div class="vitrine">${cases.join('')}</div>`;
}

/* Choisir une carte à exposer : tout ce qu'on possède, les plus rares d'abord. */
function ouvrirChoixVitrine() {
  const deja = save.vitrine || [];
  const liste = toutesCartes()
    .filter(c => (save.col[c.id] || 0) > 0 && c.img && !deja.includes(c.id))
    .sort(parRarete);

  openSheet({
    title: 'Exposer une carte',
    body: liste.length
      ? `<p class="muted small">Quatre cartes au maximum. Elles apparaissent en haut de ton
           profil, et tous ceux qui le consultent les voient.</p>
         <div class="pickgrid">${liste.map(c =>
           `<button class="pick" data-vit-on="${c.id}" data-snd="carte">${renderCard(c)}
             <span class="picknom">${nomH(c)}</span>
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
