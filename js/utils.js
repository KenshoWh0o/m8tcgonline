/* Petits outils partagés : sélecteur, échappement HTML, hasard, notifications. */
"use strict";
/* ---------- Outils ---------- */
const $=s=>document.querySelector(s);
const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function hash(s){let x=2166136261;for(const ch of String(s)){x^=ch.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
const noacc=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600);}
const colOf=c=>(COLORS[c.col]||COLORS.neutre);
const tcol=c=>colOf(c).c;
const rk=c=>(RAR[c.rar]||RAR.C).rank;
const kwOf=c=>c&&c.kw?noacc(c.kw.nom):'';
const dot=k=>`<i class="dot" style="background:${(COLORS[k]||COLORS.neutre).c}"></i>`;
const costDots=cost=>Object.entries(cost).map(([k,n])=>dot(k).repeat(n)).join('');
const costText=cost=>Object.entries(cost).map(([k,n])=>`${n} ${(COLORS[k]||COLORS.neutre).nom}`).join(', ');

const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
