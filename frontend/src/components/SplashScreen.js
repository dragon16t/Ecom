import React, { useEffect, useState } from 'react';

/**
 * SplashScreen — bulletproof v3.
 *
 * Hard lessons from production glitches (black screen / missing animations /
 * fallback fonts) on slow 4G + iOS in-app browsers + ad-blockers:
 *
 *   • NO Google Fonts. Custom font loading is async and unreliable — the
 *     previous version's `background-clip: text` shimmer made letters
 *     INVISIBLE if the gradient didn't apply (Flash of Invisible Text), which
 *     is exactly the "black screen" bug.
 *   • NO Tailwind class deps for ANY critical visual. Tailwind is one HTTP
 *     round-trip away from rendering nothing; we inline-style everything.
 *   • NO SVG underline / shimmer trick. Both are async-CSS-dependent.
 *   • System fonts only (`serif` for CELESTA, `system-ui` for the rest).
 *   • Simple opacity + transform animations only — work on every browser.
 *   • Plays once per browser session, dismisses on first deliberate user
 *     interaction (pointerdown / keydown), 2.6s autoplay.
 *
 * If anything else breaks again, the "remove splash entirely" escape hatch
 * is a 1-line change: return null from this component.
 */
const SESSION_KEY = 'cg_splash_seen_v3';

// Brand palette (inline so it never depends on Tailwind)
const MINT = '#7FB069';
const MINT_PALE = '#b9d6a4';
const INK = '#161616';
const BODY_INK = '#1f1f1f';

