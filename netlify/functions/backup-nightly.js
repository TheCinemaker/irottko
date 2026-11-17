// Scheduled every night (netlify.toml): e-mails the encrypted backup of the
// sales data to BACKUP_EMAIL (lib/backup.js). Stops once the retention period
// is over (the data itself is deleted then by purge-after-event.js).
import { json } from './lib/db.js';
import { sendBackup } from './lib/backup.js';
import { landingAt } from '../../src/lib/schedule.js';
import { RETENTION_DAYS_AFTER_EVENT } from '../../src/data/legal.js';

export const handler = async () => {
  const purgeAt = landingAt({}).getTime() + RETENTION_DAYS_AFTER_EVENT * 86400e3;
  if (Date.now() > purgeAt) return json(200, { skipped: 'retention over' });
  try {
    const r = await sendBackup();
    console.log('backup-nightly sent', JSON.stringify(r));
    return json(200, r);
  } catch (e) {
    console.error('backup-nightly failed:', e.message);
    return json(500, { error: e.message });
  }
};
