import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ initialValue = '', onSearch, placeholder = 'Search by asset name, model, or serial number...' }) {
  const [searchTerm, setSearchTerm] = useState(initialValue);

  // Sync state if initialValue changes from outside (e.g. clear filters)
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  // Debounce 300ms per PRD 6.2.1
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, onSearch]);

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary">
        <Search className="w-4.5 h-4.5" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface/80 border border-border/80 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all shadow-sm"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary hover:text-primary transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
