/* Onglet Labo (version 3.0) : régler le jeu et son propre compte, et voir ce
   qu'on ne peut pas provoquer. Réservé aux administrateurs — il n'apparaît
   que si le serveur a marqué le profil is_admin
   (supabase/administration/admin.sql). Le cacher côté navigateur ne
   suffirait pas : chaque fonction du serveur vérifie elle-même le droit
   (labo_garde, supabase/installation/29_labo.sql).

   Cinq sous-onglets :
     · Serveur    — le Choc des Sections et le Raid, dans l'état voulu, pour
                    tout le monde ; les Reverses ; ce qui est en vigueur ;
     · Mon compte — sa collection, ses ressources, ses cosmétiques, et une
                    sauvegarde pour revenir en arrière ;
     · Combats    — ses combats (Section, campagne, essais du jour,
                    maîtrises), et ce que le jeu cache ;
     · Joueurs    — l'annonce à tous et les cadeaux ;
     · Aperçus    — les mises en scène et les fenêtres, sans rien envoyer.
   Sur le vrai site, une action « pour tout le monde » se confirme ; dans la
   démo (la pré-prod), le faux serveur joue les mêmes gestes sans rien
   demander. */
"use strict";

let labVue = 'serveur';
const LAB_VUES = [['serveur', 'Serveur'], ['compte', 'Mon compte'], ['combats', 'Combats'], ['joueurs', 'Joueurs'], ['apercus', 'Aperçus']];

/* La démo (pré-prod) parle à un faux serveur : rien n'y est réel. */
const labDemo = () => typeof SUPABASE_URL === 'string' && SUPABASE_URL.includes('demo.invalid');
/* Dans la démo de Gentle Mates (DEMO), le Labo est une console de test
   (vLabDemo) ; ?labo=complet dans l'adresse rend le Labo entier, pour le
   propriétaire. Lu au chargement : la page ne change pas d'adresse ensuite. */
const LABO_COMPLET = typeof location === 'object' && /[?&]labo=complet\b/.test(location.search);

/* L'état du serveur (labo_etat) : chargé en arrivant, rechargé après chaque
   geste. `manque` : les fonctions du Labo ne sont pas sur la base. */
let labEtat = null;
let labEtatCharge = false;

const labManque = e => /could not find the function|schema cache/i.test(String(e && e.message));
const J_LAB = 86400000;
const CHOC_JOURS = 14;

async function labCharger() {
  labEtatCharge = true;
  try { labEtat = await Backend.labo('labo_etat'); }
  catch (e) { labEtat = labManque(e) ? { manque: true } : { erreur: e.message || 'Le serveur n\'a pas répondu.' }; }
  if (tab === 'labo') render();
}

