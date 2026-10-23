-- =====================================================================
--  Mate TCG Online — version 2.5 : L'Echauffement, un mini-evenement
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
--    · victoire si l'adversaire tombe avant la fin du 10e tour ;
--    · LE COUP D'ECLAT, le seul geste pendant le combat : une fois par
--      combat, on touche un Joueur qui va frapper ce tour-ci, et son coup
--      compte double (avant la Carapace : c'est ce qui permet de la percer).
--  Etoiles : 1 pour la victoire, 2 en perdant au plus un Joueur, 3 sans
--  en perdre aucun. La meilleure note compte.
--
--  LES ESSAIS : trois par defi et par jour de Paris, compte au depart
--  (ech_commencer) comme l'Epreuve du jour de la 3.0 ; un essai abandonne est
--  perdu. Les defis des jours passes restent jouables (meme plafond) : sans
--  rattrapage, un jour manque ferait perdre pour de bon son indice. Le combat
--  se joue dans le navigateur (le coup d'eclat se decide en direct), puis
--  ech_terminer le rejoue ici avec le meme geste : c'est ce resultat-la qui
--  compte.
--
--  RECOMPENSES : 80, 80 puis 140 Eclats pour les etoiles 1, 2 et 3 de chaque
--  defi (300 par defi, 2 100 en tout) ; 3 boosters quand les sept defis sont
--  gagnes ; le titre « Echauffe » pour les 21 etoiles.
--
--  LES INDICES : trois etoiles au defi n debloquent l'indice n — une phrase
--  sur ce qui vient, sans rien montrer. Leur texte n'est que dans la base
--  (ech_indices) : le navigateur ne le recoit qu'une fois l'indice gagne.
--
--  LE CALENDRIER : la saison commence a la fin du recap de Reflets. Les
--  dates exactes de 2026 sont posees par calendrier-2.5.sql (a jouer une
--  fois, apres ce fichier).
--
--  L'EQUILIBRAGE (simulation sur les 51 Joueurs, toutes les equipes, et
--  chaque coup d'eclat possible) : chaque defi a une equipe a trois etoiles,
--  qui demande le coup d'eclat au bon moment les jours 3 et 7 ; une equipe au
--  hasard, meme avec le meilleur coup d'eclat, ne fait trois etoiles qu'une
--  fois sur trente a cent ; une collection aux deux tiers trouve presque
--  toujours ses trois etoiles, une collection au tiers deux ou trois.
--
--  Ce n'est pas un evenement au sens de la table `evenements` : il ne
--  remplacerait alors le recap de Reflets (evenement_recent) pendant trois
--  jours. Il a sa propre saison (ech_saison) et son propre onglet : Combats.
--
--  Les noms commencent tous par `ech_` : la version 3.0 a deja ses `defis`.
-- =====================================================================

-- ------------------------------------------------ la fin du recap, reglable
-- Jusqu'ici, le recap d'un evenement durait trois jours apres sa fin, en dur
-- (21_reflets.sql). `recap_jusqua` permet de le fixer ; vide, rien ne change.
-- Les deux fonctions sont redefinies ici, a l'identique sauf cette date.
alter table public.evenements add column if not exists recap_jusqua timestamptz;

create or replace function public.evenement_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
                            'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'))
    from evenements e
   where e.code is not null and now() >= e.fin and now() < coalesce(e.recap_jusqua, e.fin + interval '3 days')
     and evenement_en_cours() is null
   order by e.fin desc limit 1;
$$;

