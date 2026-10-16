import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import WarrantyBadge from '../ui/WarrantyBadge';
import Pill from '../ui/Pill';
import { ChevronRight, MapPin, Calendar, User } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import SelectCheckbox from './SelectCheckbox';

// With `onToggleSelect`, a checkbox sits over the card's top-left corner
// (beside the link, not inside it, so it never opens the asset).
export default function AssetCard({ asset, selectable = false, selected = false, onToggleSelect }) {
  const card = (
    <Link
      to={`/inventory/${asset.id}`}
      className={`group block h-full bg-surface border rounded-2xl hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all overflow-hidden flex flex-col ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-border/80'}`}
    >
      <div className="p-5 flex-1 space-y-4">
        {/* Header: Badge & Statuses */}
        <div className={`flex items-start justify-between gap-2 ${selectable ? 'pl-9' : ''}`}>
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            className="!w-10 !h-10 text-sm"
          />
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill status={asset.status} />
            <WarrantyBadge expiryDate={asset.warrantyExpiryDate} />
          </div>
        </div>

        {/* Title & Serial */}
        <div>
          <h3 className="font-bold text-primary truncate text-base mb-1.5 group-hover:text-accent transition-colors flex items-center gap-2">
            <span className="truncate">{asset.name}</span>
            {asset.assetType === 'client' && (
              <Pill tone="accent" className="shrink-0 uppercase tracking-wider mt-0.5">
                Client
              </Pill>
            )}
          </h3>
          <div className="inline-block bg-base border border-border/50 px-2 py-0.5 rounded text-xs font-mono text-secondary">
            {asset.serialNumber}
          </div>
        </div>

        {/* Purchase Date */}
        <div className="flex items-center gap-1.5 text-xs text-secondary mt-2">
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          {asset.purchaseDate ? (
            <span>Purchased <time dateTime={asset.purchaseDate}>{formatDate(asset.purchaseDate)}</time></span>
          ) : (
            <span>No purchase date</span>
          )}
        </div>
      </div>

      {/* Footer: Location, Assignee, and Chevron */}
      <div className="px-5 py-3.5 bg-base/40 border-t border-border/40 flex items-center justify-between gap-3 text-xs">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-secondary truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{asset.location || 'No location'}</span>
          </div>
          
          {asset.status === 'in-use' && (asset.assignee?.name || asset.assigneeName) && (
            <div className="flex items-center gap-1.5 text-primary truncate">
              <User className="w-3.5 h-3.5 shrink-0 text-info-blue" />
              <span className="truncate">{asset.assignee?.name || asset.assigneeName}</span>
            </div>
          )}
          {asset.status === 'in-use' && asset.assignedDate && (
            <div className="text-secondary truncate">
              Assigned <time dateTime={asset.assignedDate}>{formatDate(asset.assignedDate)}</time>
            </div>
          )}
        </div>
        
        <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center shrink-0 text-secondary group-hover:text-accent group-hover:bg-accent/10 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );

  if (!selectable) return card;
  return (
    <div className="relative">
      {card}
      <SelectCheckbox
        checked={selected}
        onChange={() => onToggleSelect(asset.id)}
        label={`Select ${asset.name}${asset.serialNumber ? ` (${asset.serialNumber})` : ''}`}
        className="absolute top-3 left-3 md:top-4 md:left-4 bg-surface/80"
      />
    </div>
  );
}
