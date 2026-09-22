/* Onglet Échanges, dans Social.

   Une demande part vers un joueur, l'autre répond quand il veut : rien n'est
   simultané. Les deux cartes doivent être de même rareté, et c'est le serveur
   qui vérifie tout au moment de l'accord — possession comprise, pour que
   personne n'échange une carte qu'il vient de donner ailleurs.

   Tout l'écran répond à une seule question : « est-ce que cet échange est bon
   pour moi ? ». Trois choses doivent donc être lisibles sans cliquer :
     · combien d'exemplaires j'ai de chaque carte montrée ;
     · si ce qu'on me propose est une carte que je n'ai pas encore ;
     · ce que l'autre possède — sinon on demande dans le vide.
   C'est ce qui manquait : on voyait deux images et deux noms, et il fallait
   aller vérifier sa propre collection dans un autre onglet pour décider. */
"use strict";

let trVue = 'recues';                  /* 'recues' | 'envoyees' | 'nouvelle' */
let trBrouillon = { pseudo: '', offre: null, veut: null, note: '' };
let trCible = null;                    /* joueur visé : { pseudo, avatar, frame, photo } */

const RAR_ORDRE = ['C', 'PC', 'R', 'E', 'L'];
const tradeGratuit = () => !save.tradeFreeAt || save.tradeFreeAt <= Date.now();
const tradeJetons = () => (save.inv || {}).trade_token || 0;

/* ---------- Qui possède quoi ---------- */
/* Mes exemplaires : toujours connus. */
const mesEx = id => save.col[id] || 0;

/* Les collections des autres, rangées par pseudo. Le serveur ne les donne
   qu'entre amis (player_profile dans supabase/06_social.sql) ; une fois
   rapportées, elles ne bougent plus pendant qu'on compose, donc on ne les
   redemande pas à chaque rendu. */
const trCols = {};

/* Combien l'autre en a. `null` veut dire « on ne sait pas » — ce n'est pas
   zéro, et l'interface doit faire la différence : annoncer « il ne l'a pas »
   à partir d'une collection qu'on n'a jamais lue serait un mensonge. */
function sesEx(pseudo, id) {
  const col = pseudo ? trCols[noacc(pseudo)] : null;
  return col ? (col[id] || 0) : null;
}

async function chargerCollection(pseudo) {
  const cle = noacc(pseudo);
  if (trCols[cle]) return trCols[cle];
  try {
    const f = await Backend.ficheJoueur(pseudo);
    if (f && f.col) trCols[cle] = f.col;
    return f && f.col ? f.col : null;
  } catch (e) {
    return null;
  }
}

/* ---------- Ce qui arrive pendant qu'on regarde ailleurs ---------- */
/* Même principe que les quêtes : on ne croit pas le navigateur, on compare
   deux réponses successives du serveur. La pastille de l'onglet dit « il y a
   quelque chose » ; la carte qui passe dit quoi, et de la part de qui.

   Le premier chargement n'annonce rien : sinon, ouvrir le jeu déclencherait la
   pile de toutes les demandes déjà en attente. */
let trEtats = null;

function signalerEchanges(liste) {
  const etats = new Map((liste || []).map(t => [t.id, t.status]));
  if (trEtats === null) { trEtats = etats; return; }
  (liste || []).forEach(t => {
    const avant = trEtats.get(t.id);
    /* Une demande qu'on n'avait jamais vue, et qui nous est adressée. */
    if (t.sens === 'recue' && t.status === 'pending' && avant === undefined) return notifEchange(t, 'nouvelle');
    /* Une des nôtres qui vient d'être tranchée. Les annulations ne sont pas
       annoncées : c'est nous qui les faisons. */
    if (t.sens === 'envoyee' && avant === 'pending'
        && (t.status === 'accepted' || t.status === 'declined')) notifEchange(t, t.status);
  });
  trEtats = etats;
}

const TROC_NOTIF = {
  nouvelle: ['te propose un échange', 'Nouvelle demande'],
  accepted: ['a accepté ton échange', 'Échange conclu'],
  declined: ['a refusé ton échange', 'Demande close']
};

