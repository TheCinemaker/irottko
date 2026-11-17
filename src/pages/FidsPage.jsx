import { useEffect, useRef, useState } from 'react';
import { DJS, EVENT_DETAILS } from '../data/eventData';
import { SLOTS } from '../lib/onAir';

/*
  /kijelzo – a real split-flap (Solari) departures board for the TVs /
  projector at the party, in the classic look: dark flaps, white characters,
  yellow destination column, yellow painted sign and column heads.

  Every character is its own flap that flips IN ORDER through the drum (blank,
  A–Z, 0–9, punctuation) until it reaches its letter – like the mechanical
  boards. Typeface: Split-Flap TV (public/fonts). It draws each character as a
  light card with the letter (and the hinge) cut out, so we colour the card
  dark and put the light/yellow ink BEHIND it, card-sized, with a dark band at
  the hinge – the cut-out letter shows the ink. No accents in the typeface
  (like the real boards): capitals without them (BÁRÁNY → BARANY). The painted
  parts (sign, column heads) never flip and use a plain bold sans.

  Rows, like an airport: the flights first (gate open + the four acts), then
  the on-board services. A finished set disappears and the rows below move up
  (the flaps flip to their new text). Status words of real boards:
  ON TIME → BOARDING (30 min before) → LAST CALL (10 min, blinking) →
  IN FLIGHT (playing). All text from eventData / the site (no invented data).
  Not linked anywhere, noindex (netlify.toml). Tap = full screen; keeps the
  screen awake where the browser allows it.
*/

const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.!';
const FLIGHT = 'IR0115';
const LEN = { time: 5, name: 23, flight: 6, status: 9 };
const ROWS = 10;
const REMARKS = ['CSAK EGY JARAT INDUL!', 'DOHANYZAS AZ UDVARON', 'AKI KISZALL A FOLDON MARAD', 'NEVRE SZOLO BESZALLOKARTYA', 'FENYKEPES IGAZOLVANY 18+'];
const REMARK_LEN = 28;

const TILE = '#1c1c1f'; // the flap
const HINGE = '#050506';
const WHITE = '#efefe9';
const YELLOW = '#f6c945';

const MIN = 60000;
// on the board the gate opens 5 minutes before the official 19:00 (the user's call)
const GATE_OPEN = new Date(new Date(EVENT_DETAILS.isoDate).getTime() - 5 * MIN); // 18:55
const BARS_CLOSE = SLOTS[SLOTS.length - 1].end; // the end of the last set

const plain = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^ A-Z0-9:\-.!]/g, ' ');
const pad = (s, n) => plain(s).padEnd(n, ' ').slice(0, n);
const hhmm = (d = new Date()) =>
  new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' }).format(d);

// status of something that starts at `start` and is over at `end`
function flightStatus(start, end, now) {
  if (now >= end) return null; // gone from the board
  if (now >= start) return 'IN FLIGHT';
  if (now >= start - 10 * MIN) return 'LAST CALL';
  if (now >= start - 30 * MIN) return 'BOARDING';
  return 'ON TIME';
}

/** The board's rows at `now`: flights first, then on-board services. */
function rowsAt(now) {
  const rows = [];
  // the gate itself: on the board until half an hour after it opened
  const gate = now >= GATE_OPEN.getTime() ? (now < GATE_OPEN.getTime() + 30 * MIN ? 'OPEN' : null) : flightStatus(GATE_OPEN.getTime(), Infinity, now);
  if (gate) rows.push({ time: hhmm(GATE_OPEN), name: 'GATE OPEN', flight: FLIGHT, status: gate });
  DJS.forEach((dj, i) => {
    const st = flightStatus(SLOTS[i].start.getTime(), SLOTS[i].end.getTime(), now);
    if (st) rows.push({ time: dj.time.slice(0, 5), name: dj.name, flight: FLIGHT, status: st, blink: st === 'LAST CALL' });
  });
  // services aboard
  const open = now >= GATE_OPEN.getTime() ? (now < BARS_CLOSE.getTime() ? 'OPEN' : 'CLOSED') : 'ON TIME';
  rows.push({ time: hhmm(GATE_OPEN), name: 'KOKTELBAR', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'BORBAR JAGODICS PINCE', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'SORBAR KOSZEGI SOR', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'FEDELZETI MENU', flight: FLIGHT, status: open });
  return rows.slice(0, ROWS);
}

/** One flap. Flips through the drum, one card at a time, until it shows `ch`. */
function Flap({ ch, size, delay = 0, ink = WHITE }) {
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

  // glyph = the card (coloured TILE); the ink behind it shows through the letter,
  // a dark band hides the hinge cut
  return (
    <span
      key={n}
      className="sf-card"
      style={{
        fontSize: size,
        color: TILE,
        // dark band over the hinge cut (48.7–51.3 % of the ink box, see CSS); wider so pixel rounding never leaves a light edge at any screen size
        backgroundImage: `linear-gradient(${ink} 0 46%, ${HINGE} 46% 54%, ${ink} 54% 100%)`,
      }}
    >
      {shown}
    </span>
  );
}

function FlapText({ text, len, size, delay = 0, ink, blink }) {
  return (
    <span className={`sf-row ${blink ? 'sf-blink' : ''}`} aria-label={text.trim() || undefined}>
      {[...pad(text, len)].map((c, i) => (
        <Flap key={i} ch={c} size={size} delay={delay + i * 35} ink={ink} />
      ))}
    </span>
  );
}

