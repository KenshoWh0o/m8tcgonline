/* Onglet Social : les amis, et les échanges qu'on fait avec eux.
   Les échanges vivent ici parce qu'on n'échange pas avec un inconnu : on cherche
   quelqu'un, on l'ajoute, on regarde ce qu'il a, puis on propose. */
"use strict";

let socVue = 'amis';          /* 'amis' | 'echanges' */
let socRecherche = '';

/* ---------- Compteurs ---------- */
const demandesAmis = () => (Backend.amis || []).filter(a => a.lien === 'recue').length;
const echangesRecus = () =>
  (Backend.trades || []).filter(t => t.sens === 'recue' && t.status === 'pending').length;
const socNotifs = () => demandesAmis() + echangesRecus();

/* ---------- La page ---------- */
function vSocial() {
  if (Backend.mode !== 'cloud') return horsLigne('Social');

  const onglets = [
    ['amis', 'Amis', demandesAmis()],
    ['echanges', 'Échanges', echangesRecus()]
  ];

  return `<div class="pagehead">
      <div>
        <h1>Social</h1>
        <p>Ajoute des joueurs, regarde leur collection, et échangez vos cartes.</p>
      </div>
    </div>
    <div class="segbar">${onglets.map(([k, l, n]) =>
      `<button data-soc="${k}" class="${socVue === k ? 'on' : ''}">${l}${n ? `<i class="pastille">${n}</i>` : ''}</button>`).join('')}</div>
    ${socVue === 'echanges' ? vEchanges() : vAmis()}`;
}

/* ---------- Amis ---------- */
function vAmis() {
  const tous = Backend.amis || [];
  const recues = tous.filter(a => a.lien === 'recue');
  const envoyees = tous.filter(a => a.lien === 'envoyee');
  const amis = tous.filter(a => a.lien === 'ami');

  const ligne = (a, actions) => `<article class="amiligne">
    <button class="amiid" data-fiche="${h(a.pseudo)}">
      ${avatarHTML(a.avatar, a.frame, 'sm')}
      <span class="aminom"><b>${h(a.pseudo)}</b>${a.is_admin ? '<i class="qtag ok">admin</i>' : ''}
        <small class="muted">${a.lien === 'ami'
          ? (a.echanges ? a.echanges + ' échange' + (a.echanges > 1 ? 's' : '') + ' en cours' : 'Voir le profil')
          : a.lien === 'recue' ? "Veut t'ajouter" : 'Demande envoyée'}</small></span>
    </button>
    <span class="amiacts">${actions}</span>
  </article>`;

  const bloc = (titre, liste, actions) => liste.length
    ? `<section class="qsec"><div class="qsechead"><h2>${titre}</h2></div>
       ${liste.map(a => ligne(a, actions(a))).join('')}</section>`
    : '';

  return `<section class="panel">
    <h2>Ajouter un joueur</h2>
    <div class="findrow">
      <input id="soc-pseudo" type="text" maxlength="16" placeholder="Son pseudo exact"
        value="${h(socRecherche)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn tiny" data-act="soc-add">Ajouter</button>
    </div>
    <p class="muted small">Les majuscules ne comptent pas. Ton pseudo à toi est
      <b>${h(save.pseudo)}</b> — c'est celui qu'on doit taper pour t'ajouter.</p>
  </section>

  ${bloc('Demandes reçues', recues, a => `
    <button class="btn tiny" data-ami-ok="${h(a.pseudo)}">Accepter</button>
    <button class="btn tiny ghost" data-ami-non="${h(a.pseudo)}">Refuser</button>`)}

  ${bloc('Tes amis', amis, a => `
    <button class="btn tiny" data-troc="${h(a.pseudo)}">Échanger</button>`)}

  ${bloc('Demandes envoyées', envoyees, a => `
    <button class="btn tiny ghost" data-ami-non="${h(a.pseudo)}">Annuler</button>`)}

  ${amis.length || recues.length || envoyees.length ? '' :
    vide("Personne pour l'instant", 'Ajoute un joueur avec son pseudo pour commencer à échanger.')}`;
}

