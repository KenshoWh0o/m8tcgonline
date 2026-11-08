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

  const occupe = () => document.body.classList.contains('intheater')
    || !$('#sheet').hidden || !$('#viewer').hidden;
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
  return !(accueilMemoire().vus || []).includes(save.id);
}

function montrerBienvenue() {
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
  if (Backend.mode !== 'cloud' || !save) return false;
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
   aussi l'événement en cours, et se rouvre depuis son bandeau (js/booster.js)
   et depuis Réglages › À propos. Changer NOUVEAUTES_VERSION la remontre à
   tout le monde. Une version en ligne avant sa sortie (SORTIE, js/config.js)
   garde la fenêtre de la précédente jusque-là : c'est sortieFaite() qui
   choisit. */
const NOUVEAUTES_VERSION = '2.5';
const nouveautesVersion = () => (sortieFaite() ? NOUVEAUTES_VERSION : '2.1');

/* Un événement se signale aussi : une fois annoncé, une fois commencé — même
   à qui a déjà vu les nouveautés de la version. Sauf L'Échauffement avant son
   départ : il sort avec la 2.5, dont la fenêtre l'annonce (et le récap de
   Reflets d'ici là) ; la fenêtre de la 2.1 n'a rien à en dire. */
const cleEvenement = ev => (ev && !(ev.code === 'echauffement' && ev.a_venir)
  ? `${ev.titre}|${ev.debut}|${ev.a_venir ? 'avant' : 'pendant'}` : '');

function nouveautesAVoir() {
  if (Backend.mode !== 'cloud' || !save) return false;
  const m = accueilMemoire();
  const cle = cleEvenement(save.evenement);
  return m.nouveautes !== nouveautesVersion() || (!!cle && m.evenement !== cle);
}

const montrerNouveautes = () => (sortieFaite() ? montrerNouveautes25() : montrerNouveautes21());

/* ---------- Version 2.5 ---------- */
/* Une mise à jour, pas seulement un événement : la fenêtre dit tout ce qui
   change, L'Échauffement en tête. Une ligne par nouveauté — icône (NAVICO),
   titre, phrase — à tenir en accord avec le README (« Version 2.5 »). Elle
   vaut aussi l'annonce de L'Échauffement (js/echauffement.js), qu'elle
   remplace : deux fenêtres pour la même chose, ce serait une de trop. */
const NOUVEAUTES_25 = () => [
  ['sword', 'L\'Échauffement, l\'événement.', 'Sept défis, un par jour, dans l\'onglet Combats, avec trois Joueurs de ta collection ; trois étoiles, un indice sur ce qui se prépare.'],
  ['trophy', `Des ${MONNAIES_EV.echauffement.nom}, un Pass de vingt paliers`, `et une boutique, en plus des ${fmtN(2100)} ${MONNAIE.nom} des défis. Deux cadres et quatre titres à gagner.`],
  ['clock', 'Et après, un défi par jour.', `${typeof echData !== 'undefined' && echData && echData.fin ? `Dès ${jourParis(echData.fin)}` : 'Dès le 4 novembre'}, L'Échauffement continue : un adversaire par jour, le même pour tous.`],
  ['reflets', 'Les Reverses se fabriquent.', `Recycle leurs doublons, fabrique celles qui manquent : de ${fmtN(revCouts().C)} à ${fmtN(revCouts().R)} ${FRAGMENTS.nom}.`]
];

function montrerNouveautes25() {
  accueilNoter({ nouveautes: NOUVEAUTES_VERSION, echauffement: 'vu', evenement: cleEvenement(save.evenement) });
  const actif = typeof echActif === 'function' && echActif();
  openSheet({
    title: '',
    body: `<div class="ech-annonce maj25">${echIllu(byId.c122, .6, .4, 'fond')}<span><small>Mise à jour</small><b>Version 2.5</b><span>L'Échauffement, et les Reverses qui se fabriquent.</span></span></div>
      <ol class="bvpoints nvpoints">${NOUVEAUTES_25().map(([ico, titre, texte]) => `<li><span class="bvico">${NAVICO[ico] || NAVICO.star}</span>
        <span><b>${h(titre)}</b> ${h(texte)}</span></li>`).join('')}</ol>`,
    actions: actif
      ? [{ label: 'Plus tard', fn: closeSheet },
         { label: 'Premier défi', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); echVue = 'accueil'; aller('combats'); } }]
      : [{ label: 'C\'est parti', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); } }]
  });
}

