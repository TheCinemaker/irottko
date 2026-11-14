// Access token for one order's tickets (success page + "open in the app" e-mail link).
//
// The Barion PaymentId is NOT a secret: Barion issues sequential, time-based
// GUIDs (the last 22 hex digits are the same for every payment, the rest grows
// with time), so neighbouring ids can be guessed. The token instead is an HMAC
// of the order id under a server-only key: 128 bits, unguessable, and nothing
// to store (it can be recomputed whenever an e-mail is sent).
// Env: ORDER_LINK_SECRET (falls back to SUPABASE_SERVICE_ROLE_KEY). Changing it
// invalidates every link already sent.
import crypto from 'crypto';

const key = () => {
  const k = process.env.ORDER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('MISSING_ORDER_LINK_SECRET');
  return k;
};

export const orderToken = (orderId) =>
  crypto.createHmac('sha256', key()).update(`order-access:${orderId}`).digest('base64url').slice(0, 22);

export function validOrderToken(orderId, token) {
  if (typeof orderId !== 'string' || typeof token !== 'string' || token.length !== 22) return false;
  const a = Buffer.from(orderToken(orderId));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The buyer's link to their tickets. */
export const orderLink = (base, orderId) => `${base}/success?o=${encodeURIComponent(orderId)}&t=${orderToken(orderId)}`;
