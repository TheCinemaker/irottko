// Per-pass authentication token for Apple's PassKit web service (the phone
// sends it back as "Authorization: ApplePass <token>"). Derived from
// ORDER_LINK_SECRET (lib/secrets.js), so nothing extra is stored; the previous
// key is still accepted after a rotation.
import crypto from 'crypto';
import { secretKeys } from './secrets.js';

const SECRET = 'ORDER_LINK_SECRET';
const mac = (key, serial) => crypto.createHmac('sha256', key).update(`passkit:${serial}`).digest('base64url');

export const passAuthToken = (serial) => mac(secretKeys(SECRET).current, serial);

export function validPassAuth(header, serial) {
  const m = /^ApplePass\s+(\S+)$/.exec(String(header || ''));
  if (!m) return false;
  const given = Buffer.from(m[1]);
  let ok = false;
  for (const k of secretKeys(SECRET).all) {
    const want = Buffer.from(mac(k, serial));
    if (want.length === given.length && crypto.timingSafeEqual(want, given)) ok = true;
  }
  return ok;
}
