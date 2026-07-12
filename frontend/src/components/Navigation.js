import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Search, ShoppingCart, Stethoscope, Package, Pill } from 'lucide-react';
import LocationStrip from './LocationStrip';
import axios from 'axios';
import { prefetchHandlers } from '../utils/routePrefetch';
import { isProductTbl, isComboTbl, pruneTblItemsFromCart } from '../pages/Homepage';

const API = process.env.REACT_APP_BACKEND_URL;

const getCartCount = () => {
  try {
    const raw = localStorage.getItem('cart') || sessionStorage.getItem('cart') || '{"items":[]}';
    const cart = JSON.parse(raw);
    // Exclude TBL items from the badge count — they cannot be ordered anyway
    return cart.items
      .filter(i => {
        if (i.product_slug) return !isProductTbl(i.product_slug);
        if (i.combo_id) return !isComboTbl(i.combo_id);
        return true;
      })
      .reduce((sum, i) => sum + (i.quantity || 1), 0);
  } catch { return 0; }
};

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartBounce, setCartBounce] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const suggestTimer = useRef(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (q.length < 2) { setSuggestions([]); return; }
    // Debounce 180ms so we don't fire on every keystroke
    setSuggesting(true);
    suggestTimer.current = setTimeout(() => {
      axios.get(`${API}/api/search/suggest?q=${encodeURIComponent(q)}&limit=8`)
        .then(r => setSuggestions(r.data?.items || []))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggesting(false));
    }, 180);
    return () => suggestTimer.current && clearTimeout(suggestTimer.current);
  }, [searchQuery]);

  useEffect(() => {
    const update = () => setCartCount(getCartCount());
    update();
    // Prune TBL items first, then read the count
    pruneTblItemsFromCart();
    const onBounce = () => {
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 600);
    };
    window.addEventListener('cartUpdated', update);
    window.addEventListener('cart-bounce', onBounce);
    window.addEventListener('admin-data-changed', () => { pruneTblItemsFromCart(); update(); });
    return () => {
      window.removeEventListener('cartUpdated', update);
      window.removeEventListener('cart-bounce', onBounce);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/categories', label: 'Categories' },
    { path: '/routine', label: 'Skin Analysis', icon: Stethoscope, highlight: true },
    { path: '/doctor-consultation', label: 'Doctor Consult', icon: Pill, doctor: true },
    { path: '/track-order', label: 'Track Order', icon: Package },
    { path: '/blog', label: 'Beauty Tips' },
    { path: '/about', label: 'About Us' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        {/* Mobile + Tablet header (hidden on lg) */}
        <div className="flex items-center justify-between px-4 h-14 lg:hidden">
          <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 w-10" data-testid="menu-button" aria-label="Open menu">
            <Menu size={24} className="text-gray-900" />
          </button>

          <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 text-center" data-testid="logo-link">
            <span className="block text-[20px] tracking-[0.32em] text-slate-900 leading-none" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}>CELESTA</span>
            <span className="block text-[10px] tracking-[0.55em] text-slate-500 mt-1" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 400 }}>G L O W</span>
          </Link>

          <div className="flex items-center gap-0">
            <button onClick={() => setIsSearchOpen(true)} className="p-2" data-testid="search-button" aria-label="Search">
              <Search size={22} className="text-gray-900" />
            </button>
            <Link to="/cart" className="p-2 relative" data-testid="cart-button" aria-label="Cart" {...prefetchHandlers('/cart')}>
              <ShoppingCart size={22} className={`text-gray-900 transition-transform ${cartBounce ? 'animate-cart-bounce' : ''}`} />
              {cartCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${cartBounce ? 'animate-cart-pop' : ''}`}>{cartCount}</span>
              )}
            </Link>
          </div>
        </div>

        {/* Desktop header (lg+) */}
        <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-6 xl:px-8 h-16">
          <Link to="/" className="flex flex-col items-center flex-shrink-0 leading-none" data-testid="logo-link-desktop">
            <span className="text-[26px] tracking-[0.32em] text-slate-900 leading-none" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}>CELESTA</span>
            <span className="text-[11px] tracking-[0.55em] text-slate-500 leading-none mt-1" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 400 }}>G L O W</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                {...prefetchHandlers(link.path)}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  link.doctor ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : link.highlight ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    : location.pathname === link.path ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                data-testid={`nav-desktop-${link.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                {link.icon && <link.icon size={15} />}
                {link.label}
                {link.highlight && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">FREE</span>}
                {link.doctor && <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full">₹999</span>}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSearchOpen(true)} className="p-2.5 rounded-full hover:bg-gray-50" data-testid="search-button-desktop" aria-label="Search">
              <Search size={20} className="text-gray-900" />
            </button>
            <Link to="/cart" className="p-2.5 relative rounded-full hover:bg-gray-50" data-testid="cart-button-desktop" aria-label="Cart" {...prefetchHandlers('/cart')}>
              <ShoppingCart size={20} className={`text-gray-900 transition-transform ${cartBounce ? 'animate-cart-bounce' : ''}`} />
              {cartCount > 0 && (
                <span className={`absolute top-0 right-0 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${cartBounce ? 'animate-cart-pop' : ''}`}>{cartCount}</span>
              )}
            </Link>
          </div>
        </div>
        {/* Location strip — sits directly under the header, matches reference. */}
        <LocationStrip />
      </header>
      {/* Spacer for fixed header (+ location strip ≈ 44px) */}
      <div className="h-[102px] lg:h-[108px]" />

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <span className="block text-[18px] tracking-[0.32em] text-slate-900 leading-none" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 500 }}>CELESTA</span>
                <span className="block text-[9px] tracking-[0.55em] text-slate-500 mt-1" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 400 }}>G L O W</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 -mr-2" data-testid="close-menu-button">
                <X size={24} className="text-gray-900" />
              </button>
            </div>
            <nav className="p-5">
              <ul className="space-y-1">
                {navLinks.map(link => (
                  <li key={link.path}>
                    <Link to={link.path} onClick={() => setIsMenuOpen(false)}
                      {...prefetchHandlers(link.path)}
                      className={`block py-3.5 px-4 rounded-xl text-base font-medium transition-all flex items-center gap-2 ${
                        link.doctor ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : link.highlight ? 'bg-purple-50 text-purple-600 border border-purple-200'
                          : location.pathname === link.path ? 'bg-green-50 text-green-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`} data-testid={`nav-link-${link.label.toLowerCase().replace(/\s/g, '-')}`}>
                      {link.icon && <link.icon size={18} />}
                      {link.label}
                      {link.highlight && <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">FREE</span>}
                      {link.doctor && <span className="ml-auto text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full">₹999</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <button onClick={() => setIsSearchOpen(false)} className="p-2 -ml-2" data-testid="close-search-button">
              <X size={24} className="text-gray-900" />
            </button>
            <form onSubmit={handleSearch} className="flex-1">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, tips..." className="w-full h-12 px-4 bg-gray-50 rounded-full text-base outline-none focus:ring-2 focus:ring-green-200" autoFocus data-testid="search-input" />
            </form>
          </div>
          <div className="p-5 max-h-[calc(100vh-72px)] overflow-y-auto">
            {/* Live suggestions */}
            {searchQuery.trim().length >= 2 && (
              <div className="mb-5" data-testid="search-suggestions">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {suggesting ? 'Searching…' : (suggestions.length ? 'Top matches' : 'No matches')}
                </p>
                <div className="space-y-1">
                  {suggestions.map(s => {
                    const img = (s.images && s.images[0]) || null;
                    return (
                      <button
                        key={s.slug}
                        onClick={() => { navigate(`/product/${s.slug}`); setIsSearchOpen(false); setSearchQuery(''); }}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition text-left"
                        data-testid={`search-suggest-${s.slug}`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {img ? <img src={img} alt={s.name} loading="lazy" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 truncate">{s.brand} · {s.niche}</p>
                        </div>
                        {s.prepaid_price ? (
                          <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">₹{s.prepaid_price}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  {suggestions.length > 0 && (
                    <button
                      onClick={(e) => handleSearch(e)}
                      className="w-full mt-1 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg text-center"
                    >
                      See all results for &quot;{searchQuery.trim()}&quot; →
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Popular Searches</p>
            <div className="flex flex-wrap gap-2">
              {['anti-aging serum', 'sunscreen', 'night cream', 'under eye cream', 'cleanser', 'complete kit'].map(term => (
                <button key={term} onClick={() => { navigate(`/search?q=${term}`); setIsSearchOpen(false); }}
                  className="px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors" data-testid={`search-suggestion-${term.replace(/\s/g, '-')}`}>
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navigation;
