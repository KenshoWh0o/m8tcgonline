/* Écran d'attente et accès à la bêta fermée.

   ------------------------------------------------------------------------
   Pourquoi il n'y a plus de code d'accès

   Il y en avait un : on tapait une chaîne, le navigateur la hachait, comparait
   l'empreinte écrite dans ce fichier et retenait la réponse dans le stockage
   local. Deux défauts, et les deux ont servi.

   1. L'empreinte était dans la page. Qui ouvrait la console entrait sans
      connaître le code. C'était écrit ici dès le premier jour — un rideau, pas
      une serrure — mais un rideau finit par se lever.
   2. Un code se transmet. Une fois dans un salon Discord, il n'appartient plus
      à personne et ne se reprend plus.

   L'accès est donc devenu nominatif. On se connecte avec son compte Discord,
   et c'est le SERVEUR qui dit si ce compte figure sur la liste des invités
   (table `beta_invites`, fonction garde_beta() — voir supabase/01_schema.sql).
   Rien à transmettre, rien à deviner, et une invitation se retire.

   ------------------------------------------------------------------------
   Ce que ça protège, et ce que ça ne protège pas

   Ça protège le JEU : sans invitation, aucune action du serveur n'aboutit —
   ni ouvrir un booster, ni voir un profil, ni même jouer hors ligne, puisque
   le mode hors ligne ne franchit plus cet écran.

   Ça ne protège pas les FICHIERS. Le site est un site statique : ses scripts,
   ses images et la liste des cartes se téléchargent à l'adresse où ils sont
   publiés, écran d'attente ou non. Tant que le dépôt et l'hébergement sont
   publics, le contenu l'est aussi. La seule réponse à ça est du côté de
   l'hébergement, pas du code. */
"use strict";

const PORTE = {
  /* `true` : bêta fermée — seuls les comptes invités entrent.
     `false` : le jeu est ouvert à tous, cet écran ne s'affiche plus. */
  active: true,

  /* L'heure d'ouverture au public, au format ISO avec le décalage horaire.
     Passé cet instant, l'écran s'efface de lui-même : rien à rejouer, rien à
     pousser.

     ELLE DOIT RESTER IDENTIQUE à beta_ouverte() dans supabase/01_schema.sql :
     celle-ci ouvre l'écran, celle-là ouvre le serveur. Deux dates différentes
     donneraient un écran ouvert sur un serveur qui refuse, ou l'inverse.

     À `null`, aucun compte à rebours n'est affiché : on annonce seulement
     « bientôt », et l'accès reste sur invitation jusqu'à nouvel ordre. */
  lancement: '2026-09-24T18:00:00+02:00'
};

let porteMinuteur = null;

/* ---------- Où en est le visiteur ---------- */
/* 'ouvert'  le jeu peut s'afficher
   'attente' pas de compte : l'écran d'attente, avec le bouton de connexion
   'refus'   connecté, mais pas sur la liste des invités */
function etatPorte() {
  if (!PORTE.active || porteLancee()) return 'ouvert';
  if (Backend.mode !== 'cloud') return 'attente';
  return save && save.invite ? 'ouvert' : 'refus';
}

/* L'heure d'ouverture est-elle passée ? La réponse vient de l'horloge de
   l'appareil, donc elle ne protège rien : une montre avancée ouvre l'écran en
   avance, et c'est sans conséquence. La vraie décision est prise par le
   serveur, à chaque action (beta_ouverte(), supabase/01_schema.sql). */
function porteLancee() {
  if (!PORTE.lancement) return false;
  const t = Date.parse(PORTE.lancement);
  return !isNaN(t) && Date.now() >= t;
}

const porteOuverte = () => etatPorte() === 'ouvert';

const DISCORD_ICO_PORTE = '<svg viewBox="0 0 24 18" aria-hidden="true" fill="currentColor"><path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a14 14 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A13.6 13.6 0 0 0 8.6.1 19.7 19.7 0 0 0 3.7 1.6C.6 6.2-.3 10.7.2 15.1a19.9 19.9 0 0 0 6 3 14.7 14.7 0 0 0 1.3-2.1 13 13 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4a13 13 0 0 1-2 1 14.5 14.5 0 0 0 1.3 2.1 19.8 19.8 0 0 0 6-3c.6-5.1-.9-9.6-3.6-13.5ZM8.0 12.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 7.6 8 7.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>';

/* ---------- L'écran ---------- */
function vPorte() {
  const etat = etatPorte();
  const corps = etat === 'refus' ? vPorteRefus() : vPorteAttente();

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

function vPorteAttente() {
  /* Sans serveur configuré, il n'y a personne pour vérifier une invitation :
     on le dit, plutôt que de montrer un bouton qui ne mènerait nulle part. */
  const entree = Backend.dispo
    ? `<button class="btn discord" data-act="porte-discord">
         ${DISCORD_ICO_PORTE} Se connecter avec Discord</button>`
    : `<p class="muted small lockaide">Le serveur n'est pas encore branché sur
         ce site : l'accès rouvrira avec lui.</p>`;

  return `<span class="locktag">Bientôt disponible</span>
    <h1 class="locktitle">Coming soon</h1>
    <p class="muted lockdit">L'extension <b>${h(SET_NAME)}</b> et ses ${cards.length} cartes
      arrivent bientôt. Boosters, collections, échanges,…</p>

    <div id="lockcompte">${vCompteARebours()}</div>

    <div class="lockentree">${entree}</div>`;
}

function vPorteRefus() {
  const qui = save && save.pseudo ? save.pseudo : 'Ce compte';
  return `<span class="locktag refus">Bêta fermée</span>
    <h1 class="locktitle">Pas encore</h1>
    <p class="muted lockdit"><b>${h(qui)}</b> n'est pas sur la liste des invités.
      Le jeu ouvrira à tout le monde bientôt — d'ici là, l'accès se fait par
      invitation.</p>

    <div id="lockcompte">${vCompteARebours()}</div>

    <div class="lockentree">
      <button class="btn ghost" data-act="porte-sortir">Changer de compte</button>
    </div>`;
}

/* Compte à rebours, seulement si une date d'ouverture est fixée. */
function vCompteARebours() {
  if (!PORTE.lancement) return '';
  const reste = Date.parse(PORTE.lancement) - Date.now();
  if (isNaN(reste)) return '';
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
    noterHorsLigne(false);
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
    premier.then(render).catch(() => {});
  }, Math.random() * 20000);
}

/* Le compte à rebours bat sans redessiner toute la page. */
function bindPorte() {
  clearInterval(porteMinuteur);
  if (!PORTE.lancement) return;
  porteMinuteur = setInterval(() => {
    const c = $('#lockcompte');
    if (!c) return clearInterval(porteMinuteur);
    if (porteLancee()) return ouvrirLaPorte();
    c.innerHTML = vCompteARebours();
  }, 1000);
}
