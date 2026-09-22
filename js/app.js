/* Point d'entrée : navigation, en-tête, clics, démarrage. Chargé en dernier.
   Les onglets sont décrits dans TABS (js/config.js) : ceux marqués `bas`
   tiennent dans la barre du bas sur mobile et dans le rail latéral sur
   ordinateur, les autres sont rangés dans la page « Plus ». */
"use strict";

/* ---------- Quel onglet montrer ---------- */
function ongletDispo(t) {
  if (t.admin) return !!save && !!save.isAdmin;
  return true;
}

function ongletValide(id) {
  const t = TABS.find(x => x.id === id);
  return t && ongletDispo(t) ? id : 'boosters';
}

/* ---------- En-tête ---------- */
/* Les deux compteurs et l'avatar restent visibles en permanence, même hors ligne :
   ce sont les seules portes vers la boutique et vers le menu du compte. Les cacher
   revenait à cacher qu'ils existent. */
function header() {
  const tk = $('#tk');
  if (tk) tk.textContent = save.unlimited ? '∞' : String(save.tickets);

  const ec = $('#ec');
  if (ec) ec.querySelector('b').textContent = fmtN(save.shards);

  /* Sur mobile, l'avatar ouvre le tiroir du compte — mais rien ne le disait :
     une photo ronde ressemble à une décoration, pas à un bouton. Le chevron
     posé dessus est le signe universel du panneau qui se déplie. Sur ordinateur
     il n'y a pas de tiroir, donc pas de chevron (voir css/hub.css). */
  const av = $('#moi');
  if (av) {
    av.innerHTML = avatarHTML(save.avatar, save.frame, 'sm', maPhoto())
      + '<i class="moicaret" aria-hidden="true">' + NAVICO.caret + '</i>';
    av.classList.toggle('alerte', pastilleTiroir() > 0);
    av.setAttribute('aria-label', surOrdi() ? 'Mon profil' : 'Menu du compte');
    av.setAttribute('aria-expanded', String(tiroirOuvert));
  }
}

/* ---------- Barre du bas et rail ---------- */
/* Un seul balisage pour les deux tailles d'écran. Sur mobile, seuls les cinq
   onglets principaux sont affichés et le reste vit dans le tiroir ; sur
   ordinateur le rail a la place de tout montrer, et le second groupe apparaît
   sous un filet — inutile de cacher derrière un menu ce qui tient à l'écran. */
const surOrdi = () => matchMedia('(min-width:900px)').matches;

function navHTML() {
  const bouton = (t, groupe) => {
    const n = pastilleOnglet(t.id);
    const cls = [groupe, tab === t.id ? 'on' : ''].filter(Boolean).join(' ');
    return `<button data-tab="${t.id}" class="${cls}" aria-label="${h(t.nom)}"
      ${tab === t.id ? 'aria-current="page"' : ''}><i class="navbg" aria-hidden="true"></i>
      ${NAVICO[t.ico]}<span>${h(t.nom)}</span>${n ? `<i class="pastille nav">${n}</i>` : ''}</button>`;
  };
  return TABS.filter(t => t.bas).map(t => bouton(t, '')).join('')
    + '<i class="navsep" aria-hidden="true"></i>'
    + TABS.filter(t => t.tiroir && ongletDispo(t)).map(t => bouton(t, 'second')).join('');
}

/* Ce qui réclame l'attention, onglet par onglet. */
function pastilleOnglet(id) {
  if (Backend.mode !== 'cloud') return 0;
  if (id === 'quetes') return questesPretes();
  if (id === 'social') return socNotifs();
  return 0;
}

/* Sur l'avatar : ce qui attend derrière le tiroir, pour qu'on pense à l'ouvrir. */
function pastilleTiroir() {
  return TABS.filter(t => t.tiroir).reduce((n, t) => n + pastilleOnglet(t.id), 0);
}

/* ---------- Tiroir du compte ---------- */
/* Il sort du bord où se trouve l'avatar sur lequel on vient d'appuyer : le
   mouvement dit d'où vient le panneau, et où il retournera. */
let tiroirOuvert = false;

