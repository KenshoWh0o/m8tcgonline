/* La maîtrise des cartes, et la carte fétiche (version 3.0.7).

   Ce que deviennent les Fragments quand la collection est complète : une
   carte qu'on possède s'améliore, en cinq niveaux, et chaque niveau ajoute
   une finition, comme les versions premium d'une carte imprimée — partout
   où elle apparaît, en combat compris (version 3.0.11, refonte entière) :

     1 · Satin    un vernis : un reflet posé, une lumière qui glisse ;
     2 · Écrin    un fin cadre de métal autour de la carte, à la couleur de
                  son Essence (le liseré de la 3.0.11, posé sur le bord de
                  la carte, la dénaturait : version 3.0.12) ;
     3 · Holo     son illustration devient holographique ;
     4 · Lumière  une lumière fait le tour de l'écrin, des étincelles
                  montent, un halo ; en combat, elle entre dans un éclat, et
                  ses coups brillent ;
     5 · Légende  un écrin prismatique et trois étoiles du logo qui
                  scintillent ; en combat, une onde de choc.
   En combat, chaque niveau se voit à l'entrée de la carte — un Joueur posé,
   mais aussi un Moment ou un Coach joué, un Objet lié (mzEffetCombat). La
   carte reste intacte : c'est sa finition qui change (css/maitrise.css).

   Ce que coûte un niveau : des Fragments, et des exemplaires de la carte.
   Le conflit avec les decks (il en faut trois pour jouer une carte trois
   fois) est réglé ainsi : la maîtrise ne prend que les exemplaires EN TROP —
   au-delà de ce qu'un deck peut contenir (trois, quelle que soit la rareté,
   depuis les règles officielles de la 3.0.12 ; deux, ou un pour une
   Légendaire ou une Secrète, avant), au-delà de ce que le joueur a choisi de garder, et hors de
   ce qui est promis dans un échange. Il en manque ? Chacun se remplace par
   son prix de fabrication en Fragments : la maîtrise n'est jamais bloquée,
   même avec une seule Légendaire. La maîtrise vaut pour la carte (toutes
   ses copies) ; sa Reverse la partage.

   Les montants sont aussi côté serveur (supabase/installation/28_maitrise.sql), qui
   revérifie tout : les deux doivent rester d'accord. */
"use strict";

const MAITRISE = {
  max: 5,
  noms: ['Satin', 'Reflet', 'Holo', 'Lumière', 'Légende'],
  dit: [
    'Un vernis : la lumière glisse sur la carte.',
    'L\'illustration prend un reflet de métal, à la couleur de son Essence.',
    'L\'illustration devient holographique, des reflets en étoile s\'y allument.',
    'Éclairée de derrière : son bord brille, des rais tombent sur l\'illustration.',
    'L\'étoile du logo s\'allume sur son coin. En combat, une onde de choc.'
  ],
  /* Les Fragments d'un niveau : la base de la rareté, fois 1, 2, 4, 7, 11
     — 25 fois la base pour la Légende : 2 000 pour une Commune, 20 000 pour
     une Légendaire (version 3.0.13 ; docs/economie-3.0.md, 3 ter). */
  base: { C: 80, PC: 120, R: 250, E: 500, L: 800, S: 800 },
  mult: [1, 2, 4, 7, 11],
  /* Les exemplaires que consomme chaque niveau, selon la rareté : plus une
     carte est rare, moins on en demande, mais toujours au moins un. Depuis
     la 3.0.13, il faut les avoir : aucun ne se remplace par des Fragments. */
  copies: { C: [2, 3, 4, 5, 6], PC: [2, 2, 3, 4, 5], R: [1, 2, 2, 3, 4], E: [1, 1, 2, 2, 3], L: [1, 1, 1, 2, 2], S: [1, 1, 1, 1, 1] }
};
const CHIFFRES_ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V'];

/* La carte dont on parle : une Reverse partage la maîtrise de sa carte. */
const carteMaitrise = c => (c && c.rev && c.base ? byId[c.base] || c : c);
/* Ce qui se maîtrise : les cartes de l'extension (sauf les Essences) et les
   Secrètes ; ni les Promos, ni les Essences Brillantes, ni l'Unique. */
