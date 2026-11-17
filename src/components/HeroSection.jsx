import React, { useEffect, useState } from 'react';
import { usePricing } from '../lib/usePricing';
import TicketButton from './TicketButton';
import { EVENT_DETAILS, DJS } from '../data/eventData';
import { useOnAir, SLOTS } from '../lib/onAir';
import { Plane } from 'lucide-react';

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

        {pricing.status === 'soon' && pricing.opensAt ? (
          <OpeningCountdown opensAt={pricing.opensAt} />
        ) : (
          days > 0 && (
            <div className="mx-auto mt-4 flex w-full max-w-xs items-stretch overflow-hidden rounded-[4px] border border-white/15 bg-[#05030a]/70 backdrop-blur-md sm:w-[22rem] sm:max-w-none">
              <BoardCell label="Gate open" value={EVENT_DETAILS.doorsOpen} />
              <span className="w-px border-l border-dashed border-white/15" />
              <BoardCell label="Indulásig" value={String(days)} unit="nap" delay={4} />
            </div>
          )
        )}
        <FlightProgress />
        <FlightStatus pricing={pricing} />
      </div>
    </section>
  );
}

/* Before sales open: "Check-in nyílik" with days / hours / minutes on the
   split-flap cells, ticking every 20 s. Goes away by itself when sales open
   (usePricing switches from 'soon' to 'open'). */
function OpeningCountdown({ opensAt }) {
  const left = () => Math.max(0, new Date(opensAt).getTime() - Date.now());
  const [ms, setMs] = useState(left);
  useEffect(() => {
    const id = setInterval(() => setMs(left()), 20000);
    return () => clearInterval(id);
  }, [opensAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const two = (n) => String(n).padStart(2, '0');
  return (
    <div className="mx-auto mt-4 w-full max-w-xs overflow-hidden rounded-[4px] border border-white/15 bg-[#05030a]/70 backdrop-blur-md sm:w-[22rem] sm:max-w-none">
      <div className="border-b border-dashed border-white/15 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-[#f3d77a]">Check-in nyílik</div>
      <div className="flex items-stretch">
        <BoardCell label="Nap" value={String(d)} />
        <span className="w-px border-l border-dashed border-white/15" />
        <BoardCell label="Óra" value={two(h)} delay={2} />
        <span className="w-px border-l border-dashed border-white/15" />
        <BoardCell label="Perc" value={two(m)} delay={4} />
      </div>
    </div>
  );
}

/* The event night: the flight KSZ ✈ ÍRK with the plane moving along as the
   night goes on (gate open → end of the last set), and the flight time so far.
   Only between gate open and the end; the same times as the departures board. */
function FlightProgress() {
  const onAir = useOnAir();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const from = new Date(EVENT_DETAILS.isoDate).getTime();
  const to = SLOTS[SLOTS.length - 1].end.getTime();
  if (now < from || now >= to) return null;
  const p = (now - from) / (to - from);
  const min = Math.floor((now - from) / 60000);
  return (
    <div className="mx-auto mt-4 w-full max-w-xs rounded-[4px] border border-white/15 bg-[#05030a]/70 px-4 py-3 backdrop-blur-md sm:w-[22rem] sm:max-w-none">
      <div className="flex items-center justify-between font-mono text-[12px] font-bold tracking-[0.15em] text-white">
        <span>KSZ</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3d77a]">ÍR 0115 · In flight</span>
        <span>ÍRK</span>
      </div>
      <div className="relative mt-2 h-4">
        <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-white/25" />
        <div className="absolute left-0 top-1/2 h-[2px] -translate-y-[1px] bg-[#d4af37]" style={{ width: `${p * 100}%` }} />
        <Plane className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 text-[#f3d77a]" style={{ left: `${p * 100}%` }} fill="currentColor" />
      </div>
      <div className="mt-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-gray-300">
        Repülési idő: {Math.floor(min / 60)} ó {String(min % 60).padStart(2, '0')} p
      </div>
      {onAir >= 0 && (
        <div className="mt-1.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-[#f3d77a]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Most a fedélzeten: {DJS[onAir].name}
        </div>
      )}
    </div>
  );
}

/* Flight status line under the board, from live data (usePricing / onAir):
   "ÍR 0115 · ● CHECK-IN NYITVA". Nothing while loading. */
const STATUS_LINE = {
  open: ['Check-in nyitva', 'bg-emerald-400'],
  soon: ['Check-in hamarosan', 'bg-amber-400'],
  between: ['Check-in a gate-nél, 19:00-tól', 'bg-amber-400'],
  full: ['Telt ház', 'bg-red-500'],
  closed: ['Check-in zárva', 'bg-red-500'],
};
function FlightStatus({ pricing }) {
  const onAir = useOnAir();
  // on the event night the flight-progress box shows who is playing
  const [text, dot] = onAir >= 0 ? [] : STATUS_LINE[pricing.status] || [];
  if (!text) return null;
  return (
    <div
      className="mx-auto mt-3 flex w-full max-w-xs items-center justify-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] sm:w-[22rem] sm:max-w-none"
      aria-live="polite"
    >
      <span className="text-[#f3d77a]">ÍR 0115</span>
      <span className="text-gray-500">·</span>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none ${dot}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="truncate">{text}</span>
    </div>
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
