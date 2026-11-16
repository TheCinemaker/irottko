// Fire-safety limit test (supabase/013_venue_limit.sql) – TEST DATABASE ONLY.
// Run: node --env-file=.env scripts/limittest.mjs
// Temporarily sets the limit to "2 tickets left", checks that a 3rd ticket is
// refused (FULL_HOUSE), that the public data says full, that switching the
// limit off lets sales through – then restores the settings and cancels the
// test reservations ('LIMITTESZT …' orders).
import { db } from '../netlify/functions/lib/db.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };
const reserve = (label, qty = 1) =>
  db().rpc('reserve_tickets', { p_slug: SLUG, p_qty: qty, p_email: 'delivered@resend.dev', p_name: `LIMITTESZT ${label}`, p_phone: null, p_kind: 'standard' });

const { data: ev, error } = await db().from('events').select('*').eq('slug', SLUG).single();
if (error) throw error;
if (!('venue_limit' in ev)) { console.error('Run supabase/013_venue_limit.sql first.'); process.exit(1); }
const saved = { venue_limit: ev.venue_limit, non_ticket_count: ev.non_ticket_count, venue_limit_on: ev.venue_limit_on, sales_open: ev.sales_open };
const created = [];

try {
  const { data: taken } = await db().rpc('total_taken', { p_event: ev.id });
  console.log(`Most élő jegy: ${taken}; beállítás: plafon ${saved.venue_limit_on ? 'BE' : 'KI'}, ${saved.venue_limit} fő, ${saved.non_ticket_count} jegy nélkül`);
  await db().from('events').update({ venue_limit: taken + 30 + 2, non_ticket_count: 30, venue_limit_on: true, sales_open: true }).eq('id', ev.id);

  console.log('1) Még 2 hely: 2 jegy megy');
  let r = await reserve('2 db', 2);
  if (r.data) created.push(r.data.order_id);
  ok(!r.error, r.error ? r.error.message : 'foglalva');

  console.log('2) Telt ház: a 3. jegy nem mehet');
  r = await reserve('3.');
  if (r.data) created.push(r.data.order_id);
  ok(r.error && /FULL_HOUSE/.test(r.error.message), r.error ? r.error.message : 'ELFOGADTA – hiba!');

  console.log('3) A publikus adat (az oldal) telt házat mutat');
  const { data: pub } = await db().rpc('get_event_public', { p_slug: SLUG });
  ok(pub.full === true, `full = ${pub.full}`);

  console.log('4) Plafon KIkapcsolva → megy a jegy');
  await db().from('events').update({ venue_limit_on: false }).eq('id', ev.id);
  r = await reserve('kikapcsolva');
  if (r.data) created.push(r.data.order_id);
  ok(!r.error, r.error ? r.error.message : 'foglalva');
  const { data: pub2 } = await db().rpc('get_event_public', { p_slug: SLUG });
  ok(pub2.full === false, `full = ${pub2.full}`);

  console.log('5) Vészleállítás (sales_open = false) → semmi nem megy');
  await db().from('events').update({ sales_open: false }).eq('id', ev.id);
  r = await reserve('leállítva');
  if (r.data) created.push(r.data.order_id);
  ok(r.error && /SALES_CLOSED/.test(r.error.message), r.error ? r.error.message : 'ELFOGADTA – hiba!');
} finally {
  await db().from('events').update(saved).eq('id', ev.id);
  if (created.length) {
    await db().from('tickets').update({ status: 'void' }).in('order_id', created);
    await db().from('orders').update({ status: 'cancelled' }).in('id', created);
  }
  console.log(`Visszaállítva; ${created.length} tesztfoglalás törölve (cancelled).`);
}
console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