function notifEchange(t, quoi) {
  const pile = $('#qnotif');
  if (!pile) return;

  const [dit, sous] = TROC_NOTIF[quoi] || TROC_NOTIF.nouvelle;
  const el = document.createElement('div');
  el.className = 'qn troc' + (quoi === 'declined' ? ' froid' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="qnav">${avatarHTML(t.avatar, 'default', 'sm', t.photo)}</span>
    <span class="qntxt"><b>${h(t.pseudo)} ${dit}</b><small>${sous}</small></span>
    <span class="qnico">${NAVICO.swap}</span>`;

  if (!pile.children.length) SFX.jouer(quoi === 'declined' ? 'retour' : 'gagne');
  pile.appendChild(el);

  const partir = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  setTimeout(partir, QNOTIF_DUREE);
  el.onclick = () => {
    partir();
    socVue = 'echanges';
    trVue = t.sens === 'recue' ? 'recues' : 'envoyees';
    aller('social');
  };
}

/* ---------- La section Échanges ---------- */
function vEchanges() {
  const list = Backend.trades || [];
  const recues = list.filter(t => t.sens === 'recue' && t.status === 'pending');
  const envoyees = list.filter(t => t.sens === 'envoyee' && t.status === 'pending');
  const passees = list.filter(t => t.status !== 'pending');

  const sous = [
    ['recues', 'Reçues', recues.length],
    ['envoyees', 'Envoyées', envoyees.length],
    ['nouvelle', 'Proposer', 0]
  ];

  const proposer = '<button class="btn" data-tr="nouvelle">Proposer un échange</button>';

  let corps;
  if (trVue === 'nouvelle') corps = vNouvelleDemande();
  else if (trVue === 'envoyees') {
    corps = envoyees.length
      ? envoyees.map(ligneTrade).join('')
      : vide('Aucune demande en cours',
             'Propose un échange à un ami, puis attends sa réponse.', proposer);
  } else {
    corps = recues.length
      ? recues.map(ligneTrade).join('')
      : vide('Boîte vide', "Personne ne t'a proposé d'échange pour le moment.", proposer);
  }

  const histo = trVue !== 'nouvelle' && passees.length
    ? `<section class="qsec"><div class="qsechead"><h2>Ces sept derniers jours</h2></div>
       ${passees.slice(0, 8).map(ligneTrade).join('')}</section>`
    : '';

  return `${bandeauCout()}
    <div class="souschips">${sous.map(([k, l, n]) =>
      `<button data-tr="${k}" class="${trVue === k ? 'on' : ''}">${l}${n ? ` <i class="pastille">${n}</i>` : ''}</button>`).join('')}</div>
    ${corps}${histo}`;
}

/* Une ligne de recharge, lisible d'un coup d'œil : prête, ou le temps restant,
   avec les jetons qui permettent de passer devant. */
function bandeauCout() {
  const j = tradeJetons();
  const piece = `<img class="cdjeton" src="${ART.jeton}" alt="">`;
  const jetons = j
    ? `<span class="cdjetons" title="${j} jeton${j > 1 ? 's' : ''} d'échange">${piece}<b>${j}</b></span>`
    : `<button class="cdjetons vide" data-tab="boutique" title="Acheter un jeton">${piece}<b>0</b></button>`;

  if (tradeGratuit()) {
    return `<div class="cooldown pret">
      <span class="cdico">${NAVICO.check}</span>
      <span class="cdtxt"><b>Demande disponible</b>
        <small class="muted">Une gratuite toutes les ${TRADE_COOLDOWN_H} h</small></span>
      ${jetons}</div>`;
  }

  const reste = save.tradeFreeAt - Date.now();
  const pct = Math.max(0, Math.min(100, 100 - reste / (TRADE_COOLDOWN_H * 3600e3) * 100));
  return `<div class="cooldown">
    <span class="cdico">${ICON.glass}</span>
    <span class="cdtxt"><b>Prochaine gratuite dans ${dans(reste)}</b>
      <i class="cdbar"><i style="width:${pct.toFixed(1)}%"></i></i></span>
    ${jetons}</div>`;
}

/* ---------- Une demande ---------- */
function ligneTrade(t) {
  const off = byId[t.offer];
  const veut = byId[t.want];
  const attente = t.status === 'pending';
  const recue = t.sens === 'recue';

  const ETAT = { accepted: ['Acceptée', 'ok'], declined: ['Refusée', ''], cancelled: ['Annulée', ''] };
  const et = ETAT[t.status];

  /* Vu de chez soi, toujours dans le même sens : à gauche ce qui entre, à
     droite ce qui sort. Que la demande vienne de l'autre ou de nous ne change
     pas la question qu'on se pose en la lisant. */
  const entre = recue ? off : veut;
  const sort = recue ? veut : off;
  const inedite = entre && attente && !mesEx(entre.id);

  return `<article class="trade${attente ? '' : ' passe'}${inedite ? ' inedite' : ''}">
    <header class="trhead">
      ${avatarHTML(t.avatar, 'default', 'sm', t.photo)}
      <div><b>${h(t.pseudo)}</b>
        <p class="muted small">${recue ? 'te propose un échange' : 'a reçu ta demande'}
          · ${dateCourte(t.created_at)}</p></div>
      ${et ? `<span class="qtag ${et[1]}">${et[0]}</span>`
           : inedite ? '<span class="qtag neuf">Carte inédite</span>' : ''}
    </header>

    <div class="trswap">
      <div class="trside"><span class="trlab gain">Tu reçois</span>${miniCarte(entre, 'entre', t.pseudo)}</div>
      <span class="trarrow">${NAVICO.swap}</span>
      <div class="trside"><span class="trlab perte">Tu donnes</span>${miniCarte(sort, 'sort', t.pseudo)}</div>
    </div>

    ${t.note ? `<p class="trnote">« ${h(t.note)} »</p>` : ''}

    ${attente ? (recue
      ? `<div class="row tracts">
           <button class="btn tiny" data-trep="${t.id}" data-ok="1" ${t.possible ? '' : 'disabled'}>Accepter</button>
           <button class="btn tiny ghost" data-trep="${t.id}" data-ok="0">Refuser</button>
         </div>
         ${t.possible ? '' : '<p class="trraison">Tu ne possèdes pas la carte demandée : impossible d\'accepter.</p>'}`
      : `<div class="row tracts"><button class="btn tiny ghost" data-trann="${t.id}">Annuler la demande</button></div>`)
      : ''}
  </article>`;
}

/* Une carte dans une demande. Sous l'image, la seule phrase qui compte : ce
   que cet échange change pour ma collection. « Peu commune » ne le disait pas ;
   « tu ne l'as pas encore » et « ton seul exemplaire », si. */
function miniCarte(c, sens, pseudo) {
  if (!c) return '<div class="mini vide"><span>?</span></div>';
  const n = mesEx(c.id);

  const etat = sens === 'entre'
    ? (n ? `<span class="minietat">Tu en as déjà ${n}</span>`
         : '<span class="minietat neuf">Tu ne l\'as pas encore</span>')
    : (n > 1 ? `<span class="minietat">Il t'en restera ${n - 1}</span>`
       : n === 1 ? '<span class="minietat chaud">Ton seul exemplaire</span>'
       : '<span class="minietat chaud">Tu ne l\'as pas</span>');

  return `<button class="mini" data-show="${c.id}" data-qui="${h(pseudo || '')}" data-snd="carte">
    ${renderCard(c)}
    <span class="mininom">${h(c.nom)}</span>
    <span class="minimeta r${c.rar}">${(RAR[c.rar] || RAR.C).nom}</span>
    ${etat}
  </button>`;
}

