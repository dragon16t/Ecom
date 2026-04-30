import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, DollarSign, MousePointer, ShoppingBag, 
  ArrowLeft, Copy, CheckCircle, RefreshCw, Gift,
  TrendingUp, Clock, ExternalLink, CreditCard, Eye, X
} from 'lucide-react';
import { useAdminAuth } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminReferrals() {
  const navigate = useNavigate();
  const { adminToken, isLoading: authLoading, isAuthenticated } = useAdminAuth(navigate);
  const [referrals, setReferrals] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [testReferralCode, setTestReferralCode] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);

  const fetchReferrals = async (token) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/referrals`, {
        headers: { 'X-Admin-Token': token }
      });
      setReferrals(res.data.referrals || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && adminToken) {
      fetchReferrals(adminToken);
    }
  }, [authLoading, isAuthenticated, adminToken]);

  const handleTestPurchase = async () => {
    if (!testReferralCode) return;
    
    try {
      const res = await axios.post(
        `${API}/admin/referrals/test-purchase?referral_code=${testReferralCode}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      setTestResult(res.data);
      if (res.data.success) {
        fetchReferrals(adminToken); // Refresh data
      }
    } catch (err) {
      setTestResult({ success: false, error: 'Test failed' });
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(`https://celestaglow.com?ref=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const viewReferralDetails = async (referralCode) => {
    try {
      const res = await axios.get(`${API}/admin/referrals/${referralCode}`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setSelectedReferral(res.data);
    } catch (err) {
      console.error('Failed to fetch referral details:', err);
    }
  };

  const markOrderAsPaid = async (referralCode, orderId) => {
    setProcessingPayment(orderId);
    try {
      await axios.post(
        `${API}/admin/referrals/mark-order-paid?referral_code=${referralCode}&order_id=${orderId}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      // Refresh both the selected referral and the main list
      await viewReferralDetails(referralCode);
      await fetchReferrals(adminToken);
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    } finally {
      setProcessingPayment(null);
    }
  };

  const markAllPending = async (referralCode, pendingAmount) => {
    setProcessingPayment(referralCode);
    try {
      await axios.post(
        `${API}/admin/referrals/mark-paid?referral_code=${referralCode}&amount=${pendingAmount}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      await fetchReferrals(adminToken);
      if (selectedReferral) {
        await viewReferralDetails(referralCode);
      }
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    } finally {
      setProcessingPayment(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Referral Program</h1>
              <p className="text-sm text-gray-500">Track referrals and earnings</p>
            </div>
          </div>
          <button
            onClick={() => fetchReferrals(adminToken)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_referrers || 0}</p>
                <p className="text-xs text-gray-500">Total Referrers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_clicks || 0}</p>
                <p className="text-xs text-gray-500">Link Clicks</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_purchases || 0}</p>
                <p className="text-xs text-gray-500">Referral Purchases</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">₹{summary.total_earnings || 0}</p>
                <p className="text-xs text-gray-500">Total Earnings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Section */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-green-500" />
            Test Referral Purchase
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Simulate a purchase through a referral link to test the system
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testReferralCode}
              onChange={(e) => setTestReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter referral code (e.g., CG12AB34)"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <button
              onClick={handleTestPurchase}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600"
            >
              Test Purchase
            </button>
          </div>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.success 
                ? `✅ Test purchase recorded! ₹${testResult.earnings_added} added to ${testResult.referrer_name}'s earnings.`
                : `❌ ${testResult.error || 'Test failed'}`
              }
            </div>
          )}
        </div>

        {/* Referrals Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Gift size={18} className="text-purple-500" />
              All Referrers ({referrals.length})
            </h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No referrers yet</p>
              <p className="text-sm">Referral links are generated after each order</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Referrer</th>
                    <th className="px-4 py-3 text-left">Referral Link</th>
                    <th className="px-4 py-3 text-center">Clicks</th>
                    <th className="px-4 py-3 text-center">Purchases</th>
                    <th className="px-4 py-3 text-right">Earnings</th>
                    <th className="px-4 py-3 text-right">Pending</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referrals.map((ref, idx) => (
                    <tr key={ref.referral_code || `ref-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{ref.referrer_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{ref.referrer_phone}</p>
                          <p className="text-xs text-gray-400">{formatDate(ref.created_at)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono truncate max-w-[180px]">
                            celestaglow.com?ref={ref.referral_code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(ref.referral_code)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-green-600"
                            title="Copy link"
                          >
                            {copiedCode === ref.referral_code ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-blue-600 font-medium">{ref.total_referrals || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-medium">{ref.successful_purchases || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-gray-900">₹{ref.total_earnings || 0}</span>
                        {ref.earnings_paid > 0 && (
                          <p className="text-xs text-green-600">₹{ref.earnings_paid} paid</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(ref.earnings_pending || 0) > 0 ? (
                          <span className="text-amber-600 font-bold">₹{ref.earnings_pending}</span>
                        ) : (
                          <span className="text-gray-400">₹0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => viewReferralDetails(ref.referral_code)}
                            className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          {(ref.earnings_pending || 0) > 0 && (
                            <button
                              onClick={() => markAllPending(ref.referral_code, ref.earnings_pending)}
                              disabled={processingPayment === ref.referral_code}
                              className="p-2 hover:bg-green-50 rounded-lg text-gray-500 hover:text-green-600 disabled:opacity-50"
                              title="Mark all pending as paid"
                            >
                              {processingPayment === ref.referral_code ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <CreditCard size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-r from-purple-50 to-green-50 rounded-xl p-4 border border-purple-100">
          <h4 className="font-semibold text-gray-900 mb-2">How Referral Program Works</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Customer buys → Gets unique referral link via email</li>
            <li>• Friend uses link → Gets ₹50 discount at checkout</li>
            <li>• Friend's order delivered → Original customer earns ₹100 cashback</li>
            <li>• Earnings tracked here → Pay manually or integrate UPI</li>
          </ul>
        </div>
      </div>

      {/* Referral Details Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-900">{selectedReferral.referrer_name}</h3>
                <p className="text-sm text-gray-500">{selectedReferral.referrer_phone}</p>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Referral Link */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800 mb-2">Referral Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded-lg text-sm font-mono text-green-700 border border-green-200">
                    https://celestaglow.com?ref={selectedReferral.referral_code}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedReferral.referral_code)}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    {copiedCode === selectedReferral.referral_code ? <CheckCircle size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">₹{selectedReferral.total_earnings || 0}</p>
                  <p className="text-xs text-gray-500">Total Earnings</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">₹{selectedReferral.earnings_paid || 0}</p>
                  <p className="text-xs text-gray-500">Paid</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">₹{selectedReferral.earnings_pending || 0}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>

              {/* Referred Orders */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Referred Orders ({selectedReferral.referred_orders?.length || 0})</h4>
                {selectedReferral.referred_orders && selectedReferral.referred_orders.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReferral.referred_orders.map((order, idx) => (
                      <div key={order.order_id || `order-${idx}`} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{order.buyer_name}</p>
                          <p className="text-xs text-gray-500">Order: {order.order_id}</p>
                          <p className="text-xs text-gray-400">{formatDate(order.purchased_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₹{order.order_amount}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {order.delivery_status === 'delivered' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Delivered</span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Pending Delivery</span>
                            )}
                            {order.cashback_status === 'paid' ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle size={10} /> ₹100 Paid
                              </span>
                            ) : order.cashback_status === 'ready_to_pay' ? (
                              <button
                                onClick={() => markOrderAsPaid(selectedReferral.referral_code, order.order_id)}
                                disabled={processingPayment === order.order_id}
                                className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 flex items-center gap-1 disabled:opacity-50"
                              >
                                {processingPayment === order.order_id ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <CreditCard size={10} />
                                )}
                                Pay ₹100
                              </button>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Awaiting Delivery</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No referred orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReferrals;
