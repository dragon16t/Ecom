import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronLeft, Search, Filter, Download,
  Phone, MapPin, Calendar, IndianRupee, Truck, CheckCircle, X, Edit2, Save, ExternalLink, MessageCircle
} from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const navigate = useNavigate();
  const adminToken = getAdminToken();

  useEffect(() => {
    if (!adminToken) return;
    fetchOrders();
  }, [adminToken]);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/admin/orders`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem('adminToken');
        navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const createShipment = async (orderId) => {
    setUpdatingStatus(orderId);
    try {
      const res = await axios.post(
        `${API}/admin/shipping/create-shipment/${orderId}`,
        {},
        { headers: { 'X-Admin-Token': adminToken } }
      );
      if (res.data.success) {
        const awb = res.data.awb;
        setOrders(orders.map(o => o.order_id === orderId ? { ...o, awb_number: awb, shipping_provider: 'delhivery' } : o));
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, awb_number: awb, shipping_provider: 'delhivery' });
        }
        alert(`Delhivery shipment created · AWB: ${awb}`);
      } else {
        alert(`Failed to create shipment: ${res.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to create shipment: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingStatus(orderId);
    try {
      const res = await axios.put(`${API}/orders/${orderId}/status`, 
        { status: newStatus },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      if (res.data.success) {
        // Update local state
        setOrders(orders.map(order => 
          order.order_id === orderId 
            ? { ...order, status: newStatus }
            : order
        ));
        
        // Update selected order if open
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
        
        // Show success message
        const emailMsg = res.data.email_sent ? ' (Email sent to customer)' : '';
        alert(`Order ${orderId} marked as ${newStatus}${emailMsg}`);
      }
    } catch (err) {
      alert('Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateOrderEmail = async (orderId, email) => {
    try {
      const res = await axios.put(
        `${API}/orders/${orderId}/email`,
        { email },
        { headers: { 'X-Admin-Token': adminToken } }
      );
      
      if (res.data.success) {
        // Update local state
        setOrders(orders.map(order => 
          order.order_id === orderId 
            ? { ...order, email }
            : order
        ));
        
        // Update selected order
        if (selectedOrder?.order_id === orderId) {
          setSelectedOrder({ ...selectedOrder, email });
        }
        
        setEditingEmail(false);
        setNewEmail('');
        alert('Email updated successfully!');
      }
    } catch (err) {
      alert('Failed to update email');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone?.includes(searchTerm);
    const matchesFilter = filterPayment === 'all' || order.payment_method === filterPayment;
    return matchesSearch && matchesFilter;
  });

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  const codOrders = filteredOrders.filter(o => o.payment_method === 'COD').length;
  const prepaidOrders = filteredOrders.filter(o => o.payment_method !== 'COD').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="lg:hidden text-gray-600">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-500 hidden lg:block">
                View and manage customer orders
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            <p className="text-sm text-gray-500">Total Orders</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Revenue</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-blue-600">{prepaidOrders}</p>
            <p className="text-sm text-gray-500">Prepaid</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-yellow-600">{codOrders}</p>
            <p className="text-sm text-gray-500">COD</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by order ID, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              data-testid="search-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'all' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterPayment('Prepaid')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'Prepaid' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              Prepaid
            </button>
            <button
              onClick={() => setFilterPayment('COD')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                filterPayment === 'COD' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              COD
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">Orders will appear here once customers place them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div 
                key={order.order_id} 
                className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedOrder(order)}
                data-testid={`order-item-${order.order_id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{order.order_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.payment_method === 'COD' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {order.payment_method}
                      </span>
                    </div>
                    <p className="text-gray-600">{order.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{order.amount}</p>
                    <p className="text-sm text-gray-400">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short'
                      }) : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-4 text-sm text-gray-500 flex-wrap">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 font-mono text-gray-700 font-medium">
                      <Phone size={14} />
                      +91 {order.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {order.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:+91${order.phone}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors"
                      data-testid={`list-call-btn-${order.order_id}`}
                    >
                      <Phone size={12} />
                      Call
                    </a>
                    {!order.awb_number && (
                      <button
                        onClick={(e) => { e.stopPropagation(); createShipment(order.order_id); }}
                        disabled={updatingStatus === order.order_id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                        data-testid={`list-ship-btn-${order.order_id}`}
                      >
                        <Truck size={12} />
                        {updatingStatus === order.order_id ? '...' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Order Details</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Order ID</span>
                <span className="font-bold">{selectedOrder.order_id}</span>
              </div>

              {/* Items + quantity — what the customer actually ordered */}
              {(Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0) || selectedOrder.combo_id ? (
                <div className="p-4 bg-white border border-gray-200 rounded-xl" data-testid="admin-order-items">
                  <p className="text-gray-600 text-sm font-medium mb-3">Items Ordered</p>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm" data-testid={`admin-order-item-${idx}`}>
                        <span className="text-gray-900 flex-1 pr-2">
                          {it.name || it.short_name || it.slug || 'Product'}
                          <span className="text-gray-400"> × {it.quantity || 1}</span>
                        </span>
                        {typeof it.price !== 'undefined' && (
                          <span className="text-gray-700 font-medium">₹{(it.price || 0) * (it.quantity || 1)}</span>
                        )}
                      </div>
                    ))}
                    {selectedOrder.combo_id && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-900">Combo: {selectedOrder.combo_id} <span className="text-gray-400">× 1</span></span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total Quantity</span>
                    <span className="font-bold text-gray-900">
                      {(selectedOrder.items || []).reduce((s, i) => s + (i.quantity || 1), 0) + (selectedOrder.combo_id ? 1 : 0)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Amount</span>
                <span className="font-bold text-green-600">₹{selectedOrder.amount}</span>
              </div>
              
              {/* Show full COD amount due (no advance/balance split — site is COD-only) */}
              {(selectedOrder.payment_method === 'COD' || selectedOrder.payment_method === 'COD (Advance Paid)') && (
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <span className="text-yellow-700">Pay at Delivery</span>
                  <span className="font-bold text-yellow-700">₹{selectedOrder.amount}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Payment</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedOrder.payment_method === 'COD' 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedOrder.payment_method}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedOrder.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  selectedOrder.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                  selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedOrder.status?.charAt(0).toUpperCase() + selectedOrder.status?.slice(1) || 'Confirmed'}
                </span>
              </div>
              
              {/* Delhivery Tracking Info */}
              {selectedOrder.awb_number ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Delhivery Tracking</span>
                    <span className="text-blue-600 font-mono text-sm">{selectedOrder.awb_number}</span>
                  </div>
                  <a 
                    href={`https://www.delhivery.com/track/package/${selectedOrder.awb_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm underline flex items-center gap-1"
                  >
                    <ExternalLink size={14} />
                    Track on Delhivery
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-amber-800 font-semibold text-sm">No shipment yet</p>
                      <p className="text-amber-700/80 text-xs mt-0.5">Push this order to Delhivery to generate an AWB.</p>
                    </div>
                    <button
                      onClick={() => createShipment(selectedOrder.order_id)}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                      data-testid="create-shipment-btn"
                    >
                      <Truck size={16} />
                      {updatingStatus === selectedOrder.order_id ? 'Creating…' : 'Send to Delhivery'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Status Update Buttons */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl">
                <p className="text-gray-700 font-medium mb-3">Update Status:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status !== 'shipped' && selectedOrder.status !== 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.order_id, 'shipped')}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                      data-testid="mark-shipped-btn"
                    >
                      <Truck size={18} />
                      {updatingStatus === selectedOrder.order_id ? 'Updating...' : 'Mark Shipped'}
                    </button>
                  )}
                  
                  {selectedOrder.status !== 'delivered' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered')}
                      disabled={updatingStatus === selectedOrder.order_id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                      data-testid="mark-delivered-btn"
                    >
                      <CheckCircle size={18} />
                      {updatingStatus === selectedOrder.order_id ? 'Updating...' : 'Mark Delivered'}
                    </button>
                  )}
                  
                  {selectedOrder.status === 'delivered' && (
                    <span className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle size={18} />
                      Order Completed
                    </span>
                  )}
                </div>
                {selectedOrder.email && (
                  <p className="text-xs text-gray-500 mt-2">
                    📧 Customer will receive email notification at: {selectedOrder.email}
                  </p>
                )}
                {!selectedOrder.email && (
                  <p className="text-xs text-orange-500 mt-2">
                    ⚠️ No email provided - SMS/WhatsApp notification only
                  </p>
                )}
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-gray-600 mb-2">Customer</p>
                <p className="font-semibold">{selectedOrder.name}</p>

                {/* Phone with one-tap Call (opens phone dialer) + WhatsApp */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-gray-800 text-base font-semibold tracking-wide" data-testid="customer-phone-text">+91 {selectedOrder.phone}</span>
                  <a
                    href={`tel:+91${selectedOrder.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors"
                    data-testid="customer-call-btn"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/91${selectedOrder.phone}?text=${encodeURIComponent('Hi ' + (selectedOrder.name?.split(' ')[0] || '') + ', this is Celesta Glow regarding your order ' + selectedOrder.order_id + '.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs transition-colors"
                    data-testid="customer-whatsapp-btn"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                </div>
                
                {/* Email with edit option */}
                <div className="mt-2">
                  {editingEmail ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter email"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => updateOrderEmail(selectedOrder.order_id, newEmail)}
                        className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => { setEditingEmail(false); setNewEmail(''); }}
                        className="p-1.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {selectedOrder.email ? (
                        <p className="text-gray-600">{selectedOrder.email}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">No email provided</p>
                      )}
                      <button
                        onClick={() => { setEditingEmail(true); setNewEmail(selectedOrder.email || ''); }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Edit email"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-gray-600 mb-2">Delivery Address</p>
                <p>{selectedOrder.house_number}, {selectedOrder.area}</p>
                <p>{selectedOrder.state} - {selectedOrder.pincode}</p>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Delivery Timeline</span>
                <span>{selectedOrder.delivery_timeline || 'N/A'}</span>
              </div>
            </div>
            
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around py-2">
          <Link to="/admin/dashboard" className="flex flex-col items-center p-2 text-gray-500">
            <Package size={20} />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link to="/admin/blogs" className="flex flex-col items-center p-2 text-gray-500">
            <Package size={20} />
            <span className="text-xs mt-1">Blogs</span>
          </Link>
          <Link to="/admin/orders" className="flex flex-col items-center p-2 text-green-600">
            <Package size={20} />
            <span className="text-xs mt-1">Orders</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default AdminOrders;