const dateCourte = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/* =====================================================================
   Composer une demande
   =====================================================================
   Trois étapes numérotées, dans l'ordre où les décisions se prennent : à qui,
   quoi contre quoi, et un mot. Avant, l'écran demandait d'abord de taper un
   pseudo exact — ce qui suppose de le connaître par cœur — puis de choisir une
   carte à donner parmi tout ce qu'on possède, sans jamais dire ce que l'autre
   avait. On travaillait à l'aveugle. */
function vNouvelleDemande() {
  const off = trBrouillon.offre ? byId[trBrouillon.offre] : null;
  const veut = trBrouillon.veut ? byId[trBrouillon.veut] : null;
  const rarOK = off && veut && off.rar === veut.rar;
  const pret = trCible && off && veut && rarOK;

  return `<section class="compose">
    ${vRegles()}
    ${vEtape(1, 'À qui ?', !!trCible, vEtapeQui())}
    ${vEtape(2, 'Quoi contre quoi ?', !!(off && veut && rarOK), vEtapeCartes(off, veut, rarOK))}
    ${vEtape(3, 'Un mot ?', false, `
      <input id="tr-note" type="text" maxlength="140"
        placeholder="« Je cherche celle-là depuis deux semaines »"
        value="${h(trBrouillon.note)}">
      <p class="muted small">Facultatif. Il s'affiche sous ta demande.</p>`)}

    <div class="trenvoi">
      ${vCout()}
      <button class="btn" data-act="tr-send" ${pret ? '' : 'disabled'}>
        ${NAVICO.swap}${tradeGratuit() ? 'Envoyer la demande'
          : tradeJetons() ? 'Envoyer (1 jeton)' : 'Demande en recharge'}
      </button>
    </div>
  </section>`;
}

/* La règle du jeu, une bonne fois, à l'endroit où elle sert : au moment de
   composer. Répétée en petit sous chaque liste, elle ne se lisait plus. */
const vRegles = () => `<ol class="trregles">
  <li><b>Carte contre carte</b>, à rareté égale.</li>
  <li>Les <b>Essences</b> et les <b>Promos</b> ne s'échangent pas.</li>
  <li>L'autre joueur <b>valide quand il veut</b> : rien n'est immédiat.</li>
</ol>`;

const vEtape = (n, titre, faite, corps) => `<section class="etape${faite ? ' faite' : ''}">
  <div class="etapehead"><i class="etapeno">${faite ? NAVICO.check : n}</i><h2>${h(titre)}</h2></div>
  <div class="etapecorps">${corps}</div>
</section>`;

/* Étape 1 : d'abord ses amis, d'un geste. Le champ de pseudo reste, mais en
   second : c'est le recours, pas le chemin normal. */
function vEtapeQui() {
  if (trCible) {
    const col = trCols[noacc(trCible.pseudo)];
    return `<div class="found">
        ${avatarHTML(trCible.avatar, trCible.frame, 'sm', trCible.photo)}
        <b>${h(trCible.pseudo)}</b>
        <button class="linkbtn" data-act="tr-changer">Changer</button>
      </div>
      ${col
        ? '<button class="btn tiny ghost trvoir" data-act="tr-voir">Voir sa collection</button>'
        : `<p class="muted small">Sa collection n'est pas visible : ajoutez-vous en amis
             pour savoir ce qu'il possède avant de demander.</p>`}`;
  }

  const amis = (Backend.amis || []).filter(a => a.lien === 'ami');

  return `${amis.length
      ? `<div class="amirow">${amis.map(a =>
          `<button class="amichip" data-troc="${h(a.pseudo)}">
            ${avatarHTML(a.avatar, a.frame, 'sm', a.photo)}<span>${h(a.pseudo)}</span></button>`).join('')}</div>`
      : `<p class="muted small">Tu n'as encore aucun ami. Entre amis, on voit la collection
           de l'autre avant de proposer — c'est tout l'intérêt.</p>`}
    <p class="filab">Ou par son pseudo</p>
    <div class="findrow">
      <input id="tr-pseudo" type="text" maxlength="16" placeholder="Pseudo exact"
        value="${h(trBrouillon.pseudo)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny ghost" data-act="tr-find">Chercher</button>
    </div>`;
}

/* Étape 2 : les deux emplacements. Chacun dit ce qu'il change pour les deux
   collections — la mienne toujours, la sienne dès qu'on la connaît. */
function vEtapeCartes(off, veut, rarOK) {
  const pseudo = trCible ? trCible.pseudo : null;

  const empl = (role, c, libelle, aide) => {
    if (!c) {
      return `<button class="slot" data-pick="${role}">
        <span class="slotplus">+</span><span class="slotlab">${libelle}</span>
        <span class="muted small">${aide}</span></button>`;
    }
    const n = mesEx(c.id);
    const lui = sesEx(pseudo, c.id);
    const dit = role === 'offre'
      ? (n > 1 ? `Il t'en restera ${n - 1}` : 'Ton seul exemplaire')
      : (n ? `Tu en as déjà ${n}` : 'Carte inédite pour toi');
    return `<button class="slot rempli" data-pick="${role}">${renderCard(c)}
      <span class="slotnom">${h(c.nom)}</span>
      <span class="slotmeta r${c.rar}">${(RAR[c.rar] || RAR.C).nom}</span>
      <span class="slotdit${role === 'veut' && !n ? ' bon' : ''}">${h(dit)}</span>
      ${lui != null ? `<span class="slotdit lui">${h(pseudo)} : ${lui}</span>` : ''}</button>`;
  };

  const alerte = off && veut && !rarOK
    ? '<p class="autherr">Les deux cartes doivent être de la même rareté.</p>'
    : veut && pseudo && sesEx(pseudo, veut.id) === 0
      ? `<p class="autherr doux">${h(pseudo)} ne possède pas cette carte : il ne pourra pas accepter.</p>`
      : '';

  return `<div class="slots">
      ${empl('offre', off, 'Ce que tu donnes', 'Parmi ce que tu possèdes')}
      <span class="trarrow big">${NAVICO.swap}</span>
      ${empl('veut', veut, 'Ce que tu veux',
        off ? `Une ${(RAR[off.rar] || RAR.C).nom}` : 'Choisis d\'abord à gauche')}
    </div>${alerte}`;
}

