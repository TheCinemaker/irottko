-- =====================================================================
--  013 – Tűzvédelmi létszám-plafon: minden jegy együtt. Többször is futtatható.
--
--  Eddig: online normál jegy max. online_capacity (550), VIP max. 40, de a
--  helyszíni jegy (door) korlátlan volt → a buli éjszakáján többen vehettek
--  jegyet, mint ahányan beférnek.
--
--  Most:
--   events.venue_limit      – a tűzvédelmi létszám (ennyien lehetnek bent);
--                             NULL = nincs plafon (régi működés)
--   events.non_ticket_count – bent lévők jegy nélkül (staff, fellépők, vendéglista)
--   events.venue_limit_on   – a plafon be/ki (adminban kapcsoló; kikapcsolva a
--                             szám megmarad, csak nem korlátoz)
--   ELADHATÓ JEGY ÖSSZESEN = venue_limit − non_ticket_count (ha venue_limit_on)
--  Minden jegyfajta (online, VIP, helyszíni) beleszámít; a fizetés alatt álló
--  (4 perces) foglalás is. A reserve_tickets az esemény sorát zárolja, így két
--  egyszerre vásárló sem csúszhat át a plafonon.
--  Aki jegyet vett, annak garantáltan van helye: a plafon az ELADOTT jegyekre
--  vonatkozik, nem a bent lévőkre.
--
--  A két szám és a kapcsoló az adminban állítható (admin-action 'set-limits').
--  Az eladás vészleállítása: events.sales_open (admin-action 'set-sales-open').
-- =====================================================================

alter table public.events add column if not exists venue_limit int check (venue_limit is null or venue_limit > 0);
alter table public.events add column if not exists venue_limit_on boolean not null default true;
alter table public.events add column if not exists non_ticket_count int not null default 30 check (non_ticket_count >= 0);

-- Kezdőérték (a hotel adja meg a végleges tűzvédelmi számot): 590 + 30 jegy nélkül,
-- így a mostani 550 online + 40 VIP terv nem változik, a helyszíni jegy viszont
-- már nem mehet a plafon fölé. Csak ha még nincs beállítva.
update public.events set venue_limit = 620 where slug = 'one-night-irottko' and venue_limit is null;

-- Minden élő jegy (fizetett, vagy fizetés alatt és még nem járt le), minden jegyfajtából.
create or replace function public.total_taken(p_event uuid)
returns int language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(sum(taken), 0)::int from tier_status where event_id = p_event;
$$;

-- ---------------------------------------------------------------------
-- Foglalás (a szignatúra és a működés ugyanaz, + a közös plafon: FULL_HOUSE)
-- ---------------------------------------------------------------------
create or replace function public.reserve_tickets(
  p_slug text, p_qty int, p_email text, p_name text,
  p_phone text default null, p_kind text default 'standard'
) returns json
language plpgsql security definer set search_path = pg_catalog, public as $$
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

  -- Tűzvédelmi plafon: minden jegyfajta együtt.
  if v_event.venue_limit_on and v_event.venue_limit is not null
     and total_taken(v_event.id) + p_qty > v_event.venue_limit - v_event.non_ticket_count then
    raise exception 'FULL_HOUSE';
  end if;

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

-- ---------------------------------------------------------------------
-- Publikus adat: + 'full' (telt ház igen/nem – pontos szám nem publikus)
-- ---------------------------------------------------------------------
create or replace function public.get_event_public(p_slug text)
returns json language sql stable security definer set search_path = pg_catalog, public as $$
  with e as (select * from events where slug = p_slug)
  select json_build_object(
    'event', (select json_build_object('slug', slug, 'title', title, 'sales_open', sales_open,
                                       'online_capacity', online_capacity) from e),
    'now', now(),
    'full', (select e.venue_limit_on and e.venue_limit is not null
                    and total_taken(e.id) >= e.venue_limit - e.non_ticket_count from e),
    -- csak az számít, hogy elfogyott-e (0), a pontos szám nem publikus
    'online_left', (select case when e.online_capacity is null then null
                                when e.online_capacity - online_taken(e.id) <= 0 then 0
                                else null end from e),
    'tiers', coalesce((select json_agg(json_build_object(
                'id', ts.id, 'name', ts.name, 'kind', ts.kind, 'channel', ts.channel,
                'price_huf', ts.price_huf, 'sales_from', ts.sales_from, 'sales_until', ts.sales_until,
                'active', ts.active,
                'remaining', case when ts.remaining = 0 then 0
                                  when ts.kind = 'vip' and ts.remaining <= 10 then ts.remaining
                                  else null end,
                'perks', ts.perks)
              order by ts.kind, ts.sort_order)
              from tier_status ts join e on e.id = ts.event_id), '[]'::json)
  );
$$;

-- Jogok: kívülről továbbra is csak a get_event_public hívható.
revoke execute on function public.total_taken(uuid) from public, anon, authenticated;
grant  execute on function public.total_taken(uuid) to service_role;
revoke execute on function public.reserve_tickets(text,int,text,text,text,text) from public, anon, authenticated;
grant  execute on function public.reserve_tickets(text,int,text,text,text,text) to service_role;
revoke execute on function public.get_event_public(text) from public;
grant  execute on function public.get_event_public(text) to anon, authenticated, service_role;

-- Ellenőrzés: a beállított plafon és hány jegy él most.
select slug, venue_limit_on, venue_limit, non_ticket_count,
       venue_limit - non_ticket_count as eladhato_jegy,
       total_taken(id)                 as most_el,
       sales_open
  from public.events;