function vTiroir() {
  const items = TABS.filter(t => t.tiroir && ongletDispo(t));
  const enLigne = Backend.mode === 'cloud';
  const jetons = (save.inv || {}).trade_token || 0;

  const sousTitre = enLigne
    ? (save.isAdmin ? 'Administrateur'
       : save.streak > 1 ? save.streak + " jours d'affilée" : 'Compte en ligne')
    : 'Hors ligne, sur cet appareil';

  return `<div class="tiroir-bg" data-tiroir="fermer"></div>
  <nav class="tiroir-panneau" aria-label="Menu du compte">
    <header class="tiroir-id">
      ${avatarHTML(save.avatar, save.frame, 'xl', maPhoto())}
      <div><b>${h(save.pseudo)}</b><p class="muted small">${h(sousTitre)}</p></div>
      <button class="tiroir-x" data-tiroir="fermer" aria-label="Fermer">✕</button>
    </header>

    <div class="tiroir-sacs">
      <span class="sac"><img src="${ART.seal}" alt=""><b>${save.unlimited ? '∞' : save.tickets}</b>
        <small>booster${save.tickets > 1 ? 's' : ''}</small></span>
      <span class="sac">${shardIco}<b>${fmtN(save.shards)}</b><small>${MONNAIE.nom}</small></span>
      ${jetons ? `<span class="sac"><img src="${ART.jeton}" alt=""><b>${jetons}</b><small>jeton${jetons > 1 ? 's' : ''}</small></span>` : ''}
    </div>

    <ul class="tiroir-liste">
      ${items.map(t => {
        const n = pastilleOnglet(t.id);
        return `<li><button data-tab="${t.id}" class="${tab === t.id ? 'on' : ''}">
          <span class="tiroir-ico">${NAVICO[t.ico]}</span>
          <span class="tiroir-txt"><b>${h(t.nom)}${n ? `<i class="pastille">${n}</i>` : ''}</b>
            <small class="muted">${h(t.desc || '')}</small></span>
        </button></li>`;
      }).join('')}
    </ul>

    <footer class="tiroir-pied">
      ${enLigne
        ? '<button class="btn ghost" data-act="deconnexion">Se déconnecter</button>'
        : Backend.dispo
          ? `<p class="muted small">Un compte garde ta collection et ouvre les échanges,
               les quêtes et la boutique.</p>
             <button class="btn" data-act="connexion">${CONNEXION.email
               ? 'Créer un compte' : 'Se connecter avec Discord'}</button>`
          : `<p class="muted small">Le serveur n'est pas encore branché sur ce site :
               ta progression reste dans ce navigateur.</p>`}
      <p class="tiroir-ver muted small">${h(GAME_NAME)} · version ${APP_VERSION}</p>
    </footer>
  </nav>`;
}

function ouvrirTiroir() {
  const t = $('#tiroir');
  t.innerHTML = vTiroir();
  t.hidden = false;
  /* Une image d'attente avant d'animer, sinon la transition est avalée. */
  requestAnimationFrame(() => t.classList.add('on'));
  tiroirOuvert = true;
  SFX.jouer('ouvre');
}

function fermerTiroir() {
  if (!tiroirOuvert) return;
  const t = $('#tiroir');
  t.classList.remove('on');
  tiroirOuvert = false;
  SFX.jouer('retour');
  setTimeout(() => { if (!tiroirOuvert) { t.hidden = true; t.innerHTML = ''; } }, 260);
}

/* Sur ordinateur, tout est déjà dans le rail : l'avatar mène droit au profil. */
const basculerTiroir = () =>
  surOrdi() ? aller('profil') : (tiroirOuvert ? fermerTiroir() : ouvrirTiroir());

/* En passant en grand écran, le tiroir n'a plus lieu d'être ouvert. */
addEventListener('resize', () => { if (surOrdi()) fermerTiroir(); });

/* ---------- Rendu ---------- */
const VUES = {
  boosters: () => vBoosters(),
  collection: () => vCollection(),
  social: () => vSocial(),
  boutique: () => vBoutique(),
  quetes: () => vQuetes(),
  combats: () => vCombats(),
  profil: () => vProfil(),
  reglages: () => vReglages(),
  labo: () => vTest()
};

function render() {
  /* L'écran d'attente passe avant tout le reste : tant qu'il est là, le jeu
     n'existe pas pour le visiteur. */
  if (!porteOuverte()) {
    document.body.className = 'inlock';
    $('#main').innerHTML = vPorte();
    bindPorte();
    return;
  }

  /* La porte de connexion remplace tout : ni en-tête ni barre du bas. */
  const porte = porteVisible();
  document.body.classList.toggle('inauth', porte);
  if (porte) {
    $('#main').innerHTML = vAuth();
    return;
  }

  header();
  $('#nav').innerHTML = navHTML();
  majBoutonInstall();

  tab = ongletValide(tab);
  const vue = VUES[tab] || VUES.boosters;
  const m = $('#main');
  m.className = 'tab-' + tab;
  m.innerHTML = vue();

  if (tab === 'boosters') bindPack();
  bindReglages();
  /* Le tiroir montre les compteurs et les pastilles : il suit chaque rendu. */
  if (tiroirOuvert) $('#tiroir').innerHTML = vTiroir();

  /* Une carte Promo décrochée pendant l'appel serveur attend ici : l'écran est
     posé, c'est le moment de lui laisser la scène. */
  viderFilePromos();
}

