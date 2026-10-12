/* Les défis entre amis (version 3.0) : du combat en direct, à deux.

   Pas de serveur de jeu : chacun fait tourner le moteur chez soi, avec la
   même graine. Le serveur range les actions dans l'ordre (defi_jouer,
   supabase/23_combats.sql) ; chaque navigateur envoie les siennes et
   récupère celles de l'autre, qu'il rejoue. Le moteur vérifie chacune : une
   action impossible ne passe pas.

   Le défi : A défie B avec son deck ; B accepte avec le sien ; le serveur
   tire la graine et le pile ou face. A est le CEO 0, B le CEO 1. */
"use strict";

let defiActif = null;

async function defier(pseudo) {
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (onglet Decks).');
  openSheet({
    title: `Défier ${pseudo} ?`,
    body: `<p class="muted">Avec ton deck « ${h(deck.nom)} ». ${h(pseudo)} reçoit le défi et choisit son deck ; le combat commence dès qu'il accepte.</p>${vChoixDeck()}`,
    actions: [
      { label: 'Envoyer le défi', primary: true, fn: async () => {
        closeSheet();
        const ok = await agir(() => Backend.defiLancer(pseudo, Decks.versMoteur(cbDeckActif())), 'Défi envoyé.');
        if (ok) attendreAcceptation();
      } },
      { label: 'Annuler', fn: closeSheet }
    ]
  });
}

/* Un défi envoyé : on regarde de temps en temps s'il a été accepté. */
let attenteDefi = null;
function attendreAcceptation() {
  clearInterval(attenteDefi);
  let n = 0;
  attenteDefi = setInterval(async () => {
    if (++n > 90 || Backend.mode !== 'cloud') return clearInterval(attenteDefi);
    try {
      await Backend.pull();
      const d = cbEtat().defis.find(x => !x.pour_moi && x.statut === 'en_cours' && !x.vu);
      if (d) {
        clearInterval(attenteDefi);
        toast(`${d.pseudo} accepte ton défi !`);
        SFX.jouer('notif');
        jouerDefi(d.id);
      } else if (tab === 'combats' && cbVue === 'versus') majDiscrete(true);
    } catch (e) { /* on réessaiera */ }
  }, 2000);
}

async function accepterDefi(id) {
  const deck = cbDeckActif();
  if (!deck) return toast('Il te faut un deck valide (onglet Decks).');
  let r;
  try {
    occupe(true);
    r = await Backend.defiRepondre(id, true, Decks.versMoteur(deck));
  } catch (e) {
    return toast(e.message || 'Le défi n\'a pas pu être accepté.');
  } finally { occupe(false); }
  if (r && r.defi) ouvrirDefi(r.defi);
}

async function jouerDefi(id) {
  let d;
  try {
    occupe(true);
    d = await Backend.defiEtat(id, 0);
  } catch (e) {
    return toast(e.message || 'Défi introuvable.');
  } finally { occupe(false); }
  ouvrirDefi(d);
}

/* L'arène d'un défi. `d` : { id, init, actions, moi (0 | 1), adversaire } */
function ouvrirDefi(d) {
  const e = cbEtat();
  let E;
  try {
    E = Combat.rejouer(d.init, d.actions || []);
  } catch (err) {
    return toast('Ce défi ne peut pas être rejoué : ' + err.message);
  }
  defiActif = { id: d.id, moi: d.moi, n: (d.actions || []).length, poll: null, dernier: Date.now() };
  const adv = d.adversaire || {};
  Table.ouvrir({
    E: E.journal.length || E.fin ? E : null, init: d.init,
    moi: d.moi, ia: null,
    joueurs: d.moi === 0 ? [joueurMoi(), adv] : [adv, joueurMoi()],
    cosm: d.moi === 0 ? [e.cosm, adv.cosm || {}] : [adv.cosm || {}, e.cosm],
    brillantes: d.moi === 0 ? [brillantesMoi(), adv.brillantes || []] : [adv.brillantes || [], brillantesMoi()],
    titre: `Défi · ${adv.nom || ''}`, sousTitre: 'Entre amis',
    surAction: (a, E2, deMoi) => {
      if (!deMoi || !defiActif) return;
      const n = defiActif.n++;
      Backend.defiJouer(defiActif.id, n, a).catch(err => toast('Action non transmise : ' + (err.message || err)));
    },
    surFin: async (E2, gagne) => {
      arreterDefi();
      /* Le vrai serveur ne fait pas tourner le moteur : chacun lui dit qui a
         gagné (supabase/23_combats.sql), et il note un désaccord. */
      const r = await Backend.defiFin(d.id, E2.fin ? E2.fin.gagnant : null, E2.tour).catch(() => null);
      return htmlRecompense(r);
    },
    surQuitter: () => { arreterDefi(); render(); }
  });
  ecouterDefi();
}

/* Les actions de l'autre : on les relève toutes les deux secondes. */
function ecouterDefi() {
  if (!defiActif) return;
  clearInterval(defiActif.poll);
  defiActif.poll = setInterval(async () => {
    if (!defiActif || !Table.ouverte()) return arreterDefi();
    const T = Table.etat;
    if (!T || T.occupe) return;
    try {
      const r = await Backend.defiEtat(defiActif.id, defiActif.n);
      for (const a of r.actions || []) {
        defiActif.n++;
        defiActif.dernier = Date.now();
        await Table.actionDistante(a);
      }
      if (r.statut === 'abandon' && !T.E.fin) toast('Ton adversaire a quitté le défi.');
    } catch (e) { /* réseau : on réessaiera */ }
  }, 2000);
}

function arreterDefi() {
  if (defiActif) clearInterval(defiActif.poll);
  defiActif = null;
}
