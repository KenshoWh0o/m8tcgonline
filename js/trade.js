/* Onglet Échanges. Une demande part vers un pseudo, l'autre joueur répond quand
   il veut : rien n'est simultané. Les deux cartes doivent être de même rareté, et
   c'est le serveur qui vérifie tout au moment de l'accord — possession comprise,
   pour que personne n'échange une carte qu'il vient de donner ailleurs. */
"use strict";

let trVue = 'recues';                  /* 'recues' | 'envoyees' | 'nouvelle' */
let trBrouillon = { pseudo: '', offre: null, veut: null, note: '' };
let trCible = null;                    /* joueur trouvé : { pseudo, avatar, frame } */

const RAR_ORDRE = ['C', 'PC', 'R', 'E', 'L'];
const tradeGratuit = () => !save.tradeFreeAt || save.tradeFreeAt <= Date.now();
const tradeJetons = () => (save.inv || {}).trade_token || 0;

/* ---------- La page ---------- */
function vEchanges() {
  if (Backend.mode !== 'cloud') return horsLigne('Échanges');

  const list = Backend.trades || [];
  const recues = list.filter(t => t.sens === 'recue' && t.status === 'pending');
  const envoyees = list.filter(t => t.sens === 'envoyee' && t.status === 'pending');
  const passees = list.filter(t => t.status !== 'pending');

  const onglets = [
    ['recues', 'Reçues', recues.length],
    ['envoyees', 'Envoyées', envoyees.length],
    ['nouvelle', 'Proposer', 0]
  ];

  let corps;
  if (trVue === 'nouvelle') corps = vNouvelleDemande();
  else if (trVue === 'envoyees') {
    corps = envoyees.length
      ? envoyees.map(ligneTrade).join('')
      : vide('Aucune demande en cours', 'Propose un échange, puis attends la réponse.');
  } else {
    corps = recues.length
      ? recues.map(ligneTrade).join('')
      : vide('Boîte vide', 'Personne ne t\'a proposé d\'échange pour le moment.');
  }

  const histo = trVue !== 'nouvelle' && passees.length
    ? `<section class="qsec"><div class="qsechead"><h2>Ces sept derniers jours</h2></div>
       ${passees.slice(0, 8).map(ligneTrade).join('')}</section>`
    : '';

  return `<div class="pagehead">
      <h1>Échanges</h1>
      <p class="muted">Carte contre carte, à rareté égale. Les deux joueurs doivent valider.</p>
    </div>
    ${bandeauCout()}
    <div class="chips">${onglets.map(([k, l, n]) =>
      `<button data-tr="${k}" class="${trVue === k ? 'on' : ''}">${l}${n ? ` <i class="pastille">${n}</i>` : ''}</button>`).join('')}</div>
    ${corps}${histo}`;
}

/* Rappelle ce que coûte la prochaine demande : un délai, ou un jeton. */
function bandeauCout() {
  if (tradeGratuit()) {
    return `<div class="notice ok">Ta demande gratuite est disponible.
      Ensuite, une toutes les ${TRADE_COOLDOWN_H} h — ou un jeton pour ne pas attendre.</div>`;
  }
  const j = tradeJetons();
  return `<div class="notice">Prochaine demande gratuite dans <b>${dans(save.tradeFreeAt - Date.now())}</b>.
    ${j ? `Tu as <b>${j}</b> jeton${j > 1 ? 's' : ''} pour passer devant.`
        : 'Un jeton d\'échange s\'achète en boutique.'}</div>`;
}

