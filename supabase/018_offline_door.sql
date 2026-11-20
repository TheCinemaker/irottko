-- =====================================================================
--  018 – Offline beléptetés (a kapus telefon net nélkül is beenged)
--  Futtatás a 017 UTÁN: Supabase Dashboard → SQL Editor → Run.
--  Többször is futtatható.
--
--  A kapus telefon letölti az érvényes jegyek listáját, és ha nincs net,
--  abból dönt. A net nélkül beengedett jegyeket később feltölti – ezt a
--  check_in_offline() fogadja:
--  - a belépés ideje a telefonon mért idő (nem a feltöltésé);
--  - client_id: a telefon egyedi azonosítója az adott beolvasáshoz, így ha a
--    feltöltés kétszer megy fel (elveszett válasz), csak egyszer számít;
--  - ha a jegyet közben egy másik kapu már beengedte: 'already_used' –
--    az admin duplázóként mutatja;
--  - ha az online kérés a szerverre megérkezett, csak a válasz veszett el
--    (a jegy ±20 mp-en belül lett felhasználva), az ugyanaz a belépés: ok,
--    új naplósor nélkül.
-- =====================================================================

alter table public.check_ins add column if not exists offline   boolean not null default false;
alter table public.check_ins add column if not exists client_id text;
create unique index if not exists check_ins_client_idx on public.check_ins(client_id) where client_id is not null;

create or replace function public.check_in_offline(p_code text, p_staff text, p_at timestamptz, p_client_id text)
returns json language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_at     timestamptz := least(coalesce(p_at, now()), now());
  v_cid    text := nullif(left(coalesce(p_client_id, ''), 64), '');
  v        tickets%rowtype;
  v_prev   check_ins%rowtype;
  v_tier   ticket_tiers%rowtype;
  v_order  orders%rowtype;
  v_result text;
  v_name   text;
begin
  -- A telefon órája rossz lehet: 24 óránál régebbi időt nem fogadunk el.
  if v_at < now() - interval '24 hours' then v_at := now(); end if;

  select * into v from tickets where code = v_code for update;

  -- Már feltöltött beolvasás (a zárolás után nézzük, így két párhuzamos
  -- feltöltés sem számít kétszer).
  if v_cid is not null then
    select * into v_prev from check_ins where client_id = v_cid;
    if found then
      return json_build_object('ok', v_prev.result = 'ok', 'reason', upper(v_prev.result), 'code', v_prev.code, 'repeat', true);
    end if;
  end if;

  if v.id is null then
    insert into check_ins(scanned_at, code, result, staff, offline, client_id)
    values (v_at, left(v_code, 64), 'not_found', p_staff, true, v_cid)
    on conflict do nothing;
    return json_build_object('ok', false, 'reason', 'NOT_FOUND', 'code', v_code);
  end if;

  select * into v_tier  from ticket_tiers where id = v.tier_id;
  select * into v_order from orders       where id = v.order_id;
  v_name := coalesce(nullif(v.holder_name, ''), v_order.full_name);

  if v.status = 'used' then
    if v.checked_in_at between v_at - interval '20 seconds' and v_at + interval '20 seconds'
       and not exists (select 1 from check_ins where ticket_id = v.id and result = 'ok' and offline) then
      -- Ugyanaz a belépés: az online kérés célba ért, csak a válasz nem.
      return json_build_object('ok', true, 'reason', 'OK', 'code', v.code, 'same', true);
    end if;
    v_result := 'already_used';
  elsif v.status <> 'valid' or v_order.status <> 'paid' then
    v_result := 'not_paid';
  else
    v_result := 'ok';
    update tickets set status = 'used', checked_in_at = v_at, checked_in_by = p_staff where id = v.id;
  end if;

  insert into check_ins(scanned_at, code, result, ticket_id, order_id, holder_name, email, tier_name, tier_kind, staff, offline, client_id)
  values (v_at, v.code, v_result, v.id, v.order_id, v_name, v_order.email, v_tier.name, v_tier.kind, p_staff, true, v_cid)
  on conflict do nothing;

  return json_build_object(
    'ok',            v_result = 'ok',
    'reason',        upper(v_result),
    'code',          v.code,
    'name',          v_name,
    'checked_in_at', case when v_result = 'ok' then v_at else v.checked_in_at end
  );
end $$;

revoke execute on function public.check_in_offline(text, text, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.check_in_offline(text, text, timestamptz, text) to service_role;
