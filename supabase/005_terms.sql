-- =====================================================================
--  005 – Az ÁSZF / adatkezelési tájékoztató elfogadásának időpontja
--  (bizonyíték vita esetén). Futtatás a 004 után. Többször is futtatható.
-- =====================================================================
alter table public.orders add column if not exists terms_accepted_at timestamptz;
