-- =====================================================================
--  Mate TCG Online — version 2.1.4 : L'Echauffement, un mini-evenement
--  A executer apres 22_garder.sql. Rejouable sans danger.
--
--  Sept defis, un par jour, juste apres l'evenement Reflets. Chaque defi
--  oppose une equipe de trois Joueurs de sa collection a un adversaire du
--  jour, avec une regle du jour. Le combat se deroule tout seul, a partir
--  des valeurs imprimees sur les cartes (Defense, cout et degats des
--  attaques) : le joueur ne fait que des choix — qui, dans quel ordre, avec
--  quelle attaque. C'est un avant-gout, sans rien dire de ce qui vient.
--
--  LES REGLES (ech_simuler ; la meme chose dans _demo/serveur.js)
--    · les trois Joueurs combattent ensemble ; celui de devant (le premier
--      encore debout) encaisse les coups de l'adversaire ;
--    · a chaque tour, chacun gagne 1 elan ; il frappe des que son elan
--      atteint le cout de son attaque (les Essences dessinees sur la carte),
--      et le depense ; l'adversaire fait de meme, apres eux ;
--    · deux Joueurs de la meme couleur partent avec 1 elan d'avance ;
--    · la Defense d'un Joueur est sa resistance : a 0, il est KO ;
--    · victoire si l'adversaire tombe avant la fin du 10e tour.
--  Etoiles : 1 pour la victoire, 2 en perdant au plus un Joueur, 3 sans
--  en perdre aucun. Rejouable autant qu'on veut : la meilleure note compte.
--
--  RECOMPENSES : 80, 80 puis 140 Eclats pour les etoiles 1, 2 et 3 de chaque
--  defi (300 par defi, 2 100 en tout) ; 3 boosters quand les sept defis sont
--  gagnes ; le titre « Echauffe » pour les 21 etoiles.
--
--  L'EQUILIBRAGE (simulation sur les 51 Joueurs, toutes les equipes) : chaque
--  defi a une equipe a trois etoiles ; une collection aux deux tiers les
--  trouve presque toujours, une collection au tiers gagne presque toujours.
--
--  Ce n'est pas un evenement au sens de la table `evenements` : il ne
--  remplacerait alors le recap de Reflets (evenement_recent) pendant trois
--  jours. Il a sa propre saison (ech_saison) et son propre onglet : Combats.
--
--  Les noms commencent tous par `ech_` : la version 3.0 a deja ses `defis`.
-- =====================================================================

-- La saison : une seule ligne. Elle commence a la fin de Reflets (ou tout de
-- suite si Reflets est deja fini) et dure neuf jours : un defi de plus
-- chaque jour pendant sept jours, puis deux jours pour rattraper.
--   Avancer ou reculer :  update public.ech_saison set debut = ..., fin = ... where id = 1;
create table if not exists public.ech_saison (
  id    integer primary key default 1 check (id = 1),
  debut timestamptz not null,
  fin   timestamptz not null check (fin > debut)
);
insert into public.ech_saison (id, debut, fin)
select 1, d, d + interval '9 days'
  from (select greatest(now(), coalesce((select max(fin) from public.evenements where code = 'reflets'), now())) as d) x
on conflict (id) do nothing;

