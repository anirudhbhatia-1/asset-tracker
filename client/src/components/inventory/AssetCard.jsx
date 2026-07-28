import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import { ChevronRight, MapPin, Calendar, User } from 'lucide-react';
import { getWarrantyStatus } from '../../utils/formatters';

export default function AssetCard({ asset }) {
  const warrantyStatus = getWarrantyStatus(asset.warrantyExpiryDate);

  return (
    <Link
      to={`/inventory/${asset.id}`}
      className="group block bg-surface border border-border/80 rounded-2xl hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all overflow-hidden flex flex-col"
    >
      <div className="p-5 flex-1 space-y-4">
        {/* Header: Badge & Statuses */}
        <div className="flex items-start justify-between gap-2">
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            className="!w-10 !h-10 text-sm"
          />
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill status={asset.status} />
            <StatusPill status={warrantyStatus} />
          </div>
        </div>

        {/* Title & Serial */}
        <div>
          <h3 className="font-bold text-primary truncate text-base mb-1.5 group-hover:text-accent transition-colors">
            {asset.name}
          </h3>
          <div className="inline-block bg-base border border-border/50 px-2 py-0.5 rounded text-xs font-mono text-secondary">
            {asset.serialNumber}
          </div>
        </div>

        {/* Purchase Date */}
        <div className="flex items-center gap-1.5 text-xs text-secondary mt-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>{asset.purchaseDate || 'No purchase date'}</span>
        </div>
      </div>

      {/* Footer: Location, Assignee, and Chevron */}
      <div className="px-5 py-3.5 bg-base/40 border-t border-border/40 flex items-center justify-between gap-3 text-xs">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-secondary truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{asset.location || 'No location'}</span>
          </div>
          
          {asset.status === 'in-use' && asset.assignee && (
            <div className="flex items-center gap-1.5 text-primary truncate">
              <User className="w-3.5 h-3.5 shrink-0 text-info-blue" />
              <span className="truncate">{asset.assignee.name}</span>
            </div>
          )}
        </div>
        
        <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center shrink-0 text-secondary group-hover:text-accent group-hover:bg-accent/10 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