create or replace function public.evenement_recap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); e evenements; cpt evt_comptes; rang int; nb int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into e from evenements
   where code is not null and now() >= fin and now() < coalesce(recap_jusqua, fin + interval '3 days')
   order by fin desc limit 1;
  if not found then return 'null'::jsonb; end if;
  select * into cpt from evt_comptes where user_id = p and evenement = e.code;
  select count(*) + 1 into rang from evt_comptes
   where evenement = e.code and total > coalesce(cpt.total, 0);
  select count(*) into nb from evt_comptes where evenement = e.code and total > 0;
  return jsonb_build_object(
    'code', e.code, 'titre', e.titre, 'debut', e.debut, 'fin', e.fin,
    'jusqua', coalesce(e.recap_jusqua, e.fin + interval '3 days'),
    'total', coalesce(cpt.total, 0),
    'paliers', (select count(*) from evt_piste pa where pa.evenement = e.code and pa.seuil <= coalesce(cpt.total, 0)),
    'paliers_max', (select count(*) from evt_piste pa where pa.evenement = e.code),
    'pris', (select count(*) from evt_piste_prises x where x.user_id = p and x.evenement = e.code),
    'illus', (select count(*) from devine_illu d where d.user_id = p and d.trouve
               and d.jour between (e.debut at time zone 'Europe/Paris')::date and (e.fin at time zone 'Europe/Paris')::date),
    'reverses', (select count(*) from collection c join cards k on k.id = c.card_id
                  where c.user_id = p and c.qty > 0 and k.reverse),
    'reverses_max', (select count(*) from cards where reverse),
    'quetes', (select count(*) from quest_progress qp join quests q on q.id = qp.quest_id
                where qp.user_id = p and qp.claimed and q.evenement = e.code),
    'rang', case when coalesce(cpt.total, 0) > 0 then rang end,
    'joueurs', nb,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame, 'titre', pr.titre,
               'photo', photo_discord(pr.id), 'total', c.total, 'moi', pr.id = p)
             order by c.total desc, lower(pr.pseudo))
        from (select * from evt_comptes where evenement = e.code and total > 0
               order by total desc limit 3) c
        join profiles pr on pr.id = c.user_id), '[]'::jsonb));
end $$;

