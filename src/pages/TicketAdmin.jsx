import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLive, LiveBadge } from '../lib/useLive';
import { RefreshCw, LogOut, Download, Search, AlertTriangle, Check, X, Copy, Ban, Send, Printer, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';

/*
  Admin (/admin) – sales, orders and door check-ins at a glance.
  Login: ADMIN_PIN → a 12 h session token (netlify/functions/lib/pinGuard.js).
  Data: POST /.netlify/functions/admin-data { token }, reloaded live on every
  DB change (lib/useLive.jsx + supabase/008_live.sql), fallback poll 20 s.
  Actions (resend tickets, printable guest list): /.netlify/functions/admin-action.
*/

const TOKEN_KEY = 'irottko-admin-token';

const store = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v) => {
    try {
      v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
};

// auth: { token } or { pin }. → { auth:false, locked? } | { auth:true, status, data }
async function call(fn, auth, extra = {}) {
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, ...extra }),
  });
  if (res.status === 401) return { auth: false };
  if (res.status === 429 && fn === 'admin-data') return { auth: false, locked: true };
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500 && fn === 'admin-data') throw new Error(`HTTP ${res.status}`);
  return { auth: true, status: res.status, data };
}
const load = (auth) => call('admin-data', auth);

// The session token, for actions deep in the tabs.
const AdminAuth = createContext({ token: '', logout: () => {} });

const TZ = 'Europe/Budapest';
// Grouped thousands with a non-breaking space ("9 992 Ft") – Intl hu-HU leaves 4-digit numbers ungrouped.
const num = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const huf = (n) => `${num(n)} Ft`;
const dt = (iso) =>
  iso ? new Date(iso).toLocaleString('hu-HU', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
const tm = (iso) => (iso ? new Date(iso).toLocaleTimeString('hu-HU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–');
const day = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ------------------------------------------------------------------ */

export default function TicketAdmin() {
  const [pin, setPin] = useState(store.get); // the session token
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const logout = () => {
    store.set('');
    setPin('');
    setData(null);
  };

  const refresh = useCallback(async () => {
    if (!pin) return;
    setLoading(true);
    try {
      const r = await load({ token: pin });
      if (!r.auth) return logout();
      setData(r.data);
      setError('');
    } catch {
      setError('Nem sikerült frissíteni – nincs kapcsolat a szerverrel.');
    } finally {
      setLoading(false);
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useLive(refresh, { enabled: !!pin, minGapMs: 1500 });

  if (!pin)
    return (
      <PinScreen
        onUnlock={(token, d) => {
          store.set(token);
          setData(d);
          setPin(token);
        }}
      />
    );

  return (
    <main className="min-h-[100dvh] bg-[#05030a] text-[#f5f5f7]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="kicker text-[10px]">One Night at Írottkő</div>
            <h1 className="mt-1 text-2xl font-semibold">Admin</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <LiveBadge status={live} />
            {data && <span>Frissítve: {tm(data.generatedAt)}</span>}
            <button onClick={refresh} className="rounded-full p-2.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Frissítés">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={logout} className="rounded-full p-2.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Kilépés">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {error && <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>}

        <AdminAuth.Provider value={{ token: pin, logout }}>
          {!data ? <p className="mt-16 text-center text-gray-500">Betöltés…</p> : <Dashboard d={data} />}
        </AdminAuth.Provider>
      </div>
    </main>
  );
}

/* ------------------------------ PIN ------------------------------- */

function PinScreen({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await load({ pin: value });
      if (r.auth && r.data.token) onUnlock(r.data.token, r.data);
      else {
        setError(r.locked ? 'Túl sok hibás próbálkozás. Próbáld újra 15 perc múlva.' : 'Hibás PIN.');
        setValue('');
      }
    } catch {
      setError('Nincs kapcsolat a szerverrel.');
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#05030a] px-6">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <div className="kicker">One Night at Írottkő</div>
        <h1 className="display mt-3 text-3xl">Admin</h1>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 16))}
          placeholder="PIN"
          className="field mt-8 text-center text-2xl tracking-[0.5em]"
        />
        <div className="mt-3 min-h-5 text-sm text-red-400">{error}</div>
        <button type="submit" disabled={busy || !value} className="btn-primary mt-2 w-full disabled:opacity-40">
          {busy ? 'Ellenőrzés…' : 'Belépés'}
        </button>
      </form>
    </main>
  );
}

/* --------------------------- Dashboard ---------------------------- */

const TABS = [
  ['sales', 'Eladás'],
  ['orders', 'Rendelések'],
  ['door', 'Beléptetés'],
];

function Dashboard({ d }) {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('irottko-admin-tab') || 'sales';
    } catch {
      return 'sales';
    }
  });
  const pick = (t) => {
    setTab(t);
    try {
      localStorage.setItem('irottko-admin-tab', t);
    } catch {
      /* ignore */
    }
  };

  const t = d.totals;
  const bad = d.scanResults.already_used + d.scanResults.not_found + d.scanResults.not_paid;

  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Eladott jegy" value={num(t.ticketsSold)} sub={`${num(t.standardSold)} normál · ${num(t.vipSold)} VIP${t.doorSold ? ` · ${num(t.doorSold)} helyszíni` : ''}`} />
        <Stat label="Bevétel (bruttó)" value={huf(t.revenue)} sub={`${num(t.orders)} rendelés · átlag ${huf(t.avgOrder)}`} gold />
        <Stat label="Bent van" value={`${num(t.checkedIn)} / ${num(t.ticketsSold)}`} sub={`${pct(t.checkedIn, t.ticketsSold)}% beléptetve · ${num(t.vipCheckedIn)} VIP`} />
        <Stat
          label="Beolvasás"
          value={num(t.scans)}
          sub={
            <>
              {num(d.scanResults.ok)} jó · <span className={bad ? 'text-red-400' : ''}>{num(bad)} elutasítva</span>
            </>
          }
        />
      </section>

      <nav className="mt-8 flex gap-1 border-b border-white/10">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => pick(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === k ? 'border-[#d4af37] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {k === 'orders' && (d.problems.some((o) => !o.emailSent) || d.paymentIssues?.length > 0) && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />}
            {k === 'door' && d.duplicates.length > 0 && <span className="ml-1.5 text-xs text-red-400">{d.duplicates.length}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'sales' && <Sales d={d} />}
        {tab === 'orders' && <Orders d={d} />}
        {tab === 'door' && <Door d={d} />}
      </div>
    </>
  );
}

