import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { DJS } from '../data/eventData';

/*
  Home-page line-up as an airport departures board – it rhymes with the
  boarding-pass tickets. Times sit on split-flap tiles that flip in when the
  board scrolls into view. Status tags are mood only (no claims about the
  artists).
*/
const STATUS = ['Boarding', 'Take off', 'Flight', 'Landing'];

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

function Flap({ chars, on, delay }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden="true">
      {[...chars].map((ch, i) =>
        ch === ':' ? (
          <span key={i} className="self-center px-[1px] text-[18px] font-bold text-[#d4af37]">:</span>
        ) : (
          <span
            key={i}
            className={`flap relative inline-flex h-[34px] w-[24px] items-center justify-center rounded-[5px] bg-[#16121f] font-mono text-[20px] font-bold text-[#f3d77a] ${on ? 'flap-in' : 'opacity-0'}`}
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
          <span className="w-[114px] shrink-0">Idő</span>
          <span>Fellépő</span>
        </div>
        <ol>
          {DJS.map((dj, i) => {
            const start = dj.time.slice(0, 5);
            return (
              <li
                key={dj.id}
                className={`relative flex items-center gap-4 border-b border-white/[0.06] px-5 py-4 last:border-b-0 ${
                  dj.headliner ? 'bg-[linear-gradient(90deg,rgba(212,175,55,0.16),rgba(212,175,55,0.02))]' : ''
                }`}
              >
                {dj.headliner && <span className="absolute inset-y-0 left-0 w-[3px] bg-[#d4af37]" />}
                <span className="sr-only">{dj.time}</span>
                <span className="w-[114px] shrink-0">
                  <Flap chars={start} on={on} delay={i * 260} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`artist break-words ${dj.headliner ? 'text-[1.4rem] text-[#d4af37]' : 'text-[1.15rem]'}`}>{dj.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {dj.headliner ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4af37] opacity-70" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4af37]" />
                        </span>
                        <span className="text-[#d4af37]">Headliner</span>
                      </>
                    ) : (
                      <span className="text-gray-500">{STATUS[i]}</span>
                    )}
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
