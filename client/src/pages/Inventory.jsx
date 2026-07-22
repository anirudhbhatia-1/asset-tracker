import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import useAssets from '../hooks/useAssets';
import useCategories from '../hooks/useCategories';
import SearchBar from '../components/inventory/SearchBar';
import FilterToolbar from '../components/inventory/FilterToolbar';
import AssetTable from '../components/inventory/AssetTable';
import { Plus, RefreshCw } from 'lucide-react';

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, loading: categoriesLoading } = useCategories();

  // Read initial query from URL search params (`?q=`) or filters
  const urlQuery = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Sync URL ?q= parameter when search input updates
  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    if (query) {
      setSearchParams({ q: query }, { replace: true });
    } else {
      searchParams.delete('q');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Construct query filters object for API
  const filters = useMemo(() => {
    const obj = {};
    if (searchQuery) obj.q = searchQuery;
    if (selectedCategoryId !== 'all') obj.categoryId = selectedCategoryId;
    if (selectedStatus !== 'all') obj.status = selectedStatus;
    if (selectedLocation !== 'all') obj.location = selectedLocation;
    return obj;
  }, [searchQuery, selectedCategoryId, selectedStatus, selectedLocation]);

  const { assets, loading: assetsLoading, error, refresh } = useAssets(filters);

  const handleClearFilters = () => {
    handleSearchChange('');
    setSelectedCategoryId('all');
    setSelectedStatus('all');
    setSelectedLocation('all');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Hardware Inventory</h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse, filter, search, and manage the lifecycle of all registered hardware devices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/inventory/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Asset</span>
          </Link>
        </div>
      </div>

      {/* Error banner if fetching failed */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-300 flex items-center justify-between">
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
          onSelectCategory={setSelectedCategoryId}
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Asset Data Table */}
      <AssetTable
        assets={assets}
        loading={assetsLoading || categoriesLoading}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
}
