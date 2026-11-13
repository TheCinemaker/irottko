// GET /.netlify/functions/wallet-google?c=CODE → redirect to "Save to Google Wallet".
import { loadTicketByCode } from './lib/fulfill.js';
import { googleSaveUrl } from './lib/wallet.js';

export const handler = async (event) => {
  const code = (event.queryStringParameters?.c || '').toUpperCase();
  if (!/^[0-9A-F]{18}$/.test(code)) return { statusCode: 400, body: 'bad code' };

  try {
    const ticket = await loadTicketByCode(code);
    if (!ticket) return { statusCode: 404, body: 'Ticket not found' };
    return { statusCode: 302, headers: { Location: googleSaveUrl(ticket), 'Cache-Control': 'no-store' }, body: '' };
  } catch (e) {
    console.error('wallet-google failed:', e.message);
    return { statusCode: 500, body: 'Wallet pass error' };
  }
};
