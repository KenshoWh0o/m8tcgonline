/* Onglet Réglages : jeu, affichage et son, compte, à propos (3.0.14).
   Le Labo n'apparaît jamais ici : il est réservé aux profils marqués
   administrateurs par le serveur (voir supabase/installation/05_admin.sql).

   Tous les réglages de cette page vivent dans le navigateur, pas sur le compte :
   ils décrivent cet appareil-ci — son écran, son haut-parleur, la patience de
   celui qui le tient. */
"use strict";

/* ---------- Apparence ---------- */
/* Un seul thème, sombre, depuis la version 2.0. On efface le choix qu'un
   ancien réglage aurait laissé dans ce navigateur. */
function oublierTheme() {
  try { localStorage.removeItem('mtcg.theme'); } catch (e) { /* mode privé */ }
  document.documentElement.removeAttribute('data-theme');
}

/* ---------- Animations réduites ---------- */
/* Deux états seulement : suivre le système (par défaut), ou forcer la réduction.
   Personne ne veut forcer *plus* d'animations que ce que son système demande. */
const RM_CLE = 'mtcg.rm';
const reglageRM = () => {
  try { return localStorage.getItem(RM_CLE) === '1'; } catch (e) { return false; }
};

function poserRM(v) {
  try { localStorage.setItem(RM_CLE, v ? '1' : '0'); } catch (e) { /* mode privé */ }
  document.documentElement.classList.toggle('rm', v);
}

/* ---------- Réglages de confort ---------- */
/* Des préférences de jeu, pas d'affichage : elles changent ce qui se passe à
   l'ouverture d'un booster et en combat. Rangées ensemble dans une seule clé,
   avec un seul écrivain (`sauverJeu`) : l'arène écrivait aussi `rapide` de son
   côté, et changer un réglage ici remettait l'ancienne vitesse de combat. */
const JEU_CLE = 'mtcg.jeu';
const JEU = {
  /* Passer directement au récap sans faire défiler les cartes une à une. */
  recapDirect: false,
  /* Faire vibrer le téléphone sur les révélations. */
  vibrer: true,
  /* Incliner les cartes avec le gyroscope pendant l'ouverture. */
  gyro: true,
  /* Les combats en accéléré (le bouton « Vitesse » de l'arène). */
  rapide: false,
  /* Version 3.0.14 : demander avant de finir un tour quand un Joueur peut
     encore attaquer (js/combat/table.js, confirmerFin). */
  confirmerFin: true
};

(function chargerJeu() {
  try {
    const v = JSON.parse(localStorage.getItem(JEU_CLE) || 'null');
    if (v && typeof v === 'object') Object.assign(JEU, v);
  } catch (e) { /* premier lancement */ }
})();

function sauverJeu() {
  try { localStorage.setItem(JEU_CLE, JSON.stringify(JEU)); } catch (e) { /* mode privé */ }
}

/* Une pulsation courte, si l'appareil sait le faire et si on l'a demandé. */
function vibrer(motif) {
  if (!JEU.vibrer || RM()) return;
  try { if (navigator.vibrate) navigator.vibrate(motif); } catch (e) { /* refusé */ }
}

/* ---------- L'écran ---------- */
/* Refait en 3.0.14 (le propriétaire : « fait vachement entassé, découpe le
   en section, et n'hésite pas à le repenser vu que beaucoup de choses ont
   changé ») : quatre sections — Jeu, Affichage, Compte, À propos —, une à la
   fois sur téléphone (des onglets en tête), une colonne de navigation sur
   ordinateur. Chaque réglage est une ligne : son icône, ce qu'il fait, son
   interrupteur ; une ligne entière se touche. Nouveau : les combats
   accélérés (jusque-là dans l'arène seulement), « Demander avant de finir
   un tour », le tutoriel, les règles, « Personnaliser mon profil », les
   nouveautés. */
