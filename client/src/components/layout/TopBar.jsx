import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Sun, Moon, LogOut, Menu, ChevronDown, Key, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import useNotifications from '../../hooks/useNotifications';
import NotificationPanel from './NotificationPanel';
import usePaletteShortcut from '../../hooks/usePaletteShortcut';
import { shortcutLabel } from '../../utils/searchPalette';
// Bundled with the layout (small), so keys typed right after Ctrl+K are
// never lost while a chunk downloads.
import CommandPalette from '../search/CommandPalette';

const TopBar = ({ toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout, hasPermission } = useAuth();
  const { notifications, loading: notifLoading, hasUnread, refresh, markAsRead } = useNotifications();
  const shortcut = shortcutLabel();

  // Ctrl+K / ⌘K anywhere, or "/" outside text fields, opens global search.
  usePaletteShortcut({
    isOpen: isPaletteOpen,
    onOpen: () => setIsPaletteOpen(true),
    onClose: () => setIsPaletteOpen(false),
  });

  const userMenuButtonRef = useRef(null);

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

  // Escape closes the user menu and returns focus to its button
  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen]);

  // Leaving the page (e.g. Back) closes search.
  useEffect(() => {
    setIsPaletteOpen(false);
  }, [location.pathname]);

  const openPalette = () => setIsPaletteOpen(true);

  return (
    <header className="h-[4.5rem] bg-surface/80 backdrop-blur-xl border-b border-border/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 shadow-[0_1px_0_rgba(20,33,58,0.02)]">
        <>
          {/* Page Title & Desktop Search */}
          <div className="flex items-center gap-3 sm:gap-6 flex-1 max-w-xl overflow-hidden">
            <button 
              type="button"
              onClick={toggleSidebar} 
              className="p-2 -ml-2 rounded-lg text-secondary hover:bg-raised/50 hover:text-primary transition-colors hidden md:block"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden w-8 h-8 flex items-center justify-center shrink-0 dark:bg-white dark:rounded-lg dark:p-1">
              <img 
                src="/logo.png" 
                alt="Thinkvibes Logo" 
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>

            
            {/* Looks like a field from lg; opens the global search palette.
                Below lg it's the icon button on the right. */}
            <button
              type="button"
              onClick={openPalette}
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              aria-label={`Search everything (${shortcut})`}
              className="hidden lg:flex items-center gap-2.5 w-full max-w-md pl-3 pr-2 py-2 bg-raised/80 border border-border rounded-xl text-sm text-secondary hover:border-accent/50 hover:text-primary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors cursor-text text-left"
            >
              <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">Search everything…</span>
              <kbd aria-hidden="true" className="shrink-0 font-sans text-[11px] font-medium px-1.5 py-0.5 rounded-md border border-border bg-surface text-secondary">{shortcut}</kbd>
            </button>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-1 sm:gap-4 shrink-0 ml-2">
            
            <button
              type="button"
              className="lg:hidden p-2.5 rounded-lg text-secondary hover:text-primary hover:bg-raised/50"
              onClick={openPalette}
              aria-haspopup="dialog"
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Only Users with assets:create permission can add assets */}
            {hasPermission('assets:create') && (
              <Link
                to="/inventory/new"
                className="bg-accent hover:bg-accent-hover text-on-accent p-2.5 md:px-4 md:py-2 rounded-xl font-medium shadow-sm shadow-accent/20 transition-all flex items-center justify-center gap-2 text-sm"
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
              type="button"
              onClick={toggleTheme}
              className="hidden sm:flex p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/50 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                id="notification-bell"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isNotificationPanelOpen}
                aria-controls={isNotificationPanelOpen ? 'notification-panel' : undefined}
                onClick={() => {
                  const newState = !isNotificationPanelOpen;
                  setIsNotificationPanelOpen(newState);
                  if (newState) {
                    refresh();
                    markAsRead();
                  }
                }}
                className="flex p-3 sm:p-2 rounded-lg text-secondary hover:text-primary hover:bg-raised/50 transition-colors relative"
                aria-label={hasUnread ? 'View notifications (new)' : 'View notifications'}
              >
                <Bell className="w-4 h-4" />
                {hasUnread && (
                  <span className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
                )}
              </button>
              <NotificationPanel
                isOpen={isNotificationPanelOpen}
                onClose={() => setIsNotificationPanelOpen(false)}
                notifications={notifications}
                loading={notifLoading}
                onMarkRead={markAsRead}
              />
            </div>

            {/* User Profile Dropdown */}
            <div id="user-menu-container" className="relative ml-1 sm:ml-2">
              <button 
                ref={userMenuButtonRef}
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                aria-controls={isUserMenuOpen ? 'user-menu' : undefined}
                aria-label={`Account menu for ${user?.email || 'user'}`}
                className="flex items-center gap-2 sm:gap-3 p-1.5 min-h-[44px] sm:min-h-0 rounded-xl hover:bg-raised/50 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold text-xs uppercase shrink-0 shadow-sm">
                  {user?.email?.[0] || 'U'}
                </div>
                {/* Email and role from xl, so the search keeps its room on tablets. */}
                <div className="hidden xl:block text-left min-w-0 max-w-xs">
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
                <div id="user-menu" className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-surface border border-border/80 rounded-2xl shadow-xl overflow-hidden z-50 animate-fadeIn origin-top-right">
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
                      type="button"
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
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsChangePasswordModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 transition-colors text-left"
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </button>

                    {/* Theme switch lives here too: the header toggle is hidden on phones. */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      role="switch"
                      aria-checked={theme === 'dark'}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 transition-colors text-left"
                    >
                      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span className="flex-1">Dark mode</span>
                      <span
                        aria-hidden="true"
                        className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors ${theme === 'dark' ? 'bg-accent' : 'bg-border'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-surface shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-3.5' : ''}`} />
                      </span>
                    </button>
                    
                    <button
                      type="button"
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

      {isPaletteOpen && (
        <CommandPalette onClose={() => setIsPaletteOpen(false)} />
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
