/* Onglet Réglages : apparence, son, jeu, compte, données.
   Le Labo n'apparaît jamais ici : il est réservé aux profils marqués
   administrateurs par le serveur (voir supabase/05_admin.sql).

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
   l'ouverture d'un booster. Rangées ensemble dans une seule clé. */
const JEU_CLE = 'mtcg.jeu';
const JEU = {
  /* Passer directement au récap sans faire défiler les cartes une à une. */
  recapDirect: false,
  /* Faire vibrer le téléphone sur les révélations. */
  vibrer: true,
  /* Incliner les cartes avec le gyroscope pendant l'ouverture. */
  gyro: true
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
function vReglages() {
  const r = SFX.reglages;
  const enLigne = Backend.mode === 'cloud';

  const curseur = (id, label, val, on) =>
    `<div class="slider${on ? '' : ' off'}" style="--pct:${Math.round(val * 100)}%">
      <label for="${id}">${label}</label>
      <input id="${id}" type="range" min="0" max="100" value="${Math.round(val * 100)}" ${on ? '' : 'disabled'}>
      <output>${Math.round(val * 100)}</output></div>`;

  const bascule = (id, titre, sous, on) =>
    `<label class="toggle"><span>${titre}<small>${sous}</small></span>
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;

  return `<div class="pagehead"><div><h1>Réglages</h1></div></div>

  <section class="panel">
    <h2>Apparence</h2>
    ${bascule('set-rm', 'Animations réduites', 'Moins de mouvement à l\'écran', reglageRM())}
    <p class="muted small">Si ton appareil est déjà réglé sur « réduire les animations »,
      le jeu le respecte sans rien toucher ici.</p>
  </section>

  <section class="panel">
    <h2>Son</h2>
    ${bascule('set-sfx', 'Bruitages', 'Cartes, paquets, boutons', r.sfx)}
    ${curseur('set-volsfx', 'Volume', r.volSfx, r.sfx)}
    <div class="row"><button class="btn ghost tiny" data-act="son-test">Tester le son</button></div>
    <p class="muted small" style="margin-top:10px">Sur iPhone, le petit interrupteur
      « silencieux » sur la tranche coupe aussi le son des sites : si tu n'entends rien,
      c'est la première chose à vérifier.</p>
  </section>

  <section class="panel">
    <h2>Ouverture des boosters</h2>
    ${bascule('set-recap', 'Aller droit au récap', 'Sans faire défiler les cartes une à une', JEU.recapDirect)}
    ${bascule('set-vibrer', 'Vibrations', 'Une pulsation sur les révélations', JEU.vibrer)}
    ${bascule('set-gyro', 'Incliner avec le téléphone', 'Les cartes suivent le mouvement de l\'appareil', JEU.gyro)}
  </section>

  ${enLigne ? vGarderReglage() : ''}

  <section class="panel">
    <h2>Compte</h2>
    ${enLigne
      ? `<div class="found">${avatarHTML(save.avatar, save.frame, 'sm', maPhoto())}<b>${h(save.pseudo)}</b>
           <span class="qtag ok">En ligne</span></div>
         <p class="muted small">Ta progression est enregistrée sur le serveur :
           tu la retrouves sur n'importe quel appareil.</p>
         <div class="row" style="margin-top:12px">
           <button class="btn ghost" data-act="deconnexion">Se déconnecter</button>
         </div>`
      : Backend.dispo
        ? `<p class="muted small">Tu joues hors ligne : la progression reste dans ce navigateur
             et disparaît si tu effaces tes données. Les échanges, quêtes et la boutique
             demandent un compte.</p>
           <div class="row" style="margin-top:12px">
             <button class="btn" data-act="connexion">${CONNEXION.email
               ? 'Créer un compte ou se connecter' : 'Se connecter avec Discord'}</button>
           </div>`
        : `<p class="muted small">Le serveur n'est pas encore branché sur ce site.
             La progression reste dans ce navigateur.</p>`}
  </section>

  <section class="panel">
    <h2>Communauté</h2>
    <p class="muted small">L'actualité du jeu, l'entraide et les échanges : la
      communauté se retrouve sur le Discord.</p>
    <div class="row" style="margin-top:12px">
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}
    </div>
  </section>

  <section class="panel">
    <h2>Installer le jeu</h2>
    <p class="muted small">Ajouté à l'écran d'accueil, Mate TCG s'ouvre en plein écran,
      sans barre de navigateur, comme une vraie application.</p>
    <div class="row" style="margin-top:12px">
      <button class="btn ghost" data-act="installer">Comment faire ?</button>
    </div>
  </section>

  <section class="panel">
    <h2>Données</h2>
    ${enLigne
      ? `<p class="muted small">Pour repartir de zéro ou supprimer ton compte,
           écris-nous : <a href="mailto:${CONTACT}">${CONTACT}</a></p>`
      : `<p class="muted small">Remet les boosters et la collection au départ.
           Les cartes du jeu ne bougent pas.</p>
         <div class="row"><button class="btn ghost" data-act="reset">Réinitialiser ma progression</button></div>`}
  </section>

  <section class="panel about">
    <h2>À propos</h2>
    <p class="muted small">${h(GAME_NAME)} — Jeu de collection sans argent réel :
      les ${MONNAIE.nom} se gagnent en jouant.</p>
    <p class="muted small">Version ${APP_VERSION}</p>
    <p class="mentions">${MENTIONS}</p>
  </section>`;
}

/* ---------- Exemplaires à garder (version 2.1) ---------- */
/* Le seul réglage de cette page qui vit sur le compte et pas dans le
   navigateur : le serveur s'en sert pour le recyclage et pour ce que voient
   les amis (supabase/22_garder.sql). Par rareté ici ; carte par carte, dans
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
  return `<section class="panel" id="reglages-garder">
    <h2>Exemplaires à garder</h2>
    <p class="muted small">Combien d'exemplaires de chaque carte tu veux conserver. Le recyclage n'y
      touche pas, et tes amis ne les voient pas comme des doublons.</p>
    <h3 class="garde-groupe">Classiques</h3>
    <div class="gardes">${RAR_FILTRES.map(r => ligne(r, r, false)).join('')}</div>
    ${revRars.length ? `<h3 class="garde-groupe">Reverses<i class="revico"></i></h3>
    <div class="gardes">${revRars.map(r => ligne('r' + r, r, true)).join('')}</div>` : ''}
    <p class="muted small">Pour une carte en particulier, touche-la dans ta Collection.${perso
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

  const u = $('#unl');
  if (u) u.onchange = () => { save.unlimited = u.checked; persist(); header(); };
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
