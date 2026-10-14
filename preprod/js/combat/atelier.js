/* L'atelier de decks (version 3.0).

   Trois parties : les cartes qu'on possède, filtrables ; le deck, rangé par
   type, avec ce qui ne va pas encore ; la Réserve d'Essences. Sur téléphone,
   elles sont en onglets ; sur ordinateur, côte à côte.

   Rien n'est enregistré tant qu'on n'a pas appuyé sur « Enregistrer » : le
   serveur revérifie le deck (deck_sauver, supabase/23_combats.sql). */
"use strict";

let atelier = null;

const AT_TYPES = [['tous', 'Tout'], ['joueur', 'Joueurs'], ['objet', 'Objets'], ['coach', 'Coachs'], ['moment', 'Moments']];

/* Les cartes qu'on peut mettre dans un Club, avec ce qu'on en possède. */
function cartesJouables() {
  const l = cards.filter(c => c.cat !== 'essence')
    .concat(reverses, promos.filter(p => p.cat !== 'essence'), uniques, typeof secretes !== 'undefined' ? secretes : []);
  return l.filter(c => Decks.jouable(Combat.carte(c.id) || c));
}

function ouvrirAtelier(id) {
  const d = id ? cbDecks().find(x => x.id === id) : null;
  const deck = d ? JSON.parse(JSON.stringify(d)) : { id: null, nom: 'Nouveau deck', cartes: {}, reserve: {}, couverture: null };
  if (d && d.starter) { deck.id = null; deck.nom = d.nom.replace('Starter · ', '') + ' (copie)'; delete deck.starter; }
  atelier = { deck, original: JSON.stringify(deck), filtres: { q: '', type: 'tous', coul: 'all', rar: 'all', toutes: false }, onglet: 'cartes' };
  cbVue = 'atelier';
  if (tab !== 'combats') return aller('combats');
  render();
  $('#main').scrollTo({ top: 0 });
}
function copierDeck(id) { ouvrirAtelier(id); if (atelier && atelier.deck.id) { atelier.deck.id = null; atelier.deck.nom += ' (copie)'; render(); } }

function importerDeck() {
  openSheet({
    title: 'Importer un deck',
    body: '<p class="muted small">Colle le code d\'un deck (il commence par M8D1).</p><input id="at-code" class="champ" placeholder="M8D1.c012x2…" autocomplete="off">',
    actions: [
      { label: 'Importer', primary: true, fn: () => {
        const v = Decks.decoder($('#at-code').value);
        if (!v) return toast('Ce code ne correspond à aucun deck.');
        closeSheet();
        ouvrirAtelier(null);
        atelier.deck.cartes = v.cartes;
        atelier.deck.reserve = v.reserve;
        atelier.deck.nom = 'Deck importé';
        atelier.deck.couverture = Decks.couverture(v.cartes);
        render();
      } },
      { label: 'Annuler', fn: closeSheet }
    ]
  });
  setTimeout(() => $('#at-code') && $('#at-code').focus(), 50);
}

