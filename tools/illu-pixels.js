#!/usr/bin/env node
/* Devine l'illu (version 2.0) : réduit l'illustration de chaque carte en une
   grille de 36 × 24 pixels, et l'écrit dans supabase/21b_illu.sql.

       node tools/illu-pixels.js

   Pourquoi côté serveur : le jeu montre l'illustration du jour pixelisée, de
   plus en plus nette à chaque essai. Si le navigateur recevait l'image, ou
   même toutes les grilles, il saurait déjà la réponse. Le serveur garde les
   grilles et n'envoie que la version floue du moment (illu_grille(),
   supabase/21_reflets.sql), qu'il calcule en moyennant des blocs de celle-ci.

   Une couleur tient sur 12 bits (4 par canal) : deux pixels font trois
   octets, et la plus fine des quatre grilles reste lisible.

   À relancer quand une illustration change. Il faut Playwright (Chromium
   décode les .avif) : `npm i -g playwright`. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const ROOT = path.dirname(__dirname);
const W = 36, H = 24;
/* La zone de l'illustration sur la carte, en fractions de sa taille : sans
   le nom, le type, l'étoile en haut à gauche ni le symbole d'édition. */
const ZONE = { x0: 0.11, y0: 0.15, x1: 0.89, y1: 0.505 };

let playwright;
try { playwright = require('playwright'); } catch (e) {
  try { playwright = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) {
    console.error('Playwright est introuvable : npm i -g playwright'); process.exit(1);
  }
}

/* Les cartes de l'extension, lues dans js/cards-data.js. */
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/cards-data.js'), 'utf8')
  .replace('const CARD_DATA', 'globalThis.CARD_DATA'), ctx);
const cartes = ctx.CARD_DATA
  .filter(m => m.fichier && String(m.categorie || '').toLowerCase() !== 'essence')
  .map(m => ({ id: 'c' + String(m.num).padStart(3, '0'), src: 'cards/' + m.fichier }));

const TYPES = { '.avif': 'image/avif', '.webp': 'image/webp', '.html': 'text/html' };
const serveur = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

serveur.listen(0, async () => {
  const port = serveur.address().port;
  const b = await playwright.chromium.launch();
  const p = await b.newPage();
  await p.goto(`http://localhost:${port}/index.html`).catch(() => {});
  const grilles = await p.evaluate(async ({ cartes, W, H, ZONE }) => {
    const out = {};
    for (const c of cartes) {
      const img = new Image();
      img.src = '/' + c.src;
      try { await img.decode(); } catch (e) { continue; }
      const sx = img.naturalWidth * ZONE.x0, sy = img.naturalHeight * ZONE.y0;
      const sw = img.naturalWidth * (ZONE.x1 - ZONE.x0), sh = img.naturalHeight * (ZONE.y1 - ZONE.y0);
      /* Par paliers : une réduction directe de 800 px à 36 sauterait des
         pixels au lieu de les moyenner. */
      let cv = document.createElement('canvas');
      cv.width = W * 8; cv.height = H * 8;
      let g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      for (const f of [4, 2, 1]) {
        const n = document.createElement('canvas');
        n.width = W * f; n.height = H * f;
        const ng = n.getContext('2d');
        ng.imageSmoothingQuality = 'high';
        ng.drawImage(cv, 0, 0, n.width, n.height);
        cv = n; g = ng;
      }
      const d = g.getImageData(0, 0, W, H).data;
      const nib = [];
      for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) nib.push(Math.round(d[i * 4 + k] / 17));
      const octets = [];
      for (let i = 0; i < nib.length; i += 2) octets.push((nib[i] << 4) | (nib[i + 1] || 0));
      out[c.id] = btoa(String.fromCharCode(...octets));
    }
    return out;
  }, { cartes, W, H, ZONE });
  await b.close();
  serveur.close();

  const ids = Object.keys(grilles).sort();
  const lignes = ids.map(id => `  ('${id}', decode('${grilles[id]}', 'base64'))`);
  const sql = `-- =====================================================================
--  Devine l'illu : l'illustration de chaque carte, en ${W} × ${H} pixels.
--  Genere par \`node tools/illu-pixels.js\` : ne pas editer a la main.
--  12 bits par pixel (4 par canal), deux pixels pour trois octets.
--  A executer apres 21_reflets.sql. Rejouable sans danger.
-- =====================================================================
insert into public.illu_pixels (card_id, data) values
${lignes.join(',\n')}
on conflict (card_id) do update set data = excluded.data;
`;
  fs.writeFileSync(path.join(ROOT, 'supabase/21b_illu.sql'), sql);
  console.log(`${ids.length} illustrations sur ${cartes.length} -> supabase/21b_illu.sql (${Math.round(sql.length / 1024)} Ko)`);
});
