import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OfflineBanner from './OfflineBanner';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-20 lg:ml-64 transition-all duration-300 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <OfflineBanner />
        <TopBar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
