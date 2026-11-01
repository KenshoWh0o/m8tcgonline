/* L'atelier de decks (version 3.0, réorganisé en 3.0.13).

   Le propriétaire, le 31 octobre : « très fonctionnel, mais très peu
   accessible, y a beaucoup de texte entassé et mal organisé ». Désormais :
     · en tête, collés en haut de l'écran : le retour, le nom, le menu,
       Enregistrer, puis trois onglets — Cartes, Club, Réserve —, les deux
       derniers avec leur jauge (40 cartes, 10 Essences) : on voit le deck
       se remplir sans quitter les cartes ;
     · dessous, une seule ligne : la prochaine étape (« Encore 12 cartes »,
       « Encore 4 Essences », la première erreur, « Prêt à jouer ») ;
     · Cartes : toucher une carte l'ajoute, les filtres se replient ;
       Club : la liste par type ; Réserve : « Régler d'après mes attaques »
       d'abord. Sur ordinateur, les cartes à gauche, le Club et la Réserve à
       droite ;
     · l'analyse (répartition, coûts, Défense) vit dans la feuille du
       bilan, avec les trois conseils des règles officielles.

   Rien n'est enregistré tant qu'on n'a pas appuyé sur « Enregistrer » : le
   serveur revérifie le deck (deck_sauver, supabase/installation/23_combats.sql). */
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
  /* Un Starter ne se copie qu'avec ses propres cartes (Decks.copieStarter) :
     la copie prend les versions qu'on possède. */
  if (d && d.starter) {
    const cp = Decks.copieStarter(d, save.col);
    if (!cp.ok) return toast(`Il te manque ${cp.nManque} carte${cp.nManque > 1 ? 's' : ''} de ce Starter pour le copier.`);
    deck.cartes = cp.cartes;
    deck.id = null; deck.nom = d.nom.replace('Starter · ', '') + ' (copie)'; delete deck.starter;
  }
  atelier = { deck, original: JSON.stringify(deck), filtres: { q: '', type: 'tous', coul: 'all', toutes: false }, onglet: 'cartes' };
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
  const modifie = JSON.stringify(d) !== atelier.original;
  const ong = atelier.onglet;
  return `<div class="at ong-${ong}${modifie ? ' modifie' : ''}">
    <div class="at-haut">
      <header class="at-tete">
        <button class="at-retour" data-cb="at-retour" aria-label="Retour aux decks">${NAVICO.caret}</button>
        <label class="at-nomlab"><span class="sr">Nom du deck</span><input class="at-nom" id="at-nom" value="${h(d.nom)}" maxlength="32" autocomplete="off">${NAVICO.crayon}</label>
        <button class="at-menu" data-cb="at-menu" aria-label="Partager, vider ou supprimer le deck">${NAVICO.more}</button>
        <button class="btn tiny at-sauver" data-cb="at-sauver">Enregistrer</button>
      </header>
      ${vAtOnglets(n, nr)}
    </div>
    ${vAtEtape(n, nr)}
    <div class="at-corps ong-${ong}">
      <section class="at-col at-cartes" id="at-p-cartes" role="tabpanel" aria-labelledby="at-t-cartes">${vAtCartes()}</section>
      <section class="at-col at-cote" data-defil="at-deck">
        <div class="at-deck" id="at-p-deck" role="tabpanel" aria-labelledby="at-t-deck">${vAtDeck()}</div>
        <div class="at-res" id="at-p-reserve" role="tabpanel" aria-labelledby="at-t-reserve">${vAtReserve()}</div>
      </section>
    </div>
  </div>`;
}

/* Les trois onglets ; le Club et la Réserve portent leur jauge. */
function vAtOnglets(n, nr) {
  const R = Combat.REGLE;
  const ong = atelier.onglet;
  const r = atelier.deck.reserve || {};
  const pastilles = Combat.COULEURS.flatMap(k => Array.from({ length: r[k] || 0 }, () => `<i style="--ec:${COLORS[k].c}"></i>`));
  while (pastilles.length < R.RESERVE) pastilles.push('<i></i>');
  const onglet = (v, plein, contenu, dit) => `<button role="tab" id="at-t-${v}" aria-controls="at-p-${v}" aria-selected="${ong === v}"
      class="at-tab${ong === v ? ' on' : ''}${plein ? ' plein' : ''}" data-cb="at-onglet" data-v="${v}"${dit ? ` aria-label="${dit}"` : ''}>${contenu}</button>`;
  return `<nav class="at-onglets" role="tablist" aria-label="Atelier">
      ${onglet('cartes', false, `<b>Cartes</b><small>Ajouter</small>`)}
      ${onglet('deck', n === R.CLUB, `<b>Club <span class="tnum">${n}/${R.CLUB}</span></b><span class="at-barre"><i style="width:${Math.min(100, n / R.CLUB * 100)}%"></i></span>`,
        `Club, ${n} cartes sur ${R.CLUB}`)}
      ${onglet('reserve', nr === R.RESERVE, `<b>Réserve <span class="tnum">${nr}/${R.RESERVE}</span></b><span class="at-pastilles">${pastilles.slice(0, R.RESERVE).join('')}</span>`,
        `Réserve, ${nr} Essences sur ${R.RESERVE}`)}
    </nav>`;
}

