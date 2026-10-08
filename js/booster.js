/* Boosters : réserve de tickets, composition d'un paquet, écran du paquet en 3D. */
"use strict";

/* ---------- Réserve ---------- */
function regen() {
  if (save.tickets >= TICKET_CAP) {
    save.lastTick = Date.now();
    return;
  }
  const n = Math.floor((Date.now() - save.lastTick) / INTERVAL);
  if (n > 0) {
    save.tickets = Math.min(TICKET_CAP, save.tickets + n);
    save.lastTick += n * INTERVAL;
    if (save.tickets >= TICKET_CAP) save.lastTick = Date.now();
    persist();
  }
}

function brand() {
  $('#brand').innerHTML = `<img src="${ART.logo}" alt="${h(GAME_NAME)}">`;
  document.title = GAME_NAME;
}

/* ---------- Compte à rebours ---------- */
/* Avec une recharge de quatre heures, « 240:00 » n'a plus de sens : on passe en
   heures et minutes tant qu'il en reste plus d'une, et on ne descend à la
   seconde que sur la dernière minute, là où elle devient intéressante. */
function timerClock() {
  if (save.unlimited) return '∞';
  if (save.tickets >= TICKET_CAP) return 'Pleine';
  const left = Math.max(0, INTERVAL - (Date.now() - save.lastTick));
  const s = Math.floor(left / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor(s / 60) % 60;
  if (hh) return `${hh} h ${String(mm).padStart(2, '0')}`;
  if (mm) return `${mm} min`;
  return `${s} s`;
}

/* Ce que raconte la ligne sous l'horloge : un mot, jamais deux. */
function timerLabel() {
  if (save.unlimited) return 'Illimité';
  if (save.tickets >= TICKET_CAP) return 'Réserve pleine';
  return 'Prochain booster';
}

/* Part du délai déjà écoulée, pour la jauge de recharge. */
function tickPct() {
  if (save.unlimited || save.tickets >= TICKET_CAP) return 100;
  return Math.min(100, Math.max(0, (Date.now() - save.lastTick) / INTERVAL * 100));
}

/* ---------- Tirage ---------- */
/* Les cases tirées au sort du paquet. Le reste est fixe.
   Ces tables doivent rester identiques à celles de open_pack() dans
   supabase/03_rpc.sql : le serveur tire, celui-ci ne sert qu'aux ouvertures de
   test du Labo, mais deux tables divergentes rendraient le Labo menteur. */
const RATES = {
  /* Quatrième carte, la Reverse (version 2.0). */
  REVERSE: { C: 50, PC: 35, R: 15 },
  /* La dernière, celle qu'on attend. */
  HIT: { R: 80, E: 16, L: 4 },
  /* Le godpack, case par case : ça monte jusqu'à la légendaire garantie. */
  GODPACK: [
    { R: 90, E: 10 },
    { R: 70, E: 30 },
    { R: 50, E: 50 },
    { E: 90, L: 10 },
    { E: 60, L: 40 },
    { L: 100 }
  ]
};
const GOD = 1 / 2000;

function pickFrom(pool, r) {
  const order = ['C', 'PC', 'R', 'E', 'L'].sort((a, b) =>
    Math.abs(RAR[a].rank - RAR[r].rank) - Math.abs(RAR[b].rank - RAR[r].rank) || RAR[b].rank - RAR[a].rank
  );
  for (const k of order) {
    const c = pool.filter(p => p.rar === k && p.cat !== 'essence');
    if (c.length) return rnd(c);
  }
  return null;
}

function weighted(w) {
  let tot = 0;
  for (const k in w) tot += w[k];
  let x = Math.random() * tot;
  for (const k in w) {
    x -= w[k];
    if (x <= 0) return k;
  }
  return Object.keys(w)[0];
}

/* Six cartes, chacune à sa place (version 2.0) :
     1 · Commune
     2 · Commune
     3 · Peu commune
     4 · une Reverse : Commune 50 %, Peu commune 35 %, Rare 15 %
     5 · Essence
     6 · le hit : Rare 80 %, Épique 16 %, Légendaire 4 %
   L'ordre compte : la pile se feuillette de la première à la dernière, et
   c'est la dernière qui porte la mise en scène de la révélation.
   Godpack : six cartes qui montent, de la rare à la légendaire garantie. */
function makeBooster(pool, god) {
  const out = [];

  if (god) {
    RATES.GODPACK.forEach(table => out.push(pickFrom(pool, weighted(table))));
    return out.filter(Boolean);
  }

  out.push(pickFrom(pool, 'C'));
  out.push(pickFrom(pool, 'C'));
  out.push(pickFrom(pool, 'PC'));
  const rr = weighted(RATES.REVERSE);
  const revs = reverses.filter(c => c.rar === rr);
  out.push(revs.length ? rnd(revs) : pickFrom(pool, rr));

  const ess = pool.filter(c => c.cat === 'essence');
  let e = ess.length ? rnd(ess) : pickFrom(pool, 'C');
  /* Une fois sur FOIL_ODDS, l'Essence sort Brillante — comme open_pack(). */
  if (e && e.cat === 'essence' && Math.random() < 1 / FOIL_ODDS) e = byId['b' + e.id.slice(1)] || e;
  out.push(e);

  out.push(pickFrom(pool, weighted(RATES.HIT)));

  return out.filter(Boolean);
}

/* ---------- L'événement en cours ---------- */
/* Un bandeau au-dessus du paquet : l'événement (avant son départ, puis
   pendant), et la chasse à la carte unique. Il ouvre la fenêtre des
   nouveautés (js/bienvenue.js). Rien s'il n'y a ni événement, ni chasse
   annoncée ou ouverte. Les comptes à rebours (`data-rebours`) battent à la
   seconde (js/app.js). */
const chasseAnnoncee = ch => !!(ch && !ch.active && !ch.trouvee && ch.ouvre_le);

/* « pendant 3 jours », « pendant 24 h », « pendant 6 h ». */
function pendant(ms) {
  const hh = Math.round(ms / 3600000);
  return hh >= 48 ? `pendant ${Math.round(hh / 24)} jours` : `pendant ${hh} h`;
}

function vBandeauEvenement() {
  if (Backend.mode !== 'cloud' || !save) return '';
  const ev = save.evenement;
  /* Version 2.0 : l'événement « Reflets » a son propre bandeau, qui mène à
     son onglet. */
  if (ev && ev.code === 'reflets' && !ev.a_venir) return vBandeauReflets(ev);
  const ch = save.chasse || {};
  const u = uniques[0];
  const nomU = u ? u.nom : 'la carte unique';
  /* En milieu de phrase : « la chasse à l'Unique Chevalière ». */
  const nomMilieu = nomU.replace(/^L'/, 'l\'').replace(/^La /, 'la ');
  const annoncee = chasseAnnoncee(ch);
  const ouverte = !!(ch.active && !ch.trouvee);
  if (!ev && !annoncee && !ouverte) return '';

  const rebours = t => `<b data-rebours="${t}">${h(dureeCourte(t - Date.now()))}</b>`;
  const ouvre = annoncee ? srvTime(ch.ouvre_le) : 0;
  let classe, tag, temps, titre, sous, chasse = '';

  if (ev) {
    const debut = srvTime(ev.debut), fin = srvTime(ev.fin);
    const rythme = ev.ticket_minutes
      ? `Un booster toutes les ${String(Math.round(ev.ticket_minutes / 6) / 10).replace('.', ',')} h` : '';
    classe = ev.a_venir ? 'avenir' : 'encours';
    tag = ev.a_venir ? 'Bientôt' : 'En cours';
    temps = ev.a_venir ? `dans ${rebours(debut)}` : `encore ${rebours(fin)}`;
    titre = ev.titre;
    sous = rythme
      ? (ev.a_venir ? `${rythme} ${pendant(fin - debut)}, ${jourHeure(debut, 'à partir')}.`
                    : `${rythme}, ${jourHeure(fin, 'jusqu\'à')}.`)
      : ev.texte || '';
    /* La chasse, en une ligne sous l'événement. */
    chasse = annoncee
      ? (ev.a_venir && Math.abs(srvTime(ev.debut) - ouvre) < 60000
          ? `Et la chasse à ${h(nomMilieu)} ouvre au même moment.`
          : `La chasse à ${h(nomMilieu)} ouvre ${h(jourHeure(ouvre))}.`)
      : ouverte ? `Chasse ouverte : ${h(nomMilieu)} se cache dans un booster.`
      : ch.trouvee && u && save.col[u.id] > 0 ? `Tu détiens ${h(nomMilieu)}.`
      : ch.trouvee ? `${h(nomU)} a été tirée par ${h(ch.gagnant || 'un joueur')}.`
      : '';
  } else {
    classe = 'chasse';
    tag = 'Chasse';
    temps = annoncee ? `ouvre dans ${rebours(ouvre)}` : 'ouverte';
    titre = nomU;
    sous = 'Un seul exemplaire dans tout le jeu, caché dans un booster.';
  }

  return `<button class="evban ${classe}" data-act="nouveautes" aria-label="${h(titre)} : en savoir plus">
    <span class="evbtxt">
      <span class="evbhaut"><i class="evbtag">${tag}</i><span class="evbtemps">${temps}</span></span>
      <b class="evbtitre">${h(titre)}</b>
      ${sous ? `<span class="evbsous">${h(sous)}</span>` : ''}
      ${chasse ? `<span class="evbchasse">${ICON.star}<span>${chasse}</span></span>` : ''}
    </span>
    ${u && (annoncee || ouverte) ? `<span class="evbcarte"><img src="${u.img}" alt=""></span>` : ''}
  </button>`;
}

/* Le bandeau de l'événement Reflets : holographique, avec une Reverse qui
   tourne doucement, le solde de Prismes et ce qui attend dans l'onglet. */
function vBandeauReflets(ev) {
  const fin = srvTime(ev.fin);
  const n = evQuetesPretes();
  const rv = reverses.filter(c => c.rar === 'R');
  const c = rv.length ? rv[Math.floor(Date.now() / 3600000) % rv.length] : null;
  return `<button class="evban reflets" data-tab="reflets" aria-label="Ouvrir l'événement Reflets">
    <span class="rfb-holo" aria-hidden="true"></span>
    <span class="evbtxt">
      <span class="evbhaut"><i class="evbtag">Événement 2.0</i><span class="evbtemps">encore <b data-rebours="${fin}">${h(dureeCourte(fin - Date.now()))}</b></span></span>
      <b class="evbtitre rfb-nom">Reflets</b>
      <span class="evbsous">Les Reverses sont arrivées. Gagne des ${PRISMES.nom}, remonte la piste, joue au Cartle.</span>
      <span class="rfb-chips"><i>${prismeIco}<b>${fmtN(save.prismes || 0)}</b> ${PRISMES.nom}</i>${n ? `<i class="pret">${n} à récupérer</i>` : '<i>Voir l\'événement</i>'}</span>
    </span>
    ${c ? `<span class="rfb-carte" aria-hidden="true">${renderCard(c)}</span>` : ''}
  </button>`;
}

/* Le prochain moment où l'état change de lui-même : un événement qui
   commence ou finit, une chasse qui ouvre. La page redemande alors l'état au
   serveur (js/app.js) — le rythme des boosters en dépend. */
function prochaineBascule() {
  if (Backend.mode !== 'cloud' || !save) return 0;
  const t = [];
  const ev = save.evenement;
  if (ev) t.push(srvTime(ev.a_venir ? ev.debut : ev.fin));
  if (chasseAnnoncee(save.chasse)) t.push(srvTime(save.chasse.ouvre_le));
  return t.length ? Math.min(...t) : 0;
}

/* ---------- Écran booster ---------- */
function vBoosters() {
  if (!cards.length) {
    return `<div class="empty"><h1>Aucune carte</h1><p class="muted">Le fichier js/cards-data.js ne contient aucune carte.</p></div>`;
  }
  const can = save.unlimited || save.tickets > 0;
  const full = save.unlimited || save.tickets >= TICKET_CAP;
  const bonus = save.bonus || 0;

  return `<section class="packzone">
  ${vBandeauEvenement()}
  <header class="setbar">
    <img class="setlogo" src="${ART.set}" alt="${h(SET_NAME)}">
    <img class="edition" src="${ART.edition}" alt="Première édition">
    <p class="setmeta">${cards.length} cartes · ${PACK_SIZE} par booster</p>
  </header>

  <div class="packstage">
    <div class="packglow" aria-hidden="true"></div>
    <div class="pack3d" id="pack3d">
      <div class="pack${can ? ' ready' : ''}" id="pack" role="button" tabindex="0" aria-label="Ouvrir un booster">
        <img class="pack-art" src="${packArt}" alt="">
        <div class="pack-foil" aria-hidden="true"></div>
      </div>
    </div>
    <div class="packshadow" aria-hidden="true"></div>
  </div>

  <footer class="packfoot">
    ${vReserve(full)}
    ${bonus && !can ? '' : `<button class="btn packbtn" data-act="open" ${can ? '' : 'disabled'}>${ICON.star}${can ? 'Ouvrir' : 'Réserve vide'}</button>`}
    ${bonus ? `<button class="btn packbtn bonusbtn${can ? ' ghost' : ''}" data-act="open-bonus">
        ${NAVICO.promo}Ouvrir un booster en plus<span class="rc-reste">${bonus}</span></button>
      <p class="bonuslab">Achetés ou offerts : hors réserve, ils ne touchent pas à sa recharge.</p>` : ''}
  </footer>
</section>`;
}

/* La réserve : une rangée de jetons, un par booster disponible, et la recharge
   en dessous. Le sablier et son « Max » ne disaient ni combien il en restait ni
   combien de temps il fallait attendre — deux pastilles côte à côte qu'il
   fallait lire l'une après l'autre pour comprendre.

   Ici tout se voit d'un coup d'œil : cinq alvéoles, celles qui sont pleines
   brillent, la dernière se remplit sous les yeux. */
function vReserve(full) {
  if (save.unlimited) {
    return `<div class="reserve illimite">
      <div class="resjetons"><img class="resinf" src="${ART.seal}" alt=""><b>∞</b></div>
      <p class="reslab">Boosters illimités</p>
    </div>`;
  }

  /* Depuis la version 1.5.6, rien ne fait plus déborder la réserve : les
     boosters achetés ou offerts sont à part (save.bonus). Le surplus reste
     affiché au cas où une vieille réserve dépasserait encore. */
  const total = save.tickets;
  const n = Math.min(total, TICKET_CAP);
  const surplus = Math.max(0, total - TICKET_CAP);
  const pct = tickPct();
  /* Le jeton en cours de remplissage est le premier vide : c'est lui qui porte
     la jauge, pour que l'attente ait un endroit précis où se lire. */
  const jetons = Array.from({ length: TICKET_CAP }, (_, i) => {
    const plein = i < n;
    const encours = !plein && i === n && !full;
    return `<i class="resjeton${plein ? ' plein' : ''}${encours ? ' encours' : ''}"
      ${encours ? `style="--p:${pct}%"` : ''}></i>`;
  }).join('');

  return `<div class="reserve${full ? ' pleine' : ''}">
    <div class="resjetons" role="img" aria-label="${total} booster${total > 1 ? 's' : ''} en réserve">
      ${jetons}${surplus ? `<i class="ressurplus">+${surplus}</i>` : ''}
    </div>
    <p class="reslab">
      <b class="tnum">${total}</b>
      <span class="resmax">${surplus ? `booster${total > 1 ? 's' : ''}` : '/' + TICKET_CAP}</span>
      <span class="ressep" aria-hidden="true"></span>
      ${full ? '' : NAVICO.clock}
      <span class="restemps">${surplus ? 'Réserve pleine, et ' + surplus + ' d\'avance'
        : h(timerLabel())}${full ? '' : ' · '}</span>
      ${full ? '' : `<b class="tnum" id="tmclock">${timerClock()}</b>`}
    </p>
  </div>`;
}

/* Toucher le paquet ouvre un booster de la réserve ; quand elle est vide, un
   booster en plus s'il en reste. */
function ouvrirDepuisPaquet() {
  if (!save.unlimited && save.tickets < 1 && save.bonus > 0) return openBooster({ bonus: true });
  openBooster();
}

/* Le paquet suit le doigt en 3D ; une simple pression l'ouvre. */
function bindPack() {
  const pk = $('#pack');
  const box = $('#pack3d');
  if (!pk || !box) return;

  const T = { rx: 0, ry: 0, mrx: 0, mry: 0, manual: false };
  const alive = () => document.body.contains(pk);

  let pid = null, x0 = 0, y0 = 0, t0 = 0, moved = 0;

  pk.addEventListener('pointerdown', e => {
    if (pid != null) return;
    pid = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = performance.now();
    moved = 0;
    pk.setPointerCapture(e.pointerId);
  });

  pk.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    moved = Math.max(moved, Math.hypot(dx, dy));
    T.manual = true;
    T.mry = Math.max(-28, Math.min(28, dx * .3));
    T.mrx = Math.max(-24, Math.min(24, -dy * .3));
  });

  /* Pression franche et sans glissement : on ouvre. Sinon, on a juste fait tourner le paquet. */
  const up = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    T.manual = false;
    if (moved < 9 && performance.now() - t0 < 600) ouvrirDepuisPaquet();
  };
  pk.addEventListener('pointerup', up);
  pk.addEventListener('pointercancel', () => { pid = null; T.manual = false; });

  pk.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ouvrirDepuisPaquet();
    }
  });

  const frame = now => {
    if (!alive()) return;
    const trx = T.manual ? T.mrx : (RM() ? 0 : Math.sin(now / 2400) * 3.5);
    const tryy = T.manual ? T.mry : (RM() ? 0 : Math.sin(now / 1900) * 6);
    T.rx += (trx - T.rx) * .12;
    T.ry += (tryy - T.ry) * .12;
    box.style.transform = `rotateX(${T.rx.toFixed(2)}deg) rotateY(${T.ry.toFixed(2)}deg)`;
    pk.style.setProperty('--fx', (50 + T.ry * 1.8).toFixed(1) + '%');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function bindTilt(root) {
  (root || document).querySelectorAll('.tilt').forEach(el => {
    const set = (x, y) => {
      el.style.setProperty('--rx', ((.5 - y) * 16).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x - .5) * 20).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      el.style.setProperty('--ga', '1');
    };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--ga', '0');
    });
  });
}
