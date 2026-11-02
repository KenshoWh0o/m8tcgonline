/* Point d'entrée : navigation, en-tête, clics, démarrage. Chargé en dernier.
   Les onglets sont décrits dans TABS (js/config.js) : ceux marqués `bas`
   tiennent dans la barre du bas sur mobile et dans le rail latéral sur
   ordinateur, les autres sont rangés dans la page « Plus ». */
"use strict";

/* ---------- Quel onglet montrer ---------- */
function ongletDispo(t) {
  if (t.admin) return !!save && !!save.isAdmin;
  /* L'onglet d'un événement n'existe que pendant qu'il dure — et trois
     jours après, le temps de son récap. */
  if (t.evenement) return evenementEnCours() === t.evenement || !!(typeof recapReflets === 'function' && recapReflets());
  /* Ce qui vit dans l'onglet de l'événement pendant qu'il dure. */
  if (t.horsEvenement) return evenementEnCours() !== t.horsEvenement;
  return true;
}

/* Le code de l'événement en cours (supabase/15_evenements.sql), s'il en a un
   et qu'il a commencé. */
const evenementEnCours = () => {
  const ev = save && save.evenement;
  return ev && !ev.a_venir && ev.code ? ev.code : null;
};

/* La barre du bas : pendant l'événement Reflets, son onglet prend la place de
   Combats — qui n'est encore qu'un aperçu de la version 3.0 et passe dans le
   tiroir. */
function ongletsBas() {
  const ev = TABS.find(t => t.evenement && ongletDispo(t));
  return TABS.filter(t => t.bas).map(t => (t.id === 'combats' && ev ? ev : t));
}
const combatsAuTiroir = () => !ongletsBas().some(t => t.id === 'combats');

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

  /* La cloche de la boite de réception (js/boite.js). */
  majSignalBoite();
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
  /* Le pied n'existe que sur le rail d'ordinateur : sur mobile, ces destinations
     et cette mention vivent dans le tiroir du compte. */
  return ongletsBas().map(t => bouton(t, t.evenement ? 'evnav' : '')).join('')
    + '<i class="navsep" aria-hidden="true"></i>'
    + ongletsTiroir().map(t => bouton(t, 'second')).join('')
    + `<div class="navpied">${lienDiscord('discordlien', 'Rejoindre le Discord')}
         <p class="mentions courtes">${MENTIONS_COURT}</p></div>`;
}

/* Ce qui réclame l'attention, onglet par onglet. */
function pastilleOnglet(id) {
  if (Backend.mode !== 'cloud') return 0;
  if (id === 'quetes') return questesPretes();
  /* L'événement : ses quêtes à encaisser et les paliers de piste atteints. */
  if (id === 'reflets') return evQuetesPretes();
  if (id === 'illu') return illuData && !illuData.fini ? 1 : 0;
  if (id === 'social') return socNotifs();
  /* L'Échauffement (js/echauffement.js) : les défis ouverts pas encore gagnés. */
  if (id === 'combats') return echPastille();
  return 0;
}

/* Sur l'avatar : ce qui attend derrière le tiroir, pour qu'on pense à l'ouvrir. */
function pastilleTiroir() {
  return TABS.filter(t => t.tiroir).reduce((n, t) => n + pastilleOnglet(t.id), 0)
    + (combatsAuTiroir() ? pastilleOnglet('combats') : 0);
}

/* ---------- Tiroir du compte ---------- */
/* Il sort du bord où se trouve l'avatar sur lequel on vient d'appuyer : le
   mouvement dit d'où vient le panneau, et où il retournera. */
let tiroirOuvert = false;

/* Les entrées du tiroir, Combats compris quand l'événement lui a pris sa
   place : il se range alors sous Recyclage, pas en tête de liste. */
function ongletsTiroir() {
  const l = TABS.filter(t => t.tiroir && ongletDispo(t));
  const c = TABS.find(t => t.id === 'combats');
  if (c && combatsAuTiroir() && ongletDispo(c)) {
    const i = l.findIndex(t => t.id === 'recyclage');
    l.splice(i < 0 ? l.length : i + 1, 0, c);
  }
  return l;
}

