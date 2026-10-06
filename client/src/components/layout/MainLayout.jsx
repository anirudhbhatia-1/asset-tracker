import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OfflineBanner from './OfflineBanner';

// The full 256px sidebar only auto-opens from xl (1280px); between 768 and
// 1279px it starts as the 80px icon rail so tables keep their width.
const WIDE_QUERY = '(min-width: 1280px)';
const isWideScreen = () => typeof window === 'undefined' || window.matchMedia(WIDE_QUERY).matches;

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(isWideScreen);

  // Open on wide screens, collapsed below 1280px — but only when the width
  // crosses that breakpoint, so ordinary resizes keep a manual toggle.
  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const handleChange = (e) => setIsSidebarOpen(e.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  return (
    <div className="min-h-screen bg-base text-primary flex">
      <Sidebar isOpen={isSidebarOpen} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <OfflineBanner />
        <TopBar toggleSidebar={toggleSidebar} />
        {/* overflow-x-clip (not overflow-auto) so position: sticky children stick to the window scroll */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-x-clip">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
