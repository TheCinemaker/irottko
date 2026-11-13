// GET /.netlify/functions/order-status?paymentId=…
// Used by the /success page after Barion redirects back. Also syncs the
// payment, so tickets go out even if the callback is late or lost.
// Only someone holding the paymentId (the buyer's redirect URL) can read this.
import { json } from './lib/db.js';
import { syncPayment, loadOrder } from './lib/fulfill.js';

export const handler = async (event) => {
  const paymentId = event.queryStringParameters?.paymentId;
  if (!paymentId || !/^[0-9a-fA-F-]{32,36}$/.test(paymentId)) return json(400, { error: 'missing paymentId' });

  try {
    const r = await syncPayment(paymentId);
    if (!r.orderId) return json(404, { status: 'unknown' });
    if (r.status !== 'paid') return json(200, { status: r.status });

    const { order, tickets } = await loadOrder(r.orderId);
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
        .map((t) => ({ code: t.code, tier: t.tier_name, vip: t.tier_kind === 'vip' })),
    });
  } catch (e) {
    console.error('order-status failed:', e.message);
    return json(502, { status: 'error' });
  }
};
