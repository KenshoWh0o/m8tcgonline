-- =====================================================================
--  Mate TCG Online — les cadeaux
--  A executer apres 15_evenements.sql (ou apres 17_maj-quetes.sql sur une
--  base deja installee). Rejouable sans danger.
--
--  Un administrateur offre a un ou plusieurs joueurs des Eclats, des
--  boosters, des Fragments et/ou une carte, avec un mot. Le joueur le
--  decouvre a sa prochaine visite : un paquet cadeau a ouvrir, puis ce qu'il
--  contenait. Rien n'est verse avant qu'il l'ouvre — c'est l'ouverture qui
--  credite le compte, une seule fois.
--
--  Depuis le jeu : Labo > Offrir un cadeau. A la main : en bas du fichier.
-- =====================================================================

-- Les boosters offerts sont comptes a part : open_pack (03_rpc.sql) les ouvre
-- en premier, et ils ne peuvent pas contenir la carte unique.
alter table public.profiles add column if not exists tickets_offerts integer not null default 0;

create table if not exists public.cadeaux (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles on delete cascade,
  eclats     integer not null default 0 check (eclats    between 0 and 100000),
  boosters   integer not null default 0 check (boosters  between 0 and 100),
  fragments  integer not null default 0 check (fragments between 0 and 100000),
  carte      text references public.cards,
  message    text not null default '',
  auteur     uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  ouvert_le  timestamptz,
  constraint cadeau_pas_vide check (eclats > 0 or boosters > 0 or fragments > 0 or carte is not null)
);
create index if not exists cadeaux_user_idx on public.cadeaux (user_id) where ouvert_le is null;

alter table public.cadeaux enable row level security;
-- Aucune policy : le navigateur passe par les fonctions ci-dessous.
revoke all on public.cadeaux from anon, authenticated;

-- ------------------------------------------------------- mes cadeaux
-- Ceux qui attendent d'etre ouverts, du plus ancien au plus recent.
create or replace function public.mes_cadeaux() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p uuid := auth.uid();
begin
  if p is null then raise exception 'non connecte'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'eclats', c.eclats, 'boosters', c.boosters,
             'fragments', c.fragments, 'carte', c.carte, 'message', c.message,
             'de', (select pseudo from profiles where id = c.auteur),
             'quand', c.created_at) order by c.id)
      from cadeaux c
     where c.user_id = p and c.ouvert_le is null), '[]'::jsonb);
end $$;

-- ----------------------------------------------------- ouvrir un cadeau
-- La mise a jour `where ouvert_le is null` tranche : un cadeau ouvert deux
-- fois en meme temps (deux onglets) ne paie qu'une fois.
create or replace function public.ouvrir_cadeau(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p uuid := auth.uid(); c cadeaux;
begin
  if p is null then raise exception 'non connecte'; end if;
  perform garde_beta();

  update cadeaux set ouvert_le = now()
   where id = p_id and user_id = p and ouvert_le is null
   returning * into c;
  if not found then raise exception 'Ce cadeau a déjà été ouvert.'; end if;

  -- Les boosters offerts s'ajoutent par-dessus le plafond, comme ceux de la
  -- boutique, et sont comptes a part (tickets_offerts) : sans carte unique.
  update profiles set shards    = shards + c.eclats,
                      tickets   = tickets + c.boosters,
                      tickets_offerts = tickets_offerts + c.boosters,
                      fragments = fragments + c.fragments
   where id = p;

  if c.carte is not null then
    insert into collection (user_id, card_id, qty) values (p, c.carte, 1)
      on conflict (user_id, card_id) do update set qty = collection.qty + 1;
    -- Une carte qui se vend en boutique (une Promo) est notee comme acquise :
    -- la boutique ne la revendra pas a qui l'a recue.
    insert into inventory (user_id, item_id, qty)
    select p, s.id, 1 from shop_items s where s.carte_id = c.carte and s.unique_buy
    on conflict (user_id, item_id) do nothing;
    perform sync_collection_quests(p);
    perform check_promos(p);
  end if;

  return me();
end $$;

-- --------------------------------------------------- offrir (administrateur)
-- `p_joueurs` : les identifiants des destinataires. Un cadeau par joueur.
create or replace function public.offrir_cadeau(p_joueurs uuid[], p_eclats int, p_boosters int,
                                                p_fragments int, p_carte text, p_message text)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if coalesce(array_length(p_joueurs, 1), 0) = 0 then raise exception 'Choisis au moins un joueur.'; end if;
  if coalesce(p_eclats, 0) = 0 and coalesce(p_boosters, 0) = 0 and coalesce(p_fragments, 0) = 0
     and nullif(p_carte, '') is null then
    raise exception 'Le cadeau est vide.';
  end if;
  if nullif(p_carte, '') is not null and not exists (select 1 from cards where id = p_carte) then
    raise exception 'Carte inconnue.';
  end if;
  -- La carte unique ne s'offre pas : elle se trouve.
  if exists (select 1 from cards where id = p_carte and rar = 'UN') then
    raise exception 'La carte unique ne s''offre pas.';
  end if;

  insert into cadeaux (user_id, eclats, boosters, fragments, carte, message, auteur)
  select pr.id, greatest(coalesce(p_eclats, 0), 0), greatest(coalesce(p_boosters, 0), 0),
         greatest(coalesce(p_fragments, 0), 0), nullif(p_carte, ''),
         left(trim(coalesce(p_message, '')), 300), auth.uid()
    from profiles pr where pr.id = any(p_joueurs);
  get diagnostics n = row_count;
  return n;
end $$;

-- -------------------------------------------- les joueurs (administrateur)
-- De quoi choisir a qui offrir : depuis quand on joue, ou on en est.
create or replace function public.admin_joueurs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecte'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', pr.id, 'pseudo', pr.pseudo, 'avatar', pr.avatar, 'frame', pr.frame,
             'inscrit', pr.created_at, 'vu', pr.last_checkin,
             'boosters', pr.packs_opened, 'eclats', pr.shards,
             'cartes', (select count(*) from collection c join cards k on k.id = c.card_id
                         where c.user_id = pr.id and c.qty > 0 and not k.promo),
             'cadeaux', (select count(*) from cadeaux g where g.user_id = pr.id),
             'en_attente', (select count(*) from cadeaux g where g.user_id = pr.id and g.ouvert_le is null))
           order by pr.created_at)
      from profiles pr), '[]'::jsonb);
end $$;

revoke all on function public.mes_cadeaux, public.ouvrir_cadeau, public.offrir_cadeau,
  public.admin_joueurs from public, anon;
grant execute on function public.mes_cadeaux, public.ouvrir_cadeau, public.offrir_cadeau,
  public.admin_joueurs to authenticated;

-- =====================================================================
--  Offrir a la main, dans le SQL Editor (meme effet que le Labo) :
-- =====================================================================
-- insert into public.cadeaux (user_id, eclats, boosters, fragments, carte, message)
-- select id, 3000, 10, 0, null, 'Bienvenue, et merci d''etre venu !'
--   from public.profiles where lower(pseudo) in (lower('Pseudo1'), lower('Pseudo2'));
--
--  Les cadeaux pas encore ouverts :
-- select p.pseudo, c.* from public.cadeaux c join public.profiles p on p.id = c.user_id
--  where c.ouvert_le is null;
--
--  En reprendre un avant qu'il soit ouvert :
-- delete from public.cadeaux where id = 42 and ouvert_le is null;
