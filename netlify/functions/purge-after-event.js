// Scheduled daily (netlify.toml). Data retention promised in the privacy notice
// (/adatkezeles): order, ticket and scan data are deleted RETENTION_DAYS_AFTER_EVENT
// days after the event; IP addresses (abuse limits only) after 30 days.
// Before that date it only forgets old IPs. Invoices stay in Számlázz.hu.
import { json } from './lib/db.js';
import { purgeEvent, forgetOldIps } from './lib/purge.js';
import { EVENT_DETAILS } from '../../src/data/eventData.js';
import { RETENTION_DAYS_AFTER_EVENT } from '../../src/data/legal.js';

const SLUG = process.env.VITE_EVENT_SLUG || 'one-night-irottko';

export const handler = async () => {
  try {
    const ips = await forgetOldIps(30);
    // the night ends the next morning → count from the day after the event
    const eventEnd = new Date(EVENT_DETAILS.isoDate).getTime() + 86400e3;
    const purgeAt = eventEnd + RETENTION_DAYS_AFTER_EVENT * 86400e3;
    if (Date.now() < purgeAt) {
      if (ips) console.log(`purge-after-event: forgot ${ips} old IP(s); event data kept until ${new Date(purgeAt).toISOString()}`);
      return json(200, { ips, purgeAt: new Date(purgeAt).toISOString(), purged: false });
    }
    const done = await purgeEvent(SLUG, { dryRun: false });
    console.log('purge-after-event: retention reached, deleted', JSON.stringify(done));
    return json(200, { ips, purged: done });
  } catch (e) {
    console.error('purge-after-event failed:', e.message);
    return json(500, { error: e.message });
  }
};
