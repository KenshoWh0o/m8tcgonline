/* Onglet Labo (version 2.5) : régler le jeu et son propre compte, et voir ce
   qu'on ne peut pas provoquer. Réservé aux administrateurs — il n'apparaît
   que si le serveur a marqué le profil is_admin (supabase/05_admin.sql). Le
   cacher côté navigateur ne suffirait pas : chaque fonction du serveur
   vérifie elle-même le droit (labo_garde, supabase/22d_admin.sql).

   Quatre sous-onglets :
     · Serveur    — le calendrier en vigueur, et ses états, pour tout le monde ;
     · Mon compte — sa collection, ses monnaies, ses cosmétiques, son
                    Échauffement, et une sauvegarde pour revenir en arrière ;
     · Joueurs    — l'annonce à tous et les cadeaux ;
     · Aperçus    — les mises en scène et les fenêtres, sans rien envoyer.
   Sur le vrai site, une action « pour tout le monde » se confirme ; dans la
   démo (le prébuild), le faux serveur joue les mêmes gestes sans rien
   demander. */
"use strict";

let labVue = 'serveur';
const LAB_VUES = [['serveur', 'Serveur'], ['compte', 'Mon compte'], ['joueurs', 'Joueurs'], ['apercus', 'Aperçus']];

/* La démo (prébuild, pré-prod) parle à un faux serveur : rien n'y est réel. */
const labDemo = () => typeof SUPABASE_URL === 'string' && SUPABASE_URL.includes('demo.invalid');

/* L'état du serveur (labo_etat) : chargé en arrivant, rechargé après chaque
   geste. `manque` : les fonctions de la 2.5 ne sont pas sur la base. */
let labEtat = null;
let labEtatCharge = false;

