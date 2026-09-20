/* Feuille modale (fenêtre qui monte du bas). */
"use strict";
/* ---------- Feuille modale ---------- */
let sheetLocked=false;
function openSheet({title,body,actions,locked}){
  sheetLocked=!!locked;const w=$('#sheet');
  w.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${title?`<h3>${h(title)}</h3>`:''}${body||''}<div class="acts">${(actions||[]).map((a,i)=>`<button class="btn ${a.primary?'':'ghost'}" data-si="${i}" ${a.disabled?'disabled':''}>${h(a.label)}</button>`).join('')}</div></div>`;
  w.hidden=false;bindTilt(w);
  w.querySelectorAll('[data-si]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=actions[+b.dataset.si];if(a&&a.fn)a.fn();});
}
function closeSheet(){$('#sheet').hidden=true;$('#sheet').innerHTML='';sheetLocked=false;}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet'&&!sheetLocked)closeSheet();});
function showCard(c){openViewer(c);}
