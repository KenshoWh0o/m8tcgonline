/* Écran d'attente et accès avant l'ouverture.

   ------------------------------------------------------------------------
   Qui décide que c'est ouvert : le serveur, et lui seul

   L'écran comparait l'heure d'ouverture à la montre de l'appareil. Avancer la
   date du téléphone suffisait donc à l'effacer — et derrière lui, le mode hors
   ligne donnait accès à tout le jeu, sans compte. C'est par là que des
   visiteurs passaient.

   Désormais, l'écran demande au serveur (porte(), supabase/installation/01_schema.sql) si
   c'est ouvert, quand ça ouvre, et quelle heure il est chez lui. Le temps qui
   passe ensuite est compté avec performance.now() : une horloge qui démarre
   avec la page et que l'utilisateur ne peut pas régler. Changer la date de
   l'appareil ne fait plus rien.

   Sans réponse du serveur, l'écran reste fermé : on ne sait pas, donc on
   n'ouvre pas.

   ------------------------------------------------------------------------
   Ce que ça protège, et ce que ça ne protège pas

   Le JEU est protégé par le serveur : sans invitation, aucune action
   n'aboutit (garde_beta). La connexion crée bien un profil à tout le monde
   (handle_new_user), mais tant qu'il n'a pas d'invitation, le serveur
   refuse ses actions.

   L'ÉCRAN, lui, vit dans le navigateur. Il ne se contourne plus en réglant
   une montre, mais quelqu'un qui ouvre la console finira toujours par passer
   derrière un écran : le site est fait de fichiers publics. Ce qu'il trouvera
   derrière, c'est le mode hors ligne — des paquets tirés dans son navigateur,
   qui ne comptent nulle part. */
"use strict";

/* Le projet est annulé : le site affiche l'annonce d'arrêt (vAnnonceArret,
   plus bas), et seuls les comptes invités (supabase/installation/09_beta.sql) entrent
   encore. Côté serveur, beta_lancement() vaut 'infinity' dans
   supabase/installation/01_schema.sql : c'est lui qui refuse vraiment les non-invités,
   l'écran seul ne suffit pas.

   Pour rouvrir à tous : `active` à `false` ici ET une date passée dans
   beta_lancement() (puis jouer la fonction dans Supabase).

   `true` : l'écran d'annonce est en place — seuls les comptes invités entrent.
   `false` : le jeu est ouvert à tous, cet écran ne s'affiche plus.
   Figé : on ne le bascule pas depuis la console. */
const PORTE = Object.freeze({ active: true });

/* Ce que le serveur a répondu. Tenu dans une fermeture : la page lit l'état,
   elle ne peut pas l'écrire. */
const Porte = (() => {
  let connu = false;          /* le serveur a-t-il répondu ? */
  let ouvert = false;         /* ouvert au moment de la réponse */
  let lancement = null;       /* l'heure d'ouverture, en temps serveur */
  let version = null;         /* la version de la base (3.0.12) : null avant la 3.0 */
  let maint = null;           /* la maintenance en cours, { message, fin, depuis } */
  let serveurA = 0;           /* l'heure du serveur à sa réponse… */
  let perfA = 0;              /* …et l'horloge interne de la page au même instant */

  const maintenant = () => serveurA + (performance.now() - perfA);

  return Object.freeze({
    async lire() {
      if (!Backend.sb) { connu = false; return false; }
      try {
        const r = await Backend.rpc('porte');
        const t = Date.parse(r && r.serveur);
        if (isNaN(t)) throw new Error('réponse illisible');
        serveurA = t;
        perfA = performance.now();
        ouvert = r.ouvert === true;
        lancement = r.lancement ? Date.parse(r.lancement) : null;
        version = r.version || null;
        maint = r.maintenance && typeof r.maintenance === 'object' ? r.maintenance : null;
        connu = true;
      } catch (e) {
        /* On garde la dernière réponse connue, s'il y en a une : une coupure
           réseau passagère ne doit pas refermer un écran déjà ouvert. */
      }
      return connu;
    },
    connu: () => connu,
    /* Ouvert, d'après le serveur — et à l'heure du serveur. */
    lancee: () => connu && (ouvert || (lancement != null && maintenant() >= lancement)),
    /* Millisecondes avant l'ouverture, ou null si on ne sait pas. */
    reste: () => (connu && lancement != null ? lancement - maintenant() : null),
    /* Version 3.0.12 : la base a-t-elle reçu la 3.0 ? (Sans réponse, on ne
       sait pas : on ne bloque pas pour autant, voir maintenanceBloque.) */
    base30: () => connu && /^3\./.test(String(version || '')),
    maintenance: () => (connu ? maint : null),
    /* L'heure du serveur, maintenant (le compte à rebours du retour). */
    heure: () => maintenant()
  });
})();

