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
   paliers personnels. Les six phases abattues, l'Infini : le boss revient
   plus fort, palier après palier, et ces paliers sont communs eux aussi,
   chacun avec son coffre pour tous (version 3.0.15 ; avant, un palier par
   joueur). Trois tentatives par jour.

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
/* Ce que la page combattra : la phase en cours, ou le palier Infini en
   cours — le même pour tout le serveur (3.0.15). */
const rdCle = (r = rdEtat) => (rdInfini(r) ? 'i' + (r.phase - NB_PHASES()) : 'p' + r.phase);
/* Le tronçon en cours : une phase, ou un palier Infini. `fait` : la part
   déjà prise ; `manque` : les dégâts qui restent avant qu'il tombe. Un
   serveur d'avant la 3.0.15 ne donne ni `depuis` ni `cible`. */
function rdNiveau(r = rdEtat) {
  const infini = rdInfini(r);
  const ph = infini ? null : r.phases[r.phase - 1];
  const depuis = r.depuis != null ? r.depuis : r.phase > 1 && r.phases[r.phase - 2] ? r.phases[r.phase - 2].seuil : 0;
  const cible = r.cible != null ? r.cible : ph ? ph.seuil : depuis + 1;
  const fait = Math.max(0, Math.min(1, (r.degats - depuis) / Math.max(1, cible - depuis)));
  return { infini, n: infini ? r.phase - NB_PHASES() : r.phase, depuis, cible, fait, manque: Math.max(0, cible - r.degats) };
}
/* Le coffre d'un palier Infini (le même à chaque palier). */
const rdCoffreInfini = r => (r && r.infini && r.infini.coffre) || RAID.infiniCoffre;
/* Les jours qui restent au raid. */
const rdJours = r => Math.max(1, Math.round((Date.parse(r.fin + 'T00:00:00') - Date.parse(r.jour + 'T00:00:00')) / 86400000));

/* Les coffres qu'on peut ouvrir, dans un raid (la vue de raid_etat) :
   communs (une phase abattue, si on a combattu) et personnels. */
function rdOuvrables(v) {
  if (!v || !v.moi || !v.moi.participe) return [];
  const l = [];
  const boss = rdBoss(v).id;
  v.phases.forEach(ph => { if (ph.tombee && !ph.pris) l.push({ saison: v.n, boss, quoi: 'commun', n: ph.n, titre: ph.commun.titre, type: ph.commun.type, bonus: ph.commun.bonus, dit: `Phase ${ph.n} abattue` }); });
  const ci = rdCoffreInfini(v);
  ((v.infini && v.infini.paliers) || []).forEach(pa => { if (!pa.pris) l.push({ saison: v.n, boss, quoi: 'commun', n: NB_PHASES() + pa.n, titre: ci.titre, type: ci.type, dit: `Infini, palier ${pa.n} abattu` }); });
  v.moi.perso.forEach(pa => { if (!pa.pris && v.moi.degats >= pa.seuil) l.push({ saison: v.n, boss, quoi: 'perso', n: pa.n, titre: pa.titre, type: pa.type, dit: `${fmtN(pa.seuil)} dégâts à toi` }); });
  return l;
}
const rdCoffresListe = () => (rdEtat ? rdOuvrables(rdEtat).concat(rdOuvrables(rdEtat.precedente)) : []);
const rdCoffres = () => rdCoffresListe().length;

/* La difficulté en étoiles : cinq places, pleines ou vides (Arcade,
   campagne, Raid). */
const ETOILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
const etoiles = n => `<span class="etoiles" role="img" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ETOILE}</i>`).join('')}</span>`;

/* La page du Raid, refaite en 3.0.16 (le propriétaire, 2 novembre : « fais
   une vraie review de l'écran du raid, prends du recul et critique, je le
   trouve encore bancal. rends le beau bordel et intuitif »). Ce qui n'allait
   pas : le bouton « Affronter » sous la ligne de flottaison (le boss prenait
   tout le premier écran) ; « Phase 4 » écrit trois fois, les dégâts qui
   manquent deux fois, les coffres personnels en piste puis en liste ; une
   barre de vie qui se lisait à l'envers, sans légende ; « Sans avance »,
   « Comme en partie », « Après ton 1er combat » ; trois écrans de long. Trois
   temps désormais, dans l'ordre où on s'en sert :
     - le boss et sa vie : la barre dit ce qu'elle est (« Vie du boss ») et
       ce qui manque, une fois ;
     - ton combat du jour : le boss et toi en deux lignes, ton deck, un seul
       bouton, visible sans défiler sur un téléphone ;
     - les coffres : ceux qui sont prêts d'abord, puis la piste commune (six
       médaillons et l'Infini) et la tienne ; le classement ; l'aide en trois
       lignes. */

/* Les dégâts que le serveur compte pour une victoire (raid_fin) : les PV
   de la phase (ceux du serveur), plus 1, plus le bonus. */
const rdDegatsVictoire = cle => {
  const n = Math.max(1, parseInt(String(cle).slice(1), 10) || 1);
  const pv = String(cle)[0] === 'i' ? RAID.infini(n).pvBoss : RAID.phases[Math.min(n, NB_PHASES()) - 1].pv;
  return pv + 1 + RAID.bonusDegats;
};
const ICO_INFINI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c-2-2.7-3.8-4-5.5-4a4 4 0 0 0 0 8c1.7 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.8 4 5.5 4a4 4 0 0 0 0-8c-1.7 0-3.5 1.3-5.5 4Z"/></svg>';
const rdS = n => (n > 1 ? 's' : '');

/* La vie du boss : six tronçons (les phases, chacun large des dégâts qu'il
   demande), ce qui reste en rouge, ce qui est pris en sombre ; dans
   l'Infini, le palier en cours. */
function vRaidVie(r) {
  const nv = rdNiveau(r);
  if (nv.infini) {
    return `<div class="rd-vie infini">
      <div class="rd-vie-t"><small>Vie du boss</small><b><span class="rd-inf">${ICO_INFINI}</span>Infini · palier ${nv.n}</b></div>
      <div class="rd-vie-barre" role="img" aria-label="${h(`Infini, palier ${nv.n} : encore ${nv.manque} dégâts`)}"><span class="rd-seg encours" style="flex:1"><i style="width:${((1 - nv.fait) * 100).toFixed(1)}%"></i></span></div>
      <p class="rd-vie-msg"><b class="tnum">${fmtN(nv.manque)}</b> dégât${rdS(nv.manque)} pour abattre ce palier</p>
    </div>`;
  }
  const lo = i => (i ? r.phases[i - 1].seuil : 0);
  const etat = ph => (ph.tombee ? 'tombe' : r.phase === ph.n ? 'encours' : 'plein');
  const seg = r.phases.map((ph, i) => {
    const reste = ph.tombee ? 0 : Math.max(0, Math.min(1, 1 - (r.degats - lo(i)) / (ph.seuil - lo(i))));
    return `<span class="rd-seg ${etat(ph)}" style="flex:${ph.seuil - lo(i)}"><i style="width:${(reste * 100).toFixed(1)}%"></i><em aria-hidden="true">${ph.tombee ? NAVICO.check : ph.n}</em></span>`;
  }).join('');
  return `<div class="rd-vie">
    <div class="rd-vie-t"><small>Vie du boss</small><b>Phase ${nv.n} <span>/ ${NB_PHASES()}</span></b></div>
    <div class="rd-vie-barre" role="img" aria-label="${h(`Phase ${nv.n} sur ${NB_PHASES()} : encore ${nv.manque} dégâts pour l'abattre`)}">${seg}</div>
    <p class="rd-vie-msg"><b class="tnum">${fmtN(nv.manque)}</b> dégât${rdS(nv.manque)} pour abattre la phase ${nv.n}</p>
  </div>`;
}

/* Le boss : son illustration, son nom, ce qu'il fait, sa vie. */
function vRaidHero(r) {
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const j = rdJours(r);
  return `<section class="rd-hero">
    <div class="rd-hero-img">
      ${k.img ? `<span class="rd-hero-art" aria-hidden="true">${illuCadre(k, b.visage[0], b.visage[1])}</span>` : ''}
      <div class="rd-hero-haut"><span class="rd-tag">Raid ${r.n}</span>${r.joueurs ? `<span class="rd-tag" title="${h(`${fmtN(r.degats)} dégâts en tout`)}">${NAVICO.amis}${r.joueurs} joueur${rdS(r.joueurs)}</span>` : ''}<span class="rd-tag rd-tag-j">${NAVICO.clock}${j} jour${rdS(j)}</span></div>
      <div class="rd-hero-nom"><h2>${h(b.nom)}</h2><p>${h(b.dit)}</p></div>
    </div>
    ${vRaidVie(r)}
  </section>`;
}

/* Ton combat du jour : le boss et toi en deux lignes, ton deck, un bouton. */
function vRaidCombat(r) {
  const nv = rdNiveau(r);
  const cle = rdCle(r);
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const c = raidCombat(cle, b.id);
  const tr = rdTentatives();
  const sec = cbEtat().section;
  const ev = rdEvenement();
  const pips = Array.from({ length: r.max }, (_, i) => `<i class="${i < tr ? 'on' : ''}"></i>`).join('');
  const monnaie = ev ? CHOC.monnaie.nom : 'Éclats';
  const parPv = ev ? RAID.parDegat : RAID.parDegatEclats;
  return `<section class="rd-combat">
    <div class="rd-combat-t"><h3>Ton combat du jour</h3>
      <span class="rd-tent" role="img" aria-label="${tr} combat${rdS(tr)} sur ${r.max} aujourd'hui"><span class="rd-pips">${pips}</span>${tr}/${r.max}</span></div>
    <div class="rd-duel">
      <div class="rd-duel-l boss">${k.img ? `<span class="rd-duel-av">${illuCadre(k, b.visage[0], b.visage[1], 1.6)}</span>` : ''}
        <span><b class="tnum"><span class="sr">${h(b.nom)} : </span>${c.pvBoss} PV</b><span class="sr">Difficulté</span>${etoiles(c.ia)}${c.ess ? `<small>${c.ess} Essence${rdS(c.ess)} d'avance</small>` : ''}</span></div>
      <span class="rd-duel-vs" aria-hidden="true">VS</span>
      <div class="rd-duel-l moi">${avatarHTML(save.avatar, save.frame, 'md', maPhoto())}
        <span><b class="tnum">${c.pvMoi} PV</b><small>Toi</small></span></div>
    </div>
    ${sec ? vChoixDeck() : ''}
    ${sec ? `<button class="btn cb-lancer" data-rd="go" ${tr ? '' : 'disabled'}>${tr ? 'Affronter' : 'Plus de combat aujourd\'hui : reviens demain'}</button>`
      : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
    <p class="rd-gain"><span>Chaque PV pris : <b>1 dégât pour tous</b>, ${parPv} ${monnaie} pour toi.</span><span>Le battre : <b>${rdDegatsVictoire(cle)} dégâts</b> et ${ev ? RAID.victoire : RAID.victoireEclats} ${monnaie}.</span></p>
  </section>`;
}

/* Les coffres : ceux qui attendent d'abord (de ce raid et du précédent),
   puis la piste commune — six médaillons et l'Infini — et la tienne. */
function vRaidCoffres(r) {
  const nv = rdNiveau(r);
  const prets = rdOuvrables(r).concat(rdOuvrables(r.precedente));
  const pret = x => `<li class="rd-pret"><span class="rd-pret-ico">${raidIco(x)}</span>
      <span><small>${x.saison !== r.n ? `Raid ${x.saison} · ` : ''}${h(x.dit)}</small><b>${h(x.titre)}${x.bonus ? ` <i class="rd-plus">${h(x.bonus.court || '')}</i>` : ''}</b></span>
      <button class="btn tiny" data-rd="coffre" data-s="${x.saison}" data-q="${x.quoi}" data-v="${x.n}" data-snd="piece">Ouvrir</button></li>`;
  /* La piste commune. */
  const ci = rdCoffreInfini(r);
  const med = (cls, ico, n, titre) => `<li class="rd-m ${cls}" title="${h(titre)}"><span class="rd-m-c">${ico}</span><em>${n}</em></li>`;
  const etatPh = ph => (ph.tombee ? (ph.pris || !r.moi.participe ? 'fait' : 'pret') : !nv.infini && r.phase === ph.n ? 'encours' : 'avenir');
  const meds = r.phases.map(ph => med(etatPh(ph) + (ph.n === NB_PHASES() ? ' final' : ''), raidIco(ph.commun), ph.n, `Phase ${ph.n} : ${ph.commun.titre}`)).join('')
    + med(nv.infini ? 'encours infini' : 'avenir infini', ICO_INFINI, nv.infini ? nv.n : '∞', `L'Infini : ${ci.titre} à chaque palier`);
  const prochain = nv.infini
    ? `<b>${h(ci.titre)}</b> pour tous au palier ${nv.n} · encore <b class="tnum">${fmtN(nv.manque)}</b>`
    : (() => { const ph = r.phases[nv.n - 1]; return `<b>${h(ph.commun.titre)}</b>${ph.commun.bonus ? ` et ${h(ph.commun.bonus.titre)}` : ''} pour tous à la phase ${nv.n} · encore <b class="tnum">${fmtN(nv.manque)}</b>`; })();
  /* La piste personnelle. */
  const m = r.moi;
  const max = RAID.perso[RAID.perso.length - 1].seuil;
  const pos = x => Math.min(100, (100 * x) / max);
  const suivant = m.perso.find(pa => m.degats < pa.seuil);
  const marques = m.perso.map(pa => `<span class="rd-pm ${pa.pris ? 'fait' : m.degats >= pa.seuil ? 'pret' : ''}" style="left:${pos(pa.seuil).toFixed(1)}%" title="${h(`${fmtN(pa.seuil)} dégâts : ${pa.titre}`)}">${raidIco(pa)}</span>`).join('');
  return `<section class="rd-cof">
    <div class="rd-sec-t"><h3>Les coffres</h3><small>Une phase abattue ouvre un coffre à chacun de ceux qui ont combattu.</small></div>
    ${prets.length ? `<ol class="rd-prets">${prets.map(pret).join('')}</ol>` : ''}
    <ol class="rd-piste-c" aria-label="Les coffres communs" style="--p:${((nv.infini ? NB_PHASES() : nv.n - 1) / NB_PHASES()).toFixed(3)}">${meds}</ol>
    <p class="rd-prochain">${prochain}</p>
    <div class="rd-moi">
      <div class="rd-moi-t"><b>Les tiens</b><span><b class="tnum">${fmtN(m.degats)}</b> dégât${rdS(m.degats)}${m.victoires ? ` · ${m.victoires} victoire${rdS(m.victoires)}` : ''}${m.degats > 0 && r.rang ? ` · ${r.rang}<sup>e</sup>` : ''}</span></div>
      <div class="rd-piste" role="img" aria-label="${m.degats} dégâts sur ${max}"><span class="rd-piste-f" style="width:${pos(m.degats).toFixed(1)}%"></span>${marques}</div>
      <p class="rd-prochain">${suivant ? `Prochain : <b>${h(suivant.titre)}</b> à ${fmtN(suivant.seuil)} dégâts · encore <b class="tnum">${fmtN(suivant.seuil - m.degats)}</b>` : 'Tes trois coffres sont gagnés.'}</p>
    </div>
  </section>`;
}

