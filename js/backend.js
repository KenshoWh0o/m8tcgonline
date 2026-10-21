/* Couche d'accès aux données : un seul jeu d'appels pour l'interface, deux
   implantations derrière. Hors ligne, tout se passe dans IndexedDB comme en v1.
   Connecté, chaque action passe par une fonction du serveur (supabase/03_rpc.sql),
   la seule à pouvoir toucher aux boosters, à la collection et aux échanges. */
"use strict";

const Backend = {
  /* 'local' : sauvegarde dans le navigateur. 'cloud' : compte en ligne. */
  mode: 'local',
  /* Vrai dès que Supabase est configuré, même sans être connecté. */
  dispo: false,
  sb: null,
  session: null,
  /* Écart entre l'horloge du téléphone et celle du serveur, en millisecondes. */
  skew: 0,
  trades: [],
  amis: [],
  shop: [],
  /* La boite de réception : `null` tant qu'on ne l'a pas lue une fois. */
  boite: null,
  /* La photo du compte Discord, relue à chaque session : l'avatar « discord »
     suit donc les changements faits sur Discord, sans rien stocker chez nous. */
  photoDiscord: null,
  /* Une session existe, mais le serveur n'a pas répondu au démarrage. */
  panne: false,
  ready: false
};

/* Convertit un horodatage du serveur en repère local, décalage d'horloge compris :
   les comptes à rebours restent justes même si la montre du téléphone est fausse. */
const srvTime = iso => Date.parse(iso) + Backend.skew;

/* ================================================================== Démarrage */
Backend.init = async function () {
  const configure = typeof SUPABASE_URL === 'string' && SUPABASE_URL.startsWith('http')
    && typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 20;

  if (!configure || !window.supabase) {
    Backend.mode = 'local';
    await Backend.loadLocal();
    Backend.ready = true;
    return;
  }

  Backend.dispo = true;
  Backend.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const { data } = await Backend.sb.auth.getSession();
  Backend.session = data ? data.session : null;
  Backend.lirePhotoDiscord();

  Backend.sb.auth.onAuthStateChange((evt, sess) => {
    const avant = !!Backend.session;
    Backend.session = sess;
    if (evt === 'SIGNED_OUT' && avant) location.reload();
    if (evt === 'SIGNED_IN' && !avant) location.reload();
  });

  if (Backend.session) {
    Backend.mode = 'cloud';
    try {
      await Backend.pull();
    } catch (e) {
      /* Le serveur ne répond pas. Plus de repli hors ligne : on revient à la
         porte d'entrée, qui propose de réessayer (voir vAuth, js/auth.js). */
      console.warn('Serveur injoignable :', e);
      Backend.mode = 'local';
      Backend.panne = true;
      authErr = 'Le serveur ne répond pas pour le moment. Réessaie dans un instant.';
      await Backend.loadLocal();
    }
  } else {
    await Backend.loadLocal();
  }
  Backend.ready = true;
};

/* ============================================================ Mode hors ligne */
Backend.lirePhotoDiscord = function () {
  const m = Backend.session && Backend.session.user && Backend.session.user.user_metadata;
  const url = m && (m.avatar_url || m.picture);
  Backend.photoDiscord = typeof url === 'string' && url.startsWith('http') ? url : null;
};

Backend.loadLocal = async function () {
  save = (await kvGet('save2')) || defaultSave();
  if (!save.col) save.col = {};
  save.shards = save.shards || 0;
  save.inv = save.inv || {};
  save.quetes = [];
  save.vitrine = save.vitrine || [];
  save.favoris = save.favoris || [];
  save.pseudo = save.pseudo || 'Invité';
  save.avatar = save.avatar || 'star';
  save.frame = save.frame || 'default';
  save.isAdmin = false;
  Object.keys(save.col).forEach(id => { if (!byId[id]) delete save.col[id]; });
  if (!save.purged) { save.purged = true; purgeLegacy(); }
  await persist();
};

