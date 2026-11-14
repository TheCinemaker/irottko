// GET /.netlify/functions/order-status?o=<orderId>&t=<token>
// Used by the /success page (after the Barion redirect, or from the e-mail
// link). Also syncs the payment, so tickets go out even if the callback is late
// or lost. Access needs the order's HMAC token (lib/orderAccess.js) – the Barion
// PaymentId alone is guessable and grants nothing.
import { db, json } from './lib/db.js';
import { syncPayment, loadOrder } from './lib/fulfill.js';
import { validOrderToken } from './lib/orderAccess.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event) => {
  const q = event.queryStringParameters || {};
  const orderId = String(q.o || '');
  if (!UUID.test(orderId) || !validOrderToken(orderId, String(q.t || ''))) return json(403, { status: 'forbidden' });

  try {
    const { data: o, error } = await db().from('orders').select('id, status, payment_ref').eq('id', orderId).maybeSingle();
    if (error) throw error;
    if (!o) return json(404, { status: 'unknown' });

    let status = o.status;
    if (o.payment_ref && o.status !== 'paid') status = (await syncPayment(o.payment_ref)).status;
    if (status !== 'paid') return json(200, { status });

    const { order, tickets } = await loadOrder(orderId);
    return json(200, {
      status: 'paid',
      order: {
        id: order.id,
        fullName: order.full_name,
        email: order.email,
        total: order.total_huf,
        emailSent: Boolean(order.email_sent_at),
      },
      tickets: tickets
        .filter((t) => t.status === 'valid' || t.status === 'used')
        .map((t) => ({ code: t.code, tier: t.tier_name, vip: t.tier_kind === 'vip', name: t.holder_name })),
    });
  } catch (e) {
    console.error('order-status failed:', e.message);
    return json(502, { status: 'error' });
  }
};
