// Számlázz.hu Számla Agent – invoice for a paid ticket order.
// One multipart POST to https://www.szamlazz.hu/szamla/ with an XML file.
// Element order follows the Agent XSD (xmlszamla / xmlszamlaxml); it matters.
//
// Env:
//   SZAMLAZZ_AGENT_KEY       Számla Agent kulcs (Fiók → Számla Agent kulcsok)
//   SZAMLAZZ_VAT             '27' (default; admission tickets – same as jegy.hu invoices) | 'AAM' | 'TAM' …
//   SZAMLAZZ_EINVOICE        'true' (default) – e-számla; the account must have it enabled
//   SZAMLAZZ_PAYMENT_METHOD  default 'Bankkártya (Barion)' (printed on the invoice)
//   SZAMLAZZ_PREFIX          optional invoice number prefix (számlaszám előtag)
//   SZAMLAZZ_EMAIL_REPLYTO / SZAMLAZZ_EMAIL_SUBJECT / SZAMLAZZ_EMAIL_TEXT – optional

const ENDPOINT = 'https://www.szamlazz.hu/szamla/';
const SPECIAL_VATS = ['TAM', 'AAM', 'EU', 'EUFAD37', 'EUFADE', 'EUK', 'MAA', 'ÁKK', 'TEHK', 'HO', 'KBAET'];

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

