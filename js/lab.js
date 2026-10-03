/* Onglet Labo : tout ce qu'on veut voir sans avoir à le mériter.
   Réservé aux administrateurs — il n'apparaît que si le serveur a marqué le
   profil is_admin (voir supabase/05_admin.sql). Le cacher côté navigateur ne
   suffirait pas : c'est le serveur qui refuse les actions, pas l'interface qui
   les masque.

   Ce que le Labo peut faire : rejouer n'importe quelle mise en scène, poser
   l'interface dans un état d'événement ou de chasse, et modifier l'affichage
   local. Ce qu'il ne peut pas faire : accorder une carte,
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
      <button class="labbtn tBR" data-act="t-BR" ${brillantes.length ? '' : 'disabled'}><b>Essence Brillante</b><span>1 Essence sur ${FOIL_ODDS} en vrai</span></button>
      <button class="labbtn tUN" data-act="t-UN" ${uniques.length ? '' : 'disabled'}><b>Carte unique</b><span>en septième carte</span></button>
      <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
    </div>
    <div class="row" style="margin-top:9px">
      <button class="btn ghost" data-act="t-partage">Image de partage d'un booster</button>
    </div>
  </section>

  ${vLabEvenement()}

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
    <div class="row" style="margin-top:8px">
      <button class="btn ghost" data-act="t-fragments">+5 000 ${h(FRAGMENTS.nom)}</button>
      <button class="btn ghost" data-act="t-succes">Tous les succès</button>
    </div>
    <p class="muted small" style="margin-top:8px">Les ${h(FRAGMENTS.nom)} affichés permettent d'ouvrir la
      fenêtre de fabrication ; la fabrication elle-même, le serveur la refusera.</p>
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
      ${fait('Réserve (boosters)', TICKET_CAP)}
      ${fait('Recharge en ce moment', String(Math.round(INTERVAL / 360000) / 10).replace('.', ',') + ' h')}
      ${fait('Échange gratuit', TRADE_COOLDOWN_H + ' h')}
      ${fait('Palier promo', PROMO_PALIER + ' %')}
      ${fait('Godpack', '1 / 2 000')}
      ${fait('Brillante, par Essence', '1 / ' + FOIL_ODDS)}
      ${fait('Unique, par booster', '1 / 250')}
    </div>
    <h3 class="labsous">${h(FRAGMENTS.nom)}</h3>
    <div class="labtable">
      <span></span><b>Recycler</b><b>Fabriquer</b>
      ${['ES', 'C', 'PC', 'R', 'E', 'L'].map(r => `<span><i class="rardot r${r}"></i>${h((RAR[r] || RAR.C).nom)}</span>
        <span class="tnum">+${fmtN(recValeurs()[r])}</span><span class="tnum">${fmtN(fabCouts()[r])}</span>`).join('')}
    </div>
    <p class="muted small" style="margin-top:8px">Recycler garde toujours un exemplaire ; on ne fabrique
      qu'une carte de l'extension qui manque. Promos, Brillantes et carte unique : ni l'un ni l'autre.</p>
  </section>`;
}

/* ---------- Événement et chasse ---------- */
/* Ce que le serveur dit en ce moment, puis des aperçus : poser l'interface
   dans chacun des états qu'un joueur croisera — avant le départ, pendant,
   chasse terminée, carte unique en main. Les aperçus ne changent que
   l'affichage ; « Revenir à l'état réel » redemande tout au serveur. */
let labApercu = '';

