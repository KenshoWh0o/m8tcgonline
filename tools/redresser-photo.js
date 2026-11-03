#!/usr/bin/env node
/* Redresser la photo d'une carte (version 3.0.13).

   Les visuels de P03, P04 et des Secrètes 124, 126 et 127 viennent de photos
   du propriétaire (1er novembre 2026) : une carte posée de biais, sous
   pochette ou sous cadre. On donne les quatre coins de la carte sur la photo
   (haut gauche, haut droit, bas droit, bas gauche, en pixels de la photo) ;
   une homographie les envoie sur un rectangle aux proportions d'une carte
   (63 × 88). Chromium la dessine (matrix3d), puis son canvas l'encode en
   WebP. Rien d'autre que Playwright, déjà là pour les tests.

     node tools/redresser-photo.js <photo> "x1,y1;x2,y2;x3,y3;x4,y4" <largeur> <sortie.webp> [qualité 0-1]

   Les coins retenus, relevés à l'œil sur chaque photo (la commande refait
   les fichiers du dépôt à l'octet près) :

     carte  photo    coins                                  largeur  qualité  sortie
     P03    7.jpg    912,810;1478,918;1350,1745;755,1625    640      0.9      cards/promos/P03-Brawks_Deter.webp
     P04    7.jpg    122,815;680,805;698,1628;102,1630      640      0.9      cards/promos/P04-Squeezie_Le_Toxique.webp
     (3.0.16 : 124, 126 et 127 remplacées par des scans, cards/*-scan.webp ; les lignes qui suivent
      refont les anciennes photos.)
     124    8.jpg    275,357;880,352;908,1228;255,1235      900      0.76     cards/124_S_Joueur_Violette_Brawks-Trop-Deter.webp
     126    10.webp  275,430;1232,425;1100,1615;310,1618    900      0.84     cards/126_S_Moment-Instant_Neutre_GP-Explorer-II.webp
     127    9.jpg    248,405;1210,385;1248,1758;242,1768    900      0.82     cards/127_S_Moment-Instant_Mauve_Paris-Gentle-Mates.webp

   Les photos elles-mêmes ne sont pas dans le dépôt.

   Ce sont des photos : reflets, flou et couleurs d'éclairage restent (126,
   sous cadre, est la plus terne). Un scan propre remplacera chacune sous un
   autre nom de fichier (le service worker garde une image sous son nom,
   README § 13) : il suffit alors de changer son `fichier` dans
   js/promos-data.js. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/* Un système linéaire 8 × 8, par élimination de Gauss avec pivot. */
function resoudre(A, b) {
  const n = b.length;
  const M = A.map((r, i) => r.concat(b[i]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/* L'homographie qui envoie les quatre points `src` sur les quatre `dst`. */
function homographie(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = resoudre(A, b);
  h.push(1);
  return h;
}

(async () => {
  const [photo, coins, largeur, sortie, qualite] = process.argv.slice(2);
  if (!photo || !coins || !largeur || !sortie) {
    console.error('Usage : node tools/redresser-photo.js <photo> "x1,y1;x2,y2;x3,y3;x4,y4" <largeur> <sortie.webp> [qualité]');
    process.exit(1);
  }
  const c = coins.split(';').map(p => p.split(',').map(Number));
  if (c.length !== 4 || c.some(p => p.length !== 2 || p.some(isNaN))) throw new Error('Quatre coins attendus : "x,y;x,y;x,y;x,y".');
  const w = +largeur, hh = Math.round(w * 88 / 63);
  const h = homographie(c, [[0, 0], [w, 0], [w, hh], [0, hh]]);
  /* matrix3d se lit par colonnes. */
  const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  const src = 'data:image/' + (path.extname(photo).slice(1).replace('jpg', 'jpeg') || 'jpeg') + ';base64,' + fs.readFileSync(photo).toString('base64');

  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: w, height: hh } });
    await p.setContent(`<body style="margin:0;background:#000"><div style="position:relative;width:${w}px;height:${hh}px;overflow:hidden">
      <img id="ph" style="position:absolute;left:0;top:0;transform-origin:0 0;transform:matrix3d(${m.join(',')})"></div></body>`);
    await p.evaluate(s => new Promise((ok, ko) => { const i = document.getElementById('ph'); i.onload = ok; i.onerror = ko; i.src = s; }), src);
    const png = await p.screenshot({ type: 'png' });
    const webp = await p.evaluate(([d, q]) => new Promise(ok => {
      const i = new Image();
      i.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = i.naturalWidth; cv.height = i.naturalHeight;
        cv.getContext('2d').drawImage(i, 0, 0);
        ok(cv.toDataURL('image/webp', q));
      };
      i.src = d;
    }), ['data:image/png;base64,' + png.toString('base64'), qualite ? +qualite : 0.9]);
    fs.writeFileSync(sortie, Buffer.from(webp.split(',')[1], 'base64'));
    console.log(sortie, w + ' × ' + hh, Math.round(fs.statSync(sortie).size / 1024) + ' Ko');
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
