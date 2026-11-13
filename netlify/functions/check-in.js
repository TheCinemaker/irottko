// POST /.netlify/functions/check-in   { pin, code?, staff? }
// The door scanner calls this. Without `code` it only checks the PIN (login).
// With `code` it runs the check_in RPC: marks the ticket used exactly once and
// logs every scan in the check_ins table.
// Env: SCANNER_PIN (staff PIN, set it in Netlify env – at least 6 digits).
import crypto from 'crypto';
import { db, json } from './lib/db.js';

const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD' });

  const expected = process.env.SCANNER_PIN;
  if (!expected) return json(500, { error: 'MISSING_SCANNER_PIN' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'BAD_JSON' });
  }

  if (!sameSecret(body.pin ?? '', expected)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down PIN guessing
    return json(401, { error: 'BAD_PIN' });
  }

  const code = String(body.code ?? '').trim();
  if (!code) return json(200, { ok: true }); // PIN check only

  if (code.length > 64) return json(200, { ok: false, reason: 'NOT_FOUND', code: code.slice(0, 64) });

  const staff = String(body.staff ?? '').trim().slice(0, 40) || null;
  const { data, error } = await db().rpc('check_in', { p_code: code, p_staff: staff });
  if (error) {
    console.error('check_in failed:', error.message);
    return json(500, { error: 'DB' });
  }
  return json(200, data);
};
