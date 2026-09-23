/* Onglet Labo : tout ce qu'on veut voir sans avoir à le mériter.
   Réservé aux administrateurs — il n'apparaît que si le serveur a marqué le
   profil is_admin (voir supabase/05_admin.sql). Le cacher côté navigateur ne
   suffirait pas : c'est le serveur qui refuse les actions, pas l'interface qui
   les masque.

   Ce que le Labo peut faire : rejouer n'importe quelle mise en scène, et
   modifier l'affichage local. Ce qu'il ne peut pas faire : accorder une carte,
   des Éclats ou un booster sur le compte — ça, seul le serveur le décide, et il
   ne prend d'ordre de personne. Les boutons d'aperçu le disent en toutes
   lettres. */
"use strict";

function vTest() {
  if (!save.isAdmin) {
    return vide('Réservé', "Cette page est réservée aux administrateurs du jeu.");
  }
  if (!cards.length) {
    return `<div class="pagehead"><div><h1>Labo</h1></div></div>
      ${vide('Aucune carte', 'Le fichier js/cards-data.js ne contient aucune carte.')}`;
  }

  const has = r => cards.some(c => c.rar === r && c.cat !== 'essence');

  return `<div class="pagehead">
    <div>
      <h1>Labo</h1>
      <p>Rejouer les mises en scène, et regarder l'interface dans des états
        qu'on ne croise pas tous les jours.</p>
    </div>
  </div>

  <section class="panel">
    <h2>Ouvertures</h2>
    <p class="muted small">Elles ne consomment pas de booster et n'ajoutent rien à ta
      collection. Le tirage se fait dans ce navigateur, pas sur le serveur : ça règle
      la mise en scène, pas les probabilités réelles.</p>
    <div class="labgrid">
      <button class="labbtn" data-act="t-open"><b>Booster normal</b><span>Tirage réel</span></button>
      <button class="labbtn tR" data-act="t-R" ${has('R') ? '' : 'disabled'}><b>Rare</b><span>en dernière carte</span></button>
      <button class="labbtn tE" data-act="t-E" ${has('E') ? '' : 'disabled'}><b>Épique</b><span>en dernière carte</span></button>
      <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
      <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
    </div>
  </section>

  <section class="panel">
    <h2>Cartes Promo</h2>
    <p class="muted small">L'animation d'obtention, en entier, sans toucher au compte.
      C'est exactement ce que verra un joueur qui achète la carte ou qui franchit
      le palier — seule l'écriture dans la collection est sautée.</p>
    <div class="labgrid">
      ${promos.map(p => `<button class="labbtn tPR" data-promo="${h(p.id)}">
        <b>${h(p.code)}</b><span>${h(p.nom)}</span></button>`).join('')}
    </div>
    ${promos.length > 1
      ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-act="t-promo-file">Les enchaîner toutes</button></div>'
      : ''}
    <p class="muted small" style="margin-top:12px">Pour les obtenir <b>pour de vrai</b> sur ton
      compte — et vérifier la détection, la boutique et les paliers — les requêtes sont
      en bas de <code>supabase/03b_promos.sql</code>.</p>
  </section>

  <section class="panel">
    <h2>Annonce à tous les joueurs</h2>
    <p class="muted small">Elle arrive dans la boîte de réception de chacun, avec un ping
      pour ceux qui sont en jeu. Pour la retirer : « Retirer l'annonce » dans ta boîte.</p>
    <label class="field"><span>Titre</span>
      <input id="an-titre" type="text" maxlength="80" placeholder="Le jeu est ouvert !"></label>
    <label class="field"><span>Texte <small class="muted">(facultatif)</small></span>
      <textarea id="an-texte" maxlength="600" rows="3"
        placeholder="Quelques lignes, 600 caractères au plus."></textarea></label>
    <button class="btn" data-act="annonce-publier">Publier l'annonce</button>
  </section>

  <section class="panel">
    <h2>Notifications</h2>
    <p class="muted small">Les bandeaux qui passent en haut de l'écran, pour vérifier
      qu'ils ne recouvrent rien.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-quete">Quête accomplie</button>
      <button class="btn ghost" data-act="t-ping">Ping de la boîte</button>
      <button class="btn ghost" data-act="t-toast">Message court</button>
    </div>
  </section>

  <section class="panel">
    <h2>Aperçu de la collection</h2>
    <p class="muted small">Ces boutons ne touchent qu'à l'affichage local. En ligne, la
      collection et la réserve restent celles du serveur : la page les récupérera telles
      quelles au prochain rafraîchissement.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-all">Tout débloquer</button>
      <button class="btn ghost" data-act="t-clear">Vider</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="btn ghost" data-act="t-90">Monter à 90 %</button>
      <button class="btn ghost" data-act="t-10">+10 boosters</button>
    </div>
    <label class="toggle" style="margin-top:10px">
      <span>Boosters illimités<small>Le bouton d'ouverture ne s'épuise plus</small></span>
      <input type="checkbox" id="unl" ${save.unlimited ? 'checked' : ''}></label>
  </section>

  <section class="panel">
    <h2>Équilibrage</h2>
    <p class="muted small">Les taux de tirage, le prix des articles et les objectifs des
      quêtes vivent côté serveur, dans <code>supabase/04_seed.sql</code> et la fonction
      <code>cfg()</code> de <code>supabase/01_schema.sql</code>. Les modifier là-bas, puis
      rejouer le fichier.</p>
    <div class="labfacts">
      ${fait('Cartes par booster', PACK_SIZE)}
      ${fait('Réserve', TICKET_CAP + ' boosters')}
      ${fait('Recharge', Math.round(INTERVAL / 3600000) + ' h')}
      ${fait('Échange gratuit', TRADE_COOLDOWN_H + ' h')}
      ${fait('Palier promo', PROMO_PALIER + ' %')}
      ${fait('Godpack', '1 / 2 000')}
    </div>
  </section>`;
}

