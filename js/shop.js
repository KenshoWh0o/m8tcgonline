/* Onglet Boutique. On y dépense les Éclats gagnés en quête — rien d'autre :
   aucun paiement, aucune monnaie réelle, nulle part dans le jeu.

   Deux rayons, et un étal plutôt qu'une liste : on voit l'objet avant son
   libellé. Un achat demande toujours deux gestes — on ouvre la fiche, on
   confirme — parce qu'un article à 5 000 Éclats ne doit jamais partir sur un
   doigt posé de travers.

   Et sur la fiche, on manipule ce qu'on achète : le paquet tourne sous le
   doigt, les lots se montrent en éventail, la carte Promo se regarde sous
   toutes ses faces. On n'achète pas une icône. */
"use strict";

/* Les deux rayons, dans l'ordre des sous-onglets. `categs` dit quelles
   catégories du serveur atterrissent dans chacun : la boutique côté serveur en
   compte quatre, mais « ce qui sert à jouer » et « ce qui décore » sont les
   deux seules distinctions qui comptent pour le joueur. */
const RAYONS = [
  { id: 'cartes', titre: 'Cartes', sous: 'De quoi ouvrir, échanger, et compléter.',
    sections: [
      /* Version 2.0 : la boutique de l'événement (payée en Prismes), tant
         qu'il dure — elle vit aussi dans son onglet. */
      { categ: 'evenement', titre: 'Événement Reflets', evenement: 'reflets' },
      { categ: 'boosters', titre: 'Boosters' },
      { categ: 'echange', titre: 'Jetons d\'échange' },
      { categ: 'invitation', titre: 'Invitations', invitations: true },
      { categ: 'promo', titre: 'Cartes Promo' }
    ] },
  { id: 'cosmetique', titre: 'Cosmétiques', sous: 'Purement décoratif : aucun effet sur le jeu.',
    sections: [
      { categ: 'cosmetique', titre: 'Cadres d\'avatar' },
      { titre: 'Avec les combats', avenir: true }
    ] }
];

let shopVue = 'cartes';

/* Version 2.0 : un article se paie en Éclats, en Fragments ou en Prismes. */
const DEVISES = {
  eclats:    { ico: () => shardIco, nom: () => MONNAIE.nom, solde: () => save.shards || 0 },
  fragments: { ico: () => `<span class="fragico">${NAVICO.fragment}</span>`, nom: () => FRAGMENTS.nom, solde: () => save.fragments || 0 },
  prismes:   { ico: () => prismeIco, nom: () => PRISMES.nom, solde: () => save.prismes || 0 }
};
const deviseDe = it => DEVISES[it.devise] || DEVISES.eclats;
/* Ce qui reste à acheter d'un article limité (`limite`, par joueur). */
const restantDe = it => it.limite == null ? null : Math.max(0, it.limite - ((save.inv || {})[it.id] || 0));

/* La carte vendue par un article, quand il en vend une. */
const carteDe = it => byId[it.carte_id] || byId[it.montant_id] || null;

/* ---------- Les vignettes du rayon ---------- */
/* Ce qu'on voit dans la case : l'objet, en grand. Un booster montre un booster,
   une carte montre la carte, un jeton montre le jeton — celui qui est frappé
   du M8, pas une flèche dessinée au trait. */
function vArticleArt(it) {
  const c = carteDe(it);
  if (c) return renderCard(c);
  if (FRAMES[it.id]) return avatarHTML(save.avatar, it.id, 'lg', maPhoto());
  if (TITRES[it.id]) return `<span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span>`;
  if (it.effet === 'invitation') return `<span class="ofinvit">M8-<b>••••</b></span>`;
  if (it.effet === 'reverse_R') return reverses.length ? renderCard(reverses.find(c => c.rar === 'R') || reverses[0]) : ICON.star;
  if (it.effet === 'fragments') return `<span class="offrag">${NAVICO.fragment}</span>`;
  if (it.effet === 'trade_token') return `<img class="ofjeton" src="${ART.jeton}" alt="">`;
  if (it.effet === 'tickets' || it.effet === 'refill') return `<img src="${PACK_ARTS[0]}" alt="">`;
  return ICON.star;
}

const vArticleQte = it =>
  (it.effet === 'tickets' || it.effet === 'trade_token') && it.montant > 1
    ? `<span class="ofqte">×${it.montant}</span>` : '';

