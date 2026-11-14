import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Check, X, WifiOff, Volume2, VolumeX, LogOut, Flashlight, FlashlightOff } from 'lucide-react';
import { useLive, LiveBadge } from '../lib/useLive';

/*
  Door scanner (/scan). Staff unlock it with the PIN (SCANNER_PIN on the server),
  which returns a 24 h session token; scans send the token, not the PIN.
  Every scan goes to /.netlify/functions/check-in → check_in() in Supabase,
  which lets a ticket in exactly once and logs the scan in check_ins.

  Weak signal at the door: every request gives up after REQUEST_TIMEOUT_MS and
  shows "Nincs kapcsolat" instead of hanging. If the timed-out request did reach
  the server, the rescan answers "already used" with an entry time from that
  moment – that case is shown as green (it was this scan that let them in).
*/

const TOKEN_KEY = 'irottko-scanner-token';
const REQUEST_TIMEOUT_MS = 6000;
const LOST_ANSWER_WINDOW_MS = 90_000;
const SAME_CODE_PAUSE_MS = 6000; // the same QR stays in front of the camera after a scan
const OK_AUTO_CLOSE_MS = 2500;

const store = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v) => {
    try {
      v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode – the session just isn't remembered */
    }
  },
};

// auth: { token } or { pin }. Throws on network error / timeout / server error.
async function callCheckIn(auth, code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('/.netlify/functions/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...auth, code }),
      signal: ctrl.signal,
    });
    if (res.status === 401) return { auth: false };
    if (res.status === 429) return { auth: false, locked: (await res.json().catch(() => ({}))).minutes || 15 };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { auth: true, data: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const timeHu = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';

/* ------------------------------------------------------------------ */

export default function TicketScanner() {
  const [token, setToken] = useState(store.get);
  const [expired, setExpired] = useState(false);

  const logout = (isExpired = false) => {
    store.set('');
    setToken('');
    setExpired(isExpired === true);
  };

  if (!token) {
    return (
      <PinScreen
        expired={expired}
        onUnlock={(t) => {
          store.set(t);
          setToken(t);
          setExpired(false);
        }}
      />
    );
  }
  return <Scanner token={token} onLogout={logout} />;
}

/* ------------------------------ PIN ------------------------------- */

function PinScreen({ onUnlock, expired }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(expired ? 'A munkamenet lejárt, add meg újra a PIN-t.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const r = await callCheckIn({ pin: value }, '');
      if (r.auth && r.data.token) onUnlock(r.data.token);
      else {
        setError(r.locked ? `Túl sok hibás próbálkozás. Próbáld újra ${r.locked} perc múlva.` : 'Hibás PIN.');
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
        {/* error line can be two lines long (lock-out) */}
        <div className="kicker">One Night at Írottkő</div>
        <h1 className="display mt-3 text-3xl">Beléptetés</h1>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 12))}
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

/* ---------------------------- Scanner ----------------------------- */

function Scanner({ token, onLogout }) {
  const online = useOnline();
  const [torch, setTorch] = useState(null); // null: not supported, false/true: off/on
  const lostRef = useRef(new Map()); // code → time of a scan whose answer never came
  const [camera, setCamera] = useState('idle'); // idle | starting | on | error
  const [result, setResult] = useState(null); // { type: ok|used|invalid|offline, data }
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null); // { in, waiting } – live (lib/useLive.jsx)
  const [sound, setSound] = useState(true);
  const [manual, setManual] = useState('');

  const qrRef = useRef(null);
  const busyRef = useRef(false);
  const resultRef = useRef(null);
  const lastRef = useRef({ code: '', at: 0 });
  const audioRef = useRef(null);
  const soundRef = useRef(true);
  soundRef.current = sound;
  resultRef.current = result;

  const beep = (ok) => {
    try {
      navigator.vibrate?.(ok ? 80 : [200, 100, 200]);
    } catch {
      /* ignore */
    }
    if (!soundRef.current) return;
    try {
      const ctx = (audioRef.current ||= new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      osc.type = ok ? 'sine' : 'square';
      osc.frequency.setValueAtTime(ok ? 880 : 220, t);
      if (ok) osc.frequency.setValueAtTime(1320, t + 0.1);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (ok ? 0.3 : 0.6));
      osc.start(t);
      osc.stop(t + (ok ? 0.3 : 0.6));
    } catch {
      /* no audio */
    }
  };

  const check = useCallback(
    async (raw) => {
      const code = String(raw || '').trim();
      if (!code || busyRef.current || resultRef.current) return;
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_PAUSE_MS) return;
      lastRef.current = { code, at: now };

      busyRef.current = true;
      setBusy(true);
      const sentAt = Date.now();
      try {
        const r = await callCheckIn({ token }, code);
        if (!r.auth) return onLogout(true);
        const d = r.data;
        if (typeof d.total_in === 'number')
          setStats((s) => s && { ...s, in: d.total_in, waiting: d.ok ? Math.max(s.waiting - 1, 0) : s.waiting });
        let type = d.ok ? 'ok' : d.reason === 'ALREADY_USED' ? 'used' : 'invalid';
        // An earlier scan of this code timed out here, but the server did let it
        // in (entry time = that attempt) → it was us: show green, not red.
        const lostAt = lostRef.current.get(d.code || code);
        if (type === 'used' && lostAt && d.checked_in_at) {
          const inAt = new Date(d.checked_in_at).getTime();
          if (inAt >= lostAt - 5000 && inAt <= lostAt + REQUEST_TIMEOUT_MS + 5000) type = 'ok-late';
        }
        lostRef.current.delete(d.code || code);
        setResult({ type, data: d });
        beep(type === 'ok' || type === 'ok-late');
      } catch {
        const now2 = Date.now();
        for (const [c, t] of lostRef.current) if (now2 - t > LOST_ANSWER_WINDOW_MS) lostRef.current.delete(c);
        lostRef.current.set(code.toUpperCase().replace(/[^0-9A-Z]/g, ''), sentAt);
        lastRef.current = { code: '', at: 0 }; // let the same code be scanned again
        setResult({ type: 'offline', data: { code } });
        beep(false);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [token, onLogout] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Live door counters: reload on every ping from the DB (008_live.sql).
  const live = useLive(async () => {
    const r = await callCheckIn({ token }, '');
    if (!r.auth) return onLogout(true);
    if (r.data.stats) setStats(r.data.stats);
  });

  const startingRef = useRef(null);

  const startCamera = useCallback(async () => {
    if (qrRef.current) return;
    setCamera('starting');
    const qr = new Html5Qrcode('qr-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
    qrRef.current = qr;
    startingRef.current = qr.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.7), height: Math.floor(Math.min(w, h) * 0.7) }) },
      (text) => check(text),
      () => {}
    );
    try {
      await startingRef.current;
      if (qrRef.current === qr) {
        setCamera('on');
        try {
          const t = qr.getRunningTrackCameraCapabilities().torchFeature();
          setTorch(t.isSupported() ? false : null);
        } catch {
          setTorch(null);
        }
      }
    } catch (e) {
      console.warn('Camera failed:', e);
      if (qrRef.current === qr) {
        qrRef.current = null;
        setCamera('error');
      }
    }
  }, [check]);

  // Start the camera once; stop it when leaving the page. The start is
  // deferred a tick so React StrictMode's mount→unmount→mount in dev
  // doesn't open the camera twice.
  useEffect(() => {
    const timer = setTimeout(startCamera, 0);
    return () => {
      clearTimeout(timer);
      const qr = qrRef.current;
      const starting = startingRef.current;
      qrRef.current = null;
      if (qr)
        Promise.resolve(starting)
          .catch(() => {})
          .then(() => qr.stop())
          .catch(() => {})
          .finally(() => {
            try {
              qr.clear();
            } catch {
              /* already cleared */
            }
          });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    try {
      const next = !torch;
      await qrRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorch(next);
    } catch {
      setTorch(null); // the camera refused – hide the button
    }
  };

  // A green result closes itself; red ones wait for a tap.
  useEffect(() => {
    if (result?.type !== 'ok' && result?.type !== 'ok-late') return;
    const t = setTimeout(() => setResult(null), OK_AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [result]);

  const submitManual = (e) => {
    e.preventDefault();
    lastRef.current = { code: '', at: 0 };
    check(manual);
    setManual('');
  };

  return (
    <main className="min-h-[100dvh] bg-[#05030a] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-6 pt-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="kicker text-[10px]">One Night at Írottkő</div>
            <div className="text-lg font-semibold">Beléptetés</div>
          </div>
          <div className="flex items-center gap-1">
            {torch !== null && (
              <button
                onClick={toggleTorch}
                className={`rounded-full p-2.5 ${torch ? 'bg-[#d4af37] text-black' : 'text-gray-400 hover:text-white'}`}
                aria-label={torch ? 'Lámpa kikapcsolása' : 'Lámpa bekapcsolása'}
                aria-pressed={torch}
              >
                {torch ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
              </button>
            )}
            <button onClick={() => setSound((s) => !s)} className="rounded-full p-2.5 text-gray-400 hover:text-white" aria-label="Hang">
              {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button onClick={() => onLogout()} className="rounded-full p-2.5 text-gray-400 hover:text-white" aria-label="Kilépés">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <DoorStats stats={stats} live={live} />

        {!online && (
          <div role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black">
            <WifiOff className="h-4 w-4 shrink-0" />
            Nincs internet – a jegyeket most nem lehet ellenőrizni.
          </div>
        )}

        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-black">
          <div id="qr-reader" className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
          {camera !== 'on' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              {camera === 'error' ? (
                <>
                  <p className="text-sm text-gray-300">Nem sikerült elindítani a kamerát. Engedélyezd a kamerát a böngészőben.</p>
                  <button onClick={startCamera} className="btn-primary">
                    Kamera indítása
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400">Kamera indítása…</p>
              )}
            </div>
          )}
          {busy && (
            <div className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-sm text-gray-200">Ellenőrzés…</div>
          )}
        </div>

        <p className="mt-3 text-center text-sm text-gray-500">Tartsd a QR-kódot a keretbe.</p>

        <form onSubmit={submitManual} className="mt-auto flex gap-2 pt-6">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="Jegykód kézzel"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="field font-mono text-sm tracking-widest"
          />
          <button type="submit" disabled={!manual.trim() || busy} className="btn-secondary shrink-0 px-5 disabled:opacity-40">
            Ellenőrzés
          </button>
        </form>
      </div>

      {result && <ResultScreen result={result} onClose={() => setResult(null)} />}
    </main>
  );
}

/* --------------------------- Door stats --------------------------- */

function DoorStats({ stats, live }) {
  const total = stats ? stats.in + stats.waiting : 0;
  const share = total ? Math.round((stats.in / total) * 100) : 0;
  return (
    <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" aria-live="polite">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold leading-none tabular-nums text-[#d4af37]">{stats ? stats.in : '–'}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">bent</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-semibold leading-none tabular-nums">{stats ? stats.waiting : '–'}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">még nem jött</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold leading-none tabular-nums text-gray-300">{stats ? total : '–'}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">összes jegy</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#d4af37] transition-[width] duration-500" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{stats ? `${share}% bent` : 'Betöltés…'}</span>
        <LiveBadge status={live} />
      </div>
    </section>
  );
}

/* ----------------------------- Result ----------------------------- */

const LOOK = {
  ok: { bg: 'bg-emerald-600', Icon: Check, title: 'Érvényes jegy' },
  'ok-late': { bg: 'bg-emerald-600', Icon: Check, title: 'Érvényes jegy' },
  used: { bg: 'bg-red-600', Icon: X, title: 'Már felhasznált' },
  invalid: { bg: 'bg-red-600', Icon: X, title: 'Érvénytelen jegy' },
  offline: { bg: 'bg-amber-500', Icon: WifiOff, title: 'Nincs kapcsolat' },
};

function ResultScreen({ result, onClose }) {
  const { type, data } = result;
  const { bg, Icon, title } = LOOK[type];
  const vip = data.kind === 'vip';

  let detail = null;
  if (type === 'used') detail = `Ezzel a jeggyel ${timeHu(data.checked_in_at)}-kor már beléptek.`;
  if (type === 'invalid')
    detail = data.reason === 'NOT_PAID' ? 'A jegy nincs kifizetve vagy sztornózták.' : 'Ilyen jegykód nincs a rendszerben.';
  if (type === 'offline') detail = 'Nem jött válasz 6 másodpercen belül. Olvasd be újra, ha visszajött a net.';
  if (type === 'ok-late') detail = `Az előző, megszakadt beolvasásnál ${timeHu(data.checked_in_at)}-kor már beléptettük – mehet.`;

  return (
    <button
      type="button"
      onClick={onClose}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${bg}`}
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-14 w-14" strokeWidth={3} />
      </div>
      <div className="mt-6 text-4xl font-bold uppercase tracking-wide">{title}</div>

      {data.name && <div className="mt-5 text-3xl font-semibold">{data.name}</div>}

      {data.tier && (
        <div className={`mt-3 rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-widest ${vip ? 'bg-[#d4af37] text-black' : 'bg-black/25'}`}>
          {vip ? 'VIP Lounge' : data.tier}
        </div>
      )}

      {(type === 'ok' || type === 'ok-late') && vip && <div className="mt-4 text-lg font-bold">VIP karszalagot adj!</div>}

      {data.order_tickets > 1 && type !== 'invalid' && (
        <div className="mt-4 text-base opacity-90">
          Csoportos rendelés: {data.order_in} / {data.order_tickets} jegy beléptetve
        </div>
      )}

      {detail && <div className="mt-4 max-w-xs text-lg opacity-95">{detail}</div>}

      {data.code && <div className="mt-6 font-mono text-xs tracking-widest opacity-70">{data.code}</div>}

      <div className="absolute inset-x-0 bottom-10 text-sm font-semibold uppercase tracking-widest opacity-80">
        {type === 'ok' || type === 'ok-late' ? 'Koppints a folytatáshoz' : 'Koppints a bezáráshoz'}
      </div>
    </button>
  );
}
