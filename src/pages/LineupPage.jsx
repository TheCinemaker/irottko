import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import LineupSection from '../components/LineupSection';

export default function LineupPage() {
  return (
    <PageShell>
      <PageHeader kicker="Line-up" title="Négy fellépő. Egy éjszaka.">
        Kapunyitás és az első szett: 19:00.
      </PageHeader>
      <LineupSection />
    </PageShell>
  );
}
