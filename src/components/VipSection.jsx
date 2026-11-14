import React from 'react';
import { DoorOpen, Wine, Sofa, Shirt } from 'lucide-react';
import { usePricing } from '../lib/usePricing';
import TicketButton from './TicketButton';

// VIP perks (to be confirmed by the hotel – see TEENDOK.md: lounge vs. drinks only).
const PERKS = [
  { Icon: DoorOpen, title: 'Soron kívüli belépés', desc: 'Külön VIP bejárat, várakozás nélkül.' },
  { Icon: Wine, title: 'Welcome drink', desc: 'Egy pohár pezsgő vagy welcome koktél érkezéskor.' },
  { Icon: Sofa, title: 'Saját tér', desc: 'Kanapék, asztalok, nyugodtabb sarok – a buli közepén.' },
  { Icon: Shirt, title: 'Saját pult', desc: 'Külön VIP ruhatár és saját pultszemélyzet.' },
];

export default function VipSection() {
  const { vip } = usePricing();
  return (
    <section className="mx-auto max-w-3xl px-5 pb-8">
      <ul className="overflow-hidden rounded-[6px] border border-[#d4af37]/40 bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.02)_60%)]">
        {PERKS.map(({ Icon, title, desc }) => (
          <li key={title} className="flex gap-4 border-b border-white/[0.06] px-4 py-5 last:border-b-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[17px] font-semibold text-white">{title}</h3>
              <p className="mt-1 text-[15px] leading-snug text-gray-400">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {vip && (
        <div className="mt-14 text-center">
          <div className="kicker">Business · VIP Lounge</div>
          <p className="mt-2 text-[13px] text-gray-500">fő / bruttó, e-számlával</p>
          <TicketButton label="VIP beszállókártya" price={vip.price_huf} from={false} className="mx-auto mt-5" />
        </div>
      )}
    </section>
  );
}