let rgVue = 'jeu';
const RG_SECTIONS = [
  ['jeu', 'Jeu', 'sword'], ['affichage', 'Affichage', 'gear'], ['compte', 'Compte', 'user'], ['apropos', 'À propos', 'promo']
];
const RG_ICO = {
  recap: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="7" height="9.5" rx="1.5"/><rect x="13.5" y="5" width="7" height="9.5" rx="1.5"/><path d="M5 18.5h14"/></svg>',
  vibre: '<svg viewBox="0 0 24 24"><rect x="7.5" y="3.5" width="9" height="17" rx="2"/><path d="M4 9v6M20 9v6M11 17.5h2"/></svg>',
  gyro: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M20.5 4.5v4h-4"/><rect x="9" y="8" width="6" height="8" rx="1.2" transform="rotate(12 12 12)"/></svg>',
  vitesse: '<svg viewBox="0 0 24 24"><path d="M4.5 16a7.5 7.5 0 1 1 15 0"/><path d="m12 16 4-5.5"/><circle cx="12" cy="16" r="1.4"/></svg>',
  main: '<svg viewBox="0 0 24 24"><path d="M8 13.5V6a1.5 1.5 0 0 1 3 0v6M11 11V4.8a1.5 1.5 0 0 1 3 0V11M14 11V6.3a1.5 1.5 0 0 1 3 0v7.2c0 3.6-2.5 6.5-6 6.5-2.4 0-3.9-1.2-5.2-3.2L4.3 14a1.4 1.4 0 0 1 2.3-1.6L8 14"/></svg>',
  livre: '<svg viewBox="0 0 24 24"><path d="M4.5 5.5c2.6-1 5.2-1 7.5.8 2.3-1.8 4.9-1.8 7.5-.8v13c-2.6-1-5.2-1-7.5.8-2.3-1.8-4.9-1.8-7.5-.8Z"/><path d="M12 6.3v13"/></svg>',
  mouvement: '<svg viewBox="0 0 24 24"><path d="M3.5 12h4l2-5 4 10 2-5h5"/></svg>',
  son: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5l4.5 4V5.5L7.5 9.5Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  garder: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="10" height="14" rx="1.8"/><path d="M9 20h8.5A1.5 1.5 0 0 0 19 18.5V8"/></svg>',
  sortir: '<svg viewBox="0 0 24 24"><path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M10.5 12H20m-3.5-3.5L20 12l-3.5 3.5"/></svg>',
  courrier: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>',
  install: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M12 7.5v7m-3-3 3 3 3-3"/></svg>',
  neuf: '<svg viewBox="0 0 24 24"><path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9Z"/></svg>'
};

