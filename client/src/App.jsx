import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

import MainLayout from './components/layout/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AssetDetail = lazy(() => import('./pages/AssetDetail'));
const AddEditAsset = lazy(() => import('./pages/AddEditAsset'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Employees = lazy(() => import('./pages/Employees'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const HrDashboard = lazy(() => import('./pages/HrDashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
import { useAuth } from './context/AuthContext';

const RoleBasedDashboard = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Dashboard />;
  if (user?.role === 'hr') return <HrDashboard />;
  return <EmployeeDashboard />;
};

const App = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            containerClassName="mt-16 sm:mt-0"
            toastOptions={{
              style: {
                background: 'var(--theme-surface)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-border)',
              },
            }}
          />
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
                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="settings/*" element={<Settings />} />
                  </Route>

                  {/* Admin Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="inventory/new" element={<AddEditAsset />} />
                    <Route path="inventory/:id" element={<AssetDetail />} />
                    <Route path="inventory/:id/edit" element={<AddEditAsset />} />
                    <Route path="scanner" element={<Scanner />} />
                  </Route>

                  {/* Admin + Employee + HR Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'employee', 'hr']} />}>
                    <Route path="tickets" element={<Tickets />} />
                  </Route>

                  {/* Admin + HR Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
                    <Route path="employees" element={<Employees />} />
                    <Route path="onboarding" element={<Onboarding />} />
                  </Route>
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
