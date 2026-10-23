/* Onglet Labo : tout ce qu'on veut voir sans avoir à le mériter.
   Réservé aux administrateurs — il n'apparaît que si le serveur a marqué le
   profil is_admin (voir supabase/05_admin.sql). Le cacher côté navigateur ne
   suffirait pas : c'est le serveur qui refuse les actions, pas l'interface qui
   les masque.

   Presque tout y est local : rejouer une mise en scène, poser l'interface
   dans l'état d'un événement, modifier l'affichage. Les seules actions réelles
   (annonce, cadeau, et « Rejouer mes essais du jour » de L'Échauffement)
   passent par des fonctions du serveur qui vérifient elles-mêmes le droit
   d'administrateur ; l'onglet Joueurs le dit en tête. */
"use strict";

/* Quatre sous-onglets : ce qui se passe maintenant (l'événement du jour et
   ses outils), les mises en scène à rejouer, les actions réelles sur les
   joueurs, et l'affichage local. */
let labVue = 'maintenant';
const LAB_VUES = [['maintenant', 'Maintenant'], ['scenes', 'Scènes'], ['joueurs', 'Joueurs'], ['affichage', 'Affichage']];

function vTest() {
  if (!save.isAdmin) {
    return vide('Réservé', "Cette page est réservée aux administrateurs du jeu.");
  }
  if (!cards.length) {
    return `<div class="pagehead"><div><h1>Labo</h1></div></div>
      ${vide('Aucune carte', 'Le fichier js/cards-data.js ne contient aucune carte.')}`;
  }
  const corps = labVue === 'scenes' ? vLabScenes() : labVue === 'joueurs' ? vLabJoueurs()
    : labVue === 'affichage' ? vLabAffichage() : vLabMaintenant();
  return `<div class="pagehead"><div><h1>Labo</h1>
      <p>Voir ce qu'on ne peut pas provoquer. Tout est local, sauf l'onglet Joueurs.</p></div></div>
    <div class="segbar labvues">${LAB_VUES.map(([k, n]) => `<button data-labv="${k}" class="${labVue === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${corps}`;
}

/* ---------- Maintenant ---------- */
/* L'état du serveur, puis l'événement du moment et ses outils. Un aperçu ne
   change que l'affichage : « Revenir à l'état réel » redemande tout. */
let labEch = null;
let labEchCharge = false;

async function labChargerEch() {
  if (labEchCharge) return;
  labEchCharge = true;
  try { labEch = await Backend.echAdmin(); } catch (e) { labEch = { erreur: e.message || 'Le serveur n\'a pas répondu.' }; }
  if (tab === 'labo') render();
}

function vLabMaintenant() {
  if (!labEch && Backend.mode === 'cloud') labChargerEch();
  const ev = save.evenement;
  const ch = save.chasse || {};
  const u = uniques[0];
  const quand = iso => jourHeure(srvTime(iso));
  const recap = typeof recapReflets === 'function' && !rfRecapApercu ? recapReflets() : null;
  const etatEv = ev ? (ev.a_venir ? `« ${ev.titre} » commence ${quand(ev.debut)}, finit ${quand(ev.fin)}.` : `« ${ev.titre} » en cours, finit ${quand(ev.fin)}.`)
    : recap ? `Récap de « ${recap.titre} » ${jourHeure(srvTime(recap.jusqua), 'jusqu\'à')}.` : 'Aucun.';
  const E = labEch && !labEch.erreur ? labEch : null;
  const etatEch = !E ? (labEch ? labEch.erreur : 'Chargement…')
    : Date.now() < srvTime(E.debut) ? `Commence ${quand(E.debut)}, finit ${quand(E.fin)}.`
    : Date.now() < srvTime(E.fin) ? `Défi ${E.ouvert} sur 7 ouvert, finit ${quand(E.fin)}.`
    : `Terminée ${quand(E.fin)}.`;
  const etatCh = !ch.carte ? 'Inconnue.'
    : ch.trouvee ? `Terminée : tirée par ${ch.gagnant || 'un joueur'}.`
    : ch.active ? 'Ouverte : une chance sur 250 par booster.' : 'Fermée.';
  const apercu = (echData && echData.apercu) || rfRecapApercu;
  /* Les Reverses (version 2.5, supabase/22c_reverses.sql). */
  const rv = revEtat();
  const etatRev = revOuvertes() ? `Recyclage et fabrication ouverts : ${revCoutsTexte()}.`
    : rv.des ? `Fermés : ouvrent ${jourParis(rv.des)}.` : 'Fermés, sans date.';

  return `${apercu ? `<p class="labalerte">Un aperçu est affiché : ce n'est pas l'état du serveur.
      <button class="linkbtn" data-act="t-ev-reel">Revenir à l'état réel</button></p>` : ''}
    <section class="panel">
      <h2>Le serveur</h2>
      <div class="labetat">
        <div><span>Événement</span><b>${h(etatEv)}</b></div>
        <div><span>L'Échauffement</span><b>${h(etatEch)}</b></div>
        <div><span>Recharge</span><b>Un booster toutes les ${h(String(Math.round(INTERVAL / 360000) / 10).replace('.', ','))} h</b></div>
        <div><span>${h(u ? u.nom : 'Carte unique')}</span><b>${h(etatCh)}</b></div>
        <div><span>Reverses</span><b>${h(etatRev)}</b></div>
      </div>
    </section>
    ${vLabEch(E)}
    ${ev && ev.code === 'reflets' || recap || rfRecapApercu ? vLabRecap() : ''}
    <section class="panel">
      <h2>Requêtes SQL</h2>
      <p class="muted small">Le Labo ne lance rien : ça se fait dans le SQL Editor de Supabase.</p>
      <pre class="labsql">-- Un événement de recharge (ici : maintenant, pour 3 jours)
insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
  ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.',
   now(), now() + interval '3 days', 120);
