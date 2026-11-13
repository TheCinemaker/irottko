import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TICKET_PERKS } from '../data/eventData';
import { usePricing, huf, dayHu } from '../lib/usePricing';
import { Check, Lock, AlertCircle } from 'lucide-react';

export default function TicketSection() {
  const pricing = usePricing();
  const [selectedKind, setSelectedKind] = useState('standard');
  const [ticketCount, setTicketCount] = useState(1);
  const [isCompany, setIsCompany] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields (invoice data for Számlázz.hu)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    zip: '',
    city: '',
    address: '',
    companyName: '',
    taxNumber: '',
  });

  const available = [pricing.standard, pricing.vip].filter(Boolean);
  const selectedTier = available.find((t) => t.kind === selectedKind) || available[0] || null;
  const totalPrice = selectedTier ? selectedTier.price_huf * ticketCount : 0;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Form validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.zip.trim() || !formData.city.trim() || !formData.address.trim()) {
      setErrorMsg('Kérjük, tölts ki minden kötelező számlázási mezőt!');
      return;
    }

    if (isCompany && !formData.taxNumber.trim()) {
      setErrorMsg('Céges számla esetén az adószám megadása kötelező!');
      return;
    }

    if (isCompany && !formData.companyName.trim()) {
      setErrorMsg('Céges számla esetén a cégnév megadása kötelező!');
      return;
    }

    if (!acceptTerms) {
      setErrorMsg('A vásárláshoz el kell fogadnod az ÁSZF-et és az adatkezelési tájékoztatót.');
      return;
    }

    setSubmitting(true);

    try {
      // Price and availability are decided on the server; the browser only
      // sends what the guest picked. Barion takes over from here.
      const res = await fetch('/.netlify/functions/barion-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: selectedTier.kind, qty: ticketCount, isCompany, acceptTerms, ...formData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.gatewayUrl) throw new Error(data.error || 'A fizetés indítása nem sikerült. Kérjük, próbáld újra!');
      window.location.assign(data.gatewayUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message);
      setSubmitting(false);
    }
  };

  return (
    <section id="tickets" className="mx-auto max-w-5xl px-5 pb-28">
      {/* Tiers – live prices from the DB */}
      {pricing.status !== 'open' || !selectedTier ? (
        <SalesState pricing={pricing} />
      ) : (
      <>
      <div className={`grid gap-4 ${available.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-md'}`}>
        {available.map((tier) => {
          const isSelected = tier.kind === selectedTier.kind;
          const isDoor = tier.channel === 'door';
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedKind(tier.kind)}
              className={`flex flex-col rounded-3xl border p-7 text-left transition-colors ${
                isSelected ? 'border-[#d4af37] bg-white/[0.05]' : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-[12px] font-medium uppercase tracking-[0.15em] text-gray-400">
                  {tier.kind === 'vip' ? 'VIP Lounge' : isDoor ? 'Helyszíni jegy' : 'Belépő'}
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isSelected ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-white/30'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-white">{tier.name}</h3>
              <div className="mt-2 text-3xl font-semibold text-white">{huf(tier.price_huf)}</div>
              <div className="mt-1 text-[13px] text-gray-500">/ fő, bruttó</div>
              {tier.kind === 'standard' && pricing.next && (
                <div className="mt-3 text-[13px] text-[#d4af37]">
                  Következő ár: {huf(pricing.next.price_huf)} ({dayHu(pricing.next.sales_from)})
                </div>
              )}
              {tier.kind === 'vip' && tier.remaining != null && tier.remaining <= 10 && (
                <div className="mt-3 text-[13px] text-[#d4af37]">Már csak {tier.remaining} VIP hely</div>
              )}
              <ul className="mt-6 space-y-2.5 text-[14px] leading-snug text-gray-300">
                {TICKET_PERKS[tier.kind].map((perk) => (
                  <li key={perk} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Checkout */}
      <form onSubmit={handleSubmit} className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-3xl font-semibold text-white">Adatok és számlázás</h2>
        <p className="mt-2 text-[15px] text-gray-400">A fizetés a Barion biztonságos oldalán történik. A jegyet és a számlát e-mailben kapod.</p>

        {errorMsg && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-[14px] text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-y border-white/[0.08] py-5">
          <div>
            <div className="text-[15px] font-medium text-white">{selectedTier.name}</div>
            <div className="text-[13px] text-gray-500">{huf(selectedTier.price_huf)} / fő</div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Kevesebb jegy"
              onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
              className="h-9 w-9 rounded-full border border-white/20 text-lg text-white hover:border-white/50"
            >
              −
            </button>
            <span className="w-6 text-center text-lg font-semibold tabular-nums text-white">{ticketCount}</span>
            <button
              type="button"
              aria-label="Több jegy"
              onClick={() => setTicketCount(Math.min(10, ticketCount + 1))}
              className="h-9 w-9 rounded-full border border-white/20 text-lg text-white hover:border-white/50"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] text-gray-400">Teljes név *</span>
            <input className="field" type="text" name="fullName" required value={formData.fullName} onChange={handleInputChange} autoComplete="name" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] text-gray-400">E-mail *</span>
            <input className="field" type="email" name="email" required value={formData.email} onChange={handleInputChange} autoComplete="email" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] text-gray-400">Telefonszám</span>
            <input className="field" type="tel" name="phone" value={formData.phone} onChange={handleInputChange} autoComplete="tel" />
          </label>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-[15px] font-medium text-white">Számlázási cím</span>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-400">
            <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="accent-[#d4af37]" />
            Cégként vásárolok
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-[13px] text-gray-400">Irányítószám *</span>
            <input className="field" type="text" name="zip" required value={formData.zip} onChange={handleInputChange} autoComplete="postal-code" inputMode="numeric" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-[13px] text-gray-400">Város *</span>
            <input className="field" type="text" name="city" required value={formData.city} onChange={handleInputChange} autoComplete="address-level2" />
          </label>
          <label className="block sm:col-span-3">
            <span className="mb-2 block text-[13px] text-gray-400">Utca, házszám *</span>
            <input className="field" type="text" name="address" required value={formData.address} onChange={handleInputChange} autoComplete="street-address" />
          </label>
          {isCompany && (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-[13px] text-gray-400">Cégnév *</span>
                <input className="field" type="text" name="companyName" required value={formData.companyName} onChange={handleInputChange} autoComplete="organization" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[13px] text-gray-400">Adószám *</span>
                <input className="field" type="text" name="taxNumber" required value={formData.taxNumber} onChange={handleInputChange} placeholder="12345678-2-42" />
              </label>
            </>
          )}
        </div>

        <label className="mt-8 flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-gray-300">
          <input
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#d4af37]"
          />
          <span>
            Elfogadom az{' '}
            <a href="/aszf" target="_blank" rel="noreferrer" className="text-[#d4af37] underline">ÁSZF-et</a>, és megismertem az{' '}
            <a href="/adatkezeles" target="_blank" rel="noreferrer" className="text-[#d4af37] underline">adatkezelési tájékoztatót</a>.
            Tudomásul veszem, hogy dátumhoz kötött rendezvényjegy esetén nincs elállási jog.
          </span>
        </label>

        <div className="mt-10 flex flex-col gap-6 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] text-gray-400">Összesen</div>
            <div className="text-3xl font-semibold tabular-nums text-white">{huf(totalPrice)}</div>
            <div className="text-[13px] text-gray-500">Az ár tartalmazza az áfát.</div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full px-10 py-4 text-[15px] disabled:opacity-50 sm:w-auto">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Feldolgozás…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Tovább a fizetéshez
              </>
            )}
          </button>
        </div>
        <BarionNote />
      </form>
      </>
      )}
    </section>
  );
}

// Shown instead of the checkout when nothing can be bought right now.
function SalesState({ pricing }) {
  const msg = {
    loading: ['Jegyárak betöltése…', null],
    error: ['A jegyárakat most nem tudjuk betölteni.', 'Kérjük, próbáld újra pár perc múlva.'],
    between: [
      'Az online jegyértékesítés lezárult.',
      pricing.doorFrom ? `Jegyet a helyszínen vehetsz: ${dayHu(pricing.doorFrom)}, 19:00-tól.` : 'Jegyet a helyszínen vehetsz.',
    ],
    closed: ['A jegyértékesítés jelenleg nem elérhető.', null],
    open: pricing.onlineSoldOut
      ? ['Az online jegyek elfogytak.', pricing.doorFrom ? `Jegyet a helyszínen vehetsz: ${dayHu(pricing.doorFrom)}, 19:00-tól.` : null]
      : ['Jegyárak betöltése…', null],
  }[pricing.status] || ['A jegyértékesítés jelenleg nem elérhető.', null];

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      {pricing.status === 'loading' && (
        <span className="mx-auto mb-6 block h-8 w-8 animate-spin rounded-full border-2 border-[#d4af37] border-t-transparent" />
      )}
      <h2 className="text-3xl font-semibold text-white">{msg[0]}</h2>
      {msg[1] && <p className="mt-4 text-gray-400">{msg[1]}</p>}
      {pricing.status !== 'loading' && (
        <Link to="/" className="link-more mt-8">
          Vissza a főoldalra
        </Link>
      )}
    </div>
  );
}

// Barion requires its logo near the payment button. Put the official logo
// (downloaded from the Barion merchant site) at public/barion/barion-logo.svg
// and set BARION_LOGO below; until then a text line is shown.
const BARION_LOGO = null; // e.g. '/barion/barion-logo.svg'

function BarionNote() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-center text-[13px] text-gray-500">
      {BARION_LOGO ? (
        <img src={BARION_LOGO} alt="Barion – biztonságos online fizetés" className="h-8 w-auto opacity-90" />
      ) : (
        <span className="font-medium text-gray-400">Biztonságos fizetés: Barion</span>
      )}
      <span>A kártyaadatokat a Barion Payment Zrt. kezeli, azokat mi nem látjuk és nem tároljuk.</span>
    </div>
  );
}