/* Va sur un onglet, en remontant en haut de page. */
function aller(id) {
  fermerTiroir();
  const avant = tab;
  tab = ongletValide(id);
  if (avant !== tab) SFX.jouer('onglet');
  $('#main').scrollTop = 0;
  render();
  /* Les pages qui vivent sur le serveur se rafraîchissent en arrivant. */
  if (Backend.mode === 'cloud') {
    if (tab === 'social') {
      Promise.all([Backend.loadTrades(), Backend.loadAmis()]).then(render).catch(() => {});
    }
    if (tab === 'boutique' && !Backend.shop.length) Backend.loadShop().then(render).catch(() => {});
  }
}

/* ---------- Navigation ---------- */
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) aller(b.dataset.tab);
});

/* ---------- Clics dans la page ---------- */
/* La feuille modale vit à côté de #main, pas dedans : sans ce second branchement,
   choisir une carte dans le sélecteur ne déclencherait rien. */
async function clicPage(e) {
  const el = e.target.closest('[data-act],[data-show],[data-filter],[data-ess],[data-rar],[data-tab],[data-auth],[data-tr],[data-soc],[data-qv],[data-shv],[data-shop],[data-theme],[data-quete],[data-trep],[data-trann],[data-pick],[data-cardpick],[data-ava],[data-avacard],[data-frame],[data-fiche],[data-ami-ok],[data-ami-non],[data-troc],[data-colde],[data-trcol],[data-vit-on],[data-vit-off],[data-promo]');
  if (!el) return;
  const d = el.dataset;

  if (d.tab) return aller(d.tab);
  if (d.auth) return authFaire(d.auth);
  /* `data-qui` accompagne les cartes ouvertes depuis un écran d'échange : la
     visionneuse montre alors aussi combien l'autre en possède. */
  if (d.show) { const c = byId[d.show]; if (c) { SFX.jouer('carte'); openViewer(c, d.qui || null); } return; }
  if (d.filter) { colFilter = d.filter; return render(); }
  if (d.ess) { essFilter = d.ess; return render(); }
  if (d.rar) { rarFilter = d.rar; return render(); }
  if (d.tr) { trVue = d.tr; return render(); }
  if (d.soc) { socVue = d.soc; return render(); }
  if (d.qv) { qVue = d.qv; return render(); }
  if (d.shv) { shopVue = d.shv; return render(); }
  if (d.shop) return ouvrirArticle(d.shop);
  if (d.theme) { poserTheme(d.theme); return render(); }
  if (d.promo) return testPromo(d.promo);

  /* Amis */
  if (d.fiche) return ouvrirFiche(d.fiche);
  if (d.amiOk) return agir(() => Backend.amiRepondre(d.amiOk, true), 'Vous êtes amis.');
  if (d.amiNon) return agir(() => Backend.amiRepondre(d.amiNon, false).catch(
    () => Backend.amiRetirer(d.amiNon)), 'C\'est fait.');
  if (d.troc) return versEchange(d.troc);
  if (d.colde) return ouvrirCollectionDe(d.colde, () => ouvrirFiche(d.colde));
  if (d.trcol) { trColVue = d.trcol; return montrerCollectionDe(d.qui); }
  if (d.vitOn) { closeSheet(); return vitrineAjouter(d.vitOn); }
  if (d.vitOff) return vitrineRetirer(d.vitOff);

  /* Quêtes, boutique, échanges */
  if (d.quete) return agir(() => Backend.claimQuest(d.quete), 'Récompense encaissée.');
  if (d.trep) return agir(() => Backend.tradeRespond(d.trep, d.ok === '1'),
    d.ok === '1' ? 'Échange conclu.' : 'Demande refusée.');
  if (d.trann) return agir(() => Backend.tradeCancel(d.trann), 'Demande annulée.');
  if (d.pick) return ouvrirChoixCarte(d.pick);
  if (d.cardpick) {
    trBrouillon[d.role] = d.cardpick;
    /* Changer la carte donnée peut invalider la rareté demandée. */
    if (d.role === 'offre' && trBrouillon.veut) {
      const v = byId[trBrouillon.veut];
      if (!v || v.rar !== byId[d.cardpick].rar) trBrouillon.veut = null;
    }
    closeSheet();
    return render();
  }

  /* Profil */
  if (d.ava) return agir(() => Backend.setProfile({ p_avatar: d.ava }));
  if (d.avacard) { closeSheet(); return agir(() => Backend.setProfile({ p_avatar: 'card:' + d.avacard })); }
  if (d.frame) return agir(() => Backend.setProfile({ p_frame: d.frame }));

  switch (d.act) {
    case 'open': return openBooster();
    case 'connexion': return ouvrirConnexion();
    case 'son-test': return testerSon();
    case 'col-toggle': colOuvert = !colOuvert; return render();
    case 'col-reset':
      colFilter = essFilter = rarFilter = 'all';
      colPossedees = false;
      return render();
    case 'porte-ok': return porteEssayer();
    case 'installer': return ouvrirInstall(true);
    case 'pf-pseudo': return changerPseudo();
    case 'pf-carte': return ouvrirChoixAvatar();
    case 'vit-add': return ouvrirChoixVitrine();
    case 'soc-add': return socAjouter();
    case 'tr-find': return trChercher();
    case 'tr-send': return trEnvoyer();
    case 'tr-changer': return trChanger();
    case 'tr-voir': return trCible ? ouvrirCollectionDe(trCible.pseudo) : null;

    case 'deconnexion':
      return openSheet({
        title: 'Se déconnecter ?',
        body: '<p class="muted">Ta collection reste sur ton compte : tu la retrouveras en revenant.</p>',
        actions: [
          { label: 'Se déconnecter', primary: true, fn: async () => {
            closeSheet(); noterHorsLigne(false); await Backend.signOut(); location.reload();
          }},
          { label: 'Annuler', fn: closeSheet }
        ]
      });

    /* --- Labo (administrateurs) --- */
    case 't-open': return openBooster({ test: true });
    case 't-R': case 't-E': case 't-L':
      return openBooster({ test: true, force: d.act.slice(2), god: false });
    case 't-god': return openBooster({ test: true, god: true });
    case 't-all':
      cards.forEach(c => save.col[c.id] = Math.max(2, save.col[c.id] || 0));
      persist(); toast('Toutes les cartes sont débloquées (affichage seulement).');
      return render();
    case 't-clear':
      return openSheet({
        title: 'Vider ta collection ?',
        body: '<p class="muted">Les cartes du jeu restent, mais tu ne possèdes plus aucun exemplaire.</p>',
        actions: [
          { label: 'Vider', primary: true, fn: () => { save.col = {}; persist(); closeSheet(); render(); toast('Collection vidée.'); } },
          { label: 'Annuler', fn: closeSheet }
        ]
      });
    case 't-10': save.tickets += 10; persist(); header(); return toast('+10 boosters (affichage seulement).');
    case 't-90': return testRemplir(90);
    case 't-promo-file': return testFilePromos();
    case 't-quete': return testQuete();
    case 't-toast': return toast('Voilà à quoi ça ressemble.');

    /* --- Ouverture --- */
    case 'again': rv = null; render(); return setTimeout(openBooster, 60);
    case 'back': rv = null; return render();
    case 'skip': rv.idx = rv.cards.length; return render();

    case 'reset':
      return openSheet({
        title: 'Tout réinitialiser ?',
        body: '<p class="muted">Ta collection et tes boosters reviennent au départ.</p>',
        actions: [
          { label: 'Réinitialiser', primary: true, fn: () => {
            save = defaultSave(); save.pseudo = 'Invité'; save.avatar = 'star';
            save.frame = 'default'; save.shards = 0; save.inv = {}; save.quetes = [];
            rv = null; persist(); closeSheet(); render();
          }},
          { label: 'Annuler', fn: closeSheet }
        ]
      });
  }
}