-- La saison : une seule ligne. Elle commence a la fin du recap de Reflets
-- (ou tout de suite s'il est deja fini) et dure neuf jours : un defi de plus
-- chaque jour pendant sept jours, puis deux jours pour rattraper.
--   Avancer ou reculer :  update public.ech_saison set debut = ..., fin = ... where id = 1;
create table if not exists public.ech_saison (
  id    integer primary key default 1 check (id = 1),
  debut timestamptz not null,
  fin   timestamptz not null check (fin > debut)
);
insert into public.ech_saison (id, debut, fin)
select 1, d, d + interval '9 days'
  from (select greatest(now(), coalesce((select max(coalesce(recap_jusqua, fin + interval '3 days'))
                                           from public.evenements where code = 'reflets'), now())) as d) x
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
  (1, 'c010',  900, 'aucune',   '{}',                          'Premier contact', 'Pas de règle aujourd''hui : fais connaissance.'),
  (2, 'c044', 1350, 'carapace', '{"seuil": 100}',              'Carapace',        'Il ignore les coups de moins de 100.'),
  (3, 'c102',  600, 'eclair',   '{}',                          'Frappe éclair',   'Il frappe à chaque tour.'),
  (4, 'c060', 1900, 'affinite', '{"couleur": "rose"}',         'Affinité Rose',   'Tes Joueurs Roses frappent deux fois plus fort.'),
  (5, 'c081',  900, 'riposte',  '{"degats": 30}',              'Riposte',         'Chaque coup que tu lui portes te coûte 30 de Défense.'),
  (6, 'c120', 1000, 'fureur',   '{"plus": 30}',                'Fureur',          'Ses coups gagnent 30 de dégâts à chaque fois.'),
  (7, 'c116', 1150, 'final',    '{"seuil": 80, "plus": 20}',   'Le dernier défi', 'Il ignore les coups de moins de 80, et les siens gagnent 20 à chaque fois.')
on conflict (jour) do update set adversaire = excluded.adversaire, pv = excluded.pv, regle = excluded.regle,
  param = excluded.param, titre = excluded.titre, texte = excluded.texte;

-- Les indices : un par defi, gagne avec ses trois etoiles. `visuel` dit
-- comment l'afficher : un nombre, un mot, des etoiles, l'ombre d'une carte,
-- la teinte de la suite, un eventail de dos de cartes. Le dernier message
-- (jour 0) vient quand les sept sont gagnes. Rien de ce qu'ils disent ne
-- repose sur une regle de combat reconstituee (taille du deck, nombre de
-- lignes ou de PV : des choix « maison », docs/regles-3.0.md de la 3.0) ;
-- seulement sur ce que la suite contient : la refonte, les decks, les
-- Secretes (122 + cinq Secretes = 127, chiffre confirme par le proprietaire
-- le 23 octobre 2026 ; l'indice disait 128 auparavant),
-- les Sections, la maitrise, le Versus, le Raid.
create table if not exists public.ech_indices (
  jour   integer primary key check (jour between 0 and 7),
  titre  text not null,
  texte  text not null,
  visuel jsonb not null default '{}'
);
insert into public.ech_indices (jour, titre, texte, visuel) values
  (1, 'Nouveau visage',   'Tout le jeu va changer de visage. Les couleurs de cette page en sont un avant-goût.', '{"type": "teinte"}'),
  (2, 'Ton deck',         'Tes cartes ne resteront pas dans un classeur : tu en feras ton deck.',               '{"type": "eventail"}'),
  (3, 'Cent vingt-sept',  'La collection ne s''arrête pas à 122 : elle comptera 127 cartes.',                  '{"type": "nombre", "valeur": "127"}'),
  (4, 'Deux',             'Deux camps. Il faudra choisir le tien.',                                            '{"type": "mot", "valeur": "Deux"}'),
  (5, 'Plus loin',        'Tes cartes préférées pourront aller plus loin. Beaucoup plus loin.',                '{"type": "etoiles", "valeur": 5}'),
  (6, 'Face à face',      'Un jour, ce sera contre tes amis.',                                                 '{"type": "mot", "valeur": "VS"}'),
  (7, 'Il reviendra',     'Et la prochaine fois, vous l''affronterez tous ensemble.',                          '{"type": "carte", "carte": "c116"}'),
  (0, 'Tout est prêt',    'Rendez-vous quand tu auras les cartes en main.',                                    '{"type": "mot", "valeur": "Bientôt"}')
on conflict (jour) do update set titre = excluded.titre, texte = excluded.texte, visuel = excluded.visuel;

-- La meilleure note de chaque joueur, defi par defi.
create table if not exists public.ech_scores (
  user_id uuid not null references public.profiles on delete cascade,
  jour    integer not null references public.ech_defis on delete cascade,
  etoiles smallint not null check (etoiles between 0 and 3),
  equipe  jsonb not null,
  tours   integer not null,
  le      timestamptz not null default now(),
  primary key (user_id, jour)
);
-- Chaque essai, des son depart : le plafond du jour se compte ici, et un
-- essai jamais termine reste compte (perdu).
create table if not exists public.ech_essais (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  jour    integer not null references public.ech_defis on delete cascade,
  equipe  jsonb not null,
  le      timestamptz not null default now(),
  fini    boolean not null default false,
  eclat   jsonb,
  etoiles smallint
);
create index if not exists ech_essais_user_idx on public.ech_essais (user_id, jour, le desc);
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
alter table public.ech_indices enable row level security;
alter table public.ech_essais  enable row level security;
revoke all on public.ech_saison, public.ech_joueurs, public.ech_defis, public.ech_scores, public.ech_paliers,
  public.ech_indices, public.ech_essais from anon, authenticated;

-- Les essais d'un joueur sur un defi, aujourd'hui (jour de Paris).
create or replace function public.ech_essais_du_jour(p uuid, p_jour integer) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from ech_essais
   where user_id = p and jour = p_jour
     and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
$$;

-- Le dernier defi ouvert : 0 avant le debut, 1 le premier jour, 7 au plus.
create or replace function public.ech_jour_ouvert() returns integer
language sql stable security definer set search_path = public as $$
  select case when now() < s.debut then 0
              else least(7, floor(extract(epoch from now() - s.debut) / 86400)::int + 1) end
    from ech_saison s where s.id = 1
$$;

-- ---------------------------------------------------------------- le combat
-- p_equipe : [{"carte": "c010", "a": 0}, ...], dans l'ordre, deja verifiee.
-- p_eclat : {"tour": t, "i": i} (le coup d'eclat), ou null.
-- Rend { gagne, etoiles, tours, ko, log } ; chaque ligne du log :
--   [tour, "eclat", i]                   (le coup d'eclat, juste avant le coup)
--   [tour, "frappe", i, degats, pv restants de l'adversaire]
--   [tour, "bloque", i, degats]          (la carapace)
--   [tour, "riposte", i, degats, defense restante]
--   [tour, "subit", i, degats, defense restante]
--   [tour, "ko", i]
-- `i` part de 0. La meme chose, a la ligne pres, est echCombat (js/echauffement.js).
drop function if exists public.ech_simuler(integer, jsonb);
create or replace function public.ech_simuler(p_jour integer, p_equipe jsonb, p_eclat jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d ech_defis; n int; i int; t int; e jsonb; j ech_joueurs; at jsonb;
  pv int[] := '{}'; elan int[] := '{}'; cout int[] := '{}'; deg int[] := '{}'; col text[] := '{}';
  pv_b int; elan_b int := 0; cout_b int; deg_b int; fureur int := 0; ko int := 0; dd int;
  journal jsonb := '[]'; seuil int; plus int; riposte int; affin text;
  ec_tour int; ec_i int; ec_pris boolean := false; issue text := null;
begin
  select * into d from ech_defis where jour = p_jour;
  pv_b := d.pv;
  seuil := coalesce((d.param ->> 'seuil')::int, 0);
  plus := coalesce((d.param ->> 'plus')::int, 0);
  riposte := coalesce((d.param ->> 'degats')::int, 0);
  affin := d.param ->> 'couleur';
  if p_eclat is not null and jsonb_typeof(p_eclat) = 'object' then
    ec_tour := (p_eclat ->> 'tour')::int; ec_i := (p_eclat ->> 'i')::int;
  end if;

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
      exit when issue is not null;
      continue when pv[i] <= 0;
      elan[i] := elan[i] + 1;
      continue when cout[i] is null or elan[i] < cout[i];
      elan[i] := elan[i] - cout[i];
      dd := deg[i];
      if d.regle = 'affinite' and col[i] = affin then dd := dd * 2; end if;
      if ec_tour = t and ec_i = i - 1 and not ec_pris then
        dd := dd * 2; ec_pris := true;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'eclat', i - 1));
      end if;
      if d.regle in ('carapace', 'final') and dd < seuil then
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'bloque', i - 1, dd));
        continue;
      end if;
      pv_b := pv_b - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'frappe', i - 1, dd, greatest(0, pv_b)));
      if pv_b <= 0 then issue := 'gagne'; exit; end if;
      if d.regle = 'riposte' then
        pv[i] := pv[i] - riposte;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'riposte', i - 1, riposte, greatest(0, pv[i])));
        if pv[i] <= 0 then
          ko := ko + 1;
          journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
          if not exists (select 1 from unnest(pv) v where v > 0) then issue := 'perdu'; exit; end if;
        end if;
      end if;
    end loop;

    if issue is null and elan_b >= cout_b then
      elan_b := elan_b - cout_b;
      select min(k) into i from generate_subscripts(pv, 1) k where pv[k] > 0;
      dd := deg_b + fureur;
      if d.regle in ('fureur', 'final') then fureur := fureur + plus; end if;
      pv[i] := pv[i] - dd;
      journal := journal || jsonb_build_array(jsonb_build_array(t, 'subit', i - 1, dd, greatest(0, pv[i])));
      if pv[i] <= 0 then
        ko := ko + 1;
        journal := journal || jsonb_build_array(jsonb_build_array(t, 'ko', i - 1));
        if not exists (select 1 from unnest(pv) v where v > 0) then issue := 'perdu'; end if;
      end if;
    end if;
    if issue is null and t >= 10 then issue := 'perdu'; end if;
    if issue is not null then
      return jsonb_build_object('gagne', issue = 'gagne', 'tours', t, 'ko', ko,
        'etoiles', case when issue = 'gagne' then (case when ko = 0 then 3 when ko = 1 then 2 else 1 end) else 0 end,
        'log', journal);
    end if;
  end loop;
  return null;
