/* Onglet Profil (refait en 3.0.13).

   Le profil et la fiche d'un joueur ne font plus qu'un : la carte de visite
   (vCarteJoueur), que les autres voient telle quelle — qui il est, ses
   chiffres, sa carte fétiche, sa vitrine, ses combats et les decks qu'il
   montre, ses succès. Le profil y ajoute « Personnaliser » : une feuille en
   onglets pour l'avatar, le cadre, le titre, le fond et la devise, le
   pseudo. Avant, tous ces réglages s'empilaient dans la page, qui faisait
   3 900 px de haut sur téléphone (« c'est un peu le bordel »). */
"use strict";

function vProfil() {
  if (Backend.mode !== 'cloud') return horsLigne('Profil');
  return `<div class="pagehead"><div><h1>Profil</h1></div></div>${vCarteJoueur(donneesMoi(), { moi: true })}`;
}

/* Ses propres données, comme player_profile les donne pour les autres. */
function donneesMoi() {
  const col = save.col || {};
  const a = l => l.filter(c => col[c.id] > 0).length;
  const cb = save.combat || {};
  const aCombattu = cb.section || (cb.stats && (cb.stats.victoires || cb.stats.defaites || cb.stats.pvp_v || cb.stats.pvp_d));
  return {
    pseudo: save.pseudo, avatar: save.avatar, frame: save.frame, photo: maPhoto(), xp: monXp(),
    titre: save.titre, devise: save.devise, banniere: save.banniere, streak: save.streak,
    possede: a(cards), total: cards.length, secretes: a(secretes),
    reverses: a(reverses), reverses_total: reverses.length,
    packs_opened: save.packsOpened, trades_done: save.tradesDone,
    fetiche: save.fetiche && mesEx(save.fetiche) > 0 ? { carte: save.fetiche, niveau: null } : null,
    vitrine: save.vitrine || [], succes: save.succes || [],
    combat: aCombattu ? { section: cb.section, stats: cb.stats || {}, campagne: ((cb.campagne || {}).faits || []).length,
      decks: (cb.decks || []).filter(d => d.public) } : null,
    moi: true
  };
}

/* Les decks montrés, par joueur : de quoi les ouvrir d'un toucher. */
const pjDecks = {};

/* La carte de visite. `f` : player_profile, ou donneesMoi() ; `o.moi` : son
   propre profil (les boutons pour personnaliser). */
function vCarteJoueur(f, o) {
  o = o || {};
  const nCol = f.possede + (f.secretes || 0);
  const niv = f.xp != null && typeof niveauDe === 'function' ? niveauDe(f.xp).niveau : null;
  const sec = f.combat && f.combat.section && typeof SECTIONS !== 'undefined' ? SECTIONS[f.combat.section] : null;
  const meta = [
    sec ? `<span class="pj-sec" style="--sc:${sec.c}"><i aria-hidden="true"></i>${h(sec.court)}</span>` : '',
    f.streak > 1 ? `<span>${fmtN(f.streak)} jours d'affilée</span>` : '',
    f.membre_depuis ? `<span>Depuis le ${h(dateCourte(f.membre_depuis).split(' à ')[0])}</span>` : ''
  ].filter(Boolean).join('');
  const chiffre = (n, sur, l) => `<div><b class="tnum">${n}${sur != null ? `<small>/${sur}</small>` : ''}</b><span>${l}</span></div>`;
  return `<div class="pj${(f.succes || []).includes('unique') ? ' elu' : ''}">
    <section class="pj-hero${f.banniere ? ' fond' : ''}">
      ${vBanniere(f.banniere)}
      ${avatarHTML(f.avatar, f.frame, 'xl', f.photo, f.xp)}
      <div class="pj-id">
        <b class="pj-nom">${h(f.pseudo)}</b>
        ${vTitreLigne(f.titre)}
        ${f.devise ? `<p class="pj-devise">« ${h(f.devise)} »</p>` : ''}
        ${meta ? `<p class="pj-meta">${meta}</p>` : ''}
      </div>
      ${o.moi ? `<button class="btn tiny ghost pj-perso" data-act="pf-perso">${NAVICO.crayon}Personnaliser</button>` : ''}
    </section>
    <div class="pj-chiffres">
      ${chiffre(fmtN(nCol), f.total, 'Collection')}
      ${f.reverses_total ? chiffre(fmtN(f.reverses), f.reverses_total, 'Reverses') : ''}
      ${chiffre(fmtN(f.packs_opened || 0), null, 'Boosters')}
      ${chiffre(fmtN(f.trades_done || 0), null, 'Échanges')}
    </div>
    ${vElu(f.succes, f.moi)}
    ${f.fetiche ? vFetiche(f.fetiche.carte, f.fetiche.niveau, { moi: f.moi, edit: o.moi }) : o.moi ? vFetiche(null, null, { moi: true, edit: true }) : ''}
    ${(f.vitrine || []).length || o.moi ? `<section class="pj-bloc"><h2>Vitrine</h2>${vVitrine(f.vitrine, !!o.moi)}</section>` : ''}
    ${vCombatsJoueur(f, niv, o)}
    ${vSuccesJoueur(f, o)}
  </div>`;
}

