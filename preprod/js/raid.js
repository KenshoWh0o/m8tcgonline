/* Version 3.0 : le Raid.

   Un boss commun à tout le serveur, pour deux semaines : un « raid » (une
   « saison » côté serveur). Depuis la version 3.0.11, le raid 1 commence
   avec le Choc des Sections (The French Sorcerer), le raid 2 quatorze jours
   plus tard (Le Marionnettiste), puis les deux alternent : le serveur dit
   lequel (raid_etat › boss), RAID.bosses dit tout le reste. Chaque raid a
   six phases : les dégâts de tous les joueurs s'additionnent, et chaque
   palier atteint abat une phase — tous ceux qui ont combattu dans le raid
   ouvrent son coffre commun. Les dégâts de chacun ouvrent aussi trois
   paliers personnels. Les six phases abattues, le mode Infini : un palier
   par joueur, qui monte à chaque victoire. Trois tentatives par jour.

   La même page sert dans l'onglet Combats (Combats › Raid) et, pendant le
   Choc des Sections, dans l'onglet de l'événement. Le combat se joue dans
   l'arène (js/combat/table.js), lancé par demarrer() (js/battle.js). Les
   chiffres sont dans js/combat/choc-data.js (RAID) ; ce qui compte se
   décide côté serveur (supabase/installation/27_raid.sql). */
"use strict";

/* Le boss d'un raid (la vue de raid_etat) : celui que le serveur dit ; un
   serveur d'avant la 3.0.11 ne dit rien, et c'était le Sorcier. Son
   `visage` : le point de son illustration que les affiches gardent au
   centre (illuCadre, js/ui.js). */
const rdBoss = (r = rdEtat) => raidBoss((r && r.boss) || RAID.boss);

let rdEtat = null;
let rdErreur = '';
let rdCharge = 0;
let rdTop = 'degats';

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

const NB_PHASES = () => RAID.phases.length;
const rdInfini = (r = rdEtat) => !!r && r.phase > NB_PHASES();
const rdTentatives = () => (rdEtat ? Math.max(0, rdEtat.max - rdEtat.tentatives) : 0);
const rdEvenement = () => evenementEnCours() === 'choc';
/* Ce que la page combattra : la phase en cours, ou son palier Infini. */
const rdCle = (r = rdEtat) => (rdInfini(r) ? 'i' + ((r.moi.infini || 0) + 1) : 'p' + r.phase);
/* Les jours qui restent au raid. */
const rdJours = r => Math.max(1, Math.round((Date.parse(r.fin + 'T00:00:00') - Date.parse(r.jour + 'T00:00:00')) / 86400000));

/* Les coffres qu'on peut ouvrir, dans un raid (la vue de raid_etat) :
   communs (une phase abattue, si on a combattu) et personnels. */
function rdOuvrables(v) {
  if (!v || !v.moi || !v.moi.participe) return [];
  const l = [];
  const boss = rdBoss(v).id;
  v.phases.forEach(ph => { if (ph.tombee && !ph.pris) l.push({ saison: v.n, boss, quoi: 'commun', n: ph.n, titre: ph.commun.titre, type: ph.commun.type, dit: `Phase ${ph.n} abattue` }); });
  v.moi.perso.forEach(pa => { if (!pa.pris && v.moi.degats >= pa.seuil) l.push({ saison: v.n, boss, quoi: 'perso', n: pa.n, titre: pa.titre, type: pa.type, dit: `${fmtN(pa.seuil)} dégâts à toi` }); });
  return l;
}
const rdCoffresListe = () => (rdEtat ? rdOuvrables(rdEtat).concat(rdOuvrables(rdEtat.precedente)) : []);
const rdCoffres = () => rdCoffresListe().length;

/* La difficulté en étoiles : cinq places, pleines ou vides (Arcade,
   campagne, Raid). */
const ETOILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
const etoiles = n => `<span class="etoiles" role="img" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ETOILE}</i>`).join('')}</span>`;

/* La piste des six phases : chaque tronçon se remplit avec les dégâts du
   serveur ; une phase abattue montre son coffre. */
function vRaidPiste(r) {
  const infini = rdInfini(r);
  const seg = r.phases.map((ph, i) => {
    const lo = i ? r.phases[i - 1].seuil : 0;
    const f = Math.max(0, Math.min(1, (r.degats - lo) / (ph.seuil - lo)));
    const etat = ph.tombee ? 'tombee' : r.phase === ph.n ? 'encours' : 'loin';
    return `<li class="rd-ph ${etat}">
      <span class="rd-ph-barre"><i style="width:${Math.round(f * 100)}%"></i></span>
      <span class="rd-ph-n">${ph.tombee ? NAVICO.check : ph.n}</span>
      <span class="rd-ph-coffre" title="${h(ph.commun.titre)}">${raidIco(ph.commun)}</span>
    </li>`;
  }).join('');
  const prochain = infini ? null : r.phases[r.phase - 1];
  return `<section class="rd-piste">
    <div class="rd-piste-tete"><b>${infini ? 'Les six phases sont abattues' : `Phase ${r.phase} sur ${NB_PHASES()}`}</b>
      <span class="tnum">${fmtN(r.degats)}${prochain ? ` / ${fmtN(prochain.seuil)}` : ''} <small>dégâts du serveur</small></span></div>
    <ol class="rd-phases">${seg}</ol>
    <p class="rd-piste-l">${infini ? 'Le mode Infini est ouvert jusqu\'à la fin du raid.'
      : `À ${fmtN(prochain.seuil)} dégâts, la phase ${prochain.n} tombe : <b>${h(prochain.commun.titre)}</b> pour tous ceux qui ont combattu dans ce raid.`}
      ${r.joueurs ? ` ${r.joueurs} joueur${r.joueurs > 1 ? 's' : ''} ont combattu.` : ''}</p>
  </section>`;
}

/* Tes paliers personnels : une barre, trois coffres. */
function vRaidPerso(r) {
  const max = RAID.perso[RAID.perso.length - 1].seuil;
  const m = r.moi;
  return `<section class="rd-perso">
    <div class="rd-piste-tete"><b>Ton raid</b><span class="tnum">${fmtN(m.degats)} <small>dégâts</small> · ${m.victoires} <small>victoire${m.victoires > 1 ? 's' : ''}</small>${m.infini ? ` · Infini <b>${m.infini}</b>` : ''}</span></div>
    <div class="rd-perso-barre"><i style="width:${Math.min(100, Math.round(100 * m.degats / max))}%"></i>
      ${m.perso.map(pa => `<span class="rd-perso-pal${m.degats >= pa.seuil ? ' ok' : ''}${pa.pris ? ' pris' : ''}" style="left:${100 * pa.seuil / max}%" title="${h(pa.titre)}">
        <i>${pa.pris ? NAVICO.check : raidIco(pa)}</i><small class="tnum">${fmtN(pa.seuil)}</small></span>`).join('')}
    </div>
  </section>`;
}

/* La page. */
function vRaid() {
  if (Backend.mode !== 'cloud') return horsLigne('Le Raid');
  if (rdErreur) return vide('Raid indisponible', rdErreur);
  if (!rdEtat) { relireRaid(); return '<p class="muted boitecharge">Chargement du Raid…</p>'; }
  const r = rdEtat;
  const infini = rdInfini(r);
  const cle = rdCle(r);
  const b = rdBoss(r);
  const c = raidCombat(cle, b.id);
  const k = byId[b.id] || {};
  const tr = rdTentatives();
  const sec = cbEtat().section;
  const ev = rdEvenement();
  const gain = ev ? `${RAID.parDegat} ${CHOC.monnaie.nom}` : `${RAID.parDegatEclats} Éclats`;
  const coffres = rdCoffresListe().map(x => `<div class="rd-coffre">
      <span class="rd-coffre-ico">${raidIco(x)}</span>
      <span><small>${x.saison !== r.n ? `Raid ${x.saison} · ` : ''}${h(x.dit)}</small><b>${h(x.titre)}</b></span>
      <button class="btn tiny" data-rd="coffre" data-s="${x.saison}" data-q="${x.quoi}" data-v="${x.n}" data-snd="piece">Ouvrir</button>
    </div>`).join('');
  const pips = Array.from({ length: r.max }, (_, i) => `<i class="${i < tr ? 'on' : ''}"></i>`).join('');
  return `<div class="rd">
    <section class="rd-hero">
      ${k.img ? `<span class="rd-hero-art" aria-hidden="true">${illuCadre(k, b.visage[0], b.visage[1])}</span>` : ''}
      <div class="rd-hero-t">
        <small>Raid ${r.n} · encore ${rdJours(r)} jour${rdJours(r) > 1 ? 's' : ''}</small>
        <h2>${h(b.nom)}</h2>
        <span class="rd-etat">${infini ? 'Mode Infini' : `Phase ${r.phase} sur ${NB_PHASES()}`}</span>
        <p class="rd-dit">${h(b.dit)}</p>
      </div>
    </section>
    ${vRaidPiste(r)}
    ${coffres ? `<section class="rd-coffres">${coffres}</section>` : ''}
    <section class="rd-go">
      <div class="rd-go-tete"><b>${infini ? `Infini · palier ${c.n}` : `Combattre la phase ${c.n}`}</b>
        <span class="rd-combat"><span class="rd-chip">IA ${etoiles(c.ia)}</span><span class="rd-chip">${c.pvBoss} PV</span>
        ${c.ess ? `<span class="rd-chip">${c.ess} Essence${c.ess > 1 ? 's' : ''} d'avance</span>` : ''}
        ${c.pvMoi < Combat.REGLE.PV ? `<span class="rd-chip rouge">Toi : ${c.pvMoi} PV</span>` : ''}</span></div>
      ${sec ? vChoixDeck() : ''}
      <div class="rd-lancer">
        <span class="rd-pips" aria-label="${tr} tentative${tr > 1 ? 's' : ''} sur ${r.max}">${pips}</span>
        ${sec ? `<button class="btn cb-lancer" data-rd="go" ${tr ? '' : 'disabled'}>${tr ? 'Affronter' : 'Reviens demain'}</button>`
          : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
      </div>
      <p class="muted small">Chaque PV que tu lui prends : un dégât, et ${gain}${ev ? ' pendant l\'événement' : ''}. Le faire tomber : tous ses PV, plus ${RAID.bonusDegats}.</p>
    </section>
    ${vRaidPerso(r)}
    <details class="rd-aide" data-garde="rd-aide"${r.moi.participe ? '' : ' open'}>
      <summary>Comment ça marche</summary>
      <ol>
        <li><b>Un raid dure deux semaines</b>, trois tentatives par jour. Puis un autre boss arrive — ${RAID.bosses.map(x => h(x.nom)).join(', puis ')}, à tour de rôle — et tout recommence.</li>
        <li><b>Tout le serveur frappe le même boss.</b> Chaque PV que tu lui prends s'ajoute aux dégâts de tous. À chaque palier, une phase tombe, et son coffre commun s'ouvre pour tous ceux qui ont combattu dans le raid — même une seule fois.</li>
        <li><b>Tes dégâts comptent aussi pour toi :</b> trois paliers personnels, à ${RAID.perso.map(p => fmtN(p.seuil)).join(', ')} dégâts.</li>
        <li><b>Les six phases abattues</b> (si vous y arrivez), le mode Infini : chaque victoire fait monter ton palier, et le boss se durcit. C'est le classement Infini.</li>
      </ol>
    </details>
    ${vTopRaid(5)}
  </div>`;
}

/* Le classement du raid : les dégâts, ou les paliers Infini. */
function vTopRaid(n) {
  const r = rdEtat;
  if (!r) return '';
  const infini = (r.top_infini || []).length > 0;
  const vue = infini && rdTop === 'infini' ? 'infini' : 'degats';
  const top = (vue === 'infini' ? r.top_infini : r.top || []).slice(0, n || 10);
  if (!top.length) return '';
  return `<section class="rd-top"><div class="rd-top-tete"><h3 class="rf-sous">Classement du raid</h3>
    ${infini ? `<span class="rd-top-seg"><button class="${vue === 'degats' ? 'on' : ''}" data-rd="top" data-v="degats">Dégâts</button><button class="${vue === 'infini' ? 'on' : ''}" data-rd="top" data-v="infini">Infini</button></span>` : ''}</div>
    <ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
      <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo, j.xp)}
      <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.section ? `<small class="ch-sec">${emblemeSection(j.section)}${h(SECTIONS[j.section].court)}</small>` : ''}</span>
      <span class="rf-pts tnum">${vue === 'infini' ? `<small class="muted">palier&nbsp;</small>${j.infini}` : `${fmtN(j.degats)}<small class="muted">&nbsp;dégâts</small>`}</span></li>`).join('')}</ol></section>`;
}