function useNow(ms = 5000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
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

// font size from the screen: all cards of a row (1.196 em each) + column gaps
const CARDS = LEN.time + LEN.name + LEN.flight + LEN.status;
function useSize() {
  const calc = () =>
    Math.floor(Math.min((window.innerWidth * 0.94) / (CARDS * 1.196 + 3 * 0.8), window.innerHeight / (ROWS * 1.72 + 6.5)));
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

const cols = (s) => [LEN.time, LEN.name, LEN.flight, LEN.status].map((n) => `${Math.round(n * 1.196 * s)}px`).join(' ');

export default function FidsPage() {
  const now = useNow();
  const remark = useEvery(15000, REMARKS.length);
  const s = useSize();
  useWakeLock();
  useEffect(() => {
    document.title = 'Departures · IR0115';
  }, []);
  const full = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const grid = { gridTemplateColumns: cols(s), columnGap: Math.round(s * 0.8) };
  const rows = rowsAt(now);

  return (
    <main onClick={full} className="sf-board">
      <style>{CSS}</style>

      <header className="sf-head" style={{ marginBottom: s * 0.7 }}>
        {/* painted sign – never flips on a real board */}
        <div className="sf-sign" style={{ gap: s * 0.6 }}>
          <span className="sf-icon" style={{ width: s * 2.5, height: s * 2.5 }}>
            <svg viewBox="0 0 24 24" style={{ width: '74%', height: '74%' }} aria-hidden="true">
              <path fill={TILE} d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: s * 2.4, lineHeight: 0.95 }}>Departures</div>
            <div className="sf-sub" style={{ fontSize: s * 0.42, marginTop: s * 0.2 }}>
              Indulások · One Night at Írottkő
            </div>
          </div>
        </div>
        <FlapText text={hhmm(new Date(now))} len={5} size={s * 1.5} />
      </header>

      <div className="sf-cols sf-label" style={{ ...grid, fontSize: s * 0.5, marginBottom: s * 0.3 }}>
        <span>Idő</span>
        <span>Fellépő / úti cél</span>
        <span>Járat</span>
        <span>Állapot</span>
      </div>

      <ol className="sf-rows" style={{ rowGap: Math.round(s * 0.25) }}>
        {Array.from({ length: ROWS }, (_, i) => {
          const r = rows[i] || {};
          return (
            <li key={i} className="sf-cols" style={grid}>
              <FlapText text={r.time || ''} len={LEN.time} size={s} delay={i * 220} />
              <FlapText text={r.name || ''} len={LEN.name} size={s} delay={i * 220 + 120} ink={YELLOW} />
              <FlapText text={r.flight || ''} len={LEN.flight} size={s} delay={i * 220 + 420} />
              <FlapText text={r.status || ''} len={LEN.status} size={s} delay={i * 220 + 700} blink={r.blink} />
            </li>
          );
        })}
      </ol>

      <footer className="sf-foot" style={{ gap: s * 0.6, marginTop: s * 0.6 }}>
        <span className="sf-label" style={{ fontSize: s * 0.5 }}>
          Megjegyzés
        </span>
        <FlapText text={REMARKS[remark]} len={REMARK_LEN} size={s} />
        <span className="sf-credit" style={{ fontSize: s * 0.28 }}>
          Font: Split-Flap TV
        </span>
      </footer>
    </main>
  );
}

const CSS = `
@font-face { font-family: 'Split-Flap TV'; src: url(/fonts/SplitFlapTV-Regular.ttf) format('truetype'); font-display: block; }
.sf-board { min-height: 100vh; background: #0c0c0e; padding: 3.5vh 3vw; cursor: none; user-select: none;
  display: flex; flex-direction: column; }
/* painted parts (sign, column heads): plain bold sans, yellow, like on real boards */
.sf-sign { display: flex; align-items: center; color: ${YELLOW}; font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; letter-spacing: -.01em; }
.sf-icon { display: inline-flex; align-items: center; justify-content: center; background: ${YELLOW}; border-radius: 9%; }
.sf-sub { font-weight: 600; text-transform: uppercase; letter-spacing: .25em; color: #8a8a84; }
.sf-label { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: ${YELLOW}; }
.sf-head { display: flex; align-items: center; justify-content: space-between; }
.sf-cols { display: grid; align-items: center; }
.sf-rows { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.sf-row { display: inline-flex; }
.sf-foot { display: flex; align-items: center; margin-top: auto; }
.sf-credit { margin-left: auto; align-self: flex-end; font-family: Inter, Arial, sans-serif; color: #3d3d3a; }
/* one card = one glyph. The glyph box (line-height 1.606 = ascent+descent)
   puts the card at x 0.1–1.096 em, y 0.1–1.506 em; the ink is painted well
   inside that (clear of the rounded corners), so it only shows through the
   cut-out letter. Hinge cut: glyph y 344–376 → 48.7–51.3 % of the ink box. */
.sf-card { display: inline-block; white-space: pre; line-height: 1.606; font-family: 'Split-Flap TV', monospace;
  background-repeat: no-repeat; background-size: 0.856em 1.266em; background-position: 0.17em 0.17em;
  transform-origin: 50% 50%; animation: sf-flip 70ms ease-out both; }
@keyframes sf-flip { 0% { transform: scaleY(.1); filter: brightness(.45); } 100% { transform: scaleY(1); filter: brightness(1); } }
.sf-blink { animation: sf-blink 1s steps(2, jump-none) infinite; }
@keyframes sf-blink { 50% { opacity: .2; } }
@media (prefers-reduced-motion: reduce) { .sf-card, .sf-blink { animation: none; } }
`;
