// Apple PassKit web service (developer.apple.com → Wallet → "Adding a Web
// Service to Update Passes"). The pass's webServiceURL is <site>/passkit;
// netlify.toml sends /passkit/* here. Endpoints:
//   POST   v1/devices/{device}/registrations/{passType}/{serial}  register (body: { pushToken })
//   DELETE v1/devices/{device}/registrations/{passType}/{serial}  unregister
//   GET    v1/devices/{device}/registrations/{passType}?passesUpdatedSince=tag
//   GET    v1/passes/{passType}/{serial}                          the latest pass
//   POST   v1/log                                                  device error log
// Register / unregister / download need "Authorization: ApplePass <token>"
// (lib/passAuth.js). Registrations: table wallet_registrations (016).
import { db } from './lib/db.js';
import { loadTicketByCode } from './lib/fulfill.js';
import { applePass, APPLE_PASS_TYPE_ID } from './lib/wallet.js';
import { validPassAuth } from './lib/passAuth.js';
import { currentMessage } from './lib/walletPush.js';

const SERIAL = /^irottko-([0-9A-F]{18})$/;
const DEVICE = /^[A-Za-z0-9._-]{16,128}$/;
const MAX_DEVICES_PER_SERIAL = 5;
const res = (statusCode, body = '', headers = {}) => ({ statusCode, headers, body });
const jsonRes = (statusCode, obj) => res(statusCode, JSON.stringify(obj), { 'Content-Type': 'application/json' });
const header = (event, name) => {
  const h = event.headers || {};
  return h[name] ?? h[name.toLowerCase()] ?? Object.entries(h).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
};

// The update tag: when the passengers' message last changed (all passes share it).
const tagOf = (at) => String(at ? at.getTime() : 0);

export const handler = async (event) => {
  const path = (event.path || '').replace(/^.*?\/v1\//, 'v1/');
  const parts = path.split('/').filter(Boolean); // v1, …
  const method = event.httpMethod;
  try {
    // POST v1/log
    if (method === 'POST' && parts[1] === 'log') {
      let logs = [];
      try {
        logs = JSON.parse(event.body || '{}').logs || [];
      } catch {
        /* ignore */
      }
      for (const l of logs.slice(0, 20)) console.warn('passkit device log:', String(l).slice(0, 300));
      return res(200);
    }

    // v1/devices/{device}/registrations/{passType}[/{serial}]
    if (parts[1] === 'devices' && parts[3] === 'registrations') {
      const [, , device, , passType, serial] = parts;
      if (!DEVICE.test(device || '') || passType !== APPLE_PASS_TYPE_ID()) return res(404);

      if (method === 'GET' && !serial) {
        const { data, error } = await db()
          .from('wallet_registrations')
          .select('serial_number')
          .eq('device_library_identifier', device)
          .eq('pass_type_identifier', passType);
        if (error) throw error;
        if (!data.length) return res(204);
        const { at } = await currentMessage();
        const tag = tagOf(at);
        const since = event.queryStringParameters?.passesUpdatedSince;
        if (since && Number(since) >= Number(tag)) return res(204); // nothing new
        return jsonRes(200, { serialNumbers: data.map((r) => r.serial_number), lastUpdated: tag });
      }

      if (!SERIAL.test(serial || '')) return res(404);
      if (!validPassAuth(header(event, 'Authorization'), serial)) return res(401);

      if (method === 'POST') {
        let pushToken = '';
        try {
          pushToken = String(JSON.parse(event.body || '{}').pushToken || '');
        } catch {
          /* bad body */
        }
        if (!/^[A-Za-z0-9]{16,200}$/.test(pushToken)) return res(400);
        const { data: existing } = await db()
          .from('wallet_registrations')
          .select('id')
          .eq('device_library_identifier', device)
          .eq('pass_type_identifier', passType)
          .eq('serial_number', serial)
          .maybeSingle();
        if (!existing) {
          const { count, error: cErr } = await db()
            .from('wallet_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('pass_type_identifier', passType)
            .eq('serial_number', serial);
          if (cErr) throw cErr;
          if ((count ?? 0) >= MAX_DEVICES_PER_SERIAL) return res(429);
        }
        const { error } = await db().from('wallet_registrations').upsert(
          {
            device_library_identifier: device,
            pass_type_identifier: passType,
            serial_number: serial,
            push_token: pushToken,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'device_library_identifier,pass_type_identifier,serial_number' }
        );
        if (error) throw error;
        return res(existing ? 200 : 201);
      }

      if (method === 'DELETE') {
        const { error } = await db()
          .from('wallet_registrations')
          .delete()
          .eq('device_library_identifier', device)
          .eq('pass_type_identifier', passType)
          .eq('serial_number', serial);
        if (error) throw error;
        return res(200);
      }
      return res(405);
    }

    // GET v1/passes/{passType}/{serial} → the latest .pkpass
    if (method === 'GET' && parts[1] === 'passes') {
      const [, , passType, serial] = parts;
      const m = SERIAL.exec(serial || '');
      if (passType !== APPLE_PASS_TYPE_ID() || !m) return res(404);
      if (!validPassAuth(header(event, 'Authorization'), serial)) return res(401);
      const { text, at } = await currentMessage();
      const lastModified = (at || new Date(0)).toUTCString();
      const since = header(event, 'If-Modified-Since');
      if (since && at && new Date(since).getTime() >= Math.floor(at.getTime() / 1000) * 1000) return res(304);
      const ticket = await loadTicketByCode(m[1]);
      if (!ticket) return res(401); // void / unknown ticket: no new version
      const buf = await applePass(ticket, { message: text });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/vnd.apple.pkpass', 'Last-Modified': lastModified, 'Cache-Control': 'no-store' },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return res(404);
  } catch (e) {
    console.error('passkit failed:', e.message);
    return res(500);
  }
};