const labManque = e => /could not find the function|schema cache/i.test(String(e && e.message));

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
  if (Backend.mode !== 'cloud') {
    return `<div class="pagehead"><div><h1>Labo</h1></div></div>
      ${vide('Hors ligne', 'Le Labo parle au serveur : connecte-toi.')}`;
  }
  const corps = labVue === 'compte' ? vLabCompte() : labVue === 'joueurs' ? vLabJoueurs()
    : labVue === 'apercus' ? vLabApercus() : vLabServeur();
  return `<div class="pagehead"><div><h1>Labo</h1>
      <p>${labDemo() ? 'Démo : un faux serveur, rien n\'est réel. Tout s\'y règle sans risque.'
        : 'Le vrai serveur. Ce qui est marqué <b>pour tout le monde</b> change le jeu de chaque joueur.'}</p></div></div>
    <div class="segbar labvues">${LAB_VUES.map(([k, n]) => `<button data-labv="${k}" class="${labVue === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${apercuEnCours() ? `<p class="labalerte">Un aperçu est affiché : ce n'est pas l'état du serveur.
      <button class="linkbtn" data-act="t-ev-reel">Revenir à l'état réel</button></p>` : ''}
    ${corps}`;
}

const apercuEnCours = () => !!((typeof echData !== 'undefined' && echData && echData.apercu) || rfRecapApercu || echRecapApercu);

/* « dimanche 25 octobre à minuit · dans 2 j 3 h » */
const labQuand = iso => {
  if (!iso) return 'sans date';
  const t = srvTime(iso) - Date.now();
  return `${jourParis(iso)} · ${t > 0 ? 'dans ' + dureeCourte(t) : 'il y a ' + dureeCourte(-t)}`;
};

/* ======================================================= Serveur */
function vLabServeur() {
  if (!labEtatCharge) labCharger();
  if (!labEtat) return '<p class="muted boitecharge">Chargement de l\'état du serveur…</p>';
  if (labEtat.manque) return vLabManque();
  if (labEtat.erreur) return `<section class="panel"><h2>Le serveur</h2><p class="muted">${h(labEtat.erreur)}</p>
    <button class="btn ghost" data-lab="recharger">Réessayer</button></section>`;
  return vLabFrise() + vLabEtats() + vLabAjuster() + vLabEchServeur() + vLabVigueur();
}

function vLabManque() {
  return `<section class="panel">
    <h2>Les fonctions du Labo manquent</h2>
    <p class="muted">La base n'a pas encore reçu la mise à jour de la 2.5 : colle <code>supabase/MAJ-2.5.sql</code>
      dans le SQL Editor de Supabase (elle se rejoue sans danger), puis recharge. En attendant, les onglets
      Joueurs et Aperçus marchent.</p>
    <button class="btn ghost" data-lab="recharger">Réessayer</button>
  </section>`;
}

/* Le calendrier, en frise : ce qui est passé, maintenant, ce qui vient. Un
   jalon qui n'est pas à sa date officielle le dit. */
function vLabFrise() {
  const E = labEtat, O = E.officiel || {}, s = E.saison || {}, rv = E.reverses || {};
  const ecart = (a, b) => a && b && Math.abs(Date.parse(a) - Date.parse(b)) > 60000;
  const jalons = [
    ['Fin de Reflets', E.reflets && E.reflets.fin, O.reflets_fin],
    ['Fin du récap de Reflets', E.reflets && E.reflets.recap_jusqua, O.recap_jusqua],
    ['Sortie de la 2.5', E.sortie, O.sortie_25],
    ['L\'Échauffement commence', s.debut, O.saison_debut],
    ['L\'Échauffement se termine, le défi du jour commence', s.fin, O.saison_fin],
    ['Fin du récap de L\'Échauffement', E.ech_recap, O.ech_recap],
    ['Les Reverses ouvrent', rv.des, O.reverses_des]
  ].filter(j => j[1]).sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]));
  const maintenant = Date.now();
  const sf = E.sans_fin || {};
  const etatEch = !s.debut ? 'pas de saison' : maintenant < srvTime(s.debut) ? 'à venir'
    : maintenant < srvTime(s.fin) ? `défi ${s.ouvert} sur 7`
    : `sans fin · ${ECH_NIVEAUX[sf.niveau] || '?'} (n° ${sf.ordre || '?'})`;
  const etatRev = rv.ouvertes ? (rv.manuel ? 'ouvertes à la main' : 'ouvertes') : rv.des ? 'fermées' : 'fermées, sans date';
  const sortie = !E.sortie || maintenant >= srvTime(E.sortie);
  const ligne = ([titre, iso, off]) => `<li class="labjalon ${srvTime(iso) <= maintenant ? 'passe' : 'avenir'}">
      <i aria-hidden="true"></i><span><b>${h(titre)}</b><small>${h(labQuand(iso))}</small>
      ${ecart(iso, off) ? `<em>officiel : ${h(jourParis(off))}</em>` : ''}</span></li>`;
  const avant = jalons.filter(j => srvTime(j[1]) <= maintenant), apres = jalons.filter(j => srvTime(j[1]) > maintenant);
  return `<section class="panel labserveur">
    <h2>Le serveur, maintenant</h2>
    <div class="labpuces">
      <span class="${sortie ? 'on' : ''}"><small>Version</small><b>${sortie ? '2.5 sortie' : 'avant la 2.5'}</b></span>
      <span class="${s.ouvert && maintenant < srvTime(s.fin) ? 'on' : ''}"><small>L'Échauffement</small><b>${h(etatEch)}</b></span>
      <span class="${rv.ouvertes ? 'on' : ''}"><small>Reverses</small><b>${h(etatRev)}</b></span>
    </div>
    <ol class="labfrise">
      ${avant.map(ligne).join('')}
      <li class="labjalon ici"><i aria-hidden="true"></i><span><b>Maintenant</b><small>${h(jourParis(new Date(Date.now() - Backend.skew).toISOString()))}</small></span></li>
      ${apres.map(ligne).join('')}
    </ol>
  </section>`;
}

/* Les états : tout le calendrier bouge d'un coup, et reste cohérent. */
function vLabEtats() {
  const s = labEtat.saison || {};
  const enSaison = s.debut && Date.now() >= srvTime(s.debut) && Date.now() < srvTime(s.fin);
  return `<section class="panel">
    <h2>Aller à un état <small class="labtag">pour tout le monde</small></h2>
    <p class="muted small">Reflets, son récap, la sortie de la 2.5, L'Échauffement et les Reverses bougent
      ensemble, et restent cohérents. Les joueurs le voient à leur prochain rafraîchissement.</p>
    <div class="labgrid">
      <button class="labbtn" data-lab="cal" data-etat="avant" data-n="2"><b>Avant la 2.5</b><span>le récap de Reflets ; la 2.5 sort dans 2 min</span></button>
      <button class="labbtn" data-lab="cal" data-etat="avant" data-n="60"><b>Avant la 2.5</b><span>la même chose, la 2.5 dans 1 h</span></button>
    </div>
    <h3 class="labsous">La 2.5 sortie : le défi du jour</h3>
    <div class="labjours">${[1, 2, 3, 4, 5, 6, 7].map(j => `<button data-lab="cal" data-etat="defi" data-n="${j}"
        class="${enSaison && s.ouvert === j ? 'on' : ''}" aria-label="Défi ${j} ouvert">${j}</button>`).join('')}</div>
    <div class="labgrid" style="margin-top:8px">
      <button class="labbtn" data-lab="cal" data-etat="rattrapage"><b>Rattrapage</b><span>les sept ouverts, deux jours avant la fin</span></button>
      <button class="labbtn" data-lab="cal" data-etat="fini"><b>Saison finie</b><span>depuis une heure : son récap, le défi du jour</span></button>
      <button class="labbtn" data-lab="cal" data-etat="sans_fin" data-n="4"><b>Mode sans fin</b><span>son quatrième jour, le récap fini</span></button>
    </div>
    <button class="btn labofficiel" data-lab="cal" data-etat="officiel">Revenir au calendrier officiel</button>
  </section>`;
}

function vLabAjuster() {
  const rv = labEtat.reverses || {};
  return `<section class="panel">
    <h2>Ajuster <small class="labtag">pour tout le monde</small></h2>
    <div class="labgrid">
      <button class="labbtn" data-lab="decaler" data-n="24"><b>Avancer d'un jour</b><span>un défi de plus s'ouvre</span></button>
      <button class="labbtn" data-lab="decaler" data-n="-24"><b>Reculer d'un jour</b><span>la saison repart d'un jour</span></button>
      <button class="labbtn" data-lab="reverses" data-n="1" ${rv.ouvertes ? 'disabled' : ''}><b>Ouvrir les Reverses</b><span>recyclage et fabrication, tout de suite</span></button>
      <button class="labbtn" data-lab="reverses" data-n="0" ${rv.ouvertes ? '' : 'disabled'}><b>Fermer les Reverses</b><span>sans date ; l'officiel la remet</span></button>
    </div>
  </section>`;
}

/* L'Échauffement côté serveur : la participation, les indices, la remise à zéro. */
function vLabEchServeur() {
  const E = labEtat.echauffement;
  if (!E) return '';
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
    ${labEtat.sans_fin ? `<p class="muted small" style="margin-top:8px">Le défi du jour (mode sans fin, après la saison) :
      n° ${labEtat.sans_fin.ordre}, ${h((byId[labEtat.sans_fin.adversaire] || {}).nom || labEtat.sans_fin.adversaire)}, ${h(labEtat.sans_fin.titre)}
      (${h(ECH_NIVEAUX[labEtat.sans_fin.niveau] || '')}) ; ${fmtN(labEtat.sans_fin.joueurs)} joueur${labEtat.sans_fin.joueurs > 1 ? 's' : ''}
      l'ont déjà tenté, ${fmtN(labEtat.sans_fin.gagnes)} l'ont gagné aujourd'hui.</p>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="btn ghost" data-act="t-ech-indices">Les indices</button>
      <button class="btn ghost labdanger" data-lab="ech-raz">Remettre à zéro…</button>
    </div>
  </section>`;
}

/* Ce qui est en vigueur : lu sur le serveur, réglé dans les fichiers SQL. */
function vLabVigueur() {
  const E = labEtat, ch = E.chasse || {};
  const etatCh = !ch.carte ? 'inconnue' : ch.trouvee ? `tirée${ch.gagnant ? ' par ' + ch.gagnant : ''}` : ch.active ? 'chasse ouverte' : 'chasse fermée';
  const r = E.recharge || {};
  return `<section class="panel">
    <h2>En vigueur</h2>
    <div class="labfacts">
      ${fait('Joueurs inscrits', fmtN(E.joueurs || 0))}
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
        <span class="tnum">+${fmtN(recValeurs()[x])}</span><span class="tnum">${fmtN(revCouts()[x])}</span>`).join('')}
    </div>
    <details class="labplus"><summary>Requêtes SQL, pour ce que le Labo ne fait pas</summary>
      <pre class="labsql">-- Un événement de recharge (ici : maintenant, pour 3 jours)
insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
  ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.',
   now(), now() + interval '3 days', 120);
-- L'arrêter avant l'heure
update public.evenements set fin = now() where fin > now() and code is null;

-- L'Échauffement : les meilleures notes, défi par défi
select p.pseudo, s.jour, s.etoiles, s.tours from public.ech_scores s
  join public.profiles p on p.id = s.user_id order by s.jour, s.etoiles desc;

-- Les valeurs d'équilibrage : cfg() dans supabase/01_schema.sql,
-- les quêtes et la boutique dans supabase/04_seed.sql.</pre>
    </details>
  </section>`;
}

