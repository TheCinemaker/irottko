import React from 'react';
import { Link } from 'react-router-dom';

// Compact footer: no menu (phones have the tab bar, desktop the top bar).
// Always keeps the copyright line and the SA Software maker's mark.
const MAIL = 'mailto:sasoftandnet@gmail.com?subject=Ilyen%20oldalt%20szeretn%C3%A9k';

export default function Footer() {
  // Slim: three short centred lines. The copyright and the SA Software mark
  // always stay (client rule); the event name/date line was dropped – it is
  // on every page already.
  return (
    <footer className="border-t border-white/[0.06] bg-[#05030a] px-5 py-4 text-center text-[11px] leading-[1.7] text-gray-600">
      <nav className="flex justify-center gap-x-4 text-[12px] text-gray-500">
        <Link to="/aszf" className="hover:text-white">ÁSZF</Link>
        <Link to="/adatkezeles" className="hover:text-white">Adatkezelés</Link>
        <Link to="/impresszum" className="hover:text-white">Impresszum</Link>
      </nav>
      <div>© 2026–2027 IROTTKŐ HOTEL Kft. · Minden jog fenntartva · 18+</div>
      <div>
        Designed &amp; built by{' '}
        <a href={MAIL} className="font-semibold text-gray-400 underline-offset-2 hover:text-white hover:underline">
          SA Software <span className="text-[#d4af37]">&amp;</span> Network Solutions
        </a>
      </div>
    </footer>
  );
}
