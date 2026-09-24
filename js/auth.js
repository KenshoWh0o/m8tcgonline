/* Écran de connexion : par Discord (ou par adresse e-mail, si cette voie est
   rouverte dans CONNEXION). Il n'y a plus de jeu sans compte : tant qu'on
   n'est pas connecté, c'est cet écran, et rien d'autre. */
"use strict";

/* 'accueil' | 'inscription' | 'connexion' | 'oubli' | 'confirme' */
let authVue = 'accueil';
/* Les écrans liés à l'adresse e-mail n'existent que si cette voie est ouverte. */
const VUES_EMAIL = ['inscription', 'connexion', 'oubli', 'confirme'];
let authMail = '';
let authErr = '';

/* Pas connecté (ou serveur injoignable) : la porte d'entrée, toujours. Le
   mode hors ligne n'est plus proposé — l'ancien choix « jouer sans compte »
   gardé dans le navigateur (clé mtcg.horsligne) n'est plus lu. */
const porteVisible = () => Backend.mode !== 'cloud';

/* ---------- Retour d'un détour par Discord ---------- */
/* Quand le serveur refuse l'inscription — le jeu n'est pas encore ouvert et le
   compte n'a pas d'accès (voir handle_new_user dans supabase/01_schema.sql) —,
   Supabase nous renvoie ici avec l'erreur dans l'adresse. Sans cette lecture,
   l'écran de connexion réapparaissait sans un mot : on croyait que le bouton
   n'avait rien fait.

   À appeler AVANT Backend.init() : la bibliothèque nettoie l'adresse en
   cherchant sa session. */