const maitrisable = c => {
  const k = carteMaitrise(c);
  return !!k && !!MAITRISE.copies[k.rar] && k.cat !== 'essence' && (!k.promo || !!k.secrete);
};
/* Le niveau d'une carte, pour soi ; `niveaux` : ceux d'un autre joueur. */
const niveauMaitrise = (c, niveaux) => {
  const k = carteMaitrise(c);
  const n = k && (niveaux || (save && save.maitrises) || {})[k.id];
  return Math.max(0, Math.min(MAITRISE.max, n || 0));
};
/* Ce qu'un deck peut en contenir (REGLE.COPIES, js/combat/moteur.js) :
   trois, quelle que soit la rareté (règles officielles, 3.0.12). */
const limiteDeck = () => (typeof Combat !== 'undefined' ? Combat.REGLE.COPIES : 3);

/* Les Fragments du niveau n d'une carte de rareté `rar`. */
const fragmentsMaitrise = (rar, n) => (MAITRISE.base[rar] || 0) * (MAITRISE.mult[n - 1] || 0);

/* Les exemplaires d'une carte, et ceux que la maîtrise peut prendre : tous,
   sauf ce qu'un deck peut contenir (trois), ce que le joueur a choisi de
   garder s'il en garde plus, et ce qu'il a promis dans un échange en
   attente. Seuls les exemplaires de la carte classique comptent. */
function exemplairesMaitrise(c) {
  const k = carteMaitrise(c);
  const possede = mesEx(k.id);
  const deck = limiteDeck(k);
  const garde = aGarder(k);
  const promis = (typeof Backend !== 'undefined' && Backend.trades || [])
    .filter(t => t.sens === 'envoyee' && t.status === 'pending' && t.offer === k.id).length;
  const protege = Math.max(deck, garde);
  return { possede, deck, garde, promis, protege, dispo: Math.max(0, possede - protege - promis) };
}

/* Ce que coûte le niveau suivant, et ce qu'on a. null : déjà au maximum. */
function coutMaitrise(c) {
  const k = carteMaitrise(c);
  const n = niveauMaitrise(k) + 1;
  if (n > MAITRISE.max) return null;
  const copies = (MAITRISE.copies[k.rar] || [])[n - 1] || 0;
  const ex = exemplairesMaitrise(k);
  const frag = fragmentsMaitrise(k.rar, n);
  const solde = (typeof save !== 'undefined' && save.fragments) || 0;
  return Object.assign({ n, frag, copies, solde, assezEx: ex.dispo >= copies, assezFrag: solde >= frag }, ex);
}

/* ---------- L'allure ---------- */
/* Ce que renderCard ajoute à une carte maîtrisée : des classes sur son
   enveloppe, et les couches des finitions — dans la carte (le vernis,
   l'holo, les étincelles, les étoiles : la carte les découpe à sa forme),
   autour d'elle (le halo, l'écrin et sa lumière). `calme` : sans animation
   (une grille de cent cartes). L'arène fait de même (js/combat/table.js,
   htmlCarte et mzAutour). L'ordre des couches compte : le halo sous
   l'écrin, sa lumière par-dessus ; dans la carte, les étoiles au-dessus de
   tout. */
/* L'étoile du logo, à quatre branches : l'insigne, les étoiles de la
   Légende. */
const MZ_ETOILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .6c1 6.6 4.3 10 11.4 11.4C16.3 13.4 13 16.8 12 23.4 11 16.8 7.7 13.4.6 12 7.7 10.6 11 7.2 12 .6Z"/></svg>';
/* La même, au prisme des Secrètes (l'insigne de la Légende). Le dégradé
   porte un identifiant fixe : identique partout, il peut être défini
   plusieurs fois dans la page. */
const MZ_ETOILE_V = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="mzprisme" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc4e4"/><stop offset=".35" stop-color="#d9c9ff"/><stop offset=".65" stop-color="#b9e4ff"/><stop offset="1" stop-color="#bff3dc"/></linearGradient></defs><path d="M12 .6c1 6.6 4.3 10 11.4 11.4C16.3 13.4 13 16.8 12 23.4 11 16.8 7.7 13.4.6 12 7.7 10.6 11 7.2 12 .6Z"/></svg>';
const mzDedans = n => '<i class="mz-v" aria-hidden="true"></i>'
  + (n >= 2 ? '<i class="mz-f" aria-hidden="true"></i>' : '')
  + (n >= 3 ? '<i class="mz-e" aria-hidden="true"><b></b><b></b><b></b></i>' : '')
  + (n >= 4 ? '<i class="mz-r" aria-hidden="true"></i><i class="mz-p" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></i>' : '');
