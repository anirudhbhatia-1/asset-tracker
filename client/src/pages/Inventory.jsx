import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import useAssets from '../hooks/useAssets';
import useCategories from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { exportAssetsExcel, getImportErrorMessage, importAssetsExcel } from '../api/assetsApi';
import useBulkAssetActions from '../hooks/useBulkAssetActions';
import { downloadBlob, exportFilename } from '../utils/download';
import { focusSelectionAnchor, selectedAssetsOf, setManySelected, toggleSelected } from '../utils/assetSelection';
import BulkActionBar from '../components/inventory/BulkActionBar';
import BulkAssignSelectedModal from '../components/inventory/BulkAssignSelectedModal';
import BulkReturnModal from '../components/inventory/BulkReturnModal';
import BulkEditModal from '../components/inventory/BulkEditModal';
import QrLabelsModal from '../components/inventory/QrLabelsModal';
import toast from 'react-hot-toast';
import SearchBar from '../components/inventory/SearchBar';
import FilterToolbar from '../components/inventory/FilterToolbar';
import ActiveFilters from '../components/inventory/ActiveFilters';
import AssetTable from '../components/inventory/AssetTable';
import AssetGrid from '../components/inventory/AssetGrid';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import ImportResultsPanel from '../components/inventory/ImportResultsPanel';
import BulkItemsView from '../components/stock/BulkItemsView';
import Button from '../components/ui/Button';
import SegmentedControl from '../components/ui/SegmentedControl';
import { Plus, RefreshCw, List, LayoutGrid, Download, Upload, Loader2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { viewFromParams, withViewParam, countActiveFilters, initialViewMode } from '../utils/inventoryView';

// Serialized assets (default) or bulk items kept as a count (?view=bulk).
const INVENTORY_VIEWS = [
  { value: 'assets', label: 'Assets' },
  { value: 'bulk', label: 'Bulk items' },
];

const OWNERSHIP_OPTIONS = [
  { value: 'company', label: 'Company assets' },
  { value: 'client', label: 'Client assets' },
  { value: 'all', label: 'All' },
];

const VIEW_MODE_KEY = 'inventoryViewMode';
// Set once the user picks list/grid themselves; until then phones get cards.
const VIEW_MODE_CHOSEN_KEY = 'inventoryViewModeChosen';

const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};
const isPhoneWidth = () => {
  try { return window.matchMedia('(max-width: 767px)').matches; } catch { return false; }
};

