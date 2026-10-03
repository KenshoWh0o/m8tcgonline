/* Partager un tirage : une image du booster, prête pour Discord ou un réseau.

   L'image est dessinée dans un canvas, au format 4:5 (1080 × 1350) que les
   réseaux affichent en entier : le logo, à qui appartient le booster, les
   cartes, et l'adresse du jeu. Sur téléphone, le menu de partage du système
   s'ouvre avec l'image ; ailleurs, elle se télécharge.

   Les illustrations viennent du même site que la page : le canvas n'est pas
   « sali », il peut être exporté. */
"use strict";

const PART_L = 1080;
const PART_H = 1350;

const chargerImage = src => new Promise((ok, ko) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = ko;
  im.src = src;
});

function cheminArrondi(ctx, a, b, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(a + r, b);
  ctx.arcTo(a + w, b, a + w, b + hh, r);
  ctx.arcTo(a + w, b + hh, a, b + hh, r);
  ctx.arcTo(a, b + hh, a, b, r);
  ctx.arcTo(a, b, a + w, b, r);
  ctx.closePath();
}

/* La lueur autour d'une carte, couleur de sa rareté — la même que dans la
   pile d'ouverture. */
const PART_LUEUR = { R: '#39b8ff', E: '#a05cff', L: '#ffc73b', BR: '#ff5bb0', UN: '#ec8fff' };

async function imageTirage(t) {
  const cartes = (t.ids || []).map(id => byId[id]).filter(Boolean);
  const cv = document.createElement('canvas');
  cv.width = PART_L;
  cv.height = PART_H;
  const x = cv.getContext('2d');

  /* Le fond : le violet du jeu, et une nappe dorée pour un godpack. */
  const fond = x.createLinearGradient(0, 0, 0, PART_H);
  fond.addColorStop(0, '#1a1024');
  fond.addColorStop(1, '#07050a');
  x.fillStyle = fond;
  x.fillRect(0, 0, PART_L, PART_H);
  const halo = x.createRadialGradient(PART_L / 2, 420, 40, PART_L / 2, 420, 760);
  halo.addColorStop(0, t.god ? 'rgba(255,199,59,.32)' : 'rgba(137,54,255,.34)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo;
  x.fillRect(0, 0, PART_L, PART_H);

  try { await document.fonts.load('900 italic 60px Archivo'); } catch (e) { /* police de repli */ }
  const police = (taille, graisse, italique) =>
    `${italique ? 'italic ' : ''}${graisse} ${taille}px Archivo, Figtree, system-ui, sans-serif`;

  /* L'en-tête : le logo, puis « Le booster de … ». */
  try {
    const logo = await chargerImage(ART.logo);
    const lh = 120;
    const lw = logo.width * lh / logo.height;
    x.drawImage(logo, (PART_L - lw) / 2, 50, lw, lh);
  } catch (e) { /* sans logo */ }
  x.textAlign = 'center';
  x.fillStyle = '#ffffff';
  x.font = police(54, 900, true);
  x.fillText(t.god ? 'Godpack !' : 'Mon booster', PART_L / 2, 232);
  x.fillStyle = 'rgba(255,255,255,.62)';
  x.font = police(30, 700);
  const quand = t.quand ? new Date(t.quand).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  x.fillText(`${save.pseudo}${quand ? ' · ' + quand : ''}`, PART_L / 2, 280);

  /* Les cartes : trois par rangée (quatre s'il y en a sept), centrées. */
  const n = cartes.length;
  const cols = n > 6 ? 4 : 3;
  const rangs = Math.ceil(n / cols);
  const ecart = 26;
  const zoneH = PART_H - 330 - 140;
  const cw = Math.min((PART_L - 120 - (cols - 1) * ecart) / cols,
    (zoneH - (rangs - 1) * ecart) / rangs * 63 / 88);
  const ch = cw * 88 / 63;
  const hautGrille = rangs * ch + (rangs - 1) * ecart;
  const y0 = 330 + (zoneH - hautGrille) / 2;

  const images = await Promise.all(cartes.map(c => chargerImage(c.img).catch(() => null)));
  cartes.forEach((c, i) => {
    const rang = Math.floor(i / cols);
    const dansRang = Math.min(cols, n - rang * cols);
    const largeurRang = dansRang * cw + (dansRang - 1) * ecart;
    const a = (PART_L - largeurRang) / 2 + (i % cols) * (cw + ecart);
    const b = y0 + rang * (ch + ecart);
    const r = cw * 0.055;

    const lueur = PART_LUEUR[c.rar];
    x.save();
    if (lueur) { x.shadowColor = lueur; x.shadowBlur = 38; }
    x.fillStyle = '#15151a';
    cheminArrondi(x, a, b, cw, ch, r);
    x.fill();
    x.restore();

    x.save();
    cheminArrondi(x, a, b, cw, ch, r);
    x.clip();
    if (images[i]) x.drawImage(images[i], a, b, cw, ch);
    /* La Brillante garde son reflet, même figé. */
    if (c.foil) {
      const g = x.createLinearGradient(a, b, a + cw, b + ch);
      ['#ff5bb0', '#ffc73b', '#55e6a6', '#39b8ff', '#a95cf2'].forEach((col, k, l) => g.addColorStop(k / (l.length - 1), col));
      x.globalCompositeOperation = 'color-dodge';
      x.globalAlpha = 0.45;
      x.fillStyle = g;
      x.fillRect(a, b, cw, ch);
    }
    x.restore();
  });

  /* Le pied : l'adresse du jeu. */
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,.5)';
  x.font = police(28, 700);
  x.fillText(String(SITE_URL || '').replace(/^https?:\/\//, ''), PART_L / 2, PART_H - 60);

  return new Promise((ok, ko) => cv.toBlob(b => (b ? ok(b) : ko(new Error('image vide'))), 'image/png'));
}

/* `t` : { ids, god, quand } — un booster du journal, ou celui qu'on vient
   d'ouvrir. */
async function partagerTirage(t) {
  if (!t || !(t.ids || []).length) return;
  occupe(true);
  try {
    const blob = await imageTirage(t);
    const fichier = new File([blob], 'mon-booster.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: 'Mon booster', text: `Mon booster sur ${GAME_NAME}` });
    } else {
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = 'mon-booster.png';
      document.body.appendChild(lien);
      lien.click();
      setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1500);
      toast('Image téléchargée.');
    }
  } catch (e) {
    /* Refermer le menu de partage n'est pas une erreur. Ouvert comme fichier
       (la démo), le navigateur refuse d'exporter l'image : on le dit. */
    if (e && e.name === 'SecurityError') toast('Le partage d\'image demande d\'ouvrir le jeu depuis une adresse web.');
    else if (!e || e.name !== 'AbortError') toast('L\'image n\'a pas pu être créée.');
  } finally {
    occupe(false);
  }
}
