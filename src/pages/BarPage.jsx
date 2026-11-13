import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import PageShell, { PageHeader } from '../components/PageShell';
import FramePour from '../components/pour/FramePour';
import MenuList from '../components/MenuList';
import BarTiles from '../components/BarTiles';
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
      {clip ? (
        <FramePour clip={clip} intro={{ kicker: bar.operator || 'Bárok', title: bar.name }} />
      ) : (
        <PageHeader kicker={bar.operator || 'Bárok'} title={bar.name}>
          {bar.shortDesc}
        </PageHeader>
      )}

      <MenuList bar={bar} bare={!clip} />

      <section className="mx-auto max-w-6xl px-5 pb-28">
        <h2 className="mb-8 text-center text-2xl font-semibold text-white">További bárok</h2>
        <BarTiles exclude={bar.id} />
      </section>
    </PageShell>
  );
}
