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

/* La page du Raid, refaite en 3.0.15 (le propriétaire : « un peu mieux,
   mais fait un peu cheapos […] c'est une nouveauté majeure, ça doit être à
   la hauteur » ; « rendre le système de raid assez simple et intuitif, le
   but est pas de se casser la tête »). Trois temps, dans cet ordre :
     - le boss : son illustration en grand, et la vie que tout le serveur
       lui prend — une barre découpée en ses six phases (chaque tronçon a la
       largeur des dégâts qu'il demande), puis, dans l'Infini, un palier à
       la fois ; et qui frappe avec toi ;
     - ton combat : le boss face à toi, tes tentatives, un seul bouton ;
     - le chemin du serveur : les six phases puis l'Infini, une étape par
       ligne — ce qu'elle donne à tous, et où on en est ; puis toi (tes
       dégâts, ton rang, tes trois coffres), le classement, l'aide en trois
       lignes. */

/* Les dégâts que le serveur compte pour une victoire (raid_fin) : les PV
   de la phase (ceux du serveur), plus 1, plus le bonus. */
const rdDegatsVictoire = cle => {
  const n = Math.max(1, parseInt(String(cle).slice(1), 10) || 1);
  const pv = String(cle)[0] === 'i' ? Math.min(12, 9 + n) : RAID.phases[Math.min(n, NB_PHASES()) - 1].pv;
  return pv + 1 + RAID.bonusDegats;
};
const ICO_INFINI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c-2-2.7-3.8-4-5.5-4a4 4 0 0 0 0 8c1.7 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.8 4 5.5 4a4 4 0 0 0 0-8c-1.7 0-3.5 1.3-5.5 4Z"/></svg>';

/* La vie du boss : six tronçons (les phases), ou le palier Infini en cours. */
function vRaidVie(r) {
  const nv = rdNiveau(r);
  if (nv.infini) {
    const lab = `Infini, palier ${nv.n} : encore ${nv.manque} dégâts pour le faire tomber`;
    return `<div class="rd-vie infini">
      <div class="rd-vie-t"><b><span class="rd-inf">${ICO_INFINI}</span>Infini · palier ${nv.n}</b><span><b class="tnum">${fmtN(nv.manque)}</b> dégât${nv.manque > 1 ? 's' : ''} avant le palier ${nv.n + 1}</span></div>
      <div class="rd-vie-barre" role="img" aria-label="${h(lab)}"><span class="rd-seg encours" style="flex:1"><i style="width:${((1 - nv.fait) * 100).toFixed(1)}%"></i></span></div>
      <p class="rd-vie-msg">Les six phases sont tombées. Le boss revient plus fort, palier après palier, pour tout le serveur.</p>
    </div>`;
  }
  const lo = i => (i ? r.phases[i - 1].seuil : 0);
  const etat = ph => (ph.tombee ? 'tombe' : r.phase === ph.n ? 'encours' : 'plein');
  const seg = r.phases.map((ph, i) => {
    const reste = ph.tombee ? 0 : Math.max(0, Math.min(1, 1 - (r.degats - lo(i)) / (ph.seuil - lo(i))));
    return `<span class="rd-seg ${etat(ph)}" style="flex:${ph.seuil - lo(i)}"><i style="width:${(reste * 100).toFixed(1)}%"></i></span>`;
  }).join('');
  const nums = r.phases.map((ph, i) => `<em class="${etat(ph)}" style="flex:${ph.seuil - lo(i)}">${ph.n}</em>`).join('');
  const apres = nv.n < NB_PHASES() ? `la phase ${nv.n + 1}` : 'l\'Infini';
  const lab = `Phase ${nv.n} sur ${NB_PHASES()} : encore ${nv.manque} dégâts avant ${apres}`;
  return `<div class="rd-vie">
    <div class="rd-vie-t"><b>Phase ${nv.n} <small>sur ${NB_PHASES()}</small></b><span><b class="tnum">${fmtN(nv.manque)}</b> dégât${nv.manque > 1 ? 's' : ''} avant ${apres}</span></div>
    <div class="rd-vie-barre" role="img" aria-label="${h(lab)}">${seg}</div>
    <div class="rd-vie-n" aria-hidden="true">${nums}</div>
  </div>`;
}

