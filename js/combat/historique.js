/* L'historique des combats (version 3.0.12).

   À la fin d'un combat contre l'IA ou d'un défi entre amis, la page résume
   la partie tour par tour, à partir des événements du moteur (E.ev), et
   l'envoie avec le résultat (combat_fin, defi_fin). Le serveur garde les
   trente derniers combats de chaque joueur (combats_historique,
   supabase/installation/23_combats.sql) ; Combats › Historique les montre.

   Pas de replay : seulement ce que le journal de l'arène racontait, une
   ligne par geste, rangé par tour. Une ligne est une petite liste
   (un code, puis des identifiants de cartes et des valeurs) : le texte se
   refait à l'affichage, avec les noms du catalogue. Un combat pèse ainsi
   quelques Ko. Le tutoriel, écrit d'avance, n'y entre pas.

   `j` est relatif dans le résumé : 0, celui qui regarde ; 1, l'adversaire. */
"use strict";

const Historique = (() => {
  /* Combats gardés par joueur (le serveur fait foi : historique_ajouter). */
  const MAX = 30;
  /* Signes au plus pour le journal d'un combat : au-delà, les derniers tours
     sont coupés (le serveur refuse au-delà de 30 000). */
  const TAILLE = 24000;

  /* ---------- Le résumé ---------- */
  function resumer(E, moi) {
    const r = j => (j === moi ? 0 : 1);
    /* Les événements nomment souvent une carte par son instance (`u`) : on
       retrouve son identifiant dans ceux qui donnent les deux, puis dans
       l'état final (une carte ne quitte jamais la partie). */
    const ids = new Map();
    for (const e of E.ev) if (typeof e.u === 'number' && e.id) ids.set(e.u, e.id);
    for (const P of E.j) {
      for (const z of ['club', 'main', 'pv', 'defausse']) for (const c of P[z]) if (!ids.has(c.u)) ids.set(c.u, c.id);
      for (const c of P.lignes) {
        if (!c) continue;
        if (!ids.has(c.u)) ids.set(c.u, c.id);
        for (const o of c.obj) if (!ids.has(o.u)) ids.set(o.u, o.id);
      }
    }
    const id = u => ids.get(u) || '';
    const tours = [[0, null, []]];
    let l = tours[0][2];
    /* La ligne écrite pour un événement : un remplacement réécrit celle du
       Joueur bench juste avant. */
    const ecrite = new Map();
    for (let i = 0; i < E.ev.length; i++) {
      const e = E.ev[i];
      let x = null;
      switch (e.t) {
        case 'tour': tours.push([e.n, r(e.j), []]); l = tours[tours.length - 1][2]; continue;
        case 'pileFace': x = ['pf', r(e.premier)]; break;
        case 'mulligan': x = ['mu', r(e.j)]; break;
        case 'deploie': {
          if (e.pose) { x = ['po', r(e.j), e.id]; break; }
          /* Toutes les cases prises : le Joueur bench à sa place juste avant
             (ses Objets partent avec lui) — un remplacement, une ligne. */
          let k = i - 1;
          while (k >= 0 && E.ev[k].t === 'banc' && E.ev[k].de != null) k--;
          const b = E.ev[k];
          const y = b && b.t === 'banc' && b.j === e.j && b.ligne === e.ligne && ecrite.get(b);
          if (y) { y.splice(0, y.length, 'rp', r(e.j), b.id, e.id, e.eng ? 1 : 0); continue; }
          x = ['de', r(e.j), e.id, e.eng ? 1 : 0];
          break;
        }
        case 'joue': x = ['jo', r(e.j), e.id]; break;
        case 'lie': x = ['li', r(e.j), e.id, id(e.cible)]; break;
        case 'attaque': x = ['at', r(e.j), id(e.u), e.k, e.cible === 'ceo' ? 'ceo' : e.cible == null ? null : id(e.cible)]; if (e.pourquoi) x.push(e.pourquoi); break;
        case 'soutien': x = ['so', r(e.j), id(e.u), e.val]; break;
        case 'defend': x = ['df', r(e.j), id(e.u)]; break;
        case 'repousse': x = ['ti', e.val, e.def]; break;
        case 'impact': if (e.cible !== 'ceo' && e.def != null && e.val >= e.def) x = ['to', e.val, e.def]; break;
        case 'vaincu': x = ['va', r(e.j), e.id]; break;
        case 'touche': x = ['pv', r(e.j)]; break;
        case 'pvRecup': x = ['pr', r(e.j)]; break;
        case 'pvDefausse': x = ['pd', r(e.j)]; break;
        case 'resilience': x = ['re', r(e.j), e.id]; break;
        case 'riposte': x = ['ri', r(e.j), e.id, e.val]; break;
        case 'banc': x = ['be', r(e.j), e.id]; break;
        case 'defausse': x = ['jt', r(e.j), e.id]; break;
        case 'clubVide': x = ['cv', r(e.j)]; break;
        case 'legion': x = ['lg', r(e.j), e.id]; break;
        case 'enMain': x = ['em', r(e.j), e.id]; break;
        case 'shield': x = ['sh']; break;
        case 'fin': x = ['fi', r(e.gagnant), e.raison]; break;
      }
      if (x) { l.push(x); ecrite.set(e, x); }
    }
    const res = { v: 1, premier: r(E.premier), tours: tours.filter(t => t[0] > 0 || t[2].length) };
    /* Trop long : on garde les premiers tours, et on le dit. */
    while (JSON.stringify(res).length > TAILLE && res.tours.length > 1) { res.tours.pop(); res.coupe = true; }
    return res;
  }

  /* Ce que la page envoie avec le résultat (p_resume.histo, p_histo). Le
     serveur ajoute ce qu'il sait mieux qu'elle : le mode, l'heure, le
     résultat, et l'adversaire d'un défi. */
  function entree(E, moi, meta) {
    meta = meta || {};
    const a = meta.adversaire || {};
    return {
      titre: String(meta.titre || '').slice(0, 60),
      adversaire: { nom: String(a.nom || '').slice(0, 40), avatar: String(a.avatar || 'star').slice(0, 40), frame: String(a.frame || 'default').slice(0, 40) },
      raison: E.fin ? E.fin.raison : 'abandon',
      tours: E.tour,
      pv: E.j[moi].pv.length, pv_adv: E.j[1 - moi].pv.length,
      deck: meta.deck ? String(meta.deck).slice(0, 32) : null,
      journal: resumer(E, moi)
    };
  }

  /* ---------- Le texte ---------- */
  const nomCarte = id => ((typeof Combat !== 'undefined' && Combat.carte(id)) || byId[id] || {}).nom || 'une carte';
  const nomAttaque = (id, k) => {
    const c = (typeof Combat !== 'undefined' && Combat.carte(id)) || {};
    return ((c.atks || [])[k] || {}).nom || '';
  };
  /* Une ligne, en HTML. `adv` : le nom de l'adversaire. */
  function ligne(x, adv) {
    const A = `<b>${h(adv || 'L\'adversaire')}</b>`;
    const k = id => `<i>${h(nomCarte(id))}</i>`;
    /* Le sujet et son verbe : « Tu déploies », « Lumen déploie ». */
    const s = (j, tu, il) => (j === 0 ? `Tu ${tu}` : `${A} ${il}`);
    switch (x[0]) {
      case 'pf': return x[1] === 0 ? 'Tu commences.' : `${A} commence.`;
      case 'mu': return s(x[1], 'changes de main.', 'change de main.');
      case 'po': return `${s(x[1], 'commences avec', 'commence avec')} ${k(x[2])} en jeu.`;
      case 'de': return `${s(x[1], 'déploies', 'déploie')} ${k(x[2])}${x[3] ? ' (engagé)' : ''}.`;
      case 'rp': return `${s(x[1], 'remplaces', 'remplace')} ${k(x[2])} par ${k(x[3])}${x[4] ? ' (engagé)' : ''}.`;
      case 'jo': return `${s(x[1], 'joues', 'joue')} ${k(x[2])}.`;
      case 'li': return `${s(x[1], 'lies', 'lie')} ${k(x[2])}${x[3] ? ` à ${k(x[3])}` : ''}.`;
      case 'at': {
        const n = nomAttaque(x[2], x[3]);
        const cible = x[4] === 'ceo' ? (x[1] === 0 ? ` le CEO de ${A}` : ' ton CEO') : x[4] ? ` ${k(x[4])}${x[5] ? `, imposé par ${x[5] === 'Jus de bagarre' ? 'Jus de bagarre' : `sa ${h(x[5])}`}` : ''}` : '';
        /* Une attaque sans valeur ne vise personne (3.0.16) : elle « lance » son effet. */
        if (x[4] == null) return `${k(x[2])} lance ${n ? h(n) : 'son attaque'}.`;
        return `${k(x[2])} attaque${cible}${n ? ` (${h(n)})` : ''}.`;
      }
      case 'so': return `${k(x[2])} soutient l'attaque (+${fmtN(x[3])}).`;
      case 'df': return `${k(x[2])} défend.`;
      case 'ti': return `Il tient : ${fmtN(x[1])} contre ${fmtN(x[2])}.`;
      case 'to': return `${fmtN(x[1])} contre ${fmtN(x[2])} : le défenseur tombe.`;
      case 'va': return `${k(x[2])} est vaincu.`;
      case 'pv': return s(x[1], 'es touché.', 'est touché.');
      /* Les règles : le CEO touché récupère en main la carte du dessus de
         ses PV (ou joue sa Résilience). */
      case 'pr': return s(x[1], 'prends ton PV du dessus en main.', 'prend son PV du dessus en main.');
      case 'pd': return x[1] === 0 ? 'Ton PV du dessus part à la défausse.' : `Le PV du dessus de ${A} part à la défausse.`;
      case 're': return `Résilience : ${k(x[2])}.`;
      case 'ri': return `Riposte de ${k(x[2])} (${fmtN(x[3])}).`;
      case 'be': return `${k(x[2])} est bench (à la défausse).`;
      case 'jt': return `${s(x[1], 'défausses', 'défausse')} ${k(x[2])}.`;
      case 'cv': return s(x[1], 'dois piocher dans un Club vide.', 'doit piocher dans un Club vide.');
      case 'lg': return `Légion : ${k(x[2])} revient en main.`;
      case 'em': return `${k(x[2])} retourne en main.`;
      case 'sh': return 'Shield : l\'attaque est ignorée.';
      case 'fi': return x[1] === 0 ? 'Victoire.' : 'Défaite.';
    }
    return '';
  }
  /* Les lignes qui comptent le plus : on les marque, comme le journal de
     l'arène (une carte vaincue, un PV perdu, la fin). */
  const ton = x => (x[0] === 'va' || x[0] === 'pv' || x[0] === 'pd' || x[0] === 'cv' ? (x[1] === 0 ? 'mal' : 'bien')
    : x[0] === 'fi' ? 'sys' : x[0] === 're' || x[0] === 'lg' ? 'bien' : '');

  return { MAX, TAILLE, resumer, entree, ligne, ton };
})();

