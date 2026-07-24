import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Users, 
  Settings, 
  ShieldCheck,
  Tags
} from 'lucide-react';

const mobileNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Scanner', path: '/scanner', icon: QrCode },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const desktopNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Barcode Scanner', path: '/scanner', icon: QrCode },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = () => {
  return (
    <>
      {/* Container is bottom tab bar on mobile, left sidebar on md+ */}
      <aside className="
        fixed z-50 flex bg-surface
        
        /* Mobile: Bottom Tab Bar */
        bottom-0 left-0 right-0 w-full flex-row items-center justify-around
        h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]
        border-t border-border
        
        /* Tablet/Desktop: Left Sidebar */
        md:top-0 md:bottom-auto md:left-0 md:h-screen md:w-20 lg:w-64
        md:flex-col md:border-t-0 md:border-r md:justify-start md:pb-0
        transition-all duration-300 ease-in-out select-none
      ">
        
        {/* Brand Header (Hidden on Mobile, visible on md+) */}
        <div className="hidden md:flex h-16 px-4 lg:px-6 items-center justify-center lg:justify-start border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="hidden lg:block">
              <span className="font-bold text-lg tracking-tight text-primary flex items-center gap-1.5">
                AssetTrack
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
              </span>
              <span className="block text-[10px] text-secondary uppercase font-semibold tracking-wider -mt-1">
                IT Operations
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-1 md:flex-col md:py-6 md:px-3 md:space-y-1 md:overflow-y-auto w-full h-full md:h-auto items-center justify-around md:justify-start">
          <div className="hidden md:block px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-secondary lg:text-left">
            <span className="hidden lg:inline">Navigation</span>
            <span className="inline lg:hidden text-center block">Menu</span>
          </div>
          
          {/* We map mobile items differently than desktop items to respect the 5-item limit on mobile */}
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const isMobileHidden = !mobileNavItems.some(m => m.name === item.name);
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 
                   w-full px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-[10px] md:text-sm transition-all duration-150 group
                   ${isMobileHidden ? 'hidden md:flex' : 'flex'}
                   ${isActive
                      ? 'md:bg-accent/10 text-accent font-medium'
                      : 'text-secondary hover:bg-raised/50 hover:text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 shrink-0 md:mx-auto lg:mx-0 ${isActive ? 'text-accent' : 'text-secondary group-hover:text-secondary'}`} />
                    <span className="hidden md:inline lg:inline md:text-xs lg:text-sm">{item.name}</span>
                    <span className="md:hidden truncate w-full text-center">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer — System Status (Hidden on mobile and tablet) */}
        <div className="hidden lg:block p-4 m-3 rounded-xl bg-base border border-border shrink-0">
          <div className="flex items-center justify-between text-secondary font-medium text-xs mb-2">
            <span>System Status</span>
            <span className="flex items-center gap-1 text-success text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Online
            </span>
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
            Connected to local DB
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
