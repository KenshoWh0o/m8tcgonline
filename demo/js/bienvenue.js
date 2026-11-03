/* Les deux fenêtres qui accueillent, et le lien vers le Discord.

   Elles ne s'ouvrent jamais au mauvais moment. Un jeu de collection n'a qu'un
   seul moment fort — le paquet qui se déchire — et une fenêtre posée par-dessus
   le gâcherait. Les propositions attendent donc que l'écran soit rendu au
   joueur, et il n'y en a jamais deux dans la même session : celle de
   l'installation (js/pwa.js) passe par la même file. */
"use strict";

/* Ce qu'on a déjà montré à cette personne, sur cet appareil. Le stockage local
   suffit : réafficher la bienvenue sur un second appareil n'a rien de grave,
   la perdre après un effacement de données non plus. */
const ACCUEIL_CLE = 'mtcg.accueil';

function accueilMemoire() {
  try { return JSON.parse(localStorage.getItem(ACCUEIL_CLE) || '{}'); }
  catch (e) { return {}; }
}

function accueilNoter(v) {
  try { localStorage.setItem(ACCUEIL_CLE, JSON.stringify(Object.assign(accueilMemoire(), v))); }
  catch (e) { /* mode privé */ }
}

/* ---------- Le lien vers le Discord ---------- */
/* Une vraie ancre, pas un bouton qui appelle window.open : les bloqueurs de
   fenêtres laissent passer un lien, et un clic du milieu ouvre un onglet. */
const lienDiscord = (cls, texte) =>
  `<a class="${cls}" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer"
     data-snd="tap">${ICON.discord}<span>${h(texte)}</span></a>`;

/* ---------- Une file d'attente pour les propositions ---------- */
/* Une seule fenêtre par session, et seulement quand rien d'autre n'occupe
   l'écran : ni ouverture de booster, ni carte Promo, ni autre fenêtre. */
let accueilDejaPropose = false;

function quandCalme(montrer) {
  if (accueilDejaPropose) return;
  accueilDejaPropose = true;

  /* Une quête qui vient de se finir (sa carte en haut de l'écran,
     js/quests.js) occupe aussi l'écran : la fenêtre attend qu'elle parte. */
  const occupe = () => document.body.classList.contains('intheater')
    || !$('#sheet').hidden || !$('#viewer').hidden || !!document.querySelector('.qn');
  const essayer = () => (occupe() ? setTimeout(essayer, 1500) : montrer());
  setTimeout(essayer, 1200);
}

/* ---------- La bienvenue ---------- */
/* Montrée une fois par compte et par appareil. Elle sert surtout à poser le
   cadre : ce qu'on fait ici, à quel rythme, et qu'aucun argent réel n'entre
   dans l'affaire — c'est la première question qu'on se pose devant un jeu de
   cartes à collectionner. */
function bienvenueAVoir() {
  if (Backend.mode !== 'cloud' || !save || !save.id) return false;
  if (DEMO) return !accueilMemoire().presentation;
  return !(accueilMemoire().vus || []).includes(save.id);
}

function montrerBienvenue() {
  if (DEMO) return montrerPresentation();
  const vus = (accueilMemoire().vus || []).concat(save.id).slice(-8);
  accueilNoter({ vus });

  openSheet({
    title: 'Bienvenue, ' + save.pseudo,
    body: `<p class="muted">Mate TCG Online est un jeu de collection autour de
        Gentle Mates. Tout se gagne en jouant : <b>aucun argent réel</b>, nulle part.</p>

      <ol class="bvpoints">
        <li><span class="bvico">${ICON.star}</span>
          <span><b>Ouvre des boosters.</b> Six cartes à chaque fois, un nouveau
            toutes les ${Math.round(INTERVAL / 3600000)} h, ${TICKET_CAP} en réserve.</span></li>
        <li><span class="bvico">${NAVICO.cards}</span>
          <span><b>Réunis les ${cards.length} cartes.</b> Les quêtes paient en
            ${MONNAIE.nom}, et la boutique fait le reste.</span></li>
        <li><span class="bvico">${NAVICO.swap}</span>
          <span><b>Échange avec les autres.</b> Carte contre carte, à rareté égale,
            chacun valide de son côté.</span></li>
      </ol>

      <p class="muted small">Les annonces, l'entraide et les échanges se passent
        sur le Discord.</p>
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}`,
    actions: [{ label: 'C\'est parti', primary: true, fn: () => {
      accueilNoter({ discord: 'vu' });
      closeSheet();
      SFX.jouer('gagne');
    }}]
  });
}