/* Le boss, sa vie, et le serveur qui frappe avec toi. */
function vRaidHero(r) {
  const b = rdBoss(r);
  const k = byId[b.id] || {};
  const j = rdJours(r);
  const avs = (r.top || []).slice(0, 5);
  return `<section class="rd-hero">
    ${k.img ? `<span class="rd-hero-art" aria-hidden="true">${illuCadre(k, b.visage[0], b.visage[1])}</span>` : ''}
    <div class="rd-hero-haut"><span class="rd-tag">Raid ${r.n}</span><span class="rd-tag">${NAVICO.clock}${j} jour${j > 1 ? 's' : ''}</span></div>
    <div class="rd-hero-bas">
      <h2>${h(b.nom)}</h2>
      <p class="rd-dit">${h(b.dit)}</p>
      ${vRaidVie(r)}
      <div class="rd-ens">${avs.length ? `<span class="rd-ens-av" aria-hidden="true">${avs.map(x => avatarHTML(x.avatar, x.frame, 'sm', x.photo)).join('')}</span>` : ''}
        <span><b class="tnum">${fmtN(r.degats)}</b> dégâts pris par le serveur${r.joueurs ? `, ${r.joueurs} joueur${r.joueurs > 1 ? 's' : ''}` : ''}</span></div>
    </div>
  </section>`;
}

