import React, { useEffect, useState } from 'react';

/**
 * SplashScreen — first-paint brand splash for Celesta Glow.
 *
 * Plays once per browser session (sessionStorage), staying out of the way on
 * subsequent navigations within the same tab. Dismisses on first user action
 * (click / scroll / tap) so it never blocks an impatient shopper.
 *
 * Theme — matches the rest of the storefront (mint emerald + gold accent on
 * white).
 *
 * Animation timeline (total ~2.6 s):
 *   0.0 s  fade-in white background + soft gradient orb
 *   0.4 s  logo "CELESTA" zooms in, then "GLOW" slides in gold
 *   1.1 s  tagline + slogan fade up
 *   2.4 s  whole screen fades + scales out, calls onDone()
 */
const SESSION_KEY = 'cg_splash_seen_v1';

export default function SplashScreen({ onDone }) {
  // Skip if already shown this session — keeps page loads instant on
  // intra-tab navigation (search, product detail, cart, etc.).
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SESSION_KEY); } catch (_) { return true; }
  });
  const [fadingOut, setFadingOut] = useState(false);

  const finish = React.useCallback(() => {
    if (!visible || fadingOut) return;
    setFadingOut(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) { /* noop */ }
    // Match the fade-out duration in the inline <style> below
    setTimeout(() => { setVisible(false); onDone?.(); }, 380);
  }, [visible, fadingOut, onDone]);

  // ----- Preload everything the homepage will need while the splash is showing -----
  // Runs ONCE on first mount of the splash. By the time the user finishes
  // looking at the logo (~2.4 s), the homepage's products, concerns, categories,
  // site-settings and combos are already sitting in `apiCache`, so the post-
  // splash transition feels instant. No-op on intra-tab navigation because
  // SplashScreen is gated by sessionStorage.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const { cachedGet } = await import('../utils/apiCache');
        const API = process.env.REACT_APP_BACKEND_URL;
        // Fire all in parallel — apiCache.cachedGet de-dupes in-flight requests
        // so the homepage's own useEffect won't re-fetch.
        const prefetch = [
          cachedGet(`${API}/api/concerns`, { ttl: 60_000 }),
          cachedGet(`${API}/api/categories`, { ttl: 60_000 }),
          cachedGet(`${API}/api/subcategories`, { ttl: 60_000 }),
          cachedGet(`${API}/api/site-settings`, { ttl: 60_000 }),
          cachedGet(`${API}/api/combos`, { ttl: 60_000 }),
          cachedGet(`${API}/api/products?niche=anti-aging&page=1&limit=20`),
          cachedGet(`${API}/api/products?niche=skincare&page=1&limit=20`),
          cachedGet(`${API}/api/products?niche=cosmetics&page=1&limit=20`),
        ];
        await Promise.allSettled(prefetch);
      } catch (_) { /* preload is best-effort */ }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    if (!visible) { onDone?.(); return; }
    // Auto-dismiss after the animation completes
    const t = setTimeout(finish, 3200);
    // Also dismiss on any user interaction so impatient shoppers aren't blocked
    const skip = () => finish();
    window.addEventListener('click', skip, { passive: true });
    window.addEventListener('touchstart', skip, { passive: true });
    window.addEventListener('keydown', skip);
    window.addEventListener('scroll', skip, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('scroll', skip);
    };
  }, [visible, finish, onDone]);

  if (!visible) return null;

  return (
    <div
      data-testid="splash-screen"
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden ${fadingOut ? 'cg-splash-out' : 'cg-splash-in'}`}
      aria-label="Celesta Glow"
      role="status"
    >
      {/* Subtle background wash (kept very faint so the layout matches the brand sheet) */}
      <div className="absolute inset-0 pointer-events-none cg-splash-orb">
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-emerald-50/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-amber-50/40 blur-3xl" />
      </div>

      {/* Brand stack — matches the supplied design (serif CELESTA, mint GLOW with horizontal rules,
          three-line tagline with "Kerala" in mint, heart-rule divider, cursive slogan with underline). */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md">
        {/* CELESTA — bold serif, very wide letter-spacing */}
        <div className="cg-splash-celesta select-none">
          <span className="cg-celesta-text">CELESTA</span>
        </div>

        {/* GLOW row — mint colour, sandwiched between two horizontal rules */}
        <div className="cg-splash-glowrow mt-3 flex items-center justify-center w-full max-w-[280px] sm:max-w-[340px]" aria-hidden="true">
          <span className="cg-glowrow-rule" />
          <span className="cg-glow-text">G L O W</span>
          <span className="cg-glowrow-rule" />
        </div>

        {/* Tagline — three lines, "Kerala" in mint */}
        <p className="cg-splash-tagline mt-10 text-[1.05rem] sm:text-[1.15rem] leading-snug font-medium text-stone-800">
          The Most Trusted
          <br />
          Skincare Ecommerce App
          <br />
          of <span style={{ color: '#7FB069' }} className="font-semibold">Kerala</span>
        </p>

        {/* Heart-rule divider */}
        <div className="cg-splash-heart mt-8 flex items-center justify-center w-full max-w-[300px]" aria-hidden="true">
          <span className="cg-heart-rule" />
          <svg className="mx-3 cg-heart-icon" width="14" height="14" viewBox="0 0 24 24" fill="#7FB069" aria-hidden="true">
            <path d="M12 21s-7.2-4.35-9.5-9.1C.83 8.6 2.5 5 6 5c2 0 3.5 1.1 4.5 2.7C11.5 6.1 13 5 15 5c3.5 0 5.17 3.6 3.5 6.9C19.2 16.65 12 21 12 21z" />
          </svg>
          <span className="cg-heart-rule" />
        </div>

        {/* Cursive slogan with underline flourish */}
        <div className="cg-splash-slogan mt-7 relative inline-block">
          <span className="cg-slogan-text" style={{ color: '#7FB069' }}>Glow With Confidence</span>
          <svg className="cg-slogan-underline" width="220" height="14" viewBox="0 0 220 14" fill="none" aria-hidden="true">
            <path d="M5 8 Q60 1 115 6 T215 8" stroke="#7FB069" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;900&family=Caveat:wght@500;700&display=swap');

        .cg-celesta-text {
          font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
          font-weight: 800;
          font-size: clamp(2.6rem, 9vw, 4.8rem);
          letter-spacing: clamp(0.4rem, 1.2vw, 0.85rem);
          color: #161616;
          line-height: 1;
        }
        .cg-glow-text {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 600;
          font-size: clamp(1rem, 3vw, 1.4rem);
          letter-spacing: 0.45em;
          color: #7FB069;
          padding: 0 0.85em;
          line-height: 1;
          white-space: nowrap;
        }
        .cg-glowrow-rule {
          flex: 1;
          height: 1.6px;
          background: #7FB069;
          border-radius: 999px;
        }
        .cg-heart-rule {
          flex: 1;
          height: 1.4px;
          background: #b9d6a4;
          border-radius: 999px;
        }
        .cg-slogan-text {
          font-family: 'Caveat', 'Dancing Script', cursive;
          font-weight: 700;
          font-size: clamp(2.1rem, 7vw, 3rem);
          line-height: 1;
        }
        .cg-slogan-underline {
          position: absolute;
          left: 50%;
          bottom: -10px;
          transform: translateX(-50%);
          width: clamp(180px, 60vw, 240px);
        }

        @keyframes cg-fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cg-fade-out   { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.03); } }
        @keyframes cg-celesta-pop {
          0%   { opacity: 0; transform: translateY(14px) scale(.94); letter-spacing: 1.1em; }
          70%  { opacity: 1; transform: translateY(0)    scale(1.02); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes cg-glowrow-in {
          0%   { opacity: 0; transform: scaleX(0.4); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes cg-rise-fade  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cg-heart-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.18); }
        }
        @keyframes cg-underline-draw {
          from { stroke-dashoffset: 240; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes cg-orb-pan     { from { transform: scale(1); } to { transform: scale(1.06); } }

        .cg-splash-in  { animation: cg-fade-in  .35s ease-out forwards; }
        .cg-splash-out { animation: cg-fade-out .4s ease-in  forwards; }
        .cg-splash-orb { animation: cg-orb-pan 2.4s ease-out forwards; }

        .cg-splash-celesta { animation: cg-celesta-pop .9s cubic-bezier(.22,1,.36,1) .15s both; }
        .cg-splash-glowrow { animation: cg-glowrow-in .7s cubic-bezier(.22,1,.36,1) .8s both; transform-origin: center; }
        .cg-splash-tagline { animation: cg-rise-fade .6s ease-out 1.15s both; }
        .cg-splash-heart   { animation: cg-rise-fade .55s ease-out 1.55s both; }
        .cg-heart-icon     { animation: cg-heart-pulse 1.6s ease-in-out 2.1s infinite; transform-origin: center; }
        .cg-splash-slogan  { animation: cg-rise-fade .55s ease-out 1.8s both; }
        .cg-slogan-underline path {
          stroke-dasharray: 240;
          stroke-dashoffset: 240;
          animation: cg-underline-draw .9s cubic-bezier(.22,1,.36,1) 2.1s forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .cg-splash-celesta, .cg-splash-glowrow, .cg-splash-tagline,
          .cg-splash-heart, .cg-heart-icon, .cg-splash-slogan,
          .cg-slogan-underline path, .cg-splash-orb {
            animation: none; opacity: 1; transform: none; stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
