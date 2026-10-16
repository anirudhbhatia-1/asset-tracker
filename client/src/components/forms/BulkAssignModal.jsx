import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { X, Loader2, Package, Search, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { getAssets, bulkAssignAssets } from '../../api/assetsApi';
import toast from 'react-hot-toast';
import useFocusTrap from '../../hooks/useFocusTrap';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { Textarea } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';

export default function BulkAssignModal({ isOpen, onClose, employee, onSuccess }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setNote('');
      setSearch('');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await getAssets({ status: 'available', assetType: 'company' });
        setAssets(res.data?.data || []);
      } catch {
        toast.error('Failed to load available assets');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.serialNumber?.toLowerCase().includes(q) ||
      a.model?.toLowerCase().includes(q)
    );
  }, [assets, search]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const asset of filtered) {
      const cat = asset.categoryName || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(asset);
    }
    return groups;
  }, [filtered]);

  const toggleAsset = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat) => {
    const catAssets = grouped[cat] || [];
    const allSelected = catAssets.every(a => selectedIds.has(a.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      catAssets.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id));
      return next;
    });
  };

  const toggleCollapse = (cat) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      toast.error('Select at least one asset');
      return;
    }
    setSubmitting(true);
    try {
      await bulkAssignAssets(employee.id, [...selectedIds], note.trim() || null);
      toast.success(`${selectedIds.size} asset${selectedIds.size > 1 ? 's' : ''} assigned to ${employee.name}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign assets');
    } finally {
      setSubmitting(false);
    }
  };

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen && !!employee, onClose);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-base/75 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-primary">Assign Hardware</h2>
            <p className="text-xs text-secondary mt-0.5">
              Select available assets to assign to <span className="font-medium text-primary">{employee.name}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-3 sm:p-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, serial number, or model…"
              className={`${controlClass()} pl-9 pr-4`}
            />
          </div>
          {selectedIds.size > 0 && (
            <p className="text-xs text-accent font-medium mt-2">
              {selectedIds.size} asset{selectedIds.size > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-3 text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span className="text-sm">Loading available assets…</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState size="sm" icon={Package} title="No available assets found." description="" />
          ) : (
            Object.entries(grouped).map(([cat, catAssets]) => {
              const allSelected = catAssets.every(a => selectedIds.has(a.id));
              const someSelected = catAssets.some(a => selectedIds.has(a.id));
              const isCollapsed = collapsedCategories.has(cat);
              return (
                <div key={cat} className="border border-border rounded-xl overflow-hidden">
                  {/* Category Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 bg-base/60 cursor-pointer hover:bg-raised/40 transition-colors select-none"
                    onClick={() => toggleCollapse(cat)}
                  >
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleCategory(cat); }}
                      className="shrink-0"
                      role="checkbox"
                      aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                      aria-label={`Select all ${cat} assets`}
                    >
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : someSelected
                        ? <CheckSquare className="w-4 h-4 text-accent/50" />
                        : <Square className="w-4 h-4 text-secondary" />}
                    </button>
                    <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex-1">
                      {cat} <span className="text-secondary font-normal">({catAssets.length})</span>
                    </span>
                    {/* The header row is click-to-collapse for mouse users; this button is the keyboard path. */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleCollapse(cat); }}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${cat}`}
                      className="shrink-0 rounded"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-secondary" /> : <ChevronDown className="w-4 h-4 text-secondary" />}
                    </button>
                  </div>

                  {/* Assets in Category */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border/60">
                      {catAssets.map(asset => {
                        const isSelected = selectedIds.has(asset.id);
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => toggleAsset(asset.id)}
                            aria-pressed={isSelected}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isSelected ? 'bg-accent/8' : 'hover:bg-raised/20'
                            }`}
                          >
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-accent shrink-0" />
                              : <Square className="w-4 h-4 text-secondary shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-primary'}`}>
                                {asset.name}
                              </div>
                              <div className="text-xs text-secondary mt-0.5 flex items-center gap-2">
                                <span className="font-mono">{asset.serialNumber}</span>
                                {asset.model && <span className="truncate">· {asset.model}</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Note + Submit */}
        <div className="px-6 py-4 border-t border-border bg-base/50 space-y-3 shrink-0">
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Assignment note (e.g., Standard onboarding kit)…"
            rows={2}
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={selectedIds.size === 0 || loading}
            >
              Assign {selectedIds.size > 0 ? `${selectedIds.size} Asset${selectedIds.size > 1 ? 's' : ''}` : 'Assets'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
