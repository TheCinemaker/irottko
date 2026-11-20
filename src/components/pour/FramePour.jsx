import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/*
  One scroll-scrubbed pour clip (Apple-style image sequence on a canvas) with
  text riding on the footage. Clips are configured in src/data/pourClips.js.

  Phones (portrait): the 9:16 clip fills the screen, captions top/bottom.
  Desktop (landscape): the clip is fitted to the screen height and centred on
  black (the clips have black backgrounds), captions sit in a side column.
*/

const BG = '#05030a';
// Scroll length of one clip. Longer = slower scrub = more reading time.
const SCROLL_VH = 650;
// The clip plays over [0, FINALE_FROM]; the finale card holds the last frame.
const FINALE_FROM = 0.84;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;
const framePath = (dir, i) => `/frames/${dir}/f${String(i + 1).padStart(3, '0')}.webp`;

function useIsPortrait() {
  const get = () => typeof window !== 'undefined' && window.innerHeight / window.innerWidth > 1.1;
  const [p, setP] = useState(get);
  useEffect(() => {
    const on = () => setP(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return p;
}

export default function FramePour({ clip, intro = null }) {
  const portrait = useIsPortrait();
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const images = useRef([]);
  const progressRef = useRef(0);
  const shownRef = useRef(0);
  const portraitRef = useRef(portrait);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(0);

  portraitRef.current = portrait;

  // preload frames
  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const imgs = new Array(clip.count);
    images.current = imgs;
    // Coarse-to-fine order (every 16th frame, then 8th, 4th, 2nd, the rest):
    // the scrub works across the whole clip after a few frames, and
    // nearestLoaded() fills the gaps until the rest arrive.
    const order = [];
    const seen = new Set();
    for (let step = 16; step >= 1; step /= 2)
      for (let i = 0; i < clip.count; i += step) if (!seen.has(i)) seen.add(i), order.push(i);
    for (const i of order) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!cancelled) setLoaded(++count);
      };
      img.src = framePath(clip.dir, i);
      imgs[i] = img;
    }
    return () => {
      cancelled = true;
    };
  }, [clip]);

  // scroll -> progress of this section
  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? clamp(-rect.top / total) : 0;
      progressRef.current = p;
      setProgress(p);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    const nearestLoaded = (idx) => {
      const imgs = images.current;
      for (let d = 0; d < imgs.length; d++) {
        const a = imgs[idx - d];
        if (a && a.complete && a.naturalWidth) return a;
        const b = imgs[idx + d];
        if (b && b.complete && b.naturalWidth) return b;
      }
      return null;
    };

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const tw = Math.round(canvas.clientWidth * dpr);
      const th = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      const W = canvas.width;
      const H = canvas.height;
      const p = progressRef.current;

      const clipP = clamp(p / FINALE_FROM);
      const target = clipP * (images.current.length - 1);
      shownRef.current += (target - shownRef.current) * 0.2;
      const img = nearestLoaded(Math.round(shownRef.current));

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      if (img) {
        const fin = smooth((p - FINALE_FROM) / 0.08);
        const zoom = 1 - 0.08 * fin;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        // phones: cover. desktop: fit height, centred on black.
        const scale = (portraitRef.current ? Math.max(W / iw, H / ih) : H / ih) * zoom;
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);

        // feather the left/right edges into the page on desktop
        if (dw < W) {
          const f = dw * 0.18;
          let g = ctx.createLinearGradient(dx, 0, dx + f, 0);
          g.addColorStop(0, BG);
          g.addColorStop(1, 'rgba(5,3,10,0)');
          ctx.fillStyle = g;
          ctx.fillRect(dx - 1, 0, f + 1, H);
          g = ctx.createLinearGradient(dx + dw - f, 0, dx + dw, 0);
          g.addColorStop(0, 'rgba(5,3,10,0)');
          g.addColorStop(1, BG);
          ctx.fillStyle = g;
          ctx.fillRect(dx + dw - f, 0, f + 1, H);
        }
        if (fin > 0) {
          ctx.fillStyle = `rgba(5,3,10,${0.84 * fin})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const introT = smooth(progress / 0.16);
  const finale = smooth((progress - FINALE_FROM) / 0.06);
  const pct = Math.round((loaded / clip.count) * 100);

  return (
    <section ref={sectionRef} style={{ height: `${SCROLL_VH}vh` }} className="relative" aria-label={clip.finale?.title || clip.id}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden" style={{ background: BG }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {portrait && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[34svh] bg-gradient-to-b from-[#05030a]/90 via-[#05030a]/40 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--tabbar)+30svh)] bg-gradient-to-t from-[#05030a]/90 via-[#05030a]/40 to-transparent" />
          </>
        )}

        {loaded < clip.count && (
          <div className="absolute bottom-[calc(var(--tabbar)+1rem)] right-4 z-30 text-[10px] tracking-widest uppercase text-[#d4af37]/70">
            Töltés {pct}%
          </div>
        )}

        {intro && (
          <>
            <div
              className="absolute inset-x-0 top-[calc(12svh+var(--ann-h,0px))] z-20 px-5 flex flex-col items-center text-center pointer-events-none"
              style={{ opacity: 1 - introT, transform: `translateY(${-introT * 60}px) scale(${1 - introT * 0.1})` }}
            >
              <span className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-[#d4af37]">{intro.kicker}</span>
              <h1 className="display mt-4 text-[2.6rem] sm:text-7xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {intro.title}
                {intro.titleGold && <span className="block text-[#d4af37]">{intro.titleGold}</span>}
              </h1>
            </div>
            <div
              className="absolute inset-x-0 bottom-[calc(var(--tabbar)+6svh)] z-20 flex flex-col items-center gap-1 text-[#d4af37] pointer-events-none"
              style={{ opacity: 1 - introT }}
            >
              <span className="text-[10px] tracking-[0.3em] uppercase">Görgess, és töltünk egyet</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
              {/* in a hurry at the bar: straight to the prices, skipping the film */}
              {clip.finale && (
                <a
                  href="#itallap"
                  className="pointer-events-auto mt-3 rounded-full border border-[#d4af37]/50 bg-black/40 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f7e7a9] backdrop-blur-sm"
                >
                  Ugrás az itallapra
                </a>
              )}
            </div>
          </>
        )}

        {captionTimeline(clip.captions, portrait).map((c) => (
          <Caption key={c.title} progress={progress} {...c} />
        ))}

        {clip.finale && (
          <div
            className="absolute inset-0 z-20 px-5 flex items-center justify-center"
            style={{ opacity: finale, pointerEvents: finale > 0.5 ? 'auto' : 'none' }}
          >
            <div
              className="w-full max-w-3xl text-center"
              style={{ transform: `translateY(${(1 - finale) * 40}px) scale(${0.95 + 0.05 * finale})` }}
            >
              <div className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-[#d4af37]">{clip.finale.kicker}</div>
              <div className="display mt-3 pt-[0.08em] text-6xl leading-[1.15] text-[#d4af37] sm:text-8xl">
                {clip.finale.title}
              </div>
              <div className="mt-2 text-sm sm:text-base tracking-[0.2em] uppercase text-gray-300">{clip.finale.line}</div>
              <a
                href="#itallap"
                className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#d4af37]/60 text-[#f7e7a9] text-xs font-bold uppercase tracking-[0.2em] bg-black/40 backdrop-blur-sm"
              >
                Teljes itallap <ChevronDown className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/*
  Caption timing, in absolute scroll progress of the clip:
   - fade-in starts at `inStart` (quick: words rise in)
   - holds still and readable
   - fade-out runs from `outStart` to `outEnd` — SLOW, letter by letter,
     left to right, with a soft blur. It runs past the caption's own window,
     so the next caption can already be coming in (when they don't collide).
*/
const OUT_LEAD = 0.15; // fade-out starts this share of the window before `to`
const OUT_TAIL = 0.35; // ...and ends this share of the window after `to`

export function captionTimeline(captions, portrait) {
  let prev = null;
  return captions.map((c, i) => {
    const span = c.to - c.from;
    // desktop: alternate side columns so neighbours never collide
    const side = portrait ? c.pos : i % 2 === 0 ? 'left' : 'right';
    const outStart = c.to - span * OUT_LEAD;
    const outEnd = c.to + span * OUT_TAIL;
    // same spot as the previous one -> wait until it has fully faded
    const inStart = prev && prev.side === side ? Math.max(c.from, prev.outEnd) : c.from;
    const item = { ...c, side, inStart, outStart, outEnd };
    prev = item;
    return item;
  });
}

function Caption({ progress, side, inStart, outStart, outEnd, kicker, title, text }) {
  if (progress < inStart - 0.005 || progress > outEnd + 0.005) return null;

  const inT = (progress - inStart) / 0.05; // fade-in length in progress units
  const outLen = outEnd - outStart;
  const outT = clamp((progress - outStart) / outLen); // 0..1 over the slow fade-out
  const drift = lerp(10, -10, clamp((progress - inStart) / (outEnd - inStart)));

  // letter i fades over its own slice; slices overlap, sweeping left -> right
  const letterAlpha = (i, n) => {
    const start = (i / Math.max(1, n - 1)) * 0.55;
    return 1 - smooth((outT - start) / 0.45);
  };

  const words = title.split(' ');
  const totalLetters = title.replace(/ /g, '').length;
  const textWords = text.split(' ');

  const place =
    side === 'left'
      ? 'top-1/2 -translate-y-1/2 left-[6vw] w-[min(30vw,440px)] text-left'
      : side === 'right'
      ? 'top-1/2 -translate-y-1/2 right-[6vw] w-[min(30vw,440px)] text-right'
      : side === 'top'
      ? 'top-[calc(11svh+var(--ann-h,0px))] inset-x-0 text-center'
      : 'bottom-[calc(var(--tabbar)+9svh)] inset-x-0 text-center';

  // soft dark scrim behind the text so it stays legible over bright labels
  const scrim = smooth(inT) * (1 - smooth((outT - 0.25) / 0.75));

  let li = 0;
  return (
    <div className={`absolute z-20 px-6 pointer-events-none ${place}`}>
      <div className="relative" style={{ transform: `translateY(${drift}px)` }}>
        <div
          aria-hidden
          className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-[50%] blur-2xl"
          style={{ opacity: scrim, background: 'radial-gradient(ellipse at center, rgba(5,3,10,0.82) 0%, rgba(5,3,10,0.55) 50%, rgba(5,3,10,0) 78%)' }}
        />
        <span
          className="block text-[10px] sm:text-xs tracking-[0.35em] uppercase text-[#d4af37]"
          style={{ opacity: smooth(inT) * (1 - smooth(outT / 0.5)) }}
        >
          {kicker}
        </span>
        <h2 className="text-[2.1rem] sm:text-5xl font-extrabold tracking-[-0.03em] text-white mt-2 leading-[1.1] drop-shadow-[0_2px_18px_rgba(0,0,0,0.95)]">
          {words.map((w, wi) => {
            const wIn = smooth((inT - wi * 0.35) / 1.2);
            return (
              <span
                key={wi}
                className="inline-block mr-[0.28em]"
                style={{ opacity: wIn, transform: `translateY(${(1 - wIn) * 22}px)` }}
              >
                {[...w].map((ch, ci) => {
                  const a = letterAlpha(li++, totalLetters);
                  return (
                    <span key={ci} style={{ opacity: a, filter: a < 0.999 ? `blur(${(1 - a) * 6}px)` : undefined }}>
                      {ch}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </h2>
        <p className="text-gray-300 text-sm sm:text-lg mt-2 drop-shadow">
          {textWords.map((w, wi) => {
            const wIn = smooth((inT - 1.2 - wi * 0.06) / 1.2);
            const start = (wi / Math.max(1, textWords.length - 1)) * 0.5;
            const wOut = 1 - smooth((outT - 0.1 - start) / 0.4);
            const a = wIn * wOut;
            return (
              <span key={wi} style={{ opacity: a, filter: wOut < 0.999 ? `blur(${(1 - wOut) * 4}px)` : undefined }}>
                {w}{' '}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}