/* ---------- Une demande ---------- */
function ligneTrade(t) {
  const off = byId[t.offer];
  const veut = byId[t.want];
  const attente = t.status === 'pending';
  const recue = t.sens === 'recue';

  const ETAT = { accepted: ['Acceptée', 'ok'], declined: ['Refusée', ''], cancelled: ['Annulée', ''] };
  const et = ETAT[t.status];

  /* Côté gauche : ce que le joueur d'en face met sur la table, vu de chez soi. */
  const gauche = recue ? off : veut;
  const droite = recue ? veut : off;

  return `<article class="trade${attente ? '' : ' passe'}">
    <header class="trhead">
      ${avatarHTML(t.avatar, 'default', 'sm')}
      <div><b>${h(t.pseudo)}</b>
        <p class="muted small">${recue ? 'te propose un échange' : 'a reçu ta demande'}
          · ${dateCourte(t.created_at)}</p></div>
      ${et ? `<span class="qtag ${et[1]}">${et[0]}</span>` : ''}
    </header>

    <div class="trswap">
      <div class="trside"><span class="trlab">Tu reçois</span>${miniCarte(gauche)}</div>
      <span class="trarrow">${NAVICO.swap}</span>
      <div class="trside"><span class="trlab">Tu donnes</span>${miniCarte(droite)}</div>
    </div>

    ${t.note ? `<p class="trnote">« ${h(t.note)} »</p>` : ''}

    ${attente ? (recue
      ? `<div class="row tracts">
           <button class="btn tiny" data-trep="${t.id}" data-ok="1" ${t.possible ? '' : 'disabled'}>Accepter</button>
           <button class="btn tiny ghost" data-trep="${t.id}" data-ok="0">Refuser</button>
         </div>
         ${t.possible ? '' : '<p class="muted small">Tu ne possèdes pas la carte demandée.</p>'}`
      : `<div class="row tracts"><button class="btn tiny ghost" data-trann="${t.id}">Annuler la demande</button></div>`)
      : ''}
  </article>`;
}

function miniCarte(c) {
  if (!c) return '<div class="mini vide"><span>?</span></div>';
  const n = save.col[c.id] || 0;
  return `<button class="mini" data-show="${c.id}" data-snd="carte">
    ${renderCard(c)}
    <span class="mininom">${h(c.nom)}</span>
    <span class="minimeta r${c.rar}">${(RAR[c.rar] || RAR.C).nom}${n ? ` · tu en as ${n}` : ''}</span>
  </button>`;
}

const dateCourte = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/* ---------- Composer une demande ---------- */
function vNouvelleDemande() {
  const off = trBrouillon.offre ? byId[trBrouillon.offre] : null;
  const veut = trBrouillon.veut ? byId[trBrouillon.veut] : null;
  const rarOK = off && veut && off.rar === veut.rar;
  const pret = trCible && off && veut && rarOK;

  const emplacement = (role, c, libelle, aide) => c
    ? `<button class="slot rempli" data-pick="${role}">${renderCard(c)}
        <span class="slotnom">${h(c.nom)}</span>
        <span class="slotmeta r${c.rar}">${(RAR[c.rar] || RAR.C).nom}</span></button>`
    : `<button class="slot" data-pick="${role}">
        <span class="slotplus">+</span><span class="slotlab">${libelle}</span>
        <span class="muted small">${aide}</span></button>`;

  return `<section class="panel compose">
    <h2>À qui ?</h2>
    <div class="findrow">
      <input id="tr-pseudo" type="text" maxlength="16" placeholder="Pseudo du joueur"
        value="${h(trBrouillon.pseudo)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny ghost" data-act="tr-find">Chercher</button>
    </div>
    ${trCible
      ? `<div class="found">${avatarHTML(trCible.avatar, trCible.frame, 'sm')}
           <b>${h(trCible.pseudo)}</b><span class="qtag ok">Trouvé</span></div>`
      : '<p class="muted small">Le pseudo s\'écrit exactement comme dans le profil, majuscules mises à part.</p>'}

    <h2>Quoi contre quoi ?</h2>
    <div class="slots">
      ${emplacement('offre', off, 'Ce que tu donnes', 'Une carte que tu possèdes')}
      <span class="trarrow big">${NAVICO.swap}</span>
      ${emplacement('veut', veut, 'Ce que tu veux', off ? `Une ${(RAR[off.rar] || RAR.C).nom}` : 'Même rareté')}
    </div>
    ${off && veut && !rarOK
      ? '<p class="autherr">Les deux cartes doivent être de la même rareté.</p>' : ''}

    <h2>Un mot ? (facultatif)</h2>
    <input id="tr-note" type="text" maxlength="140" placeholder="« Je cherche celle-là depuis deux semaines »"
      value="${h(trBrouillon.note)}">

    <div class="row" style="margin-top:16px">
      <button class="btn" data-act="tr-send" ${pret ? '' : 'disabled'}>
        ${tradeGratuit() ? 'Envoyer la demande'
          : tradeJetons() ? 'Envoyer (1 jeton)' : 'Demande en recharge'}
      </button>
    </div>
  </section>`;
}

