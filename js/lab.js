/* Onglet Labo : ouvertures de test. */
"use strict";

/* ---------- Labo ---------- */
function vTest() {
  if (!custom.length) {
    return `<div class="empty"><h1>Labo</h1><p class="muted">Importe d'abord tes cartes pour tester les ouvertures.</p><button class="btn" data-go="import">Importer mes cartes</button></div>`;
  }

  const has = r => custom.some(c => c.rar === r && c.cat !== 'essence');

  return `<h1>Labo</h1><p class="muted">Les ouvertures de test ne consomment pas de booster et n'ajoutent rien à ta collection.</p>
  <section class="panel"><h2>Ouvertures</h2><div class="labgrid">
    <button class="labbtn" data-act="t-open"><b>Booster normal</b><span>Tirage réel</span></button>
    <button class="labbtn tR" data-act="t-R" ${has('R') ? '' : 'disabled'}><b>Rare</b><span>en dernière carte</span></button>
    <button class="labbtn tE" data-act="t-E" ${has('E') ? '' : 'disabled'}><b>Épique</b><span>en dernière carte</span></button>
    <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
    <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
  </div></section>
  <section class="panel"><h2>Collection et boosters</h2>
    <div class="row"><button class="btn ghost" data-act="t-all">Tout débloquer</button><button class="btn ghost" data-act="t-clear">Vider</button></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost" data-act="t-10">+10 boosters</button></div>
    <label class="toggle" style="margin-top:10px"><span>Boosters illimités</span><input type="checkbox" id="unl" ${save.unlimited ? 'checked' : ''}></label>
  </section>`;
}
