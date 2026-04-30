import React, { useEffect, useState, useMemo } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { prefetchHandlers } from '../utils/routePrefetch';
import { cachedGet } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

/* Niche metadata (no in-card icon, just heading + accent) */
const NICHES_META = {
  'anti-aging': { name: 'Anti-Aging', tagline: 'Youthful Radiance', accent: '#0f766e', soft: 'from-emerald-50/60 to-white' },
  'skincare':   { name: 'Skincare',   tagline: 'Healthy Glowing Skin', accent: '#0e7490', soft: 'from-cyan-50/60 to-white' },
  'cosmetics':  { name: 'Cosmetics',  tagline: 'Enhance Your Beauty',  accent: '#be185d', soft: 'from-rose-50/60 to-white' },
};

/* Curated product images per anti-aging product slug (skincare-style square thumbnails) */
const ANTIAGING_FALLBACK_IMG = {
  'anti-aging-serum':       'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=400&q=80',
  'anti-aging-cream':       'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80',
  'under-eye-cream':        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=400&q=80',
  'sunscreen':              'https://images.unsplash.com/photo-1556228841-a3c527ebefe5?auto=format&fit=crop&w=400&q=80',
  'cleanser':               'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=400&q=80',
};

/** Single circular tile — image only, label below. Skeleton-aware + error fallback. */
function Circle({ to, image, label, accent, icon, testId }) {
  const [errored, setErrored] = React.useState(false);
  return (
    <Link
      to={to}
      data-testid={testId}
      {...prefetchHandlers(to)}
      className="group flex flex-col items-center text-center focus:outline-none"
    >
      <div
        className="relative w-[78px] h-[78px] sm:w-[110px] sm:h-[110px] lg:w-[140px] lg:h-[140px] rounded-full p-[3px] transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
        style={{ background: `linear-gradient(135deg, ${accent}33 0%, ${accent}10 60%, transparent 100%)` }}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-stone-100 ring-1 ring-stone-200 flex items-center justify-center">
          {image && !errored ? (
            <img
              src={image}
              alt={label}
              loading="lazy"
              decoding="async"
              onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
              onError={() => setErrored(true)}
              className="w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:scale-110"
            />
          ) : (
            <span className="text-3xl sm:text-4xl select-none" style={{ color: accent }}>
              {icon || '✨'}
            </span>
          )}
        </div>
      </div>
      <span className="mt-2 sm:mt-3 text-[11px] sm:text-[13px] lg:text-[14px] font-bold text-stone-800 leading-tight max-w-[88px] sm:max-w-[120px] lg:max-w-[150px] line-clamp-2">
        {label}
      </span>
    </Link>
  );
}

/** Section: Amazon-style — clean white card with rounded border, niche accent eyebrow */
function NicheSection({ slug, items, children }) {
  const meta = NICHES_META[slug];
  if (!items?.length && !children) return null;
  return (
    <section
      className="relative rounded-2xl sm:rounded-3xl bg-white ring-1 ring-stone-200 px-4 sm:px-7 lg:px-9 py-6 sm:py-8 mb-5 sm:mb-7"
      data-testid={`category-niche-${slug}`}
    >
      <div className="flex items-end justify-between mb-5 sm:mb-7">
        <div>
          <p className="text-[10px] sm:text-[11px] font-black tracking-[0.28em] uppercase mb-1" style={{ color: meta.accent }}>
            {meta.tagline}
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-stone-900 leading-tight tracking-tight">
            {meta.name}
          </h2>
        </div>
        <Link
          to={slug === 'anti-aging' ? '/' : `/${slug}`}
          className="text-[11px] sm:text-xs font-bold hover:underline whitespace-nowrap"
          style={{ color: meta.accent }}
          data-testid={`category-niche-${slug}-viewall`}
        >
          View all →
        </Link>
      </div>
      {children}
    </section>
  );
}

/**
 * /categories — full-width Amazon-style hub.
 *  - Three sections (Anti-Aging products → Skincare CONCERNS → Cosmetics categories).
 *  - Skincare is niche-based: shows skin-problem concerns (anti-aging, acne, pigmentation…)
 *    that redirect to /concern/:slug.
 *  - Each section: clean white card + 4 cols (mobile) / 6 cols (sm) / 8 cols (lg) circle grid.
 *  - Single search input filters all 3 sections live.
 */
export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      cachedGet(`${API}/api/categories`),
      cachedGet(`${API}/api/concerns`),
      cachedGet(`${API}/api/products`),
    ])
      .then(([c, cn, p]) => {
        if (cancelled) return;
        setCategories(c.data || []);
        setConcerns(cn.data || []);
        setProducts(p.data || []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cosmeticsCats = useMemo(
    () => categories.filter(c => c.group === 'cosmetics').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [categories]
  );
  const antiAgingProducts = useMemo(
    () => products.filter(p => p.niche === 'anti-aging'),
    [products]
  );

  const filterFn = (item) => !query.trim() || (item.name || item.short_name || '').toLowerCase().includes(query.toLowerCase());

  return (
    <div className="bg-stone-50/60 pb-6" data-testid="categories-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
      {/* Header + search */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-4">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-stone-900 tracking-tight" data-testid="categories-title">
            Categories
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            All products across all niches in one place.
          </p>
          <div className="mt-3 relative max-w-2xl">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories or products…"
              data-testid="categories-search"
              style={{ fontSize: '16px' }}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-stone-100 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-stone-400 text-sm placeholder:text-stone-400 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-7">
        {loading ? (
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-6 animate-pulse">
            <div className="h-6 w-1/3 bg-stone-100 rounded mb-4" />
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-full bg-stone-100" />)}
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const filteredAA = antiAgingProducts.filter(filterFn);
              const filteredConcerns = concerns.filter(filterFn);
              const filteredCosmetics = cosmeticsCats.filter(filterFn);
              const allEmpty = !filteredAA.length && !filteredConcerns.length && !filteredCosmetics.length;
              return (
                <>
                  {/* ANTI-AGING — products */}
                  {filteredAA.length > 0 && (
                    <NicheSection slug="anti-aging" items={filteredAA}>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                        {filteredAA.map(p => (
                          <Circle
                            key={p.slug}
                            to={`/product/${p.slug}`}
                            image={p.images?.[0] || ANTIAGING_FALLBACK_IMG[p.slug]}
                            label={p.short_name || p.name}
                            accent={NICHES_META['anti-aging'].accent}
                            icon="🧴"
                            testId={`cat-circle-${p.slug}`}
                          />
                        ))}
                      </div>
                    </NicheSection>
                  )}

                  {/* SKINCARE — niche-based: skin problems / concerns → /concern/:slug */}
                  {filteredConcerns.length > 0 && (
                    <NicheSection slug="skincare" items={filteredConcerns}>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                        {filteredConcerns.map(c => (
                          <Circle
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
                    </NicheSection>
                  )}

                  {/* COSMETICS — categories */}
                  {filteredCosmetics.length > 0 && (
                    <NicheSection slug="cosmetics" items={filteredCosmetics}>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8">
                        {filteredCosmetics.map(c => (
                          <Circle
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
                    </NicheSection>
                  )}

                  {allEmpty && query.trim() && (
                    <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-8 text-center">
                      <p className="text-sm text-stone-500">
                        No matches for <span className="font-bold text-stone-700">"{query}"</span>. Try a different search.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
