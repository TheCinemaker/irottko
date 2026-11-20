// The live Barion shop and the live (NAV-connected) Számlázz.hu account may be
// used only from the go-live evening on. Before that, BARION_LIVE=1 /
// SZAMLAZZ_LIVE=1 is an error – nothing is paid or invoiced for real, and it
// never falls back to the sandbox either.
export const LIVE_FROM = new Date('2026-12-05T20:00:00+01:00');

export function assertLiveAllowed(what, now = Date.now()) {
  if (now < LIVE_FROM.getTime()) throw new Error(`${what}_LIVE_NOT_BEFORE_2026-12-05_20:00`);
}
