import React, { useEffect, useState } from 'react';
import { Gift, Clock, X, Sparkles, Check } from 'lucide-react';

/**
 * CheckoutSurpriseModal — one-shot flash gift reveal that greets the customer
 * the first time they land on /checkout. Presentation only (server-side
 * enforcement of the ₹50 discount still lives in /api/cart/validate — this
 * modal just makes the perk feel earned).
 *
 * Behaviour:
 *   • Renders after a short delay so the checkout paints first
 *   • Two-step reveal: closed gift box → confetti + ₹50 headline
 *   • "Claim my ₹50" auto-dismisses; also closes on backdrop + X click
 *   • sessionStorage guard so the modal never fires twice in one session
 */
export default function CheckoutSurpriseModal({
  amount = 50,
  gift = null,          // { slug, name, image, mrp } — when set, reveals a free product instead
  minSubtotal = 1000,
  timerLabel = '10-minute flash offer',
  onClaim,
  storageKey = 'cg_checkout_surprise_v2',
}) {
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(storageKey) === '1'; } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => {
      setShow(true);
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }, 700);
    return () => clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    if (!show) return;
    // Auto-reveal after 900ms so the box "opens" on its own — user can also tap
    const t = setTimeout(() => setRevealed(true), 900);
    return () => clearTimeout(t);
  }, [show]);

  const close = () => {
    setShow(false);
    setRevealed(false);
  };

  const claim = () => {
    try { onClaim && onClaim(amount); } catch { /* ignore */ }
    close();
  };

  if (!show) return null;

  return (
    <div
      data-testid="checkout-surprise-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-[fadeIn_240ms_ease-out]"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={close}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.06) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes wiggle { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
        @keyframes confetti { 0% { transform: translateY(-40px) rotate(0deg); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(140px) rotate(360deg); opacity: 0 } }
        @keyframes glow { 0%,100% { box-shadow: 0 20px 60px -10px rgba(245,158,11,0.55) } 50% { box-shadow: 0 20px 90px -6px rgba(245,158,11,0.85) } }
      `}</style>

      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden ring-1 ring-amber-200/60"
        style={{ animation: 'popIn 380ms cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warm gradient shell */}
        <div className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-6 py-7 sm:py-8">
          {/* Close */}
          <button
            onClick={close}
            aria-label="Close surprise"
            data-testid="checkout-surprise-close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-stone-500 hover:text-stone-800 flex items-center justify-center shadow-sm"
          >
            <X size={16} />
          </button>

          {/* Eyebrow */}
          <p className="text-[10px] font-black tracking-[0.32em] text-orange-700 uppercase mb-2 text-center flex items-center justify-center gap-1.5">
            <Sparkles size={12} /> A little surprise for you
          </p>

          {/* Gift / Reveal */}
          <div className="flex flex-col items-center justify-center mb-4">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                data-testid="checkout-surprise-open"
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 shadow-[0_20px_50px_-10px_rgba(245,158,11,0.55)] flex items-center justify-center ring-4 ring-white/70"
                style={{ animation: 'wiggle 900ms ease-in-out infinite' }}
              >
                <Gift size={40} className="text-white drop-shadow" strokeWidth={2.4} />
                <span className="absolute -top-2 -right-2 bg-white text-[10px] font-black text-orange-600 px-2 py-0.5 rounded-full shadow ring-1 ring-amber-200">TAP</span>
              </button>
            ) : (
              <div className="relative w-full flex flex-col items-center">
                {/* Confetti dots */}
                {['#f59e0b','#ef4444','#10b981','#8b5cf6','#f43f5e','#0ea5e9','#eab308'].map((c, i) => (
                  <span
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      top: 0,
                      left: `${10 + i * 12}%`,
                      background: c,
                      animation: `confetti ${900 + i * 120}ms ${i * 60}ms ease-in forwards`,
                    }}
                  />
                ))}
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white ring-4 ring-amber-200/70 flex items-center justify-center mb-2 overflow-hidden"
                  style={{ animation: 'glow 2s ease-in-out infinite' }}
                >
                  {gift && gift.image ? (
                    <img src={gift.image} alt={gift.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="text-center leading-none">
                      <p className="text-[10px] font-black tracking-[0.2em] text-amber-700 uppercase mb-1">FLAT</p>
                      <p className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-amber-600 to-rose-600 bg-clip-text text-transparent">₹{amount}</p>
                      <p className="text-[10px] font-black tracking-[0.24em] text-orange-700 uppercase mt-0.5">OFF</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-center font-heading text-lg sm:text-xl font-black text-stone-900 leading-tight">
            {revealed ? (
              gift ? (
                <>You unlocked a <span className="italic text-emerald-700">FREE {gift.name}</span></>
              ) : (
                <>You just unlocked <span className="italic text-orange-700">₹{amount} OFF</span></>
              )
            ) : (
              <>Tap the gift to reveal your surprise</>
            )}
          </h2>

          {/* Sub */}
          <p className="text-center text-[12px] sm:text-[13px] text-stone-600 mt-1.5 leading-snug px-1">
            {revealed ? (
              gift ? (
                <>Worth <b>₹{gift.mrp}</b> — added FREE to your order when paid <b>prepaid</b>. No code needed.</>
              ) : (
                <>Applied automatically at checkout when your cart is above <b>₹{minSubtotal}</b> and paid <b>prepaid</b>.</>
              )
            ) : (
              <>A one-time reward for making it this far — good only during the <b>{timerLabel}</b>.</>
            )}
          </p>

          {/* Timer + CTA */}
          <div className="mt-5 space-y-2">
            <button
              onClick={claim}
              disabled={!revealed}
              data-testid="checkout-surprise-claim"
              className={`w-full inline-flex items-center justify-center gap-2 rounded-full font-black text-sm py-3 shadow-lg transition-all ${
                revealed
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-white active:scale-[0.98]'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {revealed ? (<><Check size={16} strokeWidth={2.8} /> Claim my ₹{amount} OFF</>) : (<><Gift size={16} /> Tap the box first</>)}
            </button>
            <p className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
              <Clock size={11} /> Locked to this checkout session
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
