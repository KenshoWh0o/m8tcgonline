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
      <button class="labbtn tL" data-act="t-S" ${secretes.length ? '' : 'disabled'}><b>Secrète</b><span>en dernière carte</span></button>
      <button class="labbtn tUN" data-act="t-UN" ${uniques.length ? '' : 'disabled'}><b>Carte unique</b><span>à la place de la dernière carte</span></button>
      <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
      <button class="labbtn tREV" data-act="t-REV" ${reverses.length ? '' : 'disabled'}><b>Reverse Rare</b><span>en 5ᵉ carte, 15 % en vrai</span></button>
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

  ${vLabCadeau()}

  <section class="panel">
    <h2>Version 2.0 · Reflets</h2>
    <p class="muted small">Les fenêtres de la 2.0, sans rien réclamer ni dépenser.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-v2-nouveautes">Nouveautés 2.1</button>
      <button class="btn ghost" data-act="t-v2-palier">Palier : une carte</button>
      <button class="btn ghost" data-act="t-v2-palier-titre">Palier : un titre</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="btn ghost" data-act="t-v2-invitation">Invitation achetée</button>
      <button class="btn ghost" data-act="t-v2-reflets">Onglet de l'événement</button>
      <button class="btn ghost" data-act="t-v2-illu">Devine l'illu</button>
    </div>
    <p class="muted small" style="margin-top:10px">La fin de l'événement : pendant trois jours, son onglet devient un récap.
      Aperçu avec des chiffres inventés — rien n'est enregistré.</p>
    <div class="row" style="margin-top:6px">
      <button class="btn ghost" data-act="t-v2-recap">Onglet récap</button>
      <button class="btn ghost" data-act="t-v2-recap-pop">Fenêtre de fin</button>
      <button class="btn ghost" data-act="t-v2-recap-ban">Bandeau récap</button>
    </div>
    <p class="muted small" style="margin-top:8px">La fabrication des Reverses s'ouvre côté serveur :
      <code>update public.parametres set fabrication_reverse = true where id = 1;</code></p>
  </section>

  <section class="panel">
    <h2>Version 3.0 · Le Choc des Sections</h2>
    <p class="muted small">L'onglet de l'événement (s'il est en cours), et son récap avec des chiffres inventés — rien n'est enregistré.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-v3-nouveautes">Nouveautés 3.0</button>
      <button class="btn ghost" data-act="t-v3-choc">Onglet de l'événement</button>
      <button class="btn ghost" data-act="t-v3-recap">Onglet récap</button>
      <button class="btn ghost" data-act="t-v3-recap-pop">Fenêtre de fin</button>
      <button class="btn ghost" data-act="t-v3-recap-ban">Bandeau récap</button>
    </div>
    <p class="muted small" style="margin-top:8px">L'événement s'ouvre côté serveur (supabase/25_choc.sql, en fin de fichier) ;
      la barre de vie du Raid se règle avec <code>update public.parametres set raid_echelle = 0.5 where id = 1;</code></p>
  </section>

  <section class="panel">
    <h2>Version 3.0 · Les Combats, tout voir</h2>
    <p class="muted small">Ce que le jeu cache, ou ne montre qu'au bon moment. En lecture seule : rien ne se joue ni ne s'enregistre.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-v3-camp" data-v="toxique">Campagne de la Section Toxique</button>
      <button class="btn ghost" data-act="t-v3-camp" data-v="deter">Campagne de la Section Déter</button>
      <button class="btn ghost" data-act="t-v3-recompenses">Toutes les récompenses</button>
      <button class="btn ghost" data-act="t-v3-fin">Fin de combat (victoire, deux niveaux)</button>
      <button class="btn ghost" data-act="t-v3-niveau">Fiche du niveau</button>
      <button class="btn ghost" data-act="t-v3-bon-deck">Bilan d'un deck</button>
    </div>
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

/* ---------- Offrir un cadeau ---------- */
/* Des Éclats, des boosters, des Fragments, une carte, un mot : le joueur le
   trouve à sa visite suivante, dans un paquet à ouvrir (js/cadeaux.js). Le
   serveur vérifie que c'est bien un administrateur qui offre
   (supabase/18_cadeaux.sql). La liste aide à doser : depuis quand chacun
   joue, et combien de boosters le sépare de la médiane. */
let labJoueurs = null;

async function labChargerJoueurs() {
  try {
    labJoueurs = await Backend.adminJoueurs();
  } catch (e) {
    return toast(e.message || 'La liste des joueurs n\'a pas pu être chargée.');
  }
  render();
}

function vLabCadeau() {
  if (Backend.mode !== 'cloud') return '';
  const tete = `<h2>Offrir un cadeau</h2>
    <p class="muted small">Le joueur le trouve à sa prochaine visite, dans un paquet à ouvrir.
      Rien n'est versé avant qu'il l'ouvre.</p>`;
  const apercu = `<button class="btn ghost" data-act="t-cadeau">Voir un cadeau reçu</button>`;
  if (!labJoueurs) {
    return `<section class="panel">${tete}
      <div class="row"><button class="btn ghost" data-act="t-joueurs">Choisir les joueurs</button>${apercu}</div>
      <p class="muted small" style="margin-top:8px">L'aperçu montre le paquet et son ouverture tels que les
        verra le joueur, sans rien ajouter à ton compte.</p></section>`;
  }

  const js = labJoueurs.slice().sort((a, b) => Date.parse(b.inscrit) - Date.parse(a.inscrit));
  const tri = js.map(j => j.boosters).sort((a, b) => a - b);
  const mediane = tri.length ? tri[Math.floor(tri.length / 2)] : 0;
  const le = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const total = cards.length;
  const options = rar => toutesCartes().filter(c => c.rar === rar)
    .map(c => `<option value="${h(c.id)}">${h(c.code || c.id)} · ${h(c.nom)}</option>`).join('');

  return `<section class="panel">${tete}
    <p class="small labmed">Médiane : <b>${fmtN(mediane)} boosters</b> ouverts. Les derniers arrivés en premier.</p>
    <div class="labjoueurs">${js.map(j => {
      const retard = mediane - j.boosters;
      return `<label class="labjoueur">
        <input type="checkbox" data-cdj="${h(j.id)}">
        <span><b>${h(j.pseudo)}</b>
          <small>inscrit le ${h(le(j.inscrit))} · ${fmtN(j.boosters)} boosters · ${j.cartes}/${total} cartes${retard > 0
            ? ` · <em>${fmtN(retard)} de retard</em>` : ''}${j.en_attente ? ` · ${j.en_attente} cadeau${j.en_attente > 1 ? 'x' : ''} en attente` : ''}</small></span>
      </label>`;
    }).join('')}</div>

    <div class="labcadeau">
      <label class="field"><span>Éclats</span><input id="cd-eclats" type="number" min="0" max="100000" step="50" placeholder="0"></label>
      <label class="field"><span>Boosters</span><input id="cd-boosters" type="number" min="0" max="100" step="1" placeholder="0"></label>
      <label class="field"><span>${h(FRAGMENTS.nom)}</span><input id="cd-fragments" type="number" min="0" max="100000" step="50" placeholder="0"></label>
    </div>
    <label class="field"><span>Carte <small class="muted">(facultatif)</small></span>
      <select id="cd-carte"><option value="">Aucune</option>
        ${['PR', 'L', 'E', 'R', 'BR', 'PC', 'C', 'ES'].map(r => {
          const o = options(r);
          return o ? `<optgroup label="${h((RAR[r] || RAR.C).nom)}">${o}</optgroup>` : '';
        }).join('')}
      </select></label>
    <label class="field"><span>Un mot <small class="muted">(facultatif)</small></span>
      <textarea id="cd-mot" maxlength="300" rows="2" placeholder="Bienvenue, et merci d'être venu !"></textarea></label>
    <div class="row"><button class="btn" data-act="cadeau-offrir">Offrir</button>${apercu}</div>
    <p class="muted small" style="margin-top:8px">L'aperçu reprend ce que tu as saisi (ou un exemple si
      rien ne l'est), sans rien envoyer ni ajouter à ton compte.</p>
  </section>`;
}

/* Le cadeau tel que le joueur le recevra : ce qui est saisi dans le
   formulaire, ou un exemple. */
function labApercuCadeau() {
  const nombre = id => Math.max(0, Math.floor(+(($('#' + id) || {}).value || 0)) || 0);
  let c = {
    eclats: nombre('cd-eclats'), boosters: nombre('cd-boosters'), fragments: nombre('cd-fragments'),
    carte: ($('#cd-carte') || {}).value || null, message: (($('#cd-mot') || {}).value || '').trim()
  };
  if (!c.eclats && !c.boosters && !c.fragments && !c.carte) {
    const leg = cards.filter(k => k.rar === 'L');
    c = { eclats: 2000, boosters: 10, fragments: 2000, carte: leg.length ? rnd(leg).id : null,
          message: c.message || 'Bienvenue, et merci d\'être venu !' };
  }
  const essai = Object.assign({ id: 'essai', test: true, de: save.pseudo }, c);
  montrerCadeau(essai, [essai]);
}

function labOffrirCadeau() {
  const joueurs = Array.from(document.querySelectorAll('[data-cdj]:checked')).map(i => i.dataset.cdj);
  const nombre = id => Math.max(0, Math.floor(+(($('#' + id) || {}).value || 0)) || 0);
  const c = {
    joueurs,
    eclats: nombre('cd-eclats'), boosters: nombre('cd-boosters'), fragments: nombre('cd-fragments'),
    carte: ($('#cd-carte') || {}).value || null,
    message: (($('#cd-mot') || {}).value || '').trim()
  };
  if (!joueurs.length) return toast('Choisis au moins un joueur.');
  if (!c.eclats && !c.boosters && !c.fragments && !c.carte) return toast('Le cadeau est vide.');
  const noms = joueurs.map(id => (labJoueurs.find(j => j.id === id) || {}).pseudo).filter(Boolean);
  const k = c.carte ? byId[c.carte] : null;
  const contenu = [
    c.eclats && `${fmtN(c.eclats)} Éclats`, c.boosters && `${fmtN(c.boosters)} booster${c.boosters > 1 ? 's' : ''}`,
    c.fragments && `${fmtN(c.fragments)} ${FRAGMENTS.nom}`, k && `la carte ${k.nom}`
  ].filter(Boolean).join(', ');

  openSheet({
    title: `Offrir à ${noms.length} joueur${noms.length > 1 ? 's' : ''} ?`,
    body: `<p><b>${h(contenu)}</b>, chacun.</p>
      <p class="muted small">À ${h(noms.join(', '))}.</p>
      ${c.message ? `<blockquote class="cdmot">${h(c.message)}</blockquote>` : ''}
      <p class="muted small">Il ne se reprend plus une fois ouvert. Avant, il se retire à la main
        (en bas de <code>supabase/18_cadeaux.sql</code>).</p>`,
    actions: [
      { label: 'Offrir', primary: true, fn: async () => {
        closeSheet();
        try {
          const n = await Backend.offrirCadeau(c);
          toast(`Cadeau envoyé à ${n} joueur${n > 1 ? 's' : ''}.`);
          SFX.jouer('gagne');
          labJoueurs = await Backend.adminJoueurs();
          render();
        } catch (e) {
          toast(e.message || 'Le cadeau n\'est pas parti.');
        }
      }},
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}



/* ---------- Version 3.0 : toutes les récompenses ---------- */
/* La campagne (les deux Sections ont les mêmes), l'Arcade, les niveaux de
   combattant, le Raid, et le Pass du Choc s'il est chargé. */
function laboRecompenses() {
  const gain = r => [r.eclats ? `${fmtN(r.eclats)} Éclats` : '', r.boosters ? `${r.boosters} booster${r.boosters > 1 ? 's' : ''}` : '',
    r.fragments ? `${fmtN(r.fragments)} Fragments` : '', r.cadre ? `cadre « ${h((FRAMES[r.cadre] || {}).nom || r.cadre)} »` : '',
    r.titre ? `titre « ${h((TITRES[r.titre] || {}).nom || r.titre)} »` : '', r.carte ? h((byId[r.carte] || {}).nom || r.carte) : ''].filter(Boolean).join(', ') || '—';
  const tableau = (tete, lignes) => `<table class="labtab"><thead><tr>${tete.map(x => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>${lignes.map(l => `<tr>${l.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const camp = combatsCampagne('toxique').map(f => [f.n + 1, `Acte ${ACTES.indexOf(f.acte) + 1}${f.rang ? (f.rang === 'final' ? ' · finale' : ' · boss') : ''}`,
    `${f.niveau}★`, f.regle ? [f.regle.pv ? `${f.regle.pv} PV` : '', f.regle.ess ? `+${f.regle.ess} Essence` : ''].filter(Boolean).join(', ') : '—', gain(f.recompense)]);
  const niveaux = [];
  for (let n = 2; n <= 60; n++) { const r = recompenseNiveau(n); if (r && (r.boosters || r.cadre || r.titre || r.fragments)) niveaux.push([n, fmtN(xpRequis(n - 1)), gain(Object.assign({}, r, { eclats: 0 }))]); }
  const ev = typeof chEv !== 'undefined' && chEv && chEv.piste;
  const R = RAID;
  return `<p class="muted small">Rejouer un combat de campagne gagné : ${RECOMPENSE_REJOUER.eclats} Éclats. Au plus ${PVE_PLAFOND} victoires récompensées par jour contre l'IA.</p>
    <h3>Campagne (la même pour les deux Sections)</h3>
    ${tableau(['n°', 'Acte', 'IA', 'Règle', 'Première victoire'], camp)}
    <p class="muted small">Au bout : la Promo de l'autre Section, le titre « Champion des Sections », son Starter Deck prêté.</p>
    <h3>Arcade</h3>
    ${tableau(['Niveau', 'Nom', 'Victoire'], DIFFICULTES.map(d => [`${d.niveau}★`, h(d.nom), `${d.eclats} Éclats`]))}
    <h3>Niveaux de combattant</h3>
    <p class="muted small">Chaque niveau : ${NIVEAUX.eclats} Éclats. Les paliers jusqu'au 60 :</p>
    ${tableau(['Niveau', 'XP pour y monter', 'En plus'], niveaux)}
    <h3>Le Raid · ${h(R.nom)}</h3>
    ${tableau(['Phase', 'Seuil', 'Combat', 'Coffre commun'], R.phases.map((ph, i) => [i + 1, `${fmtN(ph.seuil)} × échelle`,
      `IA ${ph.ia} ★ · ${ph.pv} PV${ph.ess ? ` · +${ph.ess} Ess.` : ''}`, h(ph.commun.titre)]))}
    ${tableau(['Palier perso', 'Dégâts', 'Coffre'], R.perso.map((x, i) => [i + 1, fmtN(x.seuil), h(x.titre)]))}
    ${tableau(['Infini', 'Combat'], [1, 2, 3, 4, 6, 9].map(n => { const c = R.infini(n); return [`palier ${n}`, `IA ${c.ia} ★ · boss ${c.pvBoss} PV · +${c.ess} Ess. · toi ${c.pvMoi} PV`]; }))}
    <p class="muted small">Pendant le Choc : ${R.parDegat} Étincelles par dégât, +${R.victoire} si le boss tombe. Sinon : ${R.parDegatEclats} Éclats par dégât, +${R.victoireEclats}. ${R.tentatives} tentatives par jour ; saisons de ${R.saison.jours} jours. L'échelle des seuils se règle côté serveur (<code>parametres.raid_echelle</code>).</p>
    <h3>Le Pass du Choc</h3>
    ${ev ? tableau(['Palier', 'Étincelles', 'Récompense'], chEv.piste.map(x => [x.palier, fmtN(x.seuil), h(x.titre || x.type || '')])) : '<p class="muted small">Ouvre une fois l\'onglet de l\'événement (pendant le Choc) pour charger le Pass, puis reviens ici.</p>'}`;
}