function Stat({ label, value, sub, gold }) {
  return (
    <div className="surface p-4 sm:p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${gold ? 'text-[#d4af37]' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-[13px] text-gray-400">{sub}</div>
    </div>
  );
}

function Card({ title, right, children, className = '' }) {
  return (
    <section className={`surface min-w-0 p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ----------------------------- Sales ------------------------------ */

function Sales({ d }) {
  const t = d.totals;
  const lostOrders = (d.orderStatus.expired || 0) + (d.orderStatus.cancelled || 0);
  const tiers = [...d.tiers].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'vip' ? 1 : -1));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
      <Card title="Eladott jegyek naponta" className="lg:col-span-2">
        <BarChart
          data={d.daily.map((x) => ({ label: day(x.day), value: x.tickets, tip: `${day(x.day)}: ${num(x.tickets)} jegy · ${huf(x.revenue)}` }))}
          empty="Még nincs eladás."
        />
      </Card>

      <Card title="Keret">
        {t.onlineLeft != null && (
          <Meter label="Online normál jegy" used={d.event.onlineCapacity - t.onlineLeft} total={d.event.onlineCapacity} left={t.onlineLeft} />
        )}
        {t.vipLeft != null && <Meter label="VIP" used={t.vipCapacity - t.vipLeft} total={t.vipCapacity} left={t.vipLeft} />}
        <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
          <Row k="Most fizetés alatt (foglalva)" v={`${num(t.heldNow)} jegy`} />
          <Row k="Megszakított / lejárt fizetés" v={`${num(lostOrders)} rendelés`} />
          <Row k="Jegyeladás" v={d.event.salesOpen ? <span className="text-emerald-400">nyitva</span> : <span className="text-red-400">zárva</span>} />
        </div>
      </Card>

      {/* remount when the saved settings change (e.g. page opened before the migration) */}
      <LimitsCard key={`${d.event.limitOn}-${d.event.venueLimit}-${d.event.nonTicketCount}`} d={d} />

      <Card title="Jegytípusok" className="lg:col-span-3">
        <Table
          head={['Jegytípus', 'Időszak', 'Ár', 'Eladva', 'Bevétel', 'Bent']}
          align={['l', 'l', 'r', 'r', 'r', 'r']}
          rows={tiers.map((x) => [
            <span key="n" className="flex items-center gap-2">
              {x.name}
              {x.kind === 'vip' && <Badge gold>VIP</Badge>}
              {x.channel === 'door' && <Badge>helyszíni</Badge>}
              {x.active && <Badge green>most</Badge>}
            </span>,
            <span key="p" className="text-gray-400">
              {x.from ? dt(x.from) : '–'} → {x.until ? dt(x.until) : '–'}
            </span>,
            huf(x.price),
            x.quantity ? `${num(x.sold)} / ${num(x.quantity)}` : num(x.sold),
            huf(x.revenue),
            num(x.checkedIn),
          ])}
          foot={['Összesen', '', '', num(t.ticketsSold), huf(t.revenue), num(t.checkedIn)]}
        />
      </Card>
    </div>
  );
}

/* Fire-safety limit + emergency stop (supabase/013_venue_limit.sql).
   Sellable tickets = venue limit − people inside without a ticket. Every ticket
   type counts (online, VIP, door QR). Switched off, the numbers are kept but
   sales are unlimited. */
function LimitsCard({ d }) {
  const { token, logout } = useContext(AdminAuth);
  const ev = d.event;
  const migrated = ev.venueLimit != null || ev.nonTicketCount != null;
  const [on, setOn] = useState(ev.limitOn === true);
  const [limit, setLimit] = useState(String(ev.venueLimit ?? ''));
  const [crew, setCrew] = useState(String(ev.nonTicketCount ?? 30));
  const [salesOpen, setSalesOpen] = useState(ev.salesOpen);
  const [msg, setMsg] = useState(null); // [text, ok]
  const [busy, setBusy] = useState(false);
  // last saved values (the live data may lag behind a save by a few seconds)
  const [saved, setSaved] = useState({ on: ev.limitOn === true, limit: String(ev.venueLimit ?? ''), crew: String(ev.nonTicketCount ?? 30) });

  // unsaved edits = differs from the last saved values (new server values remount the card)
  const dirty = on !== saved.on || limit !== saved.limit || crew !== saved.crew;
  useEffect(() => setSalesOpen(ev.salesOpen), [ev.salesOpen]);

  const act = async (action, extra) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await call('admin-action', { token }, { action, ...extra });
      if (!r.auth) return logout();
      if (r.status !== 200) throw new Error(r.data?.error);
      return r.data;
    } catch {
      setMsg(['Nem sikerült menteni. Ellenőrizd a számokat (a létszám nagyobb legyen, mint a jegy nélküliek száma).', false]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const r = await act('set-limits', { venueLimit: Number(limit), nonTicketCount: Number(crew), enabled: Boolean(on) });
    if (r) {
      setSaved({ on: r.enabled, limit: String(r.venueLimit), crew: String(r.nonTicketCount) });
      setMsg([r.enabled ? `Mentve: legfeljebb ${num(r.venueLimit - r.nonTicketCount)} jegy adható el.` : 'Mentve: a plafon KI van kapcsolva, a jegyeladás korlátlan.', true]);
    }
  };
  const toggleSales = async () => {
    const next = !salesOpen;
    const q = next
      ? 'Újraindítod a jegyeladást? (online, VIP és a helyszíni QR-kód is)'
      : 'Leállítod az ÖSSZES jegyeladást most? (online, VIP és a helyszíni QR-kód is)\nA már eladott jegyek érvényesek maradnak.';
    if (!window.confirm(q)) return;
    const r = await act('set-sales-open', { open: next });
    if (r) {
      setSalesOpen(r.salesOpen);
      setMsg([r.salesOpen ? 'A jegyeladás újra nyitva.' : 'A jegyeladás LEÁLLÍTVA.', true]);
    }
  };

  const cap = Number(limit) - Number(crew);
  const live = d.totals.ticketsLive ?? d.totals.ticketsSold;
  const capOk = Number.isInteger(cap) && cap > 0;

  return (
    <Card title="Létszám-plafon és jegyeladás" className="lg:col-span-3">
      {!migrated ? (
        <p className="text-sm text-amber-300">Futtasd le a Supabase-ben a 013_venue_limit.sql-t – utána itt állítható a plafon.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white">
              <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[#d4af37]" />
              Létszám-plafon bekapcsolva
            </label>
            <p className="mt-2 text-sm text-gray-400">
              {on
                ? 'Minden jegyfajta együtt számít (online, VIP, helyszíni QR). Ha elfogy, az oldalon és a kapus telefonján is „Telt ház” látszik.'
                : 'Kikapcsolva a jegyeladás korlátlan (csak az online és a VIP saját kerete számít). A számok megmaradnak.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-400">
                Tűzvédelmi létszám (fő)
                <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} className="field mt-1 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-400">
                Bent jegy nélkül (staff, fellépő, vendég)
                <input inputMode="numeric" value={crew} onChange={(e) => setCrew(e.target.value.replace(/\D/g, ''))} className="field mt-1 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={save} disabled={busy || !dirty || !capOk} className="btn-secondary px-4 py-2 disabled:opacity-40">
                <Check className="h-4 w-4" /> Mentés
              </button>
              <span className="text-sm text-gray-300">
                Eladható jegy összesen: <b className="tabular-nums text-white">{capOk ? num(cap) : '–'}</b>
              </span>
            </div>
          </div>

          <div>
            {ev.limitOn && ev.ticketCap != null ? (
              <Meter
                label="Jegyek a plafonhoz képest (fizetett + fizetés alatt)"
                used={live}
                total={ev.ticketCap}
                left={Math.max(ev.ticketCap - live, 0)}
                note={live >= ev.ticketCap ? 'TELT HÁZ – több jegy nem adható el.' : undefined}
              />
            ) : (
              <p className="mb-4 text-sm text-gray-400">A plafon ki van kapcsolva – eddig {num(live)} jegy kelt el / van fizetés alatt.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="text-sm">
                Jegyeladás:{' '}
                {salesOpen ? <span className="font-semibold text-emerald-400">nyitva</span> : <span className="font-semibold text-red-400">LEÁLLÍTVA</span>}
              </div>
              <button
                onClick={toggleSales}
                disabled={busy}
                className={`btn-secondary px-4 py-2 disabled:opacity-40 ${salesOpen ? '!border-red-500/60 !text-red-300' : ''}`}
              >
                {salesOpen ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />} {salesOpen ? 'Eladás leállítása most' : 'Eladás újraindítása'}
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg[1] ? 'text-emerald-400' : 'text-red-400'}`}>{msg[0]}</p>}
    </Card>
  );
}

