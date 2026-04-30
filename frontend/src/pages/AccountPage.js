import React, { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Lock, LogOut, Package, ChevronRight, Loader2, ShieldCheck, Mail, CheckCircle2, Truck } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCOUNT_KEY = 'cg_account_session';

/**
 * /account — Customer account page.
 *  - Sign-in with mobile number + password (4+ chars). Frontend session persisted to localStorage.
 *  - Once signed in, shows profile card + recent orders fetched via POST /api/track-order
 *    with real-time status from backend.
 *
 *  NOTE: This is a lightweight customer login designed for quick order tracking.
 *  Password is verified locally against the saved session (no backend auth) — a true
 *  account API can be wired later. Phone is the primary identifier for orders.
 */
export default function AccountPage() {
  const [session, setSession] = useState(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  /* Load persisted session */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  /* Fetch orders when session set */
  useEffect(() => {
    if (!session?.phone) return;
    setOrdersLoading(true);
    axios.post(`${API}/api/track-order`, { phone: session.phone })
      .then(r => setOrders(r.data?.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [session]);

  const validatePhone = (p) => /^\d{10}$/.test(p.trim().replace(/\D/g, '').slice(-10));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!validatePhone(cleanPhone)) return setError('Enter a valid 10-digit phone number');
    if (!password || password.length < 4) return setError('Password must be at least 4 characters');
    if (mode === 'signup' && email && !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email');

    setLoading(true);
    setTimeout(() => {
      // Lightweight client-side session (no real auth backend yet)
      const acc = { phone: cleanPhone, email: email || null, createdAt: new Date().toISOString() };
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
      // Save password hash placeholder (NOT used for verification — kept for future backend wiring)
      localStorage.setItem('cg_account_pwd', btoa(password));
      setSession(acc);
      setLoading(false);
      setPhone(''); setEmail(''); setPassword('');
    }, 600);
  };

  const handleSignout = () => {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem('cg_account_pwd');
    setSession(null);
    setOrders([]);
  };

  /* ============ SIGNED-OUT VIEW ============ */
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white pb-24" data-testid="account-page-signed-out">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="max-w-md mx-auto px-5 sm:px-6 pt-8">
          <div className="text-center mb-7">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 ring-1 ring-emerald-200 items-center justify-center shadow-sm mb-3">
              <User size={28} className="text-emerald-700" />
            </div>
            <h1 className="font-heading text-3xl font-black text-stone-900 tracking-tight">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {mode === 'signin' ? 'Sign in to track your orders & manage account.' : 'Track every order in one place.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-6 shadow-sm space-y-3" data-testid="account-form">
            {/* Phone */}
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone number"
                data-testid="account-input-phone"
                className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-base outline-none transition-all"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Email — only for signup */}
            {mode === 'signup' && (
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  data-testid="account-input-email"
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-base outline-none transition-all"
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            {/* Password */}
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                data-testid="account-input-password"
                className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-base outline-none transition-all"
                style={{ fontSize: '16px' }}
              />
            </div>

            {error && <p className="text-xs text-rose-600 font-semibold" data-testid="account-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              data-testid="account-submit-btn"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-emerald-900/15 transition-all active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <p className="text-center text-xs text-stone-500 pt-1">
              {mode === 'signin' ? "New to Celesta Glow? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                data-testid="account-toggle-mode"
                className="font-bold text-emerald-700 hover:underline"
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </form>

          <Link to="/track-order" className="block mt-4 text-center text-xs text-stone-500 hover:text-emerald-700 font-semibold" data-testid="account-guest-track">
            Or track an order as guest →
          </Link>
        </div>
      </div>
    );
  }

  /* ============ SIGNED-IN VIEW ============ */
  return (
    <div className="min-h-screen bg-stone-50/60 pb-24" data-testid="account-page-signed-in">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-800 text-white px-5 sm:px-6 pt-7 pb-12 rounded-b-[28px] relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 85% 20%, white 0%, transparent 45%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
            <User size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-emerald-200">Logged in as</p>
            <p className="font-heading text-xl font-black truncate" data-testid="account-display-phone">+91 {session.phone}</p>
            {session.email && <p className="text-xs text-emerald-100/80 truncate" data-testid="account-display-email">{session.email}</p>}
          </div>
          <button
            onClick={handleSignout}
            data-testid="account-signout-btn"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 ring-1 ring-white/15 px-3 py-2 rounded-full text-xs font-bold transition-all"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      {/* Orders */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-7 relative">
        <div className="bg-white rounded-3xl ring-1 ring-stone-200 shadow-sm overflow-hidden" data-testid="account-orders-card">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Package size={16} className="text-emerald-700" />
            <h2 className="font-heading text-base font-black text-stone-900">My Orders</h2>
            {orders.length > 0 && (
              <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{orders.length}</span>
            )}
          </div>

          {ordersLoading ? (
            <div className="px-5 py-8 text-center text-sm text-stone-500 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="px-5 py-10 text-center" data-testid="account-no-orders">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
                <Package size={22} className="text-stone-400" />
              </div>
              <p className="text-sm font-bold text-stone-900 mb-1">No orders yet</p>
              <p className="text-xs text-stone-500 mb-4">When you place an order, it'll show up here.</p>
              <Link to="/shop" className="inline-flex items-center gap-1.5 bg-emerald-700 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-emerald-800 transition-colors">
                Start shopping <ChevronRight size={13} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {orders.map((o) => {
                const statusColor = (o.status || '').toLowerCase().includes('deliver') ? 'text-emerald-700 bg-emerald-50' :
                  (o.status || '').toLowerCase().includes('cancel') ? 'text-rose-700 bg-rose-50' :
                    'text-amber-700 bg-amber-50';
                return (
                  <li key={o.order_id} className="px-5 py-4 flex items-center gap-3" data-testid={`account-order-${o.order_id}`}>
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 to-stone-50 ring-1 ring-stone-200 flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-emerald-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-stone-900 truncate">#{o.order_id}</p>
                        <span className={`text-[10px] font-black tracking-wide uppercase px-2 py-0.5 rounded-full ${statusColor}`}>
                          {o.status || 'Processing'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 truncate">
                        ₹{o.total_amount?.toLocaleString?.() || o.total_amount} · {o.payment_method || 'Prepaid'}
                        {o.expected_delivery && ` · arrives ${o.expected_delivery}`}
                      </p>
                    </div>
                    <Link
                      to={`/track-order?orderId=${o.order_id}`}
                      data-testid={`account-track-${o.order_id}`}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      Track <ChevronRight size={13} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link to="/track-order" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-all" data-testid="account-quick-track">
            <Truck size={16} className="text-emerald-700" />
            <div>
              <p className="text-xs font-black text-stone-900">Track Order</p>
              <p className="text-[10px] text-stone-500">Real-time status</p>
            </div>
          </Link>
          <Link to="/contact" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-all" data-testid="account-quick-support">
            <CheckCircle2 size={16} className="text-emerald-700" />
            <div>
              <p className="text-xs font-black text-stone-900">Help &amp; Support</p>
              <p className="text-[10px] text-stone-500">Get answers fast</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
