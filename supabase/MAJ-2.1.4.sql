-- Mate TCG Online — mise a jour 2.1.4, assemblee par tools/build-sql.py le 2026-10-22.
-- A coller d'un bloc dans Supabase > SQL Editor, AVANT vendredi 23 octobre midi.
-- Ne pas editer : editer 22b_echauffement.sql, 22c_reverses.sql, 07_vitrine.sql, 12_recyclage.sql, calendrier-2.1.4.sql.

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
--  dates exactes de 2026 sont posees par calendrier-2.1.4.sql (a jouer une
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
-- Secretes (122 + les Secretes = 128, chiffre donne par le proprietaire),
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
  (3, 'Cent vingt-huit',  'La collection ne s''arrête pas à 122 : elle comptera 128 cartes.',                  '{"type": "nombre", "valeur": "128"}'),
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


-- =====================================================================
--  Mate TCG Online — version 2.1.4 : les Reverses se recyclent et se
--  fabriquent. A executer apres 22b_echauffement.sql. Rejouable sans danger.
--
--  Fermes depuis la 2.0 (21_reflets.sql : parametres.fabrication_reverse),
--  le recyclage et la fabrication des Reverses ouvrent a la fin de Reflets.
--
--   1. L'ouverture est datee : parametres.reverses_des. Passe cet instant,
--      recycler et fabriquer (12_recyclage.sql) acceptent les Reverses, et
--      me() (07_vitrine.sql) le dit au navigateur, qui bascule tout seul.
--      Sur la vraie base, la date est posee par calendrier-2.1.4.sql : le
--      vendredi 23 octobre 2026 a minuit, heure de Paris, la minute ou
--      Reflets finit. Vide (une installation neuve) : ferme.
--      `fabrication_reverse = true` ouvre tout de suite, comme avant.
--
--   2. Le prix n'est plus le double d'une classique, mais celui de leur
--      vraie rarete (prix_reverse, plus bas).
--
--  me() n'envoie plus `parametres.fabrication_reverse` : le site 2.1.3,
--  encore en ligne jusqu'a la publication de la 2.1.4, afficherait le
--  double au lieu du vrai prix. Il garde donc les Reverses fermees ; la
--  2.1.4 lit `parametres.reverses`.
--
--  ------------------------------------------------------------------
--  LE PRIX
--
--  Ce qu'on attend d'une carte precise, en boosters (un booster : deux
--  Communes, une Peu commune, une Essence, une Reverse, un hit) :
--      classiques   Commune 16,5 · Peu commune 24 · Rare 35 · Epique 112
--                   Legendaire 250
--      Reverses     Commune 66 · Peu commune 69 · Rare 187
--  Une Reverse Commune est plus rare qu'une Rare classique ; une Reverse
--  Rare, plus rare qu'une Epique. Le double (80, 200, 800) les vendait
--  moins cher que des cartes deux fois plus faciles a tirer.
--
--  Deux regles :
--    · jamais moins cher qu'une classique plus facile a tirer : Commune et
--      Peu commune reverses au moins 400 (une Rare), Rare reverse au moins
--      2 000 (une Epique) ; et l'ordre des raretes respecte ;
--    · le meme effet que la fabrication des classiques sur la fin de
--      collection : -33 % sur la mediane, -41 % sur le quart le plus lent
--      (cfg() de 01_schema.sql, en-tete de 12_recyclage.sql).
--
--  Simulation (python3 tools/equilibre-reverses.py : 600 joueurs par
--  ligne, presents depuis l'ouverture du 24 septembre ; Reverses en booster
--  depuis la 2.0 ; ouvertes le 24 octobre ; doublons recycles chaque soir ;
--  classiques fabriquees d'abord), date des 85 Reverses, mediane (quart le
--  plus lent) :
--                              sans fabrication      400 / 500 / 2 400
--      regulier (6 par jour)    30 janvier (23 fevrier)  25 decembre (5 janvier)
--      occasionnel (4 par jour,  5 juin (8 aout)         28 mars (18 avril)
--        5 jours sur 7)
--  Gain compte depuis l'ouverture : -37 % / -40 % pour le regulier,
--  -31 % / -39 % pour l'occasionnel ; en moyenne, celui des classiques.
--  A titre de comparaison : le double faisait gagner -46 % / -49 % et
--  finissait les Reverses cinq jours apres les 122 ; ces prix, deux semaines
--  apres (quatre pour l'occasionnel) — les Fragments gardent un usage une
--  fois l'extension complete. Au prix de leur rarete exacte (1 000 / 1 000 /
--  4 800), le gain tombait a -24 % / -31 %.
--  Le revers : un joueur qui met ses Fragments dans les Reverses avant
--  d'avoir les 122 finit l'extension environ trois semaines plus tard
--  (jour 98 au lieu de 78 ; au double, 83). La fiche de fabrication d'une Reverse le
--  rappelle (js/recyclage.js).
--  Pas d'avalanche : il faut 92 400 Fragments pour les 85 (29 840 au
--  double) ; un joueur qui en aurait garde 16 000 sans jamais rien fabriquer
--  comble le premier soir entre le tiers et la moitie de ce qui lui manque,
--  selon le nombre de boosters qu'il a ouverts.
--
--  Le recyclage ne change pas : une Reverse rapporte comme sa classique
--  (2, 5, 20). L'aligner sur ces prix (un vingtieme, comme les classiques :
--  20, 25, 120) donnerait +57 % de Fragments a un joueur avance et
--  raccourcirait d'un tiers la fabrication des classiques ; et un
--  doublon de Reverse garde sa valeur d'echange (contre une Reverse).
--
--  Ce que la simulation ignore : les echanges, les boosters achetes ou
--  offerts, les godpacks, les Reverses du Pass et de la boutique de Reflets.
-- =====================================================================

