/* Point d'entrée : navigation entre onglets, clics, chargement de la sauvegarde. Chargé en dernier. */
"use strict";

/* ---------- Rendu ---------- */
function render() {
  header();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));

  const m = $('#main');
  m.innerHTML = tab === 'collection' ? vCollection()
    : tab === 'test' ? vTest()
    : vBoosters();

  if (tab === 'boosters') bindPack();

  const u = $('#unl');
  if (u) u.onchange = () => { save.unlimited = u.checked; persist(); header(); };
}

/* ---------- Navigation ---------- */
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  $('#main').scrollTop = 0;
  render();
});

/* ---------- Actions ---------- */
$('#main').addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-show],[data-filter],[data-ess]');
  if (!el) return;
  const d = el.dataset;

  if (d.show) {
    const c = byId[d.show];
    if (c) showCard(c);
    return;
  }
  if (d.filter) {
    colFilter = d.filter;
    render();
    return;
  }
  if (d.ess) {
    essFilter = d.ess;
    render();
    return;
  }
  switch (d.act) {
    case 'open':
      openBooster();
      break;
    case 't-open':
      openBooster({ test: true });
      break;
    case 't-R':
      openBooster({ test: true, force: 'R', god: false });
      break;
    case 't-E':
      openBooster({ test: true, force: 'E', god: false });
      break;
    case 't-L':
      openBooster({ test: true, force: 'L', god: false });
      break;
    case 't-god':
      openBooster({ test: true, god: true });
      break;
    case 't-all':
      cards.forEach(c => save.col[c.id] = Math.max(2, save.col[c.id] || 0));
      persist();
      toast('Toutes les cartes sont débloquées.');
      break;
    case 't-clear':
      openSheet({
        title: 'Vider ta collection ?',
        body: '<p class="muted">Les cartes du jeu restent, mais tu ne possèdes plus aucun exemplaire.</p>',
        actions: [
          { label: 'Vider', primary: true, fn: () => { save.col = {}; persist(); closeSheet(); render(); toast('Collection vidée.'); } },
          { label: 'Annuler', fn: closeSheet }
        ]
      });
      break;
    case 't-10':
      save.tickets += 10;
      persist();
      header();
      toast('+10 boosters.');
      break;
    case 'again':
      rv = null;
      render();
      setTimeout(openBooster, 60);
      break;
    case 'back':
      rv = null;
      render();
      break;
    case 'skip':
      rv.idx = rv.cards.length;
      render();
      break;
    case 'reset':
      openSheet({
        title: 'Tout réinitialiser ?',
        body: '<p class="muted">Ta collection et tes boosters reviennent au départ.</p>',
        actions: [
          { label: 'Réinitialiser', primary: true, fn: () => { save = defaultSave(); rv = null; persist(); closeSheet(); render(); } },
          { label: 'Annuler', fn: closeSheet }
        ]
      });
      break;
  }
});

/* ---------- Boucle de la réserve ---------- */
setInterval(() => {
  if (!save) return;
  const before = save.tickets;
  regen();
  if (save.tickets !== before) {
    header();
    /* Le compteur de l'écran booster montre la réserve : il faut le redessiner. */
    if (tab === 'boosters' && !rv) render();
    return;
  }
  const cl = $('#tmclock');
  if (!cl) return;
  cl.textContent = timerClock();
  $('#tmbar').style.width = tickPct() + '%';
}, 1000);

/* ---------- Démarrage ---------- */
(async () => {
  cards = buildCards();
  rebuild();
  brand();
  rollPack();

  save = (await kvGet('save2')) || defaultSave();
  if (!save.col) save.col = {};
  /* Une carte retirée de js/cards-data.js disparaît aussi de la collection. */
  Object.keys(save.col).forEach(id => { if (!byId[id]) delete save.col[id]; });
  if (!save.purged) {
    save.purged = true;
    purgeLegacy();
  }
  persist();

  regen();
  render();

  if (!(await dbp)) toast("La sauvegarde n'est pas disponible sur ce navigateur : ta progression sera perdue en quittant.");
})();
