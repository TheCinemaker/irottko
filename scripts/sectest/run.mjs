// Security regression tests (secrets, PIN locks, device enrolment, Turnstile, limits).
// Run: node --env-file=.env scripts/sectest/run.mjs
// TEST DATABASE ONLY. Writes: pin_failures rows with 10.251.* IPs (deleted at the
// end) and a few scanner_enrollments rows (hash only, left used/revoked/expired).
import crypto from 'crypto';
import { spawnSync } from 'child_process';
const L = new URL('../../netlify/functions/lib/', import.meta.url).href;
const F = new URL('../../netlify/functions/', import.meta.url).href;
const { db } = await import(L + 'db.js');
const OA = await import(L + 'orderAccess.js');
const { authenticate } = await import(L + 'pinGuard.js');
const EN = await import(L + 'enroll.js');
const { verifyTurnstile } = await import(L + 'turnstile.js');
const { handler: orderStatus } = await import(F + 'order-status.js');
const { handler: barionStart } = await import(F + 'barion-start.js');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };
const key = () => crypto.randomBytes(32).toString('base64url');
const withEnv = async (vars, fn) => {
  const old = {}; for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(old)) { if (old[k] == null) delete process.env[k]; else process.env[k] = old[k]; } }
};
const quiet = async (fn) => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; } };
const PIN = process.env.SCANNER_PIN;
const ev = (ip) => ({ headers: { 'x-nf-client-connection-ip': ip } });
const ORDER = '28a85d99-4fc1-4a8d-899c-ed64b802df0d';

console.log('1. Titkok (ORDER_LINK_SECRET, SESSION_SECRET)');
await withEnv({ ORDER_LINK_SECRET: null }, async () => {
  const s = await quiet(() => orderStatus({ queryStringParameters: { o: ORDER, t: 'x'.repeat(22) } }));
  ok(s.statusCode === 503, `nincs ORDER_LINK_SECRET → order-status ${s.statusCode} (nem esik vissza más kulcsra)`);
  const b = await quiet(() => barionStart({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ kind: 'standard', qty: 1, fullName: 'X Y', email: 'a@b.hu', zip: '1', city: 'x', address: 'x', attendeeNames: ['X Y'], acceptTerms: true }) }));
  ok(b.statusCode === 503, `nincs ORDER_LINK_SECRET → nincs új foglalás (${b.statusCode})`);
  let threw = false; try { OA.orderToken(ORDER); } catch { threw = true; }
  ok(threw, 'nincs ORDER_LINK_SECRET → link sem készül (e-mail hibára fut, a pótlás újrapróbálja)');
});
await withEnv({ ORDER_LINK_SECRET: 'rovid-titok' }, async () => ok(!OA.orderLinksReady(), '43 karakternél rövidebb titok = nincs beállítva'));
const A = key(), B = key();
const tokA = await withEnv({ ORDER_LINK_SECRET: A, ORDER_LINK_SECRET_PREVIOUS: null }, () => OA.orderToken(ORDER));
await withEnv({ ORDER_LINK_SECRET: B, ORDER_LINK_SECRET_PREVIOUS: A }, async () => ok(OA.validOrderToken(ORDER, tokA), 'kulcscsere: a régi link a _PREVIOUS kulccsal tovább működik'));
await withEnv({ ORDER_LINK_SECRET: B, ORDER_LINK_SECRET_PREVIOUS: null }, async () => ok(!OA.validOrderToken(ORDER, tokA), 'kulcscsere _PREVIOUS nélkül: a régi link érvénytelen'));
// a most élesben kiküldött linkek a service role kulccsal készültek (4abfd6b)
const legacy = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(`order-access:${ORDER}`).digest('base64url').slice(0, 22);
await withEnv({ ORDER_LINK_SECRET_PREVIOUS: null }, async () => ok(!OA.validOrderToken(ORDER, legacy), 'a jelenlegi éles linkek (service key) automatikusan NEM érvényesek'));
await withEnv({ ORDER_LINK_SECRET_PREVIOUS: process.env.SUPABASE_SERVICE_ROLE_KEY }, async () => ok(OA.validOrderToken(ORDER, legacy), '…de ha a régi kulcs a _PREVIOUS-ba kerül, tovább működnek'));
await withEnv({ SESSION_SECRET: null }, async () => {
  const r = await quiet(() => authenticate(ev('10.251.0.1'), 'scanner', { pin: PIN }, PIN));
  ok(r.denied?.statusCode === 500, `nincs SESSION_SECRET → belépés tiltva (${r.denied?.statusCode})`);
});
const S1 = key(), S2 = key();
const sess = await withEnv({ SESSION_SECRET: S1, SESSION_SECRET_PREVIOUS: null }, () => quiet(() => authenticate(ev('10.251.0.2'), 'scanner', { pin: PIN }, PIN)));
await withEnv({ SESSION_SECRET: S2, SESSION_SECRET_PREVIOUS: S1 }, async () => ok(!(await authenticate(ev('10.251.0.2'), 'scanner', { token: sess.token }, PIN)).denied, 'SESSION_SECRET csere _PREVIOUS-szal: a bent lévő szkenner marad'));
await withEnv({ SESSION_SECRET: S2, SESSION_SECRET_PREVIOUS: null }, async () => ok((await authenticate(ev('10.251.0.2'), 'scanner', { token: sess.token }, PIN)).denied?.statusCode === 401, 'SESSION_SECRET csere _PREVIOUS nélkül: újra be kell lépni'));

