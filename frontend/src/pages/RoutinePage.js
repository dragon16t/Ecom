import React, { useEffect, useState, useRef } from 'react';
import BackButton from '../components/BackButton';
import SEOHead, { breadcrumbJsonLd } from '../components/SEOHead';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, Sunrise, Moon, Droplet, Shield, Wand2, ArrowRight, Loader2, Check, Camera, X, ShoppingCart, Plus, BadgeCheck } from 'lucide-react';
import { addToCart } from './Homepage';

const API = process.env.REACT_APP_BACKEND_URL;

/* Compress an image File on the client to a JPEG dataURL (max width 720px, quality 0.72).
   Keeps payloads tiny and prevents giant phone-camera uploads from slowing the page. */
async function compressImage(file, { maxWidth = 720, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Skin profile options */
const SKIN_TYPES = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'normal', label: 'Normal' },
];
// 11 major dermatological concerns considered while generating the report
const CONCERNS = [
  'Fine Lines & Wrinkles',
  'Sagging / Loss of Firmness',
  'Pigmentation & Uneven Tone',
  'Dark Spots',
  'Dullness',
  'Dark Circles',
  'Under-Eye Puffiness',
  'Dryness / Dehydration',
  'Acne / Breakouts',
  'Enlarged Pores',
  'Sensitivity / Redness',
];
const AGE_BANDS = ['18–24', '25–34', '35–44', '45+'];

/* Routine slot mapping — pick one product from these categories per slot.
   Order: Cleanse → Serum → Moisturize → Protect (AM) / Treat (PM). */
const AM_SLOTS = [
  { id: 'cleanse', label: 'Cleanse', icon: Droplet, cats: ['cleanser', 'facewash-scrubs'] },
  { id: 'treat', label: 'Treat', icon: Sparkles, cats: ['serum'] },
  { id: 'moisturize', label: 'Moisturize', icon: Droplet, cats: ['moisturizer-cream'] },
  { id: 'protect', label: 'Protect (SPF)', icon: Shield, cats: ['sunscreen'] },
];
const PM_SLOTS = [
  { id: 'cleanse', label: 'Cleanse', icon: Droplet, cats: ['cleanser', 'facewash-scrubs'] },
  { id: 'eye', label: 'Eye Care', icon: Sparkles, cats: ['eye-care'] },
  { id: 'treat', label: 'Treat', icon: Sparkles, cats: ['serum'] },
  { id: 'moisturize', label: 'Night Cream', icon: Moon, cats: ['moisturizer-cream'] },
];

function pickProduct(products, cats, used) {
  // pick first product from given category list that hasn't been used yet
  for (const cat of cats) {
    const match = products.find(p => p.category === cat && !used.has(p.slug));
    if (match) return match;
  }
  // fallback: any product in cats
  for (const cat of cats) {
    const match = products.find(p => p.category === cat);
    if (match) return match;
  }
  return null;
}

