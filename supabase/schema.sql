-- =====================================================================
--  ONE NIGHT AT ÍROTTKŐ – jegyértékesítés alap séma (Supabase / Postgres)
--  Dinamikus (lépcsős) árazás: ahogy fogynak a jegyek, nyílik a következő kör.
--  Futtatás: Supabase Dashboard → SQL Editor → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) ESEMÉNY
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  venue        text not null,
  starts_at    timestamptz,               -- null = "Részletek hamarosan"
  doors_at     time default '19:00',
  capacity     int  not null check (capacity > 0),
  sales_open   boolean not null default false,
  hold_minutes int  not null default 15,   -- fizetésig foglalva tartott jegy
  max_per_order int not null default 10,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) ÁRLÉPCSŐK (körök)
--    kind = 'standard' → sorban nyílnak (sort_order szerint)
--    kind = 'vip'      → külön kontingens, fix ár
-- ---------------------------------------------------------------------
create table if not exists public.ticket_tiers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  kind        text not null default 'standard' check (kind in ('standard','vip')),
  price_huf   int  not null check (price_huf >= 0),
  quantity    int  not null check (quantity > 0),
  sort_order  int  not null default 0,
  perks       text[] default '{}',
  unique (event_id, kind, sort_order)
);

-- ---------------------------------------------------------------------
-- 3) RENDELÉSEK
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id),
  email            text not null,
  full_name        text not null,
  phone            text,
  total_huf        int  not null default 0,
  status           text not null default 'pending'
                   check (status in ('pending','paid','expired','cancelled','refunded')),
  payment_provider text,            -- 'stripe' | 'barion' | ...
  payment_ref      text,            -- payment intent / session id
  expires_at       timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists orders_event_status_idx on public.orders(event_id, status);

-- ---------------------------------------------------------------------
-- 4) JEGYEK (darabonként – egy QR / wallet pass = egy sor)
-- ---------------------------------------------------------------------
create table if not exists public.tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  event_id       uuid not null references public.events(id),
  tier_id        uuid not null references public.ticket_tiers(id),
  price_huf      int  not null,                      -- a vásárláskori ár rögzítve
  code           text unique not null default upper(encode(gen_random_bytes(9), 'hex')),
  holder_name    text,
  status         text not null default 'reserved'
                 check (status in ('reserved','valid','used','void')),
  checked_in_at  timestamptz,
  checked_in_by  text,
  wallet_apple_serial  text,
  wallet_google_id     text,
  created_at     timestamptz not null default now()
);
create index if not exists tickets_tier_status_idx on public.tickets(tier_id, status);

