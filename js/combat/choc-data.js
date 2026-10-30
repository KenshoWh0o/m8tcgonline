/* Le Raid, et l'événement de la version 3.0, « Le Choc des Sections ».

   Le Raid (RAID) : un boss commun à tout le serveur, pour deux semaines —
   un « raid » (une « saison » en base : raid_saisons…). Depuis la version
   3.0.11, ils se comptent depuis le premier jour du Choc des Sections : le
   raid 1 (The French Sorcerer) commence avec lui, le raid 2 (Le
   Marionnettiste) quatorze jours plus tard, une semaine avant la fin de
   l'événement, puis les deux boss alternent. Avant, ils se comptaient depuis
   le 12 octobre 2026 : le premier raid du Choc s'appelait « saison 2 ».
   Chaque raid, le boss a six phases : chaque PV que les joueurs lui
   prennent en combat s'ajoute aux dégâts de tout le serveur, et chaque
   palier de dégâts atteint abat une phase — tous ceux qui ont combattu dans
   le raid ouvrent alors son coffre commun. En plus, des paliers personnels
   (les dégâts de chacun). Une fois les six phases abattues (si le serveur y
   arrive), le mode Infini : un palier par joueur, qui monte à chaque
   victoire, pour le classement. Trois tentatives par jour. Au raid suivant,
   tout recommence. Pendant le Choc, il paie en Étincelles ; sinon, en Éclats.

   L'événement (CHOC) ajoute l'Épreuve du jour : le même combat pour tout le
   monde — les mêmes deux decks imposés, la même donne, une règle du jour.
   Trois essais, le meilleur compte, et un classement du jour. Une Épreuve
   par jour de l'événement, numérotée de 1 à 21 (version 3.0.11), et un
   calendrier des règles sur les trois semaines (CHOC.epreuve.calendrier).

   Ce fichier est lu par la page et par le serveur de démo
   (_demo/serveur.js). Le serveur réel en a la copie dans
   supabase/installation/25_choc.sql et 27_raid.sql : ils doivent rester d'accord. */
"use strict";

