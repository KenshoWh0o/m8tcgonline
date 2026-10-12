/* Version 3.0 : le Raid, toute l'année.

   The French Sorcerer, un boss commun à tout le serveur. Une seule règle à
   retenir : tout le monde le frappe ; quand sa barre est vide, chacun de
   ceux qui l'ont frappé ouvre un coffre, et il revient plus fort. Trois
   tentatives par jour.

   La même page sert dans l'onglet Combats (Combats › Raid) et, pendant le
   Choc des Sections, dans l'onglet de l'événement. Le combat se joue dans
   l'arène (js/combat/table.js), lancé par demarrer() (js/battle.js). Les
   chiffres sont dans js/combat/choc-data.js (RAID) ; ce qui compte se
   décide côté serveur (supabase/27_raid.sql). */
"use strict";

let rdEtat = null;
let rdErreur = '';
let rdCharge = 0;

async function chargerRaid() {
  if (Backend.mode !== 'cloud') return;
  rdCharge = Date.now();
  try {
    rdEtat = await Backend.raidEtat();
    rdErreur = '';
  } catch (e) {
    rdErreur = e.message || 'Le Raid n\'a pas pu être chargé.';
  }
  if ((tab === 'combats' || tab === 'choc') && !ecranOccupe()) render();
  else if (typeof majDiscrete === 'function') majDiscrete(false);
}
/* Relu au plus toutes les vingt secondes : la barre bouge avec le serveur. */
const relireRaid = () => { if (!rdEtat || Date.now() - rdCharge > 20000) chargerRaid(); };

const rdTentatives = () => (rdEtat ? Math.max(0, rdEtat.moi.max - rdEtat.moi.tentatives) : 0);
const rdCoffres = () => (rdEtat ? rdEtat.coffres.length : 0);
const rdEvenement = () => evenementEnCours() === 'choc';

/* La difficulté en étoiles : pleines et vides, sur cinq. */
const etoiles = n => `<span class="etoiles" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ICON.star}</i>`).join('')}</span>`;

/* La barre de vie commune. */
function vRaidBarre(r) {
  const reste = Math.max(0, r.pv - r.degats);
  return `<div class="rd-barre">
    <div class="rd-pv"><i style="width:${Math.round(1000 * reste / r.pv) / 10}%"></i></div>
    <div class="rd-pv-l"><b class="tnum">${fmtN(reste)}</b><span class="tnum">/ ${fmtN(r.pv)} PV</span><small>${r.joueurs} joueur${r.joueurs > 1 ? 's' : ''} sur ce niveau</small></div>
  </div>`;
}

/* La page. `titre` : faux dans l'onglet de l'événement, qui a son en-tête. */
function vRaid(titre) {
  if (Backend.mode !== 'cloud') return horsLigne('Le Raid');
  if (rdErreur) return vide('Raid indisponible', rdErreur);
  if (!rdEtat) { relireRaid(); return '<p class="muted boitecharge">Chargement du Raid…</p>'; }
  const r = rdEtat;
  const c = raidCombat(r.niveau);
  const k = byId[RAID.boss] || {};
  const tr = rdTentatives();
  const sec = cbEtat().section;
  const ev = rdEvenement();
  const gain = ev ? `${RAID.parDegat} ${CHOC.monnaie.nom}` : `${RAID.parDegatEclats} Éclats`;
  const coffres = r.coffres.map(x => `<div class="rd-coffre">
      <span class="rd-coffre-ico">${raidIco(x)}</span>
      <span><small>Niveau ${x.niveau} tombé</small><b>${h(x.titre)}</b></span>
      <button class="btn tiny" data-rd="coffre" data-v="${x.niveau}" data-snd="piece">Ouvrir</button>
    </div>`).join('');
  const pips = Array.from({ length: r.moi.max }, (_, i) => `<i class="${i < tr ? 'on' : ''}"></i>`).join('');
  return `<div class="rd">
    <section class="rd-hero">
      ${k.img ? `<span class="rd-hero-art" style="background-image:url('${h(k.img)}')" aria-hidden="true"></span>` : ''}
      <div class="rd-hero-t">
        ${titre !== false ? '<small>Raid · toute l\'année</small>' : ''}
        <h2>${h(RAID.nom)}</h2>
        <span class="rd-niv">Niveau <b class="tnum">${r.niveau}</b></span>
      </div>
    </section>
    ${vRaidBarre(r)}
    <p class="rd-regle">Tout le serveur le frappe. Quand sa barre est vide, chacun de ceux qui l'ont frappé ouvre un coffre, et il revient plus fort.</p>
    ${coffres ? `<section class="rd-coffres">${coffres}</section>` : ''}
    <section class="rd-go">
      <div class="rd-combat">
        <span class="rd-chip">IA ${etoiles(c.ia)}</span>
        <span class="rd-chip">${c.pvBoss} PV</span>
        ${c.ess ? `<span class="rd-chip">${c.ess} Essence${c.ess > 1 ? 's' : ''} d'avance</span>` : ''}
        <span class="rd-chip">Déjà sur le plateau</span>
      </div>
      ${sec ? vChoixDeck() : ''}
      <div class="rd-lancer">
        <span class="rd-pips" aria-label="${tr} tentative${tr > 1 ? 's' : ''} sur ${r.moi.max}">${pips}</span>
        ${sec ? `<button class="btn cb-lancer" data-rd="go" ${tr ? '' : 'disabled'}>${NAVICO.sword}${tr ? 'Affronter' : 'Reviens demain'}</button>`
          : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
      </div>
      <p class="muted small">Chaque PV pris : un dégât sur sa barre et ${gain}${ev ? ' (pendant l\'événement)' : ''}.</p>
    </section>
    ${vTopRaid(5)}
  </div>`;
}

/* Ceux qui frappent le plus, depuis toujours. */
function vTopRaid(n) {
  const top = ((rdEtat && rdEtat.top) || []).slice(0, n || 10);
  if (!top.length) return '';
  return `<section class="rd-top"><h3 class="rf-sous">Ceux qui frappent le plus</h3>
    <ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
      <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo, j.xp)}
      <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.section ? `<small class="ch-sec">${emblemeSection(j.section)}${h(SECTIONS[j.section].court)}</small>` : ''}</span>
      <span class="rf-pts tnum">${fmtN(j.degats)}<small class="muted">&nbsp;dégâts</small></span></li>`).join('')}</ol></section>`;
}