const fait = (l, v) => `<div class="labfait"><span>${h(l)}</span><b>${h(String(v))}</b></div>`;

/* ---------- Les actions de test ---------- */
/* Une promo montrée depuis le Labo ne passe pas par la file : on court-circuite
   la détection, qui elle ne se déclenche que sur une vraie arrivée serveur. */
function testPromo(id) {
  const c = byId[id];
  if (!c) return;
  montrerPromo(c);
}

function testFilePromos() {
  if (!promos.length) return;
  filePromos.push(...promos);
  viderFilePromos();
}

/* Le ping d'une demande d'échange, tel qu'il arrive à un joueur. */
function testPing() {
  annoncer([{ id: 'test', type: 'echange_recu', pseudo: save.pseudo, avatar: save.avatar,
    frame: save.frame, photo: maPhoto(), quand: new Date().toISOString() }]);
}

/* Publier une annonce. Deux gestes : on relit avant que ça parte chez tout le
   monde. Le serveur vérifie de son côté que c'est bien un administrateur. */
function publierAnnonce() {
  const titre = valeur('an-titre');
  const texte = $('#an-texte') ? $('#an-texte').value.trim() : '';
  if (!titre) return toast('Il manque un titre.');
  openSheet({
    title: 'Publier cette annonce ?',
    body: `<div class="bmsg annonce"><span class="bico">${NAVICO.annonce}</span>
        <div class="bcorps"><p class="btxt"><b>${h(titre)}</b></p>
          ${texte ? `<p class="bannonce">${h(texte)}</p>` : ''}</div></div>
      <p class="muted small">Elle arrive tout de suite dans la boîte de tous les joueurs.</p>`,
    actions: [
      { label: 'Publier', primary: true, fn: async () => {
        closeSheet();
        /* Le rendu qui suit redessine le Labo : les deux champs repartent vides. */
        await agir(() => Backend.annoncePublier(titre, texte), 'Annonce publiée.');
      }},
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}

function testQuete() {
  notifQuete({
    id: 'test', titre: 'Cinq paquets', reward: 50,
    progress: 5, goal: 5, scope: 'daily'
  });
}

/* Remplit la collection jusqu'au palier voulu, au hasard : de quoi voir la
   grille, la jauge et le pourcentage dans un état intermédiaire. */
function testRemplir(pct) {
  const cible = Math.round(cards.length * pct / 100);
  const melange = shuffle(cards.slice());
  save.col = {};
  melange.slice(0, cible).forEach(c => save.col[c.id] = 1);
  persist();
  toast(`Collection à ${pct} % (affichage seulement).`);
  render();
}