end $$;

-- ------------------------------------------------------------------ l'etat
create or replace function public.ech_etat_de(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert(), 'serveur', now(),
    'total', (select count(*) from ech_defis), 'essais_max', 3,
    'defis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
        'titre', d.titre, 'texte', d.texte,
        'etoiles', coalesce(sc.etoiles, 0), 'equipe', sc.equipe,
        'essais_jour', ech_essais_du_jour(p, d.jour)) order by d.jour)
        from ech_defis d
        left join ech_scores sc on sc.user_id = p and sc.jour = d.jour
       where d.jour <= ech_jour_ouvert()), '[]'::jsonb),
    'etoiles', coalesce((select sum(etoiles) from ech_scores where user_id = p), 0),
    'gagnes', (select count(*) from ech_scores where user_id = p and etoiles > 0),
    'paliers', coalesce((select jsonb_agg(palier) from ech_paliers where user_id = p), '[]'::jsonb),
    -- Seulement ceux qu'on a gagnes : le texte des autres ne sort pas de la base.
    'indices', coalesce((
      select jsonb_agg(jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) order by i.jour)
        from ech_indices i
       where (i.jour > 0 and exists (select 1 from ech_scores sc where sc.user_id = p and sc.jour = i.jour and sc.etoiles = 3))
          or (i.jour = 0 and (select count(*) from ech_scores sc where sc.user_id = p and sc.etoiles = 3) = 7)), '[]'::jsonb))
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