/* La page. */
function vRaid() {
  if (Backend.mode !== 'cloud') return horsLigne('Le Raid');
  if (rdErreur) return vide('Raid indisponible', rdErreur);
  if (!rdEtat) { relireRaid(); return '<p class="muted boitecharge">Chargement du Raid…</p>'; }
  const r = rdEtat;
  return `<div class="rd">
    ${vRaidHero(r)}
    ${vRaidCombat(r)}
    ${vRaidCoffres(r)}
    ${vTopRaid(5)}
    <details class="rd-aide" data-garde="rd-aide"${r.moi.participe ? '' : ' open'}>
      <summary>Comment ça marche</summary>
      <ul>
        <li>Tout le serveur frappe le même boss, pendant deux semaines : trois combats par jour chacun.</li>
        <li>Chaque PV que tu lui prends compte pour tous. Une phase abattue ouvre un coffre à chacun de ceux qui ont combattu ; la sixième donne une Légendaire et le titre « ${h(TITRES.t_heros_raid.nom)} ».</li>
        <li>Ensuite, l'Infini : des paliers communs, un coffre à chacun. Le Raid ne compte pas dans ton bilan de victoires.</li>
      </ul>
    </details>
  </div>`;
}

/* Le classement du raid : les dégâts de chacun ; toi en bas si tu n'es pas
   dans les premiers. En lignes serrées sur la page du Raid ; `enListe` :
   la liste seule, comme celle des Étincelles (le classement du Choc). */
