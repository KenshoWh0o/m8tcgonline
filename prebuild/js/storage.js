/* État global du jeu et sauvegarde de la progression dans le navigateur (IndexedDB). */
"use strict";

/* ---------- Base IndexedDB ---------- */
const dbp = new Promise(res => {
  try {
    const r = indexedDB.open('premier-lobby-prebuild', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  } catch (e) {
    res(null);
  }
});

async function kvGet(k) {
  try {
    const db = await dbp;
    if (!db) return undefined;
    return await new Promise(res => {
      const q = db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(undefined);
    });
  } catch (e) {
    return undefined;
  }
}

async function kvSet(k, v) {
  try {
    const db = await dbp;
    if (!db) return false;
    return await new Promise(res => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => res(true);
      t.onerror = () => res(false);
    });
  } catch (e) {
    return false;
  }
}

/* ---------- État global ---------- */
let save = null;
let cards = [];
/* Les cartes Promo vivent à côté de l'extension, jamais dedans : voir
   js/promos-data.js. `cards.length` doit rester le total de l'extension. */
let promos = [];
/* Hors extension eux aussi : les Essences Brillantes et la carte unique. */
let brillantes = [];
let uniques = [];
/* Version 2.0 : les Reverses, à côté des 122 elles aussi (js/cards.js). */
let reverses = [];
let packArt = PACK_ARTS[0];
let byId = {};
let tab = 'boosters';
let rv = null;
let colFilter = 'all';
let essFilter = 'all';
let rarFilter = 'all';
let colPossedees = false;
/* Version 2.1 : seulement les cartes dont on a moins d'exemplaires que ce
   qu'on veut garder. */
let colObjectifs = false;
/* Version 2.1 : seulement les cartes en favori. */
let colFavoris = false;
let opening = false;

const persist = () => kvSet('save2', save);

function defaultSave() {
  return {
    tickets: TICKET_CAP, lastTick: Date.now(), unlimited: false, col: {},
    /* Champs v2 : hors ligne ils restent inertes, mais l'interface les lit partout. */
    shards: 0, inv: {}, quetes: [],
    pseudo: 'Invité', avatar: 'star', frame: 'default', isAdmin: false,
    tradeFreeAt: 0, packsOpened: 0, tradesDone: 0, streak: 0, vitrine: []
  };
}

/* Index des cartes par identifiant, pour les retrouver depuis la sauvegarde.
   Les Promos y entrent aussi : une carte affichée se cherche toujours par son
   identifiant, qu'elle soit de l'extension ou non. */
function rebuild() {
  byId = {};
  cards.forEach(c => byId[c.id] = c);
  promos.forEach(c => byId[c.id] = c);
  brillantes.forEach(c => byId[c.id] = c);
  reverses.forEach(c => byId[c.id] = c);
  uniques.forEach(c => byId[c.id] = c);
}

function poolFor() {
  return cards.filter(c => c.inBoost !== false || c.cat === 'essence');
}

/* Tire le visuel du prochain paquet : purement cosmétique, le contenu ne change pas. */
function rollPack() {
  packArt = rnd(PACK_ARTS);
}

/* ---------- Ménage ---------- */
/* Les cartes étaient autrefois importées et stockées ici ; on libère la place une seule fois. */
async function purgeLegacy() {
  try {
    const db = await dbp;
    if (!db) return;
    await new Promise(res => {
      const t = db.transaction('kv', 'readwrite');
      const st = t.objectStore('kv');
      ['custom2', 'custom3', 'packimg'].forEach(k => st.delete(k));
      const q = st.openKeyCursor();
      q.onsuccess = () => {
        const cur = q.result;
        if (!cur) return;
        if (String(cur.key).startsWith('img:')) st.delete(cur.key);
        cur.continue();
      };
      t.oncomplete = () => res();
      t.onerror = () => res();
    });
  } catch (e) {
    /* rien à nettoyer */
  }
}