-- L'arrêter avant l'heure
update public.evenements set fin = now() where fin > now() and code is null;

-- L'Échauffement : déplacer la saison (heure de Paris)
update public.ech_saison set debut = timestamptz '2026-10-26 00:00:00+01',
  fin = timestamptz '2026-11-04 00:00:00+01' where id = 1;
-- Les meilleures notes, défi par défi
select p.pseudo, s.jour, s.etoiles, s.tours from public.ech_scores s
  join public.profiles p on p.id = s.user_id order by s.jour, s.etoiles desc;

-- Les Reverses : déplacer l'ouverture, ou ouvrir tout de suite
update public.parametres set reverses_des = timestamptz '2026-10-24 00:00:00+02' where id = 1;
update public.parametres set fabrication_reverse = true where id = 1;</pre>
    </section>`;
}

/* L'Échauffement : la saison, la participation, les aperçus de la page, et
   les huit indices — que seul le Labo peut lire avant de les gagner. */
function vLabEch(E) {
  if (!E) return '';
  const ici = echData && echData.apercu;
  return `<section class="panel">
    <h2>L'Échauffement</h2>
    <p class="muted small">${fmtN(E.joueurs)} ${E.joueurs > 1 ? 'joueurs ont' : 'joueur a'} tenté un défi ;
      ${fmtN(E.sept)} ${E.sept > 1 ? 'ont' : 'a'} gagné les sept, ${fmtN(E.parfait)} ${E.parfait > 1 ? 'ont' : 'a'} les 21 étoiles.</p>
    <div class="labech">
      <span></span><b>Règle</b><b>Déf.</b><b>Essais</b><b>Gagnés</b><b>★★★</b>
      ${E.defis.map(d => `<span><i class="tnum">${d.jour}</i>${h((byId[d.adversaire] || {}).nom || d.adversaire)}</span>
        <span>${h(d.titre)}</span><span class="tnum">${fmtN(d.pv)}</span><span class="tnum">${fmtN(d.essais)}</span>
        <span class="tnum">${fmtN(d.gagnes)}</span><span class="tnum">${fmtN(d.parfaits)}</span>`).join('')}
    </div>
    <h3 class="labsous">Aperçus</h3>
    <div class="labgrid">
      <button class="labbtn" data-act="t-ech-debut"><b>La page</b><span>au premier jour, rien de gagné</span></button>
      <button class="labbtn" data-act="t-ech-complet"><b>Tout gagné</b><span>21 étoiles, les huit indices</span></button>
      <button class="labbtn" data-act="t-ech-annonce"><b>La fenêtre</b><span>l'annonce, une fois par joueur</span></button>
      <button class="labbtn" data-act="t-ech-indices"><b>Les indices</b><span>les huit, avec leur texte</span></button>
    </div>
    <p class="muted small" style="margin-top:9px">Dans l'aperçu, les sept défis sont ouverts et se jouent avec ta
      collection, sans limite d'essais : rien n'est envoyé au serveur.</p>
    ${ici ? `<h3 class="labsous">Le bandeau de l'écran Boosters</h3>${vBandeauEch()}` : ''}
    <h3 class="labsous">Sur ton compte, pour de vrai</h3>
    <div class="row"><button class="btn ghost" data-act="t-ech-rejouer">Rejouer mes essais du jour</button></div>
    <p class="muted small" style="margin-top:8px">Efface tes essais d'aujourd'hui (pas tes notes ni tes gains),
      pour retester sans attendre demain. Seulement pendant la saison.</p>
  </section>`;
}

/* L'état d'aperçu : les sept défis ouverts, et, pour « complet », les
   21 étoiles et les huit indices. */
function labEchApercu(complet) {
  const E = labEch;
  if (!E || E.erreur) return toast('Les données de L\'Échauffement ne sont pas chargées.');
  const t = Date.now();
  echData = {
    apercu: true, debut: new Date(t - 6 * 86400000).toISOString(), fin: new Date(t + 3 * 86400000 - 3600000).toISOString(),
    ouvert: 7, total: 7, essais_max: 3, serveur: new Date(t).toISOString(),
    defis: E.defis.map(d => Object.assign({}, d, { etoiles: complet ? 3 : 0, equipe: null, essais_jour: 0 })),
    etoiles: complet ? 21 : 0, gagnes: complet ? 7 : 0, paliers: complet ? ['sept', 'parfait'] : [],
    indices: complet ? E.indices.slice() : [], apercuIndices: E.indices.slice()
  };
  if (!complet) echData.defis = echData.defis.slice(0, 1);
  echVue = 'accueil';
  aller('combats');
}

function labEchIndices() {
  const E = labEch;
  if (!E || E.erreur) return toast('Les données de L\'Échauffement ne sont pas chargées.');
  const l = E.indices.slice().sort((a, b) => (a.jour || 8) - (b.jour || 8));
  openSheet({
    title: 'Les huit indices',
    body: `<p class="muted small">Trois étoiles au défi n donnent l'indice n ; les sept, le dernier mot.
        Les joueurs ne reçoivent le texte qu'une fois gagné.</p>
      <div class="labinds">${l.map(x => `<div class="labind"><span class="ech-ind ouvert">${vIndiceVisuel(x)}</span>
        <span><small>${x.jour ? 'Défi ' + x.jour : 'Les sept'}</small><b>${h(x.titre)}</b><em>${h(x.texte)}</em></span></div>`).join('')}</div>`,
    actions: [{ label: 'Fermer', primary: true, fn: closeSheet }]
  });
}

async function labEchRejouer() {
  try {
    const r = await Backend.echAdminRejouer();
    if (!(echData && echData.apercu)) echData = r.etat;
    toast(r.effaces ? `${r.effaces} essai${r.effaces > 1 ? 's' : ''} effacé${r.effaces > 1 ? 's' : ''}.` : 'Aucun essai aujourd\'hui.');
  } catch (e) {
    toast(e.message || 'Le serveur n\'a pas répondu.');
  }
}

/* Le récap de Reflets : tant qu'il dure (ou qu'il va venir). */
function vLabRecap() {
  return `<section class="panel">
    <h2>Reflets · le récap</h2>
    <p class="muted small">Après l'événement, son onglet devient un récap jusqu'au dimanche 25 octobre minuit.
      Aperçu avec des chiffres inventés.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-v2-recap">Onglet récap</button>
      <button class="btn ghost" data-act="t-v2-recap-pop">Fenêtre de fin</button>
      <button class="btn ghost" data-act="t-v2-recap-ban">Bandeau</button>
    </div>
  </section>`;
}

async function labEtatReel() {
  if (echData && echData.apercu) echData = null;
  if (rfRecapApercu) { rfRecapApercu = null; rfRecap = null; }
  try { await Backend.pull(); } catch (e) { /* le prochain rafraîchissement s'en chargera */ }
  await chargerEch();
  render();
  toast('État du serveur rétabli.');
}

/* ---------- Scènes ---------- */
function vLabScenes() {
  const has = r => cards.some(c => c.rar === r && c.cat !== 'essence');
  return `<section class="panel">
    <h2>Ouvertures</h2>
    <p class="muted small">Tirées dans ce navigateur : elles ne consomment rien et n'ajoutent rien. Elles
      règlent la mise en scène, pas les probabilités réelles.</p>
    <div class="labgrid">
      <button class="labbtn" data-act="t-open"><b>Booster normal</b><span>Tirage réel</span></button>
      <button class="labbtn tR" data-act="t-R" ${has('R') ? '' : 'disabled'}><b>Rare</b><span>en dernière carte</span></button>
      <button class="labbtn tE" data-act="t-E" ${has('E') ? '' : 'disabled'}><b>Épique</b><span>en dernière carte</span></button>
      <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
      <button class="labbtn tBR" data-act="t-BR" ${brillantes.length ? '' : 'disabled'}><b>Essence Brillante</b><span>1 Essence sur ${FOIL_ODDS} en vrai</span></button>
      <button class="labbtn tUN" data-act="t-UN" ${uniques.length ? '' : 'disabled'}><b>Carte unique</b><span>à la place de la dernière carte</span></button>
      <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
      <button class="labbtn tREV" data-act="t-REV" ${reverses.length ? '' : 'disabled'}><b>Reverse Rare</b><span>en 5ᵉ carte, 15 % en vrai</span></button>
    </div>
    <div class="row" style="margin-top:9px"><button class="btn ghost" data-act="t-partage">Image de partage d'un booster</button></div>
  </section>

  <section class="panel">
    <h2>Cartes Promo</h2>
    <p class="muted small">L'obtention en entier, sans l'écriture dans la collection. Pour les obtenir pour de
      vrai : requêtes en bas de <code>supabase/03b_promos.sql</code>.</p>
    <div class="labgrid">
      ${promos.map(p => `<button class="labbtn tPR" data-promo="${h(p.id)}"><b>${h(p.code)}</b><span>${h(p.nom)}</span></button>`).join('')}
    </div>
    ${promos.length > 1 ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-act="t-promo-file">Les enchaîner toutes</button></div>' : ''}
  </section>

  <section class="panel">
    <h2>Fenêtres</h2>
    <div class="row">
      <button class="btn ghost" data-act="t-nouveautes-25">Nouveautés 2.5</button>
      <button class="btn ghost" data-act="t-nouveautes-21">Nouveautés 2.1</button>
      <button class="btn ghost" data-act="t-v2-invitation">Invitation achetée</button>
      <button class="btn ghost" data-act="t-cadeau">Cadeau reçu</button>
    </div>
  </section>

  <section class="panel">
    <h2>Notifications</h2>
    <p class="muted small">Les bandeaux du haut de l'écran, pour vérifier qu'ils ne recouvrent rien.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-quete">Quête accomplie</button>
      <button class="btn ghost" data-act="t-ping">Ping de la boîte</button>
      <button class="btn ghost" data-act="t-toast">Message court</button>
    </div>
  </section>`;
}

/* ---------- Joueurs (réel) ---------- */
function vLabJoueurs() {
  return `<p class="labalerte">Ici, tout est réel : ce qui part arrive chez les joueurs.</p>
  <section class="panel">
    <h2>Annonce à tous les joueurs</h2>
    <p class="muted small">Dans la boîte de réception de chacun, avec un ping pour ceux qui sont en jeu.
      Pour la retirer : « Retirer l'annonce » dans ta boîte.</p>
    <label class="field"><span>Titre</span>
      <input id="an-titre" type="text" maxlength="80" placeholder="Le jeu est ouvert !"></label>
    <label class="field"><span>Texte <small class="muted">(facultatif)</small></span>
      <textarea id="an-texte" maxlength="600" rows="3" placeholder="Quelques lignes, 600 caractères au plus."></textarea></label>
    <button class="btn" data-act="annonce-publier">Publier l'annonce</button>
  </section>
  ${vLabCadeau()}`;
}

/* ---------- Affichage (local) ---------- */
function vLabAffichage() {
  return `<section class="panel">
    <h2>Aperçu de la collection</h2>
    <p class="muted small">Seulement l'affichage de ce navigateur : le prochain rafraîchissement remet
      la collection et la réserve du serveur.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-all">Tout débloquer</button>
      <button class="btn ghost" data-act="t-clear">Vider</button>
      <button class="btn ghost" data-act="t-90">Monter à 90 %</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="btn ghost" data-act="t-10">+10 boosters</button>
      <button class="btn ghost" data-act="t-fragments">+5 000 ${h(FRAGMENTS.nom)}</button>
      <button class="btn ghost" data-act="t-succes">Tous les succès</button>
    </div>
    <label class="toggle" style="margin-top:10px">
      <span>Boosters illimités<small>Le bouton d'ouverture ne s'épuise plus</small></span>
      <input type="checkbox" id="unl" ${save.unlimited ? 'checked' : ''}></label>
  </section>

  <section class="panel">
    <h2>Équilibrage</h2>
    <p class="muted small">Les valeurs vivent côté serveur (<code>supabase/04_seed.sql</code>, <code>cfg()</code>
      de <code>supabase/01_schema.sql</code>) : les modifier là-bas, puis rejouer le fichier.</p>
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
    <h3 class="labsous">Reverses</h3>
    <div class="labtable">
      <span></span><b>Recycler</b><b>Fabriquer</b>
      ${['C', 'PC', 'R'].map(r => `<span><i class="rardot r${r}"></i>${h((RAR[r] || RAR.C).nom)}</span>
        <span class="tnum">+${fmtN(recValeurs()[r])}</span><span class="tnum">${fmtN(revCouts()[r])}</span>`).join('')}
    </div>
    <p class="muted small" style="margin-top:8px">${revOuvertes() ? 'Ouverts.' : 'Fermés.'} Le prix des Reverses est dans
      <code>prix_reverse()</code>, la date d'ouverture dans <code>parametres.reverses_des</code>
      (<code>supabase/22c_reverses.sql</code>).</p>
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

