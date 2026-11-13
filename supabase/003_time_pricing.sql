-- =====================================================================
--  003 – Időalapú árazás (hetente emelkedő ár) + helyszíni értékesítés
--  Futtatás a 002 UTÁN. Többször is futtatható.
--
--  Modell:
--   - Egy jegytípus (ticket_tiers sor) egy időablakban él: sales_from → sales_until.
--     A vásárláskor az ÉPP aktív sor ára érvényes.
--   - channel = 'online' | 'door' (helyszíni, a buli éjszakáján).
--   - quantity NULL = nincs saját korlát (a közös keret számít).
--   - events.online_capacity: a normál online jegyek KÖZÖS kerete (pl. 550),
--     függetlenül attól, melyik hét árán vették. A VIP-nek saját quantity-je van,
--     a helyszíni jegy (door) nem számít bele, és korlátlan.
-- =====================================================================

alter table public.ticket_tiers add column if not exists sales_from  timestamptz;
alter table public.ticket_tiers add column if not exists sales_until timestamptz;
alter table public.ticket_tiers add column if not exists channel     text not null default 'online';
alter table public.ticket_tiers alter column quantity drop not null;
do $$ begin
  alter table public.ticket_tiers add constraint ticket_tiers_channel_chk check (channel in ('online','door'));
exception when duplicate_object then null; end $$;

alter table public.events add column if not exists online_capacity int;

-- ---------------------------------------------------------------------
-- Állapot nézet (újra, mert változtak az oszlopok)
-- ---------------------------------------------------------------------
drop view if exists public.tier_status cascade;
create view public.tier_status as
select
  t.id, t.event_id, t.name, t.kind, t.channel, t.price_huf, t.quantity, t.sort_order, t.perks,
  t.sales_from, t.sales_until,
  coalesce(s.taken, 0) as taken,
  case when t.quantity is null then null else greatest(t.quantity - coalesce(s.taken,0), 0) end as remaining,
  (now() >= coalesce(t.sales_from, '-infinity') and now() < coalesce(t.sales_until, 'infinity')) as active
from public.ticket_tiers t
left join lateral (
  select count(*)::int as taken
  from public.tickets k
  join public.orders o on o.id = k.order_id
  where k.tier_id = t.id
    and k.status in ('reserved','valid','used')
    and (o.status = 'paid' or (o.status = 'pending' and o.expires_at > now()))
) s on true;

-- Közös online keretből fogyott normál jegyek.
create or replace function public.online_taken(p_event uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(taken),0)::int from tier_status
   where event_id = p_event and kind = 'standard' and channel = 'online';
$$;

-- ---------------------------------------------------------------------
-- Publikus adat a jegyoldalnak: aktív ár, a következő ár és mikor jön.
-- ---------------------------------------------------------------------
create or replace function public.get_event_public(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  with e as (select * from events where slug = p_slug)
  select json_build_object(
    'event', (select json_build_object('slug', slug, 'title', title, 'sales_open', sales_open,
                                       'online_capacity', online_capacity) from e),
    'now', now(),
    'online_left', (select case when e.online_capacity is null then null
                                else greatest(e.online_capacity - online_taken(e.id), 0) end from e),
    'tiers', coalesce((select json_agg(json_build_object(
                'id', ts.id, 'name', ts.name, 'kind', ts.kind, 'channel', ts.channel,
                'price_huf', ts.price_huf, 'sales_from', ts.sales_from, 'sales_until', ts.sales_until,
                'active', ts.active, 'remaining', ts.remaining, 'perks', ts.perks)
              order by ts.kind, ts.sort_order)
              from tier_status ts join e on e.id = ts.event_id), '[]'::json)
  );
$$;
grant execute on function public.get_event_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Foglalás: az épp aktív jegytípus áron, keretellenőrzéssel.
-- (A szignatúra ugyanaz, a barion-start nem változik.)
-- ---------------------------------------------------------------------
create or replace function public.reserve_tickets(
  p_slug text, p_qty int, p_email text, p_name text,
  p_phone text default null, p_kind text default 'standard'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_event events%rowtype;
  v_tier  tier_status%rowtype;
  v_order uuid;
  v_total int;
begin
  select * into v_event from events where slug = p_slug for update;   -- esemény szintű zár
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if not v_event.sales_open then raise exception 'SALES_CLOSED'; end if;
  if p_qty < 1 or p_qty > v_event.max_per_order then raise exception 'INVALID_QTY'; end if;

  update orders set status = 'expired'
   where event_id = v_event.id and status = 'pending' and expires_at <= now();

  select * into v_tier from tier_status
   where event_id = v_event.id and kind = p_kind and active
   order by sort_order limit 1;
  if not found then raise exception 'SALES_CLOSED'; end if;

  if v_tier.quantity is not null and v_tier.taken + p_qty > v_tier.quantity then
    raise exception 'SOLD_OUT';
  end if;
  if v_tier.kind = 'standard' and v_tier.channel = 'online' and v_event.online_capacity is not null
     and online_taken(v_event.id) + p_qty > v_event.online_capacity then
    raise exception 'SOLD_OUT';
  end if;

  insert into orders(event_id, email, full_name, phone, expires_at)
  values (v_event.id, lower(trim(p_email)), trim(p_name), p_phone,
          now() + make_interval(mins => v_event.hold_minutes))
  returning id into v_order;

  insert into tickets(order_id, event_id, tier_id, price_huf, holder_name)
  select v_order, v_event.id, v_tier.id, v_tier.price_huf, trim(p_name)
  from generate_series(1, p_qty);

  v_total := p_qty * v_tier.price_huf;
  update orders set total_huf = v_total where id = v_order;
  return json_build_object('order_id', v_order, 'total_huf', v_total, 'tier', v_tier.name,
                           'expires_at', now() + make_interval(mins => v_event.hold_minutes));
end $$;

revoke execute on function public.reserve_tickets(text,int,text,text,text,text) from anon, authenticated;
revoke execute on function public.online_taken(uuid) from anon, authenticated;
