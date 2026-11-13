import React from 'react';
import { Link } from 'react-router-dom';
import { usePricing, huf } from '../lib/usePricing';

const PERKS = [
  { title: 'Soron kívüli belépés', desc: 'Külön VIP bejárat, várakozás nélkül.' },
  { title: 'Welcome drink', desc: 'Egy pohár pezsgő vagy welcome koktél érkezéskor.' },
  { title: 'Saját tér', desc: 'Kanapék, asztalok, nyugodtabb sarok – a buli közepén.' },
  { title: 'Saját pult', desc: 'Külön VIP ruhatár és saját pultszemélyzet.' },
];

export default function VipSection() {
  const { vip } = usePricing();
  return (
    <section className="mx-auto max-w-5xl px-5 pb-8">
      <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
        {PERKS.map((p) => (
          <div key={p.title} className="bg-[#05030a] p-8 sm:p-10">
            <h3 className="text-xl font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-400">{p.desc}</p>
          </div>
        ))}
      </div>

      {vip && (
        <div className="mt-16 text-center">
          <div className="kicker">VIP Lounge jegy</div>
          <div className="display mt-4 text-5xl sm:text-6xl">{huf(vip.price_huf)}</div>
          <p className="mt-3 text-gray-400">fő / bruttó, e-számlával</p>
          <Link to="/jegyek" className="btn-primary mt-8">
            VIP jegyet veszek
          </Link>
        </div>
      )}
    </section>
  );
}
