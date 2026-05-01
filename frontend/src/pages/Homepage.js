import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, ChevronRight, Flame, Sparkles, ShoppingCart, Star, Truck, Shield, Check, Clock } from 'lucide-react';
import { useTracking } from '../providers/TrackingProvider';
import SearchBar from '../components/SearchBar';
import TrustStrip from '../components/TrustStrip';
import NicheHero from '../components/NicheHero';
import HeroCarousel from '../components/HeroCarousel'; // eslint-disable-line no-unused-vars
import { ProductCard } from './ConcernCategoryPage';
import { playCartSound } from '../utils/cartSound';
import ReviewsCarousel from '../components/ReviewsCarousel';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;
const ACCENT = '#0f766e';
const ACCENT_DARK = '#115e59';
const ACCENT_BG = '#d1fae5';

const BANNER_IMG = 'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/uscaqcsg_217BA6A6-1F87-44A3-AD2C-F750B48A11EF.png';
/* Mobile-only tighter crop (clean wide cream/serum shot) */
const BANNER_IMG_MOBILE = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80';

/* ---- Cart helpers (preserved API for the rest of the app) ---- */
const getCart = () => JSON.parse(sessionStorage.getItem('cart') || '{"items":[]}');
const saveCart = (cart) => { sessionStorage.setItem('cart', JSON.stringify(cart)); window.dispatchEvent(new Event('cartUpdated')); };

/**
 * TBL guard helpers — read the apiCache (already populated by every page load)
 * so we can synchronously decide whether a slug/combo is TBL before mutating cart.
 * Falls back to "allow" if cache is empty so a never-visited product still works.
 */
