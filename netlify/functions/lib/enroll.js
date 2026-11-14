// Door-phone enrolment without the PIN (table scanner_enrollments,
// supabase/012_scanner_enroll.sql).
//
// A logged-in admin creates a code (admin-action 'enroll-create'); the admin
// page shows it as a QR code / link to /scan#enroll=<code>. The door phone opens
// it once and gets a normal 24 h scanner session. The code is:
//   - 256 bits of crypto randomness (not guessable),
//   - stored only as a SHA-256 hash (a database read doesn't reveal usable codes),
//   - single use (consumed by one atomic UPDATE … WHERE used_at IS NULL),
//   - short-lived (ENROLL_MINUTES) and revocable until used.
// Any database error → no session (fail closed).
import crypto from 'crypto';
import { db } from './db.js';

export const ENROLL_MINUTES = 10;
const CODE = /^[A-Za-z0-9_-]{43}$/;
const hash = (code) => crypto.createHash('sha256').update(code).digest('hex');

export async function createEnrollment(label) {
  const code = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ENROLL_MINUTES * 60000).toISOString();
  const { data, error } = await db()
    .from('scanner_enrollments')
    .insert({ code_hash: hash(code), label: String(label || '').trim().slice(0, 40) || null, expires_at: expiresAt })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, code, expiresAt };
}

export async function listEnrollments() {
  const { data, error } = await db()
    .from('scanner_enrollments')
    .select('id, label, created_at, expires_at, used_at, revoked_at')
    .gt('created_at', new Date(Date.now() - 24 * 3600e3).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function revokeEnrollment(id) {
  const { data, error } = await db()
    .from('scanner_enrollments')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', Number(id))
    .is('used_at', null)
    .is('revoked_at', null)
    .select('id');
  if (error) throw error;
  return data.length === 1;
}

/** true once for a valid, unused, unexpired, unrevoked code; false otherwise. Throws on DB error. */
export async function consumeEnrollment(code) {
  if (typeof code !== 'string' || !CODE.test(code)) return false;
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('scanner_enrollments')
    .update({ used_at: now })
    .eq('code_hash', hash(code))
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .select('id');
  if (error) throw error;
  return data.length === 1;
}