let porteMinuteur = null;
/* Un refus de Discord à afficher sur l'écran d'attente (voir lireErreurRetour
   dans js/auth.js). */
let porteRefus = '';

/* ---------- Où en est le visiteur ---------- */
/* 'ouvert'  le jeu peut s'afficher
   'attente' pas de compte : l'écran d'attente, avec le bouton de connexion
   'refus'   connecté, mais pas encore autorisé

   Tout est en `const` : une fonction déclarée se remplace d'une ligne dans la
   console, une constante non. Ce n'est pas une serrure — rien, dans un
   navigateur, n'en est une —, mais l'écran ne s'ouvre plus d'un geste. */
const etatPorte = () => {
  /* Version 3.0.12 : la maintenance passe avant tout le reste. */
  if (maintenanceBloque()) return 'maintenance';
  /* Plus de date : l'heure d'ouverture est annulée, seule l'invitation compte. */
  if (!PORTE.active) return 'ouvert';
  if (Backend.mode !== 'cloud') return 'attente';
  /* `=== true` : sans réponse claire du serveur, on n'entre pas. */
  return save && save.invite === true ? 'ouvert' : 'refus';
};

const porteOuverte = () => etatPorte() === 'ouvert';


/* ---------- L'écran ---------- */
function vPorte() {
  const e = etatPorte();
  const corps = e === 'maintenance' ? vMaintenance(Porte.maintenance()) : e === 'refus' ? vPorteRefus() : vPorteAttente();
  return vCoquillePorte(corps, e === 'maintenance');
}

/* Le logo, le paquet qui flotte, puis le contenu. La maintenance ajoute un
   anneau lavande qui tourne autour du paquet : le travail en cours. */
function vCoquillePorte(corps, maint) {
  return `<div class="lockwrap${maint ? ' maint' : ''}"><div class="lockcard">
    <img class="locklogo" src="${ART.logo}" alt="${h(GAME_NAME)}">

    <div class="lockart" aria-hidden="true">
      <div class="lockglow"></div>
      ${maint ? '<div class="maint-anneau"></div>' : ''}
      <img class="lockpack" src="${packArt}" alt="">
      <div class="lockshadow"></div>
    </div>

    ${corps}

    <p class="mentions">${MENTIONS}</p>
  </div></div>`;
}

/* L'annonce d'arrêt, commune aux deux écrans. */
const MATEPEDIA_URL = 'https://matepedia.com/fr/trading-card-game';

function vAnnonceArret() {
  return `<span class="locktag refus">Projet annulé</span>
    <h1 class="locktitle">Merci</h1>
    <div class="muted lockdit lockarret">
      <p><b>M8 TCG Online</b> ne verra finalement pas le jour.</p>
      <p>Après échange avec Gentle Mates, certaines fonctionnalités essentielles
        du projet ne peuvent pas être proposées. Nous avons donc décidé
        d'annuler son lancement.</p>
      <p>Merci à toutes les personnes qui ont suivi et soutenu le projet. 🩷</p>
    </div>`;
}

