-- =====================================================================
--  006 – Visszaélés elleni korlát: a foglalás IP-címe
--  (egy IP-ről egyszerre legfeljebb néhány kifizetetlen foglalás).
--  Futtatás a 005 után. Többször is futtatható.
--  Az IP-cím személyes adat: csak a foglalás idejére kell, a takarító
--  szkript a rendezvény után törli (lásd adatkezelési tájékoztató).
-- =====================================================================
alter table public.orders add column if not exists client_ip text;
create index if not exists orders_pending_ip_idx on public.orders (client_ip) where status = 'pending';
create index if not exists orders_pending_email_idx on public.orders (email) where status = 'pending';

-- Foglalási idő: 4 perc (a Barion-fizetési ablak ennél 1 perccel rövidebb: 3 perc).
update public.events set hold_minutes = 4 where slug = 'one-night-irottko';
