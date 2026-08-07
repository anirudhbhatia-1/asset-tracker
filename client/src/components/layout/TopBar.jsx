import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Bell, Sun, Moon, Settings, X, ShieldCheck, LogOut, Menu, ChevronDown, Key, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import useNotifications from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';

const TopBar = ({ toggleSidebar, isSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout, hasPermission } = useAuth();
  const { notifications, loading: notifLoading, hasUnread, refresh, markAsRead } = useNotifications();

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isUserMenuOpen && !e.target.closest('#user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

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
      setIsSearchExpanded(false);
    }
  };



  return (
    <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8">
      
      {/* Mobile Expanded Search */}
      {isSearchExpanded ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Search assets..."
              className="w-full pl-9 pr-4 py-1.5 bg-base/60 border border-border rounded-lg text-base md:text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
          </div>
          <button 
            onClick={() => setIsSearchExpanded(false)}
            className="p-2 text-secondary hover:text-primary"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          {/* Page Title & Desktop Search */}
          <div className="flex items-center gap-3 sm:gap-6 flex-1 max-w-xl overflow-hidden">
            <button 
              onClick={toggleSidebar} 
              className="p-2 -ml-2 rounded-lg text-secondary hover:bg-raised/50 hover:text-primary transition-colors hidden md:block"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden w-8 h-8 flex items-center justify-center shrink-0">
              <img 
                src="/logo.png" 
                alt="Thinkvibes Logo" 
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>

            
            <div className="relative w-full hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                type="text"
                value={query}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search assets by serial or name..."
                className="w-full pl-9 pr-4 py-1.5 bg-base/60 border border-border rounded-lg text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-1 sm:gap-4 shrink-0 ml-2">
            
            <button 
              className="md:hidden p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/50"
              onClick={() => setIsSearchExpanded(true)}
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Only Users with assets:create permission can add assets */}
            {hasPermission('assets:create') && (
              <Link
                to="/inventory/new"
                className="bg-accent hover:bg-accent/90 text-white p-2 md:px-4 md:py-2 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                aria-label="Add Asset"
              >
                <Plus className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Add Asset</span>
              </Link>
            )}

            {hasPermission('assets:create') && (
              <div className="hidden sm:block h-6 w-[1px] bg-raised mx-1" />
            )}

            <button 
              onClick={toggleTheme}
              className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/50 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative hidden sm:block">
              <button
                id="notification-bell"
                onClick={() => {
                  const newState = !isNotificationPanelOpen;
                  setIsNotificationPanelOpen(newState);
                  if (newState) {
                    refresh();
                    markAsRead();
                  }
                }}
                className="flex p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/50 transition-colors relative"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </button>
              <NotificationPanel
                isOpen={isNotificationPanelOpen}
                onClose={() => setIsNotificationPanelOpen(false)}
                notifications={notifications}
                loading={notifLoading}
              />
            </div>

            {/* User Profile Dropdown */}
            <div id="user-menu-container" className="relative ml-1 sm:ml-2">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 sm:gap-3 p-1.5 rounded-xl hover:bg-raised/50 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold text-xs uppercase shrink-0">
                  {user?.email?.[0] || 'U'}
                </div>
                <div className="hidden sm:block text-left min-w-0 max-w-[200px] lg:max-w-xs">
                  <span className="block text-xs font-semibold text-primary leading-none truncate">
                    {user?.email || 'User'}
                  </span>
                  <span className="block text-[11px] text-secondary mt-0.5 capitalize">
                    {user?.roleName || user?.role || 'Guest'}
                  </span>
                </div>
                <ChevronDown className="hidden sm:block w-4 h-4 text-secondary shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface border border-border/80 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                  {/* Dropdown Header (Full Email & Role) */}
                  <div className="px-4 py-4 border-b border-border/60 bg-base/50">
                    <p className="text-sm font-bold text-primary truncate" title={user?.email}>
                      {user?.email || 'User'}
                    </p>
                    <p className="text-xs text-secondary mt-1 capitalize font-medium">
                      Role: {user?.roleName || user?.role || 'Guest'}
                    </p>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 transition-colors text-left"
                    >
                      <User className="w-4 h-4" />
                      View My Profile
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsChangePasswordModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 transition-colors text-left"
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </button>
                    
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error hover:text-error hover:bg-error/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={isChangePasswordModalOpen} 
        onClose={() => setIsChangePasswordModalOpen(false)} 
      />
    </header>
  );
};

export default TopBar;
