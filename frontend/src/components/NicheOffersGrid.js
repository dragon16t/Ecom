import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { cldOptim } from '../utils/productImage';
import { ChevronRight, Sparkles, Tag } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * NicheOffersGrid — big, editorial-style offer grid inspired by the reference
 * "Big Beauty Bash" layout. Renders on top of each niche's homepage.
 *
 * Layout:
 *   ┌──────────────┬────────────────┐
 *   │  TOP DEAL    │  Category      │
 *   │  (tall)      │  card #1       │
 *   │              ├────────────────┤
 *   │              │  Category      │
 *   │              │  card #2       │
 *   ├──────────────┴────────────────┤
 *   │   Cross-sell strip (2 chips)  │
 *   └───────────────────────────────┘
 *
 * Data is derived live from the `/api/products?niche={niche}` response so the
 * discount percentages update automatically whenever prices change.
 */
export default function NicheOffersGrid({ niche = 'anti-aging', categories = [], theme = 'auto' }) {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/products`, { params: { niche, limit: 50 } });
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.products || []);
        if (!cancelled) {
          setProducts(items.filter(p => p.is_active !== false));
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [niche]);

  if (!loaded || products.length === 0) return null;

  // Niche-appropriate theme palette
  const palette = resolveTheme(theme, niche);

  // Sort by prepaid_price ascending → cheapest first (best "top deal")
  const sorted = [...products].sort((a, b) => (a.prepaid_price || a.mrp || 0) - (b.prepaid_price || b.mrp || 0));
  const topDeal = sorted[0];

  // Cheapest product per category → drives "Up to X% OFF" tiles
  const categoryDeals = buildCategoryDeals(products, categories);

  // Under-₹X price band that at least 2 products fit into
  const priceBand = findPriceBand(products);

  return (
    <section
      data-testid={`niche-offers-grid-${niche}`}
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-6 sm:mb-10 ring-1 ring-black/5 shadow-lg"
      style={{ background: palette.bg }}
    >
      {/* Sparkles background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <Sparkles className="absolute top-4 left-4 text-white/40" size={16} />
        <Sparkles className="absolute top-8 right-6 text-white/40" size={12} />
        <Sparkles className="absolute bottom-10 left-8 text-white/40" size={10} />
        <Sparkles className="absolute top-1/2 right-4 text-white/30" size={14} />
      </div>

      {/* Header ribbon */}
      <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 text-center">
        <p
          className="text-[10px] sm:text-xs uppercase font-black tracking-[0.3em]"
          style={{ color: palette.headerAccent }}
        >
          Handpicked · This Week
        </p>
        <h2
          className="text-3xl sm:text-5xl font-black italic mt-1"
          style={{
            color: palette.headerText,
            fontFamily: '"Cormorant Garamond", serif',
            letterSpacing: '-0.01em',
          }}
        >
          {palette.title}
        </h2>
        <p className="text-[11px] sm:text-sm font-semibold mt-1" style={{ color: palette.subText }}>
          {palette.subtitle}
        </p>
      </div>

      {/* Grid */}
      <div className="relative px-3 sm:px-6 pt-4 pb-4 sm:pb-6">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* TOP DEAL — tall left card */}
          <TopDealCard product={topDeal} palette={palette} />

          {/* Right column: 2 category tiles stacked */}
          <div className="col-span-2 grid grid-cols-2 gap-2.5 sm:gap-4">
            {categoryDeals.slice(0, 2).map((cd, i) => (
              <CategoryDealCard key={cd.slug || i} deal={cd} palette={palette} niche={niche} />
            ))}
            {categoryDeals.length < 2 && (
              <BrandsBigOffersCard palette={palette} niche={niche} />
            )}
            {categoryDeals[2] ? (
              <CategoryDealCard deal={categoryDeals[2]} palette={palette} niche={niche} />
            ) : (
              <BrandsBigOffersCard palette={palette} niche={niche} />
            )}
            {/* 4th tile — 3rd category deal or brands card */}
            {categoryDeals[3] ? (
              <CategoryDealCard deal={categoryDeals[3]} palette={palette} niche={niche} />
            ) : (
              <BrandsBigOffersCard palette={palette} niche={niche} />
            )}
          </div>
        </div>

        {/* Bottom cross-sell strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mt-3 sm:mt-4">
          <Link
            to={`/shop?niche=${niche}&sort=priceAsc`}
            className="group flex items-center justify-between rounded-2xl p-3 sm:p-4 ring-1 ring-black/5 hover:shadow-md transition-all"
            style={{ background: palette.chipBg }}
            data-testid="offer-chip-under-price"
          >
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: palette.chipAccent }}>
                Under ₹{priceBand}
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
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function TopDealCard({ product, palette }) {
  const img = product?.images?.[0] || product?.image;
  const discount = product?.mrp && product?.prepaid_price
    ? Math.round(((product.mrp - product.prepaid_price) / product.mrp) * 100)
    : 0;

  return (
    <Link
      to={`/product/${product.slug}`}
      className="relative row-span-2 rounded-2xl overflow-hidden bg-white flex flex-col justify-between p-3 sm:p-4 min-h-[280px] sm:min-h-[340px] ring-1 ring-black/5 hover:shadow-xl transition-all group"
      data-testid="offer-top-deal-card"
    >
      <div className="text-left z-10">
        <p className="text-[11px] sm:text-xs font-black tracking-widest" style={{ color: palette.chipAccent }}>
          TOP
        </p>
        <p className="text-lg sm:text-2xl font-black leading-none mt-0.5" style={{ color: palette.headerText }}>
          DEALS
        </p>

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
        {discount > 0 && (
          <p className="mt-0.5 text-[10px] sm:text-xs font-bold" style={{ color: palette.chipAccent }}>
            {discount}% OFF
          </p>
        )}
      </div>

      {img && (
        <div className="relative flex-1 flex items-end justify-center mt-2 -mb-2 sm:-mb-3">
          <img
            src={cldOptim(img, { w: 400 })}
            alt={product.short_name || product.name}
            loading="lazy"
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
            className="w-full h-32 sm:h-44 object-contain opacity-0 transition-opacity duration-300 group-hover:scale-105"
          />
        </div>
      )}
    </Link>
  );
}

function CategoryDealCard({ deal, palette, niche }) {
  const pct = deal.discountPct;
  const img = deal.image;
  return (
    <Link
      to={`/shop?niche=${niche}&category=${encodeURIComponent(deal.slug)}`}
      className="relative rounded-2xl overflow-hidden bg-white/95 flex flex-col p-3 sm:p-4 min-h-[135px] sm:min-h-[164px] ring-1 ring-black/5 hover:shadow-xl transition-all group"
      data-testid={`offer-category-${deal.slug}`}
    >
      {/* Up to X% OFF pill */}
      {pct >= 20 && (
        <div className="absolute top-2 left-2 flex items-center rounded-full overflow-hidden ring-1 ring-black/10 shadow-sm z-10">
          <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white" style={{ background: palette.headerText }}>
            Up to
          </span>
          <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black" style={{ background: palette.chipAccent, color: '#fff' }}>
            {pct}% OFF
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-between">
        <p className="text-sm sm:text-lg font-black leading-tight mt-6 sm:mt-7" style={{ color: palette.headerText }}>
          {deal.label}
        </p>
        {img && (
          <div className="flex items-end justify-center flex-1 pt-2">
            <img
              src={cldOptim(img, { w: 300 })}
              alt={deal.label}
              loading="lazy"
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
              className="h-16 sm:h-20 object-contain opacity-0 transition-opacity duration-300 group-hover:scale-105"
            />
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

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function buildCategoryDeals(products, categories) {
  // Group by product.category, compute cheapest product + max discount % per category
  const byCat = {};
  products.forEach((p) => {
    const c = String(p.category || 'general').toLowerCase();
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(p);
  });

  const deals = Object.entries(byCat).map(([slug, group]) => {
    const cheapest = group.reduce((min, cur) => ((cur.prepaid_price || cur.mrp || 999999) < (min.prepaid_price || min.mrp || 999999) ? cur : min), group[0]);
    const maxDisc = Math.max(
      ...group.map((p) => (p.mrp && p.prepaid_price ? Math.round(((p.mrp - p.prepaid_price) / p.mrp) * 100) : 0))
    );
    // Try to enrich label from the categories array if the caller provided one
    const catMeta = categories.find((c) => String(c.slug).toLowerCase() === slug);
    return {
      slug,
      label: catMeta?.name || catMeta?.short_name || prettifySlug(slug),
      discountPct: maxDisc,
      image: cheapest?.images?.[0] || cheapest?.image || catMeta?.image,
    };
  });

  // Sort by discount % desc, filter out low-discount categories
  return deals
    .filter((d) => d.image)
    .sort((a, b) => b.discountPct - a.discountPct)
    .slice(0, 4);
}

function findPriceBand(products) {
  const prices = products.map((p) => p.prepaid_price || p.mrp || 0).filter(Boolean).sort((a, b) => a - b);
  if (prices.length === 0) return 999;
  const median = prices[Math.floor(prices.length / 2)];
  // Round up to nearest reasonable band above the median
  if (median <= 99) return 99;
  if (median <= 199) return 199;
  if (median <= 299) return 299;
  if (median <= 499) return 499;
  if (median <= 699) return 699;
  return 999;
}

function prettifySlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveTheme(theme, niche) {
  const preset = theme === 'auto' ? niche : theme;
  switch (preset) {
    case 'skincare':
    case 'anti-aging':
      return {
        bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 45%, #fbbf24 100%)',
        headerAccent: '#7c2d12',
        headerText: '#7c2d12',
        subText: '#92400e',
        chipAccent: '#c2410c',
        chipBg: '#fffbeb',
        chipText: '#7c2d12',
        title: 'Glow Bash',
        subtitle: 'The best of Anti-Aging · Ends this week',
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