/* ---------- Les remises ---------- */
/* Un lot n'est intéressant que par rapport à l'unité. On calcule donc la
   remise réelle plutôt que de coller un « éco » décoratif : « −14 % » se
   vérifie, « éco » se croit sur parole. */
function remiseDe(it, items) {
  if (!it.montant || it.montant < 2) return 0;
  const unite = items.find(x => x.effet === it.effet && x.montant === 1);
  if (!unite) return 0;
  const pct = Math.round((1 - (it.prix / it.montant) / unite.prix) * 100);
  return pct > 0 ? pct : 0;
}

function vBoutique() {
  if (Backend.mode !== 'cloud') return horsLigne('Boutique');

  const items = Backend.shop || [];
  const jetons = (save.inv || {}).trade_token || 0;

  const tete = `<div class="pagehead">
      <div>
        <h1>Boutique</h1>
        <p>En ${MONNAIE.nom}, gagnés en quêtes — les invitations en ${FRAGMENTS.nom}, l'événement en ${PRISMES.nom}.</p>
      </div>
    </div>
    <div class="walletrow">
      <span class="wallet">${shardIco}<b>${fmtN(save.shards)}</b> ${MONNAIE.nom}</span>
      ${jetons ? `<span class="wallet"><img class="wjeton" src="${ART.jeton}" alt=""><b>${jetons}</b> jeton${jetons > 1 ? 's' : ''}</span>` : ''}
      <span class="wallet"><span class="fragico">${NAVICO.fragment}</span><b>${fmtN(save.fragments || 0)}</b></span>
      ${evenementEnCours() ? `<span class="wallet">${prismeIco}<b>${fmtN(save.prismes || 0)}</b></span>` : ''}
    </div>`;

  if (!items.length) {
    return tete + vide('Rayons vides', 'Le catalogue n\'a pas encore été chargé sur le serveur.');
  }

  const onglets = RAYONS.map(r =>
    `<button data-shv="${r.id}" class="${shopVue === r.id ? 'on' : ''}">${h(r.titre)}</button>`).join('');

  return tete + `<div class="segbar">${onglets}</div>${vRayon(shopVue, items)}`;
}

/* Une section vide ne s'annonce pas : si le serveur ne vend aucun jeton, il n'y
   a pas de titre « Jetons d'échange » suivi de rien. */
function vRayon(id, items) {
  const r = RAYONS.find(x => x.id === id) || RAYONS[0];

  const blocs = r.sections.map(sec => {
    if (sec.evenement && evenementEnCours() !== sec.evenement) return '';
    const cases = sec.avenir
      ? vCosmetiquesAVenir()
      : items.filter(i => i.categ === sec.categ).map(it => vArticle(it, items)).join('');
    if (!cases) return '';
    return `<section class="rayon${sec.avenir ? ' avenir' : ''}${sec.evenement ? ' rayonev' : ''}">
      <h2>${h(sec.titre)}${sec.evenement ? ` <small class="muted">· ${prismeIco}${fmtN(save.prismes || 0)} ${PRISMES.nom}</small>` : ''}</h2>
      <div class="offres">${cases}</div>
      ${sec.invitations ? vMesInvitations() : ''}
    </section>`;
  }).join('');

  return `<p class="muted small rayondit">${h(r.sous)}</p>${blocs}`;
}

function vArticle(it, items) {
  const reste = restantDe(it);
  const possede = (it.unique_buy && (save.inv || {})[it.id] > 0) || reste === 0;
  const dv = deviseDe(it);
  const cher = dv.solde() < it.prix;
  const remise = remiseDe(it, items);

  return `<article class="offre${possede ? ' owned' : ''}${cher ? ' cher' : ''}"
      ${possede ? '' : `data-shop="${h(it.id)}" role="button" tabindex="0"`}>
    ${possede ? `<span class="ofcoche">${NAVICO.check}</span>` : ''}
    ${!possede && it.unique_buy ? '<span class="ofbadge unique">Unique</span>' : ''}
    ${!possede && !it.unique_buy && remise ? `<span class="ofbadge eco">−${remise} %</span>` : ''}
    ${!possede && reste != null ? `<span class="ofbadge limite">${reste} restant${reste > 1 ? 's' : ''}</span>` : ''}
    <span class="ofart">${vArticleArt(it)}${vArticleQte(it)}</span>
    <span class="ofnom">${h(it.titre)}</span>
    ${possede
      ? `<span class="qtag ok">${reste === 0 ? 'Épuisé' : 'Débloqué'}</span>`
      : `<span class="ofprix">${dv.ico()}${fmtN(it.prix)}</span>`}
  </article>`;
}

