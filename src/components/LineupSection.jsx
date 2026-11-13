import React from 'react';
import { DJS } from '../data/eventData';

// Running order of the night, in time order. The headliner gets the big type.
export default function LineupSection() {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-28">
      <ol className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {DJS.map((dj) => (
          <li key={dj.id} className="grid gap-2 py-10 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-10 sm:py-14">
            <div className="text-[15px] font-medium tabular-nums text-gray-500">{dj.time}</div>
            <div>
              {dj.headliner && <div className="kicker">Headliner</div>}
              <h2 className={`display ${dj.headliner ? 'mt-3 text-5xl text-[#d4af37] sm:text-7xl' : 'text-4xl sm:text-5xl'}`}>{dj.name}</h2>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