/* ---------- Version 2.1 ---------- */
/* La fenêtre d'avant, tant que la 2.5 n'est pas sortie. */
function montrerNouveautes21() {
  const ev = save.evenement;
  accueilNoter({ nouveautes: '2.1', evenement: cleEvenement(ev) });
  const reflets = evenementEnCours() === 'reflets';
  const rv = reverses.filter(c => c.rar === 'R');
  const trio = rv.length ? [0, 1, 2].map(i => rv[(i * 7 + new Date().getDate()) % rv.length]) : [];

  const point = (ico, titre, texte) => `<li><span class="bvico">${NAVICO[ico]}</span>
    <span><b>${titre}</b> ${texte}</span></li>`;

  openSheet({
    title: 'Version 2.1 · Reflets',
    body: `<div class="nvhero v2">
        <div class="rf-holo" aria-hidden="true"></div>
        <div class="nvtrio">${trio.map(c => `<div class="nvcarte">${renderCard(c)}</div>`).join('')}</div>
        <div class="nvtexte">
          <span class="nvkicker">${reflets ? 'Événement en cours' : 'Nouveau'}</span>
          <b>Les Reverses</b>
          <small>Frappées du logo Tout Commence Ici. Une dans chaque booster.</small>
        </div>
      </div>
      <ol class="bvpoints nvpoints">
        ${point('lock', 'Exemplaires à garder.', 'Dis combien tu en gardes, par rareté dans les Réglages ou carte par carte : le recyclage n\'y touche plus, et tes amis ne les voient plus comme des doublons.')}
        ${point('coeur', 'Tes favoris.', 'Un cœur sur tes cartes préférées, et un filtre pour les retrouver dans ta Collection.')}
        ${point('quest', 'Dix fois la même.', '10 exemplaires d\'une même Rare, 5 d\'une Épique, 3 d\'une Légendaire : trois nouvelles quêtes saisonnières.')}
        ${point('cards', 'La Collection repensée.', 'Classiques, Reverses et Spéciales, chacune sa page, et une jauge pour tout.')}
        ${point('user', 'Cadres, titres, profil.', `De nouveaux cadres à gagner, ${Object.keys(TITRES).length} titres à porter, une bannière et une devise sur ta fiche.`)}
        ${point('illu', 'Devine l\'illu.', 'Une illustration pixelisée par jour, la même pour tout le monde. Quatre essais.')}
        ${save.filleul ? '' : point('amis', 'Les invitations.', `Fais entrer un ami depuis la boutique : 2 000 ${MONNAIE.nom}, trois au maximum.`)}
        ${reflets ? point('reflets', 'L\'événement Reflets.', `Des quêtes en ${PRISMES.nom}, un Pass de vingt paliers et une boutique, pendant deux semaines.`) : ''}
      </ol>`,
    actions: reflets
      ? [{ label: 'Voir l\'événement', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); aller('reflets'); } },
         { label: 'Plus tard', fn: closeSheet }]
      : [{ label: 'C\'est parti', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); } }]
  });
}

/* ---------- La fin de la chasse ---------- */
/* Le jour où quelqu'un tire la carte unique, tous les autres l'apprennent par
   une annonce dans leur boîte (open_pack, supabase/03_rpc.sql) — et par cette
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
/* La 3.0, ce soir (8 novembre 2026) : une fenêtre, une fois par appareil,
   avant la sortie ; le bandeau de l'écran Boosters la rouvre. */
const HYPE30_CLE = 'mtcg.hype30';
const hype30AVoir = () => { try { return hype30Actif() && !localStorage.getItem(HYPE30_CLE); } catch (e) { return false; } };
function montrerHype30() {
  try { localStorage.setItem(HYPE30_CLE, '1'); } catch (e) { /* mode privé */ }
  const s = srvTime(PROCHAINE.sortie);
  const point = (ico, titre, texte) => `<li><span class="bvico">${NAVICO[ico] || NAVICO.promo}</span><span><b>${titre}</b> ${texte}</span></li>`;
  openSheet({
    title: '',
    body: `<div class="ech-annonce maj25 maj30">${echIllu(byId.c078, .62, .33, 'fond')}<span><small>Ce soir à minuit</small><b>Version ${h(PROCHAINE.version)}</b><span>Encore <b class="tnum" data-rebours="${s}">${h(dureeCourte(s - Date.now()))}</b></span></span></div>
      <ol class="bvpoints nvpoints">
        ${point('sword', 'Les combats.', 'Une Campagne de vingt rivaux, l\'Arcade, et le Versus entre amis.')}
        ${point('cards', 'Tes decks.', '40 cartes et 10 Essences, construits avec ta collection ; deux Starter Decks prêtés pour commencer.')}
        ${point('trophy', 'Le Raid.', 'Un boss pour tout le serveur, et des coffres pour tous ceux qui l\'affrontent.')}
        ${point('amis', 'Le Choc des Sections.', 'Toxique ou Déter : deux semaines d\'événement, et l\'Épreuve du jour.')}
        ${point('promo', 'La maîtrise et les Secrètes.', 'Fais monter tes cartes préférées, et cinq cartes Secrètes rejoignent la collection.')}
      </ol>
      <p class="muted small">Maintenance à 23 h 50 (heure de Paris) : le jeu revient à minuit, en version ${h(PROCHAINE.version)}.</p>`,
    actions: [{ label: 'J\'ai hâte', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); } }]
  });
}

function proposerAccueil() {
  if (accueilDejaPropose) return;
  if (hype30AVoir()) return quandCalme(montrerHype30);
  if (bienvenueAVoir()) return quandCalme(montrerBienvenue);
  if (chasseFinAVoir()) return quandCalme(montrerChasseFin);
  if (recapAVoir()) return quandCalme(montrerRecap);
  /* Version 2.5 : la fin de L'Échauffement, et ce qui continue. */
  if (echRecapAVoir()) return quandCalme(montrerEchRecap);
  /* Version 2.5 : ses nouveautés annoncent aussi L'Échauffement. */
  if (nouveautesAVoir()) return quandCalme(montrerNouveautes);
  /* L'Échauffement (js/echauffement.js) : annoncé une fois. */
  if (echAnnonceAVoir()) return quandCalme(montrerEchAnnonce);
  if (discordAVoir()) return quandCalme(montrerDiscord);
}