/* Le rayon cosmétique n'a encore que des cadres. Plutôt que de laisser croire
   qu'il n'y aura rien d'autre, on montre les cases à venir : elles disent ce
   que le mode Combat apportera, et pourquoi garder ses Éclats. */
const COSMETIQUES_A_VENIR = [
  ['Protège-cartes', 'Le dos de tes cartes, en combat'],
  ['Jetons de dégâts', 'Les marqueurs posés sur le terrain'],
  ['Tapis de jeu', 'Le plateau sur lequel tu joues'],
  ['Titres', 'Une mention sous ton pseudo']
];

/* Plus d'étiquette « Avec les combats » sur chaque case : c'est le titre de la
   section, juste au-dessus. Le répéter quatre fois ne renseignait personne. */
const vCosmetiquesAVenir = () => COSMETIQUES_A_VENIR.map(([nom, quoi]) =>
  `<article class="offre oflock">
    <span class="oflockico">${NAVICO.lock}</span>
    <span class="ofnom">${h(nom)}</span>
    <small>${h(quoi)}</small>
  </article>`).join('');

/* =====================================================================
   La fiche d'achat
   ===================================================================== */
/* Premier geste : on montre. Second geste : on prélève. Entre les deux, le
   joueur voit l'objet en grand — et peut le tourner. */
function ouvrirArticle(id) {
  const it = (Backend.shop || []).find(x => x.id === id);
  if (!it) return;

  const dv = deviseDe(it);
  const cher = dv.solde() < it.prix;
  const reste = dv.solde() - it.prix;
  const remise = remiseDe(it, Backend.shop || []);

  openSheet({
    title: it.titre,
    body: `<div class="achat">
      ${vAchatScene(it)}
      <p class="achatdit">${h(it.detail)}</p>
      <div class="achatprix">
        <span>Prix${remise ? ` <i class="achateco">−${remise} %</i>` : ''}</span>
        <b>${dv.ico()}${fmtN(it.prix)}</b>
      </div>
      <p class="achatreste${cher ? ' court' : ''}">${cher
        ? `Il te manque ${fmtN(it.prix - dv.solde())} ${dv.nom()}.`
        : `Il te restera ${fmtN(reste)} ${dv.nom()}.`}${restantDe(it) != null ? ` Encore ${restantDe(it)} sur ${it.limite}.` : ''}</p>
    </div>`,
    actions: [
      { label: cher ? `Pas assez de ${dv.nom()}` : 'Acheter', primary: true, disabled: cher,
        fn: () => { closeSheet(); acheter(it); } },
      { label: 'Retour', fn: closeSheet }
    ]
  });

  bindAchat3D();
}

/* La scène 3D de la fiche : ce qu'on tourne dépend de ce qu'on achète.
     · un lot de boosters → autant de paquets, en éventail
     · une carte Promo    → la carte, recto-verso
     · un jeton           → la pièce, qui roule sur elle-même
     · un cadre           → l'avatar, déjà bien assez rond pour qu'on le laisse
   Le nombre de pièces est plafonné : à dix paquets, on en dessine cinq et on
   écrit ×10. Un éventail de dix se chevauche jusqu'à ne plus rien montrer. */
