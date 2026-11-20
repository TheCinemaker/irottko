// Offline door mode test (check-in.js list/sync, 018_offline_door.sql,
// src/lib/offlineDoor.js) – TEST DATABASE ONLY.
// Run: node --env-file=.env scripts/doortest.mjs
// Uses 3 valid tickets, then puts them back to "valid" and deletes its own
// scan log rows (staff = 'DOORTEST').
import { db } from '../netlify/functions/lib/db.js';
import { handler } from '../netlify/functions/check-in.js';
import { createDoor, fingerprint } from '../src/lib/offlineDoor.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const STAFF = 'DOORTEST';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };

// localStorage stand-in for the phone-side module
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const call = async (body) => {
  const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ pin: process.env.SCANNER_PIN, ...body }) });
  return { status: r.statusCode, data: JSON.parse(r.body) };
};

const { data: ev } = await db().from('events').select('id').eq('slug', SLUG).single();
const { data: tickets, error } = await db()
  .from('tickets')
  .select('id, code, holder_name, orders!inner(status, full_name)')
  .eq('event_id', ev.id)
  .eq('status', 'valid')
  .eq('orders.status', 'paid')
  .limit(3);
if (error) throw error;
if (tickets.length < 3) { console.error('Kell legalább 3 érvényes, fizetett tesztjegy.'); process.exit(1); }
const [A, B, C] = tickets;
const has018 = !(await db().from('check_ins').select('offline').limit(1)).error;
console.log(`018 SQL: ${has018 ? 'lefutott' : 'MÉG NINCS – a régi check_in-re esik vissza'}`);

