/* Road to Worlds — l'interface (prototype).
   Tout l'état de la partie vit dans `E` (run/moteur.js) ; ce fichier le
   dessine, rejoue les calculs en animation, et le range dans le navigateur
   après chaque geste : on reprend là où on s'est arrêté. */
"use strict";

M8R.charger(CARD_DATA);

const CLE = 'm8run.partie';
const CLE_RECORDS = 'm8run.records';
const CLE_VITESSE = 'm8run.vitesse';
const IMG = f => '../cards/' + f;

let E = null;              /* la partie */
let ecran = 'titre';       /* titre | etape | match | gains | boutique | fin */
let sel = [];              /* uids sélectionnés dans la main */
let tri = 'essence';       /* essence | carte */
let occupe = false;        /* une animation joue : pas de clic */
let gains = null;          /* le détail du dernier cash prize */
let vitesse = +(lire(CLE_VITESSE) || 1);

/* ---------- Petits outils ---------- */
function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* mode privé */ } }
const $ = s => document.querySelector(s);
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.floor(n).toLocaleString('fr-FR');
const fmtM = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
const dodo = ms => new Promise(r => setTimeout(r, ms / vitesse));
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), 2200);
}

function sauver() {
  if (E && !E.fini) ecrire(CLE, JSON.stringify({ E, ecran: ecran === 'gains' ? 'boutique' : ecran }));
  else ecrire(CLE, '');
}

function records() {
  try { return JSON.parse(lire(CLE_RECORDS) || '{}'); } catch (e) { return {}; }
}
function noterRecord() {
  const r = records();
  const rang = E.fini.victoire ? 99 : E.fini.etape * 3 + E.fini.match;
  if (rang > (r.rang ?? -1)) { r.rang = rang; r.loin = finTexte(); }
  r.meilleur = Math.max(r.meilleur || 0, E.stats.meilleur);
  r.parties = (r.parties || 0) + 1;
  if (E.fini.victoire) r.victoires = (r.victoires || 0) + 1;
  if (E.graine.startsWith('jour-')) {
    r.jours = r.jours || {};
    const j = E.graine.slice(5);
    r.jours[j] = Math.max(r.jours[j] || 0, rang);
  }
  ecrire(CLE_RECORDS, JSON.stringify(r));
}
const finTexte = () => E.fini.victoire ? 'Champion du monde'
  : `${M8R.ETAPES[E.fini.etape].nom} · ${M8R.MATCHS[E.fini.match].nom}`;

/* ---------- Les cartes à l'écran ---------- */
const essDe = num => M8R.ESS[M8R.joueur(num).ess];
function vJoueur(c, cls) {
  const j = M8R.joueur(c.num);
  return `<div class="rc ${cls || ''} r${j.rar}" data-uid="${c.uid}" style="--e:${M8R.ESS[j.ess].c}">
    <img src="${IMG(j.img)}" alt="${h(j.nom)}" draggable="false" loading="lazy">
    <span class="rc-pts">${j.pts}</span><i class="rc-ess"></i></div>`;
}
function vStaff(s, i, cls) {
  const d = M8R.STAFF_ID[s.id], k = M8R.carte(d.num);
  return `<button class="st ${cls || ''}" data-staff="${i}" aria-label="${h(k.nom)} : ${h(d.txt)}">
    <img src="${IMG(k.fichier)}" alt="" draggable="false"><span class="st-nom">${h(k.nom)}</span></button>`;
}
const etatStaff = s => { const d = M8R.STAFF_ID[s.id]; return d.etat ? ` (${d.etat(s)})` : ''; };

/* ---------- Le rendu ---------- */
function rendre() {
  const app = $('#app');
  app.className = 'ecran-' + ecran;
  app.innerHTML = ecran === 'titre' ? vTitre()
    : ecran === 'etape' ? vEtape()
    : ecran === 'match' ? vMatch()
    : ecran === 'gains' ? vGains()
    : ecran === 'boutique' ? vBoutique()
    : vFin();
  if (ecran === 'match') placerMain();
  sauver();
}

