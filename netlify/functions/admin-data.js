// POST /.netlify/functions/admin-data   { pin | token }  (login: lib/pinGuard.js)
// Everything the admin page shows, computed server-side with the service role.
// Env: ADMIN_PIN (separate from SCANNER_PIN – door staff must not see revenue
// or guests' e-mails).
import { db, json } from './lib/db.js';
import { authenticate } from './lib/pinGuard.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const TZ = 'Europe/Budapest';


// Supabase returns max 1000 rows per request → page through.
async function all(table, select, filter = (q) => q, order = 'created_at') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db().from(table).select(select))
      .order(order, { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
const slotKey = (iso, minutes = 15) => {
  const d = new Date(iso);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / minutes) * minutes, 0, 0);
  return d.toISOString();
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'BAD_JSON' });
  }
  const auth = await authenticate(event, 'admin', body, process.env.ADMIN_PIN);
  if (auth.denied) return auth.denied;

  try {
    const { data: ev, error: evErr } = await db().from('events').select('*').eq('slug', SLUG).single();
    if (evErr) throw evErr;

    const byEvent = (q) => q.eq('event_id', ev.id);
    const [tiers, orders, tickets] = await Promise.all([
      all('ticket_tiers', 'id, name, kind, channel, price_huf, quantity, sort_order, sales_from, sales_until', byEvent, 'sort_order'),
      all(
        'orders',
        'id, full_name, email, phone, total_huf, status, created_at, paid_at, expires_at, company_name, tax_number, invoice_number, invoice_error, email_sent_at, email_error',
        byEvent
      ),
      all('tickets', 'id, order_id, tier_id, price_huf, status, code, checked_in_at', byEvent),
    ]);
    // Payments that did not match their order (009_payment_check.sql) – a
    // separate query, so the page still works before the column exists.
    const { data: payErr } = await db()
      .from('orders')
      .select('id, full_name, email, status, total_huf, created_at, payment_ref, payment_error')
      .eq('event_id', ev.id)
      .not('payment_error', 'is', null);
    const ticketIds = new Set(tickets.map((t) => t.id));
    const scans = (await all('check_ins', '*', (q) => q, 'scanned_at')).filter(
      (s) => !s.ticket_id || ticketIds.has(s.ticket_id)
    );

    const now = Date.now();
    const tierById = Object.fromEntries(tiers.map((t) => [t.id, t]));
    const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));
    const paidIds = new Set(orders.filter((o) => o.status === 'paid').map((o) => o.id));
    const holdIds = new Set(
      orders.filter((o) => o.status === 'pending' && new Date(o.expires_at).getTime() > now).map((o) => o.id)
    );

    const sold = tickets.filter((t) => paidIds.has(t.order_id) && ['valid', 'used'].includes(t.status));
    const used = sold.filter((t) => t.status === 'used');
    const held = tickets.filter((t) => holdIds.has(t.order_id));

    // ---- Sales per tier
    const tierRows = tiers.map((t) => {
      const s = sold.filter((k) => k.tier_id === t.id);
      return {
        id: t.id,
        name: t.name,
        kind: t.kind,
        channel: t.channel,
        price: t.price_huf,
        quantity: t.quantity,
        from: t.sales_from,
        until: t.sales_until,
        active: now >= (t.sales_from ? Date.parse(t.sales_from) : -Infinity) && now < (t.sales_until ? Date.parse(t.sales_until) : Infinity),
        sold: s.length,
        revenue: s.reduce((a, k) => a + k.price_huf, 0),
        checkedIn: s.filter((k) => k.status === 'used').length,
      };
    });

    const kindOf = (t) => tierById[t.tier_id]?.kind;
    const chanOf = (t) => tierById[t.tier_id]?.channel;
    const onlineStd = (t) => kindOf(t) === 'standard' && chanOf(t) === 'online';
    const vipTier = tiers.find((t) => t.kind === 'vip');

    // ---- Daily sales (paid)
    const daily = {};
    for (const t of sold) {
      const o = orderById[t.order_id];
      const k = dayKey(o.paid_at || o.created_at);
      daily[k] ||= { day: k, tickets: 0, revenue: 0 };
      daily[k].tickets += 1;
      daily[k].revenue += t.price_huf;
    }

    // ---- Orders
    const ticketsByOrder = {};
    for (const t of tickets) (ticketsByOrder[t.order_id] ||= []).push(t);
    const orderRows = orders
      .filter((o) => o.status === 'paid')
      .map((o) => {
        const ts = (ticketsByOrder[o.id] || []).filter((t) => ['valid', 'used'].includes(t.status));
        const names = {};
        for (const t of ts) {
          const n = tierById[t.tier_id]?.name || '?';
          names[n] = (names[n] || 0) + 1;
        }
        return {
          id: o.id,
          name: o.full_name,
          email: o.email,
          phone: o.phone,
          company: o.company_name,
          paidAt: o.paid_at,
          total: o.total_huf,
          qty: ts.length,
          tiers: Object.entries(names).map(([n, c]) => (c > 1 ? `${c}× ${n}` : n)).join(', '),
          vip: ts.some((t) => kindOf(t) === 'vip'),
          checkedIn: ts.filter((t) => t.status === 'used').length,
          invoice: o.invoice_number,
          invoiceError: o.invoice_error,
          emailSent: o.email_sent_at,
          emailError: o.email_error,
        };
      })
      .reverse();

    const orderStatus = {};
    for (const o of orders) {
      const s = o.status === 'pending' && !holdIds.has(o.id) ? 'expired' : o.status;
      orderStatus[s] = (orderStatus[s] || 0) + 1;
    }

    // ---- Scans
    const resultCount = { ok: 0, already_used: 0, not_found: 0, not_paid: 0 };
    for (const s of scans) resultCount[s.result] = (resultCount[s.result] || 0) + 1;
    const ticketById = Object.fromEntries(tickets.map((t) => [t.id, t]));
    const scanRows = scans
      .slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        at: s.scanned_at,
        result: s.result,
        code: s.code,
        name: s.holder_name,
        email: s.email,
        tier: s.tier_name,
        kind: s.tier_kind,
        staff: s.staff,
        orderId: s.order_id,
        // for a duplicate: when the ticket really came in
        firstIn: s.result === 'already_used' ? ticketById[s.ticket_id]?.checked_in_at : null,
      }));

    // Tickets someone tried to use more than once
    const dupByTicket = {};
    for (const s of scans.filter((x) => x.result === 'already_used')) {
      const d = (dupByTicket[s.ticket_id] ||= {
        name: s.holder_name,
        email: s.email,
        tier: s.tier_name,
        code: s.code,
        firstIn: ticketById[s.ticket_id]?.checked_in_at,
        attempts: 0,
        last: null,
      });
      d.attempts += 1;
      d.last = s.scanned_at;
    }

    const entries = {};
    for (const s of scans.filter((x) => x.result === 'ok')) {
      const k = slotKey(s.scanned_at);
      entries[k] = (entries[k] || 0) + 1;
    }

    const problems = orderRows.filter((o) => !o.invoice || !o.emailSent);
    // Apple Wallet phones that receive the passengers' message (016; 0 before it)
    const { count: walletDevices } = await db().from('wallet_registrations').select('id', { count: 'exact', head: true });

    return json(200, {
      token: auth.token,
      generatedAt: new Date().toISOString(),
      event: {
        title: ev.title,
        salesOpen: ev.sales_open,
        announcement: ev.announcement ?? null, // undefined before 015
        announcementReady: 'announcement' in ev,
        walletReady: 'wallet_message' in ev,
        walletMessage: ev.wallet_message ?? null,
        walletMessageAt: ev.wallet_message_at ?? null,
        onlineCapacity: ev.online_capacity,
        capacity: ev.capacity,
        // fire-safety limit (013_venue_limit.sql); undefined before the migration
        venueLimit: ev.venue_limit ?? null,
        nonTicketCount: ev.non_ticket_count ?? null,
        limitOn: ev.venue_limit_on ?? false,
        ticketCap: ev.venue_limit != null ? ev.venue_limit - (ev.non_ticket_count ?? 0) : null,
      },
      totals: {
        ticketsSold: sold.length,
        revenue: sold.reduce((a, t) => a + t.price_huf, 0),
        orders: orderRows.length,
        avgOrder: orderRows.length ? Math.round(orderRows.reduce((a, o) => a + o.total, 0) / orderRows.length) : 0,
        standardSold: sold.filter((t) => kindOf(t) === 'standard').length,
        vipSold: sold.filter((t) => kindOf(t) === 'vip').length,
        doorSold: sold.filter((t) => chanOf(t) === 'door').length,
        onlineLeft:
          ev.online_capacity == null
            ? null
            : Math.max(ev.online_capacity - sold.filter(onlineStd).length - held.filter(onlineStd).length, 0),
        vipCapacity: vipTier?.quantity ?? null,
        vipLeft:
          vipTier?.quantity == null
            ? null
            : Math.max(vipTier.quantity - sold.filter((t) => kindOf(t) === 'vip').length - held.filter((t) => kindOf(t) === 'vip').length, 0),
        heldNow: held.length,
        // all live tickets (paid + held for payment) against the fire-safety cap
        ticketsLive: sold.length + held.length,
        checkedIn: used.length,
        vipCheckedIn: used.filter((t) => kindOf(t) === 'vip').length,
        scans: scans.length,
      },
      tiers: tierRows,
      daily: Object.values(daily).sort((a, b) => a.day.localeCompare(b.day)),
      orderStatus,
      orders: orderRows,
      problems,
      walletDevices: walletDevices ?? 0,
      paymentIssues: (payErr || []).map((o) => ({
        id: o.id,
        name: o.full_name,
        email: o.email,
        status: o.status,
        total: o.total_huf,
        at: o.created_at,
        paymentId: o.payment_ref,
        error: o.payment_error,
      })),
      scanResults: resultCount,
      scans: scanRows,
      duplicates: Object.values(dupByTicket).sort((a, b) => b.attempts - a.attempts),
      entries: Object.entries(entries)
        .map(([slot, count]) => ({ slot, count }))
        .sort((a, b) => a.slot.localeCompare(b.slot)),
    });
  } catch (e) {
    console.error('admin-data failed:', e.message);
    return json(500, { error: 'DB' });
  }
};
