/* Version 3.0 : l'XP et le niveau de combattant.

   Chaque combat fini rapporte de l'XP, sans limite par jour : c'est la
   récompense de ceux qui jouent beaucoup, quand les Éclats des combats,
   eux, s'arrêtent à cinq victoires récompensées par jour. Une victoire
   rapporte plus qu'une défaite, un adversaire plus fort aussi. Chaque
   niveau atteint paie quelques Éclats ; certains paient plus (boosters,
   cadres, titres). Il n'y a pas de niveau maximum.

   Ce fichier est lu par la page et par le serveur de démo
   (_demo/serveur.js). Le serveur réel en a la copie dans
   supabase/26_niveaux.sql : les deux doivent rester d'accord. L'équilibrage
   est expliqué dans docs/economie-3.0.md. */
"use strict";

const NIVEAUX = {
  /* L'XP d'un combat contre l'IA (campagne, Arcade, Raid, Épreuve),
     multipliée selon la difficulté (1 à 5 étoiles), plus un peu par Joueur
     adverse vaincu. Un défi entre amis a ses propres montants. Un combat de
     moins de 20 secondes ne rapporte rien ; une défaite, seulement si la
     partie a duré `toursDefaite` tours (sinon, abandonner tout de suite
     rapporterait plus vite que jouer). */
  victoire: 50,
  defaite: 20,
  toursDefaite: 6,
  facteur: [1, 0.6, 0.8, 1, 1.25, 1.5],
  parVaincu: 4,
  maxVaincus: 6,
  defi: { victoire: 80, defaite: 35 },
  /* Chaque niveau atteint paie ces Éclats ; certains paliers ajoutent une
     récompense. Après le niveau 50, tous les cinq niveaux : deux boosters. */
  eclats: 50,
  paliers: {
    3: { boosters: 1 },
    5: { boosters: 2, titre: 't_bagarreur' },
    10: { boosters: 2, cadre: 'f_niv10' },
    15: { boosters: 3 },
    20: { cadre: 'f_niv20', titre: 't_veteran_arene' },
    25: { fragments: 500 },
    30: { boosters: 3, cadre: 'f_niv30' },
    40: { boosters: 5, titre: 't_maitre_arene' },
    50: { cadre: 'f_niv50', titre: 't_legende_arene' }
  },
  apres50: { tous: 5, boosters: 2 }
};

/* L'XP qu'il faut pour passer du niveau `n` au suivant : 100 au début,
   25 de plus à chaque niveau, jamais plus de 1 100. */
const xpRequis = n => Math.min(100 + 25 * (n - 1), 1100);

/* Le niveau d'un total d'XP : { niveau, dans (XP dans le niveau), requis }. */
function niveauDe(xp) {
  let n = 1, reste = Math.max(0, Math.floor(xp || 0));
  while (reste >= xpRequis(n)) { reste -= xpRequis(n); n++; }
  return { niveau: n, dans: reste, requis: xpRequis(n) };
}

/* L'XP d'un combat. `mode` : 'defi' ou un mode contre l'IA ; `etoiles` : la
   difficulté (1 à 5) ; `vaincus` : les Joueurs adverses vaincus ; `tours` :
   la durée de la partie. */
function xpCombat(mode, etoiles, gagne, vaincus, tours) {
  if (!gagne && (tours | 0) < NIVEAUX.toursDefaite) return 0;
  const v = Math.min(NIVEAUX.maxVaincus, Math.max(0, vaincus | 0)) * NIVEAUX.parVaincu;
  if (mode === 'defi') return (gagne ? NIVEAUX.defi.victoire : NIVEAUX.defi.defaite) + v;
  const f = NIVEAUX.facteur[Math.max(1, Math.min(5, etoiles | 0))];
  return Math.round((gagne ? NIVEAUX.victoire : NIVEAUX.defaite) * f) + v;
}

/* Ce que paie le niveau `n` quand on l'atteint. */
function recompenseNiveau(n) {
  if (n < 2) return null;
  const r = Object.assign({ niveau: n, eclats: NIVEAUX.eclats }, NIVEAUX.paliers[n] || {});
  if (n > 50 && n % NIVEAUX.apres50.tous === 0) r.boosters = (r.boosters || 0) + NIVEAUX.apres50.boosters;
  return r;
}

/* Les prochains paliers qui paient plus que des Éclats, à partir du niveau
   `n` (exclu) : pour montrer ce qui attend. */
function prochainsPaliers(n, combien) {
  const l = [];
  for (let k = n + 1; l.length < (combien || 3) && k < n + 200; k++) {
    const r = recompenseNiveau(k);
    if (r && (r.boosters || r.cadre || r.titre || r.fragments)) l.push(r);
  }
  return l;
}
