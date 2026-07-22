import React from 'react';
import Badge from '../ui/Badge';
import { Layers } from 'lucide-react';

export default function InventoryBreakdown({ breakdown = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/60 shadow-sm animate-pulse h-80">
        <div className="h-6 w-48 bg-slate-700 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-28 bg-slate-700 rounded" />
                <div className="h-4 w-12 bg-slate-700 rounded" />
              </div>
              <div className="h-2 w-full bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/60 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-slate-100">Inventory Breakdown by Category</h3>
        </div>

        {breakdown.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No categorical asset data available.</div>
        ) : (
          <div className="space-y-4.5">
            {breakdown.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <Badge badgeChar={item.badgeChar} color={item.color} className="!w-6 !h-6 !text-[11px]" />
                    <span className="font-medium text-slate-200">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-400">{item.count} items</span>
                    <span className="font-semibold text-slate-300 w-10 text-right">{item.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700/40 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ backgroundColor: item.color || '#6366F1', width: `${Math.max(item.percentage, 4)}%` }}
                    className="h-full rounded-full transition-all duration-500 ease-out"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-400">
        <span>Total Categories: {breakdown.length}</span>
        <span className="text-indigo-400 font-medium">100% Accounted</span>
      </div>
    </div>
  );
}
