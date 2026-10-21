/* L'Échauffement (version 2.1.4) : sept défis, un par jour, juste après le
   récap de Reflets, dans l'onglet Combats.

   On compose une équipe de trois Joueurs de sa collection, dans l'ordre :
   celui de devant encaisse. Le combat se déroule tout seul, sur le serveur
   (ech_simuler, supabase/22b_echauffement.sql), à partir des valeurs
   imprimées sur les cartes ; la page ne fait que le rejouer coup par coup.
   Les règles et l'équilibrage sont en tête du fichier SQL.

   Trois étoiles à un défi débloquent un indice sur ce qui se prépare. Leur
   texte n'est pas ici : le serveur ne l'envoie qu'une fois l'indice gagné.
   Les couleurs sont celles du site d'aujourd'hui. */
"use strict";

let echData = null;
let echJour = 0;
let echTri = 'def';
let echOccupe = false;
/* L'équipe en préparation, défi par défi : [{ carte, a }]. */
const echEquipes = {};

const ECH_POS = ['Devant', 'Milieu', 'Derrière'];
const ECH_PRIX = [80, 80, 140];
const ECH_ASTUCES = {
  aucune: 'Mets devant le Joueur qui encaisse le mieux, derrière ceux qui frappent fort.',
  carapace: 'Les petits coups ne passent pas : il faut des attaques d\'au moins 100.',
  eclair: 'Il frappe à chaque tour : il te faut un Joueur solide devant, et vite.',
  affinite: 'Des Joueurs Roses, et ils frappent deux fois plus fort.',
  riposte: 'Chaque coup te coûte 30 : peu de coups, mais des gros.',
  fureur: 'Il frappe de plus en plus fort : il faut le battre vite.',
  final: 'Des coups d\'au moins 80, et le plus vite possible.'
};
/* L'icône de la règle du jour. */
const ECH_ICO = {
  aucune: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/>',
  carapace: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  affinite: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  riposte: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  fureur: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  final: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'
};
const echIco = r => `<svg class="ech-ico" viewBox="0 0 24 24" aria-hidden="true">${ECH_ICO[r] || ECH_ICO.aucune}</svg>`;

/* ---------- Ce qu'on sait d'un Joueur ---------- */
/* Les attaques qui font des dégâts (celles qui n'ont qu'un effet ne
   comptent pas ici, comme côté serveur), avec leur coût en élan. */
const echAttaques = c => (c.atks || []).filter(a => a.degats).map(a => ({
  nom: a.nom, degats: a.degats, cout: Object.values(a.cout || {}).reduce((x, y) => x + y, 0)
}));
const echRythme = n => (n <= 1 ? 'à chaque tour' : `tous les ${n} tours`);
const echPossede = c => mesEx(c.id) > 0 || mesEx('r' + c.id.slice(1)) > 0;
const echJoueurs = () => cards.filter(c => c.cat === 'joueur' && !c.promo && echPossede(c));

/* L'illustration seule d'une carte, recadrée dans son conteneur (le cadre
   de la carte ne se voit jamais) : fx, fy, le point à garder au centre. */
const echIllu = (c, fx, fy, cls) => (c && c.img
  ? `<span class="ech-illu ${cls || ''}" style="--fx:${fx == null ? .5 : fx};--fy:${fy == null ? .35 : fy}" aria-hidden="true"><img src="${c.img}" alt="" decoding="async"></span>`
  : '');

/* ---------- L'état ---------- */
function echActif() {
  if (!echData || !echData.ouvert) return false;
  return Date.now() < Date.parse(echData.fin);
}
/* La pastille de Combats : les défis ouverts pas encore gagnés. */
function echPastille() {
  if (!echActif()) return 0;
  return echData.defis.filter(d => !d.etoiles).length;
}

async function chargerEch() {
  if (Backend.mode !== 'cloud' || !save) return;
  try { echData = await Backend.echEtat(); } catch (e) { return; }
  if (tab === 'combats' || tab === 'boosters') render();
  else if (typeof majDiscrete === 'function') majDiscrete(false);
}

