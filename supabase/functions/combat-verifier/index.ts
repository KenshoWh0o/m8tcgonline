// La fonction du serveur qui vérifie les combats (version 3.0.14).
//
//   Déployer : supabase functions deploy combat-verifier
//   (après python3 tools/build-verif.py, qui refait jeu.js ; voir le README,
//   « La vérification des combats »).
//
// Elle reçoit l'appel de la page, avec la session du joueur (Authorization),
// retrouve le joueur, et parle au serveur avec la clé de service : les
// fonctions qui paient un combat ne sont ouvertes qu'à elle
// (supabase/installation/23_combats.sql, section 9). SUPABASE_URL,
// SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournies par Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifier } from './verifier.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (x: unknown, statut = 200) =>
  new Response(JSON.stringify(x), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'Méthode refusée.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization') || '';
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (error || !data || !data.user) return json({ erreur: 'non connecte' }, 401);
  let corps: any = {};
  try { corps = await req.json(); } catch (_) { return json({ erreur: 'Requête illisible.' }, 400); }
  const base = {
    async rpc(fonction: string, args: Record<string, unknown>) {
      const r = await admin.rpc(fonction, args);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
    /* Une passe de plus : la fonction se rappelle elle-même, avec la session
       du joueur (le serveur garde la partie et jusqu'où elle est vérifiée :
       rien de ce que dit cet appel ne compte, sauf l'identifiant). */
    async suite(c: Record<string, unknown>) {
      const r = await fetch(url + '/functions/v1/combat-verifier', {
        method: 'POST',
        headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '', 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x && x.erreur || 'Vérification interrompue.');
      return x;
    },
  };
  try {
    return json(await verifier(base, data.user.id, corps));
  } catch (e) {
    return json({ erreur: (e as Error).message || String(e) }, 400);
  }
});
