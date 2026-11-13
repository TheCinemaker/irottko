import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BARS_DATA } from '../data/eventData';
import { POUR_CLIPS } from '../data/pourClips';

// Poster for a bar: a frame from its pour film, if it has one.
export function barPoster(barId) {
  const clip = POUR_CLIPS.find((c) => c.bar === barId);
  if (clip) return `/frames/${clip.dir}/f${String(Math.round(clip.count * 0.66)).padStart(3, '0')}.webp`;
  if (barId === 'vip-bar') return '/hero.jpg';
  return null;
}

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

  // Phones: scroll-linked 3D transform (rAF, no React re-render per frame).
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const flat = reducedMotion() || isDesktop();
      const mid = el.scrollLeft + el.clientWidth / 2;
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
  );
}

const Card = React.forwardRef(function Card({ bar, compact = false, className = '', ...rest }, ref) {
  const poster = barPoster(bar.id);
  return (
    <Link
      ref={ref}
      to={barHref(bar)}
      {...rest}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-[#0d0a14] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ${className}`}
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
      <div className="relative">
        {bar.operator && <div className="kicker mb-2">{bar.operator}</div>}
        <h3 className={`font-semibold text-white ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>{bar.name}</h3>
        {!compact && <p className="mt-1 text-[15px] text-gray-300">{bar.shortDesc}</p>}
        <span className="link-more mt-3">
          Itallap <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      {/* cover-flow depth shade (set per frame on phones) */}
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 'var(--shade, 0)' }} />
    </Link>
  );
});