// Icon buttons in the header toolbar: 40px tap targets on phones.
const TOOLBAR_TEXT_BUTTON = 'inline-flex items-center justify-center gap-2 min-w-10 min-h-10 md:min-w-0 md:min-h-0 p-2.5 md:px-2.5 md:py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-raised transition-colors cursor-pointer';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, loading: categoriesLoading } = useCategories();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('categoryId') || 'all');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || 'all');
  const [selectedWarranty, setSelectedWarranty] = useState(searchParams.get('warranty') || 'all');
  // Company inventory by default; client-owned assets have their own view.
  const [ownership, setOwnership] = useState(searchParams.get('ownership') || 'company');

  const { hasPermission } = useAuth();
  const canCreateAssets = hasPermission('assets:create');
  const canImportAssets = hasPermission('assets:import');
  const canExportAssets = hasPermission('assets:export');
  const canAssignAssets = hasPermission('assets:assign');
  const canUpdateAssets = hasPermission('assets:update');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // The checked (dry-run) file waiting for the user to confirm the import.
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const fileInputRef = useRef(null);

  // Local state so the switch responds at once; the URL (?view=bulk) mirrors
  // it and is read back on load and on back/forward.
  const [inventoryView, setInventoryView] = useState(() => viewFromParams(searchParams));
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

  const handleSelectView = (value) => {
    setInventoryView(value);
    setSearchParams((current) => withViewParam(current, value), { replace: true });
  };

  // Filter toolbar disclosure on phones (always shown from md up).
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Bulk items are filtered by name on the page (kept out of the URL's `q`,
  // which drives the asset search).
  const [bulkSearch, setBulkSearch] = useState('');

  const [viewMode, setViewModeState] = useState(() => {
    const stored = readStorage(VIEW_MODE_KEY);
    // A stored 'grid' predates the flag and could only have been picked by hand.
    const userChosen = readStorage(VIEW_MODE_CHOSEN_KEY) === '1' || stored === 'grid';
    return initialViewMode({ stored, userChosen, isPhone: isPhoneWidth() });
  });

  // Only an explicit pick is remembered (so phones keep defaulting to cards).
  const setViewMode = (mode) => {
    setViewModeState(mode);
    writeStorage(VIEW_MODE_KEY, mode);
    writeStorage(VIEW_MODE_CHOSEN_KEY, '1');
  };

  // Sync state when URL search params change (e.g. navigation from Dashboard or back button)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setSelectedCategoryId(searchParams.get('categoryId') || 'all');
    setSelectedStatus(searchParams.get('status') || 'all');
    setSelectedLocation(searchParams.get('location') || 'all');
    setSelectedWarranty(searchParams.get('warranty') || 'all');
    setOwnership(searchParams.get('ownership') || 'company');
    setInventoryView(viewFromParams(searchParams));
  }, [searchParams]);

  const updateFilterParams = useCallback((newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, value]) => {
      if (!value || value === 'all') {
        updated.delete(key);
      } else {
        updated.set(key, value);
      }
    });
    setSearchParams(updated, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    updateFilterParams({ q: query });
  }, [updateFilterParams]);

  const handleSelectCategory = (catId) => {
    setSelectedCategoryId(catId);
    updateFilterParams({ categoryId: catId });
  };

  const handleSelectStatus = (status) => {
    setSelectedStatus(status);
    updateFilterParams({ status });
  };

  const handleSelectLocation = (loc) => {
    setSelectedLocation(loc);
    updateFilterParams({ location: loc });
  };

  const handleSelectWarranty = (warranty) => {
    setSelectedWarranty(warranty);
    updateFilterParams({ warranty });
  };

  const handleSelectOwnership = (value) => {
    setOwnership(value);
    const updated = new URLSearchParams(searchParams);
    if (value === 'company') updated.delete('ownership');
    else updated.set('ownership', value);
    setSearchParams(updated, { replace: true });
  };

  // Construct query filters object for API
  const filters = useMemo(() => {
    const obj = {};
    if (searchQuery) obj.q = searchQuery;
    if (selectedCategoryId !== 'all') obj.categoryId = selectedCategoryId;
    if (selectedStatus !== 'all') obj.status = selectedStatus;
    if (selectedLocation !== 'all') obj.location = selectedLocation;
    if (selectedWarranty !== 'all') obj.warranty = selectedWarranty;
    if (ownership !== 'all') obj.assetType = ownership;
    return obj;
  }, [searchQuery, selectedCategoryId, selectedStatus, selectedLocation, selectedWarranty, ownership]);

  const isBulk = inventoryView === 'bulk';
  // Assets aren't loaded while Bulk items is shown; switching back renders
  // the cached list at once and refreshes it.
  const { assets, loading: assetsLoading, refreshing: assetsRefreshing, showingPrevious, error, refresh } = useAssets(filters, { enabled: !isBulk });

  // Bulk selection (Assets view). Cleared whenever the filters or the view
  // change; otherwise only ids still in the list count.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDialog, setBulkDialog] = useState(null); // 'assign' | 'return' | 'edit' | 'qr'
  const [bulkExporting, setBulkExporting] = useState(false);
  const selectionScope = `${inventoryView}|${JSON.stringify(filters)}`;
  const [lastSelectionScope, setLastSelectionScope] = useState(selectionScope);
  if (selectionScope !== lastSelectionScope) {
    setLastSelectionScope(selectionScope);
    if (selectedIds.size) setSelectedIds(new Set());
  }
  const selectedAssets = useMemo(() => selectedAssetsOf(assets, selectedIds), [assets, selectedIds]);
  const selectedIdList = useMemo(() => selectedAssets.map((a) => a.id), [selectedAssets]);
  const toggleSelect = useCallback((id) => setSelectedIds((prev) => toggleSelected(prev, id)), []);
  const selectMany = useCallback((ids, checked) => setSelectedIds((prev) => setManySelected(prev, ids, checked)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const bulk = useBulkAssetActions();
  const closeBulkDialog = () => setBulkDialog(null);

  // Where focus lands after a successful bulk action: clearing the selection
  // unmounts the action bar (which held focus), so it moves to the results
  // region's select-all checkbox instead of falling to <body>.
  const resultsRegionRef = useRef(null);
  const settleFocusAfterBulk = () => focusSelectionAnchor(resultsRegionRef.current);

  const handleBulkAssign = async (employeeId, note, employeeName) => {
    await bulk.assign(selectedIdList, employeeId, note, employeeName);
    // Closed before clearing, so the dialog fades out with its own text.
    closeBulkDialog();
    clearSelection();
    settleFocusAfterBulk();
  };
  const handleBulkReturn = async (note) => {
    await bulk.returnAssets(selectedIdList, note);
    closeBulkDialog();
    clearSelection();
    settleFocusAfterBulk();
  };
  const handleBulkEdit = async (changes) => {
    await bulk.update(selectedIdList, changes);
    closeBulkDialog();
    clearSelection();
    settleFocusAfterBulk();
  };
  const handleBulkExport = async () => {
    setBulkExporting(true);
    try {
      await bulk.exportSelected(selectedIdList);
    } catch {
      // Toasted by the hook.
    } finally {
      setBulkExporting(false);
    }
  };

  const hasActiveFilters = Boolean(searchQuery) || selectedCategoryId !== 'all' || selectedStatus !== 'all'
    || selectedLocation !== 'all' || selectedWarranty !== 'all';
  // With no filters, an empty list means nothing is registered yet — offer to
  // add assets rather than to clear filters.
  const showNoAssetsYet = !assetsLoading && !categoriesLoading && !error && !hasActiveFilters
    && (!Array.isArray(assets) || assets.length === 0);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId('all');
    setSelectedStatus('all');
    setSelectedLocation('all');
    setSelectedWarranty('all');
    // Clearing filters keeps the chosen ownership view.
    setSearchParams(ownership === 'company' ? {} : { ownership }, { replace: true });
  };

  // Removing one active-filter chip goes through the same handler as its control.
  const handleRemoveFilter = (key) => {
    if (key === 'q') handleSearchChange('');
    else if (key === 'categoryId') handleSelectCategory('all');
    else if (key === 'status') handleSelectStatus('all');
    else if (key === 'location') handleSelectLocation('all');
    else if (key === 'warranty') handleSelectWarranty('all');
  };

  const handleExport = async () => {
    try {
      const res = await exportAssetsExcel();
      downloadBlob(res.data, exportFilename());
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  // Import is check → confirm: the chosen file is first run as a dry run
  // (nothing saved), the panel shows what would happen, and only "Import N
  // assets" uploads it again for real.
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setPendingImportFile(null);
    try {
      const res = await importAssetsExcel(file, { dryRun: true });
      setImportResult(res.data?.data);
      setPendingImportFile(file);
    } catch (err) {
      toast.error(getImportErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;
    setImporting(true);
    try {
      const res = await importAssetsExcel(pendingImportFile);
      const result = res.data?.data;
      setImportResult(result);
      setPendingImportFile(null);
      toast.success(`Imported ${result.imported} assets`);
      refresh();
    } catch (err) {
      toast.error(getImportErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setPendingImportFile(null);
    setImportResult(null);
  };

  const activeFilterCount = countActiveFilters({
    categoryId: selectedCategoryId,
    status: selectedStatus,
    location: selectedLocation,
    warranty: selectedWarranty,
  });

  const assetActions = (
    /* Secondary actions grouped into one toolbar so the header doesn't wrap */
    <div
      role="toolbar"
      aria-label="Inventory actions"
      className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 shadow-sm"
    >
      <button
        type="button"
        onClick={() => setViewMode('list')}
        aria-pressed={viewMode === 'list'}
        className={`inline-flex items-center justify-center min-w-10 min-h-10 md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'list' ? 'bg-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
        }`}
        title="List View"
        aria-label="List view"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode('grid')}
        aria-pressed={viewMode === 'grid'}
        className={`inline-flex items-center justify-center min-w-10 min-h-10 md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'grid' ? 'bg-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
        }`}
        title="Grid View"
        aria-label="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>

      <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />

      <button
        type="button"
        onClick={refresh}
        className={TOOLBAR_TEXT_BUTTON}
        title="Refresh list"
        aria-label="Refresh list"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading || assetsRefreshing ? 'animate-spin text-accent' : ''}`} />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      {canImportAssets && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            className={`${TOOLBAR_TEXT_BUTTON} disabled:opacity-50`}
            title="Import Excel"
            aria-label="Import Excel"
          >
            {importing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              : <Upload className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {importing ? (pendingImportFile ? 'Importing...' : 'Checking...') : 'Import Excel'}
            </span>
          </button>
        </>
      )}

      {canExportAssets && (
        <button
          type="button"
          onClick={handleExport}
          className={TOOLBAR_TEXT_BUTTON}
          title="Export Excel"
          aria-label="Export Excel"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export Excel</span>
        </button>
      )}
    </div>
  );

  const bulkActions = canCreateAssets && (
    <Button onClick={() => setBulkCreateOpen(true)}>
      <Plus className="w-4 h-4" />
      <span>Add bulk item</span>
    </Button>
  );

  const assetsBody = (
    <>
      {importResult && (
        <ImportResultsPanel
          result={importResult}
          onDismiss={() => setImportResult(null)}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          confirming={importing}
        />
      )}

      {/* Error banner if fetching failed */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline text-xs hover:text-primary cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Ownership view */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <SegmentedControl
          label="Asset ownership"
          options={OWNERSHIP_OPTIONS}
          value={ownership}
          onChange={handleSelectOwnership}
          className="self-start"
        />
        {ownership === 'client' && (
          <p className="text-xs text-secondary">
            Owned by clients: kept for records only and not counted in company totals.
          </p>
        )}
      </div>

      {/* Search Bar & Filter Toolbar */}
      <div className="space-y-3">
        <SearchBar initialValue={searchQuery} onSearch={handleSearchChange} />
        {/* On phones the filters sit behind a disclosure button. */}
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="inventory-filters"
          className="md:hidden"
        >
          <SlidersHorizontal className="w-4 h-4 text-secondary" aria-hidden="true" />
          <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
          <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </Button>
        <div id="inventory-filters" className={filtersOpen ? 'block' : 'hidden md:block'}>
          <FilterToolbar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleSelectCategory}
            selectedStatus={selectedStatus}
            onSelectStatus={handleSelectStatus}
            selectedLocation={selectedLocation}
            onSelectLocation={handleSelectLocation}
            selectedWarranty={selectedWarranty}
            onSelectWarranty={handleSelectWarranty}
          />
        </div>
        <ActiveFilters
          searchQuery={searchQuery}
          selectedCategoryId={selectedCategoryId}
          selectedStatus={selectedStatus}
          selectedLocation={selectedLocation}
          selectedWarranty={selectedWarranty}
          categories={categories}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearFilters}
        />
      </div>

      {/* Asset Data Table */}
      <div ref={resultsRegionRef}>
      {showNoAssetsYet ? (
        <EmptyState
          title={ownership === 'client' ? 'No client assets yet' : 'No assets yet'}
          description={
            ownership === 'client'
              ? 'No client-owned assets have been recorded.'
              : 'No hardware has been registered in the inventory.'
          }
        >
          {canCreateAssets && (
            <>
              <Link
                to="/inventory/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-on-accent shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Asset</span>
              </Link>
              {canImportAssets && (
                <p className="text-xs text-secondary mt-3">
                  Adding many at once? Use <strong className="text-primary">Bulk upload (CSV)</strong> on the Add Asset page.
                </p>
              )}
            </>
          )}
        </EmptyState>
      ) : viewMode === 'list' ? (
        <AssetTable
          assets={assets}
          loading={assetsLoading || categoriesLoading}
          refreshing={showingPrevious}
          onClearFilters={handleClearFilters}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectMany={selectMany}
        />
      ) : (
        <AssetGrid
          assets={assets}
          loading={assetsLoading || categoriesLoading}
          refreshing={showingPrevious}
          onClearFilters={handleClearFilters}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectMany={selectMany}
        />
      )}
      </div>

      <BulkActionBar
        selectedAssets={selectedAssets}
        permissions={{ assign: canAssignAssets, update: canUpdateAssets, export: canExportAssets }}
        exporting={bulkExporting}
        onAssign={() => setBulkDialog('assign')}
        onReturn={() => setBulkDialog('return')}
        onEdit={() => setBulkDialog('edit')}
        onExport={handleBulkExport}
        onPrint={() => setBulkDialog('qr')}
        onClear={clearSelection}
      />

      <BulkAssignSelectedModal
        isOpen={bulkDialog === 'assign'}
        onClose={closeBulkDialog}
        assets={selectedAssets}
        onAssign={handleBulkAssign}
      />
      <BulkReturnModal
        isOpen={bulkDialog === 'return'}
        onClose={closeBulkDialog}
        assets={selectedAssets}
        onReturn={handleBulkReturn}
      />
      <BulkEditModal
        isOpen={bulkDialog === 'edit'}
        onClose={closeBulkDialog}
        count={selectedAssets.length}
        categories={categories}
        onSave={handleBulkEdit}
      />
      <QrLabelsModal
        isOpen={bulkDialog === 'qr'}
        onClose={closeBulkDialog}
        assets={selectedAssets}
      />
    </>
  );

  // One header and switch for both views; only the body below is swapped.
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header — "Add Asset" lives in the global TopBar */}
      <PageHeader
        title="Hardware Inventory"
        subtitle={isBulk
          ? 'Items without serial numbers, like bags or cables, kept as a count.'
          : 'Browse, filter, search, and manage the lifecycle of all registered hardware devices.'}
        actions={isBulk ? bulkActions : assetActions}
      />

      <div>
        <SegmentedControl
          label="Inventory view"
          options={INVENTORY_VIEWS}
          value={inventoryView}
          onChange={handleSelectView}
        />
      </div>

      {isBulk ? (
        <BulkItemsView
          createOpen={bulkCreateOpen}
          onCreateOpen={() => setBulkCreateOpen(true)}
          onCreateClose={() => setBulkCreateOpen(false)}
          search={bulkSearch}
          onSearchChange={setBulkSearch}
        />
      ) : assetsBody}
    </div>
  );
}