const _readCachedProducts = () => {
  try {
    const raw = window.localStorage.getItem('apiCache_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const all = [];
    Object.entries(parsed).forEach(([k, v]) => {
      if (k.includes('/api/products') && Array.isArray(v?.value)) all.push(...v.value);
    });
    return all;
  } catch { return []; }
};
const _readCachedCombos = () => {
  try {
    const raw = window.localStorage.getItem('apiCache_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const all = [];
    Object.entries(parsed).forEach(([k, v]) => {
      if (k.includes('/api/combos') && Array.isArray(v?.value)) all.push(...v.value);
    });
    return all;
  } catch { return []; }
};
const isProductTbl = (slug) => {
  const p = _readCachedProducts().find(p => p.slug === slug);
  return p ? !!p.is_to_be_launched : false;
};
const isComboTbl = (comboId) => {
  const products = _readCachedProducts();
  const c = _readCachedCombos().find(c => c.combo_id === comboId);
  if (!c) return false;
  if (c.is_to_be_launched) return true;
  // A combo is also TBL if any of its underlying products is TBL
  return (c.product_slugs || []).some(s => {
    const prod = products.find(p => p.slug === s);
    return prod ? !!prod.is_to_be_launched : false;
  });
};
const _toast = (msg) => {
  try {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#92400e;color:#fff;padding:10px 18px;border-radius:9999px;z-index:9999;font:600 13px system-ui;box-shadow:0 8px 24px rgba(0,0,0,0.18);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  } catch {}
};

/**
 * pruneTblItemsFromCart — silently drop any TBL slug/combo from sessionStorage
 * cart so the count badge + cart page can never show TBL items. Idempotent.
 */
const pruneTblItemsFromCart = () => {
  const cart = getCart();
  const before = cart.items.length;
  cart.items = cart.items.filter(i => {
    if (i.product_slug) return !isProductTbl(i.product_slug);
    if (i.combo_id) return !isComboTbl(i.combo_id);
    return true;
  });
  if (cart.items.length !== before) {
    sessionStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
  }
};
// Run once on module load + every time admin data changes (e.g., admin flips TBL)
if (typeof window !== 'undefined') {
  setTimeout(pruneTblItemsFromCart, 800);
  window.addEventListener('admin-data-changed', pruneTblItemsFromCart);
}

const addToCart = (slug, quantity = 1) => {
  if (isProductTbl(slug)) {
    _toast('This product is coming soon — not available yet.');
    return false;
  }
  const cart = getCart();
  const existing = cart.items.find(i => i.product_slug === slug);
  if (existing) existing.quantity += quantity;
  else cart.items.push({ product_slug: slug, quantity });
  saveCart(cart);
  playCartSound();
  return true;
};
const addComboToCart = (comboId, quantity = 1) => {
  if (isComboTbl(comboId)) {
    _toast('This kit is coming soon — not available yet.');
    return false;
  }
  const cart = getCart();
  const existing = cart.items.find(i => i.combo_id === comboId);
  if (existing) existing.quantity += quantity;
  else cart.items.push({ combo_id: comboId, quantity });
  saveCart(cart);
  playCartSound();
  return true;
};
const setProductQty = (slug, quantity) => {
  if (quantity > 0 && isProductTbl(slug)) {
    _toast('This product is coming soon — not available yet.');
    return;
  }
  const cart = getCart();
  const idx = cart.items.findIndex(i => i.product_slug === slug);
  if (quantity <= 0) {
    if (idx > -1) cart.items.splice(idx, 1);
  } else if (idx > -1) {
    cart.items[idx].quantity = quantity;
  } else {
    cart.items.push({ product_slug: slug, quantity });
    playCartSound();
  }
  saveCart(cart);
};
const getProductQty = (slug) => {
  const cart = getCart();
  const item = cart.items.find(i => i.product_slug === slug);
  return item ? item.quantity : 0;
};
export { getCart, saveCart, addToCart, addComboToCart, setProductQty, getProductQty, isProductTbl, isComboTbl, pruneTblItemsFromCart };

/**
 * Homepage (Anti-Aging niche home for `/`).
 * Simplified to match Skincare/Cosmetics niche pages:
 *  1. Search bar
 *  2. Hero banner (image-as-background, text overlay left)
 *  3. Trust strip
 *  4. Anti-Aging bestsellers grid
 *  5. Complete Kit (flagship offer)
 *  6. CTA card
 */
function Homepage() {
  const { trackAction } = useTracking();
  // Seed from persistent cache so the page paints instantly on revisit
  const _cachedProducts = peek(`${API}/api/products?niche=anti-aging&page=1&limit=48`) || peek(`${API}/api/products?niche=anti-aging`) || [];
  const _cachedProductsList = Array.isArray(_cachedProducts) ? _cachedProducts : (_cachedProducts?.items || []);
  const _cachedCombos = peek(`${API}/api/combos`) || [];
  const _cachedSettings = peek(`${API}/api/site-settings`) || {};
  const [products, setProducts] = useState(_cachedProductsList);
  const [combos, setCombos] = useState(_cachedCombos);
  const [settings, setSettings] = useState(_cachedSettings);
  const [loading, setLoading] = useState(_cachedProductsList.length === 0);

  useEffect(() => {
    // Meta Pixel — page-specific PageView event for Homepage
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView', { page_name: 'homepage', content_category: 'Anti-Aging' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Cap at 48 products per niche — the homepage only renders curated sections
    // (bestsellers, new arrivals, featured). Fetching the full catalog would
    // be 3-5 MB JSON at 2000+ SKUs and freeze low-end devices.
    Promise.all([
      cachedGet(`${API}/api/products?niche=anti-aging&page=1&limit=48`),
      // Short TTL on combos + site-settings so admin TBL/launch toggles + niche-section
      // edits propagate to the live homepage within ~60 seconds without a hard refresh.
      cachedGet(`${API}/api/combos`, { ttl: 60_000 }),
      cachedGet(`${API}/api/site-settings`, { ttl: 60_000 }),
    ])
      .then(([p, c, s]) => {
        if (cancelled) return;
        // Paginated endpoint returns { items, total, ... }; guard for legacy array too.
        const items = Array.isArray(p.data) ? p.data : (p.data?.items || []);
        setProducts(items);
        setCombos(c.data || []);
        setSettings(s.data || {});
        // If everything came from cache we can drop the loader instantly
        if (p.fromCache && c.fromCache && s.fromCache) setLoading(false);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Background-prefetch sibling niches so switching Skincare/Cosmetics is instant
    // (runs after the browser is idle so it never competes with visible content).
    const prefetch = () => {
      cachedGet(`${API}/api/products?niche=skincare&page=1&limit=48`).catch(() => {});
      cachedGet(`${API}/api/products?niche=cosmetics&page=1&limit=48`).catch(() => {});
      cachedGet(`${API}/api/concerns`).catch(() => {});
      cachedGet(`${API}/api/categories`).catch(() => {});
    };
    const idleHandle = (window.requestIdleCallback || window.setTimeout)(prefetch, { timeout: 1500 });
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof idleHandle === 'number') window.cancelIdleCallback(idleHandle);
    };
  }, []);

  // Per-niche customization (admin-editable). Falls back to hardcoded defaults if missing.
  const niche = (settings?.niche_settings && settings.niche_settings['anti-aging']) || {};
  const hero = niche.hero || {};
  const bs = niche.bestsellers || {};
  const ctaCfg = niche.cta_section || {};
  const accent = hero.accent || ACCENT;
  const accentDark = hero.accent_dark || ACCENT_DARK;
  const accentBg = hero.accent_bg || ACCENT_BG;

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    const by = bs.sort_by || 'reviews_count';
    if (by === 'reviews_count') arr.sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
    else if (by === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (by === 'price_asc') arr.sort((a, b) => (a.prepaid_price || 0) - (b.prepaid_price || 0));
    else if (by === 'price_desc') arr.sort((a, b) => (b.prepaid_price || 0) - (a.prepaid_price || 0));
    else arr.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    // Default to showing ALL products in the niche so newly added products from admin always appear.
    // Admin can still set a custom limit via niche_settings.bestsellers.limit if they want.
    // Always show every product in the niche so newly added admin products are immediately visible.
    return arr;
  }, [products, bs.sort_by]);

  const kit = combos.find(c => c.combo_id === 'complete-anti-aging-kit');

  const handleAddCombo = (id) => { addComboToCart(id); trackAction('add_combo', { combo_id: id }); };

  return (
    <div className="bg-stone-50/40" data-testid="homepage">
      <SearchBar accent={accent} niche="anti-aging" testId="anti-aging-search-bar" />

      <NicheHero
        bgImage={hero.image_desktop || BANNER_IMG}
        mobileBgImage={hero.image_mobile || BANNER_IMG_MOBILE}
        eyebrow={hero.eyebrow || 'Anti-Aging'}
        eyebrowDot={accent}
        eyebrowText={accentDark}
        title={<>{hero.title_line1 || 'Visible firming'}<br/><span className="italic font-light" style={{ color: accentDark }}>{hero.title_line2 || '\u0026 youthful glow.'}</span></>}
        subtitle={hero.subtitle || 'Clinical-grade Retinol, Vitamin C and Peptides — formulated for Indian skin to reduce fine lines and brighten in 4 weeks.'}
        cta1={{ label: hero.cta1_label || 'Shop the routine', to: hero.cta1_link || '/categories' }}
        cta2={{ label: hero.cta2_label || 'Free Skin Analysis', to: hero.cta2_link || '/routine' }}
        accent={accent}
        accentDark={accentDark}
        testId="anti-aging-hero"
      />

      <div className="pt-5 sm:pt-7">
        <TrustStrip accent={accent} accentBg={accentBg} />
      </div>

      {/* Banner carousel removed per user request on Anti-Aging niche home. */}

      {/* Complete Kit — flagship single-card offer (admin-toggleable) — premium brand-aligned design */}
      {niche.show_complete_kit !== false && kit && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 sm:pt-12" data-testid="complete-kit-section">
          {/* Eyebrow strip */}
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6">
            <span className="hidden sm:block h-px w-16 bg-gradient-to-r from-transparent to-emerald-300/70" />
            <span className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-amber-50 ring-1 ring-emerald-200/60 px-3.5 py-1.5 rounded-full">
              <Sparkles size={11} className="text-amber-600" />
              <span className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] text-emerald-900 uppercase">Flagship · Best Value</span>
              <Sparkles size={11} className="text-amber-600" />
            </span>
            <span className="hidden sm:block h-px w-16 bg-gradient-to-l from-transparent to-emerald-300/70" />
          </div>

          <div className="relative group/kit">
            {/* Outer glow ring */}
            <div className="absolute -inset-px bg-gradient-to-br from-emerald-300/40 via-amber-200/30 to-emerald-300/40 rounded-[28px] blur-[2px] opacity-70 group-hover/kit:opacity-100 transition-opacity duration-700" />

            <div className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 rounded-[26px] overflow-hidden shadow-[0_30px_80px_-20px_rgba(6,78,59,0.55)]">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
              {/* Soft corner glows */}
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
              {/* Animated shimmer line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

              {/* TOP — 16:9 landscape kit image (admin-managed). Image only, no text overlap. */}
              {(kit.image || settings.bundle_hero_image) && (
                <div className="relative w-full aspect-[16/9] bg-emerald-50 overflow-hidden">
                  <img
                    src={kit.image || settings.bundle_hero_image}
                    alt={kit.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover/kit:scale-[1.02] transition-transform duration-700"
                    data-testid="home-kit-image"
                  />
                </div>
              )}

              {/* CONTENT — sits below the image, no overlap */}
              <div className="relative p-6 sm:p-8 lg:p-10 text-white">
                {/* Savings ribbon — top of content (no longer over the image) */}
                <div className="inline-flex mb-4">
                  <div className="relative bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 text-emerald-950 font-black text-[10px] sm:text-[11px] px-3 py-1.5 rounded-full shadow-lg shadow-amber-700/30 tracking-[0.16em] uppercase ring-1 ring-amber-300/60">
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.5),transparent_60%)] rounded-full pointer-events-none" />
                    <span className="relative">Save ₹{(kit.mrp_total - kit.combo_prepaid_price)?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.1] mb-2 sm:mb-3 tracking-tight">
                  {kit.name}
                </h3>

                  <p className="text-xs sm:text-sm text-emerald-100/80 mb-4 sm:mb-5 leading-relaxed line-clamp-2 max-w-xl">{kit.description}</p>

                  {/* Rating + reviews row */}
                  <div className="flex items-center gap-2 mb-4 sm:mb-5">
                    <div className="flex">
                      {[1,2,3,4,5].map(i => <Star key={i} size={13} className="fill-amber-300 text-amber-300" />)}
                    </div>
                    <span className="text-[11px] sm:text-xs text-emerald-100/90 font-bold">4.9</span>
                    <span className="w-px h-3 bg-emerald-300/40" />
                    <span className="text-[11px] sm:text-xs text-emerald-100/70 font-medium">12,000+ reviews</span>
                  </div>

                  {/* What's inside — pills */}
                  <div className="mb-4 sm:mb-5">
                    <p className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] text-emerald-300/80 uppercase mb-2">What&rsquo;s inside</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Cleanser', 'Serum', 'Eye Cream', 'Night Cream', 'Sunscreen'].map((step) => (
                        <span key={step} className="inline-flex items-center gap-1 bg-white/8 ring-1 ring-emerald-300/25 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-emerald-50">
                          <Check size={9} className="text-amber-300" /> {step}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Price + CTA row */}
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
                    <div className="flex flex-col">
                      {/* Big price */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent leading-none">₹{kit.combo_prepaid_price?.toLocaleString()}</span>
                        <span className="text-[10px] sm:text-[11px] text-emerald-200/70 font-medium">all-inclusive</span>
                      </div>
                      {/* MRP under the price */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs sm:text-sm font-semibold text-emerald-300/60 line-through">₹{kit.mrp_total?.toLocaleString()}</span>
                      </div>
                    </div>

                    {(() => {
                      // The kit is TBL if the combo itself OR any underlying product is TBL.
                      const productsInKit = (kit.product_slugs || []).map(s => products.find(p => p.slug === s)).filter(Boolean);
                      const kitIsTbl = !!kit.is_to_be_launched || productsInKit.length === 0 || productsInKit.some(p => p.is_to_be_launched);
                      if (kitIsTbl) {
                        return (
                          <button
                            disabled
                            data-testid="complete-kit-tbl"
                            className="flex-1 sm:flex-none bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-black py-3.5 px-8 sm:px-10 rounded-full text-sm tracking-[0.28em] uppercase shadow-[0_14px_36px_-8px_rgba(245,158,11,0.55)] ring-1 ring-amber-300/50 flex items-center justify-center gap-2 cursor-not-allowed"
                          >
                            <Clock size={16} className="animate-pulse" /> TBL
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => handleAddCombo(kit.combo_id)}
                          data-testid="add-complete-kit"
                          className="group/btn relative overflow-hidden flex-1 sm:flex-none bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 hover:from-amber-300 hover:via-amber-400 hover:to-orange-300 text-emerald-950 font-black py-3.5 px-6 sm:px-7 rounded-full text-sm tracking-wide shadow-[0_14px_36px_-8px_rgba(245,158,11,0.55)] transition-all hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-2 ring-1 ring-amber-200/50"
                        >
                          <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.45),transparent_55%)] pointer-events-none" />
                          <span className="relative flex items-center gap-2">
                            <ShoppingCart size={16} /> Add Complete Kit <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
                          </span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Trust footer */}
                  <div className="mt-4 sm:mt-5 pt-4 border-t border-emerald-300/15 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-[11px] text-emerald-100/80">
                    <span className="flex items-center gap-1.5"><Truck size={11} className="text-amber-300" /> Free shipping</span>
                    <span className="flex items-center gap-1.5"><Shield size={11} className="text-amber-300" /> 30-day return</span>
                    <span className="flex items-center gap-1.5"><Check size={11} className="text-amber-300" /> COD available</span>
                    <span className="flex items-center gap-1.5"><Sparkles size={11} className="text-amber-300" /> Free skin analysis</span>
                  </div>
                </div>

              {/* Bottom shimmer line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            </div>
          </div>
        </section>
      )}

      {/* Bestsellers — admin-toggleable */}
      {bs.enabled !== false && (
      <section className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="flex items-end justify-between mb-4 sm:mb-6 px-1 sm:px-0">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 sm:mb-1.5 flex items-center gap-2" style={{ color: accent }}>
              <Flame size={11} style={{ fill: accent, color: accent }} /> {bs.eyebrow || 'Trending now'}
            </p>
            <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
              {bs.title_prefix || 'Anti-Aging'} <span className="italic" style={{ color: accent }}>{bs.title_highlight || 'Bestsellers'}</span>
            </h2>
          </div>
          <Link to="/shop?niche=anti-aging" className="text-[11px] sm:text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: accent }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="aspect-[3/5] bg-gradient-to-br from-stone-100 to-stone-200 rounded-3xl" />)}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-500 ring-1 ring-emerald-100">No bestsellers yet — check back soon.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {sortedProducts.map(p => <ProductCard key={p.slug} product={p} />)}
          </div>
        )}
      </section>
      )}

      {/* Customer reviews — auto-scrolling carousel pulled from /admin/reviews */}
      {niche.show_reviews !== false && (
        <ReviewsCarousel
          title={niche.reviews_title || 'Loved by customers across India'}
          eyebrow={niche.reviews_eyebrow || 'Real reviews · Verified buyers'}
        />
      )}

      {/* Dermatologist section — admin-toggleable + editable copy */}
      {niche.show_dermatologist !== false && <DermatologistSection accent={accent} accentDark={accentDark} cfg={niche.dermatologist} />}

      {/* FAQ — admin-toggleable + admin-editable list */}
      {niche.show_faq !== false && <FaqSection accent={accent} accentDark={accentDark} faqs={niche.faqs} title={niche.faq_title} eyebrow={niche.faq_eyebrow} />}

      {/* Routine CTA — admin-editable */}
      {ctaCfg.enabled !== false && (
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(to right, ${ctaCfg.bg_from || '#047857'}, ${ctaCfg.bg_via || '#065f46'}, ${ctaCfg.bg_to || '#115e59'})` }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 85% 15%, white 0%, transparent 50%), radial-gradient(circle at 15% 85%, white 0%, transparent 50%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
          <p className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] text-emerald-200 uppercase mb-2">{ctaCfg.eyebrow || 'Build your routine'}</p>
          <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-2">{ctaCfg.title || 'Not sure where to start?'}</h2>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mx-auto mb-4 sm:mb-5">{ctaCfg.subtitle || "Tell us your skin type — we'll build a personalized AM & PM ritual in 2 seconds."}</p>
          <Link to={ctaCfg.button_link || '/routine'} className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-900 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-2xl hover:-translate-y-0.5 transition-all">
            <Sparkles size={13} className="text-emerald-700" /> {ctaCfg.button_label || 'Start Routine Builder'} <ChevronRight size={13} />
          </Link>
        </div>
      </section>
      )}
    </div>
  );
}

export default Homepage;

/* ===================== Anti-Aging-only sections ===================== */

import { ChevronDown, BadgeCheck } from 'lucide-react';

function DermatologistSection({ accent, accentDark, cfg = {} }) {
  const eyebrow = cfg.eyebrow || 'Dermatologically formulated';
  const titlePart1 = cfg.title_part1 || 'Built with';
  const titleHighlight = cfg.title_highlight || 'board-certified dermatologists';
  const titleSuffix = cfg.title_suffix || ' for Indian skin.';
  const body = cfg.body || 'Every formulation goes through a 3-stage review with dermatology experts who specialize in tropical-climate skin — so the actives that *should* irritate Indian skin (retinol, Vit-C, AHAs) actually work without flushing, peeling or post-inflammatory pigmentation.';
  const stats = (Array.isArray(cfg.stats) && cfg.stats.length > 0) ? cfg.stats : [
    { num: '4', label: 'Weeks to visible firming' },
    { num: '0', label: 'Parabens · Sulfates · Mineral oil' },
    { num: '98%', label: 'Reported softer skin in 30 days' },
  ];
  const cta_label = cfg.cta_label || 'Book free dermat consult';
  const cta_link = cfg.cta_link || '/consultation';
  const image = cfg.image || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80';
  return (
    <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 py-8 sm:py-12" data-testid="anti-aging-dermat">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl ring-1 ring-emerald-100 p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-[4/5] sm:aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50">
              <img src={image} alt="Board-certified dermatologist" className="w-full h-full object-cover object-top" />
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5 flex items-center gap-2" style={{ color: accentDark }}>
              <BadgeCheck size={12} style={{ color: accentDark }} /> {eyebrow}
            </p>
            <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black leading-tight text-stone-900 mb-3">
              {titlePart1} <span className="italic" style={{ color: accent }}>{titleHighlight}</span>{titleSuffix}
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed mb-5">{body}</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {stats.map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-emerald-50/60 ring-1 ring-emerald-100">
                  <div className="font-heading text-2xl sm:text-3xl font-black leading-none" style={{ color: accentDark }}>{s.num}</div>
                  <p className="text-[10px] mt-1.5 leading-tight" style={{ color: accentDark }}>{s.label}</p>
                </div>
              ))}
            </div>
            <Link to={cta_link} className="inline-flex items-center gap-2 text-white font-black py-2.5 px-5 rounded-full text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-900/15 transition-all hover:-translate-y-0.5" style={{ background: accent }}>
              {cta_label} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, defaultOpen, accent }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-stone-200 overflow-hidden" data-testid={`faq-item-${q.slice(0,16).toLowerCase().replace(/\s+/g,'-')}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-stone-50/60 transition-colors">
        <span className="text-sm sm:text-base font-bold text-stone-900 leading-snug">{q}</span>
        <ChevronDown size={18} className={`flex-shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} style={open ? { color: accent } : undefined} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 text-[13px] sm:text-sm text-stone-600 leading-relaxed">{a}</div>
      )}
    </div>
  );
}

function FaqSection({ accent, accentDark, faqs: customFaqs, title, eyebrow }) {
  const defaults = [
    { q: 'How quickly will I see results from the Anti-Aging Kit?', a: 'Most users notice softer skin and a brighter complexion within 7–10 days. Visible firming and reduction in fine lines typically appear at 4 weeks of consistent AM + PM use.' },
    { q: 'Is retinol safe for Indian skin? Will it cause irritation?', a: 'Our retinol is encapsulated in a slow-release matrix specifically tested on melanin-rich, tropical skin types. It releases over 8 hours which dramatically reduces flushing, peeling and post-inflammatory pigmentation common with conventional retinols.' },
    { q: 'Can I use the Vitamin C serum and retinol together?', a: 'Yes — but apply Vitamin C in the AM (it pairs beautifully with sunscreen) and retinol at PM. Stacking both at the same time can over-exfoliate sensitive skin.' },
    { q: 'Are the products dermatologically tested?', a: 'Every formula passes a 3-stage review with board-certified dermatologists, plus independent lab testing for safety, efficacy and shelf stability under Indian climate conditions.' },
    { q: 'What if it doesn\'t work for me?', a: 'We offer a 30-day no-questions-asked money-back guarantee. If you don\'t see results, message us on WhatsApp and we\'ll process a full refund.' },
    { q: 'How is shipping & delivery?', a: 'Free shipping on orders over ₹499. Most metros receive their order within 2–3 business days. We also offer Cash on Delivery and 24-hour dispatch.' },
  ];
  const faqs = (Array.isArray(customFaqs) && customFaqs.length > 0) ? customFaqs : defaults;
  return (
    <section className="bg-white py-8 sm:py-12" data-testid="anti-aging-faq">
      <div className="max-w-3xl mx-auto px-3 sm:px-6">
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1.5" style={{ color: accent }}>{eyebrow || 'Frequently asked'}</p>
          <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 leading-tight">
            {title ? (
              <>{title.split(' ').slice(0, -1).join(' ')} <span className="italic" style={{ color: accent }}>{title.split(' ').slice(-1)[0]}</span></>
            ) : (
              <>Got <span className="italic" style={{ color: accent }}>questions?</span></>
            )}
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} accent={accent} />)}
        </div>
      </div>
    </section>
  );
}
