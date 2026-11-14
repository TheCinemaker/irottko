import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, DoorOpen, PlaneTakeoff, Plane, PlaneLanding } from 'lucide-react';
import { DJS } from '../data/eventData';

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

export function Flap({ chars, on, delay, small = false }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden="true">
      {[...chars].map((ch, i) =>
        ch === ':' ? (
          <span key={i} className={`self-center px-[1px] ${small ? 'text-[16px]' : 'text-[22px]'} font-bold text-[#d4af37]`}>:</span>
        ) : (
          <span
            key={i}
            className={`flap relative inline-flex ${small ? 'h-[30px] w-[20px] text-[17px]' : 'h-[38px] w-[26px] text-[24px]'} items-center justify-center rounded-[5px] bg-[#16121f] font-mono font-bold text-[#f3d77a] ${on ? 'flap-in' : 'opacity-0'}`}
            style={{ animationDelay: `${delay + i * 70}ms` }}
          >
            {ch}
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/35" />
          </span>
        )
      )}
    </span>
  );
}

export default function LineupBoard() {
  const board = useRef(null);
  const on = useInView(board);
  const active = useWalk(on, DJS.length);

  return (
    <section className="mx-auto max-w-3xl px-5 pt-16 sm:pt-28">
      <div className="kicker">Line-up · Fedélzeti menetrend</div>
      <h2 className="mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
        Beszállás 19:00-kor.
        <br />
        <span className="text-[#d4af37]">Leszállás hajnalban.</span>
      </h2>
      <p className="mt-3 text-[15px] text-gray-400">Négy fellépő, nulla megállás.</p>

      <div ref={board} className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0812]">
        <div className="flex items-center gap-4 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
          <span className="w-[124px] shrink-0">Idő</span>
          <span>Fellépő</span>
        </div>
        <ol>
          {DJS.map((dj, i) => {
            const start = dj.time.slice(0, 5);
            const lit = active === -1 ? dj.headliner : active === i; // the gold "now" row
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
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    <span className={`${fade} ${lit ? 'text-[#d4af37]' : 'text-gray-500'}`}>{STATUS[i]}</span>
                    <PhaseIcon i={i} gold={lit} />
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

function PhaseIcon({ i, gold }) {
  if (!PHASE[i]) return null;
  const { Icon } = PHASE[i];
  return (
    <span className="ml-1 inline-flex h-5 w-7 items-center justify-center overflow-hidden" aria-hidden="true">
      <Icon className={`h-4 w-4 transition-colors duration-[1500ms] ${gold ? 'text-[#d4af37]' : 'text-gray-400'}`} strokeWidth={2} />
    </span>
  );
}