const RAID = {
  /* Les boss, un par raid, à tour de rôle (raid_boss, 27_raid.sql) :
     - The French Sorcerer (#116), Légendaire Mauve : ses éclairs renvoient
       les Joueurs sur le Banc et frappent à 200 ;
     - Le Marionnettiste (#121, version 3.0.11), Légendaire Neutre : il tire
       les ficelles (Coup de fil, 160) et riposte quand il tombe.
     `couleur` : celle du boss dans son deck (une seconde change chaque
     jour ; un boss Neutre en prend deux) ; `visage` : le point de
     l'illustration gardé au centre (illuCadre) ; `cadre` et `tapis` : ce
     qu'il porte en combat (le tapis d'un boss : TAPIS ou TAPIS_BOSS,
     js/combat/table.js). */
  bosses: [
    { id: 'c116', nom: 'The French Sorcerer', couleur: 'mauve', visage: [.46, .24], cadre: 'f_foudre', tapis: 't_orage',
      dit: 'Ses éclairs renvoient tes Joueurs sur le Banc et frappent à 200.' },
    { id: 'c121', nom: 'Le Marionnettiste', couleur: 'neutre', visage: [.45, .58], cadre: 'f_choc', tapis: 't_ficelles',
      dit: 'Il joue les couleurs des autres, deux nouvelles chaque jour, frappe à 160, et riposte quand il tombe.' }
  ],
  /* Le premier boss (avant la 3.0.11, le seul). */
  boss: 'c116',
  nom: 'The French Sorcerer',
  tentatives: 3,
  /* Un raid dure `jours` jours. Le premier commence le jour où commence le
     Choc des Sections (raid_ancre, 27_raid.sql) ; sans Choc, le lundi
     `depart`. */
  saison: { jours: 14, depart: '2026-10-12' },
  /* Les six phases. `seuil` : les dégâts cumulés de tout le serveur dans la
     saison pour l'abattre — calculés pour une dizaine de joueurs, et
     multipliés sur le vrai serveur par parametres.raid_echelle. Puis le
     combat (le niveau de l'IA, les PV du boss, ses Essences d'avance) et le
     coffre commun. */
  phases: [
    { seuil: 120, ia: 2, pv: 5, ess: 0, commun: { type: 'boosters', montant: 2, titre: '2 boosters' } },
    { seuil: 300, ia: 3, pv: 6, ess: 0, commun: { type: 'fragments', montant: 300, titre: '300 Fragments' } },
    { seuil: 550, ia: 3, pv: 7, ess: 1, commun: { type: 'boosters', montant: 3, titre: '3 boosters' } },
    { seuil: 850, ia: 4, pv: 7, ess: 1, commun: { type: 'eclats', montant: 500, titre: '500 Éclats' } },
    { seuil: 1200, ia: 4, pv: 8, ess: 2, commun: { type: 'boosters', montant: 4, titre: '4 boosters' } },
    { seuil: 1600, ia: 5, pv: 9, ess: 2, commun: { type: 'boosters', montant: 5, titre: '5 boosters' } }
  ],
  /* Les paliers personnels de la saison : les dégâts de chacun. */
  perso: [
    { seuil: 30, type: 'boosters', montant: 1, titre: '1 booster' },
    { seuil: 80, type: 'fragments', montant: 300, titre: '300 Fragments' },
    { seuil: 150, type: 'boosters', montant: 2, titre: '2 boosters' }
  ],
  /* Le mode Infini, palier n : le boss a plus de PV et d'Essences, puis c'est
     toi qui as moins de PV. Chaque victoire fait monter d'un palier. */
  infini: n => {
    const k = Math.max(1, n);
    return { ia: 5, pvBoss: Math.min(12, 9 + k), ess: Math.min(3, 2 + Math.floor(k / 3)), pvMoi: Math.max(2, 5 - Math.floor(Math.max(0, k - 3) / 2)) };
  },
  /* Ce que rapporte un combat : par PV pris, et s'il tombe (+ bonusDegats
     dégâts). Pendant le Choc, en Étincelles ; sinon, en Éclats. */
  parDegat: 3, victoire: 15, bonusDegats: 3,
  parDegatEclats: 2, victoireEclats: 15
};

/* Le combat d'une clé : 'p3' (la phase 3) ou 'i5' (l'Infini, palier 5). */
function raidCombat(cle) {
  const s = String(cle || 'p1');
  const n = Math.max(1, parseInt(s.slice(1), 10) || 1);
  if (s[0] === 'i') return Object.assign({ infini: true, n }, RAID.infini(n));
  const ph = RAID.phases[Math.min(n, RAID.phases.length) - 1];
  return { infini: false, n, ia: ph.ia, pvBoss: ph.pv, ess: ph.ess, pvMoi: 5 };
}

/* Le raid (la saison) du jour `j` ('2026-10-20'), à partir de l'ancre (le
   premier jour du Choc ; RAID.saison.depart sans lui) : son numéro, son
   premier jour, le premier jour du suivant, et son boss. Avant l'ancre,
   c'est le premier (raid_saison, 27_raid.sql). */
function raidSaison(j, ancre) {
  const d0 = Date.parse((ancre || RAID.saison.depart) + 'T12:00:00Z');
  const jn = Math.floor((Date.parse(j + 'T12:00:00Z') - d0) / 86400000);
  const n = Math.max(1, Math.floor(jn / RAID.saison.jours) + 1);
  const jour = k => new Date(d0 + k * RAID.saison.jours * 86400000).toISOString().slice(0, 10);
  return { n, debut: jour(n - 1), fin: jour(n), boss: raidBoss(n).id };
}
/* Le boss du raid `n` (ou d'un identifiant de carte) : à tour de rôle. */
function raidBoss(n) {
  if (typeof n === 'string') return RAID.bosses.find(b => b.id === n) || RAID.bosses[0];
  return RAID.bosses[chocMod(Math.max(1, n || 1) - 1, RAID.bosses.length)];
}