function vTopRaid(n, enListe) {
  const r = rdEtat;
  if (!r) return '';
  const tous = r.top || [];
  const top = tous.slice(0, n || 10);
  if (!top.length) return '';
  const moi = !top.some(j => j.moi) && r.moi && r.moi.degats > 0 && r.rang ? { moi: true, pseudo: save.pseudo || 'Toi', avatar: save.avatar, frame: save.frame, photo: maPhoto(), degats: r.moi.degats, rang: r.rang } : null;
  const l = moi ? top.map((j, i) => [j, i + 1]).concat([[moi, moi.rang]]) : top.map((j, i) => [j, i + 1]);
  if (enListe) {
    return `<ol class="rf-top">${l.map(([j, rang]) => `<li class="${j.moi ? 'moi' : ''}">
        <span class="rf-rang r${rang}">${rang}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo)}
        <span class="rf-joueur"><b>${h(j.pseudo)}</b></span>
        <span class="rf-pts tnum">${fmtN(j.degats)}<small> dégâts</small></span></li>`).join('')}</ol>`;
  }
  const ligne = ([j, rang]) => `<li class="${j.moi ? 'moi' : ''}"><span class="rd-cl-r r${rang}">${rang}</span>${avatarHTML(j.avatar, j.frame, 'sm', j.photo)}
      <b>${h(j.pseudo)}</b><span class="tnum">${fmtN(j.degats)}<small> dégâts</small></span></li>`;
  return `<section class="rd-top"><div class="rd-sec-t"><h3>Classement</h3></div>
    <ol class="rd-cl">${l.map(ligne).join('')}</ol></section>`;
}