/* ======================================================= Mode compte en ligne */
/* Range la réponse de me() dans l'état que l'interface connaît déjà. */
Backend.apply = function (etat) {
  const p = etat.profil;

  /* L'avancement des quêtes et l'arrivée d'une carte Promo n'arrivent que par
     là. On garde l'état précédent le temps de repérer ce qui vient de changer :
     c'est le seul moment où on peut le savoir, puisque `save` est remplacé
     juste en dessous. */
  const quetesAvant = save && Array.isArray(save.quetes) ? save.quetes : null;
  const colAvant = save && save.col ? save.col : null;
  Backend.skew = Date.now() - Date.parse(p.serveur);
  TICKET_CAP = p.ticket_cap;
  INTERVAL = p.ticket_minutes * 60 * 1000;

  save = {
    /* L'identifiant du compte. Il ne sert qu'à savoir si on a déjà accueilli
       cette personne sur cet appareil (js/bienvenue.js). */
    id: p.id,
    tickets: p.tickets,
    /* Les boosters en plus (boutique, cadeaux) : hors réserve, ils s'ouvrent à
       part sans toucher au compte à rebours (open_pack, supabase/03_rpc.sql). */
    bonus: p.boosters_bonus || 0,
    lastTick: srvTime(p.last_tick),
    unlimited: false,
    col: etat.col || {},
    inv: etat.inv || {},
    shards: p.shards,
    /* Ce que rapporte le recyclage, et ce que coûte une carte fabriquée
       (supabase/12_recyclage.sql). */
    fragments: p.fragments || 0,
    quetes: etat.quetes || [],
    pseudo: p.pseudo,
    avatar: p.avatar,
    frame: p.frame,
    isAdmin: !!p.is_admin,
    /* Avant l'ouverture : le serveur dit si ce compte a accès. C'est la seule
       réponse qu'il accorde à un compte qui ne l'a pas — toutes les autres
       actions sont refusées (garde_beta, supabase/01_schema.sql).
       `=== true` et non `!== false` : un champ absent — une base pas encore
       à jour, une réponse tronquée — valait « invité ». Dans le doute, on
       n'ouvre pas. */
    invite: p.invite === true,
    tradeFreeAt: srvTime(p.trade_free_at),
    packsOpened: p.packs_opened,
    tradesDone: p.trades_done,
    /* La date de la dernière visite comptée, au format du serveur. Elle évite
       de redemander un pointage déjà fait — voir visiteDuJourFaite(). */
    lastCheckin: p.last_checkin,
    streak: p.streak,
    vitrine: p.vitrine || [],
    /* Les nouveautés de la boite de réception, pour la cloche de l'en-tête
       tant que la boite elle-même n'est pas chargée (js/boite.js). */
    boiteNonLues: etat.boite || 0,
    /* Le recyclage et la fabrication : ce que rapporte chaque rareté en
       Fragments, et ce que coûte une carte (supabase/12_recyclage.sql). */
    recyclage: etat.recyclage || null,
    /* Les succès obtenus, l'événement en cours et la chasse à la carte unique
       (supabase/15_evenements.sql). */
    succes: etat.succes || [],
    evenement: etat.evenement || null,
    /* Version 2.0 : un événement fini depuis moins de trois jours, et son récap. */
    recap: etat.recap || null,
    chasse: etat.chasse || null,
    /* Version 2.0 (supabase/21_reflets.sql) : le titre, la bannière et la
       devise du profil, les titres débloqués, les réglages ouverts à la main
       (fabrication des Reverses), les Prismes de l'événement en cours et les
       invitations achetées. */
    titre: p.titre || null,
    banniere: p.banniere || null,
    devise: p.devise || '',
    titres: p.titres || [],
    parametres: etat.parametres || {},
    prismes: etat.prismes || 0,
    invitations: etat.invitations || [],
    /* Version 2.1 (supabase/22_garder.sql) : les exemplaires à garder, par
       rareté et carte par carte. */
    garder: p.garder || {},
    gardes: etat.gardes || {},
    favoris: etat.favoris || [],
    /* Version 2.1 : entré grâce au code d'un autre, il n'invite pas à son tour. */
    filleul: p.filleul === true
  };
  /* Une carte retirée du jeu ne doit plus apparaître dans la collection affichée. */
  Object.keys(save.col).forEach(id => { if (!byId[id]) delete save.col[id]; });

  signalerQuetes(quetesAvant, save.quetes);
  signalerPromos(colAvant, save.col);
};

/* Appelle une fonction du serveur et remonte un message lisible en cas de refus. */
Backend.rpc = async function (nom, args) {
  const { data, error } = await Backend.sb.rpc(nom, args || {});
  if (error) {
    const brut = String(error.message || '').replace(/^.*?:\s*/, '').trim();
    const e = new Error(MSG_SERVEUR[brut] || brut || 'Le serveur a refusé.');
    e.code = brut;
    throw e;
  }
  return data;
};

/* Les refus que le serveur signale par un mot-clé, traduits pour le joueur. */
const MSG_SERVEUR = {
  BETA_FERMEE: "Le jeu n'est pas encore ouvert.",
  PLAFOND_RECYCLAGE: 'Ça dépasse ton plafond de recyclage de la semaine.',
  RESERVE_VIDE: 'Plus de booster pour le moment.',
  BONUS_VIDE: 'Plus de booster en plus à ouvrir.',
  BOOSTER_VIDE: 'Ce booster est vide : aucune carte à tirer.',
  ECHANGE_EN_RECHARGE: 'Ton échange gratuit est encore en recharge. Il te faut un jeton.',
  'non connecte': 'Tu dois être connecté pour faire ça.'
};

