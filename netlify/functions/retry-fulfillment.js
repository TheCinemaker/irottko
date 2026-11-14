// Scheduled every 5 minutes (netlify.toml). Two safety nets:
//
// 1) Paid but not fully delivered: the ticket e-mail or the invoice failed
//    (e.g. Resend rate limit when many buy at once, Számlázz.hu down) and the
//    buyer never reloaded the success page → retry.
// 2) Paid but still "pending": the Barion callback was lost and the buyer
//    closed the browser before the redirect → ask Barion for the real state
//    (syncPayment marks it paid and delivers; a released reservation is revived).
//
// Limits: e-mails are retried for 14 days, invoices only for payments of the
// last 48 hours (so adding the Számlázz.hu key later never invoices old test
// orders). At most ~15 orders per run, spaced for Resend's ~2 requests/second.
import { db, json } from './lib/db.js';
import { fulfillPaid, syncPayment } from './lib/fulfill.js';

const MAX_PER_RUN = 15;
const GAP_MS = 700;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const handler = async () => {
  const report = { delivered: 0, synced: 0, errors: [] };
  const invoicing = Boolean(process.env.SZAMLAZZ_AGENT_KEY);

  // 2) lost callbacks: Barion payment started, our hold is over, still not paid
  const { data: stale } = await db()
    .from('orders')
    .select('id, payment_ref')
    .in('status', ['pending', 'expired'])
    .eq('payment_provider', 'barion')
    .not('payment_ref', 'is', null)
    .lt('expires_at', ago(0))
    .gt('created_at', ago(3 * 3600e3))
    .limit(MAX_PER_RUN);
  for (const o of stale || []) {
    try {
      const r = await syncPayment(o.payment_ref);
      if (r.status === 'paid') report.synced++;
    } catch (e) {
      report.errors.push(`sync ${o.id}: ${e.message}`);
    }
    await sleep(GAP_MS);
  }

  // 1) paid, not yet fulfilled
  const { data: open } = await db()
    .from('orders')
    .select('id, paid_at, email_sent_at, invoice_number')
    .eq('status', 'paid')
    .is('fulfilled_at', null)
    .gt('paid_at', ago(14 * 86400e3))
    .order('paid_at')
    .limit(50);
  const todo = (open || [])
    .filter((o) => !o.email_sent_at || (invoicing && !o.invoice_number && o.paid_at > ago(48 * 3600e3)))
    .slice(0, MAX_PER_RUN);
  for (const o of todo) {
    try {
      await fulfillPaid(o.id, { invoice: invoicing && o.paid_at > ago(48 * 3600e3) });
      report.delivered++;
    } catch (e) {
      report.errors.push(`fulfil ${o.id}: ${e.message}`);
    }
    await sleep(GAP_MS);
  }

  // 3) wrong-PIN log older than a day (personal data: IP addresses)
  await db().from('pin_failures').delete().lt('failed_at', ago(86400e3));

  if (report.synced || report.delivered || report.errors.length) console.log('retry-fulfillment', JSON.stringify(report));
  return json(200, report);
};