/* ---------- Combats › Historique ---------- */
const HISTO_MODES = { campagne: 'Campagne', infini: 'Arcade', raid: 'Raid', epreuve: 'Épreuve du jour', defi: 'Versus' };
const HISTO_RAISONS = {
  pv: ['Le CEO adverse n\'avait plus de PV.', 'Ton CEO n\'avait plus de PV.'],
  club: ['L\'adversaire devait piocher dans un Club vide.', 'Tu devais piocher dans un Club vide.'],
  abandon: ['L\'adversaire a abandonné.', 'Tu as abandonné.']
};
let cbHisto = null;
let cbHistoErreur = '';

async function chargerHisto() {
  try {
    cbHisto = await Backend.historique();
    cbHistoErreur = '';
  } catch (e) {
    cbHistoErreur = e.message || 'L\'historique n\'a pas pu être chargé.';
  }
  if (tab === 'combats' && cbVue === 'historique') render();
}

function vCbHistorique() {
  const tete = cbSousTete('Historique', `Tes ${Historique.MAX} derniers combats, tour par tour`);
  if (cbHistoErreur) return tete + vide('Historique indisponible', cbHistoErreur);
  if (!cbHisto) { chargerHisto(); return tete + '<p class="muted boitecharge">Chargement…</p>'; }
  if (!cbHisto.length) return tete + vide('Aucun combat pour l\'instant', 'Tes combats en solo et tes défis entre amis arrivent ici, tour par tour.');
  const v = cbHisto.filter(x => x.gagne).length;
  return tete + `<div class="hc-bilan">
      <span><b class="tnum">${v}</b><small>victoire${v > 1 ? 's' : ''}</small></span>
      <span><b class="tnum">${cbHisto.length - v}</b><small>défaite${cbHisto.length - v > 1 ? 's' : ''}</small></span>
      <span><b class="tnum">${Math.round(100 * v / cbHisto.length)} %</b><small>de victoires</small></span>
    </div>
    <ol class="hc-liste">${cbHisto.map(vHistoLigne).join('')}</ol>`;
}

