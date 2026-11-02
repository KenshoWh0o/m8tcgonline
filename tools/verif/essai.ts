// Éprouve la fonction du serveur qui vérifie les combats (version 3.0.14),
// dans Deno — le moteur de Supabase —, avec un faux serveur en mémoire à la
// place des fonctions SQL (celles-ci ont leur test : tools/tests-sql/verif.sql).
//
//     deno run --allow-read tools/verif/essai.ts
//
// Pour chaque mode, une partie entière (le joueur tenu par l'adversaire du
// jeu, niveau 3) ; la fonction la rejoue et doit rendre le même verdict, en
// une passe comme en plusieurs. Puis un coup falsifié, un défi, et le pire
// cas mesuré : le temps de chaque passe d'un combat de Raid au niveau 5 (la
// limite de Supabase est de 2 s de calcul par appel).
import { Jeu } from '../../supabase/functions/combat-verifier/jeu.js';
import { verifier, BUDGET } from '../../supabase/functions/combat-verifier/verifier.ts';

const { Verif, Combat, IA, Decks } = Jeu as any;
let ok = 0, ko = 0;
function verif(c: boolean, m: string) { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m); } }

/* Le faux serveur : ce que font les fonctions SQL, en mémoire. */
function fauxServeur(ouverts: Record<string, any>, defis: Record<string, any> = {}) {
  const journalDesPasses: number[] = [];
  const base: any = {
    passes: 0, durees: journalDesPasses,
    async rpc(f: string, a: any) {
      if (f === 'combat_a_verifier') {
        const o = ouverts[a.p_id];
        if (!o) throw new Error('Ce combat n\'est plus ouvert.');
        if (!o.journal) { o.journal = a.p_journal; o.meta = a.p_meta; }
        return Object.assign({}, o, { verif_k: o.verif_k || 0 });
      }
      if (f === 'combat_verif_avance') { ouverts[a.p_id].verif_k = Math.max(ouverts[a.p_id].verif_k || 0, a.p_k); return null; }
      if (f === 'combat_fin_verifie') { delete ouverts[a.p_id]; return { recompense: {}, verdict: a.p_verdict, histo: a.p_histo }; }
      if (f === 'combat_refuse') { delete ouverts[a.p_id]; return { refuse: true, raison: a.p_raison, k: a.p_k }; }
      if (f === 'defi_a_verifier') return defis[a.p_id];
      if (f === 'defi_fin_verifie') return { verdict: a.p_verdict, histo: a.p_histo };
      throw new Error('fonction inconnue ' + f);
    },
    async suite(c: any) { base.passes++; return base.lancer(c); },
    lancer: null as any,
  };
  return base;
}
async function verifierAvec(o: any, journal: any[], budget = BUDGET, meta: any = { titre: 'Essai' }) {
  const ouverts: Record<string, any> = { cb1: Object.assign({}, o) };
  const base = fauxServeur(ouverts);
  const durees: number[] = [];
  const max = budget < 100 ? 1000 : undefined;
  base.lancer = async (c: any) => { const t = performance.now(); const r = await verifier(base, 'u1', c, budget, max); durees.push(performance.now() - t); return r; };
  const t = performance.now();
  const r = await verifier(base, 'u1', { id: 'cb1', journal, meta }, budget, max);
  durees.push(performance.now() - t);
  return { r, passes: base.passes + 1, durees };
}
function jouer(o: any, nivJoueur = 3) {
  const p = Verif.partie(o);
  const E = Combat.creer(p.init, { capture: true });
  let g = 0;
  while (Combat.demande(E) && g++ < 4000) {
    const d = Combat.demande(E);
    Combat.agir(E, IA.choisir(E, { niveau: d.qui === 0 ? nivJoueur : p.niveau }));
  }
  return { E, journal: JSON.parse(JSON.stringify(E.journal)) };
}
const deck = (s: string) => Decks.versMoteur(Decks.STARTERS[s]);
const MODES = [
  { mode: 'campagne', cle: 'cp05', section: 'toxique', graine: 101, deck: deck('toxique') },
  { mode: 'infini', cle: '2', niveau: 2, graine: 102, deck: deck('deter') },
  { mode: 'raid', cle: 'p1', jour: '2026-11-05', boss: 'c116', graine: 103, deck: deck('deter') },
  { mode: 'epreuve', cle: '2026-11-09', jour: '2026-11-09', n: 9, graine: 104 },
];

