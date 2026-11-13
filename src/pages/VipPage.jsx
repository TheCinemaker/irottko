import React from 'react';
import PageShell, { PageHeader } from '../components/PageShell';
import VipSection from '../components/VipSection';
import MenuList from '../components/MenuList';
import { BARS_DATA } from '../data/eventData';

export default function VipPage() {
  const vipBar = BARS_DATA.find((b) => b.slug === 'vip');
  return (
    <PageShell>
      <PageHeader kicker="VIP Lounge" title="A Lounge a tiéd.">
        Ugyanaz az éjszaka, egy fokozattal feljebb.
      </PageHeader>
      <VipSection />
      {vipBar && <MenuList bar={vipBar} title="Pezsgőbár" />}
    </PageShell>
  );
}