function vAchatScene(it) {
  const c = carteDe(it);

  if (c) {
    return `<div class="a3d carte" id="a3d">
      <div class="a3d-obj" id="a3dobj">
        <div class="a3d-face">${renderCard(c)}</div>
        <div class="a3d-dos"><img src="${ART.back}" alt=""></div>
      </div>
      <p class="a3d-dit">${NAVICO.rotate} Fais glisser pour la retourner</p>
    </div>`;
  }

  if (FRAMES[it.id]) {
    return `<div class="a3d cadre"><div class="a3d-cadre">${avatarHTML(save.avatar, it.id, 'xl', maPhoto())}</div></div>`;
  }
  /* Version 2.0 : un titre se montre sous le pseudo, une invitation comme un billet. */
  if (TITRES[it.id]) {
    return `<div class="a3d cadre"><div class="a3d-titre"><b>${h(save.pseudo)}</b>
      <span class="qrtitre t${TITRES[it.id].ton}">${h(TITRES[it.id].nom)}</span></div></div>`;
  }
  if (it.effet === 'invitation') {
    return `<div class="a3d cadre"><div class="a3d-invit"><small>Invitation</small><b>M8-••••-••••</b>
      <span>${h(GAME_NAME)}</span></div></div>`;
  }
  if (it.effet === 'fragments' || it.effet === 'reverse_R') {
    return `<div class="a3d cadre"><div class="a3d-cadre">${vArticleArt(it)}</div></div>`;
  }

  if (it.effet === 'trade_token') {
    const n = Math.min(it.montant || 1, 3);
    return `<div class="a3d jeton" id="a3d">
      <div class="a3d-obj" id="a3dobj">
        ${Array.from({ length: n }, (_, i) =>
          `<img class="a3d-piece p${i}" src="${ART.jeton}" alt="">`).join('')}
      </div>
      ${it.montant > 1 ? `<span class="a3d-qte">×${it.montant}</span>` : ''}
      <p class="a3d-dit">${NAVICO.rotate} Fais glisser pour l'incliner</p>
    </div>`;
  }

  /* Boosters. */
  const n = Math.min(it.montant || 1, 5);
  return `<div class="a3d paquets n${n}" id="a3d">
    <div class="a3d-obj" id="a3dobj">
      ${Array.from({ length: n }, (_, i) =>
        `<img class="a3d-pack p${i}" src="${PACK_ARTS[i % PACK_ARTS.length]}" alt=""
          style="--i:${i - (n - 1) / 2}">`).join('')}
    </div>
    ${it.montant > 1 ? `<span class="a3d-qte">×${it.montant}</span>` : ''}
    <p class="a3d-dit">${NAVICO.rotate} Fais glisser pour l'incliner</p>
  </div>`;
}

/* Le glisser-tourner de la fiche. Même principe que le paquet de l'écran
   Boosters : on suit le doigt, et au repos l'objet respire tout seul. */
