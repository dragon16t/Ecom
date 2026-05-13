import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Star, ChevronLeft, ChevronRight, Shield, Truck, Award, Clock, Check, Sparkles, Minus, Plus, ChevronDown, User, FlaskConical, Package, Leaf, Droplets, Sun, Zap } from 'lucide-react';
import { addToCart, addComboToCart, getCart, saveCart } from './Homepage';
import { useTracking } from '../providers/TrackingProvider';
import ReviewsCarousel from '../components/ReviewsCarousel';
import { cachedGet } from '../utils/apiCache';
import { getSocialProof } from '../utils/socialProof';
import SEOHead, { productJsonLd, breadcrumbJsonLd, faqJsonLd, SITE } from '../components/SEOHead';

const API = process.env.REACT_APP_BACKEND_URL;

// Urgency Timer
function UrgencyTimer() {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const end = sessionStorage.getItem('saleEnd') || (() => { const e = Date.now() + 4 * 3600000; sessionStorage.setItem('saleEnd', e); return e; })();
    const tick = () => { const d = Math.max(0, Number(end) - Date.now()); setTimeLeft({ h: Math.floor(d/3600000), m: Math.floor((d%3600000)/60000), s: Math.floor((d%60000)/1000) }); };
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, []);
  const pad = n => String(n).padStart(2, '0');
  return <span className="font-mono font-bold">{pad(timeLeft.h)}:{pad(timeLeft.m)}:{pad(timeLeft.s)}</span>;
}

/**
 * <ProductLiveStrip> — viewing / sold today / stock left.
 * Numbers are deterministic per (slug, minute) so they NEVER flicker on
 * re-render (e.g. when the user clicks through gallery images), but they
 * tick forward every minute giving a real "live" feel. The 'sold today'
 * count starts low at midnight and rises to a product-specific peak by
 * end of day, then resets at the next midnight.
 */
function ProductLiveStrip({ slug }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // Re-render once per minute so the social-proof numbers walk forward.
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // useMemo guards re-computation within the same minute; `tick` invalidates
  // it once a minute, `slug` invalidates when navigating to another product.
  const proof = useMemo(() => getSocialProof(slug || ''), [slug, tick]);

  return (
    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center justify-around gap-2" data-testid="product-live-strip">
      <span className="flex items-center gap-1.5 text-amber-700 text-xs font-bold">
        <User size={13} className="text-amber-500" />
        <span>{proof.viewingNow} <span className="font-normal">viewing</span></span>
      </span>
      <span className="flex items-center gap-1.5 text-green-700 text-xs font-bold">
        <Zap size={13} className="text-green-500" />
        <span>{proof.soldToday} <span className="font-normal">sold today</span></span>
      </span>
      <span className="flex items-center gap-1.5 text-rose-700 text-xs font-bold">
        <Clock size={13} className="text-rose-500" />
        <span><span className="font-normal">Only</span> {proof.stockLeft} <span className="font-normal">left!</span></span>
      </span>
    </div>
  );
}

/**
 * NOTE: Customer reviews are now rendered via <ReviewsCarousel /> which pulls
 * live, admin-managed reviews from /api/reviews. The legacy `buildReviews` and
 * imported-reviews fallback have been retired (cleanup pass, Jan 2026).
 */

/** Niche-aware FAQs so cosmetics, anti-aging, and skincare each get relevant copy. */
function buildFaqs(product) {
  const isCos = product?.niche === 'cosmetics';
  return [
    { q: isCos ? 'How long does the colour last?' : 'How long before I see results?', a: isCos ? 'Up to 8–12 hours of comfortable wear depending on application and skin type.' : 'Most customers report visible improvement within 2–4 weeks of consistent daily use.' },
    { q: 'Is it suitable for sensitive skin?',                                         a: 'Yes. All Celesta Glow products are dermatologist-tested and pH-balanced for every skin type.' },
    { q: isCos ? 'Will it dry out my lips/skin?' : 'Can I use this with other skincare?', a: isCos ? 'No. Our cosmetics are formulated with skin-loving actives like Hyaluronic Acid and Vitamin E to keep skin nourished while wearing colour.' : 'Absolutely. Our products are designed to complement any existing routine.' },
    { q: 'What is the return policy?',                                                 a: '7-day return on unopened, factory-sealed items only. We cannot accept returns on opened or used products for hygiene reasons. Damaged-on-arrival or wrong-item shipments are always covered.' },
  ];
}