function vReglages() {
  const r = SFX.reglages;
  const enLigne = Backend.mode === 'cloud';
  if (!RG_SECTIONS.some(([k]) => k === rgVue)) rgVue = 'jeu';

  /* Une ligne : toute la ligne se touche pour basculer. */
  const bascule = (id, ico, titre, sous, on) =>
    `<label class="rg-l" for="${id}"><span class="rg-ico" aria-hidden="true">${RG_ICO[ico] || NAVICO[ico] || ''}</span>
      <span class="rg-tx"><b>${titre}</b>${sous ? `<small>${sous}</small>` : ''}</span>
      <input type="checkbox" class="rg-sw" role="switch" id="${id}" ${on ? 'checked' : ''}></label>`;
  const bouton = (attrs, ico, titre, sous, fin) =>
    `<button class="rg-l rg-b" ${attrs}><span class="rg-ico" aria-hidden="true">${RG_ICO[ico] || NAVICO[ico] || ''}</span>
      <span class="rg-tx"><b>${titre}</b>${sous ? `<small>${sous}</small>` : ''}</span>${fin || `<i class="rg-chev" aria-hidden="true">${NAVICO.caret}</i>`}</button>`;
  const groupe = (titre, lignes, note) => `<section class="rg-g">${titre ? `<h3>${titre}</h3>` : ''}<div class="rg-c">${lignes}</div>${note ? `<p class="rg-note">${note}</p>` : ''}</section>`;

  let corps = '';
  if (rgVue === 'jeu') {
    corps = groupe('Ouverture des boosters',
      bascule('set-recap', 'recap', 'Aller droit au récap', 'Sans faire défiler les cartes une à une', JEU.recapDirect)
      + bascule('set-vibrer', 'vibre', 'Vibrations', 'Une pulsation sur les révélations', JEU.vibrer)
      + bascule('set-gyro', 'gyro', 'Incliner avec le téléphone', 'Les cartes suivent le mouvement de l\'appareil', JEU.gyro))
    + groupe('Combats',
      bascule('set-rapide', 'vitesse', 'Combats accélérés', 'Les animations de l\'arène deux fois plus vite', JEU.rapide)
      + bascule('set-confirmer', 'main', 'Demander avant de finir un tour', 'Quand un de tes Joueurs peut encore attaquer', JEU.confirmerFin !== false)
      + bouton('data-cb="tuto"', 'sword', 'Rejouer le tutoriel', 'Une partie guidée de cinq tours')
      + bouton('data-tab="combats" data-cbv="guides"', 'livre', 'Les règles', 'Le guide des combats, et son glossaire'))
    + (enLigne ? vGarderReglage() : '');
  } else if (rgVue === 'affichage') {
    corps = groupe('Mouvement',
      bascule('set-rm', 'mouvement', 'Animations réduites', 'Moins de mouvement à l\'écran', reglageRM()),
      'Si ton appareil est déjà réglé sur « réduire les animations », le jeu le respecte sans rien toucher ici.')
    + groupe('Son',
      bascule('set-sfx', 'son', 'Bruitages', 'Cartes, paquets, boutons', r.sfx)
      + `<div class="rg-l rg-curseur${r.sfx ? '' : ' off'}"><span class="rg-ico" aria-hidden="true"></span>
          <div class="slider${r.sfx ? '' : ' off'}" style="--pct:${Math.round(r.volSfx * 100)}%">
            <label for="set-volsfx">Volume</label>
            <input id="set-volsfx" type="range" min="0" max="100" value="${Math.round(r.volSfx * 100)}" ${r.sfx ? '' : 'disabled'}>
            <output>${Math.round(r.volSfx * 100)}</output></div></div>`
      + bouton('data-act="son-test"', 'son', 'Tester le son', 'Trois notes, et ce qu\'en dit le navigateur'),
      'Sur iPhone, l\'interrupteur « silencieux » coupe aussi le son des sites.');
  } else if (rgVue === 'compte') {
    corps = enLigne
      ? `<section class="rg-g"><div class="rg-c rg-moi">
            ${avatarHTML(save.avatar, save.frame, 'md', maPhoto(), monXp())}
            <span class="rg-tx"><b>${h(save.pseudo)}</b><small><i class="rg-ok"></i>${DEMO ? 'Démo · ta partie reste sur cet appareil' : 'En ligne · ta progression vit sur le serveur'}</small></span>
          </div></section>`
        + groupe('', bouton('data-act="pf-perso"', 'user', 'Personnaliser mon profil', 'Avatar, cadre, titre, bannière, devise')
          + bouton('data-tab="profil"', 'user', 'Voir mon profil', 'Ce que les autres voient de toi'))
        /* La démo de Gentle Mates (DEMO) : pas de déconnexion, et « repartir
           de zéro » relance une partie neuve (?reinitialiser, _demo/serveur.js). */
        + (DEMO
          ? groupe('Données', `<a class="rg-l rg-b" href="?reinitialiser"><span class="rg-ico" aria-hidden="true">${RG_ICO.sortir}</span>
              <span class="rg-tx"><b>Recommencer la démo</b><small>Une partie neuve : collection vide, joueurs simulés remis à zéro</small></span></a>`)
          : groupe('', bouton('data-act="deconnexion"', 'sortir', 'Se déconnecter', 'Ta collection reste sur ton compte', ''))
            + groupe('Données', `<a class="rg-l rg-b" href="mailto:${h(CONTACT)}"><span class="rg-ico" aria-hidden="true">${RG_ICO.courrier}</span>
              <span class="rg-tx"><b>Repartir de zéro ou supprimer mon compte</b><small>Écris-nous : ${h(CONTACT)}</small></span></a>`))
      : groupe('Compte', Backend.dispo
          ? bouton('data-act="connexion"', 'user', CONNEXION.email ? 'Créer un compte ou se connecter' : 'Se connecter avec Discord', 'Échanges, quêtes et boutique demandent un compte')
          : `<div class="rg-l"><span class="rg-tx"><b>Hors ligne</b><small>Le serveur n'est pas encore branché sur ce site : la progression reste dans ce navigateur.</small></span></div>`)
        + groupe('Données', bouton('data-act="reset"', 'sortir', 'Réinitialiser ma progression', 'Les boosters et la collection reviennent au départ', ''));
  } else {
    corps = groupe('Le jeu', DEMO
      ? bouton('data-act="presentation"', 'neuf', 'La présentation', 'Le jeu en sept écrans')
      : bouton('data-act="installer"', 'install', 'Installer le jeu', 'Sur l\'écran d\'accueil, en plein écran, comme une application')
      + bouton('data-act="nouveautes"', 'neuf', 'Les nouveautés', 'Ce qui a changé avec cette version')
      + `<a class="rg-l rg-b" href="${h(DISCORD_URL)}" target="_blank" rel="noopener"><span class="rg-ico" aria-hidden="true">${ICON.discord}</span>
          <span class="rg-tx"><b>Le Discord</b><small>L'actualité, l'entraide, les échanges</small></span><i class="rg-chev" aria-hidden="true">${NAVICO.caret}</i></a>`)
    + `<section class="rg-g rg-apropos"><h3>À propos</h3><div class="rg-c">
        <div class="rg-l"><span class="rg-tx"><b>${h(GAME_NAME)}</b><small>Jeu de collection sans argent réel : les ${MONNAIE.nom} se gagnent en jouant.</small></span>${DEMO ? '' : `<span class="rg-val tnum" title="Version">v${APP_VERSION}</span>`}</div>
      </div><p class="mentions">${MENTIONS}</p></section>`;
  }

  return `<div class="pagehead"><div><h1>Réglages</h1></div></div>
    <div class="rg">
      <nav class="rg-nav" role="tablist" aria-label="Sections des réglages">${RG_SECTIONS.map(([k, nom, ico]) =>
        `<button role="tab" aria-selected="${rgVue === k}" class="${rgVue === k ? 'on' : ''}" data-rgv="${k}"><span aria-hidden="true">${NAVICO[ico]}</span>${nom}</button>`).join('')}</nav>
      <div class="rg-corps" role="tabpanel">${corps}</div>
    </div>`;
}

