import { useEffect, useState } from 'react';
import { Flap, STATUS, OnAirTag } from '../components/LineupBoard';
import { DJS, EVENT_DETAILS } from '../data/eventData';
import { SLOTS, useOnAir } from '../lib/onAir';

/*
  /kijelzo – airport departures screen (FIDS) for the TVs / projector at the
  party: the line-up as one flight, the act playing now, a split-flap clock.
  Landscape, scales with the screen (vw units). Not linked anywhere, noindex
  (netlify.toml). Tap once for full screen; keeps the screen awake where the
  browser allows it.
*/
const hhmm = () =>
  new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' }).format(new Date());

function useClock() {
  const [t, setT] = useState(hhmm);
  useEffect(() => {
    const id = setInterval(() => setT(hhmm()), 5000);
    return () => clearInterval(id);
  }, []);
  return t;
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

const stateOf = (i, onAir) => {
  if (onAir === i) return 'now';
  return Date.now() >= SLOTS[i].end.getTime() ? 'done' : 'next';
};

export default function FidsPage() {
  const clock = useClock();
  const onAir = useOnAir();
  useWakeLock();
  useEffect(() => {
    document.title = 'Indulás · ÍR 0115';
  }, []);
  const full = () => document.documentElement.requestFullscreen?.().catch(() => {});

  return (
    <main
      onClick={full}
      className="flex min-h-screen cursor-none flex-col bg-[#05030a] px-[3vw] py-[2.5vw] font-sans text-white select-none"
    >
      {/* header: DEPARTURES · flight · clock */}
      <header className="flex items-end justify-between border-b-[0.25vw] border-[#d4af37] pb-[1.2vw]">
        <div>
          <div className="text-[1.3vw] font-bold uppercase tracking-[0.4em] text-[#d4af37]">Indulás · Departures</div>
          <div className="display mt-[0.4vw] text-[3.6vw] leading-none">
            One Night <span className="text-[#d4af37]">at Írottkő</span>
          </div>
          <div className="mt-[0.6vw] font-mono text-[1.4vw] font-bold uppercase tracking-[0.2em] text-gray-300">
            Járat ÍR 0115 · KSZ ✈ ÍRK · Gate open {EVENT_DETAILS.doorsOpen}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-[0.5vw] text-[1vw] font-bold uppercase tracking-[0.3em] text-gray-500">Helyi idő</div>
          <Flap chars={clock} on delay={0} size="big" />
        </div>
      </header>

      {/* column heads */}
      <div className="mt-[1.6vw] grid grid-cols-[22vw_1fr_18vw_20vw] gap-[2vw] px-[1.2vw] text-[1vw] font-bold uppercase tracking-[0.3em] text-gray-500">
        <span>Idő</span>
        <span>Fellépő</span>
        <span>Szakasz</span>
        <span>Állapot</span>
      </div>

      <ol className="mt-[0.6vw] flex-1">
        {DJS.map((dj, i) => {
          const st = stateOf(i, onAir);
          return (
            <li
              key={dj.id}
              className={`grid grid-cols-[22vw_1fr_18vw_20vw] items-center gap-[2vw] border-b border-white/[0.07] px-[1.2vw] py-[1.4vw] ${
                st === 'now' ? 'bg-[linear-gradient(90deg,rgba(212,175,55,0.22),rgba(212,175,55,0.03))] shadow-[inset_0.3vw_0_0_#d4af37]' : ''
              } ${st === 'done' ? 'opacity-45' : ''}`}
            >
              <Flap chars={dj.time.slice(0, 5)} on delay={i * 260} size="big" />
              <span className={`artist truncate text-[3.2vw] leading-tight ${st === 'now' || dj.headliner ? 'text-[#d4af37]' : 'text-white'}`}>
                {dj.name}
              </span>
              <span className="text-[1.6vw] font-bold uppercase tracking-[0.2em] text-gray-300">{STATUS[i]}</span>
              <span className="whitespace-nowrap text-[1.4vw] font-bold uppercase tracking-[0.1em]">
                {st === 'now' ? (
                  <span className="[&_*]:!h-[0.8vw] [&_*]:!w-[0.8vw] [&>span]:gap-[0.6vw]">
                    <OnAirTag />
                  </span>
                ) : st === 'done' ? (
                  <span className="text-gray-500">Teljesítve</span>
                ) : (
                  <span className="text-emerald-400">Menetrend szerint</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {/* passenger info strip */}
      <footer className="mt-[1.5vw] flex items-center justify-between gap-[2vw] border-t border-white/10 pt-[1.2vw] text-[1.3vw] font-semibold text-gray-300">
        <span className="display text-[2vw] text-[#d4af37]">Csak egy járat indul!</span>
        <span>Dohányzás: az udvaron · Aki a gate-en kiszáll, a földön marad</span>
      </footer>
    </main>
  );
}
