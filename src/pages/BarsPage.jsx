import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import BarTiles from '../components/BarTiles';

// /barok — overview. Each bar has its own page with its own film and menu.
export default function BarsPage() {
  return (
    <PageShell>
      <PageHeader kicker="Bárok" title="Válassz pultot.">
        Három bár a hotel aulájában és egy pezsgőbár a VIP galérián.
      </PageHeader>
      <div className="mx-auto max-w-6xl px-5 pb-28">
        <BarTiles />
      </div>
    </PageShell>
  );
}