/* La prochaine étape, en une ligne. */
function vAtEtape(n, nr) {
  const R = Combat.REGLE;
  const err = Decks.verifier(atelier.deck, save.col);
  let etape;
  if (n < R.CLUB) etape = `<span>Encore <b class="tnum">${R.CLUB - n}</b> carte${R.CLUB - n > 1 ? 's' : ''} à choisir.</span><button class="at-lien" data-cb="at-auto">Compléter pour moi</button>`;
  else if (nr < R.RESERVE) etape = `<span>Encore <b class="tnum">${R.RESERVE - nr}</b> Essence${R.RESERVE - nr > 1 ? 's' : ''} à choisir.</span><button class="at-lien" data-cb="at-res-auto">Régler d'après mes attaques</button>`;
  else if (err.length) etape = `<span class="ko">${h(err[0])}</span>`;
  else etape = `<span class="ok">${NAVICO.check}Prêt à jouer.</span>`;
  return `<p class="at-etape">${etape}</p>`;
}

/* ---------- Les cartes ---------- */
function vAtCartes() {
  const f = atelier.filtres;
  const actifs = (f.type !== 'tous') + (f.coul !== 'all') + !!f.toutes;
  return `<div class="at-filtres">
      <div class="at-cherche">
        <input id="at-q" type="search" placeholder="Chercher une carte" value="${h(f.q)}" autocomplete="off" aria-label="Chercher une carte, un mot-clé">
        <button class="at-filtrer${atelier.filtresOuverts ? ' on' : ''}" data-cb="at-filtres" aria-expanded="${!!atelier.filtresOuverts}">${NAVICO.filtre}Filtres${actifs ? ` <i class="tnum">${actifs}</i>` : ''}</button>
      </div>
      ${atelier.filtresOuverts ? `<div class="at-filtres-l">
        <div class="at-chips" data-defil="at-types" role="group" aria-label="Type">${AT_TYPES.map(([id, nom]) => `<button class="at-chip${f.type === id ? ' on' : ''}" data-cb="at-type" data-v="${id}" aria-pressed="${f.type === id}">${nom}</button>`).join('')}</div>
        <div class="at-chips coul" data-defil="at-couls" role="group" aria-label="Couleur">
          <button class="at-chip${f.coul === 'all' ? ' on' : ''}" data-cb="at-coul" data-v="all" aria-pressed="${f.coul === 'all'}">Toutes</button>
          ${['rose', 'orange', 'jade', 'violette', 'jaune', 'mauve', 'verte', 'bleue', 'azur', 'neutre'].map(k => `<button class="at-chip e${f.coul === k ? ' on' : ''}" data-cb="at-coul" data-v="${k}" aria-pressed="${f.coul === k}" aria-label="${COLORS[k].nom}" title="${COLORS[k].nom}">${essIcon(k)}</button>`).join('')}
        </div>
        <button class="at-chip at-toutes${f.toutes ? ' on' : ''}" data-cb="at-toutes" aria-pressed="${!!f.toutes}">Aussi celles que je n'ai pas</button>
      </div>` : ''}
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
  if (!l.length) return `<p class="muted at-vide">${atelier.filtres.toutes ? 'Aucune carte ne correspond.' : 'Aucune de tes cartes ne correspond.'}</p>`;
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
      <span class="at-info"><span class="at-poss">${a ? `×${a}` : 'pas à toi'}</span><button class="at-i" data-show="${c.id}" aria-label="Voir ${h(c.nom)}">i</button></span>
    </div>`;
  }).join('');
}

