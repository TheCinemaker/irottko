// Barion Smart Gateway – minimal client (native fetch, no dependency).
// Env:
//   BARION_POS_KEY, BARION_PAYEE            sandbox shop (api.test.barion.com) – the default
//   BARION_POS_KEY_LIVE, BARION_PAYEE_LIVE  the hotel's live shop (api.barion.com, real money)
//   BARION_LIVE = '1'                        → live shop. Switch on 12-05 (go-live test), then redeploy.
// No silent fallback: '1' without the live key / payee = error, never a sandbox
// payment, and never the live key against the sandbox. (BARION_ENV is no longer read.)
//
// Endpoints/field names follow Barion API v2 (Payment/Start, GetPaymentState),
// as used by the node-barion library. POSKey is sent both in the body/query
// and in the x-pos-key header, which Barion's newer docs use.

const BASE = {
  test: 'https://api.test.barion.com',
  prod: 'https://api.barion.com',
};

export const isProd = () => process.env.BARION_LIVE === '1';
const baseUrl = () => (isProd() ? BASE.prod : BASE.test);
const envName = (base) => (isProd() ? `${base}_LIVE` : base);

function required(base) {
  const name = envName(base);
  const v = process.env[name];
  if (!v) throw new Error(`MISSING_${name}`);
  return v;
}
const posKey = () => required('BARION_POS_KEY');
const payeeOf = () => required('BARION_PAYEE');

async function call(method, path, { body, query } = {}) {
  const url = new URL(baseUrl() + path);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-pos-key': posKey() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  const errors = json?.Errors || [];
  if (!res.ok || errors.length) {
    const msg = errors.map((e) => `${e.ErrorCode}: ${e.Description || e.Title}`).join('; ') || `HTTP ${res.status}`;
    const err = new Error(`Barion ${path} failed – ${msg}`);
    err.barion = json;
    throw err;
  }
  return json;
}

// "hh:mm:ss" TimeSpan for PaymentWindow.
const timeSpan = (minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}:00`;
};

/**
 * Start a payment for one order.
 * items: [{ name, description, quantity, unitPrice, sku }] – HUF, gross.
 * Returns { paymentId, gatewayUrl, status }.
 */
export async function startPayment({ orderId, email, items, redirectUrl, callbackUrl, windowMinutes }) {
  const payee = payeeOf();

  const barionItems = items.map((i) => ({
    Name: i.name.slice(0, 250),
    Description: (i.description || i.name).slice(0, 500),
    Quantity: i.quantity,
    Unit: 'db',
    UnitPrice: i.unitPrice,
    ItemTotal: i.unitPrice * i.quantity,
    SKU: i.sku?.slice(0, 100),
  }));
  const total = barionItems.reduce((s, i) => s + i.ItemTotal, 0);

  const json = await call('POST', '/v2/Payment/Start', {
    body: {
      POSKey: posKey(),
      PaymentType: 'Immediate',
      GuestCheckOut: true,
      FundingSources: ['All'],
      PaymentRequestId: orderId,
      OrderNumber: orderId.slice(0, 100),
      PayerHint: email.slice(0, 256),
      Locale: 'hu-HU',
      Currency: 'HUF',
      PaymentWindow: windowMinutes ? timeSpan(windowMinutes) : undefined,
      RedirectUrl: redirectUrl,
      CallbackUrl: callbackUrl,
      Transactions: [
        {
          POSTransactionId: `${orderId}-1`,
          Payee: payee,
          Total: total,
          Items: barionItems,
        },
      ],
    },
  });

  return { paymentId: json.PaymentId, gatewayUrl: json.GatewayUrl, status: json.Status, total };
}

/**
 * Current state of a payment. The callback carries only the PaymentId –
 * the real status always comes from here.
 * Returns { status, paymentRequestId, total, currency, raw }.
 * status: Prepared | Started | InProgress | Waiting | Reserved | Authorized |
 *         Canceled | Succeeded | Failed | PartiallySucceeded | Expired
 */
export async function getPaymentState(paymentId) {
  const json = await call('GET', '/v2/Payment/GetPaymentState', {
    query: { POSKey: posKey(), PaymentId: paymentId },
  });
  return { status: json.Status, paymentRequestId: json.PaymentRequestId, total: json.Total, currency: json.Currency, raw: json };
}

export const PAID = new Set(['Succeeded']);
export const FAILED = { Canceled: 'cancelled', Failed: 'cancelled', Expired: 'expired' };
