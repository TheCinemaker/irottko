import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Info, DoorOpen, MapPin, Disc3, Shirt, IdCard, UtensilsCrossed, Ban, Cigarette } from 'lucide-react';
import PageShell from '../components/PageShell';
import HeroSection from '../components/HeroSection';
import BarTiles from '../components/BarTiles';
import LineupBoard from '../components/LineupBoard';
import { usePricing } from '../lib/usePricing';
import { INFO, KITCHEN } from '../data/eventData';
import TicketButton from '../components/TicketButton';

// Wayfinding pictograms for the passenger-information rows (by label).
const INFO_ICON = {
  'Gate open': DoorOpen,
  Terminál: MapPin,
  'DJ-pult': Disc3,
  'Dress code': Shirt,
  Beszállás: IdCard,
  'Nincs visszaút': Ban,
  Dohányzás: Cigarette,
  'Fedélzeti menü': UtensilsCrossed,
};

export default function HomePage() {
  const pricing = usePricing();

  return (
    <PageShell>
      <HeroSection />

      {/* Line-up – departures board */}
      <LineupBoard />

      {/* Bars – one swipeable row */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-28">
        <SectionHead kicker="Gates A–C & VIP · Fedélzeti ellátás" title="Három bár a fedélzeten." />
        <BarTiles carousel />
        <div className="mt-6 text-center">
          <Link to="/barok" className="link-more text-[14px]">
            Összes bár <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Practical info – an airport information sign (folded away: needed, but not the headline) */}
      <section className="mx-auto max-w-3xl px-5 pt-12 sm:pt-20">
        <details className="group overflow-hidden rounded-[6px] border border-white/10 bg-[#0b0812] [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
              <Info className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-extrabold uppercase tracking-[0.08em] text-white">Utastájékoztató</span>
              <span className="block text-[12px] font-medium uppercase tracking-[0.18em] text-gray-500">Passenger information</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[#d4af37] transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <dl className="border-t border-white/[0.08]">
            {[...INFO, { label: KITCHEN.name, value: KITCHEN.shortDesc }].map((row) => {
              const Icon = INFO_ICON[row.label] || Info;
              return (
                <div key={row.label} className="flex gap-4 border-b border-white/[0.06] px-4 py-4 last:border-b-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#d4af37]/40 text-[#d4af37]" aria-hidden="true">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4af37]">{row.label}</dt>
                    <dd className="mt-1 text-[15px] leading-snug text-gray-200">{row.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </details>
      </section>

      {/* Tickets */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-28">
        <h2 className="display text-[2rem] sm:text-6xl">
          <span className="text-[#d4af37]">Csak</span> egy járat indul!
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-gray-400">Január 15-én felszállunk – és hajnalig nem szállunk le.</p>
        <TicketButton pricing={pricing} className="mx-auto mt-6" />
      </section>
    </PageShell>
  );
}

// Section heading with an optional "see all" link on the right (app style).
function SectionHead({ kicker, title, to, more }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="kicker">{kicker}</div>
        <h2 className="mt-2 text-[1.6rem] font-semibold leading-tight text-white sm:text-4xl">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="link-more shrink-0 pb-1 text-[14px]">
          {more} <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
