/**
 * CategoryShowcase — rich "Shop by Category" section for the niche home pages.
 *
 * Renders one card per category that contains products in this niche. Each card
 * shows up to 4 product previews + a "View all" CTA pointing at /category/<slug>.
 *
 * Empty categories are filtered out automatically so the section stays tidy as
 * the catalog grows. The outer card is a focusable div (not an <a>) so the
 * inner product chips can be real links — keeping the HTML valid.
 */
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { productPrimaryImage } from '../utils/productImage';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300';

function ProductChip({ p, accent, onClick }) {
  const img = productPrimaryImage(p, PLACEHOLDER);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(`/product/${p.slug}`); }}
      className="flex flex-col group text-left focus:outline-none"
      data-testid={`category-showcase-product-${p.slug}`}
    >
      <div
        className="aspect-square w-full bg-stone-50 rounded-xl overflow-hidden ring-1 ring-stone-200 group-hover:ring-2 transition-all"
        style={{ '--tw-ring-color': accent }}
      >
        <img
          src={img}
          alt={p.name}
          loading="lazy"
          decoding="async"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <p className="mt-1.5 text-[11px] sm:text-xs font-bold text-stone-800 line-clamp-1">{p.short_name || p.name}</p>
      <p className="text-[10px] sm:text-[11px] text-stone-500">
        ₹{p.prepaid_price}
        {p.mrp > p.prepaid_price && (
          <span className="ml-1 line-through text-stone-400">₹{p.mrp}</span>
        )}
      </p>
    </button>
  );
}

export default function CategoryShowcase({
  categories = [],
  products = [],
  niche = 'skincare',
  accent = '#16a34a',
  accentBg = '#dcfce7',
  testIdPrefix = 'category-showcase',
  enabled = true,
  title = 'Shop by Category',
  subtitle = "Find what you're looking for",
  highlight = 'looking for',
}) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const byCat = new Map();
    for (const p of products) {
      const cat = p.category;
      if (!cat) continue;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(p);
    }
    const tieBreak = (a, b) =>
      ((a.sort_order ?? 99) - (b.sort_order ?? 99)) ||
      String(a.slug || '').localeCompare(String(b.slug || ''));
    for (const arr of byCat.values()) arr.sort(tieBreak);

    return categories
      .filter(c => (c.niche || c.group) === niche && byCat.has(c.slug) && byCat.get(c.slug).length > 0)
      .map(c => ({ category: c, items: byCat.get(c.slug).slice(0, 4), total: byCat.get(c.slug).length }));
  }, [categories, products, niche]);

  if (!enabled || groups.length === 0) return null;

  const subtitleParts = subtitle.split(highlight);
  const renderedTitle = subtitleParts.length > 1
    ? <>{subtitleParts[0]}<span className="italic font-light" style={{ color: accent }}>{highlight}</span>{subtitleParts.slice(1).join(highlight)}</>
    : subtitle;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-14" data-testid={testIdPrefix}>
      <div className="flex items-end justify-between mb-5 sm:mb-7">
        <div>
          <p className="text-[10px] sm:text-[11px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: accent }}>
            {title}
          </p>
          <h2 className="font-heading text-2xl sm:text-4xl font-black text-stone-900 leading-tight">
            {renderedTitle}
          </h2>
        </div>
        <Link
          to={`/${niche}/shop`}
          className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-stone-700 hover:text-stone-900 transition-colors"
          data-testid={`${testIdPrefix}-view-all`}
        >
          View entire shop <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {groups.map(({ category, items, total }) => (
          <div
            key={category.slug}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/category/${category.slug}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/category/${category.slug}`); }}
            className="group bg-white ring-1 ring-stone-200 rounded-3xl p-4 sm:p-5 hover:ring-2 hover:shadow-md transition-all cursor-pointer"
            style={{ '--tw-ring-color': accent }}
            data-testid={`${testIdPrefix}-card-${category.slug}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${category.accent_from || accentBg} 0%, ${category.accent_to || accentBg} 100%)` }}
              >
                {category.icon || '✨'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base sm:text-lg font-black text-stone-900 truncate group-hover:underline decoration-2 underline-offset-4">
                  {category.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-500 truncate">
                  {total} {total === 1 ? 'product' : 'products'}{category.tagline ? ` · ${category.tagline}` : ''}
                </p>
              </div>
              <ChevronRight size={20} className="text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {items.map(p => <ProductChip key={p.slug} p={p} accent={accent} onClick={navigate} />)}
              {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square rounded-xl bg-stone-50 ring-1 ring-stone-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
