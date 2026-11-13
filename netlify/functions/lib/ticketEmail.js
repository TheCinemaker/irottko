// Ticket e-mail via Resend REST API (no SDK).
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. 'One Night at Írottkő <party@pelda.hu>' –
//      the domain must be verified in Resend).
//
// Images (QR codes, official Wallet badges) are embedded inline (CID), so they
// show in Gmail/Outlook without loading anything from our server. The tickets
// also go out as a printable PDF attachment.
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { EVENT_DETAILS } from '../../../src/data/eventData.js';
import { appUrl } from './db.js';
import { ticketsPdf } from './ticketPdf.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const huf = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0Ft`;
const dateHu = EVENT_DETAILS.dateString.replace(/\s*\(.*\)/, '');

function asset(rel) {
  const p = [path.resolve(process.cwd(), 'netlify/functions/wallet-assets', rel), path.resolve(process.cwd(), 'wallet-assets', rel)].find((f) =>
    fs.existsSync(f)
  );
  if (!p) throw new Error(`Missing asset: ${rel}`);
  return fs.readFileSync(p);
}

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

function html(order, tickets) {
  const fn = (name, code) => `${appUrl()}/.netlify/functions/${name}?c=${encodeURIComponent(code)}`;

  const cards = tickets
    .map((t, i) => {
      const vip = t.tier_kind === 'vip';
      const label = vip ? 'VIP LOUNGE' : esc(t.tier_name).toUpperCase();
      return `
      <tr><td style="padding:0 0 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid ${vip ? '#d4af37' : '#e8e8ed'}">
          <tr><td align="center" style="padding:28px 20px 8px">
            <span style="display:inline-block;padding:6px 14px;border-radius:999px;font:600 11px/1 ${FONT};letter-spacing:2px;${
              vip ? 'background:#d4af37;color:#05030a' : 'border:1px solid #d4af37;color:#1d1d1f'
            }">${label}</span>
            <div style="margin-top:14px;font:600 20px/1.3 ${FONT};color:#1d1d1f">${esc(t.holder_name || order.full_name)}</div>
            <div style="margin-top:4px;font:400 13px/1.4 ${FONT};color:#86868b">${i + 1}. jegy a(z) ${tickets.length}-ből · névre szóló</div>
          </td></tr>
          <tr><td align="center" style="padding:8px 20px 4px">
            <img src="cid:qr-${i}" width="220" height="220" alt="QR-kód: ${esc(t.code)}" style="display:block;width:220px;height:220px;border:0">
          </td></tr>
          <tr><td align="center" style="padding:4px 20px 20px;font:600 16px/1.4 Menlo,Consolas,monospace;letter-spacing:3px;color:#1d1d1f">${esc(t.code)}</td></tr>
          <tr><td align="center" style="padding:0 12px 24px">
            <a href="${fn('wallet-apple', t.code)}" style="display:inline-block;margin:4px;text-decoration:none"><img src="cid:badge-apple" height="44" alt="Hozzáadás az Apple Tárcához" style="display:block;height:44px;border:0"></a>
            <a href="${fn('wallet-google', t.code)}" style="display:inline-block;margin:4px;text-decoration:none"><img src="cid:badge-google" height="44" alt="Hozzáadás a Google Wallethez" style="display:block;height:44px;border:0"></a>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join('');

  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f2f2f5">
  <div style="display:none;max-height:0;overflow:hidden">Itt vannak a jegyeid – ${esc(dateHu)}, ${esc(EVENT_DETAILS.venue)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f5"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

      <tr><td align="center" style="background:#05030a;border-radius:16px;padding:36px 24px">
        <div style="font:600 11px/1 ${FONT};letter-spacing:3px;color:#d4af37">${esc(dateHu.toUpperCase())} · KŐSZEG</div>
        <div style="margin-top:14px;font:700 26px/1.2 Georgia,'Times New Roman',serif;letter-spacing:1px;color:#ffffff">ONE NIGHT AT ÍROTTKŐ</div>
        <div style="margin-top:10px;font:400 14px/1.4 ${FONT};color:#b9b9c0">${esc(EVENT_DETAILS.venue)} · Kapunyitás ${esc(EVENT_DETAILS.doorsOpen)}</div>
      </td></tr>

      <tr><td style="padding:28px 8px 20px;font:400 16px/1.55 ${FONT};color:#1d1d1f">
        Kedves ${esc(order.full_name)}!<br><br>
        Köszönjük a vásárlást, itt ${tickets.length > 1 ? `van mind a(z) ${tickets.length} jegyed` : 'a jegyed'}.
        A belépéskor mutasd fel a QR-kódot – a telefonodon, a Tárcádban, vagy a csatolt PDF-ből kinyomtatva.
        ${
          tickets.length > 1
            ? `<br><br>Minden jegynek saját QR-kódja van, és egy jegy egy fő belépésére szól – a kapunál minden vendégnek külön kódot olvasunk be.`
            : ''
        }
      </td></tr>

      <tr><td style="padding:0 0 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-radius:12px;border:1px solid #d4af37">
          <tr><td style="padding:16px 18px;font:400 14px/1.55 ${FONT};color:#1d1d1f">
            <div style="font:600 12px/1 ${FONT};letter-spacing:2px;color:#8a6d0b;margin-bottom:10px">FONTOS</div>
            <b>A jegy névre szóló, nem átruházható</b>, és egyszeri belépésre jogosít.<br>
            A QR-kódot a kapunál beolvassuk – onnantól a kód felhasznált, <b>második belépésnél a rendszer már nem enged be</b>.<br>
            Ne oszd meg a QR-kódot, és ne tedd ki közösségi oldalra: a belépésre mindig az első beolvasás jogosít.
          </td></tr>
        </table>
      </td></tr>

      ${cards}

      ${order.payment_ref ? `<tr><td align="center" style="padding:4px 8px 24px">
        <a href="${appUrl()}/success?paymentId=${encodeURIComponent(order.payment_ref)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#d4af37;color:#05030a;font:600 15px/1 ${FONT};text-decoration:none">Jegyeim megnyitása az appban</a>
        <div style="margin-top:10px;font:400 12px/1.5 ${FONT};color:#86868b">Nyisd meg a telefonodon: a jegyek a Jegyek fülön is ott lesznek.</div>
      </td></tr>` : ''}

      <tr><td style="padding:8px 8px 0;font:400 13px/1.7 ${FONT};color:#6e6e73">
        Rendelésszám: ${esc(order.id)}<br>
        Végösszeg: ${huf(order.total_huf)}<br>
        A jegyek nyomtatható változata a csatolt PDF-ben van. A számlát a Számlázz.hu külön e-mailben küldi.<br>
        A jegy névre szóló, nem átruházható. Minden kód egyszer használható, második belépésre nem jogosít. Korhatár: 18+
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendTicketEmail(order, tickets) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key) throw new Error('MISSING_RESEND_API_KEY');
  if (!from) throw new Error('MISSING_EMAIL_FROM');

  const inline = await Promise.all(
    tickets.map(async (t, i) => ({
      filename: `qr-${i + 1}.png`,
      content: (await QRCode.toBuffer(t.code, { type: 'png', width: 440, margin: 2, errorCorrectionLevel: 'M' })).toString('base64'),
      content_id: `qr-${i}`,
    }))
  );
  inline.push(
    { filename: 'apple-wallet.png', content: asset('apple-wallet-badge.png').toString('base64'), content_id: 'badge-apple' },
    { filename: 'google-wallet.png', content: asset('google-wallet-badge.png').toString('base64'), content_id: 'badge-google' }
  );
  const pdf = await ticketsPdf(order, tickets);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `A jegyeid – ${EVENT_DETAILS.title}`,
      html: html(order, tickets),
      text:
        `Kedves ${order.full_name}!\n\nKöszönjük a vásárlást. Jegykódjaid:\n` +
        tickets.map((t, i) => `${i + 1}. ${t.tier_kind === 'vip' ? 'VIP Lounge' : t.tier_name}: ${t.code}`).join('\n') +
        `\n\n${dateHu}, ${EVENT_DETAILS.venue}, kapunyitás ${EVENT_DETAILS.doorsOpen}.\n\n` +
        `FONTOS: A jegy névre szóló, nem átruházható, és egyszeri belépésre jogosít. A QR-kódot a kapunál beolvassuk – ` +
        `második belépésnél a rendszer már nem enged be. Egy jegy egy fő belépésére szól. Ne oszd meg a QR-kódot.\n\n` +
        `A nyomtatható jegyek a csatolt PDF-ben vannak. Rendelésszám: ${order.id}`,
      attachments: [...inline, { filename: 'one-night-irottko-jegyek.pdf', content: pdf.toString('base64') }],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
