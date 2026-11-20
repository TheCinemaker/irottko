import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Check, X, WifiOff, Volume2, VolumeX, LogOut, Flashlight, FlashlightOff } from 'lucide-react';
import { useLive, LiveBadge } from '../lib/useLive';
import { createDoor } from '../lib/offlineDoor';

/*
  Door scanner (/scan). Staff unlock it with the PIN (SCANNER_PIN on the server),
  which returns a 24 h session token; scans send the token, not the PIN.
  Every scan goes to /.netlify/functions/check-in → check_in() in Supabase,
  which lets a ticket in exactly once and logs the scan in check_ins.

  Offline mode (src/lib/offlineDoor.js): after login the phone downloads every
  valid ticket and refreshes the list every minute. A scan asks the server
  first; with no answer in 2 s (or known to be offline) it decides from the
  list and queues the entry for upload. A code not on the list (bought a
  minute ago) gets an amber screen: staff check the guest's ticket and decide.
  The page itself is kept on the phone by public/scan-sw.js.

  Without the list (not downloaded yet): every request gives up after REQUEST_TIMEOUT_MS and
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

// Offline door mode (src/lib/offlineDoor.js): one copy per page.
const door = createDoor();
// With the ticket list on the phone a scan waits this long for the server, then decides locally.
const ONLINE_WAIT_WITH_LIST_MS = 2000;
const LIST_REFRESH_MS = 60_000;

function useDoorState() {
  const [state, setState] = useState(() => door.state());
  useEffect(() => door.subscribe(() => setState(door.state())), []);
  return state;
}

// Background: upload entries made without network, then download the fresh
// list. Never blocks a scan (own request, own timer).
async function syncDoor(token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('/.netlify/functions/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, list: true, sync: door.pending() }),
      signal: ctrl.signal,
    });
    if (res.status === 401) return { auth: false };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const clashes = door.synced(d.synced);
    door.setList(d.list);
    return { auth: true, clashes };
  } finally {
    clearTimeout(timer);
  }
}

// Keeps the scanner page (and its code) on the phone, so it opens again even
// with no network (public/scan-sw.js, scope /scan only – not the public site).
function useScannerCache() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/scan-sw.js', { scope: '/scan' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = [
          window.location.pathname,
          ...performance
            .getEntriesByType('resource')
            .map((e) => e.name)
            .filter((u) => u.startsWith(window.location.origin) && !u.includes('/.netlify/')),
        ];
        reg.active?.postMessage({ type: 'cache', urls });
      })
      .catch((e) => console.warn('Scanner cache failed:', e));
  }, []);
}

// auth: { token } or { pin }. Throws on network error / timeout / server error.
async function callCheckIn(auth, code, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

// One-time device code from the admin page: /scan#enroll=<code> (lib/enroll.js).
// Read from the #fragment, so it never reaches server logs or a Referer header.
const takeEnrollCode = () => {
  const m = window.location.hash.match(/enroll=([A-Za-z0-9_-]{43})/);
  if (m) window.history.replaceState(null, '', window.location.pathname); // don't leave it in the address bar
  return m ? m[1] : '';
};

export default function TicketScanner() {
  const [token, setToken] = useState(store.get);
  const [expired, setExpired] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  useEffect(() => {
    const code = takeEnrollCode();
    if (!code) return;
    setEnrollMsg('Eszköz regisztrálása…');
    fetch('/.netlify/functions/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enroll: code }) })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.token) {
          store.set(d.token);
          setToken(d.token);
          setEnrollMsg('');
        } else setEnrollMsg('Ez a regisztrációs kód lejárt, visszavonták, vagy már felhasználták. Kérj újat az admintól, vagy lépj be a PIN-nel.');
      })
      .catch(() => setEnrollMsg('Nincs kapcsolat a szerverrel – próbáld újra a QR-kóddal.'));
  }, []);

  const logout = (isExpired = false) => {
    const waiting = door.pending().length;
    if (isExpired !== true && waiting && !window.confirm(`${waiting} net nélküli beléptetés még nincs feltöltve. A következő belépés után feltöltődnek. Kilépsz?`)) return;
    door.clear(); // the ticket list goes; entries not uploaded yet stay
    store.set('');
    setToken('');
    setExpired(isExpired === true);
  };

  if (!token) {
    return (
      <PinScreen
        expired={expired}
        notice={enrollMsg}
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

function PinScreen({ onUnlock, expired, notice }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(expired ? 'A munkamenet lejárt, add meg újra a PIN-t.' : '');
  useEffect(() => {
    if (notice) setError(notice);
  }, [notice]);
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
        setError(r.locked ? `Túl sok hibás próbálkozás. Próbáld újra ${r.locked} perc múlva, vagy kérj belépő QR-kódot az admintól.` : 'Hibás PIN.');
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
  const browserOnline = useOnline();
  // The browser says "online" on a dead 4G too: a failed request sets this
  // until a request goes through again (a scan or the background sync).
  const [netDown, setNetDownState] = useState(false);
  const netDownRef = useRef(false);
  const setNetDown = (v) => {
    netDownRef.current = v;
    setNetDownState(v);
  };
  const online = browserOnline && !netDown;
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
      const haveList = door.state().ready;

      // No network (or no answer in time) and the list is on the phone: decide here.
      const decideLocally = async () => {
        const r = await door.check(code);
        if (r.type === 'nolist') return false;
        const type = r.type === 'ok' ? 'ok' : r.type === 'used' ? 'used' : 'unknown';
        setResult({ type, data: { ...r, offline: true } });
        beep(type === 'ok');
        return true;
      };

      try {
        // Known to be offline: no waiting at all, the queue at the door keeps moving.
        if (haveList && (navigator.onLine === false || netDownRef.current)) {
          await decideLocally();
          return;
        }
        const r = await callCheckIn({ token }, code, haveList ? ONLINE_WAIT_WITH_LIST_MS : REQUEST_TIMEOUT_MS);
        setNetDown(false);
        if (!r.auth) return onLogout(true);
        const d = r.data;
        if (d.ok) door.markOnline(d.code || code);
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
        setNetDown(true);
        // The upload of a local entry sorts out an online request that did
        // reach the server (same entry within ±20 s, 018 SQL).
        if (haveList && (await decideLocally().catch(() => false))) return;
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

  // Offline list: right after login, then every minute and whenever the
  // network comes back. Runs beside the scans, never in their way.
  const doorState = useDoorState();
  const [clash, setClash] = useState(0); // entries another gate had already let in
  const [badManual, setBadManual] = useState(0); // codes let in by hand that weren't valid tickets
  const syncingRef = useRef(false);
  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const r = await syncDoor(token);
      setNetDown(false);
      if (!r.auth) return onLogout(true);
      const twice = r.clashes.filter((c) => c.reason === 'ALREADY_USED').length;
      const bad = r.clashes.length - twice; // let in by hand, but not a valid ticket
      if (twice) setClash((n) => n + twice);
      if (bad) setBadManual((n) => n + bad);
    } catch {
      setNetDown(true); // no network – the next round tries again
    } finally {
      syncingRef.current = false;
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, [runSync]);
  useEffect(() => {
    // Offline: look for the network every 15 s, so the scans go back to the server soon.
    const timer = setInterval(runSync, netDown ? 15_000 : LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [runSync, netDown]);
  useScannerCache();

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

        <DoorStats
          stats={!online && doorState.ready ? { in: doorState.used, waiting: doorState.total - doorState.used, left: null } : stats}
          live={live}
        />

        <DoorListBar online={online} state={doorState} />

        {clash > 0 && (
          <button
            type="button"
            onClick={() => setClash(0)}
            className="mt-2 w-full rounded-2xl bg-red-600/90 px-4 py-2 text-left text-sm text-white"
          >
            {clash} net nélkül beengedett jegyet egy másik kapu is beengedett. Az admin a duplázók között mutatja. (Koppints a bezáráshoz.)
          </button>
        )}
        {badManual > 0 && (
          <button
            type="button"
            onClick={() => setBadManual(0)}
            className="mt-2 w-full rounded-2xl bg-red-600/90 px-4 py-2 text-left text-sm text-white"
          >
            {badManual} kézzel beengedett kód nem érvényes jegy (nincs ilyen, vagy nincs kifizetve). Az admin naplójában látszik. (Koppints a bezáráshoz.)
          </button>
        )}

        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[min(100%,40dvh)] overflow-hidden rounded-3xl border border-white/10 bg-black">
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
            className="field font-mono text-base sm:text-sm tracking-widest"
          />
          <button type="submit" disabled={!manual.trim() || busy} className="btn-secondary shrink-0 px-5 disabled:opacity-40">
            Ellenőrzés
          </button>
        </form>
      </div>

      {result && (
        <ResultScreen
          result={result}
          onClose={() => setResult(null)}
          onAdmit={async () => {
            await door.admitUnknown(result.data.code);
            setResult(null);
          }}
        />
      )}
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
      {/* fire-safety limit: tickets that can still be sold (door QR too) */}
      {stats?.left != null &&
        (stats.left === 0 ? (
          <div className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white">
            TELT HÁZ – jegyet már nem lehet venni, csak jeggyel lehet belépni
          </div>
        ) : (
          <div className={`mt-3 text-center text-xs ${stats.left <= 20 ? 'font-semibold text-amber-400' : 'text-gray-400'}`}>
            Még eladható jegy (a helyszíni QR-kóddal is): <span className="tabular-nums">{stats.left}</span>
          </div>
        ))}
    </section>
  );
}

