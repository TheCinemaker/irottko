// Test account only: the live Számlázz.hu account is connected to NAV (every
// invoice there is real). With the live key or switch in the environment this refuses.
if (process.env.SZAMLAZZ_LIVE === "1" || process.env.SZAMLAZZ_AGENT_KEY_LIVE || process.env.BARION_LIVE === "1") {
  console.error("LEÁLLÍTVA: éles Számlázz.hu / Barion beállítás van a környezetben – ez a teszt csak sandboxszal futhat.");
  process.exit(1);
}
// ONE PURCHASE = ONE INVOICE – tests against the Számlázz.hu TEST account.
// Run: node --env-file=.env scripts/invoicetest.mjs
// Takes the latest paid test order that already has an invoice, makes the
// system "forget" the number (as if the answer had been lost) and checks that
//   A) an old, broken-off attempt → the SAME invoice is found, none issued
//   B) a fresh attempt (< 5 min)   → nothing issued, wait for the retry job
//   C) wrong Agent key             → nothing issued, error shown in the admin
//   D) the lookup parser on the real answers of the test account
// The order is restored at the end. No e-mail is sent (email_sent_at stays set).
import { db } from '../netlify/functions/lib/db.js';
import { fulfillPaid } from '../netlify/functions/lib/fulfill.js';
import { parseLookup, findInvoiceByOrder } from '../netlify/functions/lib/szamlazzInvoice.js';
import crypto from 'crypto';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  ✓' : '  ✗ HIBA:'} ${m}`); };
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const { data: o, error } = await db()
  .from('orders')
  .select('id, invoice_number, invoice_attempted_at, invoice_error, email_sent_at, fulfilled_at, fulfillment_started_at')
  .eq('status', 'paid').not('invoice_number', 'is', null).not('email_sent_at', 'is', null)
  .order('paid_at', { ascending: false }).limit(1).single();
if (error) throw error;
const orig = { ...o };
const reset = (attemptedMinAgo) =>
  db().from('orders').update({ invoice_number: null, invoice_error: null, fulfilled_at: null, fulfillment_started_at: null, invoice_attempted_at: minsAgo(attemptedMinAgo) }).eq('id', o.id);
const state = async () => (await db().from('orders').select('invoice_number, invoice_error, invoice_attempted_at').eq('id', o.id).single()).data;
console.log(`Tesztrendelés ${o.id}, számlája: ${o.invoice_number}`);

try {
  console.log('A) Régi, megszakadt kísérlet (10 perce) → a meglévő számlát kell megtalálni');
  await reset(10);
  await fulfillPaid(o.id);
  let s = await state();
  ok(s.invoice_number === o.invoice_number, `számla: ${s.invoice_number} (eredeti: ${o.invoice_number})`);
  ok(new Date(s.invoice_attempted_at).getTime() < Date.now() - 9 * 60000, 'nem indult új kiállítás (a kísérlet ideje nem változott)');

  console.log('B) Friss kísérlet (1 perce) → semmit nem szabad kiállítani, várni kell');
  await reset(1);
  await fulfillPaid(o.id);
  s = await state();
  ok(s.invoice_number === null && !s.invoice_error, `számla: ${s.invoice_number ?? 'nincs (vár)'}`);

  console.log('C) Rossz Agent-kulcs (10 perces kísérlet után) → semmit nem szabad kiállítani, hiba az adminnak');
  await reset(10);
  const key = process.env.SZAMLAZZ_AGENT_KEY;
  process.env.SZAMLAZZ_AGENT_KEY = 'x'.repeat(40);
  try { await fulfillPaid(o.id); } finally { process.env.SZAMLAZZ_AGENT_KEY = key; }
  s = await state();
  ok(s.invoice_number === null && /Sikertelen bejelentkez/.test(s.invoice_error || ''), `számla: nincs, hiba: ${s.invoice_error}`);

  console.log('D) A lekérdezés értelmezése (a teszt-fiók valódi válaszai)');
  ok((await findInvoiceByOrder(o.id)) === o.invoice_number, 'létező számla → számlaszám');
  ok((await findInvoiceByOrder(crypto.randomUUID())) === null, 'nem létező rendelés → „nincs számla”');
  let threw = false;
  try { parseLookup('<html>Karbantartás</html>'); } catch { threw = true; }
  ok(threw, 'érthetetlen válasz (pl. karbantartó oldal) → hiba, nem „nincs számla”');
  threw = false;
  try { parseLookup('<xmlszamlavalasz><sikeres>false</sikeres><hibakod><![CDATA[7]]></hibakod><hibauzenet><![CDATA[Valami más]]></hibauzenet></xmlszamlavalasz>'); } catch { threw = true; }
  ok(threw, '7-es kód más szöveggel → hiba, nem „nincs számla”');
} finally {
  await db().from('orders').update({
    invoice_number: orig.invoice_number, invoice_attempted_at: orig.invoice_attempted_at, invoice_error: orig.invoice_error,
    fulfilled_at: orig.fulfilled_at, fulfillment_started_at: null,
  }).eq('id', o.id);
  console.log('Rendelés visszaállítva.');
}
console.log(`\nEREDMÉNY: ${pass} OK, ${fail} HIBA`);
