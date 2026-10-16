import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OfflineBanner from './OfflineBanner';
import RouteErrorBoundary from '../ErrorBoundary';

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
      {/* First stop for keyboard users: jump past the sidebar and top bar. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-on-accent focus:shadow-lg"
      >
        Skip to Main Content
      </a>
      <Sidebar isOpen={isSidebarOpen} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <OfflineBanner />
        <TopBar toggleSidebar={toggleSidebar} />
        {/* overflow-x-clip (not overflow-auto) so position: sticky children stick to the window scroll */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-x-clip scroll-mt-20 focus:outline-none">
          {/* A page that fails to render shows a friendly error here; the
              sidebar and top bar keep working. */}
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
