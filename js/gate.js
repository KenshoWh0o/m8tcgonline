/* Écran d'attente et accès avant l'ouverture.

   ------------------------------------------------------------------------
   Qui décide que c'est ouvert : le serveur, et lui seul

   L'écran comparait l'heure d'ouverture à la montre de l'appareil. Avancer la
   date du téléphone suffisait donc à l'effacer — et derrière lui, le mode hors
   ligne donnait accès à tout le jeu, sans compte. C'est par là que des
   visiteurs passaient.

   Désormais, l'écran demande au serveur (porte(), supabase/01_schema.sql) si
   c'est ouvert, quand ça ouvre, et quelle heure il est chez lui. Le temps qui
   passe ensuite est compté avec performance.now() : une horloge qui démarre
   avec la page et que l'utilisateur ne peut pas régler. Changer la date de
   l'appareil ne fait plus rien.

   Sans réponse du serveur, l'écran reste fermé : on ne sait pas, donc on
   n'ouvre pas.

   ------------------------------------------------------------------------
   Ce que ça protège, et ce que ça ne protège pas

   Le JEU est protégé par le serveur : sans invitation, aucune action
   n'aboutit (garde_beta) et aucun compte ne se crée (handle_new_user).

   L'ÉCRAN, lui, vit dans le navigateur. Il ne se contourne plus en réglant
   une montre, mais quelqu'un qui ouvre la console finira toujours par passer
   derrière un écran : le site est fait de fichiers publics. Ce qu'il trouvera
   derrière, c'est le mode hors ligne — des paquets tirés dans son navigateur,
   qui ne comptent nulle part. */
"use strict";

/* Le projet est annulé : le site affiche l'annonce d'arrêt (vAnnonceArret,
   plus bas), et seuls les comptes invités (supabase/09_beta.sql) entrent
   encore. Côté serveur, beta_lancement() vaut 'infinity' dans
   supabase/01_schema.sql : c'est lui qui refuse vraiment les non-invités,
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
    reste: () => (connu && lancement != null ? lancement - maintenant() : null)
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
  /* Plus de date : l'heure d'ouverture est annulée, seule l'invitation compte. */
  if (!PORTE.active) return 'ouvert';
  if (Backend.mode !== 'cloud') return 'attente';
  /* `=== true` : sans réponse claire du serveur, on n'entre pas. */
  return save && save.invite === true ? 'ouvert' : 'refus';
};

const porteOuverte = () => etatPorte() === 'ouvert';


/* ---------- L'écran ---------- */
function vPorte() {
  const corps = etatPorte() === 'refus' ? vPorteRefus() : vPorteAttente();

  return `<div class="lockwrap"><div class="lockcard">
    <img class="locklogo" src="${ART.logo}" alt="${h(GAME_NAME)}">

    <div class="lockart" aria-hidden="true">
      <div class="lockglow"></div>
      <img class="lockpack" src="${packArt}" alt="">
      <div class="lockshadow"></div>
    </div>

    ${corps}

    <p class="mentions">${MENTIONS}</p>
  </div></div>`;
}

/* L'annonce d'arrêt, commune aux deux écrans. Depuis le 1er novembre 2026,
   dans la DA de la 3.0 (fin de css/auth.css) : la phrase qui compte, « ne
   verra pas le jour », est posée dans une tuile, sous le titre, et le paquet
   ne flotte plus — il ne promet plus rien. */
const MATEPEDIA_URL = 'https://matepedia.com/fr/trading-card-game';

function vAnnonceArret() {
  return `<span class="locktag refus">Projet annulé</span>
    <h1 class="locktitle">Merci</h1>
    <div class="lockfin">
      <strong><span class="lockfin-nom">M8 TCG Online</span> ne verra pas le jour.</strong>
      <p>Après échange avec Gentle Mates, certaines fonctionnalités essentielles
        du projet ne peuvent pas être proposées. Nous avons donc décidé
        d'annuler son lancement.</p>
    </div>
    <p class="lockmerci">Merci à toutes les personnes qui ont suivi et soutenu le projet. 🩷</p>`;
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
   retour (supabase/21_reflets.sql). */
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
  const code = codeInvitation();
  const connexion = Backend.dispo
    ? `<button class="linkbtn lockacces" data-act="porte-discord">${code ? 'Me connecter avec Discord' : 'J\'ai un accès'}</button>`
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
    <p class="muted small lockaide"><b>${h(qui)}</b> n'a pas accès au jeu.</p>
    <div class="lockinvit">
      <label class="muted small" for="porte-code">Un ami t'a invité ? Entre son code :</label>
      <div class="findrow"><input id="porte-code" type="text" maxlength="20" placeholder="M8-XXXX-XXXX"
        value="${h(codeInvitation())}" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn tiny" data-act="porte-code">Entrer</button></div>
    </div>
    <div class="lockentree">
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}
      <button class="linkbtn lockacces" data-act="porte-sortir">Changer de compte</button>
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
  if (!PORTE.active || porteOuverte()) return;
  Porte.lire().then(() => { if (porteOuverte()) ouvrirLaPorte(); else render(); });
}
