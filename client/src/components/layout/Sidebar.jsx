import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { prefetchRoute } from '../../utils/routePrefetch';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Users, 
  Settings, 
  Ticket,
  UserPlus,
  UserMinus,
  MoreHorizontal
} from 'lucide-react';

const allNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, permissionKey: null },
  { name: 'Inventory', path: '/inventory', icon: Package, permissionKey: 'assets:read' },
  { name: 'Tickets', path: '/tickets', icon: Ticket, permissionKey: 'tickets:read' },
  { name: 'Onboarding', path: '/onboarding', icon: UserPlus, permissionKey: 'onboarding:read' },
  { name: 'Offboarding', path: '/offboarding', icon: UserMinus, permissionKey: 'offboarding:read' },
  { name: 'Scanner', path: '/scanner', icon: QrCode, permissionKey: 'scanner:read' },
  { name: 'Employees', path: '/employees', icon: Users, permissionKey: 'employees:read' },
  // Everyone can read categories/locations (form dropdowns need them), so
  // Settings only appears for people who can manage something there.
  { name: 'Settings', path: '/settings', icon: Settings, permissionKeys: ['roles:read', 'categories:manage', 'locations:manage', 'audit:read'] },
];

// Start downloading a page's code as soon as the user points at, focuses or
// touches its link.
const prefetchHandlers = (path) => {
  const prefetch = () => prefetchRoute(path);
  return { onMouseEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
};

const Sidebar = ({ isOpen = true }) => {
  const { hasPermission } = useAuth();

  const visibleNavItems = allNavItems.filter(item => {
    if (item.permissionKeys) return item.permissionKeys.some(hasPermission);
    if (!item.permissionKey) return true;
    return hasPermission(item.permissionKey);
  });

  // The mobile tab bar fits 5 tabs; beyond that show 4 plus a "More" menu.
  const hasOverflow = visibleNavItems.length > 5;
  const mobileNavItems = hasOverflow ? visibleNavItems.slice(0, 4) : visibleNavItems;
  const overflowItems = hasOverflow ? visibleNavItems.slice(4) : [];

  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreActive = overflowItems.some(item => location.pathname.startsWith(item.path));

  // Close the "More" menu on Escape or a click/tap outside it.
  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    const onPointerDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [moreOpen]);

  return (
    <>
      {/* Mobile: bottom tab bar. md+: left sidebar. */}
      <aside
        aria-label="Main navigation"
        className={`fixed z-50 flex bg-surface/95 backdrop-blur-xl select-none transition-all duration-300 ease-in-out
          bottom-0 left-0 right-0 w-full flex-row items-stretch
          h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-border
          md:top-0 md:bottom-auto md:right-auto md:h-screen ${isOpen ? 'md:w-64' : 'md:w-20'}
          md:flex-col md:border-t-0 md:border-r md:border-border/80 md:pb-0`}
      >
        
        {/* Brand Header (Hidden on Mobile, visible on md+) */}
        <div className={`hidden md:flex h-[4.5rem] px-4 items-center border-b border-border/80 shrink-0 ${isOpen ? 'justify-start lg:px-6' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
            {/* Light chip in dark mode keeps the logo's dark lettering legible. */}
            <div className="w-8 h-8 flex items-center justify-center shrink-0 dark:bg-white dark:rounded-lg dark:p-1">
              <img 
                src="/logo.png" 
                alt="Thinkvibes Logo" 
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            {isOpen && (
              <div className="hidden md:block">
                <span className="font-bold text-lg tracking-tight text-primary flex items-center gap-1.5">
                  Thinkvibes
                </span>
                <span className="block text-[10px] text-secondary uppercase font-semibold tracking-wider -mt-1">
                  Asset Management
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-1 md:flex-col md:py-5 md:px-3 md:space-y-1.5 md:overflow-y-auto w-full h-full md:h-auto items-center justify-around md:justify-start">
          
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isMobileHidden = !mobileNavItems.some(m => m.name === item.name);
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                {...prefetchHandlers(item.path)}
                className={({ isActive }) =>
                  `relative flex flex-col md:flex-row items-center ${isOpen ? 'md:justify-start' : 'md:justify-center'} gap-1 md:gap-3
                   w-full px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-[10px] md:text-sm transition-all duration-150 group active:scale-[0.97]
                   ${isMobileHidden ? 'hidden md:flex' : 'flex'}
                   ${isActive
                      ? 'md:bg-accent/10 text-accent font-semibold md:shadow-[inset_3px_0_0_var(--theme-accent)]'
                      : 'text-secondary hover:bg-raised/70 hover:text-primary active:bg-raised'
                  }`
                }
                aria-label={item.name}
                title={!isOpen ? item.name : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 shrink-0 ${isOpen ? '' : 'md:mx-auto'} ${isActive ? 'text-accent' : 'text-secondary group-hover:text-secondary'}`} />
                    <span className={`${isOpen ? 'hidden md:inline' : 'hidden'} text-sm`}>{item.name}</span>
                    <span className="md:hidden truncate w-full text-center">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Mobile-only "More" tab listing the nav items that don't fit */}
          {hasOverflow && (
            <div ref={moreRef} className="relative md:hidden w-full">
              <button
                type="button"
                onClick={() => setMoreOpen(open => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                aria-controls="mobile-more-menu"
                className={`flex flex-col items-center gap-1 w-full px-2 py-2 rounded-lg text-[10px] transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                  moreActive || moreOpen ? 'text-accent font-semibold' : 'text-secondary hover:text-primary'
                }`}
              >
                <MoreHorizontal className={`w-5 h-5 shrink-0 ${moreActive || moreOpen ? 'text-accent' : 'text-secondary'}`} />
                <span className="truncate w-full text-center">More</span>
              </button>
              {moreOpen && (
                <div
                  id="mobile-more-menu"
                  className="absolute bottom-full right-1 mb-3 min-w-44 rounded-xl border border-border bg-surface shadow-xl py-1.5 animate-popIn"
                >
                  {overflowItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        {...prefetchHandlers(item.path)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive ? 'text-accent font-semibold bg-accent/10' : 'text-primary hover:bg-raised/70 active:bg-raised'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

      </aside>
    </>
  );
};

export default Sidebar;
