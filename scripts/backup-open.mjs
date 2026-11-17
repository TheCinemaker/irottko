// Opens a nightly backup (irottko-mentes-YYYY-MM-DD.bin from the e-mail):
//   node --env-file=.env scripts/backup-open.mjs <file.bin> [output folder]
// Needs BACKUP_KEY (the same as on Netlify). Writes backup.json and Excel-
// friendly CSVs (orders, tickets, check-ins; UTF-8 with BOM, ; separated).
import fs from 'fs';
import path from 'path';
import { openBackup } from '../netlify/functions/lib/backup.js';

const [file, outArg] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node --env-file=.env scripts/backup-open.mjs <file.bin> [output folder]');
  process.exit(1);
}
const data = openBackup(fs.readFileSync(file));
const out = outArg || path.join(path.dirname(file), path.basename(file, path.extname(file)));
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'backup.json'), JSON.stringify(data, null, 2));

const csv = (rows) => {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\n');
};
for (const [name, rows] of [['rendelesek', data.orders], ['jegyek', data.tickets], ['belepesek', data.checkIns], ['jegytipusok', data.tiers]]) {
  fs.writeFileSync(path.join(out, `${name}.csv`), csv(rows));
}
console.log(`Mentés ${data.generatedAt}: ${JSON.stringify(data.counts)}`);
console.log(`Kibontva ide: ${out}`);
