// Access token for one order's tickets (success page + "open in the app" e-mail link).
//
// The Barion PaymentId is NOT a secret: Barion issues sequential, time-based
// GUIDs, so neighbouring ids can be guessed. The token instead is an HMAC of
// the order id under ORDER_LINK_SECRET (lib/secrets.js): ~128 bits, nothing to
// store, recomputable whenever an e-mail is sent.
// Rotation: move the old key to ORDER_LINK_SECRET_PREVIOUS – links already sent
// keep working until it is removed. No secret → links are neither issued nor
// accepted (fail closed).
import crypto from 'crypto';
import { secretKeys, hasSecret } from './secrets.js';

const NAME = 'ORDER_LINK_SECRET';
const TOKEN_LENGTH = 22;
const mac = (key, orderId) => crypto.createHmac('sha256', key).update(`order-access:${orderId}`).digest('base64url').slice(0, TOKEN_LENGTH);

export const orderLinksReady = () => hasSecret(NAME);

/** Throws MissingSecret when ORDER_LINK_SECRET is not set. */
export const orderToken = (orderId) => mac(secretKeys(NAME).current, orderId);

/** Throws MissingSecret when ORDER_LINK_SECRET is not set. */
export function validOrderToken(orderId, token) {
  const { all } = secretKeys(NAME);
  if (typeof orderId !== 'string' || typeof token !== 'string' || token.length !== TOKEN_LENGTH) return false;
  const given = Buffer.from(token);
  let ok = false;
  for (const key of all) {
    const want = Buffer.from(mac(key, orderId));
    // constant time per key; every key is always checked
    if (want.length === given.length && crypto.timingSafeEqual(want, given)) ok = true;
  }
  return ok;
}

/** The buyer's link to their tickets. Throws MissingSecret when not configured. */
export const orderLink = (base, orderId) => `${base}/success?o=${encodeURIComponent(orderId)}&t=${orderToken(orderId)}`;