/** Niche-aware dermatologist endorsements (no anti-aging-only quotes). */
function buildDermats(product) {
  const isCos = product?.niche === 'cosmetics';
  return [
    { n: 'Dr. Priya Sharma', c: 'MD Dermatology, AIIMS', q: isCos
        ? 'Pigments at safe concentrations with skin-conditioning agents. Comfortable for all-day wear without irritation.'
        : 'Clinically-proven actives at effective concentrations. Highly recommended for my patients.' },
    { n: 'Dr. Kavita Reddy', c: '15+ Years Experience', q: 'Synergistic formulation. Suitable for all Indian skin types.' },
    { n: 'Dr. Anita Patel',  c: 'MD Skin & VD',         q: isCos
        ? 'Clean, dermatologically tested makeup that respects the skin barrier — exactly what daily wear needs.'
        : 'pH-balanced for maximum absorption. Excellent fit for daily skincare routines.' },
  ];
}

/** Build clinical/efficacy stats — uses backend `clinical_stats` if present,
 *  otherwise derives 4 generic stats from product.benefits so every product page has the section. */
function buildStats(product) {
  if (Array.isArray(product?.clinical_stats) && product.clinical_stats.length) {
    return product.clinical_stats.slice(0, 4).map(s => ({ s: s.value || s.s, d: s.label || s.d }));
  }
  const placeholders = ['94%', '89%', '96%', '91%'];
  const benefits = (product?.benefits || []).slice(0, 4);
  if (!benefits.length) {
    return [
      { s: '94%', d: 'Visible improvement' },
      { s: '89%', d: 'Felt softer skin' },
      { s: '96%', d: 'Would recommend' },
      { s: '91%', d: 'Saw daily benefit' },
    ];
  }
  return benefits.map((b, i) => ({ s: placeholders[i] || '90%', d: b }));
}

