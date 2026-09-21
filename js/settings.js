/* Onglet Réglages : son, animations, compte, données.
   Le Labo n'apparaît jamais ici : il est réservé aux profils marqués
   administrateurs par le serveur (voir supabase/05_admin.sql). */
"use strict";

function vReglages() {
  const r = SFX.reglages;
  const enLigne = Backend.mode === 'cloud';

  const curseur = (id, label, val, on) =>
    `<div class="slider${on ? '' : ' off'}"><label for="${id}">${label}</label>
      <input id="${id}" type="range" min="0" max="100" value="${Math.round(val * 100)}" ${on ? '' : 'disabled'}>
      <output>${Math.round(val * 100)}</output></div>`;

  return `<div class="pagehead"><h1>Réglages</h1></div>

  <section class="panel">
    <h2>Son</h2>
    <label class="toggle"><span>Bruitages<small class="muted">Cartes, paquets, boutons</small></span>
      <input type="checkbox" id="set-sfx" ${r.sfx ? 'checked' : ''}></label>
    ${curseur('set-volsfx', 'Volume des bruitages', r.volSfx, r.sfx)}
    <label class="toggle"><span>Musique d'ambiance<small class="muted">Un fond sobre, en boucle</small></span>
      <input type="checkbox" id="set-mus" ${r.mus ? 'checked' : ''}></label>
    ${curseur('set-volmus', 'Volume de la musique', r.volMus, r.mus)}
  </section>

  <section class="panel">
    <h2>Affichage</h2>
    <label class="toggle"><span>Animations réduites<small class="muted">Moins de mouvement à l'écran</small></span>
      <input type="checkbox" id="set-rm" ${reglageRM() ? 'checked' : ''}></label>
    <p class="muted small">Si ton téléphone est déjà réglé sur « réduire les animations »,
      le jeu le respecte sans rien toucher ici.</p>
  </section>

  <section class="panel">
    <h2>Compte</h2>
    ${enLigne
      ? `<div class="found">${avatarHTML(save.avatar, save.frame, 'sm')}<b>${h(save.pseudo)}</b>
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
           écris-nous : la suppression se fait côté serveur.</p>`
      : `<p class="muted small">Remet les boosters et la collection au départ.
           Les cartes du jeu ne bougent pas.</p>
         <div class="row"><button class="btn ghost" data-act="reset">Réinitialiser ma progression</button></div>`}
  </section>

  <section class="panel about">
    <h2>À propos</h2>
    <p class="muted small">${h(GAME_NAME)} · extension « ${h(SET_NAME)} » · ${cards.length} cartes.
      Jeu de collection sans argent réel : les ${MONNAIE.nom} se gagnent en jouant.</p>
    <p class="muted small">Version ${APP_VERSION}${Backend.mode === 'cloud' ? ' · compte en ligne' : ' · hors ligne'}</p>
  </section>`;
}

/* ---------- Animations réduites ---------- */
/* Trois états : suivre le système (par défaut), ou forcer dans un sens. */
const RM_CLE = 'mtcg.rm';
const reglageRM = () => {
  try { return localStorage.getItem(RM_CLE) === '1'; } catch (e) { return false; }
};

function poserRM(v) {
  try { localStorage.setItem(RM_CLE, v ? '1' : '0'); } catch (e) { /* mode privé */ }
  document.documentElement.classList.toggle('rm', v);
}

/* Branche les réglages une fois la page dessinée. */
function bindReglages() {
  const b = (id, fn) => { const e = $('#' + id); if (e) fn(e); };

  b('set-sfx', e => e.onchange = () => {
    SFX.reglages.sfx = e.checked; SFX.appliquer(); SFX.jouer('tap'); render();
  });
  b('set-mus', e => e.onchange = () => {
    SFX.reglages.mus = e.checked; SFX.majMusique(); render();
  });
  b('set-volsfx', e => {
    e.oninput = () => { SFX.reglages.volSfx = e.value / 100; SFX.appliquer(); e.nextElementSibling.value = e.value; };
    e.onchange = () => SFX.jouer('carte');
  });
  b('set-volmus', e => {
    e.oninput = () => { SFX.reglages.volMus = e.value / 100; SFX.appliquer(); e.nextElementSibling.value = e.value; };
  });
  b('set-rm', e => e.onchange = () => { poserRM(e.checked); render(); });

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
