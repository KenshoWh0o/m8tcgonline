/* État global du jeu et sauvegarde dans le navigateur (IndexedDB). */
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
let packImg = null;
let save = null;
let custom = [];
let byId = {};
let tab = 'boosters';
let rv = null;
let colFilter = 'all';
let opening = false;
let importMsg = '';
let imgSaved = new Set();

const persist = () => kvSet('save2', save);

/* Renvoie true si tout a pu être écrit, pour éviter de perdre des données lors d'une migration. */
async function persistCustom() {
  const meta = custom.map(c => {
    const o = Object.assign({}, c);
    delete o.img;
    return o;
  });
  let ok = await kvSet('custom3', meta);
  for (const c of custom) {
    if (c.img && !imgSaved.has(c.id)) {
      ok = (await kvSet('img:' + c.id, c.img)) && ok;
      imgSaved.add(c.id);
    }
  }
  if (!ok) toast("Impossible d'enregistrer tes cartes sur cet appareil.");
  return ok;
}

async function loadCustom() {
  let meta = await kvGet('custom3');
  if (!meta) {
    const old = await kvGet('custom2');
    if (old && old.length) {
      custom = old;
      imgSaved = new Set();
      if (await persistCustom()) await kvSet('custom2', null);
    }
    return;
  }
  custom = meta;
  await Promise.all(custom.map(async c => {
    const im = await kvGet('img:' + c.id);
    if (im) {
      c.img = im;
      imgSaved.add(c.id);
    }
  }));
}

function defaultSave() {
  return { tickets: TICKET_CAP, lastTick: Date.now(), unlimited: false, col: {} };
}

function rebuild() {
  byId = {};
  custom.forEach(c => byId[c.id] = c);
}

function poolFor() {
  return custom.filter(c => c.inBoost !== false || c.cat === 'essence');
}