Backend.pull = async function () {
  Backend.apply(await Backend.rpc('me'));
};

Backend.checkin = async function () {
  Backend.apply(await Backend.rpc('checkin'));
};

/* ================================================================= Les actions */
/* Un booster. Hors ligne le tirage se fait ici, en ligne c'est le serveur qui
   tire et qui décompte : ni la réserve ni le contenu ne sont négociables. */
Backend.openPack = async function (opts) {
  opts = opts || {};

  if (Backend.mode === 'cloud' && !opts.test) {
    const r = await Backend.rpc('open_pack', opts.bonus ? { p_bonus: true } : {});
    Backend.apply(r.etat);
    return { cards: r.cards.map(id => byId[id]).filter(Boolean), god: r.god };
  }

  const pool = poolFor();
  if (!pool.some(c => c.cat !== 'essence')) throw new Error('Ce booster est vide : aucune carte à tirer.');
  if (opts.bonus && !opts.test) {
    if (!(save.bonus > 0)) throw new Error('Plus de booster en plus à ouvrir.');
  } else if (!opts.test && !save.unlimited && save.tickets < 1) throw new Error('Plus de booster pour le moment.');

  if (opts.bonus && !opts.test) save.bonus--;
  else if (!opts.test && !save.unlimited) {
    if (save.tickets >= TICKET_CAP) save.lastTick = Date.now();
    save.tickets--;
  }

  const god = opts.god != null ? opts.god : Math.random() < GOD;
  const drawn = makeBooster(pool, god);
  if (opts.force && !god) {
    const c = pickFrom(pool, opts.force);
    if (c) drawn[drawn.length - 1] = c;
  }
  /* Labo : l'Essence sort Brillante, ou la carte unique prend la place de la
     dernière carte — comme open_pack() les place. */
  if (opts.brillante) {
    const i = drawn.findIndex(c => c.cat === 'essence');
    const b = i >= 0 && byId['b' + drawn[i].id.slice(1)];
    if (b) drawn[i] = b;
  }
  if (opts.unique && uniques[0]) drawn[drawn.length - 1] = uniques[0];
  /* Labo : la Reverse de la 5ᵉ carte sort Rare. */
  if (opts.reverseR && !god) {
    const r = reverses.filter(c => c.rar === 'R');
    if (r.length) drawn[4] = rnd(r);
  }
  if (!opts.test) {
    drawn.forEach(c => save.col[c.id] = (save.col[c.id] || 0) + 1);
    await persist();
  }
  return { cards: drawn, god };
};

/* Version 2.1 : le cœur posé sur une carte. Hors ligne, il reste dans le
   navigateur, comme le reste. */
Backend.favori = async function (id, on) {
  if (Backend.mode !== 'cloud') {
    save.favoris = (save.favoris || []).filter(x => x !== id).concat(on ? [id] : []);
    return persist();
  }
  save.favoris = await Backend.rpc('favori', { p_carte: id, p_on: !!on }) || [];
};

/* Version 2.1 : combien d'exemplaires garder, d'une carte (`null` : celui
   de sa rareté) ou de chaque rareté (supabase/22_garder.sql). */
Backend.reglerGarde = async (id, n) =>
  Backend.apply(await Backend.rpc('regler_garder', { p_carte: id, p_n: n }));
Backend.reglerGardeDefaut = async garder =>
  Backend.apply(await Backend.rpc('regler_garder_defaut', { p_garder: garder }));

Backend.setProfile = async function (champs) {
  if (Backend.mode !== 'cloud') {
    if (champs.p_pseudo) save.pseudo = champs.p_pseudo;
    if (champs.p_avatar) save.avatar = champs.p_avatar;
    if (champs.p_frame) save.frame = champs.p_frame;
    await persist();
    return;
  }
  Backend.apply(await Backend.rpc('set_profile', {
    p_pseudo: champs.p_pseudo ?? null,
    p_avatar: champs.p_avatar ?? null,
    p_frame: champs.p_frame ?? null
  }));
};

Backend.setVitrine = async cartes => Backend.apply(await Backend.rpc('set_vitrine', { p_cards: cartes }));

Backend.claimQuest = async id => Backend.apply(await Backend.rpc('claim_quest', { p_quest: id }));
Backend.buy = async id => Backend.apply(await Backend.rpc('shop_buy', { p_item: id }));

