import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import BarTiles from '../components/BarTiles';
import { KITCHEN } from '../data/eventData';

// /barok — overview. Each bar has its own page with its own film and menu.
export default function BarsPage() {
  return (
    <PageShell>
      <PageHeader kicker="Bárok · Fedélzeti ellátás" title="Válassz pultot.">
        Koktélbár, borbár, sörbár és VIP pezsgőbár – és egy konyha a 90-es évek ízeivel.
      </PageHeader>
      <div className="mx-auto max-w-6xl px-5 pb-28">
        <BarTiles />

        {/* Kitchen – not a bar, so no film and no menu yet */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(212,175,55,0.16),transparent_60%)] p-7 sm:p-10">
          <div className="kicker">{KITCHEN.name}</div>
          <h3 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">90-es évek. Diszkófalatok.</h3>
          <p className="mt-2 max-w-xl text-[15px] text-gray-300">{KITCHEN.shortDesc}</p>
          <p className="mt-3 text-[13px] text-gray-500">{KITCHEN.note}</p>
        </div>
      </div>
    </PageShell>
  );
}