/* --------------------------- Offline list ------------------------- */

function DoorListBar({ online, state }) {
  const stale = state.ready && Date.now() - state.at > 5 * 60_000;
  const waiting = state.pending ? ` · ${state.pending} feltöltésre vár` : '';
  if (!online && !state.ready)
    return (
      <div role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">
        <WifiOff className="h-4 w-4 shrink-0" />
        Nincs internet, és a jegylista sincs letöltve – használd a nyomtatott vendéglistát.
      </div>
    );
  if (!online)
    return (
      <div role="status" className="mt-3 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          OFFLINE – a letöltött listából ellenőrzök
        </div>
        <div className="mt-0.5 pl-6 text-xs font-medium">
          {state.total} jegy · frissítve {timeHu(new Date(state.at).toISOString())}
          {waiting}
        </div>
      </div>
    );
  return (
    <div className={`mt-2 text-center text-[11px] ${stale ? 'font-semibold text-amber-400' : 'text-gray-500'}`}>
      {state.ready
        ? `Offline lista: ${state.total} jegy · frissítve ${timeHu(new Date(state.at).toISOString())}${waiting}`
        : 'Offline lista letöltése…'}
    </div>
  );
}

/* ----------------------------- Result ----------------------------- */

const LOOK = {
  ok: { bg: 'bg-emerald-600', Icon: Check, title: 'Érvényes jegy' },
  'ok-late': { bg: 'bg-emerald-600', Icon: Check, title: 'Érvényes jegy' },
  used: { bg: 'bg-red-600', Icon: X, title: 'Már felhasznált' },
  invalid: { bg: 'bg-red-600', Icon: X, title: 'Érvénytelen jegy' },
  offline: { bg: 'bg-amber-500', Icon: WifiOff, title: 'Nincs kapcsolat' },
  unknown: { bg: 'bg-amber-500', Icon: WifiOff, title: 'Nincs a listában' },
};

