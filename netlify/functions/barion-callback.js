// Barion calls this on every payment status change (CallbackUrl).
// It carries only the paymentId; the actual state is fetched from Barion,
// so a forged call cannot mark anything as paid.
import { syncPayment } from './lib/fulfill.js';

function paymentIdFrom(event) {
  const q = event.queryStringParameters || {};
  if (q.paymentId || q.PaymentId) return q.paymentId || q.PaymentId;
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  try {
    const j = JSON.parse(raw);
    if (j.PaymentId || j.paymentId) return j.PaymentId || j.paymentId;
  } catch { /* form-encoded */ }
  const f = new URLSearchParams(raw);
  return f.get('paymentId') || f.get('PaymentId');
}

export const handler = async (event) => {
  const paymentId = paymentIdFrom(event);
  if (!paymentId || !/^[0-9a-fA-F-]{32,36}$/.test(paymentId)) return { statusCode: 400, body: 'missing paymentId' };

  try {
    const r = await syncPayment(paymentId);
    console.log('barion-callback', paymentId, r);
    return { statusCode: 200, body: 'OK' };
  } catch (e) {
    console.error('barion-callback failed:', paymentId, e.message);
    // Non-200 → Barion retries the callback later.
    return { statusCode: 500, body: 'retry' };
  }
};
