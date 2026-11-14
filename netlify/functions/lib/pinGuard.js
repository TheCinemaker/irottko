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
import { secretKeys, MissingSecret } from './secrets.js';
import { consumeEnrollment } from './enroll.js';

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

// Session tokens are signed with SESSION_SECRET (lib/secrets.js, its own key –
// a stolen token alone can't be used to brute-force the PIN offline) plus the
// PIN itself (changing the PIN logs every device out). SESSION_SECRET_PREVIOUS
// keeps sessions alive across a key rotation.
const sign = (key, scope, exp, secret) =>
  crypto.createHmac('sha256', `${scope}:${secret}:${key}`).update(String(exp)).digest('base64url');

function issueToken(scope, secret) {
  const exp = Date.now() + TOKEN_HOURS[scope] * 3600e3;
  return `${exp}.${sign(secretKeys('SESSION_SECRET').current, scope, exp, secret)}`;
}

function validToken(scope, token, secret) {
  const [exp, mac] = String(token || '').split('.');
  if (!exp || !mac || !(Number(exp) > Date.now())) return false;
  let ok = false;
  for (const key of secretKeys('SESSION_SECRET').all) if (sameSecret(mac, sign(key, scope, exp, secret))) ok = true;
  return ok;
}

async function recentFails(scope, ip = null) {
  let q = db()
    .from('pin_failures')
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .gt('failed_at', new Date(Date.now() - WINDOW_MIN * 60000).toISOString());
  if (ip) q = q.eq('ip', ip);
  const { count, error } = await q;
  // Fail closed: if the lock can't be checked, PIN login is refused (tokens still work).
  if (error || count == null) throw new Error(`PIN lock check failed: ${error?.message || 'no count'}`);
  return count;
}

/**
 * body: { token } | { pin } | { enroll } (scanner only). scope: 'scanner' | 'admin'.
 * Returns { denied: response } or { token } (token: a fresh one after a PIN
 * login or an enrolment, null when the caller already sent a valid token).
 *
 * enroll: a one-time device code the admin issued (lib/enroll.js). It is not a
 * PIN path – only a logged-in admin can create one – so the PIN locks don't
 * apply to it and a locked-out PIN login can't block adding a door phone.
 */
export async function authenticate(event, scope, body, secret) {
  if (!secret) return { denied: json(500, { error: `MISSING_${scope.toUpperCase()}_PIN` }) };
  // A short PIN can be brute-forced: refuse to run with one (set ≥ 8 digits).
  if (String(secret).length < MIN_PIN_LENGTH) {
    console.error(`${scope.toUpperCase()}_PIN is shorter than ${MIN_PIN_LENGTH} characters – login disabled`);
    return { denied: json(500, { error: 'WEAK_PIN_CONFIG' }) };
  }
  try {
    if (body.token && validToken(scope, body.token, secret)) return { token: null };
    if (body.token && !body.pin && !body.enroll) return { denied: json(401, { error: 'SESSION_EXPIRED' }) };

    if (body.enroll) {
      if (scope !== 'scanner') return { denied: json(400, { error: 'ENROLL_SCANNER_ONLY' }) };
      return (await consumeEnrollment(body.enroll))
        ? { token: issueToken(scope, secret) }
        : { denied: json(401, { error: 'ENROLL_INVALID' }) };
    }

    const ip = clientIp(event);
    const [mine, all] = await Promise.all([recentFails(scope, ip), recentFails(scope)]);
    if (mine >= MAX_FAILS || all >= MAX_FAILS_GLOBAL) {
      if (all >= MAX_FAILS_GLOBAL) console.error(`PIN LOGIN LOCKED (${scope}): ${all} wrong PINs in ${WINDOW_MIN} min from all addresses`);
      return { denied: json(429, { error: 'LOCKED', minutes: WINDOW_MIN }) };
    }
    if (sameSecret(body.pin ?? '', secret)) return { token: issueToken(scope, secret) };

    const { error } = await db().from('pin_failures').insert({ scope, ip });
    if (error) console.error('pin_failures insert:', error.message);
    await new Promise((r) => setTimeout(r, 800));
    return { denied: json(401, { error: 'BAD_PIN' }) };
  } catch (e) {
    if (e instanceof MissingSecret) {
      console.error('SESSION_SECRET missing – logins disabled');
      return { denied: json(500, { error: 'MISSING_SESSION_SECRET' }) };
    }
    console.error(`authenticate (${scope}) failed – refusing:`, e.message);
    return { denied: json(503, { error: 'UNAVAILABLE' }) };
  }
}