console.log('2. PIN-zár és eszközregisztráció');
const { error: tblE, count: tblC } = await db().from('scanner_enrollments').select('id', { head: true, count: 'exact' });
const tblErr = tblE || tblC == null;
const before = await quiet(() => authenticate(ev('10.251.1.1'), 'scanner', { pin: PIN }, PIN));
if (tblErr) {
  const r = await quiet(() => authenticate(ev('10.251.1.1'), 'scanner', { enroll: crypto.randomBytes(32).toString('base64url') }, PIN));
  ok(r.denied?.statusCode === 503, `a 012-es tábla még nincs → regisztráció zárva (${r.denied?.statusCode}), a teljes teszt a 012 után fut`);
} else {
  const e1 = await EN.createEnrollment('teszt-1');
  ok(e1.code.length === 43, `kód: 43 karakter = 256 bit véletlen, a DB-ben csak hash (${(await db().from('scanner_enrollments').select('code_hash').eq('id', e1.id).single()).data.code_hash.length} hex)`);
  let r = await authenticate(ev('10.251.1.2'), 'scanner', { enroll: e1.code }, PIN);
  ok(!!r.token, 'érvényes kód → szkenner-token');
  r = await authenticate(ev('10.251.1.2'), 'scanner', { enroll: e1.code }, PIN);
  ok(r.denied?.statusCode === 401, `ugyanaz a kód másodszor → ${r.denied?.statusCode} (egyszer használható)`);
  const e2 = await EN.createEnrollment('teszt-parhuzamos');
  const par = await Promise.all(Array.from({ length: 8 }, () => authenticate(ev('10.251.1.3'), 'scanner', { enroll: e2.code }, PIN)));
  ok(par.filter((x) => x.token).length === 1, `8 párhuzamos beváltás → ${par.filter((x) => x.token).length} token`);
  const e3 = await EN.createEnrollment('teszt-visszavont');
  await EN.revokeEnrollment(e3.id);
  ok((await authenticate(ev('10.251.1.4'), 'scanner', { enroll: e3.code }, PIN)).denied?.statusCode === 401, 'visszavont kód → 401');
  const e4 = await EN.createEnrollment('teszt-lejart');
  await db().from('scanner_enrollments').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', e4.id);
  ok((await authenticate(ev('10.251.1.5'), 'scanner', { enroll: e4.code }, PIN)).denied?.statusCode === 401, 'lejárt kód → 401');
  ok((await authenticate(ev('10.251.1.6'), 'scanner', { enroll: crypto.randomBytes(32).toString('base64url') }, PIN)).denied?.statusCode === 401, 'kitalált kód → 401');
  ok((await authenticate(ev('10.251.1.6'), 'scanner', { enroll: "x' or 1=1--" }, PIN)).denied?.statusCode === 401, 'hibás formátum → 401 (DB-hez sem jut)');
  const e5 = await EN.createEnrollment('teszt-admin');
  ok((await authenticate(ev('10.251.1.7'), 'admin', { enroll: e5.code }, process.env.ADMIN_PIN)).denied?.statusCode === 400, 'a kód admin-belépésre nem használható');
  ok((await authenticate(ev('10.251.1.7'), 'scanner', { pin: e5.code }, PIN)).denied?.statusCode === 401, 'a kód PIN-ként sem használható');
  // global lock
  await db().from('pin_failures').insert(Array.from({ length: 55 }, (_, i) => ({ scope: 'scanner', ip: `10.251.2.${i}` })));
  ok((await quiet(() => authenticate(ev('10.251.3.1'), 'scanner', { pin: PIN }, PIN))).denied?.statusCode === 429, 'globális zár alatt: PIN → 429');
  ok(!(await authenticate(ev('10.251.3.1'), 'scanner', { token: before.token }, PIN)).denied, 'globális zár alatt: a bent lévő szkenner működik');
  const e6 = await EN.createEnrollment('teszt-zar-alatt');
  ok(!!(await authenticate(ev('10.251.3.2'), 'scanner', { enroll: e6.code }, PIN)).token, 'globális zár alatt: új eszköz QR-kóddal felvehető');
  await db().from('pin_failures').delete().like('ip', '10.251.%');
}

