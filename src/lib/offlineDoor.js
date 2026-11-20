// Offline door mode for the scanner (/scan).
//
// After login the phone downloads every valid ticket (check-in.js → doorList)
// and refreshes it every minute in the background. A scan always asks the
// server first; when there is no network (or no answer within a short time)
// the phone decides from this list, lets the guest in and queues the entry.
// Queued entries go up with the next refresh (check_in_offline, 018 SQL) with
// the time they happened; one that another gate already let in shows up as a
// duplicate in the admin.
//
// Stored on the phone (localStorage, small: ~60 bytes a ticket):
// - the list: fingerprints of the codes (SHA-256, first 20 hex chars – the
//   codes themselves never sit on the phone), names, tiers;
// - marks: tickets this phone let in ({ at, pending, code, id }); pending ones
//   are waiting for upload and survive logout / reload until they are sent.

const LIST_KEY = 'irottko-door-list';
const MARKS_KEY = 'irottko-door-marks';

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked – the in-memory copy still works */
  }
};

export const normalizeCode = (raw) => String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

// Pure-JS SHA-256 fallback when crypto.subtle is unavailable (e.g. non-HTTPS LAN dev / older WebView).
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
function sha256Fallback(bytes) {
  const r = (v, n) => (v >>> n) | (v << (32 - n));
  const l = bytes.length;
  const bitLen = l * 8;
  const padLen = ((l + 9 + 63) & ~63);
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 4, bitLen >>> 0, false);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = r(w[t - 15], 7) ^ r(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = r(w[t - 2], 17) ^ r(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, idx) => odv.setUint32(idx * 4, v, false));
  return out;
}

export async function fingerprint(code) {
  const bytes = new TextEncoder().encode(code);
  const raw = globalThis.crypto?.subtle?.digest
    ? new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
    : sha256Fallback(bytes);
  return [...raw].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export function createDoor() {
  let list = read(LIST_KEY); // { at, until, skew?, rows: [[fp, name, tier, kind, usedAt, order]] }
  let marks = read(MARKS_KEY) || {}; // fp → { at, pending, code?, id? }
  let index = new Map();
  const listeners = new Set();
  const serverNow = () => Date.now() + (Number(list?.skew) || 0);

  if (list && list.until && serverNow() > list.until) {
    list = null; // the night is over
    write(LIST_KEY, null);
  }

  const reindex = () => {
    index = new Map();
    for (const r of list?.rows || []) index.set(r[0], r);
  };
  reindex();

  const emit = () => listeners.forEach((fn) => fn());
  const saveMarks = () => write(MARKS_KEY, marks);
  const usedAt = (fp) => index.get(fp)?.[4] || marks[fp]?.at || 0;

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** What the screen shows: list size, time, how many wait for upload. */
    state() {
      const pending = Object.values(marks).filter((m) => m.pending).length;
      if (!list) return { ready: false, pending };
      let used = 0;
      for (const r of list.rows) if (r[4] || marks[r[0]]?.at) used++;
      return { ready: true, at: list.at, total: list.rows.length, used, pending };
    },

    /** New list from the server. Entries still waiting for upload stay marked. */
    setList(next) {
      if (!next || !Array.isArray(next.rows)) return;
      const skew = Number.isFinite(next.at) ? next.at - Date.now() : 0;
      list = { ...next, skew };
      write(LIST_KEY, list);
      // Online check-ins this phone made are now in the list; drop their marks.
      for (const [fp, m] of Object.entries(marks)) if (!m.pending && m.at < list.at - 60_000) delete marks[fp];
      saveMarks();
      reindex();
      emit();
    },

    /** The server let this ticket in (online scan) – remember it until the next list. */
    markOnline(code, at = serverNow()) {
      fingerprint(normalizeCode(code))
        .then((fp) => {
          if (!marks[fp]?.pending) marks[fp] = { at, pending: false };
          saveMarks();
          emit();
        })
        .catch(() => {});
    },

    /**
     * Decide from the downloaded list. Returns
     * { type: 'ok' | 'used' | 'unknown' | 'nolist', name, tier, kind, checked_in_at, order_in, order_tickets, code }.
     * 'ok' marks the ticket used on this phone and queues it for upload.
     */
    async check(raw, staff) {
      const code = normalizeCode(raw);
      if (!list) return { type: 'nolist', code };
      const fp = await fingerprint(code);
      const row = index.get(fp);
      const prev = usedAt(fp);
      if (!row) {
        if (prev) return { type: 'used', code, checked_in_at: new Date(prev).toISOString() };
        return { type: 'unknown', code };
      }
      const base = { code, name: row[1], tier: row[2], kind: row[3] };
      if (prev) return { ...base, type: 'used', checked_in_at: new Date(prev).toISOString() };

      const now = serverNow();
      marks[fp] = { at: now, pending: true, code, id: newId(), staff: staff || null };
      saveMarks();
      emit();
      let order_tickets = 0;
      let order_in = 0;
      for (const r of list.rows)
        if (r[5] === row[5]) {
          order_tickets++;
          if (usedAt(r[0])) order_in++;
        }
      return { ...base, type: 'ok', checked_in_at: new Date(now).toISOString(), order_tickets, order_in };
    },

    /** Door staff let in a code that isn't on the list (checked by hand). Queued too. */
    async admitUnknown(raw, staff) {
      const code = normalizeCode(raw);
      const fp = await fingerprint(code);
      if (usedAt(fp)) return;
      marks[fp] = { at: serverNow(), pending: true, code, id: newId(), staff: staff || null, manual: true };
      saveMarks();
      emit();
    },

    /** Entries waiting for upload, for the next sync call. */
    pending() {
      return Object.values(marks)
        .filter((m) => m.pending)
        .map((m) => ({ id: m.id, code: m.code, at: m.at, staff: m.staff }));
    },

    /** Server answer to an upload: [{ id, ok, reason }]. */
    synced(results) {
      if (!Array.isArray(results) || !results.length) return [];
      const done = new Map(results.map((r) => [r.id, r]));
      const clashes = [];
      for (const [fp, m] of Object.entries(marks)) {
        const r = m.pending && done.get(m.id);
        if (!r) continue;
        m.pending = false;
        if (!r.ok) {
          clashes.push({ code: m.code, reason: r.reason });
          if (r.reason !== 'ALREADY_USED') {
            delete marks[fp];
            continue;
          }
        }
        delete m.code; // not needed on the phone any more
        delete m.id;
      }
      saveMarks();
      emit();
      return clashes;
    },

    /** Logout: drop the list. Entries not uploaded yet stay for the next login. */
    clear() {
      list = null;
      write(LIST_KEY, null);
      for (const [fp, m] of Object.entries(marks)) if (!m.pending) delete marks[fp];
      saveMarks();
      reindex();
      emit();
    },
  };
}
