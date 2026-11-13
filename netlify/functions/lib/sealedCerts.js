// Wallet signing files, sealed for deployment.
//
// netlify/functions/certs/ is gitignored, but Netlify builds from git. So the
// files are also kept encrypted in netlify/functions/certs.enc (AES-256-GCM),
// which IS committed; the key lives only in the CERTS_KEY env var.
// Without the key the file is useless, so it is safe even in a public repo.
//
//   Seal (after changing a cert):  node --env-file=.env scripts/seal-certs.mjs
//   Runtime: openSealed('pass.p12') → Buffer
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const SEALED_FILES = ['pass.p12', 'AppleWWDRCAG3.cer', 'google-wallet.json'];
const SEALED_PATH = 'netlify/functions/certs.enc';

function key() {
  const k = process.env.CERTS_KEY;
  if (!k) throw new Error('MISSING_CERTS_KEY');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('CERTS_KEY must be 32 bytes, base64');
  return buf;
}

/** { name: Buffer } → sealed Buffer (iv | tag | ciphertext) */
export function seal(files) {
  const json = JSON.stringify(Object.fromEntries(Object.entries(files).map(([n, b]) => [n, b.toString('base64')])));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(json, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

let opened;
function openAll() {
  if (opened) return opened;
  const p = [path.resolve(process.cwd(), SEALED_PATH), path.resolve(process.cwd(), 'certs.enc')].find((f) => fs.existsSync(f));
  if (!p) throw new Error('Missing certs.enc');
  const raw = fs.readFileSync(p);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  const json = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  opened = Object.fromEntries(Object.entries(JSON.parse(json)).map(([n, b64]) => [n, Buffer.from(b64, 'base64')]));
  return opened;
}

export function openSealed(name) {
  const buf = openAll()[name];
  if (!buf) throw new Error(`certs.enc has no ${name}`);
  return buf;
}