$('#main').addEventListener('click', clicPage);
$('#sheet').addEventListener('click', clicPage);

/* ---------- En-tête cliquable ---------- */
$('.top').addEventListener('click', e => {
  if (e.target.closest('#brand')) return aller('boosters');
  if (e.target.closest('#moi')) return basculerTiroir();
  if (e.target.closest('#btn-install')) return ouvrirInstall(true);
  if (e.target.closest('#ec')) return aller('boutique');
  if (e.target.closest('.pill')) return aller('boosters');
});

/* ---------- Tiroir ---------- */
$('#tiroir').addEventListener('click', e => {
  if (e.target.closest('[data-tiroir="fermer"]')) return fermerTiroir();
  clicPage(e);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && tiroirOuvert) fermerTiroir();
});

/* ---------- Boucle de la réserve ---------- */
/* Hors ligne, les boosters se rechargent ici. En ligne, seul le serveur les
   accorde : on ne fait qu'anticiper l'affichage, et on redemande la vérité
   au serveur dès que le compte à rebours devrait avoir abouti. */
let attenteServeur = false;
setInterval(() => {
  if (!save || porteVisible()) return;

  if (Backend.mode === 'cloud') {
    if (save.tickets < TICKET_CAP && Date.now() - save.lastTick >= INTERVAL && !attenteServeur) {
      attenteServeur = true;
      Backend.pull().then(() => { attenteServeur = false; header(); if (tab === 'boosters' && !rv) render(); })
                    .catch(() => { attenteServeur = false; });
    }
  } else {
    const avant = save.tickets;
    regen();
    if (save.tickets !== avant) {
      header();
      if (tab === 'boosters' && !rv) render();
      return;
    }
  }

  /* Le compte à rebours des quêtes bat sans redessiner la page. */
  if (tab === 'quetes') majRemiseQuetes();

  const cl = $('#tmclock');
  if (!cl) return;
  cl.textContent = timerClock();
  const jeton = document.querySelector('.resjeton.encours');
  if (jeton) jeton.style.setProperty('--p', tickPct() + '%');
}, 1000);