function vTiroir() {
  const items = ongletsTiroir();
  const enLigne = Backend.mode === 'cloud';
  const jetons = (save.inv || {}).trade_token || 0;

  const sousTitre = enLigne
    ? (save.titre && TITRES[save.titre] ? TITRES[save.titre].nom
       : save.isAdmin ? 'Administrateur'
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
      ${evenementEnCours() ? `<span class="sac prismes">${evIco()}<b>${fmtN(save.prismes || 0)}</b><small>${PRISMES.nom}</small></span>` : ''}
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
      ${lienDiscord('discordlien', 'Rejoindre le Discord')}
      <p class="tiroir-ver muted small">${h(GAME_NAME)} · version ${h(versionJeu())}</p>
      <p class="mentions courtes">${MENTIONS_COURT}</p>
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
  illu: () => vIlluPage(),
  reflets: () => vReflets(),
  recyclage: () => vRecyclage(),
  classement: () => vClassement(),
  tirages: () => vTirages(),
  boite: () => vBoite(),
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

  /* On sort de l'écran d'attente : il faut lui reprendre sa classe.
     `body.inlock` masque l'en-tête ET la barre du bas, et annule les marges
     (css/auth.css). Tant que la porte ne s'ouvrait qu'au rechargement, la
     classe repartait avec la page. Depuis que le compte à rebours ouvre le jeu
     sur place, à l'heure dite, l'oublier revenait à livrer le jeu sans
     navigation à tous ceux qui attendaient l'ouverture. */
  document.body.classList.remove('inlock');

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
  /* Remplacer le contenu remet le défilement à zéro. Sur le même onglet, la
     position de lecture appartient au joueur : un rafraîchissement de fond ne
     doit pas le renvoyer en haut de ses 122 cases. */
  const haut = m.className === 'tab-' + tab ? m.scrollTop : 0;
  m.className = 'tab-' + tab;
  m.innerHTML = vue();
  if (haut) m.scrollTop = haut;

  if (tab === 'boosters') bindPack();
  if (tab === 'reflets') placerPass();
  if (tab === 'combats' && typeof echPlacerPass === 'function') echPlacerPass();
  bindReglages();
  /* Le tiroir montre les compteurs et les pastilles : il suit chaque rendu. */
  if (tiroirOuvert) $('#tiroir').innerHTML = vTiroir();

  /* Une carte Promo décrochée pendant l'appel serveur attend ici : l'écran est
     posé, c'est le moment de lui laisser la scène. */
  viderFilePromos();

  /* Puis, s'il y a lieu, la bienvenue ou le rappel du Discord — jamais plus
     d'une fenêtre par session, et jamais par-dessus autre chose. */
  proposerAccueil();
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
    /* Version 2.0 : l'événement se charge en arrivant. */
    if (tab === 'illu') chargerIllu();
    /* L'Échauffement : un défi de plus chaque jour, on relit en arrivant. */
    if (tab === 'combats') chargerEch();
    if (tab === 'reflets' && recapReflets()) chargerRecap();
    else if (tab === 'reflets') {
      passPlace = false;
      chargerReflets();
      if (!Backend.shop.length) Backend.loadShop().then(render).catch(() => {});
    }
    /* Le recyclage met de côté les cartes promises dans un échange : il lui
       faut la liste à jour. */
    if (tab === 'recyclage') Backend.loadTrades().then(render).catch(() => {});
    if (tab === 'boite') ouvrirBoite();
    if (tab === 'classement') chargerClassement();
    if (tab === 'tirages') chargerTirages();
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
  const el = e.target.closest('[data-act],[data-show],[data-filter],[data-ess],[data-rar],[data-tab],[data-auth],[data-tr],[data-soc],[data-qv],[data-shv],[data-shop],[data-quete],[data-trep],[data-trann],[data-pick],[data-cardpick],[data-ava],[data-avacard],[data-frame],[data-fiche],[data-ami-ok],[data-ami-non],[data-troc],[data-trdemande],[data-colde],[data-trcol],[data-vit-on],[data-vit-off],[data-promo],[data-pickrar],[data-pickrev],[data-recplus],[data-recmoins],[data-recrar],[data-voirtroc],[data-annonce-off],[data-clv],[data-craft],[data-tirpart],[data-labv],[data-lab],[data-palier],[data-illu],[data-rfvue],[data-colvue],[data-invit],[data-titre],[data-banniere],[data-gdef],[data-ech]');
  if (!el) return;
  const d = el.dataset;

  if (d.tab) return aller(d.tab);
  /* L'Échauffement (js/echauffement.js). */
  if (d.ech) return echAction(d.ech, el);
  if (d.labv) { labVue = d.labv; return render(); }
  /* Le Labo (js/lab.js) : le serveur, son compte. */
  if (d.lab) return labAction(d.lab, el);
  /* Version 2.0 */
  if (d.colvue) { colVue = d.colvue; if (!d.tab) return render(); }
  if (d.palier) return reclamerPalier(+d.palier);
  if (d.illu) return illuProposer(d.illu);
  if (d.rfvue) return allerRf(d.rfvue);
  if (d.invit) return montrerInvitation(d.invit);
  if (el.matches('[data-titre]')) return choisirTitre(d.titre);
  if (el.matches('[data-banniere]')) return choisirBanniere(d.banniere);
  if (d.auth) return authFaire(d.auth);
  /* `data-qui` accompagne les cartes ouvertes depuis un écran d'échange : la
     visionneuse montre alors aussi combien l'autre en possède. */
  if (d.show) { const c = byId[d.show]; if (c) { SFX.jouer('carte'); openViewer(c, d.qui || null); } return; }
  if (d.filter) { colFilter = d.filter; return render(); }
  if (d.ess) { essFilter = d.ess; return render(); }
  if (d.rar) { rarFilter = d.rar; return render(); }
  if (d.tr) { trRetenirMot(); trVue = d.tr; if (d.tr === 'amis') trDoublons = null; return render(); }
  if (d.soc) { socVue = d.soc; return render(); }
  if (d.qv) { qVue = d.qv; return render(); }
  if (d.clv) { clVue = d.clv; render(); return chargerClassement(); }
  if (d.craft) return ouvrirFabrication(d.craft);
  if (d.tirpart) {
    const t = tirData && tirData.liste && tirData.liste[+d.tirpart];
    return t && partagerTirage({ ids: t.cartes, god: t.god, quand: t.quand });
  }
  if (d.shv) { shopVue = d.shv; return render(); }
  if (d.shop) return ouvrirArticle(d.shop);
  if (d.promo) return testPromo(d.promo);

  /* Amis. Une réponse donnée depuis la boite de réception la met à jour : la
     demande ne doit plus proposer « Accepter ». */
  const majBoite = () => (tab === 'boite' ? Backend.loadBoite() : null);
  if (d.fiche) return ouvrirFiche(d.fiche);
  if (d.amiOk) return agir(async () => { await Backend.amiRepondre(d.amiOk, true); await majBoite(); },
    'Vous êtes amis.');
  if (d.amiNon) return agir(async () => {
    await Backend.amiRepondre(d.amiNon, false).catch(() => Backend.amiRetirer(d.amiNon));
    await majBoite();
  }, 'C\'est fait.');
  if (d.voirtroc) { socVue = 'echanges'; trVue = 'recues'; return aller('social'); }
  if (d.annonceOff) return agir(() => Backend.annonceRetirer(+d.annonceOff), 'Annonce retirée.');
  if (d.troc) return versEchange(d.troc);
  if (d.trdemande) return versEchange(d.trdemande, d.carte);
  if (d.colde) return ouvrirCollectionDe(d.colde, () => ouvrirFiche(d.colde));
  if (d.trcol) { trColVue = d.trcol; return montrerCollectionDe(d.qui); }
  if (d.vitOn) { closeSheet(); return vitrineAjouter(d.vitOn); }
  if (d.vitOff) return vitrineRetirer(d.vitOff);

  /* Quêtes, boutique, échanges */
  if (d.quete) return agir(() => Backend.claimQuest(d.quete), 'Récompense encaissée.')
    .then(ok => { if (ok && tab === 'reflets') chargerReflets(); if (ok && tab === 'combats') chargerEch(); });
  if (d.trep) return trRepondre(d.trep, d.ok === '1');
  if (d.gdef) return reglerGardeDefaut(d.gdef, +d.n);
  if (d.trann) return agir(() => Backend.tradeCancel(d.trann), 'Demande annulée.');
  if (d.pick) { trRetenirMot(); trPickRar = 'all'; return ouvrirChoixCarte(d.pick); }
  if (d.pickrar) return ouvrirChoixCarte(d.role, d.pickrar);
  if (d.pickrev) return ouvrirChoixCarte(d.role, null, d.pickrev === '1');
  if (d.cardpick) return trChoisir(d.role, d.cardpick);

  /* Recyclage */
  if (d.recplus) return recAjuster(d.recplus, 1);
  if (d.recmoins) return recAjuster(d.recmoins, -1);
  if (d.recrar) { recRar = d.recrar; return render(); }

  /* Profil */
  if (d.ava) return agir(() => Backend.setProfile({ p_avatar: d.ava }));
  if (d.avacard) { closeSheet(); return agir(() => Backend.setProfile({ p_avatar: 'card:' + d.avacard })); }
  if (d.frame) return agir(() => Backend.setProfile({ p_frame: d.frame }));

  switch (d.act) {
    case 'open': return openBooster();
    case 'open-bonus': return openBooster({ bonus: true });
    case 'nouveautes': return montrerNouveautes();
    case 't-nouveautes-25': return montrerNouveautes25();
    case 't-nouveautes-21': return montrerNouveautes21();
    case 'connexion': return ouvrirConnexion();
    case 'son-test': return testerSon();
    case 'vers-garder': return versGarder();
    case 'illu-partager': return illuPartager();
    case 'pass-tout': return reclamerTout();
    case 'pf-devise': return enregistrerDevise();
    case 'pf-banniere': return ouvrirChoixBanniere();
    case 'col-toggle': colOuvert = !colOuvert; return render();
    case 'col-reset':
      colFilter = essFilter = rarFilter = 'all';
      colPossedees = colObjectifs = colFavoris = false;
      return render();
    case 'porte-discord': return porteConnexion();
    case 'porte-sortir': return porteSortir();
    case 'porte-code': return porteCode();
    case 'installer': return ouvrirInstall(true);
    case 'pf-pseudo': return changerPseudo();
    case 'pf-carte': return ouvrirChoixAvatar();
    case 'vit-add': return ouvrirChoixVitrine();
    case 'soc-add': return socAjouter();
    case 'tr-find': return trChercher();
    case 'tr-send': return trEnvoyer();
    case 'tr-changer': return trChanger();
    case 'rec-tout': return recToutPrendre();
    case 'rec-vider': recSel = {}; return render();
    case 'rec-go': return recConfirmer();
    case 'annonce-publier': return publierAnnonce();
    case 'tr-voir': return trCible ? ouvrirCollectionDe(trCible.pseudo) : null;

    case 'deconnexion':
      return openSheet({
        title: 'Se déconnecter ?',
        body: '<p class="muted">Ta collection reste sur ton compte : tu la retrouveras en revenant.</p>',
        actions: [
          { label: 'Se déconnecter', primary: true, fn: async () => {
            closeSheet(); await Backend.signOut(); location.reload();
          }},
          { label: 'Annuler', fn: closeSheet }
        ]
      });

    case 'unique-partager': {
      const u = uniques[0];
      if (!u) return;
      return partagerTirage({ ids: [u.id], quand: save.chasse && save.chasse.trouvee_le,
        titre: 'Exemplaire unique', texte: `${u.nom}, la seule du jeu, sur ${GAME_NAME}` });
    }

    /* --- Labo (administrateurs) --- */
    case 't-open': return openBooster({ test: true });
    case 't-R': case 't-E': case 't-L':
      return openBooster({ test: true, force: d.act.slice(2), god: false });
    case 't-god': return openBooster({ test: true, god: true });
    case 't-BR': return openBooster({ test: true, god: false, brillante: true });
    case 't-UN': return openBooster({ test: true, god: false, unique: true });
    case 't-REV': return openBooster({ test: true, god: false, reverseR: true });
    case 't-v2-invitation': return montrerInvitation('M8-TEST-0000');
    case 't-ech-debut': return labEchApercu(false);
    case 't-ech-complet': return labEchApercu(true);
    case 't-ech-annonce':
      if (!(echData && echData.apercu) && !echActif()) labEchApercu(false);
      return echData && montrerEchAnnonce();
    case 't-ech-indices': return labEchIndices();
    case 't-ech-final': return labEchFinal();
    case 't-ech-sf': return labEchApercuApres(false);
    case 't-ech-recap': return labEchApercuApres(true);
    case 't-v2-recap': apercuRecap(); return aller('reflets');
    case 't-v2-recap-pop': apercuRecap(); return montrerRecap();
    case 't-v2-recap-ban': apercuRecap(); return aller('boosters');
    case 'recap-quitter': return quitterApercuRecap();
    case 't-partage':
      return partagerTirage({ ids: makeBooster(poolFor(), false).map(c => c.id), quand: new Date().toISOString() });
    case 't-ev-reel': return labEtatReel();
    case 't-joueurs': return labChargerJoueurs();
    case 'cadeau-offrir': return labOffrirCadeau();
    case 't-cadeau': return labApercuCadeau();
    case 't-promo-file': return testFilePromos();
    case 't-quete': return testQuete();
    case 't-ping': return testPing();
    case 't-toast': return toast('Voilà à quoi ça ressemble.');

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
  if (e.target.closest('#cloche')) return aller('boite');
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
/* Un événement qui commence ou finit, une chasse qui ouvre (prochaineBascule,
   js/booster.js) : on redemande l'état, au plus toutes les trente secondes si
   le serveur n'a pas encore basculé. */
let derniereBascule = 0;
let sortieVue = sortieFaite();
setInterval(() => {
  if (!save || !porteOuverte() || porteVisible()) return;

  if (Backend.mode === 'cloud') {
    if (save.tickets < TICKET_CAP && Date.now() - save.lastTick >= INTERVAL && !attenteServeur) {
      attenteServeur = true;
      Backend.pull().then(() => { attenteServeur = false; header(); if (tab === 'boosters' && !rv) render(); })
                    .catch(() => { attenteServeur = false; });
    }
    const bascule = prochaineBascule();
    if (bascule && Date.now() >= bascule + 1000 && Date.now() - derniereBascule > 30000 && !attenteServeur) {
      attenteServeur = true;
      derniereBascule = Date.now();
      Backend.pull().then(() => { attenteServeur = false; majDiscrete(true); chargerEch(); })
                    .catch(() => { attenteServeur = false; });
    }
    /* La sortie de la version (SORTIE, js/config.js) : le numéro, la fenêtre
       des nouveautés et le teasing du récap changent à la minute dite. */
    if (sortieFaite() !== sortieVue) { sortieVue = sortieFaite(); majDiscrete(true); }
    document.querySelectorAll('[data-rebours]').forEach(el => {
      el.textContent = dureeCourte(+el.dataset.rebours - Date.now());
    });
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

/* ---------- Quand il est prudent de redessiner ---------- */
/* Deux moments où un rendu venu de l'arrière-plan ferait des dégâts :
     · pendant une ouverture ou une scène de Promo — l'écran appartient aux
       cartes, et le redessiner couperait la mise en scène ;
     · pendant qu'une demande d'échange ou une annonce se compose — le champ
       de saisie perdrait le curseur et le texte déjà tapé.
   Les deux tests vivent ici, et nulle part ailleurs. */
const ecranOccupe = () => !!rv || opening || promoEnCours;
const enTrainDEcrire = () => (tab === 'social' && socVue === 'echanges' && trVue === 'nouvelle')
  || tab === 'labo'
  /* Devine l'illu, la devise du profil : un champ en cours de saisie. */
  || (document.activeElement && ['il-saisie', 'pf-devise'].includes(document.activeElement.id));

/* Les compteurs, la barre et le tiroir se remettent à jour sans toucher à la
   page. Le contenu, lui, n'est redessiné que si ça ne dérange personne. */
function majDiscrete(pageAussi) {
  header();
  $('#nav').innerHTML = navHTML();
  if (tiroirOuvert) $('#tiroir').innerHTML = vTiroir();
  if (pageAussi && !ecranOccupe() && !enTrainDEcrire()) render();
}

/* Revenir sur l'onglet après un moment : on resynchronise. Devant l'écran
   d'attente, on redemande l'heure au serveur — l'horloge interne de la page a
   pu s'arrêter pendant la veille du téléphone. */
addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!porteOuverte()) return relirePorte();
  if (Backend.mode !== 'cloud') return;
  Backend.pull().then(() => majDiscrete(true)).catch(() => {});
  releverBoite();
  relireCadeaux();
  chargerIllu();
  chargerEch();
});

/* Ce qui arrive des autres joueurs — demandes d'ami, d'échange, réponses — et
   les annonces passent par la boite de réception : relève, temps réel et
   pings vivent dans js/boite.js. */

/* ---------- Démarrage ---------- */
/* `checkin()` ne fait quelque chose qu'une fois par jour : passé le premier
   appel, il recalcule tout l'état du compte pour ne rien changer. Or c'est
   l'appel le plus lourd du serveur — recharge des boosters, pourcentage de
   collection, paliers de Promo. On s'en passe quand la visite du jour est
   déjà enregistrée : une ouverture de page sur deux l'économise, et davantage
   pour qui revient souvent.

   La journée est celle de Paris, comme côté serveur (checkin dans
   supabase/03_rpc.sql) : sans ça, les deux ne changeraient pas de jour au
   même moment. */
function visiteDuJourFaite() {
  if (!save || !save.lastCheckin) return false;
  const p = heureParis(new Date(Date.now() + Backend.skew));
  const jour = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return String(save.lastCheckin).slice(0, 10) === jour;
}

(async () => {
  cards = buildCards();
  promos = buildPromos();
  brillantes = buildBrillantes(cards);
  reverses = buildReverses(cards);
  uniques = buildUniques();
  rebuild();
  brand();
  rollPack();
  oublierTheme();
  poserRM(reglageRM());

  /* Le service worker se branche toujours : c'est lui qui apporte les mises à
     jour. Le laisser de côté pendant que la porte est fermée gèlerait le site
     sur la version qu'un visiteur a déjà en cache. */
  brancherSW();

  /* Un retour de Discord peut porter un refus : on le lit avant d'ouvrir la
     session, car la bibliothèque nettoie l'adresse en cherchant la sienne. */
  lireErreurRetour();

  /* La session est nécessaire même quand la bêta est fermée : c'est elle qui
     dit si ce compte a le droit d'entrer. */
  await Backend.init();

  /* L'écran d'attente demande au serveur si c'est ouvert, et quelle heure il
     est chez lui : ni la montre de l'appareil ni la page n'en décident. */
  if (PORTE.active) await Porte.lire();

  if (!porteOuverte()) return render();

  if (Backend.mode === 'cloud') {
    try {
      if (!visiteDuJourFaite()) await Backend.checkin();
      Backend.loadShop().catch(() => {});
      Promise.all([Backend.loadTrades(), Backend.loadAmis()])
        .then(() => { if (tab === 'social' || tab === 'recyclage') render(); }).catch(() => {});
      demarrerBoite();
      /* Un cadeau qui attend (js/cadeaux.js) : il s'ouvre quand l'écran est calme. */
      relireCadeaux();
      /* Devine l'illu : sa pastille dit qu'une grille attend, avant même
         qu'on ouvre l'onglet (elle n'apparaissait qu'après une visite de
         l'événement). */
      chargerIllu();
      /* L'Échauffement (js/echauffement.js) : son bandeau, sa pastille. */
      chargerEch();
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