-- Les Joueurs et leurs valeurs imprimees (genere depuis js/cards-data.js).
-- Les attaques sans degats (un effet seulement) n'y sont pas.
create table if not exists public.ech_joueurs (
  card_id  text primary key references public.cards on delete cascade,
  def      integer not null,
  couleur  text not null,
  attaques jsonb not null
);
insert into public.ech_joueurs (card_id, def, couleur, attaques) values
  ('c010', 130, 'rose', '[{"nom":"Roi du Silence","cout":1,"degats":50}]'),
  ('c011', 90, 'rose', '[{"nom":"S-Privilège","cout":1,"degats":90}]'),
  ('c012', 110, 'rose', '[{"nom":"Trash-talk","cout":2,"degats":110}]'),
  ('c013', 70, 'rose', '[{"nom":"Confusion","cout":1,"degats":60}]'),
  ('c017', 90, 'rose', '[{"nom":"Premier Souffle","cout":1,"degats":90}]'),
  ('c022', 90, 'rose', '[{"nom":"Rotation","cout":2,"degats":160}]'),
  ('c023', 120, 'rose', '[{"nom":"Clutch","cout":2,"degats":126},{"nom":"World Record","cout":3,"degats":180}]'),
  ('c024', 120, 'rose', '[{"nom":"Coup de fil","cout":2,"degats":100}]'),
  ('c025', 120, 'rose', '[{"nom":"Locked In","cout":2,"degats":130}]'),
  ('c029', 120, 'orange', '[{"nom":"Demon''s Domain","cout":2,"degats":80}]'),
  ('c034', 90, 'orange', '[{"nom":"Baby Shark","cout":1,"degats":60}]'),
  ('c035', 120, 'orange', '[{"nom":"Eclosion","cout":2,"degats":130}]'),
  ('c039', 90, 'violette', '[{"nom":"What a Save !","cout":1,"degats":90}]'),
  ('c040', 70, 'violette', '[{"nom":"Hold-Up","cout":1,"degats":60}]'),
  ('c044', 140, 'violette', '[{"nom":"Pinch","cout":3,"degats":80}]'),
  ('c045', 70, 'violette', '[]'),
  ('c049', 100, 'jaune', '[{"nom":"Dictature","cout":1,"degats":50}]'),
  ('c050', 140, 'mauve', '[{"nom":"Soutien Constant","cout":3,"degats":150}]'),
  ('c051', 110, 'mauve', '[{"nom":"Télépathie","cout":2,"degats":120}]'),
  ('c052', 90, 'mauve', '[{"nom":"Regard Sombre","cout":1,"degats":90},{"nom":"Sourire Radieux","cout":2,"degats":150}]'),
  ('c057', 160, 'mauve', '[{"nom":"AimBot.exe","cout":2,"degats":90},{"nom":"Titanic","cout":3,"degats":140}]'),
  ('c058', 130, 'mauve', '[{"nom":"Menace Fantôme","cout":2,"degats":120}]'),
  ('c059', 40, 'mauve', '[{"nom":"Vroom Vroom","cout":1,"degats":40}]'),
  ('c060', 150, 'mauve', '[{"nom":"Aspiration d''âme","cout":4,"degats":150}]'),
  ('c062', 80, 'verte', '[{"nom":"Confusion","cout":1,"degats":90}]'),
  ('c063', 160, 'verte', '[{"nom":"Sh*t On","cout":4,"degats":180}]'),
  ('c064', 90, 'bleue', '[{"nom":"Frappe de faute","cout":1,"degats":90}]'),
  ('c067', 60, 'bleue', '[{"nom":"Rien à perdre","cout":1,"degats":60}]'),
  ('c068', 120, 'bleue', '[{"nom":"Tout à gagner","cout":2,"degats":120}]'),
  ('c069', 130, 'azur', '[{"nom":"WaWar","cout":3,"degats":90}]'),
  ('c071', 90, 'azur', '[{"nom":"→↓↘ + 👊","cout":2,"degats":90}]'),
  ('c073', 110, 'neutre', '[{"nom":"Ascension","cout":2,"degats":120}]'),
  ('c074', 130, 'neutre', '[{"nom":"Déboutonnage","cout":3,"degats":150}]'),
  ('c075', 140, 'neutre', '[{"nom":"Vol","cout":3,"degats":90}]'),
  ('c076', 100, 'neutre', '[{"nom":"Déploiement","cout":2,"degats":10}]'),
  ('c077', 90, 'neutre', '[{"nom":"Déboîtement d''épaule","cout":1,"degats":90}]'),
  ('c078', 80, 'neutre', '[{"nom":"Estafilade","cout":1,"degats":90},{"nom":"Serment","cout":2,"degats":120}]'),
  ('c079', 70, 'neutre', '[{"nom":"Pré-Clic","cout":2,"degats":110}]'),
  ('c080', 100, 'neutre', '[{"nom":"Permutation","cout":2,"degats":100}]'),
  ('c081', 170, 'neutre', '[{"nom":"Hexa-Punch","cout":4,"degats":190}]'),
  ('c100', 130, 'neutre', '[{"nom":"Doig BYE BYE BYE","cout":3,"degats":160}]'),
  ('c101', 120, 'neutre', '[{"nom":"Choc D''Août","cout":2,"degats":120}]'),
  ('c102', 70, 'neutre', '[{"nom":"Hyper-Vitesse","cout":1,"degats":100}]'),
  ('c112', 130, 'neutre', '[{"nom":"Avenir Radieux","cout":2,"degats":120}]'),
  ('c113', 150, 'rose', '[{"nom":"Coup d''jus","cout":3,"degats":150}]'),
  ('c116', 180, 'mauve', '[{"nom":"Éclairs Vengeurs","cout":4,"degats":200}]'),
  ('c117', 120, 'mauve', '[{"nom":"Sang Froid","cout":2,"degats":140}]'),
  ('c118', 90, 'mauve', '[{"nom":"Cancel Slide","cout":2,"degats":150}]'),
  ('c119', 110, 'neutre', '[{"nom":"Contre-Pitre","cout":1,"degats":10}]'),
  ('c120', 150, 'neutre', '[{"nom":"Mâchouille","cout":2,"degats":120}]'),
  ('c121', 140, 'neutre', '[{"nom":"Coup de fil","cout":3,"degats":160}]')
