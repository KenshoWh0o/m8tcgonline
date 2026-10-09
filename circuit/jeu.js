/* Le Circuit — l'interface.
   L'état vit dans `S` (circuit/moteur.js). Ce fichier le dessine, rejoue
   chaque action en animation à partir des évènements que le moteur rend, et
   le range dans le navigateur après chaque geste. */
"use strict";

CIRCUIT.charger(CARD_DATA);
const C = CIRCUIT;

const CLE = 'circuit.saison', CLE_REC = 'circuit.records', CLE_VIT = 'circuit.vitesse', CLE_AIDE = 'circuit.aide';
const IMG = f => '../cards/' + f;
const imgNum = num => IMG(C.carte(num).fichier);
const ICO_ESS = e => `../assets/essences/${e}.svg`;

let S = null;            /* la saison */
let vue = 'accueil';     /* accueil | jeu */
let occupe = false;
let vitesse = +(lire(CLE_VIT) || 1);
let sel = null;          /* écran de match : { mode: 'cible', uid, atk } | { mode: 'moment', i } */
let choixUi = {};        /* sélections locales des écrans (coach, draft, récompense, ordre) */

/* ---------- Outils ---------- */
function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* mode privé */ } }
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const h = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const dodo = ms => new Promise(r => setTimeout(r, ms / vitesse));
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const coul = e => (C.ESS[e] || { c: '#b9b0c4' }).c;

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), 2400);
}
function sauver() {
  if (S && !S.fini) ecrire(CLE, JSON.stringify(S));
  else if (S && S.fini) ecrire(CLE, '');
}
function records() { try { return JSON.parse(lire(CLE_REC) || '{}'); } catch (e) { return {}; } }
function noterFin() {
  const r = records();
  const rang = S.fini.victoire ? 99 : S.fini.tournoi * 3 + S.fini.tour;
  if (rang > (r.rang ?? -1)) { r.rang = rang; r.loin = texteFin(); }
  r.saisons = (r.saisons || 0) + 1;
  if (S.fini.victoire) r.titres = (r.titres || 0) + 1;
  r.trophees = (r.trophees || 0) + S.palmares.length;
  ecrire(CLE_REC, JSON.stringify(r));
}
const texteFin = () => S.fini.victoire ? 'Champion du monde' : `${C.TOURNOIS[S.fini.tournoi].nom} · ${C.TOURS_TABLEAU[S.fini.tour]}`;

/* ---------- Petits éléments ---------- */
/* L'illustration seule d'une carte (sans ses textes) : le cadre de
   l'image, recadré. Sert aux Coachs, Objets et Moments, dont l'effet ici
   n'est pas celui imprimé, et aux portraits. */
const illu = (num, cls) => `<span class="illu ${cls || ''}" style="background-image:url('${imgNum(num)}')"></span>`;
const gemme = (e, cls) => `<i class="gem ${cls || ''}" style="--e:${coul(e)}"><img src="${ICO_ESS(e)}" alt="${h(C.ESS[e] ? C.ESS[e].nom : e)}"></i>`;
function gemmesCout(cout) {
  const l = [];
  Object.entries(cout).forEach(([e, n]) => { for (let i = 0; i < n; i++) l.push(e === 'neutre' ? '<i class="gem neutre" title="Au choix"></i>' : gemme(e)); });
  return l.join('') || '<i class="gem gratuit">0</i>';
}

/* Un blason pour chaque équipe adverse : une forme, deux couleurs, des
   initiales — tiré de son nom, il ne change jamais. */
