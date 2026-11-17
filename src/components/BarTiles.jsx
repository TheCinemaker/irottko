import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Martini, Wine, Beer, Crown } from 'lucide-react';
import { BARS_DATA } from '../data/eventData';
import { POUR_CLIPS } from '../data/pourClips';

// Poster for a bar: a frame from its pour film, if it has one.
export function barPoster(barId) {
  const clip = POUR_CLIPS.find((c) => c.bar === barId);
  if (clip) return `/frames/${clip.dir}/f${String(Math.round(clip.count * 0.66)).padStart(3, '0')}.webp`;
  if (barId === 'vip-bar') return '/hero.jpg';
  // Illustrated posters (no brands) until the real films arrive.
  if (barId === 'wine-bar') return '/posters/jagodics-bor.jpg'; // photo from the client (Jagodics Pince)
  if (barId === 'beer-bar') return '/posters/koszegi-sor.jpg'; // photo from the client (Kőszegi Sör)
  return null;
}

// Airport wayfinding: every bar is a terminal gate (decorative codes, like the
// KSZ → ÍRK route on the boarding pass).
export const GATES = {
  'spirit-bar': { code: 'A', Icon: Martini },
  'wine-bar': { code: 'B', Icon: Wine },
  'beer-bar': { code: 'C', Icon: Beer },
  'vip-bar': { code: 'VIP', Icon: Crown },
};

export const barHref = (bar) => (bar.slug === 'vip' ? '/vip' : `/barok/${bar.slug}`);

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

/*
  carousel = true:
   - phones: a 3D cover-flow row. Native swipe + snap (momentum feels right);
     each card turns, sinks back and darkens by its distance from the centre.
   - desktop: four columns that tilt in 3D towards the mouse.
  carousel = false: plain grid (bar pages, "További bárok").
*/
export default function BarTiles({ exclude, carousel = false }) {
  const bars = BARS_DATA.filter((b) => b.id !== exclude);
  if (!carousel) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bars.map((bar) => (
          <Card key={bar.id} bar={bar} className="aspect-[4/5] p-7 sm:aspect-[4/3]" />
        ))}
      </div>
    );
  }
  return <CoverFlow bars={bars} />;
}

