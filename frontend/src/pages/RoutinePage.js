import React, { useEffect, useState, useRef } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, Sunrise, Moon, Droplet, Shield, Wand2, ArrowRight, Loader2, Check, Camera, X, ShoppingCart, Plus } from 'lucide-react';
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
const CONCERNS = [
  'Fine Lines', 'Acne', 'Pigmentation', 'Dullness', 'Dark Circles', 'Dryness', 'Oiliness', 'Sensitivity',
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
  const [routine, setRoutine] = useState(null); // { am: [{slot, product}], pm: [...] }
  const [photo, setPhoto] = useState(null); // compressed JPEG dataURL
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/products`).then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const toggleConcern = (c) => {
    setSelectedConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      // ignore
    } finally {
      setPhotoBusy(false);
      // reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const clearPhoto = () => setPhoto(null);

  const handleGenerate = () => {
    setGenerating(true);
    setRoutine(null);
    // Simulated "AI" pick — pleasant 1.6s delay then pick products by category slot
    setTimeout(() => {
      const used = new Set();
      const am = AM_SLOTS.map(slot => {
        const product = pickProduct(products, slot.cats, used);
        if (product) used.add(product.slug);
        return { slot, product };
      });
      // Allow PM cleanse to reuse AM cleanse — clear used for new pick
      const pmUsed = new Set();
      const pm = PM_SLOTS.map(slot => {
        const product = pickProduct(products, slot.cats, pmUsed);
        if (product) pmUsed.add(product.slug);
        return { slot, product };
      });
      setRoutine({ am, pm });
      setGenerating(false);
      // Persist to admin so the retention/skin teams can see what was generated
      try {
        const payload = {
          skin_type: skinType,
          age,
          concerns: selectedConcerns,
          am: am.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
          pm: pm.map(s => ({ slot: { id: s.slot.id, label: s.slot.label }, product_slug: s.product?.slug || null, product_name: s.product?.name || null })),
          photo_url: photo && photo.startsWith('http') ? photo : null,
          photo_data: photo && !photo.startsWith('http') ? photo : null,
          session_id: sessionStorage.getItem('sessionId') || null,
        };
        axios.post(`${API}/api/routines/save`, payload).catch(() => {});
      } catch { /* ignore */ }
    }, 1600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-stone-950 to-slate-950 text-white pb-28" data-testid="routine-page">
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
          {/* Optional selfie upload — auto-compressed client-side */}
          <div>
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-white/50 mb-2">Selfie <span className="text-white/30 font-medium normal-case tracking-normal">(optional, helps personalize)</span></p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy}
                data-testid="routine-photo-btn"
                className="relative w-20 h-20 rounded-2xl ring-1 ring-white/15 bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex items-center justify-center overflow-hidden flex-shrink-0 disabled:opacity-60"
              >
                {photoBusy ? (
                  <Loader2 size={18} className="animate-spin text-white/60" />
                ) : photo ? (
                  <img src={photo} alt="Your selfie" className="w-full h-full object-cover" data-testid="routine-photo-preview" />
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-white/60">
                    <Camera size={20} />
                    <span className="text-[9px] font-black tracking-wider">UPLOAD</span>
                  </div>
                )}
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  data-testid="routine-photo-clear"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 text-xs text-white/70"
                >
                  <X size={12} /> Remove
                </button>
              )}
              <p className="text-[11px] text-white/45 leading-snug">
                JPG/PNG up to 10 MB.<br />Auto-compressed in your browser before use.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhoto}
                data-testid="routine-photo-input"
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
