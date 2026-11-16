import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/*
  Live ticket prices from the DB (supabase/seed_2027.sql is the single source).
  Returns { status, standard, vip, next, doorFrom, onlineLeft }:
    status: 'loading' | 'open' | 'between' (online closed, door not yet open)
            | 'full' (fire-safety limit reached) | 'closed' | 'error'
    standard / vip: the tier on sale right now (or null)
    next: the next standard price step after the current one (or null)
*/
const SLUG = import.meta.env.VITE_EVENT_SLUG || 'one-night-irottko';

// Always group thousands ("6 990 Ft"); hu-HU leaves 4-digit numbers ungrouped.
export const huf = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0Ft`;

function parse(data) {
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

  // full: the fire-safety limit is reached (013_venue_limit.sql) – nothing can be sold
  const full = data.full === true;
  let status = 'open';
  if (!data.event.sales_open) status = 'closed';
  else if (full) status = 'full';
  else if (!standard && !vip) status = door && new Date(data.now) < new Date(door.sales_from) ? 'between' : 'closed';

  return {
    status,
    standard: onlineSoldOut || full ? null : standard,
    onlineSoldOut,
    vip: full ? null : vip,
    next,
    doorFrom: door?.sales_from || null,
    onlineLeft: data.online_left,
  };
}

/*
  One shared, live copy of the public sale state for the whole page (hero,
  ticket section, VIP …). Reloaded
    - when supabase/014_live_sales.sql pings the public "irottko-sales"
      Realtime channel (admin stopped / restarted sales, changed the limit or
      prices) – content-free ping, we re-read get_event_public();
    - every minute as a fallback (full house, price steps, Realtime down);
    - when the tab comes back to the foreground or the network returns.
  A failed reload keeps the last good state (no flicker to "error").
*/
const FALLBACK_MS = 60_000;
let current = { status: 'loading' };
const listeners = new Set();
let started = false;
let loading = false;
let again = false;

async function reload() {
  if (loading) {
    again = true;
    return;
  }
  loading = true;
  try {
    if (!supabase) throw new Error('no client');
    const { data, error } = await supabase.rpc('get_event_public', { p_slug: SLUG });
    if (error || !data?.event) throw error || new Error('no event');
    current = parse(data);
  } catch {
    if (current.status === 'loading') current = { status: 'error' };
  } finally {
    loading = false;
    listeners.forEach((fn) => fn(current));
    if (again) {
      again = false;
      reload();
    }
  }
}

function start() {
  if (started) return;
  started = true;
  reload();
  setInterval(reload, FALLBACK_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reload());
  window.addEventListener('online', reload);
  // spread the reloads of many open pages over ~2 s after a ping
  supabase
    ?.channel('irottko-sales')
    .on('broadcast', { event: 'changed' }, () => setTimeout(reload, Math.random() * 2000))
    .subscribe((s) => s === 'SUBSCRIBED' && reload());
}

export function usePricing() {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    start();
    setState(current);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

/** "december 13." style date for "X-ig" notes. */
export const dayHu = (iso) =>
  new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', timeZone: 'Europe/Budapest' }).format(new Date(iso));

/** Button label: "Jegyek 6 990 Ft-tól" while on sale, otherwise just "Jegyek". */
/** Lowest current ticket price (standard or VIP), or null. */
export const fromPrice = (p) => {
  const prices = [p?.standard, p?.vip].filter(Boolean).map((t) => t.price_huf);
  return prices.length ? Math.min(...prices) : null;
};

export const fromLabel = (p) => {
  const prices = [p.standard, p.vip].filter(Boolean).map((t) => t.price_huf);
  return prices.length ? `Beszállókártya ${huf(Math.min(...prices))}-tól` : 'Beszállókártyák';
};
