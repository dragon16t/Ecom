import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, ArrowRight, Star, Flame, Heart, ShieldCheck, Truck, Leaf, ChevronRight } from 'lucide-react';
import BackButton from '../components/BackButton';
import TrustStrip from '../components/TrustStrip';
import { prefetchHandlers } from '../utils/routePrefetch';
import { cachedGet } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

/* =====================================================================
   ADMIN-EDITABLE DEFAULTS (used when `site_settings.categories_hub` is empty)
   Every section's content can be overridden from Admin → Categories Hub.
   ===================================================================== */
const HUB_DEFAULTS = {
  hero: {
    eyebrow: 'EXPLORE THE COLLECTION',
    title_line1: 'Shop by',
    title_line2: 'Category.',
    subtitle: 'From clinical anti-aging to luxe cosmetics — find what you\'re looking for in seconds.',
    image_desktop: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1800&q=80',
    image_mobile: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80',
    accent: '#0f766e',
    search_placeholder: 'Search categories, concerns, products…',
  },
  niche_cards: {
    anti_aging: {
      enabled: true,
      eyebrow: 'Youthful Radiance',
      title: 'Anti-Aging',
      subtitle: 'Clinical retinol, peptides & vitamin-C built for Indian skin.',
      image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=80',
      cta_label: 'Discover',
      cta_link: '/',
      accent: '#0f766e',
      bg_from: '#ecfdf5',
      bg_to: '#a7f3d0',
    },
    skincare: {
      enabled: true,
      eyebrow: 'Healthy Glowing Skin',
      title: 'Skincare',
      subtitle: 'Acne, pigmentation, dryness, dullness — pick your concern, get the routine.',
      image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=800&q=80',
      cta_label: 'Pick your concern',
      cta_link: '/skincare',
      accent: '#0e7490',
      bg_from: '#ecfeff',
      bg_to: '#a5f3fc',
    },
    cosmetics: {
      enabled: true,
      eyebrow: 'Enhance Your Beauty',
      title: 'Cosmetics',
      subtitle: 'Long-wear lip, satin foundation, hydrating blush — colour that loves your skin.',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
      cta_label: 'Shop the shades',
      cta_link: '/cosmetics',
      accent: '#be185d',
      bg_from: '#fdf2f8',
      bg_to: '#fbcfe8',
    },
  },
  ribbon: {
    enabled: true,
    text: 'New customer? Flat ₹50 OFF with code',
    code: 'WELCOME50',
    cta_label: 'Shop now',
    cta_link: '/shop',
    bg_from: '#0f766e',
    bg_to: '#115e59',
  },
  ingredient_strip: {
    enabled: true,
    title: 'Powered by clinical ingredients',
    subtitle: 'Hand-picked for Indian skin tones and the Indian climate.',
    items: [
      { name: 'Retinol',     hex: '#fef3c7', img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80' },
      { name: 'Vitamin C',   hex: '#fef9c3', img: 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=200&q=80' },
      { name: 'Niacinamide', hex: '#fce7f3', img: 'https://images.unsplash.com/photo-1556228841-a3c527ebefe5?auto=format&fit=crop&w=200&q=80' },
      { name: 'Hyaluronic',  hex: '#cffafe', img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=200&q=80' },
      { name: 'Peptides',    hex: '#dcfce7', img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=200&q=80' },
      { name: 'Alpha Arbutin',hex: '#ede9fe', img: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=200&q=80' },
    ],
  },
  editors_picks: {
    enabled: true,
    eyebrow: 'EDITOR\'S PICKS',
    title: 'This month\'s most-loved',
    slugs: [], // auto-pick top-rated if empty
  },
};

const NICHES_META = {
  'anti-aging': { name: 'Anti-Aging', tagline: 'Youthful Radiance', accent: '#0f766e' },
  'skincare':   { name: 'Skincare',   tagline: 'Healthy Glowing Skin', accent: '#0e7490' },
  'cosmetics':  { name: 'Cosmetics',  tagline: 'Enhance Your Beauty',  accent: '#be185d' },
};

/* ---------- Premium circular tile (image-first) ---------- */
function CircleTile({ to, image, label, accent, icon, testId, badge }) {
  const [errored, setErrored] = useState(false);
  return (
    <Link
      to={to}
      data-testid={testId}
      {...prefetchHandlers(to)}
      className="group flex flex-col items-center text-center focus:outline-none"
    >
      <div
        className="relative w-[88px] h-[88px] sm:w-[120px] sm:h-[120px] lg:w-[150px] lg:h-[150px] rounded-full p-[3px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
        style={{ background: `conic-gradient(from 210deg, ${accent}55 0deg, ${accent}11 140deg, transparent 280deg)` }}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-stone-100 ring-1 ring-stone-200 flex items-center justify-center shadow-sm">
          {image && !errored ? (
            <img
              src={image}
              alt={label}
              loading="lazy"
              decoding="async"
              onError={() => setErrored(true)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <span className="text-3xl sm:text-4xl select-none" style={{ color: accent }}>{icon || '✨'}</span>
          )}
        </div>
        {badge && (
          <span
            className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md uppercase tracking-wider"
            style={{ background: accent }}
          >{badge}</span>
        )}
      </div>
      <span className="mt-2 sm:mt-3 text-[11px] sm:text-[13px] lg:text-sm font-bold text-stone-800 leading-tight max-w-[88px] sm:max-w-[120px] lg:max-w-[150px] line-clamp-2">{label}</span>
    </Link>
  );
}

/* ---------- Hero block ---------- */
function HubHero({ hero, query, setQuery }) {
  const accent = hero.accent || '#0f766e';
  return (
    <section className="relative overflow-hidden" data-testid="hub-hero">
      {/* Background image with gradient veil */}
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 640px)" srcSet={hero.image_mobile || hero.image_desktop} />
          <img src={hero.image_desktop} alt="" className="w-full h-full object-cover" />
        </picture>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(120deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.86) 38%, rgba(255,255,255,0.35) 70%, transparent 100%)`,
          }}
        />
      </div>

      {/* Floating accent dots (subtle, premium) */}
      <span className="hidden md:block absolute -bottom-12 left-[55%] w-72 h-72 rounded-full blur-3xl opacity-50" style={{ background: accent }} aria-hidden="true" />
      <span className="hidden md:block absolute -top-20 right-[10%] w-56 h-56 rounded-full blur-3xl opacity-30" style={{ background: '#fda4af' }} aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-16 sm:pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-2xl">
          <p
            className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase mb-4 px-3 py-1.5 rounded-full ring-1 backdrop-blur-sm"
            style={{ color: accent, background: '#ffffff99', borderColor: `${accent}33` }}
            data-testid="hub-hero-eyebrow"
          >
            <Sparkles size={12} />
            {hero.eyebrow}
          </p>
          <h1 className="font-heading text-[44px] sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight text-stone-900">
            {hero.title_line1}{' '}
            <span className="italic font-black bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${accent}, #be185d)` }}>
              {hero.title_line2}
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">{hero.subtitle}</p>

          {/* Premium search */}
          <div className="mt-7 relative max-w-xl">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={hero.search_placeholder || 'Search categories, concerns, products…'}
              data-testid="hub-hero-search"
              style={{ fontSize: '16px' }}
              className="w-full pl-12 pr-32 py-4 rounded-2xl bg-white/95 ring-1 ring-stone-200 focus:ring-2 focus:ring-stone-900 text-sm placeholder:text-stone-400 outline-none shadow-lg shadow-stone-200/40 transition-all backdrop-blur-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase text-white" style={{ background: accent }}>
              50K+ products
            </span>
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: Truck, label: '24H Dispatch' },
              { icon: ShieldCheck, label: 'Derma-tested' },
              { icon: Leaf, label: 'Clean Beauty' },
              { icon: Star, label: '4.8 · 50K+ reviews' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 bg-white/90 ring-1 ring-stone-200 rounded-full px-3 py-1.5 text-[11px] font-bold text-stone-700 backdrop-blur-sm">
                <Icon size={12} style={{ color: accent }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Big editorial niche card ---------- */
function NicheCard({ cfg, layout = 'left', testId }) {
  if (!cfg?.enabled) return null;
  const flip = layout === 'right';
  return (
    <Link
      to={cfg.cta_link || '/shop'}
      data-testid={testId}
      className="group block relative overflow-hidden rounded-3xl ring-1 ring-stone-200 bg-white shadow-sm hover:shadow-xl transition-all duration-500"
    >
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Image side */}
        <div className={`relative aspect-[4/3] md:aspect-auto md:min-h-[320px] ${flip ? 'md:order-2' : ''}`}>
          <img
            src={cfg.image}
            alt={cfg.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(${flip ? '270deg' : '90deg'}, rgba(255,255,255,0) 50%, ${cfg.bg_from || '#ffffff'}99 100%)` }}
          />
        </div>
        {/* Content side */}
        <div
          className="relative p-7 sm:p-10 lg:p-14 flex flex-col justify-center"
          style={{ background: `linear-gradient(135deg, ${cfg.bg_from || '#fafaf9'} 0%, ${cfg.bg_to || '#ffffff'}55 100%)` }}
        >
          <p
            className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase mb-3"
            style={{ color: cfg.accent }}
          >{cfg.eyebrow}</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-stone-900 leading-[1.05]">{cfg.title}</h2>
          <p className="mt-3 text-sm sm:text-base text-stone-600 leading-relaxed max-w-md">{cfg.subtitle}</p>
          <span
            className="mt-6 inline-flex items-center gap-2 text-xs sm:text-sm font-black tracking-widest uppercase self-start px-5 py-3 rounded-full text-white shadow-lg transition-transform group-hover:translate-x-1"
            style={{ background: cfg.accent }}
          >
            {cfg.cta_label}
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Section wrapper ---------- */
function HubSection({ accent, eyebrow, title, viewAllTo, viewAllLabel = 'View all', testId, children }) {
  return (
    <section className="relative" data-testid={testId}>
      <div className="flex items-end justify-between mb-5 sm:mb-7 px-1">
        <div>
          <p className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase mb-1" style={{ color: accent }}>{eyebrow}</p>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-stone-900 leading-tight tracking-tight">{title}</h2>
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-[11px] sm:text-xs font-bold whitespace-nowrap hover:underline inline-flex items-center gap-1" style={{ color: accent }}>
            {viewAllLabel} <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/* ---------- Editor's picks horizontal product row ---------- */
function EditorPicksRow({ cfg, products }) {
  if (!cfg?.enabled) return null;
  let picks = [];
  if (Array.isArray(cfg.slugs) && cfg.slugs.length > 0) {
    picks = cfg.slugs.map(s => products.find(p => p.slug === s)).filter(Boolean);
  }
  if (picks.length === 0) {
    picks = [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  }
  if (picks.length === 0) return null;

  return (
    <HubSection accent="#be185d" eyebrow={cfg.eyebrow || "EDITOR'S PICKS"} title={cfg.title || 'Editor\'s Picks'} testId="hub-editors-picks">
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 -mx-3 px-3 snap-x snap-mandatory scrollbar-hide">
        {picks.map((p, i) => (
          <Link
            key={p.slug}
            to={`/product/${p.slug}`}
            className="flex-shrink-0 w-[160px] sm:w-[200px] group snap-start"
            data-testid={`hub-pick-${p.slug}`}
          >
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-stone-100 ring-1 ring-stone-200 shadow-sm group-hover:shadow-xl transition-all duration-500">
              {p.images?.[0] && <img src={p.images[0]} alt={p.short_name || p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
              {i < 3 && (
                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md tracking-wider uppercase" style={{ background: i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : '#ca8a04' }}>
                  <Flame size={9} /> #{i + 1}
                </span>
              )}
              {p.rating && (
                <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-white/95 backdrop-blur-sm shadow-sm">
                  <Star size={9} className="fill-amber-400 text-amber-400" /> {p.rating}
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <p className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2 leading-snug">{p.short_name || p.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm font-black text-stone-900">₹{p.prepaid_price}</span>
                {p.mrp > p.prepaid_price && <span className="text-[10px] text-stone-400 line-through">₹{p.mrp}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </HubSection>
  );
}

/* ---------- Ingredient strip ---------- */
function IngredientStrip({ cfg }) {
  if (!cfg?.enabled || !cfg.items?.length) return null;
  return (
    <section className="relative" data-testid="hub-ingredients">
      <div className="text-center mb-6">
        <p className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase mb-1 text-emerald-700">CLEAN · CLINICAL · INDIAN-SKIN</p>
        <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-stone-900 leading-tight tracking-tight">{cfg.title}</h2>
        {cfg.subtitle && <p className="mt-2 text-sm text-stone-500 max-w-xl mx-auto">{cfg.subtitle}</p>}
      </div>
      <div className="flex justify-start sm:justify-center gap-3 sm:gap-6 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3">
        {cfg.items.map((it, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center text-center group" data-testid={`hub-ing-${i}`}>
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ring-1 ring-stone-200 shadow-sm overflow-hidden flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{ background: it.hex || '#fef3c7' }}
            >
              {it.img ? <img src={it.img} alt={it.name} loading="lazy" className="w-full h-full object-cover" /> : <Sparkles size={20} className="text-stone-500" />}
            </div>
            <p className="mt-2 text-[11px] sm:text-xs font-bold text-stone-800 max-w-[80px] line-clamp-2 leading-tight">{it.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Promo ribbon ---------- */
function PromoRibbon({ cfg }) {
  if (!cfg?.enabled) return null;
  return (
    <Link
      to={cfg.cta_link || '/shop'}
      className="block relative overflow-hidden rounded-3xl text-white px-6 py-5 sm:px-8 sm:py-6 shadow-lg ring-1 ring-white/10"
      style={{ background: `linear-gradient(135deg, ${cfg.bg_from || '#0f766e'} 0%, ${cfg.bg_to || '#115e59'} 100%)` }}
      data-testid="hub-ribbon"
    >
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.3), transparent 50%)' }} />
      <div className="relative flex items-center justify-between gap-5 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-black tracking-[0.32em] uppercase opacity-80 mb-1.5">LIMITED TIME</p>
          <p className="text-base sm:text-2xl font-black leading-snug">
            {cfg.text}
          </p>
          {cfg.code && (
            <span className="inline-flex items-center mt-2 px-3 py-1.5 rounded-lg text-sm sm:text-base font-mono font-black bg-white/95 text-stone-900 tracking-wider shadow-sm">
              {cfg.code}
            </span>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-stone-900 text-xs font-black tracking-wider uppercase shadow-md">
          {cfg.cta_label || 'Shop now'} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

/* =====================================================================
   MAIN PAGE
   ===================================================================== */
export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [products, setProducts] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      cachedGet(`${API}/api/categories`),
      cachedGet(`${API}/api/concerns`),
      cachedGet(`${API}/api/products`),
      cachedGet(`${API}/api/site-settings`),
    ])
      .then(([c, cn, p, s]) => {
        if (cancelled) return;
        setCategories(c.data || []);
        setConcerns(cn.data || []);
        setProducts(p.data || []);
        setSiteSettings(s.data || {});
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Merge admin hub config with defaults (deep-ish: per top key)
  const hub = useMemo(() => {
    const ovr = siteSettings?.categories_hub || {};
    return {
      hero: { ...HUB_DEFAULTS.hero, ...(ovr.hero || {}) },
      niche_cards: {
        anti_aging: { ...HUB_DEFAULTS.niche_cards.anti_aging, ...((ovr.niche_cards || {}).anti_aging || {}) },
        skincare:   { ...HUB_DEFAULTS.niche_cards.skincare,   ...((ovr.niche_cards || {}).skincare   || {}) },
        cosmetics:  { ...HUB_DEFAULTS.niche_cards.cosmetics,  ...((ovr.niche_cards || {}).cosmetics  || {}) },
      },
      ribbon: { ...HUB_DEFAULTS.ribbon, ...(ovr.ribbon || {}) },
      ingredient_strip: { ...HUB_DEFAULTS.ingredient_strip, ...(ovr.ingredient_strip || {}) },
      editors_picks: { ...HUB_DEFAULTS.editors_picks, ...(ovr.editors_picks || {}) },
    };
  }, [siteSettings]);

  const cosmeticsCats = useMemo(
    () => categories.filter(c => c.group === 'cosmetics').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [categories]
  );
  const antiAgingProducts = useMemo(
    () => products.filter(p => p.niche === 'anti-aging'),
    [products]
  );
  const skincareConcerns = useMemo(
    () => concerns.filter(c => !c.niche || c.niche === 'skincare').slice(0, 16),
    [concerns]
  );

  const filterFn = (item) => !query.trim() || (item.name || item.short_name || '').toLowerCase().includes(query.toLowerCase());

  const filteredAA = useMemo(() => antiAgingProducts.filter(filterFn), [antiAgingProducts, query]);
  const filteredConcerns = useMemo(() => skincareConcerns.filter(filterFn), [skincareConcerns, query]);
  const filteredCosmetics = useMemo(() => cosmeticsCats.filter(filterFn), [cosmeticsCats, query]);

  const allEmpty = !filteredAA.length && !filteredConcerns.length && !filteredCosmetics.length;

  return (
    <div className="bg-stone-50/50 pb-12" data-testid="categories-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>

      {/* HERO */}
      <HubHero hero={hub.hero} query={query} setQuery={setQuery} />

      {/* TRUST STRIP */}
      <div className="mt-6 sm:mt-10">
        <TrustStrip accent={hub.hero.accent} accentBg="#dcfce7" />
      </div>

      {/* MAIN BODY */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-8 sm:mt-12 space-y-10 sm:space-y-14">

        {/* THREE BIG EDITORIAL NICHE CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6" data-testid="hub-niche-cards">
          {/* Anti-Aging — full width on its own row to feel hero-like */}
          <div className="md:col-span-2">
            <NicheCard cfg={hub.niche_cards.anti_aging} layout="left" testId="hub-card-anti-aging" />
          </div>
          {/* Skincare + Cosmetics — split row */}
          <NicheCard cfg={hub.niche_cards.skincare} layout="left" testId="hub-card-skincare" />
          <NicheCard cfg={hub.niche_cards.cosmetics} layout="right" testId="hub-card-cosmetics" />
        </section>

        {/* PROMO RIBBON */}
        <PromoRibbon cfg={hub.ribbon} />

        {/* ANTI-AGING — products */}
        {loading ? (
          <div className="bg-white rounded-3xl ring-1 ring-stone-200 p-6 animate-pulse">
            <div className="h-6 w-1/3 bg-stone-100 rounded mb-5" />
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-full bg-stone-100" />)}
            </div>
          </div>
        ) : (
          <>
            {filteredAA.length > 0 && (
              <div className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-9 shadow-sm">
                <HubSection
                  accent={NICHES_META['anti-aging'].accent}
                  eyebrow={NICHES_META['anti-aging'].tagline}
                  title={NICHES_META['anti-aging'].name}
                  viewAllTo="/"
                  testId="hub-row-anti-aging"
                >
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                    {filteredAA.map(p => (
                      <CircleTile
                        key={p.slug}
                        to={`/product/${p.slug}`}
                        image={p.images?.[0]}
                        label={p.short_name || p.name}
                        accent={NICHES_META['anti-aging'].accent}
                        icon="🧴"
                        badge={p.badge === 'Bestseller' ? 'Best' : undefined}
                        testId={`cat-circle-${p.slug}`}
                      />
                    ))}
                  </div>
                </HubSection>
              </div>
            )}

            {/* SKINCARE — concerns */}
            {filteredConcerns.length > 0 && (
              <div className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-9 shadow-sm">
                <HubSection
                  accent={NICHES_META['skincare'].accent}
                  eyebrow={NICHES_META['skincare'].tagline}
                  title="Shop by Concern"
                  viewAllTo="/skincare"
                  testId="hub-row-skincare"
                >
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                    {filteredConcerns.map(c => (
                      <CircleTile
                        key={c.slug}
                        to={`/concern/${c.slug}`}
                        image={c.image}
                        label={c.name}
                        accent={NICHES_META['skincare'].accent}
                        icon={c.icon}
                        testId={`cat-concern-${c.slug}`}
                      />
                    ))}
                  </div>
                </HubSection>
              </div>
            )}

            {/* EDITORS PICKS — premium product strip between rows */}
            <EditorPicksRow cfg={hub.editors_picks} products={products} />

            {/* COSMETICS — categories */}
            {filteredCosmetics.length > 0 && (
              <div className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-9 shadow-sm">
                <HubSection
                  accent={NICHES_META['cosmetics'].accent}
                  eyebrow={NICHES_META['cosmetics'].tagline}
                  title="Cosmetics Categories"
                  viewAllTo="/cosmetics"
                  testId="hub-row-cosmetics"
                >
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                    {filteredCosmetics.map(c => (
                      <CircleTile
                        key={c.slug}
                        to={`/category/${c.slug}`}
                        image={c.image}
                        label={c.name}
                        accent={NICHES_META['cosmetics'].accent}
                        icon={c.icon}
                        testId={`cat-circle-${c.slug}`}
                      />
                    ))}
                  </div>
                </HubSection>
              </div>
            )}

            {/* INGREDIENT STRIP */}
            <IngredientStrip cfg={hub.ingredient_strip} />

            {/* EMPTY STATE */}
            {allEmpty && query.trim() && (
              <div className="bg-white rounded-3xl ring-1 ring-stone-200 p-10 sm:p-14 text-center" data-testid="hub-empty">
                <Search size={40} className="mx-auto text-stone-300 mb-3" />
                <p className="text-base font-bold text-stone-700 mb-1">No matches for "{query}"</p>
                <p className="text-sm text-stone-500">Try searching for "serum", "lipstick", "acne", or "pigmentation".</p>
              </div>
            )}

            {/* FINAL CTA */}
            <Link
              to="/shop"
              className="block relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white text-center px-6 py-12 sm:py-16 shadow-xl"
              data-testid="hub-final-cta"
            >
              <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(190,24,93,0.6), transparent 50%), radial-gradient(circle at 70% 70%, rgba(15,118,110,0.5), transparent 50%)' }} />
              <div className="relative">
                <p className="text-[10px] sm:text-[11px] font-black tracking-[0.32em] uppercase text-pink-300 mb-3">CAN'T DECIDE?</p>
                <h2 className="font-heading text-3xl sm:text-5xl font-black tracking-tight leading-tight">Browse our entire range</h2>
                <p className="mt-3 text-sm sm:text-base text-stone-300 max-w-md mx-auto">Free shipping across India · 7-day sealed return · COD available.</p>
                <span className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-stone-900 text-sm font-black tracking-wider uppercase shadow-lg">
                  Shop everything <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