alter table public.parametres add column if not exists reverses_des timestamptz;

-- Ouvert a la main, ou passe la date.
create or replace function public.reverses_ouvertes() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select fabrication_reverse or coalesce(now() >= reverses_des, false)
                     from parametres where id = 1), false);
$$;

-- Fabriquer une Reverse, en Fragments (le calcul est en tete du fichier).
-- A garder egal a REV_DEFAUT (js/recyclage.js, l'affichage hors ligne) et a
-- prixReverse (_demo/serveur.js).
create or replace function public.prix_reverse(p_rar text) returns integer
language sql immutable as $$
  select case p_rar when 'C' then 400 when 'PC' then 500 when 'R' then 2400 end;
$$;

revoke all on function public.reverses_ouvertes, public.prix_reverse from public, anon, authenticated;

-- Pour verifier :
--   select reverses_ouvertes(), reverses_des at time zone 'Europe/Paris' from public.parametres;
-- Ouvrir tout de suite :
--   update public.parametres set fabrication_reverse = true where id = 1;
-- Deplacer l'ouverture :
--   update public.parametres set reverses_des = timestamptz '2026-10-24 00:00:00+02' where id = 1;


-- =====================================================================
--  Mate TCG Online — la vitrine : quatre cartes mises en avant sur le profil
--  A executer apres 06_social.sql. Rejouable sans danger.
-- =====================================================================

alter table public.profiles
  add column if not exists vitrine text[] not null default '{}';

-- Quatre cartes au maximum, toutes possedees, sans doublon : le serveur
-- verifie, sinon n'importe qui exposerait une Legendaire qu'il n'a pas.
create or replace function public.set_vitrine(p_cards text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); propre text[]; c text;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  p_cards := coalesce(p_cards, '{}');
  if array_length(p_cards, 1) > 4 then raise exception 'Quatre cartes au maximum.'; end if;

  propre := '{}';
  foreach c in array p_cards loop
    if c = any(propre) then continue; end if;                 -- pas deux fois la meme
    if not exists (select 1 from collection
                   where user_id = moi and card_id = c and qty > 0) then
      raise exception 'Tu ne possèdes pas une des cartes choisies.';
    end if;
    propre := propre || c;
  end loop;

  update profiles set vitrine = propre where id = moi;
  return me();
end $$;

revoke all on function public.set_vitrine from public, anon;
grant execute on function public.set_vitrine to authenticated;

-- ------------------------------------------------- la vitrine dans me()
-- me() est redefinie ici pour ajouter le champ : la version de 03_rpc.sql ne le
-- connait pas. Rejouer 03_rpc.sql apres ce fichier l'effacerait — il faut alors
-- rejouer celui-ci, ou plus simplement recoller TOUT.sql qui les met dans l'ordre.
-- C'est la derniere version de me() : elle ajoute la vitrine au profil, et
-- c'est donc ici que se pose l'appel a check_promos (supabase/03b_promos.sql).
-- Une carte Promo de palier peut etre debloquee par un echange aussi bien que
-- par un booster : sans cet appel, elle n'arriverait qu'a la prochaine
-- ouverture de paquet.
--
-- Elle lit aussi la boite de reception et le recyclage, dont les fonctions
-- sont creees plus loin (11_boite.sql, 12_recyclage.sql). PL/pgSQL resout les
-- appels a l'execution : a la fin de TOUT.sql, tout est la.
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); pr profiles;
begin
  if p is null then raise exception 'non connecte'; end if;
  pr := regen_tickets(p);
  perform sync_collection_quests(p);
  perform check_promos(p);

  return jsonb_build_object(
    'profil', jsonb_build_object(
      'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
      'is_admin', pr.is_admin, 'shards', pr.shards, 'tickets', pr.tickets,
      'last_tick', pr.last_tick, 'trade_free_at', pr.trade_free_at,
      'packs_opened', pr.packs_opened, 'trades_done', pr.trades_done,
      'streak', pr.streak, 'last_checkin', pr.last_checkin,
      'vitrine', to_jsonb(pr.vitrine),
      'fragments', pr.fragments,
      -- Les boosters en plus (boutique, cadeaux), hors reserve.
      'boosters_bonus', pr.boosters_bonus, 'bonus_offerts', pr.tickets_offerts,
      -- Version 2.0 (21_reflets.sql) : le titre, la banniere, la devise, et
      -- les titres debloques.
      'titre', pr.titre, 'banniere', pr.banniere, 'devise', pr.devise,
      'titres', to_jsonb(titres_de(p)),
      -- Version 2.1 (22_garder.sql) : les exemplaires a garder, par rarete.
      'garder', pr.garder,
      -- Version 2.1 : entre grace au code d'un autre, il n'invite pas a son tour.
      'filleul', est_filleul(p),
      -- La seule fonction qui reponde a un compte non invite : c'est elle qui
      -- permet au navigateur d'afficher « tu n'es pas sur la liste » au lieu
      -- d'une erreur muette. Toutes les autres refusent (garde_beta).
      'invite', (beta_ouverte() or est_invite(p)),
      -- Le rythme en cours : plus court pendant un evenement (minutes_recharge,
      -- 15_evenements.sql). Le compte a rebours du navigateur suit celui-ci.
      'ticket_cap', cfg('ticket_cap'), 'ticket_minutes', minutes_recharge(),
      'serveur', now()),
    -- La pastille de la boite de reception (supabase/11_boite.sql).
    'boite', boite_non_lues(p),
    -- Le recyclage et la fabrication (supabase/12_recyclage.sql) : ce que
    -- rapporte chaque rarete en Fragments, et ce que coute une carte. Les
    -- montants partent d'ici pour que le navigateur n'en garde pas une copie
    -- qui finirait par mentir.
    'recyclage', jsonb_build_object(
      'valeurs', jsonb_build_object(
        'ES', cfg('recyclage_ES'), 'C', cfg('recyclage_C'), 'PC', cfg('recyclage_PC'),
        'R', cfg('recyclage_R'), 'E', cfg('recyclage_E'), 'L', cfg('recyclage_L')),
      'couts', jsonb_build_object(
        'ES', cfg('fabrication_ES'), 'C', cfg('fabrication_C'), 'PC', cfg('fabrication_PC'),
        'R', cfg('fabrication_R'), 'E', cfg('fabrication_E'), 'L', cfg('fabrication_L'))),
    -- Les succes, l'evenement en cours et la chasse (15_evenements.sql).
    'succes', succes_de(p),
    'evenement', evenement_actif(),
    -- Version 2.0 : un evenement fini depuis moins de trois jours (son recap,
    -- 21_reflets.sql). Fonction resolue a l'execution : elle est creee plus loin.
    'recap', evenement_recent(),
    'chasse', chasse_etat(),
    -- Version 2.0 : les reglages, le solde de Prismes de l'evenement en
    -- cours, et les invitations achetees. Les Reverses (version 2.1.4,
    -- 22c_reverses.sql) : ouvertes ou non, a partir de quand, et leur prix.
    -- Plus de `fabrication_reverse` ici : le site 2.1.3 l'aurait affiche au
    -- double, il garde donc les Reverses fermees.
    'parametres', jsonb_build_object('reverses', jsonb_build_object(
      'ouvertes', reverses_ouvertes(),
      'des', (select reverses_des from parametres where id = 1),
      'couts', jsonb_build_object('C', prix_reverse('C'), 'PC', prix_reverse('PC'), 'R', prix_reverse('R')))),
    'prismes', coalesce((select solde from evt_comptes
                          where user_id = p and evenement = evenement_en_cours()), 0),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'cree_le', i.cree_le,
                                          'utilise_par', (select pseudo from profiles where id = i.utilise_par),
                                          'utilise_le', i.utilise_le) order by i.cree_le)
        from invitations i where i.auteur = p), '[]'::jsonb),
    'col', coalesce((select jsonb_object_agg(card_id, qty) from collection
                     where user_id = p and qty > 0), '{}'::jsonb),
    -- Version 2.1 : les exemplaires a garder, carte par carte.
    'gardes', coalesce((select jsonb_object_agg(card_id, n) from gardes where user_id = p), '{}'::jsonb),
    -- Version 2.1 : les cartes en favori, de la plus ancienne a la plus recente.
    'favoris', coalesce((select jsonb_agg(card_id order by le) from favoris where user_id = p), '[]'::jsonb),
    'inv', coalesce((select jsonb_object_agg(item_id, qty) from inventory
                     where user_id = p and qty > 0), '{}'::jsonb),
    'quetes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'scope', q.scope, 'titre', q.titre, 'detail', q.detail,
        'goal', q.goal, 'reward', q.reward, 'item', q.item_id, 'metric', q.metric,
        'progress', least(coalesce(qp.progress, 0), q.goal),
        'claimed', coalesce(qp.claimed, false),
        'monnaie', q.monnaie, 'evenement', q.evenement) order by q.scope, q.ordre)
      from quests q
      left join quest_progress qp
        on qp.quest_id = q.id and qp.user_id = p and qp.period_key = period_key(q.scope)
      -- Les quetes d'un evenement n'existent que pendant qu'il dure.
      where (q.evenement is null or q.evenement = evenement_en_cours())
        -- Un filleul ne peut pas inviter : les quetes d'invitation lui sont cachees.
        and not (q.metric = 'invite' and est_filleul(p))
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------- la vitrine sur la fiche publique
-- La vitrine est visible de tous : c'est fait pour etre montre.
create or replace function public.player_profile(p_pseudo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare moi uuid := auth.uid(); o profiles; ami boolean; total int; possede int; rev int; rev_total int;
begin
  if moi is null then raise exception 'non connecte'; end if;
  perform garde_beta();
  select * into o from profiles where lower(pseudo) = lower(trim(p_pseudo));
  if not found then return 'null'::jsonb; end if;

  ami := o.id = moi or exists (
    select 1 from friendships
     where a = least(moi, o.id) and b = greatest(moi, o.id) and accepte);

  -- `not promo`, des deux cotes. Les cartes Promo vivent dans `cards` pour
  -- pouvoir entrer dans une collection, mais elles n'appartiennent pas a
  -- l'extension : ni dans son total, ni dans son pourcentage (voir la table
  -- `cards` et sync_collection_quests dans 01_schema.sql).
  --
  -- Sans ce garde-fou, la fiche d'un joueur annoncait « / 126 » pendant que
  -- son propre ecran Collection et le palier des 100 % comptaient 122. Deux
  -- ecrans, deux verites, et un joueur a 122/122 qui se voyait incomplet.
  select count(*) into total from cards where not promo;
  select count(*) into possede
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and not k.promo;
  -- Version 2.0 : les Reverses, comptees a part.
  select count(*) into rev_total from cards where reverse;
  select count(*) into rev
    from collection c join cards k on k.id = c.card_id
   where c.user_id = o.id and c.qty > 0 and k.reverse;

  return jsonb_build_object(
    'pseudo', o.pseudo, 'avatar', o.avatar, 'frame', o.frame,
    'photo', photo_discord(o.id),
    'is_admin', o.is_admin, 'streak', o.streak,
    'packs_opened', o.packs_opened, 'trades_done', o.trades_done,
    'membre_depuis', o.created_at,
    'possede', possede, 'total', total,
    'reverses', rev, 'reverses_total', rev_total,
    'titre', o.titre, 'banniere', o.banniere, 'devise', o.devise,
    'vitrine', to_jsonb(o.vitrine),
    'succes', succes_de(o.id),
    'ami', ami,
    'moi', o.id = moi,
    'col', case when ami then
      coalesce((select jsonb_object_agg(card_id, qty) from collection
                 where user_id = o.id and qty > 0), '{}'::jsonb)
      else null end,
    -- Version 2.1 (22_garder.sql) : entre amis, ce qu'il garde au-dela d'un
    -- exemplaire. Ses doublons, ce sont les exemplaires en plus.
    'garde', case when ami then
      coalesce((select jsonb_object_agg(x.card_id, x.g) from (
                  select card_id, garde_de(o.id, card_id) as g from collection
                   where user_id = o.id and qty > 0) x where x.g > 1), '{}'::jsonb)
      else null end);
