import React from 'react';
import { Link } from 'react-router-dom';
import { EVENT_DETAILS } from '../data/eventData';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#05030a] text-[13px] text-gray-500">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <div className="font-cinzel text-[15px] font-bold tracking-[0.12em] text-white">ONE NIGHT AT ÍROTTKŐ</div>
            <p className="mt-2 leading-relaxed">
              {EVENT_DETAILS.dateString} · Kapunyitás {EVENT_DETAILS.doorsOpen}
              <br />
              {EVENT_DETAILS.venue} · {EVENT_DETAILS.address}
            </p>
          </div>
          <nav className="flex gap-6 sm:gap-8">
            <Link to="/lineup" className="hover:text-white">Line-up</Link>
            <Link to="/barok" className="hover:text-white">Bárok</Link>
            <Link to="/vip" className="hover:text-white">VIP</Link>
            <Link to="/jegyek" className="hover:text-white">Jegyek</Link>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/[0.06] pt-6 sm:flex-row sm:justify-between">
          <span>© 2027 Hotel Írottkő</span>
          <span>Korhatár: 18+</span>
        </div>
      </div>
    </footer>
  );
}
