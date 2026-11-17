// Wallet updates and the "Üzenet az utasoknak" (message to passengers) – used by
// netlify/functions/passkit.js (Apple's PassKit web service) and admin-action.
//
// Apple: every pass carries webServiceURL + its own authenticationToken. When
// the pass is added to Apple Wallet, the iPhone registers (device id + push
// token) at /passkit/v1/devices/… → table wallet_registrations
// (supabase/016_wallet_push.sql). To update: an empty APNs push (topic = the
// Pass Type ID, signed with the same Pass Type certificate that signs the
// pass); the phone then asks which passes changed and downloads them. The
// message sits in a back field with changeMessage, so the change shows on
// the lock screen.
// Google: one addMessage call on the event-ticket class (TEXT_AND_NOTIFY) –
// shown on every saved ticket of the class. Google limits how many
// notifications a pass gets per day.
import crypto from 'crypto';
import http2 from 'http2';
import { db } from './db.js';
import { appleCertificates, APPLE_PASS_TYPE_ID, googleCredentials, eventClassId, EVENT_END } from './wallet.js';

export { passAuthToken, validPassAuth } from './passAuth.js';

/* ---------- the current message ---------- */
const SLUG = () => process.env.VITE_EVENT_SLUG || 'one-night-irottko';
export async function currentMessage() {
  const { data, error } = await db().from('events').select('*').eq('slug', SLUG()).single();
  if (error) throw error;
  return { text: data.wallet_message || null, at: data.wallet_message_at ? new Date(data.wallet_message_at) : null };
}

/* ---------- Apple: APNs over HTTP/2 with the Pass Type certificate ---------- */
export async function pushApple(tokens) {
  const result = { sent: 0, failed: 0, removed: 0, errors: [] };
  if (!tokens.length) return result;
  const { signerCert, signerKey } = appleCertificates();
  const client = http2.connect('https://api.push.apple.com', { cert: signerCert, key: signerKey });
  client.on('error', (e) => result.errors.push(e.message));
  const one = (token) =>
    new Promise((resolve) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        'apns-topic': APPLE_PASS_TYPE_ID(),
        'content-type': 'application/json',
      });
      let status = 0;
      let body = '';
      req.on('response', (h) => (status = h[':status']));
      req.on('data', (c) => (body += c));
      req.on('end', () => resolve({ token, status, body }));
      req.on('error', (e) => resolve({ token, status: 0, body: e.message }));
      req.setTimeout(8000, () => req.close());
      req.end('{}'); // pass updates: an empty payload
    });
  try {
    const answers = await Promise.all(tokens.map(one));
    for (const a of answers) {
      if (a.status === 200) result.sent += 1;
      else {
        result.failed += 1;
        if (result.errors.length < 5) result.errors.push(`${a.status} ${a.body}`.slice(0, 160));
        // 410 = the pass was removed from that phone: forget the registration
        if (a.status === 410) {
          await db().from('wallet_registrations').delete().eq('push_token', a.token);
          result.removed += 1;
        }
      }
    }
  } finally {
    client.close();
  }
  return result;
}

/* ---------- Google: addMessage on the event-ticket class ---------- */
let googleToken = null;
async function googleAccessToken() {
  if (googleToken && googleToken.exp > Date.now() + 60000) return googleToken.value;
  const { client_email, private_key } = googleCredentials();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google token: ${res.status} ${data.error || ''}`);
  googleToken = { value: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return googleToken.value;
}

export async function messageGoogle(text) {
  const token = await googleAccessToken();
  const id = eventClassId();
  const res = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass/${encodeURIComponent(id)}/addMessage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        id: `utas-${Date.now()}`,
        header: 'ÍR 0115 – utastájékoztatás',
        body: text,
        messageType: 'TEXT_AND_NOTIFY',
        displayInterval: { start: { date: new Date().toISOString() }, end: { date: EVENT_END.toISOString() } },
      },
    }),
  });
  const body = await res.text();
  // 404: nobody has saved a Google ticket yet, so the class doesn't exist – nothing to notify
  if (res.status === 404) return { ok: true, note: 'no Google Wallet tickets saved yet' };
  if (!res.ok) throw new Error(`Google addMessage ${res.status}: ${body.slice(0, 200)}`);
  return { ok: true };
}

/* ---------- the admin's "send to passengers" ---------- */
// Invisible marker: Apple shows the lock-screen message only when the field's
// value CHANGES ("If the value of a field has changed and the field specifies a
// change message, the device shows the message" – Wallet Developer Guide,
// Updating a Pass). Sending the same text again toggles it, so it still notifies.
const MARK = '\u200B';
export const plainMessage = (v) => String(v || '').replace(new RegExp(MARK, 'g'), '');

export async function sendPassengerMessage(input) {
  // the pass adds "ÍR 0115: " (changeMessage) – don't double it
  const text = String(input)
    .replace(/^\s*[IÍ]R\s*0115\s*:\s*/i, '')
    .trim();
  const { data: prev } = await db().from('events').select('wallet_message').eq('slug', SLUG()).single();
  const value = prev?.wallet_message === text ? text + MARK : text;
  const at = new Date().toISOString();
  const { error } = await db().from('events').update({ wallet_message: value, wallet_message_at: at }).eq('slug', SLUG());
  if (error) throw error;

  const { data: regs, error: rErr } = await db().from('wallet_registrations').select('push_token').eq('pass_type_identifier', APPLE_PASS_TYPE_ID());
  if (rErr) throw rErr;
  const tokens = [...new Set(regs.map((r) => r.push_token))];
  const apple = await pushApple(tokens).catch((e) => ({ sent: 0, failed: tokens.length, removed: 0, errors: [e.message] }));
  const google = await messageGoogle(text).catch((e) => ({ ok: false, error: e.message }));
  return { at, apple: { devices: tokens.length, ...apple }, google };
}