function CoverFlow({ bars }) {
  const row = useRef(null);
  const cards = useRef([]);
  const [active, setActive] = useState(0); // the card in the middle (dots)
  const activeRef = useRef(0);

  // Phones: scroll-linked 3D transform (rAF, no React re-render per frame).
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const flat = reducedMotion() || isDesktop();
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      cards.current.forEach((c, i) => {
        if (!c) return;
        const dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (dd < bestD) (bestD = dd), (best = i);
      });
      if (best !== activeRef.current) {
        activeRef.current = best;
        setActive(best);
      }
      for (const c of cards.current) {
        if (!c) continue;
        if (flat) {
          c.style.transform = '';
          c.style.setProperty('--shade', '0');
          continue;
        }
        const d = Math.max(-1.6, Math.min(1.6, (c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth));
        const a = Math.abs(d);
        c.style.transform = `rotateY(${(-d * 48).toFixed(2)}deg) translateZ(${(-a * 120).toFixed(1)}px) scale(${(1 - a * 0.04).toFixed(3)})`;
        c.style.zIndex = String(100 - Math.round(a * 10));
        c.style.setProperty('--shade', Math.min(0.55, a * 0.38).toFixed(3));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Phones: one gentle nudge the first time the row is seen – the cards slide a
  // little to the side and back, showing that the row can be swiped.
  useEffect(() => {
    const el = row.current;
    if (!el || isDesktop() || reducedMotion() || !('IntersectionObserver' in window)) return undefined;
    let t1, t2;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = el.scrollLeft;
        t1 = setTimeout(() => el.scrollTo({ left: start + el.clientWidth * 0.28, behavior: 'smooth' }), 500);
        t2 = setTimeout(() => el.scrollTo({ left: start, behavior: 'smooth' }), 1300);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const go = (i) => {
    const el = row.current;
    const c = cards.current[i];
    if (!el || !c) return;
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  // Desktop: tilt towards the mouse.
  const tilt = (e) => {
    if (!isDesktop() || reducedMotion()) return;
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transition = 'transform 80ms linear';
    c.style.transform = `perspective(900px) rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 12).toFixed(2)}deg) translateZ(18px)`;
  };
  const untilt = (e) => {
    if (!isDesktop()) return;
    e.currentTarget.style.transition = 'transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    e.currentTarget.style.transform = '';
  };

  return (
    <>
      <div
        ref={row}
        className="relative -mx-5 flex snap-x snap-mandatory overflow-x-auto px-[calc(50vw-min(30vw,140px))] py-6 [perspective:900px] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:p-0 md:[perspective:none] [&::-webkit-scrollbar]:hidden"
      >
        {bars.map((bar, i) => (
          <Card
            key={bar.id}
            bar={bar}
            compact
            ref={(n) => (cards.current[i] = n)}
            onMouseMove={tilt}
            onMouseLeave={untilt}
            className="aspect-[3/4] w-[60vw] max-w-[280px] shrink-0 snap-center p-5 [&:not(:last-child)]:-mr-[9vw] md:[&:not(:last-child)]:mr-0 [transform-style:preserve-3d] will-change-transform md:w-auto md:max-w-none"
          />
        ))}
      </div>
      {/* phones: shows the row can be swiped – arrows + one dot per bar */}
      <div className="mt-1 flex items-center justify-center gap-4 md:hidden">
        <button type="button" onClick={() => go(Math.max(0, active - 1))} disabled={active === 0} aria-label="Előző bár" className="rounded-[4px] border border-white/15 p-2 text-[#d4af37] disabled:opacity-25">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {bars.map((bar, i) => (
            <button
              key={bar.id}
              type="button"
              onClick={() => go(i)}
              aria-label={bar.name}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-[#d4af37]' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(Math.min(bars.length - 1, active + 1))} disabled={active === bars.length - 1} aria-label="Következő bár" className="rounded-[4px] border border-white/15 p-2 text-[#d4af37] disabled:opacity-25">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

const Card = React.forwardRef(function Card({ bar, compact = false, className = '', ...rest }, ref) {
  const poster = barPoster(bar.id);
  return (
    <Link
      ref={ref}
      to={barHref(bar)}
      {...rest}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-[6px] border border-white/10 bg-[#0d0a14] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ${className}`}
    >
      {!poster && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(212,175,55,0.22),transparent_60%)]" />}
      {poster && (
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05030a] via-[#05030a]/30 to-transparent" />
      {!compact && GATES[bar.id] && <GateSign gate={GATES[bar.id]} />}
      <div className="relative">
        {bar.operator && <div className="kicker mb-2">{bar.operator}</div>}
        <h3 className={`font-semibold text-white ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{bar.name}</h3>
        {!compact && <p className="mt-1 text-[15px] text-gray-300">{bar.shortDesc}</p>}
        {/* small ticket stub, same language as the hero's boarding-pass button */}
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] border border-[#d4af37]/45 bg-[#d4af37]/15 py-1.5 pl-3 pr-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#f3d77a] backdrop-blur-md transition-colors group-hover:bg-[#d4af37]/25">
          {/* until a bar has its drinks list, the card leads to its description */}
          {bar.items?.length ? 'Itallap' : 'Részletek'} <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      {/* cover-flow depth shade (set per frame on phones) */}
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 'var(--shade, 0)' }} />
    </Link>
  );
});

/* Airport wayfinding strip on top of a bar card: pictogram · GATE x · arrow. */
function GateSign({ gate }) {
  const { code, Icon } = gate;
  return (
    <div className="absolute inset-x-0 top-0 flex items-center gap-3 border-b border-white/10 bg-[#05030a]/80 px-4 py-3 backdrop-blur-md">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">
        Gate <span className="text-[#d4af37]">{code}</span>
      </span>
      <ArrowRight className="ml-auto h-5 w-5 text-[#d4af37] transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
    </div>
  );
}
