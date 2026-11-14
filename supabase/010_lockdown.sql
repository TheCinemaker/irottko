-- =====================================================================
--  010 – Biztonsági zárás (security audit, 2026-11-14). Többször is futtatható.
--
--  A böngésző (anon kulcs) EGYETLEN dolgot használ az adatbázisból:
--  a get_event_public() függvényt (src/lib/usePricing.js). Minden mást a
--  Netlify-függvények végeznek service_role-lal – azokat ez nem érinti.
--
--  1) anon / authenticated: semmilyen jog a táblákra és nézetekre
--     (SELECT/INSERT/UPDATE/DELETE/TRUNCATE…). A TRUNCATE-et az RLS nem
--     védi, a tier_status nézet pedig megkerülte az RLS-t (kiolvasható volt
--     belőle az eladott jegyek száma jegytípusonként).
--  2) A jövőben létrehozott táblák/függvények se kapjanak automatikusan jogot.
--  3) Függvények: csak a get_event_public hívható kívülről.
--  4) get_event_public: nem árulja el a pontos készletet – csak azt, ha
--     elfogyott, és a VIP-nél az utolsó 10 helyet (ezt kiírja a jegyoldal).
-- =====================================================================

-- 1) Táblák, nézetek, szekvenciák
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant  all on all tables    in schema public to service_role;
grant  all on all sequences in schema public to service_role;

-- A régi, nem használt feliratkozó-űrlap nyitott INSERT-szabálya.
drop policy if exists "public signup" on public.signups;
-- Az events/ticket_tiers nyilvános olvasása sem kell (a böngésző a függvényen át olvas).
drop policy if exists "public read events" on public.events;
drop policy if exists "public read tiers"  on public.ticket_tiers;

-- 2) Alapértelmezett jogok az ezután létrehozott objektumokra
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- 3) Függvények: alapból a PUBLIC is futtathatná őket → mindet lezárjuk,
--    a szerver (service_role) mindet hívhatja, kívülről csak a publikus adat.
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

-- 4) Publikus eseményadat – ugyanazok a mezők, pontos készlet nélkül.
create or replace function public.get_event_public(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  with e as (select * from events where slug = p_slug)
  select json_build_object(
    'event', (select json_build_object('slug', slug, 'title', title, 'sales_open', sales_open,
                                       'online_capacity', online_capacity) from e),
    'now', now(),
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