end $$;

grant execute on function public.me, public.player_profile to authenticated;


-- =====================================================================
--  Mate TCG Online — le recyclage des doublons, et la fabrication
--  A executer apres 11_boite.sql. Rejouable sans danger.
--
--  On jette un doublon, on touche des Fragments. Avec des Fragments, on
--  fabrique une carte qui manque. Toutes les raretes de l'extension se
--  recyclent et se fabriquent ; jamais ce qui est hors extension (Promos,
--  Essences Brillantes, carte unique). On garde toujours au moins un
--  exemplaire de chaque carte : recycler ne fait jamais reculer la
--  collection.
--
--  Les montants sont dans cfg() (supabase/01_schema.sql) :
--      recyclage    Essence 1 · Commune 2 · Peu commune 5 · Rare 20
--                   Epique 80 · Legendaire 250
--      fabrication  Essence 20 · Commune 40 · Peu commune 100 · Rare 400
--                   Epique 2 000 · Legendaire 8 000
--  Les Reverses (version 2.0, ouvertes en 2.1.4) : recyclees comme leur
--  classique, fabriquees au prix de prix_reverse (22c_reverses.sql) :
--                   Commune 400 · Peu commune 500 · Rare 2 400
--
--  ------------------------------------------------------------------
--  POURQUOI DES FRAGMENTS, ET PLUS D'ECLATS
--
--  Recycler contre des Eclats posait un probleme sans solution : un joueur
--  regulier produit ~6 300 Eclats de doublons par semaine une fois sa
--  collection avancee. Plafonne, le recyclage ne permettait pas de se
--  debarrasser de ses cartes ; deplafonne, il triplait les Eclats, et les
--  Eclats achetent des boosters — la boucle s'emballait.
--
--  Les Fragments n'achetent qu'une chose : une carte qu'on n'a pas. Ils ne
--  rachetent pas de boosters, il n'y a donc plus de boucle, et plus de
--  plafond. Ils transforment aussi la fin de collection : la derniere
--  Legendaire mettait ~42 jours a sortir en moyenne, sans le moindre progres
--  visible ; chaque booster rempli de doublons la rapproche desormais.
--
--  Simulation (six boosters par jour, tous les doublons recycles), mediane
--  du temps pour finir l'extension :
--                               sans fabrication   avec   (quart le plus lent)
--      joueur a  60 boosters ....   112 jours      72 j      147 -> 86 j
--      joueur a 120 boosters ....    92 jours      62 j      124 -> 73 j
--  ~2 200 Fragments par semaine pour un joueur regulier : une Epique tous
--  les six jours, ou une Legendaire en un peu moins de quatre semaines.
-- =====================================================================