function echDefi() {
  const l = echData.defis;
  if (!echJour || !l.some(d => d.jour === echJour)) {
    /* Le premier défi pas encore à trois étoiles, sinon le dernier ouvert. */
    const d = l.find(x => x.etoiles < 3) || l[l.length - 1];
    echJour = d ? d.jour : 1;
  }
  return l.find(d => d.jour === echJour);
}
function echEquipe(d) {
  if (!echEquipes[d.jour]) echEquipes[d.jour] = (d.equipe || []).filter(e => byId[e.carte] && echPossede(byId[e.carte])).map(e => ({ carte: e.carte, a: e.a || 0 }));
  return echEquipes[d.jour];
}
const echEtoiles = (n, cls) => `<span class="ech-et ${cls || ''}" role="img" aria-label="${n} étoile${n > 1 ? 's' : ''} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
const echAdvAttaque = (d, adv) => {
  const a = echAttaques(adv).reduce((m, x) => (x.degats > m.degats ? x : m));
  return Object.assign({}, a, { cout: d.regle === 'eclair' ? 1 : a.cout });
};
const echIndice = j => (echData.indices || []).find(x => x.jour === j);

/* ---------- Un indice ---------- */
function vIndiceVisuel(x) {
  const v = x.visuel || {};
  if (v.type === 'etoiles') return `<span class="ech-iv etoiles">${Array.from({ length: v.valeur || 5 }, (_, i) => `<i class="${i >= 3 ? 'au-dela' : ''}">★</i>`).join('')}</span>`;
  if (v.type === 'carte' && byId[v.carte]) return `<span class="ech-iv carte">${echIllu(byId[v.carte], .5, .3)}</span>`;
  return `<span class="ech-iv ${v.type === 'nombre' ? 'nombre' : 'mot'}">${h(String(v.valeur || ''))}</span>`;
}
function vIndiceFace(x) {
  return `<span class="ech-ind-face">${vIndiceVisuel(x)}<b>${h(x.titre)}</b></span>`;
}
function montrerIndice(j) {
  const x = echIndice(j);
  if (!x) return;
  openSheet({
    title: j ? `Indice ${j}` : 'Le dernier mot',
    body: `<div class="ech-ind-grand">${vIndiceVisuel(x)}<b>${h(x.titre)}</b><p>${h(x.texte)}</p></div>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

