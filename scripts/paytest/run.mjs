// Payment failure-path tests: real test-DB orders, simulated Barion answers.
// Run: node --env-file=.env --import ./scripts/paytest/register.mjs ./scripts/paytest/run.mjs
// Creates 6 'HIBATESZT …' orders (2 get paid: e-mail to delivered@resend.dev + a test invoice).
// TEST DATABASE ONLY – never against production.
import crypto from 'crypto';
const P = new URL('../../netlify/functions/lib/', import.meta.url).href;
const { db } = await import(P + 'db.js');
const { syncPayment } = await import(P + 'fulfill.js');
const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const answers = new Map();
globalThis.__barion = (pid) => answers.get(pid)();
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? '  ✓' : '  ✗ HIBA:'} ${msg}`); };

async function newOrder(label) {
  const { data, error } = await db().rpc('reserve_tickets', { p_slug: SLUG, p_qty: 1, p_email: 'delivered@resend.dev', p_name: `HIBATESZT ${label}`, p_phone: null, p_kind: 'standard' });
  if (error) throw error;
  const pid = crypto.randomUUID();
  await db().from('orders').update({ payment_provider: 'barion', payment_ref: pid, zip: '9730', city: 'Kőszeg', address: 'Teszt u. 1.' }).eq('id', data.order_id);
  return { id: data.order_id, total: data.total_huf, pid };
}
async function state(id) {
  const { data: o } = await db().from('orders').select('status, invoice_number, email_sent_at').eq('id', id).single();
  const { data: t } = await db().from('tickets').select('status').eq('order_id', id);
  return { ...o, tickets: t.map((x) => x.status).join(',') };
}
const say = (s) => answers;

console.log('1) Fizetés folyamatban (Prepared/Started/InProgress) – nem szabad hozzányúlni');
const o1 = await newOrder('folyamatban');
for (const st of ['Prepared', 'Started', 'InProgress', 'Waiting']) {
  answers.set(o1.pid, () => ({ status: st, paymentRequestId: o1.id, total: o1.total, currency: 'HUF' }));
  const r = await syncPayment(o1.pid); const s = await state(o1.id);
  ok(s.status === 'pending' && s.tickets === 'reserved', `${st}: rendelés ${s.status}, jegy ${s.tickets}`);
}

console.log('2) Nincs fedezet / elutasított kártya → Barion: Failed');
answers.set(o1.pid, () => ({ status: 'Failed', paymentRequestId: o1.id, total: o1.total, currency: 'HUF' }));
let r = await syncPayment(o1.pid); let s = await state(o1.id);
ok(r.status === 'cancelled' && s.status === 'cancelled' && s.tickets === 'void', `rendelés ${s.status}, jegy ${s.tickets} (a hely felszabadult)`);
ok(!s.invoice_number && !s.email_sent_at, 'nincs számla, nincs jegy-e-mail');

console.log('3) Vevő a „Mégsem”-re nyom → Canceled');
const o2 = await newOrder('megsem');
answers.set(o2.pid, () => ({ status: 'Canceled', paymentRequestId: o2.id, total: o2.total, currency: 'HUF' }));
r = await syncPayment(o2.pid); s = await state(o2.id);
ok(s.status === 'cancelled' && s.tickets === 'void', `rendelés ${s.status}, jegy ${s.tickets}`);

console.log('4) Lejárt a fizetési idő → Expired');
const o3 = await newOrder('lejart');
answers.set(o3.pid, () => ({ status: 'Expired', paymentRequestId: o3.id, total: o3.total, currency: 'HUF' }));
r = await syncPayment(o3.pid); s = await state(o3.id);
ok(s.status === 'expired' && s.tickets === 'void', `rendelés ${s.status}, jegy ${s.tickets}`);

console.log('5) Hamis / eltérő fizetés (rossz összeg, rossz rendelés, EUR) → nem lesz fizetett');
const o4 = await newOrder('elteres');
for (const [n, patch] of [['összeg', { total: 1 }], ['rendelés', { paymentRequestId: crypto.randomUUID() }], ['pénznem', { currency: 'EUR' }]]) {
  answers.set(o4.pid, () => ({ status: 'Succeeded', paymentRequestId: o4.id, total: o4.total, currency: 'HUF', ...patch }));
  r = await syncPayment(o4.pid); s = await state(o4.id);
  ok(r.status === 'payment_check' && s.status === 'pending' && !s.email_sent_at, `rossz ${n}: ${r.status}, rendelés ${s.status}, nincs jegy`);
}

console.log('6) Ismeretlen fizetés-azonosító');
r = await syncPayment(crypto.randomUUID());
ok(r.status === 'unknown', `eredmény: ${r.status}`);

console.log('7) Késve érkező sikeres fizetés: a foglalásunk már lejárt (a takarító „expired”-re tette)');
const o5 = await newOrder('keso');
await db().from('orders').update({ status: 'expired', expires_at: new Date(Date.now() - 60000).toISOString() }).eq('id', o5.id);
answers.set(o5.pid, () => ({ status: 'Succeeded', paymentRequestId: o5.id, total: o5.total, currency: 'HUF' }));
r = await syncPayment(o5.pid); s = await state(o5.id);
ok(s.status === 'paid' && s.tickets === 'valid' && s.email_sent_at, `rendelés ${s.status}, jegy ${s.tickets}, e-mail ${s.email_sent_at ? 'kiment' : 'NEM'} , számla ${s.invoice_number}`);

console.log('8) Dupla callback ugyanarra: nem lehet két számla / két e-mail');
const before = s;
r = await syncPayment(o5.pid); s = await state(o5.id);
ok(s.invoice_number === before.invoice_number && s.email_sent_at === before.email_sent_at, `számla ${s.invoice_number}, e-mail időpont változatlan`);

console.log('9) Párhuzamos callback + sikeroldal + retry egyszerre (3×)');
const o6 = await newOrder('parhuzamos');
answers.set(o6.pid, () => ({ status: 'Succeeded', paymentRequestId: o6.id, total: o6.total, currency: 'HUF' }));
const rs = await Promise.all([syncPayment(o6.pid), syncPayment(o6.pid), syncPayment(o6.pid)]);
await new Promise((r) => setTimeout(r, 3000));
s = await state(o6.id);
ok(s.status === 'paid' && s.tickets === 'valid', `rendelés ${s.status}, jegy ${s.tickets}, válaszok: ${rs.map((x) => x.status).join(',')}`);
const { data: inv } = await db().from('orders').select('invoice_number').eq('id', o6.id).single();
console.log(`     számla: ${inv.invoice_number}`);

console.log('10) Sikeres fizetés UTÁN érkező régi „Failed” üzenet → a fizetett rendelés maradjon fizetett');
answers.set(o6.pid, () => ({ status: 'Failed', paymentRequestId: o6.id, total: o6.total, currency: 'HUF' }));
r = await syncPayment(o6.pid); s = await state(o6.id);
ok(s.status === 'paid' && s.tickets === 'valid', `rendelés ${s.status}, jegy ${s.tickets}`);

console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
console.log('Teszt-rendelések:', [o1, o2, o3, o4, o5, o6].map((o) => o.id).join(' '));
process.exit(0);
