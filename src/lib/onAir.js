import { useEffect, useState } from 'react';
import { DJS, EVENT_DETAILS } from '../data/eventData.js';

/*
  Who is playing right now – from the line-up times in eventData.js, on the
  event night only. Times before noon belong to the next morning ("01:00-tól"
  = Jan 16, 01:00); the last set runs until LAST_SET_END. Budapest time.
*/
const LAST_SET_END = '03:00';
const day = EVENT_DETAILS.isoDate.slice(0, 10); // "2027-01-15"
const offset = EVENT_DETAILS.isoDate.slice(19); // "+01:00"

function at(hhmm) {
  const t = new Date(`${day}T${hhmm}:00${offset}`);
  if (Number(hhmm.slice(0, 2)) < 12) t.setDate(t.getDate() + 1); // after midnight
  return t;
}

/** [{ start, end }] per DJ, in DJS order. */
export const SLOTS = DJS.map((dj, i) => {
  const [from, to] = dj.time.match(/\d{2}:\d{2}/g) || [];
  const next = DJS[i + 1]?.time.match(/\d{2}:\d{2}/)?.[0];
  return { start: at(from), end: at(to || next || LAST_SET_END) };
});

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

/** Index of the DJ playing at `now`, or -1. */
export const onAirIndex = (now = new Date(clockNow())) => SLOTS.findIndex((s) => now >= s.start && now < s.end);

/** Live version: re-checked every 30 s. */
export function useOnAir() {
  const [i, setI] = useState(() => onAirIndex());
  useEffect(() => {
    const id = setInterval(() => setI(onAirIndex()), 30000);
    return () => clearInterval(id);
  }, []);
  return i;
}
