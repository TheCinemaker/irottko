// GET /.netlify/functions/ticket-qr?c=CODE → PNG QR code.
// Generated here so ticket codes are never sent to a third-party QR service.
import QRCode from 'qrcode';

export const handler = async (event) => {
  const code = (event.queryStringParameters?.c || '').toUpperCase();
  if (!/^[0-9A-F]{18}$/.test(code)) return { statusCode: 400, body: 'bad code' };

  const png = await QRCode.toBuffer(code, { type: 'png', width: 440, margin: 2, errorCorrectionLevel: 'M' });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: png.toString('base64'),
    isBase64Encoded: true,
  };
};
