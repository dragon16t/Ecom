import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Sparkles } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/* simple in-memory cache, keyed by `niche` (or 'all'). Refreshed every 5 min. */
const CACHE = { data: {}, t: 0 };

/**
 * Premium search bar with **niche-scoped autocomplete**.
 *
 * @param accent  hex theme color
 * @param niche   one of 'anti-aging' | 'skincare' | 'cosmetics' | undefined → all niches
 * @param testId  test ID prefix
 *
 * Behaviour:
 *  - As user types, suggestions matching `name` / `short_name` / `key_ingredients`
 *    within the niche scope are surfaced inline.
 *  - Tap a suggestion → navigate directly to its product page.
 *  - Pressing Enter with no selection → /shop?q=<query>&niche=<niche>
 */
export default function SearchBar({ accent = '#16a34a', niche, testId = 'home-search-bar' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [allProducts, setAllProducts] = useState([]);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  /* Fetch products in scope (cached) */
  useEffect(() => {
    const key = niche || 'all';
    const fresh = Date.now() - CACHE.t < 5 * 60 * 1000;
    if (fresh && CACHE.data[key]) {
      setAllProducts(CACHE.data[key]);
      return;
    }
    const url = niche ? `${API}/api/products?niche=${niche}` : `${API}/api/products`;
    axios.get(url)
      .then(r => {
        CACHE.data[key] = r.data || [];
        CACHE.t = Date.now();
        setAllProducts(r.data || []);
      })
      .catch(() => setAllProducts([]));
  }, [niche]);

  /* Click-outside close */
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || s.length < 1) return [];
    return allProducts
      .filter(p => {
        const hay = `${p.name || ''} ${p.short_name || ''} ${p.tagline || ''} ${p.key_ingredients || ''} ${p.category || ''}`.toLowerCase();
        return hay.includes(s);
      })
      .slice(0, 6);
  }, [q, allProducts]);

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = q.trim();
    if (highlight >= 0 && suggestions[highlight]) {
      navigate(`/product/${suggestions[highlight].slug}`);
      setOpen(false);
      return;
    }
    if (!trimmed) return;
    const params = new URLSearchParams({ q: trimmed });
    if (niche) params.set('niche', niche);
    navigate(`/shop?${params.toString()}`);
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const placeholder = niche === 'anti-aging'
    ? 'Search anti-aging products, ingredients…'
    : niche === 'skincare'
      ? 'Search skincare products, concerns…'
      : niche === 'cosmetics'
        ? 'Search makeup, lipsticks, eyeshadows…'
        : 'Search for products, concerns…';

  return (
    <section className="bg-white" data-testid={testId}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div ref={wrapperRef} className="relative">
          <form onSubmit={submit} className="relative group">
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-md"
              style={{ background: `linear-gradient(135deg, ${accent}40 0%, transparent 70%)` }}
            />
            <div className="relative flex items-center bg-white border border-stone-200 group-focus-within:border-stone-300 rounded-2xl shadow-sm transition-all">
              <Search size={18} className="ml-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); setHighlight(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKey}
                placeholder={placeholder}
                style={{ fontSize: '16px' }}
                className="flex-1 px-3 py-3 sm:py-3.5 bg-transparent text-sm sm:text-[15px] focus:outline-none placeholder-gray-400"
                data-testid="search-input"
                autoComplete="off"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="mr-1 w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-gray-400"
                  data-testid="search-clear-btn"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete dropdown */}
          {open && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 bg-white rounded-2xl ring-1 ring-stone-200 shadow-2xl shadow-stone-900/10 overflow-hidden z-30"
              data-testid="search-suggestions"
            >
              <ul className="max-h-[320px] overflow-y-auto">
                {suggestions.map((p, i) => (
                  <li key={p.slug}>
                    <Link
                      to={`/product/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        i === highlight ? 'bg-stone-100' : 'hover:bg-stone-50'
                      }`}
                      data-testid={`search-suggestion-${p.slug}`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-stone-50 to-stone-100 ring-1 ring-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Sparkles size={16} className="text-stone-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900 truncate">{p.short_name || p.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {p.key_ingredients || p.tagline || p.category}
                        </p>
                      </div>
                      <span
                        className="text-xs font-black flex-shrink-0"
                        style={{ color: accent }}
                      >
                        ₹{p.prepaid_price}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-stone-100 px-3 py-2 bg-stone-50/60">
                <button
                  type="button"
                  onClick={submit}
                  className="text-xs font-bold w-full text-left hover:underline"
                  style={{ color: accent }}
                  data-testid="search-see-all-btn"
                >
                  See all results for "{q}" →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
