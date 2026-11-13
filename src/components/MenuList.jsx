import React from 'react';

// One bar's drinks as a clean price list. Items without a price are hidden
// until the client confirms one.
// `bare`: the page already has a header for this bar -> list only, no heading.
export default function MenuList({ bar, title = 'Itallap', bare = false }) {
  const items = bar.items.filter((i) => i.price);
  return (
    <section id="itallap" className={`mx-auto max-w-3xl scroll-mt-20 px-5 ${bare ? 'pb-24 sm:pb-32' : 'py-24 sm:py-32'}`}>
      {!bare && (
        <div className="mb-14 text-center">
          <div className="kicker">{bar.name}</div>
          <h2 className="display mt-4 text-4xl sm:text-6xl">{title}</h2>
          {bar.location && <p className="mt-4 text-gray-400">{bar.location}</p>}
        </div>
      )}
      {items.length === 0 ? (
        <p className="border-y border-white/[0.08] py-8 text-center text-[15px] text-gray-400">
          Az itallapot hamarosan közzétesszük{bar.operator ? ` – a ${bar.operator.split(',')[0]} kínálatával` : ''}.
        </p>
      ) : (
      <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {items.map((item) => (
          <li key={item.name} className="flex items-baseline justify-between gap-6 py-5">
            <div className="min-w-0">
              <div className="text-[17px] font-medium text-white">{item.name}</div>
              {item.badge && <div className="mt-1 text-[13px] text-gray-500">{item.badge}</div>}
            </div>
            <div className="shrink-0 whitespace-nowrap text-[17px] font-semibold text-white">{item.price}</div>
          </li>
        ))}
      </ul>
      )}
      <p className="mt-6 text-center text-[13px] text-gray-500">Fizetés kártyával és készpénzzel.</p>
    </section>
  );
}
