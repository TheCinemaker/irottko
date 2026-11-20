import React, { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { usePricing } from '../lib/usePricing';

const NAV_LINKS = [
  { to: '/lineup', label: 'Menetrend' },
  { to: '/barok', label: 'Bárok' },
  { to: '/vip', label: 'VIP' },
  { to: '/jegyek', label: 'Jegyek' },
];

// The announcement strip's height → <html style="--ann-h">, so the page (PageShell)
// and the scroll offsets move down by exactly that much; 0px without a strip.
function useAnnouncementHeight(ref, on) {
  useEffect(() => {
    const root = document.documentElement.style;
    const el = ref.current;
    if (!on || !el) {
      root.setProperty('--ann-h', '0px');
      return undefined;
    }
    const set = () => root.setProperty('--ann-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    window.addEventListener('resize', set);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', set);
      root.setProperty('--ann-h', '0px');
    };
  }, [ref, on]);
}

/** Current announcement strip height in px (for JS scroll offsets). */
export const announcementHeight = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ann-h')) || 0;

// Top bar. Phones: just the name (navigation is the bottom TabBar).
// Desktop: links + ticket button.
export default function Navbar() {
  const { announcement } = usePricing();
  const strip = useRef(null);
  useAnnouncementHeight(strip, Boolean(announcement));
  const linkClass = ({ isActive }) =>
    `text-[13px] tracking-wide transition-colors ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#05030a]/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-center px-5 md:h-14 md:justify-between">
        <Link to="/" className="font-cinzel text-[15px] font-bold tracking-[0.12em] text-white whitespace-nowrap">
          ONE NIGHT <span className="font-sans text-[11px] font-normal italic tracking-normal text-[#d4af37]">at</span> ÍROTTKŐ
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <Link to="/jegyek" className="hidden rounded-[4px] bg-[#d4af37] px-4 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-[#e3c45c] md:inline-flex">
          Check-in
        </Link>
      </div>
      {/* "Utastájékoztatás" – a line the admin writes; live on every page */}
      {announcement && (
        <div ref={strip} className="border-t border-[#d4af37]/30 bg-[#d4af37]/[0.12] px-4 py-1.5 text-center text-[12px] font-semibold leading-snug text-[#f3d77a]" role="status">
          <Megaphone className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />
          <span className="uppercase tracking-[0.18em] text-[#d4af37]">Utastájékoztatás:</span> {announcement}
        </div>
      )}
    </header>
  );
}
