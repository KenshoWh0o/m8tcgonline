/* Deck (utilisé par le combat, actuellement masqué). autoDeck est aussi appelé à la réinitialisation. */
"use strict";
/* ---------- Deck ---------- */
function deckValid(d){d=d||save.deck;return d.length===20&&d.filter(id=>byId[id]&&byId[id].cat==='joueur').length>=5;}
function deckColors(ids){const o=[];ids.forEach(id=>{const c=byId[id];if(c&&c.cat==='joueur')c.atks.forEach(a=>Object.keys(a.cout).forEach(k=>{if(k!=='neutre')o.push(k);}));});return o.length?o:['neutre'];}
function autoDeck(){
  const owned=Object.keys(save.col).filter(id=>save.col[id]>0&&byId[id]);
  const cmp=(a,b)=>rk(byId[b])-rk(byId[a])||(byId[b].def||0)-(byId[a].def||0);
  const pls=owned.filter(id=>byId[id].cat==='joueur');
  const score={};pls.forEach(id=>{const k=byId[id].col;if(k!=='neutre')score[k]=(score[k]||0)+save.col[id]*(1+rk(byId[id]));});
  const top=Object.keys(score).sort((a,b)=>score[b]-score[a]).slice(0,2);
  const main=pls.filter(id=>top.includes(byId[id].col)||byId[id].col==='neutre').sort(cmp);
  const sup=owned.filter(id=>['coach','moment','objet'].includes(byId[id].cat)).sort(cmp);
  const d=[];const add=(ids,lim)=>{for(const id of ids){const k=Math.min(2,save.col[id]);for(let i=d.filter(x=>x===id).length;i<k&&d.length<lim;i++)d.push(id);}};
  add(main,13);add(sup,20);add(pls.sort(cmp),20);
  save.deck=d;
}
function thumbRow(c,right){return `<div class="li" style="--tc:${tcol(c)}"><div class="th">${artOf(c)}</div><div class="tx"><b>${h(c.nom)}</b><small>${CATS[c.cat]} ${colOf(c).nom}${c.cat==='joueur'?', '+c.def+' DEF':''}</small></div>${right}</div>`;}
function vDeck(){
  const d=save.deck,cnt={};d.forEach(id=>cnt[id]=(cnt[id]||0)+1);
  const nPl=d.filter(id=>byId[id].cat==='joueur').length;
  const inDeck=Object.keys(cnt).sort((a,b)=>rk(byId[b])-rk(byId[a]));
  const order={joueur:0,coach:1,moment:2,objet:3,essence:4};
  const owned=Object.keys(save.col).filter(id=>save.col[id]>0&&byId[id]).sort((a,b)=>order[byId[a].cat]-order[byId[b].cat]||rk(byId[b])-rk(byId[a]));
  const cols=[...new Set(deckColors(d))].map(k=>dot(k)+' '+COLORS[k].nom).join(', ');
  return `<h1>Mon deck</h1><p><b>${d.length} / 20 cartes</b>, dont ${nPl} Joueurs. ${deckValid()?'Prêt pour le combat.':'<span class="muted">Il faut 20 cartes, dont au moins 5 Joueurs, et 2 exemplaires maximum par carte.</span>'}</p>
  ${d.length?`<p class="muted" style="font-size:13px">Essences générées en combat : ${cols}. Elles dépendent des coûts d'attaque de tes Joueurs.</p>`:''}
  <div class="row"><button class="btn" data-act="autodeck">Deck automatique</button><button class="btn ghost" data-act="cleardeck">Vider</button></div>
  <h2>Dans le deck</h2>${inDeck.length?`<div class="list">${inDeck.map(id=>thumbRow(byId[id],`<b>×${cnt[id]}</b><button class="mini" data-rm="${id}" aria-label="Retirer">−</button>`)).join('')}</div>`:'<p class="muted">Ton deck est vide.</p>'}
  <h2>Ajouter depuis ta collection</h2><div class="list">${owned.map(id=>{const lim=Math.min(2,save.col[id]);const k=cnt[id]||0;return thumbRow(byId[id],`<small class="muted">${k}/${lim}</small><button class="mini" data-add="${id}" ${k>=lim||d.length>=20?'disabled':''} aria-label="Ajouter">+</button>`);}).join('')}</div>`;
}
