/* L'Échauffement (version 2.1.4) : sept défis, un par jour, juste après
   l'événement Reflets, dans l'onglet Combats.

   On compose une équipe de trois Joueurs de sa collection, dans l'ordre :
   celui de devant encaisse. Le combat se déroule tout seul, sur le serveur
   (ech_simuler, supabase/22b_echauffement.sql), à partir des valeurs
   imprimées sur les cartes ; la page ne fait que le rejouer coup par coup.
   Les règles et l'équilibrage sont en tête du fichier SQL.

   Rien n'y dit ce que sera la suite : c'est un échauffement. */
"use strict";

let echData = null;
let echJour = 0;
let echTri = 'def';
let echOccupe = false;
/* L'équipe en préparation, défi par défi : [{ carte, a }]. */
const echEquipes = {};

const ECH_POS = ['Devant', '2ᵉ', '3ᵉ'];
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

/* ---------- Ce qu'on sait d'un Joueur ---------- */
/* Les attaques qui font des dégâts (celles qui n'ont qu'un effet ne
   comptent pas ici, comme côté serveur), avec leur coût en élan. */
const echAttaques = c => (c.atks || []).filter(a => a.degats).map(a => ({
  nom: a.nom, degats: a.degats, cout: Object.values(a.cout || {}).reduce((x, y) => x + y, 0)
}));
const echRythme = n => (n <= 1 ? 'à chaque tour' : `tous les ${n} tours`);
const echBase = id => (/^r[0-9]/.test(id) ? 'c' + id.slice(1) : id);
const echPossede = c => mesEx(c.id) > 0 || mesEx('r' + c.id.slice(1)) > 0;
const echJoueurs = () => cards.filter(c => c.cat === 'joueur' && !c.promo && echPossede(c));

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
const echEtoiles = n => `<span class="ech-et" aria-label="${n} étoile${n > 1 ? 's' : ''} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

/* ---------- La page ---------- */
function vEchauffement() {
  const s = echData;
  const d = echDefi();
  const adv = byId[d.adversaire];
  const aA = echAttaques(adv).reduce((m, a) => (a.degats > m.degats ? a : m));
  const coutA = d.regle === 'eclair' ? 1 : aA.cout;
  const eq = echEquipe(d);
  const reste = Date.parse(s.fin) - Date.now();

  const jours = Array.from({ length: s.total || 7 }, (_, i) => {
    const j = i + 1;
    const x = s.defis.find(y => y.jour === j);
    if (!x) {
      const ouvre = Date.parse(s.debut) + i * 86400000;
      return `<span class="ech-jour ferme" title="Ouvre dans ${h(dureeCourte(ouvre - Date.now()))}"><b>${j}</b>${NAVICO.lock}</span>`;
    }
    return `<button class="ech-jour${j === d.jour ? ' on' : ''}${x.etoiles === 3 ? ' fini' : ''}" data-ech-jour="${j}" aria-label="Défi ${j}"><b>${j}</b>${echEtoiles(x.etoiles)}</button>`;
  }).join('');

  const couleurs = {};
  eq.forEach(e => { const c = byId[e.carte]; couleurs[c.col] = (couleurs[c.col] || 0) + 1; });
  const ensemble = Object.keys(couleurs).filter(k => couleurs[k] > 1);

  const slots = [0, 1, 2].map(i => {
    const e = eq[i];
    if (!e) return `<button class="ech-slot vide" data-ech-choisir="${i}"><span class="ech-pos">${ECH_POS[i]}</span><span class="ech-plus">+</span><small>Choisir un Joueur</small></button>`;
    const c = byId[e.carte];
    const at = echAttaques(c);
    const a = at[e.a] || null;
    let dg = a ? a.degats : 0;
    const marques = [];
    if (a && d.regle === 'affinite' && c.col === d.param.couleur) { dg *= 2; marques.push('<em class="ech-bon">×2</em>'); }
    if (a && (d.regle === 'carapace' || d.regle === 'final') && dg < d.param.seuil) marques.push('<em class="ech-mal">bloqué</em>');
    if (ensemble.includes(c.col)) marques.push('<em class="ech-bon">+1 élan</em>');
    return `<div class="ech-slot">
      <span class="ech-pos">${ECH_POS[i]}</span>
      <button class="ech-mini" data-ech-choisir="${i}" aria-label="Changer ${h(c.nom)}">${renderCard(c)}</button>
      <span class="ech-st">
        <b>${h(c.nom)}</b>
        <span>Défense <b class="tnum">${c.def}</b></span>
        <span>${a ? `<b class="tnum">${dg}</b> dégâts, ${echRythme(a.cout)}` : 'Ne frappe pas'}</span>
        ${marques.length ? `<span class="ech-marques">${marques.join('')}</span>` : ''}
        ${at.length > 1 ? `<button class="linkbtn" data-ech-att="${i}">Autre attaque</button>` : ''}
      </span>
      <button class="ech-x" data-ech-retirer="${i}" aria-label="Retirer ${h(c.nom)}">×</button>
    </div>`;
  }).join('');

  const gagnes = s.gagnes || 0, etoiles = s.etoiles || 0, pal = s.paliers || [];
  return `<section class="ech">
    <header class="ech-tete">
      <span class="ech-kick">Événement · encore ${h(dureeCourte(reste))}</span>
      <h2 class="ech-titre">L'Échauffement</h2>
      <p>Un défi par jour. Compose une équipe de trois Joueurs de ta collection : le combat se joue tout seul, avec les valeurs de tes cartes.</p>
      <div class="ech-buts">
        <span class="${pal.includes('sept') ? 'fait' : ''}"><b class="tnum">${gagnes}/7</b> défis gagnés · 3 boosters</span>
        <span class="${pal.includes('parfait') ? 'fait' : ''}"><b class="tnum">${etoiles}/21</b> étoiles · titre « Échauffé »</span>
      </div>
    </header>

    <nav class="ech-jours" aria-label="Les défis">${jours}</nav>

    <article class="ech-defi">
      <div class="ech-adv">
        <button class="ech-adv-carte" data-show="${adv.id}" aria-label="Voir ${h(adv.nom)}">${renderCard(adv)}</button>
        <div class="ech-adv-txt">
          <small>Défi ${d.jour} · ${h(d.titre)}</small>
          <b>${h(adv.nom)}</b>
          <span>Défense <b class="tnum">${fmtN(d.pv)}</b></span>
          <span>${h(aA.nom)} : <b class="tnum">${aA.degats}</b> dégâts, ${echRythme(coutA)}</span>
          <p class="ech-regle">${h(d.texte)}</p>
        </div>
      </div>

      <div class="ech-equipe">${slots}</div>
      ${ensemble.length ? '<p class="ech-note">Deux Joueurs de la même couleur partent avec 1 élan d\'avance.</p>' : ''}

      <button class="btn ech-lancer" data-ech="lancer" ${eq.length && !echOccupe ? '' : 'disabled'}>Lancer le défi</button>
      <div class="ech-prix">
        ${ECH_PRIX.map((p, i) => `<span class="${d.etoiles > i ? 'fait' : ''}">${echEtoiles(i + 1)}<b>+${p}</b></span>`).join('')}
        ${d.essais ? `<small>${d.essais} essai${d.essais > 1 ? 's' : ''}</small>` : ''}
      </div>
    </article>

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
    body: `<p class="muted small">${i === 0 ? 'Celui de devant encaisse les coups.' : 'Il frappe depuis l\'arrière, et passe devant si celui-ci tombe.'}</p>
      <div class="segbar ech-tri">${tri.map(([k, n]) => `<button data-ech-tri="${k}" class="${echTri === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${l.length ? `<div class="pickgrid">${l.map(({ c, at }) => {
        const a = at.reduce((m, x) => (x.degats > m.degats ? x : m), at[0] || null);
        const deja = pris.includes(c.id) && eq[i] && eq[i].carte !== c.id;
        return `<button class="pick ech-pick" data-ech-pick="${c.id}" ${deja ? 'disabled' : ''}>
          <span class="pickimg">${renderCard(c)}</span>
          <span class="ech-pick-st"><b>Déf ${c.def}</b>${a ? `<span>${a.degats} · ${a.cout <= 1 ? '1 tour' : a.cout + ' tours'}</span>` : '<span>—</span>'}</span></button>`;
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