/* L'affiche du Raid, sur l'accueil des Combats : le boss, son niveau, sa
   barre, et ce qui attend. */
function vRaidAffiche() {
  const r = rdEtat;
  const k = byId[RAID.boss] || {};
  const tr = rdTentatives(), cf = rdCoffres();
  const reste = r ? Math.max(0, r.pv - r.degats) : 0;
  return `<button class="rd-affiche" data-cb="vue" data-v="raid">
    ${k.img ? `<span class="rd-affiche-art" style="background-image:url('${h(k.img)}')" aria-hidden="true"></span>` : ''}
    <span class="rd-affiche-t"><small>Raid · Niveau ${r ? r.niveau : '…'}</small><b>${h(RAID.nom)}</b>
      ${r ? `<span class="rd-pv mini"><i style="width:${Math.round(1000 * reste / r.pv) / 10}%"></i></span>` : ''}
      <em>${cf ? `${cf} coffre${cf > 1 ? 's' : ''} à ouvrir` : !r ? 'Un boss pour tout le serveur' : tr ? `${tr} tentative${tr > 1 ? 's' : ''} aujourd'hui` : 'Reviens demain'}</em></span>
    ${cf ? `<i class="rf-pastille">${cf}</i>` : ''}
    <span class="cb-une-go">${cf ? 'Ouvrir' : 'Affronter'}</span>
  </button>`;
}

/* L'icône d'un coffre : ce qu'il contient. */
function raidIco(x) {
  if (x.type === 'boosters') return `<img src="${ART.seal}" alt="">`;
  if (x.type === 'fragments') return NAVICO.fragment;
  if (x.type === 'eclats') return shardIco;
  return NAVICO.promo;
}

async function lancerRaid() {
  if (!rdEtat) return chargerRaid();
  if (!rdTentatives()) return toast('Plus de tentative aujourd\'hui : reviens demain.');
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (Combats, onglet Decks).');
  const r = rdEtat;
  const c = raidCombat(r.niveau);
  await demarrer({
    mode: 'raid', cle: String(r.niveau), niveau: c.ia, deck,
    deckIA: deckSorcier(r.jour, r.niveau), poses: posesBoss(), boss: true,
    adversaire: { nom: RAID.nom, avatar: 'card:' + RAID.boss, frame: 'f_foudre' },
    pv: c.pvBoss, ess: c.ess,
    cosmAdv: { tapis: 't_orage', sleeve: 's_base' },
    titre: `Raid · Niveau ${r.niveau}`, sousTitre: RAID.nom
  });
}

async function ouvrirCoffre(n) {
  const x = (rdEtat && rdEtat.coffres.find(c => c.niveau === n)) || raidCoffre(n);
  occupe(true);
  try {
    const cartes = (await Backend.raidReclamer(n)).map(id => byId[id]).filter(Boolean);
    rdEtat = await Backend.raidEtat();
    SFX.jouer('gagne');
    if (!RM()) FX.sparkle({ n: 90, colors: ['#b3a6ff', '#c8bfff', '#f5c451', '#fff'], size: 3.4 });
    const boosters = x.type === 'boosters';
    openSheet({
      title: `Coffre du niveau ${n}`,
      body: `<div class="rf-gain">
          ${cartes.length ? `<div class="rf-gaincartes">${cartes.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
            : `<span class="rf-gainico rd-gainico">${raidIco(x)}</span>`}
          <b>${h(x.titre)}</b>
          <p class="muted small">Le serveur a fait tomber ${h(RAID.nom)} au niveau ${n}. Ta part est sur ton compte.</p>
        </div>`,
      actions: boosters
        ? [{ label: 'Ouvrir maintenant', primary: true, fn: () => { closeSheet(); aller('boosters'); setTimeout(() => openBooster({ bonus: true }), 350); } },
           { label: 'Plus tard', fn: () => { closeSheet(); render(); } }]
        : [{ label: 'Super', primary: true, fn: () => { closeSheet(); render(); } }]
    });
  } catch (e) {
    toast(e.message || 'Le coffre n\'a pas pu être ouvert.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
  }
}

function raidAction(k, el) {
  if (k === 'go') return lancerRaid();
  if (k === 'coffre') return ouvrirCoffre(+el.dataset.v);
}
