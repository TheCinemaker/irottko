// "Jegyem": tickets bought on this phone, kept in the browser (localStorage).
// Only what is needed to show the ticket: code, attendee name, tier, order id.
// Nothing leaves the device; clearing site data removes them (the e-mail,
// PDF and Wallet copies remain).
const KEY = 'irottko-my-tickets';

export function getMyTickets() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveMyTickets(orderId, tickets) {
  try {
    const list = getMyTickets();
    const known = new Set(list.map((t) => t.code));
    for (const t of tickets) {
      if (!known.has(t.code)) list.push({ code: t.code, name: t.name || '', tier: t.tier, vip: Boolean(t.vip), orderId, savedAt: Date.now() });
    }
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage full – the e-mail still has the tickets */
  }
}

export function removeMyTicket(code) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getMyTickets().filter((t) => t.code !== code)));
  } catch {
    /* ignore */
  }
}
