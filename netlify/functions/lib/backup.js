// Nightly backup of the event's sales data, encrypted.
//
// What: orders, tickets, check-ins and the price tiers of the event (the
// invoices themselves live at Számlázz.hu). Packed as JSON, gzipped and
// encrypted with AES-256-GCM – the file holds buyers' names and e-mail
// addresses, so it must never sit in a mailbox in the clear.
// Key: BACKUP_KEY (env, ≥ 43 chars, like the other secrets; keep a copy
// somewhere safe – without it the backups can't be opened).
// Open a backup: node scripts/backup-open.mjs <file> (needs BACKUP_KEY).
//
// File format: "IRTK1" | salt(16) | iv(12) | tag(16) | ciphertext
// (key = scrypt(BACKUP_KEY, salt)).
import crypto from 'crypto';
import zlib from 'zlib';
import { db } from './db.js';
import { secretKeys } from './secrets.js';

const MAGIC = Buffer.from('IRTK1');
const SLUG = () => process.env.VITE_EVENT_SLUG || 'one-night-irottko';

async function all(table, select, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db().from(table).select(select)).order('id', { ascending: true }).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

/** Everything worth keeping about the event's sales, as one object. */
export async function collectBackup() {
  const { data: ev, error } = await db().from('events').select('*').eq('slug', SLUG()).single();
  if (error) throw error;
  const byEvent = (q) => q.eq('event_id', ev.id);
  const [tiers, orders, tickets] = await Promise.all([
    all('ticket_tiers', '*', byEvent),
    all('orders', '*', byEvent),
    all('tickets', '*', byEvent),
  ]);
  const orderIds = new Set(orders.map((o) => o.id));
  const checkIns = (await all('check_ins', '*', (q) => q)).filter((c) => !c.order_id || orderIds.has(c.order_id));
  return {
    generatedAt: new Date().toISOString(),
    event: ev,
    counts: {
      orders: orders.length,
      paidOrders: orders.filter((o) => o.status === 'paid').length,
      tickets: tickets.length,
      validTickets: tickets.filter((t) => t.status === 'valid' || t.status === 'used').length,
      checkIns: checkIns.length,
    },
    tiers,
    orders,
    tickets,
    checkIns,
  };
}

export function sealBackup(obj) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secretKeys('BACKUP_KEY').current, salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(obj)))), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), enc]);
}

/** Tries every BACKUP_KEY (current and _PREVIOUS). Throws if none fits. */
export function openBackup(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 50 || !buf.subarray(0, 5).equals(MAGIC)) throw new Error('Not an IRTK1 backup file');
  const salt = buf.subarray(5, 21);
  const iv = buf.subarray(21, 33);
  const tag = buf.subarray(33, 49);
  const body = buf.subarray(49);
  for (const k of secretKeys('BACKUP_KEY').all) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(k, salt, 32), iv);
      d.setAuthTag(tag);
      return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(body), d.final()])).toString('utf8'));
    } catch {
      /* try the next key */
    }
  }
  throw new Error('Wrong BACKUP_KEY (or the file is damaged)');
}

/** Builds, encrypts and e-mails the backup to BACKUP_EMAIL (Resend). */
export async function sendBackup() {
  const to = process.env.BACKUP_EMAIL;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!to || !key || !from) throw new Error('MISSING_BACKUP_EMAIL_OR_RESEND');
  const data = await collectBackup();
  const file = sealBackup(data);
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());
  const fileHash = crypto.createHash('sha256').update(file).digest('hex').slice(0, 16);
  const c = data.counts;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `backup-${day}-${fileHash}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `ONE NIGHT – éjszakai mentés ${day} (${c.paidOrders} fizetett rendelés, ${c.validTickets} jegy)`,
      text: [
        `Éjszakai mentés – ${day}`,
        '',
        `Rendelés: ${c.orders} (ebből fizetett: ${c.paidOrders})`,
        `Jegy: ${c.tickets} (érvényes / beléptetett: ${c.validTickets})`,
        `Beolvasás: ${c.checkIns}`,
        '',
        'A csatolt fájl titkosított (AES-256). Megnyitás: node scripts/backup-open.mjs <fájl> – kell hozzá a BACKUP_KEY.',
        'Személyes adatokat tartalmaz: a rendezvény után 90 nappal a régi mentéseket is töröld.',
      ].join('\n'),
      attachments: [{ filename: `irottko-mentes-${day}.bin`, content: file.toString('base64') }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  return { day, size: file.length, counts: c };
}