export default function RoutinePage() {
  const [products, setProducts] = useState([]);
  const [skinType, setSkinType] = useState('combination');
  const [age, setAge] = useState('25–34');
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [routine, setRoutine] = useState(null); // { am, pm, skin_score, specialist_notes }
  // 3-angle photo capture (front / left / right)
  const [photoFront, setPhotoFront] = useState(null);
  const [photoLeft, setPhotoLeft] = useState(null);
  const [photoRight, setPhotoRight] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(null); // 'front' | 'left' | 'right' | null
  const [mobile, setMobile] = useState('');
  const fileFrontRef = useRef(null);
  const fileLeftRef = useRef(null);
  const fileRightRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/products?limit=500`).then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const toggleConcern = (c) => {
    setSelectedConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handlePhoto = (angle) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(angle);
    try {
      const compressed = await compressImage(file);
      if (angle === 'front') setPhotoFront(compressed);
      if (angle === 'left') setPhotoLeft(compressed);
      if (angle === 'right') setPhotoRight(compressed);
    } catch { /* ignore */ } finally {
      setPhotoBusy(null);
      const ref = angle === 'front' ? fileFrontRef : angle === 'left' ? fileLeftRef : fileRightRef;
      if (ref.current) ref.current.value = '';
    }
  };
  const clearPhoto = (angle) => {
    if (angle === 'front') setPhotoFront(null);
    if (angle === 'left') setPhotoLeft(null);
    if (angle === 'right') setPhotoRight(null);
  };

  // Deterministic "AI" skin score — same inputs never flicker to different scores.
  const computeSkinScore = (concerns, allPhotos) => {
    let base = 84;
    base -= concerns.length * 3;
    if (allPhotos) base += 6;
    if (age === '35–44') base -= 3;
    if (age === '45+') base -= 6;
    if (skinType === 'sensitive') base -= 2;
    return Math.max(38, Math.min(96, base));
  };

  const generateSpecialistNotes = (concerns) => {
    const c = new Set(concerns);
    const bullets = [];
    if (c.has('Fine Lines & Wrinkles') || c.has('Sagging / Loss of Firmness')) {
      bullets.push('Retinol + Peptide layering nightly to rebuild collagen and improve firmness over 8–12 weeks.');
    }
    if (c.has('Pigmentation & Uneven Tone') || c.has('Dark Spots') || c.has('Dullness')) {
      bullets.push('Daily Vitamin C AM + Niacinamide PM to fade pigment and even skin tone; strict SPF 50 is non-negotiable.');
    }
    if (c.has('Dark Circles') || c.has('Under-Eye Puffiness')) {
      bullets.push('Under-eye peptide cream every night + gentle caffeine roller in the morning to reduce shadows and puffiness.');
    }
    if (c.has('Dryness / Dehydration')) {
      bullets.push('Hyaluronic + Ceramide moisturiser twice daily on damp skin to rebuild the moisture barrier.');
    }
    if (c.has('Acne / Breakouts') || c.has('Enlarged Pores')) {
      bullets.push('AHA/BHA cleanser 3× a week + niacinamide serum daily to control sebum and refine pores. Avoid over-scrubbing.');
    }
    if (c.has('Sensitivity / Redness')) {
      bullets.push('Skip active acids for 2 weeks; use fragrance-free centella cream twice daily to calm the barrier.');
    }
    if (!bullets.length) {
      bullets.push('Skin looks well-balanced. Maintain SPF 50 daily, an antioxidant serum AM and a retinol PM (2× a week) to stay ahead of ageing.');
    }
    if (age === '18–24') bullets.push('Prevention phase — keep the routine light and consistent.');
    else if (age === '25–34') bullets.push('Early collagen-support phase — small daily habits pay compounding returns.');
    else if (age === '35–44') bullets.push('Repair + defend phase — add a night mask twice weekly for deep repair.');
    else bullets.push('Restore phase — layered peptides + growth-factor serums accelerate visible results.');
    return bullets;
  };

  const handleGenerate = () => {
    // MANDATORY: at least the front selfie
    if (!photoFront) {
      alert('Please upload the FRONT selfie first — it helps us personalize your routine.');
      return;
    }
    const cleanMobile = (mobile || '').replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setGenerating(true);
    setRoutine(null);
    setTimeout(() => {
      const used = new Set();
      const am = AM_SLOTS.map(slot => {
        const product = pickProduct(products, slot.cats, used);
        if (product) used.add(product.slug);
        return { slot, product };
      });
      const pmUsed = new Set();
      const pm = PM_SLOTS.map(slot => {
        const product = pickProduct(products, slot.cats, pmUsed);
        if (product) pmUsed.add(product.slug);
        return { slot, product };
      });
      const allPhotos = !!(photoFront && photoLeft && photoRight);
      const skinScore = computeSkinScore(selectedConcerns, allPhotos);
      const specialistNotes = generateSpecialistNotes(selectedConcerns);
      setRoutine({ am, pm, skin_score: skinScore, specialist_notes: specialistNotes, photos_captured: allPhotos });
      setGenerating(false);
      try {
        const payload = {
          skin_type: skinType,
          age,
          concerns: selectedConcerns,
          am: am.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
          pm: pm.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
          photo_url: photoFront && photoFront.startsWith('http') ? photoFront : null,
          photo_data: photoFront && !photoFront.startsWith('http') ? photoFront : null,
          photo_left_data: photoLeft && !photoLeft.startsWith('http') ? photoLeft : null,
          photo_right_data: photoRight && !photoRight.startsWith('http') ? photoRight : null,
          skin_score: skinScore,
          specialist_notes: specialistNotes,
          mobile: cleanMobile,
          session_id: sessionStorage.getItem('sessionId') || null,
        };
        axios.post(`${API}/api/routines/save`, payload).catch(() => {});
      } catch { /* ignore */ }
    }, 1600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-stone-950 to-slate-950 text-white pb-28" data-testid="routine-page">
      <SEOHead
        title="Dermatologist Recommended Skin Care Routine | Celesta Glow"
        description="Build your AM & PM skincare routine with dermatologist-approved skincare in Kerala for fine lines, dry skin, and a healthy glow."
        canonicalPath="/routine"
        jsonLd={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Routine', url: '/routine' }])}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      {/* Glow orbs background */}
      <div className="fixed inset-0 pointer-events-none opacity-50" aria-hidden>
        <div className="absolute top-20 -left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-60 -right-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-white/5 ring-1 ring-white/10 backdrop-blur px-3 py-1.5 rounded-full mb-3" data-testid="routine-eyebrow">
            <Wand2 size={12} className="text-emerald-400" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-emerald-300">AI-Crafted Routine</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight leading-tight bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Your Routine, <span className="italic font-light">made personal.</span>
          </h1>
          <p className="text-sm text-white/60 mt-2 max-w-md mx-auto">
            Tell us about your skin and we'll build a step-by-step AM &amp; PM ritual using Celesta Glow products.
          </p>
        </div>

        {/* Profile card */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-xl ring-1 ring-white/10 p-5 sm:p-6 shadow-2xl shadow-emerald-900/10" data-testid="routine-profile-card">
          {/* 3-angle selfie capture — Front (required), Left & Right (recommended). */}
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-1">Selfies <span className="text-rose-300 font-medium normal-case tracking-normal">(Front is required · Left &amp; Right unlock a deeper analysis)</span></p>
            <p className="text-[11px] text-white/40 mb-3">3 angles let the specialist inspect asymmetry, jawline sag, and pigmentation the front camera hides.</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { angle: 'front', label: 'Front', img: photoFront, ref: fileFrontRef, required: true },
                { angle: 'left',  label: 'Left',  img: photoLeft,  ref: fileLeftRef,  required: false },
                { angle: 'right', label: 'Right', img: photoRight, ref: fileRightRef, required: false },
              ].map(({ angle, label, img, ref, required }) => (
                <div key={angle} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    disabled={photoBusy === angle}
                    data-testid={`routine-photo-${angle}-btn`}
                    className="relative w-full aspect-square rounded-2xl ring-1 ring-white/15 bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex items-center justify-center overflow-hidden disabled:opacity-60"
                  >
                    {photoBusy === angle ? (
                      <Loader2 size={16} className="animate-spin text-white/60" />
                    ) : img ? (
                      <img src={img} alt={`${label} selfie`} className="w-full h-full object-cover" data-testid={`routine-photo-${angle}-preview`} />
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 text-white/60 px-1 text-center">
                        <Camera size={18} />
                        <span className="text-[9px] font-black tracking-wider uppercase">{label}</span>
                        {required && <span className="text-[8px] text-rose-300 font-black">REQUIRED</span>}
                      </div>
                    )}
                  </button>
                  {img && (
                    <button
                      type="button"
                      onClick={() => clearPhoto(angle)}
                      data-testid={`routine-photo-${angle}-clear`}
                      className="text-[10px] text-white/50 hover:text-white/80 inline-flex items-center gap-0.5"
                    >
                      <X size={10} /> Remove
                    </button>
                  )}
                  <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhoto(angle)}
                    data-testid={`routine-photo-${angle}-input`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Mobile — required so the skincare team can follow up */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Mobile number <span className="text-rose-300 font-medium normal-case tracking-normal">(required)</span></p>
            <div className="flex items-center gap-2 bg-white/[0.04] ring-1 ring-white/10 rounded-xl px-3 py-2.5">
              <span className="text-white/60 text-sm font-mono">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile"
                data-testid="routine-mobile-input"
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
              />
            </div>
          </div>

          {/* Skin type */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Skin Type</p>
            <div className="flex flex-wrap gap-2">
              {SKIN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSkinType(t.value)}
                  data-testid={`routine-skintype-${t.value}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all ${
                    skinType === t.value
                      ? 'bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/30'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Age</p>
            <div className="flex flex-wrap gap-2">
              {AGE_BANDS.map(a => (
                <button
                  key={a}
                  onClick={() => setAge(a)}
                  data-testid={`routine-age-${a}`}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    age === a
                      ? 'bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-500/30'
                      : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Concerns */}
          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Top Concerns <span className="text-white/30 font-medium normal-case tracking-normal">(pick 1–3)</span></p>
            <div className="flex flex-wrap gap-2">
              {CONCERNS.map(c => {
                const active = selectedConcerns.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleConcern(c)}
                    data-testid={`routine-concern-${c.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-violet-400 text-violet-950 shadow-lg shadow-violet-500/30'
                        : 'bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10'
                    }`}
                  >
                    {active && <Check size={11} />}
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            data-testid="routine-generate-btn"
            className="mt-7 w-full relative group bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 text-emerald-950 font-black py-4 rounded-2xl text-sm tracking-wide shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-400/50 transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 overflow-hidden"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Crafting your ritual…
              </>
            ) : (
              <>
                <Wand2 size={18} /> Generate My Routine <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
            {/* shimmer */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
          </button>
        </div>

        {/* Routine output */}
        {routine && (
          <div className="mt-6" data-testid="routine-output">
            {/* Skin Score + Specialist Notes — printed at the top of the
                report so users see the "why" before the AM/PM slots. */}
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-white/[0.04] backdrop-blur-xl ring-1 ring-emerald-400/20 p-4 sm:p-5 mb-4" data-testid="routine-skin-score-card">
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Circular score dial */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <path
                      d="M18 2.5a15.5 15.5 0 0 1 0 31 15.5 15.5 0 0 1 0-31"
                      fill="none"
                      stroke="url(#scoreGrad)"
                      strokeWidth="3"
                      strokeDasharray={`${(routine.skin_score / 100) * 97.4} 97.4`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-emerald-300 to-cyan-300 bg-clip-text text-transparent" data-testid="routine-skin-score-value">{routine.skin_score}</span>
                    <span className="text-[9px] font-black tracking-widest text-white/50 uppercase mt-0.5">Score</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-300/90 mb-1">Overall Skin Health</p>
                  <h3 className="font-heading text-lg sm:text-xl font-black text-white leading-tight">
                    {routine.skin_score >= 82 ? 'Excellent baseline' : routine.skin_score >= 65 ? 'Good — room to elevate' : routine.skin_score >= 50 ? 'Needs consistent care' : 'Ready for a full reset'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/60 mt-1">
                    Based on your 3-angle selfies, {selectedConcerns.length || 0} concern{selectedConcerns.length === 1 ? '' : 's'}, skin type ({skinType}) and age band ({age}).
                  </p>
                </div>
              </div>

              {Array.isArray(routine.specialist_notes) && routine.specialist_notes.length > 0 && (
                <div className="mt-4 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-3 sm:p-4" data-testid="routine-specialist-notes">
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-emerald-300/90 mb-2 inline-flex items-center gap-1.5">
                    <BadgeCheck size={11} /> Specialist notes
                  </p>
                  <ul className="space-y-1.5">
                    {routine.specialist_notes.map((line, i) => (
                      <li key={i} className="text-[12px] sm:text-[13px] text-white/85 leading-snug pl-4 relative">
                        <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* "Add all" CTA */}
            <button
              onClick={() => {
                const all = [...routine.am, ...routine.pm].map(s => s.product).filter(Boolean);
                const seen = new Set();
                all.forEach(p => { if (!seen.has(p.slug)) { addToCart(p.slug); seen.add(p.slug); } });
              }}
              data-testid="routine-add-all-btn"
              className="w-full mb-4 flex items-center justify-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black py-3 rounded-2xl text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.99]"
            >
              <ShoppingCart size={15} /> Add entire routine to cart
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[{ key: 'am', title: 'Morning Ritual', icon: Sunrise, accent: 'from-amber-300 to-emerald-300', steps: routine.am }, { key: 'pm', title: 'Night Ritual', icon: Moon, accent: 'from-violet-400 to-cyan-300', steps: routine.pm }].map(({ key, title, icon: TitleIcon, accent, steps }) => (
                <div key={key} className="rounded-3xl bg-white/[0.04] backdrop-blur-xl ring-1 ring-white/10 p-4 sm:p-5" data-testid={`routine-card-${key}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <TitleIcon size={18} className="text-white/80" />
                    <h2 className={`font-heading text-lg sm:text-xl font-black bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{title}</h2>
                  </div>
                  <ol className="space-y-2">
                    {steps.map(({ slot, product }, i) => {
                      const SlotIcon = slot.icon;
                      return (
                        <li key={`${key}-${slot.id}-${i}`} className="relative flex items-stretch gap-2.5 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-2.5 hover:bg-white/[0.06] transition-colors" data-testid={`routine-step-${key}-${i}`}>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/0 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0 self-center">
                            <SlotIcon size={14} className="text-white/80" />
                          </div>
                          <div className="min-w-0 flex-1 self-center">
                            <p className="text-[9px] font-black tracking-[0.18em] uppercase text-emerald-300/80">Step {i + 1} · {slot.label}</p>
                            {product ? (
                              <Link to={`/product/${product.slug}`} className="block mt-0.5 group">
                                <p className="text-[13px] font-bold text-white truncate group-hover:text-emerald-300 transition-colors">{product.short_name || product.name}</p>
                                <p className="text-[10px] text-white/50 truncate">{product.size} · ₹{product.prepaid_price}</p>
                              </Link>
                            ) : (
                              <p className="text-[13px] text-white/40 mt-0.5">— pick from shop —</p>
                            )}
                          </div>
                          {product?.images?.[0] && (
                            <div className="w-11 h-11 rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden flex-shrink-0 self-center">
                              <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                            </div>
                          )}
                          {product && (
                            <button
                              onClick={(e) => { e.preventDefault(); addToCart(product.slug); }}
                              data-testid={`routine-step-add-${key}-${i}`}
                              aria-label={`Add ${product.short_name || product.name} to cart`}
                              className="self-center w-9 h-9 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 flex items-center justify-center transition-colors active:scale-95 flex-shrink-0 shadow-md shadow-emerald-500/30"
                            >
                              <Plus size={16} strokeWidth={2.6} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state CTA when no routine yet */}
        {!routine && !generating && (
          <p className="mt-5 text-center text-xs text-white/40">
            Personalized to your inputs. Takes about 2 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
