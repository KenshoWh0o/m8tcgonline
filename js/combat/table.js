/* L'arène (version 3.0) : la table de combat, en plein écran.

   Elle ne connaît pas les règles : elle montre l'état du moteur
   (js/combat/moteur.js), rend cliquables les actions qu'il permet, et joue en
   animation les événements qu'il renvoie. L'adversaire est l'IA
   (js/combat/ia.js) ou un ami (js/combat/defis.js), qui choisit parmi les
   mêmes actions.

   Le plateau est un plan incliné en perspective (css/combat.css) : le tapis,
   trois lignes par camp, les Essences au bord. La main est posée devant, en
   éventail. Tout se joue au doigt : toucher une carte de la main la lève et
   montre où elle peut aller ; toucher un de ses Joueurs ouvre ses attaques ;
   on peut aussi faire glisser une carte de la main vers sa place. Un appui
   long sur n'importe quelle carte la montre en grand. */
"use strict";

const Table = (() => {
  let T = null;

  /* ---------- Outils ---------- */
  const carte = id => Combat.carte(id) || byId[id] || {};
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const vitesse = () => (T && T.rapide ? 0.55 : 1) * (RM() ? 0.4 : 1);
  const attendre = ms => pause(ms * vitesse());
  const qs = s => T.el.querySelector(s);
  const qsa = s => [...T.el.querySelectorAll(s)];
  const adv = j => 1 - j;
  const nomCEO = j => T.E.j[j].nom;

  /* Une url() posée dans une variable CSS se lit depuis la feuille de style
     (css/), pas depuis la page : on la donne en absolu. */
  const abs = p => new URL(p, document.baseURI).href;
  /* Le dos des cartes : la sleeve choisie (Decks › Personnaliser). */
  const sleeveDe = j => (SLEEVES[(T.cosm[j] || {}).sleeve] || SLEEVES.s_base).img;
  const TAPIS_DEFAUT = 't_base';

  /* ---------- Une carte ---------- */
  function htmlCarte(id, o) {
    o = o || {};
    const c = carte(id);
    const img = c.img
      ? `<img src="${c.img}" alt="" draggable="false" decoding="async">`
      : `<div class="ar-texte r-${c.rar}" style="--tc:${tcol(c)}"><b>${h(c.nom)}</b><small>${h(c.provisoire ? 'Promo provisoire' : (RAR[c.rar] || {}).nom || '')}</small>${c.def != null ? `<em>Déf ${c.def}</em>` : ''}${(c.atks || []).map(a => `<span>${coutHTML(a.cout)} ${h(a.nom)} <i>${a.degats == null ? '' : a.degats}</i></span>`).join('')}</div>`;
    /* La maîtrise (js/maitrise.js) : seulement sur ses propres cartes. */
    const m = o.maitrise && typeof maitriseDe === 'function' ? maitriseDe(c) : null;
    return `<div class="ar-c${c.rev ? ' rev' : ''}${c.rar === 'L' || c.rar === 'S' ? ' holo' : ''}${m && m.niveau ? ' mt' + m.niveau : ''}" data-id="${id}">${img}${c.rev ? '<i class="ar-rev"></i>' : ''}</div>`;
  }
  const dos = j => `<div class="ar-c dos"><img src="${sleeveDe(j)}" alt="" draggable="false"></div>`;

  function coutHTML(cout) {
    const l = [];
    for (const k in cout) {
      if (k === 'neutre') continue;
      for (let i = 0; i < cout[k]; i++) l.push(essIcon(k, 'ar-cout'));
    }
    for (let i = 0; i < (cout.neutre || 0); i++) l.push(essIcon('neutre', 'ar-cout'));
    return `<span class="ar-couts">${l.join('')}</span>`;
  }

  /* Une Essence en jeu : un médaillon de sa couleur, brillant si on possède
     l'Essence Brillante de cette couleur. */
  function htmlEssence(e, j) {
    const brille = (T.brillantes[j] || []).includes(e.coul);
    return `<i class="ar-ess${e.eng ? ' eng' : ''}${brille ? ' brille' : ''}" data-e="${e.u}" style="--ec:${(COLORS[e.coul] || COLORS.neutre).c}">${essIcon(e.coul)}</i>`;
  }

  /* ---------- Ouvrir, fermer ---------- */
  /* `o` : {
       init (la partie à créer) ou E (une partie déjà en cours),
       moi: 0 | 1, ia: { niveau } (absent : adversaire humain),
       joueurs: [{ nom, avatar, frame, photo, titre }, …],
       cosm: [{ tapis, sleeve, jeton }, …], brillantes: [[couleurs], …],
       titre, sousTitre (le bandeau du haut), surFin(E), surAction(a) (PvP),
       sauver (clé de reprise) } */
  function ouvrir(o) {
    fermer(true);
    const E = o.E || Combat.creer(o.init);
    const reprise = !!o.E;
    T = {
      E, o, moi: o.moi || 0, cosm: o.cosm || [{}, {}], brillantes: o.brillantes || [[], []],
      sel: null, cible: null, rapide: false, occupe: false, fini: false, journal: [], vus: new Set()
    };
    let el = document.getElementById('arene');
    if (!el) {
      el = document.createElement('div');
      el.id = 'arene';
      document.body.appendChild(el);
    }
    T.el = el;
    el.hidden = false;
    document.body.classList.add('en-arene');
    el.innerHTML = squelette();
    brancher();
    rendre();
    SFX.jouer('ouvre');
    /* La partie qu'on reprend ne rejoue pas son pile ou face. */
    const debut = !reprise;
    (async () => {
      if (debut) await pileOuFace();
      boucle();
    })();
    return T;
  }

  function fermer(silence) {
    if (!T) return;
    T.ferme = true;
    const el = T.el;
    el.hidden = true;
    el.innerHTML = '';
    document.body.classList.remove('en-arene');
    T = null;
    if (!silence) SFX.jouer('retour');
  }

  const ouverte = () => !!T;

  /* ---------- Le squelette ---------- */
  function squelette() {
    const tapis = (TAPIS[(T.cosm[T.moi] || {}).tapis] || TAPIS[TAPIS_DEFAUT]);
    return `<div class="ar-fond${tapis.img ? '' : ' base'}" style="${tapis.img ? `--tapis:url('${abs(tapis.img)}')` : ''}"></div>
    <header class="ar-haut">
      <button class="ar-bouton ar-menu" data-ar="menu" aria-label="Menu du combat">${NAVICO.menu}</button>
      <div class="ar-ceo lui" data-cible="ceo"></div>
      <div class="ar-titre">${h(T.o.titre || 'Combat')}${T.o.sousTitre ? `<small>${h(T.o.sousTitre)}</small>` : ''}</div>
    </header>
    <div class="ar-scene">
      <div class="ar-plateau${tapis.img ? '' : ' base'}" style="${tapis.img ? `--tapis:url('${abs(tapis.img)}')` : ''}">
        <div class="ar-camp lui"><div class="ar-esss"></div><div class="ar-lignes"></div></div>
        <div class="ar-milieu"><span class="ar-phase"></span></div>
        <div class="ar-camp moi"><div class="ar-lignes"></div><div class="ar-esss"></div></div>
      </div>
    </div>
    <footer class="ar-bas">
      <div class="ar-ceo moi"></div>
      <div class="ar-piles"></div>
      <button class="ar-fin" data-ar="fin">Fin du tour</button>
    </footer>
    <div class="ar-main"></div>
    <div class="ar-panneau" hidden></div>
    <div class="ar-bulle" hidden></div>
    <div class="ar-annonce" hidden></div>
    <aside class="ar-journal" hidden><header><b>Journal</b><button class="ar-bouton" data-ar="journal" aria-label="Fermer">✕</button></header><ol></ol></aside>`;
  }

  /* ---------- Le rendu ---------- */
  function rendre() {
    if (!T) return;
    const E = T.E, m = T.moi, l = adv(m);
    const d = Combat.demande(E);
    const monTour = E.actif === m && !E.fin;
    T.el.classList.toggle('mon-tour', monTour);
    T.el.classList.toggle('phase-combat', E.phase === 'combat');

    qs('.ar-ceo.lui').innerHTML = htmlCEO(l, true);
    qs('.ar-ceo.moi').innerHTML = htmlCEO(m, false);

    rendreCamp(l, qs('.ar-camp.lui'));
    rendreCamp(m, qs('.ar-camp.moi'));

    const P = E.j[m];
    qs('.ar-piles').innerHTML = `
      <button class="ar-pile" data-ar="defausse" data-j="${m}" aria-label="Ta défausse"><span class="ar-pile-c">${P.defausse.length ? htmlCarte(P.defausse[P.defausse.length - 1].id) : '<i class="ar-vide"></i>'}</span><small>Défausse ${P.defausse.length}</small></button>
      <span class="ar-pile club"><span class="ar-pile-c">${P.club.length ? dos(m) : '<i class="ar-vide"></i>'}</span><small>Club ${P.club.length}</small></span>
      ${P.banc.length ? `<button class="ar-pile" data-ar="banc" data-j="${m}"><span class="ar-pile-c">${htmlCarte(P.banc[P.banc.length - 1].id)}</span><small>Banc ${P.banc.length}</small></button>` : ''}`;

    rendreMain();

    /* La phase, au milieu du plateau. */
    const ph = qs('.ar-phase');
    if (E.fin) ph.textContent = '';
    else if (!monTour) ph.textContent = `Tour de ${nomCEO(E.actif)}`;
    else if (Combat.premierTourDuPremier(E, m)) ph.textContent = 'Premier tour : pas d\'attaque';
    else ph.textContent = E.phase === 'combat' ? 'Phase de Combat' : 'Phase de jeu';

    const fin = qs('.ar-fin');
    const peutFinir = monTour && d && d.type === 'tour' && Combat.optionsTour(E).some(a => a.t === 'finTour');
    fin.disabled = !peutFinir || T.occupe;
    fin.classList.toggle('pulse', peutFinir && !T.occupe && !actionsUtiles());
    fin.textContent = d && d.type === 'tour' && monTour && !peutFinir && E.cpt.doitAttaquer ? 'Attaque obligée' : 'Fin du tour';

    surligner();
  }

  /* Reste-t-il quelque chose d'utile à faire ? (Le bouton « Fin du tour »
     se met à battre quand non.) */
  function actionsUtiles() {
    const d = Combat.demande(T.E);
    if (!d || d.type !== 'tour' || d.qui !== T.moi) return false;
    return Combat.optionsTour(T.E).some(a => a.t !== 'finTour');
  }

  function htmlCEO(j, haut) {
    const P = T.E.j[j], inf = (T.o.joueurs || [])[j] || {};
    const pv = P.pv.length;
    const pips = Array.from({ length: Math.max(P.pvDepart, pv) }, (_, i) =>
      `<i class="ar-pv${i < pv ? '' : ' perdu'}"></i>`).join('');
    const actif = T.E.actif === j && !T.E.fin;
    return `<span class="ar-ava${actif ? ' actif' : ''}">${avatarHTML(inf.avatar || 'star', inf.frame || 'default', 'md', inf.photo || null)}</span>
      <span class="ar-qui"><b>${h(P.nom)}</b><span class="ar-pvs" aria-label="${pv} PV">${pips}<em>${pv} PV</em></span></span>
      ${haut ? `<span class="ar-mainadv" aria-label="${P.main.length} cartes en main">${Array.from({ length: Math.min(P.main.length, 8) }, () => `<i style="--dos:url('${abs(sleeveDe(j))}')"></i>`).join('')}<em>${P.main.length}</em></span>
        <span class="ar-clubadv"><i style="--dos:url('${abs(sleeveDe(j))}')"></i><em>${P.club.length}</em></span>` : ''}`;
  }

  function rendreCamp(j, el) {
    const E = T.E, P = E.j[j];
    const lignes = el.querySelector('.ar-lignes');
    /* Les trois places, toujours là, pour que les cartes ne sautent pas. */
    if (lignes.children.length !== Combat.REGLE.LIGNES) {
      lignes.innerHTML = P.lignes.map((_, i) => `<div class="ar-place" data-ligne="${i}" data-j="${j}"></div>`).join('');
    }
    P.lignes.forEach((c, i) => {
      const place = lignes.children[i];
      const actuel = place.firstElementChild;
      if (!c) { if (actuel) actuel.remove(); return; }
      let x = actuel && +actuel.dataset.u === c.u ? actuel : null;
      if (!x) {
        place.innerHTML = '';
        x = document.createElement('div');
        x.className = 'ar-j';
        x.dataset.u = c.u;
        place.appendChild(x);
        x.innerHTML = htmlJoueurInterieur(c);
      } else majJoueur(x, c);
      majEtatJoueur(x, c);
    });
    const ess = el.querySelector('.ar-esss');
    ess.innerHTML = P.ess.map(e => htmlEssence(e, j)).join('')
      + (P.reserve.length ? `<span class="ar-reserve" title="Réserve">${P.reserve.length}</span>` : '');
  }

  function htmlJoueurInterieur(c) {
    return `<div class="ar-objs">${c.obj.map(o => `<span class="ar-obj" data-u="${o.u}">${htmlCarte(o.id)}</span>`).join('')}</div>
      ${htmlCarte(c.id, { maitrise: c.j === T.moi })}<div class="ar-stats"></div><div class="ar-marques"></div>`;
  }
  function majJoueur(x, c) {
    const objs = x.querySelector('.ar-objs');
    const ids = c.obj.map(o => o.u).join(',');
    if (objs.dataset.k !== ids) {
      objs.dataset.k = ids;
      objs.innerHTML = c.obj.map(o => `<span class="ar-obj" data-u="${o.u}">${htmlCarte(o.id)}</span>`).join('');
    }
  }
  function majEtatJoueur(x, c) {
    const E = T.E;
    x.classList.toggle('eng', !!c.eng);
    const k = carte(c.id);
    const def = Combat.defense(E, c);
    const bonus = def - (k.def || 0);
    const atks = k.atks.map((a, i) => Combat.valeurAttaque(E, c, i));
    const maxA = Math.max(...atks.filter(v => v != null), 0);
    const baseA = Math.max(...k.atks.map(a => a.degats || 0), 0);
    x.querySelector('.ar-stats').innerHTML =
      `<span class="ar-def${bonus > 0 ? ' plus' : bonus < 0 ? ' moins' : ''}" title="Défense">${def}</span>`
      + (maxA ? `<span class="ar-atk${maxA > baseA ? ' plus' : maxA < baseA ? ' moins' : ''}" title="Meilleure attaque">${maxA}</span>` : '');
    const mk = [];
    for (const m of ['Provocation', 'Garde', 'Riposte', 'Légion', 'Buff']) if (Combat.aMotCle(E, c, m)) mk.push(`<i class="ar-mk mk-${O_.sansAccent(m)}" title="${m}">${MARQUES[m]}</i>`);
    if (Combat.shieldActif(E, c)) mk.push(`<i class="ar-mk mk-shield" title="Shield">${MARQUES.Shield}</i>`);
    if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) mk.push('<i class="ar-mk mk-bloque" title="Ne peut pas attaquer">⊘</i>');
    x.querySelector('.ar-marques').innerHTML = mk.join('');
    x.classList.toggle('shield', Combat.shieldActif(E, c));
  }
  const O_ = Combat.O;
  const MARQUES = {
    Provocation: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z"/><path d="M12 8v5M12 16v.5"/></svg>',
    Garde: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z"/></svg>',
    Shield: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M7 12h10" opacity=".6"/></svg>',
    Riposte: '<svg viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M5 7v10"/></svg>',
    Légion: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/></svg>',
    Buff: '<svg viewBox="0 0 24 24"><path d="M12 4v16M5 11l7-7 7 7"/></svg>'
  };

  function rendreMain() {
    const el = qs('.ar-main');
    const P = T.E.j[T.moi];
    const n = P.main.length;
    const cle = P.main.map(c => c.u).join(',');
    if (el.dataset.k !== cle) {
      el.dataset.k = cle;
      el.innerHTML = P.main.map((c, i) => `<button class="ar-m" data-mu="${c.u}" style="--i:${i};--n:${n}" aria-label="${h(carte(c.id).nom)}">${htmlCarte(c.id, { maitrise: true })}</button>`).join('');
    }
    el.style.setProperty('--n', n);
  }

  /* ---------- Ce qu'on peut toucher ---------- */
  /* Selon la décision en cours : les cartes jouables de la main, les
     Joueurs qui peuvent attaquer, les cibles d'une attaque, les choix d'un
     effet. */
  function surligner() {
    qsa('.jouable,.cible,.choisi,.option,.attaquant').forEach(x => x.classList.remove('jouable', 'cible', 'choisi', 'option', 'attaquant'));
    if (!T || T.occupe || T.E.fin) return;
    const d = Combat.demande(T.E);
    if (!d || d.qui !== T.moi) return;
    if (d.type === 'tour') {
      const opts = Combat.optionsTour(T.E);
      const mains = new Set(opts.filter(a => a.t === 'deployer' || a.t === 'lier' || a.t === 'jouer').map(a => a.u));
      qsa('.ar-m').forEach(b => b.classList.toggle('jouable', mains.has(+b.dataset.mu)));
      const att = new Set(opts.filter(a => a.t === 'attaquer').map(a => a.u));
      qsa('.ar-camp.moi .ar-j').forEach(x => x.classList.toggle('attaquant', att.has(+x.dataset.u)));
      if (T.sel) marquerCiblesSelection();
    } else if (d.type === 'choix' && d.options.some(o => o.u)) {
      for (const o of d.options) if (o.u) {
        const x = T.el.querySelector(`.ar-j[data-u="${o.u}"],.ar-obj[data-u="${o.u}"],.ar-m[data-mu="${o.u}"],.ar-ess[data-e="${o.u}"]`);
        if (x) x.classList.add('option');
      }
    }
  }

  /* La carte choisie dans la main : où peut-elle aller ? */
  function marquerCiblesSelection() {
    const opts = Combat.optionsTour(T.E).filter(a => a.u === T.sel);
    qsa('.ar-m').forEach(b => b.classList.toggle('choisi', +b.dataset.mu === T.sel));
    for (const a of opts) {
      if (a.t === 'deployer') {
        const p = qs(`.ar-camp.moi .ar-place[data-ligne="${a.ligne}"]`);
        if (p) p.classList.add('cible');
      }
      if (a.t === 'lier') {
        const x = qs(`.ar-camp.moi .ar-j[data-u="${a.cible}"]`);
        if (x) x.classList.add('cible');
      }
    }
  }

  /* ---------- Les gestes ---------- */
  function brancher() {
    const el = T.el;
    el.addEventListener('click', clic);
    el.addEventListener('contextmenu', e => {
      const c = e.target.closest('[data-id]');
      if (c) { e.preventDefault(); zoom(c.dataset.id, e.target.closest('[data-u],[data-mu]')); }
    });
    /* Appui long : la carte en grand. Glisser depuis la main : la poser. */
    let appui = null;
    el.addEventListener('pointerdown', e => {
      const c = e.target.closest('.ar-m,.ar-j,.ar-obj,.ar-pile,.ar-panneau [data-id]');
      if (!c) return;
      const id = (c.querySelector('[data-id]') || c).dataset.id || (c.dataset.id);
      appui = { x: e.clientX, y: e.clientY, el: c, id, t: setTimeout(() => { appui && (appui.long = true); zoom(id, c); }, 480), drag: null, pid: e.pointerId };
    });
    el.addEventListener('pointermove', e => {
      if (!appui) return;
      const dx = e.clientX - appui.x, dy = e.clientY - appui.y;
      if (!appui.drag && Math.hypot(dx, dy) > 12) {
        clearTimeout(appui.t);
        if (appui.el.classList.contains('ar-m') && appui.el.classList.contains('jouable') && !T.occupe) commencerGlisser(appui, e);
        else appui.annule = true;
      }
      if (appui.drag) glisser(appui, e);
    });
    const fin = e => {
      if (!appui) return;
      clearTimeout(appui.t);
      if (appui.drag) { e.preventDefault(); lacher(appui, e); appui.bloqueClic = true; }
      T && (T.bloqueClic = appui.long || appui.bloqueClic || appui.annule);
      appui = null;
    };
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', () => { if (appui && appui.drag) annulerGlisser(appui); appui = null; });
  }

  function clic(e) {
    if (!T) return;
    if (T.bloqueClic) { T.bloqueClic = false; return; }
    const b = e.target.closest('[data-ar]');
    if (b) return action(b.dataset.ar, b);
    if (T.occupe) return;
    const d = Combat.demande(T.E);
    if (!d || d.qui !== T.moi || T.E.fin) {
      const c = e.target.closest('[data-id]');
      if (c) zoom(c.dataset.id, e.target.closest('[data-u],[data-mu]'));
      return;
    }
    /* Une décision qui se prend sur le plateau ou dans la main. */
    if (d.type === 'choix' && d.options.some(o => o.u)) {
      const x = e.target.closest('.option');
      if (x) {
        const u = +(x.dataset.u || x.dataset.mu || x.dataset.e);
        return choisir({ t: 'choix', v: u });
      }
    }
    if (d.type === 'cartes' && T.multi) {
      const x = e.target.closest('.ar-m,.ar-j');
      if (x) return basculerMulti(+(x.dataset.u || x.dataset.mu));
    }
    if (d.type !== 'tour') return;

    /* Mode cible d'attaque. */
    if (T.cible) {
      const ceo = e.target.closest('.ar-ceo.lui');
      const j = e.target.closest('.ar-camp.lui .ar-j');
      const v = ceo ? 'ceo' : j ? +j.dataset.u : null;
      if (v != null) {
        const a = T.cible.opts.find(o => o.cible === v);
        if (a) { T.cible = null; fermerPanneau(); return jouer(a); }
      }
      T.cible = null;
      fermerPanneau();
      return rendre();
    }

    const m = e.target.closest('.ar-m');
    if (m) return selection(+m.dataset.mu);
    const place = e.target.closest('.ar-camp.moi .ar-place');
    const joueur = e.target.closest('.ar-camp.moi .ar-j');
    if (T.sel) {
      const opts = Combat.optionsTour(T.E).filter(a => a.u === T.sel);
      if (joueur) {
        const a = opts.find(o => o.t === 'lier' && o.cible === +joueur.dataset.u);
        if (a) { T.sel = null; return jouer(a); }
      }
      if (place && !place.querySelector('.ar-j')) {
        const a = opts.find(o => o.t === 'deployer' && o.ligne === +place.dataset.ligne);
        if (a) { T.sel = null; fermerPanneau(); return jouer(a); }
      }
      T.sel = null;
      fermerPanneau();
      rendre();
      if (!joueur) return;
    }
    if (joueur) return panneauJoueur(+joueur.dataset.u);
    const adv = e.target.closest('[data-id]');
    if (adv) zoom(adv.dataset.id, e.target.closest('[data-u]'));
  }

  /* Une carte de la main touchée. */
  function selection(u) {
    SFX.jouer('carte');
    if (T.sel === u) { T.sel = null; fermerPanneau(); return rendre(); }
    T.sel = u;
    const c = T.E.j[T.moi].main.find(x => x.u === u);
    const k = carte(c.id);
    const opts = Combat.optionsTour(T.E).filter(a => a.u === u);
    let consigne = '';
    let bouton = '';
    if (k.cat === 'joueur') consigne = opts.length ? 'Touche une ligne libre pour le déployer.' : raisonPasDeploiement();
    else if (k.cat === 'objet') consigne = opts.length ? 'Touche un de tes Joueurs pour lier cet Objet.' : (T.E.phase === 'combat' ? 'Plus d\'Objet en phase de Combat.' : 'Il te faut un Joueur sur le plateau.');
    else {
      const a = opts.find(x => x.t === 'jouer');
      if (a) bouton = `<button class="btn" data-ar="jouer" data-u="${u}">Jouer ${k.cat === 'coach' ? 'ce Coach' : 'ce Moment'}</button>`;
      else consigne = k.cat === 'coach' && T.E.cpt.coachs >= Combat.REGLE.COACHS ? 'Un seul Coach par tour.' : 'Rien à viser pour le moment.';
    }
    ouvrirPanneau(`<div class="ar-pcarte">${htmlCarte(c.id)}<div><b>${h(k.nom)}</b><p class="ar-ptype">${typeDe(k)}</p>${texteCarte(k)}</div></div>
      ${consigne ? `<p class="ar-consigne">${h(consigne)}</p>` : ''}
      <div class="ar-pact">${bouton}<button class="btn ghost" data-ar="annuler">Fermer</button></div>`, 'carte');
    rendre();
  }

  function raisonPasDeploiement() {
    if (T.E.phase === 'combat') return 'Plus de déploiement en phase de Combat.';
    if (T.E.cpt.deploie >= Combat.REGLE.DEPLOIEMENTS) return 'Un seul Joueur déployé par tour.';
    return 'Tes trois lignes sont occupées.';
  }

  const typeDe = k => ({ joueur: 'Joueur', coach: 'Coach · Instant', moment: 'Moment · Instant', objet: 'Objet · Lien' }[k.cat] || '')
    + ` · ${(COLORS[k.col] || COLORS.neutre).nom}`;

  /* Le texte d'une carte, lisible : attaques avec leur coût, talent, effet,
     Résilience. */
  function texteCarte(k, c) {
    const l = [];
    if (k.cat === 'joueur') {
      l.push(`<p class="ar-tdef">Défense <b>${c ? Combat.defense(T.E, c) : k.def}</b>${c && Combat.defense(T.E, c) !== k.def ? ` <small>(${k.def} imprimée)</small>` : ''}</p>`);
      k.atks.forEach((a, i) => {
        const v = c ? Combat.valeurAttaque(T.E, c, i) : a.degats;
        l.push(`<p class="ar-tatk">${coutHTML(a.cout)} <b>${h(a.nom)}</b> ${a.degats == null ? '' : `<em>${v}${a.plus ? '' : ''}</em>`}${a.effet ? `<br><small>${h(a.effet)}</small>` : ''}</p>`);
      });
      if (k.kw) l.push(`<p class="ar-tkw"><b>${h(k.kw.nom)}${k.kw.icone === 'etoile' ? ' ★' : k.kw.icone === 'declencheur' ? ' ⚡' : ''}</b> ${h(k.kw.texte)}</p>`);
      (k.talents || []).forEach(t => l.push(`<p class="ar-tkw"><b>${h(t.nom)}</b> ${h(t.texte)}</p>`));
    } else {
      (k.fx || []).forEach(t => l.push(`<p>${h(t)}</p>`));
    }
    if (k.res) l.push(`<p class="ar-tres"><b>Résilience</b> ${h(k.res)}</p>`);
    if (k.provisoire) l.push('<p class="ar-tprov">Carte provisoire : son vrai contenu n\'est pas encore connu.</p>');
    return l.join('');
  }

  /* Un de ses Joueurs touché : ses attaques. */
  function panneauJoueur(u) {
    const c = Combat.trouverSurPlateau(T.E, u);
    if (!c) return;
    SFX.jouer('carte');
    const k = carte(c.id);
    const opts = Combat.optionsTour(T.E).filter(a => a.t === 'attaquer' && a.u === u);
    const lignes = k.atks.map((a, i) => {
      const inf = Combat.infoAttaque(T.E, c, i);
      const possible = opts.filter(o => o.k === i);
      const raison = !possible.length ? pourquoiPas(c, i, inf) : '';
      const chev = possible.some(o => o.chevaliere) && !possible.some(o => !o.chevaliere);
      return `<button class="ar-attaque" data-ar="attaque" data-u="${u}" data-k="${i}" ${possible.length ? '' : 'disabled'}>
        ${coutHTML(chev ? { neutre: 2 } : inf.cout)}<span><b>${h(a.nom)}</b>${a.effet ? `<small>${h(a.effet)}</small>` : ''}${raison ? `<small class="ar-raison">${h(raison)}</small>` : ''}</span>
        <em>${a.degats == null ? 'effet' : inf.val}</em></button>`;
    }).join('');
    ouvrirPanneau(`<div class="ar-pcarte">${htmlCarte(c.id)}<div><b>${h(k.nom)}</b><p class="ar-ptype">${typeDe(k)}${c.eng ? ' · engagé' : ''}</p>
        <p class="ar-tdef">Défense <b>${Combat.defense(T.E, c)}</b></p>${k.kw ? `<p class="ar-tkw"><b>${h(k.kw.nom)}</b> ${h(k.kw.texte)}</p>` : ''}
        ${c.obj.length ? `<p class="ar-tobj">Objets : ${c.obj.map(o => h(carte(o.id).nom)).join(', ')}</p>` : ''}</div></div>
      <div class="ar-attaques">${lignes}</div>
      <div class="ar-pact"><button class="btn ghost" data-ar="annuler">Fermer</button></div>`, 'joueur');
  }

  function pourquoiPas(c, k, inf) {
    const E = T.E;
    if (E.actif !== T.moi) return 'Ce n\'est pas ton tour.';
    if (Combat.premierTourDuPremier(E, T.moi)) return 'Pas d\'attaque au tout premier tour.';
    if (E.cpt.combatFini) return 'La phase de Combat est finie.';
    if (c.eng) return 'Engagé : il a déjà attaqué ou défendu.';
    if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) return 'Il ne peut pas attaquer ce tour.';
    if (!inf.payable) return 'Pas assez d\'Essences de la bonne couleur.';
    return '';
  }

  /* ---------- Le panneau ---------- */
  function ouvrirPanneau(html, genre) {
    const p = qs('.ar-panneau');
    p.className = 'ar-panneau ' + (genre || '');
    p.innerHTML = html;
    p.hidden = false;
  }
  function fermerPanneau() {
    if (!T) return;
    const p = qs('.ar-panneau');
    p.hidden = true;
    p.innerHTML = '';
    T.multi = null;
  }

  /* ---------- Les actions des boutons ---------- */
  function action(k, b) {
    if (k === 'menu') return menu();
    if (k === 'journal') return basculerJournal();
    if (k === 'annuler') { T.sel = null; T.cible = null; fermerPanneau(); return rendre(); }
    if (k === 'defausse' || k === 'banc') return voirPile(+b.dataset.j, k);
    if (k === 'quitter') return quitter();
    if (T.occupe) return;
    const d = Combat.demande(T.E);
    if (k === 'fin') {
      if (!d || d.type !== 'tour' || d.qui !== T.moi) return;
      T.sel = null; fermerPanneau();
      return jouer({ t: 'finTour' });
    }
    if (k === 'jouer') { T.sel = null; fermerPanneau(); return jouer({ t: 'jouer', u: +b.dataset.u }); }
    if (k === 'attaque') return choisirAttaque(+b.dataset.u, +b.dataset.k);
    if (k === 'opt') return choisir({ t: 'choix', v: valeurOpt(b.dataset.v) });
    if (k === 'multi-ok') return choisir({ t: 'cartes', u: [...T.multi.sel] });
    if (k === 'multi') return basculerMulti(+b.dataset.u);
    if (k === 'ordre') return ordreClic(+b.dataset.u);
    if (k === 'ordre-ok') return choisir({ t: 'ordre', u: T.ordre.sel.concat(T.ordre.reste) });
    if (k === 'ordre-raz') { T.ordre.reste = T.ordre.reste.concat(T.ordre.sel); T.ordre.sel = []; return montrerDecision(Combat.demande(T.E)); }
    if (k === 'vitesse') { T.rapide = !T.rapide; b.classList.toggle('on', T.rapide); return; }
  }
  const valeurOpt = v => (/^-?\d+$/.test(v) ? +v : v);

  function choisirAttaque(u, k) {
    const opts = Combat.optionsTour(T.E).filter(a => a.t === 'attaquer' && a.u === u && a.k === k);
    if (!opts.length) return;
    /* La Chevalière : la version la moins chère quand il y a le choix. */
    const sans = opts.filter(o => !o.chevaliere);
    const liste = sans.length ? sans : opts;
    const go = () => {
      if (liste[0].cible == null) { fermerPanneau(); return jouer(liste[0]); }
      if (liste.length === 1) { fermerPanneau(); return jouer(liste[0]); }
      /* Choisir la cible sur le plateau. */
      T.cible = { u, k, opts: liste };
      fermerPanneau();
      rendre();
      for (const o of liste) {
        if (o.cible === 'ceo') qs('.ar-ceo.lui').classList.add('cible');
        else { const x = qs(`.ar-j[data-u="${o.cible}"]`); if (x) x.classList.add('cible'); }
      }
      qs(`.ar-j[data-u="${u}"]`).classList.add('choisi');
      bulle('Choisis la cible de l\'attaque', true);
    };
    /* Passer en phase de Combat ferme la phase de jeu : on prévient une fois,
       s'il reste un Joueur à déployer ou un Objet à lier. */
    if (T.E.phase === 'jeu' && Combat.optionsTour(T.E).some(a => a.t === 'deployer' || a.t === 'lier') && !JEU.combatSansAvertir) {
      return ouvrirPanneau(`<p class="ar-consigne"><b>Passer en phase de Combat ?</b><br>Tu ne pourras plus déployer de Joueur ni lier d'Objet ce tour.</p>
        <label class="ar-coche"><input type="checkbox" id="ar-plus"> Ne plus me demander</label>
        <div class="ar-pact"><button class="btn" id="ar-go">Attaquer</button><button class="btn ghost" data-ar="annuler">Pas encore</button></div>`, 'confirmer'),
        qs('#ar-go').addEventListener('click', ev => {
          ev.stopPropagation();
          if (qs('#ar-plus').checked) { JEU.combatSansAvertir = true; try { localStorage.setItem('mtcg.jeu', JSON.stringify(JEU)); } catch (er) { /* */ } }
          go();
        });
    }
    go();
  }

  /* ---------- Glisser une carte de la main ---------- */
  function commencerGlisser(a, e) {
    const u = +a.el.dataset.mu;
    T.sel = u;
    marquerCiblesSelection();
    const r = a.el.getBoundingClientRect();
    const fant = a.el.cloneNode(true);
    fant.className = 'ar-fantome';
    fant.style.width = r.width + 'px';
    fant.style.height = r.height + 'px';
    document.body.appendChild(fant);
    a.drag = { fant, dx: e.clientX - r.left, dy: e.clientY - r.top, u };
    a.el.classList.add('leve');
    glisser(a, e);
  }
  function glisser(a, e) {
    const f = a.drag.fant;
    f.style.transform = `translate(${e.clientX - a.drag.dx}px, ${e.clientY - a.drag.dy}px) rotate(${Math.max(-12, Math.min(12, (e.movementX || 0) * 1.5))}deg)`;
    const sous = document.elementsFromPoint(e.clientX, e.clientY);
    qsa('.survol').forEach(x => x.classList.remove('survol'));
    const t = sous.find(x => x.classList && x.classList.contains('cible'));
    if (t) t.classList.add('survol');
  }
  function lacher(a, e) {
    const sous = document.elementsFromPoint(e.clientX, e.clientY);
    const u = a.drag.u;
    annulerGlisser(a);
    const opts = Combat.optionsTour(T.E).filter(o => o.u === u);
    const place = sous.find(x => x.classList && x.classList.contains('ar-place') && x.closest('.ar-camp.moi'));
    const joueur = sous.find(x => x.classList && x.classList.contains('ar-j') && x.closest('.ar-camp.moi'));
    let act = null;
    if (joueur) act = opts.find(o => o.t === 'lier' && o.cible === +joueur.dataset.u);
    if (!act && place) act = opts.find(o => o.t === 'deployer' && o.ligne === +place.dataset.ligne);
    if (!act && sous.some(x => x.classList && (x.classList.contains('ar-scene') || x.classList.contains('ar-plateau')))) act = opts.find(o => o.t === 'jouer');
    T.sel = null;
    if (act) { fermerPanneau(); jouer(act); } else rendre();
  }
  function annulerGlisser(a) {
    if (a.drag && a.drag.fant) a.drag.fant.remove();
    a.el.classList.remove('leve');
    qsa('.survol').forEach(x => x.classList.remove('survol'));
  }

  /* ---------- Jouer une action ---------- */
  async function jouer(a) {
    if (!T || T.occupe) return;
    const d = Combat.demande(T.E);
    if (!d || d.qui !== T.moi) return;
    cacherBulle();
    try {
      await executer(a);
    } catch (e) {
      toast(e.message || 'Action impossible.');
      SFX.jouer('erreur');
      rendre();
      return;
    }
    boucle();
  }
  const choisir = a => { fermerPanneau(); return jouer(a); };

  async function executer(a) {
    T.occupe = true;
    rendre();
    const d = Combat.demande(T.E);
    const deMoi = !!d && d.qui === T.moi;
    let evs;
    try {
      evs = Combat.agir(T.E, a);
    } finally {
      T.occupe = false;
    }
    if (T.o.surAction) T.o.surAction(a, T.E, deMoi);
    sauver();
    T.occupe = true;
    try {
      await animer(evs);
    } finally {
      if (T) { T.occupe = false; rendre(); }
    }
  }

  function sauver() {
    if (!T || !T.o.sauver) return;
    try {
      if (T.E.fin) localStorage.removeItem(T.o.sauver);
      else localStorage.setItem(T.o.sauver, JSON.stringify({ init: T.E.init, journal: T.E.journal, meta: T.o.meta || null, le: Date.now() }));
    } catch (e) { /* stockage plein ou interdit */ }
  }

  /* La partie avance toute seule tant que ce n'est pas à nous de décider. */
  async function boucle() {
    if (!T || T.boucle) return;
    T.boucle = true;
    const moi = T;
    try {
      while (T === moi && !T.ferme) {
        const d = Combat.demande(T.E);
        if (!d) { await finDePartie(); break; }
        if (d.qui === T.moi) { montrerDecision(d); break; }
        if (!T.o.ia) { attenteAdversaire(true); break; }
        await attendre(d.type === 'tour' ? 520 : 380);
        if (T !== moi || T.ferme) break;
        const a = IA.choisir(T.E, { niveau: T.o.ia.niveau });
        await executer(a);
      }
    } catch (e) {
      console.error(e);
      toast('Le combat a rencontré un problème : ' + (e.message || e));
    } finally {
      if (T === moi) T.boucle = false;
    }
  }

  /* Combat entre amis : l'action de l'autre arrive (js/combat/defis.js). */
  async function actionDistante(a) {
    if (!T) return;
    attenteAdversaire(false);
    await executer(a);
    boucle();
  }
  function attenteAdversaire(on) {
    if (!T) return;
    if (on) bulle(`${nomCEO(adv(T.moi))} réfléchit…`, false, 'attente');
    else cacherBulle();
  }

  /* ---------- Les décisions ---------- */
  function montrerDecision(d) {
    rendre();
    if (d.type === 'tour') {
      fermerPanneauDecision();
      if (T.E.cpt.doitAttaquer > 0) bulle('One More : tu dois déclencher une attaque de plus.', true);
      return;
    }
    if (d.type === 'choix') return decisionChoix(d);
    if (d.type === 'cartes') return decisionCartes(d);
    if (d.type === 'ordre') return decisionOrdre(d);
  }
  function fermerPanneauDecision() {
    const p = qs('.ar-panneau');
    if (p && p.classList.contains('decision')) fermerPanneau();
  }

  function decisionChoix(d) {
    const E = T.E;
    let haut = '';
    if (d.but === 'mulligan') {
      haut = `<div class="ar-mulligan">${E.j[T.moi].main.map(c => htmlCarte(c.id)).join('')}</div>`;
    } else if (d.carte) {
      haut = `<div class="ar-pcarte grand">${htmlCarte(d.carte)}<div><b>${h(carte(d.carte).nom)}</b>${d.texte ? `<p>${h(d.texte)}</p>` : ''}</div></div>`;
    } else if (d.cartes && d.cartes.length) {
      haut = `<div class="ar-liste">${d.cartes.map(c => {
        const opt = d.options.find(o => o.v === c.u);
        return `<button class="ar-lc${opt ? '' : ' grise'}" ${opt ? `data-ar="opt" data-v="${c.u}"` : 'disabled'}>${htmlCarte(c.id)}</button>`;
      }).join('')}</div>`;
    }
    if (d.but === 'defense') {
      const att = Combat.trouverSurPlateau(E, d.attaquant);
      if (att) qs(`.ar-j[data-u="${att.u}"]`)?.classList.add('menace');
      haut = `<p class="ar-dtitre">${h(d.titre)}</p><p class="ar-consigne">${h(d.texte)}</p>`;
    }
    const surPlateau = d.options.some(o => o.u) && !(d.cartes && d.cartes.length) && d.zone !== 'liste';
    const boutons = d.options.map(o => {
      if (surPlateau && o.u && d.but !== 'defense') return '';
      let info = '';
      if (o.info && d.but === 'defense') info = `<small>${o.info.vaincu ? `vaincu (${o.info.def} ≤ ${o.info.val})` : `tient (${o.info.def} > ${o.info.val})`}</small>`;
      if (o.info && d.but === 'riposte') info = `<small>${o.info.val >= o.info.def ? 'le vainc' : 'ne suffit pas'} · Défense ${o.info.def}</small>`;
      if (d.cartes && d.cartes.some(c => c.u === o.v)) return '';
      return `<button class="btn ${o.v === 'non' || o.v === 'b' && d.but !== 'choixAdverse' ? 'ghost' : ''}" data-ar="opt" data-v="${o.v}">${h(o.label)}${info}</button>`;
    }).join('');
    const titre = d.but === 'defense' ? '' : `<p class="ar-dtitre">${h(d.titre)}</p>${d.texte && !d.carte ? `<p class="ar-consigne">${h(d.texte)}</p>` : ''}`;
    ouvrirPanneau(`${d.but === 'defense' ? haut : titre + haut}
      ${surPlateau && d.but !== 'defense' ? '<p class="ar-consigne">Touche ton choix sur le plateau.</p>' : ''}
      <div class="ar-pact${d.options.length > 3 ? ' col' : ''}">${boutons}</div>`, 'decision ' + (d.but || ''));
    if (surPlateau) surligner();
    if (d.but === 'defense' || d.but === 'resilience') SFX.jouer('notif');
  }

  function decisionCartes(d) {
    T.multi = { sel: new Set(), d };
    const depuisMain = d.zone === 'main';
    const liste = d.cartes || d.parmi.map(u => {
      const c = T.E.j[T.moi].main.find(x => x.u === u) || Combat.trouverSurPlateau(T.E, u);
      return c ? { u, id: c.id } : null;
    }).filter(Boolean);
    ouvrirPanneau(`<p class="ar-dtitre">${h(d.titre)}</p>${d.texte ? `<p class="ar-consigne">${h(d.texte)}</p>` : ''}
      <p class="ar-consigne">${d.min === d.max ? `Choisis ${d.min} carte${d.min > 1 ? 's' : ''}.` : `De ${d.min} à ${d.max} cartes.`}</p>
      <div class="ar-liste">${liste.map(c => `<button class="ar-lc" data-ar="multi" data-u="${c.u}">${htmlCarte(c.id)}<i class="ar-coche-c"></i></button>`).join('')}</div>
      <div class="ar-pact"><button class="btn" data-ar="multi-ok" ${d.min > 0 ? 'disabled' : ''}>Valider</button></div>`, 'decision cartes' + (depuisMain ? ' main' : ''));
  }
  function basculerMulti(u) {
    const m = T.multi;
    if (!m) return;
    if (m.sel.has(u)) m.sel.delete(u);
    else if (m.sel.size < m.d.max) m.sel.add(u);
    qsa('[data-ar="multi"]').forEach(b => b.classList.toggle('pris', m.sel.has(+b.dataset.u)));
    const ok = qs('[data-ar="multi-ok"]');
    if (ok) ok.disabled = m.sel.size < m.d.min || m.sel.size > m.d.max;
  }

  function decisionOrdre(d) {
    if (!T.ordre || T.ordre.d !== d) T.ordre = { d, sel: [], reste: d.parmi.slice() };
    const o = T.ordre;
    const carteDe = u => d.cartes.find(c => c.u === u);
    ouvrirPanneau(`<p class="ar-dtitre">${h(d.titre)}</p>${d.texte ? `<p class="ar-consigne">${h(d.texte)}</p>` : ''}
      <p class="ar-consigne">Touche les cartes dans l'ordre voulu.</p>
      <div class="ar-liste">${o.sel.map((u, i) => `<span class="ar-lc pris"><b class="ar-rang">${i + 1}</b>${htmlCarte(carteDe(u).id)}</span>`).join('')}
        ${o.reste.map(u => `<button class="ar-lc" data-ar="ordre" data-u="${u}">${htmlCarte(carteDe(u).id)}</button>`).join('')}</div>
      <div class="ar-pact"><button class="btn" data-ar="ordre-ok">Valider</button>${o.sel.length ? '<button class="btn ghost" data-ar="ordre-raz">Recommencer</button>' : ''}</div>`, 'decision ordre');
  }
  function ordreClic(u) {
    const o = T.ordre;
    o.reste = o.reste.filter(x => x !== u);
    o.sel.push(u);
    decisionOrdre(o.d);
  }

  /* ---------- La bulle (consignes, attente) ---------- */
  function bulle(txt, haut, genre) {
    const b = qs('.ar-bulle');
    b.className = 'ar-bulle' + (haut ? ' haut' : '') + (genre ? ' ' + genre : '');
    b.textContent = txt;
    b.hidden = false;
  }
  function cacherBulle() { if (T) qs('.ar-bulle').hidden = true; }

  /* ---------- Voir en grand ---------- */
  function zoom(id, el) {
    if (!T || !id) return;
    const k = carte(id);
    let inst = null;
    if (el && el.dataset.u) inst = Combat.trouverSurPlateau(T.E, +el.dataset.u);
    if (inst && carte(inst.id).cat !== 'joueur') inst = null;
    SFX.jouer('carte');
    const z = document.createElement('div');
    z.className = 'ar-zoom';
    z.innerHTML = `<div class="ar-zoom-c">${htmlCarte(id)}</div><div class="ar-zoom-t"><b>${h(k.nom)}</b><p class="ar-ptype">${typeDe(k)}</p>${texteCarte(k, inst)}</div><button class="ar-bouton ar-zoom-x" aria-label="Fermer">✕</button>`;
    z.addEventListener('click', () => z.remove());
    T.el.appendChild(z);
  }

  function voirPile(j, quoi) {
    const P = T.E.j[j];
    const l = quoi === 'banc' ? P.banc : P.defausse;
    const z = document.createElement('div');
    z.className = 'ar-zoom pile';
    z.innerHTML = `<div class="ar-zoom-t"><b>${quoi === 'banc' ? 'Banc' : 'Défausse'} · ${l.length}</b>${quoi === 'banc' ? '<p class="muted small">Ces cartes reviennent dans ta main au début de ton tour.</p>' : ''}
      <div class="ar-liste large">${l.slice().reverse().map(c => `<span class="ar-lc">${htmlCarte(c.id)}</span>`).join('') || '<p class="muted">Vide.</p>'}</div></div>
      <button class="ar-bouton ar-zoom-x" aria-label="Fermer">✕</button>`;
    z.addEventListener('click', e => { if (!e.target.closest('.ar-lc') || e.target.closest('.ar-zoom-x')) z.remove(); });
    T.el.appendChild(z);
  }

  /* ---------- Le menu ---------- */
  function menu() {
    const fini = !!T.E.fin;
    ouvrirPanneau(`<p class="ar-dtitre">Combat</p>
      <div class="ar-pact col">
        <button class="btn ghost" data-ar="journal">Journal du combat</button>
        <button class="btn ghost${T.rapide ? ' on' : ''}" data-ar="vitesse">Animations rapides</button>
        <button class="btn ghost" data-ar="regles">Règles (Guides)</button>
        ${fini ? '<button class="btn" data-ar="quitter">Quitter</button>' : '<button class="btn danger" data-ar="abandon">Abandonner</button>'}
        <button class="btn ghost" data-ar="annuler">Reprendre</button></div>`, 'menu');
    qs('[data-ar="abandon"]')?.addEventListener('click', e => {
      e.stopPropagation();
      ouvrirPanneau(`<p class="ar-dtitre">Abandonner ?</p><p class="ar-consigne">Le combat compte comme une défaite.</p>
        <div class="ar-pact"><button class="btn danger" id="ar-ab">Abandonner</button><button class="btn ghost" data-ar="annuler">Continuer</button></div>`, 'menu');
      qs('#ar-ab').addEventListener('click', ev => { ev.stopPropagation(); abandonner(); });
    });
    qs('[data-ar="regles"]')?.addEventListener('click', e => {
      e.stopPropagation();
      fermerPanneau();
      if (typeof ouvrirGuidesSurcouche === 'function') ouvrirGuidesSurcouche();
    });
  }

  async function abandonner() {
    fermerPanneau();
    if (T.E.fin) return;
    const evs = Combat.agir(T.E, { t: 'abandon', qui: T.moi });
    if (T.o.surAction) T.o.surAction({ t: 'abandon', qui: T.moi }, T.E, true);
    sauver();
    await animer(evs);
    boucle();
  }

  function quitter() {
    const o = T.o;
    fermer();
    if (o.surQuitter) o.surQuitter();
  }

  function basculerJournal() {
    const j = qs('.ar-journal');
    j.hidden = !j.hidden;
    fermerPanneau();
    if (!j.hidden) j.querySelector('ol').innerHTML = T.journal.map(l => `<li class="${l.c || ''}">${l.t}</li>`).join('');
  }
  function noter(t, c) {
    if (!T) return;
    T.journal.push({ t, c });
    const j = qs('.ar-journal');
    if (!j.hidden) j.querySelector('ol').insertAdjacentHTML('beforeend', `<li class="${c || ''}">${t}</li>`);
  }

  /* ---------- Pile ou face ---------- */
  async function pileOuFace() {
    const E = T.E;
    const jeton = JETONS[(T.cosm[T.moi] || {}).jeton] || JETONS.j_base;
    const a = qs('.ar-annonce');
    a.className = 'ar-annonce pileface';
    a.innerHTML = `<div class="ar-jeton${E.premier === T.moi ? ' face' : ' pile'}"><img src="${jeton.img}" alt=""><i></i></div>
      <p>${E.premier === T.moi ? 'Tu commences' : `${h(nomCEO(E.premier))} commence`}</p>`;
    a.hidden = false;
    SFX.jouer('piece');
    await attendre(1700);
    a.hidden = true;
    noter(`${h(nomCEO(E.premier))} commence.`, 'sys');
  }

  /* ---------- Les animations ---------- */
  /* Chaque événement du moteur a son geste. La partie est déjà jouée quand
     on anime : on montre ce qui s'est passé, dans l'ordre, puis le plateau
     est redessiné à son état final. */
  async function animer(evs) {
    for (const e of evs) {
      if (!T) return;
      const f = ANIM[e.t];
      journaliser(e);
      if (f) await f(e);
    }
  }

  const rect = el => el && el.getBoundingClientRect();
  const elU = u => T.el.querySelector(`.ar-j[data-u="${u}"]`) || T.el.querySelector(`.ar-obj[data-u="${u}"]`);
  const elCEO = j => qs(j === T.moi ? '.ar-ceo.moi' : '.ar-ceo.lui');

  /* Une carte qui vole d'un endroit à un autre. */
  function vol(id, de, vers, o) {
    o = o || {};
    if (!de || !vers) return Promise.resolve();
    const f = document.createElement('div');
    f.className = 'ar-vol' + (o.dos ? ' dos' : '');
    f.innerHTML = o.dos != null && o.dos !== false ? dos(o.dos) : htmlCarte(id);
    const w = o.w || 92;
    f.style.width = w + 'px';
    document.body.appendChild(f);
    const cx = r => [r.left + r.width / 2 - w / 2, r.top + r.height / 2 - w * 0.7];
    const [x0, y0] = cx(de), [x1, y1] = cx(vers);
    const anim = f.animate([
      { transform: `translate(${x0}px,${y0}px) scale(${o.s0 || 0.8}) rotate(${o.r0 || 0}deg)`, opacity: o.o0 == null ? 1 : o.o0 },
      { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - (o.arc || 60)}px) scale(${o.sm || 1.15}) rotate(${(o.r0 || 0) / 2}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x1}px,${y1}px) scale(${o.s1 || 1}) rotate(0deg)`, opacity: o.o1 == null ? 1 : o.o1 }
    ], { duration: (o.ms || 520) * vitesse(), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    return anim.finished.then(() => f.remove(), () => f.remove());
  }

  function texteFlottant(x, txt, cls) {
    if (!x) return;
    const r = rect(x);
    const t = document.createElement('div');
    t.className = 'ar-flot ' + (cls || '');
    t.textContent = txt;
    t.style.left = (r.left + r.width / 2) + 'px';
    t.style.top = (r.top + r.height * 0.35) + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1400 * vitesse() + 200);
  }

  function secousse(force) {
    if (RM()) return;
    T.el.animate([
      { transform: 'translate(0,0)' }, { transform: `translate(${-force}px,${force / 2}px)` },
      { transform: `translate(${force}px,${-force / 2}px)` }, { transform: `translate(${-force / 2}px,0)` }, { transform: 'translate(0,0)' }
    ], { duration: 320, easing: 'ease-out' });
  }

  function eclats(x, couleurs, n) {
    if (!x || typeof FX === 'undefined') return;
    const r = rect(x);
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, { n: n || 26, colors: couleurs || ['#fff', '#ffd7f0', '#a95cf2'], speed: 6, size: 3, g: .1 });
  }

  function annonce(txt, genre, ms) {
    const a = qs('.ar-annonce');
    a.className = 'ar-annonce ' + (genre || '');
    a.innerHTML = `<p>${txt}</p>`;
    a.hidden = false;
    return attendre(ms || 900).then(() => { if (T) a.hidden = true; });
  }

  /* Montrer une carte au centre : un Instant joué, une Résilience. */
  async function montrer(id, legende, j) {
    const z = document.createElement('div');
    z.className = 'ar-montre' + (j === T.moi ? ' moi' : ' lui');
    z.innerHTML = `${htmlCarte(id)}<p>${legende}</p>`;
    T.el.appendChild(z);
    SFX.jouer('woosh');
    await attendre(1150);
    z.classList.add('part');
    await attendre(260);
    z.remove();
  }

  const ANIM = {
    async tour(e) {
      rendre();
      if (e.j === T.moi) { SFX.jouer('notif'); await annonce('À toi de jouer', 'tour moi', 850); }
      else await annonce(`Tour de ${h(nomCEO(e.j))}`, 'tour', 700);
    },
    async pioche(e) {
      if (e.j !== T.moi) { rendre(); return; }
      const de = qs('.ar-pile.club') || qs('.ar-piles');
      const vers = qs('.ar-main');
      SFX.jouer('carte');
      await vol(null, rect(de), rect(vers), { dos: T.moi, ms: 380, s1: 1 });
      rendre();
    },
    async essence(e) {
      rendre();
      const x = T.el.querySelector(`.ar-ess[data-e="${e.u}"]`);
      if (x) { x.classList.add('arrive'); SFX.jouer('piece'); }
      await attendre(220);
    },
    async deploie(e) {
      const place = qs(`.ar-camp.${e.j === T.moi ? 'moi' : 'lui'} .ar-place[data-ligne="${e.ligne}"]`);
      const de = e.j === T.moi ? (qs(`.ar-m[data-mu="${e.u}"]`) || qs('.ar-main')) : qs('.ar-ceo.lui .ar-mainadv') || qs('.ar-ceo.lui');
      const r0 = rect(de);
      SFX.jouer('carte');
      await vol(e.id, r0, rect(place), { ms: 480, s0: 0.9, s1: 0.95 });
      rendre();
      const x = elU(e.u);
      if (x) { x.classList.add('pose'); eclats(x, [(COLORS[carte(e.id).col] || COLORS.neutre).c, '#fff'], 18); }
      SFX.jouer('retourne');
      await attendre(260);
    },
    async entree(e) {
      const x = elU(e.u);
      if (x) { x.classList.add('brille'); setTimeout(() => x && x.classList.remove('brille'), 900); }
      texteFlottant(x || elCEO(e.j), e.ombre ? 'Effet d\'entrée (Ombre)' : 'Effet d\'entrée', 'info');
      await attendre(500);
    },
    async joue(e) {
      if (e.j === T.moi) rendreMain();
      await montrer(e.id, `${h(nomCEO(e.j))} joue ${h(carte(e.id).nom)}`, e.j);
      rendre();
    },
    async lie(e) {
      const vers = elU(e.cible);
      const de = e.j === T.moi ? (qs(`.ar-m[data-mu="${e.u}"]`) || qs('.ar-main')) : qs('.ar-ceo.lui');
      SFX.jouer('carte');
      await vol(e.id, rect(de), rect(vers), { ms: 420, s1: 0.5 });
      rendre();
      eclats(elU(e.cible), ['#ffc73b', '#fff'], 12);
    },
    async attaque(e) {
      rendre();
      const x = elU(e.u);
      if (x) x.classList.add('assaut');
      SFX.jouer('woosh');
      const cible = e.cible === 'ceo' ? `le CEO de ${h(nomCEO(adv(e.j)))}` : e.cible ? h(carte(Combat.trouverSurPlateau(T.E, e.cible)?.id || '').nom || 'un Joueur') : '';
      bulle(`${h(carte(trouverId(e.u)).nom)} · ${h(e.nom)}${cible ? ' → ' + cible : ''}`, true, 'attaque');
      await attendre(520);
    },
    async defend(e) {
      const x = elU(e.u);
      if (x) { x.classList.add('defend'); x.classList.add('eng'); }
      SFX.jouer('retourne');
      texteFlottant(x, 'Défend !', 'info');
      await attendre(450);
    },
    async impact(e) {
      const a = elU(e.u);
      const c = e.cible === 'ceo' ? elCEO(adv(ownerOf(e.u))) : elU(e.cible);
      if (a && c && !e.riposte) {
        const ra = rect(a), rc = rect(c);
        const dx = (rc.left + rc.width / 2) - (ra.left + ra.width / 2), dy = (rc.top + rc.height / 2) - (ra.top + ra.height / 2);
        await a.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1.12)`, offset: 0.55 }, { transform: 'translate(0,0)' }],
          { duration: 420 * vitesse(), easing: 'cubic-bezier(.5,0,.3,1)' }).finished.catch(() => {});
      }
      SFX.jouer('dechire');
      secousse(e.cible === 'ceo' ? 7 : 4);
      texteFlottant(c, String(e.val), 'degats');
      eclats(c, ['#fff', '#ff4d8d', '#ffc73b'], 22);
      await attendre(260);
    },
    async repousse(e) {
      const x = elU(e.u);
      texteFlottant(x, 'Repoussé', 'tient');
      SFX.jouer('piece');
      if (x) x.animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 400 });
      await attendre(450);
      cacherBulle();
    },
    async shield(e) {
      const x = elU(e.u);
      if (x) x.classList.add('bulle-shield');
      texteFlottant(x, 'Shield', 'tient');
      SFX.jouer('rare');
      await attendre(600);
      cacherBulle();
    },
    async vaincu(e) {
      const x = elU(e.u);
      cacherBulle();
      if (x) {
        x.classList.add('vaincu');
        eclats(x, ['#fff', '#ff4d8d', '#8936ff'], 34);
      }
      SFX.jouer('craque');
      texteFlottant(x, 'Vaincu', 'mort');
      await attendre(620);
      rendre();
    },
    async touche(e) {
      cacherBulle();
      const x = elCEO(e.j);
      x.classList.add('touche');
      setTimeout(() => x && x.classList.remove('touche'), 700);
      if (e.j === T.moi) T.el.classList.add('flash');
      setTimeout(() => T && T.el.classList.remove('flash'), 500);
      await attendre(260);
    },
    async pvRecup(e) {
      const de = elCEO(e.j).querySelector('.ar-pvs');
      const vers = e.j === T.moi ? qs('.ar-main') : qs('.ar-ceo.lui .ar-mainadv');
      await vol(e.id, rect(de), rect(vers), { dos: e.j === T.moi ? false : e.j, ms: 520, s0: 0.4 });
      rendre();
    },
    async pvDefausse(e) { texteFlottant(elCEO(e.j), 'PV détruit', 'mort'); rendre(); await attendre(400); },
    async resilience(e) {
      await montrer(e.id, `Résilience ! ${h(nomCEO(e.j))} joue ${h(carte(e.id).nom)}`, e.j);
      rendre();
    },
    async riposte(e) {
      await annonce(`Riposte : ${h(carte(e.id).nom)} · ${e.val}`, 'riposte', 800);
    },
    async legion(e) { texteFlottant(elCEO(e.j), 'Légion : il revient en main', 'info'); await attendre(400); },
    async sauve(e) { texteFlottant(elU(e.u), 'Invitation : sauvé', 'tient'); await attendre(450); },
    async banc(e) {
      const x = elU(e.u);
      if (x) x.classList.add('banc');
      texteFlottant(x || elCEO(e.j), 'Au Banc', 'info');
      await attendre(450);
      rendre();
    },
    async enMain(e) {
      const x = elU(e.u);
      if (x) x.classList.add('banc');
      texteFlottant(x || elCEO(e.j), 'Retour en main', 'info');
      await attendre(420);
      rendre();
    },
    async engage(e) { const x = elU(e.u); if (x) x.classList.add('eng'); },
    async desengage(e) { const x = elU(e.u); if (x) x.classList.remove('eng'); texteFlottant(x, 'Désengagé', 'info'); await attendre(250); },
    async revele(e) { if (e.j === T.moi || true) await montrerLot(e.cartes, `${h(nomCEO(e.j))} révèle`); },
    async regarde(e) { if (e.j === T.moi) await montrerLot(e.cartes, e.de != null ? `Tu regardes ${e.de === T.moi ? 'tes cartes' : 'les cartes de ' + h(nomCEO(e.de))}` : 'Tu regardes'); },
    async revelePV(e) { await montrerLot(e.cartes, `PV de ${h(nomCEO(e.j))}`); },
    async finCombatForce(e) { await annonce('Fin de la phase de Combat', 'tour', 800); },
    async fin(e) { await attendre(300); },
    async pileFace() {},
    async mulligan(e) { if (e.j !== T.moi) texteFlottant(elCEO(e.j), 'Change de main', 'info'); rendre(); },
    async clubVide(e) { await annonce(`Club vide : ${h(nomCEO(e.j))} pioche dans ses PV`, 'riposte', 900); },
    async echangePlaces() { rendre(); await attendre(300); },
    async defausse(e) { if (e.j === T.moi) rendreMain(); },
    async bonus(e) { texteFlottant(elU(e.u), '+' + e.val, 'plus'); await attendre(300); },
    async gagneMotCle(e) { texteFlottant(elU(e.u), e.kw, 'info'); await attendre(300); },
    async annule(e) { texteFlottant(elU(e.u), 'Attaque annulée', 'info'); cacherBulle(); await attendre(400); },
    async attaquePerdue() { cacherBulle(); },
    async essRendue() { rendre(); },
    async retourBanc() { rendre(); }
  };

  /* Retrouver l'id d'une instance, même partie du plateau. */
  function trouverId(u) {
    const c = Combat.trouverSurPlateau(T.E, u);
    if (c) return c.id;
    for (const P of T.E.j) for (const z of ['main', 'defausse', 'banc', 'club']) { const x = P[z].find(k => k.u === u); if (x) return x.id; }
    return null;
  }
  function ownerOf(u) {
    for (const j of [0, 1]) {
      const P = T.E.j[j];
      if (P.lignes.some(c => c && c.u === u)) return j;
      for (const z of ['main', 'defausse', 'banc', 'club', 'pv']) if (P[z].some(c => c.u === u)) return j;
    }
    return T.E.actif;
  }

  async function montrerLot(cartes, legende) {
    if (!cartes || !cartes.length) return;
    const z = document.createElement('div');
    z.className = 'ar-montre lot';
    z.innerHTML = `<div class="ar-lot">${cartes.map(c => htmlCarte(c.id)).join('')}</div><p>${legende}</p>`;
    T.el.appendChild(z);
    await attendre(1500 + cartes.length * 120);
    z.classList.add('part');
    await attendre(250);
    z.remove();
  }

  /* Le journal, en phrases. */
  function journaliser(e) {
    const n = j => `<b>${h(nomCEO(j))}</b>`;
    const k = id => `<i>${h(carte(id).nom || '')}</i>`;
    switch (e.t) {
      case 'tour': return noter(`— Tour ${e.n} : ${n(e.j)}`, 'sys');
      case 'deploie': return noter(`${n(e.j)} déploie ${k(e.id)}${e.eng ? ' (engagé)' : ''}.`);
      case 'joue': return noter(`${n(e.j)} joue ${k(e.id)}.`);
      case 'lie': return noter(`${n(e.j)} lie ${k(e.id)}.`);
      case 'attaque': return noter(`${k(trouverId(e.u))} attaque${e.cible === 'ceo' ? ' le CEO' : e.cible ? ' ' + k(trouverId(e.cible)) : ''} (${h(e.nom)}).`);
      case 'defend': return noter(`${k(trouverId(e.u))} défend.`);
      case 'repousse': return noter(`Repoussé : ${e.val} contre ${e.def}.`);
      case 'vaincu': return noter(`${k(e.id)} est vaincu.`, 'mal');
      case 'touche': return noter(`${n(e.j)} est touché.`, 'mal');
      case 'pvRecup': return noter(`${n(e.j)} récupère un PV.`);
      case 'resilience': return noter(`Résilience : ${k(e.id)}.`, 'bien');
      case 'riposte': return noter(`Riposte de ${k(e.id)} (${e.val}).`);
      case 'banc': return noter(`${k(e.id)} part au Banc.`);
      case 'enMain': return noter(`${k(e.id)} retourne en main.`);
      case 'shield': return noter('Shield : l\'attaque est ignorée.');
      case 'fin': return noter(e.gagnant === T.moi ? 'Victoire !' : 'Défaite.', 'sys');
    }
  }

  /* ---------- La fin ---------- */
  async function finDePartie() {
    if (!T || T.fini) return;
    T.fini = true;
    sauver();
    rendre();
    const E = T.E;
    const gagne = E.fin.gagnant === T.moi;
    const raisons = { pv: gagne ? 'Le CEO adverse n\'a plus de PV.' : 'Ton CEO n\'a plus de PV.', abandon: gagne ? `${h(nomCEO(adv(T.moi)))} abandonne.` : 'Tu as abandonné.', club: 'Club vide.' };
    if (gagne) { SFX.jouer('legend'); if (typeof FX !== 'undefined') FX.confetti({ colors: ['#ee0073', '#a95cf2', '#ffc73b', '#fff'] }); }
    else SFX.jouer('erreur');
    let extra = '';
    if (T.o.surFin) {
      try { extra = (await T.o.surFin(E, gagne)) || ''; } catch (err) { extra = `<p class="ar-consigne">${h(err.message || 'Le serveur n\'a pas répondu.')}</p>`; }
    }
    if (!T) return;
    const a = qs('.ar-annonce');
    a.className = 'ar-annonce fin ' + (gagne ? 'victoire' : 'defaite');
    a.innerHTML = `<h2>${gagne ? 'Victoire' : 'Défaite'}</h2><p>${raisons[E.fin.raison] || ''}</p>
      <p class="ar-stats-fin">${E.tour} tours · ${E.j[T.moi].pv.length} PV restants</p>
      ${extra}
      <div class="ar-pact"><button class="btn" data-ar="quitter">Continuer</button></div>`;
    a.hidden = false;
  }

  return { ouvrir, fermer, ouverte, actionDistante, rendre, htmlCarte, coutHTML, texteCarte, jouer, get etat() { return T; } };
})();