const CHOC = {
  nom: 'Le Choc des Sections',
  /* La monnaie de l'événement (evt_comptes, comme les Prismes de Reflets). */
  monnaie: { nom: 'Étincelles', un: 'Étincelle' },

  epreuve: {
    essais: 3,
    /* Chaque essai rapporte `participation` ; la première victoire du jour,
       `victoire` en plus. */
    participation: 5,
    victoire: 25,
    ia: 3,
    /* Une règle par jour, à tour de rôle. `pv` et `ess` : [toi, l'adversaire]. */
    regles: [
      { id: 'eclair', nom: 'Combat éclair', texte: 'Trois PV chacun : la moindre ouverture est fatale.', pv: [3, 3], ess: [0, 0] },
      { id: 'siege', nom: 'Le siège', texte: 'L\'adversaire a 7 PV. Toi, tu commences avec 2 Essences en jeu.', pv: [5, 7], ess: [2, 0] },
      { id: 'renforts', nom: 'Renforts', texte: 'Les deux camps commencent avec une Essence en jeu.', pv: [5, 5], ess: [1, 1] },
      { id: 'miroir', nom: 'Le miroir', texte: 'Les deux camps jouent le même deck.', pv: [5, 5], ess: [0, 0], miroir: true },
      { id: 'outsider', nom: 'L\'outsider', texte: 'Tu as 4 PV, l\'adversaire 6 et une Essence d\'avance.', pv: [4, 6], ess: [0, 1] },
      { id: 'marathon', nom: 'Marathon', texte: 'Sept PV chacun : une partie longue, où chaque carte compte.', pv: [7, 7], ess: [0, 0] },
      { id: 'classique', nom: 'Classique', texte: 'Les règles normales, rien de plus.', pv: [5, 5], ess: [0, 0] }
    ],
    /* Les trois semaines de l'événement, jour par jour (version 3.0.11) :
       chaque semaine a les sept règles, dans un ordre à elle ; jamais la
       même règle deux jours de suite, ni le même jour de la semaine d'une
       semaine à l'autre. La première Épreuve est « Classique », pour
       apprendre. Hors de ces 21 jours (un événement plus long), la règle
       tourne avec la date (regleEpreuve). Les decks, eux, changent chaque
       jour avec la graine du serveur. */
    calendrier: [
      'classique', 'renforts', 'siege', 'miroir', 'eclair', 'outsider', 'marathon',
      'siege', 'eclair', 'marathon', 'classique', 'renforts', 'miroir', 'outsider',
      'renforts', 'marathon', 'outsider', 'eclair', 'miroir', 'classique', 'siege'
    ]
  }
};

/* Les couleurs du deck d'un boss, le jour `j`. Le Sorcier joue Mauve (ses
   attaques en demandent deux), avec une seconde couleur qui change chaque
   jour — la liste et l'ordre d'avant la 3.0.11, pour que ses decks ne
   changent pas. Un boss Neutre (le Marionnettiste : ses attaques prennent
   n'importe quelle Essence) « joue les couleurs des autres » : chaque jour,
   une couleur assez fournie pour porter un deck (celles de tirerCouleurs,
   js/combat/decks.js), et une seconde. */
const CHOC_ALLIES = ['violette', 'azur', 'rose', 'jaune', 'bleue', 'orange', 'verte', 'jade', 'mauve'];
const CHOC_FORTES = ['rose', 'orange', 'violette', 'mauve', 'bleue', 'azur', 'verte'];
function chocCouleurs(j, boss) {
  const b = raidBoss(boss || RAID.boss);
  const k = chocJourN(j);
  if (b.couleur !== 'neutre') {
    const allies = CHOC_ALLIES.filter(c => c !== b.couleur);
    return [b.couleur, allies[chocMod(k, allies.length)]];
  }
  const a = CHOC_FORTES[chocMod(k, CHOC_FORTES.length)];
  const reste = CHOC_ALLIES.filter(c => c !== a);
  return [a, reste[chocMod(k * 3 + 1, reste.length)]];
}

