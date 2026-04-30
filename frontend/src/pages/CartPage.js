import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, Trash2, Minus, Plus, ChevronRight, Shield, Truck, Tag, ArrowLeft, Sparkles, Zap, Award, Check, Clock, Star, Lock, Package, BadgeCheck } from 'lucide-react';
import { getCart, saveCart } from './Homepage';
import { useTracking } from '../providers/TrackingProvider';
import ReviewsCarousel from '../components/ReviewsCarousel';
import { cachedGet, peek } from '../utils/apiCache';

const API = process.env.REACT_APP_BACKEND_URL;

function CartPage() {
  const navigate = useNavigate();
  const { trackAction } = useTracking();
  const [cartData, setCartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [upsellProducts, setUpsellProducts] = useState([]);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [publicCoupons, setPublicCoupons] = useState([]);

  const appliedCouponRef = React.useRef(appliedCoupon);
  appliedCouponRef.current = appliedCoupon;
  const initialLoadRef = React.useRef(true);

  const validateCart = useCallback(async (couponOverride) => {
    if (initialLoadRef.current) setLoading(true);
    const cart = getCart();
    if (!cart.items.length) { setCartData(null); setLoading(false); initialLoadRef.current = false; return; }
    const couponCodeToUse = couponOverride !== undefined ? couponOverride : (appliedCouponRef.current?.code || null);
    try {
      const res = await axios.post(`${API}/api/cart/validate`, { items: cart.items, coupon_code: couponCodeToUse, payment_method: 'prepaid' });
      setCartData(res.data);
      if (initialLoadRef.current) {
        // Use cache first — these endpoints rarely change so we keep them for 5 mins
        const [allProds, comboRes] = await Promise.all([
          cachedGet(`${API}/api/products`).then(r => ({ data: r.data })),
          cachedGet(`${API}/api/combos`, { ttl: 60_000 }).then(r => ({ data: r.data })),
        ]);
        const cartSlugs = new Set(cart.items.map(i => i.product_slug).filter(Boolean));
        const cartCombos = cart.items.map(i => i.combo_id).filter(Boolean);

        // Determine attributes of products currently in the cart
        const cartProducts = [...cartSlugs]
          .map(slug => allProds.data.find(p => p.slug === slug))
          .filter(Boolean);
        const cartNiches = new Set(cartProducts.map(p => p.niche).filter(Boolean));
        const cartConcerns = new Set(cartProducts.flatMap(p => p.concerns || []).filter(Boolean));
        const cartCategories = new Set(cartProducts.map(p => p.category).filter(Boolean));

        // Add recently viewed product slugs (from sessionStorage, set by ProductDetailPage)
        let recentlyViewed = [];
        try { recentlyViewed = JSON.parse(sessionStorage.getItem('recentlyViewed') || '[]'); } catch (e) {}
        const recentSet = new Set(recentlyViewed);

        // Dedicated "Recently viewed" list (preserves view order, excludes items in cart and any TBL items)
        const recentlyViewedList = recentlyViewed
          .filter(slug => !cartSlugs.has(slug))
          .map(slug => allProds.data.find(p => p.slug === slug))
          .filter(Boolean)
          .filter(p => !p.is_to_be_launched)
          .slice(0, 6);
        setRecentlyViewedProducts(recentlyViewedList);

        // Score each non-cart, non-TBL product on relevance
        const scored = allProds.data
          .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched)
          .map(p => {
            let score = 0;
            if (cartCategories.has(p.category)) score += 4;          // same product type
            if ((p.concerns || []).some(c => cartConcerns.has(c))) score += 3;  // shared concern
            if (cartNiches.has(p.niche)) score += 2;                 // same niche
            if (recentSet.has(p.slug)) score += 5;                   // strong nudge for recently viewed
            return { p, score };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score || (b.p.reviews_count || 0) - (a.p.reviews_count || 0))
          .map(x => x.p);

        // Fallback: if no relevance match, fall back to same-niche bestsellers (still no TBL)
        let upsell = scored;
        if (!upsell.length && cartNiches.size) {
          upsell = allProds.data
            .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched && cartNiches.has(p.niche))
            .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
        }
        // Final fallback: most-reviewed overall (still no TBL)
        if (!upsell.length) {
          upsell = [...allProds.data]
            .filter(p => !cartSlugs.has(p.slug) && !p.is_to_be_launched)
            .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
        }

        setUpsellProducts(upsell.slice(0, 8));
        setCombos(comboRes.data.filter(c => !cartCombos.includes(c.combo_id)));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
    initialLoadRef.current = false;
  }, []);

  useEffect(() => { validateCart(); }, []);

  useEffect(() => {
    // Meta Pixel — Cart PageView
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView', { page_name: 'cart', content_category: 'Cart' });
    }
  }, []);
  useEffect(() => {
    // Use a short TTL (60s) for public coupons so admin disable/delete reflects quickly
    cachedGet(`${API}/api/coupons/public`, { ttl: 60_000 })
      .then(r => setPublicCoupons(r.data || []))
      .catch(() => setPublicCoupons([]));
  }, []);

  // Auto-apply ONLY the coupon claimed via the discount popup (localStorage `discountClaimed`).
  // If the user did NOT claim a coupon via popup, do not auto-apply — they can still tap "Apply"
  // on any of the public coupons listed on the cart page.
  useEffect(() => {
    if (appliedCoupon || !cartData?.subtotal) return;
    let claimed = false;
    let claimedCode = '';
    try {
      claimed = localStorage.getItem('discountClaimed') === 'true';
      claimedCode = (localStorage.getItem('discountCode') || '').toUpperCase();
    } catch { /* ignore */ }
    if (!claimed || !claimedCode) return;
    // Best-effort apply via the same validate endpoint so totals + discount line update correctly.
    applyCouponCode(claimedCode).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartData?.subtotal]);

  // Listen for the popup-claim event so a coupon claimed AFTER the cart loaded
  // is applied immediately without requiring a refresh.
  useEffect(() => {
    const onClaimed = (e) => {
      if (appliedCoupon) return;
      const code = (e?.detail?.code || localStorage.getItem('discountCode') || '').toUpperCase();
      if (!code) return;
      applyCouponCode(code).catch(() => {});
    };
    const onStorage = (e) => {
      if (e.key !== 'discountCode' && e.key !== 'discountClaimed') return;
      onClaimed();
    };
    window.addEventListener('discountClaimed', onClaimed);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('discountClaimed', onClaimed);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, cartData?.subtotal]);

  const updateQuantity = (index, delta) => { const cart = getCart(); cart.items[index].quantity = Math.max(1, (cart.items[index].quantity || 1) + delta); saveCart(cart); validateCart(); };
  const removeItem = (index) => { const cart = getCart(); cart.items.splice(index, 1); saveCart(cart); validateCart(); };
  const addUpsellToCart = (slug) => { const cart = getCart(); const e = cart.items.find(i => i.product_slug === slug); if (e) e.quantity += 1; else cart.items.push({ product_slug: slug, quantity: 1 }); saveCart(cart); validateCart(); };

  const applyCouponCode = async (code) => {
    setCouponError('');
    if (!code?.trim()) return;
    try {
      const r = await axios.post(`${API}/api/validate-coupon?code=${code.trim()}&cart_total=${cartData?.subtotal || 0}`);
      const newCoupon = { code: code.trim().toUpperCase(), ...r.data };
      setAppliedCoupon(newCoupon);
      // Re-validate cart with the new coupon so totals/discount lines update
      await validateCart(newCoupon.code);
    } catch (e) {
      setCouponError(e.response?.data?.detail || 'Invalid coupon');
      setAppliedCoupon(null);
    }
  };

  const applyCoupon = () => applyCouponCode(couponCode);

  const removeCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    await validateCart(null);
  };

  const proceedToCheckout = () => {
    if (!cartData?.items?.length) return;
    trackAction('initiate_checkout', { items: cartData.items.length, total: cartData.total });
    if (window.fbq) window.fbq('track', 'InitiateCheckout', { value: cartData.total, currency: 'INR', num_items: cartData.item_count });
    navigate('/checkout', { state: { cartData, paymentMethod: 'prepaid', coupon: appliedCoupon } });
  };

  if (loading) {
    // Render a lightweight skeleton instead of a full-page spinner so the page feels instant
    const cartItems = getCart().items || [];
    if (cartItems.length === 0) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-stone-50" data-testid="cart-page-loading">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => window.history.back()} className="p-2 hover:bg-white rounded-xl"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="text-xs text-gray-400">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-3.5 animate-pulse">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-100 rounded-xl flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-stone-100 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-stone-100 rounded w-1/3 mb-3" />
                    <div className="h-7 bg-stone-100 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="h-5 bg-stone-100 rounded w-1/2 mb-4" />
                <div className="h-4 bg-stone-100 rounded w-full mb-2" />
                <div className="h-4 bg-stone-100 rounded w-full mb-2" />
                <div className="h-10 bg-stone-100 rounded w-full mt-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cartData || !cartData.items?.length) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" data-testid="empty-cart">
        <div className="text-center"><ShoppingCart className="w-14 h-14 mx-auto mb-4 text-gray-200" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Explore our anti-aging range to get started.</p>
        <Link to="/shop" className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-green-700 inline-flex items-center gap-2">Shop Now <ChevronRight size={16} /></Link></div>
      </div>
    );
  }

  const kit = combos.find(c => c.combo_id === 'complete-anti-aging-kit');

  return (
    <div className="min-h-screen bg-stone-50" data-testid="cart-page">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = '/shop'; }} className="p-2 hover:bg-white rounded-xl transition-colors" data-testid="cart-back"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-xs text-gray-400">{cartData.item_count} {cartData.item_count === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {/* Items */}
            {cartData.items.map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-3.5" data-testid={`cart-item-${index}`}>
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-stone-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? <img src={item.image} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" /> : <Package size={20} className="text-green-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.type === 'combo' ? item.name : item.short_name || item.name}</h3>
                  {item.type === 'combo' && <p className="text-xs text-green-600 font-medium">{item.product_slugs?.length} products included</p>}
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-bold text-gray-900">₹{item.price}</span>
                    {(item.mrp || item.mrp_total) > item.price && <span className="text-xs text-gray-400 line-through">₹{item.mrp || item.mrp_total}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white shadow-sm">
                      <button onClick={() => updateQuantity(index, -1)} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900"><Minus size={14} /></button>
                      <span className="w-7 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeItem(index)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    <span className="ml-auto font-bold text-gray-900">₹{item.line_total}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Bundle Push */}
            {kit && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/60">
                <div className="flex items-center gap-2 mb-2"><Award size={15} className="text-amber-600" /><span className="text-xs font-bold text-amber-800 tracking-wide">UPGRADE & SAVE {kit.discount_percent}%</span></div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-gray-900">{kit.name}</p>
                    <p className="text-xs mt-0.5"><span className="font-bold text-green-700">₹{kit.combo_prepaid_price?.toLocaleString()}</span> <span className="text-gray-400 line-through text-xs">₹{kit.mrp_total?.toLocaleString()}</span></p>
                  </div>
                  <button onClick={() => { const c = getCart(); c.items = [{ combo_id: kit.combo_id, quantity: 1 }]; saveCart(c); validateCart(); }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm">Switch to Kit</button>
                </div>
              </div>
            )}

            {/* Recently viewed — tracked from ProductDetailPage views */}
            {recentlyViewedProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-recently-viewed">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-green-700" />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.15em]">Recently viewed · Pick up where you left off</p>
                </div>
                <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                  {recentlyViewedProducts.map(p => (
                    <div key={p.slug} className="flex-shrink-0 w-28 text-center" data-testid={`cart-recent-${p.slug}`}>
                      <Link to={`/product/${p.slug}`}>
                        <div className="w-20 h-20 mx-auto bg-white rounded-xl flex items-center justify-center mb-1.5 overflow-hidden ring-1 ring-stone-200 hover:ring-green-300 hover:shadow-md transition-all">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              className={p.fill_card ? 'w-full h-full object-cover' : 'w-16 h-16 object-contain'}
                            />
                          ) : (
                            <Sparkles size={20} className="text-green-300" />
                          )}
                        </div>
                      </Link>
                      <Link to={`/product/${p.slug}`}><p className="text-xs font-semibold text-gray-800 line-clamp-1 hover:text-green-700">{p.short_name}</p></Link>
                      <p className="text-xs text-gray-500">₹{p.prepaid_price}</p>
                      <button onClick={() => addUpsellToCart(p.slug)} className="mt-1.5 w-full bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-700" data-testid={`cart-recent-add-${p.slug}`}>+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* You may also like — niche/concern/category-aware suggestions */}
            {upsellProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-similar-products">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">You may also like</p>
                <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                  {upsellProducts.slice(0, 6).map(p => (
                    <div key={p.slug} className="flex-shrink-0 w-28 text-center" data-testid={`cart-upsell-${p.slug}`}>
                      <Link to={`/product/${p.slug}`}>
                        <div className="w-20 h-20 mx-auto bg-stone-50 rounded-xl flex items-center justify-center mb-1.5 overflow-hidden hover:shadow-md transition-shadow">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.querySelector('.upsell-fallback').style.display = 'flex'; }}
                              className="w-16 h-16 object-contain"
                            />
                          ) : null}
                          <div className="upsell-fallback w-16 h-16 items-center justify-center text-green-300" style={{ display: p.images?.[0] ? 'none' : 'flex' }}>
                            <Sparkles size={20} />
                          </div>
                        </div>
                      </Link>
                      <Link to={`/product/${p.slug}`}><p className="text-xs font-semibold text-gray-800 line-clamp-1 hover:text-green-700">{p.short_name}</p></Link>
                      <p className="text-xs text-gray-500">₹{p.prepaid_price}</p>
                      <button onClick={() => addUpsellToCart(p.slug)} className="mt-1.5 w-full bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-700" data-testid={`cart-upsell-add-${p.slug}`}>+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust Bar */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-4 border border-green-100">
              <div className="grid grid-cols-3 gap-3">
                {[{ icon: Lock, t: '256-bit Secure', d: 'SSL Encrypted' }, { icon: Truck, t: 'Free Shipping', d: 'All India Delivery' }, { icon: Clock, t: '30-Day Return', d: 'Money Back Guarantee' }].map((b, i) => (
                  <div key={i} className="text-center">
                    <div className="w-9 h-9 mx-auto mb-1.5 bg-white rounded-xl flex items-center justify-center shadow-sm"><b.icon size={16} className="text-green-600" /></div>
                    <p className="text-xs font-bold text-gray-800">{b.t}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Review carousel — auto-scrolling reviews from /admin/reviews */}
            <div className="-mx-4 sm:-mx-0">
              <ReviewsCarousel
                title="Customers love us"
                eyebrow="Verified · From across India"
              />
            </div>
          </div>

          {/* Summary Column */}
          <div className="space-y-3">
            {cartData.savings > 0 && (
              <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-3.5 text-center text-white shadow-lg shadow-green-200/30">
                <p className="text-sm font-bold">You're saving ₹{cartData.savings?.toLocaleString()}</p>
                <p className="text-xs text-green-100">on this order</p>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="cart-coupon-block">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-2">Have a Coupon?</p>
              {appliedCoupon ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                  <div><p className="font-bold text-green-700 text-sm">{appliedCoupon.code}</p><p className="text-xs text-green-600">Saving ₹{appliedCoupon.discount}</p></div>
                  <button onClick={removeCoupon} className="text-gray-400 text-xs hover:text-red-500">Remove</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-green-200" />
                    <button onClick={applyCoupon} className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800">Apply</button>
                  </div>
                  {/* Available coupons (admin-published) — tap to apply */}
                  {publicCoupons.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200" data-testid="cart-public-coupons">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.12em] mb-2">Available offers</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {publicCoupons.slice(0, 6).map(c => (
                          <div key={c.code} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-2.5 flex items-center gap-2" data-testid={`cart-coupon-${c.code}`}>
                            <Tag size={14} className="text-orange-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold font-mono text-gray-900 truncate">{c.code}</p>
                              {c.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
                            </div>
                            <button onClick={() => applyCouponCode(c.code)} className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0" data-testid={`apply-coupon-${c.code}`}>Apply</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid="order-summary">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Order Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400"><span>MRP</span><span className="line-through">₹{cartData.mrp_total?.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-700"><span>Subtotal</span><span className="font-medium">₹{cartData.subtotal?.toLocaleString()}</span></div>
                {cartData.discount > 0 && <div className="flex justify-between text-green-600"><span>Coupon Discount</span><span>-₹{cartData.discount}</span></div>}
                {cartData.volume_discount > 0 && <div className="flex justify-between text-purple-600"><span>Buy More Discount ({cartData.volume_discount_percent}% off)</span><span>-₹{cartData.volume_discount}</span></div>}
                <div className="flex justify-between text-gray-700">
                  <span>Shipping</span>
                  {cartData.shipping_fee > 0
                    ? <span className="font-medium text-orange-600" data-testid="shipping-fee">₹{cartData.shipping_fee}</span>
                    : <span className="text-green-600 font-medium" data-testid="shipping-free">FREE</span>}
                </div>
                {cartData.shipping_fee > 0 && cartData.free_shipping_remaining > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-[11px] text-amber-800 leading-snug" data-testid="free-shipping-nudge">
                    <span className="font-semibold">Add ₹{Math.ceil(cartData.free_shipping_remaining)} more</span> to get <span className="font-semibold">free delivery</span> 🚚
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900 text-lg"><span>Total</span><span>₹{cartData.total?.toLocaleString()}</span></div>
              </div>
            </div>

            <button onClick={proceedToCheckout} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-base shadow-xl shadow-green-200/40 transition-all" data-testid="proceed-checkout-btn">
              Proceed to Checkout
            </button>

            {/* Social Proof Badges */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-xl p-3 text-center border border-amber-100/60">
                <p className="text-xl font-black text-amber-700">127</p>
                <p className="text-xs text-amber-600 font-semibold tracking-wide">ORDERS TODAY</p>
              </div>
              <div className="bg-gradient-to-b from-rose-50 to-pink-50 rounded-xl p-3 text-center border border-rose-100/60">
                <p className="text-xl font-black text-rose-700">4.8</p>
                <p className="text-xs text-rose-600 font-semibold tracking-wide">AVG RATING</p>
              </div>
              <div className="bg-gradient-to-b from-purple-50 to-violet-50 rounded-xl p-3 text-center border border-purple-100/60">
                <p className="text-xl font-black text-purple-700">50K+</p>
                <p className="text-xs text-purple-600 font-semibold tracking-wide">CUSTOMERS</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
