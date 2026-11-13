import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, AlertCircle, ChevronLeft, Minus, Plus } from 'lucide-react';
import Turnstile from './Turnstile';
import { TICKET_PERKS } from '../data/eventData';
import { usePricing, huf, dayHu } from '../lib/usePricing';

/*
  Ticket purchase in four steps, like a flight-booking app:
    1 Jegy   – ticket type and quantity
    2 Nevek  – one attendee name per ticket (named tickets)
    3 Adatok – e-mail, phone, billing
    4 Fizetés – summary, terms, bot check → Barion
  A sticky bar at the bottom (above the tab bar on phones) shows the total
  and the next action. Price and availability are decided on the server.
*/
const STEPS = ['Járat', 'Utasok', 'Adatok', 'Fizetés'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TicketSection() {
  const pricing = usePricing();
  const top = useRef(null);
  const turnstile = useRef(null);

  const [step, setStep] = useState(0);
  const [selectedKind, setSelectedKind] = useState('standard');
  const [ticketCount, setTicketCount] = useState(1);
  const [isCompany, setIsCompany] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [humanToken, setHumanToken] = useState('');

  // Attendees come first; the billing name follows ticket 1 until edited.
  const [names, setNames] = useState(['']);
  const attendees = Array.from({ length: ticketCount }, (_, i) => names[i] || '');
  const setAttendee = (i, value) =>
    setNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', zip: '', city: '', address: '', companyName: '', taxNumber: '' });
  const [buyerNameEdited, setBuyerNameEdited] = useState(false);
  const buyerName = buyerNameEdited ? formData.fullName : attendees[0];
  const onField = (e) => {
    const { name, value } = e.target;
    if (name === 'fullName') setBuyerNameEdited(true);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const available = [pricing.standard, pricing.vip].filter(Boolean);
  const selectedTier = available.find((t) => t.kind === selectedKind) || available[0] || null;
  const totalPrice = selectedTier ? selectedTier.price_huf * ticketCount : 0;

  // ---- step validation ----
  const stepError = (s) => {
    if (s === 0) return selectedTier ? '' : 'Válassz osztályt.';
    if (s === 1) return attendees.some((n) => n.trim().length < 2) ? 'Add meg minden utas nevét.' : '';
    if (s === 2) {
      if (!EMAIL_RE.test(formData.email.trim())) return 'Adj meg egy érvényes e-mail címet – ide küldjük a jegyeket.';
      if (buyerName.trim().length < 2 || !formData.zip.trim() || !formData.city.trim() || !formData.address.trim())
        return 'Töltsd ki a számlázási adatokat.';
      if (isCompany && (!formData.companyName.trim() || !/^\d{8}-?\d-?\d{2}$/.test(formData.taxNumber.trim())))
        return 'Céges vásárlásnál a cégnév és egy érvényes adószám (12345678-1-23) kötelező.';
      return '';
    }
    if (s === 3) {
      if (!acceptTerms) return 'A vásárláshoz fogadd el az ÁSZF-et és az adatkezelési tájékoztatót.';
      if (!humanToken) return 'Egy pillanat – ellenőrizzük, hogy nem robot vagy. Próbáld újra pár másodperc múlva.';
    }
    return '';
  };

  const goTo = (s) => {
    setErrorMsg('');
    setStep(s);
    const y = (top.current?.getBoundingClientRect().top || 0) + window.scrollY - 72;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };
  const next = () => {
    const err = stepError(step);
    if (err) return setErrorMsg(err);
    if (step < 3) return goTo(step + 1);
    pay();
  };

  const pay = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/.netlify/functions/barion-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: selectedTier.kind,
          qty: ticketCount,
          attendeeNames: attendees.map((n) => n.trim()),
          turnstileToken: humanToken === 'no-key' ? '' : humanToken,
          isCompany,
          acceptTerms,
          ...formData,
          fullName: buyerName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.gatewayUrl) throw new Error(data.error || 'A fizetés indítása nem sikerült. Kérjük, próbáld újra!');
      window.location.assign(data.gatewayUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message);
      setSubmitting(false);
      turnstile.current?.reset(); // tokens are single-use
    }
  };

  if (pricing.status !== 'open' || !selectedTier) {
    return (
      <section id="tickets" className="mx-auto max-w-5xl px-5 pb-28">
        <SalesState pricing={pricing} />
      </section>
    );
  }

  return (
    <section id="tickets" ref={top} className="mx-auto max-w-2xl px-5">
      <Progress step={step} onJump={(s) => s < step && goTo(s)} />

      <div key={step} className="page-in mt-8 min-h-[50vh]">
        {/* ---------- 1. Jegy ---------- */}
        {step === 0 && (
          <>
            <StepTitle title="Melyik osztályon utazol?" />
            <div className="grid gap-3">
              {available.map((tier) => {
                const on = tier.kind === selectedTier.kind;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedKind(tier.kind)}
                    className={`rounded-3xl border p-6 text-left transition-[border-color,transform] active:scale-[0.99] ${
                      on ? 'border-[#d4af37] bg-white/[0.05]' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[12px] font-medium uppercase tracking-[0.15em] text-gray-400">
                          {tier.kind === 'vip' ? 'Business · VIP Lounge' : tier.channel === 'door' ? 'Gate-nél váltott jegy' : 'Economy'}
                        </div>
                        <div className="mt-2 text-xl font-semibold text-white">{tier.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold tabular-nums text-white">{huf(tier.price_huf)}</div>
                        <div className="text-[12px] text-gray-500">/ fő</div>
                      </div>
                    </div>
                    {tier.kind === 'standard' && pricing.next && (
                      <div className="mt-2 text-[13px] text-[#d4af37]">
                        Következő ár: {huf(pricing.next.price_huf)} ({dayHu(pricing.next.sales_from)})
                      </div>
                    )}
                    {tier.kind === 'vip' && tier.remaining != null && tier.remaining <= 10 && (
                      <div className="mt-2 text-[13px] text-[#d4af37]">Már csak {tier.remaining} VIP hely</div>
                    )}
                    {on && (
                      <ul className="mt-4 space-y-2 text-[14px] text-gray-300">
                        {TICKET_PERKS[tier.kind].map((perk) => (
                          <li key={perk} className="flex gap-2.5">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-3xl border border-white/10 p-5">
              <div>
                <div className="text-[15px] font-medium text-white">Hány utas?</div>
                <div className="text-[13px] text-gray-500">Egy foglalásban legfeljebb 10</div>
              </div>
              <div className="flex items-center gap-4">
                <RoundButton label="Kevesebb jegy" disabled={ticketCount <= 1} onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}>
                  <Minus className="h-4 w-4" />
                </RoundButton>
                <span className="w-6 text-center text-xl font-semibold tabular-nums text-white">{ticketCount}</span>
                <RoundButton label="Több jegy" disabled={ticketCount >= 10} onClick={() => setTicketCount(Math.min(10, ticketCount + 1))}>
                  <Plus className="h-4 w-4" />
                </RoundButton>
              </div>
            </div>
          </>
        )}

        {/* ---------- 2. Nevek ---------- */}
        {step === 1 && (
          <>
            <StepTitle
              title={ticketCount > 1 ? 'Kik utaznak?' : 'Ki utazik?'}
              sub="A beszállókártya névre szóló: ez a név kerül rá, ezt ellenőrzik beszálláskor."
            />
            <div className="grid gap-3">
              {attendees.map((name, i) => (
                <label key={i} className="block">
                  <span className="mb-1.5 block text-[13px] text-gray-400">{i + 1}. utas</span>
                  <input
                    className="field"
                    type="text"
                    value={name}
                    onChange={(e) => setAttendee(i, e.target.value)}
                    placeholder={i === 0 ? 'A te neved' : 'Utas neve'}
                    autoComplete={i === 0 ? 'name' : 'off'}
                    enterKeyHint={i === ticketCount - 1 ? 'next' : 'next'}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {/* ---------- 3. Adatok ---------- */}
        {step === 2 && (
          <>
            <StepTitle title="Hová küldjük a beszállókártyát?" sub="A beszállókártyákat és a számlát erre az e-mail címre küldjük." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail *" className="sm:col-span-2">
                <input className="field" type="email" name="email" value={formData.email} onChange={onField} autoComplete="email" inputMode="email" />
              </Field>
              <Field label="Telefonszám" className="sm:col-span-2">
                <input className="field" type="tel" name="phone" value={formData.phone} onChange={onField} autoComplete="tel" />
              </Field>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <span className="text-[17px] font-semibold text-white">Számlázás</span>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-400">
                <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="accent-[#d4af37]" />
                Cégként vásárolok
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {isCompany ? (
                <>
                  <Field label="Cégnév *" className="sm:col-span-2">
                    <input className="field" type="text" name="companyName" value={formData.companyName} onChange={onField} autoComplete="organization" />
                  </Field>
                  <Field label="Adószám *">
                    <input className="field" type="text" name="taxNumber" value={formData.taxNumber} onChange={onField} placeholder="12345678-2-42" />
                  </Field>
                  <Field label="Kapcsolattartó neve *" className="sm:col-span-3">
                    <input className="field" type="text" name="fullName" value={buyerName} onChange={onField} autoComplete="name" />
                  </Field>
                </>
              ) : (
                <Field label="Számlázási név *" className="sm:col-span-3">
                  <input className="field" type="text" name="fullName" value={buyerName} onChange={onField} autoComplete="name" />
                </Field>
              )}
              <Field label="Irányítószám *">
                <input className="field" type="text" name="zip" value={formData.zip} onChange={onField} autoComplete="postal-code" inputMode="numeric" />
              </Field>
              <Field label="Város *" className="sm:col-span-2">
                <input className="field" type="text" name="city" value={formData.city} onChange={onField} autoComplete="address-level2" />
              </Field>
              <Field label="Utca, házszám *" className="sm:col-span-3">
                <input className="field" type="text" name="address" value={formData.address} onChange={onField} autoComplete="street-address" />
              </Field>
            </div>
          </>
        )}

        {/* ---------- 4. Fizetés ---------- */}
        {step === 3 && (
          <>
            <StepTitle title="Utolsó ellenőrzés." />
            <dl className="divide-y divide-white/[0.08] rounded-3xl border border-white/10 px-5">
              <SummaryRow label="Járat" onEdit={() => goTo(0)}>
                {ticketCount} × {selectedTier.name} · {huf(selectedTier.price_huf)}
              </SummaryRow>
              <SummaryRow label={ticketCount > 1 ? 'Utasok' : 'Utas'} onEdit={() => goTo(1)}>
                {attendees.map((n, i) => (
                  <div key={i}>{n}</div>
                ))}
              </SummaryRow>
              <SummaryRow label="E-mail" onEdit={() => goTo(2)}>
                {formData.email}
              </SummaryRow>
              <SummaryRow label="Számla" onEdit={() => goTo(2)}>
                <div>{isCompany ? `${formData.companyName} (${formData.taxNumber})` : buyerName}</div>
                <div className="text-gray-400">
                  {formData.zip} {formData.city}, {formData.address}
                </div>
              </SummaryRow>
            </dl>

            <label className="mt-6 flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-gray-300">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#d4af37]"
              />
              <span>
                Elfogadom az{' '}
                <a href="/aszf" target="_blank" rel="noreferrer" className="text-[#d4af37] underline">
                  ÁSZF-et
                </a>
                , és megismertem az{' '}
                <a href="/adatkezeles" target="_blank" rel="noreferrer" className="text-[#d4af37] underline">
                  adatkezelési tájékoztatót
                </a>
                . Tudomásul veszem, hogy dátumhoz kötött rendezvényjegy esetén nincs elállási jog.
              </span>
            </label>

            <div className="mt-6">
              <Turnstile ref={turnstile} onToken={setHumanToken} />
            </div>
            <p className="mt-4 text-center text-[13px] text-gray-500">
              Az ár tartalmazza az áfát. A fizetésre 3 perced van. A kártyaadatokat a Barion Payment Zrt. kezeli, azokat mi nem látjuk és nem
              tároljuk.
            </p>
          </>
        )}
      </div>

      {/* ---------- sticky action bar ---------- */}
      <div className="sticky bottom-[var(--tabbar)] z-30 -mx-5 mt-8 border-t border-white/[0.08] bg-[#05030a]/90 px-5 pb-4 pt-3 backdrop-blur-xl">
        {errorMsg && (
          <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-[13px] text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              aria-label="Vissza"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-white active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-gray-500">
              {ticketCount} × {selectedTier.name}
            </div>
            <div className="text-xl font-semibold tabular-nums text-white">{huf(totalPrice)}</div>
          </div>
          <button type="button" onClick={next} disabled={submitting} className="btn-primary h-12 shrink-0 px-6 text-[15px] disabled:opacity-50">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Fizetés…
              </>
            ) : step < 3 ? (
              'Tovább'
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Fizetés
              </>
            )}
          </button>
        </div>
        {/* Barion requires its logo next to the pay button */}
        {step === 3 && <BarionNote />}
      </div>
    </section>
  );
}

/* ------------------------------ parts ------------------------------ */

function Progress({ step, onJump }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Vásárlás lépései">
      {STEPS.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => onJump(i)}
            disabled={i >= step}
            aria-current={i === step ? 'step' : undefined}
            className="w-full text-left disabled:cursor-default"
          >
            <span className={`block h-1 rounded-full transition-colors ${i <= step ? 'bg-[#d4af37]' : 'bg-white/10'}`} />
            <span className={`mt-2 block text-[12px] font-medium ${i === step ? 'text-white' : i < step ? 'text-[#d4af37]' : 'text-gray-600'}`}>
              {i + 1}. {label}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function StepTitle({ title, sub }) {
  return (
    <div className="mb-6">
      <h2 className="text-[1.75rem] font-semibold leading-tight text-white">{title}</h2>
      {sub && <p className="mt-2 text-[14px] leading-relaxed text-gray-400">{sub}</p>}
    </div>
  );
}

function Field({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function RoundButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-transform active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, onEdit, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <dt className="text-[12px] font-medium uppercase tracking-[0.15em] text-gray-500">{label}</dt>
        <dd className="mt-1 break-words text-[15px] text-white">{children}</dd>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-[13px] font-medium text-[#d4af37]">
        Módosítás
      </button>
    </div>
  );
}

// Shown instead of the checkout when nothing can be bought right now.
function SalesState({ pricing }) {
  const msg = {
    loading: ['Jegyárak betöltése…', null],
    error: ['A jegyárakat most nem tudjuk betölteni.', 'Kérjük, próbáld újra pár perc múlva.'],
    between: [
      'Az online check-in lezárult.',
      pricing.doorFrom ? `Beszállókártyát a gate-nél válthatsz: ${dayHu(pricing.doorFrom)}, 19:00-tól.` : 'Beszállókártyát a gate-nél válthatsz.',
    ],
    closed: ['A jegyértékesítés jelenleg nem elérhető.', null],
    open: pricing.onlineSoldOut
      ? ['Az online helyek elfogytak.', pricing.doorFrom ? `Beszállókártyát a gate-nél válthatsz: ${dayHu(pricing.doorFrom)}, 19:00-tól.` : null]
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

// Barion requires its logo near the payment button. Official "Barion Smart"
// acceptance banner, unaltered, from design.barion.com → Resources
// (barion.com/resources/banners_cz_sk.zip, dark variant for dark backgrounds).
const BARION_LOGO = '/barion/barion-smart-banner-dark.svg';

function BarionNote() {
  return (
    <div className="mt-3 flex justify-center">
      <img
        src={BARION_LOGO}
        alt="Fizetés Barionnal: Mastercard, Visa, Diners Club, Discover, Apple Pay, Google Pay"
        width="756"
        height="108"
        className="h-auto w-full max-w-[320px]"
      />
    </div>
  );
}
