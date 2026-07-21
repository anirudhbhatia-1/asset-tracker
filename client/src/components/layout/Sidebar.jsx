import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  Users, 
  Tags, 
  Settings, 
  ShieldCheck 
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Barcode Scanner', path: '/scanner', icon: QrCode },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Categories', path: '/categories', icon: Tags },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = () => {
  return (
    <aside className="w-64 bg-slate-800 h-screen fixed left-0 top-0 border-r border-slate-700 flex flex-col z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight text-slate-100 flex items-center gap-1.5">
            AssetTrack
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
          </span>
          <span className="block text-[10px] text-slate-400 uppercase font-semibold tracking-wider -mt-1">
            IT Operations
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500 font-medium'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer — System Status */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/50 border border-slate-700/60 text-xs space-y-2">
        <div className="flex items-center justify-between text-slate-300 font-medium">
          <span>System Status</span>
          <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Connected to local SQLite database (`assets.db`)
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
