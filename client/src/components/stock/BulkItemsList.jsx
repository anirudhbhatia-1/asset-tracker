import React from 'react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { lowStockText, stockCountLabel } from '../../utils/stock';
import { onActivateKey } from '../../utils/a11y';
import { AlertTriangle, MapPin, UserPlus } from 'lucide-react';

export function LowStockBadge({ item }) {
  const text = lowStockText(item);
  if (!text) return null;
  return (
    <span title={text} className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full whitespace-nowrap">
      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
      {item.inStock <= 0 ? 'Out of stock' : 'Low stock'}
    </span>
  );
}

/**
 * Bulk items as cards on phones and a table from tablet width up. Selecting
 * an item calls onOpen(item); "Assign" (with canAssign) calls onAssign(item)
 * and is disabled when nothing is in stock.
 */
export default function BulkItemsList({ items = [], totalCount, canAssign = false, onOpen, onAssign }) {
  const assignButton = (item) => canAssign && (
    <Button
      size="sm"
      variant="secondary"
      disabled={item.inStock === 0}
      title={item.inStock === 0 ? 'Nothing in stock to give out' : `Assign ${item.name}`}
      onClick={(e) => { e.stopPropagation(); onAssign?.(item); }}
    >
      <UserPlus className="w-3.5 h-3.5 text-accent" />
      <span>Assign</span>
    </Button>
  );

  return (
    <>
      {/* Phone: cards */}
      <ul className="md:hidden space-y-3" aria-label="Bulk items">
        {items.map((item) => (
          <li key={item.id}>
            <div
              onClick={() => onOpen?.(item)}
              className="bg-surface border border-border rounded-xl p-3.5 shadow-sm cursor-pointer hover:bg-raised/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Badge badgeChar={item.categoryBadgeChar || item.categoryName || item.name} color={item.categoryColor} title={item.categoryName || 'No category'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen?.(item); }}
                      className="text-sm font-semibold text-primary hover:text-accent text-left break-words cursor-pointer"
                    >
                      {item.name}
                    </button>
                    <LowStockBadge item={item} />
                  </div>
                  {item.location && (
                    <p className="text-xs text-secondary flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" aria-hidden="true" />{item.location}
                    </p>
                  )}
                  <p className="text-xs text-secondary mt-1.5">
                    In stock <strong className="font-mono text-primary">{stockCountLabel(item)}</strong>
                    <span className="mx-1.5">·</span>
                    Given out <strong className="font-mono text-primary">{item.givenOut}</strong>
                  </p>
                </div>
              </div>
              {canAssign && <div className="mt-3 flex justify-end">{assignButton(item)}</div>}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden md:block bg-surface rounded-xl border border-border/80 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Bulk items. Select a row to see who has them and the history.</caption>
          <thead className="bg-base/60 border-b border-border text-xs text-secondary uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">Name</th>
              <th scope="col" className="px-5 py-3.5 font-semibold">Location</th>
              <th scope="col" className="px-5 py-3.5 font-semibold">In stock / Total</th>
              <th scope="col" className="px-5 py-3.5 font-semibold">Given out</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((item) => (
              <tr
                key={item.id}
                tabIndex={0}
                onClick={() => onOpen?.(item)}
                onKeyDown={onActivateKey(() => onOpen?.(item))}
                aria-label={`${item.name}. Open details`}
                className="hover:bg-raised/40 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Badge badgeChar={item.categoryBadgeChar || item.categoryName || item.name} color={item.categoryColor} title={item.categoryName || 'No category'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary">{item.name}</span>
                        <LowStockBadge item={item} />
                      </div>
                      {item.categoryName && <span className="text-xs text-secondary">{item.categoryName}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-secondary">{item.location || '—'}</td>
                <td className="px-5 py-3 font-mono text-primary">{stockCountLabel(item)}</td>
                <td className="px-5 py-3 font-mono text-secondary">{item.givenOut}</td>
                <td className="px-5 py-3 text-right">{assignButton(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-surface/90 border-t border-border/80 text-xs text-secondary">
          Showing {items.length} of {totalCount ?? items.length} bulk items · not counted in asset totals
        </div>
      </div>
    </>
  );
}
