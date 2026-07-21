import React from 'react';
import { Tags } from 'lucide-react';

const Categories = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Asset Categories</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage hardware classifications, badge symbols, and color themes
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        <Tags className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Categories Stub</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Category management grid with color palette selection (`Indigo`, `Blue`, `Teal`, `Purple`, etc.) will be implemented in Week 5.
        </p>
      </div>
    </div>
  );
};

export default Categories;
