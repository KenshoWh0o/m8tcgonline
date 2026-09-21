/* Écran de connexion : création de compte par adresse e-mail (avec confirmation)
   ou par Discord. Tant qu'on n'est pas connecté, on peut aussi jouer hors ligne :
   la progression reste alors dans ce navigateur, sans échanges ni quêtes. */
"use strict";

/* 'accueil' | 'inscription' | 'connexion' | 'oubli' | 'confirme' */
let authVue = 'accueil';
/* Les écrans liés à l'adresse e-mail n'existent que si cette voie est ouverte. */
const VUES_EMAIL = ['inscription', 'connexion', 'oubli', 'confirme'];
let authMail = '';
let authErr = '';

const HORSLIGNE_CLE = 'mtcg.horsligne';
const veutHorsLigne = () => { try { return localStorage.getItem(HORSLIGNE_CLE) === '1'; } catch (e) { return false; } };
const noterHorsLigne = v => { try { localStorage.setItem(HORSLIGNE_CLE, v ? '1' : '0'); } catch (e) { /* mode privé */ } };

/* On montre la porte d'entrée si un compte est possible, qu'on n'en a pas,
   et qu'on n'a pas déjà choisi de jouer sans. */
const porteVisible = () => Backend.dispo && Backend.mode !== 'cloud' && !veutHorsLigne();

const DISCORD_ICO = '<svg viewBox="0 0 24 18" aria-hidden="true" fill="currentColor"><path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a14 14 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A13.6 13.6 0 0 0 8.6.1 19.7 19.7 0 0 0 3.7 1.6C.6 6.2-.3 10.7.2 15.1a19.9 19.9 0 0 0 6 3 14.7 14.7 0 0 0 1.3-2.1 13 13 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4a13 13 0 0 1-2 1 14.5 14.5 0 0 0 1.3 2.1 19.8 19.8 0 0 0 6-3c.6-5.1-.9-9.6-3.6-13.5ZM8.0 12.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 7.6 8 7.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>';

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
      <div class="authacts">
        ${CONNEXION.discord
          ? `<button class="btn discord" data-auth="discord">${DISCORD_ICO} Continuer avec Discord</button>`
          : ''}
        ${CONNEXION.email
          ? `<button class="btn ${CONNEXION.discord ? 'ghost' : ''}" data-auth="vers-inscription">Créer un compte avec une adresse</button>
             <button class="linkbtn" data-auth="vers-connexion">J'ai déjà un compte</button>`
          : ''}
      </div>
      <div class="authsep"><span>ou</span></div>
      <button class="linkbtn" data-auth="hors-ligne">Jouer sans compte sur cet appareil</button>
      <p class="muted small">Sans compte, la progression est temporaire et l'accès
        aux fonctionnalités est restreint.</p>`;
  }

  return `<div class="authwrap"><div class="authcard">
    <img class="authlogo" src="${ART.logo}" alt="${h(GAME_NAME)}">
    ${corps}
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
  if (quoi === 'hors-ligne') {
    noterHorsLigne(true);
    toast('Tu joues hors ligne. Tu pourras créer un compte plus tard dans les Réglages.');
    return render();
  }

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
  noterHorsLigne(false);
  authVue = 'accueil';
  authErr = '';
  render();
}
