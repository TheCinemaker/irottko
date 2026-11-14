-- =====================================================================
--  008 – Élő frissítés (szkenner + admin). Többször is futtatható.
--
--  Ha egy jegy, rendelés vagy beolvasás változik, a trigger egy TARTALOM
--  NÉLKÜLI jelzést küld a nyilvános "irottko-live" Realtime-csatornára.
--  A szkenner és az admin erre újratölti az adatait a saját (PIN-nel
--  védett) Netlify-függvényén át – a csatornán soha nem megy adat.
--
--  A jelzés hibája SOSEM akaszthatja meg a fizetést vagy a beléptetést:
--  a küldés kivételkezelésben fut.
-- =====================================================================
create or replace function public.notify_live()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('t', tg_table_name), 'changed', 'irottko-live', false);
  exception when others then
    null; -- a Realtime hibája nem állíthatja meg a tranzakciót
  end;
  return null;
end $$;

revoke execute on function public.notify_live() from public, anon, authenticated;

drop trigger if exists live_tickets on public.tickets;
create trigger live_tickets after insert or update or delete on public.tickets
  for each statement execute function public.notify_live();

drop trigger if exists live_orders on public.orders;
create trigger live_orders after insert or update or delete on public.orders
  for each statement execute function public.notify_live();

drop trigger if exists live_check_ins on public.check_ins;
create trigger live_check_ins after insert on public.check_ins
  for each statement execute function public.notify_live();
