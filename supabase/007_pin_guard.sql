-- =====================================================================
--  007 – PIN-védelem: hibás szkenner- és admin-PIN próbálkozások naplója.
--  5 hibás próbálkozás után 15 percre letiltja az adott IP-t
--  (netlify/functions/lib/pinGuard.js). Többször is futtatható.
--  Az IP-cím személyes adat: 1 nap után törlődik (lásd a lenti takarítást).
-- =====================================================================
create table if not exists public.pin_failures (
  id        bigint generated always as identity primary key,
  failed_at timestamptz not null default now(),
  scope     text not null check (scope in ('scanner', 'admin')),
  ip        text not null
);
create index if not exists pin_failures_lookup_idx on public.pin_failures (scope, ip, failed_at);

alter table public.pin_failures enable row level security;
revoke all on public.pin_failures from public, anon, authenticated;
grant select, insert, delete on public.pin_failures to service_role;

-- Régi sorok takarítása (ezt az 5 perces retry-fulfillment is elvégzi).
delete from public.pin_failures where failed_at < now() - interval '1 day';
