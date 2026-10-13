/* L'arène (version 3.0) : la table de combat, en plein écran.

   Elle ne connaît pas les règles : elle montre l'état du moteur
   (js/combat/moteur.js), rend touchables les actions qu'il permet, et joue
   en animation les événements qu'il renvoie. L'adversaire est l'IA
   (js/combat/ia.js) ou un ami (js/combat/defis.js), qui choisit parmi les
   mêmes actions.

   La page, de haut en bas : la barre de l'adversaire (son CEO, ses PV, sa
   main), le plateau — son camp, une bande au milieu qui dit où en est la
   partie, son camp à soi —, sa propre barre (son CEO, la fin du tour), et
   sa main. Chaque camp a ses trois lignes et, au bord, ses Essences.

   Un seul geste pour tout : toucher une carte la montre en grand, en haut,
   par-dessus le camp adverse ; son propre camp reste visible dessous. C'est
   là qu'on choisit : une ligne libre pour un Joueur, un de ses Joueurs pour
   un Objet, « Jouer » pour un Instant, une attaque pour un Joueur en jeu.
   Une attaque choisie, la carte retourne à sa place et les cibles
   s'allument. On peut aussi faire glisser une carte de la main vers sa
   place. Le tapis affiché est celui du CEO dont c'est le tour. */
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
  const cote = j => (j === T.moi ? 'moi' : 'lui');

  /* Une url() posée dans une variable CSS se lit depuis la feuille de style
     (css/), pas depuis la page : on la donne en absolu. */
  const abs = p => new URL(p, document.baseURI).href;
  /* Le dos des cartes : la sleeve choisie (Decks › Personnaliser). */
  const sleeveDe = j => (SLEEVES[(T.cosm[j] || {}).sleeve] || SLEEVES.s_base).img;
  const tapisDe = j => TAPIS[(T.cosm[j] || {}).tapis] || TAPIS.t_base;

  /* Les quatre sortes de cartes, chacune sa couleur et son signe. */
  const TYPES = {
    joueur: { nom: 'Joueur', ico: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>' },
    objet:  { nom: 'Objet',  ico: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 1 0 5.7l-3 3A4 4 0 0 1 5.3 13l1.5-1.5"/></svg>' },
    coach:  { nom: 'Coach',  ico: '<svg viewBox="0 0 24 24"><path d="M4 18h16M6 18l1.5-9 4.5 4 4.5-4L18 18"/><circle cx="12" cy="6" r="1.6"/></svg>' },
    moment: { nom: 'Moment', ico: '<svg viewBox="0 0 24 24"><path d="M13 3 5 14h6l-1 7 8-11h-6Z"/></svg>' }
  };
  const typeDe = k => TYPES[k.cat] || { nom: '', ico: '' };
  const coulDe = k => (COLORS[k.col] || COLORS.neutre);

  /* ---------- Une carte ---------- */
  /* Une carte : son illustration, et ses reflets (Reverse, Légendaire,
     Secrète). Pas de signe de sa sorte dans le coin : l'illustration dit
     déjà ce qu'elle est. */
  function htmlCarte(id) {
    const c = carte(id);
    const img = c.img
      ? `<img src="${c.img}" alt="" draggable="false" decoding="async">`
      : `<div class="ar-texte r-${c.rar}" style="--tc:${tcol(c)}"><b>${h(c.nom)}</b><small>${h(c.provisoire ? 'Promo provisoire' : (RAR[c.rar] || {}).nom || '')}</small>${c.def != null ? `<em>Déf ${c.def}</em>` : ''}${(c.atks || []).map(a => `<span>${coutHTML(a.cout)} ${h(a.nom)} <i>${a.degats == null ? '' : a.degats}</i></span>`).join('')}</div>`;
    return `<div class="ar-c${c.rev ? ' rev' : ''}${c.rar === 'L' ? ' holo' : ''}${c.rar === 'S' ? ' secrete' : ''}" data-id="${id}">${img}${c.rev ? '<i class="ar-rev"></i>' : ''}</div>`;
  }
  const dos = j => `<div class="ar-c dos"><img src="${sleeveDe(j)}" alt="" draggable="false"></div>`;

  function coutHTML(cout) {
    const l = [];
    for (const k in cout) {
      if (k === 'neutre') continue;
      for (let i = 0; i < cout[k]; i++) l.push(essIcon(k, 'ar-cout'));
    }
    for (let i = 0; i < (cout.neutre || 0); i++) l.push(essIcon('neutre', 'ar-cout'));
    return `<span class="ar-couts">${l.join('') || '<small>gratuit</small>'}</span>`;
  }

  /* ---------- Ouvrir, fermer ---------- */
  /* `o` : {
       init (la partie à créer) ou E (une partie déjà en cours),
       moi: 0 | 1, ia: { niveau } (absent : adversaire humain),
       joueurs: [{ nom, avatar, frame, photo }, …],
       cosm: [{ tapis, sleeve }, …], brillantes: [[couleurs], …],
       titre, sousTitre, boss (le CEO adverse est un boss),
       surFin(E, gagne) → html, surAction(a, E, deMoi) (PvP), surQuitter,
       sauver (clé de reprise), meta,
       minuteur (secondes par tour : un défi entre amis) } */
  function ouvrir(o) {
    fermer(true);
    const E = o.E || Combat.creer(o.init);
    const reprise = !!o.E;
    T = {
      E, o, moi: o.moi || 0, cosm: o.cosm || [{}, {}], brillantes: o.brillantes || [[], []],
      focus: null, cible: null, rapide: false, occupe: false, fini: false, journal: [], histo: [], tapis: null
    };
    try { T.rapide = JSON.parse(localStorage.getItem('mtcg.jeu') || '{}').rapide || false; } catch (e) { /* */ }
    let el = document.getElementById('arene');
    if (!el) {
      el = document.createElement('div');
      el.id = 'arene';
      document.body.appendChild(el);
    }
    T.el = el;
    el.hidden = false;
    el.className = o.boss ? 'boss' : '';
    document.body.classList.add('en-arene');
    el.innerHTML = squelette();
    brancher();
    rendre();
    if (o.minuteur) lancerChrono();
    SFX.jouer('ouvre');
    (async () => {
      if (!reprise) await pileOuFace();
      boucle();
    })();
    return T;
  }

  function fermer(silence) {
    if (!T) return;
    T.ferme = true;
    clearInterval(T.chronoTic);
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
    const zone = j => `<div class="ar-zone ${cote(j)}"><div class="ar-ess-zone"></div><div class="ar-piles"></div></div>`;
    return `<div class="ar-fond"></div>
    <header class="ar-barre lui">
      <button class="ar-bouton" data-ar="menu" aria-label="Menu du combat">${NAVICO.menu}</button>
      <div class="ar-ceo lui" data-cible="ceo"></div>
      <span class="ar-chrono lui" hidden></span>
      <div class="ar-mainadv"></div>
    </header>
    <div class="ar-scene">
      <div class="ar-plateau">
        <div class="ar-tapis"></div>
        <div class="ar-camp lui">${zone(adv(T.moi))}<div class="ar-lignes"></div></div>
        <div class="ar-milieu"><span class="ar-tourn"></span><span class="ar-info"></span><button class="ar-histo" data-ar="histo" aria-label="Cartes jouées" hidden></button><button class="ar-annuler" data-ar="annuler" hidden>Annuler</button></div>
        <div class="ar-camp moi"><div class="ar-lignes"></div>${zone(T.moi)}</div>
      </div>
    </div>
    <footer class="ar-barre moi">
      <div class="ar-ceo moi"></div>
      <span class="ar-chrono moi" hidden></span>
      <button class="ar-fin" data-ar="fin">Fin du tour</button>
    </footer>
    <div class="ar-main"></div>
    <div class="ar-focus" hidden></div>
    <div class="ar-sheet" hidden></div>
    <div class="ar-annonce" hidden></div>
    <aside class="ar-journal" hidden><header><b>Journal du combat</b><button class="ar-bouton" data-ar="journal" aria-label="Fermer">✕</button></header><ol></ol></aside>`;
  }

  /* ---------- Le rendu ---------- */
  /* Pendant une animation, le moteur est déjà à l'état final : redessiner le
     plateau à ce moment (une carte qu'on ouvre, le menu qu'on referme)
     sautait à la fin et coupait l'animation en cours. Seuls les gestes de
     l'animation redessinent (`force`) ; le reste attend sa fin. */
  function rendre(force) {
    if (!T) return;
    if (T.anim && !force) { T.aRendre = true; return; }
    const E = T.E, m = T.moi, l = adv(m);
    const d = Combat.demande(E);
    const monTour = E.actif === m && !E.fin;
    T.el.classList.toggle('mon-tour', monTour);
    T.el.classList.toggle('phase-combat', E.phase === 'combat');

    poserTapis(E.fin ? m : E.actif);
    majCEO(l);
    majCEO(m);
    const Pl = E.j[l];
    qs('.ar-mainadv').setAttribute('aria-label', `${Pl.main.length} carte${Pl.main.length > 1 ? 's' : ''} en main`);
    qs('.ar-mainadv').innerHTML = `<span class="ar-dos-pile" style="--dos:url('${abs(sleeveDe(l))}')">${Array.from({ length: Math.min(Pl.main.length, 5) }, () => '<i></i>').join('')}</span><b>${Pl.main.length}</b><small>en main</small>`;

    rendreCamp(l);
    rendreCamp(m);
    rendreMain();
    rendreMilieu(d, monTour);

    const fin = qs('.ar-fin');
    const peutFinir = monTour && d && d.type === 'tour' && Combat.optionsTour(E).some(a => a.t === 'finTour');
    fin.disabled = !peutFinir || T.occupe || !!T.cible;
    fin.classList.toggle('pulse', peutFinir && !T.occupe && !actionsUtiles());
    fin.textContent = d && d.type === 'tour' && monTour && !peutFinir && E.cpt.doitAttaquer ? 'Attaque obligée' : monTour ? 'Fin du tour' : 'Tour adverse';

    surligner();
  }

  /* Le tapis du CEO dont c'est le tour, en fondu quand il change. */
  function poserTapis(j) {
    const t = tapisDe(j);
    const cle = t.img || 'base';
    if (T.tapis === cle) return;
    const p = qs('.ar-tapis');
    const neuf = document.createElement('i');
    neuf.className = 'ar-tapis-c' + (t.img ? '' : ' base');
    if (t.img) neuf.style.backgroundImage = `url('${abs(t.img)}')`;
    p.appendChild(neuf);
    const anciens = [...p.children].slice(0, -1);
    requestAnimationFrame(() => neuf.classList.add('on'));
    setTimeout(() => anciens.forEach(x => x.remove()), 700);
    const f = qs('.ar-fond');
    f.classList.toggle('base', !t.img);
    f.style.backgroundImage = t.img ? `url('${abs(t.img)}')` : '';
    T.tapis = cle;
  }

  /* Reste-t-il quelque chose d'utile à faire ? (« Fin du tour » se met à
     battre quand non.) */
  function actionsUtiles() {
    const d = Combat.demande(T.E);
    if (!d || d.type !== 'tour' || d.qui !== T.moi) return false;
    return Combat.optionsTour(T.E).some(a => a.t !== 'finTour');
  }

  /* Un CEO n'est redessiné que s'il a changé (ses PV, son tour) : sinon
     son avatar clignoterait à chaque geste. */
  function majCEO(j) {
    const el = qs(`.ar-ceo.${cote(j)}`);
    const cle = `${T.E.j[j].pv.length}|${T.E.actif === j && !T.E.fin}`;
    if (el.dataset.k === cle) return;
    el.dataset.k = cle;
    el.innerHTML = htmlCEO(j);
  }

  /* Un CEO : son avatar, son nom, ses PV — des cartes face cachée, comme
     sur la table. */
  function htmlCEO(j) {
    const P = T.E.j[j], inf = (T.o.joueurs || [])[j] || {};
    const pv = P.pv.length;
    const actif = T.E.actif === j && !T.E.fin;
    /* Avant la mise en place (main de départ), les PV ne sont pas encore posés. */
    const pose = T.E.tour > 0 || pv > 0;
    const backs = Array.from({ length: pv }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    return `<span class="ar-ava${actif ? ' actif' : ''}">${avatarHTML(inf.avatar || 'star', inf.frame || 'default', 'md', inf.photo || null, inf.xp)}</span>
      <span class="ar-qui"><b>${h(P.nom)}</b>
        ${pose ? `<span class="ar-pvs${pv <= 1 ? ' bas' : ''}" aria-label="${pv} PV" style="--dos:url('${abs(sleeveDe(j))}')"><span class="ar-pvdos">${backs}</span><em>${pv}</em><small>PV</small></span>` : ''}</span>`;
  }

  function rendreCamp(j) {
    const E = T.E, P = E.j[j];
    const el = qs(`.ar-camp.${cote(j)}`);
    const lignes = el.querySelector('.ar-lignes');
    if (lignes.children.length !== Combat.REGLE.LIGNES) {
      lignes.innerHTML = P.lignes.map((_, i) => `<div class="ar-place" data-ligne="${i}" data-j="${j}"></div>`).join('');
    }
    P.lignes.forEach((c, i) => {
      const place = lignes.children[i];
      const actuel = place.querySelector('.ar-j');
      if (!c) { if (actuel) actuel.remove(); return; }
      let x = actuel && +actuel.dataset.u === c.u ? actuel : null;
      if (!x) {
        if (actuel) actuel.remove();
        x = document.createElement('div');
        x.className = 'ar-j';
        x.dataset.u = c.u;
        x.innerHTML = `${htmlCarte(c.id)}<span class="ar-objs"></span><span class="ar-def"></span><span class="ar-marques"></span>`;
        place.appendChild(x);
      }
      majJoueur(x, c);
    });
    rendreEssences(j, el.querySelector('.ar-ess-zone'));
    rendrePiles(j, el.querySelector('.ar-piles'));
  }

  /* Les Essences en jeu : une gemme chacune, qui brille de sa couleur quand
     elle est libre et s'éteint quand elle est engagée. Rien d'autre : le
     nombre se lit sur les gemmes. */
  function rendreEssences(j, el) {
    const P = T.E.j[j];
    const cle = P.ess.map(e => `${e.u}${e.eng ? 'e' : ''}`).join(',');
    if (el.dataset.k === cle) return;
    el.dataset.k = cle;
    const dispo = P.ess.filter(e => !e.eng).length;
    el.setAttribute('aria-label', `Essences : ${dispo} libre${dispo > 1 ? 's' : ''} sur ${P.ess.length}`);
    el.innerHTML = P.ess.map(e => {
      const c = COLORS[e.coul] || COLORS.neutre;
      const brille = (T.brillantes[j] || []).includes(e.coul);
      return `<i class="ar-gem${e.eng ? ' eng' : ''}${brille ? ' brille' : ''}" data-e="${e.u}" style="--ec:${c.c}" title="Essence ${c.nom}${e.eng ? ' (engagée)' : ''}">${essIcon(e.coul)}</i>`;
    }).join('');
    el.style.setProperty('--n', P.ess.length);
  }

  /* Les piles : la Réserve d'Essences, le Banc s'il y a lieu, la Défausse,
     le Club. Les toucher dit ce qu'elles sont (et montre leurs cartes quand
     on peut les voir). */
  function rendrePiles(j, el) {
    const P = T.E.j[j];
    const pile = (k, n, ico, lab, cls) => `<button class="ar-pile ${cls || ''}" data-ar="${k}" data-j="${j}" aria-label="${lab} : ${n}" title="${lab}">${ico}<b>${n}</b></button>`;
    el.innerHTML = pile('reserve', P.reserve.length, ICO_PILE.reserve, 'Réserve d\'Essences', 'p-ess')
      + (P.banc.length ? pile('banc', P.banc.length, ICO_PILE.banc, 'Banc') : '')
      + pile('defausse', P.defausse.length, ICO_PILE.defausse, 'Défausse')
      + `<button class="ar-pile club" data-ar="club" data-j="${j}" style="--dos:url('${abs(sleeveDe(j))}')" aria-label="Club : ${P.club.length} cartes" title="Club"><i class="ar-dos1"></i><b>${P.club.length}</b></button>`;
  }
  const ICO_PILE = {
    reserve: '<svg viewBox="0 0 24 24"><path d="M12 3 19.5 7.5v9L12 21l-7.5-4.5v-9Z"/><path d="M12 8.2 15.3 10v4L12 15.8 8.7 14v-4Z"/></svg>',
    defausse: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1.2 13H6.2Z"/><path d="M9 7V4h6v3M3 7h18"/></svg>',
    banc: '<svg viewBox="0 0 24 24"><path d="M4 12h16M6 12v6M18 12v6M5 8h14"/></svg>'
  };

  function majJoueur(x, c) {
    const E = T.E;
    const k = carte(c.id);
    x.classList.toggle('eng', !!c.eng);
    x.classList.toggle('shield', Combat.shieldActif(E, c));
    const def = Combat.defense(E, c);
    const bonus = def - (k.def || 0);
    x.querySelector('.ar-def').className = 'ar-def' + (bonus > 0 ? ' plus' : bonus < 0 ? ' moins' : '');
    x.querySelector('.ar-def').innerHTML = `${MARQUES.Garde}<b>${def}</b>`;
    x.querySelector('.ar-def').setAttribute('aria-label', `Défense ${def}`);
    const ids = c.obj.map(o => o.u).join(',');
    const objs = x.querySelector('.ar-objs');
    if (objs.dataset.k !== ids) {
      objs.dataset.k = ids;
      objs.innerHTML = c.obj.map(o => `<i class="ar-obj" data-u="${o.u}" data-id="${o.id}" style="background-image:url('${abs(carte(o.id).img || '')}')"></i>`).join('');
    }
    const mk = [];
    for (const m of ['Provocation', 'Garde', 'Riposte', 'Légion']) if (Combat.aMotCle(E, c, m)) mk.push(`<i class="ar-mk mk-${O_.sansAccent(m)}" title="${m}">${MARQUES[m]}</i>`);
    if (Combat.shieldActif(E, c)) mk.push(`<i class="ar-mk mk-shield" title="Shield">${MARQUES.Shield}</i>`);
    if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) mk.push('<i class="ar-mk mk-bloque" title="Ne peut pas attaquer ce tour">⊘</i>');
    /* Un effet du tour (Défense, attaques) : une flèche, vers le haut ou le bas. */
    const tmp = E.temp.filter(t => (t.type === 'def' || t.type === 'atk') && (t.cible != null ? t.cible === c.u : t.camp === c.j));
    if (tmp.length) {
      const haut = tmp.reduce((a, t) => a + Math.sign(t.val), 0) >= 0;
      mk.push(`<i class="ar-mk mk-${haut ? 'buff' : 'debuff'}" title="Un effet du tour : touche la carte pour le lire">${haut ? '▲' : '▼'}</i>`);
    }
    x.querySelector('.ar-marques').innerHTML = mk.join('');
  }
  const O_ = Combat.O;
  const MARQUES = {
    Provocation: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z"/><path d="M12 8v5M12 16v.5"/></svg>',
    Garde: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7Z"/></svg>',
    Shield: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M7 12h10" opacity=".6"/></svg>',
    Riposte: '<svg viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5"/><path d="M5 7v10"/></svg>',
    Légion: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/></svg>'
  };

  /* La main : les cartes déjà tenues restent (leur image ne se recharge
     pas), les nouvelles s'ajoutent, et chacune glisse à sa place. */
  function rendreMain() {
    const el = qs('.ar-main');
    const P = T.E.j[T.moi];
    const cle = P.main.map(c => c.u).join(',');
    if (el.dataset.k !== cle) {
      el.dataset.k = cle;
      const avant = new Map([...el.children].map(b => [+b.dataset.mu, b]));
      P.main.forEach((c, i) => {
        let b = avant.get(c.u);
        if (!b) {
          b = document.createElement('button');
          b.className = 'ar-m';
          b.dataset.mu = c.u;
          b.setAttribute('aria-label', carte(c.id).nom || '');
          b.innerHTML = htmlCarte(c.id);
        }
        avant.delete(c.u);
        b.style.setProperty('--i', i);
        el.appendChild(b);
      });
      avant.forEach(b => b.remove());
    }
    el.style.setProperty('--n', P.main.length);
  }

  /* La bande du milieu : à qui c'est, quelle phase, et la consigne du
     moment. */
  function rendreMilieu(d, monTour) {
    const E = T.E;
    const tourn = qs('.ar-tourn');
    const info = qs('.ar-info');
    rendreHisto();
    if (E.fin) { tourn.textContent = ''; info.textContent = ''; return; }
    tourn.innerHTML = `<b>${E.tour || 1}</b><small>tour</small>`;
    if (T.consigne) { info.className = 'ar-info consigne'; info.textContent = T.consigne; return; }
    if (T.ticker) { info.className = 'ar-info ticker'; info.innerHTML = T.ticker; return; }
    info.className = 'ar-info' + (monTour ? ' moi' : '');
    if (!monTour) info.textContent = d && d.qui === T.moi ? 'À toi de répondre' : `Au tour de ${nomCEO(E.actif)}`;
    else if (Combat.premierTourDuPremier(E, T.moi)) info.textContent = 'Premier tour · pas d\'attaque';
    else if (E.cpt.doitAttaquer > 0) info.textContent = 'Encore une attaque obligatoire';
    /* Les deux phases du tour, celle en cours allumée : on voit d'un coup
       d'œil qu'attaquer ferme la phase de jeu. */
    else {
      info.className = 'ar-info moi phases';
      info.innerHTML = `<span class="ar-ph${E.phase === 'combat' ? '' : ' on'}">Jeu</span><i class="ar-ph-fl">›</i><span class="ar-ph${E.phase === 'combat' ? ' on' : ''}">Combat</span>`;
    }
  }
  function consigne(txt, annulable) {
    if (!T) return;
    T.consigne = txt || null;
    qs('.ar-annuler').hidden = !annulable;
    rendreMilieu(Combat.demande(T.E), T.E.actif === T.moi);
  }

  /* ---------- Le temps de jeu (défis entre amis) ---------- */
  /* Soixante secondes par tour, vingt pour une décision prise pendant le
     tour de l'autre (défendre, une Résilience…). Le temps des animations ne
     compte pas. Écoulé, le jeu joue pour soi : il finit le tour, ou fait le
     choix le plus simple. Chacun le voit pour les deux : un adversaire qui
     traîne le voit filer, et s'il ne joue plus du tout (son appli fermée),
     on le dit. */
  const CHRONO_DECISION = 20;
  function lancerChrono() {
    let avant = Date.now();
    T.chronoTic = setInterval(() => {
      if (!T || T.ferme) return;
      const t = Date.now(), dt = t - avant;
      avant = t;
      majChrono(dt);
    }, 250);
  }
  function majChrono(dt) {
    const E = T.E, d = Combat.demande(E);
    const el = { moi: qs('.ar-chrono.moi'), lui: qs('.ar-chrono.lui') };
    if (!d || E.fin) {
      el.moi.hidden = el.lui.hidden = true;
      T.chrono = null;
      return;
    }
    const cle = d.type === 'tour' ? `t${E.tour}|${d.qui}` : `d${E.journal.length}|${d.qui}`;
    if (!T.chrono || T.chrono.cle !== cle) {
      /* Une décision au milieu de son propre tour (cibler, choisir une carte)
         prend sur le temps du tour. */
      const memeTour = T.chrono && T.chrono.tour === E.tour && T.chrono.qui === d.qui && E.actif === d.qui;
      const total = (d.type === 'tour' || memeTour ? T.o.minuteur : CHRONO_DECISION) * 1000;
      T.chrono = { cle, qui: d.qui, tour: E.tour, total, reste: memeTour ? T.chrono.reste : total };
    }
    const c = T.chrono;
    if (!T.occupe) c.reste -= dt;
    const s = Math.max(0, Math.ceil(c.reste / 1000));
    const lui = c.qui !== T.moi;
    const z = el[lui ? 'lui' : 'moi'], autre = el[lui ? 'moi' : 'lui'];
    autre.hidden = true;
    z.hidden = false;
    const absent = lui && c.reste < -20000;
    z.className = 'ar-chrono ' + (lui ? 'lui' : 'moi') + (s <= 10 ? ' presse' : '') + (absent ? ' absent' : '');
    z.style.setProperty('--p', Math.max(0, c.reste / c.total));
    z.innerHTML = absent ? '<b>Ne répond plus</b>' : `<b class="tnum">${s}</b>`;
    z.setAttribute('aria-label', absent ? 'Ton adversaire ne répond plus' : `${s} secondes`);
    if (!lui && c.reste <= 0 && !T.occupe && !T.chronoJoue) tempsEcoule(d);
  }
  async function tempsEcoule(d) {
    T.chronoJoue = true;
    try {
      const a = d.type === 'tour'
        ? Combat.optionsTour(T.E).find(x => x.t === 'finTour') || IA.choisir(T.E, { niveau: 1 })
        : IA.choisir(T.E, { niveau: 1 });
      toast(d.type === 'tour' ? 'Temps écoulé : fin du tour.' : 'Temps écoulé : choix automatique.');
      T.cible = null;
      consigne(null);
      fermerFocus();
      fermerSheet();
      await jouer(a);
    } finally {
      if (T) T.chronoJoue = false;
    }
  }

  /* ---------- Les cartes jouées ---------- */
  /* Chaque Moment, Coach, Objet, Joueur déployé et Résilience reste
     consultable : les trois derniers, en petit, au bout de la bande du
     milieu (un liseré rouge pour ceux de l'adversaire) ; les toucher ouvre
     la liste de la partie, et chaque carte de la liste s'ouvre en grand. */
  function historiser(e) {
    const quoi = { joue: 1, lie: 1, deploie: !e.pose, resilience: 1 }[e.t];
    if (!quoi) return;
    T.histo.push({ id: e.id, j: e.j, t: e.t, tour: T.E.tour, cible: e.t === 'lie' ? trouverId(e.cible) : null });
  }
  function rendreHisto() {
    const b = qs('.ar-histo');
    const l = T.histo.slice(-3);
    const cle = T.histo.length + '|' + !!T.consigne;
    if (b.dataset.k === cle) return;
    b.dataset.k = cle;
    /* « Annuler » prend la même place pendant qu'on vise. */
    b.hidden = !l.length || !!T.consigne;
    b.innerHTML = l.map(x => `<i class="ar-hi ${cote(x.j)}" style="background-image:url('${abs(carte(x.id).img || '')}')"></i>`).join('');
  }
  function voirHisto() {
    const verbe = { joue: ['joues', 'joue'], lie: ['lies', 'lie'], deploie: ['déploies', 'déploie'], resilience: ['joues en Résilience', 'joue en Résilience'] };
    let tour = null;
    const lignes = T.histo.slice().reverse().map((x, i) => {
      const n = T.histo.length - 1 - i;
      const k = carte(x.id);
      const sep = x.tour !== tour ? `<li class="ar-hl-tour">Tour ${x.tour}</li>` : '';
      tour = x.tour;
      const qui = x.j === T.moi ? `Tu ${verbe[x.t][0]}` : `${h(nomCEO(x.j))} ${verbe[x.t][1]}`;
      return `${sep}<li><button class="ar-hl ${cote(x.j)}" data-ar="histo-carte" data-n="${n}">${htmlCarte(x.id)}<span><small>${qui}${x.cible ? ` · sur ${h(carte(x.cible).nom || '')}` : ''}</small><b>${h(k.nom || '')}</b>${(k.fx || []).length ? `<em>${h(k.fx.join(' '))}</em>` : ''}</span></button></li>`;
    }).join('');
    ouvrirSheet(`<p class="ar-s-titre">Cartes jouées</p>
      <ol class="ar-hliste">${lignes}</ol>
      <div class="ar-s-act"><button class="ar-b ghost" data-ar="annuler">Fermer</button></div>`, 'pile histo');
  }
  function ticker(html) {
    if (!T) return;
    T.ticker = html || null;
    rendreMilieu(Combat.demande(T.E), T.E.actif === T.moi);
  }

  /* ---------- Ce qu'on peut toucher ---------- */
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
      if (T.focus && T.focus.main) marquerPlacesCarte(T.focus.u);
      if (T.cible) marquerCibles();
    } else if (d.type === 'choix' && d.options.some(o => o.u)) {
      for (const o of d.options) if (o.u) {
        const x = T.el.querySelector(`.ar-j[data-u="${o.u}"],.ar-obj[data-u="${o.u}"],.ar-m[data-mu="${o.u}"],.ar-gem[data-e="${o.u}"]`);
        if (x) x.classList.add('option');
      }
    }
  }

  /* Une carte de la main en grand : les places où elle peut aller. */
  function marquerPlacesCarte(u) {
    const opts = Combat.optionsTour(T.E).filter(a => a.u === u);
    qsa('.ar-m').forEach(b => b.classList.toggle('choisi', +b.dataset.mu === u));
    for (const a of opts) {
      if (a.t === 'deployer') { const p = qs(`.ar-camp.moi .ar-place[data-ligne="${a.ligne}"]`); if (p) p.classList.add('cible'); }
      if (a.t === 'lier') { const x = qs(`.ar-camp.moi .ar-j[data-u="${a.cible}"]`); if (x) x.classList.add('cible'); }
    }
  }
  function marquerCibles() {
    for (const o of T.cible.opts) {
      if (o.cible === 'ceo') qs('.ar-ceo.lui').classList.add('cible');
      else { const x = qs(`.ar-j[data-u="${o.cible}"]`); if (x) x.classList.add('cible'); }
    }
    const a = qs(`.ar-j[data-u="${T.cible.u}"]`);
    if (a) a.classList.add('choisi');
  }

  /* ---------- Les gestes ---------- */
  function brancher() {
    const el = T.el;
    el.addEventListener('click', clic);
    el.addEventListener('contextmenu', e => e.preventDefault());
    /* Glisser une carte jouable de la main vers sa place. */
    let appui = null;
    el.addEventListener('pointerdown', e => {
      const m = e.target.closest('.ar-m');
      if (!m) return;
      appui = { x: e.clientX, y: e.clientY, el: m, drag: null };
    });
    el.addEventListener('pointermove', e => {
      if (!appui) return;
      if (!appui.drag && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 14) {
        if (appui.el.classList.contains('jouable') && !T.occupe) commencerGlisser(appui, e);
        else { appui = null; return; }
      }
      if (appui.drag) glisser(appui, e);
    });
    const fin = e => {
      if (!appui) return;
      if (appui.drag) { e.preventDefault(); lacher(appui, e); T.bloqueClic = true; }
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
    /* Le fond de la carte en grand : on la referme. */
    if (e.target.closest('.ar-focus')) {
      if (!e.target.closest('.ar-f-carte,.ar-f-panneau')) fermerFocus();
      return;
    }
    /* Pendant une animation, on peut toujours lire une carte : le combat
       continue dessous. Le médaillon d'un Objet ouvre l'Objet, pas son Joueur. */
    if (T.occupe) {
      const ob = e.target.closest('.ar-obj');
      if (ob) return ouvrirFocus({ id: ob.dataset.id });
      const jo = e.target.closest('.ar-j');
      if (jo) return ouvrirFocus({ u: +jo.dataset.u });
      const mo = e.target.closest('.ar-m');
      if (mo) return ouvrirFocus({ main: true, u: +mo.dataset.mu });
      return;
    }
    const d = Combat.demande(T.E);
    const aMoi = d && d.qui === T.moi && !T.E.fin;

    /* Une décision qui se prend sur le plateau. */
    if (aMoi && d.type === 'choix' && d.options.some(o => o.u)) {
      const x = e.target.closest('.option');
      if (x) return choisir({ t: 'choix', v: +(x.dataset.u || x.dataset.mu || x.dataset.e) });
    }
    if (aMoi && d.type === 'cartes' && T.multi) {
      const x = e.target.closest('.ar-m,.ar-j');
      if (x) return basculerMulti(+(x.dataset.u || x.dataset.mu));
    }

    /* Le choix d'une cible d'attaque. */
    if (T.cible) {
      const ceo = e.target.closest('.ar-ceo.lui');
      const j = e.target.closest('.ar-camp.lui .ar-j');
      const v = ceo ? 'ceo' : j ? +j.dataset.u : null;
      const a = v != null && T.cible.opts.find(o => o.cible === v);
      if (a) { T.cible = null; consigne(null); return jouer(a); }
      if (v == null && !e.target.closest('.ar-j,.ar-ceo')) return;
      return;
    }

    /* Une carte de la main en grand : toucher sa place. */
    if (T.focus && T.focus.main && aMoi && d.type === 'tour') {
      const opts = Combat.optionsTour(T.E).filter(a => a.u === T.focus.u);
      const joueur = e.target.closest('.ar-camp.moi .ar-j');
      const place = e.target.closest('.ar-camp.moi .ar-place');
      let a = null;
      if (joueur) a = opts.find(o => o.t === 'lier' && o.cible === +joueur.dataset.u);
      if (!a && place && !place.querySelector('.ar-j')) a = opts.find(o => o.t === 'deployer' && o.ligne === +place.dataset.ligne);
      if (a) return poserDepuisFocus(a, joueur || place);
    }

    const m = e.target.closest('.ar-m');
    if (m) return ouvrirFocus({ main: true, u: +m.dataset.mu });
    const o = e.target.closest('.ar-obj');
    if (o) return ouvrirFocus({ id: o.dataset.id });
    const j = e.target.closest('.ar-j');
    if (j) return ouvrirFocus({ u: +j.dataset.u });
  }

  /* ---------- La carte en grand ---------- */
  /* `f` : { main, u } une carte de sa main ; { u } une carte du plateau ;
     { id } une carte à lire. */
  function ouvrirFocus(f) {
    if (!T) return;
    const E = T.E;
    const d = Combat.demande(E);
    const aMoi = d && d.qui === T.moi && d.type === 'tour' && !E.fin && !T.occupe;
    let inst = null, id = f.id;
    if (f.u != null) {
      inst = f.main ? E.j[T.moi].main.find(x => x.u === f.u) : Combat.trouverSurPlateau(E, f.u);
      if (!inst) return;
      id = inst.id;
    }
    const k = carte(id);
    const ty = typeDe(k);
    T.focus = Object.assign({ id }, f);
    SFX.jouer('carte');

    let corps = '';
    const surPlateau = inst && !f.main;
    if (f.main && aMoi) corps = panneauMain(inst, k);
    else if (surPlateau && k.cat === 'joueur' && inst.j === T.moi && aMoi) corps = panneauAttaques(inst, k);
    else if (surPlateau && k.cat === 'joueur') corps = panneauLecture(inst, k);
    /* Un Joueur hors du plateau (dans la main, dans la liste des cartes
       jouées) : ses attaques telles qu'imprimées. Il n'a ni Objets ni effets :
       on ne les calcule pas. */
    else if (k.cat === 'joueur') corps = `<p class="ar-f-def"><span class="ar-f-defv">${MARQUES.Garde}<b>${k.def}</b></span></p><div class="ar-atqs">${(k.atks || []).map(a => `<div class="ar-atq lu">${coutHTML(a.cout)}<span class="ar-atq-t"><b>${h(a.nom)}</b>${a.effet ? `<small>${h(a.effet)}</small>` : ''}</span><em>${a.degats == null ? '' : a.degats}</em></div>`).join('')}</div>`;
    if (f.main && !aMoi && !T.occupe && k.cat !== 'joueur' && !(k.fx || []).length) corps += '<p class="ar-f-aide">Ce n\'est pas ton tour.</p>';
    /* Un Objet, un Coach, un Moment : son effet, lisible tout de suite. */
    if (k.cat !== 'joueur' && (k.fx || []).length) corps = `<div class="ar-f-fx">${k.fx.map(t => `<p>${h(t)}</p>`).join('')}</div>` + corps;
    /* Les Objets liés à un Joueur : chacun avec son effet, et on peut
       l'ouvrir en grand. */
    if (surPlateau && inst.obj && inst.obj.length) corps += panneauObjets(inst);
    const lire = k.cat === 'joueur' || k.res || k.provisoire;

    const z = qs('.ar-focus');
    const r = qs('.ar-camp.moi').getBoundingClientRect();
    const a = T.el.getBoundingClientRect();
    /* Pendant son tour, le grand panneau s'arrête au-dessus de son camp à
       soi : on y voit ses places et ses Joueurs pendant qu'on choisit. */
    const garde = aMoi && (f.main || (inst && inst.j === T.moi));
    z.style.bottom = garde ? `${Math.max(0, a.bottom - r.top + 4)}px` : '0px';
    z.className = 'ar-focus' + (garde ? ' haut' : '');
    z.innerHTML = `<div class="ar-f-in">
      <div class="ar-f-carte">${htmlCarte(id)}</div>
      <div class="ar-f-panneau">
        <p class="ar-f-type t-${k.cat || ''}" style="--cc:${coulDe(k).c}">${ty.ico}<span>${ty.nom}</span>${essIcon(k.col || 'neutre', 'ar-f-coul')}<span class="ar-f-cn">${coulDe(k).nom}</span></p>
        <b class="ar-f-nom">${h(k.nom || '')}</b>
        ${corps}
        ${lire ? `<button class="ar-f-lire" data-ar="lire">Lire la carte</button>
        <div class="ar-f-texte" hidden>${texteCarte(k.cat === 'joueur' ? k : Object.assign({}, k, { fx: [] }), inst && !f.main && k.cat === 'joueur' ? inst : null, true)}</div>` : ''}
      </div>
      <button class="ar-bouton ar-f-x" data-ar="fermer-focus" aria-label="Fermer">✕</button>
    </div>`;
    z.hidden = false;
    if (f.main) rendre();
  }
  function fermerFocus() {
    if (!T) return;
    const z = qs('.ar-focus');
    z.hidden = true;
    z.innerHTML = '';
    T.focus = null;
    qsa('.ar-m.choisi').forEach(x => x.classList.remove('choisi'));
    rendre();
  }

  function panneauMain(c, k) {
    const opts = Combat.optionsTour(T.E).filter(a => a.u === c.u);
    if (k.cat === 'joueur') return `<p class="ar-f-aide">${opts.length ? 'Touche une ligne libre, en bas, pour le déployer.' : h(raisonPasDeploiement())}</p>`;
    if (k.cat === 'objet') return `<p class="ar-f-aide">${opts.length ? 'Touche un de tes Joueurs pour lui lier cet Objet.' : (T.E.phase === 'combat' ? 'Plus d\'Objet en phase de Combat.' : 'Il te faut un Joueur sur le plateau.')}</p>`;
    const a = opts.find(x => x.t === 'jouer');
    if (a) return `<button class="ar-f-jouer" data-ar="jouer" data-u="${c.u}">Jouer ${k.cat === 'coach' ? 'ce Coach' : 'ce Moment'}</button>`;
    return `<p class="ar-f-aide">${k.cat === 'coach' && T.E.cpt.coachs >= Combat.REGLE.COACHS ? 'Un seul Coach par tour.' : 'Rien à viser pour le moment.'}</p>`;
  }

  function raisonPasDeploiement() {
    if (T.E.phase === 'combat') return 'Plus de déploiement en phase de Combat.';
    if (T.E.cpt.deploie >= Combat.REGLE.DEPLOIEMENTS) return 'Un seul Joueur déployé par tour.';
    return 'Tes trois lignes sont occupées.';
  }

  /* Les attaques d'un de ses Joueurs : celles qu'on peut lancer s'allument. */
  function panneauAttaques(c, k) {
    const opts = Combat.optionsTour(T.E).filter(a => a.t === 'attaquer' && a.u === c.u);
    const lignes = k.atks.map((a, i) => {
      const inf = Combat.infoAttaque(T.E, c, i);
      const possible = opts.filter(o => o.k === i);
      const chev = possible.some(o => o.chevaliere) && !possible.some(o => !o.chevaliere);
      const raison = !possible.length ? pourquoiPas(c, i, inf) : '';
      return `<button class="ar-atq${possible.length ? ' ok' : ''}" data-ar="attaque" data-u="${c.u}" data-k="${i}" ${possible.length ? '' : 'disabled'}>
        ${coutHTML(chev ? { neutre: 2 } : inf.cout)}
        <span class="ar-atq-t"><b>${h(a.nom)}</b>${a.effet ? `<small>${h(a.effet)}</small>` : ''}${raison ? `<small class="ar-raison">${h(raison)}</small>` : ''}</span>
        <em>${a.degats == null ? '' : inf.val}${a.degats != null && inf.val !== a.degats ? `<s>${a.degats}</s>` : ''}</em></button>`;
    }).join('');
    /* Attaquer ouvre la phase de Combat : s'il reste à déployer ou à lier,
       on le dit ici, une fois, plutôt que de demander confirmation. */
    const ferme = opts.length && T.E.phase === 'jeu' && Combat.optionsTour(T.E).some(a => a.t === 'deployer' || a.t === 'lier');
    return `${defLigne(c, k)}<div class="ar-atqs">${lignes || '<p class="ar-f-aide">Aucune attaque.</p>'}</div>${ferme ? '<p class="ar-f-note">Attaquer ouvre la phase de Combat : plus de Joueur à déployer ni d\'Objet à lier ce tour.</p>' : ''}${panneauEffets(c, k)}`;
  }
  function panneauLecture(c, k) {
    const lignes = k.atks.map((a, i) => {
      const inf = Combat.infoAttaque(T.E, c, i);
      return `<div class="ar-atq lu">${coutHTML(inf.cout)}<span class="ar-atq-t"><b>${h(a.nom)}</b>${a.effet ? `<small>${h(a.effet)}</small>` : ''}</span><em>${a.degats == null ? '' : inf.val}</em></div>`;
    }).join('');
    return `${defLigne(c, k)}<div class="ar-atqs">${lignes}</div>${panneauEffets(c, k)}`;
  }
  function panneauObjets(c) {
    return `<div class="ar-f-objs"><p class="ar-f-objs-t">Objets liés</p>${c.obj.map(o => {
      const k = carte(o.id);
      return `<button class="ar-f-obj" data-ar="voir-carte" data-id="${o.id}"><i style="background-image:url('${abs(k.img || '')}')"></i><span><b>${h(k.nom || '')}</b>${(k.fx || []).length ? `<small>${h(k.fx.join(' '))}</small>` : ''}</span></button>`;
    }).join('')}</div>`;
  }
  /* Ce qui agit sur un Joueur en ce moment, en toutes lettres : sa Défense
     et ses attaques modifiées (Objets, coéquipiers, effets du tour), ses
     mots-clés et ce qu'ils font, ce qui lui est interdit. Les pastilles du
     plateau ne disent que « il y a quelque chose » : c'est ici qu'on le lit. */
  const MOTS_CLES = {
    Provocation: 'l\'attaquant face à lui doit le viser.',
    Garde: 'il peut défendre n\'importe quelle ligne.',
    Shield: 'il ignore la première attaque qu\'il subit.',
    Riposte: 'vaincu, il peut contre-attaquer celui qui l\'a vaincu.',
    Légion: 'vaincu, il peut revenir en main contre une carte défaussée.'
  };
  function effetsEnCours(c, k) {
    const E = T.E, l = [];
    const duree = t => (t.jusqua > E.tour ? 'jusqu\'au tour suivant' : 'ce tour');
    const signe = v => (v > 0 ? '+' : '−') + Math.abs(v);
    const def = Combat.defense(E, c), d0 = k.def || 0;
    if (def !== d0) l.push({ s: def > d0 ? 'plus' : 'moins', t: `Défense ${signe(def - d0)} : ${def} au lieu de ${d0}` });
    const a0 = (k.atks || []).findIndex(a => a.degats != null);
    if (a0 >= 0) {
      const b = Combat.infoAttaque(E, c, a0).val - k.atks[a0].degats;
      if (b) l.push({ s: b > 0 ? 'plus' : 'moins', t: `Attaques ${signe(b)} de dégâts` });
    }
    for (const t of E.temp) {
      const vise = t.cible != null ? t.cible === c.u : t.camp === c.j && (t.type === 'def' || t.type === 'atk');
      if (!vise) continue;
      if (t.type === 'def') l.push({ s: t.val > 0 ? 'plus' : 'moins', t: `${signe(t.val)} Défense ${duree(t)}` });
      else if (t.type === 'atk') l.push({ s: t.val > 0 ? 'plus' : 'moins', t: `${signe(t.val)} aux attaques ${duree(t)}` });
      else if (t.type === 'pasAttaque') l.push({ s: 'moins', t: `Ne peut pas attaquer ${duree(t)}` });
      else if (t.type === 'pasDefenseFace') l.push({ s: 'plus', t: `Le Joueur d'en face ne peut pas défendre contre lui ${duree(t)}` });
      else if (t.type === 'kw') l.push({ s: 'plus', t: `Gagne ${t.kw} ${duree(t)}` });
    }
    for (const m of ['Provocation', 'Garde', 'Riposte', 'Légion']) if (Combat.aMotCle(E, c, m)) l.push({ s: 'kw', t: `<b>${m}</b> : ${MOTS_CLES[m]}` });
    if (Combat.shieldActif(E, c)) l.push({ s: 'kw', t: `<b>Shield</b> : ${MOTS_CLES.Shield}` });
    return l;
  }
  function panneauEffets(c, k) {
    const l = effetsEnCours(c, k);
    if (!l.length) return '';
    return `<div class="ar-f-effets"><p class="ar-f-objs-t">En ce moment</p>${l.map(x => `<p class="ar-eff ${x.s}">${x.t}</p>`).join('')}</div>`;
  }

  function defLigne(c, k) {
    const def = Combat.defense(T.E, c);
    const etat = [c.eng ? 'engagé' : 'prêt', c.obj.length ? `${c.obj.length} Objet${c.obj.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    return `<p class="ar-f-def"><span class="ar-f-defv${def !== k.def ? ' mod' : ''}">${MARQUES.Garde}<b>${def}</b>${def !== k.def ? `<s>${k.def}</s>` : ''}</span><small>${etat}</small></p>`;
  }

  function pourquoiPas(c, k, inf) {
    const E = T.E;
    if (Combat.premierTourDuPremier(E, T.moi)) return 'Pas d\'attaque au tout premier tour.';
    if (E.cpt.combatFini) return 'La phase de Combat est finie.';
    if (c.eng) return 'Engagé : il a déjà attaqué ou défendu.';
    if (E.temp.some(t => t.type === 'pasAttaque' && t.cible === c.u)) return 'Il ne peut pas attaquer ce tour.';
    if (!inf.payable) return 'Pas assez d\'Essences de la bonne couleur.';
    return '';
  }

  /* Le texte d'une carte, lisible : sous « Lire la carte ». */
  function texteCarte(k, c, sansObjets) {
    const l = [];
    if (k.cat === 'joueur') {
      k.atks.forEach(a => l.push(`<p>${coutHTML(a.cout)} <b>${h(a.nom)}</b> ${a.degats == null ? '' : `<em>${a.degats}</em>`}${a.effet ? `<br><small>${h(a.effet)}</small>` : ''}</p>`));
      if (k.kw) l.push(`<p class="ar-tkw"><b>${h(k.kw.nom)}</b> ${h(k.kw.texte)}</p>`);
      (k.talents || []).forEach(t => l.push(`<p class="ar-tkw"><b>${h(t.nom)}</b> ${h(t.texte)}</p>`));
    } else {
      (k.fx || []).forEach(t => l.push(`<p>${h(t)}</p>`));
    }
    if (k.res) l.push(`<p class="ar-tres"><b>Résilience</b> ${h(k.res)}</p>`);
    if (k.provisoire) l.push('<p class="ar-tprov">Carte provisoire : son vrai contenu n\'est pas encore connu.</p>');
    if (c && c.obj && c.obj.length && !sansObjets) l.push(`<p class="ar-tobj">Objets liés : ${c.obj.map(o => h(carte(o.id).nom)).join(', ')}</p>`);
    return l.join('');
  }

  /* Poser la carte en grand à sa place : elle y vole, depuis le grand. */
  async function poserDepuisFocus(a, cibleEl) {
    const de = qs('.ar-f-carte');
    if (de && cibleEl) {
      const r0 = de.getBoundingClientRect();
      const id = T.focus.id;
      qs('.ar-focus').hidden = true;
      T.focus = null;
      /* Pendant le vol, rien d'autre ne se touche. */
      T.occupe = true;
      try {
        await vol(id, r0, cibleEl.getBoundingClientRect(), { ms: 360, w: r0.width, s1: Math.min(1, cibleEl.getBoundingClientRect().width / r0.width), arc: 10 });
      } finally { if (T) T.occupe = false; }
    }
    if (!T) return;
    fermerFocus();
    T.sauteVol = a.u;
    jouer(a);
  }

  /* ---------- Les actions des boutons ---------- */
  function action(k, b) {
    if (k === 'menu') return menu();
    if (k === 'journal') return basculerJournal();
    if (k === 'histo') return voirHisto();
    if (k === 'histo-carte') { const x = T.histo[+b.dataset.n]; fermerSheet(); return x && ouvrirFocus({ id: x.id }); }
    if (k === 'voir-carte') return ouvrirFocus({ id: b.dataset.id });
    if (k === 'fermer-focus') return fermerFocus();
    if (k === 'lire') { const t = qs('.ar-f-texte'); if (t) { t.hidden = !t.hidden; b.textContent = t.hidden ? 'Lire la carte' : 'Masquer le texte'; } return; }
    if (k === 'annuler') { T.cible = null; consigne(null); fermerFocus(); fermerSheet(); return rendre(); }
    if (k === 'defausse' || k === 'banc') return voirPile(+b.dataset.j, k);
    if (k === 'reserve' || k === 'club') return infoPile(+b.dataset.j, k);
    if (k === 'quitter') return quitter();
    if (k === 'vitesse') {
      T.rapide = !T.rapide;
      b.classList.toggle('on', T.rapide);
      b.querySelector('i').textContent = T.rapide ? 'oui' : 'non';
      try { const j = JSON.parse(localStorage.getItem('mtcg.jeu') || '{}'); j.rapide = T.rapide; localStorage.setItem('mtcg.jeu', JSON.stringify(j)); } catch (e) { /* */ }
      return;
    }
    if (k === 'regles') { fermerSheet(); if (typeof ouvrirGuidesSurcouche === 'function') ouvrirGuidesSurcouche(); return; }
    if (k === 'abandon') return confirmerAbandon();
    if (k === 'abandon-ok') return abandonner();
    if (T.occupe) return;
    const d = Combat.demande(T.E);
    if (k === 'fin') {
      if (!d || d.type !== 'tour' || d.qui !== T.moi) return;
      fermerFocus();
      return jouer({ t: 'finTour' });
    }
    if (k === 'jouer') {
      const u = +b.dataset.u;
      const de = qs('.ar-f-carte');
      const r0 = de && de.getBoundingClientRect();
      fermerFocus();
      T.montreDepuis = r0;
      return jouer({ t: 'jouer', u });
    }
    if (k === 'attaque') return choisirAttaque(+b.dataset.u, +b.dataset.k);
    if (k === 'opt') return choisir({ t: 'choix', v: valeurOpt(b.dataset.v) });
    if (k === 'multi-ok') return choisir({ t: 'cartes', u: [...T.multi.sel] });
    if (k === 'multi') return basculerMulti(+b.dataset.u);
    if (k === 'ordre') return ordreClic(+b.dataset.u);
    if (k === 'ordre-ok') return choisir({ t: 'ordre', u: T.ordre.sel.concat(T.ordre.reste) });
    if (k === 'ordre-raz') { T.ordre.reste = T.ordre.reste.concat(T.ordre.sel); T.ordre.sel = []; return montrerDecision(Combat.demande(T.E)); }
  }
  const valeurOpt = v => (/^-?\d+$/.test(v) ? +v : v);

  /* Une attaque choisie : la carte retourne à sa place, les cibles
     s'allument. Il n'y a plus de « Passer en phase de Combat ? » à
     confirmer : le panneau des attaques prévient avant, sans clic de plus
     (panneauAttaques). */
  async function choisirAttaque(u, k) {
    const opts = Combat.optionsTour(T.E).filter(a => a.t === 'attaquer' && a.u === u && a.k === k);
    if (!opts.length) return;
    /* La Chevalière : la version la moins chère quand il y a le choix. */
    const sans = opts.filter(o => !o.chevaliere);
    const liste = sans.length ? sans : opts;
    await reduireFocus(u);
    if (liste[0].cible == null || liste.length === 1) return jouer(liste[0]);
    T.cible = { u, k, opts: liste };
    SFX.jouer('carte');
    consigne('Choisis la cible', true);
    rendre();
  }

  /* La carte en grand rapetisse jusqu'à sa place. */
  async function reduireFocus(u) {
    const de = qs('.ar-f-carte');
    const vers = qs(`.ar-j[data-u="${u}"]`);
    if (!de || !vers || RM()) { fermerFocus(); return; }
    const r0 = de.getBoundingClientRect(), r1 = vers.getBoundingClientRect();
    const id = T.focus && T.focus.id;
    qs('.ar-focus').hidden = true;
    T.focus = null;
    vers.style.visibility = 'hidden';
    T.occupe = true;
    try {
      await vol(id, r0, r1, { ms: 320, w: r0.width, s1: r1.width / r0.width, arc: 0, sm: 1 });
    } finally { if (T) T.occupe = false; vers.style.visibility = ''; }
    if (!T) return;
    fermerFocus();
  }

  /* ---------- Glisser une carte de la main ---------- */
  function commencerGlisser(a, e) {
    const u = +a.el.dataset.mu;
    fermerFocus();
    T.focus = { main: true, u, drag: true };
    marquerPlacesCarte(u);
    const r = a.el.getBoundingClientRect();
    const fant = a.el.cloneNode(true);
    fant.className = 'ar-fantome';
    fant.style.width = r.width + 'px';
    document.body.appendChild(fant);
    a.drag = { fant, dx: e.clientX - r.left, dy: e.clientY - r.top, u };
    a.el.classList.add('leve');
    glisser(a, e);
  }
  function glisser(a, e) {
    a.drag.fant.style.transform = `translate(${e.clientX - a.drag.dx}px, ${e.clientY - a.drag.dy}px) rotate(${Math.max(-10, Math.min(10, (e.movementX || 0) * 1.4))}deg)`;
    qsa('.survol').forEach(x => x.classList.remove('survol'));
    const t = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('cible'));
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
    if (!act && sous.some(x => x.classList && x.classList.contains('ar-plateau'))) act = opts.find(o => o.t === 'jouer');
    T.focus = null;
    if (act) { T.sauteVol = act.t === 'jouer' ? null : u; jouer(act); } else rendre();
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
    fermerSheet();
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
  const choisir = a => { fermerSheet(); return jouer(a); };

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
      if (T) { T.occupe = false; T.sauteVol = null; T.montreDepuis = null; rendre(); }
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
        /* Le temps de voir où on en est entre deux actions de l'IA : la
           partie se suit au rythme d'une vraie table, pas en rafale. */
        ticker(`<i class="ar-pense"></i>${h(nomCEO(d.qui))} réfléchit`);
        await attendre(d.type === 'tour' ? 1000 : 650);
        if (T !== moi || T.ferme) break;
        const a = IA.choisir(T.E, { niveau: T.o.ia.niveau });
        ticker(null);
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
    ticker(on ? `<i class="ar-pense"></i>${h(nomCEO(adv(T.moi)))} réfléchit` : null);
  }

  /* ---------- Les décisions ---------- */
  function montrerDecision(d) {
    ticker(null);
    rendre();
    if (d.type === 'tour') {
      fermerSheetDecision();
      return;
    }
    if (d.type === 'choix') return d.but === 'mulligan' ? decisionMulligan(d) : decisionChoix(d);
    if (d.type === 'cartes') return decisionCartes(d);
    if (d.type === 'ordre') return decisionOrdre(d);
  }
  function fermerSheetDecision() {
    const p = qs('.ar-sheet');
    if (p && p.classList.contains('decision')) fermerSheet();
  }

  /* ---------- La feuille du bas (décisions, menu) ---------- */
  function ouvrirSheet(html, genre) {
    const p = qs('.ar-sheet');
    p.className = 'ar-sheet ' + (genre || '');
    p.innerHTML = `<div class="ar-s-in">${html}</div>`;
    p.hidden = false;
  }
  function fermerSheet() {
    if (!T) return;
    const p = qs('.ar-sheet');
    p.hidden = true;
    p.innerHTML = '';
    T.multi = null;
  }

  function decisionMulligan(d) {
    const main = T.E.j[T.moi].main;
    ouvrirSheet(`<p class="ar-s-titre">Ta main de départ</p>
      <div class="ar-mulligan">${main.map((c, i) => `<span style="--i:${i}">${htmlCarte(c.id)}</span>`).join('')}</div>
      <p class="ar-s-texte">Tu peux la garder, ou la remélanger une fois pour en piocher une autre.</p>
      <div class="ar-s-act"><button class="ar-b or" data-ar="opt" data-v="oui">Garder</button><button class="ar-b ghost" data-ar="opt" data-v="non">Changer de main</button></div>`, 'decision mulligan centre');
  }

  function decisionChoix(d) {
    const E = T.E;
    let haut = '';
    if (d.but === 'defense') {
      const att = Combat.trouverSurPlateau(E, d.attaquant);
      if (att) { const x = qs(`.ar-j[data-u="${att.u}"]`); if (x) x.classList.add('menace'); }
      const k = att ? carte(att.id) : {};
      haut = `<div class="ar-s-def">${att ? htmlCarte(att.id) : ''}<div><p class="ar-s-titre gauche">${h(d.titre)}</p><p class="ar-s-texte gauche">${h(d.texte)}</p></div></div>`;
      const boutons = d.options.map(o => o.v === 'non'
        ? `<button class="ar-b ghost" data-ar="opt" data-v="non">${h(o.label)}</button>`
        : `<button class="ar-b def ${o.info && o.info.vaincu ? 'tombe' : 'tient'}" data-ar="opt" data-v="${o.v}">${h(o.label.replace('Défendre avec ', ''))}<small>${o.info ? (o.info.vaincu ? `vaincu · ${o.info.def} contre ${o.info.val}` : `tient · ${o.info.def} contre ${o.info.val}`) : ''}</small></button>`).join('');
      ouvrirSheet(`${haut}<p class="ar-s-aide">Défendre avec un de tes Joueurs (allumés sur le plateau), ou laisser passer.</p><div class="ar-s-act">${boutons}</div>`, 'decision defense');
      surligner();
      SFX.jouer('notif');
      return;
    }
    if (d.carte) haut = `<div class="ar-s-carte">${htmlCarte(d.carte)}</div>`;
    else if (d.cartes && d.cartes.length) {
      haut = `<div class="ar-liste">${d.cartes.map(c => {
        const opt = d.options.find(o => o.v === c.u);
        return `<button class="ar-lc${opt ? '' : ' grise'}" ${opt ? `data-ar="opt" data-v="${c.u}"` : 'disabled'}>${htmlCarte(c.id)}</button>`;
      }).join('')}</div>`;
    }
    const surPlateau = d.options.some(o => o.u) && !(d.cartes && d.cartes.length) && d.zone !== 'liste';
    const boutons = d.options.map(o => {
      if (surPlateau && o.u) return '';
      if (d.cartes && d.cartes.some(c => c.u === o.v)) return '';
      let info = '';
      if (o.info && d.but === 'riposte') info = `<small>${o.info.val >= o.info.def ? 'le vainc' : 'ne suffit pas'} · Défense ${o.info.def}</small>`;
      const ghost = o.v === 'non' || (o.v === 'b' && d.but !== 'choixAdverse');
      return `<button class="ar-b ${ghost ? 'ghost' : 'or'}" data-ar="opt" data-v="${o.v}">${h(o.label)}${info}</button>`;
    }).join('');
    ouvrirSheet(`<p class="ar-s-titre">${h(d.titre)}</p>${d.texte ? `<p class="ar-s-texte">${h(d.texte)}</p>` : ''}${haut}
      ${surPlateau ? '<p class="ar-s-aide">Touche ton choix sur le plateau.</p>' : ''}
      <div class="ar-s-act">${boutons}</div>`, 'decision ' + (d.but || '') + (surPlateau ? ' compact' : ''));
    if (surPlateau) surligner();
    if (d.but === 'resilience') SFX.jouer('notif');
  }

  function decisionCartes(d) {
    T.multi = { sel: new Set(), d };
    const liste = d.cartes || d.parmi.map(u => {
      const c = T.E.j[T.moi].main.find(x => x.u === u) || Combat.trouverSurPlateau(T.E, u);
      return c ? { u, id: c.id } : null;
    }).filter(Boolean);
    ouvrirSheet(`<p class="ar-s-titre">${h(d.titre)}</p>${d.texte ? `<p class="ar-s-texte">${h(d.texte)}</p>` : ''}
      <p class="ar-s-aide">${d.min === d.max ? `Choisis ${d.min} carte${d.min > 1 ? 's' : ''}.` : `De ${d.min} à ${d.max} cartes.`}</p>
      <div class="ar-liste">${liste.map(c => `<button class="ar-lc" data-ar="multi" data-u="${c.u}">${htmlCarte(c.id)}<i class="ar-coche-c"></i></button>`).join('')}</div>
      <div class="ar-s-act"><button class="ar-b or" data-ar="multi-ok" ${d.min > 0 ? 'disabled' : ''}>Valider</button></div>`, 'decision cartes');
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
    ouvrirSheet(`<p class="ar-s-titre">${h(d.titre)}</p>${d.texte ? `<p class="ar-s-texte">${h(d.texte)}</p>` : ''}
      <p class="ar-s-aide">Touche les cartes dans l'ordre voulu.</p>
      <div class="ar-liste">${o.sel.map((u, i) => `<span class="ar-lc pris"><b class="ar-rang">${i + 1}</b>${htmlCarte(carteDe(u).id)}</span>`).join('')}
        ${o.reste.map(u => `<button class="ar-lc" data-ar="ordre" data-u="${u}">${htmlCarte(carteDe(u).id)}</button>`).join('')}</div>
      <div class="ar-s-act"><button class="ar-b or" data-ar="ordre-ok">Valider</button>${o.sel.length ? '<button class="ar-b ghost" data-ar="ordre-raz">Recommencer</button>' : ''}</div>`, 'decision ordre');
  }
  function ordreClic(u) {
    const o = T.ordre;
    o.reste = o.reste.filter(x => x !== u);
    o.sel.push(u);
    decisionOrdre(o.d);
  }

  /* ---------- Les piles ---------- */
  function voirPile(j, quoi) {
    const P = T.E.j[j];
    const l = quoi === 'banc' ? P.banc : P.defausse;
    ouvrirSheet(`<p class="ar-s-titre">${quoi === 'banc' ? 'Banc' : 'Défausse'}${j === T.moi ? '' : ` de ${h(nomCEO(j))}`} · ${l.length}</p>
      ${quoi === 'banc' ? '<p class="ar-s-texte">Ces cartes reviennent dans la main au début du tour de leur propriétaire.</p>' : ''}
      <div class="ar-liste grille">${l.slice().reverse().map(c => `<span class="ar-lc">${htmlCarte(c.id)}</span>`).join('') || '<p class="ar-s-texte">Vide.</p>'}</div>
      <div class="ar-s-act"><button class="ar-b ghost" data-ar="annuler">Fermer</button></div>`, 'pile');
  }

  /* La Réserve et le Club sont face cachée : on dit seulement ce qu'ils sont. */
  function infoPile(j, quoi) {
    const P = T.E.j[j];
    const a = j === T.moi ? 'Ta' : `La`, de = j === T.moi ? '' : ` de ${h(nomCEO(j))}`;
    const txt = quoi === 'reserve'
      ? `${P.reserve.length} Essence${P.reserve.length > 1 ? 's' : ''} attendent face cachée. Au début de chaque tour, la première entre en jeu : c'est avec elles qu'on paie les attaques.`
      : `${P.club.length} carte${P.club.length > 1 ? 's' : ''} face cachée. On y pioche une carte au début de son tour. Vide, chaque pioche coûte un PV.`;
    ouvrirSheet(`<p class="ar-s-titre">${quoi === 'reserve' ? `${a} Réserve d'Essences${de}` : (j === T.moi ? 'Ton Club' : `Le Club${de}`)}</p>
      <p class="ar-s-texte">${txt}</p>
      <div class="ar-s-act"><button class="ar-b ghost" data-ar="annuler">Fermer</button></div>`, 'pile');
  }

  /* ---------- Le menu ---------- */
  function menu() {
    const fini = !!T.E.fin;
    ouvrirSheet(`<p class="ar-s-titre">${h(T.o.titre || 'Combat')}</p>${T.o.sousTitre ? `<p class="ar-s-texte">${h(T.o.sousTitre)}</p>` : ''}
      <div class="ar-menu">
        <button class="ar-mi" data-ar="journal">${NAVICO.quest}<span>Journal du combat</span></button>
        <button class="ar-mi${T.rapide ? ' on' : ''}" data-ar="vitesse">${NAVICO.rotate}<span>Animations rapides</span><i>${T.rapide ? 'oui' : 'non'}</i></button>
        <button class="ar-mi" data-ar="regles">${NAVICO.livre}<span>Les règles</span></button>
        ${fini ? `<button class="ar-mi" data-ar="quitter">${NAVICO.check}<span>Quitter</span></button>` : `<button class="ar-mi danger" data-ar="abandon">${NAVICO.lock}<span>Abandonner</span></button>`}
      </div>
      <div class="ar-s-act"><button class="ar-b ghost" data-ar="annuler">Reprendre</button></div>`, 'menu');
  }
  function confirmerAbandon() {
    ouvrirSheet(`<p class="ar-s-titre">Abandonner ?</p><p class="ar-s-texte">Le combat compte comme une défaite.</p>
      <div class="ar-s-act"><button class="ar-b rouge" data-ar="abandon-ok">Abandonner</button><button class="ar-b ghost" data-ar="annuler">Continuer</button></div>`, 'menu');
  }

  async function abandonner() {
    fermerSheet();
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
    fermerSheet();
    if (!j.hidden) j.querySelector('ol').innerHTML = T.journal.map(l => `<li class="${l.c || ''}">${l.t}</li>`).join('');
  }
  function noter(t, c) {
    if (!T) return;
    T.journal.push({ t, c });
    const j = qs('.ar-journal');
    if (!j.hidden) j.querySelector('ol').insertAdjacentHTML('beforeend', `<li class="${c || ''}">${t}</li>`);
  }

  /* ---------- Pile ou face ---------- */
  /* Une pièce à deux faces : la sienne (son avatar) et celle de l'autre.
     Elle tourne, retombe sur la face de celui qui commence, puis le dit. */
  async function pileOuFace() {
    const E = T.E;
    const moiDabord = E.premier === T.moi;
    const inf = T.o.joueurs || [];
    const face = j => `<span class="ar-piece-f">${avatarHTML((inf[j] || {}).avatar || 'star', 'default', 'xl', (inf[j] || {}).photo || null)}</span>`;
    const a = qs('.ar-annonce');
    a.className = 'ar-annonce pileface';
    a.innerHTML = `<p class="ar-pf-titre">Pile ou face</p>
      <div class="ar-piece${moiDabord ? '' : ' revers'}"><div class="ar-piece-a">${face(T.moi)}</div><div class="ar-piece-b">${face(adv(T.moi))}</div></div>
      <p class="ar-pf-res">${moiDabord ? 'Tu commences' : `${h(nomCEO(E.premier))} commence`}</p>
      <p class="ar-pf-sous">${moiDabord ? 'Pas d\'attaque à ton premier tour.' : 'Tu joueras deux Essences à ton premier tour.'}</p>`;
    a.hidden = false;
    SFX.jouer('piece');
    /* La pièce a sa propre durée (css/arene.css) : on ne la presse pas avec
       les animations rapides, sinon le résultat disparaît avant d'être lu. */
    await pause(RM() ? 1500 : 2900);
    a.classList.add('part');
    await pause(280);
    a.hidden = true;
    noter(`${h(nomCEO(E.premier))} commence.`, 'sys');
  }

  /* ---------- Les animations ---------- */
  /* Chaque événement du moteur a son geste. La partie est déjà jouée quand
     on anime : on montre ce qui s'est passé, dans l'ordre, puis le plateau
     est redessiné à son état final. */
  async function animer(evs) {
    const moi = T;
    T.anim = true;
    try {
      for (const e of evs) {
        if (!T || T !== moi) return;
        const f = ANIM[e.t];
        journaliser(e);
        historiser(e);
        if (f) await f(e);
      }
    } finally {
      moi.anim = false;
    }
    if (!T) return;
    ticker(null);
    /* Les gestes d'un instant ne restent pas sur les cartes. */
    qsa('.ar-j.assaut,.ar-j.defend,.ar-j.menace,.ar-j.pose,.ar-j.bulle-shield')
      .forEach(x => x.classList.remove('assaut', 'defend', 'menace', 'pose', 'bulle-shield'));
  }

  const rect = el => el && el.getBoundingClientRect();
  const elU = u => T.el.querySelector(`.ar-j[data-u="${u}"]`) || T.el.querySelector(`.ar-obj[data-u="${u}"]`);
  const elCEO = j => qs(`.ar-ceo.${cote(j)}`);

  /* Une carte qui vole d'un endroit à un autre. */
  function vol(id, de, vers, o) {
    o = o || {};
    if (!de || !vers || !T) return Promise.resolve();
    const f = document.createElement('div');
    f.className = 'ar-vol';
    f.innerHTML = o.dos != null && o.dos !== false ? dos(o.dos) : htmlCarte(id);
    const w = o.w || 92;
    f.style.width = w + 'px';
    document.body.appendChild(f);
    const h0 = w * 88 / 63;
    const pos = r => [r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h0 / 2];
    const [x0, y0] = pos(de), [x1, y1] = pos(vers);
    const anim = f.animate([
      { transform: `translate(${x0}px,${y0}px) scale(${o.s0 || 1}) rotate(${o.r0 || 0}deg)`, opacity: o.o0 == null ? 1 : o.o0 },
      { transform: `translate(${(x0 + x1) / 2}px,${(y0 + y1) / 2 - (o.arc == null ? 50 : o.arc)}px) scale(${o.sm || ((o.s0 || 1) + (o.s1 || 1)) / 2 * 1.06})`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x1}px,${y1}px) scale(${o.s1 || 1})`, opacity: o.o1 == null ? 1 : o.o1 }
    ], { duration: (o.ms || 480) * vitesse(), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    return anim.finished.then(() => f.remove(), () => f.remove());
  }

  /* Un nombre ou un mot qui monte au-dessus d'une carte. Deux qui se
     suivent sur la même carte ne se chevauchent pas : le second part plus
     haut. */
  function flottant(x, txt, cls) {
    if (!x || !T) return;
    const r = rect(x);
    const cle = x.dataset.u || x.className;
    T.flots = T.flots || {};
    const n = T.flots[cle] = (T.flots[cle] || 0) + 1;
    setTimeout(() => { if (T && T.flots) T.flots[cle] = Math.max(0, (T.flots[cle] || 1) - 1); }, 900);
    const t = document.createElement('div');
    t.className = 'ar-flot ' + (cls || '');
    t.textContent = txt;
    t.style.left = (r.left + r.width / 2) + 'px';
    t.style.top = (r.top + r.height * 0.42 - (n - 1) * 38) + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1300 * vitesse() + 200);
  }

  function secousse(force) {
    if (RM() || !T) return;
    qs('.ar-scene').animate([
      { transform: 'translate(0,0)' }, { transform: `translate(${-force}px,${force / 2}px)` },
      { transform: `translate(${force}px,${-force / 2}px)` }, { transform: `translate(${-force / 2}px,0)` }, { transform: 'translate(0,0)' }
    ], { duration: 320, easing: 'ease-out' });
  }

  function eclats(x, couleurs, n) {
    if (!x || typeof FX === 'undefined') return;
    const r = rect(x);
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, { n: n || 26, colors: couleurs || ['#fff', '#f5c451', '#c8bfff'], speed: 6, size: 3, g: .1 });
  }

  /* Un bandeau qui traverse le plateau : « À toi de jouer », la fin d'une
     phase. */
  function bandeau(txt, genre, ms) {
    if (!T) return Promise.resolve();
    const a = document.createElement('div');
    a.className = 'ar-bandeau ' + (genre || '');
    a.innerHTML = `<span>${txt}</span>`;
    /* L'animation dure exactement le temps du bandeau, même accéléré. */
    const d = (ms || 900) * vitesse();
    a.style.animationDuration = d + 'ms';
    qs('.ar-scene').appendChild(a);
    return pause(d).then(() => a.remove());
  }

  /* Une carte jouée, montrée au centre avec ce qu'elle fait : un Moment, un
     Coach, un Objet, une Résilience. Celle de l'adversaire reste le temps
     de lire son effet (plus longtemps si le texte est long) ; toucher
     l'écran passe à la suite. `o.vers` : l'élément où la carte file
     ensuite (le Joueur qui reçoit l'Objet). `o.texte` remplace l'effet. */
  async function montrer(id, legende, j, depuis, o) {
    o = o || {};
    const k = carte(id);
    const texte = o.texte != null ? o.texte : (k.fx || []).join(' ');
    const lui = j !== T.moi;
    const z = document.createElement('div');
    z.className = 'ar-montre ' + cote(j);
    z.innerHTML = `${htmlCarte(id)}<div class="ar-mo-txt"><p class="ar-mo-leg">${legende}</p>${texte ? `<p class="ar-mo-fx">${h(texte)}</p>` : ''}</div>${lui ? '<small class="ar-mo-passe">Touche pour continuer</small>' : ''}`;
    T.el.appendChild(z);
    if (depuis && !RM()) {
      const c = z.querySelector('.ar-c'), r = c.getBoundingClientRect();
      c.animate([{ transform: `translate(${depuis.left + depuis.width / 2 - r.left - r.width / 2}px,${depuis.top + depuis.height / 2 - r.top - r.height / 2}px) scale(${Math.max(.2, depuis.width / r.width)})`, opacity: .4 }, { transform: 'none', opacity: 1 }],
        { duration: 380, easing: 'cubic-bezier(.3,.7,.3,1)' });
    } else z.classList.add('entre');
    SFX.jouer('woosh');
    const ms = lui ? Math.min(4400, 2100 + texte.length * 16) : 1300;
    await new Promise(fin => {
      const t = setTimeout(fin, ms * vitesse());
      z.addEventListener('click', ev => { ev.stopPropagation(); clearTimeout(t); fin(); }, { once: true });
    });
    if (!T) { z.remove(); return; }
    const c = z.querySelector('.ar-c');
    if (o.vers && c && !RM()) {
      const r = c.getBoundingClientRect();
      c.style.visibility = 'hidden';
      z.classList.add('part');
      await vol(id, r, rect(o.vers), { ms: 480, w: r.width, s1: Math.max(.2, rect(o.vers).width * .5 / r.width), arc: 18 });
      z.remove();
      return;
    }
    z.classList.add('part');
    await attendre(260);
    z.remove();
  }

  const ANIM = {
    async tour(e) {
      consigne(null);
      rendre(true);
      if (e.j === T.moi) { SFX.jouer('notif'); await bandeau('À toi de jouer', 'moi', 1000); }
      else await bandeau(`Tour de ${h(nomCEO(e.j))}`, 'lui', 1000);
    },
    async pioche(e) {
      if (e.j !== T.moi) { rendre(true); return; }
      const de = qs('.ar-camp.moi .ar-pile.club');
      SFX.jouer('carte');
      await vol(null, rect(de), rect(qs('.ar-main')), { dos: T.moi, ms: 360, w: 60, s1: 1.2, arc: 30 });
      rendre(true);
    },
    async essence(e) {
      rendre(true);
      const x = T.el.querySelector(`.ar-gem[data-e="${e.u}"]`);
      if (x) { x.classList.add('arrive'); SFX.jouer('piece'); }
      await attendre(260);
    },
    async deploie(e) {
      if (e.pose) { rendre(true); return; }
      const place = qs(`.ar-camp.${cote(e.j)} .ar-place[data-ligne="${e.ligne}"]`);
      if (T.sauteVol !== e.u) {
        const de = e.j === T.moi ? (qs(`.ar-m[data-mu="${e.u}"]`) || qs('.ar-main')) : qs('.ar-mainadv');
        SFX.jouer('carte');
        await vol(e.id, rect(de), rect(place), { ms: e.j === T.moi ? 440 : 600, w: rect(place) ? rect(place).width : 92, s0: 0.8, arc: 40 });
      }
      rendre(true);
      const x = elU(e.u);
      if (x) { x.classList.add('pose'); eclats(x, [coulDe(carte(e.id)).c, '#fff'], 16); }
      SFX.jouer('retourne');
      /* Le Joueur adverse se nomme en arrivant. */
      if (e.j !== T.moi) flottant(x, carte(e.id).nom || '', 'info');
      await attendre(e.j === T.moi ? 260 : 700);
    },
    async entree(e) {
      const x = elU(e.u);
      if (x) { x.classList.add('brille'); setTimeout(() => x && x.classList.remove('brille'), 900); }
      await attendre(380);
    },
    async joue(e) {
      if (e.j === T.moi) rendreMain();
      const k = carte(e.id);
      await montrer(e.id, `${e.j === T.moi ? 'Tu joues' : `${h(nomCEO(e.j))} joue`} ${k.cat === 'coach' ? 'le Coach' : 'le Moment'} <b>${h(k.nom)}</b>`, e.j, e.j === T.moi ? T.montreDepuis : rect(qs('.ar-mainadv')));
      rendre(true);
    },
    /* Un Objet de l'adversaire : montré en grand avec son effet et le
       Joueur qui le reçoit, puis il file sur ce Joueur. Le sien, posé
       depuis la carte en grand, y va directement. */
    async lie(e) {
      const vers = elU(e.cible);
      const k = carte(e.id), sur = carte(trouverId(e.cible)).nom || 'un Joueur';
      if (e.j !== T.moi) {
        SFX.jouer('carte');
        if (vers) vers.classList.add('recoit');
        await montrer(e.id, `${h(nomCEO(e.j))} lie <b>${h(k.nom)}</b> à <b>${h(sur)}</b>`, e.j, rect(qs('.ar-mainadv')), { vers });
        if (vers) vers.classList.remove('recoit');
      } else if (T.sauteVol !== e.u) {
        const de = qs(`.ar-m[data-mu="${e.u}"]`) || qs('.ar-main');
        SFX.jouer('carte');
        await vol(e.id, rect(de), rect(vers), { ms: 400, s1: 0.4, arc: 30 });
      }
      rendre(true);
      const x = elU(e.cible);
      if (x) { x.classList.add('brille'); setTimeout(() => x && x.classList.remove('brille'), 900); }
      eclats(x, ['#c8bfff', '#fff'], 14);
      SFX.jouer('retourne');
      await attendre(e.j === T.moi ? 220 : 520);
    },
    async attaque(e) {
      rendre(true);
      const x = elU(e.u);
      if (x) x.classList.add('assaut');
      SFX.jouer('woosh');
      /* La carte qui attaque se lève : la bande ne dit que l'attaque et sa cible. */
      const cible = e.cible === 'ceo' ? (adv(e.j) === T.moi ? 'ton CEO' : 'son CEO') : e.cible ? h(carte((Combat.trouverSurPlateau(T.E, e.cible) || {}).id || '').nom || 'un Joueur') : '';
      /* L'attaque de l'adversaire dit aussi ce qu'elle fait. */
      const a = (carte(trouverId(e.u)).atks || [])[e.k] || {};
      const effet = e.j !== T.moi && a.effet ? a.effet : '';
      ticker(`<b>${h(e.nom)}</b>${cible ? `<i class="ar-fl">→</i>${cible}` : ''}${effet ? `<small>${h(effet)}</small>` : ''}`);
      await attendre(e.j === T.moi ? 560 : Math.min(2600, 1000 + effet.length * 14));
    },
    async defend(e) {
      const x = elU(e.u);
      if (x) { x.classList.add('defend'); x.classList.add('eng'); }
      SFX.jouer('retourne');
      flottant(x, 'Défend', 'info');
      await attendre(420);
    },
    async impact(e) {
      const a = elU(e.u);
      const c = e.cible === 'ceo' ? elCEO(adv(ownerOf(e.u))) : elU(e.cible);
      if (a && c && !e.riposte && !RM()) {
        const ra = rect(a), rc = rect(c);
        const dx = (rc.left + rc.width / 2) - (ra.left + ra.width / 2), dy = (rc.top + rc.height / 2) - (ra.top + ra.height / 2);
        await a.animate([{ translate: '0 0' }, { translate: `${dx * 0.6}px ${dy * 0.6}px`, offset: 0.55 }, { translate: '0 0' }],
          { duration: 400 * vitesse(), easing: 'cubic-bezier(.5,0,.3,1)' }).finished.catch(() => {});
      }
      SFX.jouer('dechire');
      secousse(e.cible === 'ceo' ? 7 : 4);
      if (e.val != null && e.cible !== 'ceo') flottant(c, String(e.val), 'degats');
      eclats(c, ['#fff', '#ff6b6b', '#ffb3b3'], 22);
      await attendre(420);
    },
    async repousse(e) {
      const x = elU(e.u);
      flottant(x, 'Repoussé', 'tient');
      SFX.jouer('piece');
      if (x) x.animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 400 });
      await attendre(420);
    },
    async shield(e) {
      const x = elU(e.u);
      if (x) x.classList.add('bulle-shield');
      flottant(x, 'Shield', 'tient');
      SFX.jouer('rare');
      await attendre(560);
    },
    async vaincu(e) {
      const x = elU(e.u);
      if (x) { x.classList.add('vaincu'); eclats(x, ['#fff', '#ff6b6b', '#c8bfff'], 34); }
      SFX.jouer('craque');
      flottant(x, 'Vaincu', 'mort');
      await attendre(850);
      rendre(true);
    },
    async touche(e) {
      const x = elCEO(e.j);
      x.classList.add('touche');
      setTimeout(() => x && x.classList.remove('touche'), 700);
      if (e.j === T.moi) { T.el.classList.add('flash'); setTimeout(() => T && T.el.classList.remove('flash'), 500); }
      flottant(x, '−1 PV', 'degats');
      await attendre(560);
    },
    async pvRecup(e) {
      const de = elCEO(e.j).querySelector('.ar-pvdos i:last-child') || elCEO(e.j);
      const vers = e.j === T.moi ? qs('.ar-main') : qs('.ar-mainadv');
      await vol(e.id, rect(de), rect(vers), { dos: e.j === T.moi ? false : e.j, ms: 480, w: 60, s0: 0.5, arc: 30 });
      rendre(true);
    },
    async pvDefausse(e) { flottant(elCEO(e.j), 'PV détruit', 'mort'); rendre(true); await attendre(380); },
    async resilience(e) {
      await montrer(e.id, `Résilience · ${e.j === T.moi ? 'tu joues' : `${h(nomCEO(e.j))} joue`} <b>${h(carte(e.id).nom)}</b>`, e.j, null, { texte: carte(e.id).res || '' });
      rendre(true);
    },
    async riposte(e) {
      ticker(`<b>Riposte</b> · ${h(carte(e.id).nom)} · ${e.val}`);
      await attendre(900);
    },
    async legion(e) { flottant(elCEO(e.j), 'Légion : retour en main', 'info'); await attendre(380); },
    async sauve(e) { flottant(elU(e.u), 'Sauvé', 'tient'); await attendre(420); },
    async banc(e) {
      const x = elU(e.u);
      if (x) x.classList.add('banc');
      flottant(x || elCEO(e.j), 'Au Banc', 'info');
      await attendre(420);
      rendre(true);
    },
    async enMain(e) {
      const x = elU(e.u);
      if (x) x.classList.add('banc');
      flottant(x || elCEO(e.j), 'Retour en main', 'info');
      await attendre(400);
      rendre(true);
    },
    async engage(e) { const x = elU(e.u); if (x) x.classList.add('eng'); },
    async desengage(e) { const x = elU(e.u); if (x) x.classList.remove('eng'); await attendre(180); },
    async revele(e) { await montrerLot(e.cartes, `${h(nomCEO(e.j))} révèle`); },
    async regarde(e) { if (e.j === T.moi) await montrerLot(e.cartes, e.de != null ? `Tu regardes ${e.de === T.moi ? 'tes cartes' : 'les cartes de ' + h(nomCEO(e.de))}` : 'Tu regardes'); },
    async revelePV(e) { await montrerLot(e.cartes, `PV de ${h(nomCEO(e.j))}`); },
    async finCombatForce() { await bandeau('Fin de la phase de Combat', 'lui', 760); },
    async fin() { await attendre(300); },
    async mulligan(e) { if (e.j !== T.moi) flottant(elCEO(e.j), 'Change de main', 'info'); rendre(true); },
    async clubVide(e) { await bandeau(`Club vide : ${h(nomCEO(e.j))} pioche dans ses PV`, 'lui', 900); },
    async echangePlaces() { rendre(true); await attendre(260); },
    async defausse(e) { if (e.j === T.moi) rendreMain(); },
    async bonus(e) { flottant(elU(e.u), '+' + e.val, 'plus'); await attendre(260); },
    async gagneMotCle(e) { flottant(elU(e.u), e.kw, 'info'); await attendre(260); },
    async annule(e) { flottant(elU(e.u), 'Attaque annulée', 'info'); await attendre(380); },
    async attaquePerdue() {},
    async essRendue() { rendre(true); },
    async retourBanc() { rendre(true); }
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
    z.className = 'ar-montre lot entre';
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
      case 'deploie': return noter(`${n(e.j)} ${e.pose ? 'commence avec' : 'déploie'} ${k(e.id)}${e.eng ? ' (engagé)' : ''}.`);
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
    fermerFocus();
    fermerSheet();
    document.querySelectorAll('.ar-flot').forEach(x => x.remove());
    rendre();
    const E = T.E;
    const gagne = E.fin.gagnant === T.moi;
    const raisons = { pv: gagne ? 'Le CEO adverse n\'a plus de PV.' : 'Ton CEO n\'a plus de PV.', abandon: gagne ? `${h(nomCEO(adv(T.moi)))} abandonne.` : 'Tu as abandonné.', club: 'Club vide.' };
    if (gagne) { SFX.jouer('legend'); if (typeof FX !== 'undefined') FX.confetti({ colors: ['#f5c451', '#ffdc85', '#b3a6ff', '#fff'] }); }
    else SFX.jouer('erreur');
    const a = qs('.ar-annonce');
    a.className = 'ar-annonce fin ' + (gagne ? 'victoire' : 'defaite');
    a.innerHTML = `<div class="ar-fin-in"><h2>${gagne ? 'Victoire' : 'Défaite'}</h2><p>${raisons[E.fin.raison] || ''}</p>
      <p class="ar-stats-fin">${E.tour} tours · ${E.j[T.moi].pv.length} PV restants</p>
      <div class="ar-fin-extra"><p class="ar-attente">Enregistrement…</p></div>
      <div class="ar-s-act"><button class="ar-b or" data-ar="quitter">Continuer</button></div></div>`;
    a.hidden = false;
    let extra = '';
    if (T.o.surFin) {
      try { extra = (await T.o.surFin(E, gagne)) || ''; } catch (err) { extra = `<p class="ar-s-texte">${h(err.message || 'Le serveur n\'a pas répondu.')}</p>`; }
    }
    if (!T) return;
    const x = qs('.ar-fin-extra');
    if (x) x.innerHTML = extra;
  }

  return { ouvrir, fermer, ouverte, actionDistante, rendre, htmlCarte, coutHTML, texteCarte, jouer, get etat() { return T; } };
})();