function vHistoLigne(x) {
  const a = x.adversaire || {};
  return `<li><button class="hc-l ${x.gagne ? 'v' : 'd'}" data-cb="histo" data-v="${h(String(x.id))}">
    <span class="hc-res" aria-label="${x.gagne ? 'Victoire' : 'Défaite'}">${x.gagne ? 'V' : 'D'}</span>
    ${avatarHTML(a.avatar || 'star', a.frame || 'default', 'sm', a.photo || null)}
    <span class="hc-t"><b>${h(a.nom || 'Adversaire')}</b><small>${h(x.titre || HISTO_MODES[x.mode] || 'Combat')}</small></span>
    <span class="hc-d"><small>${h(ilya(x.le))}</small><small class="tnum">${x.tours} tour${x.tours > 1 ? 's' : ''}</small></span>
  </button></li>`;
}

/* Un combat, tour par tour, dans une feuille. */
async function ouvrirHistoCombat(id) {
  const base = (cbHisto || []).find(x => String(x.id) === String(id));
  let x;
  try {
    occupe(true);
    x = await Backend.historiqueCombat(base ? base.id : id);
  } catch (e) {
    return toast(e.message || 'Ce combat n\'a pas pu être chargé.');
  } finally { occupe(false); }
  const a = x.adversaire || {};
  const j = x.journal;
  const raison = (HISTO_RAISONS[x.raison] || [])[x.gagne ? 0 : 1] || '';
  const quand = new Date(srvTime(x.le)).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const tours = j && Array.isArray(j.tours) ? j.tours.map(([n, qui, l]) => `<section class="hc-tour ${qui === 0 ? 'moi' : qui === 1 ? 'lui' : 'mise'}">
      <h4>${n ? `Tour ${n} <small>${qui === 0 ? 'Toi' : h(a.nom || 'Adversaire')}</small>` : 'Mise en place'}</h4>
      <ul>${l.map(y => { const t = Historique.ligne(y, a.nom); return t ? `<li class="${Historique.ton(y)}">${t}</li>` : ''; }).join('')}</ul>
    </section>`).join('') : '<p class="muted small">Le déroulé de ce combat n\'a pas été gardé.</p>';
  openSheet({
    title: x.gagne ? 'Victoire' : 'Défaite',
    body: `<div class="hc-fiche">
        <div class="hc-tete ${x.gagne ? 'v' : 'd'}">${avatarHTML(a.avatar || 'star', a.frame || 'default', 'lg', a.photo || null)}
          <span><b>${h(a.nom || 'Adversaire')}</b><small>${h(x.titre || HISTO_MODES[x.mode] || 'Combat')}</small><small>${h(quand)}</small></span></div>
        <p class="hc-chiffres tnum">${x.tours} tour${x.tours > 1 ? 's' : ''} · PV restants : ${x.pv} contre ${x.pv_adv}${x.deck ? ` · deck « ${h(x.deck)} »` : ''}</p>
        ${raison ? `<p class="muted small">${h(raison)}</p>` : ''}
        <div class="hc-tours">${tours}</div>
        ${j && j.coupe ? '<p class="muted small">La partie était longue : le déroulé s\'arrête là.</p>' : ''}
      </div>`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}
