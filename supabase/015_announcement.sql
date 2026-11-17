-- =====================================================================
--  015 – Utastájékoztatás (hirdetmény-sáv az oldal tetején). Többször is futtatható.
--
--  events.announcement: egy rövid szöveg, amit az admin ír be (pl. „Az Early
--  Bird ár vasárnap 23:59-ig érvényes”). Üres / NULL = nincs sáv.
--  A nyilvános get_event_public() visszaadja; mivel az events tábla változása
--  a 014-es "irottko-sales" pinget küldi, a nyitott oldalakon azonnal megjelenik.
--  Ugyanaz a függvény, mint a 013-ban, + 'announcement'.
-- =====================================================================

alter table public.events add column if not exists announcement text
  check (announcement is null or char_length(announcement) <= 200);

create or replace function public.get_event_public(p_slug text)
returns json language sql stable security definer set search_path = pg_catalog, public as $$
  with e as (select * from events where slug = p_slug)
  select json_build_object(
    'event', (select json_build_object('slug', slug, 'title', title, 'sales_open', sales_open,
                                       'online_capacity', online_capacity) from e),
    'now', now(),
    'announcement', (select nullif(trim(e.announcement), '') from e),
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

revoke execute on function public.get_event_public(text) from public;
grant  execute on function public.get_event_public(text) to anon, authenticated, service_role;

-- Ellenőrzés: a mező megvan, és a függvény visszaadja (null = nincs sáv).
select slug, announcement, (public.get_event_public(slug))->'announcement' as publikus from public.events;
