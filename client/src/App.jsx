import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

import MainLayout from './components/layout/MainLayout';
import { recordLocation } from './utils/navHistory';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AssetDetail = lazy(() => import('./pages/AssetDetail'));
const AddEditAsset = lazy(() => import('./pages/AddEditAsset'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Employees = lazy(() => import('./pages/Employees'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Tickets = lazy(() => import('./pages/Tickets'));
const DirectorDashboard = lazy(() => import('./pages/DirectorDashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Offboarding = lazy(() => import('./pages/Offboarding'));
const HrDashboard = lazy(() => import('./pages/HrDashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Feeds utils/navHistory so pages can link back to where the user came from.
const LocationTracker = () => {
  const location = useLocation();
  useEffect(() => {
    recordLocation(location);
  }, [location]);
  return null;
};

const PHONE_QUERY = '(max-width: 639px)';

// Toasts sit below the top bar on phones (the bottom has the tab bar) and in
// the bottom-right corner on larger screens, so they never cover the
// notification bell or the user menu.
const AppToaster = () => {
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const handleChange = (e) => setIsPhone(e.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return (
    <Toaster
      position={isPhone ? 'top-center' : 'bottom-right'}
      containerStyle={isPhone ? { top: 'calc(4.5rem + 8px)' } : undefined}
      toastOptions={{
        style: {
          background: 'var(--theme-surface)',
          color: 'var(--theme-text-primary)',
          border: '1px solid var(--theme-border)',
        },
      }}
    />
  );
};

const RoleBasedDashboard = () => {
  const { user, hasPermission } = useAuth();
  // Director check must come first and must be an explicit role check, not a permission check,
  // because admin also has roles:manage.
  if (user?.role === 'director' || user?.isDirector) return <DirectorDashboard />;
  // HR users can legitimately receive assets:read (for example to fulfill an
  // onboarding item). Their workspace is still the HR dashboard, not IT
  // inventory. Check the role/queue identity before capability-based fallbacks.
  if (user?.role === 'hr' || user?.adminType === 'hr') return <HrDashboard />;
  if (hasPermission('assets:read')) return <Dashboard />;
  if (hasPermission('onboarding:read')) return <HrDashboard />;
  if (hasPermission('tickets:read')) return <EmployeeDashboard />;
  if (hasPermission('roles:read')) return <Navigate to="/settings/roles" replace />;
  if (hasPermission('categories:manage')) return <Navigate to="/settings/categories" replace />;
  if (hasPermission('locations:manage')) return <Navigate to="/settings/locations" replace />;
  return <EmployeeDashboard />;
};

const App = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <LocationTracker />
          <AppToaster />
          <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-base">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-secondary text-sm font-medium animate-pulse">Loading AssetTrack...</p>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  {/* Common Routes */}
                  <Route index element={<RoleBasedDashboard />} />
                  
                  {/* Profile — accessible to all authenticated users */}
                  <Route path="profile" element={<ProfilePage />} />

                  {/* Settings Routes */}
                  <Route element={<ProtectedRoute requiredAnyPermission={['roles:read', 'categories:manage', 'locations:manage']} />}>
                    <Route path="settings/*" element={<Settings />} />
                  </Route>

                  {/* Inventory & Asset Routes — Static routes FIRST */}
                  <Route element={<ProtectedRoute requiredPermission="assets:create" />}>
                    <Route path="inventory/new" element={<AddEditAsset />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredPermission="assets:read" />}>
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="inventory/:id" element={<AssetDetail />} />
                    <Route path="assets/:id" element={<AssetDetail />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredPermission="assets:update" />}>
                    <Route path="inventory/:id/edit" element={<AddEditAsset />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredPermission="scanner:read" />}>
                    <Route path="scanner" element={<Scanner />} />
                  </Route>

                  {/* Tickets Route */}
                  <Route element={<ProtectedRoute requiredPermission="tickets:read" />}>
                    <Route path="tickets" element={<Tickets />} />
                  </Route>

                  {/* Employees & Onboarding Routes */}
                  <Route element={<ProtectedRoute requiredPermission="employees:read" />}>
                    <Route path="employees" element={<Employees />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredPermission="onboarding:read" />}>
                    <Route path="onboarding" element={<Onboarding />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredPermission="offboarding:read" />}>
                    <Route path="offboarding" element={<Offboarding />} />
                  </Route>

                  {/* Catch-all Route for 404s (signed-out users are sent to
                      /login by the ProtectedRoute above before reaching it) */}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
