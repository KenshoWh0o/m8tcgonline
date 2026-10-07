-- =====================================================================
--  Mate TCG Online — tirages, succes, evenements et chasse
--  A executer apres 14_classement.sql. Rejouable sans danger.
--
--  Quatre choses, qui se tiennent :
--    · tirages   : le journal de chaque booster ouvert. Il nourrit
--                  l'historique et les statistiques du joueur (mes_tirages),
--                  et le succes « godpack ».
--    · succes    : des badges calcules a la volee a partir de ce que le
--                  serveur sait deja (succes_de). Rien a stocker, rien a
--                  synchroniser : un succes ne peut pas mentir.
--    · evenements: une periode, avec ce qu'elle change. Aujourd'hui, une
--                  seule chose : le rythme de recharge des boosters.
--    · chasse    : la carte unique. Une ligne, un gagnant, une seule fois.
-- =====================================================================

-- --------------------------------------------------------------- tirages
create table if not exists public.tirages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  cartes     text[] not null,
  god        boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tirages_user_idx on public.tirages (user_id, id desc);

alter table public.tirages enable row level security;
-- Aucune policy : le navigateur passe par mes_tirages().
revoke all on public.tirages from anon, authenticated;

-- ------------------------------------------------------------ evenements
-- `ticket_minutes` : la recharge pendant l'evenement (120 = boosters
-- doubles). Vide : l'evenement ne change pas le rythme.
create table if not exists public.evenements (
  id             bigint generated always as identity primary key,
  titre          text not null,
  texte          text not null default '',
  debut          timestamptz not null,
  fin            timestamptz not null,
  ticket_minutes integer check (ticket_minutes is null or ticket_minutes between 10 and 1440),
  constraint evenement_dans_l_ordre check (fin > debut)
);

alter table public.evenements enable row level security;
revoke all on public.evenements from anon, authenticated;

-- -------------------------------------------------------------- chasse
-- Une seule ligne. `gagnant` vide : la carte est encore a trouver. La mise a
-- jour qui le remplit (open_pack, 03_rpc.sql) porte `where gagnant is null` :
-- c'est elle, et pas le navigateur, qui garantit qu'il n'y a qu'un gagnant.
create table if not exists public.chasse (
  id         int primary key check (id = 1),
  carte      text not null references public.cards,
  active     boolean not null default false,
  gagnant    uuid references public.profiles on delete set null,
  trouvee_le timestamptz
);
insert into public.chasse (id, carte, active) values (1, 'u01', false)
on conflict (id) do nothing;
-- L'heure d'ouverture : une chasse active ne commence qu'a cette heure-la.
-- Vide : des qu'elle est active. Elle permet de tout installer la veille.
alter table public.chasse add column if not exists ouvre_le timestamptz;

-- Celui qui a tire la carte unique a son cadre d'avatar, « Unique » : pose
-- par open_pack au moment du tirage, et rattrape ici pour une carte tiree
-- avant que le cadre existe (version 1.5.6).
insert into public.inventory (user_id, item_id, qty)
select gagnant, 'f_unique', 1 from public.chasse where gagnant is not null
on conflict (user_id, item_id) do nothing;
update public.profiles p set frame = 'f_unique'
  from public.chasse c where c.gagnant = p.id and p.frame = 'default';

alter table public.chasse enable row level security;
revoke all on public.chasse from anon, authenticated;

-- ----------------------------------------------------- le rythme en cours
-- 240 minutes d'ordinaire ; celui de l'evenement en cours s'il en change.
create or replace function public.minutes_recharge() returns integer
language plpgsql stable security definer set search_path = public as $$
declare m int;
begin
  select e.ticket_minutes into m from evenements e
   where e.ticket_minutes is not null and now() >= e.debut and now() < e.fin
   order by e.debut desc limit 1;
  return coalesce(m, cfg('ticket_minutes'));
end $$;

-- L'evenement en cours, pour le bandeau et la fenetre des nouveautes. Sans
-- evenement en cours, le prochain s'il commence dans les quinze jours, marque
-- `a_venir` : le bandeau affiche le compte a rebours avant le depart.
create or replace function public.evenement_actif() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce(
    (select jsonb_build_object('titre', e.titre, 'texte', e.texte,
                               'debut', e.debut, 'fin', e.fin,
                               'ticket_minutes', e.ticket_minutes, 'a_venir', false)
       from evenements e
      where now() >= e.debut and now() < e.fin
      order by e.debut desc limit 1),
    (select jsonb_build_object('titre', e.titre, 'texte', e.texte,
                               'debut', e.debut, 'fin', e.fin,
                               'ticket_minutes', e.ticket_minutes, 'a_venir', true)
       from evenements e
      where e.debut > now() and e.debut < now() + interval '15 days'
      order by e.debut limit 1));
end $$;

-- Ou en est la chasse : ouverte ou non, trouvee ou non, et par qui. Le
-- gagnant est public : c'est tout l'interet.
create or replace function public.chasse_etat() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  -- `active` : ouverte ET l'heure d'ouverture passee. `ouvre_le` permet au
  -- navigateur d'annoncer l'ouverture a venir.
  return (select jsonb_build_object('carte', c.carte,
                                    'active', c.active and (c.ouvre_le is null or now() >= c.ouvre_le),
                                    'ouvre_le', case when c.active then c.ouvre_le end,
                                    'trouvee', c.gagnant is not null,
                                    'gagnant', (select pseudo from profiles where id = c.gagnant),
                                    'trouvee_le', c.trouvee_le)
            from chasse c where c.id = 1);