const fait = (l, v) => `<div class="labfait"><span>${h(l)}</span><b>${h(String(v))}</b></div>`;

/* Ce que chaque état fait aux joueurs, dit avant de confirmer. */
const LAB_EFFETS = {
  avant: n => `Reflets est fini et son récap court ; la 2.5 sort dans ${n >= 60 ? n / 60 + ' h' : n + ' min'}. D'ici là, tout le monde voit le jeu « 2.1.3 », sans L'Échauffement, Reverses fermées.`,
  defi: n => `La 2.5 est sortie ; L'Échauffement est au défi ${n} (les ${n} premiers ouverts), les Reverses ouvertes.`,
  rattrapage: () => 'La 2.5 est sortie ; les sept défis sont ouverts, deux jours de rattrapage avant la fin.',
  fini: () => 'La saison de L\'Échauffement est terminée depuis une heure : trois jours de récap (bandeau de l\'écran Boosters, fenêtre de fin), et le défi du jour dans l\'onglet Combats.',
  sans_fin: n => `La saison de L'Échauffement est finie depuis ${n - 1} jour${n > 2 ? 's' : ''} : son récap aussi, le défi du jour en est à son ${n}ᵉ jour.`,
  officiel: () => 'Les dates de la 2.5 : récap jusqu\'au dimanche 25 octobre minuit, puis la 2.5, L\'Échauffement (jusqu\'au 4 novembre) et les Reverses.'
};