on conflict (card_id) do update set def = excluded.def, couleur = excluded.couleur, attaques = excluded.attaques;

-- Les sept defis. `pv` : la Defense de l'adversaire pour ce defi.
create table if not exists public.ech_defis (
  jour       integer primary key check (jour between 1 and 7),
  adversaire text not null references public.cards,
  pv         integer not null check (pv > 0),
  regle      text not null check (regle in ('aucune', 'carapace', 'eclair', 'affinite', 'riposte', 'fureur', 'final')),
  param      jsonb not null default '{}',
  titre      text not null,
  texte      text not null
);
insert into public.ech_defis (jour, adversaire, pv, regle, param, titre, texte) values
  (1, 'c010',  800, 'aucune',   '{}',                          'Premier contact', 'Pas de règle aujourd''hui : fais connaissance.'),
  (2, 'c044', 1200, 'carapace', '{"seuil": 100}',              'Carapace',        'Il ignore les coups de moins de 100.'),
  (3, 'c102',  500, 'eclair',   '{}',                          'Frappe éclair',   'Il frappe à chaque tour.'),
  (4, 'c060', 1700, 'affinite', '{"couleur": "rose"}',         'Affinité Rose',   'Tes Joueurs Roses frappent deux fois plus fort.'),
  (5, 'c081',  800, 'riposte',  '{"degats": 30}',              'Riposte',         'Chaque coup que tu lui portes te coûte 30 de Défense.'),
  (6, 'c120',  900, 'fureur',   '{"plus": 30}',                'Fureur',          'Ses coups gagnent 30 de dégâts à chaque fois.'),
  (7, 'c116', 1100, 'final',    '{"seuil": 80, "plus": 20}',   'Le dernier défi', 'Il ignore les coups de moins de 80, et les siens gagnent 20 à chaque fois.')
on conflict (jour) do update set adversaire = excluded.adversaire, pv = excluded.pv, regle = excluded.regle,
  param = excluded.param, titre = excluded.titre, texte = excluded.texte;

-- La meilleure note de chaque joueur, defi par defi.
create table if not exists public.ech_scores (
  user_id uuid not null references public.profiles on delete cascade,
  jour    integer not null references public.ech_defis on delete cascade,
  etoiles smallint not null check (etoiles between 0 and 3),
  equipe  jsonb not null,
  tours   integer not null,
  essais  integer not null default 1,
  le      timestamptz not null default now(),
  primary key (user_id, jour)
);
-- Les paliers deja payes : « sept » (sept defis gagnes), « parfait » (21 etoiles).
create table if not exists public.ech_paliers (
  user_id uuid not null references public.profiles on delete cascade,
  palier  text not null,
  le      timestamptz not null default now(),
  primary key (user_id, palier)
);
alter table public.ech_saison  enable row level security;
alter table public.ech_joueurs enable row level security;
alter table public.ech_defis   enable row level security;
alter table public.ech_scores  enable row level security;
alter table public.ech_paliers enable row level security;
revoke all on public.ech_saison, public.ech_joueurs, public.ech_defis, public.ech_scores, public.ech_paliers
  from anon, authenticated;

-- Le dernier defi ouvert : 0 avant le debut, 1 le premier jour, 7 au plus.
create or replace function public.ech_jour_ouvert() returns integer
language sql stable security definer set search_path = public as $$
  select case when now() < s.debut then 0
              else least(7, floor(extract(epoch from now() - s.debut) / 86400)::int + 1) end
    from ech_saison s where s.id = 1
$$;