// [name, value] pairs → elements, in the given order; undefined/null/'' are skipped.
const el = (pairs) =>
  pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<${k}>${esc(v)}</${k}>`)
    .join('');

const header = (tag, dir) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${tag} xmlns="http://www.szamlazz.hu/${tag}" ` +
  `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
  `xsi:schemaLocation="http://www.szamlazz.hu/${tag} https://www.szamlazz.hu/szamla/docs/xsds/${dir}/${tag}.xsd">`;

function agentKey() {
  const k = process.env.SZAMLAZZ_AGENT_KEY;
  if (!k) throw new Error('MISSING_SZAMLAZZ_AGENT_KEY');
  return k;
}

// Budapest-time date (YYYY-MM-DD), so a purchase at 00:30 is not dated the day before.
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());

/** Gross unit price → the net / VAT / gross values the XSD wants. HUF: whole forints. */
export function itemValues(grossUnit, quantity, vat) {
  const gross = Math.round(grossUnit * quantity);
  if (SPECIAL_VATS.includes(vat)) return { net: gross, vatValue: 0, gross, netUnit: grossUnit };
  const rate = Number(vat);
  if (!Number.isFinite(rate)) throw new Error(`Bad SZAMLAZZ_VAT: ${vat}`);
  const vatValue = Math.round((gross / (100 + rate)) * rate);
  const net = gross - vatValue;
  return { net, vatValue, gross, netUnit: Math.round((net / quantity) * 100) / 100 };
}

export function buildInvoiceXml(order, lines) {
  const vat = process.env.SZAMLAZZ_VAT || '27';
  const isCompany = Boolean(order.tax_number);
  const date = today();

  const seller = el([
    ['emailReplyto', process.env.SZAMLAZZ_EMAIL_REPLYTO],
    ['emailTargy', process.env.SZAMLAZZ_EMAIL_SUBJECT],
    ['emailSzoveg', process.env.SZAMLAZZ_EMAIL_TEXT],
  ]);

  const items = lines
    .map((l) => {
      const v = itemValues(l.unitPrice, l.quantity, vat);
      return `<tetel>${el([
        ['megnevezes', l.name],
        ['mennyiseg', l.quantity],
        ['mennyisegiEgyseg', 'db'],
        ['nettoEgysegar', v.netUnit],
        ['afakulcs', vat],
        ['nettoErtek', v.net],
        ['afaErtek', v.vatValue],
        ['bruttoErtek', v.gross],
        ['megjegyzes', l.note], // line note under the item (event, holder, code)
      ])}</tetel>`;
    })
    .join('');

  return (
    header('xmlszamla', 'agent') +
    `<beallitasok>${el([
      ['szamlaagentkulcs', agentKey()],
      ['eszamla', process.env.SZAMLAZZ_EINVOICE === 'false' ? 'false' : 'true'],
      ['szamlaLetoltes', 'false'],
      ['valaszVerzio', 1],
    ])}</beallitasok>` +
    `<fejlec>${el([
      ['keltDatum', date],
      ['teljesitesDatum', date],
      ['fizetesiHataridoDatum', date],
      ['fizmod', process.env.SZAMLAZZ_PAYMENT_METHOD || 'Bankkártya (Barion)'],
      ['penznem', 'HUF'],
      ['szamlaNyelve', 'hu'],
      ['rendelesSzam', order.id], // printed on the invoice as "Rendelésszám"
      ['szamlaszamElotag', process.env.SZAMLAZZ_PREFIX],
      ['fizetve', 'true'],
    ])}</fejlec>` +
    `<elado>${seller}</elado>` + // seller data comes from the account; children all optional

    `<vevo>${el([
      ['nev', isCompany ? order.company_name || order.full_name : order.full_name],
      ['irsz', order.zip],
      ['telepules', order.city],
      ['cim', order.address],
      ['email', order.email],
      ['sendEmail', 'true'], // Számlázz.hu e-mails the invoice to the buyer
      ['adoalany', isCompany ? 1 : -1], // 1: Hungarian tax number, -1: private person
      ['adoszam', isCompany ? order.tax_number : undefined],
      ['telefonszam', order.phone],
    ])}</vevo>` +
    `<tetelek>${items}</tetelek>` +
    `</xmlszamla>`
  );
}

async function post(fieldName, xml) {
  const form = new FormData();
  form.append(fieldName, new Blob([xml], { type: 'text/xml' }), 'request.xml');
  const res = await fetch(ENDPOINT, { method: 'POST', body: form });
  const errCode = res.headers.get('szlahu_error_code');
  if (errCode) {
    const msg = decodeURIComponent((res.headers.get('szlahu_error') || '').replace(/\+/g, ' '));
    const err = new Error(`Számlázz.hu ${errCode}: ${msg}`);
    err.code = errCode;
    throw err;
  }
  if (!res.ok) throw new Error(`Számlázz.hu HTTP ${res.status}`);
  return res;
}

/** Issues the invoice. Returns { number }. */
export async function createInvoice(order, lines) {
  const res = await post('action-xmlagentxmlfile', buildInvoiceXml(order, lines));
  const number = res.headers.get('szlahu_szamlaszam');
  if (!number) throw new Error('Számlázz.hu: no invoice number in response');
  return { number };
}

/**
 * Looks up an invoice by our order id (rendelesSzam). Used before retrying,
 * so a lost response never leads to a second invoice. Returns number or null.
 */
export async function findInvoiceByOrder(orderId) {
  const xml =
    header('xmlszamlaxml', 'agentxml') +
    el([['szamlaagentkulcs', agentKey()], ['rendelesSzam', orderId], ['pdf', 'false']]) +
    `</xmlszamlaxml>`;
  // post() throws on any szlahu_error_code header / HTTP error → caller retries later.
  const res = await post('action-szamla_agent_xml', xml);
  const body = await res.text();
  return parseLookup(body);
}

/**
 * The lookup answer, read strictly. ONE PURCHASE = ONE INVOICE: "no invoice yet"
 * is accepted only when Számlázz.hu says exactly that, because "not found" is
 * what lets the caller issue a (new) invoice.
 *   found:      a <szamla> document with its <szamlaszam>            → number
 *   not found:  <xmlszamlavalasz> sikeres=false, hibakod 7 "ismeretlen …
 *               rendelésszám …" (checked on the test account 2026-11-17) → null
 *   ANYTHING else – wrong key (hibakod 3 "Sikertelen bejelentkezés", also
 *   HTTP 200!), maintenance, an unknown answer → throws: no new invoice, try later.
 */
export function parseLookup(body) {
  const text = (tag) => body.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1]?.trim();
  if (/<szamla[\s>]/.test(body)) {
    const number = text('szamlaszam');
    if (!number) throw new Error('Számlázz.hu lookup: invoice without number – not issuing another');
    return number;
  }
  if (/<xmlszamlavalasz[\s>]/.test(body) && text('sikeres') === 'false') {
    const code = text('hibakod');
    const msg = text('hibauzenet') || '';
    if (code === '7' && /ismeretlen/i.test(msg) && /rendelésszám/i.test(msg)) return null;
    const err = new Error(`Számlázz.hu lookup ${code}: ${msg}`);
    err.code = code;
    throw err;
  }
  throw new Error(`Számlázz.hu lookup: unexpected answer – not issuing another (${body.slice(0, 120)})`);
}