const mzAutourDe = n => (n >= 5 ? '<i class="mz-c" aria-hidden="true"></i>' : '')
  + (n >= 4 ? '<i class="mz-a" aria-hidden="true"></i>' : '');
function maitriseEnveloppe(c, n, calme) {
  if (!n) return { cls: '', style: '', dedans: '', autour: '' };
  const k = carteMaitrise(c);
  return { cls: ` mz mz-${n}${calme ? ' mz-calme' : ''}`, style: `--mc:${tcol(k)}`, dedans: mzDedans(n), autour: mzAutourDe(n) };
}

/* Le petit insigne d'une maîtrise : « ✦ III » (version 3.0.11 : l'étoile du
   logo et le chiffre, sur une pastille graphite ; plus de jaune). */
const insigneMaitrise = n => (n ? `<i class="mz-ins mz-ins-${n}" title="Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]}">${n >= 5 ? MZ_ETOILE_V : MZ_ETOILE}<b>${CHIFFRES_ROMAINS[n]}</b></i>` : '');

/* ---------- La fiche : l'onglet Maîtrise (version 3.0.8) ----------
   Tout tient sans défiler : la frise des cinq niveaux (touchée, elle montre
   ce niveau sur la carte, au-dessus ; touchée encore, elle revient), le
   détail du niveau regardé, ce que coûte le suivant, un seul bouton. */
function vMaitriseFiche(c) {
  const k = carteMaitrise(c);
  if (!maitrisable(k)) {
    return `<p class="mz-rien">${k && k.cat === 'essence' ? 'Les Essences ne se maîtrisent pas.' : 'Cette carte ne se maîtrise pas : seules les cartes de l\'extension et les Secrètes le peuvent.'}</p>`;
  }
  const n = niveauMaitrise(k);
  const vu = VW && VW.c === c && VW.apercu ? VW.apercu : 0;
  const en = Backend.mode === 'cloud';
  const possede = mesEx(k.id) > 0;
  const cout = coutMaitrise(k);
  /* La frise. */
  const etapes = MAITRISE.noms.map((nom, i) => {
    const m = i + 1;
    const etat = m <= n ? 'fait' : m === n + 1 ? 'suivant' : 'loin';
    return `<button class="mz-etape ${etat}${m === 5 ? ' legende' : ''}${vu === m ? ' vu' : ''}" data-v="mz-voir" data-n="${m}" aria-pressed="${vu === m}"
        aria-label="Niveau ${CHIFFRES_ROMAINS[m]}, ${nom}${m <= n ? ', atteint' : ''}"><b>${CHIFFRES_ROMAINS[m]}</b><small>${nom}</small></button>`;
  }).join('');
  /* Le niveau regardé : celui touché, sinon le suivant (ou la Légende). */
  const d = vu || Math.min(n + 1, MAITRISE.max);
  const statut = vu ? 'Aperçu sur la carte · touche encore pour revenir'
    : d <= n ? 'Atteint' : d === n + 1 ? 'Prochain niveau' : '';
  const detail = `<div class="mz-detail${d <= n ? ' fait' : ''}">
      <b>${CHIFFRES_ROMAINS[d]} · ${MAITRISE.noms[d - 1]}</b><small>${h(statut)}</small>
      <p>${h(MAITRISE.dit[d - 1])}</p></div>`;
  let action = '';
  if (!en) action = '<p class="mz-rien">La maîtrise se joue en ligne.</p>';
  else if (!possede) action = `<p class="mz-rien">Il faut posséder ${c.rev ? 'sa carte classique' : 'la carte'} pour la maîtriser.</p>`;
  else if (!cout) action = `<p class="mz-max">${insigneMaitrise(MAITRISE.max)}Maîtrise au maximum : c'est une Légende.</p>`;
  else action = vMaitriseAction(k, cout, c.rev);
  /* Version 3.0.12 : la maîtrise avant les 122 retarde la collection de
     trois à quatre semaines en médiane (simulation, tools/equilibre-maitrise.py) ;
     comme la fiche d'une Reverse à fabriquer, on le rappelle. */
  const manquent = en && cout && typeof possedees === 'function' ? cards.length - possedees(cards) : 0;
  return `<div class="mz-fiche" style="--mc:${tcol(k)}">
    <div class="mz-frise" style="--n:${n}">${etapes}</div>
    ${detail}
    ${action}
    ${manquent > 0 ? `<p class="mz-note mz-rappel">Il te manque ${manquent} carte${manquent > 1 ? 's' : ''} de l'extension : ces Fragments peuvent d'abord ${manquent > 1 ? 'les' : 'la'} fabriquer.</p>` : ''}
    ${vBaremeMaitrise(k, n)}
  </div>`;
}

