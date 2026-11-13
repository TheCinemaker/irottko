// POST /.netlify/functions/barion-start
// Reserves tickets (price comes from the DB, never from the browser),
// starts a Barion payment and returns the gateway URL to redirect to.
import { db, appUrl, json } from './lib/db.js';
import { startPayment } from './lib/barion.js';
import { loadOrder, lines } from './lib/fulfill.js';

const SLUG = () => process.env.EVENT_SLUG || process.env.VITE_EVENT_SLUG || 'one-night-irottko';

const KNOWN = {
  SALES_CLOSED: [409, 'A jegyértékesítés jelenleg nem elérhető.'],
  SOLD_OUT: [409, 'Ebből a jegytípusból nincs már elég szabad hely.'],
  INVALID_QTY: [400, 'Érvénytelen jegyszám.'],
  EVENT_NOT_FOUND: [500, 'Az esemény nincs beállítva.'],
};

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Hibás kérés.' });
  }

  const b = {
    kind: input.kind === 'vip' ? 'vip' : 'standard',
    qty: parseInt(input.qty, 10),
    fullName: clean(input.fullName),
    email: clean(input.email, 254).toLowerCase(),
    phone: clean(input.phone, 40) || null,
    zip: clean(input.zip, 10),
    city: clean(input.city, 100),
    address: clean(input.address),
    companyName: input.isCompany ? clean(input.companyName) : null,
    taxNumber: input.isCompany ? clean(input.taxNumber, 20) : null,
  };

  if (!b.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || !b.zip || !b.city || !b.address) {
    return json(400, { error: 'Kérjük, tölts ki minden kötelező mezőt.' });
  }
  if (input.isCompany && (!b.companyName || !/^\d{8}-?\d-?\d{2}$/.test(b.taxNumber))) {
    return json(400, { error: 'Céges vásárlásnál a cégnév és egy érvényes adószám (12345678-1-23) kötelező.' });
  }
  if (!Number.isInteger(b.qty) || b.qty < 1) return json(400, { error: KNOWN.INVALID_QTY[1] });

  let orderId;
  try {
    // 1) Reservation with row locks – no overselling.
    const { data: res, error } = await db().rpc('reserve_tickets', {
      p_slug: SLUG(),
      p_qty: b.qty,
      p_email: b.email,
      p_name: b.fullName,
      p_phone: b.phone,
      p_kind: b.kind,
    });
    if (error) {
      const code = Object.keys(KNOWN).find((k) => error.message?.includes(k));
      if (code) return json(KNOWN[code][0], { error: KNOWN[code][1] });
      throw error;
    }
    orderId = res.order_id;

    const { error: upErr } = await db()
      .from('orders')
      .update({ zip: b.zip, city: b.city, address: b.address, company_name: b.companyName, tax_number: b.taxNumber })
      .eq('id', orderId);
    if (upErr) throw upErr;

    const { data: evt } = await db().from('events').select('hold_minutes').eq('slug', SLUG()).single();
    const { tickets } = await loadOrder(orderId);

    // 2) Barion payment.
    const pay = await startPayment({
      orderId,
      email: b.email,
      items: lines(tickets).map((l) => ({
        name: l.name,
        description: `${l.tier} – ${l.quantity} db`,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        sku: l.tier,
      })),
      redirectUrl: `${appUrl()}/success`,
      callbackUrl: `${appUrl()}/.netlify/functions/barion-callback`,
      windowMinutes: evt?.hold_minutes || 15,
    });

    if (pay.total !== res.total_huf) throw new Error(`Total mismatch ${pay.total} vs ${res.total_huf}`);

    const { error: refErr } = await db()
      .from('orders')
      .update({ payment_provider: 'barion', payment_ref: pay.paymentId })
      .eq('id', orderId);
    if (refErr) throw refErr;

    return json(200, { gatewayUrl: pay.gatewayUrl, orderId, total: res.total_huf });
  } catch (e) {
    console.error('barion-start failed:', e.message, e.barion || '');
    if (orderId) await db().rpc('mark_order_failed', { p_order: orderId, p_status: 'cancelled' });
    return json(502, { error: 'A fizetés indítása nem sikerült. Kérjük, próbáld újra pár perc múlva.' });
  }
};
