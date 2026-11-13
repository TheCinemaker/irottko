import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Check, X, WifiOff, Volume2, VolumeX, LogOut } from 'lucide-react';

/*
  Door scanner (/scan). Staff unlock it with the PIN (SCANNER_PIN on the server).
  Every scan goes to /.netlify/functions/check-in → check_in() in Supabase,
  which lets a ticket in exactly once and logs the scan in check_ins.
*/

const PIN_KEY = 'irottko-scanner-pin';
const SAME_CODE_PAUSE_MS = 6000; // the same QR stays in front of the camera after a scan
const OK_AUTO_CLOSE_MS = 2500;

const store = {
  get: () => {
    try {
      return sessionStorage.getItem(PIN_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v) => {
    try {
      v ? sessionStorage.setItem(PIN_KEY, v) : sessionStorage.removeItem(PIN_KEY);
    } catch {
      /* private mode – PIN just isn't remembered */
    }
  },
};

async function callCheckIn(pin, code) {
  const res = await fetch('/.netlify/functions/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, code }),
  });
  if (res.status === 401) return { auth: false };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { auth: true, data: await res.json() };
}

const timeHu = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';

/* ------------------------------------------------------------------ */

export default function TicketScanner() {
  const [pin, setPin] = useState(store.get);
  const [unlocked, setUnlocked] = useState(Boolean(store.get()));

  const logout = () => {
    store.set('');
    setPin('');
    setUnlocked(false);
  };

  if (!unlocked) {
    return (
      <PinScreen
        onUnlock={(p) => {
          store.set(p);
          setPin(p);
          setUnlocked(true);
        }}
      />
    );
  }
  return <Scanner pin={pin} onLogout={logout} />;
}

/* ------------------------------ PIN ------------------------------- */

function PinScreen({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      const r = await callCheckIn(value, '');
      if (r.auth) onUnlock(value);
      else {
        setError('Hibás PIN.');
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
        <div className="mt-3 h-5 text-sm text-red-400">{error}</div>
        <button type="submit" disabled={busy || !value} className="btn-primary mt-2 w-full disabled:opacity-40">
          {busy ? 'Ellenőrzés…' : 'Belépés'}
        </button>
      </form>
    </main>
  );
}

/* ---------------------------- Scanner ----------------------------- */

function Scanner({ pin, onLogout }) {
  const [camera, setCamera] = useState('idle'); // idle | starting | on | error
  const [result, setResult] = useState(null); // { type: ok|used|invalid|offline, data }
  const [busy, setBusy] = useState(false);
  const [totalIn, setTotalIn] = useState(null);
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
      try {
        const r = await callCheckIn(pin, code);
        if (!r.auth) return onLogout();
        const d = r.data;
        if (typeof d.total_in === 'number') setTotalIn(d.total_in);
        const type = d.ok ? 'ok' : d.reason === 'ALREADY_USED' ? 'used' : 'invalid';
        setResult({ type, data: d });
        beep(d.ok);
      } catch {
        lastRef.current = { code: '', at: 0 }; // let the same code be scanned again
        setResult({ type: 'offline', data: { code } });
        beep(false);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [pin, onLogout] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
      if (qrRef.current === qr) setCamera('on');
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

  // A green result closes itself; red ones wait for a tap.
  useEffect(() => {
    if (result?.type !== 'ok') return;
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
            {totalIn !== null && (
              <div className="mr-2 text-right">
                <div className="text-xl font-semibold leading-none text-[#d4af37]">{totalIn}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">bent</div>
              </div>
            )}
            <button onClick={() => setSound((s) => !s)} className="rounded-full p-2.5 text-gray-400 hover:text-white" aria-label="Hang">
              {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button onClick={onLogout} className="rounded-full p-2.5 text-gray-400 hover:text-white" aria-label="Kilépés">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

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

/* ----------------------------- Result ----------------------------- */

const LOOK = {
  ok: { bg: 'bg-emerald-600', Icon: Check, title: 'Érvényes jegy' },
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
  if (type === 'offline') detail = 'Ellenőrizd a netet, és olvasd be újra.';

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

      {type === 'ok' && vip && <div className="mt-4 text-lg font-bold">VIP karszalagot adj!</div>}

      {data.order_tickets > 1 && type !== 'invalid' && (
        <div className="mt-4 text-base opacity-90">
          Csoportos rendelés: {data.order_in} / {data.order_tickets} jegy beléptetve
        </div>
      )}

      {detail && <div className="mt-4 max-w-xs text-lg opacity-95">{detail}</div>}

      {data.code && <div className="mt-6 font-mono text-xs tracking-widest opacity-70">{data.code}</div>}

      <div className="absolute inset-x-0 bottom-10 text-sm font-semibold uppercase tracking-widest opacity-80">
        {type === 'ok' ? 'Koppints a folytatáshoz' : 'Koppints a bezáráshoz'}
      </div>
    </button>
  );
}