/* ---------- La page ---------- */
function vAtelier() {
  if (!atelier) { cbVue = 'decks'; return vCombats(); }
  const d = atelier.deck;
  const n = Decks.total(d.cartes), nr = Decks.total(d.reserve);
  const err = Decks.verifier(d, save.col);
  const modifie = JSON.stringify(d) !== atelier.original;
  const ong = atelier.onglet;
  return `<div class="at${modifie ? ' modifie' : ''}">
    <header class="at-tete">
      <button class="at-retour" data-cb="at-retour" aria-label="Retour aux decks">${NAVICO.caret}</button>
      <input class="at-nom" id="at-nom" value="${h(d.nom)}" maxlength="32" aria-label="Nom du deck" autocomplete="off">
      <span class="at-compte${n === Combat.REGLE.CLUB ? ' ok' : ''}"><b class="tnum">${n}</b>/${Combat.REGLE.CLUB}</span>
    </header>
    <div class="at-etat${err.length ? '' : ' ok'}">${err.length
      ? `<span>${NAVICO.filtre}</span><p>${h(err[0])}${err.length > 1 ? ` <small>(+${err.length - 1})</small>` : ''}</p>`
      : `<span>${NAVICO.check}</span><p>Deck prêt à jouer.</p>`}</div>
    <nav class="at-onglets">
      <button class="${ong === 'cartes' ? 'on' : ''}" data-cb="at-onglet" data-v="cartes">Cartes</button>
      <button class="${ong === 'deck' ? 'on' : ''}" data-cb="at-onglet" data-v="deck">Deck <i class="tnum">${n}</i></button>
      <button class="${ong === 'reserve' ? 'on' : ''}" data-cb="at-onglet" data-v="reserve">Réserve <i class="tnum">${nr}</i></button>
    </nav>
    <div class="at-corps ong-${ong}">
      <section class="at-col at-cartes">${vAtCartes()}</section>
      <section class="at-col at-deck" data-defil="at-deck">${vAtDeck()}${vAtReserve()}</section>
    </div>
    <footer class="at-pied">
      <button class="btn" data-cb="at-sauver" ${err.length && !d.id ? '' : ''}>Enregistrer</button>
      <button class="btn ghost" data-cb="at-menu" aria-label="Plus d'actions">${NAVICO.more}</button>
    </footer>
  </div>`;
}

/* ---------- Les cartes ---------- */
function vAtCartes() {
  const f = atelier.filtres;
  return `<div class="at-filtres">
      <div class="at-cherche"><input id="at-q" type="search" placeholder="Chercher une carte, un mot-clé…" value="${h(f.q)}" autocomplete="off"></div>
      <div class="at-chips" data-defil="at-types">${AT_TYPES.map(([id, nom]) => `<button class="at-chip${f.type === id ? ' on' : ''}" data-cb="at-type" data-v="${id}">${nom}</button>`).join('')}</div>
      <div class="at-chips coul" data-defil="at-couls">
        <button class="at-chip${f.coul === 'all' ? ' on' : ''}" data-cb="at-coul" data-v="all">Toutes</button>
        ${['rose', 'orange', 'jade', 'violette', 'jaune', 'mauve', 'verte', 'bleue', 'azur', 'neutre'].map(k => `<button class="at-chip e${f.coul === k ? ' on' : ''}" data-cb="at-coul" data-v="${k}" title="${COLORS[k].nom}">${essIcon(k)}</button>`).join('')}
      </div>
      <label class="at-toutes"><input type="checkbox" id="at-toutes" ${f.toutes ? 'checked' : ''}> Montrer aussi les cartes que je n'ai pas</label>
    </div>
    <div class="at-grille" id="at-grille">${grilleAtelier()}</div>`;
}

