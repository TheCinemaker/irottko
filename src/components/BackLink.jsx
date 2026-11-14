import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// "‹ Back" at the top of a sub-page (bar pages, VIP) – phones have no visible
// back button in the app-like layout.
export default function BackLink({ to, label }) {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-20 sm:pt-24">
      <Link
        to={to}
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/10 bg-[#0b0812] py-2 pl-2 pr-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-gray-300 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4 text-[#d4af37]" />
        {label}
      </Link>
    </div>
  );
}
