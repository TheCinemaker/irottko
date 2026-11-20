import { useEffect, useRef, useState } from 'react';
import { DJS, EVENT_DETAILS } from '../data/eventData';
import { SLOTS, useSchedule, clockNow } from '../lib/onAir';

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

// the order of the cards on each flap's drum ('*' last: the LANDED pixels
// spin a full turn before they light up)
const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.!*';
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

const plain = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^ A-Z0-9:\-.!*]/g, ' ');
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

/** The board's rows at `now` for the timetable `slots` (with the admin's
 *  delays): flights first, then on-board services. A delayed act shows its new
 *  time and DELAYED until 10 minutes before it (then LAST CALL, IN FLIGHT). */
function rowsAt(now, slots) {
  const barsClose = slots[slots.length - 1].end;
  const rows = [];
  // the gate itself: on the board until half an hour after it opened
  const gate = now >= GATE_OPEN.getTime() ? (now < GATE_OPEN.getTime() + 30 * MIN ? 'OPEN' : null) : flightStatus(GATE_OPEN.getTime(), Infinity, now);
  if (gate) rows.push({ time: hhmm(GATE_OPEN), name: 'GATE OPEN', flight: FLIGHT, status: gate });
  DJS.forEach((dj, i) => {
    const sl = slots[i];
    let st = flightStatus(sl.start.getTime(), sl.end.getTime(), now);
    if (sl.delay && (st === 'ON TIME' || st === 'BOARDING')) st = 'DELAYED';
    if (st) rows.push({ time: sl.delay ? hhmm(sl.start) : dj.time.slice(0, 5), name: dj.name, flight: FLIGHT, status: st, blink: st === 'LAST CALL' || st === 'DELAYED' });
  });
  // services aboard
  const open = now >= GATE_OPEN.getTime() ? (now < barsClose.getTime() ? 'OPEN' : 'CLOSED') : 'ON TIME';
  rows.push({ time: hhmm(GATE_OPEN), name: 'KOKTELBAR', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'BORBAR JAGODICS PINCE', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'SORBAR KOSZEGI SOR', flight: FLIGHT, status: open });
  rows.push({ time: hhmm(GATE_OPEN), name: 'FEDELZETI MENU', flight: FLIGHT, status: open });
  return rows.slice(0, ROWS);
}

/* ---------- 03:00 – LANDED: the flaps become a dot-matrix display ----------
   The flight has arrived (arrival boards say LANDED; "Landing" is the last
   phase, while it is happening). Every card is one pixel ('*' or blank); the
   word is drawn in a 3×5 font: 6 letters × 3 + 5 gaps = 23 cards wide,
   5 rows tall, centred on the board. */
const DOTS = {
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  N: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  G: ['XXX', 'X..', 'X.X', 'X.X', 'XXX'],
};
const LANDING_TEXT = 'IR0115 - KOSZONJUK HOGY VELUNK REPULT';
/** Lines of the landing screen, `cols` cards wide, ROWS lines. */
function landingLines(cols) {
  const word = 'LANDED';
  const art = Array.from({ length: 5 }, (_, y) => [...word].map((c) => DOTS[c][y].replace(/X/g, '*').replace(/\./g, ' ')).join(' '));
  const center = (s) => {
    const left = Math.max(0, Math.floor((cols - s.length) / 2));
    return (' '.repeat(left) + s).padEnd(cols, ' ').slice(0, cols);
  };
  const lines = Array(ROWS).fill(' '.repeat(cols));
  art.forEach((l, i) => (lines[i + 2] = center(l)));
  lines[8] = center(LANDING_TEXT);
  return lines;
}

/* ---------- simulation: /kijelzo?szimulacio ----------
   Steps through the evening every 5 s (?szimulacio=20 → every 20 s), stopping
   at every moment where the board changes: 35/30/10 minutes before each start
   (ON TIME → BOARDING → LAST CALL), the start (IN FLIGHT / OPEN), the gate row
   leaving, and 03:00 LANDED. Then it starts again. */
