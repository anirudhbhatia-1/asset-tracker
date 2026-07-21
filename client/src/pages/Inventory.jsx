import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const Inventory = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Hardware Inventory</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage, filter, and assign company IT assets
          </p>
        </div>
        <Link
          to="/inventory/new"
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Asset</span>
        </Link>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Asset List Stub</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Full inventory data table with search, category filtering, status tabs (`All`, `Available`, `In Use`, `Retired`), and action menus will be implemented in Week 3.
        </p>
      </div>
    </div>
  );
};

export default Inventory;