/* Ton combat : le boss face à toi, un seul bouton. */
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
    <div class="rd-combat-t"><h3>${nv.infini ? `Infini · palier ${nv.n}` : `Phase ${nv.n}`}<small>Ton combat</small></h3>
      <span class="rd-tent" role="img" aria-label="${tr} tentative${tr > 1 ? 's' : ''} sur ${r.max} aujourd'hui"><span class="rd-pips">${pips}</span>${tr}/${r.max}</span></div>
    <div class="rd-face">
      <div class="rd-face-c boss">${k.img ? `<span class="rd-face-av">${illuCadre(k, b.visage[0], b.visage[1], 1.6)}</span>` : ''}
        <span><small>Le boss</small><b class="tnum">${c.pvBoss} PV</b><span class="rd-face-d">${c.ess ? `${c.ess} Essence${c.ess > 1 ? 's' : ''} d'avance` : 'Sans avance'}</span>${etoiles(c.ia)}</span></div>
      <span class="rd-face-vs" aria-hidden="true">VS</span>
      <div class="rd-face-c moi">${avatarHTML(save.avatar, save.frame, 'md', maPhoto())}
        <span><small>Toi</small><b class="tnum">${c.pvMoi} PV</b><span class="rd-face-d">${c.pvMoi < Combat.REGLE.PV ? `${Combat.REGLE.PV - c.pvMoi} de moins qu'en partie` : 'Comme en partie'}</span></span></div>
    </div>
    ${sec ? vChoixDeck() : ''}
    ${sec ? `<button class="btn cb-lancer" data-rd="go" ${tr ? '' : 'disabled'}>${tr ? 'Affronter' : 'Plus de tentative : reviens demain'}</button>`
      : '<button class="btn cb-lancer" data-tab="combats">Choisis d\'abord ta Section</button>'}
    <p class="rd-gain">Chaque PV pris : <b>1 dégât</b> pour tous, <b>${parPv} ${monnaie}</b> pour toi. Le faire tomber : <b>${rdDegatsVictoire(cle)} dégâts</b> et ${RAID.victoireEclats} ${monnaie} de plus.</p>
  </section>`;
}

/* Le chemin du serveur : les six phases, puis l'Infini — une étape par
   ligne, ce qu'elle donne à tous, et où on en est. */
function vRaidChemin(r) {
  const nv = rdNiveau(r);
  const part = r.moi.participe;
  const reste = () => `<small class="tnum">encore ${fmtN(nv.manque)}</small>`;
  const action = (tombee, pris, n) => (tombee && pris ? `<small class="rd-et-ok">${NAVICO.check}Ouvert</small>`
    : tombee && part ? `<button class="btn tiny" data-rd="coffre" data-s="${r.n}" data-q="commun" data-v="${n}" data-snd="piece">Ouvrir</button>`
    : tombee ? '<small class="rd-et-att">Après ton 1<sup>er</sup> combat</small>' : '');
  const etat = (tombee, pris) => (tombee ? (pris ? 'fait' : part ? 'pret' : 'attend') : '');
  const ligne = (cls, ico, num, titre, gain, act, p) => `<li class="rd-et ${cls}"${p != null ? ` style="--p:${Math.round(p * 100)}"` : ''}>
      <span class="rd-et-n"><i>${ico}</i>${num ? `<em>${num}</em>` : ''}</span>
      <span class="rd-et-t"><b>${titre}</b><small>${gain}</small></span>${act ? `<span class="rd-et-a">${act}</span>` : ''}</li>`;
  const l = r.phases.map(ph => {
    const c = ph.commun;
    const fin = ph.n === NB_PHASES();
    const enCours = !nv.infini && r.phase === ph.n;
    const cls = (etat(ph.tombee, ph.pris) || (enCours ? 'encours' : 'avenir')) + (fin ? ' final' : '');
    const gain = `${h(c.titre)}${c.bonus ? ` <i class="rd-et-plus">${h(c.bonus.court || '')}</i>` : ''}`;
    return ligne(cls, raidIco(c), ph.n, `Phase ${ph.n}`, gain, enCours ? reste() : action(ph.tombee, ph.pris, ph.n), enCours ? nv.fait : null);
  });
  const ci = rdCoffreInfini(r);
  ((r.infini && r.infini.paliers) || []).forEach(pa => {
    l.push(ligne(etat(true, pa.pris) + ' infini', ICO_INFINI, pa.n, `Infini · palier ${pa.n}`, h(ci.titre), action(true, pa.pris, NB_PHASES() + pa.n)));
  });
  l.push(nv.infini
    ? ligne('encours infini', ICO_INFINI, nv.n, `Infini · palier ${nv.n}`, `${h(ci.titre)} pour tous, à chaque palier`, reste(), nv.fait)
    : ligne('avenir infini', ICO_INFINI, '', 'Puis l\'Infini', `Le boss revient plus fort, palier après palier. ${h(ci.titre)} pour tous à chacun.`, ''));
  return `<section class="rd-chemin">
    <div class="rd-sec-t"><h3>Le chemin du serveur</h3><small>Chaque étape qui tombe ouvre un coffre pour tous ceux qui ont combattu dans ce raid.</small></div>
    <ol class="rd-ets">${l.join('')}</ol>
  </section>`;
}

/* Toi : tes dégâts, ton rang, tes trois coffres. */
function vRaidToi(r) {
  const m = r.moi;
  const max = RAID.perso[RAID.perso.length - 1].seuil;
  const pos = x => Math.min(100, (100 * x) / max);
  const rang = m.degats > 0 && r.rang ? `${r.rang}<sup>e</sup>` : '—';
  const etat = pa => (pa.pris ? 'fait' : m.degats >= pa.seuil ? 'pret' : '');
  const marques = m.perso.map(pa => `<span class="rd-pm ${etat(pa)}" style="left:${pos(pa.seuil).toFixed(1)}%">${raidIco(pa)}</span>`).join('');
  const lignes = m.perso.map(pa => `<li class="${etat(pa)}"><small class="tnum">${fmtN(pa.seuil)} dégâts</small><b>${h(pa.titre)}</b>${pa.pris ? `<small class="rd-et-ok">${NAVICO.check}Ouvert</small>`
    : m.degats >= pa.seuil ? `<button class="btn tiny" data-rd="coffre" data-s="${r.n}" data-q="perso" data-v="${pa.n}" data-snd="piece">Ouvrir</button>`
      : `<small class="tnum">encore ${fmtN(pa.seuil - m.degats)}</small>`}</li>`).join('');
  return `<section class="rd-toi">
    <div class="rd-sec-t"><h3>Toi</h3><small>Tes propres dégâts de ce raid ouvrent aussi trois coffres, rien qu'à toi.</small></div>
    <div class="rd-toi-ch"><span><b class="tnum">${fmtN(m.degats)}</b><small>dégâts</small></span><span><b class="tnum">${m.victoires}</b><small>victoire${m.victoires > 1 ? 's' : ''}</small></span><span><b>${rang}</b><small>au classement</small></span></div>
    <div class="rd-piste" role="img" aria-label="${m.degats} dégâts sur ${max}"><span class="rd-piste-f" style="width:${pos(m.degats).toFixed(1)}%"></span>${marques}</div>
    <ol class="rd-perso">${lignes}</ol>
  </section>`;
}

/* La page. */
function vRaid() {
  if (Backend.mode !== 'cloud') return horsLigne('Le Raid');
  if (rdErreur) return vide('Raid indisponible', rdErreur);
  if (!rdEtat) { relireRaid(); return '<p class="muted boitecharge">Chargement du Raid…</p>'; }
  const r = rdEtat;
  /* Les coffres du raid précédent, encore à ouvrir. */
  const avant = rdOuvrables(r.precedente).map(x => `<div class="rd-coffre">
      <span class="rd-coffre-ico">${raidIco(x)}</span>
      <span><small>Raid ${x.saison} · ${h(x.dit)}</small><b>${h(x.titre)}</b></span>
      <button class="btn tiny" data-rd="coffre" data-s="${x.saison}" data-q="${x.quoi}" data-v="${x.n}" data-snd="piece">Ouvrir</button>
    </div>`).join('');
  return `<div class="rd">
    ${avant ? `<section class="rd-coffres"><div class="rd-sec-t"><h3>Le raid précédent</h3><small>Ses coffres s'ouvrent jusqu'à la fin de celui-ci.</small></div>${avant}</section>` : ''}
    ${vRaidHero(r)}
    ${vRaidCombat(r)}
    ${vRaidChemin(r)}
    ${vRaidToi(r)}
    ${vTopRaid(5)}
    <details class="rd-aide" data-garde="rd-aide"${r.moi.participe ? '' : ' open'}>
      <summary>Comment ça marche</summary>
      <ol>
        <li><b>Tout le serveur frappe le même boss</b>, pendant deux semaines. Trois tentatives par jour.</li>
        <li><b>Chaque PV que tu lui prends compte pour tous.</b> Quand une phase tombe, chacun de ceux qui ont combattu dans le raid ouvre son coffre. La sixième donne une Légendaire et le titre « ${h(TITRES.t_heros_raid.nom)} ».</li>
        <li><b>Ensuite, l'Infini</b> : le boss revient plus fort, palier après palier, et chaque palier tombé ouvre un coffre pour tous. Le classement dit qui a le plus frappé.</li>
      </ol>
    </details>
  </div>`;
}

/* Le classement du raid : les dégâts de chacun. */
function vTopRaid(n) {
  const r = rdEtat;
  if (!r) return '';
  const top = (r.top || []).slice(0, n || 10);
  if (!top.length) return '';
  return `<section class="rd-top"><div class="rd-sec-t"><h3>Classement du raid</h3><small>Les dégâts de chacun dans ce raid.</small></div>
    <ol class="rf-top">${top.map((j, i) => `<li class="${j.moi ? 'moi' : ''}">
      <span class="rf-rang r${i + 1}">${i + 1}</span>${avatarHTML(j.avatar, j.frame, 'md', j.photo, j.xp)}
      <span class="rf-joueur"><b>${h(j.pseudo)}</b>${j.section ? `<small class="ch-sec">${emblemeSection(j.section)}${h(SECTIONS[j.section].court)}</small>` : ''}</span>
      <span class="rf-pts tnum">${fmtN(j.degats)}<small class="muted">&nbsp;dégâts</small></span></li>`).join('')}</ol></section>`;
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