function vTest() {
  if (!save.isAdmin) {
    return vide('Réservé', "Cette page est réservée aux administrateurs du jeu.");
  }
  if (!cards.length) {
    return `<div class="pagehead"><div><h1>Labo</h1></div></div>
      ${vide('Aucune carte', 'Le fichier js/cards-data.js ne contient aucune carte.')}`;
  }
  if (Backend.mode !== 'cloud') {
    return `<div class="pagehead"><div><h1>Labo</h1></div></div>
      ${vide('Hors ligne', 'Le Labo parle au serveur : connecte-toi.')}`;
  }
  /* La démo de Gentle Mates : une seule page, pour tout essayer. Le Labo
     complet reste au propriétaire, avec ?labo=complet dans l'adresse. */
  if (DEMO && !LABO_COMPLET) return vLabDemo();
  const corps = labVue === 'compte' ? vLabCompte() : labVue === 'combats' ? vLabCombats()
    : labVue === 'joueurs' ? vLabJoueurs() : labVue === 'apercus' ? vLabApercus() : vLabServeur();
  return `<div class="pagehead"><div><h1>Labo</h1>
      <p>${labDemo() ? 'Pré-prod : un faux serveur, rien n\'est réel. Tout s\'y règle sans risque.'
        : 'Le vrai serveur. Ce qui est marqué <b>pour tout le monde</b> change le jeu de chaque joueur.'}</p></div></div>
    <div class="segbar labvues">${LAB_VUES.map(([k, n]) => `<button data-labv="${k}" class="${labVue === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${chRecapApercu ? `<p class="labalerte">Un aperçu est affiché : ce n'est pas l'état du serveur.
      <button class="linkbtn" data-act="t-ev-reel">Revenir à l'état réel</button></p>` : ''}
    ${corps}`;
}

/* « lundi 2 novembre à 18 h · dans 2 j 3 h » */
const labQuand = iso => {
  if (!iso) return 'sans date';
  const t = srvTime(iso) - Date.now();
  return `${jourParis(iso)} · ${t > 0 ? 'dans ' + dureeCourte(t) : 'il y a ' + dureeCourte(-t)}`;
};
const labJour = d => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
/* Minuit, heure de Paris, d'un jour donné (« 2026-10-26 ») : heure d'été ou d'hiver. */
const minuitParis = d => ['+02:00', '+01:00'].map(o => `${d}T00:00:00${o}`).find(x =>
  +new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(x)).find(p => p.type === 'hour').value === 0) || `${d}T00:00:00+01:00`;

/* Où en est le Choc : 'aucun', 'avant', 'jour' (et lequel), 'recap', 'fini'. */
function labChoc() {
  const c = labEtat && labEtat.choc;
  if (!c) return { etat: 'aucun' };
  const t = Date.now(), d = srvTime(c.debut), f = srvTime(c.fin), r = srvTime(c.recap_jusqua);
  if (t < d) return { etat: 'avant', dans: d - t };
  if (t < f) return { etat: 'jour', n: Math.min(CHOC_JOURS, Math.floor((t - d) / J_LAB) + 1) };
  if (t < r) return { etat: 'recap' };
  return { etat: 'fini' };
}

/* ======================================================= Serveur */
function vLabServeur() {
  if (!labEtatCharge) labCharger();
  if (!labEtat) return '<p class="muted boitecharge">Chargement de l\'état du serveur…</p>';
  if (labEtat.manque) return vLabManque();
  if (labEtat.erreur) return `<section class="panel"><h2>Le serveur</h2><p class="muted">${h(labEtat.erreur)}</p>
    <button class="btn ghost" data-lab="recharger">Réessayer</button></section>`;
  return vLabMaintenance() + vLabFrise() + vLabChoc() + vLabRaid() + vLabReverses() + vLabRefuses() + vLabVigueur();
}

/* Les combats que le serveur n'a pas pu vérifier (version 3.0.14) : il
   rejoue chaque partie (supabase/functions/combat-verifier) ; un coup que
   les règles refusent, ou un coup de l'adversaire qui n'est pas le sien, et
   le combat ne rapporte rien. Rien ici n'est une sanction : la liste dit qui,
   quand, et à quel coup, pour regarder de plus près. */
const MODE_NOM = { campagne: 'Campagne', infini: 'Arcade', raid: 'Raid', epreuve: 'Épreuve' };
const cleCombat = (mode, cle) => {
  const n = parseInt(String(cle || '').replace(/^\D+/, ''), 10);
  if (mode === 'infini') return `niveau ${cle}`;
  if (mode === 'campagne') return `combat ${n}`;
  if (mode === 'raid') return String(cle)[0] === 'i' ? `Infini, palier ${n}` : `phase ${n}`;
  return '';
};
function vLabRefuses() {
  const r = labEtat.refuses;
  if (!r) return '';
  return `<section class="panel">
    <h2>Combats refusés <small class="labtag">vérification</small></h2>
    <p class="muted small">Le serveur rejoue chaque combat avant de le payer. ${r.n30
      ? `${fmtN(r.n30)} combat${r.n30 > 1 ? 's n\'ont' : ' n\'a'} pas tenu ces trente derniers jours : ${r.n30 > 1 ? 'ils n\'ont' : 'il n\'a'} rien rapporté.`
      : 'Aucun combat refusé ces trente derniers jours.'}</p>
    ${r.liste && r.liste.length ? `<ul class="labliste">${r.liste.map(x => `<li><b>${h(x.joueur || '?')}</b>
      <span>${h(MODE_NOM[x.mode] || x.mode)}${cleCombat(x.mode, x.cle) ? ` · ${h(cleCombat(x.mode, x.cle))}` : ''} · ${h(labQuand(x.le))}${x.coup != null ? ` · coup ${x.coup + 1}` : ''}</span>
      <small class="muted">${h(x.raison || '')}</small></li>`).join('')}</ul>` : ''}
  </section>`;
}

/* La maintenance (version 3.0.12, labo_maintenance dans
   supabase/installation/29_labo.sql) : les joueurs devant l'écran de
   maintenance (js/gate.js), les administrateurs dans le jeu. Elle ne finit
   que quand on la lève ici ; l'heure de retour ne fait que s'afficher. */
function vLabMaintenance() {
  const m = labEtat.maintenance || {};
  /* datetime-local veut l'heure de l'appareil, sans fuseau. */
  const local = iso => { const d = new Date(srvTime(iso)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  return `<section class="panel labmaint${m.actif ? ' on' : ''}">
    <h2>Maintenance <small class="labtag">pour tout le monde</small></h2>
    <div class="labmaint-etat"><i aria-hidden="true"></i><span>${m.actif
      ? `<b>En maintenance</b><small>depuis ${h(labQuand(m.depuis))}${m.par ? ` · ${h(m.par)}` : ''}</small>`
      : '<b>En service</b><small>les joueurs jouent</small>'}</span></div>
    <p class="muted small">Pendant une maintenance, les joueurs voient l'écran de maintenance et le serveur refuse
      toutes leurs actions ; les administrateurs jouent, avec une pastille en haut de l'écran. Elle ne finit que
      quand on la lève ici. Une base 2.x qui reçoit la 3.0 y entre d'office.</p>
    <label class="field"><span>Le message</span><textarea id="lab-maint-msg" rows="3" maxlength="300"
      placeholder="${h(MAINT_DEFAUT)}">${h(m.message || '')}</textarea></label>
    <label class="field"><span>Retour prévu (facultatif, à l'heure de cet appareil)</span>
      <input id="lab-maint-fin" type="datetime-local" value="${m.fin ? local(m.fin) : ''}"></label>
    <div class="labgrid">
      ${m.actif ? `<button class="labbtn" data-lab="maint-maj"><b>Mettre à jour</b><span>le message et l'heure</span></button>
        <button class="labbtn" data-lab="maint-off"><b>Lever la maintenance</b><span>les joueurs reviennent</span></button>`
        : '<button class="labbtn" data-lab="maint-on"><b>Mettre en maintenance</b><span>tout de suite</span></button>'}
      <button class="labbtn" data-lab="maint-voir"><b>Voir l'écran</b><span>tel que les joueurs le verront</span></button>
    </div>
  </section>`;
}

/* Le message et l'heure du formulaire (null : une heure impossible). Hors
   de l'onglet Serveur (Aperçus), ceux de la maintenance en cours. */
function labMaintForm() {
  const t = $('#lab-maint-msg'), f = $('#lab-maint-fin');
  if (!t || !f) {
    const m = (labEtat && labEtat.maintenance) || {};
    return { message: m.actif ? m.message : null, fin: m.actif ? m.fin : null };
  }
  const message = t.value.trim() || null;
  if (!f.value) return { message, fin: null };
  const d = new Date(f.value);
  if (isNaN(d)) { toast('Cette heure ne se lit pas.'); return null; }
  if (d.getTime() <= Date.now()) { toast('L\'heure de retour est déjà passée.'); return null; }
  return { message, fin: d.toISOString() };
}

function vLabManque() {
  return `<section class="panel">
    <h2>Les fonctions du Labo manquent</h2>
    <p class="muted">La base n'a pas reçu <code>supabase/installation/29_labo.sql</code> : colle
      <code>supabase/TOUT.sql</code> dans le SQL Editor de Supabase (il se rejoue sans danger), puis recharge.
      En attendant, les onglets Joueurs et Aperçus marchent.</p>
    <button class="btn ghost" data-lab="recharger">Réessayer</button>
  </section>`;
}

/* Les trois puces, puis le calendrier en frise : ce qui est passé,
   maintenant, ce qui vient. */
function vLabFrise() {
  const E = labEtat, c = E.choc, R = E.raid || {}, rv = E.reverses || {};
  const ch = labChoc();
  const etatCh = { aucun: 'pas encore posé', avant: `dans ${dureeCourte(ch.dans || 0)}`, jour: `jour ${ch.n} sur ${CHOC_JOURS}`,
    recap: 'son récap', fini: 'terminé' }[ch.etat];
  const etatRaid = R.phase > 6 ? 'Infini' : `phase ${R.phase} sur 6`;
  const etatRev = rv.ouvertes ? (rv.manuel ? 'ouvertes à la main' : 'ouvertes') : rv.des ? 'fermées' : 'fermées, sans date';
  const jalons = [
    c && ['Début du Choc', c.debut], c && ['Fin du Choc', c.fin], c && ['Fin de son récap', c.recap_jusqua],
    R.debut && [`Début du raid ${R.saison} (${raidBoss(R.boss || RAID.boss).nom})`, minuitParis(R.debut)],
    R.fin && [`Raid ${R.saison + 1} (${raidBoss(R.saison + 1).nom})`, minuitParis(R.fin)],
    rv.des && !rv.manuel && ['Ouverture des Reverses', rv.des]
  ].filter(Boolean).sort((a, b) => srvTime(a[1]) - srvTime(b[1]));
  const maintenant = Date.now();
  const ligne = ([titre, iso]) => `<li class="labjalon ${srvTime(iso) <= maintenant ? 'passe' : 'avenir'}">
      <i aria-hidden="true"></i><span><b>${h(titre)}</b><small>${h(labQuand(iso))}</small></span></li>`;
  const avant = jalons.filter(j => srvTime(j[1]) <= maintenant), apres = jalons.filter(j => srvTime(j[1]) > maintenant);
  return `<section class="panel labserveur">
    <h2>Le serveur, maintenant</h2>
    <div class="labpuces">
      <span class="${ch.etat === 'jour' ? 'on' : ''}"><small>Le Choc</small><b>${h(etatCh)}</b></span>
      <span class="${R.phase > 1 ? 'on' : ''}"><small>Le Raid</small><b>${h(etatRaid)}</b></span>
      <span class="${rv.ouvertes ? 'on' : ''}"><small>Reverses</small><b>${h(etatRev)}</b></span>
    </div>
    <ol class="labfrise">
      ${avant.map(ligne).join('')}
      <li class="labjalon ici"><i aria-hidden="true"></i><span><b>Maintenant</b><small>${h(jourParis(new Date(Date.now() - Backend.skew).toISOString()))}</small></span></li>
      ${apres.map(ligne).join('')}
    </ol>
  </section>`;
}

/* Le Choc des Sections : un état, un jour, avancer, effacer. */
function vLabChoc() {
  const ch = labChoc(), P = labEtat.participation || {};
  const jours = Array.from({ length: CHOC_JOURS }, (x, i) => i + 1);
  return `<section class="panel">
    <h2>Le Choc des Sections <small class="labtag">pour tout le monde</small></h2>
    <p class="muted small">Deux semaines. Les joueurs voient le nouvel état à leur prochain rafraîchissement ;
      un autre événement en cours (Reflets) est clos.</p>
    <div class="labgrid">
      <button class="labbtn" data-lab="choc" data-etat="avant" data-n="2"><b>Avant</b><span>il commence dans 2 min</span></button>
      <button class="labbtn" data-lab="choc" data-etat="avant" data-n="60"><b>Avant</b><span>il commence dans 1 h</span></button>
    </div>
    <h3 class="labsous">En cours : le jour</h3>
    <div class="labjours">${jours.map(j => `<button data-lab="choc" data-etat="jour" data-n="${j}"
        class="${ch.etat === 'jour' && ch.n === j ? 'on' : ''}" aria-label="Jour ${j} du Choc">${j}</button>`).join('')}</div>
    <div class="labgrid" style="margin-top:8px">
      <button class="labbtn" data-lab="choc" data-etat="recap"><b>Son récap</b><span>fini depuis une heure, le récap court</span></button>
      <button class="labbtn" data-lab="choc" data-etat="fini"><b>Fini</b><span>le récap aussi</span></button>
      <button class="labbtn" data-lab="decaler" data-n="24" ${labEtat.choc ? '' : 'disabled'}><b>Avancer d'un jour</b><span>un jour de plus d'écoulé</span></button>
      <button class="labbtn" data-lab="decaler" data-n="-24" ${labEtat.choc ? '' : 'disabled'}><b>Reculer d'un jour</b><span>un jour de moins</span></button>
    </div>
    <p class="muted small" style="margin-top:10px">${fmtN(P.joueurs || 0)} ${(P.joueurs || 0) > 1 ? 'joueurs ont' : 'joueur a'} gagné
      des ${h(MONNAIES_EV.choc.nom)} (${fmtN(P.etincelles || 0)} en tout) ; ${fmtN(P.epreuves || 0)} Épreuve${(P.epreuves || 0) > 1 ? 's' : ''}
      du jour tentée${(P.epreuves || 0) > 1 ? 's' : ''}, ${fmtN(P.gagnees || 0)} gagnée${(P.gagnees || 0) > 1 ? 's' : ''} ;
      ${fmtN(P.raid || 0)} PV pris au boss pendant l'événement.</p>
    <button class="btn ghost labdanger" data-lab="choc-raz">Remettre le Choc à zéro…</button>
  </section>`;
}

/* Le Raid : le raid en cours (son boss), à une phase ; l'échelle des seuils. */
function vLabRaid() {
  const R = labEtat.raid || {};
  const s = R.seuils || [];
  const echelles = [0.25, 0.5, 1, 2];
  return `<section class="panel">
    <h2>Le Raid <small class="labtag">pour tout le monde</small></h2>
    <p class="muted small">Raid ${R.saison} (${h(raidBoss(R.boss || RAID.boss).nom)}), du ${h(labJour(R.debut))} au ${h(labJour(R.fin))} : ${fmtN(R.degats || 0)} PV pris par
      ${fmtN(R.joueurs || 0)} joueur${(R.joueurs || 0) > 1 ? 's' : ''}. Choisir une phase pose les dégâts du serveur à son seuil ;
      les coffres déjà ouverts le restent.</p>
    <div class="labjours">${[1, 2, 3, 4, 5, 6, 7].map(k => `<button data-lab="raid" data-n="${k}" class="${R.phase === k ? 'on' : ''}"
        aria-label="${k > 6 ? 'Les six abattues, l\'Infini' : 'Phase ' + k}">${k > 6 ? '∞' : k}</button>`).join('')}</div>
    <p class="muted small labseuils">Seuils : ${s.map((x, i) => `${i + 1}\u00a0·\u00a0${fmtN(x)}`).join(' — ')}</p>
    <h3 class="labsous">L'échelle des seuils</h3>
    <div class="labchoix" role="group" aria-label="Échelle des seuils">${echelles.map(x => `<button data-lab="echelle" data-n="${x}"
        class="${Math.abs((R.echelle || 1) - x) < 1e-9 ? 'on' : ''}">× ${String(x).replace('.', ',')}</button>`).join('')}</div>
    <p class="muted small">Les seuils sont calculés pour une dizaine de joueurs (× 1).</p>
    <p class="muted small">Les raids se comptent depuis le premier jour du Choc (quatorze jours chacun, ${RAID.bosses.map(b => h(b.nom)).join(' puis ')}) : poser le Choc à un jour déplace aussi le raid (au jour 15, le raid 2).</p>
    <button class="btn ghost labdanger" data-lab="raid-raz">Remettre le raid à zéro…</button>
  </section>`;
}

function vLabReverses() {
  const rv = labEtat.reverses || {};
  return `<section class="panel">
    <h2>Les Reverses <small class="labtag">pour tout le monde</small></h2>
    <p class="muted small">${rv.ouvertes ? 'Leur recyclage et leur fabrication sont ouverts.'
      : rv.des ? `Leur recyclage et leur fabrication ouvrent ${h(labQuand(rv.des))}.` : 'Leur recyclage et leur fabrication sont fermés, sans date.'}</p>
    <div class="labgrid">
      <button class="labbtn" data-lab="reverses" data-n="1" ${rv.ouvertes ? 'disabled' : ''}><b>Ouvrir</b><span>tout de suite</span></button>
      <button class="labbtn" data-lab="reverses" data-n="0" ${rv.ouvertes ? '' : 'disabled'}><b>Fermer</b><span>sans date</span></button>
    </div>
  </section>`;
}

/* Ce qui est en vigueur : lu sur le serveur, réglé dans les fichiers SQL. */
function vLabVigueur() {
  const E = labEtat, ch = E.chasse || {}, sc = E.sections || {};
  const etatCh = !ch.carte ? 'inconnue' : ch.trouvee ? `tirée${ch.gagnant ? ' par ' + ch.gagnant : ''}` : ch.active ? 'chasse ouverte' : 'chasse fermée';
  const r = E.recharge || {};
  return `<section class="panel">
    <h2>En vigueur</h2>
    <div class="labfacts">
      ${fait('Joueurs inscrits', fmtN(E.joueurs || 0))}
      ${fait('Sections', `${fmtN(sc.toxique || 0)} Toxique · ${fmtN(sc.deter || 0)} Déter`)}
      ${fait('Recharge', `${String(Math.round((r.minutes || 240) / 6) / 10).replace('.', ',')} h`)}
      ${fait('Réserve', `${r.cap || TICKET_CAP} boosters`)}
      ${fait('Carte unique', etatCh)}
      ${fait('Godpack', '1 / 2 000')}
      ${fait('Brillante, par Essence', '1 / ' + FOIL_ODDS)}
      ${fait('Échange gratuit', TRADE_COOLDOWN_H + ' h')}
    </div>
    ${(E.recharges || []).length ? `<h3 class="labsous">Événements de recharge</h3><div class="labetat">${E.recharges.map(x =>
      `<div><span>${h(x.titre)} · un booster toutes les ${Math.round(x.minutes / 6) / 10} h</span><b>${h(labQuand(x.debut))} → ${h(jourParis(x.fin))}</b></div>`).join('')}</div>` : ''}
    <h3 class="labsous">${h(FRAGMENTS.nom)}</h3>
    <div class="labtable">
      <span></span><b>Recycler</b><b>Fabriquer</b>
      ${['ES', 'C', 'PC', 'R', 'E', 'L'].map(x => `<span><i class="rardot r${x}"></i>${h((RAR[x] || RAR.C).nom)}</span>
        <span class="tnum">+${fmtN(recValeurs()[x])}</span><span class="tnum">${fmtN(fabCouts()[x])}</span>`).join('')}
      ${['C', 'PC', 'R'].map(x => `<span><i class="rardot r${x}"></i>Reverse ${h((RAR[x] || RAR.C).nom)}</span>
        <span class="tnum">+${fmtN(2 * recValeurs()[x])}</span><span class="tnum">${fmtN(revCouts()[x])}</span>`).join('')}
    </div>
    <details class="labplus"><summary>Requêtes SQL, pour ce que le Labo ne fait pas</summary>
      <pre class="labsql">-- Un événement de recharge (ici : maintenant, pour 3 jours)
insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
  ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.',
   now(), now() + interval '3 days', 120);
-- L'arrêter avant l'heure
update public.evenements set fin = now() where fin > now() and code is null;

-- Ouvrir le Choc à une date précise (fin de supabase/installation/25_choc.sql)
update public.evenements set debut = '2026-11-02 18:00+01', fin = '2026-11-23 18:00+01'
 where code = 'choc';

-- Les valeurs d'équilibrage : cfg() dans supabase/installation/01_schema.sql,
-- les quêtes et la boutique dans supabase/installation/04_seed.sql.</pre>
    </details>
  </section>`;
}

const fait = (l, v) => `<div class="labfait"><span>${h(l)}</span><b>${h(String(v))}</b></div>`;

/* Ce que chaque état du Choc fait aux joueurs, dit avant de confirmer. */
const LAB_EFFETS = {
  avant: n => `Le Choc commence dans ${n >= 60 ? n / 60 + ' h' : n + ' min'}, pour deux semaines. D'ici là, il s'annonce.`,
  jour: n => `Le Choc en est à son jour ${n} sur ${CHOC_JOURS} : l'Épreuve du jour, ses quêtes, son Pass, et le Raid en ${MONNAIES_EV.choc.nom}.`,
  recap: () => 'Le Choc est fini depuis une heure : son récap court pendant près de trois jours.',
  fini: () => 'Le Choc et son récap sont finis : l\'onglet de l\'événement disparaît.'
};

