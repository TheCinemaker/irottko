import { DJS, EVENT_DETAILS } from '../data/eventData.js';

/*
  The night's timetable – from the line-up times in eventData.js, Budapest time.
  Times before noon belong to the next morning ("01:00-tól" = Jan 16, 01:00);
  the last set runs until LAST_SET_END. Pure data, no React – shared by the
  sale state (usePricing), "now on board" (onAir) and the departures board.

  Delays (admin → events.board_delays, 017_board_delays.sql): { djId: minutes }.
  A delayed act starts later; the act before it plays on until then; a delay
  on the last act moves the landing too.
*/
export const LAST_SET_END = '03:00';
const day = EVENT_DETAILS.isoDate.slice(0, 10); // "2027-01-15"
const offset = EVENT_DETAILS.isoDate.slice(19); // "+01:00"

export function at(hhmm) {
  const t = new Date(`${day}T${hhmm}:00${offset}`);
  if (Number(hhmm.slice(0, 2)) < 12) t.setDate(t.getDate() + 1); // after midnight
  return t;
}

/** [{ start, end }] per DJ, in DJS order – the published times. */
export const SLOTS = DJS.map((dj, i) => {
  const [from, to] = dj.time.match(/\d{2}:\d{2}/g) || [];
  const next = DJS[i + 1]?.time.match(/\d{2}:\d{2}/)?.[0];
  return { start: at(from), end: at(to || next || LAST_SET_END) };
});

const MIN = 60000;
const delayOf = (delays, i) => {
  const m = Number(delays?.[DJS[i].id]);
  return Number.isFinite(m) && m > 0 ? Math.min(m, 240) : 0;
};

/** The timetable with delays: [{ start, end, delay }] (delay in minutes). */
export function slotsWith(delays) {
  const starts = SLOTS.map((s, i) => new Date(s.start.getTime() + delayOf(delays, i) * MIN));
  return SLOTS.map((s, i) => ({
    start: starts[i],
    end: i < SLOTS.length - 1 ? starts[i + 1] : new Date(s.end.getTime() + delayOf(delays, i) * MIN),
    delay: delayOf(delays, i),
  }));
}

/** When the night is over (the last act's end, with its delay). */
export const landingAt = (delays) => slotsWith(delays)[SLOTS.length - 1].end;
