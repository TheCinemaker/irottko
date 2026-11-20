import React, { useEffect, useRef, useState } from 'react';
import { PlaneTakeoff, PlaneLanding, ArrowRight } from 'lucide-react';
import PageShell from '../components/PageShell';
import TicketButton from '../components/TicketButton';
import { Flap, STATUS, PHASE, OnAirTag } from '../components/LineupBoard';
import { useOnAir } from '../lib/onAir';
import { DJS } from '../data/eventData';
import { usePricing } from '../lib/usePricing';

/*
  Line-up page: the night as one flight. Each act is a small boarding pass
  (split-flap times, phase, perforated edge) on a dashed flight path that runs
  from take-off to landing. Static – no blinking (the user's call).
*/

// "19:00 – 22:00" → ['19:00', '22:00'];  "01:00-tól" → ['01:00', null]
const times = (t) => {
  const m = t.match(/(\d{2}:\d{2})(?:\s*[–-]\s*(\d{2}:\d{2}))?/);
  return m ? [m[1], m[2] || null] : [t, null];
};

function useOnce(ref) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return setOn(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

function FlightCard({ dj, i }) {
  const ref = useRef(null);
  const on = useOnce(ref);
  const [from, to] = times(dj.time);
  const gold = dj.headliner;
  const onAir = useOnAir(); // event night: the act playing now
  const { Icon } = PHASE[i] || {};
  return (
    <li ref={ref} className="relative pl-10">
      {/* waypoint on the flight path */}
      <span className={`absolute left-[11px] top-8 h-3 w-3 rounded-full border-2 ${gold ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[#d4af37] bg-[#05030a]'}`} />
      <div
        className={`relative overflow-hidden rounded-[6px] border bg-[#0b0812] ${
          gold ? 'border-[#d4af37]/70 bg-[linear-gradient(135deg,rgba(212,175,55,0.16),rgba(212,175,55,0.03)_60%)]' : 'border-white/10'
        }`}
      >
        {gold && (
          <span className="absolute right-0 top-0 rounded-bl-[6px] bg-[#d4af37] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#05030a]">
            Headliner
          </span>
        )}
        <div className="px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">
            {Icon && <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
            {STATUS[i]}
            {onAir === i && <span className="ml-auto normal-case tracking-normal"><OnAirTag /></span>}
          </div>
          <h2 className={`artist mt-2 break-words ${gold ? 'text-[2rem] text-[#d4af37]' : 'text-[1.75rem] text-white'}`}>{dj.name}</h2>
        </div>
        {/* perforation */}
        <div className="relative border-t-2 border-dashed border-white/10">
          <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[#05030a]" />
          <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[#05030a]" />
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="sr-only">{dj.time}</span>
          <Flap chars={from} on={on} delay={i * 120} small />
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          {to ? (
            <Flap chars={to} on={on} delay={i * 120 + 300} small />
          ) : (
            <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-gray-300">Hajnalig</span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function LineupPage() {
  const pricing = usePricing();
  return (
    <PageShell>
      <header className="mx-auto max-w-3xl px-5 pb-10 pt-32 text-center sm:pt-40">
        <div className="kicker">
          Line-up · Járat <span className="whitespace-nowrap font-mono font-bold tracking-[0.12em] text-white">ÍR 0115</span>
        </div>
        <h1 className="display mt-4 text-[2.6rem] leading-[1.05] sm:text-7xl">
          Fedélzeti <span className="text-[#d4af37]">menetrend</span>
        </h1>
        <p className="mt-4 text-[15px] font-semibold uppercase tracking-[0.18em] text-gray-300">
          Boarding 19:00 · Landing hajnalban
        </p>
      </header>

      <section className="mx-auto max-w-xl px-5 pb-16">
        <div className="relative">
          {/* the flight path */}
          <span className="absolute bottom-10 left-[16px] top-10 border-l-2 border-dashed border-[#d4af37]/45" aria-hidden="true" />
          <div className="relative mb-4 flex items-center gap-3 pl-[5px] text-[12px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]">
              <PlaneTakeoff className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            Felszállás · Kőszeg
          </div>
          <ol className="space-y-5">
            {DJS.map((dj, i) => (
              <FlightCard key={dj.id} dj={dj} i={i} />
            ))}
          </ol>
          <div className="relative mt-4 flex items-center gap-3 pl-[5px] text-[12px] font-bold uppercase tracking-[0.2em] text-gray-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]">
              <PlaneLanding className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            Leszállás · hajnalban
          </div>
        </div>

        <div className="mt-14 text-center">
          <TicketButton pricing={pricing} className="mx-auto" />
        </div>
      </section>
    </PageShell>
  );
}
