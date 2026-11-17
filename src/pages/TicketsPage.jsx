import React, { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import PageShell from '../components/PageShell';
import TicketSection from '../components/TicketSection';
import MyTickets from '../components/MyTickets';
import { getMyTickets } from '../lib/myTickets';

// Jegyek tab: the tickets on this phone first (if any), then buying.
export default function TicketsPage() {
  const [count, setCount] = useState(() => getMyTickets().length);
  const hasTickets = count > 0;
  return (
    <PageShell>
      <MyTickets onChange={setCount} />
      <header className={`mx-auto max-w-2xl px-5 pb-10 text-center ${hasTickets ? 'pt-14' : 'pt-32 sm:pt-40'}`}>
        <div className="kicker">{hasTickets ? 'Új foglalás' : 'Online check-in'}</div>
        <h1 className="display mt-4 whitespace-nowrap text-[clamp(1.5rem,7.4vw,4.5rem)]">{hasTickets ? 'Hozol még valakit?' : 'Foglald le a helyed.'}</h1>
        {/* airport information strip – folded, so the booking starts right away */}
        <details className="group mt-7 overflow-hidden rounded-[6px] border border-white/10 bg-[#0b0812] text-left [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
              <Info className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-bold uppercase tracking-[0.12em] text-white">Tudnivalók</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[#d4af37] transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t border-white/[0.08] px-4 py-3 text-[14px] leading-snug text-gray-300">
            A beszállókártyát és a számlát e-mailben küldjük – Apple és Google Tárcába is menthető.
            {!hasTickets && (
              <span className="mt-2 block text-[13px] text-gray-500">
                Már van beszállókártyád? Nyisd meg ezen a telefonon az e-mailben a „Beszállókártyák megnyitása az appban” gombot, és itt lesznek.
              </span>
            )}
          </div>
        </details>
      </header>
      <TicketSection />
    </PageShell>
  );
}