/* ---------- Fiche d'un joueur ---------- */
async function ouvrirFiche(pseudo) {
  occupe(true);
  let f;
  try {
    f = await Backend.ficheJoueur(pseudo);
  } catch (e) {
    toast(e.message);
    return occupe(false);
  } finally {
    occupe(false);
  }
  if (!f) return toast('Joueur introuvable.');

  const pct = f.total ? Math.round(f.possede / f.total * 100) : 0;

  /* Entre amis, on voit ce qu'il possède : les doublons sont les cartes
     qu'il peut céder sans se démunir, donc les meilleures à demander. */
  let doubles = '';
  if (f.col) {
    const d = Object.entries(f.col)
      .filter(([id, n]) => n > 1 && byId[id] && byId[id].cat !== 'essence')
      .map(([id]) => byId[id])
      .sort((a, b) => rk(b) - rk(a) || a.num - b.num);
    doubles = d.length
      ? `<h2>Ses doublons <span class="muted small">— ${d.length} cartes qu'il a en plusieurs exemplaires</span></h2>
         <div class="pickgrid">${d.slice(0, 24).map(c =>
           `<button class="pick" data-show="${c.id}" data-snd="carte">${renderCard(c)}
             <span class="picknom">${h(c.nom)}</span>
             <span class="pickmeta r${c.rar}">×${f.col[c.id]}</span></button>`).join('')}</div>`
      : '<p class="muted small">Aucun doublon pour le moment.</p>';
  }

  openSheet({
    title: f.pseudo,
    body: `<div class="fiche">
      ${avatarHTML(f.avatar, f.frame, 'xl')}
      <div class="fichemeta">
        ${f.is_admin ? '<span class="qtag ok">Administrateur</span>' : ''}
        <p class="muted small">Membre depuis ${dateCourte(f.membre_depuis).split(' à ')[0]}</p>
      </div>
    </div>
    ${(f.vitrine || []).length ? vVitrine(f.vitrine, false) : ''}
    <div class="stats">
      <div class="stat"><b>${f.possede} / ${f.total}</b><span>collection (${pct} %)</span></div>
      <div class="stat"><b>${fmtN(f.packs_opened)}</b><span>boosters ouverts</span></div>
      <div class="stat"><b>${fmtN(f.trades_done)}</b><span>échanges conclus</span></div>
      <div class="stat"><b>${fmtN(f.streak)}</b><span>jours d'affilée</span></div>
    </div>
    ${f.ami ? doubles : '<p class="muted small">Ajoute-le en ami pour voir sa collection et lui proposer un échange.</p>'}`,
    actions: f.moi ? [{ label: 'Fermer', fn: closeSheet }]
      : f.ami
        ? [{ label: 'Proposer un échange', primary: true, fn: () => { closeSheet(); versEchange(f.pseudo); } },
           { label: 'Retirer des amis', fn: () => agir(() => Backend.amiRetirer(f.pseudo), 'Retiré de tes amis.').then(closeSheet) },
           { label: 'Fermer', fn: closeSheet }]
        : [{ label: 'Ajouter en ami', primary: true, fn: () => { closeSheet(); agir(() => Backend.amiDemander(f.pseudo), 'Demande envoyée.'); } },
           { label: 'Fermer', fn: closeSheet }]
  });
}

/* Ouvre la composition d'un échange, destinataire déjà rempli. */
function versEchange(pseudo) {
  socVue = 'echanges';
  trVue = 'nouvelle';
  trBrouillon = { pseudo, offre: null, veut: null, note: '' };
  trCible = { pseudo, avatar: 'star', frame: 'default' };
  const a = (Backend.amis || []).find(x => x.pseudo === pseudo);
  if (a) trCible = { pseudo: a.pseudo, avatar: a.avatar, frame: a.frame };
  render();
}

async function socAjouter() {
  const p = valeur('soc-pseudo');
  if (!p) return;
  await agir(async () => {
    await Backend.amiDemander(p);
    socRecherche = '';
  }, 'Demande envoyée.');
}
