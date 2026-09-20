/* Moteur de particules (étoiles, scintillements) dessiné sur le canvas #fx. */
"use strict";
/* ---------- Particules ---------- */
const FX=(()=>{
  const cv=$('#fx'),ctx=cv.getContext('2d');let parts=[],raf=0,dpr=1;
  const size=()=>{dpr=Math.min(2,window.devicePixelRatio||1);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;};
  size();addEventListener('resize',size);
  function star(s){ctx.beginPath();for(let i=0;i<8;i++){const r=i%2?s*.38:s*1.25,a=i*Math.PI/4;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}
  function loop(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
    parts=parts.filter(p=>p.life>0);
    for(const p of parts){p.vy+=p.g;p.vx*=p.drag;p.vy*=p.drag;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life--;
      ctx.globalAlpha=Math.min(1,p.life/p.fade)*(p.tw?(.35+.65*Math.abs(Math.sin(p.life*.18+p.tw))):1);ctx.fillStyle=p.c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      if(p.shape==='rect')ctx.fillRect(-p.s,-p.s*.45,p.s*2,p.s*.9);else if(p.shape==='star')star(p.s);else{ctx.beginPath();ctx.arc(0,0,p.s,0,6.283);ctx.fill();}
      ctx.restore();}
    ctx.globalAlpha=1;raf=parts.length?requestAnimationFrame(loop):0;
  }
  const add=a=>{if(RM())return;parts.push(...a);if(!raf)raf=requestAnimationFrame(loop);};
  return{
    burst(x,y,o={}){const n=o.n||40,cs=o.colors||['#fff'],a=[];for(let i=0;i<n;i++){const an=Math.random()*6.283,sp=(o.speed||6)*(.35+Math.random()*.9);
      a.push({x,y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-(o.up||0),g:o.g==null?.12:o.g,drag:.965,s:(o.size||3)*(.6+Math.random()*.8),c:cs[i%cs.length],life:(o.life||55)+Math.random()*30,fade:22,rot:Math.random()*6,vr:(Math.random()-.5)*.3,shape:o.shape||'circle'});}add(a);},
    sparkle(o={}){const n=o.n||80,cs=o.colors||['#fff'],a=[];for(let i=0;i<n;i++)a.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight*(o.h||.85),vx:(Math.random()-.5)*.4,vy:-.2-Math.random()*.6,g:0,drag:1,s:1.5+Math.random()*(o.size||3.5),c:cs[i%cs.length],life:(o.life||120)+Math.random()*80,fade:40,rot:Math.random()*6,vr:(Math.random()-.5)*.05,shape:'star',tw:Math.random()*6});add(a);},
    confetti(o={}){const n=o.n||120,cs=o.colors||['#ff2e88','#fff'],a=[];for(let i=0;i<n;i++)a.push({x:Math.random()*innerWidth,y:-20-Math.random()*innerHeight*.6,vx:(Math.random()-.5)*2.2,vy:2+Math.random()*3,g:.035,drag:.995,s:3.5+Math.random()*4,c:cs[i%cs.length],life:220+Math.random()*90,fade:40,rot:Math.random()*6,vr:(Math.random()-.5)*.25,shape:'rect'});add(a);},
    clear(){parts=[];}
  };
})();
