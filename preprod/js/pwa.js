/* Installation sur l'écran d'accueil.
   Sur Android, le navigateur propose lui-même l'installation : on récupère sa
   demande et on la déclenche au bon moment. Sur iPhone, rien de tel n'existe —
   il faut passer par le bouton Partager de Safari — alors on dessine la
   marche à suivre, une seule fois, et seulement après quelques minutes de jeu. */
"use strict";

const APP_VERSION = '3.0.6';

const PWA = { invite: null, installe: false, dejaVu: false };
const PWA_CLE = 'mtcg.install';

/* Le jeu tourne-t-il déjà depuis l'écran d'accueil ? */
const enApp = () => matchMedia('(display-mode: standalone)').matches
  || matchMedia('(display-mode: fullscreen)').matches
  || navigator.standalone === true;

const estIOS = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   /* iPad récent */
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return ios && safari;
};

function memoire() {
  try { return JSON.parse(localStorage.getItem(PWA_CLE) || '{}'); } catch (e) { return {}; }
}
function noterMemoire(v) {
  try { localStorage.setItem(PWA_CLE, JSON.stringify(Object.assign(memoire(), v))); }
  catch (e) { /* mode privé */ }
}

/* Android et bureau : le navigateur nous confie sa proposition d'installation. */
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  PWA.invite = e;
  majBoutonInstall();
});

addEventListener('appinstalled', () => {
  PWA.invite = null;
  PWA.installe = true;
  noterMemoire({ fait: true });
  fermerInstall();
  toast('Mate TCG est sur ton écran d\'accueil.');
});

/* ---------- La bulle ---------- */
const ICO_PARTAGE = '<svg viewBox="0 0 24 24" class="iosico" aria-hidden="true"><path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H4.8A1.8 1.8 0 0 0 3 12.8v6.4A1.8 1.8 0 0 0 4.8 21h14.4a1.8 1.8 0 0 0 1.8-1.8v-6.4A1.8 1.8 0 0 0 19.2 11H18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>';
const ICO_PLUS = '<svg viewBox="0 0 24 24" class="iosico" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

function corpsInstall() {
  if (estIOS()) {
    return `<p class="muted">Deux gestes, et le jeu s'ouvre en plein écran comme une application —
        sans barre d'adresse, avec son icône.</p>
      <ol class="iossteps">
        <li>${ICO_PARTAGE}<span>Touche <b>Partager</b>, en bas de Safari.</span></li>
        <li>${ICO_PLUS}<span>Fais défiler, puis choisis <b>Sur l'écran d'accueil</b>.</span></li>
        <li><span class="iosnum">✓</span><span>Touche <b>Ajouter</b>. C'est fini.</span></li>
      </ol>
      <div class="iosarrow" aria-hidden="true">▾</div>`;
  }
  if (PWA.invite) {
    return `<p class="muted">Installe Mate TCG pour l'ouvrir d'un geste, en plein écran,
      même sans réseau pour revoir ta collection.</p>`;
  }
  return `<p class="muted">Dans le menu de ton navigateur, cherche
      <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>.</p>`;
}

function ouvrirInstall(force) {
  if (enApp()) { if (force) toast('Le jeu est déjà installé.'); return; }

  const actions = [];
  if (PWA.invite) {
    actions.push({ label: 'Installer', primary: true, fn: async () => {
      const inv = PWA.invite;
      PWA.invite = null;
      closeSheet();
      inv.prompt();
      const r = await inv.userChoice;
      noterMemoire(r.outcome === 'accepted' ? { fait: true } : { refuse: Date.now() });
    }});
  }
  actions.push({ label: PWA.invite ? 'Plus tard' : 'J\'ai compris', fn: () => {
    noterMemoire({ refuse: Date.now() });
    closeSheet();
  }});

  openSheet({ title: 'Ajouter à l\'écran d\'accueil', body: corpsInstall(), actions });
  document.body.classList.add('installsheet');
}

function fermerInstall() {
  document.body.classList.remove('installsheet');
  closeSheet();
}

function majBoutonInstall() {
  const b = $('#btn-install');
  if (b) b.hidden = enApp() || (!PWA.invite && !estIOS());
}

/* ---------- Quand proposer ---------- */
/* Jamais au premier écran : on attend que la personne ait ouvert un booster,
   et on ne redemande pas avant deux semaines si elle a dit non. */
function peutProposer() {
  if (enApp()) return false;
  const m = memoire();
  if (m.fait) return false;
  if (m.refuse && Date.now() - m.refuse < 14 * 864e5) return false;
  if (!PWA.invite && !estIOS()) return false;
  return (m.paquets || 0) >= 2;
}

function noterPaquetOuvert() {
  const m = memoire();
  noterMemoire({ paquets: (m.paquets || 0) + 1 });
  /* `quandCalme` (js/bienvenue.js) attend que l'écran soit rendu au joueur et
     n'autorise qu'une proposition par session — sans quoi la bienvenue, le
     Discord et l'installation pourraient se succéder au même moment, juste
     après la déchirure d'un paquet. */
  if (peutProposer() && !PWA.dejaVu) {
    PWA.dejaVu = true;
    quandCalme(ouvrirInstall);
  }
}

/* ---------- Service worker ---------- */
/* Il met le jeu en cache pour qu'il s'ouvre hors réseau. Quand une nouvelle
   version est en ligne, on prévient au lieu de recharger sous les doigts. */
function brancherSW() {
  return; /* pre-prod : pas de service worker (tools/demo.py) */
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;   /* ouvert par double-clic */

  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            openSheet({
              title: 'Nouvelle version',
              body: '<p class="muted">Une mise à jour du jeu est prête.</p>',
              actions: [
                { label: 'Recharger', primary: true, fn: () => { sw.postMessage('skip'); location.reload(); } },
                { label: 'Plus tard', fn: closeSheet }
              ]
            });
          }
        });
      });
    } catch (e) {
      /* Pas de cache hors ligne : le jeu marche quand même. */
    }
  });
}
