/* Écran d'attente : le site est en ligne, mais fermé au public tant que tu ne
   décides pas de l'ouvrir. Un code donne accès au vrai jeu.

   Ce que ça fait : personne n'arrive par hasard sur le jeu, et le lien peut
   circuler sans tout dévoiler.
   Ce que ça ne fait pas : empêcher quelqu'un de décidé d'aller lire le code de
   la page et de passer outre. Les fichiers du site restent téléchargeables —
   c'est le propre d'un site statique. Ce qui est vraiment protégé, ce sont les
   comptes et les collections : eux vivent sur le serveur, derrière ses règles.

   Pour ouvrir le site à tout le monde : passer PORTE.active à false. */
"use strict";

const PORTE = {
  active: true,

  /* Le code n'est pas écrit ici : seule son empreinte l'est. Quelqu'un qui lit
     la page ne le trouve donc pas en clair. Changer de code : relancer
     `python3 tools/code-porte.py <nouveau code>` et recopier la ligne obtenue. */
  empreinte: '1715c7a5d31d9cb8863741b07a2d349c03b3f5b6c0352c9a2cac8fc681e78506',
  sel: 'mtcg.v2.porte:',

  /* Date d'ouverture, au format ISO avec le décalage horaire — par exemple
     '2026-10-15T18:00:00+02:00'. Tant que c'est null, aucun compte à rebours
     n'est affiché : on annonce seulement « bientôt ». */
  lancement: null
};

const PORTE_CLE = 'mtcg.acces';

const porteOuverte = () => {
  if (!PORTE.active) return true;
  try { return localStorage.getItem(PORTE_CLE) === PORTE.empreinte; }
  catch (e) { return false; }
};

let porteErr = '';
let porteMinuteur = null;

/* ---------- Empreinte ---------- */
/* SHA-256 quand le navigateur le propose (HTTPS ou localhost), sinon on le dit
   plutôt que de faire semblant avec un calcul qui n'en a que le nom. */
async function porteEmpreinte(code) {
  if (!crypto || !crypto.subtle) return null;
  const octets = new TextEncoder().encode(PORTE.sel + code);
  const somme = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(somme)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- L'écran ---------- */
function vPorte() {
  return `<div class="lockwrap"><div class="lockcard">
    <img class="locklogo" src="${ART.logo}" alt="${h(GAME_NAME)}">

    <div class="lockart" aria-hidden="true">
      <div class="lockglow"></div>
      <img class="lockpack" src="${packArt}" alt="">
      <div class="lockshadow"></div>
    </div>

    <span class="locktag">Bientôt disponible</span>
    <h1 class="locktitle">Coming soon</h1>
    <p class="muted lockdit">L'extension <b>${h(SET_NAME)}</b> et ses ${cards.length} cartes
      arrivent bientôt. Boosters, collections, échanges,…</p>

    <div id="lockcompte">${vCompteARebours()}</div>

    <details class="lockcode" ${porteErr ? 'open' : ''}>
      <summary>J'ai un code d'accès</summary>
      ${porteErr ? `<p class="autherr">${h(porteErr)}</p>` : ''}
      <div class="findrow">
        <input id="lock-code" type="text" inputmode="text" autocomplete="off"
          autocapitalize="off" spellcheck="false" placeholder="Code" maxlength="32">
        <button class="btn tiny" data-act="porte-ok">Entrer</button>
      </div>
    </details>

    <p class="mentions">${MENTIONS}</p>
  </div></div>`;
}

/* Compte à rebours, seulement si une date d'ouverture est fixée. */
function vCompteARebours() {
  if (!PORTE.lancement) return '';
  const reste = Date.parse(PORTE.lancement) - Date.now();
  if (isNaN(reste)) return '';
  if (reste <= 0) return '<p class="lockpret">C\'est ouvert. Recharge la page.</p>';

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

/* ---------- Ouvrir ---------- */
async function porteEssayer() {
  const champ = $('#lock-code');
  const code = champ ? champ.value.trim() : '';
  porteErr = '';
  if (!code) return;

  occupe(true);
  try {
    const e = await porteEmpreinte(code);
    if (e === null) {
      porteErr = "Ce navigateur ne peut pas vérifier le code en connexion non sécurisée. Ouvre le site en https.";
    } else if (e === PORTE.empreinte) {
      try { localStorage.setItem(PORTE_CLE, e); } catch (err) { /* mode privé */ }
      SFX.jouer('gagne');
      toast('Bienvenue.');
      return location.reload();
    } else {
      porteErr = 'Ce code ne correspond pas.';
      SFX.jouer('erreur');
    }
  } catch (err) {
    porteErr = 'La vérification a échoué. Réessaie.';
  } finally {
    occupe(false);
    render();
  }
}

/* Le compte à rebours bat sans redessiner toute la page. */
function bindPorte() {
  clearInterval(porteMinuteur);
  const champ = $('#lock-code');
  if (champ) {
    champ.focus();
    champ.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); porteEssayer(); } };
  }
  if (!PORTE.lancement) return;
  porteMinuteur = setInterval(() => {
    const c = $('#lockcompte');
    if (!c) return clearInterval(porteMinuteur);
    c.innerHTML = vCompteARebours();
  }, 1000);
}
