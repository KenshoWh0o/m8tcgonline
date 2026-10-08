/* Onglet Échanges, dans Social.

   Une demande part vers un joueur, l'autre répond quand il veut : rien n'est
   simultané. Les deux cartes doivent être de même rareté, et c'est le serveur
   qui vérifie tout au moment de l'accord — possession comprise, pour que
   personne n'échange une carte qu'il vient de donner ailleurs.

   ------------------------------------------------------------------------
   La règle de l'écran : une carte parle d'elle-même

   La version précédente empilait sous chaque vignette son nom, sa rareté et
   une phrase sur ma collection — trois lignes de 10 px par carte, deux cartes
   par demande, et une page qui se lisait comme une notice. Or l'illustration
   porte déjà le nom et la rareté, et un toucher l'ouvre en grand.

   Il ne reste donc, autour de chaque carte, que ce que l'image ne dit pas :
     · une étiquette sur la carte : combien J'EN AI — « Nouvelle » si aucune,
       « Dernière » si je donne mon seul exemplaire ;
     · une légende dessous : « Tu reçois » ou « Tu donnes ».
   Et partout le même ordre, dans les demandes comme dans la composition : à
   gauche ce qu'on reçoit, à droite ce qu'on donne. */
"use strict";

let trVue = 'recues';                  /* 'recues' | 'envoyees' | 'historique' | 'nouvelle' */
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

/* Une carte échangeable : ni Essence, ni Promo — le serveur refuse les deux. */
const echangeable = c => c && c.cat !== 'essence' && !c.promo;

/* ---------- L'étiquette posée sur une carte ---------- */
/* Toujours la même question : combien j'en ai. Seul le mot change selon le
   sens — une carte qui entre et que je n'ai pas est une bonne nouvelle, une
   carte qui sort et que je n'aurai plus est une perte. */
function etiquette(c, sens) {
  const n = mesEx(c.id);
  if (sens === 'entre') {
    return n ? `<i class="tpill" title="Tu en as déjà ${n}">×${n}</i>`
             : '<i class="tpill neuf">Nouvelle</i>';
  }
  if (n > 1) return `<i class="tpill" title="Tu en as ${n}">×${n}</i>`;
  return n === 1 ? '<i class="tpill perte" title="Ton seul exemplaire">Dernière</i>'
                 : '<i class="tpill perte" title="Tu ne l\'as plus">×0</i>';
}

/* Une carte d'une demande : l'image, son étiquette, sa légende. */
function tCarte(c, sens, pseudo) {
  const legende = sens === 'entre' ? 'Tu reçois' : 'Tu donnes';
  if (!c) {
    return `<figure class="tcarte ${sens}"><div class="tcarte-vide">?</div>
      <figcaption>${legende}</figcaption></figure>`;
  }
  return `<figure class="tcarte ${sens}">
    <button class="tcarte-img" data-show="${c.id}" data-qui="${h(pseudo || '')}" data-snd="carte"
      aria-label="${h(c.nom)}">${renderCard(c)}${etiquette(c, sens)}</button>
    <figcaption>${legende}</figcaption>
  </figure>`;
}

/* ---------- La section Échanges ---------- */
function vEchanges() {
  if (trVue === 'nouvelle') return vNouvelleDemande();

  const list = Backend.trades || [];
  const recues = list.filter(t => t.sens === 'recue' && t.status === 'pending');
  const envoyees = list.filter(t => t.sens === 'envoyee' && t.status === 'pending');
  const passees = list.filter(t => t.status !== 'pending');

  const sous = [
    ['recues', 'Reçues', recues.length],
    ['envoyees', 'Envoyées', envoyees.length],
    ['historique', 'Historique', 0]
  ];

  let corps;
  if (trVue === 'historique') {
    corps = passees.length
      ? `<div class="thisto">${passees.map(ligneHisto).join('')}</div>`
      : vide('Rien pour l\'instant', 'Les échanges des sept derniers jours apparaîtront ici.');
  } else if (trVue === 'envoyees') {
    corps = envoyees.length
      ? envoyees.map(ligneTrade).join('')
      : vide('Aucune demande en cours', 'Propose un échange à un ami : il répondra quand il veut.');
  } else {
    corps = recues.length
      ? recues.map(ligneTrade).join('')
      : vide('Rien à trancher', 'Personne ne t\'a proposé d\'échange pour le moment.');
  }

  return `<div class="tbar">
      ${vRecharge()}
      <button class="btn tiny" data-tr="nouvelle">${NAVICO.swap}Proposer</button>
    </div>
    <div class="souschips">${sous.map(([k, l, n]) =>
      `<button data-tr="${k}" class="${trVue === k ? 'on' : ''}">${l}${n ? ` <i class="pastille">${n}</i>` : ''}</button>`).join('')}</div>
    ${corps}`;
}

