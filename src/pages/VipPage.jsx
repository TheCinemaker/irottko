import React from 'react';
import { Crown } from 'lucide-react';
import PageShell from '../components/PageShell';
import BackLink from '../components/BackLink';
import VipSection from '../components/VipSection';
import MenuList from '../components/MenuList';
import { BARS_DATA } from '../data/eventData';

export default function VipPage() {
  const vipBar = BARS_DATA.find((b) => b.slug === 'vip');
  return (
    <PageShell>
      <BackLink to="/barok" label="Bárok" />
      <header className="mx-auto max-w-3xl px-5 pb-10 pt-8 text-center sm:pt-12">
        <div className="mx-auto mb-6 inline-flex items-center gap-3 rounded-[4px] border border-[#d4af37]/40 bg-[#0b0812] py-2 pl-2 pr-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
            <Crown className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">
            Gate <span className="text-[#d4af37]">VIP</span>
          </span>
        </div>
        <div className="kicker">VIP Lounge</div>
        <h1 className="display mt-4 whitespace-nowrap text-[clamp(2rem,10vw,4.5rem)]">Business class.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">Ugyanaz a járat, egy osztállyal feljebb.</p>
      </header>
      <VipSection />
      {vipBar && <MenuList bar={vipBar} title="Pezsgőbár" />}
    </PageShell>
  );
}
