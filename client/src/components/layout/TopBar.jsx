import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Bell, User } from 'lucide-react';

const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (location.pathname === '/inventory') {
      setQuery(searchParams.get('q') || '');
    } else {
      setQuery('');
    }
  }, [location.pathname, searchParams]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (location.pathname === '/inventory') {
      if (val.trim()) {
        navigate(`/inventory?q=${encodeURIComponent(val.trim())}`, { replace: true });
      } else {
        navigate('/inventory', { replace: true });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && location.pathname !== '/inventory' && query.trim()) {
      navigate(`/inventory?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const getPageTitle = (pathname) => {
    if (pathname === '/') return 'Dashboard';
    if (pathname === '/inventory') return 'Hardware Inventory';
    if (pathname.startsWith('/inventory/new')) return 'Register New Asset';
    if (pathname.startsWith('/inventory/')) return 'Asset Details';
    if (pathname === '/scanner') return 'Barcode Scanner';
    if (pathname === '/employees') return 'Employee Directory';
    if (pathname === '/categories') return 'Asset Categories';
    if (pathname === '/settings') return 'System Settings';
    return 'AssetTrack';
  };

  return (
    <header className="h-16 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-30 flex items-center justify-between px-8">
      {/* Page Title & Search */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <h1 className="text-lg font-semibold text-slate-100 min-w-max">
          {getPageTitle(location.pathname)}
        </h1>
        <div className="relative w-full max-w-sm hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Search assets by serial or name..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Quick Actions & User Profile */}
      <div className="flex items-center gap-4">
        <Link
          to="/inventory/new"
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Asset</span>
        </Link>

        <div className="h-6 w-[1px] bg-slate-700 mx-1" />

        <button className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
        </button>

        <div className="flex items-center gap-3 pl-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 font-semibold text-xs">
            RS
          </div>
          <div className="hidden sm:block text-left">
            <span className="block text-xs font-semibold text-slate-200 leading-none">
              Rajan Sharma
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              IT Administrator
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