/* ---------- La page ---------- */
function vEchauffement() {
  const s = echData;
  const d = echDefi();
  const adv = byId[d.adversaire];
  const aA = echAdvAttaque(d, adv);
  const eq = echEquipe(d);
  const reste = Date.parse(s.fin) - Date.now();
  const total = s.total || 7;

  /* La piste des sept défis. */
  const piste = Array.from({ length: total }, (_, i) => {
    const j = i + 1;
    const x = s.defis.find(y => y.jour === j);
    if (!x) {
      const ouvre = Date.parse(s.debut) + i * 86400000;
      return `<span class="ech-pas ferme" title="Ouvre dans ${h(dureeCourte(ouvre - Date.now()))}"><i class="ech-rond">${NAVICO.lock}</i><small>${h(dureeCourte(ouvre - Date.now()).split(' ').slice(0, 2).join(' '))}</small></span>`;
    }
    const cls = [j === d.jour ? 'on' : '', x.etoiles === 3 ? 'fini' : x.etoiles ? 'gagne' : ''].join(' ');
    return `<button class="ech-pas ${cls}" data-ech-jour="${j}" aria-label="Défi ${j}, ${x.etoiles} étoile${x.etoiles > 1 ? 's' : ''}"><i class="ech-rond">${j}</i>${echEtoiles(x.etoiles)}</button>`;
  }).join('');

  /* L'équipe, en ligne. */
  const couleurs = {};
  eq.forEach(e => { const c = byId[e.carte]; couleurs[c.col] = (couleurs[c.col] || 0) + 1; });
  const ensemble = Object.keys(couleurs).filter(k => couleurs[k] > 1);
  const places = [0, 1, 2].map(i => {
    const e = eq[i];
    const tete = `<span class="ech-pos">${i === 0 ? ECH_ICO.carapace && echIco('carapace') : ''}${ECH_POS[i]}</span>`;
    if (!e) {
      const libre = i <= eq.length;
      return `<div class="ech-place">${tete}<button class="ech-vide" data-ech-choisir="${Math.min(i, eq.length)}" ${libre ? '' : 'disabled'} aria-label="Choisir un Joueur"><i>+</i><small>${i === 0 ? 'Celui qui encaisse' : 'Un Joueur'}</small></button></div>`;
    }
    const c = byId[e.carte];
    const at = echAttaques(c);
    const a = at[e.a] || null;
    let dg = a ? a.degats : 0;
    const marques = [];
    if (a && d.regle === 'affinite' && c.col === d.param.couleur) { dg *= 2; marques.push('<em class="bon">×2</em>'); }
    if (a && (d.regle === 'carapace' || d.regle === 'final') && dg < d.param.seuil) marques.push('<em class="mal">Bloqué</em>');
    if (ensemble.includes(c.col)) marques.push('<em class="bon">+1 élan</em>');
    return `<div class="ech-place plein">${tete}
      <div class="ech-carte">
        <button class="ech-carte-b" data-ech-choisir="${i}" aria-label="Changer ${h(c.nom)}">${renderCard(c)}</button>
        <button class="ech-x" data-ech-retirer="${i}" aria-label="Retirer ${h(c.nom)}">×</button>
        ${marques.length ? `<span class="ech-marques">${marques.join('')}</span>` : ''}
      </div>
      <span class="ech-chiffres"><span><small>Déf</small><b class="tnum">${c.def}</b></span><span><small>Coup</small><b class="tnum">${a ? dg : '—'}</b></span></span>
      <small class="ech-rythme">${a ? echRythme(a.cout) : 'Ne frappe pas'}</small>
      ${at.length > 1 ? `<button class="ech-att" data-ech-att="${i}">Autre attaque</button>` : ''}
    </div>`;
  }).join('');

  /* Le carnet des indices. */
  const nInd = (s.indices || []).filter(x => x.jour > 0).length;
  const carnet = Array.from({ length: total }, (_, i) => {
    const j = i + 1;
    const x = echIndice(j);
    if (x) return `<button class="ech-ind ouvert" data-ech-indice="${j}" aria-label="Indice ${j} : ${h(x.titre)}">${vIndiceFace(x)}</button>`;
    const ouvert = s.defis.some(y => y.jour === j);
    return `<span class="ech-ind" aria-label="Indice ${j}, verrouillé"><img src="${ART.back}" alt=""><span class="ech-ind-verrou">${NAVICO.lock}<small>${ouvert ? `★★★ au défi ${j}` : `Défi ${j}`}</small></span></span>`;
  }).join('');
  const final = echIndice(0);

  const gagnes = s.gagnes || 0, etoiles = s.etoiles || 0, pal = s.paliers || [];
  return `<section class="ech">
    <header class="ech-hero">
      ${echIllu(adv, .5, .3, 'fond')}
      <span class="ech-hero-haut"><span class="ech-chip">Événement · encore ${h(dureeCourte(reste))}</span><span class="ech-chip or">★ <b class="tnum">${etoiles}</b>/21</span></span>
      <span class="ech-hero-bas">
        <small>Sept défis, un par jour</small>
        <h2 class="ech-titre">L'Échauffement</h2>
        <span class="ech-objectifs">
          <span class="${pal.includes('sept') ? 'fait' : ''}"><b class="tnum">${gagnes}/7</b> victoires · 3 boosters</span>
          <span class="${pal.includes('parfait') ? 'fait' : ''}"><b class="tnum">${etoiles}/21</b> ★ · titre « Échauffé »</span>
        </span>
      </span>
    </header>

    <nav class="ech-piste" aria-label="Les sept défis">${piste}</nav>

    <article class="ech-defi">
      <div class="ech-face">
        <button class="ech-adv" data-show="${adv.id}" aria-label="Voir ${h(adv.nom)}">${renderCard(adv)}</button>
        <div class="ech-adv-txt">
          <small>Défi ${d.jour} · ${h(d.titre)}</small>
          <b class="ech-adv-nom">${h(adv.nom)}</b>
          <span class="ech-adv-stats">
            <span><small>Défense</small><b class="tnum">${fmtN(d.pv)}</b></span>
            <span><small>${h(aA.nom)}</small><b class="tnum">${aA.degats}</b><em>${echRythme(aA.cout)}</em></span>
          </span>
        </div>
      </div>
      <p class="ech-regle r-${d.regle}">${echIco(d.regle)}<span><b>${d.regle === 'aucune' ? 'Pas de règle' : h(d.titre)}</b>${h(d.texte)}</span></p>

      <div class="ech-ligne">${places}</div>
      <p class="ech-note">${ensemble.length ? 'Même couleur : 1 élan d\'avance au départ.' : 'Deux Joueurs de la même couleur partent avec 1 élan d\'avance.'}</p>

      <button class="btn ech-lancer" data-ech="lancer" ${eq.length && !echOccupe ? '' : 'disabled'}>Lancer le défi</button>
      <div class="ech-prix">
        ${ECH_PRIX.map((p, i) => `<span class="${d.etoiles > i ? 'fait' : ''}">${echEtoiles(i + 1)}<b>+${p}</b>${i === 2 ? '<em>+ un indice</em>' : ''}</span>`).join('')}
      </div>
    </article>

    <section class="ech-carnet">
      <div class="ech-carnet-tete"><h3>Ce qui se prépare</h3><small><b class="tnum">${nInd}/7</b> indices · trois étoiles à un défi, un indice</small></div>
      <div class="ech-inds">${carnet}</div>
      ${final ? `<button class="ech-final" data-ech-indice="0"><b>${h(final.titre)}</b><span>${h(final.texte)}</span></button>` : ''}
    </section>

    <details class="ech-regles">
      <summary>Comment ça marche</summary>
      <ul>
        <li>Tes trois Joueurs combattent ensemble ; l'adversaire frappe celui de devant. À 0 de Défense, un Joueur est KO, et le suivant passe devant.</li>
        <li>À chaque tour, chacun gagne 1 élan, et frappe dès qu'il en a autant que le coût de son attaque (les Essences dessinées sur la carte) : plus une attaque coûte, plus elle tarde.</li>
        <li>Deux Joueurs de la même couleur partent avec 1 élan d'avance.</li>
        <li>Il faut le battre avant la fin du 10ᵉ tour. ★ : gagner. ★★ : en perdant au plus un Joueur. ★★★ : sans en perdre aucun.</li>
        <li>Rejoue autant que tu veux : ta meilleure note compte, et chaque nouvelle étoile rapporte des Éclats.</li>
      </ul>
    </details>
  </section>`;
}

