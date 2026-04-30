import React, { useEffect, useState, useCallback } from 'react';
import BackButton from '../components/BackButton';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  User, Mail, LogOut, Package, ChevronRight, Loader2,
  ShieldCheck, CheckCircle2, Truck, KeyRound, ArrowLeft, ExternalLink,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'cg_auth_token';
const USER_KEY = 'cg_auth_user';

/**
 * Email-OTP Account page:
 *  Step 1 → enter email, server sends 6-digit OTP to Gmail
 *  Step 2 → enter OTP, server returns session token + user
 *  Signed-in → shows orders (with Delhivery tracking links) + signout
 */
export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // OTP flow state
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  /* Load persisted session on mount */
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch { /* ignore */ }
  }, []);

  /* Fetch orders once logged in */
  const fetchOrders = useCallback(async (authToken) => {
    setOrdersLoading(true);
    try {
      const r = await axios.get(`${API}/api/auth/orders`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setOrders(r.data?.orders || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      }
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchOrders(token);
  }, [token, fetchOrders]);

  /* Resend cooldown ticker */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validateEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim());

  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    setError(''); setInfo('');
    if (!validateEmail(email)) return setError('Enter a valid email address');
    setSending(true);
    try {
      const r = await axios.post(`${API}/api/auth/send-otp`, { email: email.trim().toLowerCase() });
      setInfo(r.data?.message || 'Code sent. Check your email.');
      setStep('otp');
      setResendIn(30);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) return setError('Enter the 6-digit code from your email');
    setVerifying(true);
    try {
      const r = await axios.post(`${API}/api/auth/verify-otp`, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const authToken = r.data?.token;
      const userObj = r.data?.user;
      if (authToken && userObj) {
        localStorage.setItem(TOKEN_KEY, authToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userObj));
        setToken(authToken);
        setUser(userObj);
        setOtp(''); setEmail(''); setInfo(''); setError('');
        setStep('email');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Incorrect or expired code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSignout = async () => {
    try {
      if (token) {
        await axios.post(`${API}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null); setUser(null); setOrders([]);
  };

  /* ============ SIGNED-OUT VIEW ============ */
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white pb-24" data-testid="account-page-signed-out">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        <div className="max-w-md mx-auto px-5 sm:px-6 pt-8">
          <div className="text-center mb-7">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 ring-1 ring-emerald-200 items-center justify-center shadow-sm mb-3">
              {step === 'email' ? (
                <User size={28} className="text-emerald-700" />
              ) : (
                <KeyRound size={28} className="text-emerald-700" />
              )}
            </div>
            <h1 className="font-heading text-3xl font-black text-stone-900 tracking-tight">
              {step === 'email' ? 'Sign in with email' : 'Enter your code'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {step === 'email'
                ? 'We’ll send a 6-digit login code to your email.'
                : `Sent a 6-digit code to ${email}`}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-6 shadow-sm space-y-3" data-testid="account-email-form">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="account-input-email"
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-base outline-none transition-colors"
                  style={{ fontSize: '16px' }}
                />
              </div>
              {error && <p className="text-xs text-rose-600 font-semibold" data-testid="account-error">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                data-testid="account-send-otp-btn"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-emerald-900/15 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {sending ? 'Sending…' : 'Send login code'}
              </button>
              <p className="text-center text-[11px] text-stone-400 pt-1">
                By continuing you agree to our Terms &amp; Privacy.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="bg-white rounded-3xl ring-1 ring-stone-200 p-5 sm:p-6 shadow-sm space-y-3" data-testid="account-otp-form">
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  data-testid="account-input-otp"
                  className="w-full pl-10 pr-4 h-12 rounded-xl bg-stone-50 ring-1 ring-stone-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-lg tracking-[0.5em] font-bold outline-none transition-colors"
                  style={{ fontSize: '18px' }}
                />
              </div>
              {info && <p className="text-xs text-emerald-700 font-semibold">{info}</p>}
              {error && <p className="text-xs text-rose-600 font-semibold" data-testid="account-error">{error}</p>}
              <button
                type="submit"
                disabled={verifying}
                data-testid="account-verify-otp-btn"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-emerald-900/15 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {verifying ? 'Verifying…' : 'Verify &amp; sign in'}
              </button>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); setInfo(''); }}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1"
                  data-testid="account-back-to-email"
                >
                  <ArrowLeft size={12} /> Change email
                </button>
                <button
                  type="button"
                  disabled={resendIn > 0 || sending}
                  onClick={handleSendOtp}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:text-stone-400 disabled:cursor-not-allowed"
                  data-testid="account-resend-otp"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

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
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-emerald-200">Signed in</p>
            <p className="font-heading text-xl font-black truncate" data-testid="account-display-email">
              {user.email}
            </p>
            {user.phone && (
              <p className="text-xs text-emerald-100/80 truncate" data-testid="account-display-phone">+91 {user.phone}</p>
            )}
          </div>
          <button
            onClick={handleSignout}
            data-testid="account-signout-btn"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 ring-1 ring-white/15 px-3 py-2 rounded-full text-xs font-bold transition-colors"
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
              <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
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
                const statusLc = (o.status || '').toLowerCase();
                const statusColor = statusLc.includes('deliver') ? 'text-emerald-700 bg-emerald-50' :
                  statusLc.includes('cancel') ? 'text-rose-700 bg-rose-50' :
                    statusLc.includes('ship') ? 'text-sky-700 bg-sky-50' :
                      'text-amber-700 bg-amber-50';
                return (
                  <li key={o.order_id} className="px-5 py-4" data-testid={`account-order-${o.order_id}`}>
                    <div className="flex items-center gap-3">
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
                          {o.delivery_timeline && ` · ${o.delivery_timeline}`}
                        </p>
                      </div>
                      <Link
                        to={`/track-order?orderId=${o.order_id}`}
                        data-testid={`account-track-${o.order_id}`}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        Track <ChevronRight size={13} />
                      </Link>
                    </div>
                    {/* Items summary */}
                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <p className="mt-2 ml-14 text-[11px] text-stone-500 truncate">
                        {o.items.map((it) => `${it.name || it.slug}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(' · ')}
                      </p>
                    )}
                    {/* Delhivery tracking link (if AWB generated) */}
                    {o.tracking_url && (
                      <a
                        href={o.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 ml-14 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-800"
                        data-testid={`account-delhivery-${o.order_id}`}
                      >
                        Open Delhivery tracking <ExternalLink size={11} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link to="/track-order" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-colors" data-testid="account-quick-track">
            <Truck size={16} className="text-emerald-700" />
            <div>
              <p className="text-xs font-black text-stone-900">Track Order</p>
              <p className="text-[10px] text-stone-500">Real-time status</p>
            </div>
          </Link>
          <Link to="/contact" className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-stone-200 px-4 py-3 hover:ring-emerald-300 transition-colors" data-testid="account-quick-support">
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
