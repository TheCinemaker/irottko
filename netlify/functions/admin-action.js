// POST /.netlify/functions/admin-action   { token | pin, action, ... }
// Admin-only actions (same login as admin-data, ADMIN_PIN):
//   action 'resend',    orderId  → e-mails the tickets of a paid order again
//                                  (to the address on the order)
//   action 'guestlist'           → every issued ticket, for the printable
//                                  emergency list at the door
import { db, json } from './lib/db.js';
import { authenticate } from './lib/pinGuard.js';
import { loadOrder } from './lib/fulfill.js';
import { sendTicketEmail } from './lib/ticketEmail.js';

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
    return json(400, { error: 'UNKNOWN_ACTION' });
  } catch (e) {
    console.error('admin-action failed:', e.message);
    return json(500, { error: 'DB' });
  }
};
