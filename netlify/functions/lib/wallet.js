// Apple Wallet (.pkpass) and Google Wallet ("Save to Google Wallet" link) for one ticket.
//
// Files (bundled via netlify.toml → included_files; certs/ is gitignored):
//   netlify/functions/certs/pass.p12            Apple Pass Type ID certificate (+ APPLE_PASS_P12_PASSWORD)
//   netlify/functions/certs/AppleWWDRCAG3.cer   Apple WWDR intermediate
//   netlify/functions/certs/google-wallet.json  { client_email, private_key, issuer_id }
//   netlify/functions/wallet-assets/*.png       icon / logo for the Apple pass
// Env (optional overrides): APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, GOOGLE_WALLET_CLASS_SUFFIX
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import forge from 'node-forge';
import { PKPass } from 'passkit-generator';
import { EVENT_DETAILS } from '../../../src/data/eventData.js';
import { appUrl } from './db.js';

const APPLE_PASS_TYPE_ID = () => process.env.APPLE_PASS_TYPE_ID || 'pass.hu.koszeg.koszegpass';
const APPLE_TEAM_ID = () => process.env.APPLE_TEAM_ID || '97FG847W58';
const GOOGLE_CLASS_SUFFIX = () => process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'one_night_irottko_2027';

const EVENT_START = new Date(EVENT_DETAILS.isoDate);
const EVENT_END = new Date(EVENT_START.getTime() + 12 * 3600 * 1000); // doors 19:00 → 07:00 next day

function file(rel) {
  const candidates = [path.resolve(process.cwd(), 'netlify/functions', rel), path.resolve(process.cwd(), rel)];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(hit);
}

/* ------------------------------ Apple ------------------------------ */

let appleCerts;
function appleCertificates() {
  if (appleCerts) return appleCerts;
  const password = process.env.APPLE_PASS_P12_PASSWORD;
  if (password === undefined) throw new Error('MISSING_APPLE_PASS_P12_PASSWORD');

  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(file('certs/pass.p12').toString('binary')), password);
  const cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;
  const key = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  if (!cert || !key) throw new Error('Could not read key/cert from pass.p12');

  const wwdr = forge.pki.certificateFromAsn1(forge.asn1.fromDer(file('certs/AppleWWDRCAG3.cer').toString('binary')));
  appleCerts = {
    wwdr: forge.pki.certificateToPem(wwdr),
    signerCert: forge.pki.certificateToPem(cert),
    signerKey: forge.pki.privateKeyToPem(key),
  };
  return appleCerts;
}

const dateHu = EVENT_DETAILS.dateString.replace(/\s*\(.*\)/, ''); // "2027. január 15."

