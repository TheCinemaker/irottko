import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/*
  Live ticket prices from the DB (supabase/seed_2027.sql is the single source).
  Returns { status, standard, vip, next, doorFrom, onlineLeft }:
    status: 'loading' | 'open' | 'between' (online closed, door not yet open)
            | 'closed' | 'error'
    standard / vip: the tier on sale right now (or null)
    next: the next standard price step after the current one (or null)
*/
const SLUG = import.meta.env.VITE_EVENT_SLUG || 'one-night-irottko';

// Always group thousands ("6 990 Ft"); hu-HU leaves 4-digit numbers ungrouped.
export const huf = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0Ft`;

export function usePricing() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) return alive && setState({ status: 'error' });
      const { data, error } = await supabase.rpc('get_event_public', { p_slug: SLUG });
      if (!alive) return;
      if (error || !data?.event) return setState({ status: 'error' });

      const tiers = data.tiers || [];
      const std = tiers.filter((t) => t.kind === 'standard').sort((a, b) => a.price_huf - b.price_huf);
      const standard = std.find((t) => t.active) || null;
      const vip = tiers.find((t) => t.kind === 'vip' && t.active && t.remaining !== 0) || null;
      // Next price step: the tier that starts when the current one ends (never a past one).
      const endsAt = standard?.sales_until ? new Date(standard.sales_until) : null;
      const next =
        (endsAt &&
          std
            .filter((t) => t.channel === standard.channel && t.sales_from && new Date(t.sales_from) >= endsAt)
            .sort((a, b) => new Date(a.sales_from) - new Date(b.sales_from))[0]) ||
        null;
      const door = std.find((t) => t.channel === 'door');
      const onlineSoldOut = standard?.channel === 'online' && data.online_left === 0;

      let status = 'open';
      if (!data.event.sales_open) status = 'closed';
      else if (!standard && !vip) status = door && new Date(data.now) < new Date(door.sales_from) ? 'between' : 'closed';

      setState({
        status,
        standard: onlineSoldOut ? null : standard,
        onlineSoldOut,
        vip,
        next,
        doorFrom: door?.sales_from || null,
        onlineLeft: data.online_left,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** "december 13." style date for "X-ig" notes. */
export const dayHu = (iso) =>
  new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', timeZone: 'Europe/Budapest' }).format(new Date(iso));

/** Button label: "Jegyek 6 990 Ft-tól" while on sale, otherwise just "Jegyek". */
export const fromLabel = (p) => {
  const prices = [p.standard, p.vip].filter(Boolean).map((t) => t.price_huf);
  return prices.length ? `Jegyek ${huf(Math.min(...prices))}-tól` : 'Jegyek';
};