/* ---------- Les cosmétiques du combat ---------- */
/* Les identifiants sont ceux des articles de boutique (public.shop_items).
   `img` absent : le tapis de base, dessiné par la page (css/combat.css). */
const TAPIS = {
  t_base:      { nom: 'Nuit M8', img: null, prix: 0 },
  t_chateau:   { nom: 'Le Château', img: 'assets/combat/tapis/t_chateau.webp', prix: 4000 },
  t_reverie:   { nom: 'Rêverie', img: 'assets/combat/tapis/t_reverie.webp', prix: 4000 },
  t_chevalier: { nom: 'Le Chevalier', img: 'assets/combat/tapis/t_chevalier.webp', prix: 5000 },
  t_veste:     { nom: 'Veste Rose', img: 'assets/combat/tapis/t_veste.webp', prix: 4000 },
  t_pilote:    { nom: 'Petit Pilote', img: 'assets/combat/tapis/t_pilote.webp', prix: 4000 },
  t_peche:     { nom: 'Grosse Prise', img: 'assets/combat/tapis/t_peche.webp', prix: 4000 },
  /* L'événement « Le Choc des Sections » : ni en vente, ni en Éclats.
     `ev` : où on le gagne ; `vue` : le sous-onglet qui y mène (js/choc.js). */
  t_arene:     { nom: 'L\'Arène', img: 'assets/combat/tapis/t_arene.webp', prix: 0, ev: 'Pass du Choc', vue: 'pass' },
  t_theatre:   { nom: 'Le Théâtre', img: 'assets/combat/tapis/t_theatre.webp', prix: 0, ev: 'Boutique du Choc', vue: 'boutique' }
};
const SLEEVES = {
  s_base:    { nom: 'Classique', img: 'assets/card-back.webp', prix: 0 },
  s_sorcier: { nom: 'Le Sorcier', img: 'assets/combat/sleeves/s_sorcier.webp', prix: 3000 },
  s_argent:  { nom: 'Argent', img: 'assets/combat/sleeves/s_argent.webp', prix: 2500 },
  s_choc:    { nom: 'Le Choc', img: 'assets/combat/sleeves/s_choc.webp', prix: 0, ev: 'Pass du Choc', vue: 'pass' }
};
const JETONS = {
  j_base: { nom: 'Jeton M8', img: 'assets/jeton-echange.webp', prix: 0 }
};