/* ---------- Le rappel du Discord ---------- */
/* Pour ceux qui jouaient déjà avant que cette fenêtre existe, et pour ceux qui
   ont refermé la bienvenue sans y prêter attention. Une seule fois, après
   quelques paquets — pas au premier écran, où l'on ne demande rien à personne. */
function discordAVoir() {
  if (DEMO || Backend.mode !== 'cloud' || !save) return false;
  if (accueilMemoire().discord) return false;
  return (save.packsOpened || 0) >= 3;
}

function montrerDiscord() {
  accueilNoter({ discord: 'vu' });
  openSheet({
    title: 'Rejoins le Discord',
    body: `<p class="muted">C'est là qu'on suit l'actualité du jeu et qu'on discute avec
        la communauté. C'est aussi là qu'on trouve quelqu'un pour un échange.</p>
      ${lienDiscord('btn discord', 'Rejoindre le Discord')}`,
    actions: [{ label: 'Plus tard', fn: closeSheet }]
  });
}

/* ---------- Les nouveautés d'une version ---------- */
/* Une fois par version et par appareil, à ceux qui jouaient déjà. Elle annonce
   aussi l'événement en cours, et se rouvre depuis son bandeau (js/booster.js).
   Changer NOUVEAUTES_VERSION la remontre à tout le monde. */
const NOUVEAUTES_VERSION = '3.0';

/* Un événement se signale aussi : une fois annoncé, une fois commencé — même
   à qui a déjà vu les nouveautés de la version. */
const cleEvenement = ev => (ev ? `${ev.titre}|${ev.debut}|${ev.a_venir ? 'avant' : 'pendant'}` : '');

function nouveautesAVoir() {
  /* La démo de Gentle Mates montre le jeu à son premier jour : pas de
     version, donc pas de nouveautés. */
  if (DEMO || Backend.mode !== 'cloud' || !save) return false;
  const m = accueilMemoire();
  return m.nouveautes !== NOUVEAUTES_VERSION
    || (!!save.evenement && m.evenement !== cleEvenement(save.evenement));
}

function montrerNouveautes() {
  if (DEMO) return montrerPresentation();
  const ev = save.evenement;
  accueilNoter({ nouveautes: NOUVEAUTES_VERSION, evenement: cleEvenement(ev) });
  /* Version 3.0 : les Combats. */
  montrerNouveautes30();
}