function Meter({ label, used, total, left, note }) {
  const p = pct(used, total);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="tabular-nums text-gray-400">
          {num(used)} / {num(total)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#d4af37]" style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-500">{note || `Még ${num(left)} szabad · ${p}% elkelt`}</div>
    </div>
  );
}

/* ----------------------------- Orders ----------------------------- */

function ResendButton({ o }) {
  const { token, logout } = useContext(AdminAuth);
  const [state, setState] = useState(''); // '' | busy | ok | error text
  const send = async () => {
    if (!window.confirm(`Újraküldjük ${o.name} jegyeit (${o.qty} db) erre a címre?\n\n${o.email}`)) return;
    setState('busy');
    try {
      const r = await call('admin-action', { token }, { action: 'resend', orderId: o.id });
      if (!r.auth) return logout();
      if (r.status === 200) return setState('ok');
      setState(r.data.error === 'TOO_SOON' ? 'Az imént ment ki, várj egy percet.' : 'Nem sikerült elküldeni.');
    } catch {
      setState('Nincs kapcsolat.');
    }
  };
  if (state === 'ok') return <span className="text-xs text-emerald-400">Újraküldve</span>;
  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={send}
        disabled={state === 'busy'}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 hover:border-[#d4af37] hover:text-white disabled:opacity-40"
        title="Jegyek újraküldése a vevő e-mail-címére"
      >
        <Send className="h-3 w-3" /> {state === 'busy' ? 'Küldés…' : 'Újraküldés'}
      </button>
      {state && state !== 'busy' && <span className="mt-1 text-[11px] text-red-400">{state}</span>}
    </span>
  );
}

