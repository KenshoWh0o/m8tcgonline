/* Version 3.0 : le Raid.

   Un boss commun à tout le serveur, pour deux semaines : un « raid » (une
   « saison » côté serveur). Depuis la version 3.0.11, le raid 1 commence
   avec le Choc des Sections (The French Sorcerer), le raid 2 quatorze jours
   plus tard (Le Marionnettiste ; depuis la 3.0.13, le lendemain de la fin
   du Choc), puis les deux alternent : le serveur dit lequel (raid_etat ›
   boss), RAID.bosses dit tout le reste. La page ne nomme jamais le boss
   suivant avant son arrivée (le propriétaire, 1er novembre 2026 : « juste
   le fait que les raids sont périodiques »). Chaque raid a
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
  if ((tab === 'combats' || tab === 'choc' || tab === 'quetes') && !ecranOccupe()) render();
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
  v.phases.forEach(ph => { if (ph.tombee && !ph.pris) l.push({ saison: v.n, boss, quoi: 'commun', n: ph.n, titre: ph.commun.titre, type: ph.commun.type, bonus: ph.commun.bonus, dit: `Phase ${ph.n} abattue` }); });
  v.moi.perso.forEach(pa => { if (!pa.pris && v.moi.degats >= pa.seuil) l.push({ saison: v.n, boss, quoi: 'perso', n: pa.n, titre: pa.titre, type: pa.type, dit: `${fmtN(pa.seuil)} dégâts à toi` }); });
  return l;
}
const rdCoffresListe = () => (rdEtat ? rdOuvrables(rdEtat).concat(rdOuvrables(rdEtat.precedente)) : []);
const rdCoffres = () => rdCoffresListe().length;

/* La difficulté en étoiles : cinq places, pleines ou vides (Arcade,
   campagne, Raid). */
const ETOILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
const etoiles = n => `<span class="etoiles" role="img" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ETOILE}</i>`).join('')}</span>`;

/* La page du Raid, refaite en 3.0.14 (le propriétaire : « assez peu clair
   et fait très vibe coded »). Trois blocs, chacun une question :
     - le boss, et sa vie : une seule barre, découpée en ses six phases
       (chaque tronçon a la largeur des dégâts qu'il demande) ; ce qui reste
       au boss est en corail, ce que le serveur lui a pris est vide ;
     - les coffres : une tuile par phase — la récompense, et son état
       (ouvert, à ouvrir, à ouvrir après un premier combat, en cours, à
       venir) ; la dernière se distingue ;
     - ton combat : le boss face à toi, en clair (ses PV, son avance, son
       niveau ; tes PV, ton deck), tes tentatives du jour, ce que rapporte
       un PV pris.
   Puis tes dégâts et tes trois paliers, le classement, l'aide. */

/* Les dégâts que le serveur compte pour une victoire (raid_fin) : les PV
   de la phase (ceux du serveur), plus 1, plus le bonus. */
const rdDegatsVictoire = cle => {
  const n = Math.max(1, parseInt(String(cle).slice(1), 10) || 1);
  const pv = String(cle)[0] === 'i' ? Math.min(12, 9 + n) : RAID.phases[Math.min(n, NB_PHASES()) - 1].pv;
  return pv + 1 + RAID.bonusDegats;
};

/* La vie du boss : six tronçons, chacun large des dégâts qu'il demande. */
function vRaidVie(r) {
  const infini = rdInfini(r);
  const seg = r.phases.map((ph, i) => {
    const lo = i ? r.phases[i - 1].seuil : 0;
    const reste = infini || ph.tombee ? 0 : Math.max(0, Math.min(1, 1 - (r.degats - lo) / (ph.seuil - lo)));
    const etat = ph.tombee || infini ? 'tombe' : r.phase === ph.n ? 'encours' : 'plein';
    return `<span class="rd-seg ${etat}" style="flex:${ph.seuil - lo}"><i style="width:${(reste * 100).toFixed(1)}%"></i><em>${ph.n}</em></span>`;
  }).join('');
  const ph = infini ? null : r.phases[r.phase - 1];
  const manque = ph ? Math.max(0, ph.seuil - r.degats) : 0;
  const lab = infini ? 'Les six phases sont abattues' : `Phase ${r.phase} sur ${NB_PHASES()} : encore ${manque} dégâts pour la faire tomber`;
  return `<div class="rd-vie${infini ? ' abattu' : ''}">
    <div class="rd-vie-barre" role="img" aria-label="${h(lab)}">${seg}</div>
    <div class="rd-vie-l">${infini ? '<b>Abattu</b><span>le mode Infini est ouvert jusqu\'à la fin du raid</span>'
      : `<b>Phase ${r.phase} <small>sur ${NB_PHASES()}</small></b><span>encore <b class="tnum">${fmtN(manque)}</b> dégât${manque > 1 ? 's' : ''} pour la faire tomber</span>`}</div>
  </div>`;
}

/* Les coffres des six phases. */
function vRaidCoffres(r) {
  const tuiles = r.phases.map(ph => {
    const c = ph.commun;
    const fin = ph.n === NB_PHASES();
    let etat, pied;
    if (ph.tombee && ph.pris) { etat = 'ouvert'; pied = `<small class="rd-c-et">${NAVICO.check} Ouvert</small>`; }
    else if (ph.tombee && r.moi.participe) { etat = 'pret'; pied = `<button class="btn tiny" data-rd="coffre" data-s="${r.n}" data-q="commun" data-v="${ph.n}" data-snd="piece">Ouvrir</button>`; }
    else if (ph.tombee) { etat = 'attend'; pied = '<small class="rd-c-et">Combats une fois pour l\'ouvrir</small>'; }
    else if (r.phase === ph.n) { etat = 'encours'; pied = '<small class="rd-c-et">En cours</small>'; }
    else { etat = 'verrou'; pied = `<small class="rd-c-et">${NAVICO.lock} À venir</small>`; }
    return `<li class="rd-c ${etat}${fin ? ' final' : ''}">
      <span class="rd-c-n">Phase ${ph.n}</span>
      <span class="rd-c-ico">${raidIco(c)}${c.bonus ? `<i class="rd-c-plus">${raidIco(c.bonus)}</i>` : ''}</span>
      <b>${h(c.titre)}</b>${c.bonus ? `<small class="rd-c-bonus">${h(c.bonus.court || '')}</small>` : ''}
      ${pied}
    </li>`;
  }).join('');
  return `<section class="rd-cof">
    <div class="rd-sec-t"><h3>Les coffres</h3><small>Une phase tombe : un coffre pour chaque joueur qui a combattu dans ce raid${r.joueurs ? ` (${r.joueurs} jusqu'ici)` : ''}.</small></div>
    <ol class="rd-cof-l">${tuiles}</ol>
  </section>`;
}

/* Ton combat : le boss face à toi. */
function vRaidCombat(r) {
  const infini = rdInfini(r);
  const cle = rdCle(r);
  const b = rdBoss(r);
  const c = raidCombat(cle, b.id);
  const tr = rdTentatives();
  const sec = cbEtat().section;
  const ev = rdEvenement();
  const pips = Array.from({ length: r.max }, (_, i) => `<i class="${i < tr ? 'on' : ''}"></i>`).join('');
  const monnaie = ev ? CHOC.monnaie.nom : 'Éclats';
  const parPv = ev ? RAID.parDegat : RAID.parDegatEclats;
  return `<section class="rd-go">
    <div class="rd-go-t"><b>${infini ? `Infini · palier ${c.n}` : `Phase ${c.n} · à toi`}</b>
      <span class="rd-tent" role="img" aria-label="${tr} tentative${tr > 1 ? 's' : ''} sur ${r.max} aujourd'hui"><span class="rd-pips">${pips}</span>${tr} sur ${r.max} aujourd'hui</span></div>
    <div class="rd-duel">
      <div class="rd-duel-c boss"><small>${h(b.nom)}</small><b class="tnum">${c.pvBoss} <span>PV</span></b>
        <span>${c.ess ? `${c.ess} Essence${c.ess > 1 ? 's' : ''} d'avance` : 'Aucune Essence d\'avance'}</span><span class="rd-niv">${etoiles(c.ia)}</span></div>
      <span class="rd-duel-vs" aria-hidden="true">VS</span>
      <div class="rd-duel-c moi"><small>Toi</small><b class="tnum">${c.pvMoi} <span>PV</span></b>
        <span>${c.pvMoi < Combat.REGLE.PV ? `${Combat.REGLE.PV - c.pvMoi} PV de moins qu'en partie normale` : 'Comme en partie normale'}</span></div>
    </div>
    ${sec ? vChoixDeck() : ''}
    ${sec ? `<button class="btn cb-lancer" data-rd="go" ${tr ? '' : 'disabled'}>${tr ? 'Affronter' : 'Plus de tentative : reviens demain'}</button>`
      : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
    <p class="rd-gain">${infini
      ? `Une victoire fait monter ton palier, et rapporte ${rdDegatsVictoire(cle) * parPv + RAID.victoireEclats} ${monnaie}.`
      : `Chaque PV pris : <b>1 dégât</b> pour le serveur et <b>${parPv} ${monnaie}</b>. Le faire tomber : <b>${rdDegatsVictoire(cle)} dégâts</b> et ${RAID.victoireEclats} ${monnaie} de plus.`}</p>
  </section>`;
}

/* Tes dégâts, et tes trois paliers. */
function vRaidMoi(r) {
  const m = r.moi;
  const max = RAID.perso[RAID.perso.length - 1].seuil;
  const pal = m.perso.map(pa => {
    const ok = m.degats >= pa.seuil;
    const pied = pa.pris ? `<small class="rd-c-et">${NAVICO.check} Ouvert</small>`
      : ok ? `<button class="btn tiny" data-rd="coffre" data-s="${r.n}" data-q="perso" data-v="${pa.n}" data-snd="piece">Ouvrir</button>`
        : `<small class="rd-c-et tnum">encore ${fmtN(pa.seuil - m.degats)}</small>`;
    return `<li class="rd-p${pa.pris ? ' ouvert' : ok ? ' pret' : ''}"><span class="rd-c-n tnum">${fmtN(pa.seuil)} dégâts</span>
      <span class="rd-c-ico">${raidIco(pa)}</span><b>${h(pa.titre)}</b>${pied}</li>`;
  }).join('');
  return `<section class="rd-moi">
    <div class="rd-sec-t"><h3>Ton raid</h3><small class="tnum">${fmtN(m.degats)} dégât${m.degats > 1 ? 's' : ''} · ${m.victoires} victoire${m.victoires > 1 ? 's' : ''}${m.infini ? ` · Infini, palier ${m.infini}` : ''}</small></div>
    <span class="rd-moi-barre"><i style="width:${Math.min(100, Math.round(100 * m.degats / max))}%"></i></span>
    <ol class="rd-moi-l">${pal}</ol>
  </section>`;
}

/* La page. */
function vRaid() {
  if (Backend.mode !== 'cloud') return horsLigne('Le Raid');
  if (rdErreur) return vide('Raid indisponible', rdErreur);
  if (!rdEtat) { relireRaid(); return '<p class="muted boitecharge">Chargement du Raid…</p>'; }
  const r = rdEtat;
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const j = rdJours(r);
  /* Les coffres du raid précédent, encore à ouvrir. */
  const avant = rdOuvrables(r.precedente).map(x => `<div class="rd-coffre">
      <span class="rd-coffre-ico">${raidIco(x)}</span>
      <span><small>Raid ${x.saison} · ${h(x.dit)}</small><b>${h(x.titre)}</b></span>
      <button class="btn tiny" data-rd="coffre" data-s="${x.saison}" data-q="${x.quoi}" data-v="${x.n}" data-snd="piece">Ouvrir</button>
    </div>`).join('');
  return `<div class="rd">
    ${avant ? `<section class="rd-coffres"><div class="rd-sec-t"><h3>Le raid précédent</h3><small>Ses coffres s'ouvrent jusqu'à la fin de celui-ci.</small></div>${avant}</section>` : ''}
    <section class="rd-boss">
      ${k.img ? `<span class="rd-boss-art" aria-hidden="true">${illuCadre(k, b.visage[0], b.visage[1])}</span>` : ''}
      <div class="rd-boss-haut"><span class="rd-tag">Raid ${r.n}</span><span class="rd-tag">${NAVICO.clock}${j} jour${j > 1 ? 's' : ''}</span></div>
      <div class="rd-boss-t"><h2>${h(b.nom)}</h2><p class="rd-dit">${h(b.dit)}</p></div>
      ${vRaidVie(r)}
    </section>
    ${vRaidCombat(r)}
    ${vRaidCoffres(r)}
    ${vRaidMoi(r)}
    ${vTopRaid(5)}
    <details class="rd-aide" data-garde="rd-aide"${r.moi.participe ? '' : ' open'}>
      <summary>Comment ça marche</summary>
      <ol>
        <li><b>Un raid dure deux semaines</b>, trois tentatives par jour. Puis un nouveau boss arrive, et tout recommence.</li>
        <li><b>Tout le serveur frappe le même boss.</b> Chaque PV que tu lui prends en combat lui retire un dégât de vie ; une victoire en retire plus. Quand sa vie passe une marque, une phase tombe et ouvre un coffre pour tous ceux qui ont combattu dans le raid, ne serait-ce qu'une fois.</li>
        <li><b>Chaque phase est plus dure que la précédente</b> : plus de PV, de l'avance en Essences, un adversaire plus fort. La dernière demande tout le serveur, jusqu'au bout des deux semaines : son coffre donne une Légendaire qui te manque et le titre « ${h(TITRES.t_heros_raid.nom)} ».</li>
        <li><b>Tes dégâts comptent aussi pour toi :</b> trois paliers personnels, à ${RAID.perso.map(p => fmtN(p.seuil)).join(', ')} dégâts.</li>
        <li><b>Après la sixième phase</b>, le mode Infini : chaque victoire te fait monter d'un palier, contre un boss plus dur, avec son propre classement.</li>
      </ol>
    </details>
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
  return `<section class="rd-top"><div class="rd-top-tete"><div class="rd-sec-t"><h3>Classement du raid</h3><small>${vue === 'infini' ? 'Le palier Infini de chacun.' : 'Les dégâts de chacun dans ce raid.'}</small></div>
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
const ICO_LEGENDAIRE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="2.8" width="13" height="18.4" rx="2.4"/><path d="M12 7.6l1.3 2.7 2.9.4-2.1 2 .5 2.9L12 14.2l-2.6 1.4.5-2.9-2.1-2 2.9-.4Z"/></svg>';
function raidIco(x) {
  if (x.type === 'boosters') return `<img src="${ART.seal}" alt="">`;
  if (x.type === 'legendaire') return ICO_LEGENDAIRE;
  if (x.type === 'fragments') return NAVICO.fragment;
  if (x.type === 'eclats') return shardIco;
  if (x.type === 'titre') return NAVICO.trophy;
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
    mode: 'raid', cle, niveau: c.ia, deck, jour: r.jour, bossId: b.id, boss: true,
    adversaire: { nom: b.nom, avatar: 'card:' + b.id, frame: b.cadre },
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
          <b>${h(x.titre)}${x.bonus ? ` et ${h(x.bonus.titre)}` : ''}</b>
          <p class="muted small">${quoi === 'commun' ? `Le serveur a abattu la phase ${n} de ${h(raidBoss(x.boss || RAID.boss).nom)}. Ta part est sur ton compte${x.bonus && x.bonus.type === 'titre' ? ', et le titre se choisit dans ton profil' : ''}.` : 'Tes propres dégâts du raid. C\'est sur ton compte.'}${x.type === 'legendaire' && !cartes.length ? ' Tu avais déjà toutes les Légendaires : à la place, 4 000 Fragments.' : ''}</p>
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