function filtrerAtelier() {
  const f = atelier.filtres;
  const q = noacc(f.q);
  return cartesJouables().filter(c => {
    if (!f.toutes && !(save.col[c.id] > 0)) return false;
    if (f.type !== 'tous' && c.cat !== f.type) return false;
    if (f.coul !== 'all' && c.col !== f.coul) return false;
    if (q) {
      const txt = noacc([c.nom, c.kw && c.kw.nom, c.kw && c.kw.texte, ...(c.atks || []).map(a => a.nom + ' ' + a.effet), ...(c.fx || []), c.res].join(' '));
      if (!txt.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => ordreAtelier(a) - ordreAtelier(b));
}
const ordreAtelier = c => ({ joueur: 0, objet: 1000, coach: 2000, moment: 3000 }[c.cat] || 0) + (c.num || 0) + (c.rev ? 0.5 : 0) + (c.promo && !c.rev ? 500 : 0);

function grilleAtelier() {
  const l = filtrerAtelier();
  if (!l.length) return `<p class="muted at-vide">${atelier.filtres.toutes ? 'Aucune carte ne correspond.' : 'Aucune carte possédée ne correspond. Coche « Montrer aussi les cartes que je n\'ai pas » pour voir toute l\'extension.'}</p>`;
  const d = atelier.deck;
  return l.map(c => {
    const dans = d.cartes[c.id] || 0;
    const a = save.col[c.id] || 0;
    const cle = Decks.cleCopie(c.id);
    const totalCle = Object.keys(d.cartes).filter(id => Decks.cleCopie(id) === cle).reduce((s, id) => s + d.cartes[id], 0);
    const lim = Decks.limite(c.id);
    const plein = totalCle >= lim || dans >= a || Decks.total(d.cartes) >= Combat.REGLE.CLUB;
    return `<div class="at-carte${dans ? ' dedans' : ''}${a ? '' : ' absente'}">
      <button class="at-carte-c" data-cb="at-plus" data-v="${c.id}" ${plein ? 'aria-disabled="true"' : ''} aria-label="Ajouter ${h(c.nom)}">${renderCard(c)}</button>
      ${dans ? `<span class="at-n">${dans}</span><button class="at-moins" data-cb="at-moins" data-v="${c.id}" aria-label="Retirer">−</button>` : ''}
      <span class="at-info"><span class="at-poss">${a ? `${a} possédée${a > 1 ? 's' : ''}` : 'non possédée'}</span><button class="at-i" data-show="${c.id}" aria-label="Voir la carte">i</button></span>
    </div>`;
  }).join('');
}

/* ---------- Le deck ---------- */
function vAtDeck() {
  const d = atelier.deck;
  const ids = Object.keys(d.cartes).filter(id => d.cartes[id] > 0);
  if (!ids.length) return `<div class="at-deckvide"><p><b>Ton deck est vide.</b></p><p class="muted small">Touche les cartes pour les ajouter, ou laisse l'atelier compléter pour toi.</p>
    <button class="btn ghost" data-cb="at-auto">Compléter automatiquement</button></div>`;
  const groupes = [['joueur', 'Joueurs'], ['objet', 'Objets'], ['coach', 'Coachs'], ['moment', 'Moments']];
  const parType = t => ids.filter(id => (byId[id] || {}).cat === t).sort((a, b) => (byId[a].num || 0) - (byId[b].num || 0));
  const stats = statsDeck(d);
  return `${vStatsDeck(stats)}
    ${groupes.map(([t, nom]) => {
      const l = parType(t);
      if (!l.length) return '';
      const n = l.reduce((s, id) => s + d.cartes[id], 0);
      return `<div class="at-groupe"><h4>${nom} <i class="tnum">${n}</i></h4>${l.map(id => {
        const c = byId[id];
        const atk = c.cat === 'joueur' ? c.atks.map(a => `${Combat.totalCout(a.cout)}`).join('·') : '';
        return `<div class="at-ligne${d.couverture === id ? ' couv' : ''}">
          <span class="at-ligne-art" style="--art:url('${c.img ? new URL(c.img, document.baseURI).href : ''}')"></span>
          <span class="at-ligne-nom"><b>${nomH(c)}</b><small>${c.cat === 'joueur' ? `Déf ${c.def} · coût ${atk}` : (RAR[c.rar] || {}).nom || ''}</small></span>
          <span class="at-ligne-act">
            <button data-cb="at-couv" data-v="${id}" class="at-etoile${d.couverture === id ? ' on' : ''}" title="Carte de couverture" aria-label="En faire la couverture">★</button>
            <button data-cb="at-moins" data-v="${id}" aria-label="Retirer">−</button><b class="tnum">${d.cartes[id]}</b>
            <button data-cb="at-plus" data-v="${id}" aria-label="Ajouter">+</button></span>
        </div>`;
      }).join('')}</div>`;
    }).join('')}
    ${Decks.total(d.cartes) < Combat.REGLE.CLUB ? '<button class="btn ghost at-complete" data-cb="at-auto">Compléter automatiquement</button>' : ''}`;
}

function statsDeck(d) {
  const s = { joueur: 0, objet: 0, coach: 0, moment: 0, couts: [0, 0, 0, 0], defs: [], besoins: Decks.besoins(d.cartes), res: 0 };
  for (const id in d.cartes) {
    const c = byId[id];
    if (!c) continue;
    const n = d.cartes[id];
    s[c.cat] = (s[c.cat] || 0) + n;
    if (c.cat === 'joueur') {
      const min = Math.min(...c.atks.map(a => Combat.totalCout(a.cout)));
      s.couts[Math.min(3, Math.max(0, min - 1))] += n;
      for (let i = 0; i < n; i++) s.defs.push(c.def);
    }
    if (c.res) s.res += n;
  }
  s.defMoy = s.defs.length ? Math.round(s.defs.reduce((a, b) => a + b, 0) / s.defs.length) : 0;
  return s;
}

function vStatsDeck(s) {
  const tot = Math.max(1, s.joueur + s.objet + s.coach + s.moment);
  const maxC = Math.max(1, ...s.couts);
  const r = atelier.deck.reserve || {};
  const manque = Object.keys(s.besoins).filter(k => !(r[k] > 0));
  const b = Decks.bilan(atelier.deck);
  const rates = b.reperes.filter(x => !x.ok);
  return `<div class="at-stats">
    <button class="at-bilan" data-cb="bilan">${ETOILES_DECK(b.note)}<b>${b.nom}</b>
      <small>${rates.length ? `À revoir : ${rates.map(x => x.titre.toLowerCase()).join(', ')}` : 'Les trois repères d\'un bon deck sont tenus.'}</small>${NAVICO.caret}</button>
    <div class="at-types" title="Répartition">
      ${['joueur', 'objet', 'coach', 'moment'].map(t => s[t] ? `<i class="t-${t}" style="flex:${s[t]}"></i>` : '').join('')}
    </div>
    <div class="at-legende">${[['joueur', 'Joueurs'], ['objet', 'Objets'], ['coach', 'Coachs'], ['moment', 'Moments']].map(([t, n]) => `<span><i class="t-${t}"></i>${n} <b>${s[t]}</b></span>`).join('')}</div>
    <div class="at-courbe"><small>Coût de la moins chère de leurs attaques</small>
      <div>${s.couts.map((n, i) => `<span><i style="height:${Math.round(100 * n / maxC)}%"></i><b>${n}</b><small>${i + 1}${i === 3 ? '+' : ''}</small></span>`).join('')}</div></div>
    <p class="muted small">Défense moyenne ${s.defMoy || '—'} · ${s.res} carte${s.res > 1 ? 's' : ''} à Résilience${s.joueur && s.joueur < 12 ? ` · <b class="at-alerte">peu de Joueurs (${s.joueur})</b>` : ''}</p>
    ${manque.length ? `<p class="at-alerte">Tes attaques demandent ${manque.map(k => COLORS[k].nom).join(', ')}, absent${manque.length > 1 ? 'es' : 'e'} de ta Réserve.</p>` : ''}
  </div>`;
}

/* ---------- La Réserve ---------- */
function vAtReserve() {
  const r = atelier.deck.reserve || {};
  const b = Decks.besoins(atelier.deck.cartes);
  const nr = Decks.total(r);
  return `<div class="at-reserve"><h4>Réserve <i class="tnum">${nr}/${Combat.REGLE.RESERVE}</i></h4>
    <p class="muted small">Les Essences ne se possèdent pas : choisis-en ${Combat.REGLE.RESERVE}, des couleurs que tu veux. Le Neutre se paie avec n'importe laquelle.</p>
    <div class="at-ess">${Combat.COULEURS.map(k => `<div class="at-e${r[k] ? ' on' : ''}${b[k] ? ' besoin' : ''}" style="--ec:${COLORS[k].c}">
        ${essIcon(k)}<span>${COLORS[k].nom}${b[k] ? `<small>${b[k]} symbole${b[k] > 1 ? 's' : ''}</small>` : ''}</span>
        <button data-cb="at-ess-" data-v="${k}" ${r[k] ? '' : 'disabled'} aria-label="Moins">−</button><b class="tnum">${r[k] || 0}</b>
        <button data-cb="at-ess+" data-v="${k}" ${nr >= Combat.REGLE.RESERVE ? 'disabled' : ''} aria-label="Plus">+</button></div>`).join('')}</div>
    <button class="btn ghost" data-cb="at-res-auto">Réserve auto, d'après mes attaques</button>
  </div>`;
}

/* ---------- Les gestes ---------- */
function atelierAction(k, el) {
  if (!atelier) return;
  const d = atelier.deck, v = el.dataset.v;
  const R = Combat.REGLE;
  switch (k) {
    case 'at-retour': return quitterAtelier();
    case 'at-onglet': atelier.onglet = v; return render();
    case 'at-type': atelier.filtres.type = v; return majGrille(true);
    case 'at-coul': atelier.filtres.coul = v; return majGrille(true);
    case 'at-plus': {
      if (el.getAttribute('aria-disabled') === 'true') return expliquerPlein(v);
      d.cartes[v] = (d.cartes[v] || 0) + 1;
      if (!d.couverture) d.couverture = v;
      SFX.jouer('carte');
      return render();
    }
    case 'at-moins':
      if (d.cartes[v] > 1) d.cartes[v]--; else delete d.cartes[v];
      if (d.couverture === v && !d.cartes[v]) d.couverture = Decks.couverture(d.cartes);
      SFX.jouer('retour');
      return render();
    case 'at-couv': d.couverture = v; return render();
    case 'at-ess+': d.reserve[v] = (d.reserve[v] || 0) + 1; return render();
    case 'at-ess-': if (d.reserve[v] > 1) d.reserve[v]--; else delete d.reserve[v]; return render();
    case 'at-res-auto': d.reserve = Decks.reserveAuto(d.cartes, 'rose'); return render();
    case 'at-auto': return completerDeck();
    case 'at-sauver': return sauverDeck();
    case 'at-menu': return menuAtelier();
  }
}

function expliquerPlein(id) {
  const d = atelier.deck;
  const c = byId[id];
  if (Decks.total(d.cartes) >= Combat.REGLE.CLUB) return toast(`Le Club est plein (${Combat.REGLE.CLUB} cartes).`);
  if (!(save.col[id] > 0)) return toast('Tu ne possèdes pas cette carte.');
  if ((d.cartes[id] || 0) >= (save.col[id] || 0)) return toast(`Tu n'en as que ${save.col[id]}.`);
  const lim = Decks.limite(id);
  return toast(`${lim} exemplaire${lim > 1 ? 's' : ''} au plus de « ${c.nom} »${c.rev || Decks.cleCopie(id) !== id ? ' (Reverse et Promo comprises)' : ''}.`);
}

/* La recherche et les filtres redessinent la grille seule : le champ garde
   son curseur. */
function majGrille(tout) {
  if (tout) return render();
  const g = $('#at-grille');
  if (g) g.innerHTML = grilleAtelier();
}

function bindAtelier() {
  const q = $('#at-q');
  if (q && !q.dataset.lie) {
    q.dataset.lie = '1';
    q.addEventListener('input', () => { atelier.filtres.q = q.value; majGrille(false); });
  }
  const t = $('#at-toutes');
  if (t && !t.dataset.lie) {
    t.dataset.lie = '1';
    t.addEventListener('change', () => { atelier.filtres.toutes = t.checked; majGrille(false); });
  }
  const n = $('#at-nom');
  if (n && !n.dataset.lie) {
    n.dataset.lie = '1';
    n.addEventListener('input', () => { atelier.deck.nom = n.value.slice(0, 32); });
  }
}

/* Compléter le Club avec les meilleures cartes possédées, dans les couleurs
   déjà là (ou toutes, si le deck est vide). */
function completerDeck() {
  const d = atelier.deck;
  const R = Combat.REGLE;
  const couleurs = new Set(Object.keys(d.cartes).map(id => byId[id].col).filter(c => c !== 'neutre'));
  const cible = { joueur: 16, objet: 5, instant: 9 };
  const fam = c => (c.cat === 'joueur' ? 'joueur' : c.cat === 'objet' ? 'objet' : 'instant');
  const compte = f => Object.keys(d.cartes).filter(id => fam(byId[id]) === f).reduce((s, id) => s + d.cartes[id], 0);
  const cands = cartesJouables().filter(c => save.col[c.id] > 0 && (!couleurs.size || c.col === 'neutre' || couleurs.has(c.col)))
    .sort((a, b) => IA.valeurCarte(b.id) - IA.valeurCarte(a.id));
  const place = c => {
    const cle = Decks.cleCopie(c.id);
    const tot = Object.keys(d.cartes).filter(id => Decks.cleCopie(id) === cle).reduce((s, id) => s + d.cartes[id], 0);
    return tot < Decks.limite(c.id) && (d.cartes[c.id] || 0) < (save.col[c.id] || 0);
  };
  let garde = 0;
  while (Decks.total(d.cartes) < R.CLUB && garde++ < 200) {
    const manque = ['joueur', 'objet', 'instant'].sort((a, b) => (compte(a) / cible[a]) - (compte(b) / cible[b]));
    let pris = null;
    for (const f of manque) { pris = cands.find(c => fam(c) === f && place(c)); if (pris) break; }
    if (!pris) pris = cands.find(place);
    if (!pris) break;
    d.cartes[pris.id] = (d.cartes[pris.id] || 0) + 1;
  }
  if (!Decks.total(d.reserve)) d.reserve = Decks.reserveAuto(d.cartes, 'rose');
  if (!d.couverture) d.couverture = Decks.couverture(d.cartes);
  if (Decks.total(d.cartes) < R.CLUB) toast('Pas assez de cartes possédées pour compléter le Club.');
  render();
}

async function sauverDeck() {
  const d = atelier.deck;
  d.nom = (d.nom || '').trim() || 'Mon deck';
  if (!d.couverture) d.couverture = Decks.couverture(d.cartes);
  const ok = await agir(() => Backend.deckSauver(d), 'Deck enregistré.');
  if (!ok) return;
  atelier = null;
  cbVue = 'decks';
  render();
}

function menuAtelier() {
  const d = atelier.deck;
  openSheet({
    title: 'Le deck',
    body: `<p class="muted small">Le code du deck, à partager : un ami peut l'importer.</p><input class="champ" readonly value="${h(Decks.encoder(d))}" id="at-code-x">`,
    actions: [
      { label: 'Copier le code', primary: true, fn: () => {
        const v = $('#at-code-x').value;
        (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('Code copié.'), () => { $('#at-code-x').select(); toast('Sélectionne et copie le code.'); });
      } },
      { label: 'Vider le deck', fn: () => { closeSheet(); d.cartes = {}; d.couverture = null; render(); } },
      ...(d.id ? [{ label: 'Supprimer ce deck', fn: () => { closeSheet(); supprimerDeck(); } }] : []),
      { label: 'Fermer', fn: closeSheet }
    ]
  });
}

function supprimerDeck() {
  const d = atelier.deck;
  openSheet({
    title: `Supprimer « ${d.nom} » ?`,
    body: '<p class="muted">Les cartes restent dans ta collection.</p>',
    actions: [
      { label: 'Supprimer', primary: true, fn: async () => {
        closeSheet();
        const ok = await agir(() => Backend.deckSupprimer(d.id), 'Deck supprimé.');
        if (ok) { atelier = null; cbVue = 'decks'; render(); }
      } },
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}

function quitterAtelier() {
  const modifie = atelier && JSON.stringify(atelier.deck) !== atelier.original;
  const sortir = () => { atelier = null; cbVue = 'decks'; render(); };
  if (!modifie) return sortir();
  openSheet({
    title: 'Quitter sans enregistrer ?',
    body: '<p class="muted">Tes changements seront perdus.</p>',
    actions: [
      { label: 'Enregistrer', primary: true, fn: () => { closeSheet(); sauverDeck(); } },
      { label: 'Quitter', fn: () => { closeSheet(); sortir(); } },
      { label: 'Rester', fn: closeSheet }
    ]
  });
}
