import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OfflineBanner from './OfflineBanner';

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto-close on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isOpen={isSidebarOpen} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <OfflineBanner />
        <TopBar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
