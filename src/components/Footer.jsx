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
          <span>© 2026–2027 IROTTKŐ HOTEL Kft. · Minden jog fenntartva · 18+</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/aszf" className="hover:text-white">ÁSZF</Link>
            <Link to="/adatkezeles" className="hover:text-white">Adatkezelés</Link>
            <Link to="/impresszum" className="hover:text-white">Impresszum</Link>
          </nav>
        </div>

        {/* Maker's mark */}
        <div className="mt-8 flex flex-col items-center gap-1.5 border-t border-white/[0.06] pt-8 text-center">
          <span className="text-[11px] uppercase tracking-[0.3em] text-gray-600">Designed &amp; built by</span>
          <a
            href="mailto:sasoftandnet@gmail.com?subject=Ilyen%20oldalt%20szeretn%C3%A9k"
            className="group text-[15px] font-semibold tracking-wide text-gray-300 transition-colors hover:text-white"
          >
            SA Software <span className="text-[#d4af37]">&amp;</span> Network Solutions
          </a>
          <span className="text-[12px] text-gray-600">
            Fizetés, számla, Wallet-jegy és beléptetés egy rendszerben. Kőszegen kódolva.{' '}
            <a
              href="mailto:sasoftandnet@gmail.com?subject=Ilyen%20oldalt%20szeretn%C3%A9k"
              className="text-[#d4af37]/80 underline-offset-4 hover:underline"
            >
              Kell egy ilyen?
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
