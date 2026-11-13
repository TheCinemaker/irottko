import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import HeroSection from '../components/HeroSection';
import BarTiles from '../components/BarTiles';
import { usePricing, fromLabel } from '../lib/usePricing';
import { DJS, INFO, KITCHEN } from '../data/eventData';

export default function HomePage() {
  const pricing = usePricing();
  const headliner = DJS.find((d) => d.headliner) || DJS[0];
  const others = DJS.filter((d) => d !== headliner);

  return (
    <PageShell>
      <HeroSection />

      {/* Line-up */}
      <section className="mx-auto max-w-4xl px-5 py-28 text-center sm:py-36">
        <div className="kicker">Line-up</div>
        <h2 className="artist mt-4 text-[3.25rem] text-[#d4af37] sm:text-7xl">{headliner.name}</h2>
        <p className="mt-5 text-lg text-gray-400 sm:text-xl">
          és {others.map((d) => d.name).join(', ')} – 19:00-tól hajnalig.
        </p>
        <Link to="/lineup" className="link-more mt-8">
          A teljes line-up <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Bars */}
      <section className="mx-auto max-w-6xl px-5 pb-28 sm:pb-36">
        <div className="mb-10 text-center">
          <div className="kicker">Bárok</div>
          <h2 className="display mt-4 text-4xl sm:text-6xl">Három bár. Minden ízlésre.</h2>
        </div>
        <BarTiles />
      </section>

      {/* VIP */}
      <section className="relative overflow-hidden">
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05030a] via-[#05030a]/40 to-[#05030a]" />
        <div className="relative mx-auto max-w-4xl px-5 py-36 text-center sm:py-48">
          <div className="kicker">VIP Lounge</div>
          <h2 className="display mt-4 text-4xl sm:text-6xl">A legjobb hely a házban.</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-gray-300">Soron kívüli belépés, welcome drink és saját pult.</p>
          <Link to="/vip" className="link-more mt-8">
            VIP részletek <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Practical info – like the "details" screen of an event app */}
      <section className="mx-auto max-w-3xl px-5 pt-28 sm:pt-36">
        <div className="mb-8 text-center">
          <div className="kicker">Tudnivalók</div>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Amit tudni érdemes.</h2>
        </div>
        <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {[...INFO, { label: KITCHEN.name, value: KITCHEN.shortDesc }].map((row) => (
            <div key={row.label} className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-8">
              <dt className="text-[13px] font-medium uppercase tracking-[0.15em] text-[#d4af37]">{row.label}</dt>
              <dd className="text-[16px] leading-relaxed text-gray-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Tickets */}
      <section className="mx-auto max-w-4xl px-5 py-28 text-center sm:py-36">
        <h2 className="display text-4xl sm:text-6xl">Egy éjszaka. Ne maradj le.</h2>
        <Link to="/jegyek" className="btn-primary mt-10">
          {fromLabel(pricing)}
        </Link>
      </section>
    </PageShell>
  );
}