function montrerNouveautes30() {
  const choc = evenementEnCours() === 'choc';
  const point = (ico, titre, texte) => `<li><span class="bvico">${NAVICO[ico]}</span>
    <span><b>${titre}</b> ${texte}</span></li>`;
  const nbS = (typeof secretes !== 'undefined' ? secretes : []).length;
  openSheet({
    title: 'Version 3.0 · Les Combats et les Secrètes',
    body: `<div class="nvhero v3">
        <div class="nvboites" aria-hidden="true">
          <img src="${SECTIONS.toxique.boite}" alt=""><img src="${SECTIONS.deter.boite}" alt="">
        </div>
        <div class="nvtexte">
          <span class="nvkicker">${choc ? 'Événement en cours' : 'Nouveau'}</span>
          <b>Tes cartes quittent le classeur</b>
          <small>Choisis ta Section, construis ton deck, et entre dans l'arène.</small>
        </div>
      </div>
      <div class="nvhero v3s">
        <div class="nvsec" aria-hidden="true">${Array.from({ length: nbS || 5 }, (_, i) =>
          `<span class="ch-sec-c" style="--i:${i - ((nbS || 5) - 1) / 2}"><b>?</b></span>`).join('')}</div>
        <div class="nvtexte">
          <span class="nvkicker">Et aussi</span>
          <b>Les Secrètes</b>
          <small>${nbS || 'Cinq'} cartes au-delà des 122, à trouver dans les boosters.</small>
        </div>
      </div>
      <div class="nvhero v3r">
        <div class="ch-ref-art" aria-hidden="true">${[[COUV.solo, -1], [COUV.versus, 0], [COUV.arcade, 1]].map(([id, i]) =>
          `<span class="ch-ref-tuile" style="--i:${i};--a:${Math.abs(i)}">${illuCadre(id, .5, .32)}</span>`).join('')}</div>
        <div class="nvtexte">
          <span class="nvkicker">Un nouveau visage</span>
          <b>La refonte visuelle</b>
          <small>Tout le site redessiné, en graphite et lavande.</small>
        </div>
      </div>
      <ol class="bvpoints nvpoints">
        ${point('sword', 'Les Combats.', 'En solo (une campagne de vingt rivaux, l\'Arcade en cinq difficultés) ou en direct contre tes amis. Le tutoriel rapporte 200 Éclats.')}
        ${point('promo', 'Les Secrètes.', `${nbS || 'Cinq'} cartes au-delà des 122, la finition la plus rare du jeu. La Légendaire passe à 4,25 %.`)}
        ${point('foudre', 'Le Raid.', 'Un boss commun à tout le serveur, un nouveau toutes les deux semaines. Chaque phase abattue ouvre un coffre pour ceux qui ont combattu.')}
        ${point('niveau', 'Ton niveau de combattant.', 'Chaque combat rapporte de l\'XP. Chaque niveau paie ; certains donnent un booster, un cadre ou un titre.')}
        ${point('fragment', 'La maîtrise des cartes.', 'Cinq niveaux par carte, chacun avec sa finition, en combat aussi. Ils se paient en Fragments et en exemplaires en trop.')}
        ${point('cards', 'Tes decks.', 'Un atelier, des codes de partage, et le Starter Deck de ta Section, prêté.')}
        ${point('user', 'Neuf cadres.', 'Le cadre Secrète pour ta première Secrète, Arène (niveaux 10 à 50), Toxique, Déter et ceux de l\'événement.')}
        ${point('shop', 'Tapis et sleeves.', 'En boutique. En combat, chacun voit le tapis de celui qui joue.')}
        ${choc ? point('choc', 'Le Choc des Sections.', 'L\'Épreuve du jour, le Raid en Étincelles et un Pass de vingt paliers, pendant deux semaines.') : ''}
      </ol>`,
    actions: choc
      ? [{ label: 'Voir l\'événement', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); aller('choc'); } },
         { label: 'Aux Combats', fn: () => { closeSheet(); aller('combats'); } }]
      : [{ label: 'Aux Combats', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); aller('combats'); } },
         { label: 'Plus tard', fn: closeSheet }]
  });
}

/* ---------- La présentation (la démo de Gentle Mates, 3.0.14) ---------- */
/* À la première visite de la démo (DEMO, js/config.js), à la place de la
   bienvenue : le jeu en sept écrans, du plus simple (ouvrir un booster) au
   plus riche (l'événement), puis ce qu'est la démo. On passe d'un écran à
   l'autre du doigt, à la souris (la bande se tire, js/ui.js), au clavier
   (flèches) ou avec « Suivant ». Chaque écran tient sans défiler, de 360 ×
   740 à l'ordinateur. Elle se rouvre depuis Réglages › À propos.
   Les chiffres viennent du jeu lui-même : rien n'est écrit deux fois. */