Backend.loadShop = async function () {
  if (Backend.mode !== 'cloud') return [];
  const { data, error } = await Backend.sb.from('shop_items')
    .select('*').eq('actif', true).order('categ').order('ordre');
  if (error) throw error;
  Backend.shop = data || [];
  return Backend.shop;
};

/* Ce qui arrive des autres joueurs n'est plus deviné ici en comparant deux
   listes : le serveur l'écrit dans la boite de réception, et c'est elle qui
   l'annonce (js/boite.js). */
Backend.loadTrades = async function () {
  if (Backend.mode !== 'cloud') return [];
  Backend.trades = await Backend.rpc('trade_list') || [];
  return Backend.trades;
};

Backend.findPlayer = pseudo => Backend.rpc('find_player', { p_pseudo: pseudo });

/* ---- Amis ---- */
Backend.loadAmis = async function () {
  if (Backend.mode !== 'cloud') return [];
  Backend.amis = await Backend.rpc('friend_list') || [];
  return Backend.amis;
};

Backend.amiDemander = async p => { Backend.amis = await Backend.rpc('friend_request', { p_pseudo: p }) || []; };
Backend.amiRepondre = async (p, ok) => { Backend.amis = await Backend.rpc('friend_respond', { p_pseudo: p, p_accept: !!ok }) || []; };
Backend.amiRetirer = async p => { Backend.amis = await Backend.rpc('friend_remove', { p_pseudo: p }) || []; };
Backend.ficheJoueur = p => Backend.rpc('player_profile', { p_pseudo: p });

Backend.tradeCreate = async function (pseudo, offer, want, note) {
  Backend.apply(await Backend.rpc('trade_create',
    { p_pseudo: pseudo, p_offer: offer, p_want: want, p_note: note || '' }));
  await Backend.loadTrades();
};

Backend.tradeRespond = async function (id, accepter) {
  Backend.apply(await Backend.rpc('trade_respond', { p_trade: id, p_accept: !!accepter }));
  await Backend.loadTrades();
};

Backend.tradeCancel = async function (id) {
  Backend.apply(await Backend.rpc('trade_cancel', { p_trade: id }));
  await Backend.loadTrades();
};

/* ---- Boite de réception (supabase/11_boite.sql) ---- */
Backend.loadBoite = async function () {
  if (Backend.mode !== 'cloud') return null;
  Backend.boite = await Backend.rpc('boite');
  return Backend.boite;
};

Backend.boiteLue = async function () {
  const r = await Backend.rpc('boite_lue');
  if (Backend.boite && r) Backend.boite.vue_le = r.vue_le;
  if (save) save.boiteNonLues = 0;
};

Backend.annoncePublier = async (titre, texte) => {
  Backend.boite = await Backend.rpc('annonce_publier', { p_titre: titre, p_texte: texte });
};
Backend.annonceRetirer = async id => {
  Backend.boite = await Backend.rpc('annonce_retirer', { p_id: id });
};

/* Le temps réel : une ligne qui arrive dans la boite est poussée tout de
   suite, au lieu d'attendre la prochaine relève. S'il ne répond pas, la relève
   régulière prend le relais — on ne dépend jamais de lui. */
Backend.ecouterBoite = function (surNouveau) {
  if (Backend.mode !== 'cloud' || Backend.canalBoite || !Backend.sb.channel) return;
  const moi = Backend.session && Backend.session.user && Backend.session.user.id;
  if (!moi) return;
  try {
    Backend.canalBoite = Backend.sb.channel('boite-' + moi)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + moi },
        () => surNouveau())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'annonces' },
        () => surNouveau())
      .subscribe();
  } catch (e) {
    Backend.canalBoite = null;
  }
};

/* ---- Fabrication et historique (supabase/12_recyclage.sql, 15_evenements.sql) ---- */
Backend.fabriquer = async carte => Backend.apply(await Backend.rpc('fabriquer', { p_carte: carte }));
Backend.mesTirages = () => Backend.rpc('mes_tirages');

/* ---- Version 2.0 (supabase/21_reflets.sql) ---- */
Backend.evenementEtat = () => Backend.rpc('evenement_etat');
Backend.pisteReclamer = async palier => {
  const r = await Backend.rpc('piste_reclamer', { p_palier: palier });
  Backend.apply(r.etat);
  return r.cartes || [];
};
Backend.illuEtat = () => Backend.rpc('illu_etat');
/* L'Échauffement (supabase/22b_echauffement.sql). */
Backend.echEtat = () => Backend.rpc('ech_etat');
Backend.echJouer = async (jour, equipe) => {
  const r = await Backend.rpc('ech_jouer', { p_jour: jour, p_equipe: equipe });
  Backend.apply(r.me);
  return r;
};
Backend.illuEssai = async id => {
  const r = await Backend.rpc('illu_essai', { p_carte: id });
  Backend.apply(r.etat);
  return r.illu;
};
Backend.personnaliser = async (titre, banniere, devise) =>
  Backend.apply(await Backend.rpc('personnaliser', { p_titre: titre ?? null, p_banniere: banniere ?? null, p_devise: devise ?? null }));
