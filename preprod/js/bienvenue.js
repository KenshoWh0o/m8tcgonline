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
   aussi l'événement en cours, et se rouvre depuis son bandeau (js/booster.js).
   Changer NOUVEAUTES_VERSION la remontre à tout le monde. */
const NOUVEAUTES_VERSION = '3.0';

/* Un événement se signale aussi : une fois annoncé, une fois commencé — même
   à qui a déjà vu les nouveautés de la version. */
const cleEvenement = ev => (ev ? `${ev.titre}|${ev.debut}|${ev.a_venir ? 'avant' : 'pendant'}` : '');

function nouveautesAVoir() {
  if (Backend.mode !== 'cloud' || !save) return false;
  const m = accueilMemoire();
  return m.nouveautes !== NOUVEAUTES_VERSION
    || (!!save.evenement && m.evenement !== cleEvenement(save.evenement));
}

function montrerNouveautes() {
  const ev = save.evenement;
  accueilNoter({ nouveautes: NOUVEAUTES_VERSION, evenement: cleEvenement(ev) });
  /* Version 3.0 : les Combats. Les nouveautés de la 2.1 restent plus bas
     (montrerNouveautes21), pour le Labo. */
  if (NOUVEAUTES_VERSION === '3.0') return montrerNouveautes30();
  montrerNouveautes21();
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
          <small>${nbS || 'Cinq'} cartes cachées au-delà des 122. À toi de les trouver.</small>
        </div>
      </div>
      <div class="nvhero v3r">
        <div class="ch-ref-art" aria-hidden="true">${[[COUV.solo, -1], [COUV.versus, 0], [COUV.arcade, 1]].map(([id, i]) =>
          `<span class="ch-ref-tuile" style="--i:${i};--a:${Math.abs(i)}">${illuCadre(id, .5, .32)}</span>`).join('')}</div>
        <div class="nvtexte">
          <span class="nvkicker">Un nouveau visage</span>
          <b>La refonte visuelle</b>
          <small>Tout le site redessiné, en graphite et lavande : des tuiles pleines, les illustrations en grand, du verre qui flotte.</small>
        </div>
      </div>
      <ol class="bvpoints nvpoints">
        ${point('sword', 'Les Combats.', 'Solo contre l\'IA (une campagne de vingt rivaux, et l\'Arcade, cinq difficultés) et Versus en direct contre tes amis, 60 secondes par tour, dans une arène en plein écran. Pour commencer, un tutoriel : une partie guidée, bulle après bulle (et 200 Éclats la première fois).')}
        ${point('promo', 'Les Secrètes.', `${nbS || 'Cinq'} cartes cachées au-delà des 122, avec la finition la plus rare du jeu : un reflet irisé, et un cadre pour qui trouve la première. La Légendaire passe à 4,25 %.`)}
        ${point('foudre', 'Le Raid.', 'The French Sorcerer, un boss pour tout le serveur, par saisons de deux semaines. Six phases à abattre ensemble : chacune qui tombe ouvre un coffre pour tous ceux qui ont combattu, et tes dégâts paient aussi tes coffres à toi. La dernière abattue, place au mode Infini.')}
        ${point('niveau', 'Ton niveau de combattant.', 'Chaque combat rapporte de l\'XP, sans limite par jour. Chaque niveau paie, et certains donnent boosters, cadres et titres.')}
        ${point('fragment', 'La maîtrise des cartes.', 'Tes Fragments font monter une carte en cinq niveaux — Éclat, Liseré, Aura, Arène, Légende — et chacun change sa finition, en combat aussi. Seuls les exemplaires en trop sont pris. Et une carte fétiche, en grand en haut de ton profil.')}
        ${point('cards', 'Tes decks.', 'Un atelier pour en construire autant que tu veux, des codes pour les partager, et le Starter Deck de ta Section, prêté.')}
        ${point('user', 'Le cadre Secrète.', 'Le plus rare du jeu : le reflet irisé des Secrètes autour de ton avatar, pour qui trouve sa première. Et huit autres cadres : Arène (niveaux 10 à 50), Toxique et Déter, ceux de l\'événement ; ton profil montre où gagner chacun.')}
        ${point('shop', 'Tapis et sleeves.', 'Des tapis de jeu et des sleeves en boutique ; en combat, c\'est le tapis de celui qui joue qui s\'affiche.')}
        ${choc ? point('choc', 'Le Choc des Sections.', `L'Épreuve du jour, le Raid payé en Étincelles, un Pass de trente paliers et ses trois exclusifs — pendant trois semaines.`) : ''}
      </ol>`,
    actions: choc
      ? [{ label: 'Voir l\'événement', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); aller('choc'); } },
         { label: 'Aux Combats', fn: () => { closeSheet(); aller('combats'); } }]
      : [{ label: 'Aux Combats', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); aller('combats'); } },
         { label: 'Plus tard', fn: closeSheet }]
  });
}

/* Les nouveautés de la 2.1. */
function montrerNouveautes21() {
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
function proposerAccueil() {
  if (accueilDejaPropose) return;
  if (bienvenueAVoir()) return quandCalme(montrerBienvenue);
  if (chasseFinAVoir()) return quandCalme(montrerChasseFin);
  if (recapAVoir()) return quandCalme(montrerRecap);
  if (recapChocAVoir()) return quandCalme(montrerRecapChoc);
  if (nouveautesAVoir()) return quandCalme(montrerNouveautes);
  if (discordAVoir()) return quandCalme(montrerDiscord);
}
