import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, Tags, Globe, MapPin, ShieldCheck } from 'lucide-react';
import CategoriesTab from '../components/categories/CategoriesTab';
import LocationsTab from '../components/settings/LocationsTab';
import RolesTab from '../components/settings/RolesTab';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';

const Settings = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const tabs = [
    { name: 'Google Workspace', path: '/settings/google', icon: Globe, permissionKey: 'settings:read' },
    { name: 'Roles & Permissions', path: '/settings/roles', icon: ShieldCheck, permissionKey: 'roles:read' },
    { name: 'Categories', path: '/settings/categories', icon: Tags, permissionKey: 'categories:read' },
    { name: 'Locations', path: '/settings/locations', icon: MapPin, permissionKey: 'locations:read' },
  ];

  const defaultSettingsPath = hasPermission('settings:read')
    ? 'google'
    : hasPermission('roles:read')
      ? 'roles'
      : hasPermission('categories:read')
        ? 'categories'
        : 'locations';

  const visibleTabs = tabs.filter(tab => {
    if (!tab.permissionKey) return true;
    return hasPermission(tab.permissionKey);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-accent" />
          System Settings
        </h2>
        <p className="text-sm text-secondary mt-1">
          Manage roles, permissions matrix, categories, locations, and application preferences.
        </p>
      </div>

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
          <Route element={<ProtectedRoute requiredPermission="settings:read" />}>
            <Route path="google" element={
              <div className="bg-surface border border-border rounded-xl p-8 text-center text-secondary animate-fadeIn">
                <Globe className="w-12 h-12 text-secondary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-primary">Google Workspace Sync</h3>
                <p className="text-sm text-secondary mt-1 max-w-md mx-auto">
                  OAuth configuration and manual/cron sync controls are disabled in this phase.
                </p>
              </div>
            } />
          </Route>
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
