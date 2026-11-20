import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import { EVENT_DETAILS } from '../data/eventData';
import { saveMyTickets } from '../lib/myTickets';
import { BoardingPass, FullPass } from '../components/MyTickets';
import { SELLER } from '../data/legal';

/*
  Barion redirects here with ?o=<order>&t=<token> (lib/orderAccess.js)  The page asks the server for the
  real state (which also triggers ticket issuing if the callback is late) and
  polls while the bank is still processing.
*/
const POLL_MS = 4000; // Barion allows 2 state queries / 5 s per payment
const MAX_POLLS = 30;


export default function TicketSuccess() {
  const [params] = useSearchParams();
  // o = order id, t = its access token (the Barion paymentId in the URL grants nothing)
  const orderId = params.get('o');
  // first 22 URL-safe chars: robust even if a payment page appends ?paymentId=… naively
  const token = ((params.get('t') || '').match(/^[A-Za-z0-9_-]{22}/) || [''])[0];
  const [state, setState] = useState(orderId && token ? { status: 'loading' } : { status: 'none' });

  useEffect(() => {
    if (!orderId || !token) return;
    let stop = false;
    let polls = 0;
    let timer;

    const tick = async () => {
      polls += 1;
      try {
        const res = await fetch(`/.netlify/functions/order-status?o=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (stop) return;
        if (data.status === 'paid') {
          saveMyTickets(data.order.id, data.tickets); // → Jegyek tab, on this phone
          setState(data);
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#d4af37', '#f7e7a9', '#ffffff'] });
          return;
        }
        if (['cancelled', 'expired', 'unknown', 'payment_check', 'forbidden', 'unavailable'].includes(data.status)) return setState(data);
        setState({ status: 'pending' });
      } catch {
        if (stop) return;
        setState({ status: 'pending' });
      }
      if (polls < MAX_POLLS) timer = setTimeout(tick, POLL_MS);
      else setState({ status: 'slow' });
    };

    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [orderId, token]);

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-5 pb-28 pt-32 sm:pt-40">
        {state.status === 'paid' ? <Paid data={state} /> : <Status status={state.status} />}
      </section>
    </PageShell>
  );
}

function Paid({ data }) {
  const { order, tickets } = data;
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className="text-center">
        {/* airline-style confirmation: a "checked in" stamp + the flight strip */}
        <div className="mx-auto inline-flex -rotate-3 items-center gap-2 rounded-[6px] border-2 border-emerald-400/80 px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> Checked in
        </div>
        <h1 className="display mt-6 text-4xl sm:text-5xl">Check-in kész. Jó utat!</h1>
        <div className="mx-auto mt-5 flex max-w-sm items-center justify-between gap-3 rounded-[4px] border border-white/10 bg-[#0b0812] px-4 py-2.5 font-mono text-[12px] font-bold tracking-[0.12em] text-white">
          <span>
            KSZ <span className="text-[#d4af37]">✈</span> ÍRK
          </span>
          <span className="text-[#f3d77a]">ÍR 0115</span>
          <span>{EVENT_DETAILS.isoDate.slice(0, 10).replace(/-/g, '.')}.</span>
        </div>
        <p className="mt-4 text-gray-300">
          Köszönjük, {order.fullName}! A beszállókártyákat elküldtük ide: <span className="text-white">{order.email}</span>. A számlát a Számlázz.hu külön
          e-mailben küldi.
        </p>
        <p className="mt-2 text-[13px] text-gray-500">
          {EVENT_DETAILS.dateString} · {EVENT_DETAILS.venue} · Gate open {EVENT_DETAILS.doorsOpen}
        </p>
      </div>

      <ul className="mx-auto mt-14 max-w-md space-y-8">
        {tickets.map((t, i) => (
          <li key={t.code}>
            <BoardingPass t={t} label={tickets.length > 1 ? `${i + 1}. utas` : null} onOpen={() => setOpen(t)} />
            {/* Official Apple / Google badges (unaltered, as required by both) */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <a href={`/.netlify/functions/wallet-apple?c=${t.code}`}>
                <img src="/wallet/apple-wallet-badge-hu.svg" alt="Hozzáadás az Apple Tárcához" className="h-10 w-auto" />
              </a>
              <a href={`/.netlify/functions/wallet-google?c=${t.code}`}>
                <img src="/wallet/google-wallet-badge-hu.svg" alt="Hozzáadás a Google Wallethez" className="h-10 w-auto" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-[13px] text-gray-500">
        A belépéskor mutasd fel a QR-kódot (koppints a kártyára a nagyításhoz). Minden kód egyszer használható. Rendelésszám: {order.id}
      </p>
      {open && <FullPass t={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const MESSAGES = {
  loading: ['Ellenőrizzük a fizetést…', null],
  pending: ['A bank még dolgozik a fizetéseden…', 'Ne zárd be az oldalt, pár másodperc az egész.'],
  slow: ['A fizetés visszaigazolása késik.', 'Ha a fizetés sikeres volt, a beszállókártyákat e-mailben megkapod. Ha egy órán belül nem érkeznek meg, írj nekünk.'],
  cancelled: ['A fizetés nem sikerült.', 'A kártyádat nem terheltük meg. Próbáld újra, a foglalásod felszabadult.'],
  expired: ['A fizetési idő lejárt.', 'A kártyádat nem terheltük meg. Indíts új vásárlást.'],
  unknown: ['Ezt a rendelést nem találjuk.', null],
  unavailable: ['A jegyek most nem tölthetők be.', 'Átmeneti hiba. Próbáld újra pár perc múlva – a jegyeidet e-mailben is megkapod.'],
  forbidden: ['Ez a link nem érvényes.', 'Nyisd meg a jegyeidet a visszaigazoló e-mailben kapott gombbal.'],
  payment_check: [
    'A fizetést ellenőriznünk kell.',
    'A fizetésed megérkezett, de az adatai eltérnek a rendeléstől, ezért kézzel ellenőrizzük. Ha a bankod terhelt, nem veszik el: e-mailben jelentkezünk. Kérdés esetén írj a ' + SELLER.email + ' címre.',
  ],
  none: ['Nincs megjeleníthető rendelés.', null],
};

function Status({ status }) {
  const [title, text] = MESSAGES[status] || MESSAGES.unknown;
  const busy = status === 'loading' || status === 'pending';
  const failed = ['cancelled', 'expired', 'unknown', 'none', 'forbidden', 'unavailable'].includes(status);
  return (
    <div className="text-center">
      {busy ? (
        <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-[#d4af37] border-t-transparent" />
      ) : (
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
      )}
      <h1 className="mt-6 text-3xl font-semibold text-white">{title}</h1>
      {text && <p className="mt-4 text-gray-400">{text}</p>}
      {failed && (
        <Link to="/jegyek" className="btn-primary mt-10">
          Vissza a jegyekhez
        </Link>
      )}
    </div>
  );
}
