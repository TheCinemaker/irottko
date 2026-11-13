import React from 'react';
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

export default function BarTiles({ exclude }) {
  const bars = BARS_DATA.filter((b) => b.id !== exclude);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {bars.map((bar) => {
        const poster = barPoster(bar.id);
        return (
          <Link
            key={bar.id}
            to={barHref(bar)}
            className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:aspect-[4/3]"
          >
            {!poster && (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(212,175,55,0.22),transparent_60%)]" />
            )}
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
              <h3 className="text-2xl font-semibold text-white sm:text-3xl">{bar.name}</h3>
              <p className="mt-1 text-[15px] text-gray-300">{bar.shortDesc}</p>
              <span className="link-more mt-3">
                Itallap <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
