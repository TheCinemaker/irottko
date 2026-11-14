// Non-destructive anon-key probe of the database (what a visitor's browser can do).
// Run: node --env-file=.env scripts/security-check.mjs
// Reads: every table/view. Writes: UPDATE/DELETE filtered on an id that cannot
// exist – a missing privilege fails before any row is touched (42501).
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const none = (t) => (t === 'checked_in_tickets' ? 'code=is.null' : 'id=is.null'); // matches no row, any id type
const TABLES = ['events', 'ticket_tiers', 'tier_status', 'orders', 'tickets', 'check_ins', 'checked_in_tickets', 'pin_failures', 'signups'];

let bad = 0;
const row = (name, what, res, body, expectDenied = true) => {
  // 55000 = "view is not updatable": rejected before any privilege check – no write possible.
  const denied = res.status === 401 || res.status === 403 || /42501|permission denied|"55000"/.test(body);
  const leak = !denied && /^\[\s*\{/.test(body);
  const okNow = expectDenied ? denied : res.ok;
  if (!okNow) bad++;
  console.log(`${okNow ? '✓' : '✗'} ${name.padEnd(20)} ${what.padEnd(7)} ${res.status} ${denied ? 'tiltva' : leak ? 'ADAT LÁTSZIK' : 'engedve (üres)'}`);
};
for (const t of TABLES) {
  let r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  row(t, 'SELECT', r, await r.text());
  r = await fetch(`${URL}/rest/v1/${t}?${none(t)}`, { method: 'PATCH', headers: H, body: '{}' });
  row(t, 'UPDATE', r, await r.text());
  r = await fetch(`${URL}/rest/v1/${t}?${none(t)}`, { method: 'DELETE', headers: H });
  row(t, 'DELETE', r, await r.text());
}
for (const [fn, args] of [['mark_order_paid', { p_order: '00000000-0000-0000-0000-000000000000', p_provider: 'x', p_ref: 'x' }], ['check_in', { p_code: 'X' }], ['reserve_tickets', { p_slug: 'x', p_qty: 1, p_email: 'x', p_name: 'x' }], ['online_taken', { p_event: '00000000-0000-0000-0000-000000000000' }]]) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  row(fn, 'RPC', r, await r.text());
}
const r = await fetch(`${URL}/rest/v1/rpc/get_event_public`, { method: 'POST', headers: H, body: JSON.stringify({ p_slug: process.env.VITE_EVENT_SLUG || 'one-night-irottko' }) });
const pub = await r.text();
row('get_event_public', 'RPC', r, pub, false);
const j = JSON.parse(pub);
const exact = (j.tiers || []).filter((t) => t.remaining != null && t.remaining !== 0 && !(t.kind === 'vip' && t.remaining <= 10));
console.log(`${exact.length || (j.online_left ?? 0) > 0 ? '✗' : '✓'} pontos készlet a publikus adatban: ${exact.length ? exact.map((t) => `${t.name}=${t.remaining}`).join(', ') : 'nincs'}${j.online_left > 0 ? `, online_left=${j.online_left}` : ''}`);
if (exact.length || j.online_left > 0) bad++;
console.log(bad ? `\n${bad} PROBLÉMA` : '\nMinden rendben.');
