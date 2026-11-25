// POST /.netlify/functions/admin-action   { token | pin, action, ... }
// Admin-only actions (same login as admin-data, ADMIN_PIN):
//   action 'resend',    orderId  → e-mails the tickets of a paid order again
//                                  (to the address on the order)
//   action 'guestlist'           → every issued ticket, for the printable
//                                  emergency list at the door
//   action 'enroll-create', label → one-time 10-minute code to add a door phone
//                                  without the PIN (lib/enroll.js)
//   action 'enroll-list'          → codes of the last 24 h (status only, no codes)
//   action 'enroll-revoke', id    → revoke an unused code
//   action 'set-delays', delays     → { djId: minutes } on the departures board / site (017)
//   action 'wallet-message', text   → lock-screen message on all Wallet tickets (Apple push + Google)
//   action 'set-announcement', text → "Utastájékoztatás" strip on the site ('' clears it)
//   action 'set-sales-open', open → emergency stop / restart of all ticket sales
//   action 'marketing-list'        → newsletter consents (019), not unsubscribed
//   action 'marketing-unsubscribe', email → takes an address off that list
//   action 'set-limits', venueLimit, nonTicketCount, enabled → fire-safety limit (013);
//                                  enabled=false keeps the numbers but sells without a limit
import { db, json } from './lib/db.js';
import { DJS } from '../../src/data/eventData.js';
import { authenticate } from './lib/pinGuard.js';
import { loadOrder } from './lib/fulfill.js';
import { sendTicketEmail } from './lib/ticketEmail.js';
import { sendPassengerMessage } from './lib/walletPush.js';
import { createEnrollment, listEnrollments, revokeEnrollment, ENROLL_MINUTES } from './lib/enroll.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESEND_GAP_MS = 60_000; // one resend per order per minute (double-click, impatience)

async function resend(orderId) {
  if (!UUID.test(String(orderId))) return json(400, { error: 'BAD_ORDER' });
  const { order, tickets } = await loadOrder(orderId);
  if (order.status !== 'paid') return json(409, { error: 'NOT_PAID' });
  if (order.email_sent_at && Date.now() - new Date(order.email_sent_at).getTime() < RESEND_GAP_MS) {
    return json(429, { error: 'TOO_SOON' });
  }
  const list = tickets.filter((t) => t.status === 'valid' || t.status === 'used');
  try {
    await sendTicketEmail(order, list, { idempotencyKey: `resend-${orderId}-${Date.now()}` });
  } catch (e) {
    console.error('Resend failed:', e.message);
    await db().from('orders').update({ email_error: e.message.slice(0, 500) }).eq('id', orderId);
    return json(502, { error: 'SEND_FAILED' });
  }
  const sentAt = new Date().toISOString();
  await db().from('orders').update({ email_sent_at: sentAt, email_error: null }).eq('id', orderId);
  return json(200, { ok: true, email: order.email, tickets: list.length, sentAt });
}