console.log('· chaque mode, en une passe et en plusieurs');
for (const o of MODES) {
  const { E, journal } = jouer(o);
  const attendu = Verif.verdict(E, 0);
  const une = await verifierAvec(o, journal);
  verif(une.r.verdict && JSON.stringify(une.r.verdict) === JSON.stringify(attendu) && une.r.histo && une.r.histo.titre === 'Essai',
    `${o.mode} ${o.cle} : verdict confirmé en ${une.passes} passe(s) (${attendu.gagne ? 'victoire' : 'défaite'}, ${attendu.tours} tours)`);
  const plusieurs = await verifierAvec(o, journal, 3);
  verif(plusieurs.r.verdict && JSON.stringify(plusieurs.r.verdict) === JSON.stringify(attendu) && plusieurs.passes > 1,
    `${o.mode} ${o.cle} : même verdict en ${plusieurs.passes} passes (budget de 3 ms)`);
}

console.log('· un coup de l\'adversaire falsifié');
{
  const o = MODES[1];
  const { journal } = jouer(o);
  const p = Verif.partie(o);
  const E = Combat.creer(p.init);
  let faux: any = null;
  for (let k = 0; k < journal.length && !faux; k++) {
    if (Combat.demande(E).qui === 1) {
      const autre = Combat.options(E).find((a: any) => Verif.canon(a) !== Verif.canon(journal[k]));
      if (autre) faux = { k, autre };
    }
    Combat.agir(E, journal[k]);
  }
  const j = journal.slice(0, faux.k).concat([faux.autre], journal.slice(faux.k + 1));
  const { r } = await verifierAvec(o, j);
  verif(r.refuse === true && r.k === faux.k, `refusé au coup ${faux.k} : ${r.raison}`);
}

console.log('· un défi entre amis');
{
  const decks = [deck('toxique'), deck('deter')];
  const E = Combat.creer({ decks, noms: ['A', 'B'], graine: 7 });
  const auteurs: number[] = [];
  let g = 0;
  while (Combat.demande(E) && g++ < 4000) { const d = Combat.demande(E); auteurs.push(d.qui); Combat.agir(E, IA.choisir(E, { niveau: 2 })); }
  const x = { decks, graine: 7, actions: JSON.parse(JSON.stringify(E.journal)), auteurs, moi: 1 };
  const base = fauxServeur({}, { df1: x });
  const r = await verifier(base, 'u2', { defi: 'df1' });
  verif(r.verdict.gagnant === E.fin.gagnant && r.verdict.fautif === null && r.histo && r.histo.titre === 'Défi entre amis',
    `le gagnant rejoué (${r.verdict.gagnant}), l'historique écrit pour le joueur 1`);
  const a2 = auteurs.slice(); a2[4] = 1 - a2[4];
  const r2 = await verifier(fauxServeur({}, { df2: Object.assign({}, x, { auteurs: a2 }) }), 'u2', { defi: 'df2' });
  verif(r2.verdict.fautif === a2[4] && r2.verdict.gagnant === 1 - a2[4], 'un coup envoyé hors de son tour : son auteur perd');
  let refuse = '';
  try { await verifier(fauxServeur({}, { df3: Object.assign({}, x, { actions: x.actions.slice(0, 8), auteurs: auteurs.slice(0, 8) }) }), 'u2', { defi: 'df3' }); }
  catch (e) { refuse = (e as Error).message; }
  verif(/pas fini/.test(refuse), 'un défi pas fini ne se paie pas');
}

console.log('· le pire cas : le Raid au niveau 5, chaque passe sous 2 s');
{
  /* Le temps de chaque passe : celui de Verif.rejouer, appel par appel. */
  const orig = Verif.rejouer;
  const durees: number[] = [];
  Verif.rejouer = (...args: any[]) => { const t = performance.now(); const r = orig(...args); durees.push(performance.now() - t); return r; };
  let passes = 0;
  for (const [cle, boss, graine] of [['p6', 'c116', 201], ['i1', 'c121', 202], ['i1', 'c116', 203], ['p6', 'c121', 204]] as const) {
    const o = { mode: 'raid', cle, jour: '2026-11-08', boss, graine, deck: deck(graine % 2 ? 'toxique' : 'deter') };
    const { E, journal } = jouer(o, 4);
    const n0 = durees.length;
    const v = await verifierAvec(o, journal);
    passes += v.passes;
    const ici = durees.slice(n0);
    verif(JSON.stringify(v.r.verdict) === JSON.stringify(Verif.verdict(E, 0)),
      `${cle} ${boss} : confirmé en ${v.passes} passe(s) (${ici.map(d => Math.round(d) + ' ms').join(', ')}), ${journal.length} coups`);
  }
  Verif.rejouer = orig;
  const pire = Math.max(...durees);
  /* Une passe peut dépasser le budget du temps d'un coup de l'adversaire. */
  verif(pire < 1900, `la passe la plus longue : ${Math.round(pire)} ms (budget ${BUDGET} ms, limite 2 000 ms)`);
}

console.log(`\n${ok} réussis, ${ko} en échec`);
if (ko) Deno.exit(1);
