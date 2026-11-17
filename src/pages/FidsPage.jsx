import { useEffect, useMemo, useRef, useState } from 'react';
import { DJS } from '../data/eventData';
import { useOnAir } from '../lib/onAir';

/*
  /kijelzo – a real split-flap (Solari) departures board for the TVs /
  projector at the party. Every character is its own flap that flips IN ORDER
  through the drum (blank, A–Z, 0–9, punctuation) until it reaches its letter –
  exactly like the mechanical boards. One typeface only: Split-Flap TV
  (public/fonts). Like the real boards it has no accents, so the text is
  shown in capitals without them (BÁRÁNY → BARANY).
  Columns: IDŐ · FELLÉPŐ · JÁRAT. A remarks line flips through passenger info.
  Not linked anywhere, noindex (netlify.toml). Tap = full screen; keeps the
  screen awake where the browser allows it.
*/

const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.!';
const FLIGHT = 'IR0115';
const NAME_LEN = 16;
const REMARKS = ['CSAK EGY JARAT INDUL!', 'DOHANYZAS AZ UDVARON', 'AKI KISZALL, A FOLDON MARAD', 'GATE OPEN 19:00'];
const REMARK_LEN = 28;

const plain = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^ A-Z0-9:\-.!]/g, ' ');
const pad = (s, n) => plain(s).padEnd(n, ' ').slice(0, n);

const hhmm = () =>
  new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' }).format(new Date());

/** One flap. Flips through the drum, one card at a time, until it shows `ch`. */
function Flap({ ch, size, delay = 0, color }) {
  const [shown, setShown] = useState(' ');
  const [n, setN] = useState(0); // restarts the flip animation per card
  const cur = useRef(' ');
  useEffect(() => {
    const target = DRUM.includes(ch) ? ch : ' ';
    if (cur.current === target) return undefined;
    const pace = 55 + Math.random() * 35; // each flap has its own mechanics
    let t = setTimeout(function step() {
      const next = DRUM[(DRUM.indexOf(cur.current) + 1) % DRUM.length];
      cur.current = next;
      setShown(next);
      setN((x) => x + 1);
      if (next !== target) t = setTimeout(step, pace);
    }, delay);
    return () => clearTimeout(t);
  }, [ch, delay]);

  // The typeface draws each character as a complete card (blank card = space),
  // so a flap is just a glyph that flips.
  return (
    <span key={n} className="sf-card" style={{ fontSize: size, color }}>
      {shown}
    </span>
  );
}

function FlapText({ text, len, size, delay = 0, color }) {
  const chars = [...pad(text, len)];
  return (
    <span className="sf-row" aria-label={text}>
      {chars.map((c, i) => (
        <Flap key={i} ch={c} size={size} delay={delay + i * 40} color={color} />
      ))}
    </span>
  );
}

function useClock() {
  const [t, setT] = useState(hhmm);
  useEffect(() => {
    const id = setInterval(() => setT(hhmm()), 5000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useEvery(ms, count) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % count), ms);
    return () => clearInterval(id);
  }, [ms, count]);
  return i;
}

// keep the TV / laptop screen on
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    const get = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen');
      } catch {
        /* not allowed / not supported – fine */
      }
    };
    get();
    const again = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

