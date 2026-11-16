// Removes ALL orders, tickets, scans and logs of the event – run once before
// ticket sales open, to clear the test purchases.
//
//   node --env-file=.env scripts/go-live-cleanup.mjs              → dry run (counts only)
//   node --env-file=.env scripts/go-live-cleanup.mjs --execute    → really deletes
//
// Safety: after sales opened (SALES_OPEN below) it refuses unless you also pass
// --after-sales-opened – so real buyers' orders can't be wiped by accident.
// Afterwards: check the price tiers (supabase/seed_2027.sql) and that
// BARION_ENV / BARION_POS_KEY / SZAMLAZZ_AGENT_KEY point to the hotel's live accounts.
import { purgeEvent } from '../netlify/functions/lib/purge.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';
const SALES_OPEN = new Date('2026-12-06T00:00:00+01:00');
const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');

if (execute && Date.now() >= SALES_OPEN.getTime() && !args.has('--after-sales-opened')) {
  console.error(`Ticket sales opened on ${SALES_OPEN.toISOString()} – the database may hold real orders.`);
  console.error('Refusing. If you are sure, add --after-sales-opened.');
  process.exit(1);
}

const plan = await purgeEvent(SLUG, { dryRun: true, removeRetiredTiers: true });
console.log(`Event "${plan.event}" – ${execute ? 'DELETING' : 'would delete (dry run)'}:`);
for (const [k, v] of Object.entries(plan)) if (!['event', 'dryRun'].includes(k)) console.log(`  ${k.padEnd(20)} ${v}`);

if (!execute) {
  console.log('\nNothing deleted. Run again with --execute to delete.');
  process.exit(0);
}
const done = await purgeEvent(SLUG, { dryRun: false, removeRetiredTiers: true });
console.log('\nDone. Deleted:', JSON.stringify(done));
console.log('Invoices already issued stay in Számlázz.hu (cancel test invoices there by hand if they were real).');