/* Une action pour tout le monde : sur le vrai site, on confirme d'abord. */
function labPourTous(titre, texte, fn) {
  if (labDemo()) return fn();
  openSheet({
    title: titre,
    body: `<p>${h(texte)}</p><p class="muted small">Pour tout le monde, tout de suite.</p>`,
    actions: [{ label: 'Confirmer', primary: true, fn: () => { closeSheet(); fn(); } },
              { label: 'Annuler', fn: closeSheet }]
  });
}

async function labServeurFaire(fn, args, msg) {
  occupe(true);
  try {
    const r = await Backend.labo(fn, args);
    labEtat = r && r.etat ? r.etat : r;
    /* Le jeu suit : me() (l'événement, son récap, les Reverses), le Choc, le
       Raid, et la porte (la maintenance, 3.0.12). */
    await Backend.pull().catch(() => {});
    await Porte.lire();
    if (chRecapApercu) { chRecapApercu = null; chRecap = null; }
    chEv = null; chEtat = null;
    if (evenementEnCours() === 'choc') await chargerChoc();
    await chargerRaid();
    toast(msg);
    SFX.jouer('gagne');
  } catch (e) {
    if (labManque(e)) labEtat = { manque: true };
    toast(e.message || 'Le serveur a refusé.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
    render();
  }
}

/* Effacer pour tout le monde : on écrit le mot, comme dans un SQL. */
function labEffacer(titre, texte, fn, args, msg) {
  openSheet({
    title: titre,
    body: `<p>${texte}</p>
      <label class="field"><span>Écris EFFACER pour confirmer</span><input id="lab-raz" type="text" autocomplete="off"></label>`,
    actions: [{ label: 'Effacer', primary: true, fn: () => {
        const v = valeur('lab-raz');
        if (v !== 'EFFACER') return toast('Écris EFFACER, en capitales.');
        closeSheet();
        labServeurFaire(fn, Object.assign({ p_confirmation: v }, args), msg);
      } },
      { label: 'Annuler', fn: closeSheet }]
  });
}

/* ======================================================= La démo (3.0.14) */
/* La démo présentée à Gentle Mates (DEMO, js/config.js) : le Labo sert à
   tout essayer sans attendre, pas à régler le serveur. Une page, dans
   l'ordre où l'on découvre le jeu — sa collection, les ouvertures rares, les
   combats, l'événement —, et seulement des gestes sans risque : la partie
   reste sur l'appareil, et « Recommencer la démo » (Réglages) repart de
   zéro. Les gestes sont ceux du Labo (labAction) : rien n'est écrit deux
   fois. */
function vLabDemo() {
  if (!labEtatCharge) labCharger();
  const ch = labChoc();
  const R = (labEtat && labEtat.raid) || {};
  const has = r => cards.some(c => c.rar === r && c.cat !== 'essence');
  const cb = save.combat || {};
  const niv = niveauDe(cb.xp || 0).niveau;
  const etatCh = { aucun: '…', avant: 'pas encore commencé', jour: `jour ${ch.n} sur ${CHOC_JOURS}`, recap: 'son récap', fini: 'terminé' }[ch.etat];
  return `<div class="pagehead"><div><h1>Labo</h1>
      <p>Pour tout essayer sans attendre. Rien n'est réel ici : la partie reste sur cet appareil, et « Recommencer la démo »,
        dans les Réglages, repart de zéro.</p></div></div>

    <section class="panel labdemo-une">
      <h2>Tout débloquer</h2>
      <p class="muted small">Toutes les cartes, en trois exemplaires (de quoi construire n'importe quel deck), tous les cadres,
        titres, tapis et sleeves, et de quoi dépenser en boutique.</p>
      <button class="btn" data-lab="demo-tout">Tout débloquer</button>
    </section>

    <section class="panel">
      <h2>Les ouvertures rares</h2>
      <p class="muted small">La mise en scène, sans attendre la chance. Ces boosters ne vont pas dans la collection.</p>
      <div class="labgrid">
        <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 booster sur 2 000</span></button>
        <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
        <button class="labbtn tL" data-act="t-S" ${secretes.length ? '' : 'disabled'}><b>Secrète</b><span>la finition la plus rare</span></button>
        <button class="labbtn tUN" data-act="t-UN" ${uniques.length ? '' : 'disabled'}><b>Carte unique</b><span>un seul exemplaire dans le jeu</span></button>
        <button class="labbtn tBR" data-act="t-BR" ${brillantes.length ? '' : 'disabled'}><b>Essence Brillante</b><span>1 Essence sur ${FOIL_ODDS}</span></button>
        <button class="labbtn tREV" data-act="t-REV" ${reverses.length ? '' : 'disabled'}><b>Reverse Rare</b><span>en 5ᵉ carte</span></button>
      </div>
    </section>

    <section class="panel">
      <h2>Les combats</h2>
      <p class="muted small">Niveau ${niv} de combattant${cb.section ? ` · Section ${h((SECTIONS[cb.section] || {}).court || cb.section)}` : ''}.</p>
      <div class="labgrid">
        <button class="labbtn" data-cb="tuto"><b>Le tutoriel</b><span>une partie guidée de cinq tours</span></button>
        <button class="labbtn" data-lab="combats" data-a="jour"><b>Rejouer aujourd'hui</b><span>victoires payées, Raid et Épreuve du jour</span></button>
        <button class="labbtn" data-lab="combats" data-a="maitrises" data-v="max"><b>Tout maîtriser</b><span>ses cartes au niveau V</span></button>
        <button class="labbtn" data-lab="combats" data-a="campagne" data-v="finie"><b>Campagne gagnée</b><span>les vingt combats</span></button>
      </div>
    </section>

    <section class="panel">
      <h2>L'événement</h2>
      <p class="muted small">Le Choc des Sections : ${h(etatCh)}. Le Raid : ${R.phase > RAID.phases.length ? 'les six phases abattues' : `phase ${R.phase || 1} sur ${RAID.phases.length}`}.</p>
      <div class="labgrid">
        <button class="labbtn" data-lab="choc" data-etat="jour" data-n="5"><b>Au cinquième jour</b><span>là où la démo commence</span></button>
        <button class="labbtn" data-lab="choc" data-etat="jour" data-n="${CHOC_JOURS}"><b>Le dernier jour</b><span>le Pass et les quêtes à finir</span></button>
        <button class="labbtn" data-lab="raid" data-n="${RAID.phases.length}"><b>La dernière phase du Raid</b><span>cinq phases déjà abattues</span></button>
        <button class="labbtn" data-lab="choc" data-etat="recap"><b>Le récap</b><span>l'événement fini</span></button>
      </div>
    </section>

    <section class="panel">
      <h2>Les ressources</h2>
      <div class="labres">
        ${labChamp('eclats', MONNAIE.nom, save.shards)}
        ${labChamp('fragments', FRAGMENTS.nom, save.fragments)}
        ${labChamp('boosters', 'Boosters en plus', save.bonus)}
        ${labChamp('reserve', 'Réserve', save.tickets)}
        ${evenementEnCours() ? labChamp('prismes', PRISMES.nom, save.prismes) : ''}
        ${labChamp('niveau', 'Niveau', niv, 1)}
      </div>
      <button class="btn ghost" data-lab="monnaies">Appliquer</button>
    </section>

    ${vLabMaitrise()}

    <section class="panel">
      <h2>Les cartes Promo</h2>
      <p class="muted small">Leur scène d'obtention, sans les ajouter à la collection.</p>
      <div class="labgrid">
        ${promos.map(p => `<button class="labbtn tPR" data-promo="${h(p.id)}"><b>${h(p.code)}</b><span>${h(p.nom)}</span></button>`).join('')}
      </div>
    </section>

    <section class="panel">
      <h2>La présentation</h2>
      <p class="muted small">Le jeu en sept écrans, comme à la première visite.</p>
      <button class="btn ghost" data-act="presentation">Revoir la présentation</button>
    </section>`;
}

/* Tout débloquer, d'un geste : le master set, tous les cosmétiques, et des
   ressources. Trois appels au faux serveur, l'état du dernier. */
async function labDemoTout() {
  occupe(true);
  try {
    await Backend.labo('labo_cartes', { p_quoi: 'master' });
    await Backend.labo('labo_cosmetiques', { p_ids: Object.keys(FRAMES).filter(k => k.startsWith('f_') && !horsDemo(k))
      .concat(Object.keys(TITRES).filter(k => !horsDemo(k) && k !== 't_admin'),
        Object.keys(TAPIS).filter(k => k !== 't_base'), Object.keys(SLEEVES).filter(k => k !== 's_base')) });
    Backend.apply(await Backend.labo('labo_monnaies', { p_valeurs: { eclats: 50000, fragments: 60000, boosters: 20 } }));
    /* Les Promos arrivent avec le reste : pas six scènes d'obtention à la
       suite (elles se regardent une à une plus bas). */
    filePromos.length = 0;
    labEtatCharge = false;
    toast('Tout est débloqué : les cartes, les cosmétiques, et de quoi dépenser.');
    SFX.jouer('gagne');
  } catch (e) {
    toast(e.message || 'Le serveur a refusé.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
    render();
  }
}

/* ======================================================= Mon compte */
function vLabCompte() {
  if (!labEtatCharge) labCharger();
  if (labEtat && labEtat.manque) return vLabManque();
  const sv = labEtat && labEtat.sauvegarde;
  const cb = save.combat || {};
  const niv = niveauDe(cb.xp || 0).niveau;
  const nCosm = Object.keys(FRAMES).filter(k => k.startsWith('f_') && !horsDemo(k)).length + Object.keys(TITRES).filter(k => !horsDemo(k)).length
    + Object.keys(TAPIS).filter(k => k !== 't_base').length + Object.keys(SLEEVES).filter(k => k !== 's_base').length;
  return `<p class="labalerte doux">Ton compte, pour de vrai : ta collection, tes ressources, ton classement. Mets-le de côté
      avant d'y toucher, et restaure-le après.</p>
    <section class="panel labsauve">
      <h2>Ma sauvegarde</h2>
      <p class="${sv ? '' : 'muted'}">${sv ? `Mise de côté ${h(jourParis(sv.le))}${sv.version !== '3.0' ? ` (en ${h(sv.version)})` : ''}, avec ${fmtN(sv.cartes)} cartes différentes.`
        : 'Rien n\'est mis de côté.'}</p>
      <p class="muted small">La restauration remet ta collection, tes ressources, tes cosmétiques, tes quêtes, tes combats,
        tes decks, tes maîtrises et ton historique tels qu'ils étaient. Tes amis, ta boîte, tes échanges et tes défis
        n'en font pas partie ; les dégâts que tu as faits au Raid restent comptés pour le serveur.</p>
      <div class="row">
        <button class="btn${sv ? ' ghost' : ''}" data-lab="sauver">${sv ? 'Remettre de côté' : 'Mettre mon compte de côté'}</button>
        ${sv ? '<button class="btn" data-lab="restaurer">Restaurer</button>' : ''}
      </div>
    </section>

    <section class="panel">
      <h2>Ma collection</h2>
      <div class="labgrid">
        <button class="labbtn tL" data-lab="cartes" data-q="master"><b>Master set</b><span>tout, sauf la carte unique, de quoi faire n'importe quel deck</span></button>
        <button class="labbtn tR" data-lab="cartes" data-q="classiques"><b>Les ${cards.length}</b><span>l'extension, un exemplaire</span></button>
        <button class="labbtn tE" data-lab="cartes" data-q="combat"><b>Les cartes de combat</b><span>Joueurs, Coachs, Moments, Objets, trois de chaque</span></button>
        <button class="labbtn tL" data-lab="cartes" data-q="maitrise"><b>Pour la maîtrise</b><span>chaque carte, avec de quoi la mener en Légende (8 à 23 exemplaires)</span></button>
        <button class="labbtn labdanger" data-lab="cartes" data-q="vider"><b>Vider</b><span>plus aucune carte</span></button>
      </div>
      <p class="muted small" style="margin-top:8px">Trois exemplaires de chaque carte : la limite d'un deck (règles
        officielles). Une carte que tu as déjà garde ses exemplaires en plus.</p>
    </section>

    <section class="panel">
      <h2>Mes ressources</h2>
      <div class="labres">
        ${labChamp('eclats', MONNAIE.nom, save.shards)}
        ${labChamp('fragments', FRAGMENTS.nom, save.fragments)}
        ${labChamp('boosters', 'Boosters en plus', save.bonus)}
        ${labChamp('reserve', 'Réserve', save.tickets)}
        ${labChamp('prismes', PRISMES.nom, save.prismes)}
        ${labChamp('niveau', 'Niveau', niv, 1)}
      </div>
      <p class="muted small">Le niveau pose l'XP à son début, sans payer ses paliers. ${h(PRISMES.nom)} : la monnaie de
        l'événement en cours, ou du dernier.</p>
      <button class="btn" data-lab="monnaies">Appliquer</button>
    </section>

    <section class="panel">
      <h2>Cosmétiques</h2>
      <p class="muted small">Les ${nCosm} cadres, titres, tapis et sleeves du jeu, à porter depuis ton profil et tes réglages
        de combat.</p>
      <button class="btn ghost" data-lab="cosmetiques">Tout débloquer</button>
    </section>

    <section class="panel">
      <h2>Repartir de zéro</h2>
      <p class="muted small">Comme un nouveau joueur : plus de cartes, de ressources, de quêtes, de combats, d'historique, et
        une Section à choisir. Ton compte, ton pseudo, tes amis et tes droits restent.</p>
      <button class="btn ghost labdanger" data-lab="raz">Repartir de zéro…</button>
    </section>`;
}

const labChamp = (k, nom, v, min = 0) => `<label class="field"><span>${h(nom)}</span>
  <input type="number" inputmode="numeric" min="${min}" step="1" data-labres="${k}" value="${Math.max(min, +v || 0)}"></label>`;

/* Une action sur son compte : le serveur rend me(), ou l'état du Labo. */
async function labMoiFaire(fn, args, msg) {
  occupe(true);
  try {
    const r = await Backend.labo(fn, args);
    if (fn === 'labo_sauver') labEtat = r;
    else { Backend.apply(r); labEtatCharge = false; }
    toast(msg);
    SFX.jouer('gagne');
  } catch (e) {
    if (labManque(e)) labEtat = { manque: true };
    toast(e.message || 'Le serveur a refusé.');
    SFX.jouer('erreur');
  } finally {
    occupe(false);
    render();
  }
}

function labConfirmer(titre, texte, bouton, fn) {
  openSheet({ title: titre, body: `<p>${texte}</p>`,
    actions: [{ label: bouton, primary: true, fn: () => { closeSheet(); fn(); } }, { label: 'Annuler', fn: closeSheet }] });
}

/* ======================================================= Combats */
function vLabCombats() {
  const cb = save.combat || {}, camp = cb.campagne || {}, jour = cb.jour || {};
  const mz = Object.keys(save.maitrises || {}).length;
  const sec = cb.section;
  const nomSec = s => (SECTIONS[s] || {}).nom || s;
  const court = s => (SECTIONS[s] || {}).court || s;
  const niv = niveauDe(cb.xp || 0).niveau;
  return `<p class="labalerte doux">Tes combats, pour de vrai, sans rien verser : finir la campagne ne donne pas la Promo de
      l'autre Section, les maîtrises ne coûtent rien.</p>
    <section class="panel">
      <h2>Ma Section</h2>
      <p class="muted small">${sec ? `Ta Section : ${h(nomSec(sec))}.` : 'Aucune : l\'onglet Combats te la fera choisir.'} En changer
        donne aussi sa Promo, si tu ne l'as pas.</p>
      <div class="labchoix" role="group" aria-label="Section">
        ${['toxique', 'deter'].map(s => `<button data-lab="section" data-v="${s}" class="${sec === s ? 'on' : ''}">${h(court(s))}</button>`).join('')}
        <button data-lab="section" data-v="" class="${sec ? '' : 'on'}">Aucune</button>
      </div>
    </section>

    <section class="panel">
      <h2>Mes combats</h2>
      <div class="labfacts">
        ${fait('Campagne', camp.finie ? 'finie' : `${(camp.faits || []).length} sur 20`)}
        ${fait('Victoires payées du jour', `${jour.recompensees || 0} sur ${jour.plafond || PVE_PLAFOND}`)}
        ${fait('Cartes maîtrisées', fmtN(mz))}
        ${fait('Niveau', `${niv} · ${fmtN(cb.xp || 0)} XP`)}
      </div>
      <div class="labgrid" style="margin-top:10px">
        <button class="labbtn" data-lab="combats" data-a="campagne" data-v="finie"><b>Campagne gagnée</b><span>les vingt combats, sans les récompenses</span></button>
        <button class="labbtn" data-lab="combats" data-a="campagne" data-v="raz"><b>Campagne à zéro</b><span>du premier combat</span></button>
        <button class="labbtn" data-lab="combats" data-a="jour"><b>Rejouer aujourd'hui</b><span>victoires payées, Raid, Épreuve du jour</span></button>
        <button class="labbtn" data-lab="combats" data-a="maitrises" data-v="max"><b>Tout maîtriser</b><span>tes cartes au niveau 5, gratuitement</span></button>
        <button class="labbtn labdanger" data-lab="combats" data-a="maitrises" data-v="raz"><b>Maîtrises à zéro</b><span>ce qu'elles ont coûté n'est pas rendu</span></button>
      </div>
    </section>

    <section class="panel">
      <h2>Ce que le jeu cache</h2>
      <p class="muted small">En lecture seule : rien ne se joue ni ne s'enregistre.</p>
      <div class="labgrid">
        <button class="labbtn" data-act="t-v3-camp" data-v="toxique"><b>Campagne Toxique</b><span>dévoilée, actes compris</span></button>
        <button class="labbtn" data-act="t-v3-camp" data-v="deter"><b>Campagne Déter</b><span>dévoilée, actes compris</span></button>
        <button class="labbtn" data-act="t-v3-recompenses"><b>Les récompenses</b><span>campagne, Arcade, niveaux, Raid, Pass</span></button>
        <button class="labbtn" data-act="t-v3-fin"><b>Fin de combat</b><span>victoire qui passe deux niveaux</span></button>
        <button class="labbtn" data-act="t-v3-niveau"><b>Fiche du niveau</b><span>XP et paliers</span></button>
        <button class="labbtn" data-act="t-v3-bon-deck"><b>Bilan d'un deck</b><span>le Starter Toxique</span></button>
      </div>
    </section>`;
}

/* ======================================================= Joueurs (réel) */
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

/* ======================================================= Aperçus (local) */
/* Rien n'est envoyé : la mise en scène, la fenêtre, la page, telles que les
   verra un joueur. « Revenir à l'état réel » efface tout aperçu. */
/* ---------- La maîtrise, en aperçu (version 3.0.11) ----------
   Les cinq finitions sur une carte au choix, la montée d'un niveau, et ce
   qu'une carte maîtrisée fait en combat — un Joueur posé, un Moment ou un
   Coach joué, un Objet lié —, sur un petit plateau qui reprend celui de
   l'arène. Rien n'est envoyé ni enregistré : le niveau de ses cartes, en
   vrai, se monte dans leur fiche, ou « Tout maîtriser » (Combats). */
const LAB_MZ_TYPES = [['joueur', 'Joueur', 'c012'], ['objet', 'Objet', 'c122'], ['moment', 'Moment', 'c110'], ['coach', 'Coach', 'c026']];
let labMz = { type: 'joueur', id: 'c012', n: 3 };
const labMzCarte = () => byId[labMz.id] || byId.c012;
/* Une carte comme l'arène la dessine (htmlCarte, js/combat/table.js), avec
   sa maîtrise. */
function labMzArene(c, n) {
  const mc = tcol(carteMaitrise(c));
  return `<div class="ar-c${n ? ` mz mz-${n}` : ''}"${n ? ` style="--mc:${mc}"` : ''}><img src="${h(c.img)}" alt="" draggable="false">${n ? mzDedans(n) : ''}</div>`;
}
function vLabMaitrise() {
  const c = labMzCarte();
  const n = labMz.n;
  const genre = { joueur: 'Le Joueur posé', objet: 'L\'Objet lié à un Joueur', moment: 'Le Moment joué', coach: 'Le Coach joué' }[labMz.type];
  const sur = byId.c012;
  const plateau = labMz.type === 'joueur'
    ? `<div class="lab-mz-place"><div class="ar-j${n ? ` mz-j mz-${n}` : ''}" style="--mc:${tcol(carteMaitrise(c))}">${n ? mzAutourDe(n) : ''}${labMzArene(c, n)}</div></div>`
    : labMz.type === 'objet'
      ? `<div class="lab-mz-place"><div class="ar-j">${labMzArene(sur, 0)}<span class="ar-objs"></span></div></div>`
      : '';
  return `<section class="panel lab-mz">
    <h2>La maîtrise</h2>
    <p class="muted small">Les cinq finitions, la montée d'un niveau, et ce qu'une carte maîtrisée fait en combat — rien n'est enregistré.
      En vrai, le niveau se monte dans la fiche d'une carte (Collection › une carte › Maîtrise).</p>
    <div class="segbar lab-mz-types">${LAB_MZ_TYPES.map(([k, nom]) => `<button data-lab="mz-type" data-v="${k}" class="${labMz.type === k ? 'on' : ''}">${nom}</button>`).join('')}</div>
    <div class="lab-mz-scene">
      <div class="lab-mz-carte" id="labmz">${renderCard(c, { m: n })}</div>
      <div class="lab-mz-cote">
        <div class="labjours lab-mz-niv" role="group" aria-label="Niveau">${[0, 1, 2, 3, 4, 5].map(k => `<button data-lab="mz-niveau" data-n="${k}" class="${n === k ? 'on' : ''}">${k ? CHIFFRES_ROMAINS[k] : '0'}</button>`).join('')}</div>
        <p class="lab-mz-nom">${n ? `${insigneMaitrise(n)} <b>${MAITRISE.noms[n - 1]}</b>` : '<b>Sans maîtrise</b>'}</p>
        <p class="muted small">${n ? h(MAITRISE.dit[n - 1]) : 'La carte telle qu\'elle est imprimée.'}</p>
        <p class="muted small">${h(c.nom)} · ${h((COLORS[carteMaitrise(c).col] || COLORS.neutre).nom)} <button class="linkbtn" data-lab="mz-carte">Une autre carte</button></p>
      </div>
    </div>
    <div class="row">
      <button class="btn" data-lab="mz-monte" ${n ? '' : 'disabled'}>Montée au niveau ${n ? CHIFFRES_ROMAINS[n] : '…'}</button>
      <button class="btn ghost" data-lab="mz-fiche">Sa fiche, à ce niveau</button>
    </div>
    <h3 class="labsous">En combat · ${genre}</h3>
    <div class="lab-mz-plateau ar-scene" id="labmzp">${plateau}</div>
    <div class="row"><button class="btn ghost" data-lab="mz-combat" ${n ? '' : 'disabled'}>Jouer ${labMz.type === 'joueur' ? 'son entrée' : labMz.type === 'objet' ? 'la liaison' : 'la carte'}</button></div>
    <p class="muted small">En combat, seules tes cartes montrent leur maîtrise. I et II : un trait de lumière ; III : un anneau ; IV : un éclat ; V : une onde de choc, et le plateau tremble.</p>
  </section>`;
}

/* La mise en scène d'une carte jouée (Moment, Coach) ou liée (Objet), sur
   le petit plateau : la carte arrive au centre, puis sa maîtrise se joue. */
async function labMzJouer() {
  const P = $('#labmzp');
  const c = labMzCarte(), n = labMz.n, mc = tcol(carteMaitrise(c));
  if (!P || !n) return;
  const secousse = f => P.animate([{ transform: 'none' }, { transform: `translate(${-f}px,${f / 2}px)` }, { transform: `translate(${f}px,${-f / 2}px)` }, { transform: 'none' }], { duration: 320 });
  if (labMz.type === 'joueur') {
    const x = P.querySelector('.ar-j');
    if (x) x.animate([{ transform: 'translateY(-30px) scale(1.15)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,.7,.3,1)' });
    SFX.jouer('carte');
    await new Promise(ok => setTimeout(ok, 380));
    return mzEffetCombat(x, n, mc, { scene: P, secousse });
  }
  const z = document.createElement('div');
  z.className = 'lab-mz-montre';
  z.innerHTML = labMzArene(c, n);
  P.appendChild(z);
  const carteEl = z.querySelector('.ar-c');
  carteEl.animate([{ transform: 'translateY(60px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,.7,.3,1)' });
  SFX.jouer('woosh');
  await new Promise(ok => setTimeout(ok, 400));
  if (labMz.type !== 'objet') {
    await mzEffetCombat(carteEl, n, mc, { scene: P, secousse });
    await new Promise(ok => setTimeout(ok, 900));
    z.remove();
    return;
  }
  /* L'Objet file sur le Joueur, qui reçoit sa maîtrise ; son médaillon
     prend l'anneau. */
  await new Promise(ok => setTimeout(ok, 500));
  const j = P.querySelector('.ar-j');
  const r0 = carteEl.getBoundingClientRect(), r1 = j.getBoundingClientRect();
  await carteEl.animate([{ transform: 'none' }, { transform: `translate(${r1.left + r1.width / 2 - r0.left - r0.width / 2}px,${r1.top + r1.height / 2 - r0.top - r0.height / 2}px) scale(.3)`, opacity: .4 }],
    { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).finished.catch(() => {});
  z.remove();
  const objs = j.querySelector('.ar-objs');
  if (objs) objs.innerHTML = `<i class="ar-obj${n >= 2 ? ` mzo mzo-${n}` : ''}" style="background-image:url('${h(c.img)}');--mc:${mc}"></i>`;
  return mzEffetCombat(j, n, mc, { scene: P, secousse });
}

function vLabApercus() {
  const has = r => cards.some(c => c.rar === r && c.cat !== 'essence');
  return `${vLabMaitrise()}

  <section class="panel">
    <h2>Ouvertures</h2>
    <p class="muted small">Tirées dans ce navigateur : elles ne consomment rien et n'ajoutent rien. Elles
      règlent la mise en scène, pas les probabilités réelles.</p>
    <div class="labgrid">
      <button class="labbtn" data-act="t-open"><b>Booster normal</b><span>Tirage réel</span></button>
      <button class="labbtn tR" data-act="t-R" ${has('R') ? '' : 'disabled'}><b>Rare</b><span>en dernière carte</span></button>
      <button class="labbtn tE" data-act="t-E" ${has('E') ? '' : 'disabled'}><b>Épique</b><span>en dernière carte</span></button>
      <button class="labbtn tL" data-act="t-L" ${has('L') ? '' : 'disabled'}><b>Légendaire</b><span>en dernière carte</span></button>
      <button class="labbtn tL" data-act="t-S" ${secretes.length ? '' : 'disabled'}><b>Secrète</b><span>en dernière carte</span></button>
      <button class="labbtn tBR" data-act="t-BR" ${brillantes.length ? '' : 'disabled'}><b>Essence Brillante</b><span>1 Essence sur ${FOIL_ODDS} en vrai</span></button>
      <button class="labbtn tUN" data-act="t-UN" ${uniques.length ? '' : 'disabled'}><b>Carte unique</b><span>à la place de la dernière carte</span></button>
      <button class="labbtn tREV" data-act="t-REV" ${reverses.length ? '' : 'disabled'}><b>Reverse Rare</b><span>en 5ᵉ carte, 15 % en vrai</span></button>
      <button class="labbtn tG" data-act="t-god"><b>Godpack</b><span>1 sur 2 000 en vrai</span></button>
    </div>
    <div class="row" style="margin-top:9px"><button class="btn ghost" data-act="t-partage">Image de partage d'un booster</button></div>
  </section>

  <section class="panel">
    <h2>Le Choc des Sections</h2>
    <p class="muted small">Le récap avec des chiffres inventés : rien n'est enregistré.</p>
    <div class="labgrid">
      <button class="labbtn" data-act="t-v3-nouveautes"><b>Nouveautés 3.0</b><span>la fenêtre de la mise à jour</span></button>
      <button class="labbtn" data-act="t-v3-recap"><b>L'onglet récap</b><span>après l'événement</span></button>
      <button class="labbtn" data-act="t-v3-recap-pop"><b>La fenêtre de fin</b><span>une fois par joueur</span></button>
      <button class="labbtn" data-act="t-v3-recap-ban"><b>Le bandeau</b><span>sur l'écran Boosters</span></button>
    </div>
  </section>

  <section class="panel">
    <h2>Fenêtres</h2>
    <div class="labgrid">
      <button class="labbtn" data-act="t-v2-invitation"><b>Invitation</b><span>un code acheté en boutique</span></button>
      <button class="labbtn" data-act="t-cadeau"><b>Cadeau reçu</b><span>le paquet à ouvrir</span></button>
      <button class="labbtn" data-lab="maint-voir"><b>Écran de maintenance</b><span>son message en cours, ou celui de la mise à jour</span></button>
    </div>
  </section>

  <section class="panel">
    <h2>Cartes Promo</h2>
    <p class="muted small">L'obtention en entier, sans l'écriture dans la collection.</p>
    <div class="labgrid">
      ${promos.map(p => `<button class="labbtn tPR" data-promo="${h(p.id)}"><b>${h(p.code)}</b><span>${h(p.nom)}</span></button>`).join('')}
    </div>
    ${promos.length > 1 ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-act="t-promo-file">Les enchaîner toutes</button></div>' : ''}
  </section>

  <section class="panel">
    <h2>Notifications</h2>
    <p class="muted small">Les bandeaux du haut de l'écran, pour vérifier qu'ils ne recouvrent rien.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-quete">Quête accomplie</button>
      <button class="btn ghost" data-act="t-quetes">Trois quêtes d'un coup</button>
      <button class="btn ghost" data-act="t-ping">Ping de la boîte</button>
      <button class="btn ghost" data-act="t-toast">Message court</button>
    </div>
  </section>`;
}

/* ======================================================= Les gestes */
function labAction(a, el) {
  const d = el.dataset, n = d.n == null ? null : +d.n;
  switch (a) {
    case 'recharger': labEtat = null; labEtatCharge = false; return render();
    case 'demo-tout': return labDemoTout();
    case 'mz-type': {
      const t = LAB_MZ_TYPES.find(x => x[0] === d.v) || LAB_MZ_TYPES[0];
      labMz.type = t[0]; labMz.id = t[2];
      return render();
    }
    case 'mz-niveau': labMz.n = n; return render();
    case 'mz-carte': {
      const cat = labMz.type;
      const l = cards.filter(c => c.cat === cat && c.id !== labMz.id && maitrisable(c));
      if (l.length) labMz.id = l[Math.floor(Math.random() * l.length)].id;
      return render();
    }
    case 'mz-monte': {
      const c = labMzCarte();
      const k = carteMaitrise(c);
      return jouerMonteeMaitrise($('#labmz'), labMz.n, tcol(k), { carte: c, copies: (MAITRISE.copies[k.rar] || [])[labMz.n - 1] || 0 });
    }
    case 'mz-fiche': {
      const c = labMzCarte();
      openViewer(c);
      if (VW) {
        VW.apercu = labMz.n;
        const el = $('#vwc');
        if (el) { el.innerHTML = vCarteVw(c); VW.reflets = refletsVw(); }
        const pg = $('#viewer .vw-page[data-p="maitrise"]');
        if (pg) { pg.innerHTML = vMaitriseFiche(c); hauteurPagesVw(); }
      }
      return;
    }
    case 'mz-combat': return labMzJouer();
    case 'choc': {
      const etat = d.etat;
      const titres = { avant: 'Avant le Choc ?', jour: `Au jour ${n} du Choc ?`, recap: 'Au récap du Choc ?', fini: 'Finir le Choc ?' };
      return labPourTous(titres[etat], LAB_EFFETS[etat](n), () =>
        labServeurFaire('labo_evenement', { p_etat: etat, p_n: n }, 'Le Choc a changé d\'état.'));
    }
    case 'decaler':
      return labPourTous(n > 0 ? 'Avancer d\'un jour ?' : 'Reculer d\'un jour ?',
        n > 0 ? 'Le Choc commence un jour plus tôt : un jour de plus s\'est écoulé pour tout le monde.'
          : 'Le Choc commence un jour plus tard : un jour de moins s\'est écoulé.',
        () => labServeurFaire('labo_decaler', { p_heures: n }, n > 0 ? 'Un jour de plus.' : 'Un jour de moins.'));
    case 'choc-raz':
      return labEffacer('Remettre le Choc à zéro ?', `L'Épreuve du jour, les ${h(MONNAIES_EV.choc.nom)}, le Pass et les quêtes de
        l'événement de <b>tous les joueurs</b> sont effacés. Ce qui a déjà été versé (Éclats, boosters, cosmétiques) reste :
        on ne reprend rien. Le Raid a sa propre remise à zéro.`, 'labo_evenement_raz', {}, 'Le Choc est remis à zéro.');
    case 'raid':
      return labPourTous(n > 6 ? 'Les six phases abattues ?' : `La phase ${n} du Raid ?`,
        n > 6 ? 'Les dégâts du serveur passent le dernier seuil : les six coffres communs s\'ouvrent, l\'Infini commence.'
          : n === 1 ? 'Les dégâts du serveur reviennent à zéro : aucune phase n\'est abattue.'
          : `Les dégâts du serveur sont posés au seuil de la phase ${n - 1} : ${n - 1} coffre${n > 2 ? 's' : ''} commun${n > 2 ? 's' : ''} ouvert${n > 2 ? 's' : ''}.`,
        () => labServeurFaire('labo_raid', { p_phase: n }, n > 6 ? 'Le Raid est à l\'Infini.' : `Le Raid est à la phase ${n}.`));
    case 'echelle':
      return labPourTous('Changer l\'échelle des seuils ?', `Les seuils des six phases sont multipliés par ${String(n).replace('.', ',')}.`,
        () => labServeurFaire('labo_raid_echelle', { p_echelle: n }, 'Échelle posée.'));
    case 'raid-raz':
      return labEffacer('Remettre le raid en cours à zéro ?', `Les dégâts, les phases, la part de <b>chaque joueur</b> et les coffres
        ouverts du raid en cours sont effacés, avec les tentatives du jour. Ce qui a été versé reste.`,
        'labo_raid_raz', {}, 'Le raid en cours est remis à zéro.');
    case 'reverses':
      return labPourTous(n ? 'Ouvrir les Reverses ?' : 'Fermer les Reverses ?',
        n ? 'Leur recyclage et leur fabrication s\'ouvrent tout de suite, pour tout le monde.'
          : 'Leur recyclage et leur fabrication se ferment, sans date de réouverture.',
        () => labServeurFaire('labo_reverses', { p_ouvertes: !!n }, n ? 'Reverses ouvertes.' : 'Reverses fermées.'));
    case 'maint-on': case 'maint-maj': {
      const v = labMaintForm();
      if (!v) return;
      const faire = () => labServeurFaire('labo_maintenance', { p_actif: true, p_message: v.message, p_fin: v.fin },
        a === 'maint-on' ? 'Le jeu est en maintenance.' : 'Maintenance mise à jour.');
      return a === 'maint-on' ? labPourTous('Mettre le jeu en maintenance ?', 'Les joueurs voient l\'écran de maintenance et ne peuvent plus rien faire tant que tu ne la lèves pas. Les administrateurs jouent.', faire) : faire();
    }
    case 'maint-off':
      return labPourTous('Lever la maintenance ?', 'Les joueurs retrouvent le jeu : leur page se recharge d\'elle-même dans la minute.',
        () => labServeurFaire('labo_maintenance', { p_actif: false }, 'Maintenance levée.'));
    case 'maint-voir': {
      const v = labMaintForm();
      return v && apercuMaintenance(v);
    }
    case 'sauver': return labMoiFaire('labo_sauver', {}, 'Ton compte est mis de côté.');
    case 'restaurer':
      return labConfirmer('Restaurer ton compte ?', 'Il redevient tel qu\'il était à la sauvegarde : ce qui a changé depuis est perdu.',
        'Restaurer', () => labMoiFaire('labo_restaurer', {}, 'Compte restauré.'));
    case 'cartes': {
      const q = d.q;
      const msg = { master: 'Master set ajouté.', classiques: `Les ${cards.length} ajoutées.`, combat: 'Les cartes de combat ajoutées.', maitrise: 'Les exemplaires pour la maîtrise ajoutés.', vider: 'Collection vidée.' }[q];
      const faire = () => labMoiFaire('labo_cartes', { p_quoi: q }, msg);
      return q === 'vider' ? labConfirmer('Vider ta collection ?', 'Toutes tes cartes partent, et tes demandes d\'échange en attente sont annulées. Tes decks restent, mais ne se jouent plus.', 'Vider', faire) : faire();
    }
    case 'monnaies': {
      const v = {};
      document.querySelectorAll('[data-labres]').forEach(i => { if (i.value !== '') v[i.dataset.labres] = Math.max(0, Math.round(+i.value) || 0); });
      /* Sans événement, pas de monnaie d'événement ; un niveau qui ne change
         pas ne remet pas l'XP au début du niveau. */
      if ((save.prismes || 0) === v.prismes) delete v.prismes;
      if (niveauDe((save.combat || {}).xp || 0).niveau === v.niveau) delete v.niveau;
      return labMoiFaire('labo_monnaies', { p_valeurs: v }, 'Ressources posées.');
    }
    case 'cosmetiques':
      return labMoiFaire('labo_cosmetiques', { p_ids: Object.keys(FRAMES).filter(k => k.startsWith('f_') && !horsDemo(k)).concat(Object.keys(TITRES).filter(k => !horsDemo(k)),
        Object.keys(TAPIS).filter(k => k !== 't_base'), Object.keys(SLEEVES).filter(k => k !== 's_base')) },
        'Tous les cosmétiques sont à toi.');
    case 'section':
      return labMoiFaire('labo_combats_moi', { p_action: 'section', p_valeur: d.v || null },
        d.v ? `Ta Section : ${(SECTIONS[d.v] || {}).nom || d.v}.` : 'Plus de Section : l\'onglet Combats te la fera choisir.');
    case 'combats': {
      const msgs = { 'campagne:finie': 'Campagne gagnée.', 'campagne:raz': 'Campagne remise à zéro.', 'jour:': 'Tes essais du jour sont effacés.',
        'maitrises:max': 'Tout est maîtrisé.', 'maitrises:raz': 'Maîtrises remises à zéro.' };
      const faire = () => labMoiFaire('labo_combats_moi', { p_action: d.a, p_valeur: d.v || null }, msgs[d.a + ':' + (d.v || '')]);
      return d.a === 'maitrises' && d.v === 'raz' ? labConfirmer('Remettre tes maîtrises à zéro ?', 'Les Fragments et les exemplaires qu\'elles ont coûtés ne sont pas rendus.', 'Remettre à zéro', faire) : faire();
    }
    case 'raz':
      return labConfirmer('Repartir de zéro ?', `Plus de cartes, de ressources, de quêtes, de combats ni d'historique.${labEtat && labEtat.sauvegarde
        ? ' Ta sauvegarde permet de revenir en arrière.' : ' <b>Rien n\'est mis de côté</b> : pense à « Mettre mon compte de côté » d\'abord.'}`,
        'Repartir de zéro', () => labMoiFaire('labo_raz_moi', {}, 'Compte remis à zéro.'));
  }
}

async function labEtatReel() {
  if (chRecapApercu) { chRecapApercu = null; chRecap = null; }
  try { await Backend.pull(); } catch (e) { /* le prochain rafraîchissement s'en chargera */ }
  render();
  toast('État du serveur rétabli.');
}

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
/* Plusieurs quêtes finies ensemble (un combat) : une seule carte. */
function testQuetes() {
  notifQuetes([
    { id: 't1', titre: 'Sur le terrain', reward: 20, progress: 1, goal: 1, scope: 'daily' },
    { id: 't2', titre: 'Première victoire', reward: 40, progress: 1, goal: 1, scope: 'daily' },
    { id: 't3', titre: 'Paratonnerre', reward: 15, monnaie: 'prismes', progress: 1, goal: 1, scope: 'ev_jour' }
  ]);
}

/* ---------- Offrir un cadeau ---------- */
/* Des Éclats, des boosters, des Fragments, une carte, un mot : le joueur le
   trouve à sa visite suivante, dans un paquet à ouvrir (js/cadeaux.js). Le
   serveur vérifie que c'est bien un administrateur qui offre
   (supabase/installation/18_cadeaux.sql). La liste aide à doser : depuis quand chacun
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
        ${['PR', 'S', 'L', 'E', 'R', 'BR', 'PC', 'C', 'ES'].map(r => {
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
        (en bas de <code>supabase/installation/18_cadeaux.sql</code>).</p>`,
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
  return `<p class="muted small">Rejouer un combat de campagne gagné : ${RECOMPENSE_REJOUER.eclats} Éclats. Au plus ${PVE_PLAFOND} victoires récompensées par jour en solo.</p>
    <h3>Campagne (la même pour les deux Sections)</h3>
    ${tableau(['n°', 'Acte', 'Difficulté', 'Règle', 'Première victoire'], camp)}
    <p class="muted small">Au bout : la Promo de l'autre Section, le titre « Champion des Sections », son Starter Deck prêté.</p>
    <h3>Arcade</h3>
    ${tableau(['Niveau', 'Nom', 'Victoire'], DIFFICULTES.map(d => [`${d.niveau}★`, h(d.nom), `${d.eclats} Éclats`]))}
    <h3>Niveaux de combattant</h3>
    <p class="muted small">Chaque niveau : ${NIVEAUX.eclats} Éclats. Les paliers jusqu'au 60 :</p>
    ${tableau(['Niveau', 'XP pour y monter', 'En plus'], niveaux)}
    <h3>Le Raid · ${R.bosses.map(b => h(b.nom)).join(', puis ')}</h3>
    ${tableau(['Phase', 'Seuil', 'Combat', 'Coffre commun'], R.phases.map((ph, i) => [i + 1, `${fmtN(ph.seuil)} × échelle`,
      `difficulté ${ph.ia} ★ · ${ph.pv} PV${ph.ess ? ` · +${ph.ess} Ess.` : ''}`, h(ph.commun.titre)]))}
    ${tableau(['Palier perso', 'Dégâts', 'Coffre'], R.perso.map((x, i) => [i + 1, fmtN(x.seuil), h(x.titre)]))}
    ${tableau(['Infini', 'Combat'], [1, 2, 3, 4, 6, 9].map(n => { const c = R.infini(n); return [`palier ${n}`, `difficulté ${c.ia} ★ · boss ${c.pvBoss} PV · +${c.ess} Ess. · toi ${c.pvMoi} PV`]; }))}
    <p class="muted small">Pendant le Choc : ${R.parDegat} Étincelles par dégât, +${R.victoire} si le boss tombe. Sinon : ${R.parDegatEclats} Éclats par dégât, +${R.victoireEclats}. ${R.tentatives} tentatives par jour ; des raids de ${R.saison.jours} jours, comptés depuis le premier jour du Choc, aux boss à tour de rôle.</p>
    ${tableau(['Boss', 'Raids', 'Son deck', 'En combat'], R.bosses.map((b, i) => [h(b.nom), i ? 'pairs (2, 4…)' : 'impairs (1, 3…)', h(b.dit),
      `${b.ajuste ? `${-b.ajuste.pv} PV et ${-b.ajuste.ess} Essence d'avance de moins que la phase · ` : 'les chiffres de la phase · '}cadre ${h((FRAMES[b.cadre] || {}).nom || b.cadre)} · tapis ${h(((typeof TAPIS !== 'undefined' && TAPIS[b.tapis]) || (typeof TAPIS_BOSS !== 'undefined' && TAPIS_BOSS[b.tapis]) || {}).nom || b.tapis)}`]))}
    <p class="muted small">L'échelle des seuils se règle dans le Labo › Serveur. Les deux boss ont les mêmes phases et les mêmes coffres ; seuls leur deck, leur illustration, leur cadre et leur tapis changent.</p>
    <h3>Le Pass du Choc</h3>
    ${ev ? tableau(['Palier', 'Étincelles', 'Récompense'], chEv.piste.map(x => [x.palier, fmtN(x.seuil), h(x.titre || x.type || '')])) : '<p class="muted small">Ouvre une fois l\'onglet de l\'événement (pendant le Choc) pour charger le Pass, puis reviens ici.</p>'}`;
}