console.log('3. Turnstile (a Cloudflare-hívás szimulálva)');
const realFetch = globalThis.fetch;
const ts = async (name, fake, expect) => {
  if (fake) globalThis.fetch = fake;
  const t0 = Date.now();
  const r = await quiet(() => withEnv({ TURNSTILE_TEST_MODE: null }, () => verifyTurnstile('tok', '1.2.3.4')));
  globalThis.fetch = realFetch;
  ok(r.ok === false && r.reason === expect, `${name} → ${JSON.stringify(r)} (${Date.now() - t0} ms)`);
  return Date.now() - t0;
};
// (AbortSignal.timeout's timer doesn't keep Node alive; a real socket would – keep the loop alive here)
const keep = setInterval(() => {}, 1000);
const ms = await ts('nem válaszol', (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))), 'unavailable');
clearInterval(keep);
ok(ms >= 3900 && ms < 5000, `időkorlát ≈ 4 s (${ms} ms)`);
await ts('hálózati hiba', async () => { throw new Error('ECONNRESET'); }, 'unavailable');
await ts('Cloudflare 502', async () => new Response('<html>502</html>', { status: 502 }), 'unavailable');
await ts('200, de nem JSON', async () => new Response('garbled', { status: 200 }), 'unavailable');
await ts('érvénytelen token', async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }), 'invalid-input-response');
globalThis.fetch = async () => { throw new Error('down'); };
const bs = await quiet(() => withEnv({ TURNSTILE_TEST_MODE: null }, () => barionStart({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ kind: 'standard', qty: 1, fullName: 'X Y', email: 'a@b.hu', zip: '1', city: 'x', address: 'x', attendeeNames: ['X Y'], acceptTerms: true, turnstileToken: 'tok' }) })));
globalThis.fetch = realFetch;
ok(bs.statusCode === 503 && /átmenetileg/.test(JSON.parse(bs.body).error), `foglalás Cloudflare-kiesésnél → ${bs.statusCode}: „${JSON.parse(bs.body).error}”`);

console.log('4. Foglalási limit adatbázis-hibánál (külön folyamatban, elérhetetlen DB-vel)');
const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
  process.env.TURNSTILE_TEST_MODE='1'; process.env.SUPABASE_URL='http://127.0.0.1:9'; process.env.VITE_SUPABASE_URL='http://127.0.0.1:9';
  console.error = () => {};
  const { handler } = await import('${F}barion-start.js');
  const r = await handler({ httpMethod:'POST', headers:{}, body: JSON.stringify({ kind:'standard', qty:1, fullName:'X Y', email:'a@b.hu', zip:'1', city:'x', address:'x', attendeeNames:['X Y'], acceptTerms:true, turnstileToken:'XXXX.DUMMY.TOKEN.XXXX' }) });
  process.stdout.write(JSON.stringify({ s: r.statusCode, e: JSON.parse(r.body).error }));`], { env: process.env, encoding: 'utf8', timeout: 60000 });
const cr = JSON.parse(child.stdout || '{}');
ok(cr.s === 503, `elérhetetlen DB → ${cr.s}: „${cr.e}” (nincs foglalás)`);

console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
process.exit(fail ? 1 : 0);