/* La recharge, en une pastille : prête, ou le temps restant. Les jetons n'y
   sont pas : ils ne comptent qu'au moment d'envoyer, et c'est là que l'écran
   de composition les montre (vCout). À côté du bouton, sur un téléphone, les
   deux ne tenaient pas ensemble et le délai se lisait « Gratuite d… ». */
function vRecharge() {
  if (tradeGratuit()) {
    return `<span class="trecharge pret">${NAVICO.check}<span>Demande gratuite prête</span></span>`;
  }
  const reste = save.tradeFreeAt - Date.now();
  const pct = Math.max(0, Math.min(100, 100 - reste / (TRADE_COOLDOWN_H * 3600e3) * 100));
  const j = tradeJetons();
  return `<span class="trecharge" style="--p:${pct.toFixed(1)}%"
      title="${j ? `${j} jeton${j > 1 ? 's' : ''} d'échange pour passer devant` : 'Un jeton d\'échange permet de passer devant'}">${ICON.glass}
    <span>Gratuite dans <b>${dans(reste)}</b></span></span>`;
}

/* ---------- Une demande ---------- */
function ligneTrade(t) {
  const off = byId[t.offer];
  const veut = byId[t.want];
  const recue = t.sens === 'recue';

  /* Vu de chez soi, toujours dans le même sens : à gauche ce qui entre, à
     droite ce qui sort. Que la demande vienne de l'autre ou de nous ne change
     pas la question qu'on se pose en la lisant. */
  const entre = recue ? off : veut;
  const sort = recue ? veut : off;
  const inedite = entre && !mesEx(entre.id);

  const actions = recue
    ? `<div class="tacts">
         <button class="btn tiny ghost" data-trep="${t.id}" data-ok="0">Refuser</button>
         <button class="btn tiny" data-trep="${t.id}" data-ok="1" ${t.possible ? '' : 'disabled'}>Accepter</button>
       </div>
       ${t.possible ? '' : '<p class="traison">Tu n\'as plus la carte demandée.</p>'}`
    : `<div class="tacts seul">
         <span class="tattente">En attente de sa réponse</span>
         <button class="btn tiny ghost" data-trann="${t.id}">Annuler</button>
       </div>`;

  return `<article class="troc${inedite ? ' inedite' : ''}">
    <header class="troc-tete">
      ${avatarHTML(t.avatar, 'default', 'sm', t.photo)}
      <b>${h(t.pseudo)}</b>
      <time>${ilya(t.created_at)}</time>
    </header>
    <div class="troc-cartes">
      ${tCarte(entre, 'entre', t.pseudo)}
      <span class="troc-fleche" aria-hidden="true">${NAVICO.swap}</span>
      ${tCarte(sort, 'sort', t.pseudo)}
    </div>
    ${t.note ? `<p class="troc-mot">${h(t.note)}</p>` : ''}
    ${actions}
  </article>`;
}

/* L'historique tient sur une ligne par échange : ce qui est tranché ne se
   relit pas, il se retrouve. */
function ligneHisto(t) {
  const recue = t.sens === 'recue';
  const entre = byId[recue ? t.offer : t.want];
  const sort = byId[recue ? t.want : t.offer];
  const ETAT = { accepted: ['Conclu', 'ok'], declined: ['Refusé', ''], cancelled: ['Annulé', ''] };
  const [mot, cls] = ETAT[t.status] || ['', ''];
  const mini = c => c
    ? `<button class="thmini" data-show="${c.id}" data-snd="carte" aria-label="${h(c.nom)}">${renderCard(c)}</button>`
    : '<span class="thmini"></span>';

  return `<div class="thligne">
    ${avatarHTML(t.avatar, 'default', 'sm', t.photo)}
    <span class="thqui"><b>${h(t.pseudo)}</b><small>${ilya(t.created_at)}</small></span>
    <span class="thcartes">${mini(entre)}<i>${NAVICO.swap}</i>${mini(sort)}</span>
    <span class="thetat ${cls}">${mot}</span>
  </div>`;
}

/* =====================================================================
   Composer une demande
   =====================================================================
   Trois décisions, dans l'ordre où on les prend : avec qui, quoi contre quoi,
   et un mot si on veut. Pas d'étapes numérotées ni de règlement en tête : la
   règle tient en une ligne au pied de l'écran, et la seule phrase qui change
   est celle qui dit quoi faire ensuite. */
function vNouvelleDemande() {
  const off = trBrouillon.offre ? byId[trBrouillon.offre] : null;
  const veut = trBrouillon.veut ? byId[trBrouillon.veut] : null;
  const pret = trCible && off && veut && off.rar === veut.rar;
  const pseudo = trCible ? trCible.pseudo : null;
  const ilManque = veut && pseudo && sesEx(pseudo, veut.id) === 0;

  const slot = (role, c, sens) => c
    ? `<figure class="tcarte ${sens}">
         <button class="tcarte-img" data-pick="${role}" aria-label="Changer : ${h(c.nom)}">${renderCard(c)}${etiquette(c, sens)}</button>
         <figcaption>${sens === 'entre' ? 'Tu reçois' : 'Tu donnes'}</figcaption>
       </figure>`
    : `<figure class="tcarte ${sens}">
         <button class="tslot" data-pick="${role}" ${trCible ? '' : 'disabled'}><span>+</span></button>
         <figcaption>${sens === 'entre' ? 'Tu reçois' : 'Tu donnes'}</figcaption>
       </figure>`;

  /* Une seule phrase d'aide, celle de l'étape où l'on en est. */
  let aide;
  if (!trCible) aide = 'Choisis d\'abord avec qui échanger.';
  else if (ilManque) aide = `<span class="warn">${h(pseudo)} n'a pas cette carte : il ne pourra pas accepter.</span>`;
  else if (pret) aide = `Tu reçois <b>${h(veut.nom)}</b>, tu donnes <b>${h(off.nom)}</b>.`;
  else if (off || veut) aide = `Rareté imposée : <b>${(RAR[(off || veut).rar] || RAR.C).nom}</b>.`;
  else aide = 'Touche une case : la carte que tu veux, puis celle que tu donnes.';

  return `<section class="compo">
    <div class="compo-tete">
      <button class="compo-retour" data-tr="recues" aria-label="Retour aux échanges">${NAVICO.caret}</button>
      <h2>Nouvel échange</h2>
    </div>

    <div class="compo-bloc">${vAvecQui()}</div>

    <div class="compo-bloc">
      <div class="troc-cartes">
        ${slot('veut', veut, 'entre')}
        <span class="troc-fleche" aria-hidden="true">${NAVICO.swap}</span>
        ${slot('offre', off, 'sort')}
      </div>
      <p class="compo-aide">${aide}</p>
    </div>

    <input id="tr-note" class="compo-mot" type="text" maxlength="140"
      placeholder="Un petit mot (facultatif)" value="${h(trBrouillon.note)}">

    <div class="compo-pied">
      ${vCout()}
      <button class="btn" data-act="tr-send" ${pret && !ilManque ? '' : 'disabled'}>Envoyer la demande</button>
    </div>
    <p class="compo-regle">Carte contre carte, même rareté · Essences et Promos exclues ·
      Refusée ou annulée, ta demande t'est rendue.</p>
  </section>`;
}