function presDiapos() {
  /* Les images se chargent tout de suite : un écran qu'on fait glisser ne
     doit pas montrer ses cartes vides. */
  const rc = c => renderCard(c).replace(' loading="lazy"', '');
  const carte = (id, cls) => byId[id] ? `<span class="pres-c ${cls}">${rc(byId[id])}</span>` : '';
  const h4 = Math.round(INTERVAL / 3600000);
  const nCamp = typeof combatsCampagne === 'function' ? combatsCampagne('toxique').length : 20;
  const piste = (typeof chEv !== 'undefined' && chEv && chEv.piste) ? chEv.piste.length : 20;
  const nL = cards.filter(c => c.rar === 'L').length;
  const grille = ['c113', 'c022', null, 'c071', 'c012', null, 'c077', 'c116'].map(id => id && byId[id]
    ? `<span class="pres-g">${rc(byId[id])}</span>`
    : '<span class="pres-g vide"><i>?</i></span>').join('');
  return [
    { cls: 'accueil', kick: 'Bienvenue', titre: GAME_NAME,
      texte: 'Le TCG Gentle Mates, jouable en ligne\u00a0: on ouvre des boosters, on complète sa collection, on échange et on combat.',
      chiffres: [[cards.length, 'cartes'], [PACK_SIZE, 'par booster'], ['0 €', 'à dépenser']],
      visu: `${carte('c116', 'g')}${carte('c120', 'd')}${carte('c113', 'm')}<img class="pres-logo" src="${ART.logo}" alt="">` },
    { cls: 'boosters', kick: 'Les boosters', titre: `Un booster toutes les ${h4} h`,
      texte: `${PACK_SIZE} cartes, révélées une à une, la plus rare en dernier. ${TICKET_CAP} boosters en réserve au plus\u00a0; d'autres s'achètent avec les ${MONNAIE.nom} gagnés en jouant.`,
      chiffres: [[nL, 'Légendaires'], ['1 sur 2 000', 'godpack'], [secretes.length, 'Secrètes']],
      visu: `<img class="pres-pack" src="${PACK_ARTS[0]}" alt="">${carte('c012', 'p1')}${carte('c057', 'p2')}${carte('c118', 'p3')}` },
    { cls: 'collection', kick: 'La collection', titre: `${cards.length} cartes à réunir`,
      texte: `Et ${reverses.length} Reverses, ${secretes.length} Secrètes, des Promos. Les doublons se recyclent en ${FRAGMENTS.nom}, qui fabriquent les cartes manquantes.`,
      chiffres: [[reverses.length, 'Reverses'], [secretes.length, 'Secrètes'], [MAITRISE.noms.length, 'niveaux de maîtrise']],
      visu: `<div class="pres-grille">${grille}</div><div class="pres-jauge"><i style="--p:71%"></i><b class="tnum">87 / ${cards.length}</b></div>` },
    { cls: 'echanges', kick: 'Entre joueurs', titre: 'Échanger avec ses amis',
      texte: 'La collection de chaque ami est visible, ses doublons aussi. Une carte contre une carte de même rareté, et chacun valide de son côté.',
      chiffres: [['1 contre 1', 'même rareté'], ['Amis', 'et leurs doublons'], ['Défis', 'en direct']],
      visu: `${carte('c071', 'e1')}<span class="pres-swap">${NAVICO.swap}</span>${carte('c044', 'e2')}` },
    { cls: 'combats', kick: 'Les combats', titre: `Un deck de ${Combat.REGLE.CLUB} cartes`,
      texte: `Les règles officielles du TCG. Un tutoriel pour la première partie, puis une campagne de ${nCamp} adversaires, l'Arcade et des défis entre amis.`,
      chiffres: [[nCamp, 'adversaires'], [DIFFICULTES.length, 'difficultés'], [2, 'Starter Decks']],
      visu: `<img class="pres-boite t" src="${SECTIONS.toxique.boite}" alt=""><span class="pres-vs">VS</span><img class="pres-boite d" src="${SECTIONS.deter.boite}" alt="">` },
    { cls: 'choc', kick: 'L\'événement', titre: CHOC.nom,
      texte: `Deux semaines, deux camps\u00a0: ${SECTIONS.toxique.court} ou ${SECTIONS.deter.court}. L'Épreuve du jour, un Raid contre un boss commun à tous les joueurs, un Pass de ${piste} paliers.`,
      chiffres: [[CHOC.epreuve.calendrier.length, 'jours'], [RAID.phases.length, 'phases de Raid'], [piste, 'paliers']],
      visu: `<span class="pres-choc t" style="background-image:url('${SECTIONS.toxique.choc || 'assets/combat/choc-toxique.webp?v=6bc4fa'}')"></span><span class="pres-choc d" style="background-image:url('${SECTIONS.deter.choc || 'assets/combat/choc-deter.webp?v=6bc4fa'}')"></span><span class="pres-vs">VS</span>` },
    { cls: 'demo', kick: 'Cette démo', titre: 'Tout est à essayer',
      texte: 'La partie reste sur cet appareil, et les autres joueurs sont simulés. Le Labo, dans le menu, permet de tout essayer sans attendre.',
      chiffres: [],
      visu: `<span class="pres-labo">${NAVICO.flask || NAVICO.gear}</span><ul class="pres-pills"><li>Toutes les cartes</li><li>Un godpack</li><li>La fin du Raid</li></ul>` }
  ];
}