function blason(nom, taille) {
  const g = C.graineDe(nom);
  const teinte = Math.abs(g) % 360, t2 = (teinte + 40 + (Math.abs(g >> 8) % 80)) % 360;
  const ini = nom.replace(/^(Les|Team|Le|La)\s+/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const forme = Math.abs(g >> 3) % 3;
  const path = forme === 0 ? 'M50 4 L92 18 L88 62 Q80 86 50 96 Q20 86 12 62 L8 18 Z'
    : forme === 1 ? 'M50 4 L94 30 L94 70 L50 96 L6 70 L6 30 Z' : 'M14 8 H86 V54 Q86 82 50 96 Q14 82 14 54 Z';
  const id = 'b' + Math.abs(g);
  return `<svg class="blason" width="${taille}" height="${taille}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${teinte} 85% 58%)"/><stop offset="1" stop-color="hsl(${t2} 80% 32%)"/></linearGradient></defs>
    <path d="${path}" fill="url(#${id})" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
    <path d="${path}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1" transform="translate(50 50) scale(.86) translate(-50 -50)"/>
    <text x="50" y="${forme === 2 ? 58 : 60}" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="34" fill="#fff">${h(ini)}</text></svg>`;
}
const blasonMoi = taille => `<svg class="blason" width="${taille}" height="${taille}" viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6fd8"/><stop offset=".5" stop-color="#a24cff"/><stop offset="1" stop-color="#4b1590"/></linearGradient></defs>
  <path d="M50 4 L92 18 L88 62 Q80 86 50 96 Q20 86 12 62 L8 18 Z" fill="url(#bm)" stroke="rgba(255,255,255,.6)" stroke-width="3"/>
  <path d="M50 26 L56 44 L75 44 L60 55 L66 74 L50 62 L34 74 L40 55 L25 44 L44 44 Z" fill="#fff"/></svg>`;

/* Ce qu'un Joueur fait dans le Circuit, en clair. */
function reglesJoueur(num) {
  const j = C.joueur(num);
  const l = [];
  if (j.kw) {
    if (C.MOTS[j.kw.nom]) l.push(`<b>${h(j.kw.nom)}</b> ${h(C.MOTS[j.kw.nom])}`);
    else if (j.kw.nom === 'Buff') { const b = C.buffDe(j); if (b) l.push(`<b>Buff</b> Tes autres Joueurs ont +${b.n} ${b.quoi === 'atk' ? 'Attaque' : 'Défense'}.`); }
    else if (C.SIGNATURES[num]) l.push(`<b>Signature</b> ${h(C.SIGNATURES[num])}`);
  }
  if (num === 68 || num === 101) l.push(`<b>Signature</b> ${h(C.SIGNATURES[num])}`);
  return l;
}

/* ---------- Rendu général ---------- */
function ecranCourant() {
  if (vue === 'accueil' || !S) return 'accueil';
  if (S.m) return 'match';
  return S.etape;
}
function rendre() {
  const e = ecranCourant();
  const app = $('#app');
  app.className = 'e-' + e;
  document.body.dataset.ecran = e;
  app.innerHTML = e === 'accueil' ? vAccueil()
    : e === 'coach' ? vCoach()
    : e === 'draft' ? vDraft()
    : e === 'tableau' ? vTableau()
    : e === 'match' ? vMatch()
    : e === 'recompense' ? vRecompense()
    : vFin();
  sauver();
}

/* ---------- Accueil ---------- */
function vAccueil() {
  const r = records();
  let reprise = null;
  try { reprise = JSON.parse(lire(CLE) || 'null'); } catch (e) { /* rien */ }
  const jour = new Date().toISOString().slice(0, 10);
  return `<section class="accueil">
    <div class="ac-cartes" aria-hidden="true">
      <div class="ac-c c1"><img src="${imgNum(116)}" alt=""></div>
      <div class="ac-c c2"><img src="${imgNum(117)}" alt=""></div>
      <div class="ac-c c3"><img src="${imgNum(113)}" alt=""></div>
    </div>
    <div class="ac-titre">
      <span class="ac-kicker">Mate TCG présente</span>
      <h1><span>Le</span>Circuit</h1>
      <p>Une saison esport, des Qualifs aux Worlds. Draft ton équipe, gère tes Essences, et prends le titre.</p>
    </div>
    <div class="ac-actions">
      ${reprise ? `<button class="btn" data-act="reprendre">Reprendre<small>${reprise.m ? 'Match en cours' : h(C.TOURNOIS[reprise.tournoi].nom)} · ${h(C.TOURS_TABLEAU[reprise.tour] || '')}</small></button>` : ''}
      <button class="btn ${reprise ? 'sec' : ''}" data-act="nouvelle">Nouvelle saison</button>
      <button class="btn sec" data-act="jour">Saison du jour<small>${jour.split('-').reverse().join('/')} · la même pour tous</small></button>
      <button class="lien" data-act="regles">Comment jouer</button>
    </div>
    ${r.saisons ? `<p class="ac-rec"><b>${r.saisons}</b> saison${r.saisons > 1 ? 's' : ''} · ${r.titres ? `<b>${r.titres}</b> titre${r.titres > 1 ? 's' : ''} mondia${r.titres > 1 ? 'ux' : 'l'} · ` : ''}plus loin : <b>${h(r.loin || '—')}</b></p>` : ''}
    <a class="ac-retour" href="../">Mate TCG Online</a>
  </section>`;
}

function nouvelleSaison(graine) {
  S = C.nouvelleSaison(graine || ('libre-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
  vue = 'jeu';
  choixUi = {};
  rendre();
}

/* ---------- Coach ---------- */
function vCoach() {
  return `<section class="ecran coach">
    ${vEtapeTete('Avant la saison', 'Choisis ton coach', 'Il reste avec toi toute la saison.')}
    <div class="coachs">${S.offres.map(id => {
      const c = C.COACH[id], k = C.carte(c.num);
      return `<button class="coachc ${choixUi.coach === id ? 'on' : ''}" data-coach="${id}">
        ${illu(c.num, 'grand')}
        <span class="cc-txt"><b>${h(k.nom)}</b><span>${h(c.txt)}</span></span></button>`;
    }).join('')}</div>
    <div class="bas-fixe"><button class="btn" data-act="coach-ok" ${choixUi.coach ? '' : 'disabled'}>Valider</button></div>
  </section>`;
}
function vEtapeTete(kicker, titre, sous) {
  return `<header class="et-tete"><button class="ico" data-act="menu" aria-label="Menu">${ICO.menu}</button>
    <div><span class="kicker">${h(kicker)}</span><h2>${h(titre)}</h2>${sous ? `<p>${h(sous)}</p>` : ''}</div></header>`;
}

/* ---------- Draft ---------- */
function vDraft() {
  const d = S.draft;
  return `<section class="ecran draft">
    ${vEtapeTete(`Draft · choix ${d.tour + 1} sur 5`, 'Compose ton équipe', 'Les trois premiers commencent sur le terrain.')}
    <div class="dr-slots">${[0, 1, 2, 3, 4].map(i => {
      const x = S.roster[i];
      return `<span class="dr-slot ${x ? 'plein' : i === d.tour ? 'actuel' : ''}">${x ? illu(x.num, 'rond') : i < 3 ? 'T' : 'B'}</span>`;
    }).join('')}</div>
    <div class="dr-choix">${d.choix.map((num, i) => vChoixJoueur(num, choixUi.draft === num, i)).join('')}</div>
    <div class="bas-fixe"><button class="btn" data-act="draft-ok" ${choixUi.draft ? '' : 'disabled'}>Recruter${choixUi.draft ? ` <small>${h(C.joueur(choixUi.draft).nom)}</small>` : ''}</button></div>
  </section>`;
}
function vChoixJoueur(num, on, i) {
  const j = C.joueur(num);
  return `<button class="jc ${on ? 'on' : ''}" data-draft="${num}" style="--e:${coul(j.ess)};--i:${i || 0}">
    <span class="jc-carte"><img src="${IMG(j.img)}" alt="${h(j.nom)}"></span>
    <span class="jc-stats">
      <span class="jc-def"><b>${j.def}</b> Défense</span>
      ${j.atks.map(a => `<span class="jc-atk">${gemmesCout(a.cout)}<b>${a.degats != null ? a.degats : '—'}</b></span>`).join('')}
      ${reglesJoueur(num).slice(0, 1).map(t => `<span class="jc-kw">${t}</span>`).join('')}
    </span></button>`;
}

/* ---------- Le tableau : entre deux matchs ---------- */
function vTableau() {
  const t = C.TOURNOIS[S.tournoi];
  const adv = C.equipeAdverse(S);
  const etapes = C.TOURS_TABLEAU.map((n, i) => `<li class="${i < S.tour ? 'fait' : i === S.tour ? 'actuel' : ''}"><i></i><span>${h(n)}</span></li>`).join('');
  const ordre = choixUi.ordre;
  return `<section class="ecran tableau">
    <header class="tb-tete">
      <button class="ico" data-act="menu" aria-label="Menu">${ICO.menu}</button>
      <div class="tb-titre"><span class="kicker">Tournoi ${S.tournoi + 1} / 3 · ${h(t.sous)}</span><h1>${h(t.nom)}</h1></div>
      <div class="tb-trophees">${C.TOURNOIS.map((x, i) => `<i class="tr ${S.palmares.includes(x.nom) ? 'gagne' : ''}" title="${h(x.nom)}">${ICO.trophee}</i>`).join('')}</div>
    </header>
    <ol class="bracket">${etapes}</ol>
    ${S.perdants ? '<p class="tb-alerte">Tableau des perdants : une victoire pour revenir, une défaite et c\'est fini.</p>'
      : S.defaites ? '<p class="tb-alerte doux">Tu as déjà perdu une fois dans ce tournoi : plus de seconde chance.</p>'
      : '<p class="tb-info">Double élimination : une défaite t\'envoie au tableau des perdants.</p>'}
    <div class="affiche">
      <div class="af-equipe moi">${blasonMoi(64)}<b>Ton équipe</b><small>${h(C.carte(C.COACH[S.coach].num).nom)} au coaching</small></div>
      <span class="af-vs">VS</span>
      <div class="af-equipe eux">${blason(adv.nom, 64)}<b>${h(adv.nom)}</b><small>${S.perdants ? 'Rattrapage' : h(C.TOURS_TABLEAU[S.tour])}${adv.finale ? ' · finale mondiale' : ''}</small></div>
    </div>
    <div class="af-roster">${adv.roster.map(x => `<span class="af-j" style="--e:${coul(C.joueur(x.num).ess)}">${illu(x.num, 'rond')}</span>`).join('')}</div>

    <h3 class="sec-titre">Ton équipe <small>touche deux Joueurs pour les échanger</small></h3>
    <div class="roster">${S.roster.map((x, i) => vMembre(x, i, ordre === x.uid)).join('')}</div>

    <div class="prep">
      <div class="prep-bloc"><h4>Réserve <small>${S.reserve.length} Essences</small></h4><div class="reserve">${vReserve(S.reserve)}</div></div>
      <div class="prep-bloc"><h4>Moments <small>${S.moments.length} / ${C.MOMENTS_MAX}</small></h4><div class="moments-l">${S.moments.length
        ? S.moments.map(id => `<button class="mo-mini" data-info-moment="${id}">${illu(C.MOMENT[id].num, 'rond')}<span>${h(C.carte(C.MOMENT[id].num).nom)}</span></button>`).join('')
        : '<span class="vide-txt">Aucun pour l\'instant</span>'}</div></div>
    </div>
    <div class="bas-fixe"><button class="btn grand" data-act="jouer-match">Lancer le match</button></div>
  </section>`;
}
function vMembre(x, i, choisi) {
  const j = C.joueur(x.num);
  return `<button class="membre ${i < 3 ? 'titulaire' : 'remplacant'} ${choisi ? 'on' : ''}" data-membre="${x.uid}" style="--e:${coul(j.ess)}">
    <span class="mb-pos">${i < 3 ? 'Titulaire' : 'Banc'}</span>
    <span class="mb-carte"><img src="${IMG(j.img)}" alt="${h(j.nom)}"></span>
    ${x.objets.length || x.atk || x.def ? `<span class="mb-plus">${x.objets.map(id => illu(C.OBJET[id].num, 'rond mini')).join('')}${x.atk || x.def ? `<i class="mb-boot">+${x.atk}/${x.def}</i>` : ''}</span>` : ''}
  </button>`;
}
function vReserve(l) {
  const n = {};
  l.forEach(e => { n[e] = (n[e] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([e, k]) => `<span class="res-c">${gemme(e)}<b>${k}</b></span>`).join('');
}

/* ---------- Le match ---------- */
function vMatch() {
  const m = S.m;
  const moi = m.camps.moi, eux = m.camps.eux;
  const pips = (k, camp) => [0, 1, 2].map(i => `<i class="pip ${i < k.pv ? 'on' : ''}" data-pip="${camp}-${i}"></i>`).join('');
  return `<section class="match ${m.trait === 'moi' ? 'mon-tour' : 'son-tour'}">
    <header class="tableau-score">
      <div class="ts-equipe moi">${blasonMoi(30)}<span class="ts-id"><span class="ts-nom">Toi</span><span class="pips">${pips(moi, 'moi')}</span></span></div>
      <div class="ts-centre"><span class="ts-score"><b>${m.score.moi}</b><i>–</i><b>${m.score.eux}</b></span><small>Manche ${m.manche} · Tour ${Math.min(m.tour, C.R.tours)}/${C.R.tours}</small></div>
      <div class="ts-equipe eux"><span class="ts-id"><span class="ts-nom">${h(m.adv.nom)}</span><span class="pips">${pips(eux, 'eux')}</span></span>${blason(m.adv.nom, 30)}</div>
    </header>
    <div class="rang eux"><div class="terrain">${eux.terrain.map(u => vUnite(u, 'eux')).join('')}</div></div>
    <div class="arene">
      <div class="ar-haut"><div class="banc"><span class="banc-lab">Banc</span>${eux.banc.map(u => vBanc(u)).join('')}</div>
        <div class="res-adv" title="Essences de l'adversaire">${eux.main.map(e => gemme(e, 'mini')).join('')}</div></div>
      <div class="ar-milieu"><i class="ar-ligne"></i><div class="bandeau" id="bandeau">${texteBandeau()}</div><i class="ar-ligne"></i></div>
      <div class="ar-bas"><div class="banc">${moi.banc.map(u => vBanc(u)).join('')}<span class="banc-lab">Banc</span></div></div>
    </div>
    <div class="rang moi"><div class="terrain">${moi.terrain.map(u => vUnite(u, 'moi')).join('')}</div></div>
    <footer class="dock">
      <div class="essences" id="essences">${moi.main.map(e => gemme(e)).join('') || '<span class="vide-txt">Aucune Essence</span>'}</div>
      <div class="dock-actions">
        <div class="moments">${m.moments.map((mo, i) => `<button class="mo ${mo.joue ? 'joue' : ''}" data-moment="${i}" ${mo.joue ? 'disabled' : ''} aria-label="${h(C.carte(C.MOMENT[mo.id].num).nom)}">${illu(C.MOMENT[mo.id].num, 'rond')}</button>`).join('')}
          ${m.pause ? `<button class="mo pause" data-act="pause" aria-label="Pause technique">${illu(26, 'rond')}</button>` : ''}</div>
        <button class="btn fin-tour" data-act="fin-tour" ${m.trait === 'moi' && !m.entreManches && !m.fini ? '' : 'disabled'}>Fin du tour</button>
      </div>
    </footer>
    ${m.entreManches ? vEntreManches() : ''}
  </section>`;
}

function texteBandeau() {
  const m = S.m;
  if (m.entreManches || m.fini) return '';
  if (sel && sel.mode === 'cible') return `Choisis une cible <button class="lien" data-act="annuler">Annuler</button>`;
  if (sel && sel.mode === 'moment') return `${h(C.carte(C.MOMENT[m.moments[sel.i].id].num).nom)} : choisis un Joueur <button class="lien" data-act="annuler">Annuler</button>`;
  if (m.trait !== 'moi') return `<span class="b-eux">${h(m.adv.nom)} joue…</span>`;
  const libres = C.tous(m, 'moi').filter(u => !u.agi && !u.bloque);
  if (!lire(CLE_AIDE) && m.tour === 1 && m.manche === 1) return 'Touche un de tes Joueurs pour agir';
  return libres.length ? `<span class="b-moi">À toi</span> · ${libres.length} Joueur${libres.length > 1 ? 's' : ''} prêt${libres.length > 1 ? 's' : ''}` : '<span class="b-moi">À toi</span> · plus personne ne peut agir';
}

function vUnite(u, camp) {
  if (!u) return '<div class="u vide"></div>';
  const j = C.joueur(u.num);
  const pct = Math.max(0, u.vie / u.defMax * 100);
  const m = S.m;
  const cls = [camp,
    u.agi && camp === m.trait ? 'agi' : '', u.bloque ? 'bloque' : '', u.engage ? 'engage' : '',
    sel && sel.mode === 'cible' && sel.cibles.includes(u.uid) ? 'cible' : '',
    sel && sel.mode === 'moment' && sel.cibles.includes(u.uid) ? 'cible-amie' : '',
    sel && sel.uid === u.uid ? 'choisi' : '',
    C.provoque(m, u) ? 'provoc' : ''].filter(Boolean).join(' ');
  return `<button class="u ${cls}" data-u="${u.uid}" data-max="${u.defMax}" style="--e:${coul(j.ess)}">
    <span class="u-carte"><img src="${IMG(j.img)}" alt="${h(j.nom)}" draggable="false"></span>
    <span class="u-vie ${pct < 34 ? 'bas' : pct < 67 ? 'moyen' : ''}"><i style="width:${pct}%"></i><b>${u.vie}</b></span>
    <span class="u-etats">${u.shield ? `<i class="et sh" title="Shield">${ICO.shield}</i>` : ''}${C.provoque(m, u) ? `<i class="et pr" title="Provocation">${ICO.cible}</i>` : ''}${u.bloque || u.engage ? `<i class="et en" title="Engagé">${ICO.chaine}</i>` : ''}</span>
  </button>`;
}
function vBanc(u) {
  const j = C.joueur(u.num);
  const pct = Math.max(0, u.vie / u.defMax * 100);
  return `<button class="bn" data-u="${u.uid}" data-max="${u.defMax}" style="--e:${coul(j.ess)};--p:${pct}%" aria-label="${h(j.nom)} (banc)">${illu(u.num, 'rond')}</button>`;
}

function vEntreManches() {
  const m = S.m;
  const perdu = m.perdantManche === 'moi';
  return `<div class="entre-manches">
    <div class="em-carte">
      <span class="kicker">Fin de la manche ${m.manche}</span>
      <h2 class="${perdu ? 'perdu' : 'gagne'}">${perdu ? 'Manche perdue' : 'Manche gagnée'}</h2>
      <p class="em-score"><b>${m.score.moi}</b> – <b>${m.score.eux}</b></p>
      <p class="em-txt">${perdu ? 'Tu commences la prochaine.' : `${h(m.adv.nom)} commence la prochaine.`} Tout le monde repart frais : choisis tes titulaires.</p>
      <div class="roster petit">${S.roster.map((x, i) => vMembre(x, i, choixUi.ordre === x.uid)).join('')}</div>
      <button class="btn grand" data-act="manche-suivante">Manche ${m.manche + 1}</button>
    </div>
  </div>`;
}

/* ---------- Les gestes du match ---------- */
function toucherUnite(uid) {
  const m = S.m;
  if (occupe) return;
  const u = C.trouver(m, uid);
  if (!u) return;
  if (sel && sel.mode === 'cible') {
    if (sel.cibles.includes(uid)) return executer(() => sel.special ? C.speciale(S, sel.uid, sel.special, uid) : C.attaquer(S, sel.uid, sel.atk, uid));
    sel = null; return rendre();
  }
  if (sel && sel.mode === 'moment') {
    if (sel.cibles.includes(uid)) { const i = sel.i; return executer(() => C.jouerMoment(S, i, uid)); }
    sel = null; return rendre();
  }
  if (u.camp === 'moi' && m.trait === 'moi' && m.camps.moi.terrain.includes(u)) return ficheAction(u);
  ficheJoueur(u);
}

function ficheAction(u) {
  const j = C.joueur(u.num);
  const o = C.options(S, u.uid);
  const pourquoi = u.bloque ? 'Engagé : il ne peut pas agir ce tour.' : u.agi ? 'Il a déjà agi ce tour.' : '';
  const k = S.m.camps.moi;
  feuille(`<div class="fa-tete" style="--e:${coul(j.ess)}">
      <span class="fa-carte"><img src="${IMG(j.img)}" alt=""></span>
      <div><b>${h(j.nom)}</b><span class="fa-vie">${u.vie} / ${u.defMax} Défense</span>
        ${reglesJoueur(u.num).map(t => `<p class="fa-regle">${t}</p>`).join('')}</div>
    </div>
    ${pourquoi ? `<p class="fa-pourquoi">${pourquoi}</p>` : ''}
    <div class="fa-atks">${o.attaques.map(a => `<button class="atk ${a.possible ? '' : 'off'}" data-atk="${a.i}" data-uid="${u.uid}" ${a.possible ? '' : 'disabled'}>
      <span class="atk-cout">${gemmesCout(a.cout)}</span>
      <span class="atk-nom">${h(a.nom)}${a.degats != null && a.valeur !== a.degats ? `<small class="atk-calc">${a.degats} sur la carte, ${a.valeur > a.degats ? '+' : ''}${a.valeur - a.degats} ici</small>` : ''}${a.effet ? `<small>${h(a.effet)}</small>` : ''}</span>
      <span class="atk-val">${a.degats != null ? a.valeur : '—'}</span></button>`).join('')}
      ${o.speciales.map(sp => `<button class="atk spec ${sp.possible ? '' : 'off'}" data-special="${sp.id}" data-uid="${u.uid}" ${sp.possible ? '' : 'disabled'}>
        <span class="atk-cout">${sp.id === 'monster' ? gemmesCout({ neutre: 2 }) : '<i class="gem gratuit">0</i>'}</span>
        <span class="atk-nom">${h(sp.nom)}<small>${h(sp.txt)}</small></span><span class="atk-val">★</span></button>`).join('')}
    </div>
    ${k.banc.length ? `<div class="fa-banc"><h4>Faire entrer un remplaçant <small>1 Essence au choix · il ne joue pas ce tour</small></h4>
      <div class="fa-bn">${k.banc.map(b => `<button class="bn-choix" data-rotation="${u.uid}" data-entre="${b.uid}" ${o.rotation ? '' : 'disabled'} style="--e:${coul(C.joueur(b.num).ess)}">
        ${illu(b.num, 'rond')}<span>${h(C.joueur(b.num).nom)}<small>${b.vie} / ${b.defMax}</small></span></button>`).join('')}</div></div>` : ''}
  `, 'action');
}

function choisirAttaque(uid, i) {
  const o = C.options(S, uid);
  const a = o.attaques[i];
  if (!a || !a.possible) return;
  const atk = C.joueur(C.trouver(S.m, uid).num).atks[i];
  const besoin = atk.degats != null || ['engage', 'bench'].includes((C.effetDe(atk) || {}).type);
  fermer();
  if (!besoin) return executer(() => C.attaquer(S, uid, i, null));
  if (a.cibles.length === 1) return executer(() => C.attaquer(S, uid, i, a.cibles[0]));
  sel = { mode: 'cible', uid, atk: i, cibles: a.cibles };
  rendre();
}
function choisirSpeciale(uid, id) {
  fermer();
  if (id === 'monster') return executer(() => C.speciale(S, uid, id));
  const cibles = C.tous(S.m, 'eux').map(x => x.uid);
  sel = { mode: 'cible', uid, special: id, cibles };
  rendre();
}

function ficheMoment(i) {
  const m = S.m, mo = m.moments[i], d = C.MOMENT[mo.id], k = C.carte(d.num);
  feuille(`<div class="fm">${illu(d.num, 'large')}<div><b>${h(k.nom)}</b><p>${h(d.txt)}</p><span class="fm-cout">Coût ${gemmesCout(d.cout ? { neutre: d.cout } : {})}</span></div></div>
    <p class="petit">Un Moment se joue une fois par match.</p>`, '',
    m.trait === 'moi' && !mo.joue ? `<button class="btn" data-jouer-moment="${i}">Jouer</button>` : '');
}
function lancerMoment(i) {
  const m = S.m, d = C.MOMENT[m.moments[i].id];
  fermer();
  const amis = C.tous(m, 'moi');
  let cibles = null;
  if (d.cible === 'allie') cibles = amis.map(u => u.uid);
  if (d.cible === 'allieAgi') cibles = amis.filter(u => u.agi && !u.bloque).map(u => u.uid);
  if (d.cible === 'rotation') cibles = m.camps.moi.banc.length ? amis.map(u => u.uid) : [];
  if (d.cible === 'adverse') cibles = C.tous(m, 'eux').map(u => u.uid);
  if (!cibles) return executer(() => C.jouerMoment(S, i));
  if (!cibles.length) return toast('Aucun Joueur ne s\'y prête.');
  sel = { mode: 'moment', i, cibles };
  rendre();
}

/* Une action : le moteur décide, l'écran rejoue. */
async function executer(fn) {
  if (occupe) return;
  let ev;
  try { ev = fn(); } catch (e) { sel = null; toast(e.message); return rendre(); }
  sel = null;
  ecrire(CLE_AIDE, '1');
  occupe = true;
  document.body.classList.add('occupe');
  await jouerEvenements(ev);
  occupe = false;
  document.body.classList.remove('occupe');
  rendre();
  await apres();
}

/* Après une action : la fin d'un match, sinon le tour de l'adversaire. */
async function apres() {
  const m = S.m;
  if (!m) return;
  if (m.fini) return finDeMatch();
  if (m.entreManches) return;
  if (m.trait === 'eux') return tourAdverse();
}

async function finTourMoi() {
  if (occupe || S.m.trait !== 'moi') return;
  sel = null;
  occupe = true;
  document.body.classList.add('occupe');
  const ev = C.finTour(S);
  await jouerEvenements(ev);
  occupe = false;
  document.body.classList.remove('occupe');
  rendre();
  await apres();
}

async function tourAdverse() {
  occupe = true;
  document.body.classList.add('occupe');
  rendre();
  await dodo(450);
  let x, garde = 0;
  while (garde++ < 14 && (x = C.iaPas(S))) {
    await jouerEvenements(x);
    rendre();
    await dodo(300);
    if (S.m.fini || S.m.entreManches) break;
  }
  if (!S.m.fini && !S.m.entreManches) {
    const ev = C.finTour(S);
    await jouerEvenements(ev);
  }
  occupe = false;
  document.body.classList.remove('occupe');
  rendre();
  if (S.m.fini) return finDeMatch();
  if (S.m.trait === 'eux' && !S.m.entreManches) return tourAdverse();
}

async function mancheSuivante() {
  const ev = C.mancheSuivante(S);
  choixUi.ordre = null;
  rendre();
  occupe = true;
  await jouerEvenements(ev);
  occupe = false;
  rendre();
  if (S.m.trait === 'eux') tourAdverse();
}

async function finDeMatch() {
  /* Une seule fois, même si deux chemins y mènent en même temps. */
  if (!S.m || S.m.cloture) return;
  S.m.cloture = true;
  const gagne = S.m.fini.gagnant === 'moi';
  await grandMessage(gagne ? 'Victoire' : 'Défaite', gagne ? 'or' : 'rouge', `${S.m.score.moi} – ${S.m.score.eux} contre ${S.m.adv.nom}`, 1700);
  const r = C.finMatch(S);
  choixUi = {};
  if (r.trophee) await grandMessage(`${r.trophee} remporté`, 'or', 'Un trophée de plus dans la vitrine', 1900);
  if (S.fini) noterFin();
  rendre();
}

/* ---------- Les animations ---------- */
const el = uid => document.querySelector(`[data-u="${uid}"]`);

function flotter(cible, txt, genre) {
  if (!cible) return;
  const r = cible.getBoundingClientRect();
  const b = document.createElement('span');
  b.className = 'flotte ' + (genre || '');
  b.textContent = txt;
  b.style.left = (r.left + r.width / 2) + 'px';
  b.style.top = (r.top + r.height * .35) + 'px';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1300 / vitesse + 200);
}

function bandeau(txt, genre) {
  const b = $('#bandeau');
  if (!b) return;
  b.innerHTML = `<span class="b-flash ${genre || ''}">${txt}</span>`;
}

async function grandMessage(titre, genre, sous, ms) {
  const d = document.createElement('div');
  d.className = 'grand-msg ' + (genre || '');
  d.innerHTML = `<div><h2>${h(titre)}</h2>${sous ? `<p>${h(sous)}</p>` : ''}</div>${genre === 'or' ? '<i class="confettis"></i>' : ''}`;
  document.body.appendChild(d);
  await dodo(ms || 1200);
  d.classList.add('sort');
  await dodo(300);
  d.remove();
}

function anim(e, frames, opts) {
  if (!e || RM()) return Promise.resolve();
  return e.animate(frames, Object.assign({ duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' }, opts, { duration: (opts && opts.duration || 400) / vitesse })).finished.catch(() => {});
}

async function jouerEvenements(ev) {
  const m = S.m;
  for (const e of ev) {
    switch (e.t) {
      case 'manche':
        await grandMessage(`Manche ${e.n}`, '', e.premier === 'moi' ? 'Tu commences' : `${m.adv.nom} commence`, 1000);
        break;
      case 'tour':
        rendre();
        if (e.camp === 'moi') bandeau('À toi de jouer', 'moi');
        else bandeau(`Tour de ${h(m.adv.nom)}`, 'eux');
        await dodo(e.camp === 'moi' ? 500 : 650);
        break;
      case 'essence': {
        if (e.camp !== 'moi') break;
        const zone = $('#essences');
        if (zone) {
          const v = zone.querySelector('.vide-txt'); if (v) v.remove();
          zone.insertAdjacentHTML('beforeend', gemme(e.ess, 'nouv'));
        }
        await dodo(110);
        break;
      }
      case 'attaque': {
        const a = el(e.de), c = e.vers != null ? el(e.vers) : null;
        if (e.camp === 'moi') {
          const zone = $('#essences');
          e.payees.forEach(ess => {
            const g = zone && [...zone.querySelectorAll('.gem:not(.part)')].find(x => x.style.getPropertyValue('--e') === coul(ess));
            if (g) g.classList.add('part');
          });
        }
        bandeau(`<b>${h(C.joueur(C.trouver(m, e.de) ? C.trouver(m, e.de).num : 0)?.nom || '')}</b> · ${h(e.nom)}`, e.camp);
        if (a) a.classList.add('actif');
        if (a && c) {
          const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
          const dx = (rc.left + rc.width / 2 - ra.left - ra.width / 2) * .55, dy = (rc.top + rc.height / 2 - ra.top - ra.height / 2) * .55;
          await anim(a, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .15}px,${dy * .15}px) scale(1.06)`, offset: .35 },
            { transform: `translate(${dx}px,${dy}px) scale(1.1)`, offset: .7 }, { transform: 'translate(0,0) scale(1)' }], { duration: 520 });
        } else await dodo(380);
        if (a) a.classList.remove('actif');
        break;
      }
      case 'degats': {
        const c = el(e.vers);
        if (c) {
          const max = +c.dataset.max || 1;
          const barre = c.querySelector('.u-vie i'), nb = c.querySelector('.u-vie b');
          if (barre) barre.style.width = Math.max(0, e.vie / max * 100) + '%';
          if (nb) nb.textContent = e.vie;
          c.querySelector('.u-vie') && c.querySelector('.u-vie').classList.toggle('bas', e.vie / max < .34);
          c.classList.remove('touche'); void c.offsetWidth; c.classList.add('touche');
          flotter(c, '−' + e.n, e.n >= 150 ? 'gros' : 'deg');
          if (e.n >= 150) { document.body.classList.remove('secousse'); void document.body.offsetWidth; document.body.classList.add('secousse'); }
        }
        await dodo(420);
        break;
      }
      case 'shield': flotter(el(e.vers), 'Shield', 'info'); await dodo(500); break;
      case 'garde': flotter(el(e.de), 'Garde !', 'info'); await dodo(500); break;
      case 'rate': flotter(el(e.vers), 'Raté', 'info'); await dodo(500); break;
      case 'riposte': flotter(el(e.de), 'Riposte', 'info'); await dodo(350); break;
      case 'engage': { const c = el(e.vers); if (c) c.classList.add('engage'); flotter(c, 'Engagé', 'engage'); await dodo(450); break; }
      case 'desengage': flotter(el(e.vers), 'Désengagé', 'soin'); await dodo(300); break;
      case 'bloque': break;
      case 'soin': flotter(el(e.vers), '+' + e.n, 'soin'); await dodo(300); break;
      case 'boost': flotter(el(e.vers), `+${e.n} Attaque`, 'info'); await dodo(350); break;
      case 'gainShield': flotter(el(e.vers), 'Shield', 'info'); await dodo(350); break;
      case 'ko': {
        const c = el(e.vers);
        if (c) { c.classList.add('ko'); await dodo(650); }
        const pip = document.querySelector(`[data-pip="${e.pour}-${e.pv - 1}"]`);
        if (pip) { pip.classList.add('on', 'eclat'); }
        await dodo(350);
        break;
      }
      case 'legion': flotter(el(e.vers), 'Légion', 'info'); await dodo(400); break;
      case 'entree': case 'rotation': case 'bench': {
        rendre();
        const entrant = el(e.entre || e.vers);
        if (entrant) { entrant.classList.add('entre'); }
        if (e.t === 'bench') flotter(el(e.entre), 'Renvoyé au banc', 'info');
        await dodo(420);
        break;
      }
      case 'reserve': if (e.camp === 'moi') toast(`+${e.n} Essence${e.n > 1 ? 's' : ''} ${C.ESS[e.ess].nom}${e.n > 1 ? 's' : ''} dans ta Réserve`); await dodo(250); break;
      case 'moment': {
        const d = e.id === 'pause' ? { num: 26 } : C.MOMENT[e.id];
        await grandMessage(C.carte(d.num).nom, 'moment', e.id === 'pause' ? 'Pause technique' : 'Moment', 900);
        break;
      }
      case 'speciale': flotter(el(e.de), e.nom, 'info'); await dodo(400); break;
      case 'mancheFin':
        rendre();
        await grandMessage(e.gagnant === 'moi' ? 'Manche gagnée' : 'Manche perdue', e.gagnant === 'moi' ? 'or' : 'rouge',
          `${e.score.moi} – ${e.score.eux}${e.temps ? ' · au temps' : ''}`, 1200);
        break;
      case 'fin': break;
    }
  }
}

/* ---------- Récompense ---------- */
function vRecompense() {
  const o = S.offres || [];
  const pris = choixUi.recompense;
  const besoin = pris != null ? cibleRequise(o[pris]) : null;
  return `<section class="ecran recompense">
    ${vEtapeTete('Victoire', 'Choisis ta récompense', besoin ? texteBesoin(besoin) : 'Une seule. Choisis bien.')}
    ${besoin ? vChoixCible(o[pris], besoin) : `<div class="offres">${o.map((x, i) => vOffre(x, i)).join('')}</div>`}
    <div class="bas-fixe">
      ${besoin ? '<button class="lien" data-act="rec-retour">Changer de récompense</button>'
        : '<button class="lien" data-act="rec-passer">Ne rien prendre</button>'}
    </div>
  </section>`;
}
function cibleRequise(x) {
  if (!x) return null;
  if (x.type === 'joueur') return 'remplace';
  if (x.type === 'objet' || x.type === 'bootcamp') return 'joueur';
  if (x.type === 'moment' && S.moments.length >= C.MOMENTS_MAX) return 'moment';
  return null;
}
const texteBesoin = b => b === 'remplace' ? 'Qui lui laisse sa place ?' : b === 'moment' ? 'Quel Moment remplacer ?' : 'Pour quel Joueur ?';
function vOffre(x, i) {
  if (x.type === 'joueur') {
    const j = C.joueur(x.num);
    return `<button class="offre o-joueur" data-offre="${i}" style="--e:${coul(j.ess)};--i:${i}">
      <span class="of-type">Recrue · ${h(C.RARS[j.rar])}</span>
      <span class="of-carte"><img src="${IMG(j.img)}" alt="${h(j.nom)}"></span>
      <span class="of-txt"><b>${h(j.nom)}</b><span>${j.def} Défense · ${j.atks.map(a => `${a.degats != null ? a.degats : '—'}`).join(' / ')} Attaque</span>${reglesJoueur(x.num).slice(0, 1).map(t => `<small>${t}</small>`).join('')}</span></button>`;
  }
  if (x.type === 'objet') {
    const d = C.OBJET[x.id];
    return `<button class="offre o-objet" data-offre="${i}" style="--i:${i}"><span class="of-type">Objet</span>${illu(d.num, 'large')}
      <span class="of-txt"><b>${h(C.carte(d.num).nom)}</b><span>${h(d.txt)}</span><small>Lié à un Joueur, deux au plus.</small></span></button>`;
  }
  if (x.type === 'moment') {
    const d = C.MOMENT[x.id];
    return `<button class="offre o-moment" data-offre="${i}" style="--i:${i}"><span class="of-type">Moment</span>${illu(d.num, 'large')}
      <span class="of-txt"><b>${h(C.carte(d.num).nom)}</b><span>${h(d.txt)}</span><small>Une fois par match · coût ${d.cout}</small></span></button>`;
  }
  if (x.type === 'essences') {
    return `<button class="offre o-ess" data-offre="${i}" style="--i:${i};--e:${coul(x.ess)}"><span class="of-type">Réserve</span>
      <span class="of-gems">${gemme(x.ess, 'xl')}${gemme(x.ess, 'xl')}</span>
      <span class="of-txt"><b>+${x.n} Essences ${h(C.ESS[x.ess].nom)}s</b><span>Elles rejoignent ta Réserve pour toute la saison.</span></span></button>`;
  }
  return `<button class="offre o-boot" data-offre="${i}" style="--i:${i}"><span class="of-type">Bootcamp</span>
    <span class="of-ico">${ICO.haltere}</span>
    <span class="of-txt"><b>Bootcamp</b><span>Un Joueur gagne +${x.atk} Attaque et +${x.def} Défense, pour la saison.</span></span></button>`;
}
function vChoixCible(x, besoin) {
  if (besoin === 'moment') {
    return `<div class="cible-l">${S.moments.map(id => `<button class="cible-m" data-rec-cible="${id}">${illu(C.MOMENT[id].num, 'large')}<b>${h(C.carte(C.MOMENT[id].num).nom)}</b><span>${h(C.MOMENT[id].txt)}</span></button>`).join('')}</div>`;
  }
  return `<div class="roster choix">${S.roster.map((m, i) => `<button class="membre" data-rec-cible="${m.uid}" style="--e:${coul(C.joueur(m.num).ess)}">
    <span class="mb-pos">${i < 3 ? 'Titulaire' : 'Banc'}</span><span class="mb-carte"><img src="${imgNum(m.num)}" alt=""></span>
    ${m.objets.length ? `<span class="mb-plus">${m.objets.map(id => illu(C.OBJET[id].num, 'rond mini')).join('')}</span>` : ''}</button>`).join('')}</div>
    ${x.type === 'objet' ? '<p class="petit centre">Un Joueur qui a déjà deux Objets perd le plus ancien.</p>' : ''}`;
}

/* ---------- Fin de saison ---------- */
function vFin() {
  const v = S.fini.victoire;
  return `<section class="ecran fin ${v ? 'victoire' : ''}">
    <div class="fin-haut">
      <span class="kicker">${v ? 'Saison terminée' : 'Éliminé'}</span>
      <h1>${v ? 'Champion du monde' : h(texteFin())}</h1>
      <div class="fin-trophees">${C.TOURNOIS.map(x => `<span class="ft ${S.palmares.includes(x.nom) ? 'gagne' : ''}">${ICO.trophee}<b>${h(x.nom)}</b></span>`).join('')}</div>
    </div>
    <ul class="fin-stats">
      <li><span>Matchs gagnés</span><b>${S.stats.victoires} / ${S.stats.matchs}</b></li>
      <li><span>Joueurs mis hors jeu</span><b>${S.stats.ko}</b></li>
      <li><span>Plus gros coup</span><b>${fmt(S.stats.meilleurCoup)}</b></li>
      <li><span>Coach</span><b>${h(C.carte(C.COACH[S.coach].num).nom)}</b></li>
    </ul>
    <div class="fin-equipe">${S.roster.map(x => `<span class="fe">${illu(x.num, 'rond')}<small>${h(C.joueur(x.num).nom)}</small></span>`).join('')}</div>
    <div class="bas-fixe"><button class="btn grand" data-act="nouvelle">Nouvelle saison</button><button class="lien" data-act="accueil">Accueil</button></div>
  </section>`;
}

/* ---------- Feuilles ---------- */
function feuille(corps, cls, actions) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-fond" data-act="fermer"></div><div class="sh ${cls || ''}">
    <button class="sh-x" data-act="fermer" aria-label="Fermer">${ICO.x}</button>
    <div class="sh-corps">${corps}</div>${actions ? `<div class="sh-actions">${actions}</div>` : ''}</div>`;
  s.hidden = false;
}
function fermer() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }

function ficheJoueur(u) {
  const j = C.joueur(u.num);
  const objets = (u.objets || []).map(id => C.OBJET[id]);
  feuille(`<div class="fj">
      <span class="fj-carte"><img src="${IMG(j.img)}" alt="${h(j.nom)}"></span>
      <div class="fj-txt">
        <span class="kicker">${u.camp === 'eux' ? h(S.m.adv.nom) : 'Ton équipe'} · ${h(C.RARS[j.rar])}</span>
        <b>${h(j.nom)}</b>
        <span class="fa-vie">${u.vie} / ${u.defMax} Défense${u.bloque ? ' · engagé' : ''}${u.shield ? ' · Shield' : ''}</span>
        ${j.atks.map(a => `<p class="fj-atk">${gemmesCout(a.cout)} <b>${h(a.nom)}</b> ${a.degats != null ? a.degats : ''}${C.texteEffet(a) ? `<small>${h(C.texteEffet(a))}</small>` : ''}</p>`).join('')}
        ${reglesJoueur(u.num).map(t => `<p class="fa-regle">${t}</p>`).join('')}
        ${objets.map(o => `<p class="fa-regle"><b>${h(C.carte(o.num).nom)}</b> ${h(o.txt)}</p>`).join('')}
      </div></div>`);
}

function regles() {
  feuille(`<div class="regles">
    <h2>Comment jouer</h2>
    <p class="rg-intro">Une saison : trois tournois, des Qualifs aux Worlds. Chaque match se joue en deux manches gagnantes.</p>
    <div class="rg"><i>${ICO.terrain}</i><p><b>Trois sur le terrain, deux sur le banc.</b> Les chiffres imprimés sur les cartes comptent : la Défense est la résistance d'un Joueur, ses attaques coûtent les Essences dessinées et font les dégâts écrits.</p></div>
    <div class="rg"><i>${gemme('rose')}</i><p><b>Les Essences.</b> À chaque tour, tu en tires trois de ta Réserve. Un coût coloré exige sa couleur ; un rond gris accepte n'importe laquelle. Celles que tu ne dépenses pas restent pour le tour suivant.</p></div>
    <div class="rg"><i>${ICO.cible}</i><p><b>Un Joueur agit une fois par tour.</b> Touche-le, choisis une attaque, puis sa cible. Mettre un Joueur adverse hors jeu rapporte un PV : le premier à 3 PV prend la manche.</p></div>
    <div class="rg"><i>${ICO.chaine}</i><p><b>Engagé</b> : il ne pourra pas agir à son prochain tour. <b>Provocation</b> : on doit le viser. <b>Shield</b> : la première attaque ne passe pas. <b>Garde</b> : il protège un allié. <b>Riposte</b>, <b>Légion</b>, <b>Buff</b> et certaines <b>Signatures</b> jouent aussi.</p></div>
    <div class="rg"><i>${ICO.trophee}</i><p><b>Double élimination.</b> Une défaite dans un tournoi t'envoie au tableau des perdants ; une seconde, et la saison s'arrête. Après chaque victoire, une récompense : une recrue, un Objet, un Moment, des Essences, un bootcamp.</p></div>
    <p class="petit">Un jeu à part, qui reprend les cartes de Mate TCG et leurs chiffres. Ce ne sont pas les règles officielles du jeu de cartes.</p>
  </div>`, 'large');
}

function menu() {
  feuille(`<div class="menu-l">
    <h2>Menu</h2>
    <button class="btn sec" data-act="regles">Comment jouer</button>
    <button class="btn sec" data-act="vitesse">Animations : ${vitesse === 1 ? 'normales' : vitesse === 2 ? 'rapides' : 'très rapides'}</button>
    <button class="btn sec" data-act="accueil">Accueil <small>la saison est gardée</small></button>
    ${S && !S.fini ? '<button class="btn sec danger" data-act="abandon">Abandonner la saison</button>' : ''}
    ${S ? `<p class="petit">Graine : ${h(S.graine)}</p>` : ''}
  </div>`);
}

/* ---------- Icônes ---------- */
const ICO = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  cible: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  chaine: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  trophee: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>',
  terrain: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="7" rx="1"/><rect x="9.5" y="4" width="5" height="7" rx="1"/><rect x="16" y="4" width="5" height="7" rx="1"/><circle cx="8" cy="17" r="2.5"/><circle cx="16" cy="17" r="2.5"/></svg>',
  haltere: '<svg viewBox="0 0 24 24"><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/></svg>'
};

/* ---------- Zoom : un appui long sur une carte ---------- */
let appui = null;
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.u:not(.vide), .bn, .jc, .membre, .o-joueur');
  if (!t) return;
  appui = setTimeout(() => {
    appui = 'zoom';
    const img = t.querySelector('img') || null;
    const src = img ? img.src : (t.querySelector('.illu') && t.querySelector('.illu').style.backgroundImage.slice(5, -2));
    if (!src) return;
    const z = $('#zoom');
    z.innerHTML = `<img src="${src}" alt="">`;
    z.hidden = false;
  }, 420);
});
const finAppui = () => {
  if (appui === 'zoom') { $('#zoom').hidden = true; setTimeout(() => { appui = null; }, 0); return; }
  clearTimeout(appui); appui = null;
};
document.addEventListener('pointerup', finAppui);
document.addEventListener('pointercancel', finAppui);
document.addEventListener('contextmenu', e => { if (e.target.closest('.u, .bn, .jc, .membre, .offre')) e.preventDefault(); });

/* ---------- Les clics ---------- */
document.addEventListener('click', e => {
  if (appui === 'zoom') return;
  const t = e.target.closest('[data-act],[data-u],[data-coach],[data-draft],[data-membre],[data-atk],[data-special],[data-rotation],[data-moment],[data-jouer-moment],[data-offre],[data-rec-cible],[data-info-moment]');
  if (!t) return;
  const d = t.dataset;
  if (d.u != null) {
    if (ecranCourant() === 'match' && !S.m.entreManches) return toucherUnite(+d.u);
    return;
  }
  if (d.coach) { choixUi.coach = d.coach; return rendre(); }
  if (d.draft) { choixUi.draft = +d.draft; return rendre(); }
  if (d.membre) {
    const uid = +d.membre;
    if (choixUi.ordre && choixUi.ordre !== uid) {
      const l = S.roster.map(x => x.uid);
      const a = l.indexOf(choixUi.ordre), b = l.indexOf(uid);
      [l[a], l[b]] = [l[b], l[a]];
      C.ordonner(S, l);
      choixUi.ordre = null;
    } else choixUi.ordre = choixUi.ordre === uid ? null : uid;
    return rendre();
  }
  if (d.atk != null) return choisirAttaque(+d.uid, +d.atk);
  if (d.special) return choisirSpeciale(+d.uid, d.special);
  if (d.rotation) { fermer(); return executer(() => C.rotation(S, +d.rotation, +d.entre)); }
  if (d.moment != null) return occupe ? null : ficheMoment(+d.moment);
  if (d.jouerMoment != null) return lancerMoment(+d.jouerMoment);
  if (d.infoMoment) { const x = C.MOMENT[d.infoMoment]; return feuille(`<div class="fm">${illu(x.num, 'large')}<div><b>${h(C.carte(x.num).nom)}</b><p>${h(x.txt)}</p><span class="fm-cout">Coût ${gemmesCout(x.cout ? { neutre: x.cout } : {})}</span></div></div>`); }
  if (d.offre != null) {
    const i = +d.offre;
    if (!cibleRequise(S.offres[i])) { C.prendre(S, i); choixUi = {}; return rendre(); }
    choixUi.recompense = i; return rendre();
  }
  if (d.recCible != null) {
    const v = isNaN(+d.recCible) ? d.recCible : +d.recCible;
    try { C.prendre(S, choixUi.recompense, v); } catch (err) { return toast(err.message); }
    choixUi = {}; return rendre();
  }
  switch (d.act) {
    case 'nouvelle': fermer(); return nouvelleSaison();
    case 'jour': return nouvelleSaison('jour-' + new Date().toISOString().slice(0, 10));
    case 'reprendre':
      try { S = JSON.parse(lire(CLE)); } catch (err) { return toast('Sauvegarde illisible.'); }
      vue = 'jeu'; rendre();
      if (S.m && !S.m.fini && !S.m.entreManches && S.m.trait === 'eux') tourAdverse();
      return;
    case 'regles': return regles();
    case 'menu': return menu();
    case 'fermer': return fermer();
    case 'accueil': fermer(); vue = 'accueil'; return rendre();
    case 'abandon':
      fermer();
      if (S && !S.fini) { S.fini = { victoire: false, tournoi: S.tournoi, tour: S.tour }; S.m = null; S.etape = 'fin'; noterFin(); }
      return rendre();
    case 'vitesse':
      vitesse = vitesse === 1 ? 2 : vitesse === 2 ? 4 : 1;
      ecrire(CLE_VIT, vitesse); return menu();
    case 'coach-ok': C.choisirCoach(S, choixUi.coach); choixUi = {}; return rendre();
    case 'draft-ok': C.choisirDraft(S, choixUi.draft); choixUi = {}; return rendre();
    case 'jouer-match': {
      choixUi = {};
      const ev = C.debutMatch(S);
      rendre();
      occupe = true;
      return jouerEvenements(ev).then(() => { occupe = false; rendre(); });
    }
    case 'fin-tour': return finTourMoi();
    case 'annuler': sel = null; return rendre();
    case 'pause': return executer(() => C.pauseTechnique(S));
    case 'manche-suivante': return mancheSuivante();
    case 'rec-retour': choixUi = {}; return rendre();
    case 'rec-passer': C.passer(S); choixUi = {}; return rendre();
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { fermer(); if (sel) { sel = null; rendre(); } } });

rendre();