/* ---------- Composer l'équipe ---------- */
let echPlace = 0;
function echChoisir(i) {
  const d = echDefi();
  echPlace = i;
  const eq = echEquipe(d);
  const pris = eq.map(e => e.carte);
  const l = echJoueurs().map(c => ({ c, at: echAttaques(c) }));
  const meilleur = x => x.at.reduce((m, a) => Math.max(m, a.degats), 0);
  const vite = x => x.at.reduce((m, a) => Math.min(m, a.cout), 9);
  l.sort((x, y) => (echTri === 'def' ? y.c.def - x.c.def
    : echTri === 'deg' ? meilleur(y) - meilleur(x)
      : vite(x) - vite(y) || meilleur(y) - meilleur(x)) || x.c.num - y.c.num);
  const tri = [['def', 'Défense'], ['deg', 'Dégâts'], ['vite', 'Rapidité']];
  openSheet({
    title: `${ECH_POS[i]} : quel Joueur ?`,
    body: `<p class="muted small">${i === 0 ? 'Celui de devant encaisse les coups.' : 'Il frappe depuis l\'arrière, et passe devant si ceux de devant tombent.'}</p>
      <div class="segbar ech-tri">${tri.map(([k, n]) => `<button data-ech-tri="${k}" class="${echTri === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${l.length ? `<div class="pickgrid">${l.map(({ c, at }) => {
        const a = at.reduce((m, x) => (x.degats > m.degats ? x : m), at[0] || null);
        const deja = pris.includes(c.id) && eq[i] && eq[i].carte !== c.id;
        return `<button class="pick ech-pick" data-ech-pick="${c.id}" ${deja ? 'disabled' : ''}>
          <span class="pickimg">${renderCard(c)}</span>
          <span class="ech-pick-st"><span><small>Déf</small><b>${c.def}</b></span>${a ? `<span><small>${a.cout <= 1 ? '1 tour' : a.cout + ' tours'}</small><b>${a.degats}</b></span>` : '<span>—</span>'}</span></button>`;
      }).join('')}</div>` : '<p class="muted">Tu n\'as encore aucun Joueur : ouvre quelques boosters !</p>'}`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}
