import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { cldOptim } from '../utils/productImage';
import { ChevronRight, Sparkles, Tag } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * NicheOffersGrid — editorial "Beauty Bash"-style offer strip.
 *
 * Rules that make it honest (no "₹399 → ₹399" silliness):
 *   • TopDealCard only renders for a product with a REAL discount
 *     (`mrp > prepaid_price`). If the niche has none, we skip the tall card
 *     and fall back to a price-band tile ("Under ₹99 / ₹150 / …").
 *   • CategoryDealCard only shows when max category discount ≥ 15%. Below
 *     that we render "New Arrivals" / brand tiles instead of a fake pill.
 *
 * Layout:
 *   Row A — main grid (Top-Deal + 3 category tiles)
 *   Row B — auto-scrolling horizontal strip of "Under ₹X" picks (pill-shaped)
 *   Row C — two cross-sell chips
 */
export default function NicheOffersGrid({ niche = 'anti-aging', categories = [], theme = 'auto' }) {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/products`, { params: { niche, limit: 60 } });
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
        if (!cancelled) {
          setProducts(items.filter((p) => p.is_active !== false));
          setLoaded(true);
        }
      } catch (_) {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [niche]);

  const discounted = useMemo(
    () => products.filter((p) => p.mrp && p.prepaid_price && p.mrp > p.prepaid_price),
    [products],
  );

  const topDeal = useMemo(() => {
    if (discounted.length === 0) return null;
    // pick the product with the highest % discount
    return [...discounted].sort((a, b) => {
      const pa = (a.mrp - a.prepaid_price) / a.mrp;
      const pb = (b.mrp - b.prepaid_price) / b.mrp;
      return pb - pa;
    })[0];
  }, [discounted]);

  const categoryDeals = useMemo(
    () => buildCategoryDeals(products, categories),
    [products, categories],
  );

  const priceBandPicks = useMemo(
    () => buildPriceBandPicks(products),
    [products],
  );

  if (!loaded || products.length === 0) {
    // Never render nothing — show the branded header + skeleton tiles so the
    // section is present the instant the page paints. The tiles fill in with
    // real data as soon as /api/products resolves (usually < 400 ms).
    return (
      <section
        data-testid={`niche-offers-grid-${niche}-skeleton`}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-6 sm:mb-10 ring-1 ring-black/5 shadow-lg"
        style={{ background: resolveTheme(theme, niche).bg }}
      >
        <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 text-center">
          <p className="text-[10px] sm:text-xs uppercase font-black tracking-[0.3em]" style={{ color: resolveTheme(theme, niche).headerAccent }}>
            Handpicked · This Week
          </p>
          <h2
            className="text-3xl sm:text-5xl font-black italic mt-1"
            style={{ color: resolveTheme(theme, niche).headerText, fontFamily: '"Cormorant Garamond", serif', letterSpacing: '-0.01em' }}
          >
            {resolveTheme(theme, niche).title}
          </h2>
          <p className="text-[11px] sm:text-sm font-semibold mt-1" style={{ color: resolveTheme(theme, niche).subText }}>
            {resolveTheme(theme, niche).subtitle}
          </p>
        </div>
        <div className="relative px-3 sm:px-6 pt-4 pb-4 sm:pb-6">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="row-span-2 rounded-2xl bg-white/80 min-h-[280px] sm:min-h-[340px] animate-pulse" />
            <div className="col-span-2 grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="rounded-2xl bg-white/80 min-h-[135px] sm:min-h-[164px] animate-pulse" />
              <div className="rounded-2xl bg-white/80 min-h-[135px] sm:min-h-[164px] animate-pulse" />
              <div className="rounded-2xl bg-white/80 min-h-[135px] sm:min-h-[164px] animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    );
  }
  const palette = resolveTheme(theme, niche);

  return (
    <section
      data-testid={`niche-offers-grid-${niche}`}
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-6 sm:mb-10 ring-1 ring-black/5 shadow-lg"
      style={{ background: palette.bg }}
    >
      {/* decorative sparkles */}
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <Sparkles className="absolute top-4 left-4 text-white/60" size={16} />
        <Sparkles className="absolute top-8 right-6 text-white/60" size={12} />
        <Sparkles className="absolute bottom-10 left-8 text-white/60" size={10} />
        <Sparkles className="absolute top-1/2 right-4 text-white/50" size={14} />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 text-center">
        <p className="text-[10px] sm:text-xs uppercase font-black tracking-[0.3em]" style={{ color: palette.headerAccent }}>
          Handpicked · This Week
        </p>
        <h2
          className="text-3xl sm:text-5xl font-black italic mt-1"
          style={{ color: palette.headerText, fontFamily: '"Cormorant Garamond", serif', letterSpacing: '-0.01em' }}
        >
          {palette.title}
        </h2>
        <p className="text-[11px] sm:text-sm font-semibold mt-1" style={{ color: palette.subText }}>
          {palette.subtitle}
        </p>
      </div>

      {/* Row A — main grid */}
      <div className="relative px-3 sm:px-6 pt-4">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {topDeal ? (
            <TopDealCard product={topDeal} palette={palette} />
          ) : (
            <PriceBandBigCard palette={palette} niche={niche} band={priceBandPicks[0]?.band || 999} />
          )}

          <div className="col-span-2 grid grid-cols-2 gap-2.5 sm:gap-4">
            {(categoryDeals.length ? categoryDeals : []).slice(0, 3).map((cd) => (
              <CategoryDealCard key={cd.slug} deal={cd} palette={palette} niche={niche} />
            ))}
            {/* Fill remaining slots with brand card until we have 3 tiles */}
            {Array.from({ length: Math.max(0, 3 - categoryDeals.length) }).map((_, i) => (
              <BrandsBigOffersCard key={`brand-${i}`} palette={palette} niche={niche} />
            ))}
          </div>
        </div>
      </div>

      {/* Row B — auto-scrolling price-band strip (pill-shaped image containers) */}
      {priceBandPicks.length >= 2 && (
        <AutoScrollStrip picks={priceBandPicks} palette={palette} niche={niche} />
      )}

      {/* Row C — cross-sell chips */}
      <div className="relative px-3 sm:px-6 pb-4 sm:pb-6 grid grid-cols-2 gap-2.5 sm:gap-4">
        <Link
          to={`/shop?niche=${niche}&sort=priceAsc`}
          className="group flex items-center justify-between rounded-2xl p-3 sm:p-4 ring-1 ring-black/5 hover:shadow-md transition-all"
          style={{ background: palette.chipBg }}
          data-testid="offer-chip-cheapest"
        >
          <div>
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: palette.chipAccent }}>
              Lowest Prices First
            </p>
            <p className="text-sm sm:text-base font-black" style={{ color: palette.chipText }}>
              Steal Deals
            </p>
          </div>
          <ChevronRight size={20} className="opacity-70 group-hover:translate-x-1 transition-transform" style={{ color: palette.chipAccent }} />
        </Link>
        <Link
          to={`/shop?niche=${niche}&filter=bestseller`}
          className="group flex items-center justify-between rounded-2xl p-3 sm:p-4 ring-1 ring-black/5 hover:shadow-md transition-all"
          style={{ background: palette.chipBg }}
          data-testid="offer-chip-bestsellers"
        >
          <div>
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: palette.chipAccent }}>
              Top Rated
            </p>
            <p className="text-sm sm:text-base font-black" style={{ color: palette.chipText }}>
              Bestsellers
            </p>
          </div>
          <ChevronRight size={20} className="opacity-70 group-hover:translate-x-1 transition-transform" style={{ color: palette.chipAccent }} />
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function TopDealCard({ product, palette }) {
  const img = product?.images?.[0] || product?.image;
  const discount = Math.round(((product.mrp - product.prepaid_price) / product.mrp) * 100);
  return (
    <Link
      to={`/product/${product.slug}`}
      className="relative row-span-2 rounded-2xl overflow-hidden bg-white flex flex-col justify-between p-3 sm:p-4 min-h-[280px] sm:min-h-[340px] ring-1 ring-black/5 hover:shadow-xl transition-all group"
      data-testid="offer-top-deal-card"
    >
      <div className="text-left z-10">
        <p className="text-[11px] sm:text-xs font-black tracking-widest" style={{ color: palette.chipAccent }}>TOP</p>
        <p className="text-lg sm:text-2xl font-black leading-none mt-0.5" style={{ color: palette.headerText }}>DEALS</p>
        <div className="inline-flex items-center gap-1.5 mt-3 rounded-full px-2 py-0.5" style={{ background: palette.chipAccent, color: '#fff' }}>
          <span className="text-[10px] sm:text-xs font-bold line-through opacity-80">₹{product.mrp}</span>
        </div>
        <div className="mt-1.5">
          <span className="rounded-full px-2.5 py-1 text-white font-black text-sm sm:text-base" style={{ background: palette.headerText }}>
            ₹{product.prepaid_price}
          </span>
        </div>
        <p className="mt-2 text-xs sm:text-sm font-semibold" style={{ color: palette.headerText }}>
          {product.short_name || product.name}
        </p>
        <p className="mt-0.5 text-[10px] sm:text-xs font-bold" style={{ color: palette.chipAccent }}>
          {discount}% OFF
        </p>
      </div>
      {img && (
        <div className="relative flex-1 flex items-end justify-center mt-2 -mb-2 sm:-mb-3">
          {/* Oval / pill container */}
          <div className="w-32 sm:w-40 h-32 sm:h-44 rounded-[50%_50%_45%_45%/60%_60%_40%_40%] bg-gradient-to-b from-white to-transparent flex items-end justify-center overflow-hidden">
            <img
              src={cldOptim(img, { w: 400 })}
              alt={product.short_name || product.name}
              loading="lazy"
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
              className="w-full h-full object-contain opacity-0 transition-opacity duration-300 group-hover:scale-105"
            />
          </div>
        </div>
      )}
    </Link>
  );
}

function CategoryDealCard({ deal, palette, niche }) {
  return (
    <Link
      to={`/shop?niche=${niche}&category=${encodeURIComponent(deal.slug)}`}
      className="relative rounded-2xl overflow-hidden bg-white/95 flex flex-col p-3 sm:p-4 min-h-[135px] sm:min-h-[164px] ring-1 ring-black/5 hover:shadow-xl transition-all group"
      data-testid={`offer-category-${deal.slug}`}
    >
      <div className="absolute top-2 left-2 flex items-center rounded-full overflow-hidden ring-1 ring-black/10 shadow-sm z-10">
        <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white" style={{ background: palette.headerText }}>
          Up to
        </span>
        <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black" style={{ background: palette.chipAccent, color: '#fff' }}>
          {deal.discountPct}% OFF
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <p className="text-sm sm:text-lg font-black leading-tight mt-6 sm:mt-7" style={{ color: palette.headerText }}>
          {deal.label}
        </p>
        {deal.image && (
          <div className="flex items-end justify-center flex-1 pt-2">
            <div className="w-20 sm:w-24 h-16 sm:h-20 rounded-[50%/45%] overflow-hidden bg-white flex items-center justify-center">
              <img
                src={cldOptim(deal.image, { w: 300 })}
                alt={deal.label}
                loading="lazy"
                decoding="async"
                onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                className="w-full h-full object-contain opacity-0 transition-opacity duration-300 group-hover:scale-105"
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function BrandsBigOffersCard({ palette, niche }) {
  return (
    <Link
      to={`/shop?niche=${niche}`}
      className="relative rounded-2xl overflow-hidden flex items-center justify-center p-3 sm:p-4 min-h-[135px] sm:min-h-[164px] ring-1 ring-black/5 hover:shadow-xl transition-all group"
      style={{ background: `radial-gradient(circle at 30% 30%, ${palette.chipAccent}22, ${palette.headerText}11)` }}
      data-testid="offer-brands-big-offers"
    >
      <div className="text-center">
        <Tag size={18} className="mx-auto mb-1.5" style={{ color: palette.chipAccent }} />
        <p className="text-sm sm:text-lg font-black leading-tight" style={{ color: palette.headerText, fontFamily: '"Cormorant Garamond", serif' }}>
          BIG BRANDS
        </p>
        <p className="text-sm sm:text-lg font-black leading-tight" style={{ color: palette.chipAccent, fontFamily: '"Cormorant Garamond", serif' }}>
          BIG OFFERS
        </p>
      </div>
    </Link>
  );
}

function PriceBandBigCard({ palette, niche, band }) {
  return (
    <Link
      to={`/shop?niche=${niche}&sort=priceAsc`}
      className="relative row-span-2 rounded-2xl overflow-hidden bg-white flex flex-col items-center justify-center p-3 sm:p-4 min-h-[280px] sm:min-h-[340px] ring-1 ring-black/5 hover:shadow-xl transition-all"
      data-testid="offer-top-priceband-card"
    >
      <Tag size={22} style={{ color: palette.chipAccent }} className="mb-2" />
      <p className="text-[11px] sm:text-xs font-black tracking-widest" style={{ color: palette.chipAccent }}>UNDER</p>
      <p className="text-3xl sm:text-4xl font-black leading-none mt-1" style={{ color: palette.headerText }}>₹{band}</p>
      <p className="mt-2 text-xs sm:text-sm font-semibold text-center" style={{ color: palette.headerText }}>
        Best-value picks
      </p>
    </Link>
  );
}

/**
 * Horizontally auto-scrolling strip of price-band picks with pill-shaped
 * image containers. Duplicates the list once so the CSS marquee loops
 * seamlessly. Paused on hover so mobile users can tap a product.
 */
function AutoScrollStrip({ picks, palette, niche }) {
  const stripRef = useRef(null);
  const track = [...picks, ...picks]; // duplicate for seamless loop

  return (
    <div className="relative px-3 sm:px-6 py-3 sm:py-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: palette.headerAccent }}>
          Under ₹{picks[0].band} · Move fast
        </p>
        <Link
          to={`/shop?niche=${niche}&sort=priceAsc`}
          className="text-[11px] sm:text-xs font-bold underline underline-offset-2"
          style={{ color: palette.chipAccent }}
        >
          See all
        </Link>
      </div>
      <div
        ref={stripRef}
        className="overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)' }}
      >
        <div
          className="flex gap-3 animate-[niche-strip-scroll_28s_linear_infinite]"
          style={{ width: 'max-content' }}
          onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = 'paused'; }}
          onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = 'running'; }}
          onTouchStart={(e) => { e.currentTarget.style.animationPlayState = 'paused'; }}
          onTouchEnd={(e) => { e.currentTarget.style.animationPlayState = 'running'; }}
        >
          {track.map((p, i) => {
            const img = p.images?.[0] || p.image;
            const hasDiscount = p.mrp && p.prepaid_price && p.mrp > p.prepaid_price;
            return (
              <Link
                key={`${p.slug}-${i}`}
                to={`/product/${p.slug}`}
                className="flex-shrink-0 w-36 sm:w-44 bg-white rounded-2xl ring-1 ring-black/5 p-3 hover:shadow-md transition-all"
                data-testid={`offer-strip-item-${p.slug}`}
              >
                <div className="w-full h-24 sm:h-28 rounded-[50%/45%] bg-gray-50 flex items-center justify-center overflow-hidden">
                  {img && (
                    <img
                      src={cldOptim(img, { w: 280 })}
                      alt={p.short_name || p.name}
                      loading="lazy"
                      decoding="async"
                      onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                      className="w-full h-full object-contain opacity-0 transition-opacity duration-300"
                    />
                  )}
                </div>
                <p className="mt-2 text-[11px] sm:text-xs font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.6em]">
                  {p.short_name || p.name}
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-black" style={{ color: palette.headerText }}>₹{p.prepaid_price}</span>
                  {hasDiscount && (
                    <span className="text-[10px] text-gray-400 line-through">₹{p.mrp}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* keyframes for the marquee */}
      <style>{`
        @keyframes niche-strip-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function buildCategoryDeals(products, categories) {
  const byCat = {};
  products.forEach((p) => {
    const c = String(p.category || 'general').toLowerCase();
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(p);
  });

  const deals = Object.entries(byCat).map(([slug, group]) => {
    const cheapest = group.reduce(
      (min, cur) => ((cur.prepaid_price || cur.mrp || 999999) < (min.prepaid_price || min.mrp || 999999) ? cur : min),
      group[0],
    );
    const maxDisc = Math.max(
      ...group.map((p) => (p.mrp && p.prepaid_price && p.mrp > p.prepaid_price ? Math.round(((p.mrp - p.prepaid_price) / p.mrp) * 100) : 0)),
    );
    const catMeta = categories.find((c) => String(c.slug).toLowerCase() === slug);
    return {
      slug,
      label: catMeta?.name || catMeta?.short_name || prettifySlug(slug),
      discountPct: maxDisc,
      image: cheapest?.images?.[0] || cheapest?.image || catMeta?.image,
    };
  });

  // Only keep categories with a REAL discount ≥ 15% AND a usable image
  return deals
    .filter((d) => d.image && d.discountPct >= 15)
    .sort((a, b) => b.discountPct - a.discountPct)
    .slice(0, 3);
}

/**
 * Pick a price band that at least 3 products fit into, then return the
 * cheapest products for the auto-scroll strip.
 */
function buildPriceBandPicks(products) {
  const bands = [99, 149, 199, 299, 499, 699, 999];
  for (const band of bands) {
    const picks = products
      .filter((p) => (p.prepaid_price || p.mrp || 999999) <= band)
      .sort((a, b) => (a.prepaid_price || a.mrp || 999999) - (b.prepaid_price || b.mrp || 999999));
    if (picks.length >= 3) {
      return picks.slice(0, 8).map((p) => ({ ...p, band }));
    }
  }
  // fallback — take the 6 cheapest regardless of band
  return [...products]
    .sort((a, b) => (a.prepaid_price || a.mrp || 999999) - (b.prepaid_price || b.mrp || 999999))
    .slice(0, 6)
    .map((p) => ({ ...p, band: 999 }));
}

function prettifySlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveTheme(theme, niche) {
  const preset = theme === 'auto' ? niche : theme;
  switch (preset) {
    case 'skincare':
      return {
        bg: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 45%, #10b981 100%)',
        headerAccent: '#065f46',
        headerText: '#064e3b',
        subText: '#047857',
        chipAccent: '#059669',
        chipBg: '#f0fdf4',
        chipText: '#064e3b',
        title: 'Glow Bash',
        subtitle: 'The best of skincare · Ends this week',
      };
    case 'anti-aging':
      return {
        bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 45%, #f59e0b 100%)',
        headerAccent: '#7c2d12',
        headerText: '#7c2d12',
        subText: '#92400e',
        chipAccent: '#c2410c',
        chipBg: '#fffbeb',
        chipText: '#7c2d12',
        title: 'Celesta Glow Bash',
        subtitle: 'FLAT 50% OFF + Zero Delivery + Zero Tax on Anti-Aging',
      };
    case 'cosmetics':
    case 'makeup':
      return {
        bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 45%, #f472b6 100%)',
        headerAccent: '#9f1239',
        headerText: '#9f1239',
        subText: '#be185d',
        chipAccent: '#db2777',
        chipBg: '#fdf2f8',
        chipText: '#9f1239',
        title: 'Beauty Bash',
        subtitle: 'Handpicked cosmetics · Up to 60% OFF',
      };
    default:
      return {
        bg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 45%, #3b82f6 100%)',
        headerAccent: '#1e3a8a',
        headerText: '#1e3a8a',
        subText: '#1d4ed8',
        chipAccent: '#2563eb',
        chipBg: '#eff6ff',
        chipText: '#1e3a8a',
        title: 'Mega Bash',
        subtitle: 'Top deals · This week only',
      };
  }
}