/* ---------- Choisir une carte ---------- */
/* Pour ce qu'on donne : seulement ce qu'on possède. Pour ce qu'on veut :
   toutes les cartes de la même rareté, possédées ou non. */
function ouvrirChoixCarte(role) {
  const off = trBrouillon.offre ? byId[trBrouillon.offre] : null;

  let liste = cards.filter(c => c.cat !== 'essence');
  if (role === 'offre') liste = liste.filter(c => (save.col[c.id] || 0) > 0);
  else if (off) liste = liste.filter(c => c.rar === off.rar);

  liste.sort((a, b) => RAR_ORDRE.indexOf(b.rar) - RAR_ORDRE.indexOf(a.rar) || a.num - b.num);

  const corps = liste.length
    ? `<div class="pickgrid">${liste.map(c => {
        const n = save.col[c.id] || 0;
        return `<button class="pick" data-cardpick="${c.id}" data-role="${role}" data-snd="carte">
          ${renderCard(c)}
          <span class="picknom">${h(c.nom)}</span>
          <span class="pickmeta r${c.rar}">${(RAR[c.rar] || RAR.C).sym}${n ? ` ×${n}` : ''}</span>
        </button>`;
      }).join('')}</div>`
    : `<p class="muted">${role === 'offre'
        ? 'Tu ne possèdes encore aucune carte échangeable.'
        : 'Aucune carte de cette rareté dans l\'extension.'}</p>`;

  openSheet({
    title: role === 'offre' ? 'Choisis ce que tu donnes' : 'Choisis ce que tu veux',
    body: `<p class="muted small">${role === 'offre'
      ? 'Les Essences ne s\'échangent pas.'
      : off ? `Rareté imposée : ${(RAR[off.rar] || RAR.C).nom}, comme la carte que tu donnes.`
            : 'Choisis d\'abord la carte que tu donnes.'}</p>${corps}`,
    actions: [{ label: 'Fermer', fn: closeSheet }]
  });
}

/* ---------- Envoi ---------- */
async function trChercher() {
  const p = valeur('tr-pseudo');
  trBrouillon.pseudo = p;
  if (!p) { trCible = null; return render(); }
  occupe(true);
  try {
    const r = await Backend.findPlayer(p);
    trCible = r || null;
    if (!r) { toast('Aucun joueur ne porte ce pseudo.'); SFX.jouer('erreur'); }
    else SFX.jouer('gagne');
  } catch (e) {
    toast(e.message);
  } finally {
    occupe(false);
    render();
  }
}

async function trEnvoyer() {
  if (!trCible || !trBrouillon.offre || !trBrouillon.veut) return;
  const note = $('#tr-note') ? $('#tr-note').value.trim() : '';
  await agir(async () => {
    await Backend.tradeCreate(trCible.pseudo, trBrouillon.offre, trBrouillon.veut, note);
    trBrouillon = { pseudo: '', offre: null, veut: null, note: '' };
    trCible = null;
    trVue = 'envoyees';
  }, 'Demande envoyée.');
}
