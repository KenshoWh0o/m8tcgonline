/* Onglet Labo : ouvertures de test, réservé aux administrateurs.
   Il n'apparaît que si le serveur a marqué le profil is_admin
   (voir supabase/05_admin.sql) : le cacher côté navigateur ne suffirait pas,
   c'est le serveur qui refuse les actions, pas l'interface qui les masque. */
"use strict";

function vTest() {
  if (!save.isAdmin) {
    return vide('Réservé', "Cette page est réservée aux administrateurs du jeu.");
  }
  if (!cards.length) {
    return `<div class="pagehead"><h1>Labo</h1></div>
      ${vide('Aucune carte', 'Le fichier js/cards-data.js ne contient aucune carte.')}`;
  }

  const has = r => cards.some(c => c.rar === r && c.cat !== 'essence');

  return `<div class="pagehead">
    <h1>Labo</h1>
    <p class="muted">Les ouvertures de test ne consomment pas de booster et n'ajoutent rien
      à ta collection. Elles sont tirées dans ce navigateur, pas sur le serveur : elles
      servent à régler la mise en scène, pas à vérifier les probabilités réelles.</p>
  </div>

  <section class="panel"><h2>Ouvertures</h2><div class="labgrid">
    <button class="labbtn" data-act="t-open"><b>Booster normal</b><span>Tirage réel</span></button>
    <button class="labbtn tR" data-act="t-R" ${has('R') ? '' : 'disabled'}><b>Rare</b><span>en dernière carte</span></button>
    <button class="labbtn tE" data-act="t-E" ${has('E') ? '' : 'disabled'}><b>Épique</b><span>en dernière carte</span></button>
    <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
    <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
  </div></section>

  <section class="panel"><h2>Aperçu</h2>
    <p class="muted small">Ces boutons ne touchent qu'à l'affichage local. En ligne, la
      collection et la réserve restent celles du serveur : la page les récupérera telles
      quelles au prochain rafraîchissement.</p>
    <div class="row"><button class="btn ghost" data-act="t-all">Tout débloquer</button><button class="btn ghost" data-act="t-clear">Vider</button></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost" data-act="t-10">+10 boosters</button></div>
    <label class="toggle" style="margin-top:10px"><span>Boosters illimités</span><input type="checkbox" id="unl" ${save.unlimited ? 'checked' : ''}></label>
  </section>

  <section class="panel"><h2>Équilibrage</h2>
    <p class="muted small">Les taux, le prix des articles et les objectifs des quêtes vivent
      côté serveur, dans <code>supabase/04_seed.sql</code> et la fonction <code>cfg()</code>
      de <code>supabase/01_schema.sql</code>. Les modifier là-bas, puis rejouer le fichier.</p>
  </section>`;
}