/* Ce qu'il faut pour le niveau suivant (version 3.0.13) : deux conditions,
   cochées ou non — les exemplaires qu'il consomme, les Fragments —, d'où
   viennent les exemplaires en trop, et le bouton. Le bouton demande
   d'abord une confirmation, posée à sa place : des exemplaires consommés ne
   reviennent pas. */
const MZ_OUI = '<svg class="mz-coche" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const MZ_NON = '<svg class="mz-coche" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
function vMaitriseAction(k, cout, depuisReverse) {
  const s = cout.copies > 1 ? 's' : '';
  const ex = cout.assezEx
    ? `${cout.dispo} en trop`
    : `${cout.dispo} en trop · il en manque ${cout.copies - cout.dispo}`;
  const fr = cout.assezFrag
    ? `tu en as ${fmtN(cout.solde)}`
    : `il en manque ${fmtN(cout.frag - cout.solde)}`;
  const conditions = `<ul class="mz-req" aria-label="Pour passer au niveau ${CHIFFRES_ROMAINS[cout.n]}">
      <li class="${cout.assezEx ? 'ok' : 'non'}">${NAVICO.cards}<span><b class="tnum">${cout.copies} exemplaire${s}</b> consommé${s}</span><em class="tnum">${ex}</em>${cout.assezEx ? MZ_OUI : MZ_NON}</li>
      <li class="${cout.assezFrag ? 'ok' : 'non'}">${NAVICO.fragment}<span><b class="tnum">${fmtN(cout.frag)}</b> Fragments</span><em class="tnum">${fr}</em>${cout.assezFrag ? MZ_OUI : MZ_NON}</li>
    </ul>`;
  /* D'où viennent les exemplaires en trop. */
  const parts = [`${cout.garde > cout.deck ? `<b>${cout.protege}</b> gardés (ton réglage)` : `<b>${cout.deck}</b> restent pour tes decks`}`];
  if (cout.promis) parts.push(`<b>${cout.promis}</b> promis dans un échange`);
  parts.push(`<b>${cout.dispo}</b> en trop`);
  const d = `<p class="mz-ex">${depuisReverse ? 'Exemplaires de la carte classique : tu' : 'Tu'} en as <b>${cout.possede}</b> : ${parts.join(', ')}.</p>`;
  const pret = cout.assezEx && cout.assezFrag;
  if (pret && VW && VW.mzConfirme === cout.n) {
    return `${conditions}
      <div class="mz-confirme" role="group" aria-label="Confirmer">
        <p><b>${cout.copies} exemplaire${s}</b> de « ${h(k.nom)} » ${cout.copies > 1 ? 'seront consommés' : 'sera consommé'} et <b>${fmtN(cout.frag)} Fragments</b> dépensés. C'est définitif.</p>
        <div class="mz-confirme-acts"><button class="btn" data-v="mz-ok">Monter au niveau ${CHIFFRES_ROMAINS[cout.n]}</button><button class="btn ghost" data-v="mz-non">Annuler</button></div>
      </div>${d}`;
  }
  const pourquoi = pret ? '' : !cout.assezEx
    ? `<p class="mz-rien">Les exemplaires viennent des boosters et des échanges.</p>`
    : `<p class="mz-rien">Le recyclage des doublons rapporte des Fragments.</p>`;
  return `${conditions}
    <button class="btn mz-go" data-v="maitriser" ${pret ? '' : 'disabled'}>Monter au niveau ${CHIFFRES_ROMAINS[cout.n]}</button>
    ${pourquoi}${d}`;
}