function simulationTimes(slots = SLOTS) {
  const barsClose = slots[slots.length - 1].end;
  const t = new Set();
  const around = (start) => [-35, -30, -10, 0].forEach((m) => t.add(start + m * MIN));
  around(GATE_OPEN.getTime());
  t.add(GATE_OPEN.getTime() + 30 * MIN); // the gate row leaves the board
  slots.forEach((sl) => around(sl.start.getTime()));
  t.add(barsClose.getTime() - 5 * MIN);
  t.add(barsClose.getTime()); // 03:00 LANDED (later if the last act is delayed)
  t.add(barsClose.getTime() + 5 * MIN);
  return [...t].sort((a, b) => a - b);
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
  // a dark band hides the hinge cut.
  // '*' is a lit pixel of the LANDED dot-matrix: the blank card itself in the
  // ink colour – a solid yellow flap, only the dark hinge across it.
  const lit = shown === '*';
  return (
    <span
      key={n}
      className="sf-card"
      style={{
        fontSize: size,
        color: lit ? ink : TILE,
        // dark band over the hinge cut (48.7–51.3 % of the ink box, see CSS); wider so pixel rounding never leaves a light edge at any screen size
        backgroundImage: lit ? `linear-gradient(${HINGE},${HINGE})` : `linear-gradient(${ink} 0 46%, ${HINGE} 46% 54%, ${ink} 54% 100%)`,
      }}
    >
      {lit ? ' ' : shown}
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

// the board's clock: real time (or the ?ido=HH:MM preview clock), or the simulated evening (stepMs > 0)
function useBoardTime(stepMs) {
  const [t, setT] = useState(() => (stepMs ? simulationTimes()[0] : clockNow()));
  useEffect(() => {
    if (stepMs) {
      const times = simulationTimes();
      let i = 0;
      const id = setInterval(() => setT(times[(i = (i + 1) % times.length)]), stepMs);
      return () => clearInterval(id);
    }
    const id = setInterval(() => setT(clockNow()), 5000);
    return () => clearInterval(id);
  }, [stepMs]);
  return t;
}

// ?szimulacio or ?szimulacio=<seconds per step>
const simulationStep = () => {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('szimulacio')) return 0;
  const sec = Number(q.get('szimulacio'));
  return (sec >= 2 && sec <= 600 ? sec : 5) * 1000;
};

function useEvery(ms, count) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % count), ms);
    return () => clearInterval(id);
  }, [ms, count]);
  return i;
}

// keep the TV / laptop screen on all night. Some browsers refuse the lock until
// someone clicks, and the system can drop it (power event, fullscreen switch) –
// so ask again on every click (the fullscreen click) and whenever it is lost.
function useWakeLock() {
  const get = useRef(() => {});
  useEffect(() => {
    let lock = null;
    let gone = false;
    get.current = async () => {
      if (gone || (lock && !lock.released) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock?.request('screen');
        lock?.addEventListener?.('release', () => setTimeout(() => get.current(), 1000));
      } catch {
        /* not allowed / not supported – fine */
      }
    };
    get.current();
    const again = () => get.current();
    document.addEventListener('visibilitychange', again);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', again);
      lock?.release?.().catch(() => {});
    };
  }, []);
  return () => get.current();
}

// font size from the screen: all cards of a row (1.196 em each) + column gaps
const CARDS = LEN.time + LEN.name + LEN.flight + LEN.status;
function useSize() {
  const calc = () =>
    // height: minus the 7vh padding; ~25.2 em = header + labels + rows + footer (measured)
    Math.floor(Math.min((window.innerWidth * 0.94) / (CARDS * 1.196 + 3 * 0.8), (window.innerHeight * 0.93) / (ROWS * 1.72 + 8)));
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
  const [step] = useState(simulationStep);
  const now = useBoardTime(step);
  const slots = useSchedule(); // live, with the admin's delays
  const landing = now >= slots[slots.length - 1].end.getTime();
  const remark = useEvery(15000, REMARKS.length);
  const s = useSize();
  // landing screen: one uniform grid of cards, as wide as the board's rows
  const landingCols = Math.floor((CARDS * 1.196 + 3 * 0.8) / 1.196);
  const keepAwake = useWakeLock();
  useEffect(() => {
    document.title = 'Departures · IR0115';
  }, []);
  const full = () => {
    keepAwake();
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const grid = { gridTemplateColumns: cols(s), columnGap: Math.round(s * 0.8) };
  const rows = rowsAt(now, slots);

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

      {landing ? (
        <ol className="sf-rows" style={{ rowGap: Math.round(s * 0.25), marginTop: s * 0.5 + s * 0.3 }}>
          {landingLines(landingCols).map((line, i) => (
            <li key={`landing-${i}`}>
              <FlapText text={line} len={landingCols} size={s} delay={i * 180} ink={i < 7 ? YELLOW : WHITE} />
            </li>
          ))}
        </ol>
      ) : (
        <>
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
        </>
      )}

      <footer className="sf-foot" style={{ gap: s * 0.6, marginTop: s * 0.6 }}>
        <span className="sf-label" style={{ fontSize: s * 0.5 }}>
          Megjegyzés
        </span>
        <FlapText text={REMARKS[remark]} len={REMARK_LEN} size={s} />
        <span className="sf-credit" style={{ fontSize: s * 0.28 }}>
          {step ? <b className="sf-sim">Szimuláció · </b> : null}
          Font: Split-Flap TV
        </span>
      </footer>
    </main>
  );
}

const CSS = `
@font-face { font-family: 'Split-Flap TV'; src: url(/fonts/SplitFlapTV-Regular.ttf) format('truetype'); font-display: block; }
.sf-board { height: 100vh; overflow: hidden; background: #0c0c0e; padding: 3.5vh 3vw; cursor: none; user-select: none;
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
.sf-sim { color: #e25555; font-size: 2.2em; letter-spacing: .1em; }
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
