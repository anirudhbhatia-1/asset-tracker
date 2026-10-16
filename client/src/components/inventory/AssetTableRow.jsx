import React, { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import StatusPill from '../ui/StatusPill';
import WarrantyBadge from '../ui/WarrantyBadge';
import Pill from '../ui/Pill';
import { ChevronRight, MapPin, User } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { onActivateKey } from '../../utils/a11y';
import SelectCheckbox from './SelectCheckbox';

// Columns that only appear on wider screens (kept in sync with AssetTable's
// header) so the table fits beside the sidebar without sideways scrolling.
const WIDE_ONLY = 'hidden 2xl:table-cell';
const FROM_XL = 'hidden xl:table-cell';
const FROM_LG = 'hidden lg:table-cell';

const stop = (e) => e.stopPropagation();

const AssetTableRow = memo(function AssetTableRow({ asset, selectable = false, selected = false, onToggleSelect }) {
  const navigate = useNavigate();
  const href = `/inventory/${asset.id}`;

  // The whole row opens the asset, except when the user is selecting text
  // (e.g. copying the serial number).
  const openAsset = () => {
    const selection = typeof window !== 'undefined' ? window.getSelection?.()?.toString() : '';
    if (selection) return;
    navigate(href);
  };

  return (
    <tr
      onClick={openAsset}
      onKeyDown={onActivateKey(() => navigate(href))}
      tabIndex={0}
      className={`${selected ? 'bg-accent/[0.06] hover:bg-accent/10' : 'hover:bg-raised/40'} transition-colors group cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2`}
    >
      {selectable && (
        // Clicking around the box selects too, never opens the asset.
        <td className="pl-2 pr-0 py-1.5 w-10" onClick={stop}>
          <SelectCheckbox
            checked={selected}
            onChange={() => onToggleSelect(asset.id)}
            label={`Select ${asset.name}${asset.serialNumber ? ` (${asset.serialNumber})` : ''}`}
          />
        </td>
      )}
      {/* Category Icon & Badge */}
      <td className={`${FROM_LG} px-3 py-3.5 whitespace-nowrap`}>
        <Badge
          badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
          color={asset.categoryColor}
          title={asset.categoryName || 'Category'}
        />
      </td>

      {/* Asset Name & Model */}
      <td className="px-3 py-3.5 max-w-[200px]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Below lg the category column is hidden; its badge sits here. */}
          <Badge
            badgeChar={asset.categoryBadgeChar || asset.categoryName || '?'}
            color={asset.categoryColor}
            title={asset.categoryName || 'Category'}
            className="lg:hidden"
          />
          <div className="min-w-0">
            <Link
              to={href}
              tabIndex={-1}
              onClick={stop}
              className="font-semibold text-primary group-hover:text-accent transition-colors block text-sm truncate"
            >
              {asset.name}
              {asset.assetType === 'client' && (
                <Pill tone="accent" className="ml-2 uppercase tracking-wider align-middle">
                  Client
                </Pill>
              )}
            </Link>
            {asset.model && <span className="text-xs text-secondary block truncate">{asset.model}</span>}
            {/* Below lg the Assigned To column is hidden; the name shows here. */}
            {asset.status === 'in-use' && asset.assigneeName && (
              <span className="lg:hidden text-xs text-secondary flex items-center gap-1 min-w-0">
                <User className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{asset.assigneeName}</span>
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Serial Number (Monospace per Design 2.2) */}
      <td className="px-3 py-3.5 whitespace-nowrap">
        <span
          title={asset.serialNumber}
          className="inline-block align-middle max-w-[150px] truncate font-mono text-xs text-secondary bg-surface/80 px-2 py-1 rounded border border-border/80 select-all"
        >
          {asset.serialNumber}
        </span>
      </td>

      {/* Status Pill */}
      <td className="px-3 py-3.5 whitespace-nowrap">
        <StatusPill status={asset.status} />
      </td>

      {/* Warranty countdown */}
      <td className={`${FROM_XL} px-3 py-3.5 whitespace-nowrap`}>
        <WarrantyBadge expiryDate={asset.warrantyExpiryDate} />
      </td>

      {/* Location */}
      <td className={`${WIDE_ONLY} px-3 py-3.5 whitespace-nowrap text-sm text-secondary`}>
        {asset.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span>{asset.location}</span>
          </span>
        ) : (
          <span className="text-secondary italic">—</span>
        )}
      </td>

      {/* Assigned To */}
      <td className={`${FROM_LG} px-3 py-3.5 whitespace-nowrap text-sm text-secondary`}>
        {asset.status === 'in-use' && asset.assigneeName ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-raised border border-border flex items-center justify-center text-secondary shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-primary block truncate max-w-[130px]">{asset.assigneeName}</span>
              {asset.assigneeDepartment && (
                <span className="text-[11px] text-secondary block truncate max-w-[130px]">{asset.assigneeDepartment}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-secondary italic">—</span>
        )}
      </td>

      {/* Assigned Date */}
      <td className={`${WIDE_ONLY} px-3 py-3.5 whitespace-nowrap text-xs text-secondary`}>
        {asset.status === 'in-use' && asset.assignedDate
          ? <time dateTime={asset.assignedDate}>{formatDate(asset.assignedDate)}</time>
          : <span className="text-secondary italic">—</span>}
      </td>

      {/* Actions */}
      <td className="px-3 py-3.5 whitespace-nowrap text-right text-sm font-medium">
        <Link
          to={href}
          tabIndex={-1}
          onClick={stop}
          aria-label={`Open ${asset.name}`}
          title="Open details"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-surface group-hover:bg-accent/20 text-secondary group-hover:text-accent border border-border group-hover:border-accent/40 transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
});

export default AssetTableRow;
