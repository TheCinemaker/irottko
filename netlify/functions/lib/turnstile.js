// Cloudflare Turnstile – server-side check of the "not a robot" token.
// Env: TURNSTILE_SECRET_KEY. Local dev on a LAN IP (which Turnstile does not
// accept as a hostname): TURNSTILE_TEST_MODE=1 → Cloudflare's always-pass test secret.
// No key at all → every reservation is refused (fail closed).
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 4000;

/** Returns { ok: true } or { ok: false, reason } – reason 'unavailable' = Cloudflare could not answer. */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_TEST_MODE === '1' ? TEST_SECRET : process.env.TURNSTILE_SECRET_KEY;
  // Fail closed: a missing key must never silently switch the bot check off.
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY missing – reservation refused');
    return { ok: false, reason: 'not-configured' };
  }
  if (!token) return { ok: false, reason: 'missing-token' };

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);

  // Fail closed: timeout, network error, Cloudflare 5xx or a garbled answer →
  // 'unavailable' (the buyer is asked to retry), never a silent pass.
  let res;
  try {
    res = await fetch(VERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    console.error(`Turnstile ${e.name === 'TimeoutError' ? `timeout (${TIMEOUT_MS} ms)` : 'unreachable'} – refusing:`, e.message);
    return { ok: false, reason: 'unavailable' };
  }
  if (!res.ok) {
    console.error(`Turnstile HTTP ${res.status} – refusing`);
    return { ok: false, reason: 'unavailable' };
  }
  let j;
  try {
    j = await res.json();
  } catch {
    console.error('Turnstile answer is not JSON – refusing');
    return { ok: false, reason: 'unavailable' };
  }
  return j.success ? { ok: true } : { ok: false, reason: (j['error-codes'] || []).join(',') || 'failed' };
}
