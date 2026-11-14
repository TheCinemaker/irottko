import { Link } from 'react-router-dom';
import { fromPrice, huf } from '../lib/usePricing';

/*
  The main call to action, shaped like a small boarding pass: the gold part
  is the button, and after a perforation a lighter stub carries the price.
  Glass look: translucent gold + backdrop blur, so the photo shows through.
  Without a price (pricing not loaded / sales closed) it is a plain gold tab.
*/
export default function TicketButton({ pricing, label = 'Beszállókártya', to = '/jegyek', className = '' }) {
  const price = fromPrice(pricing);
  return (
    <Link
      to={to}
      className={`group flex h-14 w-full max-w-xs overflow-hidden rounded-[4px] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_0_0_1px_rgba(255,240,200,0.35),0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl backdrop-saturate-150 transition-transform duration-150 active:scale-[0.97] sm:w-[22rem] sm:max-w-none ${className}`}
    >
      {/* glass: translucent gold over the blurred photo, a light top edge */}
      <span className="flex flex-1 items-center justify-center bg-gradient-to-b from-[#f3d36b]/85 via-[#d4af37]/70 to-[#c9a227]/70 px-4 text-[15px] font-bold transition-[filter] group-hover:brightness-110">
        {label}
      </span>
      {price != null && (
        <span className="flex w-[6.5rem] shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-[#05030a]/35 bg-gradient-to-b from-[#fff1c4]/80 to-[#ead18a]/60">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70">ár-tól</span>
          <span className="text-[15px] font-bold leading-tight">{huf(price)}</span>
        </span>
      )}
    </Link>
  );
}