function ResultScreen({ result, onClose, onAdmit }) {
  const { type, data } = result;
  const { bg, Icon, title } = LOOK[type];
  const vip = data.kind === 'vip';

  // Offline, the code isn't on the downloaded list (e.g. bought a minute ago
  // at the door). Staff check the guest's ticket and ID, then decide.
  if (type === 'unknown')
    return (
      <div className={`fixed inset-0 z-50 overflow-y-auto text-black ${bg}`}>
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-8 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/10">
            <Icon className="h-14 w-14" strokeWidth={3} />
          </div>
          <div className="mt-6 text-3xl font-bold uppercase tracking-wide">{title}</div>
          <div className="mt-4 max-w-xs text-lg">
            Nincs net, és ez a jegy nincs a letöltött listában (lehet, hogy most vették). Nézd meg a vendég telefonján a jegyet
            és a nevet, kérj igazolványt.
          </div>
          {data.code && <div className="mt-4 font-mono text-xs tracking-widest opacity-70">{data.code}</div>}
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <button type="button" onClick={onAdmit} className="rounded-2xl bg-black px-5 py-4 text-lg font-bold text-white">
              Rendben, beengedem
            </button>
            <button type="button" onClick={onClose} className="rounded-2xl border-2 border-black/40 px-5 py-3 font-semibold">
              Nem engedem be
            </button>
          </div>
        </div>
      </div>
    );

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
      className={`fixed inset-0 z-50 block overflow-y-auto text-white ${bg}`}
    >
      <div className="flex min-h-full flex-col items-center px-6 text-center">
        <div className="flex flex-1 flex-col items-center justify-center pt-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20">
            <Icon className="h-14 w-14" strokeWidth={3} />
          </div>
          <div className="mt-6 text-4xl font-bold uppercase tracking-wide">{title}</div>

          {data.name && <div className="mt-5 max-w-full text-3xl font-semibold [overflow-wrap:anywhere]">{data.name}</div>}

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

          {data.offline && (type === 'ok' || type === 'used') && (
            <div className="mt-4 rounded-full bg-black/25 px-4 py-1 text-xs font-semibold uppercase tracking-widest">
              Offline – a letöltött listából
            </div>
          )}

          {data.code && <div className="mt-6 font-mono text-xs tracking-widest opacity-70">{data.code}</div>}
        </div>

        <div className="pb-10 pt-8 text-sm font-semibold uppercase tracking-widest opacity-80">
          {type === 'ok' || type === 'ok-late' ? 'Koppints a folytatáshoz' : 'Koppints a bezáráshoz'}
        </div>
      </div>
    </button>
  );
}