-- ---------------------------------------------------------------------
-- 5) ÉRTESÍTÉS-LISTA (landing: "Szólj, ha indul a jegyeladás")
-- ---------------------------------------------------------------------
create table if not exists public.signups (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

-- =====================================================================
--  LÁTVÁNYOS RÉSZ: publikus állapot nézet (landing ezt olvassa)
--  "eladott" = fizetett + még le nem járt foglalás
-- =====================================================================
create or replace view public.tier_status as
select
  t.id, t.event_id, t.name, t.kind, t.price_huf, t.quantity, t.sort_order, t.perks,
  coalesce(s.taken, 0)                          as taken,
  greatest(t.quantity - coalesce(s.taken,0), 0) as remaining
from public.ticket_tiers t
left join lateral (
  select count(*)::int as taken
  from public.tickets k
  join public.orders o on o.id = k.order_id
  where k.tier_id = t.id
    and k.status in ('reserved','valid','used')
    and (o.status = 'paid' or (o.status = 'pending' and o.expires_at > now()))
) s on true;

-- Landing-hez egy hívásban: esemény + körök + aktuális kör
create or replace function public.get_event_public(p_slug text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'event', (select row_to_json(e) from (
        select id, slug, title, venue, starts_at, doors_at, capacity, sales_open
        from events where slug = p_slug) e),
    'tiers', coalesce((select json_agg(ts order by ts.kind, ts.sort_order)
        from tier_status ts join events e on e.id = ts.event_id
        where e.slug = p_slug), '[]'::json),
    'sold_total', (select coalesce(sum(ts.taken),0) from tier_status ts
        join events e on e.id = ts.event_id where e.slug = p_slug and ts.kind = 'standard')
  );
$$;

-- =====================================================================
--  FOGLALÁS – túlértékesítés ellen zárolással.
--  Jegyenként osztja ki a legolcsóbb még nyitott körből, így ha egy
--  rendelés átlóg a kör határán, a jegyek egy része már a következő áron megy.
-- =====================================================================
create or replace function public.reserve_tickets(
  p_slug text, p_qty int, p_email text, p_name text,
  p_phone text default null, p_kind text default 'standard'
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_event  events%rowtype;
  v_order  uuid;
  v_tier   record;
  v_left   int := p_qty;
  v_take   int;
  v_total  int := 0;
begin
  select * into v_event from events where slug = p_slug for update;   -- esemény szintű zár
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not v_event.sales_open then raise exception 'SALES_CLOSED'; end if;
  if p_qty < 1 or p_qty > v_event.max_per_order then raise exception 'INVALID_QTY'; end if;

  -- lejárt foglalások felszabadítása
  update orders set status = 'expired'
   where event_id = v_event.id and status = 'pending' and expires_at <= now();

  insert into orders(event_id, email, full_name, phone, expires_at)
  values (v_event.id, lower(trim(p_email)), trim(p_name), p_phone,
          now() + make_interval(mins => v_event.hold_minutes))
  returning id into v_order;

  for v_tier in
    select * from tier_status
     where event_id = v_event.id and kind = p_kind and remaining > 0
     order by sort_order
  loop
    exit when v_left = 0;
    v_take := least(v_left, v_tier.remaining);
    insert into tickets(order_id, event_id, tier_id, price_huf, holder_name)
    select v_order, v_event.id, v_tier.id, v_tier.price_huf, trim(p_name)
    from generate_series(1, v_take);
    v_total := v_total + v_take * v_tier.price_huf;
    v_left  := v_left - v_take;
  end loop;

  if v_left > 0 then raise exception 'SOLD_OUT'; end if;   -- rollback az egészre

  update orders set total_huf = v_total where id = v_order;
  return json_build_object('order_id', v_order, 'total_huf', v_total,
                           'expires_at', now() + make_interval(mins => v_event.hold_minutes));
end $$;

-- Fizetés után (Stripe webhook → service_role hívja)
create or replace function public.mark_order_paid(p_order uuid, p_provider text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status='paid', paid_at=now(), payment_provider=p_provider, payment_ref=p_ref
   where id = p_order and status in ('pending','expired');
  update tickets set status='valid' where order_id = p_order and status='reserved';
end $$;

-- Beléptetés (szkenner app → service_role / staff role)
create or replace function public.check_in(p_code text, p_staff text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v tickets%rowtype; v_tier text;
begin
  select * into v from tickets where code = upper(p_code) for update;
  if not found then return json_build_object('ok',false,'reason','NOT_FOUND'); end if;
  select name into v_tier from ticket_tiers where id = v.tier_id;
  if v.status = 'used' then
    return json_build_object('ok',false,'reason','ALREADY_USED','at',v.checked_in_at,'tier',v_tier);
  elsif v.status <> 'valid' then
    return json_build_object('ok',false,'reason','INVALID_'||upper(v.status));
  end if;
  update tickets set status='used', checked_in_at=now(), checked_in_by=p_staff where id=v.id;
  return json_build_object('ok',true,'name',v.holder_name,'tier',v_tier);
end $$;

-- =====================================================================
--  RLS – anon kulcs csak olvasni és feliratkozni tud
-- =====================================================================
alter table public.events       enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.orders       enable row level security;
alter table public.tickets      enable row level security;
alter table public.signups      enable row level security;

drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events for select using (true);
drop policy if exists "public read tiers" on public.ticket_tiers;
create policy "public read tiers"  on public.ticket_tiers for select using (true);
drop policy if exists "public signup" on public.signups;
create policy "public signup" on public.signups for insert with check (true);

grant execute on function public.get_event_public(text) to anon, authenticated;
revoke execute on function public.reserve_tickets(text,int,text,text,text,text) from anon, authenticated;
revoke execute on function public.mark_order_paid(uuid,text,text) from anon, authenticated;
revoke execute on function public.check_in(text,text) from anon, authenticated;
-- reserve_tickets-et szerveroldali function hívja (Netlify), ott jön létre a fizetési session is.

-- =====================================================================
--  SEED – javasolt árlépcső 550 főre (+40 VIP)
-- =====================================================================
insert into public.events (slug, title, venue, capacity, doors_at)
values ('one-night-irottko', 'One Night at Írottkő', 'Hotel Írottkő, Kőszeg', 590, '19:00')
on conflict (slug) do nothing;

insert into public.ticket_tiers (event_id, name, kind, price_huf, quantity, sort_order, perks)
select e.id, v.name, v.kind, v.price, v.qty, v.ord, v.perks
from public.events e,
(values
  ('Elővétel',    'standard',  5000, 150, 1, array['Belépő mindhárom zónába']),
  ('2. kör',      'standard',  6000, 150, 2, array['Belépő mindhárom zónába']),
  ('3. kör',      'standard',  7000, 150, 3, array['Belépő mindhárom zónába']),
  ('Last Call',   'standard',  8000, 100, 4, array['Belépő mindhárom zónába']),
  ('VIP Lounge',  'vip',      15000,  40, 1, array['VIP Lounge belépés','Welcome drink','Külön ruhatár','Soron kívüli belépés'])
) as v(name, kind, price, qty, ord, perks)
where e.slug = 'one-night-irottko'
on conflict do nothing;