/** ticket: { code, tier_name, holder_name, order_id } → Buffer (.pkpass) */
export async function applePass(ticket) {
  const assets = {};
  for (const f of ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png']) {
    assets[f] = file(`wallet-assets/${f}`);
  }

  const pass = new PKPass(assets, appleCertificates(), {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID(),
    teamIdentifier: APPLE_TEAM_ID(),
    serialNumber: `irottko-${ticket.code}`,
    organizationName: EVENT_DETAILS.title,
    description: `Belépőjegy – ${EVENT_DETAILS.title}`,
    logoText: EVENT_DETAILS.title,
    // VIP: gold card, dark text – recognisable at the door from a distance.
    ...(ticket.tier_kind === 'vip'
      ? { backgroundColor: 'rgb(212, 175, 55)', foregroundColor: 'rgb(5, 3, 10)', labelColor: 'rgb(70, 52, 8)' }
      : { backgroundColor: 'rgb(5, 3, 10)', foregroundColor: 'rgb(255, 255, 255)', labelColor: 'rgb(212, 175, 55)' }),
    sharingProhibited: true,
    groupingIdentifier: 'one-night-irottko',
  });

  pass.type = 'eventTicket';
  pass.setRelevantDate(EVENT_START);
  pass.setExpirationDate(EVENT_END);

  pass.headerFields.push({ key: 'tier', label: 'JEGY', value: ticket.tier_kind === 'vip' ? 'VIP LOUNGE' : ticket.tier_name });
  pass.primaryFields.push({ key: 'event', label: 'ESEMÉNY', value: 'One Night at Írottkő' });
  pass.secondaryFields.push(
    { key: 'date', label: 'DÁTUM', value: dateHu },
    { key: 'doors', label: 'KAPUNYITÁS', value: EVENT_DETAILS.doorsOpen }
  );
  pass.auxiliaryFields.push(
    { key: 'venue', label: 'HELYSZÍN', value: EVENT_DETAILS.venue },
    { key: 'holder', label: 'NÉV', value: ticket.holder_name || '' }
  );
  pass.backFields.push(
    { key: 'code', label: 'Jegykód', value: ticket.code },
    { key: 'address', label: 'Cím', value: EVENT_DETAILS.address },
    { key: 'order', label: 'Rendelésszám', value: ticket.order_id },
    { key: 'terms', label: 'Tudnivalók', value: 'A jegy nem átruházható, és egy fő egyszeri belépésére jogosít. A belépéskor mutasd fel a QR-kódot – az első beolvasás után a kód felhasznált, második belépésnél a rendszer már nem enged be. Korhatár: 18+.' }
  );

  pass.setBarcodes({ message: ticket.code, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1', altText: ticket.code });

  return pass.getAsBuffer();
}

/* ------------------------------ Google ----------------------------- */

// Google fetches logos / checks origins itself: only a public https URL works
// (not localhost or a LAN address like https://192.168.x.x during dev).
const isPublicHttps = (u) =>
  /^https:\/\//.test(u) && !/^https:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u);

let googleCreds;
const google = () => (googleCreds ||= JSON.parse(file('certs/google-wallet.json').toString('utf8')));

const lv = (value) => ({ defaultValue: { language: 'hu', value } });

function eventClass() {
  const { issuer_id } = google();
  const base = appUrl();
  const cls = {
    id: `${issuer_id}.${GOOGLE_CLASS_SUFFIX()}`,
    issuerName: EVENT_DETAILS.venue.split(',')[0], // "Hotel Írottkő"
    reviewStatus: 'UNDER_REVIEW',
    eventName: lv(EVENT_DETAILS.title),
    venue: { name: lv(EVENT_DETAILS.venue), address: lv(EVENT_DETAILS.address) },
    dateTime: { doorsOpen: EVENT_DETAILS.isoDate, start: EVENT_DETAILS.isoDate, end: EVENT_END.toISOString() },
    hexBackgroundColor: '#05030a',
  };
  // Google fetches the logo itself, so it needs a public https URL (not localhost).
  if (isPublicHttps(base)) cls.logo = { sourceUri: { uri: `${base}/wallet/google-logo.png` } };
  return cls;
}

/** ticket → https://pay.google.com/gp/v/save/<jwt> */
export function googleSaveUrl(ticket) {
  const { client_email, private_key, issuer_id } = google();
  const cls = eventClass();
  const obj = {
    id: `${issuer_id}.irottko_${ticket.code}`,
    classId: cls.id,
    state: 'ACTIVE',
    ticketHolderName: ticket.holder_name || undefined,
    ticketNumber: ticket.code,
    ticketType: lv(ticket.tier_name),
    barcode: { type: 'QR_CODE', value: ticket.code, alternateText: ticket.code },
    ...(ticket.tier_kind === 'vip' ? { hexBackgroundColor: '#d4af37' } : {}),
    validTimeInterval: { start: { date: new Date(EVENT_START.getTime() - 30 * 86400000).toISOString() }, end: { date: EVENT_END.toISOString() } },
  };

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const origin = appUrl();
  const claims = {
    iss: client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: isPublicHttps(origin) ? [origin] : [],
    payload: { eventTicketClasses: [cls], eventTicketObjects: [obj] },
  };
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(private_key, 'base64url');
  return `https://pay.google.com/gp/v/save/${unsigned}.${sig}`;
}
