/* Onglet Boutique. On y dépense les Éclats gagnés en quête — rien d'autre :
   aucun paiement, aucune monnaie réelle, nulle part dans le jeu.

   Deux rayons, et un étal plutôt qu'une liste : on voit l'objet avant son
   libellé. Un achat demande toujours deux gestes — on ouvre la fiche, on
   confirme — parce qu'un article à 10 000 Éclats ne doit jamais partir sur un
   doigt posé de travers. */
"use strict";

/* Les deux rayons, dans l'ordre des sous-onglets. `categs` dit quelles
   catégories du serveur atterrissent dans chacun : la boutique côté serveur en
   compte trois, mais « boosters » et « échange » sont la même idée pour le
   joueur — ce qui sert à jouer. */
const RAYONS = [
  { id: 'cartes', titre: 'Cartes', categs: ['boosters', 'echange', 'promo'],
    sous: 'De quoi ouvrir, échanger, et compléter.' },
  { id: 'cosmetique', titre: 'Cosmétiques', categs: ['cosmetique'],
    sous: 'Purement décoratif : aucun effet sur le jeu.' }
];

let shopVue = 'cartes';

/* Ce qui s'affiche dans la vignette, selon ce qu'on vend. Un booster montre un
   booster, une carte montre la carte : personne n'achète une icône. */
function vArticleArt(it) {
  if (it.effet === 'carte') {
    const c = byId[it.montant_id] || byId[it.detail_id];
    if (c) return renderCard(c);
  }
  if (FRAMES[it.id]) return avatarHTML(save.avatar, it.id, 'lg');
  if (it.effet === 'tickets' || it.effet === 'refill') {
    return `<img src="${PACK_ARTS[0]}" alt="">`;
  }
  if (it.effet === 'trade_token') return NAVICO.swap;
  return ICON.star;
}

/* Le libellé de quantité posé sur la vignette : ×5 se lit d'un coup d'œil,
   « Cinq boosters » demande une lecture. */
function vArticleQte(it) {
  if ((it.effet === 'tickets' || it.effet === 'trade_token') && it.montant > 1) {
    return `<span class="ofqte">×${it.montant}</span>`;
  }
  return '';
}

/* Le meilleur prix à l'unité du rayon sert de repère : l'article qui le bat
   porte le ruban « éco ». On ne l'invente pas, on le calcule. */
function marqueEco(items) {
  const lots = items.filter(i => i.effet === 'tickets' && i.montant > 0);
  if (lots.length < 2) return null;
  const unite = i => i.prix / i.montant;
  return lots.reduce((m, i) => unite(i) < unite(m) ? i : m, lots[0]).id;
}

function vBoutique() {
  if (Backend.mode !== 'cloud') return horsLigne('Boutique');

  const items = Backend.shop || [];
  const jetons = (save.inv || {}).trade_token || 0;

  const tete = `<div class="pagehead">
      <div>
        <h1>Boutique</h1>
        <p>Tout se paie en ${MONNAIE.nom}, gagnés en accomplissant des quêtes.</p>
      </div>
    </div>
    <div class="walletrow">
      <span class="wallet">${shardIco}<b>${fmtN(save.shards)}</b> ${MONNAIE.nom}</span>
      ${jetons ? `<span class="wallet">${NAVICO.swap}<b>${jetons}</b> jeton${jetons > 1 ? 's' : ''}</span>` : ''}
    </div>`;

  if (!items.length) {
    return tete + vide('Rayons vides', 'Le catalogue n\'a pas encore été chargé sur le serveur.');
  }

  const onglets = RAYONS.map(r =>
    `<button data-shv="${r.id}" class="${shopVue === r.id ? 'on' : ''}">${h(r.titre)}</button>`).join('');

  return tete + `<div class="segbar">${onglets}</div>${vRayon(shopVue, items)}`;
}

function vRayon(id, items) {
  const r = RAYONS.find(x => x.id === id) || RAYONS[0];
  const liste = items.filter(i => r.categs.includes(i.categ));
  const eco = marqueEco(liste);

  const cases = liste.map(it => vArticle(it, eco)).join('');
  const teaser = id === 'cosmetique' ? vCosmetiquesAVenir() : '';

  return `<p class="muted small" style="margin:0 0 12px">${h(r.sous)}</p>
    <div class="offres">${cases}${teaser}</div>`;
}

