// POST /.netlify/functions/check-in   { pin | token, code?, staff? }  (without code: login / stats)
// The door scanner calls this. Without `code` it is the login: a correct PIN
// returns a session token (lib/pinGuard.js), which later scans send instead.
// With `code` it runs the check_in RPC: marks the ticket used exactly once and
// logs every scan in the check_ins table.
// Env: SCANNER_PIN (staff PIN, set it in Netlify env – at least 8 digits).
import { db, json } from './lib/db.js';
import { authenticate } from './lib/pinGuard.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
let eventId = null;

// Door counters for the scanner header: inside / still expected (paid, not yet
// scanned). Counts only – door staff never see names, e-mails or revenue here.
async function doorStats() {
  try {
    if (!eventId) {
      const { data, error } = await db().from('events').select('id').eq('slug', SLUG).single();
      if (error) throw error;
      eventId = data.id;
    }
    const count = (status) =>
      db()
        .from('tickets')
        .select('id, orders!inner(status)', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', status)
        .eq('orders.status', 'paid');
    const [used, valid] = await Promise.all([count('used'), count('valid')]);
    if (used.error || valid.error) throw used.error || valid.error;
    return { in: used.count ?? 0, waiting: valid.count ?? 0, at: new Date().toISOString() };
  } catch (e) {
    console.warn('doorStats failed:', e.message);
    return null;
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'BAD_JSON' });
  }

  const auth = await authenticate(event, 'scanner', body, process.env.SCANNER_PIN);
  if (auth.denied) return auth.denied;

  const code = String(body.code ?? '').trim();
  // Login, or a stats refresh (the scanner calls this on every live ping).
  if (!code) return json(200, { ok: true, token: auth.token, stats: await doorStats() });

  if (code.length > 64) return json(200, { ok: false, reason: 'NOT_FOUND', code: code.slice(0, 64) });

  const staff = String(body.staff ?? '').trim().slice(0, 40) || null;
  const { data, error } = await db().rpc('check_in', { p_code: code, p_staff: staff });
  if (error) {
    console.error('check_in failed:', error.message);
    return json(500, { error: 'DB' });
  }
  // No stats here: the scan answer must be fast; the live ping refreshes them.
  return json(200, data);
};
