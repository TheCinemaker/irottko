// Re-send the ticket e-mail of a paid order to the address on that order.
//   node --env-file=.env scripts/resend-ticket-email.mjs <orderId>
// Use when a guest says the e-mail did not arrive. Does not touch payment or invoice.
import { loadOrder } from '../netlify/functions/lib/fulfill.js';
import { sendTicketEmail } from '../netlify/functions/lib/ticketEmail.js';
import { db } from '../netlify/functions/lib/db.js';

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node --env-file=.env scripts/resend-ticket-email.mjs <orderId>');
  process.exit(1);
}
const { order, tickets } = await loadOrder(orderId);
if (order.status !== 'paid') {
  console.error(`Order is ${order.status}, not paid – nothing sent.`);
  process.exit(1);
}
await sendTicketEmail(order, tickets.filter((t) => t.status === 'valid' || t.status === 'used'));
await db().from('orders').update({ email_sent_at: new Date().toISOString(), email_error: null }).eq('id', orderId);
console.log(`Sent ${tickets.length} ticket(s) for order ${orderId}.`);