function montrerPresentation() {
  accueilNoter({ presentation: 1 });
  const D = presDiapos();
  const chiffres = d => d.chiffres.length ? `<ul class="pres-chiffres">${d.chiffres.map(([n, t]) => `<li><b class="tnum">${n}</b><span>${t}</span></li>`).join('')}</ul>` : '';
  openSheet({
    cls: 'pres',
    title: 'Présentation de ' + GAME_NAME,
    body: `<button class="pres-passer linkbtn" data-pres="fin">Passer</button>
      <div class="pres-piste" id="pres-piste" aria-roledescription="carrousel" aria-label="Présentation">${D.map((d, i) =>
        `<section class="pres-d v-${d.cls}" role="group" aria-roledescription="diapositive" aria-label="${i + 1} sur ${D.length}" ${i ? 'aria-hidden="true" inert' : ''}>
          <div class="pres-visu" aria-hidden="true">${d.visu}</div>
          <div class="pres-txt">
            <span class="pres-kick">${h(d.kick)}</span>
            <h4>${h(d.titre)}</h4>
            <p>${h(d.texte)}</p>
            ${chiffres(d)}
          </div>
        </section>`).join('')}</div>
      <div class="pres-nav">
        <button class="pres-fl" data-pres="prec" aria-label="Écran précédent" disabled>${NAVICO.caret}</button>
        <div class="pres-points" role="group" aria-label="Écrans">${D.map((d, i) =>
          `<button data-pres="aller" data-n="${i}" aria-label="Écran ${i + 1} : ${h(d.kick)}"${i ? '' : ' aria-current="step"'}></button>`).join('')}</div>
        <button class="pres-fl suiv" data-pres="suiv" aria-label="Écran suivant">${NAVICO.caret}</button>
      </div>
      <button class="btn pres-go" data-pres="suiv">Suivant</button>
      <p class="pres-annonce" aria-live="polite"></p>`,
    actions: []
  });
  const w = $('#sheet .pres');
  const piste = $('#pres-piste');
  if (!w || !piste) return;
  let i = 0;
  const n = D.length;
  const aller = (k, doux) => {
    k = Math.max(0, Math.min(n - 1, k));
    piste.scrollTo({ left: k * piste.clientWidth, behavior: doux && !RM() ? 'smooth' : 'auto' });
    poser(k);
  };
  const poser = k => {
    if (k === i && w.dataset.i != null) return;
    i = k;
    w.dataset.i = k;
    piste.querySelectorAll('.pres-d').forEach((d, j) => {
      d.toggleAttribute('inert', j !== k);
      if (j === k) d.removeAttribute('aria-hidden'); else d.setAttribute('aria-hidden', 'true');
      d.classList.toggle('on', j === k);
    });
    w.querySelectorAll('.pres-points button').forEach((b, j) => (j === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    w.querySelector('[data-pres="prec"]').disabled = k === 0;
    w.querySelector('.pres-fl.suiv').disabled = k === n - 1;
    const go = w.querySelector('.pres-go');
    go.textContent = k === n - 1 ? 'Commencer' : 'Suivant';
    go.dataset.pres = k === n - 1 ? 'fin' : 'suiv';
    w.querySelector('.pres-passer').hidden = k === n - 1;
    w.querySelector('.pres-annonce').textContent = `${D[k].titre}. ${D[k].texte}`;
  };
  /* Le défilement suit le doigt ; l'écran retenu est celui qui occupe la
     piste quand il s'arrête. */
  let att = 0;
  piste.addEventListener('scroll', () => {
    cancelAnimationFrame(att);
    att = requestAnimationFrame(() => poser(Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))));
  }, { passive: true });
  /* Un changement de taille (téléphone tourné) garde l'écran en cours. */
  const ro = new ResizeObserver(() => { piste.scrollLeft = i * piste.clientWidth; });
  ro.observe(piste);
  const finir = () => {
    ro.disconnect();
    closeSheet();
    SFX.jouer('gagne');
  };
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-pres]');
    if (!b) return;
    const a = b.dataset.pres;
    if (a === 'fin') return finir();
    if (a === 'suiv') return aller(i + 1, true);
    if (a === 'prec') return aller(i - 1, true);
    if (a === 'aller') return aller(+b.dataset.n, true);
  });
  w.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); aller(i + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); aller(i - 1, true); }
  });
  poser(0);
  SFX.jouer('woosh');
}

