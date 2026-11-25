// Paid order → tickets valid → Számlázz.hu invoice → ticket e-mail.
// Idempotent and safe to call from both the Barion callback and the
// success page: each step runs only if it has not succeeded yet, and a
// short-lived lock stops two calls from working on the same order at once.
import { db } from './db.js';
import { getPaymentState, PAID, FAILED } from './barion.js';
import { createInvoice, findInvoiceByOrder } from './szamlazzInvoice.js';
import { sendTicketEmail } from './ticketEmail.js';
import { EVENT_DETAILS } from '../../../src/data/eventData.js';

const LOCK_MINUTES = 3;
// After an invoice attempt that broke off, wait this long before looking it up /
// retrying: Számlázz.hu may still be finishing the first one (see fulfillPaid).
const INVOICE_SETTLE_MIN = 5;

export async function loadOrder(orderId) {
  const { data: order, error } = await db().from('orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  const { data: tickets, error: tErr } = await db()
    .from('tickets')
    .select('id, code, price_huf, status, holder_name, ticket_tiers(name, kind)')
    .eq('order_id', orderId)
    .order('created_at');
  if (tErr) throw tErr;
  return {
    order,
    tickets: tickets.map((t) => ({ ...t, tier_name: t.ticket_tiers?.name, tier_kind: t.ticket_tiers?.kind })),
  };
}

/** One issued ticket by its code (the code itself is the secret on the ticket). */
export async function loadTicketByCode(code) {
  const { data, error } = await db()
    .from('tickets')
    .select('code, holder_name, order_id, status, ticket_tiers(name, kind)')
    .eq('code', code)
    .in('status', ['valid', 'used'])
    .maybeSingle();
  if (error) throw error;
  return data && { ...data, tier_name: data.ticket_tiers?.name, tier_kind: data.ticket_tiers?.kind };
}

/** Tickets grouped into invoice / Barion lines: one line per tier and price. */
export function lines(tickets) {
  const map = new Map();
  for (const t of tickets) {
    const key = `${t.tier_name}|${t.price_huf}`;
    const l = map.get(key) || { name: `${EVENT_DETAILS.title} – belépőjegy (${t.tier_name})`, tier: t.tier_name, unitPrice: t.price_huf, quantity: 0 };
    l.quantity += 1;
    map.set(key, l);
  }
  return [...map.values()];
}

/** Invoice lines: one line per ticket (like the big ticket offices), with the
 *  event, venue, time, tier and the ticket holder in the line note. */
export function invoiceLines(order, tickets) {
  const when = `${EVENT_DETAILS.dateString.replace(/\s*\(.*\)/, '')} ${EVENT_DETAILS.doorsOpen}`;
  return tickets
    .filter((t) => t.status === 'valid' || t.status === 'used')
    .map((t) => ({
      name: `Belépőjegy – ${t.tier_kind === 'vip' ? 'VIP Lounge' : t.tier_name}`,
      note: [EVENT_DETAILS.title, EVENT_DETAILS.venue, EVENT_DETAILS.address, when, t.holder_name || order.full_name, `jegykód: ${t.code}`]
        .filter(Boolean)
        .join(' – '),
      unitPrice: t.price_huf,
      quantity: 1,
    }));
}

async function claim(orderId) {
  const staleBefore = new Date(Date.now() - LOCK_MINUTES * 60000).toISOString();
  const { data } = await db()
    .from('orders')
    .update({ fulfillment_started_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')
    .is('fulfilled_at', null)
    .or(`fulfillment_started_at.is.null,fulfillment_started_at.lt.${staleBefore}`)
    .select('id');
  return Boolean(data?.length);
}

const release = (orderId, patch = {}) =>
  db().from('orders').update({ ...patch, fulfillment_started_at: null }).eq('id', orderId);

// opts.invoice=false: deliver tickets only (used by the retry job for older orders).
// A paid order whose buyer ticked the newsletter box → the marketing list
// (019). A new consent also undoes an earlier unsubscribe. Never blocks the
// tickets or the invoice.
export async function addMarketingContact(order) {
  if (!order.marketing_consent_at || order.status !== 'paid') return;
  try {
    // fulfillment is retried: once this order is on the list, never re-add it
    // (the buyer may have unsubscribed meanwhile)
    const { data: had, error: readErr } = await db().from('marketing_contacts').select('order_id').eq('email', order.email.toLowerCase()).maybeSingle();
    if (readErr) throw readErr;
    if (had?.order_id === order.id) return;
    const { error } = await db().from('marketing_contacts').upsert(
      { email: order.email.toLowerCase(), full_name: order.full_name, consented_at: order.marketing_consent_at, order_id: order.id, withdrawn_at: null },
      { onConflict: 'email' }
    );
    if (error) console.error(`marketing contact not saved for ${order.id}:`, error.message);
  } catch (e) {
    console.error(`marketing contact not saved for ${order.id}:`, e.message);
  }
}

export async function fulfillPaid(orderId, { invoice = true } = {}) {
  if (!(await claim(orderId))) return; // done already, or another call is on it

  try {
    let { order, tickets } = await loadOrder(orderId);
    const patch = {};
    await addMarketingContact(order);

    // ONE PURCHASE = ONE INVOICE (it goes to the tax authority, NAV). Rules:
    //  1. Only one call works on an order at a time (claim() above).
    //  2. Before issuing, the attempt is recorded – and if that record can't be
    //     saved, nothing is issued.
    //  3. After an earlier attempt, a new invoice is issued only if Számlázz.hu
    //     says exactly "no invoice with this order number" (parseLookup); any
    //     other answer → no invoice now, retry later, shown in the admin.
    //  4. An attempt that broke off (timeout) may still be finishing at
    //     Számlázz.hu, so it is not retried for INVOICE_SETTLE_MIN minutes –
    //     the 5-minute retry job picks it up after that.
    //  5. The number is saved right away, before the e-mail.
    if (invoice && !order.invoice_number) {
      try {
        let number = null;
        const attemptedAt = order.invoice_attempted_at ? new Date(order.invoice_attempted_at).getTime() : null;
        if (attemptedAt && Date.now() - attemptedAt < INVOICE_SETTLE_MIN * 60000) {
          console.log(`Invoice for ${orderId}: earlier attempt ${order.invoice_attempted_at} may still be finishing – later.`);
        } else {
          if (attemptedAt) number = await findInvoiceByOrder(order.id); // null only for a certain "not found"
          if (!number) {
            const { data: marked, error: markErr } = await db()
              .from('orders')
              .update({ invoice_attempted_at: new Date().toISOString() })
              .eq('id', orderId)
              .is('invoice_number', null)
              .select('id');
            if (markErr || marked?.length !== 1) throw new Error(`invoice attempt not recorded (${markErr?.message || 'no row'}) – nothing issued`);
            number = (await createInvoice(order, invoiceLines(order, tickets))).number;
          }
          const { error: saveErr } = await db().from('orders').update({ invoice_number: number, invoice_error: null }).eq('id', orderId);
          if (saveErr) console.error(`Invoice ${number} issued but not saved yet (the lookup will find it):`, saveErr.message);
          patch.invoice_number = number;
          patch.invoice_error = null;
        }
      } catch (e) {
        console.error('Invoice failed:', e.message);
        patch.invoice_error = e.message.slice(0, 500);
      }
    }

    // Tickets go out even if the invoice failed – the guest has paid.
    if (!order.email_sent_at) {
      try {
        await sendTicketEmail(order, tickets.filter((t) => t.status === 'valid'));
        patch.email_sent_at = new Date().toISOString();
        patch.email_error = null;
      } catch (e) {
        console.error('Ticket e-mail failed:', e.message);
        patch.email_error = e.message.slice(0, 500);
      }
    }

    const invoiceDone = order.invoice_number || patch.invoice_number;
    const emailDone = order.email_sent_at || patch.email_sent_at;
    if (invoiceDone && emailDone) patch.fulfilled_at = new Date().toISOString();
    await release(orderId, patch);
  } catch (e) {
    await release(orderId);
    throw e;
  }
}

/**
 * Ask Barion for the real state of a payment and act on it.
 * Returns { orderId, status } where status is the order status.
 */
// The payment must really be this order's: Barion's PaymentRequestId is our
// order id, and the amount and currency must match what we charged. (The
// payment is read with our own POSKey, so it belongs to our shop.) Returns a
// reason string, or null when everything matches.
export function paymentMismatch(order, state) {
  if (state.paymentRequestId !== order.id) return `PaymentRequestId ${state.paymentRequestId} ≠ ${order.id}`;
  if (!PAID.has(state.status)) return null; // amount only matters for a paid one
  if (state.currency !== 'HUF') return `Currency ${state.currency} ≠ HUF`;
  if (Number(state.total) !== Number(order.total_huf)) return `Total ${state.total} ≠ ${order.total_huf}`;
  return null;
}

export async function syncPayment(paymentId) {
  const { data: order } = await db()
    .from('orders')
    .select('id, status, total_huf')
    .eq('payment_provider', 'barion')
    .eq('payment_ref', paymentId)
    .maybeSingle();
  if (!order) return { orderId: null, status: 'unknown' };

  const state = await getPaymentState(paymentId);

  // One check for every path: callback, success page, 5-minute retry.
  const mismatch = paymentMismatch(order, state);
  if (mismatch) {
    console.error(`PAYMENT MISMATCH order ${order.id} payment ${paymentId}: ${mismatch}`);
    const { error } = await db().from('orders').update({ payment_error: mismatch }).eq('id', order.id);
    if (error) console.error('payment_error not saved (run 009_payment_check.sql):', error.message);
    return { orderId: order.id, status: 'payment_check' };
  }

  if (PAID.has(state.status)) {
    if (order.status !== 'paid') {
      const { error } = await db().rpc('mark_order_paid', { p_order: order.id, p_provider: 'barion', p_ref: paymentId });
      if (error) throw error;
      // mark_order_paid only flips pending/expired orders. Money taken for an
      // order that was cancelled/failed meanwhile → no tickets, flag it for the
      // admin (refund or re-issue by hand) instead of reporting 'paid'.
      const { data: now, error: reErr } = await db().from('orders').select('status').eq('id', order.id).single();
      if (reErr) throw reErr;
      if (now.status !== 'paid') {
        const msg = `fizetett, de a rendelés állapota: ${now.status}`;
        console.error(`PAID BUT NOT ACTIVE order ${order.id} payment ${paymentId}: ${msg}`);
        const { error: peErr } = await db().from('orders').update({ payment_error: msg }).eq('id', order.id);
        if (peErr) console.error('payment_error not saved:', peErr.message);
        return { orderId: order.id, status: 'payment_check' };
      }
    }
    await fulfillPaid(order.id);
    return { orderId: order.id, status: 'paid' };
  }

  if (FAILED[state.status] && order.status === 'pending') {
    const { error } = await db().rpc('mark_order_failed', { p_order: order.id, p_status: FAILED[state.status] });
    if (error) throw error;
    return { orderId: order.id, status: FAILED[state.status] };
  }

  return { orderId: order.id, status: order.status, barionStatus: state.status };
}
