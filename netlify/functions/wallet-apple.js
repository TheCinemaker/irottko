// GET /.netlify/functions/wallet-apple?c=CODE → .pkpass download (Apple Wallet).
import { loadTicketByCode } from './lib/fulfill.js';
import { applePass } from './lib/wallet.js';

export const handler = async (event) => {
  const code = (event.queryStringParameters?.c || '').toUpperCase();
  if (!/^[0-9A-F]{18}$/.test(code)) return { statusCode: 400, body: 'bad code' };

  try {
    const ticket = await loadTicketByCode(code);
    if (!ticket) return { statusCode: 404, body: 'Ticket not found' };
    const buf = await applePass(ticket);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="one-night-irottko-${code}.pkpass"`,
        'Cache-Control': 'no-store',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error('wallet-apple failed:', e.message);
    return { statusCode: 500, body: 'Wallet pass error' };
  }
};
