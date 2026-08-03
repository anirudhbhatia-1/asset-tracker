import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ExternalLink } from 'lucide-react';

export default function LinkedAccessoriesCard({ children: items, parentAsset }) {
  // parentAsset = the parent this asset belongs to (if this IS a sub-asset)
  if (parentAsset && parentAsset.id) {
    return (
      <div className="bg-surface border border-accent/30 rounded-2xl p-5 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
          <Package className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Belongs to Parent Asset</p>
          <Link
            to={`/inventory/${parentAsset.id}`}
            className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1 mt-1"
          >
            <span>{parentAsset.name}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <p className="text-xs text-secondary mt-1">
            This accessory is automatically assigned and returned together with its parent asset. Lifecycle actions are managed on the parent asset profile.
          </p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-surface border border-border/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/80 bg-base/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4.5 h-4.5 text-accent" />
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Linked Accessories ({items.length})</h3>
        </div>
        <span className="text-xs text-secondary font-medium">Sub-assets</span>
      </div>

      <div className="divide-y divide-border/60">
        {items.map((sub) => (
          <Link
            key={sub.id}
            to={`/inventory/${sub.id}`}
            className="flex items-center gap-4 px-6 py-3.5 hover:bg-raised/30 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-base border border-border flex items-center justify-center text-secondary group-hover:text-accent group-hover:border-accent/40 transition-colors shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-primary group-hover:text-accent transition-colors truncate">
                {sub.name}
              </div>
              <div className="text-xs text-secondary font-mono mt-0.5">
                SN: {sub.serialNumber} {sub.model ? `· ${sub.model}` : ''}
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