/* Ce que la demande va coûter, dit avant d'appuyer et non après le refus. */
function vCout() {
  if (tradeGratuit()) {
    return `<p class="troccout ok">${NAVICO.check} Ta demande gratuite est disponible.</p>`;
  }
  if (tradeJetons()) {
    return `<p class="troccout"><img class="cdjeton" src="${ART.jeton}" alt="">
      Elle coûtera <b>1 jeton d'échange</b> — il t'en reste ${tradeJetons()}.</p>`;
  }
  return `<p class="troccout court">Plus de demande gratuite avant
    <b>${dans(save.tradeFreeAt - Date.now())}</b>.
    <button class="linkbtn" data-tab="boutique">Un jeton permet de passer devant</button></p>`;
}

/* ---------- Choisir une carte ---------- */
/* Pour ce qu'on donne : seulement ce qu'on possède, les doublons en tête — ce
   sont les cartes qu'on cède sans se démunir. Pour ce qu'on veut : la même
   rareté, ce que l'autre possède d'abord, et parmi elles ce qui me manque. */
function ouvrirChoixCarte(role) {
  const off = trBrouillon.offre ? byId[trBrouillon.offre] : null;
  const pseudo = trCible ? trCible.pseudo : null;

  let liste = cards.filter(c => c.cat !== 'essence');
  if (role === 'offre') liste = liste.filter(c => mesEx(c.id) > 0);
  else if (off) liste = liste.filter(c => c.rar === off.rar);

  liste.sort((a, b) => {
    if (role === 'offre') {
      const d = (mesEx(b.id) > 1) - (mesEx(a.id) > 1);
      if (d) return d;
    } else {
      const sa = sesEx(pseudo, a.id);
      const sb = sesEx(pseudo, b.id);
      if (sa != null && sb != null && (sa > 0) !== (sb > 0)) return sb > 0 ? 1 : -1;
      const ma = mesEx(a.id) > 0;
      const mb = mesEx(b.id) > 0;
      if (ma !== mb) return ma ? 1 : -1;
    }
    return RAR_ORDRE.indexOf(b.rar) - RAR_ORDRE.indexOf(a.rar) || a.num - b.num;
  });

  const corps = liste.length
    ? `<div class="pickgrid">${liste.map(c => {
        const n = mesEx(c.id);
        const lui = sesEx(pseudo, c.id);
        const hors = role === 'veut' && lui === 0;
        return `<button class="pick${hors ? ' hors' : ''}" data-cardpick="${c.id}" data-role="${role}" data-snd="carte">
          ${renderCard(c)}
          <span class="picknom">${h(c.nom)}</span>
          <span class="pickmeta r${c.rar}">${(RAR[c.rar] || RAR.C).sym}${n ? ` ×${n}` : ''}</span>
          ${lui != null ? `<span class="picklui${lui ? ' a' : ''}">${lui ? 'il en a ' + lui : 'il ne l\'a pas'}</span>` : ''}
        </button>`;
      }).join('')}</div>`
    : `<p class="muted">${role === 'offre'
        ? 'Tu ne possèdes encore aucune carte échangeable.'
        : 'Aucune carte de cette rareté dans l\'extension.'}</p>`;

  const connue = !!trCols[noacc(pseudo || '')];
  const aide = role === 'offre'
    ? 'Tes doublons d\'abord : ce sont ceux que tu peux céder sans rien perdre. Les Essences ne s\'échangent pas.'
    : off
      ? `Rareté imposée : ${(RAR[off.rar] || RAR.C).nom}, comme la carte que tu donnes.`
        + (connue ? ' Ce qu\'il possède est en tête.' : '')
      : 'Choisis d\'abord la carte que tu donnes : c\'est elle qui fixe la rareté.';

  openSheet({
    title: role === 'offre' ? 'Choisis ce que tu donnes' : 'Choisis ce que tu veux',
    body: `<p class="muted small">${aide}</p>${corps}`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- Voir la collection d'un autre ---------- */
/* Trois lectures d'une même liste, et c'est la première qui rend l'écran
   utile : « ce qu'il a et que tu n'as pas » est exactement la réponse à
   « qu'est-ce que je lui demande ? ». */
let trColVue = 'manque';
/* Par où repartir en fermant. Depuis une fiche de joueur, on doit y revenir :
   une feuille qui en remplace une autre et se referme sur le vide donne
   l'impression d'avoir perdu sa place. */
let trColRetour = null;

const TRCOL_VUES = [
  ['manque', 'Qu\'il a, pas toi'],
  ['doubles', 'Ses doublons'],
  ['tout', 'Tout']
];

async function ouvrirCollectionDe(pseudo, retour) {
  trColRetour = retour || null;
  occupe(true);
  const col = await chargerCollection(pseudo);
  occupe(false);
  if (!col) return toast('Sa collection n\'est visible qu\'entre amis.');
  montrerCollectionDe(pseudo);
}

function montrerCollectionDe(pseudo) {
  const col = trCols[noacc(pseudo)] || {};
  /* Les Promos comptent dans ce qu'il montre, même si elles ne s'échangent
     pas : sa collection, c'est tout ce qu'il a. */
  const sienne = toutesCartes().filter(c => col[c.id] > 0);

  const listes = {
    manque: sienne.filter(c => !mesEx(c.id)),
    doubles: sienne.filter(c => col[c.id] > 1),
    tout: sienne
  };
  const liste = (listes[trColVue] || sienne).slice().sort(parRarete);

  const chips = TRCOL_VUES.map(([k, l]) =>
    `<button data-trcol="${k}" data-qui="${h(pseudo)}" class="${trColVue === k ? 'on' : ''}">${l}
      <i class="pickn">${listes[k].length}</i></button>`).join('');

  const grille = liste.length
    ? `<div class="pickgrid">${liste.map(c => {
        const n = mesEx(c.id);
        return `<button class="pick" data-show="${c.id}" data-qui="${h(pseudo)}" data-snd="carte">
          ${renderCard(c)}
          <span class="picknom">${h(c.nom)}</span>
          <span class="pickmeta r${c.rar}">${(RAR[c.rar] || RAR.C).sym} ×${col[c.id]}</span>
          <span class="picklui${n ? '' : ' a'}">${n ? `tu en as ${n}` : 'tu ne l\'as pas'}</span>
        </button>`;
      }).join('')}</div>`
    : `<p class="muted">${trColVue === 'manque'
        ? 'Il n\'a rien que tu n\'aies déjà.'
        : trColVue === 'doubles' ? 'Aucun doublon de son côté.' : 'Sa collection est vide.'}</p>`;

  openSheet({
    title: 'La collection de ' + pseudo,
    body: `<p class="muted small">${sienne.length} carte${sienne.length > 1 ? 's' : ''} différente${sienne.length > 1 ? 's' : ''}.
        Les Essences et les Promos ne s'échangent pas.</p>
      <div class="souschips trcolvues">${chips}</div>${grille}`,
    actions: trColRetour
      ? [{ label: 'Retour au profil', fn: () => { const r = trColRetour; trColRetour = null; r(); } },
         { label: 'Fermer', fn: closeSheet }]
      : [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- Envoi ---------- */
async function trChercher() {
  const p = valeur('tr-pseudo');
  trBrouillon.pseudo = p;
  if (!p) { trCible = null; return render(); }
  occupe(true);
  try {
    const r = await Backend.findPlayer(p);
    trCible = r || null;
    if (!r) { toast('Aucun joueur ne porte ce pseudo.'); SFX.jouer('erreur'); }
    else { SFX.jouer('gagne'); await chargerCollection(r.pseudo); }
  } catch (e) {
    toast(e.message);
  } finally {
    occupe(false);
    render();
  }
}

/* Changer de destinataire remet les cartes à zéro : la rareté imposée et la
   liste de ce qu'il possède dépendaient de lui. */
function trChanger() {
  trCible = null;
  trBrouillon = { pseudo: '', offre: null, veut: null, note: trBrouillon.note };
  render();
}

async function trEnvoyer() {
  if (!trCible || !trBrouillon.offre || !trBrouillon.veut) return;
  const note = $('#tr-note') ? $('#tr-note').value.trim() : '';
  const qui = trCible.pseudo;
  await agir(async () => {
    await Backend.tradeCreate(qui, trBrouillon.offre, trBrouillon.veut, note);
    trBrouillon = { pseudo: '', offre: null, veut: null, note: '' };
    trCible = null;
    trVue = 'envoyees';
  }, 'Demande envoyée à ' + qui + '.');
}
