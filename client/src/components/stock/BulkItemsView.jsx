import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStock } from '../../hooks/useStock';
import Button from '../ui/Button';
import { controlClass } from '../ui/fieldStyles';
import EmptyState from '../ui/EmptyState';
import { SkeletonTable } from '../ui/Skeleton';
import StockItemModal from './StockItemModal';
import StockAssignModal from './StockAssignModal';
import StockDetailsModal from './StockDetailsModal';
import BulkItemsList from './BulkItemsList';
import { filterStockItems } from '../../utils/stock';
import { Package, Plus, Search } from 'lucide-react';

/**
 * Inventory's "Bulk items" view: things without serial numbers kept as a
 * count. `createOpen` / `onCreateClose` are driven by the page header's
 * "Add bulk item" button; `search` / `onSearchChange` filter by name.
 */
export default function BulkItemsView({ createOpen, onCreateOpen, onCreateClose, search, onSearchChange }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('assets:create');
  const canAssign = hasPermission('assets:assign');
  const stock = useStock({ initialLoad: true });
  const { items, loading, loaded, error, fetchItems, createItem, assignStock } = stock;

  const [detailsId, setDetailsId] = useState(null);

  // Deep link (e.g. from global search): ?view=bulk&item=<id> opens that
  // item's details; closing them drops the parameter.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedItemId = searchParams.get('item');
  useEffect(() => {
    if (linkedItemId && /^\d+$/.test(linkedItemId)) setDetailsId(Number(linkedItemId));
  }, [linkedItemId]);
  const closeDetails = () => {
    setDetailsId(null);
    if (searchParams.has('item')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('item');
        return next;
      }, { replace: true });
    }
  };
  const [assignItem, setAssignItem] = useState(null);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const visibleItems = useMemo(() => filterStockItems(items, search), [items, search]);
  const noItemsYet = loaded && !loading && !error && items.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search bulk items by name"
          placeholder="Search bulk items by name…"
          className={`${controlClass()} pl-10 pr-4`}
        />
      </div>

      {error && (
        <div role="alert" className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => fetchItems()} className="underline text-xs hover:text-primary cursor-pointer">Retry</button>
        </div>
      )}

      {(!loaded || loading) && items.length === 0 && !error ? (
        <SkeletonTable rows={4} />
      ) : noItemsYet ? (
        <EmptyState
          icon={Package}
          title="No bulk items yet"
          description="Items without serial numbers, like bags or cables, kept as a count. Giving one to a person lowers what is in stock; a return puts it back."
        >
          {canCreate && (
            <Button onClick={onCreateOpen}>
              <Plus className="w-4 h-4" />
              <span>Add bulk item</span>
            </Button>
          )}
        </EmptyState>
      ) : !error && visibleItems.length === 0 ? (
        <EmptyState
          title="No bulk items match"
          description={`Nothing named like "${search}".`}
          actionText="Clear search"
          onAction={() => onSearchChange('')}
        />
      ) : !error && (
        <BulkItemsList
          items={visibleItems}
          totalCount={items.length}
          canAssign={canAssign}
          onOpen={(item) => setDetailsId(item.id)}
          onAssign={setAssignItem}
        />
      )}

      <StockItemModal
        isOpen={createOpen}
        onClose={onCreateClose}
        onSave={createItem}
      />

      <StockAssignModal
        isOpen={Boolean(assignItem)}
        item={assignItem}
        onClose={() => setAssignItem(null)}
        onAssign={(payload, name) => assignStock(assignItem.id, payload, name)}
      />

      <StockDetailsModal
        isOpen={Boolean(detailsId)}
        itemId={detailsId}
        onClose={closeDetails}
        actions={stock}
      />
    </div>
  );
}
