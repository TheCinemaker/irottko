-- =====================================================================
--  014 – Élő jegy-állapot a nyilvános oldalon. Többször is futtatható.
--
--  Ha az admin leállítja / újraindítja az eladást, vagy a plafont / az árakat
--  állítja (events, ticket_tiers változik), a trigger egy TARTALOM NÉLKÜLI
--  jelzést küld a nyilvános "irottko-sales" Realtime-csatornára. A nyitott
--  oldalak erre újra lekérik a get_event_public()-ot, és azonnal mutatják:
--  „nem elérhető” / „telt ház” / újra nyitva.
--
--  Külön csatorna, mint a 008-as "irottko-live": a látogatók böngészői így
--  nem kapnak jelzést minden egyes jegyvásárlásról, csak az eladás
--  beállításainak változásáról. A csatornán soha nem megy adat.
--  A jelzés hibája SOSEM akaszthatja meg a mentést (kivételkezelés).
--
--  A már fizetés alatt álló foglalásokat a leállítás nem érinti: a leállítás
--  csak ÚJ foglalást tilt (reserve_tickets), a fizetés lezárása mehet tovább.
-- =====================================================================
create or replace function public.notify_sales()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('t', tg_table_name), 'changed', 'irottko-sales', false);
  exception when others then
    null; -- a Realtime hibája nem állíthatja meg a tranzakciót
  end;
  return null;
end $$;

revoke execute on function public.notify_sales() from public, anon, authenticated;

drop trigger if exists live_sales_events on public.events;
create trigger live_sales_events after update on public.events
  for each statement execute function public.notify_sales();

drop trigger if exists live_sales_tiers on public.ticket_tiers;
create trigger live_sales_tiers after insert or update or delete on public.ticket_tiers
  for each statement execute function public.notify_sales();

-- Ellenőrzés: a két trigger.
select tgname, tgrelid::regclass as tabla from pg_trigger where tgname like 'live_sales_%';
