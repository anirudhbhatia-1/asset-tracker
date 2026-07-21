import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import AssetDetail from './pages/AssetDetail';
import AddEditAsset from './pages/AddEditAsset';
import Scanner from './pages/Scanner';
import Employees from './pages/Employees';
import Categories from './pages/Categories';
import Settings from './pages/Settings';

const App = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
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
          <Route path="categories" element={<Categories />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
