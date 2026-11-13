// Printable PDF tickets: one A4 page per ticket, white page (printer friendly),
// gold accents, big QR. Fonts: Inter + Cinzel (OFL), embedded and subset so
// Hungarian letters (ő, ű, Í) render correctly.
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { EVENT_DETAILS } from '../../../src/data/eventData.js';

const GOLD = rgb(212 / 255, 175 / 255, 55 / 255);
const INK = rgb(0.07, 0.06, 0.09);
const GREY = rgb(0.43, 0.43, 0.45);
const LINE = rgb(0.88, 0.88, 0.9);
const NIGHT = rgb(5 / 255, 3 / 255, 10 / 255);

function asset(rel) {
  const p = [path.resolve(process.cwd(), 'netlify/functions/wallet-assets', rel), path.resolve(process.cwd(), 'wallet-assets', rel)].find((f) =>
    fs.existsSync(f)
  );
  if (!p) throw new Error(`Missing asset: ${rel}`);
  return fs.readFileSync(p);
}

const dateHu = EVENT_DETAILS.dateString.replace(/\s*\(.*\)/, '');

/** order: { id, full_name }, tickets: [{ code, tier_name, tier_kind, holder_name }] → Buffer */
export async function ticketsPdf(order, tickets) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${EVENT_DETAILS.title} – jegyek`);
  doc.setAuthor(EVENT_DETAILS.title);
  const regular = await doc.embedFont(asset('fonts/Inter_400Regular.ttf'), { subset: false, features: { calt: false, liga: false, case: false } });
  const semi = await doc.embedFont(asset('fonts/Inter_600SemiBold.ttf'), { subset: false, features: { calt: false, liga: false, case: false } });
  const display = await doc.embedFont(asset('fonts/Cinzel_700Bold.ttf'), { subset: true });

  for (const [i, t] of tickets.entries()) {
    const page = doc.addPage([595.28, 841.89]); // A4
    const W = page.getWidth();
    const H = page.getHeight();
    const vip = t.tier_kind === 'vip';
    const center = (text, font, size, y, color = INK, spacing = 0) => {
      const w = font.widthOfTextAtSize(text, size) + spacing * (text.length - 1);
      if (!spacing) return page.drawText(text, { x: (W - w) / 2, y, size, font, color });
      let x = (W - w) / 2;
      for (const ch of text) {
        page.drawText(ch, { x, y, size, font, color });
        x += font.widthOfTextAtSize(ch, size) + spacing;
      }
    };

    // Header band
    page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: NIGHT });
    center(`${dateHu.toUpperCase()}  ·  KŐSZEG`, semi, 10, H - 52, GOLD, 2);
    center('ONE NIGHT AT ÍROTTKŐ', display, 28, H - 95, rgb(1, 1, 1));
    center(`${EVENT_DETAILS.venue}  ·  Kapunyitás ${EVENT_DETAILS.doorsOpen}`, regular, 11, H - 122, rgb(0.8, 0.8, 0.82));

    // Ticket type
    const label = vip ? 'VIP LOUNGE' : t.tier_name.toUpperCase();
    const lw = semi.widthOfTextAtSize(label, 12) + 2 * (label.length - 1) + 36;
    page.drawRectangle({
      x: (W - lw) / 2, y: H - 205, width: lw, height: 28,
      ...(vip ? { color: GOLD } : {}), borderColor: GOLD, borderWidth: 1.2,
    });
    center(label, semi, 12, H - 196, vip ? NIGHT : INK, 2);

    center(t.holder_name || order.full_name || '', semi, 20, H - 245);
    center(`Beszállókártya · ${i + 1}. utas a(z) ${tickets.length}-ből`, regular, 10, H - 263, GREY);

    // QR
    const qrPng = await QRCode.toBuffer(t.code, { type: 'png', width: 720, margin: 1, errorCorrectionLevel: 'M' });
    const qr = await doc.embedPng(qrPng);
    const size = 250;
    page.drawImage(qr, { x: (W - size) / 2, y: H - 290 - size, width: size, height: size });
    center(t.code, semi, 15, H - 290 - size - 30, INK, 3);
    center('Mutasd fel a belépéskor – telefonon vagy kinyomtatva.', regular, 10, H - 290 - size - 50, GREY);

    // Details
    let y = 200;
    page.drawLine({ start: { x: 70, y: y + 30 }, end: { x: W - 70, y: y + 30 }, thickness: 0.8, color: LINE });
    const row = (k, v) => {
      page.drawText(k, { x: 70, y, size: 9, font: semi, color: GREY });
      page.drawText(v, { x: 200, y, size: 11, font: regular, color: INK });
      y -= 24;
    };
    row('DÁTUM', `${dateHu}, kapunyitás ${EVENT_DETAILS.doorsOpen}`);
    row('HELYSZÍN', `${EVENT_DETAILS.venue} – ${EVENT_DETAILS.address}`);
    row('JEGY', vip ? 'VIP Lounge' : t.tier_name);
    row('RENDELÉSSZÁM', order.id);

    page.drawLine({ start: { x: 70, y: y + 6 }, end: { x: W - 70, y: y + 6 }, thickness: 0.8, color: LINE });
    center('A jegy névre szóló, nem átruházható, és egy fő egyszeri belépésére jogosít.', semi, 9, y - 18, INK);
    center('A kód első beolvasása után érvényét veszti – második belépésnél a rendszer már nem enged be.', regular, 9, y - 32, GREY);
    center('Korhatár: 18+', regular, 9, y - 46, GREY);
  }

  return Buffer.from(await doc.save());
}