/* Une action pour tout le monde : sur le vrai site, on confirme d'abord. */
function labPourTous(titre, texte, fn) {
  if (labDemo()) return fn();
  openSheet({
    title: titre,
    body: `<p>${h(texte)}</p><p class="muted small">Pour tout le monde, tout de suite. « Revenir au calendrier
      officiel » remet les dates de la 2.5.</p>`,
    actions: [{ label: 'Confirmer', primary: true, fn: () => { closeSheet(); fn(); } },
              { label: 'Annuler', fn: closeSheet }]
  });
}

async function labServeurFaire(fn, args, msg) {
  occupe(true);
  try {
    const r = await Backend.labo(fn, args);
    labEtat = r && r.etat ? r.etat : r;
    /* Le jeu suit : me() (sortie, Reverses, récap) et L'Échauffement. */
    await Backend.pull().catch(() => {});
    if (typeof echData !== 'undefined' && echData && echData.apercu) echData = null;
    await chargerEch();
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

/* La remise à zéro de L'Échauffement : on écrit le mot, comme dans un SQL. */
function labEchRaz() {
  openSheet({
    title: 'Remettre L\'Échauffement à zéro ?',
    body: `<p>Les essais, les notes et les paliers de <b>tous les joueurs</b> sont effacés. Ce qui a déjà été
        versé (Éclats, boosters, titre) reste : on ne reprend rien.</p>
      <label class="field"><span>Écris EFFACER pour confirmer</span><input id="lab-raz" type="text" autocomplete="off"></label>`,
    actions: [{ label: 'Effacer', primary: true, fn: () => {
        const v = valeur('lab-raz');
        if (v !== 'EFFACER') return toast('Écris EFFACER, en capitales.');
        closeSheet();
        labServeurFaire('labo_ech_raz', { p_confirmation: v }, 'L\'Échauffement est remis à zéro.');
      } },
      { label: 'Annuler', fn: closeSheet }]
  });
}

/* ======================================================= Mon compte */
function vLabCompte() {
  if (!labEtatCharge) labCharger();
  if (labEtat && labEtat.manque) return vLabManque();
  const sv = labEtat && labEtat.sauvegarde;
  return `<p class="labalerte doux">Ton compte, pour de vrai : ta collection, tes monnaies, ton classement. Mets-le de côté
      avant d'y toucher, et restaure-le après.</p>
    <section class="panel labsauve">
      <h2>Ma sauvegarde</h2>
      <p class="${sv ? '' : 'muted'}">${sv ? `Mise de côté ${h(jourParis(sv.le))}, avec ${fmtN(sv.cartes)} cartes différentes.`
        : 'Rien n\'est mis de côté.'}</p>
      <p class="muted small">La restauration remet ta collection, tes monnaies, tes cosmétiques, tes quêtes, ton
        Échauffement et ton historique tels qu'ils étaient. Tes amis, ta boîte et tes échanges n'en font pas partie.</p>
      <div class="row">
        <button class="btn${sv ? ' ghost' : ''}" data-lab="sauver">${sv ? 'Remettre de côté' : 'Mettre mon compte de côté'}</button>
        ${sv ? '<button class="btn" data-lab="restaurer">Restaurer</button>' : ''}
      </div>
    </section>

    <section class="panel">
      <h2>Ma collection</h2>
      <div class="labgrid">
        <button class="labbtn tL" data-lab="cartes" data-q="master"><b>Master set</b><span>toutes les cartes, sauf la carte unique</span></button>
        <button class="labbtn tR" data-lab="cartes" data-q="classiques"><b>Les ${cards.length}</b><span>l'extension, sans les Reverses</span></button>
        <button class="labbtn tE" data-lab="cartes" data-q="joueurs"><b>Les Joueurs</b><span>tous ceux de L'Échauffement</span></button>
        <button class="labbtn labdanger" data-lab="cartes" data-q="vider"><b>Vider</b><span>plus aucune carte</span></button>
      </div>
      <p class="muted small" style="margin-top:8px">Une carte que tu as déjà garde ses exemplaires. Le classement te
        verra avec ce que tu as.</p>
    </section>

    <section class="panel">
      <h2>Mes ressources</h2>
      <div class="labres">
        ${labChamp('eclats', MONNAIE.nom, save.shards)}
        ${labChamp('fragments', FRAGMENTS.nom, save.fragments)}
        ${labChamp('boosters', 'Boosters en plus', save.bonus)}
        ${labChamp('reserve', 'Réserve', save.tickets)}
        ${labChamp('prismes', PRISMES.nom, save.prismes)}
      </div>
      <button class="btn" data-lab="monnaies">Appliquer</button>
    </section>

    <section class="panel">
      <h2>Cosmétiques</h2>
      <p class="muted small">Les ${Object.keys(FRAMES).filter(k => k !== 'default').length} cadres et les
        ${Object.keys(TITRES).length} titres du jeu, à porter depuis ton profil.</p>
      <button class="btn ghost" data-lab="cosmetiques">Tous les cadres et titres</button>
    </section>

    ${vLabMonEch()}

    <section class="panel">
      <h2>Repartir de zéro</h2>
      <p class="muted small">Comme un nouveau joueur : plus de cartes, de monnaies, de quêtes, d'historique. Ton
        compte, ton pseudo, tes amis et tes droits restent.</p>
      <button class="btn ghost labdanger" data-lab="raz">Repartir de zéro…</button>
    </section>`;
}

const labChamp = (k, nom, v) => `<label class="field"><span>${h(nom)}</span>
  <input type="number" inputmode="numeric" min="0" step="1" data-labres="${k}" value="${Math.max(0, +v || 0)}"></label>`;

/* Ses étoiles, défi par défi : posées sans rien verser. */
function vLabMonEch() {
  const E = labEtat && labEtat.echauffement;
  if (!E) return '';
  const note = j => { const d = echData && !echData.apercu && (echData.defis || []).find(x => x.jour === j); return d ? d.etoiles || 0 : null; };
  return `<section class="panel">
    <h2>Mon Échauffement</h2>
    <p class="muted small">Tes étoiles à chaque défi, sans rien verser : de quoi voir les indices et les
      récompenses. Un défi pas encore ouvert garde sa note jusqu'à son ouverture. « Rejouer aujourd'hui »
      efface tes essais du jour (pas tes notes).</p>
    <div class="labmesdefis">${E.defis.map(d => {
      const n = note(d.jour);
      return `<div class="labmondefi"><span><i class="tnum">${d.jour}</i>${h((byId[d.adversaire] || {}).nom || d.adversaire)}</span>
        <div class="labetoiles" role="group" aria-label="Étoiles au défi ${d.jour}">${[0, 1, 2, 3].map(k =>
          `<button data-lab="etoiles" data-j="${d.jour}" data-n="${k}" class="${n === k ? 'on' : ''}">${k ? '★'.repeat(k) : '–'}</button>`).join('')}</div></div>`;
    }).join('')}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost" data-lab="ech-essais">Rejouer aujourd'hui</button>
      <button class="btn ghost labdanger" data-lab="ech-moi-raz">Tout effacer…</button>
    </div>
  </section>`;
}

/* Une action sur son compte : le serveur rend me(), ou l'état de L'Échauffement. */
async function labMoiFaire(fn, args, msg, ech) {
  occupe(true);
  try {
    const r = await Backend.labo(fn, args);
    /* labo_sauver rend l'état du Labo ; labo_ech_moi, celui de L'Échauffement ;
       les autres, me(). */
    if (fn === 'labo_sauver') labEtat = r;
    else if (ech) { if (!(echData && echData.apercu)) echData = r; }
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
function vLabApercus() {
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
    <h2>L'Échauffement</h2>
    <p class="muted small">Les sept défis se jouent avec ta collection, sans limite d'essais : rien n'est envoyé.</p>
    <div class="labgrid">
      <button class="labbtn" data-act="t-ech-debut"><b>La page</b><span>au premier jour, rien de gagné</span></button>
      <button class="labbtn" data-act="t-ech-complet"><b>Tout gagné</b><span>21 étoiles, les huit indices</span></button>
      <button class="labbtn" data-act="t-ech-annonce"><b>Son annonce</b><span>la fenêtre de l'événement</span></button>
      <button class="labbtn" data-act="t-ech-indices"><b>Les indices</b><span>les huit, avec leur texte</span></button>
      <button class="labbtn" data-act="t-ech-final"><b>Le dernier mot</b><span>la révélation des 21 étoiles</span></button>
      <button class="labbtn" data-act="t-ech-sf"><b>Le défi du jour</b><span>après la saison, sans limite d'essais</span></button>
      <button class="labbtn" data-act="t-ech-recap"><b>Son récap</b><span>la page et la fenêtre de fin, chiffres inventés</span></button>
    </div>
    ${echData && echData.apercu ? `<h3 class="labsous">Le bandeau de l'écran Boosters</h3>${vBandeauEch()}` : ''}
  </section>

  <section class="panel">
    <h2>Fenêtres</h2>
    <div class="labgrid">
      <button class="labbtn" data-act="t-nouveautes-25"><b>Nouveautés 2.5</b><span>à la sortie, une fois par appareil</span></button>
      <button class="labbtn" data-act="t-nouveautes-21"><b>Nouveautés 2.1</b><span>celle d'avant la sortie</span></button>
      <button class="labbtn" data-act="t-v2-recap-pop"><b>Fin de Reflets</b><span>avec le teasing de la 2.5</span></button>
      <button class="labbtn" data-act="t-v2-invitation"><b>Invitation</b><span>un code acheté en boutique</span></button>
      <button class="labbtn" data-act="t-cadeau"><b>Cadeau reçu</b><span>le paquet à ouvrir</span></button>
    </div>
  </section>

  <section class="panel">
    <h2>Reflets · le récap</h2>
    <p class="muted small">Avec des chiffres inventés, et le teasing de la 2.5 tant qu'elle n'est pas sortie.</p>
    <div class="row">
      <button class="btn ghost" data-act="t-v2-recap">L'onglet récap</button>
      <button class="btn ghost" data-act="t-v2-recap-ban">Le bandeau</button>
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
    case 'cal': {
      const etat = d.etat;
      const titres = { avant: 'Revenir avant la 2.5 ?', defi: `Aller au défi ${n} ?`, rattrapage: 'Aller au rattrapage ?',
        fini: 'Finir la saison ?', sans_fin: 'Aller au mode sans fin ?', officiel: 'Revenir au calendrier officiel ?' };
      return labPourTous(titres[etat], LAB_EFFETS[etat](n), () =>
        labServeurFaire('labo_calendrier', { p_etat: etat, p_n: n }, etat === 'officiel' ? 'Calendrier officiel rétabli.' : 'Le serveur a changé d\'état.'));
    }
    case 'decaler':
      return labPourTous(n > 0 ? 'Avancer d\'un jour ?' : 'Reculer d\'un jour ?',
        n > 0 ? 'La saison de L\'Échauffement commence un jour plus tôt : un défi de plus s\'ouvre pour tout le monde.'
          : 'La saison de L\'Échauffement commence un jour plus tard : le dernier défi ouvert se referme.',
        () => labServeurFaire('labo_decaler', { p_heures: n }, n > 0 ? 'Un jour de plus.' : 'Un jour de moins.'));
    case 'reverses':
      return labPourTous(n ? 'Ouvrir les Reverses ?' : 'Fermer les Reverses ?',
        n ? 'Leur recyclage et leur fabrication s\'ouvrent tout de suite, pour tout le monde.'
          : 'Leur recyclage et leur fabrication se ferment, sans date de réouverture.',
        () => labServeurFaire('labo_reverses', { p_ouvertes: !!n }, n ? 'Reverses ouvertes.' : 'Reverses fermées.'));
    case 'ech-raz': return labEchRaz();
    case 'sauver': return labMoiFaire('labo_sauver', {}, 'Ton compte est mis de côté.');
    case 'restaurer':
      return labConfirmer('Restaurer ton compte ?', 'Il redevient tel qu\'il était à la sauvegarde : ce qui a changé depuis est perdu.',
        'Restaurer', () => labMoiFaire('labo_restaurer', {}, 'Compte restauré.'));
    case 'cartes': {
      const q = d.q;
      const msg = { master: 'Master set ajouté.', classiques: 'Les 122 ajoutées.', joueurs: 'Tous les Joueurs ajoutés.', vider: 'Collection vidée.' }[q];
      const faire = () => labMoiFaire('labo_cartes', { p_quoi: q }, msg);
      return q === 'vider' ? labConfirmer('Vider ta collection ?', 'Toutes tes cartes partent, et tes demandes d\'échange en attente sont annulées.', 'Vider', faire) : faire();
    }
    case 'monnaies': {
      const v = {};
      document.querySelectorAll('[data-labres]').forEach(i => { if (i.value !== '') v[i.dataset.labres] = Math.max(0, Math.round(+i.value) || 0); });
      /* Sans événement, pas de Prismes : on ne les envoie que s'ils changent. */
      if ((save.prismes || 0) === v.prismes) delete v.prismes;
      return labMoiFaire('labo_monnaies', { p_valeurs: v }, 'Ressources posées.');
    }
    case 'cosmetiques':
      return labMoiFaire('labo_cosmetiques', { p_ids: Object.keys(FRAMES).filter(k => k !== 'default').concat(Object.keys(TITRES)) },
        'Tous les cadres et titres sont à toi.');
    case 'etoiles':
      return labMoiFaire('labo_ech_moi', { p_action: 'etoiles', p_jour: +d.j, p_etoiles: n }, n ? `${n} étoile${n > 1 ? 's' : ''} au défi ${d.j}.` : `Défi ${d.j} remis à zéro.`, true);
    case 'ech-essais': return labMoiFaire('labo_ech_moi', { p_action: 'essais' }, 'Tes essais du jour sont effacés.', true);
    case 'ech-moi-raz':
      return labConfirmer('Effacer ton Échauffement ?', 'Tes essais, tes notes et tes paliers. Ce qui a été versé reste.',
        'Effacer', () => labMoiFaire('labo_ech_moi', { p_action: 'raz' }, 'Ton Échauffement est effacé.', true));
    case 'raz':
      return labConfirmer('Repartir de zéro ?', `Plus de cartes, de monnaies, de quêtes ni d'historique.${labEtat && labEtat.sauvegarde
        ? ' Ta sauvegarde permet de revenir en arrière.' : ' <b>Rien n\'est mis de côté</b> : pense à « Mettre mon compte de côté » d\'abord.'}`,
        'Repartir de zéro', () => labMoiFaire('labo_raz_moi', {}, 'Compte remis à zéro.'));
  }
}

/* ======================================================= Aperçus : les outils */
/* L'état d'aperçu de L'Échauffement : les sept défis ouverts, et, pour
   « complet », les 21 étoiles et les huit indices. Les défis et les indices
   viennent du serveur (labo_etat › echauffement). */
async function labEchApercu(complet) {
  if (!labEtat || !labEtat.echauffement) { await labCharger(); }
  const E = labEtat && labEtat.echauffement;
  if (!E) return toast('Les données de L\'Échauffement ne sont pas chargées.');
  const t = Date.now();
  echData = {
    apercu: true, debut: new Date(t - 6 * 86400000).toISOString(), fin: new Date(t + 3 * 86400000 - 3600000).toISOString(),
    ouvert: 7, total: 7, essais_max: 3, serveur: new Date(t).toISOString(),
    defis: E.defis.map(d => Object.assign({}, d, { etoiles: complet ? 3 : 0, equipe: null, essais_jour: 0 })),
    etoiles: complet ? 21 : 0, gagnes: complet ? 7 : 0, paliers: complet ? ['sept', 'parfait'] : [],
    indices: complet ? E.indices.slice() : [], apercuIndices: E.indices.slice()
  };
  if (!complet) echData.defis = echData.defis.slice(0, 1);
  /* L'événement : un Pass à moitié fait, des quêtes, la boutique (Backend.shop), un classement inventé. */
  const tot = complet ? 1050 : 312;
  echEv = { code: 'echauffement', apercu: true, solde: Math.round(tot / 2), total: tot, rang: 5, joueurs: 37,
    piste: ECH_PISTE.map(x => Object.assign({}, x, { pris: x.seuil <= (complet ? 1050 : 220) })),
    top: [['Nova.92', 't_elu', 1140], ['Lumen', 't_centurion', 980], ['Mira', null, 640], ['Kairo', null, 410]]
      .map(([pseudo, titre, total]) => ({ pseudo, titre, total, avatar: 'star', frame: 'f_braise', photo: null, moi: false })) };
  echSf = null; echRecapApercu = null;
  echVue = 'accueil'; echOnglet = 'defis';
  if (!Backend.shop.length) Backend.loadShop().then(render).catch(() => {});
  aller('combats');
}

/* Après la saison : le défi du jour (le premier de la saison, en Facile), ou
   le récap et sa fenêtre, avec des chiffres inventés. */
async function labEchApercuApres(recap) {
  if (!labEtat || !labEtat.echauffement) { await labCharger(); }
  const E = labEtat && labEtat.echauffement;
  if (!E) return toast('Les données de L\'Échauffement ne sont pas chargées.');
  const t = Date.now(), d = E.defis[0];
  echData = { apercu: true, debut: new Date(t - 10 * 86400000).toISOString(), fin: new Date(t - 3600000).toISOString(),
    ouvert: 7, total: 7, essais_max: 3, serveur: new Date(t).toISOString(),
    defis: E.defis.map(x => Object.assign({}, x, { etoiles: 2, equipe: null, essais_jour: 0 })), etoiles: 14, gagnes: 7, paliers: ['sept'],
    indices: E.indices.filter(x => x.jour > 0 && x.jour <= 3), apercuIndices: E.indices.slice() };
  echEv = null;
  echSf = { ouvert: true, apercu: true, debut: echData.fin, serveur: echData.serveur, jour: '', n: recap ? 1 : 4, essais_max: 99, prix: ECH_SF_PRIX,
    defi: { adversaire: d.adversaire, pv: d.pv, regle: d.regle, param: d.param, titre: d.titre, texte: d.texte, niveau: 1,
      etoiles: 0, equipe: null, essais_jour: 0 }, demain: 4, victoires: recap ? 0 : 3, etoiles: recap ? 0 : 7, serie: recap ? 0 : 2, rang: recap ? null : 4,
    top: [['Nova.92', 11], ['Lumen', 9], ['Mira', 8], [save.pseudo, 7, true]].map(([pseudo, total, moi]) => ({ pseudo, total, moi: !!moi,
      titre: null, avatar: moi ? save.avatar : 'star', frame: moi ? save.frame : 'f_ardeur', photo: moi ? maPhoto() : null })) };
  echRecapApercu = recap ? { code: 'echauffement', titre: 'L\'Échauffement', apercu: true, debut: echData.debut, fin: echData.fin,
    jusqua: new Date(t + 3 * 86400000 - 3600000).toISOString(), total: 815, paliers: 15, paliers_max: 20, pris: 15, quetes: 27,
    rang: 6, joueurs: 37, etoiles: 14, gagnes: 7, parfaits: 3, defis: 7, combats: 23,
    top: [['Nova.92', 1180], ['Lumen', 1010], ['Mira', 905]].map(([pseudo, total]) => ({ pseudo, total, titre: null, avatar: 'star', frame: 'f_ardeur', photo: null, moi: false })) } : null;
  echVue = 'accueil'; echSfOnglet = recap ? 'recap' : 'jour';
  aller('combats');
  if (recap) setTimeout(montrerEchRecap, 350);
}

async function labEchIndices() {
  if (!labEtat || !labEtat.echauffement) { await labCharger(); }
  const E = labEtat && labEtat.echauffement;
  if (!E) return toast('Les données de L\'Échauffement ne sont pas chargées.');
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

/* La révélation des 21 étoiles, avec les indices du serveur. */
async function labEchFinal() {
  if (!labEtat || !labEtat.echauffement) { await labCharger(); }
  const E = labEtat && labEtat.echauffement;
  if (!E) return toast('Les données de L\'Échauffement ne sont pas chargées.');
  montrerDernierMot(E.indices);
}

async function labEtatReel() {
  if (echData && echData.apercu) { echData = null; echEv = null; echSf = null; }
  echRecapApercu = null;
  if (rfRecapApercu) { rfRecapApercu = null; rfRecap = null; }
  try { await Backend.pull(); } catch (e) { /* le prochain rafraîchissement s'en chargera */ }
  await chargerEch();
  render();
  toast('État du serveur rétabli.');
}

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