function echPrendre(id) {
  const d = echDefi();
  const eq = echEquipe(d);
  const c = byId[id];
  const at = echAttaques(c);
  /* Par défaut, sa plus forte attaque. */
  const a = at.length ? at.indexOf(at.reduce((m, x) => (x.degats > m.degats ? x : m))) : 0;
  const ailleurs = eq.findIndex(e => e.carte === id);
  if (ailleurs >= 0) eq.splice(ailleurs, 1);
  if (echPlace < eq.length) eq[echPlace] = { carte: id, a };
  else eq.push({ carte: id, a });
  closeSheet();
  render();
}

/* ---------- Le combat, rejoué ---------- */
async function echLancer() {
  const d = echDefi();
  const eq = echEquipe(d).slice();
  if (!eq.length || echOccupe) return;
  echOccupe = true;
  let r;
  try {
    r = await Backend.echJouer(d.jour, eq);
  } catch (e) {
    echOccupe = false;
    toast(e.message || 'Le défi n\'a pas pu être lancé.');
    return render();
  }
  echData = r.etat;
  echScene(d, eq, r);
}

/* Le journal du serveur, rejoué : chaque ligne est un coup. L'élan se
   déduit du journal (un par tour, le coût dépensé à chaque coup) : il
   s'affiche en pastilles sous chaque carte. */
