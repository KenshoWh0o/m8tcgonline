/* La vérification d'un combat (version 3.0.14).

   Le propriétaire : « Le serveur doit évidemment vérifier les résultats des
   combats. » Jusqu'à la 3.0.13, la page disait au serveur qui avait gagné,
   combien de PV elle avait pris au boss, en combien de tours : il la
   croyait, dans des plafonds. Désormais il rejoue la partie.

   Tout est déterministe : le moteur (js/combat/moteur.js) tire ses mélanges
   d'une graine, et l'adversaire (js/combat/ia.js) tire les siens de l'état
   de la partie — aucune horloge, aucun Math.random, seulement des opérations
   que tous les navigateurs calculent pareil. Le serveur part donc de ce qu'il
   a noté à l'ouverture (combat_debut : le mode, la graine, le deck du joueur,
   le jour, la Section, le boss), rebâtit la partie avec `partie()`, et la
   rejoue coup par coup (`rejouer()`) : chaque coup du joueur doit être
   permis par les règles, chaque coup de l'adversaire doit être celui qu'il
   aurait joué. C'est le résultat de cette partie-là qui paie (`verdict()`).

   Le même fichier sert partout, pour qu'il n'y ait qu'une façon de bâtir une
   partie : la page (js/battle.js : la partie qu'elle joue est celle que le
   serveur rejouera), le faux serveur de la démo (_demo/serveur.js), les
   tests (tools/combat-tests.js) et la fonction du serveur
   (supabase/functions/combat-verifier, qui l'embarque : tools/build-verif.py).

   Le Versus (`defi()`) n'a pas d'adversaire calculé : les deux joueurs
   jouent. Le serveur note qui a envoyé chaque coup (defi_jouer) ; un coup
   envoyé hors de son tour, ou que les règles refusent, fait perdre celui
   qui l'a envoyé. */
