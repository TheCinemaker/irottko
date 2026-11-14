// Stand-in for lib/barion.js: the "Barion answer" comes from globalThis.__barion.
export const PAID = new Set(['Succeeded']);
export const FAILED = { Canceled: 'cancelled', Failed: 'cancelled', Expired: 'expired' };
export const isProd = () => false;
export async function getPaymentState(paymentId) {
  const s = globalThis.__barion(paymentId);
  await new Promise((r) => setTimeout(r, 30));
  return { ...s, raw: s };
}
