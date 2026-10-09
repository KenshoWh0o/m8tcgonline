/* Onglet Recyclage : les doublons deviennent des Fragments, et les Fragments
   fabriquent les cartes qui manquent.

   Toutes les raretés de l'extension se recyclent ; jamais ce qui est hors
   extension (Promos, Brillantes, carte unique). On garde toujours un
   exemplaire de chaque carte — recycler ne fait jamais reculer la
   collection —, ou autant qu'on a choisi d'en garder (version 2.1,
   aGarder dans js/trade.js), et les exemplaires proposés dans une demande d'échange encore
   en attente sont mis de côté : l'échange, s'il est accepté, doit pouvoir
   partir.

   Plus de plafond : les Fragments n'achètent que des cartes manquantes, ils
   ne font tourner aucune boucle avec les boosters (le calcul est en tête de
   supabase/12_recyclage.sql). Le serveur revérifie tout. Les montants
   viennent de lui, par me() : la page n'en garde qu'une copie de secours.

   ------------------------------------------------------------------------
   Pas de bêtise

   Une carte recyclée est détruite. Trois garde-fous, du plus doux au plus
   ferme :
     1. on choisit carte par carte, exemplaire par exemplaire — aucun geste ne
        vide la collection d'un coup, et « Tout sélectionner » laisse les
        Épiques et les Légendaires de côté ;
     2. un récapitulatif liste chaque carte, avec ce qu'elle rapporte — et
        s'il y a une Épique ou une Légendaire dedans, une case à cocher ;
     3. une dernière confirmation, dont le bouton ne s'active qu'au bout de
        trois secondes : un double appui trop rapide ne passe pas. */
"use strict";

/* La sélection en cours : identifiant de carte → nombre d'exemplaires. */
let recSel = {};
let recRar = 'all';

const REC_DEFAUT = { ES: 1, C: 2, PC: 5, R: 20, E: 80, L: 250 };
const FAB_DEFAUT = { ES: 20, C: 40, PC: 100, R: 400, E: 2000, L: 8000 };
const recValeurs = () => (save.recyclage && save.recyclage.valeurs) || REC_DEFAUT;
const fabCouts = () => (save.recyclage && save.recyclage.couts) || FAB_DEFAUT;
const recPrix = c => recValeurs()[c.rar] || 0;
/* Les Reverses se recyclent seulement une fois leur fabrication ouverte
   (parametres.fabrication_reverse, supabase/12_recyclage.sql). */
const recReverses = () => (save.parametres || {}).fabrication_reverse ? reverses : [];
/* Une Reverse coûte le double (fabriquer, supabase/12_recyclage.sql). */
const fabCout = c => (fabCouts()[c.rar] || 0) * (c.rev ? 2 : 1);
const fragIco = `<span class="fragico">${NAVICO.fragment}</span>`;

/* Les exemplaires proposés dans une de mes demandes d'échange en attente. */
const recReserve = id => (Backend.trades || [])
  .filter(t => t.sens === 'envoyee' && t.status === 'pending' && t.offer === id).length;

/* Ce qu'on peut jeter : tout, moins ce qu'on garde, moins ce qui est promis
   dans un échange. */
const recDispo = c => Math.max(0, mesEx(c.id) - aGarder(c) - recReserve(c.id));
/* Les exemplaires que tes réglages mettent de côté, au-delà du premier. */
const recGardes = () => cards.concat(recReverses()).filter(c => !c.promo)
  .reduce((s, c) => s + Math.max(0, Math.min(mesEx(c.id), aGarder(c)) - 1), 0);
const recTotal = () => Object.keys(recSel).reduce((s, id) => s + recSel[id] * recPrix(byId[id]), 0);
const recNombre = () => Object.values(recSel).reduce((s, n) => s + n, 0);

/* Une sélection faite avant un échange ou une autre session peut ne plus
   tenir : on la ramène à ce qui est vraiment disponible. */
function recNettoyer() {
  Object.keys(recSel).forEach(id => {
    const c = byId[id];
    const d = c ? recDispo(c) : 0;
    if (!d) delete recSel[id];
    else if (recSel[id] > d) recSel[id] = d;
  });
}

