import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Truck, ArrowLeft, Check, MapPin, Clock, Star, Award, Gift, Lock, Users } from 'lucide-react';
import { getCart, saveCart, addToCart } from './Homepage';
import { useTracking } from '../providers/TrackingProvider';
import CheckoutMap from '../components/CheckoutMap';

const STORED_LOCATION_KEY = 'cg_delivery_location';

const API = process.env.REACT_APP_BACKEND_URL;

// Defined at module scope so React doesn't remount the <input> on every keystroke
// (which was causing the mobile keyboard to auto-dismiss after each character).
const Field = React.memo(function Field({ label, field, type = 'text', placeholder, span, value, error, onChange, inputMode }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value || ''}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border rounded-xl text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-green-200 transition-all outline-none ${error ? 'border-red-300' : 'border-gray-200'}`}
        data-testid={`checkout-${field}`}
        autoComplete={field === 'name' ? 'name' : field === 'phone' ? 'tel' : field === 'email' ? 'email' : field === 'pincode' ? 'postal-code' : field === 'city' ? 'address-level2' : field === 'state' ? 'address-level1' : field === 'area' ? 'street-address' : 'on'}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
});

function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { trackAction, trackPurchase, trackGAEvent } = useTracking();
  const { cartData: passedCartData, paymentMethod: passedMethod, coupon, giftCard } = location.state || {};
  const [cartData, setCartData] = useState(passedCartData);
  const [paymentMethod, setPaymentMethod] = useState(passedMethod || 'prepaid');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', house_number: '', area: '', city: '', pincode: '', state: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  // Instant Delivery — draggable-pin state. Seed from LocationStrip if user
  // already picked one; otherwise CheckoutMap falls back to Kozhikode.
  const [pin, setPin] = useState(() => {
    try {
      const raw = localStorage.getItem(STORED_LOCATION_KEY);
      const j = raw ? JSON.parse(raw) : null;
      return (j && j.lat && j.lng) ? { lat: j.lat, lng: j.lng } : null;
    } catch (_) { return null; }
  });
  const [pinInfo, setPinInfo] = useState(null); // { lat, lng, coverage, address }

  // Load saved addresses if customer is logged in
  useEffect(() => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('cg_auth_token') : null;
    if (!token) return;
    axios.get(`${API}/api/customer/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const list = r.data?.addresses || [];
        setSavedAddresses(list);
        // Auto-fill from default address if formData is empty
        const def = list.find(a => a.is_default) || list[0];
        if (def && !formData.name) {
          setSelectedAddressId(def.id);
          setFormData({
            name: def.name || '', phone: def.phone || '', email: formData.email || '',
            house_number: def.house_number || '', area: def.area || '',
            city: def.city || '', pincode: def.pincode || '', state: def.state || '',
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAddress = (id) => {
    const a = savedAddresses.find(x => x.id === id);
    if (!a) return;
    setSelectedAddressId(id);
    setFormData({
      name: a.name || '', phone: a.phone || '', email: formData.email || '',
      house_number: a.house_number || '', area: a.area || '',
      city: a.city || '', pincode: a.pincode || '', state: a.state || '',
    });
  };

  useEffect(() => {
    trackAction('view_checkout', { step: 'checkout_started' });
    // Meta Pixel — Checkout PageView (in addition to InitiateCheckout fired from cart)
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView', { page_name: 'checkout', content_category: 'Checkout' });
    }
    // Pre-fill form from the logged-in user (if any)
    try {
      const u = JSON.parse(localStorage.getItem('cg_auth_user') || 'null');
      if (u) {
        setFormData(prev => ({
          ...prev,
          email: prev.email || u.email || '',
          phone: prev.phone || u.phone || '',
          name:  prev.name  || u.name  || '',
        }));
      }
    } catch { /* ignore */ }
    if (!cartData) {
      const cart = getCart();
      if (!cart.items.length) { navigate('/cart'); return; }
      axios.post(`${API}/api/cart/validate`, { items: cart.items, payment_method: paymentMethod, coupon_code: coupon?.code, gift_card_code: giftCard?.code || null })
        .then(res => setCartData(res.data)).catch(() => navigate('/cart'));
    }
  }, []);

  const handlePincodeChange = async (pincode) => {
    setFormData(prev => ({ ...prev, pincode }));
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      try {
        const res = await axios.get(`${API}/api/pincode/${pincode}`);
        setFormData(prev => ({
          ...prev,
          state: res.data.state || prev.state,
          city: res.data.city || res.data.district || prev.city
        }));
      } catch {}
    }
  };

  // Stable change handler — passed to memoized Field, prevents input remounts on keystroke.
  const handleFieldChange = React.useCallback((field, value) => {
    if (field === 'pincode') {
      handlePincodeChange(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-validate cart when payment method changes (so COD/prepaid totals update live)
  useEffect(() => {
    if (!cartData) return;
    const cart = getCart();
    if (!cart.items.length) return;
    axios.post(`${API}/api/cart/validate`, { items: cart.items, payment_method: paymentMethod, coupon_code: coupon?.code, gift_card_code: giftCard?.code || null })
      .then(res => setCartData(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Required';
    if (!formData.phone.match(/^[6-9]\d{9}$/)) e.phone = 'Valid 10-digit phone';
    // Strict email format: no consecutive dots, must have proper local/domain/TLD
    const emailRe = /^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*@[A-Za-z0-9]+([.-][A-Za-z0-9]+)*\.[A-Za-z]{2,}$/;
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!emailRe.test(formData.email.trim())) e.email = 'Enter a valid email (e.g., name@domain.com)';
    if (!formData.house_number.trim()) e.house_number = 'Required';
    if (!formData.area.trim()) e.area = 'Address required';
    if (!formData.pincode.match(/^\d{6}$/)) e.pincode = 'Valid pincode';
    if (!formData.state.trim()) e.state = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    if (!validate() || !cartData) return;
    setSubmitting(true);
    trackAction('payment_method_selected', { method: paymentMethod });
    const referralCode = (typeof window !== 'undefined') ? sessionStorage.getItem('referralCode') : null;
    // Attach the sale-campaign slug from sessionStorage so admin can attribute
    // orders back to specific /sale/... landing pages. Set on SalePage load.
    let campaign_slug = null;
    try { campaign_slug = sessionStorage.getItem('sale_campaign_slug') || null; } catch (_) { /* noop */ }
    const payload = { ...formData, payment_method: paymentMethod, amount: cartData.total, items: cartData.items, coupon_code: coupon?.code || null, coupon_discount: coupon?.discount || 0, referral_code: referralCode || null, gift_card_code: cartData.gift_card?.code || null, gift_card_discount: cartData.gift_card_discount || 0, campaign_slug,
      // Instant Delivery — pin coords + auto-assigned warehouse.
      delivery_lat: pinInfo?.lat || null,
      delivery_lng: pinInfo?.lng || null,
      delivery_type: pinInfo?.coverage?.delivery_type || null,
      assigned_warehouse_id: pinInfo?.coverage?.assigned_warehouse_id || null,
    };
    const fireConversion = (orderId) => {
      trackAction('order_complete', { order_id: orderId, total: cartData.total, items: cartData.item_count, payment_method: paymentMethod });
      trackPurchase(orderId, cartData.total, paymentMethod);
      trackGAEvent('purchase', { transaction_id: orderId, value: cartData.total, currency: 'INR', items: cartData.item_count });
    };
    // Cache order + navigate with state so Order Success shows INSTANTLY (no loading spinner)
    const goToSuccess = (orderData) => {
      try { sessionStorage.setItem(`cg_order_${orderData.order_id}`, JSON.stringify(orderData)); } catch {}
      // One-time-use guard: clear the popup-claimed coupon code so it does NOT
      // auto-apply on the next order. We keep `discountClaimed=true` so the
      // popup never shows again to the same browser.
      try {
        localStorage.removeItem('discountCode');
        localStorage.removeItem('claimedDiscountCode');
      } catch { /* ignore */ }
      saveCart({ items: [] });
      navigate(`/order-success/${orderData.order_id}`, { state: { order: orderData } });
    };
    try {
      if (paymentMethod === 'prepaid') {
        const rzpOrder = await axios.post(`${API}/api/create-razorpay-order`, { amount: cartData.total });
        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_key', amount: rzpOrder.data.amount, currency: 'INR',
          name: 'Celesta Glow', description: `Order - ${cartData.item_count} items`, order_id: rzpOrder.data.id,
          handler: async (response) => {
            try {
              // Fire verify + create-order in PARALLEL — verify is just a signature check
              const [, orderResp] = await Promise.all([
                axios.post(`${API}/api/verify-payment`, response),
                axios.post(`${API}/api/orders`, payload),
              ]);
              fireConversion(orderResp.data.order_id);
              goToSuccess(orderResp.data);
            } catch (e) {
              alert(e?.response?.data?.detail || 'Payment verification failed');
              setSubmitting(false);
            }
          },
          prefill: { name: formData.name, contact: formData.phone, email: formData.email },
          theme: { color: '#16a34a' },
          // Reset button state when user closes the Razorpay modal without paying
          modal: {
            ondismiss: () => {
              trackAction('payment_modal_dismissed', { method: 'razorpay' });
              setSubmitting(false);
            },
            escape: true,
            backdropclose: false,
          },
        };
        // Razorpay SDK is no longer pre-loaded globally (removed from
        // index.html in the Jun 22 2026 perf pass). Inject it on demand
        // here so the homepage stays light. Subsequent checkouts find the
        // script already cached and resolve immediately.
        if (!window.Razorpay) {
          await new Promise((resolve, reject) => {
            const existing = document.getElementById('rzp-sdk');
            if (existing) { existing.addEventListener('load', resolve); existing.addEventListener('error', reject); return; }
            const s = document.createElement('script');
            s.id = 'rzp-sdk';
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load Razorpay'));
            document.head.appendChild(s);
          });
        }
        const rzp = new window.Razorpay(options);
        // Failed payment — also reset the button
        rzp.on('payment.failed', (resp) => {
          const reason = resp?.error?.description || 'Payment failed. Please try again.';
          alert(reason);
          setSubmitting(false);
        });
        rzp.open();
      } else {
        const order = await axios.post(`${API}/api/orders`, payload);
        fireConversion(order.data.order_id);
        goToSuccess(order.data);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Order failed. Please try again.';
      alert(detail);
      setSubmitting(false);
    }
  };

  if (!cartData) return null;

  return (
    <div className="min-h-screen bg-stone-50" data-testid="checkout-page">
      {/* Premium Trust Strip */}
      <div className="bg-green-800 text-white py-2.5 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-5 sm:gap-8 text-xs sm:text-xs font-medium">
          <span className="flex items-center gap-1.5"><Lock size={13} /> Secure Checkout</span>
          <span className="flex items-center gap-1.5"><Truck size={13} /> Free Shipping</span>
          <span className="flex items-center gap-1.5"><Star size={13} /> 4.8 Rating</span>
          <span className="flex items-center gap-1.5 hidden sm:flex"><Shield size={13} /> 7-Day Sealed Return</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-5">
          <Link to="/cart" className="p-2 hover:bg-white rounded-xl transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
            <p className="text-xs text-gray-400">{cartData.item_count} items | Secure checkout</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Form */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2"><MapPin size={16} className="text-green-600" /> Delivery Address</h2>

              {/* Instant Delivery — draggable pin. Sets delivery_lat/lng + coverage on the order. */}
              <div className="mb-4">
                <CheckoutMap initial={pin} onChange={(info) => {
                  setPinInfo(info);
                  setPin({ lat: info.lat, lng: info.lng });
                  // Auto-fill address fields from the reverse-geocode payload —
                  // only if the user hasn't already typed something into that field
                  // (so we never clobber their manual edits).
                  setFormData((prev) => ({
                    ...prev,
                    city: prev.city || info.city || info.locality || '',
                    state: prev.state || info.state || '',
                    pincode: prev.pincode || info.pincode || '',
                    area: prev.area || info.locality || '',
                  }));
                }} />
              </div>

              {/* Saved addresses selector (logged-in customers) */}
              {savedAddresses.length > 0 && (
                <div className="mb-4 -mt-2" data-testid="checkout-saved-addresses">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Use a saved address</label>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applyAddress(a.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedAddressId === a.id ? 'bg-green-600 text-white ring-2 ring-green-300' : 'bg-stone-50 text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100'}`}
                        data-testid={`checkout-saved-addr-${a.id}`}
                      >
                        {a.label || 'Address'} · {a.pincode}
                        {a.is_default && <span className="ml-1 opacity-70">★</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setSelectedAddressId(''); setFormData({ name: '', phone: '', email: formData.email, house_number: '', area: '', city: '', pincode: '', state: '' }); }}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white ring-1 ring-stone-200 text-stone-500 hover:bg-stone-50"
                      data-testid="checkout-addr-new"
                    >
                      + New
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name" field="name" placeholder="Your full name" value={formData.name} error={errors.name} onChange={handleFieldChange} />
                <Field label="Phone" field="phone" type="tel" inputMode="tel" placeholder="10-digit number" value={formData.phone} error={errors.phone} onChange={handleFieldChange} />
                <Field label="Email" field="email" type="email" inputMode="email" placeholder="email@example.com" span value={formData.email} error={errors.email} onChange={handleFieldChange} />
                <Field label="House / Flat No." field="house_number" placeholder="House no, building, floor" span value={formData.house_number} error={errors.house_number} onChange={handleFieldChange} />
                <Field label="Address" field="area" placeholder="Street, area, landmark" span value={formData.area} error={errors.area} onChange={handleFieldChange} />
                <Field label="Pincode" field="pincode" inputMode="numeric" placeholder="6-digit pincode" value={formData.pincode} error={errors.pincode} onChange={handleFieldChange} />
                <Field label="City" field="city" placeholder="City / Locality" value={formData.city} error={errors.city} onChange={handleFieldChange} />
                <Field label="State" field="state" placeholder="State" span value={formData.state} error={errors.state} onChange={handleFieldChange} />
              </div>

              {/* Inline ETA after pincode — suppressed when Instant Delivery is available,
                  since CheckoutMap already surfaces the "45-55 min / 1-2 hr" ETA banner. */}
              {!pinInfo?.coverage?.instant_available && formData.pincode && /^\d{6}$/.test(formData.pincode) && formData.city && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2.5" data-testid="checkout-eta-pill">
                  <Truck size={15} className="text-green-700 flex-shrink-0" />
                  <p className="text-xs text-green-900">
                    Delivers to <strong>{formData.city}{formData.state ? `, ${formData.state}` : ''}</strong> in{' '}
                    <strong className="text-green-700">{paymentMethod === 'prepaid' ? '1–3 business days' : '4–6 business days'}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 text-sm mb-3">Payment Method</h2>
              <div className="space-y-2.5">
                <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'prepaid' ? 'border-green-500 bg-green-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="pay" checked={paymentMethod === 'prepaid'} onChange={() => setPaymentMethod('prepaid')} className="text-green-600 w-4 h-4" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-900">Prepaid (UPI / Card)</p>
                      <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">RECOMMENDED</span>
                    </div>
                    <p className="text-xs text-green-600 font-medium mt-0.5">Faster delivery · Best price</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'COD' ? 'border-green-500 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="pay" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} className="text-green-600 w-4 h-4" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">Cash on Delivery</p>
                    <p className="text-xs text-gray-500 mt-0.5">₹0 advance · Pay full on delivery</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Volume / buy-more discount panel removed per business policy. */}

            {/* Referral Program */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2"><Gift size={16} className="text-purple-600" /><p className="text-xs font-bold text-purple-800">Earn Rewards After Purchase!</p></div>
              <p className="text-xs text-gray-600 leading-relaxed">Refer friends after checkout and earn ₹50 for every successful referral. <span className="font-semibold text-purple-700">2,847 customers referred friends this month!</span></p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white rounded-xl p-2.5 text-center border border-purple-100">
                  <p className="text-base font-black text-purple-700">2,847</p>
                  <p className="text-xs text-purple-500 font-medium">Referrals This Month</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 text-center border border-purple-100">
                  <p className="text-base font-black text-purple-700">₹1.42L</p>
                  <p className="text-xs text-purple-500 font-medium">Rewards Earned</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm sticky top-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">Order Summary</p>
              <div className="space-y-2 mb-3 max-h-36 overflow-y-auto">
                {cartData.items?.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 truncate mr-2 flex-1">{item.short_name || item.name}</span>
                    <span className="text-xs text-gray-400 mr-2">x{item.quantity}</span>
                    <span className="font-medium text-gray-900">₹{item.line_total}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>₹{cartData.subtotal?.toLocaleString()}</span></div>
                {cartData.discount > 0 && <div className="flex justify-between text-green-600"><span>Coupon Discount</span><span className="font-semibold">-₹{cartData.discount}</span></div>}
                {(cartData.tax_charges > 0 || cartData.sale_perks?.tax) && (
                  <div className="flex justify-between text-gray-400">
                    <span className="flex items-center gap-1.5">
                      Taxes &amp; Charges
                      {cartData.sale_perks?.tax && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {cartData.sale_perks.reason || 'FLAT 50% OFF'}
                        </span>
                      )}
                    </span>
                    <span>
                      {cartData.sale_perks?.tax ? (
                        <>
                          {cartData.tax_charges_original > 0 && <span className="text-gray-300 line-through mr-1.5">₹{cartData.tax_charges_original}</span>}
                          <span className="text-green-600 font-bold">FREE</span>
                        </>
                      ) : (
                        <>
                          {cartData.tax_charges_original > cartData.tax_charges && <span className="text-gray-300 line-through mr-1.5">₹{cartData.tax_charges_original}</span>}
                          ₹{cartData.tax_charges}
                        </>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span className="flex items-center gap-1.5">
                    Delivery
                    {cartData.sale_perks?.delivery && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {cartData.sale_perks.reason || 'FLAT 50% OFF'}
                      </span>
                    )}
                  </span>
                  {cartData.sale_perks?.delivery ? (
                    <span>
                      {cartData.delivery_fee_original > 0 && <span className="text-gray-300 line-through mr-1.5">₹{cartData.delivery_fee_original}</span>}
                      <span className="text-green-600 font-bold">FREE</span>
                    </span>
                  ) : cartData.delivery_fee > 0
                    ? <span className="font-medium text-orange-600">₹{cartData.delivery_fee}</span>
                    : <span className="text-green-600 font-medium">FREE</span>
                  }
                </div>
                {cartData.packaging_fee > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>🌿 Eco-Friendly Packaging</span>
                    <span>₹{cartData.packaging_fee}</span>
                  </div>
                )}
                {cartData.gift_card_discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium" data-testid="checkout-giftcard-row">
                    <span>🎁 Gift Card ({cartData.gift_card?.code})</span>
                    <span>-₹{cartData.gift_card_discount}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-lg"><span>Total</span><span>₹{cartData.total?.toLocaleString()}</span></div>
              </div>

              {cartData.gift_card?.code && cartData.gift_card_discount > 0 && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center" data-testid="checkout-giftcard-note">
                  <p className="text-xs text-rose-800 font-bold">🎁 Gift card {cartData.gift_card.code} applied</p>
                  <p className="text-xs text-rose-700 mt-0.5">₹{cartData.gift_card.remaining_after} balance will remain after this order</p>
                </div>
              )}

              {cartData.savings > 0 && (
                <div className="mt-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl p-3 text-center text-white">
                  <p className="text-xs font-bold">Total Savings: ₹{cartData.savings?.toLocaleString()}</p>
                  <p className="text-xs opacity-80">Incl. product discount + volume discount + free shipping</p>
                </div>
              )}

              <button onClick={placeOrder} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-2xl mt-4 text-sm shadow-xl shadow-green-200/40 transition-all" data-testid="place-order-btn">
                {submitting ? 'Processing...' : paymentMethod === 'prepaid' ? `Pay ₹${cartData.total?.toLocaleString()}` : `Place COD Order`}
              </button>

              {/* Delivery Timeline — Instant Delivery orders get their ETA from CheckoutMap,
                  so we hide the standard shipping copy to avoid conflicting messaging. */}
              {pinInfo?.coverage?.instant_available ? (
                <div className="mt-3 text-center text-xs text-amber-700 font-semibold" data-testid="checkout-delivery-timeline-instant">
                  <p>Instant delivery · <strong>{pinInfo?.coverage?.nearest_warehouse?.distance_km <= 5 ? 'arrives in 45–55 minutes' : 'arrives in 1–2 hours'}</strong></p>
                </div>
              ) : (
                <div className="mt-3 text-center text-xs text-gray-500" data-testid="checkout-delivery-timeline-standard">
                  {paymentMethod === 'prepaid' ? (
                    <p>Faster delivery · <strong className="text-green-600">1–3 business days</strong></p>
                  ) : (
                    <p>Standard delivery · <strong>4–6 business days</strong></p>
                  )}
                </div>
              )}

              {/* Trust Icons */}
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1"><Lock size={10} /> SSL Secure</span>
                <span className="flex items-center gap-1"><Shield size={10} /> Verified Brand</span>
                <span className="flex items-center gap-1"><Users size={10} /> 50K+ Served</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
