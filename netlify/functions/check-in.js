// POST /.netlify/functions/check-in   { pin | token, code?, staff? }  (without code: login / stats)
// The door scanner calls this. Without `code` it is the login: a correct PIN
// returns a session token (lib/pinGuard.js), which later scans send instead.
// With `code` it runs the check_in RPC: marks the ticket used exactly once and
// logs every scan in the check_ins table.
// Env: SCANNER_PIN (staff PIN, set it in Netlify env – at least 8 digits).
import crypto from 'crypto';
import { db, json } from './lib/db.js';
import { authenticate } from './lib/pinGuard.js';
import { landingAt } from '../../src/lib/schedule.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
let eventId = null;

// Fire-safety limit (013_venue_limit.sql): how many tickets can still be sold.
// null when no limit is set or the migration hasn't run yet.
async function ticketsLeft() {
  try {
    const { data: ev, error } = await db().from('events').select('*').eq('slug', SLUG).single();
    if (error) throw error;
    if (!ev.venue_limit_on || ev.venue_limit == null) return null; // switched off in the admin
    const { data: taken, error: tErr } = await db().rpc('total_taken', { p_event: ev.id });
    if (tErr) throw tErr;
    return Math.max(ev.venue_limit - (ev.non_ticket_count ?? 0) - taken, 0);
  } catch (e) {
    console.warn('ticketsLeft failed:', e.message);
    return null;
  }
}

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
    const [used, valid, limits] = await Promise.all([count('used'), count('valid'), ticketsLeft()]);
    if (used.error || valid.error) throw used.error || valid.error;
    // left: tickets that can still be sold (door QR too); null = no limit set
    return { in: used.count ?? 0, waiting: valid.count ?? 0, left: limits, at: new Date().toISOString() };
  } catch (e) {
    console.warn('doorStats failed:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offline door mode. The scanner downloads every valid ticket after login and
// then every minute (src/lib/offlineDoor.js); with no network it decides from
// that list and uploads its entries later (018_offline_door.sql).
// The list holds a fingerprint of each code (SHA-256, first 20 hex chars), not
// the code: a lost door phone can't be turned into valid tickets.
// Row: [fingerprint, name, tier, kind, usedAt ms | 0, order no.]

const fingerprint = (code) => crypto.createHash('sha256').update(String(code)).digest('hex').slice(0, 20);

async function doorList() {
  if (!eventId) {
    const { data, error } = await db().from('events').select('id').eq('slug', SLUG).single();
    if (error) throw error;
    eventId = data.id;
  }
  const rows = [];
  const orderNo = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('tickets')
      .select('code, status, holder_name, checked_in_at, order_id, orders!inner(status, full_name), ticket_tiers(name, kind)')
      .eq('event_id', eventId)
      .in('status', ['valid', 'used'])
      .eq('orders.status', 'paid')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    for (const t of data) {
      if (!orderNo.has(t.order_id)) orderNo.set(t.order_id, orderNo.size + 1);
      rows.push([
        fingerprint(t.code),
        (t.holder_name || t.orders?.full_name || '').slice(0, 80),
        t.ticket_tiers?.name || '',
        t.ticket_tiers?.kind || '',
        t.status === 'used' ? new Date(t.checked_in_at || Date.now()).getTime() : 0,
        orderNo.get(t.order_id),
      ]);
    }
    if (data.length < 1000) break;
  }
  // The list is useless after the night: the phone drops it at this time.
  return { at: Date.now(), until: landingAt({}).getTime() + 6 * 3600e3, rows };
}

// Entries a phone made without network: [{ id, code, at, staff }].
const MAX_SYNC = 200;
async function syncOffline(list) {
  const results = [];
  for (const s of (Array.isArray(list) ? list : []).slice(0, MAX_SYNC)) {
    const code = String(s?.code ?? '').trim().slice(0, 64);
    const id = String(s?.id ?? '').slice(0, 64);
    if (!code || !id) continue;
    const ms = Number(s.at);
    const at = s.at != null && s.at !== '' && Number.isFinite(ms) && ms > 0 && ms < 8.64e15 ? new Date(ms).toISOString() : null;
    const staff = String(s.staff ?? '').trim().slice(0, 40) || null;
    let { data, error } = await db().rpc('check_in_offline', { p_code: code, p_staff: staff, p_at: at, p_client_id: id });
    if (error && /check_in_offline|PGRST202|42883/.test(`${error.code} ${error.message}`)) {
      // 018 not run yet: the plain check-in still lets the ticket in (time = now).
      console.warn('check_in_offline missing – run supabase/018_offline_door.sql');
      ({ data, error } = await db().rpc('check_in', { p_code: code, p_staff: staff }));
    }
    if (error) {
      console.error('offline sync failed:', error.message);
      break; // keep the rest on the phone, try again next minute
    }
    results.push({ id, ok: !!data?.ok, reason: data?.reason || null });
  }
  return results;
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

  // Offline mode: upload the entries made without network, then the fresh list.
  if (body.sync || body.list) {
    try {
      const synced = body.sync ? await syncOffline(body.sync) : [];
      return json(200, { ok: true, synced, list: body.list ? await doorList() : null });
    } catch (e) {
      console.error('door list failed:', e.message);
      return json(500, { error: 'DB' });
    }
  }

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
