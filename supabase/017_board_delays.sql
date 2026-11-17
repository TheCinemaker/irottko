-- =====================================================================
--  017 – Késések (DELAYED) a kijelzőn és az oldalon. Többször is futtatható.
--
--  events.board_delays: { "<fellépő id>": perc } – az admin állítja
--  („Késés” kártya). A kijelző (/kijelzo) a késő fellépőnél az új időt és
--  DELAYED-et mutat; az oldal „Most a fedélzeten” része is ezzel számol.
--  A get_event_public() visszaadja ('delays'); az events változása a 014-es
--  pinget küldi, így élőben frissül. Ugyanaz a függvény, mint a 015-ben, + 'delays'.
-- =====================================================================

alter table public.events add column if not exists board_delays jsonb not null default '{}'::jsonb;

create or replace function public.get_event_public(p_slug text)
returns json language sql stable security definer set search_path = pg_catalog, public as $$
  with e as (select * from events where slug = p_slug)
  select json_build_object(
    'event', (select json_build_object('slug', slug, 'title', title, 'sales_open', sales_open,
                                       'online_capacity', online_capacity) from e),
    'now', now(),
    'announcement', (select nullif(trim(e.announcement), '') from e),
    'delays', (select e.board_delays from e),
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

-- Ellenőrzés
select slug, board_delays, (public.get_event_public(slug))->'delays' as publikus from public.events;
