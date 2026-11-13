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
      <PageHeader kicker={hasTickets ? 'Új foglalás' : 'Check-in'} title={hasTickets ? 'Hozol még valakit?' : 'Foglald le a helyed.'} compact={hasTickets}>
        A beszállókártyát és a számlát e-mailben küldjük – Apple és Google Tárcába is menthető.
      </PageHeader>
      {!hasTickets && (
        <p className="mx-auto -mt-6 mb-12 max-w-md px-5 text-center text-[13px] text-gray-500">
          Már van beszállókártyád? Nyisd meg ezen a telefonon az e-mailben a „Beszállókártyák megnyitása az appban” gombot, és itt lesznek.
        </p>
      )}
      <TicketSection />
    </PageShell>
  );
}
