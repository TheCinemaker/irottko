import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, DoorOpen, PlaneTakeoff, Plane, PlaneLanding } from 'lucide-react';
import { DJS } from '../data/eventData';
import { useOnAir } from '../lib/onAir';

/*
  Home-page line-up as an airport departures board – it rhymes with the
  boarding-pass tickets. Times sit on split-flap tiles that flip in when the
  board scrolls into view. Status tags are mood only (no claims about the
  artists).
*/
export const STATUS = ['Boarding', 'Take-off', 'In flight', 'Landing'];
// A small, static icon per phase (no blinking – the user's call).
export const PHASE = [
  { Icon: DoorOpen, anim: 'phase-board' },
  { Icon: PlaneTakeoff, anim: 'phase-takeoff' },
  { Icon: Plane, anim: 'phase-cruise' },
  { Icon: PlaneLanding, anim: 'phase-land' },
];

function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/* The gold highlight walks down the board one row at a time and starts again
   – like a departures screen paging through flights. Begins once the tiles have
   flipped in. Reduced motion: no walk, only the headliner stays gold (-1). */
function useWalk(on, count, ms = 4000) { // ≈2.5 s lit + 1.5 s fade
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let id;
    const start = setTimeout(() => {
      setActive(0);
      id = setInterval(() => setActive((a) => (a + 1) % count), ms);
    }, 1400);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [on, count, ms]);
  return active;
}

/* Every `ms` (while visible and the tab is in front) the board "re-flips" like a
   real departures board: each tile spins through a few characters and lands on
   its value again. Returns a counter that changes on every re-flip.
   Reduced motion: never. */
function useCycle(on, ms = 13500) { // ≈3.5 s of flapping + 10 s standing still
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => document.visibilityState === 'visible' && setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
  return n;
}

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVZ';

// Tile sizes: small (line-up page), normal (home board), big (the /kijelzo TV board, scales with the screen)
const TILE = {
  small: 'h-[30px] w-[20px] text-[17px] rounded-[5px]',
  normal: 'h-[38px] w-[26px] text-[24px] rounded-[5px]',
  big: 'h-[5.2vw] w-[3.6vw] text-[3.7vw] rounded-[0.5vw]',
};
const COLON = { small: 'text-[16px]', normal: 'text-[22px]', big: 'text-[3.4vw]' };