/* ---------- L'écran ---------- */
function vRecyclage() {
  if (Backend.mode !== 'cloud') return horsLigne('Recyclage');
  recNettoyer();

  /* Les Reverses (version 2.0) aussi, au même prix, une fois ouvertes (recReverses). */
  const doublons = cards.concat(recReverses()).filter(c => !c.promo && recDispo(c) > 0)
    .sort((a, b) => rk(a) - rk(b) || a.num - b.num || !!a.rev - !!b.rev);
  const rars = RAR_FILTRES.filter(r => doublons.some(c => c.rar === r));
  if (recRar !== 'all' && !rars.includes(recRar)) recRar = 'all';
  const liste = recRar === 'all' ? doublons : doublons.filter(c => c.rar === recRar);

  const tete = `<div class="pagehead">
      <div>
        <h1>Recyclage</h1>
        <p>Tes doublons deviennent des ${FRAGMENTS.nom}, qui fabriquent les cartes qui te manquent.
          Tu gardes toujours un exemplaire de chaque carte, ou plus si tu l'as choisi.</p>
      </div>
      <span class="wallet pageact">${fragIco}<b>${fmtN(save.fragments || 0)}</b></span>
    </div>`;

  return `${tete}
    ${vFabInfo()}
    ${vBareme()}
    ${vGardesRec()}
    ${doublons.length
      ? `<div class="recfiltres">
           <div class="chips">
             <button data-recrar="all" class="${recRar === 'all' ? 'on' : ''}">Tous</button>
             ${rars.map(r => `<button data-recrar="${r}" class="${recRar === r ? 'on' : ''}">${(RAR[r] || RAR.C).nom}</button>`).join('')}
           </div>
           <button class="linkbtn" data-act="rec-tout">Tout sélectionner</button>
         </div>
         <div class="recgrid">${liste.map(vCaseRec).join('')}</div>
         ${vPiedRec()}`
      : vide('Aucun doublon', 'Chaque carte que tu as en double apparaîtra ici.')}`;
}

/* À quoi servent les Fragments, et combien il en faut. */
function vFabInfo() {
  const manque = cards.filter(c => !(save.col[c.id] > 0));
  const c = fabCouts();
  return `<section class="recplafond fabinfo">
    <div class="recplafond-tete">
      <b>Fabriquer une carte</b>
      <span class="tnum">${manque.length ? `<b>${manque.length}</b> à fabriquer` : 'Collection complète'}</span>
    </div>
    <small>Dans la Collection, touche une case vide : la carte est à toi contre des ${FRAGMENTS.nom}.
      Une Rare coûte ${fmtN(c.R)}, une Épique ${fmtN(c.E)}, une Légendaire ${fmtN(c.L)}.</small>
    ${manque.length ? '<button class="linkbtn" data-tab="collection">Voir ce qui me manque</button>' : ''}
  </section>`;
}

/* Ce que rapporte chaque rareté, d'un coup d'œil. */
function vBareme() {
  const v = recValeurs();
  return `<div class="recbareme">${RAR_FILTRES.map(r =>
    `<span><i class="rardot r${r}"></i>${(RAR[r] || RAR.C).nom}<b>${fmtN(v[r])}</b></span>`).join('')}</div>`;
}

/* Ce que les réglages « exemplaires à garder » retiennent ici, et où les
   changer. */
function vGardesRec() {
  const n = recGardes();
  return `<p class="recgardes muted small">${n
      ? `<b>${fmtN(n)}</b> exemplaire${n > 1 ? 's' : ''} mis de côté par tes réglages.`
      : 'Tu veux garder plusieurs exemplaires de certaines cartes ?'}
    <button class="linkbtn" data-act="vers-garder">Exemplaires à garder</button></p>`;
}

function vCaseRec(c) {
  const n = recSel[c.id] || 0;
  const dispo = recDispo(c);
  const reserve = recReserve(c.id);

  return `<div class="reccase${n ? ' on' : ''}">
    <button class="recimg" data-recplus="${c.id}" aria-label="Ajouter un exemplaire de ${h(c.nom)}">
      ${renderCard(c)}
      <i class="tpill" title="${dispo} exemplaire${dispo > 1 ? 's' : ''} recyclable${dispo > 1 ? 's' : ''}${reserve ? `, ${reserve} réservé${reserve > 1 ? 's' : ''} pour un échange` : ''}">×${dispo}</i>
      ${n ? `<i class="recn">${n}</i>` : ''}
    </button>
    ${n
      ? `<div class="recstep">
           <button data-recmoins="${c.id}" aria-label="Retirer un exemplaire">−</button>
           <b class="tnum">+${fmtN(n * recPrix(c))}</b>
           <button data-recplus="${c.id}" aria-label="Ajouter un exemplaire" ${n >= dispo ? 'disabled' : ''}>+</button>
         </div>`
      : `<span class="recval">+${fmtN(recPrix(c))}</span>`}
  </div>`;
}

