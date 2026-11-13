import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import HeroSection from '../components/HeroSection';
import BarTiles from '../components/BarTiles';
import { usePricing, fromLabel } from '../lib/usePricing';
import { DJS } from '../data/eventData';

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
        <h2 className="display mt-4 text-5xl sm:text-7xl">{headliner.name}</h2>
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
          <h2 className="display mt-4 text-4xl sm:text-6xl">A legjobb hely a galérián.</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-gray-300">Soron kívüli belépés, welcome drink, saját pult és kilátás a táncparkettre.</p>
          <Link to="/vip" className="link-more mt-8">
            VIP részletek <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
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
