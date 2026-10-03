/* Mes tirages : l'historique des boosters et la chance qu'on y a eue.

   Le serveur tient le journal (mes_tirages, supabase/15_evenements.sql) : les
   trente derniers boosters, et des comptes sur tout ce qui a été tiré depuis
   la version 1.5. La page compare chaque rareté à ce qu'on aurait dû obtenir
   en moyenne — c'est la question que tout le monde se pose, « est-ce que j'ai
   de la chance ? ».

   Chaque booster de la liste se partage (js/partage.js). */
"use strict";

let tirData = null;
let tirErreur = '';

async function chargerTirages() {
  try {
    tirData = await Backend.mesTirages();
    tirErreur = '';
  } catch (e) {
    tirErreur = e.message || 'L\'historique n\'a pas pu être chargé.';
  }
  if (tab === 'tirages') render();
}

/* Ce qu'un booster ordinaire donne en moyenne, case par case (open_pack,
   supabase/03_rpc.sql) : deux Communes, une Commune ou Peu commune (60/40),
   une Peu commune, une Essence, et la dernière carte. Les godpacks, un sur
   deux mille, ne bougent pas ces moyennes de façon visible. */
const TIR_MOYENNE = {
  C: 2.6, PC: 1.4, ES: 1 - 1 / FOIL_ODDS, BR: 1 / FOIL_ODDS,
  R: 0.8, E: 0.16, L: 0.04
};

function vTirages() {
  if (Backend.mode !== 'cloud') return horsLigne('Mes tirages');

  const tete = `<div class="pagehead"><div>
      <h1>Mes tirages</h1>
      <p>Tes derniers boosters, et ta chance comparée à la moyenne.</p>
    </div></div>`;

  if (tirErreur) return tete + vide('Historique indisponible', tirErreur);
  if (!tirData) return tete + '<p class="muted boitecharge">Chargement…</p>';

  const d = tirData;
  const n = d.total || 0;
  if (!n) {
    return tete + vide('Aucun tirage enregistré',
      'L\'historique a commencé avec la version 1.5 : ouvre un booster pour le démarrer.');
  }

  const r = d.raretes || {};
  /* La chance, rareté par rareté : obtenu / attendu. Au-dessus de 1, mieux
     que la moyenne. Sur peu de boosters, l'écart ne veut pas dire grand-chose :
     on le dit plutôt que de laisser croire à un verdict. */
  const ligne = rar => {
    const eu = r[rar] || 0;
    const att = n * TIR_MOYENNE[rar];
    const ratio = att ? eu / att : 0;
    const ton = ratio >= 1.15 ? 'haut' : ratio <= 0.85 ? 'bas' : '';
    return `<div class="tirligne">
      <span class="tirrar r${rar}"><i class="rardot r${rar}"></i>${(RAR[rar] || RAR.C).nom}</span>
      <b class="tnum">${fmtN(eu)}</b>
      <span class="tnum muted">attendu ${att < 10 ? att.toFixed(1).replace('.', ',') : fmtN(Math.round(att))}</span>
      <span class="tirratio tnum ${ton}">×${ratio.toFixed(2).replace('.', ',')}</span>
    </div>`;
  };

  const depuis = d.depuis ? new Date(d.depuis).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';

  return tete + `
    <div class="stats">
      <div class="stat"><b>${fmtN(n)}</b><span>boosters enregistrés</span></div>
      <div class="stat"><b>${fmtN(r.L || 0)}</b><span>Légendaire${(r.L || 0) > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${fmtN(r.BR || 0)}</b><span>Brillante${(r.BR || 0) > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${fmtN(d.god || 0)}</b><span>godpack${(d.god || 0) > 1 ? 's' : ''}</span></div>
    </div>

    <section class="panel">
      <h2>Ta chance</h2>
      <div class="tirchance">${['R', 'E', 'L', 'BR'].map(ligne).join('')}</div>
      <p class="muted small">Depuis le ${h(depuis)}. ${n < 50
        ? 'Sur moins de cinquante boosters, le hasard pèse encore beaucoup : ces écarts peuvent s\'inverser.'
        : '×1 : exactement la moyenne. Au-dessus, plus chanceux qu\'elle.'}</p>
    </section>

    <section class="tirliste">
      <h2>Derniers boosters</h2>
      ${(d.liste || []).map((t, i) => vTirage(t, i)).join('')}
    </section>`;
}

function vTirage(t, i) {
  const cs = (t.cartes || []).map(id => byId[id]).filter(Boolean);
  const meilleure = cs.reduce((m, c) => (rk(c) > rk(m) ? c : m), cs[0]);
  return `<article class="tirage${t.god ? ' god' : ''}">
    <div class="tirtete">
      <span><b>${meilleure ? h((RAR[meilleure.rar] || RAR.C).nom) : 'Booster'}</b>${t.god ? ' <i class="qtag">godpack</i>' : ''}
        <small class="muted">${h(ilya(t.quand))}</small></span>
      <button class="btn tiny ghost" data-tirpart="${i}" aria-label="Partager ce booster">${NAVICO.partage}Partager</button>
    </div>
    <div class="tircartes">${cs.map(c =>
      `<button class="tirmini" data-show="${c.id}" data-snd="carte" aria-label="${h(c.nom)}">${renderCard(c)}</button>`).join('')}</div>
  </article>`;
}