Backend.utiliserInvitation = async code => Backend.apply(await Backend.rpc('utiliser_invitation', { p_code: code }));

/* ---- Cadeaux (supabase/18_cadeaux.sql) ---- */
Backend.mesCadeaux = () => Backend.rpc('mes_cadeaux');
Backend.ouvrirCadeau = async id => Backend.apply(await Backend.rpc('ouvrir_cadeau', { p_id: id }));
Backend.adminJoueurs = () => Backend.rpc('admin_joueurs');
Backend.offrirCadeau = c => Backend.rpc('offrir_cadeau', {
  p_joueurs: c.joueurs, p_eclats: c.eclats || 0, p_boosters: c.boosters || 0,
  p_fragments: c.fragments || 0, p_carte: c.carte || null, p_message: c.message || ''
});

/* ---- Classement (supabase/14_classement.sql) ---- */
Backend.classement = critere => Backend.rpc('classement', { p_critere: critere });

/* ---- Recyclage (supabase/12_recyclage.sql) ---- */
Backend.recycler = async lots =>
  Backend.apply(await Backend.rpc('recycler', { p_lots: lots }));

/* ==================================================================== Comptes */
Backend.signUp = async function (email, motdepasse, pseudo) {
  const { data, error } = await Backend.sb.auth.signUp({
    email, password: motdepasse,
    options: { data: { pseudo }, emailRedirectTo: retourURL() }
  });
  if (error) throw new Error(traduireAuth(error.message));
  /* Session absente = Supabase attend la confirmation de l'adresse. */
  return { confirmation: !data.session };
};

Backend.signIn = async function (email, motdepasse) {
  const { error } = await Backend.sb.auth.signInWithPassword({ email, password: motdepasse });
  if (error) throw new Error(traduireAuth(error.message));
};

Backend.signInDiscord = async function () {
  const { error } = await Backend.sb.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: retourURL(), scopes: 'identify email' }
  });
  if (error) throw new Error(traduireAuth(error.message));
};

Backend.resetPassword = async function (email) {
  const { error } = await Backend.sb.auth.resetPasswordForEmail(email, { redirectTo: retourURL() });
  if (error) throw new Error(traduireAuth(error.message));
};

Backend.resendConfirmation = async function (email) {
  const { error } = await Backend.sb.auth.resend({ type: 'signup', email,
    options: { emailRedirectTo: retourURL() } });
  if (error) throw new Error(traduireAuth(error.message));
};

Backend.signOut = async function () {
  await Backend.sb.auth.signOut();
};

/* L'adresse où revenir après un détour par Discord.
   En développement — sur la machine locale ou sur une adresse de test — on revient
   là d'où l'on vient, sinon impossible d'essayer la connexion ailleurs que sur le
   site en ligne. Partout ailleurs, l'adresse officielle : ça évite qu'un visiteur
   arrivé par www. ou par l'ancienne adresse GitHub reste coincé dessus. */
function retourURL() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    || location.hostname.endsWith('.github.io');
  if (SITE_URL && !local) return SITE_URL + '/';
  return location.origin + location.pathname;
}

const AUTH_FR = [
  [/invalid login credentials/i, 'Adresse ou mot de passe incorrect.'],
  [/email not confirmed/i, "Ton adresse n'est pas encore confirmée : regarde tes courriels."],
  [/user already registered|already been registered/i, 'Un compte existe déjà avec cette adresse.'],
  [/password should be at least (\d+)/i, 'Mot de passe trop court : $1 caractères au minimum.'],
  [/unable to validate email|invalid email/i, 'Cette adresse e-mail ne semble pas valide.'],
  [/for security purposes|rate limit|too many requests/i, 'Trop de tentatives : attends une minute.'],
  [/provider is not enabled/i, "La connexion Discord n'est pas activée sur le serveur."],
  [/signups not allowed|signup is disabled/i, 'Les inscriptions sont fermées pour le moment.']
];

function traduireAuth(m) {
  for (const [re, fr] of AUTH_FR) if (re.test(m)) return m.replace(re, fr);
  return m;
}
