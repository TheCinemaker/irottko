-- =====================================================================
--  002 – Barion fizetés + Számlázz.hu számla + jegyküldés
--  Futtatás a schema.sql UTÁN: Supabase Dashboard → SQL Editor → Run
--  Többször is futtatható (idempotens).
-- =====================================================================

-- Számlázási adatok és a teljesítés (számla + e-mail) állapota a rendelésen.
alter table public.orders add column if not exists zip              text;
alter table public.orders add column if not exists city             text;
alter table public.orders add column if not exists address          text;
alter table public.orders add column if not exists company_name     text;
alter table public.orders add column if not exists tax_number       text;

-- Számlázz.hu: a számlaszám jelzi, hogy kész; az attempted_at alapján
-- újrapróbálás előtt rákeresünk a rendelésszámra (nincs dupla számla).
alter table public.orders add column if not exists invoice_number       text;
alter table public.orders add column if not exists invoice_attempted_at timestamptz;
alter table public.orders add column if not exists invoice_error        text;
alter table public.orders add column if not exists email_sent_at        timestamptz;
alter table public.orders add column if not exists email_error          text;
-- Egyszerre csak egy folyamat dolgozza fel (callback és a sikeroldal versenyezhet).
alter table public.orders add column if not exists fulfillment_started_at timestamptz;
alter table public.orders add column if not exists fulfilled_at          timestamptz;

create unique index if not exists orders_payment_ref_uidx
  on public.orders(payment_provider, payment_ref) where payment_ref is not null;

-- Barion szerinti sikertelen / megszakított fizetés: a foglalás felszabadul.
create or replace function public.mark_order_failed(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('cancelled','expired') then raise exception 'BAD_STATUS'; end if;
  update orders set status = p_status where id = p_order and status = 'pending';
  update tickets set status = 'void'
   where order_id = p_order and status = 'reserved'
     and exists (select 1 from orders where id = p_order and status = p_status);
end $$;

revoke execute on function public.mark_order_failed(uuid,text) from anon, authenticated;
