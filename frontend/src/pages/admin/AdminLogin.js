import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getAdminToken, setAdminToken, clearAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [masterReset, setMasterReset] = useState('');
  const navigate = useNavigate();

  // Check if already logged in on mount
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      // Token exists, redirect to dashboard
      // The dashboard will validate if token is still valid
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { password };
      if (showRecovery && masterReset) payload.master_reset = masterReset;
      const res = await axios.post(`${API}/admin/login`, payload);
      if (res.data.success) {
        setAdminToken(res.data.token);
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(
        showRecovery
          ? 'Recovery failed. Confirm the env-seed value matches ADMIN_PASSWORD on your server.'
          : 'Invalid password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-gray-500 text-sm mt-2">Celesta Glow Content Management</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
            {/* Hidden username for password managers (helps tablet/mobile autofill) */}
            <input type="text" name="username" value="admin" autoComplete="username" readOnly hidden />
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  style={{ fontSize: '16px' }}
                  placeholder="Enter admin password"
                  required
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="go"
                  data-testid="admin-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 active:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              data-testid="admin-login-btn"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Forgot / recovery flow — reveals a second field that lets the
                merchant reset their custom password using the env-seed value.
                Hidden by default so regular sign-ins stay clean. */}
            {!showRecovery ? (
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="w-full text-xs text-gray-500 hover:text-gray-700 -mt-3"
                data-testid="admin-forgot-password"
              >
                Forgot password?
              </button>
            ) : (
              <div className="pt-2 border-t border-dashed border-gray-200 space-y-2">
                <p className="text-[11px] text-gray-500 leading-snug">
                  <b>Recovery mode.</b> Enter the <code>ADMIN_PASSWORD</code> env-seed
                  value from your server config. This wipes the DB-stored custom
                  password so you can sign in with the value in the first field.
                </p>
                <input
                  type="password"
                  value={masterReset}
                  onChange={(e) => setMasterReset(e.target.value)}
                  placeholder="ADMIN_PASSWORD env-seed value"
                  className="w-full px-4 py-2.5 border border-amber-200 rounded-xl bg-amber-50/40 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                  data-testid="admin-master-reset-input"
                />
                <button
                  type="button"
                  onClick={() => { setShowRecovery(false); setMasterReset(''); }}
                  className="text-[11px] text-gray-500 hover:text-gray-700"
                >
                  Cancel recovery
                </button>
              </div>
            )}
          </form>

          {/* Back to Site */}
          <div className="mt-6 text-center">
            <a 
              href="/" 
              className="text-green-500 text-sm hover:underline"
              data-testid="back-to-site-link"
            >
              ← Back to Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
