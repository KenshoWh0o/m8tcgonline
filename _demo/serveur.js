/* =====================================================================
   Démo autonome — le serveur, simulé dans le navigateur.

   Le jeu ne parle au serveur que par un seul objet : le client Supabase
   (Backend.sb, js/backend.js). Ce fichier en fournit un faux, qui répond
   aux mêmes appels avec les mêmes réponses. Le code du jeu, lui, ne change
   pas d'une ligne : il croit parler à Supabase.

   Chaque fonction ci-dessous est la traduction de sa jumelle SQL, dans
   supabase/ — même nom, mêmes règles, mêmes messages d'erreur. Quand une
   règle change là-bas, elle doit changer ici aussi, sinon la démo ment sur
   le jeu. Le fichier d'origine est cité au-dessus de chaque fonction.

   Tout vit sur l'appareil (IndexedDB, clé « demo-serveur »). Les autres
   joueurs sont simulés : ils acceptent les demandes d'ami, répondent aux
   échanges et en proposent de leur côté (voir « Les joueurs simulés »).

   Ce dossier commence par un souligné : GitHub Pages ne le publie pas. Il
   n'entre que dans le dossier fabriqué par tools/demo.py.
   ===================================================================== */
"use strict";

(() => {
  const D = Object.assign({
    pseudo: 'Visiteur',
    eclats: 6000,
    ticket_minutes: 240
  }, typeof DEMO_REGLAGES === 'object' ? DEMO_REGLAGES : {});

  const CLE = 'demo-serveur';
  const CLE_SESSION = 'mtcg.demo.connecte';
  const MOI = 'moi';

  /* ------------------------------------------------------------ outils */
  const now = () => Date.now();
  const iso = t => new Date(t).toISOString();
  const alea = (a, b) => a + Math.random() * (b - a);
  const choix = l => l[Math.floor(Math.random() * l.length)];
  const uuid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
        const r = Math.random() * 16 | 0;
        return (ch === 'x' ? r : (r & 3 | 8)).toString(16);
      });

  class Refus extends Error {}
  const refuser = m => { throw new Refus(m); };

  /* L'heure de Paris, comme period_key() et checkin() côté serveur. */
  function paris(t) {
    const p = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).forEach(x => { if (x.type !== 'literal') p[x.type] = +x.value; });
    if (p.hour === 24) p.hour = 0;
    return p;
  }
  const deux = n => String(n).padStart(2, '0');
  const jourParis = t => { const p = paris(t); return `${p.year}-${deux(p.month)}-${deux(p.day)}`; };
  const hier = j => { const d = new Date(j + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

  /* Semaine ISO (IYYY-WIW), sur la date de Paris. */
  function semaineParis(t) {
    const p = paris(t);
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const j = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - j + 3);
    const an = d.getUTCFullYear();
    const premier = new Date(Date.UTC(an, 0, 4));
    const n = 1 + Math.round(((d - premier) / 86400000 - 3 + ((premier.getUTCDay() + 6) % 7)) / 7);
    return `${an}-W${deux(n)}`;
  }

  /* Lundi minuit, heure de Paris : debut_semaine(), 12_recyclage.sql. */
  function debutSemaine(t) {
    const p = paris(t);
    const jour = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
    const ecoule = ((jour * 24 + p.hour) * 60 + p.minute) * 60000 + p.second * 1000;
    return t - ecoule - (t % 1000);
  }

  /* ----------------------------------------------- cfg(), 01_schema.sql */
  const CFG = {
    ticket_cap: 5, ticket_minutes: D.ticket_minutes, pack_size: 6, god_odds: 2000,
    trade_cooldown_h: 6, promo_palier_pct: 75,
    recyclage_ES: 1, recyclage_C: 2, recyclage_PC: 5, recyclage_R: 20,
    recyclage_E: 80, recyclage_L: 250,
    fabrication_ES: 20, fabrication_C: 40, fabrication_PC: 100, fabrication_R: 400,
    fabrication_E: 2000, fabrication_L: 8000,
    foil_odds: 50, chasse_odds: 250
  };
  const cfg = k => CFG[k];

  /* ------------------------------------------ quêtes, 04_seed.sql */
  const QUETES = [
    ['d_check',   'daily',     'checkin',        1,   25, null, 'Premier passage',      'Ouvre le jeu aujourd\'hui.', 1],
    ['d_packs',   'daily',     'packs',          5,   50, null, 'Cinq paquets',         'Ouvre 5 boosters.', 2],
    ['d_epic',    'daily',     'rarity_E',       1,   75, null, 'Au moins une Épique',  'Décroche une Épique ou une Légendaire.', 3],
    ['d_new',     'daily',     'new_cards',      3,   40, null, 'Du sang neuf',         'Trouve 3 cartes que tu n\'avais pas.', 4],
    ['d_trade',   'daily',     'trades',         1,   60, null, 'Donnant-donnant',      'Conclus un échange avec un autre joueur.', 5],
    ['w_check',   'weekly',    'checkin',        5,  200, null, 'Habitué de la maison', 'Connecte-toi 5 jours dans la semaine.', 1],
    ['w_packs',   'weekly',    'packs',         30,  260, null, 'Ouvreur en série',     'Ouvre 30 boosters cette semaine.', 2],
    ['w_new',     'weekly',    'new_cards',     15,  320, null, 'Chasseur de vides',    'Trouve 15 cartes inédites.', 3],
    ['w_epic',    'weekly',    'rarity_E',       8,  340, null, 'Huit Épiques',         'Décroche 8 Épiques ou mieux.', 4],
    ['w_legend',  'weekly',    'rarity_L',       1,  420, null, 'Une Légendaire',       'Sors une Légendaire cette semaine.', 5],
    ['w_trade',   'weekly',    'trades',         5,  380, null, 'Le marché',            'Conclus 5 échanges.', 6],
    ['m_legend',  'milestone', 'rarity_L',       1,  500, null, 'Première Légendaire',  'Sors ta toute première Légendaire d\'un booster.', 1],
    ['m_col25',   'milestone', 'collection_pct', 25,  400, null,  'Un quart du chemin', 'Possède 25 % de la collection.', 2],
    ['m_col50',   'milestone', 'collection_pct', 50,  800, null,  'La moitié',          'Possède 50 % de la collection.', 3],
    ['m_col75',   'milestone', 'collection_pct', 75,    0, 'p06', 'Le Marionnettiste',  'Possède 75 % de la collection.', 4],
    ['m_col100',  'milestone', 'collection_pct',100,    0, 'p05', 'Tout Commence Ici',  'Possède les 122 cartes de l\'extension.', 5],
    /* L'objectif `null` des raretés complètes est le total de la rareté,
       calculé sur le catalogue plus bas — comme le `count(*)` du SQL. */
    ['m_setES',   'milestone', 'set_ES',      null,  250, null,      'Toutes les Essences',     'Possède toutes les Essences de l\'extension.', 6],
    ['m_setC',    'milestone', 'set_C',       null,  500, null,      'Toutes les Communes',     'Possède toutes les Communes de l\'extension.', 7],
    ['m_setPC',   'milestone', 'set_PC',      null,  600, null,      'Toutes les Peu communes', 'Possède toutes les Peu communes de l\'extension.', 8],
    ['m_setR',    'milestone', 'set_R',       null, 1500, null,      'Toutes les Rares',        'Possède toutes les Rares de l\'extension.', 9],
    ['m_setE',    'milestone', 'set_E',       null, 3000, null,      'Toutes les Épiques',      'Possède toutes les Épiques de l\'extension.', 10],
    ['m_setL',    'milestone', 'set_L',       null, 6000, null,      'Toutes les Légendaires',  'Possède toutes les Légendaires de l\'extension.', 11],
    ['m_packs25', 'milestone', 'packs',          25,  400, null,      'Vingt-cinq paquets', 'Ouvre 25 boosters en tout.', 12],
    ['m_packs50', 'milestone', 'packs',          50,  800, null,      'Cinquante paquets',  'Ouvre 50 boosters en tout.', 13],
    ['m_packs100','milestone', 'packs',         100, 1500, null,      'Cent paquets',       'Ouvre 100 boosters en tout.', 14],
    ['m_packs200','milestone', 'packs',         200, 2500, null,      'Deux cents paquets', 'Ouvre 200 boosters en tout.', 15],
    ['m_trade25', 'milestone', 'trades',         25,  900, null, 'Négociant',           'Conclus 25 échanges en tout.', 16]
  ].map(([id, scope, metric, goal, reward, item_id, titre, detail, ordre]) =>
    ({ id, scope, metric, goal, reward, item_id, titre, detail, ordre }));

  /* ---------------------------------------- boutique, 04_seed.sql */
  const BOUTIQUE = [
    ['s_pack1',  'boosters',   'x1 Booster',   'Ajoute 1 booster à ta réserve, par-dessus le plafond.',      350, 'tickets',  1, null, false, 1],
    ['s_pack5',  'boosters',   'x5 Boosters',  'Cinq boosters d\'un coup, un peu moins cher à l\'unité.',   1600, 'tickets',  5, null, false, 2],
    ['s_pack10', 'boosters',   'x10 Boosters', 'Le meilleur prix à l\'unité du rayon.',                     3000, 'tickets', 10, null, false, 3],
    ['s_token1', 'echange',    'x1 Jeton d\'échange',   'Lance une demande d\'échange sans attendre la fin du délai.',  600, 'trade_token', 1, null, false, 1],
    ['s_token5', 'echange',    'x5 Jetons d\'échanges', 'Cinq demandes d\'échange immédiates.',                        2500, 'trade_token', 5, null, false, 2],
    ['s_p01',    'promo',      'Carte Promo P01', 'Major de Paris, illustré par Justice Wong & HL. Introuvable en booster.', 5000, 'carte', 1, 'p01', true, 1],
    ['s_p02',    'promo',      'Carte Promo P02', 'Major de Paris, illustration alternative de Rexpo. Introuvable en booster.', 5000, 'carte', 1, 'p02', true, 2],
    ['f_azur',   'cosmetique', 'Cadre Azur',   'Un liseré bleu autour de ton avatar.',                      1200, 'cosmetique', 1, null, true, 1],
    ['f_rose',   'cosmetique', 'Cadre Rose',   'Le rose du logo, autour de ton avatar.',                    1200, 'cosmetique', 1, null, true, 2],
    ['f_or',     'cosmetique', 'Cadre Or',     'Doré, comme les Légendaires.',                              2500, 'cosmetique', 1, null, true, 3],
    ['f_prisme', 'cosmetique', 'Cadre Prisme', 'Un cadre animé qui balaie toutes les essences.',            5000, 'cosmetique', 1, null, true, 4]
  ].map(([id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre]) =>
    ({ id, categ, titre, detail, prix, effet, montant, carte_id, unique_buy, ordre, actif: true }));

  /* Le catalogue : celui du jeu (js/cards-data.js, js/promos-data.js). */
  /* L'objectif d'une rareté complète : le total de la rareté dans le catalogue,
     lu au premier besoin (le catalogue n'existe pas encore quand ce fichier
     se charge). */
  const objectif = q => q.goal != null ? q.goal
    : cards.filter(k => k.rar === q.metric.slice(4)).length;

  const carte = id => byId[id];
  const extension = () => cards;                                  /* 122 cartes, sans les Promos */
  const dansBooster = () => cards.filter(c => c.inBoost !== false);

  /* ================================================================ état */
  let S = null;

  const profil = id => S.profils[id];
  const colDe = id => (S.col[id] = S.col[id] || {});
  const invDe = id => (S.inv[id] = S.inv[id] || {});
  const parPseudo = p => Object.values(S.profils)
    .find(x => x.pseudo.toLowerCase() === String(p || '').trim().toLowerCase());
  const sauver = () => kvSet(CLE, S);

  function nouveauProfil(id, pseudo, champs) {
    return Object.assign({
      id, pseudo, avatar: 'star', frame: 'default', is_admin: false,
      shards: 0, tickets: 5, last_tick: now(), trade_free_at: now(),
      packs_opened: 0, trades_done: 0, streak: 0, last_checkin: null,
      created_at: now(), vitrine: [], boite_vue_le: now(),
      fragments: 0, fabrications: 0, serie_max: 0
    }, champs || {});
  }

  /* ------------------------------------------------------------ outils SQL */
  const ajouter = (uid, cid, n) => { const c = colDe(uid); c[cid] = (c[cid] || 0) + n; };
  const possede = (uid, cid) => (colDe(uid)[cid] || 0) > 0;

  /* regen_tickets, 01_schema.sql */
  function regenTickets(p) {
    const pr = profil(p);
    const step = cfg('ticket_minutes') * 60000;
    if (pr.tickets >= cfg('ticket_cap')) {
      if (pr.last_tick < now()) pr.last_tick = now();
      return pr;
    }
    const gagne = Math.floor((now() - pr.last_tick) / step);
    if (gagne > 0) {
      const t = Math.min(cfg('ticket_cap'), pr.tickets + gagne);
      pr.last_tick = t >= cfg('ticket_cap') ? now() : pr.last_tick + gagne * step;
      pr.tickets = t;
    }
    return pr;
  }

  /* period_key, 01_schema.sql */
  const periode = sc => sc === 'daily' ? jourParis(now()) : sc === 'weekly' ? semaineParis(now()) : 'all';
  const cleQp = (p, q) => `${p}|${q.id}|${periode(q.scope)}`;

  /* bump_quests, 01_schema.sql */
  function bump(p, m, n) {
    if (n <= 0) return;
    QUETES.filter(q => q.metric === m).forEach(q => {
      const k = cleQp(p, q);
      const qp = S.qp[k];
      if (!qp) S.qp[k] = { progress: n, claimed: false };
      else if (!qp.claimed) qp.progress += n;
    });
  }

  /* Le pourcentage de l'extension possédée : sync_collection_quests et
     check_promos font le même calcul. */
  function pctCollection(p) {
    const tout = extension();
    if (!tout.length) return 0;
    const c = colDe(p);
    return Math.floor(tout.filter(k => (c[k.id] || 0) > 0).length * 100 / tout.length);
  }

  /* sync_collection_quests, 01_schema.sql : le pourcentage de collection, et
     pour chaque rareté le nombre de cartes différentes possédées. */
  function syncCollection(p) {
    const pct = pctCollection(p);
    const c = colDe(p);
    const valeur = q => q.metric === 'collection_pct' ? pct
      : extension().filter(k => k.rar === q.metric.slice(4) && (c[k.id] || 0) > 0).length;
    QUETES.filter(q => q.metric === 'collection_pct' || q.metric.startsWith('set_')).forEach(q => {
      const k = `${p}|${q.id}|all`;
      const qp = S.qp[k];
      const v = valeur(q);
      if (!qp) S.qp[k] = { progress: v, claimed: false };
      else qp.progress = Math.max(qp.progress, v);
    });
  }

  /* check_promos, 03b_promos.sql */
  function checkPromos(p) {
    const pct = pctCollection(p);
    if (pct >= cfg('promo_palier_pct') && !possede(p, 'p06')) colDe(p).p06 = 1;
    if (pct >= 100 && !possede(p, 'p05')) colDe(p).p05 = 1;
  }

  /* notifier, 11_boite.sql */
  function notifier(dest, type, acteur, ref, data) {
    S.notifs.push({ id: ++S.seq, user_id: dest, type, acteur, ref: ref || null,
      data: data || {}, created_at: now() });
    if (dest === MOI) S.aSignaler = true;
  }

  /* succes_de, 15_evenements.sql */
  function succesDe(p) {
    const pr = profil(p);
    const c = colDe(p);
    const a = id => (c[id] || 0) > 0;
    const ext = extension().filter(k => a(k.id)).length;
    const leg = extension().filter(k => k.rar === 'L');
    const br = brillantes.filter(k => a(k.id)).length;
    const serie = Math.max(pr.serie_max || 0, pr.streak || 0);
    const s = [];
    if (pr.packs_opened >= 1) s.push('premier_booster');
    if (pr.packs_opened >= 100) s.push('boosters_100');
    if (pr.packs_opened >= 500) s.push('boosters_500');
    if (ext * 2 >= extension().length) s.push('collection_50');
    if (ext >= extension().length) s.push('master_set');
    if (leg.every(k => a(k.id))) s.push('toutes_legendaires');
    if (pr.trades_done >= 1) s.push('premier_echange');
    if (pr.trades_done >= 25) s.push('negociant');
    if (serie >= 7) s.push('serie_7');
    if (serie >= 30) s.push('serie_30');
    if (S.tirages.some(t => t.user_id === p && t.god)) s.push('godpack');
    if (br >= 1) s.push('brillante');
    if (brillantes.length && br >= brillantes.length) s.push('toutes_brillantes');
    if ((pr.fabrications || 0) >= 1) s.push('artisan');
    if (uniques.some(u => a(u.id))) s.push('unique');
    return s;
  }

  /* chasse_etat, 15_evenements.sql */
  const chasseEtat = () => ({ carte: S.chasse.carte, active: S.chasse.active,
    trouvee: !!S.chasse.gagnant, gagnant: S.chasse.gagnant ? profil(S.chasse.gagnant).pseudo : null,
    trouvee_le: S.chasse.trouvee_le ? iso(S.chasse.trouvee_le) : null, ouvre_le: null });

  /* boite_non_lues, 11_boite.sql */
  function boiteNonLues(p) {
    const vue = profil(p).boite_vue_le;
    return S.notifs.filter(n => n.user_id === p && n.created_at > vue).length
      + S.annonces.filter(a => a.actif && a.created_at > vue).length;
  }

  /* ============================================== me(), 07_vitrine.sql */
  function me(p) {
    const pr = regenTickets(p);
    syncCollection(p);
    checkPromos(p);
    const garde = o => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0));
    const ordre = { daily: 0, milestone: 1, weekly: 2 };     /* `order by q.scope` : ordre alphabétique */
    return {
      profil: {
        id: pr.id, pseudo: pr.pseudo, avatar: pr.avatar, frame: pr.frame,
        is_admin: pr.is_admin, shards: pr.shards, tickets: pr.tickets,
        last_tick: iso(pr.last_tick), trade_free_at: iso(pr.trade_free_at),
        packs_opened: pr.packs_opened, trades_done: pr.trades_done,
        streak: pr.streak, last_checkin: pr.last_checkin,
        vitrine: pr.vitrine.slice(),
        fragments: pr.fragments || 0,
        invite: true,
        ticket_cap: cfg('ticket_cap'), ticket_minutes: cfg('ticket_minutes'),
        serveur: iso(now())
      },
      boite: boiteNonLues(p),
      recyclage: {
        valeurs: { ES: cfg('recyclage_ES'), C: cfg('recyclage_C'), PC: cfg('recyclage_PC'),
          R: cfg('recyclage_R'), E: cfg('recyclage_E'), L: cfg('recyclage_L') },
        couts: { ES: cfg('fabrication_ES'), C: cfg('fabrication_C'), PC: cfg('fabrication_PC'),
          R: cfg('fabrication_R'), E: cfg('fabrication_E'), L: cfg('fabrication_L') }
      },
      succes: succesDe(p),
      evenement: null,
      chasse: chasseEtat(),
      col: garde(colDe(p)),
      inv: garde(invDe(p)),
      quetes: QUETES.slice()
        .sort((a, b) => ordre[a.scope] - ordre[b.scope] || a.ordre - b.ordre)
        .map(q => {
          const qp = S.qp[cleQp(p, q)];
          return { id: q.id, scope: q.scope, titre: q.titre, detail: q.detail,
            goal: objectif(q), reward: q.reward, item: q.item_id, metric: q.metric,
            progress: Math.min(qp ? qp.progress : 0, objectif(q)),
            claimed: qp ? qp.claimed : false };
        })
    };
  }

  /* =================================================== les actions (03_rpc) */
  const RPC = {};

  RPC.me = p => me(p);

  /* porte, 01_schema.sql : la démo est toujours ouverte. */
  RPC.porte = () => ({ ouvert: true, lancement: null, serveur: iso(now()) });

  RPC.set_profile = (p, { p_pseudo, p_avatar, p_frame }) => {
    if (p_pseudo != null) {
      if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(p_pseudo))
        refuser('Pseudo invalide : 3 à 16 caractères, lettres, chiffres, . _ -');
      const x = parPseudo(p_pseudo);
      if (x && x.id !== p) refuser('Ce pseudo est déjà pris.');
    }
    if (p_avatar != null && p_avatar.startsWith('card:') && !possede(p, p_avatar.slice(5)))
      refuser('Tu ne possèdes pas cette carte.');
    if (p_frame != null && p_frame !== 'default' && !((invDe(p)[p_frame] || 0) > 0))
      refuser('Cadre non débloqué.');
    const pr = profil(p);
    if (p_pseudo != null) pr.pseudo = p_pseudo;
    if (p_avatar != null) pr.avatar = p_avatar;
    if (p_frame != null) pr.frame = p_frame;
    return me(p);
  };

  RPC.checkin = p => {
    const pr = profil(p);
    const auj = jourParis(now());
    if (pr.last_checkin !== auj) {
      pr.streak = pr.last_checkin === hier(auj) ? pr.streak + 1 : 1;
      pr.last_checkin = auj;
      pr.serie_max = Math.max(pr.serie_max || 0, pr.streak);
      bump(p, 'checkin', 1);
    }
    return me(p);
  };

  /* pick_card, 03_rpc.sql */
  const REPLI = {
    C: ['C', 'PC', 'R', 'E', 'L'], PC: ['PC', 'C', 'R', 'E', 'L'], R: ['R', 'PC', 'E', 'C', 'L'],
    E: ['E', 'R', 'L', 'PC', 'C'], L: ['L', 'E', 'R', 'PC', 'C']
  };
  function pickCard(r) {
    for (const essai of REPLI[r] || REPLI.C) {
      const l = dansBooster().filter(c => c.rar === essai && c.cat !== 'essence');
      if (l.length) return choix(l).id;
    }
    return null;
  }
  const tirage = seuils => { const x = Math.random() * 100; return seuils.find(([s]) => x < s)[1]; };
  /* La case Essence : une fois sur cfg('foil_odds'), la version Brillante. */
  const essence = ess => {
    if (!ess.length) return pickCard('C');
    const e = choix(ess).id;
    return Math.random() < 1 / cfg('foil_odds') && carte('b' + e.slice(1)) ? 'b' + e.slice(1) : e;
  };

  /* Les six cartes d'open_pack, sans rien écrire : sert aussi à garnir la
     collection des joueurs simulés. */
  function tirerPaquet() {
    const god = Math.random() < 1 / cfg('god_odds');
    let ids;
    if (god) {
      ids = [
        pickCard(tirage([[90, 'R'], [100, 'E']])),
        pickCard(tirage([[70, 'R'], [100, 'E']])),
        pickCard(tirage([[50, 'R'], [100, 'E']])),
        pickCard(tirage([[90, 'E'], [100, 'L']])),
        pickCard(tirage([[60, 'E'], [100, 'L']])),
        pickCard('L')
      ];
    } else {
      const ess = dansBooster().filter(c => c.cat === 'essence');
      ids = [
        pickCard('C'), pickCard('C'),
        pickCard(tirage([[60, 'C'], [100, 'PC']])),
        pickCard('PC'),
        essence(ess),
        pickCard(tirage([[80, 'R'], [96, 'E'], [100, 'L']]))
      ];
    }
    return { ids: ids.filter(Boolean), god };
  }

  RPC.open_pack = p => {
    const pr = regenTickets(p);
    if (pr.tickets < 1) refuser('RESERVE_VIDE');
    const { ids, god } = tirerPaquet();
    if (!ids.length) refuser('BOOSTER_VIDE');

    /* La chasse : la carte unique en septième position, une seule fois. */
    if (S.chasse.active && !S.chasse.gagnant && Math.random() < 1 / cfg('chasse_odds')) {
      S.chasse.gagnant = p;
      S.chasse.trouvee_le = now();
      ids.push(S.chasse.carte);
      S.annonces.push({ id: ++S.seq, actif: true, created_at: now(),
        titre: (carte(S.chasse.carte) || {}).nom + ' a été trouvée !',
        texte: pr.pseudo + ' l\'a tirée d\'un booster. Il n\'en existe qu\'une seule dans tout le jeu.' });
    }

    /* Comme le SQL : chaque exemplaire non possédé compte, doublons du même
       paquet compris. */
    const nouvelles = ids.filter(id => !possede(p, id)).length;
    ids.forEach(id => ajouter(p, id, 1));

    pr.last_tick = pr.tickets >= cfg('ticket_cap') ? now() : pr.last_tick;
    pr.tickets -= 1;
    pr.packs_opened += 1;
    S.tirages.push({ user_id: p, cartes: ids.slice(), god, created_at: now() });

    /* `where id = any(ids)` : chaque carte distincte compte une fois. */
    const distinctes = [...new Set(ids)].map(carte).filter(Boolean);
    bump(p, 'packs', 1);
    bump(p, 'new_cards', nouvelles);
    bump(p, 'rarity_R', distinctes.filter(c => ['R', 'E', 'L'].includes(c.rar)).length);
    bump(p, 'rarity_E', distinctes.filter(c => ['E', 'L'].includes(c.rar)).length);
    bump(p, 'rarity_L', distinctes.filter(c => c.rar === 'L').length);
    syncCollection(p);
    checkPromos(p);
    return { cards: ids, god, etat: me(p) };
  };

  RPC.claim_quest = (p, { p_quest }) => {
    const q = QUETES.find(x => x.id === p_quest);
    if (!q) refuser('Quête inconnue.');
    const qp = S.qp[cleQp(p, q)];
    if (qp && qp.claimed) refuser('Récompense déjà récupérée.');
    if ((qp ? qp.progress : 0) < objectif(q)) refuser('Quête non terminée.');
    qp.claimed = true;
    if (q.reward > 0) profil(p).shards += q.reward;
    if (q.item_id) {
      if (carte(q.item_id)) { if (!(q.item_id in colDe(p))) colDe(p)[q.item_id] = 1; }
      else if (!(q.item_id in invDe(p))) invDe(p)[q.item_id] = 1;
    }
    return me(p);
  };

  RPC.shop_buy = (p, { p_item }) => {
    const it = BOUTIQUE.find(x => x.id === p_item && x.actif);
    if (!it) refuser('Article indisponible.');
    const pr = profil(p);
    if (pr.shards < it.prix) refuser('Pas assez d\'Éclats.');
    if (it.unique_buy && it.id in invDe(p)) refuser('Tu possèdes déjà cet article.');
    pr.shards -= it.prix;
    const inv = invDe(p);
    if (it.effet === 'tickets') pr.tickets += it.montant;
    else if (it.effet === 'refill') { pr.tickets = Math.max(pr.tickets, cfg('ticket_cap')); pr.last_tick = now(); }
    else if (it.effet === 'trade_token') inv.trade_token = (inv.trade_token || 0) + it.montant;
    else if (it.effet === 'carte') {
      if (!it.carte_id) refuser('Article mal configuré.');
      ajouter(p, it.carte_id, 1);
      inv[it.id] = (inv[it.id] || 0) + 1;
    } else inv[it.id] = (inv[it.id] || 0) + 1;
    return me(p);
  };

  /* ---------------------------------------------------------- échanges */
  /* rembourser_demande, 03_rpc.sql */
  function rembourser(t) {
    if (t.jeton) { const inv = invDe(t.from_user); inv.trade_token = (inv.trade_token || 0) + 1; }
    else {
      const pr = profil(t.from_user);
      if (pr.trade_free_at > now()) pr.trade_free_at = now();
    }
  }

  /* trade_create, 03_rpc.sql — `p` peut être un joueur simulé. */
  function creerEchange(p, pseudo, offer, want, note) {
    const dest = parPseudo(pseudo);
    if (!dest) refuser('Aucun joueur ne porte ce pseudo.');
    if (dest.id === p) refuser('Tu ne peux pas échanger avec toi-même.');
    const co = carte(offer), cw = carte(want);
    if (!co || !cw) refuser('Carte inconnue.');
    if (co.rar !== cw.rar) refuser('Les deux cartes doivent être de la même rareté.');
    if (co.rar === 'ES') refuser('Les Essences ne s\'échangent pas.');
    if (co.rar === 'PR') refuser('Les cartes Promo ne s\'échangent pas.');
    if (co.promo || cw.promo) refuser('Cette carte ne s\'échange pas.');
    if (!possede(p, offer)) refuser('Tu ne possèdes pas la carte que tu proposes.');
    if (S.trades.some(t => t.from_user === p && t.to_user === dest.id && t.offer_card === offer
      && t.want_card === want && t.status === 'pending')) refuser('Cette demande est déjà en attente.');
    if (S.trades.filter(t => t.from_user === p && t.status === 'pending').length >= 10)
      refuser('Tu as déjà 10 demandes en attente.');

    const pr = profil(p);
    const gratuit = pr.trade_free_at <= now();
    if (gratuit) pr.trade_free_at = now() + cfg('trade_cooldown_h') * 3600000;
    else {
      const inv = invDe(p);
      if (!((inv.trade_token || 0) >= 1)) refuser('ECHANGE_EN_RECHARGE');
      inv.trade_token -= 1;
    }
    const t = { id: uuid(), from_user: p, to_user: dest.id, offer_card: offer, want_card: want,
      note: String(note || '').slice(0, 140), status: 'pending', created_at: now(),
      resolved_at: null, jeton: !gratuit };
    /* Le moment où le joueur simulé répondra : voir « Les joueurs simulés ». */
    if (dest.bot) t.repondre_a = now() + alea(12, 40) * 1000;
    S.trades.push(t);
    notifier(dest.id, 'echange_recu', p, t.id, { offer, want });
    return t;
  }

  RPC.trade_create = (p, { p_pseudo, p_offer, p_want, p_note }) => {
    creerEchange(p, p_pseudo, p_offer, p_want, p_note);
    return me(p);
  };

  /* trade_respond, 03_rpc.sql — `p` peut être un joueur simulé. */
  function repondreEchange(p, id, accepter) {
    const t = S.trades.find(x => x.id === id);
    if (!t) refuser('Demande introuvable.');
    if (t.to_user !== p) refuser('Cette demande ne t\'est pas adressée.');
    if (t.status !== 'pending') refuser('Cette demande est déjà traitée.');
    const d = { offer: t.offer_card, want: t.want_card };

    if (!accepter) {
      t.status = 'declined'; t.resolved_at = now();
      rembourser(t);
      notifier(t.from_user, 'echange_refuse', p, t.id, d);
      return;
    }
    if (!possede(t.from_user, t.offer_card)) refuser('Le demandeur ne possède plus cette carte.');
    if (!possede(p, t.want_card)) refuser('Tu ne possèdes pas la carte demandée.');

    ajouter(t.from_user, t.offer_card, -1);
    ajouter(p, t.want_card, -1);
    ajouter(p, t.offer_card, 1);
    ajouter(t.from_user, t.want_card, 1);

    t.status = 'accepted'; t.resolved_at = now();
    profil(p).trades_done += 1;
    profil(t.from_user).trades_done += 1;
    notifier(t.from_user, 'echange_accepte', p, t.id, d);
    bump(p, 'trades', 1);
    bump(t.from_user, 'trades', 1);
    syncCollection(p);
    syncCollection(t.from_user);
  }

  RPC.trade_respond = (p, { p_trade, p_accept }) => {
    repondreEchange(p, p_trade, !!p_accept);
    return me(p);
  };

  RPC.trade_cancel = (p, { p_trade }) => {
    const t = S.trades.find(x => x.id === p_trade);
    if (!t || t.from_user !== p) refuser('Demande introuvable.');
    if (t.status !== 'pending') refuser('Cette demande est déjà traitée.');
    t.status = 'cancelled'; t.resolved_at = now();
    rembourser(t);
    return me(p);
  };

  RPC.trade_list = p => S.trades
    .filter(t => (t.from_user === p || t.to_user === p)
      && (t.status === 'pending' || t.resolved_at > now() - 7 * 86400000))
    .sort((a, b) => b.created_at - a.created_at)
    .map(t => {
      const moi = t.from_user === p;
      const o = profil(moi ? t.to_user : t.from_user);
      return { id: t.id, sens: moi ? 'envoyee' : 'recue', pseudo: o.pseudo, avatar: o.avatar,
        photo: null, offer: t.offer_card, want: t.want_card, note: t.note, status: t.status,
        created_at: iso(t.created_at), possible: possede(p, moi ? t.offer_card : t.want_card) };
    });

  RPC.find_player = (p, { p_pseudo }) => {
    const r = parPseudo(p_pseudo);
    return r ? { pseudo: r.pseudo, avatar: r.avatar, frame: r.frame, photo: null } : null;
  };

  /* ------------------------------------------------ amis, 06_social.sql */
  const paire = (x, y) => S.amities.find(f => (f.a === x && f.b === y) || (f.a === y && f.b === x));

  function listeAmis(moi) {
    return S.amities.filter(f => f.a === moi || f.b === moi)
      .map(f => {
        const o = profil(f.a === moi ? f.b : f.a);
        return {
          pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, photo: null,
          is_admin: o.is_admin, streak: o.streak,
          lien: f.accepte ? 'ami' : f.demandeur === moi ? 'envoyee' : 'recue',
          depuis: iso(f.resolved_at || f.created_at),
          echanges: S.trades.filter(t => t.status === 'pending'
            && ((t.from_user === moi && t.to_user === o.id) || (t.from_user === o.id && t.to_user === moi))).length
        };
      })
      .sort((a, b) => (a.lien === 'ami') - (b.lien === 'ami') || a.pseudo.localeCompare(b.pseudo));
  }

  /* friend_request — `moi` peut être un joueur simulé. */
  function demanderAmi(moi, pseudo) {
    const autre = parPseudo(pseudo);
    if (!autre) refuser('Aucun joueur ne porte ce pseudo.');
    if (autre.id === moi) refuser('Tu ne peux pas t\'ajouter toi-même.');
    const f = paire(moi, autre.id);
    if (f) {
      if (f.accepte) refuser('Vous êtes déjà amis.');
      if (f.demandeur !== moi) {
        f.accepte = true; f.resolved_at = now();
        notifier(autre.id, 'ami_accepte', moi);
        return;
      }
      refuser('Ta demande est déjà en attente.');
    }
    if (S.amities.filter(x => x.demandeur === moi && !x.accepte).length >= 25)
      refuser('Tu as déjà 25 demandes en attente.');
    const n = { a: moi, b: autre.id, demandeur: moi, accepte: false, created_at: now(), resolved_at: null };
    if (autre.bot) n.repondre_a = now() + alea(6, 20) * 1000;
    S.amities.push(n);
    S.notifs = S.notifs.filter(x => !(x.user_id === autre.id && x.acteur === moi && x.type === 'ami_demande'));
    notifier(autre.id, 'ami_demande', moi);
  }

  RPC.friend_request = (p, { p_pseudo }) => { demanderAmi(p, p_pseudo); return listeAmis(p); };

  RPC.friend_respond = (p, { p_pseudo, p_accept }) => {
    const autre = parPseudo(p_pseudo);
    if (!autre) refuser('Joueur introuvable.');
    const f = paire(p, autre.id);
    if (!f || f.accepte) refuser('Aucune demande en attente.');
    if (f.demandeur === p) refuser('C\'est toi qui as fait cette demande.');
    if (p_accept) {
      f.accepte = true; f.resolved_at = now();
      notifier(autre.id, 'ami_accepte', p);
    } else S.amities = S.amities.filter(x => x !== f);
    return listeAmis(p);
  };

  RPC.friend_remove = (p, { p_pseudo }) => {
    const autre = parPseudo(p_pseudo);
    if (!autre) refuser('Joueur introuvable.');
    const f = paire(p, autre.id);
    S.amities = S.amities.filter(x => x !== f);
    return listeAmis(p);
  };

  RPC.friend_list = p => listeAmis(p);

  /* player_profile, 07_vitrine.sql */
  RPC.player_profile = (moi, { p_pseudo }) => {
    const o = parPseudo(p_pseudo);
    if (!o) return null;
    const ami = o.id === moi || !!(paire(moi, o.id) || {}).accepte;
    const c = colDe(o.id);
    return {
      pseudo: o.pseudo, avatar: o.avatar, frame: o.frame, photo: null,
      is_admin: o.is_admin, streak: o.streak,
      packs_opened: o.packs_opened, trades_done: o.trades_done,
      membre_depuis: iso(o.created_at),
      possede: extension().filter(k => (c[k.id] || 0) > 0).length,
      total: extension().length,
      vitrine: o.vitrine.slice(),
      succes: succesDe(o.id),
      ami, moi: o.id === moi,
      col: ami ? Object.fromEntries(Object.entries(c).filter(([, n]) => n > 0)) : null
    };
  };

  RPC.set_vitrine = (p, { p_cards }) => {
    const l = p_cards || [];
    if (l.length > 4) refuser('Quatre cartes au maximum.');
    const propre = [];
    l.forEach(c => {
      if (propre.includes(c)) return;
      if (!possede(p, c)) refuser('Tu ne possèdes pas une des cartes choisies.');
      propre.push(c);
    });
    profil(p).vitrine = propre;
    return me(p);
  };

  /* ------------------------------------------ boite, 11_boite.sql */
  RPC.boite = p => {
    S.notifs = S.notifs.filter(n => !(n.user_id === p && n.created_at < now() - 30 * 86400000));
    return {
      vue_le: iso(profil(p).boite_vue_le),
      serveur: iso(now()),
      items: S.notifs.filter(n => n.user_id === p).sort((a, b) => b.id - a.id).slice(0, 50).map(n => {
        const o = n.acteur ? profil(n.acteur) : null;
        const t = n.type.startsWith('echange') ? S.trades.find(x => x.id === n.ref) : null;
        const f = n.type === 'ami_demande' ? paire(p, n.acteur) : null;
        return {
          id: 'n' + n.id, type: n.type, quand: iso(n.created_at), ref: n.ref, data: n.data,
          pseudo: o && o.pseudo, avatar: o && o.avatar, frame: o && o.frame, photo: null,
          en_attente: n.type === 'ami_demande' ? !!(f && !f.accepte && f.demandeur === n.acteur)
            : n.type === 'echange_recu' ? !!(t && t.status === 'pending') : false,
          statut: n.type === 'echange_recu' && t ? t.status : null
        };
      }),
      annonces: S.annonces.filter(a => a.actif).sort((a, b) => b.id - a.id).slice(0, 10)
        .map(a => ({ id: 'a' + a.id, num: a.id, titre: a.titre, texte: a.texte, quand: iso(a.created_at) }))
    };
  };

  RPC.boite_lue = p => { profil(p).boite_vue_le = now(); return { vue_le: iso(now()) }; };

  RPC.annonce_publier = () => refuser('Réservé aux administrateurs.');
  RPC.annonce_retirer = () => refuser('Réservé aux administrateurs.');

  /* ------------------------------------ classement, 14_classement.sql */
  RPC.classement = (moi, { p_critere }) => {
    if (!['collection', 'boosters', 'echanges', 'serie'].includes(p_critere)) refuser('Classement inconnu.');
    const auj = jourParis(now());
    const valeur = pr => p_critere === 'collection'
      ? extension().filter(k => (colDe(pr.id)[k.id] || 0) > 0).length
      : p_critere === 'boosters' ? pr.packs_opened
      : p_critere === 'echanges' ? pr.trades_done
      : (pr.last_checkin === auj || pr.last_checkin === hier(auj)) ? pr.streak : 0;
    const l = Object.values(S.profils).map(pr => ({ pr, valeur: valeur(pr) }))
      .filter(x => x.valeur > 0)
      .sort((a, b) => b.valeur - a.valeur || a.pr.pseudo.toLowerCase().localeCompare(b.pr.pseudo.toLowerCase()));
    const ligne = x => ({ rang: 1 + l.filter(y => y.valeur > x.valeur).length, pseudo: x.pr.pseudo,
      avatar: x.pr.avatar, frame: x.pr.frame, photo: null, valeur: x.valeur, moi: x.pr.id === moi });
    const m = l.find(x => x.pr.id === moi);
    return { critere: p_critere, classes: l.length, top: l.slice(0, 50).map(ligne), moi: m ? ligne(m) : null };
  };

  /* ------------------------------------ recycler, 12_recyclage.sql */
  RPC.recycler = (p, { p_lots }) => {
    if (!Array.isArray(p_lots) || !p_lots.length) refuser('Rien à recycler.');
    if (p_lots.length > 150) refuser('Trop de cartes d\'un coup.');
    /* Tout passe, ou rien : on travaille sur une copie. */
    const col = Object.assign({}, colDe(p));
    const journal = [];
    const vus = [];
    let total = 0;
    p_lots.forEach(lot => {
      const cid = lot && lot.carte;
      if (typeof (lot && lot.n) !== 'number') refuser('Quantité invalide.');
      const n = Math.trunc(lot.n);
      if (!cid || n < 1) refuser('Quantité invalide.');
      if (vus.includes(cid)) refuser('Une carte apparaît deux fois.');
      vus.push(cid);
      const k = carte(cid);
      if (!k) refuser('Carte inconnue.');
      if (k.promo) refuser('Cette carte ne se recycle pas.');
      const prix = cfg('recyclage_' + k.rar);
      if (prix == null) refuser('Cette carte ne se recycle pas.');
      const reserve = S.trades.filter(t => t.from_user === p && t.offer_card === cid && t.status === 'pending').length;
      if ((col[cid] || 0) - 1 - reserve < n)
        refuser(`Pas assez de doublons de « ${k.nom} » : tu gardes toujours un exemplaire.`);
      col[cid] -= n;
      journal.push({ user_id: p, card_id: cid, qty: n, eclats: 0, fragments: n * prix, created_at: now() });
      total += n * prix;
    });
    S.col[p] = col;
    S.recyclages.push(...journal);
    profil(p).fragments = (profil(p).fragments || 0) + total;
    return me(p);
  };

  /* fabriquer, 12_recyclage.sql */
  RPC.fabriquer = (p, { p_carte }) => {
    const k = carte(p_carte);
    if (!k) refuser('Carte inconnue.');
    if (k.promo) refuser('Cette carte ne se fabrique pas.');
    const cout = cfg('fabrication_' + k.rar);
    if (cout == null) refuser('Cette carte ne se fabrique pas.');
    if (possede(p, p_carte)) refuser('Tu possèdes déjà cette carte.');
    const pr = profil(p);
    if ((pr.fragments || 0) < cout) refuser('Pas assez de Fragments.');
    pr.fragments -= cout;
    pr.fabrications = (pr.fabrications || 0) + 1;
    colDe(p)[p_carte] = 1;
    syncCollection(p);
    checkPromos(p);
    return me(p);
  };

  /* mes_tirages, 15_evenements.sql */
  RPC.mes_tirages = p => {
    const miens = S.tirages.filter(t => t.user_id === p);
    const raretes = {};
    miens.forEach(t => t.cartes.forEach(id => {
      const k = carte(id);
      if (k) raretes[k.rar] = (raretes[k.rar] || 0) + 1;
    }));
    return {
      total: miens.length,
      god: miens.filter(t => t.god).length,
      depuis: miens.length ? iso(miens[0].created_at) : null,
      raretes,
      liste: miens.slice(-30).reverse().map(t => ({ quand: iso(t.created_at), cartes: t.cartes, god: t.god }))
    };
  };

  /* =================================================== Les joueurs simulés
     Quatre joueurs, pour que l'onglet Social vive :
       · Lumen et Mira sont déjà tes amis ;
       · Kairo t'envoie une demande d'ami peu après ton arrivée ;
       · Nova.92 n'attend que toi : cherche son pseudo pour l'ajouter.
     Ils acceptent les demandes d'ami, répondent aux échanges (ils refusent
     quand la carte demandée leur manque, et parfois simplement parce qu'ils
     y tiennent), et leurs amis te proposent des échanges de temps en temps.
     Tout se décide dans vivre(), appelé à chaque action et toutes les
     quelques secondes. */
  const BOTS = [
    { id: 'b_lumen', pseudo: 'Lumen',   frame: 'f_or',     paquets: 70,  jours: 34, serie: 12, ami: true },
    { id: 'b_mira',  pseudo: 'Mira',    frame: 'f_rose',   paquets: 32,  jours: 18, serie: 5,  ami: true },
    { id: 'b_kairo', pseudo: 'Kairo',   frame: 'f_azur',   paquets: 24,  jours: 9,  serie: 3,  ami: false },
    { id: 'b_nova',  pseudo: 'Nova.92', frame: 'f_prisme', paquets: 150, jours: 40, serie: 40, ami: false }
  ];

  function creerMonde() {
    const t0 = now();
    S = { v: 1, seq: 0, debut: t0, profils: {}, col: {}, inv: {}, qp: {}, amities: [], trades: [],
      notifs: [], annonces: [], recyclages: [], prochaineOffre: t0 + 75000, kairo: t0 + 25000,
      tirages: [], chasse: { carte: 'u01', active: true, gagnant: null, trouvee_le: null } };

    S.profils[MOI] = nouveauProfil(MOI, D.pseudo, { shards: D.eclats });

    const couleurs = Object.keys(typeof COLORS === 'object' ? COLORS : {}).filter(k => k !== 'neutre');
    BOTS.forEach((b, i) => {
      S.profils[b.id] = nouveauProfil(b.id, b.pseudo, {
        bot: true, frame: b.frame, streak: b.serie, created_at: t0 - b.jours * 86400000,
        last_checkin: jourParis(t0), trades_done: Math.floor(b.paquets / 9)
      });
      for (let n = 0; n < b.paquets; n++) {
        tirerPaquet().ids.forEach(id => ajouter(b.id, id, 1));
        profil(b.id).packs_opened += 1;
      }
      checkPromos(b.id);
      /* Un avatar tiré de sa propre collection, ou un symbole d'essence. */
      const siennes = Object.keys(colDe(b.id)).map(carte).filter(c => c && !c.promo && c.cat !== 'essence');
      const belles = siennes.filter(c => ['R', 'E', 'L'].includes(c.rar));
      profil(b.id).avatar = i % 2 === 0 && belles.length
        ? 'card:' + choix(belles).id
        : 'ess:' + (couleurs[i % Math.max(1, couleurs.length)] || 'rose');
      profil(b.id).vitrine = siennes.slice()
        .sort((x, y) => RAR[y.rar].rank - RAR[x.rar].rank).slice(0, 4).map(c => c.id);
      if (b.ami) S.amities.push({ a: b.id, b: MOI, demandeur: b.id, accepte: true,
        created_at: t0 - 86400000, resolved_at: t0 - 86400000 });
    });

    S.annonces.push({ id: ++S.seq, actif: true, created_at: t0,
      titre: 'Bienvenue dans la démo',
      texte: 'Tout se passe sur cet appareil : ta collection, tes Éclats et tes quêtes y sont '
        + 'enregistrés. Les autres joueurs sont simulés — Lumen et Mira sont déjà tes amis, '
        + 'Kairo ne va pas tarder à se manifester, et Nova.92 attend que tu l\'ajoutes. Ils '
        + 'répondent tout seuls à tes demandes d\'ami et d\'échange.' });
  }

  /* Une offre d'un ami simulé : il veut une carte que tu as en double, et
     propose en échange une carte de même rareté qu'il a en double et que tu
     n'as pas — de quoi faire avancer ta collection sans la faire reculer.
     Il préfère une carte qui lui manque ; à défaut, une qu'il n'a qu'en un
     exemplaire. Sans candidat, il repasse plus tard. */
  function proposerEchange(bot) {
    const moi = colDe(MOI), lui = colDe(bot.id);
    const ok = (id, r) => carte(id) && carte(id).rar === r && !carte(id).promo && carte(id).cat !== 'essence';
    for (const r of ['R', 'PC', 'C', 'E']) {
      const doublons = Object.keys(moi).filter(id => moi[id] >= 2 && ok(id, r));
      const manque = doublons.filter(id => !(lui[id] > 0));
      const veut = manque.length ? manque : doublons.filter(id => !(lui[id] > 1));
      const donne = Object.keys(lui).filter(id => lui[id] >= 2 && ok(id, r) && !(moi[id] > 0));
      if (veut.length && donne.length) {
        profil(bot.id).trade_free_at = 0;                /* un joueur simulé n'attend pas */
        creerEchange(bot.id, profil(MOI).pseudo, choix(donne), choix(veut),
          choix(['Elle me manque pour finir la série !', 'Ça te dit ?', '', 'Je cherche celle-là depuis des jours.']));
        return true;
      }
    }
    return false;
  }

  function vivre() {
    const t = now();
    let change = false;

    /* Les joueurs simulés passent tous les jours : leur série continue. */
    const auj = jourParis(t);
    BOTS.forEach(b => {
      const pr = profil(b.id);
      if (pr.last_checkin === auj) return;
      pr.streak = pr.last_checkin === hier(auj) ? pr.streak + 1 : 1;
      pr.last_checkin = auj;
    });

    /* Les demandes d'ami adressées à un joueur simulé. */
    S.amities.forEach(f => {
      if (f.accepte || !f.repondre_a || f.repondre_a > t) return;
      const bot = profil(f.a === f.demandeur ? f.b : f.a);
      if (!bot.bot) return;
      f.accepte = true; f.resolved_at = t; delete f.repondre_a;
      notifier(f.demandeur, 'ami_accepte', bot.id);
      change = true;
    });

    /* Les échanges proposés à un joueur simulé. Il accepte trois fois sur
       quatre s'il a la carte ; sinon il refuse, comme le ferait n'importe qui.
       Le tout premier échange proposé, lui, passe toujours quand c'est
       possible : c'est celui qui montre ce que fait l'onglet. */
    S.trades.forEach(tr => {
      if (tr.status !== 'pending' || !tr.repondre_a || tr.repondre_a > t) return;
      delete tr.repondre_a;
      const faisable = possede(tr.to_user, tr.want_card) && possede(tr.from_user, tr.offer_card);
      const ok = faisable && (!S.premierConclu || Math.random() < 0.75);
      try { repondreEchange(tr.to_user, tr.id, ok); } catch (e) { repondreEchange(tr.to_user, tr.id, false); }
      if (ok) S.premierConclu = true;
      change = true;
    });

    /* Kairo demande à devenir ton ami, une fois. */
    if (S.kairo && t >= S.kairo) {
      S.kairo = 0;
      try { demanderAmi('b_kairo', profil(MOI).pseudo); change = true; } catch (e) { /* déjà amis */ }
    }

    /* De temps en temps, un ami simulé te propose un échange — jamais plus de
       deux en attente à la fois. */
    if (t >= S.prochaineOffre) {
      const attente = S.trades.filter(x => x.to_user === MOI && x.status === 'pending').length;
      const amis = BOTS.filter(b => (paire(MOI, b.id) || {}).accepte);
      let fait = false;
      /* Dans le désordre : celui qui a de quoi proposer se manifeste. */
      if (attente < 2) fait = amis.sort(() => Math.random() - .5).some(proposerEchange);
      S.prochaineOffre = t + (fait ? alea(6, 12) * 60000 : 60000);
      change = change || fait;
    }
    return change;
  }

  /* ======================================================= le faux client */
  let pret = null;
  const ecouteurs = [];

  function charger() {
    if (!pret) {
      pret = (async () => {
        if (/[?&]reinitialiser\b/.test(location.search)) {
          await kvSet(CLE, null);
          try { history.replaceState(null, '', location.pathname); } catch (e) { /* sans gravité */ }
        }
        S = await kvGet(CLE);
        if (!S || S.v !== 1) { creerMonde(); await sauver(); }
        /* Une démo commencée avant la version 1.5 : ce qui lui manque. */
        S.tirages = S.tirages || [];
        S.chasse = S.chasse || { carte: 'u01', active: true, gagnant: null, trouvee_le: null };
      })();
    }
    return pret;
  }

  /* Ce qui arrive des joueurs simulés est poussé comme le ferait le temps
     réel de Supabase (Backend.ecouterBoite). Un échange conclu change aussi la
     collection : on la relit, sinon la carte reçue n'apparaîtrait qu'à la
     prochaine action. */
  function signaler() {
    if (!S.aSignaler) return;
    S.aSignaler = false;
    ecouteurs.forEach(f => { try { f(); } catch (e) { /* un écouteur de moins */ } });
    relire();
  }

  /* Pas pendant une ouverture ni une scène de Promo : l'écran appartient aux
     cartes (ecranOccupe, js/app.js). On repasse un peu plus tard. */
  function relire() {
    if (typeof Backend !== 'object' || Backend.mode !== 'cloud' || !save) return;
    if (typeof ecranOccupe === 'function' && ecranOccupe()) return void setTimeout(relire, 3000);
    Backend.pull().then(() => { if (typeof majDiscrete === 'function') majDiscrete(true); }).catch(() => {});
  }

  async function appeler(nom, args) {
    await charger();
    const f = RPC[nom];
    if (!f) return { data: null, error: { message: 'Fonction inconnue : ' + nom } };
    if (!session() && nom !== 'porte') return { data: null, error: { message: 'non connecte' } };
    /* Tout passe, ou rien : une copie de l'état, remise en place si refus. */
    const avant = JSON.stringify(S);
    try {
      vivre();
      const data = f(MOI, args || {});
      await sauver();
      /* Une réponse du « réseau » n'est jamais instantanée : le jeu a des
         transitions qui comptent dessus. */
      await new Promise(r => setTimeout(r, 60 + Math.random() * 90));
      setTimeout(signaler, 400);
      return { data: data === undefined ? null : JSON.parse(JSON.stringify(data)), error: null };
    } catch (e) {
      S = JSON.parse(avant);
      if (!(e instanceof Refus)) console.error('[démo]', nom, e);
      return { data: null, error: { message: e.message || 'Le serveur a refusé.' } };
    }
  }

  setInterval(async () => {
    if (!S || !session()) return;
    if (vivre()) { await sauver(); signaler(); }
  }, 4000);

  /* La session : « connecté » tant qu'on ne s'est pas déconnecté. */
  const session = () => {
    try { if (localStorage.getItem(CLE_SESSION) === '0') return null; } catch (e) { /* mode privé */ }
    return { access_token: 'demo', user: { id: MOI, email: '', user_metadata: {} } };
  };

  function requete(table) {
    let lignes = table === 'shop_items' ? BOUTIQUE.slice() : [];
    const q = {
      select() { return q; },
      eq(k, v) { lignes = lignes.filter(l => l[k] === v); return q; },
      order(k) {
        /* Tri stable : le second `order` départage le premier. */
        const cles = q._cles = (q._cles || []).concat(k);
        lignes.sort((a, b) => { for (const c of cles) { if (a[c] < b[c]) return -1; if (a[c] > b[c]) return 1; } return 0; });
        return q;
      },
      then(ok, ko) { return Promise.resolve({ data: JSON.parse(JSON.stringify(lignes)), error: null }).then(ok, ko); }
    };
    return q;
  }

  const client = {
    rpc: appeler,
    from: requete,
    channel() {
      const c = {
        on(evt, filtre, f) { if (typeof f === 'function' && !ecouteurs.includes(f)) ecouteurs.push(f); return c; },
        subscribe() { return c; }
      };
      return c;
    },
    auth: {
      async getSession() { await charger(); return { data: { session: session() } }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithOAuth() {
        try { localStorage.setItem(CLE_SESSION, '1'); } catch (e) { /* mode privé */ }
        location.reload();
        return { error: null };
      },
      async signOut() {
        try { localStorage.setItem(CLE_SESSION, '0'); } catch (e) { /* mode privé */ }
        return { error: null };
      },
      async signUp() { return { data: {}, error: { message: 'signups not allowed' } }; },
      async signInWithPassword() { return { error: { message: 'signups not allowed' } }; },
      async resetPasswordForEmail() { return { error: null }; },
      async resend() { return { error: null }; }
    }
  };

  window.supabase = { createClient: () => client };
})();
