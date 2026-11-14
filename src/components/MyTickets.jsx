import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { X, Maximize2 } from 'lucide-react';
import { EVENT_DETAILS } from '../data/eventData';
import { getMyTickets, removeMyTicket } from '../lib/myTickets';

/*
  "Jegyem" – the tickets bought on this phone, as boarding-pass style cards.
  The QR is drawn in the browser (no network needed once the page is open).
  Tap a card → full-screen pass for the door.
*/
const dateHu = EVENT_DETAILS.dateString.replace(/\s*\(.*\)/, '');

function useQr(code, size) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(code, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [code, size]);
  return src;
}

function Pass({ t, onOpen }) {
  const qr = useQr(t.code, 360);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full overflow-hidden rounded-[6px] text-left transition-transform active:scale-[0.98] ${
        t.vip ? 'bg-[#d4af37] text-[#05030a]' : 'border border-white/10 bg-white/[0.05] text-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${t.vip ? 'text-[#05030a]/70' : 'text-[#d4af37]'}`}>
            {t.vip ? 'VIP Lounge' : t.tier}
          </div>
          <div className="mt-2 truncate text-2xl font-bold leading-tight">{t.name}</div>
          <div className={`mt-1 text-[13px] ${t.vip ? 'text-[#05030a]/70' : 'text-gray-400'}`}>
            {dateHu} · Gate open {EVENT_DETAILS.doorsOpen}
          </div>
        </div>
        <Maximize2 className="mt-1 h-5 w-5 shrink-0 opacity-60" />
      </div>
      {/* perforation */}
      <div className="relative flex items-center px-2">
        <span className="-ml-5 h-6 w-6 rounded-full bg-[#05030a]" />
        <span className={`mx-1 flex-1 border-t-2 border-dashed ${t.vip ? 'border-[#05030a]/25' : 'border-white/15'}`} />
        <span className="-mr-5 h-6 w-6 rounded-full bg-[#05030a]" />
      </div>
      <div className="flex items-center gap-5 p-6 pt-4">
        <div className="shrink-0 rounded-[4px] bg-white p-2">
          {qr ? <img src={qr} alt={`QR-kód: ${t.code}`} className="h-24 w-24" /> : <div className="h-24 w-24" />}
        </div>
        <div className="min-w-0">
          <div className={`text-[11px] uppercase tracking-[0.2em] ${t.vip ? 'text-[#05030a]/60' : 'text-gray-500'}`}>Jegykód</div>
          <div className="mt-1 break-all font-mono text-[14px] tracking-[0.12em]">{t.code}</div>
          <div className={`mt-2 text-[12px] ${t.vip ? 'text-[#05030a]/70' : 'text-gray-500'}`}>Érintsd meg a gate-nél a nagyításhoz.</div>
        </div>
      </div>
    </button>
  );
}

function FullPass({ t, onClose }) {
  const qr = useQr(t.code, 720);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Portal to <body>: the animated page wrapper must not become the
  // containing block / stacking context of this full-screen layer.
  return createPortal(
    <div role="dialog" aria-modal="true" className="page-in fixed inset-0 z-[60] flex flex-col bg-white text-[#05030a]">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <span className="font-cinzel text-[13px] font-bold tracking-[0.12em]">ONE NIGHT AT ÍROTTKŐ</span>
        <button onClick={onClose} aria-label="Bezárás" className="-mr-2 p-2">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className={`text-[12px] font-semibold uppercase tracking-[0.25em] ${t.vip ? 'text-[#a8862a]' : 'text-gray-500'}`}>
          {t.vip ? 'VIP Lounge' : t.tier}
        </div>
        <div className="mt-2 text-3xl font-bold">{t.name}</div>
        {qr && <img src={qr} alt={`QR-kód: ${t.code}`} className="mt-8 aspect-square w-full max-w-[340px]" />}
        <div className="mt-5 font-mono text-[17px] tracking-[0.2em]">{t.code}</div>
        <p className="mt-6 max-w-xs text-[13px] text-gray-500">Tekerd fel a fényerőt. Egyszeri belépésre jogosít, névre szóló.</p>
      </div>
      <div className="pb-[calc(env(safe-area-inset-bottom)+20px)] text-center">
        <a href={`/.netlify/functions/wallet-apple?c=${t.code}`} className="inline-block">
          <img src="/wallet/apple-wallet-badge-hu.svg" alt="Hozzáadás az Apple Tárcához" className="h-11 w-auto" />
        </a>
      </div>
    </div>,
    document.body
  );
}

export default function MyTickets() {
  const [tickets, setTickets] = useState(getMyTickets);
  const [open, setOpen] = useState(null);
  if (!tickets.length) return null;

  const remove = (code) => {
    if (!window.confirm('Eltávolítod ezt a jegyet erről a telefonról? (Az e-mailben és a Tárcában megmarad.)')) return;
    removeMyTicket(code);
    setTickets(getMyTickets());
  };

  return (
    <section className="mx-auto max-w-md px-5 pt-24 sm:pt-32">
      <div className="kicker">Beszállókártyáim</div>
      <h1 className="mt-3 text-3xl font-semibold text-white">{tickets.length > 1 ? `${tickets.length} beszállókártyád van` : 'Megvan a beszállókártyád'}</h1>
      <p className="mt-2 text-[14px] text-gray-400">
        Ezen a telefonon mentve. Ha a gate-nél nincs térerő, a Tárcából vagy a PDF-ből is felmutathatod.
      </p>
      <div className="mt-6 space-y-4">
        {tickets.map((t) => (
          <div key={t.code}>
            <Pass t={t} onOpen={() => setOpen(t)} />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a href={`/.netlify/functions/wallet-apple?c=${t.code}`}>
                <img src="/wallet/apple-wallet-badge-hu.svg" alt="Hozzáadás az Apple Tárcához" className="h-10 w-auto" />
              </a>
              <a href={`/.netlify/functions/wallet-google?c=${t.code}`}>
                <img src="/wallet/google-wallet-badge-hu.svg" alt="Hozzáadás a Google Wallethez" className="h-10 w-auto" />
              </a>
            </div>
            <div className="mt-1 text-center">
              <button onClick={() => remove(t.code)} className="px-2 py-1 text-[12px] text-gray-600 hover:text-gray-300">
                Eltávolítás erről a telefonról
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-14 border-t border-white/[0.08]" />
      {open && <FullPass t={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
