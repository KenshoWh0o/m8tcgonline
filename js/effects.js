/* Lecture des textes d'effet des cartes (pioche, bonus, engager…). */
"use strict";
/* ---------- Lecture des effets ---------- */
function parseFx(text){
  const t=noacc(text),r={};
  let m=t.match(/pioch\w*\s+(\d+|une|un)\s+cartes?/);if(m)r.draw=/^\d+$/.test(m[1])?+m[1]:1;
  m=t.match(/([+-]\s?\d+)\s*(d')?attaque/);if(m)r.atk=parseInt(m[1].replace(/\s/g,''),10);
  m=t.match(/([+-]\s?\d+)\s*(de\s)?defense/);if(m)r.def=parseInt(m[1].replace(/\s/g,''),10);
  if(/(^|[^s])engagez (un|1) joueur adverse/.test(t))r.engage=true;
  if(/desengagez (un|l'un|1)/.test(t))r.unengage=true;
  if(/echang\w* la position/.test(t))r.swap=true;
  if(/gagne\w*[^.]*shield/.test(t))r.shield=true;
  if(/gagne\w*[^.]*riposte/.test(t))r.riposte=true;
  return r;
}
const fxAny=r=>!!(r.draw||r.atk||r.def||r.engage||r.unengage||r.swap||r.shield||r.riposte);