function echScene(d, eq, r) {
  const adv = byId[d.adversaire];
  const res = r.resultat;
  const v = document.createElement('div');
  v.className = 'ech-scene';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-label', `Défi ${d.jour}`);
  v.innerHTML = `<div class="ech-sc">
      <div class="ech-sc-haut"><span class="ech-sc-tour">Tour 1</span><button class="linkbtn ech-passer">Passer</button></div>
      <div class="ech-sc-adv">
        <div class="ech-sc-carte">${renderCard(adv)}<i class="ech-flot"></i></div>
        <div class="ech-barre"><i style="width:100%"></i><span class="tnum">${fmtN(d.pv)}</span></div>
      </div>
      <p class="ech-sc-regle">${h(d.texte)}</p>
      <div class="ech-sc-eq">${eq.map((e, i) => {
        const c = byId[e.carte];
        return `<div class="ech-sc-j" data-i="${i}">
          <div class="ech-sc-carte">${renderCard(c)}<i class="ech-flot"></i><i class="ech-ko">KO</i></div>
          <div class="ech-barre"><i style="width:100%"></i><span class="tnum">${c.def}</span></div>
        </div>`;
      }).join('')}</div>
      <div class="ech-sc-fin" hidden></div>
    </div>`;
  document.body.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));

  const defs = eq.map(e => byId[e.carte].def);
  const advEl = v.querySelector('.ech-sc-adv');
  const jEl = i => v.querySelector(`.ech-sc-j[data-i="${i}"]`);
  const barre = (el, reste, max) => {
    el.querySelector('.ech-barre i').style.width = Math.max(0, reste / max * 100) + '%';
    el.querySelector('.ech-barre span').textContent = fmtN(Math.max(0, reste));
  };
  const flotte = (el, txt, cls) => {
    const f = el.querySelector('.ech-flot');
    f.textContent = txt; f.className = 'ech-flot ' + (cls || '');
    void f.offsetWidth; f.classList.add('go');
  };
  const coup = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  const pas = ev => {
    const [t, type, i, dg, reste] = ev;
    v.querySelector('.ech-sc-tour').textContent = `Tour ${t}`;
    if (type === 'frappe') { coup(jEl(i), 'frappe'); coup(advEl, 'touche'); flotte(advEl, '−' + dg); barre(advEl, reste, d.pv); if (typeof SFX === 'object') SFX.jouer('tap'); }
    else if (type === 'bloque') { coup(jEl(i), 'frappe'); flotte(advEl, 'Bloqué', 'gris'); }
    else if (type === 'riposte') { flotte(jEl(i), '−' + dg, 'petit'); barre(jEl(i), reste, defs[i]); }
    else if (type === 'subit') { coup(advEl, 'attaque'); coup(jEl(i), 'touche'); flotte(jEl(i), '−' + dg); barre(jEl(i), reste, defs[i]); }
    else if (type === 'ko') { jEl(i).classList.add('ko'); }
  };

  let k = 0, minuteur = null;
  const finir = () => {
    clearTimeout(minuteur);
    for (; k < res.log.length; k++) pas(res.log[k]);
    v.querySelector('.ech-passer').hidden = true;
    const g = r.gain || {};
    const gains = [];
    if (g.eclats) gains.push(`<span>+${fmtN(g.eclats)} Éclats</span>`);
    if (g.boosters) gains.push(`<span>+${g.boosters} boosters</span>`);
    if (g.titre) gains.push(`<span>Titre « ${h((TITRES[g.titre] || {}).nom || 'Échauffé')} »</span>`);
    const fin = v.querySelector('.ech-sc-fin');
    fin.innerHTML = `<b class="ech-sc-verdict">${res.gagne ? 'Victoire !' : 'Pas cette fois'}</b>
      ${echEtoiles(res.etoiles)}
      ${gains.length ? `<div class="ech-gains">${gains.join('')}</div>` : res.gagne && res.etoiles <= r.avant ? '<small>Pas mieux que ton meilleur résultat.</small>' : ''}
      ${!res.gagne || res.etoiles < 3 ? `<small class="ech-astuce">${h(ECH_ASTUCES[d.regle] || '')}</small>` : ''}
      <button class="btn" data-ech="fermer-scene">${res.gagne ? 'Continuer' : 'Changer d\'équipe'}</button>`;
    fin.hidden = false;
    if (res.gagne && typeof SFX === 'object') SFX.jouer(res.etoiles === 3 ? 'legend' : 'gagne');
    if (typeof vibrer === 'function') vibrer(res.gagne ? [20, 40, 20] : 30);
  };
  const suivant = () => {
    if (k >= res.log.length) return finir();
    pas(res.log[k++]);
    minuteur = setTimeout(suivant, 620);
  };
  minuteur = setTimeout(suivant, 700);
  v.querySelector('.ech-passer').onclick = finir;
  v.addEventListener('click', ev => {
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
  return `<button class="ech-ban" data-tab="combats" aria-label="L'Échauffement : aller aux défis">
    <span class="ech-ban-txt"><small>Événement · encore ${h(dureeCourte(Date.parse(echData.fin) - Date.now()))}</small><b>L'Échauffement</b></span>
    ${n ? `<i class="ech-ban-n">${n}</i>` : ''}<span class="ech-ban-fl" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- La fenêtre d'annonce, une fois ---------- */
function echAnnonceAVoir() {
  return echActif() && accueilMemoire().echauffement !== 'vu';
}
function montrerEchAnnonce() {
  accueilNoter({ echauffement: 'vu' });
  openSheet({
    title: 'L\'Échauffement',
    body: `<p>Sept défis, un par jour, dans l'onglet <b>Combats</b>.</p>
      <ol class="bvpoints nvpoints">
        <li><span class="bvico">${NAVICO.cards}</span><span><b>Compose une équipe.</b> Trois Joueurs de ta collection, dans l'ordre : celui de devant encaisse.</span></li>
        <li><span class="bvico">${NAVICO.sword}</span><span><b>Le combat se joue tout seul</b>, avec la Défense, les dégâts et le coût imprimés sur tes cartes.</span></li>
        <li><span class="bvico">${NAVICO.star}</span><span><b>Jusqu'à trois étoiles par défi</b>, et des Éclats pour chacune. Sept victoires : 3 boosters.</span></li>
      </ol>`,
    actions: [
      { label: 'Plus tard', fn: closeSheet },
      { label: 'Premier défi', primary: true, fn: () => { closeSheet(); aller('combats'); } }
    ]
  });
}

/* ---------- Les clics ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-ech],[data-ech-jour],[data-ech-choisir],[data-ech-pick],[data-ech-retirer],[data-ech-att],[data-ech-tri]');
  if (!b || b.disabled) return;
  const x = b.dataset;
  if (x.ech === 'lancer') return echLancer();
  if (x.echJour) { echJour = +x.echJour; return render(); }
  if (x.echChoisir) return echChoisir(+x.echChoisir);
  if (x.echPick) return echPrendre(x.echPick);
  if (x.echTri) { echTri = x.echTri; return echChoisir(echPlace); }
  if (x.echRetirer) { echEquipe(echDefi()).splice(+x.echRetirer, 1); return render(); }
  if (x.echAtt) {
    const e = echEquipe(echDefi())[+x.echAtt];
    const n = echAttaques(byId[e.carte]).length;
    e.a = (e.a + 1) % n;
    return render();
  }
});