try {
  console.log('1) Lista letöltése');
  const { status, data } = await call({ list: true });
  ok(status === 200 && Array.isArray(data.list?.rows), `HTTP ${status}, ${data.list?.rows?.length} jegy`);
  const fpA = await fingerprint(A.code);
  const rowA = data.list.rows.find((r) => r[0] === fpA);
  ok(!!rowA && rowA[1] === (A.holder_name || A.orders.full_name), `a jegy a listán, a böngészős ujjlenyomat egyezik (${rowA?.[1]})`);
  ok(!JSON.stringify(data.list).includes(A.code), 'a jegykód maga nincs a listában');
  ok(data.list.until > Date.now(), `a lista lejár: ${new Date(data.list.until).toISOString()}`);

  console.log('2) Telefon-oldal: döntés a listából');
  const door = createDoor();
  door.setList(data.list);
  let r = await door.check(A.code.toLowerCase());
  ok(r.type === 'ok' && r.name === rowA[1], `A: ${r.type} (${r.name}), csoport ${r.order_in}/${r.order_tickets}`);
  r = await door.check(A.code);
  ok(r.type === 'used', `A újra: ${r.type}`);
  r = await door.check('NINCSILYENKOD123');
  ok(r.type === 'unknown', `ismeretlen kód: ${r.type}`);
  await door.admitUnknown('NINCSILYENKOD123', STAFF);
  ok(door.pending().length === 2 && door.state().pending === 2, `feltöltésre vár: ${door.pending().length}`);

  console.log('3) Feltöltés (A: offline belépés 60 mp-cel ezelőtt, + az ismeretlen kód)');
  const queue = door.pending().map((p) => ({ ...p, staff: STAFF, at: p.code === A.code ? Date.now() - 60_000 : p.at }));
  let s = await call({ sync: queue });
  const resA = s.data.synced.find((x) => x.id === queue.find((q) => q.code === A.code).id);
  ok(resA?.ok === true, `A feltöltve: ${JSON.stringify(resA)}`);
  const clashes = door.synced(s.data.synced);
  ok(door.pending().length === 0, `a sor kiürült; ütközés: ${clashes.length} (az ismeretlen kód: ${clashes[0]?.reason})`);
  const { data: tA } = await db().from('tickets').select('status, checked_in_at').eq('id', A.id).single();
  ok(tA.status === 'used', `A a DB-ben: ${tA.status}`);
  if (has018) ok(Math.abs(new Date(tA.checked_in_at).getTime() - (Date.now() - 60_000)) < 10_000, `belépési idő = a telefonon mért idő (${tA.checked_in_at})`);

  if (has018) {
    console.log('4) Ugyanaz a feltöltés még egyszer (elveszett válasz) → nem számít kétszer');
    s = await call({ sync: queue });
    ok(s.data.synced.find((x) => x.id === resA.id)?.ok === true, 'A ismét „rendben” (nem duplázó)');
    const { count } = await db().from('check_ins').select('id', { count: 'exact', head: true }).eq('ticket_id', A.id);
    ok(count === 1, `A naplósorai: ${count}`);

    console.log('5) Másik kapu is beengedte offline (új azonosító) → duplázó');
    s = await call({ sync: [{ id: 'doortest-' + Date.now(), code: A.code, at: Date.now(), staff: STAFF }] });
    ok(s.data.synced[0]?.ok === false && s.data.synced[0]?.reason === 'ALREADY_USED', JSON.stringify(s.data.synced[0]));

    console.log('5b) Két kapu offline, 5 mp eltéréssel ugyanazzal a jeggyel → a második duplázó');
    const t0 = Date.now() - 10_000;
    s = await call({ sync: [{ id: 'doortest-c1-' + t0, code: C.code, at: t0, staff: STAFF }] });
    ok(s.data.synced[0]?.ok === true, `C első kapu: ${JSON.stringify(s.data.synced[0])}`);
    s = await call({ sync: [{ id: 'doortest-c2-' + t0, code: C.code, at: t0 + 5000, staff: STAFF }] });
    ok(s.data.synced[0]?.ok === false && s.data.synced[0]?.reason === 'ALREADY_USED', `C második kapu: ${JSON.stringify(s.data.synced[0])}`);
    await db().from('tickets').update({ status: 'valid', checked_in_at: null, checked_in_by: null }).eq('id', C.id);

    console.log('6) Online kérés célba ért, a válasz elveszett → a feltöltés ugyanaz a belépés');
    const on = await call({ code: B.code, staff: STAFF });
    ok(on.data.ok, `B online beléptetve`);
    s = await call({ sync: [{ id: 'doortest-b-' + Date.now(), code: B.code, at: Date.now() - 3000, staff: STAFF }] });
    ok(s.data.synced[0]?.ok === true, `B feltöltés: ${JSON.stringify(s.data.synced[0])}`);
    const { count: cB } = await db().from('check_ins').select('id', { count: 'exact', head: true }).eq('ticket_id', B.id);
    ok(cB === 1, `B naplósorai: ${cB} (nincs hamis duplázó)`);
  }

  console.log('7) Az új lista már beengedettnek mutatja A-t; a telefon helyben is tudja');
  const again = await call({ list: true });
  door.setList(again.data.list);
  r = await door.check(A.code);
  ok(r.type === 'used', `A: ${r.type}`);
  r = await door.check(C.code);
  ok(r.type === 'ok', `C (még nem jött): ${r.type}`);

  console.log('8) Kilépés: a lista törlődik, a fel nem töltött belépés marad');
  door.clear();
  ok(!door.state().ready && door.pending().length === 1, `lista: ${door.state().ready ? 'van' : 'törölve'}, vár: ${door.pending().length}`);
} finally {
  await db().from('tickets').update({ status: 'valid', checked_in_at: null, checked_in_by: null }).in('id', [A.id, B.id, C.id]);
  await db().from('check_ins').delete().eq('staff', STAFF);
  await db().from('check_ins').delete().eq('code', 'NINCSILYENKOD123');
  console.log('Visszaállítva (3 jegy érvényes, a teszt naplósorai törölve).');
}
console.log(`\n${pass} rendben, ${fail} hiba`);
process.exit(fail ? 1 : 0);