/* Revenir sur l'onglet après un moment : on resynchronise. */
addEventListener('visibilitychange', () => {
  if (document.hidden || Backend.mode !== 'cloud') return;
  Backend.pull().then(() => { header(); render(); }).catch(() => {});
  releverSocial();
});

/* ---------- Ce qui arrive des autres joueurs ---------- */
/* Une demande d'échange ou d'ami n'est déclenchée par rien de ce qu'on fait :
   sans relève régulière, la pastille n'apparaîtrait qu'en ouvrant l'onglet
   Social — c'est-à-dire trop tard pour prévenir. Une minute suffit : ce n'est
   pas une conversation, personne n'attend à la seconde près. */
const RELEVE_SOCIAL = 60000;

function releverSocial() {
  if (Backend.mode !== 'cloud' || document.hidden) return;
  /* Jamais pendant une ouverture ni une scène de promo : l'écran appartient
     aux cartes, et un rendu par-dessus la couperait. */
  if (rv || opening || promoEnCours) return;

  Promise.all([Backend.loadTrades(), Backend.loadAmis()]).then(() => {
    header();
    $('#nav').innerHTML = navHTML();
    if (tiroirOuvert) $('#tiroir').innerHTML = vTiroir();
    /* On ne redessine la page que si elle montre ces données — et jamais
       pendant qu'une demande est en cours de composition : le champ de saisie
       perdrait le curseur et le texte déjà tapé. */
    if (tab === 'social' && !(socVue === 'echanges' && trVue === 'nouvelle')) render();
  }).catch(() => {});
}

setInterval(releverSocial, RELEVE_SOCIAL);

/* ---------- Démarrage ---------- */
(async () => {
  cards = buildCards();
  promos = buildPromos();
  rebuild();
  brand();
  rollPack();
  poserTheme(reglageTheme());
  poserRM(reglageRM());

  /* Le service worker se branche toujours : c'est lui qui apporte les mises à
     jour. Le laisser de côté pendant que la porte est fermée gèlerait le site
     sur la version qu'un visiteur a déjà en cache. */
  brancherSW();

  /* Porte fermée : on s'arrête là, sans contacter le serveur du jeu. */
  if (!porteOuverte()) return render();

  await Backend.init();

  if (Backend.mode === 'cloud') {
    try {
      await Backend.checkin();
      Backend.loadShop().catch(() => {});
      Promise.all([Backend.loadTrades(), Backend.loadAmis()])
        .then(() => { if (tab === 'social') render(); }).catch(() => {});
    } catch (e) {
      toast(e.message || 'Le serveur a répondu de travers.');
    }
  } else {
    regen();
  }

  render();

  if (Backend.mode === 'local' && !(await dbp)) {
    toast("La sauvegarde n'est pas disponible sur ce navigateur : ta progression sera perdue en quittant.");
  }
})();