function echScene(d, eq, r) {
  const adv = byId[d.adversaire];
  const aA = echAdvAttaque(d, adv);
  const res = r.resultat;
  const allies = eq.map(e => {
    const c = byId[e.carte];
    const a = echAttaques(c)[e.a] || null;
    return { c, cout: a ? a.cout : 0, def: c.def, pv: c.def, elan: 0 };
  });
  allies.forEach(a => { if (allies.filter(b => b.c.col === a.c.col).length > 1) a.elan = 1; });
  let elanB = 0, tour = 0;

  const pips = (n, plein) => Array.from({ length: n }, (_, i) => `<i class="${i < plein ? 'on' : ''}"></i>`).join('');
  const v = document.createElement('div');
  v.className = 'ech-scene';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-label', `Défi ${d.jour} : ${adv.nom}`);
  v.innerHTML = `${echIllu(adv, .5, .3, 'fond')}<div class="ech-sc">
      <div class="ech-sc-haut"><span class="ech-sc-tour">Tour 1</span><span class="ech-sc-regle">${echIco(d.regle)}${h(d.titre)}</span><button class="ech-passer">Passer ›</button></div>
      <div class="ech-sc-adv ech-sc-u">
        <div class="ech-sc-carte">${renderCard(adv)}<i class="ech-flot"></i><i class="ech-eclat"></i></div>
        <div class="ech-barre adv"><i style="width:100%"></i><span class="tnum">${fmtN(d.pv)}</span></div>
        <div class="ech-pips adv">${pips(aA.cout, 0)}</div>
      </div>
      <div class="ech-sc-eq">${allies.map((a, i) => `<div class="ech-sc-j ech-sc-u" data-i="${i}">
          <div class="ech-sc-carte">${renderCard(a.c)}<i class="ech-flot"></i><i class="ech-eclat"></i><i class="ech-ko">KO</i></div>
          <div class="ech-barre"><i style="width:100%"></i><span class="tnum">${a.def}</span></div>
          <div class="ech-pips">${pips(a.cout, a.elan)}</div>
        </div>`).join('')}</div>
      <div class="ech-sc-fin" hidden></div>
    </div>`;
  document.body.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));

  const advEl = v.querySelector('.ech-sc-adv');
  const jEl = i => v.querySelector(`.ech-sc-j[data-i="${i}"]`);
  const majPips = () => {
    allies.forEach((a, i) => { jEl(i).querySelector('.ech-pips').innerHTML = pips(a.cout, Math.min(a.cout, a.elan)); });
    advEl.querySelector('.ech-pips').innerHTML = pips(aA.cout, Math.min(aA.cout, elanB));
  };
  const barre = (el, reste, max) => {
    el.querySelector('.ech-barre i').style.width = Math.max(0, reste / max * 100) + '%';
    el.querySelector('.ech-barre span').textContent = fmtN(Math.max(0, reste));
  };
  const rejouer = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const flotte = (el, txt, cls) => {
    const f = el.querySelector('.ech-flot');
    f.textContent = txt; f.className = 'ech-flot ' + (cls || '');
    rejouer(f, 'go');
  };
  const nouveauTour = t => {
    for (; tour < t; tour++) {
      allies.forEach(a => { if (a.pv > 0) a.elan++; });
      elanB++;
    }
    v.querySelector('.ech-sc-tour').textContent = `Tour ${t}`;
    majPips();
  };

  const pas = ev => {
    const [t, type, i, dg, reste] = ev;
    if (t > tour) nouveauTour(t);
    const a = allies[i];
    if (type === 'frappe') {
      a.elan -= a.cout; majPips();
      rejouer(jEl(i), 'frappe'); rejouer(advEl, 'touche'); flotte(advEl, '−' + dg, dg >= 150 ? 'gros' : '');
      barre(advEl, reste, d.pv);
      if (typeof SFX === 'object') SFX.jouer('tap');
    } else if (type === 'bloque') {
      a.elan -= a.cout; majPips();
      rejouer(jEl(i), 'frappe'); rejouer(advEl, 'bloque'); flotte(advEl, 'Bloqué', 'gris');
    } else if (type === 'riposte') {
      a.pv = reste; flotte(jEl(i), '−' + dg, 'petit'); barre(jEl(i), reste, a.def);
    } else if (type === 'subit') {
      elanB -= aA.cout; majPips();
      a.pv = reste;
      rejouer(advEl, 'attaque'); rejouer(jEl(i), 'touche'); flotte(jEl(i), '−' + dg, 'rouge');
      barre(jEl(i), reste, a.def);
    } else if (type === 'ko') {
      a.pv = 0; jEl(i).classList.add('ko');
      if (typeof vibrer === 'function') vibrer(25);
    }
  };

  let k = 0, minuteur = null;
  const finir = () => {
    clearTimeout(minuteur);
    for (; k < res.log.length; k++) pas(res.log[k]);
    if (res.gagne) advEl.classList.add('vaincu');
    v.querySelector('.ech-passer').hidden = true;
    const g = r.gain || {};
    const gains = [];
    if (g.eclats) gains.push(`<span>+${fmtN(g.eclats)} Éclats</span>`);
    if (g.boosters) gains.push(`<span>+${g.boosters} boosters</span>`);
    if (g.titre) gains.push(`<span>Titre « ${h((TITRES[g.titre] || {}).nom || 'Échauffé')} »</span>`);
    const fin = v.querySelector('.ech-sc-fin');
    fin.innerHTML = `<b class="ech-sc-verdict">${res.gagne ? 'Victoire !' : 'Pas cette fois'}</b>
      <small class="ech-sc-tours">${res.gagne ? `En ${res.tours} tour${res.tours > 1 ? 's' : ''}${res.ko ? `, ${res.ko} Joueur${res.ko > 1 ? 's' : ''} KO` : ', sans perte'}` : res.tours >= 10 ? 'Le temps est écoulé.' : 'Ton équipe est tombée.'}</small>
      ${echEtoiles(res.etoiles, 'grand')}
      ${gains.length ? `<div class="ech-gains">${gains.join('')}</div>` : res.gagne && res.etoiles <= r.avant ? '<small>Pas mieux que ton meilleur résultat.</small>' : ''}
      ${r.indice ? `<button class="ech-sc-indice" data-ech-reveler="1"><span class="ech-flip"><span class="dos"><img src="${ART.back}" alt=""></span><span class="face">${vIndiceFace(r.indice)}</span></span><span class="ech-sc-ind-txt"><b>Indice débloqué</b><small>Touche pour le retourner</small></span></button>` : ''}
      ${!res.gagne || res.etoiles < 3 ? `<small class="ech-astuce">${h(ECH_ASTUCES[d.regle] || '')}</small>` : ''}
      <button class="btn" data-ech="fermer-scene">${res.gagne ? 'Continuer' : 'Changer d\'équipe'}</button>`;
    fin.hidden = false;
    requestAnimationFrame(() => fin.classList.add('on'));
    if (res.gagne && typeof SFX === 'object') SFX.jouer(res.etoiles === 3 ? 'legend' : 'gagne');
    if (typeof vibrer === 'function') vibrer(res.gagne ? [20, 40, 20] : 30);
  };
  const suivant = () => {
    if (k >= res.log.length) return finir();
    const ev = res.log[k++];
    const changeTour = ev[0] > tour;
    pas(ev);
    minuteur = setTimeout(suivant, changeTour ? 760 : 600);
  };
  minuteur = setTimeout(suivant, 800);
  v.querySelector('.ech-passer').onclick = finir;
  v.addEventListener('click', ev => {
    const rev = ev.target.closest('[data-ech-reveler]');
    if (rev) {
      if (!rev.classList.contains('vu')) {
        rev.classList.add('vu');
        rev.querySelector('.ech-sc-ind-txt').innerHTML = `<b>${h(r.indice.titre)}</b><small>${h(r.indice.texte)}</small>`;
        if (typeof SFX === 'object') SFX.jouer('rare');
      }
      return;
    }
    if (!ev.target.closest('[data-ech="fermer-scene"]')) return;
    v.classList.remove('on');
    setTimeout(() => v.remove(), 250);
    echOccupe = false;
    render();
  });
}

