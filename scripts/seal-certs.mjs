// Encrypts the wallet signing files into netlify/functions/certs.enc (committed).
//   node --env-file=.env scripts/seal-certs.mjs
// If CERTS_KEY is not set yet, prints a new key to put into .env AND Netlify env.
import fs from 'fs';
import crypto from 'crypto';
import { seal, SEALED_FILES } from '../netlify/functions/lib/sealedCerts.js';

if (!process.env.CERTS_KEY) {
  console.log('No CERTS_KEY yet. Add this line to .env (and the same value to Netlify env), then run again:\n');
  console.log(`CERTS_KEY=${crypto.randomBytes(32).toString('base64')}`);
  process.exit(1);
}

const files = Object.fromEntries(SEALED_FILES.map((n) => [n, fs.readFileSync(`netlify/functions/certs/${n}`)]));
fs.writeFileSync('netlify/functions/certs.enc', seal(files));
console.log(`Sealed ${SEALED_FILES.length} files → netlify/functions/certs.enc`);