function vArticle(it, eco) {
  const possede = it.unique_buy && (save.inv || {})[it.id] > 0;
  const cher = save.shards < it.prix;

  return `<article class="offre${possede ? ' owned' : ''}${cher ? ' cher' : ''}"
      ${possede ? '' : `data-shop="${h(it.id)}" role="button" tabindex="0"`}>
    ${possede ? `<span class="ofcoche">${NAVICO.check}</span>` : ''}
    ${!possede && it.categ === 'promo' ? '<span class="ofbadge promo">Promo</span>' : ''}
    ${!possede && it.id === eco ? '<span class="ofbadge eco">Éco</span>' : ''}
    <span class="ofart">${vArticleArt(it)}${vArticleQte(it)}</span>
    <span class="ofnom">${h(it.titre)}</span>
    ${possede
      ? '<span class="qtag ok">Débloqué</span>'
      : `<span class="ofprix">${shardIco}${fmtN(it.prix)}</span>`}
  </article>`;
}

/* Le rayon cosmétique n'a encore que des cadres. Plutôt que de laisser croire
   qu'il n'y aura rien d'autre, on montre les cases à venir : elles disent ce
   que le mode Combat apportera, et pourquoi garder ses Éclats. */
const COSMETIQUES_A_VENIR = [
  ['Protège-cartes', 'Le dos de tes cartes, en combat'],
  ['Jetons de dégâts', 'Les marqueurs posés sur le terrain'],
  ['Tapis de jeu', 'Le plateau sur lequel tu joues'],
  ['Titres', 'Une mention sous ton pseudo']
];

const vCosmetiquesAVenir = () => COSMETIQUES_A_VENIR.map(([nom, quoi]) =>
  `<article class="offre oflock">
    <span class="oflockico">${NAVICO.lock}</span>
    <span class="ofnom">${h(nom)}</span>
    <small>${h(quoi)}</small>
    <span class="qtag">Avec les combats</span>
  </article>`).join('');

/* ---------- La fiche, puis la confirmation ---------- */
/* Premier geste : on montre. Second geste : on prélève. Entre les deux, le
   joueur voit l'objet en grand, son prix, et ce qu'il lui restera après. */
function ouvrirArticle(id) {
  const it = (Backend.shop || []).find(x => x.id === id);
  if (!it) return;

  const cher = save.shards < it.prix;
  const reste = save.shards - it.prix;

  openSheet({
    title: it.titre,
    body: `<div class="achat">
      <div class="achatart">${vArticleArt(it)}</div>
      <p>${h(it.detail)}</p>
      <div class="achatprix">
        <span>Prix</span>
        <b>${shardIco}${fmtN(it.prix)}</b>
      </div>
      <p class="achatreste${cher ? ' court' : ''}">${cher
        ? `Il te manque ${fmtN(it.prix - save.shards)} ${MONNAIE.nom}.`
        : `Il te restera ${fmtN(reste)} ${MONNAIE.nom}.`}</p>
    </div>`,
    actions: [
      { label: cher ? 'Pas assez d\'Éclats' : 'Acheter', primary: true, disabled: cher,
        fn: () => { closeSheet(); acheter(it); } },
      { label: 'Retour', fn: closeSheet }
    ]
  });
}

/* Le serveur revérifie tout — le prix, le solde, l'unicité. Ce qui se passe ici
   n'est que la mise en scène du résultat. */
async function acheter(it) {
  const ok = await agir(() => Backend.buy(it.id));
  if (!ok) return;
  /* Une carte s'annonce toute seule, par son animation d'obtention (js/promos.js) :
     un message en bas de l'écran par-dessus serait redondant. */
  if (it.effet === 'carte') return;
  toast(it.unique_buy ? `${it.titre} débloqué.` : `${it.titre} : c'est dans ta réserve.`);
  SFX.jouer('gagne');
}