-- ---------------------------------------------------------------- le combat
-- p_equipe : [{"carte": "c010", "a": 0}, ...], dans l'ordre, deja verifiee.
-- Rend { gagne, etoiles, tours, ko, log } ; chaque ligne du log :
--   [tour, "frappe", i, degats, pv restants de l'adversaire]
--   [tour, "bloque", i, degats]          (la carapace)
--   [tour, "riposte", i, degats, defense restante]
--   [tour, "subit", i, degats, defense restante]
--   [tour, "ko", i]
-- `i` part de 0. La meme fonction, a la ligne pres, est dans _demo/serveur.js.
create or replace function public.ech_simuler(p_jour integer, p_equipe jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d ech_defis; n int; i int; t int; e jsonb; j ech_joueurs; at jsonb;
  pv int[] := '{}'; elan int[] := '{}'; cout int[] := '{}'; deg int[] := '{}'; col text[] := '{}';
  pv_b int; elan_b int := 0; cout_b int; deg_b int; fureur int := 0; ko int := 0; dd int;
  journal jsonb := '[]'; seuil int; plus int; riposte int; affin text;
begin
  select * into d from ech_defis where jour = p_jour;
  pv_b := d.pv;
  seuil := coalesce((d.param ->> 'seuil')::int, 0);
  plus := coalesce((d.param ->> 'plus')::int, 0);
  riposte := coalesce((d.param ->> 'degats')::int, 0);
  affin := d.param ->> 'couleur';

  -- L'adversaire frappe avec sa plus forte attaque (la premiere, a egalite).
  select (x.value ->> 'cout')::int, (x.value ->> 'degats')::int into cout_b, deg_b
    from ech_joueurs ej, jsonb_array_elements(ej.attaques) with ordinality x(value, k)
   where ej.card_id = d.adversaire
   order by (x.value ->> 'degats')::int desc, x.k limit 1;
  if d.regle = 'eclair' then cout_b := 1; end if;

  n := jsonb_array_length(p_equipe);
  for i in 1..n loop
    e := p_equipe -> (i - 1);
    select * into j from ech_joueurs where card_id = e ->> 'carte';
    at := j.attaques -> coalesce((e ->> 'a')::int, 0);
    pv := pv || j.def; elan := elan || 0; col := col || j.couleur;
    cout := cout || (at ->> 'cout')::int; deg := deg || (at ->> 'degats')::int;
  end loop;
  -- Deux Joueurs de la meme couleur : 1 elan d'avance.
  for i in 1..n loop
    if (select count(*) from unnest(col) c where c = col[i]) > 1 then elan[i] := 1; end if;
  end loop;

  for t in 1..10 loop
    elan_b := elan_b + 1;
    for i in 1..n loop
      continue when pv[i] <= 0;
      elan[i] := elan[i] + 1;
      continue when cout[i] is null or elan[i] < cout[i];
      elan[i] := elan[i] - cout[i];
      dd := deg[i];
      if d.regle = 'affinite' and col[i] = affin then dd := dd * 2; end if;
      if d.regle in ('carapace', 'final') and dd < seuil then
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'bloque', i - 1, dd));
        continue;
      end if;
      pv_b := pv_b - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'frappe', i - 1, dd, greatest(0, pv_b)));
      if pv_b <= 0 then
        return jsonb_build_object('gagne', true, 'tours', t, 'ko', ko,
          'etoiles', case when ko = 0 then 3 when ko = 1 then 2 else 1 end, 'log', journal);
      end if;
      if d.regle = 'riposte' then
        pv[i] := pv[i] - riposte;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'riposte', i - 1, riposte, greatest(0, pv[i])));
        if pv[i] <= 0 then
          ko := ko + 1;
          journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
          if not exists (select 1 from unnest(pv) v where v > 0) then
            return jsonb_build_object('gagne', false, 'tours', t, 'ko', ko, 'etoiles', 0, 'log', journal);
          end if;
        end if;
      end if;
    end loop;

    if elan_b >= cout_b then
      elan_b := elan_b - cout_b;
      select min(k) into i from generate_subscripts(pv, 1) k where pv[k] > 0;
      dd := deg_b + fureur;
      if d.regle in ('fureur', 'final') then fureur := fureur + plus; end if;
      pv[i] := pv[i] - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'subit', i - 1, dd, greatest(0, pv[i])));
      if pv[i] <= 0 then
        ko := ko + 1;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
        if not exists (select 1 from unnest(pv) v where v > 0) then
          return jsonb_build_object('gagne', false, 'tours', t, 'ko', ko, 'etoiles', 0, 'log', journal);
        end if;
      end if;
    end if;
  end loop;
  return jsonb_build_object('gagne', false, 'tours', 10, 'ko', ko, 'etoiles', 0, 'log', journal);
end $$;

-- ------------------------------------------------------------------ l'etat
create or replace function public.ech_etat_de(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert(), 'serveur', now(),
    'total', (select count(*) from ech_defis),
    'defis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
        'titre', d.titre, 'texte', d.texte,
        'etoiles', coalesce(sc.etoiles, 0), 'equipe', sc.equipe, 'essais', coalesce(sc.essais, 0)) order by d.jour)
        from ech_defis d
        left join ech_scores sc on sc.user_id = p and sc.jour = d.jour
       where d.jour <= ech_jour_ouvert()), '[]'::jsonb),
    'etoiles', coalesce((select sum(etoiles) from ech_scores where user_id = p), 0),
    'gagnes', (select count(*) from ech_scores where user_id = p and etoiles > 0),
    'paliers', coalesce((select jsonb_agg(palier) from ech_paliers where user_id = p), '[]'::jsonb))
  from ech_saison s where s.id = 1
