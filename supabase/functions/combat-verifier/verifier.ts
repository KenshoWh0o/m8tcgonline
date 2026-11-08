// La vérification d'un combat (version 3.0.14) : le coeur de la fonction du
// serveur, sans le réseau (index.ts le lui donne ; tools/verif/essai.ts le
// remplace par un faux pour l'éprouver).
//
// Un combat contre l'adversaire du jeu : la page envoie { id, journal, meta }
// à la fin. On lit ce que le serveur a noté à l'ouverture (combat_a_verifier,
// qui écrit la partie une fois), on la rejoue (Verif.rejouer, le même code
// que la page), puis on paie (combat_fin_verifie) ou on refuse
// (combat_refuse). Recalculer les coups de l'adversaire coûte cher au niveau
// 5 (jusqu'à 2,4 s pour une partie de Raid, mesuré) et la fonction n'a que
// 2 s de calcul par appel : au-delà de BUDGET, on note jusqu'où on est allé
// (combat_verif_avance) et on se rappelle soi-même (`suite`) ; la passe
// suivante rejoue le début sans le recalculer.
//
// Un défi entre amis : { defi }. Les deux joueurs jouent : rien à recalculer,
// on rejoue les coups rangés par le serveur et leurs auteurs (Verif.defi).
import { Jeu } from './jeu.js';

// jeu.js est le code du navigateur, sans types.
const Verif: any = (Jeu as any).Verif;

export const BUDGET = 1200;
export const PASSES_MAX = 8;

export interface Base {
  rpc(fonction: string, args: Record<string, unknown>): Promise<any>;
  suite(corps: Record<string, unknown>): Promise<any>;
}

export async function verifier(base: Base, user: string, corps: any, budget = BUDGET, passesMax = PASSES_MAX): Promise<any> {
  if (corps && corps.defi) return verifierDefi(base, user, String(corps.defi));
  const id = String((corps && corps.id) || '');
  if (!id) throw new Error('Combat inconnu.');
  const passe = Number(corps.passe) || 0;
  const o = await base.rpc('combat_a_verifier', {
    p_user: user, p_id: id,
    p_journal: passe === 0 && Array.isArray(corps.journal) ? corps.journal : null,
    p_meta: passe === 0 && corps.meta && typeof corps.meta === 'object' ? corps.meta : null,
  });
  if (!Array.isArray(o.journal)) throw new Error('Partie absente.');
  const r = Verif.rejouer(o, o.journal, { depuis: o.verif_k || 0, budget, meta: o.meta || {} });
  if (r.etat === 'suite') {
    if (passe + 1 >= passesMax) throw new Error('Vérification trop longue : réessaie plus tard.');
    await base.rpc('combat_verif_avance', { p_user: user, p_id: id, p_k: r.k });
    return base.suite({ id, passe: passe + 1 });
  }
  if (r.etat === 'refus') {
    return base.rpc('combat_refuse', { p_user: user, p_id: id, p_raison: r.raison, p_k: r.k });
  }
  return base.rpc('combat_fin_verifie', { p_user: user, p_id: id, p_verdict: r.verdict, p_histo: r.histo });
}

async function verifierDefi(base: Base, user: string, id: string): Promise<any> {
  const x = await base.rpc('defi_a_verifier', { p_user: user, p_id: id });
  const r = Verif.defi(x, { moi: x.moi, meta: { titre: 'Défi entre amis' } });
  if (!r.fini) throw new Error('Le défi n\'est pas fini.');
  return base.rpc('defi_fin_verifie', {
    p_user: user, p_id: id,
    p_verdict: { gagnant: r.gagnant, tours: r.tours, fautif: r.fautif, raison: r.raison },
    p_histo: r.histo,
  });
}
