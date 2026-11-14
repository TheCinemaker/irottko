import React from 'react';
import { Info, Wine } from 'lucide-react';
import { GATES } from './BarTiles';

// One bar's drinks as an in-flight menu card (airport mode). Items without a
// price are hidden until the client confirms one.
// `bare`: the page already has a header for this bar -> no big heading.
export default function MenuList({ bar, title = 'Itallap', bare = false }) {
  const Icon = GATES[bar.id]?.Icon || Wine;
  const items = bar.items.filter((i) => i.price);
  return (
    <section id="itallap" className={`mx-auto max-w-3xl scroll-mt-20 px-5 ${bare ? 'pb-20 sm:pb-28' : 'py-20 sm:py-28'}`}>
      {!bare && (
        <div className="mb-10 text-center">
          <div className="kicker">{bar.name}</div>
          <h2 className="display mt-4 text-4xl sm:text-6xl">{title}</h2>
          {bar.location && <p className="mt-4 text-gray-400">{bar.location}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-[6px] border border-white/10 bg-[#0b0812]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">{title}</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">Fedélzeti ellátás · {bar.name}</span>
          </span>
        </div>

        {items.length === 0 ? (
          <div className="flex items-start gap-3 px-4 py-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#d4af37]" aria-hidden="true" />
            <p className="text-[15px] leading-snug text-gray-300">
              Az itallapot hamarosan közzétesszük{bar.operator ? ` – a ${bar.operator.split(',')[0]} kínálatával` : ''}.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => (
              <li key={item.name} className="px-4 py-4">
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 text-[17px] font-semibold text-white">{item.name}</span>
                  {/* dotted leader, like a printed menu */}
                  <span className="mb-1 flex-1 border-b-2 border-dotted border-white/15" aria-hidden="true" />
                  <span className="shrink-0 whitespace-nowrap font-mono text-[16px] font-bold text-[#f3d77a]">{item.price}</span>
                </div>
                {item.badge && <div className="mt-1 text-[12px] uppercase tracking-[0.12em] text-gray-500">{item.badge}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-5 text-center text-[13px] text-gray-500">Fizetés kártyával és készpénzzel.</p>
    </section>
  );
}