/* Ses combats : le niveau, les victoires, la série, la campagne, et les
   decks qu'il montre (3.0.13). */
function vCombatsJoueur(f, niv, o) {
  const c = f.combat;
  if (!c) return o.moi ? '' : '';
  const s = c.stats || {};
  const v = (s.victoires || 0) + (s.pvp_v || 0);
  const tous = v + (s.defaites || 0) + (s.pvp_d || 0);
  const pct = tous ? Math.round(v / tous * 100) : 0;
  pjDecks[noacc(f.pseudo)] = c.decks || [];
  const decks = (c.decks || []).map((d, i) => {
    const ess = Object.keys(d.reserve || {}).filter(k => d.reserve[k] > 0);
    const k = d.couverture && byId[d.couverture];
    return `<button class="pj-deck" data-act="pj-deck" data-v="${i}" data-qui="${h(f.pseudo)}">
      <span class="pj-deck-art"${k && k.img ? ` style="background-image:url('${h(k.img)}')"` : ''}></span>
      <span class="pj-deck-t"><b>${h(d.nom)}</b><small>${ess.map(x => essIcon(x)).join('')}<span>${Decks.total(d.cartes)} cartes</span></small></span>
    </button>`;
  }).join('');
  const vide = o.moi
    ? `<p class="pj-vide">Aucun deck montré. Un deck complet se montre ici depuis Combats › Decks.</p>`
    : '';
  return `<section class="pj-bloc pj-combats">
    <h2>Combats${niv ? ` <span class="pj-niv">Niveau ${niv}</span>` : ''}</h2>
    <div class="pj-cb">
      <div class="pj-cb-grand"><b class="tnum">${fmtN(v)}</b><span>victoire${v > 1 ? 's' : ''}</span><small>${tous ? `${pct} % sur ${fmtN(tous)} combat${tous > 1 ? 's' : ''}` : 'Aucun combat'}</small></div>
      <div><b class="tnum">${fmtN(s.victoires || 0)}<i>–</i>${fmtN(s.defaites || 0)}</b><span>en solo</span></div>
      <div><b class="tnum">${fmtN(s.pvp_v || 0)}<i>–</i>${fmtN(s.pvp_d || 0)}</b><span>entre amis</span></div>
      <div><b class="tnum">${fmtN(s.serie || 0)}</b><span>série en cours</span><small>record ${fmtN(s.serie_max || 0)}</small></div>
      <div><b class="tnum">${fmtN(c.campagne || 0)}<small>/20</small></b><span>campagne</span></div>
    </div>
    ${decks ? `<h3 class="pj-sous">Decks montrés</h3><div class="pj-decks">${decks}</div>` : vide}
  </section>`;
}

/* Ses succès : sur son profil, tous (les siens d'abord) ; sur sa fiche,
   les siens. */
function vSuccesJoueur(f, o) {
  const n = (f.succes || []).length;
  if (!o.moi && !n) return '';
  return `<section class="pj-bloc"><h2>Succès <span class="pj-compte">${n} / ${SUCCES.length}</span></h2>
    ${vSucces(f.succes, !!o.moi)}</section>`;
}

/* Un deck montré, ouvert depuis un profil : ses cartes, sa Réserve, son
   code. `retour` : la fiche d'où l'on vient. */