/* ---------- Exemplaires à garder (version 2.1) ---------- */
/* Le seul réglage de cette page qui vit sur le compte et pas dans le
   navigateur : le serveur s'en sert pour le recyclage et pour ce que voient
   les amis (supabase/installation/22_garder.sql). Par rareté ici ; carte par carte, dans
   la visionneuse (js/viewer.js). */
function vGarderReglage() {
  const g = save.garder || {};
  const perso = Object.keys(save.gardes || {}).length;
  /* Une ligne par rareté ; les Reverses à part (clé « r » + rareté), et
     seulement les raretés qu'elles ont. */
  const ligne = (cle, rar, rev) => `<div class="garde-ligne">
      <span class="garde-rar"><i class="rardot r${rar}"></i>${(RAR[rar] || RAR.C).nom}</span>
      <div class="segbar garde-seg">${[1, 2, 3, 4].map(n =>
        `<button data-gdef="${cle}" data-n="${n}" class="${(g[cle] || 1) === n ? 'on' : ''}"
          aria-label="${(RAR[rar] || RAR.C).nom}${rev ? ' Reverse' : ''} : garder ${n}">${n}</button>`).join('')}</div>
    </div>`;
  const revRars = RAR_FILTRES.filter(r => reverses.some(c => c.rar === r));
  return `<section class="rg-g" id="reglages-garder"><h3>Collection · exemplaires à garder</h3>
    <div class="rg-c rg-garder">
      <p class="rg-dit">Combien d'exemplaires de chaque carte tu veux conserver. Le recyclage n'y
        touche pas, et tes amis ne les voient pas comme des doublons.</p>
      <h4 class="garde-groupe">Classiques</h4>
      <div class="gardes">${RAR_FILTRES.map(r => ligne(r, r, false)).join('')}</div>
      ${revRars.length ? `<h4 class="garde-groupe">Reverses<i class="revico"></i></h4>
      <div class="gardes">${revRars.map(r => ligne('r' + r, r, true)).join('')}</div>` : ''}
    </div>
    <p class="rg-note">Pour une carte en particulier, touche-la dans ta Collection.${perso
      ? ` ${perso} carte${perso > 1 ? 's ont leur' : ' a son'} propre réglage.` : ''}</p>
  </section>`;
}