/* Le coût de chaque niveau, pour cette rareté. */
function vBaremeMaitrise(k, n) {
  const cop = MAITRISE.copies[k.rar] || [];
  let te = 0, tf = 0;
  const lignes = MAITRISE.noms.map((nom, i) => {
    const f = fragmentsMaitrise(k.rar, i + 1);
    te += cop[i] || 0; tf += f;
    return `<tr class="${i < n ? 'fait' : i === n ? 'suivant' : ''}"><th scope="row">${CHIFFRES_ROMAINS[i + 1]} · ${nom}</th><td class="tnum">${cop[i] || 0}</td><td class="tnum">${fmtN(f)}</td></tr>`;
  }).join('');
  return `<table class="mz-bareme">
    <caption>Le coût de chaque niveau · ${h((RAR[k.rar] || {}).nom || '')}</caption>
    <thead><tr><th scope="col">Niveau</th><th scope="col">Exemplaires</th><th scope="col">Fragments</th></tr></thead>
    <tbody>${lignes}</tbody>
    <tfoot><tr><th scope="row">Jusqu'à la Légende</th><td class="tnum">${te}</td><td class="tnum">${fmtN(tf)}</td></tr></tfoot>
  </table>`;
}

/* Le bouton : d'abord la confirmation, à sa place. */
function demanderMaitriseVw() {
  const c = VW && VW.c;
  if (!c) return;
  const cout = coutMaitrise(c);
  if (!cout || !cout.assezEx || !cout.assezFrag) return;
  VW.mzConfirme = cout.n;
  redessinerMaitriseVw();
  const b = document.querySelector('#viewer [data-v="mz-ok"]');
  if (b) b.focus({ preventScroll: true });
}
function annulerMaitriseVw() {
  if (!VW) return;
  VW.mzConfirme = 0;
  redessinerMaitriseVw();
  const b = document.querySelector('#viewer [data-v="maitriser"]');
  if (b) b.focus({ preventScroll: true });
}
function redessinerMaitriseVw() {
  const p = document.querySelector('#viewer .vw-page[data-p="maitrise"]');
  if (p && VW) { p.innerHTML = vMaitriseFiche(VW.c); hauteurPagesVw(); }
}

async function maitriserVw() {
  const c = VW && VW.c;
  if (!c) return;
  const k = carteMaitrise(c);
  const cout = coutMaitrise(k);
  if (!cout) return;
  const b = document.querySelector('#viewer [data-v="mz-ok"]');
  if (b) b.disabled = true;
  try {
    await Backend.maitriser(k.id);
  } catch (e) {
    toast(e.message || 'La maîtrise n\'est pas passée.');
    if (VW) VW.mzConfirme = 0;
    redessinerMaitriseVw();
    return;
  }
  if (VW) VW.mzConfirme = 0;
  /* La carte change d'allure sous les yeux : elle est redessinée en place,
     puis la montée se joue sur elle (jouerMonteeMaitrise), avec les
     exemplaires consommés. */
  rafraichirFicheVw();
  render();
  await jouerMonteeMaitrise(document.querySelector('#vwc'), cout.n, tcol(k), { copies: cout.copies, carte: k });
}

/* La montée d'un niveau, sur une carte affichée (la fiche ; l'aperçu du
   Labo, js/lab.js). Version 3.0.13 : on voit ce qu'elle a coûté. Les
   exemplaires consommés montent un à un dans la carte et s'y fondent ; la
   carte, encore à son ancien niveau, se soulève ; un éclat blanc, et elle
   prend sa nouvelle finition sous les yeux ; le chiffre du niveau
   s'inscrit sur elle avec son nom ; des étincelles de sa couleur, un
   carillon plus riche de niveau en niveau.
   `el` contient la carte (son .cwrap), déjà dessinée à son nouveau niveau ;
   `o.carte`, `o.copies` : la carte et ce qu'elle a consommé (sans eux, pas
   d'exemplaires qui volent). Avec les mouvements réduits : le carillon et
   un message. */
