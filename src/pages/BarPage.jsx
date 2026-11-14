import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import BackLink from '../components/BackLink';
import FramePour from '../components/pour/FramePour';
import MenuList from '../components/MenuList';
import BarTiles, { GATES, barPoster } from '../components/BarTiles';
import { BARS_DATA } from '../data/eventData';
import { POUR_CLIPS } from '../data/pourClips';

// /barok/:slug — one bar: its pour film (if any), then only its menu.
export default function BarPage() {
  const { slug } = useParams();
  if (slug === 'ital') return <Navigate to='/barok/koktel' replace />; // old link
  const bar = BARS_DATA.find((b) => b.slug === slug);
  if (!bar) return <Navigate to="/barok" replace />;
  if (bar.slug === 'vip') return <Navigate to="/vip" replace />;

  const clip = POUR_CLIPS.find((c) => c.bar === bar.id);

  return (
    <PageShell>
      <BackLink to="/barok" label="Bárok" />
      {clip ? (
        <FramePour clip={clip} intro={{ kicker: bar.operator || 'Bárok', title: bar.name }} />
      ) : (
        <GateHeader bar={bar} />
      )}

      <MenuList bar={bar} bare={!clip} />

      <section className="mx-auto max-w-6xl px-5 pb-28">
        <div className="mb-8 text-center">
          <div className="kicker">Bárok · Terminál</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">További kapuk</h2>
        </div>
        <BarTiles exclude={bar.id} />
      </section>
    </PageShell>
  );
}

/* Bar page header without a film: the gate sign above the bar's name. */
function GateHeader({ bar }) {
  const gate = GATES[bar.id];
  return (
    <header className="mx-auto max-w-3xl px-5 pb-10 pt-8 text-center sm:pt-12">
      {gate && (
        <div className="mx-auto mb-6 inline-flex items-center gap-3 rounded-[4px] border border-white/10 bg-[#0b0812] py-2 pl-2 pr-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#d4af37] text-[#05030a]" aria-hidden="true">
            <gate.Icon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-white">
            Gate <span className="text-[#d4af37]">{gate.code}</span>
          </span>
        </div>
      )}
      {bar.operator && <div className="kicker">{bar.operator}</div>}
      <h1 className="display mt-4 whitespace-nowrap text-[clamp(2rem,10vw,4.5rem)]">{bar.name}</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">{bar.shortDesc}</p>
      {barPoster(bar.id) && (
        <img
          src={barPoster(bar.id)}
          alt=""
          className="mx-auto mt-8 aspect-[4/5] w-full max-w-sm rounded-[6px] border border-white/10 object-cover"
        />
      )}
    </header>
  );
}