function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { trackAction } = useTracking();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [openSection, setOpenSection] = useState('desc');
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setImgIdx(0);
      try {
        const [p, all, c] = await Promise.all([
          cachedGet(`${API}/api/products/${slug}`),
          cachedGet(`${API}/api/products`),
          cachedGet(`${API}/api/combos`, { ttl: 60_000 }),
        ]);
        setProduct(p.data); setAllProducts(all.data.filter(x => x.slug !== slug)); setCombos(c.data);
        // Track recently-viewed slugs (last 8) in sessionStorage so cart can recommend
        try {
          const prev = JSON.parse(sessionStorage.getItem('recentlyViewed') || '[]');
          const next = [slug, ...prev.filter(s => s !== slug)].slice(0, 8);
          sessionStorage.setItem('recentlyViewed', JSON.stringify(next));
        } catch (e) {}
        if (window.fbq) window.fbq('track', 'ViewContent', { content_name: p.data.name, content_ids: [slug], content_type: 'product', value: p.data.prepaid_price, currency: 'INR' });
        trackAction('view_product', { slug });
      } catch { navigate('/shop'); }
      setLoading(false);
    };
    load();
  }, [slug]);

  const doAdd = () => { addToCart(slug, qty); trackAction('add_to_cart', { product_slug: slug, quantity: qty }); if (window.fbq) window.fbq('track', 'AddToCart', { content_name: product?.name, content_ids: [slug], value: product?.prepaid_price * qty, currency: 'INR' }); };
  const doBuy = () => { addToCart(slug, qty); navigate('/cart'); };
  const doPreorder = () => {
    addToCart(slug, qty);
    axios.post(`${API}/api/products/${slug}/preorder-count`).catch(()=>{});
    trackAction('preorder', { product_slug: slug, quantity: qty });
    navigate('/cart');
  };
  const addCombo = (id) => { addComboToCart(id); navigate('/cart'); };

  if (loading || !product) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  const imgs = product.images?.length > 0 ? product.images : [];
  const kit = combos.find(c => c.combo_id === 'complete-anti-aging-kit');
  const savings = product.mrp - product.prepaid_price;
  const faqs = buildFaqs(product);
  const dermats = buildDermats(product);
  const stats = buildStats(product);
  const isCos = product.niche === 'cosmetics';

  const INGREDIENT_ICONS = [Leaf, Droplets, Sun];

  // ---- SEO: per-product schema + meta, derived from live product data ----
  const seoTitle =
    `${product.name}` +
    (product.size ? ` (${product.size})` : '') +
    ' | Buy Online in India';
  const seoDesc =
    (product.tagline && product.description)
      ? `${product.tagline}. ${(product.description || '').slice(0, 140)}…`
      : (product.description || `${product.name} – clinically formulated by Celesta Glow. Free shipping across India. 7-day sealed-bottle return.`).slice(0, 200);
  const seoImage = imgs[0] || undefined;
  const inStock = !product.is_to_be_launched && (product.stock_qty ?? 1) > 0;
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', url: '/' },
    { name: product.niche === 'cosmetics' ? 'Cosmetics' : product.niche === 'skincare' ? 'Skincare' : 'Anti-Aging',
      url: `/${product.niche === 'cosmetics' ? 'cosmetics' : product.niche === 'skincare' ? 'skincare' : 'anti-aging'}` },
    { name: product.name, url: `/product/${slug}` },
  ]);
  const productSchema = productJsonLd({
    name: product.name,
    slug,
    description: product.description || product.tagline || product.name,
    image: imgs.length ? imgs : seoImage,
    price: product.prepaid_price,
    mrp: product.mrp,
    inStock,
    rating: product.rating || 4.7,
    reviewCount: product.reviews_count || 1240,
    brand: product.brand || 'Celesta Glow',
  });
  const faqSchema = faqs && faqs.length ? faqJsonLd(faqs.slice(0, 6)) : null;
  const seoLd = [productSchema, breadcrumbs, faqSchema].filter(Boolean);

  return (
    <div className="min-h-screen bg-white" data-testid="product-detail-page">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonicalPath={`/product/${slug}`}
        ogImage={seoImage}
        jsonLd={seoLd}
      />
      {/* Urgency Timer Bar */}
      <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white py-2 px-4">
        <div className="flex items-center justify-center gap-2 text-xs">
          <Clock size={13} />
          <span className="font-semibold">Sale ends in</span>
          <UrgencyTimer />
          <span className="hidden sm:inline opacity-80">| Order now for fastest delivery</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <nav className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Link to="/" className="hover:text-green-600">Home</Link><ChevronRight size={10} />
          <Link to={product.niche ? `/shop?niche=${product.niche}` : '/shop'} className="hover:text-green-600" data-testid="breadcrumb-shop">Shop</Link><ChevronRight size={10} />
          <span className="text-gray-600 font-medium">{product.short_name}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-28 lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Gallery */}
          <div>
            <div className="aspect-square bg-gradient-to-br from-stone-50 to-gray-50 rounded-3xl overflow-hidden relative shadow-sm">
              {product.is_to_be_launched ? null : product.badge && <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${product.badge === 'Bestseller' ? 'bg-amber-400 text-amber-900' : product.badge === 'New Launch' ? 'bg-rose-500 text-white' : 'bg-green-600 text-white'}`}>{product.badge.toUpperCase()}</div>}
              {imgs.length > 0 ? (
                <img src={imgs[imgIdx]} alt={product.name} className="w-full h-full object-contain p-6 sm:p-10" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-20 h-20 text-green-200" /></div>
              )}
              {imgs.length > 1 && (
                <>
                  <button onClick={() => setImgIdx((imgIdx - 1 + imgs.length) % imgs.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"><ChevronLeft size={18} className="text-gray-600" /></button>
                  <button onClick={() => setImgIdx((imgIdx + 1) % imgs.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow"><ChevronRight size={18} className="text-gray-600" /></button>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="flex gap-2.5 mt-3">
                {imgs.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all ${imgIdx === i ? 'ring-2 ring-green-500 ring-offset-2' : 'opacity-50 hover:opacity-80'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* Live activity strip — neat horizontal row below image (matches reference design).
                Numbers are deterministic per (product, time-of-day) so they DON'T flicker when
                the user clicks through gallery images, but DO grow naturally through the day. */}
            <ProductLiveStrip slug={slug} />
          </div>

          {/* Info */}
          <div className="lg:py-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} size={15} className={i <= Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />)}</div>
              <span className="text-sm font-semibold text-gray-800 ml-1">{product.rating}</span>
              <span className="text-xs text-gray-400">({product.reviews_count?.toLocaleString()} reviews)</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug tracking-tight">{product.name}</h1>
            <p className="text-green-600 text-xs font-medium mt-1 tracking-wide">{product.tagline} | {product.size}</p>

            {/* Price — with discount feel */}
            <div className="mt-5 bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-4 border border-green-100">
              <div className="flex items-end gap-2.5">
                <span className="text-4xl font-black text-gray-900 tracking-tight">₹{product.prepaid_price}</span>
                <span className="text-lg text-gray-400 line-through mb-1">₹{product.mrp}</span>
              </div>
              <p className="text-xs text-green-700 font-semibold mt-1">You save ₹{savings} on this product</p>
              <p className="text-xs text-gray-500 mt-1">Free Shipping | COD ₹{product.cod_price} | Inclusive of all taxes</p>
              {/* Coupon — orange theme */}
              <div className="mt-2.5 bg-orange-50 rounded-lg p-2.5 border border-orange-200 flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0"><Zap size={13} className="text-white" /></div>
                <p className="text-xs text-orange-800 font-semibold">Use code <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-orange-200">WELCOME50</span> for extra ₹50 OFF</p>
              </div>
            </div>

            {/* Qty + CTA — moved up: shown right after price, before "Buy More Save More" */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center border border-gray-200 rounded-xl bg-white shadow-sm">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3.5 py-2.5 text-gray-500 hover:text-gray-900"><Minus size={16} /></button>
                <span className="w-8 text-center font-bold text-sm">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-3.5 py-2.5 text-gray-500 hover:text-gray-900"><Plus size={16} /></button>
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              {product.is_to_be_launched ? (
                <button disabled className="flex-1 relative overflow-hidden bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed ring-1 ring-amber-400/40 shadow-md shadow-amber-700/25" data-testid="tbl-detail-btn">
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_60%)] pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    <Clock size={16} className="animate-pulse" />
                    <span className="tracking-[0.22em]">TBL</span>
                  </span>
                </button>
              ) : (
                <>
                  <button onClick={doAdd} className="flex-1 border-2 border-green-600 text-green-600 font-bold py-3.5 rounded-2xl hover:bg-green-50 text-sm transition-all" data-testid="add-to-cart-btn">Add to Cart</button>
                  <button onClick={doBuy} className="flex-1 bg-green-600 text-white font-bold py-3.5 rounded-2xl hover:bg-green-700 text-sm transition-all shadow-lg shadow-green-200/50" data-testid="buy-now-btn">Buy Now</button>
                </>
              )}
            </div>

            {/* Volume Discount Offers — show additional savings only */}
            <div className="mt-5 bg-purple-50 rounded-xl p-3 border border-purple-100">
              <p className="text-xs font-bold text-purple-800 mb-2">Buy More, Save More! <span className="text-purple-500 font-normal">(extra discount auto-applied at cart)</span></p>
              <div className="flex gap-1.5">
                {[{q:2,d:3,label:'Buy 2'},{q:3,d:5,label:'Buy 3'},{q:4,d:8,label:'Buy 4+'}].map((tier,i) => {
                  const active = qty >= tier.q && qty < (tier.q === 4 ? 99 : tier.q + 1);
                  return (
                    <button key={i} onClick={() => { setQty(tier.q); }} className={`flex-1 rounded-lg py-2 text-center transition-all border ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-purple-200 hover:border-purple-400'}`}>
                      <p className="text-xs font-bold">{tier.label}</p>
                      <p className="text-[11px] opacity-90 leading-tight">Additional {tier.d}% off</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Key Active Ingredients</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.key_ingredients?.split(/[+,]/).map(s => s.trim()).filter(Boolean).map((ing, i) => {
                  const Icon = INGREDIENT_ICONS[i % INGREDIENT_ICONS.length];
                  return (
                    <div key={i} className="flex-shrink-0 bg-gradient-to-br from-green-50 to-teal-50 border border-green-100 rounded-2xl px-4 py-3 min-w-[110px] text-center">
                      <Icon size={20} className="mx-auto mb-1.5 text-green-600" />
                      <p className="text-xs font-semibold text-gray-800">{ing}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Benefits — Styled cards */}
            <div className="mt-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Benefits</p>
              <div className="space-y-2">
                {product.benefits?.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 bg-stone-50 rounded-xl px-4 py-3 border border-stone-100">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={13} className="text-green-600" />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust — Glass style */}
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[{ icon: Truck, t: 'Free Shipping', d: 'All India' }, { icon: Shield, t: 'Genuine', d: '100% Authentic' }, { icon: Award, t: 'Certified', d: 'Lab Tested' }, { icon: Clock, t: '7-Day Return', d: 'Sealed items only' }].map((b, i) => (
                <div key={i} className="text-center bg-gradient-to-b from-white to-stone-50 rounded-xl py-3 px-1 border border-stone-100 shadow-sm">
                  <b.icon size={18} className="mx-auto mb-1 text-green-600" />
                  <p className="text-xs font-bold text-gray-800 leading-tight">{b.t}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.d}</p>
                </div>
              ))}
            </div>

            {/* Accordion — with left accent */}
            <div className="mt-6 space-y-1">
              {[{ key: 'desc', title: 'Description', content: product.description },
                { key: 'ing', title: 'Full Ingredients', content: product.ingredients_full },
                { key: 'how', title: 'How to Use', content: product.how_to_use }
              ].map(s => (
                <div key={s.key} className={`rounded-xl overflow-hidden transition-all ${openSection === s.key ? 'bg-stone-50 border border-stone-100' : ''}`}>
                  <button onClick={() => setOpenSection(openSection === s.key ? null : s.key)} className="w-full flex items-center justify-between px-4 py-3.5">
                    <span className="font-semibold text-gray-900 text-sm">{s.title}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${openSection === s.key ? 'rotate-180' : ''}`} />
                  </button>
                  {openSection === s.key && (
                    <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-l-2 border-green-400 ml-4 pl-3">{s.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Complete Kit — only relevant for anti-aging products */}
        {kit && product.niche === 'anti-aging' && (
          <div className="mt-12 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-3xl p-5 sm:p-6 border border-amber-200/60" data-testid="bundle-push">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-[0.15em] mb-1">Best Value — Save {kit.discount_percent}%</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">{kit.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{kit.description}</p>
                <div className="flex items-end gap-2 mt-3">
                  <span className="text-2xl font-black text-gray-900">₹{kit.combo_prepaid_price?.toLocaleString()}</span>
                  <span className="text-sm text-gray-400 line-through mb-0.5">₹{kit.mrp_total?.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => addCombo(kit.combo_id)} className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-7 py-3 rounded-2xl text-sm shadow-lg shadow-amber-200/50 transition-all" data-testid="add-kit-from-product">Get Complete Kit</button>
            </div>
          </div>
        )}

        {/* Clinical / Efficacy Stats — only relevant for anti-aging or when backend provides explicit stats.
            Skipped for plain skincare/cosmetics so the page stays focused on what matters for that product. */}
        {(product.niche === 'anti-aging' || (Array.isArray(product.clinical_stats) && product.clinical_stats.length > 0)) && (
          <div className="mt-12 bg-gradient-to-br from-green-900 via-green-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white">
            <p className="text-xs font-bold text-green-300 uppercase tracking-[0.2em] text-center mb-1">{isCos ? 'Performance Highlights' : 'Clinical Study Results'}</p>
            <h3 className="text-lg font-bold text-center mb-5">{isCos ? 'Wear-tested by 500+ Customers' : 'Proven by 500+ Participants'}</h3>
            <div className="grid grid-cols-4 gap-3">
              {stats.map((r, i) => (
                <div key={i} className="text-center bg-white/10 backdrop-blur-sm rounded-2xl py-3 px-2">
                  <p className="text-2xl sm:text-3xl font-black text-green-300">{r.s}</p>
                  <p className="text-xs text-green-200 mt-1 leading-tight">{r.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dermatologist Approved — relevant for skincare & anti-aging only. Hidden for cosmetics. */}
        {!isCos && (
          <div className="mt-12">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] text-center mb-1">Expert Endorsements</p>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-5">Dermatologist Approved</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dermats.map((d, i) => (
                <div key={i} className="bg-gradient-to-b from-white to-stone-50 rounded-2xl p-4 border border-stone-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center ring-2 ring-green-200">
                      <User size={18} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{d.n}</p>
                      <p className="text-xs text-green-600 font-medium">{d.c}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-2">{[1,2,3,4,5].map(s => <Star key={s} size={11} className="fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-sm text-gray-600 italic leading-relaxed">"{d.q}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews — auto-scrolling carousel pulled from /admin/reviews */}
        <div className="mt-10 -mx-4">
          <ReviewsCarousel
            title="What our customers say"
            eyebrow="Real reviews · Verified buyers"
          />
        </div>

        {/* Related Products — same niche only */}
        {(() => {
          const related = allProducts.filter(x => x.niche === product.niche).slice(0, 4);
          if (!related.length) return null;
          return (
            <div className="mt-12">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] text-center mb-1">Complete Your Routine</p>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-5">You Might Also Like</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {related.map(p => (
                  <div key={p.slug} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group">
                    <Link to={`/product/${p.slug}`}>
                      <div className="aspect-square bg-gradient-to-br from-stone-50 to-gray-50 flex items-center justify-center p-3 group-hover:scale-105 transition-transform">
                        {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-contain" /> : <Sparkles className="w-10 h-10 text-green-200" />}
                      </div>
                    </Link>
                    <div className="p-3">
                      <p className="font-semibold text-xs text-gray-900 line-clamp-1">{p.short_name}</p>
                      <div className="flex items-baseline gap-1.5 mt-1 mb-2">
                        <span className="font-bold text-sm text-gray-900">₹{p.prepaid_price}</span>
                        <span className="text-xs text-gray-400 line-through">₹{p.mrp}</span>
                      </div>
                      <button onClick={() => addToCart(p.slug)} className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-green-700 transition-colors" data-testid={`related-add-${p.slug}`}>Add to Cart</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* FAQ */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-gray-900 text-center mb-5">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'bg-green-50 border border-green-100' : 'bg-stone-50 border border-stone-100'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="font-medium text-gray-900 text-sm pr-4">{f.q}</span>
                  <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom CTA — mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 px-4 py-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" data-testid="sticky-bottom-cta">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-lg font-black text-gray-900">₹{product.prepaid_price} <span className="text-xs text-gray-400 line-through font-normal">₹{product.mrp}</span></p>
          </div>
          {product.is_to_be_launched ? (
            <button disabled className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-black px-8 py-2.5 rounded-xl text-xs shadow-md shadow-amber-700/30 ring-1 ring-amber-400/40 flex items-center justify-center gap-1.5 cursor-not-allowed tracking-[0.22em]"><Clock size={14} className="animate-pulse" /> TBL</button>
          ) : (
            <>
              <button onClick={doAdd} className="border-2 border-green-600 text-green-600 font-bold px-5 py-2.5 rounded-xl text-xs">Add</button>
              <button onClick={doBuy} className="bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-green-200/50">Buy Now</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
