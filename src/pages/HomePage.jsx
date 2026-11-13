import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import HeroSection from '../components/HeroSection';
import BarTiles from '../components/BarTiles';
import LineupBoard from '../components/LineupBoard';
import { usePricing, fromLabel } from '../lib/usePricing';
import { INFO, KITCHEN } from '../data/eventData';

export default function HomePage() {
  const pricing = usePricing();

  return (
    <PageShell>
      <HeroSection />

      {/* Line-up – departures board */}
      <LineupBoard />

      {/* Bars – one swipeable row */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-28">
        <SectionHead kicker="Bárok · Fedélzeti ellátás" title="Három bár a fedélzeten." to="/barok" more="Mind" />
        <BarTiles carousel />
      </section>

      {/* Practical info – folded away: needed, but not the headline */}
      <section className="mx-auto max-w-3xl px-5 pt-12 sm:pt-20">
        <details className="group rounded-3xl border border-white/10 bg-white/[0.03] [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold text-white">Utastájékoztató</span>
              <span className="block truncate text-[13px] text-gray-500">Gate open, terminál, dresscode, beszállás</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[#d4af37] transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <dl className="divide-y divide-white/[0.08] border-t border-white/[0.08] px-5">
            {[...INFO, { label: KITCHEN.name, value: KITCHEN.shortDesc }].map((row) => (
              <div key={row.label} className="grid grid-cols-[96px_1fr] gap-3 py-3.5 sm:grid-cols-[150px_1fr] sm:gap-8">
                <dt className="pt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#d4af37]">{row.label}</dt>
                <dd className="text-[15px] leading-snug text-gray-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {/* Tickets */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-28">
        <h2 className="display text-[2rem] sm:text-6xl">Csak egy járat indul.</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-gray-400">Nincs pótjárat, nincs második gép. Aki lemarad, a földön marad.</p>
        <Link to="/jegyek" className="btn-primary mt-6">
          {fromLabel(pricing)}
        </Link>
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
