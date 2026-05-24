import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

/**
 * IngredientSpotlight — 3-card row showcasing hero actives (Retinol, Vit C,
 * Niacinamide). Tapping each card deep-links to /shop?niche=skincare&ingredient=...
 * so the merchandiser can curate ingredient-specific landing pages later.
 *
 * Self-contained with no API calls — content is admin-friendly (just edit the
 * INGREDIENTS array below). Renders only when the parent passes `enabled`.
 */
const INGREDIENTS = [
  {
    id: 'retinol',
    name: 'Retinol',
    tagline: 'Smooths fine lines',
    description: 'Clinical-grade vitamin A that boosts cell turnover.',
    gradient: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
    accent: '#9f1239',
  },
  {
    id: 'vitamin-c',
    name: 'Vitamin C',
    tagline: 'Brightens & evens tone',
    description: '20% L-Ascorbic Acid for radiance and dark spot reduction.',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    accent: '#a16207',
  },
  {
    id: 'niacinamide',
    name: 'Niacinamide',
    tagline: 'Controls oil & pores',
    description: '10% concentration to minimize pores and balance sebum.',
    gradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    accent: '#047857',
  },
];

export default function IngredientSpotlight({ accent = '#0e7490' }) {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12" data-testid="ingredient-spotlight">
      <div className="flex items-end justify-between mb-4 sm:mb-6 px-1">
        <div>
          <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.4em] uppercase mb-1 flex items-center gap-2" style={{ color: accent }}>
            <Leaf size={11} /> Hero Actives
          </p>
          <h2 className="font-heading text-lg sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
            Ingredient <span className="italic" style={{ color: accent }}>spotlight</span>
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        {INGREDIENTS.map((ing) => (
          <Link
            key={ing.id}
            to={`/shop?niche=skincare&ingredient=${ing.id}`}
            data-testid={`ingredient-${ing.id}`}
            className="relative overflow-hidden rounded-3xl p-5 sm:p-6 ring-1 ring-stone-200/70 hover:-translate-y-1 hover:shadow-2xl transition-all"
            style={{ background: ing.gradient }}
          >
            <p className="text-[10px] font-black tracking-[0.3em] uppercase mb-2" style={{ color: ing.accent }}>{ing.tagline}</p>
            <h3 className="font-heading text-2xl sm:text-3xl font-black text-stone-900 mb-2">{ing.name}</h3>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed line-clamp-2">{ing.description}</p>
            <p className="mt-4 text-xs font-bold inline-flex items-center gap-1" style={{ color: ing.accent }}>
              Shop {ing.name} products →
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
