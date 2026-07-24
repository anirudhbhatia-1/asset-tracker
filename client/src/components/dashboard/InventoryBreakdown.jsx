import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { Layers, ArrowRight } from 'lucide-react';

export default function InventoryBreakdown({ breakdown = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-border/60 shadow-sm animate-pulse h-80">
        <div className="h-6 w-48 bg-raised rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-28 bg-raised rounded" />
                <div className="h-4 w-12 bg-raised rounded" />
              </div>
              <div className="h-2 w-full bg-raised rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];

  return (
    <div className="bg-surface rounded-xl p-6 border border-border/60 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Layers className="w-5 h-5 text-accent" />
          <h3 className="text-base font-semibold text-primary">Inventory Breakdown by Category</h3>
        </div>

        {safeBreakdown.length === 0 ? (
          <div className="text-center py-12 text-secondary text-sm">No categorical asset data available.</div>
        ) : (
          <div className="space-y-4.5">
            {safeBreakdown.map((item) => (
              <div key={item.id} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <Badge badgeChar={item.badgeChar} color={item.color} className="!w-6 !h-6 !text-[11px]" />
                    <span className="font-medium text-primary">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <Link
                      to={`/inventory?categoryId=${item.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all opacity-90 group-hover:opacity-100 text-[11px]"
                      title={`View all ${item.name} assets`}
                    >
                      <span>View items</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <span className="text-secondary">{item.count} items</span>
                    <span className="font-semibold text-secondary w-10 text-right">{item.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-raised/40 h-2 rounded-full overflow-hidden">
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

      <div className="mt-6 pt-4 border-t border-border/50 flex justify-between items-center text-xs text-secondary">
        <span>Total Categories: {safeBreakdown.length}</span>
        <span className="text-accent font-medium">100% Accounted</span>
      </div>
    </div>
  );
}