function vMatepedia() {
  return `<p class="muted small lockmatepedia">Si vous souhaitez retrouver toutes les
      cartes du TCG et leurs informations, rendez-vous sur
      <a href="${MATEPEDIA_URL}" target="_blank" rel="noopener">Matepedia</a>.
      <br>Un projet communautaire dédié au TCG Gentle Mates.</p>`;
}

/* ---------- Les invitations (version 2.0) ---------- */
/* Un lien d'invitation (?invitation=CODE, js/shop.js) garde son code de côté :
   la personne se connecte avec Discord, et le code s'applique tout seul au
   retour (supabase/installation/21_reflets.sql). */
const INVIT_CLE = 'mtcg.invitation';
(() => {
  const m = /[?&]invitation=([^&#]+)/.exec(location.search);
  if (!m) return;
  try { localStorage.setItem(INVIT_CLE, decodeURIComponent(m[1]).trim().toUpperCase()); } catch (e) { /* mode privé */ }
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* sans gravité */ }
})();
const codeInvitation = () => { try { return localStorage.getItem(INVIT_CLE) || ''; } catch (e) { return ''; } };
let invitEssayee = false;

async function porteCode(code) {
  const c = String(code || ($('#porte-code') || {}).value || '').trim();
  if (!c) return toast('Entre le code reçu.');
  occupe(true);
  try {
    await Backend.utiliserInvitation(c);
    try { localStorage.removeItem(INVIT_CLE); } catch (e) { /* mode privé */ }
    toast('Bienvenue dans le jeu !');
    SFX.jouer('gagne');
    if (porteOuverte()) location.reload();
    else render();
  } catch (e) {
    toast(e.message || 'Ce code n\'a pas fonctionné.');
  } finally {
    occupe(false);
  }
}

/* Connecté sans accès, avec un code gardé de côté : on l'essaie une fois. */
function essayerInvitationGardee() {
  if (invitEssayee || etatPorte() !== 'refus' || !codeInvitation()) return;
  invitEssayee = true;
  porteCode(codeInvitation());
}

function vPorteAttente() {
  if (typeof demoPorte === 'function') return demoPorte(); /* demo (tools/demo.py) */
  const code = codeInvitation();
  const connexion = Backend.dispo
    ? `<button class="linkbtn lockacces" data-act="porte-discord">${code ? 'Me connecter avec Discord' : 'J\'ai déjà un accès'}</button>`
    : '';
  if (code) {
    return `<span class="locktag">Invitation</span>
      <h1 class="locktitle">Tu es invité</h1>
      <div class="muted lockdit"><p>Un ami t'a invité sur <b>${h(GAME_NAME)}</b>. Connecte-toi avec Discord :
        ton code <b>${h(code)}</b> s'appliquera tout seul.</p></div>
      <div class="lockentree">
        <button class="btn" data-act="porte-discord">Me connecter avec Discord</button>
      </div>`;
  }

  return `${vAnnonceArret()}
    <div class="lockentree">
      ${porteRefus ? `<p class="autherr doux lockrefus">${h(porteRefus)}</p>` : ''}
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}
      ${connexion}
    </div>
    ${vMatepedia()}`;
}

/* Connecté, mais sans invitation : le jeu ne lui ouvrira pas. */
function vPorteRefus() {
  const qui = save && save.pseudo ? save.pseudo : 'Ce compte';
  return `${vAnnonceArret()}
    <p class="muted small lockaide"><b>${h(qui)}</b> n'a pas d'accès au jeu.</p>
    <div class="lockinvit">
      <p class="muted small">Un ami t'a invité ? Entre son code :</p>
      <div class="findrow"><input id="porte-code" type="text" maxlength="20" placeholder="M8-XXXX-XXXX"
        value="${h(codeInvitation())}" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn tiny" data-act="porte-code">Entrer</button></div>
    </div>
    <div class="lockentree">
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}
      <button class="btn ghost" data-act="porte-sortir">Changer de compte</button>
    </div>
    ${vMatepedia()}`;
}

/* Le compte à rebours, à l'heure du serveur. */
function vCompteARebours() {
  if (!Porte.connu()) {
    return `<p class="muted small lockattente">${Backend.dispo
      ? 'Connexion au serveur…' : 'Le serveur est injoignable pour le moment.'}</p>`;
  }
  const reste = Porte.reste();
  if (reste == null) return '';
  /* Filet de sécurité : la page ne devrait jamais rester ici une fois l'heure
     passée — ouvrirLaPorte() s'en charge à la seconde près. */
  if (reste <= 0) return '<p class="lockpret">C\'est ouvert.</p>';

  const s = Math.floor(reste / 1000);
  const parts = [
    [Math.floor(s / 86400), 'jours'],
    [Math.floor(s / 3600) % 24, 'heures'],
    [Math.floor(s / 60) % 60, 'min'],
    [s % 60, 'sec']
  ];
  return `<div class="compte">${parts.map(([n, l]) =>
    `<div><b>${String(n).padStart(2, '0')}</b><span>${l}</span></div>`).join('')}</div>`;
}

/* ---------- Entrer, ou changer de compte ---------- */
async function porteConnexion() {
  occupe(true);
  try {
    await Backend.signInDiscord();          /* la page part chez Discord */
  } catch (e) {
    occupe(false);
    toast(e.message || 'La connexion a échoué.');
  }
}

async function porteSortir() {
  occupe(true);
  try {
    await Backend.signOut();
  } catch (e) { /* on recharge quand même */ }
  location.reload();
}

/* ---------- L'heure dite ---------- */
/* Le jeu s'ouvre de lui-même, sans un geste et sans rechargement.

   Pas de `location.reload()` : à la seconde dite, tous ceux qui attendent
   rechargeraient ensemble, et la première chose que verrait le serveur serait
   une vague de connexions simultanées. On redessine sur place — c'est
   instantané — et on ne va chercher l'état du compte qu'après un délai tiré au
   hasard, pour étaler la vague sur une vingtaine de secondes. */
function ouvrirLaPorte() {
  clearInterval(porteMinuteur);
  porteMinuteur = null;
  SFX.jouer('gagne');
  render();

  if (Backend.mode !== 'cloud') return;
  /* Le premier appel sert aussi de pointage du jour : ceux qui attendaient
     l'ouverture n'en avaient pas eu, puisque le jeu ne leur était pas ouvert. */
  setTimeout(() => {
    const premier = visiteDuJourFaite() ? Backend.pull() : Backend.checkin();
    premier.then(() => { render(); demarrerBoite(); }).catch(() => {});
  }, Math.random() * 20000);
}

/* Le compte à rebours bat sans redessiner toute la page. Sans réponse du
   serveur, on lui redemande de temps en temps plutôt que de rester bloqué. */
function bindPorte() {
  clearInterval(porteMinuteur);
  setTimeout(essayerInvitationGardee, 300);
  let tic = 0;
  porteMinuteur = setInterval(() => {
    if (etatPorte() === 'maintenance') return battreMaintenance(++tic);
    const c = $('#lockcompte');
    if (!c) return clearInterval(porteMinuteur);
    if (!Porte.connu() && ++tic % 15 === 0) {
      Porte.lire().then(ok => { if (ok) render(); });
    }
    c.innerHTML = vCompteARebours();
  }, 1000);
}

/* Au retour sur l'onglet : l'horloge interne a pu s'arrêter pendant la mise
   en veille du téléphone. On redemande l'heure au serveur. */
function relirePorte() {
  if (porteOuverte()) return;
  const avant = etatPorte();
  Porte.lire().then(() => {
    if (avant === 'maintenance' && etatPorte() !== 'maintenance') return finMaintenance();
    if (porteOuverte()) ouvrirLaPorte(); else render();
  });
}

/* ---------- La maintenance (version 3.0.12) ---------- */
/* Pendant une maintenance (Labo › Serveur, table maintenance de
   supabase/installation/01_schema.sql), les joueurs voient cet écran et le
   serveur refuse leurs actions (garde_beta) ; les administrateurs entrent.
   Une base qui n'a pas encore reçu la 3.0 (porte() sans version) le montre
   à tout le monde, administrateurs compris : le jour de la sortie, le site
   3.0 peut être en ligne avant sa base. La page redemande toutes les 30 s,
   et s'ouvre d'elle-même au retour. */
const MAINT_DEFAUT = 'La version 3.0 arrive : le jeu est en maintenance le temps de la mise à jour.';

/* Qui reste devant l'écran : tout le monde si la base n'est pas en 3.0 ;
   sinon, pendant une maintenance, qui n'est pas administrateur. Sans réponse
   du serveur, on ne sait pas : les autres écrans s'en chargent. */
const maintenanceBloque = () => Porte.connu()
  && (!Porte.base30() || (!!Porte.maintenance() && !(save && save.isAdmin === true)));

/* « vers 21 h 30 », ou « samedi 7 novembre vers 21 h 30 » un autre jour. */
function heureRetour(iso) {
  const d = new Date(srvTime(iso));
  const o = { timeZone: 'Europe/Paris' };
  const jour = x => x.toLocaleDateString('fr-FR', Object.assign({ weekday: 'long', day: 'numeric', month: 'long' }, o));
  const hm = d.toLocaleTimeString('fr-FR', Object.assign({ hour: 'numeric', minute: '2-digit' }, o)).replace(':', ' h ');
  return `${jour(d) === jour(new Date()) ? '' : jour(d) + ' '}vers ${hm}`;
}
/* Le temps qui reste avant l'heure de retour prévue, à l'heure du serveur. */
function resteRetour(iso, apercu) {
  const r = Date.parse(iso) - (apercu || !Porte.connu() ? Date.now() - Backend.skew : Porte.heure());
  return r > 0 ? `dans ${dureeCourte(r)}` : 'd\'un instant à l\'autre';
}

/* L'écran. `m` : la maintenance du serveur ({ message, fin }), ou null (la
   base n'a pas encore reçu la 3.0). `o.apercu` : dans le Labo. */
function vMaintenance(m, o) {
  o = o || {};
  const msg = (m && m.message) || MAINT_DEFAUT;
  const qui = !o.apercu && Backend.session && save && save.pseudo;
  /* La base n'a pas encore reçu la 3.0 : personne n'entre, pas même un
     administrateur — rien à lui proposer. */
  const personne = !o.apercu && !Porte.base30();
  /* Les gestes secondaires, en liens : réessayer tout de suite, et l'entrée
     des administrateurs (ou le compte connecté, qui n'a pas l'accès). */
  const liens = ['<button class="linkbtn" data-act="maint-relire">Réessayer maintenant</button>'];
  if (!personne && qui) liens.push('<button class="linkbtn" data-act="porte-sortir">Changer de compte</button>');
  else if (!personne && (Backend.dispo || o.apercu)) liens.push('<button class="linkbtn" data-act="porte-discord">Accès administrateur</button>');
  return `<span class="locktag maint">Maintenance</span>
    <h1 class="locktitle">On revient vite</h1>
    <div class="maint-barre" aria-hidden="true"><i></i></div>
    <div class="muted lockdit"><p>${h(msg)}</p></div>
    ${m && m.fin ? `<p class="maint-retour">Retour prévu <b>${h(heureRetour(m.fin))}</b> · <span id="maintreste">${h(resteRetour(m.fin, o.apercu))}</span></p>` : ''}
    <div class="lockentree">
      ${lienDiscord('btn discord', 'Suivre sur le Discord')}
      <p class="muted small maint-auto" id="maintauto">La page s'ouvrira d'elle-même au retour du jeu.</p>
      ${!personne && qui ? `<p class="muted small maint-qui"><b>${h(save.pseudo)}</b> : accès réservé aux administrateurs.</p>` : ''}
      <div class="maint-liens">${liens.join('')}</div>
    </div>`;
}

/* Chaque seconde : le temps qui reste ; toutes les 30 s : le serveur. */
function battreMaintenance(tic) {
  const m = Porte.maintenance();
  const r = $('#maintreste');
  if (r && m && m.fin) r.textContent = resteRetour(m.fin);
  if (tic % 30) return;
  const avant = JSON.stringify(m);
  Porte.lire().then(() => {
    if (etatPorte() !== 'maintenance') return finMaintenance();
    /* Le message ou l'heure ont changé : on redessine. */
    if (JSON.stringify(Porte.maintenance()) !== avant) render();
  });
}

/* « Réessayer » : on redemande tout de suite. */
function relireMaintenance() {
  occupe(true);
  Porte.lire().then(() => {
    occupe(false);
    if (etatPorte() !== 'maintenance') return finMaintenance();
    render();
    toast('Toujours en maintenance : la page s\'ouvrira d\'elle-même.');
  });
}

/* La maintenance est finie : on recharge, pour repartir d'un état neuf (le
   site a pu changer de version). Après un délai tiré au hasard, comme
   ouvrirLaPorte : tout le monde ne revient pas à la même seconde. */
let maintFinie = false;
function finMaintenance() {
  if (maintFinie) return;
  maintFinie = true;
  clearInterval(porteMinuteur);
  SFX.jouer('gagne');
  const a = $('#maintauto');
  if (a) { a.textContent = 'C\'est reparti ! Le jeu se recharge…'; a.classList.add('fini'); }
  const b = $('.maint-barre');
  if (b) b.classList.add('fini');
  setTimeout(() => location.reload(), 1200 + Math.random() * 12000);
}

/* Dans le Labo : l'écran tel que le verront les joueurs, par-dessus tout,
   avec le message et l'heure donnés (ou ceux du serveur). Rien n'est envoyé. */
function apercuMaintenance(m) {
  const avant = document.querySelector('.maint-apercu');
  if (avant) avant.remove();
  const z = document.createElement('div');
  z.className = 'maint-apercu';
  z.setAttribute('role', 'dialog');
  z.setAttribute('aria-label', 'Aperçu de l\'écran de maintenance');
  z.innerHTML = vCoquillePorte(vMaintenance(m, { apercu: true }), true)
    + '<button class="btn tiny maint-apercu-x" data-act="maint-fermer">Fermer l\'aperçu</button>';
  /* L'aperçu vit hors de #main : ses clics ne passent pas par clicPage. Les
     boutons de l'écran n'y font rien ; « Fermer l'aperçu » le referme. */
  z.addEventListener('click', e => {
    const b = e.target.closest('button,a');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.act === 'maint-fermer') return z.remove();
    toast('Aperçu : ce bouton agit pour les joueurs.');
  });
  document.body.appendChild(z);
}

/* Un administrateur qui joue pendant une maintenance le voit en permanence :
   une pastille en haut, qui mène au Labo pour la lever. */
function majPastilleMaintenance() {
  const voir = !!Porte.maintenance() && save && save.isAdmin === true && porteOuverte();
  let p = document.querySelector('.maint-pastille');
  if (!voir) { if (p) p.remove(); return; }
  if (!p) {
    p = document.createElement('button');
    p.className = 'maint-pastille';
    p.innerHTML = '<i aria-hidden="true"></i>Maintenance en cours';
    p.setAttribute('aria-label', 'Maintenance en cours : seuls les administrateurs jouent. Ouvrir le Labo pour la lever.');
    /* Hors de #main : son clic ne passe pas par clicPage. */
    p.addEventListener('click', () => { labVue = 'serveur'; aller('labo'); });
    document.body.appendChild(p);
  }
}