/* Avec qui : ses amis d'un geste, un pseudo en recours. */
function vAvecQui() {
  if (trCible) {
    const col = trCols[noacc(trCible.pseudo)];
    return `<div class="compo-qui">
      ${avatarHTML(trCible.avatar, trCible.frame, 'sm', trCible.photo)}
      <b>${h(trCible.pseudo)}</b>
      ${col ? '<button class="linkbtn" data-act="tr-voir">Sa collection</button>' : ''}
      <button class="linkbtn" data-act="tr-changer">Changer</button>
    </div>
    ${col ? '' : '<p class="compo-note">Sa collection n\'est visible qu\'entre amis.</p>'}`;
  }

  const amis = (Backend.amis || []).filter(a => a.lien === 'ami');
  return `<span class="compo-lab">Avec</span>
    ${amis.length
      ? `<div class="amirow">${amis.map(a =>
          `<button class="amichip" data-troc="${h(a.pseudo)}">
            ${avatarHTML(a.avatar, a.frame, 'sm', a.photo)}<span>${h(a.pseudo)}</span></button>`).join('')}</div>`
      : '<p class="compo-note">Ajoute des amis dans l\'onglet Amis : entre amis, on voit la collection de l\'autre.</p>'}
    <div class="findrow">
      <input id="tr-pseudo" type="text" maxlength="16" placeholder="Ou un pseudo exact"
        value="${h(trBrouillon.pseudo)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny ghost" data-act="tr-find">Chercher</button>
    </div>`;
}

