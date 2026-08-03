import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Package, Search, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { getAssets, bulkAssignAssets } from '../../api/assetsApi';
import toast from 'react-hot-toast';

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
        const res = await getAssets({ status: 'available' });
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
      next.has(id) ? next.delete(id) : next.add(id);
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
      next.has(cat) ? next.delete(cat) : next.add(cat);
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

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-base/50 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-primary">Assign Hardware</h2>
            <p className="text-xs text-secondary mt-0.5">
              Select available assets to assign to <span className="font-medium text-primary">{employee.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors">
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
              placeholder="Search by name, serial number, or model..."
              className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-xl text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
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
              <span className="text-sm">Loading available assets...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-8 h-8 text-secondary mx-auto mb-2" />
              <p className="text-sm text-secondary">No available assets found.</p>
            </div>
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
                    >
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : someSelected
                        ? <CheckSquare className="w-4 h-4 text-accent/50" />
                        : <Square className="w-4 h-4 text-secondary" />}
                    </button>
                    <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex-1">
                      {cat} <span className="text-secondary/60 font-normal">({catAssets.length})</span>
                    </span>
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-secondary" /> : <ChevronDown className="w-4 h-4 text-secondary" />}
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
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Assignment note (e.g., Standard onboarding kit)..."
            rows={2}
            className="w-full px-3 py-2 bg-base border border-border rounded-lg text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedIds.size === 0 || loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Assign {selectedIds.size > 0 ? `${selectedIds.size} Asset${selectedIds.size > 1 ? 's' : ''}` : 'Assets'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
