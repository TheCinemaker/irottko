// Cloudflare Turnstile – server-side check of the "not a robot" token.
// Env: TURNSTILE_SECRET_KEY. Local dev on a LAN IP (which Turnstile does not
// accept as a hostname): TURNSTILE_TEST_MODE=1 → Cloudflare's always-pass test secret.
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Returns { ok: true } or { ok: false, reason }. */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_TEST_MODE === '1' ? TEST_SECRET : process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY missing – bot check skipped');
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, reason: 'missing-token' };

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    const j = await res.json();
    return j.success ? { ok: true } : { ok: false, reason: (j['error-codes'] || []).join(',') || 'failed' };
  } catch (e) {
    // Cloudflare unreachable: don't block real buyers; the other limits still apply.
    console.error('Turnstile verify unreachable – allowing:', e.message);
    return { ok: true, skipped: true };
  }
}