function vLabEvenement() {
  const ev = save.evenement;
  const ch = save.chasse || {};
  const u = uniques[0];
  const quand = iso => jourHeure(srvTime(iso));
  const etatEv = !ev ? 'Aucun événement en cours ni dans les quinze jours.'
    : ev.a_venir ? `« ${ev.titre} » commence ${quand(ev.debut)} et finit ${quand(ev.fin)}.`
    : `« ${ev.titre} » est en cours, jusqu'à ${quand(ev.fin)}.`;
  const etatCh = !ch.carte ? 'Inconnue (le serveur n\'a pas la version 1.5 ?).'
    : ch.trouvee ? `Terminée : tirée par ${ch.gagnant || 'un joueur'}${ch.trouvee_le ? ' ' + quand(ch.trouvee_le) : ''}.`
    : ch.active ? 'Ouverte : chaque booster a une chance sur 250.'
    : ch.ouvre_le ? `Programmée : elle ouvre ${quand(ch.ouvre_le)}.`
    : 'Fermée.';

  return `<section class="panel">
    <h2>Événement et chasse</h2>
    ${labApercu ? `<p class="labalerte">Aperçu « ${h(labApercu)} » affiché : ce n'est pas l'état du serveur.
      <button class="linkbtn" data-act="t-ev-reel">Revenir à l'état réel</button></p>` : ''}
    <div class="labetat">
      <div><span>Événement</span><b>${h(etatEv)}</b></div>
      <div><span>Recharge</span><b>Un booster toutes les ${h(String(Math.round(INTERVAL / 360000) / 10).replace('.', ','))} h</b></div>
      <div><span>${h(u ? u.nom : 'Carte unique')}</span><b>${h(etatCh)}</b></div>
    </div>

    <h3 class="labsous">Aperçus</h3>
    <div class="labgrid">
      <button class="labbtn" data-apercu="avant"><b>Avant le départ</b><span>compte à rebours</span></button>
      <button class="labbtn" data-apercu="pendant"><b>Pendant</b><span>chasse ouverte</span></button>
      <button class="labbtn" data-apercu="trouvee"><b>Chasse terminée</b><span>vue des autres joueurs</span></button>
      <button class="labbtn tUN" data-apercu="mienne"><b>Carte unique en main</b><span>vue de son détenteur</span></button>
    </div>
    <div class="row" style="margin-top:9px">
      <button class="btn ghost" data-act="nouveautes">Fenêtre des nouveautés</button>
      <button class="btn ghost" data-act="t-chasse-fin">Fenêtre de fin de chasse</button>
    </div>

    <h3 class="labsous">Dans le SQL Editor de Supabase</h3>
    <p class="muted small">Le Labo ne lance rien : un événement et la chasse se règlent côté serveur.</p>
    <pre class="labsql">-- Lancer un événement (ici : maintenant, pour 3 jours)
insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
  ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.',
   now(), now() + interval '3 days', 120);

-- L'arrêter avant l'heure
update public.evenements set fin = now() where fin > now();

-- Ouvrir la chasse tout de suite, ou à une heure donnée
update public.chasse set active = true, ouvre_le = null where id = 1;
update public.chasse set active = true,
  ouvre_le = timestamptz '2026-10-04 12:00:00+02' where id = 1;

-- La refermer (tant que personne ne l'a tirée)
update public.chasse set active = false where id = 1;</pre>
  </section>`;
}

/* Un instant ISO tel que le serveur l'écrirait, à `ms` d'ici. */
const isoDans = ms => new Date(Date.now() - Backend.skew + ms).toISOString();

function labMontrerApercu(nom) {
  const u = uniques[0];
  const H = 3600000;
  const ev = (a_venir, debut, fin) => ({ titre: 'Boosters doublés', texte: 'Un booster toutes les 2 h au lieu de 4.',
    debut: isoDans(debut), fin: isoDans(fin), ticket_minutes: 120, a_venir });
  const ch = o => Object.assign({ carte: u ? u.id : 'u01', active: true, trouvee: false, gagnant: null,
    trouvee_le: null, ouvre_le: null }, o);
  if (u) delete save.col[u.id];

  if (nom === 'avant') {
    save.evenement = ev(true, 10.5 * H, 82.5 * H);
    save.chasse = ch({ active: false, ouvre_le: isoDans(10.5 * H) });
  } else if (nom === 'pendant') {
    save.evenement = ev(false, -2 * H, 70 * H);
    save.chasse = ch({ ouvre_le: isoDans(-2 * H) });
  } else if (nom === 'trouvee') {
    save.evenement = ev(false, -26 * H, 46 * H);
    save.chasse = ch({ trouvee: true, gagnant: 'Quelqu\'un', trouvee_le: isoDans(-H) });
  } else if (nom === 'mienne') {
    save.evenement = ev(false, -26 * H, 46 * H);
    save.chasse = ch({ trouvee: true, gagnant: save.pseudo, trouvee_le: isoDans(-H) });
    if (u) save.col[u.id] = 1;
  }
  labApercu = { avant: 'Avant le départ', pendant: 'Pendant', trouvee: 'Chasse terminée', mienne: 'Carte unique en main' }[nom];
  toast('Aperçu affiché. Va voir Boosters et Collection.');
  render();
}

async function labEtatReel() {
  labApercu = '';
  try { await Backend.pull(); } catch (e) { /* le prochain rafraîchissement s'en chargera */ }
  render();
  toast('État du serveur rétabli.');
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
