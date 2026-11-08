/* Mes tirages : l'historique des boosters.

   Le serveur tient le journal (mes_tirages, supabase/installation/15_evenements.sql) : les
   trente derniers boosters, et des comptes sur tout ce qui a été tiré depuis
   la version 1.5.

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

function vTirages() {
  if (Backend.mode !== 'cloud') return horsLigne('Mes tirages');

  const tete = `<div class="pagehead"><div>
      <h1>Mes tirages</h1>
      <p>Tes trente derniers boosters, à revoir et à partager.</p>
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
  const depuis = d.depuis ? new Date(d.depuis).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';

  return tete + `
    <div class="stats">
      <div class="stat"><b>${fmtN(n)}</b><span>boosters enregistrés</span></div>
      <div class="stat"><b>${fmtN(r.L || 0)}</b><span>Légendaire${(r.L || 0) > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${fmtN(r.BR || 0)}</b><span>Brillante${(r.BR || 0) > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${fmtN(d.god || 0)}</b><span>godpack${(d.god || 0) > 1 ? 's' : ''}</span></div>
    </div>

    <section class="tirliste">
      <h2>Derniers boosters</h2>
      ${depuis ? `<p class="muted small">Journal tenu depuis le ${h(depuis)}.</p>` : ''}
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