// font size from the screen: 27 cards across a row (1.196 em each) + column gaps
function useTile() {
  const calc = () => Math.floor(Math.min((window.innerWidth * 0.94) / 35, window.innerHeight / 13.5));
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

export default function FidsPage() {
  const clock = useClock();
  const onAir = useOnAir();
  const remark = useEvery(15000, REMARKS.length);
  const tile = useTile();
  useWakeLock();
  useEffect(() => {
    document.title = 'Departures · IR0115';
  }, []);
  const full = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const label = useMemo(() => ({ fontSize: tile * 0.34 }), [tile]);

  return (
    <main onClick={full} className="sf-board">
      <style>{CSS}</style>

      <header className="sf-head" style={{ marginBottom: tile * 0.45 }}>
        {/* painted sign – never flips on a real board */}
        <div className="sf-sign">
          <svg viewBox="0 0 24 24" style={{ width: tile * 1.1, height: tile * 1.1 }} aria-hidden="true">
            <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(45 12 12)" />
          </svg>
          <div>
            <div style={{ fontSize: tile * 1.05, lineHeight: 1 }}>Departures</div>
            <div className="sf-sub" style={{ fontSize: tile * 0.38, marginTop: tile * 0.12 }}>
              Indulások · One Night at Írottkő
            </div>
          </div>
        </div>
        <FlapText text={clock} len={5} size={tile * 1.1} color={CREAM} />
      </header>

      <div className="sf-cols sf-label" style={{ ...label, gridTemplateColumns: cols(tile), gap: tile * 0.8 }}>
        <span>Idő</span>
        <span>Fellépő</span>
        <span>Járat</span>
      </div>

      <ol className="sf-rows">
        {DJS.map((dj, i) => {
          const now = onAir === i; // the act playing now: gold cards + lit lamp
          return (
            <li
              key={dj.id}
              className="sf-cols sf-line"
              style={{ gridTemplateColumns: cols(tile), gap: tile * 0.8, padding: `${tile * 0.18}px 0` }}
            >
              <FlapText text={dj.time.slice(0, 5)} len={5} size={tile} delay={i * 300} color={CREAM} />
              <FlapText text={dj.name} len={NAME_LEN} size={tile} delay={i * 300 + 200} color={now ? GOLD : CREAM} />
              <span className="sf-flight" style={{ gap: tile * 0.45 }}>
                <FlapText text={FLIGHT} len={6} size={tile} delay={i * 300 + 600} color={CREAM} />
                {/* status lamp: lit while this act is playing (like the gate lamps) */}
                <span className={`sf-lamp ${now ? 'on' : ''}`} style={{ width: tile * 0.34, height: tile * 0.34 }} />
              </span>
            </li>
          );
        })}
      </ol>

      <footer className="sf-foot" style={{ gap: tile * 0.6 }}>
        <span className="sf-label" style={label}>
          Megjegyzés
        </span>
        <FlapText text={REMARKS[remark]} len={REMARK_LEN} size={tile * 0.72} color={CREAM} />
      </footer>
    </main>
  );
}

const CREAM = '#ece6d6';
const GOLD = '#f3cf55';
// a card advances 1.196 em
const cols = (tile) => `${tile * 1.196 * 5}px ${tile * 1.196 * NAME_LEN}px auto`;

const CSS = `
@font-face { font-family: 'Split-Flap TV'; src: url(/fonts/SplitFlapTV-Regular.ttf) format('truetype'); font-display: block; }
.sf-board { min-height: 100vh; background: #0a0a0c; padding: 3vh 3vw; cursor: none; user-select: none;
  font-family: 'Split-Flap TV', monospace; display: flex; flex-direction: column; }
/* painted parts of the board (sign, column heads): plain bold sans, like Helvetica on real boards */
.sf-label { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .18em; color: #8d8a80; }
.sf-sign { display: flex; align-items: center; gap: 1.2vw; color: #fff; font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; letter-spacing: .01em; }
.sf-sign svg { color: #f3cf55; }
.sf-sub { font-weight: 600; text-transform: uppercase; letter-spacing: .25em; color: #8d8a80; }
.sf-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #d4af37; padding-bottom: 1.5vh; }
.sf-cols { display: grid; align-items: center; }
.sf-rows { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; }
.sf-line { border-bottom: 1px solid rgba(255,255,255,.05); }
.sf-row { display: inline-flex; }
.sf-flight { display: inline-flex; align-items: center; }
.sf-foot { display: flex; align-items: center; margin-top: auto; border-top: 1px solid rgba(255,255,255,.08); padding-top: 2vh; }
/* one card = one glyph of the typeface (a blank card is the space) */
.sf-card { display: inline-block; white-space: pre; line-height: 1.45; font-family: 'Split-Flap TV', monospace;
  transform-origin: 50% 50%; animation: sf-flip 70ms ease-out both; }
@keyframes sf-flip { 0% { transform: scaleY(.1); filter: brightness(.45); } 100% { transform: scaleY(1); filter: brightness(1); } }
.sf-lamp { display: inline-block; border-radius: 50%; background: #1c2a1f; box-shadow: inset 0 0 3px rgba(0,0,0,.8); }
.sf-lamp.on { background: #39ff7a; box-shadow: 0 0 12px #39ff7a, 0 0 30px rgba(57,255,122,.5); animation: sf-blink 1.2s steps(2, jump-none) infinite; }
@keyframes sf-blink { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .sf-card { animation: none; } .sf-lamp.on { animation: none; } }
`;