/* L'affiche du Raid, à la une de l'accueil des Combats : le boss, la phase
   en cours et sa barre, et ce qui attend. */
function vRaidAffiche() {
  const r = rdEtat;
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const tr = rdTentatives(), cf = rdCoffres();
  const infini = rdInfini(r);
  let f = 0;
  if (r && !infini) {
    const lo = r.phase > 1 ? r.phases[r.phase - 2].seuil : 0;
    f = Math.max(0, Math.min(1, (r.degats - lo) / (r.phases[r.phase - 1].seuil - lo)));
  }
  return `<button class="rd-affiche" data-cb="vue" data-v="raid">
    ${k.img ? `<span class="rd-affiche-art">${illuCadre(k, b.visage[0], b.visage[1], 1.15)}</span>` : ''}
    <span class="rd-affiche-t"><small>${r ? `Raid ${r.n}` : 'Le Raid'}</small><b>${h(b.nom)}</b>
      ${r ? `<span class="rd-affiche-ph">${infini ? 'Mode Infini' : `Phase ${r.phase} sur ${NB_PHASES()}`}</span>
        ${infini ? '' : `<span class="rd-pv mini"><i style="width:${Math.round(f * 100)}%"></i></span>`}` : ''}
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
  const b = rdBoss(r);
  const cle = rdCle(r);
  const c = raidCombat(cle, b.id);
  await demarrer({
    mode: 'raid', cle, niveau: c.ia, deck,
    deckIA: deckBoss(r.jour, cle, b.id), poses: posesBoss(b.id), boss: true,
    adversaire: { nom: b.nom, avatar: 'card:' + b.id, frame: b.cadre },
    pv: c.pvBoss, ess: c.ess, pvMoi: c.pvMoi,
    cosmAdv: { tapis: b.tapis, sleeve: 's_base' },
    titre: c.infini ? `Raid ${r.n} · Infini, palier ${c.n}` : `Raid ${r.n} · Phase ${c.n}`, sousTitre: b.nom
  });
}

async function ouvrirCoffre(saison, quoi, n) {
  const x = rdCoffresListe().find(c => c.saison === saison && c.quoi === quoi && c.n === n);
  if (!x) return;
  occupe(true);
  try {
    const cartes = (await Backend.raidReclamer(saison, quoi, n)).map(id => byId[id]).filter(Boolean);
    rdEtat = await Backend.raidEtat();
    SFX.jouer('gagne');
    if (!RM()) FX.sparkle({ n: 90, colors: ['#b3a6ff', '#c8bfff', '#f5c451', '#fff'], size: 3.4 });
    const boosters = x.type === 'boosters';
    openSheet({
      title: quoi === 'commun' ? `Coffre de la phase ${n}` : 'Coffre personnel',
      body: `<div class="rf-gain">
          ${cartes.length ? `<div class="rf-gaincartes">${cartes.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
            : `<span class="rf-gainico rd-gainico">${raidIco(x)}</span>`}
          <b>${h(x.titre)}</b>
          <p class="muted small">${quoi === 'commun' ? `Le serveur a abattu la phase ${n} de ${h(raidBoss(x.boss || RAID.boss).nom)}. Ta part est sur ton compte.` : 'Tes propres dégâts du raid. C\'est sur ton compte.'}</p>
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
  if (k === 'coffre') return ouvrirCoffre(+el.dataset.s, el.dataset.q, +el.dataset.v);
  if (k === 'top') { rdTop = el.dataset.v; return render(); }
}
