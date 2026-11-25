-- =====================================================================
--  019 – Marketing-hozzájárulás (hírlevél a következő bulikról)
--  Futtatás a 018 UTÁN: Supabase Dashboard → SQL Editor → Run.
--  Többször is futtatható.
--
--  - orders.marketing_consent_at: a vásárló a fizetésnél külön, NEM előre
--    bepipált jelölőnégyzettel kérte (bizonyíték: az időpont). NULL = nem kérte.
--  - marketing_contacts: a lista, amelyre levelet szabad küldeni. A fizetés
--    után kerül bele (lib/fulfill.js). Külön tábla, mert a rendelési adatokat
--    a rendezvény után 90 nappal töröljük (purge-after-event), a hozzájárulás
--    viszont a visszavonásig érvényes.
--  - withdrawn_at: leiratkozott (admin → Marketing-lista → Leiratkoztatás).
--    A sor megmarad (bizonyíték, hogy többé nem kap levelet).
--  Csak a szerver (service role) éri el, mint minden más táblát (010).
-- =====================================================================
alter table public.orders add column if not exists marketing_consent_at timestamptz;

create table if not exists public.marketing_contacts (
  email         text primary key,
  full_name     text,
  consented_at  timestamptz not null,
  source        text not null default 'one-night-irottko-2027',
  order_id      uuid,               -- no FK: the order is deleted after the event, the consent stays
  withdrawn_at  timestamptz
);

alter table public.marketing_contacts enable row level security;
revoke all on public.marketing_contacts from anon, authenticated;
