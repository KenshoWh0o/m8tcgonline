/* État global du jeu et sauvegarde de la progression dans le navigateur (IndexedDB). */
"use strict";

/* ---------- Base IndexedDB ---------- */
const dbp = new Promise(res => {
  try {
    const r = indexedDB.open('premier-lobby', 1);
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
let packArt = PACK_ARTS[0];
let byId = {};
let tab = 'boosters';
let rv = null;
let colFilter = 'all';
let essFilter = 'all';
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

/* Index des cartes par identifiant, pour les retrouver depuis la sauvegarde. */
function rebuild() {
  byId = {};
  cards.forEach(c => byId[c.id] = c);
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
