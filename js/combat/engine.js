/* Combat : moteur de règles et IA. Désactivé (non chargé par index.html). */
"use strict";
/* ---------- Combat : moteur ---------- */
const inst=c=>({uid:++uidc,card:c,dmg:0,en:[],objs:[],shield:kwOf(c)==='shield',stun:false,defTmp:0,tmpRiposte:false});
function draw(s,n){for(let i=0;i<n;i++)if(s.deck.length)s.hand.push(s.deck.pop());}
function mkSide(ids){
  const deck=shuffle(ids.map(id=>inst(byId[id])));const s={deck,hand:[],active:null,bench:[],points:0,discard:[],turnAtk:0,colors:deckColors(ids)};
  draw(s,5);
  if(!s.hand.some(x=>x.card.cat==='joueur')){const i=s.deck.findIndex(x=>x.card.cat==='joueur');if(i>=0)s.hand.push(s.deck.splice(i,1)[0]);}
  return s;
}
function botDeck(level){
  const rars=BOTS[level].rars;
  const pool=poolFor().filter(c=>rars.includes(c.rar)&&c.cat!=='essence');
  const pl=pool.filter(c=>c.cat==='joueur'),su=pool.filter(c=>['coach','moment','objet'].includes(c.cat));
  const cols=[...new Set(pl.map(c=>c.col).filter(k=>k!=='neutre'))];
  const main=cols.length?rnd(cols):'neutre';
  let pp=pl.filter(c=>c.col===main||c.col==='neutre');if(pp.length<4)pp=pl;
  const d=[],cnt={};
  const take=(arr,lim)=>{let g=0;while(d.length<lim&&arr.length&&g++<600){const c=rnd(arr);if((cnt[c.id]||0)<2||g>300){d.push(c.id);cnt[c.id]=(cnt[c.id]||0)+1;}}};
  take(pp,13);take(su.length?su:pp,20);take(pp,20);
  return d;
}
const hpLeft=x=>x.card.def-x.dmg;
const allies=s=>[s.active,...s.bench].filter(Boolean);
const bestIdx=arr=>arr.reduce((bi,x,i)=>hpLeft(x)>hpLeft(arr[bi])?i:bi,0);
function swapActive(s,j){const b=s.bench[j];s.bench[j]=s.active;s.active=b;}
const objFx=x=>x.objs.map(o=>parseFx((o.fx||[]).join(' ')));
function atkBonus(s,x){let b=s.turnAtk;allies(s).forEach(o=>{if(o!==x&&kwOf(o.card)==='buff'){const r=parseFx(o.card.kw.texte);if(r.atk>0)b+=r.atk;}});objFx(x).forEach(r=>{if(r.atk)b+=r.atk;});return b;}
function defBonus(s,x){let b=x.defTmp;allies(s).forEach(o=>{if(o!==x&&kwOf(o.card)==='buff'){const r=parseFx(o.card.kw.texte);if(r.def>0)b+=r.def;}});objFx(x).forEach(r=>{if(r.def)b+=r.def;});return b;}
const hasRiposte=x=>kwOf(x.card)==='riposte'||x.tmpRiposte||objFx(x).some(r=>r.riposte);
function canPay(en,cost){const c={};en.forEach(k=>c[k]=(c[k]||0)+1);let rest=en.length;for(const k in cost){if(k==='neutre')continue;if((c[k]||0)<cost[k])return false;rest-=cost[k];}return rest>=(cost.neutre||0);}
function stunIt(x){if(!x)return '';if(x.immune)return ` ${x.card.nom} résiste (déjà engagé au tour précédent).`;x.stun=true;return ` ${x.card.nom} est engagé.`;}
const ptsOf=x=>(x.card.rar==='E'||x.card.rar==='L')?2:1;