function jouerMonteeMaitrise(el, n, mc, o) {
  o = o || {};
  const w = el && el.querySelector('.cwrap');
  const copies = Math.max(0, Math.min(o.copies || 0, 8));
  const carillon = n >= 5 ? 'legend' : n >= 3 ? 'epique' : 'rare';
  if (!w || RM()) {
    SFX.jouer(carillon);
    vibrer(n >= 5 ? [30, 60, 40] : 30);
    toast(`Maîtrise ${CHIFFRES_ROMAINS[n]} · ${MAITRISE.noms[n - 1]}${copies ? ` · ${copies} exemplaire${copies > 1 ? 's' : ''} consommé${copies > 1 ? 's' : ''}` : ''}`);
    return Promise.resolve();
  }
  w.style.setProperty('--mc', mc);
  /* L'ancien niveau d'abord : la nouvelle finition arrive avec l'éclat. */
  if (o.carte) poserMaitrise(w, o.carte, n - 1);
  const img = o.carte && o.carte.img;
  let t = 0;
  if (copies && img) {
    for (let i = 0; i < copies; i++) {
      const x = document.createElement('i');
      x.className = 'mz-copie';
      x.setAttribute('aria-hidden', 'true');
      x.style.backgroundImage = `url('${img}')`;
      el.appendChild(x);
      const dx = (i - (copies - 1) / 2) * Math.min(26, 120 / copies);
      const r = (i - (copies - 1) / 2) * 7;
      const d = 120 + i * 110;
      x.animate([
        { transform: `translate(${dx}%, 78%) rotate(${r}deg) scale(.36)`, opacity: 0 },
        { transform: `translate(${dx}%, 62%) rotate(${r}deg) scale(.36)`, opacity: 1, offset: .3 },
        { transform: 'translate(0, 0) rotate(0deg) scale(.16)', opacity: 0 }
      ], { duration: 820, delay: d, easing: 'cubic-bezier(.55,0,.7,.25)', fill: 'both' }).finished.then(() => x.remove(), () => x.remove());
      setTimeout(() => SFX.jouer('carte'), d + 560);
    }
    t = 120 + (copies - 1) * 110 + 820;
  }
  return new Promise(fin => setTimeout(() => {
    SFX.jouer(carillon);
    vibrer(n >= 5 ? [30, 60, 40] : 30);
    if (o.carte) poserMaitrise(w, o.carte, n);
    w.classList.remove('mz-monte'); void w.offsetWidth; w.classList.add('mz-monte');
    const sceau = document.createElement('span');
    sceau.className = 'mz-sceau';
    sceau.innerHTML = `<b>${CHIFFRES_ROMAINS[n]}</b><small>${MAITRISE.noms[n - 1]}</small>`;
    w.appendChild(sceau);
    if (typeof FX !== 'undefined') {
      const r = w.getBoundingClientRect();
      const couleurs = n >= 5 ? ['#fff', mc, color2(mc), '#ffffff'] : ['#fff', mc, color2(mc)];
      setTimeout(() => FX.burst(r.left + r.width / 2, r.top + r.height * .45, { n: 30 + n * 12, colors: couleurs, speed: 7, size: 3.2, g: .08 }), 120);
    }
    setTimeout(() => { w.classList.remove('mz-monte'); sceau.remove(); fin(); }, 1750);
  }, t));
}

/* En combat (js/combat/table.js) et dans l'aperçu du Labo : ce que fait une
   carte maîtrisée en entrant — un Joueur posé, un Moment ou un Coach joué
   (montré en grand), un Objet lié (sur le Joueur qui le reçoit). Avant la
   3.0.11, seuls les Joueurs des niveaux IV et V avaient leur entrée.
     I et plus   un trait de lumière passe sur la carte ;
     III et plus un anneau de sa couleur part d'elle ;
     IV et plus  un éclat, des étincelles, un carillon ;
     V           une onde de choc traverse le plateau, qui tremble.
   `x` : l'élément de la carte (positionné) ; `o.scene` : le plateau, où
   poser l'anneau et l'onde ; `o.secousse(force)` : faire trembler le
   plateau ; `o.vitesse` : le réglage « Animations rapides » de l'arène.
   Renvoie une promesse : le temps à attendre avant la suite. */
