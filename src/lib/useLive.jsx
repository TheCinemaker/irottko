import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

/*
  Live refresh. supabase/008_live.sql sends a content-free "changed" ping on the
  public Realtime channel "irottko-live" whenever a ticket, order or scan
  changes; on a ping we call `reload` (which fetches through our PIN-protected
  function – the channel itself never carries data).

  - Pings are coalesced: never more than one reload in flight, at most one
    every `minGapMs`; a ping during a reload triggers exactly one more.
  - Fallback poll every `fallbackMs` (time-based changes like expiring holds,
    and in case Realtime is down), plus a reload when the tab comes back to
    the foreground or the network returns.

  Returns 'live' | 'connecting' | 'polling'.
*/
export function useLive(reload, { enabled = true, minGapMs = 1500, fallbackMs = 20000 } = {}) {
  const [status, setStatus] = useState('connecting');
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!enabled) return undefined;
    let running = false;
    let again = false;
    let last = 0;
    let timer = null;
    let alive = true;

    const run = async () => {
      if (!alive) return;
      if (running) {
        again = true;
        return;
      }
      const wait = last + minGapMs - Date.now();
      if (wait > 0) {
        if (!timer) timer = setTimeout(() => ((timer = null), run()), wait);
        return;
      }
      running = true;
      last = Date.now();
      try {
        await reloadRef.current();
      } catch {
        /* the caller shows its own error */
      } finally {
        running = false;
        if (again) {
          again = false;
          run();
        }
      }
    };

    run(); // first load right away
    const poll = setInterval(run, fallbackMs);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel('irottko-live')
        .on('broadcast', { event: 'changed' }, run)
        .subscribe((s) => {
          if (!alive) return;
          if (s === 'SUBSCRIBED') {
            setStatus('live');
            run(); // catch up on anything missed while disconnected
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('polling');
        });
    } else setStatus('polling');

    return () => {
      alive = false;
      clearInterval(poll);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, minGapMs, fallbackMs]);

  return status;
}

/** Small "● ÉLŐ" badge. */
export function LiveBadge({ status }) {
  const live = status === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'
      }`}
      title={live ? 'Élő kapcsolat – azonnal frissül' : 'Nincs élő kapcsolat – 20 másodpercenként frissül'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-gray-500'}`} />
      {live ? 'Élő' : status === 'connecting' ? 'Kapcsolódás' : 'Frissítés 20 mp'}
    </span>
  );
}