$$;

create or replace function public.ech_etat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  return ech_etat_de(p);
end $$;

-- ------------------------------------------------------------------ jouer
-- Rend { resultat, avant, gain: { eclats, boosters, titre }, etat, me }.
create or replace function public.ech_jouer(p_jour integer, p_equipe jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); s ech_saison; e jsonb; cid text; nb int; vus text[] := '{}';
  propre jsonb := '[]'; a int; natt int; r jsonb; avant int; nouv int; k int;
  eclats int := 0; boosters int := 0; titre text := null;
  prix int[] := array[80, 80, 140];
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  if not found or now() < s.debut then raise exception 'L''Échauffement n''a pas commencé.'; end if;
  if now() >= s.fin then raise exception 'L''Échauffement est terminé.'; end if;
  if p_jour is null or p_jour < 1 or p_jour > ech_jour_ouvert() then raise exception 'Ce défi n''est pas encore ouvert.'; end if;

  if p_equipe is null or jsonb_typeof(p_equipe) <> 'array' then raise exception 'Équipe invalide.'; end if;
  nb := jsonb_array_length(p_equipe);
  if nb < 1 or nb > 3 then raise exception 'Une équipe compte un à trois Joueurs.'; end if;

  -- Un appui a la fois : deux envois partis ensemble ne paient pas deux fois.
  perform 1 from profiles where id = p for update;

  for e in select value from jsonb_array_elements(p_equipe) loop
    cid := e ->> 'carte';
    -- Une Reverse joue comme sa carte classique.
    if cid ~ '^r[0-9]' then cid := 'c' || substr(cid, 2); end if;
    if cid is null or not exists (select 1 from ech_joueurs where card_id = cid) then raise exception 'Ce n''est pas un Joueur.'; end if;
    if cid = any(vus) then raise exception 'Un Joueur apparaît deux fois.'; end if;
    vus := vus || cid;
    if not exists (select 1 from collection where user_id = p and qty > 0
                    and card_id in (cid, 'r' || substr(cid, 2))) then
      raise exception 'Tu ne possèdes pas un des Joueurs choisis.';
    end if;
    natt := (select jsonb_array_length(attaques) from ech_joueurs where card_id = cid);
    a := coalesce((e ->> 'a')::int, 0);
    if a < 0 or (natt > 0 and a >= natt) or (natt = 0 and a <> 0) then raise exception 'Attaque inconnue.'; end if;
    propre := propre || jsonb_build_array(jsonb_build_object('carte', cid, 'a', a));
  end loop;

  r := ech_simuler(p_jour, propre);
  nouv := (r ->> 'etoiles')::int;
  select etoiles into avant from ech_scores where user_id = p and jour = p_jour;
  avant := coalesce(avant, 0);

  if nouv > avant then
    for k in (avant + 1)..nouv loop eclats := eclats + prix[k]; end loop;
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, p_jour, nouv, propre, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set etoiles = excluded.etoiles, equipe = excluded.equipe,
      tours = excluded.tours, essais = ech_scores.essais + 1, le = now();
    perform accorder(p, 'eclats', eclats, null);
  else
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, p_jour, 0, propre, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set essais = ech_scores.essais + 1;
  end if;

  -- Les paliers.
  if (select count(*) from ech_scores where user_id = p and etoiles > 0) = 7 then
    insert into ech_paliers (user_id, palier) values (p, 'sept') on conflict do nothing;
    if found then boosters := 3; perform accorder(p, 'boosters', 3, null); end if;
  end if;
  if (select sum(etoiles) from ech_scores where user_id = p) = 21 then
    insert into ech_paliers (user_id, palier) values (p, 'parfait') on conflict do nothing;
    if found then titre := 't_echauffe'; perform accorder(p, 'titre', 0, 't_echauffe'); end if;
  end if;

  return jsonb_build_object('resultat', r, 'avant', avant,
    'gain', jsonb_build_object('eclats', eclats, 'boosters', boosters, 'titre', titre),
    'etat', ech_etat_de(p), 'me', me());
end $$;

revoke all on function public.ech_jour_ouvert, public.ech_simuler, public.ech_etat_de from public, anon, authenticated;
revoke all on function public.ech_etat, public.ech_jouer from public, anon;
grant execute on function public.ech_etat, public.ech_jouer to authenticated;