-- ------------------------------------------------------------- commencer
-- Verifie l'equipe et compte l'essai (trois par defi et par jour de Paris).
-- Rend { essai, equipe, restants }. Le combat se joue ensuite dans le
-- navigateur, puis ech_terminer.
drop function if exists public.ech_jouer(integer, jsonb);
create or replace function public.ech_commencer(p_jour integer, p_equipe jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); s ech_saison; e jsonb; cid text; nb int; vus text[] := '{}';
  propre jsonb := '[]'; a int; natt int; deja int; eid bigint;
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

  -- Un depart a la fois : deux appuis partis ensemble ne comptent qu'un essai.
  perform 1 from profiles where id = p for update;
  deja := ech_essais_du_jour(p, p_jour);
  if deja >= 3 then raise exception 'Plus d''essai pour ce défi aujourd''hui : reviens demain.'; end if;

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

  insert into ech_essais (user_id, jour, equipe) values (p, p_jour, propre) returning id into eid;
  return jsonb_build_object('essai', eid, 'equipe', propre, 'restants', 2 - deja);
end $$;

-- -------------------------------------------------------------- terminer
-- Rejoue le combat de l'essai avec le coup d'eclat choisi, garde la
-- meilleure note, paie. Rend { resultat, avant, gain: { eclats, boosters,
-- titre }, indice, etat, me }.
create or replace function public.ech_terminer(p_essai bigint, p_eclat jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); s ech_saison; es ech_essais; r jsonb; avant int; nouv int; k int; ec jsonb := null;
  eclats int := 0; boosters int := 0; titre text := null; indice jsonb := null;
  prix int[] := array[80, 80, 140];
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into s from ech_saison where id = 1;
  -- Une heure de grace : un essai commence a 23 h 59 le dernier soir se termine.
  if not found or now() >= s.fin + interval '1 hour' then raise exception 'L''Échauffement est terminé.'; end if;

  perform 1 from profiles where id = p for update;
  select * into es from ech_essais where id = p_essai and user_id = p for update;
  if not found then raise exception 'Essai inconnu.'; end if;
  if es.fini then raise exception 'Cet essai est déjà joué.'; end if;

  if p_eclat is not null and jsonb_typeof(p_eclat) <> 'null' then
    if jsonb_typeof(p_eclat) <> 'object' or jsonb_typeof(p_eclat -> 'tour') <> 'number' or jsonb_typeof(p_eclat -> 'i') <> 'number'
       or (p_eclat ->> 'tour')::numeric not between 1 and 10
       or (p_eclat ->> 'i')::numeric not between 0 and jsonb_array_length(es.equipe) - 1 then
      raise exception 'Coup d''éclat invalide.';
    end if;
    ec := jsonb_build_object('tour', (p_eclat ->> 'tour')::int, 'i', (p_eclat ->> 'i')::int);
  end if;

  r := ech_simuler(es.jour, es.equipe, ec);
  nouv := (r ->> 'etoiles')::int;
  update ech_essais set fini = true, eclat = ec, etoiles = nouv where id = es.id;
  select etoiles into avant from ech_scores where user_id = p and jour = es.jour;
  avant := coalesce(avant, 0);

  if nouv > avant then
    for k in (avant + 1)..nouv loop eclats := eclats + prix[k]; end loop;
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, nouv, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do update set etoiles = excluded.etoiles, equipe = excluded.equipe,
      tours = excluded.tours, le = now();
    perform accorder(p, 'eclats', eclats, null);
  else
    insert into ech_scores (user_id, jour, etoiles, equipe, tours)
    values (p, es.jour, 0, es.equipe, (r ->> 'tours')::int)
    on conflict (user_id, jour) do nothing;
  end if;

  -- Un indice : les trois etoiles, pour la premiere fois.
  if nouv = 3 and avant < 3 then
    select jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) into indice
      from ech_indices i where i.jour = es.jour;
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
    'indice', indice, 'etat', ech_etat_de(p), 'me', me());