-- Le journal : qui a recycle quoi, et quand. Il sert a retrouver ce qui
-- s'est passe si quelqu'un ecrit « j'ai perdu une carte ». `eclats` date de
-- l'ancien recyclage ; les recyclages d'aujourd'hui y mettent 0 et remplissent
-- `fragments`.
create table if not exists public.recyclages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  card_id    text not null references public.cards on delete cascade,
  qty        integer not null check (qty > 0),
  eclats     integer not null check (eclats >= 0),
  created_at timestamptz not null default now()
);
alter table public.recyclages add column if not exists fragments integer not null default 0;
create index if not exists recyclages_user_idx on public.recyclages (user_id, created_at desc);

alter table public.recyclages enable row level security;
-- Aucune policy : le navigateur ne lit pas le journal.
revoke all on public.recyclages from anon, authenticated;

-- Le lundi minuit, heure de Paris : la meme frontiere que les quetes
-- hebdomadaires (period_key dans 01_schema.sql).
create or replace function public.debut_semaine() returns timestamptz
language sql stable as $$
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

-- Les Eclats touches cette semaine avec l'ancien recyclage. Plus rien ne
-- l'appelle ; elle reste pour qui voudrait relire le journal.
create or replace function public.recyclage_semaine(p uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(eclats), 0)::int from recyclages
   where user_id = p and created_at >= debut_semaine();