const Verif = (() => {
  const PV = () => Combat.REGLE.PV;
  /* Une écriture unique d'un coup : les clés triées à tous les niveaux, sans
     ce que JSON ne transmet pas (une valeur `undefined`). Deux coups égaux
     ont la même. */
  function canon(x) {
    const tri = v => (Array.isArray(v) ? v.map(tri)
      : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = tri(v[k]); return o; }, {})
        : v);
    return JSON.stringify(tri(JSON.parse(JSON.stringify(x))));
  }

  /* La partie d'un combat contre l'adversaire du jeu. `o` : ce que le
     serveur a noté à l'ouverture — { mode, cle, niveau, jour ('2026-11-02'),
     graine, deck (format du moteur : { club: [ids], reserve: [couleurs] }),
     section, boss, n }. Rend { init, niveau } : la partie, et le niveau de
     l'adversaire. Les noms n'y comptent pas (rien de la partie n'en dépend). */
  function partie(o) {
    const g = Number(o.graine) >>> 0;
    let moi = o.deck, adv, pv = [PV(), PV()], ess = [0, 0], poses = null, niveau = Number(o.niveau) || 3;
    if (o.mode === 'campagne') {
      const n = parseInt(String(o.cle || '').slice(2), 10) - 1;
      const f = combatsCampagne(o.section)[n];
      if (!f) throw new Error('Combat inconnu.');
      adv = Decks.versMoteur(deckRival(f, o.section));
      if (f.regle) { pv[1] = f.regle.pv || PV(); ess[1] = f.regle.ess || 0; }
      niveau = f.niveau;
    } else if (o.mode === 'infini') {
      adv = Decks.versMoteur(Decks.aleatoire(aleaGraine(g ^ 0x5bd1e995), { niveau }));
    } else if (o.mode === 'raid') {
      const c = raidCombat(o.cle, o.boss);
      adv = Decks.versMoteur(deckBoss(o.jour, o.cle, o.boss));
      poses = posesBoss(o.boss);
      pv = [c.pvMoi, c.pvBoss];
      ess = [0, c.ess];
      niveau = c.ia;
    } else if (o.mode === 'epreuve') {
      const x = epreuveDuJour(o.jour, g, o.n);
      moi = Decks.versMoteur(x.moi);
      adv = Decks.versMoteur(x.adv);
      pv = x.regle.pv.slice();
      ess = x.regle.ess.slice();
      niveau = CHOC.epreuve.ia;
    } else {
      throw new Error('Mode inconnu.');
    }
    if (!moi || !Array.isArray(moi.club) || !Array.isArray(moi.reserve)) throw new Error('Deck du joueur absent.');
    const init = { decks: [moi, adv], noms: ['Toi', 'Adversaire'], graine: g, pv, essDepart: ess };
    if (poses) init.poses = poses;
    return { init, niveau };
  }

  /* Ce que le serveur retient d'une partie finie (joueur `j`) : qui a gagné
     et comment, les Joueurs vaincus, les PV pris (les dégâts du Raid), ce
     qui reste à chacun. */
  function verdict(E, j) {
    let vaincus = 0, touches = 0;
    for (const ev of E.ev) {
      if (ev.t === 'vaincu' && ev.j !== j) vaincus++;
      if (ev.t === 'touche' && ev.j !== j) touches++;
    }
    const fin = E.fin || { gagnant: 1 - j, raison: 'abandon' };
    return {
      gagne: fin.gagnant === j, raison: fin.raison, abandon: fin.raison === 'abandon' && fin.gagnant !== j,
      tours: E.tour, vaincus, touches, pv: E.j[j].pv.length, pv_adv: E.j[1 - j].pv.length, actions: E.journal.length
    };
  }

  const refus = (raison, k) => ({ etat: 'refus', raison, k });

  /* Rejouer le journal d'un combat contre l'adversaire du jeu. `opt` :
       depuis : les coups de l'adversaire avant cet index ont déjà été
                vérifiés (une passe précédente) : on les rejoue sans les
                recalculer ;
       budget : en millisecondes. Recalculer un coup de l'adversaire coûte
                cher au niveau 5 (jusqu'à 2,4 s pour une partie de Raid,
                mesuré) ; la fonction du serveur n'a que 2 s par appel. Le
                budget épuisé, on rend { etat: 'suite', k } : la passe
                suivante repart de k ;
       meta : le titre, l'adversaire et le deck à écrire dans l'historique
              (de l'affichage seulement : le résultat vient de la partie).
     Rend { etat: 'fini', verdict, histo } ou { etat: 'refus', raison, k }. */
  function rejouer(o, journal, opt) {
    opt = opt || {};
    let p;
    try { p = partie(o); } catch (e) { return refus(e.message || 'Partie impossible à rebâtir.', 0); }
    if (!Array.isArray(journal) || journal.length > 5000) return refus('Journal illisible.', 0);
    const E = Combat.creer(p.init);
    const depuis = opt.depuis || 0;
    const limite = opt.budget ? Date.now() + opt.budget : Infinity;
    /* Chaque passe vérifie au moins un coup de l'adversaire : elle avance
       toujours, même quand rejouer le début a mangé le budget. */
    let fait = false;
    for (let k = 0; k < journal.length; k++) {
      const a = journal[k];
      if (!a || typeof a !== 'object' || Array.isArray(a)) return refus('Coup illisible.', k);
      const d = Combat.demande(E);
      if (!d || E.fin) return refus('Des coups après la fin de la partie.', k);
      if (a.t === 'abandon') {
        /* Seul le joueur abandonne, et c'est son dernier coup. */
        if (a.qui !== 0) return refus('L\'adversaire n\'abandonne jamais.', k);
        if (k !== journal.length - 1) return refus('Des coups après un abandon.', k);
        Combat.agir(E, { t: 'abandon', qui: 0 });
        break;
      }
      if (d.qui !== 0 && k >= depuis) {
        if (fait && Date.now() > limite) return { etat: 'suite', k };
        fait = true;
        let attendu;
        try { attendu = IA.choisir(E, { niveau: p.niveau }); } catch (e) { return refus('Adversaire incalculable : ' + (e.message || e), k); }
        if (canon(attendu) !== canon(a)) return refus('Un coup de l\'adversaire n\'est pas celui qu\'il aurait joué.', k);
      }
      try { Combat.agir(E, a); } catch (e) { return refus('Coup refusé par les règles : ' + (e.message || e), k); }
    }
    if (!E.fin) return refus('La partie n\'est pas finie.', journal.length);
    const v = verdict(E, 0);
    let histo = null;
    if (typeof Historique !== 'undefined') {
      try { histo = Historique.entree(E, 0, opt.meta || {}); } catch (e) { histo = null; }
    }
    return { etat: 'fini', verdict: v, histo };
  }

  /* Un défi entre amis. `x` : { decks: [deck_de, deck_pour], graine,
     actions, auteurs } — `auteurs[k]` : qui a envoyé le coup k (0 : celui qui
     a défié, 1 : l'autre ; absent pour un défi d'avant la 3.0.14). Rend
     { fini, gagnant, fautif, raison, tours, verdicts: [v0, v1], histo } : un
     coup envoyé hors de son tour, ou refusé par les règles, fait perdre son
     auteur (`fautif`), et la partie s'arrête là. `opt` : { moi, meta } —
     l'historique est écrit pour ce joueur-là. */
  function defi(x, opt) {
    opt = opt || {};
    const E = Combat.creer({ decks: x.decks, noms: ['A', 'B'], graine: Number(x.graine) >>> 0 });
    const acts = Array.isArray(x.actions) ? x.actions : [];
    const par = Array.isArray(x.auteurs) ? x.auteurs : [];
    let fautif = null, raison = null;
    for (let k = 0; k < acts.length && fautif == null; k++) {
      const a = acts[k];
      const qui = par[k] === 0 || par[k] === 1 ? par[k] : null;
      if (E.fin) break;
      if (!a || typeof a !== 'object') { fautif = qui; raison = 'Coup illisible.'; break; }
      if (a.t === 'abandon') {
        if (qui != null && a.qui !== qui) { fautif = qui; raison = 'Abandon envoyé pour l\'autre joueur.'; break; }
        Combat.agir(E, { t: 'abandon', qui: a.qui === 1 ? 1 : 0 });
        break;
      }
      const d = Combat.demande(E);
      if (!d) break;
      if (qui != null && d.qui !== qui) { fautif = qui; raison = 'Coup envoyé hors de son tour.'; break; }
      try { Combat.agir(E, a); } catch (e) { fautif = qui != null ? qui : d.qui; raison = 'Coup refusé par les règles : ' + (e.message || e); }
    }
    const fini = fautif != null || !!E.fin;
    const gagnant = fautif != null ? 1 - fautif : E.fin ? E.fin.gagnant : null;
    let histo = null;
    if (fini && (opt.moi === 0 || opt.moi === 1) && typeof Historique !== 'undefined') {
      try { histo = Historique.entree(E, opt.moi, opt.meta || {}); } catch (e) { histo = null; }
    }
    return { fini, gagnant, fautif, raison: fautif != null ? raison : E.fin ? E.fin.raison : null, tours: E.tour,
      verdicts: [verdict(E, 0), verdict(E, 1)], histo };
  }

  return { partie, rejouer, verdict, defi, canon };
})();
