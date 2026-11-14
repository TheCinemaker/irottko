-- =====================================================================
--  012 – Kapus eszköz regisztrálása PIN nélkül (admin által kiadott,
--  egyszer használható, 10 perces kód). netlify/functions/lib/enroll.js
--  A kódot csak SHA-256 hash-ként tároljuk. Csak a szerver éri el.
--  Többször is futtatható.
-- =====================================================================
create table if not exists public.scanner_enrollments (
  id          bigint generated always as identity primary key,
  code_hash   text not null unique,
  label       text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz
);

alter table public.scanner_enrollments enable row level security;
revoke all on public.scanner_enrollments from public, anon, authenticated;
grant select, insert, update on public.scanner_enrollments to service_role;