/* ---------- Le deck ---------- */
function vAtDeck() {
  const d = atelier.deck;
  const ids = Object.keys(d.cartes).filter(id => d.cartes[id] > 0);
  if (!ids.length) return `<div class="at-deckvide"><b>Ton Club est vide.</b><p>Ajoute des cartes depuis l'onglet Cartes.</p>
    <button class="btn ghost" data-cb="at-onglet" data-v="cartes">Choisir des cartes</button></div>`;
  const groupes = [['joueur', 'Joueurs'], ['objet', 'Objets'], ['coach', 'Coachs'], ['moment', 'Moments']];
  const parType = t => ids.filter(id => (byId[id] || {}).cat === t).sort((a, b) => (byId[a].num || 0) - (byId[b].num || 0));
  const b = Decks.bilan(d);
  return `<button class="at-bilan" data-cb="bilan">${ETOILES_DECK(b.note)}<b>${b.nom}</b><small>Voir l'analyse</small>${NAVICO.caret}</button>
    ${groupes.map(([t, nom]) => {
      const l = parType(t);
      if (!l.length) return '';
      const n = l.reduce((s, id) => s + d.cartes[id], 0);
      return `<div class="at-groupe"><h4>${nom} <i class="tnum">${n}</i></h4>${l.map(id => {
        const c = byId[id];
        /* Le coût de chaque attaque : « 2 Essences », « 1 et 3 Essences ». */
        const couts = c.cat === 'joueur' ? c.atks.map(a => Combat.totalCout(a.cout)) : [];
        const atk = couts.length ? `${couts.join(' et ')} Essence${couts.length === 1 && couts[0] <= 1 ? '' : 's'}` : '';
        return `<div class="at-ligne${d.couverture === id ? ' couv' : ''}">
          <span class="at-ligne-art" style="--art:url('${c.img ? new URL(c.img, document.baseURI).href : ''}');--sc:${tcol(c)}"></span>
          <span class="at-ligne-nom"><b>${nomH(c)}</b><small>${c.cat === 'joueur' ? `Défense ${c.def} · ${atk}` : (RAR[c.rar] || {}).nom || ''}</small></span>
          <span class="at-ligne-act">
            <button data-cb="at-couv" data-v="${id}" class="at-etoile${d.couverture === id ? ' on' : ''}" aria-pressed="${d.couverture === id}" title="${d.couverture === id ? 'La couverture du deck' : 'En faire la couverture du deck'}" aria-label="${d.couverture === id ? 'Couverture du deck' : 'En faire la couverture du deck'}">★</button>
            <button data-cb="at-moins" data-v="${id}" aria-label="Retirer un ${h(c.nom)}">−</button><b class="tnum">${d.cartes[id]}</b>
            <button data-cb="at-plus" data-v="${id}" aria-label="Ajouter un ${h(c.nom)}">+</button></span>
        </div>`;
      }).join('')}</div>`;
    }).join('')}`;
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

/* L'analyse d'un deck, dans la feuille du bilan (ouvrirBilan, js/battle.js). */
function vStatsDeck(d) {
  const s = statsDeck(d);
  const maxC = Math.max(1, ...s.couts);
  const r = d.reserve || {};
  const manque = Object.keys(s.besoins).filter(k => !(r[k] > 0));
  return `<div class="at-stats">
    <div class="at-types" aria-hidden="true">
      ${['joueur', 'objet', 'coach', 'moment'].map(t => s[t] ? `<i class="t-${t}" style="flex:${s[t]}"></i>` : '').join('')}
    </div>
    <div class="at-legende">${[['joueur', 'Joueurs'], ['objet', 'Objets'], ['coach', 'Coachs'], ['moment', 'Moments']].map(([t, n]) => `<span><i class="t-${t}"></i>${n} <b>${s[t]}</b></span>`).join('')}</div>
    <div class="at-courbe"><small>Joueurs, selon le coût de leur attaque la moins chère</small>
      <div>${s.couts.map((n, i) => `<span><i style="height:${Math.round(100 * n / maxC)}%"></i><b>${n}</b><small>${i + 1}${i === 3 ? '+' : ''}</small></span>`).join('')}</div></div>
    <p class="muted small">Défense moyenne ${s.defMoy || '—'} · ${s.res} carte${s.res > 1 ? 's' : ''} à Résilience</p>
    ${manque.length ? `<p class="at-alerte">Tes attaques demandent ${manque.map(k => COLORS[k].nom).join(', ')}, absent${manque.length > 1 ? 'es' : 'e'} de ta Réserve.</p>` : ''}
  </div>`;
}

/* ---------- La Réserve ---------- */
/* Neuf tuiles, une par couleur : l'Essence, combien on en a mis, − et +.
   Ce que demandent les attaques est dit en une ligne au-dessus. */
function vAtReserve() {
  const R = Combat.REGLE;
  const r = atelier.deck.reserve || {};
  const b = Decks.besoins(atelier.deck.cartes);
  const nr = Decks.total(r);
  const besoins = Object.keys(b).sort((x, y) => b[y] - b[x]);
  /* Le bouton n'a rien à faire quand la Réserve est déjà celle qu'il poserait. */
  const auto = besoins.length ? Decks.reserveAuto(atelier.deck.cartes, 'rose') : null;
  const accordee = auto && Combat.COULEURS.every(k => (auto[k] || 0) === (r[k] || 0));
  return `<div class="at-reserve">
    <p class="at-res-dit">${besoins.length ? `Dans tes attaques : ${besoins.map(k => `<b style="--ec:${COLORS[k].c}">${b[k]} ${COLORS[k].nom}</b>`).join(', ')}. ` : ''}Le Neutre se paie avec n'importe quelle Essence.</p>
    ${!besoins.length ? '<p class="at-res-vide">Ajoute des Joueurs : leurs attaques diront quelles Essences prendre.</p>'
      : accordee ? `<p class="at-res-ok">${NAVICO.check}Réglée d'après tes attaques.</p>`
      : `<button class="btn${nr < R.RESERVE ? '' : ' ghost'} at-res-auto" data-cb="at-res-auto">Régler d'après mes attaques</button>`}
    <div class="at-ess">${Combat.COULEURS.map(k => `<div class="at-e${r[k] ? ' on' : ''}${b[k] ? ' besoin' : ''}" style="--ec:${COLORS[k].c}" role="group" aria-label="${COLORS[k].nom} : ${r[k] || 0}">
        <span class="at-e-t">${essIcon(k)}<b class="tnum" aria-hidden="true">${r[k] || 0}</b></span>
        <span class="at-e-nom" aria-hidden="true">${COLORS[k].nom}</span>
        <span class="at-e-act"><button data-cb="at-ess-" data-v="${k}" ${r[k] ? '' : 'disabled'} aria-label="Une Essence ${COLORS[k].nom} de moins">−</button><button data-cb="at-ess+" data-v="${k}" ${nr >= R.RESERVE ? 'disabled' : ''} aria-label="Une Essence ${COLORS[k].nom} de plus">+</button></span>
      </div>`).join('')}</div>
  </div>`;
}

/* ---------- Les gestes ---------- */
function atelierAction(k, el) {
  if (!atelier) return;
  const d = atelier.deck, v = el.dataset.v;
  const R = Combat.REGLE;
  switch (k) {
    case 'at-retour': return quitterAtelier();
    case 'at-onglet': {
      atelier.onglet = v;
      render();
      /* Sur ordinateur, le Club et la Réserve sont l'un sous l'autre, à
         droite : l'onglet amène la colonne à la bonne partie. */
      const cote = $('.at-cote'), part = $('#at-p-' + v);
      if (cote && part && matchMedia('(min-width:900px)').matches) cote.scrollTo({ top: Math.max(0, part.offsetTop - 4), behavior: RM() ? 'auto' : 'smooth' });
      return;
    }
    case 'at-filtres': atelier.filtresOuverts = !atelier.filtresOuverts; return render();
    case 'at-toutes': atelier.filtres.toutes = !atelier.filtres.toutes; return majGrille(true);
    case 'at-type': atelier.filtres.type = v; return majGrille(true);
    case 'at-coul': atelier.filtres.coul = v; return majGrille(true);
    case 'at-plus': {
      if (el.getAttribute('aria-disabled') === 'true') return expliquerPlein(v);
      d.cartes[v] = (d.cartes[v] || 0) + 1;
      if (!d.couverture) d.couverture = v;
      SFX.jouer('carte');
      const n = Decks.total(d.cartes);
      render();
      /* Le Club se remplit : on le dit une fois, au 40ᵉ ajout. */
      if (n === R.CLUB) toast(Decks.total(d.reserve) < R.RESERVE ? `Club complet. Reste la Réserve.` : 'Club complet.');
      else annonceLecteur(`Ajout : ${(byId[v] || {}).nom || 'une carte'}. ${n} sur ${R.CLUB}.`);
      return;
    }
    case 'at-moins': {
      if (d.cartes[v] > 1) d.cartes[v]--; else delete d.cartes[v];
      if (d.couverture === v && !d.cartes[v]) d.couverture = Decks.couverture(d.cartes);
      SFX.jouer('retour');
      render();
      return annonceLecteur(`Retrait : ${(byId[v] || {}).nom || 'une carte'}. ${Decks.total(d.cartes)} sur ${R.CLUB}.`);
    }
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
  return toast(`${lim} exemplaires au plus de « ${c.nom} » ${(COLORS[byId[id].col] || {}).nom || ''} : même nom et même couleur, toutes versions comprises.`);
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
  const n = $('#at-nom');
  if (n && !n.dataset.lie) {
    n.dataset.lie = '1';
    n.addEventListener('input', () => { atelier.deck.nom = n.value.slice(0, 32); });
  }
}

/* Compléter le Club avec les meilleures cartes possédées, dans les couleurs
   déjà là (ou toutes, si le deck est vide), vers la composition des decks de
   l'IA (Decks.CIBLES : 18 Joueurs, 8 Objets, 14 Coachs et Moments). */
function completerDeck() {
  const d = atelier.deck;
  const R = Combat.REGLE;
  const couleurs = new Set(Object.keys(d.cartes).map(id => byId[id].col).filter(c => c !== 'neutre'));
  const cible = Decks.CIBLES;
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
