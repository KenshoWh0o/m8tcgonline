/* Onglet Recyclage : les doublons deviennent des Éclats.

   Toutes les raretés se recyclent, sauf les Promos. On garde toujours un
   exemplaire de chaque carte — recycler ne fait jamais reculer la
   collection —, et les exemplaires proposés dans une demande d'échange encore
   en attente sont mis de côté : l'échange, s'il est accepté, doit pouvoir
   partir.

   Le serveur vérifie tout cela une seconde fois, et applique le plafond de la
   semaine (supabase/12_recyclage.sql). Les montants viennent de lui, par me() :
   la page n'en garde qu'une copie de secours, pour le premier affichage.

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

const REC_DEFAUT = { ES: 5, C: 10, PC: 20, R: 50, E: 200, L: 500 };
const recValeurs = () => (save.recyclage && save.recyclage.valeurs) || REC_DEFAUT;
const recPlafond = () => (save.recyclage ? save.recyclage.plafond : 2500);
const recSemaine = () => (save.recyclage ? save.recyclage.semaine : 0);
const recPrix = c => recValeurs()[c.rar] || 0;

/* Les exemplaires proposés dans une de mes demandes d'échange en attente. */
const recReserve = id => (Backend.trades || [])
  .filter(t => t.sens === 'envoyee' && t.status === 'pending' && t.offer === id).length;

/* Ce qu'on peut jeter : tout, moins l'exemplaire qu'on garde, moins ce qui
   est promis dans un échange. */
const recDispo = c => Math.max(0, mesEx(c.id) - 1 - recReserve(c.id));
const recTotal = () => Object.keys(recSel).reduce((s, id) => s + recSel[id] * recPrix(byId[id]), 0);
const recNombre = () => Object.values(recSel).reduce((s, n) => s + n, 0);
/* Ce qu'il reste à gagner cette semaine, sélection comprise. */
const recMarge = () => Math.max(0, recPlafond() - recSemaine() - recTotal());

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

  const doublons = cards.filter(c => !c.promo && recDispo(c) > 0)
    .sort((a, b) => rk(a) - rk(b) || a.num - b.num);
  const rars = RAR_FILTRES.filter(r => doublons.some(c => c.rar === r));
  if (recRar !== 'all' && !rars.includes(recRar)) recRar = 'all';
  const liste = recRar === 'all' ? doublons : doublons.filter(c => c.rar === recRar);

  const tete = `<div class="pagehead">
      <div>
        <h1>Recyclage</h1>
        <p>Tes doublons deviennent des ${MONNAIE.nom}. Tu gardes toujours un exemplaire de chaque carte.</p>
      </div>
      <span class="wallet pageact">${shardIco}<b>${fmtN(save.shards)}</b></span>
    </div>`;

  return `${tete}
    ${vPlafond()}
    ${vBareme()}
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

/* Le plafond de la semaine : ce qu'on a déjà touché, ce qu'on s'apprête à
   toucher, et quand ça repart. */
function vPlafond() {
  const plafond = recPlafond();
  const fait = recSemaine();
  const sel = recTotal();
  const plein = fait >= plafond;
  const pct = v => Math.min(100, v / plafond * 100).toFixed(1);

  return `<section class="recplafond${plein ? ' plein' : ''}">
    <div class="recplafond-tete">
      <b>Cette semaine</b>
      <span class="tnum"><b>${fmtN(fait + sel)}</b> / ${fmtN(plafond)} ${shardIco}</span>
    </div>
    <div class="recbarre"><i style="width:${pct(fait)}%"></i><i class="sel" style="width:${pct(sel)}%"></i></div>
    <small>${plein
      ? `Plafond atteint. Il repart à zéro dans ${dureeCourte(resteAvantRemise('weekly'))}.`
      : `Remise à zéro dans ${dureeCourte(resteAvantRemise('weekly'))}.`}</small>
  </section>`;
}

/* Ce que rapporte chaque rareté, d'un coup d'œil. */
function vBareme() {
  const v = recValeurs();
  return `<div class="recbareme">${RAR_FILTRES.map(r =>
    `<span><i class="rardot r${r}"></i>${(RAR[r] || RAR.C).nom}<b>${fmtN(v[r])}</b></span>`).join('')}</div>`;
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
      ? `<b>${nb}</b> carte${nb > 1 ? 's' : ''} · <b class="recgain">+${fmtN(recTotal())}</b> ${shardIco}
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
      return toast(recReserve(id)
        ? 'Le reste est gardé : un exemplaire, et ceux promis dans un échange.'
        : 'Tu gardes toujours un exemplaire de chaque carte.');
    }
    if (recPrix(c) > recMarge()) {
      SFX.jouer('erreur');
      return toast(`Plafond de la semaine : il te reste ${fmtN(recMarge())} ${MONNAIE.nom} à gagner.`);
    }
  }

  if (n) recSel[id] = n; else delete recSel[id];
  SFX.jouer(d > 0 ? 'tap' : 'retour');
  render();
}

/* Tout sélectionner, dans le filtre en cours, jusqu'au plafond. Les Épiques et
   les Légendaires n'y entrent que si on les a filtrées exprès : une carte qui
   vaut 200 ou 500 se choisit, elle ne s'emporte pas dans un lot. */
function recToutPrendre() {
  const garder = recRar === 'E' || recRar === 'L' ? [] : ['E', 'L'];
  const liste = cards.filter(c => !c.promo && recDispo(c) > 0
      && (recRar === 'all' || c.rar === recRar) && !garder.includes(c.rar))
    .sort((a, b) => rk(a) - rk(b) || a.num - b.num);

  let pris = 0;
  let bloque = false;
  liste.forEach(c => {
    while ((recSel[c.id] || 0) < recDispo(c)) {
      if (recPrix(c) > recMarge()) { bloque = true; break; }
      recSel[c.id] = (recSel[c.id] || 0) + 1;
      pris++;
    }
  });

  if (!pris) toast(bloque ? 'Plafond de la semaine atteint.' : 'Rien de plus à sélectionner ici.');
  else if (bloque) toast('Sélection arrêtée au plafond de la semaine.');
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
        <span class="recln"><b>${h(l.c.nom)}</b><small class="r${l.c.rar}">${(RAR[l.c.rar] || RAR.C).nom}</small></span>
        <span class="reclq">×${l.n}</span>
        <span class="reclv">+${fmtN(l.n * recPrix(l.c))}</span></li>`).join('')}</ul>
      <div class="rectotal"><span>Tu gagnes</span><b>+${fmtN(recTotal())} ${shardIco}</b></div>
      <p class="muted small">Il te restera au moins un exemplaire de chacune.</p>
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
        <b>+${fmtN(total)} ${shardIco}</b>
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
  }, `+${fmtN(gain)} ${MONNAIE.nom} : c'est recyclé.`);
  if (ok) SFX.jouer('piece');
}
