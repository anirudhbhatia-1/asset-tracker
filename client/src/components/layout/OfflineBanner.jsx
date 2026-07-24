import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-rose-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-center gap-2.5 shadow-md z-50 transition-all animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        You are currently offline. Changes will not be saved to the database until network connectivity is restored.
      </span>
    </div>
  );
}
