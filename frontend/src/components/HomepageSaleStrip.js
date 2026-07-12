import React from 'react';
import { useSaleMode, isSaleOn } from '../utils/saleMode';
import { Flame, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Site-wide sale ribbon shown at the very top of the homepage / niche pages
 * whenever the admin has flipped the anti-aging Flat 50% switch ON.
 * Compact strip on mobile, roomier on desktop. Links to /anti-aging.
 */
export default function HomepageSaleStrip() {
  const sale = useSaleMode();
  if (!isSaleOn(sale, 'anti-aging')) return null;
  return (
    <Link
      to="/anti-aging"
      className="block bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white overflow-hidden"
      data-testid="homepage-sale-strip"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 flex-wrap text-center">
        <Flame size={16} className="text-yellow-200 shrink-0" />
        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">
          {sale.badge_label || 'FLAT 50% OFF'}
        </span>
        <span className="hidden sm:inline text-red-100">·</span>
        <span className="text-[11px] sm:text-sm text-red-100">
          {sale.banner_text || 'Anti-aging range — free shipping, ends soon'}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold ml-1">
          <Clock size={12} /> Ends soon
          <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}
