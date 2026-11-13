import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import TicketSection from '../components/TicketSection';

export default function TicketsPage() {
  return (
    <PageShell>
      <PageHeader kicker="Jegyek" title="Válassz jegyet.">
        A jegyet és a számlát e-mailben küldjük, Apple és Google Walletbe is menthető.
      </PageHeader>
      <TicketSection />
    </PageShell>
  );
}
