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

  useEffect(() => {
    if (!visible) { onDone?.(); return; }
    // Auto-dismiss after the animation completes
    const t = setTimeout(finish, 2400);
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
      {/* Soft brand gradient orb in the background */}
      <div className="absolute inset-0 pointer-events-none cg-splash-orb">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-emerald-100 via-emerald-50 to-transparent blur-3xl opacity-70" />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full bg-gradient-to-tl from-amber-100 via-amber-50 to-transparent blur-3xl opacity-60" />
      </div>

      {/* Logo + tagline stack */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md">
        <div className="cg-splash-logo flex items-baseline justify-center gap-[0.18em] mb-3 select-none">
          <span className="cg-splash-celesta font-serif text-[clamp(2.4rem,9vw,4.6rem)] font-bold tracking-[0.06em] text-emerald-950">
            CELESTA
          </span>
          <span className="cg-splash-glow font-serif italic text-[clamp(2.4rem,9vw,4.6rem)] font-bold tracking-[0.04em]" style={{ color: '#D4A373' }}>
            GLOW
          </span>
        </div>

        {/* Animated underline accent */}
        <div className="cg-splash-rule h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent mb-6 origin-center" />

        <p className="cg-splash-tagline text-sm sm:text-base text-emerald-900/80 font-medium mb-2 leading-snug">
          The Most Trusted Skincare E-commerce App of Kerala
        </p>
        <p className="cg-splash-slogan text-xl sm:text-2xl text-emerald-950 italic font-serif tracking-wide">
          Glow With <span style={{ color: '#D4A373' }}>Confidence</span>.
        </p>

        {/* Loading shimmer */}
        <div className="cg-splash-shimmer mt-10 w-32 h-1 rounded-full bg-emerald-100 overflow-hidden">
          <div className="cg-splash-shimmer-bar h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400" />
        </div>
      </div>

      <style>{`
        @keyframes cg-fade-in       { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cg-fade-out      { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.03); } }
        @keyframes cg-logo-pop {
          0%   { opacity: 0; transform: translateY(14px) scale(.92); letter-spacing: 0.14em; }
          60%  { opacity: 1; transform: translateY(0)    scale(1.02); letter-spacing: 0.06em; }
          100% { opacity: 1; transform: translateY(0)    scale(1);    letter-spacing: 0.06em; }
        }
        @keyframes cg-glow-slide {
          0%   { opacity: 0; transform: translateX(28px) skewX(-6deg); }
          70%  { opacity: 1; transform: translateX(0)    skewX(0); }
          100% { opacity: 1; transform: translateX(0)    skewX(0); }
        }
        @keyframes cg-rule         { from { transform: scaleX(0); opacity: .2; } to { transform: scaleX(1); opacity: 1; } }
        @keyframes cg-rise-fade    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cg-shimmer-move { from { transform: translateX(-120%); } to { transform: translateX(220%); } }
        @keyframes cg-orb-pan      { from { transform: scale(1); } to { transform: scale(1.08); } }

        .cg-splash-in  { animation: cg-fade-in  .35s ease-out forwards; }
        .cg-splash-out { animation: cg-fade-out .4s ease-in  forwards; }
        .cg-splash-orb { animation: cg-orb-pan 2.4s ease-out forwards; }
        .cg-splash-celesta { animation: cg-logo-pop  .85s cubic-bezier(.22,1,.36,1) .15s both; }
        .cg-splash-glow    { animation: cg-glow-slide .9s cubic-bezier(.22,1,.36,1) .65s both; display: inline-block; }
        .cg-splash-rule { width: clamp(140px, 24vw, 220px); animation: cg-rule .7s ease-out 1.05s both; }
        .cg-splash-tagline { animation: cg-rise-fade .6s ease-out 1.2s both; }
        .cg-splash-slogan  { animation: cg-rise-fade .6s ease-out 1.45s both; }
        .cg-splash-shimmer { animation: cg-rise-fade .5s ease-out 1.7s both; }
        .cg-splash-shimmer-bar { animation: cg-shimmer-move 1.4s ease-in-out 1.7s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .cg-splash-celesta, .cg-splash-glow, .cg-splash-rule,
          .cg-splash-tagline, .cg-splash-slogan, .cg-splash-shimmer,
          .cg-splash-orb { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
