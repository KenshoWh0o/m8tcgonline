/* Construit les cartes du jeu à partir de CARD_DATA : normalisation des champs et valeurs par défaut. */
"use strict";

/* ---------- Normalisation des champs ---------- */
function normCol(v) {
  let s = noacc(v);
  if (s === 'violet') s = 'violette';
  if (s === 'vert') s = 'verte';
  if (s === 'bleu') s = 'bleue';
  return COLORS[s] ? s : null;
}

function normCat(v) {
  const s = noacc(v);
  if (s.startsWith('joueur')) return 'joueur';
  if (s.startsWith('coach')) return 'coach';
  if (s.startsWith('moment')) return 'moment';
  if (s.startsWith('objet')) return 'objet';
  if (s.startsWith('essence')) return 'essence';
  return null;
}

function normRar(v) {
  const s = String(v == null ? '' : v).toUpperCase().trim();
  return RAR[s] ? s : null;
}

function normCost(o) {
  if (typeof o === 'number') return { neutre: o };
  const r = {};
  if (o && typeof o === 'object') {
    for (const k in o) {
      const c = normCol(k) || 'neutre';
      const n = +o[k] || 0;
      if (n > 0) r[c] = (r[c] || 0) + n;
    }
  }
  if (!Object.keys(r).length) r.neutre = 1;
  return r;
}

/* Première valeur définie parmi plusieurs champs ; garde un 0 explicite (contrairement à ||). */
function firstDefined(...vals) {
  return vals.find(v => v != null && v !== '');
}

/* ---------- Une carte ---------- */
/* L'identifiant vient du numéro : la collection sauvegardée est rangée par id, il doit rester stable. */
const cardId = num => 'c' + String(num).padStart(3, '0');

function makeCard(meta, idx) {
  meta = meta || {};
  const cat = normCat(meta.categorie) || 'joueur';
  const rar = normRar(meta.rarete) || (cat === 'essence' ? 'ES' : 'C');
  const num = +meta.num || idx + 1;

  const c = {
    id: cardId(num),
    num,
    nom: String(meta.nom || 'Carte'),
    cat,
    col: normCol(meta.couleur) || 'neutre',
    rar,
    sous: String(meta.sous_type || ''),
    img: meta.fichier ? CARD_DIR + meta.fichier : null,
    inBoost: meta.booster !== false,
    atks: [],
    kw: null,
    fx: []
  };

  if (cat === 'joueur') {
    const defRaw = firstDefined(meta.def, meta.pv);
    c.def = defRaw != null ? (+defRaw || 0) : (DEFV[rar] || 90);
    const at = Array.isArray(meta.attaques) ? meta.attaques : [];
    c.atks = at.filter(a => a && typeof a === 'object').map(a => ({
      nom: String(a.nom || 'Attaque'),
      cout: normCost(a.cout),
      degats: (a.degats == null || a.degats === '') ? null : (+a.degats || 0),
      effet: String(a.effet || ''),
      plus: !!a.plus
    }));
    if (!c.atks.length) c.atks = [{ nom: 'Attaque', cout: { neutre: 2 }, degats: DEFD[rar] || 60, effet: '', plus: false }];
    if (meta.mot_cle && meta.mot_cle.nom) {
      c.kw = { nom: String(meta.mot_cle.nom), texte: String(meta.mot_cle.texte || ''), icone: meta.mot_cle.icone || null };
    }
  } else {
    c.fx = Array.isArray(meta.effets) ? meta.effets.map(e => e && e.texte ? String(e.texte) : '').filter(Boolean) : [];
  }

  return c;
}

/* ---------- Les cartes Promo ---------- */
/* Elles passent par le même moule que les autres — mêmes champs, même rendu —
   mais gardent leur identifiant à elles (`p01` et non `c001`) et une rareté à
   part. C'est ce qui les tient hors de l'extension partout : elles ne sont pas
   dans `cards`, donc pas dans le total, pas dans le pourcentage, et pas dans
   le tirage d'un booster. */
function makePromo(meta) {
  const num = +String(meta.code || '').replace(/\D/g, '') || 0;
  const c = makeCard({
    nom: meta.nom,
    categorie: meta.categorie,
    sous_type: meta.sous_type,
    couleur: meta.couleur,
    rarete: 'PR',
    def: meta.def,
    attaques: meta.attaques,
    mot_cle: meta.mot_cle,
    effets: meta.effets,
    fichier: meta.fichier,
    booster: false,
    num
  }, num - 1);

  c.id = 'p' + String(num).padStart(2, '0');
  c.code = meta.code;
  c.promo = true;
  c.obtention = meta.obtention || 'boutique';
  c.illustrateur = meta.illustrateur || '';
  c.variante = meta.variante || '';
  return c;
}

function buildPromos() {
  if (typeof PROMO_DATA === 'undefined') return [];
  return PROMO_DATA.map(makePromo).sort((a, b) => a.num - b.num);
}

/* ---------- Les Essences Brillantes ---------- */
/* La version brillante de chaque Essence : même illustration, autre finition
   (le reflet est posé par renderCard). `b` + le numéro de l'Essence, comme
   côté serveur (supabase/03b_promos.sql). Hors extension, comme les Promos. */
function buildBrillantes(liste) {
  return liste.filter(c => c.cat === 'essence').map(e => Object.assign({}, e, {
    id: 'b' + e.id.slice(1),
    nom: e.nom + ' Brillante',
    rar: 'BR',
    inBoost: false,
    promo: true,
    foil: true,
    base: e.id,
    code: '#' + String(e.num || 0).padStart(3, '0') + ' ✧'
  }));
}

/* ---------- Les Reverses (version 2.0) ---------- */
/* Chaque Commune, Peu commune et Rare de l'extension a sa Reverse : la même
   carte, frappée du logo Tout Commence Ici (posé par renderCard). `r` + le
   numéro, comme côté serveur (supabase/03b_promos.sql). Hors des 122, mais
   échangeables, recyclables et fabricables — d'où `promo: false` ici : côté
   navigateur, c'est `rev` qui les met à part. */
function buildReverses(liste) {
  return liste.filter(c => ['C', 'PC', 'R'].includes(c.rar) && c.cat !== 'essence').map(c => Object.assign({}, c, {
    id: 'r' + c.id.slice(1),
    nom: c.nom + ' Reverse',
    nomBase: c.nom,
    inBoost: false,
    promo: false,
    rev: true,
    base: c.id,
    code: '#' + String(c.num || 0).padStart(3, '0') + ' R'
  }));
}

/* ---------- La carte unique ---------- */
function buildUniques() {
  if (typeof UNIQUE_DATA === 'undefined') return [];
  return UNIQUE_DATA.map(meta => {
    const num = +String(meta.code).replace(/\D/g, '') || 1;
    const c = makeCard({
      nom: meta.nom, categorie: meta.categorie, sous_type: meta.sous_type,
      couleur: meta.couleur, rarete: 'UN', effets: meta.effets,
      fichier: meta.fichier, booster: false, num
    }, num - 1);
    c.id = 'u' + String(num).padStart(2, '0');
    c.code = meta.code;
    c.promo = true;
    c.unique = true;
    c.illustrateur = meta.illustrateur || '';
    return c;
  });
}

/* ---------- La liste complète ---------- */
function buildCards() {
  const list = CARD_DATA.map(makeCard).sort((a, b) => a.num - b.num);
  const seen = new Set();
  list.forEach(c => {
    if (seen.has(c.id)) console.warn(`Deux cartes portent le numéro ${c.num} (${c.nom}) : la collection les confondra.`);
    seen.add(c.id);
  });
  return list;
}
