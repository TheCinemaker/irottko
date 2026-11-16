// Presale rush test – TEST DATABASE ONLY.
// Run: node --env-file=.env scripts/loadtest.mjs [parallel=60] [free=30]
// Fires `parallel` simultaneous 1-ticket reservations while only `free` places
// are left under the venue limit. Expected: exactly `free` succeed, the rest get
// FULL_HOUSE, nothing oversold. Then a second wave with the limit off measures
// raw speed. Afterwards the settings are restored and the 'TERHELES …'
// reservations cancelled.
import { db } from '../netlify/functions/lib/db.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const N = Number(process.argv[2] || 60);
const FREE = Number(process.argv[3] || 30);
const { data: ev, error } = await db().from('events').select('*').eq('slug', SLUG).single();
if (error) throw error;
const saved = { venue_limit: ev.venue_limit, non_ticket_count: ev.non_ticket_count, venue_limit_on: ev.venue_limit_on, sales_open: ev.sales_open };
const created = [];

async function wave(label) {
  const t0 = Date.now();
  const res = await Promise.all(
    Array.from({ length: N }, (_, i) => {
      const s = Date.now();
      return db()
        .rpc('reserve_tickets', { p_slug: SLUG, p_qty: 1, p_email: `delivered+t${i}@resend.dev`, p_name: `TERHELES ${label} ${i}`, p_phone: null, p_kind: 'standard' })
        .then((r) => ({ ...r, ms: Date.now() - s }));
    })
  );
  const ok = res.filter((r) => r.data);
  ok.forEach((r) => created.push(r.data.order_id));
  const errs = {};
  res.filter((r) => r.error).forEach((r) => (errs[r.error.message] = (errs[r.error.message] || 0) + 1));
  const ms = res.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`${label}: ${N} egyszerre → ${ok.length} sikeres, hibák: ${JSON.stringify(errs)}`);
  console.log(`  összesen ${Date.now() - t0} ms; egy foglalás: medián ${ms[Math.floor(N / 2)]} ms, leglassabb ${ms[N - 1]} ms`);
  return ok.length;
}

let pass = true;
try {
  const { data: taken } = await db().rpc('total_taken', { p_event: ev.id });
  await db().from('events').update({ venue_limit: taken + 30 + FREE, non_ticket_count: 30, venue_limit_on: true, sales_open: true }).eq('id', ev.id);
  const got = await wave('Plafonnal');
  const { data: after } = await db().rpc('total_taken', { p_event: ev.id });
  const okCap = got === FREE && after === taken + FREE;
  pass &&= okCap;
  console.log(`  ${okCap ? '✓' : '✗ HIBA:'} pontosan ${FREE} hely kelt el (élő jegy ${taken} → ${after}), nincs túladás`);

  await db().from('events').update({ venue_limit_on: false }).eq('id', ev.id);
  const got2 = await wave('Plafon nélkül');
  pass &&= got2 === N;
} finally {
  await db().from('events').update(saved).eq('id', ev.id);
  for (let i = 0; i < created.length; i += 200) {
    const ids = created.slice(i, i + 200);
    await db().from('tickets').update({ status: 'void' }).in('order_id', ids);
    await db().from('orders').update({ status: 'cancelled' }).in('id', ids);
  }
  console.log(`Visszaállítva (sales_open=${saved.sales_open}); ${created.length} tesztfoglalás törölve.`);
}
console.log(pass ? '\nEREDMÉNY: OK' : '\nEREDMÉNY: HIBA');