function lireErreurRetour() {
  const brut = (location.hash || '') + '&' + (location.search || '');
  const src = new URLSearchParams(brut.replace(/[#?]/g, '&'));
  const msg = src.get('error_description') || src.get('error');
  if (!msg) return;

  authErr = /beta_fermee|beta/i.test(msg)
    ? "Le jeu n'est pas encore ouvert : ce compte n'y a pas encore accès."
    : 'La connexion a échoué. Réessaie dans un instant.';

  /* Avant l'ouverture, un refus à l'inscription vient presque toujours de là :
     le serveur refuse de créer un compte qui n'a pas d'accès (handle_new_user,
     supabase/01_schema.sql), et Supabase ne renvoie qu'une erreur générique.
     L'écran d'attente le dit, au lieu de revenir sans un mot. */
  porteRefus = PORTE.active
    ? "Ce compte n'a pas encore accès au jeu. Rendez-vous à l'ouverture !"
    : '';

  /* On efface l'erreur de l'adresse : recharger la page ne doit pas la
     remontrer, et un lien recopié ne doit pas la transporter. */
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* sans gravité */ }
}


function vAuth() {
  if (!CONNEXION.email && VUES_EMAIL.includes(authVue)) authVue = 'accueil';

  const champ = (id, type, label, val, extra) =>
    `<label class="field"><span>${label}</span>
      <input id="${id}" type="${type}" value="${h(val || '')}" ${extra || ''}></label>`;

  const err = authErr ? `<p class="autherr">${h(authErr)}</p>` : '';
  let corps;

  if (authVue === 'confirme') {
    corps = `<h1 class="authtitle">Vérifie tes courriels</h1>
      <p class="muted">On vient d'envoyer un lien à <b>${h(authMail)}</b>.
        Clique dessus pour activer ton compte, puis reviens ici.</p>
      <p class="muted small">Rien reçu ? Regarde dans les indésirables.</p>
      <div class="authacts">
        <button class="btn ghost" data-auth="renvoyer">Renvoyer le lien</button>
        <button class="linkbtn" data-auth="vers-connexion">J'ai confirmé, me connecter</button>
      </div>`;

  } else if (authVue === 'inscription') {
    corps = `<h1 class="authtitle">Créer un compte</h1>
      <p class="muted">Ta collection, tes boosters et tes échanges te suivent partout.</p>
      ${err}
      ${champ('a-pseudo', 'text', 'Pseudo', '', 'maxlength="16" autocomplete="username" placeholder="3 à 16 caractères"')}
      ${champ('a-mail', 'email', 'Adresse e-mail', authMail, 'autocomplete="email" inputmode="email"')}
      ${champ('a-mdp', 'password', 'Mot de passe', '', 'autocomplete="new-password" placeholder="8 caractères minimum"')}
      <div class="authacts">
        <button class="btn" data-auth="inscrire">Créer mon compte</button>
        <button class="linkbtn" data-auth="vers-connexion">J'ai déjà un compte</button>
      </div>`;

  } else if (authVue === 'connexion') {
    corps = `<h1 class="authtitle">Se connecter</h1>
      ${err}
      ${champ('a-mail', 'email', 'Adresse e-mail', authMail, 'autocomplete="email" inputmode="email"')}
      ${champ('a-mdp', 'password', 'Mot de passe', '', 'autocomplete="current-password"')}
      <div class="authacts">
        <button class="btn" data-auth="entrer">Se connecter</button>
        <button class="linkbtn" data-auth="vers-oubli">Mot de passe oublié ?</button>
        <button class="linkbtn" data-auth="vers-inscription">Créer un compte</button>
      </div>`;

  } else if (authVue === 'oubli') {
    corps = `<h1 class="authtitle">Mot de passe oublié</h1>
      <p class="muted">On t'envoie un lien pour en choisir un nouveau.</p>
      ${err}
      ${champ('a-mail', 'email', 'Adresse e-mail', authMail, 'autocomplete="email" inputmode="email"')}
      <div class="authacts">
        <button class="btn" data-auth="oublier">Envoyer le lien</button>
        <button class="linkbtn" data-auth="vers-connexion">Retour</button>
      </div>`;

  } else {
    corps = `<h1 class="authtitle">Ta collection, en ligne</h1>
      <p class="muted">Un compte garde tes cartes, tes boosters et ton pseudo,
        et te donne accès aux échanges entre joueurs.</p>
      ${err}
      ${Backend.dispo ? '' : `<p class="autherr">Le serveur est injoignable pour le moment.
        Réessaie dans un instant.</p>`}
      <div class="authacts">
        ${!Backend.dispo || Backend.panne
          ? '<button class="btn" data-auth="reessayer">Réessayer</button>'
          : ''}
        ${Backend.dispo && CONNEXION.discord
          ? `<button class="btn discord" data-auth="discord">${ICON.discord} Continuer avec Discord</button>`
          : ''}
        ${Backend.dispo && CONNEXION.email
          ? `<button class="btn ${CONNEXION.discord ? 'ghost' : ''}" data-auth="vers-inscription">Créer un compte avec une adresse</button>
             <button class="linkbtn" data-auth="vers-connexion">J'ai déjà un compte</button>`
          : ''}
      </div>`;
  }

  return `<div class="authwrap"><div class="authcard">
    <img class="authlogo" src="${ART.logo}" alt="${h(GAME_NAME)}">
    ${corps}
    <p class="mentions">${MENTIONS}</p>
  </div></div>`;
}

/* ---------- Actions ---------- */
const valeur = id => { const e = $('#' + id); return e ? e.value.trim() : ''; };

const ACTIONS_EMAIL = ['vers-inscription', 'vers-connexion', 'vers-oubli',
                       'inscrire', 'entrer', 'oublier', 'renvoyer'];

async function authFaire(quoi) {
  authErr = '';
  const aller = v => { authVue = v; render(); };

  /* Garde-fou : un vieux lien ou un clic tardif ne doit pas ouvrir une voie fermée. */
  if (!CONNEXION.email && ACTIONS_EMAIL.includes(quoi)) return aller('accueil');
  if (!CONNEXION.discord && quoi === 'discord') return aller('accueil');

  if (quoi === 'vers-inscription') return aller('inscription');
  if (quoi === 'vers-connexion') return aller('connexion');
  if (quoi === 'vers-oubli') return aller('oubli');
  if (quoi === 'reessayer') return location.reload();

  occupe(true);
  try {
    if (quoi === 'discord') {
      await Backend.signInDiscord();     /* la page part chez Discord */
      return;
    }

    if (quoi === 'inscrire') {
      const pseudo = valeur('a-pseudo');
      authMail = valeur('a-mail');
      const mdp = $('#a-mdp') ? $('#a-mdp').value : '';
      if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(pseudo))
        throw new Error('Pseudo : 3 à 16 caractères, lettres, chiffres, point, tiret ou souligné.');
      if (!authMail.includes('@')) throw new Error('Il manque une adresse e-mail valide.');
      if (mdp.length < 8) throw new Error('Mot de passe : 8 caractères au minimum.');

      const r = await Backend.signUp(authMail, mdp, pseudo);
      if (r.confirmation) { authVue = 'confirme'; render(); }
      /* Sans confirmation exigée, onAuthStateChange recharge la page. */
      return;
    }

    if (quoi === 'entrer') {
      authMail = valeur('a-mail');
      const mdp = $('#a-mdp') ? $('#a-mdp').value : '';
      if (!authMail || !mdp) throw new Error('Adresse et mot de passe, s\'il te plaît.');
      await Backend.signIn(authMail, mdp);
      return;                             /* onAuthStateChange recharge la page */
    }

    if (quoi === 'oublier') {
      authMail = valeur('a-mail');
      if (!authMail.includes('@')) throw new Error('Il manque une adresse e-mail valide.');
      await Backend.resetPassword(authMail);
      toast('Lien envoyé. Regarde tes courriels.');
      return aller('connexion');
    }

    if (quoi === 'renvoyer') {
      await Backend.resendConfirmation(authMail);
      toast('Lien renvoyé.');
      return;
    }
  } catch (e) {
    authErr = e.message || 'Quelque chose a raté.';
    SFX.jouer('erreur');
    render();
  } finally {
    occupe(false);
  }
}

/* Repasser par la porte d'entrée depuis les Réglages. */
function ouvrirConnexion() {
  authVue = 'accueil';
  authErr = '';
  render();
}
