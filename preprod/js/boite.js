/* La boite de réception : tout ce qui arrive des autres, et du jeu lui-même.

   Demandes d'ami, demandes d'échange, réponses à ses propres demandes, et les
   annonces publiées pour tout le monde. C'est le serveur qui écrit chaque
   événement au moment où il a lieu (supabase/installation/11_boite.sql) : la page n'a rien
   à deviner, elle lit la boite et annonce ce qu'elle n'avait pas encore vu.

   ------------------------------------------------------------------------
   Pourquoi une cloche dans l'en-tête

   Ce qui arrive ne concerne pas un onglet en particulier : une annonce n'est
   pas « sociale », une réponse à un échange arrive pendant qu'on ouvre des
   paquets. L'en-tête est la seule bande visible sur tous les écrans, sur
   téléphone comme sur ordinateur — c'est là que tout le monde cherche une
   cloche.

   ------------------------------------------------------------------------
   Le ping

   Quand quelque chose arrive, trois signaux, du plus discret au plus visible :
     · la cloche prend une pastille, et le titre de l'onglet un « (2) » ;
     · deux notes courtes, et une vibration brève sur téléphone ;
     · une carte passe en haut de l'écran, avec le visage de celui qui écrit.
   Toucher la carte mène à l'endroit où l'on répond.

   Rien n'est annoncé pendant l'ouverture d'un paquet ou la scène d'une
   Promo : l'écran appartient aux cartes. Les nouveautés attendent la fin. */
"use strict";

/* Toutes les trente secondes, en plus du temps réel. Si le temps réel marche,
   cette relève ne trouve jamais rien ; s'il ne marche pas, c'est elle qui
   prévient. */
const BOITE_RELEVE = 30000;

/* Ce qui a déjà été annoncé pendant cette session. */
const boiteVus = new Set();
let boitePremiere = true;
/* La date de dernière lecture au moment où l'on est entré dans la boite : ce
   qui est plus récent reste surligné pendant qu'on lit, même une fois la boite
   marquée comme lue côté serveur. */
let boiteVueAvant = null;
let boiteMinuteur = null;
let boiteEnAttente = null;

const TEXTES_BOITE = {
  ami_demande:     ['veut t\'ajouter en ami', 'Demande d\'ami'],
  ami_accepte:     ['a accepté ta demande d\'ami', 'Nouvel ami'],
  echange_recu:    ['te propose un échange', 'Échange'],
  echange_accepte: ['a accepté ton échange', 'Échange conclu'],
  echange_refuse:  ['a refusé ton échange', 'Échange refusé'],
  /* Version 3.0 : les défis entre amis. */
  defi:            ['te défie en combat', 'Défi'],
  defi_accepte:    ['accepte ton défi', 'Défi accepté']
};

/* ---------- Ce qu'il y a dans la boite ---------- */
/* Les événements et les annonces, en une seule file, du plus récent au plus
   ancien. */
function boiteElements() {
  const b = Backend.boite;
  if (!b) return [];
  const annonces = (b.annonces || []).map(a => Object.assign({ type: 'annonce' }, a));
  return (b.items || []).concat(annonces)
    .sort((x, y) => Date.parse(y.quand) - Date.parse(x.quand));
}

const plusRecent = (x, iso) => !iso || Date.parse(x.quand) > Date.parse(iso);

/* Le nombre de nouveautés : ce que la boite dit si on l'a lue, sinon ce que
   le serveur a compté dans me(). */
function boiteNonLues() {
  if (Backend.mode !== 'cloud') return 0;
  if (!Backend.boite) return (save && save.boiteNonLues) || 0;
  return boiteElements().filter(x => plusRecent(x, Backend.boite.vue_le)).length;
}

/* ---------- Les signaux ---------- */
/* La cloche, le titre de l'onglet, et la pastille de l'icône installée. */
function majSignalBoite() {
  const n = boiteNonLues();
  document.title = (n ? `(${n}) ` : '') + GAME_NAME;
  try {
    if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
  } catch (e) { /* pas d'icône installée */ }

  const cl = $('#cloche');
  if (!cl) return;
  cl.hidden = Backend.mode !== 'cloud' || !porteOuverte();
  cl.classList.toggle('on', tab === 'boite');
  cl.innerHTML = NAVICO.bell + (n ? `<i class="pastille cloche">${n > 9 ? '9+' : n}</i>` : '');
  cl.setAttribute('aria-label', n ? `Boîte de réception, ${n} nouveauté${n > 1 ? 's' : ''}` : 'Boîte de réception');
}

/* La phrase d'un événement. */
function boiteTexte(x) {
  if (x.type === 'annonce') return [h(x.titre), 'Annonce'];
  const [dit, sous] = TEXTES_BOITE[x.type] || ['t\'a écrit', 'Nouveauté'];
  return [`<strong>${h(x.pseudo || 'Quelqu\'un')}</strong> ${dit}`, sous];
}