function Orders({ d }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return d.orders;
    return d.orders.filter((o) => [o.name, o.email, o.phone, o.id, o.invoice, o.company].some((v) => v && String(v).toLowerCase().includes(s)));
  }, [q, d.orders]);

  const noEmail = d.orders.filter((o) => !o.emailSent);
  const noInvoice = d.orders.filter((o) => !o.invoice);

  const csv = () => {
    const head = ['Fizetve', 'Név', 'E-mail', 'Telefon', 'Cég', 'Jegyek', 'Darab', 'Összeg (Ft)', 'Bent', 'Számlaszám', 'Jegy e-mail', 'Rendelésszám'];
    const lines = d.orders.map((o) =>
      [dt(o.paidAt), o.name, o.email, o.phone, o.company, o.tiers, o.qty, o.total, o.checkedIn, o.invoice, o.emailSent ? 'elküldve' : 'NEM', o.id]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `irottko-rendelesek-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {d.paymentIssues?.length > 0 && (
        <Alert red>
          <strong>Fizetés-eltérés – kézi ellenőrzés kell!</strong> A Barion szerinti fizetés nem egyezik a rendeléssel, ezért a rendszer nem
          adott ki jegyet:
          <ul className="mt-2 list-disc pl-5">
            {d.paymentIssues.map((o) => (
              <li key={o.id}>
                {o.name} ({o.email}) · {huf(o.total)} · {dt(o.at)} · Barion: <span className="font-mono">{o.paymentId}</span> · {o.error}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {noEmail.length > 0 && (
        <Alert red>
          {noEmail.length} fizetett rendelésnél nem ment ki a jegy e-mail: {noEmail.map((o) => o.name).join(', ')}. A rendszer 5 percenként
          újrapróbálja; azonnal a sor végén lévő „Újraküldés” gombbal küldheted.
        </Alert>
      )}
      {noInvoice.length > 0 && (
        <Alert>
          {noInvoice.length} rendeléshez nincs számla
          {noInvoice.some((o) => o.invoiceError?.includes('MISSING')) ? ' – a Számlázz.hu Agent-kulcs még nincs beállítva.' : '.'}
        </Alert>
      )}

      <Card
        title={`Fizetett rendelések (${num(d.orders.length)})`}
        right={
          <div className="flex w-full gap-2 sm:w-auto">
            <label className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Név, e-mail, rendelésszám…" className="field py-2 !pl-10 text-sm" />
            </label>
            <button onClick={csv} className="btn-secondary shrink-0 px-4 py-2" title="Letöltés Excelhez (CSV)">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        }
      >
        <Table
          head={['Fizetve', 'Vevő', 'Jegyek', 'Összeg', 'Bent', 'Számla', 'E-mail', '']}
          align={['l', 'l', 'l', 'r', 'r', 'l', 'l', 'l']}
          rows={rows.map((o) => [
            <span key="t" className="whitespace-nowrap text-gray-400">{dt(o.paidAt)}</span>,
            <div key="n">
              <div className="text-white">{o.name}</div>
              <div className="text-xs text-gray-500">{o.email}{o.company ? ` · ${o.company}` : ''}</div>
            </div>,
            <span key="j" className="flex items-center gap-2">
              {o.tiers}
              {o.vip && <Badge gold>VIP</Badge>}
            </span>,
            <span key="s" className="whitespace-nowrap">{huf(o.total)}</span>,
            <span key="b" className={o.checkedIn === o.qty && o.qty ? 'text-emerald-400' : ''}>
              {o.checkedIn} / {o.qty}
            </span>,
            o.invoice ? <span key="i">{o.invoice}</span> : <span key="i" className="text-amber-400" title={o.invoiceError || ''}>nincs</span>,
            o.emailSent ? (
              <Check key="e" className="h-4 w-4 text-emerald-400" aria-label="elküldve" />
            ) : (
              <span key="e" className="text-red-400" title={o.emailError || ''}>nem ment ki</span>
            ),
            <ResendButton key="r" o={o} />,
          ])}
          empty={q ? 'Nincs találat.' : 'Még nincs fizetett rendelés.'}
        />
      </Card>
    </div>
  );
}

/* ------------------------------ Door ------------------------------ */

const RESULT = {
  ok: { label: 'Beengedve', cls: 'text-emerald-400', Icon: Check },
  already_used: { label: 'Duplázás', cls: 'text-red-400', Icon: Copy },
  not_found: { label: 'Ismeretlen kód', cls: 'text-red-400', Icon: X },
  not_paid: { label: 'Nem fizetett', cls: 'text-amber-400', Icon: Ban },
};

// Printable emergency list for the door (no internet / scanner down):
// every paid ticket, A–Z by name, with a tick box. Opened in a new window and
// printed from there; the window is opened on the click, so it isn't blocked.
const escHtml = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function guestListHtml(list, generatedAt) {
  const rows = list
    .map(
      (g, i) => `<tr${g.in ? ' class="in"' : ''}><td class="box">${g.in ? '✓' : ''}</td><td>${i + 1}.</td><td><b>${escHtml(g.name)}</b>${
        g.buyer && g.buyer !== g.name ? `<div class="sub">vevő: ${escHtml(g.buyer)}</div>` : ''
      }</td><td>${g.vip ? '<b>VIP</b>' : escHtml(g.tier)}</td><td class="code">${escHtml(g.code)}</td><td>${g.in ? `bent ${tm(g.in)}` : ''}</td></tr>`
    )
    .join('');
  const vip = list.filter((g) => g.vip).length;
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Vendéglista – One Night at Írottkő</title><style>
    body{font:12px/1.35 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#000;margin:24px}
    h1{font-size:18px;margin:0}.meta{color:#555;margin:4px 0 14px}
    table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top}
    th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #000}
    thead{display:table-header-group}tr{break-inside:avoid}
    .box{width:18px;height:18px;border:1.5px solid #000;text-align:center;font-weight:700}
    .code{font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:.05em}
    .sub{color:#666;font-size:10px}.in td{color:#777}
    .note{margin-top:14px;font-size:10px;color:#555}
    @media print{body{margin:0}.noprint{display:none}}
  </style></head><body>
    <button class="noprint" onclick="print()" style="float:right;padding:8px 16px">Nyomtatás</button>
    <h1>One Night at Írottkő – vendéglista</h1>
    <div class="meta">Állapot: ${escHtml(dt(generatedAt))} · ${list.length} jegy · ${vip} VIP · ${list.filter((g) => g.in).length} már bent volt a lista készítésekor</div>
    <table><thead><tr><th></th><th>#</th><th>Név</th><th>Jegy</th><th>Jegykód</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <div class="note">Csak vészhelyzetre (nincs net, nem működik a szkenner). Akit beengedsz, pipáld ki, és nézd meg a nevét a személyiigazolványán.
    Amint újra van net, a szkennerrel olvassátok be a kódokat. BIZALMAS – a rendezvény után semmisítsd meg.</div>
  </body></html>`;
}

function GuestListCard() {
  const { token, logout } = useContext(AdminAuth);
  const [state, setState] = useState('');
  const open = async () => {
    const w = window.open('', '_blank');
    if (!w) return setState('A böngésző letiltotta az új ablakot – engedélyezd a felugró ablakokat.');
    w.document.write('<p style="font:14px sans-serif;margin:24px">Vendéglista betöltése…</p>');
    setState('busy');
    try {
      const r = await call('admin-action', { token }, { action: 'guestlist' });
      if (!r.auth) {
        w.close();
        return logout();
      }
      if (r.status !== 200) throw new Error();
      w.document.open();
      w.document.write(guestListHtml(r.data.guests, r.data.generatedAt));
      w.document.close();
      setState('');
    } catch {
      w.close();
      setState('Nem sikerült betölteni a listát.');
    }
  };
  return (
    <Card title="Vészhelyzeti vendéglista" className="lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-400">
          Ha elmegy a net vagy nem működik a szkenner: minden fizetett jegy ABC-sorrendben, jegykóddal és kipipálható négyzettel.
          Nyomtasd ki kapunyitás előtt, és tegyetek egy példányt minden kapuhoz.
        </p>
        <button onClick={open} disabled={state === 'busy'} className="btn-secondary shrink-0 px-4 py-2 disabled:opacity-40">
          <Printer className="h-4 w-4" /> {state === 'busy' ? 'Betöltés…' : 'Lista nyomtatása'}
        </button>
      </div>
      {state && state !== 'busy' && <p className="mt-2 text-sm text-red-400">{state}</p>}
    </Card>
  );
}

/* Door phone without the PIN: a one-time, 10-minute QR code (lib/enroll.js).
   Works even while PIN logins are locked by a flood of wrong PINs. */
function EnrollCard() {
  const { token, logout } = useContext(AdminAuth);
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState(null); // { id, link, qr, expiresAt }
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [, tick] = useState(0);

  const act = useCallback(
    async (action, extra = {}) => {
      const r = await call('admin-action', { token }, { action, ...extra });
      if (!r.auth) {
        logout();
        return null;
      }
      if (r.status !== 200) throw new Error(r.data?.error || 'ERROR');
      return r.data;
    },
    [token, logout]
  );
  const load = useCallback(() => act('enroll-list').then((d) => d && setList(d.list)).catch(() => {}), [act]);
  useEffect(() => {
    load();
    const id = setInterval(() => {
      tick((n) => n + 1);
      load();
    }, 15000);
    return () => clearInterval(id);
  }, [load]);

  const create = async () => {
    setMsg('');
    try {
      const d = await act('enroll-create', { label });
      if (!d) return;
      const link = `${window.location.origin}/scan#enroll=${d.code}`;
      setIssued({ id: d.id, link, qr: await QRCode.toDataURL(link, { margin: 1, width: 240 }), expiresAt: d.expiresAt });
      setLabel('');
      load();
    } catch {
      setMsg('Nem sikerült kódot készíteni (lefutott a 012-es SQL?).');
    }
  };
  const revoke = async (id) => {
    try {
      await act('enroll-revoke', { id });
      if (issued?.id === id) setIssued(null);
      load();
    } catch {
      setMsg('A visszavonás nem sikerült.');
    }
  };

  const left = issued ? Math.max(0, Math.round((new Date(issued.expiresAt).getTime() - Date.now()) / 60000)) : 0;
  const status = (e) =>
    e.used_at ? ['felhasználva ' + tm(e.used_at), 'text-emerald-400'] : e.revoked_at ? ['visszavonva', 'text-gray-500'] : new Date(e.expires_at) < new Date() ? ['lejárt', 'text-gray-500'] : ['aktív', 'text-[#d4af37]'];

  return (
    <Card title="Kapus telefon hozzáadása PIN nélkül" className="lg:col-span-3">
      <p className="max-w-2xl text-sm text-gray-400">
        Egyszer használható, 10 percig érvényes QR-kód. A kapus a telefonja kamerájával beolvassa, és a szkenner PIN nélkül, 24 órára
        bejelentkezik. Akkor is működik, ha a PIN-es belépést túl sok hibás próbálkozás miatt lezárta a rendszer. Ne fotózd le, ne küldd tovább.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Eszköz neve (pl. 2. kapu)" maxLength={40} className="field max-w-xs py-2 text-sm" />
        <button onClick={create} className="btn-secondary px-4 py-2">
          <Smartphone className="h-4 w-4" /> QR-kód készítése
        </button>
      </div>
      {issued && left > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-5 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4">
          <img src={issued.qr} alt="Regisztrációs QR-kód" className="h-40 w-40 rounded bg-white p-1" />
          <div className="text-sm text-gray-300">
            <div className="font-semibold text-white">Még {left} percig érvényes, egyszer használható.</div>
            <div className="mt-1 text-gray-400">Beolvasás után a lenti listában „felhasználva” lesz.</div>
            <button onClick={() => revoke(issued.id)} className="mt-3 text-[13px] text-red-300 underline">Visszavonás</button>
          </div>
        </div>
      )}
      {list.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5 text-sm">
          {list.map((e) => {
            const [txt, cls] = status(e);
            const active = txt === 'aktív';
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-gray-300">
                  {e.label || 'Névtelen eszköz'} <span className="text-gray-500">· {tm(e.created_at)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={cls}>{txt}</span>
                  {active && (
                    <button onClick={() => revoke(e.id)} className="text-[13px] text-red-300 underline">
                      Visszavonás
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
    </Card>
  );
}

function Door({ d }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const t = d.totals;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.scans.filter(
      (x) => (filter === 'all' || x.result === filter) && (!s || [x.name, x.email, x.code].some((v) => v && v.toLowerCase().includes(s)))
    );
  }, [d.scans, filter, q]);

  const slot = (iso) => new Date(iso).toLocaleTimeString('hu-HU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-3">
        {Object.entries(RESULT).map(([k, r]) => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? 'all' : k)}
            className={`surface p-4 text-left transition-colors ${filter === k ? 'border-[#d4af37]' : 'hover:border-white/25'}`}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              <r.Icon className={`h-4 w-4 ${r.cls}`} /> {r.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{num(d.scanResults[k])}</div>
          </button>
        ))}
      </section>

      <Card title="Belépések 15 percenként" className="lg:col-span-2">
        <BarChart
          data={d.entries.map((x) => ({ label: slot(x.slot), value: x.count, tip: `${slot(x.slot)}: ${num(x.count)} belépő` }))}
          empty="Még senki nem lépett be."
        />
      </Card>

      <Card title="Bent van">
        <Meter label="Összes jegy" used={t.checkedIn} total={t.ticketsSold} note={`${pct(t.checkedIn, t.ticketsSold)}% bent · még ${num(t.ticketsSold - t.checkedIn)} vendég érkezhet`} />
        <Meter label="VIP" used={t.vipCheckedIn} total={t.vipSold} note={`${pct(t.vipCheckedIn, t.vipSold)}% bent · még ${num(t.vipSold - t.vipCheckedIn)} VIP érkezhet`} />
      </Card>

      <GuestListCard />
      <EnrollCard />

      {d.duplicates.length > 0 && (
        <Card title={`Duplázni próbálták (${d.duplicates.length} jegy)`} className="lg:col-span-3">
          <Table
            head={['Név', 'Jegy', 'Először belépett', 'Próbálkozás', 'Utoljára']}
            align={['l', 'l', 'l', 'r', 'l']}
            rows={d.duplicates.map((x) => [
              <div key="n">
                <div className="text-white">{x.name}</div>
                <div className="text-xs text-gray-500">{x.email}</div>
              </div>,
              x.tier,
              tm(x.firstIn),
              <span key="a" className="font-semibold text-red-400">{x.attempts}×</span>,
              tm(x.last),
            ])}
          />
        </Card>
      )}

      <Card
        title={`Beolvasási napló (${num(rows.length)})`}
        className="lg:col-span-3"
        right={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="field !w-auto py-2 text-sm">
              <option value="all">Mind</option>
              {Object.entries(RESULT).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Név, e-mail, kód…" className="field py-2 !pl-10 text-sm" />
            </label>
          </div>
        }
      >
        <Table
          head={['Idő', 'Eredmény', 'Név', 'Jegy', 'Kód']}
          align={['l', 'l', 'l', 'l', 'l']}
          rows={rows.slice(0, 300).map((x) => {
            const r = RESULT[x.result] || RESULT.not_found;
            return [
              <span key="t" className="whitespace-nowrap text-gray-400">{dt(x.at)}</span>,
              <span key="r" className={`flex items-center gap-1.5 whitespace-nowrap ${r.cls}`}>
                <r.Icon className="h-4 w-4" /> {r.label}
                {x.firstIn && <span className="text-xs text-gray-500">(bent: {tm(x.firstIn)})</span>}
              </span>,
              x.name || <span key="n" className="text-gray-600">–</span>,
              x.tier || '–',
              <span key="c" className="font-mono text-xs text-gray-500">{x.code}</span>,
            ];
          })}
          empty="Nincs beolvasás."
        />
        {rows.length > 300 && <p className="mt-3 text-xs text-gray-500">A legutóbbi 300 látszik – szűrj vagy keress a többihez.</p>}
      </Card>
    </div>
  );
}

/* ---------------------------- Pieces ------------------------------ */

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-400">{k}</span>
      <span className="tabular-nums text-white">{v}</span>
    </div>
  );
}

function Badge({ children, gold, green }) {
  const c = gold ? 'bg-[#d4af37] text-black' : green ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-gray-300';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c}`}>{children}</span>;
}

function Alert({ children, red }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${
        red ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Table({ head, rows, foot, align, empty = 'Nincs adat.' }) {
  const a = (i) => (align?.[i] === 'r' ? 'text-right' : 'text-left');
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
            {head.map((h, i) => (
              <th key={i} className={`pb-2 pr-4 font-medium last:pr-0 ${a(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r, j) => (
            <tr key={j} className="border-b border-white/5 last:border-0">
              {r.map((c, i) => (
                <td key={i} className={`py-2.5 pr-4 align-middle last:pr-0 ${a(i)}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-white/15 font-semibold text-white">
              {foot.map((c, i) => (
                <td key={i} className={`pt-3 pr-4 last:pr-0 ${a(i)}`}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// Single-series bar chart: gold bars, 2px gaps, rounded tops, hover tooltip.
function BarChart({ data, empty }) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <p className="py-14 text-center text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...data.map((x) => x.value), 1);
  const every = Math.ceil(data.length / 8);
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 h-5 text-sm text-gray-300">{h ? h.tip : <span className="text-gray-600">Vidd az egeret egy oszlopra</span>}</div>
      <div className="relative flex h-44 items-end gap-[2px] border-b border-white/15" onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-white/10" />
        <span className="pointer-events-none absolute -top-1 right-0 -translate-y-full text-[11px] text-gray-500">{num(max)}</span>
        {data.map((x, i) => (
          <div
            key={i}
            className="flex h-full min-w-0 flex-1 cursor-default items-end"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
            title={x.tip}
          >
            <div
              className={`w-full max-w-[48px] mx-auto rounded-t-[4px] transition-opacity ${hover == null || hover === i ? 'bg-[#d4af37]' : 'bg-[#d4af37]/40'}`}
              style={{ height: `${Math.max((x.value / max) * 100, x.value ? 2 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((x, i) => (
          <div key={i} className="min-w-0 flex-1 truncate text-center text-[11px] text-gray-500">
            {i % every === 0 || i === data.length - 1 ? x.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