end $$;

-- -------------------------------------------------------- administration
-- Pour le Labo : ce que les joueurs ne voient pas — la saison, les sept
-- defis meme fermes, les huit indices avec leur texte, et la participation.
-- Reserve aux administrateurs (le serveur le verifie, pas la page).
create or replace function public.ech_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return (select jsonb_build_object(
    'debut', s.debut, 'fin', s.fin, 'ouvert', ech_jour_ouvert(), 'serveur', now(),
    'total', (select count(*) from ech_defis), 'essais_max', 3,
    'defis', (select jsonb_agg(jsonb_build_object(
        'jour', d.jour, 'adversaire', d.adversaire, 'pv', d.pv, 'regle', d.regle, 'param', d.param,
        'titre', d.titre, 'texte', d.texte,
        'essais', (select count(*) from ech_essais e where e.jour = d.jour),
        'gagnes', (select count(*) from ech_scores sc where sc.jour = d.jour and sc.etoiles > 0),
        'parfaits', (select count(*) from ech_scores sc where sc.jour = d.jour and sc.etoiles = 3)) order by d.jour)
      from ech_defis d),
    'indices', (select jsonb_agg(jsonb_build_object('jour', i.jour, 'titre', i.titre, 'texte', i.texte, 'visuel', i.visuel) order by i.jour)
      from ech_indices i),
    'joueurs', (select count(distinct user_id) from ech_essais),
    'sept', (select count(*) from ech_paliers where palier = 'sept'),
    'parfait', (select count(*) from ech_paliers where palier = 'parfait'))
  from ech_saison s where s.id = 1);
end $$;

-- Rejouer : efface les essais du jour de l'administrateur lui-meme, pour
-- tester sans attendre le lendemain. Ses notes et ses gains restent.
create or replace function public.ech_admin_rejouer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); n int;
begin
  if p is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = p and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  delete from ech_essais
   where user_id = p and (le at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  get diagnostics n = row_count;
  return jsonb_build_object('effaces', n, 'etat', ech_etat_de(p));
end $$;

revoke all on function public.ech_jour_ouvert, public.ech_simuler, public.ech_etat_de, public.ech_essais_du_jour
  from public, anon, authenticated;
revoke all on function public.ech_etat, public.ech_commencer, public.ech_terminer,
  public.ech_admin, public.ech_admin_rejouer from public, anon;
grant execute on function public.ech_etat, public.ech_commencer, public.ech_terminer,
  public.ech_admin, public.ech_admin_rejouer to authenticated;
