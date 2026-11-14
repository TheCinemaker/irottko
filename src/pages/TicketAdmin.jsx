import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLive, LiveBadge } from '../lib/useLive';
import { RefreshCw, LogOut, Download, Search, AlertTriangle, Check, X, Copy, Ban, Send, Printer } from 'lucide-react';

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
const nf = new Intl.NumberFormat('hu-HU');
const num = (n) => nf.format(n ?? 0);
const huf = (n) => `${nf.format(n ?? 0)} Ft`;
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
          <Row k="Online eladás" v={d.event.salesOpen ? <span className="text-emerald-400">nyitva</span> : <span className="text-red-400">zárva</span>} />
        </div>
      </Card>

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
