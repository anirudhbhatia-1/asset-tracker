import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Users, 
  Settings, 
  ShieldCheck,
  Ticket,
  UserPlus
} from 'lucide-react';

const allNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'employee', 'hr'] },
  { name: 'Inventory', path: '/inventory', icon: Package, roles: ['admin'] },
  { name: 'Tickets', path: '/tickets', icon: Ticket, roles: ['admin', 'employee', 'hr'] },
  { name: 'Onboarding', path: '/onboarding', icon: UserPlus, roles: ['admin', 'hr'] },
  { name: 'Scanner', path: '/scanner', icon: QrCode, roles: ['admin'] },
  { name: 'Employees', path: '/employees', icon: Users, roles: ['admin', 'hr'] },
  { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
];

const Sidebar = ({ isOpen = true }) => {
  const { user } = useAuth();
  const role = user?.role || 'employee';

  const visibleNavItems = allNavItems.filter(item => item.roles.includes(role));
  const mobileNavItems = visibleNavItems.slice(0, 5);

  return (
    <>
      {/* Container is bottom tab bar on mobile, left sidebar on md+ */}
      <aside className={`
        fixed z-50 flex bg-surface
        
        /* Mobile: Bottom Tab Bar */
        bottom-0 left-0 right-0 w-full flex-row items-center justify-around
        h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]
        border-t border-border
        
        /* Tablet/Desktop: Left Sidebar */
        md:top-0 md:bottom-auto md:left-0 md:h-screen ${isOpen ? 'md:w-64' : 'md:w-20'}
        md:flex-col md:border-t-0 md:border-r md:justify-start md:pb-0
        transition-all duration-300 ease-in-out select-none
      `}>
        
        {/* Brand Header (Hidden on Mobile, visible on md+) */}
        <div className={`hidden md:flex h-16 px-4 items-center border-b border-border shrink-0 ${isOpen ? 'justify-start lg:px-6' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="ThinkVibes Logo" className="w-full h-full object-contain" />
            </div>
            {isOpen && (
              <div className="hidden md:block">
                <span className="font-bold text-lg tracking-tight text-primary flex items-center gap-1.5">
                  ThinkVibes
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
                </span>
                <span className="block text-[10px] text-secondary uppercase font-semibold tracking-wider -mt-1">
                  Asset Management
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-1 md:flex-col md:py-6 md:px-3 md:space-y-1 md:overflow-y-auto w-full h-full md:h-auto items-center justify-around md:justify-start">
          
          {/* We map visible items */}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isMobileHidden = !mobileNavItems.some(m => m.name === item.name);
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col md:flex-row items-center ${isOpen ? 'md:justify-start' : 'md:justify-center'} gap-1 md:gap-3 
                   w-full px-2 md:px-3 py-2 md:py-2.5 rounded-lg text-[10px] md:text-sm transition-all duration-150 group
                   ${isMobileHidden ? 'hidden md:flex' : 'flex'}
                   ${isActive
                      ? 'md:bg-accent/10 text-accent font-medium'
                      : 'text-secondary hover:bg-raised/50 hover:text-primary'
                  }`
                }
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
        </nav>

        {/* Sidebar Footer — System Status (Hidden on mobile and tablet) */}
        {isOpen && (
          <div className="hidden md:block p-4 m-3 rounded-xl bg-base border border-border shrink-0">
            <div className="flex items-center justify-between text-secondary font-medium text-xs mb-2">
              <span>System Status</span>
              <span className="flex items-center gap-1 text-success text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Online
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
