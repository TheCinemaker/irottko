import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePricing, fromLabel } from '../lib/usePricing';
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

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 text-center sm:pb-24">
        <div className="kicker">2027. január 15. · Kőszeg</div>
        <h1 className="display mt-5 text-[2.9rem] sm:text-8xl">
          One Night
          <span className="block pt-[0.06em] text-[#d4af37]">at Írottkő</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-gray-300 sm:text-xl">Csak egy járat indul! Négy fellépő, három bár a fedélzeten.</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/jegyek" className="btn-primary w-full max-w-xs sm:w-auto">
            {fromLabel(pricing)}
          </Link>
          <Link to="/lineup" className="link-more">
            Menetrend <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {days > 0 && (
          <div className="mt-10 text-[13px] text-gray-400">
            Gate open {EVENT_DETAILS.doorsOpen} · indulásig <span className="text-white">{days} nap</span>
          </div>
        )}
      </div>
    </section>
  );
}
