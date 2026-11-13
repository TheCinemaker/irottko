import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { to: '/lineup', label: 'Line-up' },
  { to: '/barok', label: 'Bárok' },
  { to: '/vip', label: 'VIP' },
  { to: '/jegyek', label: 'Jegyek' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const linkClass = ({ isActive }) =>
    `text-[13px] tracking-wide transition-colors ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#05030a]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
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

        <button onClick={() => setOpen(!open)} className="-mr-2 p-2 text-gray-300 md:hidden" aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-14 bottom-0 bg-[#05030a] px-8 pt-8 md:hidden">
          <nav className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="border-b border-white/[0.06] py-4 text-2xl font-semibold text-white">
                {l.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/jegyek" className="btn-primary mt-10 w-full">
            Jegyet veszek
          </Link>
        </div>
      )}
    </header>
  );
}
