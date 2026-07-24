import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';

import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import AssetDetail from './pages/AssetDetail';
import AddEditAsset from './pages/AddEditAsset';
import Scanner from './pages/Scanner';
import Employees from './pages/Employees';
import Settings from './pages/Settings';

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
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