$$;

revoke all on function public.recyclage_semaine from public, anon, authenticated;

-- ------------------------------------------------------------- recycler
-- `p_lots` : [{ "carte": "c012", "n": 2 }, …]. Tout passe, ou rien : un seul
-- lot refuse annule l'ensemble.
--
-- Ce qui est recyclable, carte par carte : ce qu'on possede, moins l'exemplaire
-- qu'on garde toujours, moins ceux qu'on a proposes dans une demande
-- d'echange encore en attente — sinon l'echange, une fois accepte, prendrait
-- le dernier exemplaire et ferait reculer la collection.
create or replace function public.recycler(p_lots jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p uuid := auth.uid(); lot jsonb; cid text; n int; k cards;
  possede int; reserve int; prix int; total int := 0; nb int := 0; vus text[] := '{}'; garde int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  if p_lots is null or jsonb_typeof(p_lots) <> 'array' or jsonb_array_length(p_lots) = 0 then
    raise exception 'Rien à recycler.';
  end if;
  if jsonb_array_length(p_lots) > 150 then raise exception 'Trop de cartes d''un coup.'; end if;

  -- Un recyclage a la fois par joueur : deux envois partis ensemble ne
  -- doivent pas compter deux fois le meme exemplaire.
  perform 1 from profiles where id = p for update;

  for lot in select value from jsonb_array_elements(p_lots) loop
    cid := lot->>'carte';
    if jsonb_typeof(lot->'n') <> 'number' then raise exception 'Quantité invalide.'; end if;
    n := (lot->>'n')::int;
    if cid is null or n < 1 then raise exception 'Quantité invalide.'; end if;
    if cid = any(vus) then raise exception 'Une carte apparaît deux fois.'; end if;
    vus := vus || cid;

    select * into k from cards where id = cid;
    if not found then raise exception 'Carte inconnue.'; end if;
    if k.promo and not k.reverse then raise exception 'Cette carte ne se recycle pas.'; end if;
    -- Les Reverses (version 2.0) se recyclent et se fabriquent ensemble, a
    -- partir de la date d'ouverture (reverses_ouvertes, 22c_reverses.sql).
    -- Une Reverse rapporte comme sa classique.
    if k.reverse and not reverses_ouvertes() then
      raise exception 'Les Reverses ne se recyclent pas encore.';
    end if;
    prix := cfg('recyclage_' || k.rar);
    if prix is null then raise exception 'Cette carte ne se recycle pas.'; end if;

    select qty into possede from collection where user_id = p and card_id = cid for update;
    select count(*) into reserve from trades
     where from_user = p and offer_card = cid and status = 'pending';
    -- Version 2.1 : ce que le joueur a choisi de garder (garde_de,
    -- 22_garder.sql), un exemplaire au moins.
    garde := garde_de(p, cid);
    if coalesce(possede, 0) - garde - reserve < n then
      if garde > 1 then
        raise exception 'Tu as choisi de garder % exemplaires de « % ».', garde, k.nom;
      end if;
      raise exception 'Pas assez de doublons de « % » : tu gardes toujours un exemplaire.', k.nom;
    end if;

    update collection set qty = qty - n where user_id = p and card_id = cid;
    insert into recyclages (user_id, card_id, qty, eclats, fragments) values (p, cid, n, 0, n * prix);
    total := total + n * prix;
    nb := nb + n;
  end loop;

  update profiles set fragments = fragments + total where id = p;
  -- La quete quotidienne « Petit menage » (04_seed.sql) compte les cartes.
  perform bump_quests(p, 'recycle', nb);
  return me();
end $$;

-- ------------------------------------------------------------- fabriquer
-- Une carte de l'extension qu'on ne possede pas, contre des Fragments.
-- Seulement une carte qui manque : fabriquer un doublon pour le recycler ne
-- rapporterait rien, mais fabriquer une Legendaire qu'on a deja ne sert a
-- rien non plus, et c'est ce qui garde les doublons de haute rarete rares.
create or replace function public.fabriquer(p_carte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); k cards; cout int; reste int;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  select * into k from cards where id = p_carte;
  if not found then raise exception 'Carte inconnue.'; end if;
  if k.promo and not k.reverse then raise exception 'Cette carte ne se fabrique pas.'; end if;
  cout := cfg('fabrication_' || k.rar);
  -- Les Reverses (version 2.0) : fermees au lancement, sinon les Fragments
  -- accumules rempliraient la collection Reverse d'un coup ; ouvertes a la
  -- fin de Reflets, au prix de leur vraie rarete (version 2.1.4 :
  -- reverses_ouvertes et prix_reverse, 22c_reverses.sql).
  if k.reverse then
    if not reverses_ouvertes() then
      raise exception 'La fabrication des Reverses n''est pas encore ouverte.';
    end if;
    cout := prix_reverse(k.rar);
  end if;
  if cout is null then raise exception 'Cette carte ne se fabrique pas.'; end if;

  select fragments into reste from profiles where id = p for update;
  if exists (select 1 from collection where user_id = p and card_id = p_carte and qty > 0) then
    raise exception 'Tu possèdes déjà cette carte.';
  end if;
  if reste < cout then raise exception 'Pas assez de Fragments.'; end if;

  update profiles set fragments = fragments - cout, fabrications = fabrications + 1 where id = p;
  insert into collection (user_id, card_id, qty) values (p, p_carte, 1)
    on conflict (user_id, card_id) do update set qty = collection.qty + 1;

  perform sync_collection_quests(p);
  perform check_promos(p);
  return me();
end $$;

revoke all on function public.recycler, public.fabriquer from public, anon;
grant execute on function public.recycler, public.fabriquer to authenticated;


-- =====================================================================
--  Mate TCG Online — le calendrier de fin octobre 2026 (a jouer une fois)
--  Apres 22b_echauffement.sql et 22c_reverses.sql. Pas dans TOUT.sql : ce
--  sont des dates.
--
--   · Reflets se termine le vendredi 23 octobre a minuit (et non plus a midi) ;
--   · a la meme minute, les Reverses se recyclent et se fabriquent
--     (22c_reverses.sql) ;
--   · son recap reste jusqu'au dimanche 25 octobre a minuit ;
--   · L'Echauffement commence a cette minute-la (lundi 26, 0 h), et dure neuf
--     jours : un defi de plus chaque jour jusqu'au dimanche 1er novembre,
--     puis deux jours pour rattraper (fin le mercredi 4 novembre, 0 h).
--
--  Heure de Paris. Le changement d'heure tombe dans la nuit du samedi 24 au
--  dimanche 25 : vendredi minuit est en heure d'ete (+02), dimanche minuit en
--  heure d'hiver (+01).
--
--  A jouer AVANT vendredi midi : passe midi, Reflets serait deja fini (le
--  rejouer apres le rouvrirait jusqu'a minuit, sans rien perdre).
-- =====================================================================

update public.evenements
   set fin = timestamptz '2026-10-24 00:00:00+02',
       recap_jusqua = timestamptz '2026-10-26 00:00:00+01'
 where code = 'reflets';

insert into public.ech_saison (id, debut, fin)
values (1, timestamptz '2026-10-26 00:00:00+01', timestamptz '2026-11-04 00:00:00+01')
on conflict (id) do update set debut = excluded.debut, fin = excluded.fin;

update public.parametres set reverses_des = timestamptz '2026-10-24 00:00:00+02' where id = 1;

-- Pour verifier (heure de Paris) :
select code, fin at time zone 'Europe/Paris' as fin_paris, recap_jusqua at time zone 'Europe/Paris' as recap_jusqua_paris
  from public.evenements where code = 'reflets';
select debut at time zone 'Europe/Paris' as debut_paris, fin at time zone 'Europe/Paris' as fin_paris from public.ech_saison;
select reverses_des at time zone 'Europe/Paris' as reverses_paris, reverses_ouvertes() as ouvertes from public.parametres;
