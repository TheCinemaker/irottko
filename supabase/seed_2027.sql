-- =====================================================================
--  ONE NIGHT AT ÍROTTKŐ 2027 – árazás és keretek
--  Futtatás a 003 UTÁN. Ez az EGYETLEN hely, ahol az árakat állítani kell;
--  az oldal (jegyoldal, nyitókép) innen olvassa őket.
--  Időpontok: magyar idő (+01:00).
--
--  Biztonsági zár: ha már van kifizetett rendelés, nem fut le (ne írjunk át
--  élesben eladott jegytípust). A jövő évi bulinál új slug / új seed kell.
-- =====================================================================

do $$
declare v_event uuid;
begin
  select id into v_event from events where slug = 'one-night-irottko';
  if exists (select 1 from orders where event_id = v_event and status = 'paid') then
    raise exception 'Van már kifizetett rendelés – az árazást ne ezzel a seeddel módosítsd.';
  end if;

  -- teszt-maradékok törlése (csak nem fizetett rendelések)
  delete from tickets where event_id = v_event;
  delete from orders  where event_id = v_event;
  delete from ticket_tiers where event_id = v_event;

  update events
     set online_capacity = 550,   -- normál online jegyek közös kerete
         capacity        = 590,   -- tájékoztató: 550 + 40 VIP (a helyszíni jegy korlátlan)
         max_per_order   = 10,
         hold_minutes    = 4      -- foglalás 4 perc; a Barion-ablak 3 perc
   where id = v_event;

  insert into ticket_tiers (event_id, name, kind, channel, price_huf, quantity, sort_order, sales_from, sales_until, perks) values
  -- Jegyeladás indul: 2026-12-06 00:01 (Early Bird + VIP), utána hézag nélkül a buli végéig.
  -- Online normál jegy: hetente emelkedik (vasárnap 00:00-kor vált), közös 550-es keret
  (v_event, 'Early Bird',   'standard', 'online', 6990, null, 1, '2026-12-06 00:01+01', '2026-12-13 00:00+01', '{}'),
  (v_event, 'Elővétel 2',   'standard', 'online', 7490, null, 2, '2026-12-13 00:00+01', '2026-12-20 00:00+01', '{}'),
  (v_event, 'Elővétel 3',   'standard', 'online', 7990, null, 3, '2026-12-20 00:00+01', '2026-12-27 00:00+01', '{}'),
  (v_event, 'Elővétel 4',   'standard', 'online', 8490, null, 4, '2026-12-27 00:00+01', '2027-01-03 00:00+01', '{}'),
  (v_event, 'Elővétel 5',   'standard', 'online', 8990, null, 5, '2027-01-03 00:00+01', '2027-01-10 00:00+01', '{}'),
  (v_event, 'Elővétel 6',   'standard', 'online', 9490, null, 6, '2027-01-10 00:00+01', '2027-01-13 00:00+01', '{}'),
  -- Utolsó napok: kapunyitásig (jan. 15. 19:00), utána a helyszíni jegy – hézag nélkül,
  -- hogy MINDEN pillanatban lehessen jegyet venni (a user kérése, 2026-11-17)
  (v_event, 'Last Call',    'standard', 'online', 9900, null, 7, '2027-01-13 00:00+01', '2027-01-15 19:00+01', '{}'),
  -- Helyszíni jegy: QR-plakát → ugyanez a vásárlás; a buli éjszakáján (a létszám-plafon alatt, 013)
  (v_event, 'Helyszíni jegy','standard','door',   9900, null, 8, '2027-01-15 19:00+01', '2027-01-16 03:00+01', '{}'),
  -- VIP: fix ár, saját keret, csak online, kapunyitásig
  (v_event, 'VIP',          'vip',      'online', 12000, 40,  1, '2026-12-06 00:01+01', '2027-01-15 19:00+01', '{}');
end $$;
