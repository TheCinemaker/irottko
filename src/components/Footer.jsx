import React from 'react';
import { Link } from 'react-router-dom';

// Compact footer: no menu (phones have the tab bar, desktop the top bar).
// Always keeps the copyright line and the SA Software maker's mark.
const MAIL = 'mailto:sasoftandnet@gmail.com?subject=Ilyen%20oldalt%20szeretn%C3%A9k';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#05030a] text-[12px] leading-relaxed text-gray-500">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-cinzel text-[13px] font-bold tracking-[0.12em] text-gray-300">ONE NIGHT AT ÍROTTKŐ</span>
          <span className="text-gray-600"> · 2027. január 15. · Hotel Írottkő, Kőszeg</span>
        </div>
        <nav className="flex gap-x-4">
          <Link to="/aszf" className="hover:text-white">ÁSZF</Link>
          <Link to="/adatkezeles" className="hover:text-white">Adatkezelés</Link>
          <Link to="/impresszum" className="hover:text-white">Impresszum</Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-1 border-t border-white/[0.06] px-5 py-4 text-[11px] text-gray-600 sm:flex-row sm:justify-between">
        <span>© 2026–2027 IROTTKŐ HOTEL Kft. · Minden jog fenntartva · 18+</span>
        <span>
          Designed &amp; built by{' '}
          <a href={MAIL} className="font-semibold text-gray-400 hover:text-white">
            SA Software <span className="text-[#d4af37]">&amp;</span> Network Solutions
          </a>{' '}
          ·{' '}
          <a href={MAIL} className="text-[#d4af37]/80 hover:underline">
            Kell egy ilyen?
          </a>
        </span>
      </div>
    </footer>
  );
}
