-- =====================================================================
--  016 – Apple Wallet frissítés + utasüzenet (lock screen). Többször is futtatható.
--
--  wallet_registrations: amikor valaki a beszállókártyát az Apple Tárcához
--  adja, az iPhone regisztrál nálunk (PassKit web service, netlify/functions/
--  passkit.js): eszközazonosító + push token + a jegy sorozatszáma. Ide küldünk
--  APNs-jelzést, ha új utasüzenet van – erre a telefon letölti a friss jegyet,
--  és a zárképernyőn megjelenik az üzenet.
--  events.wallet_message / wallet_message_at: az admin „Üzenet az utasoknak”
--  szövege (a jegy hátoldalán, „Utastájékoztatás”) és az ideje.
--
--  Személyes adat (eszközazonosító): csak a szolgáltatás kulcsa éri el, a
--  rendezvény után a 90 napos törlés viszi (lib/purge.js).
-- =====================================================================

create table if not exists public.wallet_registrations (
  id                         bigint generated always as identity primary key,
  device_library_identifier  text not null,
  pass_type_identifier       text not null,
  serial_number              text not null,
  push_token                 text not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (device_library_identifier, pass_type_identifier, serial_number)
);
create index if not exists wallet_registrations_serial_idx on public.wallet_registrations (serial_number);

alter table public.wallet_registrations enable row level security;
revoke all on public.wallet_registrations from public, anon, authenticated;
grant select, insert, update, delete on public.wallet_registrations to service_role;

alter table public.events add column if not exists wallet_message text
  check (wallet_message is null or char_length(wallet_message) <= 150);
alter table public.events add column if not exists wallet_message_at timestamptz;

-- Ellenőrzés
select (select count(*) from public.wallet_registrations) as regisztraciok,
       (select wallet_message from public.events where slug = 'one-night-irottko') as uzenet;
