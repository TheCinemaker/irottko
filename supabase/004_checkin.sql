-- =====================================================================
--  004 – Beléptetés (szkenner) + beléptetési napló
--  Futtatás a 003 UTÁN: Supabase Dashboard → SQL Editor → Run.
--  Többször is futtatható.
--
--  - check_ins: MINDEN beolvasás egy sor (sikeres belépés, már felhasznált
--    jegy, ismeretlen kód). Az admin oldal ezt fogja listázni.
--    A sikeres belépések: result = 'ok'.
--  - check_in(): a szkenner (Netlify function, service_role) hívja. Zárolja a
--    jegyet, így két kapu egyszerre sem engedheti be ugyanazt a kódot.
-- =====================================================================

create table if not exists public.check_ins (
  id          bigint generated always as identity primary key,
  scanned_at  timestamptz not null default now(),
  code        text not null,
  result      text not null check (result in ('ok','already_used','not_found','not_paid')),
  ticket_id   uuid references public.tickets(id) on delete set null,
  order_id    uuid references public.orders(id)  on delete set null,
  holder_name text,
  email       text,
  tier_name   text,
  tier_kind   text,
  staff       text
);
create index if not exists check_ins_scanned_idx on public.check_ins(scanned_at desc);
create index if not exists check_ins_ticket_idx  on public.check_ins(ticket_id);

-- Csak a szerver (service_role) éri el: RLS be, policy nincs.
alter table public.check_ins enable row level security;
revoke all on public.check_ins from anon, authenticated;

create or replace function public.check_in(p_code text, p_staff text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v        tickets%rowtype;
  v_tier   ticket_tiers%rowtype;
  v_order  orders%rowtype;
  v_result text;
  v_name   text;
  v_count  int;
  v_in     int;
  v_total  int;
begin
  select * into v from tickets where code = v_code for update;

  if not found then
    insert into check_ins(code, result, staff) values (left(v_code, 64), 'not_found', p_staff);
    return json_build_object('ok', false, 'reason', 'NOT_FOUND', 'code', v_code);
  end if;

  select * into v_tier  from ticket_tiers where id = v.tier_id;
  select * into v_order from orders       where id = v.order_id;
  v_name := coalesce(nullif(v.holder_name, ''), v_order.full_name);

  if v.status = 'used' then
    v_result := 'already_used';
  elsif v.status <> 'valid' or v_order.status <> 'paid' then
    v_result := 'not_paid';
  else
    v_result := 'ok';
    update tickets set status = 'used', checked_in_at = now(), checked_in_by = p_staff where id = v.id;
  end if;

  insert into check_ins(code, result, ticket_id, order_id, holder_name, email, tier_name, tier_kind, staff)
  values (v.code, v_result, v.id, v.order_id, v_name, v_order.email, v_tier.name, v_tier.kind, p_staff);

  -- Csoportos rendelés: hányan jöttek már be ugyanabból a rendelésből.
  select count(*), count(*) filter (where status = 'used') into v_count, v_in
    from tickets where order_id = v.order_id and status in ('valid', 'used');
  select count(*) into v_total from tickets where event_id = v.event_id and status = 'used';

  return json_build_object(
    'ok',          v_result = 'ok',
    'reason',      upper(v_result),
    'code',        v.code,
    'name',        v_name,
    'tier',        v_tier.name,
    'kind',        v_tier.kind,
    'checked_in_at', case when v_result = 'ok' then now() else v.checked_in_at end,
    'order_tickets', v_count,
    'order_in',    v_in,
    'total_in',    v_total
  );
end $$;

revoke execute on function public.check_in(text, text) from public, anon, authenticated;
grant  execute on function public.check_in(text, text) to service_role;

-- Beengedett jegyek (az admin oldalhoz). Csak service_role olvashatja.
create or replace view public.checked_in_tickets with (security_invoker = true) as
select c.scanned_at as checked_in_at, c.holder_name, c.email, c.tier_name, c.tier_kind,
       c.code, c.order_id, c.staff
from public.check_ins c
where c.result = 'ok'
order by c.scanned_at desc;
revoke all on public.checked_in_tickets from anon, authenticated;

-- ---------------------------------------------------------------------
-- BIZTONSÁGI JAVÍTÁS: Postgresben a függvényeket alapból a PUBLIC is
-- futtathatja, így a korábbi "revoke ... from anon" nem volt elég – a
-- nyilvános kulccsal meg lehetett hívni pl. a mark_order_paid-et.
-- Ezeket csak a szerver (service_role) hívhatja.
-- ---------------------------------------------------------------------
revoke execute on function public.reserve_tickets(text,int,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid,text,text)             from public, anon, authenticated;
revoke execute on function public.mark_order_failed(uuid,text)                from public, anon, authenticated;
revoke execute on function public.online_taken(uuid)                          from public, anon, authenticated;
grant  execute on function public.reserve_tickets(text,int,text,text,text,text) to service_role;
grant  execute on function public.mark_order_paid(uuid,text,text)             to service_role;
grant  execute on function public.mark_order_failed(uuid,text)                to service_role;
grant  execute on function public.online_taken(uuid)                          to service_role;
grant  execute on function public.check_in(text,text)                         to service_role;