function voirDeckMontre(pseudo, i) {
  const d = (pjDecks[noacc(pseudo)] || [])[+i];
  if (!d) return;
  const moi = noacc(pseudo) === noacc(save.pseudo);
  const ids = Object.keys(d.cartes).sort((a, b) => ordreType(a) - ordreType(b) || (byId[a] || {}).num - (byId[b] || {}).num);
  const code = Decks.encoder(d);
  openSheet({
    title: d.nom,
    body: `<p class="muted small">${moi ? 'Ton deck, montré sur ton profil.' : `Le deck de ${h(pseudo)}.`} ${Decks.total(d.cartes)} cartes, Réserve : ${Object.keys(d.reserve).filter(k => d.reserve[k] > 0).map(k => `${d.reserve[k]} ${COLORS[k].nom}`).join(', ')}.</p>
      <div class="cb-liste-deck">${ids.map(id => `<span class="cb-ld">${renderCard(byId[id] || {})}${d.cartes[id] > 1 ? `<i>×${d.cartes[id]}</i>` : ''}</span>`).join('')}</div>`,
    actions: moi
      ? [{ label: 'Ne plus le montrer', fn: () => { closeSheet(); agir(() => Backend.deckPublier(d.id, false), 'Ce deck ne se montre plus.'); } },
         { label: 'Fermer', primary: true, fn: closeSheet }]
      : [{ label: 'Copier son code', primary: true, fn: () => {
            (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
              .then(() => toast('Code copié : Combats › Decks › Importer un code.'), () => toast(code));
          } },
         { label: 'Retour à sa fiche', fn: () => ouvrirFiche(pseudo) }]
  });
}

/* ---------- Personnaliser ---------- */
/* Une feuille, cinq onglets. Chaque choix s'applique tout de suite ; la
   feuille se redessine à sa place (rafraichirPerso) pour montrer le
   nouveau choix. */
const PERSO_ONGLETS = [['avatar', 'Avatar'], ['cadre', 'Cadre'], ['titre', 'Titre'], ['fond', 'Fond'], ['pseudo', 'Pseudo']];
let persoOnglet = null;

function ouvrirPerso(ong) {
  persoOnglet = ong || persoOnglet || 'avatar';
  openSheet({ title: 'Personnaliser', body: vPersoFeuille(), actions: [{ label: 'Fermer', primary: true, fn: fermerPerso }] });
}
function fermerPerso() { persoOnglet = null; closeSheet(); }
function rafraichirPerso() {
  const x = document.querySelector('#sheet .pf-perso');
  if (x && persoOnglet) x.outerHTML = vPersoFeuille();
}
/* Après un choix fait dans une autre feuille (une carte en avatar, une
   bannière), on revient à la feuille de personnalisation. */
function revenirPerso() { if (persoOnglet) ouvrirPerso(persoOnglet); }

function vPersoFeuille() {
  const ong = persoOnglet || 'avatar';
  const seg = `<div class="segbar pf-ongs" role="tablist">${PERSO_ONGLETS.map(([k, nom]) =>
    `<button role="tab" aria-selected="${k === ong}" class="${k === ong ? 'on' : ''}" data-act="pf-ong" data-v="${k}">${nom}</button>`).join('')}</div>`;
  return `<div class="pf-perso">${seg}<div class="pf-corps">${vPersoOnglet(ong)}</div></div>`;
}

function vPersoOnglet(ong) {
  if (ong === 'avatar') {
    return `<div class="avagrid">
      ${Backend.photoDiscord
        ? `<button class="avapick${save.avatar === 'discord' ? ' on' : ''}" data-ava="discord" aria-pressed="${save.avatar === 'discord'}">
            ${avatarHTML('discord', save.frame, 'md', maPhoto())}<span>Discord</span></button>`
        : ''}
      <button class="avapick${String(save.avatar).startsWith('card:') ? ' on' : ''}" data-act="pf-carte">
        ${String(save.avatar).startsWith('card:')
          ? avatarHTML(save.avatar, save.frame, 'md', maPhoto())
          : '<span class="ava md ico"><span class="avaplus">+</span></span>'}
        <span>Une carte</span></button>
      ${Object.entries(AVATARS).map(([k, a]) =>
        `<button class="avapick${save.avatar === k ? ' on' : ''}" data-ava="${k}" aria-pressed="${save.avatar === k}">
          ${avatarHTML(k, save.frame, 'md', maPhoto())}<span>${h(a.nom)}</span></button>`).join('')}
      ${Object.keys(COLORS).map(k =>
        `<button class="avapick${save.avatar === 'ess:' + k ? ' on' : ''}" data-ava="ess:${k}" aria-pressed="${save.avatar === 'ess:' + k}">
          ${avatarHTML('ess:' + k, save.frame, 'md')}<span>${h(COLORS[k].nom)}</span></button>`).join('')}
    </div>`;
  }
  if (ong === 'cadre') {
    const cadres = Object.keys(FRAMES).filter(k => k === 'default' || (save.inv || {})[k] > 0);
    const verrou = Object.keys(FRAMES).filter(k => !cadres.includes(k) && CADRE_SOURCE[k]);
    return `<div class="avagrid">
      ${cadres.map(k => `<button class="avapick${save.frame === k ? ' on' : ''}" data-frame="${k}" aria-pressed="${save.frame === k}"
        title="${h(FRAMES[k].nom)}">${avatarHTML(save.avatar, k, 'md', maPhoto())}<span>${h(FRAMES[k].nom)}</span></button>`).join('')}
    </div>
    ${verrou.length ? `<h3 class="persotitre">À débloquer</h3><div class="avagrid">${verrou.map(k =>
      `<span class="avapick verrou" title="${h(CADRE_SOURCE[k])}">${avatarHTML(save.avatar, k, 'md', maPhoto())}
        <span>${h(FRAMES[k].nom)}</span><small>${h(CADRE_SOURCE[k])}</small></span>`).join('')}</div>` : ''}`;
  }
  if (ong === 'titre') {
    const miens = save.titres || [];
    const autres = Object.keys(TITRES).filter(k => !miens.includes(k) && k !== 't_admin');
    return `<div class="titregrille">
      <button class="titrechoix${!save.titre ? ' on' : ''}" data-titre="" aria-pressed="${!save.titre}">Aucun</button>
      ${Object.keys(TITRES).filter(k => miens.includes(k)).map(k =>
        `<button class="titrechoix${save.titre === k ? ' on' : ''}" data-titre="${k}" aria-pressed="${save.titre === k}"><span class="titreligne t${TITRES[k].ton}">${h(TITRES[k].nom)}</span></button>`).join('')}
    </div>
    ${autres.length ? `<details class="titresverrou" data-garde="titresverrou">
      <summary>${autres.length} titres à débloquer</summary>
      <ul>${autres.map(k => `<li><span class="titreligne t${TITRES[k].ton}">${h(TITRES[k].nom)}</span><small>${h(TITRES[k].comment)}</small></li>`).join('')}</ul>
    </details>` : ''}`;
  }
  if (ong === 'fond') {
    const c = save.banniere && byId[save.banniere];
    return `<h3 class="persotitre">Fond</h3>
    <p class="muted small">L'illustration d'une de tes cartes, derrière ton nom.</p>
    <div class="banchoix">
      <span class="banapercu">${c ? renderCard(c) : '<span class="banvide">Aucun</span>'}</span>
      <div class="row">
        <button class="btn tiny ghost" data-act="pf-banniere">${c ? 'Changer' : 'Choisir une carte'}</button>
        ${c ? '<button class="btn tiny ghost" data-banniere="">Retirer</button>' : ''}
      </div>
    </div>
    <h3 class="persotitre">Devise</h3>
    <div class="findrow">
      <input id="pf-devise" type="text" maxlength="80" value="${h(save.devise || '')}" placeholder="80 signes au plus" aria-label="Ta devise">
      <button class="btn tiny ghost" data-act="pf-devise">Enregistrer</button>
    </div>`;
  }
  return `<h3 class="persotitre">Pseudo</h3>
    <p class="muted small">Celui que les autres tapent pour t'ajouter. 3 à 16 caractères : lettres, chiffres, point, tiret, souligné.</p>
    <div class="findrow">
      <input id="pf-pseudo" type="text" maxlength="16" value="${h(save.pseudo)}" aria-label="Ton pseudo"
        autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny ghost" data-act="pf-pseudo">Changer</button>
    </div>`;
}

/* ---------- Version 2.0 : titre, bannière, devise ---------- */
/* Où se gagne chaque cadre qu'on n'a pas encore : le dire vaut mieux qu'une
   case grise muette. */
const CADRE_SOURCE = {
  f_azur: 'Boutique', f_rose: 'Boutique', f_or: 'Boutique', f_prisme: 'Boutique',
  f_sceau: '300 boosters ouverts', f_master: 'Les 122 cartes', f_reflet: 'Les 85 Reverses',
  f_aurore: 'Les 9 Brillantes', f_miroir: 'Pass Reflets, palier 10', f_nebuleuse: 'Pass Reflets, palier 20',
  f_unique: 'La carte unique',
  /* Version 2.5 (L'Échauffement, qui ne revient pas : ceux qui les ont les gardent). */
  f_braise: 'Pass de L\'Échauffement, palier 10', f_ardeur: 'Pass de L\'Échauffement, palier 20',
  /* Version 3.0. */
  f_choc: 'Pass du Choc, palier 12', f_foudre: 'Boutique du Choc',
  f_niv10: 'Niveau 10 de combattant', f_niv20: 'Niveau 20 de combattant', f_niv30: 'Niveau 30 de combattant',
  f_niv50: 'Niveau 50 de combattant', f_toxique: 'Boutique', f_deter: 'Boutique',
  f_secrete: 'Ta première Secrète'
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

const choisirTitre = id => agir(() => Backend.personnaliser(id || '', null, null),
  id ? `Titre « ${TITRES[id] ? TITRES[id].nom : id} » équipé.` : 'Titre retiré.');

const choisirBanniere = id => {
  /* Choisie dans sa feuille : on y revient ; retirée depuis « Personnaliser », la feuille se redessine (agir). */
  if (!document.querySelector('#sheet .pf-perso')) closeSheet();
  return agir(() => Backend.personnaliser(null, id || '', null), id ? 'Fond posé.' : 'Fond retiré.').then(() => { if (!document.querySelector('#sheet .pf-perso')) revenirPerso(); });
};

function enregistrerDevise() {
  const v = ($('#pf-devise') || {}).value || '';
  return agir(() => Backend.personnaliser(null, null, v), v.trim() ? 'Devise enregistrée.' : 'Devise retirée.');
}

function ouvrirChoixBanniere() {
  const liste = toutesCartes().filter(c => (save.col[c.id] || 0) > 0 && c.img).sort(parRarete);
  openSheet({
    title: 'Un fond',
    body: liste.length
      ? `<p class="muted small">Son illustration passe derrière ton nom, sur ton profil et ta fiche.</p>
         <div class="pickgrid">${liste.map(c => `<button class="pick" data-banniere="${c.id}" data-snd="carte">${renderCard(c)}
           <span class="picknom">${nomH(c)}</span></button>`).join('')}</div>`
      : '<p class="muted">Ouvre quelques boosters d\'abord.</p>',
    actions: [{ label: 'Retour', fn: () => (persoOnglet ? revenirPerso() : closeSheet()) }]
  });
}

/* ---------- Les succès ---------- */
/* `tous` : le profil montre aussi ceux qui restent à obtenir, grisés, avec ce
   qu'il faut faire. La fiche d'un autre joueur ne montre que les siens. */
/* ---------- L'Élu ---------- */
/* Celui qui a tiré la carte unique : un écrin sur son profil et sur sa fiche,
   en plus du cadre « Unique » sur son avatar, partout où il apparaît. Le
   succès « unique » (supabase/installation/15_evenements.sql) dit qui c'est. */
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
  /* Version 3.0 : sur son profil, tous les succès en pavés (l'icône et le
     nom) ; ce qu'il faut faire s'affiche quand on en touche un. La liste
     avec les explications faisait une page et demie de téléphone. */
  if (tous) return `<div class="succes paves">${liste.map(s =>
    `<button class="sucpave t${s.ton}${ok.has(s.id) ? ' on' : ''}" data-succes="${s.id}" aria-label="${h(s.nom)} : ${h(s.dit)}${ok.has(s.id) ? ' (obtenu)' : ''}">
      <span class="sucico">${NAVICO[s.ico] || NAVICO.promo}</span><b>${h(s.nom)}</b></button>`).join('')}</div>`;
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
    actions: [{ label: 'Retour', fn: () => (persoOnglet ? revenirPerso() : closeSheet()) }]
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
        <button class="vitcarte" data-show="${c.id}" data-snd="carte">${renderCard(c, modifiable && maitrisable(c) ? { m: niveauMaitrise(c) } : null)}</button>
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
