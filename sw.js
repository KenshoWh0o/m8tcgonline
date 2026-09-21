/* Service worker : le jeu s'ouvre hors réseau et démarre instantanément.
   Deux régimes, selon ce que le fichier risque de devenir :
     - le code (html, css, js) part d'abord au réseau, pour que les corrections
       arrivent sans attendre, avec le cache comme filet ;
     - les images de cartes et l'habillage ne changent jamais sans changer de
       nom : on les sert depuis le cache, sans même contacter le serveur.
   Rien de ce qui touche au compte n'est mis en cache. */
"use strict";

const VERSION = 'mtcg-v2.3.0';
const COQUILLE = VERSION + '-coquille';
const MEDIAS = VERSION + '-medias';

/* Le strict nécessaire pour afficher quelque chose sans réseau. */
const ESSENTIEL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/cards.css', 'css/booster.css',
  'css/opening.css', 'css/viewer.css', 'css/lab.css', 'css/auth.css', 'css/hub.css',
  'js/config.js', 'js/supabase-config.js', 'js/utils.js', 'js/sfx.js', 'js/cards-data.js',
  'js/cards.js', 'js/storage.js', 'js/render-card.js', 'js/ui.js', 'js/backend.js',
  'js/gate.js', 'js/auth.js', 'js/fx.js', 'js/booster.js', 'js/opening.js', 'js/collection.js',
  'js/viewer.js', 'js/trade.js', 'js/social.js', 'js/quests.js', 'js/shop.js', 'js/battle.js',
  'js/profile.js', 'js/settings.js', 'js/pwa.js', 'js/lab.js', 'js/app.js',
  'assets/logo-m8.webp', 'assets/card-back.webp', 'assets/pack-star.svg',
  'assets/star-pink.svg', 'assets/extension-logo.svg', 'assets/1st-edition.svg',
  'assets/icon-192.png', 'assets/apple-touch-icon.png', 'assets/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(COQUILLE);
    /* Un fichier manquant ne doit pas faire échouer toute l'installation. */
    await Promise.all(ESSENTIEL.map(u => c.add(u).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* La page demande le passage à la nouvelle version (voir brancherSW dans js/pwa.js). */
self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
});

const estMedia = u => /\.(avif|webp|png|jpe?g|svg|gif|woff2?)$/i.test(u.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const u = new URL(req.url);

  /* Tout ce qui parle au compte ou aux polices distantes passe sans filet :
     une réponse périmée y serait pire que pas de réponse du tout. */
  if (u.origin !== location.origin) return;
  if (u.pathname.includes('/auth/v1') || u.pathname.includes('/rest/v1')) return;

  if (estMedia(u)) {
    e.respondWith((async () => {
      const c = await caches.open(MEDIAS);
      const vu = await c.match(req);
      if (vu) return vu;
      try {
        const r = await fetch(req);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'hors ligne' });
      }
    })());
    return;
  }

  /* Code et pages : le réseau d'abord, le cache si le réseau manque.
     `no-cache` force le navigateur à demander au serveur si sa copie est encore
     bonne. Sans ça, son propre cache pouvait servir une version périmée sans
     qu'on le sache — et une correction mettait des heures à arriver. */
  e.respondWith((async () => {
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r.ok) (await caches.open(COQUILLE)).put(req, r.clone());
      return r;
    } catch (err) {
      const c = await caches.open(COQUILLE);
      const vu = await c.match(req) || await c.match('index.html') || await c.match('./');
      return vu || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
