import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import useAssets from '../hooks/useAssets';
import useCategories from '../hooks/useCategories';
import SearchBar from '../components/inventory/SearchBar';
import FilterToolbar from '../components/inventory/FilterToolbar';
import AssetTable from '../components/inventory/AssetTable';
import AssetGrid from '../components/inventory/AssetGrid';
import { Plus, RefreshCw, List, LayoutGrid } from 'lucide-react';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, loading: categoriesLoading } = useCategories();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('categoryId') || 'all');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || 'all');
  const [selectedWarranty, setSelectedWarranty] = useState(searchParams.get('warranty') || 'all');

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

  // Construct query filters object for API
  const filters = useMemo(() => {
    const obj = {};
    if (searchQuery) obj.q = searchQuery;
    if (selectedCategoryId !== 'all') obj.categoryId = selectedCategoryId;
    if (selectedStatus !== 'all') obj.status = selectedStatus;
    if (selectedLocation !== 'all') obj.location = selectedLocation;
    if (selectedWarranty !== 'all') obj.warranty = selectedWarranty;
    return obj;
  }, [searchQuery, selectedCategoryId, selectedStatus, selectedLocation, selectedWarranty]);

  const { assets, loading: assetsLoading, error, refresh } = useAssets(filters);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId('all');
    setSelectedStatus('all');
    setSelectedLocation('all');
    setSelectedWarranty('all');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Hardware Inventory</h1>
          <p className="text-sm text-secondary mt-1">
            Browse, filter, search, and manage the lifecycle of all registered hardware devices.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface border border-border rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors shadow-sm cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? 'animate-spin text-accent' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/inventory/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-accent hover:bg-accent text-white transition-colors shadow-md shadow-accent/20 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Asset</span>
          </Link>
        </div>
      </div>

      {/* Error banner if fetching failed */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline text-xs hover:text-white cursor-pointer">
            Retry
          </button>
        </div>
      )}

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
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Asset Data Table */}
      {viewMode === 'list' ? (
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
