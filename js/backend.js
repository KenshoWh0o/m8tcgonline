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
  shop: [],
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
      /* Le serveur ne répond pas : on ne perd pas la partie, on passe hors ligne. */
      console.warn('Serveur injoignable, repli hors ligne :', e);
      Backend.mode = 'local';
      await Backend.loadLocal();
      toast('Serveur injoignable : tu joues hors ligne pour le moment.');
    }
  } else {
    await Backend.loadLocal();
  }
  Backend.ready = true;
};

/* ============================================================ Mode hors ligne */
Backend.loadLocal = async function () {
  save = (await kvGet('save2')) || defaultSave();
  if (!save.col) save.col = {};
  save.shards = save.shards || 0;
  save.inv = save.inv || {};
  save.quetes = [];
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
  Backend.skew = Date.now() - Date.parse(p.serveur);
  TICKET_CAP = p.ticket_cap;
  INTERVAL = p.ticket_minutes * 60 * 1000;

  save = {
    tickets: p.tickets,
    lastTick: srvTime(p.last_tick),
    unlimited: false,
    col: etat.col || {},
    inv: etat.inv || {},
    shards: p.shards,
    quetes: etat.quetes || [],
    pseudo: p.pseudo,
    avatar: p.avatar,
    frame: p.frame,
    isAdmin: !!p.is_admin,
    tradeFreeAt: srvTime(p.trade_free_at),
    packsOpened: p.packs_opened,
    tradesDone: p.trades_done,
    streak: p.streak
  };
  /* Une carte retirée du jeu ne doit plus apparaître dans la collection affichée. */
  Object.keys(save.col).forEach(id => { if (!byId[id]) delete save.col[id]; });
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
  RESERVE_VIDE: 'Plus de booster pour le moment.',
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
    const r = await Backend.rpc('open_pack');
    Backend.apply(r.etat);
    return { cards: r.cards.map(id => byId[id]).filter(Boolean), god: r.god };
  }

  const pool = poolFor();
  if (!pool.some(c => c.cat !== 'essence')) throw new Error('Ce booster est vide : aucune carte à tirer.');
  if (!opts.test && !save.unlimited && save.tickets < 1) throw new Error('Plus de booster pour le moment.');

  if (!opts.test && !save.unlimited) {
    if (save.tickets >= TICKET_CAP) save.lastTick = Date.now();
    save.tickets--;
  }

  const god = opts.god != null ? opts.god : Math.random() < GOD;
  const drawn = makeBooster(pool, god);
  if (opts.force && !god) {
    const c = pickFrom(pool, opts.force);
    if (c) drawn[drawn.length - 1] = c;
  }
  if (!opts.test) {
    drawn.forEach(c => save.col[c.id] = (save.col[c.id] || 0) + 1);
    await persist();
  }
  return { cards: drawn, god };
};

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

Backend.loadTrades = async function () {
  if (Backend.mode !== 'cloud') return [];
  Backend.trades = await Backend.rpc('trade_list') || [];
  return Backend.trades;
};

Backend.findPlayer = pseudo => Backend.rpc('find_player', { p_pseudo: pseudo });

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

/* L'adresse où revenir après un courriel de confirmation ou un détour par Discord. */
function retourURL() {
  if (SITE_URL) return SITE_URL + '/';
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
