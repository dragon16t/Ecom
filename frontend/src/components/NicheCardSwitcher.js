import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/* Pre-designed niche-card artwork (image already contains its own title/icon/arrow). */
const CARD_IMAGES = {
  'anti-aging': 'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/egnbiizj_E86525F8-AFBE-4431-B212-D00E13DAFA1C.jpeg',
  'skincare':   'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/tpi0b3jj_171A56DB-E605-493B-94CA-E8823DD9BF61.jpeg',
  'cosmetics':  'https://customer-assets.emergentagent.com/job_cg3-render/artifacts/0qo8dahm_ED352F30-0FBF-4C89-8FBE-F10AE07275B7.jpeg',
};

const ACTIVE_RING = {
  'anti-aging': '#0f766e',
  'skincare':   '#1e88e5',
  'cosmetics':  '#fb7185',
};

/* Static default niches – identical to what the API returns, so the cards render
 * INSTANTLY on first paint and never flicker when switching pages. */
const DEFAULT_NICHES = [
  { slug: 'anti-aging', name: 'Anti-Aging',         route: '/',           sort_order: 1 },
  { slug: 'skincare',   name: 'Skincare',           route: '/skincare',   sort_order: 2 },
  { slug: 'cosmetics',  name: 'Cosmetics & Makeup', route: '/cosmetics',  sort_order: 3 },
];

/* Module-level cache so we only hit /api/niches ONCE per full page load.
 * Persists across unmount/remount while navigating between routes. */
let NICHES_CACHE = null;
let NICHES_INFLIGHT = null;

async function fetchNichesOnce() {
  if (NICHES_CACHE) return NICHES_CACHE;
  if (NICHES_INFLIGHT) return NICHES_INFLIGHT;
  NICHES_INFLIGHT = axios
    .get(`${API}/api/niches`)
    .then((r) => {
      NICHES_CACHE = (r.data && r.data.length) ? r.data : DEFAULT_NICHES;
      return NICHES_CACHE;
    })
    .catch(() => {
      NICHES_CACHE = DEFAULT_NICHES;
      return NICHES_CACHE;
    })
    .finally(() => { NICHES_INFLIGHT = null; });
  return NICHES_INFLIGHT;
}

/**
 * NicheCardSwitcher — three image-only cards. No code-rendered text or icons.
 * Uses static defaults for instant render + module cache for zero re-fetch.
 */
export default function NicheCardSwitcher() {
  const [niches, setNiches] = useState(() => NICHES_CACHE || DEFAULT_NICHES);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    fetchNichesOnce().then((data) => {
      if (mounted && data && data.length) setNiches(data);
    });
    return () => { mounted = false; };
  }, []);

  if (!niches.length) return null;

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/' || location.pathname === '/anti-aging';
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  };

  return (
    <section className="bg-white py-2 sm:py-4" data-testid="niche-card-switcher">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {niches.map((n) => {
            const image = CARD_IMAGES[n.slug];
            const ring = ACTIVE_RING[n.slug] || '#22c55e';
            const active = isActive(n.route);
            return (
              <Link
                key={n.slug}
                to={n.route}
                data-testid={`niche-card-${n.slug}`}
                aria-label={n.name}
                className={`group relative block aspect-[7/6] sm:aspect-[5/3] lg:aspect-[2/1] rounded-2xl overflow-hidden bg-stone-100 transition-all duration-300 ${
                  active
                    ? 'ring-2 sm:ring-[3px] shadow-lg shadow-black/10 scale-[1.01]'
                    : 'ring-1 ring-stone-200 hover:ring-stone-300 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                style={active ? { '--tw-ring-color': ring } : undefined}
              >
                {image && (
                  <img
                    src={image}
                    alt={n.name}
                    loading="eager"
                    fetchpriority="high"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