function vPiedRec() {
  const nb = recNombre();
  return `<div class="recpied${nb ? ' actif' : ''}">
    <span class="recpied-txt">${nb
      ? `<b>${nb}</b> carte${nb > 1 ? 's' : ''} · <b class="recgain">+${fmtN(recTotal())}</b> ${fragIco}
         <button class="linkbtn" data-act="rec-vider">Vider</button>`
      : 'Touche une carte pour la sélectionner.'}</span>
    <button class="btn tiny" data-act="rec-go" ${nb ? '' : 'disabled'}>Recycler</button>
  </div>`;
}

/* ---------- Choisir ---------- */
function recAjuster(id, d) {
  const c = byId[id];
  if (!c) return;
  const n = (recSel[id] || 0) + d;
  if (n < 0) return;

  if (d > 0) {
    if (n > recDispo(c)) {
      SFX.jouer('erreur');
      const g = aGarder(c);
      const garde = g === GARDE_TOUT ? 'tous tes exemplaires' : g > 1 ? `${g} exemplaires` : 'un exemplaire';
      return toast(recReserve(id)
        ? `Le reste est gardé : ${garde}, et ceux promis dans un échange.`
        : g > 1 ? `Tu as choisi d'en garder ${g === GARDE_TOUT ? 'tous les exemplaires' : g}.`
          : 'Tu gardes toujours un exemplaire de chaque carte.');
    }
  }

  if (n) recSel[id] = n; else delete recSel[id];
  SFX.jouer(d > 0 ? 'tap' : 'retour');
  render();
}

/* Tout sélectionner, dans le filtre en cours. Les Épiques et
   les Légendaires n'y entrent que si on les a filtrées exprès : une carte qui
   vaut 200 ou 500 se choisit, elle ne s'emporte pas dans un lot. */
function recToutPrendre() {
  const garder = recRar === 'E' || recRar === 'L' ? [] : ['E', 'L'];
  const liste = cards.concat(recReverses()).filter(c => !c.promo && recDispo(c) > 0
      && (recRar === 'all' || c.rar === recRar) && !garder.includes(c.rar))
    .sort((a, b) => rk(a) - rk(b) || a.num - b.num);

  let pris = 0;
  liste.forEach(c => {
    const d = recDispo(c) - (recSel[c.id] || 0);
    if (d > 0) { recSel[c.id] = recDispo(c); pris += d; }
  });

  if (!pris) toast('Rien de plus à sélectionner ici.');
  else if (garder.length && recRar === 'all' && cards.some(c => ['E', 'L'].includes(c.rar) && recDispo(c) > 0)) {
    toast('Les Épiques et les Légendaires se choisissent une par une.');
  }
  render();
}

/* ---------- Confirmer, deux fois ---------- */
function recConfirmer() {
  const lots = Object.keys(recSel).map(id => ({ c: byId[id], n: recSel[id] }))
    .sort((a, b) => rk(b.c) - rk(a.c) || a.c.num - b.c.num);
  if (!lots.length) return;
  const hauts = lots.filter(l => l.c.rar === 'E' || l.c.rar === 'L');
  const nb = recNombre();

  openSheet({
    title: `Recycler ${nb} carte${nb > 1 ? 's' : ''} ?`,
    body: `<ul class="reclist">${lots.map(l => `<li>
        <span class="reclmini">${renderCard(l.c)}</span>
        <span class="recln"><b>${nomH(l.c)}</b><small class="r${l.c.rar}">${(RAR[l.c.rar] || RAR.C).nom}</small></span>
        <span class="reclq">×${l.n}</span>
        <span class="reclv">+${fmtN(l.n * recPrix(l.c))}</span></li>`).join('')}</ul>
      <div class="rectotal"><span>Tu gagnes</span><b>+${fmtN(recTotal())} ${fragIco}</b></div>
      <p class="muted small">Il te restera au moins un exemplaire de chacune, et ce que tu as choisi de garder.</p>
      ${hauts.length ? `<label class="toggle recgarde">
          <span>Je recycle bien ${hauts.length > 1 ? 'ces cartes' : 'cette carte'}
            ${hauts.some(l => l.c.rar === 'L') ? 'Légendaire' : 'Épique'}${hauts.length > 1 ? 's' : ''}
            <small>${hauts.map(l => h(l.c.nom)).join(', ')}</small></span>
          <input type="checkbox" id="rec-ok"></label>` : ''}`,
    actions: [
      { label: 'Continuer', primary: true, disabled: hauts.length > 0, fn: recConfirmerEncore },
      { label: 'Annuler', fn: closeSheet }
    ]
  });

  const coche = $('#rec-ok');
  if (coche) {
    coche.addEventListener('change', () => {
      const b = $('#sheet [data-si="0"]');
      if (b) b.disabled = !coche.checked;
    });
  }
}