function mzEffetCombat(x, n, mc, o) {
  o = o || {};
  if (!x || !n) return Promise.resolve();
  const calme = RM();
  if (n >= 4) SFX.jouer(n >= 5 ? 'legend' : 'rare');
  else SFX.jouer('piece');
  if (calme) return Promise.resolve();
  const trait = document.createElement('i');
  trait.className = 'mz-trait';
  trait.style.setProperty('--mc', mc);
  x.appendChild(trait);
  setTimeout(() => trait.remove(), 800);
  const scene = o.scene || x.offsetParent || document.body;
  const r = x.getBoundingClientRect(), sc = scene.getBoundingClientRect();
  const centre = el => { el.style.left = (r.left - sc.left + r.width / 2) + 'px'; el.style.top = (r.top - sc.top + r.height / 2) + 'px'; el.style.setProperty('--mc', mc); };
  if (n >= 3) {
    const a = document.createElement('i');
    a.className = 'mz-anneau';
    centre(a);
    scene.appendChild(a);
    setTimeout(() => a.remove(), 1000);
  }
  if (n >= 4) {
    x.style.setProperty('--mc', mc);
    x.classList.remove('mz-entree'); void x.offsetWidth; x.classList.add('mz-entree');
    setTimeout(() => x.classList.remove('mz-entree'), 1100);
    if (typeof FX !== 'undefined') FX.burst(r.left + r.width / 2, r.top + r.height / 2, { n: n >= 5 ? 46 : 30, colors: ['#fff', mc, mc, color2(mc)], speed: 6, size: 3, g: .1 });
  }
  if (n >= 5) {
    const w = document.createElement('i');
    w.className = 'mz-onde';
    centre(w);
    scene.appendChild(w);
    setTimeout(() => w.remove(), 1300);
    if (o.secousse) o.secousse(6);
  }
  const ms = n >= 5 ? 700 : n >= 4 ? 420 : n >= 3 ? 260 : 120;
  return new Promise(fin => setTimeout(fin, ms * (o.vitesse || 1)));
}
/* Une seconde teinte des étincelles : la couleur, éclaircie de moitié. Les
   particules sont dessinées dans un canvas : une couleur #rrggbb, pas un
   color-mix(). */
function color2(mc) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(mc || '').trim());
  if (!m) return '#ffffff';
  const v = parseInt(m[1], 16);
  return '#' + [16, 8, 0].map(k => Math.round((((v >> k) & 255) + 255) / 2).toString(16).padStart(2, '0')).join('');
}

/* L'aperçu du niveau suivant, posé sur la carte de la fiche le temps de le
   regarder ; un second appui le retire. */
function voirNiveauVw(m) {
  const c = VW && VW.c;
  if (!c) return;
  const n = niveauMaitrise(c);
  /* Touché encore, ou son niveau actuel : on revient à la carte telle qu'elle est. */
  VW.apercu = VW.apercu === m || m === n ? 0 : m;
  /* La carte change de finition en place : ses classes et ses calques, pas
     son image (version 3.0.12 ; la redessiner rechargeait l'illustration). */
  const w = document.querySelector('#vwc .cwrap');
  if (w) poserMaitrise(w, c, VW.apercu || n);
  const p = document.querySelector('#viewer .vw-page[data-p="maitrise"]');
  if (p) { p.innerHTML = vMaitriseFiche(c); hauteurPagesVw(); }
}

/* La finition d'une carte déjà affichée (renderCard), changée sans la
   redessiner : les classes de son enveloppe, les calques dans la carte et
   autour d'elle. */
function poserMaitrise(w, c, n) {
  const e = maitriseEnveloppe(c, n, w.classList.contains('mz-calme'));
  [...w.classList].filter(k => /^mz(-\d)?$/.test(k)).forEach(k => w.classList.remove(k));
  w.querySelectorAll(':scope>.card>:is(.mz-v,.mz-f,.mz-e,.mz-r,.mz-p),:scope>:is(.mz-a,.mz-c)').forEach(x => x.remove());
  if (!n) {
    w.style.removeProperty('--mc');
    if (typeof VW !== 'undefined' && VW && w.closest('#vwc')) VW.reflets = refletsVw();
    return;
  }
  w.classList.add('mz', 'mz-' + n);
  w.style.setProperty('--mc', tcol(carteMaitrise(c)));
  const carte = w.querySelector(':scope>.card');
  if (carte) carte.insertAdjacentHTML('beforeend', e.dedans);
  w.insertAdjacentHTML('beforeend', e.autour);
  /* Dans la fiche, les calques qui suivent l'inclinaison ont changé. */
  if (typeof VW !== 'undefined' && VW && w.closest('#vwc')) VW.reflets = refletsVw();
}

