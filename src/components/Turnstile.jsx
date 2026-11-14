import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/*
  Cloudflare Turnstile ("not a robot") – Managed mode, shown only if Cloudflare
  needs an interaction; usually invisible. onToken(token | '') reports the
  current token; ref.reset() gets a fresh one (tokens are single-use).
  On the local dev server (and on a LAN IP) the official always-pass test key
  is used, so it matches the server's TURNSTILE_TEST_MODE.
*/
const TEST_SITE_KEY = '1x00000000000000000000AA';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Local dev server (any address – LAN IP, localhost, the Mac's name): always the
// test key, matching the server's TURNSTILE_TEST_MODE=1 in the local .env.
// The production build always uses the real key.
const isLanIp = () => /^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname);
const siteKey = () => (import.meta.env.DEV || isLanIp() ? TEST_SITE_KEY : import.meta.env.VITE_TURNSTILE_SITE_KEY);

let scriptPromise;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

const Turnstile = forwardRef(function Turnstile({ onToken }, ref) {
  const box = useRef(null);
  const widget = useRef(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      cb.current('');
      if (window.turnstile && widget.current != null) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    const key = siteKey();
    if (!key) {
      cb.current('no-key'); // not configured: the server refuses the reservation (fail closed)
      return;
    }
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: key,
          theme: 'dark',
          language: 'hu',
          appearance: 'interaction-only',
          callback: (t) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch(() => cb.current('')); // script blocked: the server decides
    return () => {
      alive = false;
      if (window.turnstile && widget.current != null) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  return <div ref={box} className="flex justify-center empty:hidden" />;
});

export default Turnstile;
