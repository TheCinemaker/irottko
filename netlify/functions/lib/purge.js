// Deleting personal data of one event – shared by
//   scripts/go-live-cleanup.mjs   (remove test data before sales open)
//   purge-after-event.js          (retention: 90 days after the event, daily job)
//
// What goes (for the event `slug`):
//   check_ins     – scan log (names, e-mails, codes)
//   orders        – buyers' data; tickets go with them (on delete cascade)
//   signups       – newsletter sign-ups of the event
//   pin_failures  – wrong-PIN log (IP addresses)
//   scanner_enrollments – door-phone enrolment codes (hashes only)
// Invoices stay in Számlázz.hu (8-year legal retention) – nothing to do here.
// dryRun: true → only counts, nothing is deleted.
import { db } from './db.js';

async function count(q) {
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

export async function purgeEvent(slug, { dryRun = true, removeRetiredTiers = false } = {}) {
  const { data: ev, error: evErr } = await db().from('events').select('id, slug').eq('slug', slug).single();
  if (evErr) throw evErr;

  const { data: orders, error: oErr } = await db().from('orders').select('id').eq('event_id', ev.id);
  if (oErr) throw oErr;
  const orderIds = orders.map((o) => o.id);

  const head = (table) => db().from(table).select('*', { count: 'exact', head: true });
  const plan = {
    event: ev.slug,
    orders: orderIds.length,
    tickets: await count(head('tickets').eq('event_id', ev.id)),
    // scans of this event's orders + scans that matched nothing (unknown codes)
    check_ins: (await count(head('check_ins').in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000']))) +
      (await count(head('check_ins').is('order_id', null))),
    signups: await count(head('signups').eq('event_id', ev.id)),
    pin_failures: await count(head('pin_failures')),
    scanner_enrollments: await count(head('scanner_enrollments')),
    retired_tiers: removeRetiredTiers ? await count(head('ticket_tiers').eq('event_id', ev.id).like('name', '%(régi teszt)%')) : 0,
  };
  if (dryRun) return { dryRun: true, ...plan };

  const del = async (q) => {
    const { error } = await q;
    if (error) throw error;
  };
  // Order matters: scans first (they only point at orders/tickets), then orders
  // (tickets cascade), then the rest.
  for (let i = 0; i < orderIds.length; i += 200) {
    await del(db().from('check_ins').delete().in('order_id', orderIds.slice(i, i + 200)));
  }
  await del(db().from('check_ins').delete().is('order_id', null));
  for (let i = 0; i < orderIds.length; i += 200) {
    await del(db().from('orders').delete().in('id', orderIds.slice(i, i + 200)));
  }
  await del(db().from('signups').delete().eq('event_id', ev.id));
  await del(db().from('pin_failures').delete().gte('failed_at', '1970-01-01'));
  await del(db().from('scanner_enrollments').delete().gte('created_at', '1970-01-01'));
  if (removeRetiredTiers) await del(db().from('ticket_tiers').delete().eq('event_id', ev.id).like('name', '%(régi teszt)%'));

  return { dryRun: false, ...plan };
}

/** IP addresses are only needed while a reservation is held (abuse limits). */
export async function forgetOldIps(days = 30) {
  const before = new Date(Date.now() - days * 86400e3).toISOString();
  const { data, error } = await db().from('orders').update({ client_ip: null }).lt('created_at', before).not('client_ip', 'is', null).select('id');
  if (error) throw error;
  return data.length;
}
