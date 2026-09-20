/* État global du jeu et sauvegarde dans le navigateur (IndexedDB). */
"use strict";
/* ---------- Stockage ---------- */
const dbp=new Promise(res=>{try{const r=indexedDB.open('premier-lobby',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);}catch(e){res(null)}});
async function kvGet(k){try{const db=await dbp;if(!db)return undefined;return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined);});}catch(e){return undefined}}
async function kvSet(k,v){try{const db=await dbp;if(!db)return false;return await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false);});}catch(e){return false}}

let packImg=null,save=null,custom=[],byId={},tab='boosters',rv=null,colFilter='all',B=null,uidc=0,opening=false,importMsg='';
const persist=()=>kvSet('save2',save);
let imgSaved=new Set();
const persistCustom=async()=>{
  const meta=custom.map(c=>{const o=Object.assign({},c);delete o.img;return o;});
  let ok=await kvSet('custom3',meta);
  for(const c of custom){if(c.img&&!imgSaved.has(c.id)){ok=(await kvSet('img:'+c.id,c.img))&&ok;imgSaved.add(c.id);}}
  if(!ok)toast("Impossible d'enregistrer tes cartes sur cet appareil.");
};
async function loadCustom(){
  let meta=await kvGet('custom3');
  if(!meta){const old=await kvGet('custom2');if(old&&old.length){custom=old;imgSaved=new Set();await persistCustom();await kvSet('custom2',null);return;}return;}
  custom=meta;
  await Promise.all(custom.map(async c=>{const im=await kvGet('img:'+c.id);if(im){c.img=im;imgSaved.add(c.id);}}));
}
function defaultSave(){return {tickets:TICKET_CAP,lastTick:Date.now(),unlimited:false,col:{},deck:[],wins:0,losses:0};}
function rebuild(){byId={};custom.forEach(c=>byId[c.id]=c);}
function poolFor(){return custom.filter(c=>c.inBoost!==false||c.cat==='essence');}
