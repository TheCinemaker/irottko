// Wallet push tests – TEST DATABASE. Run: node --env-file=.env scripts/wallettest.mjs
// 1) the pass carries webServiceURL, authenticationToken, the venue (100 m) and
//    the "Utastájékoztatás" field with changeMessage
// 2) the PassKit web service as an iPhone would call it (register, list,
//    download, unregister) – a fake device, removed at the end
// 3) APNs accepts our Pass Type certificate (a fake device token must give
//    400 BadDeviceToken, not 403)
// 4) Google: an access token and the event-ticket class can be read (no message is sent)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

process.env.URL = 'https://irottko.netlify.app'; // a public https site, like production
const { db } = await import('../netlify/functions/lib/db.js');
const { applePass, APPLE_PASS_TYPE_ID, eventClassId, googleCredentials } = await import('../netlify/functions/lib/wallet.js');
const { passAuthToken } = await import('../netlify/functions/lib/passAuth.js');
const { pushApple } = await import('../netlify/functions/lib/walletPush.js');
const { handler } = await import('../netlify/functions/passkit.js');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };

const { data: t } = await db().from('tickets').select('code, holder_name, order_id, status, ticket_tiers(name, kind)').eq('status', 'valid').limit(1).single();
const ticket = { ...t, tier_name: t.ticket_tiers?.name, tier_kind: t.ticket_tiers?.kind };
const serial = `irottko-${ticket.code}`;
const type = APPLE_PASS_TYPE_ID();

console.log('1) A jegy tartalma');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkpass-'));
fs.writeFileSync(path.join(dir, 'p.zip'), await applePass(ticket, { message: 'TESZT üzenet' }));
// .pkpass = zip: Windows' own tar (bsdtar) reads zip; elsewhere unzip
if (process.platform === 'win32') execFileSync('C:/Windows/System32/tar.exe', ['-xf', 'p.zip', 'pass.json'], { cwd: dir });
else execFileSync('unzip', ['-o', 'p.zip', 'pass.json'], { cwd: dir });
const pj = JSON.parse(fs.readFileSync(path.join(dir, 'pass.json'), 'utf8'));
ok(pj.webServiceURL === 'https://irottko.netlify.app/passkit', `webServiceURL: ${pj.webServiceURL}`);
ok(pj.authenticationToken === passAuthToken(serial) && pj.authenticationToken.length >= 16, 'authenticationToken a jegyhez kötve');
ok(pj.maxDistance === 100 && Math.abs(pj.locations?.[0]?.latitude - 47.38818724050592) < 1e-9, `helyszín: ${pj.locations?.[0]?.latitude}, ${pj.locations?.[0]?.longitude}, ${pj.maxDistance} m – „${pj.locations?.[0]?.relevantText}”`);
const news = pj.boardingPass.backFields.find((f) => f.key === 'news');
ok(news?.value === 'TESZT üzenet' && news.changeMessage === 'ÍR 0115: %@', `Utastájékoztatás mező: „${news?.value}” (${news?.changeMessage})`);

console.log('2) Tárca-szolgáltatás (ahogy az iPhone hívja)');
const device = 'teszteszkoz' + Date.now();
const call = (method, p, { auth, body, qs, headers } = {}) =>
  handler({ httpMethod: method, path: `/passkit/v1/${p}`, headers: { ...(auth ? { Authorization: `ApplePass ${auth}` } : {}), ...(headers || {}) }, body: body ? JSON.stringify(body) : '', queryStringParameters: qs || {} });
let r = await call('POST', `devices/${device}/registrations/${type}/${serial}`, { auth: 'rossz', body: { pushToken: 'a'.repeat(64) } });
ok(r.statusCode === 401, `rossz kulccsal regisztráció → ${r.statusCode}`);
r = await call('POST', `devices/${device}/registrations/${type}/${serial}`, { auth: passAuthToken(serial), body: { pushToken: 'a'.repeat(64) } });
ok(r.statusCode === 201, `regisztráció → ${r.statusCode}`);
r = await call('POST', `devices/${device}/registrations/${type}/${serial}`, { auth: passAuthToken(serial), body: { pushToken: 'b'.repeat(64) } });
ok(r.statusCode === 200, `ismételt regisztráció (új token) → ${r.statusCode}`);
r = await call('GET', `devices/${device}/registrations/${type}`);
ok(r.statusCode === 200 && JSON.parse(r.body).serialNumbers.includes(serial), `frissült jegyek listája → ${r.statusCode} ${r.body}`);
const tag = JSON.parse(r.body).lastUpdated;
r = await call('GET', `devices/${device}/registrations/${type}`, { qs: { passesUpdatedSince: tag } });
ok(r.statusCode === 204, `nincs újabb változás → ${r.statusCode}`);
r = await call('GET', `passes/${type}/${serial}`, { auth: passAuthToken(serial) });
ok(r.statusCode === 200 && r.headers['Content-Type'] === 'application/vnd.apple.pkpass', `friss jegy letöltése → ${r.statusCode} (${Math.round(Buffer.from(r.body, 'base64').length / 1024)} kB)`);
r = await call('GET', `passes/${type}/${serial}`, { auth: 'rossz' });
ok(r.statusCode === 401, `letöltés rossz kulccsal → ${r.statusCode}`);
r = await call('DELETE', `devices/${device}/registrations/${type}/${serial}`, { auth: passAuthToken(serial) });
ok(r.statusCode === 200, `kijelentkezés → ${r.statusCode}`);
r = await call('GET', `devices/${device}/registrations/${type}`);
ok(r.statusCode === 204, `utána nincs regisztráció → ${r.statusCode}`);
await db().from('wallet_registrations').delete().like('device_library_identifier', 'teszteszkoz%');

console.log('3) Apple push-szerver (APNs) – elfogadja-e a tanúsítványt');
const a = await pushApple(['0'.repeat(64)]);
ok(a.failed === 1 && /^400/.test(a.errors[0] || '') && /BadDeviceToken/.test(a.errors[0]), `kitalált telefon → ${a.errors[0]} (400 = a tanúsítvány rendben, csak az eszköz nem létezik)`);

console.log('4) Google Wallet API – hozzáférés (üzenet NEM megy ki)');
try {
  const crypto = await import('crypto');
  const { client_email, private_key } = googleCredentials();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(private_key, 'base64url');
  const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) })).json();
  ok(!!tok.access_token, 'hozzáférési token megvan');
  const cls = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass/${encodeURIComponent(eventClassId())}`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const cj = await cls.json().catch(() => ({}));
  ok(cls.status === 200 || cls.status === 404, `jegyosztály lekérdezése → ${cls.status}${cls.status === 200 ? ` (reviewStatus: ${cj.reviewStatus}, locations: ${JSON.stringify(cj.locations || null)})` : ' (még senki nem mentett Google jegyet)'}`);
} catch (e) {
  ok(false, 'Google: ' + e.message);
}
console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
process.exit(0);
