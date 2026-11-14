import React, { useEffect, useState } from 'react';
import { usePricing } from '../lib/usePricing';
import TicketButton from './TicketButton';
import { EVENT_DETAILS } from '../data/eventData';

/*
  Opening screen. When the hero film arrives, put it at public/hero.mp4
  (and optionally public/hero-portrait.mp4 for phones) and set HERO_VIDEO.
  It autoplays muted and loops — no scroll needed for something to happen.
*/
const HERO_VIDEO = null; // e.g. { landscape: '/hero.mp4', portrait: '/hero-portrait.mp4' }
const HERO_POSTER = '/hero.jpg';

function useDaysLeft() {
  const calc = () => Math.max(0, Math.ceil((new Date(EVENT_DETAILS.isoDate).getTime() - Date.now()) / 86400000));
  const [d, setD] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setD(calc()), 60000);
    return () => clearInterval(id);
  }, []);
  return d;
}

export default function HeroSection() {
  const pricing = usePricing();
  const days = useDaysLeft();
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  const videoSrc = HERO_VIDEO ? (portrait && HERO_VIDEO.portrait) || HERO_VIDEO.landscape : null;

  return (
    <section className="relative flex h-[100svh] min-h-[560px] items-end overflow-hidden">
      {videoSrc ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={videoSrc} poster={HERO_POSTER} autoPlay muted loop playsInline />
      ) : (
        <img className="absolute inset-0 h-full w-full object-cover" src={HERO_POSTER} alt="" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05030a] via-[#05030a]/55 to-[#05030a]/30" />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-[calc(var(--tabbar,0px)+10svh)] text-center sm:pb-[16vh]">
        <div className="kicker text-[13px] font-bold text-[#f3d77a] underline decoration-[#d4af37] decoration-2 underline-offset-[8px] [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">2027. január 15. · Kőszeg</div>
        <h1 className="display mt-5 text-[2.9rem] sm:text-8xl">
          One Night
          <span className="block pt-[0.06em] text-[#d4af37]">at Írottkő</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-gray-300 sm:text-xl">Csak egy járat indul! Négy fellépő, három bár a fedélzeten.</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <TicketButton pricing={pricing} />
        </div>

        {days > 0 && (
          <div className="mx-auto mt-4 flex w-full max-w-xs items-stretch overflow-hidden rounded-[4px] border border-white/15 bg-[#05030a]/70 backdrop-blur-md sm:w-[22rem] sm:max-w-none">
            <BoardCell label="Gate open" value={EVENT_DETAILS.doorsOpen} />
            <span className="w-px border-l border-dashed border-white/15" />
            <BoardCell label="Indulásig" value={String(days)} unit="nap" delay={4} />
          </div>
        )}
      </div>
    </section>
  );
}

/* A cell of the mini departures board: label + split-flap tiles (same look as
   the line-up board, smaller). Tiles flip in one after another on load. */
function BoardCell({ label, value, unit, delay = 0 }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 px-3 py-2.5">
      <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-white">{label}</span>
      <span className="flex items-center gap-[3px]" aria-label={`${value}${unit ? ` ${unit}` : ''}`}>
        {[...value].map((ch, i) =>
          ch === ':' ? (
            <span key={i} className="px-[1px] text-[14px] font-bold text-[#d4af37]" aria-hidden="true">:</span>
          ) : (
            <span
              key={i}
              aria-hidden="true"
              className="flap flap-in relative inline-flex h-[26px] w-[18px] items-center justify-center rounded-[3px] bg-[#16121f] font-mono text-[15px] font-bold text-[#f3d77a]"
              style={{ animationDelay: `${(delay + i) * 90}ms` }}
            >
              {ch}
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/35" />
            </span>
          )
        )}
        {unit && <span className="ml-1.5 text-[12px] font-semibold uppercase tracking-[0.15em] text-gray-300" aria-hidden="true">{unit}</span>}
      </span>
    </div>
  );
}
