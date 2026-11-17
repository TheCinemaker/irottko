// Hungarian tax number (adószám) for company invoices – shared by the checkout
// form and netlify/functions/barion-start.js, so both accept exactly the same.
//   12345678-1-23  (törzsszám 8 digits – áfakód 1..5 – területi kód 2 digits)
// Accepts it with or without dashes/spaces; returns the canonical dashed form
// that goes on the invoice (Számlázz.hu → NAV Online Számla), or null if invalid.
// The 8th digit of the törzsszám is a check digit (weights 9-7-3-1-9-7-3),
// so most typos are caught at checkout instead of on a NAV-reported invoice.
export function normalizeTaxNumber(input) {
  const m = String(input ?? '').replace(/[\s.]/g, '').match(/^(\d{8})-?([1-5])-?(\d{2})$/);
  if (!m) return null;
  const d = [...m[1]].map(Number);
  const sum = [9, 7, 3, 1, 9, 7, 3].reduce((s, w, i) => s + w * d[i], 0);
  if ((10 - (sum % 10)) % 10 !== d[7]) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
