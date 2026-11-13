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

  return (
    <PageShell>
      <HeroSection />

      {/* Line-up – compact running order */}
      <section className="mx-auto max-w-3xl px-5 pt-16 sm:pt-28">
        <SectionHead kicker="Line-up" title="Négy fellépő." to="/lineup" more="Részletek" />
        <ol className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {DJS.map((dj) => (
            <li key={dj.id} className="flex items-baseline justify-between gap-4 py-3.5">
              <span className={`artist ${dj.headliner ? 'text-[1.6rem] text-[#d4af37]' : 'text-[1.25rem]'}`}>{dj.name}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-gray-500">{dj.time}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Bars – one swipeable row */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-28">
        <SectionHead kicker="Bárok" title="Három bár. Minden ízlésre." to="/barok" more="Mind" />
        <BarTiles carousel />
      </section>

      {/* VIP */}
      <section className="relative mt-16 overflow-hidden sm:mt-28">
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05030a] via-[#05030a]/40 to-[#05030a]" />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:py-32">
          <div className="kicker">VIP Lounge</div>
          <h2 className="display mt-3 text-[2rem] sm:text-6xl">A legjobb hely a házban.</h2>
          <p className="mx-auto mt-3 max-w-lg text-[16px] text-gray-300">Soron kívüli belépés, welcome drink és saját pult.</p>
          <Link to="/vip" className="link-more mt-5">
            VIP részletek <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Practical info */}
      <section className="mx-auto max-w-3xl px-5 pt-12 sm:pt-20">
        <SectionHead kicker="Tudnivalók" title="Amit tudni érdemes." />
        <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {[...INFO, { label: KITCHEN.name, value: KITCHEN.shortDesc }].map((row) => (
            <div key={row.label} className="grid grid-cols-[96px_1fr] gap-3 py-3.5 sm:grid-cols-[150px_1fr] sm:gap-8">
              <dt className="pt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#d4af37]">{row.label}</dt>
              <dd className="text-[15px] leading-snug text-gray-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Tickets */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-28">
        <h2 className="display text-[2rem] sm:text-6xl">Egy éjszaka. Ne maradj le.</h2>
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
