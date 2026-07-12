import React from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, ChevronLeft } from 'lucide-react';
import { getAdminToken } from '../../utils/adminAuth';

// Standalone page — re-exports the multi-warehouse UI that used to live inside
// AdminExtras so warehouses have their own top-level sidebar entry.
import { WarehouseTab } from './AdminExtras'; // named export added below

export default function AdminWarehouses() {
  const token = getAdminToken();
  const auth = { headers: { 'X-Admin-Token': token } };
  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="lg:hidden text-gray-600"><ChevronLeft size={22} /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Warehouse size={22} className="text-emerald-600" /> Warehouses
            </h1>
            <p className="text-sm text-gray-500 hidden lg:block">
              Multi-warehouse roster. Coordinates + radius drive Instant Delivery on the checkout map.
            </p>
          </div>
        </div>
      </header>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <WarehouseTab auth={auth} />
      </div>
    </div>
  );
}