end $$;

-- ---------------------------------------------------------------- succes
-- Les identifiants doivent rester ceux de SUCCES dans js/config.js, qui
-- porte les noms et les descriptions. Un succes lie a la collection peut
-- disparaitre si l'on cede la carte qui le tenait : c'est le prix d'un calcul
-- sans stockage, et c'est rare (les Promos et les Brillantes ne s'echangent
-- pas).
create or replace function public.succes_de(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pr profiles; s text[] := '{}';
  ext int; ext_total int; leg int; leg_total int; br int; br_total int; uni boolean;
begin
  select * into pr from profiles where id = p;
  if not found then return '[]'::jsonb; end if;

  select count(*) filter (where not k.promo),
         count(*) filter (where not k.promo and k.rar = 'L'),
         count(*) filter (where k.rar = 'BR'),
         coalesce(bool_or(k.rar = 'UN'), false)
    into ext, leg, br, uni
    from collection c join cards k on k.id = c.card_id
   where c.user_id = p and c.qty > 0;
  select count(*) filter (where not promo),
         count(*) filter (where not promo and rar = 'L'),
         count(*) filter (where rar = 'BR')
    into ext_total, leg_total, br_total
    from cards;

  if pr.packs_opened >= 1   then s := array_append(s, 'premier_booster'); end if;
  if pr.packs_opened >= 100 then s := array_append(s, 'boosters_100'); end if;
  if pr.packs_opened >= 500 then s := array_append(s, 'boosters_500'); end if;
  if ext * 2 >= ext_total   then s := array_append(s, 'collection_50'); end if;
  if ext >= ext_total       then s := array_append(s, 'master_set'); end if;
  if leg >= leg_total       then s := array_append(s, 'toutes_legendaires'); end if;
  if pr.trades_done >= 1    then s := array_append(s, 'premier_echange'); end if;
  if pr.trades_done >= 25   then s := array_append(s, 'negociant'); end if;
  if greatest(pr.serie_max, pr.streak) >= 7  then s := array_append(s, 'serie_7'); end if;
  if greatest(pr.serie_max, pr.streak) >= 30 then s := array_append(s, 'serie_30'); end if;
  if exists (select 1 from tirages t where t.user_id = p and t.god) then s := array_append(s, 'godpack'); end if;
  if br >= 1                then s := array_append(s, 'brillante'); end if;
  if br_total > 0 and br >= br_total then s := array_append(s, 'toutes_brillantes'); end if;
  if pr.fabrications >= 1   then s := array_append(s, 'artisan'); end if;
  if uni                    then s := array_append(s, 'unique'); end if;
  -- Ceux qui etaient la avant la version 1.5.
  if pr.created_at < timestamptz '2026-10-04 00:00:00+02' then s := array_append(s, 'pionnier'); end if;

  return to_jsonb(s);
end $$;

-- --------------------------------------------------------- mes tirages
-- Les trente derniers boosters, et des statistiques sur tout le journal :
-- combien de cartes de chaque rarete, combien de godpacks et de Brillantes.
-- Le journal commence a la version 1.5 : les boosters ouverts avant n'y
-- sont pas (`depuis` le dit).
create or replace function public.mes_tirages() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  return jsonb_build_object(
    'total',  (select count(*) from tirages where user_id = p),
    'god',    (select count(*) from tirages where user_id = p and god),
    'depuis', (select min(created_at) from tirages where user_id = p),
    'raretes', coalesce((
      select jsonb_object_agg(r.rar, r.n)
        from (select k.rar, count(*) as n
                from tirages t, unnest(t.cartes) as u(cid)
                join cards k on k.id = u.cid
               where t.user_id = p
               group by k.rar) r), '{}'::jsonb),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object('quand', t.created_at, 'cartes', to_jsonb(t.cartes), 'god', t.god)
                       order by t.id desc)
        from (select * from tirages where user_id = p order by id desc limit 30) t), '[]'::jsonb));
end $$;

-- Rouages internes (appeles par me(), player_profile, open_pack) : pas
-- depuis le navigateur. mes_tirages, elle, est une action du joueur.
revoke all on function public.minutes_recharge, public.evenement_actif, public.chasse_etat,
  public.succes_de from public, anon, authenticated;
revoke all on function public.mes_tirages from public, anon;
grant execute on function public.mes_tirages to authenticated;

-- =====================================================================
--  Lancer un evenement, a la main dans le SQL Editor :
-- =====================================================================
-- insert into public.evenements (titre, texte, debut, fin, ticket_minutes) values
--   ('Boosters doublés', 'Un booster toutes les 2 h au lieu de 4.', now(), now() + interval '3 days', 120);
--
--  L'arreter avant l'heure :
-- update public.evenements set fin = now() where fin > now();
--
--  Ouvrir la chasse a la carte unique (une seule fois : une carte trouvee
--  le reste), tout de suite ou a une heure donnee :
-- update public.chasse set active = true, ouvre_le = null where id = 1;
-- update public.chasse set active = true, ouvre_le = timestamptz '2026-10-04 12:00:00+02' where id = 1;