/* L'affiche du Raid, à la une de l'accueil des Combats : le boss, la phase
   (ou le palier Infini) en cours et sa barre, et ce qui attend. */
function vRaidAffiche() {
  const r = rdEtat;
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const tr = rdTentatives(), cf = rdCoffres();
  const nv = r ? rdNiveau(r) : null;
  return `<button class="rd-affiche" data-cb="vue" data-v="raid">
    ${k.img ? `<span class="rd-affiche-art">${illuCadre(k, b.visage[0], b.visage[1], 1.15)}</span>` : ''}
    <span class="rd-affiche-t"><small>${r ? `Raid ${r.n}` : 'Le Raid'}</small><b>${h(b.nom)}</b>
      ${nv ? `<span class="rd-affiche-ph">${nv.infini ? `Infini · palier ${nv.n}` : `Phase ${nv.n} sur ${NB_PHASES()}`}</span>
        <span class="rd-pv mini${nv.infini ? ' infini' : ''}"><i style="width:${Math.round((1 - nv.fait) * 100)}%"></i></span>` : ''}
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
      title: quoi === 'commun' ? (n > NB_PHASES() ? `Coffre de l'Infini, palier ${n - NB_PHASES()}` : `Coffre de la phase ${n}`) : 'Coffre personnel',
      body: `<div class="rf-gain">
          ${cartes.length ? `<div class="rf-gaincartes">${cartes.map(c => `<button data-show="${c.id}">${renderCard(c)}</button>`).join('')}</div>`
            : `<span class="rf-gainico rd-gainico">${raidIco(x)}</span>`}
          <b>${h(x.titre)}${x.bonus ? ` et ${h(x.bonus.titre)}` : ''}</b>
          <p class="muted small">${quoi === 'commun' ? `Le serveur a abattu ${n > NB_PHASES() ? `le palier Infini ${n - NB_PHASES()}` : `la phase ${n}`} de ${h(raidBoss(x.boss || RAID.boss).nom)}. Ta part est sur ton compte${x.bonus && x.bonus.type === 'titre' ? ', et le titre se choisit dans ton profil' : ''}.` : 'Tes propres dégâts du raid. C\'est sur ton compte.'}${x.type === 'legendaire' && !cartes.length ? ' Tu avais déjà toutes les Légendaires : à la place, 4 000 Fragments.' : ''}</p>
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
}