/* ---------- La carte fétiche ---------- */
/* La carte fétiche (profil, fiche d'un joueur ; version 3.0.8) : une tuile
   de la DA, pleine, sans rayons ni projecteur. La lumière vient de la carte
   elle-même — son illustration, très floue, teinte le fond — ; la carte,
   intacte, se tient à gauche avec sa maîtrise ; à droite, son nom en grand
   et ce qui la situe : rareté (à sa couleur), Essence, numéro, maîtrise. */
const FET_RAR = { ES: '--r-es', C: '--r-c', PC: '--r-pc', R: '--r-r', E: '--r-e', L: '--r-l', PR: '--r-pr' };

function vFetiche(id, niveau, o) {
  o = o || {};
  const c = id && byId[id];
  if (!c) {
    return o.edit ? `<section class="fet vide">
        <span class="fet-fantome" aria-hidden="true">${NAVICO.star}</span>
        <div class="fet-t"><small>Ma carte fétiche</small><b>Aucune, pour l'instant</b>
          <span class="fet-dit">Celle que tu montres en premier, sur ton profil et ta fiche. Touche une carte de ta Collection, puis « Gérer ».</span>
          <button class="btn tiny" data-tab="collection">Choisir une carte</button></div>
      </section>` : '';
  }
  const k = carteMaitrise(c);
  const n = niveau == null ? (maitrisable(c) ? niveauMaitrise(c) : 0) : niveau;
  const R = RAR[c.rar] || RAR.C;
  const col = COLORS[k.col] || COLORS.neutre;
  const rar = FET_RAR[c.rar] ? `style="color:var(${FET_RAR[c.rar]})"` : '';
  const crans = Array.from({ length: MAITRISE.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<section class="fet${n ? ' fet-mz' + n : ''}" style="--fc:${tcol(k)}">
    <span class="fet-fond" aria-hidden="true" style="background-image:url('${h(c.img)}')"></span>
    <button class="fet-carte" data-show="${c.id}" data-snd="carte" aria-label="Voir ${h(c.nom)}">${renderCard(c, { m: n })}</button>
    <div class="fet-t">
      <small>${MZ_ETOILE}${o.moi ? 'Ma carte fétiche' : 'Sa carte fétiche'}</small>
      <b>${h(c.nom)}</b>
      <span class="fet-meta"><span class="fet-rar r${c.rar}" ${rar}>${R.nom}${c.rev ? ' · Reverse' : ''}</span>
        <span class="fet-ess">${essIcon(k.col)}${h(col.nom)}</span><span class="fet-num tnum">${c.num ? '#' + String(c.num).padStart(3, '0') : h(c.code || '')}</span></span>
      ${n ? `<span class="fet-mz"><span>${insigneMaitrise(n)}Maîtrise · <b>${MAITRISE.noms[n - 1]}</b></span><span class="fet-crans${n >= MAITRISE.max ? ' max' : ''}" aria-hidden="true">${crans}</span></span>`
        : maitrisable(c) ? '<span class="fet-mz"><span>Pas encore maîtrisée</span></span>' : ''}
      ${o.edit ? '<button class="btn tiny ghost fet-changer" data-tab="collection">Changer</button>' : ''}
    </div>
  </section>`;
}

async function choisirFeticheVw() {
  const c = VW && VW.c;
  if (!c) return;
  const on = (save.fetiche || null) !== c.id;
  try {
    await Backend.setFetiche(on ? c.id : null);
  } catch (e) { toast(e.message || 'Le choix n\'est pas passé.'); return; }
  SFX.jouer(on ? 'rare' : 'retour');
  toast(on ? `${c.nom} est ta carte fétiche.` : 'Carte fétiche retirée.');
  rafraichirFicheVw();
  render();
}
