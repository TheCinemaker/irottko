// Login for the scanner (check-in) and the admin functions.
//
// 1) PIN login – constant-time compare + brute-force lock: after MAX_FAILS
//    wrong PINs from one IP within WINDOW_MIN minutes, PIN logins from that IP
//    are refused for the rest of the window; after MAX_FAILS_GLOBAL from all
//    IPs together (botnet), PIN login is closed for everyone. PINs < 8 chars
//    are refused (table pin_failures,
//    supabase/007_pin_guard.sql; without the table: delay only + warning).
// 2) A correct PIN returns a signed session token (HMAC, keyed with the PIN
//    itself, so changing the PIN logs every device out). Later calls send the
//    token, not the PIN – so a lock-out never stops door phones that are
//    already logged in, even when they share an IP (venue Wi-Fi, mobile CGNAT).
import crypto from 'crypto';
import { db, json } from './db.js';

const MAX_FAILS = 5; // per IP
const WINDOW_MIN = 15;
// Botnet guard: wrong PINs from ALL addresses together. Above this, PIN login
// is closed for everyone for the rest of the window (devices that are already
// logged in keep working – they send their token, not the PIN).
// With an 8-digit PIN that is ≤ 4 800 guesses a day → ~28 years on average.
const MAX_FAILS_GLOBAL = 50;
const MIN_PIN_LENGTH = 8;
const TOKEN_HOURS = { scanner: 24, admin: 12 };

export const clientIp = (event) =>
  event.headers?.['x-nf-client-connection-ip'] ||
  (event.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
  'unknown';

const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// The key mixes in a server-only secret: a stolen token alone can't be used
// to brute-force the (short, numeric) PIN offline.
const pepper = () => process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sign = (scope, exp, secret) =>
  crypto.createHmac('sha256', `${scope}:${secret}:${pepper()}`).update(String(exp)).digest('base64url');

function issueToken(scope, secret) {
  const exp = Date.now() + TOKEN_HOURS[scope] * 3600e3;
  return `${exp}.${sign(scope, exp, secret)}`;
}

function validToken(scope, token, secret) {
  const [exp, mac] = String(token || '').split('.');
  if (!exp || !mac || !(Number(exp) > Date.now())) return false;
  return sameSecret(mac, sign(scope, exp, secret));
}

async function recentFails(scope, ip = null) {
  let q = db()
    .from('pin_failures')
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .gt('failed_at', new Date(Date.now() - WINDOW_MIN * 60000).toISOString());
  if (ip) q = q.eq('ip', ip);
  const { count, error } = await q;
  // A missing table gives an error – or, for a HEAD count request, just count: null.
  if (error || count == null) {
    console.warn('PIN lock skipped (run 007_pin_guard.sql):', error?.message || 'no pin_failures table');
    return 0;
  }
  return count || 0;
}

/**
 * body: { token } or { pin }. scope: 'scanner' | 'admin'.
 * Returns { denied: response } or { token } (token: a fresh one after a PIN
 * login, null when the caller already sent a valid token).
 */
export async function authenticate(event, scope, body, secret) {
  if (!secret) return { denied: json(500, { error: `MISSING_${scope.toUpperCase()}_PIN` }) };
  // A short PIN can be brute-forced: refuse to run with one (set ≥ 8 digits).
  if (String(secret).length < MIN_PIN_LENGTH) {
    console.error(`${scope.toUpperCase()}_PIN is shorter than ${MIN_PIN_LENGTH} characters – login disabled`);
    return { denied: json(500, { error: 'WEAK_PIN_CONFIG' }) };
  }
  if (body.token && validToken(scope, body.token, secret)) return { token: null };
  if (body.token && !body.pin) return { denied: json(401, { error: 'SESSION_EXPIRED' }) };

  const ip = clientIp(event);
  const [mine, all] = await Promise.all([recentFails(scope, ip), recentFails(scope)]);
  if (mine >= MAX_FAILS || all >= MAX_FAILS_GLOBAL) {
    if (all >= MAX_FAILS_GLOBAL) console.error(`PIN LOGIN LOCKED (${scope}): ${all} wrong PINs in ${WINDOW_MIN} min from all addresses`);
    return { denied: json(429, { error: 'LOCKED', minutes: WINDOW_MIN }) };
  }
  if (sameSecret(body.pin ?? '', secret)) return { token: issueToken(scope, secret) };

  const { error } = await db().from('pin_failures').insert({ scope, ip });
  if (error && error.code !== 'PGRST205') console.warn('pin_failures insert:', error.message);
  await new Promise((r) => setTimeout(r, 800));
  return { denied: json(401, { error: 'BAD_PIN' }) };
}
