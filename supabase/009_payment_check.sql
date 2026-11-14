-- =====================================================================
--  009 – Fizetés-ellenőrzés: ha a Barion szerinti fizetés nem egyezik a
--  rendeléssel (rendelésazonosító, összeg, pénznem), a rendelés NEM lesz
--  fizetett, a hiba ide kerül, és az admin piros figyelmeztetést mutat.
--  Többször is futtatható.
-- =====================================================================
alter table public.orders add column if not exists payment_error text;