async function guestlist() {
  const { data: ev, error: evErr } = await db().from('events').select('id').eq('slug', SLUG).single();
  if (evErr) throw evErr;
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('tickets')
      .select('code, holder_name, status, checked_in_at, ticket_tiers(name, kind), orders!inner(full_name, status)')
      .eq('event_id', ev.id)
      .in('status', ['valid', 'used'])
      .eq('orders.status', 'paid')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const guests = rows
    .map((t) => ({
      name: t.holder_name || t.orders.full_name,
      buyer: t.orders.full_name,
      code: t.code,
      tier: t.ticket_tiers?.name,
      vip: t.ticket_tiers?.kind === 'vip',
      in: t.status === 'used' ? t.checked_in_at : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  return json(200, { generatedAt: new Date().toISOString(), guests });
}

// Delays of the acts (017_board_delays.sql): { djId: minutes 0–240 }; 0 = on time.
// The board shows the new time + DELAYED; the site's "now on board" follows it.
async function setDelays(delays) {
  if (!delays || typeof delays !== 'object' || Array.isArray(delays)) return json(400, { error: 'BAD_VALUE' });
  const ids = new Set(DJS.map((d) => d.id));
  const clean = {};
  for (const [id, m] of Object.entries(delays)) {
    if (!ids.has(id) || !Number.isInteger(m) || m < 0 || m > 240) return json(400, { error: 'BAD_VALUE' });
    if (m > 0) clean[id] = m;
  }
  const { data, error } = await db().from('events').update({ board_delays: clean }).eq('slug', SLUG).select('board_delays').single();
  if (error) throw error;
  console.log('admin: delays', JSON.stringify(data.board_delays));
  return json(200, { delays: data.board_delays });
}

// "Üzenet az utasoknak": lock-screen message on every Apple / Google Wallet
// ticket (lib/walletPush.js, 016_wallet_push.sql). At most one every 2 minutes
// (a double click must not notify everyone twice).
async function walletMessage(text) {
  const clean = typeof text === 'string' ? text.replace(/^\s*[IÍ]R\s*0115\s*:\s*/i, '').replace(/\s+/g, ' ').trim() : '';
  if (clean.length < 3 || clean.length > 149) return json(400, { error: 'BAD_VALUE' }); // +1 for the change marker (lib/walletPush.js)
  const { data: ev, error } = await db().from('events').select('*').eq('slug', SLUG).single();
  if (error) throw error;
  if (!('wallet_message' in ev)) return json(409, { error: 'MIGRATION' });
  if (ev.wallet_message_at && Date.now() - new Date(ev.wallet_message_at).getTime() < 2 * 60000) return json(429, { error: 'TOO_SOON' });
  const result = await sendPassengerMessage(clean);
  console.log('admin: passenger message sent', JSON.stringify({ apple: result.apple, google: result.google }));
  return json(200, result);
}

// Passenger announcement strip on every page (015_announcement.sql); '' = none.
// Newsletter list (019): ONLY buyers who ticked the separate consent box,
// minus those who unsubscribed. The order list's e-mails must not be used.
async function marketingList() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('marketing_contacts')
      .select('email, full_name, consented_at')
      .is('withdrawn_at', null)
      .order('consented_at')
      .range(from, from + 999);
    if (error) {
      if (/marketing_contacts/.test(error.message)) return json(409, { error: 'NO_TABLE' });
      throw error;
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const { count: withdrawn } = await db().from('marketing_contacts').select('email', { count: 'exact', head: true }).not('withdrawn_at', 'is', null);
  return json(200, { contacts: rows.map((r) => ({ email: r.email, name: r.full_name, at: r.consented_at })), withdrawn: withdrawn ?? 0 });
}

async function marketingUnsubscribe(email) {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return json(400, { error: 'BAD_EMAIL' });
  const { data, error } = await db()
    .from('marketing_contacts')
    .update({ withdrawn_at: new Date().toISOString(), full_name: null }) // keep only address + time (privacy notice)
    .eq('email', e)
    .is('withdrawn_at', null)
    .select('email');
  if (error) throw error;
  console.log(`admin: marketing unsubscribe (${data.length ? 'done' : 'not on the list'})`);
  return json(200, { removed: data.length });
}

async function setAnnouncement(text) {
  if (typeof text !== 'string' || text.length > 200) return json(400, { error: 'BAD_VALUE' });
  const clean = text.replace(/[\u0000-\u001f]/g, ' ').trim();
  const { data, error } = await db().from('events').update({ announcement: clean || null }).eq('slug', SLUG).select('announcement').single();
  if (error) throw error;
  console.log(`admin: announcement ${clean ? 'set' : 'cleared'}`);
  return json(200, { announcement: data.announcement });
}

// Emergency stop / restart of ALL ticket sales (online, VIP, door QR).
async function setSalesOpen(open) {
  if (typeof open !== 'boolean') return json(400, { error: 'BAD_VALUE' });
  const { data, error } = await db().from('events').update({ sales_open: open }).eq('slug', SLUG).select('sales_open').single();
  if (error) throw error;
  console.log(`admin: ticket sales ${open ? 'OPENED' : 'STOPPED'}`);
  return json(200, { salesOpen: data.sales_open });
}

// Fire-safety limit (013_venue_limit.sql): sellable tickets = venueLimit − nonTicketCount.
// Lowering it below the tickets already sold is allowed: nobody loses a ticket,
// sales just stop.
async function setLimits(venueLimit, nonTicketCount, enabled) {
  if (typeof enabled !== 'boolean') return json(400, { error: 'BAD_VALUE' });
  const okInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  if (!okInt(venueLimit, 1, 10000) || !okInt(nonTicketCount, 0, 1000) || nonTicketCount >= venueLimit) {
    return json(400, { error: 'BAD_VALUE' });
  }
  const { data, error } = await db()
    .from('events')
    .update({ venue_limit: venueLimit, non_ticket_count: nonTicketCount, venue_limit_on: enabled })
    .eq('slug', SLUG)
    .select('venue_limit, non_ticket_count, venue_limit_on')
    .single();
  if (error) throw error;
  console.log(`admin: venue limit ${data.venue_limit_on ? 'ON' : 'OFF'} ${data.venue_limit}, without ticket ${data.non_ticket_count}`);
  return json(200, { venueLimit: data.venue_limit, nonTicketCount: data.non_ticket_count, enabled: data.venue_limit_on });
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD' });
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'BAD_JSON' });
  }
  const auth = await authenticate(event, 'admin', body, process.env.ADMIN_PIN);
  if (auth.denied) return auth.denied;

  try {
    if (body.action === 'resend') return await resend(body.orderId);
    if (body.action === 'guestlist') return await guestlist();
    if (body.action === 'enroll-create') return json(200, { ...(await createEnrollment(body.label)), minutes: ENROLL_MINUTES });
    if (body.action === 'enroll-list') return json(200, { list: await listEnrollments() });
    if (body.action === 'enroll-revoke') return json(200, { revoked: await revokeEnrollment(body.id) });
    if (body.action === 'set-sales-open') return await setSalesOpen(body.open);
    if (body.action === 'set-delays') return await setDelays(body.delays);
    if (body.action === 'wallet-message') return await walletMessage(body.text);
    if (body.action === 'set-announcement') return await setAnnouncement(body.text);
    if (body.action === 'set-limits') return await setLimits(body.venueLimit, body.nonTicketCount, body.enabled);
    if (body.action === 'marketing-list') return await marketingList();
    if (body.action === 'marketing-unsubscribe') return await marketingUnsubscribe(body.email);
    return json(400, { error: 'UNKNOWN_ACTION' });
  } catch (e) {
    console.error('admin-action failed:', e.message);
    return json(500, { error: 'DB' });
  }
};
