/* Point d'entrée : navigation entre onglets, clics, chargement de la sauvegarde. Chargé en dernier. */
"use strict";

/* ---------- Rendu ---------- */
function render() {
  header();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));

  const m = $('#main');
  m.innerHTML = tab === 'boosters' ? vBoosters()
    : tab === 'collection' ? vCollection()
    : tab === 'test' ? vTest()
    : vImport();

  if (tab === 'boosters') bindPack();

  const u = $('#unl');
  if (u) u.onchange = () => { save.unlimited = u.checked; persist(); header(); };

  const sn = $('#setname');
  if (sn) sn.onchange = () => { save.setName = sn.value.trim(); persist(); };

  const gn = $('#gamename');
  if (gn) gn.onchange = () => { save.gameName = gn.value.trim(); persist(); header(); };
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
  const el = e.target.closest('[data-act],[data-show],[data-filter],[data-edit],[data-go]');
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
  if (d.go) {
    rv = null;
    tab = d.go;
    render();
    return;
  }
  if (d.edit) {
    editSheet(d.edit);
    return;
  }

  switch (d.act) {
    case 'open':
      openBooster();
      break;
    case 'packimg':
      $('#fpack').click();
      break;
    case 'packdel':
      packImg = null;
      kvSet('packimg', null);
      render();
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
      custom.forEach(c => save.col[c.id] = Math.max(2, save.col[c.id] || 0));
      persist();
      toast('Toutes les cartes sont débloquées.');
      break;
    case 't-clear':
      openSheet({
        title: 'Vider ta collection ?',
        body: '<p class="muted">Tes cartes importées restent, mais tu ne possèdes plus aucun exemplaire.</p>',
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
    case 'zip':
      $('#fzip').click();
      break;
    case 'imgs':
      $('#fimg').click();
      break;
    case 'giveall':
      custom.forEach(c => save.col[c.id] = Math.max(2, save.col[c.id] || 0));
      persist();
      toast('Ajoutées à ta collection.');
      render();
      break;
    case 'delall':
      openSheet({
        title: 'Supprimer toutes tes cartes ?',
        body: '<p class="muted">Les images importées seront effacées de cet appareil.</p>',
        actions: [
          {
            label: 'Supprimer', primary: true, fn: async () => {
              custom.forEach(c => { delete save.col[c.id]; kvSet('img:' + c.id, null); });
              imgSaved = new Set();
              custom = [];
              await persistCustom();
              persist();
              rebuild();
              closeSheet();
              render();
            }
          },
          { label: 'Annuler', fn: closeSheet }
        ]
      });
      break;
    case 'reset':
      openSheet({
        title: 'Tout réinitialiser ?',
        body: '<p class="muted">Ta collection et tes boosters reviennent au départ. Tes cartes importées sont conservées.</p>',
        actions: [
          { label: 'Réinitialiser', primary: true, fn: () => { save = defaultSave(); rv = null; persist(); closeSheet(); render(); } },
          { label: 'Annuler', fn: closeSheet }
        ]
      });
      break;
  }
});

/* ---------- Boucle des tickets ---------- */
setInterval(() => {
  if (!save) return;
  const before = save.tickets;
  regen();
  if (save.tickets !== before) header();
  const t = $('#timer');
  if (t) t.textContent = timerText();
}, 1000);

/* ---------- Démarrage ---------- */
(async () => {
  save = await kvGet('save2');
  await loadCustom();
  packImg = (await kvGet('packimg')) || null;
  rebuild();

  if (!save) {
    save = defaultSave();
    persist();
  }
  Object.keys(save.col).forEach(id => { if (!byId[id]) delete save.col[id]; });

  regen();
  render();

  if (!(await dbp)) toast("La sauvegarde n'est pas disponible sur ce navigateur : ta progression sera perdue en quittant.");
})();
