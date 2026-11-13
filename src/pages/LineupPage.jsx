import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import LineupSection from '../components/LineupSection';

export default function LineupPage() {
  return (
    <PageShell>
      <PageHeader kicker="Line-up" title="Három DJ. Egy éjszaka.">
        A DJ-pult a galérián, a táncparkett az aulában. 20:00-tól hajnali 4-ig.
      </PageHeader>
      <LineupSection />
    </PageShell>
  );
}
