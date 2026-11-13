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

async function fulfillPaid(orderId) {
  if (!(await claim(orderId))) return; // done already, or another call is on it

  try {
    let { order, tickets } = await loadOrder(orderId);
    const patch = {};

    if (!order.invoice_number) {
      try {
        // A previous attempt may have created the invoice but lost the answer.
        let number = order.invoice_attempted_at ? await findInvoiceByOrder(order.id) : null;
        if (!number) {
          await db().from('orders').update({ invoice_attempted_at: new Date().toISOString() }).eq('id', orderId);
          number = (await createInvoice(order, lines(tickets))).number;
        }
        patch.invoice_number = number;
        patch.invoice_error = null;
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
export async function syncPayment(paymentId) {
  const { data: order } = await db()
    .from('orders')
    .select('id, status')
    .eq('payment_provider', 'barion')
    .eq('payment_ref', paymentId)
    .maybeSingle();
  if (!order) return { orderId: null, status: 'unknown' };

  const state = await getPaymentState(paymentId);

  if (PAID.has(state.status)) {
    if (order.status !== 'paid') {
      const { error } = await db().rpc('mark_order_paid', { p_order: order.id, p_provider: 'barion', p_ref: paymentId });
      if (error) throw error;
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
