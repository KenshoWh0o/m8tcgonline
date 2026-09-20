/* Combat : affichage du plateau et actions du joueur. Désactivé (non chargé par index.html). */
"use strict";
/* ---------- Combat : interface ---------- */
function hpColor(x){const r=hpLeft(x)/x.card.def;return r>.5?'#2fbf71':r>.25?'#f0a020':'#e0435f';}
function tokHTML(x,big,act,where,i){
  const st=(x.stun?'💤':'')+(x.shield?'🛡️':'')+(x.objs.length?'🔗'+x.objs.length:'');
  return `<button class="tok ${big?'big':''} ${B.hits.includes(x.uid)?'hit':''}" style="--tc:${tcol(x.card)}" data-b="${act}" data-where="${where}" data-i="${i}">
  <div class="tok-art">${artOf(x.card)}</div><div class="tok-name">${h(x.card.nom)}</div>
  <div class="tok-hp"><i style="width:${Math.max(0,hpLeft(x))/x.card.def*100}%;background:${hpColor(x)}"></i></div>
  <div class="tok-meta"><span>${Math.max(0,hpLeft(x))}/${x.card.def}</span><span>${st}</span></div><div class="tok-en">${x.en.map(dot).join('')||'&nbsp;'}</div></button>`;
}
function benchHTML(s,act){let o='';for(let i=0;i<3;i++)o+=s.bench[i]?tokHTML(s.bench[i],false,act,'bench',i):'<div class="slot" aria-hidden="true"></div>';return o;}
const dots3=n=>'●'.repeat(Math.min(3,n))+'○'.repeat(Math.max(0,3-n));
function vCombat(){
  if(!B){
    return `<h1>Combat</h1><p class="muted">Bats un bot avec ton deck. Premier à 3 points : un Joueur vaincu vaut 1 point, 2 s'il est Épique ou Légendaire.</p>
    ${deckValid()?'':"<p><b>Ton deck n'est pas prêt.</b> Va dans l'onglet Deck et utilise « Deck automatique ».</p>"}
    ${BOTS.map((b,i)=>`<button class="opp-card" data-level="${i}" ${deckValid()?'':'disabled'}><b>${b.nom}</b><p class="muted" style="margin:4px 0 0">${b.desc} Victoire : ${i+1} booster${i?'s':''}.</p></button>`).join('')}
    <details><summary>Règles</summary>
    <p>Chaque tour, tu pioches une carte et reçois une Essence d'une des couleurs utilisées par tes Joueurs (sauf au tout premier tour). Place-la sur un de tes Joueurs. Une attaque se déclenche si les Essences posées sur le Joueur actif couvrent son coût, les Essences Neutres pouvant être payées avec n'importe quelle couleur.</p>
    <p>Pendant ton tour : pose des Joueurs sur ton banc (3 maximum), joue des cartes Essence, lie des Objets (3 par Joueur), joue des Moments et un seul Coach, bats en retraite une fois (1 Essence), puis attaque, ce qui termine ton tour.</p>
    <p>La DEF sert de points de vie. Un Joueur engagé ne peut pas attaquer à son prochain tour, puis il ne peut pas être engagé à nouveau au tour suivant. Mots-clés gérés : ${Object.keys(KW_OK).map(k=>k[0].toUpperCase()+k.slice(1)).join(', ')}. Les bonus d'Attaque et de Défense écrits sur les Objets, Coachs et Moments sont appliqués ; les autres effets sont remplacés par « pioche 1 carte ».</p></details>`;
  }
  const me=B.p[0],op=B.p[1],my=B.turn===0&&B.phase==='play';
  let info='';
  if(B.phase==='over')info=B.winner===0?'Victoire !':'Défaite.';
  else if(my)info=B.energy?`${dot(B.energy)} Essence ${COLORS[B.energy].nom} à placer : touche un de tes Joueurs.`:'Joue tes cartes, puis attaque en touchant ton Joueur actif.';
  else if(B.phase==='play')info='Tour du bot…';
  return `<div class="arena">
  <div class="sbar"><b>${BOTS[B.level].nom}</b><span class="pts" aria-label="${op.points} points">${dots3(op.points)}</span><span class="muted">Main ${op.hand.length}, pioche ${op.deck.length}</span></div>
  <div class="benchrow">${benchHTML(op,'opp')}</div>
  <div class="actrow">${op.active?tokHTML(op.active,true,'opp','active',0):'<div class="slot big"></div>'}</div>
  <div class="mid" aria-live="polite"><b>${h(B.log)}</b></div>
  <div class="actrow">${me.active?tokHTML(me.active,true,'mine','active',0):'<div class="slot big"></div>'}</div>
  <div class="benchrow">${benchHTML(me,'mine')}</div>
  <div class="sbar"><b>Toi</b><span class="pts" aria-label="${me.points} points">${dots3(me.points)}</span><span class="muted">Pioche ${me.deck.length}</span></div>
  <div class="hand">${me.hand.map((x,i)=>`<button class="hitem" style="--tc:${tcol(x.card)}" data-hand="${i}"><div class="tok-art">${artOf(x.card)}</div><span>${h(x.card.nom)}</span><small>${x.card.cat==='joueur'?x.card.def+' DEF':CATS[x.card.cat]}</small></button>`).join('')||'<span class="muted" style="font-size:13px">Main vide</span>'}</div>
  <div class="actbar"><div class="info">${info}</div>${B.phase==='over'?'<button class="btn" data-act="newfight">Nouveau combat</button>':`<button class="btn" data-act="endturn" ${my&&!B.busy?'':'disabled'}>Finir le tour</button>`}</div>
  </div>`;
}
function renderBattle(){if(tab==='combat')$('#main').innerHTML=vCombat();B.hits=[];}
function detailBody(x,side){
  const sd=side!=null?B.p[side]:null;let extra='';
  if(x.card.cat==='joueur'){
    extra=`${Math.max(0,hpLeft(x))}/${x.card.def} DEF restants. Essences : ${x.en.map(dot).join('')||'aucune'}.`;
    if(sd){const ab=atkBonus(sd,x),db=defBonus(sd,x);if(ab)extra+=` Attaque ${ab>0?'+':''}${ab}.`;if(db)extra+=` Défense ${db>0?'+':''}${db}.`;}
    if(x.objs.length)extra+=` Objets : ${x.objs.map(o=>h(o.nom)).join(', ')}.`;
    if(x.stun)extra+=' Engagé : ne peut pas attaquer ce tour.';
    if(x.shield)extra+=' Shield actif.';
  }
  return `<div class="detail">${renderCard(x.card)}</div><div class="stat">${extra}</div><div class="stat" style="font-size:12px">${statLine(x.card)}</div>`;
}
function chooseTarget(title,list,cb){openSheet({title,actions:list.map((x,j)=>({label:`${x.card.nom} (${hpLeft(x)}/${x.card.def} DEF)`,primary:true,fn:()=>cb(j)})).concat([{label:'Annuler',fn:closeSheet}])});}
function tapMine(where,i){
  const me=B.p[0],x=where==='active'?me.active:me.bench[i];if(!x)return;
  const my=B.turn===0&&B.phase==='play'&&!B.busy,acts=[];
  if(my&&B.energy)acts.push({label:`Placer l'Essence ${COLORS[B.energy].nom} ici`,primary:true,fn:()=>{x.en.push(B.energy);B.log=`Essence ${COLORS[B.energy].nom} placée sur ${x.card.nom}.`;B.energy=null;closeSheet();renderBattle();}});
  if(where==='active'){
    x.card.atks.forEach((a,k)=>{
      const b=a.degats!=null?atkBonus(me,x):0;
      acts.push({label:`${a.nom} : ${a.degats==null?'effet':(a.degats+b)} (${costText(a.cout)})`,primary:!(my&&B.energy),disabled:!my||x.stun||!canPay(x.en,a.cout),fn:()=>{closeSheet();B.busy=true;doAttack(0,k);}});
    });
    if(me.bench.length)acts.push({label:'Battre en retraite (1 Essence)',disabled:!my||B.retreat||!x.en.length,fn:()=>chooseTarget('Qui le remplace ?',me.bench,j=>{x.en.pop();swapActive(me,j);B.retreat=true;B.log='Retraite effectuée.';closeSheet();renderBattle();})});
  }
  acts.push({label:'Fermer',fn:closeSheet});
  openSheet({body:detailBody(x,0),actions:acts});
}
function tapHand(i){
  const me=B.p[0],x=me.hand[i];if(!x)return;
  const my=B.turn===0&&B.phase==='play'&&!B.busy,acts=[],c=x.card,board=allies(me);
  const take=()=>me.hand.splice(me.hand.indexOf(x),1);
  if(c.cat==='joueur'){
    acts.push({label:me.bench.length>=3?'Banc plein (3 maximum)':'Poser sur le banc',primary:true,disabled:!my||me.bench.length>=3,fn:()=>{take();me.bench.push(x);B.log=`Tu poses ${c.nom} sur ton banc.`+onPlayJoueur(0,x);closeSheet();renderBattle();}});
  }else if(c.cat==='essence'){
    acts.push({label:'Placer sur un Joueur',primary:true,disabled:!my,fn:()=>chooseTarget('Sur quel Joueur ?',board,j=>{take();board[j].en.push(c.col);me.discard.push(x);B.log=`Essence ${colOf(c).nom} placée sur ${board[j].card.nom}.`;closeSheet();renderBattle();})});
  }else if(c.cat==='objet'){
    acts.push({label:'Lier à un Joueur',primary:true,disabled:!my,fn:()=>chooseTarget('À quel Joueur ?',board,j=>{if(board[j].objs.length>=3){toast('3 Objets maximum par Joueur.');return;}take();board[j].objs.push(c);B.log=`${c.nom} est lié à ${board[j].card.nom}.`;closeSheet();renderBattle();})});
  }else{
    const coachBlock=c.cat==='coach'&&B.coach,r=parseFx((c.fx||[]).join(' '));
    acts.push({label:coachBlock?'Déjà un Coach joué ce tour':'Jouer cette carte',primary:true,disabled:!my||coachBlock,fn:()=>{
      const done=j=>{take();if(c.cat==='coach')B.coach=true;B.log=`Tu joues ${c.nom}.`+applySupport(0,c,j);me.discard.push(x);closeSheet();renderBattle();};
      if(r.swap&&me.bench.length)chooseTarget('Qui entre en jeu ?',me.bench,done);else done();
    }});
  }
  acts.push({label:'Fermer',fn:closeSheet});
  openSheet({body:`<div class="detail">${renderCard(c)}</div><div class="stat">${statLine(c)}</div>`,actions:acts});
}
