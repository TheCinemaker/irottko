import React from 'react';
import { Link, NavLink } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/lineup', label: 'Line-up' },
  { to: '/barok', label: 'Bárok' },
  { to: '/vip', label: 'VIP' },
  { to: '/jegyek', label: 'Jegyek' },
];

// Top bar. Phones: just the name (navigation is the bottom TabBar).
// Desktop: links + ticket button.
export default function Navbar() {
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

        <Link to="/jegyek" className="hidden rounded-full bg-[#d4af37] px-4 py-1.5 text-[13px] font-semibold text-black transition-colors hover:bg-[#e3c45c] md:inline-flex">
          Jegyet veszek
        </Link>
      </div>
    </header>
  );
}
