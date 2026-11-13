import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import { EVENT_DETAILS } from '../data/eventData';
import { saveMyTickets } from '../lib/myTickets';

/*
  Barion redirects here with ?paymentId=…  The page asks the server for the
  real state (which also triggers ticket issuing if the callback is late) and
  polls while the bank is still processing.
*/
const POLL_MS = 4000; // Barion allows 2 state queries / 5 s per payment
const MAX_POLLS = 30;

const qrSrc = (code) => `/.netlify/functions/ticket-qr?c=${encodeURIComponent(code)}`;

export default function TicketSuccess() {
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId');
  const [state, setState] = useState(paymentId ? { status: 'loading' } : { status: 'none' });

  useEffect(() => {
    if (!paymentId) return;
    let stop = false;
    let polls = 0;
    let timer;

    const tick = async () => {
      polls += 1;
      try {
        const res = await fetch(`/.netlify/functions/order-status?paymentId=${encodeURIComponent(paymentId)}`);
        const data = await res.json();
        if (stop) return;
        if (data.status === 'paid') {
          saveMyTickets(data.order.id, data.tickets); // → Jegyek tab, on this phone
          setState(data);
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#d4af37', '#f7e7a9', '#ffffff'] });
          return;
        }
        if (['cancelled', 'expired', 'unknown'].includes(data.status)) return setState(data);
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
  }, [paymentId]);

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
  return (
    <>
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#d4af37]" />
        <h1 className="display mt-6 text-4xl sm:text-5xl">Megvan a jegyed.</h1>
        <p className="mt-4 text-gray-300">
          Köszönjük, {order.fullName}! A jegyeket elküldtük ide: <span className="text-white">{order.email}</span>. A számlát a Számlázz.hu külön
          e-mailben küldi.
        </p>
        <p className="mt-2 text-[13px] text-gray-500">
          {EVENT_DETAILS.dateString} · {EVENT_DETAILS.venue} · Kapunyitás {EVENT_DETAILS.doorsOpen}
        </p>
      </div>

      <ul className="mt-14 space-y-6">
        {tickets.map((t, i) => (
          <li key={t.code} className="surface flex flex-col items-center p-8 text-center">
            <div className="text-[12px] font-medium uppercase tracking-[0.15em] text-gray-400">
              {i + 1}. jegy · {t.tier}
            </div>
            <div className="mt-2 text-xl font-semibold text-white">{t.name}
            </div>
            <img src={qrSrc(t.code)} alt={`QR-kód: ${t.code}`} width="220" height="220" className="mt-5 rounded-xl bg-white p-2" />
            <div className="mt-4 font-mono text-[15px] tracking-[0.2em] text-white">{t.code}</div>
            {/* Official Apple / Google badges (unaltered, as required by both) */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href={`/.netlify/functions/wallet-apple?c=${t.code}`}>
                <img src="/wallet/apple-wallet-badge-hu.svg" alt="Hozzáadás az Apple Tárcához" className="h-11 w-auto" />
              </a>
              <a href={`/.netlify/functions/wallet-google?c=${t.code}`}>
                <img src="/wallet/google-wallet-badge-hu.svg" alt="Hozzáadás a Google Wallethez" className="h-11 w-auto" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-[13px] text-gray-500">
        A belépéskor mutasd fel a QR-kódot. Minden kód egyszer használható. Rendelésszám: {order.id}
      </p>
    </>
  );
}

const MESSAGES = {
  loading: ['Ellenőrizzük a fizetést…', null],
  pending: ['A bank még dolgozik a fizetéseden…', 'Ne zárd be az oldalt, pár másodperc az egész.'],
  slow: ['A fizetés visszaigazolása késik.', 'Ha a fizetés sikeres volt, a jegyeket e-mailben megkapod. Ha egy órán belül nem érkeznek meg, írj nekünk.'],
  cancelled: ['A fizetés nem sikerült.', 'A kártyádat nem terheltük meg. Próbáld újra, a foglalásod felszabadult.'],
  expired: ['A fizetési idő lejárt.', 'A kártyádat nem terheltük meg. Indíts új vásárlást.'],
  unknown: ['Ezt a rendelést nem találjuk.', null],
  none: ['Nincs megjeleníthető rendelés.', null],
};

function Status({ status }) {
  const [title, text] = MESSAGES[status] || MESSAGES.unknown;
  const busy = status === 'loading' || status === 'pending';
  const failed = status === 'cancelled' || status === 'expired' || status === 'unknown' || status === 'none';
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