/* ---------- Titre ---------- */
function vTitre() {
  const r = records();
  let reprise = null;
  try { reprise = JSON.parse(lire(CLE) || 'null'); } catch (e) { /* rien */ }
  const jour = new Date().toISOString().slice(0, 10);
  const duJour = r.jours && r.jours[jour] != null;
  return `<section class="titre">
    <span class="proto">Prototype</span>
    <h1><small>Mate TCG</small>Road to <b>Worlds</b></h1>
    <p class="accroche">Une saison, quatre étapes, des Qualifs aux Worlds. Compose tes formations,
      recrute ton staff, et bats l'objectif de chaque match.</p>
    <div class="titre-actions">
      ${reprise && reprise.E ? `<button class="btn" data-act="reprendre">Reprendre la saison
          <small>${h(M8R.ETAPES[reprise.E.etape].nom)} · ${h(M8R.MATCHS[reprise.E.match].nom)}</small></button>` : ''}
      <button class="btn ${reprise && reprise.E ? 'ghost' : ''}" data-act="nouvelle">Nouvelle saison</button>
      <button class="btn ghost" data-act="jour">Saison du jour${duJour ? ' <small>déjà jouée</small>' : '<small>la même pour tout le monde</small>'}</button>
      <button class="lien" data-act="regles">Comment on joue</button>
    </div>
    ${r.parties ? `<p class="records">${r.parties} saison${r.parties > 1 ? 's' : ''} · plus loin : <b>${h(r.loin || '—')}</b>
      · meilleur coup : <b>${fmt(r.meilleur || 0)}</b></p>` : ''}
    <a class="retour-site" href="../">← Retour à Mate TCG Online</a>
  </section>`;
}

