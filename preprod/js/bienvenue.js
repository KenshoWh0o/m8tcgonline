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
const NOUVEAUTES_VERSION = '1.5';

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
  const ch = save.chasse || {};
  const u = uniques[0];
  const maj = t => t.charAt(0).toUpperCase() + t.slice(1);
  const mienne = u && save.col[u.id] > 0;

  const chasse = mienne
    ? 'Tu l\'as tirée : elle est à toi, et il n\'en existera jamais d\'autre.'
    : ch.trouvee
      ? `<b>${h(ch.gagnant || 'Un joueur')}</b> l'a tirée. Il n'en existera jamais d'autre.`
      : ch.active
        ? 'Un seul exemplaire dans tout le jeu, caché dans un booster. La première personne qui le tire le garde pour toujours.'
        : ch.ouvre_le
          ? `Un seul exemplaire dans tout le jeu, caché dans un booster ${h(jourHeure(srvTime(ch.ouvre_le), 'à partir'))}. La première personne qui le tire le garde pour toujours.`
          : 'Un seul exemplaire dans tout le jeu. La chasse ouvre bientôt.';

  const point = (ico, titre, texte) => `<li><span class="bvico">${NAVICO[ico]}</span>
    <span><b>${titre}</b> ${texte}</span></li>`;

  openSheet({
    title: 'Version 1.5',
    body: `<div class="nvhero${ch.trouvee ? ' trouvee' : ''}">
        <div class="nvrayons" aria-hidden="true"></div>
        ${u ? `<div class="nvcarte">${renderCard(u)}</div>` : ''}
        <div class="nvtexte">
          <span class="nvkicker">${mienne ? 'À toi' : ch.trouvee ? 'Chasse terminée' : ch.active ? 'Chasse ouverte' : 'Bientôt'}</span>
          <b>${u ? h(u.nom) : 'La carte unique'}</b>
          <small>${chasse}</small>
        </div>
      </div>
      ${ev ? `<div class="nvevent">${NAVICO.star}<span><b>${h(ev.titre)}</b> — ${h(ev.texte || '')}
          <small>${h(ev.a_venir
            ? `${maj(jourHeure(srvTime(ev.debut), 'à partir'))}, ${jourHeure(srvTime(ev.fin), 'jusqu\'à')}.`
            : `${maj(jourHeure(srvTime(ev.fin), 'jusqu\'à'))}.`)}</small></span></div>` : ''}
      <ol class="bvpoints nvpoints">
        ${point('fragment', 'Les Fragments.', `Le recyclage donne désormais des ${FRAGMENTS.nom}, sans plafond. Avec eux, fabrique les cartes qui te manquent : touche une case vide dans ta Collection.`)}
        ${point('promo', 'Les Essences Brillantes.', `Une Essence sur ${FOIL_ODDS} sort dans sa version Brillante. Neuf à réunir.`)}
        ${point('trophy', 'Les succès.', `${SUCCES.length} succès à débloquer, sur ton profil et sur ta fiche.`)}
        ${point('clock', 'Mes tirages.', 'Tes trente derniers boosters, et un bouton pour partager un tirage en image.')}
      </ol>`,
    actions: [{ label: 'C\'est parti', primary: true, fn: () => { closeSheet(); SFX.jouer('gagne'); } }]
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
        s'échange pas. Tu la retrouves en bas de ta Collection.</p>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

/* Appelé après chaque rendu : c'est le moment où l'écran est posé. */
function proposerAccueil() {
  if (accueilDejaPropose) return;
  if (bienvenueAVoir()) return quandCalme(montrerBienvenue);
  if (chasseFinAVoir()) return quandCalme(montrerChasseFin);
  if (nouveautesAVoir()) return quandCalme(montrerNouveautes);
  if (discordAVoir()) return quandCalme(montrerDiscord);
}