/* Ce que la demande va coûter, dit avant d'appuyer et non après le refus. */
function vCout() {
  if (tradeGratuit()) return `<p class="compo-cout ok">${NAVICO.check}Gratuite</p>`;
  if (tradeJetons()) {
    return `<p class="compo-cout"><img src="${ART.jeton}" alt="">1 jeton — il t'en reste ${tradeJetons()}</p>`;
  }
  return `<p class="compo-cout court">Prochaine gratuite dans ${dans(save.tradeFreeAt - Date.now())} ·
    <button class="linkbtn" data-tab="boutique">un jeton</button></p>`;
}

/* ---------- Choisir une carte ---------- */
/* Ce que je veux : dans SA collection quand on la connaît — demander une carte
   qu'il n'a pas ne mène nulle part —, ce qui me manque en tête.
   Ce que je donne : dans la mienne, mes doublons en tête — ce sont ceux que
   je cède sans me démunir.
   La première carte choisie, quel que soit le côté, fixe la rareté de l'autre. */
let trPickRar = 'all';

function ouvrirChoixCarte(role, rar) {
  const autre = byId[trBrouillon[role === 'veut' ? 'offre' : 'veut']];
  const pseudo = trCible ? trCible.pseudo : null;
  const connue = !!(pseudo && trCols[noacc(pseudo)]);
  if (rar) trPickRar = rar;
  const impose = autre ? autre.rar : null;

  let liste = cards.filter(echangeable);
  if (role === 'offre') liste = liste.filter(c => mesEx(c.id) > 0);
  else if (connue) liste = liste.filter(c => sesEx(pseudo, c.id) > 0);
  if (impose) liste = liste.filter(c => c.rar === impose);

  const rars = RAR_ORDRE.filter(r => liste.some(c => c.rar === r));
  if (!impose && trPickRar !== 'all' && !rars.includes(trPickRar)) trPickRar = 'all';
  const vue = impose || trPickRar === 'all' ? liste : liste.filter(c => c.rar === trPickRar);

  vue.sort((a, b) => {
    const d = role === 'offre'
      ? (mesEx(b.id) > 1) - (mesEx(a.id) > 1)
      : (!mesEx(b.id)) - (!mesEx(a.id));
    return d || RAR_ORDRE.indexOf(b.rar) - RAR_ORDRE.indexOf(a.rar) || a.num - b.num;
  });

  const sens = role === 'veut' ? 'entre' : 'sort';
  const chips = impose ? '' : `<div class="souschips">
    <button data-pickrar="all" data-role="${role}" class="${trPickRar === 'all' ? 'on' : ''}">Toutes</button>
    ${rars.map(r => `<button data-pickrar="${r}" data-role="${role}" class="rarchip r${r} ${trPickRar === r ? 'on' : ''}">
      <i class="rardot"></i>${(RAR[r] || RAR.C).nom}</button>`).join('')}</div>`;

  const dit = role === 'offre'
    ? 'Tes doublons d\'abord.'
    : connue ? `Dans la collection de ${h(pseudo)}.` : 'Sa collection n\'est pas visible : toutes les cartes sont proposées.';

  openSheet({
    title: role === 'offre' ? 'Ce que tu donnes' : 'Ce que tu veux',
    body: `<p class="muted small">${dit}${impose ? ` Rareté imposée : ${(RAR[impose] || RAR.C).nom}.` : ''}</p>
      ${chips}
      ${vue.length
        ? `<div class="pickgrid">${vue.map(c => `<button class="pick" data-cardpick="${c.id}" data-role="${role}" data-snd="carte">
            <span class="pickimg">${renderCard(c)}${etiquette(c, sens)}</span>
            <span class="picknom">${h(c.nom)}</span></button>`).join('')}</div>`
        : `<p class="muted">${role === 'offre'
            ? 'Tu n\'as aucune carte échangeable de cette rareté.'
            : 'Aucune carte à demander ici.'}</p>`}`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* Une carte choisie. Si l'autre côté n'a plus la même rareté, il se vide :
   c'était une paire qui ne pouvait plus partir. */
function trChoisir(role, id) {
  trBrouillon[role] = id;
  const autre = role === 'offre' ? 'veut' : 'offre';
  const a = byId[trBrouillon[autre]];
  if (a && a.rar !== byId[id].rar) trBrouillon[autre] = null;
  closeSheet();
  render();
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
    /* Même définition qu'en fiche : un doublon est une carte cessible. */
    doubles: sienne.filter(c => col[c.id] > 1 && echangeable(c)),
    tout: sienne
  };
  const liste = (listes[trColVue] || sienne).slice().sort(parRarete);

  const chips = TRCOL_VUES.map(([k, l]) =>
    `<button data-trcol="${k}" data-qui="${h(pseudo)}" class="${trColVue === k ? 'on' : ''}">${l}
      <i class="pickn">${listes[k].length}</i></button>`).join('');

  /* Ici l'étiquette dit combien LUI en a : c'est sa collection qu'on lit. Ce
     qui me manque se reconnaît au liseré. */
  const grille = liste.length
    ? `<div class="pickgrid">${liste.map(c => `<button class="pick${mesEx(c.id) ? '' : ' manque'}" data-show="${c.id}" data-qui="${h(pseudo)}" data-snd="carte">
        <span class="pickimg">${renderCard(c)}<i class="tpill">×${col[c.id]}</i></span>
        <span class="picknom">${h(c.nom)}</span></button>`).join('')}</div>`
    : `<p class="muted">${trColVue === 'manque'
        ? 'Il n\'a rien que tu n\'aies déjà.'
        : trColVue === 'doubles' ? 'Aucun doublon de son côté.' : 'Sa collection est vide.'}</p>`;

  openSheet({
    title: 'La collection de ' + pseudo,
    body: `<div class="souschips trcolvues">${chips}</div>${grille}`,
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

/* Changer de destinataire remet les cartes à zéro : ce qu'on pouvait lui
   demander dépendait de lui. */
function trChanger() {
  trCible = null;
  trBrouillon = { pseudo: '', offre: null, veut: null, note: trBrouillon.note };
  render();
}

/* Le mot tapé survit aux rendus : un rafraîchissement de fond ne doit pas
   effacer une phrase à moitié écrite. */
function trRetenirMot() {
  const el = $('#tr-note');
  if (el) trBrouillon.note = el.value;
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