function nouvelle(graine) {
  E = M8R.nouvellePartie(graine || ('libre-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
  ecran = 'etape';
  rendre();
}

/* ---------- Avant un match : l'étape ---------- */
function vEtape() {
  const et = M8R.ETAPES[E.etape];
  const r = M8R.rival(E);
  return `${vEntete()}
  <section class="etape">
    <span class="etape-num">Étape ${E.etape + 1} / ${M8R.ETAPES.length}</span>
    <h2>${h(et.nom)}</h2>
    <ol class="etape-matchs">${M8R.MATCHS.map((m, i) => `<li class="${i < E.match ? 'fait' : i === E.match ? 'actuel' : ''}">
        <span class="em-nom">${i === 2 ? h(r.nom) : h(m.nom)}</span>
        <span class="em-cible">${fmt(M8R.cibleDe(E, E.etape, i))}</span>
        ${i === 2 ? `<span class="em-rival">${h(r.txt)}</span>` : ''}
        <span class="em-gain">+${m.gain} $</span>
      </li>`).join('')}</ol>
    <button class="btn" data-act="lancer">Jouer ${E.match === 2 ? 'contre ' + h(r.nom) : 'le ' + h(M8R.MATCHS[E.match].nom.toLowerCase())}</button>
  </section>`;
}

/* `deja` : le match qu'on vient de gagner (l'état est déjà passé au suivant). */
function vEntete(deja) {
  const et = deja ? deja.etape : E.etape, ma = deja ? deja.match : E.match;
  const nomMatch = ma === 2 ? M8R.rival({ rivaux: E.rivaux, etape: et }).nom : M8R.MATCHS[ma].nom;
  return `<header class="entete">
    <button class="ico" data-act="menu" aria-label="Menu">☰</button>
    <span class="ent-titre">${h(M8R.ETAPES[et].nom)}<small>${h(nomMatch)}</small></span>
    <span class="argent">${E.argent} $</span>
  </header>`;
}

function lancer() {
  M8R.debutMatch(E);
  sel = [];
  ecran = 'match';
  rendre();
}

/* ---------- Le match ---------- */
function vMatch() {
  const m = E.m;
  const r = M8R.rivalDuMatch(E);
  const pct = Math.min(100, m.score / m.cible * 100);
  return `${vEntete()}
  <section class="tableau">
    <div class="objectif">
      <div class="obj-haut"><span>Objectif <b>${fmt(m.cible)}</b></span><span class="obj-score"><b id="score">${fmt(m.score)}</b></span></div>
      <div class="obj-barre"><i id="barre" style="width:${pct}%"></i></div>
      <div class="obj-bas">
        <span>Manches <b id="manches">${m.manches}</b></span>
        <span>Remplacements <b>${m.remplacements}</b></span>
        <button class="lien" data-act="deck">Deck ${m.pioche.length}/${E.deck.length}</button>
      </div>
      ${r ? `<p class="obj-rival"><b>${h(r.nom)}</b> ${h(r.txt)}</p>` : ''}
    </div>
    <div class="staff">${vStaffRangee()}</div>
    <div class="scene">
      <div class="calcul">
        <div class="calc-forme" id="forme">${vApercuForme()}</div>
        <div class="calc-nums"><span class="pts" id="pts">${apercu().pts}</span><i>×</i><span class="mul" id="mul">${apercu().mul}</span></div>
        <div class="calc-total" id="total"></div>
      </div>
      <div class="posees" id="posees"></div>
    </div>
  </section>
  <section class="mainzone">
    <div class="main" id="main">${triees().map(c => vJoueur(c, sel.includes(c.uid) ? 'sel' : '')).join('')}</div>
    <div class="actions">
      <button class="btn ghost" data-act="remplacer" ${sel.length && m.remplacements > 0 ? '' : 'disabled'}>Remplacer<small>${m.remplacements}</small></button>
      <button class="mini" data-act="tri" aria-label="Changer le tri">Trier<small>${tri === 'essence' ? 'Essence' : 'Carte'}</small></button>
      <button class="btn" data-act="jouer" ${sel.length ? '' : 'disabled'}>Jouer<small>${sel.length}/5</small></button>
    </div>
  </section>`;
}

function vStaffRangee(actif) {
  const l = E.staff.map((s, i) => vStaff(s, i, actif === i ? 'pulse' : ''));
  for (let i = E.staff.length; i < M8R.PLACES; i++) l.push('<span class="st vide"></span>');
  return l.join('');
}

/* La formation que forme la sélection, avant de jouer : son nom, ses
   Points et son Multi de base (le total, lui, se découvre en jouant). */
function apercu() {
  if (!sel.length) return { forme: null, pts: 0, mul: 0 };
  const jouees = sel.map(u => E.m.main.find(c => c.uid === u)).filter(Boolean);
  const f = M8R.detecter(jouees);
  const F = M8R.FORME[f.id], n = E.niveaux[f.id];
  return { forme: f.id, pts: F.base + (n - 1) * F.lvl[0], mul: F.multi + (n - 1) * F.lvl[1], comptees: f.comptees.map(c => c.uid) };
}
function vApercuForme() {
  const a = apercu();
  if (!a.forme) return '<span class="calc-vide">Choisis jusqu\'à 5 cartes</span>';
  return `<b>${h(M8R.FORME[a.forme].nom)}</b><small>niv. ${E.niveaux[a.forme]}</small>`;
}

function triees() {
  const l = E.m.main.slice();
  const ordreEss = Object.keys(M8R.ESS);
  return tri === 'essence'
    ? l.sort((a, b) => ordreEss.indexOf(M8R.joueur(a.num).ess) - ordreEss.indexOf(M8R.joueur(b.num).ess) || a.num - b.num || a.uid - b.uid)
    : l.sort((a, b) => a.num - b.num || a.uid - b.uid);
}

/* La main en éventail : les cartes se chevauchent juste assez pour tenir. */
function placerMain() {
  const zone = $('#main');
  if (!zone) return;
  const cartes = [...zone.children];
  const n = cartes.length;
  const W = zone.clientWidth;
  const cw = Math.max(56, Math.min(118, W / Math.max(1, n * 0.6)));
  const pas = n > 1 ? Math.min(cw + 6, (W - cw) / (n - 1)) : 0;
  const large = pas * (n - 1) + cw;
  const x0 = (W - large) / 2;
  zone.style.height = Math.round(cw * 1.4 + 46) + 'px';
  cartes.forEach((el, i) => {
    el.style.width = cw + 'px';
    el.style.left = Math.round(x0 + i * pas) + 'px';
    el.style.zIndex = i + 1;
    const mil = (n - 1) / 2;
    el.style.setProperty('--rot', ((i - mil) * (n > 6 ? 1.6 : 2.2)).toFixed(1) + 'deg');
    el.style.setProperty('--dy', (Math.abs(i - mil) ** 1.6 * 1.2).toFixed(1) + 'px');
  });
  marquerComptees();
}

function marquerComptees() {
  const a = apercu();
  const c = new Set(a.comptees || []);
  document.querySelectorAll('#main .rc').forEach(el => el.classList.toggle('compte', c.has(+el.dataset.uid)));
}

function majSelection() {
  document.querySelectorAll('#main .rc').forEach(el => el.classList.toggle('sel', sel.includes(+el.dataset.uid)));
  const a = apercu();
  $('#forme').innerHTML = vApercuForme();
  $('#pts').textContent = a.pts;
  $('#mul').textContent = a.mul;
  const jb = $('[data-act="jouer"]'), rb = $('[data-act="remplacer"]');
  jb.disabled = !sel.length;
  jb.querySelector('small').textContent = sel.length + '/5';
  rb.disabled = !sel.length || E.m.remplacements <= 0;
  marquerComptees();
}

function basculer(uid) {
  if (occupe) return;
  if (sel.includes(uid)) sel = sel.filter(u => u !== uid);
  else if (sel.length < 5) sel.push(uid);
  else return toast('5 cartes au maximum.');
  majSelection();
}

/* ---------- Jouer : le calcul rejoué pas à pas ---------- */
async function jouer() {
  if (occupe || !sel.length) return;
  const refus = M8R.peutJouer(E, sel);
  if (refus) return toast(refus);
  occupe = true;
  document.body.classList.add('occupe');

  /* Les cartes posées montent au centre, dans l'ordre de la sélection. */
  const jouees = sel.map(u => E.m.main.find(c => c.uid === u));
  const res = M8R.jouer(E, sel);
  sel = [];
  const posees = $('#posees');
  posees.innerHTML = jouees.map(c => vJoueur(c, res.comptees.includes(c.uid) ? 'posee' : 'posee hors')).join('');
  jouees.forEach(c => { const el = document.querySelector(`#main .rc[data-uid="${c.uid}"]`); if (el) el.remove(); });

  const F = M8R.FORME[res.forme];
  $('#forme').innerHTML = `<b>${h(F.nom)}</b><small>niv. ${res.niveau}</small>`;
  let pts = res.depart.points, mul = res.depart.multi;
  const majNums = () => { $('#pts').textContent = fmt(pts); $('#mul').textContent = fmtM(mul); };
  majNums();
  await dodo(380);

  for (const p of res.pas) {
    if (p.nul) {
      bulle($('.calcul'), 'Ne marque rien', 'nul');
      pts = 0; mul = 0; majNums();
      await dodo(700);
      continue;
    }
    const cible = p.de && p.de.staff != null
      ? document.querySelectorAll('.staff .st')[p.de.staff]
      : p.de && p.de.carte != null ? posees.querySelector(`.rc[data-uid="${p.de.carte}"]`) : null;
    if (p.muet) { if (cible) { cible.classList.add('muet'); bulle(cible, 'Ne compte pas', 'nul'); } await dodo(420); continue; }
    if (p.pts != null) pts += p.pts;
    if (p.multi != null) mul += p.multi;
    if (p.fois != null) mul *= p.fois;
    majNums();
    if (cible) {
      cible.classList.remove('pulse'); void cible.offsetWidth; cible.classList.add('pulse');
      bulle(cible, p.pts != null ? `+${p.pts}` : p.multi != null ? `+${p.multi} Multi` : `×${fmtM(p.fois)}`,
        p.pts != null ? 'pts' : 'mul');
    }
    await dodo(p.fois != null ? 520 : 330);
  }

  /* Le total, puis le score du match. */
  const tot = $('#total');
  tot.innerHTML = `<b>${fmt(res.total)}</b>`;
  tot.classList.remove('on'); void tot.offsetWidth; tot.classList.add('on');
  if (res.total >= 10000) document.body.classList.add('secousse');
  await dodo(650);
  document.body.classList.remove('secousse');
  const avant = E.m.score - res.total;
  await compter($('#score'), avant, E.m.score, 500);
  $('#barre').style.width = Math.min(100, E.m.score / E.m.cible * 100) + '%';
  $('#manches').textContent = E.m.manches;
  await dodo(450);

  occupe = false;
  document.body.classList.remove('occupe');
  if (res.issue === 'gagne') { const deja = { etape: E.etape, match: E.match }; gains = M8R.finMatch(E); gains.deja = deja; ecran = E.fini ? 'fin' : 'gains'; if (E.fini) noterRecord(); }
  else if (res.issue === 'perdu') { noterRecord(); ecran = 'fin'; }
  rendre();
}

function bulle(el, txt, genre) {
  const b = document.createElement('span');
  b.className = 'bulle ' + genre;
  b.textContent = txt;
  const r = el.getBoundingClientRect();
  b.style.left = (r.left + r.width / 2) + 'px';
  b.style.top = (r.top + 4) + 'px';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 900 / vitesse + 300);
}

async function compter(el, de, a, ms) {
  if (RM()) { el.textContent = fmt(a); return; }
  const t0 = performance.now(), duree = ms / vitesse;
  await new Promise(fin => {
    const pas = t => {
      const k = Math.min(1, (t - t0) / duree);
      el.textContent = fmt(de + (a - de) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(pas); else fin();
    };
    requestAnimationFrame(pas);
  });
}

function remplacer() {
  if (occupe || !sel.length) return;
  try { M8R.remplacer(E, sel); } catch (e) { return toast(e.message); }
  sel = [];
  rendre();
}

/* ---------- Après la victoire : le cash prize ---------- */
function vGains() {
  return `${vEntete(gains.deja)}
  <section class="gains">
    <span class="gains-kicker">Match gagné</span>
    <h2>Cash prize</h2>
    <ul>${gains.lignes.map(l => `<li><span>${h(l.txt)}</span><b>+${l.$} $</b></li>`).join('')}</ul>
    <p class="gains-total">Total <b>+${gains.total} $</b></p>
    <button class="btn" data-act="boutique">Aller au mercato</button>
  </section>`;
}

/* ---------- La boutique : le mercato ---------- */
function vBoutique() {
  const s = E.shop;
  const offre = (o, i) => {
    const trop = E.argent < o.prix;
    if (o.type === 'staff') {
      const d = M8R.STAFF_ID[o.id], k = M8R.carte(d.num);
      return `<button class="offre staff-o${o.vendu ? ' vendu' : ''}${trop ? ' cher' : ''}" data-achat="${i}" ${o.vendu ? 'disabled' : ''}>
        <img src="${IMG(k.fichier)}" alt="">
        <span class="o-txt"><b>${h(k.nom)}</b><small>${h(k.categorie)} · ${h(M8R.RARS[k.rarete] || '')}</small><span>${h(d.txt)}</span></span>
        <span class="o-prix">${o.vendu ? 'Pris' : o.prix + ' $'}</span></button>`;
    }
    if (o.type === 'joueur') {
      const j = M8R.joueur(o.num);
      return `<button class="offre joueur-o${o.vendu ? ' vendu' : ''}${trop ? ' cher' : ''}" data-achat="${i}" ${o.vendu ? 'disabled' : ''} style="--e:${M8R.ESS[j.ess].c}">
        <img src="${IMG(j.img)}" alt="">
        <span class="o-txt"><b>${h(j.nom)}</b><small><i class="pastille-e"></i>${h(M8R.ESS[j.ess].nom)} · ${h(M8R.RARS[j.rar])}</small>
          <span>${j.pts} Points${j.rar === 'R' ? ' · +2 Multi' : j.rar === 'E' ? ' · +4 Multi' : j.rar === 'L' ? ' · ×1,5 Multi' : ''}</span></span>
        <span class="o-prix">${o.vendu ? 'Pris' : o.prix + ' $'}</span></button>`;
    }
    const F = M8R.FORME[o.forme], k = M8R.carte(o.num);
    return `<button class="offre moment-o${o.vendu ? ' vendu' : ''}${trop ? ' cher' : ''}" data-achat="${i}" ${o.vendu ? 'disabled' : ''}>
      <img src="${IMG(k.fichier)}" alt="">
      <span class="o-txt"><b>${h(k.nom)}</b><small>Moment · entraînement</small>
        <span>${h(F.nom)} niv. ${E.niveaux[o.forme]} → ${E.niveaux[o.forme] + 1} : +${F.lvl[0]} Points, +${F.lvl[1]} Multi</span></span>
      <span class="o-prix">${o.vendu ? 'Pris' : o.prix + ' $'}</span></button>`;
  };
  const prochain = M8R.MATCHS[E.match];
  return `${vEntete()}
  <section class="boutique">
    <div class="bq-tete"><h2>Mercato</h2><button class="btn ghost mini-btn" data-act="relancer" ${E.argent < s.relance ? 'disabled' : ''}>Relancer · ${s.relance} $</button></div>
    <h3>Staff</h3>
    <div class="offres">${s.offres.map((o, i) => o.type === 'staff' ? offre(o, i) : '').join('')}</div>
    <h3>Joueurs <small>s'ajoutent à ton deck</small></h3>
    <div class="offres">${s.offres.map((o, i) => o.type === 'joueur' ? offre(o, i) : '').join('')}</div>
    <h3>Entraînement</h3>
    <div class="offres">${s.offres.map((o, i) => o.type === 'moment' ? offre(o, i) : '').join('')}</div>
    <h3>Services</h3>
    <div class="services">
      <button class="btn ghost" data-act="doubler" ${E.argent < M8R.PRIX_DOUBLE ? 'disabled' : ''}>Recruter un double<small>${M8R.PRIX_DOUBLE} $</small></button>
      <button class="btn ghost" data-act="liberer" ${E.argent < M8R.PRIX_LIBERER || E.deck.length <= M8R.DECK_MIN ? 'disabled' : ''}>Libérer un joueur<small>${M8R.PRIX_LIBERER} $</small></button>
    </div>
    <h3>Ton staff <small>touche pour vendre</small></h3>
    <div class="staff grand">${vStaffRangee()}</div>
    <div class="bq-pied">
      <button class="lien" data-act="deck">Voir le deck (${E.deck.length})</button>
      <button class="btn" data-act="suivant">${E.match === 0 ? 'Étape suivante' : 'Match suivant'}<small>${E.match === 2 ? h(M8R.rival(E).nom) : h(prochain.nom)}</small></button>
    </div>
  </section>`;
}

/* ---------- Fin de saison ---------- */
function vFin() {
  const v = E.fini.victoire;
  const fav = Object.entries(E.stats.formes).sort((a, b) => b[1] - a[1])[0];
  return `<section class="fin ${v ? 'victoire' : ''}">
    <span class="gains-kicker">${v ? 'Saison terminée' : 'Éliminé'}</span>
    <h2>${v ? 'Champion du monde' : h(finTexte())}</h2>
    <ul class="fin-stats">
      <li><span>Meilleur coup</span><b>${fmt(E.stats.meilleur)}</b></li>
      <li><span>Manches jouées</span><b>${E.stats.manches}</b></li>
      ${fav ? `<li><span>Formation préférée</span><b>${h(M8R.FORME[fav[0]].nom)}</b></li>` : ''}
      <li><span>Staff final</span><b>${E.staff.length ? E.staff.map(s => h(M8R.carte(M8R.STAFF_ID[s.id].num).nom)).join(', ') : '—'}</b></li>
      <li><span>Graine</span><b class="graine">${h(E.graine)}</b></li>
    </ul>
    <button class="btn" data-act="nouvelle">Nouvelle saison</button>
    <button class="lien" data-act="accueil">Accueil</button>
  </section>`;
}

/* ---------- Feuilles : règles, deck, staff, menu ---------- */
function feuille(titre, corps, actions) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-fond" data-act="fermer"></div><div class="sh">
    <div class="sh-tete"><h2>${titre}</h2><button class="ico" data-act="fermer" aria-label="Fermer">✕</button></div>
    <div class="sh-corps">${corps}</div>
    ${actions ? `<div class="sh-actions">${actions}</div>` : ''}</div>`;
  s.hidden = false;
}
const fermer = () => { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; };

function regles() {
  feuille('Comment on joue', `
    <p>Une saison : <b>4 étapes</b> de 3 matchs. Chaque match a un objectif de score. Tu as
      <b>4 manches</b> pour l'atteindre, et <b>3 remplacements</b> pour changer des cartes de ta main.</p>
    <p>À chaque manche, pose de <b>1 à 5 Joueurs</b>. Ils forment une <b>formation</b>, qui donne des
      Points et un Multi. Seuls les Joueurs de la formation comptent : chacun ajoute ses Points
      (le chiffre sur la carte). Une Rare ajoute +2 Multi, une Épique +4, une Légendaire ×1,5.
      Ton staff s'en mêle, et <b>Points × Multi</b> s'ajoute au score.</p>
    <table class="formes">${M8R.FORMES.slice().reverse().map(f => `<tr><td><b>${h(f.nom)}</b><small>${h(f.dit)}</small></td>
      <td class="tnum">${f.base + (E ? (E.niveaux[f.id] - 1) * f.lvl[0] : 0)} × ${f.multi + (E ? (E.niveaux[f.id] - 1) * f.lvl[1] : 0)}${E && E.niveaux[f.id] > 1 ? `<small>niv. ${E.niveaux[f.id]}</small>` : ''}</td></tr>`).join('')}</table>
    <p>Entre les matchs, le <b>mercato</b> : du staff (Coachs et Objets, 5 places), des Joueurs pour ton
      deck, des Moments qui entraînent une formation, et deux services — recruter le double d'un Joueur,
      ou en libérer un. Le dernier match de chaque étape oppose une <b>équipe rivale</b> qui impose une
      contrainte.</p>
    <p class="petit">Prototype : un jeu à part, qui emprunte les cartes de Mate TCG. Ce ne sont pas les
      règles du jeu de cartes.</p>`);
}

function voirDeck(mode) {
  const groupes = {};
  E.deck.forEach(c => (groupes[c.num] = groupes[c.num] || []).push(c));
  const restants = E.m ? new Set(E.m.pioche.map(c => c.uid)) : null;
  const l = Object.values(groupes).sort((a, b) => {
    const ja = M8R.joueur(a[0].num), jb = M8R.joueur(b[0].num);
    return Object.keys(M8R.ESS).indexOf(ja.ess) - Object.keys(M8R.ESS).indexOf(jb.ess) || ja.num - jb.num;
  });
  const titre = mode === 'doubler' ? `Recruter un double · ${M8R.PRIX_DOUBLE} $`
    : mode === 'liberer' ? `Libérer un joueur · ${M8R.PRIX_LIBERER} $` : `Ton deck · ${E.deck.length} cartes`;
  feuille(titre, `${mode ? '<p class="petit">Touche un Joueur.</p>' : restants ? `<p class="petit">${restants.size} encore dans la pioche.</p>` : ''}
    <div class="deckgrille">${l.map(g => {
      const j = M8R.joueur(g[0].num);
      const reste = restants ? g.filter(c => restants.has(c.uid)).length : null;
      return `<button class="dk" ${mode ? `data-${mode}="${g[0].uid}"` : 'disabled'} style="--e:${M8R.ESS[j.ess].c}">
        ${vJoueur(g[0])}<span class="dk-n">×${g.length}${reste != null ? `<small>${reste} en pioche</small>` : ''}</span></button>`;
    }).join('')}</div>`);
}

function voirStaff(i) {
  const s = E.staff[i];
  if (!s) return;
  const d = M8R.STAFF_ID[s.id], k = M8R.carte(d.num);
  const vente = ecran === 'boutique' ? Math.max(1, Math.floor(s.prix / 2)) : null;
  feuille(h(k.nom), `<div class="st-fiche"><img src="${IMG(k.fichier)}" alt="">
      <p><small>${h(k.categorie)} · ${h(M8R.RARS[k.rarete] || '')}</small><b>${h(d.txt)}${h(etatStaff(s))}</b></p></div>`,
    vente != null ? `<button class="btn ghost" data-vendre="${i}">Vendre · ${vente} $</button>` : '');
}

function menu() {
  feuille('Menu', `
    <div class="menu">
      <button class="btn ghost" data-act="regles">Comment on joue</button>
      <button class="btn ghost" data-act="vitesse">Vitesse des animations : ×${vitesse}</button>
      <button class="btn ghost" data-act="accueil">Accueil (la saison est gardée)</button>
      <button class="btn ghost" data-act="abandon">Abandonner la saison</button>
    </div>
    <p class="petit">Graine : ${h(E ? E.graine : '')}</p>`);
}

/* ---------- Zoom : un appui long sur une carte ---------- */
let appui = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.rc, .st:not(.vide), .offre img');
  if (!el) return;
  appui = setTimeout(() => {
    appui = 'zoom';
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!img) return;
    const z = $('#zoom');
    z.innerHTML = `<img src="${img.src}" alt="">`;
    z.hidden = false;
  }, 380);
});
const finAppui = () => {
  if (appui && appui !== 'zoom') clearTimeout(appui);
  if (appui === 'zoom') { $('#zoom').hidden = true; setTimeout(() => { appui = null; }, 0); return; }
  appui = null;
};
document.addEventListener('pointerup', finAppui);
document.addEventListener('pointercancel', finAppui);
document.addEventListener('contextmenu', e => { if (e.target.closest('.rc, .st, .offre')) e.preventDefault(); });

/* ---------- Les clics ---------- */
document.addEventListener('click', e => {
  if (appui === 'zoom') return;
  const el = e.target.closest('[data-act],[data-uid],[data-staff],[data-achat],[data-vendre],[data-doubler],[data-liberer]');
  if (!el) return;
  const d = el.dataset;
  if (d.uid && el.closest('#main')) return basculer(+d.uid);
  if (d.staff != null && !el.classList.contains('vide')) return occupe ? null : voirStaff(+d.staff);
  if (d.achat != null) {
    try { M8R.acheter(E, +d.achat); } catch (err) { return toast(err.message); }
    return rendre();
  }
  if (d.vendre != null) { const v = M8R.vendre(E, +d.vendre); fermer(); toast(`Vendu : +${v} $`); return rendre(); }
  if (d.doubler) { try { M8R.doubler(E, +d.doubler); } catch (err) { return toast(err.message); } fermer(); toast('Un double rejoint ton deck.'); return rendre(); }
  if (d.liberer) { try { M8R.liberer(E, +d.liberer); } catch (err) { return toast(err.message); } fermer(); toast('Joueur libéré.'); return rendre(); }
  switch (d.act) {
    case 'nouvelle': fermer(); return nouvelle();
    case 'jour': return nouvelle('jour-' + new Date().toISOString().slice(0, 10));
    case 'reprendre': {
      try { const s = JSON.parse(lire(CLE)); E = s.E; ecran = s.ecran === 'match' && !E.m ? 'etape' : s.ecran; } catch (err) { return toast('Sauvegarde illisible.'); }
      return rendre();
    }
    case 'regles': return regles();
    case 'fermer': return fermer();
    case 'menu': return menu();
    case 'accueil': fermer(); ecran = 'titre'; return rendre();
    case 'abandon':
      fermer();
      if (E && !E.fini) { E.fini = { victoire: false, etape: E.etape, match: E.match }; noterRecord(); }
      ecran = 'fin'; return rendre();
    case 'vitesse':
      vitesse = vitesse === 1 ? 2 : vitesse === 2 ? 4 : 1;
      ecrire(CLE_VITESSE, vitesse); return menu();
    case 'lancer': return lancer();
    case 'jouer': return jouer();
    case 'remplacer': return remplacer();
    case 'tri': tri = tri === 'essence' ? 'carte' : 'essence'; return rendre();
    case 'deck': return voirDeck();
    case 'boutique': ecran = 'boutique'; return rendre();
    case 'relancer': try { M8R.relancer(E); } catch (err) { return toast(err.message); } return rendre();
    case 'doubler': return voirDeck('doubler');
    case 'liberer': return voirDeck('liberer');
    case 'suivant': ecran = 'etape'; return rendre();
  }
});

addEventListener('resize', () => { if (ecran === 'match') placerMain(); });

rendre();
