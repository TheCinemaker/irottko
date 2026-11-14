import React from 'react';
import PageShell from '../components/PageShell';
import BarTiles from '../components/BarTiles';
import { UtensilsCrossed } from 'lucide-react';
import { KITCHEN } from '../data/eventData';

// /barok — overview. Each bar has its own page with its own film and menu.
export default function BarsPage() {
  return (
    <PageShell>
      <header className="mx-auto max-w-4xl px-5 pb-14 pt-32 text-center sm:pb-20 sm:pt-40">
        <div className="kicker">Bárok · Fedélzeti ellátás</div>
        {/* one line on every screen */}
        <h1 className="display mt-4 whitespace-nowrap text-[clamp(1.6rem,8vw,4.5rem)]">Válassz kaput.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-400 sm:text-xl">
          Koktélbár, borbár, sörbár és VIP pezsgőbár – és egy konyha a 90-es évek ízeivel.
        </p>
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-28">
        <BarTiles />

        {/* Kitchen – not a bar, so no film and no menu yet; same wayfinding sign */}
        <div className="mt-4 overflow-hidden rounded-[6px] border border-white/10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(212,175,55,0.16),transparent_60%)]">
          <div className="flex items-center gap-3 border-b border-white/10 bg-[#05030a]/80 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
              <UtensilsCrossed className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">{KITCHEN.name}</span>
          </div>
          <div className="p-7 sm:p-10">
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">90-es évek. Diszkófalatok.</h3>
            <p className="mt-2 max-w-xl text-[15px] text-gray-300">{KITCHEN.shortDesc}</p>
            <p className="mt-3 text-[13px] text-gray-500">{KITCHEN.note}</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
