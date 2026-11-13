import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import LineupSection from '../components/LineupSection';

export default function LineupPage() {
  return (
    <PageShell>
      <PageHeader kicker="Line-up · Menetrend" title="Csak egy járat indul!">
        Boarding: 19:00
      </PageHeader>
      <LineupSection />
    </PageShell>
  );
}