const styles = {
  wrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    colorScheme: 'light',
    overflow: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    padding: '24px',
    boxSizing: 'border-box',
  },
  inner: {
    position: 'relative',
    zIndex: 2,
    textAlign: 'center',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  celesta: {
    fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif',
    fontWeight: 400,
    fontSize: 'clamp(2.4rem, 9vw, 4.6rem)',
    letterSpacing: '0.5rem',
    color: INK,
    lineHeight: 1,
    margin: 0,
  },
  glowRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    marginTop: 14,
  },
  glowRule: { flex: 1, height: 1.3, backgroundColor: MINT, borderRadius: 999 },
  glow: {
    fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    fontWeight: 400,
    fontSize: 'clamp(1rem, 2.8vw, 1.25rem)',
    letterSpacing: '0.55em',
    color: MINT,
    padding: '0 1em',
    whiteSpace: 'nowrap',
    lineHeight: 1,
  },
  tagline: {
    marginTop: 40,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
    fontWeight: 500,
    fontSize: 'clamp(1.05rem, 4vw, 1.15rem)',
    lineHeight: 1.45,
    color: BODY_INK,
    margin: 0,
  },
  kerala: { color: MINT, fontWeight: 600 },
  heartRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    marginTop: 32,
  },
  heartRule: { flex: 1, height: 1.2, backgroundColor: MINT_PALE, borderRadius: 999 },
  slogan: {
    marginTop: 28,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
    fontWeight: 500,
    fontStyle: 'normal',
    fontSize: 'clamp(1.6rem, 5vw, 2.1rem)',
    color: MINT,
    letterSpacing: '0.02em',
    lineHeight: 1.15,
    margin: 0,
  },
  // Background wash blobs (very faint, never block content)
  orbA: {
    position: 'absolute', top: -180, left: -180, width: 480, height: 480, borderRadius: '50%',
    backgroundColor: 'rgba(217,237,202,0.40)', filter: 'blur(80px)', pointerEvents: 'none',
  },
  orbB: {
    position: 'absolute', bottom: -180, right: -180, width: 520, height: 520, borderRadius: '50%',
    backgroundColor: 'rgba(254,243,199,0.30)', filter: 'blur(80px)', pointerEvents: 'none',
  },
};

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SESSION_KEY); } catch (_) { return true; }
  });
  const [fadingOut, setFadingOut] = useState(false);

  const finish = React.useCallback(() => {
    if (!visible || fadingOut) return;
    setFadingOut(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) { /* noop */ }
    setTimeout(() => { setVisible(false); onDone?.(); }, 380);
  }, [visible, fadingOut, onDone]);

  // Background-preload homepage data while splash is showing
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { cachedGet } = await import('../utils/apiCache');
        const API = process.env.REACT_APP_BACKEND_URL;
        await Promise.allSettled([
          cachedGet(`${API}/api/concerns`, { ttl: 60_000 }),
          cachedGet(`${API}/api/categories`, { ttl: 60_000 }),
          cachedGet(`${API}/api/subcategories`, { ttl: 60_000 }),
          cachedGet(`${API}/api/site-settings`, { ttl: 60_000 }),
          cachedGet(`${API}/api/combos`, { ttl: 60_000 }),
          cachedGet(`${API}/api/products?niche=anti-aging&page=1&limit=20`),
          cachedGet(`${API}/api/products?niche=skincare&page=1&limit=20`),
          cachedGet(`${API}/api/products?niche=cosmetics&page=1&limit=20`),
        ]);
      } catch (_) { /* best-effort */ }
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) { onDone?.(); return; }
    const t = setTimeout(finish, 2600);

    // Arm dismiss listeners AFTER the initial render burst (1.4 s) so spurious
    // load-time scroll / touch events don't kill the splash early.
    let armed = false;
    const skip = () => { if (armed) finish(); };
    const arm = setTimeout(() => { armed = true; }, 1400);
    window.addEventListener('pointerdown', skip, { passive: true });
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(t);
      clearTimeout(arm);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [visible, finish, onDone]);

  if (!visible) return null;

  const sloganLetters = 'Glow With Confidence';

  return (
    <div
      data-testid="splash-screen"
      style={{ ...styles.wrap, ...(fadingOut ? { animation: 'cg-splash-out .38s ease-in forwards' } : { animation: 'cg-splash-in .35s ease-out forwards' }) }}
      role="status"
      aria-label="Celesta Glow"
    >
      <div style={styles.orbA} aria-hidden="true" />
      <div style={styles.orbB} aria-hidden="true" />

      <div style={styles.inner}>
        {/* CELESTA */}
        <div style={{ ...styles.celesta, animation: 'cg-rise .7s cubic-bezier(.22,1,.36,1) .15s both' }}>
          CELESTA
        </div>

        {/* GLOW row with rules */}
        <div style={{ ...styles.glowRow, animation: 'cg-glow .65s cubic-bezier(.22,1,.36,1) .65s both', transformOrigin: 'center' }} aria-hidden="true">
          <span style={styles.glowRule} />
          <span style={styles.glow}>G L O W</span>
          <span style={styles.glowRule} />
        </div>

        {/* Tagline */}
        <p style={{ ...styles.tagline, animation: 'cg-rise .55s ease-out 1s both' }}>
          The Most Trusted
          <br />
          Skincare Ecommerce App
          <br />
          of <span style={styles.kerala}>Kerala</span>
        </p>

        {/* Heart-rule divider */}
        <div style={{ ...styles.heartRow, animation: 'cg-rise .5s ease-out 1.35s both' }} aria-hidden="true">
          <span style={styles.heartRule} />
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ margin: '0 12px', animation: 'cg-pulse 1.8s ease-in-out 1.9s infinite', transformOrigin: 'center' }} aria-hidden="true">
            <path d="M12 21s-7.2-4.35-9.5-9.1C.83 8.6 2.5 5 6 5c2 0 3.5 1.1 4.5 2.7C11.5 6.1 13 5 15 5c3.5 0 5.17 3.6 3.5 6.9C19.2 16.65 12 21 12 21z" fill={MINT} />
          </svg>
          <span style={styles.heartRule} />
        </div>

        {/* Slogan — letter-by-letter reveal, clean sans, no underline */}
        <div style={styles.slogan} aria-label={sloganLetters}>
          {sloganLetters.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: `cg-letter .5s cubic-bezier(.22,1,.36,1) forwards`,
                animationDelay: `${1.6 + i * 0.04}s`,
                whiteSpace: 'pre',
              }}
            >{ch === ' ' ? '\u00A0' : ch}</span>
          ))}
        </div>
      </div>

      {/* Animations — kept TINY and in one inline <style>. No external deps. */}
      <style>{`
        @keyframes cg-splash-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cg-splash-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.02); } }
        @keyframes cg-rise       { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cg-glow       { from { opacity: 0; transform: scaleX(.4); } to { opacity: 1; transform: scaleX(1); } }
        @keyframes cg-letter     { 0% { opacity: 0; transform: translateY(8px) scale(.95); } 60% { opacity: 1; transform: translateY(0) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cg-pulse      { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="splash-screen"] * { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
