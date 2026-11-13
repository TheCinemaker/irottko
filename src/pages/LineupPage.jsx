import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import LineupSection from '../components/LineupSection';

export default function LineupPage() {
  return (
    <PageShell>
      <PageHeader kicker="Line-up · Menetrend" title="Csak egy járat indul.">
        Gate open és az első szett: 19:00. A pilótafülke (DJ-pult) az első emeleten, a karzaton.
      </PageHeader>
      <LineupSection />
    </PageShell>
  );
}