/* Toucher une nouveauté mène là où l'on y répond. */
function boiteAller(x) {
  if (x.type === 'annonce') return aller('boite');
  if (x.type === 'ami_demande' || x.type === 'ami_accepte') { socVue = 'amis'; return aller('social'); }
  if (x.type === 'defi' || x.type === 'defi_accepte') return allerCb('defis');
  socVue = 'echanges';
  trVue = x.type === 'echange_recu' ? 'recues' : 'historique';
  aller('social');
}

function notifBoite(x) {
  const pile = $('#qnotif');
  if (!pile) return;
  const [texte, sous] = boiteTexte(x);
  const froid = x.type === 'echange_refuse';

  const el = document.createElement('div');
  el.className = 'qn boiteqn' + (froid ? ' froid' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="qnav">${x.type === 'annonce'
      ? `<span class="qnico">${NAVICO.annonce}</span>`
      : avatarHTML(x.avatar, x.frame, 'sm', x.photo, x.xp)}</span>
    <span class="qntxt"><b>${texte}</b><small>${h(sous)}</small></span>`;
  pile.appendChild(el);

  const partir = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  setTimeout(partir, 5000);
  el.onclick = () => { partir(); boiteAller(x); };
}

/* Plusieurs nouveautés d'un coup : les trois plus récentes passent, le reste
   se résume. Au-delà, une pile de cartes qui défile ne se lit plus. */
function annoncer(nouveaux) {
  if (!nouveaux.length) return;
  SFX.jouer('notif');
  try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) { /* sans vibreur */ }
  nouveaux.slice(0, 3).forEach(notifBoite);
  if (nouveaux.length > 3) notifResume(nouveaux.length - 3, 'autres nouveautés');
}

/* Au retour dans le jeu : ce qui est arrivé pendant qu'on n'était pas là, en
   une seule carte. Sans son — la page vient de s'ouvrir, personne n'a frappé. */
function notifResume(n, quoi) {
  const pile = $('#qnotif');
  if (!pile) return;
  const el = document.createElement('div');
  el.className = 'qn boiteqn';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="qnico">${NAVICO.bell}</span>
    <span class="qntxt"><b>${n} ${quoi || (n > 1 ? 'nouveautés' : 'nouveauté')}</b>
      <small>Boîte de réception</small></span>`;
  pile.appendChild(el);
  const partir = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  setTimeout(partir, 5000);
  el.onclick = () => { partir(); aller('boite'); };
}

/* ---------- La relève ---------- */
/* Même onglet en arrière-plan, on relève : c'est là que le « (2) » du titre et
   la pastille de l'icône installée servent vraiment. Mais on ne sonne pas et
   on ne fait rien défiler devant un écran que personne ne regarde — ces
   nouveautés-là restent « pas encore annoncées », et partent au retour sur
   l'onglet (visibilitychange, js/app.js). */
async function releverBoite() {
  if (Backend.mode !== 'cloud' || !porteOuverte()) return;

  /* L'écran appartient aux cartes : on repasse dans quelques secondes. */
  if (!document.hidden && ecranOccupe()) {
    clearTimeout(boiteEnAttente);
    boiteEnAttente = setTimeout(releverBoite, 4000);
    return;
  }

  try { await Backend.loadBoite(); } catch (e) { return; }

  if (document.hidden) return majSignalBoite();

  const nouveaux = boiteElements().filter(x => !boiteVus.has(x.id));
  nouveaux.forEach(x => boiteVus.add(x.id));

  if (boitePremiere) {
    /* Le premier passage ne sonne pas : il fait l'inventaire. S'il reste des
       nouveautés jamais lues, une carte les résume. */
    boitePremiere = false;
    const n = boiteNonLues();
    if (n && tab !== 'boite') notifResume(n);
  } else if (nouveaux.length) {
    annoncer(nouveaux);
  }

  /* Une demande d'ami ou d'échange change aussi les listes de l'onglet Social
     et ses pastilles. */
  if (nouveaux.some(x => x.type !== 'annonce')) {
    await Promise.all([Backend.loadTrades(), Backend.loadAmis()]).catch(() => {});
  }

  /* On lit la boite pendant que ça arrive : c'est lu. */
  if (tab === 'boite' && boiteNonLues()) Backend.boiteLue().catch(() => {});

  majSignalBoite();
  majDiscrete(tab === 'boite' || (tab === 'social' && nouveaux.length > 0));
}

/* Branchée une fois, quand le jeu s'ouvre sur un compte en ligne. */
function demarrerBoite() {
  if (Backend.mode !== 'cloud' || boiteMinuteur) return;
  releverBoite();
  boiteMinuteur = setInterval(releverBoite, BOITE_RELEVE);
  /* Le temps réel peut envoyer plusieurs lignes d'affilée : on les regroupe. */
  let rafale = null;
  Backend.ecouterBoite(() => {
    clearTimeout(rafale);
    rafale = setTimeout(releverBoite, 600);
  });
}

/* ---------- La page ---------- */
async function ouvrirBoite() {
  try {
    if (!Backend.boite) await Backend.loadBoite();
    boiteElements().forEach(x => boiteVus.add(x.id));
    boitePremiere = false;
    boiteVueAvant = Backend.boite ? Backend.boite.vue_le : null;
    if (tab === 'boite') render();
    if (boiteNonLues()) await Backend.boiteLue();
  } catch (e) { /* la page reste lisible */ }
  majSignalBoite();
}

function vBoite() {
  if (Backend.mode !== 'cloud') return horsLigne('Boîte de réception');

  const tete = `<div class="pagehead"><div>
      <h1>Boîte de réception</h1>
      <p>Demandes d'ami, échanges et annonces.</p>
    </div></div>`;

  if (!Backend.boite) return tete + '<p class="muted boitecharge">Chargement…</p>';

  const tout = boiteElements();
  if (!tout.length) {
    return tete + vide('Rien de neuf', 'Les demandes d\'ami, les échanges et les annonces arrivent ici.');
  }

  const neufs = tout.filter(x => plusRecent(x, boiteVueAvant));
  const vus = tout.filter(x => !plusRecent(x, boiteVueAvant));
  const bloc = (titre, liste) => liste.length
    ? `<section class="boitesec"><h2>${titre}</h2>${liste.map(vMessage).join('')}</section>`
    : '';

  return tete + bloc('Nouveau', neufs) + bloc(neufs.length ? 'Plus tôt' : 'Déjà lu', vus);
}

/* Les deux cartes d'un échange, vues de chez soi : ce qui entre, ce qui sort. */
function boiteCartes(x) {
  const d = x.data || {};
  const recu = x.type === 'echange_recu';
  const entre = byId[recu ? d.offer : d.want];
  const sort = byId[recu ? d.want : d.offer];
  if (!entre || !sort) return '';
  return `<span class="bcartes">
    <button class="bcarte" data-show="${entre.id}" data-snd="carte" aria-label="Tu reçois ${h(entre.nom)}">${renderCard(entre)}</button>
    <i aria-hidden="true">${NAVICO.swap}</i>
    <button class="bcarte" data-show="${sort.id}" data-snd="carte" aria-label="Tu donnes ${h(sort.nom)}">${renderCard(sort)}</button>
  </span>`;
}

function vMessage(x) {
  const neuf = plusRecent(x, boiteVueAvant);

  if (x.type === 'annonce') {
    return `<article class="bmsg annonce${neuf ? ' neuf' : ''}">
      <span class="bico">${NAVICO.annonce}</span>
      <div class="bcorps">
        <p class="btxt"><b>${h(x.titre)}</b></p>
        ${x.texte ? `<p class="bannonce">${h(x.texte)}</p>` : ''}
        <time>${ilya(x.quand)}</time>
        ${save.isAdmin ? `<button class="linkbtn bretirer" data-annonce-off="${h(x.num)}">Retirer l'annonce</button>` : ''}
      </div>
    </article>`;
  }

  const [texte] = boiteTexte(x);
  const STATUT = { accepted: 'Conclu', declined: 'Refusé', cancelled: 'Annulé' };

  let pied = '';
  if (x.type === 'ami_demande' && x.en_attente) {
    pied = `<div class="bacts">
      <button class="btn tiny ghost" data-ami-non="${h(x.pseudo)}">Refuser</button>
      <button class="btn tiny" data-ami-ok="${h(x.pseudo)}">Accepter</button></div>`;
  } else if (x.type === 'echange_recu' && x.en_attente) {
    pied = `<div class="bacts"><button class="btn tiny" data-voirtroc="1">Répondre</button></div>`;
  } else if (x.type === 'echange_recu' && STATUT[x.statut]) {
    pied = `<span class="bstatut">${STATUT[x.statut]}</span>`;
  }

  return `<article class="bmsg${neuf ? ' neuf' : ''}">
    <button class="bava" data-fiche="${h(x.pseudo || '')}" aria-label="Profil de ${h(x.pseudo || '')}">
      ${avatarHTML(x.avatar, x.frame, 'sm', x.photo, x.xp)}</button>
    <div class="bcorps">
      <p class="btxt">${texte}</p>
      <time>${ilya(x.quand)}</time>
      ${x.type.startsWith('echange_') ? boiteCartes(x) : ''}
      ${pied}
    </div>
  </article>`;
}