function recConfirmerEncore() {
  const nb = recNombre();
  const total = recTotal();
  openSheet({
    title: 'Dernière confirmation',
    locked: true,
    body: `<div class="recfinal">
        <span class="recfinal-ico">${NAVICO.recycle}</span>
        <b>+${fmtN(total)} ${fragIco}</b>
        <p>${nb} carte${nb > 1 ? 's' : ''} ${nb > 1 ? 'vont être détruites' : 'va être détruite'}.
          C'est définitif : on ne peut pas revenir en arrière.</p>
      </div>`,
    actions: [
      { label: 'Recycler définitivement', primary: true, disabled: true, fn: recEnvoyer },
      { label: 'Annuler', fn: closeSheet }
    ]
  });

  /* Trois secondes avant que le bouton réponde : le temps de relire. */
  const b = $('#sheet [data-si="0"]');
  if (!b) return;
  let reste = 3;
  const libelle = () => { b.textContent = reste ? `Recycler définitivement (${reste})` : 'Recycler définitivement'; };
  libelle();
  const t = setInterval(() => {
    if (!b.isConnected) return clearInterval(t);
    reste--;
    libelle();
    if (!reste) { clearInterval(t); b.disabled = false; }
  }, 1000);
}

async function recEnvoyer() {
  const lots = Object.keys(recSel).map(id => ({ carte: id, n: recSel[id] }));
  const gain = recTotal();
  closeSheet();
  const ok = await agir(async () => {
    await Backend.recycler(lots);
    recSel = {};
  }, `+${fmtN(gain)} ${FRAGMENTS.nom} : c'est recyclé.`);
  if (ok) SFX.jouer('piece');
}

/* ---------- Fabriquer ---------- */
/* Une carte de l'extension qu'on n'a pas, contre des Fragments. Deux gestes,
   comme un achat : la fiche montre la carte, son prix et le solde qui
   restera ; le bouton ne répond que si le compte y est. */
function ouvrirFabrication(id) {
  const c = byId[id];
  if (!c || c.promo || save.col[id] > 0) return;
  /* Les Reverses (version 2.0) : fermées au lancement, ouvertes plus tard par
     un administrateur (parametres, supabase/21_reflets.sql). */
  if (c.rev && !(save.parametres || {}).fabrication_reverse) {
    return openSheet({
      title: 'Pas encore',
      body: `<div class="fabfiche">
          <button class="fabcarte" data-show="${c.id}" data-snd="carte">${renderCard(c)}</button>
          <div class="fabmeta"><b>${nomH(c)}</b>
            <p class="muted small">La fabrication des Reverses ouvrira plus tard : pour l'instant, elles se trouvent
              en booster — une par booster, en 5ᵉ carte — et s'échangent entre joueurs.</p></div>
        </div>`,
      actions: [{ label: 'Fermer', fn: closeSheet }]
    });
  }
  const cout = fabCout(c);
  const solde = save.fragments || 0;
  const manque = Math.max(0, cout - solde);
  const R = RAR[c.rar] || RAR.C;

  openSheet({
    title: 'Fabriquer cette carte ?',
    body: `<div class="fabfiche">
        <button class="fabcarte" data-show="${c.id}" data-snd="carte">${renderCard(c)}</button>
        <div class="fabmeta">
          <b>${nomH(c)}</b>
          <span class="r${c.rar}">${R.nom}${c.rev ? ' Reverse' : ''} · #${String(c.num || 0).padStart(3, '0')}</span>
          <div class="achatprix"><span>Coût</span><b>${fragIco}${fmtN(cout)}</b></div>
          <p class="achatreste${manque ? ' court' : ''}">${manque
            ? `Il te manque ${fmtN(manque)} ${FRAGMENTS.nom}. Recycle des doublons pour en gagner.`
            : `Il te restera ${fmtN(solde - cout)} ${FRAGMENTS.nom}.`}</p>
        </div>
      </div>`,
    actions: manque
      ? [{ label: 'Aller au recyclage', primary: true, fn: () => { closeSheet(); aller('recyclage'); } },
         { label: 'Fermer', fn: closeSheet }]
      : [{ label: `Fabriquer (${fmtN(cout)})`, primary: true, fn: () => fabriquerCarte(c) },
         { label: 'Annuler', fn: closeSheet }]
  });
}

async function fabriquerCarte(c) {
  closeSheet();
  const ok = await agir(() => Backend.fabriquer(c.id), `${c.nom} rejoint ta collection.`);
  if (ok) {
    SFX.jouer(c.rar === 'L' ? 'legend' : rk(c) >= 3 ? 'rare' : 'carte');
    vibrer(rk(c) >= 4 ? [25, 45, 40] : 30);
  }
}
