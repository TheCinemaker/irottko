import React from 'react';
import { DJS } from '../data/eventData';

// Running order of the night, in time order. The headliner gets the big type.
export default function LineupSection() {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-28">
      <ol className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {DJS.map((dj) => {
          const headliner = Boolean(dj.badge);
          return (
            <li key={dj.id} className="grid gap-3 py-10 sm:grid-cols-[160px_1fr] sm:gap-10 sm:py-14">
              <div className="text-[15px] font-medium tabular-nums text-gray-500">{dj.time}</div>
              <div>
                <div className="kicker">{headliner ? 'Headliner' : dj.role}</div>
                <h2 className={`display mt-3 ${headliner ? 'text-5xl text-[#d4af37] sm:text-7xl' : 'text-4xl sm:text-5xl'}`}>{dj.name}</h2>
                <div className="mt-3 text-[15px] text-gray-400">{dj.genre}</div>
                <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-gray-300">{dj.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