/* ---------- Les cosmétiques du combat ---------- */
/* Les identifiants sont ceux des articles de boutique (public.shop_items).
   `img` absent : le tapis de base, dessiné par la page (css/arene.css). */
const TAPIS = {
  t_base:      { nom: 'Nuit M8', img: null, prix: 0 },
  t_chateau:   { nom: 'Champions du Monde', img: 'assets/combat/tapis/t_chateau.webp', prix: 4000 },
  t_reverie:   { nom: 'La Relève', img: 'assets/combat/tapis/t_reverie.webp', prix: 4000 },
  t_chevalier: { nom: 'La Luxueuse III', img: 'assets/combat/tapis/t_chevalier.webp', prix: 5000 },
  t_veste:     { nom: 'Marteen Supreme', img: 'assets/combat/tapis/t_veste.webp', prix: 4000 },
  t_pilote:    { nom: 'Baby Driver', img: 'assets/combat/tapis/t_pilote.webp', prix: 4000 },
  t_peche:     { nom: 'Vanyabubu', img: 'assets/combat/tapis/t_peche.webp', prix: 4000 },
  /* L'événement « Le Choc des Sections » : ni en vente, ni en Éclats.
     `ev` : où on le gagne ; `vue` : le sous-onglet qui y mène (js/choc.js). */
  t_arene:     { nom: 'Le Choc des Sections', img: 'assets/combat/tapis/t_arene.webp', prix: 0, ev: 'Pass du Choc', vue: 'pass' },
  t_orage:     { nom: 'The French Sorcerer', img: 'assets/combat/tapis/t_orage.webp', prix: 0, ev: 'Boutique du Choc', vue: 'boutique' }
};
const SLEEVES = {
  s_base:    { nom: 'Classique', img: 'assets/card-back.webp', prix: 0 },
  s_sorcier: { nom: '6W26L', img: 'assets/combat/sleeves/s_sorcier.webp', prix: 3000 },
  s_argent:  { nom: 'Argent', img: 'assets/combat/sleeves/s_argent.webp', prix: 2500 },
  s_choc:    { nom: 'Le Choc', img: 'assets/combat/sleeves/s_choc.webp', prix: 0, ev: 'Pass du Choc', vue: 'pass' }
};
