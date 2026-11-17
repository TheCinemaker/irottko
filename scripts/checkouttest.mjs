// Checkout guards – TEST DATABASE + Barion SANDBOX only.
// Run: node --env-file=.env scripts/checkouttest.mjs
//   1) price changed since the last step → 409 with the new price, hold released
//   2) mistyped company tax number (check digit) → 400, nothing reserved
//   3) tax number without dashes → accepted, saved as 12345678-1-23 (then cancelled)
process.env.TURNSTILE_TEST_MODE = '1';
const { handler } = await import('../netlify/functions/barion-start.js');
const { db } = await import('../netlify/functions/lib/db.js');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };
const base = { kind: 'standard', qty: 1, fullName: 'CHECKOUTTESZT Elek', email: 'delivered@resend.dev', zip: '9730', city: 'Kőszeg', address: 'Teszt u. 1.', attendeeNames: ['CHECKOUTTESZT Elek'], acceptTerms: true, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' };
const call = async (extra) => {
  const r = await handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify({ ...base, ...extra }) });
  return { status: r.statusCode, body: JSON.parse(r.body) };
};
const latest = async () => (await db().from('orders').select('id, status, tax_number, total_huf').eq('full_name', 'CHECKOUTTESZT Elek').order('created_at', { ascending: false }).limit(1).maybeSingle()).data;

console.log('1) Közben változott az ár (a vevő 1 Ft-ot látott)');
let r = await call({ expectedTotal: 1 });
let o = await latest();
ok(r.status === 409 && r.body.priceChanged && /változott az ár/.test(r.body.error), `${r.status}: ${r.body.error}`);
ok(o && o.status === 'cancelled', `a foglalás felszabadult (rendelés: ${o?.status})`);

console.log('2) Elgépelt céges adószám (rossz ellenőrző számjegy)');
const before = o?.id;
r = await call({ isCompany: true, companyName: 'Teszt Kft.', taxNumber: '11312038-2-18' });
o = await latest();
ok(r.status === 400 && /adószám/.test(r.body.error), `${r.status}: ${r.body.error}`);
ok(o?.id === before, 'nem jött létre foglalás');

console.log('3) Adószám kötőjel nélkül, helyes ár → elfogadva, egységes formában mentve');
const { data: pub } = await db().rpc('get_event_public', { p_slug: process.env.VITE_EVENT_SLUG || 'one-night-irottko' });
const price = pub.tiers.find((t) => t.kind === 'standard' && t.active)?.price_huf;
r = await call({ isCompany: true, companyName: 'Teszt Kft.', taxNumber: '11312037218', expectedTotal: price });
o = await latest();
ok(r.status === 200 && r.body.gatewayUrl, `${r.status} → Barion sandbox fizetőoldal`);
ok(o?.tax_number === '11312037-2-18', `mentett adószám: ${o?.tax_number}`);
if (o && o.status === 'pending') await db().rpc('mark_order_failed', { p_order: o.id, p_status: 'cancelled' });

console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
process.exit(0);
