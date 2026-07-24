import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';

import MainLayout from './components/layout/MainLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AssetDetail = lazy(() => import('./pages/AssetDetail'));
const AddEditAsset = lazy(() => import('./pages/AddEditAsset'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Employees = lazy(() => import('./pages/Employees'));
const Settings = lazy(() => import('./pages/Settings'));

const App = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
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
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="inventory/new" element={<AddEditAsset />} />
              <Route path="inventory/:id" element={<AssetDetail />} />
              <Route path="inventory/:id/edit" element={<AddEditAsset />} />
              <Route path="scanner" element={<Scanner />} />
              <Route path="employees" element={<Employees />} />
              <Route path="settings/*" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