/* ---------- Le bandeau de l'écran Boosters ---------- */
function vBandeauEch() {
  if (!echActif()) return '';
  const n = echPastille();
  const d = echData.defis[echData.defis.length - 1];
  const adv = d && byId[d.adversaire];
  return `<button class="ech-ban" data-tab="combats" aria-label="L'Échauffement : aller aux défis">
    ${echIllu(adv, .5, .3, 'fond')}
    <span class="ech-ban-txt"><small>Événement · encore ${h(dureeCourte(Date.parse(echData.fin) - Date.now()))}</small><b>L'Échauffement</b><span>Défi ${d ? d.jour : 1} : ${h(d ? d.titre : '')}</span></span>
    ${n ? `<i class="ech-ban-n">${n}</i>` : ''}<span class="ech-ban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- La fenêtre d'annonce, une fois ---------- */
function echAnnonceAVoir() {
  return echActif() && accueilMemoire().echauffement !== 'vu';
}
function montrerEchAnnonce() {
  accueilNoter({ echauffement: 'vu' });
  const d = echData.defis[0];
  const adv = d && byId[d.adversaire];
  openSheet({
    title: 'L\'Échauffement',
    body: `<div class="ech-annonce">${echIllu(adv, .5, .3, 'fond')}<span><small>Nouvel événement</small><b>Sept défis, un par jour</b></span></div>
      <ol class="bvpoints nvpoints">
        <li><span class="bvico">${NAVICO.cards}</span><span><b>Compose une équipe.</b> Trois Joueurs de ta collection, dans l'ordre : celui de devant encaisse.</span></li>
        <li><span class="bvico">${NAVICO.sword}</span><span><b>Le combat se joue tout seul</b>, avec la Défense, les dégâts et le coût imprimés sur tes cartes.</span></li>
        <li><span class="bvico">${NAVICO.star}</span><span><b>Trois étoiles, un indice</b> sur ce qui se prépare. Et des Éclats à chaque étoile.</span></li>
      </ol>`,
    actions: [
      { label: 'Plus tard', fn: closeSheet },
      { label: 'Premier défi', primary: true, fn: () => { closeSheet(); aller('combats'); } }
    ]
  });
}

/* ---------- Les clics ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-ech],[data-ech-jour],[data-ech-choisir],[data-ech-pick],[data-ech-retirer],[data-ech-att],[data-ech-tri],[data-ech-indice]');
  if (!b || b.disabled || b.closest('.ech-scene')) return;
  const x = b.dataset;
  if (x.ech === 'lancer') return echLancer();
  if (x.echJour) { echJour = +x.echJour; return render(); }
  if (x.echChoisir) return echChoisir(+x.echChoisir);
  if (x.echPick) return echPrendre(x.echPick);
  if (x.echTri) { echTri = x.echTri; return echChoisir(echPlace); }
  if (x.echIndice != null) return montrerIndice(+x.echIndice);
  if (x.echRetirer) { echEquipe(echDefi()).splice(+x.echRetirer, 1); return render(); }
  if (x.echAtt) {
    const e = echEquipe(echDefi())[+x.echAtt];
    const n = echAttaques(byId[e.carte]).length;
    e.a = (e.a + 1) % n;
    return render();
  }
});