/* ---------- La fin de la chasse ---------- */
/* Le jour où quelqu'un tire la carte unique, tous les autres l'apprennent par
   une annonce dans leur boîte (open_pack, supabase/installation/03_rpc.sql) — et par cette
   fenêtre, une fois, à leur prochaine visite. Celui qui l'a tirée a eu sa
   révélation : il ne la voit pas. */
function chasseFinAVoir() {
  if (Backend.mode !== 'cloud' || !save || !save.chasse || !save.chasse.trouvee) return false;
  if (accueilMemoire().chasseFin === save.chasse.trouvee_le) return false;
  const u = uniques[0];
  if (u && save.col[u.id] > 0) {
    accueilNoter({ chasseFin: save.chasse.trouvee_le });
    return false;
  }
  return true;
}

function montrerChasseFin() {
  const ch = save.chasse;
  accueilNoter({ chasseFin: ch.trouvee_le });
  const u = uniques[0];
  const quand = ch.trouvee_le ? jourHeure(srvTime(ch.trouvee_le)) : '';
  openSheet({
    title: 'La chasse est terminée',
    body: `<div class="nvhero trouvee">
        <div class="nvrayons" aria-hidden="true"></div>
        ${u ? `<div class="nvcarte">${renderCard(u)}</div>` : ''}
        <div class="nvtexte">
          <span class="nvkicker">Exemplaire unique</span>
          <b>${h(ch.gagnant || 'Un joueur')}</b>
          <small>a tiré ${u ? h(u.nom.replace(/^L'/, 'l\'')) : 'la carte unique'}${quand ? ` ${h(quand)}` : ''}.</small>
        </div>
      </div>
      <p class="muted">Il n'en existera jamais d'autre : elle ne ressortira d'aucun booster, et ne
        s'échange pas. Tu la retrouves dans les Spéciales de ta Collection.</p>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

/* Appelé après chaque rendu : c'est le moment où l'écran est posé. */
function proposerAccueil() {
  if (accueilDejaPropose) return;
  if (bienvenueAVoir()) return quandCalme(montrerBienvenue);
  if (chasseFinAVoir()) return quandCalme(montrerChasseFin);
  if (recapAVoir()) return quandCalme(montrerRecap);
  if (recapChocAVoir()) return quandCalme(montrerRecapChoc);
  if (nouveautesAVoir()) return quandCalme(montrerNouveautes);
  if (discordAVoir()) return quandCalme(montrerDiscord);
}