function FlapTile({ ch, on, delay, size, cycle }) {
  const [shown, setShown] = useState(ch);
  const [flip, setFlip] = useState(0); // 0 = first flip-in, then a short tick per change
  useEffect(() => {
    if (!cycle) {
      setShown(ch); // the value itself changed (e.g. a clock) – show it
      return undefined;
    }
    // Like a mechanical Solari board: the tile flaps IN ORDER through its set
    // (… 8 → 9 → 0 → 1 …) one full lap and stops on its own value again. Each
    // tile has its own pace, so they click into place one after another.
    const pool = /\d/.test(ch) ? DIGITS : LETTERS;
    const start = pool.indexOf(ch);
    if (start < 0) return undefined; // a character we can't flap through stays still
    const pace = 170 + Math.random() * 70; // ms per flap – slow enough to read every digit
    let n = 0;
    let t;
    const step = () => {
      n += 1;
      setShown(pool[(start + n) % pool.length]);
      setFlip((f) => f + 1);
      if (n < pool.length) t = setTimeout(step, pace);
    };
    t = setTimeout(step, delay);
    return () => {
      clearTimeout(t);
      setShown(ch);
    };
  }, [cycle, ch, delay]);

  const anim = flip === 0 ? (on ? 'flap-in' : 'opacity-0') : 'flap-tick';
  return (
    <span
      key={flip}
      className={`flap relative inline-flex ${TILE[size]} items-center justify-center bg-[#16121f] font-mono font-bold text-[#f3d77a] shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_2px_3px_rgba(0,0,0,0.8)] ${anim}`}
      style={flip === 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {shown}
      {/* the hinge: dark split + a hairline of light under it (two separate flaps) */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/85 shadow-[0_1px_0_rgba(255,255,255,0.08)]" />
    </span>
  );
}

export function Flap({ chars, on, delay, small = false, size = small ? 'small' : 'normal' }) {
  const cycle = useCycle(on);
  return (
    <span className={`inline-flex ${size === 'big' ? 'gap-[0.35vw]' : 'gap-[3px]'}`} aria-hidden="true">
      {[...chars].map((ch, i) =>
        ch === ':' ? (
          <span key={i} className={`self-center px-[1px] ${COLON[size]} font-bold text-[#d4af37]`}>:</span>
        ) : (
          <FlapTile key={i} ch={ch} on={on} delay={delay + i * 70} size={size} cycle={cycle} />
        )
      )}
    </span>
  );
}

export default function LineupBoard() {
  const board = useRef(null);
  const on = useInView(board);
  // On the event night the row of whoever is playing stays lit; otherwise the
  // gold highlight walks down the board.
  const onAir = useOnAir();
  const active = useWalk(on && onAir < 0, DJS.length);

  return (
    <section className="mx-auto max-w-3xl px-5 pt-16 sm:pt-28">
      <div className="kicker">Line-up · Fedélzeti menetrend</div>
      <h2 className="mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
        Beszállás 19:00-kor.
        <br />
        <span className="text-[#d4af37]">Leszállás hajnalban.</span>
      </h2>
      <p className="mt-3 text-[15px] text-gray-400">Négy fellépő, nulla megállás.</p>

      <div ref={board} className="mt-7 overflow-hidden rounded-[6px] border border-white/10 bg-[#0b0812]">
        {/* the sign over a real departures board */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
            <PlaneTakeoff className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[15px] font-extrabold uppercase tracking-[0.08em] text-white">Departures</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">Indulások</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] font-bold tracking-[0.1em] text-[#f3d77a]">ÍR 0115</span>
        </div>
        <div className="flex items-center gap-4 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
          <span className="w-[124px] shrink-0">Idő</span>
          <span>Fellépő</span>
        </div>
        <ol>
          {DJS.map((dj, i) => {
            const start = dj.time.slice(0, 5);
            const lit = onAir >= 0 ? onAir === i : active === -1 ? dj.headliner : active === i; // the gold "now" row
            const fade = 'transition-[opacity,color] duration-[1500ms] ease-in-out';
            return (
              <li key={dj.id} className="relative flex items-center gap-4 border-b border-white/[0.06] px-5 py-4 last:border-b-0">
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(212,175,55,0.18),rgba(212,175,55,0.02))] ${fade} ${lit ? 'opacity-100' : 'opacity-0'}`}
                />
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] bg-[#d4af37] ${fade} ${lit ? 'opacity-100' : 'opacity-0'}`} />
                <span className="sr-only">{dj.time}</span>
                <span className="relative w-[124px] shrink-0">
                  <Flap chars={start} on={on} delay={i * 260} />
                </span>
                <div className="relative min-w-0 flex-1">
                  <div className={`artist break-words ${fade} ${dj.headliner ? 'text-[1.2rem]' : 'text-[1.15rem]'} ${lit || dj.headliner ? 'text-[#d4af37]' : 'text-white'}`}>
                    {dj.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    <span className={`${fade} ${lit ? 'text-[#d4af37]' : 'text-gray-500'}`}>{STATUS[i]}</span>
                    <PhaseIcon i={i} gold={lit} />
                    {onAir === i && <OnAirTag />}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <Link to="/lineup" className="link-more mt-5">
        Teljes menetrend <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

/** "● Most a fedélzeten" – only on the event night, next to the DJ playing now. */
export function OnAirTag() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#f3d77a]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Most a fedélzeten
    </span>
  );
}

function PhaseIcon({ i, gold }) {
  if (!PHASE[i]) return null;
  const { Icon } = PHASE[i];
  return (
    <span className="ml-1 inline-flex h-5 w-7 items-center justify-center overflow-hidden" aria-hidden="true">
      <Icon className={`h-4 w-4 transition-colors duration-[1500ms] ${gold ? 'text-[#d4af37]' : 'text-gray-400'}`} strokeWidth={2} />
    </span>
  );
}
