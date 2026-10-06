import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, Tags, MapPin, ShieldCheck } from 'lucide-react';
import CategoriesTab from '../components/categories/CategoriesTab';
import LocationsTab from '../components/settings/LocationsTab';
import RolesTab from '../components/settings/RolesTab';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import PageHeader from '../components/ui/PageHeader';

const Settings = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  // Google Workspace directory sync is not implemented yet, so it has no tab
  // here; add it back once there is a real configuration screen.
  const tabs = [
    { name: 'Roles & Permissions', path: '/settings/roles', icon: ShieldCheck, permissionKey: 'roles:read' },
    { name: 'Categories', path: '/settings/categories', icon: Tags, permissionKey: 'categories:read' },
    { name: 'Locations', path: '/settings/locations', icon: MapPin, permissionKey: 'locations:read' },
  ];

  const visibleTabs = tabs.filter(tab => {
    if (!tab.permissionKey) return true;
    return hasPermission(tab.permissionKey);
  });

  // Unknown or bare /settings paths land on the first tab this user can open.
  const defaultSettingsPath = visibleTabs[0]?.path || '/';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        icon={SettingsIcon}
        title="System Settings"
        subtitle="Manage roles and permissions, asset categories, and office locations."
      />

      {/* Tabs Navigation */}
      <div className="border-b border-border/60">
        <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <NavLink
                key={tab.name}
                to={tab.path}
                className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-secondary hover:text-secondary hover:border-border'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-secondary'}`} />
                {tab.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        <Routes>
          <Route element={<ProtectedRoute requiredPermission="roles:read" />}>
            <Route path="roles" element={<RolesTab />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="categories:read" />}>
            <Route path="categories" element={<CategoriesTab />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="locations:read" />}>
            <Route path="locations" element={<LocationsTab />} />
          </Route>
          <Route path="*" element={<Navigate to={defaultSettingsPath} replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default Settings;
