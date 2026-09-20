/* Import de cartes (zip + json ou images), édition d'une carte, design du booster, onglet Mes cartes. */
"use strict";
/* ---------- Import ---------- */
function normCol(v){let s=noacc(v);if(s==='violet')s='violette';if(s==='vert')s='verte';if(s==='bleu')s='bleue';return COLORS[s]?s:null;}
function normCat(v){const s=noacc(v);if(s.startsWith('joueur')||s.startsWith('player'))return 'joueur';if(s.startsWith('coach'))return 'coach';if(s.startsWith('moment'))return 'moment';if(s.startsWith('objet')||s.startsWith('item'))return 'objet';if(s.startsWith('essence')||s.startsWith('energ'))return 'essence';return null;}
function normRar(v){const s=String(v==null?'':v).toUpperCase().trim();return RAR[s]?s:null;}
function normCost(o){if(typeof o==='number')return {neutre:o};const r={};if(o&&typeof o==='object')for(const k in o){const c=normCol(k)||'neutre';const n=+o[k]||0;if(n>0)r[c]=(r[c]||0)+n;}if(!Object.keys(r).length)r.neutre=1;return r;}
function niceName(f){const b=f.split('/').pop().replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();return b?b.charAt(0).toUpperCase()+b.slice(1):'Carte';}
function makeCustom(name,img,meta,idx){
  meta=meta||{};
  const cat=normCat(meta.categorie||meta.category)||'joueur';
  const rar=normRar(meta.rarete||meta.rarity)||(cat==='essence'?'ES':'C');
  const c={id:'x'+Date.now().toString(36)+idx+Math.floor(Math.random()*1e4),num:+meta.num||idx+1,nom:String(meta.nom||meta.name||name).slice(0,40),cat,col:normCol(meta.couleur||meta.color)||'neutre',rar,sous:String(meta.sous_type||''),img,inBoost:true,atks:[],kw:null,fx:[]};
  if(cat==='joueur'){
    c.def=+(meta.def||meta.pv||meta.hp)||DEFV[rar]||90;
    const at=Array.isArray(meta.attaques)?meta.attaques:[];
    c.atks=at.filter(a=>a&&typeof a==='object').map(a=>({nom:String(a.nom||'Attaque').slice(0,40),cout:normCost(a.cout),degats:(a.degats==null||a.degats==='')?null:(+a.degats||0),effet:String(a.effet||''),plus:!!a.plus}));
    if(!c.atks.length)c.atks=[{nom:'Attaque',cout:{neutre:2},degats:DEFD[rar]||60,effet:'',plus:false}];
    if(meta.mot_cle&&meta.mot_cle.nom)c.kw={nom:String(meta.mot_cle.nom),texte:String(meta.mot_cle.texte||''),icone:meta.mot_cle.icone||null};
  }else if(cat!=='essence'){
    c.fx=Array.isArray(meta.effets)?meta.effets.map(e=>e&&e.texte?String(e.texte):'').filter(Boolean):[];
    if(meta.effet)c.fx.push(String(meta.effet));
  }
  return c;
}
const MIME={avif:'image/avif',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
function shrink(dataUrl){return new Promise(res=>{const im=new Image();im.onload=()=>{try{const sc=Math.min(1,440/im.naturalWidth);const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.naturalWidth*sc));cv.height=Math.max(1,Math.round(im.naturalHeight*sc));cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);let d=cv.toDataURL('image/webp',.86);if(!d.startsWith('data:image/webp'))d=cv.toDataURL('image/png');res(d);}catch(e){res(dataUrl);}};im.onerror=()=>res(null);im.src=dataUrl;});}
async function importFiles(entries,metaMap){
  let added=0,failed=0;const base=custom.length;
  for(let i=0;i<entries.length;i++){
    importMsg=`Import en cours : ${i+1} sur ${entries.length}…`;const p=$('#impmsg');if(p)p.textContent=importMsg;
    try{const raw=await entries[i].get();const img=await shrink(raw);if(!img){failed++;continue;}
      const c=makeCustom(niceName(entries[i].name),img,metaMap[noacc(entries[i].name.split('/').pop())],base+i);
      custom.push(c);added++;}catch(e){failed++;}
  }
  await persistCustom();persist();rebuild();
  importMsg=added?`${added} carte${added>1?'s':''} importée${added>1?'s':''}.`:'Aucune image lisible trouvée.';
  if(failed)importMsg+=` ${failed} image${failed>1?'s':''} illisible${failed>1?'s':''} (format non pris en charge par ce navigateur ?).`;
  render();toast(importMsg);
}
async function onZip(file){
  if(!window.JSZip){toast("Le lecteur de zip n'a pas pu se charger. Vérifie ta connexion.");return;}
  try{
    const zip=await JSZip.loadAsync(file);const metaMap={},entries=[];
    const jsons=Object.values(zip.files).filter(f=>!f.dir&&/\.json$/i.test(f.name)&&!f.name.includes('__MACOSX')&&!f.name.split('/').pop().startsWith('.'));
    const js=jsons.find(f=>/(^|\/)cards\.json$/i.test(f.name))||jsons[0];
    if(js){try{const arr=JSON.parse(await js.async('string'));(Array.isArray(arr)?arr:[]).forEach(m=>{const f=m&&(m.fichier||m.file);if(f)metaMap[noacc(String(f).split('/').pop())]=m;});}catch(e){toast('Fichier json illisible, stats par défaut utilisées.');}}
    Object.values(zip.files).forEach(f=>{
      if(f.dir||f.name.includes('__MACOSX')||f.name.split('/').pop().startsWith('.'))return;
      const ext=(f.name.split('.').pop()||'').toLowerCase();if(!MIME[ext])return;
      entries.push({name:f.name,get:async()=>`data:${MIME[ext]};base64,`+await f.async('base64')});
    });
    entries.sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
    await importFiles(entries,metaMap);
  }catch(e){toast("Ce fichier n'est pas un zip valide.");}
}
async function onImages(files){
  const entries=[...files].filter(f=>f.type.startsWith('image/')||/\.avif$/i.test(f.name)).map(f=>({name:f.name,get:()=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);})}));
  await importFiles(entries,{});
}
$('#fzip').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f){importMsg='Lecture du zip…';render();onZip(f);}};
$('#fimg').onchange=e=>{const f=e.target.files;if(f&&f.length){const arr=[...f];e.target.value='';onImages(arr);}};
function editSheet(id){
  const c=byId[id];if(!c)return;
  const opt=(o,v)=>o.map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('');
  const a=c.atks[0]||{nom:'Attaque',cout:{neutre:2},degats:60};
  const colN=Object.keys(a.cout).find(k=>k!=='neutre')||c.col;
  openSheet({title:'Modifier la carte',body:`<div style="width:120px;margin:0 auto 12px">${renderCard(c)}</div>
    <label class="fld">Nom<input id="e-nom" value="${h(c.nom)}" maxlength="40"></label>
    <div class="two"><label class="fld">Catégorie<select id="e-cat">${opt(Object.entries(CATS),c.cat)}</select></label><label class="fld">Rareté<select id="e-rar">${opt(Object.keys(RAR).map(k=>[k,RAR[k].nom]),c.rar)}</select></label></div>
    <label class="fld">Couleur<select id="e-col">${opt(Object.keys(COLORS).map(k=>[k,COLORS[k].nom]),c.col)}</select></label>
    <div id="e-pl" ${c.cat==='joueur'?'':'hidden'}>
      <label class="fld">DEF<input id="e-def" type="number" min="10" max="400" step="10" value="${c.def||90}"></label>
      <p class="muted" style="font-size:13px">Première attaque${c.atks.length>1?` (les ${c.atks.length-1} autres sont conservées)`:''}</p>
      <div class="two"><label class="fld">Nom<input id="e-an" value="${h(a.nom)}" maxlength="40"></label><label class="fld">Dégâts<input id="e-dmg" type="number" min="0" max="400" step="10" value="${a.degats==null?0:a.degats}"></label></div>
      <div class="two"><label class="fld">Essences ${COLORS[colN]?COLORS[colN].nom:''}<input id="e-cc" type="number" min="0" max="5" value="${a.cout[colN]&&colN!=='neutre'?a.cout[colN]:0}"></label><label class="fld">Essences neutres<input id="e-cn" type="number" min="0" max="5" value="${a.cout.neutre||0}"></label></div>
    </div>
    <div id="e-su" ${['coach','moment','objet'].includes(c.cat)?'':'hidden'}><label class="fld">Texte d'effet<input id="e-fx" value="${h((c.fx||[]).join(' '))}"></label></div>
    <label class="toggle"><span>Peut sortir dans les boosters</span><input type="checkbox" id="e-boost" ${c.inBoost!==false?'checked':''}></label>`,
    actions:[{label:'Enregistrer',primary:true,fn:async()=>{
      c.nom=$('#e-nom').value.trim()||c.nom;c.cat=$('#e-cat').value;c.rar=$('#e-rar').value;c.col=$('#e-col').value;c.inBoost=$('#e-boost').checked;
      if(c.cat==='joueur'){
        c.def=Math.max(10,+$('#e-def').value||90);
        const cost={};const cc=+$('#e-cc').value||0,cn=+$('#e-cn').value||0;const k=colN==='neutre'?c.col:colN;if(cc>0&&k!=='neutre')cost[k]=cc;if(cn>0)cost.neutre=(cost.neutre||0)+cn;if(!Object.keys(cost).length)cost.neutre=1;
        const na={nom:$('#e-an').value.trim()||'Attaque',cout:cost,degats:Math.max(0,+$('#e-dmg').value||0),effet:a.effet||'',plus:!!a.plus};
        c.atks=c.atks.length?[na,...c.atks.slice(1)]:[na];
      }else if(c.cat!=='essence'){const t=$('#e-fx').value.trim();c.fx=t?[t]:[];}
      await persistCustom();rebuild();closeSheet();render();toast('Carte enregistrée.');}},
      {label:'Supprimer cette carte',fn:async()=>{custom=custom.filter(x=>x.id!==id);kvSet('img:'+id,null);imgSaved.delete(id);delete save.col[id];save.deck=save.deck.filter(x=>x!==id);await persistCustom();persist();rebuild();closeSheet();render();}},
      {label:'Annuler',fn:closeSheet}]});
  const sel=$('#e-cat');sel.onchange=()=>{$('#e-pl').hidden=sel.value!=='joueur';$('#e-su').hidden=!['coach','moment','objet'].includes(sel.value);};
}
function vImport(){
  return `<h1>Mes cartes</h1><p class="muted">Ajoute tes propres images de cartes. Elles restent enregistrées sur cet appareil et sortent dans tes boosters.</p>
  <div class="row"><button class="btn" data-act="zip">Importer un zip</button><button class="btn ghost" data-act="imgs">Choisir des images</button></div>
  <p class="progress" id="impmsg">${h(importMsg)}</p>
  <details><summary>Format du fichier json (facultatif)</summary><p>Place un fichier .json dans le zip avec les images. Chaque entrée est reliée à son image par le champ <b>fichier</b>. Sans json, chaque image devient un Joueur Neutre par défaut, modifiable ensuite.</p>
  <pre>[
 {"fichier":"a.png","nom":"Mon joueur",
  "categorie":"Joueur","couleur":"Rose",
  "rarete":"PC","def":110,
  "attaques":[{"nom":"Frappe",
    "cout":{"rose":1,"neutre":1},
    "degats":100}],
  "mot_cle":{"nom":"Shield","texte":"…"}},
 {"fichier":"b.png","nom":"Mon objet",
  "categorie":"Objet","couleur":"Neutre",
  "rarete":"C","effets":[{"texte":
  "Ce Joueur a +20 Attaque."}]}
]</pre><p class="muted" style="font-size:13px">Catégories : Joueur, Coach, Moment, Objet, Essence. Raretés : ES, C, PC, R, E, L. Couleurs : ${Object.values(COLORS).map(c=>c.nom).join(', ')}. Formats d'image : avif, png, jpg, webp.</p></details>
  ${custom.length?`<h2>${custom.length} carte${custom.length>1?'s':''} importée${custom.length>1?'s':''}</h2>
  <div class="row" style="margin-bottom:10px"><button class="btn ghost" data-act="giveall">Ajouter 2 exemplaires de chaque à ma collection</button></div>
  <div class="list">${custom.map(c=>thumbRow(c,`<button class="mini txt" data-edit="${c.id}">Modifier</button>`)).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="delall">Supprimer toutes mes cartes</button></div>`:''}
  <h2>Design du booster</h2><p class="muted small">Une image verticale au format 2:3 (par exemple 600 × 900 px). Elle remplace le visuel du paquet ; la bande à déchirer reste en haut.</p>
  ${packImg?`<div class="packprev"><img src="${packImg}" alt="Aperçu du booster"></div>`:''}
  <div class="row"><button class="btn ghost" data-act="packimg">${packImg?'Changer':'Importer une image'}</button>${packImg?'<button class="btn ghost" data-act="packdel">Retirer</button>':''}</div>
  <h2>Réglages</h2>
  <label class="fld">Nom du jeu<input id="gamename" value="${h(save.gameName||'')}" placeholder="Premier Lobby" maxlength="32"></label>
  <label class="fld">Nom de ton extension<input id="setname" value="${h(save.setName||'')}" placeholder="Mes cartes" maxlength="28"></label>
  <label class="toggle"><span>Boosters illimités</span><input type="checkbox" id="unl" ${save.unlimited?'checked':''}></label>
  <button class="btn ghost" data-act="reset">Réinitialiser ma progression</button>`;
}


/* ---------- Design du booster ---------- */
$('#fpack').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=async()=>{const d=await shrinkTo(r.result,640);if(!d){toast("Cette image n'a pas pu être lue.");return;}packImg=d;const ok=await kvSet('packimg',d);toast(ok?'Design du booster enregistré.':"Impossible d'enregistrer l'image.");render();};r.readAsDataURL(f);};
function shrinkTo(dataUrl,max){return new Promise(res=>{const im=new Image();im.onload=()=>{try{const sc=Math.min(1,max/im.naturalWidth);const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(im.naturalWidth*sc));cv.height=Math.max(1,Math.round(im.naturalHeight*sc));cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);let d=cv.toDataURL('image/webp',.9);if(!d.startsWith('data:image/webp'))d=cv.toDataURL('image/png');res(d);}catch(e){res(dataUrl);}};im.onerror=()=>res(null);im.src=dataUrl;});}