function bindAchat3D() {
  const box = $('#a3d');
  const obj = $('#a3dobj');
  if (!box || !obj) return;

  const T = { rx: 0, ry: 0, mrx: 0, mry: 0, manual: false, grx: 0, gry: 0 };
  const vivant = () => document.body.contains(obj);
  let pid = null, x0 = 0, y0 = 0;

  /* Une carte se retourne — donc une amplitude qui va jusqu'au dos. Un paquet
     s'incline, il ne se retourne pas : on le retient à 34°. */
  const carte = box.classList.contains('carte');
  const max = carte ? 200 : 34;

  box.addEventListener('pointerdown', e => {
    if (pid != null) return;
    pid = e.pointerId;
    x0 = e.clientX - T.mry / (carte ? 1.1 : .55);
    y0 = e.clientY + T.mrx / .5;
    T.manual = true;
    box.setPointerCapture(e.pointerId);
  });

  box.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    T.mry = Math.max(-max, Math.min(max, (e.clientX - x0) * (carte ? 1.1 : .55)));
    T.mrx = Math.max(-26, Math.min(26, -(e.clientY - y0) * .5));
  });

  const fin = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    /* Une carte relâchée se range sur la face la plus proche : recto ou verso,
       jamais de travers. */
    if (carte) T.mry = Math.abs(T.mry) > 90 ? 180 * Math.sign(T.mry) : 0;
    else T.manual = false;
  };
  box.addEventListener('pointerup', fin);
  box.addEventListener('pointercancel', fin);
  box.addEventListener('dragstart', e => e.preventDefault());

  const debrancher = brancherGyro((rx, ry) => {
    if (!vivant()) return debrancher();
    T.grx = rx;
    T.gry = ry;
  }, .5);

  const frame = now => {
    if (!vivant()) return debrancher();
    const cibleY = T.manual ? T.mry : T.gry + (RM() ? 0 : Math.sin(now / 2200) * 8);
    const cibleX = T.manual ? T.mrx : T.grx + (RM() ? 0 : Math.sin(now / 2900) * 4);
    T.ry += (cibleY - T.ry) * .12;
    T.rx += (cibleX - T.rx) * .12;
    obj.style.transform = `rotateX(${T.rx.toFixed(2)}deg) rotateY(${T.ry.toFixed(2)}deg)`;
    box.style.setProperty('--fx', (50 + T.ry * 1.4).toFixed(1) + '%');
    /* Quelle face regarde-t-on ? On ramène l'angle dans [0, 360[ : entre 90° et
       270°, la carte nous tourne le dos. En dehors, c'est le recto.
       (Comme sur la scène des Promos, on ne compte pas sur
       `backface-visibility` : il ne tient pas à travers la carte imbriquée.) */
    if (carte) {
      const a = ((T.ry % 360) + 360) % 360;
      box.classList.toggle('dos', a > 90 && a < 270);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* Le serveur revérifie tout — le prix, le solde, l'unicité. Ce qui se passe ici
   n'est que la mise en scène du résultat. */
async function acheter(it) {
  const ok = await agir(() => Backend.buy(it.id));
  if (!ok) return;
  /* Une carte s'annonce toute seule, par son animation d'obtention (js/promos.js) :
     un message en bas de l'écran par-dessus serait redondant. */
  if (it.effet === 'carte') return;
  /* Des boosters : ils s'ouvrent tout de suite, à part de la réserve — sa
     recharge continue (open_pack, supabase/03_rpc.sql). Quitter la série en
     route les garde : « Ouvrir un booster en plus », écran Boosters. */
  if (it.effet === 'tickets') {
    SFX.jouer('gagne');
    aller('boosters');
    return setTimeout(() => openBooster({ bonus: true }), 350);
  }
  /* Une invitation : son code, tout de suite, prêt à envoyer. */
  if (it.effet === 'invitation') {
    const inv = (save.invitations || []).slice(-1)[0];
    SFX.jouer('gagne');
    if (inv) montrerInvitation(inv.code);
    return;
  }
  if (it.evenement && typeof chargerReflets === 'function') chargerReflets();
  toast(it.unique_buy ? `${it.titre} débloqué.` : `${it.titre} : c'est dans ta réserve.`);
  SFX.jouer('gagne');
}

/* ---------- Les invitations (version 2.0) ---------- */
/* Un code par invitation, valable une fois. L'ami se connecte avec Discord,
   saisit le code sur l'écran d'attente (js/gate.js), et entre — avec un cadeau
   de bienvenue (supabase/21_reflets.sql). Le lien remplit le code tout seul. */
const lienInvitation = code => `${String(SITE_URL || location.origin).replace(/\/$/, '')}/?invitation=${encodeURIComponent(code)}`;

function vMesInvitations() {
  const l = save.invitations || [];
  if (!l.length) return '';
  return `<div class="mesinvit">
    <h3>Mes invitations</h3>
    ${l.map(i => `<div class="invligne${i.utilise_par ? ' utilisee' : ''}">
      <code>${h(i.code)}</code>
      ${i.utilise_par ? `<span class="muted small">Utilisée par <b>${h(i.utilise_par)}</b></span>`
        : `<button class="btn tiny ghost" data-invit="${h(i.code)}">${NAVICO.partage}Envoyer</button>`}
    </div>`).join('')}
  </div>`;
}

function montrerInvitation(code) {
  openSheet({
    title: 'Ton invitation',
    body: `<div class="invfiche">
        <small>Le code</small><code class="invcode">${h(code)}</code>
        <p class="muted small">Envoie-le à un ami : il se connecte avec Discord, et le saisit sur l'écran d'accueil.
          Le lien ci-dessous le remplit pour lui. Un code ne sert qu'une fois.</p>
        <p class="invlien">${h(lienInvitation(code))}</p>
      </div>`,
    actions: [
      { label: 'Envoyer', primary: true, fn: () => partagerInvitation(code) },
      { label: 'Fermer', fn: () => { closeSheet(); render(); } }
    ]
  });
}

function partagerInvitation(code) {
  const texte = `Je t'invite sur ${GAME_NAME} ! Connecte-toi avec Discord, et utilise le code ${code} :`;
  const url = lienInvitation(code);
  if (navigator.share) navigator.share({ text: texte, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(`${texte} ${url}`).then(() => toast('Invitation copiée.')).catch(() => toast(url));
  else toast(url);
}