async function reglerGardeDefaut(cle, n) {
  if (((save.garder || {})[cle] || 1) === n) return;
  const g = Object.assign({}, save.garder || {}, { [cle]: n });
  const rev = cle[0] === 'r';
  const nom = (RAR[rev ? cle.slice(1) : cle] || RAR.C).nom + (rev ? ' Reverse' : '');
  await agir(() => Backend.reglerGardeDefaut(g),
    `${nom} : ${n === 1 ? 'un exemplaire gardé' : `${n} exemplaires gardés`}.`);
}

/* Depuis le Recyclage : la page, et la section. */
function versGarder() {
  rgVue = 'jeu';
  aller('reglages');
  requestAnimationFrame(() => {
    const el = $('#reglages-garder');
    if (el) el.scrollIntoView({ block: 'start', behavior: RM() ? 'auto' : 'smooth' });
  });
}

/* ---------- Branchements ---------- */
/* Rejoué après chaque rendu : les nœuds viennent d'être recréés, les anciens
   écouteurs sont partis avec eux. */
function bindReglages() {
  const b = (id, fn) => { const e = $('#' + id); if (e) fn(e); };

  /* Un curseur dessine lui-même sa partie remplie : `--pct` suit la valeur. */
  const suivre = (e, poser) => {
    const maj = () => {
      e.closest('.slider').style.setProperty('--pct', e.value + '%');
      e.nextElementSibling.value = e.value;
      poser(e.value / 100);
    };
    e.oninput = maj;
  };

  b('set-sfx', e => e.onchange = () => {
    SFX.reglages.sfx = e.checked;
    SFX.appliquer();
    if (e.checked) SFX.jouer('tap');
    render();
  });
  b('set-volsfx', e => {
    suivre(e, v => { SFX.reglages.volSfx = v; SFX.appliquer(); });
    e.onchange = () => SFX.jouer('carte');
  });

  b('set-rm', e => e.onchange = () => { poserRM(e.checked); render(); });

  b('set-recap', e => e.onchange = () => { JEU.recapDirect = e.checked; sauverJeu(); });
  b('set-vibrer', e => e.onchange = () => {
    JEU.vibrer = e.checked; sauverJeu();
    if (e.checked) vibrer(18);
  });
  b('set-gyro', e => e.onchange = () => { JEU.gyro = e.checked; sauverJeu(); });
  b('set-rapide', e => e.onchange = () => { JEU.rapide = e.checked; sauverJeu(); });
  b('set-confirmer', e => e.onchange = () => { JEU.confirmerFin = e.checked; sauverJeu(); });

  /* Collection : la case « seulement mes cartes ». */
  b('col-poss', e => e.onchange = () => { colPossedees = e.checked; render(); });
  b('col-obj', e => e.onchange = () => { colObjectifs = e.checked; render(); });
  b('col-fav', e => e.onchange = () => { colFavoris = e.checked; render(); });

  b('pf-pseudo', e => e.onkeydown = ev => { if (ev.key === 'Enter') changerPseudo(); });
  b('tr-pseudo', e => {
    e.oninput = () => { trBrouillon.pseudo = e.value; };
    e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); trChercher(); } };
  });
  b('tr-note', e => e.oninput = () => { trBrouillon.note = e.value; });
  b('soc-pseudo', e => {
    e.oninput = () => { socRecherche = e.value; };
    e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); socAjouter(); } };
  });

}

async function changerPseudo() {
  const p = valeur('pf-pseudo');
  if (!p || p === save.pseudo) return;
  await agir(() => Backend.setProfile({ p_pseudo: p }), 'Pseudo mis à jour.');
}

/* Un petit essai audible : c'est la réponse la plus courte à « je n'ai pas de son ». */
function testerSon() {
  SFX.reglages.sfx = true;
  SFX.appliquer();
  SFX.reveiller();
  SFX.jouer('carte');
  setTimeout(() => SFX.jouer('piece'), 220);
  setTimeout(() => SFX.jouer('gagne'), 460);
  setTimeout(() => {
    toast(SFX.audible() ? 'Le son fonctionne.' : "Le navigateur refuse le son : vérifie le volume et le mode silencieux.");
    render();
  }, 900);
}