function startBattle(level){
  if(!deckValid()){toast('Ton deck doit contenir 20 cartes, dont 5 Joueurs.');return;}
  if(!poolFor().some(c=>c.cat==='joueur')){toast('Aucun Joueur disponible pour le bot.');return;}
  closeSheet();
  B={level,p:[mkSide(save.deck),mkSide(botDeck(level))],turn:0,tc:0,first:Math.random()<.5?0:1,phase:'setup',energy:null,coach:false,retreat:false,busy:false,log:'Choisis ton Joueur actif.',hits:[],winner:null};
  const bot=B.p[1];const pls=bot.hand.filter(x=>x.card.cat==='joueur');const a=pls.reduce((m,x)=>x.card.def>m.card.def?x:m,pls[0]);
  bot.hand.splice(bot.hand.indexOf(a),1);bot.active=a;
  render();setupSheet();
}
function setupSheet(){
  const me=B.p[0];const acts=[];
  me.hand.forEach((x,i)=>{if(x.card.cat==='joueur')acts.push({label:`${x.card.nom} (${x.card.def} DEF)`,primary:true,fn:()=>{me.active=me.hand.splice(i,1)[0];B.phase='play';B.log=B.first===0?'Pile ou face : tu commences.':'Pile ou face : le bot commence.';closeSheet();beginTurn(B.first);}});});
  openSheet({title:'Ton Joueur actif',body:'<p class="muted">Il combat en premier. Tu pourras poser les autres sur ton banc pendant ton tour.</p>',actions:acts,locked:true});
}
function beginTurn(s){
  B.turn=s;B.tc++;const sd=B.p[s];
  allies(sd).forEach(x=>x.defTmp=0);
  draw(sd,1);B.energy=B.tc===1?null:rnd(sd.colors);B.coach=false;B.retreat=false;B.busy=false;
  if(B.tc===1)B.log+=" Pas d'Essence au tout premier tour.";
  renderBattle();
  if(s===1)aiTurn();
}
function endTurn(){
  if(!B||B.phase!=='play')return;
  const cur=B.p[B.turn];allies(cur).forEach(x=>{x.immune=x.stun;x.stun=false;x.tmpRiposte=false;});cur.turnAtk=0;
  beginTurn(1-B.turn);
}
function onPlayJoueur(s,x){
  const k=x.card.kw;if(!k||k.icone!=='etoile')return '';
  const r=parseFx(k.texte),me=B.p[s],op=B.p[1-s];let m='';
  if(r.draw){draw(me,r.draw);m+=` Signature : pioche ${r.draw}.`;}
  if(r.engage&&op.active)m+=' Signature :'+stunIt(op.active);
  return m;
}
function applySupport(s,card,j){
  const me=B.p[s],op=B.p[1-s],r=parseFx((card.fx||[]).join(' '));let did=false,m='';
  if(r.draw){draw(me,r.draw);did=true;m+=` Pioche ${r.draw}.`;}
  if(r.atk>0){me.turnAtk+=r.atk;did=true;m+=` +${r.atk} Attaque ce tour.`;}
  if(r.def){if(r.def>0){me.active.defTmp+=r.def;m+=` +${r.def} Défense pour ${me.active.card.nom}.`;}else if(op.active){op.active.defTmp+=r.def;m+=` ${r.def} Défense pour ${op.active.card.nom}.`;}did=true;}
  if(r.engage&&op.active){did=true;m+=stunIt(op.active);}
  if(r.unengage){allies(me).forEach(x=>x.stun=false);did=true;m+=' Tes Joueurs sont désengagés.';}
  if(r.shield){me.active.shield=true;did=true;m+=` ${me.active.card.nom} gagne Shield.`;}
  if(r.riposte){me.active.tmpRiposte=true;did=true;m+=` ${me.active.card.nom} gagne Riposte.`;}
  if(r.swap&&me.bench.length){swapActive(me,j==null?bestIdx(me.bench):j);did=true;m+=' Échange de position.';}
  if(!did){draw(me,1);m=' Effet non géré : pioche 1 carte.';}
  return m;
}
function doAttack(s,k){
  const me=B.p[s],op=B.p[1-s],a=me.active,t=op.active,atk=a.card.atks[k],ef=parseFx(atk.effet);
  let msg=`${a.card.nom} utilise ${atk.nom}`;B.hits=[];
  if(atk.degats!=null){
    const dmg=atk.degats+atkBonus(me,a);let fin=Math.max(0,dmg-defBonus(op,t));
    if(t.shield&&fin>0){t.shield=false;fin=0;msg+=', bloqué par Shield';}
    t.dmg+=fin;B.hits.push(t.uid);msg+=` : ${fin} dégâts.`;
  }else msg+='.';
  if(ef.engage&&op.active)msg+=stunIt(op.active);
  if(ef.draw)draw(me,ef.draw);
  if(ef.unengage)allies(me).forEach(x=>x.stun=false);
  B.log=msg;resolve(s);
}
function collectKO(i){const sd=B.p[i],out=[];sd.bench=sd.bench.filter(b=>{if(hpLeft(b)<=0){out.push(b);return false;}return true;});if(sd.active&&hpLeft(sd.active)<=0){out.push(sd.active);sd.active=null;}return out;}
function bury(i,x){const sd=B.p[i];if(kwOf(x.card)==='legion'){sd.hand.push(inst(x.card));B.log+=` Légion : ${x.card.nom} revient en main.`;}else sd.discard.push(x);}
function resolve(s){
  const me=B.p[s],op=B.p[1-s];
  const kosOp=collectKO(1-s);
  kosOp.forEach(x=>{me.points+=ptsOf(x);B.log+=` ${x.card.nom} est vaincu !`;
    if(hasRiposte(x)&&me.active){const best=Math.max(0,...x.card.atks.map(a=>a.degats||0));let fin=Math.max(0,best-defBonus(me,me.active));if(me.active.shield&&fin>0){me.active.shield=false;fin=0;}me.active.dmg+=fin;B.hits.push(me.active.uid);B.log+=` Riposte : ${fin} dégâts à ${me.active.card.nom}.`;}
    bury(1-s,x);});
  const kosMe=collectKO(s);
  kosMe.forEach(x=>{op.points+=ptsOf(x);B.log+=` ${x.card.nom} est vaincu !`;bury(s,x);});
  renderBattle();
  if(me.points>=3)return finish(s);
  if(op.points>=3)return finish(1-s);
  if(!op.active&&!op.bench.length)return finish(s);
  if(!me.active&&!me.bench.length)return finish(1-s);
  if(!B.p[1].active){const i=bestIdx(B.p[1].bench);B.p[1].active=B.p[1].bench.splice(i,1)[0];B.log+=` Le bot envoie ${B.p[1].active.card.nom}.`;}
  if(!B.p[0].active){B.phase='promote';renderBattle();setTimeout(promoteSheet,700);return;}
  setTimeout(()=>{if(B&&B.phase==='play')endTurn();},1000);
}
function promoteSheet(){
  const me=B.p[0];
  openSheet({title:'Qui entre en jeu ?',body:'<p class="muted">Ton Joueur actif est vaincu. Choisis un remplaçant.</p>',locked:true,actions:me.bench.map((x,j)=>({label:`${x.card.nom} (${hpLeft(x)}/${x.card.def} DEF)`,primary:true,fn:()=>{me.active=me.bench.splice(j,1)[0];B.phase='play';closeSheet();renderBattle();setTimeout(endTurn,400);}}))});
}
function finish(w){
  B.phase='over';B.winner=w;const reward=B.level+1;
  if(w===0){save.tickets+=reward;save.wins++;}else save.losses++;
  persist();header();renderBattle();
  setTimeout(()=>openSheet({title:w===0?'Victoire !':'Défaite',locked:true,
    body:`<p>${w===0?`Tu gagnes ${reward} booster${reward>1?'s':''}.`:"Le bot l'emporte cette fois."}</p><p class="muted">Bilan : ${save.wins} victoires, ${save.losses} défaites.</p>`,
    actions:[{label:'Rejouer',primary:true,fn:()=>startBattle(B.level)},{label:"Changer d'adversaire",fn:()=>{B=null;closeSheet();render();}},{label:'Ouvrir mes boosters',fn:()=>{B=null;closeSheet();tab='boosters';render();}}]}),900);
}
function bestAttack(s){
  const a=B.p[s].active;if(!a||a.stun)return -1;let bi=-1,bv=-1;
  a.card.atks.forEach((at,i)=>{if(!canPay(a.en,at.cout))return;const ef=parseFx(at.effet);const v=(at.degats||0)+(ef.engage&&B.p[1-s].active&&!B.p[1-s].active.immune?30:0)+(ef.draw?10:0);if(v>bv){bv=v;bi=i;}});
  return bi;
}
function aiWants(c){
  const me=B.p[1],op=B.p[0],a=me.active,r=parseFx((c.fx||[]).join(' '));
  if(r.swap)return me.bench.length>0&&hpLeft(a)<=40;
  if(r.engage)return !!op.active&&!op.active.immune;
  if(r.atk>0)return bestAttack(1)>=0;
  if(r.def>0)return a.dmg>0;
  if(r.shield||r.riposte)return true;
  if(r.draw)return me.hand.length<=4;
  if(r.unengage)return a.stun;
  return me.hand.length<=3;
}
async function aiTurn(){
  const g=B,me=B.p[1];
  const step=async ms=>{renderBattle();await sleep(ms||750);if(B!==g||B.phase!=='play')throw 0;};
  try{
    await step(600);
    for(let i=me.hand.length-1;i>=0;i--){const x=me.hand[i];if(x.card.cat==='joueur'&&me.bench.length<3){me.hand.splice(i,1);me.bench.push(x);B.log=`Le bot pose ${x.card.nom} sur son banc.`+onPlayJoueur(1,x);await step();}}
    for(let i=me.hand.length-1;i>=0;i--){const x=me.hand[i];if(x.card.cat==='essence'){me.hand.splice(i,1);me.active.en.push(x.card.col);me.discard.push(x);B.log=`Le bot place une Essence ${colOf(x.card).nom}.`;await step(500);}}
    for(let i=me.hand.length-1;i>=0;i--){const x=me.hand[i];if(x.card.cat==='objet'&&me.active.objs.length<3){me.hand.splice(i,1);me.active.objs.push(x.card);B.log=`Le bot lie ${x.card.nom} à ${me.active.card.nom}.`;await step(600);}}
    if(B.energy){
      let tg=me.active;
      if(bestAttack(1)>=0){const need=me.bench.find(b=>!b.card.atks.some(at=>canPay(b.en,at.cout)));if(need)tg=need;}
      tg.en.push(B.energy);B.log=`Le bot place une Essence ${COLORS[B.energy].nom} sur ${tg.card.nom}.`;B.energy=null;await step();
    }
    for(let i=me.hand.length-1;i>=0;i--){const x=me.hand[i];if((x.card.cat==='moment'||(x.card.cat==='coach'&&!B.coach))&&aiWants(x.card)){me.hand.splice(i,1);if(x.card.cat==='coach')B.coach=true;B.log=`Le bot joue ${x.card.nom}.`+applySupport(1,x.card);me.discard.push(x);await step();}}
    const k=bestAttack(1);
    if(k>=0){doAttack(1,k);return;}
    B.log=me.active.stun?`${me.active.card.nom} est engagé et ne peut pas attaquer.`:'Le bot termine son tour.';await step(600);endTurn();
  }catch(e){}
}