/* Le numéro d'un jour ('2026-10-11' → nombre de jours depuis le 1er janvier
   2026). Le serveur réel fait le même calcul (choc_jour, 25_choc.sql). */
function chocJourN(j) {
  return Math.round((Date.parse(j + 'T12:00:00Z') - Date.parse('2026-01-01T12:00:00Z')) / 86400000);
}
const chocMod = (n, m) => ((n % m) + m) % m;

/* Le deck du boss `boss` (le Sorcier par défaut), le jour `j`, pour la clé
   `cle` (la phase ou le palier Infini) : un deck tiré au sort dans ses deux
   couleurs du jour, avec le boss dedans — il commence la partie déjà sur le
   plateau (`posesBoss`). Le Sorcier garde exactement la graine d'avant. */
function deckBoss(j, cle, boss) {
  const b = raidBoss(boss || RAID.boss);
  const couleurs = chocCouleurs(j, b.id);
  const c = raidCombat(cle);
  const sel = b.id === 'c116' ? 0 : Number(b.id.slice(1)) * 977;
  const r = aleaGraine(0x3c6ef372 ^ (chocJourN(j) * 31 + c.n * (c.infini ? 7 : 1) + (c.infini ? 1000 : 0) + sel));
  const d = Decks.aleatoire(r, { niveau: Math.min(5, c.ia + 1), couleurs, nom: b.nom });
  imposerCarte(d, b.id, couleurs[0], r);
  d.couverture = b.id;
  return d;
}
const deckSorcier = (j, cle) => deckBoss(j, cle, 'c116');
/* Le boss au milieu de ses trois lignes, dès le début. */
const posesBoss = boss => [[], [{ id: raidBoss(boss || RAID.boss).id, ligne: 1 }]];

/* La règle de l'Épreuve du jour `j`, le `n`-ième jour de l'événement
   (choc_etat › n) : celle du calendrier ; sans `n`, ou au-delà, une par jour
   à tour de rôle. Seule, sans les decks, pour l'accueil de l'événement
   (js/choc.js). */
function regleEpreuve(j, n) {
  const l = CHOC.epreuve.regles, cal = CHOC.epreuve.calendrier;
  const id = n >= 1 && n <= cal.length ? cal[n - 1] : null;
  return (id && l.find(x => x.id === id)) || l[chocMod(chocJourN(j), l.length)];
}

/* L'Épreuve du jour `j` (le `n`-ième de l'événement) : sa règle, et les
   deux decks imposés. La graine du jour vient du serveur (choc_etat) ; tout
   le reste s'en déduit. */
function epreuveDuJour(j, graine, n) {
  const regle = regleEpreuve(j, n);
  const moi = Decks.aleatoire(aleaGraine(graine ^ 0x1b873593), { niveau: 3, nom: 'Deck imposé' });
  const adv = regle.miroir ? JSON.parse(JSON.stringify(moi))
    : Decks.aleatoire(aleaGraine(graine ^ 0x85ebca6b), { niveau: 3, nom: 'L\'adversaire du jour' });
  adv.nom = 'L\'adversaire du jour';
  return { regle, moi, adv };
}

/* Le score d'un essai, pour comparer : la victoire d'abord ; entre deux
   victoires, le moins de tours puis le plus de PV gardés ; entre deux
   défaites, le plus de PV pris à l'adversaire. Plus grand = meilleur. */
function scoreEpreuve(s) {
  if (!s) return 0;
  const b = x => Math.max(0, Math.min(99, x || 0));
  return s.gagne ? 100000 + (100 - b(s.tours)) * 100 + b(s.pv) : b(s.touches) * 100 + b(s.pv);
}
