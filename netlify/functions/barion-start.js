// POST /.netlify/functions/barion-start
// Reserves tickets (price comes from the DB, never from the browser),
// starts a Barion payment and returns the gateway URL to redirect to.
import { db, appUrl, json } from './lib/db.js';
import { startPayment } from './lib/barion.js';
import { loadOrder, lines } from './lib/fulfill.js';
import { verifyTurnstile } from './lib/turnstile.js';
import { orderLink, orderLinksReady } from './lib/orderAccess.js';

const SLUG = () => process.env.EVENT_SLUG || process.env.VITE_EVENT_SLUG || 'one-night-irottko';

const KNOWN = {
  SALES_CLOSED: [409, 'A jegyértékesítés jelenleg nem elérhető.'],
  SOLD_OUT: [409, 'Ebből a jegytípusból nincs már elég szabad hely.'],
  // venue limit (013_venue_limit.sql): every ticket type together
  FULL_HOUSE: [409, 'A járat megtelt – ennyi szabad hely már nincs. Ha kevesebb jegyet választasz, lehet, hogy még belefér.'],
  INVALID_QTY: [400, 'Érvénytelen jegyszám.'],
  EVENT_NOT_FOUND: [500, 'Az esemény nincs beállítva.'],
};

// Abuse limits: a reservation holds tickets without payment, so a script could
// keep everything "sold out". Limits on unpaid, still-held orders:
const MAX_PENDING_PER_EMAIL = 2;
const UNAVAILABLE = 'A jegyfoglalás átmenetileg nem elérhető. Kérjük, próbáld újra pár másodperc múlva.';
const MAX_PENDING_PER_IP = 4; // not applied during door sales (shared hotel Wi-Fi)

const clientIp = (event) =>
  event.headers?.['x-nf-client-connection-ip'] || (event.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || null;

/** Returns an error message if this buyer already holds too many unpaid reservations. */
async function tooManyPending(email, ip) {
  const now = new Date().toISOString();
  const pending = () => db().from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending').gt('expires_at', now);

  const { count: byEmail, error: emailErr } = await pending().eq('email', email);
  if (emailErr || byEmail == null) throw new Error(`email limit: ${emailErr?.message || 'no count'}`);
  if (byEmail >= MAX_PENDING_PER_EMAIL) {
    return 'Ezzel az e-mail címmel már folyamatban van egy fizetés. Fejezd be, vagy próbáld újra pár perc múlva.';
  }

  if (ip) {
    const { data: door, error: doorErr } = await db().from('tier_status').select('id').eq('channel', 'door').eq('active', true).limit(1);
    if (doorErr) throw new Error(`door check: ${doorErr.message}`);
    if (!door.length) {
      const { count: byIp, error } = await pending().eq('client_ip', ip);
      if (error || byIp == null) throw new Error(`IP limit: ${error?.message || 'no count'}`);
      if (byIp >= MAX_PENDING_PER_IP) return 'Erről a hálózatról túl sok fizetés van folyamatban. Próbáld újra pár perc múlva.';
    }
  }
  return null;
}

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
  // Named tickets (like a boarding pass): one attendee name per ticket.
  const names = Array.isArray(input.attendeeNames) ? input.attendeeNames.map((n) => clean(n, 80)) : [];
  if (names.length !== b.qty || names.some((n) => n.length < 2)) {
    return json(400, { error: 'Kérjük, add meg minden jegyhez a résztvevő nevét.' });
  }
  if (input.acceptTerms !== true) {
    return json(400, { error: 'A vásárláshoz el kell fogadnod az ÁSZF-et és az adatkezelési tájékoztatót.' });
  }

  const ip = clientIp(event);

  // Without the link secret the buyer could not open their tickets → don't sell.
  if (!orderLinksReady()) {
    console.error('ORDER_LINK_SECRET missing – checkout disabled');
    return json(503, { error: UNAVAILABLE });
  }

  const human = await verifyTurnstile(input.turnstileToken, ip);
  if (!human.ok && human.reason === 'unavailable') {
    return json(503, { error: 'A robotellenőrzés átmenetileg nem elérhető. Kérjük, próbáld újra pár másodperc múlva.', retryTurnstile: true });
  }
  if (!human.ok) {
    console.warn('turnstile rejected:', human.reason);
    return json(403, { error: 'A robotellenőrzés nem sikerült. Frissítsd az oldalt, és próbáld újra.', retryTurnstile: true });
  }

  // Fail closed: if the limits can't be checked, no new reservation.
  try {
    const limited = await tooManyPending(b.email, ip);
    if (limited) return json(429, { error: limited });
  } catch (e) {
    console.error('pending check failed – refusing:', e.message);
    return json(503, { error: UNAVAILABLE });
  }

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

    // One name per ticket (the reservation wrote the buyer's name on all of them).
    const { data: held, error: heldErr } = await db().from('tickets').select('id').eq('order_id', orderId).order('id');
    if (heldErr) throw heldErr;
    for (const [i, t] of held.entries()) {
      const { error: nErr } = await db().from('tickets').update({ holder_name: names[i] }).eq('id', t.id);
      if (nErr) throw nErr;
    }

    // Proof of accepting the terms (005_terms.sql). Never blocks the purchase.
    const { error: termsErr } = await db().from('orders').update({ terms_accepted_at: new Date().toISOString() }).eq('id', orderId);
    if (termsErr) console.error('terms_accepted_at not saved (run 005_terms.sql):', termsErr.message);
    if (ip) {
      const { error: ipErr } = await db().from('orders').update({ client_ip: ip }).eq('id', orderId);
      if (ipErr) console.error('client_ip not saved (run 006_client_ip.sql):', ipErr.message);
    }

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
      redirectUrl: orderLink(appUrl(), orderId), // Barion appends &paymentId=…; access is the token
      callbackUrl: `${appUrl()}/.netlify/functions/barion-callback`,
      // Barion closes 1 minute before our hold ends, so a payment can never
      // succeed after the tickets were released to someone else.
      windowMinutes: Math.max(1, (evt?.hold_minutes || 4) - 1),
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
