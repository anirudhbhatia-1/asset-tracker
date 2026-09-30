import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import useAssets from '../hooks/useAssets';
import useCategories from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { exportAssetsExcel, getImportErrorMessage, importAssetsExcel } from '../api/assetsApi';
import toast from 'react-hot-toast';
import SearchBar from '../components/inventory/SearchBar';
import FilterToolbar from '../components/inventory/FilterToolbar';
import ActiveFilters from '../components/inventory/ActiveFilters';
import AssetTable from '../components/inventory/AssetTable';
import AssetGrid from '../components/inventory/AssetGrid';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import ImportResultsPanel from '../components/inventory/ImportResultsPanel';
import { Plus, RefreshCw, List, LayoutGrid, Download, Upload, Loader2 } from 'lucide-react';

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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // The checked (dry-run) file waiting for the user to confirm the import.
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const fileInputRef = useRef(null);

  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('inventoryViewMode') || 'list';
  });

  // Sync state when URL search params change (e.g. navigation from Dashboard or back button)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setSelectedCategoryId(searchParams.get('categoryId') || 'all');
    setSelectedStatus(searchParams.get('status') || 'all');
    setSelectedLocation(searchParams.get('location') || 'all');
    setSelectedWarranty(searchParams.get('warranty') || 'all');
    setOwnership(searchParams.get('ownership') || 'company');
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('inventoryViewMode', viewMode);
  }, [viewMode]);

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

  const { assets, loading: assetsLoading, error, refresh } = useAssets(filters);

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
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AssetTrack_${new Date().toISOString().substring(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header — "Add Asset" lives in the global TopBar */}
      <PageHeader
        title="Hardware Inventory"
        subtitle="Browse, filter, search, and manage the lifecycle of all registered hardware devices."
        actions={
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
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
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
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
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
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-raised transition-colors cursor-pointer"
            title="Refresh list"
            aria-label="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? 'animate-spin text-accent' : ''}`} />
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
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-raised transition-colors cursor-pointer disabled:opacity-50"
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
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-raised transition-colors cursor-pointer"
              title="Export Excel"
              aria-label="Export Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          )}
        </div>
        }
      />

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
        <div className="inline-flex bg-surface border border-border rounded-xl p-1 self-start" role="tablist" aria-label="Asset ownership">
          {[
            ['company', 'Company assets'],
            ['client', 'Client assets'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={ownership === value}
              onClick={() => handleSelectOwnership(value)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                ownership === value ? 'bg-accent text-on-accent shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {ownership === 'client' && (
          <p className="text-xs text-secondary">
            Owned by clients: kept for records only and not counted in company totals.
          </p>
        )}
      </div>

      {/* Search Bar & Filter Toolbar */}
      <div className="space-y-3">
        <SearchBar initialValue={searchQuery} onSearch={handleSearchChange} />
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
          onClearFilters={handleClearFilters}
        />
      ) : (
        <AssetGrid
          assets={assets}
          loading={assetsLoading || categoriesLoading}
          onClearFilters={handleClearFilters}
        />
      )}
    </div>
  );
}
