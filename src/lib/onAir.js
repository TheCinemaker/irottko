import { useEffect, useMemo, useState } from 'react';
import { SLOTS, at, slotsWith } from './schedule.js';
import { usePricing } from './usePricing.js';

/*
  Who is playing right now – from the timetable (lib/schedule.js), with the
  delays the admin set (017_board_delays.sql, live via usePricing). On the
  event night only.
*/
export { SLOTS, slotsWith, landingAt } from './schedule.js';

/* Preview clock: ?ido=22:40 on any page puts THIS browser on the event night at
   that time (before noon = the morning after) and lets it tick on from there –
   to see the flight progress / "now on board" before the night. Sales, prices
   and the server are not affected. Set once when the page loads. */
const PREVIEW_OFFSET = (() => {
  if (typeof window === 'undefined') return 0;
  const m = new URLSearchParams(window.location.search).get('ido')?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return at(`${m[1].padStart(2, '0')}:${m[2]}`).getTime() - Date.now();
})();
export const PREVIEW = PREVIEW_OFFSET !== 0;
/** "Now" for the event-night features (real time, or the preview clock). */
export const clockNow = () => Date.now() + PREVIEW_OFFSET;

/** Index of the act playing at `now` in `slots`, or -1. */
export const onAirIndex = (now = new Date(clockNow()), slots = SLOTS) => slots.findIndex((s) => now >= s.start && now < s.end);

/** The timetable with the current delays (live). */
export function useSchedule() {
  const { delays } = usePricing();
  const key = JSON.stringify(delays || {});
  return useMemo(() => slotsWith(delays), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Live "who is playing now": re-checked every 30 s and when delays change. */
export function useOnAir() {
  const slots = useSchedule();
  const [i, setI] = useState(() => onAirIndex(undefined, slots));
  useEffect(() => {
    setI(onAirIndex(undefined, slots));
    const id = setInterval(() => setI(onAirIndex(undefined, slots)), 30000);
    return () => clearInterval(id);
  }, [slots]);
  return i;
}
