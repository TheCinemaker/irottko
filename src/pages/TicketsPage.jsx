import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import TicketSection from '../components/TicketSection';
import MyTickets from '../components/MyTickets';
import { getMyTickets } from '../lib/myTickets';

// Jegyek tab: the tickets on this phone first (if any), then buying.
export default function TicketsPage() {
  const hasTickets = getMyTickets().length > 0;
  return (
    <PageShell>
      <MyTickets />
      <PageHeader kicker={hasTickets ? 'Új vásárlás' : 'Jegyek'} title={hasTickets ? 'Még egy jegy?' : 'Válassz jegyet.'} compact={hasTickets}>
        A jegyet és a számlát e-mailben küldjük, Apple és Google Walletbe is menthető.
      </PageHeader>
      <TicketSection />
    </PageShell>
  );
}
